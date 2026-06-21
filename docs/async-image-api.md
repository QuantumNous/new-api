# 异步图片生成 API 文档

## 概述

`POST /v1/images/generations` 支持可选的异步模式。设置 `"async": true` 后，服务端立即返回 `task_id`，图片在后台生成。客户端通过轮询 `GET /v1/images/generations/{task_id}` 获取结果。

同步模式（不传 `async` 或 `"async": false`）行为不变，完全向后兼容。

---

## 1. 提交异步图片生成请求

### 请求

```
POST /v1/images/generations
Content-Type: application/json
Authorization: Bearer <your_token>
```

### 请求体

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `model` | string | 是 | 模型名称，如 `agnes-image-2.1-flash`、`gpt-image-2` |
| `prompt` | string | 是 | 图片描述 |
| `n` | int | 否 | 生成数量，默认 1 |
| `size` | string | 否 | 图片尺寸，如 `1024x1024`、`1024x1792` |
| `quality` | string | 否 | 图片质量，如 `standard`、`hd` |
| `response_format` | string | 否 | 返回格式：`url`（默认）或 `b64_json` |
| `async` | bool | 否 | **设为 `true` 启用异步模式**，不传则走同步 |
| `cdn` | string | 否 | 设为 `"qiniu"` 时，图片上传至七牛 CDN 并返回 CDN 地址 |
| `callback_url` | string | 否 | 回调地址。任务完成后服务端 POST 结果到此 URL，不再需要轮询 |

### 示例请求体

```json
{
  "model": "agnes-image-2.1-flash",
  "prompt": "一只戴墨镜的猫在海滩上",
  "n": 1,
  "size": "1024x1024",
  "async": true,
  "cdn": "qiniu"
}
```

> **注意**：`async` 和 `cdn` 是自定义扩展字段，不会转发给上游 AI 提供商。

### 成功响应 — 202 Accepted

```json
{
  "success": true,
  "data": {
    "task_id": "task_Jaiq2fnvLzjjfTExugYKy5mqQIkBOmr0",
    "status": "submitted",
    "created_at": 1781924545
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `data.task_id` | string | 任务 ID，用于后续轮询 |
| `data.status` | string | 固定值 `"submitted"` |
| `data.created_at` | int | 提交时间（Unix 时间戳，秒） |

### 错误响应

```json
{
  "error": {
    "message": "error message here",
    "type": "invalid_request_error"
  }
}
```

常见错误码：

| HTTP 状态码 | 说明 |
|-------------|------|
| 400 | 参数错误（缺少 prompt、模型不存在等） |
| 413 | 请求体过大 |
| 429 | 频率限制 |
| 500 | 服务端内部错误 |

---

## 2. 轮询任务状态

### 请求

```
GET /v1/images/generations/{task_id}
Authorization: Bearer <your_token>
```

### 进行中响应 — 200 OK

```json
{
  "success": true,
  "data": {
    "task_id": "task_Jaiq2fnvLzjjfTExugYKy5mqQIkBOmr0",
    "status": "processing",
    "progress": "0%",
    "created_at": 1781924545
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `data.status` | string | 当前状态，见下方状态表 |
| `data.progress` | string | 进度百分比，如 `"0%"`、`"50%"`、`"100%"` |

### 完成响应 — 200 OK（OpenAI Image API 格式）

```json
{
  "data": [
    {
      "url": "https://cdn.vencloud.cn/image/2026-06/8c03a421cf8678ab6d1db6a9b383bce5.png",
      "b64_json": "",
      "revised_prompt": ""
    }
  ],
  "created": 1781924556
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `data[].url` | string | 图片 URL（使用 CDN 时为 CDN 地址） |
| `data[].b64_json` | string | Base64 编码的图片数据（通常为空，URL 优先） |
| `data[].revised_prompt` | string | 模型修订后的 prompt（如有） |
| `created` | int | 任务完成时间（Unix 时间戳，秒） |

### 失败响应 — 200 OK

```json
{
  "data": [
    {
      "url": "",
      "b64_json": "",
      "revised_prompt": ""
    }
  ],
  "created": 1781924556,
  "error": {
    "message": "upstream provider returned error: ..."
  }
}
```

> 失败时 `data[].url` 为空字符串。可通过 `GET` 响应中的 `fail_reason` 字段查看失败原因（见下方通用格式）。

### 未找到 — 404 Not Found

```json
{
  "error": {
    "message": "task not found: task_xxx",
    "type": "invalid_request_error"
  }
}
```

---

## 3. 状态值

| 内部状态 | 轮询返回值 | 说明 |
|----------|-----------|------|
| `IN_PROGRESS` | `processing` | 任务正在处理中 |
| `SUCCESS` | `succeeded` | 任务成功完成 |
| `FAILURE` | `failed` | 任务失败 |
| `QUEUED` / `SUBMITTED` | `queued` | 任务已提交，等待处理 |

---

## 4. 推荐轮询策略

```
提交请求 → 获得 task_id
    │
    ▼
每 5~10 秒轮询一次 GET /v1/images/generations/{task_id}
    │
    ├─ status == "processing" 或 "queued" → 继续轮询
    ├─ status == "succeeded" → 获取图片 URL，结束
    ├─ status == "failed" → 查看错误信息，结束
    └─ 404 → task_id 无效或已过期
```

- 建议轮询间隔：**5~10 秒**
- 图片生成通常耗时 **3~30 秒**（取决于模型和负载）
- 建议设置最大轮询次数或超时时间（如 5 分钟）

---

## 5. 完整调用示例（Python）

```python
import requests
import time

BASE_URL = "http://your-server:3000"
TOKEN = "sk-your-token"
HEADERS = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {TOKEN}"
}

# 1. 提交异步请求
resp = requests.post(f"{BASE_URL}/v1/images/generations", headers=HEADERS, json={
    "model": "agnes-image-2.1-flash",
    "prompt": "a cute cat wearing sunglasses",
    "n": 1,
    "size": "1024x1024",
    "async": True,
    "cdn": "qiniu"  # 可选：上传到七牛 CDN
})
print(f"提交响应 ({resp.status_code}):", resp.json())

task_id = resp.json()["data"]["task_id"]

# 2. 轮询状态
while True:
    time.sleep(5)
    resp = requests.get(
        f"{BASE_URL}/v1/images/generations/{task_id}",
        headers=HEADERS
    )
    result = resp.json()
    
    # 完成时直接返回 OpenAI Image 格式
    if "data" in result and isinstance(result["data"], list) and len(result["data"]) > 0:
        url = result["data"][0].get("url", "")
        if url:
            print(f"图片 URL: {url}")
            break
    
    # 进行中
    status = result.get("data", {}).get("status", "unknown")
    progress = result.get("data", {}).get("progress", "")
    print(f"状态: {status} {progress}")
    
    if status == "failed":
        print("任务失败")
        break
```

---

## 6. 完整调用示例（cURL）

```bash
# 提交
RESPONSE=$(curl -s -X POST "http://your-server:3000/v1/images/generations" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-token" \
  -d '{
    "model": "agnes-image-2.1-flash",
    "prompt": "a sunset over the ocean",
    "n": 1,
    "size": "1024x1024",
    "async": true
  }')

echo "$RESPONSE"
TASK_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['task_id'])")
echo "Task ID: $TASK_ID"

# 轮询（每 5 秒）
while true; do
  sleep 5
  RESULT=$(curl -s "http://your-server:3000/v1/images/generations/$TASK_ID" \
    -H "Authorization: Bearer sk-your-token")
  echo "$RESULT" | python3 -m json.tool
  
  STATUS=$(echo "$RESULT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('data', {}).get('status', d.get('status', 'unknown')))
" 2>/dev/null)
  
  if [ "$STATUS" = "succeeded" ] || [ "$STATUS" = "failed" ]; then
    break
  fi
done
```

---

## 7. CDN 模式（`cdn: "qiniu"`）

当请求中包含 `"cdn": "qiniu"` 时：

1. 图片生成完成后，服务端自动将图片上传至七牛云存储
2. 返回的 `data[].url` 为 CDN 地址（`https://cdn.vencloud.cn/image/YYYY-MM/{md5}.png`）
3. `data[].b64_json` 被清空
4. CDN 参数不会转发给上游 AI 提供商

CDN 地址格式固定为：
```
https://cdn.vencloud.cn/image/{年-月}/{内容MD5}.{扩展名}
```

- 相同内容不会重复上传（MD5 压重）
- 按月分目录，便于 CDN 缓存管理

---

## 8. 回调模式（`callback_url`）

当请求中包含 `"callback_url"` 时，任务完成后服务端会主动 POST 结果到指定地址，无需轮询。

### 回调请求

```
POST <callback_url>
Content-Type: application/json
```

### 成功回调 Payload

```json
{
  "task_id": "task_Jaiq2fnvLzjjfTExugYKy5mqQIkBOmr0",
  "status": "succeeded",
  "data": {
    "data": [
      {
        "url": "https://cdn.vencloud.cn/image/2026-06/8c03a421cf8678ab6d1db6a9b383bce5.png",
        "b64_json": "",
        "revised_prompt": ""
      }
    ],
    "created": 1781924556
  }
}
```

### 失败回调 Payload

```json
{
  "task_id": "task_Jaiq2fnvLzjjfTExugYKy5mqQIkBOmr0",
  "status": "failed",
  "error": {
    "message": "upstream provider returned error: ..."
  }
}
```

### 示例请求体

```json
{
  "model": "agnes-image-2.1-flash",
  "prompt": "一只戴墨镜的猫在海滩上",
  "n": 1,
  "size": "1024x1024",
  "async": true,
  "callback_url": "https://your-server.com/webhook/image-done",
  "cdn": "qiniu"
}
```

> **注意**：`callback_url` 是自定义扩展字段，不会转发给上游 AI 提供商。

### 回调注意事项

- 回调超时 10 秒，超时后不重试
- 回调失败仅记录日志，不影响任务状态
- 回调与轮询可以同时使用——设置了 `callback_url` 仍可通过 `GET` 查询任务状态
- 回调 URL 必须是公网可访问的地址

---

## 9. 注意事项

- **认证**：所有请求需要 `Authorization: Bearer <token>` 头
- **频率限制**：异步请求受 `ModelRequestRateLimit` 中间件限制
- **计费**：提交时预扣额度，成功后结算实际用量，失败后全额退还
- **任务过期**：任务记录持久化在数据库中，不会自动过期
- **并发安全**：CAS（Compare-And-Swap）机制确保任务状态只转换一次，不会重复计费或退款
- **同步/异步兼容**：不传 `async` 字段时行为与标准 OpenAI Image API 完全一致
