# Helpy

Helpy is a local-first desktop coding-agent workbench. It is based on [AiderDesk](https://github.com/hotovo/aider-desk), but the goal is different: Helpy should feel like a professional GUI control plane for local agent workflows, not a cloud-provider setup wizard.

The current target stack is:

- Electron, React, TypeScript, Vite, and Node for the desktop app
- Aider/AiderDesk workflow primitives for coding tasks, diffs, project tabs, context files, tasks, and logs
- Docker Compose managed llama.cpp server for local model inference
- OpenAI-compatible endpoint at `http://127.0.0.1:8080/v1`
- Qwen GGUF model default: `Qwen3.6-35B-A3B-UD-IQ2_M.gguf`
- WSL2/Ubuntu/WSLg as the expected development environment
- Markdown/Obsidian session logging as a first-class direction

## What Works Now

- Helpy starts from the mature AiderDesk UI and task workflow instead of the earlier scratch prototype.
- New installs default to a local OpenAI-compatible provider called `Local llama.cpp`.
- The default model path points at the Qwen GGUF model name used on this machine.
- Telemetry and app auto-update defaults are disabled.
- The header now has local backend controls:
  - start llama.cpp Docker Compose backend
  - stop backend
  - health check `/v1/models`
  - show Docker logs
- Root `docker-compose.yml` and `.env.example` are included for the local CUDA llama.cpp backend.

## Install In WSL

Clone inside your project folder:

```bash
cd "/home/shingen/Tech Projects"
git clone https://github.com/Shingenn5/Helpy.git
cd Helpy
```

Install dependencies:

```bash
npm install
```

Create your local env file:

```bash
cp .env.example .env
```

The default `.env.example` already points at:

```text
/home/shingen/AI_Core/models/Qwen3.6-35B-A3B-UD-IQ2_M.gguf
```

Run the desktop app:

```bash
npm run dev
```

In the top-right Helpy backend strip, hit the bolt button to start the local llama.cpp server. The health indicator may show `HTTP 503` or `offline` while the GGUF is still loading; that is normal for large models. Once `/v1/models` responds, it will switch to online.

## Manual Backend Commands

The app uses these under the hood:

```bash
docker compose -f docker-compose.yml up -d
docker compose -f docker-compose.yml ps
docker compose -f docker-compose.yml logs --tail 160
docker compose -f docker-compose.yml down
```

## Building A Linux App

For a local Linux package:

```bash
npm run build:linux
```

Output lands in `dist/`.

## Direction

Helpy is meant to become a replacement for AiderDesk in this local-first workflow. Near-term work:

- make the model picker browse GGUF files visually
- write every task/chat/session to an Obsidian-friendly Markdown database as it happens
- hide or soften cloud-provider-first onboarding
- tune layout/resizing so the UI feels more like a serious workstation
- keep AiderDesk's useful task, diff, context, and git workflow pieces

## Attribution

Helpy is based on AiderDesk by Hotovo and keeps the upstream MIT license.
