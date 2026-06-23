# Skill Marketplace UX Design Specification

本文档定义 DeepRouter Skill Marketplace V1 的企业级 UX / UI 规格。目标是让 Design、Frontend、Backend、QA、Operations 和独立 Agent 可以按同一套页面、组件、状态和验收口径执行。

本 UX Spec 以 `tasks/01_Functional_Requirements.md` 为功能基准。若两者冲突，以 Functional Requirements 的范围和权限规则为准，UX 文档必须同步修订。

---

## 0. V1 UX Release Baseline

本章节固定 UX 设计默认口径，避免不同设计师、前端工程师或 Agent 按不同假设实现。

| Decision | V1 UX Baseline |
|---|---|
| Distribution & execution (D-09 / R2) | Marketplace offers downloadable SKILL.md-compatible zip packages; Detail shows a Download CTA with installation instructions ("Extract to .claude/skills/ and use /skillname"). Running a downloaded Skill routes its work through DeepRouter and requires a DeepRouter API key. Admin Preview retained for Admin testing only |
| Runtime dependency (D-09 / R2) | Detail page MUST state that running the Skill requires a DeepRouter API key and routes through DeepRouter; downloaded packages depend on DeepRouter at run time (the moat is the runtime dependency + per-run auth/billing, not prompt secrecy) |
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
| Downloadable Capability, Server-Side Moat | UI 鼓励下载 Skill 包；可读模板不是机密，但 UI 不得暗示用户可获得 provider 凭证或绕过 DeepRouter 运行 |
| Use-Time Entitlement | 下载不等于永久可用；UI 必须显示当前执行可用性，并提示运行需 DeepRouter key |
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
| My Skills | `/skills/my` | Logged-in users | Manage enabled Skills |
| Playground | `/playground` | Logged-in users | Execute Skills |
| Admin Skills | `/admin/skills` | Super Admin | Create and operate official Skills |
| Skill Analytics | `/admin/skill-analytics` or `/ops/skills` | Operation, Product/Growth, Super Admin | Monitor usage and revenue |
| Skill Reviews | `/ops/skill-reviews` | Operation, Super Admin | Review quality, safety, blocked issues |

### 2.2 Role-Based Page Access

| Page | Anonymous | Normal User | Operation | Product/Growth | Safety Reviewer | Support | Super Admin |
|---|---:|---:|---:|---:|---:|---:|---:|
| Marketplace | Public fields | Full user view | Full user view | Full user view | Full user view | Full user view | Full user view |
| Skill Detail | Public fields | Full user view | Full user view | Full user view | Full user view | Full user view | Full user view |
| My Skills | No | Own only | No | No | No | Assisted user read-only | Any user if audited |
| Playground Skill Picker | No | Yes | No | No | No | No | Preview/test only |
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
| Anonymous + Free Skill | Public card, no enabled state | Log in to download |
| Anonymous + Pro Skill | Public card with Pro badge | Log in to continue |
| Logged-in + Free + not downloaded | Available | View (opens Detail → Download) |
| Logged-in + Free + downloaded | Downloaded badge | View (opens Detail → Download) |
| Logged-in + Pro + Free user | Locked with Pro badge | Upgrade |
| Logged-in + Pro + Pro user | Available | View (opens Detail → Download) |
| Subscription expired | Locked with renewal reason | Renew |
| Enterprise Skill + non-enterprise | Enterprise badge | Contact sales |
| Quota exceeded | Locked state with quota message and reset time when available | Upgrade |
| Deprecated + not enabled | Hidden from Marketplace | None |
| Deprecated + enabled | Not in Marketplace; visible in My Skills | Use with warning |
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
| Safety & Privacy | Hosted prompt statement, AI-generated disclosure, data note |
| Kids Mode | Kids Safe / Kids Exclusive explanation when Kids feature flag is enabled |
| CTA Bar | Primary and secondary actions based on CTA decision table |
| Related Skills | P1; excludes archived/deprecated |

#### 4.2.3 Detail CTA Decision Table

| User / Skill State | Primary CTA | Secondary CTA | Notes |
|---|---|---|---|
| Anonymous | Log in to download | Back to Marketplace | Preserve return URL |
| Logged-in + allowed | Download | Back | Download returns the zip; running it requires a DeepRouter API key |
| Free user + Pro Skill | Upgrade to Pro | Back | No download until upgraded |
| Expired subscription | Renew membership | Back | Skill remains in My Skills |
| Enterprise Skill + not entitled | Contact sales | Back | No fake download state |
| Quota exceeded | Upgrade | Back | Show quota reset if available; may preview Pro value without implying entitlement |
| Deprecated | Unavailable | Back | Backend exposes published Skills only; no download CTA unless a future backend policy explicitly allows deprecated downloads (not in DR-58 scope) |
| Archived | Unavailable | Back | No download CTA |
| Kids blocked | Not available in Kids Mode | Back | No switch-mode CTA in V1 |
| Download auth failure | Sign in again | Back | `AUTH_REQUIRED` from the download endpoint = web session expired, NOT a missing runner key |

#### 4.2.4 Privacy and Runtime-Dependency Copy

Use concise user-facing copy (R2 — must state the runtime dependency):

```text
Download this Skill to use it in your own environment.
Running this Skill requires a DeepRouter API key; it routes its work through DeepRouter.
Extract the zip to .claude/skills/ and use /skillname in Claude Code.
Generated results are AI-assisted and should be reviewed before use.
```

Installation instruction block (shown after download):
```text
1. Extract the zip to your .claude/skills/ directory
2. Type /skillname in Claude Code to use it
3. Running it still requires a valid DeepRouter API key
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
| List/Table | Skill, status, required plan, last used, enabled date, actions |
| Empty State | Prompt user to explore Marketplace |

#### 4.3.3 Row States

| State | UX | Actions |
|---|---|---|
| Enabled + executable | Normal row | Use, Disable |
| Enabled + plan locked | Locked badge and reason | Upgrade/Renew, Disable |
| Enabled + quota exceeded | Quota badge with reset time if available | Upgrade, Disable |
| Deprecated enabled | Warning badge | Use with warning, Disable |
| Archived | Unavailable badge | Remove/Disable |
| Kids blocked | Kids unavailable badge | Disable |

#### 4.3.4 Empty State

```text
No Skills enabled yet.
Explore Marketplace to add Skills to your Playground.
```

Primary action: `Explore Skills`.

---

### 4.4 Playground Skill Picker (Legacy — Removed in D-09)

> **Note:** In-platform Playground execution is not the V1 end-user execution surface. Users run downloaded Skill packages locally with any LLM. Admin Preview is retained for Admin testing only. This section is retained for historical reference; do not implement as end-user flow.

---

### 4.4-Legacy Playground Skill Picker

#### 4.4.1 Goal

Allow users to apply exactly one enabled Skill to a Playground request while making entitlement and safety state clear before submission.

#### 4.4.2 Placement

- Desktop: near model selector and above input composer.
- Mobile: collapsible selector above composer; selected Skill remains visible.
- Picker must not resize the message composer unexpectedly.

#### 4.4.3 Picker States

| State | UI Behavior | Submit Behavior |
|---|---|---|
| No Skill selected | Compact empty selector | Normal non-Skill request |
| Skill selected + executable | Selected chip/card with clear button | Submit with `skill_id` |
| Skill selected + locked | Error/locked inline state | Submit disabled or blocked with error |
| Skill not enabled | Show Enable action | Submit blocked until enabled |
| Plan required | Lock badge + Upgrade CTA | Submit blocked |
| Subscription expired | Renew CTA | Submit blocked |
| Quota exceeded | Quota message with reset time if available | Submit blocked; show upgrade CTA outside prompt input |
| Kids blocked | Kids Mode unavailable message | Submit blocked |
| Deprecated enabled | Warning badge | Submit allowed |
| Archived | Unavailable state | Submit blocked; prompt user to clear |
| Context too long | Inline warning after estimate | Submit blocked or requires shorten input |
| Rate limited | Retry-after message | Submit blocked until retry |
| Timeout after submit | Error banner with retry | Retry allowed |

#### 4.4.4 Interaction Rules

- Selecting a Skill clears any previously selected Skill.
- Clearing a Skill returns to normal Playground request mode.
- Skill Detail deep link can preselect Skill only after enable flow succeeds.
- Client-provided Kids flags are never shown as trusted state.
- Relay errors must map to UX error states using stable error codes.

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
- Return path must preserve the Skill Detail or Playground context.
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
- Package build succeeds and contains no provider credentials or server routing logic (R2).
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
| `SkillCTA` | view, download, upgrade, renew, contact_sales, unavailable |
| `SkillActions` | save, unsave, favorite, unfavorite, rate, report |
| `RatingWidget` | 1-5 stars, optional comment (280 chars max), submit/update |
| `EvaluationBadge` | passed, failed, warning, pending; separate from verified badge |
| `VerifiedBadge` | human-reviewed, shown on detail and card |
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
| Runtime dependency | Download to use. Running this Skill requires a DeepRouter API key; it routes its work through DeepRouter. |
| Needs key | You need a DeepRouter API key to run this Skill. Sign up or add your key to continue. |
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
| My Skills Use | `skill_used` with `entry_point=my_skills` after execution |
| Skill Package execution | `skill_used` / `skill_blocked` with `entry_point=skill_package` |
| Playground Picker | Legacy/historical analytics value only; new flows do not emit `entry_point=playground_picker` |
| Locked CTA | `skill_blocked` and upgrade/contact-sales click |
| Admin Publish | `skill_admin_action` |
| Review Action | P1; requires Analytics event approval |
| Recommendation Rail | Use `entry_point=featured/popular/new/recommended` in existing Skill events |

No tracking payload may include `instruction_template` or Kids sensitive raw input.

---

## 10. UX Acceptance Criteria

### 10.1 P0 UX Acceptance

1. Anonymous users can browse public Marketplace and Skill Detail, but cannot download (Download CTA routes to login/signup). *(V1: not yet — Marketplace and Detail are authenticated-only; anonymous browse is a deferred follow-up.)*
2. Logged-in users can download, remove from My Skills, and view My Skills.
3. Marketplace cards show plan, availability, and correct CTA for Free/Pro/Enterprise states.
4. Skill Detail shows runtime-dependency copy (needs a DeepRouter key), AI disclosure, and correct Download CTA. *(V1: examples/input hints deferred — not exposed by `PublicSkillDetail`; DR-53 follow-up.)*
5. The downloaded package surfaces lock/error states and prompts signup on `AUTH_REQUIRED`.
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
