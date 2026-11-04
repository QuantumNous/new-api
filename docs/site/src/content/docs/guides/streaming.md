---
title: 流式输出
description: 开启流式响应并读取增量内容和用量。
---

先完成[快速接入](/start/quickstart/)。以下命令使用已设置的 `DP_API_KEY`，请替换 `your-model`。

## OpenAI Chat Completions

设置 `stream: true`，并使用 `curl -N` 关闭本地输出缓冲：

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

- 从 SSE 的 `data` 字段读取增量内容。
- `stream_options.include_usage` 用于请求用量数据。
- 收到 `data: [DONE]` 表示响应结束。

## Anthropic Messages

设置 `stream: true`。从 `content_block_delta` 读取增量内容，以 `message_stop` 为结束事件。

输入用量位于 `message_start`，输出累计用量位于 `message_delta`。

## Gemini

使用 `:streamGenerateContent` 接口；需要 SSE 格式时，添加查询参数 `alt=sse`。

## 排查流式异常

- **内容一次性返回**：检查客户端或反向代理是否启用了响应缓冲。
- **模型不支持流式**：改用非流式请求。
- **响应中断**：无法断点续传；重新请求可能产生额外费用。

请求用量可在[使用日志](https://{{API_HOST}}/usage-logs/common)中核对，重试策略见[限流与重试](/guides/rate-limit/)。
