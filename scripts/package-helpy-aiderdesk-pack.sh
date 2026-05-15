#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(node -p "require('$ROOT_DIR/package.json').version")"
PACK_NAME="helpy-aiderdesk-extension-pack-$VERSION"
OUT_DIR="$ROOT_DIR/dist/$PACK_NAME"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR/extensions"

cp -R "$ROOT_DIR"/packages/extensions/extensions/helpy-* "$OUT_DIR/extensions/"

cat > "$OUT_DIR/manifest.json" <<EOF
{
  "name": "Helpy AiderDesk Extension Pack",
  "version": "$VERSION",
  "description": "Local-first AiderDesk extensions for Markdown memory, Graphify export, local backend controls, rules, and privacy defaults.",
  "defaultVaultRoot": "\$HOME/ObsidianVault",
  "extensions": [
    "helpy-vault-logger",
    "helpy-graphify-export",
    "helpy-local-backend",
    "helpy-rules-memory",
    "helpy-privacy-guard"
  ]
}
EOF

cat > "$OUT_DIR/install.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

BUNDLE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${AIDERDESK_EXTENSIONS_DIR:-$HOME/.aider-desk/extensions}"
VAULT_ROOT="${HELPY_VAULT_ROOT:-$HOME/ObsidianVault}"

mkdir -p "$TARGET_DIR"
cp -R "$BUNDLE_DIR"/extensions/helpy-* "$TARGET_DIR"/

node - "$TARGET_DIR" "$VAULT_ROOT" <<'NODE'
const fs = require('fs');
const path = require('path');

const [targetDir, vaultRoot] = process.argv.slice(2);
const configs = [
  ['helpy-vault-logger', { vaultRoot, sessionsDir: 'Sessions', appendToolEvents: true, appendFileEvents: true }],
  ['helpy-graphify-export', { vaultRoot, graphDir: 'Graph', graphifyCommand: 'graphify', graphifyOutDir: 'graphify-out', autoUpdateOnPrompt: false }],
  ['helpy-rules-memory', { vaultRoot, rulesFile: 'Rules/Helpy Model Rules.md', injectIntoPrompts: false }],
  ['helpy-privacy-guard', { blockCloudProviders: false }],
];

for (const [extension, defaults] of configs) {
  const configPath = path.join(targetDir, extension, 'config.json');
  let current = {};
  if (fs.existsSync(configPath)) {
    try {
      current = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
      current = {};
    }
  }
  const next = { ...defaults, ...current };
  if ('vaultRoot' in defaults) next.vaultRoot = vaultRoot;
  if (extension === 'helpy-graphify-export') next.autoUpdateOnPrompt = false;
  if (extension === 'helpy-rules-memory') next.injectIntoPrompts = false;
  if (extension === 'helpy-privacy-guard') next.blockCloudProviders = false;
  fs.writeFileSync(configPath, JSON.stringify(next, null, 2));
}
NODE

echo "Helpy extensions installed to: $TARGET_DIR"
echo "Helpy vault root: $VAULT_ROOT"
echo "Restart AiderDesk."
find "$TARGET_DIR" -maxdepth 1 -type d -name 'helpy-*' -printf '  - %f\n' | sort
EOF

cat > "$OUT_DIR/install.ps1" <<'EOF'
$ErrorActionPreference = "Stop"

$bundleDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$targetDir = if ($env:AIDERDESK_EXTENSIONS_DIR) {
  $env:AIDERDESK_EXTENSIONS_DIR
} else {
  Join-Path $HOME ".aider-desk\extensions"
}
$vaultRoot = if ($env:HELPY_VAULT_ROOT) {
  $env:HELPY_VAULT_ROOT
} else {
  Join-Path $HOME "ObsidianVault"
}

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

Get-ChildItem -Path (Join-Path $bundleDir "extensions") -Directory -Filter "helpy-*" | ForEach-Object {
  $destination = Join-Path $targetDir $_.Name
  if (Test-Path $destination) {
    Remove-Item -Recurse -Force -LiteralPath $destination
  }
  Copy-Item -Recurse -Force -LiteralPath $_.FullName -Destination $destination
}

Write-Host "Helpy extensions installed to: $targetDir"
Write-Host "Helpy vault root: $vaultRoot"
Write-Host "Restart AiderDesk."
EOF

cat > "$OUT_DIR/README.md" <<EOF
# Helpy AiderDesk Extension Pack

This bundle installs the Helpy extensions into an existing AiderDesk install.

## Linux / WSL

\`\`\`bash
bash install.sh
\`\`\`

Optional custom vault:

\`\`\`bash
HELPY_VAULT_ROOT="/home/shingen/ObsidianVault" bash install.sh
\`\`\`

## Windows PowerShell

\`\`\`powershell
.\install.ps1
\`\`\`

## Installed Extensions

- helpy-vault-logger
- helpy-graphify-export
- helpy-local-backend
- helpy-rules-memory
- helpy-privacy-guard

Restart AiderDesk after installing.
EOF

chmod +x "$OUT_DIR/install.sh"

(
  cd "$ROOT_DIR/dist"
  tar -czf "$PACK_NAME.tar.gz" "$PACK_NAME"
  if command -v zip >/dev/null 2>&1; then
    zip -qr "$PACK_NAME.zip" "$PACK_NAME"
  fi
)

echo "Built Helpy AiderDesk extension pack:"
echo "$OUT_DIR"
echo "$ROOT_DIR/dist/$PACK_NAME.tar.gz"
if [ -f "$ROOT_DIR/dist/$PACK_NAME.zip" ]; then
  echo "$ROOT_DIR/dist/$PACK_NAME.zip"
fi
