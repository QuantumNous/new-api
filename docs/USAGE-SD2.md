# SD2 系列视频生成 API

本文档说明通过统一网关调用以下三个模型的用法：

| 对外模型名 | 说明 | 计费 |
|-----------|------|------|
| `mingiz-sd2` | 星河 2.0（Xinghe 2.0） | 按次 |
| `sd2-福利` | SD2 标准版（福利通道） | 按次 |
| `sd2-fast福利` | SD2 快速版（福利通道） | 按次 |

**服务地址（Base URL）**：`https://996k.cn`

---

## 鉴权

请求头需携带 API 密钥：

```
Authorization: Bearer 你的API密钥
Accept: application/json
```

---

## 通用接口

### 1. 生成视频（提交任务）

**POST** `https://996k.cn/v1/videos`

### 2. 查询视频（任务进度）

**GET** `https://996k.cn/v1/videos/{task_id}`

将 `{task_id}` 替换为提交任务时返回的 `id`。

### 任务状态

| status | 含义 |
|--------|------|
| `queued` | 排队中 |
| `in_progress` | 生成中 |
| `completed` | 已完成 |
| `failed` | 失败 |

- `progress`：进度 0–100
- 完成后，视频地址在 **`metadata.url`**

### 完成响应示例

```json
{
  "id": "task_xxxxxxxx",
  "status": "completed",
  "progress": 100,
  "metadata": {
    "url": "https://example.com/video.mp4"
  }
}
```

生成通常需要 **1～5 分钟**，请轮询查询接口直至 `status` 为 `completed` 或 `failed`。

---

## mingiz-sd2（星河 2.0）

对外模型名：**mingiz-sd2**

支持 **multipart/form-data**（可上传参考图文件）或 **application/json**（传图片 URL）。

### 参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `model` | 是 | 固定填 `mingiz-sd2` |
| `prompt` | 是 | 视频提示词 |
| `duration` | 否 | 时长（秒） |
| `aspect_ratio` | 否 | 画幅比例，如 `16:9` 横屏 / `9:16` 竖屏 |
| `ratio` | 否 | 同 `aspect_ratio` |
| `resolution` | 否 | 分辨率，如 `720p` |
| `reference_images` | 否 | 参考图文件（multipart），可传多张 |
| `images` | 否 | 参考图公网 URL 数组（JSON） |
| `image_urls` | 否 | 参考图对象数组（JSON），含 `url`、`file_name`、`content_type` |

### multipart 请求示例（上传参考图）

```bash
curl -X POST "https://996k.cn/v1/videos" \
  -H "Authorization: Bearer 你的API密钥" \
  -H "Accept: application/json" \
  -F "model=mingiz-sd2" \
  -F "prompt=一只橘猫在窗台上晒太阳，镜头缓慢推进" \
  -F "duration=10" \
  -F "aspect_ratio=16:9" \
  -F "resolution=720p" \
  -F "reference_images=@./cat.jpg"
```

### JSON 请求示例（参考图 URL）

```bash
curl -X POST "https://996k.cn/v1/videos" \
  -H "Authorization: Bearer 你的API密钥" \
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

### 响应示例

```json
{
  "id": "task_xxxxxxxx",
  "object": "video.generation",
  "model": "mingiz-sd2",
  "status": "queued"
}
```

### 查询示例

```bash
curl -H "Authorization: Bearer 你的API密钥" \
  -H "Accept: application/json" \
  "https://996k.cn/v1/videos/task_xxxxxxxx"
```

---

## sd2-福利

对外模型名：**sd2-福利**

SD2 标准版，按次计费。请求类型推荐 **application/json**；参考图须为**公网可访问的 http(s) URL**，放在 `images` 字段中（不支持直接上传文件）。

### 参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `model` | 是 | 固定填 `sd2-福利` |
| `prompt` | 是 | 视频提示词 |
| `duration` | 否 | 时长（秒） |
| `aspect_ratio` | 否 | 画幅比例，如 `16:9` / `9:16` |
| `ratio` | 否 | 同 `aspect_ratio` |
| `resolution` | 否 | 分辨率，如 `720P` |
| `images` | 否 | 参考图公网 URL 数组，图生视频时填写 |
| `generate_audio` | 否 | `true` 生成配音 / `false` 不生成 |

### 文生视频请求示例

```bash
curl -X POST "https://996k.cn/v1/videos" \
  -H "Authorization: Bearer 你的API密钥" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "model": "sd2-福利",
    "prompt": "夕阳下的海边，浪花轻拍沙滩，电影感镜头",
    "duration": 10,
    "aspect_ratio": "16:9",
    "resolution": "720P"
  }'
```

### 图生视频请求示例

```bash
curl -X POST "https://996k.cn/v1/videos" \
  -H "Authorization: Bearer 你的API密钥" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "model": "sd2-福利",
    "prompt": "人物缓缓转头看向镜头，微风拂动发丝",
    "duration": 10,
    "aspect_ratio": "9:16",
    "images": ["https://example.com/portrait.jpg"]
  }'
```

### 响应示例

```json
{
  "id": "task_xxxxxxxx",
  "object": "video.generation",
  "model": "sd2-福利",
  "status": "queued"
}
```

### 查询示例

```bash
curl -H "Authorization: Bearer 你的API密钥" \
  -H "Accept: application/json" \
  "https://996k.cn/v1/videos/task_xxxxxxxx"
```

---

## sd2-fast福利

对外模型名：**sd2-fast福利**

SD2 快速版，按次计费，生成速度更快。参数与 `sd2-福利` 相同，仅 `model` 不同。

### 参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `model` | 是 | 固定填 `sd2-fast福利` |
| `prompt` | 是 | 视频提示词 |
| `duration` | 否 | 时长（秒） |
| `aspect_ratio` | 否 | 画幅比例，如 `16:9` / `9:16` |
| `ratio` | 否 | 同 `aspect_ratio` |
| `resolution` | 否 | 分辨率，如 `720P` |
| `images` | 否 | 参考图公网 URL 数组，图生视频时填写 |
| `generate_audio` | 否 | `true` 生成配音 / `false` 不生成 |

### 文生视频请求示例

```bash
curl -X POST "https://996k.cn/v1/videos" \
  -H "Authorization: Bearer 你的API密钥" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "model": "sd2-fast福利",
    "prompt": "城市夜景，车流如光带穿梭，延时摄影风格",
    "duration": 8,
    "aspect_ratio": "16:9"
  }'
```

### 图生视频请求示例

```bash
curl -X POST "https://996k.cn/v1/videos" \
  -H "Authorization: Bearer 你的API密钥" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "model": "sd2-fast福利",
    "prompt": "画面中的人物微笑挥手，背景虚化",
    "duration": 8,
    "aspect_ratio": "9:16",
    "images": ["https://example.com/ref.png"]
  }'
```

### 响应示例

```json
{
  "id": "task_xxxxxxxx",
  "object": "video.generation",
  "model": "sd2-fast福利",
  "status": "queued"
}
```

### 查询示例

```bash
curl -H "Authorization: Bearer 你的API密钥" \
  -H "Accept: application/json" \
  "https://996k.cn/v1/videos/task_xxxxxxxx"
```

---

## 使用建议

| 场景 | 推荐模型 | 建议参数 |
|------|----------|----------|
| 星河 2.0 + 本地参考图上传 | `mingiz-sd2` | multipart 上传 `reference_images` |
| 星河 2.0 + 已有图片 URL | `mingiz-sd2` | JSON，`images` 或 `image_urls` |
| 竖屏短剧（标准质量） | `sd2-福利` | `aspect_ratio=9:16`，`duration=10~15` |
| 竖屏短剧（快速出片） | `sd2-fast福利` | `aspect_ratio=9:16`，`duration=8~10` |
| 横屏视频 | `sd2-福利` / `sd2-fast福利` | `aspect_ratio=16:9` |
| 图生视频（福利通道） | `sd2-福利` / `sd2-fast福利` | `images` 填公网 http(s) URL |

### 模型选择说明

- **mingiz-sd2**：支持直接上传参考图文件，适合本地图片场景。
- **sd2-福利**：标准质量，按次计费，参考图必须为公网 URL。
- **sd2-fast福利**：快速版本，按次计费，适合对速度要求更高的场景。
