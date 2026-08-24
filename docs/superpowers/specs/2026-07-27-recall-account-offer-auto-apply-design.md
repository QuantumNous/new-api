# Recall Account Offer Auto-Apply Design

## Goal

Make Recall offers account-driven instead of link-driven:

- A signed-in recipient sees valid Recall offers on a normal wallet visit without opening the email link.
- Every supported checkout resolves the eligible offer that produces the largest actual discount for the server-resolved product, amount, and currency.
- Cancelling a campaign immediately blocks new claims and new discounted checkouts, then durably deactivates its outstanding unredeemed Stripe Promotion Codes.
- Email claim links remain useful for navigation and click attribution, but never grant or restrict eligibility.

The motivating regression is a recipient who received one campaign, had that campaign cancelled, then received a second campaign. The cancelled offer must not compete with the second offer, and the second offer must work from a normal wallet visit.

## Confirmed product behavior

- Offer discovery is authenticated and based on the current Flatkey account.
- The frontend may preview discounts, but checkout selection is always repeated on the backend.
- The winning offer is ordered by:
  1. largest calculated discount in checkout currency minor units;
  2. latest offer issuance time;
  3. lowest recipient ID as the stable final tie-breaker.
- `cancelled` campaigns cannot be claimed or selected for a new checkout.
- `paused` and `completed` campaigns keep already-issued codes usable until their individual expiry.
- Existing or already-in-flight Stripe Checkout Sessions are not retroactively changed when a campaign is cancelled.
- A claim link is a navigation/click-attribution signal. A stale or invalid link cannot suppress another valid account offer, and a valid link cannot force checkout to use a weaker offer.
- Recall offers do not change the existing eligibility or stacking behavior of unrelated payment promotions.

## Current failure mode

The wallet initializes Recall state as idle when `recall_claim` is absent. It validates and forwards a Recall claim only after a link supplies that value. Both top-up and subscription checkout handlers therefore resolve a discount only when the request contains the raw claim.

Campaign cancellation currently stops scheduled messages but still treats `cancelled` as claim-active. Stripe Promotion Codes already issued to recipients also remain active. Adding wallet discovery alone would therefore allow a cancelled offer to remain in the candidate set and potentially beat the newer offer.

## Architecture

### 1. Current-user offer discovery

Add an authenticated endpoint:

`GET /api/user/recall/offers`

The endpoint returns an array of private `RecallOfferView` objects for the current user. It returns `200` with an empty array when Recall is disabled or when no offers are eligible. The response is marked `Cache-Control: no-store`.

Each offer view contains only data needed for display and deterministic client-side preview:

```json
{
  "campaign_id": 10,
  "recipient_id": 123,
  "campaign_name": "Recall",
  "promotion_code_masked": "FKXH****SD",
  "issued_at": 1785100000,
  "expires_at": 1785700000,
  "discount": {},
  "products": {},
  "redeemed": false
}
```

The endpoint never returns a claim token, claim hash, full Promotion Code, Stripe Promotion Code ID, Stripe Customer ID, or recipient email snapshot.

The model query joins recipients to campaigns and selects candidates that satisfy all of the following:

- the recipient belongs to the authenticated user, or is an unbound email recipient whose normalized email exactly matches the enabled current account;
- campaign status is `scheduled`, `running`, `paused`, or `completed`;
- recipient state is usable under the existing Recall state contract and is not converted, suppressed, ineligible, expired, or failed;
- a persisted Stripe Promotion Code ID and masked-code source exist;
- the individual promotion expiry is in the future;
- the campaign configuration parses successfully.

Email-only matches are bound with the existing compare-and-set binding rules before being returned. A binding conflict omits that candidate; it never widens access to a different account.

Discovery is read-only with respect to click attribution. It must not set `clicked_at`; only a valid claim-link validation records a click.

### 2. Durable issuance ordering

Add `promotion_issued_at` to `RecallRecipient` and set it when a newly created Stripe Promotion Code is first persisted. This field is immutable after first write.

Legacy rows have no exact issuance timestamp. For those rows, deterministic ordering uses `recipient.created_at` as the fallback. This is sufficient to order the already-created campaigns in this incident without rewriting historical records from mutable `updated_at` values.

The effective ordering timestamp is:

`promotion_issued_at > 0 ? promotion_issued_at : created_at`

### 3. Shared eligibility and discount calculation

Introduce one service-level candidate validator and one pure discount calculator. Claim validation, account discovery, checkout resolution, and frontend preview must use the same status/product/currency rules rather than maintaining separate interpretations.

The backend resolver accepts only server-derived checkout facts:

```text
ResolveBestRecallOffer(
  context,
  authenticatedUserID,
  purchaseKind,
  resolvedStripePriceID,
  resolvedCurrency,
  resolvedSubtotalMinor,
)
```

Client-supplied amount, currency, campaign ID, recipient ID, Promotion Code ID, or calculated discount is never trusted for selection.

Product eligibility uses exact Stripe Price ID membership. Subscription plan IDs remain presentation helpers; the resolved Stripe Price ID is authoritative at checkout.

For each eligible candidate:

- Percentage discount: round `subtotal_minor * percent_off / 100` to currency minor units.
- Fixed discount: use the configured amount for the exact uppercase checkout currency, including `currency_options`; otherwise the candidate contributes zero.
- Minimum amount: require both the configured minimum currency and threshold to match the checkout contract.
- Clamp the calculated discount to `[0, subtotal_minor]`.
- A zero discount is not a winning candidate.

Candidates are then sorted by discount descending, effective issuance time descending, and recipient ID ascending. Only one Recall Promotion Code is applied.

The same calculator covers the existing Recall-aware purchase paths:

- Stripe top-up Checkout;
- Stripe recurring subscription Checkout;
- the existing prepaid/one-time subscription first-period discount path.

For subscriptions, the comparison applies to the first billable period already covered by the current Recall behavior. Top-up bonus credit remains separate from the Stripe charge subtotal.

### 4. Checkout remains authoritative

Top-up and subscription handlers call the account resolver after they have resolved the actual product, price, quantity, currency, and amount, immediately before creating or quoting the checkout.

`recall_claim` remains accepted in request DTOs for backward compatibility and attribution continuity, but it is not an eligibility credential and does not select the discount. If present, it may be validated as a click signal; failure is logged and does not veto another valid account offer. The checkout resolver independently queries all valid offers for the authenticated user.

The selected recipient/campaign tuple and Promotion Code ID continue into existing order metadata and Stripe metadata so conversion attribution remains unchanged.

Stripe remains the final enforcement authority. If Stripe rejects the selected Promotion Code, checkout creation returns the existing payment error and no weaker offer is silently substituted after an ambiguous Checkout creation attempt.

### 5. Wallet behavior

On every authenticated wallet load, the frontend fetches `/api/user/recall/offers`, even when the URL has no `recall_claim`.

The Recall context stores an offer list instead of a single link-owned offer. Existing top-up and subscription price helpers select the best preview for each displayed product, amount, and currency with the same ordering rules as the backend.

When the URL contains a claim:

1. validate it to record click attribution and bind a matching email-only recipient when needed;
2. clear the raw claim from the URL using the existing cleanup behavior;
3. refresh account offers;
4. continue showing any other valid account offer if claim validation fails.

Discovery failure does not fabricate a discount. The wallet shows the undiscounted preview and uses the standard request error handling, while checkout still performs authoritative account resolution.

### 6. Cancellation and Stripe deactivation

Cancellation is a local eligibility fence first and an external side-effect second.

In one database transaction, cancellation:

- transitions the campaign to `cancelled`;
- cancels outstanding messages as today;
- marks every unconverted, unexpired, Promotion-Code-bearing recipient as requiring revocation;
- writes the existing admin cancellation event.

As soon as the transaction commits, discovery, claim validation, and checkout selection exclude the campaign. A Stripe outage can therefore delay physical code deactivation but cannot keep the offer usable through Flatkey checkout.

Add dedicated recipient revocation fields rather than overloading delivery state or errors:

- `promotion_revocation_state`: empty, `pending`, `completed`, or `failed`;
- `promotion_revocation_attempt_count`;
- `promotion_revocation_next_attempt_at`;
- `promotion_revocation_lease_owner`;
- `promotion_revocation_lease_expires_at`;
- `promotion_revoked_at`;
- `promotion_revocation_last_error_code`.

A bounded revocation pass runs after cancellation and from the existing Recall scheduler. It claims due recipients with database compare-and-set leases, so multiple application nodes may scan safely. For each claimed recipient it:

1. marks already-expired local promotions complete without a Stripe call;
2. loads the Stripe Promotion Code;
3. treats missing, inactive, or already-redeemed codes as complete;
4. updates an active, unredeemed code with `active=false`;
5. marks success complete, retries transient failures with capped exponential backoff, and records sanitized permanent failures as `failed`.

Calling cancel again for an already-cancelled campaign is idempotent and requeues failed revocations for an explicit retry. The campaign is never moved out of `cancelled` and messages are never restarted.

The cancellation API succeeds once the local transaction is durable. Stripe partial failure does not roll back the campaign or return a misleading active state. Pending/failed counts and sanitized error codes are logged and emitted as Recall admin events for operations; raw Stripe payloads and secrets are not exposed.

The scheduler also discovers legacy cancelled campaigns whose recipients have an unexpired Promotion Code and an empty revocation state. This backfills the pre-deployment case, including the first cancelled test campaign, without requiring the campaign to be cancelled again.

### 7. Cancellation races

The existing pre-external-call campaign guard remains, but cancellation can race after that guard. Promotion persistence therefore also checks campaign status:

- if the campaign is still eligible, persist the code and immutable issuance time normally;
- if it is cancelled, persist enough Stripe identity to avoid an orphan, mark revocation pending, and do not advance the recipient into delivery;
- if Stripe creation succeeded but persistence loses its lease, immediately attempt best-effort deactivation and leave structured evidence for reconciliation.

A checkout request that resolved an offer before the cancellation fence is considered in flight. Its already-created or concurrently-created Stripe Checkout Session is not modified. Requests resolving after the fence receive no cancelled offer.

## Campaign status matrix

| Status | Discoverable | New claim valid | New checkout eligible | Existing code deactivated |
| --- | --- | --- | --- | --- |
| `draft` | No | No | No | No code expected |
| `scheduled` | Yes, if issued | Yes | Yes | No |
| `running` | Yes, if issued | Yes | Yes | No |
| `paused` | Yes, if issued | Yes | Yes | No |
| `completed` | Yes, until recipient expiry | Yes | Yes | No |
| `cancelled` | No | No | No | Yes, if active and unredeemed |

## Error behavior

- Empty account offer set: `200`, empty array.
- Invalid/stale link claim: claim endpoint returns its existing typed error, but wallet refresh still discovers other account offers.
- Malformed campaign discount/product snapshot: omit that candidate, emit a structured error, and do not fail all other offers.
- Account discovery database failure: return an API error; do not expose a partial or guessed list.
- Checkout candidate lookup failure: fail closed and do not create a discounted Checkout Session with unverified state.
- Stripe revocation transient failure: retain `pending`, increment attempt metadata, and retry.
- Stripe revocation permanent failure: retain the local cancellation fence, mark `failed`, emit operational evidence, and allow idempotent cancel retry.
- Stripe Promotion Code missing/inactive/redeemed: treat revocation as completed.

## Security and privacy

- All discovery and checkout resolution use the authenticated user ID from middleware.
- Email-only matching requires exact normalized equality with the enabled account and uses the existing binding conflict fence.
- Raw claim tokens remain short-lived navigation secrets and are removed from the browser URL after validation.
- Claim hashes, full Promotion Codes, Stripe object IDs, Stripe Customer IDs, and email snapshots are never returned by the discovery endpoint.
- Client calculations are presentation only. Server-resolved product, amount, currency, and account identity control checkout.
- Cancellation status in the database is authoritative even while Stripe revocation is pending.

## Test matrix

### Model

- Query current-user offers by bound user ID.
- Bind and return an exact normalized email-only match; reject conflicting/nonmatching accounts.
- Include issued `scheduled`, `running`, `paused`, and `completed` offers.
- Exclude `draft`, `cancelled`, converted, suppressed, failed, expired, and code-less recipients.
- Preserve immutable `promotion_issued_at` and use `created_at` only for legacy fallback.
- Claim and settle revocation work with compare-and-set leases across competing workers.
- Discover legacy cancelled recipients with empty revocation state.

### Service

- Calculate percentage and fixed discounts for two-decimal and zero-decimal currencies.
- Honor currency options, minimum amounts, rounding, and subtotal clamp.
- Select the largest actual discount even when it is not the newest offer.
- Break equal discounts by latest issuance, then lowest recipient ID.
- Exclude cancelled campaigns from both link validation and account resolution.
- Keep paused/completed issued offers valid until expiry.
- Preserve click attribution without making a claim necessary for eligibility.
- Retry transient Stripe deactivation, settle missing/inactive/redeemed codes, and record permanent failure.
- Fence a Promotion Code created concurrently with cancellation.

### Controller and checkout integration

- Require authentication for `/api/user/recall/offers` and return no secret fields.
- Create top-up Checkout with the best account offer when no claim is supplied.
- Create recurring and prepaid subscription checkouts/quotes with the best account offer when no claim is supplied.
- Do not let a stale or weaker supplied claim override the best account offer.
- Persist the selected campaign/recipient attribution tuple.
- Prevent a post-cancellation request from attaching the cancelled Promotion Code.
- Do not mutate an already-created Checkout Session during cancellation.

### Frontend

- Fetch offers on a normal wallet visit with no claim parameter.
- Show the best eligible discount independently for each top-up amount/currency and subscription product.
- Use latest issuance and recipient ID tie-breaks identically to the backend.
- Refresh account offers after link validation and keep another valid offer when the link is stale.
- Never store or render a full claim or Promotion Code.
- Pass typecheck, focused Vitest coverage, i18n synchronization if any new user-visible copy is introduced, and production build checks.

## Rollout and deployment

- The model changes use GORM `AutoMigrate` and portable column types compatible with SQLite, MySQL, and PostgreSQL.
- No new dependency or environment variable is required.
- The Stripe key must retain permission to read and update Promotion Codes.
- Deploy backend/API and Recall worker nodes before the frontend so `/api/user/recall/offers` exists when the wallet starts requesting it.
- Complete the backend rollout before relying on cancellation. Old binaries currently consider `cancelled` claim-active, so mixed old/new API nodes create a temporary semantic split during a rolling deployment.
- Do not run the cancellation acceptance test until old API/worker instances have drained. After rollout, confirm the legacy-cancelled revocation scan has disabled the first campaign's outstanding code and that the second campaign appears from a normal wallet visit.
- No existing Checkout Session is migrated or rewritten.

## Non-goals

- Changing campaign audience selection, email delivery cadence, or coupon creation configuration.
- Applying Recall discounts to payment methods that do not currently support Recall.
- Stacking multiple Recall offers in one checkout.
- Retroactively replacing discounts on existing Stripe Checkout Sessions, PaymentIntents, invoices, or subscriptions.
- Exposing raw Promotion Codes in the wallet.
