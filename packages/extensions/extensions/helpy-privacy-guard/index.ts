import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type {
  AgentStartedEvent,
  CommandDefinition,
  Extension,
  ExtensionContext,
  PromptStartedEvent,
  ToolApprovalEvent,
} from '@aiderdesk/extensions';

type Config = {
  blockCloudProviders: boolean;
  allowedProviderWords: string[];
  blockedToolWords: string[];
};

const DEFAULT_CONFIG: Config = {
  blockCloudProviders: true,
  allowedProviderWords: ['local', 'llama', 'openai-compatible', 'ollama', 'lm-studio', 'gpustack'],
  blockedToolWords: ['cloudflare', 'tunnel', 'telemetry', 'posthog', 'langfuse'],
};

export default class HelpyPrivacyGuardExtension implements Extension {
  static metadata = {
    name: 'Helpy Privacy Guard',
    version: '0.1.0',
    description: 'Keeps AiderDesk workflows local unless explicitly allowed',
    author: 'Shingenn5',
    capabilities: ['privacy', 'security'],
  };

  private configPath = join(__dirname, 'config.json');

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('Privacy guard loaded. Local-first checks are enabled.', 'info');
  }

  getCommands(): CommandDefinition[] {
    return [
      {
        name: 'helpy-privacy-status',
        description: 'Show Helpy privacy guard settings',
        execute: async (_args, context) => {
          const config = this.loadConfig();
          context.getTaskContext()?.addLogMessage('info', JSON.stringify(config, null, 2));
        },
      },
    ];
  }

  async onPromptStarted(event: PromptStartedEvent, context: ExtensionContext): Promise<void | Partial<PromptStartedEvent>> {
    const config = this.loadConfig();
    const text = event.prompt.toLowerCase();
    if (config.blockedToolWords.some((word) => text.includes(word))) {
      context.getTaskContext()?.addLogMessage('warning', 'Helpy privacy guard noticed cloud/telemetry language in this prompt.');
    }
    return undefined;
  }

  async onAgentStarted(event: AgentStartedEvent, context: ExtensionContext): Promise<void | Partial<AgentStartedEvent>> {
    const config = this.loadConfig();
    if (!config.blockCloudProviders) return undefined;

    const providerText = JSON.stringify({
      profile: event.agentProfile,
      provider: event.agentProfile?.provider,
      model: event.model,
    }).toLowerCase();

    const looksLocal = config.allowedProviderWords.some((word) => providerText.includes(word));
    if (!looksLocal) {
      context.getTaskContext()?.addLogMessage('error', `Blocked non-local looking provider for privacy: ${event.model}`);
      return { blocked: true };
    }
    return undefined;
  }

  async onToolApproval(event: ToolApprovalEvent, context: ExtensionContext): Promise<void | Partial<ToolApprovalEvent>> {
    const config = this.loadConfig();
    const haystack = `${event.toolName} ${JSON.stringify(event.input || {})}`.toLowerCase();
    if (config.blockedToolWords.some((word) => haystack.includes(word))) {
      context.getTaskContext()?.addLogMessage('error', `Blocked privacy-sensitive tool call: ${event.toolName}`);
      return { blocked: true, allowed: false };
    }
    return undefined;
  }

  private loadConfig(): Config {
    try {
      if (existsSync(this.configPath)) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(this.configPath, 'utf-8')) };
      }
      writeFileSync(this.configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
    } catch {
      // locked down is better than surprised
    }
    return { ...DEFAULT_CONFIG };
  }
}
