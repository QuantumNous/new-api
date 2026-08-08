# Design

## Source of truth

- Status: Active
- Last refreshed: 2026-08-08
- Primary product surfaces: Administrator Activity Configuration offer validity, minimum purchase amount, module-wide email throughput, email authoring, localization review, generation, activation preflight, Continuous Activity lifecycle automation, lifecycle operations/metrics, and customer Wallet Recall-offer pricing.
- Evidence reviewed:
  - `web/default/src/features/recall-campaigns/components/campaign-editor.tsx`
  - `web/default/src/features/recall-campaigns/components/campaign-email-html-editor.tsx`
  - `web/default/src/features/recall-campaigns/index.tsx`
  - `web/default/src/features/recall-campaigns/schemas.ts`
  - `web/default/src/features/wallet/components/recharge-form-card.tsx`
  - `web/default/src/features/wallet/components/subscription-plans-card.tsx`
  - `web/default/src/features/wallet/lib/recall-claim.ts`
  - `web/default/src/components/datetime-picker.tsx`
  - `service/recall_campaign.go`
  - `service/recall_lifecycle.go`
  - `service/recall_attribution.go`
  - `controller/recall_campaign.go`
  - `model/recall_campaign.go`
  - `service/recall_email.go`
  - `service/recall_scheduler.go`
  - `service/recall_email_translation.go`
  - `model/recall_message.go`
  - `setting/operation_setting/recall_campaign_setting.go`
  - `docs/superpowers/specs/2026-07-21-recall-email-auto-localization-design.md`
  - `docs/superpowers/specs/2026-07-22-recall-html-email-design.md`
  - `docs/superpowers/specs/2026-07-27-activity-email-localization-workspace-design.md`
  - `docs/superpowers/specs/2026-08-07-flatkey-lifecycle-email-continuous-activities-design.md`

## Brand

- Personality: Operational, restrained, reliable, and explicit about state.
- Trust signals: Exact language counts, source-version freshness, effective expiry, explicit per-currency minimums, current hourly usage, reset time, atomic quota accounting, atomic generation, precise activation blockers, masked lifecycle event-boundary estimates, lifecycle disposition/message metrics, safe `SMTP accepted` wording, and preserved prior content after failures.
- Avoid: Marketing flourish, Unix timestamps or raw seconds as primary controls, ambiguous expiry, guessed or hidden minimum-amount currencies, ambiguous quota scope, silent English fallback during activation, or presenting copied English as valid localization.

## Product goals

- Goals:
  - Reduce normal activity email authoring to one English source per stage and one explicit localization action.
  - Make generated, manually edited, stale, failed, and missing states immediately understandable.
  - Prevent activation until all seven targets match the current English source.
  - Let operators select coupon and promotion expiry without converting dates to timestamps or durations to seconds.
  - Keep minimum purchase optional; when enabled, let operators enter explicit thresholds for USD, INR, BRL, and JPY without guessing a checkout currency.
  - Cap all Activity Configuration email attempts together by one adjustable hourly limit while leaving other system mail unchanged.
  - Show an eligible customer-facing Recall offer at the purchase choice with an OFF badge, original price, final price, and exact savings amount.
  - Let operators configure seven lifecycle email automations as first-class Continuous Activities with one trigger, one fixed delivery policy, one processing-start boundary, and one localized email stage.
- Non-goals:
  - Non-English source authoring.
  - Additional languages, reviewer roles, or required per-locale sign-off.
  - Audience, discount-calculation, product, campaign-schedule, or attribution redesign beyond the documented expiry and optional multi-currency minimum controls.
  - SMTP-account-wide throttling, per-campaign allowances, or limits on registration, verification, password-reset, notification, and other non-Recall email.
  - Reinterpreting campaign `worker_concurrency` or guaranteeing SMTP network-completion order across nodes.
  - Multiple stages, coupons, promotion scope, static audience scans, recurrence schedules, or historical event synthesis for Continuous Activities.
- Success signals:
  - Time from opening Email Sequence to an activation-ready draft.
  - Number of locale fields operators must open for an ordinary activity.
  - Translation-generation retry rate and activation-blocker recovery rate.
  - Zero activations containing stale or missing target locales.
  - Zero Activity email hours exceeding the configured attempt limit across application nodes.
  - Reduced invalid expiry input and no new positive minimum amount stored without its explicit currency.
  - Eligible Wallet top-up and subscription choices use the same complete savings presentation without changing server-authoritative checkout selection.

## Personas and jobs

- Primary personas: Flatkey administrators and campaign operators.
- User jobs: Configure understandable offer expiry, optionally set per-currency minimums, select a lifecycle trigger, confirm the fixed service/engagement delivery policy, choose `From now` or a valid custom processing start, control shared Activity email throughput, author an activity email once, generate localized variants, optionally correct a target language, understand lifecycle backlog/readiness, pause/resume/cancel safely, and activate safely.
- Key contexts of use: Desktop-first administrator Console; occasional mobile inspection or correction; one to three email stages; time-sensitive activity launches.

## Information architecture

- Primary navigation: Administrator section -> Activity Configuration -> create or edit activity -> Email Sequence.
- Core routes/screens:
  - Activity list and create/edit page.
  - Activity-list shared email limit and hourly usage summary.
  - Offer validity card with coupon deadline, promotion validity mode, effective expiry, and an optional minimum-purchase section.
  - Email Sequence English-content tab.
  - Translation-review tab.
  - Generation and regeneration confirmation states.
  - Activation preflight and blockers.
  - Continuous Activity lifecycle trigger, processing-start preview, operational warning, and lifecycle metrics.
- Content hierarchy: Shared Activity email health -> activity offer and audience configuration -> English source -> aggregate translation readiness -> optional target review -> activation readiness -> secondary implementation metadata.

## Design principles

- Author once, review only when useful: Generated translations do not require ceremonial confirmation.
- Freshness is a product state: Translation readiness must be tied to the exact English source revision.
- Fail closed at activation: Delivery fallback is not a substitute for valid new configuration.
- Preserve recoverability: Failed generation never destroys the last complete translation set.
- Human time, canonical storage: Operators select local date-time or days and hours; the system persists normalized UTC instants and durations.
- Continuous replaces static planning surfaces: A Continuous Activity shows Lifecycle Trigger and processing-start controls instead of Audience, Schedule, Product scope, Coupon, Discount, and Promotion validity controls.
- One trigger, one policy, one stage: A Continuous Activity owns exactly one of seven lifecycle triggers, displays the server-fixed `service` or `engagement` policy badge, and allows exactly one localized email stage.
- Operational truth before optimism: Event counts are estimates, samples are masked at the event boundary, send-time gates may reduce recipients, and `SMTP accepted` means only the configured SMTP server accepted the message.
- Explicit currency thresholds: Minimum purchase is disabled by default. Enabling it reveals independent hand-entered USD, INR, BRL, and JPY amounts; blank currencies remain unset, and neither the client nor server invents a threshold currency.
- Show savings where the decision is made: Eligible Wallet purchase choices pair the OFF label with both price states and the exact amount saved; an account-level banner alone is not sufficient.
- Scope the safety control precisely: One hourly allowance covers all Activity Configuration campaigns and no unrelated email path.
- Protect before throughput: Multi-node quota checks fail closed and may underfill a window after an uncertain boundary, but they never oversend to compensate.
- Keep expert detail available but secondary: Per-language editing and template versions remain accessible without dominating the common path.
- Tradeoffs: Regeneration replaces manual corrections to avoid mixing old human edits with a new source; the operator receives an explicit warning rather than merge tooling. Fixed expiry gives one predictable deadline but ends recurring runs at that deadline; relative validity keeps recurring runs usable. Quota accounting counts every SMTP attempt after the send boundary, including uncertain outcomes, to favor account protection over maximum utilization.
- Continuous immutability: After activation, Lifecycle Trigger, fixed Delivery Policy, and Processing Start are read-only; changing the trigger or start boundary requires a new draft task. Name, localized content, preview/test-send, worker concurrency, and hourly limit keep the existing Activity editing contract.

## Visual language

- Color: Reuse existing theme tokens. Brand purple identifies primary actions; semantic success, warning, and destructive tokens identify readiness and blockers.
- Typography: Existing Console typography; tabular numerals for language and stage counts.
- Spacing/layout rhythm: Existing 8px rhythm, compact status and hourly-usage rows, and 16-24px card padding.
- Shape/radius/elevation: Existing card, button, dialog, badge, and border treatments; avoid a new visual system.
- Motion: Existing short transitions; progress updates must respect reduced motion.
- Imagery/iconography: Existing line icons plus text labels. Status never relies on icon or color alone.

## Components

- Existing components to reuse: `Card`, `Tabs`, `Button`, `Badge`, `Alert`, `Dialog`, `Textarea`, `Input`, `DateTimePicker`, `Progress`, and existing HTML preview frame.
- New/changed components:
  - Activity-list `CampaignEmailHourlyLimitControl` and usage summary.
  - `CampaignOfferValidityFields` with fixed/relative mode, effective expiry, an optional minimum-purchase toggle, and USD/INR/BRL/JPY amount inputs shown only when enabled.
  - English-only `CampaignEmailSequenceEditor` presentation.
  - `CampaignTranslationStatusSummary`.
  - `CampaignTranslationLocaleList`.
  - `CampaignTranslationReviewEditor` with read-only English context.
  - `CampaignTranslationRegenerateDialog`.
  - Structured activation blocker list.
  - Continuous execution-mode option, lifecycle trigger selector, fixed delivery-policy badge, processing-start controls using the existing `DateTimePicker`, lifecycle event-boundary preview, service-mail warning, and lifecycle metrics cards.
  - Wallet top-up amount tiles and subscription plan prices with a shared Recall savings hierarchy: OFF badge, discounted price, struck original price, and `Save {{amount}}`.
- Variants and states: Fixed expiry, relative validity, coupon-capped expiry, invalid/past expiry, minimum purchase disabled/enabled/partially populated, quota available, quota exhausted, quota refresh, Manual, Once, Recurring, Continuous, From now, custom processing start, immutable active start, service policy, engagement policy, not generated, generating, generated, manually edited, stale, failed, missing, regeneration warning, activation blocked, paused, resumed, cancelled, and ready.
- Token/component ownership: Extend current Recall Campaign components and theme tokens; do not introduce a separate localization design system.

## Continuous Activity lifecycle contract

- Evidence basis: The approved lifecycle plan in `docs/superpowers/specs/2026-08-07-flatkey-lifecycle-email-continuous-activities-design.md` defines seven triggers and the Console contract; backend evidence at `service/recall_campaign.go`, `service/recall_lifecycle.go`, `service/recall_attribution.go`, `controller/recall_campaign.go`, and `model/recall_campaign.go` exposes `execution_mode=continuous`, `lifecycle_trigger`, `delivery_policy`, `processing_start_at`, `lifecycle_preview`, `lifecycle_metrics`, and existing pause/resume/cancel actions; current UI evidence under `web/default/src/features/recall-campaigns/` provides reusable editor, preview, detail, list, translation, metrics, DateTimePicker, and action-dialog surfaces.
- Trigger selection: Continuous adds a fourth execution mode beside Manual, Once, and Recurring. Selecting Continuous replaces audience, schedule, product, coupon, discount, and promotion controls with a Lifecycle Trigger selector for `user_registered`, `registration_unused`, `quota_low`, `quota_exhausted_unpaid`, `payment_failed`, `payment_pending`, and `payment_succeeded`.
- Delivery policy: The UI displays the trigger's fixed Delivery Policy badge. `service` warns that the template is operational account/quota/order mail, ignores marketing opt-out, omits body and header unsubscribe, and cannot include promotion configuration. `engagement` keeps existing opt-out and unsubscribe behavior. Operators cannot edit the policy directly.
- Processing start: `From now` is the default and resolves on the server at activation. `Custom date and time` uses the existing `DateTimePicker`; it must validate against the backend collection marker, earliest available event boundary, and activation-time rules. After activation, the chosen trigger, delivery policy, and processing start are immutable.
- Authoring shape: Continuous retains name, localization, preview, test-send, worker concurrency, hourly limit, and existing email-template controls, but exactly one stage is allowed and add-stage controls are hidden.
- Preview and blockers: Continuous preview shows selected start, earliest available event time, estimated count, due count, bounded masked samples, and a warning that send-time rechecks can reduce final recipients. Activation blockers must explain invalid start boundaries, missing collection markers, duplicate active/paused trigger ownership, promotion fields, missing localizations, and service-content warnings without claiming delivery certainty.
- Operations and metrics: List and detail surfaces show execution mode and lifecycle trigger. Detail metrics include events recorded inside the boundary, pending-not-due backlog, due backlog, leased/enrolled counts, queued messages, `SMTP accepted`, uncertain/failed/cancelled messages, send-time ineligible/suppressed counts, no-email and engagement-opt-out counts, event lease recovery/retry counts, last processed event, latency, and safe error-code breakdowns.
- Lifecycle controls: Drafts can activate. Running Continuous tasks can pause or cancel. Paused tasks can resume or cancel. Pause freezes enrollment and delivery while events accumulate; resume processes backlog from the immutable start; cancel releases the trigger slot and cancels unsent work while preserving history.
- Responsive behavior: Desktop keeps lifecycle configuration, preview, and email authoring scannable in the existing two-column/card rhythm. Narrow screens stack trigger, policy, start, preview, warning, and stage editor without horizontal scrolling; metric cards wrap to one column while preserving labels and counts.
- Keyboard/focus/accessibility: Execution mode, trigger, From now/custom start, DateTimePicker, preview, activation blockers, service warning, pause/resume/cancel dialogs, tabs, locale review, and template fields are keyboard operable. Failed activation focuses the first blocker, status changes use readable text plus semantic color, dialogs restore focus, and masked samples expose no raw email addresses or secrets.
- Content voice: Use direct operational wording such as `Continuous`, `Lifecycle Trigger`, `Delivery Policy`, `Service`, `Engagement`, `From now`, `Custom date and time`, `Processing start`, `Estimated events`, `Due now`, `SMTP accepted`, `Pause`, `Resume`, and `Cancel`. Avoid marketing language, inbox-delivered claims, and instructional text that restates obvious control behavior.

## Accessibility

- Target standard: WCAG 2.2 AA.
- Keyboard/focus behavior: Date-time pickers, validity mode, duration inputs, shared limit, tabs, locale selection, stage navigation, generation, retry, dialogs, and editors are fully keyboard operable. Failed activation focuses the first blocker; closed dialogs restore focus.
- Keyboard/focus behavior: Date-time pickers, validity mode, duration inputs, shared limit, execution mode, lifecycle trigger, processing-start mode, lifecycle preview, tabs, locale selection, stage navigation, generation, retry, pause/resume/cancel dialogs, and editors are fully keyboard operable. Failed activation focuses the first blocker; closed dialogs restore focus.
- Contrast/readability: Status pairs semantic text and icons with color. Counts and version mismatches use readable text.
- Screen-reader semantics: Date selections include timezone text; hourly usage and reset changes use a polite live region; failures and blockers use alert semantics; locale rows expose language and status together.
- Reduced motion and sensory considerations: Avoid animated progress that is necessary to understand completion; respect reduced-motion preferences.

## Responsive behavior

- Supported breakpoints/devices: Existing Console breakpoints, with desktop as the primary authoring surface and narrow-screen support from 360px.
- Layout adaptations: Desktop translation review places English and target content side by side. Narrow screens stack the shared limit above the activity table, wrap date and time controls without horizontal scrolling, and stack English above the editable target while keeping locale/status context visible.
- Layout adaptations: Desktop translation review places English and target content side by side. Narrow screens stack the shared limit above the activity table, wrap date and time controls without horizontal scrolling, stack Continuous trigger/policy/start/preview controls before the one-stage editor, and stack English above the editable target while keeping locale/status context visible.
- Touch/hover differences: Touch targets are at least 44px where practical; critical help and blockers never depend on hover.

## Interaction states

- Loading: Keep the last saved source and quota status visible; show bounded generation or setting-save progress and prevent duplicate mutations.
- Empty: Show English editors and `Translations not generated`; do not materialize seven editable target forms. Quota status still shows `0 / limit` for an empty queue.
- Error: Preserve the last successful targets, show a retry action, and keep activation blocked when the stored set is stale or incomplete. A quota read/write failure pauses Activity emails without affecting other email services.
- Error: Preserve the last successful targets, show a retry action, and keep activation blocked when the stored set is stale or incomplete. A quota read/write failure pauses Activity emails without affecting other email services. Continuous activation errors name the blocked trigger, invalid processing-start boundary, or duplicate active/paused owner without mutating immutable fields.
- Success: Show aggregate readiness such as `21/21 translations ready`, a normalized effective expiry, and current hourly usage; manual review remains optional.
- Disabled: Activation explains the exact stage/locale or expiry blocker and recovery action. An exhausted quota explains that queued work resumes at the next reset.
- Offline/slow network, if applicable: A generation timeout leaves the saved English draft and last successful targets intact. Retrying uses the latest source revision. A failed limit update leaves the last confirmed limit visible.

## Content voice

- Tone: Direct, operational, and recovery-oriented.
- Terminology: Use `Coupon redeem-by`, `Promotion validity`, `Fixed expiry date`, `Valid after each run`, `Effective expiry`, `Minimum purchase`, `USD`, `INR`, `BRL`, `JPY`, `Activity email limit`, `Sent this hour`, `Resets at`, `English content`, `Translation review`, `Generate 7 translations`, `Regenerate 7 translations`, `Manually edited`, `Stale`, `Unable to publish`, `OFF`, and `Save {{amount}}` consistently.
- Terminology: Use `Coupon redeem-by`, `Promotion validity`, `Fixed expiry date`, `Valid after each run`, `Effective expiry`, `Minimum purchase`, `USD`, `INR`, `BRL`, `JPY`, `Activity email limit`, `Sent this hour`, `Resets at`, `Continuous`, `Lifecycle Trigger`, `Delivery Policy`, `Service`, `Engagement`, `From now`, `Custom date and time`, `Processing start`, `Estimated events`, `Due now`, `SMTP accepted`, `English content`, `Translation review`, `Generate 7 translations`, `Regenerate 7 translations`, `Manually edited`, `Stale`, `Unable to publish`, `OFF`, and `Save {{amount}}` consistently.
- Microcopy rules: State the local timezone, effective expiry, exact quota scope, lifecycle trigger condition, fixed policy, selected processing-start boundary, what changed, why activation or delivery is waiting, whether manual edits will be replaced, and the next safe action. For SMTP outcomes, say `SMTP accepted` only; never imply inbox delivery.

## Implementation constraints

- Framework/styling system: React 19, TypeScript, react-hook-form, Zod, TanStack Query, Tailwind CSS 4, and existing Base UI/shadcn-style components.
- Design-token constraints: Reuse existing theme tokens and semantic variants.
- Performance constraints: Translation remains one bounded batch across all stages and seven targets; prevent duplicate in-flight requests. Hourly accounting uses one small database row per UTC hour and stops scanning later messages once the shared allowance is exhausted.
- Compatibility constraints: Preserve exact eight-locale persistence, existing English-only automatic API clients, complete manual API clients, historical relative-validity campaigns, immutable legacy minimum-currency runtime records, HTML validation, protected tokens, queued-message snapshots, SQLite/MySQL/PostgreSQL support, and multi-node correctness. New drafts store only explicitly entered minimum currencies; legacy records keep their stored currency semantics. Common SMTP and non-Recall callers must not depend on the Activity limiter. Wallet savings are a client preview from existing offer data; checkout always recalculates and selects the offer on the server.
- Compatibility constraints: Preserve exact eight-locale persistence, existing English-only automatic API clients, complete manual API clients, historical relative-validity campaigns, Manual/Once/Recurring execution behavior, immutable legacy minimum-currency runtime records, HTML validation, protected tokens, queued-message snapshots, SQLite/MySQL/PostgreSQL support, and multi-node correctness. New drafts store only explicitly entered minimum currencies; legacy records keep their stored currency semantics. Continuous drafts reject legacy audience, recurrence, product, coupon, discount, and promotion fields instead of silently discarding them. Common SMTP and non-Recall callers must not depend on the Activity limiter. Wallet savings are a client preview from existing offer data; checkout always recalculates and selects the offer on the server.
- Test/screenshot expectations: Desktop 1440px and mobile 390px; both validity modes, coupon-capped expiry, minimum purchase disabled and enabled with USD/INR/BRL/JPY inputs, quota available/exhausted, live limit adjustment, Manual/Once/Recurring unchanged, Continuous trigger selection, fixed policy badge, From now/custom start, invalid custom time, masked event-boundary preview, service warning, one-stage editor, no add-stage control, lifecycle metrics, pause/resume/cancel, immutable trigger/start after activation, new draft, generation success, optional correction, stale source, regeneration warning, failed generation, blocked activation, and ready activation.

## Open questions

- None. The source language, trigger, activation gate, optional review rule, regeneration overwrite behavior, both promotion-validity modes, optional operator-entered USD/INR/BRL/JPY minimums, and one Activity-module-wide hourly email limit are approved.
