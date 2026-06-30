# Seedance 2.0 视频生成 · API 调用文档

本文说明如何通过 new-api 调用火山引擎 **Seedance 2.0** 系列视频生成模型，覆盖全部端点、参数、四种生成场景（文生 / 图生首帧 / 图生首尾帧 / 多模态参考生视频），并重点说明**如何把「素材资产」用进视频请求**。

> 素材资产的获取见配套文档：**火山引擎资产 · API 调用文档**（`volc-asset-api.md`）与 **配置说明**（`volc-asset-config.md`）。

---

## 1. 基础信息

### 接口域名

```HTTP
https://<你的 new-api 域名>
```

### 请求头

| Header | 必填 | 说明 |
| --- | --- | --- |
| `Authorization` | 是 | `Bearer <new-api 令牌>`（`sk-` 开头的 API 令牌，**非上游火山密钥**） |
| `Content-Type` | 是 | `application/json` |

### 支持的模型

| 模型 ID | 说明 |
| --- | --- |
| `doubao-seedance-2-0-260128` | Seedance 2.0 标准版 |
| `doubao-seedance-2-0-fast-260128` | Seedance 2.0 快速版（更快、成本更低） |
| `doubao-seedance-1-5-pro-251215`、`doubao-seedance-1-0-pro-250528`、`doubao-seedance-1-0-lite-t2v`、`doubao-seedance-1-0-lite-i2v` | 兼容的 1.x 系列（同一套接口） |

> **前置条件**：管理员需在 new-api 中配置一条支持上述模型的渠道（渠道类型 `DoubaoVideo` 或 `VolcEngine`，填入火山 Ark 的 API Key），且调用令牌所在分组有该模型权限。

---

## 2. 概述

视频生成是**异步任务**：先提交任务拿到 `task_id`，再轮询查询直至完成，最后取视频 URL 或直接下载。

| 用途 | 方法与路径 |
| --- | --- |
| 提交生成任务 | `POST /v1/video/generations`（等价别名：`POST /v1/videos`） |
| 查询任务状态 | `GET /v1/video/generations/{task_id}`（等价别名：`GET /v1/videos/{task_id}`） |
| 直接下载视频字节流 | `GET /v1/videos/{task_id}/content` |

**四种生成场景**（Seedance 2.0，互斥，同一任务不可混用）：

| 场景 | image_url | video_url | audio_url |
| --- | --- | --- | --- |
| 文生视频 | — | — | — |
| 图生视频（首帧） | 1 张，`role: first_frame` | — | — |
| 图生视频（首+尾帧） | 2 张，`role: first_frame` + `last_frame` | — | — |
| 多模态参考生视频 | 1–9 张，`role: reference_image` | 0–3 段，`role: reference_video` | 0–3 段 |

---

## 3. 提交生成任务

```
POST https://{host}/v1/video/generations
```

### 顶层请求字段

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `model` | string | 是 | 模型 ID，如 `doubao-seedance-2-0-260128` |
| `prompt` | string | 是 | 文本提示词。可在其中内联火山参数，如 `... --ratio 16:9 --duration 5 --watermark false` |
| `images` | []string | 否 | 输入图片 URL 数组。**1 张=首帧**；需要首尾帧/参考图/视频输入时改用 `metadata.content`（见 [第 6 节](#6-生成场景与示例)） |
| `seconds` | string | 否 | 视频时长（秒，字符串）。等价于 `metadata.duration` |
| `metadata` | object | 否 | 火山专属参数容器，见下表 |

> ⚠️ **关键规则**
> - `prompt` 文本始终取自顶层 `prompt` 字段：即使你在 `metadata.content` 里写了 `type: "text"` 项也会被忽略并替换为顶层 `prompt`。
> - 若同时传 `images` 与 `metadata.content`，**以 `metadata.content` 为准**（`images` 被覆盖）。
> - 给图片加 `role`、或注入 `video_url`/`audio_url`，**只能**通过 `metadata.content` 数组实现。直接写 `metadata.first_frame`、`metadata.reference_images` 等**不会生效**（未知键会被丢弃）。

### `metadata` 火山参数

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `resolution` | string | 输出分辨率：`480p` / `720p` / `1080p` / `2K`（默认随模型） |
| `ratio` | string | 画面比例：`16:9` / `9:16` / `4:3` / `3:4` / `21:9` / `1:1` / `adaptive` |
| `duration` | int | 时长（秒），常见 4–15，随模型而定 |
| `frames` | int | 帧数（与 `duration`/`fps` 二选一控制时长，按模型约束） |
| `seed` | int | 随机种子，`-1` 表示随机 |
| `camera_fixed` | bool | 是否固定镜头 |
| `watermark` | bool | 是否加水印 |
| `generate_audio` | bool | 是否生成同步音频（部分模型支持，如 Seedance 1.5 Pro） |
| `service_tier` | string | 服务层级：`default`（在线）/ `flex`（离线，更便宜更慢） |
| `return_last_frame` | bool | 是否返回尾帧图（用于连续生成接龙） |
| `execution_expires_after` | int | 任务超时（秒） |
| `draft` | bool | 样片预览模式（部分模型支持，强制 480p） |
| `callback_url` | string | 任务完成回调地址 |
| `priority` | int | 任务优先级 |
| `content` | array | **完整的 Doubao content 数组**，用于精确控制多模态输入与 `role`（见 [第 6 节](#6-生成场景与示例)） |

> 时长设置建议用 `metadata.duration`（或顶层 `seconds`）。本模型适配器不读取顶层 `duration` 整数字段，请勿用它来设时长。

### 成功响应（HTTP 200）

提交成功返回一个任务对象（`status` 初始为 `queued`）。注意 `id` 是 **new-api 的任务 ID**，后续查询/下载都用它：

```json
{
  "id": "video-xxxxxxxxxxxx",
  "task_id": "video-xxxxxxxxxxxx",
  "object": "video",
  "model": "doubao-seedance-2-0-260128",
  "status": "queued",
  "progress": 0,
  "created_at": 1769835600
}
```

**最小请求示例（文生视频）**

```bash
curl -X POST 'https://{host}/v1/video/generations' \
  -H 'Authorization: Bearer sk-YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "doubao-seedance-2-0-260128",
    "prompt": "金毛犬在阳光麦田中奔跑，电影感广角跟拍",
    "metadata": { "resolution": "1080p", "ratio": "16:9", "duration": 5, "watermark": false }
  }'
```

---

## 4. 查询任务状态

```
GET https://{host}/v1/video/generations/{task_id}
```

**请求示例**

```bash
curl 'https://{host}/v1/video/generations/video-xxxxxxxxxxxx' \
  -H 'Authorization: Bearer sk-YOUR_TOKEN'
```

**进行中 / 成功 / 失败响应**

```json
{
  "id": "video-xxxxxxxxxxxx",
  "task_id": "video-xxxxxxxxxxxx",
  "object": "video",
  "model": "doubao-seedance-2-0-260128",
  "status": "completed",
  "progress": 100,
  "created_at": 1769835600,
  "completed_at": 1769835660,
  "metadata": { "url": "https://...tos-cn-beijing.volces.com/....mp4?sig=..." }
}
```

| 字段 | 说明 |
| --- | --- |
| `status` | `queued`（排队）/ `in_progress`（生成中）/ `completed`（成功）/ `failed`（失败） |
| `progress` | 进度百分比（0–100） |
| `metadata.url` | **成功时**的视频地址（火山 TOS 链接，约 24 小时有效，请及时下载/转存） |
| `error` | **失败时**的错误对象 `{ "code": "...", "message": "..." }` |

**轮询建议**：每 8–15 秒查询一次，直到 `status` 为 `completed` 或 `failed`。

---

## 5. 下载视频

成功后既可直接使用 `metadata.url`，也可让 new-api 代理下载字节流（自动处理上游鉴权）：

```bash
curl -L 'https://{host}/v1/videos/video-xxxxxxxxxxxx/content' \
  -H 'Authorization: Bearer sk-YOUR_TOKEN' \
  --output result.mp4
```

> 任务未成功时该接口返回 `400`（`Task is not completed yet`）。

---

## 6. 生成场景与示例

### 6.1 文生视频

仅文本，无媒体输入。见 [第 3 节](#3-提交生成任务)最小示例。

### 6.2 图生视频（首帧）

最简单：把图片 URL 放进 `images`，单张即作为首帧。

```bash
curl -X POST 'https://{host}/v1/video/generations' \
  -H 'Authorization: Bearer sk-YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "doubao-seedance-2-0-260128",
    "prompt": "镜头缓慢推进，人物转头微笑",
    "images": ["https://example.com/first.jpg"],
    "metadata": { "ratio": "adaptive", "duration": 5 }
  }'
```

### 6.3 图生视频（首 + 尾帧）

必须用 `metadata.content`，并给两张图分别标 `role`：

```bash
curl -X POST 'https://{host}/v1/video/generations' \
  -H 'Authorization: Bearer sk-YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "doubao-seedance-2-0-260128",
    "prompt": "从首帧自然过渡到尾帧",
    "metadata": {
      "ratio": "16:9",
      "duration": 5,
      "content": [
        { "type": "image_url", "image_url": { "url": "https://example.com/first.jpg" }, "role": "first_frame" },
        { "type": "image_url", "image_url": { "url": "https://example.com/last.jpg" },  "role": "last_frame"  }
      ]
    }
  }'
```

### 6.4 多模态参考生视频

参考图（1–9 张）、参考视频（0–3 段）、参考音频（0–3 段）可组合。视频/音频只能通过 `metadata.content` 注入：

```bash
curl -X POST 'https://{host}/v1/video/generations' \
  -H 'Authorization: Bearer sk-YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "doubao-seedance-2-0-260128",
    "prompt": "保持参考人物特征，按参考视频的运镜生成",
    "metadata": {
      "ratio": "16:9",
      "duration": 5,
      "content": [
        { "type": "image_url", "image_url": { "url": "https://example.com/ref1.jpg" }, "role": "reference_image" },
        { "type": "image_url", "image_url": { "url": "https://example.com/ref2.jpg" }, "role": "reference_image" },
        { "type": "video_url", "video_url": { "url": "https://example.com/ref.mp4" }, "role": "reference_video" },
        { "type": "audio_url", "audio_url": { "url": "https://example.com/ref.mp3" } }
      ]
    }
  }'
```

> 含 `video_url` 输入会被识别为「输入包含视频」，按对应计费档计价（见 [第 8 节](#8-计费说明)）。

---

## 7. 用「素材资产」做视频请求

素材资产网关（`/doubao/open/*`）管理的素材本质是**媒体 URL**。把这些 URL 放进视频请求的 `images` 或 `metadata.content` 即可。整体流程：

```
1. 上传/查询素材（资产 API）  →  拿到素材的 URL
2. 把 URL 填入视频请求的 images / metadata.content（按场景设 role）
3. 提交视频任务 → 轮询 → 下载视频
```

### 7.1 第一步：拿到素材 URL

用资产 API 创建素材并轮询至 `Active`，从 `GetAsset` 结果取 `URL`：

```bash
# 上传素材（图片）
curl -X POST 'https://{host}/doubao/open/CreateAsset' \
  -H 'Authorization: Bearer sk-YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{ "URL": "https://example.com/portrait.png", "AssetType": "Image", "Name": "首帧图" }'
# → { "Id": "asset-...." }

# 轮询素材状态，取 URL
curl -X POST 'https://{host}/doubao/open/GetAsset' \
  -H 'Authorization: Bearer sk-YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{ "Id": "asset-...." }'
# → { "Id": "...", "Status": "Active", "URL": "https://...tos...png?sig=...", ... }
```

> 素材 `URL` 通常是带时效签名的 TOS 地址，请在签名有效期内尽快用于视频请求；过期后重新调用 `GetAsset` 获取最新 URL。该 URL 需可被上游火山服务访问（火山 TOS 地址天然满足）。

### 7.2 第二步：把素材 URL 用进视频请求

- **图片素材作首帧**：放进 `images`。
- **图片素材作首尾帧 / 参考图，或视频、音频素材**：放进 `metadata.content` 并按场景设 `role`。

```bash
curl -X POST 'https://{host}/v1/video/generations' \
  -H 'Authorization: Bearer sk-YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "doubao-seedance-2-0-260128",
    "prompt": "人物缓缓转头并微笑",
    "metadata": {
      "ratio": "adaptive",
      "duration": 5,
      "content": [
        { "type": "image_url", "image_url": { "url": "https://...tos...png?sig=..." }, "role": "first_frame" }
      ]
    }
  }'
```

### 7.3 完整端到端示例（Python）

```python
import time
import requests

HOST = "https://your-newapi-host"
TOKEN = "sk-YOUR_TOKEN"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}


def asset(action, body):
    r = requests.post(f"{HOST}/doubao/open/{action}", json=body, headers=HEADERS)
    r.raise_for_status()
    return r.json()


# ---------- 1. 上传素材并等待就绪，拿到 URL ----------
created = asset("CreateAsset", {
    "URL": "https://example.com/portrait.png",
    "AssetType": "Image",
    "Name": "首帧图",
})
asset_id = created["Id"]

asset_url = None
for _ in range(60):
    time.sleep(1)
    info = asset("GetAsset", {"Id": asset_id})
    if info.get("Status") == "Active":
        asset_url = info["URL"]
        break
    if info.get("Status") in ("Failed", "Deleted"):
        raise RuntimeError(f"素材处理失败：{info.get('Status')}")
assert asset_url, "素材未在预期时间内就绪"

# ---------- 2. 用素材 URL 提交图生视频（首帧） ----------
submit = requests.post(
    f"{HOST}/v1/video/generations",
    headers=HEADERS,
    json={
        "model": "doubao-seedance-2-0-260128",
        "prompt": "人物缓缓转头并微笑，电影感打光",
        "metadata": {
            "ratio": "adaptive",
            "duration": 5,
            "resolution": "1080p",
            "content": [
                {"type": "image_url", "image_url": {"url": asset_url}, "role": "first_frame"}
            ],
        },
    },
)
submit.raise_for_status()
task_id = submit.json()["id"]
print(f"视频任务：{task_id}")

# ---------- 3. 轮询视频任务 ----------
video_url = None
for _ in range(120):
    time.sleep(8)
    q = requests.get(f"{HOST}/v1/video/generations/{task_id}", headers=HEADERS)
    q.raise_for_status()
    data = q.json()
    print("状态：", data["status"], data.get("progress"))
    if data["status"] == "completed":
        video_url = (data.get("metadata") or {}).get("url")
        break
    if data["status"] == "failed":
        raise RuntimeError(f"生成失败：{data.get('error')}")
assert video_url, "任务未在预期时间内完成"
print("视频 URL：", video_url)

# ---------- 4. 下载视频（也可直接用 video_url） ----------
content = requests.get(
    f"{HOST}/v1/videos/{task_id}/content",
    headers={"Authorization": f"Bearer {TOKEN}"},
)
content.raise_for_status()
with open("result.mp4", "wb") as f:
    f.write(content.content)
print("已保存 result.mp4")
```

---

## 8. 计费说明

Seedance 视频按 **token** 计费，token 用量约为：

```
token ≈ (输入视频时长 + 输出视频时长) × 输出宽 × 输出高 × 输出帧率 / 1024
```

- 实际扣费在任务**成功后**依据上游返回的 `usage` 计算。
- new-api 会按「输出分辨率档（480p/720p 基准、1080p、4K）」与「输入是否包含视频」对基准价做倍率调整：
  - 含视频输入通常比纯图/文输入更便宜；
  - 分辨率越高，token 与成本越高。
- 失败任务不计费。

> 具体单价由管理员配置的 ModelRatio 与价格倍率决定，请以你所在部署的计费配置为准。

---

## 9. 错误处理

| 场景 | 返回 |
| --- | --- |
| 缺少 `model` / `prompt` 等必填项、请求体非法 | `400`，OpenAI 风格错误对象 |
| 令牌无效 / 无该模型权限 | `401` / `403` |
| 任务未完成就下载 `/content` | `400` `Task is not completed yet` |
| 任务本身失败 | 查询响应 `status: "failed"`，详情在 `error.code` / `error.message` |
| 上游生成失败 / 网关错误 | `5xx`，错误信息透传 |

---

## 10. 附录：参数速查

**提交（顶层）**：`model`(必填)、`prompt`(必填)、`images`、`seconds`、`metadata`

**metadata 常用**：`resolution`、`ratio`、`duration`、`seed`、`camera_fixed`、`watermark`、`generate_audio`、`frames`、`service_tier`、`return_last_frame`、`callback_url`、`content`

**content 元素**：

| type | 子字段 | role 可选值 |
| --- | --- | --- |
| `text` | `text` | —（会被顶层 `prompt` 覆盖，无需手填） |
| `image_url` | `image_url.url` | `first_frame` / `last_frame` / `reference_image` |
| `video_url` | `video_url.url` | `reference_video` |
| `audio_url` | `audio_url.url` | — |

**端点**：

| 操作 | 方法 路径 |
| --- | --- |
| 提交 | `POST /v1/video/generations`（或 `/v1/videos`） |
| 查询 | `GET /v1/video/generations/{task_id}`（或 `/v1/videos/{task_id}`） |
| 下载 | `GET /v1/videos/{task_id}/content` |
