# Browser QA UI and Network Assertions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the closed Browser QA fixed-case DSL so AI exploration can promote deterministic UI-state and same-origin network-behavior candidates instead of returning `proposed_case: null`.

**Architecture:** Keep one fail-closed contract mirrored across the fixed-case JSON schema, model Structured Output schema, Python validator, and Node browser executor. UI assertions resolve only semantic locators. Network assertions observe only method and pathname after an explicit `begin_network_capture` boundary, ignore cross-origin traffic, and never retain headers, bodies, cookies, authorization, or query values.

**Tech Stack:** Python 3 standard library, Node.js built-in test runner, CommonJS, Playwright page/locator APIs, JSON Schema, GitHub Actions, Google Cloud Run Jobs, GCS.

---

## File Structure

- `scripts/browser_qa/config/fixed_case.schema.json` — authoritative stored fixed-case JSON contract.
- `scripts/browser_qa/config/result.schema.json` — Codex Structured Output contract for nullable `proposed_case`.
- `scripts/browser_qa/config/qa-prompt.md` — tells the exploration model when and how to propose the new closed DSL.
- `scripts/browser_qa/flatkey_browser_qa/fixed_cases.py` — Python loader and semantic validator.
- `scripts/browser_qa/flatkey_browser_qa/browser_evidence_helper.cjs` — deterministic Playwright executor and bounded request tracker.
- `scripts/browser_qa/tests/test_fixed_cases.py` — Python/schema parity tests.
- `scripts/browser_qa/tests/test_report.py` — model-result schema and proposal validation tests.
- `scripts/browser_qa/tests/test_supervisor.py` — prompt contract tests.
- `scripts/browser_qa/tests/test_promotion.py` — fingerprint and candidate preservation tests.
- `scripts/browser_qa/flatkey_browser_qa/browser_evidence_helper.test.cjs` — UI/network execution and listener lifecycle tests.
- `docs/browser-qa/browser-qa-technical-implementation.html` — implementation and operator-facing behavior.
- `docs/browser-qa/ai-browser-testing-migration-guide.html` — portable DSL and migration guidance.

### Task 1: Lock the Python and stored-case DSL contract

**Files:**
- Modify: `scripts/browser_qa/tests/test_fixed_cases.py`
- Modify: `scripts/browser_qa/flatkey_browser_qa/fixed_cases.py`
- Modify: `scripts/browser_qa/config/fixed_case.schema.json`

- [ ] **Step 1: Write failing validator tests for all new actions and assertions**

Add a valid case containing:

```python
case["steps"].append({"begin_network_capture": {}})
case["assertions"] = [
    {"element_visible": {"locator": {"by": "text", "text": "API Keys"}}},
    {"element_hidden": {"locator": {"by": "text", "text": "创建成功"}}},
    {"element_enabled": {"locator": {"by": "role", "role": "button", "name": "创建 API Key"}}},
    {"element_disabled": {"locator": {"by": "role", "role": "button", "name": "提交"}}},
    {"element_value_equals": {"locator": {"by": "label", "label": "API Key 名称"}, "value": "demo"}},
    {"element_count_equals": {"locator": {"by": "test_id", "test_id": "api-key-row"}, "count": 1}},
    {"network_request_sent": {"method": "GET", "path": "/api/token/", "timeout_ms": 1500}},
    {"network_request_not_sent": {"method": "POST", "path": "/api/token/", "timeout_ms": 1500}},
]
```

Add rejection tests for unknown fields, two capture steps, network assertions without a capture step, method outside the closed enum, absolute/query/fragment paths, `count` outside `0..1000`, `timeout_ms` outside `0..5000`, booleans passed as integers, and secret-like strings.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
python -B -m unittest scripts.browser_qa.tests.test_fixed_cases -v
```

Expected: FAIL because `begin_network_capture` and the new assertions are rejected.

- [ ] **Step 3: Implement the minimal Python validation contract**

Extend the closed sets and dispatch logic:

```python
STEP_ACTIONS = {"navigate", "navigate_back", "click", "fill", "select", "wait_for", "begin_network_capture"}
ASSERTIONS = {
    "page_status_not", "url_not_contains",
    "element_visible", "element_hidden", "element_enabled", "element_disabled",
    "element_value_equals", "element_count_equals",
    "network_request_sent", "network_request_not_sent",
}
NETWORK_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE"}
MAX_ELEMENT_COUNT = 1000
MAX_NETWORK_TIMEOUT_MS = 5000
```

Add focused helpers for locator assertion payloads, value/count payloads, network payloads, and one semantic cross-field rule: a case using a network assertion has exactly one `begin_network_capture`; a case without network assertions has at most one.

- [ ] **Step 4: Mirror the same closed contract in `fixed_case.schema.json`**

Use only fixed object shapes and the existing relative-path pattern. `begin_network_capture` must require an empty object. Network methods use an enum; `count` and `timeout_ms` use integer bounds.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```powershell
python -B -m unittest scripts.browser_qa.tests.test_fixed_cases -v
python -m json.tool scripts/browser_qa/config/fixed_case.schema.json > $null
```

Expected: all fixed-case tests pass and JSON parsing exits 0.

- [ ] **Step 6: Commit only Task 1 files using the Lore protocol**

Intent: make stored cases express bounded UI and network behavior. Include `Constraint`, `Rejected`, `Confidence`, `Scope-risk`, `Directive`, `Tested`, and `Not-tested` trailers.

### Task 2: Extend model proposals and prompt safety

**Files:**
- Modify: `scripts/browser_qa/tests/test_report.py`
- Modify: `scripts/browser_qa/tests/test_supervisor.py`
- Modify: `scripts/browser_qa/config/result.schema.json`
- Modify: `scripts/browser_qa/config/qa-prompt.md`

- [ ] **Step 1: Write failing model-schema and prompt tests**

Assert that both finding and coverage `proposed_case` accept the same new shapes as the stored-case schema, reject extra/unsafe fields, and that the prompt contains these invariants:

```text
Prefer UI state assertions over submitting a potentially mutating form.
Network assertions require exactly one begin_network_capture step.
Only same-origin method plus relative pathname may be matched.
Never include headers, bodies, cookies, authorization, query strings, or fragments.
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
python -B -m unittest scripts.browser_qa.tests.test_report scripts.browser_qa.tests.test_supervisor -v
```

Expected: FAIL because Structured Output and prompt do not expose the new contract.

- [ ] **Step 3: Extend `result.schema.json` without leaving the Structured Outputs subset**

Add explicit `anyOf` branches for the new step/assertion objects. Keep `additionalProperties: false`, fixed required keys, enums, integer bounds, and existing relative path patterns. Do not add conditional JSON Schema keywords unsupported by the model surface; keep the cross-field capture rule in Python validation.

- [ ] **Step 4: Update the prompt with exact proposal rules**

Name every new action/assertion and state that `proposed_case` remains `null` when the observed behavior cannot be expressed safely. Explicitly forbid clicking a mutating submit action merely to manufacture a network assertion.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```powershell
python -B -m unittest scripts.browser_qa.tests.test_report scripts.browser_qa.tests.test_supervisor -v
python -m json.tool scripts/browser_qa/config/result.schema.json > $null
```

Expected: all tests pass and JSON parsing exits 0.

- [ ] **Step 6: Commit only Task 2 files using the Lore protocol**

Directive must preserve the Structured Outputs supported subset and nullable fail-closed fallback.

### Task 3: Implement deterministic UI assertions

**Files:**
- Modify: `scripts/browser_qa/flatkey_browser_qa/browser_evidence_helper.test.cjs`
- Modify: `scripts/browser_qa/flatkey_browser_qa/browser_evidence_helper.cjs`

- [ ] **Step 1: Write failing Node tests for all six UI assertions**

Use the existing fake page/locator harness and assert both passing and failing results for:

```javascript
element_visible
element_hidden
element_enabled
element_disabled
element_value_equals
element_count_equals
```

Verify exact semantic locator mapping and that rejected payloads fail before browser interaction.

- [ ] **Step 2: Run the Node test and verify RED**

Run:

```powershell
node --test scripts/browser_qa/flatkey_browser_qa/browser_evidence_helper.test.cjs
```

Expected: FAIL with unsupported fixed-case assertion.

- [ ] **Step 3: Implement minimal async assertion execution**

Change `_fixedCaseAssertionPassed` to async and dispatch UI assertions through `fixedCaseLocator`. Use Playwright locator methods only:

```javascript
await locator.isVisible()
await locator.isEnabled()
await locator.isDisabled()
await locator.inputValue()
await locator.count()
```

`element_hidden` passes when the exact semantic locator is absent or not visible. Any thrown browser error causes the assertion to fail through the existing structured failure path.

- [ ] **Step 4: Run Node tests and verify GREEN**

Run the same Node test command. Expected: all tests pass.

- [ ] **Step 5: Commit only Task 3 files using the Lore protocol**

Directive must forbid arbitrary selectors and JavaScript evaluation.

### Task 4: Implement bounded same-origin network assertions

**Files:**
- Modify: `scripts/browser_qa/flatkey_browser_qa/browser_evidence_helper.test.cjs`
- Modify: `scripts/browser_qa/flatkey_browser_qa/browser_evidence_helper.cjs`

- [ ] **Step 1: Write failing request-window tests**

Cover:

- requests before `begin_network_capture` are ignored;
- same-origin method and pathname match exactly;
- query values do not participate in matching or storage;
- cross-origin requests are ignored;
- `network_request_sent` passes on observation and fails on timeout;
- `network_request_not_sent` waits the full window, passes without a match, and fails immediately on a match;
- request listener errors cannot create a false `not_sent` pass;
- listeners are removed after success and failure;
- consecutive fixed cases do not share request history.

- [ ] **Step 2: Run the Node test and verify RED**

Run the Node test command. Expected: FAIL because capture and network assertion branches do not exist.

- [ ] **Step 3: Implement a per-case minimal request tracker**

The tracker stores only:

```javascript
{ method: "POST", origin: "https://staging-console.flatkey.ai", pathname: "/api/token/" }
```

It must never retain full URL, query, headers, post data, response, cookie, or authorization fields. `begin_network_capture` clears and activates the buffer. Matching uses the case start origin, exact method, and exact pathname. A bounded polling helper implements `timeout_ms <= 5000` using the injected/available clock pattern where practical so tests remain fast and deterministic.

- [ ] **Step 4: Guarantee listener cleanup in `finally`**

Install and remove the request listener in the same lifecycle as the existing document-status tracker, including start navigation failure and assertion failure paths.

- [ ] **Step 5: Run Node tests and verify GREEN**

Run the Node test command. Expected: all tests pass without real sleeps longer than the test harness requires.

- [ ] **Step 6: Commit only Task 4 files using the Lore protocol**

Directive must state that request metadata remains in-memory, minimal, same-origin, and query-free.

### Task 5: Prove promotion compatibility and update operator documentation

**Files:**
- Modify: `scripts/browser_qa/tests/test_promotion.py`
- Modify: `docs/browser-qa/browser-qa-technical-implementation.html`
- Modify: `docs/browser-qa/ai-browser-testing-migration-guide.html`

- [ ] **Step 1: Write a failing fingerprint regression test**

Create two otherwise identical `proposed_case` objects whose UI locator, network method/path, count, or timeout differs and assert distinct canonical fingerprints. Assert candidate bundle round-tripping preserves the exact new DSL without introducing runtime evidence data.

- [ ] **Step 2: Run promotion tests and verify RED or behavior coverage**

Run:

```powershell
python -B -m unittest scripts.browser_qa.tests.test_promotion -v
```

If the generic canonicalizer already passes, temporarily mutate an expected fingerprint input in the test to prove the assertion fails, restore it, and record the red/green evidence before proceeding.

- [ ] **Step 3: Update both HTML guides**

Document the nine new DSL capabilities, the explicit network capture boundary, the empty-name safe UI example, the non-mutating network example, security boundaries, and the distinction between “implemented locally” and “verified on staging.” Do not claim live verification until Task 7 succeeds.

- [ ] **Step 4: Verify docs contain no secret material and required sections exist**

Run bounded searches for known secret prefixes/authorization syntax and parse the HTML files with the existing bundled/runtime parser if available. At minimum, assert both files contain `begin_network_capture`, `element_disabled`, and `network_request_not_sent`.

- [ ] **Step 5: Commit only Task 5 files using the Lore protocol**

Not-tested trailer must state that live staging proof follows separately.

### Task 6: Run full local verification and independent review

**Files:**
- Review all files changed by Tasks 1–5.

- [ ] **Step 1: Run the complete Browser QA Python suite**

```powershell
python -B -m unittest discover -s scripts/browser_qa/tests -v
```

Expected: zero failures; record pass and skip counts.

- [ ] **Step 2: Run the complete Node helper suite**

```powershell
node --test scripts/browser_qa/flatkey_browser_qa/browser_evidence_helper.test.cjs
```

Expected: zero failures.

- [ ] **Step 3: Run syntax and contract checks**

```powershell
python -m json.tool scripts/browser_qa/config/fixed_case.schema.json > $null
python -m json.tool scripts/browser_qa/config/result.schema.json > $null
python -m compileall -q scripts/browser_qa/flatkey_browser_qa scripts/browser_qa/tests
git diff --check
```

Expected: all commands exit 0. Remove only generated `__pycache__` files created by this task; preserve all unrelated user changes.

- [ ] **Step 4: Run an independent code review**

Review for fail-open validation, secret retention, cross-origin matching, listener leaks, real-time sleeps, schema drift, fingerprint ambiguity, and existing workflow regressions. Fix Important findings with new failing tests first.

- [ ] **Step 5: Re-run the full verification after review fixes**

Fresh output is required before any completion claim or push.

### Task 7: Integrate to staging and run live acceptance

**Files:**
- Merge/cherry-pick only the task commits required for the feature into remote `staging` according to the repository workflow.

- [ ] **Step 1: Confirm branch and diff scope**

Inspect commits relative to `origin/staging`. Exclude unrelated dirty files and unrelated historical worktree commits. Ensure every new commit follows the Lore protocol.

- [ ] **Step 2: Push the reviewed feature to remote `staging`**

This triggers staging build/deploy and `browser-qa-normal` automatically. Do not modify `main` or production workflows.

- [ ] **Step 3: Monitor the exact GitHub Actions run to terminal state**

Verify build, deploy, replay, fixed-case phase, exploration, candidate validation, cleanup, GCS manifest, DingTalk, and final gate. Staging findings remain alert-only because `fail_on_findings: false`.

- [ ] **Step 4: Execute a controlled candidate using the new DSL**

Use a non-mutating candidate that exercises at least one UI assertion and one network assertion. Verify the Cloud Run candidate execution accepts and executes the new schema, with an attempt-specific evidence directory.

- [ ] **Step 5: Inspect sanitized evidence and notification**

Confirm the manifest contains the structured case but no headers, cookies, authorization, request bodies, query secrets, Gmail identity, API key, or webhook. Confirm the Chinese DingTalk report links directly to the exact GitHub Run.

- [ ] **Step 6: Update HTML verification claims and produce the final report**

Only after live evidence exists, replace “待线上验证” language with the exact run ID, commit, GCS manifest URI, candidate execution IDs, statuses, finding count, cleanup status, and DingTalk delivery marker. Report any remaining product finding separately from infrastructure success.

---

## Completion Gate

Do not claim completion until:

- every new production behavior was preceded by a failing test;
- Python and Node suites pass fresh with zero failures;
- schema, syntax, and diff checks exit 0;
- independent review has no Critical or Important findings;
- remote staging run reaches a terminal state;
- one controlled live candidate proves both a new UI assertion and a new network assertion;
- sanitized GCS and DingTalk evidence are recorded without exposing secrets.
