# Current Branch Change Record

Date: 2026-04-28

## Branch And Upstream Baseline

- Working branch before upstream merge: `codex/upstream-analytics-trim`
- Local base before fetch: `0664bb3f65f05ba1734276264e92e2512b7cacd4`
- Official upstream remote: `upstream` (`https://github.com/QuantumNous/new-api.git`)
- Latest fetched stable branch: `upstream/main`
- Latest fetched stable commit: `9f8a4ec0`

## Change Summary

This branch adds upstream credential observability, cost-aware usage analysis, relay trace capture, and channel timeout controls. The work spans backend models/controllers, relay request handling, log storage, and admin dashboard pages.

## Backend Changes

- Added stable upstream provider key identity:
  - New `ProviderKey` log database model keyed by SHA-256 fingerprint.
  - Provider keys are synchronized from channel keys and exposed through admin API `GET /api/provider_key`.
  - Logs now store `provider_key_id` for provider-key-level filtering and aggregation.

- Added cost-aware usage accounting:
  - `Log` now stores optional `cost_quota`.
  - Channel settings support `cost_ratio`; consume and task billing logs calculate cost quota from original quota and channel cost ratio.
  - Dashboard usage queries can switch between original quota and cost quota metrics.

- Added dashboard usage dimensions:
  - Usage charts can group by model, upstream key ID, channel ID, token ID, or username.
  - Existing `/api/data` endpoints accept filters for model, channel, provider key, token, dimension, and metric.

- Added upstream request and response trace capture:
  - Relay info can retain request headers, response headers, upstream request ID, status code, and bounded text body previews.
  - Binary and multipart bodies are represented by storage kind metadata instead of inline content.
  - Error response handling and stream scanning capture trace data for admin log inspection.

- Added channel timeout settings:
  - Channel settings now support request timeout, response header timeout, stream response header timeout, and stream idle timeout overrides.
  - Relay HTTP client cache keys include timeout policy, so proxy and timeout-specific clients remain isolated.
  - Stream scanner honors per-channel idle timeout overrides and can disable the idle timeout.

## Frontend Changes

- Added admin credential management page:
  - New route `/console/credential`.
  - Sidebar and admin sidebar module settings include `credential`.
  - Provider key table shows key preview/current key, linked channels, request counts, original quota, cost quota, and last used time.
  - "View logs" opens usage logs filtered by provider key ID.

- Expanded dashboard filters:
  - Dashboard filters moved from modal flow into inline controls.
  - Admin/user dashboards support model, provider key ID, channel, token, dimension, metric, and time filters.
  - Charts and ranking labels update according to selected dimension and metric.

- Expanded usage log inspection:
  - Logs can be prefilled and filtered by provider key ID and request ID from query parameters.
  - Admin expanded log rows show provider key ID, final upstream key, upstream request ID/status, and trace request/response viewers.

- Added channel settings UI for:
  - Cost ratio.
  - Request timeout.
  - Response header timeout.
  - Stream response header timeout.
  - Stream idle timeout.

## Test Coverage Added Or Updated

- Channel settings validation and default timeout metadata tests.
- Provider key fingerprint, preview, upsert, query, and channel sync tests.
- Dashboard usage aggregation tests.
- Stream scanner timeout override and disabled-timeout tests.
- Relay HTTP client policy/cache tests.
- Option controller timeout default tests.

## Files Touched Before Upstream Merge

- Backend controllers: `controller/channel-test.go`, `controller/channel.go`, `controller/log.go`, `controller/option.go`, `controller/provider_key.go`, `controller/relay.go`, `controller/usedata.go`
- DTO/model layer: `dto/channel_settings.go`, `model/channel.go`, `model/dashboard_usage.go`, `model/log.go`, `model/main.go`, `model/provider_key.go`, `model/provider_key_query.go`
- Relay/service layer: `relay/**`, `service/error.go`, `service/http_client.go`, `service/log_info_generate.go`, `service/log_trace_capture.go`
- Router: `router/api-router.go`
- Frontend: `web/src/App.jsx`, dashboard components/hooks, provider key page/hooks, usage log hooks/filters, channel edit modal, sidebar settings, `web/package.json`, `web/vite.config.js`

## Merge Notes

- `upstream/main` was fetched successfully on 2026-04-28 and advanced from `0664bb3f` to `9f8a4ec0`.
- The current branch was fast-forwarded to `9f8a4ec05010da20704c1b55aa8b9af5630df72e`, matching `upstream/main`.
- Local changes were then applied onto the fetched upstream stable code.
- Merge conflicts were resolved in `.gitignore`, `controller/channel-test.go`, `web/src/components/table/channels/modals/EditChannelModal.jsx`, and `web/src/hooks/usage-logs/useUsageLogsData.jsx`.
- The Claude OpenAI-file-content conversion was adjusted so official upstream tests pass for unsupported binary files, PDF files, and text files.

## Post-Merge Fixes

- Fixed `/v1/messages` AWS Claude streaming model-mapping metadata:
  - Claude `message_start.message.model` no longer overwrites `RelayInfo.UpstreamModelName` when model mapping has already been applied.
  - This preserves the redirected upstream model name for usage logs and fallback token estimation while still recording the response model in `ClaudeResponseInfo`.
  - Added regression coverage for mapped Claude streaming responses.

## Verification

- `git diff --check`
- `GOCACHE=/Users/ray/new-api/.gocache GOTMPDIR=/Users/ray/new-api/.gotmp GOMODCACHE=/Users/ray/new-api/.gomodcache go test ./...`
- `go test ./relay/channel/aws ./relay/channel/claude`
- `bun run build` in `web/`
