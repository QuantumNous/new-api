# Group IQ Tests — Technical Design

Status: approved for implementation on 2026-11-09; focused verification only, per the user's request. This is one cohesive end-to-end deliverable; backend, preview, and gallery changes are ordered steps, not separately released child products.

## 1. Boundaries and Reuse

- Add a single global IQ configuration and latest-result storage in `model/`. Keep full artifact bodies out of `SystemTask.Payload/State/Result` and list responses.
- Add scheduling helpers and due-state persistence without replacing the generic system-task runner.
- Register an IQ handler alongside the existing controller-owned scheduled handlers (`controller/system_task_handlers.go`). This preserves the established dependency direction: controllers may call `service`, middleware, relay adaptors, and model code; do not make `service` import controller/relay code that already depends on `service`.
- Select a channel once for the configured group/model with the ordinary selector at retry=0 (`service/channel_select.go:114`). Selection is group-level, not channel enumeration. Concrete groups only; the virtual `auto` group is not a target.
- Reuse the existing channel-test conversion/adapter foundation with a narrow custom-request/result extension, rather than copying its entire multi-provider pipeline or silently changing the health-test defaults. The IQ path must not update channel health/test-time state or disable a channel.
- Frontend feature root: `web/src/features/iq-tests/`; protected route: `/iq-tests` under `_authenticated`. Reuse the current UI primitives and authenticated layouts.

## 2. Data Contracts

### Configuration (one singleton row)

Persist the configuration in the primary database so scheduling, version checks, and due-slot claims can be transactional. Suggested fields:

- `id` (singleton), `version` (monotonic), `prompt` (bounded UTF-8 text).
- `targets`: canonical array of `{ group: string, models: string[] }`, stored as JSON text for SQLite/MySQL/PostgreSQL compatibility.
- `schedule_mode`: `interval` or `daily`; `interval_hours`: positive integer in interval mode; `daily_time`: validated `HH:mm` in daily mode; `timezone`: Asia/Shanghai for the first version.
- `enabled`, `next_run_at` (UTC Unix seconds), `updated_by`, `updated_at`.

Validate and normalize once at the admin API boundary and again before consuming a stored snapshot: trim/deduplicate names, reject virtual/unknown groups, reject unavailable/non-text model targets, validate model-group membership, impose 100-pair and prompt-size bounds, and reject malformed schedule values. Preserve user prompt content; do not translate or silently reword it. Invalid/missing configuration leaves automatic execution disabled.

### Latest result (one row per selected concrete group/model)

- Stable pair identity, group, public model name, task/run ID, configuration version.
- Terminal status: `success`, `error`, `timeout`, `unavailable`, `invalid_artifact`, or `interrupted`.
- `started_at`, `completed_at`, `duration_ms`, artifact kind (`html`/`svg`), normalized artifact text, bounded/sanitized error code/message; optional usage counters if reliably supplied.
- Persist only final visible text/markup, not hidden reasoning content, credentials, full provider headers, or unbounded provider bodies.
- Proposed caps: 2 MiB of accumulated provider response, 1 MiB extracted artifact, and 64 KiB prompt. Validate database column types for MySQL (large artifact text must not use the default 64 KiB TEXT column).
- On terminal replacement, overwrite the previous IQ artifact for that pair. Do not create a historical artwork table. Hide results for removed targets immediately; clean only obsolete IQ artifact rows, never unrelated task/audit data.

The exact migration layout may use a separate lightweight attempt marker to guarantee at-most-once calls. It must not turn into a user-visible run-history feature. Use an existing durable task ID and a bounded per-pair checkpoint/attempt table or state projection, rather than treating process memory as the execution ledger.

### Authenticated API

All endpoints return the existing `{ success, message, data }` envelope and require authentication. Suggested routes:

| Method/path | Audience | Contract |
| --- | --- | --- |
| `GET /api/iq-tests/results` | Signed-in viewer | Lightweight group/model cards, latest status/times, visible active progress; no full artifacts/provider details |
| `GET /api/iq-tests/results/:id` | Authorized viewer | Recheck group visibility; return artifact as JSON string, never a same-origin executable HTML response |
| `GET /api/iq-tests/config` | Administrator | Current editable configuration, version, next-run time |
| `PUT /api/iq-tests/config` | Administrator | Validated complete update, optimistic version check; reject stale edits |
| `GET /api/iq-tests/targets` | Administrator | Verified concrete groups and compatible available text models; no channel credentials |
| `POST /api/iq-tests/run` | Administrator | Enqueue one manual batch, or return the existing active task without creating a duplicate |

Use `AdminAuth` plus existing RBAC/access-token permission registration for administrative routes. Reuse channel read/write/operate permissions deliberately rather than bypassing the permission helper. Ordinary user endpoints use `UserAuth` and current group usability on every result/artifact read. Return 404/forbidden for restricted artifact IDs without leaking content. Administrative diagnostics must not be included in ordinary viewer DTOs.

## 3. Scheduling and Execution Flow

```text
Admin saves config -> validate/version/write -> next-run calculation
Due checker -> existing SystemTask active-key/lease -> durable batch/attempt checkpoint
  -> selected pair -> normal group selector once -> existing provider adaptor
  -> bounded response text -> artifact extraction -> latest-result replacement
Signed-in viewer -> visibility-filtered metadata -> lazy authorized artifact fetch
  -> isolated iframe preview / expanded preview
```

### Calendar semantics

- Store UTC timestamps; calculate daily times using Asia/Shanghai, with timezone data available in deployment. Do not implement Beijing time using the server's local timezone.
- Interval schedules advance from their planned slots, not from provider completion. On startup or late wakeup, run at most one due batch and advance to the next future slot; never replay the backlog.
- Daily schedules select the next local occurrence strictly after the reference time. Cover exact-boundary and midnight cases with an injected clock.
- Saving an enabled schedule recalculates its future next-run time. Disabling prevents new scheduled work but does not silently replay or restart a batch already executing. Manual runs do not modify the recurring anchor.
- `ScheduledSystemTaskHandler.Interval()` is currently completion-relative, so do not misrepresent it as the user's calendar schedule. Use an IQ-specific persisted due check with a short scheduler eligibility interval while retaining the existing runner, active key, lease, and 15-second polling behavior. Calendar times are best effort within the poll/queue delay, not hard real-time guarantees.
- Creating and advancing the due slot must be guarded transactionally by config version/next-run CAS and the existing single-active task constraint. Race with an edit/disable must become a no-op, not a stale run. Keep existing handlers' semantics unchanged.

### One attempt, no hidden retries

- A batch snapshots its validated configuration/version. Edits cannot mutate an in-flight request.
- Enqueueing uses the system-task type's unique active key, including concurrent master nodes and repeated manual clicks.
- Persist that a pair has started before sending its provider request. Each selected pair gets one selector call and one execution path, no IQ retry/failover loop. Do not call the full public relay retry controller in a way that retries behind this contract.
- Respect task cancellation and lease loss before each new pair. At-most-once sending is not exactly-once successful completion: a process may die after a provider receives a request. Mark ambiguous started work interrupted and do not replay it after recovery.
- Default two concurrent pairs; each request has a three-minute deadline and a 16,384-token requested output bound. For a provider/model-specific lower or unsupported limit, use its supported fields or record a truthful error, rather than retrying with another request. Stop on output overflow.
- One failed/unavailable model does not stop other selected pairs. Progress is bounded structured metadata; completion reports counts and sanitized errors.
- Use the existing root/system test-user resolution as the execution identity, not the most recent viewing user. Proposed funding follows existing channel-test behavior: record test resource/usage information without debiting an ordinary viewer's quota. Upstream providers still incur real cost. No new API key or exposed operator credential is required.

### Provider adapter reuse

`controller/channel-test.go` already builds native endpoint requests, initializes channel context, converts through adaptors, and records test usage. Its defaults (`hi`, small max tokens), response validation, and logging must remain unchanged for health tests.

Introduce a narrow optional IQ request/result path or extract a shared executor with explicit options for prompt, token budget, tested group, response capture, and safe logging. Ensure `ContextKeyUsingGroup` is the selected group before relay-info generation (`relay/common/relay_info.go:632`), and avoid overwriting it with the operator's home group. Return captured normalized response text rather than parsing a debug log. Do not log full generated HTML or provider credentials.

Support compatible OpenAI Chat/Responses, Anthropic, and Gemini adaptors. Responses-only/Codex routes need provider-aware format selection. If an adaptor requires streaming, collect final visible text within the same bounded request and deadline; do not issue a second request. Extract final text blocks, not thinking/tool-only blocks. Unsupported file-only outputs are an honest `invalid_artifact` outcome.

## 4. Artifact Extraction and Preview Security

Detailed rationale: `research/preview-security.md`.

- Backend extraction owns HTML/SVG recognition, code-fence removal, bounds, and completeness checks. Prefer a complete HTML document when both a document and nested SVG are present. Do not pick the first incidental `<svg>` inside otherwise valid HTML and discard the scene.
- Use parsing that does not fetch network resources. Normalize the document and strip incoming base/refresh/CSP metadata, external script references, executable nested frames/objects, forms, and externally linked assets before making the preview document. Preserve inline JavaScript required for Canvas; this is not a reason to globally relax the generic `HtmlContent` sanitizer.
- Serve artifact data as authenticated JSON with non-public caching behavior. Never expose an unauthenticated static HTML URL or persist the response into `web/public`.
- The preview builder is the only owner of the trusted wrapper and restrictive policy. Use `iframe sandbox="allow-scripts"` without `allow-same-origin`, popups, top navigation, forms, downloads, or storage permissions. Use a no-referrer policy.
- Insert the trusted CSP before any generated document content. Restrict subresource loads: `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; worker-src 'none'`. Do not rely on unsupported navigation directives or on `iframe[csp]` being universally supported. Verify compatibility with existing application CSP.
- No `dangerouslySetInnerHTML` in the main document, no credential injection, and no parent callback that honors arbitrary iframe messages. If any readiness messaging is required, validate source, fixed message shape, and a per-frame correlation token; never return secrets or arbitrary network/file access.
- Residual limitations: an iframe is not a hardened hostile-code VM; arbitrary script CPU/memory usage and every self-navigation/network path cannot be categorically prevented by this lightweight design. Do not promise hard execution termination or a complete network air gap. If those stronger requirements arise, disable active scripts or separately plan stronger infrastructure.

## 5. Frontend Composition

- Add the authenticated IQ entry to both the developer and easy-console navigation without turning it into an operator-only route. Do not add an anonymous/public top-bar destination.
- Feature API/types/query keys own the shared DTO contract. Partition result caches by authenticated viewer/session/group scope; do not keep another account's artifact visible after switching accounts or permissions.
- Page: short prompt/test description, next/last run and active progress, group sections, responsive model cards. Cards show outcome/time and a rendered preview; clicking opens a larger accessible dialog with an unmounting close lifecycle.
- Fetch metadata once per page; fetch artifact bodies lazily for visible cards or the selected preview. Bound simultaneously mounted live iframes, unmount off-screen/closed frames, and avoid embedding every artifact body in list payloads.
- Admin-only settings panel: prompt textarea, group/model multi-selection, schedule mode and values, enable toggle, next-run preview, and an explicit manual-run action. Preserve in-progress input on recoverable save errors; reject stale config versions visibly.
- Use installed Base UI/shadcn primitives from `web/components.json`, current query/form patterns, keyboard navigation, responsive dialogs, and honest empty/error states. Preserve existing layouts/sidebar behaviors.
- All frontend copy must use English source i18n keys and all seven locales. Follow the i18n skill's script-only locale write workflow and final sync; the benchmark prompt is administrator data, not UI translation copy.

## 6. Compatibility, Rollout, and Rollback

- Additive primary-DB migration for config/result/attempt state, registered in `model/main.go`; no destructive existing schema changes. Test SQLite persistence and review MySQL/PostgreSQL text/index/locking semantics.
- Default config is disabled and targetless; deploying the code never triggers provider calls. No dependency on cron, containers, Redis-only correctness, screenshots, or production provider credentials during tests.
- Protect and rate-limit the manual run action; use explicit authenticated administration and current RBAC conventions.
- Roll back first by disabling scheduling and hiding navigation; old code can ignore the additive tables. Do not drop artwork/state or erase operational logs during rollback without a separate approved action.
- Development validation uses mocked providers and local fixtures only. Production/manual provider execution needs separate authorization because it incurs costs.

## 7. Approved Defaults and Verification Budget

The user approved latest-only artifacts, usable-group visibility, site-funded bounded calls, administrator manual runs, initially disabled schedules, and no retries/catch-up/overlap. Numeric safety limits implement that approved bounded-execution proposal. Keep verification targeted: one focused backend gate, focused frontend tests, necessary type/build checks, and one local isolation/rendering smoke check. Do not run unrelated full suites or production provider calls.
