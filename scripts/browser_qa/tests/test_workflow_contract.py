import base64
import copy
import json
import pathlib
import re
import subprocess
import sys
import tempfile
import unittest
import yaml


REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]
WORKFLOW = REPO_ROOT / ".github" / "workflows" / "gcp-browser-qa.yml"
STAGING_DEPLOY_WORKFLOW = REPO_ROOT / ".github" / "workflows" / "gcp-deploy-staging.yml"


def workflow_text():
    return WORKFLOW.read_text(encoding="utf-8")


def staging_deploy_workflow_text():
    return STAGING_DEPLOY_WORKFLOW.read_text(encoding="utf-8")


def strip_comments(text):
    return "\n".join(line.split("#", 1)[0].rstrip() for line in text.splitlines())


def step_block(text, name):
    match = re.search(
        rf"(?ms)^      - name: {re.escape(name)}\n(?P<body>.*?)(?=^      - name: |\Z)",
        text,
    )
    if not match:
        raise AssertionError(f"step not found: {name}")
    return match.group("body")


def run_blocks(text):
    return re.findall(r"(?ms)^        run: \|\n(?P<body>.*?)(?=^      - name: |\Z)", text)


def job_block(text, name):
    match = re.search(
        rf"(?ms)^  {re.escape(name)}:\n(?P<body>.*?)(?=^  [A-Za-z0-9_-]+:\n|\Z)",
        text,
    )
    if not match:
        raise AssertionError(f"job not found: {name}")
    return match.group("body")


def qa_dependent_rollback_jobs(text):
    rollback = re.compile(r"(?i)\b(rollback|restore|update-traffic|traffic restoration)\b")
    offenders = []
    for match in re.finditer(
        r"(?ms)^  (?P<name>[A-Za-z0-9_-]+):\n(?P<body>.*?)(?=^  [A-Za-z0-9_-]+:\n|\Z)",
        text,
    ):
        body = match.group("body")
        needs = re.search(
            r"(?ms)^    needs:(?P<inline>[^\n]*)(?P<block>(?:\n      [^\n]*)*)",
            body,
        )
        if needs and re.search(r"\bbrowser-qa-(?:core|normal)\b", needs.group(0)):
            job = f"{match.group('name')}\n{body}"
            if rollback.search(job):
                offenders.append(match.group("name"))
    return offenders


def summary_python_script():
    block = step_block(workflow_text(), "Fetch sanitized manifest and write summary")
    match = re.search(r"(?ms)<<'PY'\n(?P<script>.*?)^          PY\s*$", block)
    if not match:
        raise AssertionError("summary python heredoc not found")
    return re.sub(r"(?m)^          ", "", match.group("script"))


def run_summary_python(manifest, *, main_outcome="success", cleanup_outcome="success", mode="normal"):
    with tempfile.TemporaryDirectory() as tmp:
        root = pathlib.Path(tmp)
        manifest_path = root / "manifest.json"
        output_path = root / "github-output.txt"
        summary_path = root / "github-summary.md"
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
        output_path.write_text("", encoding="utf-8")
        summary_path.write_text("", encoding="utf-8")
        env = {
            "EFFECTIVE_RUN_ID": "12345",
            "GITHUB_OUTPUT": str(output_path),
            "GITHUB_STEP_SUMMARY": str(summary_path),
        }
        completed = subprocess.run(
            [
                sys.executable,
                "-c",
                summary_python_script(),
                str(manifest_path),
                "gs://flatkey-browser-qa-reports/runs/12345/manifest.json",
                main_outcome,
                cleanup_outcome,
                mode,
            ],
            env=env,
            check=True,
            capture_output=True,
            text=True,
        )
        output = output_path.read_text(encoding="utf-8")
        outputs = dict(
            line.split("=", 1)
            for line in output.splitlines()
            if line and "=" in line
        )
        if "manifest_status" not in outputs:
            raise AssertionError(f"manifest_status missing; stdout={completed.stdout!r} stderr={completed.stderr!r}")
        return outputs, summary_path.read_text(encoding="utf-8")


def summarized_root_manifest(status, *, summary=None):
    if summary is None:
        summary = {
            "replay_status": "passed",
            "exploration_status": "not_started",
            "exploration_actions": 0,
            "finding_count": 0,
        }
    return {
        "schema_version": 1,
        "run_id": "12345",
        "status": status,
        "latest": {"main_execution_id": "main-001", "cleanup_execution_id": None},
        "executions": [
            {
                "kind": "main",
                "execution_id": "main-001",
                "manifest": "runs/12345/main/main-001/manifest.json",
                "status": status,
                "created_at": 1,
                "summary": summary,
            }
        ],
    }


def safe_finding_summaries():
    return [
        {
            "severity": "high",
            "title": "Checkout exposes a blocking validation error",
            "confidence": "high",
            "page_path": "/checkout",
        },
        {
            "severity": "medium",
            "title": "付款页展示中文错误",
            "confidence": "medium",
            "page_path": "/billing/payment",
        },
    ]


def canonical_finding_summaries_b64(summaries):
    return base64.urlsafe_b64encode(
        json.dumps(summaries, ensure_ascii=False, separators=(",", ":")).encode()
    ).decode("ascii")


def complete_new_main_summary(*, finding_summaries=None):
    if finding_summaries is None:
        finding_summaries = []
    return {
        "replay_status": "passed",
        "exploration_status": "passed",
        "exploration_actions": 7,
        "finding_count": len(finding_summaries),
        "finding_summaries": finding_summaries,
        "coverage_candidate_count": 2,
        "fixed_case_status": "passed",
        "fixed_case_count": 2,
        "fixed_case_failed_count": 0,
        "phase_trace": ["replay_done", "fixed_cases_done", "exploration_started", "finalization_started"],
    }


def candidate_pr_job_condition():
    candidate = job_block(workflow_text(), "candidate-pr")
    match = re.search(r"(?m)^    if: \$\{\{ (?P<condition>.+) \}\}$", candidate)
    if not match:
        raise AssertionError("candidate-pr job condition not found")
    return match.group("condition")


def evaluate_candidate_pr_condition(condition, *, upstream_result, bundle_count):
    expected_pattern = (
        "always() && needs.browser-qa.result == 'success' && "
        "needs.browser-qa.outputs.candidate_pr_bundle_count != '0'"
    )
    if condition != expected_pattern:
        raise AssertionError(f"candidate-pr condition drifted: {condition!r}")
    return upstream_result == "success" and bundle_count != "0"


class BrowserQaWorkflowContractTests(unittest.TestCase):
    def test_workflow_yaml_is_parseable(self):
        parsed = yaml.safe_load(workflow_text())

        self.assertIsInstance(parsed, dict)
        self.assertIn("jobs", parsed)
        self.assertIn("browser-qa", parsed["jobs"])
        self.assertIn("candidate-pr", parsed["jobs"])

    def test_browser_qa_job_keeps_gcp_permissions_and_candidate_pr_job_is_github_only(self):
        text = workflow_text()
        browser = job_block(text, "browser-qa")
        candidate = job_block(text, "candidate-pr")

        self.assertRegex(browser, r"(?m)^    permissions:\n      contents: read\n      id-token: write\b")
        self.assertRegex(candidate, r"(?m)^    needs: browser-qa$")
        self.assertRegex(candidate, r"(?m)^    permissions:\n      contents: write\n      pull-requests: write\s*(?:\n    |\Z)")
        self.assertNotIn("id-token: write", candidate)
        self.assertNotIn("google-github-actions/auth", candidate)
        self.assertNotIn("workload_identity_provider", candidate)
        self.assertNotIn("service_account", candidate)
        self.assertNotRegex(candidate, r"\bgcloud\b|Secret Manager|secretmanager")
        self.assertIn("actions/download-artifact@v4", candidate)
        self.assertIn("browser-qa-candidate-pr-bundles", candidate)
        self.assertIn("GITHUB_TOKEN: ${{ github.token }}", candidate)
        self.assertNotIn("--token", candidate)

    def test_staging_reusable_browser_qa_caller_permissions_are_called_job_union_ceiling(self):
        called = yaml.safe_load(workflow_text())
        staging = yaml.safe_load(staging_deploy_workflow_text())

        browser_permissions = called["jobs"]["browser-qa"]["permissions"]
        candidate_permissions = called["jobs"]["candidate-pr"]["permissions"]
        caller_permissions = staging["jobs"]["browser-qa-normal"]["permissions"]

        self.assertEqual(
            browser_permissions,
            {
                "contents": "read",
                "id-token": "write",
            },
        )
        self.assertEqual(
            candidate_permissions,
            {
                "contents": "write",
                "pull-requests": "write",
            },
        )
        self.assertNotIn("id-token", candidate_permissions)
        self.assertNotIn("workload_identity_provider", job_block(workflow_text(), "candidate-pr"))
        self.assertNotIn("service_account", job_block(workflow_text(), "candidate-pr"))
        self.assertEqual(
            caller_permissions,
            {
                "contents": "write",
                "pull-requests": "write",
                "id-token": "write",
            },
        )

    def test_normal_and_promotion_only_upload_same_sanitized_candidate_pr_bundle_artifact_schema(self):
        text = workflow_text()
        normal = step_block(text, "Validate candidate promotion attempts")
        recovery = step_block(text, "Recover candidate promotion from existing manifests")

        for block in [normal, recovery]:
            self.assertIn("browser-qa-candidate-pr-bundles", block)
            self.assertIn("candidate_pr_bundle", block)
            self.assertIn("schema_version", block)
            self.assertIn("fixed_case", block)
            self.assertIn("fingerprint", block)
            self.assertIn("branch", block)
            self.assertIn("promotion", block)
            self.assertIn("source", block)
            self.assertNotRegex(block, r"(?i)Authorization|oauth|DINGTALK|webhook|api[_-]?key|secret|console\.jsonl|network\.jsonl|screenshots|codex-events|stderr|result\.json")
        self.assertEqual(normal.count("browser-qa-candidate-pr-bundles"), recovery.count("browser-qa-candidate-pr-bundles"))

    def test_candidate_pr_job_noops_for_zero_candidates_and_does_not_move_existing_final_gate_or_notification(self):
        text = workflow_text()
        candidate = job_block(text, "candidate-pr")

        self.assertRegex(candidate, r"(?m)^    if: .+candidate_pr_bundle_count.+0")
        self.assertIn("python3 -B -m scripts.browser_qa.flatkey_browser_qa.github_candidate_pr", candidate)
        self.assertLess(text.index("- name: Send terminal Browser QA report to DingTalk"), text.index("- name: Fail standalone workflow for actionable QA states"))
        self.assertLess(text.index("- name: Execute cleanup browser QA job"), text.index("- name: Fetch sanitized manifest and write summary"))
        self.assertLess(text.index("- name: Fetch sanitized manifest and write summary"), text.index("- name: Validate candidate promotion attempts"))

    def test_candidate_pr_job_runs_only_after_successful_browser_qa_with_nonzero_bundle_count(self):
        condition = candidate_pr_job_condition()
        cases = [
            ("success", "1", True),
            ("success", "0", False),
            ("failure", "1", False),
            ("cancelled", "1", False),
            ("skipped", "1", False),
        ]
        for upstream_result, bundle_count, expected in cases:
            with self.subTest(upstream_result=upstream_result, bundle_count=bundle_count):
                self.assertIs(
                    evaluate_candidate_pr_condition(
                        condition,
                        upstream_result=upstream_result,
                        bundle_count=bundle_count,
                    ),
                    expected,
                )

    def test_staging_default_qa_is_normal_without_temporary_qualification_surface(self):
        text = staging_deploy_workflow_text()
        uncommented = strip_comments(text)

        self.assertFalse(
            (REPO_ROOT / ".github" / "workflows" / "gcp-browser-qa-normal-qualification.yml").exists(),
            "temporary qualification branch-push wrapper workflow must be removed",
        )
        self.assertNotIn("browser_qa_qualification_only", uncommented)
        self.assertNotRegex(uncommented, r"browser-qa-qualification/\*\*")
        jobs_section = text.split("\njobs:\n", 1)[1]
        self.assertNotRegex(jobs_section, r"(?m)^  browser-qa-core:\n")
        self.assertNotRegex(jobs_section, r"(?m)^  browser-qa-normal-qualification:\n")
        self.assertEqual(len(re.findall(r"(?m)^  browser-qa-normal:\n", jobs_section)), 1)

    def test_staging_deploy_topology_runs_single_normal_after_deploy(self):
        text = staging_deploy_workflow_text()

        build = job_block(text, "build")
        self.assertNotRegex(build, r"(?m)^    if:")
        deploy = job_block(text, "deploy")
        self.assertRegex(deploy, r"(?m)^    needs: build$")
        qa = job_block(text, "browser-qa-normal")
        self.assertRegex(qa, r"(?m)^    needs: deploy$")
        self.assertRegex(qa, r"(?m)^    uses: \./\.github/workflows/gcp-browser-qa\.yml$")
        self.assertRegex(qa, r"(?m)^    permissions:\n      # Reusable workflow calls cannot elevate permissions inside the called workflow;\n      # this caller ceiling is the exact union of called jobs, not an expansion of browser-qa\.\n      contents: write\n      pull-requests: write\n      id-token: write\b")
        self.assertRegex(qa, r"(?ms)^    with:\n      mode: normal\n      fail_on_findings: false\b")
        self.assertNotIn("original_run_id", qa)
        self.assertRegex(
            qa,
            r"(?ms)^    secrets:\n"
            r"      STAGING_BROWSER_QA_DINGTALK_WEBHOOK: \$\{\{ secrets\.STAGING_BROWSER_QA_DINGTALK_WEBHOOK \}\}\n"
            r"      STAGING_BROWSER_QA_DINGTALK_SIGNING_SECRET: \$\{\{ secrets\.STAGING_BROWSER_QA_DINGTALK_SIGNING_SECRET \}\}\s*$",
        )
        self.assertNotIn("secrets: inherit", qa)

    def test_workflow_supports_manual_dispatch_and_reusable_call_with_minimal_permissions_and_serial_concurrency(self):
        text = workflow_text()
        uncommented = strip_comments(text)

        self.assertRegex(uncommented, r"(?m)^on:\n  workflow_dispatch:\n")
        self.assertRegex(uncommented, r"(?m)^  workflow_call:\n")
        self.assertNotRegex(uncommented, r"(?m)^  (push|pull_request|schedule):\s*$")
        self.assertRegex(uncommented, r"(?ms)^  workflow_call:\n    inputs:\n      mode:\n        .*?required: true\n        .*?type: string\b")
        self.assertRegex(uncommented, r"(?ms)^  workflow_call:\n    inputs:\n.*?      original_run_id:\n        .*?required: false\n        .*?type: string\b")
        self.assertRegex(
            uncommented,
            r"(?ms)^  workflow_call:\n    inputs:\n.*?    secrets:\n"
            r"      STAGING_BROWSER_QA_DINGTALK_WEBHOOK:\n        required: true\n"
            r"      STAGING_BROWSER_QA_DINGTALK_SIGNING_SECRET:\n        required: true\b",
        )
        self.assertRegex(uncommented, r"(?ms)^permissions:\n  contents: read\n  id-token: write\b")
        self.assertEqual(len(re.findall(r"(?m)^concurrency:\s*$", uncommented)), 1)
        self.assertRegex(uncommented, r"(?ms)^concurrency:\n  group: .+\n  queue: max\n  cancel-in-progress: false\b")

    def test_dispatch_inputs_cover_normal_core_and_cleanup_only_with_original_run_id(self):
        text = workflow_text()
        self.assertRegex(text, r"(?ms)^      mode:\n        .*?type: choice\n        .*?options:\n          - normal\n          - core\n          - cleanup-only\n          - promotion-only")
        self.assertRegex(text, r"(?ms)^      original_run_id:\n        .*?description: .*(cleanup-only|promotion-only).*original.*run.*id")
        validate = step_block(text, "Validate dispatch inputs")
        self.assertIn("DISPATCH_MODE", validate)
        self.assertIn("DISPATCH_ORIGINAL_RUN_ID", validate)
        self.assertRegex(validate, r"case \"\$\{DISPATCH_MODE\}\" in[\s\S]*normal\|core\|cleanup-only\|promotion-only")
        self.assertRegex(validate, r"if \[\[ \"\$\{DISPATCH_MODE\}\" == \"cleanup-only\" \|\| \"\$\{DISPATCH_MODE\}\" == \"promotion-only\" \]\]; then[\s\S]*original_run_id")
        self.assertRegex(validate, r"if \[\[ ! \"\$\{DISPATCH_ORIGINAL_RUN_ID\}\" =~ \^\[0-9\]\+\$ \]\]; then")

    def test_fail_on_findings_is_boolean_dispatch_and_call_input_validated_through_env(self):
        text = workflow_text()
        self.assertRegex(
            text,
            r"(?ms)^      fail_on_findings:\n"
            r"        description: \"Fail the workflow when browser QA reports sanitized exploratory findings\"\n"
            r"        required: false\n"
            r"        default: false\n"
            r"        type: boolean\b",
        )
        self.assertRegex(
            text,
            r"(?ms)^  workflow_call:\n    inputs:\n.*?      fail_on_findings:\n"
            r"        description: \"Fail the workflow when browser QA reports sanitized exploratory findings\"\n"
            r"        required: false\n"
            r"        default: false\n"
            r"        type: boolean\b",
        )
        validate = step_block(text, "Validate dispatch inputs")
        self.assertRegex(validate, r"(?m)^          DISPATCH_FAIL_ON_FINDINGS: \$\{\{ inputs\.fail_on_findings \}\}$")
        self.assertRegex(validate, r"case \"\$\{DISPATCH_FAIL_ON_FINDINGS\}\" in[\s\S]*true\|false")
        self.assertIn("echo \"FAIL_ON_FINDINGS=${DISPATCH_FAIL_ON_FINDINGS}\"", validate)

    def test_dispatch_inputs_are_not_interpolated_inside_shell_run_blocks(self):
        for index, block in enumerate(run_blocks(workflow_text())):
            with self.subTest(run_block=index):
                self.assertNotIn("${{ inputs.", block)

    def test_workflow_uses_dedicated_qa_identity_and_never_names_production_environment(self):
        text = workflow_text()
        self.assertIn("GCP_BROWSER_QA_WIF_PROVIDER", text)
        self.assertIn("GCP_BROWSER_QA_DEPLOYER_SA", text)
        self.assertNotIn("vars.GCP_WIF_PROVIDER", text)
        self.assertNotIn("vars.GCP_DEPLOYER_SA", text)
        self.assertNotRegex(text, r"(?mi)^\s*environment:\s*(production|prod|staging)\b")
        self.assertNotRegex(text, r"(?i)\bproduction\b|\bprod\b")

    def test_image_is_sha_bound_and_only_qa_resources_are_mutated(self):
        text = workflow_text()
        self.assertRegex(text, r"browser-qa:\$\{\{ github\.sha \}\}-\$\{\{ github\.run_attempt \}\}")
        self.assertNotRegex(text, r"browser-qa:(latest|\$\{\{ github\.ref_name \}\})")
        self.assertIn("flatkey-staging-browser-qa-broker", text)
        self.assertIn("flatkey-staging-browser-qa", text)
        self.assertIn("flatkey-staging-browser-qa-cleanup", text)
        names = sorted(set(re.findall(r"(?:QA_\w+): (flatkey-[A-Za-z0-9-]+)", text)))
        self.assertEqual(
            names,
            [
                "flatkey-staging-browser-qa",
                "flatkey-staging-browser-qa-broker",
                "flatkey-staging-browser-qa-cleanup",
            ],
        )

    def test_repo_tests_run_from_checkout_before_the_runtime_image_is_built(self):
        text = workflow_text()
        test_step_name = "Run browser QA unit and contract tests"
        test_step = step_block(text, test_step_name)
        self.assertIn("if: ${{ inputs.mode == 'normal' || inputs.mode == 'core' }}", test_step)
        self.assertIn(
            "python3 -B -m unittest discover -s scripts/browser_qa/tests -v",
            test_step,
        )
        self.assertLess(text.index(f"- name: {test_step_name}"), text.index("- name: Build browser QA image"))

    def test_normal_path_smokes_image_before_push_and_skips_mutation_for_cleanup_only(self):
        text = workflow_text()
        smoke = step_block(text, "Smoke test browser QA image")
        self.assertIn("docker inspect --format='{{.Config.User}}'", smoke)
        self.assertIn("docker run --rm --entrypoint sh", smoke)
        self.assertIn("id -u", smoke)
        self.assertIn("--entrypoint codex", smoke)
        self.assertIn("--version", smoke)
        self.assertIn("--entrypoint playwright-mcp", smoke)
        self.assertIn("--entrypoint python3", smoke)
        self.assertNotIn("-m unittest discover -s /opt/flatkey-browser-qa/tests -v", smoke)
        self.assertNotIn("unittest", smoke)
        self.assertNotIn("runtime_test_modules", smoke)
        self.assertNotIn("/opt/flatkey-browser-qa/tests", smoke)
        self.assertIn("docker run --rm -i --entrypoint python3", smoke)
        self.assertIn("ChromiumRuntime", smoke)
        self.assertIn("startup_stderr_limit_bytes=8192", smoke)
        self.assertIn("playwright_child_command", smoke)
        self.assertIn("communicate", smoke)
        self.assertIn("timeout=", smoke)
        self.assertIn('"method": "initialize"', smoke)
        self.assertIn('"method": "tools/list"', smoke)
        self.assertNotIn("chromium.launchServer", smoke)
        self.assertNotIn("printenv", smoke)
        self.assertNotIn("env |", smoke)
        self.assertNotRegex(smoke, r"(?i)\becho\b[^\n]*(email|password|cookie|authorization|api[_-]?key|token|secret)")
        for step in [
            "Build browser QA image",
            "Smoke test browser QA image",
            "Push browser QA image",
            "Update browser QA Cloud Run resources",
            "Execute main browser QA job",
        ]:
            block = step_block(text, step)
            self.assertRegex(block, r"(?m)^        if: \$\{\{ inputs\.mode == 'normal' \|\| inputs\.mode == 'core' \}\}$")

    def test_resource_update_step_only_updates_images_without_persistent_env_secret_or_args_mutation(self):
        text = workflow_text()
        update = step_block(text, "Update browser QA Cloud Run resources")
        self.assertNotIn("--update-secrets", update)
        self.assertNotIn("--update-env-vars", update)
        self.assertNotIn("--args=", update)
        self.assertEqual(update.count("gcloud run services update"), 1)
        self.assertEqual(update.count("gcloud run jobs update"), 2)
        for command in re.findall(r"gcloud run (?:services|jobs) update[\s\S]*?(?=\n          gcloud run |\Z)", update):
            self.assertIn("--image=\"${IMAGE_URI}\"", command)
            self.assertNotRegex(command, r"--(update-secrets|update-env-vars|args)=")

    def test_resource_update_gives_only_the_main_job_two_gibibytes_of_memory(self):
        update = step_block(workflow_text(), "Update browser QA Cloud Run resources")
        commands = re.findall(
            r"gcloud run (?:services|jobs) update[\s\S]*?(?=\n          gcloud run |\Z)",
            update,
        )
        self.assertEqual(len(commands), 3)

        main = next(command for command in commands if '"${QA_MAIN_JOB}"' in command)
        broker = next(command for command in commands if '"${QA_BROKER_SERVICE}"' in command)
        cleanup = next(command for command in commands if '"${QA_CLEANUP_JOB}"' in command)

        self.assertIn('--memory="2Gi"', main)
        self.assertNotIn("--memory=", broker)
        self.assertNotIn("--memory=", cleanup)
        self.assertNotIn("--cpu=", update)

    def test_main_and_cleanup_execute_with_wait_and_cleanup_is_unconditional(self):
        text = workflow_text()
        main = step_block(text, "Execute main browser QA job")
        cleanup = step_block(text, "Execute cleanup browser QA job")
        self.assertRegex(main, r"gcloud run jobs execute \"\$\{QA_MAIN_JOB\}\"[\s\S]*--wait")
        self.assertRegex(cleanup, r"gcloud run jobs execute \"\$\{QA_CLEANUP_JOB\}\"[\s\S]*--wait")
        self.assertRegex(cleanup, r"(?m)^        if: \${\{ always\(\) && steps\.qa\.outcome == 'success' && inputs\.mode != 'promotion-only' \}\}$")
        self.assertIn("MAIN_STATUS", main)
        self.assertIn("main_status", main)
        self.assertIn("EFFECTIVE_RUN_ID", main)
        self.assertIn("EFFECTIVE_RUN_ID", cleanup)
        self.assertIn("FLATKEY_QA_RUN_ID=${EFFECTIVE_RUN_ID}", main)
        self.assertIn("FLATKEY_QA_RUN_ID=${EFFECTIVE_RUN_ID}", cleanup)
        self.assertIn("FLATKEY_BROWSER_QA_MODE=${BROWSER_QA_MODE}", main)

    def test_gmail_base_is_runtime_var_only_for_validation_and_main_execution(self):
        text = workflow_text()
        validate = step_block(text, "Validate dispatch inputs")
        main = step_block(text, "Execute main browser QA job")
        cleanup = step_block(text, "Execute cleanup browser QA job")

        self.assertNotRegex(text, r"@gmail\.com\b")
        self.assertNotRegex(text, r"(?m)^  QA_GMAIL_BASE:")
        self.assertRegex(validate, r"(?m)^          QA_GMAIL_BASE: \$\{\{ vars\.GCP_BROWSER_QA_GMAIL_BASE \}\}$")
        self.assertRegex(main, r"(?m)^          QA_GMAIL_BASE: \$\{\{ vars\.GCP_BROWSER_QA_GMAIL_BASE \}\}$")
        self.assertNotIn("QA_GMAIL_BASE", cleanup)

        validate_run = re.search(r"(?ms)^        run: \|\n(?P<body>.*?)(?=^      - name: |\Z)", validate).group("body")
        cleanup_branch = re.search(r"(?ms)if \[\[ \"\$\{DISPATCH_MODE\}\" == \"cleanup-only\" \|\| \"\$\{DISPATCH_MODE\}\" == \"promotion-only\" \]\]; then(?P<body>.*?)else", validate_run)
        self.assertIsNotNone(cleanup_branch)
        self.assertNotIn("QA_GMAIL_BASE", cleanup_branch.group("body"))
        self.assertRegex(validate_run, r"if \[\[ -z \"\$\{QA_GMAIL_BASE\}\" \]\]; then[\s\S]*GCP_BROWSER_QA_GMAIL_BASE")
        self.assertIn('"${QA_GMAIL_BASE}" =~ ^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$', validate_run)
        for forbidden_pattern in [
            '"${QA_GMAIL_BASE}" == *+*',
            '"${QA_GMAIL_BASE}" == *,*',
            '"${QA_GMAIL_BASE}" == *$\'\\r\'*',
            '"${QA_GMAIL_BASE}" == *$\'\\n\'*',
        ]:
            self.assertIn(forbidden_pattern, validate_run)
        self.assertNotRegex(validate_run, r"echo[^\n]*\$\{QA_GMAIL_BASE\}")

        self.assertIn("FLATKEY_QA_GMAIL_BASE=${QA_GMAIL_BASE}", main)
        self.assertNotIn("FLATKEY_QA_GMAIL_BASE", cleanup)
        for step in [
            "Build browser QA image",
            "Smoke test browser QA image",
            "Push browser QA image",
            "Update browser QA Cloud Run resources",
            "Fetch sanitized manifest and write summary",
            "Send terminal Browser QA report to DingTalk",
            "Fail standalone workflow for actionable QA states",
        ]:
            self.assertNotIn("QA_GMAIL_BASE", step_block(text, step))

    def test_fetches_only_sanitized_root_manifest_and_summary_stays_non_secret(self):
        text = workflow_text()
        summary = step_block(text, "Fetch sanitized manifest and write summary")
        self.assertIn("runs/${EFFECTIVE_RUN_ID}/manifest.json", summary)
        self.assertNotIn("result.json", summary)
        self.assertNotIn("codex-events.jsonl", summary)
        self.assertNotIn("codex-stderr.txt", summary)
        self.assertNotIn("screenshots", summary)
        for safe_field in ["replay", "exploration", "finding", "cleanup", "status", "gcs_uri"]:
            self.assertIn(safe_field, summary)
        self.assertNotRegex(summary, r"(?i)email|password|cookie|authorization|api[_-]?key|token|verification")
        self.assertIn("latest.main_execution_id", summary)
        self.assertIn("summary", summary)
        self.assertIn("validate_root_manifest", summary)
        self.assertNotIn("main_record.get(\"result\"", summary)

    def test_manifest_exports_the_complete_sanitized_notification_contract(self):
        text = workflow_text()
        summary = step_block(text, "Fetch sanitized manifest and write summary")
        for output_name in [
            "manifest_status",
            "replay_status",
            "exploration_status",
            "exploration_actions",
            "finding_count",
            "cleanup_status",
            "gcs_uri",
            "finding_summaries_b64",
        ]:
            self.assertRegex(summary, rf"(?m)(echo|output\.write).*{output_name}=")

        outputs, _rendered = run_summary_python(summarized_root_manifest("passed"))
        self.assertEqual(
            outputs,
            {
                "manifest_status": "passed",
                "replay_status": "passed",
                "exploration_status": "not_started",
                "exploration_actions": "0",
                "finding_count": "0",
                "cleanup_status": "unknown",
                "gcs_uri": "gs://flatkey-browser-qa-reports/runs/12345/manifest.json",
                "finding_summaries_b64": "W10=",
            },
        )

    def test_summary_python_allows_only_sanitized_root_candidate_metadata_without_outputting_it(self):
        outputs, rendered = run_summary_python(
            {
                **summarized_root_manifest("passed"),
                "candidates": [],
                "candidate_events": [{"kind": "candidate_bundle_failed", "candidate_kind": "coverage"}],
            },
        )
        self.assertEqual(outputs["manifest_status"], "passed")
        self.assertNotIn("candidate_bundle_failed", rendered)
        self.assertNotIn("candidate_kind", rendered)

        outputs, _rendered = run_summary_python(
            {**summarized_root_manifest("passed"), "candidate_debug": []},
        )
        self.assertEqual(outputs["manifest_status"], "infrastructure_failed")

        outputs, _rendered = run_summary_python(
            {
                **summarized_root_manifest("passed"),
                "candidate_events": [{"kind": "candidate_bundle_failed", "candidate_kind": "unknown"}],
            },
        )
        self.assertEqual(outputs["manifest_status"], "infrastructure_failed")

    def test_summary_python_exports_canonical_safe_finding_summaries_base64(self):
        summaries = safe_finding_summaries()
        manifest = summarized_root_manifest(
            "findings_detected",
            summary={
                "replay_status": "passed",
                "exploration_status": "passed",
                "exploration_actions": 7,
                "finding_count": len(summaries),
                "finding_summaries": summaries,
            },
        )

        outputs, _rendered = run_summary_python(
            manifest,
            main_outcome="failure",
            cleanup_outcome="success",
        )

        encoded = outputs["finding_summaries_b64"]
        self.assertEqual(encoded, canonical_finding_summaries_b64(summaries))
        self.assertEqual(
            json.loads(base64.urlsafe_b64decode(encoded.encode("ascii")).decode()),
            summaries,
        )

    def test_summary_python_accepts_complete_new_main_summary_schema_and_keeps_findings(self):
        summaries = safe_finding_summaries()
        manifest = summarized_root_manifest(
            "findings_detected",
            summary=complete_new_main_summary(finding_summaries=summaries),
        )

        outputs, rendered = run_summary_python(
            manifest,
            main_outcome="failure",
            cleanup_outcome="success",
        )

        self.assertEqual(outputs["manifest_status"], "findings_detected")
        self.assertEqual(outputs["finding_summaries_b64"], canonical_finding_summaries_b64(summaries))
        self.assertIn("- status: findings_detected", rendered)
        self.assertIn("- finding count: 2", rendered)

        malicious_manifest = summarized_root_manifest(
            "findings_detected",
            summary={**complete_new_main_summary(finding_summaries=summaries), "unexpected": "fail-closed"},
        )
        outputs, _rendered = run_summary_python(
            malicious_manifest,
            main_outcome="failure",
            cleanup_outcome="success",
        )
        self.assertEqual(outputs["manifest_status"], "infrastructure_failed")
        self.assertEqual(outputs["finding_summaries_b64"], "W10=")

    def test_summary_python_rejects_malicious_finding_summary_fields_as_infrastructure_failed(self):
        base_manifest = summarized_root_manifest(
            "findings_detected",
            summary={
                "replay_status": "passed",
                "exploration_status": "passed",
                "exploration_actions": 7,
                "finding_count": 1,
                "finding_summaries": safe_finding_summaries()[:1],
            },
        )
        cases = [
            ("extra_field", {"extra": "nope"}),
            ("info_severity", {"severity": "info"}),
            ("bad_confidence", {"confidence": "certain"}),
            ("multiline_title", {"title": "line one\nline two"}),
            ("long_title", {"title": "x" * 161}),
            ("query_path", {"page_path": "/checkout?token=secret"}),
            ("fragment_path", {"page_path": "/checkout#card"}),
            ("relative_path", {"page_path": "checkout"}),
            ("email_title", {"title": "owner@example.com"}),
            ("openai_key_title", {"title": "".join(chr(code) for code in (115, 107, 45)) + "abcdef123456"}),
            ("english_sensitive_title", {"title": "password leaked"}),
            ("localized_sensitive_title", {"title": "\u5bc6\u7801\u6cc4\u9732"}),
            ("six_digit_code_title", {"title": "123456"}),
            ("unicode_category_c_title", {"title": "bad\u202eformat"}),
        ]
        for name, patch in cases:
            with self.subTest(name=name):
                manifest = copy.deepcopy(base_manifest)
                manifest["executions"][0]["summary"]["finding_summaries"][0].update(patch)
                outputs, _rendered = run_summary_python(
                    manifest,
                    main_outcome="failure",
                    cleanup_outcome="success",
                )
                self.assertEqual(outputs["manifest_status"], "infrastructure_failed")
                self.assertEqual(outputs["finding_summaries_b64"], "W10=")

    def test_workflow_contract_source_has_no_contiguous_secret_key_prefix_fixture(self):
        source = pathlib.Path(__file__).read_text(encoding="utf-8")
        scanner_prefix = "".join(chr(code) for code in (115, 107, 45))

        self.assertNotIn(scanner_prefix, source)

    def test_summary_status_priority_keeps_cleanup_failure_stronger_than_root_status(self):
        text = workflow_text()
        summary = step_block(text, "Fetch sanitized manifest and write summary")
        self.assertIn("cleanup_outcome", summary)
        self.assertIn("main_outcome", summary)
        self.assertIn("qa_mode", summary)
        self.assertRegex(summary, r"if qa_mode != \"promotion-only\" and cleanup_outcome != \"success\"[\s\S]*status = \"cleanup_failed\"")
        self.assertRegex(summary, r"elif manifest_error is not None[\s\S]*status = \"infrastructure_failed\"")
        self.assertRegex(summary, r"elif main_outcome == \"failure\" and root_status == \"passed\"[\s\S]*status = \"infrastructure_failed\"")

    def test_summary_python_preserves_trusted_root_status_for_intentional_main_failures(self):
        cases = [
            ("replay_failed", "failure", "success", "replay_failed"),
            ("findings_detected", "failure", "success", "findings_detected"),
            ("passed", "failure", "success", "infrastructure_failed"),
            ("replay_failed", "failure", "failure", "cleanup_failed"),
            ("infrastructure_failed", "failure", "success", "infrastructure_failed"),
            ("replay_failed", "cancelled", "success", "infrastructure_failed"),
        ]
        for root_status, main_outcome, cleanup_outcome, expected in cases:
            with self.subTest(root_status=root_status, main_outcome=main_outcome, cleanup_outcome=cleanup_outcome):
                outputs, rendered = run_summary_python(
                    summarized_root_manifest(root_status),
                    main_outcome=main_outcome,
                    cleanup_outcome=cleanup_outcome,
                )
                self.assertEqual(outputs["manifest_status"], expected)
                self.assertIn(f"- status: {expected}", rendered)

        outputs, rendered = run_summary_python(
            {**summarized_root_manifest("passed"), "schema_version": 99},
            main_outcome="success",
            cleanup_outcome="success",
        )
        self.assertEqual(outputs["manifest_status"], "infrastructure_failed")
        self.assertIn("- replay status: unknown", rendered)

    def test_summary_python_promotion_only_uses_prior_root_status_not_skipped_cleanup_outcome(self):
        outputs, rendered = run_summary_python(
            summarized_root_manifest("passed"),
            main_outcome="skipped",
            cleanup_outcome="skipped",
            mode="promotion-only",
        )
        self.assertEqual(outputs["manifest_status"], "passed")
        self.assertIn("- status: passed", rendered)

        outputs, _rendered = run_summary_python(
            {**summarized_root_manifest("passed"), "schema_version": 99},
            main_outcome="skipped",
            cleanup_outcome="skipped",
            mode="promotion-only",
        )
        self.assertEqual(outputs["manifest_status"], "infrastructure_failed")

    def test_standalone_failures_cover_cleanup_infra_replay_and_findings_states(self):
        text = workflow_text()
        gate = step_block(text, "Fail standalone workflow for actionable QA states")
        for state in ["cleanup_failed", "infrastructure_failed", "replay_failed", "findings_detected"]:
            self.assertIn(state, gate)
        self.assertNotRegex(text, r"(?i)release gate|needs: .*deploy|environment:")

    def test_fail_on_findings_gate_is_alert_only_when_false_and_blocking_when_true(self):
        gate = step_block(workflow_text(), "Fail standalone workflow for actionable QA states")
        self.assertIn('fail_on_findings="${FAIL_ON_FINDINGS:-false}"', gate)
        self.assertIn("'unknown'", gate)
        self.assertIn("steps.candidates.outcome == 'failure'", gate)
        self.assertIn("steps.candidates_recovery.outcome == 'failure'", gate)
        self.assertIn("steps.candidates.outputs.candidate_status || steps.candidates_recovery.outputs.candidate_status || 'skipped'", gate)
        self.assertIn('candidate_step_outcome="${{ steps.candidates.outcome || steps.candidates_recovery.outcome || \'skipped\' }}"', gate)
        self.assertIn('if [[ "${final_status}" == "cleanup_failed" ]]; then', gate)
        self.assertLess(gate.index('if [[ "${final_status}" == "cleanup_failed" ]]; then'), gate.index('case "${candidate_status}" in'))
        self.assertLess(gate.index('if [[ "${candidate_step_outcome}" == "failure" ]]; then'), gate.index('case "${candidate_status}" in'))
        self.assertIn("candidate promotion step failed before a trusted status was exported", gate)
        self.assertRegex(gate, r"candidate_status[\s\S]*cleanup_failed\|infrastructure_failed\|promotion_failed[\s\S]*exit 1")
        self.assertRegex(gate, r"findings_detected\)[\s\S]*if \[\[ \"\$\{fail_on_findings\}\" == \"true\" \]\]; then[\s\S]*exit 1")
        self.assertRegex(gate, r"findings_detected\)[\s\S]*alert-only[\s\S]*exit 0")
        self.assertRegex(gate, r"cleanup_failed\|infrastructure_failed\|replay_failed\)[\s\S]*exit 1")

    def test_candidate_validation_runs_only_for_normal_after_manifest_and_uses_three_serial_exact_attempts(self):
        text = workflow_text()
        candidates = step_block(text, "Validate candidate promotion attempts")
        self.assertRegex(candidates, r"(?m)^        if: \${\{ always\(\) && inputs\.mode == 'normal' && steps\.manifest\.outcome == 'success' && steps\.manifest\.outputs\.manifest_status != 'cleanup_failed' \}\}$")
        self.assertIn("continue-on-error: true", candidates)
        self.assertLess(text.index("- name: Fetch sanitized manifest and write summary"), text.index("- name: Validate candidate promotion attempts"))
        self.assertLess(text.index("- name: Validate candidate promotion attempts"), text.index("- name: Send terminal Browser QA report to DingTalk"))
        self.assertEqual(candidates.count('gcloud run jobs execute "${QA_MAIN_JOB}"'), 1)
        self.assertIn("--args=candidate", candidates)
        self.assertIn("--wait", candidates)
        self.assertIn("BROWSER_QA_CANDIDATE_B64=${candidate_b64}", candidates)
        self.assertIn("BROWSER_QA_ATTEMPT_ID=${attempt_id}", candidates)
        self.assertIn("FLATKEY_BROWSER_QA_GCS_BUCKET=${QA_GCS_BUCKET}", candidates)
        self.assertIn("python3 -B -m scripts.browser_qa.flatkey_browser_qa.candidate_orchestrator plan", candidates)
        self.assertIn("python3 -B -m scripts.browser_qa.flatkey_browser_qa.candidate_orchestrator aggregate", candidates)
        self.assertRegex(candidates, r"jq -c '\.candidates\[\]'")
        self.assertRegex(candidates, r"jq -c '\.attempts\[\]'")
        self.assertRegex(candidates, r"gcloud storage cp \"\$\{manifest_uri\}\" \"\$\{attempt_manifest_path\}\" --quiet")
        self.assertNotRegex(candidates, r"gcloud storage (?:ls|cp).*[*]")
        self.assertNotIn("${{ inputs.", candidates)
        self.assertNotRegex(candidates, r"(?i)GITHUB_OUTPUT[^\n]*(result\.json|screenshots|codex-events|stderr|password|cookie|authorization|api[_-]?key|token|secret)")

    def test_candidate_validation_is_skipped_for_core_cleanup_and_promotion_only_execute_recovery_has_zero_cloud_run_candidate_execution(self):
        text = workflow_text()
        candidates = step_block(text, "Validate candidate promotion attempts")
        recovery = step_block(text, "Recover candidate promotion from existing manifests")

        self.assertRegex(candidates, r"inputs\.mode == 'normal'")
        self.assertNotRegex(candidates, r"inputs\.mode == 'core'|inputs\.mode == 'cleanup-only'|inputs\.mode == 'promotion-only'")
        self.assertRegex(recovery, r"(?m)^        if: \${\{ always\(\) && inputs\.mode == 'promotion-only' && steps\.manifest\.outcome == 'success' && steps\.manifest\.outputs\.manifest_status != 'cleanup_failed' \}\}$")
        self.assertIn("python3 -B -m scripts.browser_qa.flatkey_browser_qa.candidate_orchestrator plan", recovery)
        self.assertIn("python3 -B -m scripts.browser_qa.flatkey_browser_qa.candidate_orchestrator aggregate", recovery)
        self.assertIn("gcloud storage cp \"${manifest_uri}\" \"${attempt_manifest_path}\" --quiet", recovery)
        self.assertNotIn("gcloud run jobs execute", recovery)
        self.assertNotRegex(recovery, r"gcloud storage (?:ls|cp).*[*]")

    def test_candidate_outputs_are_published_atomically_after_pr_bundle_validation_for_normal_and_recovery(self):
        for name in ["Validate candidate promotion attempts", "Recover candidate promotion from existing manifests"]:
            with self.subTest(step=name):
                block = step_block(workflow_text(), name)
                build_index = block.index("python3 -B -m scripts.browser_qa.flatkey_browser_qa.github_candidate_pr build-artifact")
                bundle_count_index = block.index('candidate_pr_bundle_count="$(jq -r')
                validation_index = block.index('if [[ ! "${candidate_pr_bundle_count}" =~ ^[0-9]+$ ]]; then')

                hazard_window = block[:bundle_count_index]
                self.assertNotIn("$GITHUB_OUTPUT", hazard_window)
                self.assertLess(build_index, bundle_count_index)
                self.assertLess(bundle_count_index, validation_index)

                self.assertGreater(block.index('echo "candidate_status=${candidate_status}"'), validation_index)
                self.assertGreater(block.index('echo "candidate_count=${candidate_count}"'), validation_index)
                self.assertGreater(block.index('echo "candidate_pr_bundle_count=${candidate_pr_bundle_count}"'), validation_index)
                self.assertRegex(
                    block,
                    r'(?ms)if \[\[ ! "\$\{candidate_pr_bundle_count\}" =~ \^\[0-9\]\+\$ \]\]; then.*?'
                    r'exit 1\n          fi\n          \{\n'
                    r'            echo "candidate_status=\$\{candidate_status\}"\n'
                    r'            echo "candidate_count=\$\{candidate_count\}"\n'
                    r'            echo "candidate_pr_bundle_count=\$\{candidate_pr_bundle_count\}"\n'
                    r'          \} >> "\$GITHUB_OUTPUT"\n'
                    r'          if \[\[ "\$\{candidate_status\}" == "cleanup_failed"',
                )

    def test_candidate_promotion_failure_does_not_rewrite_manifest_status_and_notification_still_precedes_final_gate(self):
        text = workflow_text()
        summary = step_block(text, "Fetch sanitized manifest and write summary")
        gate = step_block(text, "Fail standalone workflow for actionable QA states")

        self.assertNotIn("candidate_status", summary)
        self.assertIn('final_status="${{ steps.manifest.outputs.manifest_status || \'infrastructure_failed\' }}"', gate)
        self.assertIn("steps.candidates.outputs.candidate_status || steps.candidates_recovery.outputs.candidate_status || 'skipped'", gate)
        self.assertLess(text.index("- name: Send terminal Browser QA report to DingTalk"), text.index("- name: Fail standalone workflow for actionable QA states"))

    def test_no_secret_value_is_placed_in_arguments_outputs_inputs_or_summary(self):
        text = workflow_text()
        notification_name = "Send terminal Browser QA report to DingTalk"
        self.assertIn(f"- name: {notification_name}", text)
        notification = step_block(text, notification_name)
        self.assertRegex(
            notification,
            r"(?m)^          DINGTALK_WEBHOOK: \$\{\{ secrets\.STAGING_BROWSER_QA_DINGTALK_WEBHOOK \}\}$",
        )
        self.assertRegex(
            notification,
            r"(?m)^          DINGTALK_SIGNING_SECRET: \$\{\{ secrets\.STAGING_BROWSER_QA_DINGTALK_SIGNING_SECRET \}\}$",
        )
        without_notification = text.replace(notification, "")
        self.assertNotIn("${{ secrets.", without_notification)
        self.assertNotRegex(text, r"(?i)--(set-env-vars|args|update-env-vars)=[^\n]*(password|cookie|authorization|api[_-]?key|token|secret)")
        self.assertNotRegex(text, r"(?i)GITHUB_OUTPUT[^\n]*(password|cookie|authorization|api[_-]?key|token|secret)")
        self.assertNotRegex(text, r"(?i)GITHUB_STEP_SUMMARY[^\n]*(password|cookie|authorization|api[_-]?key|token|secret|email)")

    def test_terminal_dingtalk_notification_is_always_before_the_final_gate(self):
        text = workflow_text()
        notification_name = "Send terminal Browser QA report to DingTalk"
        self.assertIn(f"- name: {notification_name}", text)
        notification = step_block(text, notification_name)
        self.assertRegex(notification, r"(?m)^        if: always\(\)$")
        self.assertNotIn("continue-on-error", notification)
        self.assertIn("python3 -B -m scripts.browser_qa.flatkey_browser_qa.dingtalk", notification)
        for safe_env in [
            "BROWSER_QA_FINAL_STATUS",
            "BROWSER_QA_REPLAY_STATUS",
            "BROWSER_QA_EXPLORATION_STATUS",
            "BROWSER_QA_EXPLORATION_ACTIONS",
            "BROWSER_QA_FINDING_COUNT",
            "BROWSER_QA_FINDING_SUMMARIES_B64",
            "BROWSER_QA_CLEANUP_STATUS",
            "BROWSER_QA_CANDIDATE_STATUS",
            "BROWSER_QA_CANDIDATE_COUNT",
            "BROWSER_QA_CANDIDATE_PR_BUNDLE_COUNT",
            "BROWSER_QA_GITHUB_RUN_URL",
            "BROWSER_QA_GCS_URI",
        ]:
            self.assertIn(safe_env, notification)
        self.assertIn("BROWSER_QA_FINDING_SUMMARIES_B64: ${{ steps.manifest.outputs.finding_summaries_b64 || 'W10=' }}", notification)
        self.assertIn("steps.candidates.outcome == 'failure'", notification)
        self.assertIn("steps.candidates_recovery.outcome == 'failure'", notification)
        self.assertIn("steps.candidates.outputs.candidate_status || steps.candidates_recovery.outputs.candidate_status || 'skipped'", notification)
        self.assertIn("BROWSER_QA_CANDIDATE_COUNT: ${{ steps.candidates.outputs.candidate_count || steps.candidates_recovery.outputs.candidate_count || '0' }}", notification)
        self.assertIn("BROWSER_QA_CANDIDATE_PR_BUNDLE_COUNT: ${{ steps.candidates.outputs.candidate_pr_bundle_count || steps.candidates_recovery.outputs.candidate_pr_bundle_count || '0' }}", notification)
        self.assertNotRegex(notification, r"(?i)result\.json|evidence|screenshots|codex-events|stderr")
        self.assertIn(
            "format('gs://browser-qa-report-unavailable/runs/{0}/manifest.json', github.run_id)",
            notification,
        )
        self.assertLess(text.index(f"- name: {notification_name}"), text.index("- name: Fail standalone workflow for actionable QA states"))

    def test_candidate_status_notification_expression_falls_back_unknown_only_for_failed_candidate_step_without_output(self):
        notification = step_block(workflow_text(), "Send terminal Browser QA report to DingTalk")
        gate = step_block(workflow_text(), "Fail standalone workflow for actionable QA states")
        expression = (
            "${{ (steps.candidates.outcome == 'failure' && !steps.candidates.outputs.candidate_status && 'unknown') || "
            "(steps.candidates_recovery.outcome == 'failure' && !steps.candidates_recovery.outputs.candidate_status && 'unknown') || "
            "steps.candidates.outputs.candidate_status || steps.candidates_recovery.outputs.candidate_status || 'skipped' }}"
        )

        self.assertIn(f"BROWSER_QA_CANDIDATE_STATUS: {expression}", notification)
        self.assertIn(f'candidate_status="{expression}"', gate)
        self.assertLess(notification.index("unknown"), notification.index("|| 'skipped'"))
        self.assertLess(gate.index("unknown"), gate.index("|| 'skipped'"))

    def test_staging_deploy_calls_same_commit_browser_qa_normal_after_successful_deploy(self):
        text = staging_deploy_workflow_text()
        qa = job_block(text, "browser-qa-normal")

        self.assertRegex(qa, r"(?m)^    needs: deploy$")
        self.assertRegex(qa, r"(?m)^    uses: \./\.github/workflows/gcp-browser-qa\.yml$")
        self.assertRegex(qa, r"(?ms)^    with:\n      mode: normal\n      fail_on_findings: false\b")
        self.assertRegex(
            qa,
            r"(?ms)^    secrets:\n"
            r"      STAGING_BROWSER_QA_DINGTALK_WEBHOOK: \$\{\{ secrets\.STAGING_BROWSER_QA_DINGTALK_WEBHOOK \}\}\n"
            r"      STAGING_BROWSER_QA_DINGTALK_SIGNING_SECRET: \$\{\{ secrets\.STAGING_BROWSER_QA_DINGTALK_SIGNING_SECRET \}\}\s*$",
        )
        self.assertNotRegex(qa, r"(?m)^    if: .*(always|failure|cancelled)\(")
        self.assertNotIn("continue-on-error", qa)
        self.assertNotRegex(qa, r"(?i)\b(rollback|restore|update-traffic|traffic restoration)\b")

    def test_staging_dispatch_image_tag_is_env_validated_before_image_uri(self):
        text = staging_deploy_workflow_text()
        compute = step_block(text, "Compute image URI")

        self.assertNotIn("${{ inputs.image_tag }}", run_blocks(compute)[0])
        self.assertRegex(
            compute,
            r"(?m)^        env:\n"
            r"          DISPATCH_IMAGE_TAG: \$\{\{ inputs\.image_tag \}\}$",
        )
        self.assertIn(
            'if [[ ! "${DISPATCH_IMAGE_TAG}" =~ ^staging-sha-[0-9a-f]{12,40}$ ]]; then',
            compute,
        )
        self.assertIn("exit 1", compute)
        self.assertLess(compute.index("Invalid image_tag"), compute.index("image_uri="))
        self.assertIn('if [[ -n "${DISPATCH_IMAGE_TAG}" ]]; then', compute)
        self.assertIn('echo "image_uri=${AR_REPO_URL}/server:${DISPATCH_IMAGE_TAG}"', compute)
        self.assertIn('echo "image_uri=${AR_REPO_URL}/server:staging-sha-${short_sha}"', compute)

    def test_staging_browser_qa_failure_is_alert_only_without_rollback_or_secret_summary(self):
        text = staging_deploy_workflow_text()
        uncommented = strip_comments(text)
        qa = job_block(text, "browser-qa-normal")

        self.assertNotRegex(qa, r"(?i)\b(rollback|restore|update-traffic|gcloud run services update-traffic)\b")
        self.assertEqual(qa_dependent_rollback_jobs(text), [])
        self.assertNotRegex(uncommented, r"(?i)browser-qa[\s\S]{0,400}continue-on-error")
        self.assertNotRegex(uncommented, r"(?i)(GITHUB_STEP_SUMMARY|summary)[^\n]*(password|cookie|authorization|api[_-]?key|token|secret|email)")

    def test_staging_deploy_explicitly_allows_browser_qa_gmail_aliases(self):
        text = staging_deploy_workflow_text()
        deploy = step_block(text, "Deploy new revision without traffic")

        self.assertIn("STAGING_BROWSER_QA_ALLOW_EMAIL_ALIASES: true", text)
        self.assertIn(
            '"STAGING_BROWSER_QA_ALLOW_EMAIL_ALIASES=${STAGING_BROWSER_QA_ALLOW_EMAIL_ALIASES}"',
            deploy,
        )

    def test_staging_qa_contract_detects_downstream_rollback_jobs(self):
        text = staging_deploy_workflow_text() + """

  rollback-on-qa-failure:
    needs: browser-qa-normal
    if: ${{ failure() }}
    steps:
      - run: gcloud run services update-traffic newapi-staging --to-revisions previous=100
"""

        self.assertEqual(qa_dependent_rollback_jobs(text), ["rollback-on-qa-failure"])


if __name__ == "__main__":
    unittest.main()
