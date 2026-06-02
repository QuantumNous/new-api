# StoryVerse Customizations on new-api

Baseline upstream commit: `7aaa533` (QuantumNous/new-api main).

This file tracks every StoryVerse-specific change so upstream merges stay tractable.
Keep custom code in dedicated dirs/files; touch core files minimally and list them here.

## Custom files / dirs
- `deploy/` — SV docker-compose + env templates (does not exist upstream)

## Core files touched
| File | Why | Task |
|------|-----|------|
| `constant/channel.go` | Add `ChannelTypeAPImart = 58`, `ChannelBaseURLs[58]`, `ChannelTypeNames[58]` | Plan B |
| `constant/api_type.go` | Add `APITypeAPImart` const (after `APITypeCodex`) | Plan B |
| `common/api_type.go` | `ChannelType2APIType`: map `ChannelTypeAPImart → APITypeAPImart` | Plan B |
| `relay/relay_adaptor.go` | `GetAdaptor`: `case APITypeAPImart: return &apimart.Adaptor{}` | Plan B |

## New channel types reserved (avoid upstream collisions)
| Const | Value | Provider | Plan |
|-------|-------|----------|------|
| `ChannelTypeAPImart` | `58` | APImart (async image generation) | Plan B |

## Phase 1 config-model verification results (2026-06-02)

### BytePlus Ark base URL
- **Working base**: `https://ark.ap-southeast.bytepluses.com`
- `https://ark.cn-beijing.volces.com` returns 401 (key is a first-party BytePlus overseas account)
- Applies to: seedream image (`/api/v3/images/generations`) and seedance video (`/api/v3/contents/generations/tasks`)

### Task 9 — tokenrouter-gpt55 (PASS)
- Channel type=1 (OpenAI), base_url=`https://api.tokenrouter.com`
- Models: `openai/gpt-5.5,sv-text-pro`, model_mapping `{"sv-text-pro":"openai/gpt-5.5"}`
- Both model names tested through gateway → HTTP 200, `choices[0].message.content="pong"`
- Note: `SelfUseModeEnabled` option must be `true` to bypass per-model pricing check

### Task 10 — byteplus-seedream-lite (PASS)
- Channel type=45 (VolcEngine), base_url=`https://ark.ap-southeast.bytepluses.com`
- Models: `ep-20260601093313-4dt9g,sv-image-seedream-lite`
- Test: `POST /v1/images/generations` with `{"model":"sv-image-seedream-lite","prompt":"...","size":"2560x1440"}` → HTTP 200, `data[0].url` (JPEG, 2560x1440)
- No extra fields needed (no `response_format`, no `watermark` required at gateway layer)

### Task 11 — byteplus-seedance-2 (PASS)
- Channel type=45 (VolcEngine), base_url=`https://ark.ap-southeast.bytepluses.com`
- Models: `ep-20260601102439-k4mdf,sv-video-seedance`
- Submit: `POST /v1/videos {"model":"sv-video-seedance","prompt":"...","metadata":{"ratio":"16:9","duration":5,"watermark":false}}`
  - **IMPORTANT**: `ratio`/`duration`/`watermark` MUST be in `metadata` field, not top-level (doubao TaskAdaptor reads via UnmarshalMetadata)
- Poll: `GET /v1/videos/{task_id}` → status `completed`, `metadata.url` = `.mp4` URL
- Gateway status field is `completed` (not `succeeded`)

### Task 12 — minimax-music (DONE_WITH_CONCERNS — Plan G needed)
- Channel created: type=35 (MiniMax), base_url=`https://api.minimax.io`, models=`music-2.6,sv-music-minimax`
- Key is pre-configured; no end-to-end test possible yet
- **Gap**: No `/v1/music_generation` route in gateway; no `RelayModeMusic` constant; minimax adaptor has no music handler; hailuo TaskAdaptor (used for type=35 async tasks) handles Hailuo **video** only — not music
- **Plan G** required: add `RelayModeMusic`, route `/v1/music_generation` in relay-router.go, handler in minimax adaptor (synchronous, `POST upstream/v1/music_generation` → `{base_resp:{status_code},data:{audio:<url>}}`)

### Gateway admin notes
- `SelfUseModeEnabled` must be enabled: `PUT /api/option/ {"key":"SelfUseModeEnabled","value":true}` (with root auth)
- Channel cache syncs every 30s (CHANNEL_UPDATE_FREQUENCY=30); AddChannel does NOT immediately update in-memory cache

## Spike findings (Task 14–16) — 2026-06-02

### Task 14: APImart image generation — VERDICT: ASYNC

**APImart image generation is asynchronous.** `POST /v1/images/generations` returns a `task_id` immediately; the image URL is only available after polling `GET /v1/tasks/{task_id}`.

**Submit request:**
```
POST https://api.apimart.ai/v1/images/generations
Authorization: Bearer $APIMART_API_KEY
Content-Type: application/json

{"model":"gpt-image-2","prompt":"a single blue cube on white background","n":1,"size":"1024x1024"}
```

**Submit response (HTTP 200, ~0.6s):**
```json
{
  "code": 200,
  "data": [
    {"status": "submitted", "task_id": "task_01KT48E134GCG3W870HKHPVMNA"}
  ]
}
```

**Poll URL:** `GET https://api.apimart.ai/v1/tasks/{task_id}`
Authorization header same as submit.

**Poll response — pending (HTTP 200):**
```json
{
  "code": 200,
  "data": {
    "cost": 0.006,
    "created": 1780407010,
    "estimated_time": 100,
    "id": "task_01KT48E134GCG3W870HKHPVMNA",
    "progress": 0,
    "status": "pending"
  }
}
```

**Poll response — completed (HTTP 200, ~48s actual):**
```json
{
  "code": 200,
  "data": {
    "actual_time": 48,
    "completed": 1780407058,
    "cost": 0.006,
    "created": 1780407010,
    "estimated_time": 100,
    "id": "task_01KT48E134GCG3W870HKHPVMNA",
    "progress": 100,
    "result": {
      "images": [
        {
          "expires_at": 1780493458,
          "url": ["https://upload.apimart.ai/f/image/...output.png"]
        }
      ]
    },
    "status": "completed"
  }
}
```

**Contract summary for Plan B adaptor:**
- Status field: `data.status` — values: `"pending"` → `"completed"` (and likely `"failed"`)
- Progress field: `data.progress` (0–100)
- Result image URL: `data.result.images[0].url[0]` (note: `url` is an **array**, take index 0)
- Task id field in submit response: `data[0].task_id` (note: submit `data` is a list)
- Accepted params: `model`, `prompt`, `n`, `size` (standard OpenAI image params)
- Accepted model id confirmed: `gpt-image-2`
- **Plan B implication:** Cannot be a config-only OpenAI image channel. Requires a `task/apimart` TaskAdaptor (submit → poll → return URL).

### Task 15: nano-banana-pro on APImart — VERDICT: MODEL NOT FOUND / NAME UNKNOWN

Both `nano-banana-pro` and `nano-banana` return HTTP 503 `model_not_found`. The full APImart model list (179 models) contains **no "banana" model** at all. Image-generation models available on APImart include:

- `gpt-image-2`, `gpt-image-2-official`
- `gpt-image-1-official`, `gpt-image-1.5-official`
- `gemini-3-pro-image-preview`, `gemini-3-pro-image-preview-official`
- `gemini-2.5-flash-image-preview`, `gemini-3.1-flash-image-preview`
- `flux-2-pro`, `flux-2-flex`, `flux-kontext-pro`, `flux-kontext-max`
- `imagen-4.0-apimart`
- `qwen-image-2.0`, `qwen-image-2.0-pro`
- `wan2.7-image`, `wan2.7-image-pro`
- `ltx-2.3-text-image`
- `z-image-turbo`
- `grok-imagine-1.0-apimart`, `grok-imagine-1.0-edit-apimart`
- `midjourney`

APImart also has Kling video models: `kling-v3`, `kling-v3-motion-control`, `kling-v3-omni`, `kling-v2-6`, `kling-v2-6-motion-control`, `kling-video-o1`.

**Action required:** The "nano-banana-pro" model name does not exist on APImart (as of 2026-06-02). Confirm actual intended model from product/design — likely `gpt-image-2` (GPT Image 2) or possibly `wan2.7-image-pro` or a future model. Plan B should be written against `gpt-image-2` as the canonical image model until "banana" is clarified.

### Task 16: fal.ai Kling video — VERDICT: WORKING ASYNC (queue contract captured)

**Working slug:** `fal-ai/kling-video/v2.5-turbo/pro/image-to-video`
Submit to: `https://queue.fal.run/fal-ai/kling-video/v2.5-turbo/pro/image-to-video`

**Submit request:**
```
POST https://queue.fal.run/fal-ai/kling-video/v2.5-turbo/pro/image-to-video
Authorization: Key $FAL_KEY
Content-Type: application/json

{
  "prompt": "a cat jumps",
  "image_url": "https://picsum.photos/512",
  "duration": "5",
  "aspect_ratio": "16:9"
}
```

**Submit response (HTTP 200):**
```json
{
  "status": "IN_QUEUE",
  "request_id": "019e8887-52ac-7f31-88fc-1ed35f2bc8bb",
  "response_url": "https://queue.fal.run/fal-ai/kling-video/requests/019e8887-52ac-7f31-88fc-1ed35f2bc8bb",
  "status_url": "https://queue.fal.run/fal-ai/kling-video/requests/019e8887-52ac-7f31-88fc-1ed35f2bc8bb/status",
  "cancel_url": "https://queue.fal.run/fal-ai/kling-video/requests/019e8887-52ac-7f31-88fc-1ed35f2bc8bb/cancel",
  "logs": null,
  "metrics": {},
  "queue_position": 0
}
```

**Status poll URL:** `GET {status_url}` (same Authorization header)

**Status poll — IN_PROGRESS (HTTP 202):**
```json
{"status": "IN_PROGRESS", "request_id": "...", "response_url": "...", "status_url": "...", "logs": null, "metrics": {}}
```

**Status poll — COMPLETED (HTTP 200):**
```json
{"status": "COMPLETED", "request_id": "...", "metrics": {"inference_time": 83.1}}
```

**Result fetch URL:** `GET {response_url}` (same Authorization header, i.e. `https://queue.fal.run/fal-ai/kling-video/requests/{request_id}`)

**Result response (HTTP 200):**
```json
{
  "video": {
    "url": "https://v3b.fal.media/files/.../output.mp4",
    "content_type": "video/mp4",
    "file_name": "output.mp4",
    "file_size": 6652072
  }
}
```

**Contract summary for Plan C adaptor:**
- Auth header: `Authorization: Key {FAL_KEY}` (not `Bearer`)
- Submit method: `POST` to `https://queue.fal.run/{model_slug}`
- Submit returns: `request_id`, `status_url`, `response_url`
- Status values: `IN_QUEUE` → `IN_PROGRESS` → `COMPLETED` (and likely `FAILED`)
- Status HTTP codes: IN_QUEUE=200, IN_PROGRESS=202, COMPLETED=200
- Video URL location: `result.video.url` (top-level `video` object)
- Kling slug confirmed for v2.5-turbo pro i2v: `fal-ai/kling-video/v2.5-turbo/pro/image-to-video`
- Note: For "Kling 3.0", the slug likely maps to `kling-v3` on APImart (or `fal-ai/kling-video/v3/...` on fal — confirm in fal dashboard). The v2.5-turbo slug is accepted and the queue mechanics are identical for all fal models.
- Inference time observed: ~83s for a 5s video

## APImart adaptor (Plan B) — live verification 2026-06-02

### Channel configuration (working)
- **Channel type**: 58 (`ChannelTypeAPImart`)
- **Name**: `apimart-images`
- **base_url**: `https://api.apimart.ai`
- **mode**: `single`
- **models**: `gpt-image-2,gemini-3-pro-image-preview,sv-image-gpt,sv-image-banana-pro`
- **model_mapping**: `{"sv-image-gpt":"gpt-image-2","sv-image-banana-pro":"gemini-3-pro-image-preview"}`
- **groups**: `sv-monorepo,bragi-canvas`
- Admin create: `POST /api/channel/` with `{"mode":"single","channel":{...}}` (nested structure required)

### Live results (2026-06-02)

#### sv-image-gpt → gpt-image-2: PASS
- Request: `POST /v1/images/generations` `{"model":"sv-image-gpt","prompt":"a single red apple on a white background","n":1,"size":"1024x1024"}`
- Result: HTTP 200, `data[0].url = "https://upload.apimart.ai/f/image/9998219590502534-b9d7d5d8-d605-4477-a082-daa20...output.png"` (truncated)
- Latency observed: **66 seconds** (internal poll loop; expected, APImart ~48–100s)
- Gateway log: `200 | 1m6.110s | POST /v1/images/generations`

#### sv-image-banana-pro → gemini-3-pro-image-preview: PASS
- Request: `POST /v1/images/generations` `{"model":"sv-image-banana-pro","prompt":"a green pyramid on a white background","n":1}` (**no `size` field**)
- Result: HTTP 200, `data[0].url = "https://upload.apimart.ai/f/image/9998219590463829-7018db17-837d-4916-87e2-fbe9242000c9-image_task_0..."` (truncated)
- Latency observed: **22 seconds**
- Gateway log: `200 | 22.534s | POST /v1/images/generations`; billing: `$0.000076`, upstream model `gemini-3-pro-image-preview`

### Param quirks
- `gpt-image-2`: accepts `size="1024x1024"` — works fine.
- `gemini-3-pro-image-preview`: **rejects `size`** — APImart maps `size` to its own `aspect_ratio` param and returns `"This aspect_ratio is not within the range of allowed options"` when the value doesn't match. Callers must omit `size` (or send a supported aspect ratio) for this model. The adaptor passes `size` through as-is from the client; the model-specific restriction is on the APImart side.

### Custom files added (Plan B)
- `relay/channel/apimart/constants.go` — `ChannelName`, `ModelList`
- `relay/channel/apimart/dto.go` — `SubmitRequest`, `SubmitResponse`, `TaskResponse`
- `relay/channel/apimart/adaptor.go` — `Adaptor` + `pollTask` internal loop (3s interval, 10min timeout)
- `relay/channel/apimart/adaptor_test.go` — unit tests: `TestConvertImageRequest`, `TestPollTaskCompletes`, `TestPollTaskFails` (all PASS)

## Request content logging (Plan H) — live verification 2026-06-02

### Design summary
- **Table**: `request_logs` in the LOG_DB (falls back to main DB when `LOG_SQL_DSN` is unset; in production, route to a separate `LOG_SQL_DSN` Postgres instance to keep analytics off the OLTP DB).
- **Key columns**: `request_id`, `user_id`, `token_name`, `group`, `model_name`, `channel_id`, `endpoint`, `status_code`, `duration_ms`, `is_stream`, `request_body` (TEXT), `response_summary` (TEXT).
- **Middleware**: `RequestContentLog` in `middleware/` — reads from `*cappedResponseWriter` (capped tee writer on `c.Writer`), strips large bodies, and enqueues a `RequestLog` struct.
- **Registration point**: `router/relay-router.go`, applied to the `/v1` relay group **after** `Distribute` — so `user_id` / `token_name` / `group` are already set in context.
- **Config flag**: `REQUEST_CONTENT_LOG_ENABLED=true` (env var / system option). Feature is fully no-op when false.
- **Caps**: request body capped at **256 KB**; response summary capped at **8 KB**.
- **Async queue**: buffered channel size 2000, **2 background workers**, **drop-on-full** (non-blocking send) — zero latency impact on the relay path even under burst.
- **UTF-8 safety**: request body bytes are sanitized with `strings.ToValidUTF8` before insert to avoid `invalid byte sequence for encoding "UTF8"` errors on Postgres when the client sends truncated multi-byte sequences.

### Core files touched (Plan H)
| File | Why | Task |
|------|-----|------|
| `model/main.go` | Add `RequestLog` GORM model + `LOG_DB` init + `migrateDBFast` hook | Plan H |
| `router/relay-router.go` | Register `middleware.RequestContentLog()` on `/v1` group after Distribute | Plan H |
| `common/init.go` | Init `LOG_DB` from `LOG_SQL_DSN` (falls back to main DB) | Plan H |
| `common/constants.go` | Add `RequestContentLogEnabled` flag + queue/worker constants | Plan H |

### Custom files added (Plan H)
- `middleware/request_content_log.go` — `RequestContentLog` middleware + async worker loop
- `middleware/capped_response_writer.go` — `cappedResponseWriter` tee-writer (cap 256 KB req / 8 KB resp)
- `middleware/request_content_log_test.go` — edge tests (empty body, oversized body, Chinese UTF-8, concurrent enqueue)

### Live verification results (2026-06-02)

All three test calls returned HTTP 200; rows appeared in `request_logs` within 5s (async queue drained).

**psql query:**
```sql
SELECT request_id, token_name, "group", model_name, endpoint, status_code, duration_ms,
       left(request_body,300) AS req, left(response_summary,200) AS resp
FROM request_logs ORDER BY id DESC LIMIT 5;
```

**Row 1 — image generation (sv-image-seedream-lite):**
- `endpoint=/v1/images/generations`, `status_code=200`, `token_name=sv-monorepo-token`, `group=sv-monorepo`
- `request_body={"model":"sv-image-seedream-lite","prompt":"a teal circle on white","size":"2560x1440"}`
- `response_summary={"model":"seedream-5-0-260128","created":1780411814,"data":[{"url":"https://ark-acg-ap-southeast-1.tos-ap-southeast-1.volces.com/seedream-5-0/02178041179293279d39dabdd16daed9e...` (truncated)

**Row 2 — Chinese text (sv-text-pro, UTF-8 fix confirmed):**
- `endpoint=/v1/chat/completions`, `status_code=200`
- `request_body={"model":"sv-text-pro","messages":[{"role":"user","content":"用一句话讲个关于太空猫的故事，必须包含中文标点。"}]}`
- Chinese prompt stored INTACT — no mojibake, no `invalid byte sequence` error.

**Row 3 — English text (sv-text-pro):**
- `endpoint=/v1/chat/completions`, `status_code=200`
- `request_body={"model":"sv-text-pro","messages":[{"role":"user","content":"log me: hello gateway"}]}`
- Content confirmed: `log me: hello gateway`.

**Confirmation checklist:**
- [x] >= 3 rows exist
- [x] Chinese prompt stored intact (UTF-8 fix holds live)
- [x] English text row contains `log me: hello gateway`; `model_name=sv-text-pro`
- [x] Image row `response_summary` contains `https://ark-acg-ap-southeast-1...` image URL; `model_name=sv-image-seedream-lite`
- [x] All rows: `status_code=200`, `token_name=sv-monorepo-token`, `group=sv-monorepo`
- [x] No `invalid byte sequence for encoding "UTF8"` in gateway logs
