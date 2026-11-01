# Partner unlimited plans and per-user rate limits

## Goal
Allow partner plans to offer unlimited quota with per-account request-rate limits.

## Requirements
- Partner plans accept zero total quota as unlimited; active plans still expire normally.
- Set requests per minute on a plan, independently of the global/group limiter.
- Count requests separately per user and applicable group. Use the highest limit of eligible active partner plans, never add limits for renewals or multiple plans.
- Existing global/group rate limiting remains in force. Redis must perform atomic shared counting; memory counting is per instance.
- Quota responses explicitly distinguish unlimited quota from exhausted quota.
- Existing plans without a configured plan rate limit retain their previous behavior.

## Acceptance Criteria
- [x] Unlimited partner plan activation, consumption, and quota reporting work; creation uses the same zero-quota validation.
- [x] Multiple active plans, expiration, users and group isolation are covered by tests.
- [x] Plan limits and existing limits both apply; concurrent Redis requests cannot exceed the configured limit.
- [x] Admin UI persists the plan rate and translations cover all supported locales.

## Out of Scope
Token-per-minute and concurrent request limits; deployment changes.
