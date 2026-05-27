# xin-cc Claude 模型测试调用文档

本文档面向 `xin-cc` 用户，仅用于测试已授权的 Claude 模型调用能力，只包含调用测试所需信息。

## 1. 接入信息

请向管理员获取以下信息：

| 项目 | 说明 |
| --- | --- |
| API Base URL | `https://router.flatkey.ai` |
| API Key | `xin-cc` 用户专属密钥，格式通常为 `sk-...` |
| Claude 模型名 | `claude-haiku-4-5-20251001` |

当前可用于测试的 Claude 模型名以实际模型列表接口返回为准。页面展示的模型名包括：

- `claude-haiku-4.5`
- `claude-opus-4.5`
- `claude-sonnet-4-6`
- `claude-sonnet-4.6`
- `claude-haiku-4-5-20251001`
- `claude-opus-4.7`

Claude Messages 协议推荐使用以下请求头：

```http
x-api-key: <YOUR_API_KEY>
anthropic-version: 2023-06-01
Content-Type: application/json
```

平台也支持标准鉴权头：

```http
Authorization: Bearer <YOUR_API_KEY>
```

建议先在本地设置环境变量，避免把密钥写进代码：

```bash
export BASE_URL="https://router.flatkey.ai"
export API_KEY="sk-xxxxxxxx"
export MODEL_NAME="claude-haiku-4-5-20251001"
```

## 2. API 协议选择

| 场景 | Endpoint | 请求格式 | 说明 |
| --- | --- | --- | --- |
| 推荐测试方式 | `POST /v1/messages` | Claude Messages 兼容格式 | 与页面 API 示例一致 |
| 兼容客户端 | `POST /v1/chat/completions` | Chat Completions 兼容格式 | 仅当调用方按该格式接入时使用 |

如果只是验证 `xin-cc` 是否可以正常调用截图中的 Claude 模型，优先使用 `/v1/messages`。

## 3. 获取可用模型

接口：

```http
GET /v1/models
```

调用示例：

```bash
curl "$BASE_URL/v1/models" \
  -H "Authorization: Bearer $API_KEY"
```

返回中 `data[].id` 即可作为后续请求里的 `model` 值。

返回示例：

```json
{
  "object": "list",
  "data": [
    {
      "id": "your-claude-model-name",
      "object": "model"
    }
  ]
}
```

## 4. 推荐：Claude Messages 非流式测试

接口：

```http
POST /v1/messages
```

调用示例：

```bash
curl "$BASE_URL/v1/messages" \
  -H "x-api-key: $API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "'"$MODEL_NAME"'",
    "max_tokens": 1024,
    "messages": [
      {
        "role": "user",
        "content": "Explain quantum entanglement in one paragraph."
      }
    ]
  }'
```

成功响应示例：

```json
{
  "id": "msg_xxx",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "这里是模型返回的文本内容。"
    }
  ],
  "usage": {
    "input_tokens": 20,
    "output_tokens": 80
  }
}
```

读取结果时，主要关注：

```text
content[0].text
```

## 5. Claude Messages 流式测试

适合测试边生成边返回的效果。

```bash
curl -N "$BASE_URL/v1/messages" \
  -H "x-api-key: $API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "'"$MODEL_NAME"'",
    "max_tokens": 1024,
    "messages": [
      {
        "role": "user",
        "content": "请写一段 200 字以内的测试回复。"
      }
    ],
    "stream": true
  }'
```

流式响应会持续返回 `data:` 片段，结束标记为：

```text
event: message_stop
```

## 6. 可选：Chat Completions 兼容测试

仅当调用方客户端固定使用 Chat Completions 兼容格式时使用。

接口：

```http
POST /v1/chat/completions
```

调用示例：

```bash
curl "$BASE_URL/v1/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "'"$MODEL_NAME"'",
    "messages": [
      {
        "role": "user",
        "content": "请用三句话介绍 Claude 模型适合做哪些文本任务。"
      }
    ],
    "temperature": 0.7,
    "max_tokens": 500
  }'
```

响应中主要关注：

```text
choices[0].message.content
```

## 7. Python 测试脚本

```python
import os
import requests

base_url = os.environ["BASE_URL"].rstrip("/")
api_key = os.environ["API_KEY"]
model = os.environ["MODEL_NAME"]

response = requests.post(
    f"{base_url}/v1/messages",
    headers={
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    },
    json={
        "model": model,
        "max_tokens": 1024,
        "messages": [
            {"role": "user", "content": "请用一句话说明你可以帮助我做什么。"}
        ],
    },
    timeout=60,
)

response.raise_for_status()
data = response.json()
print(data["content"][0]["text"])
```

## 8. Node.js 测试脚本

```ts
const baseUrl = process.env.BASE_URL!.replace(/\/$/, "");
const apiKey = process.env.API_KEY!;
const model = process.env.MODEL_NAME!;

const response = await fetch(`${baseUrl}/v1/messages`, {
  method: "POST",
  headers: {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model,
    max_tokens: 1024,
    messages: [
      { role: "user", content: "请用一句话说明你可以帮助我做什么。" },
    ],
  }),
});

if (!response.ok) {
  throw new Error(`Request failed: ${response.status} ${await response.text()}`);
}

const data = await response.json();
console.log(data.content?.[0]?.text);
```

## 9. 常用参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `model` | string | 是 | Claude 模型名称，例如 `claude-haiku-4-5-20251001` |
| `messages` | array | 是 | 对话消息列表 |
| `stream` | boolean | 否 | 是否启用流式输出 |
| `temperature` | number | 否 | 输出随机性，测试时可使用 `0.3` 到 `0.8` |
| `max_tokens` | number | 是 | 限制最大输出长度 |

`messages` 中常用角色：

| role | 说明 |
| --- | --- |
| `system` | 系统指令，用于设定回复风格和约束 |
| `user` | 用户输入 |
| `assistant` | 历史助手回复，用于多轮对话 |

Claude Messages 协议使用 `messages` 消息列表，`max_tokens` 为必填。如需系统指令，可使用顶层 `system` 字段。

## 10. 常见错误

| 状态码 | 含义 | 建议处理 |
| --- | --- | --- |
| `400` | 请求参数错误 | 检查 JSON 格式、`model`、`messages` 和参数类型 |
| `401` | 鉴权失败 | 检查 API Key 是否正确，是否携带 `x-api-key` 或 `Authorization: Bearer ...` |
| `403` | 无权限 | 确认 `xin-cc` 是否已被授权使用该模型 |
| `429` | 请求过于频繁或额度不足 | 降低并发、稍后重试或联系管理员 |
| `500` | 服务异常 | 记录请求时间、模型名和错误信息后联系管理员 |

错误响应示例：

```json
{
  "error": {
    "message": "错误说明",
    "type": "invalid_request_error",
    "code": "invalid_request_error"
  }
}
```

## 11. 安全要求

- 不要把 API Key 写入前端页面、移动端包体、公开仓库或截图。
- 日志中不要打印完整 API Key。
- 只使用管理员分配给 `xin-cc` 的模型名称。
- 如需排查问题，请提供请求时间、状态码、模型名和错误信息，不要提供完整密钥。
