# Skill Marketplace UX Design Specification

本文档定义 DeepRouter Skill Marketplace V1 的企业级 UX / UI 规格。目标是让 Design、Frontend、Backend、QA、Operations 和独立 Agent 可以按同一套页面、组件、状态和验收口径执行。

本 UX Spec 以 `tasks/01_Functional_Requirements.md` 为功能基准。若两者冲突，以 Functional Requirements 的范围和权限规则为准，UX 文档必须同步修订。

---

## 0. V1 UX Release Baseline

本章节固定 UX 设计默认口径，避免不同设计师、前端工程师或 Agent 按不同假设实现。

| Decision | V1 UX Baseline |
|---|---|
| **P0-A Skill 使用路径（主路径）** | **Skill Run Page**（`/skills/:id/run`）：用户从 Marketplace 启用 Skill，进入 Skill Run Page，填写表单，点击 Run，在 DeepRouter 内直接获得结构化输出。最快路径，无需安装任何外部工具。 |
| **P0-B Skill 安装路径（互操作路径）** | ChatGPT Custom GPT Action：用户下载 `chatgpt-install.json` 或复制 Import URL，安装到自己的 Custom GPT，证明 DeepRouter Skill 可在外部 AI 客户端运行。 |
| P1 外部平台路径 | OpenAI API Tool Schema（复用 ChatGPT Action schema；面向开发者；仅在不影响 MVP 进度时实现） |
| Future / Later 平台路径 | Gemini（所有模式）/ Claude Code / Claude API / MCP / Claude Remote MCP — 不在 MVP 范围内，UI 标注「Coming Later」 |
| 用户身份标识 | 用户界面统一称 **Connection Key**；技术文档 / Advanced 区域保留 API Key 称谓 |
| Playground Skill Picker | 不对用户暴露；Playground 保持通用聊天界面；Skill 执行通过 Skill Run Page（P0-A），不通过 Playground |
| Unauthenticated Public Skill API | 不支持；所有 Skill API 调用需要有效 Connection Key |
| Kids Mode | Closed beta / feature-flagged by default until Product + Safety declare GA |
| Kids UI when flag off | Hide Kids filters and Kids-exclusive browsing entry from normal users |
| Kids UI when flag on | Apply all Kids blocked, Kids Safe, Kids Exclusive states in this spec |
| Recommendation rails | P1; P0 Marketplace uses All Skills list; Featured rail may be enabled only when configured |
| Admin editing on mobile | Read-only admin/ops views on mobile; editing/destructive actions require desktop |
| Operation CSV export | P1 aggregate-only; hidden in P0 unless explicitly enabled |
| Pro Skill enable before upgrade | Not allowed; user must upgrade before enable/use |
| Deprecated Skill discovery | Not shown in Marketplace; shown only in My Skills for already-enabled users |
| Feature flag off | Public navigation hidden; direct routes show feature unavailable state |

---

## 1. UX Principles

| Principle | Requirement |
|---|---|
| Install-First, Not API-First | DeepRouter 是跨平台 Skill Marketplace，不仅是 API 后端。每个 Skill 对终端用户的呈现是"安装到你的 AI 工具"，而不是"调用一个 API endpoint" |
| Plain Language, Technical Optional | 默认 UI 使用用户熟悉的词汇（"ChatGPT install file"、"Connection Key"、"Connect to Claude"）；技术术语（OpenAPI、Bearer、MCP、JSON-RPC）仅出现在 Advanced / Developer 区域 |
| Hosted Execution, Install Artifact Only | UI 提供平台专属安装包（JSON / URL / command / zip）；安装包只含 schema + endpoint，绝不含 instruction_template、Connection Key 或执行逻辑 |
| Use-Time Entitlement | 启用不等于永久可用；UI 必须显示当前执行可用性 |
| Safety First | Kids / policy / entitlement block 必须清晰、克制、不可绕过 |
| Operations Ready | Admin / Ops 页面必须支持排查、审计、筛选和追踪 |
| Clear State Over Clever UI | 所有 locked、expired、deprecated、archived、quota、error 状态必须明确 |
| Data Entry by Default | 所有入口、推荐、CTA 和关键交互必须有埋点位置 |
| Enterprise Calm | 管理端采用密集、清晰、可扫描布局；避免营销式大卡片堆叠 |

---

## 2. Information Architecture

### 2.1 Primary Navigation

| Nav Item | Route Example | Visibility | Purpose |
|---|---|---|---|
| Skills / Marketplace | `/skills` | Anonymous, User, Admin, Ops | Browse and discover Skills |
| My Skills | `/skills/my` | Logged-in users | Manage enabled Skills；显示「Run」CTA |
| **Skill Run Page** | `/skills/:id/run` | Logged-in + enabled users | **P0-A 主执行入口**：填写参数、运行 Skill、查看结构化输出；提供「Connect to ChatGPT」跳转 |
| Playground | `/playground` | Logged-in users | General chat only — no Skill execution for normal users; Admin uses admin_preview endpoint separately |
| Admin Skills | `/admin/skills` | Super Admin | Create and operate official Skills |
| Skill Analytics | `/admin/skill-analytics` or `/ops/skills` | Operation, Product/Growth, Super Admin | Monitor usage and revenue |
| Skill Reviews | `/ops/skill-reviews` | Operation, Super Admin | Review quality, safety, blocked issues |

### 2.2 Role-Based Page Access

| Page | Anonymous | Normal User | Operation | Product/Growth | Safety Reviewer | Support | Super Admin |
|---|---:|---:|---:|---:|---:|---:|---:|
| Marketplace | Public fields | Full user view | Full user view | Full user view | Full user view | Full user view | Full user view |
| Skill Detail | Public fields | Full user view | Full user view | Full user view | Full user view | Full user view | Full user view |
| My Skills | No | Own only | No | No | No | Assisted user read-only | Any user if audited |
| Playground Skill Picker | No | No（用户无此功能） | No | No | No | No | Admin preview only |
| Admin Skill Management | No | No | No | No | No | No | Yes |
| Skill Analytics | No | No | Aggregate view | Aggregate view | Safety subset | Limited diagnostic | Full |
| Skill Reviews | No | No | Yes | Read-only | Safety subset | No | Yes |

### 2.3 Global Navigation Rules

- Anonymous users can browse Marketplace and Skill Detail but all execution/enable CTAs route to login.
- Normal users never see Admin/Ops navigation.
- Operation and Product/Growth do not see `instruction_template` links, previews, exports, or debug views that expose sensitive content.
- Safety Reviewer can access Kids approval surfaces only when assigned or authorized.
- Feature flag off state hides Marketplace navigation for normal users and shows a maintenance/disabled state to internal roles.

---

## 3. Global UX States

Every page that loads Skill data must define these states.

| State | UX Requirement |
|---|---|
| Loading | Use skeleton layout matching final content dimensions; avoid layout shift |
| Empty | Explain why empty and offer the next available action |
| Error | Show friendly message, request id if available, retry action if safe |
| Unauthenticated | Show public content where allowed; protected actions route to login |
| Unauthorized | Hide forbidden actions; direct URL access shows no-access page |
| Feature Flag Off | Hide public entry; direct routes show feature unavailable; internal users see disabled banner with stage |
| Locked | Show reason and appropriate CTA: Upgrade, Renew, Contact Sales |
| Quota Exceeded | Show quota exhausted message, reset time when available, and Product-approved upgrade CTA |
| Deprecated | Show warning for enabled users; hide from new discovery |
| Archived | Show unavailable message; no enable/use CTA |
| Kids Blocked | Show Kids Mode unavailable message; no workaround CTA |
| Rate Limited | Show retry-after time where available |
| Timeout | Offer retry and input simplification guidance |

---

## 4. Page Specs

### 4.1 Marketplace

#### 4.1.1 Goal

Help users discover official Skills and understand whether each Skill is usable now, locked, or unavailable.

#### 4.1.2 Layout

| Area | Requirement |
|---|---|
| Header | Page title, short description, optional feature flag/beta badge |
| Search | Search by public name and description only |
| Filters | Category, plan, status; Kids Safe filter appears only when Kids feature flag is enabled |
| Rails | Featured is optional P0; Popular/New/Recommended Lite are P1 |
| Results Grid/List | Skill Cards with stable dimensions and no layout shift |
| Empty State | Search/filter-specific empty states |

#### 4.1.3 Skill Card Fields

| Field | Required | Notes |
|---|---:|---|
| Icon | Yes | Fallback icon required |
| Name | Yes | Truncate after two lines |
| Category | Yes | Badge or text |
| Short Description | Yes | Two-line max |
| Required Plan | Yes | Free / Pro / Enterprise |
| Availability State | Yes | Available / Locked / Enabled / Deprecated |
| Kids Badge | Conditional | Shown only when Kids feature flag is enabled or user is internal reviewer |
| Usage Signal | P1 | Popular/New/Featured badges |
| Primary CTA | Yes | Determined by CTA table |

#### 4.1.4 Marketplace State Matrix

| Scenario | Card / Page UX | Primary CTA |
|---|---|---|
| Anonymous + Free Skill | Public card, no enabled state | Log in to enable |
| Anonymous + Pro Skill | Public card with Pro badge | Log in to continue |
| Logged-in + Free + not enabled | Available | Enable |
| Logged-in + Free + enabled | Enabled badge | **Run in DeepRouter**（Skill Run Page，primary）/ Use in my ChatGPT（secondary）/ Developer options（advanced，Coming Later 平台标注） |
| Logged-in + Pro + Free user | Locked with Pro badge | Upgrade |
| Logged-in + Pro + Pro user | Available | Enable or Use Skill |
| Subscription expired | Locked with renewal reason | Renew |
| Enterprise Skill + non-enterprise | Enterprise badge | Contact sales |
| Quota exceeded | Locked state with quota message and reset time when available | Upgrade |
| Deprecated + not enabled | Hidden from Marketplace | None |
| Deprecated + enabled | Not in Marketplace; visible in My Skills | Run in DeepRouter（deprecated warning）/ Use in my ChatGPT（secondary） |
| Archived | Hidden from Marketplace | None |
| Kids Session + unsafe Skill | Hidden from discovery; direct access shows Kids blocked state | None |

#### 4.1.5 Marketplace Empty States

| Scenario | Message | Action |
|---|---|---|
| No search results | No Skills match this search. | Clear search |
| No category results | No Skills are available in this category yet. | View all Skills |
| Kids mode filtered all | No Skills are available in Kids Mode for this filter. | Clear filter |
| Feature disabled | Skill Marketplace is not available yet. | None for users; admin can view flag status |
| Load error | Skills could not be loaded. | Retry |

#### 4.1.6 Tracking

- `skill_impression` fires when card becomes visible.
- `skill_detail_view` fires when card opens detail.
- P0 tracking uses existing Skill events with `entry_point=marketplace_card`; if an optional rail is enabled, it uses the matching `featured`, `popular`, `new`, or `recommended` entry point without making the rail itself P0.
- New recommendation-specific events require Analytics approval before implementation.

---

### 4.2 Skill Detail

#### 4.2.1 Goal

Help users understand what the Skill does, what input it needs, what output to expect, and whether they can use it.

#### 4.2.2 Required Sections

| Section | Requirement |
|---|---|
| Header | Name, category, badges, required plan, current availability |
| Value Proposition | Clear user-facing benefit; no internal prompt wording |
| Input Hints | Structured examples and suggested fields |
| Example Input / Output | At least one representative example |
| Pricing / Entitlement | Free/Pro/Enterprise, quota message when quota is enabled |
| Safety & Privacy | Hosted execution statement, AI-generated disclosure, data note |
| Connect to AI tools |「Use in my ChatGPT」secondary button（opens Install Dialog → ChatGPT tab）+ 「Developer options」advanced link（OpenAI API P1；Gemini / Claude Code → Coming Later）; visible only to enabled users; default view shows ChatGPT tab |
| Kids Mode | Kids Safe / Kids Exclusive explanation when Kids feature flag is enabled |
| CTA Bar | Primary and secondary actions based on CTA decision table |
| Related Skills | P1; excludes archived/deprecated |

#### 4.2.3 Detail CTA Decision Table

| User / Skill State | Primary CTA | Secondary CTA | Notes |
|---|---|---|---|
| Anonymous | Log in to enable | Back to Marketplace | Preserve return URL |
| Logged-in + not enabled + allowed | Enable Skill | Back | After enable, show Run CTA and Use in my ChatGPT CTA immediately |
| Enabled + executable | **Run in DeepRouter**（Skill Run Page） | Use in my ChatGPT | Primary: opens `/skills/:id/run`; Secondary: opens Install Dialog — ChatGPT Tab; Advanced / collapsed: Developer options（OpenAI API schema P1；Gemini / Claude Code / MCP → Coming Later） |
| Free user + Pro Skill | Upgrade to Pro | Back | Do not enable automatically unless Product decides |
| Expired subscription | Renew membership | Back | Skill remains in My Skills |
| Enterprise Skill + not entitled | Contact sales | Back | No fake enable state |
| Quota exceeded | Upgrade | Back | Show quota reset if available; may preview Pro value without implying entitlement |
| Deprecated + enabled | Run in DeepRouter（deprecated warning） | Use in my ChatGPT / Disable | Show deprecation notice; warn that Skill may be removed; Run still available for already-enabled users |
| Deprecated + not enabled | Unavailable | Back | No enable CTA |
| Archived | Unavailable | Back | No execution CTA |
| Kids blocked | Not available in Kids Mode | Back | No switch-mode CTA in V1 |

#### 4.2.4 Privacy and Hosted Prompt Copy

Use concise user-facing copy:

```text
This Skill is hosted by DeepRouter. Its execution instructions are not visible or downloadable.
The tool schema (input/output format) is available as a downloadable spec file for installation
into ChatGPT or other AI clients. Generated results are AI-assisted and should be reviewed before use.
```

For China-facing surfaces, include required AI-generated content disclosure as product UI text, not model output.

---

### 4.3 My Skills

#### 4.3.1 Goal

Let users manage enabled Skills and understand which Skills can be executed now.

#### 4.3.2 Layout

| Area | Requirement |
|---|---|
| Header | Title, count of enabled Skills |
| Filters | All, Available, Locked, Deprecated |
| List/Table | Skill, status, required plan, last used, enabled date, actions（Get Tool Spec / Disable）— 按行状态详见 §4.3.3 |
| Empty State | Prompt user to explore Marketplace |

#### 4.3.3 Row States

| State | UX | Actions |
|---|---|---|
| Enabled + executable | Normal row | **Run in DeepRouter**（primary）, Use in my ChatGPT（secondary）, Developer options（advanced / Coming Later 平台）, Disable |
| Enabled + plan locked | Locked badge and reason | Upgrade/Renew, Disable |
| Enabled + quota exceeded | Quota badge with reset time if available | Upgrade, Disable |
| Deprecated enabled | Warning badge | Run in DeepRouter（deprecated warning）, Use in my ChatGPT（secondary）, Disable |
| Archived | Unavailable badge | Remove/Disable |
| Kids blocked | Kids unavailable badge | Disable |

#### 4.3.4 Empty State

```text
No Skills enabled yet.
Browse the Marketplace, enable a Skill, and run it directly here in DeepRouter — or connect it to ChatGPT to use it in your existing workflow.
```

Primary action: `Explore Skills`.

---

### 4.4 Skill Run Page（P0-A — 主执行入口）

**路由：`/skills/:id/run`**

#### Goal

P0-A 是 V1 最快的 Skill 使用路径。用户在 DeepRouter 内直接执行 Skill，无需配置 ChatGPT、MCP 或任何外部工具。适合所有用户群体（包括非技术用户）。

#### Page Layout

```
┌─ Skill Run Page ──────────────────────────────────────────────┐
│  [Skill name]  [Short description]  [Category badge]          │
│  Status: ✅ Enabled                                           │
├───────────────────────────────────────────────────────────────┤
│  INPUT                                                        │
│  [按 tool_input_schema 动态渲染的表单]                         │
│  Contract Text*   [大文本框]                                  │
│  Review Focus     [下拉: general / tenant_risks / ip_ownership]│
│                                                               │
│                              [Run ▶]                         │
├───────────────────────────────────────────────────────────────┤
│  RESULT                                                       │
│  Summary: 合约整体风险中等，存在 2 处高风险条款。              │
│  Risks:                                                       │
│    🔴 High  提前终止条款  — 建议延长通知期至 30 天            │
│    🟡 Med   SLA 条款     — 缺少补偿机制                       │
│                                                               │
│  run_id: run_abc123  |  time: 4.2s  |  cost: $0.09          │
├───────────────────────────────────────────────────────────────┤
│  💡 Also use this Skill in ChatGPT →  [Connect to ChatGPT]  │
└───────────────────────────────────────────────────────────────┘
```

#### Input Form Rules

| 字段类型 | `tool_input_schema` 对应 | UI 组件 |
|---|---|---|
| 短文本 | `type: string`，无 `format` | 单行 text input |
| 长文本 | `type: string`，`format: textarea` 或 `maxLength > 500` | 多行 textarea |
| 枚举 | `type: string`，有 `enum` 数组 | Select 下拉 |
| 数字 | `type: number` / `integer` | 数字 input |
| 布尔 | `type: boolean` | Toggle / Checkbox |
| `required` 字段 | `required` 数组中的字段 | 标注 * 且强制验证 |

#### Result Display Rules

| 输出类型 | 渲染方式 |
|---|---|
| `type: string` | 文本展示，支持 Markdown |
| `type: object` | 展开式 key-value 面板；嵌套对象可折叠 |
| `type: array` | 列表展示；每项可展开 |
| `severity: high/medium/low` | 彩色徽章（🔴🟡🟢） |

**永不展示：** `instruction_template`、provider 原始响应、内部 `skill_version_id`

#### States

| 状态 | UI 行为 |
|---|---|
| 未登录 | 重定向登录页，登录后返回 |
| 已登录但未 Enable | 显示 Enable CTA；不显示输入表单 |
| 已 Enable，表单空 | 显示输入表单；Run 按钮灰色（必填未填） |
| 执行中 | Run 按钮 loading；显示进度提示 |
| 执行成功 | 展示格式化结果 + 元数据；Run 恢复可用 |
| Quota 超限 | 显示升级 CTA；不显示结果区 |
| Safety 拦截 | 显示安全提示；不暴露拦截细节 |
| 执行超时 | 显示「执行超时，请稍后重试」；不扣费 |
| Skill deprecated | 输入表单可用，顶部显示「此 Skill 已废弃」警告 |

#### Navigation to P0-B

Skill Run Page 底部固定显示：
> **💡 Use this Skill in ChatGPT** → [Connect to ChatGPT]（跳转至 Install Dialog → ChatGPT Tab）

> 注：~~Playground Skill Picker~~ 不复活。Playground 保持通用聊天界面。P0-A 的执行入口是独立 Skill Run Page，不经过 Playground。

---

### 4.4a Install & Download Flow — P0-B ChatGPT + P1/P2 其他平台

#### Goal

用户启用 Skill 后，根据自己使用的 AI 平台，获取对应的安装包或 connect 指引。

#### Install Dialog — 平台选择 Tabs

用户点击「Get Tool Spec / Install」后弹出对话框，顶部显示 **平台 Tabs**，每个 Tab 展示该平台的安装方式：

---

**Tab 1：ChatGPT — Custom GPT Action**

> ⚠️ 重要：这是安装到某个 **Custom GPT** 的 Actions，不是全局 ChatGPT。用户需要先创建或编辑一个 Custom GPT 才能安装。

| 步骤 | 内容 |
|---|---|
| 1 | 打开 ChatGPT → 点头像 → My GPTs → Create GPT（或 Edit 已有 GPT） |
| 2 | 进入 Configure → 拉到底 → Actions → Create new action |
| 3 | **Import from URL（推荐）**：复制下方 Import URL，粘贴到 Import schema 输入框，OpenAI 自动拉取最新 schema，Skill schema 更新后无需重新操作 |
| 4 | 备选：[⬇ Download openai-action.json] → 上传文件（schema 变更需手动重新下载） |
| 5 | Authentication → API Key → Bearer → 填入 DeepRouter **Connection Key** |

认证说明（用户可见文案使用非技术语言）：
- MVP：Authentication → API Key → Bearer（此为 ChatGPT 内部选项名称，用户填入的是 DeepRouter Connection Key）。ChatGPT 加密保存该 Key，仅用于请求 DeepRouter；Connection Key 不写入安装文件，不暴露给模型 prompt。
- 正式版（P1）：Authentication → OAuth → Connect DeepRouter Account，用户授权后 ChatGPT 自动携带 token，无需手动填 Connection Key。

[📋 Copy Import URL]　　[⬇ Download openai-action.json]

---

**Tab 2：OpenAI API（开发者）— P1**

> P1 — 复用 ChatGPT Action schema；仅在不影响 MVP 进度时实现。

| 内容 | 说明 |
|---|---|
| [⬇ Download openai-tool.json] | 标准 OpenAI function calling schema，`additionalProperties: false` |
| 集成方式 | 应用后端：①传 tools 给模型 → ②收 tool_calls → ③后端调 DeepRouter execute → ④传 tool result 回模型 → ⑤模型生成最终答案 |
| 认证 | 后端发送 `Authorization: Bearer <DEEPROUTER_API_KEY>`；Key 不写入下载的 JSON 文件，由开发者后端安全保存 |

---

**Tab 3：Gemini — Coming Later**

> ⏳ **Coming Later** — Gemini 集成正在规划中。发布后此处将显示 Gemini Spark Skill Package（基础引导版）和 Gemini API 开发者连接方式。

---

**Tab 4：Claude — Coming Later**

> ⏳ **Coming Later** — Claude / Claude API / Claude Remote MCP Connector 集成正在规划中。

---

**Tab 5：Claude Code — Coming Later**

> ⏳ **Coming Later** — Claude Code MCP 安装引导正在规划中。计划提供一键 MCP install 命令。

---

**通用区域（所有 Tab）：**

| 区域 | 内容 |
|---|---|
| Connection Key | 显示用户当前 DeepRouter Connection Key（脱敏），含「Copy」和「Generate New Key」快捷入口；标签统一显示 **Connection Key**（Advanced 折叠项中显示技术名称 API Key / Bearer token） |
| Execute Endpoint | 仅 Advanced 区域展示；一键复制 `https://deeprouter.ai/v1/skills/execute/<skill_id>` |
| 安全说明 | "Your Connection Key is not included in the downloaded install files. You paste it separately into your AI client during setup. DeepRouter uses it to identify your account, verify your Skill access, and track usage." |

#### States

| 状态 | UI |
|---|---|
| Skill 已启用 | 「Connect this Skill to your AI」为主 CTA；所有 Tab 可用 |
| Skill 未启用 | 先完成 Enable 流程，完成后自动打开 Install Dialog |
| Skill deprecated | 安装可用，所有 Tab 顶部显示「此 Skill 已废弃，可能随时停止服务」警告 |
| Connection Key 未生成 | Install Dialog 内提示生成 Connection Key，不阻断下载/复制 URL |

---

### 4.4b Primary Install UX by Platform

每个平台的安装路径遵循同一产品心智：

> **Enable → Download/Copy install artifact → Import/Add to AI client → Authenticate with Connection Key → Use naturally**

用户不需要理解 API、schema 或 MCP 协议细节。DeepRouter 处理所有服务端逻辑。

---

#### A. ChatGPT — Connect to Custom GPT Action

**适用用户**：ChatGPT 普通用户（非开发者）

> ⚠️ 这是安装到某个 **Custom GPT** 的 Actions，不是全局 ChatGPT 对话。用户需要先创建或编辑一个 Custom GPT。

**用户流程：**

| 步骤 | 用户操作 | 界面文案（非技术） |
|---|---|---|
| 1 | 在 DeepRouter Marketplace 启用 Skill | 点击「Enable Skill」|
| 2 | 点击「Use in my ChatGPT」| 弹出 Install Dialog |
| 3 | 复制 Import URL（推荐） 或 下载安装文件 | [📋 Copy ChatGPT Import URL] 或 [⬇ Download ChatGPT install file] |
| 4 | 打开 ChatGPT → My GPTs → Create GPT（或 Edit 已有 GPT） | — |
| 5 | Configure → Actions → Create new action | — |
| 6 | 粘贴 Import URL 或上传安装文件 | ChatGPT 自动读取 Skill 配置 |
| 7 | Authentication → API Key → Bearer → 粘贴 Connection Key | [Copy Connection Key] 按钮在 Install Dialog 下方 |
| 8 | 点击 Save GPT | — |
| 9 | 在 Custom GPT 对话中自然使用 | "帮我审查这份合约" → Custom GPT 自动调用 DeepRouter |

**Clarify（产品原则）：**
- 安装文件（`chatgpt-install.json`）不含 Connection Key。
- 安装文件不含隐藏 prompt 或 instruction template。
- 文件只告诉 ChatGPT"如何调用 DeepRouter"，真正的 Skill 逻辑在 DeepRouter 服务端运行。
- Import URL 方式优先：Skill schema 更新后用户无需重新操作。
- 未来（P1）：支持 OAuth → 用户点击「Connect DeepRouter Account」完成授权，无需手动填 Connection Key。

---

#### A-Demo: ChatGPT Custom GPT Demo Flow（完整演示步骤）

> **目标：** 演示 DeepRouter Skill 可在外部 AI 客户端（ChatGPT）运行，同时执行逻辑（instruction_template、workflow、billing）始终保留在 DeepRouter 服务端。

**为什么还需要 ChatGPT install，如果 DeepRouter 原生路径已经更快？**

> **Native DeepRouter is the fastest way to run a Skill.** ChatGPT install is for users who want to keep working inside their existing ChatGPT workflow, connect the Skill to a Custom GPT they already use for other purposes, or demonstrate that DeepRouter Skills can run inside external AI clients while the protected Skill Runtime remains server-side.

**演示步骤（12步完整流程）：**

| 步骤 | 用户操作 | 界面文案 |
|---|---|---|
| 1 | 在 DeepRouter Marketplace 启用 Skill | 点击「Enable Skill」 |
| 2 | 点击「Use in my ChatGPT」| 弹出 Install Dialog，ChatGPT Tab |
| 3 | 下载 ChatGPT install file 或复制 Import URL | [⬇ Download ChatGPT install file]　[📋 Copy Import URL] |
| 4 | 打开 ChatGPT → 点头像 → My GPTs | — |
| 5 | 点击「Create GPT」或编辑已有 Custom GPT | — |
| 6 | 进入 Configure → 拉到底 → Actions → Create new action | — |
| 7 | 粘贴 Import URL（推荐）或上传安装文件 | ChatGPT 自动读取 Skill 配置 |
| 8 | Authentication → API Key → Bearer | — |
| 9 | 粘贴 DeepRouter Connection Key | [Copy Connection Key] 在 Install Dialog 底部 |
| 10 | 点击 Save GPT | — |
| 11 | 在 Custom GPT 中发送测试提示：**"Please review this short contract and identify the top 3 risks."** | Custom GPT 自动调用 DeepRouter Skill tool |
| 12 | 查看 DeepRouter My Skills 面板确认连接成功 | 显示「Connection successful. Last request received just now.」 |

**ChatGPT Install Troubleshooting Checklist：**

如果 Custom GPT 没有调用 DeepRouter，按以下清单检查：

| 检查项 | 说明 |
|---|---|
| ✅ 是否已下载或导入 ChatGPT install file / Import URL？ | Install Dialog → [Download ChatGPT install file] 或 [Copy Import URL] |
| ✅ 是否在 Custom GPT 中创建了 Action（不是普通 Custom GPT 指令）？ | Custom GPT Builder → Configure → Actions → Create new action |
| ✅ 是否设置了 Authentication？ | Action 配置页面 → Authentication 区域 |
| ✅ 是否选择了 API Key / Bearer？ | Authentication type = API Key；Auth type = Bearer |
| ✅ 是否粘贴了 Connection Key？ | 从 Install Dialog 底部复制 Connection Key 后粘贴 |
| ✅ 是否保存了 Custom GPT？ | 点击 Save GPT，确认保存成功 |
| ✅ 是否问了 Custom GPT 与 Skill 相关的问题？ | 发送与 Skill 功能匹配的提示词，例如「review this contract」|
| ✅ DeepRouter My Skills 是否显示了最近请求记录？ | My Skills → 该 Skill → 查看 Last activity；若 10 分钟内无记录，重复以上步骤 |

**Moat 说明（演示时可使用）：**

Install artifacts 只包含公开 schema 和 endpoint 元数据，从不包含：
- `instruction_template`（隐藏提示词）
- 私有 prompt 逻辑
- 风险评分规则
- 内部评估逻辑
- 模型路由逻辑
- 配额逻辑
- 计费逻辑
- 用户密钥

Protected server-side Skill Runtime（始终保留在 DeepRouter 服务端）包含：
- `instruction_template`（隐藏提示词）
- Agent workflow
- 模型/Provider 路由
- 结构化输出验证
- Prompt injection 防护
- 使用日志
- 成本追踪
- 计费归因
- 版本控制
- 审计轨迹

---

#### B. Gemini — Future / Later

> ⏳ **Future / Later — Gemini 集成不在 MVP 范围内，不得阻塞 ChatGPT P0 演示路径。**
>
> **Platform Honesty Note：** DeepRouter can provide a Gemini downloadable Skill package in future, but current Gemini Spark Skills are not the same as ChatGPT Actions. The package can help Gemini follow public workflow instructions, but protected DeepRouter Runtime execution requires Gemini API function calling or MCP. ChatGPT remains the confirmed P0 external-client demo.

下方设计规格供后续 Sprint 参考，MVP 不实现：

---

**Mode 1 — Gemini Spark Skill Package（P1，非技术用户，instruction-only）**

适用：使用 Gemini Spark Skills 的非技术用户。

> ⚠️ **限制说明（必须在 UI 中展示）：** 此模式是 instruction/context 型 Skill，不等同于 ChatGPT Actions。Gemini Spark Skills 不支持对外部 API 的 HTTP 调用（除非 Google 未来开放 External Actions）。DeepRouter 的计费、配额、hidden instruction_template 等保护机制在此模式下不适用。安装包只含公开的使用说明。

**用户流程：**

| 步骤 | 用户操作 | 界面文案 |
|---|---|---|
| 1 | 在 DeepRouter Marketplace 启用 Skill | 点击「Enable Skill」|
| 2 | 点击「Use in Gemini」→ 选择「Gemini Spark Skill（Basic）」| 弹出 Install Dialog，Gemini Tab，Spark 子 Tab |
| 3 | 下载 `gemini-spark-skill.zip` | [⬇ Download Gemini Skill Package] |
| 4 | 打开 Gemini Spark Skills | 在 Gemini 界面进入 Spark Skills 管理页 |
| 5 | 上传 zip 包或 SKILL.md 文件 | — |
| 6 | 保存 Skill | — |
| 7 | 在 Gemini Spark 中自然使用 | 基于包内公开引导指令工作 |

**Gemini Spark Skill Package 安全规则：**
- 包内只含公开的使用说明和 workflow 引导（`SKILL.md`）。
- 严禁包含 DeepRouter `instruction_template`、私有 prompt 逻辑、风险评分规则或任何专有 Skill 逻辑。
- 此模式不触发 DeepRouter Relay 执行，不记入 DeepRouter billing / quota / audit。
- UI 必须明确标注：「基础使用说明版本 — 完整 AI 执行保护需通过 ChatGPT 或 Gemini API」。

---

**Mode 2 — Gemini API / MCP Runtime Connector（P2，开发者，完整保护执行）**

适用：开发者在自己的 app 或 MCP 兼容环境中使用 Gemini API。

> 此模式触发真正的 DeepRouter 保护 Runtime 执行，适合需要 billing / quota / hidden prompt 保护的开发者集成。

**开发者流程：**

| 步骤 | 用户操作 |
|---|---|
| 1 | 在 Marketplace 启用 Skill |
| 2 | 点击「Use in Gemini」→ 选择「Gemini API / Developer」子 Tab |
| 3 | 下载 `gemini-function.json`（Gemini functionDeclarations 格式）或复制 MCP config |
| 4 | 在后端代码导入 function declaration；Connection Key 存为环境变量（不放入代码） |
| 5 | Gemini 模型根据用户输入发出 function call |
| 6 | 开发者后端调用 `POST /v1/skills/execute/{skill_id}`，携带 Connection Key |
| 7 | DeepRouter 执行保护 Skill Runtime（Auth → Entitlement → Quota → instruction_template 注入 → 执行 → 输出验证） |
| 8 | 返回结构化结果；Gemini 整合为用户可读答案 |

**Clarify（产品原则）：**
- Connection Key 不写入 `gemini-function.json`；由开发者后端安全存储。
- 此模式是 P2，不是 P0 演示路径。
- 如果开发者使用 MCP 兼容环境（Gemini CLI / agent 框架），可复制 `mcp-config.json` 替代 function declaration 路径。

---

**Mode 3 — Consumer Gemini External Action（P3 / Future）**

> 消费级 Gemini（chat.google.com）目前不支持导入外部 API Action。若 Google 未来开放 External Actions，将新增 `gemini-action-connector` 适配器，但不在 V1 P0–P2 交付范围内。UI 中此路径标记为 **Future / pending platform support**，不显示下载按钮。

---

#### C. Claude — Future / Later

> ⏳ **Future / Later — Claude Remote MCP Connector 不在 MVP 范围内，不得阻塞 ChatGPT P0 演示路径。**

计划路径：用户复制 `https://deeprouter.ai/mcp`，添加为 Claude connector，使用 Connection Key / OAuth 认证，Claude 自动发现已 enabled Skills 并作为 MCP tool 调用。详细 UX 设计留待后续 Sprint 确认。

---

#### D. Claude Code — Future / Later

> ⏳ **Future / Later — Claude Code MCP Install 不在 MVP 范围内，不得阻塞 ChatGPT P0 演示路径。**

计划路径：用户运行 `claude mcp add --transport http deeprouter https://deeprouter.ai/mcp --header "Authorization: Bearer <CONNECTION_KEY>"` 接入 DeepRouter。详细 UX 设计留待后续 Sprint 确认。

---

### 4.4c Install Artifacts

每个平台生成的安装包定义如下：

| 平台 | Artifact | 文件 / 内容 | 优先级 |
|---|---|---|---|
| **ChatGPT Custom GPT** | ChatGPT install file | `chatgpt-install.json`（OpenAPI schema + endpoint + auth scheme） | **P0** |
| **ChatGPT Custom GPT** | ChatGPT Import URL | `https://deeprouter.ai/v1/skills/<id>/adapters/openai-action`（直接 import） | **P0** |
| **ChatGPT Custom GPT** | Visual setup guide | 步骤截图 / 动图 | **P0** |
| **ChatGPT Custom GPT** | Sample test prompt | 一个测试对话示例 | **P0** |
| OpenAI API | OpenAI API tool schema | `openai-tool.json`（function calling，含 `additionalProperties: false`） | P1 |
| OpenAI API | Python 代码示例 | 3 轮对话 + tool call 示例 | P1 |
| OpenAI API | TypeScript 代码示例 | 同上 | P1 |
| Gemini Spark（非技术用户） | Gemini Spark Skill Package | `gemini-spark-skill.zip`（SKILL.md + 公开使用说明）⚠️ 非等同于 ChatGPT Actions；不触发 DeepRouter 保护 Runtime | **Future / Later** |
| Gemini API（开发者） | Gemini function declaration | `gemini-function.json`（functionDeclarations 格式） | **Future / Later** |
| Gemini API（开发者） | Python 代码示例 | function call → DeepRouter execute → functionResponse 示例 | **Future / Later** |
| Gemini CLI / Agent | MCP config | `mcp-config.json`（MCP remote server 配置） | **Future / Later** |
| Gemini 消费级 External Action | 暂不支持 | — | **Future / Later / pending platform support** |
| Claude | Remote MCP Connector URL | `https://deeprouter.ai/mcp` | **Future / Later** |
| Claude | Connector setup guide | Claude Settings → Connections 步骤说明 | **Future / Later** |
| Claude Code | MCP install command | `claude mcp add --transport http ...` | **Future / Later** |
| Claude Code | Skill Package | `claude-code-skill.zip`（含 SKILL.md + examples） | **Future / Later** |

**Artifact 安全规则（适用所有 artifact）：**
- 安装包不含 instruction template。
- 安装包不含 Connection Key（用户专属配置文件除外，且须明确警告）。
- 安装包不含执行逻辑或服务端代码。
- 安装包只告诉 AI 客户端"如何调用 DeepRouter"，DeepRouter 服务端执行所有 Skill 逻辑。

---

### 4.4d Non-Technical UX Rules

#### 默认 UI 术语规范

| 技术术语（禁用于默认 UI） | 用户友好标签（默认 UI 使用） |
|---|---|
| API Key | Connection Key |
| Bearer token | Connection Key |
| OpenAPI schema | ChatGPT install file |
| MCP server | Connector（或"Connect to Claude"） |
| MCP transport | — （不展示给非技术用户） |
| JSON-RPC | — （不展示给非技术用户） |
| Remote MCP server URL | Connector URL |
| tool spec | install file / install package |
| `instruction_template` | — （永不对用户展示） |
| POST /v1/skills/execute | — （仅 Advanced 区域展示） |

#### 分层展示规则

| 层级 | 内容 | 适用用户 |
|---|---|---|
| 默认（Default） | 步骤引导 / 复制按钮 / 下载按钮 / Connection Key 复制 / 测试连接 | 所有用户 |
| Advanced | Execute endpoint URL / Bearer header 格式 / JSON schema 预览 / SDK 示例代码 | 开发者 / 技术用户 |
| Developer Tab | OpenAI API / Gemini API / Claude API 开发者集成说明 | API 开发者 |

#### 每个安装流程必须包含

| 元素 | 说明 |
|---|---|
| Step-by-step guide | 明确的顺序步骤，含截图或动图（P0：文字步骤；P1：视觉引导） |
| Copy button | 每个需要粘贴的内容旁有 [Copy] 按钮（URL / Key / command） |
| Test connection instructions | 告诉用户如何验证安装成功（见 §4.4e） |
| Troubleshooting checklist | 常见失败原因 + 检查项（见 §4.4e） |

---

### 4.4e Connection Test UX

用户完成安装后，DeepRouter 提供以下方式验证连接是否成功：

#### ChatGPT

**测试流程：**
1. 在已安装该 Skill Action 的 Custom GPT 里发送测试 prompt（Install Dialog 内提供示例 prompt）。
2. DeepRouter 用户 Dashboard → My Skills → 该 Skill → 查看「Last request received」时间戳。
3. 如果时间戳更新，表示安装成功。

**如果没有收到请求，显示以下检查清单：**

```
Did you import the install file or URL into Custom GPT Actions?
Did you set Authentication to API Key?
Did you select Bearer as the token type?
Did you paste your DeepRouter Connection Key?
Did you click Save GPT before testing?
Is the Skill still enabled in your DeepRouter account?
```

#### Claude / Claude Code

**测试流程：**
1. 发送测试 prompt。
2. DeepRouter Dashboard → My Skills → 该 Skill → 查看「Last MCP tool call」时间戳。

**如果失败，显示以下检查清单：**

```
Is the MCP Connector URL correct? (https://deeprouter.ai/mcp)
Is the Authorization header present? (--header "Authorization: Bearer ...")
Is the Skill enabled in your DeepRouter account?
Is your Connection Key valid and not revoked?
Is your quota available?
```

#### Gemini API 开发者

**测试流程：**
- Install Dialog 提供测试脚本（Python / TypeScript），调用 DeepRouter execute endpoint。
- Dashboard 显示「Last API call」时间戳。

#### Gemini CLI / MCP Agent

**测试流程：**
- 发送测试 prompt 并检查 Dashboard「Last MCP tool call」。
- 如失败，检查 MCP config 认证字段是否正确。

#### Dashboard 统一 My Skills 状态面板

每个 enabled Skill 显示：

| 字段 | 说明 |
|---|---|
| Status | Enabled / Disabled / Deprecated |
| Last activity | 最近一次成功调用时间 |
| Last platform | 最近调用来自哪个 entry point |
| This month usage | 本月调用次数 / 消耗 tokens |
| Connection status | ✅ Connected（有近期成功调用）/ ⚠️ No recent activity / ❌ Last call failed |

---

### 4.4f Unified Execution Contract

无论用户通过哪个平台安装，所有 Skill 执行最终调用同一后端运行时：

```
POST /v1/skills/execute/{skill_id}
```

或通过 MCP：

```
tools/call → DeepRouter Skill Runtime → POST /v1/skills/execute/{skill_id}
```

**DeepRouter 服务端执行链（用户不可见，所有平台通用）：**

```
① 接收请求
② 验证 Connection Key / OAuth token
③ 识别用户身份（从 token 解析，不接受 request body 中的 user_id）
④ 验证该 Skill 是否 enabled（该用户账号）
⑤ 检查 quota 和 entitlement
⑥ 注入隐藏 instruction template（服务端，用户不可见）
⑦ 路由到 LLM provider 执行
⑧ 验证结构化输出格式
⑨ 返回结构化结果（不含 instruction template）
⑩ 记录 usage、cost、entry_point
⑪ billing 归因
```

**客户端只发送三件事：**
```
skill_id         → URL path（/v1/skills/execute/{skill_id}）
user input args  → request body
token            → Authorization: Bearer <Connection Key>
```

DeepRouter 只接受以上三件事。request body 中的 skill_id、user_id、tenant_id 字段一律忽略。

---

### 4.5 Upgrade / Renew / Contact Sales Flow

| Trigger | User Message | Primary Action |
|---|---|---|
| `SKILL_PLAN_REQUIRED` for Pro | This Skill requires Pro. | Upgrade |
| `SKILL_PLAN_REQUIRED` for Enterprise | This Skill requires Enterprise access. | Contact sales |
| `SKILL_SUBSCRIPTION_INACTIVE` | Your membership is inactive. | Renew |
| `SKILL_QUOTA_EXCEEDED` | You have used your free Skill quota this month. | Upgrade |
| `SKILL_KIDS_MODE_BLOCKED` | This Skill is not available in Kids Mode. | Back |

Rules:
- Do not imply payment if the action only records interest or opens contact-sales.
- Return path must preserve the Skill Detail or My Skills context.
- Blocked requests must not show success-like toast messages.

---

### 4.6 Error Code to UX State Mapping

All frontend lock, blocked, and error states must be driven by stable backend error codes. Backend free-form `message` can be displayed only after frontend maps the code to an approved UX state.

| Error Code | UX State | Primary Surface | Primary Action |
|---|---|---|---|
| `AUTH_REQUIRED` | Unauthenticated | Marketplace, Detail, Playground | Log in |
| `SKILL_NOT_FOUND` | Not found | Detail, Playground | Back to Marketplace |
| `SKILL_NOT_PUBLISHED` | Unavailable | Detail, My Skills, Playground | Back or Remove |
| `SKILL_NOT_ENABLED` | Not enabled | Detail, Playground | Enable Skill |
| `SKILL_PLAN_REQUIRED` | Plan locked | Card, Detail, Picker | Upgrade or Contact sales |
| `SKILL_SUBSCRIPTION_INACTIVE` | Subscription expired | My Skills, Detail, Picker | Renew |
| `SKILL_QUOTA_EXCEEDED` | Quota exceeded | Detail, My Skills, Picker | Upgrade |
| `SKILL_KIDS_MODE_BLOCKED` | Kids blocked | Card, Detail, Picker | Back |
| `SKILL_CONTEXT_TOO_LONG` | Input too long | Playground | Shorten input |
| `SKILL_RATE_LIMITED` | Rate limited | Playground | Wait / Retry after |
| `SKILL_TIMEOUT` | Timeout | Playground | Retry |
| `SKILL_SAFETY_VIOLATION` | Safety blocked/replaced | Playground | Back / Retry safely |
| `SKILL_INTERNAL_ERROR` | System error | Any | Retry / Contact support |

---

### 4.7 Admin Skill Management

#### 4.7.1 Goal

Allow Super Admin to create, test, publish, deprecate, and archive official Skills without leaking internal instructions.

#### 4.7.2 Admin List

| Column | Requirement |
|---|---|
| Skill name | Includes icon/category |
| Status | draft/published/deprecated/archived |
| Required plan | free/pro/enterprise |
| Kids status | none/pending/approved/rejected |
| Featured | flag/rank |
| Version | active version id |
| Last updated | timestamp and actor |
| Actions | edit, preview, publish, deprecate, archive, audit |

#### 4.7.3 Skill Editor Sections

| Section | Fields / Controls |
|---|---|
| Metadata | name, short description, description, category, tags, icon |
| User Guidance | input hints, example inputs, example outputs |
| Entitlement | required plan, monetization type, markup, free quota |
| Execution | instruction template, output schema, model whitelist, timeout, max_input_tokens (required for Free Skills) |
| Safety | Kids Safe, Kids Exclusive, safety approval status |
| Promotion | featured flag, featured rank |
| Preview | test input, run preview, output, latency, error |
| Version History | versions, created by, created at, active flag |
| Audit Log | admin writes, changed fields, reason |

#### 4.7.4 Publish Checklist

Publish button is disabled until all required checks pass:

- Required metadata complete.
- At least one example input and output.
- Required plan and monetization fields set.
- `max_input_tokens` set when `required_plan='free'`, `monetization_type='free'`, or `free_quota_per_month` is configured. The field must appear in the Editor and show a validation error if blank for these configurations.
- Model whitelist set.
- Preview test completed successfully.
- No visible prompt leakage in preview.
- Kids approval complete if Kids flags are set.
- Reason captured for publish.

#### 4.7.5 Destructive Actions

| Action | UX Requirement |
|---|---|
| Archive | Confirmation dialog, reason required, warns execution will stop |
| Deprecate | Confirmation dialog, reason required, explains existing enabled users can continue |
| Change required plan | Confirmation, warns existing users may be blocked at next use |
| Edit template | Creates new version; show version-change notice |
| Emergency archive | Super Admin only, reason required, audit event required |

---

### 4.8 Admin / Ops Analytics

#### 4.8.1 Goal

Let Operations and Product identify adoption, activation, blocked usage, safety risk, and revenue contribution.

#### 4.8.2 Dashboard Sections

| Section | P0/P1 | Requirement |
|---|---|---|
| Overview metrics | P0 | WASU, enables, first uses, successful uses, blocked rate |
| Funnel | P0 | impression → detail → enable → first use |
| Skill table | P0 | usage, activation, blocked, revenue |
| Revenue | P0 | by Skill and plan |
| Retention | P1 | D1/D7/D30 |
| Persona / channel filters | P1 | Hidden until data exists |
| Safety events | P0 for Kids beta/internal users | violations, blocked, approval pending |

#### 4.8.3 Table UX

- Tables must support sorting, filtering, pagination, and date range.
- Large tables use sticky headers on desktop.
- Export button is hidden unless role permits export.
- Empty data states must explain whether there is no data or tracking failed.

---

### 4.9 Skill Observation / Review

#### 4.9.1 Goal

Support internal review workflows for quality, low activation, safety signals, and operational issues.

#### 4.9.2 Components

| Component | Requirement |
|---|---|
| Review Queue | Filters for review_needed, low_repeat_use, high_one_time_rate, low_activation, high_block_rate, safety_issue |
| Review Detail | Skill summary, metrics, notes, history, owner |
| Actions | assign, resolve, escalate, mark review needed |
| Private Notes | Internal only; never visible to normal users |
| Safety Escalation | Highlight Kids/safety review items |

#### 4.9.3 Review States

| State | UX |
|---|---|
| Open | Needs owner/action |
| Assigned | Shows owner and due date |
| Escalated | High-priority badge |
| Resolved | Shows resolution and timestamp |
| Reopened | Shows prior resolution |

---

## 5. Component Specs

### 5.1 Core Components

| Component | Variants / States |
|---|---|
| `SkillCard` | default, enabled, locked, deprecated, kids-safe, loading |
| `PlanBadge` | Free, Pro, Enterprise |
| `KidsBadge` | Kids Safe, Kids Exclusive, Pending, Blocked |
| `LockState` | plan_required, subscription_inactive, quota_exceeded, kids_blocked |
| `SkillCTA` | view, enable, use, upgrade, renew, contact_sales, unavailable |
| `SkillPicker` | empty, selected, locked, error, loading |
| `EmptyState` | search, category, my-skills, analytics, feature-off |
| `ErrorBanner` | retryable, non-retryable, request-id |
| `AdminSkillForm` | draft, dirty, validation-error, saving, saved |
| `PublishChecklist` | incomplete, ready, blocked, published |
| `MetricCard` | loading, empty, normal, warning |
| `DataTable` | loading, empty, sorted, filtered, paginated |

### 5.2 Visual State Rules

- Locked or unavailable states must not rely on color alone.
- Warning states use icon + text + accessible label.
- Buttons must have stable width where possible to avoid layout shift.
- Loading skeletons must reserve final content height.
- Long Skill names and descriptions must truncate predictably.

---

## 6. Accessibility Requirements

| Requirement | Acceptance |
|---|---|
| Keyboard navigation | All CTAs, filters, tabs, picker items, dialogs reachable by keyboard |
| Focus order | Follows visual order; focus returns to trigger after dialog closes |
| Focus trap | Required for modals and destructive confirmation dialogs |
| Escape behavior | Esc closes dropdowns/dialogs unless action is in progress |
| Screen reader labels | Skill cards announce name, plan, status, locked reason |
| ARIA for picker | Picker uses `aria-expanded`, `aria-controls`, and selected state |
| Async updates | Use `aria-live` for enable success, error, locked state changes |
| Contrast | Text and meaningful UI meet WCAG 2.1 AA contrast |
| Color independence | Badges and errors include text/icons, not color alone |
| Reduced motion | Respect reduced-motion preference for transitions |
| Touch targets | Minimum 44px touch target on mobile |

---

## 7. Responsive Behavior

### 7.1 Breakpoints

| Breakpoint | Behavior |
|---|---|
| `< 640px` | Single-column Marketplace, compact filters, bottom-sheet picker |
| `640-1024px` | Two-column card grid where space allows |
| `> 1024px` | Multi-column grid, persistent filter/sidebar where useful |

### 7.2 Mobile Rules

- Marketplace filters collapse into a filter drawer.
- Skill Card shows name, plan, status, CTA; description can truncate more aggressively.
- Skill Detail CTA bar should be sticky at bottom only if it does not obscure content.
- Playground Picker opens as a bottom sheet on small screens.
- Admin and analytics pages are read-only on mobile in V1. Editing, publishing, archiving, and destructive actions require desktop.

### 7.3 Dashboard Tables

- On mobile, show summary cards first and allow horizontal scroll for detailed tables.
- Hide non-critical columns behind column settings or detail drill-down.
- Export actions are desktop-only in V1.

---

## 8. Copy & i18n

### 8.1 Language Rules

- User-facing copy must be localizable.
- Error and lock copy must come from stable error codes, not backend free-form text.
- Avoid exposing implementation terms like `instruction_template`, `entitlement`, or `monetization_type` to normal users.
- Admin UI may use technical terms where appropriate.

### 8.2 Required Copy Patterns

| State | Example Copy |
|---|---|
| Hosted prompt | This Skill is hosted by DeepRouter. Its internal instructions are not visible or downloadable. |
| AI generated disclosure | Generated by AI. Review before use. |
| Pro locked | This Skill requires Pro. |
| Enterprise locked | This Skill requires Enterprise access. |
| Expired | Your membership is inactive. Renew to use this Skill. |
| Kids blocked | This Skill is not available in Kids Mode. |
| Archived | This Skill is no longer available. |
| Deprecated | This Skill will be retired soon. You can continue using it for now. |
| Quota exceeded | You have used your free Skill quota this month. |

Quota-exceeded copy may add a reset date/time and a Pro upgrade CTA only when the backend returns the relevant lock-state fields. It must not promise access until the entitlement check succeeds.

---

## 9. Analytics Tracking Points

| UI Surface | Event / Property Requirement |
|---|---|
| Marketplace Card | `skill_impression`, `entry_point=marketplace_card` |
| Marketplace CTA | `skill_detail_view` or `skill_enabled` with source |
| Skill Detail CTA | Existing events only: `skill_enabled`, `skill_blocked`; upgrade clicks use billing/growth event only if already defined |
| My Skills Tool Spec Download | `skill_spec_downloaded` with `entry_point=my_skills`（普通用户从 My Skills 下载 tool spec；实际执行在外部 AI 客户端，触发 `entry_point=external_ai_client`）|
| Tool Spec Download | `skill_spec_downloaded` with `format`（openapi/mcp）和 `platform` hint（P1）|
| External AI Client Execution | `skill_used` / `skill_blocked` with `entry_point=external_ai_client`（P0）|
| Locked CTA | `skill_blocked` and upgrade/contact-sales click |
| Admin Publish | `skill_admin_action` |
| Review Action | P1; requires Analytics event approval |
| Recommendation Rail | Use `entry_point=featured/popular/new/recommended` in existing Skill events |

No tracking payload may include `instruction_template` or Kids sensitive raw input.

---

## 10. UX Acceptance Criteria

### 10.1 P0 UX Acceptance

1. Anonymous users can browse public Marketplace and Skill Detail, but cannot enable or execute.
2. Logged-in users can enable, disable, and view My Skills.
3. Marketplace cards show plan, availability, and correct CTA for Free/Pro/Enterprise states.
4. Skill Detail shows examples, hosted prompt copy, AI disclosure, and correct CTA.
5. Playground Picker supports zero or one selected Skill and shows lock/error states.
6. Archived Skills have no enable/use CTA.
7. Deprecated enabled Skills appear only in My Skills and show warning; execution CTA appears only when backend returns executable state.
8. Kids UI is hidden when Kids feature flag is off; Kids blocked state is visible and non-bypassable when Kids feature flag is on.
9. Admin can complete publish checklist, preview Skill, and publish only when required checks pass.
10. Destructive Admin actions require confirmation and reason.
11. Operation can access aggregate dashboard and review queue without seeing prompts.
12. All lock/error states map from stable error codes.
13. Core flows meet keyboard navigation and screen reader requirements.
14. Mobile Marketplace and Skill Detail remain usable at `< 640px`.
15. No user-facing page exposes `instruction_template` or prompt internals.

### 10.2 P1 UX Acceptance

1. Featured/Popular/New rails have tracking and correct exclusion rules.
2. Ops Dashboard supports filters, sorting, pagination, and export permissions.
3. Review workflow supports assign, resolve, escalate, and reopened states.
4. Retention and persona filters are available if data exists.
5. Error and lock copy is localizable.

---

## 11. UX Decision Register

These defaults are locked for V1 UX unless Product, Design, and Engineering explicitly approve a revision.

| ID | Decision | V1 Default | Owner |
|---|---|---|---|
| UX-D-1 | Kids Mode release mode | Closed beta / feature-flagged by default | Product + Safety |
| UX-D-2 | Admin editing on mobile | Read-only mobile; editing requires desktop | Product + Design |
| UX-D-3 | Pro Skill enable before upgrade | Not allowed; show Upgrade first | Product |
| UX-D-4 | Deprecated enabled Skills in Marketplace | Not shown; My Skills only | Product |
| UX-D-5 | Operation CSV export | Aggregate only, P1; hidden in P0 | Security + Product |
