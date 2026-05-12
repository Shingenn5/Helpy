({ config, updateConfig, ui }) => {
  const { Input, Checkbox } = ui;

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Vault Root"
        value={config?.vaultRoot || ''}
        onChange={(e) => updateConfig({ ...config, vaultRoot: e.target.value })}
        placeholder="/home/you/ObsidianVault"
      />
      <Input
        label="Graph Folder"
        value={config?.graphDir || 'Graph'}
        onChange={(e) => updateConfig({ ...config, graphDir: e.target.value })}
        placeholder="Graph"
      />
      <Input
        label="Graphify Command"
        value={config?.graphifyCommand || 'graphify'}
        onChange={(e) => updateConfig({ ...config, graphifyCommand: e.target.value })}
        placeholder="graphify"
      />
      <Input
        label="Graphify Output Folder"
        value={config?.graphifyOutDir || 'graphify-out'}
        onChange={(e) => updateConfig({ ...config, graphifyOutDir: e.target.value })}
        placeholder="graphify-out"
      />
      <Checkbox
        label="Auto-update Graphify after prompts"
        checked={config?.autoUpdateOnPrompt ?? false}
        onChange={(checked) => updateConfig({ ...config, autoUpdateOnPrompt: checked })}
      />
      <p className="text-xs text-text-secondary">
        Helpy writes semantic Markdown memory, then searches graphify-out/graph.json locally.
      </p>
    </div>
  );
};
