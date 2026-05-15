# Helpy As A One-Download AiderDesk Extension Pack

Yes, this is the cleanest way to make Helpy easy to use with upstream AiderDesk.

The goal is:

```text
Download one Helpy extension pack
Run one installer script
Restart AiderDesk
All Helpy extensions appear and point at the right vault
```

This keeps AiderDesk updateable while Helpy owns the local-first workstation layer.

## What The Pack Contains

The bundle contains only the Helpy extensions:

```text
helpy-vault-logger
helpy-graphify-export
helpy-local-backend
helpy-rules-memory
helpy-privacy-guard
```

It also includes:

```text
manifest.json
install.sh
install.ps1
README.md
```

## Build The Pack

From the full Helpy repo:

```bash
cd "$HOME/Tech Projects/Helpy"
git pull origin main
npm install
npm run build:extensions
bash scripts/package-helpy-aiderdesk-pack.sh
```

Output:

```text
dist/helpy-aiderdesk-extension-pack-<version>/
dist/helpy-aiderdesk-extension-pack-<version>.tar.gz
dist/helpy-aiderdesk-extension-pack-<version>.zip
```

If `zip` is not installed, the `.tar.gz` is still created.

## Install From The Pack

Unpack the release asset, then run:

```bash
bash install.sh
```

Optional custom vault:

```bash
HELPY_VAULT_ROOT="/home/shingen/ObsidianVault" bash install.sh
```

Default install target:

```text
~/.aider-desk/extensions
```

Default vault:

```text
~/ObsidianVault
```

Restart AiderDesk after installing.

## Why This Is Better

This gives you two clean lanes:

1. **Use AiderDesk as the base app** and install Helpy as a small extension pack.
2. **Use standalone Helpy** when you want the JARVIS workstation shell and downloadable app.

The extension pack is the lowest-maintenance path because AiderDesk can keep updating normally.

## GitHub Release Checklist

Attach these to a GitHub release:

```text
helpy-aiderdesk-extension-pack-<version>.tar.gz
helpy-aiderdesk-extension-pack-<version>.zip
```

Release notes should include:

```text
1. Download the extension pack.
2. Extract it.
3. Run bash install.sh in WSL/Linux.
4. Restart AiderDesk.
5. Run /helpy-log-snapshot and /helpy-graphify-update to verify.
```

