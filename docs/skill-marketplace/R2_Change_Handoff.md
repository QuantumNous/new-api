# R2 变更交接文档 — Distributable Skill Package Model (D-09)

> 本文件是一次 PRD 需求变更（R2）的完整记录，供团队成员了解：**变更动机、决策问答、设计结论、逐文件改动、Jira 影响**。
> 上游真相仍以 `tasks/00–08` + `compliance/` 为准；本文件是导览与交接。
> 适用日期：R2 这轮变更。本轮**只改 PRD 文档**，**未改动任何 Jira 票 / CSV**。

---

## 1. 一句话变更

把 DeepRouter 从 Skill 文件里的"说明/广告"变成**运行时硬依赖**：Marketplace 把每个 Skill 打包成**可下载 zip**，顾客下载后在自己环境运行，干活那一步**必须调 DeepRouter 的路由/选模型 API**。每次运行用**运行者自己的 key**鉴权、按其计费。传播即增长，删不掉（删掉那次调用 = Skill 失去路由能力）。

落到决策编号：**`D-09`**（见 `tasks/00_Overview.md` §0 Change Record）。

---

## 2. 变更前 vs 变更后

| 维度 | 变更前 | 变更后（R2 / D-09） |
|---|---|---|
| 分发形态 | 官方托管，站内 Playground 执行；Skill 不可下载 | Marketplace 打包成**可下载 zip**，顾客下载后自己环境运行 |
| `instruction_template` | 服务端独有、不可下载、从所有遥测脱敏 | **随 zip 分发、可读**；prompt 保密不再是护城河 |
| 护城河 | prompt 保密 | **运行时硬依赖 + 按次鉴权计费**：干活那步必须调 DeepRouter 路由/选模型（独有能力）；路由逻辑、provider 凭证、计费/entitlement 留服务端 |
| 执行入口 | 仅站内 Playground | **下载的 zip 客户端 → DeepRouter 公开路由/执行 API**；站内 Admin Preview 保留 |
| 鉴权计费 | 站内已登录用户 | 每次运行用**运行者自己的 key**（身份从校验过的 token 解析）；无 key 失败并提示注册 |
| 增长逻辑 | 站内留存 | **传播即增长**：每次 paste/下载 = 一个必须注册、按自身计费的新调用源 |

> **前提（必须满足，否则模型失效）**：DeepRouter 在"干活那一步"必须真有用（路由、选模型或独有能力）。若 Skill 本可离线跑而被硬塞调用，则既不真实也会被删掉。只对**能力型 Skill** 成立。

---

## 3. 我（Claude）问了哪些问题 + 你的答案

为定准方向，分两轮做了澄清。**关键背景**：你在第一轮前补了一句指令 ——「尽量朝着少改动 jira ticket 的方向修改」，这成为贯穿全程的次目标。

### 第一轮（3 个问题）

| # | 问题 | 选项 | **你的选择** |
|---|---|---|---|
| Q1 | 被 paste/分享出去的 zip，换个新人来跑时怎么鉴权计费？（决定能否复用 DR-64/DR-94 的 JWT 身份链路、不新增计费票） | A. 各自用自己的 key / B. 免费匿名额度后强制注册 / C. 内嵌下载者 token | **A：各自用自己的 key**（纯增长，复用 DR-64/DR-94，零新增计费票） |
| Q2 | 平台内托管的 Playground 执行路径要保留吗？ | A. 并存（新增 zip 客户端） / B. 替换为仅下载 | **B：替换为仅下载**（砍掉托管 Playground，Marketplace 变下载市场） |
| Q3 | zip 包里到底装什么？（决定是否动整章 Prompt 保护/合规） | A. 只装瘦客户端（核心留服务端） / B. 包含模板本体 | **B：包含模板本体**（模板进 zip，放弃 prompt 保密姿态） |

### 第二轮（1 个问题，澄清 Q3 与"少改 Jira"的张力）

> Q2「替换为仅下载」+ Q3「模板本体进 zip」与「少改 Jira」直接打架，需把"模板进 zip"精确化。两种终态都能实现你的"增长/删不掉/自带 key 计费"目标，区别只在护城河靠什么 + 改多少 Jira。

| 选项 | 含义 | Jira 改动 |
|---|---|---|
| A：瘦包装进 zip，核心留服务端 | zip 是 SKILL.md 包装 + 调 relay 脚本；真正路由/选模型/核心 template 留服务端 | 最小，保留 M11 整章 |
| **B：完整模板进 zip** ✅ **你的选择** | 连 `instruction_template` 本体一起打进 zip，放弃 prompt 保密；护城河 = 计费/鉴权 token 必须向 DeepRouter 换取/校验 | 大，M11 整章及若干安全票作废/重写 |

**最终结论**：选 **B**。主目标 = B；次目标 = 少改 Jira（**冲突处 B 胜**）。因此后端机器（relay/计费/entitlement/quota/Kids/NFR）尽量保留复用，只有"放弃 prompt 保密"带来的安全票不可避免地要重定义。

---

## 4. 设计结论（团队实现口径）

1. **zip 内容**：manifest + 已发布的 `instruction_template`（可读）+ 调 DeepRouter 公开路由 API 的瘦客户端。**绝不含** provider 凭证、服务端路由/选模型逻辑、草稿模板。
2. **执行入口**：DeepRouter 公开路由/执行 API（`Authorization: Bearer <运行者 key>` + `deeprouter.skill_id`/`skill_version_id`）。站内 Playground 端到端执行被替换；Admin Preview 保留。
3. **身份/计费**：身份只从校验过的 credential 解析（复用 JWT-only 不可变规则）；包内提供的 `user_id`/`tenant_id`/Kids 字段一律丢弃；按运行者计费。无 key → `AUTH_REQUIRED` + 提示注册。
4. **护城河三件套**：① provider 凭证留服务端；② 路由/选模型逻辑留服务端；③ 身份/计费完整性 + 包内容边界（包内绝无 ①②）。
5. **服务端权威**：路由/选模型用服务端 snapshot，不信任包内提供的 template/路由提示。
6. **仍然完全成立**：输入/系统提示分离与 prompt-injection 防护、输出守卫（针对 provider 凭证/原始 payload）、Kids 服务端拦截、租户隔离、provider ZDR/no-training、限流/熔断、对 raw input/PII/provider payload 的脱敏、kill switch。

---

## 5. 逐文件改动清单（13 个修改 + 1 个新建）

### tasks/ （8 个）

**`00_Overview.md`**
- 新增 **§0 Change Record**（变更前后 6 维对照表 + 前提说明）
- 重写 §1 Product Positioning 与产品闭环图
- §5 决策基线新增 **`D-09`**
- §6 跨模块规则新增 4 条（包格式变更、包内容边界、模板不再是脱敏对象）
- §4 模块职责表登记新文件 `08`

**`01_Functional_Requirements.md`**
- §1.1 范围 + 闭环图重写；§1.2 In Scope 新增 *Skill Packaging & Download*、*Public Routing API* 行，改写 *Relay Execution* / *Skill Execution Mode*；§1.3 Out of Scope 删除"Prompt 下载 永不"，*Public Skill API* 转入范围内，新增"站内 Playground 端到端执行"为 out
- §2 权限：Product/Growth 行、`View instruction_template` 行（改为 via package）、§2.3 规则改框
- §3.2 enable→download；§3.3 整段重写为 *Runs a Downloaded Skill Package* + 传播即增长说明；§3.5 / §7.1 "before injection" → "before provider execution"
- §4.1 新增 **FR-A19（发布即打包）** / **FR-A20（运行时依赖构建期守卫）**；FR-A14 改框
- §4.2 FR-U2/U3/U4/U5/U7/U8 → 下载
- §4.3 *Playground Skill Picker* → **Skill Package & Runtime Client**（FR-P1..P8 全替换）
- §4.4 FR-G1/G2/G10/G11 改框；§4.7 FR-D11 改框
- §8 `AUTH_REQUIRED` 触发条件更新；§9.3 数据质量模板条款改框
- §10.1 验收 1–7 改框；§10.3 P2 第 1 项（公开 API 移至 P0）

**`02_UX_Design.md`**
- §baseline：*Public Skill API* 行 → 分发/运行时依赖两行
- §1 原则：*Hosted* → *Downloadable*，Use-Time 加 key 提示
- §4.2.4 hosted prompt 文案 → 运行时依赖文案；发布检查 prompt 泄露 → 包构建
- §8.2 必备文案：hosted prompt → 运行时依赖 / 需要 key
- §10.1 验收 1–5 改框

**`03_Data_Model_and_API_Spec.md`**
- §1 设计原则：*Server-side DRM* → *Runtime-Dependency Moat*；Immutable/Privacy 改框
- §3 `entry_point` 枚举新增 `skill_package`
- §4.2 `skill_versions` 安全要求改框（已发布模板可随包、草稿仍受限、sha256 改为完整性校验）
- §6 数据安全分级改框
- §7.4 Auth/RBAC：新增 download 端点、公开路由 API 行
- §8.2 Detail API 说明改框 + **新增 §8.6 Download Skill Package 端点**
- §9 *Playground / Relay Contract* → **Public Routing / Relay Contract**（整段重写）

**`04_Analytics_and_Operations.md`**
- §1.2 非范围：公开 API 分析转入 V1
- entry_point 表新增 `skill_package`，`playground_picker` 标为 legacy
- 删除"must not use api"约束，改为 `skill_package` 为主入口

**`05_Security_and_NFR.md`**
- **新增 §0 R2 Security Model Reframe banner**（统一重解释全篇 prompt-保密条款）
- §1.1 目标改框 + 新增"运行时依赖&计费完整性"目标；§1.2 非范围改框
- §2.1 受保护资产改框；T-01/T-07 改框；**新增威胁 T-23/T-24/T-25**（身份伪造/运行时依赖完整性/凭证滥用）
- §3.1 分级改框；§3.2 *Prompt Leakage Prohibitions* → **Secret Leakage Prohibitions**（含"包内不得含 provider 凭证/路由逻辑"）
- §4.1 路由访问表（执行入口、模板查看）；§4.3 身份来源（包客户端）
- §5.1 执行链步骤 1/3/10/11/14/16/17 + 末尾约束改写；§5.3 provider adapter；§5.4 smart router
- §6.3 Admin Preview（echo prompt → echo secrets）；§7.2 注入顺序；§11.1 日志
- §11 测试矩阵：prompt 泄露测试 → 密钥/伪造/完整性测试

**`06_Module_Breakdown_WBS.md`**
- §1.1 基准 + 闭环图；§1.2 锁定决策；§1.3 D-06 缩范围 + 新增 **D-09**
- 模块表 M02/M03/M04 改名；M01 工作项 + 验收改框
- M02 新增打包工作项 + `/package` 接口 + 风险改框；M03 owns/工作项/验收改框
- **M04 整模块替换**（*Playground Skill Picker* → *Skill Package & Download Client*）
- M05 工作项 + 验收 + 风险改框；**M11 整模块改框**（*Security, Package Boundary, and Audit*）
- M14/M15 工作项 + 验收改框；§4.1 依赖矩阵 M02/M04；§5 Epic 映射 C/F；§6 Sprint 1a；§7 P0 闭环 2–7、11；M00 工作项

**`07_CTO_PRD_Review_Action_Items.md`**
- §1.1 Product Direction；V1 执行面行；*Prompt protection* 行 → *Platform IP protection*
- D-06 缩范围 + 新增 **D-09**；已解决问题表：公开 API 歧义、泄露范围、测试缺口；"do not implement public API" 行

### compliance/ （5 个）

**`Skill_Marketplace_Compliance.md`**：§2 裁决（Sprint Planning D-09、Prompt Storage → 密钥/包边界 + 身份计费完整性）；§3 溯源表；M11 状态；非范围（公开 API、prompt download）；签字（Security）；"模板永不返回"条款改框
**`01_Safety_And_Kids_Mode.md`**：注入顺序；§5 *Prompt and Instruction Protection* → *Platform Secret and IP Protection*；Critical 事件触发；上线验收 3/5
**`02_Audit_RBAC_Privacy.md`**：角色 scope（Normal User / Product-Growth / Support）；查看/编辑模板矩阵；合规测试 1/2/5 + 新增第 9 条
**`03_Release_Readiness_Checklist.md`**：范围排除项 + 包构建检查；安全项（D-06 缩范围、密钥泄露、伪造/完整性/滥用测试、输出提取）；Admin Preview 守卫；签字（Security）；"模板永不出现"条款改框
**`README.md`**：文档地图 01 行；用法 D-01..D-09

### 新建（1 个）

**`tasks/08_R2_Jira_Impact_Map.md`** — 130 张票的影响地图（详见下一节）

---

## 6. Jira 影响小结

> 本轮**未改动**任何 Jira 票 / CSV。下表为影响地图，供后续刻意执行；完整逐票清单见 `tasks/08_R2_Jira_Impact_Map.md`。

| 类别 | 数量 | 代表票 | 处置 |
|---|---|---|---|
| **A 保留/复用**（后端机器，无需改） | ~108 | DR-39~51, DR-64~72, DR-79/89/90/93/122-125, DR-94, DR-95-105, DR-140-156, 看板/NFR/发布 | 原样复用 ✅ |
| **B 重定义**（同票，仅改描述，零风险） | ~12 | DR-62/63（包客户端）, DR-55/56（下载）, DR-68（服务端路由）, DR-73（加 entry_point）, DR-82/134/160 | 改 Summary/验收文字 |
| **C 新增**（R2 独有，尽量少） | ~6 | 发布即打包(FR-A19)、运行时依赖守卫(FR-A20)、下载 API、路由 API 滥用控制(T-25)、伪造/边界测试(T-23/24) | 新开票或并入现有 |
| **D 作废/缩范围**（放弃 prompt 保密的代价） | ~5 | DR-91（模板加密）, DR-133（prompt 脱敏）, DR-135（prompt 提取测试）, DR-137（模板读取审计）, DR-139 | 重定义/缩范围 |

**唯一不可避免的冲突**：D 类 5 张票，是选 **B（完整模板进 zip）**与"少改 Jira"打架处。若要完全零 Jira 改动，只能回到 **A（瘦包装、核心留服务端）**；当前选定 B，故 D 类重写不可避免。

执行建议顺序：先做 **B**（改描述、零风险）→ 再定 **C**（新增）→ 最后 **D**（重定义/缩范围）。

---

## 7. 给组员的快速导航

- 想理解新模型 → `tasks/00_Overview.md` §0
- 想看安全口径怎么变 → `tasks/05_Security_and_NFR.md` §0 banner + T-23/24/25
- 想看 API 合约（下载端点 + 路由契约）→ `tasks/03_Data_Model_and_API_Spec.md` §8.6、§9
- 想看模块/分工怎么变 → `tasks/06_Module_Breakdown_WBS.md` M02/M04/M11
- 想动 Jira → `tasks/08_R2_Jira_Impact_Map.md`
