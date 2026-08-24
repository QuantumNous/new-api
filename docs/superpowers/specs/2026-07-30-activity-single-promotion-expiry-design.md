# Activity Single Promotion Expiry Design

## Decision

Activity Configuration exposes and persists one operator-owned expiry policy: promotion expiry. The policy remains a tagged choice because fixed and relative expiry have different value domains:

- `fixed`: every recipient uses `promotion_expires_at`;
- `relative`: every campaign run uses `run_at + promotion_valid_seconds`.

`coupon_redeem_by` is removed from the public draft contract and Console. Flatkey-created Stripe Coupons no longer set `redeem_by`. Each recipient Promotion Code continues to receive the expiry calculated from the promotion policy.

## Why

Coupon redeem-by and promotion expiry currently ask operators to configure two deadlines for the same offer. The runtime then silently selects the earlier value. That duplicates intent, makes recurring campaigns harder to reason about, and lets the effective expiry differ from the value the operator considers authoritative.

The Stripe Coupon and Promotion Code objects remain distinct external objects, but that does not require two Flatkey activity settings. Promotion expiry is the only Flatkey-owned source of truth.

## Alternatives Considered

1. **Frontend-only merge.** Keep both backend fields and derive the hidden Coupon deadline. Rejected because the duplicate business rule and silent truncation remain.
2. **Hide Coupon redeem-by under advanced settings.** Rejected because it still permits conflicting operator intent.
3. **Single promotion expiry policy with legacy-only compatibility.** Selected because new activities have one rule while already-issued offers retain their historical behavior.

## Public Contract and Storage

- Remove `coupon_redeem_by` from `RecallDiscountConfig` and the TypeScript `RecallDiscountConfig` interface.
- New draft and activation payloads never emit or persist `coupon_redeem_by`.
- Keep the existing promotion columns. Together, `promotion_expiry_mode` and the active value column form one tagged policy; the inactive value is normalized to zero.
- Do not add a database column or schema migration.
- During a rolling deployment, the Console parser may accept the legacy nested property from an older backend response, but it must strip the property from parsed form state and all subsequent writes.

## Stripe Behavior

### Automatically created Coupon

Flatkey creates the Coupon without `redeem_by`. The generated recipient Promotion Code receives `expires_at` from the activity promotion policy.

### Existing Coupon

An existing Stripe Coupon may already have an immutable external `redeem_by`. That value is not exposed as an activity setting and is not a second Flatkey policy.

Before activation, Flatkey validates compatibility:

- fixed expiry requires the external Coupon deadline to be absent or at/after `promotion_expires_at`;
- manual or scheduled-once relative expiry requires it to be absent or at/after the single run's calculated expiry;
- recurring relative expiry rejects a finite external Coupon deadline because later runs cannot be guaranteed to satisfy it.

Incompatible Coupons block activation with a stable validation error instead of silently shortening the configured promotion expiry.

## Historical Compatibility

Historical `discount_config` JSON may contain `coupon_redeem_by`. A private persisted-discount decoder reads that value into an internal legacy cap. The field is never returned in the public draft and is never written for new or re-saved drafts.

- Already-running or scheduled historical activities continue calculating `min(promotion policy expiry, legacy cap)` and keep existing Stripe objects unchanged.
- An unstarted historical draft can be opened and saved under the new contract; saving removes the legacy field, so the operator configures only promotion expiry.
- Existing recipient `promotion_expires_at` snapshots remain unchanged.

This compatibility path is deliberately read-only and must not become a new public setting.

## Console

- Remove the Coupon redeem-by date-time picker, validation errors, form watches, helper inputs, and translations.
- Rename no remaining fields: the existing promotion expiry mode, fixed date, duration inputs, and effective-expiry preview already express the selected policy.
- The effective-expiry preview is calculated exclusively from fixed expiry or run time plus duration.

## Multi-Node and Deployment Behavior

No in-memory coordination is introduced. Campaign configuration and recipient expiry snapshots remain database-backed. A new Console can tolerate an older node returning the legacy property, and a new backend ignores an older Console submitting it. Deploy console nodes before or together with the Console bundle; router nodes are not required because the affected code is admin activity configuration and Stripe campaign workers, not relay traffic.

## Tests

Backend tests must prove:

- automatic Coupon params omit `RedeemBy`;
- new persisted discount JSON omits `coupon_redeem_by`;
- promotion expiry no longer caps against a public discount field;
- historical stored JSON still caps already-running campaign recipients;
- incompatible existing Coupon deadlines block activation;
- compatible existing Coupons and both promotion expiry modes still work.

Frontend tests must prove:

- the form renders no Coupon redeem-by control or copy;
- draft types/defaults/submissions contain no `coupon_redeem_by`;
- legacy API responses are accepted and stripped;
- effective expiry is derived only from the promotion policy;
- fixed and relative mode validation remains intact.

## Scope Boundaries

- Do not change Stripe discount amount, product scope, minimum spend, enrollment, email, or audience behavior.
- Do not rewrite existing recipient expiry snapshots or Stripe objects.
- Do not remove the existing-Coupon source option.
- Do not add dependencies.
