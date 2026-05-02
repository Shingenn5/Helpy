import { useTranslation } from 'react-i18next';

// @ts-expect-error TypeScript is not aware of asset import
import icon from '../../../../../resources/icon.png?asset';

type Props = {
  onOpenProject: () => void;
};

export const NoProjectsOpen = ({ onOpenProject }: Props) => {
  const { t } = useTranslation();
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-text-muted-light bg-bg-primary">
      <div className="w-[min(760px,92vw)] text-center">
        <div className="flex justify-center mb-5">
          <div className="rounded-2xl border border-border-default bg-bg-secondary p-4 shadow-xl">
            <img src={icon} alt="Helpy" className="h-20 w-20" />
          </div>
        </div>
        <h2 className="text-2xl font-semibold mb-3">
          {t('noProjectsOpen.welcome')} <span className="text-text-primary font-bold">Helpy</span>
        </h2>
        <p className="text-text-muted-light mb-6 text-sm max-w-xl mx-auto leading-6">
          Open a repo to start a local-first coding session with context files, diffs, model backend controls, and Markdown-friendly task history.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-7 text-left">
          <div className="rounded-md border border-border-default bg-bg-secondary p-3">
            <div className="text-text-primary text-sm font-medium">1. Open project</div>
            <div className="text-xs text-text-muted mt-1">Point Helpy at a repo inside your WSL workspace.</div>
          </div>
          <div className="rounded-md border border-border-default bg-bg-secondary p-3">
            <div className="text-text-primary text-sm font-medium">2. Start backend</div>
            <div className="text-xs text-text-muted mt-1">Use the Local model controls in the top bar.</div>
          </div>
          <div className="rounded-md border border-border-default bg-bg-secondary p-3">
            <div className="text-text-primary text-sm font-medium">3. Work in tasks</div>
            <div className="text-xs text-text-muted mt-1">Chat, edit files, review diffs, and keep context together.</div>
          </div>
        </div>
        <div className="space-y-4">
          <button
            className="px-6 py-3 border border-button-primary bg-button-primary text-button-primary-text rounded-md hover:bg-button-primary-light transition-colors duration-200 text-md font-medium mb-3"
            onClick={onOpenProject}
          >
            {t('common.openProject')}
          </button>
          <p className="text-xs text-text-muted">{t('tips.multipleProjects')}</p>
        </div>
      </div>
    </div>
  );
};
