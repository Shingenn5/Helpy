# Helpy WSL/Linux Install Guide

This is the practical path from GitHub repo to a runnable local Helpy desktop app.

## What You Are Installing

Helpy has two usable forms:

- **Standalone Helpy app**: the AiderDesk-derived Electron app built from this repo.
- **AiderDesk extension pack**: the Helpy extensions copied into upstream AiderDesk.

For the JARVIS workstation goal, prefer the standalone Helpy app. Keep the extension pack as a fallback while the standalone app matures.

## 1. Confirm The Base Environment

Run this inside Ubuntu/WSL:

```bash
node --version
npm --version
git --version
docker --version
docker compose version
```

Expected:

```text
Node 22+
npm installed through NodeSource Node
Docker reachable from WSL
WSLg available for GUI apps
```

Do not install Ubuntu's separate `npm` package if Node came from NodeSource. NodeSource already bundles npm.

## 2. Clone Or Update Helpy

```bash
mkdir -p "$HOME/Tech Projects"
cd "$HOME/Tech Projects"

if [ ! -d "Helpy/.git" ]; then
  git clone https://github.com/Shingenn5/Helpy.git
fi

cd Helpy
git pull origin main
```

## 3. Install Dependencies

```bash
npm install
```

If native Electron dependencies fail, stay in WSL and rerun:

```bash
npm rebuild
```

## 4. Verify Before Packaging

```bash
npm run typecheck
npm run build:extensions
npm run build:mcp
npm run test:mcp -- --no-color
npm run test:node -- --no-color
npm run test:web -- --no-color
npm run build
```

These checks passed in Codex on 2026-05-14.

## 5. Build The Installable Linux App

Run this inside WSL/Linux, not PowerShell:

```bash
npm run build:linux
```

Expected output goes under:

```text
dist/
```

Look for one of:

```text
helpy-*.AppImage
helpy_*_amd64.deb
helpy-*.x86_64.rpm
```

## 6. Install The AppImage Locally

After `dist/` contains an AppImage:

```bash
bash scripts/install-helpy-appimage.sh
```

Or pass a specific file:

```bash
bash scripts/install-helpy-appimage.sh "dist/helpy-0.64.0-dev-x86_64.AppImage"
```

This installs to:

```text
~/Applications/Helpy/Helpy.AppImage
~/.local/share/applications/helpy.desktop
```

Launch with:

```bash
helpy
```

or:

```bash
~/Applications/Helpy/Helpy.AppImage
```

## 7. Configure The Local Model Backend

Default values:

```text
Endpoint: http://127.0.0.1:8080/v1
Model: /home/shingen/AI_Core/models/Qwen3.6-35B-A3B-UD-IQ2_M.gguf
Vault: /home/shingen/ObsidianVault
```

Start Docker manually once:

```bash
cd "$HOME/Tech Projects/Helpy"
docker compose -f docker-compose.yml up -d
curl http://127.0.0.1:8080/v1/models
```

If the response says `Loading model`, wait and retry. Your RTX 5060 Ti 16GB should fit the current IQ2 model, but the first load can take a bit.

In the app, use the **Local Backend** panel to start, stop, check health, and view Docker logs.

## 8. Configure Obsidian And Graph Memory

Use this vault:

```text
/home/shingen/ObsidianVault
```

Open the same folder in Obsidian from Windows:

```text
\\wsl.localhost\Ubuntu\home\shingen\ObsidianVault
```

Manual commands inside Helpy/AiderDesk:

```text
/helpy-graphify-update
/helpy-memory-query backend model
/helpy-open-vault
/helpy-log-snapshot
```

Graph output should appear at:

```text
/home/shingen/ObsidianVault/graphify-out/graph.json
/home/shingen/ObsidianVault/graphify-out/GRAPH_REPORT.md
/home/shingen/ObsidianVault/graphify-out/graph.html
```

## 9. OpenClaw

OpenClaw is currently a process bridge. In the Helpy dashboard, set:

```text
OpenClaw executable path
OpenClaw working directory
```

Config is stored at:

```text
~/.helpy/openclaw.json
```

If no path is set, the app should show `not-configured`, not crash.

## 10. Voice

Voice is push-to-talk scaffolding only.

Config is stored at:

```text
~/.helpy/voice.json
```

If no local STT command is set, pressing the microphone should report:

```text
Voice not configured
```

No wake word or always-listening mode exists in this baseline.

## 11. First Acceptance Test

1. Launch Helpy.
2. Start or verify local backend health.
3. Open a tiny test project.
4. Create a new task.
5. Send:

```text
Reply with exactly: Helpy test ok. Do not inspect files.
```

Expected:

```text
Helpy test ok.
```

Then add one file to context and ask what it does.

## Troubleshooting

If packaging fails from Windows:

```text
node-gyp does not support cross-compiling native modules from source
```

That means you ran `npm run build:linux` outside Linux/WSL. Run it from Ubuntu/WSL.

If the model overflows context:

```text
request exceeds the available context size
```

Clear context, start a new task, and use one context file at a time. The current model context is 32768 tokens.

If Docker health says HTTP 503:

```text
Loading model
```

Wait for llama.cpp logs to show:

```text
main: server is listening on http://0.0.0.0:8080
```

