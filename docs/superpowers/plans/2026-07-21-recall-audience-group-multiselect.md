# Recall Audience Group Multiselect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make recall audience groups fully operator-controlled and expose configured user groups through a searchable multi-select.

**Architecture:** Remove the `first_purchase`-specific PLG gate so the existing backend group-mode function is authoritative. Add a recall-owned group API query and selector component that reuses the shared `MultiSelect`, then integrate it into the existing React Hook Form flow and update all localized guidance.

**Tech Stack:** Go, React 19, TypeScript, TanStack Query, React Hook Form, Base UI `MultiSelect`, Bun tests, go test.

---

### Task 1: Remove the implicit PLG audience gate

**Files:**
- Modify: `service/recall_audience_test.go`
- Modify: `service/recall_audience.go`

- [ ] **Step 1: Write the failing backend regression test**

Replace `TestRecallAudienceFirstPurchaseDefaultsToPLGGroup` with a test that creates eligible `plg`, `default`, and `admin` users, previews `first_purchase` with no group filter, and expects all three users to be eligible with no `group_filtered` exclusions. Add table cases proving `Groups: ["default"], GroupMode: "allow"` selects only `default`, while `Groups: ["admin"], GroupMode: "block"` excludes only `admin`.

- [ ] **Step 2: Verify RED**

Run: `go test ./service -run 'TestRecallAudienceFirstPurchase.*Group' -count=1`

Expected: FAIL because no-filter still returns only the PLG user and explicit non-PLG allow mode returns zero users.

- [ ] **Step 3: Implement the minimal backend change**

Delete the template-specific condition:

```go
if draft.AudienceTemplate == "first_purchase" && strings.TrimSpace(user.Group) != "plg" {
    return recallAudienceSelection{}, "group_filtered", nil
}
```

Keep the immediately following `recallAudienceGroupAllowed` call unchanged.

- [ ] **Step 4: Verify GREEN**

Run: `go test ./service -run 'TestRecallAudienceFirstPurchase.*Group|TestRecallAudienceGroupBlockMode' -count=1`

Expected: PASS.

### Task 2: Add the recall group selector with tests

**Files:**
- Modify: `web/default/src/features/recall-campaigns/api.ts`
- Create: `web/default/src/features/recall-campaigns/group-options.ts`
- Create: `web/default/src/features/recall-campaigns/group-options.test.ts`
- Create: `web/default/src/features/recall-campaigns/components/campaign-group-selector.tsx`
- Create: `web/default/src/features/recall-campaigns/components/campaign-group-selector.test.tsx`

- [ ] **Step 1: Write failing option and component tests**

Test these contracts before production code exists:

```ts
expect(buildRecallGroupOptions(['admin', 'plg'])).toEqual([
  { label: 'admin', value: 'admin' },
  { label: 'plg', value: 'plg' },
])
expect(selectedRecallGroupFallbackOptions(['removed'])).toEqual([
  { label: 'removed', value: 'removed' },
])
```

Preload the React Query cache with `['recall-campaigns', 'audience-options', 'user-groups']`, render the selector, and assert that configured options and saved fallback chips render, `No group filter` disables the input, and empty/failed data produces localized explanatory text.

- [ ] **Step 2: Verify RED**

Run: `bun test src/features/recall-campaigns/group-options.test.ts src/features/recall-campaigns/components/campaign-group-selector.test.tsx`

Expected: FAIL because the new modules and API key do not exist.

- [ ] **Step 3: Implement API, option helpers, and selector**

Add the query key and endpoint wrapper:

```ts
userGroups: ['recall-campaigns', 'audience-options', 'user-groups'] as const

export async function getRecallUserGroups(): Promise<ApiResponse<string[]>> {
  const response = await api.get('/api/group/', { params: { type: 'user' } })
  return requireRecallSuccess(response.data)
}
```

Map trimmed, non-empty, unique group strings to `{label, value}` options. Build `CampaignGroupSelector` with `useQuery`, `MultiSelect`, `allowCreate={false}`, selected-value fallback options, and disabled state derived from `immutable`, `groupMode === ''`, loading, error, or an empty authoritative option list.

- [ ] **Step 4: Verify GREEN**

Run: `bun test src/features/recall-campaigns/group-options.test.ts src/features/recall-campaigns/components/campaign-group-selector.test.tsx`

Expected: PASS.

### Task 3: Integrate the selector and update guidance

**Files:**
- Modify: `web/default/src/features/recall-campaigns/components/campaign-editor.tsx`
- Modify: `web/default/src/features/recall-campaigns/components/campaign-editor.test.tsx`
- Modify: `web/default/src/features/recall-campaigns/copy.ts`
- Modify: `web/default/src/features/recall-campaigns/copy.test.ts`
- Modify: `web/default/src/i18n/static-keys.ts`
- Modify: `web/default/src/i18n/locales/en.json`
- Modify: `web/default/src/i18n/locales/zh.json`
- Modify: `web/default/src/i18n/locales/es.json`
- Modify: `web/default/src/i18n/locales/fr.json`
- Modify: `web/default/src/i18n/locales/pt.json`
- Modify: `web/default/src/i18n/locales/ru.json`
- Modify: `web/default/src/i18n/locales/ja.json`
- Modify: `web/default/src/i18n/locales/vi.json`

- [ ] **Step 1: Write failing editor and copy tests**

Change the first-purchase description expectation to:

```text
Targets registered users who have never paid, for campaigns that encourage a first purchase.
```

Assert that the editor renders `CampaignGroupSelector` with `id="recall-groups"`, retains the `No group filter`/`Allow groups`/`Block groups` mode choices, and no longer renders a free-form comma-separated group input or PLG-specific help.

- [ ] **Step 2: Verify RED**

Run: `bun test src/features/recall-campaigns/copy.test.ts src/features/recall-campaigns/components/campaign-editor.test.tsx`

Expected: FAIL on the old PLG wording and old free-form input.

- [ ] **Step 3: Integrate the selector and translations**

Replace the group `<Input>` with `CampaignGroupSelector`, passing the existing watched values and `setGroups` callback. Keep the group-mode select and clearing helper unchanged. Add the approved help text:

```text
Choose Allow or Block, then select the user groups to include or exclude. With no group filter, eligible users from every group are included.
```

Translate the new and changed keys in all eight locale files and remove the obsolete PLG-specific key from `static-keys.ts` and the locale files.

- [ ] **Step 4: Verify GREEN**

Run: `bun test src/features/recall-campaigns`

Expected: all recall frontend tests pass.

### Task 4: Integrated verification and delivery

**Files:**
- Verify all files changed by Tasks 1-3.

- [ ] **Step 1: Run backend verification**

Run:

```text
go test ./service -run '^(TestRecallEmail|TestRecallCampaign|TestRecallAudience)' -count=1
go build ./service/... ./controller/... ./setting/operation_setting/...
go vet ./service
```

Expected: exit 0 for every command.

- [ ] **Step 2: Run frontend verification**

Run from `web/default`:

```text
bun test src/features/recall-campaigns
bun run typecheck
bun run i18n:sync
bun run build:check
bun x eslint <changed recall TypeScript/TSX files>
bun x prettier --check <changed recall TypeScript/TSX files>
```

Expected: recall tests, typecheck, build, targeted lint, and targeted format pass; i18n sync produces no feature-owned translation drift.

- [ ] **Step 3: Review scope and commit**

Run `git diff --check`, confirm only recall backend/frontend/i18n/spec/plan files changed, then commit using the Lore Commit Protocol and push `feature/stripe-user-winback` to update PR 453.

- [ ] **Step 4: Promote to staging after verification**

Cherry-pick only the new runtime commit(s) onto the staging promotion worktree, push `origin/staging`, wait for `GCP Deploy Staging (backend)` to succeed, and verify the multi-select plus cross-group targeting behavior without creating or activating a real campaign.
