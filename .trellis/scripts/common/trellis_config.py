#!/usr/bin/env python3
"""
Standalone reader for .trellis/config.yaml.

Owns the minimal YAML parser used across Trellis. ``common.config`` imports
``parse_simple_yaml`` from here rather than keeping its own copy: this module
imports nothing from the package, so hooks can load it as a single file, and
one parser cannot drift from another. Returns an empty dict on
missing/malformed files so callers stay simple.

Supported subset: ``key: value`` scalars (everything is a string), nested
mappings by indentation, ``- `` lists of scalars, ``#`` comments (whole-line
and inline outside quotes), and one layer of matching surrounding quotes.
Constructs outside that subset — block scalars, anchors, aliases, merge keys,
flow collections, and mappings nested inside a list — are reported on stderr
and skipped rather than parsed into a plausible-looking wrong value.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Optional


CONFIG_REL_PATH = ".trellis/config.yaml"


def _unquote(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
        return value[1:-1]
    return value


def _strip_inline_comment(value: str) -> str:
    """Strip ` # …` inline comments while preserving `#` inside quoted strings.

    YAML treats ` #` (space-hash) as a comment opener; bare `#` inside a token
    is part of the value. Quoted strings are immune.
    """
    in_quote: str | None = None
    for idx, ch in enumerate(value):
        if in_quote:
            if ch == in_quote:
                in_quote = None
            continue
        if ch in ('"', "'"):
            in_quote = ch
            continue
        if ch == "#" and (idx == 0 or value[idx - 1].isspace()):
            return value[:idx]
    return value


def _next_content_line(lines: list[str], start: int) -> tuple[int, str]:
    i = start
    while i < len(lines):
        stripped = lines[i].strip()
        if stripped and not stripped.startswith("#"):
            return i, lines[i]
        i += 1
    return i, ""


def _warn_unsupported(source: str, lineno: int, line: str, reason: str) -> None:
    """Report a YAML construct this parser cannot represent, and move on."""
    print(
        f"[WARN] {source}:{lineno}: {reason}; ignoring: {line.strip()}",
        file=sys.stderr,
    )


def _is_block_scalar(value: str) -> bool:
    """True for ``|``, ``>`` and their chomping/indent indicators (``|-``, ``>2``)."""
    if not value or value[0] not in ("|", ">"):
        return False
    return all(ch in "+-0123456789" for ch in value[1:])


def _unsupported_value(key: str, value: str) -> str | None:
    """Name the unsupported construct in an unquoted scalar value, else None.

    Only unquoted values are inspected: ``cmd: "[a] | b"`` is a string the user
    wrote deliberately, while a bare ``notes: |`` or ``base: *anchor`` would
    otherwise be stored as the literal marker with the real content dropped.
    """
    if key == "<<":
        return "YAML merge keys are not supported"
    if _is_block_scalar(value):
        return "block scalars are not supported"
    if value.startswith("&"):
        return "YAML anchors are not supported"
    if value.startswith("*"):
        return "YAML aliases are not supported"
    if value.startswith("["):
        return "flow sequences are not supported (use `- ` list items)"
    if value.startswith("{"):
        return "flow mappings are not supported (use an indented mapping)"
    return None


def _skip_indented_body(lines: list[str], start: int, indent: int) -> int:
    """Skip the continuation lines of a rejected key (block scalar body etc.)."""
    i = start
    while i < len(lines):
        stripped = lines[i].strip()
        if stripped and len(lines[i]) - len(lines[i].lstrip()) <= indent:
            break
        i += 1
    return i


def _parse_yaml_block(
    lines: list[str], start: int, min_indent: int, target: dict, source: str
) -> int:
    i = start
    current_list: list | None = None
    # Indent of the key that opened current_list, so a deeper `key: value`
    # can be recognized as a mapping inside that list.
    list_owner_indent = 0

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if not stripped or stripped.startswith("#"):
            i += 1
            continue

        indent = len(line) - len(line.lstrip())
        if indent < min_indent:
            break

        if stripped.startswith("- "):
            if current_list is not None:
                current_list.append(_unquote(stripped[2:].strip()))
            i += 1
        elif ":" in stripped:
            if current_list is not None and indent > list_owner_indent:
                # `- name: cli` / `  path: x`: the second key belongs to a
                # mapping inside the list. Storing it would hoist it into the
                # parent dict as a sibling of the list — a nested key silently
                # becoming a root key.
                _warn_unsupported(
                    source,
                    i + 1,
                    line,
                    "mappings inside a list are not supported",
                )
                i += 1
                continue

            key, _, value = stripped.partition(":")
            key = key.strip()
            value = _strip_inline_comment(value).strip()
            was_quoted = len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'")

            if not was_quoted:
                reason = _unsupported_value(key, value)
                if reason is not None:
                    _warn_unsupported(source, i + 1, line, reason)
                    current_list = None
                    i = _skip_indented_body(lines, i + 1, indent)
                    continue

            value = _unquote(value)
            current_list = None

            if value or was_quoted:
                target[key] = value
                i += 1
            else:
                next_i, next_line = _next_content_line(lines, i + 1)
                if next_i >= len(lines):
                    target[key] = {}
                    i = next_i
                elif next_line.strip().startswith("- "):
                    current_list = []
                    list_owner_indent = indent
                    target[key] = current_list
                    i += 1
                else:
                    next_indent = len(next_line) - len(next_line.lstrip())
                    if next_indent > indent:
                        nested: dict = {}
                        target[key] = nested
                        i = _parse_yaml_block(lines, i + 1, next_indent, nested, source)
                    else:
                        target[key] = {}
                        i += 1
        else:
            i += 1

    return i


def parse_simple_yaml(content: str, source: str = "config.yaml") -> dict:
    """Parse simple YAML with nested dict support (no dependencies).

    Supports:
        - key: value (string)
        - key: (followed by list items)
            - item1
            - item2
        - key: (followed by nested dict)
            nested_key: value
            nested_key2:
              - item

    Uses indentation to detect nesting (2+ spaces deeper = child). Every value
    is a string; consumers coerce. Unsupported constructs are reported on
    stderr against ``source`` and skipped — see the module docstring.

    Args:
        content: YAML content string.
        source: Label used in warnings, normally the config file path.

    Returns:
        Parsed dict (values can be str, list[str], or dict).
    """
    lines = content.splitlines()
    result: dict = {}
    _parse_yaml_block(lines, 0, 0, result, source)
    return result


def read_trellis_config(repo_root: Optional[Path] = None) -> dict:
    """Read .trellis/config.yaml. Returns {} on missing or malformed file."""
    root = repo_root or Path.cwd()
    config_file = root / CONFIG_REL_PATH
    try:
        content = config_file.read_text(encoding="utf-8")
    except (FileNotFoundError, OSError):
        return {}
    try:
        parsed = parse_simple_yaml(content, source=str(config_file))
    except Exception:
        return {}
    return parsed if isinstance(parsed, dict) else {}
