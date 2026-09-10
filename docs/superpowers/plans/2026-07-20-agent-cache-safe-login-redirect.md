# 代理缓存与安全登录重定向修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复代理采购/退款后的余额旧缓存显示，并阻止角色切换后登录跳转到新账号无权访问的页面。

**Architecture:** 在代理工作台中统一定义概览和访问查询键，交易成功先把服务端 `balance_after` 同步到当前用户的两个缓存，再异步获取完整概览校准并刷新列表。登录流程使用一个独立的目标解析模块，验证站内路径、管理员/Root 角色和代理访问能力，密码、微信、Passkey 以及已登录登录页守卫都复用它。

**Tech Stack:** React 19、TypeScript、TanStack Query v5、TanStack Router、Zod、Bun `node:test`。

## Global Constraints

- 只修改 `web/default`，不修改 `web/classic`。
- 不修改代理积分、订单、兑换码、退款、账本或订阅后端逻辑。
- 交易余额只使用服务器返回的 `balance_after`，不在浏览器重新计算金额。
- 后台刷新失败不能覆盖已经确认的交易余额或改变成功提示。
- 重定向只允许站内相对路径；无权、畸形或外部目标回退 `/dashboard`。
- `/agent` 还必须通过现有代理访问探测；Root/管理员角色不自动获得代理工作台权限。
- 所有用户可见文本继续使用现有 i18n 文案，不新增硬编码 UI 文本。
- 新测试保护用户可见行为和权限契约，不测试私有实现细节。
- 使用 Bun 执行前端测试、类型检查、lint、格式检查和构建。
- 保留仓库中现有的 6 个未跟踪 CSV 文件，不添加、删除或修改它们。

---

### Task 1: 统一代理查询键并增加交易缓存同步器

**Files:**
- Modify: `web/default/src/features/agents/lib/workspace.ts`
- Modify: `web/default/src/features/agents/hooks/use-agent-access.ts`
- Create: `web/default/src/features/agents/lib/mutation-sync.ts`
- Create: `web/default/src/features/agents/lib/mutation-sync.test.ts`
- Modify: `web/default/src/features/agents/components/purchase-dialog.tsx`
- Modify: `web/default/src/features/agents/components/refund-dialog.tsx`

**Interfaces:**
- `agentQueryKeys.access: readonly ['agent', 'access']`
- `agentAccessQueryKey(userID: number): readonly unknown[]`
- `setAgentMutationBalance(queryClient: QueryClient, userID: number, balanceAfter: string): void`
- `refreshAgentMutationQueries(queryClient: QueryClient, userID: number): Promise<void>`

- [ ] **Step 1: Add failing cache synchronization tests**

Create a `QueryClient` fixture with two cached `AgentOverview` values for user 41 and one value for user 99. Cover:

```ts
test('updates overview and access balances without creating partial cache entries', () => {
  const queryClient = new QueryClient()
  const overview = {
    balance: '400.00',
    daily_code_count: 10,
    daily_code_limit: 200,
    daily_remaining: 190,
    next_daily_reset_at: 123,
  } as AgentOverview
  queryClient.setQueryData(agentUserQueryKey(agentQueryKeys.overview, 41), overview)
  queryClient.setQueryData(agentAccessQueryKey(41), overview)
  queryClient.setQueryData(agentUserQueryKey(agentQueryKeys.overview, 99), overview)

  setAgentMutationBalance(queryClient, 41, '457.00')

  assert.equal(
    queryClient.getQueryData<AgentOverview>(
      agentUserQueryKey(agentQueryKeys.overview, 41)
    )?.balance,
    '457.00'
  )
  assert.equal(queryClient.getQueryData<AgentOverview>(agentAccessQueryKey(41))?.balance, '457.00')
  assert.equal(
    queryClient.getQueryData<AgentOverview>(
      agentUserQueryKey(agentQueryKeys.overview, 41)
    )?.daily_code_count,
    10
  )
  assert.equal(
    queryClient.getQueryData(agentUserQueryKey(agentQueryKeys.overview, 99)),
    overview
  )
})
```

Add asynchronous tests with an injected `getAgentAccessOverview` probe:

- when the probe succeeds, both current-user caches receive the complete server overview;
- when the probe rejects, the already-confirmed `457.00` remains in both caches;
- list query families `agent/orders`, `agent/codes`, and `agent/credit-logs` are invalidated with `refetchType: 'all'`.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run:

```bash
cd web/default
bun test src/features/agents/lib/mutation-sync.test.ts
```

Expected: FAIL because the query-key export and synchronization functions do not exist.

- [ ] **Step 3: Centralize the access query key**

In `workspace.ts`, extend the query-key object:

```ts
export const agentQueryKeys = {
  access: ['agent', 'access'] as const,
  overview: ['agent', 'overview'] as const,
  offers: ['agent', 'offers'] as const,
  orders: ['agent', 'orders'] as const,
  codes: ['agent', 'codes'] as const,
  creditLogs: ['agent', 'credit-logs'] as const,
}

export const agentAccessQueryKey = (userID: number) =>
  agentUserQueryKey(agentQueryKeys.access, userID)
```

Update `use-agent-access.ts` to import and use this function, and re-export it from that module so existing `agent-admin` imports remain valid:

```ts
export { agentAccessQueryKey } from '../lib/workspace'
```

- [ ] **Step 4: Implement immediate balance patching**

Create `mutation-sync.ts` with a synchronous function that only updates existing full `AgentOverview` cache entries:

```ts
export function setAgentMutationBalance(
  queryClient: QueryClient,
  userID: number,
  balanceAfter: string
): void {
  const keys = [
    agentUserQueryKey(agentQueryKeys.overview, userID),
    agentAccessQueryKey(userID),
  ]
  for (const key of keys) {
    queryClient.setQueryData<AgentOverview>(key, (current) =>
      current ? { ...current, balance: balanceAfter } : current
    )
  }
}
```

This must not create a new partial object when a cache is absent.

- [ ] **Step 5: Implement background full refresh and list invalidation**

Implement `refreshAgentMutationQueries` with an injectable probe defaulting to `getAgentAccessOverview`:

```ts
export async function refreshAgentMutationQueries(
  queryClient: QueryClient,
  userID: number,
  probe: () => Promise<ApiResult<AgentOverview>> = getAgentAccessOverview
): Promise<void> {
  const refreshTasks = agentMutationInvalidationKeys
    .filter((key) => key !== agentQueryKeys.overview)
    .map((queryKey) =>
      queryClient.invalidateQueries({ queryKey, refetchType: 'all' })
    )

  await Promise.allSettled(refreshTasks)

  try {
    const response = await probe()
    if (!response.success) return
    const overviewKey = agentUserQueryKey(agentQueryKeys.overview, userID)
    queryClient.setQueryData(overviewKey, response.data)
    queryClient.setQueryData(agentAccessQueryKey(userID), response.data)
  } catch {
    // Keep the server-confirmed balance already patched by the caller.
  }
}
```

The caller invokes the synchronous patch before starting this async refresh. The probe uses the existing skip-error agent access request, so a background refresh failure does not create a second toast.

- [ ] **Step 6: Wire purchase and refund success handlers**

In both dialogs:

```ts
const userID = useAuthStore((state) => state.auth.user?.id ?? 0)

onSuccess: (data) => {
  keyStore.current.complete()
  setResult(data)
  toast.success(t('...'))
  setAgentMutationBalance(queryClient, userID, data.balance_after)
  void refreshAgentMutationQueries(queryClient, userID)
}
```

Preserve the existing `onRefunded` callback and the existing list invalidation behavior through the shared function. Purchase and refund must use the same ordering: store result, patch confirmed balance, start background refresh.

- [ ] **Step 7: Run Task 1 tests and frontend checks**

Run:

```bash
cd web/default
bun test src/features/agents/lib/mutation-sync.test.ts src/features/agents/lib/workspace.test.ts src/features/agents/hooks/use-agent-access.test.ts
bunx oxlint -c .oxlintrc.json src/features/agents/lib/workspace.ts src/features/agents/lib/mutation-sync.ts src/features/agents/hooks/use-agent-access.ts src/features/agents/components/purchase-dialog.tsx src/features/agents/components/refund-dialog.tsx
bun run typecheck
```

Expected: all focused tests pass, lint has no errors, and TypeScript exits successfully.

- [ ] **Step 8: Commit Task 1**

```bash
git add web/default/src/features/agents/lib/workspace.ts web/default/src/features/agents/hooks/use-agent-access.ts web/default/src/features/agents/lib/mutation-sync.ts web/default/src/features/agents/lib/mutation-sync.test.ts web/default/src/features/agents/components/purchase-dialog.tsx web/default/src/features/agents/components/refund-dialog.tsx
git commit -m "fix(default): synchronize agent balances after mutations"
```

### Task 2: Build and test the safe post-login target resolver

**Files:**
- Create: `web/default/src/features/auth/lib/post-login-redirect.ts`
- Create: `web/default/src/features/auth/lib/post-login-redirect.test.ts`

**Interfaces:**
- `normalizePostLoginPath(value: string | undefined): string | null`
- `getPostLoginAccessRequirement(path: string): 'dashboard' | 'user' | 'agent' | 'admin' | 'root'`
- `resolvePostLoginTarget(redirectTo: string | undefined, user: Pick<User, 'role'> | undefined, probeAgentAccess: () => Promise<boolean>): Promise<string>`

- [ ] **Step 1: Add failing redirect matrix tests**

Use `node:test` and `assert/strict`. Build users with `role: ROLE.SUPER_ADMIN`, `ROLE.ADMIN`, and `ROLE.USER`. Cover:

```ts
test('preserves only targets allowed for the new account', async () => {
  assert.equal(
    await resolvePostLoginTarget('/agent-admin', { role: ROLE.ADMIN }, async () => false),
    '/agent-admin'
  )
  assert.equal(
    await resolvePostLoginTarget('/agent-admin', { role: ROLE.USER }, async () => false),
    '/dashboard'
  )
  assert.equal(
    await resolvePostLoginTarget('/agent', { role: ROLE.USER }, async () => true),
    '/agent'
  )
  assert.equal(
    await resolvePostLoginTarget('/agent', { role: ROLE.USER }, async () => false),
    '/dashboard'
  )
  assert.equal(
    await resolvePostLoginTarget('/wallet?tab=topup', { role: ROLE.USER }, async () => false),
    '/wallet?tab=topup'
  )
})
```

Add tests that external URLs (`https://evil.example`, `//evil.example`, and backslash variants), `/403`, `/sign-in`, and `/system-settings/site` for non-Root users return `/dashboard`; `/system-settings/site` for Root is preserved; `/users-example` is not classified as `/users`; the agent probe is called only for `/agent`; probe rejection returns `/dashboard`.

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
cd web/default
bun test src/features/auth/lib/post-login-redirect.test.ts
```

Expected: FAIL because the resolver module does not exist.

- [ ] **Step 3: Implement strict internal path normalization**

Implement `normalizePostLoginPath` by requiring a string that starts with exactly one forward slash, rejecting `//`, backslash-containing values, control characters, and auth/error entry paths. Parse with `new URL(value, 'http://new-api.local')`, require the parsed origin to remain `http://new-api.local`, and return `pathname + search + hash`.

Use path-segment matching:

```ts
function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`)
}
```

- [ ] **Step 4: Implement role and agent capability resolution**

Classify current guarded prefixes:

```ts
const ROOT_PREFIXES = ['/system-settings', '/system-info']
const ADMIN_PREFIXES = [
  '/agent-admin',
  '/channels',
  '/redemption-codes',
  '/users',
  '/subscriptions',
  '/models',
]
```

`resolvePostLoginTarget` must:

1. Return `/dashboard` for a missing user or invalid target.
2. Require `ROLE.SUPER_ADMIN` for Root prefixes.
3. Require `role >= ROLE.ADMIN` for Admin prefixes.
4. Await `probeAgentAccess` only for `/agent`; return `/dashboard` on `false` or rejection.
5. Preserve all other normalized authenticated paths, including query and hash.

- [ ] **Step 5: Run Task 2 tests**

Run:

```bash
cd web/default
bun test src/features/auth/lib/post-login-redirect.test.ts
```

Expected: PASS for the complete role, URL, agent-probe, and fallback matrix.

- [ ] **Step 6: Commit Task 2**

```bash
git add web/default/src/features/auth/lib/post-login-redirect.ts web/default/src/features/auth/lib/post-login-redirect.test.ts
git commit -m "fix(default): validate post-login redirect targets"
```

### Task 3: Connect the resolver to every login entry point

**Files:**
- Modify: `web/default/src/features/auth/hooks/use-auth-redirect.ts`
- Modify: `web/default/src/routes/(auth)/sign-in.tsx`

**Interfaces:**
- Consumes `resolvePostLoginTarget` from Task 2.
- Consumes `resolveAgentAccess` from `web/default/src/features/agents/hooks/use-agent-access.ts`.

- [ ] **Step 1: Add entry-point regression tests**

Extend `post-login-redirect.test.ts` with this injected-probe contract; do not render a full login form or export another adapter:

```ts
test('probes agent access only for an agent target', async () => {
  let calls = 0
  const probe = async () => {
    calls += 1
    return true
  }

  await resolvePostLoginTarget('/wallet', { role: ROLE.USER }, probe)
  await resolvePostLoginTarget('/agent-admin', { role: ROLE.ADMIN }, probe)
  assert.equal(calls, 0)

  await resolvePostLoginTarget('/agent', { role: ROLE.USER }, probe)
  assert.equal(calls, 1)
})
```

The route and hook both call the same resolver, so this matrix is their shared behavioral contract.

- [ ] **Step 2: Update `useAuthRedirect` to resolve against the fetched new user**

Track the user fetched by `getSelf` in a local variable. Do not use the hook’s pre-login `auth.user` after a login response. After the fetch:

```ts
const targetPath = await resolvePostLoginTarget(
  redirectTo,
  resolvedUser,
  async () => (await resolveAgentAccess()) !== null
)
navigate({ to: targetPath, replace: true })
```

If `getSelf` fails, pass `undefined` and therefore navigate to `/dashboard`. Keep saved-language restoration and user-ID persistence unchanged.

- [ ] **Step 3: Update the sign-in route guard**

Make `beforeLoad` async and use the same resolver when `auth.user` already exists:

```ts
if (auth.user) {
  const target = await resolvePostLoginTarget(
    search.redirect,
    auth.user,
    async () => (await resolveAgentAccess()) !== null
  )
  throw redirect({ to: target })
}
```

This prevents a stale redirect from bypassing the same policy when a logged-in user visits `/sign-in` directly.

- [ ] **Step 4: Run focused auth tests and checks**

Run:

```bash
cd web/default
bun test src/features/auth/lib/post-login-redirect.test.ts src/features/agents/hooks/use-agent-access.test.ts
bunx oxlint -c .oxlintrc.json src/features/auth/lib/post-login-redirect.ts src/features/auth/hooks/use-auth-redirect.ts 'src/routes/(auth)/sign-in.tsx'
bun run typecheck
```

Expected: PASS, no lint errors, and no TypeScript errors.

- [ ] **Step 5: Commit Task 3**

```bash
git add web/default/src/features/auth/lib/post-login-redirect.ts web/default/src/features/auth/lib/post-login-redirect.test.ts web/default/src/features/auth/hooks/use-auth-redirect.ts 'web/default/src/routes/(auth)/sign-in.tsx'
git commit -m "fix(default): guard login navigation by account access"
```

### Task 4: Full verification, rebuild, and browser acceptance

**Files:**
- No source changes expected. If a verification failure requires a source change, return to the relevant task and add a regression test before editing.

- [ ] **Step 1: Run all relevant frontend tests**

Run:

```bash
cd web/default
bun test src/features/agents/lib/*.test.ts src/features/agents/hooks/*.test.ts src/features/auth/lib/post-login-redirect.test.ts
```

Expected: all selected agent and auth tests pass.

- [ ] **Step 2: Run formatting, lint, typecheck, and production build**

Run:

```bash
cd web/default
bun run format:check
bun run lint
bun run typecheck
bun run build
```

Expected: all commands exit 0. If repository-wide lint reports a pre-existing unrelated file, rerun lint on all modified files and record the unrelated baseline separately; do not modify unrelated files.

- [ ] **Step 3: Inspect the final diff and preserve unrelated files**

Run:

```bash
git diff --check
git status --short
git diff custom...HEAD --stat
```

Confirm only the design/plan commits and the two frontend fixes are tracked changes, and the six user CSV files remain untracked and untouched.

- [ ] **Step 4: Rebuild the custom Docker frontend/backend**

Use the existing compose file:

```bash
docker compose -f dev/docker-compose.custom-dev.yml up -d --build
docker compose -f dev/docker-compose.custom-dev.yml ps
```

Wait for `newapi-custom-backend`, `newapi-custom-pg`, and `newapi-custom-redis` to report running/healthy state, then open `http://localhost:3100`.

- [ ] **Step 5: Browser-accept the balance fix**

Using the existing MVP accounts and data:

1. Sign in as `mvp_agent`.
2. Confirm the current balance in Overview.
3. Purchase one package code, close the dialog, switch to Overview, and confirm the new server balance is visible without clicking Refresh.
4. Refund one unused code, close the dialog, switch away and back to Overview, and confirm the refund response balance is visible without clicking Refresh.
5. Confirm Orders, Code inventory, and Point ledger still show the transaction changes.

- [ ] **Step 6: Browser-accept the role-switch fix**

1. Sign in as `mvp_root`, visit `/agent-admin`, log out.
2. Sign in as `mvp_agent` with the stale admin redirect and confirm the final page is `/agent` or `/dashboard`, never `/agent-admin` or `/403`.
3. Log out from the agent page.
4. Sign in as `mvp_customer` with the stale agent redirect and confirm the final page is `/dashboard`, never `/agent` or `/403`.
5. Sign in as `mvp_customer` through a valid `/wallet` redirect and confirm `/wallet` is preserved.
6. Check the browser console for errors and capture the final URL for each role.

- [ ] **Step 7: Record final verification**

Run:

```bash
git log -6 --oneline --decorate
git status --short
```

Report the passing commands, container status, and browser outcomes. Do not claim completion until the focused tests, typecheck, lint/format checks, build, and browser flows have all passed.
