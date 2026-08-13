# GitHub Copilot channel design

## Status

Proposed. This document records the reviewed implementation plan; it does not
enable GitHub Copilot traffic.

## Scope and non-goals

Add a first-class **GitHub Copilot** channel. It is distinct from the existing
ChatGPT subscription/Codex channel:

- Codex uses ChatGPT OAuth and `chatgpt.com/backend-api/codex/...`.
- Copilot uses a GitHub OAuth App Device Flow credential and calls
  `https://api.githubcopilot.com` directly.

Version 1 supports `/chat/completions` and native Claude `/v1/messages`,
including stream/non-stream after account-backed verification. It explicitly
rejects Responses, Embeddings, Images, Gemini, and `stream_options` until each
is independently proven against supported Copilot accounts.

## Channel identifier

Allocate **`ChannelTypeCopilot = 112`**, move `ChannelTypeDummy` to `113`, and
append `APITypeCopilot` immediately before `APITypeDummy`.

`58` is not available: it is `ChannelTypeKuaiziLizhen` in this repository.
IDs `59-99` are intentionally reserved for upstream compatibility. `112` is
the first currently unused downstream value following `ModelAPISeedance=111`.

The default base URL is `https://api.githubcopilot.com`, but direct mode must
always use the official host rather than a user-provided URL.

## Credential and OAuth flow

### Credential mode

The console starts GitHub Device Flow,
   displays the verification URL and one-time user code, then polls GitHub.
   This is not a redirect callback like Codex PKCE OAuth.

On successful Device Flow authorization, the server stores the GitHub access
token directly in the target channel. It never returns the credential to the
browser. The OAuth App Client ID is configured in system settings and must be
owned by, or approved for, the organization; never embed a third-party Client
ID.

### Required safety properties

- Keep `device_code` server-side in the session, bound to authenticated admin,
  target channel (or an explicit pending-create flow), creation time, and TTL.
- Polling reads that server-side record only; it never trusts a device code
  supplied by the browser.
- Handle `authorization_pending`, `slow_down`, `expired_token`, `access_denied`
  and one-time completion cleanup.
- Credential writes use model/service write paths that refresh the local
  channel cache and publish `ConfigScopeChannels`; never use a direct GORM
  update that leaves router replicas stale.
- First release permits one credential per channel. Multi-key support is a
  later extension requiring transactional/CAS updates to `ChannelInfo`.

## Direct Copilot authorization

The OAuth App access token returned by Device Flow is used directly as the
Bearer credential. The channel does not call `/copilot_internal/v2/token` and
does not maintain a short-lived-token cache. Relay requests include the
Copilot-compatible `User-Agent`, `Openai-Intent`, `X-GitHub-Api-Version`,
`X-Initiator`, and a per-request `X-Request-Id`; native Claude calls also send
`Accept: text/event-stream` and `anthropic-version: 2023-06-01`.

## Relay implementation

Create `relay/channel/copilot/` with a dedicated adaptor. It must not reuse
the Codex adaptor or silently convert request types.

- `GetRequestURL`: direct chat route only.
- `SetupRequestHeader`: resolve short token through service; set Bearer auth,
  `editor-version`, `editor-plugin-version`, `Copilot-Integration-Id`, and
  `User-Agent` from centralized, versioned configuration.
- `ConvertOpenAIRequest` and `DoResponse`: reuse only the existing OpenAI
  compatibility behavior shown to match the verified Copilot chat contract.
- All unverified `Convert*` methods return a clear unsupported-endpoint error.
- Do not accept client-provided editor identity headers by default. Any header
  override follows existing administrator-controlled whitelist/override rules.

No automatic proxy mode is included. In particular, a non-official Base URL
must not receive a GitHub OAuth credential in `X-GitHub-Token`. A later proxy feature needs
an explicit mode, SSRF validation, security review, and separate credentials.

## Repository touch points

| Area | Required change |
| --- | --- |
| `constant/channel.go`, `constant/api_type.go`, `common/api_type.go` | Add type 112, default base URL/name, API mapping. |
| `relay/relay_adaptor.go` | Register dedicated Copilot adaptor. |
| `relay/channel/copilot/` | Chat and native Claude adaptor, response handling, contract tests. |
| `service/` | Device Flow and multi-node-safe credential write. |
| `controller/`, `router/api-router.go` | Thin admin-only Device Flow start/poll endpoints; secure channel credential update. |
| `model/channel.go` | Reuse channel write/invalidation flow; add no direct raw SQL. |
| `web/default/src/features/channels/` | Type metadata, direct-mode configuration, Device Flow dialog/status. |
| `web/default/src/i18n/locales/*.json` | Translate every new console key in all eight locales, then run `bun run i18n:sync`. |
| `setting/ratio_setting/` | Add prices only for account-verified models; otherwise require administrator-managed pricing. |

Do not add a database migration solely for a channel type: type and key already
live in existing `Channel` fields. A future durable Device Flow record would
need a cross-DB GORM migration only if sessions cannot safely hold its state.

## Source evaluation

The reference fork is `zhangdaozhu/new-api@557234a`, introduced in
[`de04c3a`](https://github.com/zhangdaozhu/new-api/commit/de04c3aa4bc1d808576714bdcd94bb16869a0ef8)
and last changed in
[`a17ec2b`](https://github.com/zhangdaozhu/new-api/commit/a17ec2b3afbee984d14d306f4027803c6d1c3c2a).
Its protocol endpoints and headers are useful research inputs only.

Do not port its type ID, process-local raw-token map, global lock around I/O,
direct database writes, unbound device-code polling, third-party Client ID reuse,
stale model list, list-page quota N+1 calls, SDK `ApproveAll`, or request
rewrites to Responses. The code changed protocol strategy rapidly during April
2026 and relies on an undocumented GitHub internal API.

## Test and release gates

Tests must cover Device Flow session binding/expiry/one-time consumption;
direct OAuth Bearer forwarding and native Claude routing; no secret
in errors or logs; direct chat stream/non-stream/tools; model mapping; upstream
error sanitization; and rejection of unverified endpoints. Verify the flow with
a dedicated entitled GitHub account before enabling production traffic.

Run targeted Go tests, `go test ./relay/... ./service/... ./controller/...`,
`go build ./...`, console typecheck, and i18n synchronization. Add contract
tests that can be run only when explicitly supplied with non-production test
credentials; never include credentials in repository tests.

**Router deploy: required.** The change affects relay routing, upstream auth,
and shared runtime cache behavior. If console authorization UI ships, deploy
`newapi-console` as well. `newapi-web`, Terraform, and Cloudflare are not
affected.

## Review record

The plan was reviewed through an autoresearch professor/critic rubric. The
review confirmed full current-repository seam mapping and rejected the fork's
credential-cache, multi-node invalidation, identifier, and endpoint-assumption
patterns. Remaining product/legal gate: confirm that the intended GitHub
Copilot usage and undocumented internal endpoints are acceptable before
implementation.
