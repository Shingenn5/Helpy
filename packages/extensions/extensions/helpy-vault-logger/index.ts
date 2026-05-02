import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import type {
  Extension,
  ExtensionContext,
  PromptStartedEvent,
  ResponseCompletedEvent,
  AgentStartedEvent,
  AgentFinishedEvent,
  FilesAddedEvent,
  ToolFinishedEvent,
  CommandDefinition,
} from '@aiderdesk/extensions';

type Config = {
  vaultRoot: string;
  sessionsDir: string;
  appendToolEvents: boolean;
  appendFileEvents: boolean;
};

const DEFAULT_CONFIG: Config = {
  vaultRoot: process.env.HELPY_VAULT_ROOT || '/home/shingen/HelpyVault/Helpy',
  sessionsDir: 'Sessions',
  appendToolEvents: true,
  appendFileEvents: true,
};

export default class HelpyVaultLoggerExtension implements Extension {
  static metadata = {
    name: 'Helpy Vault Logger',
    version: '0.1.0',
    description: 'Streams AiderDesk sessions into Obsidian Markdown notes',
    author: 'Shingenn5',
    capabilities: ['obsidian', 'markdown', 'logging'],
  };

  private configPath = join(__dirname, 'config.json');

  async onLoad(context: ExtensionContext): Promise<void> {
    const config = this.loadConfig();
    this.ensureDir(this.sessionRoot(config));
    context.log(`Vault logger ready at ${this.sessionRoot(config)}`, 'info');
  }

  getCommands(): CommandDefinition[] {
    return [
      {
        name: 'helpy-open-vault',
        description: 'Open the Helpy Obsidian vault folder',
        execute: async (_args, context) => {
          const config = this.loadConfig();
          await context.openPath(config.vaultRoot);
        },
      },
      {
        name: 'helpy-log-snapshot',
        description: 'Write a snapshot of the current task to the Helpy vault',
        execute: async (_args, context) => {
          const task = context.getTaskContext();
          if (!task) return;
          const messages = await task.getContextMessages();
          this.append(context, 'Snapshot', [
            `Captured ${messages.length} context messages.`,
            '',
            '```json',
            JSON.stringify(messages, null, 2),
            '```',
          ].join('\n'));
          task.addLogMessage('info', 'Helpy vault snapshot written.');
        },
      },
    ];
  }

  async onPromptStarted(event: PromptStartedEvent, context: ExtensionContext): Promise<void> {
    this.append(context, 'User', event.prompt || '(empty prompt)');
  }

  async onResponseCompleted(event: ResponseCompletedEvent, context: ExtensionContext): Promise<void> {
    const response = event.response as unknown as Record<string, unknown>;
    const content =
      String(response.content || response.text || response.message || '') ||
      JSON.stringify(response, null, 2);
    this.append(context, 'Assistant', content);
  }

  async onAgentStarted(event: AgentStartedEvent, context: ExtensionContext): Promise<void> {
    this.append(context, 'Agent Started', [
      `Mode: ${event.mode}`,
      `Model: ${event.model}`,
      `Provider: ${event.agentProfile?.provider || 'unknown'}`,
    ].join('\n'));
  }

  async onAgentFinished(event: AgentFinishedEvent, context: ExtensionContext): Promise<void> {
    this.append(context, 'Agent Finished', `Aborted: ${event.aborted}\nMessages: ${event.resultMessages.length}`);
  }

  async onFilesAdded(event: FilesAddedEvent, context: ExtensionContext): Promise<void> {
    const config = this.loadConfig();
    if (!config.appendFileEvents) return;
    const files = event.files.map((file) => `- [[${file.path}]]${file.readOnly ? ' read-only' : ''}`).join('\n');
    this.append(context, 'Context Files Added', files || '(none)');
  }

  async onToolFinished(event: ToolFinishedEvent, context: ExtensionContext): Promise<void> {
    const config = this.loadConfig();
    if (!config.appendToolEvents) return;
    this.append(context, 'Tool Finished', [
      `Tool: ${event.toolName}`,
      '',
      '```json',
      JSON.stringify({ input: event.input, output: event.output }, null, 2).slice(0, 6000),
      '```',
    ].join('\n'));
  }

  private append(context: ExtensionContext, heading: string, body: string): void {
    const config = this.loadConfig();
    const notePath = this.sessionPath(config, context);
    this.ensureSessionNote(notePath, context);
    appendFileSync(notePath, `\n\n## ${this.now()} ${heading}\n\n${body.trim()}\n`, 'utf-8');
  }

  private ensureSessionNote(notePath: string, context: ExtensionContext): void {
    if (existsSync(notePath)) return;
    const projectDir = context.getProjectDir() || 'No project';
    const task = context.getTaskContext()?.data as unknown as Record<string, unknown> | undefined;
    const title = String(task?.name || task?.id || basename(projectDir) || 'Helpy session');
    const frontmatter = [
      '---',
      `title: "${this.escapeYaml(title)}"`,
      `created: "${new Date().toISOString()}"`,
      `project: "${this.escapeYaml(projectDir)}"`,
      `task_id: "${this.escapeYaml(String(task?.id || 'unknown'))}"`,
      'tool: AiderDesk',
      'helpy_extension: vault-logger',
      'type: coding-agent-session',
      'tags:',
      '  - helpy',
      '  - aiderdesk',
      '  - coding-agent-session',
      '---',
      '',
      `# ${title}`,
      '',
      `Project: [[${basename(projectDir)}]]`,
    ].join('\n');
    writeFileSync(notePath, frontmatter, 'utf-8');
  }

  private sessionPath(config: Config, context: ExtensionContext): string {
    const task = context.getTaskContext()?.data as unknown as Record<string, unknown> | undefined;
    const projectName = basename(context.getProjectDir() || 'global').replace(/[^\w.-]+/g, '-');
    const taskId = String(task?.id || 'session').replace(/[^\w.-]+/g, '-');
    const day = new Date().toISOString().slice(0, 10);
    const dir = join(this.sessionRoot(config), day);
    this.ensureDir(dir);
    return join(dir, `${day}-${projectName}-${taskId}.md`);
  }

  private sessionRoot(config: Config): string {
    return join(config.vaultRoot, config.sessionsDir);
  }

  private loadConfig(): Config {
    try {
      if (existsSync(this.configPath)) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(this.configPath, 'utf-8')) };
      }
    } catch {
      // meh, use defaults
    }
    return { ...DEFAULT_CONFIG };
  }

  private ensureDir(path: string): void {
    if (!existsSync(path)) mkdirSync(path, { recursive: true });
  }

  private now(): string {
    return new Date().toLocaleTimeString();
  }

  private escapeYaml(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }
}
