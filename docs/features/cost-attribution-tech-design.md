# 成本归因（P1）— 技术设计文档

> 配套需求文档：`cost-attribution.md`
> 目标：在「数据看板」页新增「成本归因」Tab，按 用户 / 令牌 / 模型 三维聚合成本，支持组合下钻与趋势，纯读 `logs` 表，管理员鉴权，三库兼容。

---

## 1. 总体设计

- **数据来源**：`logs` 表（位于 `LOG_DB`），仅统计 `type = LogTypeConsume`（=2）。**不新增表、不改 schema、不依赖 `request_details`。**
- **后端**：新增聚合查询函数（`model/log.go`）+ 控制器（`controller/log.go`）+ 路由（`router/api-router.go`，挂 `logRoute` + `AdminAuth()`）。
- **前端**：`web/default/src/features/dashboard` 内新增「成本归因」section（与 概览/模型调用分析/用户统计 并列，仅管理员），复用看板时间预设、React Query、VChart 主题、i18n。
- **复用**：聚合的过滤条件复用现有 `GetAllLogs` / `SumUsedQuota` 的筛选语义（时间、用户名、令牌名、模型名、渠道、分组）。

---

## 2. `logs` 表相关字段（基线）

```go
type Log struct {
    UserId           int    // 聚合主键（用户维度）
    Username         string // 展示标签
    CreatedAt        int64  // unix 秒，时间过滤 + 按天分桶
    Type             int    // 限定 LogTypeConsume
    TokenName        string // 展示标签
    TokenId          int    // 聚合主键（令牌维度）
    ModelName        string // 聚合主键 + 展示（模型维度）
    Quota            int    // 费用（折算金额 = quota / QuotaPerUnit）
    PromptTokens     int    // 输入 token
    CompletionTokens int    // 输出 token
    ChannelId        int    // 渠道过滤
    Group            string // 分组过滤（保留字，用 logGroupCol）
}
```

现有索引可用：`created_at`、`user_id`、`model_name`、`token_id`、`username`、`(username, model_name)` 等，足以支撑按这些列的 `GROUP BY` 与时间范围扫描。

---

## 3. API 设计

全部注册在 `logRoute`（`/api/log`）下，强制 `middleware.AdminAuth()`，与 `/api/log/detail` 等保持一致。

### 3.1 维度排行（含可选二级下钻）

```
GET /api/log/attribution
```

| 参数 | 说明 |
|------|------|
| `dimension` | 一级维度：`user` / `token` / `model`（必填） |
| `sub` | 二级维度（下钻用，可选）：`model` / `token` / `user` |
| `parent_id` | 下钻时一级维度的主键值（如 token_id；模型维度用 model_name） |
| `start` / `end` | unix 秒，时间范围（可空） |
| `username` / `token_name` / `model_name` | 文本过滤（沿用 `applyExplicitLogTextFilter`，支持 `%` LIKE） |
| `channel` | 渠道 id（可空） |
| `group` | 分组（可空，列用 `logGroupCol`） |
| `top` | 返回行数上限（默认如 50） |

**返回**（统一结构，下钻时即"某 parent 下按 sub 维度的排行"）：

```json
{
  "success": true,
  "data": {
    "dimension": "token",
    "total": { "quota": 17660, "prompt_tokens": 12345, "completion_tokens": 6789, "count": 321 },
    "rows": [
      {
        "key": "42",                 // 主键（token_id / user_id 字符串化；模型用 model_name）
        "label": "cc-switch",        // 展示名（token_name / username / model_name）
        "quota": 9000,
        "prompt_tokens": 8000,
        "completion_tokens": 3000,
        "count": 120
      }
    ]
  }
}
```

> 一级请求不带 `sub`/`parent_id`；下钻请求带 `sub` + `parent_id`，后端追加一个 `WHERE 一级列 = parent_id` 并改为按 `sub` 列 `GROUP BY`。

### 3.2 趋势

```
GET /api/log/attribution/trend
```

| 参数 | 说明 |
|------|------|
| `dimension` | `user` / `token` / `model` |
| 同上过滤参数 | start/end/username/token_name/model_name/channel/group |
| `top` | 取费用 Top-N 个 key 画线（默认如 5） |

**返回**：按天分桶的多序列：

```json
{
  "success": true,
  "data": {
    "buckets": [19519, 19520, 19521],   // 天序号（created_at / 86400）
    "series": [
      { "key": "gpt-5.5", "points": [120, 300, 80] },
      { "key": "deepseek-chat", "points": [5, 8, 2] }
    ]
  }
}
```

> 前端把天序号 `bucket * 86400` 还原成日期展示。

---

## 4. 聚合实现（`model/log.go`）

### 4.1 公共过滤构造

抽出与 `GetAllLogs` 一致的过滤构造，避免重复：

```go
func applyAttributionFilters(tx *gorm.DB, f AttributionFilter) (*gorm.DB, error) {
    tx = tx.Where("logs.type = ?", LogTypeConsume)
    var err error
    if tx, err = applyExplicitLogTextFilter(tx, "logs.model_name", f.ModelName); err != nil { return nil, err }
    if tx, err = applyExplicitLogTextFilter(tx, "logs.username", f.Username); err != nil { return nil, err }
    if f.TokenName != "" { tx = tx.Where("logs.token_name = ?", f.TokenName) }
    if f.Start != 0 { tx = tx.Where("logs.created_at >= ?", f.Start) }
    if f.End != 0 { tx = tx.Where("logs.created_at <= ?", f.End) }
    if f.Channel != 0 { tx = tx.Where("logs.channel_id = ?", f.Channel) }
    if f.Group != "" { tx = tx.Where("logs."+logGroupCol+" = ?", f.Group) }
    return tx, nil
}
```

### 4.2 维度 → 列映射

```go
// 返回 (groupCol, labelCol)；model 维度 key 与 label 同列。
func dimensionColumns(dim string) (string, string, error) {
    switch dim {
    case "user":  return "user_id", "username", nil
    case "token": return "token_id", "token_name", nil
    case "model": return "model_name", "model_name", nil
    }
    return "", "", errors.New("invalid dimension")
}
```

### 4.3 排行聚合（跨库安全）

> ⚠️ 现有 `SumUsedToken` 用了 `ifnull(...)`，那是 MySQL/SQLite 语法，**PostgreSQL 不支持**。新代码统一用 **`COALESCE`**（三库通用）。

```go
keyCol, labelCol, _ := dimensionColumns(f.Dimension)
selectExpr := fmt.Sprintf(
    "%s AS gkey, MAX(%s) AS glabel, "+
    "COALESCE(SUM(quota),0) AS quota, "+
    "COALESCE(SUM(prompt_tokens),0) AS prompt_tokens, "+
    "COALESCE(SUM(completion_tokens),0) AS completion_tokens, "+
    "COUNT(*) AS count",
    keyCol, labelCol,
)
// 下钻：换成 sub 维度的列，并追加父过滤
if f.Sub != "" && f.ParentId != "" {
    keyCol2, labelCol2, _ := dimensionColumns(f.Sub)
    tx = tx.Where(parentCol+" = ?", f.ParentId) // parentCol = 一级 keyCol
    keyCol, labelCol = keyCol2, labelCol2
}
tx = tx.Table("logs").Select(selectExpr).Group(keyCol).Order("quota DESC").Limit(top)
```

- 用 `MAX(label)` 取一个展示名（同一 id 的 name 快照基本一致；模型维度 key==label）。
- 主键统一以字符串返回（`user_id`/`token_id` → 字符串），`model_name` 本身即字符串。

### 4.4 总计

单独一条不分组的聚合（用于汇总卡片 + 占比分母）：

```go
tx.Table("logs").Select(
  "COALESCE(SUM(quota),0) quota, COALESCE(SUM(prompt_tokens),0) prompt_tokens, "+
  "COALESCE(SUM(completion_tokens),0) completion_tokens, COUNT(*) count")
```

### 4.5 按天分桶（趋势，跨库整除）

整除在三库行为不同：PG/SQLite 整数 `/` 即整除，MySQL `/` 返回小数（需 `DIV`）。按 DB 分支：

```go
bucketExpr := "created_at / 86400"
if common.UsingMySQL {
    bucketExpr = "created_at DIV 86400"
}
// 趋势 = 先取 Top-N key，再对这些 key 做 GROUP BY (bucket, keyCol)
tx.Table("logs").
   Select(bucketExpr+" AS bucket, "+keyCol+" AS gkey, COALESCE(SUM(quota),0) AS quota").
   Where(keyCol+" IN ?", topKeys).
   Group("bucket, "+keyCol).
   Order("bucket ASC")
```

在 Go 侧把结果整理成 `buckets[] + series[]`（缺失桶补 0）。

> 时区：默认按 UTC（`created_at` 是 unix 秒）分桶。如需按本地时区，可在分桶前对 `created_at` 加固定偏移（`(created_at + tzOffset) / 86400`），实现时确认。

---

## 5. 控制器（`controller/log.go`）

新增：
- `GetLogAttribution(c)`：解析 query → 组 `AttributionFilter` → 调 model 聚合 → 返回 `{total, rows}`。
- `GetLogAttributionTrend(c)`：同上，返回趋势序列。

参数解析复用现有日志控制器对 `start_timestamp`/`end_timestamp`/`username`/`token_name`/`model_name`/`channel`/`group` 的取值方式，保持命名一致。

> 纵深防御：控制器内不依赖前端，路由层 `AdminAuth()` 已强制；与 `GetRequestDetail` 一致。

---

## 6. 路由（`router/api-router.go`）

在 `logRoute` 下追加（紧邻 `/detail`）：

```go
logRoute.GET("/attribution", middleware.AdminAuth(), controller.GetLogAttribution)
logRoute.GET("/attribution/trend", middleware.AdminAuth(), controller.GetLogAttributionTrend)
```

---

## 7. 前端（`web/default/src/features/dashboard`）

### 7.1 结构
- 在看板 `section-registry.tsx` 注册 `attribution` section（`adminOnly`），与 概览/模型调用分析/用户统计 并列；`index.tsx` 加管理员门控、懒加载与渲染分支。
- 新增 `components/attribution/attribution-charts.tsx`：容器组件（维度选择器 + 时间预设 + Top-N + 汇总卡片 + VChart 趋势 + 可展开下钻排行表）。
- 新增 `lib/attribution-chart.ts`：按看板 VChart 约定构建趋势图 spec。

### 7.2 数据
- `dashboard/api.ts` 新增 `getLogAttribution(params)`、`getLogAttributionTrend(params)`。
- React Query：`queryKey` 含维度 + 时间范围；下钻用独立 query（`queryKey` 含 `parentKey`），点击展开时按需请求。

### 7.3 展示
- 金额：`quota / QuotaPerUnit`，复用日志页现有金额格式化。
- 占比：行 `quota / total.quota`，渲染占比条。
- i18n：所有新文案加入 6 个 locale（en 为基准，zh 兜底，fr/ja/ru/vi）。

---

## 8. 涉及文件（预估）

- `model/log.go`：新增 `AttributionFilter`、`GetLogAttribution`、`GetLogAttributionTrend` 及辅助函数。
- `controller/log.go`：新增 `GetLogAttribution`、`GetLogAttributionTrend`。
- `router/api-router.go`：注册 2 个路由（AdminAuth）。
- `web/default/src/features/dashboard/`：section 注册 + `components/attribution/attribution-charts.tsx` + `lib/attribution-chart.ts` + `api.ts` + `types.ts`。
- `web/default/src/i18n/locales/*.json`：新增文案（6 语言）。
- `docs/features/cost-attribution*.md`：本套文档。

---

## 9. 三库兼容清单（务必遵守）

- 聚合空值用 **`COALESCE`**，禁用 `ifnull`（PG 不支持）。
- 按天分桶：MySQL 用 `DIV`，PG/SQLite 用 `/`（按 `common.UsingMySQL` 分支）。
- `group` 列用 `logGroupCol`（保留字）。
- 全程用 GORM 链式 + 参数占位，不拼裸 SQL 字面量值。
- 不使用任何库专有函数（如 PG `date_trunc`、MySQL `DATE_FORMAT`）——日期处理放 Go 侧或用整除分桶。

---

## 10. 测试

- 后端单测：构造跨用户/令牌/模型/时间的消费日志，断言三维聚合、占比、下钻、按天趋势数值正确；覆盖空结果。
- 三库：本地至少在 SQLite 跑通；MySQL/PG 重点验证 `COALESCE` 与分桶分支。
- 鉴权：非管理员 token 调 `/api/log/attribution` 返回 403。
- 一致性：同条件下，汇总卡片合计 == 日志明细合计。
