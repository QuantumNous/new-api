#!/usr/bin/env bash
# Cloud-only bootstrap for the Orbit fork; leaves upstream application code intact.
set -euo pipefail

repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
state=${ORBIT_CLOUD_STATE:-"$repo/.cache/orbit"}
mkdir -p "$state"
state=$(cd "$state" && pwd)
case "$(uname -s)-$(uname -m)" in
  Linux-x86_64) ;;
  *) echo 'This bootstrap supports Linux x86_64 cloud workspaces.' >&2; exit 1 ;;
esac
for cmd in curl python3 tar unzip sha256sum awk git; do
  command -v "$cmd" >/dev/null || { echo "Missing prerequisite: $cmd" >&2; exit 1; }
done
go_version=$(awk '$1 == "go" { print $2; exit }' "$repo/go.mod")
bun_version=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["packageManager"].split("@")[1])' "$repo/web/package.json")
mkdir -p "$state/tools"
download=$(mktemp -d "$state/download.XXXXXX")
trap 'rm -rf "$download"' EXIT

if [[ ! -x "$state/tools/go/bin/go" ]] || [[ "$("$state/tools/go/bin/go" env GOVERSION)" != "go$go_version" ]]; then
  curl -fsSL --retry 2 "https://go.dev/dl/?mode=json&include=all" -o "$download/go.json"
  curl -fsSL --retry 2 "https://go.dev/dl/go$go_version.linux-amd64.tar.gz" -o "$download/go.tar.gz"
  python3 - "$download" "$go_version" <<'PY'
import hashlib, json, pathlib, sys
directory, version = pathlib.Path(sys.argv[1]), sys.argv[2]
release = next(r for r in json.loads((directory / 'go.json').read_text()) if r['version'] == 'go' + version)
asset = next(f for f in release['files'] if f['filename'] == f'go{version}.linux-amd64.tar.gz')
with (directory / 'go.tar.gz').open('rb') as archive:
    digest = hashlib.file_digest(archive, 'sha256').hexdigest()
if digest != asset['sha256']:
    raise SystemExit('Go archive checksum mismatch')
PY
  tar -xzf "$download/go.tar.gz" -C "$download"
  # Replace only this bootstrap's dedicated toolchain directory.
  rm -rf "$state/tools/go"
  mv "$download/go" "$state/tools/go"
fi
if [[ ! -x "$state/tools/bun-linux-x64/bun" ]] || [[ "$("$state/tools/bun-linux-x64/bun" --version)" != "$bun_version" ]]; then
  release="https://github.com/oven-sh/bun/releases/download/bun-v$bun_version"
  curl -fsSL --retry 2 "$release/bun-linux-x64.zip" -o "$download/bun-linux-x64.zip"
  curl -fsSL --retry 2 "$release/SHASUMS256.txt" -o "$download/SHASUMS256.txt"
  (cd "$download"; awk '$2 == "bun-linux-x64.zip" || $2 == "*bun-linux-x64.zip"' SHASUMS256.txt > bun.sha256; test -s bun.sha256; sha256sum -c bun.sha256)
  unzip -qo "$download/bun-linux-x64.zip" -d "$state/tools"
fi

{
  printf 'export PATH=%q:%q:$PATH\n' "$state/tools/go/bin" "$state/tools/bun-linux-x64"
  printf 'export GOPATH=%q\n' "$state/go-path"
  printf 'export GOMODCACHE=%q\n' "$state/go-mod"
  printf 'export GOCACHE=%q\n' "$state/go-cache"
  printf 'export BUN_INSTALL_CACHE_DIR=%q\n' "$state/bun-cache"
  printf 'export GOWORK=off\nexport GOMAXPROCS=2\nexport GOFLAGS=-p=2\nexport GOTELEMETRY=off\n'
} > "$state/env.sh"
source "$state/env.sh"
go version
bun --version
for module in . relaykit tokenkit; do
  printf 'Downloading Go dependencies: %s\n' "$module"
  (cd "$repo/$module"; go mod download)
done
(cd "$repo/web"; bun install --frozen-lockfile)
printf 'Setup complete. In each cloud terminal: source %q\n' "$state/env.sh"
