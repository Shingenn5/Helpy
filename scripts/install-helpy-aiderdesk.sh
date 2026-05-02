#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="${AIDERDESK_EXTENSIONS_DIR:-$HOME/.aider-desk/extensions}"

mkdir -p "$TARGET_DIR"
cp -R "$ROOT_DIR"/packages/extensions/extensions/helpy-* "$TARGET_DIR"/

echo "Helpy extensions installed to: $TARGET_DIR"
echo "Restart AiderDesk, or wait for extension hot reload."
echo
echo "Installed:"
find "$TARGET_DIR" -maxdepth 1 -type d -name 'helpy-*' -printf '  - %f\n' | sort
