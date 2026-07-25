# Recall Campaign HTML Email Design

## Goal

Allow Flatkey administrators to author visually rich recall emails as complete HTML without locking operators into a product-owned layout. The feature must preserve the existing administrator-only access boundary, automatic localization, delivery-time dynamic values, and queued-message template snapshots.

## Current behavior

- Recall campaign navigation and pages require the administrator role.
- Every `/api/recall-campaigns` endpoint is protected by `middleware.AdminAuth()`.
- SMTP sends recall content as `text/html`, but the campaign contract stores only `body_text`.
- `RenderRecallEmail` escapes `body_text` and inserts it into a fixed Flatkey-owned wrapper, so operator-provided markup is displayed as text.
- Operators edit only the English subject and body. Saving generates seven localized templates for `zh`, `es`, `fr`, `pt`, `ru`, `ja`, and `vi`.
- Scheduled messages store `TemplateVersion` and `TemplateSnapshot`, protecting them from later campaign edits.

## Scope

This change will:

1. Add administrator-authored HTML bodies to recall email templates.
2. Allow complete documents, inline styles, `<style>` blocks, remote images, and arbitrary absolute HTTP or HTTPS links.
3. Preserve automatic translation while translating only human-readable content.
4. Add an administrator-only preview that uses the production renderer.
5. Keep existing `body_text` campaigns and queued messages sendable.

This change will not add a WYSIWYG editor, a fixed brand wrapper, embedded/base64 images, attachments, manual editing of the seven generated locales, JavaScript, forms, or multipart plain-text fallback.

## Chosen approach

Use raw administrator-authored HTML with server-side validation, a small allowlisted template-variable surface, and a sandboxed iframe preview.

Rejected alternatives:

- A Flatkey-owned wrapper plus editable text was rejected because it fixes the visual structure and does not give operators the requested freedom.
- Structured fields for button text, button URL, colors, and sections were rejected because every new design would require a product change.
- Restricting links to Flatkey domains was rejected because administrators may need future campaign and partner destinations.
- Sending the complete HTML document to the translation model was rejected because the model could damage markup, CSS, links, or template actions.

## Authorization

The existing security boundary remains authoritative:

- The sidebar item remains in the `admin` section.
- Both recall campaign routes retain the `ROLE.ADMIN` guard.
- Create, update, preview, activation, and delivery-management APIs remain under the `/api/recall-campaigns` group protected by `middleware.AdminAuth()`.

Frontend visibility is not treated as authorization. Server-side administrator authentication is required for every HTML-template operation.

## Template contract and compatibility

Extend `RecallEmailTemplate` with an optional `body_html` field while retaining `body_text`:

```json
{
  "subject": "Your Flatkey offer is ready",
  "body_html": "<!doctype html><html>...</html>",
  "body_text": ""
}
```

Rules:

- New templates created by the Console use `body_html`.
- A template must contain exactly one non-empty body representation after normalization.
- Existing records containing only `body_text` continue through the current escaped fixed-wrapper renderer.
- Editing a legacy template in the new Console converts its English body to starter HTML. The save creates a new template version; already scheduled snapshots are unchanged.
- The language-keyed template map remains JSON stored in the existing text columns, so no database migration is required.

## Supported dynamic values

HTML bodies may use only these Go-template field actions:

- `{{.RecipientName}}`
- `{{.PromotionCodeMasked}}`
- `{{.ProductSummary}}`
- `{{.ExpiresAt}}`
- `{{.ClaimURL}}`
- `{{.UnsubscribeURL}}`

The full promotion code remains unavailable. Claiming continues through the system-generated claim URL.

The subject remains single-line plain text and does not support template actions in this change. Arbitrary static HTTP or HTTPS destinations may be written directly into HTML attributes.

Every HTML template must use `{{.ClaimURL}}` and `{{.UnsubscribeURL}}` in link destinations. Validation checks the parsed attributes rather than accepting the strings in comments or visible text.

## HTML validation

Validation runs on the server during create, update, and preview. The frontend may mirror validation for faster feedback but is not authoritative.

The validator will:

1. Enforce a 200-character single-line subject and a 100 KiB HTML limit. The localized and rendered result must also remain below 100 KiB to avoid common email-client clipping.
2. Parse the document with the existing `golang.org/x/net/html` dependency and reject malformed or structurally unsafe input.
3. Reject active-content or embedding elements, including `script`, `iframe`, `object`, `embed`, `form`, form controls, `base`, SVG, and MathML.
4. Reject event-handler attributes, `srcdoc`, meta refresh, and other navigation or execution hooks.
5. Permit only absolute HTTP and HTTPS values in URL-bearing attributes, plus the allowlisted URL template actions. Relative URLs, `javascript:`, `vbscript:`, and `data:` are rejected.
6. Permit `<style>` and inline `style`, but reject executable CSS patterns and non-HTTP(S) CSS URLs.
7. Parse the Go template with `missingkey=error`, reject non-allowlisted actions, and reject template functions or control structures outside the supported field substitutions.
8. Verify that claim and unsubscribe actions occur in valid link destinations.

Validation rejects the save rather than silently rewriting operator HTML. This makes errors visible and avoids unexpected visual changes.

## Automatic localization

Automatic localization continues for the seven existing target languages. The translation model never receives the HTML document.

For each stage, the server will:

1. Parse and validate the English HTML.
2. Produce an immutable HTML skeleton and an ordered set of translatable slots.
3. Include normal text nodes and accessibility text such as image `alt`, `title`, and `aria-label` values in those slots.
4. Exclude tags, attributes, CSS, URLs, and template actions from translation.
5. Send the English subject and ordered text slots through the existing strict Responses API translation path.
6. Require exactly one translated value for every slot in every target language and preserve protected template actions exactly.
7. Rebuild each localized HTML document from the original skeleton, contextually escape translated text, then run the full HTML and template validation again.

Any missing locale, stage mismatch, slot mismatch, changed protected action, invalid rebuilt document, timeout, or malformed model response rejects the save before database mutation. When English HTML has not changed and all localized templates exist, the stored translations are reused under the current behavior.

## Rendering and delivery

`RenderRecallEmail` selects behavior by template representation:

- `body_html`: compile the validated administrator document with Go `html/template`, execute it with the allowlisted render input, and return the resulting document without adding a product-owned wrapper.
- `body_text`: retain the current escaping and fixed-wrapper path for compatibility.

Go's contextual template escaping protects recipient values in text and attribute contexts. Missing or invalid values fail rendering. Claim and unsubscribe URLs continue to be generated at delivery time and never pass through the translation model.

Message scheduling continues to serialize the complete language map into `TemplateSnapshot`. Retries use the same snapshot, and later campaign edits affect only messages scheduled from the newer version.

## Administrator preview

Add an administrator-only draft preview endpoint under `/api/recall-campaigns`. It accepts one unsaved English subject/HTML template and returns the output of the same validator and renderer used by delivery, populated with deterministic sample values.

Preview does not call the translation service or persist data. Localized templates continue to be generated on save.

The Console email-stage editor will provide:

- A monospaced HTML textarea using existing components and no new editor dependency.
- A starter HTML document for new stages and converted legacy text.
- Short documentation and cursor insertion controls for the six supported variables.
- A preview action that sends the unsaved template to the backend.
- A sandboxed iframe using `srcDoc` without script, same-origin, popup, or top-navigation permissions.
- Inline display of backend validation errors.

The preview iframe may load administrator-configured HTTP(S) images. Link activation remains contained by the iframe sandbox.

## Error handling and atomicity

- Invalid HTML or template syntax returns a field-oriented validation error and does not call translation.
- Translation or localized-template validation failure aborts the save and leaves the previous campaign revision untouched.
- Optimistic `config_revision` checks remain the final concurrency fence.
- Preview failures return validation details without persisting a draft.
- Delivery-time failures follow the current recall retry and terminal-failure behavior and preserve the original template snapshot.
- Existing English-only or `body_text` snapshots continue to use current language fallback and compatibility rendering.

## Testing and verification

### Backend tests

- Accept complete HTML, inline CSS, `<style>`, remote images, static HTTP(S) links, and allowlisted variables.
- Reject dangerous tags, event handlers, meta refresh, unsafe URL schemes, unsafe CSS, unsupported template actions, missing required links, and oversized bodies.
- Verify contextual escaping for recipient names, product summaries, dates, and URLs.
- Verify `body_text` compatibility and preference for `body_html` when reading new snapshots.
- Verify the translator sees only subject/text slots and preserves markup, styles, URLs, images, slot order, and template actions across all languages.
- Verify translation and validation failures are atomic.
- Verify preview uses the production renderer and remains administrator-only.
- Verify scheduled and retried messages retain their original version and snapshot.

### Frontend tests

- Validate the `body_html` contract and legacy conversion behavior.
- Verify variable insertion, preview requests, validation messages, and sandbox attributes.
- Verify HTML values survive editor state normalization and unrelated campaign edits.
- Verify recall routes and menu remain administrator-only.

### Release checks

Run focused Go and Bun tests first, followed by Go formatting and tests, frontend typecheck, lint, build, and a browser smoke test of editing and previewing a representative rich email.

## Success criteria

1. An administrator can paste a complete responsive HTML email with images, styling, and arbitrary HTTP(S) buttons.
2. The preview matches the production renderer and cannot execute active content in the Console.
3. Saving produces eight valid templates while preserving layout, links, styles, images, and template actions.
4. Recipients receive the localized visible content with delivery-time claim and unsubscribe URLs.
5. Non-administrators cannot access any template or preview operation.
6. Existing campaigns and queued messages continue to send unchanged.
