/* eslint-disable func-style,@typescript-eslint/no-explicit-any */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { z } from 'zod/v3';

// Get project directory from command line arguments or use default
const projectDir = process.argv[2] || '.';

// Helpy API configuration
const HELPY_API_BASE_URL = process.env.HELPY_API_BASE_URL || process.env.AIDER_DESK_API_BASE_URL || 'http://localhost:24337/api';
const HELPY_VAULT_ROOT = process.env.HELPY_VAULT_ROOT || process.env.HELPY_VAULT_PATH || '/home/shingen/ObsidianVault';

// eslint-disable-next-line no-console
console.error(`Using Helpy API at: ${HELPY_API_BASE_URL} for project directory: ${projectDir}`);

// Create MCP server
export const server = new McpServer({
  name: 'helpy-mcp-server',
  version: '0.1.0',
});

// Define tool schemas
const AddContextFileSchema = {
  path: z
    .string()
    .describe(`File path to add to context. Relative to project directory (${projectDir}) when not read-only. Absolute path should be used when read-only.`),
  readOnly: z.boolean().default(false).describe('Whether the file is read-only'),
};

const DropContextFileSchema = {
  path: z.string().describe('File path to remove from context'),
};

const GetContextFilesSchema = {};

const GetAddableFilesSchema = {
  searchRegex: z.string().optional().describe('Optional regex to filter addable files'),
};

const RunPromptSchema = {
  prompt: z.string().describe('The prompt to run'),
  mode: z
    .enum(['code', 'ask', 'architect', 'context'])
    .default('code')
    .describe(
      'Type of the action that Helpy will perform. Code is for coding tasks, ask is for asking questions, architect is for planning changes, context automatically identifies which files need to added to context based on the prompt.',
    ),
};

const ClearContextSchema = {};

const SearchMemorySchema = {
  query: z.string().describe('Search terms for local Helpy memory graph'),
  limit: z.number().default(8).describe('Maximum matching nodes and relationships to return'),
};

const normalizePath = (filePath: string) => path.resolve(projectDir, filePath);

const isInsideProject = (filePath: string) => {
  const resolvedProject = path.resolve(projectDir);
  const resolvedFile = path.resolve(filePath);
  const relative = path.relative(resolvedProject, resolvedFile);
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
};

const safeText = (value: unknown, max = 220) => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
};

const loadMemoryGraph = () => {
  const graphPath = path.join(HELPY_VAULT_ROOT, 'graphify-out', 'graph.json');
  if (!fs.existsSync(graphPath)) {
    return { graphPath, nodes: [], edges: [] };
  }
  const raw = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
  return {
    graphPath,
    nodes: Array.isArray(raw.nodes) ? raw.nodes : [],
    edges: Array.isArray(raw.edges) ? raw.edges : Array.isArray(raw.links) ? raw.links : [],
  };
};

const nodeLabel = (node: any) => safeText(node.label || node.name || node.id || node.title || node.path || node.type || 'node');
const edgeSource = (edge: any) => safeText(edge.source || edge.from || edge.start || edge.source_id || '');
const edgeTarget = (edge: any) => safeText(edge.target || edge.to || edge.end || edge.target_id || '');
const edgeType = (edge: any) => safeText(edge.type || edge.relationship || edge.label || 'relates_to', 80);

const searchGraph = (query: string, limit: number) => {
  const { graphPath, nodes, edges } = loadMemoryGraph();
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

  const score = (text: string) => terms.reduce((sum, term) => sum + (text.toLowerCase().includes(term) ? 1 : 0), 0);
  const matchedNodes = nodes
    .map((node: any) => {
      const text = safeText(JSON.stringify(node), 1200);
      return { node, score: score(text) };
    })
    .filter((item: { node: any; score: number }) => item.score > 0)
    .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
    .slice(0, limit);

  const matchedIds = new Set(matchedNodes.map((item: { node: any }) => String(item.node.id || item.node.label || item.node.name)));
  const matchedEdges = edges
    .map((edge: any) => {
      const text = `${edgeSource(edge)} ${edgeType(edge)} ${edgeTarget(edge)} ${safeText(JSON.stringify(edge), 600)}`;
      const linked = matchedIds.has(String(edge.source)) || matchedIds.has(String(edge.target));
      return { edge, score: score(text) + (linked ? 1 : 0) };
    })
    .filter((item: { edge: any; score: number }) => item.score > 0)
    .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
    .slice(0, limit);

  return { graphPath, nodes, edges, matchedNodes, matchedEdges };
};

// Add tools to the server
server.tool('add_context_file', 'Add a file to the context of Helpy.', AddContextFileSchema, async (params) => {
  try {
    const resolvedPath = params.readOnly && path.isAbsolute(params.path) ? path.resolve(params.path) : normalizePath(params.path);
    if (!params.readOnly && !isInsideProject(resolvedPath)) {
      return { content: [{ type: 'text', text: `Refused to add file outside project unless readOnly is true: ${params.path}` }] };
    }
    const requestParams = { ...params, projectDir };
    const response = await axios.post(`${HELPY_API_BASE_URL}/add-context-file`, requestParams);
    return { content: [{ type: 'text', text: JSON.stringify(response.data) }] };
  } catch (error: any) {
    return { content: [{ type: 'text', text: error.response?.data || error.message }] };
  }
});

server.tool('drop_context_file', 'Remove a file from the context of Helpy.', DropContextFileSchema, async (params) => {
  try {
    const requestParams = { ...params, projectDir };
    const response = await axios.post(`${HELPY_API_BASE_URL}/drop-context-file`, requestParams);
    return { content: [{ type: 'text', text: JSON.stringify(response.data) }] };
  } catch (error: any) {
    return { content: [{ type: 'text', text: error.response?.data || error.message }] };
  }
});

server.tool('get_context_files', 'Get all files currently in the context for Helpy to use.', GetContextFilesSchema, async (params) => {
  try {
    const requestParams = { ...params, projectDir };
    const response = await axios.post(`${HELPY_API_BASE_URL}/get-context-files`, requestParams);
    return { content: [{ type: 'text', text: JSON.stringify(response.data) }] };
  } catch (error: any) {
    return { content: [{ type: 'text', text: error.response?.data || error.message }] };
  }
});

server.tool('get_addable_files', 'Get files that can be added to the context for Helpy.', GetAddableFilesSchema, async (params) => {
  try {
    const requestParams = { ...params, projectDir };
    const response = await axios.post(`${HELPY_API_BASE_URL}/get-addable-files`, requestParams);
    return { content: [{ type: 'text', text: JSON.stringify(response.data) }] };
  } catch (error: any) {
    return { content: [{ type: 'text', text: error.response?.data || error.message }] };
  }
});

server.tool(
  'run_prompt',
  'Run a prompt in Helpy. This is the main tool for interacting with Helpy. Use this tool when you need to perform a coding task on the files in the context. Before using this tool, make sure you have added all the necessary files to the context.',
  RunPromptSchema,
  async (params) => {
    try {
      const requestParams = { ...params, projectDir };
      const response = await axios.post(`${HELPY_API_BASE_URL}/run-prompt`, requestParams);
      return { content: [{ type: 'text', text: JSON.stringify(response.data) }] };
    } catch (error: any) {
      return { content: [{ type: 'text', text: error.response?.data || error.message }] };
    }
  },
);

server.tool(
  'clear_context',
  'Clear the context messages of Helpy. Useful when you want to start a new task with clear context.',
  ClearContextSchema,
  async (params) => {
    try {
      const requestParams = { ...params, projectDir };
      const response = await axios.post(`${HELPY_API_BASE_URL}/project/clear-context`, requestParams);
      return { content: [{ type: 'text', text: JSON.stringify(response.data) }] };
    } catch (error: any) {
      return { content: [{ type: 'text', text: error.response?.data || error.message }] };
    }
  },
);

server.tool('search_memory', 'Search Helpy Markdown/Graphify memory in the local Obsidian vault.', SearchMemorySchema, async (params) => {
  try {
    const result = searchGraph(params.query, Math.max(1, Math.min(params.limit || 8, 20)));
    const lines = [
      `Graph: ${result.nodes.length} nodes, ${result.edges.length} edges`,
      `Path: ${result.graphPath}`,
      '',
      'Nodes:',
      ...result.matchedNodes.map(({ node, score }: { node: any; score: number }) => `- [${safeText(node.type || 'node', 40)}] ${nodeLabel(node)} (${score})`),
      '',
      'Relationships:',
      ...result.matchedEdges.map(({ edge, score }: { edge: any; score: number }) => `- ${edgeSource(edge)} --${edgeType(edge)}--> ${edgeTarget(edge)} (${score})`),
    ];
    return { content: [{ type: 'text', text: lines.join('\n').slice(0, 6000) }] };
  } catch (error: any) {
    return { content: [{ type: 'text', text: error.message || String(error) }] };
  }
});

// Start the server
export async function main() {
  // eslint-disable-next-line no-console
  console.log('Starting Helpy MCP server...');
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // eslint-disable-next-line no-console
    console.error('Helpy MCP server started on stdio');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error during startup:', error);
    process.exit(1);
  }
}

if (process.env.HELPY_MCP_TESTING !== 'true' && process.env.AIDER_DESK_MCP_TESTING !== 'true') {
  main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Fatal error in main():', error);
    process.exit(1);
  });
}
