# Seedance 视频生成 API — 四模型统一说明

面向持有本站 API Key（`sk-` 令牌）的调用方。本文档覆盖现网对外提供的 Seedance 相关模型。

| 项目 | 说明 |
|------|------|
| Base URL | `https://你的域名`（示例：`https://996k.cn`） |
| 认证 | `Authorization: Bearer sk-xxxxxxxx` |
| 调试页 | 部署后访问 `/seedance-debug.html` |

```bash
export BASE="https://996k.cn"
export TOKEN="sk-你的令牌"
```

---

## 1. 模型一览

| 模型 ID | 说明 | 创建路径 | 素材方式 |
|---------|------|----------|----------|
| `37:seedance-2.0` | Seedance 2.0 标准（aistar） | `POST /v1/video/generations` | 文生；可选公网图 URL |
| `37:seedance-2.0-fast` | Seedance 2.0 快速（aistar） | 同上 | 同上 |
| `doubao-seedance-2.0` | 豆包 Seedance 2.0（多模态） | 同上 | `content` 图/视频/音频 URL |
| `mingiz-sd2` | 星河 2.0 | `POST /v1/videos` | multipart 上传文件，或 JSON 公网 URL |
| `sd2-431` | th12345ai 满血（→ `videos_stable`） | `POST /v1/video/generations` | 公网图/视频/音频 URL |
| `sd2-fast-431` | th12345ai Fast（→ `videos_stable_fast`） | 同上 | 同上 |

> 本地文件可先上传到图床拿到公网 URL，再填入请求。默认图床：`POST https://imageproxy.zhongzhuan.chat/api/upload`（`Authorization: Bearer <图床token>`，表单字段 `file`）。成功返回 `{ "url": "https://...", "created": ... }`。

> `sd2-431` / `sd2-fast-431` 为对外模型名；渠道侧建议配置模型重定向：`sd2-431`→`videos_stable`，`sd2-fast-431`→`videos_stable_fast`。

---

## 2. 通用流程

```text
创建任务 → 得到 task_id
    ↓
轮询查询（建议 10～15 秒）
    ↓
成功 → 用返回的视频 URL 下载 / 预览
```

创建阶段超时建议 **≥ 120 秒**。生成通常 **1～5 分钟**。

---

## 3. 图床上传（可选）

```bash
curl -X POST "https://imageproxy.zhongzhuan.chat/api/upload" \
  -H "Authorization: Bearer 你的图床Token" \
  -F "file=@./ref.png"
```

成功示例：

```json
{
  "url": "https://imageproxy.zhongzhuan.chat/api/proxy/image/xxxx.png",
  "created": 1783694131471
}
```

将返回的 `url` 用于下方各模型的参考图字段。

---

## 4. `37:seedance-2.0` / `37:seedance-2.0-fast`

### 创建

`POST /v1/video/generations`

```bash
curl -s -X POST "$BASE/v1/video/generations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "37:seedance-2.0",
    "prompt": "海边日落，镜头缓慢向前推进",
    "duration": 4,
    "width": 1280,
    "height": 720,
    "n": 1
  }'
```

快速版仅改 `model` 为 `37:seedance-2.0-fast`。

| 参数 | 必填 | 说明 |
|------|------|------|
| `model` | 是 | `37:seedance-2.0` 或 `37:seedance-2.0-fast` |
| `prompt` | 是 | 画面提示词 |
| `duration` | 否 | 时长（秒），常用 4 |
| `width` / `height` | 否 | 分辨率；720p 横屏常用 `1280×720` |
| `n` | 否 | 生成数量，固定 `1` |
| `images` | 否 | 参考图公网 URL 数组（图生时） |

画幅对照：

| 比例 | width × height |
|------|----------------|
| 16:9 | 1280 × 720 |
| 9:16 | 720 × 1280 |
| 1:1 | 720 × 720 |

### 查询

`GET /v1/video/generations/{task_id}`

```bash
curl -s "$BASE/v1/video/generations/$TASK_ID" \
  -H "Authorization: Bearer $TOKEN"
```

常见状态：`pending` / `processing` / `queued` / `in_progress` / `completed` / `failed`（以及部分上游的 `SUCCESS` / `FAILURE`）。

---

## 5. `doubao-seedance-2.0`

### 文生视频

`POST /v1/video/generations`

```bash
curl -s -X POST "$BASE/v1/video/generations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-seedance-2.0",
    "prompt": "一只橘猫在窗边打哈欠",
    "metadata": {
      "ratio": "16:9",
      "resolution": "720p",
      "duration": 5,
      "watermark": false
    }
  }'
```

也可把 `ratio` / `resolution` / `duration` / `watermark` / `generate_audio` 写在顶层。

### 多模态参考（`content`）

```bash
curl -s -X POST "$BASE/v1/video/generations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-seedance-2.0",
    "content": [
      {
        "type": "text",
        "text": "根据参考图生成清新果茶广告，首帧贴近图片。"
      },
      {
        "type": "image_url",
        "image_url": { "url": "https://example.com/ref.jpg" },
        "role": "reference_image"
      }
    ],
    "generate_audio": true,
    "ratio": "16:9",
    "resolution": "720p",
    "duration": 8,
    "watermark": false
  }'
```

| `content[].type` | 子字段 | `role` |
|------------------|--------|--------|
| `text` | `text` | — |
| `image_url` | `image_url.url` | `reference_image` |
| `video_url` | `video_url.url` | `reference_video` |
| `audio_url` | `audio_url.url` | `reference_audio` |

| 参数 | 说明 |
|------|------|
| `ratio` | `16:9` / `9:16` / `1:1` |
| `resolution` | `480p` / `720p` / `1080p`（推荐 `720p`） |
| `duration` | 常见 5～15 秒 |
| `generate_audio` | 是否配音 |
| `watermark` | 是否水印 |

### 查询

`GET /v1/video/generations/{task_id}`

成功时常见字段：`data.status`（`QUEUED` / `IN_PROGRESS` / `SUCCESS` / `FAILURE`）、`data.result_url`、`data.fail_reason`。

可选代下：`GET /v1/videos/{task_id}/content`。

---

## 6. `mingiz-sd2`（星河 2.0）

### 创建（JSON + 公网图）

`POST /v1/videos`

```bash
curl -X POST "$BASE/v1/videos" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "model": "mingiz-sd2",
    "prompt": "一只橘猫在窗台上晒太阳，镜头缓慢推进",
    "duration": 10,
    "aspect_ratio": "16:9",
    "resolution": "720p",
    "images": ["https://example.com/cat.jpg"]
  }'
```

### 创建（multipart 直传文件）

```bash
curl -X POST "$BASE/v1/videos" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json" \
  -F "model=mingiz-sd2" \
  -F "prompt=一只橘猫在窗台上晒太阳，镜头缓慢推进" \
  -F "duration=10" \
  -F "aspect_ratio=16:9" \
  -F "resolution=720p" \
  -F "reference_images=@./cat.jpg"
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `model` | 是 | `mingiz-sd2` |
| `prompt` | 是 | 提示词 |
| `duration` | 否 | 时长（秒） |
| `aspect_ratio` / `ratio` | 否 | 如 `16:9` / `9:16` |
| `resolution` | 否 | 如 `720p` |
| `reference_images` | 否 | multipart 参考图文件 |
| `images` | 否 | 公网 URL 数组（JSON） |

### 查询

`GET /v1/videos/{task_id}`

| status | 含义 |
|--------|------|
| `queued` | 排队中 |
| `in_progress` | 生成中 |
| `completed` | 已完成 |
| `failed` | 失败 |

完成后视频地址通常在 **`metadata.url`**。

---

## 7. `sd2-431` / `sd2-fast-431`（th12345ai）

渠道类型：`th12345ai`（64）。对外模型名见下表，渠道内建议配置模型重定向。

| 对外模型 | 上游模型 | 计费 | 时长 |
|----------|----------|------|------|
| `sd2-431` | `videos_stable` | 按次 | 4～15 秒 |
| `sd2-fast-431` | `videos_stable_fast` | 按次 | 10 / 15 秒 |

### 创建

`POST /v1/video/generations`

```bash
curl -s -X POST "$BASE/v1/video/generations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sd2-431",
    "prompt": "A cinematic 9:16 short video, soft natural light, slow camera push in",
    "ratio": "9:16",
    "resolution": "720p",
    "duration": 5,
    "images": ["https://example.com/image1.png"],
    "videos": ["https://example.com/reference.mp4"],
    "audios": ["https://example.com/reference.mp3"]
  }'
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `model` | 是 | `sd2-431` 或 `sd2-fast-431` |
| `prompt` | 是 | 提示词 |
| `duration` | 否 | 时长（秒）；fast 仅 10/15 |
| `ratio` / `aspect_ratio` | 否 | `9:16` / `16:9` / `1:1` |
| `resolution` | 否 | 如 `720p` |
| `images` | 否 | 参考图公网 URL 数组（→ 上游 `referenceImages`） |
| `videos` | 否 | 参考视频公网 URL 数组（→ 上游 `referenceVideos`） |
| `audios` | 否 | 参考音频公网 URL 数组（→ 上游 `referenceAudios`） |

### 查询

`GET /v1/video/generations/{task_id}`

完成后视频地址通常在 **`metadata.url`**。

---

## 8. 场景推荐

| 场景 | 推荐模型 |
|------|----------|
| 快速出片、文生为主 | `37:seedance-2.0-fast` |
| 标准质量文生 | `37:seedance-2.0` |
| 多模态参考（图/视频/音频） | `doubao-seedance-2.0` 或 `sd2-431` |
| 本地文件直传 / 星河画质 | `mingiz-sd2` |
| th12345ai 满血 / Fast | `sd2-431` / `sd2-fast-431` |

---

## 9. 常见问题

**401**：检查 `Authorization: Bearer sk-...` 是否正确。

**余额不足**：联系服务方充值。

**参考图怎么传**：优先公网 `https://`；可用本文图床接口；`mingiz-sd2` 也支持 multipart 直传。

**任务失败**：查看响应中的 `fail_reason` / `error` / `message`。

---

## 10. 调试页

浏览器打开：`{Base URL}/seedance-debug.html`

- 选择模型后自动切换接口路径与参数表单  
- 本地图片可上传到可配置图床，再 `@` 引用进提示词  
- `mingiz-sd2` 可选「multipart 直传」或「经图床 URL」  
- `sd2-431` / `sd2-fast-431` 走 `/v1/video/generations`，支持图/视频/音频公网 URL  
- API Key / 图床配置保存在本机浏览器  

---

*文档版本：2026-07-20 · 含 th12345ai（sd2-431 / sd2-fast-431）*
