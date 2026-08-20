# Seedance Binding Scope Capacity and Audio Design

Date: 2026-08-20

Status: Proposed for written-spec confirmation

## Background

Production asset materialization for channel 106 fails before the provider call
with MySQL error 1406 because the generated TokenSpace binding scope is 87
characters while three persisted `binding_scope` columns are `varchar(80)`.
The Seedance proxy scope used by channel 156 is 82 characters and crosses the
same schema boundary. Direct provider probes have already shown that the
TokenSpace image, audio, and video operations can become Active; the local
schema failure is therefore the current channel 106 blocker.

Channel 156 uses the existing explicit `seedance_proxy` materializer. Its first
design treated Audio as unsupported, but the current product requirement is
that the pre-created internal group accepts Image, Audio, and Video through the
same asset-library lifecycle as other grouped Seedance channels. The public
asset identity remains provider-neutral and users never select or observe the
upstream group.

The upstream account for channel 156 still needs the operator-side association
that permits group creation. That operational dependency does not block the
local schema, provider capability, request-shape, status, and retry work in this
PR.

## Goals

1. Persist every current versioned asset binding scope without truncation in
   `asset_bindings`, `asset_model_coverage_targets`, and
   `asset_model_readinesses`.
2. Migrate existing MySQL and PostgreSQL installations idempotently and keep
   SQLite-compatible startup behavior.
3. Make `seedance_proxy` accept Audio in addition to Image and Video, with no
   channel-ID branch.
4. Keep channel 156 on the existing shared asset upload, readiness, binding,
   polling, and exact `asset://` rewrite flow.
5. Preserve multi-node lease, CAS, uniqueness, retry, and credential isolation
   semantics.

## Non-goals

1. Creating the channel 156 upstream group before the upstream account is
   enabled for group operations.
2. Adding a second asset API or a channel-156-specific materialization path.
3. Exposing the upstream group ID, asset ID, gateway host, credential, or signed
   source URL to customers.
4. Changing video task creation or task-query endpoints.
5. Repairing unrelated failures already present on clean `origin/main`.

## Selected Design

### One binding-scope capacity contract

Introduce a model-level maximum of 128 characters and declare all three
`binding_scope` fields as `varchar(128)`:

- `asset_bindings.binding_scope`
- `asset_model_coverage_targets.binding_scope`
- `asset_model_readinesses.binding_scope`

The current scopes are SHA-256 identities with fixed prefixes:

| Provider | Format | Length |
| --- | --- | ---: |
| legacy TechMobi | `techmobi:v1:<64 hex>` | 76 |
| Seedance proxy | `seedance-proxy:v1:<64 hex>` | 82 |
| TokenSpace material | `tokenspace-material:v1:<64 hex>` | 87 |

`varchar(128)` preserves every current identity with room for a longer version
prefix. It is intentionally preferred over truncating hashes, which would
collapse or change binding identity, and over `varchar(191)`, which is not
needed for the current contract and consumes more bytes in the composite
`asset_bindings` unique index. At four bytes per character, 128 characters use
at most 512 bytes for the string portion and remain conservative for supported
MySQL 5.7 installations.

Tests will bind the GORM field sizes to the shared 128-character contract and
prove that every generated provider scope fits it. A future provider whose
scope exceeds the contract must change the schema and these tests deliberately;
it must not silently truncate the value.

### Idempotent startup migration

Before the regular non-SQLite `AutoMigrate` pass, startup inspects each existing
scope column. Missing tables or columns are left to `AutoMigrate`. A narrow
character column is widened through GORM's migrator; text or a character column
already at least 128 characters is left unchanged. Migration errors fail
startup with the exact table and column in the internal error.

SQLite continues through the existing ordered `AutoMigrate` path, which owns
table recreation when schema metadata changes; the implementation will not add
SQLite-only `ALTER COLUMN` SQL. Fresh databases are created directly with the
128-character model declaration.

Concurrent production instances may inspect the old schema at the same time.
The operation is a widening-only, idempotent definition change; a second
instance either waits on database DDL serialization or observes an already-wide
column. No application-level in-memory lock becomes part of correctness.

No data rewrite is required. Existing scopes are preserved byte-for-byte, and
coverage/readiness rows that previously failed to persist can be retried by the
existing worker after deployment.

### Seedance proxy Audio capability

`seedanceProxyAssetNormalizeType` will normalize `Audio` to the exact upstream
literal `Audio`, just as it already does for `Image` and `Video`. Unknown asset
types remain definitive local failures and never reach the provider.

`channelCanConsumeAssetType` will advertise Image, Audio, and Video for every
valid explicit `seedance_proxy` configuration. The decision remains keyed by
the configured provider, not `channel.Id == 156` or the legacy channel type.
Consequently, channel 156 and any other grouped Seedance proxy channel use the
same capability and cannot drift into separate workflows.

The provider request remains:

```text
POST /api/seedance/proxy/assets
Authorization: Bearer <channel credential>

{
  "GroupId": "<pre-created internal group>",
  "URL": "<short-lived signed source URL>",
  "AssetType": "Audio",
  "Name": "<opaque non-sensitive name>"
}
```

Create stores the upstream asset ID immediately and maps the provider-local
empty create status to Processing. The existing worker then polls
`GET /api/seedance/proxy/assets/{asset_id}` until Active, Failed, or the normal
retry schedule takes over. The database lease remains the duplicate-prevention
boundary across nodes.

### Shared Seedance request flow

No new request adaptor is introduced. The existing asset-reference parser
already recognizes `audio_url`, and the Doubao/Seedance adaptor already rewrites
exact Flatkey `asset://ast_...` references in image, video, and audio fields from
the selected channel's private rewrite map. Ordinary HTTPS URLs remain
unchanged, and a missing or empty rewrite entry fails before an upstream video
request is sent.

The complete channel 156 path is therefore:

1. User uploads Image, Audio, or Video through the existing Flatkey asset API.
2. Flatkey stores one private provider-neutral source asset.
3. Coverage selects channel 156 using its normal model/channel rules.
4. The shared worker claims `(asset_id, channel_id, binding_scope)`.
5. `seedance_proxy` creates the asset in the configured pre-created group and
   polls it to Active.
6. All configured Seedance models on the same channel and credential reuse the
   active binding.
7. Task submission rewrites only exact Flatkey asset references to the active
   upstream `asset://` value.

This is the same grouped Seedance materialization lifecycle used by other
explicit `seedance_proxy` channels; the channel ID is configuration data, not a
control-flow condition.

## Error and Security Behavior

- Provider 429, timeout, 5xx, Processing, authentication, and terminal failure
  behavior continues through the existing materialization error taxonomy.
- The scope digest continues to include normalized gateway location, group, and
  credential; different credentials cannot reuse one another's upstream asset.
- Credentials, signed URLs, group IDs, upstream asset IDs, and provider bodies
  are not added to customer-visible responses or logs.
- If the channel 156 upstream account still lacks group association, group
  creation remains an operational 503 and is reported separately from the code
  validation result.

## Testing Strategy

Development follows red-green TDD:

1. Model schema tests fail first while any of the three scope fields remains at
   80 and pass only when all declare the shared 128-character capacity.
2. Migration-helper tests cover narrow varchar, already-wide varchar, text,
   missing table/column, and an AlterColumn error without database-specific raw
   SQL.
3. Scope-generation tests prove TechMobi, Seedance proxy, and TokenSpace values
   all fit the model contract and retain their full prefixes and 64-character
   digests.
4. Seedance provider HTTP tests prove Audio reaches the gateway boundary as
   `AssetType: Audio`; unknown types remain blocked locally.
5. Capability tests prove a valid `seedance_proxy` channel supports Image,
   Audio, and Video regardless of channel ID/type, while incomplete and unknown
   providers fail closed.
6. Worker tests prove an Audio source creates and activates a scoped Seedance
   proxy binding without a special channel branch.
7. Existing exact audio-reference rewrite tests remain green to prove the
   provider capability joins the already-shared task-adaptor flow.
8. Run targeted model/service/Doubao tests, `go build ./...`, and the broadest
   practical regression suite. Pre-existing clean-main failures are reported
   separately and are not relabeled as caused by this PR.

## Staging and Production Acceptance

After the upstream account association and pre-created group are available:

1. Configure channel 156 with `provider=seedance_proxy`, the HTTPS gateway, and
   the internal group ID.
2. Upload one small non-sensitive image, audio clip, and video through the
   public Flatkey asset API.
3. Confirm each source gets an Active channel-156 binding and that public
   responses expose no upstream identifiers.
4. Submit Seedance requests using each format and poll tasks/content through the
   normal Flatkey endpoints.
5. Confirm every configured channel-156 Seedance model reuses the same binding
   for the same asset and credential.
6. Query production schema metadata and confirm all three `binding_scope`
   columns are at least 128 characters.

## Deployment and Rollback

- Router deploy: required. The change affects asset readiness, provider
  materialization, schema used by `/v1` asset references, and relay eligibility.
- Other deploy targets: `newapi-console` is required because it runs shared
  startup migrations, the asset API, and readiness workers. `newapi-web`,
  Terraform, and Cloudflare are not involved.
- Database migration: required and widening-only for three columns.
- Rollout order: deploy the application revision so startup widens the columns,
  verify schema and health, then run format smoke tests. No separate manual SQL
  migration is required.
- Application rollback is compatible with the wider columns. Do not narrow the
  database columns during rollback; older code can read the stored values, but
  the original write failure returns if old model tags are redeployed and its
  migration attempts to narrow them.

## Rejected Alternatives

1. **Truncate or shorten the scope digest.** Rejected because binding identity,
   credential isolation, and reuse depend on the complete versioned digest.
2. **Store a second short hash only for channel 156.** Rejected because it would
   create a channel-specific identity path and leave channel 106 broken.
3. **Branch on `channel.Id == 156`.** Rejected because channel IDs differ across
   environments and grouped Seedance channels must share one workflow.
4. **Add a separate Audio materializer.** Rejected because the upstream asset
   endpoint and lifecycle are media-type-neutral; only the type literal differs.
5. **Use `text` for scope columns.** Rejected because `asset_bindings` needs a
   bounded indexed identity and 128 characters fully covers the current
   contract.

## Acceptance Criteria

1. Full 87-character TokenSpace and 82-character Seedance proxy scopes persist
   in all three scope columns without MySQL 1406.
2. Existing scope values and `(asset_id, channel_id, binding_scope)` uniqueness
   remain intact.
3. A valid explicit `seedance_proxy` configuration supports Image, Audio, and
   Video with no channel-ID or legacy-type condition.
4. Seedance proxy Audio uses the same signed-source create, upstream status
   polling, binding reuse, readiness, and exact reference rewrite flow as Image
   and Video.
5. Invalid provider configuration and unknown asset types fail closed before a
   provider write.
6. Multi-node execution cannot create a second known binding for the same exact
   scope.
7. No upstream credential, group, asset identifier, signed URL, or supplier
   branding is exposed to customers.
8. The PR contains no production secrets and clearly records the upstream group
   association as the only remaining live channel-156 dependency.
