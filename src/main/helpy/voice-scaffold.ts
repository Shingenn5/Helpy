import fs from 'fs';
import path from 'path';

import { HelpyVoiceConfig, HelpyVoiceResult } from '@common/types';

const configDir = path.join(process.env.HOME || process.cwd(), '.helpy');
const configFile = path.join(configDir, 'voice.json');

const readConfig = (): HelpyVoiceConfig => {
  const fallback: HelpyVoiceConfig = {
    enabled: false,
    sttCommand: process.env.HELPY_STT_COMMAND || '',
    ttsCommand: process.env.HELPY_TTS_COMMAND || '',
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

const writeConfig = (config: HelpyVoiceConfig) => {
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf8');
};

const statusFor = (config: HelpyVoiceConfig): HelpyVoiceResult => ({
  ok: config.enabled && !!config.sttCommand,
  status: config.enabled ? (config.sttCommand ? 'configured' : 'voice-not-configured') : 'disabled',
  configured: !!config.sttCommand,
  sttCommand: config.sttCommand,
  ttsCommand: config.ttsCommand,
});

export const helpyVoice = {
  config(): HelpyVoiceResult {
    return {
      ...statusFor(readConfig()),
      output: `Config file: ${configFile}`,
    };
  },

  configure(config: HelpyVoiceConfig): HelpyVoiceResult {
    const nextConfig = {
      enabled: !!config.enabled,
      sttCommand: config.sttCommand?.trim() || '',
      ttsCommand: config.ttsCommand?.trim() || '',
    };
    writeConfig(nextConfig);
    return {
      ...statusFor(nextConfig),
      output: `Saved voice config to ${configFile}`,
    };
  },

  status(): HelpyVoiceResult {
    return statusFor(readConfig());
  },

  pushToTalk(): HelpyVoiceResult {
    const config = readConfig();
    if (!config.enabled || !config.sttCommand) {
      return {
        ...statusFor(config),
        ok: false,
        status: 'voice-not-configured',
        error: 'Voice not configured. Add a local STT command in Helpy voice settings.',
      };
    }

    return {
      ...statusFor(config),
      ok: false,
      status: 'stt-command-configured',
      error: 'Push-to-talk capture is scaffolded. Wire the local STT command to audio capture in the next voice pass.',
    };
  },
};
