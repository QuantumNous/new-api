# Activity Configuration Audiences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the admin recall area to Activity Configuration and add exact `registered_only` and `specified_users` audiences with timestamp ranges, searchable user multi-selection, and manual emails.

**Architecture:** Preserve internal recall routes, tables, and delivery pipelines. Extend the JSON audience contract, apply bounded predicates in the existing candidate repository, and keep account/email/opt-out safety in the selector. Add one admin-only user-option endpoint and a focused frontend selector that combines debounced search with stable selected-user resolution.

**Tech Stack:** Go, Gin, GORM, React 19, TypeScript, React Hook Form, Zod, TanStack Query, Base UI Combobox, Bun tests, Go tests.

---

## File structure

- `service/recall_contract.go`, `service/recall_campaign.go`, `service/recall_audience.go` — stored fields, canonicalization, validation, and eligibility.
- `model/recall_recipient.go`, `model/user.go` — bounded audience selection and user-option lookup.
- `controller/recall_campaign.go`, `router/api-router.go` — admin-only user search/resolution endpoint.
- `web/default/src/features/recall-campaigns/audience-inputs.ts` — pure datetime, email, and option helpers.
- `web/default/src/features/recall-campaigns/components/campaign-specified-users-selector.tsx` — debounced search, stable chips, and email entry.
- `web/default/src/features/recall-campaigns/components/campaign-editor.tsx` — template-specific controls.
- Existing recall tests, locale files, sidebar, list, and detail files — compatibility and visible terminology.

### Task 1: Persist, canonicalize, and validate the audience contract

**Files:**
- Modify: `service/recall_contract.go`
- Modify: `service/recall_campaign.go`
- Modify: `service/recall_audience.go`
- Test: `service/recall_audience_test.go`
- Test: `service/recall_campaign_test.go`

- [ ] **Step 1: Write failing tests**

Add cases accepting both new templates and rejecting missing/reversed timestamps, empty specified lists, malformed emails, non-positive IDs, and more than 500 identifiers. Add a normalization test for stable ID deduplication and case-insensitive email deduplication.

```go
tests := []struct {
    template string
    cfg RecallAudienceConfig
    wantErr string
}{
    {"registered_only", RecallAudienceConfig{RegistrationStartAt: 100, RegistrationEndAt: 200}, ""},
    {"registered_only", RecallAudienceConfig{RegistrationStartAt: 200, RegistrationEndAt: 100}, "registration time range"},
    {"specified_users", RecallAudienceConfig{SpecifiedUserIDs: []int{7}}, ""},
    {"specified_users", RecallAudienceConfig{SpecifiedEmails: []string{"ops@example.com"}}, ""},
    {"specified_users", RecallAudienceConfig{}, "at least one"},
}
```

- [ ] **Step 2: Run RED tests**

```powershell
go test ./service -run 'TestValidateRecallAudienceNewTemplates|TestNormalizeRecallAudienceSpecifiedUsers' -count=1
```

Expected: FAIL because the fields and templates are absent.

- [ ] **Step 3: Add fields and normalization**

```go
RegistrationStartAt int64    `json:"registration_start_at"`
RegistrationEndAt   int64    `json:"registration_end_at"`
SpecifiedUserIDs    []int    `json:"specified_user_ids"`
SpecifiedEmails     []string `json:"specified_emails"`
```

Add `normalizeRecallUserIDs([]int) []int` and `normalizeRecallEmails([]string) []string`. Trim/lowercase emails, preserve first-seen order, and ensure empty arrays serialize as `[]`. Canonicalize before draft JSON is saved.

- [ ] **Step 4: Add template-aware validation**

Accept `registered_only` and `specified_users`. Require positive inclusive timestamps with `end >= start`; require 1–500 normalized specified identifiers; validate every ID as positive and every email through the strict mailbox parser already used for candidate email safety. Do not change existing template rules.

- [ ] **Step 5: Run GREEN tests and commit**

```powershell
go test ./service -run 'TestValidateRecallAudience|TestNormalizeRecallAudience|TestRecallCampaignDraft' -count=1
git add service/recall_contract.go service/recall_campaign.go service/recall_audience.go service/recall_audience_test.go service/recall_campaign_test.go
git commit -m "Make activity audiences explicit and bounded" -m "Constraint: Existing templates and stored JSON remain compatible." -m "Confidence: high" -m "Scope-risk: moderate" -m "Tested: Focused audience and draft service tests."
```

Expected: PASS and one Lore commit.

### Task 2: Select both audiences without scanning or widening

**Files:**
- Modify: `model/recall_recipient.go`
- Modify: `service/recall_audience.go`
- Test: `model/recall_repository_test.go`
- Test: `service/recall_audience_test.go`

- [ ] **Step 1: Write failing repository and selector tests**

Create users on/outside both time boundaries, plus paid and `request_count = 1` users. Cover ID-only, email-only, ID/email overlap, mixed-case email, unknown values, two keyset pages, disabled accounts, opt-out, invalid email, and verified-email enforcement.

```go
query := model.RecallCandidateQuery{
    Template: "specified_users",
    SpecifiedUserIDs: []int{idOne, idDuplicate},
    SpecifiedEmails: []string{"mixed@example.com", "duplicate@example.com"},
    Limit: 2,
}
```

- [ ] **Step 2: Run RED tests**

```powershell
go test ./model ./service -run 'TestListRecallCandidateFacts(NewAudiencePredicates|SpecifiedUnion)|TestRecallAudience(RegisteredOnly|SpecifiedUsers)' -count=1
```

Expected: FAIL.

- [ ] **Step 3: Extend the candidate query and GORM predicates**

Add `RegistrationStartAt`, `RegistrationEndAt`, `SpecifiedUserIDs`, and `SpecifiedEmails`. Build the user query before `Find`:

```go
usersQuery := DB.WithContext(ctx).Where("id > ?", query.AfterUserID)
switch query.Template {
case "registered_only":
    usersQuery = usersQuery.Where(
        "created_at >= ? AND created_at <= ? AND request_count = 0",
        query.RegistrationStartAt, query.RegistrationEndAt,
    )
case "specified_users":
    usersQuery = usersQuery.Where("id IN ? OR LOWER(email) IN ?", ids, emails)
}
err := usersQuery.Order("id ASC").Limit(query.Limit).Find(&users).Error
```

Construct separate ID-only/email-only clauses when either list is empty; never generate empty `IN` SQL. Apply payment-provider filtering only to `lapsed_payer` and `expired_subscription` so registered-only detects payments from every provider.

- [ ] **Step 4: Add selector branches**

Populate the new query fields. `registered_only` returns `payment_exists` for any successful payment and `threshold_not_met` unless request count is exactly zero and `created_at` is inclusive. `specified_users` bypasses behavioral thresholds, registration filters, recent-API lookup, and group filtering, but retains enabled-account, valid-email, opt-out, and optional verified-email checks.

- [ ] **Step 5: Run GREEN tests and commit**

```powershell
go test ./model ./service -run 'RecallCandidate|RecallAudience' -count=1
git add model/recall_recipient.go model/recall_repository_test.go service/recall_audience.go service/recall_audience_test.go
git commit -m "Select operational audiences without widening eligibility" -m "Constraint: Enumeration stays bounded and specified lists stay exact." -m "Rejected: Filtering the full user table in memory | it does not scale." -m "Confidence: high" -m "Scope-risk: moderate" -m "Tested: Focused model and service audience tests."
```

Expected: PASS.

### Task 3: Add an admin-only user-option endpoint

**Files:**
- Modify: `model/user.go`
- Modify: `controller/recall_campaign.go`
- Modify: `router/api-router.go`
- Test: `controller/recall_campaign_test.go`
- Test: `router/recall_campaign_test.go`

- [ ] **Step 1: Write failing endpoint and authorization tests**

Test `GET /api/recall-campaigns/audience-users?keyword=ada&page_size=20` and `?ids=7,9`. Assert the response exposes only:

```go
type recallAudienceUserOption struct {
    ID int `json:"id"`
    Username string `json:"username"`
    DisplayName string `json:"display_name"`
    Email string `json:"email"`
    Status int `json:"status"`
}
```

Reject malformed/more-than-500 IDs and confirm a normal user fails `AdminAuth`.

- [ ] **Step 2: Run RED tests**

```powershell
go test ./controller ./router -run 'TestListRecallAudienceUsers|TestRecallAudienceUsersRoute' -count=1
```

- [ ] **Step 3: Implement bounded search and resolution**

Add a context-aware model function that accepts either a trimmed keyword or explicit IDs. Keyword search uses existing username/display-name/email matching, caps page size at 50, and excludes no selected status so unavailable users remain visible. ID resolution deduplicates, caps at 500, and orders by ID. The controller maps full users to the minimal option response.

- [ ] **Step 4: Register before the parameter route**

```go
recallCampaignRoute.GET("/audience-users", controller.ListRecallAudienceUsers)
recallCampaignRoute.GET("/:id", controller.GetRecallCampaign)
```

- [ ] **Step 5: Run GREEN tests and commit**

```powershell
go test ./controller ./router -run 'RecallAudienceUsers|RecallCampaignRoute' -count=1
git add model/user.go controller/recall_campaign.go controller/recall_campaign_test.go router/api-router.go router/recall_campaign_test.go
git commit -m "Let administrators resolve exact activity recipients" -m "Constraint: Search responses stay minimal and admin-only." -m "Confidence: high" -m "Scope-risk: narrow" -m "Tested: Focused controller and router tests."
```

### Task 4: Add frontend types, helpers, schema, and API

**Files:**
- Modify: `web/default/src/features/recall-campaigns/types.ts`
- Modify: `web/default/src/features/recall-campaigns/schemas.ts`
- Modify: `web/default/src/features/recall-campaigns/schemas.test.ts`
- Create: `web/default/src/features/recall-campaigns/audience-inputs.ts`
- Create: `web/default/src/features/recall-campaigns/audience-inputs.test.ts`
- Modify: `web/default/src/features/recall-campaigns/api.ts`
- Modify: `web/default/src/features/recall-campaigns/api.test.ts`

- [ ] **Step 1: Write failing helper/schema/API tests**

```ts
expect(parseRecallSpecifiedEmails('A@Example.com, b@example.com\nA@example.com')).toEqual({
  emails: ['a@example.com', 'b@example.com'], invalid: [],
})
expect(recallUnixToLocalDateTime(0)).toBe('')
```

Assert legacy audience objects default new fields to `0`, `0`, `[]`, `[]`; registered-only rejects reversed ranges; specified-users rejects empty, malformed, and over-500 lists. Test exact keyword/IDs endpoint params.

- [ ] **Step 2: Run RED tests**

```powershell
Set-Location web/default
bun test src/features/recall-campaigns/schemas.test.ts src/features/recall-campaigns/audience-inputs.test.ts src/features/recall-campaigns/api.test.ts
```

- [ ] **Step 3: Add types and pure helpers**

Extend the template union and audience interface with the four backend fields. Add `RecallAudienceUserOption`. Implement:

```ts
export function recallUnixToLocalDateTime(timestamp: number): string
export function recallLocalDateTimeToUnix(value: string): number
export function parseRecallSpecifiedEmails(value: string): { emails: string[]; invalid: string[] }
export function mergeRecallAudienceUserOptions(selected: RecallAudienceUserOption[], search: RecallAudienceUserOption[]): RecallAudienceUserOption[]
```

Use browser-local time, Unix seconds, case-insensitive email deduplication, and selected-first stable ordering.

- [ ] **Step 4: Add Zod defaults and cross-field issues**

```ts
registration_start_at: z.number().int().nonnegative().default(0),
registration_end_at: z.number().int().nonnegative().default(0),
specified_user_ids: z.array(z.number().int().positive()).default([]),
specified_emails: z.array(z.string().trim().email()).default([]),
```

At draft level, attach reversed/missing time errors to `registration_end_at`, empty specified errors to `specified_user_ids`, and combined-count errors when IDs plus emails exceed 500.

- [ ] **Step 5: Add the API function**

```ts
export async function listRecallAudienceUsers(params: {
  keyword?: string
  ids?: number[]
}): Promise<ApiResponse<RecallAudienceUserOption[]>>
```

Use `requireRecallSuccess`, `page_size=50` for keyword search, and comma-separated IDs for resolution.

- [ ] **Step 6: Run GREEN tests/typecheck and commit**

```powershell
bun test src/features/recall-campaigns/schemas.test.ts src/features/recall-campaigns/audience-inputs.test.ts src/features/recall-campaigns/api.test.ts
bun run typecheck
git add src/features/recall-campaigns/types.ts src/features/recall-campaigns/schemas.ts src/features/recall-campaigns/schemas.test.ts src/features/recall-campaigns/audience-inputs.ts src/features/recall-campaigns/audience-inputs.test.ts src/features/recall-campaigns/api.ts src/features/recall-campaigns/api.test.ts
git commit -m "Model activity audiences before rendering controls" -m "Constraint: Legacy drafts acquire safe defaults without migration." -m "Confidence: high" -m "Scope-risk: moderate" -m "Tested: Schema, helper, API tests and typecheck."
```

### Task 5: Build and integrate searchable user/email controls

**Files:**
- Modify: `web/default/src/components/multi-select.tsx`
- Test: `web/default/src/components/multi-select.test.tsx`
- Create: `web/default/src/features/recall-campaigns/components/campaign-specified-users-selector.tsx`
- Create: `web/default/src/features/recall-campaigns/components/campaign-specified-users-selector.test.tsx`
- Modify: `web/default/src/features/recall-campaigns/components/campaign-editor.tsx`
- Modify: `web/default/src/features/recall-campaigns/components/campaign-editor.test.tsx`
- Modify: `web/default/src/features/recall-campaigns/copy.ts`
- Modify: `web/default/src/features/recall-campaigns/copy.test.ts`

- [ ] **Step 1: Write failing component/editor tests**

Cover the `onSearchChange` callback, selected-user option retention, unavailable chips, 300 ms search query key, manual email errors, combined count, both new template options, conditional fields, defaults, and submit payloads. Existing template field assertions must remain unchanged.

- [ ] **Step 2: Run RED tests**

```powershell
Set-Location web/default
bun test src/components/multi-select.test.tsx src/features/recall-campaigns/components/campaign-specified-users-selector.test.tsx src/features/recall-campaigns/components/campaign-editor.test.tsx src/features/recall-campaigns/copy.test.ts
```

- [ ] **Step 3: Add a backward-compatible MultiSelect callback**

```ts
interface MultiSelectProps {
  // existing props
  onSearchChange?: (value: string) => void
}
```

Call it from `handleInputValueChange` without changing existing filtering, chip, creation, or keyboard behavior.

- [ ] **Step 4: Implement the specified-user selector**

```ts
interface CampaignSpecifiedUsersSelectorProps {
  userIDs: number[]
  emails: string[]
  onUserIDsChange(value: number[]): void
  onEmailsChange(value: string[]): void
  immutable: boolean
}
```

Use `useDebounce(search.trim(), 300)`. Resolve saved IDs independently, merge selected/search results, and label options as `display name or username · email · #id`; unresolved IDs show `Unavailable · #id`. Keep selected chips across searches. Render a separate email textarea, parse comma/newline input, show invalid tokens, and display `count / 500`.

- [ ] **Step 5: Integrate template-specific editor fields**

Add both descriptions and defaults. Registered-only renders two `datetime-local` inputs using the pure conversion helpers plus optional group allow/block controls. Specified-users renders only its selector and the shared verified-email switch; it hides numeric thresholds, groups, dates, and payment providers. Preserve inactive form values when switching templates.

- [ ] **Step 6: Run GREEN tests/quality checks and commit**

```powershell
bun test src/components/multi-select.test.tsx src/features/recall-campaigns
bun x eslint src/components/multi-select.tsx src/features/recall-campaigns/components/campaign-specified-users-selector.tsx src/features/recall-campaigns/components/campaign-editor.tsx
bun run typecheck
git add src/components/multi-select.tsx src/components/multi-select.test.tsx src/features/recall-campaigns/components/campaign-specified-users-selector.tsx src/features/recall-campaigns/components/campaign-specified-users-selector.test.tsx src/features/recall-campaigns/components/campaign-editor.tsx src/features/recall-campaigns/components/campaign-editor.test.tsx src/features/recall-campaigns/copy.ts src/features/recall-campaigns/copy.test.ts
git commit -m "Expose exact activity audiences to administrators" -m "Constraint: Email entry stays separate from searchable user selection." -m "Confidence: high" -m "Scope-risk: moderate" -m "Tested: Component/feature tests, ESLint, and typecheck."
```

### Task 6: Rename visible terminology and localize all controls

**Files:**
- Modify: `web/default/src/features/recall-campaigns/index.tsx`
- Modify: `web/default/src/features/recall-campaigns/components/campaign-table.tsx`
- Modify: `web/default/src/features/recall-campaigns/components/campaign-detail.tsx`
- Modify: `web/default/src/hooks/use-sidebar-data.ts`
- Modify: `web/default/src/hooks/use-sidebar-data.test.ts`
- Modify: `web/default/src/i18n/static-keys.ts`
- Modify: all `web/default/src/i18n/locales/{en,zh,es,fr,pt,ru,ja,vi}.json`

- [ ] **Step 1: Write failing terminology/locale assertions**

Expect `Activity Configuration`, `Create activity configuration`, `No activity configurations`, and `Back to Activity Configuration`. Add an eight-locale audit for both templates, datetime fields, search, emails, counts, unavailable users, and errors. Require Chinese primary title `活动配置` and reject placeholder `?` translations.

- [ ] **Step 2: Run RED tests**

```powershell
Set-Location web/default
bun test src/hooks/use-sidebar-data.test.ts src/features/recall-campaigns
```

- [ ] **Step 3: Replace only visible keys and translate**

Update sidebar, page, create dialog, empty state, and detail return copy. Keep `/recall-campaigns`, API/query keys, database names, and Go names unchanged. Add fluent translations in every locale; Chinese uses `活动配置`, `创建活动配置`, `暂无活动配置`, and `返回活动配置`.

- [ ] **Step 4: Sync, format, verify, and commit**

```powershell
bun run i18n:sync
bun x prettier --write src/i18n/static-keys.ts src/i18n/locales/en.json src/i18n/locales/zh.json src/i18n/locales/es.json src/i18n/locales/fr.json src/i18n/locales/pt.json src/i18n/locales/ru.json src/i18n/locales/ja.json src/i18n/locales/vi.json
bun test src/hooks/use-sidebar-data.test.ts src/features/recall-campaigns
bun run typecheck
git diff --check
git add src/features/recall-campaigns/index.tsx src/features/recall-campaigns/components/campaign-table.tsx src/features/recall-campaigns/components/campaign-detail.tsx src/hooks/use-sidebar-data.ts src/hooks/use-sidebar-data.test.ts src/i18n/static-keys.ts src/i18n/locales/*.json
git commit -m "Name the admin workflow for broader activity configuration" -m "Constraint: Internal recall routes and stored contracts stay stable." -m "Confidence: high" -m "Scope-risk: narrow" -m "Tested: Sidebar, feature, locale, typecheck, formatting, and diff checks."
```

### Task 7: Release verification, browser smoke, review, and cleanup

**Files:**
- Modify only when verification exposes a product defect.

- [ ] **Step 1: Run backend verification**

```powershell
go test ./model ./service ./controller ./router -run 'Recall|recall' -count=1
go test ./service -count=1
```

Expected: focused checks pass; document unrelated repository failures without weakening assertions.

- [ ] **Step 2: Run frontend verification**

```powershell
Set-Location web/default
bun test src/features/recall-campaigns src/hooks/use-sidebar-data.test.ts src/components/multi-select.test.tsx
bun run typecheck
bun run build-check
```

Expected: PASS.

- [ ] **Step 3: Browser smoke the full admin and permission flow**

Verify `活动配置` terminology; inclusive registered-only preview/save/reload; multi-user search, removable stable chips, manual emails, overlap deduplication, save/reload; invalid ranges/lists blocked; existing templates unchanged; normal-user page redirect and unauthorized preview/user-option APIs.

- [ ] **Step 4: Request review and fix findings**

Use `superpowers:requesting-code-review` from design base `71170bc15` to final head. Fix all Critical/Important findings in separate Lore commits and rerun focused regressions.

- [ ] **Step 5: Clean smoke artifacts and capture evidence**

Stop only branch-local backend/frontend/stub processes; remove only verified `.codex-smoke-*` and `.codex-translation-stub*` files; then run:

```powershell
git diff --check
git status --short
git log --oneline -15
```

Expected: clean worktree and traceable Lore commits.
