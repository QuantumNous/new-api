# Responses

OpenAI Responses API，适合 GPT 推理、结构化输出和复杂任务。

## 请求

```text
POST /v1/responses
```

### 请求体参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `model` | string | 是 | 模型 ID |
| `input` | string/array | 否 | 输入内容，可为字符串或消息数组 |
| `instructions` | string | 否 | 系统级说明 |
| `max_output_tokens` | integer | 否 | 最大输出 token |
| `temperature` | number | 否 | 采样温度 |
| `tools` | array | 否 | 工具定义 |
| `tool_choice` | string/object | 否 | 工具调用策略 |
| `reasoning.effort` | string | 否 | 推理强度 |
| `previous_response_id` | string | 否 | 多轮串联时引用上一轮响应 |
| `stream` | boolean | 否 | 是否流式返回 |

### 请求示例

```bash
curl http://61kj.top/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-token-here" \
  -d '{
    "model": "gpt-5.4",
    "input": "请总结这段代码的作用，并列出三个风险点。",
    "reasoning": {"effort": "medium"},
    "max_output_tokens": 800
  }'
```

### 响应示例

```json
{
  "id": "resp_123",
  "object": "response",
  "status": "completed",
  "model": "gpt-5.4",
  "output": [
    {
      "type": "message",
      "role": "assistant",
      "content": [
        {
          "type": "output_text",
          "text": "这段代码主要负责..."
        }
      ]
    }
  ],
  "usage": {
    "prompt_tokens": 120,
    "completion_tokens": 240,
    "total_tokens": 360
  }
}
```

<div class="callout tip">
  <div class="callout-icon">💡</div>
  <div class="callout-content">
    <p>当你需要更强推理、结构化输出或多步骤执行时，优先使用 <code>POST /v1/responses</code>。</p>
  </div>
</div>
