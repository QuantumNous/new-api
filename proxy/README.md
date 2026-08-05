# proxy — prompt audit sidecar for new-api

Records the prompts users submit to a new-api instance, **without modifying
new-api itself**.

`proxy` is a transparent reverse proxy that sits in front of new-api. It
buffers each relay request body, extracts the prompt text, resolves the calling
user, and writes an audit row asynchronously. The response is streamed straight
through untouched.

```
clients / Nginx ──▶ prompt-audit :3001 ──▶ new-api :3000   (official image, unmodified)
                          │ async
                          └──▶ prompt_audit_logs
```

## Why a sidecar instead of middleware

The requirement was to add auditing without touching existing code and without
disturbing future upstream upgrades. In-process middleware cannot satisfy that:

- new-api has no relay-level plugin or hook mechanism.
- `main.go` builds the gin engine as a **local variable** and every `Use(...)`
  is a literal call, so there is no seam an added file could hook. Registering a
  gin middleware on the `/v1` relay chain requires editing `router/relay-router.go`.
- Hijacking internal package variables from an `init()` would "work", but when
  upstream renames something the audit trail **fails silently** — the worst
  possible failure mode for a compliance feature.

A sidecar has none of those problems:

| Property | Result |
|---|---|
| Files modified in new-api | **none** — this directory is the only new path |
| Upgrading new-api | bump the image tag; no rebuild, no merge conflict |
| Coupling to upstream internals | none — only the public HTTP API shape and two `tokens` columns |
| Failure visibility | the proxy is a process with a health check, so failure is observable |

## How records are correlated with new-api's own logs

`middleware.RequestId()` always generates its own id and ignores inbound headers,
so the proxy cannot inject a correlation id. It does not need to: new-api writes
that id back on the **response** as `X-Oneapi-Request-Id`. The proxy reads it off
the response and stores it, which makes the audit row joinable to `logs`:

```sql
SELECT a.created_at, a.username, a.model, a.prompt_text,
       l.prompt_tokens, l.completion_tokens, l.quota
FROM prompt_audit_logs a
LEFT JOIN logs l ON l.request_id = a.request_id
ORDER BY a.created_at DESC
LIMIT 50;
```

If new-api is configured with a separate `LOG_SQL_DSN`, `logs` lives in another
database and the join has to happen in your query layer instead.

## Identity resolution

`tokens.key` is stored in plain text with a unique index, so the proxy resolves
the caller with two read-only lookups (`tokens`, then `users`), cached with a TTL.
Key normalisation mirrors new-api's `TokenAuth` exactly — strip `Bearer `, strip
`sk-`, keep the segment before the first `-` — and covers the OpenAI
(`Authorization`), Claude (`x-api-key`) and Gemini (`x-goog-api-key`, `?key=`)
conventions. The key itself is never stored.

Set `identity.enabled: false` to skip this and keep the audit database fully
decoupled from new-api's schema.

## Deploy

The proxy runs as its **own Compose project**, deliberately not as part of
new-api's. It is built from source on the target host — no image registry needed:

```bash
git pull
cd proxy
docker compose -f docker-compose.sidecar.yml up -d --build
```

Then send traffic to port **3001** instead of 3000.

The build needs to download Go modules. `go.sum` is committed so the resolution is
deterministic and the dependency layer stays cached, but the host still has to
reach a module proxy. Where `proxy.golang.org` is unreachable, pass a mirror:

```bash
docker compose -f docker-compose.sidecar.yml build --build-arg GOPROXY=https://goproxy.cn,direct
```

For a host with no outbound access at all, commit a `vendor/` directory
(`go mod vendor`) and add `-mod=vendor` to the build.

Only this sidecar is built. **new-api itself should keep running its official
prebuilt image** — nothing in new-api is modified, so building it from a fork costs
a full Bun frontend build plus a Go build while producing a functionally identical
artifact, and gives up upstream's tested image. Pin its tag rather than using
`latest`.

There is intentionally **no `docker-compose.override.yml`**. Compose auto-loads
that filename for every `docker compose` command, which would mean a plain
`docker compose up -d` intended just to restart new-api also starts this proxy —
and a failed sidecar build would abort new-api's own upgrade. Keeping the sidecar
in a separate project leaves `up`, `restart`, `down` and `pull` on new-api behaving
exactly as they did before, and rollback is
`docker compose -f docker-compose.sidecar.yml down`.

> ⚠️ new-api's own compose file publishes it on 3000, and this proxy cannot change
> that. Restrict 3000 at the network layer (firewall, or reverse-proxy only 3001)
> or callers can reach new-api directly and bypass auditing.

Check status:

```bash
curl -s http://localhost:3001/proxy/healthz
```

## Configuration

See [`config.yaml`](config.yaml) for the annotated set. Anything sensitive can
come from the environment instead: `PROXY_LISTEN`, `PROXY_UPSTREAM`,
`PROXY_NODE_NAME`, `PROXY_DB_DRIVER`, `PROXY_DB_DSN`.

The one setting worth deciding deliberately:

- `fail_open: true` (default) — **availability first.** Relay traffic is never
  delayed or rejected because of auditing. Records that cannot be written are
  spooled to disk and replayed.
- `fail_open: false` — **compliance first** ("no audit, no service"). The proxy
  refuses to start without a working audit database and answers `503` when the
  audit buffer is saturated.

Prompts are sensitive data. `store_raw_body` is off by default so only extracted
prompt text is kept, and `redact_patterns` masks matches before anything is
persisted.

### `prompt_scope` — what counts as "the prompt"

Agent clients resend their entire system prompt and conversation history on every
turn. Measured on a real Codex `/v1/responses` request:

| part of the extracted text | bytes | share |
|---|---|---|
| `developer` (the client's own instructions and tool docs) | 40735 | 93.2% |
| `user` (all 14 turns of history) | 2481 | 5.7% |
| `assistant` | 261 | 0.6% |

The input the user actually typed that turn was **6 bytes** of 43714 — and the
same 43 KB is stored again on every turn.

- `last_user` (default) — only the final user message. One row is one thing the
  user submitted, with no duplication across turns.
- `user_only` — every user-authored message, dropping developer, system and
  assistant text. Still repeats history each turn.
- `all` — everything, prefixed with each segment's role. For forensic use.

The restrictive scopes deliberately **discard the system/developer prompt**, which
matters if an audit has to establish which instructions were in force or has to
investigate injection through developer messages. Choose accordingly.

Formats where the user's input carries no role at all — an image request's
`prompt`, a rerank `query`, an embedding `input` — are attributed to the user, so
they survive every scope.

Scoping is driven by the API format, not by the client, so it works for any tool
speaking one of those formats. One client shape needs special handling: **the
Anthropic format returns tool results as `role: "user"` messages** holding
`tool_result` blocks, which is what Claude Code and similar agents do. Tool blocks
are therefore attributed to a `tool` role regardless of the message they arrive in,
so an agent's file contents and command output are never recorded as the user's
prompt. In an agent loop the user-scoped result is the request the user actually
made, repeated on each iteration. OpenAI's chat format already uses `role: "tool"`,
and the Responses format keeps results in fields that are never followed.

`max_prompt_bytes` and `max_raw_body_bytes` are **byte** limits, not character
limits, because that is what the database column enforces — MySQL `TEXT` holds
65535 bytes, and an oversized value fails its insert. Both are clamped to 60000
bytes (logged when it happens). Long CJK conversations are exactly the case a
character-based cap would get wrong, since one character can cost three bytes.

Every startup logs the effective configuration, including which values an
environment variable overrode. A stale config file or an unnoticed override is
otherwise indistinguishable from a bug in the audit pipeline.

## Reliability model

Recording never blocks a relay request:

1. `Enqueue` writes into a bounded channel; if it is full the record is dropped
   and counted (reported in logs and on the health endpoint).
2. A single worker batches inserts on size or interval.
3. If the batch insert fails, the rows are retried **individually**, so one bad
   record (an oversized prompt, say) cannot cost every other record that happened
   to share its batch. Only the rows that still fail are written to the spool
   directory as JSONL and replayed periodically.

Retries reset primary keys, so a batch that was partially committed before
failing can produce duplicate rows. That is deliberate: for an audit trail a
duplicate is recoverable and a missing row is not.

## Limitations

- **Request side only.** Responses are not captured, which is what keeps SSE and
  WebSocket relaying completely untouched.
- Multipart endpoints (`/v1/audio/transcriptions`, `/v1/audio/translations`) are
  not audited by default — their bodies are binary, not prompts.
- Bodies larger than `max_body_bytes` still stream through in full, but only the
  captured prefix is inspected and the row is marked `truncated`; prompt
  extraction will usually fail on a truncated JSON document.
- Compressed request bodies (`Content-Encoding: gzip` / `deflate`) are decoded
  **for auditing only** — a copy is decompressed for extraction while the bytes
  forwarded upstream stay byte-identical. Other encodings (e.g. `br`) are recorded
  without extraction.
- If the audit database is unreachable **at startup** with `fail_open: true`, the
  proxy runs in spool-only mode until it is restarted, because `AutoMigrate` has
  not run yet.

## Development

This module is independently buildable and **must not import any package from
the root new-api module**:

```bash
cd proxy
GOWORK=off go build ./...
GOWORK=off go test ./...
```

Dependency versions are pinned to the same versions the root module uses so the
shared module cache is reused. Because the module cannot import the root
module's `common` package, it uses `encoding/json` directly; the project rule
requiring `common.Marshal`/`common.Unmarshal` applies to the root module only.

`go.sum` is generated on first `go mod tidy` / `docker build`. Commit it once a
Go toolchain is available, then optimise the Dockerfile back to a cached
`COPY go.mod go.sum ./` + `go mod download` layer.
