import json
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import scripts.browser_qa.terraform_plan_guard as terraform_plan_guard
from scripts.browser_qa.terraform_plan_guard import (
    ALLOWED_OUTPUTS,
    ALLOWED_RESOURCE_ADDRESSES,
    INFRA_OUTPUTS,
    INFRA_RESOURCE_ADDRESSES,
    WORKLOAD_OUTPUTS,
    WORKLOAD_RESOURCE_ADDRESSES,
    PlanValidationError,
    validate_bootstrap_plan,
)


REPO_ROOT = Path(__file__).resolve().parents[3]
GUARD_SCRIPT = REPO_ROOT / "scripts" / "browser_qa" / "terraform_plan_guard.py"
BROWSER_QA_TF = REPO_ROOT / "deploy" / "gcp" / "envs" / "browser-qa-staging" / "browser_qa.tf"
OUTPUTS_TF = REPO_ROOT / "deploy" / "gcp" / "envs" / "browser-qa-staging" / "outputs.tf"

EXPECTED_INFRA_RESOURCE_ADDRESSES = frozenset(
    {
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
)

EXPECTED_INFRA_RECOVERY_RESOURCE_ADDRESSES = frozenset(
    {
        "google_storage_bucket_iam_member.browser_qa_cleanup_report_admin",
        "google_storage_bucket_iam_member.browser_qa_deployer_report_viewer",
        "google_storage_bucket_iam_member.browser_qa_runtime_report_creator",
    }
)

EXPECTED_WORKLOAD_RESOURCE_ADDRESSES = frozenset(
    {
        "google_cloud_run_v2_job.browser_qa_cleanup[0]",
        "google_cloud_run_v2_job.browser_qa_main[0]",
        "google_cloud_run_v2_job_iam_member.browser_qa_cleanup_deployer_developer[0]",
        "google_cloud_run_v2_job_iam_member.browser_qa_cleanup_deployer_invoker[0]",
        "google_cloud_run_v2_job_iam_member.browser_qa_main_deployer_developer[0]",
        "google_cloud_run_v2_job_iam_member.browser_qa_main_deployer_invoker[0]",
        "google_cloud_run_v2_service.browser_qa_broker[0]",
        "google_cloud_run_v2_service_iam_member.browser_qa_broker_deployer_developer[0]",
        "google_cloud_run_v2_service_iam_member.browser_qa_broker_invoker[0]",
    }
)

EXPECTED_INFRA_OUTPUTS = frozenset(
    {
        "browser_qa_artifact_registry_url",
        "browser_qa_deployer_sa_email",
        "browser_qa_report_bucket",
        "browser_qa_wif_provider",
    }
)

EXPECTED_WORKLOAD_OUTPUTS = frozenset(
    {
        "browser_qa_broker_service_name",
        "browser_qa_broker_uri",
        "browser_qa_cleanup_job_name",
        "browser_qa_main_job_name",
    }
)

PHASE_RESOURCES = {
    "infra": EXPECTED_INFRA_RESOURCE_ADDRESSES,
    "infra-recovery": EXPECTED_INFRA_RECOVERY_RESOURCE_ADDRESSES,
    "workloads": EXPECTED_WORKLOAD_RESOURCE_ADDRESSES,
}
PHASE_OUTPUTS = {
    "infra": EXPECTED_INFRA_OUTPUTS,
    "infra-recovery": frozenset(),
    "workloads": EXPECTED_WORKLOAD_OUTPUTS,
}


def phase_plan(phase, *, include_other_phase_no_ops=False):
    resource_changes = [
        {"address": address, "change": {"actions": ["create"]}}
        for address in sorted(PHASE_RESOURCES[phase])
    ]
    output_changes = {
        output: {"actions": ["create"]}
        for output in sorted(PHASE_OUTPUTS[phase])
    }
    if phase == "infra-recovery":
        resource_changes.extend(
            {"address": address, "change": {"actions": ["no-op"]}}
            for address in sorted(EXPECTED_INFRA_RESOURCE_ADDRESSES - PHASE_RESOURCES[phase])
        )
        output_changes.update(
            {
                output: {"actions": ["no-op"]}
                for output in sorted(EXPECTED_INFRA_OUTPUTS)
            }
        )
    if include_other_phase_no_ops:
        included_addresses = {change["address"] for change in resource_changes}
        for other_phase in PHASE_RESOURCES:
            if other_phase == phase:
                continue
            other_addresses = PHASE_RESOURCES[other_phase] - included_addresses
            resource_changes.extend(
                {"address": address, "change": {"actions": ["no-op"]}}
                for address in sorted(other_addresses)
            )
            included_addresses.update(other_addresses)
            output_changes.update(
                {
                    output: {"actions": ["no-op"]}
                    for output in sorted(PHASE_OUTPUTS[other_phase])
                }
            )
    return {
        "resource_changes": resource_changes,
        "output_changes": output_changes,
    }


def combined_plan():
    return {
        "resource_changes": [
            {"address": address, "change": {"actions": ["create"]}}
            for address in sorted(ALLOWED_RESOURCE_ADDRESSES)
        ],
        "output_changes": {
            output: {"actions": ["create"]}
            for output in sorted(ALLOWED_OUTPUTS)
        },
    }


def assert_rejected(testcase, plan, phase, expected_message):
    with testcase.assertRaisesRegex(PlanValidationError, re.escape(expected_message)):
        validate_bootstrap_plan(plan, phase=phase)


def run_guard(raw_json, *, phase=None):
    with tempfile.TemporaryDirectory() as tmp_dir:
        plan_path = Path(tmp_dir) / "plan.json"
        plan_path.write_text(raw_json, encoding="utf-8")
        command = [sys.executable, "-B", str(GUARD_SCRIPT)]
        if phase is not None:
            command.extend(["--phase", phase])
        command.append(str(plan_path))
        return subprocess.run(
            command,
            cwd=REPO_ROOT,
            text=True,
            capture_output=True,
            check=False,
        )


def run_guard_help():
    return subprocess.run(
        [sys.executable, "-B", str(GUARD_SCRIPT), "--help"],
        cwd=REPO_ROOT,
        text=True,
        capture_output=True,
        check=False,
    )


class TerraformPlanGuardTest(unittest.TestCase):
    def test_phase_allowlists_match_exact_source_contract(self):
        self.assertEqual(INFRA_RESOURCE_ADDRESSES, EXPECTED_INFRA_RESOURCE_ADDRESSES)
        self.assertEqual(
            terraform_plan_guard.INFRA_RECOVERY_RESOURCE_ADDRESSES,
            EXPECTED_INFRA_RECOVERY_RESOURCE_ADDRESSES,
        )
        self.assertEqual(WORKLOAD_RESOURCE_ADDRESSES, EXPECTED_WORKLOAD_RESOURCE_ADDRESSES)
        self.assertEqual(INFRA_OUTPUTS, EXPECTED_INFRA_OUTPUTS)
        self.assertEqual(WORKLOAD_OUTPUTS, EXPECTED_WORKLOAD_OUTPUTS)
        self.assertEqual(ALLOWED_RESOURCE_ADDRESSES, INFRA_RESOURCE_ADDRESSES | WORKLOAD_RESOURCE_ADDRESSES)
        self.assertEqual(ALLOWED_OUTPUTS, INFRA_OUTPUTS | WORKLOAD_OUTPUTS)

        source_addresses = frozenset(
            ".".join(match)
            for match in re.findall(
                r'(?m)^\s*resource\s+"([^"]+)"\s+"([^"]+)"\s*\{',
                BROWSER_QA_TF.read_text(encoding="utf-8"),
            )
        )
        expected_source_addresses = INFRA_RESOURCE_ADDRESSES | frozenset(
            address.removesuffix("[0]") for address in WORKLOAD_RESOURCE_ADDRESSES
        )
        source_outputs = frozenset(
            re.findall(r'(?m)^\s*output\s+"([^"]+)"\s*\{', OUTPUTS_TF.read_text(encoding="utf-8"))
        )
        self.assertEqual(source_addresses, expected_source_addresses)
        self.assertEqual(source_outputs, ALLOWED_OUTPUTS)

    def test_infra_phase_accepts_exact_26_create_only_resources_and_4_outputs(self):
        changes = validate_bootstrap_plan(phase_plan("infra"), phase="infra")
        self.assertEqual(set(changes), INFRA_RESOURCE_ADDRESSES)

    def test_workload_phase_accepts_exact_9_creates_and_known_infra_no_ops(self):
        changes = validate_bootstrap_plan(
            phase_plan("workloads", include_other_phase_no_ops=True),
            phase="workloads",
        )
        self.assertEqual(set(changes), WORKLOAD_RESOURCE_ADDRESSES)

    def test_infra_recovery_phase_accepts_exact_3_creates_with_infra_no_ops(self):
        changes = validate_bootstrap_plan(phase_plan("infra-recovery"), phase="infra-recovery")
        self.assertEqual(set(changes), EXPECTED_INFRA_RECOVERY_RESOURCE_ADDRESSES)

    def test_combined_35_resource_plan_is_rejected_for_each_phase(self):
        for phase in PHASE_RESOURCES:
            with self.subTest(phase=phase):
                assert_rejected(self, combined_plan(), phase, f"unexpected resource for {phase} phase")

    def test_legacy_unindexed_workload_address_is_rejected(self):
        plan = phase_plan("workloads")
        plan["resource_changes"][0]["address"] = "google_cloud_run_v2_job.browser_qa_cleanup"
        assert_rejected(self, plan, "workloads", "unexpected resource")

    def test_extra_non_qa_resource_address_is_rejected_even_when_no_op(self):
        for actions in (["create"], ["no-op"]):
            with self.subTest(actions=actions):
                plan = phase_plan("infra")
                plan["resource_changes"].append(
                    {"address": "google_cloud_run_v2_service.newapi_console", "change": {"actions": actions}}
                )
                assert_rejected(self, plan, "infra", "unexpected resource")

    def test_infra_recovery_rejects_missing_and_extra_create(self):
        plan = phase_plan("infra-recovery")
        plan["resource_changes"] = [
            change
            for change in plan["resource_changes"]
            if change["address"] != sorted(EXPECTED_INFRA_RECOVERY_RESOURCE_ADDRESSES)[0]
        ]
        assert_rejected(self, plan, "infra-recovery", "missing resource for infra-recovery phase")

        plan = phase_plan("infra-recovery")
        infra_no_op = sorted(EXPECTED_INFRA_RESOURCE_ADDRESSES - EXPECTED_INFRA_RECOVERY_RESOURCE_ADDRESSES)[0]
        for change in plan["resource_changes"]:
            if change["address"] == infra_no_op:
                change["change"]["actions"] = ["create"]
                break
        assert_rejected(self, plan, "infra-recovery", "unexpected resource for infra-recovery phase")

    def test_any_meaningful_resource_change_that_is_not_single_create_is_rejected(self):
        for phase in PHASE_RESOURCES:
            for actions in (["update"], ["delete"], ["create", "delete"], ["delete", "create"], ["read"], ["replace"]):
                with self.subTest(phase=phase, actions=actions):
                    plan = phase_plan(phase)
                    plan["resource_changes"][0]["change"]["actions"] = actions
                    assert_rejected(self, plan, phase, "bootstrap plan is not create-only")

            plan = phase_plan(phase)
            plan["resource_changes"][0]["deposed"] = "deadbeef"
            assert_rejected(self, plan, phase, "bootstrap plan contains deposed object")

    def test_deposed_no_op_resource_is_rejected_before_no_op_filter(self):
        plan = phase_plan("infra")
        plan["resource_changes"].append(
            {
                "address": sorted(INFRA_RESOURCE_ADDRESSES)[0],
                "deposed": "deadbeef",
                "change": {"actions": ["no-op"]},
            }
        )
        with self.assertRaisesRegex(PlanValidationError, "deposed"):
            validate_bootstrap_plan(plan, phase="infra")

    def test_resource_set_must_be_exact_for_each_phase(self):
        for phase in PHASE_RESOURCES:
            with self.subTest(phase=phase):
                plan = phase_plan(phase)
                missing_address = sorted(PHASE_RESOURCES[phase])[0]
                plan["resource_changes"] = [
                    change
                    for change in plan["resource_changes"]
                    if change["address"] != missing_address
                ]
                assert_rejected(self, plan, phase, f"missing resource for {phase} phase")

    def test_duplicate_resource_change_keys_are_rejected_before_action_checks(self):
        plan = phase_plan("infra")
        first_address = sorted(INFRA_RESOURCE_ADDRESSES)[0]
        plan["resource_changes"].append(
            {"address": first_address, "change": {"actions": ["no-op"]}}
        )
        assert_rejected(self, plan, "infra", "duplicate resource change")

    def test_known_other_phase_no_ops_are_ignored(self):
        for phase in PHASE_RESOURCES:
            with self.subTest(phase=phase):
                changes = validate_bootstrap_plan(
                    phase_plan(phase, include_other_phase_no_ops=True),
                    phase=phase,
                )
                self.assertEqual(set(changes), PHASE_RESOURCES[phase])

    def test_output_set_and_actions_are_exact_for_each_phase(self):
        for phase in PHASE_OUTPUTS:
            with self.subTest(phase=phase, case="unexpected"):
                plan = phase_plan(phase)
                plan["output_changes"]["browser_qa_extra"] = {"actions": ["create"]}
                assert_rejected(self, plan, phase, "unexpected output")

            with self.subTest(phase=phase, case="missing"):
                plan = phase_plan(phase)
                if PHASE_OUTPUTS[phase]:
                    plan["output_changes"].pop(next(iter(PHASE_OUTPUTS[phase])))
                    assert_rejected(self, plan, phase, f"missing output for {phase} phase")
                else:
                    plan["output_changes"][next(iter(EXPECTED_INFRA_OUTPUTS))]["actions"] = ["create"]
                    assert_rejected(self, plan, phase, f"unexpected output for {phase} phase")

            with self.subTest(phase=phase, case="update"):
                plan = phase_plan(phase)
                if PHASE_OUTPUTS[phase]:
                    plan["output_changes"][next(iter(PHASE_OUTPUTS[phase]))]["actions"] = ["update"]
                    assert_rejected(self, plan, phase, "output changes are not create-only")
                else:
                    plan["output_changes"][next(iter(EXPECTED_INFRA_OUTPUTS))]["actions"] = ["update"]
                    assert_rejected(self, plan, phase, f"unexpected output for {phase} phase")

    def test_unknown_output_no_op_is_rejected_but_known_other_phase_no_op_is_ignored(self):
        plan = phase_plan("workloads", include_other_phase_no_ops=True)
        plan["output_changes"]["browser_qa_extra"] = {"actions": ["no-op"]}
        assert_rejected(self, plan, "workloads", "unexpected output")

    def test_empty_or_no_op_only_plan_is_rejected(self):
        assert_rejected(
            self,
            {"resource_changes": [], "output_changes": {}},
            "infra",
            "saved plan has no resource changes",
        )
        assert_rejected(
            self,
            {
                "resource_changes": [
                    {"address": sorted(INFRA_RESOURCE_ADDRESSES)[0], "change": {"actions": ["no-op"]}}
                ],
                "output_changes": {},
            },
            "infra",
            "saved plan has no resource changes",
        )

    def test_malformed_plan_shapes_and_unknown_phase_are_rejected(self):
        first_address = sorted(INFRA_RESOURCE_ADDRESSES)[0]
        first_output = sorted(INFRA_OUTPUTS)[0]
        malformed_plans = [
            [],
            {},
            {"resource_changes": {}},
            {"resource_changes": ["bad"]},
            {"resource_changes": [{"address": "", "change": {"actions": ["create"]}}]},
            {"resource_changes": [{"address": first_address, "change": []}]},
            {"resource_changes": [{"address": first_address, "change": {}}]},
            {"resource_changes": [{"address": first_address, "change": {"actions": "create"}}]},
            {"resource_changes": [{"address": first_address, "change": {"actions": [1]}}]},
            {"resource_changes": [], "output_changes": []},
            {"resource_changes": [], "output_changes": {first_output: []}},
            {"resource_changes": [], "output_changes": {first_output: {}}},
        ]
        for plan in malformed_plans:
            with self.subTest(plan=plan):
                with self.assertRaises(PlanValidationError):
                    validate_bootstrap_plan(plan, phase="infra")

        with self.assertRaisesRegex(PlanValidationError, "unknown bootstrap phase"):
            validate_bootstrap_plan(phase_plan("infra"), phase="legacy")

    def test_blank_address_deposed_and_output_name_are_malformed(self):
        plan = phase_plan("infra")
        plan["resource_changes"][0]["address"] = " "
        assert_rejected(self, plan, "infra", "resource change address must be a non-empty string")

        plan = phase_plan("infra")
        plan["resource_changes"].append(
            {
                "address": sorted(INFRA_RESOURCE_ADDRESSES)[0],
                "deposed": " ",
                "change": {"actions": ["no-op"]},
            }
        )
        assert_rejected(self, plan, "infra", "resource change deposed must be a non-empty string")

        plan = phase_plan("infra")
        plan["output_changes"][" "] = {"actions": ["create"]}
        assert_rejected(self, plan, "infra", "output change name must be a non-empty string")

    def test_cli_requires_valid_phase_and_rejects_bad_plan_without_traceback(self):
        missing_phase = run_guard(json.dumps(phase_plan("infra")))
        self.assertEqual(missing_phase.returncode, 2)
        self.assertIn("--phase", missing_phase.stderr)

        invalid_phase = run_guard(json.dumps(phase_plan("infra")), phase="legacy")
        self.assertEqual(invalid_phase.returncode, 2)
        self.assertIn("invalid choice", invalid_phase.stderr)

        update_plan = phase_plan("infra")
        update_plan["resource_changes"][0]["change"]["actions"] = ["update"]
        for raw_json in ("{", "[]", "{}", json.dumps(update_plan)):
            with self.subTest(raw_json=raw_json):
                result = run_guard(raw_json, phase="infra")
                self.assertEqual(result.returncode, 1)
                self.assertTrue(result.stderr.startswith("ABORT:"), result.stderr)
                self.assertNotIn("Traceback", result.stderr)

    def test_cli_success_message_is_phase_specific(self):
        expected = {
            "infra": "OK: exact Browser QA infra create-only bootstrap plan",
            "infra-recovery": "OK: exact Browser QA infra-recovery create-only bootstrap plan",
            "workloads": "OK: exact Browser QA workloads create-only bootstrap plan",
        }
        for phase, message in expected.items():
            with self.subTest(phase=phase):
                result = run_guard(json.dumps(phase_plan(phase)), phase=phase)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn(message, result.stdout)

    def test_cli_rejects_deposed_no_op_resource_without_traceback(self):
        plan = phase_plan("infra")
        plan["resource_changes"].append(
            {
                "address": sorted(INFRA_RESOURCE_ADDRESSES)[0],
                "deposed": "deadbeef",
                "change": {"actions": ["no-op"]},
            }
        )
        result = run_guard(json.dumps(plan), phase="infra")
        self.assertEqual(result.returncode, 1)
        self.assertTrue(result.stderr.startswith("ABORT:"), result.stderr)
        self.assertIn("deposed", result.stderr)
        self.assertNotIn("Traceback", result.stderr)

    def test_cli_help_describes_phase_and_terraform_show_json(self):
        result = run_guard_help()
        self.assertEqual(result.returncode, 0)
        self.assertIn("--phase {infra,infra-recovery,workloads}", result.stdout)
        self.assertIn("Path produced by terraform show -json", result.stdout)

    def test_cli_rejects_raw_duplicate_output_keys(self):
        output_entries = ",".join(
            f'"{output}": {{"actions": ["create"]}}'
            for output in sorted(INFRA_OUTPUTS)
        )
        duplicate_output = sorted(INFRA_OUTPUTS)[0]
        raw_json = json.dumps({"resource_changes": phase_plan("infra")["resource_changes"]})[:-1]
        raw_json += (
            f', "output_changes": {{{output_entries}, '
            f'"{duplicate_output}": {{"actions": ["create"]}}'
            "}}"
        )
        result = run_guard(raw_json, phase="infra")
        self.assertEqual(result.returncode, 1)
        self.assertTrue(result.stderr.startswith("ABORT:"), result.stderr)
        self.assertNotIn("Traceback", result.stderr)


if __name__ == "__main__":
    unittest.main()
