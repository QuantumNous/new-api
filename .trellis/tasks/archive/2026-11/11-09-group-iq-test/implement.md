# Group IQ Tests — Implementation Plan

Status: implementation and focused local validation complete; the user authorized the planned commit and push (“提交推送”). The user explicitly requested avoiding excessive/unrelated tests. Exact checks, resolved findings, unavailable independent review and residual qualification limits are recorded in `research/validation.md`.

## Preconditions and Scope Gate

- [x] Capture user-confirmed prompt, text-model HTML/SVG outputs, model checkboxes, both schedule modes, authenticated audience, lightweight animation-capable isolation, and once-per-group/model execution.
- [x] Inspect group routing, channel-test adaptation, task locking/scheduling, frontend authentication/navigation, UI/i18n conventions, and browser isolation references.
- [x] Produce converged `prd.md`, `design.md`, research, and curated implement/check context manifests.
- [x] Obtain approval of final defaults (latest-only retention, group visibility, site-funded bounded calls, no retries/catch-up/overlap).
- [x] Validate curated task contexts (5 implement entries, 4 check entries), review activation guidance, and pass the planning-document whitespace check. Business-code tests are not applicable yet and have not been run.
- [x] Run `task.py start` after final approval; task is now in_progress.
- [x] Load `trellis-before-dev` and applicable spec indexes/guidelines; writing specialists must load their relevant frontend/backend skills before edits. Pi implementation/check dispatch uses the active-task-prefixed protocol and serial ownership board in `delegation.md`.

## Ordered Execution

### 1. Persistence and deterministic contracts

- [x] Define bounded config, result and attempt/checkpoint DTO/model contracts; implement additive migrations, explicit defaults, and portable text/index types.
- [x] Implement input normalization, model/group compatibility checks, versioned saves, current-target visibility, latest-result replacement, and authenticated artifact projections.
- [x] Implement pure next-run calculations with an injected clock and Asia/Shanghai semantics.
- [x] Focused validation: config/schedule bounds, duplicate targets, optimistic conflicts, SQLite persistence/latest replacement and viewer restrictions; catalog eligibility reviewed. See the exact coverage/limitations in `research/validation.md`.

### 2. Scheduling and single-attempt execution

- [x] Add IQ task type/registration using the current task runner and DB lease; preserve other task types.
- [x] Implement manual enqueue/dedup, due-slot CAS, no backlog replay, no overlap, and config snapshotting.
- [x] Add durable started markers so interrupted requests are never automatically resent.
- [x] Extend the existing channel-test executor narrowly for custom prompt/group/output capture; preserve existing health-test behavior and logging semantics where not explicitly changed.
- [x] Select one normal-routed channel per pair and issue one bounded provider request, with no IQ retry loop or health-disable side effects.
- [x] Support relevant native endpoint conversions and same-request streamed text collection; extract final text, not reasoning/tool-only blocks.
- [x] Bound concurrency, timeout, token request and response/artifact size. Persist sanitized terminal outcomes without ordinary viewer balance deductions.
- [x] Focused mock/SQLite tests: two calls for two selected pairs despite multiple channels, failure without retry, deadlines/redirects, checkpoint non-replay, lease recovery, concurrent enqueue/runner claims, quota/health non-mutation and narrow legacy regression.

### 3. Authenticated routes and artifact normalization

- [x] Register result/config/target/manual-run routes with UserAuth/AdminAuth, RBAC/access-token scopes, rate limits, and non-public caching.
- [x] Implement bounded artifact extraction/normalization and trusted preview wrapping without network-fetching parsers or unsafe same-origin HTML responses.
- [x] Keep full bodies out of list responses/task history; redact operator/provider diagnostics from user DTOs.
- [x] Focused tests: anonymous/member/admin access and direct restricted IDs; full/fenced markup, incomplete/file-only/oversized output and reasoning exclusion. Extraction never fetches external URLs.

### 4. Frontend gallery and settings

- [x] Add `features/iq-tests` API/types/query hooks and authenticated `/iq-tests` route.
- [x] Add entries in both console modes, without a public header entry or forced operator mode.
- [x] Implement responsive grouped cards and a larger accessible preview with truthful status/time/progress states.
- [x] Lazy-fetch artifact content, scope caches to the viewer, and cap/unmount live iframe previews.
- [x] Implement a dedicated iframe sandbox/CSP wrapper; do not relax generic `HtmlContent` globally.
- [x] Build admin settings/manual-run controls with installed UI primitives; prevent duplicate calls and handle stale saves. Fix keyed number/time input identity for mode round trips.
- [x] Add 48 UI keys in en/zh/zh-TW/fr/ja/ru/vi through the sanctioned script and i18n sync; inventory diagnostics before cleanup.
- [x] Focused feature tests plus one local browser smoke cover form round trips, selection, schedule switching, roles, lazy previews/lifecycle, account switching, mobile layout and locales.

### 5. Integration, security verification, and finish

- [x] Complete compact affected-feature checks and full-scope parent inline review against actual PRD/design/diff. Independent child review was unavailable after repeated transport failures; record that limitation, not a fabricated clean child report. Direct fallback was user-authorized.
- [x] Browser-test HTML/SVG/Canvas and parent/storage/resource/popup/top-navigation probes against the real locally built app with mocked APIs; verify desktop/mobile and anonymous/member behavior.
- [x] Record the actually observed self-navigation and resource-exhaustion limitations honestly; do not claim a hardened sandbox or complete network air gap.
- [x] Update linked backend/frontend executable IQ specs with contracts, discovered input/test-bootstrap gotchas and focused test evidence.
- [x] Explicitly include intended Trellis artifacts in Git despite the root `.trellis/` ignore rule. Exclude session pointers, unrelated workspace traces, temporary docs/artifacts, node_modules and package-manager cache/log noise.
- [x] Commit verified business code/tests/spec/task changes as `11d7d3d0b`, then complete/archive the task under `archive/2026-11/11-09-group-iq-test`. Record the session in the following journal commit according to the workflow.
- [ ] At task completion, ask permission before removing artifacts listed in `.group-iq-test-temp-artifacts.md`. Do not delete Trellis logs.

## Validation Commands

Use the installed Bun/Go tools. During planning, Bun and Go are present but `web/node_modules` is absent; resolve test prerequisites before claiming frontend checks ran. Dependencies may be installed later without committing cache/install-log noise.

```bash
# Task documents and context only — safe during planning
python3 .trellis/scripts/task.py validate .trellis/tasks/11-09-group-iq-test

git diff --check

# During implementation, with mocked providers and no production credentials
# Start with focused test patterns as actual IQ test names are added.
go test ./model ./service ./controller ./router -run 'Test.*(IQ|ChannelTestRequest|ChannelTestUser)' -count=1

cd web
bun run test -- src/features/iq-tests
bun run typecheck
# Lint/format only affected frontend files; do not fix unrelated baseline issues.
bun run i18n:sync
bun run build
```

Run each relevant gate once after its implementation stage, then rerun only a command affected by a real fix. Use a single local browser smoke scenario for HTML/SVG/Canvas isolation and gallery rendering, not an exhaustive browser/device matrix. A child report must list exact executed commands so integration does not duplicate successful checks.

When global baseline failures exist, record the exact command/failure and distinguish them from introduced failures; do not fix unrelated subsystems silently. A build is not proof of active-script isolation, and a timeout is not proof a provider test passed.

## Risk / Rollback Checkpoints

1. **Migration:** additive only; preserve existing data. Validate portable storage before writing artifacts.
2. **Executor reuse:** run existing channel-test request/internal tests before and after refactoring; avoid broad controller rewrites or circular imports.
3. **Scheduling:** never alter other handlers' completion-relative intervals; test simultaneous IQ/manual claims and date boundaries.
4. **Security:** block unsafe same-origin execution; if CSP/wrapper isolation is not verifiable, stop and report rather than falling back to unsandboxed markup.
5. **Cost:** no production provider smoke tests without separate authorization; never enable the schedule by deployment alone.
6. **Rollback:** disable IQ scheduling/navigation; keep additive data and audit logs until explicit cleanup approval.
