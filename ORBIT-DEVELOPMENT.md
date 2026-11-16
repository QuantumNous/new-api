# BEU Developer Orbit: cloud development

Orbit is a community fork of [New API](https://github.com/QuantumNous/new-api), maintained at <https://github.com/Pratik2k25/BEU-Developer-Orbit>. Phase 0 adds cloud setup and documentation. Application behavior, dependency manifests, upstream identity, and licensing remain unchanged.

## Open the repository in Codex Cloud

1. In Codex, open the environment selector and create or edit a cloud environment.
2. Connect GitHub as `Pratik2k25`. Grant the Codex GitHub app access to `BEU-Developer-Orbit` if it uses selected repositories.
3. Select `Pratik2k25/BEU-Developer-Orbit` as the environment repository. Use `chore/orbit-phase0` to review setup, or the default branch after this PR is approved and merged.
4. Allow dependency network access during setup: GitHub release downloads, `go.dev`, `dl.google.com`, `proxy.golang.org`, `sum.golang.org`, their download redirects, and the configured Bun/npm registry. Retain TLS and Go checksum verification.
5. Run `bash bin/orbit-cloud-setup.sh` as the setup command. In each subsequent terminal, run `source .cache/orbit/env.sh` from the repository root. If you set `ORBIT_CLOUD_STATE`, source `env.sh` from that directory instead.

The current task started in a generic cloud workspace. Its checkout is `/workspace/work/BEU-Developer-Orbit`; toolchains and caches are in `/workspace/work`. For this task, use `source /workspace/work/env.sh` after running `ORBIT_CLOUD_STATE=/workspace/work bash bin/orbit-cloud-setup.sh`. This checkout alone does not establish a saved, repository-linked Codex environment configuration. Select the fork in Codex as described above for future tasks.

No Windows installation is required. Do not put access tokens into setup commands or tracked files. Use the GitHub connection for Git operations and Codex secret storage for future runtime credentials.

## Toolchains and installation

The bootstrap supports Linux x86_64 with Bash, curl, Python 3.11+, tar, unzip, sha256sum, awk, and Git. It reads Go from `go.mod` and Bun from `web/package.json`, downloads official toolchains, verifies their published SHA-256 checksums, installs all three Go module dependency sets, and runs `bun install --frozen-lockfile`. It exits on errors and does not rewrite lockfiles. Toolchains, caches, and its environment file live in ignored `.cache/orbit/` by default.

| Component | Phase 0 baseline | Source |
| --- | --- | --- |
| Root Go module | Go 1.26.10 | `go.mod`, `Dockerfile` |
| RelayKit | Go 1.25.1 minimum; checked with 1.26.10 | `relaykit/go.mod` |
| TokenKit | Go 1.26 minimum; checked with 1.26.10 | `tokenkit/go.mod` |
| Bun | 1.4.4 | `web/package.json`, upstream CI |
| Frontend | React 19, TypeScript, Rsbuild 2 | `web/package.json`, `web/bun.lock` |
| Node | 24.22.1 in this cloud task | Existing cloud runtime; web manifest has no Node version pin |

The cloud image's `/usr/bin/go` is not the Go language compiler. Always source the generated environment file first. Do not substitute an older Go version or change upstream dependency versions to accommodate the image.

## Git workflow

```bash
git remote -v
# origin: https://github.com/Pratik2k25/BEU-Developer-Orbit.git
# upstream: https://github.com/QuantumNous/new-api.git
git switch chore/orbit-phase0
```

For a new checkout that lacks `upstream`, run `git remote add upstream https://github.com/QuantumNous/new-api.git`. Keep the upstream Go module paths. Use ordinary full-history clones; do not copy files into a fresh, unrelated Git repository.

For future updates, start with a clean working tree, fetch upstream, create an update branch from the fork's default branch, merge the selected upstream revision, run validation, and open a PR into the fork. Review dependency and database migration changes before merging. Do not force-push the default branch or automatically merge upstream updates.

If the fork ever needs to be recreated: open <https://github.com/QuantumNous/new-api/fork>, choose your account, name it `BEU-Developer-Orbit`, and create the fork. To retain every upstream branch, clear **Copy the main branch only**. Grant the Codex GitHub app access to the resulting fork. Never recreate or overwrite an existing fork just to repair access.

## Build and test

Run from the repository root after sourcing the environment:

```bash
(cd web && bun run typecheck)
(cd web && bun run lint)
(cd web && bun run build)
GOWORK=off go build ./...
(cd relaykit && GOWORK=off go build ./...)
(cd tokenkit && GOWORK=off go build ./...)
make test
(cd web && bun run test --maxWorkers=2)
```

The frontend build must precede a real gateway build: `main.go` embeds ignored `web/dist`. An empty embed placeholder, used by upstream CI for backend-only checks, is not a working frontend. `make test` checks the root packages except the embed entrypoint, then independently checks RelayKit and TokenKit. `go test ./...` at the root alone does not cover the nested modules.

## Develop without Docker

After building the frontend, start the backend in one cloud terminal:

```bash
source .cache/orbit/env.sh
mkdir -p .cache/orbit/data
SQLITE_PATH="$PWD/.cache/orbit/data/orbit.db" go run .
```

In another terminal:

```bash
source .cache/orbit/env.sh
cd web
bun run dev -- --host 0.0.0.0 --port 5173
```

For this task's custom state directory, replace the `source` command with `source /workspace/work/env.sh`. Use Codex's private port preview for port 5173. Rsbuild proxies `/api`, `/v1`, `/mj`, and `/pg` to port 3000 by default. Finish the upstream setup wizard only in a private preview with credentials you choose. No provider key is needed to inspect the UI or run unit checks. Do not add AI channels during Phase 0.

With `SQL_DSN` unset, the backend uses SQLite. Redis, MySQL, PostgreSQL, Electron, Docker, and inference servers are unnecessary for basic development. Later database-affecting changes require the upstream SQLite/MySQL/PostgreSQL verification matrix; Phase 0 does not claim to verify that matrix.

## Resources and cleanup

This task provides approximately 3 CPUs, 9.7 GiB RAM, and a 7.9 GiB writable filesystem. The setup limits Go to two concurrent build jobs and uses one shared module/build cache. Use at most two Vitest workers. Run heavy checks sequentially if memory or disk becomes tight. Measure with `df -h` and `du -sh .cache/orbit web/node_modules web/dist`; dependency and compiled caches can consume several GiB.

Keep caches for active work. To reclaim space, stop dev/build/test processes first, then remove only known generated paths such as `web/dist`, `web/node_modules`, or the bootstrap cache directory. Removing the state directory also removes its toolchains, environment file, and any development database placed there; back up needed data first. Do not download Docker images or install Electron dependencies for Phase 0.

## License and attribution

Preserve `LICENSE`, `NOTICE`, `THIRD-PARTY-LICENSES.md`, upstream history, copyright headers, module paths, and upstream README files. New API uses AGPLv3 with the additional attribution terms described in `NOTICE`. Future branding must retain a visible upstream link and the notice **Frontend design and development by New API contributors.** Preserve required third-party notices in distributed builds and provide corresponding source as required by the license. Mark Orbit changes clearly; do not imply upstream endorsement.

See [ORBIT-PHASE0-VALIDATION.md](ORBIT-PHASE0-VALIDATION.md) for observed checks and [ORBIT-ROADMAP.md](ORBIT-ROADMAP.md) for future scope.
