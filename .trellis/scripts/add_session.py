#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Add a new session to journal file and update index.md.

Usage:
    python3 add_session.py --title "Title" --commit "hash" --summary "Summary" [--package cli]
    python3 add_session.py --title "Title" --branch "feat/my-branch"

    # Pipe detailed content via stdin (use --stdin to opt in):
    cat << 'EOF' | python3 add_session.py --stdin --title "Title" --summary "Summary"
    <session content here>
    EOF

    # Structured content (repeatable; a section with no bullets is omitted):
    python3 add_session.py --title "Title" --change "Did X" --test "Ran Y" --next-step "Do Z"

    # Commit evidence that cannot be resolved from the local object database
    # (amended, not yet fetched) needs an explicit subject, one per OID:
    python3 add_session.py --title "Title" --commit "abc1234" \
        --commit-subject "abc1234=fix(cli): stop truncating the manifest"

Commit evidence:
    Every --commit token is a bounded hex OID (7-40 chars). Each one is
    resolved to its real subject from the local object database BEFORE
    anything is written. An OID that cannot be resolved fails the command
    before the journal or index is touched — no placeholder prose is ever
    recorded. Pass "-" (the default) for a planning session with no commits.

Retry convergence:
    The journal append, the index row and the optional auto-commit are one
    resumable operation. Every entry carries a fingerprint marker derived from
    its own inputs, so re-running an interrupted command repairs the pending
    record instead of appending a second one, and a failed auto-commit exits
    non-zero with the checkpoint to resume from. A record that is already
    committed is never reused: an identical later request is a new session
    unless an explicit --idempotency-key says otherwise.

Branch resolution order:
    1. --branch CLI arg (explicit)
    2. task.json branch field (from active task, if still exists)
    3. git branch --show-current (auto-detect)
    4. None (omitted gracefully)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime
from pathlib import Path

from common.paths import (
    DIR_TASKS,
    DIR_WORKFLOW,
    FILE_JOURNAL_PREFIX,
    get_repo_root,
    get_current_task,
    get_developer,
    get_workspace_dir,
)
from common.developer import ensure_developer
from common.git import branch_exists_locally, run_git
from common.io import write_text_atomic
from common.log import Colors, colored
from common.safe_commit import (
    print_gitignore_warning,
    safe_git_add,
    safe_trellis_paths_to_add,
)
from common.tasks import load_task
from common.types import TaskInfo
from common.config import (
    get_packages,
    get_session_auto_commit,
    get_session_commit_message,
    get_max_journal_lines,
    is_monorepo,
    resolve_package,
    validate_package,
)


# Bounded, argv-safe input shapes. Anything outside them is rejected during
# preflight, before a single byte is written.
COMMIT_TOKEN_RE = re.compile(r"^[0-9a-fA-F]{7,40}$")
IDEMPOTENCY_KEY_RE = re.compile(r"^[A-Za-z0-9._-]{1,64}$")
MAX_SUBJECT_LEN = 500

# Machine-readable record identity. An HTML comment renders as nothing, so the
# human evidence in the entry is unchanged by its presence.
MARKER_PREFIX = "<!-- trellis-session:"
# Bumped when the fingerprint inputs change. Untagged markers are v1, whose
# fingerprint mixed in the calendar date; see compute_record_fingerprint.
MARKER_VERSION = 2
LEGACY_MARKER_RE = re.compile(r"^<!-- trellis-session: fp=([0-9a-f]{16}) -->$")
ENTRY_DATE_RE = re.compile(r"^\*\*Date\*\*: (\d{4}-\d{2}-\d{2})\s*$")
SESSION_HEADING_RE = re.compile(r"^## Session (\d+):", re.MULTILINE)

# Recording states, in the order the operation walks them.
STATE_ABSENT = "absent"
STATE_JOURNAL_RECORDED = "journal-recorded"
STATE_INDEX_RECORDED = "index-recorded"
STATE_COMMITTED = "committed"

# Auto-commit outcomes.
COMMIT_DONE = "committed"
COMMIT_SKIPPED = "skipped"
COMMIT_BLOCKED = "blocked"
COMMIT_FAILED = "failed"

# Git probes against other refs are best-effort; never let one hang a session.
GIT_PROBE_TIMEOUT = 15.0
# Upper bound on the refs folded into session numbering. A repo with hundreds
# of stale branches must not turn session recording into a tree walk.
MAX_CONVERGENCE_REFS = 100


# =============================================================================
# Helper Functions
# =============================================================================

def get_latest_journal_info(dev_dir: Path) -> tuple[Path | None, int, int]:
    """Get latest journal file info.

    Returns:
        Tuple of (file_path, file_number, line_count).
    """
    latest_file: Path | None = None
    latest_num = -1

    for f in dev_dir.glob(f"{FILE_JOURNAL_PREFIX}*.md"):
        if not f.is_file():
            continue

        match = re.search(r"(\d+)$", f.stem)
        if match:
            num = int(match.group(1))
            if num > latest_num:
                latest_num = num
                latest_file = f

    if latest_file:
        lines = len(latest_file.read_text(encoding="utf-8").splitlines())
        return latest_file, latest_num, lines

    return None, 0, 0


def get_current_session(index_file: Path) -> int:
    """Get current session number from index.md."""
    if not index_file.is_file():
        return 0

    content = index_file.read_text(encoding="utf-8")
    return _max_session_in_index(content)


def _max_session_in_index(content: str) -> int:
    """Read the `Total Sessions` counter out of an index.md body."""
    for line in content.splitlines():
        if "Total Sessions" in line:
            match = re.search(r":\s*(\d+)", line)
            if match:
                return int(match.group(1))
    return 0


def _max_session_in_journal(content: str) -> int:
    """Highest `## Session N:` heading in a journal body (0 when none)."""
    numbers = [int(m.group(1)) for m in SESSION_HEADING_RE.finditer(content)]
    return max(numbers) if numbers else 0


def _extract_journal_num(filename: str) -> int:
    """Extract journal number from filename for sorting."""
    match = re.search(r"(\d+)", filename)
    return int(match.group(1)) if match else 0


def count_journal_files(dev_dir: Path, active_num: int) -> str:
    """Count journal files and return table rows."""
    active_file = f"{FILE_JOURNAL_PREFIX}{active_num}.md"
    result_lines = []

    files = sorted(
        [f for f in dev_dir.glob(f"{FILE_JOURNAL_PREFIX}*.md") if f.is_file()],
        key=lambda f: _extract_journal_num(f.stem),
        reverse=True
    )

    for f in files:
        filename = f.name
        lines = len(f.read_text(encoding="utf-8").splitlines())
        status = "Active" if filename == active_file else "Archived"
        result_lines.append(f"| `{filename}` | ~{lines} | {status} |")

    return "\n".join(result_lines)


def get_current_git_branch(repo_root: Path) -> str | None:
    """Return the current checkout branch, or None for detached/non-git states."""
    rc, branch_out, _ = run_git(["branch", "--show-current"], cwd=repo_root)
    if rc != 0:
        return None
    detected = branch_out.strip()
    return detected or None


def branch_ref_exists(repo_root: Path, branch: str) -> bool:
    """Return True when branch exists locally or as the local origin ref."""
    for ref in (f"refs/heads/{branch}", f"refs/remotes/origin/{branch}"):
        rc, _, _ = run_git(["show-ref", "--verify", "--quiet", ref], cwd=repo_root)
        if rc == 0:
            return True
    return False


def resolve_session_branch(
    repo_root: Path,
    cli_branch: str | None,
    task_data: TaskInfo | None,
) -> str | None:
    """Resolve journal branch without trusting stale task.json branch fields."""
    if cli_branch:
        return cli_branch

    current_branch = get_current_git_branch(repo_root)
    raw_task_branch = task_data.raw.get("branch") if task_data else None
    task_branch = raw_task_branch.strip() if isinstance(raw_task_branch, str) else ""
    if not task_branch:
        return current_branch

    if branch_ref_exists(repo_root, task_branch):
        return task_branch

    if current_branch:
        print(
            f"Warning: task.json branch '{task_branch}' no longer exists locally or as origin/{task_branch}; using current branch '{current_branch}'.",
            file=sys.stderr,
        )
        return current_branch

    print(
        f"Warning: task.json branch '{task_branch}' no longer exists locally or as origin/{task_branch}; omitting branch.",
        file=sys.stderr,
    )
    return None


def is_git_worktree(repo_root: Path) -> bool:
    """Return True when repo_root is a linked worktree (not the main working tree).

    Standard test: `git rev-parse --git-dir` (per-worktree) differs from
    `git rev-parse --git-common-dir` (shared across all worktrees) once both
    are resolved to absolute paths. In the main working tree these are the
    same directory.
    """
    rc_dir, git_dir, _ = run_git(["rev-parse", "--git-dir"], cwd=repo_root)
    rc_common, git_common_dir, _ = run_git(
        ["rev-parse", "--git-common-dir"], cwd=repo_root
    )
    if rc_dir != 0 or rc_common != 0:
        return False

    git_dir_path = (repo_root / git_dir.strip()).resolve()
    git_common_dir_path = (repo_root / git_common_dir.strip()).resolve()
    return git_dir_path != git_common_dir_path


def warn_if_parallel_worktree(repo_root: Path) -> None:
    """Non-blocking note: index.md conflicts across parallel worktrees/branches
    are expected and safe. Only fires when running in a linked git worktree
    (not the main tree) with `session_auto_commit` enabled (#415 quick-fix tier).
    """
    if not get_session_auto_commit(repo_root):
        return
    if not is_git_worktree(repo_root):
        return
    print(
        colored(
            "[NOTE] Running in a git worktree with session_auto_commit enabled: "
            "journal-*.md files auto-merge via .gitattributes, but index.md "
            "conflicts across parallel worktrees/branches are expected and safe "
            "to resolve by picking either side (task state lives in task.json, "
            "not index.md). See .trellis/spec/cli/backend/directory-structure.md "
            '("Workspace Journal Merge Behavior").',
            Colors.YELLOW,
        ),
        file=sys.stderr,
    )


def create_new_journal_file(
    dev_dir: Path, num: int, developer: str, today: str, max_lines: int = 2000,
) -> Path | None:
    """Create a new journal file. Returns None when the write fails."""
    prev_num = num - 1
    new_file = dev_dir / f"{FILE_JOURNAL_PREFIX}{num}.md"

    content = f"""# Journal - {developer} (Part {num})

> Continuation from `{FILE_JOURNAL_PREFIX}{prev_num}.md` (archived at ~{max_lines} lines)
> Started: {today}

---

"""
    if not write_text_atomic(new_file, content):
        return None
    return new_file


# =============================================================================
# Commit evidence (R1) — accurate subjects or nothing
# =============================================================================

def parse_commit_tokens(commit: str) -> tuple[list[str], str | None]:
    """Split --commit into bounded hex OIDs. Returns (tokens, error)."""
    raw = (commit or "").strip()
    if not raw or raw == "-":
        return [], None

    tokens: list[str] = []
    for part in raw.split(","):
        token = part.strip()
        if not token:
            continue
        if not COMMIT_TOKEN_RE.match(token):
            return [], (
                f"invalid --commit token '{token}': expected a 7-40 character hex "
                "commit OID, or '-' for a planning session with no commits"
            )
        token = token.lower()
        if token not in tokens:
            tokens.append(token)
    return tokens, None


def parse_subject_overrides(values: list[str] | None) -> tuple[dict[str, str], str | None]:
    """Parse `--commit-subject <oid>=<subject>` into a one-to-one mapping."""
    overrides: dict[str, str] = {}
    for raw in values or []:
        if "=" not in raw:
            return {}, (
                f"invalid --commit-subject '{raw}': expected <oid>=<subject>"
            )
        oid_part, subject = raw.split("=", 1)
        oid = oid_part.strip().lower()
        subject = subject.strip()
        if not COMMIT_TOKEN_RE.match(oid):
            return {}, (
                f"invalid --commit-subject key '{oid_part.strip()}': expected a "
                "7-40 character hex commit OID"
            )
        if not subject:
            return {}, f"invalid --commit-subject for '{oid}': subject is empty"
        if len(subject) > MAX_SUBJECT_LEN:
            return {}, (
                f"invalid --commit-subject for '{oid}': subject exceeds "
                f"{MAX_SUBJECT_LEN} characters"
            )
        if oid in overrides:
            return {}, f"duplicate --commit-subject mapping for '{oid}'"
        overrides[oid] = subject
    return overrides, None


def resolve_commit_subject(repo_root: Path, oid: str) -> str | None:
    """Resolve one OID to its subject from the local object database.

    Passed as argv (never interpolated into a shell) and peeled with
    ``^{commit}`` so a hex-looking ref name cannot resolve to a tree or tag.
    Returns None when the object is missing, ambiguous, or has no subject.
    """
    rc, out, _ = run_git(
        ["show", "-s", "--format=%s", f"{oid}^{{commit}}", "--"], cwd=repo_root
    )
    if rc != 0:
        return None
    for line in out.splitlines():
        subject = line.strip()
        if subject:
            return subject[:MAX_SUBJECT_LEN]
    return None


def build_commit_evidence(
    repo_root: Path,
    tokens: list[str],
    overrides: dict[str, str],
) -> tuple[list[tuple[str, str]], str | None]:
    """Pair every commit OID with an accurate subject, or fail.

    There is no placeholder path: an OID that neither resolves locally nor
    carries an explicit mapping stops the command before any mutation.
    """
    evidence: list[tuple[str, str]] = []
    unresolved: list[str] = []

    for oid in tokens:
        if oid in overrides:
            evidence.append((oid, overrides[oid]))
            continue
        subject = resolve_commit_subject(repo_root, oid)
        if subject is None:
            unresolved.append(oid)
            continue
        evidence.append((oid, subject))

    if unresolved:
        return [], (
            "cannot resolve commit evidence for: "
            + ", ".join(unresolved)
            + ". Fetch the objects, correct the OID, or pass the exact subject "
            "with --commit-subject <oid>=<subject>. Nothing was written."
        )

    unused = sorted(oid for oid in overrides if oid not in tokens)
    if unused:
        return [], (
            "--commit-subject supplied for OIDs that are not in --commit: "
            + ", ".join(unused)
            + ". The mapping must be one-to-one. Nothing was written."
        )

    return evidence, None


def escape_markdown_cell(text: str) -> str:
    """Make a commit subject safe inside a Markdown table cell."""
    collapsed = " ".join(text.split())
    return collapsed.replace("\\", "\\\\").replace("|", "\\|")


# =============================================================================
# Record identity (R2)
# =============================================================================

def _normalize_text(value: str | None) -> str:
    return " ".join((value or "").split())


def _fingerprint_payload(
    developer: str,
    title: str,
    summary: str,
    package: str | None,
    branch: str | None,
    evidence: list[tuple[str, str]],
    changes: list[str] | None,
    extra_content: str | None,
    tests: list[str] | None,
    next_steps: list[str] | None,
    idempotency_key: str | None,
) -> dict:
    """Normalized semantic inputs of one record, shared by both schemes."""
    return {
        "developer": developer,
        "title": _normalize_text(title),
        "summary": _normalize_text(summary),
        "package": package or "",
        "branch": branch or "",
        "commits": [[oid, _normalize_text(subject)] for oid, subject in evidence],
        "changes": [_normalize_text(c) for c in changes or []],
        "extra": _normalize_text(extra_content),
        "tests": [_normalize_text(t) for t in tests or []],
        "next_steps": [_normalize_text(n) for n in next_steps or []],
        "idempotency_key": idempotency_key or "",
    }


def _hash_payload(payload: dict) -> str:
    encoded = json.dumps(payload, sort_keys=True, ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()[:16]


def compute_record_fingerprint(payload: dict) -> str:
    """Bounded fingerprint over the normalized semantic inputs of one record.

    This is the retry key while the record is still pending in the worktree —
    not a global dedupe key. Two genuinely separate sessions with identical
    prose differ only if the caller says so, which is why an already-committed
    match is never adopted (see classify_record).

    Deliberately date-free (v2). v1 mixed in the calendar date, which made a
    record unfindable by its own retry across a midnight rollover: the journal
    and index were already written, the commit had failed, and the recomputed
    fingerprint no longer matched the marker sitting in the journal, so the
    retry appended a second entry for one session.

    Dropping the date cannot over-collapse two same-day sessions, because the
    date was equal for both of them anyway. Across days it only ever separated
    records with byte-identical prose, commits, branch and package — and a
    *committed* record of that shape is already refused for reuse by
    cmd_add_session, which steps to the next `generation` of the payload
    rather than reusing the committed marker. What is left
    is exactly the question this key should answer: is there an uncommitted
    record in this worktree matching these inputs?
    """
    return _hash_payload(payload)


def compute_legacy_fingerprint(payload: dict, date: str) -> str:
    """The v1 fingerprint, for resolving markers written before the change.

    Lookup only — nothing writes this scheme any more.
    """
    return _hash_payload({**payload, "date": date})


def render_marker(fingerprint: str) -> str:
    """Machine-readable record marker; renders as nothing in Markdown."""
    return f"{MARKER_PREFIX} v={MARKER_VERSION} fp={fingerprint} -->"


def render_legacy_marker(fingerprint: str) -> str:
    """The v1 marker form: no version tag. Read, never written."""
    return f"{MARKER_PREFIX} fp={fingerprint} -->"


# =============================================================================
# Session numbering (collision-proof across concurrent branches)
# =============================================================================

def _repo_relative(repo_root: Path, path: Path) -> str | None:
    try:
        return path.resolve().relative_to(repo_root.resolve()).as_posix()
    except (OSError, ValueError):
        return None


def _default_branch_local(repo_root: Path) -> str | None:
    """Resolve the default branch without ever touching the network.

    `resolve_default_branch()` falls back to `git remote show origin`, which
    can block on a fetch. Session recording is a hot path, so it stops at the
    local symbolic ref and the two conventional names.
    """
    rc, out, _ = run_git(
        ["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"],
        cwd=repo_root,
        timeout=GIT_PROBE_TIMEOUT,
    )
    if rc == 0 and out.strip():
        return out.strip().rsplit("/", 1)[-1]
    for candidate in ("main", "master"):
        if branch_exists_locally(candidate, repo_root):
            return candidate
    return None


def _convergence_refs(repo_root: Path) -> list[str]:
    """Refs whose recorded workspace state must be folded into the counter.

    Ordered by how much they matter, then capped: HEAD and the default branch
    first (the merge target every branch eventually meets), then every other
    local head — a parallel worktree's branch lives there and is the case that
    actually collided — then remote-tracking refs.
    """
    refs: list[str] = []

    def add(ref: str) -> None:
        if ref not in refs:
            refs.append(ref)

    rc, _, _ = run_git(["rev-parse", "--verify", "--quiet", "HEAD"], cwd=repo_root)
    if rc == 0:
        add("HEAD")

    default = _default_branch_local(repo_root)
    if default:
        for ref in (f"refs/heads/{default}", f"refs/remotes/origin/{default}"):
            rc, _, _ = run_git(
                ["show-ref", "--verify", "--quiet", ref], cwd=repo_root
            )
            if rc == 0:
                add(ref)

    for pattern in ("refs/heads/", "refs/remotes/"):
        rc, out, _ = run_git(
            ["for-each-ref", "--format=%(refname)", pattern],
            cwd=repo_root,
            timeout=GIT_PROBE_TIMEOUT,
        )
        if rc != 0:
            continue
        for line in out.splitlines():
            ref = line.strip()
            # A symbolic ref like refs/remotes/origin/HEAD is a duplicate of
            # the branch it points at and git grep rejects some of them.
            if ref and not ref.endswith("/HEAD"):
                add(ref)

    return refs[:MAX_CONVERGENCE_REFS]


def _max_session_across_refs(repo_root: Path, refs: list[str], dev_rel: str) -> int:
    """Highest session number recorded under `dev_rel` in any of `refs`.

    One `git grep` over every ref rather than an ls-tree + show per ref: the
    number of branches in a real repo is unbounded, the per-ref cost is not.
    Exit status 1 (no match) is a normal outcome, not an error.
    """
    if not refs:
        return 0

    rc, out, _ = run_git(
        [
            "grep",
            "--no-color",
            "-h",
            "-E",
            "-e",
            r"^## Session [0-9]+:",
            "-e",
            r"Total Sessions",
        ]
        + refs
        + ["--", dev_rel],
        cwd=repo_root,
        timeout=GIT_PROBE_TIMEOUT,
    )
    if rc > 1 or not out:
        return 0

    # `git grep` prefixes each hit with `<rev>:<path>:`, so the numbers are
    # matched anywhere in the line rather than anchored.
    numbers = [int(m.group(1)) for m in re.finditer(r"## Session (\d+):", out)]
    numbers += [
        int(m.group(1)) for m in re.finditer(r"Total Sessions[^\d]{0,8}(\d+)", out)
    ]
    return max(numbers) if numbers else 0


def max_local_session(dev_dir: Path, index_file: Path) -> int:
    """Highest session number visible in the working tree."""
    highest = get_current_session(index_file)
    for f in dev_dir.glob(f"{FILE_JOURNAL_PREFIX}*.md"):
        if not f.is_file():
            continue
        try:
            content = f.read_text(encoding="utf-8")
        except OSError:
            continue
        highest = max(highest, _max_session_in_journal(content))
    return highest


def resolve_next_session(repo_root: Path, dev_dir: Path, index_file: Path) -> int:
    """Next session number, converged across the local tree and other branches.

    Deriving the number from the working tree alone lets two branches that
    each record before merging claim the same number (observed twice on
    2026-08-06). Taking the union with every recorded ref — the default
    branch, and the other local heads a parallel worktree records on — makes
    the number monotonic across concurrent branches; `journal-*.md`
    merge=union then keeps both entries when the branches meet.
    """
    highest = max_local_session(dev_dir, index_file)

    dev_rel = _repo_relative(repo_root, dev_dir)
    if dev_rel:
        highest = max(
            highest,
            _max_session_across_refs(
                repo_root, _convergence_refs(repo_root), dev_rel
            ),
        )

    return highest + 1


# =============================================================================
# Pending-record classifier (R3/R4)
# =============================================================================

def find_marker_entries(dev_dir: Path, marker: str) -> list[tuple[Path, int | None]]:
    """Locate every journal entry carrying `marker`.

    Returns (journal_file, session_number); the number is None when the marker
    is not directly under a `## Session N:` heading, which is malformed
    pending evidence and must never be guessed into completion.
    """
    hits: list[tuple[Path, int | None]] = []
    for f in sorted(dev_dir.glob(f"{FILE_JOURNAL_PREFIX}*.md")):
        if not f.is_file():
            continue
        try:
            lines = f.read_text(encoding="utf-8").splitlines()
        except OSError:
            continue
        for i, line in enumerate(lines):
            if line.strip() != marker:
                continue
            session_num: int | None = None
            for j in range(i - 1, max(-1, i - 4), -1):
                match = SESSION_HEADING_RE.match(lines[j])
                if match:
                    session_num = int(match.group(1))
                    break
            hits.append((f, session_num))
    return hits


def content_at_head(repo_root: Path, path: Path) -> str | None:
    """File content as committed at HEAD, or None when it isn't there.

    The `./` prefix makes the path cwd-relative. `HEAD:<path>` alone is
    relative to the *git* toplevel, which is not always `repo_root` — the
    Trellis root is the nearest directory holding `.trellis/`, which can sit
    below the git root. Without it, every lookup in that layout fails and a
    committed record looks pending.
    """
    rel = _repo_relative(repo_root, path)
    if not rel:
        return None
    rc, out, _ = run_git(["show", f"HEAD:./{rel}"], cwd=repo_root)
    return out if rc == 0 else None


def index_has_session_row(index_file: Path, session_num: int) -> bool:
    """Whether the session-history block already holds this session's row."""
    if not index_file.is_file():
        return False
    try:
        lines = index_file.read_text(encoding="utf-8").splitlines()
    except OSError:
        return False

    row_re = re.compile(r"^\|\s*%d\s*\|" % session_num)
    in_history = False
    for line in lines:
        if "@@@auto:session-history" in line:
            in_history = True
            continue
        if "@@@/auto:session-history" in line:
            in_history = False
            continue
        if in_history and row_re.match(line):
            return True
    return False


def _entry_date_at(lines: list[str], marker_index: int) -> str | None:
    """The `**Date**:` value belonging to the entry whose marker is at `marker_index`.

    `generate_session_content` renders it two lines below the marker. Scanning
    a short window rather than a fixed offset keeps this working if blank-line
    spacing around the header ever changes, and stops well before it could
    reach the next entry.
    """
    for line in lines[marker_index + 1:marker_index + 6]:
        match = ENTRY_DATE_RE.match(line.strip())
        if match:
            return match.group(1)
    return None


def resolve_effective_marker(
    dev_dir: Path,
    payload: dict,
    marker: str,
) -> tuple[str, str | None]:
    """The marker this record actually carries, across both schemes.

    Returns (marker, error). The v2 marker wins whenever an entry carries it,
    which is every record written since the change and costs one scan.

    Otherwise this looks for a pending record written under v1. Those markers
    are only a hash, but the entry renders its own `**Date**:` line right
    below, so the date that produced the v1 fingerprint is recoverable from
    the entry itself: recompute with that date and compare against what is
    actually written there. That is exact, and unlike a +/-1 day window it does
    not quietly fail a retry resumed after a weekend.

    Returning the v1 marker leaves the entry untouched — it is an in-flight
    record about to be committed, and rewriting its marker mid-repair would
    move it to a state the machine does not model.
    """
    if find_marker_entries(dev_dir, marker):
        return marker, None

    matches: set[str] = set()
    for journal in sorted(dev_dir.glob(f"{FILE_JOURNAL_PREFIX}*.md")):
        if not journal.is_file():
            continue
        try:
            lines = journal.read_text(encoding="utf-8").splitlines()
        except OSError:
            continue
        for i, line in enumerate(lines):
            legacy = LEGACY_MARKER_RE.match(line.strip())
            if not legacy:
                continue
            date = _entry_date_at(lines, i)
            if date is None:
                continue
            if compute_legacy_fingerprint(payload, date) == legacy.group(1):
                matches.add(line.strip())

    if len(matches) > 1:
        return "", (
            f"found {len(matches)} pending journal entries matching this record "
            "under the pre-versioning marker scheme. Refusing to guess which one "
            "to resume — remove the duplicate entry or pass --idempotency-key to "
            "record a new session."
        )
    if matches:
        return matches.pop(), None
    return marker, None


def classify_record(
    repo_root: Path,
    dev_dir: Path,
    index_file: Path,
    marker: str,
) -> tuple[str, Path | None, int | None, str | None]:
    """Classify the current state of this exact record.

    Returns (state, journal_file, session_num, error). Only a unique, exact,
    still-uncommitted match is ever adopted; anything ambiguous, malformed or
    partially written comes back as an error so the caller fails safely.
    """
    hits = find_marker_entries(dev_dir, marker)

    if not hits:
        return STATE_ABSENT, None, None, None

    if len(hits) > 1:
        files = ", ".join(sorted({p.name for p, _ in hits}))
        return "", None, None, (
            f"found {len(hits)} journal entries carrying this record's marker "
            f"({files}). Refusing to guess which one to resume — remove the "
            "duplicate entry or pass --idempotency-key to record a new session."
        )

    journal_file, session_num = hits[0]
    if session_num is None:
        return "", None, None, (
            f"{journal_file.name} carries this record's marker without a "
            "'## Session N:' heading above it. The pending record is malformed; "
            "repair it by hand before retrying."
        )

    head_content = content_at_head(repo_root, journal_file)
    if head_content is not None and marker in head_content:
        return STATE_COMMITTED, journal_file, session_num, None

    if index_has_session_row(index_file, session_num):
        return STATE_INDEX_RECORDED, journal_file, session_num, None

    recorded_total = get_current_session(index_file)
    if recorded_total > session_num:
        return "", None, None, (
            f"journal entry for session {session_num} has no index row, but "
            f"index.md already counts {recorded_total} sessions. Repairing the "
            "row would rewrite a later record — resolve index.md by hand."
        )

    return STATE_JOURNAL_RECORDED, journal_file, session_num, None


# =============================================================================
# Rendering
# =============================================================================

def _render_bullet_section(header: str, items: list[str], bullet_prefix: str = "- ") -> str:
    """Render a Markdown section as bullets, or "" when there is no content.

    A section with zero provided values is omitted entirely from the
    rendered entry rather than falling back to a placeholder string.
    """
    if not items:
        return ""
    bullets = "\n".join(f"{bullet_prefix}{item}" for item in items)
    return f"\n\n### {header}\n\n{bullets}"


def _render_main_changes(changes: list[str], extra_content: str | None) -> str:
    """Render the Main Changes section from --change bullets or freeform content."""
    if changes:
        return _render_bullet_section("Main Changes", changes)
    if extra_content:
        return f"\n\n### Main Changes\n\n{extra_content}"
    return ""


def generate_session_content(
    session_num: int,
    title: str,
    evidence: list[tuple[str, str]],
    summary: str,
    today: str,
    marker: str,
    package: str | None = None,
    branch: str | None = None,
    changes: list[str] | None = None,
    extra_content: str | None = None,
    tests: list[str] | None = None,
    next_steps: list[str] | None = None,
) -> str:
    """Generate session content."""
    if evidence:
        commit_table = """| Hash | Message |
|------|---------|"""
        for oid, subject in evidence:
            commit_table += f"\n| `{oid}` | {escape_markdown_cell(subject)} |"
    else:
        commit_table = "(No commits - planning session)"

    package_line = f"\n**Package**: {package}" if package else ""
    branch_line = f"\n**Branch**: `{branch}`" if branch else ""

    main_changes_section = _render_main_changes(changes or [], extra_content)
    testing_section = _render_bullet_section("Testing", tests or [], bullet_prefix="- [OK] ")
    next_steps_section = _render_bullet_section("Next Steps", next_steps or [])

    return f"""

## Session {session_num}: {title}
{marker}

**Date**: {today}
**Task**: {title}{package_line}{branch_line}

### Summary

{summary}{main_changes_section}

### Git Commits

{commit_table}{testing_section}

### Status

[OK] **Completed**{next_steps_section}
"""


def format_commit_display(evidence: list[tuple[str, str]]) -> str:
    """Index-table rendering of the commit OIDs."""
    if not evidence:
        return "-"
    return ", ".join(f"`{oid}`" for oid, _ in evidence)


def update_index(
    index_file: Path,
    dev_dir: Path,
    title: str,
    evidence: list[tuple[str, str]],
    new_session: int,
    active_file: str,
    today: str,
    branch: str | None = None,
) -> bool:
    """Update index.md with new session info."""
    commit_display = format_commit_display(evidence)

    # Get file number from active_file name
    match = re.search(r"(\d+)", active_file)
    active_num = int(match.group(1)) if match else 0
    files_table = count_journal_files(dev_dir, active_num)

    print(f"Updating index.md for session {new_session}...")
    print(f"  Title: {title}")
    print(f"  Commit: {commit_display}")
    print(f"  Active File: {active_file}")
    print()

    content = index_file.read_text(encoding="utf-8")

    if "@@@auto:current-status" not in content:
        print("Error: Markers not found in index.md. Please ensure markers exist.", file=sys.stderr)
        return False

    # Process sections
    lines = content.splitlines()
    new_lines = []

    in_current_status = False
    in_active_documents = False
    in_session_history = False
    header_written = False

    for line in lines:
        if "@@@auto:current-status" in line:
            new_lines.append(line)
            in_current_status = True
            new_lines.append(f"- **Active File**: `{active_file}`")
            new_lines.append(f"- **Total Sessions**: {new_session}")
            new_lines.append(f"- **Last Active**: {today}")
            continue

        if "@@@/auto:current-status" in line:
            in_current_status = False
            new_lines.append(line)
            continue

        if "@@@auto:active-documents" in line:
            new_lines.append(line)
            in_active_documents = True
            new_lines.append("| File | Lines | Status |")
            new_lines.append("|------|-------|--------|")
            new_lines.append(files_table)
            continue

        if "@@@/auto:active-documents" in line:
            in_active_documents = False
            new_lines.append(line)
            continue

        if "@@@auto:session-history" in line:
            new_lines.append(line)
            in_session_history = True
            header_written = False
            continue

        if "@@@/auto:session-history" in line:
            in_session_history = False
            new_lines.append(line)
            continue

        if in_current_status:
            continue

        if in_active_documents:
            continue

        if in_session_history:
            # Migrate old 4/6-column headers to 5-column Branch-only history.
            if re.match(
                r"^\|\s*#\s*\|\s*Date\s*\|\s*Title\s*\|\s*Commits\s*\|\s*Branch\s*\|\s*Base Branch\s*\|\s*$",
                line,
            ):
                new_lines.append("| # | Date | Title | Commits | Branch |")
                continue
            if re.match(r"^\|\s*#\s*\|\s*Date\s*\|\s*Title\s*\|\s*Commits\s*\|\s*Branch\s*\|\s*$", line):
                new_lines.append("| # | Date | Title | Commits | Branch |")
                continue
            if re.match(r"^\|\s*#\s*\|\s*Date\s*\|\s*Title\s*\|\s*Commits\s*\|\s*$", line):
                new_lines.append("| # | Date | Title | Commits | Branch |")
                continue
            if re.match(r"^\|[-| ]+\|\s*$", line) and not header_written:
                new_lines.append("|---|------|-------|---------|--------|")
                new_lines.append(f"| {new_session} | {today} | {title} | {commit_display} | `{branch or '-'}` |")
                header_written = True
                continue
            new_lines.append(line)
            continue

        new_lines.append(line)

    if not write_text_atomic(index_file, "\n".join(new_lines)):
        print(f"Error: failed to write {index_file}", file=sys.stderr)
        return False
    print("[OK] Updated index.md successfully!")
    return True


# =============================================================================
# Main Function
# =============================================================================

def _auto_commit_workspace(repo_root: Path) -> str:
    """Stage Trellis-owned workspace + current-task paths and commit.

    Path scope is restricted to specific products: the current developer's
    journal files + index.md, and ONLY the current task directory (resolved
    via ``get_current_task``). We never `git add` the whole `.trellis/` tree
    or iterate over all active task dirs (#303: parallel-window dirty task
    dirs must not be bundled into the session auto-commit). If `.gitignore`
    blocks the specific paths we warn + skip — never retry with ``-f``.

    Honors ``session_auto_commit`` in ``.trellis/config.yaml``: when set to
    ``false``, this function returns immediately without touching git
    (journal/index files are still written to disk by the caller).

    Returns one of ``COMMIT_DONE`` / ``COMMIT_SKIPPED`` / ``COMMIT_BLOCKED`` /
    ``COMMIT_FAILED``. ``COMMIT_BLOCKED`` is the gitignored-`.trellis/` case:
    the user has told git to stay out of this tree, so it is a configured skip
    like ``session_auto_commit: false``, not a failure to retry.
    """
    if not get_session_auto_commit(repo_root):
        print(
            "[OK] session_auto_commit: false — skipping git stage/commit.",
            file=sys.stderr,
        )
        return COMMIT_SKIPPED

    # Not a git repository at all: like the gitignored case, this is an
    # environment the user configured, not a transient git error — a retry
    # can never succeed, so it must not be COMMIT_FAILED's exit-1 loop.
    rc, _, _ = run_git(["rev-parse", "--is-inside-work-tree"], cwd=repo_root)
    if rc != 0:
        print(
            "[WARN] Not a git repository — journal/index written, "
            "skipping auto-commit.",
            file=sys.stderr,
        )
        return COMMIT_BLOCKED

    commit_msg = get_session_commit_message(repo_root)
    # Resolve the current task so staging is scoped to its dir only. The ref
    # is ``.trellis/tasks/<name>`` (or under archive/) — pass the bare name.
    current = get_current_task(repo_root)
    if current:
        task_name = Path(current).name
        paths = safe_trellis_paths_to_add(repo_root, task_name=task_name)
    else:
        # Current task unknown (0 or >=2 parallel sessions — exactly the
        # parallel-window case #303 is about). Do NOT fall back to the wide
        # `tasks_dir.iterdir()` scan; that would re-leak other tasks' dirty
        # dirs into the session commit. Stage only the developer's journal/
        # index and skip every task dir.
        paths = [
            p
            for p in safe_trellis_paths_to_add(repo_root, task_name=None)
            if not p.startswith(f"{DIR_WORKFLOW}/{DIR_TASKS}/")
        ]
    if not paths:
        print("[OK] No workspace changes to commit.", file=sys.stderr)
        return COMMIT_SKIPPED

    success, _, err = safe_git_add(paths, repo_root)
    if not success:
        if err and "ignored by" in err.lower():
            print_gitignore_warning(paths)
            return COMMIT_BLOCKED
        print(
            f"[WARN] git add failed: {err.strip() if err else 'unknown error'}",
            file=sys.stderr,
        )
        return COMMIT_FAILED

    # Check if there are staged changes for the paths we just staged.
    rc, _, _ = run_git(
        ["diff", "--cached", "--quiet", "--", *paths], cwd=repo_root
    )
    if rc == 0:
        print("[OK] No workspace changes to commit.", file=sys.stderr)
        return COMMIT_SKIPPED

    # Commit with an explicit pathspec: a bare `git commit` would sweep any
    # unrelated entries the developer had staged before this script ran into
    # the chore commit (#579). The pathspec keeps their staged work untouched.
    rc, _, commit_err = run_git(
        ["commit", "-m", commit_msg, "--", *paths], cwd=repo_root
    )
    if rc == 0:
        print(f"[OK] Auto-committed: {commit_msg}", file=sys.stderr)
        return COMMIT_DONE

    print(
        f"[WARN] Auto-commit failed: {commit_err.strip()}",
        file=sys.stderr,
    )
    return COMMIT_FAILED


def _print_commit_checkpoint(session_num: int, journal_name: str) -> None:
    """Actionable checkpoint for a failed auto-commit (R5)."""
    print("", file=sys.stderr)
    print(
        f"[BLOCKED] Checkpoint: session {session_num} is recorded in "
        f"{journal_name} and index.md, but the auto-commit did not complete.",
        file=sys.stderr,
    )
    print(
        "[BLOCKED] The pending record was left exactly as written — nothing was "
        "rolled back.",
        file=sys.stderr,
    )
    print(
        "[BLOCKED] Fix the git error above, then re-run the identical "
        "add_session.py command: it resumes at the commit step and will not add "
        "a second session.",
        file=sys.stderr,
    )


def add_session(
    title: str,
    commit: str = "-",
    summary: str = "Session summary was not supplied.",
    changes: list[str] | None = None,
    extra_content: str | None = None,
    tests: list[str] | None = None,
    next_steps: list[str] | None = None,
    auto_commit: bool = True,
    package: str | None = None,
    branch: str | None = None,
    commit_subjects: list[str] | None = None,
    idempotency_key: str | None = None,
) -> int:
    """Add a new session, resuming an interrupted one instead of duplicating it."""
    repo_root = get_repo_root()
    warn_if_parallel_worktree(repo_root)
    ensure_developer(repo_root)

    developer = get_developer(repo_root)
    if not developer:
        print("Error: Developer not initialized", file=sys.stderr)
        return 1

    dev_dir = get_workspace_dir(repo_root)
    if not dev_dir:
        print("Error: Workspace directory not found", file=sys.stderr)
        return 1

    # -------------------------------------------------------------------
    # Preflight — no writes happen until every one of these succeeds.
    # -------------------------------------------------------------------
    if idempotency_key is not None and not IDEMPOTENCY_KEY_RE.match(idempotency_key):
        print(
            f"Error: invalid --idempotency-key '{idempotency_key}': expected 1-64 "
            "characters from [A-Za-z0-9._-]",
            file=sys.stderr,
        )
        return 1

    tokens, token_error = parse_commit_tokens(commit)
    if token_error:
        print(f"Error: {token_error}", file=sys.stderr)
        return 1

    overrides, override_error = parse_subject_overrides(commit_subjects)
    if override_error:
        print(f"Error: {override_error}", file=sys.stderr)
        return 1

    evidence, evidence_error = build_commit_evidence(repo_root, tokens, overrides)
    if evidence_error:
        print(f"Error: {evidence_error}", file=sys.stderr)
        return 1

    max_lines = get_max_journal_lines(repo_root)
    index_file = dev_dir / "index.md"
    today = datetime.now().strftime("%Y-%m-%d")

    payload = _fingerprint_payload(
        developer, title, summary, package, branch, evidence,
        changes, extra_content, tests, next_steps, idempotency_key,
    )
    marker = render_marker(compute_record_fingerprint(payload))

    # `today` is no longer a fingerprint input; a record has to be findable by
    # its own retry after a date rollover. It still dates the rendered entry.
    marker, resolve_error = resolve_effective_marker(dev_dir, payload, marker)
    if resolve_error:
        print(f"Error: {resolve_error}", file=sys.stderr)
        return 1

    state, matched_file, matched_num, classify_error = classify_record(
        repo_root, dev_dir, index_file, marker
    )
    if classify_error:
        print(f"Error: {classify_error}", file=sys.stderr)
        return 1

    if state == STATE_COMMITTED and idempotency_key:
        print(
            f"[OK] Session {matched_num} with idempotency key "
            f"'{idempotency_key}' is already recorded and committed in "
            f"{matched_file.name if matched_file else 'the journal'}; "
            "nothing to do.",
            file=sys.stderr,
        )
        return 0

    # A committed record is finished, so an identical later request is a
    # legitimately new session. It must not reuse the committed marker: two
    # entries carrying one marker make every later run ambiguous, and
    # classify_record refuses to guess between them. Step to the next
    # generation of this record instead. The marker stays a pure function of
    # (payload, generation), so a retry of the new entry recomputes the same
    # marker and still resumes; generation 0 omits the field entirely, leaving
    # first-time markers byte-identical to what this scheme already writes.
    generation = 0
    while state == STATE_COMMITTED:
        generation += 1
        marker = render_marker(
            compute_record_fingerprint({**payload, "generation": generation})
        )
        state, matched_file, matched_num, classify_error = classify_record(
            repo_root, dev_dir, index_file, marker
        )
        if classify_error:
            print(f"Error: {classify_error}", file=sys.stderr)
            return 1

    print("========================================", file=sys.stderr)
    print("ADD SESSION", file=sys.stderr)
    print("========================================", file=sys.stderr)
    print("", file=sys.stderr)

    # -------------------------------------------------------------------
    # Absent → journal-recorded
    # -------------------------------------------------------------------
    target_file: Path | None
    target_num: int
    new_session: int

    if state == STATE_ABSENT:
        journal_file, current_num, current_lines = get_latest_journal_info(dev_dir)
        new_session = resolve_next_session(repo_root, dev_dir, index_file)

        session_content = generate_session_content(
            new_session, title, evidence, summary, today, marker, package, branch,
            changes=changes, extra_content=extra_content, tests=tests,
            next_steps=next_steps,
        )
        content_lines = len(session_content.splitlines())

        print(f"Session: {new_session}", file=sys.stderr)
        print(f"Title: {title}", file=sys.stderr)
        print(f"Commit: {format_commit_display(evidence)}", file=sys.stderr)
        print("", file=sys.stderr)
        print(f"Current journal file: {FILE_JOURNAL_PREFIX}{current_num}.md", file=sys.stderr)
        print(f"Current lines: {current_lines}", file=sys.stderr)
        print(f"New content lines: {content_lines}", file=sys.stderr)
        print(f"Total after append: {current_lines + content_lines}", file=sys.stderr)
        print("", file=sys.stderr)

        target_file = journal_file
        target_num = current_num

        if current_lines + content_lines > max_lines:
            target_num = current_num + 1
            print(f"[!] Exceeds {max_lines} lines, creating {FILE_JOURNAL_PREFIX}{target_num}.md", file=sys.stderr)
            target_file = create_new_journal_file(dev_dir, target_num, developer, today, max_lines)
            if target_file is None:
                print(
                    f"Error: failed to create {FILE_JOURNAL_PREFIX}{target_num}.md; "
                    "nothing was recorded.",
                    file=sys.stderr,
                )
                return 1
            print(f"Created: {target_file}", file=sys.stderr)

        if target_file is None:
            print(
                "Error: no journal file to append to. Run init_developer.py first.",
                file=sys.stderr,
            )
            return 1

        try:
            existing = target_file.read_text(encoding="utf-8") if target_file.is_file() else ""
        except OSError as exc:
            print(f"Error: cannot read {target_file}: {exc}", file=sys.stderr)
            return 1

        if not write_text_atomic(target_file, existing + session_content):
            print(
                f"Error: failed to append the session to {target_file.name}; "
                "the previous journal content is intact and nothing was recorded.",
                file=sys.stderr,
            )
            return 1
        print(f"[OK] Appended session to {target_file.name}", file=sys.stderr)
        state = STATE_JOURNAL_RECORDED
    else:
        if matched_file is None or matched_num is None:
            print(
                f"Error: resumed state '{state}' without a matching journal entry.",
                file=sys.stderr,
            )
            return 1
        target_file = matched_file
        new_session = matched_num
        target_num = _extract_journal_num(target_file.stem)
        print(
            f"[RESUME] Session {new_session} is already in {target_file.name} and "
            f"uncommitted; continuing from '{state}' instead of appending again.",
            file=sys.stderr,
        )
        print("", file=sys.stderr)

    print("", file=sys.stderr)

    # -------------------------------------------------------------------
    # Journal-recorded → index-recorded
    # -------------------------------------------------------------------
    active_file = f"{FILE_JOURNAL_PREFIX}{target_num}.md"
    if state == STATE_JOURNAL_RECORDED:
        if not update_index(
            index_file,
            dev_dir,
            title,
            evidence,
            new_session,
            active_file,
            today,
            branch,
        ):
            print(
                f"[BLOCKED] Checkpoint: session {new_session} is in "
                f"{active_file} but index.md was not updated. Fix index.md, then "
                "re-run the identical command to repair the row without adding a "
                "second session.",
                file=sys.stderr,
            )
            return 1
        state = STATE_INDEX_RECORDED
    else:
        print(f"[OK] index.md already records session {new_session}.", file=sys.stderr)

    print("", file=sys.stderr)
    print("========================================", file=sys.stderr)
    print(f"[OK] Session {new_session} added successfully!", file=sys.stderr)
    print("========================================", file=sys.stderr)
    print("", file=sys.stderr)
    print("Files updated:", file=sys.stderr)
    print(f"  - {target_file.name if target_file else 'journal'}", file=sys.stderr)
    print("  - index.md", file=sys.stderr)

    # -------------------------------------------------------------------
    # Index-recorded → committed
    # -------------------------------------------------------------------
    if not auto_commit:
        return 0

    print("", file=sys.stderr)
    outcome = _auto_commit_workspace(repo_root)

    if outcome == COMMIT_FAILED:
        _print_commit_checkpoint(
            new_session, target_file.name if target_file else "the journal"
        )
        return 1

    if outcome == COMMIT_DONE and target_file is not None:
        committed = content_at_head(repo_root, target_file)
        if committed is None or marker not in committed:
            print(
                f"[WARN] Auto-commit reported success but {target_file.name} at "
                "HEAD does not contain this session's record.",
                file=sys.stderr,
            )
            _print_commit_checkpoint(new_session, target_file.name)
            return 1

    return 0


# =============================================================================
# Main Entry
# =============================================================================

def main() -> int:
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Add a new session to journal file and update index.md"
    )
    parser.add_argument("--title", required=True, help="Session title")
    parser.add_argument(
        "--commit",
        default="-",
        help=(
            "Comma-separated commit OIDs (7-40 hex chars each). Each one is "
            "resolved to its real subject before anything is written; an "
            "unresolvable OID fails the command. Use '-' for a planning session."
        ),
    )
    parser.add_argument(
        "--commit-subject",
        action="append",
        metavar="OID=SUBJECT",
        help=(
            "Explicit subject for a commit that cannot be resolved locally "
            "(repeatable). The mapping must be one-to-one with --commit."
        ),
    )
    parser.add_argument("--summary", default="Session summary was not supplied.", help="Brief summary")
    parser.add_argument("--content-file", help="Path to file with detailed content")
    parser.add_argument("--package", help="Package name tag (e.g., cli, docs-site)")
    parser.add_argument("--branch", help="Branch name (auto-detected if omitted)")
    parser.add_argument("--change", action="append", help="Main Changes bullet (repeatable)")
    parser.add_argument("--test", action="append", help="Testing bullet (repeatable)")
    parser.add_argument("--next-step", action="append", help="Next Steps bullet (repeatable)")
    parser.add_argument(
        "--idempotency-key",
        help=(
            "Caller-supplied retry key ([A-Za-z0-9._-], 1-64 chars). Makes an "
            "already-committed identical record a no-op instead of a new session."
        ),
    )
    parser.add_argument("--no-commit", action="store_true",
                        help="Skip auto-commit of workspace changes")
    parser.add_argument("--stdin", action="store_true",
                        help="Read extra content from stdin (explicit opt-in)")

    args = parser.parse_args()

    extra_content: str | None = None
    if args.content_file:
        content_path = Path(args.content_file)
        if content_path.is_file():
            extra_content = content_path.read_text(encoding="utf-8")
    elif args.stdin:
        extra_content = sys.stdin.read()

    # Load active task once — shared by package and branch resolution
    repo_root = get_repo_root()
    current = get_current_task(repo_root)
    task_data = load_task(repo_root / current) if current else None

    package = args.package
    if package:
        # CLI source: fail-fast in monorepo, ignore in single-repo
        if not is_monorepo(repo_root):
            print("Warning: --package ignored in single-repo project", file=sys.stderr)
            package = None
        elif not validate_package(package, repo_root):
            packages = get_packages(repo_root)
            available = ", ".join(sorted(packages.keys())) if packages else "(none)"
            print(f"Error: unknown package '{package}'. Available: {available}", file=sys.stderr)
            return 1
    else:
        # Inferred: active task's task.json.package → default_package → None
        task_package = task_data.package if task_data else None
        package = resolve_package(task_package, repo_root)

    branch = resolve_session_branch(repo_root, args.branch, task_data)

    return add_session(
        args.title, args.commit, args.summary,
        changes=args.change, extra_content=extra_content, tests=args.test,
        next_steps=args.next_step,
        auto_commit=not args.no_commit,
        package=package,
        branch=branch,
        commit_subjects=args.commit_subject,
        idempotency_key=args.idempotency_key,
    )


if __name__ == "__main__":
    sys.exit(main())
