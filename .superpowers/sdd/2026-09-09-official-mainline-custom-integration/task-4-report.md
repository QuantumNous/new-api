# Task 4 report: official backend conflict resolution

## Status

PARTIAL. The official backend is retained as the final runtime skeleton. No
backend source change was justified after the conflict audit: every requested
controller/model/relay/router/service target is byte-identical to
`upstream/main` at the integration HEAD. The custom-only Agent/CXM, rankings,
`actual_base_url`, and legacy video/OAuth protocol paths were not ported, as
required by the brief and reserved for later tasks or explicit extension work.

## Conflict inventory and decisions

The prescribed merge simulation was run with `custom` and `upstream/main`.
It produced 59 conflicts in total; 19 were backend conflicts after excluding
`web/` (17 content conflicts and 2 modify/delete conflicts):

| Conflict | Decision |
| --- | --- |
| `controller/audit.go` | Keep official access-token/security audit projection. |
| `controller/channel-billing.go` | Keep official billing validation and quota safety. |
| `controller/channel.go` | Keep official channel CRUD and provider contract. |
| `controller/channel_upstream_update.go` | Keep official upstream update flow. |
| `controller/log.go` | Keep official log projection and admin-only fields. |
| `controller/oauth.go` | Keep official session/state/verification flow; do not restore custom legacy OAuth state payloads. |
| `controller/ratio_sync.go` | Keep official ratio synchronization and model pricing semantics. |
| `controller/relay.go` | Keep official relay request, auth, and billing path. |
| `controller/video_proxy.go` | Keep official task/video proxy behavior. |
| `model/log.go` | Keep official usage/log schema and serialization. |
| `model/main.go` | Keep official cross-database migration/index helpers. |
| `model/redemption.go` | Keep official atomic redemption and quota accounting. |
| `model/subscription.go` | Keep official subscription lifecycle and settlement rules. |
| `model/user.go` | Keep official user/session/quota behavior; defer custom-only fields. |
| `relay/common/relay_info.go` | Keep official RelayInfo, usage, and quota-clamp boundary. |
| `relay/relay_task.go` | Keep official RelayKit task DTO/context integration. |
| `service/task_polling.go` | Keep official polling, terminal-state, and settlement behavior. |
| `controller/task_video.go` (modify/delete) | Preserve upstream deletion; custom legacy controller is deferred. |
| `controller/video_proxy_gemini.go` (modify/delete) | Preserve upstream deletion; custom legacy Gemini adapter is deferred. |

`router/api-router.go` was included in the requested scope and has no
non-frontend merge conflict; the official routing table remains unchanged.

The custom versions were inspected as the conflict side. Their meaningful
differences either duplicate superseded protocol conversion, alter official
authentication/billing semantics, or belong to deferred Agent/CXM/rankings
work. Retaining them would create two competing runtime contracts, so no
source merge was performed.

## Verification

- `go test ./controller ./model ./relay/... ./router/... ./service/... -count=1`: **passed**.
- `(cd relaykit && go test ./... -count=1)`: **passed**.
- `go test -race ./service/... ./model/... -count=1`: **failed** on existing
  race reports in `logger.logHelper` during concurrent video polling and in
  `model.Task.GetUpstreamTaskID` while a polling test updates the same task.
  These failures are unrelated to the backend conflict decisions and were not
  changed in this task.

No MySQL/PostgreSQL DSNs were available in this environment; database fixture
coverage remains the limitation recorded by Task 2.

## Commit

This report is the only Task 4 working-tree change. No backend source changes
were required after the official-vs-custom audit.
