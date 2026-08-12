# Browser QA Production Alert-Only Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the verified staging Browser QA implementation onto current `main`, reuse its cloud resources, and start a production-targeted alert-only QA run after `deploy-console` succeeds.

**Architecture:** Keep one reusable Browser QA workflow and one Cloud Run/Broker/GCS resource set. Add a closed `staging|production` target profile that resolves exact origins inside trusted code, propagate that profile through execution-scoped environment variables and sanitized manifests, and add a downstream production caller to the existing main deployment workflow. Production Turnstile remains enabled; the runner never bypasses it and reports an early blocked replay as sanitized `human_verification_blocked` evidence.

**Tech Stack:** GitHub Actions reusable workflows, Python 3 standard library, Node.js Playwright helper, Cloud Run Jobs, GCS JSON manifests, DingTalk webhook reporting, Python `unittest`, Node `node:test`, JSON Schema.

---

## File Structure

The staging implementation is first ported from four verified commits. Production-specific work then stays within these boundaries:

- `.github/workflows/gcp-browser-qa.yml` - reusable workflow inputs, trusted target selection, execution-scoped environment overrides, and reporting inputs.
- `.github/workflows/gcp-deploy-staging.yml` - explicit staging caller contract.
- `.github/workflows/gcp-deploy.yml` - production caller after `deploy-console`.
- `scripts/browser_qa/flatkey_browser_qa/config.py` - closed environment profiles and runtime/cleanup configuration.
- `scripts/browser_qa/flatkey_browser_qa/supervisor.py` - target-aware status preflight and Turnstile-blocked classification.
- `scripts/browser_qa/flatkey_browser_qa/report.py` - sanitized environment and infrastructure classification in main manifests.
- `scripts/browser_qa/flatkey_browser_qa/cleanup_job.py` - environment propagation into root/cleanup manifests.
- `scripts/browser_qa/flatkey_browser_qa/dingtalk.py` - Chinese environment label and blocked-replay wording.
- `scripts/browser_qa/config/allowed_hosts.json` - declarative exact staging and production hosts.
- `scripts/browser_qa/config/qa-prompt.md` and `.agents/skills/flatkey-new-user-onboarding/references/staging-cloud-qa-policy.md` - allow the selected production origins while continuing to prohibit CAPTCHA bypass and unsafe actions.
- `scripts/browser_qa/tests/test_config.py`, `test_supervisor.py`, `test_report.py`, `test_cleanup.py`, `test_dingtalk.py`, `test_workflow_contract.py` - regression and contract coverage.
- `docs/browser-qa/*.html` and `deploy/gcp/docs/OPERATIONS.md` - operational behavior and rollback instructions.

### Task 1: Port the verified staging Browser QA implementation onto current main

**Files:**
- Create/modify: all paths introduced or changed by commits `8856463d4`, `582297c54`, `dc9fb416a`, and `44e08be60`
- Preserve: current `origin/main` changes outside Browser QA scope

- [ ] **Step 1: Confirm the feature branch is based on current main**

Run:

```powershell
git merge-base --is-ancestor origin/main HEAD
git log -1 --oneline origin/main
```

Expected: first command exits `0`; the displayed main head is the baseline recorded before the port.

- [ ] **Step 2: Port the verified commits in dependency order**

Run:

```powershell
git cherry-pick 8856463d4
git cherry-pick 582297c54
git cherry-pick dc9fb416a
git cherry-pick 44e08be60
```

Expected: each commit applies, or stops with explicit conflicts. For conflicts, preserve current main behavior and Browser QA additions; never replace `.github/workflows/gcp-deploy.yml`, production Terraform, or unrelated application code with staging versions.

- [ ] **Step 3: Verify the exact feature surfaces exist**

Run:

```powershell
git cat-file -e HEAD:.github/workflows/gcp-browser-qa.yml
git cat-file -e HEAD:scripts/browser_qa/flatkey_browser_qa/supervisor.py
git cat-file -e HEAD:docs/browser-qa/browser-qa-technical-implementation.html
python -B -m unittest discover -s scripts/browser_qa/tests -p 'test_*.py'
node --test scripts/browser_qa/flatkey_browser_qa/browser_evidence_helper.test.cjs
```

Expected: all files exist; Python and Node suites exit `0` with zero failures.

### Task 2: Add closed staging and production target profiles

**Files:**
- Modify: `scripts/browser_qa/flatkey_browser_qa/config.py`
- Modify: `scripts/browser_qa/config/allowed_hosts.json`
- Test: `scripts/browser_qa/tests/test_config.py`
- Test: `scripts/browser_qa/tests/test_origin_policy.py`

- [ ] **Step 1: Write failing profile tests**

Add tests equivalent to:

```python
def test_load_config_accepts_exact_production_profile(self):
    env = valid_env()
    env.update({
        "FLATKEY_QA_TARGET_ENVIRONMENT": "production",
        "FLATKEY_QA_WEBSITE_ORIGIN": "https://flatkey.ai",
        "FLATKEY_QA_CONSOLE_ORIGIN": "https://console.flatkey.ai",
        "FLATKEY_QA_DOCS_ORIGIN": "https://docs.flatkey.ai",
    })
    cfg = config.load_config(env)
    self.assertEqual(cfg.target_environment, "production")
    self.assertTrue(cfg.origin_policy.allows("https://console.flatkey.ai/register", write=True))

def test_load_config_rejects_mixed_environment_origins(self):
    env = valid_env()
    env["FLATKEY_QA_TARGET_ENVIRONMENT"] = "production"
    env["FLATKEY_QA_CONSOLE_ORIGIN"] = "https://staging-console.flatkey.ai"
    with self.assertRaisesRegex(ValueError, "must be exactly"):
        config.load_config(env)
```

Cover an unknown profile, HTTP, query/fragment origins, arbitrary hostnames, and cleanup config using the wrong environment.

- [ ] **Step 2: Run the new tests and verify they fail**

Run:

```powershell
python -B -m unittest scripts.browser_qa.tests.test_config scripts.browser_qa.tests.test_origin_policy -v
```

Expected: failures show missing `FLATKEY_QA_TARGET_ENVIRONMENT` support and production profile rejection.

- [ ] **Step 3: Implement exact target profiles**

Implement a closed mapping in `config.py`:

```python
_TARGET_PROFILES = {
    "staging": {
        "website_origin": "https://staging-website.flatkey.ai",
        "console_origin": "https://staging-console.flatkey.ai",
        "docs_origin": "https://docs.flatkey.ai",
    },
    "production": {
        "website_origin": "https://flatkey.ai",
        "console_origin": "https://console.flatkey.ai",
        "docs_origin": "https://docs.flatkey.ai",
    },
}
```

Add `target_environment` to `RuntimeConfig` and `CleanupConfig`, require `FLATKEY_QA_TARGET_ENVIRONMENT`, compare every supplied origin to the selected profile, and build `OriginPolicy` only from that profile's exact hosts. Keep logical fixed-case origin names backward compatible.

Update `allowed_hosts.json` to list exact hosts by profile rather than merging both profiles into one unrestricted writable list.

- [ ] **Step 4: Run the profile tests**

Run:

```powershell
python -B -m unittest scripts.browser_qa.tests.test_config scripts.browser_qa.tests.test_origin_policy -v
```

Expected: all selected tests pass.

- [ ] **Step 5: Commit the profile boundary**

Commit with a Lore message whose intent is that production reuse must not introduce arbitrary-origin execution. Include the targeted test command in `Tested:`.

### Task 3: Make preflight target-aware without bypassing Turnstile

**Files:**
- Modify: `scripts/browser_qa/flatkey_browser_qa/supervisor.py`
- Modify: `scripts/browser_qa/flatkey_browser_qa/report.py`
- Modify: `scripts/browser_qa/config/qa-prompt.md`
- Modify: `.agents/skills/flatkey-new-user-onboarding/references/staging-cloud-qa-policy.md`
- Test: `scripts/browser_qa/tests/test_supervisor.py`
- Test: `scripts/browser_qa/tests/test_report.py`

- [ ] **Step 1: Write failing target-aware preflight tests**

Add tests equivalent to:

```python
def test_preflight_accepts_turnstile_only_for_production(self):
    payload = status_payload(turnstile_check=True)
    self.assertFalse(supervisor._preflight_ok(payload, target_environment="staging"))
    self.assertTrue(supervisor._preflight_ok(payload, target_environment="production"))

def test_preflight_rejects_disabled_registration_for_every_profile(self):
    payload = status_payload(register_enabled=False, turnstile_check=True)
    for target in ("staging", "production"):
        self.assertFalse(supervisor._preflight_ok(payload, target_environment=target))
```

Add a report test proving `runtime_classification="human_verification_blocked"` produces `status="replay_failed"` and a sanitized infrastructure/classification field, not `infrastructure_failed`.

- [ ] **Step 2: Run the new tests and verify they fail**

Run:

```powershell
python -B -m unittest scripts.browser_qa.tests.test_supervisor scripts.browser_qa.tests.test_report -v
```

Expected: failures identify the old staging-only preflight signature and status classification.

- [ ] **Step 3: Implement target-aware status preflight**

Rename `StagingStatusPreflight` to `StatusPreflight`, accept the exact selected console origin and target environment, and use:

```python
def _preflight_ok(payload, *, target_environment):
    data = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(data, dict):
        return False
    if not (
        data.get("register_enabled") is True
        and data.get("password_register_enabled") is True
        and data.get("email_verification") is True
    ):
        return False
    return data.get("turnstile_check") is False or target_environment == "production"
```

Record whether production preflight observed Turnstile. If replay terminates before the checkpoint and the result indicates the authentication/verification path was blocked, set the sanitized runtime classification to `human_verification_blocked`. Do not record token, widget response, query string, cookie, or verification content.

In `report.classify_status`, special-case this classification as `replay_failed`; retain the classification object in the manifest for diagnosis.

- [ ] **Step 4: Update the prompt and policy boundary**

Replace staging-only language with selected-environment language while preserving these exact prohibitions:

```text
Do not bypass, forge, replay, outsource, or solve CAPTCHA/Turnstile through a third-party service.
Production writes are limited to the run-scoped disposable QA identity during recorded replay and independent cleanup.
```

Keep payment, subscription, invitation, administrator actions, real model calls, arbitrary navigation, and post-checkpoint state changes forbidden.

- [ ] **Step 5: Run supervisor and report tests**

Run:

```powershell
python -B -m unittest scripts.browser_qa.tests.test_supervisor scripts.browser_qa.tests.test_report -v
```

Expected: all selected tests pass.

- [ ] **Step 6: Commit preflight behavior**

Commit with a Lore message explaining that production Turnstile is observable but never bypassed.

### Task 4: Propagate environment through manifests, cleanup, and DingTalk

**Files:**
- Modify: `scripts/browser_qa/flatkey_browser_qa/report.py`
- Modify: `scripts/browser_qa/flatkey_browser_qa/cleanup_job.py`
- Modify: `scripts/browser_qa/flatkey_browser_qa/candidate_job.py`
- Modify: `scripts/browser_qa/flatkey_browser_qa/dingtalk.py`
- Modify: `scripts/browser_qa/config/result.schema.json`
- Test: `scripts/browser_qa/tests/test_report.py`
- Test: `scripts/browser_qa/tests/test_cleanup.py`
- Test: `scripts/browser_qa/tests/test_candidate_job.py`
- Test: `scripts/browser_qa/tests/test_dingtalk.py`

- [ ] **Step 1: Write failing environment-propagation tests**

Add assertions equivalent to:

```python
self.assertEqual(manifest["environment"], "production")
self.assertEqual(root_manifest["environment"], "production")
self.assertIn("正式环境", markdown)
self.assertNotIn("FLATKEY_QA_TARGET_ENVIRONMENT", markdown)
```

Also prove root aggregation rejects a main or cleanup manifest whose environment differs from the run's trusted environment.

- [ ] **Step 2: Run the selected tests and verify they fail**

Run:

```powershell
python -B -m unittest scripts.browser_qa.tests.test_report scripts.browser_qa.tests.test_cleanup scripts.browser_qa.tests.test_candidate_job scripts.browser_qa.tests.test_dingtalk -v
```

Expected: failures show missing environment fields and labels.

- [ ] **Step 3: Implement sanitized environment propagation**

Use only the enum values `staging` and `production`. Add `environment` to main, cleanup, candidate-attempt, and root manifests. Reject mismatches during aggregation. Map DingTalk labels with a closed dictionary:

```python
ENVIRONMENT_LABELS = {
    "staging": "测试环境",
    "production": "正式环境",
}
```

Render `human_verification_blocked` as a short Chinese explanation that the normal Turnstile flow blocked automation; do not include widget/token details.

- [ ] **Step 4: Run the selected tests**

Run:

```powershell
python -B -m unittest scripts.browser_qa.tests.test_report scripts.browser_qa.tests.test_cleanup scripts.browser_qa.tests.test_candidate_job scripts.browser_qa.tests.test_dingtalk -v
```

Expected: all selected tests pass.

- [ ] **Step 5: Commit manifest and notification behavior**

Commit with a Lore message explaining why evidence from the shared bucket must retain an immutable environment label.

### Task 5: Parameterize the reusable GitHub Actions workflow

**Files:**
- Modify: `.github/workflows/gcp-browser-qa.yml`
- Modify: `.github/workflows/gcp-deploy-staging.yml`
- Test: `scripts/browser_qa/tests/test_workflow_contract.py`

- [ ] **Step 1: Write failing workflow contract tests**

Add tests that require:

```python
self.assertEqual(called["on"]["workflow_dispatch"]["inputs"]["target_environment"]["default"], "staging")
self.assertTrue(called["on"]["workflow_call"]["inputs"]["target_environment"]["required"])
self.assertEqual(staging["jobs"]["browser-qa-normal"]["with"]["target_environment"], "staging")
```

Assert the validation shell accepts only `staging|production` and execution commands include `FLATKEY_QA_TARGET_ENVIRONMENT` plus exact profile origins. Assert workflow job/service names still come only from trusted constants or repository variables, never a caller-provided arbitrary string.

- [ ] **Step 2: Run the workflow contract and verify it fails**

Run:

```powershell
python -B -m unittest scripts.browser_qa.tests.test_workflow_contract -v
```

Expected: failures identify the missing input and staging caller value.

- [ ] **Step 3: Implement workflow target selection**

Add the input to both dispatch surfaces:

```yaml
target_environment:
  description: "Closed Browser QA target profile"
  required: true
  default: staging # workflow_dispatch only
  type: string
```

Validate it before any cloud mutation. Resolve exact origins in bash with a closed `case`, export them through `GITHUB_ENV`, and pass the following execution-scoped overrides to main, cleanup, and candidate attempts:

```text
FLATKEY_QA_TARGET_ENVIRONMENT
FLATKEY_QA_WEBSITE_ORIGIN
FLATKEY_QA_CONSOLE_ORIGIN
FLATKEY_QA_DOCS_ORIGIN
```

Do not persist production origins by updating the Cloud Run job template. Set `target_environment: staging` explicitly in `.github/workflows/gcp-deploy-staging.yml`.

- [ ] **Step 4: Run the workflow contract**

Run:

```powershell
python -B -m unittest scripts.browser_qa.tests.test_workflow_contract -v
```

Expected: all workflow contract tests pass.

- [ ] **Step 5: Commit reusable workflow parameterization**

Commit with a Lore message recording the execution-scoped override constraint.

### Task 6: Wire alert-only Browser QA after production console deployment

**Files:**
- Modify: `.github/workflows/gcp-deploy.yml`
- Test: `scripts/browser_qa/tests/test_workflow_contract.py`

- [ ] **Step 1: Write a failing production caller contract test**

Add assertions equivalent to:

```python
job = production["jobs"]["browser-qa-production"]
self.assertEqual(job["needs"], "deploy-console")
self.assertEqual(job["uses"], "./.github/workflows/gcp-browser-qa.yml")
self.assertEqual(job["with"], {
    "target_environment": "production",
    "mode": "normal",
    "fail_on_findings": False,
})
self.assertNotIn("deploy-router", str(job["needs"]))
```

Assert the caller has `contents: write`, `pull-requests: write`, and `id-token: write`, passes the existing DingTalk secrets, and contains no rollback or traffic command.

- [ ] **Step 2: Run the contract test and verify it fails**

Run:

```powershell
python -B -m unittest scripts.browser_qa.tests.test_workflow_contract -v
```

Expected: failure reports missing `browser-qa-production`.

- [ ] **Step 3: Add the production caller**

Append the job after production deploy jobs:

```yaml
  browser-qa-production:
    needs: deploy-console
    uses: ./.github/workflows/gcp-browser-qa.yml
    permissions:
      contents: write
      pull-requests: write
      id-token: write
    with:
      target_environment: production
      mode: normal
      fail_on_findings: false
    secrets:
      STAGING_BROWSER_QA_DINGTALK_WEBHOOK: ${{ secrets.STAGING_BROWSER_QA_DINGTALK_WEBHOOK }}
      STAGING_BROWSER_QA_DINGTALK_SIGNING_SECRET: ${{ secrets.STAGING_BROWSER_QA_DINGTALK_SIGNING_SECRET }}
```

Do not add `environment: production-*` to this downstream caller; deployment approval already occurred in `deploy-console`, and the QA job has no traffic or rollback authority.

- [ ] **Step 4: Run the workflow contract**

Run:

```powershell
python -B -m unittest scripts.browser_qa.tests.test_workflow_contract -v
```

Expected: all workflow contract tests pass.

- [ ] **Step 5: Commit production wiring**

Commit with a Lore message stating that QA is downstream and alert-only, so it cannot alter production traffic.

### Task 7: Update operations documentation and run full verification

**Files:**
- Modify: `deploy/gcp/docs/OPERATIONS.md`
- Modify: `docs/browser-qa/browser-qa-technical-implementation.html`
- Modify: `docs/browser-qa/ai-browser-testing-migration-guide.html`
- Test: all Browser QA test and contract files

- [ ] **Step 1: Document production behavior and rollback**

Add exact sections covering:

- production caller location and `needs: deploy-console`;
- shared resource reuse and execution-scoped origin overrides;
- `normal` plus `fail_on_findings=false` semantics;
- Turnstile may yield `human_verification_blocked` and is never bypassed;
- removal of `browser-qa-production` is the rollback;
- website production workflow is not yet connected.

- [ ] **Step 2: Run the complete Python suite**

Run:

```powershell
python -B -m unittest discover -s scripts/browser_qa/tests -p 'test_*.py'
```

Expected: exit `0`, zero failures.

- [ ] **Step 3: Run the complete Node suite**

Run:

```powershell
node --test scripts/browser_qa/flatkey_browser_qa/browser_evidence_helper.test.cjs
```

Expected: exit `0`, zero failures.

- [ ] **Step 4: Validate schemas, Python compilation, HTML, and diffs**

Run:

```powershell
python -c "import json,pathlib; [json.loads(p.read_text(encoding='utf-8')) for p in pathlib.Path('scripts/browser_qa/config').glob('*.json')]; print('SCHEMAS_OK')"
python -B -m compileall -q scripts/browser_qa/flatkey_browser_qa scripts/browser_qa/tests
python -c "from html.parser import HTMLParser; import pathlib; [HTMLParser().feed(p.read_text(encoding='utf-8')) for p in pathlib.Path('docs/browser-qa').glob('*.html')]; print('HTML_OK')"
git diff --check origin/main...HEAD
```

Expected: `SCHEMAS_OK`, compile exit `0`, `HTML_OK`, and no diff-check output.

- [ ] **Step 5: Review secrets and production boundaries**

Run searches that must return no real secret values and no arbitrary production-host inputs:

```powershell
rg -n "sk-[A-Za-z0-9_-]{10,}|access_token=|client_secret\"\s*:|refresh_token\"\s*:" .github scripts/browser_qa docs/browser-qa deploy/gcp/docs
rg -n "target_environment|console\.flatkey\.ai|staging-console\.flatkey\.ai" .github/workflows scripts/browser_qa
```

Expected: the first search finds only redaction/test placeholders or nothing; every target environment/origin occurrence in the second search belongs to the closed profile mapping or contract tests.

- [ ] **Step 6: Commit documentation and verification updates**

Commit with a Lore message listing complete Python/Node/schema/HTML/diff verification in `Tested:` and any live-production validation gap in `Not-tested:`.

### Task 8: Final review and integration preparation

**Files:**
- Review: all changes relative to `origin/main`

- [ ] **Step 1: Run a focused code review**

Review for security boundary regressions, GitHub reusable-workflow permission elevation, production origin injection, cross-environment evidence mixing, cleanup targeting, notification-on-failure coverage, and accidental traffic/rollback authority.

- [ ] **Step 2: Re-run affected tests after review fixes**

Run the complete Python and Node commands from Task 7 plus `git diff --check origin/main...HEAD`.

Expected: zero failures and no diff-check output.

- [ ] **Step 3: Verify branch contents**

Run:

```powershell
git status --short
git log --oneline --decorate origin/main..HEAD
git diff --stat origin/main...HEAD
```

Expected: only the known untracked `__pycache__` may remain outside commits; commits contain the design, plan, port, production parameterization, workflow wiring, tests, and docs.

- [ ] **Step 4: Prepare integration without bypassing production approval**

Push the feature branch and integrate through the repository's normal main-branch review/merge path. A merge to `main` will build production and wait for the existing `production-console` approval before deployment; Browser QA starts only after that approved deploy succeeds.
