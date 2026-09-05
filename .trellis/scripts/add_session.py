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

Branch resolution order:
    1. --branch CLI arg (explicit)
    2. task.json branch field (from active task)
    3. git branch --show-current (auto-detect)
    4. None (omitted gracefully)
"""

from __future__ import annotations

import argparse
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
from common.git import run_git
from common.safe_commit import (
    print_gitignore_warning,
    safe_git_add,
    safe_trellis_paths_to_add,
)
from common.tasks import load_task
from common.config import (
    get_packages,
    get_session_auto_commit,
    get_session_commit_message,
    get_max_journal_lines,
    is_monorepo,
    resolve_package,
    validate_package,
)


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
    for line in content.splitlines():
        if "Total Sessions" in line:
            match = re.search(r":\s*(\d+)", line)
            if match:
                return int(match.group(1))
    return 0


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


def create_new_journal_file(
    dev_dir: Path, num: int, developer: str, today: str, max_lines: int = 2000,
) -> Path:
    """Create a new journal file."""
    prev_num = num - 1
    new_file = dev_dir / f"{FILE_JOURNAL_PREFIX}{num}.md"

    content = f"""# Journal - {developer} (Part {num})

> Continuation from `{FILE_JOURNAL_PREFIX}{prev_num}.md` (archived at ~{max_lines} lines)
> Started: {today}

---

"""
    new_file.write_text(content, encoding="utf-8")
    return new_file


def generate_session_content(
    session_num: int,
    title: str,
    commit: str,
    summary: str,
    extra_content: str,
    today: str,
    package: str | None = None,
    branch: str | None = None,
) -> str:
    """Generate session content."""
    if commit and commit != "-":
        commit_table = """| Hash | Message |
|------|---------|"""
        for c in commit.split(","):
            c = c.strip()
            commit_table += f"\n| `{c}` | (see git log) |"
    else:
        commit_table = "(No commits - planning session)"

    package_line = f"\n**Package**: {package}" if package else ""
    branch_line = f"\n**Branch**: `{branch}`" if branch else ""

    return f"""

## Session {session_num}: {title}

**Date**: {today}
**Task**: {title}{package_line}{branch_line}

### Summary

{summary}

### Main Changes

{extra_content}

### Git Commits

{commit_table}

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
"""


def update_index(
    index_file: Path,
    dev_dir: Path,
    title: str,
    commit: str,
    new_session: int,
    active_file: str,
    today: str,
    branch: str | None = None,
) -> bool:
    """Update index.md with new session info."""
    # Format commit for display
    commit_display = "-"
    if commit and commit != "-":
        commit_display = re.sub(r"([a-f0-9]{7,})", r"`\1`", commit.replace(",", ", "))

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

    index_file.write_text("\n".join(new_lines), encoding="utf-8")
    print("[OK] Updated index.md successfully!")
    return True


# =============================================================================
# Main Function
# =============================================================================

def _auto_commit_workspace(repo_root: Path) -> None:
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
    """
    if not get_session_auto_commit(repo_root):
        print(
            "[OK] session_auto_commit: false — skipping git stage/commit.",
            file=sys.stderr,
        )
        return

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
        return

    success, _, err = safe_git_add(paths, repo_root)
    if not success:
        if err and "ignored by" in err.lower():
            print_gitignore_warning(paths)
        else:
            print(
                f"[WARN] git add failed: {err.strip() if err else 'unknown error'}",
                file=sys.stderr,
            )
        return

    # Check if there are staged changes for the paths we just staged.
    rc, _, _ = run_git(
        ["diff", "--cached", "--quiet", "--", *paths], cwd=repo_root
    )
    if rc == 0:
        print("[OK] No workspace changes to commit.", file=sys.stderr)
        return

    rc, _, commit_err = run_git(["commit", "-m", commit_msg], cwd=repo_root)
    if rc == 0:
        print(f"[OK] Auto-committed: {commit_msg}", file=sys.stderr)
    else:
        print(
            f"[WARN] Auto-commit failed: {commit_err.strip()}",
            file=sys.stderr,
        )


def add_session(
    title: str,
    commit: str = "-",
    summary: str = "(Add summary)",
    extra_content: str = "(Add details)",
    auto_commit: bool = True,
    package: str | None = None,
    branch: str | None = None,
) -> int:
    """Add a new session."""
    repo_root = get_repo_root()
    ensure_developer(repo_root)

    developer = get_developer(repo_root)
    if not developer:
        print("Error: Developer not initialized", file=sys.stderr)
        return 1

    dev_dir = get_workspace_dir(repo_root)
    if not dev_dir:
        print("Error: Workspace directory not found", file=sys.stderr)
        return 1

    max_lines = get_max_journal_lines(repo_root)

    index_file = dev_dir / "index.md"
    today = datetime.now().strftime("%Y-%m-%d")

    journal_file, current_num, current_lines = get_latest_journal_info(dev_dir)
    current_session = get_current_session(index_file)
    new_session = current_session + 1

    session_content = generate_session_content(
        new_session, title, commit, summary, extra_content, today, package,
        branch,
    )
    content_lines = len(session_content.splitlines())

    print("========================================", file=sys.stderr)
    print("ADD SESSION", file=sys.stderr)
    print("========================================", file=sys.stderr)
    print("", file=sys.stderr)
    print(f"Session: {new_session}", file=sys.stderr)
    print(f"Title: {title}", file=sys.stderr)
    print(f"Commit: {commit}", file=sys.stderr)
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
        print(f"Created: {target_file}", file=sys.stderr)

    # Append session content
    if target_file:
        with target_file.open("a", encoding="utf-8") as f:
            f.write(session_content)
        print(f"[OK] Appended session to {target_file.name}", file=sys.stderr)

    print("", file=sys.stderr)

    # Update index.md
    active_file = f"{FILE_JOURNAL_PREFIX}{target_num}.md"
    if not update_index(
        index_file,
        dev_dir,
        title,
        commit,
        new_session,
        active_file,
        today,
        branch,
    ):
        return 1

    print("", file=sys.stderr)
    print("========================================", file=sys.stderr)
    print(f"[OK] Session {new_session} added successfully!", file=sys.stderr)
    print("========================================", file=sys.stderr)
    print("", file=sys.stderr)
    print("Files updated:", file=sys.stderr)
    print(f"  - {target_file.name if target_file else 'journal'}", file=sys.stderr)
    print("  - index.md", file=sys.stderr)

    # Auto-commit workspace changes
    if auto_commit:
        print("", file=sys.stderr)
        _auto_commit_workspace(repo_root)

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
    parser.add_argument("--commit", default="-", help="Comma-separated commit hashes")
    parser.add_argument("--summary", default="(Add summary)", help="Brief summary")
    parser.add_argument("--content-file", help="Path to file with detailed content")
    parser.add_argument("--package", help="Package name tag (e.g., cli, docs-site)")
    parser.add_argument("--branch", help="Branch name (auto-detected if omitted)")
    parser.add_argument("--no-commit", action="store_true",
                        help="Skip auto-commit of workspace changes")
    parser.add_argument("--stdin", action="store_true",
                        help="Read extra content from stdin (explicit opt-in)")

    args = parser.parse_args()

    extra_content = "(Add details)"
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

    # Resolve branch: CLI → task.json → git auto-detect → None
    branch = args.branch

    if not branch:
        if task_data and task_data.raw.get("branch"):
            branch = task_data.raw["branch"]
        else:
            _, branch_out, _ = run_git(["branch", "--show-current"], cwd=repo_root)
            detected = branch_out.strip()
            if detected:
                branch = detected

    return add_session(
        args.title, args.commit, args.summary, extra_content,
        auto_commit=not args.no_commit,
        package=package,
        branch=branch,
    )


if __name__ == "__main__":
    sys.exit(main())
