# PRD — 新用户「目标导向」落地引导（welcome 屏当枢纽，串起整条黄金路径）

> **Status**: 📝 Draft v0.2 · 待评审
> **Author**: Lightman + Claude
> **Date**: 2026-06-20
> **Owner**: DeepRouter Frontend
> **Parent / 必读前置**:
> - [`docs/onboarding-v2-prd.md`](../onboarding-v2-prd.md)（§2 核心洞察、§4 黄金路径、§7.4 充值、§7.5 调用密钥页、§7.6 自检）
> - [`docs/tasks/onboarding-prd.md`](onboarding-prd.md)（全旅程 funnel、北极星指标）
> - [`docs/tasks/casual-journey-readiness-prd.md`](casual-journey-readiness-prd.md)（register→use→success 缺口清单）
> - [`docs/tasks/casual-ux-prd.md`](casual-ux-prd.md) · [`docs/tasks/key-setup-guide-prd.md`](key-setup-guide-prd.md)
> - `deeprouter/CLAUDE.md` §0「术语禁令 + 黄金路径」、`AGENTS.md` Rule 9（DESIGN.md 强制）
> **改动面**: 主要 `web/default/src/features/welcome/`（+ i18n / persona host 协同）。**不动后端、不重写 `/wallet`、`/keys`、`/sign-up` 的内部 UI；只负责把用户准确导到这些真实落点。**

---

## 0. 一句话

DeepRouter 是**「账号 + 钱包」工具**（不是 chat），给非技术用户一张"能付费用上 Claude/GPT 的算力凭证（API 密钥）"。
新用户唯一目标 = **开好账号、拿到一把能用的密钥**。
本 PRD：让落地引导**回答每个新用户开口就问的两个字——「在哪、怎么」**，沿黄金路径
**注册 → 充值 → 拿密钥 → 确认能用** 每一步给出**真实落点 + 具体动作**，welcome 屏是把这四步串起来的枢纽。

---

## 1. 背景：这次 PRD 的触发点

种子用户（2026-06-20，刚注册）连环质问，全部合理，逐条记账：

1. "我第一次注册，首先该看到的是**告诉我干什么**，而不是被盘问 / 丢进一个会报错的 playground。"
2. "**怎么创建、在哪创建**，说了吗？"
3. "**然后怎么充值**，说了吗？"

→ 结论：旧稿（v0.1）只设计了"注册之后那一屏怎么展示已有密钥"，**完全没回答"在哪/怎么"这种地理性问题**，更把充值（黄金路径第二步）漏掉甚至说"往后放"。本 PRD v0.2 纠正：**引导的本质是告诉一个不认识这个 App 的人，每一步去哪个页面、点哪个按钮。**

---

## 2. 真实黄金路径地图（已逐个在代码里核对落点，禁止编造）

> 这张表是本 PRD 的地基。每个"在哪"都是 `web/default` 里**真实存在的路由**，每个"怎么"都是**真实存在的按钮/控件**。引导文案里出现的任何落点都必须能点到（`CLAUDE.md` §0 Rule 3）。

| # | 步骤 | 在哪（真实路由） | 怎么做（真实 UI） | 代码依据 |
|---|---|---|---|---|
| 1 | **注册** | 落地页任意「免费开始 / Sign up」CTA → **`/sign-up`** | 填邮箱+密码+验证码 → 提交后**后端自动：建账号 + 送 ¥1 试用额度（`QuotaForNewUser=500_000`）+ 建一把默认密钥** | `features/home/.../hero.tsx`、`hero-buttons.tsx`、`cta.tsx` 均 `Link to='/sign-up'`；`controller.Register` |
| 2 | **落地引导（本 PRD 主体）** | 注册后自动进 **`/welcome`** | 看到「账号已就绪 + 额度 + 密钥」三个结果，并被指向第 3/4/5 步 | `features/welcome/index.tsx`；`persona-picker-host.tsx` 强制未完成者回 `/welcome` |
| 3 | **充值** | **`/wallet`**（`/console/topup` 自动重定向到它） | 选金额（有预设档 `presetAmounts`）→ 选支付方式（信用卡 Airwallex / Waffo / WaffoPancake）→ 付款；或用**兑换码 redeem** | `routes/_authenticated/wallet/index.tsx`、`features/wallet/index.tsx`（`topupAmount`/`useTopupInfo`/`useRedemption`/`processAirwallexPayment`…） |
| 4 | **拿/管理密钥** | **`/keys`** | 右上「**Create API Key**」抽屉 → **Simple 模式**（选用途，自动路由到合适模型，推荐）→ 生成后复制。注册已自动给一把，**新用户第一把通常不用自己建** | `features/keys/components/api-keys-mutate-drawer.tsx`、`api-keys-tutorial-card.tsx`、`api.ts` |
| 5 | **确认能用（自检）** | 自检（onboarding-v2 §7.6） | 跑一次自检，证明"钱真的变成了 AI 算力"——这才是黄金路径终点，**不是给代码片段** | onboarding-v2-prd.md §7.6（自检页就绪状态见 §9 决策 1） |

**用完密钥去哪**：拿到密钥后用户**离开 DeepRouter**，把密钥粘到自己已经在用的 AI 工具（Cherry Studio / opencode / Cursor …）的设置里。`/onboarding/{slug}` 已有 6 个客户端接入教程页（onboarding-prd.md）。

---

## 3. AS-IS：`/welcome` 现状（已逐行核对）

文件：`web/default/src/features/welcome/index.tsx`

已具备（**不要重做**）：注册自动建密钥 + ¥1 额度；注册响应一次性塞进 `sessionStorage['dr_welcome_handoff']`（`{default_token, trial_quota, display_name, next}`，**读一次即焚**）；welcome 顶部已有 banner 展示「额度 + 默认密钥（CopyCard, shown once）」；两步 `persona → brand` → Finish 跳 `handoff.next || preset.defaultRoute || '/wallet'`。

现状第一屏**四个问题**（= 要改的）：

1. **视觉重心错位**：H1 是 `Step 1 of 2 — How do you plan to use DeepRouter?`（persona 提问），结果（密钥/额度）只是上方低权重 banner → 用户感知"被盘问"，不是"拿到东西了，去用"。
2. **缺"在哪/怎么"**：没有"下一步去哪个页面、点什么"。充值（`/wallet`）、拿/管理密钥（`/keys`）、自检——**一个真实落点链接都没给**。
3. **违反术语禁令**（`CLAUDE.md` §0）：`Your default API key (shown once)`、`call model: "deeprouter"`、`AI provider` 等术语裸奔。
4. **下一步指向充值却无引导**：Finish 默认 `navigate('/wallet')`，但用户根本不知道那是干嘛、为什么要去。

---

## 4. 目标 & 非目标

### 4.1 目标
- **G1**｜welcome 第一屏 < 3 秒让用户明白"账号好了、密钥就绪、额度到账"，casual 语言、零术语。
- **G2**｜welcome 屏给出**沿黄金路径的明确下一步**，每个动作都是**带真实落点的具体指引**（去 `/wallet` 充值、去 `/keys` 管理密钥、跑自检），而不是抽象的"3 步"。
- **G3**｜persona/brand 降级为可跳过的次要项，不再是 H1。
- **G4**｜全程遵守 `CLAUDE.md` §0 术语禁令 & `DESIGN.md`（AGENTS Rule 9）。

### 4.2 北极星 / 指标
- 主指标：**注册 → 首次成功调用 的 P50**（继承 `onboarding-prd.md` §1.2，目标 < 5 min）。
- 漏斗：welcome → 点击任一黄金路径下一步 CTA 的转化率 ≥ 70%；welcome → 完成首次充值率；welcome → 首次成功调用率。
- 护栏：welcome 跳出率（关页/敲别的 URL）不升高。

### 4.3 非目标
见扉页改动面 + §3.3 精神：不重写 `/wallet`、`/keys`、`/sign-up` 内部 UI；不做 chat；不在本 PRD 修 playground 403 / 重定向漏洞（§8）；不删 persona/brand 采集；不把 cURL/Base URL/SDK 提到 casual 默认视图。

> ⚠️ **修正 v0.1 的错误**：曾主张"充值往后放、默认先去用"。这与黄金路径「注册 → **充值** → 拿密钥 → 自检」冲突——充值是第二步，不是可选项。v0.2：welcome 必须把充值作为一条**有真实落点（`/wallet`）的明确引导**呈现。默认动作排序见 §9 决策 1/4。

---

## 5. TO-BE：welcome 第一屏规格

### 5.1 信息层级（casual 默认，移动端优先）

```
┌─────────────────────────────────────────────┐
│  ✅ 欢迎，{name}！你的账号已经开好了。           │  ← H1 = 结果，不是提问
│                                               │
│  🎁 已送你 ¥1 试用额度（≈100 次对话）           │  ← 结果卡①
│  🔑 你的密钥已就绪  [复制]  [在密钥页查看 →]     │  ← 结果卡②（无 handoff 时退化见 §6）
│                                               │
│  接下来要用，照这条做：                          │  ← 黄金路径，每步“在哪/怎么”
│   ① 复制上面的密钥                              │
│   ② 粘到你正在用的 AI 工具的设置里               │     （找带 “API Key” 的输入框，粘进去保存）
│   ③ 额度用完了？去钱包充值  [去充值 →]           │     → /wallet（真实落点）
│                                               │
│  ┌────────────────────┐  ┌──────────────────┐ │
│  │ ▶ 确认能用（自检）    │  │ 我自己逛逛 / 跳过   │ │  ← 主 CTA（自检/退化 /keys）+ 次按钮
│  └────────────────────┘  └──────────────────┘ │
│                                               │
│  ▸ 你主要拿它做什么？（可选，帮我们调界面）        │  ← persona 折叠在底部，次要
│    [日常使用] [写代码] [团队]                    │
└─────────────────────────────────────────────┘
```

### 5.2 每个动作的落点 & 文案（casual 默认 → 术语版仅开发者模式）

| 动作 | 真实落点 | casual 文案（禁术语；术语仅括号一次，§7.4 允许） | 开发者模式增量 |
|---|---|---|---|
| 复制密钥 | （内存中的 `handoff.default_token`） | 「你的密钥（API Key）  [复制]」复制后 `已复制 ✓` | + Base URL、`deeprouter-auto` 模型名 |
| 看/管理密钥 | **`/keys`** | 「在密钥页查看 →」 | + 新建密钥 Simple/Advanced 说明 |
| 粘到工具 | `/onboarding/{slug}` 教程页（可选深链） | 「粘到你正在用的 AI 工具的设置里，找带 API Key 的输入框，粘进去保存」 | + cURL / Python 片段 |
| **充值** | **`/wallet`** | 「额度用完了？去钱包充值 →」（点了到 `/wallet` 选金额+支付/兑换码） | 同 |
| 确认能用 | 自检（§7.6）/ 退化 `/keys` | 「确认能用」 | 同 |
| 选用途 | （写 `user.setting.persona`） | 「你主要拿它做什么？（可选）」 | 同 |

> 展示给用户的值（密钥原文、模型名 `deeprouter-auto`、Base URL）**必须对活网关验证过真能用**（Rule 3，曾因 `deeprouter` vs `deeprouter-auto`、`:17231` vs `:3300` 翻车）。本屏只透传 `handoff` 原值，不自造。

### 5.3 行为
- 第一屏**不要求**先选 persona；主 CTA 永远可点。
- persona/brand 仍在本屏采集（底部折叠 + 原 step=brand 可留作可选第二屏），**跳过不阻塞**；跳过/完成走原 `handleFinish`（保留 `dr_welcome_just_finished` 防重定向竞态），persona 跳过仍落 `casual`（与现状一致）。
- "去充值"「在密钥页查看」「确认能用」都是普通路由跳转，不在 welcome 内嵌支付/建密钥逻辑（避免重写那些页面）。

---

## 6. 边界情况（必须覆盖）

| 场景 | 表现 |
|---|---|
| `handoff` 缺失（OAuth / 刷新过 / 隐私模式 / 自己手敲 /welcome） | 密钥卡退化「你的密钥已就绪 → [在密钥页查看]」(`/keys`)；额度卡退化「在钱包查看」(`/wallet`)。**不报错、不空白**，其余照常。 |
| 密钥"读一次即焚" | 明文仅在内存这一次可见，复制按钮基于已读入 state，刷新后不再展示明文（符合安全设计）。文案提示"建议现在复制保存"。 |
| 自检页未上线 | 主 CTA 退化「在密钥页查看」`/keys`，**绝不指死链**（Rule 3）。 |
| 充值未配通某支付渠道 | "去充值"仍跳 `/wallet`，由 `/wallet` 自己处理可用渠道，本 PRD 不判断。 |
| 未登录 | 沿用现状重定向 `/sign-in`。 |
| 老用户重做 picker（无 handoff） | 结果卡退化/收起，不对老用户假装"刚注册"。 |

---

## 7. 设计约束
- 遵守 `docs/DESIGN.md` §0–5（§6–9 历史忽略），用 `design-system` skill 核对组件/间距/色板。
- 复用现有 `WelcomeCard`/`CopyCard`/`Section`/`ChoiceCard`/`Stepper`/`Button`，不新造视觉语言。
- 移动端优先（casual 大量在手机）：结果卡 1 列堆叠，CTA 全宽。

---

## 8. 验收标准（DoD）
1. 新用户进 `/welcome`，**第一眼 H1 是结果/账号就绪**，不是 persona 提问。✅
2. casual 默认视图 grep 校验**零裸术语**（无 `API`/`token`/`Base URL`/`SDK`/`网关`/`模型路由`/第三方品牌名作标题）。✅
3. welcome 给出**沿黄金路径的具体下一步**，含**充值落点 `/wallet`** 与**密钥落点 `/keys`**，链接均真能点到。✅
4. persona/brand 可跳过、不阻塞；画像数据仍落库。✅
5. §6 六个边界场景均不报错/不空白/不死链。✅
6. i18n：en（base）+ zh 落齐，`bun run i18n:sync` 通过。✅
7. 与 `DESIGN.md` 一致；移动端不破版。✅

---

## 9. 开放决策（需 Lightman 拍板）
1. **主 CTA 默认终点**：自检页（推荐，黄金路径终点）还是直接 `/keys`？取决于自检页是否就绪。
2. **充值在 welcome 的呈现强度**：仅一条"额度用完再充"的轻提示（推荐，先让用户用上 ¥1 免费额度尝到甜头）/ 还是显著主动引导先充值？——黄金路径把充值放第二步，但 ¥1 免费额度足够首跑，二者如何平衡请定。
3. **persona 去留**：折叠第一屏底部（推荐）/ 可跳过第二屏 / 后移到 dashboard？
4. **brand（品牌偏好）**：casual 不懂"路由到哪个品牌"——对 casual 直接隐藏、只在开发者模式出现？

---

## 10. 关联问题（不在本 PRD 范围，已登记）
- **P0 · playground 漏网 + 重定向漏洞**：未完成引导的新用户能摸到（classic）`/playground` 吃 403 `No permission to access this group`（`middleware/distributor.go` playground 分组校验 + `persona-picker-host.tsx` 守卫未覆盖该路由）。→ 单独 task：classic playground 下线/重定向 + 无 key 时显示引导态而非 403。
- **P1 · 后端 persona 种子**：确认 `controller.Register` 是否给新账号种 `persona:'unset'`，否则守卫失效。
