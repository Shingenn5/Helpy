# Helpy

Helpy is a local-first extension pack for AiderDesk. It keeps upstream AiderDesk as the GUI and agent runner, while Helpy adds Markdown memory, local backend controls, rules storage, privacy defaults, and a semantic graph layer for Obsidian/Graphify workflows.

## What Helpy Adds

| Extension | Purpose |
|---|---|
| `helpy-vault-logger` | Logs AiderDesk prompts, responses, agent events, tool events, and context files into Markdown. |
| `helpy-graphify-export` | Builds project notes and a semantic `graphify-out/graph.json` from the Markdown vault. |
| `helpy-local-backend` | Adds commands/status for the local llama.cpp Docker backend. |
| `helpy-rules-memory` | Stores personality and workflow rules in Markdown. Prompt injection is off by default for context safety. |
| `helpy-privacy-guard` | Warns about cloud/telemetry wording. Provider blocking is off by default for stability. |

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

## Install AiderDesk

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

## Install Helpy Extensions

Clone or update this repo:

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

reduce AiderDesk context files, clear huge task history, or use a smaller project/task. Helpy no longer injects rules or graph content by default, so this error usually means the active AiderDesk task/project context is too large for the model.

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
```

## License

Helpy is intended to stay free, local-first, and account-free.
