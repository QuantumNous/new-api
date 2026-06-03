# Critique — Usage Log Excel Export Plan (2026-06-03)

**Scope reviewed:** `docs/plans/usage-log-excel-export-2026-06-03.md` vs. its source export
`prompt-exports/oracle-plan-2026-06-03-161456-usage-log-export-0ab-8658.md`. Per request, this
covers only the five axes below; no scope expansion.

## 1. Top 3 under-specified seams (implementer would guess)

1. **Item 2 refactor boundary + total-count path.** "Extract reusable query builders" from
   `model/log.go:328-480`, `model/midjourney.go`, `model/task.go` never says *what shape* to extract
   (shared `applyFilters(db, params)` vs. a new `num=-1` flag vs. a parallel function). Worse, the
   100000-row cap needs a total count, but the only documented count path (`GetUserLogs`) wraps
   `Count` in `Limit(logSearchCountLimit)` = 10000 (`model/log.go:415,446`). The plan never says how
   export obtains an accurate total above 10000. An implementer must invent the counting strategy.
2. **Drawing/task filter-param contract.** Background pins the *common* param mapping precisely
   (`buildApiParams`, `utils.ts:170-249`; `controller/log.go:13-55`) but gives **no** equivalent for
   drawing/task — `buildBaseParams` and the midjourney/task controllers are named only in Item 6's
   "Done when," with no file:line and no field list. Yet Items 2-4 require those exact params. The
   export's `<architecture>` *did* carry this (GetAllTasks/GetAllUserTask, tasksToDto, ms-vs-s
   timestamps); the plan dropped it, leaving two of three categories under-specified.
3. **Default-selection vs. live column visibility.** Plan says defaults "mirror current table
   columns," but `view-options.tsx:55-73` visibility is client state while `default_selected` is
   backend-owned. Nobody is assigned to reconcile a user's toggled-off columns with the backend
   schema, nor is the column-id ↔ backend `key` mapping defined. Implementer guesses the source of truth.

## 2. Specificity balance (over-spec vs. dropped framing)

- **Dropped useful framing:** the export listed concrete export-only field candidates per category
  (e.g. common `request_id`/`upstream_request_id`/`other_json` admin-only; drawing `finish_time`/
  `video_url`/`raw_status`; task `result_url`/`data_json`). The plan deleted all of these and deferred
  to "Item 1 评审." Re-attaching them as a non-binding starter list would save the implementer a
  rediscovery pass. (Conversely, the plan *added* value the export lacked: file:line anchors, the
  `logGroupCol` DB-compat note, the `logSearchCountLimit` note, the cost-stats critique reference.)
- **Over-specifies tactical choices the agent should own:** prescribing a 4-file service split
  (`export.go`/`common.go`/`drawing.go`/`task.go`), the exact prop name `extraActions?: ReactNode`,
  and batch size "1000" are implementation details, not plan-level decisions. One service file and a
  free-hand batch size are fine to leave open.

## 3. Contradictions / missing dependencies

- **Count cap contradiction** (see seam 1): 10000 self-count limit vs. 100000 export cap is unresolved.
- **Timezone has no frontend owner.** Backend accepts `timezone` (Approach §API contract), but Item 6's
  "Done when" never lists sending the browser tz, and no item sources it. Cross-item gap.
- **Spurious dependency:** Item 2 (query builders) "Dependencies: Item 1 (field schemas)" — these are
  independent; query extraction does not need the schema. The false edge forces serial work.

## 4. Over-planning to cut/simplify

- **Six `export_fields` endpoints** (per category × admin/self). Validation only needs one schema
  source; collapse to `/api/log/export_fields?category=&scope=` (or even ship schema client-side with
  server-side key validation) — drops endpoint count by ~half.
- **Item 7 "记忆用户上次选择" (localStorage persistence)** is V1 scope creep; cut it.
- **All-three-categories acceptance in V1** while the plan itself permits "按 category 分层交付" — the
  hard acceptance bar over-commits; see Q below.

## 5. Questions that would change implementation order

1. **Is V1 truly all three sections, or common-first?** Common-first shrinks Items 2-4 by ~2/3 and
   makes drawing/task a follow-up — the single biggest ordering lever. (Open Question already half-asks this.)
2. **Does a global export/row-limit config already exist?** (Plan's Open Question #2.) If yes, resolve
   before Item 1 — it removes the new-constant work and may reshape Item 3's cap.
3. **Must self export count/export beyond 10000?** Answer dictates whether a new count path must land in
   Item 2 *before* Item 3 — reorders the backend chain.
4. **Should defaults follow currently-visible columns?** If yes, the frontend must pass visible column
   ids, pulling the field-contract decision (Items 6-7) earlier than its current tail position.
