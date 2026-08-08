import argparse
import base64
import copy
import json
import os
import re
import sys
import pathlib
import urllib.error
import urllib.parse
import urllib.request

from . import fixed_cases
from . import promotion


API_ROOT = "https://api.github.com"
MAX_RESPONSE_BYTES = 128 * 1024
MAX_BUNDLE_BYTES = 64 * 1024
MAX_STRING = 512
SENSITIVE_VALUE_RE = re.compile(
    r"ghs_[A-Za-z0-9_]{10,}|github_pat_[A-Za-z0-9_]{10,}|sk-[A-Za-z0-9_-]{8,}|"
    r"(?i:https://oapi\.dingtalk\.com/robot/send\b)|"
    r"(?i:[?&](?:access_token|auth_token|api[_-]?key|client[_-]?secret|password|cookie|authorization)=)|"
    r"(?i:\b(?:authorization|cookie|password|credentials?|secret|client[_-]?secret|api[_-]?key)\b)|"
    r"\b[A-Z][A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|AUTHORIZATION|COOKIE)[A-Z0-9_]*\b"
)
BUNDLE_FIELDS = {
    "schema_version",
    "kind",
    "candidate_kind",
    "fingerprint",
    "case_id",
    "safe_slug",
    "target_url",
    "proposed_case",
    "source",
    "promotion",
}
CANONICAL_BUNDLE_FIELDS = BUNDLE_FIELDS | {"branch", "path", "fixed_case"}
ARTIFACT_BUNDLE_FIELDS = {
    "schema_version",
    "kind",
    "fingerprint",
    "case_id",
    "safe_slug",
    "branch",
    "path",
    "fixed_case",
    "source",
    "promotion",
}
SOURCE_FIELDS = {"run_id", "evidence_uri"}
PROMOTION_FIELDS = {"state", "attempts_required", "attempts_passed"}
REPOSITORY_RE = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
SAFE_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,79}$")
PR_SAFE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 ._:/#-]{0,255}$")


class GitHubCandidatePrError(RuntimeError):
    pass


def upsert_candidate_pr(*, repository="SolveaCX/new-api", base="staging", token, bundle, opener=None):
    owner, repo = _validate_repository(repository)
    if base != "staging":
        raise GitHubCandidatePrError("base must be staging")
    if not isinstance(token, str) or not token:
        raise GitHubCandidatePrError("GitHub token is required")
    opener = opener or urllib.request.build_opener(_NoRedirectHandler())
    candidate = canonical_pr_bundle(bundle)
    client = _GitHubClient(owner=owner, repo=repo, token=token, opener=opener)

    existing_pr = client.find_candidate_pr(owner, candidate["branch"], base)
    if existing_pr is not None:
        state = existing_pr["state"]
        if state == "closed" and existing_pr.get("merged_at"):
            return _result("merged", existing_pr, candidate)
        if state == "closed":
            raise GitHubCandidatePrError("closed unmerged candidate duplicate exists")
        if not existing_pr.get("draft"):
            raise GitHubCandidatePrError("open non-draft candidate duplicate exists")

    base_sha = client.base_sha(base)
    client.ensure_branch(candidate["branch"], base_sha)
    yaml_text = canonical_case_yaml(candidate["fixed_case"])
    content_sha = client.content_sha(candidate["path"], candidate["branch"])
    client.put_file(
        candidate["path"],
        candidate["branch"],
        yaml_text,
        content_sha=content_sha,
        message=f"Add Browser QA candidate {candidate['case_id']}",
    )
    title = _pr_title(candidate)
    body = _pr_body(candidate)
    if existing_pr is not None:
        pr = client.update_pr(existing_pr["number"], title=title, body=body, base=base)
        return _result("updated", pr, candidate)
    pr = client.create_draft_pr(title=title, head=candidate["branch"], base=base, body=body)
    return _result("created", pr, candidate)


def canonical_pr_bundle(bundle):
    if isinstance(bundle, dict) and set(bundle) == ARTIFACT_BUNDLE_FIELDS:
        return _validate_artifact_bundle(bundle)
    bundle = _validate_bundle_shell(bundle)
    kind = bundle["candidate_kind"]
    target_url = promotion._normalize_target_url(bundle["target_url"])
    if promotion._origin(target_url) not in candidate_or_staging_origins():
        raise ValueError("candidate target origin invalid")
    proposed = promotion._semantic_proposed_case(bundle["proposed_case"])
    fingerprint = bundle["fingerprint"]
    promotion._validate_fingerprint(fingerprint)
    if promotion.canonical_fingerprint(kind, target_url, proposed) != fingerprint:
        raise ValueError("candidate fingerprint mismatch")
    case_id = bundle["case_id"]
    if not isinstance(case_id, str) or not fixed_cases.ID_RE.fullmatch(case_id):
        raise ValueError("candidate case id invalid")
    safe_slug = bundle["safe_slug"]
    if not isinstance(safe_slug, str) or not SAFE_SLUG_RE.fullmatch(safe_slug) or ".." in safe_slug:
        raise ValueError("candidate slug invalid")
    source = _validate_source(bundle["source"])
    promo = _validate_promotion(bundle["promotion"])
    branch = promotion.candidate_branch(case_id, fingerprint)
    path = f"scripts/browser_qa/fixed-cases/{case_id}-{safe_slug}.yaml"
    _validate_fixed_case_path(path, case_id, safe_slug)
    fixed_case = _fixed_case_from_bundle(
        candidate_kind=kind,
        case_id=case_id,
        fingerprint=fingerprint,
        proposed_case=proposed,
        source=source,
        promotion_state=promo["state"],
        attempts_passed=promo["attempts_passed"],
    )
    candidate = {
        "schema_version": 1,
        "kind": "browser_qa_candidate_pr",
        "candidate_kind": kind,
        "fingerprint": fingerprint,
        "case_id": case_id,
        "safe_slug": safe_slug,
        "target_url": target_url,
        "proposed_case": proposed,
        "source": source,
        "promotion": promo,
        "branch": branch,
        "path": path,
        "fixed_case": fixed_case,
    }
    _bounded_json(candidate)
    return candidate


def canonical_case_yaml(case):
    validated = fixed_cases.validate_case(copy.deepcopy(case))
    text = _yaml_value(validated, 0, _case_key_order())
    parsed = fixed_cases._parse_yaml_subset(text)
    if parsed != validated:
        raise ValueError("canonical yaml round trip failed")
    return text


def load_bundles(path):
    with open(path, encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, dict) or set(payload) != {"schema_version", "kind", "bundles"}:
        raise ValueError("candidate pr artifact invalid")
    if payload["schema_version"] != 1 or payload["kind"] != "browser_qa_candidate_pr_bundles":
        raise ValueError("candidate pr artifact invalid")
    bundles = payload["bundles"]
    if not isinstance(bundles, list) or len(bundles) > 20:
        raise ValueError("candidate pr artifact invalid")
    return [canonical_pr_bundle(item) for item in bundles]


def write_pr_bundle_artifact(*, plan_path, summary_dir, output_path):
    with open(plan_path, encoding="utf-8") as handle:
        plan = json.load(handle)
    if not isinstance(plan, dict) or plan.get("schema_version") != 1 or plan.get("kind") != "candidate_execution_plan":
        raise ValueError("candidate plan invalid")
    candidates = plan.get("candidates")
    if not isinstance(candidates, list) or len(candidates) > 20:
        raise ValueError("candidate plan invalid")
    summary_root = pathlib.Path(summary_dir)
    bundles = []
    for index, candidate in enumerate(candidates, start=1):
        summary_path = summary_root / f"candidate-{index}-summary.json"
        if not summary_path.is_file():
            continue
        with open(summary_path, encoding="utf-8") as handle:
            summary = json.load(handle)
        decision = summary.get("decision")
        if decision not in {"ready_for_review", "awaiting_product_fix"}:
            continue
        attempts_passed = summary.get("attempts_passed", 0)
        raw = {
            "schema_version": 1,
            "kind": "browser_qa_candidate_pr",
            "candidate_kind": candidate.get("kind"),
            "fingerprint": candidate.get("fingerprint"),
            "case_id": candidate.get("case_id"),
            "safe_slug": _safe_slug(candidate),
            "target_url": candidate.get("target_url"),
            "proposed_case": candidate.get("proposed_case"),
            "source": candidate.get("source"),
            "promotion": {
                "state": summary.get("state"),
                "attempts_required": promotion.ATTEMPTS_REQUIRED,
                "attempts_passed": attempts_passed,
            },
        }
        bundles.append(_artifact_bundle(canonical_pr_bundle(raw)))
    artifact = {"schema_version": 1, "kind": "browser_qa_candidate_pr_bundles", "bundles": bundles}
    _bounded_json(artifact, limit=MAX_RESPONSE_BYTES)
    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(artifact, handle, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        handle.write("\n")
    return len(bundles)


def main(argv=None):
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    upsert = subparsers.add_parser("upsert")
    upsert.add_argument("--artifact", required=True)
    upsert.add_argument("--repository", default="SolveaCX/new-api")
    upsert.add_argument("--base", default="staging")
    build = subparsers.add_parser("build-artifact")
    build.add_argument("--plan", required=True)
    build.add_argument("--summary-dir", required=True)
    build.add_argument("--output", required=True)
    args = parser.parse_args(sys.argv[1:] if argv is None else argv)
    if args.command == "build-artifact":
        count = write_pr_bundle_artifact(plan_path=args.plan, summary_dir=args.summary_dir, output_path=args.output)
        print(json.dumps({"schema_version": 1, "candidate_pr_bundle_count": count}, sort_keys=True, separators=(",", ":")))
        return 0
    token = os.environ.get("GITHUB_TOKEN", "")
    results = []
    for item in load_bundles(args.artifact):
        results.append(upsert_candidate_pr(repository=args.repository, base=args.base, token=token, bundle=item))
    print(json.dumps({"schema_version": 1, "results": results}, sort_keys=True, separators=(",", ":")))
    return 0


class _GitHubClient:
    def __init__(self, *, owner, repo, token, opener):
        self.owner = owner
        self.repo = repo
        self.token = token
        self.opener = opener

    def base_sha(self, base):
        payload = self.request("GET", f"/repos/{self.owner}/{self.repo}/git/ref/heads/{_quote_ref(base)}")
        sha = _object_sha(payload)
        return sha

    def ensure_branch(self, branch, base_sha):
        encoded = _quote_ref(branch)
        payload = self.request("GET", f"/repos/{self.owner}/{self.repo}/git/ref/heads/{encoded}", allow_404=True)
        if payload is not None:
            _object_sha(payload)
            return
        created = self.request(
            "POST",
            f"/repos/{self.owner}/{self.repo}/git/refs",
            {"ref": f"refs/heads/{branch}", "sha": base_sha},
        )
        if _object_sha(created) != base_sha:
            raise GitHubCandidatePrError("created branch sha mismatch")

    def find_candidate_pr(self, owner, branch, base):
        query = urllib.parse.urlencode({"state": "all", "head": f"{owner}:{branch}", "base": base})
        payload = self.request("GET", f"/repos/{self.owner}/{self.repo}/pulls?{query}")
        if not isinstance(payload, list):
            raise GitHubCandidatePrError("GitHub pull list schema invalid")
        matches = []
        for item in payload:
            _validate_pr(item)
            if item["head"]["ref"] == branch and item["base"]["ref"] == base:
                matches.append(item)
        if len(matches) > 1:
            raise GitHubCandidatePrError("multiple candidate duplicate pull requests exist")
        return matches[0] if matches else None

    def content_sha(self, path, branch):
        payload = self.request(
            "GET",
            f"/repos/{self.owner}/{self.repo}/contents/{_quote_path(path)}?ref={urllib.parse.quote(branch, safe='')}",
            allow_404=True,
        )
        if payload is None:
            return None
        if not isinstance(payload, dict) or set(payload) - {"sha", "content", "encoding", "type", "name", "path", "size", "url", "html_url", "git_url", "download_url", "_links"}:
            raise GitHubCandidatePrError("GitHub content schema invalid")
        sha = payload.get("sha")
        if not _safe_sha(sha):
            raise GitHubCandidatePrError("GitHub content sha invalid")
        return sha

    def put_file(self, path, branch, text, *, content_sha, message):
        body = {
            "message": message,
            "content": base64.b64encode(text.encode("utf-8")).decode("ascii"),
            "branch": branch,
        }
        if content_sha is not None:
            body["sha"] = content_sha
        payload = self.request("PUT", f"/repos/{self.owner}/{self.repo}/contents/{_quote_path(path)}", body)
        if not isinstance(payload, dict) or not isinstance(payload.get("content"), dict) or not _safe_sha(payload["content"].get("sha")):
            raise GitHubCandidatePrError("GitHub content write schema invalid")

    def create_draft_pr(self, *, title, head, base, body):
        payload = self.request("POST", f"/repos/{self.owner}/{self.repo}/pulls", {"title": title, "head": head, "base": base, "body": body, "draft": True})
        _validate_pr_response(payload)
        return payload

    def update_pr(self, number, *, title, body, base):
        if not isinstance(number, int) or isinstance(number, bool) or number <= 0:
            raise GitHubCandidatePrError("GitHub pull number invalid")
        payload = self.request("PATCH", f"/repos/{self.owner}/{self.repo}/pulls/{number}", {"title": title, "body": body, "base": base})
        _validate_pr_response(payload)
        return payload

    def request(self, method, path, payload=None, *, allow_404=False):
        if "/merge" in path:
            raise GitHubCandidatePrError("merge endpoint is forbidden")
        url = API_ROOT + path
        parsed = urllib.parse.urlsplit(url)
        if parsed.scheme != "https" or parsed.netloc != "api.github.com":
            raise GitHubCandidatePrError("GitHub API host invalid")
        data = None if payload is None else json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        headers = {
            "Accept": "application/vnd.github+json",
            "Authorization": f"token {self.token}",
            "User-Agent": "browser-qa-candidate-pr",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if data is not None:
            headers["Content-Type"] = "application/json"
        request = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            response = self.opener.open(request, timeout=20)
        except urllib.error.HTTPError as exc:
            if allow_404 and exc.code == 404:
                return None
            raise GitHubCandidatePrError(_sanitize_error(f"GitHub API request failed with status {getattr(exc, 'code', 'unknown')}", self.token)) from None
        except Exception as exc:
            raise GitHubCandidatePrError(_sanitize_error(f"GitHub API request failed: {type(exc).__name__}", self.token)) from None
        final_url = response.geturl() if hasattr(response, "geturl") else url
        final = urllib.parse.urlsplit(final_url)
        if final.scheme != "https" or final.netloc != "api.github.com":
            raise GitHubCandidatePrError("GitHub API redirect host invalid")
        raw = response.read(MAX_RESPONSE_BYTES + 1)
        if len(raw) > MAX_RESPONSE_BYTES:
            raise GitHubCandidatePrError("GitHub API response too large")
        if raw == b"":
            return {}
        try:
            decoded = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise GitHubCandidatePrError("GitHub API response schema invalid") from None
        _bounded_json(decoded, limit=MAX_RESPONSE_BYTES)
        return decoded


def candidate_or_staging_origins():
    return {"https://staging-console.flatkey.ai", "https://staging-website.flatkey.ai"}


class _NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise urllib.error.HTTPError(req.full_url, code, "GitHub API redirect forbidden", headers, fp)


def _fixed_case_from_bundle(*, candidate_kind, case_id, fingerprint, proposed_case, source, promotion_state, attempts_passed):
    case = {
        "schema_version": 1,
        "id": case_id,
        "kind": "coverage_baseline" if candidate_kind == "coverage" else "bug_regression",
        "name": f"Candidate {case_id}",
        "enabled": promotion_state == "ready_for_review",
        "severity": "low" if candidate_kind == "coverage" else "medium",
        "owner": "browser-qa",
        "fixture": copy.deepcopy(proposed_case["fixture"]),
        "start": copy.deepcopy(proposed_case["start"]),
        "steps": copy.deepcopy(proposed_case["steps"]),
        "assertions": copy.deepcopy(proposed_case["assertions"]),
        "evidence": {"screenshot_on_failure": True, "capture_console": True, "capture_network": False},
        "cleanup": copy.deepcopy(proposed_case["cleanup"]),
        "source": {
            "run_id": source["run_id"],
            "finding_fingerprint": fingerprint,
            "evidence_uri": source["evidence_uri"],
        },
        "promotion": {
            "state": promotion_state,
            "attempts_required": promotion.ATTEMPTS_REQUIRED,
            "attempts_passed": attempts_passed,
        },
    }
    fixed_cases.validate_case(case)
    return case


def _validate_bundle_shell(bundle):
    if not isinstance(bundle, dict):
        raise ValueError("candidate pr bundle invalid")
    if set(bundle) == CANONICAL_BUNDLE_FIELDS:
        bundle = {key: copy.deepcopy(bundle[key]) for key in BUNDLE_FIELDS}
    if set(bundle) != BUNDLE_FIELDS:
        raise ValueError("candidate pr bundle fields invalid")
    if bundle["schema_version"] != 1 or bundle["kind"] != "browser_qa_candidate_pr":
        raise ValueError("candidate pr bundle schema invalid")
    if bundle["candidate_kind"] not in promotion.KINDS:
        raise ValueError("candidate pr bundle kind invalid")
    _bounded_json(bundle)
    _reject_sensitive_strings(bundle)
    return copy.deepcopy(bundle)


def _validate_artifact_bundle(bundle):
    if bundle.get("schema_version") != 1 or bundle.get("kind") != "browser_qa_candidate_pr":
        raise ValueError("candidate pr bundle schema invalid")
    _bounded_json(bundle)
    _reject_sensitive_strings(bundle)
    fingerprint = bundle["fingerprint"]
    promotion._validate_fingerprint(fingerprint)
    case = fixed_cases.validate_case(copy.deepcopy(bundle["fixed_case"]))
    case_id = bundle["case_id"]
    safe_slug = bundle["safe_slug"]
    if case["id"] != case_id or case["source"]["finding_fingerprint"] != fingerprint:
        raise ValueError("candidate fixed case identity invalid")
    if not isinstance(case_id, str) or not fixed_cases.ID_RE.fullmatch(case_id):
        raise ValueError("candidate case id invalid")
    if not isinstance(safe_slug, str) or not SAFE_SLUG_RE.fullmatch(safe_slug) or ".." in safe_slug:
        raise ValueError("candidate slug invalid")
    source = _validate_source(bundle["source"])
    promo = _validate_promotion(bundle["promotion"])
    if case["source"] != {"run_id": source["run_id"], "finding_fingerprint": fingerprint, "evidence_uri": source["evidence_uri"]}:
        raise ValueError("candidate source invalid")
    if case["promotion"] != {"state": promo["state"], "attempts_required": promo["attempts_required"], "attempts_passed": promo["attempts_passed"]}:
        raise ValueError("candidate promotion invalid")
    branch = promotion.candidate_branch(case_id, fingerprint)
    path = f"scripts/browser_qa/fixed-cases/{case_id}-{safe_slug}.yaml"
    if bundle["branch"] != branch or bundle["path"] != path:
        raise ValueError("candidate branch or path invalid")
    _validate_fixed_case_path(path, case_id, safe_slug)
    candidate_kind = "coverage" if case["kind"] == "coverage_baseline" else "finding"
    return {
        "schema_version": 1,
        "kind": "browser_qa_candidate_pr",
        "candidate_kind": candidate_kind,
        "fingerprint": fingerprint,
        "case_id": case_id,
        "safe_slug": safe_slug,
        "target_url": "",
        "proposed_case": {},
        "source": source,
        "promotion": promo,
        "branch": branch,
        "path": path,
        "fixed_case": case,
    }


def _artifact_bundle(candidate):
    return {
        "schema_version": 1,
        "kind": "browser_qa_candidate_pr",
        "fingerprint": candidate["fingerprint"],
        "case_id": candidate["case_id"],
        "safe_slug": candidate["safe_slug"],
        "branch": candidate["branch"],
        "path": candidate["path"],
        "fixed_case": copy.deepcopy(candidate["fixed_case"]),
        "source": copy.deepcopy(candidate["source"]),
        "promotion": copy.deepcopy(candidate["promotion"]),
    }


def _validate_source(source):
    if not isinstance(source, dict) or set(source) != SOURCE_FIELDS:
        raise ValueError("candidate source invalid")
    run_id = source["run_id"]
    promotion._validate_run_id(run_id)
    promotion._validate_gcs_uri(source["evidence_uri"], run_id)
    return copy.deepcopy(source)


def _validate_promotion(value):
    if not isinstance(value, dict) or set(value) != PROMOTION_FIELDS:
        raise ValueError("candidate promotion invalid")
    if value["state"] not in fixed_cases.PROMOTION_STATES:
        raise ValueError("candidate promotion invalid")
    if value["attempts_required"] != promotion.ATTEMPTS_REQUIRED:
        raise ValueError("candidate promotion invalid")
    attempts_passed = value["attempts_passed"]
    if not isinstance(attempts_passed, int) or isinstance(attempts_passed, bool) or attempts_passed < 0 or attempts_passed > promotion.ATTEMPTS_REQUIRED:
        raise ValueError("candidate promotion invalid")
    if value["state"] == "ready_for_review" and attempts_passed != promotion.ATTEMPTS_REQUIRED:
        raise ValueError("candidate promotion invalid")
    return copy.deepcopy(value)


def _validate_repository(repository):
    if not isinstance(repository, str) or not REPOSITORY_RE.fullmatch(repository) or ".." in repository:
        raise GitHubCandidatePrError("repository must be owner/repo")
    owner, repo = repository.split("/", 1)
    for part in (owner, repo):
        if part in {".", ".."} or part.startswith(".") or part.endswith("."):
            raise GitHubCandidatePrError("repository must be owner/repo")
    return owner, repo


def _validate_fixed_case_path(path, case_id, slug):
    expected = f"scripts/browser_qa/fixed-cases/{case_id}-{slug}.yaml"
    if path != expected or "\\" in path or ".." in path or path.startswith("/"):
        raise ValueError("candidate fixed case path invalid")


def _case_key_order():
    return [
        "schema_version",
        "id",
        "kind",
        "name",
        "enabled",
        "severity",
        "owner",
        "fixture",
        "start",
        "steps",
        "assertions",
        "evidence",
        "cleanup",
        "source",
        "promotion",
    ]


def _yaml_value(value, indent, ordered_keys=None):
    if isinstance(value, dict):
        keys = ordered_keys or sorted(value)
        lines = []
        for key in keys:
            child = value[key]
            prefix = " " * indent + f"{key}:"
            if isinstance(child, (dict, list)):
                lines.append(prefix)
                lines.append(_yaml_value(child, indent + 2))
            else:
                lines.append(prefix + " " + _yaml_scalar(child))
        return "\n".join(lines) + ("\n" if indent == 0 else "")
    if isinstance(value, list):
        lines = []
        for item in value:
            if not isinstance(item, dict) or len(item) != 1:
                raise ValueError("canonical yaml list item invalid")
            key, child = next(iter(item.items()))
            prefix = " " * indent + f"- {key}:"
            if isinstance(child, (dict, list)):
                lines.append(prefix)
                lines.append(_yaml_value(child, indent + 4))
            else:
                lines.append(prefix + " " + _yaml_scalar(child))
        return "\n".join(lines)
    return " " * indent + _yaml_scalar(value)


def _yaml_scalar(value):
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int) and not isinstance(value, bool):
        return str(value)
    if not isinstance(value, str) or not fixed_cases.TEXT_RE.fullmatch(value) or "'" in value or '"' in value:
        raise ValueError("canonical yaml scalar invalid")
    if re.fullmatch(r"[A-Za-z0-9_./:@%# -]+", value) and value not in {"true", "false"} and not re.fullmatch(r"[0-9]+", value):
        return value
    return '"' + value + '"'


def _object_sha(payload):
    if not isinstance(payload, dict) or "object" not in payload or not isinstance(payload["object"], dict):
        raise GitHubCandidatePrError("GitHub ref schema invalid")
    sha = payload["object"].get("sha")
    if not _safe_sha(sha):
        raise GitHubCandidatePrError("GitHub ref sha invalid")
    return sha


def _validate_pr(item):
    if not isinstance(item, dict):
        raise GitHubCandidatePrError("GitHub pull schema invalid")
    for field in ("number", "state", "draft", "head", "base"):
        if field not in item:
            raise GitHubCandidatePrError("GitHub pull schema invalid")
    if not isinstance(item["number"], int) or isinstance(item["number"], bool) or item["number"] <= 0:
        raise GitHubCandidatePrError("GitHub pull schema invalid")
    if item["state"] not in {"open", "closed"} or not isinstance(item["draft"], bool):
        raise GitHubCandidatePrError("GitHub pull schema invalid")
    if not isinstance(item["head"], dict) or not isinstance(item["base"], dict):
        raise GitHubCandidatePrError("GitHub pull schema invalid")
    if not isinstance(item["head"].get("ref"), str) or not isinstance(item["base"].get("ref"), str):
        raise GitHubCandidatePrError("GitHub pull schema invalid")
    if "html_url" in item and not _safe_github_html_url(item["html_url"]):
        raise GitHubCandidatePrError("GitHub pull schema invalid")


def _validate_pr_response(payload):
    if not isinstance(payload, dict):
        raise GitHubCandidatePrError("GitHub pull response schema invalid")
    _validate_pr({**payload, "state": payload.get("state", "open"), "head": payload.get("head", {"ref": "x"}), "base": payload.get("base", {"ref": "staging"})})
    if not _safe_github_html_url(payload.get("html_url")):
        raise GitHubCandidatePrError("GitHub pull response schema invalid")


def _result(action, pr, candidate):
    url = pr.get("html_url")
    if not _safe_github_html_url(url):
        url = None
    result = {
        "action": action,
        "status": "ok",
        "branch": candidate["branch"],
        "path": candidate["path"],
        "pr_number": pr["number"],
        "pr_url": url,
    }
    _bounded_json(result, limit=4096)
    return result


def _pr_title(candidate):
    title = f"Browser QA candidate {candidate['case_id']} {candidate['fingerprint'][7:19]}"
    if not PR_SAFE_RE.fullmatch(title):
        raise ValueError("candidate pr title invalid")
    return title


def _pr_body(candidate):
    body = "\n".join([
        "Browser QA fixed-case candidate.",
        "",
        f"- fingerprint: {candidate['fingerprint']}",
        f"- fixed case: {candidate['path']}",
        f"- promotion state: {candidate['promotion']['state']}",
        f"- source run: {candidate['source']['run_id']}",
    ])
    if len(body.encode("utf-8")) > 2048:
        raise ValueError("candidate pr body invalid")
    return body


def _safe_slug(candidate):
    target = promotion._normalize_target_url(candidate.get("target_url"))
    path = urllib.parse.urlsplit(target).path.strip("/")
    source = path.rsplit("/", 1)[-1] if path else candidate.get("case_id", "candidate")
    slug = re.sub(r"[^a-z0-9]+", "-", source.lower()).strip("-")
    if not slug:
        slug = "candidate"
    return slug[:80].rstrip("-") or "candidate"


def _quote_ref(value):
    return urllib.parse.quote(value, safe="")


def _quote_path(value):
    return "/".join(urllib.parse.quote(part, safe="") for part in value.split("/"))


def _safe_sha(value):
    return isinstance(value, str) and re.fullmatch(r"[0-9a-f]{40}", value) is not None


def _safe_github_html_url(value):
    if not isinstance(value, str) or len(value) > MAX_STRING:
        return False
    parsed = urllib.parse.urlsplit(value)
    return parsed.scheme == "https" and parsed.netloc == "github.com" and not parsed.query and not parsed.fragment


def _bounded_json(value, limit=MAX_BUNDLE_BYTES):
    try:
        raw = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    except (TypeError, ValueError) as exc:
        raise ValueError("candidate object invalid") from exc
    if len(raw) > limit:
        raise ValueError("candidate object too large")
    _bounded_strings(value)


def _bounded_strings(value):
    if isinstance(value, dict):
        if len(value) > 64:
            raise ValueError("candidate object too large")
        for key, child in value.items():
            if not isinstance(key, str) or len(key) > MAX_STRING:
                raise ValueError("candidate object invalid")
            _bounded_strings(child)
    elif isinstance(value, list):
        if len(value) > 100:
            raise ValueError("candidate object too large")
        for child in value:
            _bounded_strings(child)
    elif isinstance(value, str):
        if len(value.encode("utf-8")) > MAX_STRING or any(ord(ch) < 32 or ord(ch) == 127 for ch in value):
            raise ValueError("candidate string invalid")


def _reject_sensitive_strings(value):
    for text in _walk_strings(value):
        if SENSITIVE_VALUE_RE.search(text):
            raise ValueError("candidate contains sensitive content")
        if any(marker in text for marker in ("console.jsonl", "network.jsonl", "screenshots/", "codex-events", "stderr", "result.json")):
            raise ValueError("candidate contains raw evidence")


def _walk_strings(value):
    if isinstance(value, dict):
        for child in value.values():
            yield from _walk_strings(child)
    elif isinstance(value, list):
        for child in value:
            yield from _walk_strings(child)
    elif isinstance(value, str):
        yield value


def _sanitize_error(message, token):
    return str(message).replace(token, "[REDACTED]")


if __name__ == "__main__":
    raise SystemExit(main())
