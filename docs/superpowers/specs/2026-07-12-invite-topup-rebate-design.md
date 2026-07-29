# Invite Top-up Rebate Design

**Date:** 2026-07-12  
**Status:** Approved for implementation planning  
**Repo:** QuantumNous/new-api (local customization)  
**Primary constraint:** Keep future upstream merges cheap.

## 1. Problem

Site operators want invite growth tied to real money: when an invitee successfully tops up, the inviter earns a configurable share (default **1%**) of the **credited quota**, can see stats on a dedicated page, and **manually** moves rewards into balance.

New API already has:

- Invite binding (`aff_code` / `inviter_id`)
- Fixed register bonus into `aff_quota` (`QuotaForInviter`)
- Manual transfer `POST /api/user/aff_transfer` (`AffQuota` → `Quota`)
- Wallet “Referral Program” card (pending / total / invite count)
- `topups` success records per payment provider

It does **not** rebate on invitee top-ups, and has no per-topup rebate ledger for audit.

## 2. Goals

| Goal | Detail |
|------|--------|
| Rebate | On successful top-up, credit inviter `floor(credited_quota * ratio)` |
| Wallet | Credit existing `aff_quota` / `aff_history_quota`; reuse manual transfer |
| User UI | Dedicated self-service stats page (summary + invitees + rebate logs) |
| Admin UI | Dedicated audit list + summary filters |
| Config | Admin options: enable flag + ratio in basis points (default 1%) |
| Themes | `web/default` and `web/classic` |
| Merge | Prefer new files; minimal hooks in upstream hot paths |

## 3. Non-goals

- Multi-level referral trees
- Per-user or per-group rebate rates (v1)
- Auto-credit rebate straight into spendable `quota` (must stay manual extract)
- Separate `rebate_quota` wallet
- Changing register-time fixed invite bonus semantics
- CSV export in v1
- Schema changes to `topups` table

## 4. Architecture

```text
Invitee top-up succeeds (Recharge* / epay / admin complete)
        │
        ▼
GrantInviteTopupRebate(...)   // model/invite_rebate.go
        │  skip if disabled / no inviter / rebate==0
        │  insert invite_rebates (UNIQUE topup_id)
        │  inviter.aff_quota += rebate
        │  inviter.aff_history_quota += rebate
        │  system log
        ▼
User invite-rebate page ──► summary / logs / invitees
Admin invite-rebate page ──► filtered ledger
Transfer                 ──► existing aff_transfer only
```

### Design principles (merge-first)

1. **Ledger first** — one rebate row per successful top-up (`topup_id` unique) for idempotency and audit.
2. **Thin hooks** — payment success paths only call one helper; logic lives in new files.
3. **Reuse extract** — no second transfer API.
4. **Default off** — `InviteTopupRebateEnabled=false` so upstream pulls do not change live behavior until operators enable it.
5. **Isolated frontend features** — new pages/features; avoid deep rewrites of wallet/settings cores.

### Relation to existing invite rewards

| Kind | When | Amount | Where |
|------|------|--------|-------|
| Register invite bonus | Invitee registers | Fixed `QuotaForInviter` | `aff_quota` (no rebate ledger row) |
| Top-up rebate (new) | Invitee top-up success | Credited quota × ratio | `aff_quota` + `invite_rebates` |

Both share the pending wallet and transfer flow. The new stats pages show **top-up rebate ledger only**, so register bonuses do not pollute rebate detail tables.

## 5. Data model

### 5.1 Table `invite_rebates`

File: `model/invite_rebate.go`  
Register in `model/main.go` `AutoMigrate` list (one line).

| Column | Type | Notes |
|--------|------|-------|
| `id` | int PK AI | |
| `inviter_id` | int, index | Inviter user id |
| `invitee_id` | int, index | Top-up user id |
| `topup_id` | int, **unique** | `topups.id`; idempotency key |
| `trade_no` | varchar(255), index | Denormalized for support queries |
| `topup_quota` | int | Credited quota used as base |
| `rebate_quota` | int | Granted amount |
| `ratio_bp` | int | Snapshot of ratio at grant time (100 = 1%) |
| `status` | varchar(32) | `granted` = rebate credited; `skipped` = examined but no rebate (see below) |
| `created_at` | int64 | Unix seconds |

No “withdrawn” flag on the row: extraction remains global via `aff_quota`.

**Statuses:**

| Status | Meaning |
|--------|---------|
| `granted` | Rebate calculated and credited to inviter's `aff_quota` |
| `skipped` | Permanent skip — top-up was examined but no rebate issued (e.g. rebate floors to 0 for tiny top-ups, inviter not found, user_id mismatch). Row serves as a marker so backfill does not re-process. |

### 5.2 Options

| Key | Default | Meaning |
|-----|---------|---------|
| `InviteTopupRebateEnabled` | `false` | Master switch |
| `InviteTopupRebateRatioBp` | `100` | Basis points; 100 = 1.00%, 1 = 0.01% |

Storage pattern matches existing options (`common` vars + `model/option.go` init/update cases).

### 5.3 Formula

```text
rebate = topup_quota * ratio_bp / 10000   // integer division
```

- `rebate <= 0` → no ledger row, no balance change  
- Missing/zero `inviter_id` → skip  
- Disabled → skip  
- Duplicate `topup_id` insert → treat as already granted (success / no-op)

### 5.4 Grant helper

```text
GrantInviteTopupRebate(tx?, inviteeId, topupQuota, topUp):
  if !enabled || topupQuota <= 0: return nil
  load invitee.inviter_id; if 0: return nil
  rebate = floor(topupQuota * ratio_bp / 10000); if <= 0: return nil
  insert invite_rebates unique(topup_id)
  if duplicate: return nil
  update inviter aff_quota, aff_history_quota += rebate
  RecordLog(inviter, system, "邀请充值返佣 ...")
```

**Transaction preference:** call inside the same DB transaction as top-up completion when the path already uses a transaction. If a path must call outside the transaction, unique constraint still prevents double pay; failure after user credit must log loudly and never roll back the user’s successful top-up.

## 6. Payment hooks (minimal upstream touch)

Call after credited quota is known and top-up is marked success:

| Path | Location |
|------|----------|
| Stripe | `model.Recharge` |
| Creem | `model.RechargeCreem` |
| Waffo | `model.RechargeWaffo` |
| Waffo Pancake | `model.RechargeWaffoPancake` |
| Admin complete | `model.ManualCompleteTopUp` |
| Epay | success branch in `controller/topup.go` |

**Quota base** must be the same integer amount actually added to the invitee’s `quota` on that path (not raw pay currency when they diverge).

Do **not** alter `TopUp` schema.

## 7. API

New controller file: `controller/invite_rebate.go`  
Routes in `router/api-router.go` only.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/user/invite_rebate/summary` | User | My totals: invitee count, sum topup_quota, sum rebate_quota, current aff_quota / aff_history |
| GET | `/api/user/invite_rebate/logs` | User | Paginated my rebate rows (invitee display name masked/safe, trade_no, quotas, time) |
| GET | `/api/user/invite_rebate/invitees` | User | Invitees with per-user top-up and rebate aggregates |
| GET | `/api/invite_rebate/` | Admin | Global ledger; filter inviter_id, invitee_id, time range; paginate |
| GET | `/api/invite_rebate/summary` | Admin | Global or per-inviter aggregates |

Transfer remains:

- `POST /api/user/aff_transfer` (unchanged)

## 8. Frontend

### 8.1 default theme (`web/default`)

- New feature module: `src/features/invite-rebate/` (api, hooks, components, page)
- User route: `/_authenticated/invite-rebate/` with sidebar entry near wallet
- Admin audit page under authenticated admin navigation (users/operations area)
- Settings: add enable + ratio fields next to existing invite quota settings (general/billing credit limits), without restructuring settings architecture
- Optional one-line link on existing wallet affiliate card → new page (single line; no card rewrite)

### 8.2 classic theme (`web/classic`)

- New `src/pages/InviteRebate/` + route registration
- Admin list page parallel to default
- Settings fields on Operation / credit-limit style form (append fields only)

### 8.3 User page content

1. Summary cards: invitees, invitee credited top-up total, rebate total, pending `aff_quota`
2. Extract action → existing transfer dialog/API
3. Tables: rebate logs + invitee breakdown

### 8.4 Admin page content

- Filters + paginated ledger + summary numbers  
- No file export in v1

## 9. Error handling and edge cases

| Case | Behavior |
|------|----------|
| Feature disabled | No grant; historical ledger readable |
| Ratio set to 0 | No new grants |
| Inviter deleted / missing | Skip grant; log if unexpected |
| Self-invite impossible | Only grant when `inviter_id` points to another user |
| Webhook retry | Unique `topup_id` prevents double rebate |
| Grant fails after user credited | Log error; do not reverse top-up; operator can investigate ledger gap |
| Tiny top-up floors to 0 | `skipped` row recorded so backfill advances past it |

## 10. Testing (implementation phase)

- Unit: formula, disabled, no inviter, zero rebate, duplicate topup_id idempotent
- Path smoke if existing style allows: one successful top-up → one rebate row + inviter aff increase

## 11. Merge checklist for implementers

When coding, maximize isolation:

- [ ] Business logic only in `model/invite_rebate.go` (+ tests beside it if needed)
- [ ] HTTP only in `controller/invite_rebate.go`
- [ ] Upstream edits limited to: AutoMigrate line, option cases, router lines, one helper call per recharge path, small settings field additions
- [ ] Frontends as new feature/page folders
- [ ] Defaults leave production behavior unchanged until enabled

## 12. Decisions log

| Decision | Choice | Why |
|----------|--------|-----|
| Approach | Independent ledger + grant hook | Audit + idempotency; merge-friendly |
| Credit target | Existing `aff_quota` | Reuse transfer UX; smaller change set |
| Base amount | Credited quota | Matches in-app balance language |
| Timing | On top-up success | Real-time; operator expectation |
| Ratio | Admin option in basis points | Configurable without deploy; integer-safe |
| UI surfaces | User + admin; default + classic | Requested full coverage with isolated pages |
| Default enabled | false | Safe after upstream merge |

## 13. Implementation plan handoff

Next step after user reviews this file: invoke writing-plans and produce a step-by-step implementation plan under `docs/superpowers/plans/`.
