# 下游平台余额查询 — 调研结论与统一查询设计

> 调研日期：2026-06-13。目标：把"每个下游平台还剩多少余额"变成网关里一处可看、可定时刷新、可告警的能力。
> 本文基于对全部真实上游的**逐个实测**（用生产渠道的真实 key 调用，非猜测）。

## 一、关键背景：余额查询按"上游"路由，不是按渠道类型

现有 `controller/channel-billing.go` 的余额查询用 `switch channel.Type` 分发。但本网关真实对接的下游是一批**中转站**，它们在渠道表里几乎都是同几种类型（type 1 OpenAI / 58 OpenAI Video / 59 ListenHub / 24 Gemini / 40 SiliconFlow）。`channel.Type` 无法区分 bltcy / xgapi / manxiaobai（都是 type 1/58）。

**因此余额查询必须按 `base_url` 或 `channel.Other` hint 路由**，与视频 provider 模式（`relay/channel/task/openaivideo/provider.go` 的 `getProviderByHint`）完全一致。

去重：同一上游账号常挂多个渠道（bltcy 3 个、apexer 3 个、manxiaobai 3 个共用同一 key），按 `(base_url, key)` 查一次即可，结果映射回各渠道。

## 二、实测结论：三档可查性

### A 档 — 纯 API key 可查"真实剩余余额"（用户真正想要的）

| 上游 | 渠道 | 接口 | 认证 | 余额字段 | 实测值 |
|------|------|------|------|----------|--------|
| **lk888**（api.lk888.ai/api） | 11 | `GET {base}/v1/skills/balance` | `Bearer <key>` | `balance`（单位 `算力`）+ `api_key_quota.used` | 剩 8.27 算力 |
| **siliconflow** | 13 | `GET /v1/user/info` | `Bearer <key>` | `data.totalBalance` | 已实现 |
| **listenhub/marswave**（api.marswave.ai/openapi） | 12 | `GET /openapi/v1/user/subscription` | `Bearer <key>` | `data.totalAvailableCredits`（credits）+ 月度/永久/限时分项 + `subscriptionExpiresAt` | 剩 5 credits |

> siliconflow 已在 `updateChannelSiliconFlowBalance()` 实现；lk888、listenhub 需新增。
> ListenHub 文档：https://listenhub.ai/docs/en/openapi/api-reference/subscription

### B 档 — new-api 套壳站：key 是无限额度 token，**只能查累计消费，查不到钱包余额**

涉及：**bltcy**（ch1/2/3）、**apexer**（ch4/6/7）、**xgapi**（ch5/14）、**qilin/937qq**（ch8）、**manxiaobai**（ch15/16/17）。

这些站发给我们的渠道 key 都是 `unlimited_quota: true` 的令牌，导致：

| 接口 | 返回 | 能用吗 |
|------|------|--------|
| `GET /v1/dashboard/billing/usage` | `{"total_usage": N}`，N 单位 0.01 USD（÷100=USD）= **累计消费额** | ✅ 唯一有效信息 |
| `GET /v1/dashboard/billing/subscription` | `soft/hard_limit_usd = 100000000`（无限额度哨兵，假值） | ❌ 无意义 |
| `GET /api/usage/token/` | `total_granted:0`、`total_available` 为负的已用量、`unlimited_quota:true` | ❌ 无钱包余额 |

实测累计消费：bltcy ≈ $9.29、apexer ≈ $6.02、xgapi ≈ $9.34、qilin ≈ $40.90、manxiaobai 已用 $9.58。

**要拿真实钱包余额，必须走登录态**（已用 manxiaobai 账密验证通）：

```
POST {base}/api/user/login   {"username","password"}     → 返回 user.id + 写入 session cookie
GET  {base}/api/user/self     带 cookie + 头 New-Api-User:<id>  → data.quota（÷500000 = USD）= 真实余额
```

> 仅 manxiaobai 在 `deployment.local.md` 里存了账密。bltcy/apexer/xgapi/qilin 目前只有 API key，没有控制台账密；要查它们的真实余额需要补登录凭据（账密，或在各站"个人设置"里生成的"系统访问令牌"）。

### C 档 — 无 key 接口，只能登录 web 控制台

| 上游 | 渠道 | 说明 |
|------|------|------|
| **hongniao/红鸟**（open.hongniaoai.com） | 9 | Express 风格中转，`/api/*` 余额端点全 404，`/user/info` `/billing` 直接返回前端 SPA；余额只在 web 控制台可见 |
| **runway** | 10 | `127.0.0.1:8787` 本机适配器，非付费上游，N/A |

## 三、统一查询设计

### 3.1 余额 provider 注册表（替换 type switch）

新增 `controller/channel-billing.go` 之外的 `relay/channel/balance/`（或在 billing 文件内）一个 provider 注册表，**与视频 provider 同构**：

```go
type BalanceResult struct {
    Kind      string  // "balance" 真实余额 | "spend_only" 仅累计消费 | "console_only" 仅控制台
    Remaining float64 // 剩余（Kind=balance 时有效）
    Used      float64 // 累计消费（可选，所有档都尽量填）
    Unit      string  // "USD" | "CNY" | "算力" | "credits"
    ExpiresAt int64   // 订阅/到期（listenhub 有）
    Raw       string  // 原始响应留档，便于排查
}

type BalanceQuerier interface {
    Name() string
    Match(ch *model.Channel) bool                                    // base_url / channel.Other hint
    Query(c *gin.Context, ch *model.Channel, cli *http.Client) (*BalanceResult, error)
}
```

注册的 provider：
1. `newapiSpendProvider` — bltcy/apexer/xgapi/qilin/manxiaobai 的 key 模式：`/v1/dashboard/billing/usage` → `Used`，`Kind=spend_only`。
2. `newapiConsoleProvider` —（可选，需账密/系统令牌）登录 → `/api/user/self` → `Remaining`，`Kind=balance`。命中条件：渠道 `setting.balance` 里配置了登录凭据。
3. `lk888Provider` — `/v1/skills/balance` → `Remaining`（算力）+ `Used`。
4. `listenhubProvider` — `/openapi/v1/user/subscription` → `Remaining`（credits）+ `ExpiresAt`。
5. `siliconflowProvider` — 复用现有实现。
6. hongniao → 不注册 provider，前端显示"仅控制台可查"；runway → 跳过。

分发器：先按 provider `Match` 命中走专用逻辑，未命中再退回现有 OpenAI billing 默认流程。

### 3.2 凭据存储

new-api 套壳站要查真实余额需要 API key 之外的登录凭据。利用渠道已有的 `setting`（JSON）字段，新增约定段：

```json
{ "balance": { "mode": "newapi_console",
               "login": { "username": "...", "password": "..." } } }
```

或 `{"balance":{"mode":"system_token","token":"<用户级系统访问令牌>"}}`（不存明文密码，更安全；令牌在各站个人设置页生成）。
没有该配置的套壳站默认走 `spend_only`。

### 3.3 数据模型

渠道表已有 `Balance` + `BalanceUpdatedTime`。建议把 `Balance` 语义扩展为：
- A 档/登录态：存真实剩余余额；
- B 档纯 key：`Balance` 存累计消费（带 `Kind=spend_only` 标记，前端用不同颜色/文案区分"已消费"而非"剩余"）。

可在 `setting.balance` 里额外存 `recharged`（用户手填的累计充值额），前端据此估算 `剩余 ≈ 充值 − 累计消费`，弥补 B 档拿不到钱包余额的缺口。

### 3.4 触发与刷新

- 复用现有 `UpdateChannelBalance` / `UpdateAllChannelsBalance`（`/api/channel/update_balance[/:id]`）+ 定时任务 `AutomaticallyUpdateChannels`（`CHANNEL_UPDATE_FREQUENCY`）。
- 批量刷新前按 `(base_url, key)` 去重，避免同一账号被查多次。

### 3.5 展示

- **后台渠道列表**：每行余额单元格显示 `剩余 + 单位`（A 档/登录态）或 `已消费 + 单位 + ⚠仅消费` 徽标（B 档）或 `仅控制台`（C 档）+ 更新时间。
- **新增"下游余额总览"面板**：按上游平台聚合（去重后一平台一行），列：平台 / 余额或累计消费 / 单位 / 到期 / 状态 / 更新时间；余额低于阈值标红。

### 3.6 告警（与现有机制打通）

- 余额低于阈值，或上游返回 402/quota（已被 `isRetryableUpstreamQuotaError` 捕获并触发 `model/channel_cooldown.go` 冷却）时推送通知——**quota 冷却本身就是"该上游没钱了"的最强信号**，把冷却事件接入余额告警即可零成本拿到"余额耗尽"提醒。

## 四、落地状态（2026-06-13）

后端 provider 注册表已实现并对全部真实上游实网验证通过：

| 优先级 | 事项 | 状态 | 实测 |
|--------|------|------|------|
| 1 | provider 注册表（按 base_url/Other 路由，先于 type switch） + lk888 / listenhub 两个 A 档 provider | ✅ 已实现 | lk888 剩 8.27 算力；listenhub 剩 5 credits |
| 2 | newapi spend provider（哨兵检测→累计消费） | ✅ 已实现 | bltcy 已消费 $9.29；qilin $40.90；hongniao 正确判为"仅控制台" |
| 3 | newapi console provider（账密登录 → /api/user/self 真实钱包余额） + `setting.balance_query` 凭据 | ✅ 已实现 | manxiaobai 登录态查通（备用账号 quota=0） |
| 4a | 前端余额列按三档（剩余/⚠仅消费/仅控制台）区分展示 + 单位 | ✅ 已实现 | tsc/eslint 通过 |
| 4b | EditChannel 加"下游余额查询"配置（模式/账密/累计充值） | ✅ 已实现 | tsc/eslint 通过 |
| 4c | 余额总览（后端聚合接口 `GET /api/channel/balance_overview`，按上游去重，一次查全） | ✅ 已实现 | 集成测试实查 10 个上游全通过 |
| 4d | 前端总览面板（可选，复用上面接口）+ 低余额告警接入 quota 冷却 | ⬜ 待做（可选） | — |

> 前端构建依赖完整 `node_modules`（需 `bun install`）；本环境缺 `@fontsource-variable/lora` 字体包导致 `rsbuild build` 失败，与本改动无关（`tsc -b` 与 eslint 均通过）。

### 实现位置

| 文件 | 说明 |
|------|------|
| `controller/channel_balance_provider.go` | 余额 provider 注册表、三档语义、lk888/listenhub/newapi 三个 provider、登录态查询、结果落 OtherInfo |
| `controller/channel-billing.go` | `updateChannelBalance` 开头优先走 provider；`UpdateChannelBalance` 响应增加 kind/unit/used/remaining/provider |
| `dto/channel_settings.go` | `ChannelSettings.BalanceQuery`（mode/账密/系统令牌/已充值额） |
| `controller/channel_balance_provider_test.go` | 实网验证测试（`LIVE_BALANCE_TEST=1` 开启，凭据从环境变量读取） |
| `web/default/.../lib/channel-utils.ts` | 前端 `parseBalanceMeta` / `formatBalanceWithUnit` 三档解析与单位格式化 |
| `web/default/.../components/channels-columns.tsx` | 余额列按三档展示（剩余/⚠仅消费/仅控制台） |
| `web/default/.../lib/channel-form.ts` + `components/drawers/channel-mutate-drawer.tsx` | EditChannel "下游余额查询"配置表单（模式/账密/累计充值） |
| `web/default/.../types.ts` + `i18n/locales/zh.json` | `ChannelSettings.balance_query` 类型 + 中文翻译 |

### 结果落库字段（渠道 OtherInfo）

`balance_kind`（balance/spend_only/console_only）、`balance_unit`、`balance_used`、`balance_remaining`、`balance_provider`、`balance_expires_at`、`balance_checked_time`。
渠道 `Balance` 列：A 档/登录态存真实剩余；spend_only 档存"已充值−累计消费"估算值（未填充值则存累计消费占位，保持为正以免被余额≤0 自动禁用误伤）。

### 给套壳站配登录凭据拿真实余额（可选）

在渠道 `setting`（JSON）里加：

```json
{ "balance_query": { "mode": "newapi_console",
                     "username": "<下游站账号>", "password": "<密码>",
                     "recharged": 0 } }
```

未配置时套壳站默认走 spend_only（只显示累计消费）。`recharged` 选填，用于让 spend_only 档估算"剩余 ≈ 充值 − 已消费"。

### 用法

- 单渠道：`GET /api/channel/update_balance/:id` → 返回 `{balance, kind, unit, used, remaining, provider}`。
- 全部刷新：`GET /api/channel/update_balance`；定时刷新沿用 `CHANNEL_UPDATE_FREQUENCY`。
- **一次查出所有下游余额（推荐，后端聚合）**：`GET /api/channel/balance_overview`（AdminAuth）。
  - 按 `(base_url, key)` 去重——同账号多渠道（bltcy 3 个 / manxiaobai 3 个 / apexer 3 个 / xgapi 2 个）只查一次。
  - `?cached=true` 只读已存储余额（不发上游请求，秒回）；`?include_disabled=true` 连同禁用渠道一起查。
  - 返回 `data[]`，每项含 `base_url / channel_ids / channel_names / provider / kind / remaining / used / unit / expires_at / recharged / est_remaining / checked_time / error`。
  - `kind`：`balance`（真实余额）/`spend_only`（仅累计消费）/`console_only`（仅控制台）/`unknown`。

实测返回示例（节选）：

```json
{"success":true,"data":[
  {"base_url":"https://api.lk888.ai/api","channel_ids":[11],"provider":"lk888","kind":"balance","remaining":8.27,"used":2.03,"unit":"算力"},
  {"base_url":"https://api.marswave.ai/openapi","channel_ids":[12],"provider":"listenhub","kind":"balance","remaining":5,"unit":"credits","expires_at":1795799704},
  {"base_url":"https://api.bltcy.ai","channel_ids":[1,2,3],"provider":"newapi","kind":"spend_only","used":9.286388,"unit":"USD"},
  {"base_url":"http://www.937qq.cn","channel_ids":[8],"provider":"newapi","kind":"spend_only","used":40.899,"unit":"USD"},
  {"base_url":"https://open.hongniaoai.com/v1","channel_ids":[9],"kind":"console_only","error":"该上游不支持 API 余额查询，仅 web 控制台可查"}
]}
```

curl：

```bash
curl -s "http://<网关>/api/channel/balance_overview" \
  -H "Authorization: Bearer <管理员令牌>" | jq .
```

## 五、一句话结论

10 个真实上游里：**3 个（lk888 / siliconflow / listenhub）纯 key 就能查真实余额**；**5 个 new-api 套壳站（bltcy/apexer/xgapi/qilin/manxiaobai）的 key 只能查累计消费，真实钱包余额必须补登录凭据走登录态**；**hongniao 只能登录控制台、runway 无关**。统一方案 = 按 base_url 路由的余额 provider 注册表（与视频 provider 同构）+ 三档语义（真实余额/累计消费/仅控制台）+ 复用现有刷新与 quota 冷却做告警。
