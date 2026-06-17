# Codex 账号限流重置券（查询 + 消费）设计

- 日期：2026-06-17
- 分支：`worktree-codex-reset-credits`
- 参考来源：sub2api v0.1.137（commit `b816949`，`feat(openai-quota): query + reset rate-limit credits for OpenAI accounts`）

## 1. 背景与目标

OpenAI/ChatGPT(Codex) 账号除了滚动限流窗口（5 小时 / 每周）外，上游还提供一个**有限的「限流重置券」额度**（`rate_limit_reset_credits.available_count`）。撞限流后可以主动消费一张券，立即重置当前限流窗口，而无需等待窗口自然恢复。

本功能让管理员在**渠道页面 →「账户信息」弹窗（「Codex 账户和用量」）**内：

1. 查看该 Codex 账号当前剩余重置券数量；
2. 手动消费一张券（二次确认后）立即重置限流，并实时刷新用量。

非目标（YAGNI）：不在渠道表格列、不在 `/api/data/codex/limits` 批量报表、不在「Codex 模型治理」页做任何展示，仅限上述单账号弹窗。

## 2. 上游接口事实（已从 sub2api 源码 + 真实响应核实）

### 2.1 查询（已有链路，无需新增上游调用）

`GET {baseURL}/backend-api/wham/usage` 响应已含：

```json
"rate_limit_reset_credits": { "available_count": 0 }
```

new-api 现有的 `GetCodexChannelUsage`（`controller/codex_usage.go`）已经把上游 `data` 整个透传到前端响应的 `data` 字段，因此 `available_count` **已经在前端可见**，展示侧无需改后端。

### 2.2 消费（新增上游调用）

- 方法/URL：`POST {baseURL}/backend-api/wham/rate-limit-reset-credits/consume`
- Headers（照抄 sub2api 已验证的 Codex Desktop 头集）：
  - `Authorization: Bearer <access_token>`
  - `chatgpt-account-id: <account_id>`
  - `content-type: application/json`
  - `originator: Codex Desktop`
  - `oai-language: zh-CN`
  - `accept: application/json`
  - `sec-fetch-site: none`、`sec-fetch-mode: no-cors`、`sec-fetch-dest: empty`
  - `priority: u=4, i`
- Body：`{"redeem_request_id": "<uuid-v4>"}`，UUID 由 `common.GetUUID()` 生成（`github.com/google/uuid v1.6.0` 已在依赖）
- 响应：
  ```json
  { "code": "...", "credit": { "id": "...", "reset_type": "...", "status": "...", "granted_at": "...", "expires_at": "...", "redeem_started_at": "...", "redeemed_at": "..." }, "windows_reset": 1 }
  ```
  `windows_reset` 为被重置的窗口数，可用于成功提示。

## 3. 架构

```
弹窗「Codex 账户和用量」(codex-usage-dialog.tsx)
  ├─ 展示  ← GET  /api/channel/:id/codex/usage        （已存在；前端多读一个字段）
  └─ 消费  → POST /api/channel/:id/codex/reset-credit  （新增）
                └─ controller.ConsumeCodexResetCredit
                     └─ service.ConsumeCodexResetCredit
                          └─ 上游 POST /backend-api/wham/rate-limit-reset-credits/consume
```

复用现有 codex usage 链路与 401/403 刷 token 重试骨架，不新建子系统。

## 4. 后端改动

### 4.1 `service/codex_reset_credit.go`（新建）

仿 `service/codex_wham_usage.go`：

```go
func ConsumeCodexResetCredit(
    ctx context.Context, client *http.Client,
    baseURL, accessToken, accountID string,
) (statusCode int, body []byte, err error)
```

- 参数校验（client/baseURL/accessToken/accountID 非空）与 `FetchCodexWhamUsage` 一致。
- 按 2.2 设置 method/URL/headers/body；body 经 `common.Marshal`（Rule 1）。
- 返回 `statusCode, body, err`，由 controller 处理刷 token 与透传。

### 4.2 `controller/codex_usage.go`

- 把 `fetchCodexChannelUsageRefresh` 中「解析 OAuthKey → proxy client → 调上游 → 401/403 刷 token + 持久化 + refreshed 信号」的骨架抽成可复用内部 helper（如 `runCodexChannelUpstreamRefresh`），让 usage 与 consume 共用，避免复制粘贴。
- 新增 `ConsumeCodexResetCredit(c *gin.Context)`：解析 `:id` → 取 channel → 经 helper 调 `service.ConsumeCodexResetCredit` →（如发生 token 刷新则 `rebuildCodexChannelCache`）→ 返回 `{success, upstream_status, data}`，`data` 为上游 JSON。
- 与 `GetCodexChannelUsage` 一致地拒绝非 Codex 类型、multi-key 渠道。

### 4.3 `router/api-router.go`

在 `:id/codex/usage`（line 276）后新增：

```go
channelRoute.POST("/:id/codex/reset-credit", controller.ConsumeCodexResetCredit)
```

`channelRoute` 已位于 AdminAuth 组，权限自动到位。

## 5. 前端改动

### 5.1 `web/default/src/features/channels/components/dialogs/codex-usage-dialog.tsx`

- `CodexUsagePayload` 增 `rate_limit_reset_credits?: { available_count?: number }`。
- 账户摘要卡片（约 444–496 行）「刷新」按钮旁新增：
  - `StatusBadge`：`剩余重置次数: N`（N=`available_count ?? 0`；0 时 danger 变体）。
  - `消费一次重置` 按钮（仿「刷新」按钮样式，`variant='outline' size='sm'`，lucide 图标）。**仅 `available_count>0` 可点**，否则 `disabled`；`isConsuming` 期间 `disabled`。
- 点击 → 弹**二次确认 Dialog**：显示账号邮箱 + 当前剩余次数 + 文案「将消费 1 次重置券，立即重置限流窗口」。确认后才调接口。
- 成功：toast「已重置 N 个窗口」（N=`windows_reset`），并触发 `onRefresh` 重新拉取 usage，刷新 badge 与窗口。
- 新增 props：`onConsume?: () => void`、`isConsuming?: boolean`（与 `onRefresh/isRefreshing` 对称）。

### 5.2 `web/default/src/features/channels/api.ts`

新增 `consumeCodexReset(channelId)` → `POST /api/channel/${channelId}/codex/reset-credit`，仿 `refreshCodexCredential`（含 `channelActionConfig({ disableDuplicate: true })`）。

### 5.3 两处挂载点接线

- `channels-columns.tsx`（约 413 行 `<CodexUsageDialog>`）：加 `codexConsuming` 状态 + `onConsume` 调 `consumeCodexReset` → 成功后 refetch usage。
- `dialogs/balance-query-dialog.tsx`（约 142 行）：同样接 `onConsume/isConsuming`。**两处必须同时改**，否则编译错或行为不一致。

### 5.4 i18n

新增 key（英文源串即 key）写入 `web/default/src/i18n/locales/` 全部 8 个文件并**真实翻译**（禁止英文占位）：

- `Remaining Resets`（剩余重置次数）
- `Consume one reset`（消费一次重置）
- `Reset rate limit now?`（确认标题）
- `This will consume 1 reset credit and immediately reset the rate limit window.`（确认正文）
- `Reset {{count}} windows`（成功提示，i18next 插值 `{{count}}`）
- 如有「无可用重置券」禁用提示文案等。

改完在 `web/default/` 跑 `bun run i18n:sync`，提交前检查 `locales/_reports/{lang}.untranslated.json` 不含本次新增 key。

## 6. 错误处理与边界

- 上游非 2xx：透传 `upstream_status` + message，前端 toast 报错，不刷新用量。
- 401/403：自动刷 token 重试一次（与 usage 一致）；刷新成功后持久化新 key，必要时 `rebuildCodexChannelCache`。
- `available_count=0`（如 #17 账号）：按钮 disabled。
- `rate_limit_reset_credits` 字段缺失：视为 0。
- 重复点击：`isConsuming` 期间禁用 + `disableDuplicate`。
- multi-key 渠道：沿用现有「不支持」拦截。

## 7. 安全与 whitelabel

- 写操作走 AdminAuth（路由组已具备）+ 前端二次确认。
- 日志不打印 access_token。
- 不在响应/日志泄露上游 host 或真实模型名，仅透传上游 JSON（沿用现有 usage 透传策略）。

## 8. 测试

- 后端 `service`：`httptest` mock 上游，断言请求 method/URL/headers/body（含 `redeem_request_id`），覆盖 2xx / 4xx；controller 层覆盖 401→刷新→重试路径。
- 前端：弹窗按 `available_count` 渲染 badge 与禁用态、二次确认流程、成功后触发 refetch、错误 toast。
- 构建：`go build ./...`、`go vet`，前端 `bun run build` + i18n 报告检查。

## 9. 变更文件清单

后端：
- `service/codex_reset_credit.go`（新建）
- `controller/codex_usage.go`（抽 helper + 新 handler）
- `router/api-router.go`（+1 路由）

前端：
- `web/default/src/features/channels/components/dialogs/codex-usage-dialog.tsx`
- `web/default/src/features/channels/api.ts`
- `web/default/src/features/channels/components/channels-columns.tsx`
- `web/default/src/features/channels/components/dialogs/balance-query-dialog.tsx`
- `web/default/src/i18n/locales/*.json`（8 个）
