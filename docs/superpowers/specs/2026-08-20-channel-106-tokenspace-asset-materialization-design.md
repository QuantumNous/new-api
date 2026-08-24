# Channel 106 TokenSpace Asset Materialization Design

Date: 2026-08-20

Status: Approved for written-spec review

## Summary

Channel 106 will keep using the existing Flatkey asset library and public
`asset://ast_...` references after its upstream was moved to TokenSpace.
Flatkey will materialize each owned source asset into one pre-created internal
TokenSpace AIGC group, persist the private channel binding, and rewrite only the
selected upstream video request to `asset://<TokenSpace asset id>`.

Customers will not create, select, list, or see the TokenSpace group. The
application runtime will not create groups. Operations will reuse the dedicated
group that was already created today, after confirming it belongs to the same
API credential; if it is absent, operations may create exactly one replacement
before enabling the channel setting.

## Goals

1. Reuse the current Flatkey `/v1/assets`, GCS source storage, ownership checks,
   binding leases, readiness workers, and rewrite-map flow.
2. Add a TokenSpace provider implementation for its documented Action-based
   material API without changing the public Flatkey asset schema.
3. Configure channel 106 through the existing channel capability fields rather
   than hard-coding its database ID, channel type, host, key, or group ID.
4. Support Image and Video assets used by the current Seedance request flow.
5. Keep the implementation correct across multiple router and console nodes.

## Non-goals

1. A customer-facing TokenSpace group or asset-management interface.
2. Automatic group creation, repair, deletion, or rotation by the application.
3. A second Flatkey asset library or a provider-specific public asset ID.
4. Audio materialization in this change.
5. Deleting or updating the TokenSpace copy when the Flatkey source changes.
6. Changing channel 106's video task request, billing, result-delivery, or
   model-mapping behavior.

## Confirmed Product Contract

- One internal AIGC group is pre-created for channel 106 and shared by the
  Flatkey materialization flow.
- Customers upload through the existing Flatkey asset API and continue to use
  the existing provider-neutral `asset://ast_...` identity.
- Flatkey remains the authorization boundary. TokenSpace group membership is
  not used to authorize customers.
- The TokenSpace group ID, asset ID, gateway host, and credential stay private.
- One Flatkey asset may retain separate bindings for different channels or
  credentials.

## Selected Approach

Extend the channel-configured materializer seam already implemented by the
channel 156 asset-materialization work. Register a new provider key,
`tokenspace_material`, alongside `seedance_proxy`. Reuse the existing channel
setting shape:

```json
{
  "asset_materialization": {
    "provider": "tokenspace_material",
    "gateway_base_url": "https://asset-api.example.invalid",
    "group_id": "group_internal_aigc"
  }
}
```

The example is deliberately non-production. The live URL, group ID, and token
must never be committed.

An explicit provider remains fail-closed. Empty provider settings preserve the
legacy BytePlus and TechMobi behavior. The existing channel API key is reused
for Bearer authorization; no second secret field is introduced.

The provider binding scope is credential-scoped and versioned:

```text
tokenspace-material:v1:<sha256(normalized-origin + NUL + group-id + NUL + api-key)>
```

Changing the key, origin, or group safely produces a new binding. Changing
only the channel type or public model name does not.

## Provider API Contract

The provider implements the two operations required by the existing
`AssetMaterializer` interface.

### Create asset

```http
POST <gateway-base-url>/api/material?Action=CreateAsset
Authorization: Bearer <channel key>
Content-Type: application/json
```

```json
{
  "GroupId": "<configured group>",
  "URL": "<short-lived signed Flatkey source URL>",
  "Name": "<opaque non-sensitive name>",
  "AssetType": "Image"
}
```

The provider reads `Result.Id`, persists it immediately through the existing
binding flow, and returns provider-local `Processing` because the create
response does not include an authoritative terminal status.

### Get asset

```http
POST <gateway-base-url>/api/material?Action=GetAsset
Authorization: Bearer <channel key>
Content-Type: application/json
```

```json
{
  "Id": "<persisted upstream asset id>"
}
```

Status mapping:

| TokenSpace status | Flatkey binding status |
| --- | --- |
| `Active` | `Active` |
| `Pending` or `Processing` | `Processing` |
| `Failed` | `Failed` |
| empty or unknown | retryable protocol failure |

Both HTTP failures and `Result.Error` inside an HTTP 200 response are errors.
The implementation will classify 429, timeout, 5xx, retryable processing, and
definitive 4xx/business failures through the existing
`AssetMaterializeFailure` taxonomy.

## Data Flow

1. A customer uploads an Image or Video through the existing Flatkey asset API.
2. Flatkey validates ownership and source metadata and keeps the durable source
   in its current private GCS store.
3. The existing readiness worker selects channel 106 after validating its
   explicit `tokenspace_material` configuration.
4. The binding lease owner signs a short-lived GCS URL and calls TokenSpace
   `CreateAsset` with the pre-created group ID.
5. Flatkey persists the returned upstream asset ID before polling `GetAsset`.
6. After the binding becomes Active, the existing reference resolver produces
   the private rewrite map for the selected channel.
7. The existing Seedance task adaptor replaces exact Flatkey media references
   with `asset://<TokenSpace asset id>` only in media URL fields.
8. Ordinary HTTPS media URLs and unrelated channels remain unchanged.

## Multi-node, Retry, and Idempotency Behavior

The existing database uniqueness, binding scope, lease ownership, CAS updates,
and retry schedule remain authoritative. No process-local lock or startup-only
initialization is added.

The upstream ID is stored before status polling so retries call `GetAsset`
instead of creating another asset. The database lease and a stable
idempotency key are sent when supported, but the unavoidable crash window
between upstream acceptance and local persistence remains an operational risk.
Logs may include Flatkey correlation IDs and a sanitized provider error class,
but never the signed URL, key, group ID, or upstream asset ID.

## Security and Privacy

1. Customer reads and references remain scoped by Flatkey `user_id`.
2. The configured gateway must be absolute HTTPS without userinfo, query,
   fragment, path traversal, or an unexpected scheme.
3. Response bodies are bounded before decoding.
4. The API key and signed source URL are never persisted or logged.
5. `Result.Error.Message` is sanitized before entering internal failure state
   and is not returned verbatim to customers.
6. The credential pasted in chat must be rotated after live validation.

## Testing Strategy

Development follows red-green TDD.

1. Provider descriptor tests prove explicit selection, fail-closed invalid
   configuration, stable binding scopes, and legacy fallback compatibility.
2. HTTP contract tests prove both Action URLs, Bearer authorization, JSON field
   names, bounded responses, and absence of credentials from errors.
3. Create/Get tests cover Image and Video, Audio rejection, `Result.Error` in
   HTTP 200, 4xx, 429 with bounded `Retry-After`, 5xx, timeout, malformed JSON,
   and oversized bodies.
4. Status tests accept both documented in-progress spellings (`Pending` and
   `Processing`) and fail closed on unknown values.
5. Binding tests prove create-result persistence, polling without duplicate
   creation, credential/group/origin rematerialization, and cross-node lease
   safety.
6. Reference and adaptor tests prove exact media-field rewriting, missing-map
   rejection, ordinary HTTPS pass-through, and no customer-visible upstream
   identifiers.
7. Regression tests keep BytePlus, legacy TechMobi, `seedance_proxy`, and
   source-URL paths unchanged.

## Operational Activation

After the code is merged and deployed to staging:

1. Use `ListAssetGroups` with the configured TokenSpace credential to locate
   the dedicated AIGC group created today.
2. Verify the group is accessible to the same credential used by channel 106.
3. If no dedicated group exists, create one once through operations; the
   application runtime still does not create groups.
4. Configure channel 106 with provider `tokenspace_material`, the material API
   base URL, and the verified group ID while preserving all unrelated channel
   settings.
5. Upload one non-sensitive image and one short video through Flatkey, wait for
   Active bindings, and submit reference-media video requests.
6. Confirm another user cannot resolve the same Flatkey asset and that logs and
   responses contain no TokenSpace secret, host, group ID, or asset ID.

Production activation follows the same configuration only after staging passes.
Clearing `asset_materialization.provider` disables this capability without a
database migration; existing private bindings may remain inert.

## Deployment Recommendation

- Router deploy: required. Materialization readiness, binding resolution, and
  request rewriting affect `/v1` relay traffic.
- Other deploy targets: `newapi-console` is required for the shared backend and
  administrator channel settings. `newapi-web`, Terraform, Cloudflare, and the
  decommissioned legacy service are not involved.
- Database migration: none.

## Rejected Alternatives

1. Modify the legacy TechMobi multipart uploader when the host matches
   TokenSpace. Rejected because it couples behavior to a hostname and risks
   breaking real TechMobi channels.
2. Hard-code `channel.Id == 106`. Rejected because environment IDs differ and
   configuration must survive channel replacement.
3. Expose TokenSpace groups and assets as a second customer library. Rejected
   because the confirmed product contract keeps customers on the current
   Flatkey library.
4. Create a group automatically at application startup or on first upload.
   Rejected because production is multi-node and the group is an operations
   resource, not customer state.
5. Send signed GCS URLs directly to video generation instead of creating an
   upstream asset. Rejected because the requested flow uses the provider asset
   library and stable `asset://` references.

## Acceptance Criteria

1. Existing Flatkey asset upload and response contracts do not change.
2. Channel 106 materializes Image and Video sources into the configured
   pre-created TokenSpace group.
3. A returned TokenSpace asset ID is persisted privately and polled until
   Active without duplicate creation on ordinary retries.
4. Active bindings are rewritten only inside the selected upstream request.
5. Customers never see or supply the TokenSpace group, asset ID, origin, or
   credential.
6. `Pending` and `Processing` both remain retryable; HTTP-200 business errors
   and terminal failures fail closed.
7. Missing or invalid provider configuration does not affect ordinary
   URL-based video requests.
8. Existing BytePlus, TechMobi, Seedance Proxy, and non-asset video flows pass
   regression tests.
9. Multi-node execution uses the existing binding lease/CAS boundary and does
   not depend on process-local state.
10. No production secret or identifier is present in source, tests, commits,
    logs, or verification artifacts.
