import re
import unittest
from dataclasses import dataclass
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
QA_DIR = REPO_ROOT / "deploy" / "gcp" / "envs" / "browser-qa-staging"
BROWSER_QA_TF = QA_DIR / "browser_qa.tf"
VARIABLES_TF = QA_DIR / "variables.tf"
TFVARS = QA_DIR / "terraform.tfvars"
OUTPUTS_TF = QA_DIR / "outputs.tf"

EXPECTED_OUTPUTS = {
    "browser_qa_artifact_registry_url",
    "browser_qa_wif_provider",
    "browser_qa_deployer_sa_email",
    "browser_qa_report_bucket",
    "browser_qa_broker_uri",
    "browser_qa_broker_service_name",
    "browser_qa_main_job_name",
    "browser_qa_cleanup_job_name",
}

INFRA_OUTPUTS = {
    "browser_qa_artifact_registry_url",
    "browser_qa_wif_provider",
    "browser_qa_deployer_sa_email",
    "browser_qa_report_bucket",
}

WORKLOAD_OUTPUTS = EXPECTED_OUTPUTS - INFRA_OUTPUTS

WORKLOAD_RESOURCE_BLOCKS = {
    ("google_cloud_run_v2_service", "browser_qa_broker"),
    ("google_cloud_run_v2_job", "browser_qa_main"),
    ("google_cloud_run_v2_job", "browser_qa_cleanup"),
    ("google_cloud_run_v2_service_iam_member", "browser_qa_broker_invoker"),
    ("google_cloud_run_v2_service_iam_member", "browser_qa_broker_deployer_developer"),
    ("google_cloud_run_v2_job_iam_member", "browser_qa_main_deployer_developer"),
    ("google_cloud_run_v2_job_iam_member", "browser_qa_main_deployer_invoker"),
    ("google_cloud_run_v2_job_iam_member", "browser_qa_cleanup_deployer_developer"),
    ("google_cloud_run_v2_job_iam_member", "browser_qa_cleanup_deployer_invoker"),
}


@dataclass(frozen=True)
class Block:
    kind: str
    type_name: str
    name: str
    body: str


def _strip_comments(text):
    result = []
    i = 0
    in_string = False
    in_line_comment = False
    in_block_comment = False
    while i < len(text):
        current = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""
        if in_line_comment:
            if current == "\n":
                in_line_comment = False
                result.append(current)
            i += 1
            continue
        if in_block_comment:
            if current == "*" and nxt == "/":
                in_block_comment = False
                i += 2
            else:
                if current == "\n":
                    result.append("\n")
                i += 1
            continue
        if not in_string and current == "/" and nxt == "/":
            in_line_comment = True
            i += 2
            continue
        if not in_string and current == "#":
            in_line_comment = True
            i += 1
            continue
        if not in_string and current == "/" and nxt == "*":
            in_block_comment = True
            i += 2
            continue
        if current == '"' and (i == 0 or text[i - 1] != "\\"):
            in_string = not in_string
        result.append(current)
        i += 1
    return "".join(result)


def _find_matching_brace(text, open_index):
    depth = 0
    in_string = False
    for i in range(open_index, len(text)):
        current = text[i]
        if current == '"' and (i == 0 or text[i - 1] != "\\"):
            in_string = not in_string
        if in_string:
            continue
        if current == "{":
            depth += 1
        elif current == "}":
            depth -= 1
            if depth == 0:
                return i
    raise AssertionError("unclosed HCL block")


def _blocks(text, kind=None, type_name=None):
    text = _strip_comments(text)
    pattern = re.compile(r'(?m)^\s*(resource|variable|output|locals)\s+(?:"([^"]+)")?\s*(?:"([^"]+)")?\s*\{')
    found = []
    for match in pattern.finditer(text):
        block_kind = match.group(1)
        block_type = match.group(2) or ""
        block_name = match.group(3) or block_type
        if kind is not None and block_kind != kind:
            continue
        if type_name is not None and block_type != type_name:
            continue
        close = _find_matching_brace(text, match.end() - 1)
        found.append(Block(block_kind, block_type, block_name, text[match.end():close]))
    return found


def _resource_blocks(resource_type):
    return {block.name: block for block in _blocks(BROWSER_QA_TF.read_text(encoding="utf-8"), "resource", resource_type)}


class BrowserQaTerraformContractTest(unittest.TestCase):
    def setUp(self):
        self.assertTrue(BROWSER_QA_TF.exists(), "deploy/gcp/envs/browser-qa-staging/browser_qa.tf must exist")
        self.browser_qa = BROWSER_QA_TF.read_text(encoding="utf-8")
        self.clean_browser_qa = _strip_comments(self.browser_qa)

    def test_create_workloads_defaults_to_committed_steady_state_true(self):
        variables = {
            block.name: block
            for block in _blocks(VARIABLES_TF.read_text(encoding="utf-8"), "variable")
        }
        self.assertIn("create_workloads", variables)
        self.assertRegex(variables["create_workloads"].body, r"\btype\s*=\s*bool\b")
        self.assertRegex(variables["create_workloads"].body, r"\bdefault\s*=\s*true\b")

        tfvars = _strip_comments(TFVARS.read_text(encoding="utf-8"))
        self.assertEqual(
            re.findall(r"(?m)^\s*create_workloads\s*=\s*(true|false)\s*$", tfvars),
            ["true"],
        )

    def test_only_cloud_run_workloads_and_run_iam_are_phase_gated(self):
        resources = _blocks(self.browser_qa, "resource")
        actual_gated = set()
        for block in resources:
            key = (block.type_name, block.name)
            if "create_workloads" in block.body:
                actual_gated.add(key)
            if key in WORKLOAD_RESOURCE_BLOCKS:
                self.assertRegex(
                    block.body,
                    r"\bcount\s*=\s*var\.create_workloads\s*\?\s*1\s*:\s*0\b",
                    key,
                )
            else:
                self.assertNotIn("create_workloads", block.body, key)

        self.assertEqual(actual_gated, WORKLOAD_RESOURCE_BLOCKS)
        self.assertEqual(len(resources) - len(actual_gated), 26)

    def test_defines_dedicated_artifact_registry_and_service_accounts(self):
        repos = _resource_blocks("google_artifact_registry_repository")
        self.assertIn("browser_qa", repos)
        self.assertRegex(self.clean_browser_qa, r'\bbrowser_qa_artifact_repository_id\s*=\s*"flatkey-staging-browser-qa"')
        self.assertRegex(repos["browser_qa"].body, r"\brepository_id\s*=\s*local\.browser_qa_artifact_repository_id\b")
        self.assertRegex(repos["browser_qa"].body, r'\bformat\s*=\s*"DOCKER"')

        service_accounts = _resource_blocks("google_service_account")
        expected = {
            "browser_qa_runtime": "flatkey-browser-qa-runtime",
            "browser_qa_broker": "flatkey-browser-qa-broker",
            "browser_qa_cleanup": "flatkey-browser-qa-cleanup",
            "browser_qa_deployer": "flatkey-browser-qa-deployer",
        }
        for name, account_id in expected.items():
            self.assertIn(name, service_accounts)
            self.assertRegex(service_accounts[name].body, rf'\baccount_id\s*=\s*"{account_id}"')

    def test_secret_metadata_has_exact_expected_containers_and_no_versions(self):
        secrets = _resource_blocks("google_secret_manager_secret")
        qa_secret_ids = {}
        for name, block in secrets.items():
            if "flatkey-browser-qa-" in block.body:
                qa_secret_ids[name] = re.search(r'\bsecret_id\s*=\s*"([^"]+)"', block.body).group(1)
        self.assertEqual(
            set(qa_secret_ids.values()),
            {
                "flatkey-browser-qa-codex-api-key",
                "flatkey-browser-qa-identity-seed",
                "flatkey-browser-qa-gmail-oauth",
            },
        )
        self.assertEqual(_resource_blocks("google_secret_manager_secret_version"), {})
        self.assertNotRegex(self.clean_browser_qa, r"secret_data|codex_api_key_value|gmail_oauth_value|identity_seed_value")

    def test_gmail_base_is_not_committed_or_managed_by_terraform(self):
        self.assertNotIn("FLATKEY_QA_GMAIL_BASE", self.clean_browser_qa)
        self.assertNotRegex(self.clean_browser_qa, r"@gmail\.com\b")

    def test_private_broker_service_and_private_jobs_have_expected_shape(self):
        services = _resource_blocks("google_cloud_run_v2_service")
        self.assertEqual(set(services), {"browser_qa_broker"})
        broker = services["browser_qa_broker"]
        self.assertRegex(self.clean_browser_qa, r'\bbrowser_qa_broker_service_name\s*=\s*"flatkey-staging-browser-qa-broker"')
        self.assertRegex(broker.body, r"\bname\s*=\s*local\.browser_qa_broker_service_name\b")
        self.assertRegex(broker.body, r'\bingress\s*=\s*"INGRESS_TRAFFIC_ALL"')
        self.assertRegex(broker.body, r'\bservice_account\s*=\s*google_service_account\.browser_qa_broker\.email\b')
        self.assertRegex(broker.body, r'\bimage\s*=\s*local\.browser_qa_placeholder_image\b')
        self.assertRegex(broker.body, r'\bargs\s*=\s*\[\s*"broker"\s*\]')
        self.assertRegex(broker.body, r"ignore_changes\s*=\s*\[[^\]]*template\[0\]\.containers\[0\]\.image")
        self.assertRegex(broker.body, r'\bsecret\s*=\s*google_secret_manager_secret\.browser_qa_gmail_oauth\.secret_id\b[\s\S]*\bversion\s*=\s*"latest"')
        self.assertNotIn("allUsers", broker.body)
        self.assertNotRegex(broker.body, r"traffic\s*\{")

        jobs = _resource_blocks("google_cloud_run_v2_job")
        self.assertEqual(set(jobs), {"browser_qa_main", "browser_qa_cleanup"})
        expected = {
            "browser_qa_main": ("flatkey-staging-browser-qa", "browser_qa_runtime", "1200s"),
            "browser_qa_cleanup": ("flatkey-staging-browser-qa-cleanup", "browser_qa_cleanup", "300s"),
        }
        for name, (job_name, sa_name, timeout) in expected.items():
            job = jobs[name]
            self.assertRegex(self.clean_browser_qa, rf'"{job_name}"')
            self.assertRegex(job.body, r"\bname\s*=\s*local\.browser_qa_(main|cleanup)_job_name\b")
            self.assertRegex(job.body, rf'\bservice_account\s*=\s*google_service_account\.{sa_name}\.email\b')
            self.assertRegex(job.body, r"\btask_count\s*=\s*1\b")
            self.assertRegex(job.body, r"\bparallelism\s*=\s*1\b")
            self.assertRegex(job.body, r"\bmax_retries\s*=\s*0\b")
            self.assertRegex(job.body, rf'\btimeout\s*=\s*"{timeout}"')
            self.assertRegex(job.body, r'\bimage\s*=\s*local\.browser_qa_placeholder_image\b')
            self.assertRegex(job.body, r"ignore_changes\s*=\s*\[[^\]]*template\[0\]\.template\[0\]\.containers\[0\]\.image")

        self.assertRegex(
            jobs["browser_qa_main"].body,
            r"google_cloud_run_v2_service\.browser_qa_broker\[count\.index\]\.uri",
        )
        self.assertRegex(
            jobs["browser_qa_main"].body,
            r'name\s*=\s*"FLATKEY_BROWSER_QA_CHROMIUM_STARTUP_STDERR_BYTES"[\s\S]*value\s*=\s*"8192"',
        )
        self.assertNotIn("FLATKEY_BROWSER_QA_CHROMIUM_STARTUP_STDERR_BYTES", jobs["browser_qa_cleanup"].body)

    def test_main_browser_qa_job_has_explicit_memory_for_chromium_and_codex(self):
        services = _resource_blocks("google_cloud_run_v2_service")
        jobs = _resource_blocks("google_cloud_run_v2_job")
        main = jobs["browser_qa_main"]

        self.assertRegex(
            main.body,
            r'\bresources\s*\{\s*limits\s*=\s*\{\s*memory\s*=\s*"2Gi"\s*\}\s*\}',
        )
        self.assertNotRegex(services["browser_qa_broker"].body, r"\bresources\s*\{")
        self.assertNotRegex(jobs["browser_qa_cleanup"].body, r"\bresources\s*\{")

    def test_private_report_bucket_and_report_iam_split(self):
        buckets = _resource_blocks("google_storage_bucket")
        self.assertIn("browser_qa_reports", buckets)
        bucket = buckets["browser_qa_reports"]
        self.assertRegex(bucket.body, r"\buniform_bucket_level_access\s*=\s*true\b")
        self.assertRegex(bucket.body, r'\bpublic_access_prevention\s*=\s*"enforced"')
        self.assertRegex(bucket.body, r"lifecycle_rule\s*\{[\s\S]*action\s*\{[\s\S]*type\s*=\s*\"Delete\"[\s\S]*condition\s*\{[\s\S]*age\s*=\s*14")

        members = _resource_blocks("google_storage_bucket_iam_member")
        member_bodies = "\n".join(block.body for block in members.values())
        self.assertRegex(member_bodies, r'role\s*=\s*"roles/storage\.objectCreator"[\s\S]*browser_qa_runtime')
        self.assertRegex(member_bodies, r'role\s*=\s*"roles/storage\.objectAdmin"[\s\S]*browser_qa_cleanup')
        self.assertRegex(member_bodies, r'role\s*=\s*"roles/storage\.objectViewer"[\s\S]*browser_qa_deployer')
        self.assertNotRegex(member_bodies, r'role\s*=\s*"roles/storage\.admin"')

    def test_branch_and_repository_bound_wif_and_outputs(self):
        pools = _resource_blocks("google_iam_workload_identity_pool")
        providers = _resource_blocks("google_iam_workload_identity_pool_provider")
        self.assertIn("browser_qa_github", pools)
        self.assertIn("browser_qa_github", providers)
        provider = providers["browser_qa_github"]
        self.assertRegex(provider.body, r'"google\.subject"\s*=\s*"assertion\.sub"')
        self.assertRegex(provider.body, r'"attribute\.repository"\s*=\s*"assertion\.repository"')
        self.assertRegex(provider.body, r'"attribute\.ref"\s*=\s*"assertion\.ref"')
        self.assertRegex(provider.body, r"assertion\.repository\s*==\s*'SolveaCX/new-api'\s*&&\s*assertion\.ref\s*==\s*'refs/heads/staging'")

        bindings = _resource_blocks("google_service_account_iam_member")
        self.assertIn("browser_qa_wif_deployer", bindings)
        binding = bindings["browser_qa_wif_deployer"]
        self.assertRegex(binding.body, r'\brole\s*=\s*"roles/iam\.workloadIdentityUser"')
        self.assertRegex(binding.body, r"/subject/repo:SolveaCX/new-api:ref:refs/heads/staging")
        self.assertNotRegex(binding.body, r"/attribute\.repository/SolveaCX/new-api\"\s*$")

        output_blocks = _blocks(OUTPUTS_TF.read_text(encoding="utf-8"), "output")
        self.assertEqual({block.name for block in output_blocks}, EXPECTED_OUTPUTS)
        outputs = _strip_comments(OUTPUTS_TF.read_text(encoding="utf-8"))
        for output_name in EXPECTED_OUTPUTS:
            matches = [block for block in _blocks(outputs, "output") if block.name == output_name]
            self.assertEqual(len(matches), 1, output_name)
        expected_output_values = {
            "browser_qa_artifact_registry_url": r'value\s*=\s*"\$\{var\.region\}-docker\.pkg\.dev/\$\{var\.project_id\}/\$\{google_artifact_registry_repository\.browser_qa\.repository_id\}"',
            "browser_qa_wif_provider": r"value\s*=\s*google_iam_workload_identity_pool_provider\.browser_qa_github\.name",
            "browser_qa_deployer_sa_email": r"value\s*=\s*google_service_account\.browser_qa_deployer\.email",
            "browser_qa_report_bucket": r"value\s*=\s*google_storage_bucket\.browser_qa_reports\.name",
            "browser_qa_broker_uri": r"value\s*=\s*one\(google_cloud_run_v2_service\.browser_qa_broker\[\*\]\.uri\)",
            "browser_qa_broker_service_name": r"value\s*=\s*one\(google_cloud_run_v2_service\.browser_qa_broker\[\*\]\.name\)",
            "browser_qa_main_job_name": r"value\s*=\s*one\(google_cloud_run_v2_job\.browser_qa_main\[\*\]\.name\)",
            "browser_qa_cleanup_job_name": r"value\s*=\s*one\(google_cloud_run_v2_job\.browser_qa_cleanup\[\*\]\.name\)",
        }
        for output_name, value_pattern in expected_output_values.items():
            [block] = [block for block in _blocks(outputs, "output") if block.name == output_name]
            self.assertRegex(block.body, value_pattern)

        output_by_name = {block.name: block for block in output_blocks}
        for output_name in INFRA_OUTPUTS:
            self.assertNotIn("one(", output_by_name[output_name].body)
        for output_name in WORKLOAD_OUTPUTS:
            self.assertIn("one(", output_by_name[output_name].body)

    def test_least_privilege_iam_is_resource_scoped(self):
        service_iam = _resource_blocks("google_cloud_run_v2_service_iam_member")
        self.assertEqual(set(service_iam), {"browser_qa_broker_invoker", "browser_qa_broker_deployer_developer"})
        broker_invoker = service_iam["browser_qa_broker_invoker"]
        self.assertRegex(broker_invoker.body, r'\brole\s*=\s*"roles/run\.invoker"')
        self.assertRegex(broker_invoker.body, r"google_service_account\.browser_qa_runtime\.email")
        self.assertNotIn("allUsers", broker_invoker.body)
        broker_developer = service_iam["browser_qa_broker_deployer_developer"]
        self.assertRegex(broker_developer.body, r'\brole\s*=\s*"roles/run\.developer"')
        self.assertRegex(broker_developer.body, r"google_service_account\.browser_qa_deployer\.email")

        for block in service_iam.values():
            self.assertRegex(
                block.body,
                r"\bname\s*=\s*google_cloud_run_v2_service\.browser_qa_broker\[count\.index\]\.name\b",
            )

        job_iam = _resource_blocks("google_cloud_run_v2_job_iam_member")
        job_bodies = "\n".join(block.body for block in job_iam.values())
        self.assertRegex(job_bodies, r'browser_qa_main[\s\S]*role\s*=\s*"roles/run\.developer"')
        self.assertRegex(job_bodies, r'browser_qa_cleanup[\s\S]*role\s*=\s*"roles/run\.developer"')
        self.assertRegex(job_bodies, r'browser_qa_main[\s\S]*role\s*=\s*"roles/run\.invoker"')
        self.assertRegex(job_bodies, r'browser_qa_cleanup[\s\S]*role\s*=\s*"roles/run\.invoker"')
        for block in job_iam.values():
            resource_name = "browser_qa_main" if "browser_qa_main" in block.name else "browser_qa_cleanup"
            self.assertRegex(
                block.body,
                rf"\bname\s*=\s*google_cloud_run_v2_job\.{resource_name}\[count\.index\]\.name\b",
            )

        project_iam = _resource_blocks("google_project_iam_member")
        project_iam_body = "\n".join(block.body for block in project_iam.values())
        self.assertNotIn("roles/run.developer", project_iam_body)
        self.assertNotIn("roles/run.admin", project_iam_body)
        self.assertNotIn("roles/secretmanager.secretAccessor", project_iam_body)
        self.assertRegex(project_iam_body, r'role\s*=\s*"roles/logging\.logWriter"')

        ar_iam = _resource_blocks("google_artifact_registry_repository_iam_member")
        self.assertIn("browser_qa_deployer_writer", ar_iam)
        self.assertRegex(ar_iam["browser_qa_deployer_writer"].body, r'\brole\s*=\s*"roles/artifactregistry\.writer"')
        self.assertRegex(ar_iam["browser_qa_deployer_writer"].body, r"browser_qa_deployer")

        sa_user = _resource_blocks("google_service_account_iam_member")
        sa_user_body = "\n".join(block.body for block in sa_user.values())
        for runtime in ("browser_qa_runtime", "browser_qa_broker", "browser_qa_cleanup"):
            self.assertRegex(sa_user_body, rf'{runtime}\.name[\s\S]*role\s*=\s*"roles/iam\.serviceAccountUser"')
        self.assertRegex(sa_user_body, r"member\s*=\s*\"serviceAccount:\$\{google_service_account\.browser_qa_deployer\.email\}\"")

    def test_secret_access_is_limited_to_intended_identities(self):
        secret_iam = _resource_blocks("google_secret_manager_secret_iam_member")
        access = {}
        for block in secret_iam.values():
            secret_match = re.search(r"secret_id\s*=\s*google_secret_manager_secret\.([a-z0-9_]+)\.secret_id", block.body)
            member_match = re.search(r"member\s*=\s*\"serviceAccount:\$\{google_service_account\.([a-z0-9_]+)\.email\}\"", block.body)
            role_match = re.search(r'role\s*=\s*"roles/secretmanager\.secretAccessor"', block.body)
            if secret_match and member_match and role_match:
                access.setdefault(secret_match.group(1), set()).add(member_match.group(1))
        self.assertEqual(access.get("browser_qa_codex_api_key"), {"browser_qa_runtime"})
        self.assertEqual(access.get("browser_qa_identity_seed"), {"browser_qa_runtime", "browser_qa_cleanup"})
        self.assertEqual(access.get("browser_qa_gmail_oauth"), {"browser_qa_broker"})
        all_members = set().union(*access.values())
        self.assertNotIn("browser_qa_deployer", all_members)

    def test_no_forbidden_network_or_application_resources(self):
        forbidden_types = {
            "google_compute_global_address",
            "google_compute_url_map",
            "google_compute_managed_ssl_certificate",
            "google_compute_target_https_proxy",
            "google_compute_global_forwarding_rule",
            "google_dns_record_set",
            "google_cloud_run_domain_mapping",
        }
        resources = _blocks(self.browser_qa, "resource")
        self.assertEqual(len(resources), 35)
        self.assertEqual(
            {(block.type_name, block.name) for block in resources if "create_workloads" in block.body},
            WORKLOAD_RESOURCE_BLOCKS,
        )
        self.assertTrue(forbidden_types.isdisjoint({block.type_name for block in resources}))
        self.assertNotRegex(self.clean_browser_qa, r"\b(newapi|newapi-web|newapi-console|newapi-router)\b")
        self.assertNotRegex(self.clean_browser_qa, r"\btraffic\s*\{")


if __name__ == "__main__":
    unittest.main()
