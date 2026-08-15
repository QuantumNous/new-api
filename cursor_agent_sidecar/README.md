# Cursor Agent Sidecar

Official `@cursor/sdk` HTTP bridge for new-api channel type **61 (Cursor Agent)**.

## Boundary

- Auth: Cursor **User API Key** (`crsr_…` / `CURSOR_API_KEY`), not email/password
- No reverse-engineered Cursor private Connect-RPC client
- new-api converts Chat Completions and Responses requests to native Anthropic
  Messages before they reach this sidecar.
- `/v1/messages` tool requests use the official Cursor SDK harness with
  `tools: ["mcp"]` and per-run `local.customTools`. The first request parks all
  callbacks observed in the same assistant turn and returns a native Anthropic
  `tool_use` batch; a later request carrying the exact matching `tool_result`
  batch resumes the same live SDK Run. Agent/checkpoint metadata and a minimal
  credential-free bridge journal are stored on the slot's persistent volume;
  after an unexpected process restart the bridge resumes the persisted agent,
  expires the stranded run, and continues from the submitted tool results.
- Surface: `POST /v1/messages`, `GET /v1/models`, `GET /v1/account`, and
  `GET /health`. The new-api gateway serves `/v1/messages/count_tokens` with a
  local estimate because the Cursor SDK does not expose a token-count method.
- This is **not** native Anthropic OAuth; Claude, Grok, and Composer SKUs come
  from Cursor's model catalog and execute inside Cursor's official harness.
- Each gateway instance owns one stateful SDK worker and one persistent state
  directory. Every tool id includes the owning container instance. Multi-instance
  deployments must keep tool continuations sticky to the owning instance or
  configure an allowlisted peer route with
  `CURSOR_AGENT_PEER_BASE_URL_TEMPLATE` and `CURSOR_AGENT_PEER_INSTANCE_IDS`.
  Releases can put the old worker
  into drain mode, reject new sessions there, and stop it as soon
  as all live/replay sessions finish (15 minutes is only the hard deadline).
  Unexpected process restarts use the official SDK store plus the bridge journal
  for cold continuation. new-api owns channel/user concurrency limits. Prompt
  cache controls, computer use, and Responses compaction remain absent. Anthropic
  thinking is mapped to Cursor's official model `effort` parameter. The SDK does
  not expose Anthropic `max_tokens`, temperature, top_p, or stop-sequence controls,
  so generation limits remain harness-owned rather than raw Messages semantics.

The worker limits live sessions globally and per Cursor credential (defaults:
256 and 32). new-api also binds every tool continuation to the originating
gateway user/token/channel identity before it can resume.

## Run

The official Docker image starts this worker automatically beside new-api and
persists its restart metadata under `/data/cursor-agent`. Add a Cursor Agent
channel, paste a Cursor User API Key, and leave Base URL empty. Set
`CURSOR_AGENT_EMBEDDED_SIDECAR=0` only when operating an external worker.
The admin account dialog gets identity/catalog data through the official SDK;
remaining-spend data is a best-effort call to Cursor's Dashboard RPC and
degrades to “unavailable” without affecting inference if that endpoint changes.

### Direct egress (default)

```bash
cd cursor_agent_sidecar
npm install
./start.sh
# listens 127.0.0.1:3927
```

### CN / laptop (Claude region block)

Cursor Agent often **bypasses system HTTP_PROXY** (HTTP/2), so Claude fails with
“provider is not supported in your region” even with a US browser exit.

```bash
CURSOR_AGENT_FORCE_PROXY=1 \
CURSOR_AGENT_PROXY=http://127.0.0.1:7890 \
./start.sh

# strongest TCP wrap:
PROXYCHAINS=1 CURSOR_AGENT_FORCE_PROXY=1 ./start.sh

npm run smoke:claude   # expect PROXY_CLAUDE_OK
```

## new-api channel

| Field | Value |
|---|---|
| Type | `61` Cursor Agent |
| Key | User API Key from `Cursor.auth.login()` or Dashboard |
| Base URL | leave empty (`http://127.0.0.1:3927` is the default) |
| Models | bare SKUs e.g. `composer-2.5`, `claude-opus-5`, `claude-fable-5` |

## Smoke

```bash
curl -s http://127.0.0.1:3927/health
curl -s http://127.0.0.1:3927/v1/messages \
  -H "x-api-key: $CURSOR_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{"model":"composer-2.5","max_tokens":64,"messages":[{"role":"user","content":"Reply SMOKE_OK"}],"stream":false}'
```
