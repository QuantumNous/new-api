# Actual backend API contract — Group IQ tests

Implementation: `controller/iq_tests.go`, `router/iq_router.go`, `model/iq_test_config.go`. This is the handoff for the frontend, not the earlier suggested schema.

## Verification state

**Integration verified with local mocks:** the original backend attempt was dependency-download blocked. The parent later completed dependency setup, compiled all five affected Go packages, corrected test bootstrap (unique referral codes, dialect column quoting and explicit mock pricing), and passed the focused checks. See `validation.md` for exact commands, frontend/build/browser evidence and remaining live-provider/database limitations. Do not enable schedules or make real provider calls as a development check.

## Authentication, permissions and transport

Every path below requires the existing dashboard authentication (browser login/session access JWT, or an allowed personal access token). No API-key relay token or public artifact URL is added. Every IQ route uses `DisableCache`: `Cache-Control: no-store, no-cache, must-revalidate, private, max-age=0`.

| Method | Exact path | Requirements |
| --- | --- | --- |
| GET | `/api/iq-tests/results` | `UserAuth`; valid scoped dashboard tokens allowed; handler filters current usable groups |
| GET | `/api/iq-tests/results/:id` | Same viewer authentication and group/target authorization; success artifacts only |
| GET | `/api/iq-tests/config` | `AdminAuth` **and** RBAC `channel:read`; matching PAT scope |
| PUT | `/api/iq-tests/config` | `AdminAuth` **and** RBAC `channel:write`; matching PAT scope; critical rate limit |
| GET | `/api/iq-tests/targets` | `AdminAuth` **and** RBAC `channel:read`; matching PAT scope |
| POST | `/api/iq-tests/run` | `AdminAuth` **and** RBAC `channel:operate`; matching PAT scope; critical rate limit |

Ordinary members cannot configure/run tests. Admins inspect all configured IQ groups, including an obsolete configured group; ordinary viewers only see currently selectable concrete groups from current user-group rules plus configured group ratios. Result and artifact access both enforce this boundary. The viewer routes accept any otherwise-valid scoped dashboard token; group restrictions still apply. Existing middleware controls authentication/permission-denial response shapes (normally 401/403), rather than the IQ handler inventing a second authentication protocol.

IQ handler envelope:

```json
{"success":true,"message":"","data":{}}
```

Handler errors use the HTTP status and `{"success":false,"message":"...","data":null}`. Config validation: 400; stale version: 409; enqueue/config conflict: 409; inaccessible/removed/non-success artifact: indistinguishable 404; database failures: sanitized 500. Apply the existing API error handling to middleware denials and rate limits too.

**All `*_at` values and `next_run_at` are UTC Unix seconds, not milliseconds.** Zero means not scheduled/not started/not completed. `duration_ms` alone is milliseconds. `version`/`config_version` are numeric monotonic configuration versions, not timestamps.

## Configuration

GET returns the complete current configuration. Initial deployment creates a disabled, targetless singleton with version 1, the exact approved Chinese prompt, interval mode / 24 hours, `daily_time: "09:00"`, and `timezone: "Asia/Shanghai"`. GORM fills `updated_at` at creation; `updated_by` initially is 0.

Example response after an administrator save:

```json
{
  "success": true,
  "message": "",
  "data": {
    "version": 2,
    "prompt": "Draw a finished pelican bicycle HTML scene.",
    "targets": [{"group":"public","models":["gpt-4o"]}],
    "enabled": false,
    "schedule_mode": "interval",
    "interval_hours": 24,
    "daily_time": "09:00",
    "timezone": "Asia/Shanghai",
    "next_run_at": 0,
    "updated_at": 1794211200,
    "updated_by": 1
  }
}
```

PUT is a **complete update**, not PATCH. Send the last-read version and all editable fields:

```json
{
  "version": 2,
  "prompt": "Draw a finished pelican bicycle HTML scene.",
  "targets": [{"group":"public","models":["gpt-4o","gpt-4o-mini"]}],
  "enabled": true,
  "schedule_mode": "daily",
  "interval_hours": 24,
  "daily_time": "09:00",
  "timezone": "Asia/Shanghai"
}
```

Successful PUT returns the same configuration shape with version incremented, computed future `next_run_at`, and server-controlled `updated_by`/`updated_at`. Do not send or rely on writable IDs, `next_run_at`, timestamps or updater identity. On 409, preserve form edits and require reload/reconciliation; do not blindly resubmit an old version.

Rules:
- Prompt is nonblank valid UTF-8, at most 65,536 bytes; the exact saved content/whitespace is preserved as user input through the existing adapter conversion. Channel parameter overrides cannot replace the converted prompt input.
- Targets are sorted and deduplicated by concrete group/model. `auto`/unknown/unavailable/incompatible pairs are rejected. At most 100 distinct pairs; an enabled schedule must have at least one pair. Disabled configurations may be targetless.
- `schedule_mode` is `interval` or `daily`. Interval hours: integer 1–8760 in interval mode. Daily time: exact `HH:mm` in daily mode. First-version timezone is **only** `Asia/Shanghai`; display Beijing time explicitly.
- PUT request body limit is 128 KiB. Use ordinary UTF-8 JSON, not an unnecessarily expanded escaped representation.
- Every save recalculates the next future slot, including prompt/target edits. Disabled means `next_run_at: 0` and prevents new scheduled batches, not cancellation of an already active one.
- Interval cadence advances from planned slots; daily cadence uses embedded Beijing timezone data. A late/downtime pass runs at most one due batch and advances directly to a future slot; no backlog batches. Due slots while another batch is active are skipped. Manual runs leave the schedule anchor unchanged.

## Verified target catalog

GET `/api/iq-tests/targets`:

```json
{"success":true,"message":"","data":[
  {"group":"default","models":["default-only-alias","gpt-4o"]},
  {"group":"public","models":["claude-sonnet","gemini-pro","gpt-4o"]}
]}
```

This is an array, **not** `{groups: ...}`. Entries contain concrete configured groups and sorted/deduplicated model names. The query checks enabled abilities joined to real enabled channels, deliberately bypassing user-catalog filtering of default-only models. It resolves production chained model mapping before native endpoint compatibility checks. All possible highest-priority choices at retry=0 must be compatible; a compatible lower-priority fallback alone does not qualify a pair.

Eligible single-HTTP adapter channel families: OpenAI, Azure, Anthropic, Gemini, Codex, NewAPI, Sub2API, OpenRouter, DeepSeek, Xai, AdvancedCustom, vLLM and SGLang. Known non-text image/audio/video/embedding/rerank names are excluded; mapped aliases are checked against their upstream name. Advanced-custom native endpoint declarations are honored. SDK/job/other unsupported adapter families are intentionally absent rather than inheriting retries. Capability is structural/current configuration, not an upstream liveness guarantee; stale routing, unconfigured pricing, provider rejection or incompatible changes can still fail a later run. No provider calls occur during catalog reads or validation.

## Manual run

POST `/api/iq-tests/run` accepts an empty body (no request fields).

```json
{"success":true,"message":"","data":{
  "task_id":"systask_example",
  "status":"pending",
  "created":true
}}
```

If already active, it returns that task with `created:false` and `status: "pending"` or `"running"`. No duplicate batch is created. A disabled schedule does **not** disable administrator manual runs. A new run requires selected currently valid targets. The existing master runner claims pending work on its normal approximately 15-second polling cycle; this is not a synchronous model request. Poll results for progress. Task type is `group_iq_test`.

## Results and progress

GET `/api/iq-tests/results`:

```json
{
  "success": true,
  "message": "",
  "data": {
    "groups": [{
      "group": "public",
      "models": [{
        "model": "gpt-4o",
        "latest": {
          "id": "pair_sha256_hex",
          "group": "public",
          "model": "gpt-4o",
          "task_id": "systask_previous",
          "config_version": 2,
          "status": "success",
          "started_at": 1794211200,
          "completed_at": 1794211212,
          "duration_ms": 12000,
          "artifact_kind": "html",
          "error_code": "",
          "error_message": ""
        },
        "progress": {
          "id": "pair_sha256_hex",
          "group": "public",
          "model": "gpt-4o",
          "status": "running",
          "started_at": 1794297600,
          "completed_at": 0
        }
      }]
    }],
    "active_run": {
      "task_id": "systask_current",
      "status": "running",
      "config_version": 3,
      "created_at": 1794297595,
      "total": 1,
      "completed": 0,
      "running": 1,
      "pending": 0
    },
    "next_run_at": 1794384000,
    "schedule_enabled": true,
    "timezone": "Asia/Shanghai"
  }
}
```

- `groups` and `models` are ordered arrays; group names are routing identifiers. A configured card with no terminal result has `latest:null`.
- `latest.status`: `success`, `error`, `timeout`, `unavailable`, `invalid_artifact`, `interrupted`. `artifact_kind` is `html`/`svg` on success and normally empty on failures. No artifact body/usage/provider diagnostics appear in this response.
- Error codes: success `""`; ordinary execution failure `execution_failed`; otherwise `timeout`, `unavailable`, `invalid_artifact`, `interrupted`. Messages are deliberately generic/sanitized, not provider response bodies.
- `progress` is null when there is no active attempt for this current pair. Otherwise its status is `pending`, `running`, or one of the terminal statuses above. Progress belongs to `active_run.task_id`; it intentionally does not repeat a task ID per attempt.
- `active_run` is null when there is no visible active work. Counters include **only** currently selected pairs in the viewer's currently usable groups, never hidden-group counts. `created_at` is enqueue time, not a promised provider start time.
- Older `latest` remains visible while a new attempt is pending/running. Label it using its own timestamp/task/config version; do not imply it already belongs to the active run. Terminal replacement overwrites the old row, even on failure (the old artwork is then removed). Removing targets prunes only their IQ latest rows. Task/audit/checkpoint metadata remains.
- Empty state: `groups: []`, `active_run: null`; there are no fabricated results.

## Authenticated artifact JSON

The result `id` is a stable 64-character lowercase SHA-256 of `group + NUL + public model name`. Treat it as opaque and use the value returned by results. GET `/api/iq-tests/results/:id` returns only a currently selected, visible, successful artifact:

```json
{"success":true,"message":"","data":{
  "id":"pair_sha256_hex",
  "group":"public",
  "model":"gpt-4o",
  "task_id":"systask_previous",
  "config_version":2,
  "completed_at":1794211212,
  "artifact_kind":"html",
  "artifact":"<html><head></head><body><canvas></canvas><script>/* inline drawing */</script></body></html>"
}}
```

`artifact` is a JSON string, never a same-origin `text/html` response or a public static file. Unauthorized/removed IDs and non-success results return 404. A replacement can race a list read; compare the returned `task_id`/`config_version`/`completed_at`, since the pair ID is stable across replacements.

Extraction accepts full HTML and standalone SVG, direct or fenced, preferring the whole HTML scene over nested SVG. It rejects missing/incomplete/oversized markup and provider truncation. It never follows returned links/file paths, executes tools, or fetches assets. Limits: 2 MiB accumulated provider body, 1 MiB normalized artifact. Normalization removes base/meta/refresh/CSP, external script nodes, frames/objects/forms/links and unsafe static URL attributes, while preserving inline scripts/Canvas. **It is not a general script sanitizer or complete egress boundary.**

## Frontend integration requirements and residual limits

1. Fetch JSON through the existing authenticated API client. Scope results and artifacts to the current authenticated viewer/session; clear on account/access changes. Because IDs are stable, key/invalidate artifact caches using latest task/version/completion metadata too.
2. Do not embed artifacts in the host DOM or generic `HtmlContent`. Build the dedicated trusted wrapper with CSP **before** generated markup; use `iframe sandbox="allow-scripts"` without `allow-same-origin` or other grants, and `referrerPolicy="no-referrer"`. Reject/remove untrusted base/meta/nested frames again as needed; backend normalization does not make active content safe outside this wrapper.
3. The intended wrapper policy remains: `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; worker-src 'none'`. No arbitrary postMessage-to-host actions or credentials inside the frame. Keep live previews lazy/bounded and unmount them on close/offscreen/account changes.
4. Browser-origin isolation, external-resource controls and Canvas rendering still need frontend/browser verification. Lightweight scripts are not a hardened VM, CPU/memory quota or universal self-navigation/network air gap.
5. Execution is site-funded via the root/system test identity and existing resource logs; no viewing-user quota reservation/debit. Two concurrent pairs; three-minute deadline per pair; one routing choice at retry=0 and at most one non-replayable outbound POST per pair; no IQ retries, channel enumeration, channel health updates or failover. Durable started checkpoints are never replayed after lease expiry/crash; ambiguous/unsent remainder becomes `interrupted`.
6. A 16,384-token output cap is enforced in the final converted request after overrides. A provider that rejects that supported/unsupported field produces a truthful failure; there is no second relaxed request. In particular, the existing Codex adapter normally strips `max_output_tokens`, but IQ keeps its explicit safety cap, so a Codex backend that rejects the cap will fail once rather than silently running unbounded. Native same-request SSE visible text is supported, not a promise that every provider accepts every budget.
7. The original backend slice did not edit frontend code. Parent integration subsequently passed the focused backend checks, frontend tests/typecheck/build and one local browser isolation/rendering smoke. See `validation.md`; live provider acceptance and live MySQL/PostgreSQL/multi-instance qualification were not performed.
