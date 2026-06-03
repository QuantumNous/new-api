# 成本统计模板计划 — 实施前批判（≤1 页）

**范围**：审阅 `docs/plans/channel-cost-statistics-template-2026-06-03.md`，对照 context_builder 导出 `prompt-exports/oracle-plan-2026-06-03-132137-cost-report-plan-851-b6dc.md`。仅覆盖下列 5 点，不扩范围、不重写计划。

## 1. 三个最欠规格的接缝（实现者只能靠猜）

1. **默认模板 → 样例 Excel 的字段/公式映射缺失。** 计划反复说"对齐样例 20 个表头"（plan:42, plan:87），Item 1 done-when 只写"包含核心字段"（plan:313），但从未把 20 列逐一标注为 dimension/metric/manual/formula，也未给出 成本/应收账款/中间利润/火力利润/利润比例 的具体公式。这是业务语义，实现者无从猜起，却是 Item 1（seed 默认模板）的交付前提。**这是最大的接缝。**
2. **`Log.Other` 的结构未定义。** 聚合第 3–4 步要"解析 Other"（plan:179），分类默认用 `log.other.claude == true`、field source 用 `log_other.*`（plan:131, plan:214, plan:234）——但 `Log.Other` 里并不存在 `claude` 布尔键。导出曾点名 `service/log_info_generate.go` / `types/price_data.go` 是 Other 的写入处（export:13, export:30），计划把这条线索丢了，实现者得逆向猜测 Other 的键名与含义。
3. **`period_key` 与按时间分桶的语义未定。** `PeriodStart/PeriodEnd` 是区间，`PeriodKey` 是单值，row_key 里又含 `period:{period_key}`（plan:142, plan:192）。当 `period_mode=day` 而日期范围跨周时，一个 run 是产 1 个 period 还是 7 个 period 桶？聚合算法第 7–8 步生成 row_key 却从不按时间子窗口分桶（plan:184–195）。这决定 grouping 是否需要时间维度，影响 Item 1 的表结构。

## 2. 规格颗粒度失衡

- **过度规定（应交给实现代理）**：列出 10 个具体 React 组件文件名（plan:277–293）属于 UI 拆分的战术决策；REST 路由的精确嵌套（如 `.../versions/:version_id/validate`，plan:165）同样可由实现者定形。
- **丢失了导出里有用的框架**：(a) 导出给了具体的公式环境变量与示例（`revenue_usd = quota / quota_per_unit` 等，export:624–642），计划 3.6 节抽象掉了，反而更难落地。(b) 导出明确建议**复用 usage-logs 既有组件**（`useUsageLogsData` 的列偏好/统计请求、`ColumnSelectorModal`、`UsageLogsColumnDefs` 成本渲染，export:17/33）；计划却凭空新建一整套组件树（plan:277–293），既过度规定又丢了复用锚点。

## 3. 矛盾与缺失依赖

- **重复造轮子 / 缺失依赖（已核实）**：计划称公式引擎用"现有 Go 依赖 `expr-lang/expr`"（plan:249），但**仓库已存在 `pkg/billingexpr`** —— 一套用同一引擎做好编译缓存、变量白名单、版本标签、settle 的计费表达式系统（CLAUDE.md Rule 7 强制先读 `pkg/billingexpr/expr.md`）。计划要新写 `service/cost_report/formula.go` 却从不提它。应先评估复用，而非平行实现。
- **矛盾：手动值"跨模板升级存活" vs row_key 依赖 grouping。** 计划说 manual cell 不绑 `TemplateVersionId`，以便字段 key 不变时保留手动值（plan:152）；但 row_key 由"启用的 grouping 维度"派生并含 `template_id/period_key`（plan:192–195）。一旦模板改了 grouping（如新增 model 维度），row_key 格式即变，旧手动值静默孤立。存活性其实取决于 row_key 稳定，而非字段 key。

## 4. 过度规划（建议删减/简化）

- **同一条顺序被编码三遍**：Phase A–D（plan:84–97）+ Work Items 1–5（plan:309–367）+ 导出的 15 步实施序（export:906–980）。保留 Work Items 即可，Phase 段可压成一句。
- **Univer 被当作已交付特性来规划**：明确推迟（plan:81/301）的功能却铺了数据模型映射、迁移路径、References、Open Question（plan:95–97, 299–305, 371, 376–381）。收敛为"推迟 + OSS/Pro 边界待验证"一段即可。
- Excel 的 Sheet 2/3/4 内部布局（plan:261–264）可简化为"附模板与规则元信息页"。

## 5. 会改变实施顺序的问题

1. **`pkg/billingexpr` 能否直接满足公式需求？** 若能，Item 2 的 `formula.go` 退化为"接入 billingexpr"，公式校验可大幅前移，改变 Item 1/2 的边界与排序。
2. **样例 Excel 的成本/利润公式与业务语义到底是什么？** 若 V1 必须与样例一致，则"默认模板 seed"（实施早期步骤）在产品确认公式前无法落地，须把 seeding 排到公式语义敲定之后，阻塞 Item 1 的 done-when。
3. **一个 run 是单时间桶还是多时间桶？** 答案决定 row_key 是否需含时间维度、聚合是否按 period 循环——必须在冻结 Item 1 表结构与 row_key 方案之前回答。
4. **手动单元格身份是否必须跨 grouping 变更存活？** 若必须，则需在 Item 1 设计稳定的代理 row id（而非由 grouping 派生），把 schema 设计排到聚合之前。

---
*结论：计划骨架合理，但落地前必须先钉死「默认模板字段+公式语义」「`Log.Other` 结构」「period 分桶」三处，并就「复用 `pkg/billingexpr`」与「row_key 稳定性」做出决定——这两项会直接重排工作项顺序。*
