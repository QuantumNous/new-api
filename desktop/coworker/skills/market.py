"""Skills marketplace client — skills.sh search + GitHub subtree download.

skills.sh indexes SKILL.md folders across public GitHub repos and exposes a public
search API; a result's `source` is the `owner/repo` and `skillId` the skill folder
name. Installation downloads that folder straight from GitHub (tree + raw endpoints),
so no local git or node toolchain is required.
"""

from __future__ import annotations

import posixpath
from typing import Any, Optional

import httpx

SEARCH_URL = "https://skills.sh/api/search"
GITHUB_API = "https://api.github.com"
GITHUB_RAW = "https://raw.githubusercontent.com"

MAX_FILES = 300
MAX_FILE_BYTES = 2 * 1024 * 1024
MAX_TOTAL_BYTES = 10 * 1024 * 1024
_TIMEOUT = 30.0


class MarketError(Exception):
    pass


def search(query: str, limit: int = 10) -> list[dict[str, Any]]:
    try:
        resp = httpx.get(
            SEARCH_URL, params={"q": query, "limit": limit}, timeout=_TIMEOUT
        )
        resp.raise_for_status()
        payload = resp.json()
    except httpx.HTTPError as exc:
        raise MarketError(f"skills.sh search failed: {exc}") from exc
    skills = payload.get("skills")
    if not isinstance(skills, list):
        return []
    out = []
    for s in skills:
        if not isinstance(s, dict):
            continue
        out.append(
            {
                "id": s.get("id", ""),
                "name": s.get("name", ""),
                "skill_id": s.get("skillId", ""),
                "source": s.get("source", ""),
                "installs": s.get("installs", 0),
            }
        )
    return out


def parse_repo_ref(repo: str) -> tuple[str, str, Optional[str]]:
    """Accept `owner/repo` or a github.com URL (optionally /tree/<ref>/<subdir>).

    Returns (owner/repo, ref, subdir)."""
    cleaned = repo.strip()
    for prefix in ("https://github.com/", "http://github.com/", "github.com/"):
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix) :]
            break
    cleaned = cleaned.strip("/")
    parts = cleaned.split("/")
    if len(parts) < 2 or not parts[0] or not parts[1]:
        raise MarketError(f"not a GitHub repository: {repo}")
    owner, name = parts[0], parts[1].removesuffix(".git")
    ref, subdir = "HEAD", None
    if len(parts) > 3 and parts[2] == "tree":
        ref = parts[3]
        if len(parts) > 4:
            subdir = "/".join(parts[4:])
    return f"{owner}/{name}", ref, subdir


def _repo_tree(repo: str, ref: str) -> list[dict[str, Any]]:
    url = f"{GITHUB_API}/repos/{repo}/git/trees/{ref}?recursive=1"
    try:
        resp = httpx.get(
            url,
            headers={"Accept": "application/vnd.github+json"},
            timeout=_TIMEOUT,
            follow_redirects=True,
        )
    except httpx.HTTPError as exc:
        raise MarketError(f"GitHub tree fetch failed: {exc}") from exc
    if resp.status_code == 404:
        raise MarketError(f"repository not found: {repo}")
    if resp.status_code == 403:
        raise MarketError(
            "GitHub API rate limit reached — wait a few minutes and retry"
        )
    if resp.status_code != 200:
        raise MarketError(f"GitHub tree fetch failed: HTTP {resp.status_code}")
    tree = resp.json().get("tree")
    if not isinstance(tree, list):
        raise MarketError("unexpected GitHub tree response")
    return tree


def locate_skill_dir(
    tree: list[dict[str, Any]], *, skill_id: Optional[str], subdir: Optional[str]
) -> str:
    """Path (within the repo) of the folder holding the requested SKILL.md."""
    manifests = [
        e["path"]
        for e in tree
        if e.get("type") == "blob" and posixpath.basename(e.get("path", "")) == "SKILL.md"
    ]
    if subdir:
        prefix = subdir.strip("/")
        if f"{prefix}/SKILL.md" in manifests:
            return prefix
        raise MarketError(f"no SKILL.md under {prefix}/")
    if skill_id:
        candidates = [
            posixpath.dirname(m)
            for m in manifests
            if posixpath.basename(posixpath.dirname(m)) == skill_id
        ]
        if candidates:
            return min(candidates, key=len)
        raise MarketError(f"skill '{skill_id}' not found in repository")
    if len(manifests) == 1:
        return posixpath.dirname(manifests[0])
    if not manifests:
        raise MarketError("repository contains no SKILL.md")
    raise MarketError(
        "repository contains multiple skills — specify the skill folder"
    )


def fetch_skill_files(
    repo: str, ref: str, skill_dir: str
) -> list[tuple[str, bytes]]:
    """Download every regular file under `skill_dir` as (relative_path, content)."""
    tree = _repo_tree(repo, ref)
    prefix = skill_dir.strip("/")
    blobs = [
        e
        for e in tree
        if e.get("type") == "blob"
        and (e.get("path", "").startswith(prefix + "/") or e.get("path") == prefix)
        and e.get("mode") != "120000"  # never follow symlink entries
    ]
    if not blobs:
        raise MarketError(f"no files under {prefix}/")
    if len(blobs) > MAX_FILES:
        raise MarketError(f"skill has too many files ({len(blobs)} > {MAX_FILES})")
    total = 0
    out: list[tuple[str, bytes]] = []
    with httpx.Client(timeout=_TIMEOUT, follow_redirects=True) as client:
        for entry in blobs:
            path = entry["path"]
            rel = path[len(prefix) + 1 :]
            if not rel or ".." in rel.split("/"):
                raise MarketError(f"unsafe path in repository: {path}")
            size = entry.get("size") or 0
            if size > MAX_FILE_BYTES:
                raise MarketError(f"file too large: {path} ({size} bytes)")
            resp = client.get(f"{GITHUB_RAW}/{repo}/{ref}/{path}")
            if resp.status_code != 200:
                raise MarketError(f"download failed for {path}: HTTP {resp.status_code}")
            content = resp.content
            total += len(content)
            if total > MAX_TOTAL_BYTES:
                raise MarketError("skill exceeds the download size limit")
            out.append((rel, content))
    return out
