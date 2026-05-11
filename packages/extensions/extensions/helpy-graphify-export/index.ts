import { exec, spawn, ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';

import type {
  AgentFinishedEvent,
  CommandDefinition,
  Extension,
  ExtensionContext,
  FilesAddedEvent,
  PromptFinishedEvent,
} from '@aiderdesk/extensions';

type Config = {
  vaultRoot: string;
  graphDir: string;
  graphifyCommand: string;
  graphifyOutDir: string;
  autoUpdateOnPrompt: boolean;
};

const DEFAULT_CONFIG: Config = {
  vaultRoot: process.env.HELPY_VAULT_ROOT || join(homedir(), 'HelpyVault', 'Helpy'),
  graphDir: 'Graph',
  graphifyCommand: process.env.HELPY_GRAPHIFY_COMMAND || 'graphify',
  graphifyOutDir: 'graphify-out',
  autoUpdateOnPrompt: false,
};

const configComponentJsx = readFileSync(join(__dirname, 'ConfigComponent.jsx'), 'utf-8');
const execAsync = promisify(exec);

export default class HelpyGraphifyExportExtension implements Extension {
  static metadata = {
    name: 'Helpy Graphify Export',
    version: '0.1.0',
    description: 'Writes Graphify-friendly Markdown indexes for projects, tasks, files, and models',
    author: 'Shingenn5',
    capabilities: ['graphify', 'obsidian', 'markdown'],
  };

  private configPath = join(__dirname, 'config.json');
  private watchProcess: ChildProcess | null = null;

  async onLoad(context: ExtensionContext): Promise<void> {
    const config = this.loadConfig();
    this.ensureDir(join(config.vaultRoot, config.graphDir));
    this.ensureGraphifyIgnore(config);
    context.log('Graphify export ready', 'info');
  }

  async onUnload(): Promise<void> {
    this.stopWatch();
  }

  getConfigComponent(): string {
    return configComponentJsx;
  }

  async getConfigData(): Promise<Config> {
    return this.loadConfig();
  }

  async saveConfigData(configData: unknown): Promise<Config> {
    const config = { ...DEFAULT_CONFIG, ...(configData as Partial<Config>) };
    writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    this.ensureDir(join(config.vaultRoot, config.graphDir));
    this.ensureGraphifyIgnore(config);
    return config;
  }

  getCommands(): CommandDefinition[] {
    return [
      {
        name: 'helpy-graphify-refresh',
        description: 'Refresh the current project helper note for Graphify',
        execute: async (_args, context) => {
          await this.writeProjectGraph(context, 'manual refresh');
          context.getTaskContext()?.addLogMessage('info', 'Helpy graph note refreshed.');
        },
      },
      {
        name: 'helpy-graphify-build',
        description: 'Run graphify against the configured Helpy memory folder',
        execute: async (_args, context) => {
          await this.writeProjectGraph(context, 'graphify build requested');
          const output = await this.runGraphify('', context);
          context.getTaskContext()?.addLogMessage('info', output || 'Graphify build finished.');
        },
      },
      {
        name: 'helpy-graphify-update',
        description: 'Run graphify --update against the configured Helpy memory folder',
        execute: async (_args, context) => {
          await this.writeProjectGraph(context, 'graphify update requested');
          const output = await this.runGraphify('--update', context);
          context.getTaskContext()?.addLogMessage('info', output || 'Graphify update finished.');
        },
      },
      {
        name: 'helpy-graphify-watch',
        description: 'Start graphify --watch for the configured Helpy memory folder',
        execute: async (_args, context) => {
          const output = this.startWatch(context);
          context.getTaskContext()?.addLogMessage('info', output);
        },
      },
      {
        name: 'helpy-graphify-stop-watch',
        description: 'Stop the running Graphify watch process',
        execute: async (_args, context) => {
          const stopped = this.stopWatch();
          context.getTaskContext()?.addLogMessage('info', stopped ? 'Graphify watch stopped.' : 'Graphify watch was not running.');
        },
      },
      {
        name: 'helpy-graphify-query',
        description: 'Query the generated Graphify graph',
        arguments: [{ description: 'Question to ask the graph', required: true }],
        execute: async (args, context) => {
          const question = args.join(' ').trim();
          if (!question) {
            context.getTaskContext()?.addLogMessage('warning', 'Usage: /helpy-graphify-query what connects X to Y?');
            return;
          }
          const config = this.loadConfig();
          const graphPath = join(config.vaultRoot, config.graphifyOutDir, 'graph.json');
          const command = `${config.graphifyCommand} query ${this.quote(question)} --graph ${this.quote(graphPath)}`;
          const output = await this.execCommand(command, config.vaultRoot);
          context.getTaskContext()?.addLogMessage('info', output || 'Graphify query finished.');
        },
      },
      {
        name: 'helpy-graphify-open-report',
        description: 'Open the latest Graphify report folder',
        execute: async (_args, context) => {
          const config = this.loadConfig();
          await context.openPath(join(config.vaultRoot, config.graphifyOutDir));
        },
      },
    ];
  }

  async onPromptFinished(_event: PromptFinishedEvent, context: ExtensionContext): Promise<void> {
    await this.writeProjectGraph(context, 'prompt finished');
    const config = this.loadConfig();
    if (config.autoUpdateOnPrompt) {
      const output = await this.runGraphify('--update --no-viz', context).catch((error) => String(error));
      context.getTaskContext()?.addLogMessage('info', `Graphify auto-update: ${output.slice(0, 1200)}`);
    }
  }

  async onAgentFinished(event: AgentFinishedEvent, context: ExtensionContext): Promise<void> {
    await this.writeProjectGraph(context, `agent finished; ${event.resultMessages.length} result messages`);
  }

  async onFilesAdded(event: FilesAddedEvent, context: ExtensionContext): Promise<void> {
    const config = this.loadConfig();
    const projectDir = context.getProjectDir();
    const projectName = basename(projectDir || 'global');
    const dir = join(config.vaultRoot, config.graphDir, 'Files');
    this.ensureDir(dir);

    for (const file of event.files) {
      const fileName = file.path.replace(/[\\/]+/g, '__').replace(/[^\w.-]+/g, '-');
      const note = join(dir, `${fileName}.md`);
      if (!existsSync(note)) {
        writeFileSync(note, this.frontmatter('context-file', file.path, projectName), 'utf-8');
      }
      appendFileSync(note, `\n- Seen in [[${projectName}]] at ${new Date().toISOString()}\n`, 'utf-8');
    }
  }

  private async writeProjectGraph(context: ExtensionContext, reason: string): Promise<void> {
    const config = this.loadConfig();
    const task = context.getTaskContext();
    const projectDir = context.getProjectDir();
    const projectName = basename(projectDir || 'global');
    const dir = join(config.vaultRoot, config.graphDir, 'Projects');
    this.ensureDir(dir);
    const note = join(dir, `${projectName.replace(/[^\w.-]+/g, '-')}.md`);
    const contextFiles = task ? await task.getContextFiles().catch(() => []) : [];
    const data = task?.data as unknown as Record<string, unknown> | undefined;

    const body = [
      this.frontmatter('project', projectName, projectName),
      `# ${projectName}`,
      '',
      `Path: \`${projectDir || 'unknown'}\``,
      `Last event: ${reason}`,
      `Updated: ${new Date().toISOString()}`,
      '',
      '## Active Task',
      '',
      `- Task: [[${String(data?.name || data?.id || 'unknown')}]]`,
      `- Status: ${String(data?.status || 'unknown')}`,
      `- Mode: ${String(data?.currentMode || 'unknown')}`,
      '',
      '## Context Files',
      '',
      contextFiles.length ? contextFiles.map((file) => `- [[${file.path}]]`).join('\n') : '- none yet',
      '',
      '## Graphify Hints',
      '',
      '- type:: project',
      '- source:: aiderdesk',
      '- owner:: helpy',
      '',
      '## Relationships',
      '',
      `- [[${projectName}]] has active task [[${String(data?.name || data?.id || 'unknown')}]]`,
      `- [[${projectName}]] belongs to local path \`${projectDir || 'unknown'}\``,
      '',
    ].join('\n');

    writeFileSync(note, body, 'utf-8');
  }

  private frontmatter(type: string, title: string, project: string): string {
    return [
      '---',
      `title: "${title.replace(/"/g, '\\"')}"`,
      `type: ${type}`,
      `project: "${project.replace(/"/g, '\\"')}"`,
      'tool: Helpy',
      'tags:',
      '  - helpy',
      '  - graphify',
      '---',
      '',
    ].join('\n');
  }

  private loadConfig(): Config {
    try {
      if (existsSync(this.configPath)) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(this.configPath, 'utf-8')) };
      }
    } catch {
      // defaults are fine
    }
    return { ...DEFAULT_CONFIG };
  }

  private ensureDir(path: string): void {
    if (!existsSync(path)) mkdirSync(path, { recursive: true });
  }

  private ensureGraphifyIgnore(config: Config): void {
    const ignorePath = join(config.vaultRoot, '.graphifyignore');
    if (existsSync(ignorePath)) return;
    const body = [
      '# Helpy graphify ignore',
      'graphify-out/cache/',
      'graphify-out/converted/',
      '*.tmp',
      '*.log',
      '',
    ].join('\n');
    writeFileSync(ignorePath, body, 'utf-8');
  }

  private async runGraphify(args: string, context: ExtensionContext, timeout = 120000): Promise<string> {
    const config = this.loadConfig();
    this.ensureDir(config.vaultRoot);
    this.ensureGraphifyIgnore(config);
    const command = `${config.graphifyCommand} . ${args}`.trim();
    context.log(`Running Graphify: ${command} in ${config.vaultRoot}`, 'info');
    return this.execCommand(command, config.vaultRoot, timeout);
  }

  private startWatch(context: ExtensionContext): string {
    if (this.watchProcess && !this.watchProcess.killed) {
      return 'Graphify watch is already running.';
    }

    const config = this.loadConfig();
    this.ensureDir(config.vaultRoot);
    this.ensureGraphifyIgnore(config);

    this.watchProcess = spawn(`${config.graphifyCommand} . --watch`, {
      cwd: config.vaultRoot,
      shell: true,
      stdio: 'ignore',
      detached: false,
    });

    this.watchProcess.on('exit', (code) => {
      context.log(`Graphify watch exited with code ${code ?? 'unknown'}`, 'info');
      this.watchProcess = null;
    });

    return `Graphify watch started for ${config.vaultRoot}.`;
  }

  private stopWatch(): boolean {
    if (!this.watchProcess || this.watchProcess.killed) return false;
    this.watchProcess.kill();
    this.watchProcess = null;
    return true;
  }

  private async execCommand(command: string, cwd: string, timeout = 120000): Promise<string> {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout,
      maxBuffer: 1024 * 1024 * 8,
    });
    return [stdout, stderr].filter(Boolean).join('\n').trim();
  }

  private quote(value: string): string {
    return `"${value.replace(/(["\\$`])/g, '\\$1')}"`;
  }
}
