import { Model, ProviderProfile, SettingsData, UsageReportData } from '@common/types';

import type { LanguageModelV2 } from '@ai-sdk/provider';

import logger from '@/logger';
import { AiderModelMapping, LlmProviderStrategy } from '@/models';
import { LoadModelsResponse } from '@/models/types';
import { getDefaultModelInfo } from '@/models/providers/default';
import { Task } from '@/task';

export const loadAuggieModels = async (profile: ProviderProfile, _settings: SettingsData): Promise<LoadModelsResponse> => {
  logger.warn(`Auggie provider is disabled in Helpy local-first builds for profile ${profile.id}`);
  return { models: [], success: false };
};

export const hasAuggieEnvVars = (settings: SettingsData): boolean => {
  void settings;
  return false;
};

export const getAuggieAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  void provider;
  return {
    modelName: `auggie/${modelId}`,
    environmentVariables: {},
  };
};

export const createAuggieLlm = async (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): Promise<LanguageModelV2> => {
  void profile;
  void model;
  void settings;
  void projectDir;
  // parked until we can ship it without the mastra audit baggage
  throw new Error('Auggie provider is disabled in Helpy local-first builds.');
};

const getAuggieUsageReport = (_task: Task, _provider: ProviderProfile, model: Model): UsageReportData => {
  return {
    model: model.id,
    sentTokens: 0,
    receivedTokens: 0,
    messageCost: 0,
    agentTotalCost: 0,
  };
};

export const auggieProviderStrategy: LlmProviderStrategy = {
  createLlm: createAuggieLlm,
  getUsageReport: getAuggieUsageReport,
  loadModels: loadAuggieModels,
  hasEnvVars: hasAuggieEnvVars,
  getAiderMapping: getAuggieAiderMapping,
  getModelInfo: getDefaultModelInfo,
};
