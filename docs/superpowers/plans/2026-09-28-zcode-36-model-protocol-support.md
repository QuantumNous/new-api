# ZCode 36-Model Protocol Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every identifier in the approved 36-model ZCode manifest genuinely callable through Chat, Responses, and Messages without satisfying a request through the generic `gpt-5.6` or `gpt-6` aliases.

**Architecture:** Preserve the selected physical GPT identifiers in the existing model-normalization policy, then build a fail-closed admission planner from authenticated upstream inventories, audited pricing, channel route declarations, and model abilities. Apply only evidence-backed channel/model changes, and verify requested, mapped, selected, upstream, and returned identities across a 108-profile matrix.

**Tech Stack:** Python 3 standard library and `unittest`, NewAPI management API, PostgreSQL snapshots, Advanced Custom route configuration, Go endpoint metadata tests, existing all-model E2E harness, SHA-256 evidence.

---

## Execution Dependency

Complete `2026-09-28-zcode-36-model-visibility.md` first.

Local source work and disposable-candidate verification may proceed after that.
Production/v100s/SSH access, push, workflow dispatch, image publication, and
deployment remain blocked until the existing Task 9 gate and its independent
specification and quality reviews pass.

## File Structure

- Reuse `tools/ops/zcode_text_models.py`: the only target-model source.
- Modify `tools/ops/model_alias_normalization.py`: preserve the approved
  physical GPT identifiers instead of collapsing them to generic aliases.
- Modify `tools/ops/test_model_alias_normalization.py`: physical-name and
  manifest tests.
- Modify `tools/ops/verify_model_alias_normalization.py`: verify required
  physical identifiers and reject generic GPT aliases.
- Modify `tools/ops/test_verify_model_alias_normalization.py`: verifier tests.
- Create `tools/ops/physical_model_protocol_admission.py`: upstream evidence
  normalization, capability coverage, deterministic channel plan, pricing
  gate, apply/rollback, and redacted manifest.
- Create `tools/ops/test_physical_model_protocol_admission.py`: unit and
  failure-injection tests.
- Create `tools/ops/verify_physical_model_protocols.py`: exact 36-by-3
  protocol matrix runner and identity/accounting validator.
- Create `tools/ops/test_verify_physical_model_protocols.py`: harness contract
  and semantic validator tests.
- Modify `model/pricing_endpoint_test.go` only if RED shows endpoint metadata
  does not reflect the configured physical model abilities.
- Modify `service/rc40_routing_compat_test.go` only if RED shows an existing
  registered conversion is incorrectly excluded.
- Write runtime evidence under
  `/Users/bytedance/newapi/reports/zcode-36-model-protocol-support-20260928/`.

### Task 1: Preserve The Approved Physical Identifiers

**Files:**

- Modify: `tools/ops/model_alias_normalization.py`
- Modify: `tools/ops/test_model_alias_normalization.py`
- Modify: `tools/ops/verify_model_alias_normalization.py`
- Modify: `tools/ops/test_verify_model_alias_normalization.py`

- [ ] **Step 1: Replace alias expectations with failing physical-ID tests**

Add:

```python
from zcode_text_models import MODEL_IDS


class PhysicalIdentifierPolicyTest(unittest.TestCase):
    def test_approved_gpt_variants_are_not_collapsed(self) -> None:
        physical = (
            "gpt-5.6-luna",
            "gpt-5.6-sol",
            "gpt-5.6-terra",
            "gpt-6-astra",
            "gpt-6-luna",
            "gpt-6-sol",
        )
        for model in physical:
            with self.subTest(model=model):
                self.assertEqual(migration.canonical_alias(model), model)

    def test_target_manifest_excludes_generic_gpt_aliases(self) -> None:
        self.assertEqual(len(MODEL_IDS), 36)
        self.assertNotIn("gpt-5.6", MODEL_IDS)
        self.assertNotIn("gpt-6", MODEL_IDS)
```

Update verifier tests so:

```python
verify.verify_public_models(set(MODEL_IDS), {"hidden_concrete_models": []})

with self.assertRaisesRegex(RuntimeError, "generic GPT aliases"):
    verify.verify_public_models(
        set(MODEL_IDS) | {"gpt-5.6", "gpt-6"},
        {"hidden_concrete_models": []},
    )
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
cd /Users/bytedance/newapi/.worktrees/rc40-compat-20260924/new-api/tools/ops
python3 -m unittest \
  test_model_alias_normalization.PhysicalIdentifierPolicyTest \
  test_verify_model_alias_normalization -v
```

Expected: the current special-alias map collapses `gpt-5.6-*` and
`gpt-6-astra`, so the new assertions fail.

- [ ] **Step 3: Implement the physical-ID exception**

Import `MODEL_IDS` and add:

```python
PRESERVED_PUBLIC_MODELS = frozenset(MODEL_IDS)
GENERIC_GPT_ALIASES = frozenset({"gpt-5.6", "gpt-6"})


def canonical_alias(model: str) -> str:
    if model in PRESERVED_PUBLIC_MODELS:
        return model
    if model in SPECIAL_ALIASES:
        return SPECIAL_ALIASES[model]
    # Existing normalization rules continue unchanged below.
```

Remove the `gpt-5.6-*` and `gpt-6-astra` entries from `SPECIAL_ALIASES`.
When `build_manifest` computes hidden concrete models, subtract
`PRESERVED_PUBLIC_MODELS`. In the verifier, require every `MODEL_IDS` entry
and reject either generic GPT alias:

```python
missing = set(MODEL_IDS) - public_models
generic = GENERIC_GPT_ALIASES & public_models
if missing:
    raise RuntimeError("required physical models missing: " + ",".join(sorted(missing)))
if generic:
    raise RuntimeError("generic GPT aliases exposed: " + ",".join(sorted(generic)))
```

- [ ] **Step 4: Run all alias tool tests**

Run:

```bash
cd /Users/bytedance/newapi/.worktrees/rc40-compat-20260924/new-api/tools/ops
python3 -m unittest \
  test_model_alias_normalization.py \
  test_verify_model_alias_normalization.py -v
```

Expected: all tests pass with the new physical-ID contract.

- [ ] **Step 5: Commit the identifier policy**

```bash
git add \
  tools/ops/model_alias_normalization.py \
  tools/ops/test_model_alias_normalization.py \
  tools/ops/verify_model_alias_normalization.py \
  tools/ops/test_verify_model_alias_normalization.py
git commit -m "feat(ops): preserve zcode physical model identifiers"
```

### Task 2: Build A Fail-Closed Capability Evidence Model

**Files:**

- Create: `tools/ops/physical_model_protocol_admission.py`
- Create: `tools/ops/test_physical_model_protocol_admission.py`

- [ ] **Step 1: Write failing evidence-normalization tests**

```python
import unittest

import physical_model_protocol_admission as admission
from zcode_text_models import MODEL_IDS


class CoverageTest(unittest.TestCase):
    def test_requires_exact_upstream_identity_and_three_protocols(self) -> None:
        state = {
            "channels": [{
                "id": 92,
                "status": 1,
                "group": "default,cxy",
                "models": "gpt-5.6-sol",
                "model_mapping": "{}",
                "routes": [
                    {"incoming_path": "/v1/chat/completions", "converter": "none"},
                    {"incoming_path": "/v1/responses", "converter": "openai_responses_to_openai_chat_completions"},
                ],
            }],
            "upstream_models": {"92": ["gpt-5.6-sol"]},
            "priced_models": ["gpt-5.6-sol"],
        }
        coverage = admission.build_coverage(state, ("gpt-5.6-sol",))
        self.assertEqual(coverage["gpt-5.6-sol"]["chat"]["status"], "ready")
        self.assertEqual(coverage["gpt-5.6-sol"]["responses"]["status"], "ready")
        self.assertEqual(coverage["gpt-5.6-sol"]["messages"]["status"], "blocked")

    def test_sibling_model_cannot_satisfy_physical_identity(self) -> None:
        state = {
            "channels": [{
                "id": 92,
                "status": 1,
                "group": "default",
                "models": "gpt-5.6-luna",
                "model_mapping": '{"gpt-5.6-luna":"gpt-5.6-sol"}',
                "routes": [{"incoming_path": "/v1/chat/completions", "converter": "none"}],
            }],
            "upstream_models": {"92": ["gpt-5.6-sol"]},
            "priced_models": ["gpt-5.6-luna"],
        }
        coverage = admission.build_coverage(state, ("gpt-5.6-luna",))
        self.assertEqual(
            coverage["gpt-5.6-luna"]["chat"]["status"],
            "identity_mismatch",
        )

    def test_complete_manifest_has_108_cells(self) -> None:
        matrix = admission.empty_matrix(MODEL_IDS)
        self.assertEqual(sum(len(protocols) for protocols in matrix.values()), 108)
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
cd /Users/bytedance/newapi/.worktrees/rc40-compat-20260924/new-api/tools/ops
python3 -m unittest test_physical_model_protocol_admission.CoverageTest -v
```

Expected: import or missing-function failures.

- [ ] **Step 3: Implement normalized capability records**

Implement these constants and interfaces:

```python
PROTOCOL_PATHS = {
    "chat": "/v1/chat/completions",
    "responses": "/v1/responses",
    "messages": "/v1/messages",
}


def empty_matrix(models: tuple[str, ...]) -> dict[str, dict[str, object]]:
    return {
        model: {
            protocol: {"status": "blocked", "candidates": []}
            for protocol in PROTOCOL_PATHS
        }
        for model in models
    }


def build_coverage(
    state: dict[str, object],
    models: tuple[str, ...] = MODEL_IDS,
) -> dict[str, dict[str, object]]:
    matrix = empty_matrix(models)
    # Accept only enabled public channels with a declared incoming route.
    # Require the requested physical ID in that channel's authenticated
    # upstream inventory. Reject mappings to a different sibling ID.
    # Require an audited pricing entry for the same physical ID.
    return matrix
```

Each ready cell must record only `channel_id`, `incoming_path`,
`upstream_path`, `converter`, and exact `upstream_model`. Secret-bearing
fields are rejected recursively before report serialization.

- [ ] **Step 4: Run the coverage tests and verify GREEN**

Run the command from Step 2.

Expected: all coverage tests pass.

- [ ] **Step 5: Commit the evidence model**

```bash
git add \
  tools/ops/physical_model_protocol_admission.py \
  tools/ops/test_physical_model_protocol_admission.py
git commit -m "feat(ops): model physical protocol admission"
```

### Task 3: Generate An Idempotent Channel And Pricing Plan

**Files:**

- Modify: `tools/ops/physical_model_protocol_admission.py`
- Modify: `tools/ops/test_physical_model_protocol_admission.py`

- [ ] **Step 1: Add failing plan tests**

Cover these exact cases:

```python
def test_plan_adds_only_exact_upstream_models(self) -> None:
    plan = admission.build_plan(self.complete_state)
    change = next(item for item in plan["channel_changes"] if item["channel_id"] == 92)
    self.assertIn("gpt-5.6-sol", change["models"])
    self.assertNotIn("gpt-5.6", change["models"])
    self.assertNotIn("gpt-6", change["models"])


def test_missing_upstream_or_price_blocks_before_mutation(self) -> None:
    state = copy.deepcopy(self.complete_state)
    state["upstream_models"]["92"].remove("gpt-5.6-luna")
    plan = admission.build_plan(state)
    self.assertFalse(plan["applicable"])
    self.assertIn(
        {"model": "gpt-5.6-luna", "reason": "no_exact_upstream"},
        plan["blockers"],
    )
    self.assertEqual(plan["sql"], [])


def test_reapply_is_noop_and_rollback_restores_projection(self) -> None:
    applied = admission.apply_plan(self.complete_state, admission.build_plan(self.complete_state))
    self.assertEqual(admission.build_plan(applied)["channel_changes"], [])
    self.assertEqual(
        admission.rollback_projection(applied),
        admission.canonical_projection(self.complete_state),
    )
```

- [ ] **Step 2: Run the plan tests and verify RED**

Run:

```bash
cd /Users/bytedance/newapi/.worktrees/rc40-compat-20260924/new-api/tools/ops
python3 -m unittest test_physical_model_protocol_admission.ChannelPlanTest -v
```

Expected: failures for missing plan/apply/rollback functions.

- [ ] **Step 3: Implement deterministic planning**

`build_plan` must:

1. Validate all 36 model names and all 108 matrix cells.
2. Rank native routes before registered conversions.
3. Select only channels whose authenticated upstream inventory contains the
   exact target model.
4. Add the exact physical model to selected channel model lists and
   route-model filters.
5. Remove `gpt-5.6` and `gpt-6` from selected public channels only after all
   six physical replacements have complete three-protocol coverage.
6. Copy pricing only from an audited entry for the same exact identifier.
7. Produce no mutation SQL or API request bodies when any blocker exists.
8. Include before/after canonical projection hashes and rollback material.

Use structured objects, sorted model arrays, and `json.dumps(...,
sort_keys=True, separators=(",", ":"))`; do not assemble JSON with string
concatenation.

- [ ] **Step 4: Run plan, failure-injection, and secret-scan tests**

Run:

```bash
cd /Users/bytedance/newapi/.worktrees/rc40-compat-20260924/new-api/tools/ops
python3 -m unittest test_physical_model_protocol_admission.py -v
python3 -m py_compile physical_model_protocol_admission.py
```

Expected: all tests pass.

- [ ] **Step 5: Commit the planner**

```bash
git add \
  tools/ops/physical_model_protocol_admission.py \
  tools/ops/test_physical_model_protocol_admission.py
git commit -m "feat(ops): plan physical model protocol routes"
```

### Task 4: Verify Gateway Endpoint Metadata

**Files:**

- Modify if RED: `model/pricing_endpoint_test.go`
- Modify if RED: `model/pricing.go`
- Modify if RED: `service/rc40_routing_compat_test.go`
- Modify if RED: `service/conversion_capability.go`

- [ ] **Step 1: Add a failing configured-state endpoint test**

Add a table-driven test that creates an enabled ability for one physical model
on three Advanced Custom channels and asserts:

```go
require.ElementsMatch(t, []constant.EndpointType{
    constant.EndpointTypeOpenAI,
    constant.EndpointTypeOpenAIResponses,
    constant.EndpointTypeClaude,
}, GetModelSupportEndpointTypes("gpt-5.6-sol"))
```

Include one native Chat route, one Responses-to-Chat registered conversion,
and one Messages-to-Chat registered conversion. Add a negative case where a
route's `models` filter excludes `gpt-5.6-sol`.

- [ ] **Step 2: Run the endpoint test**

Run:

```bash
go test ./model -run 'Test.*PhysicalModel.*Endpoint' -count=1
```

Expected: PASS if current endpoint aggregation already honors exact physical
IDs and route filters. If it fails, retain the RED output and continue.

- [ ] **Step 3: Make the minimum source correction only if RED**

Keep endpoint derivation in `getPricingEndpointTypesForAbility`. The correction
may only make the configured physical ability and the matching
`AdvancedCustomConfig.SupportedEndpointTypesForModel` result visible; it must
not infer unsupported routes or canonicalize the physical model.

- [ ] **Step 4: Run focused and full affected Go tests**

Run:

```bash
go test ./model ./service -run 'PhysicalModel|Endpoint|ConversionCapability|RC40RoutingCompat' -count=1
go test ./model ./service -count=1
```

Expected: all tests pass.

- [ ] **Step 5: Commit only if source changed**

```bash
git add model/pricing.go model/pricing_endpoint_test.go service/conversion_capability.go service/rc40_routing_compat_test.go
git commit -m "fix(routing): expose physical model protocol capabilities"
```

If Step 2 passed without source changes, record that result and skip this
commit.

### Task 5: Build The Exact 108-Profile Verifier

**Files:**

- Create: `tools/ops/verify_physical_model_protocols.py`
- Create: `tools/ops/test_verify_physical_model_protocols.py`

- [ ] **Step 1: Write failing matrix and semantic-response tests**

```python
class MatrixContractTest(unittest.TestCase):
    def test_matrix_is_exactly_36_by_3(self) -> None:
        matrix = verify.build_profiles()
        self.assertEqual(len(matrix), 108)
        self.assertEqual(
            {(item["model"], item["protocol"]) for item in matrix},
            {
                (model, protocol)
                for model in MODEL_IDS
                for protocol in ("chat", "responses", "messages")
            },
        )

    def test_success_requires_protocol_text_and_identity(self) -> None:
        result = verify.validate_result(
            profile={"model": "gpt-6-sol", "protocol": "responses"},
            status=200,
            body={"output": [{"type": "message", "content": [{"type": "output_text", "text": "ok"}]}]},
            identity={
                "requested": "gpt-6-sol",
                "upstream": "gpt-6-sol",
                "returned": "gpt-6-sol",
            },
        )
        self.assertTrue(result["passed"])
```

Add negative cases for empty text, malformed Chat choices, malformed Messages
blocks, a generic returned GPT alias, missing selected-channel identity, and
an unknown-write outcome.

- [ ] **Step 2: Run verifier tests and verify RED**

Run:

```bash
cd /Users/bytedance/newapi/.worktrees/rc40-compat-20260924/new-api/tools/ops
python3 -m unittest test_verify_physical_model_protocols.py -v
```

Expected: import or missing-function failures.

- [ ] **Step 3: Implement request and validation contracts**

`build_profiles()` must generate:

```python
{
    "chat": {
        "path": "/v1/chat/completions",
        "payload": lambda model: {
            "model": model,
            "messages": [{"role": "user", "content": "Reply exactly OK"}],
            "stream": False,
            "max_tokens": 32,
        },
    },
    "responses": {
        "path": "/v1/responses",
        "payload": lambda model: {
            "model": model,
            "input": "Reply exactly OK",
            "stream": False,
            "max_output_tokens": 32,
        },
    },
    "messages": {
        "path": "/v1/messages",
        "payload": lambda model: {
            "model": model,
            "messages": [{"role": "user", "content": "Reply exactly OK"}],
            "stream": False,
            "max_tokens": 32,
        },
    },
}
```

The runner must make one attempt per profile, set gateway retry count to zero,
stop the current and later rounds on unknown write, require non-empty semantic
text, and record requested, mapped, selected-channel, upstream, and returned
model identities separately. Reports must contain hashes and sanitized
metadata, not raw prompt/response bodies or credentials.

- [ ] **Step 4: Run all verifier tests**

Run:

```bash
cd /Users/bytedance/newapi/.worktrees/rc40-compat-20260924/new-api/tools/ops
python3 -m unittest test_verify_physical_model_protocols.py -v
python3 -m py_compile verify_physical_model_protocols.py
```

Expected: all tests pass.

- [ ] **Step 5: Commit the verifier**

```bash
git add \
  tools/ops/verify_physical_model_protocols.py \
  tools/ops/test_verify_physical_model_protocols.py
git commit -m "test(ops): verify physical models across three protocols"
```

### Task 6: Run Fail-Closed Admission Against A Disposable Candidate

**Files:**

- Create:
  `/Users/bytedance/newapi/reports/zcode-36-model-protocol-support-20260928/preflight.json`
- Create:
  `/Users/bytedance/newapi/reports/zcode-36-model-protocol-support-20260928/plan.json`
- Create:
  `/Users/bytedance/newapi/reports/zcode-36-model-protocol-support-20260928/candidate-readback.json`

- [ ] **Step 1: Build a fresh candidate from the final Task 9 source**

Use the existing Task 9 candidate construction procedure after its working
tree is clean and reviewed. Record source SHA, image ID, configuration input
hashes, and zero disposable resources before startup.

- [ ] **Step 2: Collect authenticated upstream inventories once**

For each enabled credential-bearing candidate channel, query its model-list
endpoint once through the existing management path. Persist only channel ID,
HTTP status, returned model identifiers, and response hash. Never persist
authorization values or full headers.

- [ ] **Step 3: Generate the admission preflight**

```bash
python3 tools/ops/physical_model_protocol_admission.py \
  --manifest tools/ops/zcode_text_models.py \
  --state /Users/bytedance/newapi/reports/zcode-36-model-protocol-support-20260928/candidate-input.json \
  --output /Users/bytedance/newapi/reports/zcode-36-model-protocol-support-20260928/preflight.json
```

Expected: either `applicable=true` with 108 ready cells and no blockers, or a
fail-closed blocker list naming exact model/protocol/reason. Do not apply a
partial plan.

- [ ] **Step 4: Stop if an exact physical model lacks authority**

If any target lacks an exact upstream identifier, audited price, or valid
route, record the blocker and stop Phase 2. Do not map it to a sibling model,
remove it, or make any provider request for it.

- [ ] **Step 5: Apply, no-op reapply, rollback, and final reapply**

When preflight is clean, apply the generated plan to the disposable candidate,
verify exact database/API model sets and 108 endpoint cells, run a no-op
reapply, execute exact rollback and byte-equivalent projection verification,
then perform the final reapply.

- [ ] **Step 6: Clean candidate resources on any stop**

Remove candidate containers, networks, volumes, temporary tokens, database
locks, and listeners. Record zero residual resources and reconciled
reservation/accounting state.

### Task 7: Execute Canary And Three-Round Verification

**Files:**

- Create:
  `/Users/bytedance/newapi/reports/zcode-36-model-protocol-support-20260928/canaries/`
- Create:
  `/Users/bytedance/newapi/reports/zcode-36-model-protocol-support-20260928/round-1.json`
- Create:
  `/Users/bytedance/newapi/reports/zcode-36-model-protocol-support-20260928/round-2.json`
- Create:
  `/Users/bytedance/newapi/reports/zcode-36-model-protocol-support-20260928/round-3.json`

- [ ] **Step 1: Run one-attempt physical-model canaries**

Run one pinned Chat, Responses, and Messages request for every newly admitted
identifier. Require exact upstream identity and non-empty semantic text.
Stop on the first unknown write or identity mismatch.

- [ ] **Step 2: Run the complete matrix once**

```bash
python3 tools/ops/verify_physical_model_protocols.py \
  --base-url http://127.0.0.1:13000 \
  --round 1 \
  --output /Users/bytedance/newapi/reports/zcode-36-model-protocol-support-20260928/round-1.json
```

Expected: `108/108` profiles pass with zero automatic retries and zero
unknown writes.

- [ ] **Step 3: Run rounds two and three without changing inventory**

Repeat with `--round 2` and `--round 3`. Require identical model-set and
profile-matrix hashes in all three reports.

- [ ] **Step 4: Reconcile accounting and clean resources**

Require successful-request count, consume logs, wallet/subscription deltas,
reservations, and task rows to reconcile exactly. Delete temporary tokens and
all disposable candidate resources.

- [ ] **Step 5: Run source regression suites**

```bash
cd /Users/bytedance/newapi/.worktrees/rc40-compat-20260924/new-api
python3 -m unittest discover -s tools/ops -p 'test_*model*.py' -v
go test ./model ./service -count=1
go test ./relaykit/... -count=1
git diff --check
```

Expected: all commands pass.

### Task 8: Review And Production Gate

**Files:**

- Create:
  `/Users/bytedance/newapi/reports/zcode-36-model-protocol-support-20260928/FINAL-MANIFEST.md`
- Modify: `/Users/bytedance/newapi/docs/mvp/handoff.md`

- [ ] **Step 1: Complete self-review**

Verify the final diff contains only the declared source/test files, all reports
are redacted, all three rounds use the same hashes, and no unrelated dirty
file is staged.

- [ ] **Step 2: Run independent specification review**

Require explicit approval that the exact 36 identifiers, three protocols,
physical identity constraints, and Phase 1-before-Phase 2 sequence are met.

- [ ] **Step 3: Run independent code-quality review**

Require zero Critical or Important findings in synchronizer, planner,
transaction, validator, and rollback behavior.

- [ ] **Step 4: Enforce the existing Task 9 boundary**

Do not access v100s or production while Task 9 is incomplete or either review
is unapproved. Record the local candidate result and leave production
unchanged.

- [ ] **Step 5: Apply to production only after the gate opens**

After Task 9 approval, take the required database/config/image backups and
SHA-256 evidence, run the production dry-run, apply once, perform one-attempt
canaries, run three complete 108-profile rounds, and verify ZCode Desktop and
CLI. Stop without retry on any unknown write.

- [ ] **Step 6: Seal the final evidence**

Write the final source SHA, immutable image digest, exact 36-model hash,
108-profile hash, three round summaries, backup hashes, rollback proof,
accounting reconciliation, and cleanup proof to `FINAL-MANIFEST.md`. Update
the handoff with the review verdict and production status.
