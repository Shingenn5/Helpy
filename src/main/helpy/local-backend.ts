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

const readEnvFile = () => {
  if (!fs.existsSync(envFile)) return {};
  return fs
    .readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .reduce<Record<string, string>>((values, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return values;
      const [key, ...rest] = trimmed.split('=');
      values[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
      return values;
    }, {});
};

const localEnv = readEnvFile();
const getEnv = (key: string, fallback: string) => process.env[key] || localEnv[key] || fallback;

const baseResult = () => ({
  ...(() => {
    const resolvedModelDir = getEnv('LLAMA_MODEL_DIR', '/home/shingen/AI_Core/models');
    const resolvedModelFile = getEnv('LLAMA_MODEL_FILE', 'Qwen3.6-35B-A3B-UD-IQ2_M.gguf');
    return {
      modelDir: resolvedModelDir,
      modelFile: resolvedModelFile,
      modelPath: path.join(resolvedModelDir, resolvedModelFile),
    };
  })(),
  composeFile,
  envFile,
  endpoint: ENDPOINT,
  composeExists: fs.existsSync(composeFile),
  envExists: fs.existsSync(envFile),
});

const runDockerCompose = async (args: string[]): Promise<HelpyBackendResult> => {
  if (!fs.existsSync(composeFile)) {
    return {
      ok: false,
      status: 'missing-compose-file',
      error: `Could not find docker-compose.yml at ${composeFile}`,
      ...baseResult(),
    };
  }

  const composePrefix = fs.existsSync(envFile) ? ['compose', '--env-file', envFile, '-f', composeFile] : ['compose', '-f', composeFile];
  const fullArgs = [...composePrefix, ...args];
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
      status: 'ok',
      ...baseResult(),
    };
  } catch (error) {
    const err = error as Error & { stdout?: string; stderr?: string };
    return {
      ok: false,
      command,
      output: [err.stdout, err.stderr].filter(Boolean).join('\n'),
      error: err.message,
      status: 'docker-error',
      ...baseResult(),
    };
  }
};

export const helpyLocalBackend = {
  config(): HelpyBackendResult {
    return {
      ok: fs.existsSync(composeFile),
      status: fs.existsSync(composeFile) ? 'compose-ready' : 'missing-compose-file',
      ...baseResult(),
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);

    try {
      const response = await fetch(`${ENDPOINT}/models`, { signal: controller.signal });
      const text = await response.text();
      const isLoading = response.status === 503 || /loading|model/i.test(text);
      return {
        ok: response.ok,
        status: response.ok ? 'online' : isLoading ? 'loading-model' : `HTTP ${response.status}`,
        output: text.slice(0, 3000),
        ...baseResult(),
      };
    } catch (error) {
      return {
        ok: false,
        status: error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'offline',
        error: error instanceof Error ? error.message : String(error),
        ...baseResult(),
      };
    } finally {
      clearTimeout(timer);
    }
  },
};
