import fs from 'fs';
import path from 'path';

import { HelpyMemoryGraphStats } from '@common/types';

const vaultRoot = () => process.env.HELPY_VAULT_ROOT || process.env.HELPY_VAULT_PATH || '/home/shingen/ObsidianVault';

export const helpyMemoryGraph = {
  stats(): HelpyMemoryGraphStats {
    const root = vaultRoot();
    const graphPath = path.join(root, 'graphify-out', 'graph.json');
    try {
      if (!fs.existsSync(graphPath)) {
        return {
          ok: false,
          status: 'missing-graph',
          vaultRoot: root,
          graphPath,
          nodes: 0,
          edges: 0,
        };
      }
      const raw = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
      const stat = fs.statSync(graphPath);
      return {
        ok: true,
        status: 'ready',
        vaultRoot: root,
        graphPath,
        nodes: Array.isArray(raw.nodes) ? raw.nodes.length : 0,
        edges: Array.isArray(raw.edges) ? raw.edges.length : Array.isArray(raw.links) ? raw.links.length : 0,
        updatedAt: stat.mtime.toISOString(),
      };
    } catch (error) {
      return {
        ok: false,
        status: 'graph-error',
        vaultRoot: root,
        graphPath,
        nodes: 0,
        edges: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};
