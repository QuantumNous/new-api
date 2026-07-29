# BytePlus Virtual Portrait Asset Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Add private Flatkey-owned BytePlus virtual portrait asset creation/status APIs and allow owned active assets in Seedance 2.0 without exposing upstream group or asset IDs.

**Architecture:** Reuse ChannelTypeBytePlus and store structured credentials in Channel.Key. Persist one internal group per (user_id, channel_id) and each user-owned asset, using a unique constraint plus conditional leases for multi-node creation. Resolve asset://ast_ references before random selection, pin the request to the owning channel, and rewrite only the upstream request body.

**Tech Stack:** Go, Gin, GORM, SQLite/MySQL/PostgreSQL, net/http, HMAC-SHA256, common JSON wrappers, testing and testify.

---

## File map

- pkg/volcengineauth/signer.go: deterministic Volcengine HMAC signer.
- service/byteplus_credentials.go: legacy and JSON Channel.Key parsing.
- model/byteplus_asset.go: records, ownership queries, group claims, state updates.
- service/byteplus_asset_client.go: signed CreateAssetGroup/CreateAsset/GetAsset.
- dto/byteplus_asset.go: public request/response types only.
- service/byteplus_asset.go: validation, channel selection, create/status orchestration.
- service/byteplus_asset_reference.go: authorize references and build rewrite mappings.
- controller/byteplus_asset.go and router/asset-router.go: TokenAuth-only API.
- middleware/distributor.go and controller/relay.go: pre-selection pinning and retry locking.
- relay/channel/task/byteplus/adaptor.go: structured key use and URI rewrite.
- model/main.go, types/error.go, i18n files, OpenAPI, and API docs: migration and contract.

### Task 1: HMAC signer and structured credentials

**Files:**
- Create: pkg/volcengineauth/signer.go
- Create: pkg/volcengineauth/signer_test.go
- Create: service/byteplus_credentials.go
- Create: service/byteplus_credentials_test.go
- Modify: relay/channel/task/byteplus/adaptor.go
- Test: relay/channel/task/byteplus/adaptor_test.go

- [ ] **Step 1: Write failing signer tests**

Test a Signer containing AccessKeyID, SecretAccessKey, Region, Service, and an injectable Now clock. Call Sign(request, payload). With a fixed UTC time, assert X-Date, payload hash, exact SignedHeaders content-type;host;x-content-sha256;x-date, sorted query keys and values, empty payload behavior, and no secret in errors.

- [ ] **Step 2: Verify RED**

Run: go test ./pkg/volcengineauth -run TestSigner -count=1

Expected: FAIL because the package and Signer do not exist.

- [ ] **Step 3: Implement minimal signer**

Canonicalize method, escaped path, sorted escaped query, normalized signed headers, and payload hash. Derive date to region to service to request HMAC keys. Set Host, Content-Type, X-Date, X-Content-Sha256, and Authorization without logging credentials.

- [ ] **Step 4: Write failing credential tests**

Test BytePlusCredentials fields APIKey, AccessKeyID, SecretAccessKey, ProjectName and ParseBytePlusCredentials, ValidateVideo, ValidateAssets. Cover a legacy ark key, valid structured JSON, malformed JSON-looking input, missing fields, and redacted errors.

- [ ] **Step 5: Verify RED**

Run: go test ./service -run TestParseBytePlusCredentials -count=1

Expected: FAIL because the parser does not exist.

- [ ] **Step 6: Implement credentials and video compatibility**

Use common.Unmarshal. JSON-looking malformed input is a configuration error, never a bearer key. BytePlus submit and a new FetchTask override use only parsed APIKey; legacy keys remain valid.

- [ ] **Step 7: Verify GREEN and commit**

Run: go test ./pkg/volcengineauth ./service ./relay/channel/task/byteplus -run Test -count=1

Expected: PASS with no credential output. Commit with Lore trailers and the command in Tested:.

### Task 2: Persistent assets and multi-node group claims

**Files:**
- Create: model/byteplus_asset.go
- Create: model/byteplus_asset_test.go
- Modify: model/main.go

- [ ] **Step 1: Write failing migration and repository tests**

Define BytePlusAssetGroup with UserId, ChannelId, UpstreamGroupId, UpstreamRequestId, Status, ErrorMessage, LeaseUpdatedTime, CreatedTime, UpdatedTime and a unique index on UserId plus ChannelId. Define BytePlusAsset with unique PublicId, UserId, AssetGroupId, ChannelId, UpstreamAssetId, UpstreamRequestId, AssetType, SourceURL as text, ModerationStrategy, Status, ErrorMessage, CreatedTime, UpdatedTime.

Test SQLite AutoMigrate, both uniqueness constraints, ownership-scoped lookup, fresh claim, fresh-lease non-ownership, stale takeover, failed retry, activation, and asset state updates.

- [ ] **Step 2: Verify RED**

Run: go test ./model -run TestBytePlusAsset -count=1

Expected: FAIL because models and repository functions do not exist.

- [ ] **Step 3: Implement minimal repository**

Implement ClaimBytePlusAssetGroup, ActivateBytePlusAssetGroup, FailBytePlusAssetGroup, CreateBytePlusAsset, GetBytePlusAssetByPublicIDForUser, GetBytePlusAssetsByPublicIDsForUser, UpdateBytePlusAssetUpstreamCreated, and UpdateBytePlusAssetStatus.

Claim first inserts Creating. On unique conflict, reload and conditionally update only Failed or stale Creating. RowsAffected equal to one is the only ownership signal. Use GORM-only cross-database expressions.

- [ ] **Step 4: Register both migration paths**

Add both models to the normal AutoMigrate list and fast sequential migration list in model/main.go.

- [ ] **Step 5: Verify GREEN and commit**

Run: go test ./model -run TestBytePlusAsset -count=1

Expected: PASS. Commit with Constraint: SQLite, MySQL 5.7.8+, and PostgreSQL 9.6+ compatibility.

### Task 3: Signed BytePlus asset client

**Files:**
- Create: service/byteplus_asset_client.go
- Create: service/byteplus_asset_client_test.go

- [ ] **Step 1: Write failing httptest client tests**

Exercise BytePlusAssetClient methods CreateAssetGroup, CreateAsset, and GetAsset plus NewBytePlusAssetClient(httpClient, endpoint). Assert POST root with Action and Version 2024-01-01, signed headers, GroupType AIGC, ProjectName, Default and Skip moderation, Processing/Active/Failed mapping, unknown-status rejection, non-2xx and ResponseMetadata.Error handling, and no response or secret reflection.

- [ ] **Step 2: Verify RED**

Run: go test ./service -run TestBytePlusAssetClient -count=1

Expected: FAIL because the client does not exist.

- [ ] **Step 3: Implement client**

Use common.Marshal and common.DecodeJson, Signer, production host ark.ap-southeast-1.byteplusapi.com, service ark, region ap-southeast-1, version 2024-01-01, bounded response bodies, and sanitized errors retaining only request ID for diagnostics.

- [ ] **Step 4: Verify GREEN and commit**

Run: go test ./service -run TestBytePlusAssetClient -count=1

Expected: PASS. Commit with Directive: never expose credentials or upstream group/asset IDs.

### Task 4: Asset orchestration service

**Files:**
- Create: dto/byteplus_asset.go
- Create: service/byteplus_asset.go
- Create: service/byteplus_asset_test.go
- Modify: types/error.go

- [ ] **Step 1: Write failing validation and orchestration tests**

Test public request, moderation, response, and public error DTOs. Assert public absolute HTTP(S) URL validation, rejection of local/private literal hosts and userinfo, Image/Video/Audio, default Default, explicit Skip, stable codes, BytePlus-only enabled model-capable structured channels, token-specific channel enforcement, active group reuse, fresh lease initializing, stale takeover, local Creating before upstream, Processing after create, ownership-scoped status refresh, sanitized failure, and omission of upstream/group/channel/project/source fields.

- [ ] **Step 2: Verify RED**

Run: go test ./service -run TestBytePlusAsset -count=1

Expected: FAIL because orchestration and codes do not exist.

- [ ] **Step 3: Add stable errors and channel selection**

Add codes invalid_asset_request, asset_not_found, asset_not_ready, asset_failed, asset_channel_conflict, asset_channel_unavailable, asset_group_initializing, asset_upstream_error, asset_storage_error. Select existing seedance-2.0 abilities, filter ChannelTypeBytePlus, enabled status, complete asset credentials, allowed group or auto group, and optional token-specific channel. Asset-management calls do not consume video concurrency leases.

- [ ] **Step 4: Implement create/get orchestration**

Implement CreateBytePlusAsset(ctx, userID, userGroup, usingGroup, specificChannelID, request) and GetBytePlusAsset(ctx, userID, publicID). Use three bounded group rereads, a stale lease threshold, common.GenerateRandomCharsKey(32) for ast IDs, opaque non-personal upstream names, and sanitized stored/public errors. Log only Flatkey request ID, channel ID, and upstream request ID if persistence fails after upstream success.

- [ ] **Step 5: Verify GREEN and commit**

Run: go test ./service -run TestBytePlusAsset -count=1

Expected: PASS, including two claims yielding one group creation owner. Commit with Scope-risk: broad.

### Task 5: Public /v1/assets API

**Files:**
- Create: controller/byteplus_asset.go
- Create: controller/byteplus_asset_test.go
- Create: router/asset-router.go
- Modify: router/main.go

- [ ] **Step 1: Write failing handler and route tests**

Assert POST /v1/assets and GET /v1/assets/:asset_id use TokenAuth, return direct public asset objects, localize typed failures in OpenAI-compatible error envelopes, reject invalid input and wrong ownership, and never serialize group, channel, upstream, project, source URL, access key, secret, or authorization fields.

- [ ] **Step 2: Verify RED**

Run: go test ./controller ./router -run TestBytePlusAsset -count=1

Expected: FAIL because handlers and routes do not exist.

- [ ] **Step 3: Implement thin handlers and routes**

Read user/group/specific-channel context, call service, and render stable codes. Register RouteTag relay plus TokenAuth only; do not use Distribute.

- [ ] **Step 4: Verify GREEN and commit**

Run: go test ./controller ./router -run TestBytePlusAsset -count=1

Expected: PASS, including unauthenticated rejection. Commit with Constraint: upstream IDs remain server-only.

### Task 6: asset URI authorization, pinning, retry affinity, and rewrite

**Files:**
- Create: service/byteplus_asset_reference.go
- Create: service/byteplus_asset_reference_test.go
- Modify: constant/context_key.go
- Modify: middleware/distributor.go
- Create: middleware/distributor_byteplus_asset_test.go
- Modify: controller/relay.go
- Modify and Test: relay/channel/task/byteplus/adaptor.go and adaptor_test.go

- [ ] **Step 1: Write failing resolver tests**

Extract only content image_url, video_url, and audio_url values matching asset://ast_ plus 32 alphanumeric characters. Assert deduplication, 404 for missing or wrong owner, 409 for Creating or Processing, 422 for Failed, 409 for mixed channels, and exact client-to-upstream URI maps.

- [ ] **Step 2: Verify RED**

Run: go test ./service -run TestResolveBytePlusAssetReferences -count=1

Expected: FAIL because resolution does not exist.

- [ ] **Step 3: Implement one-query resolution**

Add context keys for a map of rewrites and pinned channel ID. Implement BytePlusAssetResolution and ResolveBytePlusAssetReferences(c, userID). Use one ownership-scoped batch query; video submission requires locally synchronized Active and does not poll upstream.

- [ ] **Step 4: Write failing distributor tests**

Cover pin-before-affinity/random, token model access, token-specific mismatch, group/model/endpoint checks, disabled or full channel, no fallback to another account, and unchanged no-asset selection.

- [ ] **Step 5: Verify RED**

Run: go test ./middleware -run TestBytePlusAsset -count=1

Expected: FAIL because Distribute does not resolve or pin assets.

- [ ] **Step 6: Implement pinning and retry lock**

Resolve after reusable model/body parsing but before channel choice. Validate the exact channel and use existing concurrency acquisition plus SetupContextForSelectedChannel. In controller.RelayTask, transfer the pinned channel into relayInfo.LockedChannel before ResolveOriginTask and retries.

- [ ] **Step 7: Write failing adaptor rewrite and key tests**

Assert only mapped Flatkey asset URIs become asset://<upstream-id>, ordinary URLs remain unchanged, unresolved Flatkey URIs fail, and submit/fetch use only parsed api_key.

- [ ] **Step 8: Implement rewrite and verify GREEN**

Override BytePlus BuildRequestBody: call embedded Doubao builder, decode through common.Unmarshal, rewrite media URL fields from context, and common.Marshal. Never mutate the reusable client body.

Run:
- go test ./service -run TestResolveBytePlusAssetReferences -count=1
- go test ./middleware -run TestBytePlusAsset -count=1
- go test ./relay/channel/task/byteplus -run TestBytePlus -count=1

Expected: all PASS. Commit with Directive: asset-bound retries never change channels.

### Task 7: i18n, OpenAPI, and documentation

**Files:**
- Modify: i18n/keys.go
- Modify: i18n/locales/en.yaml
- Modify: i18n/locales/zh-CN.yaml
- Modify: i18n/locales/zh-TW.yaml
- Modify: i18n/locales/pt.yaml
- Modify: docs/openapi/relay.json
- Create: docs/api/byteplus-asset-api.md

- [ ] **Step 1: Write failing locale coverage test**

Translate every new asset key in en, zh-CN, zh-TW, and pt and assert non-empty output different from the key.

- [ ] **Step 2: Verify RED**

Run: go test ./i18n -run TestBytePlusAssetLocaleCoverage -count=1

Expected: FAIL for missing keys.

- [ ] **Step 3: Add complete translations and contract**

Add all nine messages. Document POST and GET schemas, Default or Skip, and asset URI use with seedance-2.0. Do not publish BytePlus host, GroupId, upstream AssetId, ProjectName, channel ID, or credentials.

- [ ] **Step 4: Verify GREEN and commit**

Run:
- go test ./i18n -run TestBytePlusAssetLocaleCoverage -count=1
- Get-Content docs/openapi/relay.json -Raw | ConvertFrom-Json | Out-Null
- rg -n access_key_id docs/api/byteplus-asset-api.md docs/openapi/relay.json

Expected: locale PASS, JSON parse exit 0, rg no matches. Commit with checks in Tested:.

### Task 8: Review, full verification, and channel 131 smoke

**Files:**
- Modify only files required by review findings.
- Never persist secret-bearing smoke artifacts.

- [ ] **Step 1: Focused tests**

Run:
- go test ./pkg/volcengineauth ./model ./service ./controller ./middleware ./relay/channel/task/byteplus -count=1
- go test ./relay ./relay/channel/task/doubao ./common ./constant ./i18n -count=1

Expected: PASS.

- [ ] **Step 2: Static and build checks**

Run go vet ./..., go build ./..., and git diff --check.

Expected: exit 0.

- [ ] **Step 3: Bounded full suite**

Run: go test -timeout 15m ./...

Expected: PASS. If timeout occurs, test each package with a 3m timeout; fix branch-caused failures and record unrelated baseline failures.

- [ ] **Step 4: Secret and scope audit**

Run git diff origin/main...HEAD, git grep for ark key prefixes, access-key prefixes, Secret Access Key, and session cookies, plus git log origin/main..HEAD.

Expected: no supplied secrets or cookies; only feature scope.

- [ ] **Step 5: Authorized live smoke**

Supply the already-authorized Flatkey token only through an in-memory environment variable and use channel 131 database configuration. Create a harmless public asset, poll Flatkey ID to Active, submit seedance-2.0 with the Flatkey asset URI, poll terminal status, and assert stored channel 131. Capture only status codes, Flatkey IDs, local status, latency, and sanitized request IDs.

- [ ] **Step 6: Final two-stage review and fixes**

Run specification review first, then code quality and security review. Fix every Critical or Important finding, re-review, and repeat Steps 1 through 4.

- [ ] **Step 7: Final commit**

Use Lore trailers. Do not push, merge, modify main, or promote staging without a separate request.
