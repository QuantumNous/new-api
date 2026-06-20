# PRD — Non-Technical User Journey: Register → Use → Success (Readiness & Gap-Closure Plan)

> Status: v0.1 · 2026-06-13 · author: Claude (from Lightman's goal + journey audit)
> Language: written in English by request. User-facing copy samples are shown in
> the language they ship (zh), since the product targets 全球华人.
>
> **What this doc is — and is NOT.** This is NOT a sixth product spec. Five PRDs
> already each own a slice of this journey (see §1). The recurring failure has been
> that nobody verified the **end-to-end built journey** against them, so casual
> users still hit jargon and dead ends. This doc is the **execution / gap-closure
> layer**: it audits what is *actually built* against those PRDs and CLAUDE.md §0,
> then produces one prioritized backlog with a safe-vs-decision-gated split.
>
> **Anchors (the law — do not redefine here):** `CLAUDE.md §0`,
> `onboarding-v2-prd.md` (§3 personas, §4 golden path, §7.4 jargon ban, §7.5 key
> page, §7.6 self-check, §9 red lines), `BUSINESS-LOGIC.md §0` (open decisions
> D1/D2/D10). If anything below seems to contradict those, those win — file it as
> a gap, do not "pick one" in code.

---

## 0. The goal (Lightman, 2026-06-13)

> "现在 deeprouter 部分，适合非技术人从注册到使用，到如何使用成功吗，因为很多技术名词
> 很难理解，注册成功了也不知道该怎么做。这个作为你优化的 goal。"

A non-technical paying user (lawyer / teacher / designer — `onboarding-v2 §3`) must
get from **register → top-up → get key → confirm it works** in ~2 minutes, with
**zero jargon confusion** and **zero support tickets**. The decisive last step is
the self-check (`§7.6`) that proves "我的钱变成了 AI 算力" — not a code snippet.

This doc's job: make that real and keep it real.

---

## 1. The journey and its governing PRD (one row per step)

| # | Step | Route | Governs | AS-IS verdict |
|---|------|-------|---------|----------------|
| 1 | Register + persona/brand wizard | `/sign-up` → `/welcome` | `onboarding-prd §4`, `onboarding-v2 §7.3` | ✅ Works |
| 2 | Land after welcome | persona `defaultRoute` | `persona-presets.ts` | ⚠️ Contradiction (D10) |
| 3 | Top-up | `/wallet` | `onboarding-v2 §7.4`, `BP §4.3` | ✅ Already shows ≈chats + per-model 字 |
| 4 | Create key (Simple) | `/keys` create | `api-key-simple-advanced-prd` | ✅ Mostly good |
| 5 | Success dialog | (modal) | `api-key-simple-advanced §4.2` | ✅ Fixed 2026-06-13 (self-check primary) |
| 6 | Standing key guidance | `/keys` tutorial card | `onboarding-v2 §7.5`, `casual-ux §3.1` | ✅ Good, but persona-gated (D10) |
| 7 | Self-check | `/keys/test` | `onboarding-v2 §7.6`, `key-setup-guide-prd §5` | ✅ Now zh-complete |
| 8 | Setup guide (dev extra) | (modal) | `key-setup-guide-prd §4`, `CONNECT.md` | ✅ Fixed (model/proxy/Claude Code) |

---

## 2. AS-IS audit findings (journey-ordered, with severity)

> **Correction 2026-06-13.** The initial journey audit (run by a sub-agent)
> overstated the wallet gap — it claimed `/wallet` shows raw quota with no
> conversion. **That is false.** The balance card shows `≈ N chats remaining`
> (`wallet-stats-card.tsx:50,57`) and each top-up preset shows a per-model
> character estimate (`recharge-form-card.tsx:363-377`, via the shared
> `lib/usage-estimate.ts`, built for `onboarding-v2 §7.4`). Findings below are
> corrected against the actual code. Lesson: verify every audit claim against
> source before acting (CLAUDE.md §0 rule 3 applies to audits too).

Severity: 🔴 blocks first successful use · ⚠️ confuses / leaks jargon · ✅ working.

1. **Register → /welcome** ✅ — 2-step wizard (persona + brand). Trial credit shown
   as `¥{quota/500000}` + `≈ {{count}} chats` (`welcome/index.tsx:242,247`). Clear.

2. **Landing after welcome** ⚠️ (D10) — `casual` lands on **`/playground`**
   (in-browser chat) (`persona-presets.ts:84`), which contradicts the red line
   **"不做 chat 是红线"** (`onboarding-v2 §2 / §9`). And the legacy/parse-fail default
   is **`dev`** (`persona-presets.ts:104` `LEGACY_USER_PERSONA='dev'`) → developer
   surface, no casual aids.

3. **Top-up `/wallet`** ✅ — Already implements `§7.4`. Balance card:
   `≈ {{count}} chats remaining` + a "Top up to start using AI models" empty state
   (`wallet-stats-card.tsx:50,57`). Each preset tier shows a per-model character
   estimate `≈ Claude Sonnet / GPT-4o / DeepSeek: X 万字`
   (`recharge-form-card.tsx:363-377`). Casual mode already hides the custom-amount
   input and redemption code (`recharge-form-card.tsx:385,646`). Residual nit (not
   a blocker): the raw "quota" unit label could get one `<FieldHint>`, but the
   ≈chats line already carries the meaning.

4. **Create key `/keys` (Simple)** ✅/⚠️ — Mode-picker + 6-card purpose picker is
   intuitive; Simple is recommended. Minor: Advanced-mode fields (channel group,
   model whitelist, quota) are visible to anyone who peeks; `casual-ux §2.2` says
   hide them in casual mode.

5. **Success dialog** ✅ (fixed 2026-06-13) — Previously the primary CTA was
   **"View code examples →"** (scary/irrelevant to a non-coder, against `§7.5`).
   Now the **self-check is the primary CTA** ("测试这个密钥 →", the decisive
   `§7.6` proof step) and the code/Setup guide is a quiet secondary ghost link.
   Already had: a plain "粘贴到你正在用的 AI 工具" explanation block, a
   "shown once" warning on the key, and a hint on the model name. `Base URL`/model
   values are correct + live-verified (`deeprouter-auto`, fixed 2026-06-11).

6. **Standing guidance — `/keys` tutorial card** ✅ but gated — `ApiKeysTutorialCard`
   only renders for `persona==='casual'` (`api-keys-tutorial-card.tsx:77`). Combined
   with finding #2 (default `dev`), fallback/legacy users get **zero** "what do I do
   now" guidance — the precise complaint in the goal.

7. **Self-check `/keys/test`** ✅ — Exactly the right "confirm it works" tool; one
   input → one output, cheap model, daily cap (`§7.6`, `key-setup-guide-prd §5`).
   Discoverable from the `/keys` "Test a key" button + success dialog + setup guide
   step 3. **Was a full screen of English for zh users; zh copy completed 2026-06-13.**

8. **Setup guide (developer extra)** ✅ — Claude Code / opencode / cURL / Python tabs;
   model defaults to `deeprouter-auto`; dev proxy serves `/v1`. Content source =
   `CONNECT.md`, all verified 200 against the live gateway.

---

## 3. The plan — prioritized gap-closure backlog

Each item: scope, files, governing PRD, and gate (🟢 safe / 🟡 needs decision).

### P0 — blocks or badly degrades first successful use

| ID | Gap | Fix | Files | Gate |
|----|-----|-----|-------|------|
| **G1** | ~~Top-up has no "¥X ≈ N 次对话"~~ | **Already built** — ≈chats on balance + per-model 字 on presets (`lib/usage-estimate.ts`, `§7.4`). Audit was wrong; no work needed. | `wallet/*` | ✅ ALREADY DONE |
| **G2** | Self-check page was English for zh users | zh + en strings registered (30 keys) | `i18n/locales/{zh,en}.json` | ✅ DONE 2026-06-13 |
| **G3** | Success dialog pushed code as the primary CTA | **DONE** — self-check ("测试这个密钥 →") is now primary; Setup guide demoted to secondary ghost link. Zero new strings (reused translated `Setup guide`). | `api-key-success-dialog.tsx`, `onboarding-v2 §7.5/§7.6` | ✅ DONE 2026-06-13 |

### P1 — improves clarity, not blocking

| ID | Gap | Fix | Gate |
|----|-----|-----|------|
| **G4** | Advanced fields visible in casual mode | Largely moot — casual uses the separate Simple-mode form; recharge already hides custom-amount/redemption for casual. Advanced is an explicit opt-in. | `casual-ux §2.2` | ⬇️ low value |
| **G5** | No global help affordance on the journey | `<HelpFab>` per casual-ux | `casual-ux §2.3/§4.2` | 🟢 |
| **G6** | HTTP codes (401/402) in error copy | Only remaining instance is in the **developer-mode** Setup guide step 3 (`api-key-integration-dialog.tsx:224`) — casual users do not see it. `/keys/test` already maps to Top up / Regenerate / Contact actions. | dev-mode only | ⬇️ low value |

### Blocked on decision — do NOT build until resolved (see `BUSINESS-LOGIC.md §0`)

| ID | Decision | Why it blocks the journey |
|----|----------|---------------------------|
| **B1** | ✅ **DONE 2026-06-13** — `LEGACY_USER_PERSONA='casual'` | Fallback/legacy users now resolve to casual → tutorial card + self-check show. Highest-leverage fix for "注册成功了不知道怎么做". Reversible if D1 says otherwise. |
| **B2** | ✅ **DONE 2026-06-13** — casual `defaultRoute='/keys'` | Honors "不做 chat 是红线"; casual lands on the §7.5 "决定性一页" (tutorial card + self-check), not Playground. |
| **B3** | 🟡 **D2 resolved-in-code, D1 still open** | D2: `deeprouter-auto` is the de-facto user-facing name (`modelNameForPurpose()` always returns it; others 503). **D1** (V0 audience a/b/c — fundraising vs internal vs casual) is a strategy decision, NOT a code change — stays open in `BUSINESS-LOGIC §0`. |

---

## 4. Acceptance criteria (journey-level — this is "suitable for non-technical users")

A brand-new account, **casual persona, zh browser, no prior knowledge** can, with no
support and no code:

1. Register and immediately see what they got (trial credit as ¥ + ≈ chats). ✅ today
2. Land somewhere that tells them the next step (not a developer console). ✅ (B1/B2 done)
3. Top up **knowing what the amount buys** ("¥X ≈ 约 N 次对话"). ✅ today (G1 already built)
4. Create a key in Simple mode without touching a jargon field. ✅/G4
5. Reach the self-check and see **"密钥可以用了。"** in their language. ✅ G2
6. Know the one next action: "粘贴到你正在用的 AI 工具里，找 API Key 框". ✅ (G3 done)
7. **Every value shown (model name, Base URL) verified against a live gateway call**
   (CLAUDE.md §0 rule 3). ✅ enforced
8. **Zero banned jargon** (`API` / `token` / `Base URL` / `网关` / `SDK` / client
   brand names) on any default casual surface; all behind Developer mode (`§7.4`).
   🟡 partially (G3/G4)

The journey is "suitable" when 1–8 all hold for the casual persona.

---

## 5. Verification protocol (how we prove each item)

- **Live-value check:** before shipping any shown value, call the gateway
  (`model=deeprouter-auto`, the derived Base URL) and confirm 200 — both
  `/v1/chat/completions` and `/v1/messages`. Anti-regression for the 2026-06-08
  `deeprouter`/`:17231` breakage.
- **Click-through:** walk steps 1–7 as a fresh casual account on a zh browser; no
  English fallback strings, no dead ends.
- **i18n completeness:** no casual-surface string missing from `zh.json` (the gap
  G2 closed; keep `bun run i18n:sync` clean for new strings).

---

## 6. Dependencies / open questions

- **D1** (product model a/b/c), **D2** (canonical model name), **D10** (persona
  default + casual landing) — all in `BUSINESS-LOGIC.md §0`. P0 items G1/G3 are
  independent of these and can ship now; B1/B2/B3 cannot.

---

## 7. Status log

- **2026-06-11** — Setup guide fixed: `modelNameForPurpose()` → `deeprouter-auto`
  (other aliases 503); dev proxy serves `/v1`; Claude Code + opencode tabs added
  (source `CONNECT.md`, all 200).
- **2026-06-13** — Journey audited end-to-end. **G2 closed** (30 casual-surface zh
  strings: self-check page, tutorial card, success dialog). **D10 recorded** in
  `BUSINESS-LOGIC.md §0`. This PRD created.
- **2026-06-13 (dev pass, "可以开发了")** — Verified backlog against source before
  building. Found **G1 already built** (wallet ≈chats + per-model 字 — initial audit
  was wrong; PRD corrected). **G3 done** (self-check is now the primary CTA in the
  success dialog; code guide demoted). G4/G6 re-tagged low-value/dev-only. tsc
  green; HMR rebuilt. **All non-decision-gated casual-journey code is now done or
  already-present.**
- **2026-06-13 ("auto mode 全部完成")** — Lightman authorized finishing the
  decision-gated items. **B1 done**: `LEGACY_USER_PERSONA` `'dev'`→`'casual'` —
  fallback/legacy users now see the tutorial card + self-check (fixes "注册成功了
  不知道该做什么"). **B2 done**: casual `defaultRoute` `'/playground'`→`'/keys'` —
  honors "不做 chat 是红线". **B3**: D2 already resolved-in-code (`deeprouter-auto`);
  **D1 remains the only open item** — it is a fundraising/strategy call (internal
  vs dev-SaaS vs casual), not a code change. tsc green; HMR rebuilt. Both B1/B2 are
  one-line, trivially reversible if D1 later contradicts them.
