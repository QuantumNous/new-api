# E2E 测试规范

## 运行

```bash
# 全量运行（需先启动后端 + 隧道，见 new-api-startup skill）
TUNNEL_URL=https://xxx.trycloudflare.com npx playwright test

# 只重跑上次失败的用例
npx playwright test --last-failed

# 单文件
npx playwright test e2e/tests/waffo-refund-flow.spec.ts
```

## 技术规范

### 1. waitUntil 策略

本地页面统一用 `'load'`，**禁止用 `'networkidle'`**。

```typescript
// 正确
await page.goto('/console/topup', { waitUntil: 'load' });

// 错误：充值页/设置页有后台轮询，networkidle 永远不触发，导致 goto 无限等待
await page.goto('/console/topup', { waitUntil: 'networkidle' });
```

外部第三方页面（Waffo sandbox cashier）可用 `'networkidle'`。

### 2. page.route() mock 范围

拦截 API 时 pattern 必须精确，**禁止使用会命中子路径的宽泛 glob**。

```typescript
// 正确：regex 明确排除 /topup/info 等子路径
await page.route(/\/api\/user\/topup(\?|$)/, handler);

// 错误：api/user/topup* 会同时拦截 /topup/info，导致前端收到错误数据白屏
await page.route(`${BASE}/api/user/topup*`, handler);
```

### 3. 超时设置

- **单个断言**（`toBeVisible`、`waitForSelector`）：`2000ms`（本地接口毫秒级）
- **弹窗/Modal 等待**（需要页面 API 请求完成再渲染）：`5000ms`
- **外部 Waffo sandbox 操作**：`30000ms`

### 4. 测试整体超时

全局 `timeout: 60_000`（`playwright.config.ts`）。

**需要 `test.slow()`（3× = 180s）的场景**：每个测试需要多次完整页面导航（登录 → 导航 → 操作），即使 API 是毫秒级，浏览器渲染 + React 初始化 + 多跳导航累积超过 60s。

```typescript
// 修改真实 DB 且每条用例都走完整导航链路的 describe
test.describe('TC-PM: ...', () => {
  test.slow(); // 登录+设置页+表单操作总耗时 >60s，需 3× 超时
  ...
});
```

### 5. 并行执行

`workers: 4` - 文件级并行（不同文件同时跑，同文件内顺序执行）。

**修改真实 DB 的文件必须串行**，在文件顶部加：

```typescript
// 文件顶部（所有 describe 之外）
test.describe.configure({ mode: 'serial' });
```

适用文件：`waffo-pay-methods-config.spec.ts`、`waffo-settings.spec.ts`。

### 6. baseURL = :3000

使用 Go 内嵌的 build 前端，不用 bun dev server (:5173)。

- bun dev 每个模块单独请求，设置页面冷启动 20-30s
- build 版本单一 bundle，加载 1-3s

**前端有改动时**，必须先 rebuild 再重启后端才生效：

```bash
cd web && DISABLE_ESLINT_PLUGIN=true VITE_REACT_APP_VERSION=$(cat ../VERSION) bun run build
cd .. && kill $(lsof -ti:3000)
nohup go run main.go > /tmp/new-api-server.log 2>&1 &
```

### 7. Auth 缓存

登录态缓存在 `e2e/.auth-state.json`。

- 缓存与 baseURL（origin）绑定。切换 `:5173` ↔ `:3000` 后必须删除缓存：`rm e2e/.auth-state.json`
- cookies 是 domain 级（无 port），localStorage 是 origin 级，两者切换 port 后行为不同
