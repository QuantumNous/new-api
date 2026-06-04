# 原生分销后续开发接手 Tasklist V5

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to execute this tasklist task-by-task. Use `superpowers:systematic-debugging` for runtime, cache, port, Docker and auth issues. Use `superpowers:test-driven-development` for backend logic, redaction, settlement, rule conversion and state-machine changes. Use `superpowers:verification-before-completion` before claiming completion.

**Goal:** Provide the latest handoff entry for continuing `feature/native-affiliate-minimal` without repeating solved work or losing the current thread requirements.

**Architecture:** Continue the sidecar-first native affiliate implementation in the current new-api repository. Keep official core schema and core user roles minimally touched, isolate affiliate state in `affiliate_*` / SMS / quota-source sidecars, and keep classic/default frontend parity while respecting each UI system.

**Tech Stack:** Go, Gin, GORM, PostgreSQL and SQLite tests, React, Rsbuild, Bun, Docker Compose, tmux, Playwright/in-app Browser, MCP thread index, Feishu/Lark skills or CLI, project `.agents/skills`, Superpowers, shell CLI.

---

## 0. V5 Status Snapshot

- [x] Repository path: `/home/rain/projects/new-api-rain021217`.
- [x] Branch: `feature/native-affiliate-minimal`.
- [x] V5 creation HEAD: `e352ab71 docs: record affiliate runtime baseline`.
- [x] V5 was created after `git status --short --branch` showed a clean branch and `git log --oneline -8` showed `e352ab71` through `db89be79`.
- [x] `5173` is default frontend dev server, `5174` is classic frontend dev server, `3000` is the new-api backend HTTP entry.
- [x] `5173` and `5174` are WSL tmux/Rsbuild processes, not Docker containers. They can disappear after Windows, WSL or tmux restart.
- [x] Latest light runtime check during V5 creation found `new-api-web: 2 windows`, node listeners on `5173` and `5174`, and a listener on `3000`.
- [x] Latest unauthenticated WSL checks during V5 creation showed `http://127.0.0.1:3000/api/affiliate/team`, `5173/api/affiliate/team` and `5174/api/affiliate/team` all returning HTTP 401 JSON, not old `Invalid URL` 404.
- [x] Docker server is still unavailable during V5 creation: `timeout 20s docker version --format "client={{.Client.Version}} server={{.Server.Version}}"` returned `client=29.5.2 server=` with non-zero exit. Do not repeatedly probe Docker.
- [x] Current source already contains `/api/affiliate/team` route, controller and service. Do not reimplement this backend route.
- [x] Current source already has frontend `_t` cache buster/no-cache request headers for affiliate team calls and backend `/api` no-store middleware tests. Live `3000` may still be an old container until Docker can be rebuilt.
- [x] Current source has completed substantial P0/P1 work: scoped log redaction, WSL frontend tmux script/runbook, dev/prod image governance docs, admin rules table UX, dashboard trends, SMS registration entry, settlement dry-run/event totals, and durable partial progress for commission/KPI/head-fee stages.
- [x] Main remaining blockers are Docker rebuild/schema diff, user Windows Chrome DevTools cache proof if old 404 still appears, external settlement double-run, stage-internal cursor resume safety design, SMS phone login/binding/real-channel smoke, latest Feishu business口径复核, and staging/production acceptance.

## 1. Fixed Reading List

- [ ] Read `docs/affiliate/native-affiliate-master-plan.zh-CN.md` before changing business rules, KPI, commission, head-fee, settlement, SMS or inviter behavior.
- [ ] Read `docs/affiliate/native-affiliate-development-principles.zh-CN.md` before changing code. Treat sidecar, TDD, redaction, RMB unit, permission, schema impact and publish evidence rules as mandatory.
- [ ] Read `docs/affiliate/native-affiliate-followup-tasklist.zh-CN.md` before starting work. It is the detailed chronological source of P0/P1/P2 recaps through `e352ab71`.
- [ ] Read `docs/affiliate/native-affiliate-handoff-tasklist-v4.zh-CN.md` only as prior handoff context. This V5 supersedes its snapshot because V4 was created before `e352ab71`.
- [ ] Read `docs/affiliate/native-affiliate-dev-compose-runbook.zh-CN.md` before running local Docker or WSL frontend dev servers.
- [ ] Read `docs/affiliate/native-affiliate-production-cutover-runbook.zh-CN.md` before discussing dev-to-production switching or image strategy.
- [ ] Read `docs/affiliate/native-affiliate-external-acceptance-runbook.zh-CN.md` before any server snapshot, real SMS channel, settlement double-run, gray release or external-console archival action.
- [ ] Read `docs/affiliate/native-affiliate-schema-impact-report.zh-CN.md` before modifying any GORM model, sidecar field, index or AutoMigrate list.
- [ ] Read `docs/affiliate/native-affiliate-sms-reference-audit.zh-CN.md` before SMS or phone login/binding work.
- [ ] For default frontend component/style changes, read `.agents/skills/shadcn-ui/SKILL.md`.
- [ ] For classic/default parity, read `.agents/skills/classic-to-default-sync/SKILL.md`.
- [ ] For new frontend copy, read `.agents/skills/i18n-translate/SKILL.md` and add locale entries instead of hard-coded Chinese-only strings.
- [ ] For React data-flow/performance changes, read `.agents/skills/vercel-react-best-practices/AGENTS.md`.
- [ ] For Feishu references, use Lark/Feishu skills or approved CLI where available. Write only redacted business summaries, review dates and changed conclusions.

## 2. Non-Negotiable Safety Rules

- [ ] Before every code or documentation edit, run:

```bash
git status --short --branch
git log --oneline -8
```

- [ ] Never print, commit or write to tasklists: passwords, cookies, sessions, DSNs, tokens, full phone numbers, production addresses, sensitive screenshots, Feishu private raw text or private links with secret-bearing parameters.
- [ ] `.codex-local/affiliate-test-accounts.secret.json` may be read only for local smoke. Output role labels, HTTP status, `success`, safe counts and redacted summaries only.
- [ ] Keep `/home/rain/projects/new-api-liu23zhi` read-only if referenced. Do not wholesale migrate old fork code.
- [ ] Do not change official `users.role` to add affiliate roles.
- [ ] Do not add phone fields to official `users` table. Continue using `user_phone_bindings` sidecar.
- [ ] Do not count gift, trial, refund, abnormal, self-brush or `legacy_unknown` traffic as paid commission/KPI/head-fee performance.
- [ ] Use RMB yuan in operator-facing UI. Convert to cents only in request/DB boundary helpers. Use percentages in UI and convert to bps only in request/DB boundary helpers.
- [ ] Default and classic must remain functionally equivalent for affiliate features, while preserving their respective design systems.
- [ ] Each completed task must leave a recap in either `native-affiliate-followup-tasklist.zh-CN.md` or this V5 file, including evidence commands, residual risks and next action.

## 3. Current Thread Requirements Captured In V5

- [x] Explain why `http://127.0.0.1:5174/` can refuse connection after restart: frontend dev servers are temporary WSL processes, not persistent containers.
- [x] Put the preferred frontend startup command in WSL: `./scripts/dev-web-tmux.sh`.
- [x] Clarify dev image behavior: PostgreSQL/Redis official `latest` images do not affect repository code, but using official `calciumion/new-api:latest` as the application image means repository二开 code is not deployed.
- [x] Clarify production switching: production/staging must use this repository `Dockerfile` to build an immutable app image tag with embedded default/classic frontend dist.
- [x] Evaluate admin metrics UI table style: management-side rules, KPI, head-fee, risk and settlement configs are better as tables/matrices; distributor dashboard should stay cards + trends + tree + logs table.
- [x] Preserve the old 404 diagnosis path: if Windows browser still shows old 404, debug cache/port/proxy/old backend/old bundle first, not route implementation.
- [x] Include deeper handoff orientation for future development: docs to read, tools to use, outstanding risks, and the next execution order.
- [x] Include explicit reminder to use MCP/plugin/skills/CLI, not only manual reading.

## 4. File Map For Future Work

- [ ] Affiliate route and API boundaries: `router/api-router.go`, `controller/affiliate.go`, `controller/affiliate_test.go`.
- [ ] Affiliate services: `service/affiliate*.go`, especially `service/affiliate_settlement_run.go`, `service/affiliate_job_run.go`, `service/affiliate_commission.go`, `service/affiliate_kpi.go`, `service/affiliate_head_fee.go`, `service/affiliate_summary.go`.
- [ ] Sidecar models: `model/affiliate*.go`, `model/sms*.go`, `model/quota_source*.go`, `model/main.go`.
- [ ] Default affiliate frontend: `web/default/src/features/affiliate/*`, default auth/SMS code in `web/default/src/features/auth/*`.
- [ ] Classic affiliate frontend: `web/classic/src/pages/Affiliate/*`, `web/classic/src/pages/AffiliateAdmin/*`, classic auth/SMS code in `web/classic/src/components/auth/*`.
- [ ] Frontend dev startup: `scripts/dev-web-tmux.sh`, `docs/affiliate/native-affiliate-dev-compose-runbook.zh-CN.md`.
- [ ] Dev Docker: `docker-compose.dev.yml`, `Dockerfile.dev`.
- [ ] Production image: `Dockerfile`, `docker-compose.yml`, `docker-compose.prod.local.example.yml`, `docs/affiliate/native-affiliate-production-cutover-runbook.zh-CN.md`.
- [ ] Schema impact: `ops/schema-impact/*`, `runtime/schema-impact/` ignored artifacts, `docs/affiliate/native-affiliate-schema-impact-report.zh-CN.md`.
- [ ] External acceptance: `docs/affiliate/native-affiliate-external-acceptance-runbook.zh-CN.md`.

## 5. P0 Runtime And Old 404 Closure

### Task 5.1 Windows Browser Cache Proof

- [ ] If the user still sees “推广关系树接口返回 404”, inspect the actual Windows browser DevTools Network entry for `/api/affiliate/team`.
- [ ] Record only safe fields: Request URL, HTTP status, cache source, response body kind, whether body is old `Invalid URL (GET /api/affiliate/team)`, and whether request includes `New-Api-User`.
- [ ] Do not record cookies, session headers, auth tokens or full response bodies.
- [ ] If status is 404 and body is old `Invalid URL`, first clear site cache or use DevTools Disable cache plus hard refresh.
- [ ] If Request URL is not `127.0.0.1:5173`, `127.0.0.1:5174` or intended production/staging host, locate wrong tab, proxy, hosts entry, service worker or old dev server.
- [ ] If curl returns 401/200 but the same browser tab returns cached 404, keep source unchanged and treat this as browser HTTP cache.

Verification commands:

```bash
timeout 15s curl -i http://127.0.0.1:3000/api/affiliate/team
timeout 15s curl -i http://127.0.0.1:5173/api/affiliate/team
timeout 15s curl -i http://127.0.0.1:5174/api/affiliate/team
```

Expected: unauthenticated requests return 401 JSON, not 404 and not old `Invalid URL`.

### Task 5.2 WSL Frontend Dev Server Startup

- [ ] If `5173` or `5174` refuses connection, start the frontend in WSL:

```bash
cd /home/rain/projects/new-api-rain021217
./scripts/dev-web-tmux.sh
```

- [ ] Inspect or attach:

```bash
tmux ls
tmux list-windows -t new-api-web
tmux capture-pane -p -t new-api-web:default -S -80
tmux capture-pane -p -t new-api-web:classic -S -80
```

- [ ] Verify pages and proxy:

```bash
timeout 15s curl -I http://127.0.0.1:5173/
timeout 15s curl -I http://127.0.0.1:5174/
timeout 15s curl -i http://127.0.0.1:5173/api/affiliate/team
timeout 15s curl -i http://127.0.0.1:5174/api/affiliate/team
```

Expected: page endpoints return 200 and unauthenticated affiliate team API returns 401.

### Task 5.3 Live Backend Old-Build Detection

- [ ] If source tests show `/api/*` no-store and `daily_trends` exist but live `3000` responses lack them, treat runtime backend as old build until Docker rebuild proves otherwise.
- [ ] Do not keep adding duplicate middleware or duplicate summary fields to source.
- [ ] Once Docker server recovers, rebuild `new-api:dev` and retest:

```bash
timeout 600s docker compose -f docker-compose.dev.yml up -d --build new-api
timeout 30s curl -D - -o /dev/null http://127.0.0.1:3000/api/status
timeout 30s curl -sS http://127.0.0.1:3000/api/status
```

Expected: `/api/*` responses include no-store headers, and `/api/status` includes current status fields such as `sms_enabled` when enabled by source/config.

## 6. P1 Docker, Schema And Image Governance

### Task 6.1 Docker Server Recovery Gate

- [ ] Probe Docker only when needed and never with concurrent Docker commands:

```bash
timeout 60s docker version
timeout 60s docker info --format '{{.ServerVersion}} {{.Name}}'
timeout 60s docker compose version
```

Expected: Docker client and server both return usable versions.

- [ ] If server is blank, timeout or non-zero, stop Docker-dependent work and continue with local Go/Bun tests, docs or non-Docker design work.

### Task 6.2 Rebuild Dev Application From Repository Code

- [ ] After Docker recovers, rebuild and confirm image source:

```bash
cd /home/rain/projects/new-api-rain021217
timeout 600s docker compose -f docker-compose.dev.yml up -d --build new-api
timeout 60s docker inspect new-api --format '{{.Config.Image}}'
timeout 60s docker ps --filter 'name=new-api'
```

Expected: app service uses `new-api:dev` or an equivalent local repository-built image, not official `calciumion/new-api:latest`.

- [ ] Explain to users when needed: using official latest for Redis/PostgreSQL is fine in local dev, but using official latest for the application service means current repository code is not in the running backend.

### Task 6.3 Pending PostgreSQL Schema Diff

- [ ] After Docker recovers, regenerate schema impact for new code-side objects and fields not yet covered by PostgreSQL diff.
- [ ] Cover at least `affiliate_job_runs`, `sms_rate_limit_counters`, `affiliate_head_fee_rules.status`, `affiliate_risk_rules.self_brush_strategy`, `affiliate_risk_rules.bulk_abuse_strategy` and `affiliate_risk_rules.action`.
- [ ] Confirm diff only changes affiliate/SMS/quota-source sidecar objects.
- [ ] Do not submit `runtime/schema-impact/` artifacts.
- [ ] Update `docs/affiliate/native-affiliate-schema-impact-report.zh-CN.md` with file names, checksum status, redacted conclusion and residual risks.

### Task 6.4 Production Or Staging Image Switch

- [ ] Before production/staging, build immutable app image from this repository root:

```bash
git status --short --branch
git log --oneline -1
APP_TAG="$(date +%Y%m%d-%H%M)-$(git rev-parse --short HEAD)"
APP_IMAGE="new-api-rain:${APP_TAG}"
timeout 1800s docker build --pull -t "${APP_IMAGE}" .
```

- [ ] Use compose override, deployment platform or registry tag so app service uses this repository image, not `calciumion/new-api:latest`.
- [ ] Confirm `Dockerfile` builds and embeds default/classic frontend dist, not only Go backend binary.
- [ ] Smoke after deployment: `/api/status`, `/api/affiliate/status`, `/api/affiliate/team`, distributor center, admin rules page, commission/settlement pages, scoped logs redaction and API cache headers.

## 7. P1 Settlement Reliability

### Task 7.1 Current Completed Reliability Baseline

- [x] Commission, KPI and head-fee scans have been reduced from unsafe unbounded loading toward cursor/batch scanning.
- [x] Settlement pipeline has job run records, idempotency key handling, active-running guard, stale-running takeover, typed cursor payload and failed-run resume preservation.
- [x] Settlement stage can keep affiliate-level durable side effects and partial settlement progress.
- [x] Commission, KPI and head-fee stages now have durable partial progress and failed job run partial count audit.
- [x] Local service/API dry-run support exists and dry-run/formal/repeat formal event total audit has tests.

### Task 7.2 Stage-Internal Cursor Resume Safety Design

- [ ] Do not implement cursor skip for KPI, commission or head-fee only because a cursor exists.
- [ ] First classify each stage by required in-memory context and durable output:

| Stage | Current durable output | Unsafe skip risk | Safe next slice |
| --- | --- | --- | --- |
| Commission | Per-source-log event/idempotent create and partial count | cumulative paid context and tier before/after can be wrong if prior context is skipped | persist or rebuild cumulative context before cursor skip |
| KPI | Per-profile snapshot and partial count | effective-user, quality ratios and paid/gift/trial classification need full scope context | per-profile durable retry and aggregate payload design |
| Head fee | Per-relation event/idempotent create and partial count | qualification depends on first paid, 14-day paid and synthetic marker context | relation-level resume with qualification snapshot |
| Settlement grouping | Affiliate-level draft/link side effects and partial settlement ids | pending event grouping can lose events if aggregate groups are skipped before durable write | continue affiliate-level durable merge before deeper event cursor skip |

- [ ] Write a design note or tests that prove why direct cursor skip is unsafe before implementing any skip.
- [ ] If implementing a safe slice, use TDD:

```bash
go test -count=1 ./service -run 'AffiliateSettlementPipeline|JobRun|Resume|Partial|Cursor' -v
```

Expected: RED first for the exact missing behavior, then GREEN after minimal implementation.

### Task 7.3 External Complete Settlement Double-Run

- [ ] Use staging or a controlled restored local dataset with real paid consumption, refunds, gift/trial traffic and head-fee conditions.
- [ ] Run `dry_run=true` and record redacted counts and amount totals.
- [ ] Run formal pipeline and confirm KPI snapshots, commission events, head-fee events and draft settlements match dry-run totals.
- [ ] Repeat formal pipeline and confirm no duplicate commission, no duplicate head fee and no duplicate settlement.
- [ ] Confirm linked event totals equal settlement amounts.
- [ ] Compare against external console read-only outputs and record only redacted delta reasons.

## 8. P1 Admin UI And Metrics Table Evaluation

### Task 8.1 UI Direction Decision

- [x] Admin-side metrics and rule management should be table/matrix based. This includes commission tiers, KPI tiers, head-fee rules, risk rules, settlement config, commission review and settlement review.
- [x] Distributor-side dashboard should not become a pure table. Keep summary cards, trends, relationship tree and scoped logs detail table.
- [x] Advanced JSON import/export should remain as an advanced mode, not the default operator path.

### Task 8.2 Rules Table Field Completeness

- [ ] Re-audit classic and default rule tables against followup P1-26 through P1-30.
- [ ] Confirm commission tiers include level, lower/upper net paid amount, base rate, cap rate, manual approval, order and status.
- [ ] Confirm KPI tiers include level, code, name, effective-user threshold, net-paid threshold, coefficient, quality thresholds and order.
- [ ] Confirm head-fee rules include level, KPI tier, amount, first-pay threshold, 14-day paid threshold, qualification day, unlock day and status.
- [ ] Confirm risk rules include gift-only ratio threshold, abnormal user ratio threshold, refund threshold, second-payment threshold, self-brush strategy, bulk-abuse strategy and action.
- [ ] Confirm settlement config includes period, freeze days, minimum settlement amount, review threshold, auto-run switch and review note.
- [ ] If a field is missing in either frontend, write helper tests first, then implement parity and locale.

Verification:

```bash
cd web/default && bun test src/features/affiliate/admin-lib.test.ts src/features/affiliate/rule-array-editor.test.ts
cd web/classic && bun test src/pages/AffiliateAdmin/affiliateAdminRules.test.mjs
```

### Task 8.3 Admin Finance Lists And Operations

- [ ] Add full commission event table management if not already present: filters, pending/ready/settled/void states, manual adjustment, void, recompute, confirmation and redacted reason.
- [ ] Add full settlement table management if not already present: draft/ready/frozen/paid/void states, freeze, mark paid, void, export redacted summary and job run audit entry.
- [ ] Keep amounts operator-facing in RMB yuan.
- [ ] Keep operation reason redacted and avoid writing internal sensitive details to frontend logs.
- [ ] Add default/classic helper tests before page wiring.

Suggested verification:

```bash
go test -count=1 ./service ./controller -run 'AffiliateCommission|AffiliateSettlement|Admin|JobRun|Audit' -v
cd web/default && bun run build
cd web/classic && bun run build
```

## 9. P2 SMS And Phone Account Features

### Task 9.1 Current SMS Baseline

- [x] SMS provider abstraction and smsbao provider exist.
- [x] Admin SMS config, status and test send exist.
- [x] `sms_send_logs`, `user_phone_bindings` and `sms_rate_limit_counters` sidecars exist in code.
- [x] SMS registration backend and registration code sending endpoint exist.
- [x] Default/classic registration frontend entry exists.
- [ ] Live backend must be rebuilt after Docker recovers before assuming `/api/status.sms_enabled` is visible at `3000`.
- [ ] PostgreSQL schema diff for `sms_rate_limit_counters` remains missing until Docker recovers.

### Task 9.2 Phone Login, Binding And Change

- [ ] TDD `/api/user/login/phone`: only existing active phone bindings can login; the endpoint must not auto-register users.
- [ ] TDD self phone bind/change: old active binding is safely disabled and new binding becomes active after verification.
- [ ] Keep all phone storage in `user_phone_bindings`; do not alter official `users` table.
- [ ] Use SMS-scoped Turnstile or equivalent anti-abuse check for sending actions.
- [ ] Apply DB-backed rate limits across phone hash, IP hash, account hash and scene where applicable.
- [ ] Response and logs must include only masked phone or hashes, never full phone or verification code.

### Task 9.3 Real SMS Channel Smoke

- [ ] Execute only after signature, template, dedicated test phone and rate limit settings are approved.
- [ ] Verify `GET /api/option/sms/status` does not expose endpoint, account, ApiKey or MD5 password.
- [ ] Verify `POST /api/option/sms/test` sends to the dedicated test phone and logs only masked phone/provider/status/duration.
- [ ] Verify repeated sends exceed limit before provider call.
- [ ] Do not commit screenshots, full phone numbers, provider credentials or full SMS body.

## 10. P2 Feishu Business口径 And Default Seed

- [ ] Re-check latest Feishu affiliate business docs before changing commission/KPI/head-fee/risk defaults.
- [ ] Confirm paid performance excludes gift, trial, refund, abnormal, self-brush, internal test and `legacy_unknown`.
- [ ] Confirm effective-user definition: valid invite attribution, first pay threshold, 14-day paid threshold, no refund/self-brush/bulk-abuse violation.
- [ ] Confirm level 1 and level 2 commission ranges, base rates and cap rates.
- [ ] Confirm KPI tier thresholds, coefficient rules and quality gate downgrade/review behavior.
- [ ] Confirm head-fee eligibility, amount and unlock timing.
- [ ] Confirm normal invite and affiliate invite initial quota difference, while keeping gifted quota excluded from commission/KPI.
- [ ] If seed changes, write Go tests for contiguous ranges, no overlap, unit conversion and published-version immutability before changing seed.
- [ ] If frontend fallback seed changes, keep backend seed API as source of truth and update default/classic fallback only for offline creation.
- [ ] Recap must include review date, redacted business summary and exact changed conclusions.

## 11. P2 Frontend Regression And UX Debt

### Task 11.1 Login-State Affiliate Smoke

- [ ] After Docker rebuild, use in-app Browser or Playwright to open `http://127.0.0.1:5173/affiliate` and `http://127.0.0.1:5174/console/affiliate`.
- [ ] Verify login flow, affiliate status, relationship tree, summary, daily trends, scoped logs table, commissions and settlements.
- [ ] If local test secret is used, output only role label, HTTP code, success and redacted counts.
- [ ] Confirm `/api/affiliate/summary` includes `daily_trends` after live backend rebuild.
- [ ] Confirm browser Network does not cache `/api/*` 401/404 or sensitive JSON.

### Task 11.2 Frontend Quality Debt

- [ ] Record existing default React `checked` without `onChange` warning and classify whether it is unrelated baseline or affiliate-specific.
- [ ] Record existing classic console warnings such as non-boolean icon props only if they affect affiliate pages.
- [ ] Every new frontend copy must include i18n locale updates.
- [ ] Mobile smoke must cover distributor dashboard, admin rule tables and finance tables. Tables must remain operable on narrow screens.
- [ ] Prefer frontend helper tests for request payload/unit conversion before UI wiring.

## 12. P3 Long-Term Project Quality Debt

- [ ] Create a stable one-command schema impact workflow for Docker PostgreSQL once Docker server reliability is resolved.
- [ ] Add centralized tests or probes for `/api/*` no-store headers across status, auth, affiliate and admin endpoints.
- [ ] Design automatic settlement scheduler only after current dry-run, job run, idempotency, active/stale and audit requirements are stable.
- [ ] Add job run monitoring UI only after job run schema diff and external double-run acceptance are complete.
- [ ] Create historical `legacy_unknown` attribution backfill runbook. It must require sampling, manual approval, paid sidecar write, audit and rollback; it must not default unknown logs to paid.
- [ ] Prepare upstream merge strategy so native affiliate二开 stays in reviewable commits and does not become one huge conflict.
- [ ] Consider extracting repeated default/classic affiliate frontend helpers if parity maintenance becomes error-prone, but do not restructure large frontend files without a concrete task and tests.

## 13. Suggested Execution Order

- [ ] First: if the user's Windows browser still shows old 404, collect that browser's DevTools Network proof and clear cache if needed.
- [ ] Second: keep or restart WSL frontend via `./scripts/dev-web-tmux.sh` and verify 5173/5174.
- [ ] Third: when Docker server recovers, rebuild `new-api:dev`, verify no-store headers, `/api/affiliate/team` 401/200, `/api/status.sms_enabled` and `daily_trends`.
- [ ] Fourth: generate pending Docker PostgreSQL schema diff and update schema impact report.
- [ ] Fifth: run login-state distributor/admin browser smoke after live backend rebuild.
- [ ] Sixth: execute external complete settlement dry-run/formal/repeat formal double-run using redacted evidence.
- [ ] Seventh: design safe stage-internal cursor resume slices; do not implement unsafe cursor skipping.
- [ ] Eighth: complete SMS phone login/binding/change and real-channel smoke only after template/signature/test phone readiness.
- [ ] Ninth: re-check latest Feishu business口径 and update seed/tests only when actual business values changed.
- [ ] Tenth: strengthen admin finance table operations, mobile usability and staging/production cutover.

## 14. Verification Commands By Task Type

Backend targeted tests:

```bash
go test -count=1 ./model ./service ./controller ./router -run 'Affiliate|RuleSet|Commission|KPI|HeadFee|Settlement|JobRun|SMS|Inviter' -v
```

Settlement reliability:

```bash
go test -count=1 ./service -run 'AffiliateSettlementPipeline|AffiliateSettlement|JobRun|Partial|Resume|DryRun|EventTotals' -v
```

Scoped logs and redaction:

```bash
go test -count=1 ./controller ./service -run 'AffiliateLogs|Scoped|Export|Redact|Channel|Token|Request' -v
```

Default frontend:

```bash
cd web/default && bun test src/features/affiliate/admin-lib.test.ts src/features/affiliate/lib.test.ts src/features/auth/api.test.ts
cd web/default && bun run build
```

Classic frontend:

```bash
cd web/classic && bun test src/pages/AffiliateAdmin/affiliateAdminRules.test.mjs src/pages/AffiliateAdmin/affiliateAdminFinance.test.mjs src/components/auth/smsRegisterRequest.test.mjs
cd web/classic && bun run build
```

Runtime smoke:

```bash
timeout 15s tmux ls
timeout 15s ss -ltnp | rg ':3000|:5173|:5174'
timeout 15s curl -i http://127.0.0.1:3000/api/affiliate/team
timeout 15s curl -i http://127.0.0.1:5173/api/affiliate/team
timeout 15s curl -i http://127.0.0.1:5174/api/affiliate/team
```

Docker gate:

```bash
timeout 60s docker version
timeout 60s docker info --format '{{.ServerVersion}} {{.Name}}'
timeout 60s docker compose version
```

## 15. Recap Template

```markdown
### Task <section> Recap (2026-06-04 current thread)

- RED: Describe the failing test, missing runtime proof or observed issue before the fix.
- Change: Summarize what changed without listing secrets or full responses.
- Verification: List exact commands and safe outputs such as HTTP code, `success`, count and build/test pass.
- Residual risk: State what is not covered, especially Docker schema, staging/production, real SMS, real payment, browser cache or external double-run.
- Next: Point to the next checkbox in this tasklist.
```

## 16. Self-Review Checklist For This V5

- [x] Captures the current thread's frontend-startup, dev/prod image, table UI, old 404 and future handoff requirements.
- [x] Avoids backend route reimplementation for `/api/affiliate/team`.
- [x] Keeps secret-handling and redaction rules explicit.
- [x] Separates current source completion from live runtime old-container risks.
- [x] Separates admin table UX from distributor dashboard UX.
- [x] Preserves Docker as a blocked gate instead of repeatedly probing it.
- [x] Gives a concrete execution order and verification commands for future development.
