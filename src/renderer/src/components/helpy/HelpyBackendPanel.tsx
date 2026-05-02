import { useEffect, useMemo, useState } from 'react';
import { HelpyBackendResult } from '@common/types';
import { MdBolt, MdCheckCircle, MdError, MdHourglassTop, MdPowerSettingsNew, MdSubject, MdSync } from 'react-icons/md';

import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { useApi } from '@/contexts/ApiContext';

type Action = 'start' | 'stop' | 'status' | 'logs' | 'health';

const trimOutput = (text?: string) => {
  if (!text) {
    return '';
  }
  return text.length > 1400 ? `${text.slice(0, 1400)}\n...` : text;
};

const niceStatus = (result?: HelpyBackendResult | null) => {
  if (!result) {
    return 'checking';
  }
  if (result.ok) {
    return 'online';
  }
  if (result.status === 'loading-model') {
    return 'loading model';
  }
  if (result.status === 'missing-compose-file') {
    return 'compose missing';
  }
  if (result.status === 'timeout') {
    return 'health timeout';
  }
  return result.status || 'offline';
};

export const HelpyBackendPanel = () => {
  const api = useApi();
  const [config, setConfig] = useState<HelpyBackendResult | null>(null);
  const [health, setHealth] = useState<HelpyBackendResult | null>(null);
  const [lastResult, setLastResult] = useState<HelpyBackendResult | null>(null);
  const [busyAction, setBusyAction] = useState<Action | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [lastChecked, setLastChecked] = useState<string>('');

  const isOnline = health?.ok;
  const isLoading = health?.status === 'loading-model';
  const label = useMemo(() => {
    return niceStatus(health);
  }, [health]);

  const runAction = async (action: Action) => {
    setBusyAction(action);
    try {
      const handlers = {
        start: api.startHelpyBackend,
        stop: api.stopHelpyBackend,
        status: api.getHelpyBackendStatus,
        logs: api.getHelpyBackendLogs,
        health: api.checkHelpyBackendHealth,
      };
      const result = await handlers[action]();
      setLastResult(result);
      if (action === 'health' || action === 'start' || action === 'stop') {
        const nextHealth = await api.checkHelpyBackendHealth();
        setHealth(nextHealth);
        setLastChecked(new Date().toLocaleTimeString());
      }
      if (action === 'logs' || action === 'status') {
        setExpanded(true);
      }
    } finally {
      setBusyAction(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const nextConfig = await api.getHelpyBackendConfig();
      if (!cancelled) {
        setConfig(nextConfig);
      }
      const result = await api.checkHelpyBackendHealth();
      if (!cancelled) {
        setHealth(result);
        setLastChecked(new Date().toLocaleTimeString());
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), isLoading ? 5000 : 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [api, isLoading]);

  const indicator = isOnline ? (
    <MdCheckCircle className="text-green-400" />
  ) : isLoading ? (
    <MdHourglassTop className="text-info-light animate-pulse" />
  ) : (
    <MdError className="text-yellow-400" />
  );

  const outputText = trimOutput(lastResult?.output || lastResult?.error || health?.output || health?.error || health?.status);

  return (
    <div className="relative flex items-center gap-1.5 px-2 border-l border-border-default">
      <button
        data-testid="helpy-backend-toggle"
        className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-text-secondary hover:bg-bg-tertiary-emphasis rounded-md"
        onClick={() => setExpanded((value) => !value)}
      >
        {indicator}
        <span className="hidden lg:inline font-medium text-text-primary">Local model</span>
        <span className="max-w-28 truncate">{label}</span>
      </button>
      <Button
        size="xs"
        variant="outline"
        color="secondary"
        onClick={() => void runAction('start')}
        disabled={busyAction !== null}
        className="hidden xl:flex"
        title="Start local backend"
      >
        <MdBolt className="h-4 w-4" />
        <span>Start</span>
      </Button>
      <IconButton
        icon={<MdBolt className="h-5 w-5 text-text-secondary" />}
        tooltip="Start local backend"
        data-testid="helpy-backend-start"
        onClick={() => void runAction('start')}
        disabled={busyAction !== null}
        className="xl:hidden px-2 py-2 hover:bg-bg-tertiary-emphasis transition-colors duration-200"
      />
      <IconButton
        icon={<MdPowerSettingsNew className="h-5 w-5 text-text-secondary" />}
        tooltip="Stop local backend"
        data-testid="helpy-backend-stop"
        onClick={() => void runAction('stop')}
        disabled={busyAction !== null}
        className="px-2 py-2 hover:bg-bg-tertiary-emphasis transition-colors duration-200"
      />
      <IconButton
        icon={<MdSync className={`h-5 w-5 text-text-secondary ${busyAction ? 'animate-spin' : ''}`} />}
        tooltip="Check backend"
        data-testid="helpy-backend-health"
        onClick={() => void runAction('health')}
        disabled={busyAction !== null}
        className="px-2 py-2 hover:bg-bg-tertiary-emphasis transition-colors duration-200"
      />
      <IconButton
        icon={<MdSubject className="h-5 w-5 text-text-secondary" />}
        tooltip="Show Docker logs"
        data-testid="helpy-backend-logs"
        onClick={() => void runAction('logs')}
        disabled={busyAction !== null}
        className="px-2 py-2 hover:bg-bg-tertiary-emphasis transition-colors duration-200"
      />

      {expanded && (
        <div
          data-testid="helpy-backend-popover"
          className="absolute right-0 top-full mt-1 w-[min(760px,92vw)] max-h-[470px] overflow-hidden border border-border-default bg-bg-primary shadow-xl z-[80] rounded-md"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-border-default text-xs text-text-muted bg-bg-secondary">
            <span className="font-medium text-text-primary">Helpy backend</span>
            <button className="text-text-secondary hover:text-text-primary" onClick={() => setExpanded(false)}>
              close
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 border-b border-border-default text-xs">
            <div className="rounded border border-border-default bg-bg-secondary p-2">
              <div className="text-text-muted">Endpoint</div>
              <div className="text-text-primary truncate">{health?.endpoint || config?.endpoint || 'http://127.0.0.1:8080/v1'}</div>
            </div>
            <div className="rounded border border-border-default bg-bg-secondary p-2">
              <div className="text-text-muted">Status</div>
              <div className="text-text-primary">
                {label}
                {lastChecked ? ` at ${lastChecked}` : ''}
              </div>
            </div>
            <div className="rounded border border-border-default bg-bg-secondary p-2 md:col-span-2">
              <div className="text-text-muted">Model</div>
              <div className="text-text-primary truncate">{health?.modelPath || config?.modelPath || 'not configured'}</div>
            </div>
            <div className="rounded border border-border-default bg-bg-secondary p-2 md:col-span-2">
              <div className="text-text-muted">Compose</div>
              <div className="text-text-primary truncate">{health?.composeFile || config?.composeFile || 'not found'}</div>
            </div>
          </div>
          <pre className="max-h-[260px] overflow-auto p-3 text-xs whitespace-pre-wrap text-text-secondary font-mono">
            {outputText || 'No logs yet. Hit the logs button or start the backend.'}
          </pre>
        </div>
      )}
    </div>
  );
};
