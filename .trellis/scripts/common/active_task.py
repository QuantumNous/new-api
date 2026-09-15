#!/usr/bin/env python3
"""Session-scoped active task resolution.

The user-facing concept is a single "active task". Trellis stores that pointer
per AI session/window under `.trellis/.runtime/sessions/`; without a stable
session key there is no active task.
"""

from __future__ import annotations

import hashlib
import os
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .io import read_json as _io_read_json, write_json as _io_write_json

DIR_WORKFLOW = ".trellis"
DIR_TASKS = "tasks"
DIR_RUNTIME = ".runtime"
DIR_SESSIONS = "sessions"
DIR_SHELL_TICKETS = "shell-tickets"
# Pre-0.6.13 name, when the bridge was Cursor-only. Still read so a session that
# was mid-command across an upgrade does not silently degrade; never written.
# Tickets are 30-second ephemera, so the old directory ages out by itself —
# there is nothing to migrate, only a glob on a directory that is normally
# absent. The alternative (ignore it) would land its one lost command on the
# platform that works today.
DIR_LEGACY_CURSOR_SHELL_TICKETS = "cursor-shell"
SHELL_TICKET_TTL_SECONDS = 30
TASK_SESSION_COMMANDS = {"start", "current", "finish"}

_SESSION_KEYS = ("session_id", "sessionId", "sessionID")
_CONVERSATION_KEYS = ("conversation_id", "conversationId", "conversationID")
_TRANSCRIPT_KEYS = ("transcript_path", "transcriptPath", "transcript")
_NESTED_KEYS = ("input", "properties", "event", "hook_input", "hookInput")
_KNOWN_PLATFORMS = {
    "claude",
    "codex",
    "cursor",
    "opencode",
    "gemini",
    "droid",
    "qoder",
    "codebuddy",
    "kiro",
    "copilot",
    "pi",
    "trae",
    "grok",
    "kimi",
    "zcode",
    "snow",
    "dsh",
}

# Every name below records how it was checked. Do NOT add a name by analogy
# with a neighbour: a 2026-08-05 audit of all 21 platforms found 12 of the 21
# declared names had never existed anywhere — they were pattern-guessed from a
# `<PLATFORM>_SESSION_ID` shape no vendor agreed to, and the uniformity was the
# only "evidence" behind them. A platform with no verified name belongs in no
# table; it resolves through TRELLIS_CONTEXT_ID or its hook/plugin bridge.
_ENV_SESSION_KEYS: tuple[tuple[str, tuple[str, ...]], ...] = (
    # REAL (reported 2026-08-13 against DSH 0.1.0-rc.6 by @SajoLuo, from a live
    # run: DSH exports DSH_SESSION_ID plus DSH_SHELL=1 into its managed shell).
    # MUST STAY FIRST. A DSH session can inherit an outer host's identity — a
    # DSH launched from Codex still carries CODEX_THREAD_ID — and the untargeted
    # lookup below walks this table in order, so any earlier entry would claim
    # the session and write a foreign `codex_<thread>` pointer for DSH work.
    # DSH_SESSION_ID is the only name here no other vendor sets, so first place
    # is safe: it cannot mis-claim a non-DSH session.
    ("dsh", ("DSH_SESSION_ID",)),
    # REAL, undocumented (verified 2026-08-05 in a live Claude Code 2.1.221 bash
    # child; absent from code.claude.com/docs/en/env-vars). CLAUDE_SESSION_ID
    # was removed here — verified absent from that same live environment.
    ("claude", ("CLAUDE_CODE_SESSION_ID",)),
    # REAL, undocumented (verified 2026-08-05: injected by codex-cli 0.146.0
    # into shell children, absent from the parent env; openai/codex#19937).
    # CODEX_SESSION_ID was removed — absent from a live `codex exec` env.
    ("codex", ("CODEX_THREAD_ID",)),
    # REAL but HOOK-SCOPE ONLY (verified 2026-08-05): set by Gemini's
    # hookRunner.ts. Its shell tool builds the child env in
    # shellExecutionService.ts and adds only GEMINI_CLI/TERM/PAGER/GIT_PAGER, so
    # this never reaches a bash child — it resolves only inside a hook process.
    ("gemini", ("GEMINI_SESSION_ID",)),
    # REAL but HOOK-SCOPE ONLY (verified 2026-08-05): docs.qoder.com/zh/
    # extensions/hooks documents it as injected during hook execution by the
    # Qoder *IDE plugin*. Absent from the Qoder CLI hook docs and from Lingma.
    ("qoder", ("QODER_SESSION_ID",)),
    # UNVERIFIED (2026-08-05): absent from kiro.dev/docs/hooks/, but Dynatrace
    # dtctl, oh-my-agent and gastown all key agent detection on it and one notes
    # it is "set in both interactive and --no-interactive". Kept because that is
    # absence of evidence, not evidence of absence. To settle: run
    # `env | grep KIRO` from a Kiro shell-tool call on a machine with Kiro.
    ("kiro", ("KIRO_SESSION_ID",)),
    # UNVERIFIED (2026-08-05): absent from docs.github.com/en/copilot/reference/
    # hooks-reference and from the CLI programmatic reference. To settle: run
    # `copilot help environment` (the authoritative list per those docs) — not
    # runnable here, the CLI is not installed and copilot-cli ships no source.
    ("copilot", ("COPILOT_SESSION_ID", "COPILOT_SESSIONID")),
    # REASONED, UNVERIFIED (2026-08-05): ZCode is closed-source and not
    # installable here. It mirrors Claude's naming elsewhere (CLAUDE_PLUGIN_ROOT
    # / CLAUDE_PLUGIN_DATA compat aliases are in its docs), and the previously
    # declared CLAUDE_SESSION_ID does not exist on Claude Code either — so the
    # name ZCode would actually reuse is CLAUDE_CODE_SESSION_ID. Try that first,
    # keep the historical name as a fallback: if neither exists nothing changes.
    # Platform-scoped lookup (_iter_env_keys filters by platform name), so the
    # entry only fires once the resolver detected "zcode" — no collision with
    # the claude entry above.
    ("zcode", ("CLAUDE_CODE_SESSION_ID", "CLAUDE_SESSION_ID")),
    # REAL by vendor design (verified 2026-08-05): Snow's sessionIdentityEnv.ts
    # exports SNOW_SESSION_ID into hook/terminal/sub-agent children and names
    # Trellis in its source header. TRELLIS_CONTEXT_ID stays the preferred
    # override — Snow sets that too.
    ("snow", ("SNOW_SESSION_ID",)),
)
_ENV_CONVERSATION_KEYS: tuple[tuple[str, tuple[str, ...]], ...] = (
    # REAL in cursor-agent (CLI), undocumented (verified 2026-08-05: the value
    # matches ~/.cursor/chats/<ws>/<id>). The Cursor *IDE* is unverified — a
    # 2026-05 forum request for it drew no staff reply. The invented
    # CURSOR_SESSION_ID was removed from the session table: empty in a live
    # cursor-agent shell. Cursor's other path is the shell ticket below
    # (_lookup_shell_ticket_context_key), which is not Cursor-specific.
    ("cursor", ("CURSOR_CONVERSATION_ID", "CURSOR_CONVERSATIONID")),
)
_ENV_TRANSCRIPT_KEYS: tuple[tuple[str, tuple[str, ...]], ...] = (
    # REAL but HOOK-SCOPE ONLY (verified 2026-08-05): documented for Cursor hook
    # scripts; empty in the agent's own shell env.
    ("cursor", ("CURSOR_TRANSCRIPT_PATH",)),
    # UNVERIFIED — never researched. The 2026-08-05 audit covered the session
    # table only, so do not infer these are real *or* fake from that work
    # (CLAUDE_/CODEX_TRANSCRIPT_PATH were removed because those two *were*
    # checked: absent from docs and from live envs). To settle each: run
    # `env | grep _TRANSCRIPT_PATH` inside a hook and inside a shell-tool call.
    ("gemini", ("GEMINI_TRANSCRIPT_PATH",)),
    ("droid", ("FACTORY_TRANSCRIPT_PATH", "DROID_TRANSCRIPT_PATH")),
    ("qoder", ("QODER_TRANSCRIPT_PATH",)),
    ("codebuddy", ("CODEBUDDY_TRANSCRIPT_PATH",)),
)
_ENV_PLATFORM_ALIASES = {
    "claude-code": "claude",
    "factory": "droid",
    "factory-ai": "droid",
    "github-copilot": "copilot",
}
# ZCode intentionally reuses Claude's session env var name. Hooks know the host
# is ZCode, while later shell commands see only the shared env name and resolve
# it through the claude entry. Canonicalize both paths to one runtime filename.
_CONTEXT_KEY_PLATFORM_ALIASES = {
    "zcode": "claude",
    # Factory Droid's config directory is `.factory/`, so a hook that names its
    # platform after the directory it was installed in reports "factory". Its
    # sibling hooks report "droid". One runtime filename either way.
    "factory": "droid",
}


@dataclass(frozen=True)
class ActiveTask:
    """Resolved active task state."""

    task_path: str | None
    source_type: str
    context_key: str | None = None
    stale: bool = False

    @property
    def source(self) -> str:
        """Human-readable source label."""
        if self.source_type == "session" and self.context_key:
            return f"session:{self.context_key}"
        if self.source_type == "session-fallback" and self.context_key:
            return f"session-fallback:{self.context_key}"
        return self.source_type


def normalize_task_ref(task_ref: str) -> str:
    """Normalize a task ref for stable storage and comparison."""
    normalized = task_ref.strip()
    if not normalized:
        return ""

    path_obj = Path(normalized)
    if path_obj.is_absolute():
        return str(path_obj)

    normalized = normalized.replace("\\", "/")
    while normalized.startswith("./"):
        normalized = normalized[2:]

    if normalized.startswith(f"{DIR_TASKS}/"):
        return f"{DIR_WORKFLOW}/{normalized}"

    return normalized


def resolve_task_ref(task_ref: str, repo_root: Path) -> Path | None:
    """Resolve a task ref to an absolute task directory inside the repo.

    Mirrors `paths.resolve_task_ref` (same containment check). Duplicated
    rather than imported because this module is loaded standalone — hooks add
    it to `sys.path` directly — so it stays zero-relative-import on purpose.
    """
    normalized = normalize_task_ref(task_ref)
    if not normalized:
        return None

    try:
        root = repo_root.resolve()
    except OSError:
        return None

    path_obj = Path(normalized)
    if path_obj.is_absolute():
        candidate = path_obj
    elif normalized.startswith(f"{DIR_WORKFLOW}/"):
        candidate = root / path_obj
    else:
        candidate = root / DIR_WORKFLOW / DIR_TASKS / path_obj

    # Both sides are resolved because repo_root itself may sit behind a
    # symlink (/tmp on macOS does), and resolve() is what collapses `..`
    # instead of leaving it for a lexical relative_to() to wave through.
    try:
        resolved = candidate.resolve()
        workflow_real = (root / DIR_WORKFLOW).resolve()
    except OSError:
        return None

    try:
        resolved.relative_to(root)
        return resolved
    except ValueError:
        pass

    # `.trellis` may itself be a symlink into a store outside the repo (#567).
    # The workflow dir's own real location is then a second legitimate
    # containment base; a ref that escapes BOTH bases is still refused. Map
    # back to the in-repo (lexical) form so callers store a repo-relative ref.
    try:
        rel = resolved.relative_to(workflow_real)
    except ValueError:
        return None

    return root / DIR_WORKFLOW / rel


def _runtime_sessions_dir(repo_root: Path) -> Path:
    return repo_root / DIR_WORKFLOW / DIR_RUNTIME / DIR_SESSIONS


def _sanitize_key(raw: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", raw.strip())
    safe = safe.strip("._-")
    return safe[:160] if safe else ""


def _hash_value(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]


def _as_dict(value: Any) -> dict[str, Any] | None:
    return value if isinstance(value, dict) else None


def _string_value(value: Any) -> str | None:
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return None


def _lookup_string(data: dict[str, Any], keys: tuple[str, ...]) -> str | None:
    for key in keys:
        value = _string_value(data.get(key))
        if value:
            return value

    for nested_key in _NESTED_KEYS:
        nested = _as_dict(data.get(nested_key))
        if not nested:
            continue
        value = _lookup_string(nested, keys)
        if value:
            return value

    return None


def _detect_platform(platform_input: dict[str, Any] | None, platform: str | None) -> str:
    if platform:
        return _sanitize_key(platform) or "session"
    if platform_input:
        for key in ("_trellis_platform", "trellis_platform", "platform", "source"):
            value = _string_value(platform_input.get(key))
            if value:
                return _sanitize_key(value) or "session"
        if _string_value(platform_input.get("cursor_version")):
            return "cursor"
    return "session"


def _context_key(platform_name: str, kind: str, value: str) -> str:
    platform_name = _CONTEXT_KEY_PLATFORM_ALIASES.get(platform_name, platform_name)
    if kind == "transcript":
        return f"{platform_name}_transcript_{_hash_value(value)}"
    safe_value = _sanitize_key(value)
    if safe_value:
        return f"{platform_name}_{safe_value}"
    return f"{platform_name}_{_hash_value(value)}"


def _iter_env_keys(
    env_keys: tuple[tuple[str, tuple[str, ...]], ...],
    platform_name: str | None,
) -> tuple[tuple[str, tuple[str, ...]], ...]:
    """Narrow an env-key table to one platform, or return all of it.

    A platform with no entry yields an empty tuple, and the caller's `for` loop
    simply does not run. That is the normal case, not an error: platforms with
    no verified env var name are deliberately absent from these tables.
    """
    if not platform_name:
        return env_keys
    matched = tuple((name, keys) for name, keys in env_keys if name == platform_name)
    return matched


def _env_platform_name(platform_name: str | None) -> str | None:
    if not platform_name or platform_name == "session":
        return None
    return _ENV_PLATFORM_ALIASES.get(platform_name, platform_name)


def _lookup_env_context_key(platform_name: str | None) -> str | None:
    """Resolve a context key from platform-provided environment variables.

    Hooks pass `TRELLIS_CONTEXT_ID` to subprocesses they launch, but an AI-run
    shell command can only see session identity if the host platform exports it
    in the command environment. These names are best-effort adapters; if none
    are present, there is no session-scoped active task.
    """
    env_platform_name = _env_platform_name(platform_name)

    for name, keys in _iter_env_keys(_ENV_SESSION_KEYS, env_platform_name):
        for key in keys:
            value = _string_value(os.environ.get(key))
            if value:
                return _context_key(name, "session", value)

    for name, keys in _iter_env_keys(_ENV_CONVERSATION_KEYS, env_platform_name):
        for key in keys:
            value = _string_value(os.environ.get(key))
            if value:
                return _context_key(name, "conversation", value)

    for name, keys in _iter_env_keys(_ENV_TRANSCRIPT_KEYS, env_platform_name):
        for key in keys:
            value = _string_value(os.environ.get(key))
            if value:
                return _context_key(name, "transcript", value)

    return None


def _find_repo_root_from_cwd() -> Path | None:
    current = Path.cwd().resolve()
    while True:
        if (current / DIR_WORKFLOW).is_dir():
            return current
        if current == current.parent:
            return None
        current = current.parent


def _shell_ticket_dirs(repo_root: Path) -> tuple[Path, ...]:
    runtime_dir = repo_root / DIR_WORKFLOW / DIR_RUNTIME
    return (
        runtime_dir / DIR_SHELL_TICKETS,
        runtime_dir / DIR_LEGACY_CURSOR_SHELL_TICKETS,
    )


def _remove_file(path: Path) -> bool:
    try:
        path.unlink()
        return True
    except OSError:
        return False


def _task_refs_match(left: str | None, right: str | None, repo_root: Path) -> bool:
    if not left or not right:
        return False
    left_path = resolve_task_ref(left, repo_root)
    right_path = resolve_task_ref(right, repo_root)
    if left_path is not None and right_path is not None:
        return left_path == right_path
    return normalize_task_ref(left) == normalize_task_ref(right)


def _pending_ticket_matches_args(ticket: dict[str, Any], repo_root: Path) -> bool:
    if Path(sys.argv[0]).name != "task.py":
        return False
    args = tuple(sys.argv[1:])
    if not args:
        return False

    command_name = args[0]
    if command_name not in TASK_SESSION_COMMANDS:
        return False

    subcommands = ticket.get("subcommands")
    if not isinstance(subcommands, list):
        return False

    for subcommand in subcommands:
        if not isinstance(subcommand, dict):
            continue
        if _string_value(subcommand.get("name")) != command_name:
            continue
        if command_name != "start":
            return True
        task_ref = args[1] if len(args) > 1 else None
        if _task_refs_match(_string_value(subcommand.get("task_ref")), task_ref, repo_root):
            return True

    return False


def _ticket_is_fresh(ticket: dict[str, Any], ticket_path: Path, now: float) -> bool:
    expires_at = ticket.get("expires_at_epoch")
    if isinstance(expires_at, (int, float)) and expires_at < now:
        _remove_file(ticket_path)
        return False

    created_at = ticket.get("created_at_epoch")
    if isinstance(created_at, (int, float)):
        if now - created_at <= SHELL_TICKET_TTL_SECONDS:
            return True
        _remove_file(ticket_path)
        return False
    return True


def _ticket_cwd_matches_repo(ticket: dict[str, Any], repo_root: Path) -> bool:
    cwd = _string_value(ticket.get("cwd"))
    if not cwd:
        return True
    try:
        Path(cwd).resolve().relative_to(repo_root)
    except ValueError:
        return False
    return True


def _matching_ticket_context_key(
    ticket_path: Path,
    repo_root: Path,
    now: float,
) -> str | None:
    """Accept a ticket on its merits, never on which platform wrote it.

    The `platform` field a ticket carries is debugging metadata; gating on it
    was what kept this bridge invisible to every platform but Cursor.
    """
    ticket = _read_json(ticket_path)
    if ticket is None:
        return None
    if not _ticket_is_fresh(ticket, ticket_path, now):
        return None
    if not _ticket_cwd_matches_repo(ticket, repo_root):
        return None
    if not _pending_ticket_matches_args(ticket, repo_root):
        return None
    return _string_value(ticket.get("context_key"))


def _lookup_shell_ticket_context_key() -> str | None:
    """Resolve session identity from a short-lived shell ticket.

    No researched platform exports its session id into a shell child, but every
    hook-capable one hands that id to a hook. So the hook that runs just before
    a shell command writes a ticket, and this reads it back. A ticket counts
    only when it is fresh, was written for this repo, and matches the `task.py`
    subcommand now running — and only when exactly one fresh context key
    matches. Two concurrent windows therefore both degrade rather than one
    inheriting the other's pointer.
    """
    repo_root = _find_repo_root_from_cwd()
    if repo_root is None:
        return None

    now = time.time()
    candidates: set[str] = set()
    for ticket_dir in _shell_ticket_dirs(repo_root):
        if not ticket_dir.is_dir():
            continue
        for ticket_path in ticket_dir.glob("*.json"):
            context_key = _matching_ticket_context_key(ticket_path, repo_root, now)
            if context_key:
                candidates.add(context_key)

    if len(candidates) == 1:
        return next(iter(candidates))
    return None


def resolve_context_key(
    platform_input: dict[str, Any] | None = None,
    platform: str | None = None,
    *,
    allow_environment_context: bool = True,
) -> str | None:
    """Resolve a stable session/window context key, if one is available.

    `TRELLIS_CONTEXT_ID` is an explicit context-key override used by CLI
    scripts and subprocesses. It does not store the task itself.
    """
    if allow_environment_context:
        override = _string_value(os.environ.get("TRELLIS_CONTEXT_ID"))
        if override:
            return _sanitize_key(override) or _hash_value(override)

    data = _as_dict(platform_input)
    platform_name = _detect_platform(data, platform) if data or platform else None

    if data:
        session_id = _lookup_string(data, _SESSION_KEYS)
        if session_id:
            return _context_key(platform_name or "session", "session", session_id)

        conversation_id = _lookup_string(data, _CONVERSATION_KEYS)
        if conversation_id:
            return _context_key(platform_name or "session", "conversation", conversation_id)

        transcript_path = _lookup_string(data, _TRANSCRIPT_KEYS)
        if transcript_path:
            return _context_key(platform_name or "session", "transcript", transcript_path)

    if allow_environment_context:
        env_context_key = _lookup_env_context_key(platform_name)
        if env_context_key:
            return env_context_key

    # Last in the chain on purpose: a platform that genuinely exports identity
    # into the shell outranks a ticket, and no platform name gates the lookup.
    if allow_environment_context:
        return _lookup_shell_ticket_context_key()
    return None


def _read_json(path: Path) -> dict[str, Any] | None:
    """Tolerant read of a session runtime file, non-objects included."""
    data = _io_read_json(path)
    return data if isinstance(data, dict) else None


def _write_json(path: Path, data: dict[str, Any]) -> bool:
    """Write a session runtime file atomically, creating the runtime dir.

    Routes through io.write_json so session pointers get the same
    temp-file-then-rename treatment as task.json (#429). A plain write_text
    truncates the target first, so a crash mid-write would leave a session
    file that reads back as no active task.
    """
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
    except OSError:
        return False
    return _io_write_json(path, data)


def _canonical_task_ref(task_path: str, repo_root: Path) -> str | None:
    normalized = normalize_task_ref(task_path)
    if not normalized:
        return None
    full_path = resolve_task_ref(normalized, repo_root)
    if full_path is None or not full_path.is_dir():
        return None
    try:
        return full_path.relative_to(repo_root.resolve()).as_posix()
    except ValueError:
        # resolve_task_ref already refused everything outside the repo, so this
        # is unreachable. Refuse rather than fall back to an absolute path —
        # that fallback is how an out-of-repo ref used to reach the session
        # pointer and get replayed on every later turn.
        return None


def _relative_task_ref(task_path: str, repo_root: Path) -> str:
    """Repo-relative posix ref for a task path that need not exist.

    `_canonical_task_ref` resolves through the filesystem and so refuses a task
    directory that has been moved away. Rename needs to name both sides of the
    move, one of which is always absent.
    """
    normalized = normalize_task_ref(task_path)
    if not normalized:
        return ""
    candidate = Path(normalized)
    if not candidate.is_absolute():
        return normalized
    try:
        resolved = candidate.resolve()
        root = repo_root.resolve()
        workflow_real = (root / DIR_WORKFLOW).resolve()
    except OSError:
        return ""
    try:
        return resolved.relative_to(root).as_posix()
    except ValueError:
        pass
    # Same dual-base containment as resolve_task_ref: a path through a
    # symlinked `.trellis` (#567) maps back to its in-repo form; anything
    # outside both bases is refused rather than stored as an absolute pointer.
    try:
        rel = resolved.relative_to(workflow_real)
    except ValueError:
        return ""
    return (Path(DIR_WORKFLOW) / rel).as_posix()


def _active_from_ref(
    task_ref: str | None,
    repo_root: Path,
    source_type: str,
    context_key: str | None = None,
) -> ActiveTask | None:
    if not task_ref:
        return None
    resolved = resolve_task_ref(task_ref, repo_root)
    stale = resolved is None or not resolved.is_dir()
    return ActiveTask(task_ref, source_type, context_key, stale)


def _context_path(repo_root: Path, context_key: str) -> Path:
    return _runtime_sessions_dir(repo_root) / f"{context_key}.json"


def resolve_active_task(
    repo_root: Path,
    platform_input: dict[str, Any] | None = None,
    platform: str | None = None,
    *,
    allow_single_session_fallback: bool = False,
    allow_environment_context: bool = True,
) -> ActiveTask:
    """Resolve the active task from session runtime state only.

    A stale session task is returned as stale. Missing context identity or a
    Missing or unmatched session identity does not infer ownership from the
    number of session files. Pull-based child-agent callers that cannot inherit
    a parent identity must opt into the compatibility fallback explicitly.
    """
    context_key = resolve_context_key(
        platform_input,
        platform,
        allow_environment_context=allow_environment_context,
    )
    if context_key:
        context = _read_json(_context_path(repo_root, context_key)) or {}
        task_ref = _string_value(context.get("current_task"))
        active = _active_from_ref(task_ref, repo_root, "session", context_key)
        if active:
            return active

    if allow_single_session_fallback:
        fallback = _resolve_single_session_fallback(repo_root)
        if fallback is not None:
            return fallback

    return ActiveTask(None, "none", context_key)


def _resolve_single_session_fallback(repo_root: Path) -> ActiveTask | None:
    """Return the task pointed at by the sole session file, if exactly one exists.

    Used when context-key resolution fails (typical for class-2 platform
    sub-agents). Returns None if 0 or ≥2 session files are present — refuses
    to pick across windows so 04-21's multi-session isolation contract holds.
    """
    sessions_dir = _runtime_sessions_dir(repo_root)
    if not sessions_dir.is_dir():
        return None

    session_files = sorted(sessions_dir.glob("*.json"))
    if len(session_files) != 1:
        return None

    session_file = session_files[0]
    context = _read_json(session_file) or {}
    task_ref = _string_value(context.get("current_task"))
    if not task_ref:
        return None

    fallback_key = session_file.stem
    return _active_from_ref(task_ref, repo_root, "session-fallback", fallback_key)


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _context_metadata(
    platform_input: dict[str, Any] | None,
    platform: str | None,
    context_key: str | None = None,
) -> dict[str, Any]:
    data = _as_dict(platform_input) or {}
    platform_name = _detect_platform(data, platform)
    if platform_name == "session" and context_key:
        prefix = context_key.split("_", 1)[0]
        if prefix in _KNOWN_PLATFORMS:
            platform_name = prefix
    metadata: dict[str, Any] = {
        "platform": platform_name,
        "last_seen_at": _utc_now(),
    }
    for key in (*_SESSION_KEYS, *_CONVERSATION_KEYS, *_TRANSCRIPT_KEYS):
        value = _lookup_string(data, (key,))
        if value:
            metadata[key] = value
    return metadata


def set_active_task(
    task_path: str,
    repo_root: Path,
    platform_input: dict[str, Any] | None = None,
    platform: str | None = None,
) -> ActiveTask | None:
    """Set the active task in session scope.

    Returns None when no context key is available; callers should surface a
    user-facing error that explains how to provide session identity.
    """
    canonical = _canonical_task_ref(task_path, repo_root)
    if canonical is None:
        return None

    context_key = resolve_context_key(platform_input, platform)
    if not context_key:
        return None

    context_path = _context_path(repo_root, context_key)
    context = _read_json(context_path) or {}
    context.update(_context_metadata(platform_input, platform, context_key))
    context["current_task"] = canonical
    context.setdefault("current_run", None)
    if not _write_json(context_path, context):
        return None
    return ActiveTask(canonical, "session", context_key)


def clear_active_task(
    repo_root: Path,
    platform_input: dict[str, Any] | None = None,
    platform: str | None = None,
) -> ActiveTask:
    """Clear the active task by deleting its resolved session context file."""
    context_key = resolve_context_key(platform_input, platform)
    if not context_key:
        return ActiveTask(None, "none")

    previous = resolve_active_task(repo_root, platform_input, platform)
    if not previous.task_path or not previous.context_key:
        return previous

    context_path = _context_path(repo_root, previous.context_key)
    if context_path.is_file():
        _remove_file(context_path)
    return previous


def clear_task_from_sessions(task_path: str, repo_root: Path) -> int:
    """Delete all session runtime files that point at a task."""
    target = _canonical_task_ref(task_path, repo_root) or normalize_task_ref(task_path)
    if not target:
        return 0

    cleared = 0
    sessions_dir = _runtime_sessions_dir(repo_root)
    if not sessions_dir.is_dir():
        return cleared

    for session_path in sessions_dir.glob("*.json"):
        context = _read_json(session_path) or {}
        current = _string_value(context.get("current_task"))
        if not current:
            continue
        current_ref = _canonical_task_ref(current, repo_root) or normalize_task_ref(current)
        if current_ref != target:
            continue
        if session_path.is_file() and _remove_file(session_path):
            cleared += 1

    return cleared


def repoint_task_in_sessions(old_path: str, new_path: str, repo_root: Path) -> int:
    """Move every session pointer from `old_path` to `new_path`.

    Rename is the one lifecycle step where the task survives under a different
    name, so clearing the pointers (what archive does) would be wrong: the user
    would silently lose their active task and have to run `task.py start`
    again to get context injection back. Repointing keeps the session valid
    across the rename.
    """
    # Not `_canonical_task_ref`: the caller repoints *after* moving the
    # directory, so `old_path` no longer exists and canonicalization — which
    # requires an existing directory — would return None for exactly the ref we
    # need to match.
    target = _relative_task_ref(old_path, repo_root)
    replacement = _relative_task_ref(new_path, repo_root)
    if not target or not replacement:
        return 0

    moved = 0
    sessions_dir = _runtime_sessions_dir(repo_root)
    if not sessions_dir.is_dir():
        return moved

    for session_path in sorted(sessions_dir.glob("*.json")):
        context = _read_json(session_path)
        if not context:
            continue
        current = _string_value(context.get("current_task"))
        if not current:
            continue
        current_ref = _canonical_task_ref(current, repo_root) or _relative_task_ref(
            current, repo_root
        )
        if current_ref != target:
            continue
        context["current_task"] = replacement
        if _write_json(session_path, context):
            moved += 1

    return moved


def get_current_task_source(
    repo_root: Path,
    platform_input: dict[str, Any] | None = None,
    platform: str | None = None,
) -> tuple[str, str | None, str | None]:
    """Return (`source_type`, `context_key`, `task_path`) for compatibility."""
    active = resolve_active_task(repo_root, platform_input, platform)
    return active.source_type, active.context_key, active.task_path
