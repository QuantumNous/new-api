# Seedance 视频生成 API — 多模型统一说明

面向持有本站 API Key（`sk-` 令牌）的调用方。本文档覆盖现网对外提供的 Seedance / 视频相关模型。

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
| `videos-standard` | MegaByAI 标准（按次） | `POST /v1/videos` | 文生；可选公网图/视频/音频 URL |
| `videos-fast` | MegaByAI 快速（按次） | 同上 | 同上 |
| `doubao-seedance-2.0` | 豆包 Seedance 2.0（多模态） | `POST /v1/video/generations` | `content` 图/视频/音频 URL |
| `mingiz-sd2` | 星河 2.0 | `POST /v1/videos` | multipart 上传文件，或 JSON 公网 URL |
| `sd2-431` | th12345ai 满血（→ `videos_stable`） | `POST /v1/video/generations` | 公网图/视频/音频 URL |
| `sd2-fast-431` | th12345ai Fast（→ `videos_stable_fast`） | 同上 | 同上 |

> 本地文件可先上传到图床拿到公网 URL，再填入请求。默认图床：`POST https://imageproxy.zhongzhuan.chat/api/upload`（`Authorization: Bearer <图床token>`，表单字段 `file`）。成功返回 `{ "url": "https://...", "created": ... }`。

> `sd2-431` / `sd2-fast-431` 为对外模型名；渠道侧建议配置模型重定向：`sd2-431`→`videos_stable`，`sd2-fast-431`→`videos_stable_fast`。

> `videos-standard` / `videos-fast` 走 **megabyai** 渠道（类型 65）。含真人脸的参考图可能被上游拦截；渠道可开启「过人脸」：参考图先压缩再经 face.83zi.com 处理后提交。

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

## 4. `videos-standard` / `videos-fast`（MegaByAI）

渠道类型：`megabyai`（65）。OpenAI Videos 风格异步接口，按次计费。

| 对外模型 | 说明 | 时长 |
|----------|------|------|
| `videos-standard` | 标准画质 | 4～15 秒（默认 5） |
| `videos-fast` | 快速出片 | 同上 |

### 创建

`POST /v1/videos`

文生示例：

```bash
curl -s -X POST "$BASE/v1/videos" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "videos-fast",
    "prompt": "海边日落，镜头缓慢向前推进",
    "duration": 5,
    "ratio": "16:9",
    "resolution": "720p"
  }'
```

带参考图（推荐用公网 URL；也可用 OpenAI 风格 `seconds` + `size`，网关会映射）：

```bash
curl -s -X POST "$BASE/v1/videos" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "videos-standard",
    "prompt": "按照参考图让两人牵手走过街道",
    "duration": 8,
    "ratio": "16:9",
    "resolution": "720p",
    "images": [
      "https://imageproxy.zhongzhuan.chat/api/proxy/image/xxxx.png"
    ]
  }'
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `model` | 是 | `videos-standard` 或 `videos-fast` |
| `prompt` | 是 | 画面提示词 |
| `duration` | 否 | 时长（秒），4～15，默认 5；也可用 `seconds`（字符串或数字），网关映射为 `duration` |
| `ratio` / `aspect_ratio` | 否 | `16:9` / `9:16` / `1:1`，默认 `16:9` |
| `resolution` | 否 | `720p` / `480p`，默认 `720p` |
| `size` | 否 | 如 `1280x720`；未显式写 `ratio`/`resolution` 时自动解析 |
| `images` / `image` / `input_reference` | 否 | 参考图公网 URL（→ 上游 `referenceImages`，最多约 9 张） |
| `videos` | 否 | 参考视频公网 URL（→ `referenceVideos`） |
| `audios` | 否 | 参考音频公网 URL（→ `referenceAudios`） |
| `referenceImages` / `referenceVideos` / `referenceAudios` | 否 | 上游字段名，可直接传 |

**不支持** `first_image` / `last_image`（含 metadata），传入会直接报错。

画幅对照（也可用 `size`）：

| 比例 | 示例 size | ratio |
|------|-----------|-------|
| 16:9 | `1280x720` | `16:9` |
| 9:16 | `720x1280` | `9:16` |
| 1:1 | `720x720` | `1:1` |

创建成功示例字段：`id` / `task_id`、`status`（多为 `queued`）、`progress`、`model`。

### 查询

`GET /v1/videos/{task_id}`

```bash
curl -s "$BASE/v1/videos/$TASK_ID" \
  -H "Authorization: Bearer $TOKEN"
```

| status | 含义 |
|--------|------|
| `queued` | 排队中 |
| `in_progress` | 生成中 |
| `completed` | 已完成 |
| `failed` | 失败（见 `error.message`） |

### 下载成片

`GET /v1/videos/{task_id}/content`（需带同一 Bearer；也可使用查询响应里改写后的代理 URL）

```bash
curl -L -o out.mp4 "$BASE/v1/videos/$TASK_ID/content" \
  -H "Authorization: Bearer $TOKEN"
```

### 使用帮助

- **选哪个**：要速度优先用 `videos-fast`；要更稳画质用 `videos-standard`。
- **参考图**：必须公网可访问的 `http(s)`；真人照片易被上游拒（报错类似 *real person's face*）。可在渠道开启「过人脸」，并按需关闭「单眼遮挡」、增大「遮挡尺寸」（如 10）。
- **字段别名**：客户端可继续发 `seconds`、`aspect_ratio`、`images`；发往上游前会规范为 `duration` / `ratio` / `referenceImages`，多余 OpenAI 别名会被去掉。
- **计费**：按次；创建成功即按模型单价扣费（与任务最终成败无关的预扣/结算以控制台日志为准）。

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
| 快速出片（MegaByAI） | `videos-fast` |
| 标准画质（MegaByAI） | `videos-standard` |
| 多模态参考（图/视频/音频） | `doubao-seedance-2.0` 或 `sd2-431` |
| 本地文件直传 / 星河画质 | `mingiz-sd2` |
| th12345ai 满血 / Fast | `sd2-431` / `sd2-fast-431` |

---

## 9. 常见问题

**401**：检查 `Authorization: Bearer sk-...` 是否正确。

**余额不足**：联系服务方充值。

**参考图怎么传**：优先公网 `https://`；可用本文图床接口；`mingiz-sd2` 也支持 multipart 直传。

**MegaByAI 报真人脸**：换非真人参考图，或让管理员在 megabyai 渠道开启「过人脸」并加大遮挡（关单眼 + size=10）。

**任务失败**：查看响应中的 `fail_reason` / `error` / `message`。

---

## 10. 调试页

浏览器打开：`{Base URL}/seedance-debug.html`

- 选择模型后自动切换接口路径与参数表单  
- 本地图片可上传到可配置图床，再 `@` 引用进提示词  
- `mingiz-sd2` 可选「multipart 直传」或「经图床 URL」  
- `videos-standard` / `videos-fast` 走 `/v1/videos`，支持 `images` 公网 URL  
- `sd2-431` / `sd2-fast-431` 走 `/v1/video/generations`，支持图/视频/音频公网 URL  
- API Key / 图床配置保存在本机浏览器  

---

*文档版本：2026-07-21 · 含 MegaByAI（videos-standard / videos-fast）与 th12345ai（sd2-431 / sd2-fast-431）*
