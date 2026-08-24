# Recall Campaign HTML Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let administrators author, preview, localize, and send unrestricted-layout recall emails as validated HTML while preserving existing plain-text campaigns and message snapshots.

**Architecture:** Add a focused HTML-template service that owns parsing, safety validation, translation-slot extraction, and contextual rendering. Keep the existing campaign and translator orchestration, but extend their contracts with `body_html`; expose a draft preview inside the existing `AdminAuth` route group; replace the oversized editor's body-text block with a focused HTML editor component using a sandboxed iframe.

**Tech Stack:** Go 1.25, Gin, Go `html/template`, `golang.org/x/net/html`, React 19, TypeScript 6, React Hook Form, TanStack Query, Zod, Base UI, Bun tests.

---

## File structure

- Create `service/recall_email_html.go`: HTML limits, parsed-document validation, allowlisted template actions, URL/CSS checks, localization slots, and HTML rendering.
- Create `service/recall_email_html_test.go`: focused security, localization-plan, and rendering tests.
- Modify `service/recall_contract.go`: add `BodyHTML` and preview request/response contracts.
- Modify `service/recall_campaign.go`: normalize exactly one body representation and call HTML validation before translation or persistence.
- Modify `service/recall_email.go`: dispatch HTML templates to the new renderer while preserving the current `BodyText` branch.
- Modify `service/recall_email_translation.go`: translate ordered visible-text slots instead of sending HTML to the model.
- Modify `service/recall_email_translation_test.go`: enforce the new strict translation schema and markup-preservation behavior.
- Modify `controller/recall_campaign.go`: decode and serve draft email preview requests.
- Modify `controller/recall_campaign_test.go`: cover preview success, validation failure, and non-persistence.
- Modify `router/api-router.go`: register the static preview endpoint inside the existing administrator route group.
- Create `router/recall_campaign_test.go`: prove route registration and unauthenticated rejection.
- Modify `web/default/src/features/recall-campaigns/types.ts`: add HTML and preview API types.
- Modify `web/default/src/features/recall-campaigns/schemas.ts`: require exactly one non-empty body representation and enforce the client-side size limit.
- Modify `web/default/src/features/recall-campaigns/api.ts` and `api.test.ts`: add the administrator preview request.
- Create `web/default/src/features/recall-campaigns/email-html.ts` and `email-html.test.ts`: starter HTML, legacy conversion, and cursor insertion helpers.
- Create `web/default/src/features/recall-campaigns/components/campaign-email-html-editor.tsx` and its test: isolated HTML editing, variable insertion, preview request, validation feedback, and sandboxed iframe.
- Modify `web/default/src/features/recall-campaigns/components/campaign-editor.tsx` and its test: integrate the focused component and preserve hidden generated locales.
- Modify all eight files under `web/default/src/i18n/locales/`: add real translations for new operator-visible copy.

Multi-node behavior does not require new coordination: validation and preview are stateless, while campaign revisions and queued `TemplateSnapshot` values continue to use the existing database-backed concurrency and delivery model.

### Task 1: Add the HTML template contract and validator

**Files:**
- Modify: `service/recall_contract.go:78-81`
- Create: `service/recall_email_html.go`
- Create: `service/recall_email_html_test.go`

- [ ] **Step 1: Write failing contract and safety tests**

Add table-driven tests that accept a complete document with `<style>`, inline style, `<img src="https://...">`, static HTTP(S) links, and the required URL actions. Add rejection cases for both body fields being empty/non-empty, more than 100 KiB, `script`, `iframe`, `object`, `embed`, `form`, form controls, `base`, SVG/MathML, `on*` attributes, `srcdoc`, meta refresh, relative URLs, `javascript:`, `vbscript:`, `data:`, unsafe CSS, unknown actions, template functions/control structures, and required actions outside an anchor `href`.

Use a valid fixture that exercises all six fields:

```go
const validRecallHTML = `<!doctype html>
<html><head><style>.cta{background:#111;color:#fff}</style></head>
<body>
  <p>Hello {{.RecipientName}}</p>
  <p>{{.PromotionCodeMasked}} · {{.ProductSummary}} · {{.ExpiresAt}}</p>
  <a class="cta" href="{{.ClaimURL}}">Claim offer</a>
  <a href="https://flatkey.ai/help">Help</a>
  <a href="{{.UnsubscribeURL}}">Unsubscribe</a>
</body></html>`
```

- [ ] **Step 2: Run the validator tests to verify RED**

Run: `go test ./service -run 'TestRecallEmailHTMLValidate|TestRecallEmailTemplateBodyContract' -count=1`

Expected: FAIL because `BodyHTML` and the HTML parser do not exist.

- [ ] **Step 3: Extend the public template contract**

Change the struct to preserve old JSON and accept new HTML:

```go
type RecallEmailTemplate struct {
	Subject  string `json:"subject"`
	BodyText string `json:"body_text,omitempty"`
	BodyHTML string `json:"body_html,omitempty"`
}
```

Define the limits and parsed representation in the new file:

```go
const recallEmailHTMLMaxBytes = 100 * 1024

type recallEmailHTMLDocument struct {
	source string
	root   *html.Node
	slots  []recallEmailHTMLSlot
}

type recallEmailHTMLSlot struct {
	node      *html.Node
	attrIndex int
	value     string
}

func parseRecallEmailHTML(source string) (*recallEmailHTMLDocument, error)
func (document *recallEmailHTMLDocument) TranslationSegments() []string
func (document *recallEmailHTMLDocument) Rebuild(translations []string) (string, error)
```

Alias `golang.org/x/net/html` as `html` and the standard template package as `htmltemplate` where both are needed. Do not add a dependency; `golang.org/x/net` is already direct in `go.mod`.

- [ ] **Step 4: Implement structural, URL, CSS, and action validation**

Traverse the parsed tree once. Collect non-whitespace text nodes outside `<head>` and `<style>`, plus attributes named `alt`, `title`, or `aria-label`, as translation slots. Validate URL-bearing attributes (`href`, `src`, `background`, `poster`) with `net/url`; accept only absolute `http`/`https` URLs or exactly `{{.ClaimURL}}` / `{{.UnsubscribeURL}}` where appropriate.

Use explicit allow/deny helpers instead of mutation:

```go
func validateRecallEmailHTMLElement(node *html.Node) error
func validateRecallEmailHTMLAttribute(element string, attr html.Attribute) error
func validateRecallEmailURL(raw string, allowDynamic bool) error
func validateRecallEmailCSS(raw string) error
func validateRecallEmailTemplateActions(source string) error
```

The CSS normalizer must remove comments and ASCII whitespace, lowercase the result, and reject `expression(`, `javascript:`, `vbscript:`, `data:`, `@import`, `behavior:`, and `-moz-binding`. Reject every attribute whose lowercase name starts with `on`.

Parse the document with `html/template` using `Option("missingkey=error")`, then walk `text/template/parse` nodes. Allow only `FieldNode` values matching the six documented field names and normal text; reject `IfNode`, `RangeNode`, `WithNode`, `TemplateNode`, `CommandNode` calls with more than the one field argument, variables, identifiers, and function calls.

Record `ClaimURL` and `UnsubscribeURL` only when their action is the entire parsed `href` value on an `<a>` element; require both before returning success.

- [ ] **Step 5: Implement safe localization rebuilding**

Clone the parsed tree for every rebuild, replace text-node slots with translated text and accessibility-attribute slots with translated attribute values, serialize with `html.Render`, and call `parseRecallEmailHTML` on the rebuilt output. Require the translation count to equal the original slot count and the rendered bytes to remain within the limit.

- [ ] **Step 6: Run validator tests to verify GREEN**

Run: `go test ./service -run 'TestRecallEmailHTMLValidate|TestRecallEmailTemplateBodyContract|TestRecallEmailHTMLTranslationPlan' -count=1`

Expected: PASS.

- [ ] **Step 7: Commit the contract and validator**

```text
git add service/recall_contract.go service/recall_email_html.go service/recall_email_html_test.go
git commit -m "Protect operator-authored recall email HTML" -m "Constraint: Administrators need unrestricted layout control without active content or unsafe navigation." -m "Rejected: Silent sanitization | It would change operator designs without an explicit error." -m "Confidence: high" -m "Scope-risk: moderate" -m "Tested: go test ./service -run 'TestRecallEmailHTMLValidate|TestRecallEmailTemplateBodyContract|TestRecallEmailHTMLTranslationPlan' -count=1"
```

### Task 2: Render HTML while preserving legacy delivery

**Files:**
- Modify: `service/recall_email.go:35-45,606-634`
- Modify: `service/recall_campaign.go:1420-1438`
- Modify: `service/recall_email_test.go:43-182`
- Modify: `service/recall_campaign_test.go`

- [ ] **Step 1: Write failing renderer and normalization tests**

Cover these contracts:

```go
template := RecallEmailTemplate{Subject: "Return", BodyHTML: validRecallHTML}
subject, body, err := RenderRecallEmail(RecallEmailRenderInput{
	Language: "en", Template: template,
	RecipientName: `<Admin & Co>`, PromotionCodeMasked: `SAVE****25`,
	ProductSummary: `Top-ups & subscriptions`, ExpiresAt: 1_900_000_000,
	ClaimURL: `https://flatkey.ai/claim?a=1&b=2`,
	UnsubscribeURL: `https://flatkey.ai/unsubscribe?a=1&b=2`,
})
require.NoError(t, err)
require.Equal(t, "Return", subject)
require.Contains(t, body, `&lt;Admin &amp; Co&gt;`)
require.Contains(t, body, `href="https://flatkey.ai/claim?a=1&amp;b=2"`)
require.NotContains(t, body, recallEmailCopyByLanguage["en"].GreetingPrefix)
```

Also retain the existing `BodyText` escaping/wrapper assertions, reject both bodies at campaign normalization, accept either one, and prove a stored `TemplateSnapshot` remains unchanged after an active campaign update.

- [ ] **Step 2: Run renderer tests to verify RED**

Run: `go test ./service -run 'TestRecallEmailRender|TestNormalizeRecallEmailTemplate|TestRecallCampaignActiveTemplateVersioning' -count=1`

Expected: FAIL because HTML is ignored and normalization still requires `BodyText`.

- [ ] **Step 3: Add a formatted expiry value for templates**

Keep the Unix input used by the worker, but execute the HTML template with a dedicated view so `ExpiresAt` is already a stable UTC string:

```go
type recallEmailHTMLRenderData struct {
	RecipientName       string
	PromotionCodeMasked string
	ProductSummary      string
	ExpiresAt           string
	ClaimURL            string
	UnsubscribeURL      string
}
```

Compile and execute the previously validated source with `html/template` and `missingkey=error`. Enforce the 100 KiB post-render limit.

- [ ] **Step 4: Dispatch the renderer by body representation**

At the top of `RenderRecallEmail`, keep subject CR/LF validation and add:

```go
if strings.TrimSpace(input.Template.BodyHTML) != "" {
	body, renderErr := renderRecallEmailHTML(input.Template.BodyHTML, input)
	if renderErr != nil {
		return "", "", renderErr
	}
	return input.Template.Subject, body, nil
}
```

Leave the existing paragraph escaping and fixed system copy below this branch unchanged for `BodyText` snapshots.

- [ ] **Step 5: Normalize exactly one body representation**

Update `normalizeRecallEmailTemplate` to trim both bodies and apply this decision:

```go
hasText := template.BodyText != ""
hasHTML := template.BodyHTML != ""
if hasText == hasHTML {
	return RecallEmailTemplate{}, fmt.Errorf(
		"recall email stage %d language %q requires exactly one of body_text or body_html",
		stageNo, language,
	)
}
if hasHTML {
	if _, err := parseRecallEmailHTML(template.BodyHTML); err != nil {
		return RecallEmailTemplate{}, fmt.Errorf(
			"recall email stage %d language %q body_html: %w", stageNo, language, err,
		)
	}
}
```

Keep the 2,000-rune limit only for `BodyText`; enforce byte limits inside the HTML parser.

- [ ] **Step 6: Run renderer and campaign tests to verify GREEN**

Run: `go test ./service -run 'TestRecallEmailRender|TestNormalizeRecallEmailTemplate|TestRecallCampaign.*Template' -count=1`

Expected: PASS, including the unmodified legacy renderer tests.

- [ ] **Step 7: Commit rendering compatibility**

```text
git add service/recall_email.go service/recall_email_test.go service/recall_campaign.go service/recall_campaign_test.go
git commit -m "Render recall HTML without a fixed wrapper" -m "Constraint: Existing body_text snapshots must retain byte-compatible escaped delivery behavior." -m "Rejected: Migrating queued messages | Snapshot immutability is part of recall delivery correctness." -m "Confidence: high" -m "Scope-risk: moderate" -m "Tested: go test ./service -run 'TestRecallEmailRender|TestNormalizeRecallEmailTemplate|TestRecallCampaign.*Template' -count=1"
```

### Task 3: Localize visible HTML text without exposing markup to AI

**Files:**
- Modify: `service/recall_email_translation.go:107-124,280-390,377-405,450-540`
- Modify: `service/recall_email_translation_test.go`
- Modify: `service/recall_campaign_test.go`

- [ ] **Step 1: Write failing request-schema and restoration tests**

Change test fixtures so one English stage uses `BodyHTML: validRecallHTML` and another legacy fixture uses `BodyText`. Decode the outbound Responses API request with `common.Unmarshal` and assert:

- the request contains `subject` and `body_segments` only;
- no request string contains `<html`, `<a`, `href=`, `style=`, image URLs, claim URLs, or unsubscribe URLs;
- button text, paragraphs, `alt`, `title`, and `aria-label` values appear as ordered segments;
- each language response must return the exact segment count;
- rebuilt localized HTML preserves element names, CSS, static URLs, and all six actions;
- duplicated, missing, reordered, or modified protected actions fail before campaign persistence.

- [ ] **Step 2: Run translation tests to verify RED**

Run: `go test ./service -run 'TestRecallEmailTranslation|TestRecallCampaign.*Translation' -count=1`

Expected: FAIL because the translator still sends `body_text` and cannot restore HTML.

- [ ] **Step 3: Replace the AI wire schema with ordered segments**

Keep the public `RecallEmailTranslator` signature unchanged. Introduce internal wire types:

```go
type recallEmailTranslatedTemplate struct {
	Subject      string   `json:"subject"`
	BodySegments []string `json:"body_segments"`
}

type recallEmailProtectedStage struct {
	StageNo         int      `json:"stage_no"`
	Subject         string   `json:"subject"`
	BodySegments    []string `json:"body_segments"`
	subjectValues   []recallEmailProtectedValue
	segmentValues   [][]recallEmailProtectedValue
	htmlDocument    *recallEmailHTMLDocument
	legacyBodyText  bool
}
```

Update the strict JSON Schema so every localized template requires exactly `subject` and `body_segments`, where `body_segments` is an array of strings with at least one item.

- [ ] **Step 4: Protect and restore each segment independently**

For `BodyHTML`, call `parseRecallEmailHTML` and protect every returned segment. For `BodyText`, use a one-element segment slice. The outbound prompt must state that stage, language, array length, and item order cannot change and that no markup may be added.

On response:

```go
if len(translated.BodySegments) != len(protected.BodySegments) {
	return nil, fmt.Errorf(
		"invalid recall email translation output: stage %d language %s returned %d body segments; expected %d",
		stageNo, language, len(translated.BodySegments), len(protected.BodySegments),
	)
}
```

Restore protected actions per segment, then either set `BodyText` from the single restored value or call `htmlDocument.Rebuild(restoredSegments)` and set `BodyHTML`. Run `normalizeRecallEmailTemplate` on every reconstructed locale before returning it to campaign persistence.

- [ ] **Step 5: Preserve reuse and failure atomicity**

Do not change `localizeRecallEmailStages`, `reusableRecallEmailTemplates`, or optimistic `config_revision` semantics beyond comparing the extended template struct. Add campaign tests proving unchanged English HTML reuses all stored locales without a translator call and changed English HTML replaces every generated locale together.

- [ ] **Step 6: Run translation tests to verify GREEN**

Run: `go test ./service -run 'TestRecallEmailTranslation|TestRecallCampaign.*Translation' -count=1`

Expected: PASS.

- [ ] **Step 7: Commit HTML-safe localization**

```text
git add service/recall_email_translation.go service/recall_email_translation_test.go service/recall_campaign_test.go
git commit -m "Translate recall copy without exposing HTML" -m "Constraint: Eight-language generation must preserve operator markup, links, styles, images, and actions exactly." -m "Rejected: Asking the model to return HTML | Model output could corrupt executable structure or destinations." -m "Confidence: high" -m "Scope-risk: moderate" -m "Tested: go test ./service -run 'TestRecallEmailTranslation|TestRecallCampaign.*Translation' -count=1"
```

### Task 4: Add an administrator-only production-renderer preview

**Files:**
- Modify: `service/recall_contract.go`
- Modify: `controller/recall_campaign.go:15-30,110-135`
- Modify: `controller/recall_campaign_test.go`
- Modify: `router/api-router.go:183-202`
- Create: `router/recall_campaign_test.go`

- [ ] **Step 1: Write failing service/controller/route tests**

Add controller tests that POST an unsaved template, assert the response includes the rendered HTML with deterministic sample data, assert invalid HTML returns a failure envelope, and verify no campaign/message rows are created. Add router tests modeled on `router/registration_domain_risk_test.go` that assert `POST /api/recall-campaigns/email-preview` is registered and returns `401` without an administrator session.

- [ ] **Step 2: Run preview tests to verify RED**

Run: `go test ./controller ./router -run 'TestRecallCampaignEmailPreview|TestRecallEmailPreviewRoute' -count=1`

Expected: FAIL because the DTO, handler, and route do not exist.

- [ ] **Step 3: Add preview contracts and pure service function**

Add:

```go
type RecallEmailPreviewRequest struct {
	Template RecallEmailTemplate `json:"template"`
}

type RecallEmailPreviewResponse struct {
	Subject  string `json:"subject"`
	BodyHTML string `json:"body_html"`
}

func PreviewRecallEmail(request RecallEmailPreviewRequest) (RecallEmailPreviewResponse, error)
```

`PreviewRecallEmail` normalizes the template as stage 1, language `en`, then calls `RenderRecallEmail` with fixed sample values: recipient `Ada`, masked code `SAVE****25`, a UTC expiry, an example Flatkey product summary, and HTTPS claim/unsubscribe URLs. It performs no database or translation call.

- [ ] **Step 4: Add the thin controller and route**

Implement the handler with repository-standard wrappers:

```go
func PreviewRecallEmailTemplate(c *gin.Context) {
	var request service.RecallEmailPreviewRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiError(c, err)
		return
	}
	preview, err := service.PreviewRecallEmail(request)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, preview)
}
```

Register the static route before `/:id` inside the existing group:

```go
recallCampaignRoute.POST("/email-preview", controller.PreviewRecallEmailTemplate)
```

Do not add a second auth check in the controller; the enclosing group already uses `middleware.AdminAuth()`.

- [ ] **Step 5: Run preview tests to verify GREEN**

Run: `go test ./controller ./router -run 'TestRecallCampaignEmailPreview|TestRecallEmailPreviewRoute' -count=1`

Expected: PASS.

- [ ] **Step 6: Commit the preview API**

```text
git add service/recall_contract.go controller/recall_campaign.go controller/recall_campaign_test.go router/api-router.go router/recall_campaign_test.go
git commit -m "Preview recall HTML through the delivery renderer" -m "Constraint: Preview must remain inside the existing administrator authorization boundary and must not persist drafts." -m "Rejected: Browser-only rendering | It could diverge from production template escaping and validation." -m "Confidence: high" -m "Scope-risk: narrow" -m "Tested: go test ./controller ./router -run 'TestRecallCampaignEmailPreview|TestRecallEmailPreviewRoute' -count=1"
```

### Task 5: Extend the Console contract and legacy conversion

**Files:**
- Modify: `web/default/src/features/recall-campaigns/types.ts:71-80`
- Modify: `web/default/src/features/recall-campaigns/schemas.ts:167-205`
- Modify: `web/default/src/features/recall-campaigns/api.ts:1-105`
- Modify: `web/default/src/features/recall-campaigns/api.test.ts`
- Create: `web/default/src/features/recall-campaigns/email-html.ts`
- Create: `web/default/src/features/recall-campaigns/email-html.test.ts`
- Modify: `web/default/src/features/recall-campaigns/helpers.ts`
- Modify: `web/default/src/features/recall-campaigns/helpers.test.ts`

- [ ] **Step 1: Write failing schema, API, and helper tests**

Assert that the client schema accepts exactly one body, rejects neither/both, rejects HTML over 100 KiB, and preserves hidden localized `body_html` values. Assert the preview wrapper posts to `/api/recall-campaigns/email-preview` with `{ template }`.

Add pure-helper expectations:

```ts
expect(convertRecallBodyTextToHtml('Hello\nSecond line')).toContain('<p>Hello</p>')
expect(convertRecallBodyTextToHtml('Hello')).toContain('{{.ClaimURL}}')
expect(convertRecallBodyTextToHtml('Hello')).toContain('{{.UnsubscribeURL}}')

expect(insertRecallEmailAction('abc', 1, 2, '{{.ClaimURL}}')).toEqual({
  value: 'a{{.ClaimURL}}c',
  selection: 14,
})
```

- [ ] **Step 2: Run frontend contract tests to verify RED**

Run from `web/default`: `bun test src/features/recall-campaigns/api.test.ts src/features/recall-campaigns/email-html.test.ts src/features/recall-campaigns/helpers.test.ts`

Expected: FAIL because HTML fields, preview API, and helpers do not exist.

- [ ] **Step 3: Add TypeScript contracts and API wrapper**

Use optional wire fields for old server records:

```ts
export interface RecallEmailTemplate {
  subject: string
  body_text?: string
  body_html?: string
}

export interface RecallEmailPreviewRequest {
  template: RecallEmailTemplate
}

export interface RecallEmailPreviewResponse {
  subject: string
  body_html: string
}
```

Add:

```ts
export async function previewRecallEmail(
  request: RecallEmailPreviewRequest
): Promise<ApiResponse<RecallEmailPreviewResponse>> {
  const response = await api.post('/api/recall-campaigns/email-preview', request)
  return requireRecallSuccess(response.data)
}
```

- [ ] **Step 4: Implement schema and normalization**

Define both body strings as optional/default-empty, then use `superRefine` to count trimmed non-empty representations and attach the error to `body_html`. Count HTML size with `new TextEncoder().encode(value).length`, not UTF-16 `.length`.

In form normalization, retain every non-English template unchanged. For English legacy data, generate editable HTML and clear `body_text`; for new stages use exported `RECALL_EMAIL_STARTER_HTML`. Submission keeps `body_text: ''` and sends `body_html` so the backend exact-one rule remains authoritative.

- [ ] **Step 5: Implement starter HTML and cursor insertion**

The starter must be a complete, neutral document that operators can delete or replace. It includes no locked Flatkey wrapper, but it must contain sample responsive CSS and both required action links. Export this exact API:

```ts
export const RECALL_EMAIL_ACTIONS = [
  '{{.RecipientName}}',
  '{{.PromotionCodeMasked}}',
  '{{.ProductSummary}}',
  '{{.ExpiresAt}}',
  '{{.ClaimURL}}',
  '{{.UnsubscribeURL}}',
] as const

export function convertRecallBodyTextToHtml(bodyText: string): string
export function insertRecallEmailAction(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  action: (typeof RECALL_EMAIL_ACTIONS)[number]
): { value: string; selection: number }
```

Escape legacy text before placing it in `<p>` nodes.

- [ ] **Step 6: Run frontend contract tests to verify GREEN**

Run from `web/default`: `bun test src/features/recall-campaigns/api.test.ts src/features/recall-campaigns/email-html.test.ts src/features/recall-campaigns/helpers.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the Console contract**

```text
git add web/default/src/features/recall-campaigns/types.ts web/default/src/features/recall-campaigns/schemas.ts web/default/src/features/recall-campaigns/api.ts web/default/src/features/recall-campaigns/api.test.ts web/default/src/features/recall-campaigns/email-html.ts web/default/src/features/recall-campaigns/email-html.test.ts web/default/src/features/recall-campaigns/helpers.ts web/default/src/features/recall-campaigns/helpers.test.ts
git commit -m "Prepare recall drafts for operator HTML" -m "Constraint: Old body_text records must open safely while server-generated locales stay intact." -m "Rejected: A new editor dependency | Existing form and textarea primitives cover the required workflow." -m "Confidence: high" -m "Scope-risk: moderate" -m "Tested: bun test src/features/recall-campaigns/api.test.ts src/features/recall-campaigns/email-html.test.ts src/features/recall-campaigns/helpers.test.ts"
```

### Task 6: Build the HTML editor and sandboxed preview

**Files:**
- Create: `web/default/src/features/recall-campaigns/components/campaign-email-html-editor.tsx`
- Create: `web/default/src/features/recall-campaigns/components/campaign-email-html-editor.test.tsx`
- Modify: `web/default/src/features/recall-campaigns/components/campaign-editor.tsx:842-965`
- Modify: `web/default/src/features/recall-campaigns/components/campaign-editor.test.tsx:170-260`

- [ ] **Step 1: Write failing component tests**

Use the repository's existing `renderToStaticMarkup` pattern with a real `useForm` test harness. Assert that the textarea registers `email_sequence.0.templates.en.body_html`, no English `body_text` control renders, all six insertion buttons have accessible labels, and terminal campaigns disable the textarea and preview button. Export a small presentational `RecallEmailPreviewFrame` from the same module and render it directly with HTML/error props to assert that:

- successful HTML is assigned through `srcDoc` rather than `dangerouslySetInnerHTML`;
- the iframe has a present but empty `sandbox` attribute with no `allow-scripts`, `allow-same-origin`, `allow-popups`, or top-navigation tokens;
- localized validation feedback renders without deleting the last successful HTML.

Cursor replacement is already covered as a pure function in Task 5, the Axios path is covered in `api.test.ts`, and the complete click-to-preview interaction is covered by the browser smoke step without adding a DOM-test dependency.

- [ ] **Step 2: Run component tests to verify RED**

Run from `web/default`: `bun test src/features/recall-campaigns/components/campaign-email-html-editor.test.tsx src/features/recall-campaigns/components/campaign-editor.test.tsx`

Expected: FAIL because the component is absent and the parent still renders `body_text`.

- [ ] **Step 3: Implement the focused component**

Use explicit props and avoid destructuring per repository conventions:

```ts
interface CampaignEmailHtmlEditorProps {
  form: UseFormReturn<RecallCampaignDraft>
  index: number
  disabled: boolean
}

export function CampaignEmailHtmlEditor(
  props: CampaignEmailHtmlEditorProps
): React.JSX.Element
```

Use a textarea ref to read `selectionStart`/`selectionEnd`, call `form.setValue` with `{ shouldDirty: true, shouldValidate: true }`, then restore focus and selection in `requestAnimationFrame`.

Use `useMutation({ mutationFn: previewRecallEmail })`. On preview, call `form.trigger` for the English subject/body paths; do not request the backend if local validation fails. Store the last successful `body_html` string separately from the latest error so a failed retry does not erase the prior preview.

Render the iframe as:

```tsx
<iframe
  title={t('Recall email preview')}
  sandbox=''
  srcDoc={previewHTML}
  className='h-[640px] w-full rounded-md border bg-white'
/>
```

Do not use `dangerouslySetInnerHTML` and do not add sandbox permissions.

- [ ] **Step 4: Integrate it into the campaign editor**

Keep subject and delay controls in `campaign-editor.tsx`, replace the body-text block with `<CampaignEmailHtmlEditor form={form} index={index} disabled={terminal} />`, and use starter HTML for new stages. Preserve current stage removal, template-version display, automatic-localization guidance, and immutable/terminal rules.

- [ ] **Step 5: Run component tests to verify GREEN**

Run from `web/default`: `bun test src/features/recall-campaigns/components/campaign-email-html-editor.test.tsx src/features/recall-campaigns/components/campaign-editor.test.tsx`

Expected: PASS.

- [ ] **Step 6: Run TypeScript validation before committing**

Run from `web/default`: `bun run typecheck`

Expected: exit 0 with no TypeScript diagnostics.

- [ ] **Step 7: Commit the editor and preview**

```text
git add web/default/src/features/recall-campaigns/components/campaign-email-html-editor.tsx web/default/src/features/recall-campaigns/components/campaign-email-html-editor.test.tsx web/default/src/features/recall-campaigns/components/campaign-editor.tsx web/default/src/features/recall-campaigns/components/campaign-editor.test.tsx
git commit -m "Give administrators a safe recall HTML preview" -m "Constraint: Operator HTML must never be inserted into the Console parent DOM or receive iframe execution permissions." -m "Rejected: dangerouslySetInnerHTML | It would create a stored-XSS boundary inside the administrator Console." -m "Confidence: high" -m "Scope-risk: moderate" -m "Tested: focused Bun component tests and bun run typecheck"
```

### Task 7: Localize the Console and run the release gate

**Files:**
- Modify: `web/default/src/i18n/locales/en.json`
- Modify: `web/default/src/i18n/locales/zh.json`
- Modify: `web/default/src/i18n/locales/es.json`
- Modify: `web/default/src/i18n/locales/fr.json`
- Modify: `web/default/src/i18n/locales/pt.json`
- Modify: `web/default/src/i18n/locales/ru.json`
- Modify: `web/default/src/i18n/locales/ja.json`
- Modify: `web/default/src/i18n/locales/vi.json`
- Modify generated reports under `web/default/src/i18n/locales/_reports/` only if the sync script changes tracked files.

- [ ] **Step 1: Add every new operator-visible key to all eight locale files**

Include real translations for at least these source keys used by the component:

```text
HTML body
Insert variable
Preview email
Recall email preview
Preview uses sample recipient and offer data.
HTML may include inline styles, images, and HTTP or HTTPS links. Scripts and forms are rejected.
Claim and unsubscribe links are required.
Email preview failed
Body HTML must be 100 KiB or smaller
Provide exactly one email body format
```

Do not copy English values into non-English catalogs except technical literals such as HTML, HTTP, and HTTPS.

- [ ] **Step 2: Synchronize and audit i18n**

Run from `web/default`: `bun run i18n:sync`

Expected: exit 0. Inspect `_reports/{lang}.untranslated.json` and verify none of the keys added in Step 1 appear in any report.

- [ ] **Step 3: Format Go before final verification**

Run: `gofmt -w service/recall_contract.go service/recall_email_html.go service/recall_email_html_test.go service/recall_email.go service/recall_email_test.go service/recall_campaign.go service/recall_campaign_test.go service/recall_email_translation.go service/recall_email_translation_test.go controller/recall_campaign.go controller/recall_campaign_test.go router/api-router.go router/recall_campaign_test.go`

Expected: exit 0 and no unexpected files change.

- [ ] **Step 4: Run focused backend tests**

Run: `go test ./service ./controller ./router -run 'RecallEmail|RecallCampaign.*Template|RecallCampaign.*Translation' -count=1`

Expected: PASS.

- [ ] **Step 5: Run complete affected backend packages and build**

Run: `go test ./service/... ./controller/... ./router/...`

Run: `go build ./...`

Expected: both commands exit 0.

- [ ] **Step 6: Run the complete recall frontend tests and quality checks**

Run from `web/default`:

```text
bun test src/features/recall-campaigns
bun run typecheck
bun run lint
bun run format:check
bun run copyright:check
bun run build:check
```

Expected: every command exits 0. If repository-wide lint or format reports pre-existing unrelated failures, record the exact files and still require every changed file to pass its targeted check.

- [ ] **Step 7: Browser-smoke the administrator flow**

Run the Go API and `bun run dev`, sign in as an administrator, open `/recall-campaigns`, and verify this path:

1. Create a stage from starter HTML.
2. Paste a responsive complete HTML document with a remote image and an HTTPS Flatkey button.
3. Insert claim and unsubscribe actions from the controls.
4. Preview and confirm the document renders inside the iframe without changing the Console page.
5. Confirm a script, a `javascript:` link, and a missing unsubscribe link each show a backend validation error.
6. Save, reopen, and verify HTML is preserved; confirm a non-administrator is redirected to `/403` and the preview API returns unauthorized.

- [ ] **Step 8: Commit localization and verification fixes**

```text
git add web/default/src/i18n/locales
git commit -m "Explain recall HTML editing in every Console language" -m "Constraint: All administrator-visible Console copy must be translated across the eight maintained locale catalogs." -m "Confidence: high" -m "Scope-risk: narrow" -m "Tested: i18n sync, Go affected-package tests and build, recall Bun tests, typecheck, lint, format, copyright, build, and browser smoke flow"
```

## Completion evidence

Before declaring completion, capture:

- the final commit list and a clean `git status --short`;
- passing focused and package-wide Go test output;
- passing recall Bun tests, typecheck, lint, formatting, copyright, and production build output;
- an administrator preview screenshot or browser-test note covering the sandbox and rich HTML;
- confirmation that the implementation adds no dependency and no database migration;
- deployment scope: `newapi-console`/legacy Go application and the embedded default Console frontend require deployment; production router nodes do not require deployment because the change is confined to administrator `/api` routes, recall workers, and Console assets and does not affect `/v1` relay paths.
