# 用户节省趋势图设计方案

> 状态：已实施并完成桌面/移动端验证（2026-07-28）
> 前置设计：`docs/user-savings-estimate-design.md`
> 适用页面：用户仪表盘「模型调用分析」
> 数据口径：估算，不作为财务账单

## 1. 目标

在不增加概览页信息密度的前提下，让用户直观看到同一批可估算请求在官方定价和实际扣费之间的差异，并回答三个问题：

1. 最近一段时间实际节省了多少人民币。
2. 官方价格与实际消费的差距如何随时间变化。
3. 当前结果覆盖了多少请求，是否包含按当前价格回算的历史日志。

## 2. 设计结论

- 不在概览右栏增加图表；概览继续只显示近 24 小时节省金额和覆盖率。
- 在现有 `/dashboard/models`「模型调用分析」中增加一个全宽“成本对比”面板。
- 面板放在统计卡片和管理员性能概览之后、现有消费分布图之前。
- 一期只实现一张趋势图，不增加一级导航、饼图、仪表盘或动画累计数字。
- 概览节省块增加箭头图标入口，跳转到 `/dashboard/models`；趋势面板位于页面前部，不依赖异步组件挂载后的锚点滚动。
- 二期再评估“按模型节省排行”，不与一期接口强行合并。

## 3. 展示口径

### 3.1 指标定义

图表中的两条金额序列必须基于同一批成功估算的请求：

```text
官方价估算 = eligible logs 的 official_quota 之和
实际消费   = eligible logs 的 actual_quota 之和
估算节省   = eligible logs 的 max(official_quota - actual_quota, 0) 之和
覆盖率     = estimated_request_count / request_count
节省率     = savings_quota / official_quota
```

`actual_quota` 不是时间范围内全部消费，只是已覆盖请求的实际消费。前端不得将它标成“总消费”，避免覆盖率不足时误导用户。

节省金额在单请求维度钳制为非负数后再汇总，因此汇总的 `savings_quota` 不保证等于汇总 `official_quota - actual_quota`。图表不得把两条总额曲线之间的面积直接解释为节省金额；实际高于官方价的请求仍保留在两条对比曲线中，但不会产生负节省。

当 `official_quota=0` 时节省率返回 0，不执行除零；节省率仅表示“逐请求非负节省占官方价估算的比例”。

### 3.2 人民币换算

后端继续返回 quota，不固化人民币金额。前端使用系统状态中的：

```text
CNY = quota / quota_per_unit * usd_exchange_rate
```

- 图表纵轴、指标和 Tooltip 统一显示人民币。
- 面板标题区固定展示“按当前系统汇率换算”和当前 `1 USD = ¥x`；Tooltip 中的金额沿用同一汇率，不重复增加汇率行。
- 汇率变化只影响展示，不修改日志快照和 quota 汇总。
- 非法或缺失汇率使用现有货币配置回退规则，不在组件内维护第二套默认值。

### 3.3 历史回算

- 新日志优先使用 `other.savings_estimate` 快照。
- 无快照旧日志继续执行现有受限回算。
- 历史回算使用查询时当前官方价，因此趋势可能随官方价格配置变化。
- 只要任一桶包含历史回算，面板必须显示“含按当前官方价回算的历史消费”。
- `rebuild_price_snapshot_at` 只表示本次查询读取价格的时间，不得描述为请求发生时的官方价格。

## 4. 页面布局

### 4.1 桌面端

```text
┌ 成本对比 ──────────────────────────────────────────────┐
│ 近 7 天 · 人民币        已节省 ¥153.85  节省率 54.7% │
│                         覆盖率 98%                    │
├───────────────────────────────────────────────────────┤
│  官方价估算  - - - -                                  │
│  实际消费    ━━━━━━━        估算节省为绿色柱         │
│                                                       │
│                    趋势图                             │
│                                                       │
└───────────────────────────────────────────────────────┘
  含 667 条按当前官方价回算的历史请求 · ⓘ
```

布局要求：

- 使用现有 `rounded-lg border` 面板结构，不嵌套卡片。
- 标题左侧使用 `BadgeDollarSign` 或 `ChartNoAxesCombined` 图标。
- 总节省、节省率、覆盖率使用紧凑的行内指标和分隔线，不做三个小卡片。
- 图表桌面高度约 `360px`，移动端约 `300px`，保持稳定高度避免加载后跳动。
- 控件和图例允许横向滚动，不压缩到文字重叠。
- 概览入口使用熟悉的右箭头图标并提供 Tooltip，不增加新的文字按钮。

### 4.2 移动端

- 标题、时间范围和指标分两行排列。
- 默认只显示“已节省”和“覆盖率”，节省率进入 Tooltip 或第二行。
- 图例置于图表顶部，避免覆盖数据区域。
- Tooltip 限制最大宽度，金额和日期使用不换行的 tabular 数字。

## 5. 图表设计

### 5.1 系列

使用 VChart 线柱组合图：

- `official`：中性灰色虚线，表示官方价估算。
- `actual`：蓝色或深色实线，表示已覆盖请求的实际消费。
- `savings`：浅绿色柱，表示逐请求非负钳制后汇总的估算节省。

三组数据共用人民币纵轴。节省柱使用较低不透明度，避免遮挡折线。两条线允许交叉，不填充两线之间的面积；不得为了制造“始终节省”的视觉效果隐藏实际价格高于官方价的桶，也不得手写 Canvas。

### 5.2 Tooltip

每个时间桶展示：

```text
7 月 27 日
官方价估算    ¥281.30
实际消费      ¥127.45
估算节省      ¥153.85
覆盖请求      679 / 694（98%）
历史回算      667 条
```

规则：

- 三个金额均由 quota 在前端按同一汇率换算。
- `savings_quota=0` 时仍可显示该桶，但不绘制负节省。
- 覆盖率低于 100% 时 Tooltip 明确展示分子和分母。
- 后端空桶返回零值；前端以 `estimated_request_count > 0` 判断该桶是否存在可绘制金额。无请求桶和有请求但零覆盖桶都映射为 `null`，不连接跨缺口折线，也不把未知成本误画成零成本。
- 折线按连续有效区间分配 `seriesField`，缺口后的有效数据必须恢复绘制；两条折线关闭独立 Tooltip，只由柱系列输出一份完整明细。

### 5.3 时间范围

复用模型分析页面现有筛选器：

- 近 1 天：按小时。
- 近 7 天、14 天、29 天：按天。
- 自定义范围最长 31 天。

一期不按周聚合。若现有筛选器选择 `week`，节省趋势仍规范化为按天，避免 29 天范围只剩少量点。

### 5.4 可访问性

- 不能只依赖颜色区分系列，同时使用虚线、实线和柱形。
- 图表容器提供包含时间范围、总节省和覆盖率的可访问名称。
- 根据 buckets 生成屏幕阅读器可读的数据表，列出时间、官方价、实际消费、节省和覆盖率；表格放在 `sr-only overflow-hidden` 容器内，避免原生表格布局撑宽移动端页面。
- Header 中的汇总指标在图表不可交互或 Canvas 不可读时仍能表达核心结论。

## 6. API 设计

### 6.1 接口

```http
GET /api/user/savings/trend
  ?start_timestamp=1785081600
  &end_timestamp=1785168000
  &granularity=hour
  &utc_offset_minutes=480
```

权限：`middleware.UserAuth()`，只能查询当前登录用户。

参数：

| 参数 | 类型 | 规则 |
| ---- | ---- | ---- |
| `start_timestamp` | int64 | 必填，大于 0 |
| `end_timestamp` | int64 | 必填，复用现有 5 分钟时钟偏差和截断规则 |
| `granularity` | string | `hour` 或 `day` |
| `utc_offset_minutes` | int | 必填，用户相对 UTC 的分钟偏移，范围 `-720..840` |

粒度限制：

- `hour` 最长查询 48 小时。
- `day` 最长查询 31 天。
- 预计桶数超过 64 时返回 400，不在后端静默降采样。

### 6.2 响应

```json
{
  "success": true,
  "data": {
    "granularity": "day",
    "utc_offset_minutes": 480,
    "start_timestamp": 1785081600,
    "end_timestamp": 1785168000,
    "summary": {
      "enabled": true,
      "savings_quota": 10537576,
      "official_quota": 24792049,
      "actual_quota": 19289098,
      "request_count": 694,
      "estimated_request_count": 679,
      "snapshot_request_count": 12,
      "reconstructed_request_count": 667,
      "coverage_ratio": 0.9784,
      "source": "mixed",
      "official_confirmed": true,
      "source_updated_at": 1785081600,
      "rebuild_price_snapshot_at": 1785168000,
      "official_price_stale": false,
      "window_days": 1,
      "is_partial": false
    },
    "buckets": [
      {
        "start_timestamp": 1785081600,
        "end_timestamp": 1785168000,
        "official_quota": 24792049,
        "actual_quota": 19289098,
        "savings_quota": 10537576,
        "request_count": 694,
        "estimated_request_count": 679,
        "snapshot_request_count": 12,
        "reconstructed_request_count": 667,
        "coverage_ratio": 0.9784
      }
    ]
  }
}
```

`summary` 复用现有 `SavingsSummary` 完整结构，避免总览和趋势接口产生两套汇总语义。金额汇总字段继续使用 `int64`。前端在当前 50,000 行保护阈值内可安全映射为 JavaScript `number`。

### 6.3 分桶规则

- 时间范围仍使用 `[start_timestamp, end_timestamp)`。
- 小时桶为 3,600 秒，天桶为 86,400 秒。
- 先计算 `offset_seconds = utc_offset_minutes * 60`，再对齐用户本地整点或本地零点：`floor((timestamp + offset_seconds) / bucket_size) * bucket_size - offset_seconds`。
- 首尾桶可以是不完整桶，只统计查询范围内的日志；返回的桶边界仍是完整的本地日历边界，前端按响应时间戳显示标签。
- 后端返回所有桶，包括无请求空桶，确保时间轴稳定。
- 单条日志先完成快照解析或历史回算，再加入所属桶；不得为每个桶重新扫描日志。

## 7. 后端实现

### 7.1 复用边界

重构现有 `GetUserSavingsSummary` 的聚合循环，提取可复用的日志估算结果：

```go
type SavingsLogEstimate struct {
    CreatedAt        int64
    Estimate         *SavingsEstimate
    CalculationMode string
    SkipReason       string
}
```

该结构只表达稳定业务结果，供总览汇总和趋势分桶共同使用。不要复制一套历史回算、价格匹配或 quota 校验逻辑。

### 7.2 查询流程

```text
校验并规范化时间范围
  -> COUNT 当前用户 consume logs
  -> 超过 max_summary_log_rows：返回 is_partial=true、空 buckets
  -> 一次查询必要日志字段
  -> 一次构建官方价格 Map
  -> 每条日志执行快照优先 / 历史回算
  -> 同时累加 summary 和 bucket
  -> 受检 int64 累加
  -> 计算总覆盖率和各桶覆盖率
```

约束：

- 不使用数据库 JSON 函数，保持 SQLite、MySQL、PostgreSQL 兼容，并兼容现有日志数据库查询路径。
- 不新增趋势表或后台回填任务；31 天、50,000 行以内在 Go 中聚合。
- `model.GetPricing()` 每次请求只调用一次。
- 任一 quota 累加溢出时整次请求失败，不返回截断金额。
- `is_partial=true` 时不返回部分趋势，防止用户把不完整金额当总额。

### 7.3 路由与文件

建议改动：

- `router/api-router.go`：注册 `/api/user/savings/trend`。
- `controller/savings.go`：解析时间和粒度参数。
- `service/savings_estimate.go`：复用日志估算并实现分桶。
- `model/savings_log.go`：继续复用现有时间范围日志查询，不新增方言 SQL。

### 7.4 用户与管理员作用域

一期趋势接口始终使用登录用户 ID，不接受 `user_id` 或 `username`，避免普通用户越权。普通用户的模型分析本来就是自身数据，口径一致。

管理员的模型分析默认可能展示全局数据，因此趋势面板标题必须显示“当前账户成本对比”，并带“仅当前账户”作用域标识，不跟随管理员用户名筛选器。管理员跨用户或全站节省趋势需要独立权限、扫描阈值和产品口径，留到后续版本，不能在一期接口中用可选参数隐式放开。

## 8. 前端实现

建议新增：

- `web/src/features/dashboard/components/models/savings-trend-chart.tsx`
- `web/src/features/dashboard/lib/savings-chart.ts`
- `web/src/features/dashboard/lib/__tests__/savings-chart.test.ts`

建议修改：

- `web/src/features/dashboard/api.ts`：增加 `getUserSavingsTrend`。
- `web/src/features/dashboard/types.ts`：增加 `SavingsTrend` 和 `SavingsTrendBucket`。
- `web/src/features/dashboard/index.tsx`：懒加载趋势面板并接入现有筛选器。
- `web/src/features/dashboard/components/overview/summary-cards.tsx`：增加查看趋势入口。
- `web/scripts/add-missing-keys.mjs`：通过脚本补齐七语言文本。

React Query：

```ts
queryKey: ['dashboard', 'savings-trend', start, end, granularity, utcOffset]
staleTime: 60 * 1000
```

- 筛选条件变化时保留旧图直到新请求完成，避免闪白。
- 功能关闭时不渲染面板。
- `is_partial=true`、无可估算请求、接口错误分别提供明确状态。
- 组件使用现有主题、`VCHART_OPTION` 和动态主题加载方式，不引入新图表依赖。
- 普通用户标题为“成本对比”；管理员标题为“当前账户成本对比”，防止与同页全局模型数据混淆。

## 9. 状态与降级

| 状态 | 展示 |
| ---- | ---- |
| 功能关闭 | 不显示面板，概览入口也隐藏 |
| 加载中 | 固定高度 Skeleton |
| 无消费日志 | “所选时间范围暂无消费记录” |
| 有日志但无可估算请求 | “暂无符合估算条件的消费记录”，显示覆盖率 0% |
| 部分数据 | 隐藏金额和折线，提示缩小时间范围 |
| 官方价格过期 | 保留趋势并显示价格更新时间警告 |
| 接口失败 | 面板内错误状态和重试按钮，不影响其他分析图表 |

## 10. 测试

后端必须覆盖：

- 小时和天分桶边界、正负 UTC 偏移，尤其是 `[start, end)` 相邻桶不重复。
- 快照、历史回算和两者混合时的桶计数与总计一致。
- 空桶补齐。
- 单条日志只进入一个桶。
- 无效粒度、超长范围、未来时间和 5 分钟偏差截断。
- `hour` 超过 48 小时、`day` 超过 31 天或桶数超过 64 时拒绝请求。
- 超过扫描阈值返回全局 partial，不返回部分桶。
- int64 受检累加。
- 每桶 `savings_quota` 等于桶内逐请求非负节省之和；明确覆盖“汇总官方价减实际价不等于汇总节省”的场景。

前端必须覆盖：

- quota 按系统汇率转换为 CNY。
- 官方价线、实际消费线和节省柱使用同一桶数据，Tooltip 不用两线差值替代 `savings_quota`。
- 无请求桶和有请求但零覆盖桶不跨越连线，缺口后的有效区间继续显示。
- 覆盖率不足、历史回算、partial、disabled 和 empty 状态。
- 筛选器切换后 query key 与粒度规范化正确。
- 移动端标题、指标、图例不重叠。
- 管理员页面明确显示“仅当前账户”，不误用管理员全局筛选条件。

验证命令沿用项目约定：Go 完整测试、前端单测、`tsgo -b`、目标 `oxlint`、生产构建和 `git diff --check`。

## 11. 施工顺序

1. 提取现有单日志估算与汇总累加的复用逻辑，确保原 summary 行为不变。
2. 实现趋势 DTO、分桶服务、controller 和路由。
3. 补后端分桶与安全边界测试。
4. 增加前端类型、API、纯图表数据转换函数和单元测试。
5. 在模型调用分析中接入趋势面板与完整状态。
6. 在概览节省块增加跳转入口。
7. 通过 i18n 脚本补齐七语言。
8. 完整验证，并使用桌面和移动视口检查图表非空、Tooltip 和文字布局。

## 12. 验收标准

- 用户能在模型调用分析中查看 1、7、14、29 天的成本对比趋势。
- 图表官方价和实际消费只比较同一批已覆盖请求。
- 汇总金额等于所有桶之和，覆盖率分子分母准确。
- 人民币金额使用当前系统汇率，Tooltip 明示换算口径。
- 历史回算数量和价格快照时间可解释。
- partial、无数据、功能关闭时不展示误导金额。
- 不改变实际扣费、余额、订阅、退款和日志写入行为。
- 不新增依赖、数据库表和跨数据库专用 SQL。

## 13. 暂不实施

- 累计终身节省。
- 钱包充值页节省营销模块。
- 管理员跨用户节省排行榜。
- 饼图、仪表盘、动画金额。
- 自动抓取官网价格。
- 按模型节省排行；待趋势图上线后根据使用反馈评估。
