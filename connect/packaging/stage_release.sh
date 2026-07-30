#!/usr/bin/env bash
# Collect this machine's tauri bundle output into the shared release staging directory
# under the stable asset names the manifests and the website reference.
#
#   macOS   (after `pnpm tauri build`):  bash packaging/stage_release.sh
#   Windows (after `pnpm tauri build`):  bash packaging/stage_release.sh   # Git Bash
#
# Both platforms stage into connect/release/<version>/. Because macOS and Windows build on
# different machines, copy the Windows folder onto the Mac (or vice versa) before running
# `desktop/packaging/publish_release.sh` with BOXAI_RELEASE_PRODUCT=connect — it refuses to
# publish a manifest for artifacts it cannot hash.
#
# Unlike BoxAI Desktop, Connect ships both Mac architectures. A cross-compiled build lands
# under target/<triple>/release/bundle, so each arch is read from its own triple directory.
# The bare target/release/bundle is only consulted for the arch this machine builds
# natively — reading it for the other arch would stage the wrong binary under the right name.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
CONNECT="$(cd "$HERE/.." && pwd)"
TAURI="$CONNECT/src-tauri"
# Windows installs ship `python.exe` only; `python3` there resolves to the Microsoft Store stub,
# which prints an install advert to stdout instead of running anything.
case "$(uname -s)" in
  Darwin|Linux) PY="python3" ;;
  *) PY="python" ;;
esac
VERSION="$("$PY" -c "import json,sys; print(json.load(open(sys.argv[1]))['version'])" "$TAURI/tauri.conf.json")"
STAGE="${BOXAI_RELEASE_STAGE:-$CONNECT/release/$VERSION}"

NATIVE_BUNDLE="$TAURI/target/release/bundle"
ARM_BUNDLE="$TAURI/target/aarch64-apple-darwin/release/bundle"
X64_BUNDLE="$TAURI/target/x86_64-apple-darwin/release/bundle"

mkdir -p "$STAGE"

# The first existing file matching any of the given globs.
#
# Installer globs must be pinned to $VERSION by the caller. The bundle directory is never
# cleaned between builds, so a previous version's installer sits right next to this one's;
# an unpinned glob would pick the alphabetically-first file and stage the old build under
# the new name. The download page would then serve the old app while the updater shipped
# the new one. Staging nothing is recoverable; staging the wrong build silently is not.
first_match() {
  local pattern hit
  for pattern in "$@"; do
    # shellcheck disable=SC2086
    hit="$(ls $pattern 2>/dev/null | head -1)"
    if [ -n "$hit" ]; then
      echo "$hit"
      return 0
    fi
  done
}

# Copy a build output under its stable name, plus its updater signature when tauri produced
# one. A missing .sig is not fatal here: publish_release.sh is what refuses to ship it.
stage() {
  local src="$1" dest="$2"
  [ -n "$src" ] && [ -f "$src" ] || return 0
  cp -f "$src" "$STAGE/$dest"
  echo "    $dest"
  if [ -f "$src.sig" ]; then
    cp -f "$src.sig" "$STAGE/$dest.sig"
    echo "    $dest.sig"
  fi
}

echo "==> staging BoxAI Connect $VERSION into $STAGE"

case "$(uname -s)" in
  Darwin)
    arm_roots=("$ARM_BUNDLE")
    x64_roots=("$X64_BUNDLE")
    if [ "$(uname -m)" = "arm64" ]; then
      arm_roots+=("$NATIVE_BUNDLE")
    else
      x64_roots+=("$NATIVE_BUNDLE")
    fi

    stage "$(first_match "${arm_roots[@]/%//dmg/*_${VERSION}_*.dmg}")" "BoxAI-Connect-macos-arm64.dmg"
    stage "$(first_match "${arm_roots[@]/%//macos/BoxAI Connect.app.tar.gz}")" "BoxAI-Connect-macos-arm64.app.tar.gz"
    stage "$(first_match "${x64_roots[@]/%//dmg/*_${VERSION}_*.dmg}")" "BoxAI-Connect-macos-x64.dmg"
    stage "$(first_match "${x64_roots[@]/%//macos/BoxAI Connect.app.tar.gz}")" "BoxAI-Connect-macos-x64.app.tar.gz"
    ;;
  *)
    stage "$(first_match "$NATIVE_BUNDLE/nsis/*_${VERSION}_*.exe")" "BoxAI-Connect-windows-setup.exe"
    stage "$(first_match "$NATIVE_BUNDLE/msi/*_${VERSION}_*.msi")" "BoxAI-Connect-windows.msi"
    ;;
esac

echo ""
ls -la "$STAGE"
