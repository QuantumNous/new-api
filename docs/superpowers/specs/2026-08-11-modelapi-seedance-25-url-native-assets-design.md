# ModelAPI Seedance 2.5 URL-Native Asset Design

## Goal

Allow `doubao-seedance-2-5-260628` requests routed through the ModelAPI Seedance channel to consume Flatkey asset-library references without inventing an upstream asset-library API that ModelAPI does not document.

The production channel binding is not skipped. Administrators still bind the public model to an enabled `ModelAPISeedance` channel, and that channel continues to participate in routing, fixed-price billing, health, and enable/disable controls. Only upstream asset materialization is skipped for this channel.

## Upstream contract boundary

The ModelAPI documentation exposes task submission and polling only:

- `POST /v1/tasks`
- `GET /v1/tasks/{task_id}`

Its task input accepts HTTPS or base64 media in `input.image[]`, `input.video[]`, and `input.audio[]`. It does not expose an asset create, asset bind, or asset lookup API. Flatkey must therefore treat ModelAPI as a URL-native consumer instead of creating provider-side asset identifiers.

ModelAPI request limits remain enforced before submission: at most 30 images, 10 videos, 10 audio items, and 50 media items in total.

## Selected design

Introduce an internal URL-native target capability for `ChannelTypeModelAPISeedance`. The deterministic target scope is `source-url:modelapi`.

For this target:

- target selection still persists an active `AssetModelCoverageTarget`;
- readiness still persists one row per asset and model;
- the readiness worker validates the current source and target, then activates readiness with the existing CAS transition;
- the worker does not resolve a materializer, call a provider, sign a URL, create an `AssetBinding`, or persist an upstream asset ID;
- strict readiness and available-model projections require an active matching readiness row and a recoverable source, but do not require an active binding.

All binding-based channels retain their existing behavior.

## Source lifecycle and status

A URL-native target is usable only while the Flatkey source is recoverable:

- the asset belongs to the submitting user;
- the requested media type matches the stored asset type;
- the asset lifecycle is active;
- `SourceStatus` is available;
- storage backend, bucket, and object key are present and supported;
- `SourceExpiresAt` is strictly greater than the current time.

`SourceExpiresAt <= now` fails closed even if a stale active status or historical binding remains in the database. Status reconciliation must stop reporting the ModelAPI model as active/available once the source expires.

## Per-submission rewrite

After a ModelAPI channel is selected, `RefreshAssetRewriteMapForSelectedChannel` takes the URL-native branch before the existing materialization branch.

The resolver performs two phases:

1. Re-query all referenced assets by public ID and user ID, then validate ownership, type, lifecycle, source recoverability, selected target, and selected channel for every reference.
2. Only after every reference passes, generate a fresh GCS V4 GET URL for every distinct source and require each result to use the `https` scheme.

This ordering guarantees that one expired or invalid reference results in zero signer calls. The returned map uses `asset://<public_id>` keys and short-lived HTTPS values. Neither the map nor any signed URL is written to `AssetBinding`, `AssetModelReadiness`, `AssetModelCoverageTarget`, `Task`, or `Asset` rows.

Repeated submissions must generate new signed URLs. Queued submissions rebuild their asset reference context and use the same middleware branch, so a URL is signed at actual submit time rather than queue-enqueue time.

## Adaptor behavior

The ModelAPI adaptor must apply the rewrite map before media URL validation in both `ValidateRequestAfterModelMapping` and `BuildRequestBody`.

The adaptor fails closed when:

- an `asset://` reference is malformed;
- a required rewrite entry is missing;
- a rewrite value is empty, non-HTTPS, or still uses an asset scheme;
- the final media URL is HTTP.

The upstream request body must never contain an unresolved Flatkey asset URI. Plain-text prompt mentions of `asset://...` are not rewritten.

## Test-network safety

No automated test may call ModelAPI or GCS. Tests use SQLite, the existing fake asset object store, and `httptest.Server` only.

Package-level test setup sets `HTTP_PROXY`, `HTTPS_PROXY`, and `ALL_PROXY` to `http://127.0.0.1:1`, with loopback in `NO_PROXY`. Any live-host test guard is test-owned; production code must not inspect Go test flags.

## Compatibility

- BytePlus, TechMobi, BlockRun, and other binding/materializer channels continue to require and use `AssetBinding`.
- The public request remains `POST /v1/videos` with `asset://` references.
- The upstream ModelAPI payload receives HTTPS media URLs.
- The public result remains the Flatkey `/content` URL, and successful downloads continue to redirect to Google Cloud Storage.
- Fixed-price two-stage billing remains unchanged.

## Acceptance criteria

- Seedance 2.5 spellings using `2.5`, `2-5`, and `2_5` enter the reusable-asset model scope.
- An enabled ModelAPI channel is target-eligible without a materializer.
- URL-native readiness becomes active without provider calls or binding rows.
- Strict status and available-model projection work without a binding while the source is recoverable.
- Source expiry immediately removes URL-native availability.
- Each submission obtains a fresh HTTPS rewrite map; signed URLs are absent from database rows.
- Any invalid or expired member prevents all signing.
- Both immediate and queued submission paths use the URL-native resolver.
- The validation-then-build adaptor call order succeeds for mapped assets and rejects HTTP or missing rewrites.
- All tests remain offline and do not consume ModelAPI balance.
