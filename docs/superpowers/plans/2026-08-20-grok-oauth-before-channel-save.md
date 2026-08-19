# Grok OAuth Before Channel Save Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow an administrator to authorize Grok in the new-channel form, keep the returned versioned credential only in form memory, and create one immediately active channel with the final Create action.

**Architecture:** Extend the existing Grok PKCE flow with unbound `channel_id = 0` semantics. Unbound completion returns the serialized credential through the authenticated no-store response without touching channels; bound completion retains its existing server-side persistence. The existing channel batch-insert transaction will also create the Grok auth-state projection, and the frontend will normalize create mode to ID zero and place the returned key into React Hook Form state.

**Tech Stack:** Go, Gin, GORM, SQLite-backed Go tests, React 19, TypeScript 6, React Hook Form, Bun test, TanStack Query.

## Global Constraints

- Keep the redirect URI exactly `http://127.0.0.1:56121/callback` and keep manual callback URL copy/paste.
- Grok Subscription remains OAuth-only; raw or non-versioned xAI API keys remain invalid.
- Preserve encrypted verifier storage, hashed state, constant-time comparison, ten-minute expiry, one-use claims, no-store responses, and sanitized errors.
- Bound flows (`channel_id > 0`) must never return a credential to the browser.
- Unbound flows (`channel_id = 0`) must never insert or update a channel or Grok state row.
- Empty-key Grok creation remains valid and produces a pending, non-routable channel.
- Add no dependency and write no credential to local or session storage.
- Work on `feature/grok-subscription`; push it before promoting the verified commits to `staging`.

## File Structure

- `controller/grok_auth.go` and `controller/grok_auth_test.go`: unbound PKCE start/completion and response secrecy.
- `model/grok_channel_state.go`, `model/channel.go`, and new `model/channel_grok_insert_test.go`: transactional active/pending projection.
- `web/default/src/features/channels/api.ts`: optional create-mode completion key.
- New `web/default/src/features/channels/lib/grok-oauth.ts` and `.test.ts`: mode, response, and badge logic.
- `web/default/src/features/channels/components/dialogs/grok-oauth-dialog.tsx`: optional channel ID and returned-key callback.
- `web/default/src/features/channels/components/drawers/channel-mutate-drawer.tsx`: create-mode button, form key, status, and edit-mode preservation.
- `web/default/src/features/channels/lib/channel-form.test.ts`: final-create payload regression.

---

### Task 1: Add Unbound Grok PKCE Start and Completion

**Files:**
- Modify: `controller/grok_auth.go:46-235`
- Modify: `controller/grok_auth.go:390-468`
- Test: `controller/grok_auth_test.go:64-334`
- Test: `controller/grok_auth_test.go:475-576`

**Interfaces:**
- Consumes: `model.GrokAuthFlow.ChannelID`, `groksubscription.Credential.Serialize()`, and `model.ConsumeGrokAuthFlow`.
- Produces: `GrokPKCECompleteResult{Key string}` and `GrokPKCEComplete(...) (GrokPKCECompleteResult, error)`.
- Produces: complete response `data.status = "active"`; `data.key` exists only for an unbound flow.

- [ ] **Step 1: Write failing unbound start tests**

Add these exact assertions to `controller/grok_auth_test.go`:

```go
func TestGrokAuthPKCEStartAllowsUnboundFlow(t *testing.T) {
	setupGrokAuthTestDB(t)
	setGrokCipherKey(t)
	start, err := GrokPKCEStart(0, groksubscription.OAuthRedirectURI)
	require.NoError(t, err)
	flow := readGrokFlow(t, start.FlowID)
	require.Zero(t, flow.ChannelID)
	var channelCount int64
	require.NoError(t, model.DB.Model(&model.Channel{}).Count(&channelCount).Error)
	require.Zero(t, channelCount)
}
```

Change `TestGrokAuthPKCEStartRejectsInvalidArgs` to reject `channelID = -1` and an empty redirect, while no longer rejecting zero.

- [ ] **Step 2: Write the failing unbound completion test**

Use the existing HTTP doer stub and assert the returned credential, absence of writes, and replay burn:

```go
func TestGrokAuthPKCECompleteUnboundReturnsCredentialWithoutChannelWrite(t *testing.T) {
	setupGrokAuthTestDB(t)
	setGrokCipherKey(t)
	start, err := GrokPKCEStart(0, groksubscription.OAuthRedirectURI)
	require.NoError(t, err)
	restore := SetGrokAuthHTTPDoerForTest(grokDoerFunc(func(*http.Request) (*http.Response, error) {
		return grokJSONResponse(200, `{"access_token":"at-create","refresh_token":"rt-create","token_type":"Bearer","expires_in":3600}`), nil
	}))
	defer restore()
	result, err := GrokPKCEComplete(start.FlowID, "create-code", start.State, "")
	require.NoError(t, err)
	credential, err := groksubscription.ParseCredential(result.Key)
	require.NoError(t, err)
	require.Equal(t, "at-create", credential.AccessToken)
	require.NotContains(t, result.Key, "create-code")
	var channels, states int64
	require.NoError(t, model.DB.Model(&model.Channel{}).Count(&channels).Error)
	require.NoError(t, model.DB.Model(&model.GrokChannelState{}).Count(&states).Error)
	require.Zero(t, channels)
	require.Zero(t, states)
	_, claimed, err := model.ClaimGrokAuthFlow(start.FlowID, "replay")
	require.NoError(t, err)
	require.False(t, claimed)
}
```

Update the bound happy-path test to capture the result and assert `result.Key` is empty. Update error-path calls for the new two-value signature. Add an unbound state-mismatch assertion proving no state row is written.

- [ ] **Step 3: Write failing handler contract tests**

Add `Key string \`json:"key"\`` to `grokAuthHandlerResponse.Data`. Assert explicit `{"channel_id":0}` succeeds, `{}` fails, `{"channel_id":-1}` fails, unbound completion returns a parseable key, and a bound success body does not contain a `key` member.

- [ ] **Step 4: Run the focused tests and observe the intended failure**

```powershell
go test ./controller -run 'TestGrok(AuthPKCEStart|AuthPKCEComplete|PKCEStartHandler|PKCECompleteHandler)' -count=1
```

Expected: zero is rejected, the completion signature is missing, or the create response lacks a key.

- [ ] **Step 5: Implement the minimal backend branch**

Use these signatures and guards:

```go
type GrokPKCECompleteResult struct { Key string }

func GrokPKCEStart(channelID int, redirectURI string) (GrokPKCEStartResult, error) {
	if channelID < 0 || redirectURI == "" {
		return GrokPKCEStartResult{}, errors.New("grok pkce: invalid args")
	}
	// Existing PKCE generation and encrypted persistence stay unchanged.
}
```

Serialize once after token exchange. If `flow.ChannelID == 0`, consume first and then return `GrokPKCECompleteResult{Key: serialized}`. Otherwise call `UpdateChannelKeyForType`, set active state, consume, and return an empty result. Only call `recordGrokNeedsReauth` when `flow.ChannelID > 0`.

Change `grokPKCEStartAPIRequest.ChannelID` to `*int`, reject nil and negative values, and call `requireGrokChannel` only for positive values. In the complete handler, add `data["key"] = result.Key` only when the result key is non-empty.

- [ ] **Step 6: Run focused tests and verify they pass**

```powershell
go test ./controller -run 'TestGrok(AuthPKCEStart|AuthPKCEComplete|PKCEStartHandler|PKCECompleteHandler)' -count=1
```

Expected: PASS; bound responses contain no key and unbound completion consumes its flow without channel writes.

- [ ] **Step 7: Commit Task 1 with Lore trailers**

```text
Allow Grok OAuth before a channel exists

Constraint: Unbound flows may return a credential only through the authenticated no-store response.
Rejected: Draft channel creation | It leaves orphaned channels when OAuth is abandoned.
Confidence: high
Scope-risk: moderate
Directive: Never return a key for a bound Grok flow.
Tested: Focused Grok PKCE controller tests.
Not-tested: Browser form integration is covered by later tasks.
```

---

### Task 2: Create Grok State and Abilities Transactionally

**Files:**
- Modify: `model/grok_channel_state.go:41-54`
- Modify: `model/channel.go:452-482`
- Create: `model/channel_grok_insert_test.go`

**Interfaces:**
- Consumes: `BatchInsertChannels`, `Channel.AddAbilities(tx)`, and the valid/empty key distinction enforced by controller validation.
- Produces: internal `upsertGrokChannelState(db *gorm.DB, st *GrokChannelState) error`; the exported wrapper keeps its current signature.
- Produces: exactly one `active` or `pending` state row for every newly inserted Grok channel, in the same transaction as its abilities.

- [ ] **Step 1: Write failing transaction tests**

Create a file-backed SQLite setup that migrates `Channel`, `Ability`, and, conditionally, `GrokChannelState`. Add:

```go
func setupGrokChannelInsertTestDB(t *testing.T, migrateState bool) {
	t.Helper()
	originalDB := DB
	originalSQLite := common.UsingSQLite
	common.UsingSQLite = true
	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/grok-channel-insert.db"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Channel{}, &Ability{}))
	if migrateState {
		require.NoError(t, db.AutoMigrate(&GrokChannelState{}))
	}
	DB = db
	t.Cleanup(func() {
		DB = originalDB
		common.UsingSQLite = originalSQLite
		if sqlDB, err := db.DB(); err == nil { _ = sqlDB.Close() }
	})
}

func TestBatchInsertChannelsCreatesGrokStateAndAbilities(t *testing.T) {
	setupGrokChannelInsertTestDB(t, true)
	channels := []Channel{
		{Type: constant.ChannelTypeGrokSubscription, Name: "active", Key: `{"version":1,"type":"grok_subscription","access_token":"at","token_type":"Bearer","expires_at":1786900000}`, Models: "grok-4", Group: "default", Status: common.ChannelStatusEnabled},
		{Type: constant.ChannelTypeGrokSubscription, Name: "pending", Key: "", Models: "grok-4", Group: "default", Status: common.ChannelStatusEnabled},
	}
	require.NoError(t, BatchInsertChannels(channels))
	var stored []Channel
	require.NoError(t, DB.Order("id ASC").Find(&stored).Error)
	require.Len(t, stored, 2)
	activeState, err := GetGrokChannelState(stored[0].Id)
	require.NoError(t, err)
	require.Equal(t, GrokAuthStatusActive, activeState.AuthStatus)
	pendingState, err := GetGrokChannelState(stored[1].Id)
	require.NoError(t, err)
	require.Equal(t, GrokAuthStatusPending, pendingState.AuthStatus)
	var activeAbility, pendingAbility Ability
	require.NoError(t, DB.First(&activeAbility, "channel_id = ?", stored[0].Id).Error)
	require.NoError(t, DB.First(&pendingAbility, "channel_id = ?", stored[1].Id).Error)
	require.True(t, activeAbility.Enabled)
	require.False(t, pendingAbility.Enabled)
}
```

Add a rollback test using a setup that omits the state table:

```go
func TestBatchInsertChannelsRollsBackWhenGrokStateInsertFails(t *testing.T) {
	setupGrokChannelInsertTestDB(t, false)
	err := BatchInsertChannels([]Channel{{
		Type: constant.ChannelTypeGrokSubscription, Name: "rollback", Key: "",
		Models: "grok-4", Group: "default", Status: common.ChannelStatusEnabled,
	}})
	require.Error(t, err)
	var channels, abilities int64
	require.NoError(t, DB.Model(&Channel{}).Count(&channels).Error)
	require.NoError(t, DB.Model(&Ability{}).Count(&abilities).Error)
	require.Zero(t, channels)
	require.Zero(t, abilities)
}
```

- [ ] **Step 2: Run the model tests and verify they fail**

```powershell
go test ./model -run 'TestBatchInsertChannels(Create|RollsBack)' -count=1
```

Expected: state lookup fails, and omission of the state table does not yet roll back the channel.

- [ ] **Step 3: Add the transaction-aware state helper**

```go
func UpsertGrokChannelState(st *GrokChannelState) error {
	return upsertGrokChannelState(DB, st)
}

func upsertGrokChannelState(db *gorm.DB, st *GrokChannelState) error {
	if db == nil || st == nil || st.ChannelID <= 0 {
		return errors.New("grok channel state: invalid channel id")
	}
	if st.CreatedAt == 0 { st.CreatedAt = GetDBTimestamp() }
	st.UpdatedAt = GetDBTimestamp()
	return db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "channel_id"}}, UpdateAll: true,
	}).Create(st).Error
}
```

Import `gorm.io/gorm`. Do not alter the exported function's behavior.

- [ ] **Step 4: Insert the projection inside `BatchInsertChannels`**

Immediately after `channel_.AddAbilities(tx)` succeeds:

```go
if channel_.Type == constant.ChannelTypeGrokSubscription {
	status := GrokAuthStatusPending
	if strings.TrimSpace(channel_.Key) != "" { status = GrokAuthStatusActive }
	if err := upsertGrokChannelState(tx, &GrokChannelState{
		ChannelID: channel_.Id, AuthStatus: status,
	}); err != nil {
		tx.Rollback()
		return err
	}
}
```

Do not change ability construction; it already enables non-empty Grok credentials and disables empty ones.

- [ ] **Step 5: Run focused model and validation tests**

```powershell
go test ./model -run 'TestBatchInsertChannels(Create|RollsBack)|TestGrokChannelState' -count=1
go test ./controller -run 'TestValidateChannelGrok' -count=1
```

Expected: PASS; valid versioned credentials are active/routable, empty credentials are pending/non-routable, and raw keys are still rejected.

- [ ] **Step 6: Commit Task 2 with Lore trailers**

```text
Make new Grok channels immediately consistent

Constraint: Channel, abilities, and auth projection must commit or roll back together.
Rejected: Post-commit state repair | It permits a saved channel to show the wrong status.
Confidence: high
Scope-risk: moderate
Directive: Keep empty-key Grok channels pending and non-routable.
Tested: Focused model transaction and Grok validation tests.
Not-tested: Cross-database behavior is covered by the final verification pass.
```

---

### Task 3: Support Create Mode in the Frontend Contract and OAuth Dialog

**Files:**
- Modify: `web/default/src/features/channels/api.ts:111-125`
- Create: `web/default/src/features/channels/lib/grok-oauth.ts`
- Create: `web/default/src/features/channels/lib/grok-oauth.test.ts`
- Modify: `web/default/src/features/channels/components/dialogs/grok-oauth-dialog.tsx:34-175`

**Interfaces:**
- Consumes: `GrokAuthStatusResponse` and `completeGrokPKCE`.
- Produces: `normalizeGrokOAuthChannelID(channelId?: number): number` and `resolveGrokOAuthCompletionKey(channelId, response): string | undefined`.
- Produces: `GrokOAuthDialogProps.channelId?: number` and `onAuthorized(key?: string)`.

- [ ] **Step 1: Write failing pure-mode tests**

Create `grok-oauth.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import {
  normalizeGrokOAuthChannelID,
  resolveGrokOAuthCompletionKey,
} from './grok-oauth'

describe('Grok OAuth mode contract', () => {
  test('normalizes a new channel to unbound mode', () => {
    expect(normalizeGrokOAuthChannelID(undefined)).toBe(0)
    expect(normalizeGrokOAuthChannelID(42)).toBe(42)
  })

  test('returns the generated key only for create mode', () => {
    const response = { success: true, data: { status: 'active', key: '{"version":1}' } }
    expect(resolveGrokOAuthCompletionKey(undefined, response)).toBe('{"version":1}')
    expect(resolveGrokOAuthCompletionKey(42, response)).toBeUndefined()
  })

  test('rejects create success without a key', () => {
    expect(() => resolveGrokOAuthCompletionKey(undefined, {
      success: true, data: { status: 'active' },
    })).toThrow('Missing credential in OAuth response')
  })
})
```

- [ ] **Step 2: Run the test and verify the module is missing**

```powershell
Set-Location web/default
bun test src/features/channels/lib/grok-oauth.test.ts
```

Expected: FAIL because `./grok-oauth` or its exports do not exist.

- [ ] **Step 3: Add the response field and helper**

Add `key?: string` to `GrokAuthStatusResponse.data`, then implement:

```ts
import type { GrokAuthStatusResponse } from '../api'

export function normalizeGrokOAuthChannelID(channelId?: number): number {
  return channelId ?? 0
}

export function resolveGrokOAuthCompletionKey(
  channelId: number | undefined,
  response: GrokAuthStatusResponse
): string | undefined {
  if (channelId !== undefined && channelId > 0) return undefined
  const key = response.data?.key?.trim()
  if (!key) throw new Error('Missing credential in OAuth response')
  return key
}
```

The helper must not log, render, copy, or persist the returned key.

- [ ] **Step 4: Adapt the OAuth dialog**

Change props to optional `channelId` and `onAuthorized(key?: string)`. Start with `startGrokPKCE(normalizeGrokOAuthChannelID(channelId), GROK_OAUTH_REDIRECT_URI)`. On success:

```ts
const key = resolveGrokOAuthCompletionKey(channelId, res)
toast.success(t('Grok authorization completed'))
onAuthorized(key)
onOpenChange(false)
```

Keep callback parsing, popup fallback, and reset behavior unchanged. Use a create-mode description saying the credential will be added to the form and saved only by Create Channel; keep the saved-channel description for edit mode.

- [ ] **Step 5: Run focused tests and typecheck**

```powershell
Set-Location web/default
bun test src/features/channels/lib/grok-oauth.test.ts
bun run typecheck
```

Expected: pure tests pass. If typecheck reports only the existing drawer callback/render guards, carry Task 3 changes directly into Task 4 before committing so the tree is never committed broken.

- [ ] **Step 6: Commit Task 3 when the tree typechecks**

```text
Let the Grok dialog authorize an unsaved form

Constraint: Create mode may hold the credential only in memory until final save.
Rejected: Browser storage | It expands secret lifetime beyond the open form.
Confidence: high
Scope-risk: narrow
Directive: Bound dialog completion must ignore response keys.
Tested: Focused Bun mode tests and TypeScript typecheck.
Not-tested: Drawer form wiring is covered by the next task.
```

---

### Task 4: Wire Create-Mode Authorization into the Channel Drawer

**Files:**
- Modify: `web/default/src/features/channels/lib/grok-oauth.ts`
- Modify: `web/default/src/features/channels/lib/grok-oauth.test.ts`
- Modify: `web/default/src/features/channels/components/drawers/channel-mutate-drawer.tsx:264-351`
- Modify: `web/default/src/features/channels/components/drawers/channel-mutate-drawer.tsx:1133-1185`
- Modify: `web/default/src/features/channels/components/drawers/channel-mutate-drawer.tsx:2344-2405`
- Modify: `web/default/src/features/channels/components/drawers/channel-mutate-drawer.tsx:2571-2582`
- Modify: `web/default/src/features/channels/lib/channel-form.test.ts`

**Interfaces:**
- Consumes: `GrokOAuthDialog.onAuthorized(key?)`, React Hook Form `setValue`, `currentKey`, and server `grok_auth_state.auth_status`.
- Produces: `resolveGrokAuthorizationView(...)` returning `authorized-unsaved`, `active`, `needs-reauth`, or `pending`.
- Produces: type 113 exposes Authorize in create and edit; refresh and refresh-token import remain edit-only.

- [ ] **Step 1: Write failing badge-state and payload tests**

Extend `grok-oauth.test.ts`:

```ts
test('shows an unsaved authorization only for a new form with a key', () => {
  expect(resolveGrokAuthorizationView({
    isEditing: false,
    formKey: '{"version":1}',
    serverStatus: undefined,
  })).toBe('authorized-unsaved')
  expect(resolveGrokAuthorizationView({
    isEditing: true,
    formKey: '{"version":1}',
    serverStatus: 'needs_reauth',
  })).toBe('needs-reauth')
})
```

Extend `channel-form.test.ts`:

```ts
describe('Grok OAuth create payload', () => {
  test('carries the generated credential only in the final create payload', () => {
    const credential = '{"version":1,"type":"grok_subscription","access_token":"at","token_type":"Bearer","expires_at":1786900000}'
    const payload = transformFormDataToCreatePayload({
      ...CHANNEL_FORM_DEFAULT_VALUES,
      name: 'grok', type: 113, key: credential, models: 'grok-4',
    })
    expect(payload.mode).toBe('single')
    expect(payload.channel.key).toBe(credential)
  })

  test('keeps empty-key pending creation available', () => {
    const payload = transformFormDataToCreatePayload({
      ...CHANNEL_FORM_DEFAULT_VALUES,
      name: 'pending-grok', type: 113, key: '', models: 'grok-4',
    })
    expect(payload.channel.key).toBeNull()
  })
})
```

- [ ] **Step 2: Run focused tests and verify the view helper is missing**

```powershell
Set-Location web/default
bun test src/features/channels/lib/grok-oauth.test.ts src/features/channels/lib/channel-form.test.ts
```

Expected: the authorization-view export is missing; payload assertions document existing final-submit behavior.

- [ ] **Step 3: Implement the view resolver**

```ts
export type GrokAuthorizationView =
  | 'authorized-unsaved'
  | 'active'
  | 'needs-reauth'
  | 'pending'

export function resolveGrokAuthorizationView(input: {
  isEditing: boolean
  formKey?: string
  serverStatus?: string
}): GrokAuthorizationView {
  if (!input.isEditing && input.formKey?.trim()) return 'authorized-unsaved'
  if (input.serverStatus === 'active') return 'active'
  if (input.serverStatus === 'needs_reauth') return 'needs-reauth'
  return 'pending'
}
```

- [ ] **Step 4: Show the create action and accurate badge**

Derive the view from `isEditing`, `currentKey`, and the server status. Map `authorized-unsaved` to a success badge labeled `Authorized — not saved`; retain the existing labels for active, needs-reauth, and pending.

Remove the edit-only guard from the Authorize button, but keep Refresh credential and Import refresh token guarded by `isEditing && channelId`. Replace create help text with `Authorize with Grok OAuth, then save the channel once.`

- [ ] **Step 5: Put the returned key into form memory**

Render the dialog whenever `currentType === 113`:

```tsx
<GrokOAuthDialog
  channelId={channelId ?? undefined}
  open={grokOAuthDialogOpen}
  onOpenChange={setGrokOAuthDialogOpen}
  onAuthorized={(key) => {
    if (!channelId) {
      if (!key) return
      form.setValue('key', key, { shouldDirty: true, shouldValidate: true })
      return
    }
    void queryClient.invalidateQueries({
      queryKey: channelsQueryKeys.detail(channelId),
    })
  }}
/>
```

Retain `handleOpenChange`'s `form.reset(CHANNEL_FORM_DEFAULT_VALUES)` and `setGrokOAuthDialogOpen(false)` so closing the create drawer discards the key and creates no channel.

- [ ] **Step 6: Run frontend tests, typecheck, and changed-file lint**

```powershell
Set-Location web/default
bun test src/features/channels/lib/grok-oauth.test.ts src/features/channels/lib/channel-form.test.ts
bun run typecheck
bunx eslint src/features/channels/api.ts src/features/channels/lib/grok-oauth.ts src/features/channels/lib/grok-oauth.test.ts src/features/channels/components/dialogs/grok-oauth-dialog.tsx src/features/channels/components/drawers/channel-mutate-drawer.tsx
```

Expected: PASS with no type or lint errors.

- [ ] **Step 7: Commit the integrated frontend flow**

If Task 3 was not committed separately because of temporary type errors, include all Task 3 and Task 4 files here.

```text
Make Grok OAuth part of one-save channel creation

Constraint: The credential exists only in the open form until Create Channel succeeds.
Rejected: Automatic channel creation after OAuth | Administrators still review channel fields before saving.
Confidence: high
Scope-risk: moderate
Directive: Closing the create drawer must continue clearing the generated key.
Tested: Focused Bun tests, TypeScript typecheck, and changed-file ESLint.
Not-tested: Live xAI authorization is covered by staging smoke verification.
```

---

### Task 5: Full Verification, Source Push, and Staging Promotion

**Files:**
- Verify: every file changed in Tasks 1-4.
- Modify only if a check finds a defect: the smallest owning file and a focused regression test.

**Interfaces:**
- Consumes: committed `feature/grok-subscription` implementation and the existing staging deployment workflow.
- Produces: pushed source branch, identical verified implementation on `staging`, and deployment/smoke evidence.

- [ ] **Step 1: Run relevant Go verification**

```powershell
go test ./controller ./model ./relay/channel/groksubscription -count=1
```

Expected: PASS. On failure, run the failing test alone, fix the owning code, rerun it, then rerun this command.

- [ ] **Step 2: Run frontend verification**

```powershell
Set-Location web/default
bun test src/features/channels/lib/grok-oauth.test.ts src/features/channels/lib/channel-form.test.ts
bun run typecheck
bun run build
```

Expected: PASS, including the production bundle containing both create and edit branches.

- [ ] **Step 3: Review the diff for secret-safety invariants**

From the repository root, inspect the intended diff and run:

```powershell
rg -n 'console\.(log|debug)|localStorage|sessionStorage|data\["key"\]|ChannelID == 0' controller/grok_auth.go web/default/src/features/channels
git status --short
```

Expected: no token/verifier/callback logging, no browser storage, response key handling guarded by create mode, and no unrelated worktree changes.

- [ ] **Step 4: Commit a verification fix only if needed**

Use this Lore record with the exact fixed test named in `Tested`:

```text
Close the verified Grok creation regression

Constraint: Preserve one-save creation without weakening bound-flow secrecy.
Rejected: Suppressing the failing test | The failure represents required behavior.
Confidence: high
Scope-risk: narrow
Directive: Keep the regression test with the owning code.
Tested: Focused regression plus full relevant Go and frontend verification.
Not-tested: Live staging authorization follows after promotion.
```

Do not create an empty commit if no fix was needed.

- [ ] **Step 5: Push the source branch explicitly**

```powershell
git push origin HEAD:feature/grok-subscription
```

Expected: remote source branch advances to the verified commit.

- [ ] **Step 6: Promote implementation commits to staging**

In the existing staging worktree, fetch both branches, confirm a clean/understood worktree, cherry-pick only the new implementation commit range in source order, and push `HEAD:staging`. Do not rewrite either branch or overwrite unrelated staging changes. If a conflict occurs, compare it against the exact source commit before resolving.

- [ ] **Step 7: Monitor deployment and smoke test**

Confirm the staging workflow builds and deploys. Authenticated as an administrator, POST `{"channel_id":0}` to `/api/channel/grok/pkce/start`. Expected: 200, `Cache-Control: no-store`, non-empty authorize URL/flow ID, exact loopback redirect, and no channel created.

Complete one browser flow from a new Grok form. Expected: `Authorized — not saved`; cancelling creates no channel; repeating authorization and clicking Create Channel creates one active channel with enabled abilities. Also reopen an existing Grok channel and verify reauthorization, refresh, and refresh-token import still use the saved channel ID.

---

## Final Acceptance Checklist

- [ ] Explicit zero starts unbound OAuth; missing and negative channel IDs fail.
- [ ] Unbound completion returns a parseable credential, consumes its flow, and writes no channel/state.
- [ ] Bound completion persists server-side and never returns `data.key`.
- [ ] State mismatch and replay protections pass in both modes.
- [ ] Credentialed creation atomically produces active state and enabled abilities.
- [ ] Empty-key creation atomically produces pending state and disabled abilities.
- [ ] Raw/non-versioned keys remain rejected.
- [ ] Create UI exposes Authorize, holds the key only in form memory, shows `Authorized — not saved`, and submits it only with Create Channel.
- [ ] Closing the drawer clears the key and creates no channel.
- [ ] Edit reauthorization, refresh, import, and query invalidation remain unchanged.
- [ ] Relevant Go tests, Bun tests, typecheck, lint, and production build pass.
- [ ] Source is pushed before the same verified implementation reaches staging.
