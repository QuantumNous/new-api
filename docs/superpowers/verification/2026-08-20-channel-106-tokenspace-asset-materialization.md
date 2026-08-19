# Channel 106 TokenSpace Asset Materialization Verification

Date: 2026-08-20

Scope: PR #753 branch `feat/channel-156-asset-materialization` at `df80cc0af5fea02048a702722134b73caacb9513`.

## Instructions Reviewed

- Root `AGENTS.md`.
- Relevant module instructions: `service/AGENTS.md`, `middleware/AGENTS.md`, `relay/channel/task/AGENTS.md`, `web/default/AGENTS.md`, `web/classic/AGENTS.md`, and `docs/AGENTS.md`.
- Plan: `docs/superpowers/plans/2026-08-20-channel-106-tokenspace-asset-materialization.md`.
- Design: `docs/superpowers/specs/2026-08-20-channel-106-tokenspace-asset-materialization-design.md`.

## Backend Regression

Command:

```powershell
go test ./dto ./service ./middleware ./relay/channel/task/doubao ./relay/channel/task/techmobi ./relay/channel/task/byteplus -count=1 -timeout=10m
```

Result: exit 1. `./dto`, `./middleware`, `./relay/channel/task/doubao`, `./relay/channel/task/techmobi`, and `./relay/channel/task/byteplus` reported `ok`. `./service` hit the known 10 minute package timeout with goroutine output; no changed TokenSpace/asset assertion failure was observed before the timeout.

Focused fallback command:

```powershell
go test ./service -run 'Test(TokenSpaceMaterialAsset|AssetMaterializerForChannelSelectsTokenSpaceMaterial|AssetBindingScopeForTokenSpaceMaterial|SeedanceProxyAsset|TokenSpaceMaterial.*AssetType|AssetModelTarget.*TokenSpace|AssetReference|SeedanceProxy)' -count=1 -timeout=5m
```

Result: exit 0, `ok github.com/QuantumNous/new-api/service 0.411s`.

## Build And Frontend Verification

```powershell
go build ./...
```

First result: exit 1 because `web/classic/dist` was absent in the worktree (`pattern web/classic/dist: no matching files found`). This was an embedded-asset prerequisite, not a compile error in the TokenSpace implementation.

Prerequisite command:

```powershell
bun run build
```

Run from `web/classic`. Result: exit 0, Rsbuild completed in 5.79s and produced `dist/`.

Retry:

```powershell
go build ./...
```

Result: exit 0.

```powershell
bun test --run src/features/channels/lib/channel-form.test.ts
```

Run from `web/default`. Result: exit 0, 29 pass, 0 fail, 61 assertions.

```powershell
bun run typecheck
```

Run from `web/default`. Result: exit 0.

```powershell
bun run build
```

Run from `web/default`. Result: exit 0, Rsbuild completed in 7.58s.

```powershell
bun run i18n:sync
```

Run from `web/default`. Result: exit 0. `_sync-report.json` reported zero missing and zero extra keys for all eight locale files. Existing untranslated reports remain for unrelated prompt-gallery/model-blacklist strings in `fr`, `ja`, `ru`, and `vi`; `TokenSpace material` is present in all eight locale files and is not reported untranslated.

```powershell
git diff --check origin/main...HEAD
```

Result: exit 0.

## Mutation Checks

Mutation 1: temporarily removed `Pending` from `tokenSpaceMaterialNormalizeStatus` using `apply_patch`.

Red command:

```powershell
go test ./service -run '^TestTokenSpaceMaterialAssetGetMapsKnownStatuses$' -count=1
```

Red result: exit 1. The `Pending` subtest failed with `Received unexpected error: asset upstream request failed`, proving the status test covers the `Pending` mapping.

Restore: restored the `Pending` branch using `apply_patch`.

Green command:

```powershell
go test ./service -run '^TestTokenSpaceMaterialAssetGetMapsKnownStatuses$' -count=1
```

Green result: exit 0, `ok github.com/QuantumNous/new-api/service 0.392s`.

Mutation 2: temporarily changed the HTTP-200 `Result.Error` branch so business errors were only handled for HTTP >= 400, using `apply_patch`.

Red command:

```powershell
go test ./service -run '^TestTokenSpaceMaterialAssetClassifiesHTTPAndProtocolFailures$/^business_failure$' -count=1
```

Red result: exit 1. The `business_failure` subtest changed from expected `definitive` to actual `upstream_processing`, proving the test covers HTTP-200 business-error classification.

Restore: restored the HTTP-200 business-error branch using `apply_patch`.

Green command:

```powershell
go test ./service -run '^TestTokenSpaceMaterialAssetClassifiesHTTPAndProtocolFailures$/^business_failure$' -count=1
```

Green result: exit 0, `ok github.com/QuantumNous/new-api/service 0.314s`.

Post-restore focused command:

```powershell
go test ./service -run 'Test(TokenSpaceMaterialAsset|AssetMaterializerForChannelSelectsTokenSpaceMaterial|AssetBindingScopeForTokenSpaceMaterial|SeedanceProxyAsset|TokenSpaceMaterial.*AssetType|AssetModelTarget.*TokenSpace|AssetReference|SeedanceProxy)' -count=1 -timeout=5m
```

Result: exit 0, `ok github.com/QuantumNous/new-api/service 0.411s`.

## GitNexus And Scope Fallback

Command:

```powershell
npx gitnexus detect-changes --scope compare --base-ref origin/main --repo new-api
```

Result: exit 0, but non-authoritative. GitNexus reported that the `new-api` index was built at sibling worktree `E:\workspace\new-api-worktrees\fix-channel-max-concurrency-zero`, the current cwd is a sibling clone whose HEAD differs from the indexed commit, and FTS extension loading failed because the database file version is 42 while the current build storage version is 40. It then printed `No changes detected`, which is treated as stale/incompatible because of those warnings.

Fallback evidence used:

```powershell
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
go test ./service -run 'Test(TokenSpaceMaterialAsset|AssetMaterializerForChannelSelectsTokenSpaceMaterial|AssetBindingScopeForTokenSpaceMaterial|SeedanceProxyAsset|TokenSpaceMaterial.*AssetType|AssetModelTarget.*TokenSpace|AssetReference|SeedanceProxy)' -count=1 -timeout=5m
go build ./...
bun test --run src/features/channels/lib/channel-form.test.ts
bun run typecheck
bun run build
bun run i18n:sync
```

`git diff --name-only origin/main...HEAD` showed the expected asset-materialization docs, DTO/settings tests, middleware/task/service asset materialization paths, channel form files, and locale files.

## Secret And Identifier Scan

Command:

```powershell
git diff origin/main...HEAD | rg -n 'sk-|shulex123|api\.tokenspace\.net\.cn|group-[0-9]|asset-[0-9]|X-Tos-|X-Goog-'
```

Result: exit 0 with matches limited to the planned scan command text, public design/operations documentation references, and non-live test placeholders. Manual review found no live credential, no signed URL, no live group ID, and no upstream asset ID in the branch diff.

No credential, group ID, response body, signed URL, or upstream asset ID was retained in source, logs, reports, or commits.

## Read-only Group Confirmation

Controller-provided read-only result:

- API call succeeded = true
- Suitable AIGC group exists = true

Only these booleans were retained. The request credential, group ID, response body, upstream asset identifiers, and signed URLs were not retained.

## Production And Deployment Notes

Production channel 106 was not mutated in this task. Enabling `tokenspace_material` for production channel 106 is an external-production configuration mutation and requires separate explicit approval after the code is deployed.

Router deploy: required. The branch affects asset readiness, binding materialization, and task request rewriting used by `/v1` relay traffic.

Other deploy targets: `newapi-console` is required for the shared backend and administrator channel settings. `newapi-web`, Terraform, Cloudflare, and the decommissioned legacy service are not involved.

Recommended rollout:

1. Merge and deploy to staging through the `staging` branch.
2. Configure staging channel settings with the verified dedicated group.
3. Upload one non-sensitive image and one short video through Flatkey.
4. Verify Active private bindings and Seedance video generation request rewriting.
5. Confirm logs and responses do not expose TokenSpace credential, group, signed URL, response body, or upstream asset ID.
6. Request separate external-production approval before mutating production channel 106.

Known gaps:

- The full `./service` package did not complete because of the known 10 minute timeout; changed service groups passed in focused fallback.
- Live TokenSpace `CreateAsset` / `GetAsset` were not executed.
- End-to-end Flatkey upload through generation was not executed.
- Production channel activation remains untested and intentionally unperformed.
