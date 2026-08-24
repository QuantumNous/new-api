# TokenSpace Real-Person Provider Implementation Plan

> **Execution mode:** Implement inline with `superpowers:executing-plans`; use TDD for every behavior change. Checkboxes track verified completion.

**Goal:** Make an explicitly pinned TokenSpace material channel, including production channel 106, support the existing `/v1/real-persons` verification and real-person asset lifecycle without changing its channel type, public API, or database schema.

**Architecture:** Refactor the current BytePlus-only real-person upstream calls behind a channel-bound provider interface. A native BytePlus adapter preserves existing AK/SK and callback behavior. A new TokenSpace adapter binds exactly one enabled channel API key, uses `/api/material?Action=...`, polls without callbacks, stores the returned real-person `GroupId`, and reuses the existing local idempotency, encryption, leases, CAS, assets, and jobs.

**Tech Stack:** Go, Gin/GORM existing services, `httptest`, SQLite-compatible tests, existing TokenSpace material transport and error taxonomy.

## Global constraints

- Work only in `E:\workspace\new-api-worktrees\tokenspace-real-person-provider` on `feature/tokenspace-real-person-provider`.
- Never hardcode channel ID 106. TokenSpace is selected only by explicit `asset_materialization.provider=tokenspace_material` on a specifically pinned first request or by a persisted profile/asset channel ID.
- Do not add a channel type, public route, DTO field, database column, dependency, or frontend change.
- TokenSpace real-person operations require exactly one enabled channel key. Zero or multiple enabled keys fail closed.
- Never use configured ordinary-material `group_id` for real-person assets. Only `GetVisualValidateResult.Result.GroupId` is authoritative.
- Do not log or persist plaintext API keys, `BytedToken`, full H5 URLs, QR codes, or source URLs outside the existing encrypted/local fields.
- Keep native BytePlus callback validation and behavior unchanged; TokenSpace is polling-only and must work without `BYTEPLUS_REAL_PERSON_CALLBACK_BASE_URL`.
- TokenSpace URL asset creation is supported. Multipart remains unavailable when the channel lacks the existing BytePlus TOS credentials.
- Use `common.Marshal`/`common.Unmarshal` and keep SQLite/MySQL/PostgreSQL compatibility.
- For each task: write a focused failing test, run and observe the expected failure, implement the smallest behavior, rerun focused/package tests, then `git diff --check`.
- Every commit follows the Lore commit protocol.

## File map

| Area | Files | Responsibility |
| --- | --- | --- |
| Provider boundary | `service/real_person_provider.go`, `service/real_person_provider_test.go` | Channel-bound API, native BytePlus adapter, TokenSpace selection, single-key enforcement, callback capability. |
| TokenSpace protocol | `service/tokenspace_real_person.go`, `service/tokenspace_real_person_test.go`, `service/tokenspace_material_asset.go` | Verification and asset Action mapping, response validation, normalized statuses/errors, shared transport reuse. |
| Verification state machine | `service/byteplus_real_person.go`, `service/byteplus_real_person_test.go` | Use provider binding, provider-specific callback and expiry, pinned selection and persisted channel reload. |
| Asset lifecycle | `service/byteplus_real_person_asset.go`, `service/byteplus_real_person_asset_test.go` | Create/list through provider, authoritative real-person group, storage capability separation. |
| Background reconciliation | `service/byteplus_real_person_jobs.go`, `service/byteplus_real_person_jobs_test.go` | Provider-aware verification polling, asset status, delete, final probe; preserve leases/CAS. |
| Evidence | `docs/superpowers/verification/2026-08-24-channel-106-tokenspace-real-person.md`, external test report directory | Commands, safe response shapes, production smoke IDs/statuses without secrets or signed URLs. |

---

### Task 1: Introduce a channel-bound real-person provider boundary

**Files:**

- Create: `service/real_person_provider.go`
- Create: `service/real_person_provider_test.go`
- Modify: `service/byteplus_real_person.go`

- [ ] Add failing tests for deterministic channel resolution.

  Cover:

  - native BytePlus channel resolves to a provider that requires callbacks;
  - explicitly configured `tokenspace_material` channel resolves to a polling provider;
  - TokenSpace with zero or multiple enabled keys is rejected;
  - TokenSpace with exactly one enabled key binds that key without exposing it;
  - malformed/missing explicit TokenSpace config is rejected;
  - an unpinned create does not add TokenSpace channels to automatic random routing;
  - existing group/model ability checks remain required.

- [ ] Run focused tests and confirm failure because the provider boundary does not exist.

  ```powershell
  go test ./service -run 'TestRealPersonProvider|TestSelectRealPersonChannel' -count=1
  ```

- [ ] Define a channel-bound internal interface with no credential arguments on individual calls:

  ```go
  type realPersonProvider interface {
      RequiresCallback() bool
      VerificationTTLSeconds() int64
      CreateVisualValidateSession(context.Context, string) (BytePlusVisualValidationSession, error)
      GetVisualValidateResult(context.Context, string) (BytePlusVisualValidationResult, error)
      CreateAsset(context.Context, BytePlusCreateAssetRequest) (string, string, error)
      GetAsset(context.Context, string) (BytePlusAssetStatus, error)
      ListAssets(context.Context, BytePlusListAssetsRequest) (BytePlusListAssetsResult, error)
      DeleteAsset(context.Context, string) (string, error)
  }
  ```

  Add a binding containing channel, provider, and optional native BytePlus storage credentials. The native adapter wraps the existing `BytePlusAssetClient` plus parsed credentials. The TokenSpace adapter is registered by provider name and binds one enabled API key.

- [ ] Keep wrappers for existing test seams where practical, but move production selection/reload to the generic binding. TokenSpace may be selected only when `specificChannelID > 0`; persisted profiles may always reload their saved provider.

- [ ] Run focused tests, existing real-person tests, and commit.

  ```powershell
  go test ./service -run 'TestRealPersonProvider|TestSelectRealPersonChannel|TestCreateBytePlusRealPerson' -count=1
  git diff --check
  ```

### Task 2: Implement TokenSpace verification actions and provider-specific callback behavior

**Files:**

- Create: `service/tokenspace_real_person.go`
- Create: `service/tokenspace_real_person_test.go`
- Modify: `service/tokenspace_material_asset.go`
- Modify: `service/byteplus_real_person.go`
- Modify: `service/byteplus_real_person_test.go`

- [ ] Add failing `httptest` cases for `CreateVisualValidateSession` and `GetVisualValidateResult`.

  Assert exact POST path/query, `{}` creation body, `BytedToken` poll body, Bearer header, absence of BytePlus callback fields, request ID extraction, required result fields, HTTP/business errors, response-size limit, and no secret in error strings.

- [ ] Add failing service tests proving:

  - TokenSpace create succeeds when the BytePlus callback environment variable is absent;
  - native BytePlus still fails without a valid HTTPS callback base;
  - TokenSpace H5 expiry is exactly 300 seconds from the injected clock;
  - `BytedToken` and H5 are stored through the existing cipher and replayed only while valid;
  - polling completion saves returned `GroupId`; non-complete/error responses remain retryable until expiry.

- [ ] Run and observe failure.

  ```powershell
  go test ./service -run 'TestTokenSpaceRealPerson.*Verification|Test.*Callback.*Provider|Test.*TokenSpace.*Expires' -count=1
  ```

- [ ] Generalize the existing TokenSpace material response/transport just enough to decode verification fields while preserving ordinary material behavior and its error taxonomy. Do not copy the HTTP stack.

- [ ] Implement the TokenSpace provider verification methods. Ignore `QrCode`; return only the H5 link through the existing response path. Treat poll failures as non-final/retryable under the current session/job rules unless a stable definitive error is available.

- [ ] Move callback URL construction and environment validation behind `RequiresCallback()`. Use provider TTL for session `ExpiresAt`: 1800 seconds for native BytePlus, 300 seconds for TokenSpace.

- [ ] Run tests and commit.

  ```powershell
  go test ./service -run 'TestTokenSpaceRealPerson|Test.*RealPerson.*Callback|Test.*VisualValidation' -count=1
  go test ./service -run 'TestTokenSpaceMaterial' -count=1
  git diff --check
  ```

### Task 3: Route real-person asset CRUD through the bound provider

**Files:**

- Modify: `service/tokenspace_real_person.go`
- Modify: `service/tokenspace_real_person_test.go`
- Modify: `service/byteplus_real_person_asset.go`
- Modify: `service/byteplus_real_person_asset_test.go`

- [ ] Add failing TokenSpace protocol tests for:

  - `CreateAsset` with authenticated profile `GroupId`, URL, name, and type;
  - `GetAsset` ID/group validation and `Pending|Processing|Active|Failed` normalization;
  - `ListAssets` with `Filter.GroupType=LivenessFace`, `Filter.GroupIds=[profileGroup]`, page/sort fields, and normalized items;
  - `DeleteAsset` idempotent success and provider not-found classification;
  - missing/mismatched IDs, wrong group, malformed timestamps, and business/HTTP errors.

- [ ] Add failing integration-style service tests proving the configured virtual material group is never used for real-person create/list calls and the local/public asset response remains unchanged.

- [ ] Run and observe failure.

  ```powershell
  go test ./service -run 'TestTokenSpaceRealPerson.*Asset|TestRealPersonAsset.*TokenSpace' -count=1
  ```

- [ ] Implement the four TokenSpace asset methods using the shared material transport. Map timestamps and statuses into the existing BytePlus-neutral internal structs; never retain upstream source URLs.

- [ ] Refactor URL create, list, status lookup, and deletion to use the provider binding instead of raw BytePlus credentials. Keep multipart storage gated by optional native storage credentials; TokenSpace URL create must not depend on TOS.

- [ ] Run focused and full asset tests, then commit.

  ```powershell
  go test ./service -run 'TestTokenSpaceRealPerson.*Asset|TestRealPersonAsset.*TokenSpace' -count=1
  go test ./service -run 'Test.*RealPersonAsset' -count=1
  git diff --check
  ```

### Task 4: Make all background jobs provider-aware without weakening leases

**Files:**

- Modify: `service/byteplus_real_person_jobs.go`
- Modify: `service/byteplus_real_person_jobs_test.go`

- [ ] Add failing job tests for TokenSpace verification completion, transient verification retry, asset status activation/failure, delete/not-found completion, and final status probe.

  Each test must assert the persisted channel is reused, exactly one bound key is used, no rerouting occurs, and existing lease/CAS loss remains non-destructive.

- [ ] Run and observe failure.

  ```powershell
  go test ./service -run 'TestBytePlusRealPerson.*Job.*TokenSpace|TestTokenSpace.*Job' -count=1
  ```

- [ ] Replace job-level BytePlus credential parsing/client assertions with provider binding reload. Leave TOS cleanup native-only because only native multipart creates those temporary objects.

- [ ] Re-run TokenSpace job tests and all existing real-person job tests. Commit.

  ```powershell
  go test ./service -run 'Test.*RealPerson.*Job|TestBytePlusRealPerson.*Status|TestBytePlusRealPerson.*Delete' -count=1
  git diff --check
  ```

### Task 5: Regression verification and safe channel-106 smoke

**Files:**

- Create: `docs/superpowers/verification/2026-08-24-channel-106-tokenspace-real-person.md`
- Update only if needed: `E:\workspace\seedance-ch106-full-e2e-20260824\README.md`
- Update only if needed: `E:\workspace\seedance-ch106-full-e2e-20260824\summary.json`

- [ ] Format and run static checks on changed Go files.

  ```powershell
  $changedGo = git diff --name-only origin/main -- '*.go'
  if ($changedGo) { gofmt -w $changedGo }
  git diff --check
  go vet ./service/...
  ```

- [ ] Run focused suites and package tests.

  ```powershell
  go test ./service -run 'TestTokenSpace|Test.*RealPerson' -count=1
  go test ./service -count=1
  go test ./controller -run 'Test.*RealPerson' -count=1
  go test ./model -run 'Test.*RealPerson|Test.*BytePlusAsset' -count=1
  ```

- [ ] Run repository-level tests/build. Record the known root `web/classic/dist` generated-embed failure separately if still present; do not hide unrelated baseline failures.

  ```powershell
  go test ./... -count=1
  go build ./...
  ```

- [ ] Perform a clean diff/security review: search for channel ID `106`, plaintext test keys, H5 token fragments, `BytedToken` logging, and accidental virtual group usage in the TokenSpace real-person adapter.

  ```powershell
  rg -n 'channel.?106|Bearer [A-Za-z0-9]|real-validate\?token=|BytedToken.*(log|fmt)|config\.GroupID' service docs/superpowers
  git diff --check origin/main...HEAD
  ```

- [ ] After the router build containing this change is deployed to the test environment, use the existing in-memory `Seedance Domestic` test key with `-106` to create one real-person verification session. Record only HTTP status, local profile/session IDs, returned URL host, and expiry; never record the full URL.

- [ ] The user must personally complete the H5 verification. Then verify profile `active`, returned upstream group persistence, URL asset create/get/list/delete, and one `asset://<id>` Seedance request. Do not upload or fabricate anyone else's face or identity material.

- [ ] Recheck model aliases on channel 106:

  - `seedance-2.5 -> doubao-seedance-2-5-260628`
  - `seedance-2.0 -> doubao-seedance-2-0-260128`
  - `seedance-2.0-fast -> doubao-seedance-2-0-fast-260128`
  - `seedance-2.0-mini -> doubao-seedance-2-0-mini-260615`

  Keep the existing evidence that standard works and 2.5/Fast/Mini currently reach TokenSpace but return `TokenModelForbidden` until upstream permissions are enabled.

- [ ] Use `superpowers:requesting-code-review`, address findings with tests, then use `superpowers:verification-before-completion` before the final report.

## Acceptance checklist

- [ ] No channel ID is hardcoded and channel 106 remains `DoubaoVideo`.
- [ ] TokenSpace real-person create works through a specifically pinned channel without a BytePlus callback environment variable.
- [ ] Only H5 verification URL and expiry are returned; `BytedToken`, QR code, API key, and full signed URLs are absent from logs/reports.
- [ ] Authentication completion stores the returned real-person `GroupId`; ordinary configured material `group_id` is never used.
- [ ] URL asset create/get/list/delete and all background jobs use the persisted channel and provider.
- [ ] TokenSpace multi-key channels fail closed; native BytePlus and ordinary TokenSpace material behavior do not regress.
- [ ] Targeted tests, package tests, available repository checks, security review, and documented smoke evidence are complete.
