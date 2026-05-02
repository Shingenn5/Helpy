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
        label="Graph Folder"
        value={config?.graphDir || 'Graph'}
        onChange={(e) => updateConfig({ ...config, graphDir: e.target.value })}
        placeholder="Graph"
      />
      <p className="text-xs text-text-secondary">
        Graphify notes will be written under this folder using project and file subfolders.
      </p>
    </div>
  );
};
