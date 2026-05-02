({ config, updateConfig, ui }) => {
  const { Input } = ui;

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Backend Endpoint"
        value={config?.endpoint || ''}
        onChange={(e) => updateConfig({ ...config, endpoint: e.target.value })}
        placeholder="http://127.0.0.1:8080/v1"
      />
      <Input
        label="Docker Compose File"
        value={config?.composeFile || ''}
        onChange={(e) => updateConfig({ ...config, composeFile: e.target.value })}
        placeholder="/home/you/path/to/docker-compose.yml"
      />
      <Input
        label="Model Name"
        value={config?.modelName || ''}
        onChange={(e) => updateConfig({ ...config, modelName: e.target.value })}
        placeholder="model.gguf"
      />
    </div>
  );
};
