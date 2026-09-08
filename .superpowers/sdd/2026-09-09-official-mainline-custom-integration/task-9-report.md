# Task 9 report

Status: PARTIAL

Implemented `Channel.ActualBaseURL`, `GetRuntimeBaseURL`, and `GetDisplayBaseURL`; root-only read/write handling; non-root update omission; sanitization helpers and regression tests. Runtime URL routing was migrated in controller billing/upstream/model sync/video paths, relay task/MJ proxy, middleware distributor, polling, Codex usage and channel model fetch paths.

Validation: `go test ./model ./relay/... -run 'Channel|BaseURL|URL' -count=1` passed. `go test ./controller ./service -run 'Channel|BaseURL|URL' -count=1` passed after classifying `actual_base_url` as sensitive.

Known limitation: some controller channel list/fetch code still intentionally uses `GetBaseURL` for validation/display flows; channel-test response path remains display-sanitized. Full frontend typecheck was not run because this worktree's official frontend differs from the historical web-default patch.

Follow-up fixes: Ollama channel management now uses `GetRuntimeBaseURL`; Ollama error projections sanitize actual hosts for non-root users. Removed the `default:''` tag from `ActualBaseURL` to avoid cross-database default churn. `rg` audit confirms remaining `GetBaseURL` uses are validation/display paths.

P1 follow-up: Ollama streaming SSE errors now sanitize runtime hosts and credentials. Upstream model refresh SELECT includes `actual_base_url`, preserving runtime routing after reload. Sanitization redacts Bearer/API-key/sk-style secrets.

Sanitizer follow-up: URL replacement and credential redaction are now separated so every parse/no-op branch redacts secrets, including malformed URLs and actual==display cases.

Final sanitizer follow-up: query credentials (`key`, `api_key`, `access_token`, `token`, `password`, etc.) and URL userinfo are redacted while host replacement remains intact.
