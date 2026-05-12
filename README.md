# Helpy

Helpy is becoming a local-first JARVIS-style workstation built from the AiderDesk desktop app. It keeps the proven AiderDesk project/task/chat/context-file/diff workflow, while adding Markdown memory, local backend controls, rules storage, an MCP file-context server, OpenClaw process management, voice scaffolding, and a semantic graph layer for Obsidian/Graphify workflows.

## What Helpy Adds

| Extension | Purpose |
|---|---|
| `helpy-vault-logger` | Logs AiderDesk prompts, responses, agent events, tool events, and context files into Markdown. |
| `helpy-graphify-export` | Builds project notes and a semantic `graphify-out/graph.json` from the Markdown vault. |
| `helpy-local-backend` | Adds commands/status for the local llama.cpp Docker backend. |
| `helpy-rules-memory` | Stores personality and workflow rules in Markdown. Prompt injection is off by default for context safety. |
| `helpy-privacy-guard` | Warns about cloud/telemetry wording. Provider blocking is off by default for stability. |

The Electron app also includes a Helpy control-plane dashboard in the header. It shows backend health, Docker compose status, current project, vault/graph stats, OpenClaw status, and local voice setup state.

## Target Setup

Current production target:

```text
WSL2 Ubuntu
AiderDesk AppImage installed separately
Helpy repo: /home/shingen/Tech Projects/Helpy
Obsidian vault: /home/shingen/ObsidianVault
Windows vault path: \\wsl.localhost\Ubuntu\home\shingen\ObsidianVault
llama.cpp endpoint: http://127.0.0.1:8080/v1
model: /home/shingen/AI_Core/models/Qwen3.6-35B-A3B-UD-IQ2_M.gguf
```

## Build The Downloadable App

Helpy can be built as a Linux desktop package/AppImage through the existing Electron Builder setup:

```bash
npm install
npm run build:linux
```

Run this from Linux/WSL, not from a Windows PowerShell checkout. Native Electron modules such as tree-sitter need a real Linux build environment for the Linux artifact.

Build outputs are written under:

```text
dist/
```

For GitHub releases, attach the Linux AppImage or package from `dist/`, include the matching checksum if generated, and copy the release checklist from the bottom of this README.

## Install AiderDesk Extension Pack

Download the Linux AppImage from the AiderDesk releases page:

```text
https://github.com/hotovo/aider-desk/releases
```

For WSL, the x86_64 AppImage is usually the right one. Example:

```bash
mkdir -p "$HOME/Applications/AiderDesk"
cd "$HOME/Applications/AiderDesk"
wget -O AiderDesk.AppImage "https://github.com/hotovo/aider-desk/releases/download/v0.63.0/aider-desk-0.63.0-x86_64.AppImage"
chmod +x AiderDesk.AppImage
./AiderDesk.AppImage
```

If you want to keep using upstream AiderDesk and install Helpy as an extension pack, download the Linux AppImage from the AiderDesk releases page:

Then clone or update this repo:

```bash
mkdir -p "$HOME/Tech Projects"
cd "$HOME/Tech Projects"
git clone https://github.com/Shingenn5/Helpy.git
cd Helpy
```

Install the extension pack into AiderDesk:

```bash
bash scripts/install-helpy-aiderdesk.sh
```

The installer copies extensions into:

```text
~/.aider-desk/extensions
```

It also maps the Helpy vault to:

```text
/home/shingen/ObsidianVault
```

Override if needed:

```bash
HELPY_VAULT_ROOT="/path/to/your/vault" bash scripts/install-helpy-aiderdesk.sh
```

Restart AiderDesk after installing.

## Local Backend

Start the bundled llama.cpp Docker backend:

```bash
cd "/home/shingen/Tech Projects/Helpy"
docker compose -f docker-compose.yml up -d
curl http://127.0.0.1:8080/v1/models
```

In AiderDesk, use an OpenAI-compatible provider pointed at:

```text
http://127.0.0.1:8080/v1
```

The built Helpy app includes a **Local Backend** panel with endpoint, model path, Docker status, backend health, and start/stop/log buttons. Defaults:

```text
Endpoint: http://127.0.0.1:8080/v1
Model: /home/shingen/AI_Core/models/Qwen3.6-35B-A3B-UD-IQ2_M.gguf
Vault: /home/shingen/ObsidianVault
```

## MCP File Context Server

Helpy ships `src/mcp-server/helpy-mcp-server.ts` and builds it with:

```bash
npm run build:mcp
```

Tools exposed:

```text
add_context_file
drop_context_file
get_context_files
get_addable_files
clear_context
run_prompt
search_memory
```

The MCP server only adds normal context files from inside the selected project. Absolute outside-project paths must be marked read-only. `search_memory` reads:

```text
/home/shingen/ObsidianVault/graphify-out/graph.json
```

Override the vault with:

```bash
HELPY_VAULT_ROOT="/path/to/vault"
```

## OpenClaw Bridge

OpenClaw starts as a configurable external process. In the Helpy dashboard, set:

```text
OpenClaw executable path
OpenClaw working directory
```

The app stores this in:

```text
~/.helpy/openclaw.json
```

Then use the dashboard buttons to start, stop, check status, and view logs. If no executable is configured, Helpy shows `not-configured` instead of failing.

## Voice Scaffold

Voice is push-to-talk only in this baseline. There is no wake word and no always-listening loop.

The microphone button remains visible. If no local STT command is configured, pressing it reports:

```text
Voice not configured
```

Local voice settings are stored in:

```text
~/.helpy/voice.json
```

## AiderDesk Commands

Use these inside AiderDesk:

```text
/helpy-open-vault
/helpy-log-snapshot
/helpy-backend-status
/helpy-backend-start
/helpy-backend-stop
/helpy-backend-logs
/helpy-graphify-refresh
/helpy-graphify-update
/helpy-memory-query backend model
/helpy-rules-show
/helpy-rules-add Always prefer local-first workflows
/helpy-rules-open
/helpy-privacy-status
```

## Testing Checklist

1. Start AiderDesk.
2. Create a new task.
3. Send:

```text
hello can you read this
```

4. Confirm the model answers normally.
5. Run:

```text
/helpy-graphify-update
/helpy-memory-query backend model
```

6. Confirm files exist:

```bash
find "/home/shingen/ObsidianVault" -maxdepth 3 -type f | sort | tail -80
cat "/home/shingen/ObsidianVault/graphify-out/GRAPH_REPORT.md"
```

## Production Safety Defaults

Helpy is intentionally conservative by default:

```text
Graph auto-update after prompts: off
Rules injection into prompts: off
Privacy provider blocking: off
Markdown logging: on
Manual semantic graph update: on
Manual memory query: on
```

This prevents local 32k context models from being flooded by rules, logs, or graph content. Use the rules file as durable memory, then enable prompt injection only after the basic workflow is stable.

## Context Overflow Notes

If you see an error like:

```text
request exceeds the available context size
```

reduce AiderDesk context files, clear huge task history, or use a smaller project/task. Helpy does not inject rules or graph content by default, and the built app truncates oversized context-file payloads before sending them to small local models. For quick model tests, use:

```text
Reply with exactly: Helpy test ok. Do not inspect files.
```

Then add one file to context only after the backend is confirmed healthy.

## Graphify Reality

The installed `graphify` CLI on this machine supports:

```text
graphify update <path>
graphify watch <path>
graphify query "<question>"
```

For Markdown-only Helpy vaults, `graphify update .` may report no code files. Helpy handles that by generating its own semantic graph:

```text
/home/shingen/ObsidianVault/graphify-out/graph.json
/home/shingen/ObsidianVault/graphify-out/GRAPH_REPORT.md
/home/shingen/ObsidianVault/graphify-out/graph.html
```

## Development

```bash
npm install
npm run typecheck:helpy --workspace=packages/extensions
npm run build:extensions
npm run build:mcp
npm run typecheck
npm run build:linux
```

## Release Checklist

```text
[ ] npm install passes
[ ] npm run typecheck passes
[ ] npm run build:extensions passes
[ ] npm run build:mcp passes
[ ] npm run build:linux produces a Linux artifact in dist/
[ ] App launches in WSLg/Linux
[ ] Local backend health panel works
[ ] Small prompt does not overflow context
[ ] /helpy-graphify-update writes under /home/shingen/ObsidianVault
[ ] /helpy-memory-query backend model returns graph matches
[ ] OpenClaw not-configured state is clear
[ ] Voice button gracefully reports voice-not-configured
```

## License

Helpy is intended to stay free, local-first, and account-free.
