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

# The bundle directory is never cleaned between builds, so a previous version's installer
# sits right next to this one's. Tauri puts the version in every bundle filename, so pin the
# glob to it: an unpinned `ls | head -1` picks the alphabetically-first file, which staged
# 0.1.6's .dmg under 0.1.7's name — the download page would have served the old app while
# the updater shipped the new one. Staging nothing is recoverable; staging the wrong build
# silently is not.
bundle_for_this_version() {
  local dir="$1" ext="$2" match
  match="$(ls "$dir"/*_"$VERSION"_*."$ext" 2>/dev/null | head -1)"
  if [ -z "$match" ]; then
    echo "    (no $ext for $VERSION in $dir — build it first)" >&2
    return 0
  fi
  echo "$match"
}

echo "==> staging BoxAI Desktop $VERSION into $STAGE"

case "$(uname -s)" in
  Darwin)
    stage "$(bundle_for_this_version "$BUNDLE/dmg" dmg)" "BoxAI-Desktop-macos-arm64.dmg"
    stage "$BUNDLE/macos/BoxAI Desktop.app.tar.gz" "BoxAI-Desktop-macos-arm64.app.tar.gz"
    ;;
  *)
    stage "$(bundle_for_this_version "$BUNDLE/nsis" exe)" "BoxAI-Desktop-windows-setup.exe"
    stage "$(bundle_for_this_version "$BUNDLE/msi" msi)" "BoxAI-Desktop-windows.msi"
    ;;
esac

echo ""
ls -la "$STAGE"
