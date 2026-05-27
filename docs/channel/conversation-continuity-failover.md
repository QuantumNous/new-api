# Conversation continuity failover design

## Background

aiapi114 acts as an API relay and may route requests for the same user-visible
conversation through different channels because of load balancing, retry,
channel degradation, automatic disabling, or cross-group fallback.

For stateless requests where the client sends the full conversation context on
every turn, switching channels does not lose semantic context. For stateful
requests that rely on upstream state, such as `previous_response_id`,
`conversation`, `prompt_cache_key`, or provider-specific session identifiers,
blind channel switching can break continuity or increase token cost.

This document describes a staged design to keep conversations usable when a
channel must fail over.

## Goals

- Avoid silent context loss when a request depends on upstream state.
- Prefer the original channel for stateful requests.
- Allow safe failover by rebuilding the request from local conversation state
  when the original channel is unavailable.
- Prevent mixed-stream output from multiple channels.
- Avoid duplicated tool execution or duplicated external side effects.
- Preserve existing stateless load balancing behavior.

## Non-goals

- Do not replace existing channel selection, retry, or dynamic adjustment logic.
- Do not guarantee upstream prompt-cache reuse after switching channels.
- Do not retry a stream seamlessly after partial content has already been sent
  to the client.
- Do not build a full chat product inside aiapi114; only store the minimum state
  needed for relay continuity.

## Continuity classes

### Stateless request

The client sends complete `messages`, `input`, or provider-equivalent context on
every turn. These requests can keep using the current routing and retry policy.
Failover may increase upstream cost if prompt cache is missed, but semantic
context remains present in the request.

### Pinned stateful request

The request contains upstream state keys such as:

- `previous_response_id`
- `conversation`
- `prompt_cache_key`
- `metadata.user_id`
- `metadata.session_id`
- `Session_id`
- `thread_id`
- `conversation_id`
- `session_id`

These requests should first be pinned to the same channel, upstream account, or
base URL that produced the previous state.

### Rebuilt-context request

The original channel is unavailable, but aiapi114 has enough local conversation
state to rebuild a complete request. The relay drops upstream-only continuation
fields and sends full reconstructed context to a compatible fallback channel.

### Unsafe-to-failover request

The request depends on upstream state and aiapi114 cannot safely rebuild it, or
the stream has already started sending output. The relay should return an
explicit recoverable error instead of silently switching channels.

## Data model

### `upstream_state_bindings`

Stores upstream state ownership.

Suggested fields:

- `id`
- `state_type`
- `state_key_hash`
- `state_key_hint`
- `channel_id`
- `channel_type`
- `base_url_hash`
- `model`
- `upstream_model`
- `user_id`
- `token_id`
- `group`
- `created_at`
- `expires_at`
- `last_used_at`

Use a hash for the state key so response IDs, session IDs, and prompt-cache keys
are not stored in plaintext. Keep a short masked hint for diagnostics.

### `conversation_turns`

Stores the minimum replayable state for safe rebuild.

Suggested fields:

- `id`
- `session_key_hash`
- `session_key_hint`
- `turn_index`
- `request_format`
- `model`
- `role`
- `content_json`
- `tool_calls_json`
- `tool_results_json`
- `response_id_hash`
- `channel_id`
- `usage_json`
- `created_at`
- `expires_at`

The table should store normalized request/response content, not raw HTTP bodies.
This reduces privacy risk and makes cross-provider reconstruction easier.

## Request flow

### Initial channel selection

1. Parse continuity keys before normal channel selection.
2. If no continuity key is present, use the current selector.
3. If a binding exists, try the bound channel first.
4. If the bound channel is enabled and compatible, set the selected channel in
   request context and skip random selection.
5. If the bound channel is unavailable, mark the request as requiring continuity
   failover.

Primary integration point:

- `middleware/distributor.go`

### Retry loop

The retry loop should use a continuity policy:

- `stateless`: current retry behavior.
- `stateful_pinned`: retry only on the bound channel or same upstream account
  group.
- `rebuilt_context`: rebuild once, then allow compatible fallback channels.
- `unsafe`: do not retry across channels.

Primary integration point:

- `controller/relay.go`

### Response recording

After a successful response:

1. Extract response IDs, conversation IDs, and cache-related identifiers.
2. Write or refresh `upstream_state_bindings`.
3. Append normalized request and response content to `conversation_turns` when a
   stable session key exists.
4. Record continuity metadata in usage/error logs for debugging.

Primary integration points:

- `relay/channel/openai/relay_responses.go`
- `relay/channel/openai/relay-openai.go`
- `relay/channel/claude/relay-claude.go`
- `relay/channel/gemini/relay-gemini.go`
- `service/text_quota.go`

## Failover rebuild

When the original channel is unavailable:

1. Load the local conversation turns by session key.
2. Build a complete target request for the selected fallback format.
3. Drop upstream-only continuation fields:
   - `previous_response_id`
   - `conversation`
   - provider-specific thread/session IDs that cannot be validated on the new
     channel
4. Preserve user-visible instructions, messages, tool results, attachments, and
   supported reasoning settings.
5. Select only channels that support the required model, tools, files, images,
   and request format.
6. Mark the request with `continuity_mode=rebuilt_context`.

If rebuild is impossible, return a clear error:

```json
{
  "error": {
    "message": "The previous upstream conversation is unavailable. Send the full conversation context or start a new conversation.",
    "type": "continuity_error",
    "code": "conversation_rebuild_unavailable"
  }
}
```

## Streaming policy

Cross-channel retry is allowed only before any downstream bytes are written.

Once a stream has started:

- Do not switch channels to continue the same response.
- Close the stream with a clear recoverable error event when possible.
- Let the client retry the next turn with full context.

An optional later enhancement is buffered streaming. The relay can delay
downstream writes until the upstream response reaches a safe checkpoint, but this
adds latency and memory pressure.

## Tool and side-effect safety

For tool-using clients, aiapi114 should store tool calls and tool results as
part of `conversation_turns`.

During rebuilt-context failover:

- Already completed tool calls are replayed as prior tool results.
- The relay must not trigger local tool execution again.
- Requests with unknown side effects should be marked unsafe unless the client
  supplies idempotency keys.

## Observability

Add log and optional response-header fields:

- `continuity_mode`
- `continuity_state_type`
- `continuity_binding_hit`
- `failover_from_channel`
- `failover_to_channel`
- `previous_response_id_dropped`
- `conversation_rebuilt_turns`
- `conversation_rebuild_tokens_estimated`

Recommended metrics:

- Binding hit rate
- Pinned-channel success rate
- Rebuild success rate
- Unsafe failover count
- Cache-token hit rate before and after failover
- Extra input tokens caused by rebuild

## Implementation stages

### P0: Binding and pinned routing

Add upstream state binding and force stateful requests back to their original
channel. If the channel is unavailable, return an explicit continuity error.

Estimated cost: 1-2 development days.

Expected benefit: prevents silent stateful cross-channel failures with low risk.

### P1: Recoverable failure behavior

Add explicit continuity error responses and log fields when a stateful request
cannot safely fail over.

Estimated cost: 0.5-1 development day.

Expected benefit: clients can recover intentionally instead of seeing confusing
upstream errors.

### P2: Local conversation ledger and text rebuild

Store replayable turns and rebuild OpenAI Responses, OpenAI Chat, and Claude text
requests when the original channel is unavailable.

Estimated cost: 4-7 development days.

Expected benefit: most text conversations can continue after unavoidable channel
failover, with higher input token cost.

### P3: Tool idempotency and multi-format rebuild

Support tool-result replay, Gemini rebuild, attachment handling, and stricter
capability matching.

Estimated cost: 1-2 development weeks.

Expected benefit: improves continuity for agentic workflows and multimodal
sessions.

### P4: Admin observability

Expose continuity metrics in admin logs or a channel reliability dashboard.

Estimated cost: 2-4 development days.

Expected benefit: operators can measure stability gain, cache cost, and unsafe
failover cases.

## Stability and cost estimates

### Stability

- Silent `previous_response_id` cross-channel failures should be largely
  eliminated after P0.
- User-visible continuity during upstream outage should improve materially after
  P2 for text conversations.
- Stream corruption risk should decrease after enforcing no cross-channel retry
  after downstream output starts.
- Tool duplication risk becomes manageable after P3.

### Runtime overhead

- P0 lookup: usually one cache or database lookup per stateful request.
- P0 write: one binding refresh per successful stateful response.
- P2 write: one normalized turn append per successful turn.
- P2 rebuild latency: commonly 5-30 ms, depending on stored history size and
  target conversion.
- Storage: if an average normalized turn is 10 KB, 100,000 turns are about 1 GB
  before compression and retention cleanup.

### Token cost

- Pinned routing can reduce token cost by preserving prompt-cache locality.
- Rebuilt-context failover increases input tokens because the new channel cannot
  use upstream private continuation state.
- The expected failover cost is close to sending the full conversation context
  again for the recovery turn.

## Recommended first milestone

Implement P0 and P1 first:

1. Detect stateful continuity keys.
2. Persist `state_key -> channel_id` bindings.
3. Force pinned routing for bound state keys.
4. Return explicit continuity errors when the pinned channel is unavailable.
5. Log continuity metadata for successful and failed attempts.

This milestone is small, low risk, and prevents the most dangerous behavior:
silent channel switching for requests that depend on upstream state.
