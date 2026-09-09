# 缺口修复前基线（2026-09-09）

- 集成分支 HEAD: 6a091b22d（brief 写 7f7b70fa9 是因为审计后 plan 文档本身先提交了一版，属预期差异）
- upstream/main: bdef11750（9 个提交未吸收）
- 参考源: custom @ 12f241347

## go test 现状
ok  	github.com/QuantumNous/new-api/controller	27.844s
--- FAIL: TestRedeemCodeQuotaZeroResultIncludesQuotaField (2.98s)
--- FAIL: TestRedeemCodeSubscriptionUsesSoldSnapshotAfterPlanChanges (0.05s)
FAIL
FAIL	github.com/QuantumNous/new-api/service	13.367s
ok  	github.com/QuantumNous/new-api/service/authz	1.044s
ok  	github.com/QuantumNous/new-api/model	11.994s
ok  	github.com/QuantumNous/new-api/router	5.221s
ok  	github.com/QuantumNous/new-api/setting	9.061s
ok  	github.com/QuantumNous/new-api/setting/billing_setting	8.253s
ok  	github.com/QuantumNous/new-api/setting/config	9.910s
ok  	github.com/QuantumNous/new-api/setting/model_setting	10.264s
ok  	github.com/QuantumNous/new-api/setting/operation_setting	11.203s
ok  	github.com/QuantumNous/new-api/setting/ratio_setting	11.964s
ok  	github.com/QuantumNous/new-api/setting/reasoning	13.428s
ok  	github.com/QuantumNous/new-api/setting/system_setting	18.489s
ok  	github.com/QuantumNous/new-api/setting/task_pricing_setting	19.492s
ok  	github.com/QuantumNous/new-api/tools/cxm_migration	16.770s
ok  	github.com/QuantumNous/new-api/dto	15.688s
ok  	github.com/QuantumNous/new-api/tests/controller	18.676s
ok  	github.com/QuantumNous/new-api/tests/model	16.262s
ok  	github.com/QuantumNous/new-api/tests/service	17.433s
FAIL

## vitest 现状

Test Files  17 failed | 104 passed (121)
Tests  30 failed | 966 passed (996)

- `src/features/agent-admin/api.test.ts` — Cannot bundle Node.js built-in "node:test"
- `src/features/agent-admin/lib/admin.test.ts` — Cannot bundle Node.js built-in "node:test"
- `src/features/agents/api.test.ts` — Cannot bundle Node.js built-in "node:test"
- `src/features/agents/hooks/use-agent-access.test.ts` — Cannot bundle Node.js built-in "node:test"
- `src/features/agents/lib/money.test.ts` — Cannot bundle Node.js built-in "node:test"
- `src/features/agents/lib/mutation-sync.test.ts` — Cannot bundle Node.js built-in "node:test"
- `src/features/agents/lib/workspace.test.ts` — Cannot bundle Node.js built-in "node:test"
- `src/features/agents/types.test.ts` — Cannot bundle Node.js built-in "node:test"
- `src/features/dashboard/components/overview/__tests__/setup-guide.test.tsx` — Error: expect(element).toBeVisible()
- `src/features/model-pricing/__tests__/editor-currency.test.tsx` — Test timed out in 5000ms
- `src/features/models/__tests__/metadata-editing.test.tsx` — Test timed out in 5000ms
- `src/features/models/__tests__/metadata-sync.test.tsx` — Test timed out in 5000ms
- `src/features/models/__tests__/model-listing.test.tsx` — Test timed out in 5000ms
- `src/features/pricing/__tests__/pricing-controls.test.tsx` — Test timed out in 5000ms
- `src/features/system-settings/__tests__/pricing-sync.test.tsx` — Test timed out in 5000ms
- `src/features/task-plugins/__tests__/upload-dialog.test.tsx` — Test timed out in 5000ms
- `src/features/usage-logs/audit/__tests__/viewer.test.tsx` — TestingLibraryElementError: Unable to find role="cell"

分组说明：

- **agents / agent-admin（8 个文件）**：全部为 `node:test` 无法加载；本计划 Task 18 修复范围。
- **其余（9 个文件）**：本分支既有失败，非本计划引入。其中 7 个文件以 5000ms 超时为主；`viewer.test.tsx` 为 DOM 断言失败，`setup-guide.test.tsx` 为可见性断言失败。

