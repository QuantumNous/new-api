import base64
import copy
import json
import pathlib
import tempfile
import unittest
import urllib.error

from scripts.browser_qa.flatkey_browser_qa import fixed_cases
from scripts.browser_qa.flatkey_browser_qa import promotion
from scripts.browser_qa.flatkey_browser_qa.github_candidate_pr import (
    GitHubCandidatePrError,
    canonical_case_yaml,
    canonical_pr_bundle,
    load_bundles,
    upsert_candidate_pr,
    write_pr_bundle_artifact,
)


TOKEN = "ghs_test-token-secret"
BASE_SHA = "a" * 40


def bundle(*, run_id="1001", state="candidate_draft", attempts_passed=0, title="Sign in link"):
    proposed_case = {
        "fixture": "anonymous",
        "start": {"origin": "staging_website", "path": "/zh"},
        "steps": [{"click": {"locator": {"by": "role", "role": "link", "name": title}}}],
        "assertions": [{"page_status_not": 404}, {"url_not_contains": "/404"}],
        "cleanup": "not_required",
    }
    target_url = "https://staging-website.flatkey.ai/zh"
    fingerprint = promotion.canonical_fingerprint("finding", target_url, proposed_case)
    case_id = promotion.deterministic_case_id(fingerprint, {})
    return {
        "schema_version": 1,
        "kind": "browser_qa_candidate_pr",
        "candidate_kind": "finding",
        "fingerprint": fingerprint,
        "case_id": case_id,
        "safe_slug": "sign-in-link",
        "target_url": target_url,
        "proposed_case": proposed_case,
        "source": {
            "run_id": run_id,
            "evidence_uri": f"gs://flatkey-browser-qa-reports/runs/{run_id}/main/main-{run_id}/manifest.json",
        },
        "promotion": {
            "state": state,
            "attempts_required": 3,
            "attempts_passed": attempts_passed,
        },
    }


class Response:
    def __init__(self, status, payload=None, *, headers=None, url="https://api.github.com/ok"):
        self.status = status
        self.payload = payload
        self.headers = headers or {}
        self.url = url

    def getcode(self):
        return self.status

    def read(self, limit=-1):
        raw = b"" if self.payload is None else json.dumps(self.payload, separators=(",", ":")).encode()
        if limit is None or limit < 0:
            return raw
        return raw[:limit]

    def geturl(self):
        return self.url


class FakeOpener:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def open(self, request, timeout=None):
        method = request.get_method()
        url = request.full_url
        body = request.data
        payload = json.loads(body.decode()) if body else None
        headers = dict(request.header_items())
        self.calls.append({"method": method, "url": url, "body": payload, "headers": headers})
        if "/merge" in url:
            raise AssertionError("merge endpoint must not be accessed")
        if not self.responses:
            raise AssertionError(f"unexpected request {method} {url}")
        item = self.responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


def successful_responses(prs=None, content_sha=None, pr_number=17):
    prs = [] if prs is None else prs
    content = Response(200, {"sha": content_sha, "content": ""}) if content_sha else urllib.error.HTTPError(
        "https://api.github.com/repos/SolveaCX/new-api/contents/x",
        404,
        "Not Found",
        {},
        None,
    )
    return [
        Response(200, prs),
        Response(200, {"object": {"sha": BASE_SHA}}),
        urllib.error.HTTPError("https://api.github.com/repos/SolveaCX/new-api/git/ref/heads/x", 404, "Not Found", {}, None),
        Response(201, {"ref": "refs/heads/x", "object": {"sha": BASE_SHA}}),
        content,
        Response(201 if content_sha is None else 200, {"content": {"sha": "b" * 40}}),
        Response(201, {"number": pr_number, "html_url": f"https://github.com/SolveaCX/new-api/pull/{pr_number}", "draft": True}),
    ]


def pr_list_response(prs):
    return Response(200, prs)


def write_methods(calls):
    return [call["method"] for call in calls if call["method"] in {"POST", "PATCH", "PUT", "DELETE"}]


class GitHubCandidatePrTests(unittest.TestCase):
    def test_canonical_yaml_is_deterministic_validates_schema_and_enables_only_ready_candidates(self):
        draft = canonical_pr_bundle(bundle(state="candidate_draft", attempts_passed=0))
        ready = canonical_pr_bundle(bundle(state="ready_for_review", attempts_passed=3))

        self.assertEqual(canonical_case_yaml(draft["fixed_case"]), canonical_case_yaml(copy.deepcopy(draft["fixed_case"])))
        self.assertFalse(draft["fixed_case"]["enabled"])
        self.assertTrue(ready["fixed_case"]["enabled"])
        fixed_cases.validate_case(draft["fixed_case"])
        fixed_cases.validate_case(ready["fixed_case"])
        self.assertEqual(fixed_cases._parse_yaml_subset(canonical_case_yaml(ready["fixed_case"])), ready["fixed_case"])

    def test_branch_is_stable_by_fingerprint_not_run_id_and_result_is_sanitized(self):
        first = canonical_pr_bundle(bundle(run_id="1001"))
        second = canonical_pr_bundle(bundle(run_id="9999"))
        self.assertEqual(first["branch"], second["branch"])
        opener = FakeOpener(successful_responses())

        result = upsert_candidate_pr(bundle=first, repository="SolveaCX/new-api", base="staging", token=TOKEN, opener=opener)

        self.assertEqual(result["action"], "created")
        self.assertEqual(result["pr_number"], 17)
        self.assertEqual(result["branch"], first["branch"])
        encoded = opener.calls[5]["body"]["content"]
        self.assertEqual(base64.b64decode(encoded).decode(), canonical_case_yaml(first["fixed_case"]))
        self.assertNotIn(TOKEN, json.dumps(result))
        self.assertTrue(all(call["url"].startswith("https://api.github.com/") for call in opener.calls))
        self.assertTrue(all("/merge" not in call["url"] for call in opener.calls))
        self.assertTrue(all(call["headers"].get("Authorization") == f"token {TOKEN}" for call in opener.calls))

    def test_build_artifact_writes_minimal_sanitized_pr_bundle_schema(self):
        candidate = bundle(state="ready_for_review", attempts_passed=3)
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            plan_path = root / "plan.json"
            summary_dir = root / "summaries"
            output_path = root / "candidate-pr-bundles.json"
            summary_dir.mkdir()
            plan_candidate = {
                "kind": candidate["candidate_kind"],
                "fingerprint": candidate["fingerprint"],
                "target_url": candidate["target_url"],
                "proposed_case": candidate["proposed_case"],
                "source": candidate["source"],
                "promotion": candidate["promotion"],
                "case_id": candidate["case_id"],
                "attempts": [],
            }
            plan_path.write_text(json.dumps({"schema_version": 1, "kind": "candidate_execution_plan", "candidates": [plan_candidate]}), encoding="utf-8")
            (summary_dir / "candidate-1-summary.json").write_text(
                json.dumps({"state": "ready_for_review", "decision": "ready_for_review", "attempts_passed": 3}),
                encoding="utf-8",
            )

            count = write_pr_bundle_artifact(plan_path=plan_path, summary_dir=summary_dir, output_path=output_path)
            artifact = json.loads(output_path.read_text(encoding="utf-8"))
            loaded = load_bundles(output_path)

        self.assertEqual(count, 1)
        self.assertEqual(set(artifact), {"schema_version", "kind", "bundles"})
        item = artifact["bundles"][0]
        self.assertEqual(set(item), {"schema_version", "kind", "fingerprint", "case_id", "safe_slug", "branch", "path", "fixed_case", "source", "promotion"})
        self.assertNotIn("target_url", json.dumps(artifact))
        self.assertNotIn("proposed_case", json.dumps(artifact))
        self.assertEqual(loaded[0]["fixed_case"], item["fixed_case"])

    def test_existing_duplicate_pr_states_are_resolved_before_any_branch_or_file_write(self):
        candidate = canonical_pr_bundle(bundle(state="ready_for_review", attempts_passed=3))
        draft = {"number": 8, "state": "open", "draft": True, "html_url": "https://github.com/SolveaCX/new-api/pull/8", "head": {"ref": candidate["branch"]}, "base": {"ref": "staging"}}
        merged = {**draft, "state": "closed", "draft": False, "merged_at": "2026-08-06T00:00:00Z"}
        opener = FakeOpener([pr_list_response([merged])])

        result = upsert_candidate_pr(bundle=candidate, repository="SolveaCX/new-api", base="staging", token=TOKEN, opener=opener)

        self.assertEqual(result["action"], "merged")
        self.assertEqual(write_methods(opener.calls), [])
        self.assertEqual(len(opener.calls), 1)
        self.assertIn("/pulls?", opener.calls[0]["url"])

        for pr, message in [
            ({**draft, "draft": False}, "non-draft"),
            ({**draft, "state": "closed", "draft": False, "merged_at": None}, "closed"),
        ]:
            with self.subTest(message=message):
                blocked = FakeOpener([
                    pr_list_response([pr]),
                    Response(200, {"object": {"sha": BASE_SHA}}),
                    urllib.error.HTTPError("https://api.github.com/repos/SolveaCX/new-api/git/ref/heads/x", 404, "Not Found", {}, None),
                    Response(201, {"ref": "refs/heads/x", "object": {"sha": BASE_SHA}}),
                ])
                with self.assertRaisesRegex(GitHubCandidatePrError, message):
                    upsert_candidate_pr(bundle=candidate, repository="SolveaCX/new-api", base="staging", token=TOKEN, opener=blocked)
                self.assertEqual(write_methods(blocked.calls), [])
                self.assertEqual(len(blocked.calls), 1)

    def test_updates_existing_open_draft_and_rejects_duplicate_pr_states_fail_closed(self):
        candidate = canonical_pr_bundle(bundle(state="ready_for_review", attempts_passed=3))
        draft = [{"number": 8, "state": "open", "draft": True, "html_url": "https://github.com/SolveaCX/new-api/pull/8", "head": {"ref": candidate["branch"]}, "base": {"ref": "staging"}}]
        opener = FakeOpener(successful_responses(prs=draft, content_sha="c" * 40) + [Response(200, {"number": 8, "html_url": draft[0]["html_url"], "draft": True})])
        result = upsert_candidate_pr(bundle=candidate, repository="SolveaCX/new-api", base="staging", token=TOKEN, opener=opener)
        self.assertEqual(result["action"], "updated")
        self.assertEqual(opener.calls[-1]["method"], "PATCH")
        self.assertEqual(opener.calls[5]["body"]["sha"], "c" * 40)

        for pr, message in [
            ({**draft[0], "draft": False}, "non-draft"),
            ({**draft[0], "state": "closed", "draft": False, "merged_at": None}, "closed"),
        ]:
            with self.subTest(message=message):
                blocked = FakeOpener(successful_responses(prs=[pr]))
                with self.assertRaisesRegex(GitHubCandidatePrError, message):
                    upsert_candidate_pr(bundle=candidate, repository="SolveaCX/new-api", base="staging", token=TOKEN, opener=blocked)

        merged = {**draft[0], "state": "closed", "draft": False, "merged_at": "2026-08-06T00:00:00Z"}
        no_op = FakeOpener(successful_responses(prs=[merged]))
        self.assertEqual(upsert_candidate_pr(bundle=candidate, repository="SolveaCX/new-api", base="staging", token=TOKEN, opener=no_op)["action"], "merged")

    def test_rejects_github_tokens_access_token_dingtalk_webhooks_and_secret_names_without_echoing_values(self):
        sensitive_values = [
            "ghs_abcdefghijklmnopqrstuvwxyz123456",
            "github_pat_11AAAAAAA_fakeTokenValue",
            "https://oapi.dingtalk.com/robot/send?access_token=abc123",
            "BROWSER_QA_GITHUB_TOKEN",
            "credential leaked",
            "credentials leaked",
            "user credential exposed",
            "secret leaked",
        ]
        for value in sensitive_values:
            with self.subTest(value=value):
                with self.assertRaises(ValueError) as raised:
                    canonical_pr_bundle(bundle(title=value))
                message = str(raised.exception)
                self.assertNotIn(value, message)
                self.assertNotIn(TOKEN, message)

    def test_rejects_hostile_inputs_bounded_responses_redirects_and_redacts_errors(self):
        bad_inputs = [
            {"repository": "SolveaCX/new-api/extra"},
            {"base": "main"},
            {"token": ""},
            {"bundle": {**bundle(), "safe_slug": "../escape"}},
            {"bundle": {**bundle(), "fingerprint": "sha256:" + "0" * 64}},
            {"bundle": {**bundle(), "target_url": "https://evil.example/zh"}},
        ]
        for patch in bad_inputs:
            kwargs = {"repository": "SolveaCX/new-api", "base": "staging", "token": TOKEN, "bundle": bundle(), "opener": FakeOpener([])}
            kwargs.update(patch)
            with self.subTest(patch=sorted(patch)):
                with self.assertRaises((GitHubCandidatePrError, ValueError)):
                    upsert_candidate_pr(**kwargs)

        redirect = FakeOpener([Response(200, {"object": {"sha": BASE_SHA}}, url="https://evil.example/steal")])
        with self.assertRaisesRegex(GitHubCandidatePrError, "GitHub API"):
            upsert_candidate_pr(bundle=bundle(), repository="SolveaCX/new-api", base="staging", token=TOKEN, opener=redirect)

        huge = FakeOpener([Response(200, {"x": "y" * 200000})])
        with self.assertRaisesRegex(GitHubCandidatePrError, "too large") as raised:
            upsert_candidate_pr(bundle=bundle(), repository="SolveaCX/new-api", base="staging", token=TOKEN, opener=huge)
        self.assertNotIn(TOKEN, str(raised.exception))

        leaking = FakeOpener([urllib.error.HTTPError("https://api.github.com/repos/SolveaCX/new-api/git/ref/heads/staging", 500, TOKEN, {}, None)])
        with self.assertRaises(GitHubCandidatePrError) as leaked:
            upsert_candidate_pr(bundle=bundle(), repository="SolveaCX/new-api", base="staging", token=TOKEN, opener=leaking)
        self.assertNotIn(TOKEN, str(leaked.exception))


if __name__ == "__main__":
    unittest.main()
