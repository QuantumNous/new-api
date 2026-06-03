# Follow-up: claude-format error passthrough surfaces upstream `error.type` as `"<nil>"`

> Tracked here because GitHub issues are disabled on `SolveaCX/new-api`. **Separate from PR #51** (BlockRun VIP native passthrough) — this lives in the shared `relay/channel/claude/` error path and affects **all** Claude-format channels, not just BlockRun.
> Discovered: 2026-06-03, during E2E verification of PR #51. Severity: **low** (fidelity, not security).

## Symptom

A Claude-format (`/v1/messages`) request that hits an **upstream error** is surfaced to the client in the correct native Anthropic envelope, but the inner `error.type` is the literal string `"<nil>"` instead of the real Anthropic type. The `message` is preserved correctly.

## Repro

```
POST /v1/messages
{"model":"<a claude model>","max_tokens":16,"thinking":{"type":"enabled","budget_tokens":2000},"messages":[{"role":"user","content":"hi"}]}
```

`thinking.budget_tokens >= max_tokens` is invalid → upstream Anthropic returns HTTP 400.

### Observed (HTTP 400)

```json
{"type":"error","error":{"type":"<nil>","message":"`max_tokens` must be greater than `thinking.budget_tokens`. ..."}}
```

### Expected

```json
{"type":"error","error":{"type":"invalid_request_error","message":"..."}}
```

The upstream Anthropic `error.type` should pass through verbatim.

## Likely area / hypothesis

- `relay/channel/claude/relay-claude.go` — `GetClaudeError()` and the `types.WithClaudeError(...)` branches (≈ lines 790, 897).
- The `NewAPIError` → Claude-format error JSON output path.

Hypothesis: when the upstream 400 body is not recognized/parsed as a `ClaudeError` (so `GetClaudeError()` yields nil / empty `Type`), new-api falls back to a generic `NewAPIError` whose type field renders via `fmt`-of-nil → `"<nil>"` in the Claude error shape. Root cause TBD.

## Impact

Clients that branch on `error.type` (retry/classification logic) receive a useless `"<nil>"`. No sensitive data leaks; `message` intact.

## Status

Open / unassigned. Fix should be scoped to the shared Claude error handler and verified against a Claude-format channel returning an upstream 4xx.
