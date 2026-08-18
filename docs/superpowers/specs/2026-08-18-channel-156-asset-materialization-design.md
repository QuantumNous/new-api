# Channel 156 Asset Materialization Design

Date: 2026-08-18

Status: Approved for written-spec review

## Summary

Channel 156 will join the existing Flatkey asset-library pipeline. Clients keep
uploading and referencing the same Flatkey assets through `/v1/assets` and
`asset://ast_...`. Flatkey keeps the durable source in GCS, materializes that
source into the channel's upstream asset library, stores the private mapping in
the existing `asset_bindings` table, and rewrites references only inside the
selected upstream request.

The upstream asset-group feature is not exposed to customers. Operations will
pre-create one shared internal AIGC group and configure its ID on the channel.
Flatkey will neither create nor manage upstream groups in this integration.

## Goals

1. Reuse the current Flatkey asset API, GCS source storage, readiness workers,
   binding leases, status projection, and request rewrite map.
2. Materialize Flatkey image and video assets through channel 156's asset
   gateway and persist the returned upstream asset ID.
3. Keep the public contract provider-neutral: clients see only Flatkey asset
   IDs and never see the upstream group ID, asset ID, host, or credentials.
4. Select the materializer through explicit channel capability configuration,
   not a hard-coded channel ID or `Channel.Type` value.
5. Preserve correctness across multiple router and console instances.
6. Keep the three verified video models compatible with the same asset flow:
   `seedance-2.0`, `seedance-2.0-fast`, and `seedance-2.0-mini`.

## Non-goals

1. Customer-facing upstream asset-group creation, listing, selection, update,
   or deletion.
2. Automatic creation or repair of the shared upstream AIGC group.
3. A second Flatkey asset library or a channel-specific public asset ID.
4. Audio materialization for this provider.
5. Upstream asset update/delete synchronization.
6. Hard-coding channel ID 156, its current type, gateway origin, group ID, or
   API token in source code.
7. Changing the public `/v1/assets` response schema.

## Confirmed Product Contract

- The customer uploads once to the existing Flatkey asset library.
- Flatkey owns and authorizes the public `asset://ast_...` reference.
- The source object remains in the existing private GCS asset store.
- Channel 156 uses one operations-managed AIGC group shared by all Flatkey
  customers.
- Customer isolation is enforced by Flatkey's `assets.user_id` ownership checks;
  the shared upstream group is not an authorization boundary.
- One Flatkey asset may have separate private bindings for multiple channels.
- The current channel type may change later without invalidating this provider
  configuration or existing bindings on the same channel row.

## Channel Configuration

Add a nested, admin-only channel setting to `Channel.OtherSettings`, the
database `settings` JSON represented by `dto.ChannelOtherSettings`. It must not
be stored in `Channel.Setting`, `Channel.Other`, or `ChannelInfo`:

```json
{
  "asset_materialization": {
    "provider": "seedance_proxy",
    "gateway_base_url": "https://asset-gateway.example.invalid",
    "group_id": "grp_shared_aigc"
  }
}
```

The example values are deliberately non-routable and contain no production
configuration.

Rules:

1. An empty provider disables explicit asset materialization and preserves the
   existing type-based BytePlus and TechMobi behavior.
2. `seedance_proxy` requires an absolute HTTPS gateway URL and a non-empty group
   ID. Invalid or incomplete settings make the channel ineligible for Flatkey
   asset references but do not disable ordinary URL-based video requests.
3. The existing channel API key is reused for gateway authorization. No second
   credential field is introduced.
4. Every enabled key on the channel must have access to the configured shared
   group. Bindings remain credential-scoped so a misconfigured key cannot reuse
   an asset created under another credential.
5. These settings are available only through the existing administrator channel
   configuration surface. They are absent from customer asset and video APIs.

Backend serialization uses `dto/channel_settings.go` and the existing
`model.Channel.GetOtherSettings` / `SetOtherSettings` path. The administrator
form extends `web/default/src/features/channels/types.ts`,
`lib/channel-form.ts`, and `components/drawers/channel-mutate-drawer.tsx`, with
round-trip coverage in `lib/channel-form.test.ts`. New labels and validation
messages follow the existing eight-locale channel-form i18n contract.

## Materializer Resolution

Introduce a channel-aware resolver while retaining compatibility with existing
materializers:

1. If `asset_materialization.provider` is present, resolve a provider-keyed
   materializer and validate its settings.
2. If no explicit provider is configured, fall back to the existing
   channel-type registry for BytePlus and TechMobi.
3. Unknown explicit providers fail closed; the resolver must not silently fall
   back to a type materializer after an administrator selected an unsupported
   provider.

The implementation changes every materializer lookup to accept the complete
channel rather than only `channel.Type`. This includes target eligibility in
`asset_model_target.go`, binding creation and refresh in `asset_binding.go`, and
materialization-option resolution. Legacy type fallback remains inside that one
resolver instead of being repeated at its callers.

No resolver branch may test `channel.Id == 156`. The provider setting stays on
the channel row when its `Type` changes, so materialization and existing binding
lookup remain stable. Wire-format rewriting remains the selected task adaptor's
responsibility; a future type using a different adaptor must consume the same
generalized rewrite map.

## Binding Identity

The existing `asset_bindings` table remains authoritative. No group table or
schema migration is needed.

The provider binding scope is a versioned digest of the normalized gateway
origin, configured group ID, and selected API credential:

```text
seedance-proxy:v1:<sha256(gateway-origin + NUL + group-id + NUL + api-key)>
```

Only the digest is persisted; the credential is never written to the binding or
logs. The scope intentionally excludes `Channel.Type` and the public model name:

- changing only the channel type keeps the same binding;
- different keys cannot accidentally reuse an upstream asset across tenants;
- rotating a key safely creates a new binding, even when the group ID text is
  unchanged;
- the three supported models reuse one active upstream asset;
- changing the gateway or group produces a new scope and safe rematerialization.

The table's existing `(asset_id, channel_id, binding_scope)` uniqueness, lease,
CAS, retry, and stale-owner recovery remain the multi-node coordination
boundary. `upstream_group_id` is copied into each binding for audit and recovery;
`upstream_asset_id` stores the ID returned by the gateway.

## Data Flow

### Upload and source activation

1. The client uses the existing Flatkey upload flow.
2. Flatkey authenticates the caller, validates ownership/type/size/MIME, and
   stores the source object in GCS through the current asset service.
3. Flatkey creates or activates the existing `assets` row and returns the same
   provider-neutral `asset://ast_...` identity.
4. Existing model-coverage/readiness work discovers eligible channels. Channel
   156 is eligible only when its explicit materializer configuration is valid
   and the asset type is Image or Video.

### Upstream materialization

1. The existing worker claims the exact binding with a database lease.
2. It generates a short-lived signed HTTPS URL for the GCS source using the
   current `SignSource` callback. The signed URL is never persisted.
3. The new materializer sends `POST /api/seedance/proxy/assets` with the
   configured `GroupId`, signed `URL`, normalized `AssetType`, and an opaque
   non-sensitive `Name`.
4. It stores `Result.Id` immediately. The Seedance Proxy materializer maps an
   empty create-response status to `Processing` before returning the result.
   This provider-local default must not change the existing generic
   `createLeasedAssetBinding` empty-status behavior used by other providers.
5. The existing worker calls `GET /api/seedance/proxy/assets/{asset_id}` until
   the binding becomes `Active`, reaches `Failed`, or returns to the normal
   retry schedule.

### Video submission

1. The existing asset-reference parser validates strict Flatkey URIs, caller
   ownership, asset type, and selected-channel readiness.
2. The distributor resolves or refreshes the generalized rewrite map for the
   selected channel and binding scope.
3. The Doubao task adaptor replaces only exact Flatkey `asset://ast_...`
   references with `asset://<upstream-asset-id>` in image/video media fields.
4. Missing rewrite entries, malformed Flatkey references, or non-Active
   bindings fail before the upstream video request is sent.
5. Ordinary HTTPS media URLs remain unchanged.

## Provider Client and Status Mapping

The provider client implements only two operations:

- create asset: `POST /api/seedance/proxy/assets`
- get asset: `GET /api/seedance/proxy/assets/{asset_id}`

It deliberately does not implement any group operation.

Status mapping:

| Upstream | Flatkey binding | Behavior |
| --- | --- | --- |
| `Processing` | `Processing` | Retry through the existing readiness schedule |
| `Active` | `Active` | Eligible for URI rewriting and video submission |
| `Failed` | `Failed` | Store a sanitized definitive failure |
| empty/unknown | no success transition | Treat as retryable protocol/upstream failure |

Only Image and Video are accepted. Audio returns the existing channel/type
incompatibility outcome and is never sent to this provider.

## Errors, Retries, and Idempotency

Reuse the existing `AssetMaterializeFailure` taxonomy:

- HTTP 429 maps to `throttled` and honors a bounded `Retry-After`;
- timeouts map to `timeout`;
- HTTP 5xx maps to `upstream_5xx`;
- upstream `Processing` maps to `upstream_processing`;
- invalid configuration, unsupported media, authentication/authorization
  rejection, and terminal `Failed` map to a sanitized definitive error;
- local serialization or database failures map to `internal` without exposing
  upstream details.

The worker persists the returned upstream asset ID before relying on subsequent
status polling. If create succeeds but status lookup fails, the binding remains
`Processing` and later retries call `GetAsset`; they must not create a second
upstream asset. Concurrent nodes reuse the existing lease/CAS and unique scope,
so only the lease owner may perform the provider write.

If the gateway does not expose a formal idempotency header, Flatkey's database
lease is the primary duplicate-prevention boundary. The unavoidable crash
window between upstream acceptance and local persistence must be logged with
the Flatkey asset/channel/request correlation IDs for restricted operations
diagnosis, without logging signed URLs, tokens, group IDs, or upstream asset IDs
in customer-visible logs.

## Security and Privacy

1. All reads and reference resolution remain scoped by Flatkey `user_id`.
2. The upstream shared group never grants one Flatkey customer access to another
   customer's asset; clients cannot query it through Flatkey.
3. Gateway URL and path construction reject non-HTTPS configuration, embedded
   credentials, query/fragment injection, and path traversal.
4. Authorization tokens and GCS signed URLs are never persisted or returned.
5. Provider response bodies are bounded and sanitized before logging.
6. The previously pasted API key must be rotated after validation and must not
   appear in source, tests, fixtures, commits, or reports.

## Admin Experience

The existing channel editor gains an internal asset-materialization section with
three fields: provider, gateway base URL, and pre-created group ID. The section
is shown only to administrators. Selecting `seedance_proxy` enables the two
required fields and validates them before save. No customer asset page gains a
group selector, upstream status, or upstream identifier.

## Testing Strategy

Development follows red-green TDD.

1. Channel-setting tests cover round-trip JSON, empty/default compatibility,
   invalid HTTPS URLs, missing group IDs, and unknown providers.
2. Resolver tests prove explicit provider precedence, fail-closed unknown
   providers, legacy type fallback, and stability across a channel-type change.
3. Provider-client tests use an HTTP test server to verify method/path/header,
   request JSON, bounded response decoding, status mapping, `Retry-After`, 4xx,
   429, 5xx, timeouts, malformed JSON, and unknown statuses.
4. Materializer tests prove Image/Video acceptance, Audio rejection, signed URL
   use without persistence, group ID propagation, empty create status becoming
   provider-local `Processing`, and create-result recovery without duplicate
   upload.
5. Binding tests prove stable scope generation, separation across API keys,
   rematerialization after credential/group/gateway change, one provider create
   under concurrent leases, and reuse by all three model names on one key.
6. Distributor tests prove configured channels become eligible, incomplete
   configurations fail closed, and existing BytePlus/TechMobi/source-URL paths
   remain unchanged.
7. Doubao adaptor tests prove exact image/video URI rewriting, multiple media
   items, ordinary HTTPS pass-through, missing-map rejection, malformed Flatkey
   reference rejection, and no audio materialization.
8. Admin UI tests cover conditional fields, validation, serialization, and
   preservation when editing unrelated channel settings.
9. Fresh verification runs affected Go package tests, frontend typecheck/build,
   GitNexus change detection, and a clean-diff scope check.

## Staging Acceptance

After automated verification and explicit staging promotion authorization:

1. Configure channel 156 with the pre-created internal group and asset gateway.
2. Upload one non-sensitive image and one short video through the existing
   Flatkey asset API.
3. Confirm each Flatkey ID gets an Active private channel binding without any
   upstream ID in the customer response.
4. Submit reference-media requests for `seedance-2.0`,
   `seedance-2.0-fast`, and `seedance-2.0-mini`.
5. Poll each task to completion and verify valid downloadable video content.
6. Verify a different user cannot resolve the same Flatkey asset.
7. Verify logs and API responses contain no API token, signed URL, group ID,
   upstream asset ID, gateway host, or supplier branding.

## Deployment and Rollback

- Router deploy: required. The change affects `/v1` asset readiness,
  distribution, binding materialization, and task-adaptor request rewriting.
- Other deploy targets: `newapi-console` is required for the shared backend and
  administrator channel fields. `newapi-web`, Terraform, and Cloudflare are not
  involved.
- Database migration: none.
- Roll out to staging first, configure the provider fields, run the acceptance
  flow, then assess production readiness.
- To disable the capability, clear the explicit provider setting. Existing
  binding rows may remain inert and do not affect ordinary URL requests.
- Rolling back application code requires clearing the explicit provider setting
  first; no schema rollback is necessary.

## Rejected Alternatives

1. **Hard-code `channel.Id == 156`.** Rejected because environments use
   different IDs and the setting would not survive channel replacement.
2. **Register only under `ChannelTypeDoubaoVideo`.** Rejected because the user
   plans to migrate the type and materialization is a channel capability, not a
   wire-format identity.
3. **Send the GCS signed URL directly to the video endpoint.** Rejected because
   the confirmed upstream contract requires an Active upstream asset ID.
4. **Create one upstream group per Flatkey user.** Rejected because group
   management is intentionally internal and one pre-created shared group is the
   confirmed operating model.
5. **Create the group automatically.** Rejected because operations will
   pre-create it, eliminating distributed one-time initialization and orphan
   group risk.
6. **Add a new `channel_asset_configs` table.** Rejected because the current
   single-provider configuration fits existing admin-only channel settings and
   does not need a schema migration.

## Acceptance Criteria

1. Existing Flatkey upload and public asset responses remain unchanged.
2. A Flatkey Image or Video asset can reach Active binding status through the
   configured channel 156 asset gateway.
3. The database stores the Flatkey asset/channel/upstream group/upstream asset
   relationship in the existing binding row.
4. All three configured Seedance 2.0 model names can reuse that binding.
5. Video requests rewrite to the upstream `asset://` URI only after Active.
6. Customer APIs and UI never expose or accept an upstream group ID.
7. Changing only `Channel.Type` does not disable provider resolution or force a
   new binding.
8. Missing/invalid configuration and upstream failures fail closed without
   affecting ordinary URL-only video requests.
9. Multi-node execution creates at most one known binding per exact scope and
   safely resumes Processing state.
10. Existing BytePlus, TechMobi, ModelAPI source-URL, and non-asset Doubao flows
    pass regression tests.
