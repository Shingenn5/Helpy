# Helpy

Helpy is a local-first desktop AI workstation for running coding-agent workflows on a Windows machine with Ubuntu/WSL2 and WSLg.

The goal is not to be another terminal wrapper. Helpy is meant to be a GUI control plane for local model backends, project-aware agent sessions, Docker services, terminal output, diffs, context files, and Obsidian Markdown session logs.

This repo currently contains the MVP v0.1 scaffold: Electron shell, React UI layout, IPC bridge, backend service stubs, mocked streaming, Docker Compose hooks, and Linux packaging config.

## Target Setup

- Host: Windows with Ubuntu/WSL2
- GUI runtime: WSLg
- GPU target: NVIDIA RTX 5060 Ti 16GB
- Local model backend: llama.cpp server through Docker Compose
- OpenAI-compatible endpoint: `http://127.0.0.1:8080/v1`
- Expected model: Qwen 2.5 Coder 14B GGUF
- Workspace root: `/home/shingen/Tech Projects`
- Session logs: Obsidian Markdown vault, planned

## Tech Stack

Helpy is written in JavaScript with Electron, React, Vite, and Node.js.

That is intentional for this version:

- Electron gives us a real installable Linux desktop app under WSLg.
- React is fast enough for a professional control-plane UI when the renderer only handles interface state.
- Node.js is a good fit for IPC, process spawning, Docker Compose control, file access, PTY streaming, and Markdown logging.
- Heavy work should stay out of the React renderer. Model inference runs in llama.cpp, Docker work runs outside the UI process, and future agent processes should be spawned/streamed by the Electron main process.

This is not the right place to run model inference directly inside the UI. The app should orchestrate local services, not become the compute engine.

## Current MVP Features

- Left sidebar with project picker, modes, and settings placeholder
- Top bar with active project and local backend health indicator
- Main chat/agent conversation view with mocked live response stream
- Right panel placeholders for context files and diffs
- Bottom drawer for terminal, Docker, and Aider logs
- Electron IPC bridge between React and the Node backend
- Backend health check for `http://127.0.0.1:8080/v1/models`
- Docker Compose `start`, `stop`, and `status` service hooks
- Markdown session logger scaffold for future Obsidian output
- Linux AppImage and `.deb` packaging through `electron-builder`

## Development

```bash
npm install
npm run dev
```

## Build A Linux Installable

Run packaging from Ubuntu/WSL, not Windows PowerShell. Electron packaging is OS-sensitive, and Linux artifacts should be produced from Linux.

```bash
cd "/mnt/c/Users/elliott/Documents/Codex/2026-04-30/role-objective-you-are-an-expert"
npm install
npm run dist:linux
```

Artifacts land in `release/`.

Install the `.deb`:

```bash
sudo apt install ./release/*.deb
```

Or run the AppImage:

```bash
chmod +x ./release/*.AppImage
./release/*.AppImage
```

## Useful Scripts

```bash
npm run dev
npm run build
npm run pack
npm run dist:linux
```

## Repo

GitHub remote:

```bash
https://github.com/Shingenn5/Helpy
```

## Next Engineering Steps

- Replace mocked stream with real llama.cpp/OpenAI-compatible chat streaming.
- Add configurable backend URL, model name, workspace root, and Obsidian vault path.
- Add a real PTY layer for shell, Docker, and Aider logs.
- Make Docker Compose controls project-aware instead of using the app cwd.
- Implement Markdown session logging with YAML frontmatter.
- Add GitHub Actions to build Linux release artifacts automatically.
