import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

import { HelpyBackendResult, HelpyLocalConfig } from '@common/types';

const execFileAsync = promisify(execFile);

const DEFAULT_ENDPOINT = 'http://127.0.0.1:8080/v1';

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
  if (!fs.existsSync(envFile)) {
    return {};
  }
  return fs
    .readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .reduce<Record<string, string>>((values, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
        return values;
      }
      const [key, ...rest] = trimmed.split('=');
      values[key.trim()] = rest
        .join('=')
        .trim()
        .replace(/^["']|["']$/g, '');
      return values;
    }, {});
};

const getLocalEnv = () => readEnvFile();
const getEnv = (key: string, fallback: string) => process.env[key] || getLocalEnv()[key] || fallback;
const getEndpoint = () => getEnv('HELPY_BACKEND_ENDPOINT', DEFAULT_ENDPOINT);

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
  endpoint: getEndpoint(),
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

const envLine = (key: string, value: string) => `${key}=${JSON.stringify(value)}`;

const writeEnvConfig = (config: HelpyLocalConfig) => {
  const modelDir = path.dirname(config.modelPath);
  const modelFile = path.basename(config.modelPath);
  const content = [
    '# Helpy local runtime config',
    '# edited by the setup wizard',
    envLine('LLAMA_MODEL_DIR', modelDir),
    envLine('LLAMA_MODEL_FILE', modelFile),
    envLine('HELPY_BACKEND_ENDPOINT', config.endpoint || DEFAULT_ENDPOINT),
    envLine('HELPY_VAULT_PATH', config.vaultPath),
    envLine('HELPY_PROJECTS_ROOT', config.projectsRoot),
    '',
  ].join('\n');

  fs.writeFileSync(envFile, content, 'utf8');
};

export const helpyLocalBackend = {
  async configure(config: HelpyLocalConfig): Promise<HelpyBackendResult> {
    try {
      if (!config.modelPath || !fs.existsSync(config.modelPath)) {
        return {
          ok: false,
          status: 'missing-model',
          error: `Could not find model file at ${config.modelPath || '(not set)'}`,
          ...baseResult(),
          modelPath: config.modelPath,
        };
      }

      // lazy mkdirs for the local-first stuff
      if (config.vaultPath) {
        fs.mkdirSync(config.vaultPath, { recursive: true });
      }
      if (config.projectsRoot) {
        fs.mkdirSync(config.projectsRoot, { recursive: true });
      }

      writeEnvConfig(config);

      return {
        ok: true,
        status: 'configured',
        output: `Saved Helpy runtime config to ${envFile}`,
        ...baseResult(),
      };
    } catch (error) {
      return {
        ok: false,
        status: 'configure-error',
        error: error instanceof Error ? error.message : String(error),
        ...baseResult(),
      };
    }
  },

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
      const response = await fetch(`${getEndpoint()}/models`, { signal: controller.signal });
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
