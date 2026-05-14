#!/usr/bin/env bash
set -euo pipefail

APPIMAGE_PATH="${1:-}"

if [ -z "$APPIMAGE_PATH" ]; then
  APPIMAGE_PATH="$(find dist -maxdepth 1 -type f -iname "*helpy*.AppImage" | sort | tail -1 || true)"
fi

if [ -z "$APPIMAGE_PATH" ] || [ ! -f "$APPIMAGE_PATH" ]; then
  echo "No Helpy AppImage found. Run npm run build:linux first, or pass the AppImage path."
  exit 1
fi

INSTALL_DIR="$HOME/Applications/Helpy"
BIN_DIR="$HOME/.local/bin"
DESKTOP_DIR="$HOME/.local/share/applications"
TARGET="$INSTALL_DIR/Helpy.AppImage"

mkdir -p "$INSTALL_DIR" "$BIN_DIR" "$DESKTOP_DIR"
cp "$APPIMAGE_PATH" "$TARGET"
chmod +x "$TARGET"

cat > "$BIN_DIR/helpy" <<EOF
#!/usr/bin/env bash
exec "$TARGET" "\$@"
EOF
chmod +x "$BIN_DIR/helpy"

cat > "$DESKTOP_DIR/helpy.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Helpy
Comment=Local-first AI workstation
Exec=$TARGET
Terminal=false
Categories=Development;Utility;
StartupWMClass=Helpy
EOF

echo "Installed Helpy AppImage:"
echo "$TARGET"
echo
echo "Launch with:"
echo "helpy"
