"""Personas — specialized coworkers as declarative, skill-shaped bundles.

A persona is a manifest (YAML frontmatter + a markdown body that is the system prompt) that
composes vetted catalog capabilities, a family/workspace shape, and lifecycle metadata. The
built-in surfaces (Code, Cowork, Chat, Ops) are themselves manifests — the same format third
parties use. See `platform/docs/PERSONAS.md`.
"""

from __future__ import annotations

from .manifest import PersonaManifest, ManifestError, parse_manifest, load_manifest_file
from .registry import PersonaRegistry, PersonaState, DEFAULT_PERSONA_ID

__all__ = [
    "PersonaManifest",
    "ManifestError",
    "parse_manifest",
    "load_manifest_file",
    "PersonaRegistry",
    "PersonaState",
    "DEFAULT_PERSONA_ID",
]
