# 用户统计：排行指标切换（调用次数 / 费用消耗）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在「数据看板 → 用户统计」页新增一个指标切换（费用消耗 / 调用次数），切换后整个用户页（Top N 选取、排名图、趋势图）统一切换到所选指标。

**Architecture:** 纯前端改动。后端 `model.GetQuotaDataGroupByUser` 已返回 `sum(count) as count`，`count` 数据已具备。给纯函数 `processUserChartData` 增加一个 `metric: 'quota' | 'count'` 参数，按 metric 决定取值字段、排序、数值格式与图表标题；组件 `UserCharts` 增加一个 metric 状态 + 一个 Tabs 切换控件。

**Tech Stack:** React 19 + TypeScript + Rsbuild（bun）、i18next、VChart。Go（仅因 `//go:embed web/default/dist` 需要重新打包前端 dist）。

---

## 项目特定约定（执行前必读）

- **无前端测试运行器**：`web/default/package.json` 无 `test` 脚本，无 vitest/jest/playwright 依赖。因此本计划**不采用「先写失败测试」的 TDD**，验证方式为 `typecheck` + `build` + DEV 实例人工核对（与本项目 DEV 工作流一致）。
- **Go 以 embed 方式打包前端**：`main.go:38 //go:embed web/default/dist`。前端改动后，**必须重新构建前端 dist + 重新编译 Go 二进制 + 重启 DEV 实例**才能在 :3000 看到效果。rsbuild `distPath.root = 'dist'`，输出到 `web/default/dist`。
- **宿主崩盘红线（3.6GB RAM VPS）**：
  - 前端构建**单独进行**，绝不与 classic 并行。
  - Go 编译必须 `GOMAXPROCS=2 go build -p 2`，禁止裸 `go build`。
  - 重活前 pre-flight：`swapon --show` 必须列出 `/swapfile`；若 `free -h` 的 `available` RAM < ~400MB 且 swap 飙升 → 停下。
- **提交策略**：本项目约定「只在用户明确要求时才 commit/push」。本计划**不包含 commit 步骤**；如用户要求提交，再统一处理。
- **i18n**：`en.json` 为 base（key=value 自映射），`zh.json` 为中文翻译；其余 fr/ja/ru/vi 缺失时 i18next 运行时回退到英文 key 字符串。`bun run i18n:sync` 用于检测/同步未翻译项（不自动翻译）。

## File Structure

| 文件 | 责任 | 改动类型 |
|------|------|---------|
| `web/default/src/features/dashboard/types.ts` | 导出 `UserRankMetric` 类型 | 新增 1 个类型 |
| `web/default/src/i18n/locales/en.json` | 英文 base（自映射） | 新增 4 个 key |
| `web/default/src/i18n/locales/zh.json` | 中文翻译 | 新增 4 个 key |
| `web/default/src/features/dashboard/lib/charts.ts` | `processUserChartData` 增加 metric 参数，按 metric 取值/排序/格式化/标题 | 多处精确 Edit |
| `web/default/src/features/dashboard/components/users/user-charts.tsx` | metric 状态 + Tabs 切换控件；传入 processor | 多处精确 Edit |

不改动：后端（controller/model/router）、`section-registry.tsx`、`web/classic`、其他 dashboard section。

---

## Task 1: 新增 `UserRankMetric` 类型

**Files:**
- Modify: `web/default/src/features/dashboard/types.ts`

- [ ] **Step 1: 在 `types.ts` 末尾 `ProcessedUserChartData` 之后新增类型**

定位现有（约 110-113 行）：
```ts
export interface ProcessedUserChartData {
  spec_user_rank: VChartSpec
  spec_user_trend: VChartSpec
}
```
在其后追加（用 Edit，`old_string` 为上面 4 行，`new_string` 为上面 4 行 + 新类型）：

```ts
export interface ProcessedUserChartData {
  spec_user_rank: VChartSpec
  spec_user_trend: VChartSpec
}

// 用户统计排行所用指标：费用消耗（quota）或调用次数（count）
export type UserRankMetric = 'quota' | 'count'
```

- [ ] **Step 2: 校验类型可被引用**

Run: `cd /root/new_api/repo/web/default && bun run typecheck`
Expected: 通过（仅新增类型，不影响现有代码）。

---

## Task 2: 新增 4 个 i18n key（en + zh）

**Files:**
- Modify: `web/default/src/i18n/locales/en.json`
- Modify: `web/default/src/i18n/locales/zh.json`

新增 key（英文 source / 中文）：
- `Cost Consumption` → `费用消耗`
- `Call Count` → `调用次数`
- `User Call Count Ranking` → `用户调用次数排名`
- `User Call Count Trend` → `用户调用次数趋势`

- [ ] **Step 1: en.json 插入 `Call Count`（在 `Call Count Distribution` 之前）**

`old_string`（唯一）：
```
    "Call Count Distribution": "Call Count Distribution",
```
`new_string`：
```
    "Call Count": "Call Count",
    "Call Count Distribution": "Call Count Distribution",
```

- [ ] **Step 2: en.json 插入 `Cost Consumption`（在 `Cost in USD...` 之前）**

`old_string`（唯一）：
```
    "Cost in USD per request, regardless of tokens used.": "Cost in USD per request, regardless of tokens used.",
```
`new_string`：
```
    "Cost Consumption": "Cost Consumption",
    "Cost in USD per request, regardless of tokens used.": "Cost in USD per request, regardless of tokens used.",
```

- [ ] **Step 3: en.json 插入两个 `User Call Count *`（在 `User Consumption Ranking` 之前）**

`old_string`（唯一）：
```
    "User Consumption Ranking": "User Consumption Ranking",
```
`new_string`：
```
    "User Call Count Ranking": "User Call Count Ranking",
    "User Call Count Trend": "User Call Count Trend",
    "User Consumption Ranking": "User Consumption Ranking",
```

- [ ] **Step 4: zh.json 插入 `Call Count`（在 `Call Count Distribution` 之前）**

`old_string`（唯一）：
```
    "Call Count Distribution": "调用次数分布",
```
`new_string`：
```
    "Call Count": "调用次数",
    "Call Count Distribution": "调用次数分布",
```

- [ ] **Step 5: zh.json 插入 `Cost Consumption`（在 `Cost in USD...` 之前）**

`old_string`（唯一）：
```
    "Cost in USD per request, regardless of tokens used.": "每请求的美元费用，不考虑使用的令牌数。",
```
`new_string`：
```
    "Cost Consumption": "费用消耗",
    "Cost in USD per request, regardless of tokens used.": "每请求的美元费用，不考虑使用的令牌数。",
```

- [ ] **Step 6: zh.json 插入两个 `User Call Count *`（在 `User Consumption Ranking` 之前）**

`old_string`（唯一）：
```
    "User Consumption Ranking": "用户消耗排行",
```
`new_string`：
```
    "User Call Count Ranking": "用户调用次数排名",
    "User Call Count Trend": "用户调用次数趋势",
    "User Consumption Ranking": "用户消耗排行",
```

- [ ] **Step 7: 验证两个 JSON 合法 + 跑 i18n:sync**

Run: `cd /root/new_api/repo/web/default && node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/en.json','utf8')); JSON.parse(require('fs').readFileSync('src/i18n/locales/zh.json','utf8')); console.log('JSON ok')"`
Expected: 输出 `JSON ok`（无语法错误）。

Run: `cd /root/new_api/repo/web/default && bun run i18n:sync`
Expected: 正常退出；可能在 `src/i18n/locales/_reports/` 报告 fr/ja/ru/vi 中这 4 个 key 仍为英文（未翻译）——**这是预期的**，运行时 i18next 会回退到英文 key 字符串，不影响功能。无需处理其他语言。

---

## Task 3: 改造 `processUserChartData`（核心）

**Files:**
- Modify: `web/default/src/features/dashboard/lib/charts.ts`

设计要点：`rawQuota` 作为内部数值字段名在两种 metric 下复用（仅改其取值来源与格式化），以最小化 diff。新增 `metric` 参数；按 metric 选取 `valueOf`/`formatVal`/标题。`formatVal` 被 rank 的 `label.formatMethod`、trend 的 y 轴 `label.formatMethod`、tooltip 等引用，切换 `formatVal` 即可联动所有展示。

- [ ] **Step 1: 导入 `UserRankMetric` 类型**

`old_string`（唯一，文件顶部 import）：
```ts
import type {
  QuotaDataItem,
  ProcessedChartData,
  ProcessedUserChartData,
} from '@/features/dashboard/types'
```
`new_string`：
```ts
import type {
  QuotaDataItem,
  ProcessedChartData,
  ProcessedUserChartData,
  UserRankMetric,
} from '@/features/dashboard/types'
```

- [ ] **Step 2: 函数签名增加 `metric` 参数**

`old_string`（唯一，`processUserChartData` 签名）：
```ts
export function processUserChartData(
  data: QuotaDataItem[],
  timeGranularity: TimeGranularity = 'day',
  t?: TFunction,
  limit = 10,
  themeKey?: string
): ProcessedUserChartData {
```
`new_string`：
```ts
export function processUserChartData(
  data: QuotaDataItem[],
  timeGranularity: TimeGranularity = 'day',
  t?: TFunction,
  limit = 10,
  themeKey?: string,
  metric: UserRankMetric = 'quota'
): ProcessedUserChartData {
```

- [ ] **Step 3: 在函数体开头加入 metric 相关常量（`isCount` / `valueOf` / `formatCount`）**

`old_string`（唯一）：
```ts
  const { config } = getCurrencyDisplay()
  const quotaPerUnit = config.quotaPerUnit
  const themeUserColors = getThemeChartColors(themeKey)
```
`new_string`：
```ts
  const { config } = getCurrencyDisplay()
  const quotaPerUnit = config.quotaPerUnit
  const isCount = metric === 'count'
  // 按所选指标取值；rawQuota 为内部数值字段名，两种 metric 复用。
  const valueOf = (item: QuotaDataItem) =>
    isCount ? Number(item.count) || 0 : Number(item.quota) || 0
  const formatCount = (value: number) =>
    Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)
  const themeUserColors = getThemeChartColors(themeKey)
```

- [ ] **Step 4: 让 `formatVal` 随 metric 切换，并新增标题变量**

`old_string`（唯一）：
```ts
  const formatVal = (raw: number) => renderQuotaCompat(raw, 2)
```
`new_string`：
```ts
  const formatVal = isCount
    ? formatCount
    : (raw: number) => renderQuotaCompat(raw, 2)
  const rankTitle = isCount
    ? tt('User Call Count Ranking')
    : tt('User Consumption Ranking')
  const trendTitle = isCount
    ? tt('User Call Count Trend')
    : tt('User Consumption Trend')
```

- [ ] **Step 5: 空数据态排名标题改用 `rankTitle`**

`old_string`（唯一，带 `No data available` 的空态排名标题）：
```ts
        text: tt('User Consumption Ranking'),
        subtext: tt('No data available'),
```
`new_string`：
```ts
        text: rankTitle,
        subtext: tt('No data available'),
```

- [ ] **Step 6: 空数据态趋势标题改用 `trendTitle`**

`old_string`（唯一，带 `No data available` 的空态趋势标题）：
```ts
        text: tt('User Consumption Trend'),
        subtext: tt('No data available'),
```
`new_string`：
```ts
        text: trendTitle,
        subtext: tt('No data available'),
```

- [ ] **Step 7: Top N 聚合 + rankValues 改用 `valueOf`**

`old_string`（唯一，整块）：
```ts
  const userQuotaTotal = new Map<string, number>()
  data.forEach((item) => {
    const username = item.username || 'unknown'
    const prev = userQuotaTotal.get(username) || 0
    userQuotaTotal.set(username, prev + (Number(item.quota) || 0))
  })

  const sorted = Array.from(userQuotaTotal.entries()).sort(
    (a, b) => b[1] - a[1]
  )
  const topUsers = sorted.slice(0, limit).map(([u]) => u)
  const topUserSet = new Set(topUsers)
  const totalQuota = sorted.slice(0, limit).reduce((s, [, q]) => s + q, 0)

  const rankValues = sorted.slice(0, limit).map(([username, quota]) => ({
    User: username,
    rawQuota: quota,
    Usage: Number((quota / quotaPerUnit).toFixed(4)),
  }))
```
`new_string`：
```ts
  // userQuotaTotal 保存「按当前指标」每用户的求和（quota 或 count），名称沿用以减小 diff。
  const userQuotaTotal = new Map<string, number>()
  data.forEach((item) => {
    const username = item.username || 'unknown'
    const prev = userQuotaTotal.get(username) || 0
    userQuotaTotal.set(username, prev + valueOf(item))
  })

  const sorted = Array.from(userQuotaTotal.entries()).sort(
    (a, b) => b[1] - a[1]
  )
  const topUsers = sorted.slice(0, limit).map(([u]) => u)
  const topUserSet = new Set(topUsers)
  const totalQuota = sorted.slice(0, limit).reduce((s, [, q]) => s + q, 0)

  const rankValues = sorted.slice(0, limit).map(([username, value]) => ({
    User: username,
    rawQuota: value,
    Usage: isCount ? value : Number((value / quotaPerUnit).toFixed(4)),
  }))
```

- [ ] **Step 8: 趋势按时间分桶的累加改用 `valueOf`**

`old_string`（唯一）：
```ts
    map.set(user, (map.get(user) || 0) + (Number(item.quota) || 0))
```
`new_string`：
```ts
    map.set(user, (map.get(user) || 0) + valueOf(item))
```

- [ ] **Step 9: trendValues 的 `Usage` 字段在 count 指标下避免做货币换算**

`old_string`（唯一，`trendValues.push` 整块）：
```ts
      const q = timeUserMap.get(time)?.get(user) || 0
      trendValues.push({
        Time: time,
        User: user,
        rawQuota: q,
        Usage: Number((q / quotaPerUnit).toFixed(4)),
      })
```
`new_string`：
```ts
      const q = timeUserMap.get(time)?.get(user) || 0
      trendValues.push({
        Time: time,
        User: user,
        rawQuota: q,
        Usage: isCount ? q : Number((q / quotaPerUnit).toFixed(4)),
      })
```

- [ ] **Step 10: 非空态排名标题改用 `rankTitle`**

`old_string`（唯一，带 `Total:` 汇总副标题的排名标题）：
```ts
        text: tt('User Consumption Ranking'),
        subtext: `${tt('Total:')} ${formatVal(totalQuota)}`,
```
`new_string`：
```ts
        text: rankTitle,
        subtext: `${tt('Total:')} ${formatVal(totalQuota)}`,
```

- [ ] **Step 11: 非空态趋势标题改用 `trendTitle`**

`old_string`（唯一，带 `Total:` 汇总副标题的趋势标题）：
```ts
        text: tt('User Consumption Trend'),
        subtext: `${tt('Total:')} ${formatVal(totalQuota)}`,
```
`new_string`：
```ts
        text: trendTitle,
        subtext: `${tt('Total:')} ${formatVal(totalQuota)}`,
```

- [ ] **Step 12: typecheck**

Run: `cd /root/new_api/repo/web/default && bun run typecheck`
Expected: 通过（无 TS 错误）。

---

## Task 4: `UserCharts` 增加 metric 状态与切换控件

**Files:**
- Modify: `web/default/src/features/dashboard/components/users/user-charts.tsx`

- [ ] **Step 1: 导入 `UserRankMetric` 类型**

`old_string`（唯一）：
```ts
import type { ProcessedUserChartData } from '@/features/dashboard/types'
```
`new_string`：
```ts
import type {
  ProcessedUserChartData,
  UserRankMetric,
} from '@/features/dashboard/types'
```

- [ ] **Step 2: 新增 `metric` 状态（紧随 `topUserLimit` 之后）**

`old_string`（唯一）：
```ts
  const [topUserLimit, setTopUserLimit] = useState(10)
```
`new_string`：
```ts
  const [topUserLimit, setTopUserLimit] = useState(10)
  const [metric, setMetric] = useState<UserRankMetric>('quota')
```

- [ ] **Step 3: `processUserChartData` 传入 `metric`，并加入 `useMemo` 依赖**

`old_string`（唯一，整块 useMemo）：
```ts
  const chartData = useMemo(
    () =>
      processUserChartData(
        isLoading ? [] : (userData ?? []),
        timeGranularity,
        t,
        topUserLimit,
        customization.preset
      ),
    [
      userData,
      isLoading,
      timeGranularity,
      t,
      topUserLimit,
      customization.preset,
      customization.radius,
    ]
  )
```
`new_string`：
```ts
  const chartData = useMemo(
    () =>
      processUserChartData(
        isLoading ? [] : (userData ?? []),
        timeGranularity,
        t,
        topUserLimit,
        customization.preset,
        metric
      ),
    [
      userData,
      isLoading,
      timeGranularity,
      t,
      topUserLimit,
      customization.preset,
      customization.radius,
      metric,
    ]
  )
```

- [ ] **Step 4: 在 Top N Tabs 组之后新增「费用消耗 / 调用次数」Tabs 组**

`old_string`（唯一，Top N Tabs 结束 + isLoading loader）：
```tsx
          </TabsList>
        </Tabs>

        {isLoading && (
          <Loader2 className='text-muted-foreground size-4 animate-spin' />
        )}
```
`new_string`：
```tsx
          </TabsList>
        </Tabs>

        <Tabs
          value={metric}
          onValueChange={(value) => setMetric(value as UserRankMetric)}
          className='shrink-0'
        >
          <TabsList>
            <TabsTrigger value='quota' className='px-2.5 text-xs'>
              {t('Cost Consumption')}
            </TabsTrigger>
            <TabsTrigger value='count' className='px-2.5 text-xs'>
              {t('Call Count')}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading && (
          <Loader2 className='text-muted-foreground size-4 animate-spin' />
        )}
```

- [ ] **Step 5: VChart `key` 加入 `metric`，确保切换时干净重渲染**

`old_string`（唯一）：
```tsx
                      key={`user-${chart.value}-${topUserLimit}-${resolvedTheme}-${customization.preset}`}
```
`new_string`：
```tsx
                      key={`user-${chart.value}-${topUserLimit}-${metric}-${resolvedTheme}-${customization.preset}`}
```

- [ ] **Step 6: typecheck**

Run: `cd /root/new_api/repo/web/default && bun run typecheck`
Expected: 通过。

---

## Task 5: 构建并人工验证（DEV :3000）

**Files:** 无（仅构建与运行）

- [ ] **Step 1: Pre-flight（崩盘红线检查）**

Run: `swapon --show && free -h`
Expected: `swapon --show` 列出 `/swapfile`；`free -h` 的 `available` 合理（≥ ~400MB）。若 swap 已大量占用 → 先等待系统稳定再继续。

- [ ] **Step 2: 构建前端（单独，classic 不并行）**

Run: `cd /root/new_api/repo/web/default && DISABLE_ESLINT_PLUGIN=true bun run build`
Expected: 构建成功，输出写入 `web/default/dist`。若中途内存吃紧、进程被 OOM 杀，等系统稳定后重试（单主题，不应触发崩盘）。

- [ ] **Step 3: 重新编译 Go 二进制（embed 新 dist，必须限并发）**

Run: `cd /root/new_api/repo && export PATH=/usr/local/btgo/bin:$PATH && GOMAXPROCS=2 go build -p 2 -ldflags "-s -w" -o new-api`
Expected: 成功生成 `/root/new_api/repo/new-api`（增量编译，通常数秒到几十秒）。

- [ ] **Step 4: 重启 DEV 实例（:3000）**

Run:
```bash
pkill -f '/new-api'
cd /root/new_api/repo && SQLITE_PATH=/root/new_api/data-dev/one-api.db PORT=3000 TZ=Asia/Shanghai nohup ./new-api > /root/new_api/data-dev/new-api.log 2>&1 &
```
Expected: 进程后台启动；`tail -n 20 /root/new_api/data-dev/new-api.log` 无致命错误，监听 :3000。

- [ ] **Step 5: 人工核对（管理员账号登录 :3000）**

访问 `http://<host>:3000/dashboard/users`（需管理员），核对：
1. 默认进入：筛选行出现新的「费用消耗 / 调用人数」切换组，**默认选中「费用消耗」**；排名图标题「用户消耗排行」、趋势图标题「用户消耗趋势」，数值为货币格式 —— **与改动前完全一致**。
2. 点「调用次数」：排名图标题变「用户调用次数排名」，柱子按调用次数降序，Top N 变为次数最高的用户；趋势图标题变「用户调用次数趋势」，数值为整数（无货币符号）；副标题「总计」为整数次数。
3. 点回「费用消耗」：恢复货币展示，与步骤 1 一致。
4. 切换 Top N（5/10/20/50）、时间范围、粒度：metric 保持当前值不变，图表正确联动。
5. （若该时间段无数据）两个指标下标题均正确显示「无数据可用」。

- [ ] **Step 6: 回归确认（无副作用）**

- 其他 dashboard section（overview / models）正常。
- 用户列表（/users）、日志等其他页面不受影响。
- 浏览器控制台无新报错。

---

## 完成标准

- Task 1–4 的 typecheck 全部通过；Task 2 的两个 JSON 合法。
- 前端 dist 构建成功；Go 二进制重新打包成功；DEV 实例正常启动。
- Task 5 Step 5 的 5 个人工核对点全部符合预期，默认行为与改动前一致。

## 备注

- **不提交 git**（本项目约定）。如需提交，等用户明确指示后统一处理。
- **不动 web/classic**、后端、其他 section。
- **不持久化** metric：刷新回到默认「费用消耗」（刻意设计，如需 localStorage 记忆需另行追加任务）。
- fr/ja/ru/vi 的 4 个新 key 暂回退英文，属预期；如需翻译可后续补。
