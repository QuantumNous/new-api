# TechMobi Processing Asset Handle Design

## Goal

Make assets uploaded through the TechMobiVideo channel usable when Mindon returns a successful asynchronous response containing both `status: Processing` and a valid `asset://` handle.

## Confirmed production behavior

- Flatkey successfully stores the source asset and marks it `Active` / `Available`.
- Channel 106 (`Volcengine-seedance2.0`, TechMobiVideo) returns `upstream_processing` during model materialization.
- The current adapter discards the returned `assetUrl`, retries the upload, and eventually writes a failed binding with an empty `upstream_asset_id`.
- Mindon's upload contract returns a directly usable asset handle; it does not expose a separate documented asset-status endpoint.

## Decision

Apply a TechMobiVideo-only compatibility rule:

1. A 2xx upload response with `status: Processing` and a syntactically valid `asset://` URL is a successful materialization result. Preserve the handle and mark it `Active`, because the returned handle is already valid for downstream Seedance requests.
2. A `Processing` response without a valid handle remains retryable `upstream_processing`.
3. Non-2xx responses, invalid successful responses, timeouts, request IDs, and upstream error classification retain their existing behavior.
4. `GetAsset` treats a previously persisted valid TechMobi handle as active. This is a channel-specific contract adapter, not a global asset-state change.

## Scope

Only these files change:

- `service/techmobi_asset.go`
- `service/techmobi_asset_test.go`

No database schema, public API shape, routing group, channel configuration, or other provider adapter changes.

## Verification

- Regression test: `Processing + valid assetUrl` returns the handle as `Active` without a retry error.
- Regression test: `GetAsset(valid asset://...)` returns `Active`.
- Existing tests keep `Processing` without a valid handle retryable.
- Run the focused TechMobi service tests, relevant asset-binding tests, `go vet ./service`, and `git diff --check`.
- After deployment to a test environment, upload a new asset with a Seedance Domestic key and verify it reaches `Active` and can be referenced by a Seedance request.
