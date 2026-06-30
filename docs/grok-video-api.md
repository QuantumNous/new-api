# Grok Video Generation API

This document describes how to call the Grok video generation models through the NewAPI-compatible video endpoint.

> Note: The expected production base URL is usually `https://token.mewinyou.shop`.
> If using `https://tokne.mewinyou.shop`, confirm that this domain is intentionally configured. The spelling differs.

## Base URL

```text
https://token.mewinyou.shop
```

## Create Video

```http
POST /v1/video/generations
```

### Headers

```http
Authorization: Bearer <YOUR_API_KEY>
Content-Type: application/json
```

### Request Body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `model` | string | Yes | Model ID. Use `grok-image-video` or `grok-video-1.5`. |
| `prompt` | string | Yes | Video generation prompt. |
| `seconds` | integer or string | No | Video duration in seconds. Default is `4`. |
| `aspect_ratio` | string | No | Output video aspect ratio. |
| `resolution` | string | No | Output video resolution. |
| `image_urls` | string[] | No | Reference images. Supports HTTPS image URLs and Base64 Data URLs. |

## Supported Models

### `grok-image-video`

Supports:

- Text to video
- Single image to video
- Multi-image to video

Supported `aspect_ratio` values:

```text
1:1
16:9
9:16
4:3
3:4
3:2
2:3
```

Reference image behavior:

| `image_urls` count | Mode |
| ---: | --- |
| 0 | Text to video |
| 1 | Image to video |
| 2 or more | Multi-image video |

### `grok-video-1.5`

Supports:

- Image to video only

Restrictions:

- Exactly one reference image is required.
- Multiple reference images are not supported.

Supported `aspect_ratio` values:

```text
16:9
9:16
```

## Resolution

Supported `resolution` values:

```text
720p
480p
```

## Examples

### Text to Video

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

### Single Image to Video

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

### Multi-image to Video

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

`grok-video-1.5` requires exactly one reference image.

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

## Success Response

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

`id` and `task_id` are identical. Either value can be used to query task status.

## Query Task

```http
GET /v1/video/generations/{task_id}
```

Example:

```bash
curl --location --request GET 'https://token.mewinyou.shop/v1/video/generations/task_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' \
  --header 'Authorization: Bearer <YOUR_API_KEY>'
```

Poll every 3 to 5 seconds until the task reaches a final state.

## Task Status

| Status | Description |
| --- | --- |
| `queued` | Waiting in queue. |
| `processing` | Video is being generated. |
| `succeeded` | Generation completed successfully. |
| `failed` | Generation failed. |

## Completed Response

When the task succeeds, the response should include the generated video URL in the task result payload. The exact field may depend on upstream response normalization, but the final NewAPI response should expose a successful task status and a result URL.

Example shape:

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

## Notes

- Use `grok-image-video` for text-to-video, image-to-video, and multi-image video.
- Use `grok-video-1.5` only when exactly one reference image is provided.
- `image_urls` accepts HTTPS URLs and Base64 Data URLs.
- `resolution` supports `720p` and `480p`.
- `aspect_ratio` support depends on the selected model.
- Authentication is always required:

```http
Authorization: Bearer <YOUR_API_KEY>
```

