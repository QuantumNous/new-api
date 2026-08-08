import copy
import json
import os
import re
import tempfile
import unittest
from unittest import mock

from scripts.browser_qa.flatkey_browser_qa.fixed_cases import (
    FixedCaseValidationError,
    enabled_cases,
    list_cases,
    load_case,
    validate_case,
)


VALID_CASE = {
    "schema_version": 1,
    "id": "FQA-9001",
    "kind": "coverage_baseline",
    "name": "Sign in link avoids missing page",
    "enabled": False,
    "severity": "medium",
    "owner": "browser-qa",
    "fixture": "anonymous",
    "start": {"origin": "staging_website", "path": "/zh"},
    "steps": [
        {
            "click": {
                "locator": {
                    "by": "role",
                    "role": "link",
                    "name": "Sign in",
                }
            }
        }
    ],
    "assertions": [
        {"page_status_not": 404},
        {"url_not_contains": "/404"},
    ],
    "evidence": {
        "screenshot_on_failure": True,
        "capture_console": True,
        "capture_network": False,
    },
    "cleanup": "not_required",
    "source": {
        "run_id": "123456789",
        "finding_fingerprint": "finding-9001",
        "evidence_uri": "gs://flatkey-browser-qa-private/run-123/fqa-9001",
    },
    "promotion": {
        "state": "candidate_draft",
        "attempts_required": 3,
        "attempts_passed": 0,
    },
}


def case_yaml(case):
    step = case["steps"][0]
    assertion_lines = []
    for assertion in case["assertions"]:
        key, value = next(iter(assertion.items()))
        assertion_lines.append(f"  - {key}: {str(value).lower() if isinstance(value, bool) else value}")
    return f"""schema_version: {case["schema_version"]}
id: {case["id"]}
kind: {case["kind"]}
name: {case["name"]}
enabled: {str(case["enabled"]).lower()}
severity: {case["severity"]}
owner: {case["owner"]}
fixture: {case["fixture"]}
start:
  origin: {case["start"]["origin"]}
  path: {case["start"]["path"]}
steps:
  - click:
      locator:
        by: {step["click"]["locator"]["by"]}
        role: {step["click"]["locator"]["role"]}
        name: {step["click"]["locator"]["name"]}
assertions:
{os.linesep.join(assertion_lines)}
evidence:
  screenshot_on_failure: {str(case["evidence"]["screenshot_on_failure"]).lower()}
  capture_console: {str(case["evidence"]["capture_console"]).lower()}
  capture_network: {str(case["evidence"]["capture_network"]).lower()}
cleanup: {case["cleanup"]}
source:
  run_id: "{case["source"]["run_id"]}"
  finding_fingerprint: "{case["source"]["finding_fingerprint"]}"
  evidence_uri: "{case["source"]["evidence_uri"]}"
promotion:
  state: {case["promotion"]["state"]}
  attempts_required: {case["promotion"]["attempts_required"]}
  attempts_passed: {case["promotion"]["attempts_passed"]}
"""


class FixedCaseTests(unittest.TestCase):
    def write_case(self, directory, name, payload=None, text=None):
        path = os.path.join(directory, name)
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(text if text is not None else case_yaml(payload or VALID_CASE))
        return path

    def assert_invalid(self, payload):
        with self.assertRaises(FixedCaseValidationError):
            validate_case(payload)

    def test_valid_disabled_case_loads(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = self.write_case(tmp, "FQA-9001.yaml")

            self.assertEqual(load_case(path), VALID_CASE)

    def test_repository_fixtures_load_and_remain_disabled(self):
        root = os.path.join(os.path.dirname(__file__), "..", "fixed-cases")

        cases = [load_case(os.path.join(root, name)) for name in [
            "FQA-0001-sign-in-route.yaml",
            "FQA-0002-sign-up-entry.yaml",
        ]]

        self.assertEqual([case["id"] for case in cases], ["FQA-0001", "FQA-0002"])
        self.assertTrue(all(case["enabled"] is False for case in cases))
        self.assertTrue(all(case["promotion"]["state"] == "candidate_draft" for case in cases))
        self.assertTrue(all(case["promotion"]["attempts_passed"] == 0 for case in cases))

    def test_rejects_unknown_top_and_nested_fields(self):
        payload = copy.deepcopy(VALID_CASE)
        payload["extra"] = "bad"
        self.assert_invalid(payload)

        payload = copy.deepcopy(VALID_CASE)
        payload["start"]["extra"] = "bad"
        self.assert_invalid(payload)

        payload = copy.deepcopy(VALID_CASE)
        payload["steps"][0]["click"]["locator"]["css"] = ".sign-in"
        self.assert_invalid(payload)

    def test_unknown_field_errors_do_not_echo_attacker_controlled_keys(self):
        payload = copy.deepcopy(VALID_CASE)
        payload["sk-live-secret-key-material"] = "present"

        with self.assertRaises(FixedCaseValidationError) as raised:
            validate_case(payload)

        self.assertNotIn("sk-live-secret-key-material", str(raised.exception))

    def test_rejects_missing_required_fields_and_bad_types(self):
        payload = copy.deepcopy(VALID_CASE)
        del payload["owner"]
        self.assert_invalid(payload)

        payload = copy.deepcopy(VALID_CASE)
        payload["enabled"] = "false"
        self.assert_invalid(payload)

        payload = copy.deepcopy(VALID_CASE)
        payload["promotion"]["attempts_passed"] = True
        self.assert_invalid(payload)

    def test_rejects_enabled_case_before_promotion_qualification(self):
        payload = copy.deepcopy(VALID_CASE)
        payload["enabled"] = True

        self.assert_invalid(payload)

    def test_rejects_css_locators_and_absolute_navigation_urls(self):
        payload = copy.deepcopy(VALID_CASE)
        payload["steps"][0] = {"click": {"locator": {"by": "css", "value": ".sign-in"}}}
        self.assert_invalid(payload)

        payload = copy.deepcopy(VALID_CASE)
        payload["steps"][0] = {"navigate": {"path": "https://staging-console.flatkey.ai/login"}}
        self.assert_invalid(payload)

        payload = copy.deepcopy(VALID_CASE)
        payload["start"]["path"] = "https://console.flatkey.ai/login"
        self.assert_invalid(payload)

    def test_rejects_dangerous_yaml_duplicate_keys_and_oversized_files(self):
        dangerous = [
            "schema_version: 1\n---\nid: FQA-9001\n",
            "schema_version: &version 1\nid: *version\n",
            "schema_version: !unsafe 1\n",
            "schema_version: 1\nname: |\n  block\n",
            "schema_version:\n\tid: FQA-9001\n",
            "<<: {schema_version: 1}\n",
        ]
        with tempfile.TemporaryDirectory() as tmp:
            for index, text in enumerate(dangerous):
                with self.subTest(index=index):
                    path = self.write_case(tmp, f"danger-{index}.yaml", text=text)
                    with self.assertRaises(FixedCaseValidationError):
                        load_case(path)

            duplicate = case_yaml(VALID_CASE) + "id: FQA-9999\n"
            path = self.write_case(tmp, "duplicate.yaml", text=duplicate)
            with self.assertRaises(FixedCaseValidationError):
                load_case(path)

            large_path = os.path.join(tmp, "large.yaml")
            with open(large_path, "w", encoding="utf-8") as handle:
                handle.write("#" * (65 * 1024))
            with self.assertRaises(FixedCaseValidationError):
                load_case(large_path)

    def test_rejects_explicit_yaml_tags_and_block_scalar_variants_without_echoing_input(self):
        base = case_yaml(VALID_CASE)
        dangerous = [
            base.replace("name: Sign in link avoids missing page", "name: !!str super-secret-token"),
            base.replace("name: Sign in link avoids missing page", "name: !<tag:yaml.org,2002:str> super-secret-token"),
            base.replace("name: Sign in link avoids missing page", "name: |-\n  super-secret-token"),
            base.replace("name: Sign in link avoids missing page", "name: >-\n  super-secret-token"),
            base.replace("name: Sign in link avoids missing page", "name: |+\n  super-secret-token"),
            base.replace("name: Sign in link avoids missing page", "name: >+\n  super-secret-token"),
            base.replace("name: Sign in link avoids missing page", "name: |2\n  super-secret-token"),
            base.replace("name: Sign in link avoids missing page", "name: >2\n  super-secret-token"),
        ]
        with tempfile.TemporaryDirectory() as tmp:
            for index, text in enumerate(dangerous):
                with self.subTest(index=index):
                    path = self.write_case(tmp, f"danger-tag-{index}.yaml", text=text)
                    with self.assertRaises(FixedCaseValidationError) as raised:
                        load_case(path)
                    self.assertNotIn("super-secret-token", str(raised.exception))

    def test_rejects_indent_jumps(self):
        invalid_root_jump = "schema_version: 1\n    id: FQA-9001\n"
        invalid_payload_jump = case_yaml(VALID_CASE).replace(
            "      locator:\n        by: role",
            "        locator:\n          by: role",
        )
        with tempfile.TemporaryDirectory() as tmp:
            for index, text in enumerate([invalid_root_jump, invalid_payload_jump]):
                with self.subTest(index=index):
                    path = self.write_case(tmp, f"bad-indent-{index}.yaml", text=text)
                    with self.assertRaises(FixedCaseValidationError):
                        load_case(path)

    def test_load_case_converts_open_oserror_without_leaking_path_or_system_message(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = self.write_case(tmp, "FQA-9001.yaml")
            with mock.patch("builtins.open", side_effect=OSError("secret path denied")):
                with self.assertRaises(FixedCaseValidationError) as raised:
                    load_case(path)

        self.assertEqual(str(raised.exception), "case file cannot be read")

    def test_validate_case_rejects_navigate_back_none(self):
        payload = copy.deepcopy(VALID_CASE)
        payload["steps"] = [{"navigate_back": None}]

        self.assert_invalid(payload)

    def test_list_cases_sorts_stably_and_enabled_cases_filters(self):
        ready = copy.deepcopy(VALID_CASE)
        ready["id"] = "FQA-9002"
        ready["enabled"] = True
        ready["promotion"] = {
            "state": "ready_for_review",
            "attempts_required": 3,
            "attempts_passed": 3,
        }
        with tempfile.TemporaryDirectory() as tmp:
            self.write_case(tmp, "FQA-9002-z.yaml", payload=ready)
            self.write_case(tmp, "FQA-9001-a.yaml")
            self.write_case(tmp, "ignored.txt", text=case_yaml(VALID_CASE))

            self.assertEqual([case["id"] for case in list_cases(tmp)], ["FQA-9001", "FQA-9002"])
            self.assertEqual([case["id"] for case in enabled_cases(tmp)], ["FQA-9002"])

    def test_list_cases_only_loads_fqa_yaml_files_and_ignores_directories(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.write_case(tmp, "FQA-9002.yaml", payload={**VALID_CASE, "id": "FQA-9002"})
            self.write_case(tmp, "FQA-9001.yml")
            self.write_case(tmp, "not-fqa.yaml", text="not: a case\n")
            os.mkdir(os.path.join(tmp, "FQA-9000.yaml"))

            self.assertEqual([case["id"] for case in list_cases(tmp)], ["FQA-9002"])

    def test_schema_declares_same_strict_fields_and_enums_as_validator(self):
        schema_path = os.path.join(os.path.dirname(__file__), "..", "config", "fixed_case.schema.json")
        with open(schema_path, encoding="utf-8") as handle:
            schema = json.load(handle)

        self.assertFalse(schema["additionalProperties"])
        self.assertEqual(set(schema["required"]), set(VALID_CASE))
        for field in ["start", "evidence", "source", "promotion"]:
            self.assertFalse(schema["properties"][field]["additionalProperties"])
        self.assertEqual(schema["properties"]["severity"]["enum"], ["critical", "high", "medium", "low", "info"])
        self.assertEqual(schema["properties"]["fixture"]["enum"], ["anonymous", "registered_user", "user_with_api_key"])
        self.assertEqual(schema["properties"]["promotion"]["properties"]["attempts_required"]["const"], 3)

    def test_schema_declares_enabled_promotion_gate(self):
        schema_path = os.path.join(os.path.dirname(__file__), "..", "config", "fixed_case.schema.json")
        with open(schema_path, encoding="utf-8") as handle:
            schema = json.load(handle)

        conditionals = schema.get("allOf", [])
        enabled_gate = next(
            item for item in conditionals
            if item.get("if", {}).get("properties", {}).get("enabled", {}).get("const") is True
        )

        promotion = enabled_gate["then"]["properties"]["promotion"]["properties"]
        self.assertEqual(promotion["state"]["const"], "ready_for_review")
        self.assertEqual(promotion["attempts_required"]["const"], 3)
        self.assertEqual(promotion["attempts_passed"]["const"], 3)

    def test_schema_non_path_strings_reject_controls_like_python_validator(self):
        schema_path = os.path.join(os.path.dirname(__file__), "..", "config", "fixed_case.schema.json")
        with open(schema_path, encoding="utf-8") as handle:
            schema = json.load(handle)

        safe_string_ref = {"$ref": "#/$defs/non_control_string"}
        self.assertEqual(schema["properties"]["name"], safe_string_ref)
        self.assertEqual(schema["properties"]["source"]["properties"]["run_id"], safe_string_ref)
        self.assertEqual(schema["properties"]["source"]["properties"]["finding_fingerprint"], safe_string_ref)
        self.assertEqual(
            schema["properties"]["assertions"]["items"]["properties"]["url_not_contains"],
            safe_string_ref,
        )
        for branch in schema["$defs"]["locator"]["oneOf"]:
            for key, value in branch["properties"].items():
                if key != "by":
                    self.assertEqual(value, safe_string_ref)

    def test_schema_path_pattern_rejects_external_and_control_paths(self):
        schema_path = os.path.join(os.path.dirname(__file__), "..", "config", "fixed_case.schema.json")
        with open(schema_path, encoding="utf-8") as handle:
            schema = json.load(handle)
        pattern = re.compile(schema["properties"]["start"]["properties"]["path"]["pattern"])

        self.assertRegex("/zh/login", pattern)
        for path in [
            "//console.flatkey.ai/login",
            "/login?token=secret",
            "/login#fragment",
            "/login\\admin",
            "/bad\npath",
            "https://staging-console.flatkey.ai/login",
        ]:
            with self.subTest(path=path):
                self.assertIsNone(pattern.fullmatch(path))

    def test_evidence_uri_rejects_at_sign_in_python_and_schema(self):
        for uri in [
            "gs://flatkey-browser-qa-private/path@secret",
            "gs://flatkey-browser-qa-private/path\nsecret",
            "gs://flatkey-browser-qa-private/path\rsecret",
            "gs://flatkey-browser-qa-private/path\x7fsecret",
        ]:
            with self.subTest(python_uri=uri):
                payload = copy.deepcopy(VALID_CASE)
                payload["source"]["evidence_uri"] = uri
                self.assert_invalid(payload)

        schema_path = os.path.join(os.path.dirname(__file__), "..", "config", "fixed_case.schema.json")
        with open(schema_path, encoding="utf-8") as handle:
            schema = json.load(handle)
        pattern = re.compile(schema["properties"]["source"]["properties"]["evidence_uri"]["pattern"])

        for uri in [
            "gs://flatkey-browser-qa-private/path",
            "gs://flatkey-browser-qa-private/path@secret",
            "gs://flatkey-browser-qa-private/path?token=secret",
            "gs://flatkey-browser-qa-private/path#fragment",
            "gs://flatkey-browser-qa-private/path\nsecret",
            "gs://flatkey-browser-qa-private/path\rsecret",
            "gs://flatkey-browser-qa-private/path\x7fsecret",
            "https://example.com/path",
            "gs:///missing-bucket",
        ]:
            with self.subTest(uri=uri):
                matched = pattern.fullmatch(uri) is not None
                self.assertEqual(matched, uri == "gs://flatkey-browser-qa-private/path")


if __name__ == "__main__":
    unittest.main()
