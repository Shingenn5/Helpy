import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { basename, join } from 'node:path';

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
};

const DEFAULT_CONFIG: Config = {
  vaultRoot: process.env.HELPY_VAULT_ROOT || '/home/shingen/HelpyVault/Helpy',
  graphDir: 'Graph',
};

export default class HelpyGraphifyExportExtension implements Extension {
  static metadata = {
    name: 'Helpy Graphify Export',
    version: '0.1.0',
    description: 'Writes Graphify-friendly Markdown indexes for projects, tasks, files, and models',
    author: 'Shingenn5',
    capabilities: ['graphify', 'obsidian', 'markdown'],
  };

  private configPath = join(__dirname, 'config.json');

  async onLoad(context: ExtensionContext): Promise<void> {
    const config = this.loadConfig();
    this.ensureDir(join(config.vaultRoot, config.graphDir));
    context.log('Graphify export ready', 'info');
  }

  getCommands(): CommandDefinition[] {
    return [
      {
        name: 'helpy-graphify-refresh',
        description: 'Refresh the current project graph note for Graphify/Obsidian',
        execute: async (_args, context) => {
          await this.writeProjectGraph(context, 'manual refresh');
          context.getTaskContext()?.addLogMessage('info', 'Helpy graph note refreshed.');
        },
      },
    ];
  }

  async onPromptFinished(_event: PromptFinishedEvent, context: ExtensionContext): Promise<void> {
    await this.writeProjectGraph(context, 'prompt finished');
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
}
