"""Persona registry — the installed personas + their lifecycle state.

Unifies two sources behind one `id → Agent` resolver: the core surfaces (Code / Chat /
Cowork) wrap their existing agent builders (exact prompts preserved), and markdown manifests
(Ops today; third-party dirs in Phase 2) load through ``PersonaManifest``. Lifecycle —
installed → enabled → surfaced, plus a default — is persisted to a small JSON file.

A session is born from exactly one persona (recorded as ``SessionRecord.agent``); resolving an
id always returns its Agent even if the persona was later disabled, so live sessions keep
working. Disable/surface only affect what the *new-session* picker offers.
"""

from __future__ import annotations

import json
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional

from ..agents.base import Agent
from ..agents.chat import chat_agent
from ..agents.code import CODE_CAPABILITIES, code_agent
from ..agents.cowork import COWORK_CAPABILITIES, cowork_agent
from .manifest import PersonaManifest, load_manifest_file

DEFAULT_PERSONA_ID = "cowork"


@dataclass
class PersonaState:
    enabled: bool = True
    surfaced: bool = True


@dataclass
class PersonaEntry:
    id: str
    name: str
    icon: str = ""
    tagline: str = ""
    needs_workspace: bool = True
    builtin: bool = True
    family: str = "knowledge"
    # The persona's workspace requirement (git|project|deliverable|none) — surfaced to the GUI so it
    # can detect project-scoped personas (git/project) uniformly. Manifest-backed personas carry it
    # verbatim; builtins set it at registration to match their family/needs_workspace.
    workspace: str = "deliverable"
    tools: list[str] = field(default_factory=list)
    default_surfaced: bool = (
        True  # whether it shows in the picker before any user choice
    )
    _builder: Optional[Callable[[], Agent]] = None
    manifest: Optional[PersonaManifest] = None

    def agent(self) -> Agent:
        if self._builder is not None:
            return self._builder()
        assert self.manifest is not None
        return self.manifest.to_agent()


class PersonaRegistry:
    def __init__(
        self,
        *,
        builtin_dir: Optional[str | Path] = None,
        extra_dirs: Optional[list[str | Path]] = None,
        state_path: Optional[str | Path] = None,
        installed_dir: Optional[str | Path] = None,
    ) -> None:
        self.state_path = Path(state_path) if state_path else None
        # Managed area where installed personas are *snapshotted* (copied) at install time, so a
        # persona's definition is stable and self-contained — independent of the user's source dir.
        if installed_dir is not None:
            self.installed_dir: Optional[Path] = Path(installed_dir)
        elif self.state_path is not None:
            self.installed_dir = self.state_path.parent / "personas-installed"
        else:
            self.installed_dir = None
        self._entries: dict[str, PersonaEntry] = {}
        self._enabled: dict[str, bool] = {}
        self._surfaced: dict[str, bool] = {}
        self._default = DEFAULT_PERSONA_ID
        self._load_builtin(builtin_dir)
        for d in extra_dirs or []:
            self._load_dir(d, builtin=False)
        self._load_state()
        self._load_installed()  # re-load snapshots from prior installs

    # -- loading ----------------------------------------------------------------
    def _register_builder(
        self,
        id,
        name,
        icon,
        tagline,
        builder,
        needs_workspace,
        family,
        tools,
        workspace="deliverable",
        default_surfaced=True,
    ) -> None:
        self._entries[id] = PersonaEntry(
            id=id,
            name=name,
            icon=icon,
            tagline=tagline,
            needs_workspace=needs_workspace,
            builtin=True,
            family=family,
            workspace=workspace,
            tools=list(tools),
            default_surfaced=default_surfaced,
            _builder=builder,
        )

    def _load_builtin(self, builtin_dir: Optional[str | Path]) -> None:
        # Core surfaces keep their exact prompts via the existing builders. Cowork (the default)
        # leads; Chat is hidden from the picker by default (Cowork covers quick Q&A) — recoverable
        # from the Personas tab.
        self._register_builder(
            "cowork",
            "OpenWorker",
            "cowork",
            "Produce a deliverable — research, analysis, scripts",
            cowork_agent,
            True,
            "knowledge",
            COWORK_CAPABILITIES,
            workspace="deliverable",
        )
        self._register_builder(
            "code",
            "Code",
            "code",
            "Work in a codebase — files, git, shell",
            code_agent,
            True,
            "code",
            CODE_CAPABILITIES,
            workspace="git",
        )
        self._register_builder(
            "chat",
            "Chat",
            "chat",
            "Quick questions — no workspace",
            chat_agent,
            False,
            "knowledge",
            [],
            workspace="none",
            default_surfaced=False,
        )
        # Markdown-backed built-ins (Ops, …) — dogfood the manifest path.
        d = Path(builtin_dir) if builtin_dir else Path(__file__).parent / "builtin"
        self._load_dir(d, builtin=True)

    def _load_dir(self, directory: str | Path, *, builtin: bool) -> None:
        d = Path(directory)
        if not d.is_dir():
            return
        for md in sorted(d.glob("*.md")):
            self._register_manifest(
                load_manifest_file(md, builtin=builtin), builtin=builtin
            )

    def _register_manifest(self, m, *, builtin: bool) -> None:
        self._entries[m.id] = PersonaEntry(
            id=m.id,
            name=m.name,
            icon=m.icon,
            tagline=m.tagline,
            needs_workspace=m.needs_workspace,
            builtin=builtin,
            family=m.family,
            workspace=m.workspace,
            tools=list(m.tools),
            manifest=m,
        )

    def _load_installed(self) -> None:
        if not (self.installed_dir and self.installed_dir.is_dir()):
            return
        for sub in sorted(self.installed_dir.iterdir()):
            if sub.is_dir():
                self._load_dir(sub, builtin=False)

    def _load_state(self) -> None:
        if self.state_path and self.state_path.is_file():
            data = json.loads(self.state_path.read_text(encoding="utf-8"))
            self._enabled = dict(data.get("enabled", {}))
            self._surfaced = dict(data.get("surfaced", {}))
            self._default = data.get("default", DEFAULT_PERSONA_ID)

    def save(self) -> None:
        if not self.state_path:
            return
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        self.state_path.write_text(
            json.dumps(
                {
                    "enabled": self._enabled,
                    "surfaced": self._surfaced,
                    "default": self._default,
                },
                indent=2,
            ),
            encoding="utf-8",
        )

    # -- queries ----------------------------------------------------------------
    def ids(self) -> list[str]:
        return list(self._entries)

    def get(self, persona_id: str) -> Optional[PersonaEntry]:
        return self._entries.get(persona_id)

    def is_enabled(self, persona_id: str) -> bool:
        # No user choice recorded → only the default persona ships enabled (owner call,
        # 2026-07-09): a fresh install is Coworker-only, everything else is opt-in from
        # Settings ▸ Personas. Explicit state (either way) always wins.
        if persona_id in self._enabled:
            return bool(self._enabled[persona_id])
        return persona_id == self._default or persona_id == DEFAULT_PERSONA_ID

    def is_surfaced(self, persona_id: str) -> bool:
        # User choice wins; otherwise the persona's default (Chat defaults hidden).
        if persona_id in self._surfaced:
            return self._surfaced[persona_id]
        entry = self._entries.get(persona_id)
        return entry.default_surfaced if entry else True

    def default_id(self) -> str:
        # The configured default if it's enabled, else cowork if present, else any enabled one.
        if self._default in self._entries and self.is_enabled(self._default):
            return self._default
        if DEFAULT_PERSONA_ID in self._entries and self.is_enabled(DEFAULT_PERSONA_ID):
            return DEFAULT_PERSONA_ID
        for pid in self._entries:
            if self.is_enabled(pid):
                return pid
        return DEFAULT_PERSONA_ID

    def agent(self, persona_id: Optional[str]) -> Agent:
        """Resolve a persona id to its Agent. Unknown ids fall back to the default persona;
        a known-but-disabled id still resolves (live sessions keep working)."""
        entry = self._entries.get(persona_id or "")
        if entry is None:
            entry = self._entries.get(self.default_id())
        if entry is None:
            raise KeyError(f"no persona to resolve for {persona_id!r}")
        return entry.agent()

    def sidebar(self) -> list[dict]:
        """Session surfaces for the new-session picker: enabled AND surfaced, in order."""
        out = []
        for e in self._entries.values():
            if self.is_enabled(e.id) and self.is_surfaced(e.id):
                out.append(
                    {
                        "name": e.id,
                        "title": e.name,
                        "needs_workspace": e.needs_workspace,
                        "icon": e.icon,
                        "tagline": e.tagline,
                        "default": e.id == self.default_id(),
                    }
                )
        return out

    def list_all(self) -> list[dict]:
        """Every installed persona + its lifecycle state — for the Personas settings panel."""
        return [
            {
                "id": e.id,
                "name": e.name,
                "icon": e.icon,
                "tagline": e.tagline,
                "needs_workspace": e.needs_workspace,
                "builtin": e.builtin,
                "family": e.family,
                "workspace": e.workspace,
                "tools": e.tools,
                "enabled": self.is_enabled(e.id),
                "surfaced": self.is_surfaced(e.id),
                "default": e.id == self.default_id(),
            }
            for e in self._entries.values()
        ]

    # -- mutations --------------------------------------------------------------
    def set_enabled(self, persona_id: str, enabled: bool) -> None:
        if persona_id not in self._entries:
            raise KeyError(persona_id)
        self._enabled[persona_id] = bool(enabled)
        if enabled:
            # Enabling implies surfacing (installs land unsurfaced, and "enabled but
            # invisible in the picker" is never what a user just asked for). They can
            # still untick "In picker" afterwards to hide it.
            self._surfaced[persona_id] = True
        self.save()

    def set_surfaced(self, persona_id: str, surfaced: bool) -> None:
        if persona_id not in self._entries:
            raise KeyError(persona_id)
        self._surfaced[persona_id] = bool(surfaced)
        self.save()

    def set_default(self, persona_id: str) -> None:
        if persona_id not in self._entries:
            raise KeyError(persona_id)
        self._default = persona_id
        self._enabled[persona_id] = True  # a default must be enabled
        self.save()

    def uninstall(self, persona_id: str) -> None:
        """Remove an installed persona: registry entry, lifecycle state, and its snapshot
        dir. Built-ins can't be uninstalled (disable them instead). Live sessions born
        from it resolve to the default persona afterwards (same as any unknown id)."""
        entry = self._entries.get(persona_id)
        if entry is None:
            raise KeyError(persona_id)
        if entry.builtin:
            raise ValueError(f"{persona_id} is built-in and cannot be deleted")
        del self._entries[persona_id]
        self._enabled.pop(persona_id, None)
        self._surfaced.pop(persona_id, None)
        if self._default == persona_id:
            self._default = DEFAULT_PERSONA_ID
        if self.installed_dir is not None:
            snap = self.installed_dir / persona_id
            if snap.is_dir():
                shutil.rmtree(snap)
        self.save()

    # -- install (third-party personas) -----------------------------------------
    def install_from_dir(self, directory: str | Path) -> list[dict]:
        """Install persona(s) from a local directory by **snapshotting** their manifests into our
        managed area (so the definition is stable, independent of the source dir). Returns a
        consent summary per persona; each lands **disabled + unsurfaced** pending the user's
        consent — the caller enables them only after the user approves the declared capabilities.

        NOTE: re-installing an updated persona overwrites the snapshot; live sessions on it simply
        resume with the new prompt/tools. We accept that for now (see PERSONAS.md)."""
        from .loading import consent_summary

        d = Path(directory)
        if not d.is_dir():
            raise FileNotFoundError(f"not a directory: {d}")
        mds = sorted(d.glob("*.md"))
        if not mds:
            raise FileNotFoundError(f"no persona manifests (*.md) in {d}")

        summaries: list[dict] = []
        for md in mds:
            m = load_manifest_file(md, builtin=False)  # validate before snapshotting
            snapshot = self._snapshot(md, m.id)
            installed = load_manifest_file(snapshot, builtin=False) if snapshot else m
            self._register_manifest(installed, builtin=False)
            self._enabled[m.id] = False  # pending consent — never auto-enabled
            self._surfaced[m.id] = False
            summaries.append(consent_summary(installed))
        self.save()
        return summaries

    def _snapshot(self, md: Path, persona_id: str) -> Optional[Path]:
        """Copy a manifest into the managed install area; return the snapshot path (or None if no
        managed area is configured, e.g. an ephemeral in-memory registry)."""
        if self.installed_dir is None:
            return None
        dest_dir = self.installed_dir / persona_id
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / "manifest.md"
        shutil.copy2(md, dest)
        return dest

    def install_from_git(
        self, url: str, *, cache_base: Optional[str | Path] = None, clone=None
    ) -> list[dict]:
        """Clone a persona repo and install its personas (disabled pending consent)."""
        from .loading import clone_persona_repo, git_clone

        base = (
            Path(cache_base)
            if cache_base
            else (
                (self.state_path.parent if self.state_path else Path.cwd())
                / "persona-cache"
            )
        )
        dest = clone_persona_repo(url, base, clone=clone or git_clone)
        return self.install_from_dir(dest)


# -- module singleton (used by agents.get_agent / list_agents) ------------------
_singleton: Optional[PersonaRegistry] = None


def get_registry() -> PersonaRegistry:
    global _singleton
    if _singleton is None:
        from ..secrets import state_dir

        _singleton = PersonaRegistry(state_path=state_dir() / "personas.json")
    return _singleton


def set_registry(registry: PersonaRegistry) -> None:
    """Install a registry as the process singleton (the manager does this with its data dir)."""
    global _singleton
    _singleton = registry
