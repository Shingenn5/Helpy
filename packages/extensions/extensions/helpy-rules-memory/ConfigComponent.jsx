({ config, updateConfig, ui }) => {
  const { Input } = ui;

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Vault Root"
        value={config?.vaultRoot || ''}
        onChange={(e) => updateConfig({ ...config, vaultRoot: e.target.value })}
        placeholder="/home/you/Obsidian/Helpy"
      />
      <Input
        label="Rules File"
        value={config?.rulesFile || 'Rules/Helpy Model Rules.md'}
        onChange={(e) => updateConfig({ ...config, rulesFile: e.target.value })}
        placeholder="Rules/Helpy Model Rules.md"
      />
      <p className="text-xs text-text-secondary">
        Put personality, workflow rules, and durable preferences here. The file is injected into reminders/system prompts.
      </p>
    </div>
  );
};
