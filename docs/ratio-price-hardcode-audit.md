# new-api 倍率/价格硬编码审计报告

> 审计日期：2026-06-14 ｜ 范围：Go 后端 + React 前端（`web/default`）｜ 方法：8 分区并行扫描 + 综合 + 源码实地核验（71 条发现）
> 本文档仅为审计结论，**未对代码做任何改动**。

## 一、执行摘要

本次对 new-api 8 个分区做了硬编码审计，聚焦"各种倍率/价格的隐式硬编码表"。

**整体规模**：全仓库的计费倍率主路径设计是健康的——后端默认倍率表集中在 `setting/ratio_setting/` 包，relay 各 adaptor 经 `relay/helper/price.go` 统一读取，前端定价计算从 `/api/pricing` 下发的 model 对象读取，**不存在与后端重复维护的整张模型价目表**。真正的硬编码集中为约 **20 张"隐式硬编码表" + 一组跨端换算魔数**，总条目数千级，其中：

- 单表最大：`model_ratio.go` 的 `defaultModelRatio`（~230 条），其次 `cache_ratio.go` 两张 Claude 缓存表（~67 + ~33 条）。
- 前端 `model-metadata.ts` / `mock-stats.ts` 是**凭空编造的大型推断表**（后端根本不返回这些字段），属合规误导风险。

**最严重的几类问题**（按优先级）：

1. **跨前后端隐式换算约定 `÷2 / ×2`** —— 后端 `price.go:206 modelRatio/2` 与前端至少 5 处 `model_ratio * 2`，无共享常量、无注释，后端改 `QuotaPerUnit` 会让前端**静默错算展示价**。这是最高优先级的跨端耦合。
2. **Pollo 实扣费与展示价双轨解耦** —— `settleModelRatio=300` 真扣费，管理面板 ModelRatio 只管展示，改 admin 倍率不动钱。直接影响营收对账。
3. **前端编造的模型规格/SLA 数据** —— `model-metadata.ts`（上下文窗口/知识截止/参数量）、`mock-stats.ts`（可用率/延迟/排行）全是前端按种子随机生成后展示给付费用户。
4. **基准常量两处独立定义** —— `common.QuotaPerUnit=500000` 与 `ratio_setting.USD=500`（差 1000 因子）各写一份，未互相引用。

**一句话结论**：计费主干"默认值兜底 + DB option 覆盖"的双层结构合理且应保留，清理重点不是删表，而是**消除跨前后端的隐式换算魔数耦合**、**坍缩冗余的恒值表**、**给前端编造数据补后端真源或显式标注"推断"**。

---

## 二、跨前后端 / 重复表识别（最高优先级）

> 这一类是"同一份数据在多处被独立维护"，改一处漏改另一处会静默错算，优先清理。

| # | 重复的数据/约定 | 文件对（真源 → 镜像） | 性质 | 风险 |
|---|---|---|---|---|
| R1 | **倍率→USD/百万token 的 `÷2/×2` 系数** | 后端 `relay/helper/price.go:206` `modelRatio/2` ↔ 前端 `features/pricing/lib/price.ts:87`、`usage-logs/.../common-logs-columns.tsx:201`、`usage-logs/.../details-dialog.tsx:153`、`models/.../model-mutate-drawer.tsx:344/1009` | 前后端各持一份 `2`，且 `2 = 1e6/QuotaPerUnit`，无共享常量 | **High** — 后端改 QuotaPerUnit/语义，前端无报错只给 2x/0.5x 错误价；model-mutate-drawer 还会写回后端 ratio |
| R2 | **计费基准 `500000`** | 后端 `common/constants.go:62` `QuotaPerUnit=500*1000` ↔ `setting/ratio_setting/model_ratio.go:14` `USD=500`（差 1000 因子）；前端 `stores/system-config-store.ts:52` `quotaPerUnit:500000`、`system-settings/billing/index.tsx:35` | 同一基准三处独立硬编码（两后端包 + 前端 fallback） | **Medium** — 数值必须严格等价 500000；前端 fallback 正常应被 API 覆盖 |
| R3 | **USDExchangeRate / CNY 汇率 `7`** | 后端 `payment_setting_old.go:18` `USDExchangeRate=7.3` ↔ 前端 `billing/index.tsx:36` 默认 `7`、`dynamic-pricing-breakdown.tsx:167` `\|\|7`、store 默认 `1` | 前端三处 fallback 不一致（7 vs 1），与后端 7.3 又不同 | **Medium** — 默认值不一致，配置缺失时人民币换算口径漂移 |
| R4 | **per-1K / per-1M `1000`/`1000000` 量纲** | 后端 `service/text_quota.go`（多处）、`tool_billing.go:51` ↔ `controller/ratio_sync.go:45/777`（`modelsDevInputCostRatioBase=1000.0` + 裸 `1000`）；前端 `constants.ts TOKEN_UNIT_DIVISORS` `M:1` ↔ 后端 `price.go:267 /1_000_000` | 同一量纲换算在后端多文件 + 前端各写一份 | **Medium** — 计费公式真实生效，重构需保精度 |
| R5 | **Claude `÷2` 测试镜像** | `pollo/adaptor_test.go:91` 注释 `modelRatio/2 * QuotaPerUnit` 与 R1 同约定 | 测试侧也固化了该约定 | Low — 改 R1 时一并同步 |

> **注意**：`defaultModelRatio` 等默认表与 `DB OptionMap["ModelRatio"]` 的 JSON 快照是**"代码默认 + DB 覆盖"的预期双层结构，不算需消除的重复**（详见保留项）。前端经 `/api/pricing` 下发，不内置同名表，grep `web/src` 无命中 —— 这是好的单一数据源。

---

## 三、分级发现清单

### High（必须处理）

| 文件:位置 | 是什么 | 隐式表? | 清理建议 |
|---|---|---|---|
| `relay/helper/price.go:206` + 前端 4 文件（见 R1） | 倍率↔USD 的 `÷2/×2` 跨端约定 | 是（换算约定） | 后端 `/api/pricing` **直接下发已换算的 $/1M 单价**，前端不再 `*2`；过渡期抽 `RATIO_USD_PER_MILLION_TOKENS=2` 共享常量 + 注释 `=1e6/QuotaPerUnit` |
| `relay/channel/task/pollo/adaptor.go:50,69,577,590` | `settleModelRatio=300`（$0.06/credit）、`creditTokenScale=100` 真扣费，与 admin display ModelRatio 解耦 | 是 | 把 per-model `settleModelRatio` 提升为渠道/`ratio_setting` 可配项（或复用 admin ModelRatio 消解耦）；解耦设计写进 DESIGN 文档而非埋注释；补回归测试 |
| `setting/ratio_setting/model_ratio.go:26-277` `defaultModelRatio` | ~230 条模型→倍率默认基准表 | 是 | 中长期外置为可由 `controller/ratio_sync.go` 同步的 embed JSON，源码仅留极小兜底集；必须保证 `DefaultModelRatio2JSONString` 与 pricing.go:80-89 重置功能返回等价 |
| `web/.../pricing/lib/model-metadata.ts:36-134,271-289,424-545` | 按模型名正则编造 context_length/cutoff/参数量/tokenizer/license/homepage，`data_retention_days` 随机、`training_opt_out` 恒 true | 是（编造） | 后端补齐字段后降级为 fallback；过渡期 UI **必须标注"推断/估计"**；`vendor` 优先用后端 `vendor_name` 消双轨；移除随机 retention |
| `web/.../pricing/lib/mock-stats.ts:78-440` | 整张性能/可用率/排行 mock（uptime 0.997+rand、p95/p99=1.6/2.4 等） | 是（编造） | 后端提供监控接口前 UI **必须显著标注"演示/模拟数据"**，否则属 SLA 误导 |

### Medium（应处理）

| 文件:位置 | 是什么 | 隐式表? | 清理建议 |
|---|---|---|---|
| `common/constants.go:62` + `model_ratio.go:14`（R2） | `QuotaPerUnit=500000` 与 `USD=500` 两处独立基准 | 否 | 让一方派生另一方（`QuotaPerUnit=USD*1000`）并暴露换算函数；注意避免包级初始化循环依赖 |
| `setting/ratio_setting/cache_ratio.go:7-74` `defaultCacheRatio` | ~67 条缓存读倍率，claude 全系=0.1 逐条枚举 | 是 | 按 `claude-*` 前缀规则替代逐条枚举（需先确认 `GetCacheRatio` 加前缀回退）；或外置 JSON |
| `setting/ratio_setting/cache_ratio.go:76-109` `defaultCreateCacheRatio` | ~33 条，**全部值=兜底 1.25**，语义等价兜底 | 是 | 整表可删，仅靠 `GetCreateCacheRatio` 兜底 1.25；删前确认前端不依赖此枚举作模型清单 |
| `model_ratio.go:414,576` 兜底 `37.5`（两处重复） | 未知模型保护性高价魔数 | 否 | 提包级常量 `defaultUnknownModelRatio=37.5` 复用，加注释 |
| `model_ratio.go:13` `USD2RMB=7.3` | 业务汇率假设（注释"暂定"） | 否 | 挪到可配置项 + 注释"非实时" |
| `controller/ratio_sync.go:45,777` per-1K/1M 换算（R4） | `1000`/`modelsDevInputCostRatioBase` 裸字面量 | 否 | 提具名常量/换算函数，L777 裸 1000 改引用 |
| `controller/ratio_sync.go:579` `nearlyEqual(...,37.5)&&(...,1.0)` | 上游不可信判定阈值 | 是（判定） | 提 `untrustedDefaultModelRatio=37.5`/`untrustedCompletionRatio=1.0` + 来源注释 |
| `service/text_quota.go`（L96/104/113/125/271/350-359） | per-1K/per-1M 除数 + 计算/日志两处重复同一公式 | 否 | 提具名常量 + 收敛为单一计费 helper，配 text_quota_test.go 回归 |
| `setting/.../group_ratio.go:20-24,28-33` 占位示例 `edit_this`/`append_1`/`vip_special_group_1` | 演示样例混进出厂默认 | 是 | 清空为空 map，语法说明移注释/文档，避免污染新部署 |
| `relay/channel/task/ali/adaptor.go:194-254` `aliRatios` | 8 模型×分辨率倍率表（裸比值 1/0.3） | 是 | 抽到 `ratio_setting`/渠道 JSON，具名常量替裸比值 |
| `relay/channel/task/doubao/constants.go:14-25` `videoInputRatioMap` | seedance 视频输入折扣（28/46 等比值） | 是 | 纳入 per-model OtherRatio 配置；固化"ModelRatio 须配不含视频价"约定 |
| `relay/channel/task/gemini/billing.go:120-138` `VeoResolutionRatio` | Veo 4K 倍率 + `strings.Contains("3.1")` 模糊匹配 | 是 | 改显式模型→倍率映射；倍率可配 |
| `payment_setting_old.go:16-18` `Price=7.3`/`USDExchangeRate=7.3` 同值异义 | 充值单价 vs 展示汇率巧合同 7.3 | 否 | 拆为具名常量 `defaultRMBPrice`/`defaultUSDToCNYRate` + 单位注释，同步 option.go case |
| `web/.../dynamic-pricing-breakdown.tsx:167` `\|\|7` + `billing/index.tsx:35-36` | 汇率/QuotaPerUnit fallback 重复且不一致（R2/R3） | 否 | 全部引用 `DEFAULT_CURRENCY_CONFIG` 单一来源，裁定汇率默认到底是 7 还是 1 |

### Low（可选/清理噪音）

| 文件:位置 | 是什么 | 建议 |
|---|---|---|
| `cache_ratio.go:111` 注释掉的死代码 | `//var defaultCreateCacheRatio...` | 直接删 |
| `cache_ratio.go:145,153` 兜底 `1`/`1.25` | getter fallback 魔数 | 提命名常量，文档化"未配置=不打折" |
| `relay/helper/price.go:36` `claudeCacheCreation1hMultiplier=6/3.75` | Anthropic 1h/5min 价比 1.6 | 保留，可纳入 per-model cache 配置 |
| `relay/channel/task/sora/adaptor.go:98-131` | size 倍率 1.666667 + 默认 seconds/size | 抽具名常量 + 注来源 |
| `relay/channel/ali/image.go:53` `prompt_extend=2` | 扩写固定乘 2 | 抽具名常量 |
| `model_ratio.go:279-340,483-485` defaultModelPrice/Audio/Image 等小表 | 30/5/8/4/1 条 | 随 defaultModelRatio 一并外置；单条表可保留 |
| `tier-expr.ts:132/142/156` `'p*0+c*0'`（3 处） | 零表达式字符串 | 抽 `ZERO_BILLING_EXPR` 常量 |
| `controller/billing.go:57,104` `1e8`/`*100` | 无限额度展示魔数 | 提 `unlimitedQuotaDisplayUSD`/`usageCentsMultiplier` |
| `price.ts` 多处 `\|\|1` / `return 1` | 中性倍率默认 | 保留；建议 `groupRatio[group] ?? 1` 区分 0 与 undefined |

---

## 四、清理 Roadmap

### 阶段 1 — 低风险：删冗余 / 合并重复（无行为变更）

| 步骤 | 涉及文件 | 风险 |
|---|---|---|
| 1.1 删死代码注释 | `cache_ratio.go:111` | 无 |
| 1.2 散落魔数提具名常量（不改值）：37.5、1.25、1e8、`prompt_extend=2`、`'p*0+c*0'`、neutralRatio=1.0 | `model_ratio.go:414/576`、`cache_ratio.go:145/153`、`controller/billing.go`、`ali/image.go`、`tier-expr.ts`、`task_billing.go` | 极低，纯重命名 |
| 1.3 清空 group_ratio 占位示例为空 map，样例移注释 | `group_ratio.go:20-33` | 低，仅影响全新部署；确认前端无样例依赖 |
| 1.4 坍缩恒值表 `defaultCreateCacheRatio`（全=1.25） | `cache_ratio.go:76-109` | 中，确认前端不靠它做模型枚举 |

### 阶段 2 — 集中化：统一到单一来源

| 步骤 | 涉及文件 | 风险 |
|---|---|---|
| 2.1 **基准常量收敛**：`QuotaPerUnit` 由 `USD*1000` 派生，暴露 `USDToQuota`/`PricePerKToRatio` 换算函数；`ratio_sync.go` 裸 1000 改引用 | `common/constants.go`、`ratio_setting/model_ratio.go`、`ratio_sync.go` | 中，数值须严格等价 500000；防包循环依赖 |
| 2.2 **后端 /api/pricing 下发已换算 $/1M 单价**，前端移除 `*2`；过渡期前端抽 `RATIO_USD_PER_MILLION_TOKENS` + `ratioToUsdPerMillion()` helper，5 处调用统一（尤其含写回的 model-mutate-drawer） | `price.go`、前端 R1 全部文件 | **High**，前后端同步改 + 回归 token 单价展示与表单提交 |
| 2.3 **前端货币默认值单一来源**：billing/对话框/pricing-section 全引用 `DEFAULT_CURRENCY_CONFIG`，裁定汇率默认值 | `system-config-store.ts`、`billing/index.tsx`、`dynamic-pricing-breakdown.tsx`、`subscription-purchase-dialog.tsx` | 中，确认 store hydrate 前行为 |
| 2.4 计费公式收敛单一 helper（per-1K/1M），计算与日志共用 | `text_quota.go`、`tool_billing.go` | 中，保 decimal 精度，配 text_quota_test.go |
| 2.5 缓存表按前缀规则替逐条枚举（先补 `GetCacheRatio` 前缀回退） | `cache_ratio.go:7-74` | 中，漏配会回退兜底错算 |

### 阶段 3 — 外置化：从配置 / DB / 上游同步

| 步骤 | 涉及文件 | 风险 |
|---|---|---|
| 3.1 `defaultModelRatio`/Price/Audio 等外置为 embed JSON，由 `ratio_sync` 从 basellm.github.io/models.dev 同步，源码仅留兜底 | `model_ratio.go`、`controller/ratio_sync.go` | High，须保 `DefaultModelRatio2JSONString`/重置功能等价，不影响已部署站点计费 |
| 3.2 task adaptor 的 OtherRatios 表（ali/doubao/gemini/sora）纳入 per-model 渠道配置或上游同步 | 各 task adaptor | 中，保默认值与现表一致 + 未命中回退 |
| 3.3 Pollo settleModelRatio 改为可配 per-model（或合并 admin ModelRatio） | `pollo/adaptor.go` | High，直接影响营收，须运营确认对账口径 |
| 3.4 前端 `model-metadata.ts`/`mock-stats.ts` 切后端真源，编造数据降级为标注"推断/演示"的 fallback | 后端补字段 + 前端两文件 | High，删除会致详情页空白，须后端先建模型规格库/监控接口 |

---

## 五、保留项与风险

### 应当保留（及原因）

- **"默认表 + DB option 覆盖"双层结构**：`defaultModelRatio` 等与 `DB OptionMap` 的 JSON 快照不是需消除的重复，而是"代码默认值兜底 + 运营 DB 覆盖"的预期模式。`hasCustomModelRatio()` 依赖 `GetDefaultModelRatioMap()` 判断用户是否自定义，贸然删默认表会破坏该语义。
- **`QuotaPerUnit` 作为计费协议级常量**：不宜外置为可变配置，改动会改变历史额度语义。可注释说明与 USD/Price 的换算关系，但不作可清理项。
- **`defaultGroupRatio`（default/vip/svip=1）**、`AmountOptions=[10,20,50,100,200,500]`、`compact_suffix` 常量、`exposedDataTTL=30s`、`expose_ratio` 开关默认 false：规模小、属业务默认策略/UI 配置/程序常量，合理硬编码。
- **`constants.ts TOKEN_UNIT_DIVISORS`、`billing-expr.ts` DSL 变量表、`seed.ts` 哈希常量**：分别是单位换算、与后端 billingexpr 对齐的协议契约、标准算法常量，非价目表。
- **`hailuo/models.go` 模型能力表**（分辨率/时长）：属能力约束而非价格，可接受。
- **倍率中性元 `1.0`**：乘法单位元，过度抽象反降可读性。

### 兼容性 / 回归风险

1. **计费正确性是红线**：阶段 2.1/2.2/3.1/3.3 任一改动都直接关系真实扣费与对账，必须保证迁移前后数值严格等价，并补回归测试（text_quota_test、pollo adaptor_test）。
2. **前端 `*2` 与后端 `÷2` 必须同步改**：这是最易"改一边忘一边"的点，遗漏会静默给出 2x/0.5x 错误展示价；model-mutate-drawer 涉及写回 ratio，错算会写脏数据。
3. **缓存表前缀归并**：`GetCacheRatio`/`GetCreateCacheRatio` 当前是精确匹配，归并前必须补前缀回退，否则漏配模型回退兜底 1 造成少收。
4. **删表影响前端枚举**：`defaultCreateCacheRatio`/占位示例若被前端管理页当作"可配置模型清单/语法样例"消费，删前需确认。
5. **基准常量统一防循环依赖**：`common` 与 `ratio_setting` 互引可能造成包初始化循环。
6. **前端编造数据移除会致 UI 空白**：`model-metadata.ts`/`mock-stats.ts` 必须后端先补字段/接口，且在补齐前先加"推断/演示"标注以规避合规误导风险。
7. **Pollo 解耦可能是业务有意为之**（对齐 dreamina 展示价），合并前须与运营确认。

---

**核验说明**：报告中所有后端文件:行号（`price.go:206 modelRatio/2`、`QuotaPerUnit=500*1000`、`USD=500`/`USD2RMB=7.3`、`37.5` 在 414/576 兜底及 ratio_sync.go:579 判定、Pollo `settleModelRatio=300`/`creditTokenScale=100`、`claudeCacheCreation1hMultiplier=6/3.75`）均已在 `/Users/derek/Documents/Codes/new-api` 源码中实地核验一致。
