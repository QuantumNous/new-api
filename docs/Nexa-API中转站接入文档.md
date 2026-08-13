# Nexa 公共 API 接入文档

更新时间：2026-08-13

本文面向需要把聊天或图片生成能力接入后端服务、桌面客户端及自动化工作流的开发者。所有示例均以当前线上接口为准。

## 1. 开始接入

1. 访问 `https://async-api.nexaapp.cn/sign-up` 注册并登录。
2. 进入「控制台 → API 密钥」创建下游 API Key。
3. 调用付费模型前确认钱包余额充足。
4. 使用 HTTPS、Bearer Token 和下方基础地址发起请求。

| 配置项 | 内容 |
| --- | --- |
| 网站 | `https://async-api.nexaapp.cn` |
| API Base URL | `https://async-api.nexaapp.cn/v1` |
| 协议 | OpenAI Compatible API |
| 鉴权 | `Authorization: Bearer sk-your-api-key` |
| 模型与价格 | `https://async-api.nexaapp.cn/pricing` |

API Key 仅可保存在服务端、系统安全凭据存储或环境变量中。禁止把密钥写入公开网页、代码仓库、日志或截图。

## 2. 查询当前模型

模型会根据审核结果上架或下架，客户端应以 `GET /v1/models` 的实时响应为准，不要在程序中写死列表。

```bash
curl 'https://async-api.nexaapp.cn/v1/models' \
  -H 'Authorization: Bearer sk-your-api-key'
```

第三方客户端可能缓存以前获取过的模型。刷新模型列表后，仍保留的旧条目需要在客户端本地手动删除。客户端显示模型名称，不代表服务器仍会路由该模型。

## 3. 聊天补全

### 3.1 非流式请求

```bash
curl 'https://async-api.nexaapp.cn/v1/chat/completions' \
  -H 'Authorization: Bearer sk-your-api-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gemini-3.5-flash",
    "messages": [
      {"role": "user", "content": "你好，请介绍一下你自己。"}
    ],
    "stream": false
  }'
```

标准响应包含 `choices` 和 `usage`。文本位于 `choices[0].message.content`，Token 用量位于 `usage`。

### 3.2 流式请求

```bash
curl -N 'https://async-api.nexaapp.cn/v1/chat/completions' \
  -H 'Authorization: Bearer sk-your-api-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gpt-5.6-sol",
    "messages": [
      {"role": "user", "content": "写一段简短的产品介绍。"}
    ],
    "stream": true,
    "stream_options": {"include_usage": true}
  }'
```

客户端应按 SSE 读取数据，依次拼接 `choices[].delta.content`，收到 `data: [DONE]` 后结束。流式响应已经输出内容后不要自动重试，否则可能产生重复内容和重复费用。

### 3.3 Python SDK

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-your-api-key",
    base_url="https://async-api.nexaapp.cn/v1",
)

response = client.chat.completions.create(
    model="gemini-3.5-flash",
    messages=[{"role": "user", "content": "你好"}],
)

print(response.choices[0].message.content)
```

## 4. 异步图片生成

图片模型必须使用图片接口调用，不能当作普通聊天模型使用。推荐异步接口：提交成功后任务会继续在服务器执行，客户端可以断开并稍后轮询结果。

完整参数、状态机与错误码见同目录的《异步图片生成 API 调用文档》。最小调用流程如下。

### 4.1 提交任务

```bash
curl 'https://async-api.nexaapp.cn/v1/async/images/generations' \
  -H 'Authorization: Bearer sk-your-api-key' \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: project-a-image-0001' \
  -d '{
    "model": "nano-banana-2",
    "prompt": "一座被云海环绕的未来城市",
    "n": 1,
    "size": "16:9",
    "quality": "2K",
    "response_format": "url"
  }'
```

提交成功返回 HTTP `202 Accepted`：

```json
{
  "id": "task_xxx",
  "status": "queued",
  "status_url": "/v1/async/tasks/task_xxx",
  "result_url": "/v1/async/tasks/task_xxx/result"
}
```

`Idempotency-Key` 必填。网络超时后重试完全相同的请求时复用原键；新的生成任务必须使用新键。

### 4.2 轮询并获取结果

```bash
curl 'https://async-api.nexaapp.cn/v1/async/tasks/task_xxx' \
  -H 'Authorization: Bearer sk-your-api-key'

curl 'https://async-api.nexaapp.cn/v1/async/tasks/task_xxx/result?include_upstream=false' \
  -H 'Authorization: Bearer sk-your-api-key'
```

建议每 2～5 秒轮询一次。状态变为 `success`、`failure`、`uncertain` 或 `cancelled` 后停止。最终图片 URL 位于 `response.data[].url`。

符合退款条件的普通失败任务会退回预扣额度；`uncertain` 表示上游可能已经执行，因此可能计费，禁止自动重新提交。

## 5. 价格与计费

- 用户侧当前价格、币种和计费单位以模型广场实时展示为准。
- 聊天模型通常按输入 Token 和输出 Token 分别计费。
- 图片模型通常按次计费，质量、分辨率等参数可能影响价格。
- 钱包最终变动及「控制台 → 使用日志」是实际计费的权威记录。
- 上游价格和模型状态可能调整，客户端不得写死价格或可用性。

## 6. 错误处理

| HTTP 状态码 | 含义 | 建议处理 |
| ---: | --- | --- |
| `400` | 请求格式错误或参数不受支持 | 修正请求，不要原样重试 |
| `401` | API Key 缺失、无效或已禁用 | 检查或更换密钥 |
| `403` | 账号、分组或模型权限不足 | 检查账号和密钥权限 |
| `429` | 速率限制、配额压力或上游策略拒绝 | 先读取错误消息，仅对临时限流退避重试 |
| `500`、`502`、`503`、`504` | 网关或上游服务异常 | 设置次数上限并指数退避重试 |

部分图片上游也使用 `429` 表示安全策略拦截。如果错误包含 `content blocked by upstream safety policy`，调整本站速率限制不会解决，应修改提示词或更换模型。

## 7. Cherry Studio 配置

1. 供应商类型选择 `OpenAI Compatible`。
2. 填入本站创建的 API Key。
3. 如果地址预览会自动拼接 `/v1/chat/completions`，API 地址填写 `https://async-api.nexaapp.cn`，避免出现 `/v1/v1`。
4. 其他要求填写 Base URL 的 SDK 通常使用 `https://async-api.nexaapp.cn/v1`。
5. 服务端模型调整后重新获取模型列表，并手动删除客户端保留的旧条目。

图片模型要求客户端支持图片生成接口。仅在文本聊天界面中选择图片模型，不能完成图片生成。

## 8. 上线检查

- API Key 从服务端环境变量读取，泄露后立即轮换。
- 为连接和读取分别设置超时。
- 只对临时 `429` 和 `5xx` 使用带抖动的指数退避重试，并设置次数上限。
- 记录模型、HTTP 状态、请求 ID 和任务 ID，但不要记录完整 API Key。
- 向最终用户展示模型选择器前先获取实时模型列表。
- 异步图片任务持久化 `Idempotency-Key` 与 `task_id`，应用重启后继续查询，不要重新提交。
