# 视频生成 API

通过 new-api 网关调用视频生成模型。本文面向下游客户端开发者，描述完整的请求/轮询/获取链路。

- **网关 base URL**: `https://new-api.api.flatkey.ai`
- **认证**: HTTP header `Authorization: Bearer <token>`，token 在 new-api 后台「令牌管理」生成
- **协议**: OpenAI 兼容的异步任务接口（`/v1/video/generations`）

---

## 总体流程

```
1. POST  /v1/video/generations          → 创建任务，立即返回 task_id
2. GET   /v1/video/generations/{id}     → 轮询任务状态
3. status = SUCCESS 时取 result_url     → 24 小时有效的视频下载链接
```

视频生成是**异步**的：fast 模式约 60–120 秒，pro 模式约 120–300 秒。客户端用任务 ID 轮询直到状态变成 `SUCCESS` 或 `FAILURE`。

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
| `prompt` | string | ✅ | 文本提示词，中文 ≤ 500 字 / 英文 ≤ 1000 词。运镜、构图、风格都写在 prompt 里 |
| `metadata` | object | ❌ | 可选参数，见 [metadata 字段](#metadata-字段) |

### 最小请求

```bash
curl https://new-api.api.flatkey.ai/v1/video/generations \
  -H "Authorization: Bearer sk-xxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "kuaizi-lizhen-fast",
    "prompt": "一杯冒着热气的咖啡放在木桌上，窗外飘着雪，镜头缓慢推近"
  }'
```

### 完整请求

```bash
curl https://new-api.api.flatkey.ai/v1/video/generations \
  -H "Authorization: Bearer sk-xxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "kuaizi-lizhen-pro",
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
  "model": "kuaizi-lizhen-fast",
  "status": "queued",
  "progress": 0,
  "created_at": 1778689061
}
```

| 字段 | 含义 |
|---|---|
| `id` / `task_id` | 任务 ID，后续轮询用 |
| `status` | 初始为 `queued`（排队中） |

---

## 2. 查询任务状态

### Endpoint

```http
GET /v1/video/generations/{task_id}
Authorization: Bearer <token>
```

### 轮询建议

- 间隔 **10–30 秒**，不要更短
- 单次请求不会触发额外计费
- 推荐用指数退避（10s → 20s → 30s → 30s …）

### 响应（生成中）

```json
{
  "code": "success",
  "message": "",
  "data": {
    "id": 3,
    "task_id": "task_Bz1hVdh3OGDYAWpGe8EyCpqWHsAzSqVs",
    "status": "IN_PROGRESS",
    "progress": "50%",
    "submit_time": 1778689061,
    "start_time":  1778689064,
    "finish_time": 0,
    "quota": 9375000,
    "fail_reason": "",
    "result_url": "",
    "properties": {
      "upstream_model_name": "kuaizi-lizhen-fast",
      "origin_model_name":   "kuaizi-lizhen-fast"
    }
  }
}
```

### 响应（成功）

```json
{
  "code": "success",
  "data": {
    "status": "SUCCESS",
    "progress": "100%",
    "finish_time": 1778689179,
    "result_url": "https://bk-hs-p-bj-lizhen.tos-cn-beijing.volces.com/.../video_xxx.mp4",
    "fail_reason": "",
    "data": {
      "code": 0,
      "data": {
        "status": "succeeded",
        "video_url": "https://....mp4",
        "duration": 5,
        "usage": {
          "total_tokens": 50638,
          "completion_tokens": 50638
        }
      }
    }
  }
}
```

**关键字段**：
- `data.status === "SUCCESS"`：生成完成
- `data.result_url`：MP4 下载链接，**24 小时内有效**

### 响应（失败）

```json
{
  "code": "success",
  "data": {
    "status": "FAILURE",
    "fail_reason": "The request failed because the output video may be related to copyright restrictions.",
    "finish_time": 1778688343
  }
}
```

### 状态枚举

| `data.status` | 含义 | 下一步 |
|---|---|---|
| `QUEUED` | 排队中 | 继续轮询 |
| `IN_PROGRESS` | 生成中 | 继续轮询 |
| `SUCCESS` | 成功 | 取 `result_url` 下载 |
| `FAILURE` | 失败 | 看 `fail_reason` |

---

## 可用模型

| `model` | 模式 | 适用 | 说明 |
|---|---|---|---|
| `kuaizi-lizhen-fast` | fast | 大多数场景 | 速度优先，约 60–120 秒 |
| `kuaizi-lizhen-pro`  | pro | 高质量 / 长视频 / 视频参考 | 质量优先，约 120–300 秒；支持 `videos` / `audios` / `web_search` |

底层都走 Seedance（字节豆包视频）。

---

## metadata 字段

所有字段都可选；不传则用模型默认值。

| 字段 | 类型 | 默认 | 模式 | 说明 |
|---|---|---|---|---|
| `resolution` | `"480p"` \| `"720p"` | `"720p"` | fast/pro | 输出分辨率 |
| `ratio` | string | `"adaptive"` | fast/pro | `"16:9"` / `"4:3"` / `"1:1"` / `"3:4"` / `"9:16"` / `"21:9"` / `"adaptive"` |
| `duration` | int | 5 | fast/pro | 视频秒数。fast: 4-12，pro: 4-15，传 -1 让模型决定 |
| `generate_audio` | bool | `true` | fast/pro | 生成同步音频（人声+音效+BGM）。希望特定台词用双引号包起来写在 prompt 里 |
| `seed` | int | — | fast/pro | 随机种子，相同种子生成相似结果，便于复现 |
| `input_type` | `"reference"` \| `"first_last_frame"` | `"reference"` | fast/pro | 图片输入模式：全能参考 or 指定首尾帧 |
| `images` | array | — | fast/pro | 图片参考列表，见 [图片输入](#图片输入) |
| `videos` | array | — | **仅 pro** | 视频参考列表 |
| `audios` | array | — | **仅 pro** | 音频参考列表 |
| `web_search` | bool | `false` | **仅 pro** | 让模型联网搜索辅助理解 prompt |

### 图片输入

`metadata.images` 数组，每项：

```json
{
  "url": "https://example.com/img.jpg",
  "role": "first_frame" | "last_frame" | "reference_image"
}
```

- 最多 9 张
- 格式：jpeg / png / webp / bmp / tiff / gif
- 尺寸：300–6000 px，宽高比 0.4–2.5
- 单张 ≤ 30 MB

`role` 与 `input_type` 配合：
- `input_type: "first_last_frame"` → `images` 应包含 `first_frame` 和 `last_frame`
- `input_type: "reference"` → `images` 都用 `reference_image`

### 视频/音频输入（仅 pro 模式）

`metadata.videos`：每项 `{url, role: "reference_video"}`，最多 3 个，总时长 ≤ 15 秒  
`metadata.audios`：每项 `{url, role: "reference_audio"}`，最多 3 个，总时长 ≤ 15 秒，必须搭配图片或视频使用

---

## 完整客户端示例

### JavaScript / TypeScript

```ts
const TOKEN = "sk-xxxxxxxx"
const API = "https://new-api.api.flatkey.ai"

async function generateVideo(prompt: string, opts: { duration?: number } = {}) {
  // 1. 创建任务
  const create = await fetch(`${API}/v1/video/generations`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "kuaizi-lizhen-fast",
      prompt,
      metadata: {
        resolution: "720p",
        ratio: "16:9",
        duration: opts.duration ?? 5,
        generate_audio: false,
      },
    }),
  }).then(r => r.json())

  const taskId = create.task_id
  if (!taskId) throw new Error(`create failed: ${JSON.stringify(create)}`)

  // 2. 轮询
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 10_000))   // 10 秒
    const poll = await fetch(`${API}/v1/video/generations/${taskId}`, {
      headers: { "Authorization": `Bearer ${TOKEN}` },
    }).then(r => r.json())

    const { status, result_url, fail_reason } = poll.data
    if (status === "SUCCESS") return result_url
    if (status === "FAILURE") throw new Error(`generation failed: ${fail_reason}`)
  }
  throw new Error("timeout after 10 minutes")
}

// 用法
const url = await generateVideo("一杯热咖啡在木桌上冒热气，雪夜，镜头推近")
console.log("Download MP4 (24h valid):", url)
```

### Python

```python
import time
import requests

TOKEN = "sk-xxxxxxxx"
API = "https://new-api.api.flatkey.ai"
HDR = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

def generate_video(prompt: str, duration: int = 5) -> str:
    create = requests.post(
        f"{API}/v1/video/generations",
        headers=HDR,
        json={
            "model": "kuaizi-lizhen-fast",
            "prompt": prompt,
            "metadata": {
                "resolution": "720p",
                "ratio": "16:9",
                "duration": duration,
                "generate_audio": False,
            },
        },
    ).json()

    task_id = create.get("task_id")
    if not task_id:
        raise RuntimeError(f"create failed: {create}")

    for _ in range(60):
        time.sleep(10)
        poll = requests.get(
            f"{API}/v1/video/generations/{task_id}", headers=HDR
        ).json()["data"]

        if poll["status"] == "SUCCESS":
            return poll["result_url"]
        if poll["status"] == "FAILURE":
            raise RuntimeError(f"generation failed: {poll['fail_reason']}")

    raise TimeoutError("10 minutes elapsed without result")
```

---

## 错误处理

### 创建阶段错误

```json
{
  "error": {
    "code": "...",
    "message": "...",
    "type": "new_api_error"
  }
}
```

| 常见错误 | 原因 | 处理 |
|---|---|---|
| `invalid character ... looking for beginning of object key string` | JSON 格式不对（中文标点 / 非 ASCII 引号） | 用 ASCII 引号重新构造 JSON |
| `unsupported kuaizi model "fast"` | 客户端传了错误的 model 名 | 用 `kuaizi-lizhen-fast` 或 `kuaizi-lizhen-pro` 完整名 |
| `分组 default 下模型 X 无可用渠道` | 模型未在你 token 的分组下开通 | 联系管理员开通分组权限 |
| `模型 X 价格未配置` | 后台未配定价 | 联系管理员配置或启用自用模式 |

### 生成阶段错误（status=FAILURE）

`data.fail_reason` 会包含上游具体原因。最常见：

| 错误 | 含义 | 改 prompt 怎么做 |
|---|---|---|
| `output video may be related to copyright restrictions` | content filter 拒了（名人、IP、品牌等） | 换更通用的描述，避开真人/明星/动漫 IP/品牌 logo |
| `inappropriate content` | 内容违规 | 移除暴力/色情/政治敏感词 |
| `image url not accessible` | 图片 URL 打不开或格式不支持 | 检查 URL 公开访问 + 格式 |
| `duration out of range` | 时长超限 | fast 模式 4–12 秒，pro 4–15 秒 |

---

## 计费

按上游返回的 `usage.total_tokens` × 模型倍率计费，从 token 额度扣除。轮询不额外计费。

- 一段 5 秒 480p 视频约 **50,000 tokens**
- 一段 10 秒 720p 视频约 **100,000–150,000 tokens**

`pro` 模式倍率高于 `fast`。

---

## 限制 & 注意事项

| 维度 | 限制 |
|---|---|
| 单次请求最大 prompt 长度 | 中文 500 字 / 英文 1000 词 |
| `duration` | fast 4–12s，pro 4–15s，`-1` 由模型决定 |
| `images` | ≤ 9 张，单张 ≤ 30MB，宽高 300–6000 px |
| `videos`（pro） | ≤ 3 个，总时长 ≤ 15s，单个 ≤ 50MB，仅 mp4/mov |
| `audios`（pro） | ≤ 3 段，总时长 ≤ 15s，单个 ≤ 15MB，仅 wav/mp3 |
| 总并发任务数 | 上游有队列限制；客户端建议串行或最多 3 并发 |
| `result_url` 有效期 | **24 小时**，过期需重新生成或自己转存 |
| 内容审核 | 名人、IP 角色、品牌 logo 可能被拒；改通用描述 |

---

## FAQ

**Q: 拿到 result_url 后能用多久？**  
A: 24 小时。建议拿到链接立即下载或转存到自家 OSS / S3。过期后需要重新生成。

**Q: prompt 写中文还是英文？**  
A: 都可以。复杂场景中文更准。运镜动作（推/拉/摇/移）直接写中文。

**Q: 怎么让人物有特定台词？**  
A: 把台词放双引号里写在 prompt，例如：`镜头中的男人微笑说 "今天天气真好"`。需要 `metadata.generate_audio: true`。

**Q: 同一 prompt 想生成多次相似的视频？**  
A: 用 `metadata.seed` 固定种子；不同 seed 同 prompt 可以拿到多个变体。

**Q: 怎么做首尾帧过渡？**  
A: 设 `input_type: "first_last_frame"`，`images` 里给 `first_frame` 和 `last_frame` 两张 URL。

**Q: 任务超时怎么办？**  
A: 5 分钟还没成功多半是被风控拦了但没及时返回；改 prompt 重发即可。生产建议轮询 ≤ 10 分钟，超时按失败处理。

**Q: 失败有没有退款？**  
A: `FAILURE` 状态的任务**不消耗 quota**（new-api 自动撤回预扣额度）。

---

## 接入支持

- 调用问题、token 申请、分组配置：联系 new-api 平台管理员
- 模型质量、内容审核反馈：联系筷子科技（上游 Seedance 服务商）
- 接口异常 / bug：在 SolveaCX/new-api 仓库开 issue
