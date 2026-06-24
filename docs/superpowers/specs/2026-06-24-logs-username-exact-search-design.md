# 日志用户名搜索恢复"默认精确，显式 `%` 才模糊" — 设计文档

- **日期**: 2026-06-24
- **关联 issue**: [#222](https://github.com/SolveaCX/new-api/issues/222) fix(logs): username 搜索不应默认子串模糊导致日志查询慢
- **分支**: `fix/logs-username-exact-222`（基于 `origin/main`）
- **状态**: 设计已确认，待实现

## 1. 背景与问题

生产控制台（`console.flatkey.ai`）日志页按用户名精确查询时，后端把纯文本输入
`username=google_765` 自动改写成**前导通配模糊**搜索：

```sql
logs.username LIKE '%google!_765%' ESCAPE '!' OR logs.user_id IN (765)
```

前导 `%` 使 `logs.username` 索引失效，在百万级 `logs` 表上全表扫描。生产实测：

| 接口 | 耗时 | Rows_examined |
|---|---|---|
| `/api/log/` | ~30.02s | 2,484,366 |
| `/api/log/stat` | ~28.41s | 2,474,251 |

### 根因（双重历史）

按提交时间排序：

1. `31c13db5`（#203，06-22 19:27）— 曾把用户名搜索改为"默认精确、含 `%` 才模糊"。
2. `5f6a9b25`（#181，06-23 16:11）— 又改回"纯文本自动 `%kw%` 子串模糊"，并合入 `main`。

`main` 当前的 `applyLogUsernameFilter`（`model/log.go`）对纯文本关键词（≥2 字符）
默认调用 `applyFuzzyUsernameFilter(tx, ..., "%"+value+"%")`，即 #222 抱怨的慢查询。

> 注：当前 `feat/staging-env` 分支恰好 fork 在 #203 与 #181 之间，其代码已是"默认精确"，
> 但落后 `main` 约 40 个提交且缺少 `main` 后续增强（超限降级、self-stat 越权防护等），
> 故**不**以 staging 旧版覆盖，而是基于 `origin/main` 仅翻转默认行为。

## 2. 目标与非目标

### 目标
- 纯文本用户名（含 `google_765` 这类含下划线的完整名）默认走**精确匹配**，
  生成可走索引的 `username = ? OR user_id IN (?)`，消除 #222 的 ~30s 慢查询。
- 保留"显式 `%`"的模糊能力：用户在输入框输入含 `%` 的模式时仍走 `LIKE`。
- 保留通过 user 表把用户名解析成 `user_id` 以补齐"用户改名前历史日志"的增强。
- `/api/log/`（`GetAllLogs`）与 `/api/log/stat`（`SumUsedQuota`）两条调用链同时覆盖。

### 非目标（保持不动）
- 前端输入框逻辑：不加自动补 `%`，不改交互。
- `SumUsedQuota` 的 `selfUserId` 身份约束（self-stat 越权防护）。
- `fuzzyUsernameUserIDLimit` 超限降级机制（显式模糊路径仍需要它）。
- `sanitizeLikePattern`（`model/token.go`）转义规则。
- 纯数字按 `user_id` 精确匹配的分支。

## 3. 方案

唯一改动文件：`model/log.go`，函数 `applyLogUsernameFilter`。
只改"纯文本关键词（≥2 字符）"这条**默认分支**，其余分支全部保留。

### 行为对照表

| 输入示例 | 改动前（main） | 改动后 |
|---|---|---|
| 空字符串 | 不过滤 | **不变** |
| `goo%le`（含 `%`） | 显式模糊 `LIKE 'goo%le'` | **不变** |
| `216`（纯数字） | `username = '216' OR user_id = 216` | **不变** |
| `x`（< 2 字符） | 精确 + user_id 补齐 | **不变** |
| **`google_765`（≥2 字符文本）** | **`LIKE '%google!_765%'`**（慢） | **`username = ? OR user_id IN (?)`**（精确，走索引） |

### 代码改动

改动前（默认分支）：

```go
// 纯文本关键词：自动子串模糊，管理员输入部分用户名即可命中。
return applyFuzzyUsernameFilter(tx, usernameColumn, userIDColumn, "%"+value+"%")
```

改动后：纯文本关键词走精确匹配，并经 user 表解析 user_id 补齐改名前历史日志。
注意改后 `< 2 字符`分支与`≥2 字符文本`分支逻辑完全一致，合并为一条精确路径：

```go
// 纯文本关键词：精确匹配用户名快照，并经 user 表把用户名解析成 user_id，
// 补齐用户改名前写入的历史日志（精确查询走索引，无前导通配扫描风险）。
userIDs, err := getUserIDsByUsernameFilter(value, false)
if err != nil {
    return nil, err
}
if len(userIDs) > 0 {
    return tx.Where("("+usernameColumn+" = ? OR "+userIDColumn+" IN ?)", value, userIDs), nil
}
return tx.Where(usernameColumn+" = ?", value), nil
```

由此 `utf8.RuneCountInString` 的 `< 2` 特判和 `unicode/utf8` import 不再需要（合并后统一精确）。
`applyFuzzyUsernameFilter` 仅剩"显式 `%`"一个调用者，保留不动。

### 显式 `%` 的语义（已与用户确认）

输入 `goo%le` 经 `sanitizeLikePattern` 校验（去 `%` 后 `goole` ≥2 字符，通过），生成：

```sql
logs.username LIKE 'goo%le' ESCAPE '!' OR logs.user_id IN (<user 表 LIKE 命中的 id>)
```

`%` 在中缀，模式以常量 `goo` 开头，索引仍可做前缀范围扫描，**不会**像前导 `%` 那样全表扫。
匹配"以 `goo` 开头、`le` 结尾、中间任意"：`google`/`goorgle`/`goole` ✅；`google_765`/`mygoogle` ❌。
用户若需前导模糊可显式输 `%google%`，此时会慢，但为用户主动选择，符合 #222 设计意图。

## 4. 生成 SQL 验收对照（#222）

- `username=google_765` → `(logs.username = 'google_765' OR logs.user_id IN (765))`
  —— 无 `LIKE '%...'`，走索引，#222 验收达标。
- `username=goo%le` → `LIKE 'goo%le' ESCAPE '!'` —— 显式模糊保留。
- `/api/log/` 与 `/api/log/stat` 共用同一 `applyLogUsernameFilter`，一处修复两接口同时生效。

## 5. 测试策略（TDD）

文件：`model/log_filter_test.go`（SQLite 内存库，无需外部 DB；基线现全 PASS）。

### 需翻转语义的现有用例
- `TestGetAllLogsFuzzyUsernameMatch`：当前断言"部分关键词 `google` 模糊命中 2 条"。
  改为精确语义 —
  - 搜完整名 `google_alice` → 命中该用户全部日志（当前名 + 改名前，经 user_id 补齐）。
  - 搜部分名 `google` → **期望 0 命中**（不再自动模糊）。
  - 原"超限降级（`over_limit_kw`）"子用例依赖默认 fuzzy，迁移到显式 `%` 路径下验证
    （如搜 `over_limit_kw%`），继续锁定 `fuzzyUsernameUserIDLimit` 降级逻辑。

### 新增用例
- `TestGetAllLogsExplicitWildcard`：输入含 `%`（如 `goo%le`）才走模糊，验证：
  - 命中 `goo` 开头 `le` 结尾的用户名；
  - 不命中前导不符的用户名（确认无系统自动前导 `%`）。
- 精确路径补齐历史日志：用户当前名 = `google_765`，另有改名前日志 `old_name`，
  搜 `google_765` 应经 user_id IN 同时命中两条。

### 需局部调整的用例
- `TestSumUsedQuotaSelfStatIsExactByUserID`：self-stat 越权防护主断言**不改**（self 路径本就走
  `selfUserId` 精确，与本次无关）。但其末尾有一句"管理员搜 `alice`（selfUserId=0）模糊命中
  `alice`/`alice2`/`malice`，quota=1110"的对照断言依赖**默认模糊** —— 改为默认精确后 `alice`
  只命中自己（quota=10）。需把该对照断言改成精确语义（want 10），并补一条显式 `%alice%` 仍命中
  1110 的对照。

### 保持不动的用例
- `TestGetAllLogsFiltersNumericUsernameAsUserID` / `TestSumUsedQuotaFiltersNumericUsernameAsUserID`
  （纯数字、引号、padding）—— 不改。

### 跨数据库
逻辑只用 `=` / `IN` / `LIKE ... ESCAPE '!'`，对 MySQL / PostgreSQL / SQLite 等价；
`sanitizeLikePattern` 已按三库兼容设计。回归测试在 SQLite 下跑，逻辑无库特有语法。

## 6. 风险与权衡

- **行为变化（已确认接受）**：管理员搜部分用户名 `google` 将不再出结果，需输完整名或显式 `goo%`。
  这是 #222 明确接受的取舍，前端不做自动补 `%`（否则退回慢查询）。
- **改名补齐仍生效**：精确匹配仍经 user 表解析 user_id，命中改名前历史日志，不丢能力。
- **影响面小**：单文件单函数默认分支，调用链与签名不变，回归面集中在 `log_filter_test.go`。
