import fs from 'fs';
import path from 'path';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';

import { HelpyOpenClawConfig, HelpyProcessResult } from '@common/types';

const configDir = path.join(process.env.HOME || process.cwd(), '.helpy');
const configFile = path.join(configDir, 'openclaw.json');
const maxLogLines = 500;

let child: ChildProcessWithoutNullStreams | null = null;
let logLines: string[] = [];

const readConfig = (): HelpyOpenClawConfig => {
  const fallback: HelpyOpenClawConfig = {
    executablePath: process.env.OPENCLAW_COMMAND || '',
    workingDirectory: process.env.OPENCLAW_WORKDIR || process.cwd(),
    env: {},
  };

  if (!fs.existsSync(configFile)) {
    return fallback;
  }

  try {
    return { ...fallback, ...JSON.parse(fs.readFileSync(configFile, 'utf8')) };
  } catch {
    return fallback;
  }
};

const writeConfig = (config: HelpyOpenClawConfig) => {
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf8');
};

const pushLog = (line: string) => {
  const stamp = new Date().toLocaleTimeString();
  logLines.push(`[${stamp}] ${line}`);
  if (logLines.length > maxLogLines) {
    logLines = logLines.slice(-maxLogLines);
  }
};

const base = (): HelpyProcessResult => {
  const config = readConfig();
  return {
    ok: !!child && !child.killed,
    status: child && !child.killed ? 'running' : config.executablePath ? 'stopped' : 'not-configured',
    pid: child?.pid,
    executablePath: config.executablePath,
    workingDirectory: config.workingDirectory,
    configured: !!config.executablePath,
    env: config.env,
  };
};

export const helpyOpenClaw = {
  config(): HelpyProcessResult {
    return {
      ...base(),
      output: `Config file: ${configFile}`,
    };
  },

  configure(config: HelpyOpenClawConfig): HelpyProcessResult {
    const nextConfig = {
      executablePath: config.executablePath?.trim() || '',
      workingDirectory: config.workingDirectory?.trim() || process.cwd(),
      env: config.env || {},
    };

    writeConfig(nextConfig);
    return {
      ...base(),
      status: nextConfig.executablePath ? 'configured' : 'not-configured',
      ok: !!nextConfig.executablePath,
      output: `Saved OpenClaw config to ${configFile}`,
    };
  },

  start(): HelpyProcessResult {
    const config = readConfig();
    if (child && !child.killed) {
      return { ...base(), ok: true, status: 'already-running' };
    }
    if (!config.executablePath) {
      return { ...base(), ok: false, status: 'not-configured', error: 'Set the OpenClaw executable path first.' };
    }
    if (!fs.existsSync(config.workingDirectory)) {
      return { ...base(), ok: false, status: 'missing-workdir', error: `Working directory does not exist: ${config.workingDirectory}` };
    }

    const [command, ...args] = config.executablePath.split(/\s+/).filter(Boolean);
    pushLog(`starting ${config.executablePath}`);
    child = spawn(command, args, {
      cwd: config.workingDirectory,
      env: { ...process.env, ...config.env },
      shell: false,
      windowsHide: true,
    });

    child.stdout.on('data', (data) => pushLog(String(data).trimEnd()));
    child.stderr.on('data', (data) => pushLog(String(data).trimEnd()));
    child.on('exit', (code, signal) => {
      pushLog(`OpenClaw exited code=${code ?? 'none'} signal=${signal ?? 'none'}`);
      child = null;
    });
    child.on('error', (error) => {
      pushLog(`OpenClaw error: ${error.message}`);
      child = null;
    });

    return { ...base(), ok: true, status: 'started', command: config.executablePath };
  },

  stop(): HelpyProcessResult {
    if (!child || child.killed) {
      return { ...base(), ok: true, status: 'already-stopped' };
    }
    child.kill('SIGTERM');
    pushLog('sent SIGTERM');
    return { ...base(), ok: true, status: 'stopping' };
  },

  status(): HelpyProcessResult {
    return base();
  },

  logs(): HelpyProcessResult {
    return {
      ...base(),
      output: logLines.join('\n') || 'No OpenClaw logs yet.',
    };
  },
};
