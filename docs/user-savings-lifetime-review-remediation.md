# 用户累计节省自动审查整改方案

> 状态：已实施，待维护者复核
> 关联 PR：`QuantumNous/new-api#6499`
> 评审提交：`a2a65db09c92d5a287cd0f0075a709d7f1c7d517`
> 评审范围：`aa82302c..a2a65db`
> 基准日期：2026-07-29
> 前置文档：`docs/user-savings-estimate-design.md`、`docs/user-savings-review-remediation.md`

## 1. 背景

本轮改造在短窗口节省估算基础上增加冻结口径的长期累计能力，包括：

- 幂等累计事件、按日汇总和用户总计。
- 新消费实时累计与失败补偿。
- 可暂停、恢复、重试的历史回算系统任务。
- 关系型数据库和 ClickHouse 的稳定游标分页。
- 管理端回算控制、系统任务状态、概览和钱包累计节省展示。

CodeRabbit 对该增量给出 8 条行内意见、2 条 diff 范围外意见和 7 条低优先级建议。审查状态为成功仅表示自动审查已完成，不表示不存在待整改项。本文逐条判断意见有效性，并给出保持 KISS、跨数据库兼容和计费口径稳定的实施方案。

## 2. 改造目标

- 消除 SQLite 完整性检查阻塞管理员 HTTP 请求的风险。
- 保证冻结人民币金额可用时不再执行无关的备用换算。
- 避免每次用户查询都统计全局待聚合事件数量。
- 明确大型 `logs` 表新增复合索引的上线方式。
- 保证暂停任务不显示为正在自动刷新。
- 保证累计金额和百分比跟随当前界面语言格式化。
- 在回算状态变化后刷新依赖该状态的前端查询。
- 修正中、英、俄文案和钱包部分结果展示口径。
- 对接受、暂缓和不采纳的自动审查意见给出可追溯结论。

## 3. 不变约束

- 不改变短窗口和长期累计的节省计算公式。
- 不重新计算已有日志中合法的冻结人民币金额。
- 不允许任何换算产生负数、溢出值或静默截断值。
- 不把长期累计值用于扣费、退款、充值到账或发票。
- SQLite、MySQL 5.7.8+、PostgreSQL 9.6+ 必须同时可用。
- ClickHouse 继续使用 `(created_at, request_id)` 复合游标，不修改现有表排序键。
- 所有 JSON 编解码继续使用 `common` 包装函数。
- 不通过批量添加低价值注释满足外部工具的覆盖率指标。

## 4. 审查结论

### 4.1 行内和 diff 范围外意见

| ID | 优先级 | 评审内容 | 结论 | 整改动作 |
| --- | --- | --- | --- | --- |
| L1 | P0 | `PRAGMA quick_check` 在请求路径扫描数据库 | 有效，但机器人建议不完整 | 将检查移入后台任务；`quick_check(1)` 只能限制返回错误数量，不能保证健康数据库不完整扫描 |
| L2 | P1 | 暂停任务仍显示“自动刷新” | 有效 | 分离活动任务和实际轮询任务状态 |
| L3 | P2 | 新增 TypeScript 函数缺少显式返回类型 | 有效 | 为 5 个 API helper 和 2 个状态 helper 补齐返回类型 |
| L4 | P1 | 钱包累计金额没有使用当前界面语言 | 有效，且存在同类遗漏 | 钱包和概览的金额、覆盖率、进度统一传入 `i18n.resolvedLanguage` |
| L5 | P2 | 钱包部分回算展示规则前后不一致 | 有效 | 明确部分金额只能使用“已统计”语义，完成后才能使用最终累计语义 |
| L6 | P2 | 中文“成功估算”增加了原文没有的成功语义 | 有效 | 改为“已估算：{{count}}” |
| L7 | P2 | 两条俄语累计设置文案语义不准确 | 有效 | 分别修正“聚合到冻结总额”和“保存设置”的语义 |
| L8 | P2 | 俄语把 overrides 翻译成 exceptions | 有效 | 使用 `переопределений` |
| L9 | P2 | 英文历史请求数量在 1 时使用复数 | 有效 | 改为数量后置的中性句式，避免为单个新增 key 引入不完整复数体系 |

### 4.2 折叠建议

| ID | 优先级 | 建议 | 处理决定 |
| --- | --- | --- | --- |
| N1 | P2 | ClickHouse 游标测试实际运行在 SQLite | 接受，增加测试边界说明，不声称覆盖 ClickHouse SQL 兼容性 |
| N2 | P1 | 用户累计汇总每次执行全局 pending count | 接受，改为有条件的存在性查询 |
| N3 | P1 | 冻结金额可用时仍先执行备用换算 | 接受，调整为冻结值优先 |
| N4 | P2 | 回算控制组件需要拆分 | 暂缓，当前先修行为问题；后续独立提取 hook 和状态展示组件 |
| N5 | P1 | mutation 成功后没有失效相关查询 | 接受，统一 query key 并失效累计查询 |
| N6 | P1 | 新复合索引可能在大型日志表上阻塞迁移 | 接受，补充显式上线流程和低峰窗口要求 |
| N7 | P2 | 概览组件需要拆分节省逻辑 | 暂缓，避免本轮正确性修复混入大范围展示重构 |

### 4.3 不作为阻塞项

CodeRabbit 报告的 docstring 覆盖率为 1.88%，外部阈值为 80%。当前项目规范不要求为所有内部函数添加 docstring，批量补充只会增加噪声和维护成本，因此不作为本轮验收条件。

组件拆分建议具有长期维护价值，但“超过约 200 行时应考虑拆分”不是必须在同一提交完成的硬性约束。本轮只在拆分能够直接降低行为修复复杂度时执行，否则登记后续任务。

## 5. 后端整改

### 5.1 SQLite 完整性检查移出请求路径

当前 `StartSavingsLifetimeBackfill` 和 `RetrySavingsLifetimeBackfill` 在返回 HTTP 响应前调用 `CheckSavingsLifetimeSQLiteIntegrity`。`PRAGMA quick_check` 需要读取数据库内容，大型 SQLite 主库或日志库会让管理员请求长时间无响应。

整改后的链路：

```text
管理员启动或重试
  -> 校验设置和任务状态
  -> 冻结任务边界、价格和汇率
  -> 快速写入 pending 系统任务
  -> 返回 HTTP 响应

后台任务开始执行
  -> SQLite 完整性检查
  -> 失败：任务转为 failed，并保留可见错误
  -> 成功：进入日志分页和事件写入
```

实现要求：

1. 删除启动和重试 service 中的同步完整性检查。
2. 在 `savingsLifetimeBackfillHandler.Run` 真正读取批次前执行检查。
3. 检查错误沿用系统任务失败状态和错误字段，不吞掉数据库错误。
4. 暂停和恢复即使重新执行检查，也只能影响后台任务，不得再次阻塞 HTTP 请求。
5. 可使用 `PRAGMA quick_check(1)` 限制最多返回一个错误，但不得把它描述为查询成本上限。
6. 任务上下文取消时应终止后续日志扫描；数据库驱动支持时通过 `WithContext(ctx)` 传播取消。

不新增独立预检任务或复杂状态机。边界查询自身失败时，启动接口仍可立即返回数据库错误；只有完整扫描从请求路径迁出。

### 5.2 冻结金额优先

构建长期事件时按以下顺序选择人民币微元金额：

```text
存在 SavingsCNYMicros
且冻结 quota_per_unit > 0
且冻结 usd_cny_rate_micros > 0
且金额可解析为非负 int64
  -> 直接使用冻结金额和冻结换算参数

否则
  -> 使用任务冻结的 quota_per_unit 和 usd_cny_rate_micros 换算
  -> 换算失败或溢出时终止当前任务批次
```

冻结值存在时不得先调用 `savingsLifetimeAmountMicros`。这既避免冗余 decimal 运算，也保证合法历史快照不会因为无关的备用参数异常而失败。

新增回归测试：

- 合法冻结金额优先于任务换算参数。
- 合法冻结金额存在时，构造会使备用换算溢出的参数仍应成功。
- 冻结金额非法时使用任务快照回退。
- 冻结金额和回退参数都非法时返回错误。
- 负数冻结金额不得进入累计表。

### 5.3 pending 查询改为存在性检查

当前累计汇总只需要判断是否存在未聚合事件，却调用 `COUNT(*)` 获取完整数量。整改为：

```go
func HasPendingSavingsLifetimeEvents() (bool, error)
```

查询语义：

```sql
SELECT id
FROM savings_lifetime_events
WHERE aggregated_at = 0
ORDER BY id
LIMIT 1
```

调用规则：

- 回算状态不是 `completed` 时，直接令 `is_complete=false`，不查询 pending 事件。
- 只有回算状态为 `completed` 时执行存在性查询。
- `is_complete = completed && !has_pending`。

`idx_savings_events_pending` 调整为 `(aggregated_at, id)`，同时服务后台批量聚合和存在性查询。该表由本功能新建，不涉及已有大型 `logs` 表的在线索引风险。

不为一个布尔查询增加内存缓存。索引存在性查询更直接，也不会引入跨实例失效问题。

### 5.4 `logs` 复合索引上线

保留以下关系型索引设计：

```text
idx_logs_user_type_created_id(user_id, type, created_at, id)
```

它匹配短窗口查询和长期关系型日志游标，但不能只依赖大型生产库启动时的 `AutoMigrate`。

上线要求：

- 新安装和小型数据库可继续由 `AutoMigrate` 创建。
- 大型现有数据库必须在部署应用前预创建同名索引。
- MySQL 5.7 优先在验证支持后使用在线 DDL，并安排低峰窗口；不支持无锁创建时必须评估写阻塞。
- PostgreSQL 使用并发索引创建时不得放在事务中执行。
- SQLite 创建索引会阻塞写入，应先备份并安排维护窗口。
- 预创建完成后再启动新版本，GORM 识别同名索引后不应重复创建。
- ClickHouse 不创建该索引，也不修改 `ORDER BY`。

发布前在接近生产规模的数据副本上记录创建时长、额外磁盘空间和写入影响。本文只规定上线边界，不把数据库方言专用 DDL写入通用迁移代码。

## 6. 前端整改

### 6.1 轮询状态与活动状态分离

保留两个明确语义：

```ts
function isActiveStatus(status: SystemTaskStatus): boolean
function isPollingStatus(status: SystemTaskStatus): boolean
```

- `activeTasks` 继续包含 `paused`，确保暂停任务仍显示在活动区域并提供恢复按钮。
- `hasPollingTasks` 只包含 `pending`、`running`、`pause_requested`。
- 自动刷新指示灯和“每 N 秒刷新”文案使用 `hasPollingTasks`。
- 实际 `refetchInterval` 继续使用 `isPollingStatus`。

这样不会把暂停任务错误描述为正在轮询，也不会把暂停任务移动到历史列表。

### 6.2 显式 TypeScript 返回类型

以下函数补齐返回类型：

```text
startSavingsLifetimeBackfill
getSavingsLifetimeBackfill
pauseSavingsLifetimeBackfill
resumeSavingsLifetimeBackfill
retrySavingsLifetimeBackfill
isActiveStatus
isPollingStatus
```

API helper 使用现有 `StartSavingsLifetimeBackfillResponse`、`SystemTaskResponse<T>` 精确标注 `Promise` 返回值，不新增重复 DTO。

### 6.3 当前界面语言格式化

钱包和概览统一取得：

```ts
const { t, i18n } = useTranslation()
const locale = i18n.resolvedLanguage ?? i18n.language
```

以下格式化必须传入 `locale`：

- `formatSavingsCNYMicros`。
- `formatSavingsQuotaAsCNY`。
- 累计覆盖率百分比。
- 历史回算进度百分比。
- 短窗口覆盖率百分比。

不能只修钱包调用点；`SummaryCards` 中存在相同问题，应一并修复。数值和币种不变，仅改变分组符、小数符号和货币符号布局。

### 6.4 Query Key 与失效范围

同一累计接口不应在 dashboard 和 wallet 使用互不相关的 query key。两处复用同一个会话级 key：

```ts
const savingsQueryKeys = {
  lifetime: ['savings', 'lifetime'] as const,
}
```

要求：

- dashboard 和 wallet 在当前认证会话内复用累计 query key。
- 登录、退出和会话失效继续通过现有认证生命周期调用 `queryClient.clear()`，保证新用户不会复用上一会话的累计结果。
- 启动、暂停、恢复和重试成功后，先保留当前任务的 `setQueryData`，再使 `['savings', 'lifetime']` 前缀失效。
- 失效调用失败不影响 mutation 成功提示，但不得产生未处理 Promise rejection。
- 保留 60 秒 `staleTime` 作为正常读取策略，mutation 后不等待自然过期。

### 6.5 组件拆分决定

本轮不为满足行数建议强制拆分整个 `SummaryCards` 和 `SavingsLifetimeBackfill`。如果实现共享 query key 和 mutation 失效时出现明显重复，可提取一个稳定的 `useSavingsLifetimeBackfill` hook；展示组件拆分留给独立重构。

该决定遵循 YAGNI：先修复已确认的行为问题，避免在同一评审提交中扩大 JSX 重排和视觉回归范围。

## 7. 文档与国际化

### 7.1 钱包部分结果口径

设计文档统一为：

- 回算未完成时可以展示已经聚合的金额，但必须使用“已统计节省”或“累计统计中”语义。
- 部分结果必须同时显示进度或未完成状态。
- 只有 `is_complete=true` 时可以展示“累计为你节省”一类最终口径。
- 任意状态下都必须保留“估算”限定，不得表述为现金返还。

### 7.2 目标文案

英文数量文案改为不依赖单复数的形式：

```text
Historical requests recalculated at current official prices: {{count}}
```

简体中文：

```text
Estimated: {{count}}
  -> 已估算：{{count}}
```

俄语：

```text
Aggregate new usage into a frozen lifetime savings total.
  -> Учитывать новое использование в зафиксированной общей сумме экономии за всё время.

Enable and save lifetime savings before starting a backfill.
  -> Включите и сохраните настройку накопленной экономии перед запуском пересчёта.

Uses local official pricing from the model marketplace by default; official_prices is only needed for overrides.
  -> По умолчанию используются локальные официальные цены из каталога моделей; official_prices нужен только для переопределений.
```

修改英文源 key 时同步更新 7 个 locale 和调用点，保留 `{{count}}` 等插值占位符。执行 `bun run i18n:sync` 后不得留下 missing、extra 或 untranslated 项。

### 7.3 测试边界说明

`TestGetSavingsLifetimeLogBatchUsesClickHouseCompositeKeyset` 使用 SQLite 连接并强制设置 ClickHouse 数据库类型。测试只能保护复合 keyset 条件、边界和排序结果，不能证明 ClickHouse 方言接受生成 SQL，也不能替代真实 ClickHouse 集成验证。测试前增加这一简短说明，不新增伪造的 ClickHouse 单元测试。

## 8. 实施顺序

### 阶段 A：请求和累计正确性

1. 将 SQLite 完整性检查移入后台任务。
2. 调整冻结金额优先级并增加溢出回归测试。
3. 将 pending count 改为条件存在性查询。
4. 补充 `logs` 索引上线说明。

### 阶段 B：前端状态一致性

1. 分离轮询状态和活动状态。
2. 补齐 API 与状态 helper 返回类型。
3. 统一金额和百分比的界面语言。
4. 统一累计 query key，并在 mutation 成功后失效。

### 阶段 C：文档、翻译和收尾

1. 统一钱包部分结果口径。
2. 修正英文、中文和俄语目标文案。
3. 增加 ClickHouse 模拟测试边界说明。
4. 记录组件拆分暂缓原因。
5. 逐条回复并解决对应评审线程。

## 9. 验证方案

### 9.1 后端自动化测试

```text
go test ./model -run SavingsLifetime -count=1
go test ./model -run SavingsLog -count=1
go test ./service -run SavingsLifetime -count=1
go test ./controller -run SavingsLifetime -count=1
```

必须覆盖：

- 启动和重试接口不再同步执行完整性扫描。
- 后台完整性检查失败时任务进入失败状态并保留错误。
- 冻结金额优先和备用换算错误路径。
- 非完成任务不查询 pending 事件。
- 完成任务通过存在性查询决定 `is_complete`。
- SQLite 迁移创建 `(aggregated_at, id)` 索引。
- 关系型和 ClickHouse 游标边界保持不变。

### 9.2 前端自动化测试

```text
bun test src/features/dashboard/lib/__tests__/savings-lifetime.test.ts
bun test src/features/dashboard/lib/__tests__/savings-i18n.test.ts
bun run typecheck
bun run i18n:sync
bun run build
```

受影响文件运行 `oxlint` 和 `oxfmt --check`，并增加以下断言：

- 暂停任务不会显示自动刷新状态。
- 活动任务仍包含暂停任务。
- 指定 `zh-CN`、`en` 等界面语言时金额格式稳定。
- dashboard 和 wallet 使用相同用户累计 query key。
- 四个 mutation 成功后触发累计查询失效。
- 新英文 key 在数量为 1 和大于 1 时都符合语法。
- 7 种语言保留所有插值占位符。

### 9.3 数据库和上线验证

- SQLite：使用大体量副本确认完整性检查只在后台运行，管理员请求快速返回。
- MySQL 5.7：在副本验证复合索引创建时间、锁等待和额外磁盘占用。
- PostgreSQL 9.6：验证并发预创建索引后应用启动不重复建索引。
- ClickHouse：在真实实例验证复合 keyset SQL、排序和歧义游标计数。
- 所有数据库验证都使用固定边界数据，不以运行耗时作为单元测试断言。

## 10. 验收标准

- 启动、重试累计回算的 HTTP 请求不执行 SQLite 全库完整性扫描。
- 完整性检查失败通过系统任务状态对管理员可见。
- 合法冻结人民币金额不会触发备用换算。
- 用户累计查询不再执行全局 pending `COUNT(*)`。
- 大型 `logs` 表索引具备明确的预创建和维护窗口说明。
- 暂停任务不显示“自动刷新”，但仍保留在活动任务区域。
- 累计金额、覆盖率和进度使用当前界面语言。
- dashboard 与 wallet 不会跨用户复用累计缓存。
- 回算 mutation 后相关累计查询立即失效。
- 目标中、英、俄文案通过 i18n 回归测试。
- 接受项均有测试或可验证证据，暂缓项有明确理由。
- Go 定向测试、前端测试、类型检查、lint、format、i18n 同步和构建全部通过。
- `git diff --check` 通过，不包含临时脚本或生成产物。

## 11. 风险与回滚

### 11.1 后台完整性检查耗时

迁出请求路径后，完整性检查仍可能长时间占用 SQLite 读 IO。管理员界面应显示任务处于 pending/running，不重复启动任务。必要时可先关闭长期累计功能，不影响短窗口节省估算。

### 11.2 索引迁移

大型 `logs` 表索引创建失败时不得自动删除已有索引或重置数据库。保持旧版本运行，完成索引预创建后再部署应用。新累计表索引可随功能表迁移一次创建。

### 11.3 前端缓存

统一 query key 后必须包含用户 ID。若出现缓存串用户风险，优先关闭共享 key 并恢复独立查询；不得通过延长 stale time 掩盖隔离问题。

### 11.4 功能回滚顺序

1. 关闭钱包累计展示。
2. 关闭概览累计展示。
3. 暂停历史回算任务。
4. 关闭长期累计开关，保留短窗口估算。
5. 保留已写入事件和汇总数据，不执行破坏性清理。
