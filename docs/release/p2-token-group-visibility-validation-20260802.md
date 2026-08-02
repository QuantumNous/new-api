# P2 token-group visibility development validation

Date: 2026-08-02 CST

Stage: development evidence only; not production authorization.

## Candidate identity

- Branch: `codex/p2-pure-candidate-20260803`
- Candidate commit: record the immutable SHA in the handoff entry immediately before
  any review or release gate.
- Candidate implementation head: record the immutable SHA in the handoff entry;
  this document intentionally avoids a self-referential commit identifier.
- Validation record commit: `77dd367` (`docs: record isolated race and migration checks`).
- Production baseline ancestor: `19be7b44f4cacda68a5c45690e8c2af659d29473`
- `TOKEN_GROUP_VISIBILITY_ENABLED` remains default-off.

## Evidence run

All commands ran in the isolated `/tmp/aibuff-p2-release-20260801` worktree.
No production host, database, API, container, channel, price, balance, customer
token, or credential was accessed or changed.

- `go test ./model ./service ./controller ./middleware ./router`: PASS.
- P2 controller regression set: PASS, including no-policy compatibility, feature
  flag off, public intersection, targeted target/non-target, hidden, time bounds,
  exact end-time boundaries, read-through, forged create/edit, user group endpoint,
  admin-as-user creation, Playground rejection, audit-path creation, and existing
  hidden-token relay context continuity. Unknown persisted visibility values are
  also covered fail-closed so malformed policy rows cannot widen access.
- `go vet ./model ./service ./controller ./middleware ./router`: PASS.
- `go test -race ./model ./service ./controller ./middleware ./router`: PASS.
- Orphan-policy replacement regression: PASS; an existing orphan remains editable,
  while a never-seen group and `auto` remain rejected on both save paths.
- `go build ./...`: PASS.
- Default frontend: `bun run typecheck && bun run build`: PASS.
- Classic frontend: `NODE_OPTIONS=--max-old-space-size=4096 bun run build`: PASS.
- `Saving...` is already present in all six default locale files; no fallback-key
  gap was introduced by the P2 editor.
- SQLite disposable schema smoke: migration created both tables and indexes;
  rollback removed both tables. No production or shared database was used.
- Cross-dialect migration-shape check: the SQLite/MySQL/PostgreSQL migration and
  rollback files each contain the same two tables and required indexes/defaults;
  this was a static check only. A disposable SQLite file migration/rollback also
  passed.

## Known non-P2 baseline failures

`go test ./...` still fails in the unchanged baseline areas:

- `relay/channel/claude`: three file-content conversion expectations.
- `relay/helper`: `TestStreamScannerHandler_StreamStatus_PreInitialized`.

The P2 packages and tests pass independently; these failures are not included in
the P2 candidate scope and were reproduced after the candidate changes.

## Release gates still open

- A local disposable MySQL 8.4 backup-copy-style migration/rollback drill is now
  complete, including CREATE/index/default checks, a targeted row read-through, and
  cleanup. It is isolated evidence only and does not establish production backup
  privileges or production authorization.
- No local MySQL/PostgreSQL server is available. The Docker client is installed but
  its local socket is unavailable, and `psql` is only a client; no external or
  production endpoint was contacted.
- A PostgreSQL 16 server binary is installed locally, but an isolated `initdb`
  bootstrap under `/tmp` was blocked by the sandbox's SysV shared-memory policy
  before a server could start. This is recorded as an environment limitation, not
  as migration evidence.
- No owner authorization exists for production DDL, code rollout, or flag enable.
- P1 production observation must close before P2 release sequencing begins.
- Slave-first production rollout, fresh-session dual-node acceptance, and 15-minute,
  1-hour, and 24-hour observations are not performed.
- Queue recheck at 2026-08-02 20:22 CST still shows P1 in progress without a new
  visible Claude PASS, MySQL gate, low-traffic preflight, backup/rollback evidence,
  or production release authorization; the P2 release checklist remains open.

This record therefore supports development handoff only. It must not be used as a
production release sign-off.
