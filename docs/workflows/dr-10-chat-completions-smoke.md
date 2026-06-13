# DR-10 chat completions smoke

Use this when validating `/v1/chat/completions` against real dev channels for DR-10.
The committed unit fixtures cover mock upstream responses without provider keys:

```bash
go test ./relay/channel/openai ./relay/channel/claude
```

Manual smoke requires a running DeepRouter dev instance with:

- a user API token exported as `DEEPROUTER_TOKEN`
- an OpenAI-compatible channel serving `gpt-4o-mini`
- an Anthropic channel serving `claude-haiku-4-5` or a configured equivalent such as `claude-haiku-4-5-20251001`

Set the API base explicitly to the backend port:

```bash
export BASE_URL="${BASE_URL:-http://localhost:3000}"
```

Before running chat smoke, confirm the token can see both target models:

```bash
curl -sS "${BASE_URL}/v1/models" \
  -H "Authorization: Bearer ${DEEPROUTER_TOKEN}"
```

## OpenAI non-stream

```bash
curl -sS "${BASE_URL}/v1/chat/completions" \
  -H "Authorization: Bearer ${DEEPROUTER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Say hello in five words."}],
    "stream": false
  }'
```

Expected:

- HTTP 200
- `choices[0].message.content` is non-empty
- `usage.prompt_tokens`, `usage.completion_tokens`, and `usage.total_tokens` are populated

## OpenAI stream

```bash
curl -N "${BASE_URL}/v1/chat/completions" \
  -H "Authorization: Bearer ${DEEPROUTER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Say hello in five words."}],
    "stream": true,
    "stream_options": {"include_usage": true}
  }'
```

Expected:

- HTTP 200
- SSE frames are emitted as distinct `data:` lines
- content deltas arrive in order, followed by a stop chunk
- final usage chunk appears before `data: [DONE]`

## Anthropic non-stream

```bash
curl -sS "${BASE_URL}/v1/chat/completions" \
  -H "Authorization: Bearer ${DEEPROUTER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-haiku-4-5-20251001",
    "messages": [{"role": "user", "content": "Say hello in five words."}],
    "stream": false
  }'
```

Expected:

- HTTP 200
- OpenAI chat completion response shape
- Anthropic usage is converted into populated OpenAI-style `usage`

## Anthropic stream

```bash
curl -N "${BASE_URL}/v1/chat/completions" \
  -H "Authorization: Bearer ${DEEPROUTER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-haiku-4-5-20251001",
    "messages": [{"role": "user", "content": "Say hello in five words."}],
    "stream": true,
    "stream_options": {"include_usage": true}
  }'
```

Expected:

- HTTP 200
- SSE frames are emitted as distinct `data:` lines
- content deltas arrive in order, followed by a stop chunk
- final usage chunk appears before `data: [DONE]`

## Notes

- `streamSupportedChannels` already includes `ChannelTypeOpenAI` and `ChannelTypeAnthropic`.
- If `stream_options.include_usage` is not present, the relay can still tally usage internally, but the client-facing final usage chunk is not guaranteed.
- If `/v1/chat/completions` is globally configured to force Chat Completions through OpenAI Responses mode for Anthropic channels, verify the Anthropic adapter supports `ConvertOpenAIResponsesRequest` before enabling that policy.
- If `/v1/models` returns `text/html`, `BASE_URL` points at the frontend dev server; use the backend API port instead.
- If `/v1/models` returns an empty list or chat returns `This token has no access to model ...`, check the API key model limits and channel group. The local token whitelist uses exact model IDs, so add `gpt-4o-mini` and the exact Anthropic model ID (for example `claude-haiku-4-5-20251001`) instead of relying on wildcard-looking entries such as `gpt-4o*` or `claude-*`.
