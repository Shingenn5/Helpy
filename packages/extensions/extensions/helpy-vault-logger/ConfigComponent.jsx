({ config, updateConfig, ui }) => {
  const { Input, Checkbox } = ui;

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Vault Root"
        value={config?.vaultRoot || ''}
        onChange={(e) => updateConfig({ ...config, vaultRoot: e.target.value })}
        placeholder="/home/you/Obsidian/Helpy"
      />
      <Input
        label="Sessions Folder"
        value={config?.sessionsDir || 'Sessions'}
        onChange={(e) => updateConfig({ ...config, sessionsDir: e.target.value })}
        placeholder="Sessions"
      />
      <Checkbox
        label="Log tool events"
        checked={config?.appendToolEvents ?? true}
        onChange={(checked) => updateConfig({ ...config, appendToolEvents: checked })}
      />
      <Checkbox
        label="Log context file events"
        checked={config?.appendFileEvents ?? true}
        onChange={(checked) => updateConfig({ ...config, appendFileEvents: checked })}
      />
      <p className="text-xs text-text-secondary">
        Use any folder inside your Obsidian vault. Helpy will create the sessions folder if it does not exist.
      </p>
    </div>
  );
};
