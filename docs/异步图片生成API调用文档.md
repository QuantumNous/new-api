# 异步图片生成 API 调用文档

## 1. 文档信息

- 服务名称：New API 异步图片中转站
- 公网入口：`https://async-api.nexaapp.cn`
- API Base URL：`https://async-api.nexaapp.cn/v1`
- 当前结果保留时间：任务生成成功后约 60 分钟
- 单次下载链接有效期：约 15 分钟，可在结果保留期内重新请求结果接口获取新链接
- 更新时间：2026-07-18

本文档面向需要把图片生成接入桌面软件、后端服务或自动化工作流的开发人员。

> 这里的异步是本站提供的持久化任务能力。客户端提交后可以立即断开，云端 Worker 会继续调用上游同步生图接口、等待结果并归档图片。本站不会调用 GRS AI 的原生异步轮询接口。

## 2. 接入信息

### 2.1 应该填写的地址

如果软件要求填写 `Base URL`：

```text
https://async-api.nexaapp.cn/v1
```

提交任务的完整地址：

```text
POST https://async-api.nexaapp.cn/v1/async/images/generations
```

### 2.2 应该使用的密钥

使用 New API 后台「API 密钥」页面中名为「异步生图调用」的密钥：

```text
Authorization: Bearer <NEW_API_TOKEN>
```

不要把云雾或 GRS AI 的上游密钥填写到客户端。上游密钥只保存在服务器渠道配置中。

### 2.3 与标准 OpenAI 图片接口的区别

本接口不是立即返回图片的标准同步接口。客户端必须实现以下流程：

```text
提交任务 → 保存 task_id → 查询任务状态 → 获取结果 → 下载图片
```

如果第三方软件只能固定调用 `/v1/images/generations`，并且要求同一个 HTTP 请求立即返回图片，则不能只靠修改 Base URL 接入本异步接口，需要为该软件增加异步任务适配逻辑。

## 3. 通用请求规则

所有接口都通过 HTTPS 调用，并携带 New API Token：

```http
Authorization: Bearer <NEW_API_TOKEN>
```

提交接口还必须携带：

```http
Content-Type: application/json
Idempotency-Key: <本次业务请求的唯一键>
```

### 3.1 Idempotency-Key 幂等规则

- 必填，最长 191 字节。
- 推荐使用 UUID、ULID，或者软件自身的订单号/任务号。
- 客户端提交超时或网络断开后，必须使用原来的幂等键重试。
- 同一个 Token、相同幂等键、相同 JSON 请求会返回原任务，不会重复创建或重复预扣费。
- 同一个 Token、相同幂等键、不同请求内容会返回 HTTP `409`。
- 一个任务进入 `failure`、`uncertain` 或 `cancelled` 后，如确实需要重新生成，应在确认风险后使用新的幂等键创建新任务。

示例：

```text
flowpic-20260718-550e8400-e29b-41d4-a716-446655440000
```

### 3.2 超时建议

- 提交接口只负责持久化入队，客户端 HTTP 超时建议设置为 15～30 秒。
- 不要让提交请求一直等待图片生成完成。
- 状态轮询建议每 2～5 秒一次；长任务可逐步增加到 10 秒一次。
- 获取到终态后立即停止轮询。

## 4. 已配置模型

| 模型 | 推荐 `size` | 推荐 `quality` | `n` |
| --- | --- | --- | --- |
| `gemini-3.1-flash-image-preview` | `1:1`、`16:9`、`9:16` | `1K`、`2K`、`4K` | 必须为 `1` |
| `gemini-3-pro-image-preview` | `1:1`、`16:9`、`9:16` | `1K`、`2K`、`4K` | 必须为 `1` |
| `gpt-image-2` | `1024x1024`、`1536x1024`、`1024x1536` | `low`、`medium`、`high` | 推荐 `1` |
| `gpt-image-2-vip` | `1024x1024` | `standard` | 必须为 `1` |
| `nano-banana-pro` | `1:1`、`16:9`、`9:16`、`4:3`、`3:4` | `1K`、`2K`、`4K` | 必须为 `1` |
| `nano-banana-2-lite` | `1:1`、`16:9`、`9:16`、`4:3`、`3:4` | `auto` | 必须为 `1` |
| `nano-banana-2` | `1:1`、`16:9`、`9:16`、`4:3`、`3:4` | `1K`、`2K`、`4K` | 必须为 `1` |
| `nano-banana-fast` | `1:1`、`16:9`、`9:16`、`4:3`、`3:4` | `auto` | 必须为 `1` |

为获得跨模型一致性，建议客户端默认始终发送：

```json
"n": 1
```

## 5. 提交异步图片任务

### 5.1 请求

```http
POST /v1/async/images/generations
Authorization: Bearer <NEW_API_TOKEN>
Idempotency-Key: <UNIQUE_KEY>
Content-Type: application/json
```

请求体字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `model` | string | 是 | 必须是 Token 和异步渠道都允许的模型 |
| `prompt` | string | 是 | 图片描述；当前部署最大 8000 个 Unicode 字符 |
| `n` | integer | 建议 | 当前推荐固定为 `1` |
| `size` | string | 否 | 图片尺寸或宽高比，取值见模型表 |
| `quality` | string | 否 | 图片质量，取值见模型表 |
| `response_format` | string | 否 | 推荐使用 `url`；最终结果会统一返回本站归档 URL |
| `image` | string/array | 否 | 参考图 URL 或 Base64/Data URL，是否生效取决于模型 |
| `images` | string/array | 否 | 多张参考图，是否生效取决于模型 |
| `stream` | boolean | 否 | 只能省略或传 `false`，不支持流式图片响应 |

当前部署限制：

- 请求体最大 256 KiB。
- 请求内最多包含 8 个 HTTP/HTTPS 输入 URL。
- 单任务最多归档 8 个文件。
- 单文件最大 25 MiB，单任务归档总量最大 100 MiB。
- Base64 参考图会占用请求体大小，较大参考图建议使用公网 HTTPS URL。

### 5.2 GRS AI 示例

```bash
curl --request POST \
  'https://async-api.nexaapp.cn/v1/async/images/generations' \
  --header 'Authorization: Bearer <NEW_API_TOKEN>' \
  --header 'Content-Type: application/json' \
  --header 'Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000' \
  --data '{
    "model": "nano-banana-2-lite",
    "prompt": "一只戴着蓝色围巾的橘猫坐在窗边，柔和晨光，简洁背景",
    "n": 1,
    "size": "1:1",
    "quality": "auto",
    "response_format": "url"
  }'
```

### 5.3 云雾 Gemini 示例

```bash
curl --request POST \
  'https://async-api.nexaapp.cn/v1/async/images/generations' \
  --header 'Authorization: Bearer <NEW_API_TOKEN>' \
  --header 'Content-Type: application/json' \
  --header 'Idempotency-Key: project-a-gemini-0001' \
  --data '{
    "model": "gemini-3.1-flash-image-preview",
    "prompt": "一座被云海环绕的未来城市",
    "n": 1,
    "size": "16:9",
    "quality": "2K",
    "response_format": "url"
  }'
```

### 5.4 成功响应

HTTP 状态码：`202 Accepted`

```json
{
  "id": "task_dhYtnB2XrXyOOCahrXipl5V7h7LULo0X",
  "status": "queued",
  "status_url": "/v1/async/tasks/task_dhYtnB2XrXyOOCahrXipl5V7h7LULo0X",
  "result_url": "/v1/async/tasks/task_dhYtnB2XrXyOOCahrXipl5V7h7LULo0X/result"
}
```

`status_url` 和 `result_url` 是相对路径，需要与以下域名拼接：

```text
https://async-api.nexaapp.cn
```

## 6. 查询任务状态

### 6.1 请求

```http
GET /v1/async/tasks/{task_id}
Authorization: Bearer <NEW_API_TOKEN>
```

```bash
curl \
  'https://async-api.nexaapp.cn/v1/async/tasks/task_xxx' \
  --header 'Authorization: Bearer <NEW_API_TOKEN>'
```

必须使用创建该任务时的同一个 Token 查询。其他 Token 查询会返回 `task_not_found`。

### 6.2 响应

```json
{
  "id": "task_xxx",
  "status": "running",
  "progress": 0,
  "created_at": 1784351116,
  "started_at": 1784351116,
  "finished_at": null,
  "error": null
}
```

时间字段均为 Unix 时间戳，单位为秒。

### 6.3 状态说明

| 状态 | 是否终态 | 客户端处理方式 |
| --- | --- | --- |
| `queued` | 否 | 继续轮询；任务已安全持久化 |
| `running` | 否 | 继续轮询；云端正在调用上游或归档产物 |
| `success` | 是 | 调用结果接口 |
| `failure` | 是 | 查看 `error`；不要无限自动重试 |
| `uncertain` | 是 | 上游可能已经执行，禁止自动重新生成 |
| `cancelled` | 是 | 任务已取消；如需重新生成请使用新幂等键 |

失败状态示例：

```json
{
  "id": "task_xxx",
  "status": "failure",
  "progress": 0,
  "created_at": 1784351116,
  "started_at": 1784351117,
  "finished_at": 1784351122,
  "error": {
    "phase": "upstream_response",
    "code": "upstream_rate_limited",
    "message": "GRS AI rate limit retry budget was exhausted"
  }
}
```

## 7. 获取任务结果

### 7.1 请求

```http
GET /v1/async/tasks/{task_id}/result
Authorization: Bearer <NEW_API_TOKEN>
```

推荐在生产客户端添加 `include_upstream=false`，避免传输不需要的上游原始响应或内嵌图片数据：

```bash
curl \
  'https://async-api.nexaapp.cn/v1/async/tasks/task_xxx/result?include_upstream=false' \
  --header 'Authorization: Bearer <NEW_API_TOKEN>'
```

### 7.2 成功响应

```json
{
  "id": "task_xxx",
  "status": "success",
  "response": {
    "data": [
      {
        "url": "https://async-files.nexaapp.cn/new-api-staging-artifacts/async/task_xxx/00-example.jpg?..."
      }
    ]
  },
  "artifacts": [
    {
      "content_type": "image/jpeg",
      "size_bytes": 802436,
      "sha256": "50b20ce3294d85bb9985ba11493e017eb7aa6a9a803a1da7c7710123ca413fca",
      "expires_at": 1784354716,
      "url": "https://async-files.nexaapp.cn/new-api-staging-artifacts/async/task_xxx/00-example.jpg?..."
    }
  ]
}
```

如果没有传 `include_upstream=false`，响应还会包含：

```json
"upstream_response": {
  "status": "succeeded"
}
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `response` | 统一后的 OpenAI 风格结果，优先读取 `response.data[].url` |
| `upstream_response` | 上游原始响应；可通过查询参数关闭 |
| `artifacts` | 本站对象存储中的归档文件元数据 |
| `artifacts[].url` | 短期签名下载地址 |
| `artifacts[].expires_at` | 归档产物永久删除时间，不是签名 URL 的失效时间 |
| `artifacts[].sha256` | 文件 SHA-256，可用于下载完整性校验 |

### 7.3 下载注意事项

- 签名 URL 当前约 15 分钟后失效。
- 在结果保留期内，可重新调用结果接口获取新的签名 URL。
- 当前任务结果约保留 60 分钟，过期后返回 HTTP `410`。
- 客户端应尽快把图片下载到自己的存储，不要长期保存签名 URL。
- 下载时不要删除或重新编码 URL 中的查询参数。
- 不需要给 `async-files.nexaapp.cn` 的下载请求添加 Authorization 头，签名已经包含临时授权。

## 8. 取消排队任务

### 8.1 请求

```http
POST /v1/async/tasks/{task_id}/cancel
Authorization: Bearer <NEW_API_TOKEN>
```

```bash
curl --request POST \
  'https://async-api.nexaapp.cn/v1/async/tasks/task_xxx/cancel' \
  --header 'Authorization: Bearer <NEW_API_TOKEN>'
```

规则：

- `queued` 任务可以取消，并进入退款流程。
- `running` 任务不能取消，因为同步上游没有取消接口；返回 HTTP `409`。
- 已经进入终态的任务不会改变状态，接口返回当前状态。

## 9. 错误响应

异步接口业务错误通常采用以下格式：

```json
{
  "error": {
    "message": "Idempotency-Key header is required",
    "type": "async_task_error",
    "code": "idempotency_key_required"
  }
}
```

Token 鉴权、模型路由或额度检查产生的错误可能使用 New API 通用错误类型 `new_api_error`，客户端应主要依据 HTTP 状态码和 `error.code`/`error.message` 处理。

### 9.1 常见 HTTP 状态码

| HTTP | 常见错误码 | 说明 |
| --- | --- | --- |
| `202` | — | 任务已入队或命中原幂等任务 |
| `400` | `idempotency_key_required`、`invalid_request`、`invalid_provider_request` | 请求字段、模型参数或幂等头错误 |
| `401` | `invalid_token` 或通用鉴权错误 | Token 缺失、错误或已失效 |
| `403` | 模型权限、用户状态或额度错误 | Token 无模型权限、账户不可用或额度不足 |
| `404` | `task_not_found` | 任务不存在，或不属于当前 Token |
| `409` | `idempotency_key_conflict` | 相同幂等键对应了不同请求 |
| `409` | `task_not_ready` | 任务仍在排队或运行 |
| `409` | `task_uncertain` | 任务执行结果无法确认，禁止自动重试 |
| `409` | `task_cancelled` | 任务已取消 |
| `409` | `upstream_cancel_unsupported` | 运行中的同步上游请求无法取消 |
| `410` | `result_expired` | 归档结果已过期并删除 |
| `422` | 任务的稳定错误码 | 任务已明确失败 |
| `429` | 速率限制错误 | 当前 Token 或模型请求过快 |
| `500` | `create_task_failed`、`query_task_failed` | 服务器内部错误 |
| `503` | `artifact_store_unavailable`、`artifact_sign_failed` | 对象存储或签名服务暂时不可用 |

### 9.2 常见任务错误码

| 错误码 | 含义 | 建议 |
| --- | --- | --- |
| `upstream_rate_limited` | 上游 429 重试预算耗尽 | 延迟后使用新幂等键人工重试 |
| `upstream_http_400` 等 | 上游明确返回 HTTP 错误 | 检查提示词、尺寸、质量和账户状态 |
| `upstream_generation_failed` | 上游明确拒绝或生成失败 | 检查上游返回信息后决定是否重试 |
| `upstream_connect_failed` | 请求体发送前无法连接上游 | 通常可延迟重试 |
| `upstream_result_uncertain` | 请求可能已发送，但结果无法确认 | 禁止自动重试，避免重复生成和计费 |
| `upstream_sync_result_pending` | GRS 同步模式未返回最终结果 | 本站不会转为上游异步轮询，需人工处理 |
| `invalid_upstream_response` | 上游响应结构不符合预期 | 保留任务 ID 并交由管理员排查 |
| `upstream_response_too_large` | 上游响应超过安全上限 | 交由管理员检查模型响应 |
| `artifact_archive_failed` | 生成完成但归档失败 | 不要自动重复生成，交由管理员处理 |

## 10. 完整 Python 示例

依赖：

```bash
pip install requests
```

```python
import time
import uuid
from pathlib import Path

import requests

BASE_URL = "https://async-api.nexaapp.cn/v1"
API_TOKEN = "<NEW_API_TOKEN>"

session = requests.Session()
session.headers.update({"Authorization": f"Bearer {API_TOKEN}"})

payload = {
    "model": "nano-banana-2-lite",
    "prompt": "一只戴着蓝色围巾的橘猫坐在窗边，柔和晨光",
    "n": 1,
    "size": "1:1",
    "quality": "auto",
    "response_format": "url",
}

submit_response = session.post(
    f"{BASE_URL}/async/images/generations",
    headers={
        "Content-Type": "application/json",
        "Idempotency-Key": str(uuid.uuid4()),
    },
    json=payload,
    timeout=30,
)
submit_response.raise_for_status()
task = submit_response.json()
task_id = task["id"]
print("task_id:", task_id)

while True:
    status_response = session.get(
        f"{BASE_URL}/async/tasks/{task_id}",
        timeout=15,
    )
    status_response.raise_for_status()
    status_data = status_response.json()
    status = status_data["status"]
    print("status:", status, "progress:", status_data["progress"])

    if status == "success":
        break
    if status in {"failure", "uncertain", "cancelled"}:
        raise RuntimeError(status_data)

    time.sleep(2)

result_response = session.get(
    f"{BASE_URL}/async/tasks/{task_id}/result",
    params={"include_upstream": "false"},
    timeout=30,
)
result_response.raise_for_status()
result = result_response.json()

for index, artifact in enumerate(result["artifacts"]):
    image_response = requests.get(artifact["url"], timeout=120)
    image_response.raise_for_status()

    suffix = ".png" if artifact["content_type"] == "image/png" else ".jpg"
    output = Path(f"{task_id}-{index}{suffix}")
    output.write_bytes(image_response.content)
    print("saved:", output)
```

生产软件应把 `Idempotency-Key` 和 `task_id` 持久化到数据库，避免软件重启后丢失任务关联。

## 11. 完整 JavaScript/TypeScript 示例

适用于 Node.js 18 及以上版本：

```javascript
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'

const baseUrl = 'https://async-api.nexaapp.cn/v1'
const apiToken = '<NEW_API_TOKEN>'

const authHeaders = {
  Authorization: `Bearer ${apiToken}`,
}

const submitResponse = await fetch(`${baseUrl}/async/images/generations`, {
  method: 'POST',
  headers: {
    ...authHeaders,
    'Content-Type': 'application/json',
    'Idempotency-Key': randomUUID(),
  },
  body: JSON.stringify({
    model: 'nano-banana-2-lite',
    prompt: '一只戴着蓝色围巾的橘猫坐在窗边，柔和晨光',
    n: 1,
    size: '1:1',
    quality: 'auto',
    response_format: 'url',
  }),
})

if (!submitResponse.ok) {
  throw new Error(await submitResponse.text())
}

const task = await submitResponse.json()
console.log('task_id:', task.id)

let status
while (true) {
  const statusResponse = await fetch(
    `${baseUrl}/async/tasks/${task.id}`,
    { headers: authHeaders },
  )

  if (!statusResponse.ok) {
    throw new Error(await statusResponse.text())
  }

  status = await statusResponse.json()
  console.log('status:', status.status, 'progress:', status.progress)

  if (status.status === 'success') break
  if (['failure', 'uncertain', 'cancelled'].includes(status.status)) {
    throw new Error(JSON.stringify(status))
  }

  await new Promise((resolve) => setTimeout(resolve, 2000))
}

const resultResponse = await fetch(
  `${baseUrl}/async/tasks/${task.id}/result?include_upstream=false`,
  { headers: authHeaders },
)

if (!resultResponse.ok) {
  throw new Error(await resultResponse.text())
}

const result = await resultResponse.json()
const imageResponse = await fetch(result.artifacts[0].url)

if (!imageResponse.ok) {
  throw new Error(`image download failed: ${imageResponse.status}`)
}

await writeFile(
  `${task.id}.jpg`,
  Buffer.from(await imageResponse.arrayBuffer()),
)
```

## 12. 推荐的客户端状态保存

客户端至少保存以下字段：

| 字段 | 用途 |
| --- | --- |
| `local_request_id` | 软件自己的业务任务 ID |
| `idempotency_key` | 提交超时或断线时安全重试 |
| `remote_task_id` | 本站返回的 `task_id` |
| `status` | 最近一次查询状态 |
| `last_polled_at` | 控制轮询频率 |
| `result_downloaded_at` | 判断是否已保存到自己的存储 |
| `error_code`、`error_message` | 失败诊断和人工处理 |

建议的软件恢复流程：

1. 软件启动时加载所有非终态任务。
2. 已有 `remote_task_id` 的任务只查询状态，不重新提交。
3. 只有提交请求超时且尚未获得 `remote_task_id` 时，才使用原 `idempotency_key` 重新提交。
4. `uncertain` 任务进入人工处理队列，禁止自动重新生成。
5. `success` 后立即下载归档图片并保存到软件自己的长期存储。

## 13. 安全要求

- 不要把 New API Token 写入前端网页、公开仓库、截图或日志。
- 桌面软件应使用系统安全凭据存储；服务端应使用环境变量或 Secret Manager。
- 不要把 Token 放在 URL 查询参数中。
- 不要向客户端分发云雾或 GRS AI 上游密钥。
- 日志中可以记录 `task_id` 和幂等键，但应脱敏 Authorization 请求头和签名下载 URL。
- 如果 Token 泄露，应立即在 New API 后台禁用并重新创建。

## 14. 当前不支持的能力

- 不支持 Webhook/回调通知，客户端需要轮询。
- 不支持流式图片响应。
- 不支持取消已经进入 `running` 的同步上游请求。
- 不支持使用标准 OpenAI 图片 SDK 方法自动完成异步轮询。
- 不保证长期保存图片；客户端必须在保留期内下载。
- `uncertain` 状态不会自动向上游重试，以避免重复生成和重复计费。
