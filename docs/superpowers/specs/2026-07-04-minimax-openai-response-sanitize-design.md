# MiniMax OpenAI Response Sanitization Design

## Context

On 2026-07-04, `main` was synchronized from upstream `QuantumNous/new-api` to fork `zhukangfeng/new-api` at commit `722d0366b727b82fced878af902e48363626b2fb`.

I reviewed open issues and excluded items that already had an open PR, assignee, insufficient reproduction, or a larger feature scope. The selected issues are:

- [#5833](https://github.com/QuantumNous/new-api/issues/5833): MiniMax streaming responses can emit a final chunk containing a non-streaming `message` object.
- [#5834](https://github.com/QuantumNous/new-api/issues/5834): MiniMax OpenAI-compatible responses leak non-OpenAI fields such as `name`, `audio_content`, `input_sensitive`, `service_tier`, and `base_resp`.

These issues are urgent because strict OpenAI-compatible clients can reject the response schema or duplicate assistant output. They are unassigned and have no obvious open PR in the current open PR list.

## Root Cause

MiniMax text chat uses the MiniMax adaptor for request URL/header selection, but response handling delegates to the generic OpenAI adaptor.

The generic OpenAI handler has two behaviors:

- Without `force_format`, it forwards upstream JSON/SSE chunks nearly as received.
- With `force_format`, it unmarshals into project OpenAI DTOs and marshals back, which keeps only supported OpenAI response fields.

MiniMax upstream chat responses can include provider-specific fields. Because the MiniMax adaptor does not force formatting for text responses, those provider-specific fields pass through to OpenAI clients.

## Design

For MiniMax text responses in OpenAI relay format, force OpenAI DTO formatting before delegating to the OpenAI response handler.

This keeps the change local to MiniMax and avoids changing behavior for generic OpenAI-compatible channels that intentionally rely on raw pass-through behavior.

The response path will be:

1. MiniMax text request reaches `relay/channel/minimax.Adaptor.DoResponse`.
2. If `RelayFormat` is OpenAI and the relay mode is text chat, set `info.ChannelSetting.ForceFormat = true`.
3. Delegate to `openai.Adaptor.DoResponse` as today.
4. Existing OpenAI handler strips unsupported fields by unmarshalling into `dto.OpenAITextResponse` or `dto.ChatCompletionsStreamResponse`.
5. In forced-format non-streaming responses, clear `choices[].message.name` before marshalling because the shared request/response `dto.Message` type accepts request-side `name`, but the MiniMax value is provider metadata rather than OpenAI response content.

## Behavioral Contract

Non-streaming MiniMax text responses returned through `/v1/chat/completions` must:

- Preserve standard OpenAI fields: `id`, `object`, `created`, `model`, `choices`, `usage`.
- Preserve `choices[].message.role`, `choices[].message.content`, and supported reasoning/tool fields.
- Omit MiniMax-only top-level fields: `input_sensitive`, `output_sensitive`, `input_sensitive_type`, `output_sensitive_type`, `output_sensitive_int`, `service_tier`, `base_resp`.
- Omit MiniMax-only message fields: `name`, `audio_content`.

Streaming MiniMax text responses returned through `/v1/chat/completions` must:

- Preserve standard OpenAI SSE chunks.
- Preserve `delta.role`, `delta.content`, `delta.reasoning_content`, `delta.reasoning`, and `delta.tool_calls`.
- Omit MiniMax-only delta fields such as `name` and `audio_content`.
- Omit any stream-only `choices[].message` object from chunks; stream chunks should use `delta`.

## Files

- Modify `relay/channel/minimax/adaptor.go` to force response formatting for OpenAI-format text responses.
- Modify `relay/channel/openai/relay-openai.go` to omit response message `name` in the forced-format path.
- Add tests in `relay/channel/minimax/adaptor_test.go` covering non-streaming and streaming response sanitization.

## Testing

Use test-driven development:

1. Add a failing non-streaming test with MiniMax-only top-level and message fields.
2. Add a failing streaming test with MiniMax-only delta fields and a final `message` field.
3. Implement the minimal MiniMax adaptor change.
4. Run targeted Go tests for `relay/channel/minimax`.
5. Run related OpenAI channel tests to ensure the delegated handler behavior still passes.
6. Run a broader Go test command for touched packages.

## Risks

The change intentionally affects only MiniMax text chat responses in OpenAI relay format. MiniMax image, TTS, and Claude-format response paths are left unchanged.

If an operator depended on MiniMax-specific fields leaking through the OpenAI endpoint, those fields will no longer be present. This is acceptable because the endpoint contract is OpenAI-compatible output.
