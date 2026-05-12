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
  metadata?: Record<string, string | number | boolean>;
};

type MiniGraphEdge = {
  source: string;
  target: string;
  relation: string;
};

type MiniGraph = {
  nodes: MiniGraphNode[];
  edges: MiniGraphEdge[];
};

const DEFAULT_CONFIG: Config = {
  vaultRoot: process.env.HELPY_VAULT_ROOT || join(homedir(), 'ObsidianVault'),
  graphDir: 'Graph',
  graphifyCommand: process.env.HELPY_GRAPHIFY_COMMAND || 'graphify',
  graphifyOutDir: 'graphify-out',
  autoUpdateOnPrompt: process.env.HELPY_GRAPHIFY_AUTO_UPDATE !== 'false',
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
        name: 'helpy-memory-query',
        description: 'Search the local Helpy semantic memory graph',
        arguments: [{ description: 'Search terms', required: true }],
        execute: async (args, context) => {
          const question = args.join(' ').trim();
          if (!question) {
            context.getTaskContext()?.addLogMessage('warning', 'Usage: /helpy-memory-query backend errors');
            return;
          }
          const output = this.queryMemory(question);
          context.getTaskContext()?.addLogMessage('info', output);
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
        return { ...DEFAULT_CONFIG, ...this.sharedVaultConfig(), ...JSON.parse(readFileSync(this.configPath, 'utf-8')) };
      }
    } catch {
      // defaults are fine
    }
    return { ...DEFAULT_CONFIG, ...this.sharedVaultConfig() };
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
      const frontmatter = this.extractFrontmatter(body);
      const type = frontmatter.type || this.semanticFileType(rel);
      nodes.set(rel, {
        id: rel,
        label: title,
        type,
        path: rel,
        metadata: {
          folder: rel.split('/')[0] || 'root',
          project: frontmatter.project || '',
          created: frontmatter.created || '',
        },
      });
      edges.push({ source: 'helpy-vault', target: rel, relation: 'contains' });

      this.addTags(rel, frontmatter.tags || '', nodes, edges);
      this.addSemanticMarkdownNodes(rel, rel, body, frontmatter, nodes, edges);

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
      note: 'Semantic graph created from Helpy Markdown because this Graphify CLI only updates code files.',
      nodes: [...nodes.values()],
      edges,
    };

    writeFileSync(join(outDir, 'graph.json'), JSON.stringify(graph, null, 2), 'utf-8');
    writeFileSync(join(outDir, 'GRAPH_REPORT.md'), this.markdownGraphReport(config, files, [...nodes.values()], edges), 'utf-8');
    writeFileSync(join(outDir, 'graph.html'), this.markdownGraphHtml(nodes.size, edges.length), 'utf-8');

    return `Helpy semantic Markdown graph wrote ${nodes.size} nodes and ${edges.length} edges to ${outDir}.`;
  }

  private queryMemory(question: string): string {
    const config = this.loadConfig();
    const graphPath = join(config.vaultRoot, config.graphifyOutDir, 'graph.json');

    if (!existsSync(graphPath)) {
      this.writeMarkdownGraph(config);
    }

    if (!existsSync(graphPath)) {
      return `No Helpy memory graph found at ${graphPath}. Run /helpy-graphify-update first.`;
    }

    const graph = JSON.parse(readFileSync(graphPath, 'utf-8')) as MiniGraph;
    const terms = question.toLowerCase().split(/\s+/).filter(Boolean);
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    const scoredNodes = graph.nodes
      .map((node) => ({ node, score: this.scoreNode(node, terms) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
    const matchedIds = new Set(scoredNodes.map((item) => item.node.id));

    const edgeHits = graph.edges
      .filter((edge) => {
        const source = nodeById.get(edge.source);
        const target = nodeById.get(edge.target);
        const haystack = `${edge.relation} ${source?.label || ''} ${target?.label || ''}`.toLowerCase();
        return matchedIds.has(edge.source) || matchedIds.has(edge.target) || terms.some((term) => haystack.includes(term));
      })
      .slice(0, 16);

    if (!scoredNodes.length && !edgeHits.length) {
      return [
        `No direct Helpy memory hits for: ${question}`,
        '',
        `Graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`,
        `Path: ${graphPath}`,
      ].join('\n');
    }

    const lines = [
      `# Helpy Memory Query`,
      '',
      `Query: ${question}`,
      `Graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`,
      '',
    ];

    if (scoredNodes.length) {
      lines.push('## Nodes', '');
      for (const { node, score } of scoredNodes) {
        lines.push(`- [${node.type}] ${node.label} (${score})`);
        if (node.path) lines.push(`  path: ${node.path}`);
      }
      lines.push('');
    }

    if (edgeHits.length) {
      lines.push('## Relationships', '');
      for (const edge of edgeHits) {
        const source = nodeById.get(edge.source)?.label || edge.source;
        const target = nodeById.get(edge.target)?.label || edge.target;
        lines.push(`- ${source} --${edge.relation}--> ${target}`);
      }
      lines.push('');
    }

    return lines.join('\n').slice(0, 6000);
  }

  private scoreNode(node: MiniGraphNode, terms: string[]): number {
    const metadata = node.metadata ? Object.values(node.metadata).join(' ') : '';
    const haystack = `${node.id} ${node.label} ${node.type} ${node.path || ''} ${metadata}`.toLowerCase();
    return terms.reduce((score, term) => {
      if (node.label.toLowerCase().includes(term)) return score + 8;
      if (node.type.toLowerCase().includes(term)) return score + 5;
      if (haystack.includes(term)) return score + 2;
      return score;
    }, 0);
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

  private semanticFileType(rel: string): string {
    const first = rel.split('/')[0]?.toLowerCase() || 'note';
    if (first === 'sessions') return 'session';
    if (first === 'rules') return 'rules-file';
    if (first === 'graph') return 'graph-note';
    return first;
  }

  private extractFrontmatter(body: string): Record<string, string> {
    const block = body.match(/^---\n([\s\S]*?)\n---/);
    if (!block) return {};
    const data: Record<string, string> = {};
    const lines = block[1].split('\n');
    let current = '';

    for (const line of lines) {
      const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (pair) {
        current = pair[1];
        data[current] = pair[2].replace(/^["']|["']$/g, '').trim();
        continue;
      }
      const item = line.match(/^\s+-\s+(.+)$/);
      if (item && current) {
        data[current] = [data[current], item[1].trim()].filter(Boolean).join(',');
      }
    }

    return data;
  }

  private addSemanticMarkdownNodes(
    fileId: string,
    rel: string,
    body: string,
    frontmatter: Record<string, string>,
    nodes: Map<string, MiniGraphNode>,
    edges: MiniGraphEdge[],
  ): void {
    if (frontmatter.project) {
      const projectId = `project:${frontmatter.project}`;
      this.upsertNode(nodes, projectId, frontmatter.project, 'project');
      edges.push({ source: fileId, target: projectId, relation: 'about_project' });
    }

    const taskId = frontmatter.task_id || this.firstMatch(body, /Task:\s+\[\[([^\]]+)\]\]/);
    if (taskId) {
      const nodeId = `task:${taskId}`;
      this.upsertNode(nodes, nodeId, taskId, 'task');
      edges.push({ source: fileId, target: nodeId, relation: 'records_task' });
    }

    const projectPath = this.firstMatch(body, /project:\s*"([^"]+)"/i) || this.firstMatch(body, /Path:\s+`([^`]+)`/);
    if (projectPath) {
      const nodeId = `path:${projectPath}`;
      this.upsertNode(nodes, nodeId, projectPath, 'filesystem-path');
      edges.push({ source: fileId, target: nodeId, relation: 'uses_path' });
    }

    if (rel.startsWith('Sessions/')) this.addSessionNodes(fileId, body, nodes, edges);
    if (rel.startsWith('Rules/')) this.addRuleNodes(fileId, body, nodes, edges);
    if (rel.startsWith('Graph/Projects/')) this.addProjectNoteNodes(fileId, body, nodes, edges);
  }

  private addSessionNodes(fileId: string, body: string, nodes: Map<string, MiniGraphNode>, edges: MiniGraphEdge[]): void {
    const sections = this.extractSections(body);
    let count = 0;

    for (const section of sections) {
      count += 1;
      const kind = this.sectionKind(section.heading);
      const label = this.preview(section.content, section.heading);
      const nodeId = `${fileId}#${kind}-${count}`;
      this.upsertNode(nodes, nodeId, label, kind, { heading: section.heading });
      edges.push({ source: fileId, target: nodeId, relation: 'has_event' });

      if (kind === 'user-prompt') edges.push({ source: nodeId, target: fileId, relation: 'prompted_session' });
      if (kind === 'assistant-response') edges.push({ source: fileId, target: nodeId, relation: 'received_response' });

      const mode = this.firstMatch(section.content, /^Mode:\s*(.+)$/m);
      const model = this.firstMatch(section.content, /^Model:\s*(.+)$/m);
      const provider = this.firstMatch(section.content, /^Provider:\s*(.+)$/m);

      if (mode) {
        const modeId = `mode:${mode}`;
        this.upsertNode(nodes, modeId, mode, 'mode');
        edges.push({ source: nodeId, target: modeId, relation: 'ran_in_mode' });
      }
      if (model) {
        const modelId = `model:${model}`;
        this.upsertNode(nodes, modelId, model, 'model');
        edges.push({ source: nodeId, target: modelId, relation: 'used_model' });
      }
      if (provider) {
        const providerId = `provider:${provider}`;
        this.upsertNode(nodes, providerId, provider, 'provider');
        edges.push({ source: nodeId, target: providerId, relation: 'used_provider' });
      }
    }
  }

  private addRuleNodes(fileId: string, body: string, nodes: Map<string, MiniGraphNode>, edges: MiniGraphEdge[]): void {
    const sections = this.extractSections(body);
    let ruleCount = 0;
    for (const section of sections) {
      const sectionId = `${fileId}#rules-${this.slug(section.heading)}`;
      this.upsertNode(nodes, sectionId, section.heading, 'rule-section');
      edges.push({ source: fileId, target: sectionId, relation: 'has_rule_section' });

      for (const rule of section.content.matchAll(/^\s*-\s+(.+)$/gm)) {
        ruleCount += 1;
        const ruleId = `${fileId}#rule-${ruleCount}`;
        this.upsertNode(nodes, ruleId, rule[1].trim(), 'rule');
        edges.push({ source: sectionId, target: ruleId, relation: 'contains_rule' });
      }
    }
  }

  private addProjectNoteNodes(fileId: string, body: string, nodes: Map<string, MiniGraphNode>, edges: MiniGraphEdge[]): void {
    const mode = this.firstMatch(body, /- Mode:\s*(.+)/);
    const status = this.firstMatch(body, /- Status:\s*(.+)/);

    if (mode) {
      const nodeId = `mode:${mode}`;
      this.upsertNode(nodes, nodeId, mode, 'mode');
      edges.push({ source: fileId, target: nodeId, relation: 'current_mode' });
    }
    if (status) {
      const nodeId = `status:${status}`;
      this.upsertNode(nodes, nodeId, status, 'status');
      edges.push({ source: fileId, target: nodeId, relation: 'current_status' });
    }
  }

  private addTags(fileId: string, tags: string, nodes: Map<string, MiniGraphNode>, edges: MiniGraphEdge[]): void {
    for (const tag of tags.split(',').map((tag) => tag.trim()).filter(Boolean)) {
      const nodeId = `tag:${tag}`;
      this.upsertNode(nodes, nodeId, tag, 'tag');
      edges.push({ source: fileId, target: nodeId, relation: 'tagged' });
    }
  }

  private extractSections(body: string): Array<{ heading: string; content: string }> {
    const sections: Array<{ heading: string; content: string }> = [];
    const matcher = /^##\s+(.+)$/gm;
    const matches = [...body.matchAll(matcher)];
    for (let i = 0; i < matches.length; i += 1) {
      const start = (matches[i].index || 0) + matches[i][0].length;
      const end = i + 1 < matches.length ? matches[i + 1].index || body.length : body.length;
      sections.push({ heading: matches[i][1].trim(), content: body.slice(start, end).trim() });
    }
    return sections;
  }

  private sectionKind(heading: string): string {
    const clean = heading.toLowerCase();
    if (clean.includes('user')) return 'user-prompt';
    if (clean.includes('assistant')) return 'assistant-response';
    if (clean.includes('agent started')) return 'agent-started';
    if (clean.includes('agent finished')) return 'agent-finished';
    if (clean.includes('tool')) return 'tool-event';
    if (clean.includes('context files')) return 'context-files';
    return 'session-event';
  }

  private upsertNode(
    nodes: Map<string, MiniGraphNode>,
    id: string,
    label: string,
    type: string,
    metadata?: Record<string, string | number | boolean>,
  ): void {
    if (!nodes.has(id)) nodes.set(id, { id, label, type, metadata });
  }

  private firstMatch(body: string, pattern: RegExp): string {
    return body.match(pattern)?.[1]?.trim() || '';
  }

  private preview(value: string, fallback: string): string {
    const clean = value.replace(/```[\s\S]*?```/g, '').replace(/\s+/g, ' ').trim();
    return (clean || fallback).slice(0, 140);
  }

  private slug(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
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

  private markdownGraphReport(config: Config, files: string[], nodes: MiniGraphNode[], edges: MiniGraphEdge[]): string {
    const nodeTypes = this.countBy(nodes, (node) => node.type);
    const edgeTypes = this.countBy(edges, (edge) => edge.relation);

    return [
      '# Helpy Graph Report',
      '',
      `Generated: ${new Date().toISOString()}`,
      `Vault: \`${config.vaultRoot}\``,
      '',
      'This semantic graph was generated by Helpy from Markdown because the installed Graphify CLI only supports code-file updates.',
      '',
      '## Summary',
      '',
      `- Markdown files scanned: ${files.length}`,
      `- Nodes: ${nodes.length}`,
      `- Edges: ${edges.length}`,
      '',
      '## Node Types',
      '',
      ...Object.entries(nodeTypes).sort().map(([type, count]) => `- ${type}: ${count}`),
      '',
      '## Edge Types',
      '',
      ...Object.entries(edgeTypes).sort().map(([type, count]) => `- ${type}: ${count}`),
      '',
    ].join('\n');
  }

  private countBy<T>(items: T[], picker: (item: T) => string): Record<string, number> {
    return items.reduce<Record<string, number>>((counts, item) => {
      const key = picker(item) || 'unknown';
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
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

  private sharedVaultConfig(): Partial<Config> {
    try {
      const siblingConfig = join(__dirname, '..', 'helpy-vault-logger', 'config.json');
      if (existsSync(siblingConfig)) {
        const config = JSON.parse(readFileSync(siblingConfig, 'utf-8')) as Partial<Config>;
        return config.vaultRoot ? { vaultRoot: config.vaultRoot } : {};
      }
    } catch {
      // not worth drama
    }
    return {};
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
