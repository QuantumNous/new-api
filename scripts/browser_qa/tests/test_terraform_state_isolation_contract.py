import re
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
QA_ROOT = REPO_ROOT / "deploy" / "gcp" / "envs" / "browser-qa-staging"
PROD_ROOT = REPO_ROOT / "deploy" / "gcp" / "envs" / "prod"

EXPECTED_PROJECT = "vocai-gemini-prod"
EXPECTED_REGION = "us-west1"
EXPECTED_BUCKET = "vocai-gemini-prod-newapi-tfstate"
EXPECTED_PREFIX = "envs/browser-qa-staging"
EXPECTED_VARIABLES = {"project_id", "region", "create_workloads"}
EXPECTED_WORKLOAD_RESOURCE_BLOCKS = {
    "google_cloud_run_v2_service.browser_qa_broker",
    "google_cloud_run_v2_job.browser_qa_main",
    "google_cloud_run_v2_job.browser_qa_cleanup",
    "google_cloud_run_v2_service_iam_member.browser_qa_broker_invoker",
    "google_cloud_run_v2_service_iam_member.browser_qa_broker_deployer_developer",
    "google_cloud_run_v2_job_iam_member.browser_qa_main_deployer_developer",
    "google_cloud_run_v2_job_iam_member.browser_qa_main_deployer_invoker",
    "google_cloud_run_v2_job_iam_member.browser_qa_cleanup_deployer_developer",
    "google_cloud_run_v2_job_iam_member.browser_qa_cleanup_deployer_invoker",
}
EXPECTED_WORKLOAD_COUNT = "var.create_workloads ? 1 : 0"
SENSITIVE_INPUT_NAME = re.compile(r"(?i)(secret|token|oauth|gmail|api_key)")


def _read(path):
    return path.read_text(encoding="utf-8")


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


def _named_blocks(text, kind):
    clean = _strip_comments(text)
    pattern = re.compile(rf'(?m)^\s*{kind}\s+"([^"]+)"\s*\{{')
    blocks = {}
    for match in pattern.finditer(clean):
        close = _find_matching_brace(clean, match.end() - 1)
        blocks[match.group(1)] = clean[match.end():close]
    return blocks


def _resource_blocks(text):
    clean = _strip_comments(text)
    pattern = re.compile(r'(?m)^\s*resource\s+"([^"]+)"\s+"([^"]+)"\s*\{')
    blocks = {}
    for match in pattern.finditer(clean):
        close = _find_matching_brace(clean, match.end() - 1)
        name = f"{match.group(1)}.{match.group(2)}"
        if name in blocks:
            raise AssertionError(f"duplicate resource block: {name}")
        blocks[name] = clean[match.end():close]
    return blocks


def _block_body(text, block_pattern):
    clean = _strip_comments(text)
    match = re.search(block_pattern, clean)
    if not match:
        raise AssertionError(f"HCL block not found: {block_pattern}")
    close = _find_matching_brace(clean, match.end() - 1)
    return clean[match.end():close]


def _assigned_strings(text):
    clean = _strip_comments(text)
    return dict(re.findall(r'(?m)^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"([^"]*)"\s*$', clean))


def _assigned_values(text):
    clean = _strip_comments(text)
    values = {}
    assignment_pattern = r"(?m)^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(\S.*?)\s*$"
    for match in re.finditer(assignment_pattern, clean):
        name = match.group(1)
        if name in values:
            raise AssertionError(f"duplicate assignment: {name}")
        values[name] = match.group(2).strip()
    return values


def _normalize_whitespace(value):
    return " ".join(value.split())


class BrowserQaTerraformStateIsolationContractTest(unittest.TestCase):
    def setUp(self):
        self.assertTrue(PROD_ROOT.exists(), "prod root must exist as the isolation comparison root")
        self.assertTrue(QA_ROOT.exists(), "browser QA staging Terraform root must exist")
        self.tf_files = sorted(QA_ROOT.glob("*.tf"))
        self.assertTrue(self.tf_files, "browser QA staging Terraform root must contain Terraform files")
        self.all_tf = "\n".join(_read(path) for path in self.tf_files)

    def test_assignment_parser_rejects_duplicate_keys(self):
        with self.assertRaisesRegex(AssertionError, "duplicate assignment: project_id"):
            _assigned_values('project_id = "vocai-gemini-prod"\nproject_id = "other"\n')

    def test_resource_parser_rejects_duplicate_blocks(self):
        duplicate_resources = '''
resource "google_storage_bucket" "browser_qa_reports" {}
resource "google_storage_bucket" "browser_qa_reports" {}
'''
        with self.assertRaisesRegex(
            AssertionError,
            "duplicate resource block: google_storage_bucket.browser_qa_reports",
        ):
            _resource_blocks(duplicate_resources)

    def test_backend_uses_dedicated_browser_qa_state_prefix(self):
        backend = _read(QA_ROOT / "backend.tf")
        values = _assigned_strings(backend)

        self.assertEqual(values.get("bucket"), EXPECTED_BUCKET)
        self.assertEqual(values.get("prefix"), EXPECTED_PREFIX)
        self.assertNotEqual(values.get("prefix"), "envs/prod")
        self.assertIn("envs/prod", _read(PROD_ROOT / "backend.tf"))

    def test_variables_accept_only_locked_non_sensitive_project_region_and_workload_gate(self):
        variables = _read(QA_ROOT / "variables.tf")
        blocks = _named_blocks(variables, "variable")

        self.assertEqual(set(blocks), EXPECTED_VARIABLES)
        for name in blocks:
            self.assertNotRegex(name, SENSITIVE_INPUT_NAME)

        expected_values = {"project_id": EXPECTED_PROJECT, "region": EXPECTED_REGION}
        for name, value in expected_values.items():
            with self.subTest(variable=name):
                body = blocks[name]
                self.assertRegex(body, r"\btype\s*=\s*string\b")
                self.assertRegex(body, rf"\bcondition\s*=\s*var\.{name}\s*==\s*\"{re.escape(value)}\"")
                self.assertRegex(body, r"\berror_message\s*=\s*\"[^\"]+\"")

        create_workloads = blocks["create_workloads"]
        self.assertRegex(create_workloads, r"\btype\s*=\s*bool\b")
        self.assertRegex(create_workloads, r"(?m)^\s*default\s*=\s*true\s*$")

    def test_versions_lock_google_provider_boundary(self):
        versions = _read(QA_ROOT / "versions.tf")
        clean = _strip_comments(versions)

        self.assertEqual(re.findall(r'\brequired_version\s*=\s*"([^"]+)"', clean), [">= 1.5.0"])

        required_providers = _block_body(clean, r"(?m)^\s*required_providers\s*\{")
        provider_names = re.findall(r'(?m)^\s*([A-Za-z_][A-Za-z0-9_-]*)\s*=\s*\{', required_providers)
        self.assertEqual(provider_names, ["google"])
        google_provider = _block_body(required_providers, r"(?m)^\s*google\s*=\s*\{")
        self.assertEqual(_assigned_strings(google_provider), {"source": "hashicorp/google", "version": "~> 6.13"})

        provider_blocks = _named_blocks(versions, "provider")
        self.assertEqual(set(provider_blocks), {"google"})
        self.assertRegex(provider_blocks["google"], r"(?m)^\s*project\s*=\s*var\.project_id\s*$")
        self.assertRegex(provider_blocks["google"], r"(?m)^\s*region\s*=\s*var\.region\s*$")

    def test_tfvars_contains_only_fixed_project_region_and_workload_gate_values(self):
        tfvars = _read(QA_ROOT / "terraform.tfvars")
        assignments = _assigned_values(tfvars)
        values = _assigned_strings(tfvars)

        self.assertEqual(set(assignments), EXPECTED_VARIABLES)
        self.assertEqual(values, {"project_id": EXPECTED_PROJECT, "region": EXPECTED_REGION})
        self.assertEqual(assignments["create_workloads"], "true")
        for name in assignments:
            self.assertNotRegex(name, SENSITIVE_INPUT_NAME)

    def test_root_does_not_own_shared_project_api_enablement(self):
        self.assertNotRegex(self.all_tf, r'\bresource\s+"google_project_service"\b')
        self.assertNotRegex(self.all_tf, r'\bmodule\s+"apis"\b')

    def test_prod_root_does_not_own_browser_qa_resources_or_switches(self):
        self.assertFalse(PROD_ROOT.joinpath("browser_qa.tf").exists())

        prod_tf_files = sorted(PROD_ROOT.glob("*.tf"))
        self.assertTrue(prod_tf_files, "prod root must contain Terraform files")
        for path in prod_tf_files:
            with self.subTest(path=path.relative_to(REPO_ROOT).as_posix()):
                text = _read(path)
                self.assertNotRegex(text, r"browser_qa")
                self.assertNotRegex(text, r"\benable_browser_qa\b")

    def test_browser_qa_root_gates_only_workloads_and_keeps_infra_independent(self):
        clean = _strip_comments(self.all_tf)
        resources = _resource_blocks(self.all_tf)

        self.assertNotRegex(clean, r"\benable_browser_qa\b")
        self.assertNotRegex(clean, r"\bmodule\.apis\b")
        self.assertNotRegex(clean, r"\bbrowser_qa_[a-z0-9_]+\[0\](?![A-Za-z0-9_])")
        self.assertEqual(len(resources), 35)

        gated_resources = set()
        ungated_resources = set()
        for name, body in resources.items():
            count_values = re.findall(r"(?m)^\s*count\s*=\s*(.*?)\s*$", body)
            if name in EXPECTED_WORKLOAD_RESOURCE_BLOCKS:
                self.assertEqual(
                    [_normalize_whitespace(value) for value in count_values],
                    [EXPECTED_WORKLOAD_COUNT],
                    name,
                )
                gated_resources.add(name)
            else:
                self.assertEqual(count_values, [], name)
                self.assertNotIn("create_workloads", body, name)
                ungated_resources.add(name)

        self.assertEqual(gated_resources, EXPECTED_WORKLOAD_RESOURCE_BLOCKS)
        self.assertEqual(len(ungated_resources), 26)


if __name__ == "__main__":
    unittest.main()
