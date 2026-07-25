#!/usr/bin/env bash
# Build the macOS desktop app + a drag-to-install .dmg.
#
#   1. PyInstaller-bundle the server into a standalone onedir folder (no venv at runtime).
#   2. Stage it at binaries/sidecar/ for Tauri's `resources` slot (+ sign its Mach-Os).
#   3. `tauri build --bundles app` → OpenWorker.app (resources are copied in).
#   4. Wrap the .app in a compressed .dmg via hdiutil (reliable + headless; Tauri's own
#      bundle_dmg.sh uses Finder AppleScript and fails in non-interactive sessions).
#
# Prerequisites (mirrors build_windows.ps1's header):
#   - Rust (rustup) + Node/npm, and the GUI deps installed (npm ci in surfaces/gui).
#   - A Python venv at .venv (repo root) with this package installed editable, plus the
#     build-only deps:
#       python3 -m venv .venv
#       .venv/bin/pip install -e . pyinstaller tzdata typer
#     `typer` is needed only at BUILD time: PyInstaller walks the `mcp` package and
#     `mcp.cli` calls sys.exit() at import if typer is absent, which aborts the freeze.
#     (aisuite installs like any other dependency — git-pinned in pyproject.toml.)
#
# SIGNING: set APPLE_SIGNING_IDENTITY to a "Developer ID Application: … (TEAMID)" identity and
# `tauri build` signs the .app + the bundled sidecar with it. Left unset → UNSIGNED (first launch
# needs right-click → Open).
#
# NOTARIZATION (step 5, runs only when the identity is set): signs the .dmg CONTAINER, submits
# to Apple's notary service, staples the ticket, and verifies with spctl. Signing alone is NOT
# enough for public downloads — un-notarized apps get macOS's "Apple could not verify… Move to
# Trash?" dialog. Auth is an App Store Connect API key via NOTARYTOOL_API_KEY_PATH /
# NOTARYTOOL_API_KEY_ID / NOTARYTOOL_API_ISSUER_ID — exported, or in $OCW_NOTARY_ENV, or in
# `.ocw-notary.env` one directory ABOVE the repo (shared by every clone/worktree on a machine,
# never committed). Vars missing → the DMG is still produced, with a loud warning.
#
# LOCAL ITERATION: leave APPLE_SIGNING_IDENTITY unset for a fully unsigned dev build, or set
# OCW_SKIP_NOTARIZE=1 to sign but skip the slow notary round-trip. Neither is distributable.
#
# Experimental (use-at-your-own-risk) connectors are EXCLUDED from this build by default —
# the spec strips coworker.connectors.experimental. Self-builders can opt in with:
#   COWORKER_EXPERIMENTAL=1 ./build_dmg.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
PLATFORM="$(cd "$HERE/.." && pwd)"
GUI="$PLATFORM/surfaces/gui"
APP="OpenWorker"
# Single source of truth for the version: tauri.conf.json (also stamps the bundle).
VERSION="$(node -p "require('$GUI/src-tauri/tauri.conf.json').version")"
TRIPLE="$(rustc -vV | sed -n 's/host: //p')"   # e.g. aarch64-apple-darwin
ARCH="${TRIPLE%%-*}"

# CI keychain bootstrap: on a fresh runner the Developer ID cert exists only as the
# APPLE_CERTIFICATE secret (base64 .p12) — import it into a throwaway keychain so the
# sidecar codesign calls below can find the identity ("no identity found", v0.1.3 run
# 29773913622). tauri build does its OWN import later; this covers our signing, which
# runs first. Local builds never set APPLE_CERTIFICATE — the identity already lives in
# the login keychain, and this block is skipped.
if [ -n "${APPLE_CERTIFICATE:-}" ] && [ -n "${APPLE_SIGNING_IDENTITY:-}" ]; then
  echo "==> importing signing certificate into a temporary keychain"
  KC_DIR="$(mktemp -d)"
  KC="$KC_DIR/ocw-signing.keychain-db"
  KC_PASS="$(openssl rand -hex 16)"
  security create-keychain -p "$KC_PASS" "$KC"
  security set-keychain-settings -lut 21600 "$KC"
  security unlock-keychain -p "$KC_PASS" "$KC"
  echo "$APPLE_CERTIFICATE" | base64 -d > "$KC_DIR/cert.p12"
  security import "$KC_DIR/cert.p12" -P "${APPLE_CERTIFICATE_PASSWORD:-}" \
    -A -t cert -f pkcs12 -k "$KC"
  rm -f "$KC_DIR/cert.p12"
  # Allow codesign to use the key headlessly (no UI prompt exists on a runner).
  security set-key-partition-list -S "apple-tool:,apple:" -s -k "$KC_PASS" "$KC" >/dev/null
  security list-keychains -d user -s "$KC" login.keychain-db
fi

echo "==> [1/5] PyInstaller: bundling openworker-server ($TRIPLE)"
"$PLATFORM/.venv/bin/pyinstaller" --noconfirm --clean \
  --distpath "$HERE/dist" --workpath "$HERE/build" "$HERE/openworker-server.spec"

echo "==> [2/5] staging sidecar resources"
# Onedir bundle (exe + _internal/) ships via Tauri `resources` as Contents/Resources/sidecar/
# — onefile's per-launch self-extraction cost 6-7s of boot splash. rm -rf first: cp WRITES
# THROUGH a symlink at the destination (a dev-convenience symlink in the old externalBin slot
# once clobbered another worktree's venv console script, caught 2026-07-11); also clears any
# stale onefile binary from pre-onedir builds.
mkdir -p "$GUI/src-tauri/binaries"
rm -rf "$GUI/src-tauri/binaries/sidecar" "$GUI/src-tauri/binaries/openworker-server-$TRIPLE"
# -L (dereference): Tauri's resource bundler flattens symlinks into duplicate REAL files.
# Python.framework's symlinks (Python -> Versions/Current/Python, …) therefore arrive in
# the .app as standalone copies whose framework-context signatures don't validate outside
# the bundle — notarization rejected them twice (submissions f73463f3, ca30027a,
# 2026-07-16). Dereferencing at staging makes what we SIGN byte-identical to what tauri
# COPIES, and every Mach-O below gets a plain file signature that stands alone.
cp -RL "$HERE/dist/openworker-server" "$GUI/src-tauri/binaries/sidecar"
if [ -n "$(find "$GUI/src-tauri/binaries/sidecar" -type l | head -1)" ]; then
  echo "ERROR: symlinks survived sidecar staging — tauri would flatten them into unsigned copies" >&2
  exit 1
fi
# Drop the pseudo-framework: after dereferencing, Python.framework is just a duplicate of
# _internal/Python (which the PyInstaller bootloader actually loads — verified by running
# the sidecar without it) plus an Info.plist. Any file living under a *.framework/ path
# triggers codesign/notary bundle inference, which can NEVER validate this flattened
# layout — three Invalid notarization verdicts (f73463f3, ca30027a, + one more) before
# this removal. No .framework may ever ship inside the sidecar resources.
rm -rf "$GUI/src-tauri/binaries/sidecar/_internal/Python.framework"
if [ -n "$(find "$GUI/src-tauri/binaries/sidecar" -type d -name "*.framework" | head -1)" ]; then
  echo "ERROR: a .framework appeared in the sidecar — it cannot pass notarization in this layout" >&2
  exit 1
fi
chmod +x "$GUI/src-tauri/binaries/sidecar/openworker-server"

# Sign the sidecar's Mach-O files BEFORE tauri build: `tauri build` signs the .app (sealing
# resources into its signature) but does NOT sign nested binaries inside resources — unsigned
# Mach-Os there fail notarization. Hardened runtime + timestamp on every one, same identity,
# entitlements on the executable (disable-library-validation: the bundled python dylibs carry
# other Team IDs). externalBin used to get this from tauri itself.
if [ -n "${APPLE_SIGNING_IDENTITY:-}" ]; then
  echo "    signing sidecar binaries"
  SIDECAR="$GUI/src-tauri/binaries/sidecar"
  # Every Mach-O gets a plain FILE signature (no framework-bundle signing: the staged
  # tree is fully dereferenced, so each file must validate standalone — that is exactly
  # what the notary service checks). Entitlements only on the entrypoint
  # (disable-library-validation: the bundled python.org dylibs carry another Team ID).
  find "$SIDECAR" -type f ! -name "openworker-server" \
    ! -name "*.py" ! -name "*.pyc" ! -name "*.txt" ! -name "*.pem" ! -name "*.json" \
    -print0 | while IFS= read -r -d '' f; do
    file -b "$f" | grep -q "Mach-O" || continue
    codesign --force --sign "$APPLE_SIGNING_IDENTITY" --timestamp --options runtime "$f"
  done
  codesign --force --sign "$APPLE_SIGNING_IDENTITY" --timestamp --options runtime \
    --entitlements "$GUI/src-tauri/entitlements.plist" "$SIDECAR/openworker-server"
fi

echo "==> [3/5] tauri build (.app)"
# Auto-update artifacts (.app.tar.gz + minisign .sig): produced only when the updater
# signing key is available — from the env (CI secret TAURI_SIGNING_PRIVATE_KEY), or from
# `.ocw-updater.env` one directory above the repo (same convention as the notary env).
# Keyless builds skip the overlay entirely so dev/fork builds keep working; keyless
# RELEASES would strand every install without auto-update, hence the loud warning.
UPDATER_ENV="${OCW_UPDATER_ENV:-$PLATFORM/../.ocw-updater.env}"
if [ -z "${TAURI_SIGNING_PRIVATE_KEY:-}" ] && [ -f "$UPDATER_ENV" ]; then
  # shellcheck disable=SC1090
  source "$UPDATER_ENV"
fi
UPDATER_OVERLAY=()
if [ -n "${TAURI_SIGNING_PRIVATE_KEY:-}" ]; then
  UPDATER_OVERLAY=(--config '{"bundle":{"createUpdaterArtifacts":true}}')
else
  echo "    WARNING: no updater signing key — building WITHOUT auto-update artifacts (not releasable)."
fi
# ${arr[@]+…} guard: plain "${arr[@]}" on an EMPTY array is an "unbound variable"
# under set -u on macOS's stock bash 3.2 — hit by keyless (fresh-clone) builds.
( cd "$GUI" && npm run tauri build -- --bundles app ${UPDATER_OVERLAY[@]+"${UPDATER_OVERLAY[@]}"} )

echo "==> [4/5] hdiutil: wrapping into .dmg"
BUNDLE="$GUI/src-tauri/target/release/bundle"
STAGING="$(mktemp -d)"
cp -R "$BUNDLE/macos/$APP.app" "$STAGING/"
ln -s /Applications "$STAGING/Applications"
# Background art (arrow + "drag to Applications") — hidden folder Finder reads for the window.
# A HiDPI TIFF (1x + native 2x reps) so text/arrow stay crisp on Retina; a plain 1x PNG would
# be upscaled and look hazy/pixelated.
mkdir "$STAGING/.background"
cp "$HERE/dmg-background.tiff" "$STAGING/.background/bg.tiff"
DMG="$BUNDLE/dmg/${APP}_${VERSION}_${ARCH}.dmg"
mkdir -p "$(dirname "$DMG")"
rm -f "$DMG"

# A styled install window (fixed size, icons in place, arrow background) instead of Finder's
# default oversized bare window. Needs Finder (AppleScript); if it isn't available (headless CI),
# fall back to the plain compressed image so the build still produces a working .dmg.
#
# Two hard-won correctness points (both caused a *silently* unstyled .dmg before):
#   1. A stale "$APP" volume already mounted → our RW image mounts as "$APP 1", and a hardcoded
#      `tell disk "$APP"` then styles the WRONG (stale) volume, so our image never gets a
#      .DS_Store. Detach any pre-existing mount first, and target the ACTUAL mounted name.
#   2. Finder writes .DS_Store asynchronously — detaching too soon drops it. Poll until it lands.
style_dmg() {
  # Clear any earlier mount of this volume so we don't collide into "$APP 1".
  [ -d "/Volumes/$APP" ] && hdiutil detach "/Volumes/$APP" -force >/dev/null 2>&1 || true
  local rw; rw="$(mktemp -u).dmg"
  hdiutil create -volname "$APP" -srcfolder "$STAGING" -fs HFS+ -format UDRW -ov "$rw" >/dev/null
  local info dev mnt vol
  info="$(hdiutil attach -readwrite -noverify -noautoopen "$rw")"
  dev="$(echo "$info" | grep -Eo '^/dev/disk[0-9]+' | head -1)"
  mnt="$(echo "$info" | grep -Eo '/Volumes/.*$' | head -1)"
  [ -n "$dev" ] && [ -n "$mnt" ] || return 1
  vol="$(basename "$mnt")"   # the real mounted name — what `tell disk` must target
  sleep 1
  # Icons at y≈190 to sit on the background's arrow: app left of it, Applications right. Background
  # via the relative HFS path (`file ".background:bg.tiff"`) so the alias survives a rename; the
  # close→open→update dance forces Finder to actually write the .DS_Store.
  osascript <<OSA || { hdiutil detach "$dev" -force >/dev/null 2>&1 || true; return 1; }
tell application "Finder"
  tell disk "$vol"
    open
    delay 1
    set current view of container window to icon view
    set toolbar visible of container window to false
    set statusbar visible of container window to false
    set the bounds of container window to {200, 120, 840, 543}
    set opts to the icon view options of container window
    set arrangement of opts to not arranged
    set icon size of opts to 96
    set text size of opts to 12
    set background picture of opts to file ".background:bg.tiff"
    set position of item "$APP.app" of container window to {172, 190}
    set position of item "Applications" of container window to {468, 190}
    close
    open
    update without registering applications
    delay 3
  end tell
end tell
OSA
  # Wait for Finder to flush .DS_Store into the image (else the layout is lost).
  local i; for i in $(seq 1 15); do [ -f "$mnt/.DS_Store" ] && break; sleep 1; done
  [ -f "$mnt/.DS_Store" ] || { hdiutil detach "$dev" -force >/dev/null 2>&1 || true; return 1; }
  sync; sync
  hdiutil detach "$dev" -force >/dev/null
  hdiutil convert "$rw" -format UDZO -imagekey zlib-level=9 -o "$DMG" >/dev/null
  rm -f "$rw"
}

if ! style_dmg; then
  echo "    (Finder styling unavailable — writing a plain .dmg)"
  hdiutil create -volname "$APP" -srcfolder "$STAGING" -ov -format UDZO "$DMG" >/dev/null
fi
rm -rf "$STAGING"

if [ "${OCW_SKIP_NOTARIZE:-}" = "1" ] && [ -n "${APPLE_SIGNING_IDENTITY:-}" ]; then
  # Local-iteration escape hatch: sign (seconds) but skip the notary round-trip
  # (minutes). Locally built DMGs carry no quarantine flag, so Gatekeeper never
  # prompts on this machine anyway. NEVER distribute a build made this way.
  echo "==> [5/5] OCW_SKIP_NOTARIZE=1 — signing container, SKIPPING notarize/staple (do not distribute)"
  codesign --sign "$APPLE_SIGNING_IDENTITY" --timestamp "$DMG"
elif [ -n "${APPLE_SIGNING_IDENTITY:-}" ]; then
  echo "==> [5/5] release finishing: sign container → notarize → staple"
  codesign --sign "$APPLE_SIGNING_IDENTITY" --timestamp "$DMG"

  # CI provides the App Store Connect key under tauri's APPLE_API_* names (release.yml)
  # — reuse the same key for the DMG-container notarization below.
  NOTARYTOOL_API_KEY_PATH="${NOTARYTOOL_API_KEY_PATH:-${APPLE_API_KEY_PATH:-}}"
  NOTARYTOOL_API_KEY_ID="${NOTARYTOOL_API_KEY_ID:-${APPLE_API_KEY:-}}"
  NOTARYTOOL_API_ISSUER_ID="${NOTARYTOOL_API_ISSUER_ID:-${APPLE_API_ISSUER:-}}"

  NOTARY_ENV="${OCW_NOTARY_ENV:-$PLATFORM/../.ocw-notary.env}"
  if [ -z "${NOTARYTOOL_API_KEY_PATH:-}" ] && [ -f "$NOTARY_ENV" ]; then
    set -a; # shellcheck disable=SC1090
    source "$NOTARY_ENV"; set +a
  fi
  if [ -n "${NOTARYTOOL_API_KEY_PATH:-}" ] && [ -n "${NOTARYTOOL_API_KEY_ID:-}" ] \
     && [ -n "${NOTARYTOOL_API_ISSUER_ID:-}" ]; then
    xcrun notarytool submit "$DMG" \
      --key "$NOTARYTOOL_API_KEY_PATH" \
      --key-id "$NOTARYTOOL_API_KEY_ID" \
      --issuer "$NOTARYTOOL_API_ISSUER_ID" \
      --wait
    xcrun stapler staple "$DMG"
    # The same check Gatekeeper runs on download — fail the build rather than ship a
    # DMG that greets users with the "Move to Trash" malware dialog.
    spctl -a -t open --context context:primary-signature "$DMG"
    echo "    Gatekeeper: accepted (notarized + stapled)"
  else
    echo "    WARNING: DMG is signed but NOT notarized — public downloads will see the"
    echo "    'Move to Trash' dialog. Provide NOTARYTOOL_API_KEY_PATH/_KEY_ID/_ISSUER_ID"
    echo "    (env, \$OCW_NOTARY_ENV, or $NOTARY_ENV)."
  fi
else
  echo "    (unsigned dev build — set APPLE_SIGNING_IDENTITY for a distributable DMG)"
fi

echo ""
echo "Done → $DMG"
