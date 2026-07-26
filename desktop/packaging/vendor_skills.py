#!/usr/bin/env python3
"""Vendor permissively-licensed upstream skills into `coworker/skills/builtin/`.

Only skills whose folder carries a redistribution-friendly license (Apache-2.0 / MIT /
BSD) may be vendored; each vendored folder keeps its upstream LICENSE file. Upstream
pins are exact commits — bump the pin and rerun to upgrade.

Usage:
    python packaging/vendor_skills.py            # (re)download all vendored skills
    python packaging/vendor_skills.py --check    # CI: verify licenses, download nothing
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

BUILTIN_DIR = REPO_ROOT / "coworker" / "skills" / "builtin"

# Anthropic's skills repo publishes these under Apache-2.0 (per-folder LICENSE.txt).
# The docx/pptx/xlsx/pdf document skills there are proprietary — never add them here.
ANTHROPIC_SKILLS_COMMIT = "b29e7cf65e5cb78a5ac33d582270551bc74a14eb"

VENDORED = [
    {
        "repo": "anthropics/skills",
        "commit": ANTHROPIC_SKILLS_COMMIT,
        "path": "skills/internal-comms",
        "name": "internal-comms",
    },
    {
        "repo": "anthropics/skills",
        "commit": ANTHROPIC_SKILLS_COMMIT,
        "path": "skills/theme-factory",
        "name": "theme-factory",
    },
    {
        "repo": "anthropics/skills",
        "commit": ANTHROPIC_SKILLS_COMMIT,
        "path": "skills/skill-creator",
        "name": "skill-creator",
    },
]

_LICENSE_MARKERS = ("Apache License", "MIT License", "BSD ")
_LICENSE_NAMES = ("LICENSE.txt", "LICENSE", "LICENSE.md")

# Self-built skills carry no upstream LICENSE file; they are covered by the repo license.
FIRST_PARTY = {
    "docx-report",
    "xlsx-workbook",
    "pptx-deck",
    "pdf-deliverable",
    "meeting-notes",
    "weekly-report",
}


def _license_ok(skill_dir: Path) -> bool:
    for name in _LICENSE_NAMES:
        path = skill_dir / name
        if path.is_file():
            text = path.read_text(encoding="utf-8", errors="replace")
            return any(marker in text for marker in _LICENSE_MARKERS)
    return False


def check() -> int:
    failures = []
    for sub in sorted(BUILTIN_DIR.iterdir()) if BUILTIN_DIR.is_dir() else []:
        if not (sub / "SKILL.md").is_file():
            continue
        if sub.name in FIRST_PARTY:
            continue
        if not _license_ok(sub):
            failures.append(sub.name)
    if failures:
        print(
            "vendored skills without a redistribution-friendly LICENSE: "
            + ", ".join(failures)
        )
        return 1
    print("vendored skill licenses OK")
    return 0


def vendor() -> int:
    from coworker.skills import market

    for spec in VENDORED:
        print(f"vendoring {spec['repo']}/{spec['path']} @ {spec['commit'][:12]}")
        files = market.fetch_skill_files(spec["repo"], spec["commit"], spec["path"])
        dest = BUILTIN_DIR / spec["name"]
        if dest.exists():
            import shutil

            shutil.rmtree(dest)
        for rel, content in files:
            target = dest / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
        if not _license_ok(dest):
            print(f"ERROR: {spec['name']} has no redistribution-friendly LICENSE")
            return 1
        print(f"  → {dest} ({len(files)} files)")
    return check()


def main() -> int:
    if "--check" in sys.argv:
        return check()
    return vendor()


if __name__ == "__main__":
    raise SystemExit(main())
