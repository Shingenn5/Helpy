import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import type {
  CommandDefinition,
  Extension,
  ExtensionContext,
  ImportantRemindersEvent,
  PromptTemplateEvent,
} from '@aiderdesk/extensions';

type Config = {
  vaultRoot: string;
  rulesFile: string;
};

const DEFAULT_RULES = [
  '# Helpy Model Rules',
  '',
  '## Personality',
  '',
  '- Be direct, practical, and local-first.',
  '- Prefer privacy, filesystem ownership, and reproducible workflows.',
  '',
  '## Workstation Rules',
  '',
  '- Use the local llama.cpp backend unless the user explicitly chooses otherwise.',
  '- Preserve Obsidian Markdown logs as the durable memory layer.',
  '- Keep Graphify-friendly links, tags, and frontmatter in generated notes.',
  '',
].join('\n');

const DEFAULT_CONFIG: Config = {
  vaultRoot: process.env.HELPY_VAULT_ROOT || join(homedir(), 'HelpyVault', 'Helpy'),
  rulesFile: 'Rules/Helpy Model Rules.md',
};

const configComponentJsx = readFileSync(join(__dirname, 'ConfigComponent.jsx'), 'utf-8');

export default class HelpyRulesMemoryExtension implements Extension {
  static metadata = {
    name: 'Helpy Rules Memory',
    version: '0.1.0',
    description: 'Injects persistent local rules/personality from an Obsidian Markdown file',
    author: 'Shingenn5',
    capabilities: ['rules', 'memory', 'obsidian'],
  };

  private configPath = join(__dirname, 'config.json');

  async onLoad(context: ExtensionContext): Promise<void> {
    this.ensureRulesFile();
    context.log(`Rules memory loaded from ${this.rulesPath()}`, 'info');
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
    this.ensureRulesFile(config);
    return config;
  }

  getCommands(): CommandDefinition[] {
    return [
      {
        name: 'helpy-rules-show',
        description: 'Show the persistent Helpy model rules',
        execute: async (_args, context) => {
          context.getTaskContext()?.addLogMessage('info', this.readRules());
        },
      },
      {
        name: 'helpy-rules-add',
        description: 'Append a rule to the persistent Helpy model rules',
        arguments: [{ description: 'Rule text to remember', required: true }],
        execute: async (args, context) => {
          const rule = args.join(' ').trim();
          if (!rule) return;
          appendFileSync(this.rulesPath(), `\n- ${rule}\n`, 'utf-8');
          context.getTaskContext()?.addLogMessage('info', `Remembered rule: ${rule}`);
        },
      },
      {
        name: 'helpy-rules-open',
        description: 'Open the persistent Helpy model rules file',
        execute: async (_args, context) => {
          await context.openPath(this.rulesPath());
        },
      },
    ];
  }

  async onImportantReminders(event: ImportantRemindersEvent): Promise<void | Partial<ImportantRemindersEvent>> {
    const rules = this.readRules();
    return {
      remindersContent: `${event.remindersContent || ''}\n\n# Persistent Helpy Rules\n\n${rules}`.trim(),
    };
  }

  async onPromptTemplate(event: PromptTemplateEvent): Promise<void | Partial<PromptTemplateEvent>> {
    if (!event.name.toLowerCase().includes('system')) return undefined;
    const rules = this.readRules();
    return {
      prompt: `${event.prompt}\n\n# Persistent Helpy Rules\n\n${rules}`,
    };
  }

  private ensureRulesFile(config = this.loadConfig()): void {
    const path = this.rulesPath(config);
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    if (!existsSync(path)) writeFileSync(path, DEFAULT_RULES, 'utf-8');
  }

  private readRules(): string {
    this.ensureRulesFile();
    return readFileSync(this.rulesPath(), 'utf-8');
  }

  private rulesPath(config = this.loadConfig()): string {
    return join(config.vaultRoot, config.rulesFile);
  }

  private loadConfig(): Config {
    try {
      if (existsSync(this.configPath)) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(this.configPath, 'utf-8')) };
      }
    } catch {
      // no big drama
    }
    return { ...DEFAULT_CONFIG };
  }
}
