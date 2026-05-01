import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { HelpyBackendResult } from '@common/types';

const execFileAsync = promisify(execFile);

const ENDPOINT = process.env.HELPY_BACKEND_ENDPOINT || 'http://127.0.0.1:8080/v1';

const findRepoRoot = () => {
  let dir = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    if (fs.existsSync(path.join(dir, 'docker-compose.yml'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
};

const repoRoot = findRepoRoot();
const composeFile = process.env.HELPY_COMPOSE_FILE || path.join(repoRoot, 'docker-compose.yml');
const envFile = process.env.HELPY_ENV_FILE || path.join(repoRoot, '.env');

const runDockerCompose = async (args: string[]): Promise<HelpyBackendResult> => {
  const fullArgs = ['compose', '-f', composeFile, ...args];
  const command = `docker ${fullArgs.map((arg) => (arg.includes(' ') ? `"${arg}"` : arg)).join(' ')}`;

  try {
    const { stdout, stderr } = await execFileAsync('docker', fullArgs, {
      cwd: repoRoot,
      env: { ...process.env },
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 8,
    });

    return {
      ok: true,
      command,
      output: [stdout, stderr].filter(Boolean).join('\n'),
      composeFile,
      envFile,
      endpoint: ENDPOINT,
    };
  } catch (error) {
    const err = error as Error & { stdout?: string; stderr?: string };
    return {
      ok: false,
      command,
      output: [err.stdout, err.stderr].filter(Boolean).join('\n'),
      error: err.message,
      composeFile,
      envFile,
      endpoint: ENDPOINT,
    };
  }
};

export const helpyLocalBackend = {
  config(): HelpyBackendResult {
    return {
      ok: fs.existsSync(composeFile),
      composeFile,
      envFile,
      endpoint: ENDPOINT,
      status: fs.existsSync(composeFile) ? 'compose-ready' : 'missing-compose-file',
    };
  },

  start() {
    return runDockerCompose(['up', '-d']);
  },

  stop() {
    return runDockerCompose(['down']);
  },

  status() {
    return runDockerCompose(['ps']);
  },

  logs() {
    return runDockerCompose(['logs', '--tail', '160']);
  },

  async health(): Promise<HelpyBackendResult> {
    try {
      const response = await fetch(`${ENDPOINT}/models`);
      const text = await response.text();
      return {
        ok: response.ok,
        endpoint: ENDPOINT,
        composeFile,
        envFile,
        status: response.ok ? 'online' : `HTTP ${response.status}`,
        output: text.slice(0, 3000),
      };
    } catch (error) {
      return {
        ok: false,
        endpoint: ENDPOINT,
        composeFile,
        envFile,
        status: 'offline',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};
