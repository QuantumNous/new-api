# DeepRouter — Business Logic (Single Source of Truth)

> Status: v1 synthesis · 2026-06-08 · author: Claude (from Lightman's PRDs)
> This doc consolidates the business/commercial logic that is **actually
> written** across the DeepRouter PRDs into one place, because the source docs
> disagree with each other and work kept drifting. Every claim is cited as
> `file:§section`. Anything not written anywhere is marked **UNDEFINED** — it is
> a decision for Lightman, not something to invent.
>
> Source docs (all under `docs/`): `PRD.md` (engineering PRD v0.1),
> `onboarding-v2-prd.md`, `compliance-prd.md`, `tasks/api-key-simple-advanced-prd.md`,
> `tasks/casual-ux-prd.md`, `tasks/onboarding-prd.md`, `tenant-onboarding.md`,
> `data-model.md`, **`DeepRouter-BP.md`** (融资商业计划书 — imported into this repo
> 2026-06-08 from `jr-academy-ai/deeprouter-brand/`, the canonical source; keep in
> sync), **`DeepRouter-PRD-brand.md`** (brand/product PRD). Still missing:
> `minors-compliance.md`.

---

## 0. DECISIONS NEEDED (resolve these first — they change everything downstream)

These are genuine forks where the docs contradict each other or are silent.
Until Lightman answers, do not "pick one" in code.

**D1 — The product model: there are THREE conflicting framings in the docs.**
This is the big one — the root cause of repeated customer-facing failures.
- **(a) Internal B2B gateway** — `PRD.md:§3`: DeepRouter has **"没有'终端用户'"**;
  tenants are single-digit companies (Airbotix Kids, JR Academy), manually onboarded.
- **(b) Public dev+enterprise SaaS ("OpenRouter of China")** — `DeepRouter-BP.md`
  (the FUNDRAISING thesis): "面向中文开发者与企业的大模型 API 统一接入网关",
  revenue = token 差价 3–5x + 会员订阅 + 企业版 + 私有部署 (`BP §1, §4`). Audience
  is **developers + enterprises**.
- **(c) Non-technical casual C-end** — `onboarding-v2-prd.md` + `casual-ux-prd.md`:
  律师/医生/学生 who never write code, paste key into their AI tool (`§3`).
- These are not reconciled anywhere. (a) sells to companies, (b) sells to developers,
  (c) sells to non-technical individuals — each implies a different `/keys`,
  onboarding, pricing, and Setup guide. The fundraising deck is selling (b); the
  console work has been building (c); the engineering PRD assumes (a).
- Most likely intended phasing (NOT confirmed): V0 internal (a) for Airbotix Kids +
  JR Academy → C-end beachhead via JR's own students (c) → public dev/enterprise
  SaaS (b) as the fundraise scale story. **Confirm the V0/V1 target before any
  more customer-facing work** — it decides who `/keys` + Setup guide serve.

**D2 — Virtual model name.** PRD alias is `deeprouter` / `deeprouter-coding`
(`api-key-simple-advanced-prd.md:§3.2`), but **only `deeprouter-auto` actually
routes today** — `deeprouter` returns HTTP 503 (verified 2026-06-08 against the
live gateway; see `middleware/smart_router.go:18` `VirtualModelAuto="deeprouter-auto"`).
PRD §9 lists "deeprouter vs dr vs auto" as still open. Pick the canonical
user-facing name and make code + guide + docs agree.

**D3 — Gross-margin floor (now 3 numbers).** `PRD.md:§7.2` ≥40%; `PRD.md:§10.3`
≥30% (target 40%+); `DeepRouter-BP.md:§4.1` target **70–80%** (token spread 3–5x).
The BP (investor-facing) is far higher than the engineering PRD. Pick the real floor.

**D4 — Audit-log retention.** `PRD.md` mandates 90 days (`§4.1 F11`); 
`compliance-prd.md:§5.3` requires ≥ 6 months (反恐法). 90d < 6mo. Reconcile.

**D5 — `kids_mode` (bool) vs `policy_profile='kid-safe'` (enum).** Both encode
"this tenant is kids" (`PRD.md:§2.4` vs `§5.2`). Define the single source of truth.

**D6 — Price-tier storage.** `model_pricing` table (`api-key-simple-advanced-prd.md:§3.5`)
vs `price_tier` column on `model` (`§5.4`). Neither exists in `data-model.md` yet.

**D7 — Subscriptions (partially resolved by BP).** The four subscription tables
in `data-model.md` map to `DeepRouter-BP.md:§4.1/§4.3` **会员订阅 ¥29 / ¥99 / ¥299**
(lower token 倍率 + higher RPM + priority support). Confirm these tiers are V0/V1
scope (the BP is the fundraise plan, not necessarily the build plan).

**D8 — Top-up / payment flow & providers.** `DeepRouter-BP.md:§3.1/§4.3` says
recharge via **人民币 / Stripe**, 完全按量、无最低消费、首次充值返赠. The deposit
UX screens + the specific CN channel (支付宝/微信) are still **UNDEFINED in docs**.

**D9 — PRC compliance vs SG hosting.** Deployment is Singapore (`PRD.md:D-DR1`),
but compliance is framed around PRC regulators (网信办/工信部/央行/等保).
`compliance-prd.md:§1` flags this as unresolved pending legal opinion.

**D10 — Persona default + casual landing — ✅ RESOLVED 2026-06-13** (per
Lightman "全部完成"). Was: persona default + casual landing contradicted the
"non-technical user" posture. Found + fixed 2026-06-13 auditing the
register→use journey in `web/default`:
- **Legacy/fallback persona = `dev`** (`features/profile/lib/persona-presets.ts:104`
  `LEGACY_USER_PERSONA='dev'`). Any user whose `setting` JSON lacks `persona` or
  fails to parse resolves to **developer** UI: lands on `/keys`, Create defaults to
  **advanced** mode, and the casual onboarding aids **do not render** — the
  `ApiKeysTutorialCard` is hard-gated to `persona==='casual'`
  (`features/keys/components/api-keys-tutorial-card.tsx:77`). So a non-technical
  user who skips/closes the persona picker, or any pre-existing account, gets the
  full developer surface with zero "what do I do now" guidance. If the V0 audience
  is non-technical (D1-c), the safe default is `casual`, not `dev`.
- **Casual landing route = `/playground`** (in-browser chat) (`persona-presets.ts:84`),
  which contradicts the hard red line **"不做 chat 是红线"** (`onboarding-v2-prd.md
  §2 insight #1`, restated in `CLAUDE.md §0`). Either the red line holds (casual
  should land on `/keys` + self-check, per `onboarding-v2-prd.md §7`) or Playground
  is an intentional casual on-ramp and the red line needs rewording. Pick one.
- **Resolution (2026-06-13):** D10a → `LEGACY_USER_PERSONA = 'casual'`
  (`persona-presets.ts`); D10b → casual `defaultRoute = '/keys'` (not
  `/playground`), honoring the red line. Fallback/legacy users now get the
  guided casual surface (tutorial card + self-check). Trivially reversible if
  the V0 audience turns out NOT to be non-technical (still pending **D1**, which
  is a strategy call, not a code change). New accounts unaffected (picker prompts
  on the 'unset' sentinel).

---

## 1. What DeepRouter is

> "DeepRouter 是一个 OpenAI 兼容的多租户 LLM 网关，为多个产品/公司提供统一的多模型
> 接入、按租户隔离的策略与计费，以及对中文模型供应商的一等公民支持。" — `PRD.md:§1.2`

- Independent product (Pre-seed track) — `PRD.md:line 14`. Build-once-leverage-twice
  across Lightman's two companies — `PRD.md:§1.1`.
- Fork of `QuantumNous/new-api` (Go, AGPL v3); NewAPI covers ~70% of V0, the
  remaining 30% (multi-tenant policy + cross-company billing callback + kid-safe
  layer) is DeepRouter's own value — `PRD.md:§2.3–2.4`.
- Two-layer routing (the mental model): **L1 model routing** = `smart-router`
  sidecar (prompt → model name); **L2 channel routing** = `deeprouter`
  (model name → upstream API key). See `../CLAUDE.md` "Two-layer routing model".

## 2. Who it's for

**Tenants (B2B, the unit of "user" in PRD.md:§3)** — single-digit, manually onboarded:

| Tenant | Owner | Use | Safety | Billing | Status |
|---|---|---|---|---|---|
| `airbotix-kids` | Airbotix | Kids OpenCode + 低龄创作平台 | kid-safe 极严 | Airbotix Stars 扣减 webhook | P0, Week 6 |
| `jr-academy` | JR Academy | 中文 AI 学习 / Bootcamp / SigmaQ | 成人/教育合规 | JR 自有计费 (DeepRouter 仅 metering) | P1, Week 12 |
| `external-x` | 第三方 EdTech | SaaS 形态验证 | 中等 | 月度 invoice | V2 |

— `PRD.md:§3.1, §3.2`. (`external-x` is effectively V2 despite the "V0/V1" section title.)

**C-end casual persona (the `/keys` / onboarding / pricing surface)** — per the
onboarding/casual track (see D1):
> 非技术付费用户 — 律师/医生/设计师/老师/学生/创作者。买完密钥就走，贴到自己已经在
> 用的 AI 工具里。不写代码、不看 SDK、不调 Base URL。 — `onboarding-v2-prd.md:§3`,
> `tasks/casual-ux-prd.md:§1.2`

Share by estimate — `onboarding-v2-prd.md:§3`: 个人专业用户 40% (¥100–500/mo,
关心信任); 创作者+学生 50% (¥5–50/mo, 关心价格透明+移动端); 种子用户 10%.

## 3. Business model / monetization

- **Open-source + hosted SaaS + enterprise (SLA / 私有部署).** Moat = hosted
  service + cross-border链路 + 合规闭环 + 品牌信任, not source lockup — `PRD.md:§2.4, §11`.
- **Per-tenant billing (DeepRouter → tenant), via webhook** — `PRD.md:§7.1`:
  - `airbotix-kids`: per-request POST → Airbotix `/internal/deeprouter/billing` → Stars 扣减.
  - `jr-academy`: per-request POST → JR metering → JR settles its own billing.
  - `external-x` (V2+): accumulate → monthly invoice + Stripe.
- **Internal cost basis** = real provider token cost (USD); tenant billed per its
  config. "Platform 永远只看 Stars，不暴露真实模型成本给消费端" — `PRD.md:§7.1, §7.2.1`.
- **Margins**: per-Star margin target ≥ 40% (`PRD.md:§7.2`); overall token-resale
  gross ≥ 30% target 40%+ (`PRD.md:§10.3` — see D3); provider real cost ≤ 60% of
  Airbotix revenue; infra ≤ $300/mo V0 — `PRD.md:§10.3`.
- **C-end / developer SaaS economics** (`DeepRouter-BP.md`, the fundraise thesis):
  - Main revenue = **token spread**, markup 3–5x, target margin 70–80% (`BP §4.1`).
  - **Membership** ¥29 / ¥99 / ¥299 (lower 倍率 + higher RPM + priority) (`BP §4.3`).
  - **Enterprise** ¥10K–¥100K+/mo (private deploy, SLA, CS) (`BP §4.1`).
  - Unit economics (assumed, pre-real-data): 个人 ARPU ¥50/mo, margin 75%, CAC ¥30,
    回本 <1 mo, LTV/CAC ~12x (`BP §4.2`).
  - Fundraise: Pre-seed ≤ ¥1,000,000, 18-mo runway (60% team) (`BP §8`).

## 4. Pricing logic (what the user sees)

— `tasks/api-key-simple-advanced-prd.md:§3.4–3.5`:
- **Unit = per 1K tokens** (not 1M; 1K is friendlier for CN casual users).
- **Primary display = 体感字符串** (admin-configured, never algorithmically
  estimated), price number is small-print secondary. Examples: Chat "约 ¥1 聊 100
  句"; Coding "约 ¥1 改 50 段代码"; Image "约 ¥10 生成 20 张"; etc.
- **Per-purpose cards** (chat/coding/image/video/voice/all); per-model detail
  (input/output/cached) lives on a separate `/pricing` page.
- API: `GET /api/pricing/purpose-summary` — `§5.3`.
- **Auto (purpose=all) price cap — 4 tiers** (`§3.5`):
  - 💰 经济档 ¥0.001–0.02/1K (绝不上 Opus/o1)
  - 🎯 标准档 ¥0.001–0.10/1K — **default**
  - 🚀 高级档 ¥0.001–0.30/1K (含 Opus, GPT-4o)
  - 👑 顶配档 无上限 (含 o1, Opus, Gemini Ultra; 需 confirm dialog)
  - No silent upgrade: 档位内无可用模型则返回 error, 不偷偷升档. Stored on key as
    `simple_price_tier` (仅 purpose=all 有效).

## 5. Product surfaces & golden path

**Three surfaces** — keep them separate (root cause of past UX failures = mixing them):
1. **Casual console (default)** — the C-end user. 钱包/密钥/自检/帮助. **Jargon ban**
   (`onboarding-v2-prd.md:§7.4`): never show API / token / Base URL / 模型路由 / 网关
   / SDK / 第三方客户端品牌. 倍率 Badge is the #1 thing to hide (`api-key-…:§3.3`).
2. **Developer mode (toggle)** — Base URL, code snippets (curl/Python/Node), model
   IDs, multi-key, IP limits, cross-group retry — `api-key-simple-advanced-prd.md:§1.1, §4.3`.
3. **Operator/admin (Super Admin)** — channels, tenant onboarding, ratios, quotas,
   audit — `PRD.md:§3.3, §6.4`.

**Golden path = 2 min, zero support** — `onboarding-v2-prd.md:§4`:
注册 → 充值 → 拿密钥 → **自检 (确认能用)**. The key page's real final step is the
**self-check (自检)** proving "我的钱变成了 AI 算力" (`§7.6`), NOT a code snippet.
"密钥怎么用" canonical answer (`§7.5`): "粘贴到你正在用的 AI 工具的设置里，找带
'API Key' 的输入框，粘进去保存" → then self-check.

## 6. Routing & virtual models

- **L1 (smart-router)**: prompt + tenant → model name + fallback chain. Virtual
  model `deeprouter-auto` triggers it (`middleware/smart_router.go:18`). Graceful
  degradation: if smart-router unreachable, fall back to a default model, stay up.
- **L2 (deeprouter)**: model name → channel via priority-tier + weighted-random
  (`model/channel_cache.go:GetRandomSatisfiedChannel`).
- **purpose × brand → target model** alias map (`api-key-simple-advanced-prd.md:§5.1`,
  `setting/alias_setting/`): a Simple key bound to a purpose sends a virtual name;
  the gateway resolves it to a concrete model. (See D2 on the canonical name.)

## 7. Tenant policy / content safety

- Per-tenant `policy_profile` ∈ {kid-safe, adult, passthrough} + `kids_mode` bool
  (`model/user.go`; `internal/policy/`, `internal/kids/`). kid-safe enforces model
  whitelist, metadata stripping, OpenAI ZDR (store:false), child-safe system prompt
  — `PRD.md:§2.4, §5.2, §6.4`; see D5 on the bool-vs-enum overlap.

## 8. Quota / limits / billing webhook

- Balance = `users.quota` (atomic counter, USD-internal). Per-key quota optional,
  defaults to account balance — `data-model.md`, `api-key-…:§3.1`.
- Limits user-facing only in Developer/Advanced: per-key quota, expiry, model
  limits, IP/subnet, cross-group retry. Tenant RPM/TPM/monthly caps are
  operator-only — `api-key-…:§3.1`, `PRD.md:§3.3, §6.4`.
- Errors: `tenant_quota_exceeded`→429 no-retry; `upstream_capacity_exceeded`→503
  retryable — `PRD.md:§6.5`.
- **Billing webhook**: per-request POST to `users.billing_webhook_url`, signed
  `X-DeepRouter-Signature: HMAC-SHA256(webhook_secret, body)`; fires in out-flow
  after output filter, before audit; 3x retry + DLQ — `PRD.md:§6.2, §7.3`.
  🔴 **NOT yet wired** — `internal/billing/` implemented+tested but no relay code
  calls it (Phase 2). **Billing webhooks do not fire today.** — `../CLAUDE.md`,
  this repo's `CLAUDE.md:§2`.

## 9. Compliance (deferred vs required-before-promotion)

`compliance-prd.md`: V0/student version deliberately **omits all compliance** to
run the funnel inside Lightman's own student circle. **All P0 compliance MUST be
done before any public promotion** (广告/媒体/公众号/渠道) — `§0, §2, §7`.
- **P0 (before promotion)**: 实名/KYC 分层, ICP 经营许可证, 生成式 AI 备案, 退款政策,
  隐私+用户协议, 内容审核, 未成年人保护, 客服/投诉, 发票/财务, 等保 2.0 — `§2 P0`.
- KYC tiered by 充值额度: ¥0–100 手机号; ¥100–1k +身份证; ¥1k–10k 强实名; ¥10k+
  银行卡4要素; 企业 营业执照+法人+对公 — `§3`. Prompt only on crossing a threshold,
  via 3rd-party (阿里云/腾讯云慧眼).
- **P1 (≤30d post-promotion)**: 反洗钱监控, 数据出境, 企业账户合规, 跨境支付, 税务 — `§2 P1`.
- Refund: V1 暂不退款; final policy 由法务审定 — `§4`. (See D4 on retention.)

## 10. Scope / non-goals (hard lines)

V0 IS: multi-provider routing, OpenAI-compatible `/v1` (chat/messages/embeddings/
images), cross-protocol conversion, multi-tenant isolation, content-policy
middleware, admin backend — `PRD.md:§2.1`.

**NOT (hard lines)** — `PRD.md:§2.2`: ❌ agent framework, ❌ fine-tuning, ❌ vector
DB/RAG, ❌ prompt-management SaaS, ❌ free public LLM proxy. Plus
**"不做 chat 是红线 — DeepRouter 是 utility(账号+钱包)，不是 destination"**
(`onboarding-v2-prd.md:§2 insight #1`). Not in V0: prompt caching, multi-region
active-active, per-end-user billing, custom model hosting, marketplace — `PRD.md:§4.4`.

---

## 11. Full contradictions/gaps ledger

Consolidated from the source audit (each is a D-item above or a known stale fact):
D1 product model · D2 virtual model name · D3 margin floor · D4 audit retention ·
D5 kids_mode vs policy_profile · D6 price-tier storage · D7 subscriptions undefined ·
D8 top-up flow undefined · D9 PRC-vs-SG compliance. Plus: webhook payload schema
differs between `PRD.md:§6.2` and `§7.3` (treat §7.3 as authoritative); `ModelAlias`
table + channel cost-attribution fields proposed in PRDs but absent from
`data-model.md`; per-tenant monthly quota numbers are "示例占位" placeholders;
`custom_pricing_id` / billing-expression format undocumented (`pkg/billingexpr`).
