# Chat Completions

标准 GPT 对话补全接口。

## 请求

```text
POST /v1/chat/completions
```

### 请求体参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `model` | string | 是 | 模型 ID |
| `messages` | array | 是 | 对话消息列表 |
| `stream` | boolean | 否 | 是否流式返回，默认 false |
| `stream_options.include_usage` | boolean | 否 | 流式场景下是否在末尾带 usage |
| `temperature` | number | 否 | 采样温度，0-2，默认 1 |
| `max_tokens` | integer | 否 | 最大生成 token 数 |
| `max_completion_tokens` | integer | 否 | 部分新模型使用的最大输出 token 字段 |
| `top_p` | number | 否 | 核采样，0-1 |
| `tools` | array | 否 | 函数/工具定义 |
| `tool_choice` | string/object | 否 | 工具调用策略，支持 `auto`、`required` 等 |
| `response_format` | object | 否 | 结构化输出格式 |
| `reasoning_effort` | string | 否 | 推理强度，支持 `low`/`medium`/`high` |
| `modalities` | array | 否 | 多模态输出，如 `text`、`audio` |
| `audio` | object | 否 | 音频输出配置，如 voice / format |

### 请求示例

```bash
curl http://61kj.top/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-token" \
  -d '{
    "model": "gpt-5.4",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "你好"}
    ],
    "stream": false
  }'
```

### 响应示例

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1709000000,
  "model": "gpt-4o",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "你好！有什么我可以帮你的吗？"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 20,
    "completion_tokens": 12,
    "total_tokens": 32
  }
}
```

<div class="callout info">
  <div class="callout-icon">ℹ️</div>
  <div class="callout-content">
    <p>如果你的任务涉及更强推理、结构化输出或更复杂的工具编排，建议优先使用 <code>/v1/responses</code>。</p>
  </div>
</div>
