# 渠道调用成本与利润分析功能设计

- 日期：2026-08-16
- 仓库：e:\new-api（QuantumNous/new-api fork）
- 状态：已确认（用户批准方案 A）

## 1. 背景与目标

运营者需要了解每个渠道（上游供应商）的真实调用成本，进而在数据看板中查看利润/亏损及明细。

目标：
1. 渠道可配置"调用成本"：折扣模式（对模型原始定价乘系数，与分组折扣机制一致）或固定价格模式（每次调用固定成本）。
2. 每次调用在日志落库时计算出成本与利润，管理员可在：
   - 数据看板查看"利润分析"（总营收 / 总成本 / 总利润 / 利润率 + 按渠道、按模型明细）；
   - 用量日志页面查看每条记录的成本 / 利润；
   - 渠道列表页查看每个渠道的成本配置与成本 / 利润汇总。
3. 渠道可复用已有"上游定价同步"逻辑，将上游价格同步为模型定价后，通过折扣系数使成本与上游完全一致。

### 产品决策（用户已确认）

- 成本配置粒度：**渠道级统一配置**（一个渠道一个配置，作用于该渠道全部模型）。
- 展示位置：数据看板新增区块 + 用量日志页面 + 渠道列表页。
- 计费基准：**沿用模型当前定价**（折扣模式 = 当前模型定价 × 折扣系数，不含分组倍率）。

## 2. 总体架构

```
渠道编辑(调用成本配置) ──► channels.cost_config (JSON)
                                    │
                        用户请求转发 / 结算
                                    │
              RecordConsumeLog / RecordTaskBillingLog（中心化计算点）
              ┌────────────────────────────────────────────┐
              │ 成本 = 用户实付quota ÷ 分组倍率 × 折扣系数    │
              │ 或 固定价格 × QuotaPerUnit                   │
              │ 写入 logs.cost_quota + Other.admin_info 快照 │
              └────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
  数据看板「利润分析」          用量日志「成本/利润列」        渠道列表「成本配置/利润汇总」
  /api/data/channel_profit 聚合 logs 表
```

核心原则：**成本只在日志落库时计算并存储一次**，所有展示面读取 `logs.cost_quota` 列聚合，不在其他计费路径逐个埋点。

## 3. 数据模型

### 3.1 channels 表新增列

`model/channel.go` 的 `Channel` 结构体新增：

```go
CostConfig string `json:"cost_config" gorm:"type:text"` // 渠道调用成本配置（JSON 字符串）
```

由主库 `DB.AutoMigrate(&Channel{})` 自动迁移（MySQL / SQLite / PostgreSQL）。

### 3.2 成本配置结构

新建 `relaykit/dto/channel_cost.go`：

```go
package dto

// ChannelCostMode 成本计算模式
type ChannelCostMode string

const (
    ChannelCostModeDiscount ChannelCostMode = "discount" // 折扣：对模型原始定价乘系数
    ChannelCostModeFixed    ChannelCostMode = "fixed"    // 固定价格：每次调用固定成本
)

// ChannelCostSettings 渠道调用成本配置（渠道级，作用于该渠道全部模型）。
// ModelPrices 为该渠道独立的"模型成本价格表"（per model，复用模型 ratio 体系），
// 由运营者一键从该渠道上游同步（仅该渠道已添加的模型），用于精确计算每模型成本。
type ChannelCostSettings struct {
	Enabled    bool                         `json:"enabled"`     // 是否启用成本核算
	Mode       ChannelCostMode              `json:"mode"`        // 计算模式
	Discount   float64                      `json:"discount"`    // 折扣系数（对模型成本价，不含分组倍率），默认 1
	FixedPrice float64                      `json:"fixed_price"` // 固定价格（美元/次）
	ModelPrices map[string]ChannelModelCost `json:"model_prices,omitempty"` // 模型成本价格表
}

// ChannelModelCost 单个模型在该渠道的成本价（复用模型 ratio 体系，与上游定价同步返回格式一致）。
type ChannelModelCost struct {
	ModelRatio           float64 `json:"model_ratio"`              // 按量计费的模型倍率
	ModelPrice           float64 `json:"model_price"`              // 按次/按图计费的模型价格（>0 时按次）
	CompletionRatio      float64 `json:"completion_ratio"`         // 补全倍率
	CacheRatio           float64 `json:"cache_ratio,omitempty"`    // 缓存读取倍率
	CreateCacheRatio     float64 `json:"create_cache_ratio,omitempty"`  // 缓存写入倍率
	ImageRatio           float64 `json:"image_ratio,omitempty"`    // 图像倍率
	AudioRatio           float64 `json:"audio_ratio,omitempty"`    // 音频倍率
	AudioCompletionRatio float64 `json:"audio_completion_ratio,omitempty"` // 音频补全倍率
}

func (s *ChannelCostSettings) Validate() error
```

校验规则：
- `Mode` 必须为 `discount` 或 `fixed`；
- `discount` 必须 `> 0`（建议上限 100，防误填）；
- `fixed_price` 必须 `>= 0`；
- `Enabled == false` 时忽略其余字段。

### 3.3 Channel 模型方法（model/channel.go）

与现有 `GetSetting()` / `SetSetting()` 模式一致：

```go
func (channel *Channel) GetCostSettings() dto.ChannelCostSettings
func (channel *Channel) SetCostSettings(settings dto.ChannelCostSettings)
```

非法 JSON 时回退为空配置（等价未启用），并在日志中记录解析错误。

### 3.4 logs 表新增列

`model/log.go` 的 `Log` 结构体新增：

```go
CostQuota int `json:"cost_quota" gorm:"default:0"` // 本次调用成本（额度单位，与 Quota 同量纲）
```

- 主库 / MySQL / SQLite / PostgreSQL 日志库：`AutoMigrate` 自动加列。
- ClickHouse 日志库：
  - 更新 `clickHouseLogCreateTableSQL` 增加 `cost_quota Int32 DEFAULT 0`（新装生效）；
  - 新增幂等迁移 `ALTER TABLE logs ADD COLUMN IF NOT EXISTS cost_quota Int32 DEFAULT 0`（旧装生效），在 `migrateClickHouseLogDB` 中调用。

## 4. 成本计算（后端）

### 4.1 成本计算策略（渠道价格表优先 + 回退）

成本计算核心在 `model/channel_cost.go`：

```go
// CalculateChannelCost 固定模式 / 反推模式兜底：
// 固定模式：成本 = FixedPrice × QuotaPerUnit（与用量无关）。
// 反推：成本 = 用户实付 quota ÷ 分组倍率 × 折扣系数（分组倍率 <= 0 时成本为 0）。
func CalculateChannelCost(settings *dto.ChannelCostSettings, quota int, groupRatio float64) int

// CalculateModelCost 渠道价格表全倍率精确计算（复刻全局计费算法，用渠道自己的 ratio）：
// - 该模型为 model_price（按次/按图）类型 → model_price × discount（每次调用）
// - 否则按 ratio 复刻：base(prompt − cache/cc/image/audio 分量) + 各分量×各自倍率 + completion×completion_ratio，
//   再 × model_ratio × discount；Claude 语义下缓存读/写分量不减 base
func CalculateModelCost(mc dto.ChannelModelCost, discount float64, promptTokens, completionTokens int, other map[string]interface{}) int
```

**resolveChannelCost 决策顺序（折扣模式）**：
1. 渠道价格表含该模型 → `CalculateModelCost` 全倍率精确；
2. 否则（未同步 / tiered_expr 日志）→ `CalculateChannelCost` 反推兜底（`quota ÷ 分组倍率 × 折扣`）。

为什么回退用"反推"：tiered_expr 计费、未同步模型无法用渠道表还原时，`quota = 模型原始价配额 × 分组倍率`，反推即还原模型原始价再乘折扣，逻辑上等价于"渠道折扣应用于全局价"。

日志落库时，`Other` 已由各计费路径写入全倍率明细（`cache_tokens`/`cache_ratio`、`cache_creation_tokens[_5m/_1h]`/`cache_creation_ratio[_5m/_1h]`、`image_output`/`image_ratio`、`audio_input`/`audio_output`/`audio_ratio`/`audio_completion_ratio`、`usage_semantic`），成本计算直接读取，实现中心化且全倍率精确。

### 4.2 日志落库接入点

在 `model.RecordConsumeLog` 与 `model.RecordTaskBillingLog` 内统一追加（修改集中在两个函数内部，调用方签名不变）：

1. 从 `params.Other["group_ratio"]` 读取分组倍率（float64）；缺失时回退 `ratio_setting.GetGroupRatio(params.Group)`。
2. `model.CacheGetChannel(params.ChannelId).GetCostSettings()` 读取渠道成本配置；获取失败或未启用 → `cost_quota = 0`。
3. `costQuota := service.CalculateChannelCost(...)`。
4. 写入 `Log.CostQuota`。
5. 将成本快照写入 `other["admin_info"]["channel_cost"]`：

```json
{ "mode": "discount", "discount": 0.8, "fixed_price": 0, "cost": 123, "profit": 456 }
```

快照仅对管理员可见：`formatUserLogs` 对普通用户剥离整个 `admin_info`；管理员接口 `GetAllLogs` 不剥离。成本为管理敏感信息，普通用户不可见。

### 4.3 模型包与 service 包依赖方向

`model.RecordConsumeLog` 需要调用成本计算。为保持现有依赖方向（service 依赖 model，model 不依赖 service），将纯计算函数 `CalculateChannelCost` 放在 **`model/channel_cost.go`**（不依赖 service），`model` 内部直接调用，不引入 model → service 依赖。

## 5. 利润聚合 API（后端）

新建 `controller/channel-profit.go`：

```
GET /api/data/channel_profit?start_timestamp=&end_timestamp=&channel_id=&model_name=
```

- 权限：管理员（`middleware.AdminAuth()`）。
- 查询 `logs` 表（LOG_DB），`type = LogTypeConsume`（=2），支持时间范围与渠道 / 模型过滤。
- SQL 兼容 MySQL / PostgreSQL / SQLite / ClickHouse。

响应结构：

```json
{
  "success": true,
  "data": {
    "summary": {
      "revenue": 1000, "cost": 600, "profit": 400,
      "profit_rate": 0.4, "count": 123
    },
    "by_channel": [
      {
        "channel_id": 1, "channel_name": "…",
        "revenue": 1000, "cost": 600, "profit": 400,
        "profit_rate": 0.4, "count": 123, "cost_enabled": true
      }
    ],
    "by_model": [
      { "model_name": "gpt-4o", "revenue": 800, "cost": 500, "profit": 300, "count": 100 }
    ]
  }
}
```

- `revenue = SUM(quota)`，`cost = SUM(cost_quota)`，`profit = revenue - cost`，`profit_rate = profit / revenue`（revenue 为 0 时取 0）。
- `by_channel` 用 `model.CacheGetChannel` 补渠道名与 `cost_enabled`（该渠道当前是否启用成本配置）。
- 路由注册：`router/api-router.go` 的 `/data` 分组下新增。

### 复用查询能力

`model` 新增 `SumChannelProfit(...)` 查询函数（放 `model/channel_cost.go` 或 `model/usedata.go`），controller 只做装配。

## 5.1 充值折扣让利纳入利润（用户确认）

**语义**：充值本身不产生利润（不是收入），只有折扣让利产生**亏损**（负利润）；该亏损由用户后续调用时通过渠道成本差价赚回，因此计入成本即可得到真实净利润。

**口径**（统一公式，用户确认）：

```
应给额度 = Money / Price × QuotaPerUnit        （Money = 订单实付金额，含全部折扣）
充值让利 = 实际给额 − 应给额度                   （仅记录正值让利；加价/克扣不记正利润，恒 ≤ 0）
```

- 充值数额折扣（AmountDiscount）：充 100 实付 90 → 让利 = 100 − 90 额度
- 用户组充值倍率（TopupGroupRatio）：>1 为加价（无让利）、<1 为折扣（产生让利）
- stripe/creem 订单 `Money` 为面额/产品固定价，按此口径恒为 0（无实际折扣差额）

**实现**：
- `RecordTopupLog` 增加 `creditedQuota int, money float64` 参数，`Log.Quota` 恒 0、`Log.CostQuota` 写让利；
- `SumChannelProfit` 聚合 `type IN (consume, topup)`，充值日志计入总成本；另汇总 `topup_concession`/`topup_count`；
- 前端摘要卡片新增"充值让利"卡（负值红色），按模型图表把空模型名行显示为"充值"；
- 历史充值不追溯（存量日志 cost_quota 为 0）。

## 5.2 订阅盈亏（用户确认纳入）

**语义**：订阅与充值同口径——平台实收折合额度 vs 送出的套餐配额，超出部分即让利（成本）；订阅用户调用时 `logs.quota` 仍按模型标价记账（资金来源为订阅配额），调用侧利润已覆盖其配额消耗，因此购买时记一次让利即可闭环。

```
订阅让利 = 套餐配额(plan.TotalAmount) − 实付折合(Money/Price×QuotaPerUnit)
无限配额（TotalAmount=0）无法量化 → 让利 0
```

**实现**：
- `CompleteSubscriptionOrder`（付费订阅）与 `PurchaseSubscriptionWithBalance`（余额订阅）的 `RecordLog(LogTypeTopup)` 改为 `RecordTopupLog(..., int(plan.TotalAmount), money)`；
- 管理员绑定（`AdminBindSubscription`）不记（无支付，属内部操作，避免污染利润）。

**其他给额度路径盘点**（未纳入本次范围，供后续决策）：兑换码 `Redeem`、新用户赠送 `QuotaForNewUser`、邀请奖励 `QuotaForInviter/QuotaForInvitee`——均为平台免费送出额度，严格意义上也是成本（让利），如需计入可复用同一公式（实收 0 → 让利 = 送出额度）。

## 6. 前端设计

统一风格：复用现有组件（`SideDrawerSection`、`Form` 表单族、`Badge`、`StatCard`、`PanelWrapper`、`FadeIn` 动画、VChart 图表），保证与整体设计、动画一致。所有新增文案写入 i18n 各语言包（en/zh/zh-TW/fr/ja/ru/vi），键名遵循现有命名习惯。

### 6.1 渠道编辑抽屉：「调用成本」区块

- 新建 `web/src/features/channels/components/drawers/sections/channel-cost-section.tsx`，并在 `sections/index.ts` 导出。
- 在 `channel-mutate-drawer.tsx`：
  - `CHANNEL_EDITOR_SECTION_IDS` 新增 `cost`；
  - 左侧导航新增"Call Cost"项（图标 `Percent` 或 `Coins`，风格同现有）；
  - 正文新增一个 section 容器（`id=channel-section-cost`），置于"Models & Groups"之后。
- 表单字段（并入 `ChannelFormValues`，JSON 序列化到 `cost_config`）：
  - 启用开关（Switch）；
  - 模式选择（`discount` / `fixed`，使用 Select）；
  - 折扣模式：折扣系数输入（NumberInput，>0，placeholder `1.0`），辅助文案"成本 = 模型定价 × 折扣系数（不含分组倍率）"；
  - 固定模式：固定价格输入（NumberInput，美元/次）；
  - 提示文案：与「系统设置 → 分组与模型定价 → 上游定价同步」配合使用说明 + 「前往同步上游定价」链接按钮。
- 表单 schema（zod）在 `channel-form.ts` / `channel-form-errors.ts` 扩展校验；`transformChannelToFormDefaults` 解析 `cost_config`；提交时序列化回字符串。
- 权限：成本配置属运营信息，不划入 `SENSITIVE_FORM_FIELDS`（非敏感字段），但仅管理员可编辑（沿用现有编辑器角色校验）。

### 6.2 数据看板：「利润分析」区块（管理员）

- `web/src/features/dashboard/section-registry.tsx` 新增 section `profit`（`adminOnly: true`，标题 "Profit Analysis"）。
- `dashboard/index.tsx` 新增 `profit` 分支与懒加载组件、fallback 骨架屏。
- 组件（`web/src/features/dashboard/components/profit/`）：
  - `profit-summary-cards.tsx`：总营收 / 总成本 / 总利润 / 利润率四张卡片（复用 `StatCard` 或 `summary-cards` 风格，`FadeIn` 动画）；
  - `channel-profit-table.tsx`：按渠道表格（渠道名、调用次数、营收、成本、利润、利润率、成本配置徽章），利润列正负着色（绿 / 红）；
  - `model-profit-chart.tsx`：按模型利润横向柱状图（VChart，复用 `use-chart-theme`）；
  - `profit-section.tsx`：组装区块，时间范围复用 `ModelsFilter` 的 filters。
- `dashboard/api.ts` 新增 `getChannelProfit(params)` 调 `/api/data/channel_profit`；`dashboard/types.ts` 新增响应类型。

### 6.3 用量日志页面（管理员）

- `usage-logs` 数据 schema（`data/schema.ts`）与类型补充 `cost_quota`。
- 列：管理员视图新增「Cost」「Profit」两列（`common-logs-columns.tsx`），复用 `log-cost-display.tsx` 的金额展示风格；利润正负着色。
- 详情弹窗（`details-dialog.tsx`）：展示成本明细（模式 / 折扣系数 / 固定价格 / 成本 / 利润），数据来自 `Other.admin_info.channel_cost`。

### 6.4 渠道列表页

- `channels-columns.tsx` 新增「Call Cost」列（管理员）：
  - 徽章展示成本状态（未启用 / 折扣 ×系数 / 固定价 $x/次）；
  - 单元格内展示该渠道累计利润（绿/红），数据来自 `/api/data/channel_profit`（不传时间范围 = 全部时间）按 channel_id 映射。
- 数据获取：`channels/api.ts` 新增查询（管理员时并行请求利润聚合），`channels-provider` 或列表页注入。

### 6.5 上游定价同步联动（复用已有逻辑）

- 复用已有：`fetchUpstreamRatios`（`POST /api/ratio_sync/fetch`）、`upstream-ratio-sync` 组件（已支持按渠道选择同步模型定价）。
- 渠道编辑「调用成本」区块的「前往同步上游定价」按钮：跳转 `系统设置 → 分组与模型定价 → 上游定价同步` 并尝试默认选中当前渠道（通过查询参数传递 channel id；若该页不支持选中则仅跳转页面并提示手动选择）。
- 同步完成后，运营者设置折扣系数 `1.0`（或按需）即可使渠道成本与上游价格一致。
- 后端零新增逻辑，仅前端入口复用。

## 7. 迁移与兼容

| 变更 | 迁移方式 |
| --- | --- |
| channels.cost_config | 主库 AutoMigrate 自动加列 |
| logs.cost_quota | 日志库 AutoMigrate（MySQL/SQLite/PG）；ClickHouse 新装 SQL + 幂等 ALTER 兼容旧装 |
| 存量日志 | 不回溯计算成本，`cost_quota` 默认 0（仅在后续调用产生） |

## 8. 上游同步友好性（fork 维护策略）

用户的 fork 需要应对"PR 不被合并、独立同步官方更新"的场景。为降低后续 rebase / merge 冲突：

1. **新增逻辑尽量放新文件**：
   - `relaykit/dto/channel_cost.go`
   - `model/channel_cost.go`（含成本计算与利润聚合查询）
   - `controller/channel-profit.go`
   - 前端各新增组件文件独立成文件。
2. **对既有文件的改动最小化、局部化**：
   - `model/channel.go`：仅加 1 个字段 + 2 个方法；
   - `model/log.go`：仅加 1 个字段 + 在 `RecordConsumeLog` / `RecordTaskBillingLog` 末尾追加若干行；
   - `model/main.go`：ClickHouse create/alter 各 1 处；
   - `router/api-router.go`：加 1 条路由；
   - `channel-mutate-drawer.tsx`：加 1 个 section id、1 个导航项、1 个 section 容器；
   - `dashboard/index.tsx` / `section-registry.tsx`：加 1 个 section；
   - 其余前端文件为独立新文件或小改。
3. 保持现有命名与代码风格（如 `GetXxx`/`SetXxx`、`GenerateXxxOtherInfo`、zod schema 约定），不引入新的依赖。

## 9. 测试计划

### 后端（Go）

- `model/channel_cost_test.go`：
  - 折扣模式：正常 quota ÷ ratio × discount；
  - 折扣模式 + group_ratio=0 → 0；
  - 固定模式 → 固定价 × QuotaPerUnit；
  - 未启用 → 0；
  - 向下取整 / 非负；
- `relaykit/dto/channel_cost_test.go`：`Validate()` 各非法分支。
- `model/channel_profit_test.go`（sqlite 内存库）：插入多条消费日志（含/不含 cost_quota），断言 summary / by_channel / by_model 聚合正确。

### 前端（vitest）

- 渠道表单 schema：`channel-form` 校验（模式 / 数值范围 / 序列化）。
- 利润表格 / 徽章 / 成本列渲染（正负着色、未配置占位）。
- 现有测试模式（`*.test.ts(x)`）保持一致。

## 10. 风险与边界

- 成本基于"沿用模型当前定价"，历史日志不会随模型调价而回溯，但展示口径一致（均为落库时定价）。
- `quota ÷ 分组倍率` 反推在 quota clamp（额度饱和）等极端场景下存在轻微失真，属可接受边缘情况。
- ClickHouse 旧库升级需执行一次幂等 ALTER，文档 / 发布说明中注明。
- 成本快照存 `admin_info`，若未来官方调整 `formatUserLogs` 的剥离逻辑需回归确认。
