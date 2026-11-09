# Group IQ Tests — Implementation Plan

Status: planning. Do not implement until the user reviews PRD/design defaults and `task.py start` succeeds.

## Preconditions and Scope Gate

- [x] Capture user-confirmed prompt, text-model HTML/SVG outputs, model checkboxes, both schedule modes, authenticated audience, lightweight animation-capable isolation, and once-per-group/model execution.
- [x] Inspect group routing, channel-test adaptation, task locking/scheduling, frontend authentication/navigation, UI/i18n conventions, and browser isolation references.
- [x] Produce converged `prd.md`, `design.md`, research, and curated implement/check context manifests.
- [ ] Obtain approval of final proposed defaults (latest-only retention, group visibility, site-funded bounded calls, no retries/catch-up/overlap).
- [x] Validate curated task contexts (5 implement entries, 4 check entries), review activation guidance, and pass the planning-document whitespace check. Business-code tests are not applicable yet and have not been run.
- [ ] Run `task.py start` only after final approval.
- [ ] Before code changes, load `trellis-before-dev`, applicable backend/frontend specs and skills. For this Pi workflow, implementation/check delegation uses the active-task-prefixed dispatch protocol.

## Ordered Execution

### 1. Persistence and deterministic contracts

- [ ] Define bounded config, result and attempt/checkpoint DTO/model contracts; implement additive migrations, explicit defaults, and portable text/index types.
- [ ] Implement input normalization, model/group compatibility checks, versioned saves, current-target visibility, latest-result replacement, and authenticated artifact projections.
- [ ] Implement pure next-run calculations with an injected clock and Asia/Shanghai semantics.
- [ ] Tests: invalid/duplicate targets, unavailable models, pair/prompt size caps, optimistic edit conflicts, latest-only artifact replacement, viewer group restrictions, and migration round trips.

### 2. Scheduling and single-attempt execution

- [ ] Add IQ task type/registration using the current task runner and DB lease; preserve other task types.
- [ ] Implement manual enqueue/dedup, due-slot CAS, no backlog replay, no overlap, and config snapshotting.
- [ ] Add durable started markers so interrupted requests are never automatically resent.
- [ ] Extend/extract the existing channel-test executor narrowly for custom prompt/group/output capture; preserve existing health-test behavior and logging semantics where not explicitly changed.
- [ ] Select one normal-routed channel per pair and issue one bounded provider request, with no IQ retry loop or health-disable side effects.
- [ ] Support relevant native endpoint conversions and same-request streamed text collection; extract final text, not reasoning/tool-only blocks.
- [ ] Bound concurrency, timeout, token request and response/artifact size. Persist sanitized terminal outcomes without ordinary viewer balance deductions.
- [ ] Tests: fake upstream call counts, many-channel group chooses one, timeout/provider errors, cancellation/lease loss, no replay after started markers, progress and quota non-mutation.

### 3. Authenticated routes and artifact normalization

- [ ] Register result/config/target/manual-run routes with UserAuth/AdminAuth, RBAC/access-token scopes, rate limits, and non-public caching.
- [ ] Implement bounded artifact extraction/normalization and trusted preview wrapping without network-fetching parsers or unsafe same-origin HTML responses.
- [ ] Keep full bodies out of list responses/task history; redact operator/provider diagnostics from user DTOs.
- [ ] Tests: anonymous/member/admin access; direct restricted-ID access; direct/fenced full HTML and SVG; invalid/truncated/file-only/oversize content; no external URL fetching.

### 4. Frontend gallery and settings

- [ ] Add `features/iq-tests` API/types/query hooks and authenticated `/iq-tests` route.
- [ ] Add entries in both console modes, without a public header entry or forced operator mode.
- [ ] Implement responsive grouped cards and a larger accessible preview with truthful status/time/progress states.
- [ ] Lazy-fetch artifact content, scope caches to the viewer, and cap/unmount live iframe previews.
- [ ] Implement a dedicated iframe sandbox/CSP wrapper; do not relax generic `HtmlContent` globally.
- [ ] Build the admin settings and manual-run control with installed UI primitives; prevent duplicate calls and handle stale saves.
- [ ] Add UI translations for en/zh/zh-TW/fr/ja/ru/vi through `add-missing-keys.mjs`, then run i18n sync. Inventory disposable translation reports/scripts before cleanup.
- [ ] Tests: saved-config round trip, target selection, daily/interval switch, admin/member UI, visibility, lazy previews, iframe lifecycle, account switching, mobile layout, and locale coverage.

### 5. Integration, security verification, and finish

- [ ] Run the full affected quality gate and an independent Trellis check against PRD/design/real changes.
- [ ] Browser-test self-contained HTML/SVG/Canvas examples and adversarial parent/storage/resource/popup/top-navigation cases against a local mock-backed app. Verify desktop/mobile layout and authenticated denial, not just presence of sandbox attributes.
- [ ] Record residual self-navigation and resource-exhaustion limitations honestly; do not claim a hardened code sandbox or complete network air gap.
- [ ] Update executable IQ feature contracts in `.trellis/spec/` with discovered implementation constraints and tests.
- [ ] Explicitly include intended Trellis artifacts in Git despite the root `.trellis/` ignore rule. Exclude session pointers, unrelated workspace traces, temporary docs/artifacts, node_modules and package-manager cache/log noise.
- [ ] Commit verified business code/tests/spec/task changes, then complete/archive the task and record the session according to the workflow.
- [ ] At task completion, ask permission before removing artifacts listed in `.group-iq-test-temp-artifacts.md`. Do not delete Trellis logs.

## Validation Commands

Use the installed Bun/Go tools. During planning, Bun and Go are present but `web/node_modules` is absent; resolve test prerequisites before claiming frontend checks ran. Dependencies may be installed later without committing cache/install-log noise.

```bash
# Task documents and context only — safe during planning
python3 .trellis/scripts/task.py validate .trellis/tasks/11-09-group-iq-test

git diff --check

# During implementation, with mocked providers and no production credentials
# Start with focused test patterns as actual IQ test names are added.
go test ./model ./service ./controller ./router ./middleware

go test ./controller -run 'Test.*(IQ|ChannelTest|TestChannel)' -count=1

cd web
bun run test -- src/features/iq-tests
bun run test -- src/hooks/__tests__/sidebar-mode.test.tsx
bun run typecheck
bun run lint
bun run format:check
bun run i18n:sync
bun run build
```

When global baseline failures exist, record the exact command/failure and distinguish them from introduced failures; do not fix unrelated subsystems silently. A build is not proof of active-script isolation, and a timeout is not proof a provider test passed.

## Risk / Rollback Checkpoints

1. **Migration:** additive only; preserve existing data. Validate portable storage before writing artifacts.
2. **Executor reuse:** run existing channel-test request/internal tests before and after refactoring; avoid broad controller rewrites or circular imports.
3. **Scheduling:** never alter other handlers' completion-relative intervals; test simultaneous IQ/manual claims and date boundaries.
4. **Security:** block unsafe same-origin execution; if CSP/wrapper isolation is not verifiable, stop and report rather than falling back to unsandboxed markup.
5. **Cost:** no production provider smoke tests without separate authorization; never enable the schedule by deployment alone.
6. **Rollback:** disable IQ scheduling/navigation; keep additive data and audit logs until explicit cleanup approval.
