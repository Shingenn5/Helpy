# Helpy

Helpy is a local-first coding agent workbench derived from [AiderDesk](https://github.com/hotovo/aider-desk).

The current direction is simple: keep AiderDesk's professional workflow foundation, then adapt it for this machine and workflow:

- Ubuntu/WSL2 with WSLg
- local llama.cpp Docker backend
- Qwen GGUF models
- project roots under `/home/shingen/Tech Projects`
- Obsidian Markdown session logging
- a GUI-first replacement for AiderDesk tuned for local-first coding-agent work

## Current State

`main` is now based on upstream AiderDesk.

The previous from-scratch Helpy prototype is preserved on:

```bash
helpy-prototype
```

That branch contains the earlier Docker Compose controls, GGUF picker, and Markdown logging prototype. Those ideas should be ported into this AiderDesk-derived base deliberately.

## Attribution

Helpy is based on AiderDesk by Hotovo and keeps the upstream MIT license. Upstream project:

```text
https://github.com/hotovo/aider-desk
```

## Development

Install dependencies:

```bash
npm install
```

Run in development:

```bash
npm run dev
```

Build:

```bash
npm run build
```

## Next Helpy Work

- Verify upstream AiderDesk builds and runs in WSLg.
- Rebrand the UI from AiderDesk to Helpy without breaking package internals.
- Port local llama.cpp Docker controls from `helpy-prototype`.
- Port GGUF model picker from `helpy-prototype`.
- Add Obsidian Markdown session logging.
- Set local OpenAI-compatible provider defaults for `http://127.0.0.1:8080/v1`.
- Remove or hide cloud/provider features that do not fit the local-first workflow.
