---
title: Streaming
description: Enable streaming responses and read incremental content and usage.
---

Complete the [Quickstart](/en/start/quickstart/) first. The commands below use your `DP_API_KEY`; replace `your-model`.

## OpenAI Chat Completions

Set `stream: true` and use `curl -N` to disable local output buffering:

```bash
curl -N https://{{API_HOST}}/v1/chat/completions \
  -H "Authorization: Bearer $DP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "your-model",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true,
    "stream_options": {"include_usage": true}
  }'
```

- Read incremental content from the SSE `data` field.
- `stream_options.include_usage` requests usage data.
- `data: [DONE]` marks the end of the response.

## Anthropic Messages

Set `stream: true`. Read incremental content from `content_block_delta`; `message_stop` is the final event.

Input usage is in `message_start`, and cumulative output usage is in `message_delta`.

## Gemini

Use the `:streamGenerateContent` endpoint. For SSE format, add the query parameter `alt=sse`.

## Troubleshooting streaming

- **Content arrives all at once**: check whether your client or reverse proxy buffers responses.
- **Model doesn't support streaming**: use a non-streaming request instead.
- **Response interrupted**: streams cannot be resumed; retrying may incur additional cost.

Check request usage in [Usage Logs](https://{{API_HOST}}/usage-logs/common). For retry strategy, see [Rate limits and retries](/en/guides/rate-limit/).
