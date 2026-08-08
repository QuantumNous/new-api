# Flatkey Asset Library API

Flatkey exposes a private asset library for Seedance reference media. The public contract uses only Flatkey asset IDs and `asset://` URIs. Provider channel, credential, binding scope, and upstream asset identifiers are internal and are never returned.

## Create An Asset

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

JSON fields:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `url` | string | Yes | Public HTTPS URL that Flatkey can fetch. |
| `asset_type` | string | Yes | One of `Image`, `Video`, or `Audio`. |
| `model` | string | No | Compatibility-only input. Flatkey accepts and ignores this field for asset readiness selection. |

Clients do not select the asset readiness model when uploading or querying assets. Readiness is projected from the authenticated API key scope and current routing configuration.

Successful response:

```json
{
  "id": "ast_1234567890abcdef1234567890abcdef",
  "object": "asset",
  "asset_type": "Image",
  "status": "Processing",
  "asset_url": "asset://ast_1234567890abcdef1234567890abcdef",
  "created_at": 1785292000
}
```

## Get Asset Status

```http
GET /v1/assets/ast_1234567890abcdef1234567890abcdef
Authorization: Bearer <flatkey-api-key>
```

Successful response:

```json
{
  "id": "ast_1234567890abcdef1234567890abcdef",
  "object": "asset",
  "asset_type": "Image",
  "status": "Active",
  "asset_url": "asset://ast_1234567890abcdef1234567890abcdef",
  "created_at": 1785292000
}
```

Status values:

| Status | Meaning |
| --- | --- |
| `Creating` | The source upload or source completion is incomplete. Retry later. |
| `Processing` | The source exists, but at least one required model coverage route is missing, being prepared, or retrying. Retry later. |
| `Active` | All required models in the current API key scope have a current verified route for this asset. This is an observed guarantee for the current routing config; task creation revalidates it. |
| `Failed` | The source failed, or at least one required model exhausted every eligible coverage route for this key scope. Create a new asset after fixing the source media or wait for routing recovery. |
| `Expired` | The source object is unrecoverable or expired. Create a new asset. |

If routing or credentials drift after an `Active` response, the asset may project back to `Processing` during later queries or task creation. Flatkey does not fall back to stale historical bindings.

## Use Assets In Seedance

After each asset is `Active`, pass the Flatkey ID as an `asset://` URI in the Seedance content item:

```json
{
  "model": "seedance-2.0-fast",
  "content": [
    {
      "type": "text",
      "text": "A cinematic scene using two consistent reference characters"
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
  "duration": 4
}
```

For requests with multiple assets, every referenced asset must share one current verified target for the selected model. If revalidation finds that previously `Active` assets cannot currently be used together on a common target, Flatkey enters or keeps the local `preparing_assets` state while it waits for a common verified target. Only preparation timeout exhaustion becomes a provider-neutral failure. Flatkey does not expose provider routing details and does not fall back to stale historical bindings.

Only the owner of an asset can query or use it. Missing assets and assets owned by another user return the same not-found error.

## Staged Enablement

Recommended rollout for model-coverage readiness:

1. Deploy migrations, preparation workers, and metrics with strict projection disabled.
2. Enable preparation in staging and verify that assets reach per-model coverage.
3. Enable strict projection in staging so public status reflects the authenticated key scope.
4. Roll out strict projection gradually in production and monitor `Processing`, `Failed`, retry, and task-creation asset errors.

Relevant environment flag:

```env
ASSET_MODEL_COVERAGE_STRICT_ENABLED=false
```

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
