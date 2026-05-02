import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS, getHelpyLocalProvider } from '../store';

describe('Store Helpy local provider', () => {
  it('uses the configured local endpoint for the built-in provider', () => {
    const localProvider = getHelpyLocalProvider({
      ...DEFAULT_SETTINGS,
      helpy: {
        ...DEFAULT_SETTINGS.helpy!,
        endpoint: 'http://127.0.0.1:18080/v1',
      },
    });

    expect(localProvider.provider).toMatchObject({
      name: 'openai-compatible',
      apiKey: 'local',
      baseUrl: 'http://127.0.0.1:18080/v1',
    });
  });
});
