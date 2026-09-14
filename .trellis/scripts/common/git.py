"""
Git command execution utility.

Single source of truth for running git commands across all Trellis scripts.
"""

from __future__ import annotations

import subprocess
import time
from pathlib import Path


# Bounded retry for transient `.git/index.lock` contention. Another process
# (IDE git integration, status daemon, a concurrent Trellis session) can hold
# the lock for a fraction of a second; three attempts spread over ~1.5s ride
# that out without making a genuinely stuck lock hang the command. One sleep
# per retry, so the attempt count follows the backoff tuple.
INDEX_LOCK_RETRY_BACKOFF = (0.5, 1.0)
INDEX_LOCK_RETRY_ATTEMPTS = len(INDEX_LOCK_RETRY_BACKOFF) + 1

# Whether a checkout is a linked worktree cannot change while a script runs, and
# the answer costs two subprocesses. Developer-identity resolution asks several
# times per command whenever the local `.developer` file is absent, so memoize.
_CACHE_MISS = object()
_MAIN_WORKTREE_CACHE: dict[Path, Path | None] = {}


def run_git(
    args: list[str],
    cwd: Path | None = None,
    timeout: float | None = None,
) -> tuple[int, str, str]:
    """Run a git command and return (returncode, stdout, stderr).

    Uses UTF-8 encoding with -c i18n.logOutputEncoding=UTF-8 to ensure
    consistent output across all platforms (Windows, macOS, Linux). Callers
    may provide a timeout for best-effort probes; normal Git operations remain
    unbounded by default.
    """
    try:
        git_args = ["git", "-c", "i18n.logOutputEncoding=UTF-8"] + args
        result = subprocess.run(
            git_args,
            cwd=cwd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
        )
        return result.returncode, result.stdout, result.stderr
    except Exception as e:
        return 1, "", str(e)


def stderr_indicates_index_lock(stderr: str) -> bool:
    """git failed because another process holds `.git/index.lock`."""
    if not stderr:
        return False
    return "index.lock" in stderr.lower()


def run_git_retry_index_lock(
    args: list[str],
    cwd: Path | None = None,
    timeout: float | None = None,
) -> tuple[int, str, str]:
    """Run a git command, retrying only while `.git/index.lock` is held.

    Any other non-zero exit returns immediately — a retry loop around real
    failures (bad path, nothing to commit, hook rejection) just delays the
    error. Returns the last (returncode, stdout, stderr).
    """
    rc, out, err = run_git(args, cwd=cwd, timeout=timeout)
    attempt = 1
    while (
        rc != 0
        and attempt < INDEX_LOCK_RETRY_ATTEMPTS
        and stderr_indicates_index_lock(err)
    ):
        time.sleep(INDEX_LOCK_RETRY_BACKOFF[attempt - 1])
        attempt += 1
        rc, out, err = run_git(args, cwd=cwd, timeout=timeout)
    return rc, out, err


def index_lock_path(repo_root: Path) -> str:
    """Path of the lock file git is contending on, for diagnostics.

    Asks git so worktrees and `GIT_DIR` setups name the real file rather
    than a `.git/` guess that does not exist there.
    """
    rc, out, _ = run_git(["rev-parse", "--git-path", "index.lock"], cwd=repo_root)
    if rc == 0 and out.strip():
        return out.strip()
    return ".git/index.lock"


def resolve_default_branch(repo_root: Path) -> str | None:
    """Resolve the repository's default branch (origin/HEAD target).

    Tries the local `refs/remotes/origin/HEAD` symbolic ref first (no
    network access), then falls back to `git remote show origin` (which
    may hit the network but also repairs a missing/stale symbolic-ref).
    Returns None when neither resolves, so callers can fall back to their
    own pre-existing behavior.
    """
    rc, out, _ = run_git(["symbolic-ref", "refs/remotes/origin/HEAD"], cwd=repo_root)
    if rc == 0 and out.strip():
        return out.strip().rsplit("/", 1)[-1]

    rc, out, _ = run_git(["remote", "show", "origin"], cwd=repo_root)
    if rc == 0:
        for line in out.splitlines():
            line = line.strip()
            if line.startswith("HEAD branch:"):
                branch = line.split(":", 1)[1].strip()
                if branch and branch != "(unknown)":
                    return branch

    return None


def current_branch_name(repo_root: Path) -> str | None:
    """Return the checked-out branch name, or None when there isn't one.

    Empty output covers detached HEAD and "not a git repository" alike, and
    callers treat both the same way: there is no branch worth recording.
    """
    rc, out, _ = run_git(["branch", "--show-current"], cwd=repo_root)
    if rc != 0:
        return None
    return out.strip() or None


def has_git_remote(repo_root: Path) -> bool:
    """Whether the repository has at least one configured remote."""
    rc, out, _ = run_git(["remote"], cwd=repo_root)
    return rc == 0 and bool(out.strip())


def main_worktree_root(repo_root: Path) -> Path | None:
    """Root of the main working tree when `repo_root` is a linked worktree.

    Returns None in the main working tree itself, outside a git repository, and
    for a linked worktree of a bare repository (no main checkout to point at).

    `git worktree list --porcelain` reports the main working tree as its first
    record, so git identifies it rather than this code deriving it from the
    `.git` layout. Deriving it — taking the parent of `--git-common-dir` — is
    wrong for a bare repository that happens to sit inside an unrelated
    checkout (`~/repos/project.git` under a `~/repos` that is itself a repo):
    the parent is a real checkout with a real `.developer`, so the guess is
    indistinguishable from a hit and identity leaks across repositories.
    """
    cached = _MAIN_WORKTREE_CACHE.get(repo_root, _CACHE_MISS)
    if cached is not _CACHE_MISS:
        return cached  # type: ignore[return-value]

    result = _probe_main_worktree_root(repo_root)
    _MAIN_WORKTREE_CACHE[repo_root] = result
    return result


def _probe_main_worktree_root(repo_root: Path) -> Path | None:
    rc_list, listing, _ = run_git(["worktree", "list", "--porcelain"], cwd=repo_root)
    rc_top, toplevel, _ = run_git(["rev-parse", "--show-toplevel"], cwd=repo_root)
    if rc_list != 0 or rc_top != 0:
        return None

    lines = listing.splitlines()
    if not lines or not lines[0].startswith("worktree "):
        return None

    # Records are blank-line separated; a `bare` attribute on the first one
    # means the "main working tree" is a bare repo with nothing to inherit.
    for line in lines[1:]:
        if not line.strip():
            break
        if line.strip() == "bare":
            return None

    try:
        main_root = Path(lines[0][len("worktree ") :].strip()).resolve()
        current_root = Path(toplevel.strip()).resolve()
    except (OSError, ValueError):
        return None

    if main_root == current_root:
        return None
    return main_root


def branch_exists_locally(branch: str, repo_root: Path) -> bool:
    """Check whether a local branch ref exists in the repository."""
    if not branch:
        return False
    rc, _, _ = run_git(
        ["rev-parse", "--verify", "--quiet", f"refs/heads/{branch}"],
        cwd=repo_root,
    )
    return rc == 0
