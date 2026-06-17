## Why

Clients of the gateway today can hit `POST /v1/responses` (OpenAI Responses API shape) and expect to be served by any routed upstream channel. The relay supports OpenAI-compatible upstreams and Anthropic `/v1/messages` upstreams independently, but when a `/v1/responses` request is routed to an Anthropic-typed channel the gateway has no end-to-end translation path: the request shape cannot be forwarded to `/v1/messages` as-is, and the upstream streaming events cannot be re-encoded into Responses-API events without a translation layer.

This change introduces that translation layer so a single Responses-API request can be served transparently by an Anthropic upstream, with full feature parity for streaming text, reasoning (thinking) passthrough, multi-turn tool use, image input, system prompt extraction, JSON-mode hints, and token usage (including prompt cache tokens) propagation.

## What Changes

- **New translation pipeline** for inbound requests: Responses-shaped request → Chat-Completions-shaped intermediate → Anthropic Messages-shaped request, wired into the existing relay format dispatch so that routing a `/v1/responses` request to an Anthropic-typed channel succeeds instead of returning "not implemented".
- **New translation pipeline** for outbound responses (both streaming SSE and final non-streaming): Anthropic Messages event stream → Chat-Completions chunk shape → Responses-API event stream, including correct `response.created` / `response.in_progress` / `response.output_item.added` / delta / `response.completed` event ordering and sequence numbering.
- **Reasoning passthrough**: when the upstream emits a `thinking` block, the gateway re-emits it as Responses-API `reasoning` output items with proper `reasoning_summary_text.delta` / `reasoning_summary_text.done` / `reasoning_summary_part.done` / `output_item.done` event sequencing. `<think>...</think>` inline markers in regular text are also recognised and rerouted.
- **System prompt extraction**: a Responses-API `instructions` field, or a `system` message in an intermediate shape, is lifted into the Anthropic `system` block list with proper cache_control handling.
- **Tool use round-tripping**: tool declarations, tool calls, and tool results are converted in both directions; tool-use blocks and their tool_result counterparts are placed in adjacent Anthropic messages per Anthropic API rules; missing tool results are auto-injected as empty before forwarding upstream; assistant text emitted after a `tool_use` block is dropped; consecutive same-role messages are merged.
- **Tool-call ID hygiene**: every tool call must have an ID. IDs that already match the Anthropic-compatible regex `^[a-zA-Z0-9_-]+$` and are ≤ 64 characters are passed through unchanged. IDs that contain invalid characters are sanitized by stripping non-`[a-zA-Z0-9_-]` characters and keeping the result if non-empty; otherwise a fresh UUID is generated as the replacement. IDs longer than 64 characters are clamped at the Responses-side boundary. Nameless tool calls and hosted (no-name) tool declarations are filtered out before forwarding upstream.
- **`max_tokens` clamp**: `max_tokens` is set from the request, raised to a configurable minimum when tools are present (to avoid truncated tool arguments), and raised above `thinking.budget_tokens + buffer` when the upstream is in thinking mode (Anthropic requires `max_tokens > budget_tokens`).
- **Image input mapping**: Responses-API `input_image` items are converted to intermediate `image_url`, then to Anthropic `image` blocks; `data:` URLs become `base64` sources and `http(s)` URLs become `url` sources.
- **Reasoning-effort mapping**: a Chat-Completions-shaped `reasoning_effort` enum (none/low/medium/high/xhigh) is converted to a Claude `thinking.budget_tokens` value when no explicit `thinking` block is present.
- **Response-format mapping**: `response_format = json_object` or `json_schema` injects an extra system-prompt block instructing the model to return strict JSON (Anthropic has no native equivalent field).
- **Usage propagation**: prompt cache read/write tokens are propagated through every translation hop. In the upstream-to-OpenAI direction, `cache_read_input_tokens` and `cache_creation_input_tokens` flow into `prompt_tokens_details.cached_tokens` and `prompt_tokens_details.cache_creation_tokens`. In the downstream-to-Responses direction, they flow into `input_tokens_details.cached_tokens`.
- **Input shape normalization**: a string `input` is wrapped as a single user message with an `input_text` part; an empty array `input[]` is replaced with a single placeholder message so the upstream does not receive `messages: []`; items with a `role` field but no `type` are treated as `message` items.
- **Reasoning items in input**: a `reasoning` input item is buffered and attached to the next assistant message as `reasoning_content`, never forwarded as a standalone message.
- **Failure mapping**: upstream `error` and `response.failed` events surface as a documented OpenAI-shaped error chunk (no duplicate emission).
- The current behavior of returning a 5xx-class "not implemented" error for `/v1/responses` requests routed to Anthropic-typed channels is **REMOVED**.

## Capabilities

### New Capabilities
- `responses-to-anthropic-translation`: end-to-end translation of OpenAI Responses-API requests and streamed responses to and from the Anthropic Messages-API shape, including request body conversion, response event re-encoding, tool-use round-tripping, reasoning passthrough, image input mapping, system prompt extraction, JSON-mode hint injection, token usage propagation (including prompt-cache token classes), and input-shape normalization.

### Modified Capabilities
- (none — this introduces a new translation pipeline rather than altering existing spec-level behavior. The change does not modify existing channel BYOK, quota, billing, retry, or auto-ban behavior.)

## Scope

**In scope (this change):**
- Request shape: Responses-API `{ input, instructions, tools, tool_choice, temperature, top_p, max_tokens, reasoning, reasoning_effort, response_format, thinking, model, stream }`
- Response stream: text deltas, reasoning deltas, tool-call deltas, finish reasons (`stop`, `length`, `tool_calls`), usage (including cache tokens)
- Both streaming and non-streaming Responses-API client modes
- Tool declarations in both `{ type: "function", function: { name, ... } }` and bare `{ type: "function", name, ... }` Responses-API forms; pass-through of built-in (non-function) tool types when target is Anthropic
- Behavioral parity for the existing flow of intermediate-Chat-Completions ↔ Anthropic Messages, since the Responses-to-Anthropic path piggybacks on it

**Out of scope (explicit non-goals):**
- File-search / web-search / computer-use / code-interpreter hosted tools on the Responses-API surface beyond pass-through of declarations
- Anthropic-side `output_config`, structured-output JSON schema enforcement, and provider-specific quirks for non-Anthropic upstreams (these are pre-existing behaviors and are not modified here)
- Persistent conversation storage (`store: true` semantics); the translator strips this field
- Background mode (`background: true` Responses-API field)
- Encrypted content reasoning items (`encrypted_content` summary fallback) beyond the documented text-extraction path
- Any change to quota, billing, log attribution, or channel selection
- Any change to the existing OpenAI-compatible `/v1/chat/completions` path

## Impact

- **Affected APIs**: `POST /v1/responses` becomes routable to Anthropic-typed channels.
- **Affected code areas**:
  - `service/openaicompat/responses_to_chat.go` (new function `ResponsesRequestToChatCompletionsRequest`)
  - `service/openaicompat/chat_to_responses.go` (new functions `ChatCompletionsStreamToResponsesEvents` + `ChatCompletionsResponseToResponsesResponse` + per-stream state struct)
  - `relay/responses_via_chat_completions.go` (new orchestration file, mirror of `relay/chat_completions_via_responses.go`)
  - `relay/responses_handler.go` (new branch when `info.ApiType == APITypeAnthropic`, calling the new orchestration before falling back to `adaptor.ConvertOpenAIResponsesRequest`)
- **Reused converters (not duplicated)**:
  - `relay/channel/claude/relay-claude.go::RequestOpenAI2ClaudeMessage` — Chat-Completions request → Anthropic Messages request (already handles tool ordering, max_tokens adjustment, image mapping, system extraction)
  - `relay/channel/claude/relay-claude.go::ClaudeStreamHandler` + `StreamResponseClaude2OpenAI` — Claude streaming response → Chat-Completions chunks
  - `relay/channel/claude/relay-claude.go::ClaudeHandler` + `ResponseClaude2OpenAI` — Claude non-streaming response → Chat-Completions response
- **Dependencies**: no new third-party dependencies; uses the project's existing JSON wrapper (`common.Marshal`/`common.Unmarshal`) and the standard library UUID/random generator.
- **Database**: no migrations.
- **Frontend**: no UI changes; the translation is transparent to clients.
- **Backward compatibility**: additive. Requests that were previously rejected ("not implemented") now succeed. Requests that previously succeeded (Responses-to-OpenAI-compatible upstreams) are not affected.

## Locked decisions (Phase 3)

- **Package placement**: shape converters land in `service/openaicompat/` parallel to the existing `chat_to_responses.go`/`responses_to_chat.go`; orchestration lands in `relay/responses_via_chat_completions.go` mirroring the existing `relay/chat_completions_via_responses.go`.
- **Naming**: PascalCase `XToY` style matching project convention: `ResponsesRequestToChatCompletionsRequest`, `ChatCompletionsStreamToResponsesEvents`, `ChatCompletionsResponseToResponsesResponse`. Per-stream state struct: `ResponsesStreamState`.
- **Reuse strategy**: the `ChatCompletions ↔ AnthropicMessages` legs are NOT reimplemented; the existing Claude adaptor converters listed above are called directly.
- **Tool-call ID strategy**: pass-through when valid; sanitize non-empty residue when partially invalid; UUID fallback (no deterministic synthesis) when fully invalid. Clamp to 64 characters at the Responses-side boundary.
- **OAuth tool-name prefix**: NOT applicable to this project (the Anthropic adaptor uses `x-api-key`, not an OAuth flow). The translator hard-codes no prefix; no `prefixedName→originalName` map exists.
- **JSON-mode prompt text**: hard-coded English, matching the convention of other converters in this codebase.
- **Test style**: assertion-style using `testify/require` and `t.Errorf`, matching `relay/channel/claude/relay_claude_test.go`. No golden files.
- **Feature gate**: `RESPONSES_TO_ANTHROPIC_ENABLED`, default `true`. Operators can set the variable to `false` to restore the prior "not implemented" behavior.
- **Conflict surface**: clean. The only uncommitted change at the time of this proposal is this OpenSpec change itself; no in-flight work touches `relay/responses_handler.go` or `relay/channel/claude/`.
