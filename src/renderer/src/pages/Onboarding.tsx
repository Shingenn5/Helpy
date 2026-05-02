import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpyBackendResult, HelpyLocalConfig, SettingsData } from '@common/types';
import { MdBolt, MdCheckCircle, MdFolderOpen, MdMemory, MdNotes, MdRocketLaunch, MdTerminal } from 'react-icons/md';

import type { ReactNode } from 'react';

import { Button } from '@/components/common/Button';
import { Checkbox } from '@/components/common/Checkbox';
import { OnboardingStepper } from '@/components/onboarding/OnboardingStepper';
import { useApi } from '@/contexts/ApiContext';
import { useSettings } from '@/contexts/SettingsContext';
import { ROUTES } from '@/utils/routes';
import { showErrorNotification, showInfoNotification } from '@/utils/notifications';

const defaultHelpyConfig: HelpyLocalConfig = {
  modelPath: '/home/shingen/AI_Core/models/Qwen3.6-35B-A3B-UD-IQ2_M.gguf',
  vaultPath: '/home/shingen/HelpyVault',
  projectsRoot: '/home/shingen/Tech Projects',
  endpoint: 'http://127.0.0.1:8080/v1',
  autoStartBackend: false,
};

const modelNameFromPath = (modelPath: string) => modelPath.split(/[\\/]/).pop() || 'local-model.gguf';

const updateEnvValue = (envText: string, key: string, value: string) => {
  const lines = envText ? envText.split(/\r?\n/) : [];
  const nextLine = `${key}=${value}`;
  const index = lines.findIndex((line) => line.trim().startsWith(`${key}=`));
  if (index >= 0) {
    lines[index] = nextLine;
  } else {
    lines.push(nextLine);
  }
  return lines.filter(Boolean).join('\n');
};

const mergeRuntimeSettings = (settings: SettingsData, helpy: HelpyLocalConfig): SettingsData => {
  const modelName = modelNameFromPath(helpy.modelPath);
  const envWithBase = updateEnvValue(settings.aider.environmentVariables, 'OPENAI_API_BASE', helpy.endpoint);
  const envWithKey = updateEnvValue(envWithBase, 'OPENAI_API_KEY', 'local');

  return {
    ...settings,
    onboardingFinished: true,
    helpy,
    preferredModels: [`helpy-local/${modelName}`, ...settings.preferredModels.filter((model) => !model.startsWith('helpy-local/'))],
    aider: {
      ...settings.aider,
      environmentVariables: envWithKey,
      watchFiles: true,
      confirmBeforeEdit: false,
    },
    telemetryEnabled: false,
    telemetryInformed: true,
    windowTitleTemplate: settings.windowTitleTemplate || 'Helpy - {project}',
  };
};

const Field = ({
  icon,
  label,
  value,
  onChange,
  onBrowse,
  placeholder,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBrowse?: () => void;
  placeholder?: string;
}) => (
  <label className="block">
    <div className="mb-1.5 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-text-muted">
      {icon}
      {label}
    </div>
    <div className="flex min-w-0 rounded-md border border-border-default bg-bg-secondary">
      <input
        className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-muted"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        spellCheck={false}
      />
      {onBrowse && (
        <button
          type="button"
          className="border-l border-border-default px-3 text-xs font-medium text-info-lighter hover:bg-bg-tertiary hover:text-info-lightest"
          onClick={onBrowse}
        >
          Browse
        </button>
      )}
    </div>
  </label>
);

const StatusPill = ({ result }: { result: HelpyBackendResult | null }) => {
  const ok = result?.ok;
  const label = result ? (ok ? 'Ready' : result.status || 'Needs setup') : 'Not checked';

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border-default bg-bg-secondary px-3 py-1.5 text-xs text-text-secondary">
      {ok ? <MdCheckCircle className="text-success-light" /> : <MdTerminal className="text-info-light" />}
      {label}
    </div>
  );
};

export const Onboarding = () => {
  const api = useApi();
  const navigate = useNavigate();
  const { settings, saveSettings } = useSettings();
  const [step, setStep] = useState(1);
  const [localConfig, setLocalConfig] = useState<HelpyLocalConfig>(settings?.helpy || defaultHelpyConfig);
  const [backendResult, setBackendResult] = useState<HelpyBackendResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (settings?.helpy) {
      setLocalConfig({ ...defaultHelpyConfig, ...settings.helpy });
    }
  }, [settings]);

  useEffect(() => {
    void api.getHelpyBackendConfig().then(setBackendResult);
  }, [api]);

  const steps = useMemo(() => [{ title: 'Welcome' }, { title: 'Local model' }, { title: 'Vault' }, { title: 'Backend' }], []);

  const choosePath = async (kind: 'model' | 'vault' | 'projects') => {
    const result = await api.showOpenDialog({
      properties: kind === 'model' ? ['openFile'] : ['openDirectory'],
      defaultPath: kind === 'model' ? localConfig.modelPath : kind === 'vault' ? localConfig.vaultPath : localConfig.projectsRoot,
    });

    if (result.canceled || !result.filePaths[0]) {
      return;
    }

    const picked = result.filePaths[0];
    setLocalConfig((current) => ({
      ...current,
      ...(kind === 'model' ? { modelPath: picked } : kind === 'vault' ? { vaultPath: picked } : { projectsRoot: picked }),
    }));
  };

  const configureBackend = async () => {
    setBusy(true);
    try {
      const result = await api.configureHelpyBackend(localConfig);
      setBackendResult(result);
      if (!result.ok) {
        showErrorNotification(result.error || 'Helpy backend setup failed');
        return result;
      }
      showInfoNotification('Helpy runtime config saved.');
      return result;
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (!settings) {
      return;
    }

    setBusy(true);
    try {
      const configured = await api.configureHelpyBackend(localConfig);
      setBackendResult(configured);
      if (!configured.ok) {
        showErrorNotification(configured.error || 'Helpy backend setup failed');
        return;
      }

      await saveSettings(mergeRuntimeSettings(settings, localConfig));

      if (localConfig.autoStartBackend) {
        setBackendResult(await api.startHelpyBackend());
      }

      showInfoNotification('Helpy is ready.');
      navigate(ROUTES.Home);
    } catch (error) {
      showErrorNotification(error instanceof Error ? error.message : 'Failed to finish Helpy setup');
    } finally {
      setBusy(false);
    }
  };

  const renderStep = () => {
    if (step === 1) {
      return (
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-info-light-emphasis bg-info-subtle px-3 py-1 text-xs text-info-lightest">
              <MdRocketLaunch />
              Local-first AI workbench
            </div>
            <h1 className="text-3xl font-semibold text-text-primary">Set up Helpy</h1>
            <p className="max-w-2xl text-sm leading-6 text-text-secondary">
              Helpy runs your local coding agent stack, keeps project work close to your machine, and writes the useful bits to a Markdown vault.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ['Model control', 'Pick the GGUF model Helpy should boot through llama.cpp.'],
              ['Markdown memory', 'Choose the Obsidian-compatible vault where sessions become searchable notes.'],
              ['Project cockpit', 'Point Helpy at your development workspace and keep backend status visible.'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-md border border-border-default bg-bg-secondary p-4">
                <div className="mb-2 text-sm font-medium text-text-primary">{title}</div>
                <p className="text-xs leading-5 text-text-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (step === 2) {
      return (
        <div className="space-y-5">
          <h2 className="text-2xl font-semibold text-text-primary">Local Model</h2>
          <p className="text-sm text-text-secondary">Choose the GGUF file that the Docker llama.cpp backend should serve.</p>
          <Field
            icon={<MdMemory />}
            label="GGUF model file"
            value={localConfig.modelPath}
            onChange={(modelPath) => setLocalConfig((current) => ({ ...current, modelPath }))}
            onBrowse={() => void choosePath('model')}
          />
          <Field
            icon={<MdBolt />}
            label="OpenAI-compatible endpoint"
            value={localConfig.endpoint}
            onChange={(endpoint) => setLocalConfig((current) => ({ ...current, endpoint }))}
          />
        </div>
      );
    }

    if (step === 3) {
      return (
        <div className="space-y-5">
          <h2 className="text-2xl font-semibold text-text-primary">Workspace Memory</h2>
          <p className="text-sm text-text-secondary">Pick where Helpy should keep Markdown sessions and where it should look for projects.</p>
          <Field
            icon={<MdNotes />}
            label="Markdown vault"
            value={localConfig.vaultPath}
            onChange={(vaultPath) => setLocalConfig((current) => ({ ...current, vaultPath }))}
            onBrowse={() => void choosePath('vault')}
          />
          <Field
            icon={<MdFolderOpen />}
            label="Projects root"
            value={localConfig.projectsRoot}
            onChange={(projectsRoot) => setLocalConfig((current) => ({ ...current, projectsRoot }))}
            onBrowse={() => void choosePath('projects')}
          />
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Backend Control</h2>
            <p className="mt-2 max-w-2xl text-sm text-text-secondary">Save the runtime config and optionally boot the local model backend from Helpy.</p>
          </div>
          <StatusPill result={backendResult} />
        </div>
        <div className="rounded-md border border-border-default bg-bg-secondary p-4 text-xs text-text-secondary">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-text-muted">Model</div>
              <div className="truncate text-text-primary">{localConfig.modelPath}</div>
            </div>
            <div>
              <div className="text-text-muted">Endpoint</div>
              <div className="truncate text-text-primary">{localConfig.endpoint}</div>
            </div>
            <div>
              <div className="text-text-muted">Vault</div>
              <div className="truncate text-text-primary">{localConfig.vaultPath}</div>
            </div>
            <div>
              <div className="text-text-muted">Projects</div>
              <div className="truncate text-text-primary">{localConfig.projectsRoot}</div>
            </div>
          </div>
        </div>
        <Checkbox
          label="Start the local backend when setup finishes"
          checked={localConfig.autoStartBackend}
          onChange={(autoStartBackend) => setLocalConfig((current) => ({ ...current, autoStartBackend }))}
        />
        <Button color="secondary" variant="outline" onClick={() => void configureBackend()} disabled={busy} size="sm">
          Save runtime config
        </Button>
      </div>
    );
  };

  return (
    <div className="flex h-full bg-bg-primary text-text-primary">
      <aside className="hidden w-72 border-r border-border-default bg-bg-secondary p-6 lg:block">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-info-subtle text-info-lightest">
            <MdRocketLaunch className="h-6 w-6" />
          </div>
          <div>
            <div className="text-lg font-semibold">Helpy</div>
            <div className="text-xs text-text-muted">Local AI control plane</div>
          </div>
        </div>
        <div className="space-y-3 text-xs leading-5 text-text-secondary">
          <p>Setup writes your local runtime config and keeps Helpy pointed at your own model, vault, and projects.</p>
          <p>No API keys are required for the default local backend.</p>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-border-default px-6 py-5">
          <OnboardingStepper steps={steps} currentStep={step} />
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-6">
          <div className="w-full max-w-4xl">{renderStep()}</div>
        </div>
        <div className="flex items-center justify-between border-t border-border-default px-6 py-4">
          <Button variant="outline" color="secondary" onClick={() => setStep((current) => Math.max(1, current - 1))} disabled={step === 1 || busy}>
            Back
          </Button>
          {step < steps.length ? (
            <Button onClick={() => setStep((current) => Math.min(steps.length, current + 1))} disabled={busy}>
              Next
            </Button>
          ) : (
            <Button onClick={() => void finish()} disabled={busy}>
              {busy ? 'Finishing...' : 'Finish setup'}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
};
