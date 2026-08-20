### Task 2 Report: async subscription short-window removal

Status: complete

#### Changes

- `service/task_billing.go`
  - Removed async Redis window compensation from `taskAdjustFunding`.
  - Made `ApplyAcceptedTaskSubscriptionWindowOnce` a compatibility marker only; it still writes `TaskAcceptedAccountingStepSubscriptionWindow` once for old workers/ledgers, but no longer reads `BillingContext.SubscriptionWindow` or touches Redis.
  - Kept weighted monthly pool settlement through `taskSubscriptionWeighted` and `model.PostConsumeUserSubscriptionDelta`.

- `controller/relay.go`
  - Subscription async task snapshot now persists `SubscriptionWeight` only.
  - It no longer assigns `TaskBillingContext.SubscriptionWindow`.

- `controller/asset_task_worker.go`
  - Asset task billing snapshot now persists `SubscriptionWeight` only.
  - It no longer assigns `TaskBillingContext.SubscriptionWindow`.

- `service/task_billing_test.go`
  - Added RED/GREEN coverage for legacy `SubscriptionWindow` snapshots:
    - refund keeps weighted monthly-pool settlement while Redis counters stay unchanged;
    - accepted-accounting compatibility step marks the ledger while Redis counters stay unchanged.

- `controller/asset_task_worker_test.go`
  - Updated subscription snapshot coverage to require `BillingContext.SubscriptionWindow == nil` while preserving `SubscriptionWeight == 1.5`.

#### TDD Evidence

RED command:

```text
go test ./service ./controller -run 'Test.*(Task.*Subscription.*Window|SubscriptionSnapshot)' -count=1
```

RED result:

```text
FAIL	github.com/QuantumNous/new-api/service	0.660s
ok  	github.com/QuantumNous/new-api/controller	0.640s
```

Expected failures observed:

```text
TestRefundTaskSubscriptionWindowSnapshotLeavesRedisCounters:
expected Redis 5h counter 150, actual 0

TestAcceptedTaskSubscriptionWindowStepOnlyMarksCompatibilityLedger:
expected Redis 5h counter 150, actual 300
```

GREEN focused command:

```text
go test ./service ./controller -run 'Test.*(Task.*Subscription.*Window|SubscriptionSnapshot|AcceptedTaskSubscription)' -count=1
```

GREEN focused result:

```text
ok  	github.com/QuantumNous/new-api/service	0.638s
ok  	github.com/QuantumNous/new-api/controller	0.731s
```

Additional narrow verification:

```text
go test ./service -run 'Test(RefundTaskSubscriptionWindowSnapshotLeavesRedisCounters|AcceptedTaskSubscriptionWindowStepOnlyMarksCompatibilityLedger)$' -count=1
ok  	github.com/QuantumNous/new-api/service	0.650s

go test ./controller -run 'Test(AssetTaskQueuePersistsSubscriptionSnapshot|AssetTaskAcceptedAccountingExternalStepsAreIdempotent|AssetTaskWorkerAcceptedSubscriptionUsesSnapshotForSettlement)$' -count=1
ok  	github.com/QuantumNous/new-api/controller	0.851s
```

#### Redis Invariance Evidence

- Refund path seeded Redis:
  - `sub:win:5h:22:0 = 150`
  - `sub:win:w:22:0 = 150`
- After `RefundTaskQuota` on a legacy snapshot with `SubscriptionWeight = 1.5` and quota `100`, both Redis counters remained `150`.

- Accepted accounting path seeded current Redis bucket/week counters at `150`.
- After `ApplyAcceptedTaskSubscriptionWindowOnce` with reserved quota `100`, actual quota `200`, and `SubscriptionWeight = 1.5`, both Redis counters remained `150`.

#### Monthly Pool Evidence

- Refund path still changed the subscription pool from `AmountUsed = 500` to `350`.
- This proves weighted refund settlement remained active: quota `100 * weight 1.5 = 150`.
- Existing controller settlement coverage still passes:
  - `TestAssetTaskWorkerAcceptedSubscriptionUsesSnapshotForSettlement`
  - It verifies accepted settlement uses persisted `SubscriptionWeight = 1.5`.

#### Static Search Evidence

Checked the scoped files for residual active window accounting:

```text
rg -n "AdjustSubscriptionWindowFromSnapshot|SubscriptionWindow = window|weight, window :=|TaskAcceptedAccountingStepSubscriptionWindow|SubscriptionTaskSnapshot\\(" service\\task_billing.go controller\\asset_task_worker.go controller\\relay.go service\\billing_session.go controller\\asset_task_worker_test.go service\\task_billing_test.go
```

Result:

```text
service\task_billing.go:463: marker-only TaskAcceptedAccountingStepSubscriptionWindow
service\billing_session.go:164: SubscriptionTaskSnapshot compatibility method returns weight, nil
controller\asset_task_worker.go:266: weight-only snapshot call
controller\relay.go:872: weight-only snapshot call
tests: expected marker/snapshot assertions only
```

No scoped production call to `AdjustSubscriptionWindowFromSnapshot*` remains.
No scoped production `SubscriptionWindow = window` assignment remains.

#### Concerns

- Full `go test ./service ./controller -count=1` was started as extra verification and produced no failure output, but was still running after more than two minutes. Per parent instruction, I interrupted that run and used the focused plus narrower named commands above.
- `TaskBillingContext.SubscriptionWindow` remains in the model for legacy JSON/database deserialization; this task intentionally did not remove public API/UI or model fields.
