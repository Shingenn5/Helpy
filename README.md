# Local AI Workstation

MVP v0.1 Electron + React desktop shell for a local-first agent workstation.

## Run in dev

```bash
npm install
npm run dev
```

## Build installable Linux app inside WSL

Run these from Ubuntu/WSL, not from Windows PowerShell.

```bash
cd "/mnt/c/Users/elliott/Documents/Codex/2026-04-30/role-objective-you-are-an-expert"
npm install
npm run dist:linux
```

Artifacts land in `release/`.

Install the Debian package:

```bash
sudo apt install ./release/*.deb
```

Or run the AppImage:

```bash
chmod +x ./release/*.AppImage
./release/*.AppImage
```

## GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/local-agent-workstation.git
git branch -M main
git push -u origin main
```
