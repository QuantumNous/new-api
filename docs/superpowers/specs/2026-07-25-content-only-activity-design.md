# Content-Only Activity Design

## Goal

Extend the existing administrator-only Activity Configuration feature with an explicit content-only campaign type. A content-only activity reuses the existing audience selection, exact-recipient targeting, registration-date targeting, scheduling, recurrence, multi-stage email delivery, localization, unsubscribe handling, runtime gate, and audit behavior while performing no Stripe work.

The two stored campaign types are:

- `promotion`: the current Stripe Coupon and Promotion Code workflow;
- `content_only`: email content delivery without Stripe product validation, Coupon creation, Customer creation, Promotion Code creation, offer claims, or discount attribution.

This campaign type is distinct from an existing email-only recipient. An email-only recipient has no Flatkey user row and can participate in either campaign type. A content-only campaign may target registered users, selected users, or unbound email addresses according to the existing audience contracts.

## Non-goals

- Do not add a separate menu, permission model, campaign table, scheduler, or email-delivery system.
- Do not add external-link click tracking in this release.
- Do not weaken or expand the existing HTML safety policy.
- Do not add Stripe-derived placeholders with blank or synthetic values.
- Do not move content-only activities outside the existing Recall runtime feature gate.

## Selected approach

Add an explicit campaign type rather than encoding content-only behavior as `coupon_source = none`. Campaign type describes the business workflow, while coupon source continues to describe how a promotion campaign obtains its Coupon. This keeps validation, activation, preview, workers, metrics, and future extensions type-safe and understandable.

A separate content-only subsystem was rejected because it would duplicate audience, scheduling, localization, unsubscribe, audit, and delivery logic.

## Compatibility and persistence

Add `campaign_type` to `recall_campaigns` as a non-null string with a database default of `promotion`. Startup migration must idempotently normalize missing or blank legacy values to `promotion` before enforcing the final default and non-null contract. SQLite, MySQL, and PostgreSQL remain supported.

Add `campaign_type` to campaign draft, summary, detail, preview, and export-facing service contracts. An omitted or blank value received from an older client is normalized to `promotion`. Unknown values are rejected. Existing stored campaigns retain promotion behavior without being edited or recreated.

Campaign type is immutable after activation. For scheduled, running, or paused campaigns, the existing activated-campaign update rule continues to allow only the name and email-sequence content; changing a template increments only that template's version. Cancelled and completed campaigns remain terminal and uneditable.

The existing `promotion_valid_seconds` storage field remains in place for compatibility. The Console presents it as activity delivery validity. For a promotion campaign it continues to bound Promotion Code and claim validity. For a content-only campaign it bounds the recipient's email sequence, delivery-expiry checks, and unsubscribe-token lifetime. No destructive column rename is required.

Promotion configuration fields remain present in the shared draft contract. While a content-only activity is still a draft, the Console preserves hidden promotion values so an operator can switch back to `promotion` without losing work. The backend persists but does not validate or execute those inactive fields when `campaign_type = content_only`. Campaign type, not the contents of hidden promotion fields, is the sole execution authority.

## Template and HTML contract

Content-only activities use the same HTML editor, backend parser, safe HTML/CSS policy, image support, static network URLs, arbitrary permitted button/link markup, sandboxed preview, localization pipeline, size limits, and text-to-HTML conversion as promotion activities.

The feature must not add a fixed wrapper, a new sanitizer, reduced tag support, reduced CSS support, or a content-only layout template. Existing safe HTML rules remain the single policy for both types. Only the required dynamic-action contract differs: promotion HTML must contain both `ClaimURL` and `UnsubscribeURL`, while content-only HTML must contain `UnsubscribeURL` and must not contain `ClaimURL` or another promotion-only action.

Dynamic template actions are campaign-type aware:

- both types allow `{{.RecipientName}}` and `{{.UnsubscribeURL}}`;
- only `promotion` allows `{{.PromotionCodeMasked}}`, `{{.ProductSummary}}`, `{{.ExpiresAt}}`, and `{{.ClaimURL}}`.

A content-only save or email preview that contains a promotion-only action is rejected with a field-level error naming the unsupported action and email stage when a stage exists. It is never rendered as an empty string. The standalone email-preview request carries `campaign_type`, with omitted or blank values normalized to `promotion`, so preview uses the same action contract as save. Activation and delivery repeat the same validation as defense in depth so an invalid historical or manually written record cannot send a partial email or trigger Stripe work.

Static links are not template actions. A content-only HTML body may use the same literal external or Flatkey URL values accepted by the current safe HTML validator. Those links are delivered without new click tracking.

Plain-text operator input remains supported. The frontend converts it to safe editable HTML using the campaign type. Promotion conversion retains the claim and unsubscribe links. Content-only conversion adds the unsubscribe link but does not invent a claim link.

Localization continues to translate only protected visible content while preserving markup, CSS, URLs, images, and allowed actions exactly. Missing translation configuration keeps the existing English fallback behavior.

## Administrator experience

Add an activity-type selector at the top of the editor with localized labels:

- Promotion activity;
- Content-only email activity.

New drafts default to `promotion`. Existing drafts load as `promotion` when the field is absent.

For `content_only`, hide Coupon source, existing Coupon ID, discount, product selection, minimum purchase, Coupon redeem-by, and other Stripe-only controls. Keep audience configuration, specified-user search and multi-selection, registration-time controls, group filters, verified-email control, activity delivery validity, enrollment limit, worker concurrency, execution mode, schedule, recurrence, and the complete email sequence editor.

The editor shows only actions valid for the selected type, without reducing HTML editing capability. Switching types revalidates every email stage and highlights promotion-only actions that must be removed before a content-only draft can be saved or previewed.

The campaign list and detail view show the activity type. Recipient detail hides Stripe Customer, Promotion Code, discount, and conversion fields for content-only activities. Delivery and unsubscribe information remains visible.

Campaign preview always returns audience eligibility, exclusions, and masked samples. Promotion preview keeps the current Stripe validation block. Content-only preview explicitly states that Stripe is not used and returns no Stripe validation payload. The response includes `campaign_type`; its Stripe preview member is nullable only for `content_only`, while existing promotion responses remain unchanged.

## Backend validation and activation

Shared validation always handles name, campaign type, audience, schedule, activity delivery validity, enrollment limit, worker concurrency, and email stages.

Promotion validation remains unchanged: normalize Coupon source and discount, require products, validate Stripe Prices, resolve product display snapshots, validate or create the Coupon, and persist activation fields.

Content-only validation does not require or normalize Coupon source, discount, products, minimum amount, Coupon redeem-by, or existing Coupon ID. It validates the content-only action set and performs no Stripe catalog request.

Activation follows a strict type branch after shared validation:

1. `promotion` executes the existing Stripe resolution and Coupon path unchanged.
2. `content_only` skips product resolution, product display snapshots, Coupon validation/creation, redeem-by checks, and Stripe activation identifiers.
3. Both types commit the same audience snapshot, scheduling state, audit event, configuration revision, and recipient enrollment boundaries.

No fallback from an unknown campaign type to content-only is allowed. Legacy blank types normalize only to `promotion`.

## Recipient and email worker flow

Promotion recipients keep the current state flow:

`queued -> customer_ready -> code_ready -> contacting`

Content-only recipients skip both Stripe preparation states. The recipient worker loads the campaign type and atomically schedules stage one directly from `queued`, advancing the recipient to `contacting`. The scheduling transaction must retain the existing lease and idempotency fences so concurrent workers cannot create duplicate messages.

The content-only path never calls:

- Stripe Customer lookup or creation;
- Stripe Customer email synchronization;
- recipient Promotion Code generation or persistence;
- Stripe Promotion Code creation or reconciliation.

The email worker branches on the persisted campaign type. Promotion delivery keeps claim issuance, product-summary resolution, Promotion Code checks, promotion expiry, and the complete promotion render data.

Content-only delivery:

- creates the existing recipient unsubscribe token;
- resolves recipient name and language using the existing rules;
- renders only content-only actions;
- does not issue or persist a claim token;
- does not resolve products;
- does not require Promotion Code fields;
- does not perform any Stripe call.

Campaign pause, cancellation, runtime disablement, recipient suppression, invalid or changed account email, disabled account, marketing opt-out, activity delivery expiry, and the existing payment/API-activity stop rules continue to prevent or cancel later stages. Email-only recipients retain their existing account-free delivery and recipient-scoped unsubscribe rules.

The claim endpoint and discount checkout integration reject or ignore content-only activities. Direct and assisted discount attribution applies only to `promotion`. Payment or API activity may still stop later content-only recall messages, but it does not create promotion-conversion metrics.

## Metrics and audit behavior

Content-only activities retain candidate, enrolled, excluded, scheduled, accepted, failed, cancelled, and unsubscribe-related delivery evidence. Customer-creation, Promotion Code, discount, and conversion metrics are not applicable and are hidden or labeled not applicable in the Console rather than presented as successful zeroes.

Audit events include campaign type so administrators can distinguish promotion and content-only runs. Existing event names and lifecycle actions remain stable unless a type value is required to explain behavior.

Static link clicks are not tracked in this release. No redirect service, URL rewriting, pixel, or new recipient tracking field is introduced.

## Error handling and invariants

- Saving or previewing content-only HTML with a promotion-only action returns a stable validation error that identifies the action and email stage.
- Content-only preview and activation remain usable without Stripe configuration.
- Content-only execution fails closed if persisted data has an unknown campaign type or invalid template action.
- A content-only worker must not silently fall back to the promotion path.
- A promotion worker must remain byte- and behavior-compatible except where shared neutral naming is presented in the Console.
- Runtime-disabled behavior remains unchanged: administrators may create, edit, and preview drafts, but activation, scheduling, retry, claim, and delivery entry points remain blocked.
- Full email bodies, raw unsubscribe tokens, claim tokens, and Promotion Codes remain excluded from logs and audit payloads.
- Existing admin authorization continues to protect all Activity Configuration endpoints.

## Verification strategy

Implementation follows test-driven development. Tests must first fail on the current promotion-only behavior and then pass with the new type branch.

Backend coverage must prove:

- legacy rows and omitted request fields normalize to `promotion`;
- campaign type migration/backfill is idempotent on supported dialect behavior;
- invalid and post-activation type changes are rejected;
- content-only save, update, preview, activation, manual execution, scheduled execution, recurring execution, and multi-stage delivery reuse existing shared behavior;
- content-only preview and activation make zero Stripe calls;
- content-only recipient processing makes zero Customer and Promotion Code calls;
- content-only email delivery makes zero claim, product-summary, and Stripe calls;
- full currently permitted HTML, CSS, images, and static links validate for content-only templates;
- every promotion-only action is rejected on content-only save, preview, activation, and delivery defense-in-depth paths;
- content-only text conversion omits the claim action and preserves unsubscribe;
- pause, cancel, runtime gate, delivery expiry, unsubscribe, payment/API stop rules, leases, retries, idempotency, and recurring enrollment remain correct;
- claim and promotion attribution cannot bind to content-only recipients;
- all existing promotion campaign tests remain green.

Frontend coverage must prove:

- the type selector defaults and loads legacy drafts correctly;
- selecting content-only hides only Stripe controls and retains all shared controls;
- switching types preserves inactive promotion inputs and revalidates email actions;
- the content-only editor keeps the full HTML surface and displays only valid dynamic actions;
- save and preview show precise errors for promotion-only actions;
- plain text converts without a claim link for content-only;
- campaign preview, detail, recipient detail, and metrics render not-applicable Stripe data correctly;
- all supported locales contain the new activity-type and validation copy.

Release verification must include an administrator browser smoke test for promotion and content-only drafts, preview, save/reopen, exact-user targeting, manual activation in a controlled environment, and observed zero Stripe side effects for content-only delivery.

## Acceptance criteria

A content-only activity is complete when an administrator can configure any existing audience and execution mode, author the same safe HTML available to promotion activities, preview and save it, activate it, and deliver one or more localized email stages without any Stripe or claim side effect. Promotion activities must continue to behave exactly as before, and invalid promotion actions in content-only templates must be rejected before an email can be sent.
