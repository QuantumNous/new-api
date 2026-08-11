import json
import os
import tempfile
import unittest
from unittest import mock

from scripts.browser_qa.flatkey_browser_qa.cleanup import CleanupResult
from scripts.browser_qa.flatkey_browser_qa import report


def valid_result(**overrides):
    payload = {
        "replay": {"status": "passed", "checkpoint_reached": True},
        "exploration": {"status": "passed", "actions_used": 3},
        "budgets": {"replay_seconds": 300, "exploration_seconds": 300, "max_actions": 30},
        "findings": [],
        "coverage_candidates": [],
        "fixed_cases": {"status": "not_started", "cases": []},
        "phase_trace": [],
    }
    payload.update(overrides)
    return payload


def finding(**overrides):
    payload = {
        "severity": "medium",
        "title": "registration accepts weak confirmation state",
        "target_url": "https://staging-console.flatkey.ai/register",
        "steps": ["Open registration", "Submit form"],
        "expected": "The flow should reject the state.",
        "actual": "The flow accepted the state.",
        "evidence_paths": ["artifacts/screenshot.png"],
        "confidence": "high",
        "proposed_case": None,
    }
    payload.update(overrides)
    return payload


def proposed_case(**overrides):
    payload = {
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
        "cleanup": "not_required",
    }
    payload.update(overrides)
    return payload


def coverage_candidate(**overrides):
    payload = {
        "title": "registration confirmation copy should be covered",
        "target_url": "https://staging-console.flatkey.ai/register?token=secret#step",
        "steps": ["Open registration", "Submit form"],
        "expected": "The flow should show a stable confirmation state.",
        "observed": "The confirmation state was visible.",
        "business_value": "Prevents regressions in first-run registration.",
        "evidence_paths": ["screenshots/proof.png"],
        "confidence": "medium",
        "mutates_state": False,
        "cleanup_requirement": "not_required",
        "proposed_case": None,
    }
    payload.update(overrides)
    return payload


def fixed_case(**overrides):
    payload = {
        "status": "passed",
        "case_id": "FQA-0001",
        "attempt_id": "run-12345",
        "evidence_dir": "FQA-0001/run-12345",
        "steps": [{"index": 0, "action": "navigate", "status": "passed"}],
        "assertions": [{"index": 0, "assertion": "page_status_not", "status": "passed"}],
        "failure": None,
    }
    payload.update(overrides)
    return payload


def valid_provenance(**overrides):
    payload = {
        "skill_name": "flatkey-new-user-onboarding",
        "skill_content_sha256": "a" * 64,
        "codex_version": "codex 1.2.3",
        "model_config": {
            "model": "gpt-5.4",
            "sandbox": "workspace-write",
            "network_access": False,
        },
        "playwright_mcp_version": "playwright-mcp 1.0.0",
        "playwright_package_version": "1.50.0",
        "chromium_version": "Chromium 123.0.0.0",
    }
    payload.update(overrides)
    return payload


class ReportTests(unittest.TestCase):
    def test_normalize_findings_does_not_downgrade_first_party_denied_target_host(self):
        with tempfile.TemporaryDirectory() as tmp:
            browser_dir = os.path.join(tmp, "browser")
            os.makedirs(browser_dir)
            with open(os.path.join(browser_dir, "network.jsonl"), "w", encoding="utf-8") as handle:
                handle.write("{}\n")
            first_party = finding(
                target_url="https://staging-console.flatkey.ai/register",
                actual="The staging console could not be reached through the QA proxy.",
                evidence_paths=["browser/network.jsonl"],
            )
            third_party = finding(
                title="analytics dependency reported blocked",
                target_url="https://staging-console.flatkey.ai/register",
                actual="The page reported that mixpanel.example was blocked.",
                evidence_paths=["browser/network.jsonl"],
            )

            normalized = report.normalize_findings(
                valid_result(findings=[first_party, third_party]),
                runtime_root=tmp,
                proxy_events=[
                    {"host": "staging-console.flatkey.ai:443", "status": 403, "reason": "denied"},
                    {"host": "mixpanel.example:443", "status": 403, "reason": "denied"},
                ],
            )

            self.assertEqual(normalized["findings"][0]["severity"], "medium")
            self.assertEqual(normalized["findings"][1]["severity"], "info")

    def test_normalize_findings_treats_oversized_evidence_as_unusable_without_unbounded_read(self):
        class GuardedReader:
            def __init__(self, handle, max_read_size):
                self.handle = handle
                self.max_read_size = max_read_size

            def __enter__(self):
                self.handle.__enter__()
                return self

            def __exit__(self, *args):
                return self.handle.__exit__(*args)

            def read(self, size=-1):
                if size < 0 or size > self.max_read_size:
                    raise AssertionError("evidence reader attempted an unbounded read")
                return self.handle.read(size)

            def readline(self, size=-1):
                if size < 0 or size > self.max_read_size:
                    raise AssertionError("evidence reader attempted an unbounded line read")
                return self.handle.readline(size)

        with tempfile.TemporaryDirectory() as tmp:
            screenshot_dir = os.path.join(tmp, "screenshots")
            os.makedirs(screenshot_dir)
            screenshot_path = os.path.join(screenshot_dir, "large.png")
            with open(screenshot_path, "wb") as handle:
                handle.write(b"x" * 17)

            original_open = open

            def guarded_open(path, mode="r", *args, **kwargs):
                handle = original_open(path, mode, *args, **kwargs)
                if os.path.realpath(path) == os.path.realpath(screenshot_path) and "b" in mode:
                    return GuardedReader(handle, 16)
                return handle

            with (
                mock.patch.object(report, "MAX_EVIDENCE_FILE_BYTES", 16, create=True),
                mock.patch("builtins.open", guarded_open),
            ):
                normalized = report.normalize_findings(
                    valid_result(findings=[finding(evidence_paths=["screenshots/large.png"])]),
                    runtime_root=tmp,
                    proxy_events=[],
                )

            self.assertEqual(normalized["findings"][0]["severity"], "info")

    def test_normalize_findings_requires_existing_bounded_runtime_evidence(self):
        with tempfile.TemporaryDirectory() as tmp:
            payload = valid_result(findings=[finding(evidence_paths=["screenshots/missing.png"])])

            normalized = report.normalize_findings(payload, runtime_root=tmp, proxy_events=[])

            self.assertEqual(normalized["findings"][0]["severity"], "info")

            actionable_proposal = valid_result(findings=[finding(
                evidence_paths=["screenshots/missing.png"],
                proposed_case=proposed_case(),
            )])

            normalized = report.normalize_findings(actionable_proposal, runtime_root=tmp, proxy_events=[])

            self.assertEqual(normalized["findings"][0]["severity"], "info")
            self.assertIsNone(normalized["findings"][0]["proposed_case"])
            self.assertEqual(report.classify_status(normalized), "passed")

            outside = tempfile.NamedTemporaryFile(delete=False)
            outside.close()
            self.addCleanup(lambda: os.path.exists(outside.name) and os.remove(outside.name))
            for evidence_path in [outside.name, "../outside.png", "result.json", "browser/unknown.jsonl"]:
                with self.subTest(evidence_path=evidence_path):
                    normalized = report.normalize_findings(
                        valid_result(findings=[finding(evidence_paths=[evidence_path])]),
                        runtime_root=tmp,
                        proxy_events=[],
                    )
                    self.assertEqual(normalized["findings"][0]["severity"], "info")

    def test_normalize_findings_strips_query_fragment_and_deduplicates_by_evidence_fingerprint(self):
        with tempfile.TemporaryDirectory() as tmp:
            screenshot_dir = os.path.join(tmp, "screenshots")
            os.makedirs(screenshot_dir)
            for name in ["proof-a.png", "proof-b.png"]:
                with open(os.path.join(screenshot_dir, name), "wb") as handle:
                    handle.write(b"same-evidence")
            first = finding(
                target_url="https://staging-console.flatkey.ai/register?email=secret#form",
                evidence_paths=["screenshots/proof-a.png"],
            )
            duplicate = finding(
                target_url="https://staging-console.flatkey.ai/register?other=value#other",
                evidence_paths=["screenshots/proof-b.png"],
            )

            normalized = report.normalize_findings(
                valid_result(findings=[first, duplicate]),
                runtime_root=tmp,
                proxy_events=[],
            )

            self.assertEqual(len(normalized["findings"]), 1)
            self.assertEqual(
                normalized["findings"][0]["target_url"],
                "https://staging-console.flatkey.ai/register",
            )

    def test_normalize_findings_downgrades_runtime_denied_third_party_noise(self):
        with tempfile.TemporaryDirectory() as tmp:
            browser_dir = os.path.join(tmp, "browser")
            os.makedirs(browser_dir)
            with open(os.path.join(browser_dir, "network.jsonl"), "w", encoding="utf-8") as handle:
                handle.write("{}\n")
            payload = valid_result(findings=[finding(
                actual="The page reported that mixpanel.example was blocked.",
                evidence_paths=["browser/network.jsonl"],
            )])

            normalized = report.normalize_findings(
                payload,
                runtime_root=tmp,
                proxy_events=[{"host": "mixpanel.example:443", "status": 403, "reason": "denied"}],
            )

            self.assertEqual(normalized["findings"][0]["severity"], "info")
            self.assertEqual(report.classify_status(normalized), "passed")

    def test_normalize_findings_clears_proposed_case_for_third_party_noise_downgrade(self):
        with tempfile.TemporaryDirectory() as tmp:
            browser_dir = os.path.join(tmp, "browser")
            os.makedirs(browser_dir)
            with open(os.path.join(browser_dir, "network.jsonl"), "w", encoding="utf-8") as handle:
                handle.write("{}\n")
            payload = valid_result(findings=[finding(
                actual="The page reported that mixpanel.example was blocked.",
                evidence_paths=["browser/network.jsonl"],
                proposed_case=proposed_case(),
            )])

            normalized = report.normalize_findings(
                payload,
                runtime_root=tmp,
                proxy_events=[{"host": "mixpanel.example:443", "status": 403, "reason": "denied"}],
            )

            self.assertEqual(normalized["findings"][0]["severity"], "info")
            self.assertIsNone(normalized["findings"][0]["proposed_case"])
            self.assertEqual(report.classify_status(normalized), "passed")

    def test_normalize_findings_downgrades_third_party_only_browser_noise(self):
        with tempfile.TemporaryDirectory() as tmp:
            browser_dir = os.path.join(tmp, "browser")
            os.makedirs(browser_dir)
            with open(os.path.join(browser_dir, "network.jsonl"), "w", encoding="utf-8") as handle:
                handle.write(json.dumps({
                    "url": "https://mixpanel.example/track",
                    "method": "POST",
                    "error": "blocked by browser qa egress policy",
                }) + "\n")
                handle.write(json.dumps({
                    "url": "https://www.googletagmanager.com/gtm.js",
                    "method": "GET",
                    "error": "blocked by browser qa egress policy",
                }) + "\n")
            payload = valid_result(findings=[finding(
                actual="The browser showed mixpanel.example and googletagmanager.com were blocked.",
                evidence_paths=["browser/network.jsonl"],
            )])

            normalized = report.normalize_findings(
                payload,
                runtime_root=tmp,
                proxy_events=[
                    {"host": "mixpanel.example:443", "status": 403, "reason": "denied"},
                    {"host": "www.googletagmanager.com:443", "status": 403, "reason": "denied"},
                ],
            )

            self.assertEqual(normalized["findings"][0]["severity"], "info")
            self.assertEqual(report.classify_status(normalized), "passed")

    def test_normalize_findings_downgrades_third_party_noise_with_unbound_screenshot(self):
        with tempfile.TemporaryDirectory() as tmp:
            screenshot_dir = os.path.join(tmp, "screenshots")
            os.makedirs(screenshot_dir)
            with open(os.path.join(screenshot_dir, "proof.png"), "wb") as handle:
                handle.write(b"\x89PNG\r\n\x1a\nvisual-state")
            payload = valid_result(findings=[finding(
                actual="Registration failed while mixpanel.example was also blocked.",
                evidence_paths=["screenshots/proof.png"],
            )])

            normalized = report.normalize_findings(
                payload,
                runtime_root=tmp,
                proxy_events=[{"host": "mixpanel.example:443", "status": 403, "reason": "denied"}],
            )

            self.assertEqual(normalized["findings"][0]["severity"], "info")
            self.assertEqual(report.classify_status(normalized), "passed")

    def test_normalize_findings_preserves_origin_bound_product_evidence_with_denied_third_party_text(self):
        cases = [
            ("console", "browser/console.jsonl", json.dumps({
                "type": "error",
                "text": "registration submit failed",
                "location": {"url": "https://staging-console.flatkey.ai/register"},
            }).encode("utf-8") + b"\n"),
            ("network", "browser/network.jsonl", json.dumps({
                "url": "https://staging-console.flatkey.ai/api/register",
                "method": "POST",
                "status": 500,
            }).encode("utf-8") + b"\n"),
        ]
        for name, evidence_path, content in cases:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as tmp:
                os.makedirs(os.path.dirname(os.path.join(tmp, evidence_path)))
                with open(os.path.join(tmp, evidence_path), "wb") as handle:
                    handle.write(content)
                payload = valid_result(findings=[finding(
                    actual="Registration failed while mixpanel.example was also blocked.",
                    evidence_paths=[evidence_path],
                )])

                normalized = report.normalize_findings(
                    payload,
                    runtime_root=tmp,
                    proxy_events=[{"host": "mixpanel.example:443", "status": 403, "reason": "denied"}],
                )

                self.assertEqual(normalized["findings"][0]["severity"], "medium")
                self.assertEqual(report.classify_status(normalized), "findings_detected")

    def test_normalize_findings_keeps_evidence_backed_same_origin_product_failure_actionable(self):
        with tempfile.TemporaryDirectory() as tmp:
            browser_dir = os.path.join(tmp, "browser")
            os.makedirs(browser_dir)
            with open(os.path.join(browser_dir, "network.jsonl"), "w", encoding="utf-8") as handle:
                handle.write("{}\n")
            payload = valid_result(findings=[finding(
                target_url="https://staging-console.flatkey.ai/register",
                actual="The staging registration API returned 500.",
                evidence_paths=["browser/network.jsonl"],
            )])

            normalized = report.normalize_findings(
                payload,
                runtime_root=tmp,
                proxy_events=[{"host": "app.solvea.cx", "status": 403, "reason": "denied"}],
            )

            self.assertEqual(normalized["findings"][0]["severity"], "medium")
            self.assertEqual(report.classify_status(normalized), "findings_detected")

    def test_schema_rejects_missing_extra_invalid_type_enum_and_finding_shape(self):
        with self.assertRaises(report.ResultValidationError):
            report.validate_result({"replay": {}})

        extra = valid_result(extra="not allowed")
        with self.assertRaises(report.ResultValidationError):
            report.validate_result(extra)

        bad_type = valid_result(findings="not a list")
        with self.assertRaises(report.ResultValidationError):
            report.validate_result(bad_type)

        bad_enum = valid_result(findings=[finding(severity="warning")])
        with self.assertRaises(report.ResultValidationError):
            report.validate_result(bad_enum)

        missing_finding_field = valid_result(findings=[{k: v for k, v in finding().items() if k != "actual"}])
        with self.assertRaises(report.ResultValidationError):
            report.validate_result(missing_finding_field)

    def test_proposed_case_is_required_for_findings_and_coverage_candidates(self):
        with self.assertRaises(report.ResultValidationError):
            report.validate_result(valid_result(findings=[{k: v for k, v in finding().items() if k != "proposed_case"}]))

        with self.assertRaises(report.ResultValidationError):
            report.validate_result(valid_result(coverage_candidates=[
                {k: v for k, v in coverage_candidate().items() if k != "proposed_case"}
            ]))

    def test_proposed_case_accepts_null_and_closed_fixed_case_dsl(self):
        valid = valid_result(
            findings=[finding(proposed_case=None), finding(proposed_case=proposed_case())],
            coverage_candidates=[
                coverage_candidate(proposed_case=None),
                coverage_candidate(confidence="high", proposed_case=proposed_case()),
            ],
        )

        self.assertIs(report.validate_result(valid), valid)

    def test_proposed_case_accepts_network_assertion_when_capture_step_is_present(self):
        network_case = proposed_case(
            steps=[
                {"begin_network_capture": {}},
                {"click": {"locator": {"by": "role", "role": "button", "name": "Submit"}}},
            ],
            assertions=[
                {"network_request_sent": {"method": "POST", "path": "/api/register", "timeout_ms": 1000}},
            ],
        )
        valid = valid_result(findings=[finding(proposed_case=network_case)])

        self.assertIs(report.validate_result(valid), valid)

    def test_proposed_case_accepts_ui_and_network_assertion_shapes_in_findings_and_coverage(self):
        locator = {"by": "label", "label": "Email"}
        case = proposed_case(
            steps=[{"begin_network_capture": {}}],
            assertions=[
                {"element_visible": {"locator": locator}},
                {"element_hidden": {"locator": {"by": "text", "text": "Loading"}}},
                {"element_enabled": {"locator": {"by": "role", "role": "button", "name": "Continue"}}},
                {"element_disabled": {"locator": {"by": "test_id", "test_id": "submit"}}},
                {"element_value_equals": {"locator": locator, "value": "owner@example.test"}},
                {"element_count_equals": {"locator": {"by": "text", "text": "API key"}, "count": 0}},
                {"network_request_not_sent": {"method": "GET", "path": "/api/register", "timeout_ms": 5000}},
            ],
        )
        payload = valid_result(
            findings=[finding(confidence="high", proposed_case=case)],
            coverage_candidates=[coverage_candidate(confidence="high", proposed_case=case)],
        )

        self.assertIs(report.validate_result(payload), payload)

    def test_proposed_case_rejects_extra_unsafe_network_and_bounds(self):
        invalid_cases = [
            proposed_case(steps=[{"begin_network_capture": {"extra": "bad"}}]),
            proposed_case(steps=[{"begin_network_capture": {}}, {"begin_network_capture": {}}]),
            proposed_case(
                assertions=[{"network_request_sent": {"method": "GET", "path": "/api/register", "timeout_ms": 1000}}]
            ),
            proposed_case(
                steps=[{"begin_network_capture": {}}],
                assertions=[
                    {"network_request_sent": {"method": "OPTIONS", "path": "/api/register", "timeout_ms": 1000}}
                ],
            ),
            proposed_case(
                steps=[{"begin_network_capture": {}}],
                assertions=[
                    {"network_request_sent": {"method": "GET", "path": "https://example.test/api", "timeout_ms": 1000}}
                ],
            ),
            proposed_case(
                steps=[{"begin_network_capture": {}}],
                assertions=[
                    {"network_request_sent": {"method": "GET", "path": "/api/register?token=secret", "timeout_ms": 1000}}
                ],
            ),
            proposed_case(
                steps=[{"begin_network_capture": {}}],
                assertions=[
                    {"network_request_sent": {"method": "GET", "path": "/api/register#token", "timeout_ms": 1000}}
                ],
            ),
            proposed_case(
                steps=[{"begin_network_capture": {}}],
                assertions=[
                    {"network_request_sent": {"method": "GET", "path": "/api/register", "timeout_ms": 5001}}
                ],
            ),
            proposed_case(
                steps=[{"begin_network_capture": {}}],
                assertions=[
                    {"network_request_sent": {"method": "GET", "path": "/api/register", "timeout_ms": -1}}
                ],
            ),
            proposed_case(assertions=[{"element_count_equals": {"locator": {"by": "text", "text": "API key"}, "count": 1001}}]),
            proposed_case(assertions=[{"element_count_equals": {"locator": {"by": "text", "text": "API key"}, "count": -1}}]),
            proposed_case(assertions=[{"element_visible": {"locator": {"by": "text", "text": "Ready"}, "extra": "bad"}}]),
            proposed_case(assertions=[{"element_value_equals": {"locator": {"by": "label", "label": "Email"}}}]),
        ]

        for candidate in invalid_cases:
            with self.subTest(candidate=candidate):
                with self.assertRaises(report.ResultValidationError):
                    report.validate_result(valid_result(findings=[finding(confidence="high", proposed_case=candidate)]))

    def test_proposed_case_rejects_open_or_invalid_fixed_case_fragments(self):
        cases = [
            proposed_case(extra="bad"),
            {k: v for k, v in proposed_case().items() if k != "assertions"},
            proposed_case(steps=[{"click": {"locator": {"by": "css", "value": ".sign-in"}}}]),
            proposed_case(steps=[{"script": {"source": "alert(1)"}}]),
            proposed_case(start={"origin": "docs", "path": "/zh"}),
            proposed_case(start={"origin": "production", "path": "/zh"}),
            proposed_case(cleanup="required"),
        ]

        for candidate in cases:
            with self.subTest(candidate=candidate):
                with self.assertRaises(report.ResultValidationError):
                    report.validate_result(valid_result(findings=[finding(proposed_case=candidate)]))

                with self.assertRaises(report.ResultValidationError):
                    report.validate_result(valid_result(coverage_candidates=[
                        coverage_candidate(confidence="high", proposed_case=candidate)
                    ]))

    def test_proposed_case_requires_high_confidence_and_non_mutating_coverage(self):
        invalid_payloads = [
            valid_result(findings=[finding(severity="info", confidence="high", proposed_case=proposed_case())]),
            valid_result(findings=[finding(confidence="medium", proposed_case=proposed_case())]),
            valid_result(coverage_candidates=[coverage_candidate(confidence="medium", proposed_case=proposed_case())]),
            valid_result(coverage_candidates=[
                coverage_candidate(confidence="high", mutates_state=True, proposed_case=proposed_case())
            ]),
            valid_result(coverage_candidates=[
                coverage_candidate(confidence="high", cleanup_requirement="required", proposed_case=proposed_case())
            ]),
        ]

        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                with self.assertRaises(report.ResultValidationError):
                    report.validate_result(payload)

    def test_sanitize_untrusted_proposed_cases_drops_only_invalid_optional_proposals(self):
        invalid = proposed_case(
            start={
                "origin": "staging_website",
                "path": "/_next/image?url=%2Fassets%2Fhero.png&w=828&q=75",
            },
            steps=[],
            assertions=[{"page_status_not": 400}],
        )
        valid = proposed_case()
        payload = valid_result(
            findings=[finding(proposed_case=invalid)],
            coverage_candidates=[
                coverage_candidate(confidence="high", proposed_case=invalid),
                coverage_candidate(confidence="high", proposed_case=valid),
            ],
        )

        sanitized = report.sanitize_untrusted_proposed_cases(payload)

        self.assertIsNone(sanitized["findings"][0]["proposed_case"])
        self.assertIsNone(sanitized["coverage_candidates"][0]["proposed_case"])
        self.assertEqual(sanitized["coverage_candidates"][1]["proposed_case"], valid)
        self.assertEqual(payload["findings"][0]["proposed_case"], invalid)
        self.assertIs(report.validate_result(sanitized), sanitized)

        unrelated_invalid = valid_result(
            findings=[finding(severity="warning", proposed_case=invalid)],
        )
        still_invalid = report.sanitize_untrusted_proposed_cases(unrelated_invalid)
        with self.assertRaisesRegex(report.ResultValidationError, "findings\\[0\\]\\.severity"):
            report.validate_result(still_invalid)

    def test_sanitize_untrusted_coverage_candidates_drops_only_invalid_optional_items(self):
        invalid = coverage_candidate(evidence_paths=[])
        valid = coverage_candidate()
        payload = valid_result(coverage_candidates=[invalid, valid])

        sanitized = report.sanitize_untrusted_coverage_candidates(payload)

        self.assertEqual(sanitized["coverage_candidates"], [valid])
        self.assertEqual(payload["coverage_candidates"], [invalid, valid])
        self.assertIs(report.validate_result(sanitized), sanitized)

        wrong_container = valid_result(coverage_candidates={"candidate": valid})
        still_invalid = report.sanitize_untrusted_coverage_candidates(wrong_container)
        with self.assertRaisesRegex(report.ResultValidationError, "coverage_candidates must be an array"):
            report.validate_result(still_invalid)

    def test_proposed_case_rejects_secret_material_without_overmatching_labels(self):
        secret_values = [
            "Authorization: Bearer sk-liveSECRET123",
            "Authorization: Basic dXNlcjpwYXNz",
            "password=sk-liveSECRET123",
            "token: hidden-value",
            "api_key = hidden-value",
            "client_secret: hidden-value",
            "cookie=sessionid=hidden-value",
        ]

        for value in secret_values:
            with self.subTest(value=value):
                payload = valid_result(findings=[finding(proposed_case=proposed_case(
                    steps=[{"fill": {"locator": {"by": "label", "label": "Email"}, "value": value}}]
                ))])
                with self.assertRaisesRegex(report.ResultValidationError, "sensitive content"):
                    report.validate_result(payload)

        safe = valid_result(findings=[finding(proposed_case=proposed_case(
            steps=[{"fill": {"locator": {"by": "label", "label": "Password"}, "value": "invalid-password-format"}}]
        ))])
        self.assertIs(report.validate_result(safe), safe)

    def test_schema_validates_coverage_candidates_fixed_cases_and_phase_trace_strictly(self):
        valid = valid_result(
            coverage_candidates=[coverage_candidate()],
            fixed_cases={"status": "passed", "cases": [fixed_case()]},
            phase_trace=["replay_done", "fixed_cases_done", "exploration_started", "finalization_started"],
        )

        self.assertIs(report.validate_result(valid), valid)

        invalid_payloads = [
            valid_result(coverage_candidates=[coverage_candidate(extra="bad")]),
            valid_result(coverage_candidates=[coverage_candidate(confidence="certain")]),
            valid_result(coverage_candidates=[coverage_candidate(mutates_state="false")]),
            valid_result(coverage_candidates=[coverage_candidate(cleanup_requirement="maybe")]),
            valid_result(fixed_cases={"status": "passed", "cases": [fixed_case(secret="bad")]}),
            valid_result(fixed_cases={"status": "not_started", "cases": [fixed_case()]}),
            valid_result(fixed_cases={"status": "failed", "cases": []}),
            valid_result(fixed_cases={"status": "passed", "cases": [fixed_case(status="failed", failure={"phase": "step", "index": 0, "action": "navigate", "code": "step_failed", "evidence": {}})]}),
            valid_result(fixed_cases={"status": "failed", "cases": [fixed_case(status="failed", failure="bad")]}),
            valid_result(fixed_cases={"status": "failed", "cases": [fixed_case(status="failed", failure={"phase": "start", "index": None, "action": "navigate", "code": "navigation_failed", "evidence": {}})]}),
            valid_result(fixed_cases={"status": "failed", "cases": [fixed_case(status="failed", failure={"phase": "step", "index": 0, "code": "step_failed", "evidence": {}})]}),
            valid_result(fixed_cases={"status": "failed", "cases": [fixed_case(status="failed", failure={"phase": "assertion", "index": 0, "code": "assertion_failed", "evidence": {}})]}),
            valid_result(phase_trace=["fixed_cases_done", "replay_done"]),
            valid_result(phase_trace=["replay_done", "replay_done"]),
            valid_result(phase_trace=["replay_done"]),
            valid_result(phase_trace=["replay_done", "fixed_cases_done"]),
            valid_result(phase_trace=["replay_done", "exploration_started", "finalization_started"]),
        ]
        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                with self.assertRaises(report.ResultValidationError):
                    report.validate_result(payload)

    def test_fixed_case_failure_constants_and_phase_trace_sequences_are_exact(self):
        valid_phase_traces = [
            [],
            ["finalization_started"],
            ["exploration_started", "finalization_started"],
            ["replay_done", "finalization_started"],
            ["replay_done", "fixed_cases_done", "finalization_started"],
            ["replay_done", "fixed_cases_done", "exploration_started", "finalization_started"],
        ]
        for phase_trace in valid_phase_traces:
            with self.subTest(phase_trace=phase_trace):
                payload = valid_result(phase_trace=phase_trace)
                self.assertIs(report.validate_result(payload), payload)

        valid_failures = [
            {"phase": "start", "index": None, "code": "navigation_failed", "evidence": {"screenshot_error": "capture_failed"}},
            {"phase": "step", "index": 0, "action": "navigate", "code": "step_failed", "evidence": {"flush_error": "flush_failed"}},
            {"phase": "assertion", "index": 0, "assertion": "page_status_not", "code": "assertion_failed", "evidence": {}},
        ]
        for failure in valid_failures:
            with self.subTest(failure=failure):
                payload = valid_result(fixed_cases={"status": "failed", "cases": [fixed_case(status="failed", failure=failure)]})
                self.assertIs(report.validate_result(payload), payload)

        invalid_failures = [
            {"phase": "start", "index": 0, "code": "navigation_failed", "evidence": {}},
            {"phase": "start", "index": None, "code": "step_failed", "evidence": {}},
            {"phase": "step", "index": None, "action": "navigate", "code": "step_failed", "evidence": {}},
            {"phase": "step", "index": 0, "action": "navigate", "code": "navigation_failed", "evidence": {}},
            {"phase": "assertion", "index": None, "assertion": "page_status_not", "code": "assertion_failed", "evidence": {}},
            {"phase": "assertion", "index": 0, "assertion": "page_status_not", "code": "step_failed", "evidence": {}},
            {"phase": "assertion", "index": 0, "assertion": "page_status_not", "code": "assertion_failed", "evidence": {"screenshot_error": "failed"}},
            {"phase": "assertion", "index": 0, "assertion": "page_status_not", "code": "assertion_failed", "evidence": {"flush_error": "failed"}},
        ]
        for failure in invalid_failures:
            with self.subTest(failure=failure):
                with self.assertRaises(report.ResultValidationError):
                    report.validate_result(valid_result(fixed_cases={"status": "failed", "cases": [fixed_case(status="failed", failure=failure)]}))

    def test_fixed_case_result_paths_match_runner_contract(self):
        valid_failure = {
            "phase": "assertion",
            "index": 0,
            "assertion": "page_status_not",
            "code": "assertion_failed",
            "evidence": {"screenshot": "FQA-0001/run-12345/proof.png"},
        }
        valid_payload = valid_result(
            fixed_cases={"status": "failed", "cases": [fixed_case(status="failed", failure=valid_failure)]}
        )
        self.assertIs(report.validate_result(valid_payload), valid_payload)

        invalid_cases = [
            fixed_case(case_id="-bad"),
            fixed_case(attempt_id="bad id"),
            fixed_case(evidence_dir="FQA-0001/other"),
            fixed_case(status="failed", failure={**valid_failure, "evidence": {"screenshot": "/abs/proof.png"}}),
            fixed_case(status="failed", failure={**valid_failure, "evidence": {"screenshot": "FQA-0001\\run-12345\\proof.png"}}),
            fixed_case(status="failed", failure={**valid_failure, "evidence": {"screenshot": "FQA-0001//proof.png"}}),
            fixed_case(status="failed", failure={**valid_failure, "evidence": {"screenshot": "FQA-0001/./proof.png"}}),
            fixed_case(status="failed", failure={**valid_failure, "evidence": {"screenshot": "FQA-0001/../proof.png"}}),
        ]
        for case in invalid_cases:
            with self.subTest(case=case):
                with self.assertRaises(report.ResultValidationError):
                    report.validate_result(valid_result(fixed_cases={"status": "failed", "cases": [case]}))

    def test_normalize_coverage_candidates_strips_url_and_lowers_unusable_evidence_confidence(self):
        with tempfile.TemporaryDirectory() as tmp:
            screenshot_dir = os.path.join(tmp, "screenshots")
            os.makedirs(screenshot_dir)
            with open(os.path.join(screenshot_dir, "proof.png"), "wb") as handle:
                handle.write(b"\x89PNG\r\n\x1a\nproof")

            normalized = report.normalize_findings(
                valid_result(coverage_candidates=[
                    coverage_candidate(),
                    coverage_candidate(title="missing evidence candidate", evidence_paths=["screenshots/missing.png"]),
                ]),
                runtime_root=tmp,
                proxy_events=[],
            )

            self.assertEqual(len(normalized["coverage_candidates"]), 2)
            self.assertEqual(
                normalized["coverage_candidates"][0]["target_url"],
                "https://staging-console.flatkey.ai/register",
            )
            self.assertEqual(normalized["coverage_candidates"][0]["confidence"], "medium")
            self.assertEqual(normalized["coverage_candidates"][1]["confidence"], "low")
            self.assertEqual(report.classify_status(normalized), "passed")

    def test_fixed_case_failure_classifies_replay_failed_with_existing_priority(self):
        failed_fixed_cases = {"status": "failed", "cases": []}
        self.assertEqual(report.classify_status(valid_result(fixed_cases=failed_fixed_cases)), "replay_failed")
        self.assertEqual(
            report.classify_status(valid_result(fixed_cases=failed_fixed_cases), runtime_classification="codex_nonzero"),
            "infrastructure_failed",
        )
        self.assertEqual(
            report.classify_status(
                valid_result(fixed_cases=failed_fixed_cases),
                cleanup_result=CleanupResult(0, False, False, True, "cleanup failed"),
            ),
            "cleanup_failed",
        )

    def test_cleanup_manifest_uses_trusted_tri_state_status(self):
        self.assertEqual(
            report.build_manifest(
                valid_result(),
                cleanup_result=CleanupResult(0, False, False, False, "not needed"),
                run_id="123456789",
                execution_id="main-001",
                provenance=valid_provenance(),
            )["cleanup"]["cleanup_status"],
            "not_required",
        )
        self.assertEqual(
            report.build_manifest(
                valid_result(),
                cleanup_result=CleanupResult(1, True, True, False, "cleanup verified"),
                run_id="123456789",
                execution_id="main-001",
                provenance=valid_provenance(),
            )["cleanup"]["cleanup_status"],
            "passed",
        )
        self.assertEqual(
            report.build_manifest(
                valid_result(),
                cleanup_result=CleanupResult(0, False, False, True, "cleanup failed"),
                run_id="123456789",
                execution_id="main-001",
                provenance=valid_provenance(),
            )["cleanup"]["cleanup_status"],
            "failed",
        )

    def test_status_priority_ignores_info_findings_and_cleanup_overrides_manifest(self):
        self.assertEqual(report.classify_status(valid_result(findings=[finding(severity="info")])), "passed")
        self.assertEqual(report.classify_status(valid_result(findings=[finding(severity="low")])), "findings_detected")
        self.assertEqual(report.classify_status(valid_result(replay={"status": "failed", "checkpoint_reached": False})), "replay_failed")
        self.assertEqual(report.classify_status(valid_result(), runtime_classification="codex_nonzero"), "infrastructure_failed")

        cleanup = CleanupResult(1, True, True, True, "token cleanup failed")
        manifest = report.build_manifest(
            valid_result(),
            cleanup_result=cleanup,
            provenance=valid_provenance(),
            run_id="123456789",
            execution_id="main-001",
        )

        self.assertEqual(manifest["status"], "cleanup_failed")
        self.assertEqual(manifest["cleanup"]["cleanup_failed"], True)
        self.assertEqual(manifest["cleanup"]["reason"], "token cleanup failed")

    def test_manifest_preserves_deleted_token_count_integer_without_leaking_unsafe_values(self):
        redactor = report.Redactor(extra_secrets=("unsafe-token-count",))
        manifest = report.build_manifest(
            valid_result(),
            cleanup_result=CleanupResult(205, True, True, False, "cleanup verified"),
            provenance=valid_provenance(),
            run_id="123456789",
            execution_id="main-001",
            redactor=redactor,
        )

        self.assertEqual(manifest["cleanup"]["deleted_token_count"], 205)
        self.assertIs(type(manifest["cleanup"]["deleted_token_count"]), int)
        self.assertEqual(
            redactor.clean({"deleted_token_count": "unsafe-token-count"}),
            {"deleted_token_count": "[REDACTED_SECRET]"},
        )
        self.assertEqual(
            redactor.clean({"deleted-token-count": 205}),
            {"deleted-token-count": "[REDACTED_SECRET]"},
        )

    def test_model_result_schema_rejects_infrastructure_and_alias_restriction_self_report(self):
        with self.assertRaises(report.ResultValidationError):
            report.validate_result(valid_result(infrastructure={"status": "failed"}))
        with self.assertRaises(report.ResultValidationError):
            report.validate_result(valid_result(alias_restriction=True))

    def test_writes_strict_redacted_report_and_schema_file_is_loadable(self):
        with tempfile.TemporaryDirectory() as tmp:
            result_path = os.path.join(tmp, "result.json")
            manifest_path = os.path.join(tmp, "manifest.json")
            with open(result_path, "w", encoding="utf-8") as handle:
                json.dump(valid_result(findings=[finding(actual="Authorization: Bearer sk-secretSECRET")]), handle)

            manifest = report.write_report(
                result_path,
                manifest_path,
                cleanup_result=CleanupResult(0, False, False, False, "not needed"),
                redactor=report.Redactor(extra_secrets=("sk-secretSECRET",)),
                run_id="123456789",
                execution_id="main-001",
                provenance=valid_provenance(),
            )

            with open(manifest_path, encoding="utf-8") as handle:
                written = json.load(handle)
            self.assertEqual(written, manifest)
            rendered = json.dumps(written)
            self.assertNotIn("sk-secretSECRET", rendered)
            self.assertEqual(written["status"], "findings_detected")
            self.assertEqual(written["schema_version"], 1)
            self.assertEqual(written["kind"], "main")
            self.assertEqual(written["run_id"], "123456789")
            self.assertEqual(written["execution_id"], "main-001")

    def test_report_manifest_identity_is_explicit_and_validated(self):
        cleanup = CleanupResult(0, False, False, False, "not needed")

        with self.assertRaises(TypeError):
            report.build_manifest(valid_result(), cleanup_result=cleanup)

        for run_id, execution_id in [
            ("", "main-001"),
            ("not-decimal", "main-001"),
            ("123456789", ""),
            ("123456789", "../main"),
            ("123456789", "main/001"),
        ]:
            with self.subTest(run_id=run_id, execution_id=execution_id):
                with self.assertRaises(report.ResultValidationError):
                    report.build_manifest(
                        valid_result(),
                        cleanup_result=cleanup,
                        run_id=run_id,
                        execution_id=execution_id,
                        provenance=valid_provenance(),
                    )

        schema_path = os.path.join(os.path.dirname(__file__), "..", "config", "result.schema.json")
        with open(schema_path, encoding="utf-8") as handle:
            schema = json.load(handle)
        self.assertFalse(schema["additionalProperties"])
        self.assertIn("coverage_candidates", schema["required"])
        self.assertNotIn("fixed_cases", schema["required"])
        self.assertNotIn("phase_trace", schema["required"])
        self.assertNotIn("fixed_cases", schema["properties"])
        self.assertNotIn("phase_trace", schema["properties"])

    def test_model_output_schema_uses_structured_outputs_subset(self):
        schema_path = os.path.join(os.path.dirname(__file__), "..", "config", "result.schema.json")
        with open(schema_path, encoding="utf-8") as handle:
            schema = json.load(handle)

        unsupported = {"allOf", "not", "if", "then", "else", "contains", "oneOf"}
        found = []

        def walk(value, path="$"):
            if isinstance(value, dict):
                for key, child in value.items():
                    if key in unsupported:
                        found.append(f"{path}.{key}")
                    walk(child, f"{path}.{key}")
            elif isinstance(value, list):
                for index, child in enumerate(value):
                    walk(child, f"{path}[{index}]")

        walk(schema)

        self.assertEqual(found, [])
        self.assertIn("coverage_candidates", schema["required"])
        self.assertNotIn("fixed_cases", schema["required"])
        self.assertNotIn("phase_trace", schema["required"])
        self.assertNotIn("fixed_cases", schema["properties"])
        self.assertNotIn("phase_trace", schema["properties"])

    def test_schema_declares_same_non_empty_contract_as_python_validator(self):
        schema_path = os.path.join(os.path.dirname(__file__), "..", "config", "result.schema.json")
        with open(schema_path, encoding="utf-8") as handle:
            schema = json.load(handle)
        finding_schema = schema["properties"]["findings"]["items"]["properties"]
        candidate_schema = schema["properties"]["coverage_candidates"]["items"]["properties"]

        for field in ["title", "target_url", "expected", "actual", "confidence", "severity"]:
            with self.subTest(field=field):
                self.assertEqual(finding_schema[field].get("minLength"), 1)

        for field in ["steps", "evidence_paths"]:
            with self.subTest(field=field):
                self.assertEqual(finding_schema[field].get("minItems"), 1)
                self.assertEqual(finding_schema[field]["items"].get("minLength"), 1)

        self.assertEqual(
            set(candidate_schema),
            {
                "title",
                "target_url",
                "steps",
                "expected",
                "observed",
                "business_value",
                "evidence_paths",
                "confidence",
                "mutates_state",
                "cleanup_requirement",
                "proposed_case",
            },
        )
        self.assertFalse(schema["properties"]["coverage_candidates"]["items"]["additionalProperties"])
        self.assertNotIn("fixed_cases", schema["properties"])
        self.assertNotIn("phase_trace", schema["properties"])

        for bad_payload in [
            valid_result(findings=[finding(title="")]),
            valid_result(findings=[finding(steps=[])]),
            valid_result(findings=[finding(evidence_paths=[""])]),
        ]:
            with self.subTest(payload=bad_payload):
                with self.assertRaises(report.ResultValidationError):
                    report.validate_result(bad_payload)

    def test_model_output_schema_declares_closed_proposed_case_contract(self):
        schema_path = os.path.join(os.path.dirname(__file__), "..", "config", "result.schema.json")
        with open(schema_path, encoding="utf-8") as handle:
            schema = json.load(handle)

        def resolve(value):
            ref = value.get("$ref") if isinstance(value, dict) else None
            if ref and ref.startswith("#/$defs/"):
                return schema["$defs"][ref.removeprefix("#/$defs/")]
            return value

        finding_schema = schema["properties"]["findings"]["items"]
        candidate_schema = schema["properties"]["coverage_candidates"]["items"]
        for item_schema in [finding_schema, candidate_schema]:
            with self.subTest(item_schema=item_schema):
                self.assertIn("proposed_case", item_schema["required"])
                proposed = resolve(item_schema["properties"]["proposed_case"])
                self.assertEqual(proposed["anyOf"][0]["type"], "null")
                case_schema = proposed["anyOf"][1]
                self.assertFalse(case_schema["additionalProperties"])
                self.assertEqual(set(case_schema["required"]), {"fixture", "start", "steps", "assertions", "cleanup"})
                self.assertEqual(set(case_schema["properties"]), {"fixture", "start", "steps", "assertions", "cleanup"})
                self.assertEqual(case_schema["properties"]["start"]["properties"]["origin"]["enum"], [
                    "staging_website",
                    "staging_console",
                ])
                self.assertEqual(case_schema["properties"]["cleanup"]["enum"], ["not_required"])
                step_branches = case_schema["properties"]["steps"]["items"]["anyOf"]
                step_keys = {tuple(branch["required"])[0] for branch in step_branches}
                self.assertEqual(
                    step_keys,
                    {"navigate", "navigate_back", "click", "fill", "select", "wait_for", "begin_network_capture"},
                )
                assertion_branches = case_schema["properties"]["assertions"]["items"]["anyOf"]
                assertion_keys = {tuple(branch["required"])[0] for branch in assertion_branches}
                self.assertEqual(
                    assertion_keys,
                    {
                        "page_status_not",
                        "url_not_contains",
                        "element_visible",
                        "element_hidden",
                        "element_enabled",
                        "element_disabled",
                        "element_value_equals",
                        "element_count_equals",
                        "network_request_sent",
                        "network_request_not_sent",
                    },
                )
                network_branch = next(
                    branch for branch in assertion_branches if branch["required"] == ["network_request_sent"]
                )
                network_props = network_branch["properties"]["network_request_sent"]["properties"]
                self.assertEqual(network_props["method"]["enum"], ["GET", "POST", "PUT", "PATCH", "DELETE"])
                self.assertEqual(network_props["timeout_ms"]["minimum"], 0)
                self.assertEqual(network_props["timeout_ms"]["maximum"], 5000)
                self.assertNotIn("headers", network_props)
                count_branch = next(
                    branch for branch in assertion_branches if branch["required"] == ["element_count_equals"]
                )
                count_props = count_branch["properties"]["element_count_equals"]["properties"]
                self.assertEqual(count_props["count"]["minimum"], 0)
                self.assertEqual(count_props["count"]["maximum"], 1000)

        def assert_closed_objects(value):
            if isinstance(value, dict):
                if value.get("type") == "object":
                    self.assertFalse(value.get("additionalProperties"), value)
                    self.assertEqual(set(value.get("properties", {})), set(value.get("required", [])), value)
                for child in value.values():
                    assert_closed_objects(child)
            elif isinstance(value, list):
                for child in value:
                    assert_closed_objects(child)

        assert_closed_objects(schema)

    def test_main_manifest_requires_strict_runtime_provenance(self):
        cleanup = CleanupResult(0, False, False, False, "not needed")
        manifest = report.build_manifest(
            valid_result(),
            cleanup_result=cleanup,
            run_id="123456789",
            execution_id="main-001",
            provenance=valid_provenance(),
        )

        self.assertEqual(manifest["provenance"], valid_provenance())

        with self.assertRaises(TypeError):
            report.build_manifest(
                valid_result(),
                cleanup_result=cleanup,
                run_id="123456789",
                execution_id="main-001",
                model_manifest=valid_provenance(),
            )

        malformed_cases = [
            None,
            {**valid_provenance(), "extra": "bad"},
            {k: v for k, v in valid_provenance().items() if k != "skill_content_sha256"},
            valid_provenance(skill_content_sha256="A" * 64),
            valid_provenance(skill_content_sha256="a" * 63),
            valid_provenance(model_config={"model": "gpt-5.4", "sandbox": "workspace-write"}),
            valid_provenance(model_config={"model": "gpt-5.4", "sandbox": "workspace-write", "network_access": True}),
            valid_provenance(codex_version=""),
            valid_provenance(playwright_mcp_version="bad\nversion"),
            valid_provenance(playwright_package_version=""),
            valid_provenance(chromium_version=""),
        ]
        for provenance in malformed_cases:
            with self.subTest(provenance=provenance):
                with self.assertRaises(report.ResultValidationError):
                    report.build_manifest(
                        valid_result(),
                        cleanup_result=cleanup,
                        run_id="123456789",
                        execution_id="main-001",
                        provenance=provenance,
                    )


if __name__ == "__main__":
    unittest.main()
