# Skill Marketplace Functional Requirements

本文档定义 DeepRouter Skill Marketplace V1 的企业级功能需求。目标是让 Product、Engineering、Design、QA、Operations 和独立 Agent 能按同一口径理解范围、权限、状态、异常路径和验收标准。

---

## 1. Scope

### 1.1 V1 Product Scope

V1 仅支持 **官方 curated Skills**。Skill Marketplace 是 DeepRouter 订阅的内容附加价值层：Pro 订阅解锁 Pro Skills 下载权限，DeepRouter 不参与 Skill 执行、不计执行 token。

Skill 包为 **Claude Code 原生兼容格式**，zip 解压到 `.claude/skills/` 即可用 `/skillname` 调用，也可在任何支持 SKILL.md 的工具中使用。zip 结构：

```
skillname/
├── SKILL.md          ← 入口，Claude Code 原生格式（必须）
├── manifest.json     ← Marketplace 元数据，version/skill_id/plan（必须）
├── scripts/          ← 可选：bash/python/node 脚本
├── references/       ← 可选：上下文文档、外部引用
└── sub-agents/       ← 可选：子 agent 定义（.md）
```

每个 Skill 发布前须通过 **Evaluation Pipeline**（格式 / 任务完成度 / 违规 / 完整性）；evaluation failed 不能发布。

护城河为 **Marketplace 平台粘性**：发现质量、官方策展、Evaluation 信任背书、社区评分。

> 详见 `00_Overview.md` §0 与决策 `D-09`。

V1 必须交付以下闭环：

```text
Admin 创建 Skill（SKILL.md + 可选 scripts/references/sub-agents）
→ 触发 Evaluation Pipeline（格式 / 任务完成度 / 违规 / 完整性）
→ Evaluation passed → 发布到 Marketplace
→ 用户浏览 / 搜索 / 收藏 / 查看详情（Tier 1 tracking）
→ 用户下载 zip（一次性校验订阅级别）
→ 用户在本地解压，用任意 LLM 运行
→ 授权用户回传 installed / used（Tier 2 tracking，opt-in）
→ Operations 根据下载量、转化率、评分、Evaluation 结果优化内容质量
```

### 1.2 In Scope

| Area | V1 Requirement | Priority |
|---|---|---|
| Skill Supply | Super Admin 创建、编辑、预览、发布、归档官方 Skill（支持复杂包：SKILL.md + scripts + references + sub-agents） | P0 |
| Skill Packaging & Download | 发布时打包为 SKILL.md 兼容 zip；Marketplace 提供下载入口；下载时一次性校验订阅级别 | P0 |
| Evaluation Pipeline | 每个 Skill 发布前须通过自动化评估（格式、任务完成度、违规、完整性）；failed 不能发布 | P0 |
| Marketplace | 用户浏览、搜索、分类筛选、查看详情、下载 Skill 包 | P0 |
| Marketplace Actions | 用户可收藏（save/favorite）、评分（1-5 星 + 短评）、举报 Skill | P0 |
| My Skills | 用户查看已下载 Skill、订阅状态、锁定原因 | P0 |
| Entitlement | 下载资格与执行 entitlement 分离；执行期由 Relay 做服务端 runtime 校验 | P0 |
| Tier 1 Tracking | 平台侧事件：impression / detail_view / save / download / favorite / rating / report | P0 |
| Tier 2 Tracking | 用户在账号设置中授权后，回传 installed / used 本地行为数据 | P1 |
| Analytics | 关键事件、下载漏斗、转化率、评分、Evaluation 结果 | P0 |
| Operations Dashboard | 每个 Skill：访问量、下载量、转化率、评分、举报、版本、verified 状态、evaluation 结果、persona/tenant 分布 | P0 |
| Kids Safety | Kids Safe 标记、Kids Session 下载过滤、审批要求 | P0 if Kids enabled |
| Audit | Admin 关键写操作进入 audit log | P0 |
| Feature Flag | Marketplace 可灰度开启和快速关闭 | P0 |

### 1.3 Out of Scope

| Item | V1 Decision | Target |
|---|---|---|
| 用户自建 / 上传 Skill | 不支持；V1 仅官方 curated | V2 |
| Creator Marketplace / 分成 | 不支持 | V2 |
| 站内 Playground 端到端执行 | 不作为终端用户执行面；Admin Preview 保留用于测试 | V2 |
| 多 Skill 叠加 | 不支持 | V2+ |
| DeepRouter 运行时绑定 / 执行 token 计费 | 不做；V1 不参与 Skill 执行 | 不列入路线图 |
| 完整推荐算法 | V1 仅规则推荐 | V1.1/V2 |
| Tier 2 遥测仪表盘（installed/used 聚合） | P1；需 Tier 2 数据量达到统计意义 | V1.1 |
| 完整 Sharing / Referral | 不作为 V1 P0 | V1.1 |

### 1.4 Sprint 0 Decisions Required Before Sprint 1

All Sprint 0 decisions must use the canonical `D-01` to `D-08` IDs defined in `06_Module_Breakdown_WBS.md` and governed in `07_CTO_PRD_Review_Action_Items.md`. Historical local IDs must not be used as independent blocking decision IDs.

| ID | Decision | Owner | Deadline | Blocking |
|---|---|---|---|---|
| D-01 | Free / Pro / Enterprise plan matrix and Free Skill monthly quota | CEO + Product | Sprint 0 | Entitlement, Billing, UI lock states |
| D-02 | Analytics build vs buy, event sink, and dashboard source | EM + Product | Sprint 0 | Event pipeline, Dashboard |
| D-03 | Kids release mode: GA P0, closed beta, or disabled by default | Product + Safety + Legal | Sprint 0 | Kids Safety, Compliance, UX visibility |
| D-04 | Streaming launch scope and partial-output billing behavior | Product + Engineering + Finance | Sprint 0 | Relay, Safety, Billing, NFR |
| D-05 | Provider/model system-boundary allowlist | Security + Engineering | Sprint 0 | Relay provider integration, model whitelist |
| D-06 | `instruction_template` encryption mechanism | Security + Backend | Sprint 0 | Production data protection |
| D-07 | Revenue counting statuses | Finance + Data | Sprint 0 | Revenue attribution dashboard |
| D-08 | Initial official Skill catalog | Product + Ops | Sprint 0 | Content QA, launch readiness |

---

## 2. Roles & Permissions

### 2.1 Role Definitions

| Role | Definition |
|---|---|
| Anonymous Visitor | 未登录访客，可查看公开 Marketplace 信息，但不能启用或执行 Skill |
| Normal User | 登录用户，可浏览、启用、停用、使用符合权限的 Skill |
| Operation | 运营人员，可查看运营数据、创建 review、标记问题、处理质量反馈 |
| Safety Reviewer | 安全审核人员，可审批 Kids Safe / Kids Exclusive 发布条件 |
| Product / Growth | 产品和增长人员，可查看指标、管理推荐策略；`instruction_template` 随发布包公开，但 Product/Growth 不可编辑 |
| Super Admin | 平台最高权限，可管理 Skill 内容、版本、发布、归档、Kids 标记和审计 |
| Support | 客服人员，可查看有限诊断信息和用户反馈，不可查看 prompt 或敏感内容 |

### 2.2 Permission Matrix

| Capability | Anonymous | Normal User | Operation | Safety Reviewer | Product/Growth | Support | Super Admin |
|---|---:|---:|---:|---:|---:|---:|---:|
| Browse published Skills | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| View Skill Detail | Public fields only | Yes | Yes | Yes | Yes | Yes | Yes |
| Enable / Disable Skill | No | Yes | No | No | No | No | Yes for support action only |
| Execute Skill in Playground | No | Yes | No | No | No | No | Yes for preview/test |
| View My Skills | No | Own only | No | No | No | Assisted user status only | Any user if audited |
| View Analytics aggregate | No | No | Yes | Safety only | Yes | Limited | Yes |
| View user-level analytics | No | Own only if exposed | No by default | No | No | Limited support view | Yes with audit |
| Export CSV | No | No | P1, aggregate only | No | P1, aggregate only | No | Yes |
| Create / edit Skill metadata | No | No | No | No | No | No | Yes |
| View `instruction_template` | Via published package | Via published package | Via published package | Via published package | Via published package | Via published package | Yes (incl. drafts) |
| Edit `instruction_template` | No | No | No | No | No | No | Yes only |
| Preview Skill | No | No | No | Safety preview only | No | No | Yes |
| Publish / Archive / Deprecate | No | No | No | No | No | No | Yes |
| Approve Kids Safe | No | No | No | Yes | No | No | Yes only with reviewer role or emergency override |
| View audit log | No | No | No | Own approvals only | No | No | Yes |

### 2.3 Permission Rules

- `instruction_template` of a **published** Skill is distributed inside the downloadable package and is therefore readable by anyone who obtains the package; it is no longer a confidentiality boundary. Draft/unpublished templates remain Super Admin only.
- **Editing** `instruction_template` (and creating new versions) remains Super Admin only, regardless of who can read the published package.
- The package must never contain provider credentials, server-side routing/model-selection logic, or any secret that would let it bypass DeepRouter; only Super Admin/Relay hold those.
- Operation can create and manage `skill_reviews`, but cannot edit Skill content.
- Safety Reviewer can approve Kids-related safety checks, but cannot publish a Skill unless also Super Admin.
- Super Admin emergency override must create an audit log entry with reason.
- Support diagnostics must not expose prompt, full user input, Kids sensitive data, or provider raw logs.

---

## 3. Primary User Journeys

### 3.1 Admin Creates and Publishes Official Skill

1. Super Admin opens Skill Management.
2. Super Admin creates draft Skill.
3. Super Admin fills required metadata: name, category, short description, description, tags, input hints, examples.
4. Super Admin configures entitlement: `required_plan`, `monetization_type`, quota, markup, and `max_input_tokens` when the Skill is Free or free-quota eligible.
5. Super Admin configures execution: `instruction_template`, output format, model whitelist, timeout.
6. Super Admin runs Preview Test at least once.
7. If Kids flags are enabled, Safety Reviewer approval is required before publish.
8. Super Admin publishes Skill.
9. Published Skill appears in Marketplace according to visibility rules.
10. `skill_admin_action` and `skill_version_created` events are recorded where applicable.

### 3.2 User Discovers and Enables Skill

1. User visits Marketplace.
2. Marketplace emits `skill_impression` for visible cards.
3. User opens Skill Detail.
4. System emits `skill_detail_view`.
5. Detail page displays plan requirement, example input/output *(V1: deferred — `PublicSkillDetail` does not yet expose example/input-hint fields; tracked under DR-53)*, safety labels, runtime-dependency note (Skill requires a DeepRouter key to run), and Download CTA.
6. If user is anonymous, Download CTA routes to login/signup (so a DeepRouter credential exists for later runtime calls). *(V1: Marketplace and Detail are authenticated-only; anonymous browse is deferred to a follow-up route-opening ticket.)*
7. If user is logged in, user downloads the Skill package (zip).
8. System creates or updates `user_enabled_skills` as the download/entitlement record.
9. System emits `skill_enabled` (download). Note: download grants no permanent execution right; entitlement is still checked at runtime per call.

### 3.3 User Runs a Downloaded Skill Package

1. User downloads the Skill package (zip) from Marketplace, or obtains it via paste/share/forward from someone else.
2. User runs the package in their own environment (e.g. its bundled client/script executes).
3. The package's core work step calls the **DeepRouter public routing/execution API**, sending `skill_id`, the user input, and the runner's own DeepRouter credential. **The package must not send conversation history from previous Skill turns; V1 execution is stateless.**
4. If no valid credential is present, the call fails with `AUTH_REQUIRED` and the package surfaces a signup/onboarding prompt; no execution occurs.
5. Relay resolves the authenticated **runner** (user, tenant, session) and Kids Session **server-side from the validated credential** — never from package-supplied fields.
6. Relay loads the immutable Skill execution context for `skill_id` + active `skill_version_id` (the server is the source of truth for routing/model selection, not the package).
7. Relay performs status, entitlement, quota, Kids, model whitelist, token, and rate checks against the runner.
8. Relay performs routing/model selection and executes. **Relay does not concatenate prior-turn messages into the provider request; each request is a self-contained single-turn call.**
9. Relay calls the model provider with server-held provider credentials.
10. Result is returned with AI-generated disclosure.
11. System emits usage, analytics, and billing attribution events **attributed to the runner**.

> **Stateless enforcement**: V1 Relay must not receive, store, or forward conversation history to the provider as part of Skill execution. `input_tokens` billed per request equals `instruction_template tokens + single user input tokens + output schema tokens` only. Each call from the downloaded package is treated as a fresh, independent request with the same fixed Skill context cost.

> **Propagation = growth**: because step 3 is a mandatory call to DeepRouter and step 5 binds identity/billing to the runner's own credential, every forwarded copy of the package becomes an independent, self-billing source of API calls. Removing the DeepRouter call removes the Skill's routing capability, so the dependency cannot be stripped without breaking the Skill.

### 3.4 User Membership Expires

1. Skill remains visible in My Skills.
2. Skill may show locked/renewal state.
3. User attempts execution.
4. Relay performs use-time entitlement check.
5. Request is blocked with `SKILL_SUBSCRIPTION_INACTIVE` or `SKILL_PLAN_REQUIRED`.
6. UI displays renew / upgrade CTA.
7. System emits `skill_blocked`.
8. No charge is created.

### 3.5 Kids Session Attempts Unsafe Skill

1. User is in server-resolved Kids Session.
2. User views Marketplace or Playground.
3. Non-`is_kids_safe` Skills must be hidden, disabled, or blocked.
4. If a downloaded package attempts execution, Relay blocks before any provider execution.
5. System emits `skill_blocked` with `block_reason=kids_mode_blocked`.
6. No prompt, input, or sensitive Kids content is persisted.

---

## 4. Functional Requirements by Module

### 4.1 Super Admin: Skill Management

| ID | Requirement | Priority | Acceptance Notes |
|---|---|---|---|
| FR-A1 | Create Skill draft | P0 | Draft is not visible to end users |
| FR-A2 | Edit Skill metadata | P0 | Includes name, category, tags, descriptions, input hints, examples |
| FR-A3 | Edit `instruction_template` | P0 | Super Admin only; creates new version when changed |
| FR-A4 | Preview Skill | P0 | Preview executes against draft/version without public visibility |
| FR-A5 | Publish Skill | P0 | Requires mandatory fields and safety checks |
| FR-A6 | Archive Skill | P0 | Archived Skill cannot be discovered, enabled, or executed |
| FR-A7 | Deprecate Skill | P1 | Hidden from new users; enabled users may continue execution |
| FR-A8 | Mark Skill as Featured | P1 | Uses `featured_flag`, not lifecycle status |
| FR-A9 | Set `required_plan` | P0 | Values: free, pro, enterprise |
| FR-A10 | Set monetization fields | P0 | Includes type, markup, free quota when applicable |
| FR-A10a | Set Skill input token cap | P0 | `max_input_tokens` required for Free Skills or free-quota execution paths |
| FR-A11 | Set model whitelist | P0 | Relay must enforce whitelist |
| FR-A12 | Mark Kids Safe | P0 if Kids enabled | Requires Safety Reviewer approval |
| FR-A13 | Mark Kids Exclusive | P0 if Kids enabled | Requires Safety Reviewer approval |
| FR-A14 | View version history | P1 | Version metadata visible; published-version templates are public via package; drafts Super Admin only |
| FR-A15 | View audit log | P0 | All writes show actor, timestamp, action, changed fields, reason |
| FR-A16 | Manage publish checklist | P0 | Blocks publish if required checklist items fail |
| FR-A17 | Run jailbreak / leakage tests | P1; P0 if Kids enabled or Security requires launch gate | Required before Kids publish; Security/NFR owns mandatory launch test suite |
| FR-A18 | Manage beta whitelist | P1 | Used for rollout stages |
| FR-A19 | Build downloadable Skill package on publish | P0 | Publish 触发 Evaluation → passed 后打包 zip（SKILL.md + manifest.json + 可选 scripts/references/sub-agents）；pinned to `skill_version_id` |
| FR-A20 | Package build-time 安全检查 | P0 | zip 不含 credentials / API keys；SKILL.md 不含违规指令；引用路径可解析 |
| FR-A21 | Admin 可查看 Evaluation 结果和 issue 详情 | P0 | 修改后可手动重新触发 Evaluation |
| FR-A22 | Admin 可上传 scripts/references/sub-agents 作为 Skill 组成部分 | P0 | 支持复杂 Skill 包 |
| FR-A23 | Verified 审核由 Super Admin 手动授予 | P1 | 独立于 Evaluation；记入 audit log |

### 4.2 End User: Marketplace

| ID | Requirement | Priority | Acceptance Notes |
|---|---|---|---|
| FR-U1 | Browse published Skills | P0 | Only public fields returned |
| FR-U2 | View Skill Detail | P0 | Shows plan, labels, runtime-dependency note, Download CTA, AI disclosure. V1: examples/input hints deferred (not exposed by `PublicSkillDetail`; DR-53 follow-up) |
| FR-U3 | Download Skill package | P0 | Login/signup required; archived/draft cannot be downloaded; deprecated cannot be newly downloaded |
| FR-U4 | Remove from My Skills | P0 | Existing usage/billing history remains; does not invalidate already-downloaded copies (runtime auth still gates execution) |
| FR-U5 | View My Skills | P0 | Shows downloaded Skills, status, lock reason, last used |
| FR-U6 | See locked Skill state | P0 | Shows upgrade/renew/contact-sales CTA |
| FR-U7 | Download from Detail | P0 | Package available if Skill is published and user is entitled |
| FR-U8 | Search Skill name/description | P1 | Searches public metadata only |
| FR-U9 | Filter by category | P1 | Category list excludes empty unpublished categories |
| FR-U10 | Anonymous public browsing | P1 | Anonymous cannot see enabled state; CTA routes to login |
| FR-U11 | Submit output feedback | P2 | Creates review signal, not public rating |
| FR-U12 | View Kids-compatible Skills | P0 if Kids enabled | Kids Session only sees safe or exclusive allowed Skills |
| FR-U13 | Handle unavailable Skill | P0 | Shows friendly unavailable message for archived/deprecated cases |

### 4.3 Skill Package Format

The downloadable package is a **Claude Code native compatible zip**. It is self-contained and runnable with any LLM. DeepRouter does not participate in execution.

**Zip structure:**
```
skillname/
├── SKILL.md          ← Entry point; Claude Code native format (required)
├── manifest.json     ← Marketplace metadata (required)
├── scripts/          ← Optional: bash / python / node scripts
├── references/       ← Optional: context docs, external references
└── sub-agents/       ← Optional: sub-agent definitions (.md files)
```

**manifest.json required fields:**
```json
{
  "skill_id": "<uuid>",
  "skill_version_id": "<uuid>",
  "name": "Skill display name",
  "required_plan": "free | pro | enterprise",
  "published_at": "<ISO8601>",
  "marketplace_url": "https://deeprouter.ai/skills/<slug>"
}
```

| ID | Requirement | Priority | Acceptance Notes |
|---|---|---|---|
| FR-P1 | Package entry point is a valid SKILL.md | P0 | Must parse with Claude Code frontmatter; skill name from directory name |
| FR-P2 | SKILL.md frontmatter fields: name, description, allowed-tools, user-invocable, model, context, argument-hint | P0 | All optional except content body; defaults applied per Claude Code spec |
| FR-P3 | Package may include scripts/, references/, sub-agents/ directories | P0 | Optional; paths referenced in SKILL.md must resolve within zip |
| FR-P4 | manifest.json present with required fields | P0 | Used for version management and update detection in My Skills |
| FR-P5 | Package contains no credentials, API keys, or server-side secrets | P0 | Security gate at build time |
| FR-P6 | Package is pinned to `skill_version_id` at build time | P0 | Re-download on version update |
| FR-P7 | Admin Preview retained as in-platform test surface | P0 | `entry_point=admin_preview`; not end-user execution surface |
| FR-P8 | Installation instructions shown on download | P0 | "Extract to .claude/skills/ and use /skillname in Claude Code" |

### 4.4 Evaluation Pipeline

每个 Skill 在发布前必须通过自动化评估。Evaluation failed = 不能发布，Admin 须修改后重新触发。

| ID | Requirement | Priority | Acceptance Notes |
|---|---|---|---|
| FR-EV1 | 发布动作触发 Evaluation Pipeline | P0 | Admin 点 Publish → 先跑 Evaluation，passed 才写入 published 状态 |
| FR-EV2 | 格式检查：SKILL.md 可被 Claude Code 解析 | P0 | frontmatter 合法，content body 非空，manifest.json 字段完整 |
| FR-EV3 | 完整性检查：scripts/references/sub-agents 内引用路径在 zip 内可解析 | P0 | broken reference = failed |
| FR-EV4 | 任务完成度测试：用 Skill 描述的 example_input 跑一遍，输出与 example_output 做语义对比 | P0 | score < 阈值 = failed；阈值 Admin 可配 |
| FR-EV5 | 违规检查：SKILL.md content 不含有害指令、PII 采集、越权工具调用 | P0 | 违规 = failed，记录 issue 类型 |
| FR-EV6 | Evaluation 结果存入 skill record | P0 | status: passed/failed/warning；score 0-100；issues list |
| FR-EV7 | Admin 可查看 Evaluation 详情和 issue 列表 | P0 | 用于修改后重新发布 |
| FR-EV8 | Evaluation 结果在详情页展示（evaluation badge） | P0 | passed + verified 分开显示 |
| FR-EV9 | Verified 状态由人工 Admin 审核授予，独立于 Evaluation | P1 | verified = 人工复核通过的高质量背书 |
| FR-EV10 | 版本更新触发重新 Evaluation | P0 | 新版本须重新 passed 才能激活 |

### 4.5 Entitlement / Membership

| ID | Requirement | Priority | Acceptance Notes |
|---|---|---|---|
| FR-E1 | Support `required_plan` | P0 | free, pro, enterprise |
| FR-E2 | Check active subscription at execution time | P0 | Expired subscription blocks next call |
| FR-E3 | Check plan hierarchy | P0 | Enterprise satisfies pro unless overridden |
| FR-E4 | Support Free Skill monthly quota | P0 if free quota is adopted | Quota exceeded returns 429 with reset time when available |
| FR-E4a | Enforce free-path input token cap | P0 if free quota is adopted | Free Skill/free-quota requests must respect the active version `max_input_tokens` snapshot before provider call |
| FR-E5 | Return standard block reason | P0 | See Section 8 |
| FR-E6 | UI receives lock state | P0 | Marketplace, Detail, My Skills, Playground; quota locks include reset guidance and upgrade CTA where Product approved |
| FR-E7 | Admin can change entitlement config | P0 | Change is audited; existing enabled users are checked at use time |
| FR-E8 | Support Enterprise contact-sales state | P1 | CTA does not imply entitlement |

### 4.6 Entitlement（下载 + 执行）

V1 将下载资格与执行时 entitlement 分开处理。下载阶段可以校验订阅/Kids 资格，但 Relay 仍是执行期 authority，必须在每次 Skill 调用时重新校验 entitlement、状态、quota、Kids 与其他 runtime guard。

| ID | Requirement | Priority | Acceptance Notes |
|---|---|---|---|
| FR-E1 | 下载时校验用户订阅级别 vs `required_plan` | P0 | free/pro/enterprise；不符合返回 403 + upgrade CTA |
| FR-E2 | 订阅校验时机：Download 时可预检查，执行时仍需 Relay 再校验 | P0 | 已下载 zip 不保证后续 execution entitlement；订阅/配额/Kids 状态变化在下次调用时生效 |
| FR-E3 | Free Skill 任何登录用户可下载 | P0 | 无需订阅 |
| FR-E4 | Pro Skill 须 Pro 或 Enterprise 订阅 | P0 | Free 用户看到 locked + Upgrade CTA |
| FR-E5 | Enterprise Skill 须 Enterprise 订阅 | P0 | 非 Enterprise 用户看到 Contact Sales CTA |
| FR-E6 | Kids Safe 过滤在下载时应用 | P0 if Kids enabled | Kids Session 不可下载非 kids_safe Skill |
| FR-E7 | 订阅状态变化不影响已下载 zip 的可用性，但会影响后续执行权 | P0 | 下载权是一次性的；执行权由 Relay 在每次调用时决定 |

### 4.7 Analytics & Data Entry

**Tier 1（平台侧，无需用户授权）**

| ID | Event | Priority | Notes |
|---|---|---|---|
| FR-D1 | `skill_impression` | P0 | Marketplace 卡片曝光；含 entry_point |
| FR-D2 | `skill_detail_view` | P0 | 详情页访问；含 referrer entry_point |
| FR-D3 | `skill_saved` | P0 | 用户收藏/取消收藏 |
| FR-D4 | `skill_downloaded` | P0 | 下载 zip；含 plan、version |
| FR-D5 | `skill_favorited` | P0 | 加星 / 取消加星 |
| FR-D6 | `skill_rated` | P0 | 提交评分；含 stars(1-5)、has_comment |
| FR-D7 | `skill_reported` | P0 | 举报；含 report_reason |
| FR-D8 | `skill_evaluation_completed` | P0 | Evaluation 结束；含 status、score |
| FR-D9 | `skill_admin_action` | P0 | Admin 写操作：create/publish/archive/kids approval |
| FR-D10 | `skill_kids_approved` | P0 if Kids | Kids 审批通过 |

**Tier 2（用户在账号设置中授权后回传）**

| ID | Event | Priority | Notes |
|---|---|---|---|
| FR-D11 | `skill_installed` | P1 | 用户解压到 .claude/skills/ 后回传；含 skill_id、version |
| FR-D12 | `skill_used_local` | P1 | /skillname 被调用时回传；含 skill_id、用户 locale（无 raw input） |

**通用规则**

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| FR-D13 | 每个事件含 entry_point，不得为 null | P0 | |
| FR-D14 | 不存储 raw user input、PII、Kids 敏感输入 | P0 | |
| FR-D15 | Tier 2 事件须在 header 中携带用户授权 token | P1 | 无授权 token 的 Tier 2 事件丢弃 |
| FR-D16 | Aggregation API 支持 Dashboard | P0 | overview、funnel、skill table、conversion rate |

### 4.8 Operations Dashboard & Review

**每个 Skill 的详情指标（Ops 可查）：**

| ID | Requirement | Priority | Acceptance Notes |
|---|---|---|---|
| FR-O1 | 详情页访问量、下载量、收藏数 | P0 | 按时间段 |
| FR-O2 | 下载转化率 = downloads / detail_views | P0 | 核心健康指标 |
| FR-O3 | 漏斗：impression → detail → download | P0 | 找掉落节点 |
| FR-O4 | 评分均值、评分分布、评论数 | P0 | |
| FR-O5 | 举报数量、举报类型分布 | P0 | 触发 review 阈值 |
| FR-O6 | Evaluation status + score + issue 列表 | P0 | 每个版本 |
| FR-O7 | Verified 状态 + 审核人 + 审核时间 | P1 | |
| FR-O8 | 版本历史 + 每版本 evaluation 结果 | P1 | |
| FR-O9 | 按 plan / persona / tenant / 日期 筛选 | P1 | Persona 可粗粒度 |
| FR-O10 | Tier 2 数据：installed 数、used 数（授权用户子集） | P1 | 须注明数据覆盖范围 |
| FR-O11 | Create / assign / resolve / escalate skill_review | P1 | Manual + 自动触发（举报 > 阈值） |
| FR-O12 | CSV export（聚合，仅 Super Admin 可含明细） | P2 | |

### 4.9 Recommendation & Discovery

| ID | Requirement | Priority | Acceptance Notes |
|---|---|---|---|
| FR-R1 | Featured rail | P1 | Controlled by featured flags |
| FR-R2 | Popular rail | P1 | Based on recent successful usage |
| FR-R3 | New rail | P1 | Recently published Skills |
| FR-R4 | Recommended Lite | P1 | Persona/category rules only |
| FR-R5 | Exclude archived/deprecated from recommendations | P0 | Deprecated may appear only in My Skills |
| FR-R6 | Recommendation surfaces emit events | P1 | Impression/click/conversion |

### 4.10 Support & Incident

| ID | Requirement | Priority | Acceptance Notes |
|---|---|---|---|
| FR-S1 | Support can diagnose enabled/locked state | P1 | No prompt exposure |
| FR-S2 | Support can see error code and request id | P1 | No raw provider payload |
| FR-S3 | Prompt leakage incident can force archive Skill | P0 | Super Admin action with audit |
| FR-S4 | Feature flag can disable Marketplace | P0 | Data retained |

---

## 5. Lifecycle & State Machine

### 5.1 Skill Status

`featured` is not a lifecycle status. It is a promotion flag.

| Status | Discoverable | Enableable | Executable by already-enabled user | Editable | Notes |
|---|---:|---:|---:|---:|---|
| `draft` | No | No | No | Yes | Admin only |
| `published` | Yes | Yes | Yes | Metadata editable; template creates new version | Normal live state |
| `deprecated` | No for new users | No for new users or disabled prior users | Yes only when `user_enabled_skills.enabled=true` at use time | Limited | Used for phase-out; disabled users cannot re-enable unless Super Admin republishes |
| `archived` | No | No | No | No except restore metadata by Super Admin | Hard unavailable |

> **DR-67 live behavior:** the relay gate now allows `deprecated` Skills only for
> callers that already have `user_enabled_skills.enabled=true` and still pass the
> use-time entitlement check against the active `required_plan_snapshot`.
> New users and disabled prior users remain blocked with `skill_not_published`.

### 5.2 Promotion Flags

| Field | Purpose |
|---|---|
| `featured_flag` | Whether Skill appears in Featured rail |
| `featured_rank` | Manual ordering among featured Skills |
| `popular_rank` | Derived or cached ranking, not manually required |

### 5.3 State Transitions

| From | To | Allowed By | Conditions |
|---|---|---|---|
| none | draft | Super Admin | Required minimal metadata |
| draft | published | Super Admin | Publish checklist passed |
| published | deprecated | Super Admin | Reason required |
| deprecated | published | Super Admin | Re-review required if template changed |
| published | archived | Super Admin | Reason required |
| deprecated | archived | Super Admin | Reason required |
| archived | draft | Super Admin | Rework path; must republish |

### 5.4 Versioning Rules

- Editing display metadata does not require a new `skill_version`.
- Editing `instruction_template`, output schema, model whitelist, or safety-critical execution fields creates a new `skill_version`.
- Execution must use an immutable snapshot selected at request entry.
- Usage, billing, and analytics events must include `skill_version_id`.
- Deprecated Skills can receive safety or quality patch versions.
- If a Super Admin edits `instruction_template`, model whitelist, output schema, or safety-critical execution fields on a `deprecated` Skill, the new version must be activated immediately for all already-enabled, still-entitled users who retain execution rights.
- Deprecated Skill patch activation must not make the Skill discoverable or enableable by new or previously disabled users.
- If the patch cannot be safely activated for existing users, the Skill must be archived or disabled through kill switch rather than leaving vulnerable deprecated versions executable.

---

## 6. Entitlement Decision Table

| User / Session | Skill | Subscription | Enabled? | Expected Result | Block Reason |
|---|---|---|---:|---|---|
| Anonymous | Any | None | No | Login required before enable/use | `AUTH_REQUIRED` |
| Free user | Free Skill | Active/free | Yes | Allow if quota available | None |
| Free user | Free Skill | Active/free | Yes | Block if quota exceeded | `quota_exceeded` |
| Free user | Pro Skill | Active/free | Any | Block + upgrade CTA | `plan_required` |
| Pro user | Pro Skill | Active/pro | Yes | Allow | None |
| Pro expired | Pro Skill | Inactive | Yes | Block + renew CTA | `subscription_inactive` |
| Enterprise user | Pro Skill | Active/enterprise | Yes | Allow | None |
| Non-enterprise | Enterprise Skill | Active/free or pro | Any | Block + contact sales CTA | `plan_required` |
| Any logged-in user | Published Skill | Active | No | Block execution; allow enable if entitled | `skill_not_enabled` |
| Any logged-in user | Draft Skill | Any | Any | Block | `skill_not_published` |
| Any logged-in user | Archived Skill | Any | Any | Block | `skill_not_published` |
| New user | Deprecated Skill | Active | No | Not discoverable / cannot enable | `skill_not_published` |
| Existing enabled user | Deprecated Skill | Active and entitled | Yes | Allow with warning | None |
| Existing disabled user | Deprecated Skill | Active | No | Cannot re-enable; show unavailable/retired state | `skill_not_published` |
| Kids Session | Non-Kids-Safe Skill | Any | Any | Block before injection | `kids_mode_blocked` |
| Normal Session | Kids Exclusive Skill | Any | Any | Block or hide | `kids_mode_blocked` |

> **DR-67 implementation note:** the
> "Existing enabled user / Deprecated Skill / … / Allow with warning / None" row
> is live only after the runtime use-time entitlement gate passes. Deprecated
> Skills still require `user_enabled_skills.enabled=true` and a current
> `required_plan_snapshot` entitlement.

---

## 7. Kids Safety Requirements

Kids functionality must be treated as a safety-critical path. If Kids Mode is not resourced for P0, it must be disabled by default or released as closed beta.

### 7.1 Hard Requirements

- Relay must resolve `is_kids_session` from authenticated user/session state.
- Client-provided `is_kids_session` in headers or body must be ignored.
- Kids Session can execute only `is_kids_safe=true` Skills.
- Normal Session cannot execute `is_kids_exclusive=true` Skills unless explicitly configured for family mode.
- Kids Skill publish requires Safety Reviewer approval.
- Kids model/provider pool must support approved DPA, no-training, and ZDR/no-retention mode before use.
- Kids request logs must not persist sensitive child input.
- Kids safety block must happen at Relay before any provider execution.
- Safety events must not expose sensitive content.

### 7.2 Kids Publish Rules

| Condition | Required Before Publish |
|---|---|
| `is_kids_safe=true` | Safety Reviewer approval, safe model pool, test in Kids mode |
| `is_kids_exclusive=true` | All Kids Safe requirements plus normal-session visibility restriction |
| Template changed after approval | Approval invalidated; re-review required |
| Safety violation after publish | Skill can be force archived or disabled via feature flag |

---

## 8. Error Codes & Block Reasons

Functional requirements must map blocked states to stable codes. UI text can be localized separately.

| Code | HTTP | Trigger | Charge? |
|---|---:|---|---:|
| `AUTH_REQUIRED` | 401 | Anonymous download attempt, or package runtime call with no/invalid DeepRouter credential | No |
| `SKILL_NOT_FOUND` | 404 | Unknown `skill_id` | No |
| `SKILL_NOT_PUBLISHED` | 403 | Draft, archived, or unavailable deprecated Skill | No |
| `SKILL_NOT_ENABLED` | 403 | User attempts execution without enabling | No |
| `SKILL_PLAN_REQUIRED` | 403 | Plan does not satisfy required plan | No |
| `SKILL_SUBSCRIPTION_INACTIVE` | 403 | Subscription expired or inactive | No |
| `SKILL_QUOTA_EXCEEDED` | 429 | Free quota exceeded | No |
| `SKILL_KIDS_MODE_BLOCKED` | 403 | Kids / Kids Exclusive rule blocks execution | No |
| `SKILL_CONTEXT_TOO_LONG` | 400 | Input cannot fit context safely | No |
| `SKILL_RATE_LIMITED` | 429 | Rate limit exceeded | No |
| `SKILL_TIMEOUT` | 504 | Skill execution timeout | No for no-output timeout; usable partial streaming timeout follows approved settlement |
| `SKILL_SAFETY_VIOLATION` | 200 or 403 | Output replaced or stream aborted for safety | No by default |
| `SKILL_INTERNAL_ERROR` | 500 | Internal execution failure | No |

---

## 9. Event Requirements

### 9.1 Required Events

| Event | When | Priority |
|---|---|---|
| `skill_impression` | Skill card or recommendation shown | P0 |
| `skill_detail_view` | Detail page opened | P0 |
| `skill_enabled` | User enables Skill | P0 |
| `skill_disabled` | User disables Skill | P0 |
| `skill_first_use` | First successful use for user/skill | P0 |
| `skill_used` | Every successful Skill execution | P0 |
| `skill_repeat_use` | Successful non-first execution | P0 |
| `skill_blocked` | Execution blocked by entitlement/status/safety | P0 |
| `skill_timeout_error` | Timeout occurs | P0 |
| `skill_admin_action` | Admin write action | P0 |
| `skill_version_created` | New execution version created | P1 |
| `skill_safety_violation` | Safety issue detected | P0 if Kids enabled |
| `skill_kids_approved` | Kids approval granted | P0 if Kids enabled |

### 9.2 Required Event Properties

| Property | Required | Notes |
|---|---:|---|
| `event_id` | Yes | Unique id |
| `timestamp` | Yes | Server time preferred |
| `user_id` | Yes if logged in | Nullable for anonymous browse and Kids analytics; Relay runtime still uses real user for auth/quota/billing |
| `tenant_id` | Yes if available | Required for execution |
| `session_id` | Yes | Server/session derived |
| `skill_id` | Yes | All Skill events |
| `skill_version_id` | Execution/admin version events | Required for usage/billing |
| `entry_point` | Yes | Must be a valid enum |
| `plan` | Yes if logged in | free/pro/enterprise |
| `persona` | If known | May be coarse in V1 |
| `is_kids_session` | Execution events | Server-derived only |
| `success` | Execution events | Boolean |
| `block_reason` | Blocked events | Uses Section 8 mapping |
| `latency_ms` | Execution events | Gateway latency and total if available |
| `input_tokens` / `output_tokens` | Execution/billing | Estimated or provider actual |

### 9.3 Data Quality Rules

- Events may include `skill_id`/`skill_version_id` (which the published package already exposes); they must not include raw user input, PII, or provider raw payloads.
- Kids sensitive raw input must not be persisted.
- `entry_point` cannot be null for launch paths.
- Failed or blocked events must include `failure_reason` or `block_reason`.
- Event names must be stable and not free-form.
- Kids Session analytics must persist `user_id=NULL` and a non-reversible daily `kids_session_pseudo_id` in `session_id`; billing and runtime controls remain tied to the real authenticated user in restricted systems.

---

## 10. Acceptance Criteria

### 10.1 P0 Launch Acceptance

1. Super Admin can create draft Skill, publish after checklist passes, and publish produces a versioned downloadable package (FR-A19).
2. Published Skill appears in Marketplace with a Download CTA; draft and archived Skills do not.
3. Normal User can view detail, download, remove from My Skills, and see Skill in My Skills.
4. The downloaded package calls the DeepRouter routing API with exactly one `skill_id` per call and surfaces signup on `AUTH_REQUIRED`.
5. Provider credentials and server routing/model-selection logic never ship in the package; the package is inert without DeepRouter.
6. Provider raw payloads, raw user input, PII, and Kids sensitive input are absent from logs, errors, billing, and analytics (`instruction_template` is no longer a redaction target).
7. Execution performs use-time entitlement check against the runner's credential.
8. Expired or insufficient-plan users are blocked with standard error code.
9. Billing attribution includes `skill_id` and `skill_version_id` for successful execution.
10. Blocked and failed calls do not create a charge by default.
11. Core events exist for impression, detail, enable, disable, first use, use, repeat use, and block.
12. Kids Session state is resolved server-side; client override attempts fail.
13. Kids Session cannot execute non-Kids-Safe Skill if Kids Mode is enabled.
14. Admin write actions create audit log entries.
15. Free/free-quota paths enforce the active version `max_input_tokens` snapshot before provider call.
16. User plan allowed models are intersected with Skill model whitelist before routing.
17. Deprecated Skill safety patch versions activate for existing enabled entitled users without reopening enablement.
18. Existing non-Skill API calls remain unchanged.
19. Feature flag can disable Marketplace entry without deleting data.

### 10.2 P1 Acceptance

1. Deprecated Skills are hidden from new users but executable by already-enabled entitled users.
2. Featured, Popular, and New rails work with event tracking.
3. Ops Dashboard supports plan/persona/channel/date filters.
4. Review workflow supports assign, resolve, and escalate.
5. Version history is available to Super Admin.
6. Rate limit, timeout, and context overflow have load/regression tests.
7. Error codes are localized in UI via frontend mapping.

### 10.3 P2 Acceptance

1. Public Skill routing/execution API — **moved to V1 P0** as the execution entry point (was P2).
2. Full sharing/referral workflow (basic propagation is inherent to the package model; formal referral attribution remains P2).
3. Community rating/review.
4. Experiment rollout UI.
5. Creator submission and revenue share.

---

## 11. Open Questions and Default Decisions

Open questions are tracked here only as product clarifications. If an item blocks Sprint planning, it must map to a canonical Sprint 0 decision ID from Section 1.4.

| Decision ID | Question | Recommended Default | Owner |
|---|---|---|---|
| D-03 | Is Kids Mode GA in V1? | Closed beta/off by default unless semantic moderation, approval workflow, monitoring, and Safety sign-off are P0 | Product + Safety + Legal |
| D-01 | What is Free Skill monthly quota? | Freeze in Sprint 0 before entitlement and UX lock-state implementation | Product |
| D-04 | Does partial streaming output ever charge? | User-aborted/safety-aborted/no-usable-output partials do not charge by default; streaming timeout after usable partial output must settle by actual delivered/consumed tokens if streaming is enabled | Product + Finance |
| N/A | Can Operation export analytics? | Aggregate-only export is P1 and permissioned; P0 export disabled by default | Product + Security |
| D-05 | Should model whitelist block or reroute disallowed model? | Reroute only if an approved safe fallback exists; otherwise block | Engineering + Security |
