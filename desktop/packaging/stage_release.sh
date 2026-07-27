#!/usr/bin/env bash
# Collect this machine's tauri bundle output into the shared release staging directory
# under the stable asset names the manifests and the website reference.
#
#   macOS   (after packaging/build_dmg.sh):      bash packaging/stage_release.sh
#   Windows (after packaging/build_windows.ps1): bash packaging/stage_release.sh   # Git Bash
#
# Both platforms stage into desktop/release/<version>/. Because macOS and Windows build on
# different machines, copy the Windows folder onto the Mac (or vice versa) before running
# publish_release.sh — it refuses to publish a manifest for artifacts it cannot hash.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
PLATFORM="$(cd "$HERE/.." && pwd)"
GUI="$PLATFORM/surfaces/gui"
BUNDLE="$GUI/src-tauri/target/release/bundle"
# Windows installs ship `python.exe` only; `python3` there resolves to the Microsoft Store stub,
# which prints an install advert to stdout instead of running anything.
case "$(uname -s)" in
  Darwin|Linux) PY="python3" ;;
  *) PY="python" ;;
esac
VERSION="$("$PY" -c "import json,sys; print(json.load(open(sys.argv[1]))['version'])" "$GUI/src-tauri/tauri.conf.json")"
STAGE="${BOXAI_RELEASE_STAGE:-$PLATFORM/release/$VERSION}"

mkdir -p "$STAGE"

# Copy a build output under its stable name, plus its updater signature when tauri produced
# one. A missing .sig is not fatal here: publish_release.sh is what refuses to ship it.
stage() {
  local src="$1" dest="$2"
  [ -f "$src" ] || return 0
  cp -f "$src" "$STAGE/$dest"
  echo "    $dest"
  if [ -f "$src.sig" ]; then
    cp -f "$src.sig" "$STAGE/$dest.sig"
    echo "    $dest.sig"
  fi
}

echo "==> staging BoxAI Desktop $VERSION into $STAGE"

case "$(uname -s)" in
  Darwin)
    stage "$(ls "$BUNDLE"/dmg/*.dmg 2>/dev/null | head -1)" "BoxAI-Desktop-macos-arm64.dmg"
    stage "$BUNDLE/macos/BoxAI Desktop.app.tar.gz" "BoxAI-Desktop-macos-arm64.app.tar.gz"
    ;;
  *)
    stage "$(ls "$BUNDLE"/nsis/*.exe 2>/dev/null | head -1)" "BoxAI-Desktop-windows-setup.exe"
    stage "$(ls "$BUNDLE"/msi/*.msi 2>/dev/null | head -1)" "BoxAI-Desktop-windows.msi"
    ;;
esac

echo ""
ls -la "$STAGE"
