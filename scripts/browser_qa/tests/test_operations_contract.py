import pathlib
import re
import unittest

from scripts.browser_qa.flatkey_browser_qa import promotion
from scripts.browser_qa.flatkey_browser_qa import candidate_orchestrator


REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]
OPERATIONS = REPO_ROOT / "deploy" / "gcp" / "docs" / "OPERATIONS.md"
PROD_ROOT = "deploy/gcp/envs/prod"
BROWSER_QA_ROOT = "deploy/gcp/envs/browser-qa-staging"
BROWSER_QA_BACKEND_PREFIX = "envs/browser-qa-staging"
BROWSER_QA_REQUIRED_APIS = {
    "artifactregistry.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "logging.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "serviceusage.googleapis.com",
    "sts.googleapis.com",
    "storage.googleapis.com",
}
BROWSER_QA_LIVE_RESOURCES = {
    "flatkey-staging-browser-qa",
    "flatkey-staging-browser-qa-broker",
    "flatkey-staging-browser-qa-cleanup",
    "flatkey-browser-qa-runtime@vocai-gemini-prod.iam.gserviceaccount.com",
    "flatkey-browser-qa-broker@vocai-gemini-prod.iam.gserviceaccount.com",
    "flatkey-browser-qa-cleanup@vocai-gemini-prod.iam.gserviceaccount.com",
    "flatkey-browser-qa-deployer@vocai-gemini-prod.iam.gserviceaccount.com",
    "flatkey-browser-qa-codex-api-key",
    "flatkey-browser-qa-identity-seed",
    "flatkey-browser-qa-gmail-oauth",
    "gs://vocai-gemini-prod-flatkey-browser-qa-reports",
    "flatkey-browser-qa-github",
    "staging",
}
PHASE_A_STATE_ADDRESSES = {
    "google_artifact_registry_repository.browser_qa",
    "google_artifact_registry_repository_iam_member.browser_qa_deployer_writer",
    "google_iam_workload_identity_pool.browser_qa_github",
    "google_iam_workload_identity_pool_provider.browser_qa_github",
    "google_project_iam_member.browser_qa_broker_log_writer",
    "google_project_iam_member.browser_qa_cleanup_log_writer",
    "google_project_iam_member.browser_qa_runtime_log_writer",
    "google_secret_manager_secret.browser_qa_codex_api_key",
    "google_secret_manager_secret.browser_qa_gmail_oauth",
    "google_secret_manager_secret.browser_qa_identity_seed",
    "google_secret_manager_secret_iam_member.browser_qa_broker_gmail_oauth",
    "google_secret_manager_secret_iam_member.browser_qa_cleanup_identity_seed",
    "google_secret_manager_secret_iam_member.browser_qa_runtime_codex_api_key",
    "google_secret_manager_secret_iam_member.browser_qa_runtime_identity_seed",
    "google_service_account.browser_qa_broker",
    "google_service_account.browser_qa_cleanup",
    "google_service_account.browser_qa_deployer",
    "google_service_account.browser_qa_runtime",
    "google_service_account_iam_member.browser_qa_broker_user",
    "google_service_account_iam_member.browser_qa_cleanup_user",
    "google_service_account_iam_member.browser_qa_runtime_user",
    "google_service_account_iam_member.browser_qa_wif_deployer",
    "google_storage_bucket.browser_qa_reports",
    "google_storage_bucket_iam_member.browser_qa_cleanup_report_admin",
    "google_storage_bucket_iam_member.browser_qa_deployer_report_viewer",
    "google_storage_bucket_iam_member.browser_qa_runtime_report_creator",
}
RECOVERY_ADDRESSES = {
    "google_storage_bucket_iam_member.browser_qa_cleanup_report_admin",
    "google_storage_bucket_iam_member.browser_qa_deployer_report_viewer",
    "google_storage_bucket_iam_member.browser_qa_runtime_report_creator",
}
ABSENCE_ONLY_DIAGNOSTICS = {
    "404",
    "NOT_FOUND",
    "does\\ not\\ exist",
    "Cannot\\ find\\ service\\ \\[",
    "Cannot\\ find\\ job\\ \\[",
}
UNKNOWN_ABSENCE_DIAGNOSTICS = {
    "PERMISSION_DENIED",
    "UNAUTHENTICATED",
    "UNAVAILABLE",
    "Cannot\\ find",
    "Cannot\\ find\\ project",
    '""',
}
UNKNOWN_STATE_DIAGNOSTICS = UNKNOWN_ABSENCE_DIAGNOSTICS - {'""'}
DENY_FIRST_ABSENCE_DIAGNOSTICS = {
    "PERMISSION_DENIED",
    "UNAUTHENTICATED",
    "UNAVAILABLE",
    "Cannot\\ find\\ project",
}


OUTPUT_BACKED_VARIABLES = {
    "GCP_BROWSER_QA_AR_REPO_URL": "browser_qa_artifact_registry_url",
    "GCP_BROWSER_QA_WIF_PROVIDER": "browser_qa_wif_provider",
    "GCP_BROWSER_QA_DEPLOYER_SA": "browser_qa_deployer_sa_email",
    "GCP_BROWSER_QA_GCS_BUCKET": "browser_qa_report_bucket",
}


def proposed_case():
    return {
        "fixture": "anonymous",
        "start": {"origin": "staging_console", "path": "/register"},
        "steps": [{"navigate": {"path": "/register"}}],
        "assertions": [{"page_status_not": 500}],
        "cleanup": "not_required",
    }


def candidate_bundle(*, kind="coverage", run_id="12345", bucket="browser-qa", target_url="https://staging-console.flatkey.ai/register"):
    proposed = proposed_case()
    fingerprint = promotion.canonical_fingerprint(kind, target_url, proposed)
    qualified = {
        "kind": kind,
        "fingerprint": fingerprint,
        "target_url": target_url,
        "proposed_case": proposed,
    }
    return promotion.build_candidate_bundle(
        qualified,
        run_id=run_id,
        evidence_uri=f"gs://{bucket}/runs/{run_id}/main/main-{run_id}/manifest.json",
    )


def root_manifest(candidates):
    return {
        "schema_version": 1,
        "run_id": "12345",
        "status": "passed",
        "latest": {"main_execution_id": "main-12345", "cleanup_execution_id": "cleanup-12345"},
        "executions": [
            {
                "kind": "main",
                "execution_id": "main-12345",
                "manifest": "runs/12345/main/main-12345/manifest.json",
                "status": "passed",
                "created_at": 1,
            },
            {
                "kind": "cleanup",
                "execution_id": "cleanup-12345",
                "manifest": "runs/12345/cleanup/cleanup-12345/cleanup.json",
                "status": "passed",
                "created_at": 2,
            },
        ],
        "candidates": candidates,
    }


def root_manifest_without_latest(candidates):
    root = root_manifest(candidates)
    del root["latest"]
    return root


def attempt_manifest(spec, *, status="passed", cleanup="not_required", classification=None, failure_code="assertion_failed"):
    result = {
        "status": status,
        "case_id": spec["case_id"],
        "attempt_id": spec["attempt_id"],
        "evidence_dir": f"{spec['case_id']}/{spec['attempt_id']}",
        "steps": [{"index": 0, "action": "navigate", "status": "passed"}],
        "assertions": [] if status == "failed" else [{"index": 0, "assertion": "page_status_not", "status": "passed"}],
        "failure": None,
    }
    if status == "failed":
        result["failure"] = {
            "phase": "assertion",
            "index": 0,
            "assertion": "page_status_not",
            "code": failure_code,
            "evidence": {"screenshot": "screenshots/failure.png"},
        }
    return {
        "schema_version": 1,
        "kind": "candidate_attempt",
        "fingerprint": spec["fingerprint"],
        "case_id": spec["case_id"],
        "attempt_id": spec["attempt_id"],
        "result": result,
        "cleanup": {"status": cleanup},
        "runtime": {"classification": classification},
    }


def sensitive_assignment(name, value):
    return f"{name}{chr(61)}{value}"


def operations_text():
    return OPERATIONS.read_text(encoding="utf-8")


def browser_qa_section():
    text = operations_text()
    match = re.search(
        r"(?ms)^## Flatkey staging browser QA first-run and recovery runbook\n"
        r"(?P<body>.*?)(?=^## [^\n]+\n|\Z)",
        text,
    )
    if not match:
        raise AssertionError("Browser QA runbook section not found")
    return match.group("body")


def fenced_blocks(text):
    return re.findall(r"(?ms)^```(?:bash|sh)?\n(.*?)^```", text)


def heading_section(text, heading):
    match = re.search(
        rf"(?ms)^### {re.escape(heading)}\n(?P<body>.*?)(?=^### [^\n]+\n|\Z)",
        text,
    )
    if not match:
        raise AssertionError(f"section not found: {heading}")
    return match.group("body")


def phase_a_recovery_section():
    return heading_section(
        browser_qa_section(),
        "1A. Recover the interrupted Phase A bucket IAM apply",
    )


def phase_a_recovery_command_block():
    blocks = fenced_blocks(phase_a_recovery_section())
    if len(blocks) != 1:
        raise AssertionError(f"expected one Phase A recovery command block, found {len(blocks)}")
    return blocks[0]


def executable_block(block):
    return "\n".join(
        line for line in block.splitlines() if not line.lstrip().startswith("#")
    )


def output_backed_section():
    return heading_section(browser_qa_section(), "2. Set output-backed GitHub repository variables")


def output_backed_command_block():
    blocks = fenced_blocks(output_backed_section())
    if len(blocks) != 1:
        raise AssertionError(f"expected one output-backed command block, found {len(blocks)}")
    return blocks[0]


def plan_review_command_block():
    section = heading_section(
        browser_qa_section(),
        "1. Phase A: authenticated refreshing infrastructure plan review",
    )
    blocks = fenced_blocks(section)
    if len(blocks) != 1:
        raise AssertionError(f"expected one plan review command block, found {len(blocks)}")
    return blocks[0]


def phase_b_section():
    return heading_section(
        browser_qa_section(),
        "4. Phase B: verify Secret versions and create Cloud Run workloads",
    )


def phase_b_command_block():
    blocks = fenced_blocks(phase_b_section())
    if len(blocks) != 1:
        raise AssertionError(f"expected one Phase B command block, found {len(blocks)}")
    return blocks[0]


def heredoc_lines(block, target, marker):
    match = re.search(
        rf"(?ms)^cat > \"\$review_dir/{re.escape(target)}\" <<'{re.escape(marker)}'\n"
        rf"(?P<body>.*?)\n{re.escape(marker)}$",
        block,
    )
    if not match:
        raise AssertionError(f"heredoc not found: {target}")
    return match.group("body").splitlines()


def describe_absent_classifier_parts(block):
    describe_function = re.search(
        r"(?ms)^describe_absent\(\) \{\n(?P<body>.*?)^\}\n\n",
        block,
    )
    if not describe_function:
        raise AssertionError("describe_absent function not found")
    function_body = describe_function.group("body")
    case_match = re.search(r"(?ms)case \"\$diagnostic\" in(?P<body>.*?)esac", function_body)
    if not case_match:
        raise AssertionError("describe_absent diagnostic case not found")
    case_body = case_match.group("body")
    allow_branch = next(
        (line for line in case_body.splitlines() if "absence_verified=true" in line),
        "",
    )
    return function_body, case_body, allow_branch


def assert_describe_absent_classifier_is_deny_first(testcase, block):
    function_body, case_body, allow_branch = describe_absent_classifier_parts(block)

    testcase.assertIn("absence_verified=true", allow_branch)
    for diagnostic in ABSENCE_ONLY_DIAGNOSTICS:
        with testcase.subTest(diagnostic=diagnostic):
            testcase.assertIn(diagnostic, allow_branch)
    for diagnostic in UNKNOWN_ABSENCE_DIAGNOSTICS:
        with testcase.subTest(diagnostic=diagnostic):
            testcase.assertNotIn(f"*{diagnostic}*", allow_branch)
    testcase.assertIn('*)', case_body)
    testcase.assertIn("ABORT: unable to prove", function_body)

    for denied in DENY_FIRST_ABSENCE_DIAGNOSTICS:
        with testcase.subTest(denied=denied):
            denied_marker = f"*{denied}*"
            testcase.assertIn(denied_marker, case_body)
            denied_line = next(
                (line for line in case_body.splitlines() if denied_marker in line),
                "",
            )
            testcase.assertNotIn("absence_verified=true", denied_line)
            testcase.assertLess(case_body.index(denied_marker), case_body.index("*404*"))
            testcase.assertLess(
                case_body.index(denied_marker),
                case_body.index("*Cannot\\ find\\ service\\ \\[*"),
            )
            testcase.assertLess(
                case_body.index(denied_marker),
                case_body.index("*Cannot\\ find\\ job\\ \\[*"),
            )
    testcase.assertEqual(function_body.count("ABORT: unable to prove"), 1)


def assert_phase_b_active_config_gates_before_readiness(testcase, block):
    project_gate = re.search(
        r'(?ms)active_project="\$\(gcloud config get-value project 2>/dev/null\)"\s+'
        r'if \[ "\$active_project" != "\$expected_project" \]; then\s+'
        r'echo "ABORT: active GCP project must be vocai-gemini-prod; got \$\{active_project:-<unset>\}" >&2\s+'
        r"exit 1\s+"
        r"fi",
        block,
    )
    if not project_gate:
        raise AssertionError("Phase B active project fail-closed gate not found")

    region_gate = re.search(
        r'(?ms)active_region="\$\(gcloud config get-value run/region 2>/dev/null\)"\s+'
        r'if \[ "\$active_region" != "\$region" \]; then\s+'
        r'echo "ABORT: active run region must be us-west1; got \$\{active_region:-<unset>\}" >&2\s+'
        r"exit 1\s+"
        r"fi",
        block,
    )
    if not region_gate:
        raise AssertionError("Phase B active region fail-closed gate not found")

    readiness_markers = [
        "terraform init -reconfigure",
        'terraform state list | LC_ALL=C sort > "$actual_infra_state"',
        "gcloud secrets versions describe latest",
        'describe_absent "Cloud Run broker service flatkey-staging-browser-qa-broker"',
        "terraform plan -var='create_workloads=true'",
    ]
    for readiness_marker in readiness_markers:
        with testcase.subTest(readiness_marker=readiness_marker):
            readiness_index = block.index(readiness_marker)
            testcase.assertLess(project_gate.end(), readiness_index)
            testcase.assertLess(region_gate.end(), readiness_index)


class BrowserQaOperationsContractTests(unittest.TestCase):
    def test_candidate_orchestrator_builds_shell_safe_three_attempt_plan_bound_to_exact_bucket_and_run(self):
        plan = candidate_orchestrator.build_execution_plan(
            root_manifest([candidate_bundle()]),
            expected_bucket="browser-qa",
            run_id="12345",
            occupied={},
        )

        self.assertEqual(len(plan["candidates"]), 1)
        candidate = plan["candidates"][0]
        self.assertEqual(len(candidate["attempts"]), 3)
        self.assertRegex(candidate["case_id"], r"^FQA-[0-9]{12,78}$")
        attempt_ids = [attempt["attempt_id"] for attempt in candidate["attempts"]]
        self.assertEqual(len(set(attempt_ids)), 3)
        for index, attempt in enumerate(candidate["attempts"], start=1):
            with self.subTest(attempt=index):
                self.assertRegex(attempt["candidate_b64"], r"^[A-Za-z0-9_-]+$")
                self.assertNotIn("=", attempt["candidate_b64"])
                self.assertRegex(attempt["attempt_id"], r"^attempt-[A-Za-z0-9][A-Za-z0-9._-]{0,55}$")
                self.assertEqual(
                    attempt["manifest_uri"],
                    f"gs://browser-qa/runs/12345/candidates/{candidate['fingerprint'][7:19]}/{attempt['attempt_id']}/manifest.json",
                )
                self.assertEqual(
                    attempt["manifest_object"],
                    f"runs/12345/candidates/{candidate['fingerprint'][7:19]}/{attempt['attempt_id']}/manifest.json",
                )
                self.assertEqual(attempt["case_id"], candidate["case_id"])

    def test_candidate_orchestrator_rejects_bucket_run_mismatch_duplicates_malformed_and_secret_candidates(self):
        valid = candidate_bundle()
        bad_cases = [
            root_manifest([candidate_bundle(bucket="other")]),
            root_manifest([candidate_bundle(run_id="99999")]),
            root_manifest([valid, valid]),
            root_manifest([{**valid, "extra": True}]),
            root_manifest([{**valid, "case_id": "FQA-0001"}]),
            root_manifest([{**valid, "source": {"run_id": "12345", "evidence_uri": "gs://browser-qa/runs/12345/main/main-12345/manifest.json?" + sensitive_assignment("token", "probe")}}]),
            root_manifest([{**valid, "proposed_case": {**valid["proposed_case"], "steps": [{"fill": {"locator": {"by": "label", "label": "Password"}, "value": sensitive_assignment("password", "probe")}}]}}]),
            {**root_manifest([]), "candidates": {"not": "a list"}},
        ]

        for manifest in bad_cases:
            with self.subTest(manifest=manifest):
                with self.assertRaises(ValueError):
                    candidate_orchestrator.build_execution_plan(manifest, expected_bucket="browser-qa", run_id="12345")

    def test_candidate_orchestrator_requires_candidate_source_to_match_latest_main_manifest(self):
        valid = candidate_bundle()
        wrong_path = {**valid, "source": {"run_id": "12345", "evidence_uri": "gs://browser-qa/runs/12345/cleanup/cleanup-12345/cleanup.json"}}
        wrong_main_execution = {**valid, "source": {"run_id": "12345", "evidence_uri": "gs://browser-qa/runs/12345/main/main-other/manifest.json"}}
        missing_latest = root_manifest_without_latest([valid])
        latest_without_matching_execution = root_manifest([valid])
        latest_without_matching_execution["latest"] = {"main_execution_id": "main-other", "cleanup_execution_id": "cleanup-12345"}
        latest_record_wrong_kind = root_manifest([{**valid, "source": {"run_id": "12345", "evidence_uri": "gs://browser-qa/runs/12345/main/main-other/manifest.json"}}])
        latest_record_wrong_kind["latest"] = {"main_execution_id": "main-other", "cleanup_execution_id": "cleanup-12345"}
        latest_record_wrong_kind["executions"].append({
            "kind": "cleanup",
            "execution_id": "main-other",
            "manifest": "runs/12345/cleanup/main-other/cleanup.json",
            "status": "passed",
            "created_at": 3,
        })
        latest_record_wrong_manifest = root_manifest([{**valid, "source": {"run_id": "12345", "evidence_uri": "gs://browser-qa/runs/12345/main/main-other/manifest.json"}}])
        latest_record_wrong_manifest["latest"] = {"main_execution_id": "main-other", "cleanup_execution_id": "cleanup-12345"}
        latest_record_wrong_manifest["executions"].append({
            "kind": "main",
            "execution_id": "main-other",
            "manifest": "runs/12345/main/main-12345/manifest.json",
            "status": "passed",
            "created_at": 3,
        })

        for manifest in [
            root_manifest([wrong_path]),
            root_manifest([wrong_main_execution]),
            missing_latest,
            latest_without_matching_execution,
            latest_record_wrong_kind,
            latest_record_wrong_manifest,
        ]:
            with self.subTest(manifest=manifest):
                with self.assertRaises(ValueError):
                    candidate_orchestrator.build_execution_plan(manifest, expected_bucket="browser-qa", run_id="12345")

        self.assertEqual(
            candidate_orchestrator.build_execution_plan(root_manifest([]), expected_bucket="browser-qa", run_id="12345")["candidates"],
            [],
        )
        self.assertEqual(
            candidate_orchestrator.build_execution_plan(root_manifest_without_latest([]), expected_bucket="browser-qa", run_id="12345")["candidates"],
            [],
        )
        self.assertEqual(
            len(candidate_orchestrator.build_execution_plan(root_manifest([valid]), expected_bucket="browser-qa", run_id="12345")["candidates"]),
            1,
        )

    def test_candidate_orchestrator_aggregation_reuses_promotion_rules_and_stops_on_cleanup_failure(self):
        plan = candidate_orchestrator.build_execution_plan(root_manifest([candidate_bundle(kind="finding")]), expected_bucket="browser-qa", run_id="12345")
        candidate = plan["candidates"][0]
        attempts = candidate["attempts"]

        cleanup_summary = candidate_orchestrator.aggregate_candidate_attempts(
            candidate,
            [attempt_manifest(attempts[0], status="failed", cleanup="failed")],
        )
        self.assertEqual(cleanup_summary["decision"], "blocked")
        self.assertEqual(cleanup_summary["reason"], "cleanup_failed")

        infra_summary = candidate_orchestrator.aggregate_candidate_attempts(
            candidate,
            [attempt_manifest(attempts[0], classification="browser_failed")],
        )
        self.assertEqual(infra_summary["decision"], "incomplete")
        self.assertEqual(infra_summary["attempts_counted"], 0)

        finding_summary = candidate_orchestrator.aggregate_candidate_attempts(
            candidate,
            [attempt_manifest(attempt, status="failed") for attempt in attempts],
        )
        self.assertEqual(finding_summary["decision"], "awaiting_product_fix")

        fixed_summary = candidate_orchestrator.aggregate_candidate_attempts(
            {**candidate, "promotion": {**candidate["promotion"], "state": "awaiting_product_fix"}},
            [attempt_manifest(attempt, status="passed") for attempt in attempts],
        )
        self.assertEqual(fixed_summary["decision"], "ready_for_review")

    def test_candidate_orchestrator_recovery_reads_only_exact_attempt_paths_and_rejects_identity_mismatch(self):
        plan = candidate_orchestrator.build_execution_plan(root_manifest([candidate_bundle()]), expected_bucket="browser-qa", run_id="12345")
        candidate = plan["candidates"][0]
        paths = candidate_orchestrator.exact_attempt_manifest_uris(candidate)
        self.assertEqual(paths, [attempt["manifest_uri"] for attempt in candidate["attempts"]])
        self.assertFalse(any("*" in path or path.endswith("/") for path in paths))

        forged = attempt_manifest(candidate["attempts"][0])
        forged["fingerprint"] = "sha256:" + "0" * 64
        with self.assertRaises(ValueError):
            candidate_orchestrator.aggregate_candidate_attempts(candidate, [forged])

    def test_project_environment_lists_prod_and_browser_qa_roots_and_state_prefixes(self):
        text = operations_text()
        project_environment = re.search(
            r"(?ms)^## Project / environment\n(?P<body>.*?)(?=^## [^\n]+\n|\Z)",
            text,
        )
        if not project_environment:
            raise AssertionError("Project / environment section not found")
        section = project_environment.group("body")

        self.assertIn(PROD_ROOT, section)
        self.assertIn("prefix `envs/prod`", section)
        self.assertIn(BROWSER_QA_ROOT, section)
        self.assertIn(f"prefix `{BROWSER_QA_BACKEND_PREFIX}`", section)

    def test_browser_qa_section_uses_only_independent_terraform_root(self):
        section = browser_qa_section()

        self.assertIn(BROWSER_QA_ROOT, section)
        self.assertIn(f"Backend prefix | `{BROWSER_QA_BACKEND_PREFIX}`", section)
        self.assertNotIn(PROD_ROOT, section)
        self.assertNotIn("enable_browser_qa = true", section)

    def test_resource_table_lists_all_non_committed_github_variables(self):
        text = operations_text()
        expected_variables = set(OUTPUT_BACKED_VARIABLES) | {"GCP_BROWSER_QA_GMAIL_BASE"}

        self.assertIn("Non-committed GitHub variable", text)
        for variable in expected_variables:
            with self.subTest(variable=variable):
                self.assertRegex(text, rf"\|\s*[^|\n]*GitHub variable[^|\n]*\|\s*`?{variable}`?")

    def test_output_backed_repo_variables_are_mapped_from_terraform_outputs(self):
        text = operations_text()

        for variable, output in OUTPUT_BACKED_VARIABLES.items():
            with self.subTest(variable=variable):
                self.assertRegex(
                    text,
                    rf"{variable}[\s\S]{{0,240}}terraform output -raw {output}",
                )
                self.assertRegex(
                    text,
                    rf"{variable}[\s\S]{{0,240}}{output}",
                )

    def test_output_backed_and_secret_sections_are_between_phase_a_and_phase_b(self):
        text = operations_text()
        phase_a_apply = "APPLY_BROWSER_QA_INFRA_SAVED_PLAN"
        output_heading = "### 2. Set output-backed GitHub repository variables"
        secret_heading = "### 3. Add Secret Manager versions without leaking values"
        phase_b_heading = "### 4. Phase B: verify Secret versions and create Cloud Run workloads"
        dispatch_heading = "### 8. Dispatch core or normal and capture the exact run id"

        for marker in [phase_a_apply, output_heading, secret_heading, phase_b_heading, dispatch_heading]:
            self.assertIn(marker, text)

        self.assertLess(text.index(phase_a_apply), text.index(output_heading))
        self.assertLess(text.index(output_heading), text.index(secret_heading))
        self.assertLess(text.index(secret_heading), text.index(phase_b_heading))
        self.assertLess(text.index(phase_b_heading), text.index(dispatch_heading))
        self.assertIn("Terraform output", output_backed_section())

    def test_output_backed_repo_variables_are_set_via_stdin_not_argv(self):
        block = output_backed_command_block()
        self.assertNotIn("--body", block)

        for variable, output in OUTPUT_BACKED_VARIABLES.items():
            with self.subTest(variable=variable):
                assignment_pattern = rf'{variable}="\$\(terraform output -raw {output}\)"'
                self.assertRegex(block, assignment_pattern)
                self.assertRegex(block, rf'test -n "\$\{{{variable}\}}"')
                self.assertRegex(block, rf'test "\$\{{{variable}\}}" != "null"')
                self.assertRegex(
                    block,
                    rf'printf \'%s\' "\$\{{{variable}\}}" \| gh variable set {variable}\s+--repo SolveaCX/new-api',
                )
                self.assertNotRegex(block, rf"gh variable set {variable}[^\n]*\$\{{{variable}\}}")

    def test_output_backed_section_anchors_repo_root_before_browser_qa_cd(self):
        block = output_backed_command_block()
        self.assertRegex(block, r'repo_root="\$\(git rev-parse --show-toplevel\)"')
        self.assertRegex(block, rf'cd "\$repo_root/{BROWSER_QA_ROOT}"')
        self.assertLess(
            block.index('repo_root="$(git rev-parse --show-toplevel)"'),
            block.index(f'cd "$repo_root/{BROWSER_QA_ROOT}"'),
        )

    def test_plan_review_uses_fail_closed_preflight_and_independent_state(self):
        section = browser_qa_section()

        self.assertIn('repo_root="$(git rev-parse --show-toplevel)"', section)
        self.assertIn(f'qa_root="$repo_root/{BROWSER_QA_ROOT}"', section)
        self.assertIn("gcloud auth login", section)
        self.assertIn("gcloud auth application-default login", section)
        self.assertLess(section.index("gcloud auth login"), section.index("gcloud services list --enabled"))
        self.assertLess(section.index("gcloud auth application-default login"), section.index("terraform init -reconfigure"))
        self.assertIn('active_project="$(gcloud config get-value project 2>/dev/null)"', section)
        self.assertIn('ABORT: active GCP project must be vocai-gemini-prod', section)
        self.assertIn('active_region="$(gcloud config get-value run/region 2>/dev/null)"', section)
        self.assertIn('ABORT: active run region must be us-west1', section)
        self.assertIn('gcloud services list --enabled', section)
        self.assertIn("--format='value(config.name)'", section)
        self.assertIn("missing_apis", section)
        self.assertIn("comm -23", section)
        self.assertIn("ABORT: required APIs are not enabled", section)
        for api in sorted(BROWSER_QA_REQUIRED_APIS):
            with self.subTest(api=api):
                self.assertIn(api, section)
        self.assertIn('cd "$qa_root"', section)
        self.assertIn("terraform init -reconfigure", section)
        self.assertIn("terraform state list", section)
        self.assertIn("ABORT: independent Browser QA state is not empty", section)
        self.assertLess(section.index("terraform state list"), section.index('describe_absent "Artifact Registry repository'))

    def test_state_gate_handles_absent_state_without_masking_unknown_read_errors(self):
        block = plan_review_command_block()

        self.assertIn('state_stdout="$review_dir/state-list.stdout"', block)
        self.assertIn('state_stderr="$review_dir/state-list.stderr"', block)
        self.assertIn('if terraform state list >"$state_stdout" 2>"$state_stderr"; then', block)
        self.assertIn("state_status=0", block)
        self.assertRegex(block, r"else\s+state_status=\"\$\?\"")
        self.assertNotIn("if ! terraform state list", block)
        self.assertIn('state_addresses="$(cat "$state_stdout")"', block)
        self.assertIn('state_diagnostic="$(cat "$state_stderr" "$state_stdout")"', block)
        self.assertIn("No state file was found!", block)
        self.assertIn("ABORT: unable to read independent Browser QA state", block)
        self.assertIn("ABORT: independent Browser QA state is not empty", block)
        self.assertLess(block.index("terraform state list"), block.index('describe_absent "Artifact Registry repository'))
        self.assertLess(block.index("No state file was found!"), block.index('describe_absent "Artifact Registry repository'))

    def test_absent_state_requires_empty_stdout_before_accepting_no_state_diagnostic(self):
        block = plan_review_command_block()

        self.assertRegex(
            block,
            r'(?ms)if terraform state list >"\$state_stdout" 2>"\$state_stderr"; then\s+'
            r"state_status=0\s+"
            r'state_addresses="\$\(cat "\$state_stdout"\)"',
        )
        self.assertRegex(
            block,
            r'(?ms)\*"No state file was found!"\*\)\s+'
            r'if \[ -s "\$state_stdout" \]; then\s+'
            r'echo "ABORT: unable to read independent Browser QA state" >&2\s+'
            r'printf \'%s\\n\' "\$state_diagnostic" >&2\s+'
            r"exit 1\s+"
            r"fi\s+"
            r'state_addresses=""',
        )

    def test_state_gate_only_allows_exact_terraform_no_state_diagnostic(self):
        block = plan_review_command_block()
        no_state_case = re.search(
            r"(?ms)case \"\$state_diagnostic\" in(?P<body>.*?)esac",
            block,
        )
        if not no_state_case:
            raise AssertionError("state diagnostic case block not found")
        body = no_state_case.group("body")

        self.assertIn("No state file was found!", body)
        for diagnostic in UNKNOWN_STATE_DIAGNOSTICS:
            with self.subTest(diagnostic=diagnostic):
                self.assertNotIn(diagnostic, body)

    def test_live_absence_preflight_lists_resources_and_fails_closed_on_unknown_errors(self):
        section = browser_qa_section()

        for resource_name in sorted(BROWSER_QA_LIVE_RESOURCES):
            with self.subTest(resource_name=resource_name):
                self.assertIn(resource_name, section)
        for command_family in [
            "gcloud artifacts repositories describe",
            "gcloud run services describe",
            "gcloud run jobs describe",
            "gcloud iam service-accounts describe",
            "gcloud secrets describe",
            "gcloud storage buckets describe",
            "gcloud iam workload-identity-pools describe",
            "gcloud iam workload-identity-pools providers describe",
        ]:
            with self.subTest(command_family=command_family):
                self.assertIn(command_family, section)
        self.assertIn("ABORT: unable to prove", section)
        self.assertRegex(section, r"404|NOT_FOUND|does not exist")
        self.assertIn("Stop and design an import/migration before creating Browser QA resources", section)
        self.assertIn("Do not use -target", section)

    def test_live_absence_probe_allows_only_absence_diagnostics(self):
        assert_describe_absent_classifier_is_deny_first(self, plan_review_command_block())

    def test_live_absence_probe_denies_unknown_markers_before_absence_diagnostics(self):
        assert_describe_absent_classifier_is_deny_first(self, plan_review_command_block())

    def test_phase_b_live_absence_probe_uses_deny_first_classifier(self):
        block = phase_b_command_block()

        self.assertIn('workload_plan_path="$review_dir/browser-qa-workloads.tfplan"', block)
        assert_describe_absent_classifier_is_deny_first(self, block)

    def test_phase_b_checks_active_project_and_region_before_readiness_operations(self):
        block = phase_b_command_block()

        assert_phase_b_active_config_gates_before_readiness(self, block)

    def test_live_absence_preflight_binds_each_resource_to_exact_describe(self):
        section = browser_qa_section()

        specific_probes = [
            (
                "Artifact Registry repository flatkey-staging-browser-qa",
                r"gcloud artifacts repositories describe flatkey-staging-browser-qa\s+\\\s+--project=\"\$project_id\" --location=\"\$region\"",
            ),
            (
                "Cloud Run broker service flatkey-staging-browser-qa-broker",
                r"gcloud run services describe flatkey-staging-browser-qa-broker\s+\\\s+--project=\"\$project_id\" --region=\"\$region\"",
            ),
            (
                "Cloud Run job flatkey-staging-browser-qa",
                r"gcloud run jobs describe flatkey-staging-browser-qa\s+\\\s+--project=\"\$project_id\" --region=\"\$region\"",
            ),
            (
                "Cloud Run job flatkey-staging-browser-qa-cleanup",
                r"gcloud run jobs describe flatkey-staging-browser-qa-cleanup\s+\\\s+--project=\"\$project_id\" --region=\"\$region\"",
            ),
            (
                "runtime service account flatkey-browser-qa-runtime@vocai-gemini-prod.iam.gserviceaccount.com",
                r"gcloud iam service-accounts describe flatkey-browser-qa-runtime@vocai-gemini-prod\.iam\.gserviceaccount\.com\s+\\\s+--project=\"\$project_id\"",
            ),
            (
                "broker service account flatkey-browser-qa-broker@vocai-gemini-prod.iam.gserviceaccount.com",
                r"gcloud iam service-accounts describe flatkey-browser-qa-broker@vocai-gemini-prod\.iam\.gserviceaccount\.com\s+\\\s+--project=\"\$project_id\"",
            ),
            (
                "cleanup service account flatkey-browser-qa-cleanup@vocai-gemini-prod.iam.gserviceaccount.com",
                r"gcloud iam service-accounts describe flatkey-browser-qa-cleanup@vocai-gemini-prod\.iam\.gserviceaccount\.com\s+\\\s+--project=\"\$project_id\"",
            ),
            (
                "deployer service account flatkey-browser-qa-deployer@vocai-gemini-prod.iam.gserviceaccount.com",
                r"gcloud iam service-accounts describe flatkey-browser-qa-deployer@vocai-gemini-prod\.iam\.gserviceaccount\.com\s+\\\s+--project=\"\$project_id\"",
            ),
            (
                "Secret container flatkey-browser-qa-codex-api-key",
                r"gcloud secrets describe flatkey-browser-qa-codex-api-key\s+\\\s+--project=\"\$project_id\"",
            ),
            (
                "Secret container flatkey-browser-qa-identity-seed",
                r"gcloud secrets describe flatkey-browser-qa-identity-seed\s+\\\s+--project=\"\$project_id\"",
            ),
            (
                "Secret container flatkey-browser-qa-gmail-oauth",
                r"gcloud secrets describe flatkey-browser-qa-gmail-oauth\s+\\\s+--project=\"\$project_id\"",
            ),
            (
                "GCS bucket gs://vocai-gemini-prod-flatkey-browser-qa-reports",
                r"gcloud storage buckets describe gs://vocai-gemini-prod-flatkey-browser-qa-reports\s+\\\s+--project=\"\$project_id\"",
            ),
            (
                "WIF pool flatkey-browser-qa-github",
                r"gcloud iam workload-identity-pools describe flatkey-browser-qa-github\s+\\\s+--project=\"\$project_id\" --location=global",
            ),
            (
                "WIF provider staging",
                r"gcloud iam workload-identity-pools providers describe staging\s+\\\s+--project=\"\$project_id\" --location=global --workload-identity-pool=flatkey-browser-qa-github",
            ),
        ]
        for label, command_pattern in specific_probes:
            with self.subTest(label=label):
                self.assertRegex(
                    section,
                    rf'describe_absent "{re.escape(label)}"\s+\\\s+{command_pattern}',
                )

    def test_each_phase_uses_its_exact_saved_plan_guard_before_confirmation(self):
        infra = plan_review_command_block()
        self.assertIn("infra_plan_path=", infra)
        self.assertIn("infra_plan_json=", infra)
        self.assertIn("terraform plan -var='create_workloads=false' -out=\"$infra_plan_path\"", infra)
        self.assertIn('terraform show -json "$infra_plan_path" > "$infra_plan_json"', infra)
        infra_guard = (
            'python3 "$repo_root/scripts/browser_qa/terraform_plan_guard.py" '
            '--phase infra "$infra_plan_json"'
        )
        self.assertIn(infra_guard, infra)
        self.assertLess(infra.index(infra_guard), infra.index("APPLY_BROWSER_QA_INFRA_SAVED_PLAN"))

        workloads = phase_b_command_block()
        self.assertIn("workload_plan_path=", workloads)
        self.assertIn("workload_plan_json=", workloads)
        self.assertIn("terraform plan -var='create_workloads=true' -out=\"$workload_plan_path\"", workloads)
        self.assertIn('terraform show -json "$workload_plan_path" > "$workload_plan_json"', workloads)
        workload_guard = (
            'python3 "$repo_root/scripts/browser_qa/terraform_plan_guard.py" '
            '--phase workloads "$workload_plan_json"'
        )
        self.assertIn(workload_guard, workloads)
        self.assertLess(
            workloads.index(workload_guard),
            workloads.index("APPLY_BROWSER_QA_WORKLOADS_SAVED_PLAN"),
        )

        section = browser_qa_section()
        self.assertNotIn('if "browser_qa" not in address', section)
        self.assertNotRegex(section, r"(?m)^\s*terraform\s+(?:plan|apply)\b[^\n]*\s-target(?:=|\s)")

    def test_phase_a_recovery_section_sits_between_phase_a_and_output_setup(self):
        text = browser_qa_section()
        phase_a_heading = "### 1. Phase A: authenticated refreshing infrastructure plan review"
        recovery_heading = "### 1A. Recover the interrupted Phase A bucket IAM apply"
        output_heading = "### 2. Set output-backed GitHub repository variables"

        for marker in [phase_a_heading, recovery_heading, output_heading]:
            self.assertIn(marker, text)

        self.assertLess(text.index(phase_a_heading), text.index(recovery_heading))
        self.assertLess(text.index(recovery_heading), text.index(output_heading))
        self.assertNotIn(recovery_heading, plan_review_command_block())

    def test_phase_a_recovery_documents_old_saved_plan_is_permanently_invalid(self):
        section = phase_a_recovery_section()

        self.assertRegex(section, r"(?i)old saved plan")
        self.assertRegex(section, r"(?i)permanently invalid")
        self.assertRegex(section, r"(?i)must not be rerun|do not rerun|never rerun")
        self.assertIn("APPLY_BROWSER_QA_INFRA_RECOVERY_SAVED_PLAN", section)

    def test_phase_a_recovery_checks_active_context_before_state_or_plan(self):
        block = phase_a_recovery_command_block()

        account_gate = (
            'expected_account="liu1124789567@gmail.com"\n'
            'expected_project="vocai-gemini-prod"\n'
            'region="us-west1"\n'
            '\n'
            'active_account="$(gcloud auth list --filter=status:ACTIVE --format=\'value(account)\' 2>/dev/null | head -n 1)"\n'
            'if [ "$active_account" != "$expected_account" ]; then\n'
            '  echo "ABORT: active GCP account must be liu1124789567@gmail.com; got ${active_account:-<unset>}" >&2\n'
            '  exit 1\n'
            'fi'
        )
        account_gate_index = block.find(account_gate)
        if account_gate_index == -1:
            raise AssertionError("Phase A recovery active account fail-closed gate not found")

        context_markers = [
            'expected_account="liu1124789567@gmail.com"',
            'active_account="$(gcloud auth list --filter=status:ACTIVE --format=\'value(account)\' 2>/dev/null | head -n 1)"',
            'if [ "$active_account" != "$expected_account" ]; then',
            'active_project="$(gcloud config get-value project 2>/dev/null)"',
            'active_region="$(gcloud config get-value run/region 2>/dev/null)"',
            'ABORT: active GCP account must be liu1124789567@gmail.com; got ${active_account:-<unset>}',
            'ABORT: active GCP project must be vocai-gemini-prod',
            'ABORT: active run region must be us-west1',
        ]
        gated_markers = [
            "terraform init -reconfigure",
            'terraform state list | LC_ALL=C sort > "$actual_pre_recovery_state"',
            'terraform plan -var=\'create_workloads=false\' -out="$recovery_plan_path"',
        ]

        for marker in context_markers + gated_markers:
            with self.subTest(marker=marker):
                self.assertIn(marker, block)

        first_state_or_plan = min(block.index(marker) for marker in gated_markers)
        self.assertLess(account_gate_index + len(account_gate), first_state_or_plan)
        for marker in context_markers:
            with self.subTest(marker=marker):
                self.assertLess(block.index(marker), first_state_or_plan)

    def test_phase_a_recovery_uses_exact_pre_and_post_state_sets(self):
        block = phase_a_recovery_command_block()
        executable = executable_block(block)
        expected_pre_recovery = sorted(PHASE_A_STATE_ADDRESSES - RECOVERY_ADDRESSES)
        expected_full_phase_a = sorted(PHASE_A_STATE_ADDRESSES)

        self.assertEqual(len(expected_pre_recovery), 23)
        self.assertEqual(len(expected_full_phase_a), 26)
        self.assertEqual(
            heredoc_lines(block, "expected-pre-recovery-state.txt", "EOF_PRE_RECOVERY_STATE"),
            expected_pre_recovery,
        )
        self.assertEqual(
            heredoc_lines(block, "expected-full-phase-a-state.txt", "EOF_FULL_PHASE_A_STATE"),
            expected_full_phase_a,
        )

        state_markers = [
            'actual_pre_recovery_state="$review_dir/actual-pre-recovery-state.txt"',
            'terraform state list | LC_ALL=C sort > "$actual_pre_recovery_state"',
            'diff -u "$expected_pre_recovery_state" "$actual_pre_recovery_state"',
            'actual_full_phase_a_state="$review_dir/actual-full-phase-a-state.txt"',
            'terraform state list | LC_ALL=C sort > "$actual_full_phase_a_state"',
            'diff -u "$expected_full_phase_a_state" "$actual_full_phase_a_state"',
        ]
        for marker in state_markers:
            with self.subTest(marker=marker):
                self.assertIn(marker, executable)

        self.assertLess(
            executable.index('terraform state list | LC_ALL=C sort > "$actual_pre_recovery_state"'),
            executable.index('diff -u "$expected_pre_recovery_state" "$actual_pre_recovery_state"'),
        )
        self.assertLess(
            executable.index('diff -u "$expected_pre_recovery_state" "$actual_pre_recovery_state"'),
            executable.index("terraform plan -var='create_workloads=false'"),
        )
        self.assertLess(
            executable.index('terraform apply "$recovery_plan_path"'),
            executable.index('terraform state list | LC_ALL=C sort > "$actual_full_phase_a_state"'),
        )
        self.assertLess(
            executable.index('terraform state list | LC_ALL=C sort > "$actual_full_phase_a_state"'),
            executable.index('diff -u "$expected_full_phase_a_state" "$actual_full_phase_a_state"'),
        )

    def test_phase_a_recovery_plan_guard_confirmation_and_apply_contract(self):
        block = phase_a_recovery_command_block()
        executable = executable_block(block)
        exact_summary_grep = 'grep -Fx -- "Plan: 3 to add, 0 to change, 0 to destroy." "$recovery_plan_text"'
        ordered_markers = [
            'recovery_plan_path="$review_dir/browser-qa-infra-recovery.tfplan"',
            'recovery_plan_json="$review_dir/browser-qa-infra-recovery.tfplan.json"',
            'recovery_plan_text="$review_dir/browser-qa-infra-recovery.tfplan.txt"',
            'terraform plan -var=\'create_workloads=false\' -out="$recovery_plan_path"',
            'terraform show -json "$recovery_plan_path" > "$recovery_plan_json"',
            'terraform show -no-color "$recovery_plan_path" > "$recovery_plan_text"',
            'python3 "$repo_root/scripts/browser_qa/terraform_plan_guard.py" --phase infra-recovery "$recovery_plan_json"',
            exact_summary_grep,
            'Type APPLY_BROWSER_QA_INFRA_RECOVERY_SAVED_PLAN to apply this exact saved plan:',
            'if [ "$APPLY_CONFIRM" = "APPLY_BROWSER_QA_INFRA_RECOVERY_SAVED_PLAN" ]; then',
            'terraform apply "$recovery_plan_path"',
        ]

        for marker in ordered_markers:
            with self.subTest(marker=marker):
                self.assertIn(marker, executable)
        for before, after in zip(ordered_markers, ordered_markers[1:]):
            with self.subTest(before=before, after=after):
                self.assertLess(executable.index(before), executable.index(after))

        apply_index = executable.index('terraform apply "$recovery_plan_path"')
        nonzero_index = executable.index("ABORT: recovery saved plan apply exited non-zero; the plan is invalid.")
        self.assertLess(apply_index, nonzero_index)

    def test_phase_a_recovery_forbids_unsafe_recovery_commands(self):
        block = phase_a_recovery_command_block()

        self.assertNotRegex(block, r"(?m)^\s*terraform\s+(?:plan|apply)\b[^\n]*\s-target(?:=|\s)")
        self.assertNotRegex(block, r"(?m)^\s*terraform\s+plan\b[^\n]*\s-refresh=false\b")
        self.assertNotRegex(block, r"(?m)^\s*terraform\s+import\b")
        self.assertNotRegex(block, r"(?m)^\s*terraform\s+state\s+rm\b")

    def test_phase_a_recovery_requires_temporary_iam_cleanup_before_continuing(self):
        browser_section = browser_qa_section()
        section = phase_a_recovery_section()
        block = phase_a_recovery_command_block()

        cleanup_instruction = (
            "The project IAM administrator must remove the temporary project-level grant "
            "`user:liu1124789567@gmail.com -> roles/storage.admin` immediately after the "
            "3 bucket IAM recovery is applied and the exact 26-address state/bindings are verified."
        )
        continuation_instruction = "Only after that IAM cleanup is complete may the operator continue with outputs, GitHub Variables, Secret versions, and Phase B."

        self.assertIn(cleanup_instruction, section)
        self.assertIn(continuation_instruction, section)
        self.assertIn("user:liu1124789567@gmail.com", section)
        self.assertIn("roles/storage.admin", section)
        self.assertIn("resourcemanager.projects.setIamPolicy", section)
        self.assertRegex(section, r"(?i)remove")
        self.assertNotRegex(section, r"(?i)fully accepted")
        self.assertNotIn("gcloud projects remove-iam-policy-binding", block)

        cleanup_index = section.index(cleanup_instruction)
        continuation_index = section.index(continuation_instruction)
        self.assertLess(section.index('diff -u "$expected_full_phase_a_state" "$actual_full_phase_a_state"'), cleanup_index)
        self.assertLess(cleanup_index, continuation_index)
        output_heading = "### 2. Set output-backed GitHub repository variables"
        self.assertLess(browser_section.index(cleanup_instruction), browser_section.index(output_heading))

    def test_phase_b_requires_exact_phase_a_state_and_enabled_latest_secrets(self):
        block = phase_b_command_block()

        self.assertIn('expected_infra_state="$review_dir/expected-infra-state.txt"', block)
        self.assertIn('actual_infra_state="$review_dir/actual-infra-state.txt"', block)
        self.assertIn('terraform state list | LC_ALL=C sort > "$actual_infra_state"', block)
        self.assertIn('diff -u "$expected_infra_state" "$actual_infra_state"', block)
        for address in sorted(PHASE_A_STATE_ADDRESSES):
            with self.subTest(address=address):
                self.assertIn(address, block)

        for secret in (
            "flatkey-browser-qa-codex-api-key",
            "flatkey-browser-qa-identity-seed",
            "flatkey-browser-qa-gmail-oauth",
        ):
            with self.subTest(secret=secret):
                self.assertIn(secret, block)
        self.assertIn("gcloud secrets versions describe latest", block)
        self.assertIn('--secret="$secret"', block)
        self.assertIn("ENABLED", block)
        self.assertNotIn("gcloud secrets versions access", block)

        self.assertIn('describe_absent "Cloud Run broker service flatkey-staging-browser-qa-broker"', block)
        self.assertIn('describe_absent "Cloud Run job flatkey-staging-browser-qa"', block)
        self.assertIn('describe_absent "Cloud Run job flatkey-staging-browser-qa-cleanup"', block)

    def test_recovery_table_names_exact_guard_and_state_live_preflight(self):
        section = browser_qa_section()
        table_start = section.index("### Recovery and abort rules")
        recovery = section[table_start:]

        self.assertIn("phase-aware Terraform plan guard", recovery)
        self.assertIn("state/live preflight", recovery)
        self.assertIn("partial apply", recovery)
        self.assertIn("saved plan", recovery)
        self.assertIn("separate recovery design", recovery)
        self.assertIn("do not retry", recovery.lower())
        self.assertIn("do not use `-target`", recovery)

    def test_output_backed_values_are_all_read_and_validated_before_first_github_write(self):
        block = output_backed_command_block()
        first_write_index = block.index("gh variable set")

        for variable, output in OUTPUT_BACKED_VARIABLES.items():
            with self.subTest(variable=variable):
                assignment = f'{variable}="$(terraform output -raw {output})"'
                nonempty = f'test -n "${{{variable}}}"'
                not_null = f'test "${{{variable}}}" != "null"'
                self.assertIn(assignment, block)
                self.assertIn(nonempty, block)
                self.assertIn(not_null, block)
                self.assertLess(block.index(assignment), first_write_index)
                self.assertLess(block.index(nonempty), first_write_index)
                self.assertLess(block.index(not_null), first_write_index)

    def test_output_backed_section_documents_non_atomic_safe_rerun(self):
        section = output_backed_section()
        self.assertRegex(section, r"(?i)sequential")
        self.assertRegex(section, r"(?i)non-atomic|not atomic")
        self.assertRegex(section, r"(?i)safe to rerun")
        self.assertRegex(section, r"(?i)partial `gh` failure|partial gh failure")

    def test_output_backed_section_does_not_print_or_change_gmail_base(self):
        block = output_backed_command_block()

        self.assertNotRegex(block, r"(?m)^\s*echo\b")
        self.assertNotRegex(block, r"(?m)^\s*printf\b(?! '%s' \"\$\{GCP_BROWSER_QA_[A-Z0-9_]+\}\" \| gh variable set GCP_BROWSER_QA_[A-Z0-9_]+\b)")
        self.assertNotRegex(block, r"(?m)^\s*(?:export\s+)?GCP_BROWSER_QA_GMAIL_BASE=")
        self.assertNotRegex(block, r"(?m)\b(?:gh variable set|unset|read)\s+GCP_BROWSER_QA_GMAIL_BASE\b")
        self.assertNotIn("FLATKEY_QA_GMAIL_BASE", block)

    def test_gmail_base_stays_stdin_only_and_never_uses_body_argument(self):
        text = browser_qa_section()
        self.assertIn("GCP_BROWSER_QA_GMAIL_BASE", text)
        self.assertIn('IFS= read -rsp "Base Gmail address without plus tag: " GCP_BROWSER_QA_GMAIL_BASE', text)
        self.assertRegex(
            text,
            r"gh variable set GCP_BROWSER_QA_GMAIL_BASE\s+\\\s+--repo SolveaCX/new-api\s+\\\s+< \"\$tmp_var\"",
        )
        self.assertNotIn("--body", "\n".join(fenced_blocks(text)))

    def test_output_and_report_lookup_use_independent_root(self):
        section = browser_qa_section()

        self.assertIn(f'terraform -chdir="$repo_root/{BROWSER_QA_ROOT}" output -raw browser_qa_report_bucket', section)
        self.assertIn(f'cd "$repo_root/{BROWSER_QA_ROOT}"', output_backed_command_block())
        self.assertIn('BROKER_URI="$(terraform output -raw browser_qa_broker_uri)"', section)


if __name__ == "__main__":
    unittest.main()
