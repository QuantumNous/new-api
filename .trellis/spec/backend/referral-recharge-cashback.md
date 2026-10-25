# Referral recharge cashback contract

## 1. Scope / Trigger

Use this contract when changing any of the following:

- online `TopUp` creation or provider settlement for Epay, Stripe, Creem,
  Waffo, or Waffo Pancake;
- referral cashback configuration, calculation, review, settlement, incidents,
  debt resolution, reconciliation, or audit events;
- the `cashback_settlement` system task;
- the Root settings UI, Admin `/cashback` UI, device-signal transport, or their
  API types.

The end-to-end flow is:

```text
browser signal + online order
  -> CashbackOrderContext
  -> verified provider success transaction
  -> CashbackReward per enabled direction
  -> per-direction review policy + current hard-block / reconciliation check
  -> payer manual approval/eligible T+N settlement or same-payment immediate issue
  -> User.quota
  -> optional incident recovery / debt
```

The cashback ledger is side-table based. Do not add cashback-specific columns
on `User`, `UserSession`, or `TopUp`, and do not use `aff_quota` as the frozen
cashback balance. Automatic provider refund/dispute callbacks and cash
withdrawal remain outside this contract.

## 2. Signatures

### Go entry points

```go
func InsertOnlineTopUp(
    topUp *TopUp,
    baseQuota int,
    metadata CashbackRequestMetadata,
) error

// Same, inside the caller's transaction (Partner OAuth payment orders).
func InsertOnlineTopUpTx(
    tx *gorm.DB,
    topUp *TopUp,
    baseQuota int,
    metadata CashbackRequestMetadata,
) error

func CompleteTopUpCashbackTx(
    tx *gorm.DB,
    topUp *TopUp,
    creditedQuota int,
    source CashbackCompletionSource,
) error

func MarkManualTopUpCashbackCompletionTx(
    tx *gorm.DB,
    topUp *TopUp,
    creditedQuota int,
) error

func ReviewCashbackReward(
    rewardID int64,
    action CashbackReviewAction,
    reason string,
    reviewerID int,
    now int64,
) (CashbackReviewResult, error)

func IssueCashbackReward(rewardID int64, now int64) (CashbackSettlementOutcome, error)
func SettleMaturedCashbackRewards(now int64, batchSize int) (CashbackSettlementRunResult, error)
func HandleCashbackIncident(topUpID int, input CashbackIncidentInput) (CashbackIncidentResult, error)
func ResolveCashbackRewardDebt(rewardID int64, operatorID int, reason string, now int64) (*CashbackReward, error)
func ResolveCashbackPrincipalDebt(topUpID int, operatorID int, reason string, now int64) (*CashbackOrderContext, error)

func UpdateCashbackSettingAtomic(
    candidate operation_setting.CashbackSetting,
    complianceConfirmed bool,
    now int64,
) (current operation_setting.CashbackSetting, stored operation_setting.CashbackSetting, err error)
```

All online provider completion paths use the package-owned
`cashbackTransaction`, whose isolation is `sql.LevelReadCommitted`. This is
required because beneficiary rows are locked before the rolling 24-hour reward
aggregate is read; MySQL `REPEATABLE READ` can otherwise retain an older
snapshot and overrun the cap.

### HTTP API

| Route | Auth / guard | Contract |
| --- | --- | --- |
| `GET /api/user/topup/cashback-preview?amount=<integer>` or `?product_id=<id>` | Authenticated user + scoped rate limit (60/minute when rate limiting is enabled) | Exactly one selection; response `data: {status, strategy?, rate_bps?, fixed_per_hundred?, tiers?, matched_tier?, config_version?, reward_quota, as_of}`; `status` adds `not_applicable` for tiered token/Creem face, `rounds_to_zero` when a tier is reached but the exact conversion floors to zero quota, and `not_first_top_up` when a first-top-up campaign is live and the user already has a successful wallet top-up; only unreached tiers use `below_minimum`. Only this user's payer estimate; no risk or inviter evidence. |
| `GET /api/cashback/public-offers` | Anonymous + global API rate limit | Whitelisted `{active,currency:"CNY",inviter?,invitee?}` with only active directions' `strategy` and selected `rate_bps` / `fixed_per_hundred` / `tiers` (cent pairs); payer requires a live campaign, and its offer carries `payer_scope:"first_top_up"` only for a first-top-up campaign (omitted for every-order campaigns). Read errors return 503, never false inactivity. |
| `GET /api/cashback/config` | Root | Returns the stored config, `compliance_confirmed`, and the complete `available_auto_review_risk_flags` catalog |
| `PUT /api/cashback/config` | Root | Replaces required fields atomically; omitted optional strategy/fixed-amount and review-policy fields preserve current values under the version-row lock |
| `GET /api/cashback/campaigns` | Root | Lists bounded campaign history |
| `POST /api/cashback/campaigns` | Root + critical rate limit | Creates a nonoverlapping scheduled campaign with `start_at`, `end_at`, `max_rewards_per_user`, optional `payer_scope` (`""` every order, `"first_top_up"`; the latter requires `max_rewards_per_user=1`, otherwise `400`) |
| `POST /api/cashback/campaigns/:id/stop` | Root + critical rate limit | Idempotently stops a campaign without modifying its start/end or existing rewards |
| `GET /api/cashback/rewards` | Admin | Paginated list; filters: `trade_no`, `user_id`, `direction`, `review_status`, `settlement_status`, `risk_level` |
| `GET /api/cashback/rewards/:id` | Admin | Returns reward, order context, snapshots, and usernames; every read emits `cashback.sensitive_view` |
| `GET /api/cashback/summary` | Admin | Returns money/risk/debt/reconciliation aggregates and clusters |
| `GET /api/cashback/users/:id/recorded-spend?start_at=&end_at=&confirm_cny_top_up_id=...` | Admin | Bounded display (90 days, at most 50 positive-amount completed top-ups) and optional repeated per-order Epay CNY confirmations. Optional LOG_DB consume-log aggregates are only recorded-spend observations; an independently bounded full ordered credit scan may return FIFO remaining quota and conditional manual cash reference. Every successful view audits the confirmed IDs. |
| `POST /api/cashback/rewards/:id/review` | Admin + critical rate limit | `{ "action": "approve" | "reject", "reason": string }` |
| `POST /api/cashback/topups/:id/incident` | Admin + critical rate limit | `{ "kind": "refund" | "chargeback" | "dispute", "cumulative_refund_rate_bps": int, "reason": string, "evidence_ref": string }` |
| `POST /api/cashback/rewards/:id/debt/resolve` | Admin + critical rate limit | `{ "reason": string }` |
| `POST /api/cashback/orders/:id/principal-debt/resolve` | Admin + critical rate limit | `{ "reason": string }` |

The recorded-spend report is read-only, not a payout or certified cash balance.
LOG_DB consume intervals can include subscription usage or omit wallet spending;
missing/error LOG_DB returns `log_status=unavailable` and no observed intervals,
without blocking independent FIFO computation. The administrator must stop
usage and confirm the main-DB wallet balance is final (including batch flushes
and reservation refunds); this is an assumption, **not** verified by the query.
The main-DB wallet, event and source checks run in one read-only repeatable-read
snapshot; optional LOG_DB observations run only after it closes. Numeric FIFO
references are deployment-gated by `CASHBACK_REFUND_REFERENCE_ENABLED=true`
(default off): operators enable it only after every writer is upgraded and
source/balance history is reconciled. Reverse source checks scan all history
without relying on second-resolution timestamps from different clocks; they
can detect omissions, not prove completeness. Without this gate the endpoint
still returns bounded recorded intervals and manual reconciliation. The FIFO
scan reads all credit events from a nonrefundable zero wallet opening or a
new-registration opening (including its nonrefundable welcome grant),
independently of the display window (over 1000 events => manual), validates
known source records and exceptional changes, then consumes
`sum(grants)-User.quota` from oldest to newest. Response
`net_spent_quota` must retain that original total; use a separate mutable
allocation cursor while walking FIFO. Returning the cursor after allocation
silently reports zero consumption even when purchased quota was spent. A
historical nonzero/missing opening, negative or excessive balance, missing
evidence, debt, incident,
admin subtract/override or unknown grant requires manual reconciliation;
optional consume logs never certify a particular interval. Gift credits enter
only at actual issuance and are never cash. New admin add batches use their
original declared CNY cents; quota-only adds and non-Epay orders remain in
FIFO but prevent a complete cash total if unspent. Once the ordered credits,
sources and wallet balance pass every numeric-evidence gate, an individually
confirmed Epay order or admin add with declared CNY cents retains its own
per-credit manual reference even when another unspent purchase lacks a cash
face value. The total stays nil/manual; never sum those partial figures as a
complete amount. Any missing source, exception or invalid balance suppresses
all numeric references. Epay signed cents have no
currency: individually confirmed successful Epay orders for the user may be
outside the 90-day display window (at most 50 IDs per request) and receive
CNY *manual reference* amounts in that request; no system verification or
persistent attestation is implied. Integer proration floors each surviving
purchase's paid cents by remaining/original purchased quota. Historical
external refunds, omitted direct credits and old instances cannot be proven
absent by this one evidence table; operators must reconcile these externally.
No wallet, cashback, payout or ordinary spend is mutated by reading.

The normal response envelope is `{ success, message, data? }`. Cashback errors
also expose a stable `code`; a hard block may include `blocking_reason`.
`ErrUserQuotaMutationPending` maps to HTTP `409` with
`CASHBACK_QUOTA_MUTATION_PENDING`; lost fence ownership maps to HTTP `503` with
`CASHBACK_QUOTA_FENCE_LOST`. Both responses use fixed safe messages rather than
Redis/fence diagnostics. Frontend contracts live in
`web/src/features/cashback/types.ts` and must match the controller DTO rather
than GORM models.

### Database signatures

These cashback tables are registered in the main-database migration list:

- `CashbackOrderContext`: unique `top_up_id`; nullable-by-zero campaign association, normalized `base_quota`, immutable checkout `face_amount` (integer) and `quota_per_face_unit` (decimal string), actual
  `credited_quota`, order-local activation eligibility, request risk evidence,
  completion source/provider, incident, cumulative principal reversal, and
  principal debt.
- `CashbackReward`: unique `(top_up_id, direction)`; review source, relationship, calculation,
  explicit `strategy` and `fixed_per_hundred` alongside `rate_bps`, immutable config/risk snapshots, review/settlement state, retry evidence,
  recovery, and reward debt.
- `CashbackDeviceLink`: unique `(user_id, device_fingerprint_hash)` and reverse
  `(device_fingerprint_hash, user_id)` lookup for correlation.
- `CashbackQuotaMutation`: unique `event_key`; main-database transactional
  evidence for issue, reward recovery, and principal recovery. Composite
  `(reward_id, kind)` and `(top_up_id, kind)` indexes support bounded
  reconciliation batches. `LOG_DB` remains human-facing best-effort audit
  evidence and is never the money ledger.
- `CashbackCampaign`: immutable `[start_at,end_at)` window, optional early
  `stopped_at`, positive per-payer reward limit, immutable `payer_scope`
  (`varchar(32) not null default ''`; `''` = every order for all historical
  rows, `first_top_up` = payer's first wallet top-up only; a string, not a
  bool, to avoid boolean-default migration churn) and creator/stopper identities.
  `CashbackOrderContext.campaign_id=0` preserves old/unbound orders;
  `CashbackReward.review_source` distinguishes automatic and manual review while
  empty historical values remain readable.
- `EpayPaymentEvidence`: main-DB side table with primary key `top_up_id`;
  stores the first signed Epay amount and payment identifiers in the same
  transaction as the successful top-up. It is not a wallet credit ledger or
  a currency/merchant-settlement attestation.
- `AdminQuotaCreditEvidence`: main-DB side table for **new** administrator `add`
  operations only. Each positive quota credit and its unique event key, user,
  operator and DB timestamp commit with the locked user wallet row. Its nullable
  `cny_cents` is non-NULL only for new explicit positive bounded integer-CNY-cent
  `add_quota` requests from a form displaying CNY. It records the administrator's
  original input, not signed payment or a conversion of quota. The existing
  display-currency conversion still determines the submitted quota; the server
  validates cents independently of quota and wallet bounds and commits cents,
  credited quota and balance together. USD/token/custom and legacy quota-only
  adds keep NULL; do not infer CNY from quota or backfill historical credits.
  `subtract`/`override` do not create a purchase credit. `(user_id,id)` orders
  only these administrator credits, not other wallet grant sources. This table
  alone is not a wallet ledger, settlement proof, or refund cash quote.
- `WalletRefundCreditEvent`: main-DB `(user_id,id)` ordered low-frequency
  opening/purchase/gift/nonrefundable/exception evidence. Every covered wallet
  grant is written in the same transaction after locking the user's row;
  ordinary consumption never writes an event. `opening` is nonrefundable;
  `source_type=registration` identifies an atomic new-user welcome grant,
  whereas a historical positive `wallet` opening requires manual review.
  Manual order completion uses `source_type=manual_topup` even without a legacy
  order context, participates in FIFO, and never has signed cash provenance;
  online purchases still require a matching context and Epay signature proof.
  Exceptions block numeric output, and event IDs (not seconds) order grants.

The settlement scan index is ordered by
`(review_status, settlement_status, available_at)`. Rolling exposure uses
`(beneficiary_id, created_at)`. JSON snapshots are display evidence; strong
typed columns remain authoritative for transitions.

## 3. Contracts

### Configuration

`CashbackSetting` is stored under the `cashback_setting.*` Option namespace and
is replaced as one object. Rates and money use integer basis points and integer
wallet quota; floating-point money arithmetic is forbidden.

- Both directions default disabled, both rates and fixed amounts default to zero, and both strategies default to `rate`. Each direction independently chooses `rate`, `per_hundred`, or `tiered`; each tier list is independently persisted as bounded JSON under its own Option key. The API represents exact CNY cents as integer `{threshold_cents,reward_cents}` pairs. A missing tier key loads empty; omitted PUT tier fields preserve stored lists under the version lock, while explicit `[]` clears them.
- `inviter_rate_bps` and `invitee_rate_bps` are each `0..10000`; `inviter_fixed_per_hundred` and `invitee_fixed_per_hundred` are integers `0..100`. An enabled direction needs a positive value in its selected strategy. The *selected* nominal returns (rate BPS, fixed amount times 100 BPS, or the maximum exact reward/threshold tier ratio) must sum to at most 100%, even when one direction is disabled. Tier thresholds are strictly increasing positive integer cents, rewards positive and no greater than their threshold, with at most 32 tiers and each cent value at most `common.MaxWalletQuota`; a selected enabled tier strategy requires at least one tier. Inactive fields and unselected tier lists retain previous values across strategy switches.
- `settlement_days` is `1..90`, default `7`.
- `max_reward_quota` and `daily_reward_quota` are
  `0..common.MaxWalletQuota`; both must be positive while either direction is
  enabled.
- IP/device/top-up thresholds default to `3/2/5`; IP and device thresholds are
  `2..100000`, and the top-up threshold is `1..100000`.
- Enabling requires current payment-compliance confirmation.
- The server owns `first_enabled_at` and `version`. The first enable timestamp is
  written once and is never reset by later updates; every successful update
  increments the version under a locked Option row.
- Generated rewards retain their config version and full config snapshot.
  Later configuration changes never recalculate an existing reward.
- Review automation applies only to positive payer (`invitee` wire value)
  rewards. The master switch defaults off; `auto_review_risk_flags` is `null`
  until explicitly configured. Unconfigured or master-off means manual review,
  even when legacy level switches would have approved. Once configured, `[]`
  explicitly means no risk flag routes to manual review; any intersection of
  selected and observed flags routes to `pending/frozen`, otherwise the reward
  is automatically approved. All 23 existing emitted flags are selectable,
  including `open_debt`, which occurs only on canceled zero rewards and cannot
  bypass the debt block. Risk levels remain evidence, not review gates. A
  nonempty selection must be bounded, allowlisted, unique and stored in sorted
  order; malformed, null, unknown, duplicate or oversized PUT values return
  `400` with `field=auto_review_risk_flags`. The Option is absent until an
  explicit policy save, and older PUT clients omitting it cannot create or
  erase it. Old four-level Options remain stored for rollback but are neither
  exposed in the Root DTO nor used in new decisions. Config and risk snapshots
  preserve the payment-time policy, decision (`master_disabled`,
  `policy_unconfigured`, `selected_flags`, `automatic`) and matched flags on
  positive payer rewards; past rewards are never rewritten. Admin detail alone
  exposes routing and sensitive evidence. `auto_review_immediate_issue` defaults
  on but acts only for auto-approved rewards. Inviter always needs manual
  review. Missing strategy Option keys load `rate`; a historical reward with
  empty strategy is displayed as a percentage, not reclassified or recalculated.
- Campaigns are explicitly created, never synthesized at migration. Creation
  and early stop serialize on the config version Option row. Order creation
  captures campaign ID only when both server order-placement time and stored
  order time are in its active window and the payer switch is enabled; payment
  must also complete inside the same live campaign. Positive payer rewards
  consume one per-user per-campaign slot even if later canceled or recovered.
  Zero rewards do not count. No campaign never blocks inviter cashback.
- A `first_top_up` campaign rewards a payer only when, at verified completion
  and under the existing ascending payer/inviter row locks, the payer has no
  other successful `TopUp` with `amount > 0` (any provider or completion
  source, including Partner OAuth balance and admin manual completion;
  subscription purchases mirror into `top_ups` with `amount = 0` and do not
  count; redemption codes and registration grants are not top-ups). Otherwise
  the payer direction records a canceled zero reward with
  `cap_reason=not_first_top_up` and `blocking_reason=no_payable_cashback_quota`.
  The first top-up is final even when it earns nothing (for example below
  every tier), so later orders are never first. Inviter rewards on the same
  order are unaffected. Rolling back to a binary without this column turns a
  live first-top-up campaign into an every-order campaign: stop such
  campaigns before rollback.
- The authenticated, user-rate-limited `GET /api/user/topup/cashback-preview`
  returns only a payer-facing, point-in-time rule and estimate for the selected
  standard face amount or enabled Creem product ID. It reads current campaign,
  payer eligibility, positive campaign-slot usage, and rolling-24-hour caps
  without writing, reserving a slot, or exposing risk evidence. Standard
  currency display uses the order face; token display and Creem product quota
  follow their existing order snapshot, never discounted checkout price. Tiered
  estimates exclude token/Creem faces. No active campaign, exhausted
  allowance, ineligibility and service failure are distinct UI outcomes;
  stale amount responses must not overwrite the current selection. A tiered
  `rounds_to_zero` response retains `matched_tier` and states that the exact
  reward is below one wallet quota unit, not below the configured face
  threshold. The estimate never becomes payment or issuance input and may
  change by payment.

### Order creation and provider completion

- `base_quota` is the face value selected/input by the user in wallet quota, normalized at order creation. It is not provider money, discounted payment, or credited quota. New online orders also snapshot positive `CashbackRequestMetadata.FaceAmount` and decimal-string `QuotaPerFaceUnit`; their product must agree with `base_quota` within one quota unit. Standard currency-display orders use the requested integer face amount and checkout `common.QuotaPerUnit`. Token-display orders use the normalized credited face (`base_quota`) with factor `1`, not raw requested tokens; Creem product face is its `Quota` with factor `1`. Neither discounted price nor mutable post-checkout conversion settings can reconstruct this evidence.
- Every newly created online order gets a `CashbackOrderContext`, including
  before first enable. `eligible_after_first_enable` persists the activation
  decision visible in the order-creation transaction; payment completion must
  not reconstruct ordering from second-resolution timestamps.
- `InsertOnlineTopUp` creates `TopUp` and its context atomically. Pre-enable
  contexts settle normally but never create rewards. Orders created before the
  code owned order-local snapshots are not backfilled.
- `CashbackRequestMetadata.IneligibleReason` excludes an order at creation.
  The only allowed value is `partner_oauth` (orders a partner assistant placed
  through `POST /api/integrations/v1/payment/orders`). The context still keeps
  face evidence and settles principal normally, but stores the reason in
  `cashback_order_contexts.ineligible_reason`, binds no campaign, records no
  request IP/UA/device evidence (the request came from the partner server, not
  the payer's browser), writes no device link, and completion creates no
  reward. Unknown reasons are rejected.
- A clearly post-enable online order cannot settle without its context. For
  legacy context-less orders, `first_enabled_at` remains a compatibility
  fallback, with timestamp equality treated as pre-activation because new
  same-second orders carry an explicit context.
- Verified provider settlement marks the order successful, credits purchased
  quota under the payer's existing quota fence, then calls
  `CompleteTopUpCashbackTx` in the same database transaction. This ordering
  prepares transaction-local immediate issuance without issuing it yet.
  Before purchase credit, read the payer's inviter, lock payer and possible
  inviter in ascending user ID order (as reward issuance does), then recheck
  the payer's referral identity under the lock. A changed referral fails the
  transaction for a retry rather than adding a later lock in reverse order.
  Verify the owned payer quota fence again after cashback completion and before
  commit; pre-credit verification alone cannot protect subsequent mutations.
  Any cashback invariant or fence failure rolls back the purchase credit,
  order status, and reward mutation so the provider can retry; only a committed
  purchase refreshes the quota cache after the transaction.
- Both verified Epay notify and browser return pass the signed `money` to the
  settlement transaction. Pending orders require a positive decimal amount
  with no more than two fractional digits, parsed in integer cents and equal
  to the stored order's original two-decimal checkout price. Invalid or
  mismatched amounts fail the callback without credit; a later valid callback
  remains retryable. The first verified completion atomically stores an
  `EpayPaymentEvidence` row (unique `top_up_id`): signed paid hundredths,
  merchant `out_trade_no`, gateway `trade_no`, signed merchant `pid`, completion
  source, and payment timestamp; retries never overwrite it. Pending Epay
  orders cannot settle without nonempty, bounded verified gateway trade number
  and merchant ID; missing/invalid details leave the order and wallet unchanged.
  Already successful historical orders remain idempotent without such details.
  No secret key is stored. Legacy completed orders without evidence are not
  backfilled. Epay's
  signature does not attest currency: this evidence alone is **not** a CNY
  attestation or permission to offer an automatic cash refund quote.
- `provider_callback` and `verified_return` are eligible completion sources.
  `admin_manual` records the completion evidence but cannot generate rewards.
- The payment-time configuration decides payer eligibility independently of a
  referral, subject to its order-bound live campaign and per-user positive
  reward limit. Only inviter rewards require an unchanged valid referral.
  Each eligible direction gets at most one row, enforced by
  `(top_up_id, direction)`.
- Rate calculation is `floor(base_quota * rate_bps / 10000)`. Tiered calculation on a supported standard CNY face is the single highest reached tier's fixed reward cents multiplied by the checkout factor and floored once to strict wallet quota; `face_amount*100` comparison is bounded. A face below all thresholds creates a canceled zero reward. Creem (by existing provider) and token/product faces (checkout factor at or below `1`) cancel with `strategy_not_applicable`; a missing checkout face/factor cancels with `face_basis_unavailable`, never guessing from quota. A standard checkout configured with factor `1` is conservatively excluded too: without a provenance field it is indistinguishable from token face and needs a separate design before enabling that mode. Existing rate/fixed strategies keep their behavior. Fixed calculation is `floor(floor(face_amount / 100) * fixed_per_hundred * quota_per_face_unit)` using checkout evidence, decimal arithmetic and strict bounded wallet conversion. Remainders never carry to another order. All strategies then use existing single-reward and beneficiary rolling-24-hour caps, risk/review/issuance/refund paths. A zero result is a canceled, explainable record. For a legacy pending order without trusted face evidence, payment succeeds and its fixed-direction reward is canceled with `face_basis_unavailable`; never guess from `TopUp.Money` or current quota conversion. Payment-time setting chooses each new reward and is stored on its row; historical rewards are immutable.

### Risk, review, and settlement

- Device/IP/User-Agent data is evidence, never authentication. The browser may
  send `X-Device-Signal: v1:<64 hex chars>` on the allowlisted login,
  registration, OAuth handoff, and online top-up POST routes.
- The server accepts at most 128 characters, hashes a valid signal again, and
  stores `valid`, `missing`, or `invalid`. Missing/invalid data raises risk but
  must not block login or payment. Missing devices use a user-isolated anchor
  for first-IP history and are excluded from shared-device counts.
- A single shared IP or device is only a risk flag. Risk snapshots combine
  account age, registration delay, session/IP/UA evidence, device rotation,
  provider consistency, top-up outcomes/frequency/amount patterns, inviter
  concentration, prior incidents, and exposure caps.
- Inviter and payer rewards requiring review begin `pending/frozen`.
  Auto-approved payer rewards begin `approved/frozen` with
  `review_source=automatic`, `reviewed_by=0` and a review timestamp. If the
  immediate switch is on, `available_at=paid_at`; otherwise they retain T+N.
  A positive manually approved payer reward may issue on approval without
  waiting for its original `available_at`. Existing approved/frozen manual
  payer rewards are eligible for bounded scheduler pickup before that date.
  Preserve their original maturity, amount, snapshots and review evidence;
  empty historical review sources qualify only with `reviewed_by > 0`.
  Automatic approvals never become manual through configuration changes.
- A zero-payable reward is canceled before payer auto-review; its persisted
  `review_status=pending` may remain as historical evidence, but a canceled
  reward is not an actionable review. Every Admin reward-list filter, its
  pagination/count, and the rejected-or-canceled summary count exclude
  zero-quota rows, including orders below the fixed per-100 threshold. Keep
  the record in the database and retain calculation, cap and block reasons
  through detail lookup by ID for audit. Do not fabricate approval to suppress
  a misleading pending badge.
- Reject always requires a non-empty reason. Approving `high` or `severe` risk
  also requires a reason.
- Issuance requires all of: `approved`, `frozen`, positive reward quota,
  either `now >= available_at` or a manual payer review (including historical
  empty source with positive reviewer ID), a successful matching online order,
  enabled payer/beneficiary
  accounts, eligible completion source/channel, no incident, and no open
  beneficiary reward or principal debt. An inviter reward additionally requires
  an unchanged valid referral; payer rewards do not. Immediate issuance runs
  after purchased quota credit in the verified payment transaction, uses the
  held payer quota fence and transaction-local bounded reconciliation, and
  writes a unique issue mutation before commit. A failed check rolls back both
  purchase and reward. Post-commit cache publication invalidates the balance
  instead of publishing only the purchase delta when an immediate gift issued.
- Row locks, the unique mutation event, and state predicates—not the scheduler
  lease—guarantee at-most-once issuance. An empty due-reward check is cached in
  the master process for one hour; a newly matured reward can therefore wait up
  to about an hour before its first settlement attempt (including manual payer
  rewards whose immediate issue was deferred). Due batches continue at most
  once per minute in groups of 100, including approved/frozen manual payer
  rewards with a future original hold date and respecting retry times as
  earliest eligibility, not an exact wakeup guarantee. An isolated retry may
  also wait for the next hourly idle probe. Failed due checks do not start the
  hourly idle delay. Before issuing, it
  advances a bounded, primary-key ordered
  reconciliation page across rewards, order contexts, and mutation evidence; a
  mismatched page remains pinned and stops settlement until repaired. Process
  restart safely begins the bounded scan from the start instead of running an
  unbounded full-history count.
- `reconciliation_issues` is the issue count from the current bounded page, not
  a full-history total. Repeated clean calls advance the in-process cursor and
  eventually cycle through all rows. Standalone multi-query reconciliation
  pages use one read-only repeatable-read snapshot: reward state and its issue
  mutation commit together, so separate READ COMMITTED/autocommit SELECTs can
  otherwise combine the pre-issue reward with post-issue evidence and falsely
  pin a healthy page. Advance or unpin the cursor only after the snapshot
  transaction commits; a failed read or commit must not skip an unchecked page.
  Do not change provider payment transactions from READ COMMITTED; their
  locked-user rolling-cap read depends on it.
- A blocked or failed frozen reward records the reason/error and a retry time.
  For review requests, only fence acquisition/verification and an actual
  issuance attempt are settlement failures; invalid review transitions do not
  delay settlement. A fence acquisition failure is recorded only when the
  persisted reward was already approved, frozen, and effectively eligible.
  Ineligible and pending records do not fabricate failures.

### Incidents, recovery, and debt

- Incidents are manual and provider-neutral. A reason is mandatory and reason /
  evidence values are each limited to 1000 characters.
- The request carries the cumulative principal refund rate, never a per-call
  delta. It is `0..10000` and monotonically non-decreasing. Refund requires a
  positive rate; chargeback is forced to `10000`; dispute may begin at zero.
- The same incident kind plus the same cumulative rate is idempotent.
- Any incident cancels frozen rewards or attempts to recover every issued reward
  before reversing the incremental principal target. Principal target is
  `floor(credited_quota * cumulative_rate / 10000)`.
- Insufficient available quota creates reward/principal debt. Any open debt for
  the beneficiary blocks later cashback creation, approval, and issuance.
- Redis-enabled issue/recovery acquires sorted per-user quota mutation fences
  before the database transaction. The fence rejects concurrent cache writes
  and spending, keeps an owned cache generation stable through the DB decision,
  and verifies ownership before commit. Success, error, and panic invalidate the
  cached balance and retain a short cooldown fence so pending batch deltas can
  reach the database before authoritative rehydration. A lost owner still
  deletes the balance hash but never deletes or weakens a replacement owner's
  fence, so a rolled-back cache debit cannot become readable.
- Recovery holds the user-quota batch accumulator boundary while checking and
  reserving Redis. Any queued or already-swapped/in-flight user-quota delta
  makes the locked DB row non-authoritative and aborts accounting as retryable,
  including when the user cache hash is absent. Retry only after the batch delta
  has flushed. In `model/quota_reserve.go:userQuotaDeltaScript`, pass the signed
  decimal `ARGV[1]` directly to Redis `HINCRBY`; converting it with Lua
  `tonumber` rounds odd integer deltas above 2^53 and causes the cache to
  disagree with the committed wallet row by one quota unit.
- During an active quota fence, authentication and profile reads may return a
  direct DB snapshot without publishing it into Redis. Quota-authoritative reads
  (`GetUserQuota`, billing trust checks), reservations, and cache publication
  preserve `ErrUserQuotaMutationPending`, so a direct identity snapshot can
  never become spend authority. Committed authentication-version floors and
  required session revocation run independently of deferred quota-cache refresh;
  post-commit cache publication errors are logged rather than reported as a
  rollback. Cache mutation errors otherwise fail closed.
- Debt resolution is an explicit audited administrative disposition: it clears
  the selected debt record but does not restore a canceled reward. Blocked
  rewards are released for retry only after all reward and principal debt for
  that user is closed.

### Admin frontend

- Root configuration stays in Billing & Payment; review operations stay on the
  Admin-only `/cashback` route. Do not expose bulk review.
- Sensitive detail is fetched afresh whenever the detail sheet opens so every
  full IP/device view is audited; clear its query cache on close.
- Mutations disable repeat submission and invalidate list, summary, the changed
  reward, and any other reward details affected by an order-level incident or
  debt transition. Pending dialogs keep Confirm disabled but remain dismissible
  through Escape, Close, and Cancel; mutation-owned invalidation must still run
  after the dialog unmounts.
- Root must deliberately activate an unconfigured per-flag policy; unrelated saves leave it absent. The form warns that all new payer rewards remain manual until activation, lists all 23 backend-provided choices with independent labels, and confirms an explicit empty selection before saving. Activation with an empty list may expand auto-approval when the master switch is on. The settings form conditionally shows rate or fixed input for each direction, validates selected nominal exposure, and uses the same high-exposure confirmation. The list/detail display fixed rewards as per-100 amounts and historical empty-strategy rows as percentages. All visible strings use the seven project locales. Dialog reason fields need
  labels, validation/error association, keyboard handling, and focus recovery.
  Count copy must choose singular/plural from the raw numeric count before
  applying locale-specific number formatting.
- The default `/` page (only when no administrator custom home is configured)
  presents the public cashback campaign until 2026-10-08 00:00 Beijing time;
  at that instant it returns to the original product landing, including when
  left open. This date controls presentation only, never payment eligibility.
  While mounted, the campaign renders only the whitelisted live offer response;
  it refreshes on focus and every 30 seconds, including while backgrounded.
  During a refresh or error it must hide cached active rules. The permanently
  translated National Day kicker is marketing copy, not activity eligibility;
  no live offer still renders an explicit inactive state. The site-wide
  reward banner (all pages except setup, OAuth, desktop and error routes) is
  built only from the live public offer plus `/api/status`
  `quota_for_new_user`/`register_enabled`; it never accepts administrator
  free text. Unlike the campaign page it keeps the last successful offer
  during a background refresh (60s interval and on focus) to avoid flicker,
  but hides entirely on a failed read. `/activity` instead
  introduces DeepSeek and GPT subscription cards without asserting plan terms.
  A reached tier whose exact conversion floors to zero keeps its matched tier
  in audited detail,
  except when `strategy_not_applicable` or `face_basis_unavailable` says the
  face cannot be trusted. Root's cent editor returns focus to Add after deleting
  a tier with the keyboard.

## 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Preview supplies neither/both selectors, duplicate selectors, malformed/out-of-range amount, unknown/disabled Creem product | `400`; no estimate or mutation. A valid selection with no eligible activity returns `200` with a non-estimated status; DB/config read failure returns `503`, never a false zero reward. |
| Malformed config JSON, invalid strategy/fixed range, duplicate/non-increasing/empty active tiers, overflowing cents, or selected nominal sum above 100% | `400`; config validation includes the offending `field`; no partial Option update |
| `auto_review_risk_flags` is explicitly `null`, malformed, duplicated, unknown, or over 1024 JSON bytes | `400`, `field=auto_review_risk_flags`; neither version nor policy Option changes |
| `auto_review_risk_flags` omitted by an old or unrelated PUT | Preserve the stored list under the version lock; if absent, leave the Option absent and route new positive payer rewards to manual review |
| Either direction enabled without compliance or positive caps | `400`; keep the previous complete configuration |
| Anonymous public offers read when Option table is absent or DB read fails | `503`, never misreport `active:false` |
| Reached tier whose reward floors below one wallet quota unit | `rounds_to_zero` preview with `matched_tier`; keep an auditable canceled zero reward, not a false below-threshold message |
| Client attempts to send `first_enabled_at` or `version` | Ignore by DTO ownership; server derives both |
| Invalid reward/list ID, filter enum, user ID, or overlong trade number | `400`, no unbounded query |
| Missing reward / top-up | `404` |
| Invalid transition, open-state conflict, or debt state conflict | `409` with `CASHBACK_STATE_CONFLICT` or the applicable conflict response |
| Current hard blocker on approval/issue | `409`, `CASHBACK_HARD_BLOCKED`, and `blocking_reason`; never issue quota |
| Reject without reason, or high/severe approval without reason | `400`, `CASHBACK_REASON_REQUIRED` |
| Review/incident/debt reason over 1000 characters | `400`, no mutation |
| Refund rate outside `0..10000`, decreases, or refund uses zero | `400`, `CASHBACK_REFUND_RATE_INVALID` |
| Repeated verified payment callback | Return the provider path's idempotent success; do not credit top-up or create rewards twice |
| Post-enable online order lacks its context | Roll back provider completion; callback path must return retryable failure |
| Manual top-up completion | Credit only the top-up; persist ineligible source when context exists; create no reward |
| New order predates first enable | Persist an ineligible context; payment succeeds normally and creates no reward |
| Partner OAuth payment order | Persist context with `ineligible_reason=partner_oauth`, empty request evidence and no device link; payment succeeds normally and creates no reward |
| Legacy pending order has no checkout face evidence under a fixed payment-time strategy | Complete purchase; create canceled zero-value fixed reward with `face_basis_unavailable` |
| New checkout face conversion disagrees with base quota | Reject order/context atomically; never settle by guessing from price |
| Device signal absent, malformed, too long, or Web Crypto unavailable | Continue auth/payment; snapshot `missing`/`invalid` risk evidence |
| Manual payer approval occurs before original `available_at` | Issue once in the fenced review transaction if safe; otherwise remain uncredited with a retryable failure/blocker |
| Inviter approval or automatic payer approval with immediate issue off occurs before `available_at` | Keep frozen until original maturity |
| Scheduler sees a blocked reward | Keep frozen, store blocker/retry time, and do not credit quota |
| Bounded reconciliation page finds inconsistent state/evidence | Pin the page and fail the settlement run before issuing another reward |
| Queued/in-flight user-quota batch delta exists, with or without a cache hash | Abort incident accounting as retryable before state/debt/ledger mutation; flush the delta before retry |
| Cashback action encounters `ErrUserQuotaMutationPending` | `409`, `CASHBACK_QUOTA_MUTATION_PENDING`, fixed safe retry message; no mutation |
| Cashback action loses quota fence ownership | `503`, `CASHBACK_QUOTA_FENCE_LOST`, fixed safe retry message; roll back database mutation |
| Cashback money transaction encounters Redis failure or loses its fence | Roll back DB, invalidate the affected balance hash without altering a replacement fence, record settlement error/retry evidence for an eligible matured reward, and keep cache spending unavailable until safe rehydration |
| Identity/profile read occurs during quota cooldown | Return a direct DB snapshot without publishing cache; quota-authoritative reads and billing trust checks retain the pending error |
| Security mutation commits while quota cache refresh is deferred | Publish/retain the auth-version fence, complete required session revocation, log cache refresh failure, and do not report a false database rollback |
| Invalid review transition on an approved mature reward | Return the transition error without writing settlement failure metadata or delaying the scheduler |
| One of several user debts is resolved | Keep the user blocked until every open reward/principal debt is closed |
| Separate `LOG_DB` unavailable or recorded-spend query fails | Return `log_status=unavailable` and no interval totals; never fabricate zero or clear independent, evidence-qualified main-DB FIFO/CNY references |

## 5. Good / Base / Bad Cases

- **Good:** A current payer previews a 250-face fixed-per-hundred order and sees two hundreds of reward under current caps; a discounted checkout does not reduce the estimate, and payment completion independently recalculates it.
- **Base:** No active campaign or no amount selected returns a distinct status with zero reward; a switch to another amount hides the old query result while the new request is pending.
- **Bad:** Use a provider's discounted price or a stale amount response as the preview face, or feed an estimate back into settlement as authoritative quota.
- **Good:** Root explicitly saves `["device_missing"]`; a new positive payer reward with that flag stays `pending/frozen` while the verified purchase credits normally, and the Admin detail shows `selected_flags` plus the matched flag. A retry creates no duplicate reward.
- **Base:** The new policy Option is absent after upgrade or an unrelated legacy PUT; even with the auto-review master on, payer rewards remain manual until Root explicitly activates the policy. An explicit `[]` is a different, confirmed state that allows otherwise eligible positive rewards to auto-approve.
- **Bad:** Treat a missing Option as `[]`, apply the retired four risk-level switches to new decisions, or use an unchecked `open_debt` flag to bypass the debt hard block.
- **Good:** A post-enable Stripe order with both directions enabled settles once.
  The same transaction snapshots the face-value base, creates inviter and
  invitee rewards, and credits the purchased quota. A repeated webhook changes
  nothing.
- **Good:** Fixed X=20, face=250, factor=500000 creates a 20,000,000-quota inviter calculation (two complete hundreds); a separate face=99 order yields zero, and 60+40 across orders never combines into a hundred. The payer may independently remain rate-based. Payment-time strategy changes affect only new rewards.
- **Good:** Tiered 100.50→2.50 and 200→15 pays 15 on a 200-face order, once per direction; an integer 100-face order remains below the first tier. The public page displays only live CNY rules and withdraws them during refresh, while its National Day kicker stays fixed.
- **Bad:** Treat `factor=1` product/token quota or a stale public offer as a trusted CNY face, or label a reached tier with zero quota as below the threshold.
- **Good:** An approved reward reaches T+7. The scheduler locks it, rechecks the
  order, relationship, incident, channel, account status, and debt, then moves
  `frozen -> issued` while crediting `quota` once.
- **Good:** A 25% refund cancels/reclaims all rewards and targets 25% of the
  original credited principal. A later 100% request reverses only the remaining
  75%; repeating 100% is idempotent.
- **Base:** Both switches are off after first enable. New online orders still
  retain context evidence, but payment success creates no rewards.
- **Base:** Device storage or Web Crypto is unavailable. Payment still works and
  `device_missing` remains visible to the reviewer.
- **Base:** An order created before the immutable activation boundary succeeds
  after activation. It remains ineligible and receives no backfill.
- **Bad:** Calculate fixed cashback from `TopUp.Money`, provider-paid currency, current conversion settings, or credited quota; these meanings differ by provider or time.
- **Bad:** Credit the wallet first and create cashback records in a second
  transaction; a crash would make payment and cashback disagree.
- **Bad:** Treat shared IP/device as an automatic reject or a trusted identity.
- **Bad:** Resolve one debt and clear every frozen reward for the user while
  another reward or principal debt remains open.

## 6. Tests Required

### Backend assertions

- Configuration: defaults; independent strategy/fixed/tier fields; exact cent parsing, order, count, bounds, mixed nominal return bounds; old-client omitted-field preservation under concurrent versioned writes; missing/null/empty/selected risk policy and allowlist validation; compliance; positive caps; immutable first-enable timestamp. Verify Option and in-memory slice replacement on SQLite/MySQL/PostgreSQL.
- Migration: cashback side tables without columns on `TopUp`; fresh, representative released-schema upgrade and twice-repeated migration on real SQLite/MySQL/PostgreSQL when their schema changes; old context/reward rows retain data, indexes and uniqueness. Historical empty strategy is rate.
- Tiered compatibility: tiered adds only two Option keys and no tables or columns. Existing `CashbackOrderContext` checkout face/factor and provider remain unchanged; old missing face evidence cannot qualify for tiered. Verify Option, existing order/reward read/write and retry on real SQLite/MySQL/PostgreSQL before rollout; do not claim three-engine compatibility without the matrix.
- First-top-up campaigns: first wallet top-up rewarded, later orders and payers with any earlier successful wallet top-up (manual included) get canceled `not_first_top_up` rows, zero-amount subscription mirrors do not count, a below-minimum first order still uses the first top-up, preview returns `not_first_top_up`, creation rejects unknown scopes and `max_rewards_per_user != 1`; concurrent completions for one payer yield exactly one first reward on real PostgreSQL.
- Preview: authenticated selection/invalid/disabled-product cases; tiered standard cent boundaries, `rounds_to_zero` with matched evidence, explicit token/Creem/factor-1 `not_applicable`; compare unchanged fixed/rate currency, token and Creem face estimates with verified settlement, positive campaign slots (including later canceled/rejected), 24-hour caps and zero/ineligible/no-campaign states; assert no reward/wallet write. Public route tests cover anonymous access, Root-only config, limiter, inactive/missing Option state, and no sensitive fields; mounted-page tests cover polling/focus refresh and stale-rule suppression. Use real three-dialect integration for query and counting changes, not SQLite alone.
- Provider matrix: Epay, Stripe, Creem, Waffo, and Waffo Pancake create correct checkout face evidence (including token normalization and Creem product quota); fixed 99/100/250 and split 60+40, mixed directions, single/24-hour caps, payment-time switches, legacy missing-basis cancellation and unchanged historical reward; forged callbacks rejected, verified retries idempotent, manual completion ineligible.
- Transactionality: a missing required context or cashback insert failure rolls
  back provider completion and wallet credit. Run concurrent cap/settlement
  tests and `go test -race` for cashback state.
- Review/settlement: four states (master off, missing policy, explicit empty, matched/unmatched selection), 23-flag catalog parity, decision/matched snapshot and historical readability; debt/zero cancellation still blocks issue; reason rules, immediate manual payer approval, legacy
  reviewed-by evidence and bounded early pickup, inviter/automatic hold
  boundaries, hard blockers, task retries, reconciliation stop, wallet maximum,
  and at-most-once quota credit. All list filters/count/pages and the
  rejected-or-canceled summary count omit zero rewards (including a fixed
  per-100 order with face 50); reward detail still retains audit evidence.
- Incident/debt: cumulative partial-to-full refund, decreasing/duplicate rates,
  reward-before-principal recovery, insufficient balances, queued and in-flight
  batch deltas with warm/cold caches, fence-protected cache expiry/rehydration,
  ownership loss on commit/rollback/panic, durable mutation evidence, and
  all-debts-closed unblocking.
- Read-only refund report: on known ordered grants, assert `net_spent_quota`
  equals `sum(grants)-wallet_quota` **and** exact per-batch remaining quota for
  35/125, delayed-gift and final-net-reservation cases; separate main/log DB
  must not alter FIFO, and unavailable logs must never masquerade as zero.
  Exercise a real, separately configured ClickHouse `LOG_DB` through
  `InitLogDB` twice and `GetCashbackRecordedSpendReport`: interval SUM/COUNT
  are log observations only; missing log table/DB yields `unavailable` without
  changing the main-DB wallet or a qualified FIFO amount. Record the actual
  ClickHouse version and do not infer results for other versions.
- Shared auth/billing blast radius: identity reads remain available during a
  quota fence, quota getters above the trust threshold remain fail-closed,
  committed auth changes publish/retain their floor and revoke sessions even
  when quota-cache refresh or Redis is unavailable, and invalid review actions
  never write settlement retry metadata. Run
  `TestManageUserQuotaCacheUsesCommittedIntegerDifference/large_odd_difference`
  with Redis: exact DB/cache equality is required above the JavaScript-safe
  integer boundary, not merely a rounded numeric comparison.
- Risk: missing/invalid device, shared IP/device, login mismatch, account age,
  velocity, repeated/small-then-large amounts, inviter concentration, and the
  rule that one correlation signal does not auto-reject.

Primary regression files are `model/cashback_test.go`,
`model/cashback_integration_test.go`, `controller/cashback_config_test.go`,
`controller/cashback_webhook_security_test.go`, and the affected provider
controller/model tests. Exercise MySQL/PostgreSQL row-lock and isolation paths
through the isolated `TEST_MYSQL_DSN` / `TEST_POSTGRES_DSN` integration test
before changing transaction ordering. Missing DSNs must produce an explicit
skip and must never be represented as production-database verification.

### Frontend assertions

- Config cross-field validation, read-only activation metadata, and server field
  errors.
- Admin route permissions, filters, summary, detail refresh/audit behavior,
  action reason requirements, disabled repeated submission, and query
  invalidation after order-wide changes.
- Device header allowlist, stable `v1` signal, storage/Web Crypto failure, and no
  signal on unrelated requests.
- Wallet preview: stale amount/product requests never show an older reward; inactive,
  cap exhausted, invalid selection and request failure are distinct; Creem uses
  product quota instead of price and small positive quotas never round upward.
- Seven-locale key/placeholder parity, keyboard/focus behavior, narrow layout,
  type-check, lint, and production build.

## 7. Wrong vs Correct

### Preview is not settlement input

```go
// Wrong: cached UI estimate decides payout or reserves a campaign slot.
rewardQuota := request.EstimatedRewardQuota
// Correct: verified payment completion recalculates under the live campaign,
// immutable checkout face snapshot, user locks, caps and risk checks.
err := CompleteTopUpCashbackTx(tx, topUp, creditedQuota, source)
```

### Payment transaction ownership

```go
// Wrong: payment can commit while cashback silently fails later.
creditTopUpQuota(DB, topUp.UserId, creditedQuota, nil)
go createCashback(topUp)

// Correct: one row-locked READ COMMITTED transaction owns all money state.
err := cashbackTransaction(func(tx *gorm.DB) error {
    // lock TopUp, validate provider, mark success
    // This locks potential beneficiaries by ascending ID, credits the payer,
    // completes cashback, and verifies the payer fence again before commit.
    return creditOnlineTopUpWithCashbackTx(tx, topUp, creditedQuota, nil, source, payerFences)
})
```

### Configuration ownership

```go
// Wrong: transiently stores an enabled direction with an invalid zero selected value.
UpdateOption("cashback_setting.inviter_enabled", "true")
UpdateOption("cashback_setting.inviter_rate_bps", "500")

// Correct: merge omitted strategy fields under the lock, validate selected
// nominal return, then persist one locked, versioned object.
_, stored, err := UpdateCashbackSettingAtomic(candidate, compliance, now)
```

### Missing policy is not an empty policy

```go
// Wrong: absence silently enables automatic approval for every risk flag.
selected := append([]string{}, setting.AutoReviewRiskFlags...)
if len(selected) == 0 { approveAutomatically() }

// Correct: nil is the unconfigured, manual-review state; a non-nil
// empty slice is an intentional, confirmed policy. Existing hard blockers
// still run independently of the flag intersection.
if setting.AutoReviewRiskFlags == nil { requireManualReview() }
```

### Incident arithmetic

```go
// Wrong: retrying a 25% per-call delta deducts principal twice.
principalToDebit := creditedQuota * request.RefundPercent / 100

// Correct: derive the new cumulative target and apply only its increase.
newTarget := floor(creditedQuota * cumulativeRateBPS / 10000)
deltaTarget := newTarget - oldTarget
```

### Exact Redis wallet deltas

```lua
-- Wrong: Lua doubles cannot represent every int64 delta.
redis.call('HINCRBY', KEYS[1], 'Quota', tonumber(ARGV[1]))

-- Correct: Redis parses the decimal integer string itself.
redis.call('HINCRBY', KEYS[1], 'Quota', ARGV[1])
```

### Device and detail boundaries

```ts
// Wrong: device evidence becomes an authentication/payment prerequisite.
if (!deviceSignal) throw new Error('device required')

// Correct: attach when available; the server records missing/invalid as risk.
const signal = await getDeviceSignal()
if (signal) config.headers[DEVICE_SIGNAL_HEADER] = signal
```

Do not retain sensitive detail indefinitely in the query cache. Re-fetch it on
each sheet open and remove it on close so each full IP/device view crosses the
audited backend boundary.
