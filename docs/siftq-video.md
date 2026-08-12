# SiftQ video channel

SiftQ is available as a native asynchronous video channel. It exposes one fixed routing model, `MiniMax-H3`, through new-api's video endpoints and maps requests to the SiftQ V2 contract.

## Channel configuration

- Channel type: `SiftQ`
- API key: a SiftQ bearer key
- Default Base URL: `https://siftq.com/api/minimax/`
- Model: `MiniMax-H3`

The Base URL can be overridden per channel. The adaptor joins the configured Base URL and V2 paths with exactly one slash.

## Create a task

Send a request to either `POST /v1/video/generations` or `POST /v1/videos`:

```json
{
  "model": "MiniMax-H3",
  "prompt": "A cinematic ocean sunrise.",
  "duration": 5,
  "size": "2K",
  "metadata": {
    "ratio": "16:9"
  }
}
```

Supported standard fields include `prompt`, `image`, `images`, `duration`, and `size`. `size` accepts `768P` or `2K`.

For first-frame input, pass `image`. For first-and-last-frame input, pass two entries in `images`. These modes use the input frame ratio and are submitted upstream with `ratio: "adaptive"`.

For reference image, video, or audio inputs, pass the SiftQ `content` array through `metadata`:

```json
{
  "model": "MiniMax-H3",
  "prompt": "Match the motion and atmosphere of the references.",
  "duration": 7,
  "metadata": {
    "resolution": "2K",
    "ratio": "4:3",
    "callback_url": "https://example.com/webhooks/siftq",
    "content": [
      { "type": "text", "text": "Match the motion and atmosphere of the references." },
      {
        "type": "image_url",
        "image_url": { "url": "https://example.com/reference.png" },
        "role": "reference_image"
      },
      {
        "type": "video_url",
        "video_url": { "url": "https://example.com/reference.mp4" },
        "role": "reference_video"
      },
      {
        "type": "audio_url",
        "audio_url": { "url": "https://example.com/reference.mp3" },
        "role": "reference_audio"
      }
    ]
  }
}
```

The task response uses new-api's public task ID. Query it with `GET /v1/video/generations/{task_id}` or `GET /v1/videos/{task_id}`. Background task polling queries the native SiftQ V2 status endpoint and records `task.content.url` when generation succeeds.

`callback_url` is forwarded for users who also consume SiftQ webhooks. new-api continues to manage task polling independently; it does not expose or require the upstream task ID.
