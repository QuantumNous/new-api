# PRD — Homepage Motion & Interactive Tools

> Status: v0.1 · 2026-06-19 · author: Claude (from Lightman's ask: "首页还缺什么动画/互动工具")
> Scope: `web/default` home feature only (`src/features/home/**`). Marketing/acquisition surface.
> Anchors (law — do not redefine): `CLAUDE.md §0` (jargon ban, "不做 chat 红线", every-value-must-work),
> `onboarding-v2-prd.md §7.1` (first screen = no API/token/base-URL noise),
> `OPTIMIZATION-PRD.md §1` (global, English-first; overseas frontier models are the demand driver),
> `DESIGN.md` / design tokens (no hardcoded hex).

---

## 0. Goal

Make the DeepRouter homepage *show* its two differentiators instead of only stating them:
**(1) one account → every frontier model, (2) smart routing picks the cheapest capable model.**
Do it with motion + light interactivity that a non-technical visitor immediately "gets" — and
that a price-only relay competitor (hao.ai etc.) cannot easily copy because it dramatizes routing,
not a price table.

**Hard line:** none of this becomes a chat or assistant (red line). Interactive ≠ conversational.

---

## 1. What already exists (audit — do not rebuild)

| Capability | Where | Keep |
|---|---|---|
| Scroll-reveal entrance | `components/animate-in-view.tsx`, `landing-animate-fade-*` in `styles/index.css` | ✅ reuse |
| Hero animated bloom + routing-line background | `sections/hero.tsx`, `.landing-hero-bloom`, `.landing-hero-route/node` | ✅ extend (item I3) |
| Stat count-up | `sections/stats.tsx` | ✅ reuse pattern |
| Brand marquee | `components/scrolling-icons.tsx` | ✅ upgrade (item I5) |
| Region/model/use-case wizard | `components/hero-access-wizard.tsx` (added 2026-06-19) | ✅ polish (item I6) |
| **Framer Motion v12** installed (`motion`) **but unused in home** | `package.json` | ⬅️ primary tool for new work |
| `prefers-reduced-motion` fallback | `styles/index.css` | ✅ every new animation MUST honor it |
| Usage/cost estimate helper | `features/.../lib/usage-estimate.ts` (wallet) | ✅ reuse for calculator (I2/I3) |

**Net:** entrance/decoration animation is solid; the *product story* (routing, savings) is static.
Framer Motion is paid-for but idle. New work should lean on it, not add new deps.

---

## 2. Tech constraints (apply to every item)

1. **No new animation dependency.** Use the installed `motion` (Framer) + existing CSS keyframes. No
   GSAP / Lottie / tsparticles unless a later item justifies it in writing.
2. **`prefers-reduced-motion: reduce` → no motion.** Auto-playing loops must stop; reveals become
   instant. Mirror the existing guard in `styles/index.css`.
3. **Design tokens only** (`text-accent`, `bg-card`, `border-border`, …). No hardcoded hex, no
   `bg-blue-500` (DESIGN.md).
4. **Jargon ban on default surface.** Model IDs / "router" / "fallback" are OK as illustration but
   keep copy plain; no `API`/`token`/`base URL` in casual view (onboarding-v2 §7.1).
5. **Every shown value must be real** (`CLAUDE.md §0 rule 3`). Routing/cost previews are labelled
   "example"; model names must be ones the gateway actually serves; prices must match the live ratio
   table before going to production.
6. **Performance budget:** home stays light. New interactive widgets ≤ ~10KB JS each; lazy-mount
   below-the-fold demos; never block first paint. 60fps on a mid laptop.
7. **i18n:** all copy via `t()`; new English source keys added to `i18n/locales/{en,zh}.json` via
   `bun run i18n:sync` (zh translated, not left as English).

---

## 3. Scope — items (prioritized)

### I1 — Smart Routing demo (signature) 🔴 P0

**What:** an auto-playing, hover-pausable visualization that dramatizes routing.

**Behavior:**
- A prompt chip enters from the left (cycles through real examples, e.g. *"Write a polite
  follow-up email"*, *"Refactor this function"*, *"Make a 10-second product video"*).
- It travels a connector line into a central **router node** that briefly "thinks" (pulse).
- The line then lights up to the **cheapest capable model** for that prompt (simple → Haiku-class,
  hard → Opus/Sonnet-class, image/video → the right media model).
- A result badge fades in: *"Routed to {model} · ~{N}% cheaper than always using a premium model."*
- Loops through ~4 examples; pauses on hover/focus; respects reduced-motion (renders one static
  frame with the mapping legible).

**Where:** new `components/smart-routing-demo.tsx`; placed in `sections/how-it-works.tsx` (above the
3 steps) or a new `sections/smart-routing.tsx`. Reuse `connection-line.tsx` / hero route styles.

**How:** Framer Motion (`motion`), an array of `{prompt, model, savingsPct}` examples (illustrative,
labelled "example"). No backend call.

**Acceptance:**
- [ ] Auto-cycles ≥4 examples; pause on hover/focus; keyboard-focusable; reduced-motion = static.
- [ ] Each example maps to a model the gateway serves; "example" label present.
- [ ] 60fps; ≤10KB added JS (lazy-mounted below fold); no CLS.
- [ ] Reads as a *diagram*, never a chat thread (red line).

### I2 — Savings / cost-compare animation · P1

**What:** when a use-case is picked in the hero wizard (or in I1), an animated bar/number shows
"Premium-only $X → DeepRouter smart-routed $Y · save Z%".

**Where:** extend `hero-access-wizard.tsx` result block, or a small `cost-compare.tsx`.
**How:** Framer animated width/number; numbers from `usage-estimate.ts` (real ratios, not invented).
**Acceptance:** [ ] numbers trace to the ratio table; animates on change; reduced-motion = final value.

### I3 — Hero background reacts to the wizard · P1

**What:** the decorative hero routing lines respond to the wizard — picking a model/use-case lights
the route to that node, tying the static background to the interaction.
**Where:** `sections/hero.tsx` + `hero-access-wizard.tsx` (shared selected-state).
**Acceptance:** [ ] selecting a chip highlights the matching route; reduced-motion = no change.

### I4 — Pricing-page interactive calculator · P1

**What:** "What does ¥X / $X get me?" slider → live per-model estimate (chats / characters).
**Where:** Pricing page (out of `features/home`, but same effort family); reuse `usage-estimate.ts`.
**Acceptance:** [ ] slider → live estimate for ≥3 models; values match live ratios; USD-first,
CNY shown as the China-lane payment option (see OPTIMIZATION-PRD positioning).

### I5 — Brand strip: real logos + hover · P2

**What:** replace plain-text provider names with greyscale logos that colorize on hover + tooltip
("Claude — Opus/Sonnet/Haiku"). Keep the marquee.
**Where:** `components/scrolling-icons.tsx`, hero brand strip in `sections/hero.tsx`.
**Constraint:** logo assets must be license-clean; fall back to text if absent.

### I6 — Microinteraction polish (Framer) · P2

- Wizard result appears with a spring fade/slide (today it's a hard conditional render).
- Chip select → subtle scale/spring.
- Copy-key → checkmark morph + toast (keys page).
**Where:** `hero-access-wizard.tsx`, keys feature.
**Acceptance:** [ ] all spring-based, reduced-motion-safe, no layout shift.

### I7 — Hero pointer parallax · P2 (nice-to-have)

Bloom/nodes drift slightly with pointer for a "live" first screen. Desktop only; off on touch +
reduced-motion. Lowest priority; skip if it costs perf.

---

## 4. Priority / phasing

| Phase | Items | Outcome |
|---|---|---|
| P0 | **I1** | The routing story is *shown*, not told — the signature differentiator on screen. |
| P1 | I2, I3, I4 | Interactivity that quantifies value (savings) and ties hero ↔ wizard ↔ pricing. |
| P2 | I5, I6, I7 | Polish: real logos, spring microinteractions, parallax. |

Recommend shipping **I1 alone first** (highest leverage, self-contained), then deciding P1 by reaction.

---

## 5. Acceptance criteria (feature-level)

1. A first-time visitor, no scrolling beyond the first two sections, can *see* (a) one account →
   many frontier models and (b) routing picks the cheapest capable model.
2. Every animation honors `prefers-reduced-motion`; no auto-loop runs when reduced.
3. No new heavy dependency; home Lighthouse perf not regressed; no CLS from injected widgets.
4. Zero chat/assistant affordance introduced (red line).
5. All copy localized (en + zh), no banned jargon on the default casual surface.
6. Every model name / price shown is real (verified against the gateway / ratio table) or clearly
   labelled "example".

---

## 6. Open questions

- **Q1:** I1 placement — replace the 3-step "How it works", sit above it, or its own section? (default: own section above How-it-works.)
- **Q2:** I1/I2 example data — hardcode an illustrative set now, or wire to a real `/router-catalog` preview later? (default: illustrative + "example" label for v1.)
- **Q3:** Real provider logos for I5 — do we have a license-clean asset set, or stay text-only? (blocks I5.)

---

## 7. Revision history

| Version | Date | Note |
|---|---|---|
| v0.1 | 2026-06-19 | Initial spec. Audit of existing home motion + 7 prioritized items; P0 = animated Smart Routing demo (I1). |
| v0.2 | 2026-06-19 | **All 7 items implemented** in `web/default` home (Framer Motion, design tokens, reduced-motion safe, no chat). I1 `smart-routing-demo.tsx` + I2 cost bar; I3 hero bg reacts to wizard (`onInteract`); I4 `value-calculator.tsx` (reuses `usage-estimate`); I5 brand-strip hover/tooltip (text fallback — real logos still need license-clean assets, Q3 open); I6 wizard result spring (copy-key check already existed); I7 hero pointer parallax (ref-based). tsc green, rsbuild green, :17231 verified. **Leftover:** `bun run i18n:sync` + zh translations for new strings; example numbers labelled "example", verify vs live ratios before prod. |
| v0.3 | 2026-06-19 | **De-dup for clean PR.** Rebasing onto current `origin/main` revealed it already ships a `SmartRouting` section (`sections/smart-routing.tsx`) covering I1 + I2 (animated routing flow, model tiers, premium-vs-routed savings, "Don't know which model to pick? We do."). **I1/I2 dropped** from this PR — the existing section is kept. Ships only the genuinely-new items: hero access wizard + headline + AU default (I3/I6), I4 ValueCalculator, I5 brand hover, I7 parallax, favicon, $5 stat fix. |
