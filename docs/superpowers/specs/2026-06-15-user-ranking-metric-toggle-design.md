# 用户统计：排行指标切换（调用次数 / 费用消耗）

- 日期：2026-06-15
- 模块：数据看板 → 用户统计（User Analytics）
- 主题：仅 `web/default`

## 1. 背景与目标

「用户统计」页当前只按**费用消耗（quota）**做排行和趋势。本次新增一个指标切换：可在
**费用消耗** 与 **调用次数（count）** 之间切换，切换后整个用户页（Top N 用户选取、排名图、
趋势图）统一切换到所选指标。

其他筛选条件（时间范围 1/7/14/29 天、粒度 hour/day/week、Top N = 5/10/20/50）行为不变。

## 2. 关键约束 / 非目标

- **纯前端改动**：后端 `model.GetQuotaDataGroupByUser` 已返回 `sum(count) as count`，
  `count` 数据前端已具备，后端与数据库不动。
- **指标切换范围 = 整个用户页**：Top N 选取 + 排名图 + 趋势图同步切换，保证一致性。
- **不持久化**：切换为纯视图状态，刷新回到默认「费用消耗」。
- **默认值 = 费用消耗**：保证与现状行为完全一致（纯增量）。
- **非目标**：不改动 `web/classic`、不改动其他 dashboard section、不改动后端。
- **宿主约束**：小内存 VPS，前端构建需 `web/default` 单独构建（不与 classic 并行），
  Go 不重编（无后端改动）。

## 3. UI

在 `UserCharts`（`components/users/user-charts.tsx`）现有三个 Tabs 组（时间范围 / 粒度 / Top N）
同一行内，新增第四个 Tabs 组：

- 选项：「费用消耗」(默认) / 「调用次数」
- 复用现有 `Tabs / TabsList / TabsTrigger` 组件与样式；移动端随容器横向滚动，不另加布局。
- 仅当 `activeSection === 'users'` 时出现（本组件本就只在 users section 渲染）。

## 4. 状态

`UserCharts` 组件新增：

```ts
type UserRankMetric = 'quota' | 'count'
const [metric, setMetric] = useState<UserRankMetric>('quota')
```

- 不写入 localStorage（与 `timeGranularity` 的持久化做法不同，刻意保持简单）。
- 切换 metric 仅触发 `processUserChartData` 重算（`useMemo` 依赖加 `metric`）。

## 5. 数据流

```
GET /api/data/users  →  QuotaDataItem[]（含 username, created_at, quota, count）
        ↓
processUserChartData(data, granularity, t, limit, themeKey, metric)
        ↓
{ spec_user_rank, spec_user_trend }
```

`processUserChartData`（`lib/charts.ts`）改造：

1. 新增参数 `metric: 'quota' | 'count'`（默认 `'quota'`）。
2. 按 metric 选取字段：`quota` → `item.quota`；`count` → `item.count`。统一抽出一个
   `valueOf(item)` 取值函数，避免分支散落。
3. **Top N 选取**：按所选字段求和、降序、取前 `limit`。（现状按 quota；切到 count 后按 count。）
4. **排名图**：柱子值用所选字段。
5. **趋势图**：按时间分桶时累加所选字段。
6. **数值格式化**：
   - `count` → 整数格式（复用 `formatInt` 风格，`Intl.NumberFormat` 无小数）；
   - `quota` → 现有 `renderQuotaCompat`（货币 / Token 模式不变）。
7. **图表标题随 metric 切换**（见 §6）。

## 6. i18n

`processUserChartData` 的图表 `title.text` 随 metric 切换：

| metric | 排名图标题 | 趋势图标题 |
|--------|-----------|-----------|
| quota  | `User Consumption Ranking` | `User Consumption Trend` |
| count  | `User Call Count Ranking`  | `User Call Count Trend`  |

新增英文 key（i18next，英文为 base）：

- `Cost Consumption`（按钮，zh：费用消耗）
- `Call Count`（按钮，zh：调用次数）
- `User Call Count Ranking`（zh：用户调用次数排名）
- `User Call Count Trend`（zh：用户调用次数趋势）

文件：`web/default/src/i18n/locales/*.json`（至少 en/zh；其余语言按现有惯例补，缺失则回退英文）。
空数据态（`emptyResult`）的标题同样随 metric 切换。

## 7. 受影响文件

| 文件 | 改动 |
|------|------|
| `web/default/src/features/dashboard/components/users/user-charts.tsx` | 新增 metric 状态 + Tabs 切换控件；传入 `processUserChartData` |
| `web/default/src/features/dashboard/lib/charts.ts` | `processUserChartData` 增 `metric` 参数，按 metric 取字段/排序/格式化/标题 |
| `web/default/src/features/dashboard/types.ts` | 新增 `UserRankMetric` 类型（导出） |
| `web/default/src/i18n/locales/*.json` | 新增 4 个 key（en/zh 必填） |

不改动：后端（controller / model / router）、`section-registry`、`web/classic`、其他 dashboard section。

## 8. 兼容性与回归

- 默认 `metric='quota'`，所有现有行为不变。
- 切换粒度 / 时间范围 / Top N 时 metric 保持当前值。
- 验证点：
  - 默认进入页面，排名/趋势与改动前一致（费用）。
  - 切到「调用次数」：排名图按次数降序、Top N 为次数最高的用户、趋势图也变次数。
  - 切回「费用」恢复正常。
  - 空数据时两指标都显示「无数据」标题正确。
  - 数值格式：次数为整数无货币符号；费用沿用原货币格式。

## 9. 构建 / 部署

- 仅前端：`cd web/default && DISABLE_ESLINT_PLUGIN=true bun run build`（单主题，不并行 classic）。
- 不重编 Go；DEV 直接用现有 `new-api` 二进制（无后端改动）。
- PROD 重建仅在用户明确指示时进行。
