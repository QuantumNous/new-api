"""Shared helpers for .githooks/ Python validators.

Why centralize: each topic script (github/, code/, workspace/, cleanup/) needs
the same three primitives — a GitHub API client that tolerates flaky networks,
a Finding container that flows through rule checks, and a YAML loader. Keeping
them in one file avoids copy-paste drift (16 transient-error patterns, retry
budget, severity ranking) without forcing a heavy package layout the project
explicitly rejected.

Usage:
    from lib._shared import gh_api_get, gh_api_graphql, gh_api_paginate, \\
        Finding, Severity, load_yaml, aggregate_result
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from enum import IntEnum
from pathlib import Path
from typing import Any, Iterator, Optional

try:
    import yaml  # type: ignore
except ImportError:  # pragma: no cover - env fallback message only
    sys.exit(
        "PyYAML is required: pip install pyyaml (or use the project venv)"
    )


# ---------------------------------------------------------------------------
# Transient error detection
# ---------------------------------------------------------------------------
#
# These substrings cover every short-lived network failure seen in this repo's
# CI history (EOF bursts, TLS renegotiation, 5xx storms, connection resets).
# Non-matching errors (4xx, permission denied, malformed request) propagate
# immediately — retrying them would just burn the budget.
TRANSIENT_PATTERNS: tuple[str, ...] = (
    "EOF",
    "unexpected EOF",
    "connection reset",
    "Connection reset",
    "Connection closed",
    "connection refused",
    "broken pipe",
    "TLS handshake timeout",
    "dial tcp",
    "i/o timeout",
    "net/http: timeout",
    "transport is closing",
    "500 Internal Server Error",
    "502 Bad Gateway",
    "503 Service Unavailable",
    "504 Gateway Timeout",
)

MAX_RETRIES = 8
INITIAL_BACKOFF_SECONDS = 3


def _is_transient(message: str) -> bool:
    return any(pat in message for pat in TRANSIENT_PATTERNS)


# ---------------------------------------------------------------------------
# GitHub API client
# ---------------------------------------------------------------------------
#
# We delegate HTTP to `gh api` (CLI) rather than hitting api.github.com
# directly — `gh` already handles authentication, base URL, and pagination
# semantics. The retry loop wraps the subprocess so transient network blips
# don't surface as hard failures during a real validation run.
def _run_gh(args: list[str], input_body: Optional[str] = None) -> tuple[int, str]:
    proc = subprocess.run(
        ["gh", "api", *args],
        input=input_body,
        capture_output=True,
        text=True,
        timeout=60,
    )
    combined = proc.stdout + proc.stderr
    return proc.returncode, combined.strip()


def _run_gh_with_retry(
    args: list[str], input_body: Optional[str] = None
) -> str:
    last_msg = ""
    for attempt in range(1, MAX_RETRIES + 1):
        rc, out = _run_gh(args, input_body=input_body)
        if rc == 0:
            return out
        last_msg = out
        if not _is_transient(out):
            raise RuntimeError(f"gh api hard failure ({rc}): {out}")
        time.sleep(INITIAL_BACKOFF_SECONDS * attempt)
    raise RuntimeError(
        f"gh api exhausted {MAX_RETRIES} retries: {last_msg}"
    )


def gh_api_get(path: str, params: Optional[dict[str, Any]] = None) -> Any:
    """GET a GitHub REST endpoint, returning parsed JSON.

    `path` is appended verbatim to `gh api` (e.g. "repos/OWNER/REPO/issues/1").
    `params`, if given, become `--field` flags so callers stay type-safe.
    """
    args = [path]
    if params:
        for key, value in params.items():
            args.extend(["-F", f"{key}={value}"])
    raw = _run_gh_with_retry(args)
    if not raw:
        return None
    return json.loads(raw)


def gh_api_graphql(query: str, variables: Optional[dict[str, Any]] = None) -> Any:
    """Run a GraphQL query via `gh api graphql` and return the data payload.

    Raises RuntimeError on errors (both transport and GraphQL-level).
    """
    payload: dict[str, Any] = {"query": query}
    if variables:
        payload["variables"] = variables
    raw = _run_gh_with_retry(["graphql", "-f", f"query={query}"])
    if not raw:
        return None
    parsed = json.loads(raw)
    if "errors" in parsed:
        raise RuntimeError(f"GraphQL errors: {parsed['errors']}")
    return parsed.get("data")


def gh_api_paginate(path: str, page_size: int = 100) -> Iterator[dict[str, Any]]:
    """Iterate a list endpoint by explicit cursor pagination.

    Uses `page=N&per_page=N` params (works for all REST list endpoints under
    api.github.com). Stops when a page returns fewer than `page_size` items.
    """
    page = 1
    while True:
        sep = "&" if "?" in path else "?"
        paged = f"{path}{sep}page={page}&per_page={page_size}"
        raw = _run_gh_with_retry([paged])
        if not raw:
            return
        items = json.loads(raw)
        if not isinstance(items, list) or not items:
            return
        for item in items:
            yield item
        if len(items) < page_size:
            return
        page += 1


# ---------------------------------------------------------------------------
# Finding — the rule output contract
# ---------------------------------------------------------------------------
class Severity(IntEnum):
    """Ordered so any FAIL dominates WARN, which dominates INFO."""

    INFO = 30
    WARN = 20
    FAIL = 10


SEVERITY_LABEL = {Severity.FAIL: "FAIL", Severity.WARN: "WARN", Severity.INFO: "INFO"}


@dataclass
class Finding:
    """A single rule result.

    `rule_id` is the stable identifier surfaced in CLI output (e.g. "P-30",
    "I-22b"). `line_hint` is optional because most checks operate on whole
    documents rather than specific lines.
    """

    rule_id: str
    severity: Severity
    message: str
    line_hint: Optional[int] = None

    def format(self) -> str:
        label = SEVERITY_LABEL[self.severity]
        prefix = f"{self.rule_id:<6} {label}"
        if self.line_hint is not None:
            prefix += f" L{self.line_hint}"
        return f"{prefix}\t{self.message}"


def aggregate_result(findings: list[Finding]) -> int:
    """Return process exit code for a run: 1 if any FAIL, else 0."""
    for finding in findings:
        if finding.severity is Severity.FAIL:
            return 1
    return 0


def print_findings(findings: list[Finding]) -> None:
    """Stable, diff-friendly output ordering: severity first, then rule_id."""
    for finding in sorted(
        findings, key=lambda f: (f.severity, f.rule_id, f.line_hint or 0)
    ):
        print(finding.format(), file=sys.stderr)
    print(
        f"RESULT: {'FAIL' if aggregate_result(findings) else 'ALL PASS'}",
        file=sys.stderr,
    )


# ---------------------------------------------------------------------------
# YAML loader
# ---------------------------------------------------------------------------
def load_yaml(path: str | Path) -> dict[str, Any]:
    """Load a YAML config file as a plain dict; empty file → {}.

    Raises FileNotFoundError if missing — callers decide whether that's fatal
    (a required spec) or skippable (an optional override).
    """
    p = Path(path)
    with p.open("r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh)
    return data or {}


def run_external(cmd: list[str], cwd: Optional[str | Path] = None) -> tuple[int, str]:
    """Run an external command, returning (exit_code, combined_output)."""
    proc = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=120)
    combined = (proc.stdout or "") + (proc.stderr or "")
    return proc.returncode, combined.strip()
