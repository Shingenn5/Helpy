import { exec } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

import type { CommandDefinition, Extension, ExtensionContext, UIComponentDefinition } from '@aiderdesk/extensions';

const execAsync = promisify(exec);

type Config = {
  endpoint: string;
  composeFile: string;
  modelName: string;
};

const DEFAULT_CONFIG: Config = {
  endpoint: process.env.HELPY_BACKEND_ENDPOINT || 'http://127.0.0.1:8080/v1',
  composeFile: process.env.HELPY_COMPOSE_FILE || '/home/shingen/Tech Projects/Helpy/docker-compose.yml',
  modelName: process.env.HELPY_MODEL_NAME || 'Qwen3.6-35B-A3B-UD-IQ2_M.gguf',
};

export default class HelpyLocalBackendExtension implements Extension {
  static metadata = {
    name: 'Helpy Local Backend',
    version: '0.1.0',
    description: 'Adds local llama.cpp status and Docker Compose commands',
    author: 'Shingenn5',
    capabilities: ['local-backend', 'docker', 'ui', 'commands'],
  };

  private configPath = join(__dirname, 'config.json');
  private lastStatus = { online: false, label: 'unchecked', checkedAt: '' };

  async onLoad(context: ExtensionContext): Promise<void> {
    await this.refreshStatus(context);
    context.log(`Local backend extension loaded: ${this.lastStatus.label}`, 'info');
  }

  getCommands(): CommandDefinition[] {
    return [
      {
        name: 'helpy-backend-status',
        description: 'Check the local llama.cpp backend status',
        execute: async (_args, context) => {
          await this.refreshStatus(context);
          context.getTaskContext()?.addLogMessage('info', `Backend: ${this.lastStatus.label}`);
        },
      },
      {
        name: 'helpy-backend-start',
        description: 'Start the local llama.cpp Docker Compose backend',
        execute: async (_args, context) => {
          const output = await this.compose('up -d');
          await this.refreshStatus(context);
          context.getTaskContext()?.addLogMessage('info', output.slice(0, 2000));
        },
      },
      {
        name: 'helpy-backend-stop',
        description: 'Stop the local llama.cpp Docker Compose backend',
        execute: async (_args, context) => {
          const output = await this.compose('stop');
          await this.refreshStatus(context);
          context.getTaskContext()?.addLogMessage('info', output.slice(0, 2000));
        },
      },
      {
        name: 'helpy-backend-logs',
        description: 'Show recent local backend logs',
        execute: async (_args, context) => {
          const output = await this.compose('logs --tail 80');
          context.getTaskContext()?.addLogMessage('info', output.slice(-6000));
        },
      },
    ];
  }

  getUIComponents(): UIComponentDefinition[] {
    return [
      {
        id: 'helpy-local-backend-status',
        placement: 'header-right',
        loadData: true,
        noDataCache: true,
        jsx: `
          <div className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs text-text-secondary">
            <span style={{
              width: 8, height: 8, borderRadius: 999,
              background: data && data.online ? '#22c55e' : '#f59e0b',
              display: 'inline-block'
            }} />
            <span>{data ? data.label : 'local backend'}</span>
          </div>
        `,
      },
    ];
  }

  async getUIExtensionData(_componentId: string, context: ExtensionContext): Promise<unknown> {
    await this.refreshStatus(context);
    return this.lastStatus;
  }

  private async refreshStatus(_context: ExtensionContext): Promise<void> {
    const config = this.loadConfig();
    try {
      const res = await fetch(`${config.endpoint.replace(/\/$/, '')}/models`);
      if (!res.ok) {
        this.lastStatus = { online: false, label: `backend HTTP ${res.status}`, checkedAt: new Date().toISOString() };
        return;
      }
      const data = await res.json() as Record<string, unknown>;
      const models = Array.isArray(data.data) ? data.data.length : Array.isArray(data.models) ? data.models.length : 0;
      this.lastStatus = { online: true, label: `local model online (${models})`, checkedAt: new Date().toISOString() };
    } catch {
      this.lastStatus = { online: false, label: 'local model offline', checkedAt: new Date().toISOString() };
    }
  }

  private async compose(command: string): Promise<string> {
    const config = this.loadConfig();
    const escaped = config.composeFile.replace(/"/g, '\\"');
    const { stdout, stderr } = await execAsync(`docker compose -f "${escaped}" ${command}`, { timeout: 120000 });
    return `${stdout}\n${stderr}`.trim();
  }

  private loadConfig(): Config {
    try {
      if (existsSync(this.configPath)) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(this.configPath, 'utf-8')) };
      }
    } catch {
      // use the boring defaults
    }
    return { ...DEFAULT_CONFIG };
  }
}
