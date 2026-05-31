## Context

The gateway today routes `POST /v1/responses` through a single relay dispatch and supports two upstream surface families: OpenAI-compatible (`/v1/chat/completions`, `/v1/responses` on OpenAI itself) and Anthropic Messages (`/v1/messages`). When a `/v1/responses` request is routed to an Anthropic-typed channel, no translation layer exists for either the request body or the streaming response, so the request fails. Adding the missing pipeline lets a single inbound request shape (Responses-API) be served by either upstream family.

The reference behavioral surface (analyzed externally, source-free) establishes a stable contract: a **two-step pivot** through an intermediate Chat-Completions-shaped object, on both the request side and the response side. Reusing that pivot keeps each translator focused and gives a clean composition: Responses ↔ Chat-Completions ↔ Anthropic.

The existing codebase already covers the Chat-Completions ↔ Anthropic legs end-to-end:

- `relay/channel/claude/relay-claude.go::RequestOpenAI2ClaudeMessage` — Chat-Completions request → Anthropic Messages request. Already handles system extraction, tool_use/tool_result ordering, image mapping (data: vs http:), `max_tokens` adjustment for thinking and tools, response_format JSON-mode shim, and merge of consecutive same-role messages.
- `relay/channel/claude/relay-claude.go::ClaudeStreamHandler` (+ `StreamResponseClaude2OpenAI`, `FormatClaudeResponseInfo`) — streaming Anthropic response → Chat-Completions chunks, including cache-token decomposition and finish_reason mapping.
- `relay/channel/claude/relay-claude.go::ClaudeHandler` (+ `ResponseClaude2OpenAI`) — non-streaming Anthropic response → Chat-Completions response.

The only legs that do NOT yet exist are: Responses-request → Chat-Completions-request, and Chat-Completions-stream → Responses-events (plus a non-streaming variant of the latter). This change therefore adds exactly those legs as new functions under `service/openaicompat/`, plus one orchestration file under `relay/` that mirrors the existing `relay/chat_completions_via_responses.go` in the opposite direction.

Other anchors used by this change:

- The relay format dispatch keys off `info.RelayMode == relayconstant.RelayModeResponses` and `info.ApiType == appconstant.APITypeAnthropic`; the new translation triggers at that exact branch in `relay/responses_handler.go`.
- The project's JSON wrapper (`common.Marshal`/`common.Unmarshal`) is mandatory (project Rule 1).
- Env-var feature flags follow the `common.GetEnvOrDefaultBool("FLAG_NAME", default)` pattern (see `common/env.go`).

## Goals / Non-Goals

**Goals:**
- Provide a complete, source-free behavioral specification of the two pipelines (request and response).
- Maintain a clean separation: each translator function takes a body or chunk and returns the next-stage body or chunk, with no I/O side effects.
- Preserve all existing behavior for non-Anthropic upstreams and for non-Responses inbound requests.
- Express each behavioral invariant as an objectively checkable requirement in the capability spec.
- Establish a per-stream state object that survives across chunk callbacks (sequence numbers, item indices, buffered reasoning text, tool-call open/close state).

**Non-Goals:**
- Picking the final Go package path (left for Phase 3).
- Specifying internal struct names (left for Phase 3, beyond placeholders).
- Modifying quota, billing, retry, or auto-ban behavior.
- Adding new channel adaptors or external dependencies.

## Decisions

### D1. Two-step pivot through a Chat-Completions intermediate

The translator does **not** map Responses-API ↔ Anthropic Messages directly. It maps Responses → ChatCompletions → AnthropicMessages on the request side, and AnthropicMessages → ChatCompletions → Responses on the response side.

- *Why*: The Chat-Completions shape is the most stable and most widely-implemented "lingua franca" inside the gateway (the existing OpenAI-compatible path already uses it). Pivoting through it means the new code only adds two missing legs (Responses↔ChatCompletions on the request side, ChatCompletions→Responses on the response side) and reuses the existing ChatCompletions↔Anthropic legs.
- *Alternative considered*: Direct Responses↔Anthropic translator. Rejected — doubles the surface area we need to maintain, and creates a second source of truth for tool-use ordering and reasoning passthrough.

### D2. Stateful streaming translators

Streaming translators take `(chunk, state)` and return `(events[], state')`. The state object holds: sequence counter, open item indices, buffered reasoning text, tool-call index → call_id map, "started/completed sent" flags, accumulated usage. Translators only emit events; they do not write to a socket.

- *Why*: Lets the outer SSE handler stay protocol-agnostic and lets us unit-test the translators with deterministic chunk-by-chunk inputs.
- *Alternative considered*: Pure functional translators with no state. Rejected — Responses-API events carry monotonically increasing `sequence_number` and require open/close bookkeeping across many chunks.

### D3. Open/close discipline for content blocks

The streaming translator enforces the Responses-API contract:
1. `response.created` and `response.in_progress` fire exactly once each at first usable chunk.
2. Each `output_item` (message, reasoning, function_call) is bracketed by `output_item.added` and `output_item.done`; deltas only fire between them.
3. Switching from reasoning to text closes the reasoning block before opening the text block. Switching from text to a tool call closes the text block before opening the tool-call item.
4. On finish, every open block is closed in deterministic order before `response.completed` fires.
5. A `null` chunk (end-of-stream sentinel from the SSE reader) triggers the flush path which closes any still-open blocks and emits `response.completed` exactly once.

### D4. Tool-call ID hygiene at the boundary

The Anthropic API requires tool IDs to match `^[a-zA-Z0-9_-]+$` and the Responses API caps tool IDs at 64 characters. The translator follows a three-tier sanitization policy on the upstream Anthropic side:

1. **Pass-through** when the ID already matches the regex AND is ≤ 64 characters.
2. **Strip-and-keep** when the ID contains some invalid characters: drop every char not in `[a-zA-Z0-9_-]`; if the residue is non-empty AND ≤ 64 characters, use the residue.
3. **UUID fallback** when the ID is empty, becomes empty after stripping, or exceeds 64 characters: generate a fresh UUID (no deterministic synthesis, no positional encoding).

On the OUTBOUND Responses-side, IDs longer than 64 characters are clamped to the first 64 characters.

- *Why*: pass-through preserves client-supplied IDs that already pass; strip-and-keep recovers common patterns like `call:abc/123` losslessly; UUID fallback is simpler than positional synthesis and avoids leaking message-index/tool-call-index information to clients. Determinism for prompt-cache continuity is unnecessary because the upstream cache key is computed by Anthropic from the prompt content, not from tool-call IDs.

### D5. Tool-result placement repair

Anthropic requires that each `tool_use` block in an assistant message be followed immediately by a separate user message whose content is the matching `tool_result` block. The translator:
- Splits any user message that mixes `tool_result` with other content; the `tool_result` goes first in its own message.
- Drops assistant text blocks that appear AFTER a `tool_use` block in the same message (Anthropic rejects them).
- Merges consecutive same-role messages after the split.
- If an assistant message contains tool_calls and the next message has no matching tool_result, injects an empty tool_result for each missing call so the upstream does not 400.

### D6. Reasoning passthrough has two modes

- **Reasoning as a separate output item** (preferred for clients that understand Responses-API reasoning items): when the upstream emits `reasoning_content` deltas, the translator opens a `reasoning` output item and emits `reasoning_summary_text.delta` events.
- **Reasoning embedded as `<think>...</think>` in text content**: legacy upstreams put thinking text inline. The translator recognises `<think>` and `</think>` markers in the text stream and routes the enclosed text into the reasoning channel instead of the text channel.

### D7. Usage propagation is lossless across the pivot

Cache tokens flow through the pivot without being dropped:
- Anthropic `cache_read_input_tokens` → Chat-Completions `prompt_tokens_details.cached_tokens` → Responses `input_tokens_details.cached_tokens`.
- Anthropic `cache_creation_input_tokens` → Chat-Completions `prompt_tokens_details.cache_creation_tokens`.
- `input_tokens = prompt_tokens − cached_tokens − cache_creation_tokens` is the canonical decomposition rule applied at the Chat-Completions → Anthropic hop.

### D8. `max_tokens` adjustment is upstream-friendly

The translator:
- Falls back to a default `max_tokens` if the client did not provide one.
- Raises `max_tokens` to a configurable minimum when `tools[]` is non-empty (prevents truncated tool arguments).
- Raises `max_tokens` above `thinking.budget_tokens + buffer` (Anthropic requires strictly greater).

### D9. System prompt extraction and JSON-mode shim

- All `role: "system"` messages in the intermediate Chat-Completions shape are concatenated and lifted to the Anthropic `system` block list.
- A Responses-API `instructions` field is treated as a single system message at the head of the message list.
- `response_format = json_schema` appends a system block telling the model to emit strict JSON matching the supplied schema. `response_format = json_object` appends a generic strict-JSON instruction. (Anthropic has no native equivalent.)

### D10. Image input mapping

- Responses-API `input_image` with `image_url` (string) becomes intermediate `image_url` with `{ url, detail: "auto" }`.
- Intermediate `image_url` whose URL starts with `data:<mime>;base64,...` becomes Anthropic `image` with `source: { type: "base64", media_type, data }`.
- Intermediate `image_url` whose URL starts with `http://` or `https://` becomes Anthropic `image` with `source: { type: "url", url }`.
- Any other URL shape is dropped (Anthropic does not support arbitrary file IDs natively).

### D11. Reasoning items in INPUT

When a `reasoning` input item appears between turns, its text is extracted (from `summary[].text` if present, else from `content[].text`) and **buffered** until the next assistant message or function_call; it is then attached as `reasoning_content` to that assistant turn. A `reasoning` item is never emitted as a standalone Chat-Completions message.

### D12. Format detection by endpoint

The dispatch decision uses the endpoint path as the primary key: `/v1/responses` → Responses-API source format, `/v1/messages` → Anthropic source format, `/v1/chat/completions` with a body field that looks like Responses-API → Responses-API source (for CLI clients that send Responses bodies to the chat endpoint).

## Risks / Trade-offs

- **[Risk]** Streaming SSE order is observable to clients; a bug in open/close discipline produces malformed `output_item` brackets that crash strict SDKs.
  - **Mitigation**: Behavioral assertions in the spec pin down exact event ordering; tests cover the cross-block transitions (reasoning→text, text→tool_call, finish flush, null-flush).
- **[Risk]** Tool-call ID UUID fallback assigns a fresh UUID when the client's ID fails the regex AND has no usable residue; the client cannot correlate the resulting tool_use back to its original local ID.
  - **Mitigation**: UUID fallback only triggers when the original ID is unrecoverable. The strip-and-keep tier handles the common case (`call:abc/123` → `callabc123`) without losing correlation. Document the policy in the operator-facing notes.
- **[Risk]** Token-usage decomposition (`input − cached − cache_creation`) underflows to negative when upstreams report inconsistent values.
  - **Mitigation**: Clamp to zero; document the invariant in the spec.
- **[Risk]** The intermediate Chat-Completions pivot adds latency on the request-build path.
  - **Mitigation**: All translation is pure-CPU JSON shape rewriting; profile after first integration test pass.
- **[Risk]** The Anthropic `thinking` block requires `max_tokens > budget_tokens`; clients may set both and break the upstream.
  - **Mitigation**: Translator raises `max_tokens` automatically; documented in the spec.
- **[Trade-off]** We do not attempt to round-trip every Responses-API field (`store`, `background`, `prompt_cache_key`, `include`). These are stripped silently. Clients that rely on them get no error but no behavior change either. Phase 3 may decide to surface a warning.

## Migration Plan

- This is additive. No data migration. No client-visible change for requests that previously succeeded.
- Rollout: feature flag `RESPONSES_TO_ANTHROPIC_ENABLED` read via `common.GetEnvOrDefaultBool("RESPONSES_TO_ANTHROPIC_ENABLED", true)`, **default `true`**. Operators who want the prior "not implemented" behavior can set `RESPONSES_TO_ANTHROPIC_ENABLED=false`.
- Rollback: set the flag to `false`; the gateway falls back to the existing `adaptor.ConvertOpenAIResponsesRequest` path which returns the pre-change error.

## Locked decisions

- **Package placement** — confirmed: shape converters in `service/openaicompat/`, orchestration in `relay/responses_via_chat_completions.go`.
- **Public translator entry-point names** — confirmed: `ResponsesRequestToChatCompletionsRequest`, `ChatCompletionsStreamToResponsesEvents`, `ChatCompletionsResponseToResponsesResponse`.
- **Per-stream state struct** — confirmed: `ResponsesStreamState` exported from `service/openaicompat/`.
- **OAuth tool-name prefix** — confirmed: not applicable; no prefix is applied and no name-mapping table is kept.
- **JSON-mode system-prompt strings** — confirmed: hard-coded English.
- **Tool-call ID strategy** — confirmed: pass-through / strip-and-keep / UUID fallback (D4 above). No deterministic positional synthesis.
- **Feature flag default** — confirmed: `RESPONSES_TO_ANTHROPIC_ENABLED=true` (default ON).
