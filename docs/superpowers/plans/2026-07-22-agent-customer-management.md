# Agent Customer Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-bind agent ownership, read-only customer management, and customer usage logs to the current agent MVP.

**Architecture:** Store immutable customer ownership on `users.bound_agent_id/bound_at`, expose one atomic binding service, and call it from password registration, OAuth registration, and successful redemption. Add agent-scoped customer/log query services that enforce ownership server-side; reuse the default usage-log components for the new customer-log tab.

**Tech Stack:** Go 1.22, Gin, GORM v2, SQLite/MySQL/PostgreSQL-compatible migrations, React 19, TypeScript, TanStack Query/Router, Zod, i18next, Bun.

## Global Constraints

- Preserve protected `new-api` and `QuantumNous` identifiers.
- Use GORM APIs and cross-database-compatible schema changes.
- Use `common.*` JSON helpers in backend business code.
- Never accept `agent_user_id` from a self-service agent request to define its scope.
- Agent customer data is read-only and must exclude passwords, access tokens, token keys, email, IP, and admin-only log fields.
- Disabled agent accounts retain read access to existing customers/logs; only active accounts may perform agent mutations.
- Keep `web/classic` unchanged; add UI only to `web/default`.

---

### Task 1: Add atomic customer ownership to the user model

**Files:**
- Modify: `model/user.go`
- Modify: `model/user_cache.go` only if cache serialization needs the new ownership fields
- Create: `model/agent_customer_test.go`
- Create: `service/agent_bind.go`
- Create: `service/agent_bind_test.go`

**Interfaces:**
- Produce `service.TryBindUserToAgent(userID int, agentID int) (bool, error)`.
- Produce `model.GetBoundAgentId(userID int) (int, error)` for later migration/query code.

- [ ] **Step 1: Write failing model/service tests**

Add deterministic SQLite tests covering: unbound user binds to an existing active account; disabled account is still a valid ownership target; second agent cannot replace the first; invalid agent account does not bind; two concurrent calls result in exactly one successful binding.

- [ ] **Step 2: Run the focused tests and verify the expected missing-symbol failure**

Run:

```bash
go test ./service ./model -run 'TestTryBindUserToAgent|TestBoundAgent' -count=1
```

Expected: FAIL because the ownership fields and binding service do not exist.

- [ ] **Step 3: Add the fields and atomic model operation**

Add `BoundAgentId int` and `BoundAt int64` to `model.User` with indexed, numeric GORM tags. Implement the model update as `WHERE id = ? AND bound_agent_id = 0`, invalidate the user cache only when `RowsAffected == 1`, and leave an existing nonzero owner unchanged.

- [ ] **Step 4: Implement the service guard**

Implement `TryBindUserToAgent` by checking that the target user is valid and an `AgentAccount` row exists for the target agent. Do not require active status. Return `(false, nil)` for invalid/non-agent targets and binding conflicts; return database errors. Log failures without throwing into registration/redemption callers.

- [ ] **Step 5: Run the focused tests and the model suite**

Run:

```bash
go test ./service ./model -run 'TestTryBindUserToAgent|TestBoundAgent' -count=1
go test ./model -count=1
```

Expected: PASS.

- [ ] **Step 6: Commit the isolated backend ownership change**

```bash
git add model/user.go model/user_cache.go model/agent_customer_test.go service/agent_bind.go service/agent_bind_test.go
git commit -m "feat: add atomic agent customer binding"
```

### Task 2: Bind customers from registration and redemption

**Files:**
- Modify: `controller/user.go`
- Modify: `controller/oauth.go`
- Modify: `service/redemption.go`
- Modify: `model/redemption.go` or the quota redemption helper used by it
- Modify: `service/redemption_test.go`
- Create: `controller/agent_customer_binding_test.go` if existing controller fixtures do not cover registration

**Interfaces:**
- Extend the internal `service.RedemptionResult` with `AgentUserID int \\`json:"-"\\``.
- Add an internal quota redemption result path that returns both quota and `AgentUserId` from the same transaction.

- [ ] **Step 1: Add failing redemption binding tests**

Extend the existing redemption fixture with two agent accounts and users. Assert that an unbound user is bound after a successful quota and subscription redemption, an already-bound user remains bound to the first agent, and redemption still succeeds when the code’s owner has no valid agent account.

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
go test ./service -run 'TestRedeemCode.*Agent|TestRedeemCode.*Bind' -count=1
```

Expected: FAIL because `RedeemCode` currently never binds the user.

- [ ] **Step 3: Preserve the agent owner inside quota redemption**

Change the quota redemption path so the transaction returns the redeemed code’s `AgentUserId` together with the quota. Do not perform a second unprotected lookup after commit.

- [ ] **Step 4: Bind after successful commit**

For quota and subscription branches, call `TryBindUserToAgent(userID, result.AgentUserID)` only after the redemption transaction commits. Keep cache invalidation, subscription delivery, quota accounting, and user-facing response behavior unchanged.

- [ ] **Step 5: Wire password and OAuth registration**

Call the same service after the password user is created and after the OAuth creation transaction commits. Reuse the existing `inviterId` derived from the affiliate code/session; do not alter inviter rewards. Binding errors must be logged and must not fail registration.

- [ ] **Step 6: Run all redemption and registration tests**

Run:

```bash
go test ./service -run 'TestRedeemCode|Test.*Register|Test.*OAuth' -count=1
go test ./controller ./router -count=1
```

Expected: PASS, including existing exactly-once redemption tests.

- [ ] **Step 7: Commit the binding trigger integration**

```bash
git add controller/user.go controller/oauth.go service/redemption.go model/redemption.go service/redemption_test.go controller/agent_customer_binding_test.go
git commit -m "feat: bind customers from registration and redemption"
```

### Task 3: Add customer list, promotion summary, and customer log APIs

**Files:**
- Create: `model/agent_customer.go`
- Create: `service/agent_customer.go`
- Create: `controller/agent_customer.go`
- Create: `controller/agent_customer_log.go`
- Modify: `router/api-router.go`
- Create: `model/agent_customer_test.go` additions for projections and ownership
- Create: `service/agent_customer_test.go`
- Create: `router/agent_customer_routes_test.go`

**Interfaces:**
- `service.GetAgentPromotion(agentUserID int) (AgentPromotion, error)`
- `service.ListAgentCustomers(agentUserID int, query AgentCustomerQuery) ([]AgentCustomer, int64, error)`
- `service.ListAgentCustomerLogs(agentUserID int, query AgentCustomerLogQuery) ([]*model.Log, int64, error)`
- `service.GetAgentCustomerLogStats(agentUserID int, query AgentCustomerLogQuery) (model.Stat, error)`

`AgentCustomerQuery` includes `Keyword`, `SortBy`, `SortOrder`, `Offset`, `Limit`; `AgentCustomerLogQuery` includes `UserID`, `Username`, `Type`, `ModelName`, `TokenName`, `Group`, `StartTimestamp`, `EndTimestamp`, `Offset`, `Limit`.

- [ ] **Step 1: Write failing service tests**

Seed two agents, three users with different `BoundAgentId` values, subscriptions, and logs. Assert customer ownership isolation, keyword search, whitelist sorting, remaining quota calculation, current subscription projection, log ownership isolation, username validation, and quota/RPM/TPM aggregation.

- [ ] **Step 2: Run the focused tests and verify failure**

Run:

```bash
go test ./service ./model -run 'TestAgentCustomer|TestAgentCustomerLog' -count=1
```

Expected: FAIL because the DTOs and services do not exist.

- [ ] **Step 3: Implement the customer projection query**

Query only users with `bound_agent_id = agentUserID`, select the approved fields, clamp `remaining_quota` to zero in Go, and batch-load the latest active/relevant `UserSubscription` records. Reject unknown sort fields and invalid page ranges.

- [ ] **Step 4: Implement promotion summary**

Read the current agent user’s `AffCode`; derive the register link using the existing public URL helper; count bound customers and current-month bindings using `BoundAt`.

- [ ] **Step 5: Implement ID-scoped log queries**

Read bound customer IDs from the primary database. For a username filter, resolve it against that bound set first. Query `LOG_DB` by `logs.user_id`, applying existing log filter helpers, stable ordering, and page limits. For large ID sets, query bounded chunks and merge/count in the service layer. Call `formatUserLogs` and keep controller channel URL sanitization.

- [ ] **Step 6: Add controllers and routes**

Add `GET /api/agent/promotion`, `GET /api/agent/customers`, `GET /api/agent/logs`, and `GET /api/agent/logs/stat` under the current `/api/agent` `UserAuth` group. Convert malformed timestamps, page values, sort values, and log types into the project’s standard API errors.

- [ ] **Step 7: Add route-level security tests**

Assert unauthenticated requests are rejected, missing agent accounts are rejected, disabled agents can read, and an agent cannot pass another agent’s ID to expand the result set. Assert sensitive customer fields are absent and log admin fields are removed.

- [ ] **Step 8: Run backend verification**

Run:

```bash
go test ./model ./service ./controller ./router -count=1
```

Expected: PASS.

- [ ] **Step 9: Commit the read-only customer APIs**

```bash
git add model/agent_customer.go service/agent_customer.go controller/agent_customer.go controller/agent_customer_log.go router/api-router.go model/agent_customer_test.go service/agent_customer_test.go router/agent_customer_routes_test.go
git commit -m "feat: add agent customer and usage log APIs"
```

### Task 4: Add idempotent historical backfill

**Files:**
- Create: `model/agent_customer_migration.go`
- Create: `model/agent_customer_migration_test.go`
- Modify: `model/main.go` to launch the idempotent backfill asynchronously after both normal and fast migrations finish

**Interfaces:**
- `model.BackfillAgentCustomerBindings(ctx context.Context, batchSize int) (AgentCustomerBackfillReport, error)`.

- [ ] **Step 1: Write failing backfill tests**

Seed existing nonzero bindings, invitation candidates, redemption candidates, conflicting timestamps, and unresolved agent IDs. Assert existing bindings are preserved, the earliest valid candidate wins, unresolved rows are reported, and a second invocation changes nothing.

- [ ] **Step 2: Run the focused migration tests and verify failure**

Run:

```bash
go test ./model -run 'TestBackfillAgentCustomerBindings' -count=1
```

Expected: FAIL because the migration function does not exist.

- [ ] **Step 3: Implement deterministic batched backfill**

Collect invitation and used-redemption candidates, order them by event timestamp and stable ID, update only rows whose `bound_agent_id` is zero, and return counts for bound/skipped/unresolved records. Use GORM transactions and no dialect-specific SQL.

- [ ] **Step 4: Run migration tests and inspect generated SQL on SQLite**

Run:

```bash
go test ./model -run 'TestBackfillAgentCustomerBindings' -count=1
```

Expected: PASS with an idempotent report.

- [ ] **Step 5: Commit the backfill**

```bash
git add model/agent_customer_migration.go model/agent_customer_migration_test.go model/main.go
git commit -m "feat: backfill historical agent customer bindings"
```

The migration runner calls `BackfillAgentCustomerBindings(context.Background(), 500)` from both `migrateDB` and `migrateDBFast` in a goroutine after schema migration completes; failures are logged and do not prevent service startup.

### Task 5: Add default frontend customer management and logs

**Files:**
- Modify: `web/default/src/features/agents/types.ts`
- Modify: `web/default/src/features/agents/api.ts`
- Modify: `web/default/src/features/agents/lib/workspace.ts`
- Modify: `web/default/src/features/agents/index.tsx`
- Create: `web/default/src/features/agents/components/agent-customers-table.tsx`
- Create: `web/default/src/features/agents/components/agent-customer-logs.tsx`
- Modify: `web/default/src/features/usage-logs/api.ts`
- Modify: `web/default/src/features/usage-logs/types.ts`
- Modify: `web/default/src/features/usage-logs/lib/utils.ts`
- Modify: `web/default/src/features/usage-logs/components/usage-logs-table.tsx`
- Modify: `web/default/src/i18n/locales/en.json`
- Modify: `web/default/src/i18n/locales/zh.json`
- Modify: `web/default/src/i18n/locales/fr.json`
- Modify: `web/default/src/i18n/locales/ru.json`
- Modify: `web/default/src/i18n/locales/ja.json`
- Modify: `web/default/src/i18n/locales/vi.json`
- Modify: `web/default/src/features/agents/api.test.ts`
- Modify: `web/default/src/features/agents/lib/workspace.test.ts`

**Interfaces:**
- Add Zod schemas for `AgentCustomer`, `AgentPromotion`, `AgentCustomerLog`, and the two agent log stat responses.
- Add API functions `getAgentPromotion`, `getAgentCustomers`, `getAgentCustomerLogs`, and `getAgentCustomerLogStats`.
- Extend the workspace tab union with `customers` and `customer-logs`.

- [ ] **Step 1: Write failing API/schema and workspace tests**

Assert API functions send only self-scoped parameters, parse the new response envelopes, and workspace search accepts both new tab values while preserving pagination.

- [ ] **Step 2: Run the frontend tests and verify failure**

Run the existing frontend test runner for the two focused test files; expected failure is missing schemas/functions/tab values.

- [ ] **Step 3: Add typed API functions and query keys**

Use the existing `api` client and strict Zod response schemas. Add `agentQueryKeys.customers` and `agentQueryKeys.customerLogs`; use them for the two new read queries and do not add them to mutation invalidation because existing agent mutations do not change customer ownership.

- [ ] **Step 4: Build the customer table**

Use the existing agent table shell and TanStack Table patterns. Display the approved fields, search, sort, pagination, empty/loading/error states, and no mutation actions.

- [ ] **Step 5: Add the customer-log scope**

Extend the usage-log fetcher with an `agent` scope that calls `/api/agent/logs` and `/api/agent/logs/stat`, enables username/customer filtering, and reuses existing columns and mobile rendering. Do not expose admin-only controls.

- [ ] **Step 6: Add the two workspace tabs and translations**

Render the new table and log components from `AgentWorkspace`; preserve URL search state and use `useTranslation()` for every user-facing string. Add English source keys and synchronized translations to all six locale files.

- [ ] **Step 7: Run frontend verification**

Run:

```bash
cd web/default
bun run typecheck
bun run lint
bun run build:check
```

Expected: PASS.

- [ ] **Step 8: Commit the default frontend**

```bash
git add web/default/src/features/agents web/default/src/features/usage-logs web/default/src/i18n/locales
git commit -m "feat: add agent customer workspace"
```

### Task 6: Final verification and handoff

**Files:**
- No new production files; inspect all changed files and existing untracked CSV files without staging them.

- [ ] **Step 1: Run the full backend test suite**

```bash
go test ./... -count=1
```

- [ ] **Step 2: Run final frontend checks**

```bash
cd web/default
bun run typecheck
bun run lint
bun run build:check
```

- [ ] **Step 3: Review database compatibility and security diff**

Check that no raw dialect-specific SQL, unbounded order clause, client-controlled agent scope, secret field, or Classic frontend change was introduced.

- [ ] **Step 4: Report the final changed files, tests, migration instructions, and any remaining unrelated worktree files**
