# DR-59 — My Skills UI

Status: eval
Date: 2026-06-25
Ticket: DR-59 (Phase 1, Module M03)
PRD refs: `docs/skill-marketplace/tasks/02_UX_Design.md §4.3`; `docs/skill-marketplace/tasks/01_Functional_Requirements.md FR-U5`
Depends on: DR-54 (My Skills API), DR-56 (Remove from My Skills), DR-61 (component library) — all merged.

## Context

The My Skills page (`tasks/02 §4.3`) lets a logged-in user manage the Skills in
their library and see which can be executed now. Before DR-59 the page was a
placeholder `SkillCard` grid; it did not present the §4.3 management surface
(header count, filters, row states, actions). DR-59 builds that surface as a
frontend-only change on top of the already-merged DR-54/56/61 contracts.

## Goal

Replace the placeholder My Skills page with the `tasks/02 §4.3` management
surface: a header count, `All / Available / Locked / Deprecated` filters, a
desktop table + responsive mobile list, the §4.3.3 row states, per-row actions
(Use / Remove), and empty / loading / error states — all driven by stable
backend signals (DR-54 `availability` + `skill_status`).

## Scope

- Header with a filter-independent count of My Skills rows.
- `All / Available / Locked / Deprecated` filters (mutually exclusive), each with
  a subcount.
- Desktop table (Skill, Status, Required plan, Last used, Enabled, Actions) and a
  mobile stacked card list.
- Row states (§4.3.3): enabled+executable, plan-locked, quota-exceeded,
  deprecated-enabled (warning), archived (unavailable), kids-blocked. Derived by
  a pure mapper from DR-54 `availability{executable,locked,lock_code,cta}` +
  `skill_status`.
- Actions: **Use** (navigation to Skill Detail, published rows only) and
  **Remove from My Skills** (DR-56 `DELETE /api/v1/marketplace/my-skills/:id`,
  with a confirm dialog).
- Empty state → Explore Skills (`/skills`); filtered-empty; loading skeleton;
  error banner with request id + retry.
- i18n (en/zh) for all new copy.

## Non-Goals

- No backend / API changes; no changes to `internal/skill/availability` or the
  `ListMySkills` handler.
- No in-platform execution / Playground (removed under D-09).
- No new analytics events; `Use` is navigation only and does not emit
  `skill_used`.
- No docs-sync of the stale Marketplace task docs (see "Documentation drift").

## Key decisions & staged deviations

- **D-09 — Use → Skill Detail.** The ticket's legacy "Use/Playground" wording is
  interpreted as "Use → Skill Detail," because V1 execution happens through
  downloaded packages, not the removed in-platform Playground.
- **Published-only Use / name link.** Skill Detail (`GetMarketplaceSkill`) is
  published-only (`status = published`). So **Use and the skill-name link are
  gated to published rows**; deprecated/archived rows render warning/reason +
  Remove only, with plain-text names, to avoid a 404 dead path. Deprecated-enabled
  Skills still appear only in My Skills with a warning (ticket acceptance), but
  are not given a navigable Use/name. **Follow-up (to be filed):** backend/product
  support for deprecated-enabled detail/download to restore the §4.3.3
  "Use with warning" behavior.
- **⚠ FR-U6 lock-state CTAs deferred (needs sign-off).** `FR-U6` / `§4.3.3` /
  `§4.6` call for Upgrade / Renew / Contact-Sales CTAs on locked rows. DR-59
  renders **lock reason + Remove only — no clickable upgrade-class CTA** — because
  the skill surface has no wired plan-upgrade / renew / contact-sales route today
  (the Marketplace routes `upgrade` to Skill Detail; Detail only does Download), so
  a clickable CTA would dead-end. This is a **deliberate narrowing of FR-U6 that
  requires explicit reviewer/product sign-off**; otherwise the fallback is a
  follow-up ticket that wires the CTA routing. **Follow-up (to be filed):**
  plan/renew/contact-sales routing for skill lock states. A component test guards
  the absence of these CTAs against regression.
  **Merge condition:** DR-59 may merge only with explicit reviewer/product
  sign-off on this FR-U6 deviation, or after a follow-up/docs-sync records the
  narrowed scope — not a silent merge.
- **Quota reset time not rendered.** DR-54 `availability` has no reset-time field.
- **Header wording.** Neutral "{{count}} Skills in My Skills" (docs carry both
  "enabled" §4.3.2 and "downloaded" FR-U5 phrasings; DR-55 makes download ==
  enablement).

## Acceptance Criteria

- Enabled Skills are shown with correct §4.3.3 row states + actions; the header
  count is filter-independent; the four filters partition rows mutually
  exclusively.
- Deprecated-enabled Skills appear **only** in My Skills, with a warning.
- Archived/kids/locked rows present no Use; Remove is always available.
- Use (published rows) navigates to Skill Detail; it never executes and never
  emits `skill_used`. Deprecated/archived names are not navigable.
- Remove opens a confirm dialog, calls `removeMySkill(skill_id)`, invalidates the
  My Skills + Marketplace queries, and closes the dialog.
- Empty state prompts Explore Skills (`/skills`).
- No "Disable" wording and no Playground action anywhere on the page.
- Locked rows render no Upgrade/Renew/Contact-Sales CTA (the FR-U6 deviation),
  guarded by a negative-assertion test.

## Documentation drift (not changed in this PR; separate docs-sync)

`tasks/02 §4.3.3` still says "Disable"; `§4.3.4` empty copy still mentions
"Playground"; `tasks/03 §8.5` still documents `POST .../disable` / `skill_disabled`.
DR-59 follows the merged DR-56 contract; a docs-sync should reconcile these.

## Verification

Frontend-only. Local gates green: row-state mapper unit 20, My Skills component
22, marketplace group 89 (no regression), typecheck / ESLint / `git diff --check`
EXIT=0, Vitest v8 coverage 97.27% statements / 92.55% branches over the DR-59
files. `copyright:check` exits 1 only on pre-existing unrelated files; DR-59 files
are not flagged.
