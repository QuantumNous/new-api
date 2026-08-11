import base64
import copy
import json
import unittest

from scripts.browser_qa.flatkey_browser_qa import candidate_job
from scripts.browser_qa.flatkey_browser_qa import promotion


ALLOWED = {"https://staging-console.flatkey.ai", "https://staging.flatkey.ai"}


def proposed_case(**overrides):
    payload = {
        "fixture": "anonymous",
        "start": {"origin": "staging_website", "path": "/zh"},
        "steps": [
            {"navigate": {"path": "/zh/sign-in"}},
            {"click": {"locator": {"by": "role", "role": "link", "name": "Sign in"}}},
        ],
        "assertions": [
            {"page_status_not": 404},
            {"url_not_contains": "/404"},
        ],
        "cleanup": "not_required",
    }
    payload.update(overrides)
    return payload


def proposed_case_with_assertion(assertion):
    return proposed_case(
        steps=[{"navigate": {"path": "/zh/sign-in"}}],
        assertions=[assertion],
    )


def proposed_case_with_network_assertion(assertion):
    return proposed_case(
        steps=[
            {"navigate": {"path": "/zh/sign-in"}},
            {"begin_network_capture": {}},
            {"click": {"locator": {"by": "role", "role": "button", "name": "Open"}}},
        ],
        assertions=[assertion],
    )


def rich_proposed_case():
    return proposed_case(
        start={"origin": "staging_console", "path": "/register"},
        steps=[
            {"navigate": {"path": "/register"}},
            {"begin_network_capture": {}},
            {"click": {"locator": {"by": "role", "role": "button", "name": "Open dialog"}}},
        ],
        assertions=[
            {"element_visible": {"locator": {"by": "role", "role": "dialog", "name": "Create key"}}},
            {"element_hidden": {"locator": {"by": "text", "text": "Loading"}}},
            {"element_enabled": {"locator": {"by": "role", "role": "button", "name": "Cancel"}}},
            {"element_disabled": {"locator": {"by": "test_id", "test_id": "submit"}}},
            {"element_value_equals": {"locator": {"by": "label", "label": "Name"}, "value": "Demo"}},
            {"element_count_equals": {"locator": {"by": "text", "text": "API key"}, "count": 1}},
            {"network_request_sent": {"method": "GET", "path": "/api/dialog", "timeout_ms": 500}},
            {"network_request_not_sent": {"method": "POST", "path": "/api/keys", "timeout_ms": 0}},
        ],
    )


def candidate_env():
    return {
        "BROWSER_QA_ATTEMPT_ID": "attempt-0001",
        "FLATKEY_QA_RUN_ID": "123456789",
        "FLATKEY_BROWSER_QA_GCS_BUCKET": "flatkey-browser-qa-private",
        "FLATKEY_QA_WEBSITE_ORIGIN": "https://staging-website.flatkey.ai",
        "FLATKEY_QA_CONSOLE_ORIGIN": "https://staging-console.flatkey.ai",
    }


def finding(**overrides):
    payload = {
        "severity": "medium",
        "title": "secret prose must not survive promotion",
        "target_url": "https://staging-console.flatkey.ai/register?token=secret#frag",
        "steps": ["ignored prose"],
        "expected": "ignored",
        "actual": "ignored",
        "evidence_paths": ["screenshots/proof.png"],
        "confidence": "high",
        "proposed_case": proposed_case(),
    }
    payload.update(overrides)
    return payload


def coverage(**overrides):
    payload = {
        "title": "ignored coverage prose",
        "target_url": "https://staging-console.flatkey.ai/register?token=secret#frag",
        "steps": ["ignored prose"],
        "expected": "ignored",
        "observed": "ignored",
        "business_value": "ignored",
        "evidence_paths": ["screenshots/proof.png"],
        "confidence": "high",
        "mutates_state": False,
        "cleanup_requirement": "not_required",
        "proposed_case": proposed_case(),
    }
    payload.update(overrides)
    return payload


def passed_result(attempt_id="attempt-1", evidence_dir="FQA-0001/attempt-1", *, case_id="FQA-0001"):
    return {
        "attempt_id": attempt_id,
        "evidence_dir": evidence_dir,
        "result": {
            "status": "passed",
            "case_id": case_id,
            "attempt_id": attempt_id,
            "evidence_dir": evidence_dir,
            "steps": [
                {"index": 0, "action": "navigate", "status": "passed"},
                {"index": 1, "action": "click", "status": "passed"},
            ],
            "assertions": [{"index": 0, "assertion": "page_status_not", "status": "passed"}],
            "failure": None,
        },
        "cleanup": {"status": "passed"},
        "runtime": {"classification": None},
    }


def failed_result(attempt_id="attempt-1", evidence_dir="FQA-0001/attempt-1", *, assertion="page_status_not"):
    result = passed_result(attempt_id, evidence_dir)
    result["result"] = {
        "status": "failed",
        "case_id": "FQA-0001",
        "attempt_id": attempt_id,
        "evidence_dir": evidence_dir,
        "steps": [
            {"index": 0, "action": "navigate", "status": "passed"},
            {"index": 1, "action": "click", "status": "passed"},
        ],
        "assertions": [],
        "failure": {
            "phase": "assertion",
            "index": 0,
            "assertion": assertion,
            "code": "assertion_failed",
            "evidence": {"screenshot": "screenshots/failure.png", "console": [{"run": attempt_id}]},
        },
    }
    return result


def attempts(factory):
    return [factory(f"attempt-{index}", f"FQA-0001/attempt-{index}") for index in range(1, 4)]


class PromotionFingerprintTests(unittest.TestCase):
    def test_canonical_fingerprint_ignores_key_order_query_fragment_and_run_evidence(self):
        base = proposed_case()
        reordered = {
            "cleanup": "not_required",
            "assertions": copy.deepcopy(base["assertions"]),
            "steps": copy.deepcopy(base["steps"]),
            "start": {"path": "/zh", "origin": "staging_website"},
            "fixture": "anonymous",
            "title": "ignored title",
            "source": {"run_id": "1", "evidence_uri": "gs://bucket/run-1"},
        }

        first = promotion.canonical_fingerprint("finding", "https://staging-console.flatkey.ai/register?a=1#one", base)
        second = promotion.canonical_fingerprint("finding", "https://staging-console.flatkey.ai/register?b=2#two", reordered)

        self.assertRegex(first, r"^sha256:[0-9a-f]{64}$")
        self.assertEqual(first, second)

    def test_canonical_fingerprint_changes_for_path_steps_and_assertions(self):
        base = proposed_case()
        changed_step = proposed_case(steps=[{"navigate": {"path": "/zh/other"}}])
        changed_assertion = proposed_case(assertions=[{"url_not_contains": "/500"}])

        original = promotion.canonical_fingerprint("coverage", "https://staging-console.flatkey.ai/register", base)

        self.assertNotEqual(
            original,
            promotion.canonical_fingerprint("coverage", "https://staging-console.flatkey.ai/settings", base),
        )
        self.assertNotEqual(
            original,
            promotion.canonical_fingerprint("coverage", "https://staging-console.flatkey.ai/register", changed_step),
        )
        self.assertNotEqual(
            original,
            promotion.canonical_fingerprint("coverage", "https://staging-console.flatkey.ai/register", changed_assertion),
        )

    def test_canonical_fingerprint_changes_for_ui_and_network_assertion_semantics(self):
        cases = [
            (
                "ui locator",
                proposed_case_with_assertion({"element_disabled": {"locator": {"by": "test_id", "test_id": "submit"}}}),
                proposed_case_with_assertion({"element_disabled": {"locator": {"by": "test_id", "test_id": "confirm"}}}),
            ),
            (
                "ui value",
                proposed_case_with_assertion({"element_value_equals": {"locator": {"by": "label", "label": "Name"}, "value": "Draft"}}),
                proposed_case_with_assertion({"element_value_equals": {"locator": {"by": "label", "label": "Name"}, "value": "Final"}}),
            ),
            (
                "ui count",
                proposed_case_with_assertion({"element_count_equals": {"locator": {"by": "text", "text": "API key"}, "count": 1}}),
                proposed_case_with_assertion({"element_count_equals": {"locator": {"by": "text", "text": "API key"}, "count": 2}}),
            ),
            (
                "network method",
                proposed_case_with_network_assertion({"network_request_sent": {"method": "GET", "path": "/api/dialog", "timeout_ms": 100}}),
                proposed_case_with_network_assertion({"network_request_sent": {"method": "POST", "path": "/api/dialog", "timeout_ms": 100}}),
            ),
            (
                "network path",
                proposed_case_with_network_assertion({"network_request_sent": {"method": "GET", "path": "/api/dialog", "timeout_ms": 100}}),
                proposed_case_with_network_assertion({"network_request_sent": {"method": "GET", "path": "/api/keys", "timeout_ms": 100}}),
            ),
            (
                "network timeout",
                proposed_case_with_network_assertion({"network_request_not_sent": {"method": "POST", "path": "/api/keys", "timeout_ms": 0}}),
                proposed_case_with_network_assertion({"network_request_not_sent": {"method": "POST", "path": "/api/keys", "timeout_ms": 5000}}),
            ),
        ]

        for name, first_case, second_case in cases:
            with self.subTest(name=name):
                first = promotion.canonical_fingerprint(
                    "coverage",
                    "https://staging-console.flatkey.ai/register",
                    first_case,
                )
                second = promotion.canonical_fingerprint(
                    "coverage",
                    "https://staging-console.flatkey.ai/register",
                    second_case,
                )

                self.assertNotEqual(first, second)

    def test_canonical_fingerprint_rejects_bad_kind_and_unsafe_target(self):
        for kind, url in [
            ("bad", "https://staging-console.flatkey.ai/register"),
            ("finding", "http://staging-console.flatkey.ai/register"),
            ("finding", "https://user:pass@staging-console.flatkey.ai/register"),
            ("finding", "https://staging-console.flatkey.ai"),
            ("finding", "https://./x"),
            ("finding", "https://[::1]/x"),
        ]:
            with self.subTest(kind=kind, url=url):
                with self.assertRaises(ValueError) as caught:
                    promotion.canonical_fingerprint(kind, url, proposed_case())
                self.assertNotIn(url, str(caught.exception))

    def test_canonical_fingerprint_rejects_reserved_or_malformed_percent_paths(self):
        for url in [
            "https://staging-console.flatkey.ai/a%2Fb",
            "https://staging-console.flatkey.ai/a/%2F/b",
            "https://staging-console.flatkey.ai/%2e%2e/admin",
            "https://staging-console.flatkey.ai/%",
            "https://staging-console.flatkey.ai/%5c/admin",
            "https://staging-console.flatkey.ai/%0A/admin",
            "https://staging-console.flatkey.ai/%7F/admin",
            "https://staging-console.flatkey.ai/%C0%AF/admin",
            "https://staging-console.flatkey.ai/%E0%80%AF/admin",
            "https://staging-console.flatkey.ai/%E2%80%8D/admin",
            "https://staging-console.flatkey.ai/%EE%80%80/admin",
        ]:
            with self.subTest(url=url):
                with self.assertRaises(ValueError) as caught:
                    promotion.canonical_fingerprint("finding", url, proposed_case())
                self.assertNotIn(url, str(caught.exception))

    def test_canonical_fingerprint_preserves_safe_percent_path_semantics(self):
        lower = promotion.canonical_fingerprint(
            "finding",
            "https://staging-console.flatkey.ai/safe/%e4%b8%ad%20space",
            proposed_case(),
        )
        upper = promotion.canonical_fingerprint(
            "finding",
            "https://staging-console.flatkey.ai/safe/%E4%B8%AD%20space",
            proposed_case(),
        )
        literal_space = promotion.canonical_fingerprint(
            "finding",
            "https://staging-console.flatkey.ai/safe/%E4%B8%AD space",
            proposed_case(),
        )
        utf8_lower = promotion.canonical_fingerprint(
            "finding",
            "https://staging-console.flatkey.ai/safe/%e4%bd%a0%20there",
            proposed_case(),
        )
        utf8_upper = promotion.canonical_fingerprint(
            "finding",
            "https://staging-console.flatkey.ai/safe/%E4%BD%A0%20there",
            proposed_case(),
        )

        self.assertEqual(lower, upper)
        self.assertEqual(upper, literal_space)
        self.assertEqual(utf8_lower, utf8_upper)


class PromotionQualificationTests(unittest.TestCase):
    def test_qualify_finding_returns_closed_copy_and_does_not_mutate_input(self):
        original = finding()
        snapshot = copy.deepcopy(original)

        qualified = promotion.qualify_candidate(
            "finding",
            original,
            allowed_origins=ALLOWED,
            existing_fingerprints=set(),
        )

        self.assertEqual(original, snapshot)
        self.assertEqual(
            set(qualified),
            {"kind", "fingerprint", "target_url", "proposed_case"},
        )
        self.assertEqual(qualified["kind"], "finding")
        self.assertEqual(qualified["target_url"], "https://staging-console.flatkey.ai/register")
        self.assertNotIn("title", qualified)
        self.assertIsNot(qualified["proposed_case"], original["proposed_case"])
        original["proposed_case"]["steps"][0]["navigate"]["path"] = "/mutated"
        self.assertEqual(qualified["proposed_case"]["steps"][0]["navigate"]["path"], "/zh/sign-in")

    def test_qualify_coverage_happy_path_and_duplicate_dict_values(self):
        first = promotion.qualify_candidate("coverage", coverage(), allowed_origins=ALLOWED, existing_fingerprints={})
        duplicate = promotion.qualify_candidate(
            "coverage",
            coverage(),
            allowed_origins=ALLOWED,
            existing_fingerprints={"FQA-0001": first["fingerprint"]},
        )

        self.assertEqual(first["kind"], "coverage")
        self.assertIsNone(duplicate)

    def test_qualify_rejects_ineligible_and_unsafe_candidates(self):
        cases = [
            ("finding", finding(proposed_case=None)),
            ("finding", finding(confidence="medium")),
            ("finding", finding(severity="info")),
            ("finding", finding(severity="bogus")),
            ("finding", {key: value for key, value in finding().items() if key != "severity"}),
            ("finding", finding(target_url="https://production.flatkey.ai/register")),
            ("coverage", coverage(mutates_state=True)),
            ("coverage", coverage(cleanup_requirement="required")),
            ("coverage", coverage(proposed_case={**proposed_case(), "cleanup": "required"})),
            ("coverage", coverage(proposed_case={**proposed_case(), "steps": [{"fill": {"locator": {"by": "label", "label": "API key"}, "value": "token=unsafe"}}]})),
        ]
        for kind, item in cases:
            with self.subTest(kind=kind, target=item.get("target_url")):
                self.assertIsNone(
                    promotion.qualify_candidate(
                        kind,
                        item,
                        allowed_origins=ALLOWED,
                        existing_fingerprints=set(),
                    )
                )

    def test_qualify_rejects_malformed_allowed_origins_without_raw_echo_or_mutation(self):
        original = finding(target_url="https://staging-console.flatkey.ai/register")
        snapshot = copy.deepcopy(original)
        malformed_allowed = [
            {"https://:443"},
            {"https://./"},
            {"https://[::1]"},
            {"https://staging-console.flatkey.ai", "https://:443/"},
        ]

        for allowed in malformed_allowed:
            with self.subTest(allowed=allowed):
                self.assertIsNone(
                    promotion.qualify_candidate(
                        "finding",
                        original,
                        allowed_origins=allowed,
                        existing_fingerprints=set(),
                    )
                )
                self.assertEqual(original, snapshot)


class PromotionAggregateTests(unittest.TestCase):
    def test_coverage_three_independent_passes_ready_for_review(self):
        summary = promotion.aggregate_attempts("coverage", "candidate_draft", attempts(passed_result))

        self.assertEqual(summary["state"], "ready_for_review")
        self.assertEqual(summary["decision"], "ready_for_review")
        self.assertEqual(summary["attempts_counted"], 3)
        self.assertEqual(summary["attempts_passed"], 3)
        self.assertEqual(summary["attempts_failed"], 0)
        self.assertIsNone(summary["failure_signature"])

    def test_finding_three_same_failures_awaits_product_fix(self):
        summary = promotion.aggregate_attempts("finding", "candidate_draft", attempts(failed_result))

        self.assertEqual(summary["state"], "awaiting_product_fix")
        self.assertEqual(summary["decision"], "awaiting_product_fix")
        self.assertEqual(summary["attempts_counted"], 3)
        self.assertEqual(summary["attempts_failed"], 3)
        self.assertEqual(
            summary["failure_signature"],
            {"phase": "assertion", "index": 0, "code": "assertion_failed", "assertion": "page_status_not"},
        )

    def test_finding_awaiting_product_fix_three_passes_ready_for_review(self):
        summary = promotion.aggregate_attempts("finding", "awaiting_product_fix", attempts(passed_result))

        self.assertEqual(summary["state"], "ready_for_review")
        self.assertEqual(summary["decision"], "ready_for_review")
        self.assertEqual(summary["attempts_passed"], 3)

    def test_infrastructure_classification_is_not_counted_or_advanced(self):
        attempt = passed_result()
        attempt["runtime"]["classification"] = "browser_crashed"

        summary = promotion.aggregate_attempts("coverage", "candidate_draft", [attempt])

        self.assertEqual(summary["state"], "candidate_draft")
        self.assertEqual(summary["decision"], "incomplete")
        self.assertEqual(summary["attempts_counted"], 0)
        self.assertEqual(summary["reason"], "infrastructure")

    def test_cleanup_failed_blocks_immediately(self):
        attempt = failed_result()
        attempt["cleanup"]["status"] = "failed"

        summary = promotion.aggregate_attempts("finding", "candidate_draft", [attempt])

        self.assertEqual(summary["state"], "blocked")
        self.assertEqual(summary["decision"], "blocked")
        self.assertEqual(summary["reason"], "cleanup_failed")
        self.assertEqual(summary["attempts_counted"], 0)

    def test_mixed_and_mismatched_business_results_are_flaky(self):
        mixed = promotion.aggregate_attempts(
            "coverage",
            "candidate_draft",
            [passed_result("attempt-1", "FQA-0001/attempt-1"), failed_result("attempt-2", "FQA-0001/attempt-2")],
        )
        mismatched = promotion.aggregate_attempts(
            "finding",
            "candidate_draft",
            [
                failed_result("attempt-1", "FQA-0001/attempt-1", assertion="page_status_not"),
                failed_result("attempt-2", "FQA-0001/attempt-2", assertion="url_not_contains"),
            ],
        )

        self.assertEqual(mixed["state"], "flaky")
        self.assertEqual(mixed["reason"], "mixed_results")
        self.assertEqual(mismatched["state"], "flaky")
        self.assertEqual(mismatched["reason"], "mismatched_failure_signature")

    def test_incomplete_and_duplicate_or_bad_attempts_fail_closed_without_mutation(self):
        original = [passed_result()]
        snapshot = copy.deepcopy(original)
        pending = promotion.aggregate_attempts("coverage", "candidate_draft", original)
        self.assertEqual(original, snapshot)
        self.assertEqual(pending["state"], "candidate_draft")
        self.assertEqual(pending["decision"], "incomplete")
        self.assertEqual(pending["attempts_counted"], 1)

        with self.assertRaises(ValueError):
            promotion.aggregate_attempts("coverage", "candidate_draft", [passed_result(), passed_result()])
        with self.assertRaises(ValueError):
            promotion.aggregate_attempts("coverage", "candidate_draft", attempts(passed_result) + [passed_result("attempt-4", "FQA-0001/attempt-4")])
        with self.assertRaises(ValueError):
            promotion.aggregate_attempts("coverage", "candidate_draft", [{"attempt_id": "../bad", "evidence_dir": "ok", "result": {}, "cleanup": {"status": "passed"}, "runtime": {"classification": None}}])

    def test_malformed_partial_and_identity_mismatched_results_reject(self):
        malformed = passed_result()
        malformed["result"]["status"] = "unknown"
        partial = passed_result()
        del partial["result"]["assertions"]
        top_mismatch = passed_result()
        top_mismatch["result"]["attempt_id"] = "attempt-2"
        evidence_mismatch = passed_result()
        evidence_mismatch["result"]["evidence_dir"] = "FQA-0001/other-attempt"
        result_binding_mismatch = passed_result()
        result_binding_mismatch["result"]["case_id"] = "FQA-0002"
        result_binding_mismatch["result"]["evidence_dir"] = "FQA-0002/attempt-1"
        bad_case_id = passed_result(case_id="not-fqa")

        for bad in [malformed, partial, top_mismatch, evidence_mismatch, result_binding_mismatch, bad_case_id]:
            with self.subTest(result=bad["result"]):
                with self.assertRaises(ValueError):
                    promotion.aggregate_attempts("coverage", "candidate_draft", [bad])

    def test_cross_case_batch_rejects_instead_of_counting_ready(self):
        batch = [
            passed_result("attempt-1", "FQA-0001/attempt-1", case_id="FQA-0001"),
            passed_result("attempt-2", "FQA-0002/attempt-2", case_id="FQA-0002"),
            passed_result("attempt-3", "FQA-0003/attempt-3", case_id="FQA-0003"),
        ]

        with self.assertRaises(ValueError):
            promotion.aggregate_attempts("coverage", "candidate_draft", batch)

    def test_extreme_or_nonconsecutive_result_indices_reject_instead_of_ready(self):
        extreme_step = attempts(passed_result)
        extreme_step[0]["result"]["steps"][0]["index"] = 999999
        gap_step = attempts(passed_result)
        gap_step[0]["result"]["steps"][1]["index"] = 3
        extreme_assertion = attempts(passed_result)
        extreme_assertion[0]["result"]["assertions"][0]["index"] = 999999

        for bad in [extreme_step, gap_step, extreme_assertion]:
            with self.subTest(batch=bad):
                with self.assertRaises(ValueError):
                    promotion.aggregate_attempts("coverage", "candidate_draft", bad)


class PromotionBundleAndNamingTests(unittest.TestCase):
    def test_bundle_is_closed_sanitized_and_rejects_bad_source(self):
        qualified = promotion.qualify_candidate("finding", finding(), allowed_origins=ALLOWED, existing_fingerprints=set())
        bundle = promotion.build_candidate_bundle(
            qualified,
            run_id="123456789",
            evidence_uri="gs://flatkey-browser-qa-private/runs/123456789/main/main-001",
        )

        self.assertEqual(
            set(bundle),
            {"schema_version", "kind", "fingerprint", "target_url", "proposed_case", "source", "promotion"},
        )
        self.assertEqual(bundle["schema_version"], 1)
        self.assertEqual(bundle["source"], {
            "run_id": "123456789",
            "evidence_uri": "gs://flatkey-browser-qa-private/runs/123456789/main/main-001",
        })
        self.assertEqual(bundle["promotion"], {
            "state": "candidate_draft",
            "attempts_required": 3,
            "attempts_passed": 0,
        })
        self.assertNotIn("secret", repr(bundle).lower())
        qualified["proposed_case"]["steps"][0]["navigate"]["path"] = "/mutated"
        self.assertEqual(bundle["proposed_case"]["steps"][0]["navigate"]["path"], "/zh/sign-in")

        for run_id, evidence_uri in [
            ("12A", "gs://flatkey-browser-qa-private/runs/123"),
            ("123", "https://example.test/runs/123"),
            ("123", "gs://flatkey-browser-qa-private/runs/123?token=secret"),
            ("123", "gs://bucket/../escape"),
        ]:
            with self.subTest(run_id=run_id, evidence_uri=evidence_uri):
                with self.assertRaises(ValueError):
                    promotion.build_candidate_bundle(qualified, run_id=run_id, evidence_uri=evidence_uri)

    def test_candidate_bundle_roundtrip_preserves_capture_ui_and_network_assertions_without_runtime_evidence(self):
        proposed = rich_proposed_case()
        qualified = promotion.qualify_candidate(
            "coverage",
            coverage(target_url="https://staging-console.flatkey.ai/register", proposed_case=proposed),
            allowed_origins=ALLOWED,
            existing_fingerprints=set(),
        )
        bundle = promotion.build_candidate_bundle(
            qualified,
            run_id="123456789",
            evidence_uri="gs://flatkey-browser-qa-private/runs/123456789/main/main-001",
        )
        case_id = promotion.deterministic_case_id(bundle["fingerprint"], {})
        config = candidate_job.validate_candidate_config(candidate_env())
        materialized = candidate_job._materialize_candidate_case(
            kind=bundle["kind"],
            proposed_case=bundle["proposed_case"],
            fingerprint=bundle["fingerprint"],
            case_id=case_id,
            config=config,
        )
        payload = {
            "schema_version": 1,
            "kind": bundle["kind"],
            "target_url": bundle["target_url"],
            "proposed_case": bundle["proposed_case"],
            "fingerprint": bundle["fingerprint"],
            "case_id": case_id,
            "case": materialized,
        }
        encoded = base64.urlsafe_b64encode(
            json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        ).decode("ascii").rstrip("=")
        parsed = candidate_job.parse_candidate_payload({**candidate_env(), "BROWSER_QA_CANDIDATE_B64": encoded})

        self.assertEqual(bundle["proposed_case"]["steps"], proposed["steps"])
        self.assertEqual(bundle["proposed_case"]["assertions"], proposed["assertions"])
        self.assertEqual(materialized["steps"], proposed["steps"])
        self.assertEqual(materialized["assertions"], proposed["assertions"])
        self.assertEqual(parsed["proposed_case"]["steps"], proposed["steps"])
        self.assertEqual(parsed["proposed_case"]["assertions"], proposed["assertions"])
        self.assertNotIn("runtime", bundle)
        self.assertNotIn("runtime", materialized)
        self.assertNotIn("runtime", parsed)

    def test_bundle_rejects_forged_fingerprint_and_ambiguous_gcs_paths(self):
        qualified = promotion.qualify_candidate("finding", finding(), allowed_origins=ALLOWED, existing_fingerprints=set())
        forged = {**qualified, "fingerprint": "sha256:" + "0" * 64}

        with self.assertRaises(ValueError):
            promotion.build_candidate_bundle(
                forged,
                run_id="123456789",
                evidence_uri="gs://flatkey-browser-qa-private/runs/123456789/main/main-001",
            )

        for evidence_uri in [
            "gs://flatkey-browser-qa-private/runs/123?token=secret",
            "gs://flatkey-browser-qa-private/runs/123#frag",
            "gs://flatkey-browser-qa-private/runs\\123",
            "gs://flatkey-browser-qa-private//runs/123",
            "gs://flatkey-browser-qa-private/runs/123/",
            "gs://flatkey-browser-qa-private/runs//123",
            "gs://bucket/../escape",
            "gs://bucket/./escape",
            "gs://user@bucket/runs/123",
            "gs://bucket/runs/has\u0001control",
        ]:
            with self.subTest(evidence_uri=evidence_uri):
                with self.assertRaises(ValueError):
                    promotion.build_candidate_bundle(qualified, run_id="123", evidence_uri=evidence_uri)

        for evidence_uri in [
            "gs://bucket/runs/999/main/main-001",
            "gs://bucket/runs/123",
            "gs://bucket/not-runs/123/main",
        ]:
            with self.subTest(evidence_uri=evidence_uri):
                with self.assertRaises(ValueError) as caught:
                    promotion.build_candidate_bundle(qualified, run_id="123", evidence_uri=evidence_uri)
                self.assertNotIn("999", str(caught.exception))
                self.assertNotIn("secret", str(caught.exception).lower())

    def test_deterministic_case_id_is_idempotent_and_extends_collisions(self):
        one = "sha256:" + "0" * 63 + "1"
        two = "sha256:" + "0" * 62 + "10"
        one_decimal = str(int("0" * 63 + "1", 16)).zfill(78)
        two_decimal = str(int("0" * 62 + "10", 16)).zfill(78)
        occupied = {"FQA-" + one_decimal[:12]: one}

        self.assertEqual(promotion.deterministic_case_id(one, occupied), "FQA-" + one_decimal[:12])
        self.assertEqual(promotion.deterministic_case_id(two, occupied), "FQA-" + two_decimal[:13])
        with self.assertRaises(ValueError):
            promotion.deterministic_case_id(two, {"FQA-" + two_decimal[:length]: "sha256:" + "f" * 64 for length in range(12, len(two_decimal) + 1)})

    def test_deterministic_case_id_uses_twelve_digits_and_rejects_full_collision(self):
        fingerprint = "sha256:" + "f" * 64
        case_id = promotion.deterministic_case_id(fingerprint, {})
        decimal = str(int("f" * 64, 16)).zfill(78)
        full_occupied = {
            "FQA-" + decimal[:length]: "sha256:" + "0" * 64
            for length in range(12, len(decimal) + 1)
        }

        self.assertEqual(case_id, "FQA-" + decimal[:12])
        self.assertRegex(case_id, r"^FQA-[0-9]{12}$")
        self.assertEqual(promotion.deterministic_case_id(fingerprint, {case_id: fingerprint}), case_id)
        with self.assertRaises(ValueError):
            promotion.deterministic_case_id(fingerprint, full_occupied)

    def test_deterministic_case_id_rejects_present_occupied_keys_with_bad_values(self):
        fingerprint = "sha256:" + "0" * 63 + "1"
        decimal = str(int("0" * 63 + "1", 16)).zfill(78)
        case_id = "FQA-" + decimal[:12]
        bad_maps = [
            {case_id: None},
            {case_id: ""},
            {case_id: "bad"},
            {"bad": fingerprint},
            {"FQA-12345678901": fingerprint},
            {"FQA-" + "1" * 79: fingerprint},
        ]

        for occupied in bad_maps:
            with self.subTest(occupied=occupied):
                with self.assertRaises(ValueError):
                    promotion.deterministic_case_id(fingerprint, occupied)

    def test_extended_case_id_still_builds_safe_branch(self):
        fingerprint = "sha256:" + "f" * 64
        decimal = str(int("f" * 64, 16)).zfill(78)
        occupied = {
            "FQA-" + decimal[:length]: "sha256:" + "0" * 64
            for length in range(12, 77)
        }
        case_id = promotion.deterministic_case_id(fingerprint, occupied)
        branch = promotion.candidate_branch(case_id, fingerprint)
        longest_case_id = "FQA-" + decimal
        longest_branch = promotion.candidate_branch(longest_case_id, fingerprint)

        self.assertEqual(case_id, "FQA-" + decimal[:77])
        self.assertLessEqual(len(longest_branch), 160)
        self.assertRegex(branch, r"^[a-z0-9][a-z0-9._/-]*[a-z0-9]$")
        self.assertNotIn("//", branch)
        self.assertNotIn("..", branch)
        self.assertFalse(branch.endswith(".lock"))

    def test_candidate_branch_is_stable_safe_and_validates_inputs(self):
        fingerprint = "sha256:" + "a" * 64
        branch = promotion.candidate_branch("FQA-123456789012", fingerprint)

        self.assertEqual(branch, "browser-qa/candidates/fqa-123456789012-aaaaaaaaaaaa")
        self.assertLessEqual(len(branch), 80)
        self.assertRegex(branch, r"^[a-z0-9][a-z0-9._/-]*[a-z0-9]$")
        with self.assertRaises(ValueError):
            promotion.candidate_branch("../bad", fingerprint)
        with self.assertRaises(ValueError):
            promotion.candidate_branch("FQA-1234", "sha256:" + "G" * 64)


if __name__ == "__main__":
    unittest.main()
