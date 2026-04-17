# Completions 代码补全接口契约

## Endpoint

`POST /v1/completions`

认证、渠道分发、模型映射、限流、配额和错误处理沿用现有 relay 链路。

## Request

最小请求：

```json
{
  "model": "code-model",
  "prompt": "func add(a int, b int) int {"
}
```

代码补全客户端常用字段：

| Field | Required | Notes |
| --- | --- | --- |
| `model` | yes | 参与模型映射与渠道选择。 |
| `prompt` | yes | 补全前缀；字符串为首期必须支持形态。 |
| `suffix` | no | FIM 后缀；支持的上游应透传或转换。 |
| `max_tokens` | no | 最大输出 token 数；显式 `0` 不得被当成字段缺省。 |
| `temperature` | no | 采样温度；显式 `0` 必须保留。 |
| `top_p` | no | nucleus sampling；显式 `0` 必须保留。 |
| `stop` | no | 字符串或字符串数组。 |
| `stream` | no | 显式 `false` 必须保留；`true` 返回 SSE。 |
| `n` | no | 生成数量；按上游能力透传或限制。 |
| `best_of` | no | 仅在上游支持时透传；显式 `0` 不得被当成字段缺省。 |
| `logprobs` | no | legacy completions 使用整数；共享 DTO 也必须兼容 chat/completions 的布尔形态。 |
| `echo` | no | 仅在上游支持时透传；不支持时不得影响普通补全。 |

后续新增可选标量字段时必须使用 pointer + `omitempty`，保证客户端显式零值和字段缺省可区分。

## Non-Streaming Response

响应保持 OpenAI text completion 兼容形态：

```json
{
  "id": "cmpl_xxx",
  "object": "text_completion",
  "created": 1710000000,
  "model": "code-model",
  "choices": [
    {
      "text": "\n    return a + b\n}",
      "index": 0,
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 12,
    "completion_tokens": 8,
    "total_tokens": 20
  }
}
```

## Streaming Response

当 `stream: true` 时，响应使用 `text/event-stream`。每个事件应输出 text completion chunk；结束时输出 `[DONE]`。如果上游返回 usage，relay 应尽量保留；如果上游不返回 usage，沿用现有估算与计费逻辑。

## Error Behavior

- 缺少 `model` 时返回现有 `model is required` 参数错误。
- 缺少或空 `prompt` 时返回现有 `field prompt is required` 参数错误。
- 上游错误通过现有 relay 错误处理与状态码映射返回。
- 不支持的上游字段应通过 provider adapter 或 channel disabled-fields 机制处理，不应导致无关字段破坏普通补全请求。

## Test Scenarios

- `prompt` 普通非流式补全返回 text completion 响应并记录 usage。
- `prompt` + `suffix` FIM 请求在支持 FIM 的上游保持字段完整。
- `stream: true` 返回 SSE chunk 和 `[DONE]`。
- `temperature: 0`、`top_p: 0`、`stream: false`、`max_tokens: 0`、`best_of: 0`、`echo: false`、`logprobs: 0` 在 marshal 后仍保留显式输入语义。
- 不支持 `suffix` 或 `logprobs` 的上游仍能完成普通 `prompt` 补全或返回明确上游错误。
