# Agent Points and Package Redemption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe agent-points flow in which administrators fund agents, agents buy existing subscription plans as package redemption codes, users redeem those codes into subscriptions, and unused unexpired codes can be refunded.

**Architecture:** `SubscriptionPlan` remains the only plan catalog. New agent account, immutable credit ledger, agent offer, and purchase-order models own the commercial workflow; `Redemption` gains a zero-compatible package-code type. Money-changing behavior lives in service-layer transactions with optimistic account versions and idempotency keys, while subscription delivery reuses a versioned entitlement snapshot and the current subscription activation logic.

**Tech Stack:** Go 1.25.1 module, Gin, GORM v2, SQLite/MySQL/PostgreSQL, testify, React 19, TypeScript, TanStack Query/Router/Table, Base UI, Tailwind CSS, Zod, Bun, i18next.

## Global Constraints

- `1 point = 1 CNY`; storage unit is `0.01` point in signed `int64`, and public agent-money JSON values are fixed two-decimal strings.
- Agent balance MUST never become negative; purchase/refund/admin adjustment MUST be atomic, idempotent, overflow-checked, and accompanied by immutable ledger rows.
- Existing `SubscriptionPlan` and `UserSubscription` remain the only entitlement catalog and instance models; MUST NOT add the source repository's duplicate `Package` model.
- Existing quota redemption codes and `POST /api/user/topup` response behavior MUST remain compatible.
- Existing `Redemption` rows use zero-value `type = 0`; package codes use `type = 1` and MUST NOT be edited or deleted by existing quota-code administration paths.
- Purchases are limited to `1..100` codes per request and default to 200 codes per agent per application-local calendar day.
- One `AgentPlanOffer` exists per subscription plan; first release has no per-agent price overrides.
- Only unused and unexpired package codes are refundable; price, fee, validity, and entitlement come from immutable purchase snapshots.
- Agent mutations require an active account; already-sold codes remain redeemable after agent/offer/plan disablement.
- Agent reads use `UserAuth` plus ownership checks; management reads use `AdminAuth`; agent/offer/credit mutations use `RootAuth`.
- Backend MUST support SQLite, MySQL >= 5.7.8, and PostgreSQL >= 9.6 without database-specific JSON types, lock-only correctness, or incompatible DDL.
- JSON marshal/unmarshal MUST use `common.Marshal`, `common.Unmarshal`, `common.UnmarshalJsonStr`, or `common.DecodeJson`.
- New or substantially rewritten Go tests MUST use `testify/require` and `testify/assert` and protect observable contracts.
- Default frontend only: MUST NOT modify `web/classic`.
- Frontend commands MUST use Bun; user-visible text MUST use i18next and all configured locale files.
- Protected `new-api` and `QuantumNous` identity and attribution MUST remain unchanged.
- Existing unrelated workspace files, including untracked CSV files, MUST remain untouched.
- No source-repository data migration and no agent online point purchase are included; all new tables start empty and points come only from root adjustments.

---

### Task 1: Point money primitives, agent persistence, and migrations

**Files:**
- Create: `service/agent_money.go`
- Create: `service/agent_money_test.go`
- Create: `model/agent_account.go`
- Create: `model/agent_offer.go`
- Create: `model/agent_order.go`
- Create: `model/agent_refund.go`
- Create: `model/agent_model_test.go`
- Modify: `common/constants.go`
- Modify: `model/redemption.go`
- Modify: `model/main.go`

**Interfaces:**
- Produces `ParseAgentPoints(string) (int64, error)`, `FormatAgentPoints(int64) string`, `AgentPurchaseTotal(int64, int) (int64, error)`, and `AgentRefundAmount(int64, int) (fee int64, refund int64, err error)`.
- Produces `model.AgentAccount`, `model.AgentCreditLog`, `model.AgentPlanOffer`, `model.AgentPurchaseOrder`, `model.AgentRefundRequest`, and package-code fields on `model.Redemption`.
- Produces `common.RedemptionCodeTypeQuota`, `common.RedemptionCodeTypeSubscription`, and `common.RedemptionCodeStatusRefunded`.

- [ ] **Step 1: Write failing point-math tests**

```go
func TestParseAgentPoints(t *testing.T) {
	for input, want := range map[string]int64{"0.01": 1, "1": 100, "1000.00": 100000} {
		got, err := ParseAgentPoints(input)
		require.NoError(t, err)
		assert.Equal(t, want, got)
	}
	for _, input := range []string{"", "-1", "+1", "1.001", "abc", "92233720368547758.08"} {
		_, err := ParseAgentPoints(input)
		assert.Error(t, err, input)
	}
}

func TestAgentRefundAmount(t *testing.T) {
	fee, refund, err := AgentRefundAmount(6000, 500)
	require.NoError(t, err)
	assert.Equal(t, int64(300), fee)
	assert.Equal(t, int64(5700), refund)
}
```

- [ ] **Step 2: Run and verify RED**

Run: `go test ./service -run 'TestParseAgentPoints|TestFormatAgentPoints|TestAgentPurchaseTotal|TestAgentRefundAmount' -count=1`

Expected: FAIL because the functions do not exist.

- [ ] **Step 3: Implement integer money primitives**

Parse decimal strings without `float64`; reject signs, more than two decimals, and overflow. Use checked arithmetic. `AgentRefundAmount` accepts `feeBps` only in `0..10000`, rounds half away from zero to the nearest minor unit, and rejects negative inputs.

```go
func ParseAgentPoints(value string) (int64, error)
func FormatAgentPoints(value int64) string
func AgentPurchaseTotal(unitPrice int64, quantity int) (int64, error)
func AgentRefundAmount(unitPrice int64, feeBps int) (fee int64, refund int64, err error)
```

- [ ] **Step 4: Write failing persistence tests**

Auto-migrate the new models plus `Redemption`, create one row of each, and assert duplicate `AgentAccount.UserId`, `AgentPlanOffer.PlanId`, `AgentPurchaseOrder.OrderNo`, purchase `(AgentUserId, IdempotencyKey)`, refund-request `(AgentUserId, IdempotencyKey)`, and ledger `(EventType, BusinessKey)` fail. Assert a legacy redemption reads as quota type zero.

- [ ] **Step 5: Run model tests and verify RED**

Run: `go test ./model -run TestAgentModels -count=1`

Expected: FAIL because models and fields do not exist.

- [ ] **Step 6: Add models and migrations**

Use statuses `active/disabled`, orders `completed/partially_refunded/refunded`, and ledger events `admin_credit/admin_debit/purchase/refund`. `AgentRefundRequest` stores agent, idempotency key, a canonical request hash, code-ID snapshot, fee/refund totals, and resulting balance so a repeated batch request can return the original result. Use `int64` timestamps, code-level defaults 200/365, `TEXT` entitlement/code-ID snapshots, and no boolean default tag. Add all models to normal and fast migrations. Add `Type`, `AgentUserId`, `AgentOrderId`, and `SubscriptionPlanId` to `Redemption`; zero remains quota and refunded status follows existing status values.

- [ ] **Step 7: Verify Task 1**

Run: `gofmt -w service/agent_money.go service/agent_money_test.go model/agent_account.go model/agent_offer.go model/agent_order.go model/agent_refund.go model/agent_model_test.go common/constants.go model/redemption.go model/main.go`

Run: `go test ./service ./model -run 'TestAgent|TestParseAgentPoints|TestFormatAgentPoints' -count=1`

Expected: PASS.

- [ ] **Step 8: Commit Task 1**

```bash
git add common/constants.go model/main.go model/redemption.go model/agent_account.go model/agent_offer.go model/agent_order.go model/agent_refund.go model/agent_model_test.go service/agent_money.go service/agent_money_test.go
git commit -m "feat: add agent points persistence"
```

### Task 2: Versioned subscription entitlement snapshots

**Files:**
- Modify: `model/subscription.go`
- Create: `model/subscription_entitlement_test.go`

**Interfaces:**
- Produces `BuildSubscriptionEntitlementSnapshot(*SubscriptionPlan) (SubscriptionEntitlementSnapshot, error)`.
- Produces `EncodeSubscriptionEntitlementSnapshot(SubscriptionEntitlementSnapshot) (string, error)` and `DecodeSubscriptionEntitlementSnapshot(string) (SubscriptionEntitlementSnapshot, error)`.
- Produces `CreateUserSubscriptionFromEntitlementTx(*gorm.DB, int, SubscriptionEntitlementSnapshot, string) (*UserSubscription, error)`.

- [ ] **Step 1: Write failing snapshot/delivery tests**

Assert exact version-1 round trip, normalized `AllowWalletOverflow`, unknown-version rejection, and delivery from a snapshot after the plan is modified. Create a real user and transaction and assert amount, duration/reset, source, wallet overflow, purchase limit, and user-group snapshots.

```go
snapshot, err := BuildSubscriptionEntitlementSnapshot(plan)
require.NoError(t, err)
raw, err := EncodeSubscriptionEntitlementSnapshot(snapshot)
require.NoError(t, err)
plan.DurationValue, plan.TotalAmount = 12, 1
decoded, err := DecodeSubscriptionEntitlementSnapshot(raw)
require.NoError(t, err)
assert.Equal(t, 1, decoded.DurationValue)
assert.Equal(t, int64(5000), decoded.TotalAmount)
```

- [ ] **Step 2: Run and verify RED**

Run: `go test ./model -run TestSubscriptionEntitlement -count=1`

Expected: FAIL because snapshot functions do not exist.

- [ ] **Step 3: Implement snapshot and shared activation**

The stable DTO contains version, plan ID/title, duration, max purchases, group changes, quota/reset, and normalized wallet overflow. Refactor the existing entry point:

```go
func CreateUserSubscriptionFromPlanTx(tx *gorm.DB, userId int, plan *SubscriptionPlan, source string) (*UserSubscription, error) {
	snapshot, err := BuildSubscriptionEntitlementSnapshot(plan)
	if err != nil {
		return nil, err
	}
	return CreateUserSubscriptionFromEntitlementTx(tx, userId, snapshot, source)
}
```

Preserve current subscription behavior and use only `common.*` JSON wrappers.

- [ ] **Step 4: Verify Task 2**

Run: `gofmt -w model/subscription.go model/subscription_entitlement_test.go`

Run: `go test ./model -run 'TestSubscriptionEntitlement|TestAdminReset|TestCompleteSubscriptionOrder|TestPurchaseSubscription' -count=1`

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add model/subscription.go model/subscription_entitlement_test.go
git commit -m "feat: snapshot subscription entitlements"
```

### Task 3: Feature setting, agent lifecycle, and credit ledger

**Files:**
- Create: `setting/operation_setting/agent_setting.go`
- Create: `setting/operation_setting/agent_setting_test.go`
- Create: `dto/agent.go`
- Create: `service/agent_account.go`
- Create: `service/agent_account_test.go`
- Create: `controller/agent_admin.go`
- Modify: `controller/audit.go`
- Modify: `controller/misc.go`
- Modify: `router/api-router.go`

**Interfaces:**
- Produces `operation_setting.GetAgentSetting() *AgentSetting`, `EnableAgent`, `DisableAgent`, `UpdateAgentDailyLimit`, `AdjustAgentCredit`, `GetAgentAccount`, and agent/ledger queries.

- [ ] **Step 1: Write failing setting/account tests**

Cover default-disabled setting, enable with default limit 200, idempotent re-enable, disable without deleting balance, exact credit/debit before/after, insufficient-balance rollback, mandatory reason, duplicate idempotency, and stale-version retry.

```go
result, err := AdjustAgentCredit(AgentCreditAdjustment{
	AgentUserID: 10, OperatorUserID: 1, Amount: 100000,
	Direction: "credit", Reason: "offline payment", IdempotencyKey: "credit-1",
})
require.NoError(t, err)
assert.Equal(t, int64(100000), result.Account.Balance)
assert.Equal(t, int64(0), result.Log.BalanceBefore)
assert.Equal(t, int64(100000), result.Log.BalanceAfter)
```

- [ ] **Step 2: Run and verify RED**

Run: `go test ./setting/operation_setting ./service -run 'TestAgentSetting|TestEnableAgent|TestAdjustAgentCredit' -count=1`

Expected: FAIL because setting/service do not exist.

- [ ] **Step 3: Implement setting and optimistic mutations**

Register `AgentSetting{Enabled bool}` under `agent_setting`. Read account `Version`, validate proposed balance/count, and update with `WHERE id = ? AND version = ?`; retry at most three times only for conflicts. Every mutation and ledger row share one transaction. Do not expose a general balance setter.

- [ ] **Step 4: Add DTOs, controller, routes, status, and audit**

Register admin reads and root mutations:

```text
GET /api/agent-admin/agents
GET /api/agent-admin/agents/:user_id/credit-logs
POST /api/agent-admin/agents/:user_id/enable
POST /api/agent-admin/agents/:user_id/disable
PATCH /api/agent-admin/agents/:user_id/limit
POST /api/agent-admin/agents/:user_id/credit-adjustments
```

Add `agent_enabled` to `/api/status`. Add audit actions `agent.enable`, `agent.disable`, `agent.limit_update`, `agent.credit`, and `agent.debit`.

- [ ] **Step 5: Verify Task 3**

Run: `gofmt -w setting/operation_setting/agent_setting.go setting/operation_setting/agent_setting_test.go dto/agent.go service/agent_account.go service/agent_account_test.go controller/agent_admin.go controller/audit.go controller/misc.go router/api-router.go`

Run: `go test ./setting/operation_setting ./service ./controller ./router -run 'TestAgent|TestAdjustAgentCredit' -count=1`

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add setting/operation_setting/agent_setting.go setting/operation_setting/agent_setting_test.go dto/agent.go service/agent_account.go service/agent_account_test.go controller/agent_admin.go controller/audit.go controller/misc.go router/api-router.go
git commit -m "feat: manage agent credit accounts"
```

### Task 4: Agent offer administration

**Files:**
- Create: `service/agent_offer.go`
- Create: `service/agent_offer_test.go`
- Modify: `dto/agent.go`
- Modify: `controller/agent_admin.go`
- Modify: `controller/audit.go`
- Modify: `router/api-router.go`

**Interfaces:**
- Produces `UpsertAgentPlanOffer(AgentPlanOfferInput) (*model.AgentPlanOffer, error)` and `ListAgentPlanOffers() ([]AgentPlanOfferRecord, error)`.
- Produces `GET /api/agent-admin/offers` and `PUT /api/agent-admin/offers/:plan_id`.

- [ ] **Step 1: Write failing offer tests**

Reject missing plans, zero/negative price, validity outside `1..3650`, fee outside `0..10000`, and duplicate plan rows. Updating must preserve one row. Disabling must not modify orders/codes.

- [ ] **Step 2: Run and verify RED**

Run: `go test ./service -run TestAgentPlanOffer -count=1`

Expected: FAIL because offer service does not exist.

- [ ] **Step 3: Implement service and API**

The controller accepts `unit_price` as a decimal string and returns formatted price plus current plan. Standardize omitted validity to 365 but never default a missing/zero price. Read uses `AdminAuth`, mutation uses `RootAuth`, and `agent.offer_update` audit records plan, enabled state, price, validity, and fee basis points.

- [ ] **Step 4: Verify and commit Task 4**

Run: `gofmt -w service/agent_offer.go service/agent_offer_test.go dto/agent.go controller/agent_admin.go controller/audit.go router/api-router.go`

Run: `go test ./service ./controller ./router -run TestAgentPlanOffer -count=1`

Expected: PASS.

```bash
git add service/agent_offer.go service/agent_offer_test.go dto/agent.go controller/agent_admin.go controller/audit.go router/api-router.go
git commit -m "feat: configure agent plan offers"
```

### Task 5: Atomic package-code purchasing

**Files:**
- Create: `service/agent_purchase.go`
- Create: `service/agent_purchase_test.go`
- Create: `controller/agent.go`
- Modify: `dto/agent.go`
- Modify: `router/api-router.go`

**Interfaces:**
- Consumes account optimistic mutation, point math, entitlement snapshot helpers, active `AgentPlanOffer`, `common.GetUUID`, and package-code fields.
- Produces `PurchaseAgentCodes(AgentPurchaseInput) (*AgentPurchaseResult, error)`, `GetAgentOverview(int)`, and `ListPurchasableAgentOffers(int)`.

- [ ] **Step 1: Write failing purchase tests**

Use real SQLite records to assert 1000 points minus ten 60-point codes leaves 400 points; one order, ten unique codes, and one `-600.00` ledger row are committed. Assert snapshot contents, quantity 0/101 rejection, disabled agent/offer, missing plan, insufficient balance, daily limit, duplicate idempotency, later plan/offer edits, and deterministic concurrent purchases that cannot overspend or exceed the limit.

```go
result, err := PurchaseAgentCodes(AgentPurchaseInput{
	AgentUserID: 20, PlanID: plan.Id, Quantity: 10, IdempotencyKey: "buy-1",
})
require.NoError(t, err)
assert.Equal(t, int64(40000), result.BalanceAfter)
assert.Len(t, result.Codes, 10)
```

- [ ] **Step 2: Run and verify RED**

Run: `go test ./service -run TestPurchaseAgentCodes -count=1`

Expected: FAIL because purchase service does not exist.

- [ ] **Step 3: Implement the purchase transaction**

In one transaction: resolve idempotency; read active account/offer/plan; calculate checked total; build snapshot; compute application-local date; update balance, daily date/count, and version; create order; create `quantity` package redemptions expiring at `now + valid_days`; create one purchase ledger row. Retry only version/unique races. Never trust client price, total, expiry, fee, title, or snapshot.

- [ ] **Step 4: Add overview/offers/purchase API**

Register with `UserAuth`, service-level active-agent check, agent feature flag, and `CriticalRateLimit` on purchase:

```text
GET /api/agent/overview
GET /api/agent/offers
POST /api/agent/orders
```

Return fixed-decimal strings and `next_daily_reset_at`.

- [ ] **Step 5: Verify and commit Task 5**

Run: `gofmt -w service/agent_purchase.go service/agent_purchase_test.go controller/agent.go dto/agent.go router/api-router.go`

Run: `go test ./service ./controller ./router -run 'TestPurchaseAgentCodes|TestAgentOverview' -count=1`

Expected: PASS.

```bash
git add service/agent_purchase.go service/agent_purchase_test.go controller/agent.go dto/agent.go router/api-router.go
git commit -m "feat: let agents purchase package codes"
```

### Task 6: Orders, inventory, ledger queries, and CSV export

**Files:**
- Create: `service/agent_query.go`
- Create: `service/agent_query_test.go`
- Modify: `controller/agent.go`
- Modify: `controller/agent_admin.go`
- Modify: `router/api-router.go`

**Interfaces:**
- Produces ownership-scoped `ListAgentOrders`, `ListAgentCodes`, `ListAgentCreditLogs`, admin equivalents, and `ExportAgentCodes(io.Writer, AgentCodeQuery) error`.

- [ ] **Step 1: Write failing query/export tests**

Seed two agents and prove one cannot retrieve/export the other's data. Assert unused/used/refunded/dynamically-expired states, unpaged totals, admin filters, stable CSV columns (`code`, `plan`, `order_no`, `status`, `created_at`, `expired_at`, `redeemed_at`), UTF-8, maximum export bound, and formula escaping for cells starting `=`, `+`, `-`, or `@`.

- [ ] **Step 2: Run and verify RED**

Run: `go test ./service -run 'TestListAgent|TestExportAgentCodes' -count=1`

Expected: FAIL because query/export functions do not exist.

- [ ] **Step 3: Implement bounded queries and export**

Cap normal pages at 100. Force ownership from authenticated user ID, derive expired display state without mutating rows, and stream `encoding/csv` output. Disabled agents may read history but may not export fresh code material.

- [ ] **Step 4: Register query APIs**

```text
GET /api/agent/orders
GET /api/agent/codes
GET /api/agent/codes/export
GET /api/agent/credit-logs
GET /api/agent-admin/orders
GET /api/agent-admin/codes
```

- [ ] **Step 5: Verify and commit Task 6**

Run: `gofmt -w service/agent_query.go service/agent_query_test.go controller/agent.go controller/agent_admin.go router/api-router.go`

Run: `go test ./service ./controller ./router -run 'TestListAgent|TestExportAgentCodes' -count=1`

Expected: PASS.

```bash
git add service/agent_query.go service/agent_query_test.go controller/agent.go controller/agent_admin.go router/api-router.go
git commit -m "feat: expose agent orders and inventory"
```

### Task 7: Unified quota/package redemption without breaking top-up clients

**Files:**
- Create: `service/redemption.go`
- Create: `service/redemption_test.go`
- Modify: `model/redemption.go`
- Modify: `model/redemption_test.go`
- Modify: `controller/user.go`
- Modify: `router/api-router.go`

**Interfaces:**
- Produces `RedeemCode(userID int, key string) (*RedemptionResult, error)`.
- Keeps `model.Redeem(key, userID) (int, error)` and `POST /api/user/topup` unchanged.
- Produces `POST /api/user/redeem` with a typed result.

- [ ] **Step 1: Write failing compatibility/delivery tests**

Assert quota redemption still credits exactly once. Package tests assert one subscription with source `agent_redemption`, snapshot benefits after plan edits, atomic code/subscription state, expired/refunded/used/invalid snapshot rejection, concurrent single success, and quota admin list/search/update/delete/cleanup excluding package codes.

- [ ] **Step 2: Run and verify RED**

Run: `go test ./service ./model -run 'TestRedeemCode|TestQuotaRedemptionAdminPathsExcludePackageCodes' -count=1`

Expected: FAIL because unified redemption and type filtering do not exist.

- [ ] **Step 3: Implement typed dispatch and package transaction**

Quota dispatch calls existing behavior. Package dispatch conditionally updates enabled→used with expiry/type predicate, loads order, decodes snapshot, creates subscription, and commits in one transaction. Refresh group cache/log after commit. Existing quota administration queries/mutations require `type = quota`; generic cleanup must never select package codes.

- [ ] **Step 4: Add unified controller**

`POST /api/user/redeem` returns either `{"type":"quota","quota":500}` or `{"type":"subscription","subscription_id":88,"plan_title":"Pro","end_time":1790000000}`. All invalid states return the same localized failure. Do not log raw keys.

- [ ] **Step 5: Verify and commit Task 7**

Run: `gofmt -w service/redemption.go service/redemption_test.go model/redemption.go model/redemption_test.go controller/user.go router/api-router.go`

Run: `go test ./model ./service ./controller ./router -run 'TestRedeem|TestQuotaRedemptionAdminPaths' -count=1`

Expected: PASS.

```bash
git add service/redemption.go service/redemption_test.go model/redemption.go model/redemption_test.go controller/user.go router/api-router.go
git commit -m "feat: redeem agent package codes"
```

### Task 8: Atomic refunds and reconciliation

**Files:**
- Create: `service/agent_refund.go`
- Create: `service/agent_refund_test.go`
- Modify: `service/agent_query.go`
- Modify: `controller/agent.go`
- Modify: `controller/agent_admin.go`
- Modify: `controller/audit.go`
- Modify: `router/api-router.go`

**Interfaces:**
- Produces `RefundAgentCodes(AgentRefundInput) (*AgentRefundResult, error)` and `ReconcileAgentAccount(int) (*AgentReconciliation, error)`.

- [ ] **Step 1: Write failing refund/reconciliation tests**

Cover one/multiple codes across orders, exact 5% fee, sequential ledger balances, order refund aggregates/status, duplicate idempotency/code IDs, ownership, expired/used/refunded rejection, disabled self-refund, root special refund, and all-or-nothing rollback. Reconciliation asserts `sum(delta) == balance` and reports mismatch without repair.

```go
result, err := RefundAgentCodes(AgentRefundInput{
	AgentUserID: 20, RedemptionIDs: []int{code.Id},
	IdempotencyKey: "refund-1", RequestedBy: 20,
})
require.NoError(t, err)
assert.Equal(t, int64(300), result.Fee)
assert.Equal(t, int64(5700), result.Refunded)
```

- [ ] **Step 2: Run and verify RED**

Run: `go test ./service -run 'TestRefundAgentCodes|TestReconcileAgentAccount' -count=1`

Expected: FAIL because refund/reconciliation do not exist.

- [ ] **Step 3: Implement refund/reconciliation**

Validate at most 100 unique IDs, sort them, and hash the canonical list. Resolve `(agent, idempotency_key)` first: the same hash returns the stored refund result, while a different hash is rejected. In one transaction create `AgentRefundRequest`, load owned package codes/orders, validate unused/unexpired, calculate snapshots, conditionally update all codes enabled→refunded, optimistically add balance, update order aggregates/status, and create one ledger row per code with business key `refund:<redemption_id>`. Persist totals/balance on the refund request before commit. Self-refund requires active agent; root reuses rules for disabled agents. Reconciliation is read-only.

- [ ] **Step 4: Register APIs and audit**

```text
POST /api/agent/codes/refund
POST /api/agent-admin/codes/refund
GET /api/agent-admin/agents/:user_id/reconciliation
```

Root refund audit includes target agent, code IDs, formatted fee/refund, and idempotency key.

- [ ] **Step 5: Verify and commit Task 8**

Run: `gofmt -w service/agent_refund.go service/agent_refund_test.go service/agent_query.go controller/agent.go controller/agent_admin.go controller/audit.go router/api-router.go`

Run: `go test ./model ./service ./controller ./router ./setting/... -count=1`

Run: `go test ./... -count=1`

Expected: PASS.

```bash
git add service/agent_refund.go service/agent_refund_test.go service/agent_query.go controller/agent.go controller/agent_admin.go controller/audit.go router/api-router.go
git commit -m "feat: refund agent package codes"
```

### Task 9: Default frontend data contracts and pure formatting

**Required sub-skills:** `shadcn-ui`, `vercel-react-best-practices`.

**Files:**
- Create: `web/default/src/features/agents/types.ts`
- Create: `web/default/src/features/agents/api.ts`
- Create: `web/default/src/features/agents/lib/money.ts`
- Create: `web/default/src/features/agents/lib/money.test.ts`
- Create: `web/default/src/features/agents/hooks/use-agent-access.ts`
- Modify: `web/default/src/features/auth/types.ts`

**Interfaces:**
- Produces Zod contracts, agent/admin API functions, exact string-money presentation, and lazy `useAgentAccess()`.

- [ ] **Step 1: Write failing pure tests**

```ts
test('formats point strings without losing cents', () => {
  assert.equal(formatAgentPoints('1000.00'), '1,000.00')
  assert.equal(formatAgentPoints('0.01'), '0.01')
})
```

Also test status derivation for dynamically expired codes.

- [ ] **Step 2: Run and verify RED**

Run from `web/default`: `bun test src/features/agents/lib/money.test.ts`

Expected: FAIL because helpers do not exist.

- [ ] **Step 3: Implement schemas/APIs/helpers/access**

Schemas cover overview, offer, order, code, ledger, admin agent, reconciliation, pagination, purchase/refund/credit responses, and typed redemption. Money remains strings. `useAgentAccess` runs only when authenticated and global `agent_enabled` is true, treats 403 as no access, and caches briefly. Add `agent_enabled?: boolean` to both `SystemStatus` shapes.

- [ ] **Step 4: Verify and commit Task 9**

Run from `web/default`: `bun test src/features/agents/lib/money.test.ts`

Run from `web/default`: `bun run typecheck`

Run from `web/default`: `bun run lint`

Expected: PASS.

```bash
git add web/default/src/features/agents web/default/src/features/auth/types.ts
git commit -m "feat(default): add agent data contracts"
```

### Task 10: Default agent workspace

**Required sub-skills:** `shadcn-ui`, `vercel-react-best-practices`.

**Files:**
- Create: `web/default/src/features/agents/index.tsx`
- Create: `web/default/src/features/agents/components/agent-overview.tsx`
- Create: `web/default/src/features/agents/components/agent-offers.tsx`
- Create: `web/default/src/features/agents/components/purchase-dialog.tsx`
- Create: `web/default/src/features/agents/components/agent-orders-table.tsx`
- Create: `web/default/src/features/agents/components/agent-codes-table.tsx`
- Create: `web/default/src/features/agents/components/agent-credit-logs-table.tsx`
- Create: `web/default/src/features/agents/components/refund-dialog.tsx`
- Create: `web/default/src/routes/_authenticated/agent/index.tsx`
- Modify: `web/default/src/hooks/use-sidebar-data.ts`
- Modify: `web/default/src/hooks/use-sidebar-config.ts`
- Generated: `web/default/src/routeTree.gen.ts`

**Interfaces:**
- Consumes Task 9 contracts/APIs/access.
- Produces `/agent` overview, purchase, orders, inventory, refund, export, and ledger.

- [ ] **Step 1: Add guarded route/navigation**

The route `beforeLoad` checks authentication only. Its `AgentRouteGate` component calls `useAgentAccess`, renders the standard loading state while pending, renders the workspace on success, and navigates to `/403` when access is denied. Add Agent Workspace under Personal only when globally enabled and access succeeds. Add `/agent` sidebar mapping while preserving legacy defaults.

- [ ] **Step 2: Build overview and purchasing**

Use `SectionPageLayout`, React Query, React Hook Form, Zod, accessible Base UI dialogs, and responsive cards. Quantity is integer `1..100`. Generate a new idempotency UUID for each confirmed purchase and retain it across network retries. Display server-authoritative total/balance/codes.

- [ ] **Step 3: Build orders/inventory/export/refund/ledger**

Use TanStack Table with URL pagination/filters. Inventory supports status/plan/order/time filters, copy, CSV export, selecting at most 100 refundable codes, and server-calculated refund confirmation. Invalidate only overview/orders/codes/ledger query keys.

- [ ] **Step 4: Verify and commit Task 10**

Run from `web/default`: `bun run format`

Run from `web/default`: `bun run typecheck`

Run from `web/default`: `bun run lint`

Run from `web/default`: `bun run build`

Expected: PASS.

```bash
git add web/default/src/features/agents web/default/src/routes/_authenticated/agent web/default/src/hooks/use-sidebar-data.ts web/default/src/hooks/use-sidebar-config.ts web/default/src/routeTree.gen.ts
git commit -m "feat(default): add agent workspace"
```

### Task 11: Default agent administration

**Required sub-skills:** `shadcn-ui`, `vercel-react-best-practices`.

**Files:**
- Create: `web/default/src/features/agent-admin/index.tsx`
- Create: `web/default/src/features/agent-admin/components/agents-table.tsx`
- Create: `web/default/src/features/agent-admin/components/credit-adjustment-dialog.tsx`
- Create: `web/default/src/features/agent-admin/components/agent-limit-dialog.tsx`
- Create: `web/default/src/features/agent-admin/components/agent-offers-table.tsx`
- Create: `web/default/src/features/agent-admin/components/agent-offer-dialog.tsx`
- Create: `web/default/src/features/agent-admin/components/agent-orders-table.tsx`
- Create: `web/default/src/features/agent-admin/components/agent-codes-table.tsx`
- Create: `web/default/src/routes/_authenticated/agent-admin/index.tsx`
- Modify: `web/default/src/hooks/use-sidebar-data.ts`
- Modify: `web/default/src/hooks/use-sidebar-config.ts`
- Generated: `web/default/src/routeTree.gen.ts`

**Interfaces:**
- Produces admin reads for role >= ADMIN and mutations for SUPER_ADMIN only.

- [ ] **Step 1: Add role guard/navigation**

`/agent-admin` requires ADMIN. Add Agent Management under Admin. Read-only admins see agents, ledgers, orders, codes, reconciliation; mutation controls render only for SUPER_ADMIN.

- [ ] **Step 2: Build lifecycle/credit UI**

Agents table supports user/status search and shows balance, daily usage/limit, reconciliation. Root dialogs enable/disable, change integer limit, and credit/debit decimal strings. Credit confirmation shows before/delta/projected balance, requires reason, and retains an idempotency UUID across retries.

- [ ] **Step 3: Build offer/order/code UI**

Offer editor selects existing plans and validates positive price, validity `1..3650`, fee `0..10000`. Orders/codes use stable filters and never expose generic delete/edit. Root special refund displays server-computed results.

- [ ] **Step 4: Verify and commit Task 11**

Run from `web/default`: `bun run format`

Run from `web/default`: `bun run typecheck`

Run from `web/default`: `bun run lint`

Run from `web/default`: `bun run build`

Expected: PASS.

```bash
git add web/default/src/features/agent-admin web/default/src/routes/_authenticated/agent-admin web/default/src/hooks/use-sidebar-data.ts web/default/src/hooks/use-sidebar-config.ts web/default/src/routeTree.gen.ts
git commit -m "feat(default): add agent administration"
```

### Task 12: Unified redemption UI, feature switch, and i18n

**Required sub-skills:** `i18n-translate`, `vercel-react-best-practices`.

**Files:**
- Modify: `web/default/src/features/wallet/types.ts`
- Modify: `web/default/src/features/wallet/api.ts`
- Modify: `web/default/src/features/wallet/hooks/use-redemption.ts`
- Modify: `web/default/src/features/agent-admin/index.tsx`
- Modify: `web/default/src/features/system-settings/maintenance/config.ts`
- Modify: `web/default/src/features/system-settings/maintenance/sidebar-modules-section.tsx`
- Modify: `web/default/src/i18n/locales/en.json`
- Modify: `web/default/src/i18n/locales/zh.json`
- Modify: `web/default/src/i18n/locales/zh-TW.json`
- Modify: `web/default/src/i18n/locales/fr.json`
- Modify: `web/default/src/i18n/locales/ru.json`
- Modify: `web/default/src/i18n/locales/ja.json`
- Modify: `web/default/src/i18n/locales/vi.json`

**Interfaces:**
- Consumes `POST /api/user/redeem` and `agent_setting.enabled`.
- Produces quota/package success feedback, root feature switch, sidebar controls, and locale coverage.

- [ ] **Step 1: Change Default wallet to typed redemption**

Call `/api/user/redeem`. `type=quota` preserves added-quota toast and user refresh. `type=subscription` shows plan/end time and refreshes user/subscription queries; never send subscription IDs to quota formatters. Failure stays generic.

- [ ] **Step 2: Add feature/sidebar switches**

Expose `agent_setting.enabled` through existing root `/api/option` update on Agent Management. Extend sidebar module defaults/editor with Personal Agent Workspace and Admin Agent Management, preserving legacy merge behavior.

- [ ] **Step 3: Sync and translate**

Run from `web/default`: `bun run i18n:sync`

Translate every new flat English-source key into every configured locale, preserve placeholders, and do not leave untranslated source values except established product/API terms.

- [ ] **Step 4: Verify and commit Task 12**

Run from `web/default`: `bun test src/features/agents/lib/money.test.ts`

Run from `web/default`: `bun run i18n:sync`

Run from `web/default`: `bun run format:check`

Run from `web/default`: `bun run copyright:check`

Run from `web/default`: `bun run typecheck`

Run from `web/default`: `bun run lint`

Run from `web/default`: `bun run build`

Expected: PASS.

```bash
git add web/default/src/features/wallet web/default/src/features/agent-admin web/default/src/features/system-settings/maintenance web/default/src/i18n/locales
git commit -m "feat(default): complete agent redemption experience"
```

### Task 13: Full verification and operational handoff

**Files:**
- Modify only agent-feature files required to fix failures exposed by verification.

**Interfaces:**
- Verifies every approved business invariant and a deployable, default-disabled feature.

- [ ] **Step 1: Run backend verification**

Run: `gofmt -w common/constants.go model/agent_*.go model/redemption.go model/subscription.go service/agent_*.go service/redemption.go dto/agent.go controller/agent*.go controller/user.go controller/audit.go controller/misc.go router/api-router.go setting/operation_setting/agent_setting.go`

Run: `go test ./model ./service ./controller ./router ./setting/... -count=1`

Run: `go test ./... -count=1`

Run: `go vet ./...`

Expected: all commands exit 0.

- [ ] **Step 2: Run Default verification**

Run from `web/default`: `bun test src/features/agents/lib/money.test.ts`

Run from `web/default`: `bun run i18n:sync`

Run from `web/default`: `bun run format:check`

Run from `web/default`: `bun run copyright:check`

Run from `web/default`: `bun run typecheck`

Run from `web/default`: `bun run lint`

Run from `web/default`: `bun run build`

Expected: all commands exit 0.

- [ ] **Step 3: Execute deterministic acceptance scenario**

Prove with service/controller integration fixtures:

1. Root enables an agent and credits `1000.00`.
2. Root configures a plan at `60.00`, 365 days, 500 bps.
3. Agent buys ten codes: balance `400.00`, one order, ten codes, one purchase ledger.
4. Repeating the idempotency key changes nothing.
5. One user redeems one code into one snapshot-correct subscription.
6. Agent refunds one unused code: fee `3.00`, refund `57.00`, balance `457.00`.
7. Used/refunded/expired codes reject refund.
8. Disabled agent cannot buy/refund, but its sold code still redeems.
9. Reconciliation reports ledger sum equal to balance.
10. Existing quota code still credits quota through `/api/user/topup`.

- [ ] **Step 4: Review migration and working-tree safety**

Run: `git diff --check`

Run: `git status --short`

Run: `git log --oneline --decorate -15`

Confirm only agent feature/generated route/i18n files are tracked, unrelated CSV files remain untracked, the feature flag defaults false, and rollback requires only disabling it.

- [ ] **Step 5: Commit verification fixes if present**

If verification changed agent files, stage only those explicit paths and commit:

```bash
git commit -m "fix: harden agent points workflow"
```
