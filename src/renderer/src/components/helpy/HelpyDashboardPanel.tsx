import { useEffect, useState } from 'react';
import { MdMemory, MdMic, MdOpenInNew, MdPlayArrow, MdRefresh, MdStop } from 'react-icons/md';
import { HelpyBackendResult, HelpyMemoryGraphStats, HelpyProcessResult, HelpyVoiceResult } from '@common/types';

import { IconButton } from '@/components/common/IconButton';
import { useApi } from '@/contexts/ApiContext';

type Props = {
  activeProject?: string | null;
};

const short = (value?: string, fallback = 'not set') => {
  if (!value) {
    return fallback;
  }
  return value.length > 72 ? `...${value.slice(-69)}` : value;
};

const statusTone = (ok?: boolean) => (ok ? 'text-green-400' : 'text-yellow-400');

export const HelpyDashboardPanel = ({ activeProject }: Props) => {
  const api = useApi();
  const [open, setOpen] = useState(false);
  const [backend, setBackend] = useState<HelpyBackendResult | null>(null);
  const [openClaw, setOpenClaw] = useState<HelpyProcessResult | null>(null);
  const [voice, setVoice] = useState<HelpyVoiceResult | null>(null);
  const [graph, setGraph] = useState<HelpyMemoryGraphStats | null>(null);
  const [logs, setLogs] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [openClawPath, setOpenClawPath] = useState('');
  const [openClawDir, setOpenClawDir] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [sttCommand, setSttCommand] = useState('');
  const [ttsCommand, setTtsCommand] = useState('');

  const refresh = async () => {
    const [nextBackend, nextOpenClaw, nextVoice, nextGraph] = await Promise.all([
      api.checkHelpyBackendHealth(),
      api.getHelpyOpenClawStatus(),
      api.getHelpyVoiceStatus(),
      api.getHelpyMemoryGraphStats(),
    ]);
    setBackend(nextBackend);
    setOpenClaw(nextOpenClaw);
    setVoice(nextVoice);
    setGraph(nextGraph);
    setOpenClawPath(nextOpenClaw.executablePath || '');
    setOpenClawDir(nextOpenClaw.workingDirectory || '');
    setVoiceEnabled(nextVoice.status === 'configured');
    setSttCommand(nextVoice.sttCommand || '');
    setTtsCommand(nextVoice.ttsCommand || '');
  };

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const runOpenClaw = async (action: 'start' | 'stop' | 'logs') => {
    setBusy(`openclaw-${action}`);
    try {
      const result =
        action === 'start' ? await api.startHelpyOpenClaw() : action === 'stop' ? await api.stopHelpyOpenClaw() : await api.getHelpyOpenClawLogs();
      setOpenClaw(result);
      setLogs(result.output || result.error || result.status);
    } finally {
      setBusy(null);
    }
  };

  const checkVoice = async () => {
    const result = await api.startHelpyPushToTalk();
    setVoice(result);
    setLogs(result.output || result.error || result.status);
  };

  const saveOpenClaw = async () => {
    const result = await api.configureHelpyOpenClaw({
      executablePath: openClawPath,
      workingDirectory: openClawDir,
      env: {},
    });
    setOpenClaw(result);
    setLogs(result.output || result.error || result.status);
  };

  const saveVoice = async () => {
    const result = await api.configureHelpyVoice({
      enabled: voiceEnabled,
      sttCommand,
      ttsCommand,
    });
    setVoice(result);
    setLogs(result.output || result.error || result.status);
  };

  return (
    <div className="relative border-l border-border-default">
      <IconButton
        icon={<MdMemory className="h-5 w-5 text-text-secondary" />}
        tooltip="Helpy control plane"
        onClick={() => setOpen((value) => !value)}
        className="px-3 py-2 hover:bg-bg-tertiary-emphasis transition-colors duration-200"
      />
      {open && (
        <div className="absolute right-0 top-full mt-1 w-[min(840px,94vw)] max-h-[76vh] overflow-hidden border border-border-default bg-bg-primary shadow-xl z-[90] rounded-md">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border-default bg-bg-secondary">
            <div>
              <div className="text-sm font-semibold text-text-primary">Helpy JARVIS Workstation</div>
              <div className="text-xs text-text-muted">Local coding, memory, backend, and process control</div>
            </div>
            <button className="text-xs text-text-secondary hover:text-text-primary" onClick={() => setOpen(false)}>
              close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 p-3 text-xs">
            <section className="rounded border border-border-default bg-bg-secondary p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-text-primary">Local Backend</h3>
                <span className={statusTone(backend?.ok)}>{backend?.status || 'checking'}</span>
              </div>
              <p className="text-text-muted truncate">Endpoint: {backend?.endpoint || 'http://127.0.0.1:8080/v1'}</p>
              <p className="text-text-muted truncate">Model: {short(backend?.modelPath)}</p>
              <p className="text-text-muted truncate">Docker: {short(backend?.composeFile)}</p>
            </section>

            <section className="rounded border border-border-default bg-bg-secondary p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-text-primary">Project Context</h3>
                <span className="text-info-light">small-model safe</span>
              </div>
              <p className="text-text-muted truncate">Project: {short(activeProject || undefined, 'no project open')}</p>
              <p className="text-text-muted">Use context files only for local tests.</p>
              <p className="text-text-muted">Clear context before tiny prompts to avoid overflow.</p>
            </section>

            <section className="rounded border border-border-default bg-bg-secondary p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-text-primary">Memory Graph</h3>
                <span className={statusTone(graph?.ok)}>{graph?.status || 'checking'}</span>
              </div>
              <p className="text-text-muted truncate">Vault: {short(graph?.vaultRoot || backend?.vaultPath || '/home/shingen/ObsidianVault')}</p>
              <p className="text-text-muted">
                Nodes: {graph?.nodes ?? 0} / Edges: {graph?.edges ?? 0}
              </p>
              <p className="text-text-muted truncate">Updated: {graph?.updatedAt || 'run /helpy-graphify-update'}</p>
            </section>

            <section className="rounded border border-border-default bg-bg-secondary p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-text-primary">OpenClaw</h3>
                <span className={statusTone(openClaw?.ok)}>{openClaw?.status || 'checking'}</span>
              </div>
              <p className="text-text-muted truncate">Command: {short(openClaw?.executablePath)}</p>
              <p className="text-text-muted truncate">Workdir: {short(openClaw?.workingDirectory)}</p>
              <input
                value={openClawPath}
                onChange={(event) => setOpenClawPath(event.target.value)}
                placeholder="openclaw executable path"
                className="mt-2 w-full rounded border border-border-default bg-bg-primary px-2 py-1 text-text-primary"
              />
              <input
                value={openClawDir}
                onChange={(event) => setOpenClawDir(event.target.value)}
                placeholder="working directory"
                className="mt-1 w-full rounded border border-border-default bg-bg-primary px-2 py-1 text-text-primary"
              />
              <div className="flex gap-1 mt-2">
                <button className="px-2 py-1 rounded border border-border-default hover:bg-bg-tertiary" disabled={!!busy} onClick={() => void saveOpenClaw()}>
                  save
                </button>
                <button className="px-2 py-1 rounded border border-border-default hover:bg-bg-tertiary" disabled={!!busy} onClick={() => void runOpenClaw('start')}>
                  <MdPlayArrow className="inline h-4 w-4" /> start
                </button>
                <button className="px-2 py-1 rounded border border-border-default hover:bg-bg-tertiary" disabled={!!busy} onClick={() => void runOpenClaw('stop')}>
                  <MdStop className="inline h-4 w-4" /> stop
                </button>
                <button className="px-2 py-1 rounded border border-border-default hover:bg-bg-tertiary" disabled={!!busy} onClick={() => void runOpenClaw('logs')}>
                  logs
                </button>
              </div>
            </section>

            <section className="rounded border border-border-default bg-bg-secondary p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-text-primary">Voice</h3>
                <span className={statusTone(voice?.ok)}>{voice?.status || 'checking'}</span>
              </div>
              <p className="text-text-muted truncate">STT: {short(voice?.sttCommand)}</p>
              <p className="text-text-muted truncate">TTS: {short(voice?.ttsCommand)}</p>
              <label className="mt-2 flex items-center gap-2 text-text-muted">
                <input type="checkbox" checked={voiceEnabled} onChange={(event) => setVoiceEnabled(event.target.checked)} />
                enable local voice
              </label>
              <input
                value={sttCommand}
                onChange={(event) => setSttCommand(event.target.value)}
                placeholder="local STT command"
                className="mt-1 w-full rounded border border-border-default bg-bg-primary px-2 py-1 text-text-primary"
              />
              <input
                value={ttsCommand}
                onChange={(event) => setTtsCommand(event.target.value)}
                placeholder="local TTS command"
                className="mt-1 w-full rounded border border-border-default bg-bg-primary px-2 py-1 text-text-primary"
              />
              <button className="mt-2 mr-1 px-2 py-1 rounded border border-border-default hover:bg-bg-tertiary" onClick={() => void saveVoice()}>
                save
              </button>
              <button className="mt-2 px-2 py-1 rounded border border-border-default hover:bg-bg-tertiary" onClick={() => void checkVoice()}>
                <MdMic className="inline h-4 w-4" /> test push-to-talk
              </button>
            </section>

            <section className="rounded border border-border-default bg-bg-secondary p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-text-primary">Manual Commands</h3>
                <button className="text-text-secondary hover:text-text-primary" onClick={() => void refresh()}>
                  <MdRefresh className="h-4 w-4" />
                </button>
              </div>
              <p className="text-text-muted">/helpy-graphify-update</p>
              <p className="text-text-muted">/helpy-memory-query backend model</p>
              <p className="text-text-muted">/helpy-open-vault</p>
              <p className="text-text-muted">/helpy-log-snapshot</p>
            </section>
          </div>

          <div className="border-t border-border-default p-3">
            <div className="flex items-center gap-2 text-xs text-text-muted mb-2">
              <MdOpenInNew className="h-4 w-4" />
              OpenClaw and voice paths are configured in <code>~/.helpy</code> for now.
            </div>
            <pre className="max-h-36 overflow-auto rounded border border-border-default bg-bg-secondary p-2 text-xs whitespace-pre-wrap text-text-secondary">
              {logs || 'No control-plane logs yet.'}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
