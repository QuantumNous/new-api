# Flatkey Lifecycle Email Review Remediation Design

## Status and approval

This design resolves the verified findings from the OpenCodeReview comment on PR #677 at commit `52a33ad4`. The review produced 29 comment entries, which reduce to 20 independent technical concerns after removing duplicates, wrong-file anchors, and invalid premises. The user approved the comprehensive remediation scope by replying `修` after the triage report.

## Goal

Make lifecycle-email delivery, payment lifecycle transitions, quota accounting, and Continuous campaign editing safe under retries, concurrent application nodes, rolling deployments, and stale UI state, while preserving the intentional ability to correct a failed payment with a later authoritative success callback.

## Scope

The remediation includes every verified or partially verified finding:

1. Recall lifecycle event insertion reports non-duplicate MySQL errors.
2. SMTP eligibility evaluation no longer executes a complex service callback while holding the recipient row lock.
3. Claimed lifecycle events leave `leased` when their campaign becomes unavailable.
4. Continuous activate, resume, cancel, and slot operations use one campaign-before-slot lock order.
5. Continuous activation writes an atomic administrator audit event.
6. Lifecycle metrics degrade only for non-running campaigns whose collection marker is not ready; running-campaign corruption remains visible.
7. Preview derives and enforces the delivery policy required by its lifecycle trigger.
8. Subscription fallback quota settlement dispatches subscription notifications.
9. Waffo/Pancake checkout failure reports lifecycle transition failures.
10. Subscription success requires an entitlement scope before the order and lifecycle quota cycle can commit.
11. Completed subscription orders can repair a missing provider binding.
12. Stripe-to-balance compensation repairs historical successful orders whose intent or entitlement is incomplete.
13. Top-up terminal failures receive a terminal `complete_time`.
14. DataTool settlement/refund has a single terminal-transition owner and cannot underflow user or token `used_quota`.
15. Recall preview responses are fenced by delivery policy and lifecycle trigger as well as body/type.
16. Leaving Continuous mode restores a valid non-Continuous draft.
17. Plain-text email conversion removes policy-forbidden template actions.
18. The API wire encoder fully canonicalizes Continuous-only inactive fields.
19. Continuous submit normalization rejects a missing English stage with a stable validation error.

The remediation does not change these reviewed behaviors:

- A later authoritative success callback may correct `failed`, `expired`, or `cancelled` top-up state. This is required by the existing lifecycle design and tests.
- A legacy Continuous draft with a missing `delivery_policy` continues to derive its effective policy from `lifecycle_trigger` before creating starter templates.
- Wrong-file duplicate comments do not cause edits to `model/recall_campaign.go`, `model/redemption.go`, or `service/billing_session.go` unless a real issue is independently present there.

## Architecture

### 1. Transaction and state-machine boundaries

Every operation that changes money, entitlement, campaign status, or event disposition must have one database winner.

- DataTool terminal operations lock the `data_tool_calls` row before user/token quota mutation, re-check `pending`, and use a status-qualified final update. A losing retry observes the stored terminal state and performs no financial side effects.
- Continuous campaign transitions update/lock the campaign before claiming or releasing its trigger slot. A slot conflict returns an error so the transaction rolls back the campaign transition and audit event.
- Subscription success validates the entitlement scope after the winner hook but before emitting the success event or committing the status update. The entire transaction rolls back when the scope is missing.
- Historical compensation and provider-binding repair use idempotent create/load or rotate-by-grant-key operations rather than treating `applied=false` as success.

### 2. Lifecycle delivery safety

The full lifecycle eligibility check runs immediately before SMTP reservation but outside the transaction that locks `recall_recipients`. The reservation transaction performs only bounded recipient/message/lease checks and state transitions. This removes a service-layer callback that scans and locks payment/quota tables while the recipient lock is held. The unavoidable interval between database eligibility and external SMTP delivery is no larger in semantic strength than the existing post-commit SMTP interval.

If a worker has already leased an event and the trigger campaign is no longer available, it clears the lease and records a retryable `deferred` disposition with a stable reason. This preserves the event for a later replacement/resumed campaign without leaving an orphaned lease.

MySQL lifecycle insertion uses a normal insert and recognizes only MySQL duplicate-key error 1062 as an idempotent duplicate. Other constraint, truncation, and default errors are returned. SQLite and PostgreSQL retain targeted conflict handling.

### 3. Preview and editor canonicalization

The lifecycle trigger is the source of truth for delivery policy. Backend preview rejects an explicit conflicting policy and fills an omitted policy. Frontend async preview snapshots include both values, so a stale response cannot replace a preview after either field changes.

Continuous canonicalization exists at the API boundary as a final invariant, even when callers bypass editor submit helpers. Leaving Continuous mode creates a valid promotion draft with non-empty audience, coupon, and expiry defaults. Plain-text and HTML template inputs pass through the same action-variable allowlist. Missing English content fails early with a stable client validation message.

### 4. Observability and compatibility

Continuous activation inserts a deterministic `campaign_activated` administrator event in the same transaction as campaign transition and slot claim. Draft/paused Continuous metrics may return no lifecycle section when collection has not started; a running campaign with a missing or malformed marker remains an operational error.

Waffo/Pancake transition failures are logged with `trade_no` and returned as a distinct state-update failure. Top-up terminal timestamps become consistent across success and non-success terminal states.

## Error handling

- Transactional invariant failures return errors and roll back all state and accounting mutations.
- Duplicate lifecycle occurrences return `(inserted=false, nil)` only for the exact occurrence uniqueness conflict.
- Underflow checks use `WHERE used_quota >= ?` and require one affected row; zero rows is an invariant error and rolls back the refund.
- Retryable lifecycle campaign unavailability clears ownership and defers the event; malformed data remains terminally skipped.
- Explicit preview policy/trigger conflicts return a stable validation error rather than silently rendering a different message contract.

## Testing strategy

Each production change follows red-green-refactor:

- MySQL error-classification and SQL-shape tests distinguish duplicate 1062 from other MySQL failures.
- Lifecycle tests cover claimed-event pause/cancel convergence, one lock order, activation audit insertion, marker degradation, and gate execution outside the recipient lock.
- Subscription tests cover missing-scope rollback, binding repair, historical compensation replay, Waffo transition failure, terminal timestamps, and fallback notification dispatch.
- DataTool concurrency tests cover fail-vs-fail and fail-vs-settle with exact final wallet/token and `used_quota` values.
- Frontend tests cover preview policy/trigger races, Continuous exit, plain-text forbidden actions, direct API encoding, and missing English stage validation.

Focused tests run after each task. Final verification includes the lifecycle-focused Go suites, router tests, Go vet, all Recall frontend tests, typecheck, i18n sync, production build, and `git diff --check`.

## Rollout and deployment

No new external service or configuration is introduced. Database behavior and shared quota/subscription paths change, so both `newapi-console` and router nodes must deploy from one compatible revision after staging validation. The existing schema-first lifecycle rollout guide remains authoritative.

## Review response contract

After fixes are pushed, the top-level PR response will quote/link the original aggregated comment, map every numbered finding to a fix commit or a reasoned non-applicability result, include validation evidence, and explicitly identify the pre-existing issues that were fixed as part of the hardening pass.
