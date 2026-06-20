# Skill Marketplace Tasks Overview

本文档是 `tasks/` 目录的模块化 PRD 总入口。它定义 DeepRouter Skill Marketplace V1 的文档边界、Source of Truth、跨模块依赖和 Sprint Ready 使用规则，避免不同 Agent 在范围、事件、权限、数据模型和上线门槛上产生不同解释。

---

## 0. Product Direction — Skill Marketplace as Subscription Value Layer

Skill Marketplace 是 DeepRouter 订阅的内容附加价值层，不做运行时绑定或按次执行计费。

| 维度 | 方向 |
|---|---|
| 产品定位 | DeepRouter 订阅的内容资产：Pro 订阅解锁 Pro Skills 下载权限 |
| 护城河 | Marketplace 平台粘性：发现、策展质量、Evaluation 信任、社区评分 |
| 分发形态 | 每个 Skill 打包为可下载 zip；zip 内含 SKILL.md（Claude Code 原生兼容）+ manifest.json + 可选 scripts / references / sub-agents |
| 执行方式 | 用户在自己环境用任意 LLM 运行（Claude Code `/skillname`）；DeepRouter 不参与执行，不计执行 token |
| Entitlement | 下载时一次性校验订阅级别；执行时无服务端校验 |
| 收费模型 | DeepRouter 订阅费；Skill 不单独计费；Skills 是留住订阅用户的内容理由 |
| 增长逻辑 | Skills 质量越高 → 订阅转化越好 → 内容资产越丰富 → 用户越难离开 |

---

## 1. Product Positioning

DeepRouter Skill Marketplace V1 是一个官方 curated 的 AI Skill 内容平台，作为 DeepRouter 订阅的附加价值层交付。

Marketplace 把每个官方 Skill **打包成可下载的 zip 包**。zip 内含：
- `SKILL.md`：Claude Code 原生格式，解压到 `.claude/skills/` 即可用 `/skillname` 调用
- `manifest.json`：Marketplace 元数据，供版本管理与更新检测
- （可选）`scripts/`、`references/`、`sub-agents/`：支持复杂 Skill

每个 Skill 发布前须通过**自动化 Evaluation**（格式、任务完成度、违规、完整性）——evaluation failed 不能发布。用户可在账号设置里授权 Tier 2 遥测，以回传 installed / used 等本地行为数据。

V1 的产品闭环为：

```text
Super Admin 创建官方 Skill（SKILL.md + 可选复杂结构）
→ 触发 Evaluation Pipeline（格式 / 任务完成度 / 违规 / 完整性）
→ Evaluation passed → 发布到 Marketplace
→ 用户浏览 / 搜索 / 收藏 / 查看详情（Tier 1 tracking）
→ 用户下载 zip（校验订阅级别，一次性）
→ 用户在本地解压到 .claude/skills/，用任意 LLM 运行
→ 授权用户回传 installed / used（Tier 2 tracking，opt-in）
→ Operations 根据下载量、转化率、评分、Evaluation 结果优化内容质量
```

---

## 2. Source of Truth

`tasks/01-07` 是当前实现级 PRD 的 Source of Truth。根目录旧版 PRD 只可作为战略背景，不可覆盖模块 PRD 中已经确定的数据模型、API、事件、错误码、权限和 Sprint Gate。

| Domain | Source of Truth | Notes |
|---|---|---|
| 产品范围、P0/P1/P2、角色、旅程 | `01_Functional_Requirements.md` | 如果 WBS 摘要与 FRD 冲突，以 FRD 为准 |
| UX、页面、状态、交互、可访问性 | `02_UX_Design.md` | 前端体验和错误状态以 UX 为准 |
| 数据表、枚举、API、错误 envelope | `03_Data_Model_and_API_Spec.md` | Schema/API 合约以 Data/API 为准 |
| 事件、指标、Dashboard、告警 | `04_Analytics_and_Operations.md` | 必须映射到 Data/API 的表与字段 |
| 安全、RBAC、隐私、NFR、发布门槛 | `05_Security_and_NFR.md` | 安全和非功能要求可阻塞上线 |
| Agent 模块拆分、依赖、Sprint 计划 | `06_Module_Breakdown_WBS.md` | 规划文档，不重新定义 Schema/API |
| CTO 一致性治理、Gate、Go/No-Go | `07_CTO_PRD_Review_Action_Items.md` | 用于最后一致性审查和 Sprint Readiness |

---

## 3. Target Readers

- Product / Growth
- Engineering / Architecture
- Frontend / Design
- Data / Analytics
- Operations / Support
- Security / SRE / QA
- Independent implementation Agents

---

## 4. Module Responsibilities

| File | Responsibility | Primary Agent |
|---|---|---|
| `01_Functional_Requirements.md` | 功能范围、角色权限、用户旅程、生命周期、错误语义、验收标准 | Product / Functional Agent |
| `02_UX_Design.md` | IA、页面职责、组件、状态、空态、错误态、可访问性 | UX / Frontend Agent |
| `03_Data_Model_and_API_Spec.md` | 表结构、枚举、索引、API contract、响应 envelope、迁移策略 | Data/API Agent |
| `04_Analytics_and_Operations.md` | 事件字典、指标公式、Dashboard、告警、数据质量、运营权限 | Data / Analytics / Ops Agent |
| `05_Security_and_NFR.md` | Prompt 保护、Kids Gate、RBAC、隐私、NFR、Kill Switch、发布安全门槛 | Security / SRE Agent |
| `06_Module_Breakdown_WBS.md` | 模块拆分、Agent ownership、依赖、Epic、Sprint sequencing、P0 最小上线闭环 | EM / TPM Agent |
| `07_CTO_PRD_Review_Action_Items.md` | 跨 PRD 一致性、Sprint 0 决策、Readiness Gate、Go/No-Go | CTO Review Agent |
| `08_R2_Jira_Impact_Map.md` | R2（D-09）变更对照现有 Jira 票的影响地图：保留/重定义/新增/作废 | EM / TPM Agent |

---

## 5. Sprint 0 Decision Baseline

所有模块统一使用 `D-01` 到 `D-08` 作为 Sprint 0 决策编号。旧的局部编号只能作为历史别名，不得作为新的 blocking decision 编号。

| ID | Decision | Default Until Explicitly Changed |
|---|---|---|
| D-01 | Free / Pro / Enterprise plan matrix and free quota | Freeze before entitlement/billing implementation |
| D-02 | Analytics build vs buy | Event schema can proceed; sink/dashboard tool must be chosen before M08/M09 implementation |
| D-03 | Kids release mode | Closed beta/off by default unless Safety/Legal/Product approve GA |
| D-04 | Streaming launch scope | P1 by default; non-streaming path is P0 |
| D-05 | Provider system-boundary allowlist | Explicit approved provider/model list required before production Relay integration |
| D-06 | `instruction_template` encryption mechanism | DB/storage encryption + restricted access; field encryption if available |
| D-07 | Revenue counting statuses | Gross attribution counts positive `charge_status='charged'` by default; net/reconciliation includes append-only refund/void compensation rows as negative adjustments |
| D-08 | Initial official Skill catalog | 3-5 launch Skills with examples and QA checklist |
| D-09 | Skill distribution model | **Default: content marketplace, no runtime binding.** Skills 以 SKILL.md 兼容 zip 分发；护城河为 Marketplace 平台粘性（发现、策展、Evaluation 信任、评分）；DeepRouter 不参与执行、不计执行 token；Entitlement 在下载时一次性校验；Tier 2 本地遥测须用户在账号设置中显式授权 |

---

## 6. Cross-Module Consistency Rules

- Any new user-facing blocked state must update FRD, UX, Data/API error code mapping, Analytics block reason, and Security/NFR if safety or billing related.
- Any new event must define producer, trigger, required fields, storage target, privacy rules, dashboard use, and sample payload.
- Any new table or field must update Data/API first, then Analytics and WBS if consumed.
- Any Kids-related change must update FRD, UX, Data/API, Analytics, Security/NFR, and WBS.
- Any billing or revenue change must update Data/API, Analytics, Security/NFR, and WBS.
- Any streaming change must be explicitly marked P1 or launch P0 and must update Relay, Safety, Billing, Analytics, and NFR.
- WBS can sequence work but must not override product scope, schema, API, error codes, or event contracts.
- Any change to the Skill package format (zip contents, SKILL.md schema, manifest schema, optional directories) must update FRD, Data/API, Security/NFR, and WBS.
- Any change to the Evaluation Pipeline (checks, scoring, pass/fail gate) must update FRD, Data/API (evaluation result schema), Analytics (evaluation events), and UX (status display).
- Any change to the Tier 2 tracking consent model must update FRD, Data/API (consent field), Security/NFR (privacy), and UX (account settings).
- Skill content (SKILL.md, scripts, references) is public-by-distribution; no redaction required. Telemetry must not store raw user input, PII, or Kids sensitive input.

---

## 7. Sprint Ready Rule

The PRD set can be treated as Sprint Ready when:

1. `01-07` have no unresolved contradiction on V1 scope, role permissions, data model, API, events, billing, Kids, streaming, and security gates.
2. Sprint 0 decisions `D-01` to `D-08` are either closed or accepted with defaults in `07_CTO_PRD_Review_Action_Items.md`.
3. Conditional P0 scope is explicitly enabled or disabled for launch.
4. Analytics event fields map to `03_Data_Model_and_API_Spec.md`.
5. Security/NFR launch gates are reflected in WBS and module acceptance criteria.

---

## 8. Relationship to Other Folders

| Location | Role |
|---|---|
| `tasks/` | Current implementation-ready modular PRD source of truth |
| `compliance/` | Compliance-specific release checks and independent risk controls |
| Root PRD files | Strategy/history only unless explicitly updated to mirror `tasks/01-07` |
