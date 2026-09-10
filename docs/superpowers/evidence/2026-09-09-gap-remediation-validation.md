# Gap remediation validation — Task 28 upstream merge

Date: 2026-09-10 (Asia/Shanghai)
Worktree: `codex/official-mainline-custom-integration`
Branch HEAD after merge: `1895758cb`

## Merge

```bash
git fetch upstream && git merge --no-ff upstream/main
```

- Result: merge commit `1895758cb` (`merge: integrate upstream/main into custom integration branch`).
- Integrated 9 upstream commits (notably `4fc9d1f1f` options PK rebuild, `c79b74b68` `/api/status` dedupe).
- Conflicts resolved (11 files): kept custom semantics and re-hooked onto official interfaces:
  - `web/src/hooks/use-status.ts` — uses upstream `statusQueryOptions`; retains Task 19 exports (`hasAuthoritativeData`, `isFetching`, `isError`, `refetch`).
  - `web/src/features/channels/hooks/use-channel-mutate-form.ts` — retains `actual_base_url` + super-admin gate via `stripSensitiveUpdateFields`.
  - `web/src/features/wallet/hooks/use-redemption.ts` — retains `executeRedemption` subscription/quota flow.
  - `web/src/features/wallet/components/subscription-plans-card.tsx` — retains `runLatestRequest` race guards.
  - `web/src/i18n/locales/*.json` (7 locales) — union of both sides' keys, then `bun run i18n:sync`.

## Backend gates

```bash
gofmt -l . | rg -v '^web/'          # 0 files (PASS)
go vet ./...                         # PASS (exit 0)
go test ./... -count=1               # PASS (exit 0, all packages ok)
```

## Frontend gates (R7)

From `web/`:

```bash
bun install --frozen-lockfile        # PASS
bun run typecheck                    # PASS
bun run build                        # PASS
bun run i18n:sync                    # PASS
```

Plan-touched vitest (custom-critical paths):

```bash
bunx vitest run src/features/agents src/features/agent-admin \
  src/features/system-settings src/features/auth src/features/wallet
# 32 files, 183/183 tests PASS
```

Usage-logs scope (includes upstream audit viewer debt):

```bash
bunx vitest run src/features/usage-logs
# 48 files, 336/341 tests PASS
# FAIL: src/features/usage-logs/audit/__tests__/viewer.test.tsx (5 tests)
# Classified as pre-existing upstream debt; not modified in this task.
```

Full suite / lint (record only, not gate):

```bash
bun run lint                         # FAIL — upstream oxlint debt (auth validation, assets, scripts)
bun run test                         # FAIL — same 5 audit viewer tests (1204/1209 pass)
```

## Three-DB migration smoke

| Engine     | Command / setup | Migration log | `/api/status` `agent_enabled` |
|------------|-----------------|---------------|-------------------------------|
| PostgreSQL | `docker compose -f dev/docker-compose.custom-dev.yml restart backend` (existing stack on port 3100) | No `AutoMigrate`/`ALTER TABLE`/migration error lines in backend logs after restart | `true` (`bool`) |
| SQLite     | `PORT=3198 SESSION_SECRET=smoke-test-secret go run main.go` | `database migration started`; no errors in `/tmp/sqlite-smoke.log` | `false` (`bool`) |
| MySQL 8    | — | **SKIPPED** — no local MySQL 8 service or client available | — |

## Manual custom regression (Step 5)

**SKIPPED** — no interactive browser session with super-admin, agent, and regular-user accounts in this run. Prior task evidence covers Agent/CXM/ranking/channel paths; re-verify manually before release.

Checklist (not executed here):

- [ ] Super-admin: `actual_base_url` channel test + display address in errors
- [ ] Super-admin: usage logs ranking tab
- [ ] Super-admin: redemption list hides agent codes
- [ ] Agent: login → `/agents`, purchase/export/refund
- [ ] User: redeem agent plan → subscription refresh; `/agents` → 403

## Merge focus checks

- **Options PK rebuild (`4fc9d1f1f`)**: PostgreSQL + SQLite restarts completed without migration failures; options sync cycles run normally in docker logs.
- **`/api/status` dedupe (`c79b74b68`)**: `useStatus()` delegates to shared `statusQueryOptions`; Task 19 exports preserved for agent routes and agent-admin.

## Commits produced

1. `1895758cb` — merge commit (local only, not pushed)
2. *(this evidence commit)* — `docs: record gap remediation validation evidence`

No push, no changes to `main`/`custom`/other branches.
