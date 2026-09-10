# 调用日志排行榜语义迁移设计

## 背景

源项目 `/Users/luodashuaige/Documents/claude_code2/new-api-main` 已实现调用日志用户排行榜，包括实时聚合接口、按用户排行、概览指标、筛选、分页、Top 10 高亮和按分组展开明细。目标项目已经演进为双前端结构：

- `web/classic`：React + Semi UI，和源实现技术体系接近。
- `web/default`：React 19 + TypeScript + Base UI + TanStack，不能直接复用源 JSX 组件。

目标项目的日志后端还新增了 ClickHouse 日志库、受控模糊搜索、额外日志字段和新的前端功能。迁移必须保留这些现有能力，不能用源文件覆盖目标文件。

## 已确认的产品决策

- 同时迁移到 `web/classic` 和 `web/default`。
- 使用实时 SQL 聚合，不新增预聚合表、定时任务或缓存。
- 排行榜仅超级管理员（Root，角色值 100）可见和访问。
- 完整保留用户行展开后的分组统计。
- Classic 按目标项目当前 Semi UI、CardPro 和 CardTable 风格重新设计；Default 按当前 Base UI 风格重新设计。两套前端共享功能和数据口径，不要求视觉一致。
- 技术细节由实现者根据任务目标自主决策，不要求用户逐项确认。

## 目标

- 在调用日志页面增加“日志明细 / 排行榜”切换。
- 默认统计今天 00:00:00 至当前时间后 1 小时，与现有日志页默认范围一致。
- 默认按消费额度降序，允许切换为按调用次数降序。
- 支持时间、模型名称、分组和渠道 ID 筛选。
- 展示消费、调用、Tokens、耗时、错误率、流式占比、模型数和最近调用时间。
- 展开用户行后展示按日志分组聚合的同类指标，以及令牌数和渠道数。
- Top 1、Top 2、Top 3 使用最明显的视觉层级，Top 4–10 使用次级高亮。
- 后端兼容 SQLite、MySQL >= 5.7.8、PostgreSQL >= 9.6，以及目标项目已有的 ClickHouse 日志库。
- 不影响现有日志明细、渠道亲和缓存、参数覆盖、敏感字段显示及其他日志能力。

## 非目标

- 不向普通用户或普通管理员开放排行榜。
- 不提供全站公开排行。
- 不新增统计表、数据库迁移、后台任务或 Redis 缓存。
- 不支持按错误率、Tokens、耗时或最近调用时间排序。
- 不跨日志库和主库关联用户表。
- 不回溯用户改名，用户名使用日志写入时的快照。
- 不迁移源接口中已经不被最终页面使用的独立 `top10` 返回字段。

## 总体架构

一套后端接口同时服务两套前端：

```text
Classic 排行榜 ─┐
                 ├─ GET /api/log/ranking ─ Controller ─ Model 聚合查询 ─ LOG_DB
Default 排行榜 ─┘
```

后端仍遵循 Router → Controller → Model 的现有日志查询模式：

- Router：注册 Root 权限路由。
- Controller：解析查询参数、补默认时间、返回分页响应。
- Model：构造跨数据库兼容的聚合查询、计算衍生比例并组装结果。

排行聚合放在独立的 `model/log_ranking.go`，避免把约 300 行查询和 DTO 继续堆入已较大的 `model/log.go`。该文件表达稳定的“调用日志排行”领域能力，并由独立测试直接保护。

## 权限模型

后端路由：

```http
GET /api/log/ranking
```

注册到 `/api/log` 路由组，使用：

```go
middleware.RootAuth()
```

前端使用双重保护：

- Classic 使用现有 `isRoot()` 判断是否渲染排行榜 Tab。
- Default 使用 `useAuthStore` 和 `ROLE.SUPER_ADMIN` 判断是否渲染排行榜 Tab。
- 排行榜请求只在 Root 用户且排行榜 Tab 激活时启用。
- 即使前端状态过期或被绕过，后端 `RootAuth` 仍是最终权限边界。

普通用户和普通管理员继续看到原有日志页面，不出现空白 Tab、占位入口或权限提示。

## API 设计

### 查询参数

| 参数 | 类型 | 默认值 | 规则 |
| --- | --- | --- | --- |
| `start_timestamp` | int64 | 今天 00:00:00 | Unix 秒；非空时必须为非负整数 |
| `end_timestamp` | int64 | 当前时间 + 1 小时 | Unix 秒；必须不小于开始时间 |
| `model_name` | string | 空 | 复用现有日志受控搜索语义；默认精确匹配，显式 `%` 才模糊匹配 |
| `group` | string | 空 | 精确匹配日志分组 |
| `channel` | int | 0 | 0 表示不限；非空时必须为非负整数 |
| `sort_by` | string | `quota` | 仅允许 `quota`、`request_count`；非法值回退 `quota` |
| `p` | int | 1 | 小于 1 时回退 1 |
| `page_size` | int | 20 | 小于 1 时回退 20，最大 100 |

排序固定为降序。接口不接受 `sort_order`，避免暴露两套前端都不需要的能力。

### 成功响应

```json
{
  "success": true,
  "message": "",
  "data": {
    "page": 1,
    "page_size": 20,
    "total": 128,
    "items": [
      {
        "rank": 1,
        "user_id": 42,
        "username": "user-a",
        "quota": 123456,
        "request_count": 88,
        "prompt_tokens": 1000,
        "completion_tokens": 2000,
        "total_tokens": 3000,
        "avg_use_time": 12.4,
        "stream_count": 40,
        "stream_ratio": 0.4545,
        "error_count": 3,
        "error_rate": 0.0329,
        "model_count": 5,
        "token_count": 4,
        "group_count": 2,
        "channel_count": 3,
        "last_used_at": 1777910000,
        "group_stats": [
          {
            "group": "default",
            "quota": 100000,
            "request_count": 70,
            "prompt_tokens": 800,
            "completion_tokens": 1600,
            "total_tokens": 2400,
            "avg_use_time": 11.8,
            "stream_count": 36,
            "stream_ratio": 0.5143,
            "error_count": 2,
            "error_rate": 0.0278,
            "model_count": 4,
            "token_count": 3,
            "channel_count": 2,
            "last_used_at": 1777910000
          }
        ]
      }
    ],
    "summary": {
      "quota": 12345678,
      "request_count": 9000,
      "prompt_tokens": 30000000,
      "completion_tokens": 15678901,
      "total_tokens": 45678901,
      "active_user_count": 128
    }
  }
}
```

聚合总量使用 `int64`，比例和平均耗时使用 `float64`，避免高流量时间范围内 `int32` 溢出。前端继续使用 JavaScript number 展示，并通过现有格式化函数压缩为 K/M/B 等单位。

### 空结果

- `items` 返回空数组，不返回 `null`。
- `summary` 所有字段返回 0。
- `total` 返回 0。
- 空结果仍返回成功，不显示错误提示。

## 统计口径

### 用户聚合维度

按以下两个字段联合分组：

- `user_id`
- `username`

同一用户 ID 在不同时期使用不同用户名时，保留为不同排行项。这与日志快照语义一致，也避免跨 `LOG_SQL_DSN` 关联主库用户表。

### 消费指标

只统计 `logs.type = LogTypeConsume`：

- `quota`：`SUM(quota)`
- `request_count`：`COUNT(*)`
- `prompt_tokens`：`SUM(prompt_tokens)`
- `completion_tokens`：`SUM(completion_tokens)`
- `total_tokens`：输入和输出 Tokens 之和
- `avg_use_time`：`AVG(use_time)`
- `stream_count`：流式消费日志数量
- `model_count`：不同模型名数量
- `token_count`：不同令牌 ID 数量
- `group_count`：不同分组数量
- `channel_count`：不同渠道 ID 数量
- `last_used_at`：最大 `created_at`

### 错误指标

同一筛选范围内统计 `logs.type = LogTypeError`：

- `error_count`：错误日志数量
- `error_rate`：`error_count / (request_count + error_count)`

错误日志和消费日志不保证一一对应，因此错误率只作为运营稳定性参考，不参与默认排序。

### 比例计算

数据库只返回整数计数，以下比例统一在 Go 中计算：

- `stream_ratio = stream_count / request_count`
- `error_rate = error_count / (request_count + error_count)`

分母为 0 时返回 0。把除法放在 Go 中可以消除 MySQL、PostgreSQL、SQLite 和 ClickHouse 在整数除法、类型提升与扫描类型上的差异。

## 查询计划与性能边界

每次请求最多执行 5 组查询：

1. 对消费日志按 `user_id, username` 分组的子查询计数，得到活跃用户总数。
2. 对全部筛选后消费日志计算概览汇总。
3. 查询当前页用户排行数据。
4. 仅针对当前页用户查询分组消费统计。
5. 仅针对当前页用户查询分组错误统计，同时在 Go 中累加得到用户错误总数。

相较源实现做两项收敛：

- 删除未被最终页面使用的独立 Top 10 查询和 `top10` 返回字段。
- 错误与分组统计只查询当前页最多 100 个用户，不扫描并返回所有用户的错误聚合结果。

所有筛选条件在 `GROUP BY` 前进入数据库查询。当前页用户范围使用带参数的 `(user_id = ? AND username = ?)` 条件组合，最多 100 组，不拼接用户输入。

首版不增加索引：目标日志表已有类型、时间、用户、模型、分组和渠道相关索引。上线后如果真实日志量导致实时聚合不可接受，再在保持接口不变的前提下评估日统计表；该优化不属于本次迁移。

## 数据库兼容策略

- 使用 GORM 构造查询和绑定参数。
- 保留 `logGroupCol` 处理 `group` 保留字在不同数据库中的引用方式。
- 模型名称筛选复用 `applyExplicitLogTextFilter`，继承标准数据库和 ClickHouse 的不同转义策略。
- 流式计数使用各数据库均支持的 `SUM(CASE WHEN is_stream THEN 1 ELSE 0 END)`。
- 不使用窗口函数，兼容 MySQL 5.7.8 和 PostgreSQL 9.6。
- 不使用数据库特有 JSON、FILTER、ILIKE 或 ClickHouse 专有聚合函数。
- 排行使用分页偏移量在 Go 中计算：`rank = (page - 1) * page_size + index + 1`。
- 排序字段通过常量白名单映射，绝不直接拼接任意查询参数。

## Classic 前端设计

### 集成方式

修改 `web/classic/src/components/table/usage-logs/index.jsx` 时只增加 Root Tab 容器，不替换现有日志内容。以下现有能力必须原样保留：

- 列选择弹窗
- 用户信息弹窗
- 渠道亲和缓存弹窗
- 参数覆盖弹窗
- 当前日志操作、筛选、分页和表格

非 Root 用户直接渲染当前日志内容。Root 用户看到：

- `日志明细`：当前完整日志页面
- `排行榜`：新增排行榜页面

使用 Semi UI `Tabs` 的懒渲染能力，只有首次进入排行榜时才加载数据。

### 新增组件

- `web/classic/src/hooks/usage-logs/useUsageRankingData.jsx`
- `web/classic/src/components/table/usage-logs/ranking/UsageRankingTab.jsx`
- `web/classic/src/components/table/usage-logs/ranking/UsageRankingFilters.jsx`
- `web/classic/src/components/table/usage-logs/ranking/UsageRankingSummary.jsx`
- `web/classic/src/components/table/usage-logs/ranking/UsageRankingTable.jsx`
- `web/classic/src/components/table/usage-logs/ranking/usage-ranking-table.css`

源组件仅作为功能、字段和交互行为参考。Classic 页面按目标分支当前的 Semi UI、CardPro、CardTable、筛选区和弹窗组织方式重新实现；只选择性复用不与当前设计冲突的纯逻辑，不能直接复制源页面样式或用源文件覆盖目标文件。

### 视觉与交互

- 使用当前 Classic 日志页已有的 CardPro 页面骨架、CardTable 表格、Semi UI Form/Tabs/Pagination 和主题变量，不复刻源截图的卡片尺寸、边框、间距或固定配色。
- 顶部四项概览采用 Classic 现有统计卡/信息块语言：总消费额度、总调用次数、总 Tokens、活跃用户数。
- 筛选区遵循当前日志页的字段密度、栅格断点、按钮层级和折叠方式，包含日期时间范围、模型名称、分组、渠道 ID、排序方式。
- 查询按钮应用草稿筛选并回到第 1 页；重置恢复默认今天和消费排序。
- 排名标签、前十名层级和展开按钮使用 Semi UI Tag、Typography、Icon 与 `var(--semi-color-*)` 主题变量重新设计；强调清晰但不引入与现有 Classic 页面割裂的独立视觉系统。
- 点击用户行展开使用紧凑型 CardTable 展示分组统计，并继承当前表格的表头、行高、空状态和暗色模式。
- 宽表在窄屏下遵循 Classic 现有横向滚动与分页布局，不遮挡筛选、分页或展开区域。
- 所有自定义样式限定在排行榜根类名下，不能污染现有日志表或全局 Semi UI 组件。
- 分页大小使用独立键 `usage-ranking-page-size`，默认 20，可选 10、20、50、100，不污染日志明细的分页偏好。

## Default 前端设计

### 集成方式

`web/default/src/features/usage-logs/index.tsx` 保持现有 `/usage-logs/$section` 路由和 section registry 不变。排行榜不是新的日志类型，也不加入 `common | drawing | task` 联合类型。

当且仅当以下条件同时满足时显示内层 Tab：

- 当前 section 为 `common`
- 当前用户角色为 `ROLE.SUPER_ADMIN`

Tab 状态保存在组件本地，默认 `details`。刷新后回到日志明细，与源页面行为一致，也避免新增路由和生成文件变更。

### 新增组件

- `web/default/src/features/usage-logs/components/ranking/usage-ranking-view.tsx`
- `web/default/src/features/usage-logs/components/ranking/usage-ranking-filter-bar.tsx`
- `web/default/src/features/usage-logs/components/ranking/usage-ranking-summary.tsx`
- `web/default/src/features/usage-logs/components/ranking/usage-ranking-columns.tsx`
- `web/default/src/features/usage-logs/components/ranking/usage-ranking-table.tsx`
- `web/default/src/features/usage-logs/components/ranking/usage-ranking-mobile-list.tsx`

现有文件调整：

- `web/default/src/features/usage-logs/types.ts`：增加 API DTO 和筛选类型。
- `web/default/src/features/usage-logs/api.ts`：增加 `getUsageRanking`。
- `web/default/src/features/usage-logs/index.tsx`：增加 Root Tab 和视图切换。

### 数据获取

使用 React Query：

- 查询键包含已应用筛选、页码和页大小。
- 只在 Root 用户且排行榜 Tab 激活时启用。
- 输入框使用草稿状态，点击查询后才更新已应用筛选，避免每次键入触发聚合 SQL。
- 翻页时保留上一页数据直到新数据返回，避免表格闪空。
- 修改筛选或排序时回到第 1 页。
- 不在客户端对日志明细或当前页结果二次聚合。

### 视觉与响应式

- 使用当前项目的 Card、Tabs、Button、Input、Select、日期范围选择器和 DataTable 组件。
- 桌面端保留相同的数据字段和操作能力，但由 Default 自主确定最符合当前页面的信息顺序、圆角、颜色变量、暗色主题和表格密度，不追求与 Classic 像素级一致。
- 通过 TanStack Table 的展开状态和 `DataTablePage.renderRow` 渲染用户行与全宽分组明细行。
- Top 1–3 和 Top 4–10 使用主题感知的轻量背景和左侧强调条，不复制 Semi UI CSS 变量。
- 移动端使用专用卡片列表，首屏显示排名、用户、消费、调用、Tokens、错误率和最近调用时间；展开后显示其余指标与分组明细。
- 所有展开按钮包含 `aria-expanded` 和可翻译的 `aria-label`，图标标记为装饰性。

## 国际化

两套前端所有新增用户文案必须通过各自的 `useTranslation()` 调用。

Default 使用英文源字符串作为 key，并同步：

- `web/default/src/i18n/locales/en.json`
- `web/default/src/i18n/locales/zh.json`
- 其余现有语言文件

Classic 沿用中文源字符串 key，并同步 `web/classic/src/i18n/locales/` 下现有语言。

至少覆盖以下概念：

- 日志明细、排行榜
- 总消费额度、总调用次数、总 Tokens、活跃用户数
- 排名、用户、输入、输出、平均耗时、错误率、流式占比、模型数、令牌数、渠道数、最近调用时间
- 按消费额度、按调用次数、暂无排行榜数据、暂无分组统计、加载排行榜失败
- 展开分组统计、收起分组统计、未分组、未知用户

实现阶段分别运行两套前端的 `i18n:sync`，并检查所有语言文件没有遗留未翻译的英文或中文源值。

## 异常处理

### 后端

- 非法时间戳、负渠道 ID、开始时间晚于结束时间：返回 HTTP 400 和稳定错误消息。
- 非法排序字段：回退 `quota`，不进入 SQL。
- 数据库查询失败：通过现有日志设施记录原始错误，接口返回统一失败响应。
- 空用户名：前端显示 `用户 #<user_id>`；用户 ID 也无效时显示“未知用户”。
- 空分组：前端显示“未分组”。
- 任一比例分母为 0：返回 0。
- 查询结果切片初始化为空数组，避免 JSON `null`。

### 前端

- 首次加载显示骨架屏。
- 后续刷新显示轻量加载状态并保留旧数据。
- 接口失败显示统一 Toast，不清除当前筛选条件。
- 空结果显示明确空状态，不展示全零伪排行行。
- Root 身份在会话中失效时，隐藏排行榜并停止后续请求；后端 403 仍由全局错误处理兜底。

## 测试与验证

### 后端自动化测试

新增 `model/log_ranking_test.go`，使用 `testify/require` 完成设置和致命断言，使用 `testify/assert` 完成可继续的值检查。测试保护以下可观察契约：

- 默认按消费额度降序，汇总字段正确。
- 按调用次数降序，排名随排序口径变化。
- 时间、模型、分组和渠道筛选同时作用于消费与错误统计。
- 用户错误次数和错误率正确。
- 分组消费、错误率、流式占比、模型数、令牌数、渠道数和最近调用时间正确。
- 同一用户 ID 的不同用户名快照保持独立。
- 分页后的全局 rank 正确。
- 空结果返回空数组和零值 summary。
- 非法排序回退、页码和页大小边界正确。
- 模型筛选复用受控模糊搜索规则。
- 测试结束后恢复 `DB`、`LOG_DB` 和日志数据库类型，不能污染其他测试。

SQLite 集成测试用于验证聚合契约；SQL 结构同时避免使用 MySQL 5.7、PostgreSQL 9.6 或 ClickHouse 不支持的语法。现有 ClickHouse 辅助测试补充排行查询所依赖的搜索转义和列引用检查，不伪造无法代表真实数据库行为的测试。

### Classic 验证

- Root 显示两个 Tab；管理员和普通用户不显示排行榜。
- 进入排行榜后才发起请求。
- 默认今天、筛选、重置、排序、分页和分页大小生效。
- 用户行可展开分组统计。
- Top 1–10 样式、暗色模式、空状态和窄屏横向滚动正常。

### Default 验证

- Root 在 Common Logs 看到两个 Tab，其他日志 section 和角色不显示排行榜。
- React Query 不在隐藏状态预取聚合数据。
- 筛选只在点击查询后执行，翻页不会重置筛选。
- 桌面展开行和移动卡片展开均可操作。
- 键盘、焦点、`aria-expanded`、暗色主题和窄屏布局正常。

### 验收命令

```bash
go test ./model -run 'TestGetUsageRanking' -count=1
go test ./...

cd web/default
bun run i18n:sync
bun run typecheck
bun run lint
bun run format:check
bun run build

cd ../classic
bun run i18n:sync
bun run eslint
bun run lint
bun run build
```

如果 i18n 同步命令会机械修改大量与本功能无关的历史条目，实施时只保留本次新增 key 的必要变更，并记录工具输出。

## 文件变更范围

### 后端

- 创建 `model/log_ranking.go`
- 创建 `model/log_ranking_test.go`
- 修改 `controller/log.go`
- 修改 `router/api-router.go`

### Classic

- 创建 `web/classic/src/hooks/usage-logs/useUsageRankingData.jsx`
- 创建 `web/classic/src/components/table/usage-logs/ranking/` 下排行榜组件和样式
- 修改 `web/classic/src/components/table/usage-logs/index.jsx`
- 修改 `web/classic/src/i18n/locales/` 下现有语言文件

### Default

- 创建 `web/default/src/features/usage-logs/components/ranking/` 下排行榜组件
- 修改 `web/default/src/features/usage-logs/api.ts`
- 修改 `web/default/src/features/usage-logs/types.ts`
- 修改 `web/default/src/features/usage-logs/index.tsx`
- 修改 `web/default/src/i18n/locales/` 下现有语言文件

不修改数据库模型、迁移、日志写入链路、计费逻辑、公共排行榜页面或受保护的项目身份信息。

## 实施顺序

1. 先实现和测试后端排行聚合与 Root 接口，固定数据契约。
2. 迁移 Classic 排行榜，验证源功能在目标分支上的行为完整性。
3. 基于同一接口实现 Default 原生页面和移动端布局。
4. 同步两套前端国际化并完成角色、暗色和响应式检查。
5. 执行全量后端测试、两套前端静态检查和生产构建。

每个阶段都保持可独立评审：后端不依赖前端，Classic 和 Default 只依赖稳定接口，任何一套前端的问题都不会阻止另一套验证。

## 发布与回滚

本功能为加法变更且没有数据库迁移：

- 发布时先部署包含后端接口和两套前端的同一版本，避免前端请求不存在的接口。
- 默认只在 Root 页面首次打开排行榜时触发聚合，不改变普通请求流量。
- 回滚时移除或隐藏两个前端入口并删除路由即可；日志数据和数据库结构不受影响。

## 验收标准

- Root 能在 Classic 和 Default 的调用日志页查看相同统计口径的排行榜。
- 普通管理员和普通用户看不到入口，直接访问接口也无法取得数据。
- 默认今天、四个筛选项、两种排序、分页和重置均正常。
- 概览值等于当前筛选范围内消费日志聚合值。
- 用户排行、错误率、流式占比和分组展开值与测试数据完全一致。
- Top 1–10 视觉层级明确；Classic 和 Default 分别使用各自现有设计语言，不复制源项目截图样式，也不跨前端复用视觉组件。
- SQLite、MySQL、PostgreSQL 和 ClickHouse 路径不包含已知不兼容 SQL。
- 不回归现有日志明细页功能。
- 后端测试、Default 类型检查/代码检查/构建以及 Classic 代码检查/构建全部通过。

## 展开详情扩展：模型与渠道消耗分布

用户展开行继续以分组为第一层语义边界，但每个分组除原有汇总指标外，必须直接展示两类组内分布：

- 模型分布：模型名称、消费额度、组内消费占比、调用次数、输入/输出及总 Tokens。
- 渠道分布：渠道名称与渠道 ID、消费额度、组内消费占比、调用次数、输入/输出及总 Tokens。

后端在当前页用户范围内分别按 `user_id, username, group, model_name` 和 `user_id, username, group, channel_id` 执行两次批量聚合，不允许前端展开时发起 N+1 请求。消费占比统一在 Go 中按分组消费额度计算；分组消费为 0 时占比返回 0。模型和渠道均按消费额度、调用次数降序排列，并使用名称或 ID 做稳定排序。

渠道 ID 是日志事实字段。渠道名称从主库 `channels` 表批量补充，已删除或无法匹配的渠道仍保留 ID 并由前端显示为未知渠道。`model_stats` 与 `channel_stats` 始终返回数组而不是 `null`，从而保持两套前端的数据契约一致。

Classic 使用 Semi Design 原生卡片、表格和进度条表达两类分布；Default 使用现有 Base UI/Tailwind 卡片、表格与语义色。桌面端展示紧凑明细表，移动端展示可换行的分布卡片，不增加额外展开层级。
