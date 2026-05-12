import { exec, spawn, ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, relative } from 'node:path';
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

type GraphifyMode = 'build' | 'update';

type MiniGraphNode = {
  id: string;
  label: string;
  type: string;
  path?: string;
};

type MiniGraphEdge = {
  source: string;
  target: string;
  relation: string;
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
          const output = await this.runGraphify('build', context);
          context.getTaskContext()?.addLogMessage('info', output || 'Graphify build finished.');
        },
      },
      {
        name: 'helpy-graphify-update',
        description: 'Run Graphify update against the configured Helpy memory folder',
        execute: async (_args, context) => {
          await this.writeProjectGraph(context, 'graphify update requested');
          const output = await this.runGraphify('update', context);
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
      const output = await this.runGraphify('update', context).catch((error) => String(error));
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

  private async runGraphify(mode: GraphifyMode, context: ExtensionContext, timeout = 120000): Promise<string> {
    const config = this.loadConfig();
    this.ensureDir(config.vaultRoot);
    this.ensureGraphifyIgnore(config);
    const commands = this.graphifyCommands(config.graphifyCommand, mode);
    const errors: string[] = [];

    for (const command of commands) {
      context.log(`Trying Graphify: ${command} in ${config.vaultRoot}`, 'info');
      try {
        const output = await this.execCommand(command, config.vaultRoot, timeout);
        return [`Graphify command: ${command}`, output].filter(Boolean).join('\n');
      } catch (error) {
        if (this.isNoCodeGraphifyRun(error)) {
          const fallback = this.writeMarkdownGraph(config);
          return [`Graphify command: ${command}`, this.outputFromError(error), fallback].filter(Boolean).join('\n');
        }
        errors.push(this.formatCommandError(command, error));
      }
    }

    const help = await this.graphifyDoctor(config).catch((error) => this.formatCommandError('graphify doctor', error));
    throw new Error(['Graphify command probing failed.', ...errors, '', help].join('\n\n'));
  }

  private startWatch(context: ExtensionContext): string {
    if (this.watchProcess && !this.watchProcess.killed) {
      return 'Graphify watch is already running.';
    }

    const config = this.loadConfig();
    this.ensureDir(config.vaultRoot);
    this.ensureGraphifyIgnore(config);

    const command = `${config.graphifyCommand} . --watch`;
    context.log(`Starting Graphify watch: ${command} in ${config.vaultRoot}`, 'info');

    this.watchProcess = spawn(command, {
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

  private graphifyCommands(command: string, mode: GraphifyMode): string[] {
    if (mode === 'build') {
      return [
        `${command} update .`,
        `${command} watch .`,
        `${command} .`,
      ];
    }

    return [
      `${command} update .`,
      `${command} . --update`,
      `${command} --update .`,
      `${command} build . --update`,
      `${command} run . --update`,
      `${command} extract . --update`,
    ];
  }

  private writeMarkdownGraph(config: Config): string {
    const outDir = join(config.vaultRoot, config.graphifyOutDir);
    this.ensureDir(outDir);

    const files = this.collectMarkdownFiles(config.vaultRoot, config);
    const nodes = new Map<string, MiniGraphNode>();
    const edges: MiniGraphEdge[] = [];

    nodes.set('helpy-vault', { id: 'helpy-vault', label: 'Helpy Vault', type: 'vault', path: config.vaultRoot });

    for (const file of files) {
      const rel = relative(config.vaultRoot, file).replace(/\\/g, '/');
      const body = readFileSync(file, 'utf-8');
      const title = this.extractTitle(body, basename(file, '.md'));
      const type = rel.split('/')[0]?.toLowerCase() || 'note';
      nodes.set(rel, { id: rel, label: title, type, path: rel });
      edges.push({ source: 'helpy-vault', target: rel, relation: 'contains' });

      for (const link of this.extractWikiLinks(body)) {
        const target = `wiki:${link}`;
        if (!nodes.has(target)) nodes.set(target, { id: target, label: link, type: 'wikilink' });
        edges.push({ source: rel, target, relation: 'links_to' });
      }
    }

    const graph = {
      tool: 'Helpy',
      generator: 'helpy-graphify-export',
      generated_at: new Date().toISOString(),
      note: 'Fallback graph created from Markdown because this Graphify CLI only updates code files.',
      nodes: [...nodes.values()],
      edges,
    };

    writeFileSync(join(outDir, 'graph.json'), JSON.stringify(graph, null, 2), 'utf-8');
    writeFileSync(join(outDir, 'GRAPH_REPORT.md'), this.markdownGraphReport(config, files, nodes.size, edges.length), 'utf-8');
    writeFileSync(join(outDir, 'graph.html'), this.markdownGraphHtml(nodes.size, edges.length), 'utf-8');

    return `Helpy Markdown graph fallback wrote ${nodes.size} nodes and ${edges.length} edges to ${outDir}.`;
  }

  private collectMarkdownFiles(root: string, config: Config): string[] {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (entry === '.git' || entry === config.graphifyOutDir || entry === 'node_modules') continue;
        const full = join(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) {
          walk(full);
        } else if (entry.toLowerCase().endsWith('.md')) {
          files.push(full);
        }
      }
    };
    walk(root);
    return files;
  }

  private extractTitle(body: string, fallback: string): string {
    const frontmatterTitle = body.match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1];
    const heading = body.match(/^#\s+(.+)$/m)?.[1];
    return (frontmatterTitle || heading || fallback).trim();
  }

  private extractWikiLinks(body: string): string[] {
    const links = new Set<string>();
    const matcher = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    let match = matcher.exec(body);
    while (match) {
      links.add(match[1].trim());
      match = matcher.exec(body);
    }
    return [...links];
  }

  private markdownGraphReport(config: Config, files: string[], nodes: number, edges: number): string {
    return [
      '# Helpy Graph Report',
      '',
      `Generated: ${new Date().toISOString()}`,
      `Vault: \`${config.vaultRoot}\``,
      '',
      'This report was generated by Helpy because the installed Graphify CLI only supports code-file updates.',
      '',
      '## Summary',
      '',
      `- Markdown files scanned: ${files.length}`,
      `- Nodes: ${nodes}`,
      `- Edges: ${edges}`,
      '',
      '## Source Folders',
      '',
      '- Sessions',
      '- Rules',
      '- Graph',
      '',
    ].join('\n');
  }

  private markdownGraphHtml(nodes: number, edges: number): string {
    return [
      '<!doctype html>',
      '<meta charset="utf-8">',
      '<title>Helpy Graph</title>',
      '<body style="font-family: system-ui; background: #0f172a; color: #dbeafe; padding: 32px;">',
      '<h1>Helpy Graph</h1>',
      `<p>Fallback Markdown graph generated with ${nodes} nodes and ${edges} edges.</p>`,
      '<p>Open <code>graph.json</code> for structured data and <code>GRAPH_REPORT.md</code> for the summary.</p>',
      '</body>',
    ].join('\n');
  }

  private isNoCodeGraphifyRun(error: unknown): boolean {
    const output = this.outputFromError(error).toLowerCase();
    return output.includes('no code files found') || output.includes('nothing to update');
  }

  private async graphifyDoctor(config: Config): Promise<string> {
    const locator = await this.execCommand(`command -v ${config.graphifyCommand} || which ${config.graphifyCommand}`, config.vaultRoot, 10000).catch(() => '');
    const help = await this.execCommand(`${config.graphifyCommand} --help`, config.vaultRoot, 10000).catch((error) => this.outputFromError(error));
    return [`Graphify binary: ${locator || 'not found on PATH'}`, 'Graphify help:', help || '(no help output)'].join('\n');
  }

  private formatCommandError(command: string, error: unknown): string {
    const output = this.outputFromError(error);
    return `$ ${command}\n${output || String(error)}`.slice(0, 4000);
  }

  private outputFromError(error: unknown): string {
    const maybe = error as { stdout?: string; stderr?: string; message?: string };
    return [maybe.stdout, maybe.stderr, maybe.message].filter(Boolean).join('\n').trim();
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
