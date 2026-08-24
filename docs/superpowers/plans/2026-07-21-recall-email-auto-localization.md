# Recall Email Automatic Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist AI-generated recall email translations for all Console languages while operators edit only English and recipients receive language-matched email content.

**Architecture:** Add an injectable recall translator to the campaign service, enrich validated drafts before the existing database create/CAS update, and localize system-owned renderer copy with static translations. Keep the existing JSON template map and English delivery fallback for backward compatibility.

**Tech Stack:** Go, Gin request contexts, OpenAI-compatible Responses API, strict JSON Schema, GORM, React 19, react-hook-form, TypeScript, Bun/Vitest.

---

### Task 1: Add the recall AI translator

**Files:**
- Create: `service/recall_email_translation.go`
- Create: `service/recall_email_translation_test.go`

- [ ] **Step 1: Write failing tests for the translator contract**

Cover one request containing multiple stages, an exact seven-language response, Responses API endpoint normalization, strict JSON Schema, missing API key, retryable and non-retryable HTTP failures, oversized/malformed response, missing language, empty fields, multiline subject, and protected URL/template-token corruption.

- [ ] **Step 2: Run the translator tests and verify RED**

Run: `go test ./service -run 'TestRecallEmailTranslator|TestRecallEmailTranslation' -count=1`

Expected: FAIL because the translator types and implementation do not exist.

- [ ] **Step 3: Implement the minimal translator**

Define:

```go
type RecallEmailTranslator interface {
	Translate(ctx context.Context, stages []RecallEmailStage) (map[int]map[string]RecallEmailTemplate, error)
}

type RecallEmailTranslatorOptions struct {
	APIKey   string
	BaseURL  string
	Model    string
	Client   *http.Client
	MaxBytes int64
	Timeout  time.Duration
}
```

Use `common.Marshal` and `common.Unmarshal`, validate the endpoint with the repository SSRF settings, request strict structured output for `zh/es/fr/pt/ru/ja/vi`, and validate/restore protected sentinels before returning templates. Retry only temporary network failures, 408/429, and 5xx within the request timeout.

- [ ] **Step 4: Run the translator tests and verify GREEN**

Run: `go test ./service -run 'TestRecallEmailTranslator|TestRecallEmailTranslation' -count=1`

Expected: PASS with no real network request.

### Task 2: Enrich campaign drafts atomically

**Files:**
- Modify: `service/recall_campaign.go`
- Modify: `service/recall_campaign_test.go`
- Modify if required for test fixtures: `controller/recall_campaign_test.go`

- [ ] **Step 1: Write failing campaign tests**

Add fake-translator tests proving:

- a new English-only campaign stores all eight languages;
- translation failure creates no campaign row;
- unchanged English plus a complete localized set makes zero translator calls;
- a missing target language triggers repair;
- changed English replaces generated languages;
- client-submitted non-English content cannot override stored or generated translations;
- an activated campaign increments each changed stage's `template_version` once;
- a stale `config_revision` cannot overwrite the winner after translation.

- [ ] **Step 2: Run the campaign tests and verify RED**

Run: `go test ./service -run 'TestRecallCampaign.*Translat|TestRecallCampaign.*Localized' -count=1`

Expected: FAIL because the campaign service does not enrich templates.

- [ ] **Step 3: Implement minimal campaign integration**

Add a translator field to `RecallCampaignService`, a test constructor or setter that injects a fake, and a helper that compares normalized English templates with stored stages. Call the helper after validation and before `recallCampaignModelFromDraft` or the existing update CAS. Reuse complete stored translations only when English is unchanged.

- [ ] **Step 4: Run campaign tests and verify GREEN**

Run: `go test ./service -run 'TestRecallCampaign' -count=1`

Expected: PASS.

### Task 3: Localize system-owned email wrapper copy

**Files:**
- Modify: `service/recall_email.go`
- Modify: `service/recall_email_test.go`

- [ ] **Step 1: Write failing renderer tests**

For `en/zh/es/fr/pt/ru/ja/vi`, render an email and assert localized greeting, offer-code label, eligible-product label/summary, expiry label, claim link, and unsubscribe link. Add an unknown-language case that uses English.

- [ ] **Step 2: Run renderer tests and verify RED**

Run: `go test ./service -run 'TestRecallEmailRender.*Language' -count=1`

Expected: FAIL because wrapper copy is English-only.

- [ ] **Step 3: Implement the static localization table**

Add `Language string` to `RecallEmailRenderInput`, select a static copy bundle with English fallback, and pass the recipient language from the send path. Localize the product-summary variants without sending them through AI.

- [ ] **Step 4: Run renderer and worker tests and verify GREEN**

Run: `go test ./service -run 'TestRecallEmail' -count=1`

Expected: PASS.

### Task 4: Keep no-group mode canonical

**Files:**
- Modify: `web/default/src/features/recall-campaigns/helpers.ts`
- Modify: `web/default/src/features/recall-campaigns/helpers.test.ts`
- Modify: `web/default/src/features/recall-campaigns/components/campaign-editor.tsx`
- Modify: `web/default/src/features/recall-campaigns/components/campaign-editor.test.tsx`

- [ ] **Step 1: Write failing group normalization and rendered-state tests**

Assert that no-filter returns `groups: []`, allow/block preserve groups, the visible group input is disabled in no-filter mode, and switching to no-filter calls the canonical normalization path.

- [ ] **Step 2: Run tests and verify RED**

Run: `bun test src/features/recall-campaigns/helpers.test.ts src/features/recall-campaigns/components/campaign-editor.test.tsx`

Expected: FAIL because no-filter does not clear or disable the field.

- [ ] **Step 3: Implement the minimal interaction**

Add `normalizeRecallGroupsForMode`, watch `audience_config.group_mode`, associate the input label and ID, disable for no-filter or immutable state, and clear groups in the mode-change handler.

- [ ] **Step 4: Run targeted tests and verify GREEN**

Run: `bun test src/features/recall-campaigns/helpers.test.ts src/features/recall-campaigns/components/campaign-editor.test.tsx`

Expected: PASS.

### Task 5: Make the Console English-only for email editing

**Files:**
- Modify: `web/default/src/features/recall-campaigns/components/campaign-editor.tsx`
- Modify: `web/default/src/features/recall-campaigns/components/campaign-editor.test.tsx`
- Modify: `web/default/src/i18n/locales/en.json`
- Modify: `web/default/src/i18n/locales/zh.json`
- Modify: `web/default/src/i18n/locales/es.json`
- Modify: `web/default/src/i18n/locales/fr.json`
- Modify: `web/default/src/i18n/locales/pt.json`
- Modify: `web/default/src/i18n/locales/ru.json`
- Modify: `web/default/src/i18n/locales/ja.json`
- Modify: `web/default/src/i18n/locales/vi.json`

- [ ] **Step 1: Write failing editor tests**

Assert that Template language is absent, English subject/body values render, hidden non-English templates remain in the form value, and localized automatic-translation guidance is present.

- [ ] **Step 2: Run editor tests and verify RED**

Run: `bun test src/features/recall-campaigns/components/campaign-editor.test.tsx`

Expected: FAIL because the language selector still renders.

- [ ] **Step 3: Implement the English-only editor**

Remove active-language state and the selector. Register only `templates.en.subject` and `templates.en.body_text`. Do not normalize away non-English keys. Add one `t()` guidance key and genuine translations in all eight locale files.

- [ ] **Step 4: Run frontend validation**

Run from `web/default`:

```text
bun test src/features/recall-campaigns
bun run typecheck
bun x eslint src/features/recall-campaigns
bun x prettier --check src/features/recall-campaigns src/i18n/locales
bun run i18n:sync
bun run build:check
```

Expected: all commands exit successfully; reports contain no newly introduced untranslated key.

### Task 6: Integration review and release preparation

**Files:**
- Review all files changed by Tasks 1-5
- Update: GitHub PR `SolveaCX/new-api#453`

- [ ] **Step 1: Run backend validation**

Run:

```text
go test ./service/... ./controller/... ./setting/operation_setting/... -count=1
go build ./...
git diff --check
```

Expected: all commands exit successfully.

- [ ] **Step 2: Run two-stage review**

First verify exact design/spec compliance. Then perform code-quality, security, multi-node, and deployment-scope review. Fix every Critical or Important finding and re-run affected tests.

- [ ] **Step 3: Commit with the Lore protocol and push the feature branch**

Push only `feature/stripe-user-winback` and update PR 453. Do not merge or push `main`.

- [ ] **Step 4: Promote only verified feature commits to staging**

Refresh `origin/staging`, cherry-pick only the new group/localization commits, run a scope check, push `staging`, wait for the staging workflow and health check, then smoke-test the recall editor without creating a real campaign unless the staging AI configuration and test data are safe.
