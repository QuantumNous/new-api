"""Unit tests for .githooks/_shared.py.

Run:
    cd .githooks && pytest tests/test_shared.py -q
"""

import json
import subprocess
from pathlib import Path

import pytest

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib._shared import (
    MAX_RETRIES,
    Severity,
    TRANSIENT_PATTERNS,
    Finding,
    _is_transient,
    aggregate_result,
    gh_api_get,
    gh_api_graphql,
    gh_api_paginate,
    load_yaml,
    print_findings,
)


# ---------------------------------------------------------------------------
# Helper: call gh_api_* with `gh api` stubbed out
# ---------------------------------------------------------------------------
class FakeRunner:
    """Records args; returns an injectable sequence of (rc, output)."""

    def __init__(self, scripted):
        self.scripted = list(scripted)
        self.calls = []

    def __call__(self, args, input_body=None):
        self.calls.append({"args": args, "input": input_body})
        rc, out = self.scripted.pop(0) if self.scripted else (1, "unexpected EOF")
        return rc, out


@pytest.fixture
def fake_shared(monkeypatch):
    monkeypatch.setattr("lib._shared.time.sleep", lambda s: None)
    fake = FakeRunner([])
    monkeypatch.setattr("lib._shared._run_gh", fake)
    yield fake


# ---------------------------------------------------------------------------
# Transient detection
# ---------------------------------------------------------------------------
def test_transient_recognizes_known_patterns():
    assert _is_transient("unexpected EOF")
    assert _is_transient("Post https://...: connection reset by peer")
    assert _is_transient("503 Service Unavailable")


def test_transient_ignores_hard_errors():
    assert not _is_transient("404 Not Found")
    assert not _is_transient("Resource not accessible by integration")
    assert not _is_transient("Bad credentials")
    assert not _is_transient("")


def test_transient_patterns_cover_16_entries():
    assert len(TRANSIENT_PATTERNS) == 16


# ---------------------------------------------------------------------------
# gh_api_get
# ---------------------------------------------------------------------------
def test_gh_api_get_success(fake_shared):
    fake_shared.scripted = [(0, json.dumps({"number": 1}))]
    result = gh_api_get("repos/x/y/issues/1")
    assert result == {"number": 1}
    assert fake_shared.calls[0]["args"][0] == "repos/x/y/issues/1"


def test_gh_api_get_params_are_forwarded(fake_shared):
    fake_shared.scripted = [(0, json.dumps([]))]
    gh_api_get("repos/x/y/labels", {"per_page": 5})
    assert "-F" in fake_shared.calls[0]["args"]
    assert "per_page=5" in fake_shared.calls[0]["args"]


def test_gh_api_get_retries_transient_then_succeeds(fake_shared):
    fake_shared.scripted = [(1, "Post ...: unexpected EOF"), (0, json.dumps({"ok": True}))]
    result = gh_api_get("repos/x/y")
    assert result == {"ok": True}
    assert len(fake_shared.calls) == 2


def test_gh_api_get_hard_error_raises_immediately(fake_shared):
    fake_shared.scripted = [(1, "Bad credentials")]
    with pytest.raises(RuntimeError, match="hard failure"):
        gh_api_get("repos/x/y")
    assert len(fake_shared.calls) == 1


def test_gh_api_get_exhausts_retries(fake_shared):
    fake_shared.scripted = [(1, "unexpected EOF")] * (MAX_RETRIES + 2)
    with pytest.raises(RuntimeError, match="exhausted"):
        gh_api_get("repos/x/y")
    assert len(fake_shared.calls) == MAX_RETRIES


# ---------------------------------------------------------------------------
# gh_api_graphql
# ---------------------------------------------------------------------------
def test_gh_api_graphql_returns_data(fake_shared):
    fake_shared.scripted = [(0, json.dumps({"data": {"ok": 1}}))]
    result = gh_api_graphql("query { x }")
    assert result == {"ok": 1}
    # 参数第一个必须是 graphql + -f query=...
    assert fake_shared.calls[0]["args"][0] == "graphql"


def test_gh_api_graphql_surfaces_graphql_errors(fake_shared):
    fake_shared.scripted = [(0, json.dumps({"errors": [{"message": "boom"}]}))]
    with pytest.raises(RuntimeError, match="GraphQL errors"):
        gh_api_graphql("query { x }")


# ---------------------------------------------------------------------------
# gh_api_paginate
# ---------------------------------------------------------------------------
def test_gh_api_paginate_joins_pages(fake_shared):
    full_page = [{"n": i} for i in range(100)]  # exactly per_page → continue
    fake_shared.scripted = [
        (0, json.dumps(full_page)),
        (0, json.dumps([{"n": 100}])),  # partial → stop
    ]
    items = list(gh_api_paginate("repos/x/y/comments"))
    assert len(items) == 101
    assert "page=1" in fake_shared.calls[0]["args"][0]
    assert "page=2" in fake_shared.calls[1]["args"][0]


def test_gh_api_paginate_stops_on_partial_page(fake_shared):
    fake_shared.scripted = [(0, json.dumps([{"n": 1}, {"n": 2}]))]  # < per_page
    items = list(gh_api_paginate("repos/x/y/comments"))
    assert [i["n"] for i in items] == [1, 2]
    assert len(fake_shared.calls) == 1


def test_gh_api_paginate_handles_empty(fake_shared):
    fake_shared.scripted = [(0, json.dumps([]))]
    assert list(gh_api_paginate("repos/x/y")) == []


# ---------------------------------------------------------------------------
# Finding + aggregate
# ---------------------------------------------------------------------------
def test_finding_format_without_line():
    assert Finding("PR-05", Severity.WARN, "msg").format() == "PR-05  WARN\tmsg"


def test_finding_format_with_line():
    f = Finding("IS-04", Severity.FAIL, "bad bracket", line_hint=12)
    assert "L12" in f.format()


def test_aggregate_result_fail_dominates():
    findings = [Finding("a", Severity.WARN, "w"), Finding("b", Severity.FAIL, "f")]
    assert aggregate_result(findings) == 1


def test_aggregate_result_all_warn_is_pass():
    findings = [Finding("a", Severity.WARN, "w"), Finding("b", Severity.INFO, "i")]
    assert aggregate_result(findings) == 0


def test_print_findings_sorted(capsys):
    findings = [
        Finding("b", Severity.WARN, "w2"),
        Finding("a", Severity.FAIL, "f"),
        Finding("c", Severity.WARN, "w1"),
    ]
    print_findings(findings)
    lines = capsys.readouterr().err.splitlines()
    # FAIL first, RESULT last
    assert lines[0].startswith("a")
    assert lines[-1].startswith("RESULT: FAIL")


# ---------------------------------------------------------------------------
# load_yaml
# ---------------------------------------------------------------------------
def test_load_yaml_simple(tmp_path):
    p = tmp_path / "a.yaml"
    p.write_text("x: 1\nlist:\n  - a\n", encoding="utf-8")
    assert load_yaml(p) == {"x": 1, "list": ["a"]}


def test_load_yaml_empty_file(tmp_path):
    p = tmp_path / "empty.yaml"
    p.write_text("", encoding="utf-8")
    assert load_yaml(p) == {}


def test_load_yaml_missing_raises(tmp_path):
    with pytest.raises(FileNotFoundError):
        load_yaml(tmp_path / "nope.yaml")