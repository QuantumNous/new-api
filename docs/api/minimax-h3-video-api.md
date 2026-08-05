# MiniMax H3 international video API

This guide describes the `MiniMax-H3` generation integration exposed through
new-api. The adaptor targets the MiniMax international API at
`https://api.minimax.io`; it does not use the separate China-region API or
pricing.

## Channel configuration

Configure an asynchronous video channel with these values:

| Setting | Value |
|---|---|
| Channel type | `MiniMaxH3` (`110`) |
| Base URL | `https://api.minimax.io` |
| Model | `MiniMax-H3` |
| Key | An international MiniMax API key |

Do not configure H3 on the legacy `MiniMax` channel type `35`. Type `35` uses
the V1 Hailuo protocol; type `110` persists a distinct platform value so any
application node can reconstruct the H3 V2 adaptor while polling.

## Client authentication and endpoint

Clients authenticate with a new-api token. The upstream MiniMax key stays in
the channel configuration and is never sent to clients.

```http
POST /v1/videos
Authorization: Bearer <new-api-token>
Content-Type: application/json
```

The request must use model `MiniMax-H3`, resolution `768P` or `2K`, duration
from 4 through 15 seconds, and a `content` array containing non-empty text.
Text-only generation requires an explicit fixed ratio: `21:9`, `16:9`, `4:3`,
`1:1`, `3:4`, or `9:16`.

## Create examples

Set a local base URL and token before running the examples:

```bash
NEW_API_BASE_URL="https://your-new-api.example.com"
NEW_API_TOKEN="replace-with-your-new-api-token"
```

### Text to video

```bash
curl --fail-with-body "$NEW_API_BASE_URL/v1/videos" \
  -H "Authorization: Bearer $NEW_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "MiniMax-H3",
    "content": [
      {"type": "text", "text": "A paper boat crosses a rain puddle, cinematic macro shot"}
    ],
    "resolution": "768P",
    "duration": 6,
    "ratio": "16:9",
    "aigc_watermark": false
  }'
```

### First-frame image to video

An image with no role or with role `first_frame` is the first frame. When media
is present and `ratio` is omitted, the adaptor sends `adaptive`.

```bash
curl --fail-with-body "$NEW_API_BASE_URL/v1/videos" \
  -H "Authorization: Bearer $NEW_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "MiniMax-H3",
    "content": [
      {"type": "text", "text": "The camera slowly pulls back as morning fog moves through the valley"},
      {
        "type": "image_url",
        "image_url": {"url": "https://assets.example.com/first-frame.jpg"},
        "role": "first_frame"
      }
    ],
    "resolution": "2K",
    "duration": 8
  }'
```

Use role `last_frame` for an optional last frame. A request may contain at most
one first frame and one last frame. Frame inputs cannot be combined with
reference media.

### Reference media

Reference images, videos, and audio use explicit roles. Reference audio cannot
be the only reference input; it must accompany a reference image or video.

```bash
curl --fail-with-body "$NEW_API_BASE_URL/v1/videos" \
  -H "Authorization: Bearer $NEW_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "MiniMax-H3",
    "content": [
      {"type": "text", "text": "Preserve the character and movement style while crossing a snowy street"},
      {
        "type": "image_url",
        "image_url": {"url": "https://assets.example.com/character.jpg"},
        "role": "reference_image"
      },
      {
        "type": "video_url",
        "video_url": {"url": "https://assets.example.com/motion.mp4"},
        "role": "reference_video"
      },
      {
        "type": "audio_url",
        "audio_url": {"url": "https://assets.example.com/ambience.mp3"},
        "role": "reference_audio"
      }
    ],
    "resolution": "768P",
    "duration": 10,
    "ratio": "adaptive"
  }'
```

The limits are 9 reference images, 3 reference videos, and 3 reference audio
items.

## Create response and public task ID

Creation returns a public `task_...` identifier. The upstream MiniMax task ID
is stored privately and is not returned to the client.

```json
{
  "id": "task_examplePublicId",
  "task_id": "task_examplePublicId",
  "object": "video",
  "model": "MiniMax-H3",
  "status": "queued",
  "progress": 0,
  "created_at": 1785859200
}
```

## Query a task

Poll the public task ID returned by creation:

```bash
curl --fail-with-body \
  "$NEW_API_BASE_URL/v1/videos/task_examplePublicId" \
  -H "Authorization: Bearer $NEW_API_TOKEN"
```

Possible public statuses are `queued`, `in_progress`, `completed`, and
`failed`. On success, read the temporary video URL from `metadata.url`:

```json
{
  "id": "task_examplePublicId",
  "task_id": "task_examplePublicId",
  "object": "video",
  "model": "MiniMax-H3",
  "status": "completed",
  "progress": 100,
  "metadata": {
    "url": "https://temporary-download.example.com/video.mp4"
  }
}
```

Download the result promptly. The upstream URL is temporary, and this first
integration does not refresh an expired URL.

## International pricing and billing

The international upstream reference prices are:

| Item | Price |
|---|---:|
| 768P output | `$0.08` per second |
| 2K output | `$0.13` per second |
| Reference-video input | Same per-second rate as the selected output resolution |
| Input images 1–5 | Free |
| Each input image after the fifth | `$0.04` |
| Reference audio | Free |

new-api uses the configured `MiniMax-H3` model price as the 768P per-second
base. The adaptor applies the 2K multiplier (`0.13 / 0.08 = 1.625`), reserves
up to 15 seconds of reference-video input, and settles against the usage
reported by the completed task. Group and subscription rules may change the
quota charged to a particular client.

### Verified international API behavior

On 2026-08-05, live international API checks completed successfully for 768P
and 2K text-only generation, a 768P first-frame request, a 768P reference
video plus reference audio request, and a 768P request with six reference
images. Every task progressed from `queued` to `running` to `succeeded` and
returned a non-empty temporary result URL.

The reference-video case reported 6 input seconds plus 4 output seconds as
`total_seconds: 10`; the reference audio added no separate billable usage.
The six-image case reported `total_seconds: 4` and `input_image_count: 6`.
These responses support completion settlement from `total_seconds` and
`input_image_count`: at the published prices the two cases calculate to
`$0.80` and `$0.36`, respectively. These calculations have not yet been
reconciled against an account billing statement.

## Limitations

- Only generation creation and task query are supported.
- `callback_url` is rejected with `unsupported_callback_url`; forwarding it
  would expose the private upstream task ID.
- Task listing, deletion, cancellation, regeneration, remix, and
  `MiniMax-H3-Context-IR` are not supported by this adaptor.
- Only the international `api.minimax.io` region and its USD pricing are in
  scope. Do not point type `110` at a China-region endpoint.
- Media format, dimensions, duration, and remote URL reachability are finally
  validated by the upstream service.
