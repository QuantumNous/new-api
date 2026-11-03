# Partner Tenant API

For the merchant-facing integration walkthrough, request examples, and operational checklist, see the [Simplified Chinese integration guide](./partner-tenant-integration.zh-CN.md).

This API is for a partner's server. It uses one server secret to manage only that partner's provisioned accounts, subscriptions, and dedicated model group. The partner authenticates its own end users and collects payment itself; this API activates or renews a New API subscription after the partner confirms payment. It does not top up the New API wallet.

The tenant secret is separate from Partner OAuth client credentials. Do not send it from a browser, mobile app, desktop client, or customer. Send it only over HTTPS from the partner backend:

```http
Authorization: Bearer pt_<server-secret>
```

All partner endpoints are under `/api/partner/v1`, return `Cache-Control: no-store`, and use the standard integration error body:

```json
{"error":{"code":"account_not_found","message":"account not found"},"request_id":"..."}
```

The partner-facing API accepts `external_user_id`, never a New API numeric user ID. Account and plan lookups always include the authenticated tenant ID. A guessed or foreign account/plan ID does not cross the tenant boundary.

Account provisioning and plan activation require `external_user_id` to contain 1–128 Unicode characters after trimming surrounding whitespace. Chinese characters and emoji are supported; control characters and longer IDs are rejected with `400 invalid_request`. The limit is measured in Unicode code points, not UTF-8 bytes.

## Provision An Account

```http
PUT /api/partner/v1/accounts
Content-Type: application/json
Authorization: Bearer pt_<server-secret>
```

```json
{"external_user_id":"customer-7","display_name":"Customer 7"}
```

The first request creates a non-login New API account with zero wallet quota and issues a model API key fixed to the partner's dedicated group. The response contains the partner's external ID and API key, not the internal user ID:

```json
{"external_user_id":"customer-7","api_key":"sk-...","created":true}
```

Repeated requests return the same key and do not create another account or key. If the associated key was disabled or deleted, the endpoint fails closed with `credential_unavailable` rather than minting another key.

## List Plans

```http
GET /api/partner/v1/plans
Authorization: Bearer pt_<server-secret>
```

Only enabled plans owned by the authenticated partner are returned. Platform plans and another partner's plans are never included. Plans are fixed to a one-month term, monthly quota reset, the tenant's dedicated group, and no wallet fallback. `price_amount` is a reference price; the partner collects payment outside this platform.

`total_amount: 0` means unlimited subscription quota. `requests_per_minute` is the plan's per-account request limit; `0` disables the plan-specific limit. Existing system and group limits still apply.

## Activate Or Renew A Plan

The partner calls this only after it has confirmed the customer's payment:

```http
POST /api/partner/v1/accounts/customer-7/subscriptions
Authorization: Bearer pt_<server-secret>
Content-Type: application/json
Idempotency-Key: <16-64 URL-safe characters>
```

```json
{"plan_id":42}
```

The plan must belong to this partner and the account must be provisioned by this partner. New activation returns `201`. A renewal with a new idempotency key extends the same active subscription by one month and returns `200`; monthly quota resets continue at the plan's calendar-month boundary. Retrying the same key and request does not create or extend a subscription again; it returns `200`, `created: false`, and the current subscription state, not an immutable snapshot of the original response. Later renewals or usage can therefore change the returned end time or used quota. Reusing a key with a different account or plan returns `409 idempotency_conflict`. Persist one key per merchant order and reuse it after timeouts; a new key represents a new operation and can renew the subscription again.

Relevant errors include `account_not_found`, `plan_not_found`, `invalid_request`, and `idempotency_conflict`. Plan/account misses intentionally do not reveal foreign resource existence.

## Query Subscription Quota

```http
GET /api/partner/v1/accounts/customer-7/subscription/quota
Authorization: Bearer pt_<server-secret>
```

The response includes only active subscriptions owned by this partner, with total quota, used quota, remaining quota, start/end time, status, and next monthly reset. It excludes wallet balance, platform subscriptions, and subscriptions belonging to other partners.

For unlimited subscriptions `quota_unlimited` is `true`, and `quota_total` and `quota_remaining` are both `0`; clients must check the flag instead of interpreting the remaining value as exhausted. The activation response also includes `quota_unlimited`.

## Tenant Administration

Root administrators create a tenant by assigning an unused real model group. The server secret is shown once and stored as a hash. Rotating it immediately invalidates the old secret. Disabling a tenant stops its server secret from managing accounts. Already-issued customer model keys remain enabled; subscription quota is unavailable after active plans expire, and model keys are not automatically revoked.

Partner subscription plans are created in the subscription plan editor by selecting a tenant. The backend enforces the tenant's group and monthly quota rules even if a client submits different values. Partner plans are excluded from the platform-wide user catalog and cannot be purchased through New API's wallet, Epay, Stripe, Creem, Waffo, or Pancake routes.

When an account has several active partner plans applicable to the request group, the highest configured nonzero request limit applies; limits are not added. The per-account limit counts all model request attempts over a rolling 60-second window and returns HTTP 429 when reached. Renewal extends the term without increasing the rate. Each request is also subject to the existing system or group limiter. Changes to a plan's rate affect existing subscriptions immediately. Multi-node deployments must use the same Redis instance for shared enforcement; otherwise the in-memory limit is independent per node.

Partner-account membership is cached locally for one minute in a bounded cache, including non-members. Ordinary users need only an indexed membership lookup on a cache miss and no subscription or clock queries. Provisioning publishes membership after its transaction commits. Plan rates and subscription validity are always read from the database, so rate edits, cancellations, and expiry are not delayed by the membership cache.
