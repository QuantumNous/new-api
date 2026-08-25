# Channel 106 Real-Person Multipart Design

## Problem

The public real-person asset API accepts `multipart/form-data`, but the multipart
preflight currently requires a native BytePlus channel and native storage
credentials. TokenSpace-backed Seedance channels therefore return
`asset_channel_unavailable` before reading the uploaded file, even though their
provider already supports creating an asset from a URL.

## Decision

Keep the public API unchanged. After validating an active profile, resolve the
real-person provider and then resolve a private temporary object store from the
provider binding:

- native BytePlus: preserve the existing credential-selected TOS/GCS store;
- TokenSpace material provider: use the configured private GCS temp-media store.

The multipart handler stores the upload privately, signs a short-lived GET URL,
passes that URL to the provider's existing `CreateAsset` method, and reuses the
existing idempotency, persistence, retry, and cleanup paths. No public object or
second client upload endpoint is introduced.

## Invariants

- URL-based asset creation is unchanged.
- The upstream group is always taken from the persisted verified profile.
- Temporary objects remain private and are deleted or queued for cleanup on all
  terminal paths.
- TokenSpace channels without an explicitly configured private GCS bucket still
  fail with `asset_channel_unavailable`; this is an operator configuration error,
  not a client multipart error.

## Verification

Add a regression test proving a TokenSpace-backed channel accepts multipart,
stores one object, signs it, and sends the signed URL to `CreateAsset`.
