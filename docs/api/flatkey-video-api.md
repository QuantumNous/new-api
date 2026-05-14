# Flatkey 视频生成 API

Flatkey 提供文本/图像驱动的视频生成接口。本文档面向客户端开发者，描述完整的请求 → 轮询 → 下载链路。

- **Base URL**: `https://router.flatkey.ai`
- **认证**: HTTP header `Authorization: Bearer <token>`
- **协议**: OpenAI 兼容的异步任务接口

---

## 快速开始

```bash
TOKEN="sk-xxxxxxxxxxxx"

# 1. 创建任务
RESP=$(curl -sS https://router.flatkey.ai/v1/video/generations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "video-fast",
    "prompt": "一杯冒着热气的咖啡放在木桌上，窗外飘着雪，镜头缓慢推近"
  }')
TASK_ID=$(echo "$RESP" | jq -r '.task_id')

# 2. 轮询
until [ "$(curl -sS "https://router.flatkey.ai/v1/video/generations/$TASK_ID" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data.status')" = "SUCCESS" ]; do
  sleep 5
done

# 3. 获取视频
URL=$(curl -sS "https://router.flatkey.ai/v1/video/generations/$TASK_ID" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data.result_url')
curl -L -o output.mp4 "$URL" -H "Authorization: Bearer $TOKEN"
```

---

## 总体流程

```
1. POST /v1/video/generations          → 立即返回 task_id
2. GET  /v1/video/generations/{id}     → 轮询任务状态（建议 5-10 秒一次）
3. status = SUCCESS 时取 result_url    → 下载视频
```

视频生成是**异步**的：

| 模型 | 典型耗时 |
|---|---|
| `video-fast` | 60–120 秒 |
| `video-pro` | 120–300 秒 |

---

## 1. 创建任务

### Endpoint

```http
POST /v1/video/generations
Authorization: Bearer <token>
Content-Type: application/json
```

### 请求体

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `model` | string | ✅ | 模型名，见 [可用模型](#可用模型) |
| `prompt` | string | ✅ | 文本提示词，中文 ≤ 500 字 / 英文 ≤ 1000 词。运镜、构图、风格直接写进 prompt |
| `metadata` | object | ❌ | 可选参数，见 [metadata 字段](#metadata-字段) |

### 最小请求

```bash
curl https://router.flatkey.ai/v1/video/generations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "video-fast",
    "prompt": "一杯冒着热气的咖啡放在木桌上，窗外飘着雪，镜头缓慢推近"
  }'
```

### 完整请求

```bash
curl https://router.flatkey.ai/v1/video/generations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "video-pro",
    "prompt": "赛博朋克风格的东京街头，霓虹灯闪烁，雨夜，电影感",
    "metadata": {
      "resolution": "720p",
      "ratio": "16:9",
      "duration": 10,
      "generate_audio": true,
      "seed": 42,
      "input_type": "first_last_frame",
      "images": [
        {"url": "https://example.com/start.jpg", "role": "first_frame"},
        {"url": "https://example.com/end.jpg",   "role": "last_frame"}
      ]
    }
  }'
```

### 响应

```json
{
  "id": "task_Bz1hVdh3OGDYAWpGe8EyCpqWHsAzSqVs",
  "task_id": "task_Bz1hVdh3OGDYAWpGe8EyCpqWHsAzSqVs",
  "object": "video",
  "model": "video-fast",
  "status": "queued",
  "progress": 0,
  "created_at": 1778689061
}
```

| 字段 | 含义 |
|---|---|
| `task_id` | 任务 ID，后续轮询用此字段 |
| `status` | 初始 `queued`（排队中） |
| `created_at` | Unix 时间戳（秒） |

---

## 2. 查询任务状态

### Endpoint

```http
GET /v1/video/generations/{task_id}
Authorization: Bearer <token>
```

### 响应（生成中）

```json
{
  "code": "success",
  "data": {
    "task_id": "task_Bz1hVdh3OGDYAWpGe8EyCpqWHsAzSqVs",
    "status": "IN_PROGRESS",
    "progress": "50%",
    "submit_time": 1778689061,
    "start_time": 1778689065,
    "finish_time": 0,
    "result_url": "",
    "properties": {
      "origin_model_name": "video-fast"
    }
  }
}
```

### 响应（成功）

```json
{
  "code": "success",
  "data": {
    "task_id": "task_Bz1hVdh3OGDYAWpGe8EyCpqWHsAzSqVs",
    "status": "SUCCESS",
    "progress": "100%",
    "submit_time": 1778689061,
    "start_time": 1778689065,
    "finish_time": 1778689178,
    "result_url": "https://router.flatkey.ai/v1/videos/task_Bz1hVdh3OGDYAWpGe8EyCpqWHsAzSqVs/content",
    "properties": {
      "origin_model_name": "video-fast"
    }
  }
}
```

### 响应（失败）

```json
{
  "code": "success",
  "data": {
    "task_id": "task_Bz1hVdh3OGDYAWpGe8EyCpqWHsAzSqVs",
    "status": "FAILURE",
    "fail_reason": "prompt rejected by safety filter",
    "result_url": ""
  }
}
```

### 状态枚举

| status | 含义 |
|---|---|
| `QUEUED` / `SUBMITTED` | 排队中 |
| `IN_PROGRESS` | 生成中（伴随 `progress` 百分比） |
| `SUCCESS` | 成功，可读 `result_url` |
| `FAILURE` | 失败，可读 `fail_reason` |

---

## 3. 下载视频

`result_url` 是同域代理链接，必须**带 token** 访问：

```bash
curl -L -o output.mp4 \
  "https://router.flatkey.ai/v1/videos/$TASK_ID/content" \
  -H "Authorization: Bearer $TOKEN"
```

视频生成后 **24 小时内有效**，过期需重新生成。

---

## 可用模型

| 模型名 | 描述 | 适用场景 |
|---|---|---|
| `video-fast` | 快速生成 | 草稿、预览、迭代 |
| `video-pro` | 高质量生成 | 正式产出、复杂运镜、长视频 |

---

## metadata 字段

所有字段均为**可选**。

### 输出参数

| 字段 | 类型 | 默认 | 取值 | 说明 |
|---|---|---|---|---|
| `resolution` | string | `720p` | `480p` / `720p` / `1080p` | 视频分辨率 |
| `ratio` | string | `16:9` | `16:9` / `9:16` / `1:1` / `4:3` / `3:4` | 宽高比 |
| `duration` | int | `5` | `5` / `10` | 视频时长（秒） |
| `generate_audio` | bool | `false` | — | 是否生成配音 |
| `seed` | int | 随机 | 0–2147483647 | 固定随机种子用于结果复现 |
| `web_search` | bool | `false` | — | 启用联网检索辅助生成 |

### 多模态输入

通过 `input_type` 决定参考素材的用法：

| `input_type` | 含义 | 必须提供的素材 |
|---|---|---|
| `text2video` | 纯文本生成（默认） | 仅 prompt |
| `image2video` | 图像驱动 | `images[0]` |
| `first_last_frame` | 首尾帧插值 | `images[0]` (first_frame) + `images[1]` (last_frame) |
| `reference` | 参考图风格迁移 | `images` 中 role=`reference_image` |
| `video2video` | 视频风格化 | `videos[0]` |
| `audio_driven` | 音频驱动 | `audios[0]` |

### 素材数组

每个素材是一个对象：

```json
{
  "url":  "https://your-cdn.com/asset.jpg",
  "role": "first_frame"
}
```

| 字段 | 说明 |
|---|---|
| `url` | 公网可访问的 https URL，必须返回 `Content-Type: image/*` 或 `video/*` |
| `role` | 见下表 |

#### role 取值

| 数组 | role 可选值 |
|---|---|
| `images` | `first_frame` / `last_frame` / `reference_image` |
| `videos` | `reference_video` |
| `audios` | `reference_audio` |

---

## 错误处理

### HTTP 状态码

| 状态码 | 含义 | 客户端行为 |
|---|---|---|
| `200` | 成功 | — |
| `400` | 请求参数错误（如 model 不支持、metadata 字段非法） | 检查请求体 |
| `401` | token 无效或过期 | 重新获取 token |
| `402` | 余额不足 | 充值 |
| `403` | 无权限调用该模型 | 联系客服开通 |
| `429` | 限流 | 退避重试（首次 1s，每次 ×2，最长 30s） |
| `500` | 服务端错误 | 退避重试，连续失败联系客服 |
| `502` | 上游不可达 | 同上 |

### 错误响应体

```json
{
  "code": "invalid_request_error",
  "message": "unsupported model \"video-ultra\"; expected video-fast or video-pro",
  "data": null
}
```

---

## 完整示例（Python）

```python
import time
import requests

TOKEN = "sk-xxxxxxxxxxxx"
BASE = "https://router.flatkey.ai"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}

# 1. 创建任务
resp = requests.post(
    f"{BASE}/v1/video/generations",
    headers={**HEADERS, "Content-Type": "application/json"},
    json={
        "model": "video-pro",
        "prompt": "一只柴犬在樱花树下奔跑，慢镜头，电影感",
        "metadata": {
            "resolution": "720p",
            "ratio": "16:9",
            "duration": 5,
        },
    },
)
resp.raise_for_status()
task_id = resp.json()["task_id"]
print(f"submitted: {task_id}")

# 2. 轮询
while True:
    j = requests.get(
        f"{BASE}/v1/video/generations/{task_id}",
        headers=HEADERS,
    ).json()["data"]
    print(f"status={j['status']} progress={j.get('progress')}")
    if j["status"] in ("SUCCESS", "FAILURE"):
        break
    time.sleep(5)

# 3. 下载
if j["status"] == "SUCCESS":
    video = requests.get(j["result_url"], headers=HEADERS).content
    with open("output.mp4", "wb") as f:
        f.write(video)
    print("saved output.mp4")
else:
    print(f"failed: {j.get('fail_reason')}")
```

---

## 完整示例（JavaScript / Node.js）

```js
const TOKEN = 'sk-xxxxxxxxxxxx';
const BASE = 'https://router.flatkey.ai';
const headers = { Authorization: `Bearer ${TOKEN}` };

async function generate() {
  // 1. 创建任务
  const submit = await fetch(`${BASE}/v1/video/generations`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'video-fast',
      prompt: '海边日落，温暖的金色光线，海浪轻拍沙滩',
      metadata: { resolution: '720p', ratio: '16:9', duration: 5 },
    }),
  }).then(r => r.json());

  const taskId = submit.task_id;
  console.log('submitted:', taskId);

  // 2. 轮询
  while (true) {
    const { data } = await fetch(
      `${BASE}/v1/video/generations/${taskId}`,
      { headers }
    ).then(r => r.json());
    console.log(`status=${data.status} progress=${data.progress}`);
    if (data.status === 'SUCCESS') return data.result_url;
    if (data.status === 'FAILURE') throw new Error(data.fail_reason);
    await new Promise(r => setTimeout(r, 5000));
  }
}

generate().then(url => console.log('video:', url));
```

---

## 计费

按任务计费，价格取决于模型、分辨率、时长。具体费率请咨询客服。

未成功（`FAILURE`）的任务**不扣费**。

---

## 限流

| 维度 | 默认配额 |
|---|---|
| 并发任务 | 5 个/账户 |
| 每分钟提交数 | 30 次/账户 |

超过配额会返回 `429`。如需提升配额请联系客服。

---

## 常见问题

**Q: 任务一直 `IN_PROGRESS` 怎么办？**
A: `video-pro` 最长 5 分钟。超过 10 分钟仍未完成请联系客服并提供 `task_id`。

**Q: `result_url` 24 小时后失效，需要重新生成吗？**
A: 是的。建议在 24 小时内下载本地或转存到你自己的存储。

**Q: prompt 最长能写多少？**
A: 中文 500 字、英文 1000 词。超长会被截断或拒绝。

**Q: 支持 webhook 回调吗？**
A: 暂不支持，请使用轮询。

**Q: prompt 被安全过滤拒绝怎么办？**
A: 调整描述，避免涉及暴力、政治敏感、明确人物姓名等内容。
