# BytePlus Seedance Channel Implementation Plan

> **For Codex:** Execute this plan in the isolated `codex/byteplus-seedance`
> worktree with strict red-green TDD. Do not copy the API key or account-specific
> `ep-*` endpoint IDs into production code, tests, logs, or commits.

**Goal:** Add an independently managed `BytePlus` Seedance task channel for
`https://ark.ap-southeast.bytepluses.com` that always sends the supplier's
moderation-skip header and exposes only Flatkey white-label task/results.

**Architecture:** Register channel type `107` and add a thin
`relay/channel/task/byteplus` wrapper around the compatible Ark implementation in
`relay/channel/task/doubao`. Override only BytePlus identity, header dispatch,
white-label parsing/conversion, and upstream URL extraction. Keep endpoint IDs in
the channel's `model_mapping` configuration.

**Tech stack:** Go, Gin, TypeScript/React admin console, Bun tests/build.

---

## Task 1: Lock channel identity and UI registration

**Files:**

- Create: `constant/byteplus_channel_test.go`
- Modify: `constant/channel.go`
- Modify: `common/endpoint_type_test.go`
- Modify: `common/endpoint_type.go`
- Modify: `web/default/src/features/channels/constants.test.ts`
- Modify: `web/default/src/features/channels/constants.ts`
- Modify: `web/default/src/features/channels/lib/channel-utils.ts`
- Modify: `web/default/src/features/channels/lib/channel-type-config.ts`

**Red:** Add assertions that type `107` is named `BytePlus`, defaults to
`https://ark.ap-southeast.bytepluses.com`, is selectable in the console, uses a
Seedance/Doubao icon, supplies the same default base URL in the form, and resolves
to `EndpointTypeOpenAIVideo`. Run:

```powershell
go test ./constant ./common
Set-Location web/default; bun test src/features/channels/constants.test.ts
```

Confirm failures are missing `ChannelTypeBytePlus` / channel `107` registration.

**Green:** Add `ChannelTypeBytePlus = 107` before `ChannelTypeDummy`, append the
base URL, add `BytePlus` to `ChannelTypeNames`, route type `107` as an OpenAI video
endpoint, and add the frontend constants/order/icon/config entry with the three
public model aliases.

**Verify:** Re-run the targeted Go and Bun tests.

**Commit:** Use a Lore commit recording the ID-collision constraint and targeted
test evidence.

## Task 2: Add the BytePlus task adapter with fixed moderation bypass

**Files:**

- Create: `relay/channel/task/byteplus/adaptor_test.go`
- Create: `relay/channel/task/byteplus/adaptor.go`
- Create: `relay/channel/task/byteplus/constants.go`
- Modify: `relay/relay_adaptor_test.go`
- Modify: `relay/relay_adaptor.go`

**Red:** Add adapter tests for:

- exact three-model public list;
- `BytePlus` channel name;
- Bearer authentication plus immutable
  `x-ark-moderation-scene: skip-ark-moderation` on create requests;
- model mapping forwarding an arbitrary test `ep-*` value without a production
  endpoint ID constant;
- factory selection of `*byteplus.TaskAdaptor` for channel type `107`.

Run:

```powershell
go test ./relay/channel/task/byteplus ./relay
```

Confirm failure is due to the missing package/factory route.

**Green:** Embed `doubao.TaskAdaptor`; override `BuildRequestHeader`, `DoRequest`,
`GetModelList`, and `GetChannelName`. `DoRequest` must call
`channel.DoTaskApiRequest(a, ...)` with the BytePlus receiver so the fixed header
override is used. Register the adapter in `GetTaskAdaptor`.

**Verify:** Re-run BytePlus, relay, and existing Doubao adapter tests.

**Commit:** Use a Lore commit explaining why the thin wrapper and receiver-aware
dispatch were selected.

## Task 3: Enforce the white-label boundary and server-side download resolution

**Files:**

- Modify: `relay/channel/task/byteplus/adaptor_test.go`
- Modify: `relay/channel/task/byteplus/adaptor.go`
- Modify: `relay/channel/task/taskcommon/helpers_test.go`
- Modify: `relay/channel/task/taskcommon/helpers.go`
- Modify: `controller/video_proxy.go`

**Red:** Add tests proving:

- BytePlus is a white-label platform/channel;
- `byteplus` and `bytepluses.com` branded errors are scrubbed;
- polling failure reasons are scrubbed;
- OpenAI video conversion exposes `task.GetResultURL()` instead of the upstream
  `content.video_url` and removes branded failure text;
- `ExtractUpstreamVideoURL` reads the real URL from persisted Ark task data.

Run:

```powershell
go test ./relay/channel/task/byteplus ./relay/channel/task/taskcommon ./controller
```

Confirm failures are missing BytePlus white-label behavior.

**Green:** Register type `107` in the white-label set, add BytePlus brand/host
keywords, override `ParseTaskResult` and `ConvertToOpenAIVideo`, add safe upstream
URL extraction, and make `controller.VideoProxy` resolve BytePlus video URLs from
persisted task data server-side.

**Verify:** Re-run targeted tests plus existing white-label channel tests.

**Commit:** Use a Lore commit documenting the customer-visible data boundary.

## Task 4: Full regression and secret-safety verification

**Files:** All changed files.

Run, in order:

```powershell
go test ./relay/channel/task/... ./dto/... ./common/... ./constant/... ./controller/... ./relay/...
go build ./...
go vet ./...
Set-Location web/default; bun test src/features/channels/constants.test.ts
bun run typecheck
bun run build
Set-Location ../..; git diff --check
git status --short
```

Review the complete diff and search for accidental account-specific endpoint IDs,
API-key-shaped secrets, and the plaintext key from the supplied DOCX without
printing matches. Remove the incomplete untracked `.gitnexus/` index after
verifying its resolved path remains inside this worktree. GitNexus analysis is an
explicit validation gap because two CLI indexing attempts failed; compensate
with the recorded caller mapping, targeted tests, build, vet, and diff review.

Confirm deployment scope in handoff: router and console required; database,
Terraform, Cloudflare, and website not required.
