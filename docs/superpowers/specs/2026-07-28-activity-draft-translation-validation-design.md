# Activity Draft Translation Validation Design

## Status

- Approved in conversation on 2026-07-28.
- Scope: Activity Configuration promotion drafts and the existing English-first translation flow.

## Problem

`Generate 7 translations` saves a new or dirty campaign before calling the revision-fenced translation endpoint. The save currently validates the entire promotion configuration, so an otherwise valid English email cannot be translated until at least one top-up or subscription product is selected. The Console then shows only `Please correct the highlighted fields`, even though the translation inputs are valid.

## Decision

Allow a promotion campaign in `draft` state to be created or updated with an empty product scope. Keep the existing save-before-generate sequence and the existing campaign ID/config revision translation endpoint.

This gives the normal authoring flow these rules:

1. The operator provides an activity name and valid English email content.
2. A new or dirty draft is saved without requiring product selection.
3. Translation generation uses the saved English revision and atomically returns all seven targets.
4. Preview and activation continue to require at least one valid Stripe Price and reject an incomplete product scope.
5. Publishing safety, localization freshness, and delivery behavior remain unchanged.

The English subject may remain empty; submission normalization continues to use the activity name. English remains the only translation source. Untouched target languages remain optional before generation, while partially edited target templates remain invalid.

## Validation Boundaries

### Draft persistence

- Continue validating the campaign name, audience shape, discount shape, scheduling values, promotion validity, and email sequence.
- Normalize product ID arrays when present.
- Permit both product ID arrays to be empty for a draft create or draft update.
- Do not resolve Stripe products or create Stripe resources during draft persistence.

### Preview and activation

- Require at least one top-up or subscription Stripe Price before Stripe preview or activation.
- Keep backend validation authoritative even if the Console is bypassed.
- Return the existing product-scope error without calling the translator or mutating campaign state.

### Translation generation

- Keep the existing persisted campaign ID and config revision fence.
- Do not add a stateless translation endpoint.
- Validate the activity name and English email sequence through the existing generation service.
- Preserve atomic all-language replacement and stale-revision rejection.

## Frontend Behavior

The editable draft schema permits an empty `product_scope`. Product selectors remain empty by default. Clicking `Generate 7 translations` on a new promotion draft with a valid activity name and English body performs `save -> generate` without showing the generic whole-form error.

Activation remains the point at which an empty product scope is surfaced as a blocker. No product is selected automatically.

## Alternatives Rejected

- **Stateless draft translation endpoint:** duplicates the existing revisioned generation path and makes local translations harder to reconcile with later persistence.
- **Keep the blocker and only improve the message:** explains the failure but still forces unrelated product configuration before email localization.
- **Default-select a product:** silently changes campaign eligibility and is unsafe.

## Compatibility and Risk

- No database migration or API shape change is required.
- Existing complete drafts and active campaigns retain their current behavior.
- The only relaxed boundary is persistence of an editable draft; preview, activation, Stripe resolution, and delivery remain strict.
- Multi-node translation correctness is unchanged because generation still uses the persisted config revision compare-and-swap path.

## Verification

- Frontend RED/GREEN test: a new promotion editor with a valid name and English template, empty product scope, and an opened translation-review tab saves then generates successfully.
- Frontend schema test: empty product scope is accepted for an editable draft; partially edited target templates are still rejected.
- Backend RED/GREEN test: draft create/update accepts empty products.
- Backend regression: activation and Stripe preview reject the same draft until a product is selected.
- Run targeted Recall frontend tests, TypeScript, scoped lint/format, production frontend build, targeted Recall service/controller tests, and `go build ./...`.
- Browser smoke on staging: create an unsaved promotion form, enter only the activity name plus English content, open Translation review, and confirm generation reaches the translation request without a product-scope validation error. Do not activate or send email.
