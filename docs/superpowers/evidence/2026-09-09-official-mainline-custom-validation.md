# Official mainline custom integration validation

Date: 2026-09-09 (Asia/Shanghai)  
Worktree: `codex/official-mainline-custom-integration`  
HEAD: `fd1425231`

## Static and backend checks

- `git diff --check`: PASS.
- Conflict marker scan: no merge markers; matches in documentation and decorative `====` comments only.
- `go vet ./...`: PASS.
- `go test ./...`: initially exposed a regression in `TestUpdateChannel_NonRootResponseOmitsActual`; fixed by clearing `ActualBaseURL` after persistence reload and before non-root JSON response. Re-run targeted test PASS. Full suite packages otherwise passed; the initial command exited 1 solely on that regression.
- `gofmt -w controller/channel.go`: PASS.
- Nested module: `cd relaykit && go test ./...`: PASS.

## Frontend checks

From `web/`:

- `bun install --frozen-lockfile`: PASS (no changes).
- `bun run typecheck`: PASS.
- `bun run test --run`: PASS (113 files, 996 tests).
- `bun run build`: PASS (Rsbuild ready).
- `bun run i18n:sync`: PASS; generated report under `web/src/i18n/locales/_reports/` with no tracked changes.

## Database and staging gates

No MySQL or PostgreSQL DSN/service was available in this environment, so the SQLite/MySQL/PostgreSQL migration matrix, index inspection, and restart AutoMigrate checks were not executed. No production or customer database was accessed. No staging credentials, deployment target, or image registry was available; staging login/relay/billing/Agent/CXM/ranking/channel tests and image digest capture remain open.

Rollback rehearsal was not run because it requires the unavailable staging image digest and database backup. The intended order remains application rollback, CXM projection rollback, then database restore, with audit/quota/log readability checked after each step.

## Protected identifiers and feature-path audit

The protected `new-api` and `QuantumNous` identifiers remain present in module paths, metadata, and documentation. Custom paths are wired through the official router/controller/service/model layers; no `web/classic` build reference was introduced in the official `web` path. `actual_base_url` is cleared for non-root responses and URL credentials are sanitized in runtime/error/log paths. Agent/CXM and leaderboard changes retain official session, audit, quota, transaction, and successful-settlement boundaries based on prior task evidence; real-provider and production evidence remain separate gates.

## Working tree and commit

The only integration fix is the non-root response redaction guard in `controller/channel.go`. This report and the baseline evidence update are included in the validation commit. No main branch update, push, PR, or deployment was performed.

## Correction evidence

A subsequent uncached `go test ./... -count=1` run reached all packages but failed in the pre-existing/flaky `service/TestRedeemCodeQuotaZeroResultIncludesQuotaField` redemption fixture (`redemption failed: redeem.failed`); the controller regression test remains green. This failure is retained as an open gate and was not changed by Task 11.
