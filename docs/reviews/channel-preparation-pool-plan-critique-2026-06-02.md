# Plan Critique — Channel Preparation Pool (V1)

**Scope:** Critique of `docs/plans/channel-preparation-pool-2026-06-02.md` against its source `context_builder` export (`prompt-exports/oracle-plan-2026-06-02-115813-prep-pool-plan-02d74-0ac7.md`). Five focus areas only; no scope expansion.

## 1. Top 3 under-specified seams

1. **Item 2 shared-helper fork is unresolved (plan line 103).** Done-when offers an OR — share `single/batch/multi_to_single` semantics in one helper *or* limit promotion to single-record while sharing validation. This is the highest-risk decision (refactor live `AddChannel` at `controller/channel.go:586-691` vs. a parallel helper) and the plan punts it to the implementer. The export was decisive ("only single prep → single live channel; batch loops over records"). Pin this.
2. **Multi-key staging/promotion is promised but never specified.** Background elevates "account/key-level staging and channel-level promotion" to a *user decision* (lines 11, 19) and hints at `ChannelInfo`/multi-key metadata (line 40, ref `model/channel.go:22-76`), yet the model field list, the promotion algorithm, and Item 4 done-when (line 141) only cover single-record → single channel+abilities. Implementer must guess the schema and promotion path. Either explicitly cut multi-key from V1 or specify it.
3. **Key sanitization shape + edit-preserve rule undefined.** Plan says "key preview" (line 43) and "do not expose full keys" (Item 3, line 124) but never defines the preview format nor the PUT behavior. Export specified "first 8–12 chars + ellipsis" and "blank/missing key preserves stored key." Without the preserve rule, the edit endpoint (line 52) risks silently wiping stored keys. Pin both.

## 2. Specificity balance

- **Over-specified (agent should own):** Item 6 done-when hardcodes the entire column list and filter set as acceptance criteria (lines 184-186); Item 4/API shape bakes exact route strings (`batch/promote`). Fine as guidance, wrong as gating criteria.
- **Dropped useful framing vs. export:**
  - Status enum lost its numeric values + "promotable" matrix — keep at least the promotable mapping.
  - List response dropped `status_counts`/`type_counts` even though Item 6 filters by status and would want count badges.
  - Promotion concurrency guard compressed from export's explicit "row-lock / conditional status update, require `Status==pending`" down to a bare done-when assertion (line 143). Keep the mechanism hint.

## 3. Contradictions / missing dependencies

- **Item 2 dependency is mislabeled (line 112).** It lists "Item 1 for promotion consumers," but the live-channel creation helper only refactors `AddChannel` and never touches the prep model — it has no real dependency on Item 1 and can lead. This distorts the critical path.
- **Delete vs. archive inconsistency.** Item 3 route is "DELETE … or archive endpoint" (line 53) and done-when says "archive/delete" (line 121), but Item 6 row actions offer only "archive" (line 186). Unclear whether a hard delete exists; resolve to one.
- **Multi-key** (seam 2) is also a Background-vs-Work-Items contradiction.
- **Verified OK:** Item 4's `service/http_client.go` for cache reset is correct — `ResetProxyClientCache()` is defined there (`service/http_client.go:74`).

## 4. Over-planning to cut / simplify

- **Collapse UI Items 5/6/7** (shell S + table L + modals M). The shell-vs-table split forces artificial serialization for one classic page; merge to ≤2 items.
- **Trim Item 8:** drop the optional `docs/channel/channel-api.md` touch-up and the "if API documentation is updated…" clause (lines 239, 246) from V1 acceptance; keep only the routing-contract verification checklist.
- **Background provenance noise:** the "(reported by scout / seam probe)" tags (lines 17-25) and the References block (lines 258-267) duplicate the inline file:line refs — process artifacts that don't belong in a final plan.

## 5. Questions that change implementation order

1. **Is multi-key staging in V1 scope?** Yes → Item 1 schema gains `ChannelInfo`/multi-key metadata and Item 4 gains multi-key→channel logic; both grow and Item 1 must settle first. No → simplest path; pin it now.
2. **Refactor `AddChannel` vs. parallel helper (Item 2 fork)?** Refactor → Item 2 is a tested prerequisite on the live path, must land before Item 4, not parallelizable. Parallel helper → Item 2 is independent and can move late.
3. **Must promotion ship in the first deliverable?** Item 3 (CRUD/import) explicitly does *not* need Item 2 (line 132), so a storage-only MVP could ship first and defer Items 2+4 — reorders toward UI-early.
4. **Is default-frontend parity required in V1 (Open Q1)?** Yes → adds a parallel UI track and roughly doubles frontend scope; currently punted to classic-only.

*(Open Q2 — archive terminal vs. restore — does not affect order, per the plan itself; excluded.)*
