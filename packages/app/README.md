# @helpy/workbench

Run Helpy as a headless backend service accessible through your browser. This package provides a lightweight alternative to the desktop application — similar to running Helpy with Docker.

After starting, the Helpy web UI is available at `http://localhost:24337`.

## Installation

```bash
npm install -g @helpy/workbench
```

Alternatively, run it directly without installing:

```bash
npx @helpy/workbench
```

The postinstall script automatically downloads the required `uv` Python package manager and `probe` binary for your platform.

## Usage

### Interactive TUI (default)

```bash
helpy
# or
helpy tui
```

Opens an interactive terminal UI where you can start/stop the service, configure the port, and view logs.

**Keyboard shortcuts:**

| Key | Action |
|-----|--------|
| `s` | Start / Stop the service |
| `p` | Change port |
| `q` | Exit |
| `↑` / `↓` | Scroll logs |
| `PgUp` / `PgDn` | Scroll logs by half page |
| `Ctrl+C` | Exit |

### Headless Foreground

```bash
helpy start
```

Runs the service in the foreground with logs printed to stdout. Useful for Docker containers, systemd services, or CI environments.

### Options

```
-p, --port <port>   Set the port to listen on (default: 24337, env: AIDER_DESK_PORT)
-h, --help          Show help message
-v, --version       Show version number
```

### Port Configuration

You can set the port in three ways (highest priority first):

1. CLI flag: `helpy start --port 8080`
2. Environment variable: `AIDER_DESK_PORT=8080`
3. Default: `24337`

## Accessing the UI

Once running, open your browser and navigate to:

```
http://localhost:24337
```

From there you can use Helpy the same way as the desktop application.

## Requirements

- **Node.js** 20 or later
- **Python** 3.8+ (automatically managed via `uv`)

## Differences from the Desktop App

This package runs only the Helpy backend service. It does **not** include the Electron desktop shell. The experience is identical to running Helpy in a browser (e.g., via Docker). Features like system tray integration and native desktop notifications are not available.

## Links

- [Documentation](https://github.com/Shingenn5/Helpy/docs)
- [GitHub](https://github.com/Shingenn5/Helpy)
- [Docker Guide](https://github.com/Shingenn5/Helpy/docs/advanced/docker)
- [Discord](https://discord.com/invite/dyM3G9nTe4)

## License

MIT
