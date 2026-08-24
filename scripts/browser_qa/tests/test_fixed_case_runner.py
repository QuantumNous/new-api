import copy
import json
import os
import tempfile
import unittest

from scripts.browser_qa.flatkey_browser_qa.fixed_case_runner import FixedCaseRunner
from scripts.browser_qa.flatkey_browser_qa import supervisor


VALID_CASE = {
    "schema_version": 1,
    "id": "FQA-9001",
    "kind": "coverage_baseline",
    "name": "Sign in link avoids missing page",
    "enabled": False,
    "severity": "medium",
    "owner": "browser-qa",
    "fixture": "anonymous",
    "start": {"origin": "staging_console", "path": "/start"},
    "steps": [{"click": {"locator": {"by": "text", "text": "Sign in"}}}],
    "assertions": [{"url_not_contains": "/404"}],
    "evidence": {"screenshot_on_failure": True, "capture_console": True, "capture_network": True},
    "cleanup": "not_required",
    "source": {
        "run_id": "123456789",
        "finding_fingerprint": "finding-9001",
        "evidence_uri": "gs://flatkey-browser-qa-private/run-123/fqa-9001",
    },
    "promotion": {"state": "candidate_draft", "attempts_required": 3, "attempts_passed": 0},
}


class RecordingHelper:
    def __init__(self, result):
        self.result = result
        self.requests = []

    def execute_fixed_case(self, *, case, attempt, evidence_dir):
        self.requests.append({"case": case, "attempt": attempt, "evidence_dir": evidence_dir})
        return self.result


def valid_result(overrides=None):
    result = {
        "status": "passed",
        "case_id": "FQA-9001",
        "attempt_id": "attempt-001",
        "evidence_dir": "FQA-9001/attempt-001",
        "steps": [{"index": 0, "action": "click", "status": "passed"}],
        "assertions": [{"index": 0, "assertion": "url_not_contains", "status": "passed"}],
        "failure": None,
    }
    if overrides:
        result.update(overrides)
    return result


class FixedCaseRunnerTests(unittest.TestCase):
    def test_runner_sends_exact_execute_fixed_case_request_and_returns_stable_success(self):
        result = {
            "status": "passed",
            "case_id": "FQA-9001",
            "attempt_id": "attempt-001",
            "evidence_dir": "FQA-9001/attempt-001",
            "steps": [{"index": 0, "action": "click", "status": "passed"}],
            "assertions": [{"index": 0, "assertion": "url_not_contains", "status": "passed"}],
            "failure": None,
        }
        helper = RecordingHelper(result)
        with tempfile.TemporaryDirectory() as tmp:
            runner = FixedCaseRunner(helper, evidence_dir=tmp)
            returned = runner.run(copy.deepcopy(VALID_CASE), {"id": "attempt-001", "retry": 0})

        self.assertEqual(returned, result)
        self.assertEqual(len(helper.requests), 1)
        self.assertEqual(helper.requests[0]["case"], VALID_CASE)
        self.assertEqual(helper.requests[0]["attempt"], {"id": "attempt-001", "retry": 0})
        self.assertTrue(os.path.isabs(helper.requests[0]["evidence_dir"]))

    def test_runner_rejects_path_traversal_before_protocol_request(self):
        helper = RecordingHelper({})
        with tempfile.TemporaryDirectory() as tmp:
            runner = FixedCaseRunner(helper, evidence_dir=tmp)
            bad_case = copy.deepcopy(VALID_CASE)
            bad_case["id"] = "../bad"
            with self.assertRaises(ValueError):
                runner.run(bad_case, {"id": "attempt-001"})
            bad_case = copy.deepcopy(VALID_CASE)
            bad_case["extra"] = "bad"
            with self.assertRaises(ValueError):
                runner.run(bad_case, {"id": "attempt-001"})
            with self.assertRaises(ValueError):
                runner.run(copy.deepcopy(VALID_CASE), {"id": "../bad"})
            with self.assertRaises(ValueError):
                runner.run(copy.deepcopy(VALID_CASE), {"id": "attempt-001", "extra": "bad"})
            with self.assertRaises(ValueError):
                runner.run(copy.deepcopy(VALID_CASE), {"id": "attempt-001", "retry": 101})

        self.assertEqual(helper.requests, [])

    def test_runner_rejects_malformed_protocol_results(self):
        malformed_results = [
            None,
            {},
            {"status": "passed", "case_id": "FQA-9001", "attempt_id": "attempt-001", "evidence_dir": "../bad"},
            {"status": "unknown", "case_id": "FQA-9001", "attempt_id": "attempt-001", "evidence_dir": "FQA-9001/attempt-001"},
            valid_result({"extra": "bad"}),
            valid_result({"steps": [{"index": 0, "action": "navigate", "status": "passed"}]}),
            valid_result({"steps": [{"index": 1, "action": "click", "status": "passed"}]}),
            valid_result({"assertions": [{"index": 0, "assertion": "page_status_not", "status": "passed"}]}),
            valid_result({
                "status": "failed",
                "failure": {
                    "phase": "step",
                    "index": 0,
                    "action": "click",
                    "code": "step_failed",
                    "evidence": {"screenshot": "../bad.png"},
                },
            }),
            valid_result({
                "status": "failed",
                "failure": {
                    "phase": "step",
                    "index": 0,
                    "action": "click",
                    "code": "step_failed",
                    "evidence": {"network": "bad"},
                },
            }),
            valid_result({
                "status": "failed",
                "failure": {
                    "phase": "start",
                    "index": None,
                    "action": "click",
                    "code": "navigation_failed",
                    "evidence": {},
                },
            }),
            valid_result({
                "status": "failed",
                "failure": {
                    "phase": "step",
                    "index": 0,
                    "code": "step_failed",
                    "evidence": {},
                },
            }),
            valid_result({
                "status": "failed",
                "failure": {
                    "phase": "step",
                    "index": 2,
                    "action": "click",
                    "code": "step_failed",
                    "evidence": {},
                },
            }),
            valid_result({
                "status": "failed",
                "failure": {
                    "phase": "step",
                    "index": 0,
                    "action": "navigate",
                    "code": "step_failed",
                    "evidence": {},
                },
            }),
            valid_result({
                "status": "failed",
                "failure": {
                    "phase": "assertion",
                    "index": 0,
                    "assertion": "page_status_not",
                    "code": "assertion_failed",
                    "evidence": {},
                },
            }),
            valid_result({
                "status": "failed",
                "failure": {
                    "phase": "assertion",
                    "index": 5,
                    "assertion": "url_not_contains",
                    "code": "assertion_failed",
                    "evidence": {},
                },
            }),
            valid_result({
                "status": "failed",
                "failure": {
                    "phase": "assertion",
                    "index": 0,
                    "assertion": "url_not_contains",
                    "code": "assertion_failed",
                    "evidence": {},
                    "extra": "bad",
                },
            }),
        ]
        with tempfile.TemporaryDirectory() as tmp:
            for result in malformed_results:
                with self.subTest(result=json.dumps(result, sort_keys=True)):
                    runner = FixedCaseRunner(RecordingHelper(result), evidence_dir=tmp)
                    with self.assertRaises(RuntimeError):
                        runner.run(copy.deepcopy(VALID_CASE), {"id": "attempt-001"})

    def test_browser_evidence_helper_sends_exact_execute_fixed_case_frame(self):
        result = {
            "status": "passed",
            "case_id": "FQA-9001",
            "attempt_id": "attempt-001",
            "evidence_dir": "FQA-9001/attempt-001",
            "steps": [],
            "assertions": [],
            "failure": None,
        }

        class Process:
            def __init__(self):
                self.stdin = RecordingStdin()
                self.stdout = RecordingStdout(json.dumps({"id": 1, "ok": True, "result": result}) + "\n")

        process = Process()
        helper = supervisor.BrowserEvidenceHelperProcess(
            browser=type("Browser", (), {"cdp_endpoint": "http://127.0.0.1:9222"})(),
            runtime_root="runtime",
            redactor=supervisor.Redactor(),
            popen_factory=lambda *_args, **_kwargs: None,
        )
        helper.process = process

        returned = helper.execute_fixed_case(
            case=copy.deepcopy(VALID_CASE),
            attempt={"id": "attempt-001", "retry": 0},
            evidence_dir="C:\\runtime",
        )

        self.assertEqual(returned, result)
        self.assertEqual(len(process.stdin.lines), 1)
        self.assertEqual(json.loads(process.stdin.lines[0]), {
            "id": 1,
            "command": "executeFixedCase",
            "params": {
                "case": VALID_CASE,
                "attempt": {"id": "attempt-001", "retry": 0},
                "evidenceDir": "C:\\runtime",
            },
        })


class RecordingStdin:
    def __init__(self):
        self.lines = []

    def write(self, value):
        self.lines.append(value.rstrip("\n"))

    def flush(self):
        return None


class RecordingStdout:
    def __init__(self, line):
        self.line = line

    def readline(self):
        return self.line


if __name__ == "__main__":
    unittest.main()
