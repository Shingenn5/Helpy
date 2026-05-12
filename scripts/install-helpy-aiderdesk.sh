#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="${AIDERDESK_EXTENSIONS_DIR:-$HOME/.aider-desk/extensions}"

mkdir -p "$TARGET_DIR"
cp -R "$ROOT_DIR"/packages/extensions/extensions/helpy-* "$TARGET_DIR"/

if [[ -n "${HELPY_VAULT_ROOT:-}" ]]; then
  node - "$TARGET_DIR" "$HELPY_VAULT_ROOT" <<'NODE'
const fs = require('fs');
const path = require('path');

const [targetDir, vaultRoot] = process.argv.slice(2);
const configs = [
  ['helpy-vault-logger', { vaultRoot, sessionsDir: 'Sessions', appendToolEvents: true, appendFileEvents: true }],
  ['helpy-graphify-export', { vaultRoot, graphDir: 'Graph', graphifyCommand: 'graphify', graphifyOutDir: 'graphify-out', autoUpdateOnPrompt: true }],
  ['helpy-rules-memory', { vaultRoot, rulesFile: 'Rules/Helpy Model Rules.md' }],
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
  fs.writeFileSync(configPath, JSON.stringify({ ...defaults, ...current, vaultRoot }, null, 2));
}
NODE
  echo "Synced Helpy vault root to: $HELPY_VAULT_ROOT"
fi

echo "Helpy extensions installed to: $TARGET_DIR"
echo "Restart AiderDesk, or wait for extension hot reload."
echo
echo "Installed:"
find "$TARGET_DIR" -maxdepth 1 -type d -name 'helpy-*' -printf '  - %f\n' | sort
