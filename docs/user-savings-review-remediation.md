# 用户节省金额评审整改与性能加固方案

> 状态：已实施，待维护者复核
> 关联 PR：`QuantumNous/new-api#6499`
> 前置设计：`docs/user-savings-estimate-design.md`、`docs/user-savings-trend-design.md`
> 改造范围：CodeRabbit 首轮 9 条行内评论、10 条折叠建议、二次评审意见及本地复核发现
> 基准日期：2026-07-28

## 1. 背景

节省金额功能已经完成计费快照、历史日志受限回算、汇总/趋势 API、概览卡片、趋势图、日志详情和管理设置。PR 评审确认核心计费口径没有负数扣费、快照污染或跨用户数据泄露问题，但暴露了三类上线前风险：

1. 汇总和趋势接口会在请求线程中读取并解析最多 50000 条日志，当前路由没有搜索限流，也没有服务端结果缓存。
2. 前端存在货币配置来源不一致和装饰图标语义重复问题。
3. 俄语、越南语和繁体中文的部分文案虽然可读，但没有准确表达“估算”“覆盖”“已更新”和“本地定价”的业务含义。

此外，配置规范化、关系库索引和测试组织还存在可维护性问题。本文给出可直接实施和验收的整改方案，不改变节省金额的计费口径。

## 2. 改造目标

- 阻止单个用户通过重复请求放大日志扫描和 JSON/decimal 计算成本。
- 保证管理员无法把单次汇总扫描上限配置到不受控规模。
- 对相同查询复用短期结果，同时允许新日志在可接受时间内自然可见。
- 优化 SQLite、MySQL 和 PostgreSQL 的用户时间范围日志查询。
- 保持 ClickHouse 现有分区和排序结构，不在本 PR 触发表重建。
- 统一概览卡片和趋势图的货币换算来源。
- 修复首轮 9 条未解决行内评论、二次评审意见及具有真实行为风险的折叠建议。
- 用确定性测试保护 API、配置、缓存隔离、国际化和可访问性契约。

## 3. 非目标

- 不改写节省金额计算公式和逐请求非负钳制语义。
- 不把 JSON 日志快照改造成数据库专有 JSON 查询。
- 不新增汇总表、定时任务或外部分析服务。
- 不为 ClickHouse 修改 `ORDER BY`；此类变更需要独立迁移和历史数据回填方案。
- 不在本次整改中支持新的计费模式、任务类型或媒体计费。
- 不修改实际扣费、预扣费、结算、退款和消费日志写入流程。
- 不引入新的生产依赖；缓存和请求合并复用现有 `pkg/cachex` 与 `golang.org/x/sync/singleflight`。

## 4. 评审结论与优先级

### 4.1 未解决行内评论

| ID | 优先级 | 评审内容 | 结论 | 整改动作 |
| --- | --- | --- | --- | --- |
| R1 | P0 | 汇总/趋势扫描成本高且路由无限流 | 有效 | 增加搜索限流、硬上限、短 TTL 结果缓存和同键请求合并 |
| R2 | P1 | 已命名控件内的装饰图标未隐藏 | 有效 | 两处图标增加 `aria-hidden='true'` |
| R3 | P1 | 概览与趋势使用不同货币配置源 | 有效 | 两处统一读取 `system-config-store.currency` |
| R4 | P1 | 俄语丢失“估算”限定 | 有效 | 使用 `оценочную экономию` |
| R5 | P1 | 俄语 covered 与 coverage 不一致 | 有效 | 使用 `охваченных` / `Охваченные` |
| R6 | P1 | 俄语一次性重算使用未完成体 | 有效 | 使用 `Пересчитать` |
| R7 | P1 | 越南语更新时间像操作命令 | 有效 | 改为明确的完成状态 |
| R8 | P1 | 繁体中文“使用者”与现有术语不一致 | 有效 | 统一为“用戶” |
| R9 | P1 | 繁体中文“本機定价”含义错误 | 有效 | 统一为“本地定价” |

### 4.2 折叠建议

| ID | 优先级 | 建议 | 处理决定 |
| --- | --- | --- | --- |
| N1 | P2 | 测试 helper 参数遮蔽 `model` 包 | 接受，改名为 `modelName` |
| N2 | P2 | 循环内重复读取日志可见性设置 | 接受，循环外读取一次，保证整页一致 |
| N3 | P2 | `localPrices == nil` 分支可读性差 | 接受，显式拆分两个查价分支 |
| N4 | P2 | request-rules guard 拒绝条件缺少说明 | 接受，说明请求规则依赖日志中不存在的请求上下文 |
| N5 | P0 | 用户时间范围查询缺少复合索引 | 接受，仅对关系型日志库新增索引 |
| N6 | P1 | 400 响应重复且硬编码中文 | 接受，统一响应函数并接入后端 i18n |
| N7 | P1 | 去空格后配置键可能随机覆盖 | 接受，改为新 map 并拒绝规范化冲突 |
| N8 | P2 | 独立测试属性全部使用 `require` | 接受，setup 用 `require`，值断言用 `assert` |
| N9 | P1 | 设置解析/格式化缺少测试 | 接受，提取纯逻辑并新增表格测试 |
| N10 | P2 | 重复定义时间粒度联合类型 | 接受，复用 `TimeGranularity` |

### 4.3 二次评审

| ID | 优先级 | 评审内容 | 整改动作 |
| --- | --- | --- | --- |
| S1 | P1 | Markdown 表格中的竖线破坏列数 | 使用不含竖线的 request-rules guard 描述 |
| S2 | P1 | 小于 1 的小数取整后产生零值 | 取整前校验下限并补充 `0.5` 回归测试 |
| S3 | P1 | JSON 模式绕过设置规范化 | 保存前统一调用 `parseSavingsSetting` |
| S4 | P2 | 保存失败产生未处理的 Promise rejection | 本地捕获异常，用户提示继续由 mutation hook 统一处理 |
| S5 | P2 | 设置按钮中的装饰图标未隐藏 | 为 `Code2` 和 `Save` 增加 `aria-hidden='true'` |

## 5. 后端性能加固

### 5.1 防护链路

整改后的请求链路如下：

```text
UserAuth
  -> SearchRateLimit
  -> 时间窗口和时区校验
  -> 扫描上限硬约束
  -> 结果缓存查询
  -> singleflight 同键合并
  -> 关系库索引查询 / ClickHouse 时间分区查询
  -> 最多 50000 行确定性回算
  -> 结果缓存写入
```

四层防护分别解决不同问题：

- 限流阻止通过变化查询参数绕过缓存的请求放大。
- 硬上限保证管理员误配置也不能产生无限扫描。
- 结果缓存降低正常刷新、页面重载和多副本重复计算。
- 数据库索引降低 count 和 fetch 的范围扫描成本。

### 5.2 路由限流

对以下两个已认证路由增加 `middleware.SearchRateLimit()`：

```go
selfRoute.GET("/savings/summary", middleware.SearchRateLimit(), controller.GetUserSavingsSummary)
selfRoute.GET("/savings/trend", middleware.SearchRateLimit(), controller.GetUserSavingsTrend)
```

沿用现有默认策略：每个用户 60 秒最多 10 次搜索请求。使用用户 ID 作为限流维度，不与匿名 IP 共用额度。限流发生在业务查询之前，返回项目现有 429 响应。

不使用 `CriticalRateLimit()`：该接口属于高成本只读搜索，语义和 `/api/log/self/search` 更接近。

### 5.3 配置硬上限

新增常量并在后端规范化与前端输入中保持一致：

```text
max_summary_days:     1..31
max_summary_log_rows: 1..50000
```

后端是最终边界。管理员 JSON 超出范围时返回明确校验错误，不静默接受；前端输入的 `max` 仅用于即时反馈，不能替代后端验证。

超过行数上限时继续返回当前 `is_partial=true` 语义，不截取前 50000 条后伪装成完整统计。

### 5.4 短 TTL 结果缓存

使用 `pkg/cachex.HybridCache` 建立 summary 和 trend 两个结果缓存：

- Redis 可用时跨实例共享。
- Redis 不可用时回退到进程内 LRU。
- TTL 固定为 60 秒，与前端当前 `staleTime` 一致。
- 内存容量初始为 5000 个查询结果，不缓存原始日志行。
- 缓存读写失败时 fail-open：记录告警并执行真实查询，不影响接口可用性。

缓存键必须包含：

```text
schema_version
response_kind
user_id
start_timestamp
end_timestamp
granularity（trend）
utc_offset_minutes（trend）
savings_setting_fingerprint
```

`savings_setting_fingerprint` 从规范化设置的稳定 JSON 计算 SHA-256，覆盖官方价格、确认状态、历史回算开关和时效配置。设置更新后自然产生新键，无需扫描删除旧键；旧键由 TTL 自动淘汰。

概览滚动 24 小时窗口在前端按分钟对齐，避免每次刷新都因秒级时间戳变化产生新键：

```text
end = floor(now / 60 seconds) * 60 seconds
start = end - 24 hours
```

自定义时间范围保持精确时间戳，不在后端静默改写用户边界。变化参数绕过缓存的问题由搜索限流处理。

使用 `singleflight.Group` 按完整缓存键合并同一进程内的并发 miss，避免缓存过期瞬间重复扫描。缓存值构造完成后视为不可变，调用方不得修改其中的 slice。

### 5.5 关系型日志索引

为 `Log` 增加复合索引：

```text
idx_logs_user_type_created_id(user_id, type, created_at, id)
```

字段顺序对应现有查询：

```sql
WHERE user_id = ?
  AND type = ?
  AND created_at >= ?
  AND created_at < ?
ORDER BY created_at ASC, id ASC
```

要求：

- 使用 GORM index tag，让 SQLite、MySQL 和 PostgreSQL 通过现有 `AutoMigrate` 创建索引。
- 不写数据库方言专用 SQL。
- 不修改 ClickHouse `ORDER BY (created_at, request_id)`；ClickHouse 继续使用月份分区和时间主排序缩小范围，再过滤用户与类型。
- 大型关系库创建索引可能产生 IO 和锁等待，发布说明必须提示在低峰期完成迁移。

验收时分别执行查询计划检查，确认关系型数据库选择新索引；查询计划不写成依赖具体优化器输出的单元测试。

## 6. 后端正确性与可维护性

### 6.1 配置键规范化

`OfficialPrices` 不再在 `range` 期间原地删除和插入。改为构建新 map：

1. 对原始模型名执行 `TrimSpace`。
2. 空模型名返回校验错误。
3. 规范化来源 URL、来源名称和计费模式。
4. 如果两个原始键规范化为同一模型名，返回冲突错误，不依赖 map 随机迭代顺序选值。
5. 全部成功后一次性替换原 map。

`normalizeSetting` 改为返回 `error`，`ValidateSettingJSONString` 和 `UpdateSettingByJSONString` 都必须传播该错误，避免“校验通过但应用结果不同”。

### 6.2 控制器错误响应

在 savings controller 内保留一个稳定业务 helper：

```text
abortSavingsBadRequest(context, i18nKey)
```

该 helper 固定返回 HTTP 400 和 `{success:false,message}`，消息通过后端 `i18n.T` 获取。新增并维护英文、简体中文两个后端翻译键：

- 缺少开始或结束时间。
- 结束时间晚于当前时间。
- 缺少或非法时区偏移。
- 非法趋势粒度。
- 查询范围超过允许天数。

service 层返回可分类错误或哨兵错误，controller 负责把错误映射为本地化消息；不得把中文错误字符串当作跨层 API 契约。

### 6.3 其余代码质量修正

- `savingsRelayInfo(model string)` 改为 `savingsRelayInfo(modelName string)`。
- `formatUserLogs` 在循环前读取一次 `ShowOnUsageLogs()`，保证同一页日志使用一致可见性快照。
- 本地价格查找显式区分“传入预构建 map”和“直接读取模型广场”两个分支。
- 在 `|||` guard 前注明：request rules 依赖 header/param/time 等原始请求上下文，消费日志无法确定性重放，因此节省回算必须跳过。
- 测试 setup 和必要前置条件使用 `require`，相互独立的结果属性使用 `assert`。

## 7. 前端整改

### 7.1 统一货币配置

`SummaryCards` 和 `SavingsTrendChart` 都通过选择器读取：

```ts
const currency = useSystemConfigStore((state) => state.config.currency)
```

节省金额换算统一使用：

```text
currency.quotaPerUnit
currency.usdExchangeRate
```

`useStatus()` 仍负责从服务端刷新并同步 store，但节省组件不再同时直接读取 status 和 store 两份货币值。这样可以避免 localStorage placeholder、持久化 store 和最新 status 在加载阶段短暂分叉。

### 7.2 可访问性

以下已具备文本等价或 `aria-label` 的装饰图标增加 `aria-hidden='true'`：

- 历史回算说明按钮中的 `Info`。
- 概览跳转链接中的 `ArrowUpRight`。

测试从用户视角断言控件的可访问名称，不断言完整 DOM 或 Tailwind class。

### 7.3 设置纯逻辑测试

将 `parseSavingsSetting`、`formatSavingsSetting` 和默认值定义从 400 行以上的组件中提取到同模块纯逻辑文件，组件只负责状态和交互。

测试至少覆盖：

- 空字符串使用默认值。
- 非对象 JSON 返回失败。
- 布尔值类型错误回退默认值。
- 数值取整及上下限校验。
- 非对象 `official_prices` 回退为空 map。
- 已废弃字段被删除。
- parse -> format -> parse 保持业务值一致。

### 7.4 类型复用

删除 `DashboardTimeGranularity`，直接复用 `@/lib/time` 导出的 `TimeGranularity`。节省图表仍只把 hour/day/week 映射为服务端支持的 hour/day 粒度，不改变现有归一化行为。

## 8. 国际化整改

### 8.1 目标译文

俄语：

```text
Calculate estimated savings using official model prices.
  -> Рассчитывать оценочную экономию по официальным ценам моделей.

Covered request actual cost
  -> Фактическая стоимость охваченных запросов

Covered requests
  -> Охваченные запросы

Recalculate legacy usage logs
  -> Пересчитать устаревшие журналы использования
```

越南语：

```text
Official Price Updated
  -> Giá chính thức đã được cập nhật

Official price updated {{time}}
  -> Giá chính thức được cập nhật lúc {{time}}
```

繁体中文：

```text
使用者儀表板 -> 用戶儀表板
本機模型廣場價格 -> 本地模型廣場價格
本機官方定價 -> 本地官方定價
```

### 8.2 翻译回归测试

扩展现有 savings i18n 表格测试：

- 所有新增 key 在 7 种语言中存在。
- 非英语值不能等于英语 key。
- `{{count}}`、`{{coverage}}`、`{{time}}` 等插值占位符必须保留。
- 对本次评审指出的术语增加精确断言，防止同步工具再次覆盖为语义较弱的翻译。

运行 `bun run i18n:sync` 后要求所有语言均为 0 missing、0 extras、0 untranslated。

## 9. 分阶段实施

### 阶段 A：P0 查询保护

1. 增加两条路由的 `SearchRateLimit()`。
2. 给配置增加 31 天和 50000 行硬上限。
3. 增加关系库复合索引。
4. 增加 summary/trend 结果缓存和 singleflight。
5. 补充缓存隔离、缓存失效、部分结果和限流测试。

阶段 A 完成前不得把 PR 从 Draft 改为 Ready。

### 阶段 B：行为一致性

1. 统一货币配置源。
2. 修复配置键冲突和 controller i18n。
3. 修复全部俄语、越南语和繁体中文评审意见。
4. 增加装饰图标可访问性属性。

### 阶段 C：代码质量与收尾

1. 完成参数改名、循环外设置读取、分支可读性和 guard 注释。
2. 提取设置解析纯逻辑并补测试。
3. 复用 `TimeGranularity`。
4. 更新现有两份设计文档中的性能和查询限制说明。
5. 逐条回复并解决 GitHub review thread。

## 10. 测试与验证

### 10.1 后端自动化测试

- `go test ./service -run Savings -count=1`
- `go test ./setting/savings_setting -count=1`
- `go test ./model -run Savings -count=1`
- `go test ./controller ./router -count=1`

新增确定性测试：

- 相同用户、窗口和设置产生相同缓存键。
- 不同用户不能命中同一缓存项。
- granularity、UTC offset 或设置指纹变化时必须 miss。
- 缓存读写失败时仍返回真实计算结果。
- 超过 50000 行返回 partial，不读取日志明细。
- 配置规范化冲突返回错误，不随机覆盖。
- controller 对各类非法参数返回 HTTP 400 和对应语言消息。

不使用 sleep、随机输入或执行耗时比较验证缓存；通过注入时钟、缓存接口或计数 fixture 断言真实调用次数。

### 10.2 前端自动化测试

- `bun run typecheck`
- 受影响文件 `oxlint`
- 受影响文件 `oxfmt --check`
- `bun run build`
- dashboard savings、settings 和 i18n 相关测试
- `bun run i18n:sync`

前端回归必须覆盖：

- 概览和趋势使用同一 quota/USD/CNY 配置。
- 装饰图标不重复进入无障碍名称。
- 设置 JSON 与可视化编辑来回切换不丢业务字段。
- 7 种语言动态文案不回退到英语 key。

### 10.3 数据库验证

对 SQLite、MySQL 和 PostgreSQL 分别执行代表性 count/fetch 查询计划，确认使用 `idx_logs_user_type_created_id`。对 ClickHouse 确认月份分区裁剪仍然生效，并记录用户过滤的残余扫描成本。

数据库验证使用固定 fixture，不依赖生产数据，不在自动测试中断言优化器的完整文本输出。

## 11. 验收标准

- 9 条未解决行内评论全部完成修复、回复并解决线程。
- 10 条折叠建议均有明确处理结果；接受项完成，暂缓项说明理由。
- 两个 savings API 都启用每用户搜索限流。
- 后端无法配置超过 31 天或 50000 行的单次查询。
- 相同查询在 60 秒内不会重复执行日志回算。
- 缓存键包含用户、窗口、趋势参数和设置指纹，不存在跨用户复用。
- SQLite、MySQL、PostgreSQL 迁移成功并建立复合索引。
- ClickHouse 无表结构重建，现有查询行为不变。
- 概览和趋势对同一 quota 显示相同人民币金额。
- 7 种语言无新增缺失键或英语回退。
- Go 定向测试、前端类型检查、构建、lint、format 和相关测试全部通过。
- `git diff --check` 通过，提交不包含临时 i18n 脚本或生成产物。

## 12. 风险与回滚

### 12.1 缓存短暂陈旧

新消费最多延迟 60 秒出现在节省汇总中，与现有前端刷新周期一致。出现缓存异常时可在代码层关闭缓存读取，限流和扫描上限仍提供保护。

### 12.2 关系库索引迁移成本

大型 logs 表创建复合索引可能增加启动迁移时间和写入成本。发布前应在接近生产规模的数据副本上测量；必要时由运维先在线创建同名索引，再部署应用。

### 12.3 Redis 故障

Redis 超时不能阻断用户查询。缓存必须 fail-open 到真实计算，并保留搜索限流；不得因为缓存失败返回旧用户数据或空成功响应。

### 12.4 回滚顺序

如果上线后出现异常，按以下顺序回滚：

1. 关闭结果缓存读取，保留限流和硬上限。
2. 停止前端自动刷新，保留手动进入页面时查询。
3. 关闭 `show_on_dashboard`，保留日志快照写入。
4. 最后关闭整个 savings 功能。

关系库复合索引不需要随应用回滚删除；保留索引不会改变查询结果。
