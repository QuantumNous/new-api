# Grok 视频生成接口文档

本文档说明如何通过 NewAPI 兼容的视频接口调用 Grok 视频生成模型。

> 注意：当前生产地址通常是 `https://token.mewinyou.shop`。
> 如果看到 `https://tokne.mewinyou.shop`，请先确认是否为有意配置；这两个域名拼写不同。

## Base URL

```text
https://token.mewinyou.shop
```

## 创建视频任务

```http
POST /v1/video/generations
```

### 请求头

```http
Authorization: Bearer <YOUR_API_KEY>
Content-Type: application/json
```

### 请求参数

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `model` | string | 是 | 模型 ID，支持 `grok-image-video` 或 `grok-video-1.5`。 |
| `prompt` | string | 是 | 视频生成提示词。 |
| `seconds` | integer 或 string | 否 | 视频时长，单位秒，默认 `4`。 |
| `aspect_ratio` | string | 否 | 视频宽高比。 |
| `resolution` | string | 否 | 视频分辨率。 |
| `image_urls` | string[] | 否 | 参考图片，支持 HTTPS 图片地址或 Base64 Data URL。 |

## 支持模型

### `grok-image-video`

支持能力：

- 文生视频
- 单图生视频
- 多图生视频

支持的 `aspect_ratio`：

```text
1:1
16:9
9:16
4:3
3:4
3:2
2:3
```

参考图数量与模式：

| `image_urls` 数量 | 生成模式 |
| ---: | --- |
| 0 | 文生视频 |
| 1 | 单图生视频 |
| 2 张或更多 | 多图生视频 |

### `grok-video-1.5`

支持能力：

- 仅支持图生视频

限制：

- 必须传且只能传 1 张参考图。
- 不支持多图。

支持的 `aspect_ratio`：

```text
16:9
9:16
```

## 分辨率

支持的 `resolution`：

```text
720p
480p
```

## 请求示例

### 文生视频

```bash
curl --location --request POST 'https://token.mewinyou.shop/v1/video/generations' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "model": "grok-image-video",
    "prompt": "A futuristic city at sunset, cinematic camera movement, neon reflections",
    "seconds": 4,
    "aspect_ratio": "16:9",
    "resolution": "720p"
  }'
```

### 单图生视频

```bash
curl --location --request POST 'https://token.mewinyou.shop/v1/video/generations' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "model": "grok-image-video",
    "prompt": "Animate this image with subtle camera movement and natural lighting",
    "seconds": 4,
    "aspect_ratio": "16:9",
    "resolution": "720p",
    "image_urls": [
      "https://example.com/image.png"
    ]
  }'
```

### 多图生视频

```bash
curl --location --request POST 'https://token.mewinyou.shop/v1/video/generations' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "model": "grok-image-video",
    "prompt": "Merge these references into a cinematic video with smooth transitions",
    "seconds": 4,
    "aspect_ratio": "16:9",
    "resolution": "720p",
    "image_urls": [
      "https://example.com/ref1.png",
      "https://example.com/ref2.png"
    ]
  }'
```

### `grok-video-1.5`

`grok-video-1.5` 必须传 exactly one reference image，也就是只能传 1 张参考图。

```bash
curl --location --request POST 'https://token.mewinyou.shop/v1/video/generations' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "model": "grok-video-1.5",
    "prompt": "Make the character smile and slightly turn toward the camera",
    "seconds": 4,
    "aspect_ratio": "16:9",
    "resolution": "720p",
    "image_urls": [
      "https://example.com/image.png"
    ]
  }'
```

## 创建成功响应

```json
{
  "id": "task_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "task_id": "task_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "object": "video",
  "model": "grok-image-video",
  "status": "queued",
  "progress": 0,
  "created_at": 1780000000
}
```

`id` 和 `task_id` 相同，查询任务状态时使用任意一个即可。

## 查询任务状态

```http
GET /v1/video/generations/{task_id}
```

示例：

```bash
curl --location --request GET 'https://token.mewinyou.shop/v1/video/generations/task_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' \
  --header 'Authorization: Bearer <YOUR_API_KEY>'
```

建议每 3 到 5 秒轮询一次，直到任务进入最终状态。

## 任务状态

| 状态 | 说明 |
| --- | --- |
| `queued` | 排队中。 |
| `processing` | 生成中。 |
| `succeeded` | 生成成功。 |
| `failed` | 生成失败。 |

## 成功完成响应

任务成功后，响应中应包含生成视频地址。具体字段可能取决于上游响应结构和 NewAPI 的归一化逻辑，但最终应能看到成功状态和视频结果地址。

示例结构：

```json
{
  "id": "task_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "task_id": "task_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "object": "video",
  "model": "grok-image-video",
  "status": "succeeded",
  "progress": 100,
  "result_url": "https://example.com/generated-video.mp4"
}
```

## 注意事项

- `grok-image-video` 可用于文生视频、单图生视频、多图生视频。
- `grok-video-1.5` 仅用于单图生视频，必须传且只能传 1 张图。
- `image_urls` 支持 HTTPS URL 和 Base64 Data URL。
- `resolution` 支持 `720p` 和 `480p`。
- `aspect_ratio` 支持范围取决于具体模型。
- 所有请求都需要鉴权：

```http
Authorization: Bearer <YOUR_API_KEY>
```

