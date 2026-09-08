# Task 7 report

Status: PARTIAL

Follow-up wiring now routes `TopUp` through `service.RedeemCode`, so subscription snapshots and agent binding execute while legacy quota codes retain their integer response shape. Password registration attempts first binding from the inviter/affiliate agent and logs a system error without changing registration success. Customer refunds now emit the same official operation audit shape as root refunds, including `admin_info` and idempotency details.

Ported Agent service/controller flows, admin and customer endpoints, redemption batch/audit handling, CXM migration package, immutable subscription entitlement helpers, agent setting, and protected customer log projection onto the Task 6 model layer. Added Agent routes under `/api/agent` and `/api/agent-admin`.

Focused verification passed:

```text
go test ./service ./tools/cxm_migration -run 'Agent|CXM|Redemption|Subscription' -count=1
go test ./controller -run 'TestDeleteRedemptionBatch' -count=1
go test ./controller ./service -run 'TopUp|Register|Agent|Redemption|Refund' -count=1
```

The full Task 7 controller selector also exercises pre-existing audit/token tests and currently reports unrelated baseline failures in those tests; no new production compile failures remain in the focused packages. Three-database integration verification was not available in this worktree, so database compatibility remains unverified.

No rankings or `actual_base_url` work is included.

OAuth generic and built-in provider registration now performs the same post-commit, non-fatal affiliate-agent binding as password registration. Existing-user login and account-binding flows are unchanged.
