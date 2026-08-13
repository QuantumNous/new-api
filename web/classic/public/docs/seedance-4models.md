# Seedance 视频生成 API — 多模型统一说明

面向持有本站 API Key（`sk-` 令牌）的调用方。本文档覆盖模型大厅当前对外提供的视频相关模型。

| 项目 | 说明 |
|------|------|
| Base URL | `https://你的域名`（示例：`https://996k.cn`） |
| 认证 | `Authorization: Bearer sk-xxxxxxxx` |
| 调试页 | `/seedance-debug.html` |
| 模型与价格 | 以站点「模型大厅」为准，可能随时调整 |

```bash
export BASE="https://996k.cn"
export TOKEN="sk-你的令牌"
```

---

## 1. 模型一览

| 模型 ID | 说明 | 创建路径 | 计费 | 素材方式 |
|---------|------|----------|------|----------|
| `guanzhuan-seedance2.0` | Seedance 2.0 满血 | `POST /v1/video/generations` | 按秒 + 分辨率 | 公网 URL；支持 `content[]` 多模态 |
| `guanzhuan-seedance2.0-mini` | Seedance 2.0 Mini（适合试跑） | 同上 | 按秒 + 分辨率 | 同上 |
| `guanzhuan-seedance2.5` | Seedance 2.5 满血 | 同上 | 按秒 + 分辨率 | 同上 |
| `seedance2.0` | 漫剧专线 · 720P Pro | `POST /v1/videos` | 按次 | 公网图 URL（约最多 9 张；**不支持人脸**） |
| `seedance-2-mini-720p` | Mini 720p · 低价测试 | 同上 | 按秒 | 公网 URL |
| `mingiz-sd2` | 星河满血 720P | `POST /v1/videos` | 按次 | multipart 或公网 URL |
| `mingiz-sd2-fast` | 星河 Fast 720P | 同上 | 按次 | 同上 |
| `seedance2.0-yk-special` | Special · 多分辨率 | `POST /v1/video/generations` | 按秒 + 分辨率 | 公网 URL |
| `h3-zz` | H3 · 按秒计费 | `POST /v1/videos` | 按秒 + 分辨率 | 公网 URL |

> 本地文件可先上传到图床拿到公网 URL。默认图床：`POST https://imageproxy.zhongzhuan.chat/api/upload`（`Authorization: Bearer <图床token>`，表单字段 `file`）。成功返回 `{ "url": "https://...", "created": ... }`。

---

## 2. 通用流程

```text
创建任务 → 得到 task_id / id
    ↓
轮询查询（建议 10～15 秒）
    ↓
成功 → 用返回的视频 URL，或本站 /content 接口下载
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

将返回的 `url` 用于下方各模型的参考图 / 参考视频 / 参考音频字段。

---

## 4. `guanzhuan-seedance2.0` / `-mini` / `2.5`

创建：`POST /v1/video/generations`  
查询：`GET /v1/video/generations/{task_id}`

请按下方白名单填写 `resolution`（默认 `720p`）；不支持的档位会返回错误。

| 模型 | 支持分辨率 | 时长 | 备注 |
|------|------------|------|------|
| `guanzhuan-seedance2.0` | 480p / 720p / 1080p / 4k | 常见 4～15s | 支持 `camera_fixed` |
| `guanzhuan-seedance2.0-mini` | 480p / 720p | **4～15s** | 不支持 `camera_fixed` |
| `guanzhuan-seedance2.5` | 480p / 720p | **最长 30s** | 支持 `camera_fixed` |

### 文生示例

```bash
curl -s -X POST "$BASE/v1/video/generations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "guanzhuan-seedance2.0",
    "prompt": "一只橘猫在窗边打哈欠，镜头缓慢推进",
    "ratio": "16:9",
    "resolution": "720p",
    "duration": 5,
    "generate_audio": true,
    "watermark": false
  }'
```

### 多模态参考（`content`）

```bash
curl -s -X POST "$BASE/v1/video/generations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "guanzhuan-seedance2.0",
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

| 参数 | 说明 |
|------|------|
| `prompt` | 提示词（未使用 `content` 文本时必填） |
| `duration` / `seconds` | 时长（秒） |
| `ratio` / `aspect_ratio` | 如 `16:9` / `9:16` / `1:1` |
| `resolution` / `size` | 清晰度档位；也可用 `1280x720` |
| `image` / `first_image` / `first_frame` | 首帧公网 URL |
| `last_image` / `last_frame` | 尾帧公网 URL |
| `images` / `reference_images` / `input_reference` | 参考图 |
| `videos` / `audios` | 参考视频 / 音频公网 URL |
| `generate_audio` / `watermark` / `camera_fixed` | 配音 / 水印 / 固定镜头（mini 忽略 `camera_fixed`） |

### 查询

```bash
curl -s "$BASE/v1/video/generations/$TASK_ID" \
  -H "Authorization: Bearer $TOKEN"
```

成功后视频地址通常在 `metadata.url` 或 `result_url`；也可使用 `GET /v1/videos/{task_id}/content` 下载。

计费方式：按秒 + 分辨率（具体单价见模型大厅）。

---

## 5. `seedance2.0` / `seedance-2-mini-720p`

创建：`POST /v1/videos`  
查询：`GET /v1/videos/{task_id}`  
下载：`GET /v1/videos/{task_id}/content`（需同一 Bearer）

| 模型 | 说明 | 计费 |
|------|------|------|
| `seedance2.0` | 漫剧专线 · 720P Pro；约最多 9 张参考图，**不支持人脸** | 按次 |
| `seedance-2-mini-720p` | Mini 720p，适合快速验证 | 按秒 |

### 文生示例

```bash
curl -s -X POST "$BASE/v1/videos" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "seedance2.0",
    "prompt": "海边日落，镜头缓慢向前推进",
    "seconds": 8,
    "size": "1280x720"
  }'
```

### 带参考图

```bash
curl -s -X POST "$BASE/v1/videos" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "seedance-2-mini-720p",
    "prompt": "按照参考图让角色走过街道",
    "duration": 5,
    "aspect_ratio": "16:9",
    "resolution": "720p",
    "images": [
      "https://imageproxy.zhongzhuan.chat/api/proxy/image/xxxx.png"
    ]
  }'
```

| 参数 | 说明 |
|------|------|
| `model` | `seedance2.0` 或 `seedance-2-mini-720p` |
| `prompt` | 画面提示词 |
| `seconds` / `duration` | 时长（秒）；常见 5 / 8 / 10 / 12 / 15 |
| `size` / `aspect_ratio` / `ratio` / `resolution` | 画幅与清晰度；可用 `1280x720` |
| `images` / `input_reference` | 参考图公网 URL |
| `content` | 可选多模态数组（图 / 视频 / 音频） |

### 查询与下载

```bash
curl -s "$BASE/v1/videos/$TASK_ID" \
  -H "Authorization: Bearer $TOKEN"

curl -L -o out.mp4 "$BASE/v1/videos/$TASK_ID/content" \
  -H "Authorization: Bearer $TOKEN"
```

| status | 含义 |
|--------|------|
| `queued` | 排队中 |
| `in_progress` | 生成中 |
| `completed` | 已完成 |
| `failed` | 失败（见 `error.message`） |

---

## 6. `mingiz-sd2` / `mingiz-sd2-fast`

创建：`POST /v1/videos`  
查询：`GET /v1/videos/{task_id}`

| 模型 | 说明 | 计费 |
|------|------|------|
| `mingiz-sd2` | 满血 720P；文生 / 全能参考 / 首尾帧 | 按次 |
| `mingiz-sd2-fast` | Fast 720P；文生 / 全能参考 | 按次 |

能力摘要：画幅 `16:9` / `9:16` / `4:3` / `3:4` / `1:1` / `21:9`；时长约 **4～15 秒**；最多约 **9 图 / 3 视频 / 3 音频**；支持真人脸。

### 创建（JSON + 公网图）

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
  -F "model=mingiz-sd2-fast" \
  -F "prompt=一只橘猫在窗台上晒太阳，镜头缓慢推进" \
  -F "duration=10" \
  -F "aspect_ratio=16:9" \
  -F "resolution=720p" \
  -F "reference_images=@./cat.jpg"
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `model` | 是 | `mingiz-sd2` 或 `mingiz-sd2-fast` |
| `prompt` | 是 | 提示词 |
| `duration` | 否 | 时长（秒） |
| `aspect_ratio` / `ratio` | 否 | 画幅 |
| `resolution` | 否 | 如 `720p` |
| `reference_images` / `files` | 否 | multipart 参考图文件 |
| `images` | 否 | 公网 URL 数组（JSON） |
| `videos` / `audios` | 否 | 参考视频 / 音频公网 URL |
| `generate_audio` | 否 | 是否配音（默认多为开启） |
| `watermark` | 否 | 是否水印（默认多为关闭） |

完成后视频地址通常在 **`metadata.url`**。

---

## 7. `seedance2.0-yk-special`

创建：`POST /v1/video/generations`  
查询：`GET /v1/video/generations/{task_id}`

| 项 | 说明 |
|----|------|
| 分辨率 | **720p / 1080p / 2k / 4k**（不支持 480p） |
| 时长 | 4～15 秒（默认 5） |
| 计费 | 按秒 + 分辨率（单价见模型大厅） |
| 素材 | 使用公网 `http(s)` URL 即可 |

### 创建示例

```bash
curl -s -X POST "$BASE/v1/video/generations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "seedance2.0-yk-special",
    "prompt": "A cinematic short video, soft natural light, slow camera push in",
    "ratio": "9:16",
    "resolution": "720p",
    "duration": 5,
    "generate_audio": true,
    "images": ["https://example.com/image1.png"]
  }'
```

| 参数 | 说明 |
|------|------|
| `prompt` | 必填 |
| `duration` / `seconds` | 4～15，默认 5 |
| `aspect_ratio` / `ratio` | 画幅 |
| `resolution` | `720p` / `1080p` / `2k` / `4k` |
| `images` / `reference_images` | 参考图（0～9） |
| `videos` / `reference_videos` | 参考视频（0～3） |
| `audios` / `reference_audios` | 参考音频（0～3） |
| `first_image` / `last_image` | 首 / 尾帧 |
| `generate_audio` / `watermark` / `seed` | 可选 |
| `content` | 可选多模态数组 |

**约束：** 首帧 / 首尾帧 / 多模态参考请勿混用；音频不可单独输入。

完成后视频地址通常在 `video_url` / `result_url` / `metadata.url`。

---

## 8. `h3-zz`

创建：`POST /v1/videos`  
查询：`GET /v1/videos/{task_id}`  
下载：请使用 `GET /v1/videos/{task_id}/content`（查询结果里可能没有可直接访问的视频链接）

| 项 | 说明 |
|----|------|
| 时长 | **5～15 秒**（默认 5） |
| 分辨率 | 480p / 720p / 1080p / 2k（默认 720p） |
| 画幅 | `21:9` / `16:9` / `4:3` / `1:1` / `3:4` / `9:16` |
| 计费 | 按秒 + 分辨率（单价见模型大厅） |
| 素材 | 公网 URL；支持首帧 / 尾帧 / 参考图 |

### 创建示例

```bash
curl -s -X POST "$BASE/v1/videos" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "h3-zz",
    "prompt": "城市夜景延时，霓虹灯闪烁，镜头平稳横移",
    "duration": 5,
    "aspect_ratio": "16:9",
    "resolution": "720p",
    "images": ["https://example.com/ref.png"]
  }'
```

| 参数 | 说明 |
|------|------|
| `prompt` | 必填 |
| `duration` / `seconds` | 5～15 |
| `aspect_ratio` / `ratio` | 画幅 |
| `resolution` / `size` / `quality` | 清晰度档位 |
| `images` / `image_urls` / `input_reference` | 参考图 |
| `first_image` / `first_frame` | 首帧 |
| `last_image` / `last_frame` | 尾帧 |

### 下载成片

```bash
curl -L -o out.mp4 "$BASE/v1/videos/$TASK_ID/content" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 9. 场景推荐

| 场景 | 推荐模型 |
|------|----------|
| 多分辨率（含 1080p、4k） | `guanzhuan-seedance2.0` |
| 快速试跑 / 省钱测试 | `guanzhuan-seedance2.0-mini` 或 `seedance-2-mini-720p` |
| 更长时长（≤30s） | `guanzhuan-seedance2.5` |
| 漫剧专线满血（按次） | `seedance2.0` |
| 本地文件直传 / 星河画质 | `mingiz-sd2`；要速度用 `mingiz-sd2-fast` |
| 高分辨率 special | `seedance2.0-yk-special` |
| 按秒低价 | `h3-zz` |

---

## 10. 常见问题

**401**：检查 `Authorization: Bearer sk-...` 是否正确。

**余额不足**：请充值，或在控制台查看余额与分组。

**参考图怎么传**：优先公网 `https://`；可用本文图床；`mingiz-sd2` / `mingiz-sd2-fast` 也支持 multipart 直传本地文件。

**分辨率报错**：请改用该模型支持的 `resolution`（见各章节白名单）。

**`seedance2.0` 人脸失败**：该模型不支持人脸参考图；请换非真人图片，或改用星河等支持人脸的模型。

**任务失败**：查看响应中的 `fail_reason` / `error` / `message`。

**价格**：以模型大厅与你的令牌分组为准。

---

## 11. 调试页

浏览器打开：`{Base URL}/seedance-debug.html`

- 可选择模型并自动切换接口路径与参数  
- 本地图片可先上传到图床再引用  
- `mingiz-sd2` / `mingiz-sd2-fast` 支持 multipart 直传  
- API Key / 图床配置保存在本机浏览器  

---

*文档版本：2026-08-13*
