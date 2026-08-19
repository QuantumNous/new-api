# Channel 156 asset materialization verification

Date: 2026-08-19

## Scope

This change keeps the existing Flatkey asset contract (`/v1/assets` and
`asset://ast_...`) and GCS source storage. An administrator can configure the
`seedance_proxy` materializer on a channel with one operations-managed shared
group. The existing binding, lease, readiness, and rewrite-map flow is reused;
customer APIs do not expose the upstream group or asset identifier.

## Automated verification

The following fresh checks passed:

- `go test ./dto -run 'TestChannelOtherSettings' -count=1 -timeout=3m`
- `go test ./service -run 'Test(SeedanceProxyAsset|AssetBinding|AssetModelTarget|AssetModelWorker|AssetReference|TechMobiAsset)' -count=1 -timeout=5m`
- `go test ./service -run 'Test(.*SeedanceProxy.*|.*AssetBindingScope.*|.*NormalizedGatewayOrigin.*|.*AssetModelTarget.*|.*AssetModelWorker.*|.*AssetReference.*|.*TechMobiAsset.*|.*BytePlusAsset.*|ChannelOtherSettings.*)' -count=1 -timeout=5m`
- `go test ./middleware -run 'Test(TechMobiAsset|BytePlusAsset|AssetReference)' -count=1 -timeout=5m`
- `go test ./relay/channel/task/doubao ./relay/channel/task/byteplus -count=1 -timeout=5m`
- `go test ./dto ./middleware -count=1 -timeout=3m`
- `bun test --run src/features/channels/lib/channel-form.test.ts` — 27 passed, 0 failed
- `bun run typecheck` — exit code 0
- `git diff --check` — no whitespace errors

The focused coverage includes gateway HTTP/status/error handling, all three
Seedance model names sharing one binding scope, explicit-provider precedence,
unknown/invalid-provider fail-closed behavior, exact media-reference rewriting,
legacy BytePlus compatibility, administrator form round-tripping, and the
worker-level Audio gate that prevents a provider call or binding creation.

## Known verification limits

- `go test ./service -count=1 -timeout=90s` did not complete. The bounded run
  exited on the test timeout while parallel service tests were creating SQLite
  databases/migrations (the stack included recall-campaign setup and database
  connection/migration goroutines). No changed-test assertion failure was
  observed in the bounded output. The service package is therefore not claimed
  as a full-suite pass.
- The isolated existing recall test
  (`TestRecallMetricPageJSONExposesOnlyOpaqueSnapshotToken`) passes, but that
  does not remove the repository-wide parallel-test timeout above.
- No live staging acceptance was run: this workspace has no authorized gateway
  configuration or staging promotion request. Provider tests use local
  `httptest` servers only.
- Backend API writes may retain an invalid `asset_materialization` object;
  runtime resolver and readiness checks deliberately fail closed for it, so
  ordinary URL-only video requests remain unaffected. The administrator form
  performs the user-facing HTTPS/group validation.

## Scope and secret checks

GitNexus is installed but `gitnexus status` reports that this worktree is not
indexed. The authoritative fallback scope check was
`git diff --name-only origin/main`, followed by `git diff --check`; the listed
files are limited to the channel settings, asset materialization flow, legacy
adaptor compatibility, administrator form/locales, tests, and the design/plan
artifacts.

A bounded scan of the changed files found only existing test sentinels such as
`signed.example` and placeholder gateway/group values. No user-provided API
key, signed URL, production gateway, production group ID, or upstream asset ID
was retained in source, tests, commits, or this report.

## Operational handoff

Before any staging or production configuration, rotate the API key previously
pasted into chat, then configure the pre-created shared group and gateway
through the administrator channel form. No push, merge, or staging promotion
was performed in this task.
