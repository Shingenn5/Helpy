# Helpy

Helpy is an AiderDesk extension pack that turns an existing AiderDesk install into a local-first AI workstation.

The goal is simple: keep getting upstream AiderDesk improvements while Helpy adds the local workflow this machine actually needs.

- local llama.cpp backend controls
- Obsidian Markdown session logging
- Graphify-ready project/file/entity notes
- persistent model rules and personality memory
- privacy guardrails that prefer local models and block cloud-ish behavior

This repo contains everything needed to install Helpy into AiderDesk. The important product surface is the extension pack in:

```text
packages/extensions/extensions/helpy-*
```

## Extensions

| Extension | What it does |
|---|---|
| `helpy-vault-logger` | Appends prompts, responses, agent events, files, and tool events into Obsidian Markdown sessions. |
| `helpy-graphify-export` | Writes Graphify-friendly project and context-file notes with frontmatter, tags, and wikilinks. |
| `helpy-local-backend` | Adds status UI and commands for your local llama.cpp Docker Compose backend. |
| `helpy-privacy-guard` | Warns or blocks workflows that look non-local, telemetry-ish, or tunnel/cloud related. |
| `helpy-rules-memory` | Injects persistent rules/personality from an Obsidian Markdown note into model reminders/system prompts. |

## Target Local Setup

Your current working stack is:

```text
WSL2 Ubuntu
Docker Compose
llama.cpp CUDA server
http://127.0.0.1:8080/v1
/home/shingen/AI_Core/models/Qwen3.6-35B-A3B-UD-IQ2_M.gguf
/home/shingen/HelpyVault/Helpy
```

The backend Compose file in this repo is still useful as the local model runtime:

```bash
docker compose -f docker-compose.yml up -d
docker compose -f docker-compose.yml ps
docker compose -f docker-compose.yml logs --tail 120
```

## Install Extensions Into AiderDesk

### Option 1: Install From The AiderDesk Extensions UI

In AiderDesk:

1. Open Settings.
2. Go to Extensions.
3. Add this repository URL:

```text
https://github.com/Shingenn5/Helpy/tree/main/packages/extensions/extensions
```

4. Refresh available extensions.
5. Click install for the Helpy extensions:

```text
Helpy Vault Logger
Helpy Graphify Export
Helpy Local Backend
Helpy Privacy Guard
Helpy Rules Memory
```

That is the button-based install path. AiderDesk clones the repo, scans this folder, and installs each selected extension.

### Option 2: One-Command Local Install

From this repo in WSL:

```bash
bash scripts/install-helpy-aiderdesk.sh
```

From PowerShell:

```powershell
.\scripts\install-helpy-aiderdesk.ps1
```

Restart AiderDesk, or wait for extension hot reload if it is already watching the folder.

The scripts install to upstream AiderDesk's global extension directory:

```text
~/.aider-desk/extensions
```

Set `AIDERDESK_EXTENSIONS_DIR` if your install uses a custom extension folder.

### Option 3: Build The Installer CLI

The package still includes the AiderDesk extension CLI:

```bash
npm install
npm run build:extensions
npx @aiderdesk/extensions install helpy-vault-logger --global
```

The CLI now defaults global installs to:

```text
~/.aider-desk/extensions
```

Project-specific install is also supported:

```bash
mkdir -p .aider-desk/extensions
cp -r /path/to/Helpy/packages/extensions/extensions/helpy-* .aider-desk/extensions/
```

## Useful Commands In AiderDesk

After installation, these slash commands become available inside AiderDesk:

```text
/helpy-open-vault
/helpy-log-snapshot
/helpy-graphify-refresh
/helpy-backend-status
/helpy-backend-start
/helpy-backend-stop
/helpy-backend-logs
/helpy-privacy-status
/helpy-rules-show
/helpy-rules-add
/helpy-rules-open
```

## Persistent Rules

The rules extension creates this file on first load:

```text
/home/shingen/HelpyVault/Helpy/Rules/Helpy Model Rules.md
```

Put personality, coding preferences, privacy rules, and project habits there. The extension injects that Markdown into model reminders/system prompts so your local assistant keeps the same operating style across sessions.

Example:

```markdown
## Personality

- Be direct, practical, and privacy-first.
- Prefer small tested changes over broad rewrites.

## Local Workflow

- Use the local llama.cpp backend by default.
- Write durable session knowledge into Obsidian.
- Keep Graphify links and YAML frontmatter useful.
```

## Environment Overrides

Defaults are tuned for this WSL machine, but you can override them before launching AiderDesk:

```bash
export HELPY_VAULT_ROOT="/home/shingen/HelpyVault/Helpy"
export HELPY_BACKEND_ENDPOINT="http://127.0.0.1:8080/v1"
export HELPY_COMPOSE_FILE="/home/shingen/Tech Projects/Helpy/docker-compose.yml"
export HELPY_MODEL_NAME="Qwen3.6-35B-A3B-UD-IQ2_M.gguf"
```

## Design Decision

Helpy should be maintained as an extension pack first. Core AiderDesk changes should stay rare, small, and upstream-friendly. That is the best way to get the workstation you want without becoming the long-term maintainer of a full desktop fork.

## License

The upstream app code keeps its MIT license. The Helpy extension additions are intended to stay local-first, free, and account-free.
