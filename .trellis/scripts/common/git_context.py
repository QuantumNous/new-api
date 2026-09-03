#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Git and Session Context utilities.

Entry shim — delegates to session_context and packages_context.

Provides:
    output_json - Output context in JSON format
    output_text - Output context in text format
"""

from __future__ import annotations

import json

from .git import run_git
from .session_context import (
    get_context_json,
    get_context_text,
    get_context_record_json,
    get_context_text_record,
    output_json,
    output_text,
)
from .packages_context import (
    get_context_packages_text,
    get_context_packages_json,
)
from .trellis_config import read_trellis_config
from .workflow_phase import (
    filter_platform,
    get_phase_index,
    get_step,
    resolve_effective_platform,
)

# Backward-compatible alias — external modules import this name
_run_git_command = run_git


# =============================================================================
# Main Entry
# =============================================================================

def main() -> None:
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Get Session Context for AI Agent")
    parser.add_argument(
        "--json",
        "-j",
        action="store_true",
        help="Output in JSON format (works with any --mode)",
    )
    parser.add_argument(
        "--mode",
        "-m",
        choices=["default", "record", "packages", "phase"],
        default="default",
        help="Output mode: default (full context), record (for record-session), packages (package info only), phase (workflow step extraction)",
    )
    parser.add_argument(
        "--step",
        help="Step id for --mode phase, e.g. 1.1, 2.2. Omit to get the Phase Index.",
    )
    parser.add_argument(
        "--platform",
        help="Platform name for --mode phase, e.g. cursor, claude-code. Filters platform-tagged blocks.",
    )

    args = parser.parse_args()

    if args.mode == "record":
        if args.json:
            print(json.dumps(get_context_record_json(), indent=2, ensure_ascii=False))
        else:
            print(get_context_text_record())
    elif args.mode == "packages":
        if args.json:
            print(json.dumps(get_context_packages_json(), indent=2, ensure_ascii=False))
        else:
            print(get_context_packages_text())
    elif args.mode == "phase":
        content = get_step(args.step) if args.step else get_phase_index()
        if not content.strip():
            if args.step:
                parser.exit(2, f"Step not found: {args.step}\n")
            else:
                parser.exit(2, "Phase Index section not found in workflow.md\n")
        if args.platform:
            effective = resolve_effective_platform(
                args.platform, read_trellis_config()
            )
            content = filter_platform(content, effective)
        print(content, end="")
    else:
        if args.json:
            output_json()
        else:
            output_text()


if __name__ == "__main__":
    main()
