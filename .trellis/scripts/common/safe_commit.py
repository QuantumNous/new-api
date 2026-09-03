"""
Safe git-add helpers for Trellis-owned paths.

Why this module exists
----------------------
A real user incident: a project's `.gitignore` listed `.trellis/` (company-wide
template / personal habit). When `add_session.py` and `task.py archive` ran
their auto-commit and `git add` failed with `ignored by .gitignore`, the AI
agent driving the workflow "fixed" it by retrying with
`git add -f .trellis/` — which fan-out-included every ignored subtree
(`.trellis/.backup-*/`, `.trellis/worktrees/`, `.trellis/.template-hashes.json`,
`.trellis/.runtime/`), committing 548 files / 83474 lines of caches/backups.

Design
------
- Scripts only stage SPECIFIC product paths (journal files, index.md, the
  current task dir, the archive dir). Never the whole `.trellis/` tree.
- If plain `git add <specific>` fails with "ignored by", DO NOT retry with
  ``-f``. The presence of `.trellis/` in `.gitignore` is treated as user
  intent ("keep .trellis/ local-only"). The script warns and skips the
  auto-commit; users who want auto-staging can either fix their `.gitignore`
  or set ``session_auto_commit: false`` and manage git themselves.
- The warning includes a negative example: ``Do NOT use `git add -f .trellis/` ...``
  so any AI rereading the log doesn't reinvent the bug.

History note: 0.5.10 introduced an automatic ``git add -f`` retry on the
specific paths. That was reverted in 0.5.11 — auto-forcing into a tree the
user had gitignored violates user intent even when the path list is narrow.
The wider-grain forbidden command stays forbidden, and the narrow-grain auto
``-f`` is gone too.
"""

from __future__ import annotations

import sys
from pathlib import Path

from .git import run_git
from .paths import (
    DIR_ARCHIVE,
    DIR_TASKS,
    DIR_WORKFLOW,
    DIR_WORKSPACE,
    FILE_JOURNAL_PREFIX,
    get_developer,
)


# Paths under .trellis/ that must NEVER be auto-staged. Listed here so the
# warning to the user can show concrete subpaths to ignore individually
# instead of ignoring the whole `.trellis/` tree.
TRELLIS_IGNORED_SUBPATHS = (
    ".trellis/.backup-*",
    ".trellis/worktrees/",
    ".trellis/.template-hashes.json",
    ".trellis/.runtime/",
    ".trellis/.cache/",
)


def safe_trellis_paths_to_add(
    repo_root: Path,
    task_name: str | None = None,
) -> list[str]:
    """Return the list of repo-relative paths the auto-commit should stage.

    Only includes paths that exist on disk so callers don't pass non-existent
    arguments to git. The caller is responsible for `git diff --cached`
    checking afterwards.

    Included:
      - .trellis/workspace/<developer>/journal-*.md
      - .trellis/workspace/<developer>/index.md
      - .trellis/tasks/<task_name>/   (ONLY the current task dir when
        ``task_name`` is passed; plus its archive location if the task
        already lives under archive/)

    Excluded (intentionally — these must not be staged):
      - .trellis/.backup-*, .trellis/worktrees/,
        .trellis/.template-hashes.json, .trellis/.runtime/, .trellis/.cache/

    Scope contract (see #303 / break-loop analysis): when ``task_name`` is
    passed, the task segment stages ONLY that task directory — it never walks
    ``tasks_dir.iterdir()`` over all active tasks. This mirrors
    :func:`safe_archive_paths_to_add` and prevents dirty changes in OTHER
    parallel-window task dirs from being bundled into the session auto-commit.

    Backwards-compat: with no ``task_name``, the function walks every active
    task directory (+ the archive subtree) the old wide way. New callers
    should always pass ``task_name``.
    """
    paths: list[str] = []

    # Workspace journal files + index.md
    developer = get_developer(repo_root)
    if developer:
        ws = repo_root / DIR_WORKFLOW / DIR_WORKSPACE / developer
        if ws.is_dir():
            for f in sorted(ws.glob(f"{FILE_JOURNAL_PREFIX}*.md")):
                if f.is_file():
                    paths.append(
                        f"{DIR_WORKFLOW}/{DIR_WORKSPACE}/{developer}/{f.name}"
                    )
            index_md = ws / "index.md"
            if index_md.is_file():
                paths.append(
                    f"{DIR_WORKFLOW}/{DIR_WORKSPACE}/{developer}/index.md"
                )

    tasks_dir = repo_root / DIR_WORKFLOW / DIR_TASKS
    if not tasks_dir.is_dir():
        return paths

    if task_name is not None:
        # Narrow scope — ONLY the current task directory (active or archived).
        # Never iterdir() all tasks: parallel-window dirty task dirs must not
        # leak into the session auto-commit.
        active_task = tasks_dir / task_name
        if active_task.is_dir():
            paths.append(f"{DIR_WORKFLOW}/{DIR_TASKS}/{task_name}")
        archived_task = tasks_dir / DIR_ARCHIVE / task_name
        if archived_task.is_dir():
            paths.append(
                f"{DIR_WORKFLOW}/{DIR_TASKS}/{DIR_ARCHIVE}/{task_name}"
            )
        return paths

    # Legacy wide scope (no task_name): each direct child of tasks/ that is a
    # directory and not the archive root, plus the whole archive subtree.
    for child in sorted(tasks_dir.iterdir()):
        if not child.is_dir():
            continue
        if child.name == DIR_ARCHIVE:
            continue
        paths.append(f"{DIR_WORKFLOW}/{DIR_TASKS}/{child.name}")

    archive_dir = tasks_dir / DIR_ARCHIVE
    if archive_dir.is_dir():
        paths.append(f"{DIR_WORKFLOW}/{DIR_TASKS}/{DIR_ARCHIVE}")

    return paths


def safe_archive_paths_to_add(
    repo_root: Path,
    task_name: str | None = None,
    modified_children: list[str] | None = None,
) -> list[str]:
    """Return paths to stage after `task.py archive`.

    Scoped to ONLY the paths the archive operation actually touched:

      - the archive subtree (where the freshly-moved task lives)
      - the source task directory (for source-side deletes; caller pairs
        this with `git rm --cached` since `git add` won't stage deletes
        for a path that no longer exists in the working tree)
      - any child task directories whose `task.json` was edited to drop
        the archived parent (parent-children relationship update)

    This narrow scope avoids "scope creep" — dirty changes in OTHER
    active task dirs (parallel-window edits) are NOT bundled into the
    archive commit. Callers handle each kind of change in its own
    commit boundary.

    Backwards-compat: with no arguments, the function walks the whole
    `.trellis/tasks/` subtree the old way (active tasks + archive). New
    callers should always pass `task_name`.
    """
    paths: list[str] = []
    tasks_dir = repo_root / DIR_WORKFLOW / DIR_TASKS
    if not tasks_dir.is_dir():
        return paths

    archive_dir = tasks_dir / DIR_ARCHIVE

    if task_name is not None:
        # Narrow scope — only paths that still exist on disk (so
        # `git add` doesn't choke on the moved-away source). The caller
        # handles the source-side deletes via `git rm --cached`
        # explicitly.
        if archive_dir.is_dir():
            paths.append(
                f"{DIR_WORKFLOW}/{DIR_TASKS}/{DIR_ARCHIVE}"
            )
        for child_name in modified_children or []:
            paths.append(f"{DIR_WORKFLOW}/{DIR_TASKS}/{child_name}")
        return paths

    # Legacy wide scope (no task_name): preserve old behavior so callers
    # that have not been updated keep working.
    if archive_dir.is_dir():
        paths.append(f"{DIR_WORKFLOW}/{DIR_TASKS}/{DIR_ARCHIVE}")
    for child in sorted(tasks_dir.iterdir()):
        if not child.is_dir():
            continue
        if child.name == DIR_ARCHIVE:
            continue
        paths.append(f"{DIR_WORKFLOW}/{DIR_TASKS}/{child.name}")
    return paths


def _stderr_indicates_ignored(stderr: str) -> bool:
    """git add error indicates the path is excluded by .gitignore."""
    if not stderr:
        return False
    lowered = stderr.lower()
    return "ignored by" in lowered


def safe_git_add(
    paths: list[str], repo_root: Path
) -> tuple[bool, bool, str]:
    """Run `git add` on specific paths; never retry with -f.

    Returns ``(success, used_force, stderr)``. The ``used_force`` field is
    kept for signature compatibility with the 0.5.10 implementation but is
    always ``False`` — we never auto-force.

    Behavior:
      - No paths passed → success, no force, empty stderr.
      - Plain ``git add -- <paths>`` succeeds → return success.
      - Plain fails (any reason — ignored or otherwise) → return failure with
        the stderr. Callers should inspect the stderr (see
        :func:`print_gitignore_warning`) and skip the auto-commit.
    """
    if not paths:
        return True, False, ""

    rc, _, err = run_git(["add", "--", *paths], cwd=repo_root)
    if rc == 0:
        return True, False, ""
    return False, False, err


def print_gitignore_warning(paths: list[str]) -> None:
    """Explain to the user (and any AI reading the log) what to do.

    CRITICAL: includes the negative example
    ``Do NOT use `git add -f .trellis/``` — agents reading the warning are
    known to invent that command, which fans out to ignored caches/backups.
    """
    print(
        "[WARN] git add failed because .trellis/ paths are ignored by your .gitignore.",
        file=sys.stderr,
    )
    print(
        "[WARN] Skipping auto-commit. The journal/task files were still written to disk;",
        file=sys.stderr,
    )
    print(
        "[WARN] git was not touched.",
        file=sys.stderr,
    )
    print("[WARN]", file=sys.stderr)
    print(
        "[WARN] Trellis manages these specific paths and they should be tracked:",
        file=sys.stderr,
    )
    if paths:
        for p in paths:
            print(f"[WARN]   {p}", file=sys.stderr)
    else:
        print(
            "[WARN]   .trellis/workspace/<developer>/{journal-*.md,index.md}",
            file=sys.stderr,
        )
        print(
            "[WARN]   .trellis/tasks/<task-dir>/",
            file=sys.stderr,
        )
        print(
            "[WARN]   .trellis/tasks/archive/",
            file=sys.stderr,
        )
    print("[WARN]", file=sys.stderr)
    print(
        "[WARN] Recommended: change your .gitignore from `.trellis/` to specific",
        file=sys.stderr,
    )
    print(
        "[WARN] subpaths that should remain ignored, e.g.:",
        file=sys.stderr,
    )
    for sub in TRELLIS_IGNORED_SUBPATHS:
        print(f"[WARN]   {sub}", file=sys.stderr)
    print("[WARN]", file=sys.stderr)
    print(
        "[WARN] Or, if you intentionally keep .trellis/ local-only, set in",
        file=sys.stderr,
    )
    print(
        "[WARN] .trellis/config.yaml:",
        file=sys.stderr,
    )
    print(
        "[WARN]   session_auto_commit: false",
        file=sys.stderr,
    )
    print(
        "[WARN] so the scripts skip git entirely and you can review / commit",
        file=sys.stderr,
    )
    print(
        "[WARN] manually with `git status` / `git add` / `git commit`.",
        file=sys.stderr,
    )
    print("[WARN]", file=sys.stderr)
    print(
        "[WARN] Do NOT use `git add -f .trellis/` — it pulls in backups, worktrees,",
        file=sys.stderr,
    )
    print(
        "[WARN] and runtime caches that should never be committed.",
        file=sys.stderr,
    )
