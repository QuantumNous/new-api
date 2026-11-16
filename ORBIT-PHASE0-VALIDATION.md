# Phase 0 validation record

Validated on 16 November 2026 in Codex Cloud. Baseline: `f36c460f0e86bb814c88642daf3e4764a3886a8a` from `Pratik2k25/BEU-Developer-Orbit/main`. Upstream `QuantumNous/new-api` HEAD resolved to the same commit during setup. The clone is not shallow. Phase 0 changes only the Orbit bootstrap and documentation.

## Setup checklist

- Verified connected GitHub identity `Pratik2k25` and the existing fork relationship to `QuantumNous/new-api`.
- Cloned the full Git history into `/workspace/work/BEU-Developer-Orbit`.
- Verified `origin` targets the Orbit fork; added `upstream` targeting `QuantumNous/new-api`.
- Created `chore/orbit-phase0`; retained the existing Git author configuration.
- Installed Go 1.26.10 and Bun 1.4.4 in workspace-owned directories. Verified official Go and Bun archive checksums. Also ran the complete bootstrap with fresh toolchain directories and shared dependency caches: official downloads, checksum verification, extraction, and dependency installation all succeeded, exit 0. Removed the temporary duplicate toolchains afterward.
- Downloaded dependencies for the root, RelayKit, and TokenKit Go modules; all three commands exited 0.
- Ran `go mod verify` in the root module: `all modules verified`, exit 0.
- Installed frontend dependencies using the existing frozen Bun lockfile: 1,230 packages installed on the first run.
- Ran the final `ORBIT_CLOUD_STATE=/workspace/work bash bin/orbit-cloud-setup.sh`: exit 0. Its repeat install reported no changes. An earlier invocation failed because the script was edited while Bash was executing it; the unchanged final script was rerun successfully.
- Preserved application code, manifests, lockfiles, README files, license notices, and attribution.
- Added cloud workflow instructions and a future roadmap without implementing its features.

## Observed checks

| Check | Command | Result |
| --- | --- | --- |
| Bootstrap syntax | `bash -n bin/orbit-cloud-setup.sh` | Passed |
| Frontend typecheck | `cd web && bun run typecheck` | Passed: no type errors in 1,496 files across 2 projects |
| Frontend lint | `cd web && bun run lint` | Failed, exit 1: 148 error diagnostics in unchanged upstream files |
| Frontend production build | `cd web && bun run build` | Passed: Rsbuild 2.2.0 built in 17.4 seconds; reported total assets 67,833.9 kB |
| Frontend development server | `bun run dev -- --host 127.0.0.1 --port 5173`, then HTTP GET `/` | Passed compilation and returned HTML containing the root element; server stopped after the check |
| Gateway build | `GOWORK=off go build ./...` at the root | Passed, exit 0; real frontend assets were present |
| RelayKit build | `cd relaykit && GOWORK=off go build ./...` | Passed, exit 0 |
| TokenKit build | `cd tokenkit && GOWORK=off go build ./...` | Passed, exit 0 |
| Gateway executable | `go build -o /workspace/work/orbit-gateway .` | Passed; executable starts with disposable SQLite storage |
| Runtime HTTP checks | GET `/`, `/api/status`, `/api/setup` on ports 3000 and 5173 | All six requests returned HTTP 200; both API endpoints returned `success: true` on both ports |
| Full frontend tests | `cd web && bun run test --maxWorkers=2` | Incomplete: interrupted with SIGINT after more than 10 minutes on the small cloud machine, exit 130; no full-suite pass claimed |
| Focused frontend tests | `bun run test --maxWorkers=2` with the five paths below | Passed: 5 files, 55 tests, exit 0, duration 5.58 seconds |
| Go tests | `make test` | Passed, exit 0: root packages, RelayKit, and TokenKit all completed successfully |

Lint examples include `unicorn/prefer-string-replace-all` in `web/src/lib/utils.ts`, `typescript/no-import-type-side-effects` in `web/src/components/copy-button.tsx`, and `react/jsx-no-useless-fragment` in existing feature components. These are baseline findings. Phase 0 does not modify their source or lint configuration.

Runtime checks used `SQLITE_PATH=/workspace/work/runtime-data/orbit.db PORT=3000 /workspace/work/orbit-gateway` and the existing Rsbuild proxy. `/api/setup` reported `status: false`, `root_init: false`, and `database_type: sqlite`. The application served its embedded frontend and the dev server forwarded API requests to it. No account or provider channel was created. Both servers were stopped after verification. These were HTTP checks, not browser interaction tests.

The focused frontend command ran these existing files from `web/`:

```bash
bun run test --maxWorkers=2 \
  src/lib/__tests__/format-bytes.test.ts \
  src/lib/server-error-message.test.ts \
  src/lib/legacy-route.test.ts \
  src/features/task-plugins/__tests__/plugin-url.test.ts \
  src/features/usage-logs/lib/__tests__/response-model.test.ts
```

The full suite contains 235 test files and emitted jsdom `Window.scrollTo()` implementation warnings before interruption. Its coverage was not replaced by these 55 focused tests; run the complete suite on a less constrained runner before calling the frontend test baseline fully verified.

## Environment and resource observations

- Linux x86_64; approximately 3 CPUs, 9.7 GiB RAM, no swap, and a 7.9 GiB writable filesystem.
- Go 1.26.10; Bun 1.4.4; Node 24.22.1; npm 11.9.0; Python 3.12.14; GCC 14.2.0; Git 2.52.0.
- `GOWORK=off`, `GOMAXPROCS=2`, `GOFLAGS=-p=2`; frontend tests use at most two workers.
- Runtime binaries, module caches, build caches, logs, and databases are untracked. No Docker images or Electron dependencies were installed.
- The checkout including frontend dependencies is approximately 1.9 GiB; shared Go modules approximately 1.1 GiB; toolchains approximately 372 MiB. Build caches grow during testing. Keep at least 6 GiB available for this baseline and prefer an 8 GiB or larger writable volume. This run stayed within the 7.9 GiB filesystem. Temporary duplicate toolchains and the smoke-check executable were removed after use.
- Logs for this task are under `/workspace/work/`: `frontend-{install,typecheck,lint,build,test,focused-test,dev}.log`, `backend-build-*.log`, `backend-test.log`, `backend-runtime.log`, `bootstrap.log`, and `go-verify.log`. These logs are task-local evidence, not durable GitHub artifacts.

## Access and remaining scope

The fork existed before this task. A fork-creation API attempt returned HTTP 403, so it was not used to recreate or change the fork. A Git push dry run succeeded. The integration cannot read GitHub Actions administration settings (HTTP 403); their configuration was not changed. Cloud validation and GitHub CI results must be treated separately.

The task's generic cloud machine is usable, but a saved Codex environment linked to the fork must be selected/configured through the Codex UI; this task has no environment-configuration write tool. Follow `ORBIT-DEVELOPMENT.md`. Nothing requires Windows installation.

No Oracle resources, inference hosting, live provider channels, transactional emails, production databases, or future Orbit features were configured. MySQL/PostgreSQL compatibility, real provider requests, and browser user flows are outside the checks recorded here. The owner must review and approve a merge before any PR is merged.

Phase 1 development can begin in this cloud checkout. The saved environment configuration still needs the owner's UI action; the inherited lint failures need triage, and the full frontend suite remains unverified. These limitations do not invalidate the successful builds, Go tests, focused frontend tests, or HTTP startup checks above.
