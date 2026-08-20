# Channel 106 Audio Materialization Review Fixes Design

Date: 2026-08-20

Status: Approved

## Background

PR #753 added channel-configured TokenSpace materialization for Image and Video.
Its original design deliberately excluded Audio. Live validation after merge
proved that TokenSpace accepts Image, Video, and Audio assets and reaches
`Active` for all three, while Flatkey still rejects Audio before the provider
call. The same validation also confirmed that the public router has not yet
deployed PR #753; deployment remains separate from this code change.

The PR review identified one additional regression in the legacy TechMobi
processing path: malformed explicit materialization settings currently suppress
the historical rematerialization fallback. The reviewer also requested a
Seedance proxy binding-scope migration, but the origin-only explicit-provider
scope never reached production before the path-scoped implementation merged, so
there is no production scope population to migrate.

## Goals

1. Extend only the `tokenspace_material` provider to materialize Audio through
   the existing Flatkey asset library and binding lifecycle.
2. Rewrite exact `asset://ast_...` Audio references in the Doubao Seedance
   adaptor using the same private rewrite map as Image and Video.
3. Preserve ordinary HTTPS audio passthrough and reject missing or empty rewrite
   entries before an upstream request.
4. Restore legacy TechMobi rematerialization when explicit provider settings
   cannot be parsed.
5. Keep all behavior multi-node safe by reusing the existing database lease,
   binding scope, CAS, readiness, and retry boundaries.

## Non-goals

1. Enabling Audio for `seedance_proxy`; its existing Image/Video contract stays
   unchanged.
2. Automatically repairing the production `abilities` table or coverage
   targets. The observed `channel_id=0` retry loop is operational state and has
   not been reproduced as a code defect.
3. Deploying production router or console services.
4. Creating, deleting, or exposing TokenSpace groups or upstream asset IDs.
5. Adding a legacy Seedance proxy scope migration without evidence that the old
   explicit-provider scope exists in production.

## Selected Design

### TokenSpace Audio capability

`tokenSpaceMaterialNormalizeType` will accept `Audio` in addition to `Image`
and `Video`. The request continues to send the provider's documented
`AssetType` literal and uses the existing Action API, credential-scoped binding
identity, and status mapping.

`channelCanConsumeAssetType` will distinguish provider capabilities:

- `seedance_proxy`: Image and Video.
- `tokenspace_material`: Image, Video, and Audio.
- unknown explicit providers: no asset types.

This keeps the prior provider boundary while allowing the existing readiness
worker to create Audio bindings for a valid TokenSpace channel.

### Seedance request rewriting

The Doubao adaptor will traverse `ImageURL`, `VideoURL`, and `AudioURL` fields.
For each field it will:

1. Leave ordinary non-Flatkey URLs unchanged.
2. Reject malformed `asset://ast_...` references.
3. Require an exact non-empty rewrite-map entry for a strict Flatkey asset URI.
4. Replace only the media URL value; text content remains untouched.

The shared resolver already extracts and type-checks Audio references, so no
second resolution path or public API change is introduced.

### Legacy TechMobi processing fallback

`assetBindingRequiresRematerializationFromProcessing` will return `true` for a
TechMobi channel when explicit provider configuration parsing fails. A valid
explicit provider continues to refresh the stored upstream asset through
`GetAsset`; a legacy channel or malformed explicit configuration rematerializes
from the recoverable Flatkey source.

This restores the pre-PR fallback without changing valid TokenSpace or Seedance
proxy processing behavior.

## Review Comment Disposition

- Audio rewrite: implemented as a complete TokenSpace Audio capability rather
  than an adaptor-only rewrite.
- TechMobi malformed-config fallback: implemented.
- Seedance proxy scope migration: not applicable because the reviewed
  origin-only explicit-provider version was not deployed to production.
- Admin visibility, unknown provider preservation, and explicit-provider
  override semantics: existing protections and intentional compatibility
  behavior remain unchanged.
- Prompt Gallery findings: excluded because those files were inherited from the
  PR base and are absent from PR #753's final diff.

## Testing

Development follows red-green TDD:

1. TokenSpace provider test proves Audio reaches the HTTP boundary with
   `AssetType: Audio` and no longer returns a definitive local rejection.
2. Capability tests prove TokenSpace accepts Audio while Seedance proxy still
   rejects it.
3. Worker/binding tests prove Audio can create a TokenSpace binding through the
   real materializer seam.
4. Doubao adaptor tests prove exact Audio rewrite, missing-map rejection,
   ordinary HTTPS passthrough, and text preservation.
5. TechMobi test proves malformed explicit configuration rematerializes instead
   of trying to refresh an opaque historical upstream ID.
6. Existing TokenSpace, Seedance proxy, asset reference, model target, and
   Doubao suites remain green; `go build ./...` verifies integration.

## Deployment Recommendation

- Router deploy: required. Audio reference rewriting and provider binding logic
  execute on `/v1` relay paths.
- Other deploy targets: `newapi-console` is required because it runs the shared
  readiness worker and asset API. `newapi-web`, Terraform, and Cloudflare are
  not involved.
- Database migration: none.
- Production validation: deploy both Go services, repair/rebuild channel 106
  ability state separately if it still resolves to `channel_id=0`, then rerun
  Image, Audio, and Video asset smoke tests.

## Acceptance Criteria

1. A Flatkey Audio asset can materialize through a valid
   `tokenspace_material` channel and be polled to Active.
2. Exact Audio references are rewritten before Doubao submission; ordinary
   HTTPS audio remains unchanged.
3. Seedance proxy remains Image/Video-only.
4. Malformed explicit settings on legacy TechMobi processing bindings trigger
   rematerialization.
5. No public schema, database schema, group lifecycle, or customer-visible
   upstream identity changes.
6. No production credential, group ID, signed URL, or upstream asset ID enters
   source, tests, commits, logs, or PR text.
