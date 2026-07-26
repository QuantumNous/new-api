"""Skill installation — local folder, GitHub repo, or a skills.sh marketplace id.

Everything installs into the GLOBAL tier (`state_dir()/skills/<name>`); builtin and
workspace skills are never written by this module. Validation is fail-closed: a
SKILL.md with frontmatter `name` + `description` is required, symlinks and traversal
are rejected, and oversized packages are refused before anything lands on disk.
"""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any, Optional

from ..secrets import state_dir
from . import market
from .base import _parse_skill
from .market import MarketError

MAX_FILES = market.MAX_FILES
MAX_FILE_BYTES = market.MAX_FILE_BYTES
MAX_TOTAL_BYTES = market.MAX_TOTAL_BYTES


class SkillInstallError(Exception):
    pass


def global_skills_dir() -> Path:
    return state_dir() / "skills"


def inspect_skill_dir(src: Path) -> dict[str, Any]:
    md = src / "SKILL.md"
    if not md.is_file():
        raise SkillInstallError("folder has no SKILL.md")
    skill = _parse_skill(md)
    if not skill.description:
        raise SkillInstallError("SKILL.md frontmatter must include a description")
    return {
        "name": skill.name,
        "description": skill.description,
        "has_scripts": (src / "scripts").is_dir(),
    }


def _collect_files(src: Path) -> list[tuple[Path, Path]]:
    """(absolute, relative) pairs for every regular file, rejecting unsafe entries."""
    root = src.resolve()
    files: list[tuple[Path, Path]] = []
    total = 0
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            raise SkillInstallError(f"symlinks are not allowed: {path.name}")
        if not path.is_file():
            continue
        rel = path.relative_to(root)
        if ".." in rel.parts:
            raise SkillInstallError(f"unsafe path: {rel}")
        size = path.stat().st_size
        if size > MAX_FILE_BYTES:
            raise SkillInstallError(f"file too large: {rel} ({size} bytes)")
        total += size
        if total > MAX_TOTAL_BYTES:
            raise SkillInstallError("skill exceeds the size limit")
        files.append((path, rel))
        if len(files) > MAX_FILES:
            raise SkillInstallError(f"skill has too many files (> {MAX_FILES})")
    if not files:
        raise SkillInstallError("folder is empty")
    return files


def _dest_for(name: str, overwrite: bool) -> Path:
    safe = name.strip().strip(".")
    if not safe or "/" in safe or "\\" in safe or ".." in safe:
        raise SkillInstallError(f"invalid skill name: {name!r}")
    dest = global_skills_dir() / safe
    if dest.exists():
        if not overwrite:
            raise SkillInstallError(f"skill '{safe}' is already installed")
        shutil.rmtree(dest)
    return dest


def install_from_path(src: str | Path, *, overwrite: bool = False) -> dict[str, Any]:
    source = Path(src).expanduser()
    if not source.is_dir():
        raise SkillInstallError(f"not a folder: {src}")
    meta = inspect_skill_dir(source)
    files = _collect_files(source)
    dest = _dest_for(meta["name"], overwrite)
    dest.mkdir(parents=True)
    for absolute, rel in files:
        target = dest / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(absolute, target)
    return {**meta, "path": str(dest), "source": "global"}


def _install_files(
    files: list[tuple[str, bytes]], *, overwrite: bool
) -> dict[str, Any]:
    manifest = next((c for rel, c in files if rel == "SKILL.md"), None)
    if manifest is None:
        raise SkillInstallError("downloaded skill has no SKILL.md")
    import tempfile

    with tempfile.TemporaryDirectory(prefix="skill-install-") as tmp:
        stage = Path(tmp) / "skill"
        stage.mkdir()
        for rel, content in files:
            if ".." in Path(rel).parts:
                raise SkillInstallError(f"unsafe path: {rel}")
            target = stage / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
        return install_from_path(stage, overwrite=overwrite)


def install_from_github(
    repo: str, *, subdir: Optional[str] = None, overwrite: bool = False
) -> dict[str, Any]:
    try:
        repo_id, ref, url_subdir = market.parse_repo_ref(repo)
        skill_dir = market.locate_skill_dir(
            market._repo_tree(repo_id, ref),
            skill_id=None,
            subdir=subdir or url_subdir,
        )
        files = market.fetch_skill_files(repo_id, ref, skill_dir)
    except MarketError as exc:
        raise SkillInstallError(str(exc)) from exc
    return _install_files(files, overwrite=overwrite)


def install_from_market(market_id: str, *, overwrite: bool = False) -> dict[str, Any]:
    """`market_id` is a skills.sh id: `owner/repo/skillId`."""
    parts = market_id.strip("/").split("/")
    if len(parts) < 3:
        raise SkillInstallError(f"not a skills.sh id: {market_id}")
    repo_id, skill_id = "/".join(parts[:2]), parts[-1]
    try:
        skill_dir = market.locate_skill_dir(
            market._repo_tree(repo_id, "HEAD"), skill_id=skill_id, subdir=None
        )
        files = market.fetch_skill_files(repo_id, "HEAD", skill_dir)
    except MarketError as exc:
        raise SkillInstallError(str(exc)) from exc
    return _install_files(files, overwrite=overwrite)


def delete_skill(name: str) -> bool:
    """Remove a GLOBAL-tier skill folder. Builtin/workspace skills are untouchable."""
    root = global_skills_dir().resolve()
    for sub in root.iterdir() if root.is_dir() else []:
        md = sub / "SKILL.md"
        if not md.is_file():
            continue
        if _parse_skill(md).name == name:
            resolved = sub.resolve()
            if resolved.parent != root or resolved.is_symlink():
                raise SkillInstallError(f"refusing to delete outside skills dir: {sub}")
            shutil.rmtree(resolved)
            return True
    return False
