# Flatkey Asset Library API

Flatkey exposes a private asset library for Seedance reference media. The public contract uses only Flatkey asset IDs and `asset://` URIs. Provider channel, credential, binding scope, and upstream asset identifiers are internal and are never returned.

## Upload An Asset

Clients do not choose a readiness model when uploading, creating, or querying assets. Flatkey derives the Seedance 2.0 model set from the authenticated API key scope, including the token group, model allowlist or blacklist, specific-channel constraint, and current route configuration.

Create from a public HTTPS URL:

```http
POST /v1/assets
Authorization: Bearer <flatkey-api-key>
Content-Type: application/json
```

```json
{
  "url": "https://example.com/portrait.png",
  "asset_type": "Image"
}
```

Upload a local file:

```http
POST /v1/assets/upload
Authorization: Bearer <flatkey-api-key>
Content-Type: multipart/form-data
```

Multipart fields:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `file` | file | Yes | Local image, video, or audio file. |
| `asset_type` | string | No | One of `Image`, `Video`, or `Audio`. When omitted, Flatkey infers the type from the uploaded file content type. |

The legacy JSON fields `model` on URL upload and signed-upload session creation are accepted for compatibility only. They do not affect readiness selection. New clients should omit `model`.

Successful response:

```json
{
  "id": "ast_1234567890abcdef1234567890abcdef",
  "object": "asset",
  "asset_type": "Image",
  "status": "Processing",
  "available_models": [],
  "asset_url": "asset://ast_1234567890abcdef1234567890abcdef",
  "created_at": 1785292000
}
```

## Query Readiness

```http
GET /v1/assets/ast_1234567890abcdef1234567890abcdef
Authorization: Bearer <flatkey-api-key>
```

`status` is a scoped strict truth for the authenticated API key. `Active` means every required Seedance 2.0 model in the current key scope has a current verified binding that can be used to create a task. Task creation revalidates this state because routing and credentials can change after a query.

`available_models` is always an array. It lists the subset of models in the current key scope that can be used immediately with this asset.

Partial readiness example:

```json
{
  "id": "ast_1234567890abcdef1234567890abcdef",
  "object": "asset",
  "asset_type": "Image",
  "status": "Processing",
  "available_models": ["seedance-2.0-fast"],
  "asset_url": "asset://ast_1234567890abcdef1234567890abcdef",
  "created_at": 1785292000
}
```

In this example a `seedance-2.0-fast` task may be created with this asset, but a `seedance-2.0` task must wait until `seedance-2.0` also appears in `available_models`.

Fully ready example:

```json
{
  "id": "ast_1234567890abcdef1234567890abcdef",
  "object": "asset",
  "asset_type": "Image",
  "status": "Active",
  "available_models": ["seedance-2.0", "seedance-2.0-fast"],
  "asset_url": "asset://ast_1234567890abcdef1234567890abcdef",
  "created_at": 1785292000
}
```

Status values:

| Status | Meaning |
| --- | --- |
| `Creating` | The source upload or source completion is incomplete. Retry later. |
| `Processing` | The source exists, but at least one required model coverage route is missing, being prepared, or retrying. Check `available_models` for model-level readiness. |
| `Active` | All required models in the current API key scope have current verified bindings for this asset. |
| `Failed` | The source failed, or at least one required model exhausted every eligible coverage route for this key scope. Create a new asset after fixing the source media or wait for routing recovery. |
| `Expired` | The source object is unrecoverable or expired. Create a new asset. |

TechMobi does not expose a public asset-status lookup that Flatkey can use. If TechMobi upload returns a temporary `Processing` result, Flatkey keeps the public asset `Processing`; it never marks the asset `Active` only because an opaque provider URI has the right format.

## Use Assets In Seedance

Before creating a video task, poll each referenced asset with the same API key that will create the task. Create the task only after the target model appears in every asset's `available_models`.

For two assets:

1. Upload both assets.
2. Poll `GET /v1/assets/{asset_id}` for each asset.
3. For `seedance-2.0-fast`, proceed only when both responses include `seedance-2.0-fast` in `available_models`.
4. For `seedance-2.0`, proceed only when both responses include `seedance-2.0` in `available_models`.
5. Poll the video task until a terminal status. `SUCCESS`, `success`, `completed`, and `succeeded` are success. `failed`, `cancelled`, `canceled`, and `expired` are failures.

Fast request example:

```http
POST /v1/videos
Authorization: Bearer <flatkey-api-key>
Content-Type: application/json
```

```json
{
  "model": "seedance-2.0-fast",
  "content": [
    {
      "type": "text",
      "text": "Cinematic shot with two consistent reference characters"
    },
    {
      "type": "image_url",
      "role": "reference_image",
      "image_url": {
        "url": "asset://ast_1234567890abcdef1234567890abcdef"
      }
    },
    {
      "type": "image_url",
      "role": "reference_image",
      "image_url": {
        "url": "asset://ast_abcdef1234567890abcdef1234567890"
      }
    }
  ],
  "resolution": "480p",
  "ratio": "16:9",
  "duration": 4,
  "generate_audio": true
}
```

Pro request example:

```json
{
  "model": "seedance-2.0",
  "content": [
    {
      "type": "text",
      "text": "Cinematic shot with two consistent reference characters"
    },
    {
      "type": "image_url",
      "role": "reference_image",
      "image_url": {
        "url": "asset://ast_1234567890abcdef1234567890abcdef"
      }
    },
    {
      "type": "image_url",
      "role": "reference_image",
      "image_url": {
        "url": "asset://ast_abcdef1234567890abcdef1234567890"
      }
    }
  ],
  "resolution": "480p",
  "ratio": "16:9",
  "duration": 4,
  "generate_audio": true
}
```

Task query:

```http
GET /v1/videos/{task_id}
Authorization: Bearer <flatkey-api-key>
```

For requests with multiple assets, every referenced asset must share one current verified target for the selected model. If revalidation finds that previously ready assets cannot currently be used together on a common target, Flatkey keeps the local task in asset preparation while it waits for a common verified target. Only preparation timeout exhaustion becomes a provider-neutral failure. Flatkey does not expose provider routing details and does not fall back to stale historical bindings.

Only the owner of an asset can query or use it. Missing assets and assets owned by another user return the same not-found error.

## Production Test Checklist

Use a staging or freshly deployed production key with Seedance 2.0 fast and pro access. Do not log real API keys.

The repository includes a probe script that uploads two images, waits for the selected model in both assets' `available_models`, creates one video task, polls the task to a terminal state, and prints timing JSON.

Set required environment variables:

```powershell
$env:FLATKEY_BASE_URL = "https://api.example.com"
$env:FLATKEY_TEST_API_KEY = "<flatkey-api-key>"
$env:FAST_MODEL = "seedance-2.0-fast"
$env:PRO_MODEL = "seedance-2.0"
```

Run both model slots with two fresh image files:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\asset_model_coverage_probe.ps1 -ImagePath1 C:\tmp\asset-a.png -ImagePath2 C:\tmp\asset-b.png -ModelSlot fast
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\asset_model_coverage_probe.ps1 -ImagePath1 C:\tmp\asset-c.png -ImagePath2 C:\tmp\asset-d.png -ModelSlot pro
```

Probe exit codes:

| Exit code | Meaning |
| ---: | --- |
| 0 | The selected model became available for both assets and the video task ended in `SUCCESS`, `success`, `completed`, or `succeeded`. |
| 2 | Asset contract failure, such as a terminal asset status before model readiness or `Active` without the selected model in `available_models`. |
| 3 | Video task creation did not return a public task ID. |
| 4 | Video task reached a non-success terminal state, including failed, cancelled, canceled, or expired. |
| 1 | Probe setup, upload, polling, or request failure. |

Record these timestamps for each run:

| Field | Capture point |
| --- | --- |
| `upload_started_at` | Immediately before the first asset upload request. |
| `upload_finished_at` | After the second upload response is received. |
| `first_poll_at` | Before the first status poll. |
| `fast_ready_at` | When both assets first include `seedance-2.0-fast` in `available_models`. |
| `pro_ready_at` | When both assets first include `seedance-2.0` in `available_models`. |
| `fast_task_created_at` | When the fast task creation response is received. |
| `pro_task_created_at` | When the pro task creation response is received. |
| `fast_terminal_at` | When the fast task reaches `SUCCESS`, `success`, `completed`, `succeeded`, or a failure terminal state. |
| `pro_terminal_at` | When the pro task reaches `SUCCESS`, `success`, `completed`, `succeeded`, or a failure terminal state. |

Derived durations:

| Metric | Formula |
| --- | --- |
| Upload latency | `upload_finished_at - upload_started_at` |
| Fast asset readiness latency | `fast_ready_at - upload_finished_at` |
| Pro asset readiness latency | `pro_ready_at - upload_finished_at` |
| Fast create latency after readiness | `fast_task_created_at - fast_ready_at` |
| Pro create latency after readiness | `pro_task_created_at - pro_ready_at` |
| Fast task duration | `fast_terminal_at - fast_task_created_at` |
| Pro task duration | `pro_terminal_at - pro_task_created_at` |

Recommended checks:

1. Upload two new image assets of about 2 MB each. If the provider rejects size or media, retry with smaller valid images and record the failed response.
2. Confirm upload responses can be `Processing` with `available_models: []`; they must not become `Active` solely because the source upload succeeded.
3. Poll both assets every 1 to 2 seconds. Verify `available_models` is always present and is an array.
4. When only `seedance-2.0-fast` is present, create only the fast task. Do not create pro yet.
5. Create the pro task only after `seedance-2.0` appears for both assets.
6. Poll each task result. Treat `SUCCESS`, `success`, `completed`, and `succeeded` as pass; `failed`, `cancelled`, `canceled`, `expired`, and timeout are fail.
7. Repeat once after temporarily disabling or changing a route in staging. The asset should project back to `Processing` or keep the task in preparation instead of exposing a stale binding error.

## Staged Enablement

Recommended rollout for model-coverage readiness:

1. Deploy migrations, preparation workers, and metrics with strict task creation/reference enforcement disabled.
2. Enable preparation in staging and verify that assets reach per-model coverage.
3. Verify public status in staging; canonical asset responses always project status strictly from the authenticated key scope.
4. Roll out strict task creation/reference enforcement gradually in production and monitor `Processing`, `Failed`, retry, and task-creation asset errors.

Relevant environment flag:

```env
ASSET_MODEL_COVERAGE_STRICT_ENABLED=false
```

This flag is only a mixed-version rollout guard for task creation/reference strict enforcement. It does not relax canonical public asset status; public responses always report `Active` only when all required models in the current key scope are ready.

## Errors

Errors use the existing OpenAI-compatible error envelope:

```json
{
  "error": {
    "message": "Asset is still processing, please try again later",
    "type": "asset_not_ready",
    "param": "",
    "code": "asset_not_ready"
  }
}
```

Stable asset error codes:

| HTTP | Code | Meaning |
| ---: | --- | --- |
| 400 | `invalid_asset_request` | URL, type, media, or asset URI is invalid. |
| 400 | `asset_type_mismatch` | Declared asset type does not match the uploaded media. |
| 404 | `asset_not_found` | Asset does not exist or is not owned by the caller. |
| 409 | `asset_not_ready` | Asset is still creating or processing. |
| 410 | `asset_expired` | Asset source expired before completion or preparation. |
| 422 | `asset_failed` | Asset processing failed. |
| 409 | `asset_channel_conflict` | A video request mixes assets that cannot be used together. |
| 503 | `asset_channel_unavailable` | The asset backend is temporarily unavailable for this request. |
| 503 | `asset_group_initializing` | Asset storage or coverage is initializing. Retry later. |
| 502 | `asset_upstream_error` | The provider request failed or returned an unsupported response. |
| 500 | `asset_storage_error` | Flatkey could not persist or read asset state. |
