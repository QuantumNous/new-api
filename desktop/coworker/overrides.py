"""User-local risk overrides — relax (or tighten) a tool's risk class.

Mainly to relax MCP's conservative default (every MCP tool defaults to ``external``): a user
who trusts a server can mark its read-only tools ``read`` so they stop gating. Rules match the
tool name (e.g. ``mcp__notion__create_page``) by glob; the most specific rule wins.

**Inviolable rule: this store is user-local and is NEVER written by a persona/package.** A
persona can declare what tools it wants, but only the user decides how much to trust them — so
the persona-loading path never touches this file (see ``PERMISSIONS-AND-INBOX.md``).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from fnmatch import fnmatchcase
from pathlib import Path
from typing import Callable, Optional

from .risk import RiskClass


@dataclass
class _Rule:
    pattern: str
    risk: RiskClass


def _specificity(pattern: str) -> int:
    """More literal (non-wildcard) characters = more specific; an exact pattern beats any glob."""
    literal = sum(1 for c in pattern if c not in "*?[]")
    exact = 0 if any(c in pattern for c in "*?[") else 1000
    return literal + exact


class RiskOverrideStore:
    def __init__(self, path: Optional[str | Path] = None) -> None:
        self.path = Path(path) if path else None
        self._rules: list[_Rule] = self._load()

    def _load(self) -> list[_Rule]:
        if not (self.path and self.path.is_file()):
            return []
        data = json.loads(self.path.read_text(encoding="utf-8"))
        rules = []
        for r in data.get("rules", []):
            try:
                rules.append(_Rule(str(r["pattern"]), RiskClass(str(r["risk"]))))
            except (KeyError, ValueError):
                continue  # skip malformed rules rather than failing the whole store
        return rules

    def save(self) -> None:
        if not self.path:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(
            json.dumps(
                {
                    "rules": [
                        {"pattern": r.pattern, "risk": r.risk.value}
                        for r in self._rules
                    ]
                },
                indent=2,
            ),
            encoding="utf-8",
        )

    def set_rule(self, pattern: str, risk: RiskClass | str) -> None:
        """Add/replace a user override (the everyday path writes this from the approval UI)."""
        risk = RiskClass(risk) if not isinstance(risk, RiskClass) else risk
        self._rules = [r for r in self._rules if r.pattern != pattern]
        self._rules.append(_Rule(pattern, risk))
        self.save()

    def resolve(self, tool_name: str) -> Optional[RiskClass]:
        best: Optional[RiskClass] = None
        best_score = -1
        for r in self._rules:
            if fnmatchcase(tool_name, r.pattern):
                score = _specificity(r.pattern)
                if score > best_score:
                    best, best_score = r.risk, score
        return best

    def resolver(self) -> Callable[[str], Optional[RiskClass]]:
        """A callable for ``PermissionEngine.risk_overrides`` / ``risk.classify``."""
        return self.resolve
