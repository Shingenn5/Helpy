import { useEffect, useMemo, useState } from 'react';
import { HelpyBackendResult } from '@common/types';
import { MdBolt, MdCheckCircle, MdError, MdPowerSettingsNew, MdSubject, MdSync } from 'react-icons/md';

import { IconButton } from '@/components/common/IconButton';
import { useApi } from '@/contexts/ApiContext';

type Action = 'start' | 'stop' | 'status' | 'logs' | 'health';

const trimOutput = (text?: string) => {
  if (!text) {
    return '';
  }
  return text.length > 1400 ? `${text.slice(0, 1400)}\n...` : text;
};

export const HelpyBackendPanel = () => {
  const api = useApi();
  const [health, setHealth] = useState<HelpyBackendResult | null>(null);
  const [lastResult, setLastResult] = useState<HelpyBackendResult | null>(null);
  const [busyAction, setBusyAction] = useState<Action | null>(null);
  const [expanded, setExpanded] = useState(false);

  const isOnline = health?.ok;
  const label = useMemo(() => {
    if (!health) return 'checking';
    return health.ok ? 'local online' : health.status || 'offline';
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
      const result = await api.checkHelpyBackendHealth();
      if (!cancelled) {
        setHealth(result);
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [api]);

  return (
    <div className="relative flex items-center gap-2 px-2 border-l border-border-default">
      <button
        className="flex items-center gap-2 px-2 py-1 text-xs text-text-secondary hover:bg-bg-tertiary-emphasis rounded-sm"
        onClick={() => setExpanded((value) => !value)}
      >
        {isOnline ? <MdCheckCircle className="text-green-400" /> : <MdError className="text-yellow-400" />}
        <span className="hidden lg:inline">llama.cpp</span>
        <span className="max-w-28 truncate">{label}</span>
      </button>
      <IconButton
        icon={<MdBolt className="h-5 w-5 text-text-secondary" />}
        tooltip="Start local backend"
        onClick={() => void runAction('start')}
        disabled={busyAction !== null}
        className="px-2 py-2 hover:bg-bg-tertiary-emphasis transition-colors duration-200"
      />
      <IconButton
        icon={<MdPowerSettingsNew className="h-5 w-5 text-text-secondary" />}
        tooltip="Stop local backend"
        onClick={() => void runAction('stop')}
        disabled={busyAction !== null}
        className="px-2 py-2 hover:bg-bg-tertiary-emphasis transition-colors duration-200"
      />
      <IconButton
        icon={<MdSync className={`h-5 w-5 text-text-secondary ${busyAction ? 'animate-spin' : ''}`} />}
        tooltip="Check backend"
        onClick={() => void runAction('health')}
        disabled={busyAction !== null}
        className="px-2 py-2 hover:bg-bg-tertiary-emphasis transition-colors duration-200"
      />
      <IconButton
        icon={<MdSubject className="h-5 w-5 text-text-secondary" />}
        tooltip="Show Docker logs"
        onClick={() => void runAction('logs')}
        disabled={busyAction !== null}
        className="px-2 py-2 hover:bg-bg-tertiary-emphasis transition-colors duration-200"
      />

      {expanded && (
        <div className="absolute right-0 top-full mt-1 w-[min(680px,90vw)] max-h-[360px] overflow-hidden border border-border-default bg-bg-primary shadow-xl z-[80]">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border-default text-xs text-text-muted">
            <span>{health?.endpoint || 'http://127.0.0.1:8080/v1'}</span>
            <button className="text-text-secondary hover:text-text-primary" onClick={() => setExpanded(false)}>
              close
            </button>
          </div>
          <pre className="max-h-[300px] overflow-auto p-3 text-xs whitespace-pre-wrap text-text-secondary font-mono">
            {trimOutput(lastResult?.output || lastResult?.error || health?.output || health?.error || health?.status)}
          </pre>
        </div>
      )}
    </div>
  );
};
