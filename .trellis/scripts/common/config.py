#!/usr/bin/env python3
"""
Trellis configuration reader.

Reads settings from .trellis/config.yaml with sensible defaults.
"""

from __future__ import annotations

import sys
from pathlib import Path

from .paths import DIR_WORKFLOW, get_repo_root
from .trellis_config import parse_simple_yaml

# The YAML subset parser lives in trellis_config.py — it imports nothing from
# this package, so hooks can load it as a single standalone file. Two byte-
# equivalent copies is a drift hazard, not a feature.


# Defaults
DEFAULT_SESSION_COMMIT_MESSAGE = "chore: record journal"
DEFAULT_MAX_JOURNAL_LINES = 2000
DEFAULT_SESSION_AUTO_COMMIT = True
DEFAULT_CODEX_DISPATCH_MODE = "auto"

CONFIG_FILE = "config.yaml"


TRUE_CONFIG_VALUES = ("true", "yes", "1", "on")
FALSE_CONFIG_VALUES = ("false", "no", "0", "off")


def coerce_config_bool(
    value: object,
    default: bool,
    label: str,
) -> bool:
    """Coerce a config value to a bool, warning on anything unrecognized.

    The parser stores every value as a string, so ``git: yes`` arrives as
    ``"yes"``. Every boolean config key goes through this one helper: an
    accepted-here/rejected-there split means a user writing a perfectly
    reasonable YAML boolean silently gets the opposite branch.

    Args:
        value: Raw value from the parsed config.
        default: Returned when the value is unrecognized.
        label: Config key name, used in the warning.
    """
    if isinstance(value, bool):
        return value
    s = str(value).strip().lower()
    if s in TRUE_CONFIG_VALUES:
        return True
    if s in FALSE_CONFIG_VALUES:
        return False
    print(
        f"[WARN] invalid {label} value: {value!r}; using {str(default).lower()} (default)",
        file=sys.stderr,
    )
    return default


def _is_true_config_value(value: object, label: str = "config flag") -> bool:
    """Return True when a config value represents an enabled flag."""
    if value is None:
        return False
    return coerce_config_bool(value, False, label)


def _get_config_path(repo_root: Path | None = None) -> Path:
    """Get path to config.yaml."""
    root = repo_root or get_repo_root()
    return root / DIR_WORKFLOW / CONFIG_FILE


def _load_config(repo_root: Path | None = None) -> dict:
    """Load and parse config.yaml. Returns empty dict on any error.

    Fail-open, matching ``trellis_config.read_trellis_config``: a malformed
    config must not take down ``task.py create``. A parse failure is reported
    once on stderr so it is not invisible.
    """
    config_file = _get_config_path(repo_root)
    try:
        content = config_file.read_text(encoding="utf-8")
    except (OSError, IOError):
        return {}
    try:
        parsed = parse_simple_yaml(content, source=str(config_file))
    except Exception as e:
        print(
            f"[WARN] could not parse {config_file}: {type(e).__name__}: {e}; "
            "using defaults",
            file=sys.stderr,
        )
        return {}
    return parsed if isinstance(parsed, dict) else {}


def get_session_commit_message(repo_root: Path | None = None) -> str:
    """Get the commit message for auto-committing session records."""
    config = _load_config(repo_root)
    return config.get("session_commit_message", DEFAULT_SESSION_COMMIT_MESSAGE)


def get_max_journal_lines(repo_root: Path | None = None) -> int:
    """Get the maximum lines per journal file."""
    config = _load_config(repo_root)
    value = config.get("max_journal_lines", DEFAULT_MAX_JOURNAL_LINES)
    try:
        return int(value)
    except (ValueError, TypeError):
        return DEFAULT_MAX_JOURNAL_LINES


def get_session_auto_commit(repo_root: Path | None = None) -> bool:
    """Whether scripts should auto-stage + auto-commit session/task changes.

    Governs both ``add_session.py:_auto_commit_workspace`` and
    ``task_store.py:_auto_commit_archive``.

    Default: ``True`` (existing behavior — auto-stage + auto-commit).
    Set ``session_auto_commit: false`` in ``.trellis/config.yaml`` to skip
    auto-staging entirely; the journal/archive files are still written to
    disk, but the user manages ``git add`` / ``git commit`` themselves.

    Accepts native YAML booleans (``true`` / ``false``) and the string
    aliases ``true / false / yes / no / 1 / 0 / on / off`` (case-insensitive).
    Invalid values fall back to ``True`` with a stderr warning.
    """
    config = _load_config(repo_root)
    raw = config.get("session_auto_commit", DEFAULT_SESSION_AUTO_COMMIT)
    return coerce_config_bool(
        raw, DEFAULT_SESSION_AUTO_COMMIT, "session_auto_commit"
    )


def get_codex_dispatch_mode(repo_root: Path | None = None) -> str:
    """Return Codex dispatch mode.

    Default is ``auto``, which dispatches Trellis sub-agents and uses native
    context injection with a child-side fallback. ``inline`` is an explicit
    opt-out. ``sub-agent`` remains a backwards-compatible alias for ``auto``.

    Invalid explicit configuration falls back to ``inline`` rather than
    unexpectedly dispatching a sub-agent. This CLI-facing parser is the only
    place that emits a warning for invalid values; hook readers fail safely
    without producing per-turn warning noise.
    """
    config = _load_config(repo_root)
    codex = config.get("codex")
    if codex is None:
        return DEFAULT_CODEX_DISPATCH_MODE
    if not isinstance(codex, dict):
        print(
            f"[WARN] invalid codex config: {codex!r}; using inline",
            file=sys.stderr,
        )
        return "inline"

    raw = codex.get("dispatch_mode", DEFAULT_CODEX_DISPATCH_MODE)
    mode = str(raw).strip().lower()
    if mode in ("auto", "inline"):
        return mode
    if mode == "sub-agent":
        return "auto"
    print(
        f"[WARN] invalid codex.dispatch_mode value: {raw!r}; using inline",
        file=sys.stderr,
    )
    return "inline"


DEFAULT_CONTEXT_INJECTION_MAX_FILE_BYTES = 32768
DEFAULT_CONTEXT_INJECTION_MAX_ARTIFACT_BYTES = 65536
DEFAULT_CONTEXT_INJECTION_MAX_TOTAL_BYTES = 131072


def get_context_injection_limits(repo_root: Path | None = None) -> dict[str, int]:
    """Return sub-agent context injection byte limits.

    Reads the ``context_injection:`` section of ``.trellis/config.yaml``:

        context_injection:
          max_file_bytes: 32768
          max_artifact_bytes: 65536
          max_total_bytes: 131072

    ``0`` disables the corresponding limit. Missing keys use their default;
    invalid (non-int or negative) values fall back to the default for that
    key with a stderr warning.
    """
    defaults = {
        "max_file_bytes": DEFAULT_CONTEXT_INJECTION_MAX_FILE_BYTES,
        "max_artifact_bytes": DEFAULT_CONTEXT_INJECTION_MAX_ARTIFACT_BYTES,
        "max_total_bytes": DEFAULT_CONTEXT_INJECTION_MAX_TOTAL_BYTES,
    }

    config = _load_config(repo_root)
    section = config.get("context_injection")
    if not isinstance(section, dict):
        return defaults

    result = dict(defaults)
    for key, default_value in defaults.items():
        if key not in section:
            continue
        raw = section[key]
        try:
            value = int(raw)
        except (TypeError, ValueError):
            print(
                f"[WARN] invalid context_injection.{key} value: {raw!r}; "
                f"using default {default_value}",
                file=sys.stderr,
            )
            continue
        if value < 0:
            print(
                f"[WARN] invalid context_injection.{key} value: {raw!r}; "
                f"using default {default_value}",
                file=sys.stderr,
            )
            continue
        result[key] = value

    return result


DEFAULT_PROMPT_INJECTION_SKIP_KEYWORD = "no-trellis"


def get_prompt_injection_config(repo_root: Path | None = None) -> dict[str, str]:
    """Return per-turn prompt injection config.

    Reads the ``prompt_injection:`` section of ``.trellis/config.yaml``:

        prompt_injection:
          skip_keyword: "no-trellis"   # "" disables the escape hatch entirely

    ``skip_keyword`` is the word-boundary, case-insensitive keyword that, when
    present in the user's prompt, makes the per-turn workflow-state injection
    emit nothing for that turn. Defaults to ``"no-trellis"``. A non-string
    value falls back to the default.
    """
    defaults = {"skip_keyword": DEFAULT_PROMPT_INJECTION_SKIP_KEYWORD}

    config = _load_config(repo_root)
    section = config.get("prompt_injection")
    if not isinstance(section, dict):
        return defaults

    result = dict(defaults)
    raw = section.get("skip_keyword", DEFAULT_PROMPT_INJECTION_SKIP_KEYWORD)
    if isinstance(raw, str):
        result["skip_keyword"] = raw
    return result


def get_hooks(event: str, repo_root: Path | None = None) -> list[str]:
    """Get hook commands for a lifecycle event.

    Args:
        event: Event name (e.g. "after_create", "after_archive").
        repo_root: Repository root path.

    A hook the user believes is installed and which silently never runs is the
    worst outcome for this feature, so a declared-but-unusable shape warns
    instead of returning an empty list quietly.

    Returns:
        List of shell commands to execute, empty if none configured.
    """
    config = _load_config(repo_root)
    hooks = config.get("hooks")
    if hooks is None:
        return []
    if not isinstance(hooks, dict):
        print(
            f"[WARN] ignoring `hooks` in config.yaml: expected a mapping of "
            f"event -> list of commands, got {hooks!r}",
            file=sys.stderr,
        )
        return []
    commands = hooks.get(event)
    if commands is None:
        return []
    if isinstance(commands, list):
        return [str(c) for c in commands]
    # `after_create: echo hi` instead of a `- ` list — parses fine, registers
    # nothing.
    print(
        f"[WARN] ignoring hook `{event}` in config.yaml: expected a list of "
        f"commands, got {commands!r}. Write it as:\n"
        f"  hooks:\n    {event}:\n      - {commands}",
        file=sys.stderr,
    )
    return []


# =============================================================================
# Monorepo / Packages
# =============================================================================


def get_packages(repo_root: Path | None = None) -> dict[str, dict] | None:
    """Get monorepo package declarations.

    Returns:
        Dict mapping package name to its config (path, type, etc.),
        or None if not configured (single-repo mode).

    Example return:
        {"cli": {"path": "packages/cli"}, "docs-site": {"path": "docs-site", "type": "submodule"}}
    """
    config = _load_config(repo_root)
    packages = config.get("packages")
    if not isinstance(packages, dict):
        return None
    # Ensure each value is a dict (filter out scalar entries)
    filtered = {k: v for k, v in packages.items() if isinstance(v, dict)}
    if not filtered:
        return None
    return filtered


def get_default_package(repo_root: Path | None = None) -> str | None:
    """Get the default package name from config.

    Returns:
        Package name string, or None if not configured.
    """
    config = _load_config(repo_root)
    value = config.get("default_package")
    return str(value) if value else None


def get_submodule_packages(repo_root: Path | None = None) -> dict[str, str]:
    """Get packages that are git submodules.

    Returns:
        Dict mapping package name to its path for submodule-type packages.
        Empty dict if none configured.

    Example return:
        {"docs-site": "docs-site"}
    """
    packages = get_packages(repo_root)
    if packages is None:
        return {}
    return {
        name: cfg.get("path", name)
        for name, cfg in packages.items()
        if cfg.get("type") == "submodule"
    }


def get_git_packages(repo_root: Path | None = None) -> dict[str, str]:
    """Get packages that have their own independent git repository.

    These are sub-directories with their own .git (not submodules),
    marked with ``git: true`` in config.yaml.

    Returns:
        Dict mapping package name to its path for git-repo packages.
        Empty dict if none configured.

    Example config::

        packages:
          backend:
            path: iqs
            git: true

    Example return::

        {"backend": "iqs"}
    """
    packages = get_packages(repo_root)
    if packages is None:
        return {}
    return {
        name: cfg.get("path", name)
        for name, cfg in packages.items()
        if _is_true_config_value(cfg.get("git"), f"packages.{name}.git")
    }


def is_monorepo(repo_root: Path | None = None) -> bool:
    """Check if the project is configured as a monorepo (has packages in config)."""
    return get_packages(repo_root) is not None


def get_spec_base(package: str | None = None, repo_root: Path | None = None) -> str:
    """Get the spec directory base path relative to .trellis/.

    Single-repo: returns "spec"
    Monorepo with package: returns "spec/<package>"
    Monorepo without package: returns "spec" (caller should specify package)
    """
    if package and is_monorepo(repo_root):
        return f"spec/{package}"
    return "spec"


def validate_package(package: str, repo_root: Path | None = None) -> bool:
    """Check if a package name is valid in this project.

    Single-repo (no packages configured): always returns True.
    Monorepo: returns True only if package exists in config.yaml packages.
    """
    packages = get_packages(repo_root)
    if packages is None:
        return True  # Single-repo, no validation needed
    return package in packages


def resolve_package(
    task_package: str | None = None,
    repo_root: Path | None = None,
) -> str | None:
    """Resolve package from inferred sources with validation.

    Checks in order: task_package → default_package.
    Invalid inferred values print a warning to stderr and are skipped.

    Returns:
        Resolved package name, or None if no valid package found.

    Note:
        CLI --package should be validated separately by the caller
        (fail-fast with available packages list on error).
    """
    packages = get_packages(repo_root)
    if packages is None:
        return None  # Single-repo, no package needed

    # Try task_package (guard against non-string values from malformed JSON)
    if task_package and isinstance(task_package, str):
        if task_package in packages:
            return task_package
        print(
            f"Warning: task.json package '{task_package}' not found in config, skipping",
            file=sys.stderr,
        )

    # Try default_package
    default = get_default_package(repo_root)
    if default:
        if default in packages:
            return default
        print(
            f"Warning: default_package '{default}' not found in config, skipping",
            file=sys.stderr,
        )

    return None


def get_spec_scope(repo_root: Path | None = None) -> list[str] | str | None:
    """Get session.spec_scope configuration.

    Returns:
        list[str]: Package names to include in spec scanning.
        str: "active_task" to use current task's package.
        None: No scope configured (scan all packages).
    """
    config = _load_config(repo_root)
    session = config.get("session")
    if not isinstance(session, dict):
        return None

    scope = session.get("spec_scope")
    if scope is None:
        return None
    if isinstance(scope, str):
        return scope  # e.g. "active_task"
    if isinstance(scope, list):
        return [str(s) for s in scope]
    return None
