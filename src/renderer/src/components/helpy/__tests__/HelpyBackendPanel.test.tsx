import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApplicationAPI } from '@common/api';

import { HelpyBackendPanel } from '../HelpyBackendPanel';

import { TooltipProvider } from '@/components/ui/Tooltip';
import { ApiContext } from '@/contexts/ApiContext';
import { createMockApi } from '@/__tests__/mocks/api';

const renderPanel = (api: ApplicationAPI) => {
  return render(
    <ApiContext.Provider value={api}>
      <TooltipProvider>
        <HelpyBackendPanel />
      </TooltipProvider>
    </ApiContext.Provider>,
  );
};

describe('HelpyBackendPanel', () => {
  it('shows loading model health without calling it offline', async () => {
    const api = createMockApi({
      getHelpyBackendConfig: vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 'configured',
          endpoint: 'http://127.0.0.1:8080/v1',
          modelPath: '/home/shingen/AI_Core/models/Qwen3.6-35B-A3B-UD-IQ2_M.gguf',
          composeFile: '/home/shingen/Tech Projects/Helpy/docker-compose.yml',
        }),
      ),
      checkHelpyBackendHealth: vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 'loading-model',
          endpoint: 'http://127.0.0.1:8080/v1',
          modelPath: '/home/shingen/AI_Core/models/Qwen3.6-35B-A3B-UD-IQ2_M.gguf',
          composeFile: '/home/shingen/Tech Projects/Helpy/docker-compose.yml',
        }),
      ),
    });

    renderPanel(api as unknown as ApplicationAPI);

    await waitFor(() => {
      expect(screen.getByText('loading model')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('helpy-backend-toggle'));

    expect(screen.getByTestId('helpy-backend-popover')).toBeInTheDocument();
    expect(screen.getByText('/home/shingen/AI_Core/models/Qwen3.6-35B-A3B-UD-IQ2_M.gguf')).toBeInTheDocument();
    expect(screen.getByText('/home/shingen/Tech Projects/Helpy/docker-compose.yml')).toBeInTheDocument();
  });

  it('starts the backend and refreshes health state', async () => {
    const api = createMockApi({
      getHelpyBackendConfig: vi.fn(() => Promise.resolve({ ok: true, status: 'configured' })),
      startHelpyBackend: vi.fn(() => Promise.resolve({ ok: true, status: 'started', output: 'docker compose up -d' })),
      checkHelpyBackendHealth: vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 'offline' })
        .mockResolvedValueOnce({ ok: true, status: 'online', endpoint: 'http://127.0.0.1:8080/v1' }),
    });

    renderPanel(api as unknown as ApplicationAPI);

    await waitFor(() => {
      expect(screen.getByText('offline')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Start local backend'));

    await waitFor(() => {
      expect(api.startHelpyBackend).toHaveBeenCalledTimes(1);
      expect(screen.getByText('online')).toBeInTheDocument();
    });
  });

  it('opens Docker logs in the backend popover', async () => {
    const api = createMockApi({
      getHelpyBackendConfig: vi.fn(() => Promise.resolve({ ok: true, status: 'configured' })),
      checkHelpyBackendHealth: vi.fn(() => Promise.resolve({ ok: true, status: 'online' })),
      getHelpyBackendLogs: vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 'logs',
          output: 'llama-server listening at http://0.0.0.0:8080',
        }),
      ),
    });

    renderPanel(api as unknown as ApplicationAPI);

    await waitFor(() => {
      expect(screen.getByText('online')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('helpy-backend-logs'));

    await waitFor(() => {
      expect(screen.getByTestId('helpy-backend-popover')).toBeInTheDocument();
      expect(screen.getByText('llama-server listening at http://0.0.0.0:8080')).toBeInTheDocument();
    });
  });
});
