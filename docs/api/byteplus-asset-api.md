# BytePlus Asset Library API

Flatkey exposes a private asset library for portrait/reference media used by `seedance-2.0`. The public contract uses only Flatkey asset IDs. Provider-side identifiers and routing details are kept internal.

## Create An Asset

```http
POST /v1/assets
Authorization: Bearer <flatkey-api-key>
Content-Type: application/json
```

```json
{
  "url": "https://example.com/portrait.mp4",
  "asset_type": "Video",
  "moderation": {
    "strategy": "Default"
  }
}
```

Request fields:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `url` | string | Yes | Public HTTP or HTTPS URL that the provider can fetch. |
| `asset_type` | string | Yes | One of `Image`, `Video`, or `Audio`. |
| `moderation.strategy` | string | No | `Default` or `Skip`. When omitted, Flatkey uses `Default`. |

Successful response:

```json
{
  "id": "ast_1234567890abcdef1234567890abcdef",
  "object": "asset",
  "asset_type": "Video",
  "status": "Processing",
  "moderation": {
    "strategy": "Default"
  },
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
  "asset_type": "Video",
  "status": "Active",
  "moderation": {
    "strategy": "Default"
  },
  "created_at": 1785292000
}
```

Status values:

| Status | Meaning |
| --- | --- |
| `Creating` | Flatkey is preparing the asset record. Retry later. |
| `Processing` | The media is being processed. Retry later. |
| `Active` | The asset can be used in video requests. |
| `Failed` | The asset cannot be used. Create a new asset after fixing the source media. |

## Use An Asset In Seedance

After the asset is `Active`, pass the Flatkey ID as an `asset://` URI in the Seedance content item:

```json
{
  "model": "seedance-2.0",
  "content": [
    {
      "type": "image_url",
      "image_url": {
        "url": "asset://ast_1234567890abcdef1234567890abcdef"
      },
      "role": "reference_image"
    },
    {
      "type": "text",
      "text": "A cinematic talking portrait in a studio"
    }
  ]
}
```

Only the owner of an asset can query or use it. Missing assets and assets owned by another user return the same not-found error.

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
| 400 | `invalid_asset_request` | URL, type, moderation, or asset URI is invalid. |
| 404 | `asset_not_found` | Asset does not exist or is not owned by the caller. |
| 409 | `asset_not_ready` | Asset is still creating or processing. |
| 422 | `asset_failed` | Asset processing failed. |
| 409 | `asset_channel_conflict` | A video request mixes assets that cannot be used together. |
| 503 | `asset_channel_unavailable` | The asset backend is temporarily unavailable for this request. |
| 503 | `asset_group_initializing` | Asset storage is initializing. Retry later. |
| 502 | `asset_upstream_error` | The provider request failed or returned an unsupported response. |
| 500 | `asset_storage_error` | Flatkey could not persist or read asset state. |
