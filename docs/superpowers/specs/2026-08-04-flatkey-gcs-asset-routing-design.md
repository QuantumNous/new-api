# Flatkey GCS Asset Routing Design

Date: 2026-08-04

Status: Proposed for implementation review

## Summary

Flatkey exposes one provider-neutral asset contract. Clients create and reuse
`asset://ast_...` references without knowing whether a later generation task is
served by BytePlus, MindOn, or another provider.

Google Cloud Storage (GCS) is the durable source store for new Flatkey assets.
Provider-specific asset identifiers are stored separately as internal bindings.
At task submission time, Flatkey selects a model-capable channel, reuses active
bindings when possible, creates missing bindings from the GCS source when
necessary, rewrites the public asset references, and submits the upstream task.

This design supersedes the provider-pinned ownership model in the existing
BytePlus asset implementation. It preserves existing public `ast_...` IDs and
the current Seedance `content[]` request format.

## Goals

1. Keep one Flatkey public asset API and one `asset://ast_...` URI format.
2. Keep provider names, channel IDs, credentials, and upstream asset IDs private.
3. Let the same Flatkey asset be materialized in more than one provider channel.
4. Prefer a channel where all referenced assets are already active.
5. Preserve the ability to move an asset to another channel while its GCS source
   remains available.
6. Return a local task ID before provider asset preparation finishes.
7. Keep creation, binding, and task preparation correct across multiple router
   instances.
8. Reuse the existing GCS authentication and signed URL infrastructure.

## Non-goals

1. Cross-user physical deduplication of media objects.
2. Exposing provider binding state through the public API.
3. Copying every asset to every provider at upload time.
4. Making an expired source recoverable when no active provider binding remains.
5. Supporting multiple independent upstream asset namespaces behind one Flatkey
   channel in the first version.

## Public Contract

### Canonical asset creation

`POST /v1/assets` accepts a public HTTPS source URL and an asset type. Flatkey
copies the source into GCS before the asset becomes `Active`.

```json
{
  "url": "https://example.com/reference.mp4",
  "asset_type": "Video"
}
```

The canonical response is provider-neutral:

```json
{
  "id": "ast_1234567890abcdef1234567890abcdef",
  "object": "asset",
  "asset_type": "Video",
  "status": "Active",
  "asset_url": "asset://ast_1234567890abcdef1234567890abcdef",
  "created_at": 1785819191,
  "source_expires_at": 1788411191
}
```

URL ingestion may return `Processing` when the source cannot be copied within a
bounded request. `GET /v1/assets/:asset_id` returns the public state.

### File upload

`POST /v1/assets/upload` is a multipart compatibility entry point. It accepts a
`file` and an optional `model` field, stores the file in GCS, and calls the same
canonical asset service. The optional model is used only for access validation;
it does not pin the asset to a provider or channel.

For files that exceed the Cloud Run request limit, Flatkey also exposes a native
direct upload flow:

1. `POST /v1/assets/uploads` creates an upload session and signed GCS PUT URL.
2. The client uploads directly to GCS.
3. `POST /v1/assets/uploads/:upload_id/complete` validates object metadata and
   activates the asset.

The compatibility endpoint has a configurable hard cap no greater than 30 MiB.
The asset service has separate configurable media limits with initial defaults
of 20 MiB for images, 500 MiB for video, and 100 MiB for audio. Files above the
compatibility cap must use the direct upload flow even when they remain within
the asset service limit.

### Generation task references

Both `/v1/video/generations` and `/v1/generation/tasks` accept the existing
Seedance `content[]` format. Public asset references remain unchanged:

```json
{
  "model": "seedance-2.0",
  "content": [
    {
      "type": "video_url",
      "role": "reference_video",
      "video_url": {
        "url": "asset://ast_1234567890abcdef1234567890abcdef"
      }
    },
    {
      "type": "text",
      "text": "Create a product video"
    }
  ]
}
```

The create response returns a Flatkey task ID immediately with public status
`queued`. Asset preparation remains an internal task stage.

## Data Model

### `assets`

`assets` owns the public identity and the recoverable GCS source.

| Field | Purpose |
| --- | --- |
| `id` | Internal database primary key |
| `public_id` | Unique `ast_` identifier |
| `user_id` | Owning Flatkey user |
| `asset_type` | `Image`, `Video`, or `Audio` |
| `status` | `Processing`, `Active`, `Expired`, or `Failed` |
| `source_status` | `Uploading`, `Available`, `DeletePending`, `Expired`, or `Unavailable` |
| `storage_backend` | `gcs` for new assets |
| `storage_bucket` | GCS bucket name |
| `object_key` | Private GCS object key |
| `content_type` | Validated media type |
| `size_bytes` | Validated object size |
| `sha256` | Integrity checksum |
| `last_used_at` | Last successful asset reference use |
| `source_expires_at` | Source cleanup eligibility timestamp |
| timestamps | Creation and update times |

An asset is publicly `Active` when its source is available or at least one active
binding remains usable. It becomes `Expired` only when the source is unavailable
and no active binding remains.

### `asset_bindings`

`asset_bindings` owns provider materialization state.

| Field | Purpose |
| --- | --- |
| `id` | Internal database primary key |
| `asset_id` | Foreign key to `assets` |
| `channel_id` | Flatkey channel that owns the upstream asset namespace |
| `upstream_group_id` | Optional upstream asset group |
| `upstream_asset_id` | Provider asset identifier |
| `status` | `Creating`, `Processing`, `Active`, or `Failed` |
| `error_code` | Sanitized internal failure category |
| `attempt_count` | Binding attempts |
| `lease_owner` | Multi-node worker claim owner |
| `lease_expires_at` | Stale claim recovery boundary |
| timestamps | Creation and update times |

A unique constraint on `(asset_id, channel_id)` prevents duplicate provider
assets during concurrent requests. Version one requires every asset-capable
channel to have one stable upstream asset namespace. A channel that rotates
between unrelated provider accounts is not eligible for public asset references.

The current BytePlus asset group table may remain provider-specific. It is an
implementation detail used while creating a BytePlus binding.

## GCS Storage

Production and staging use dedicated private buckets, separate from the existing
two-day `temp-media` buckets:

- `vocai-gemini-prod-flatkey-assets`
- `vocai-gemini-prod-flatkey-assets-staging`

The buckets use uniform bucket-level access, public access prevention, and the
existing runtime service accounts. Objects use opaque paths such as
`assets/{user_id}/{yyyyMMdd}/{public_id}/{random}.{ext}` and never include the
original filename or other user-provided identifiers.

Upstream providers receive short-lived signed GET URLs generated just in time.
The initial signed URL lifetime is one hour. Signed URLs and provider credentials
are never stored in the database or task payload.

The default source retention is 30 days after the last successful use and is
configurable by environment. A database-backed cleanup worker is authoritative:

1. Claim expired source rows using a database lease.
2. Delete the GCS object idempotently.
3. Mark the source `Expired` only after GCS confirms deletion or absence.
4. Recompute the public asset status from remaining active bindings.

GCS soft delete provides recovery from accidental deletion but is not the public
retention contract. Storage bytes, operation counts, signed URL downloads, and
provider egress bytes must be monitored separately.

## Request Flow

### Asset creation

1. Authenticate the token and validate model access when a compatibility model
   field is supplied.
2. Validate declared type, detected MIME type, extension, and size.
3. Generate the public `ast_...` ID and create an `assets` row in `Processing`.
4. Stream the source into the Flatkey GCS asset bucket or validate a completed
   direct upload.
5. Persist object metadata and checksum, then transition the source and asset to
   `Available` and `Active`.
6. Return only Flatkey identity and public lifecycle fields.

No provider channel is selected during this flow.

### Generation task creation

1. Parse the reusable request body and collect strict `asset://ast_...` media
   references.
2. Validate ownership, public status, media field/type compatibility, and token
   model access.
3. Generate a Flatkey task ID and persist a local task with status `QUEUED` and
   internal stage `preparing_assets` before calling an upstream provider.
4. Reserve billing exactly once using the existing billing idempotency boundary.
5. Return the local task ID to the client.

If billing reservation fails, the task is marked failed and the create request
returns the synchronous billing error; it does not return a queued task.

The persisted preparation payload contains normalized Flatkey asset IDs and the
original request fields required for submission. It never contains a signed GCS
URL or upstream credential.

### Binding-aware channel selection

The preparation worker builds the normal candidate set from model, user group,
enabled ability, channel status, concurrency, and cooldown rules. It then applies
asset eligibility and readiness:

1. Reject a channel that cannot create or consume every referenced asset type.
2. Prefer candidates where every required binding is `Active`.
3. Next prefer candidates with some active bindings and a recoverable GCS source
   for every missing binding.
4. Finally allow candidates with no bindings when every source is recoverable.
5. Within the same readiness class, retain Flatkey priority, weight, concurrency,
   and affinity behavior.

All assets in one generation request must resolve on one selected channel.

### Binding creation and upstream submission

1. For each missing binding, insert or claim `(asset_id, channel_id)` using the
   unique constraint and lease fields.
2. Generate a one-hour GCS signed GET URL and invoke the selected provider's
   asset creation API.
3. Poll or consume provider status until every binding is `Active` or the bounded
   preparation deadline is reached.
4. Rewrite each public `asset://ast_...` reference to its selected upstream asset
   URI in memory.
5. Submit the generation request and persist `channel_id` and upstream task ID.
6. Transition the task from `QUEUED` to the provider-derived submitted state.
7. Update `last_used_at` and extend `source_expires_at` only after successful
   upstream submission.

Before upstream acceptance, a recoverable channel or binding failure may select
another eligible channel. After upstream acceptance, task polling and billing
remain pinned to that channel.

## Concurrency and Idempotency

Production is multi-node. Correctness must not depend on process-local locks.

- Asset IDs and upload session IDs have database unique constraints.
- Binding creation uses `(asset_id, channel_id)` uniqueness plus a renewable
  database lease.
- Task preparation uses a database claim with stale lease recovery.
- Provider create requests use a stable idempotency key when the provider
  supports one.
- A worker that loses its lease must stop before making another provider write.
- Billing reservation, refund, and settlement reuse the task's stable public ID
  and existing idempotency controls.
- Concurrent tasks may wait on one binding; they must not create duplicates.

## Errors and Public Status

Synchronous validation errors use the existing OpenAI-compatible envelope.
Stable public codes include:

- `invalid_asset_request`
- `asset_not_found`
- `asset_not_ready`
- `asset_expired`
- `asset_type_mismatch`
- `asset_channel_unavailable`

Provider names, hosts, request IDs, upstream asset IDs, and raw errors remain
internal. Once a local task ID has been returned, preparation failures transition
the task to `failed`, store a sanitized reason, and refund any reserved billing.
Public task status remains `queued`, `in_progress`, `completed`, or `failed`;
`preparing_assets` is internal only.

## Legacy BytePlus Migration

Existing BytePlus assets are already pinned to a channel and their original
source URL was not persisted. Migration therefore preserves capability without
inventing recoverability:

1. Create an `assets` row with the existing public `ast_...` ID and owner.
2. Set `source_status` to `Unavailable` and leave GCS fields empty.
3. Create one `asset_bindings` row from the existing channel, group, upstream ID,
   status, and timestamps.
4. Keep the asset usable on that active binding.
5. Do not route it to another channel unless the client uploads a new source.

During rollout, public reads support both schemas until migration verification is
complete. New writes use only the generalized schema. Existing public IDs and
request bodies do not change.

## Security and Privacy

- Validate remote source URLs against the existing SSRF protections before
  ingestion.
- Re-resolve and validate redirects; reject private, loopback, and disallowed
  address ranges.
- Detect MIME type from bytes and reject declared/detected type mismatches.
- Keep GCS objects private and generate signed URLs only for bounded operations.
- Scope every asset query by `user_id` before returning status or resolving a
  reference.
- Never log source signed URLs, credentials, or upstream asset identifiers in
  public logs.
- Apply per-token upload rate limits and per-user stored-byte limits.
- Deleting a user schedules deletion of owned GCS sources and provider bindings.

## Observability

Metrics must distinguish storage and routing costs:

- source upload count, bytes, latency, and failures by asset type
- active and expired source bytes
- signed URL creation and GCS download/egress estimates
- binding creation latency and status by internal channel type
- binding cache hit rate
- task preparation latency and queue depth
- fallback channel attempts before upstream acceptance
- cleanup candidates, deletions, retries, and orphan detection

Logs use Flatkey request, task, and public asset IDs. Provider details remain in
restricted internal logs only.

## Test Strategy

1. Controller tests cover URL creation, multipart compatibility, direct upload
   completion, authentication, size limits, MIME validation, and response shape.
2. Service tests mock GCS upload, metadata, signed URL, and delete behavior.
3. Model tests verify migrations and constraints on SQLite, MySQL, and PostgreSQL.
4. Concurrency tests prove one binding is created across competing router nodes
   and that stale leases recover safely.
5. Routing tests cover all-active preference, partial binding, new binding,
   multiple assets, expired sources, disabled channels, and fallback before
   upstream acceptance.
6. Billing tests cover one reservation, preparation failure refund, successful
   settlement, and worker retry idempotency.
7. Adapter tests verify public-to-upstream URI rewriting without provider leakage.
8. Migration tests preserve existing BytePlus public IDs and pinned usability.
9. Staging integration tests upload an image and video to GCS, create bindings,
   submit generation tasks, poll results, and verify cleanup behavior.

## Rollout Boundaries

1. Provision dedicated staging and production GCS buckets and least-privilege IAM.
2. Add generalized schema and dual-read migration support.
3. Enable new GCS-backed uploads in staging.
4. Enable asynchronous task preparation and binding-aware routing in staging.
5. Migrate legacy BytePlus rows and verify counts and active binding parity.
6. Enable new writes in production behind a runtime flag.
7. Monitor preparation failures, binding hit rate, GCS bytes, and egress before
   removing legacy reads.

Router deployment is required because the design changes `/v1` asset handling,
distribution middleware, task creation, provider adapters, billing timing, and
the database schema used by router requests. Console deployment is required only
if direct upload UI is added. Terraform or equivalent GCP provisioning is
required for the new buckets and IAM; the public website is not involved.

## Acceptance Criteria

1. A newly uploaded GCS-backed asset returns one Flatkey `ast_...` identity.
2. The same identity can create active bindings on two eligible channels without
   changing the client request.
3. A repeat request prefers a channel where all bindings are already active.
4. Multiple referenced assets always resolve on one channel.
5. Channel fallback works before upstream task acceptance and never after it.
6. A legacy BytePlus asset remains usable on its original channel after migration.
7. An expired source with no active binding returns `asset_expired` without
   leaking provider details.
8. Concurrent router instances create at most one binding for an asset/channel.
9. Preparation failure produces a failed task and exactly one billing refund.
10. No signed GCS URL or upstream asset ID is persisted in public task data or
    returned to clients.
