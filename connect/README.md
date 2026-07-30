# BoxAI Connect

BoxAI Connect is a desktop app that points AI coding clients at BoxAI. It signs in through
the browser, stores the account under `~/.boxai-connect/`, and writes the endpoint, key and
model into each supported client's real configuration file — backing up what was there and
restoring it on sign-out.

Supported clients: Claude Code, Codex CLI, Gemini CLI, Grok Build, OpenCode, OpenClaw and
Hermes. Claude Desktop is detection-only; it has no chat-provider concept to point anywhere.

Licensing and lineage are recorded in [UPSTREAM.md](UPSTREAM.md), [LICENSE](LICENSE), and
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). This subtree is a vendored MIT fork of
CC Switch and is **not** covered by the repository's AGPL terms.

## Development

Requires Node (see `.node-version`), pnpm, Rust 1.85+, and the platform Tauri prerequisites.

```sh
pnpm install --frozen-lockfile
pnpm dev                      # or: make connect-dev, from the repository root
```

Checks — the same set `connect-ci.yml` runs:

```sh
pnpm typecheck && pnpm format:check && pnpm test && pnpm build:renderer
cd src-tauri && cargo fmt --all -- --check && cargo clippy --all-targets -- -D warnings && cargo test
```

or `make connect-check` from the repository root.

Debug and `test-hooks` builds read `BOXAI_CONNECT_HOST` to point at a local gateway, e.g.
`BOXAI_CONNECT_HOST=http://127.0.0.1:3000 pnpm dev`. Release builds ignore it and stay
pinned to `https://you-box.com` — that pinning is a security invariant, not a default.

## Release

Releases ship from `.github/workflows/connect-release.yml` on a `connect-v*` tag. The tag
must match `src-tauri/tauri.conf.json`, and the version lives in three files that have to
move together:

- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml` (and the `boxai-connect` entry in `Cargo.lock`)

CI builds macOS arm64 + x64 and Windows x64, signs and notarizes the Mac bundles, signs the
Tauri updater payloads, then publishes to Cloudflare R2 under the `connect/` prefix —
served at `https://dl.you-box.com/connect/`. Both `latest.json` (updater) and
`releases.json` (the `/connect` download page) are composed by
`desktop/packaging/make_release_manifests.py --product connect`, so shipping a build
updates the website without a backend deploy.

Local/emergency path, from the repository root:

```sh
make connect-build     # pnpm tauri build on this machine
make connect-stage     # collect bundles into connect/release/<version>/ under stable names
make connect-publish   # BOXAI_RELEASE_PRODUCT=connect → desktop/packaging/publish_release.sh
```

Local builds read signing secrets from `.env.example`'s variables; CI reads the same values
from repository secrets. Known trap: with `createUpdaterArtifacts` enabled, `tauri build`
exits non-zero when the updater signing key is missing — and it does so *after* Apple
signing, which reads like a signing failure but is not.

Windows installers are not Authenticode-signed yet, so SmartScreen warns on first run. The
download page says so. Linux is not packaged.

## Icons

`src-tauri/icons/icon.svg` is the source. Regenerate the app icon set with
`pnpm tauri icon src-tauri/icons/icon.svg`. The macOS menu bar icon is a separate template
image; regenerate it from `src-tauri/icons/tray/macos/statusbar_template.svg` with the
command recorded in that file.
