# Critique — Channel Preparation Auto-Promotion Plan (V1)

**Scope:** Reviews `docs/plans/channel-preparation-auto-promotion-2026-06-02.md` against the context_builder export `prompt-exports/oracle-plan-2026-06-02-181619-auto-promotion-plan-e516.md`. Verdict: solid and executable; the issues below are gaps an implementer would otherwise guess at. The `promoteChannelPreparation` reuse + "reset cache once per run" claim was spot-checked against `controller/channel_preparation.go:249-346` and is **correct** (per-call tx, cache reset only in handlers) — not a contradiction.

## 1. Top 3 under-specified seams

1. **Cross-DB capacity aggregation by group token.** Item 2 says "reuse or mirror existing exact comma-delimited group filtering" (`controller/channel.go:53-109`), but that helper builds a *list* query; the capacity metric needs a `SUM(balance)`/`SUM(used_quota)` aggregate filtered to an exact token inside a comma-delimited `group` column. No SQL shape is given, and per CLAUDE.md Rule 2 this must work on SQLite/MySQL/PostgreSQL (`commonGroupCol`, no PG-only operators). Implementer will guess the aggregation query.
2. **Candidate selection over preparations.** The plan anchors to `model/ability.go:61-140` ("`weight + 10`"), but that path selects live *abilities*, not `ChannelPreparation` rows — it cannot be literally reused. Item 2 offers "or an equivalent deterministic testable helper" without specifying where the helper lives (model vs controller), the exact priority-tier-then-weighted algorithm, or the randomness-injection seam for tests. Pure guesswork as written.
3. **Concurrency contract.** Item 3 says a process-local mutex "returns an in-progress response rather than overlapping," but doesn't specify: where the mutex lives, the manual endpoint's busy response (HTTP 409 vs 200-with-status — Item 5 frontend needs this), or how a scheduler tick behaves when a manual run holds the lock (skip vs block).

## 2. Specificity balance (plan vs. export)

- **Over-specified, should be the impl agent's call:** UI layout ("above or near the action toolbar without covering table content"); the verbatim option-key strings and full Go struct field list; `MaxPromotionsPerRun *int` *per-rule* on top of the global cap — extra config surface with no V1 need (see §3).
- **Useful export framing dropped:** the export gave the capacity metric explicit *assumptions/failure cases* and a dedicated **Risks & migration** section; the plan compresses this to "Open Questions: None," which is over-confident given the metric reversal below. Worth restoring a 3-line risk note (stale balance, conservative metric, multi-node overshoot).
- **Reversal worth flagging:** the export recommended `balance_usd` and argued subtracting `UsedQuota` "risks double-counting after balance refresh." The plan defaults to `balance_minus_used_quota_usd` — and its own Background calls `balance` the provider *remaining* amount, making the subtraction internally tense. Keeping the metric an enum is good; the default choice deserves the export's caveat carried forward, not deleted.

## 3. Contradictions / missing dependencies

- **Global vs per-rule promotion limit precedence is undefined.** Item 1 has `MaxPromotionsPerRun` (global) and a per-rule `*int`; Item 3 says "run/rule limits" but never states whether the global cap is a per-run total across all rules or a per-rule fallback. Directly governs Item 3 control flow.
- **Permission split.** Manual trigger is `AdminAuth`; rule config persists via root-only `/api/option/`. The plan flags this but leaves the resulting UX (admins can *run* but not *see/configure* rules) unresolved — Item 5 needs a decision on gating the panel vs. graceful degradation.
- Item 6's per-candidate "capacity before/after" logging requires the run service (Item 3) to track capacity at candidate granularity; Item 3 only commits to per-*rule* initial/final. Make Item 3 expose per-step deltas or downgrade Item 6's logging granularity.

## 4. Over-planning to cut/simplify

- Per-rule `MaxPromotionsPerRun` (§3) — drop for V1; the global cap suffices.
- The `capacity_metric` future-migration narrative and "future strategy table" framing — keep the enum field, cut the prose; it's speculative for a V1 with one supported value each.
- Item 7's "concurrency tests cover double promotion attempts against the same candidate" — a full concurrency harness is heavy; the conditional `pending->promoting` update (`channel_preparation.go:261-273`) already guarantees this. Reduce to one focused test asserting `RowsAffected==0` on the second attempt.

## 5. Questions that would change implementation order

1. **Is `balance_minus_used_quota_usd` the final V1 metric, or `balance_usd`?** If the simpler metric wins, Item 2's quota conversion (`common.QuotaPerUnit`) and parts of Item 7 disappear and Item 2 shrinks.
2. **Is the hard-delete-on-promote invariant truly fixed?** The plan reverses the export's "promoted audit row" recommendation and therefore *deletes* the export's Item 6 (prep status visibility). If the user later wants audit rows, that frontend status-filter work returns and reorders Items 5–7.
3. **Do rules live on the prep-pool page (plan) or in monitoring settings (export left open)?** Monitoring settings would reuse existing save/load plumbing and let the settings work proceed independently of the prep-pool UI, changing Item 5's sequencing.
4. **Is multi-node overshoot acceptable?** If not, a Redis/distributed lock becomes a prerequisite for Items 3–4 rather than a deferred risk.
