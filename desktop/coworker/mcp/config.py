"""MCP server config — the standard `mcpServers` JSON, layered global + workspace.

Global:    ~/.config/coworker/mcp.json
Workspace: <workspace>/.coworker/mcp.json   (overrides global on name clash)

Paste-compatible with Claude Desktop / Cursor / Codex. `${VAR}` refs in command/args/env/
url/headers are resolved at load time via the SecretStore (env + local `.env`). REST edits
target the **global** file.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from ..secrets import SecretStore, state_dir

_HTTP_TYPES = {"http", "https", "sse", "streamable-http", "streamable_http"}


@dataclass
class MCPServerDef:
    name: str
    transport: str  # "stdio" | "http"
    command: Optional[str] = None
    args: list[str] = field(default_factory=list)
    env: dict[str, str] = field(default_factory=dict)
    cwd: Optional[str] = None
    url: Optional[str] = None
    headers: dict[str, str] = field(default_factory=dict)
    enabled: bool = True
    include_tools: Optional[list[str]] = None
    exclude_tools: Optional[list[str]] = None
    requires_approval: bool = True
    # "oauth" → browser OAuth 2.1 + PKCE with Dynamic Client Registration (mcp/oauth.py).
    # HTTP transport only; tokens live in the SecretStore, never in this file.
    auth: Optional[str] = None


def global_mcp_path() -> Path:
    return state_dir() / "mcp.json"


def _read(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def _config_paths(workspace: Optional[str | Path]) -> list[Path]:
    paths = [global_mcp_path()]
    if workspace:
        paths.append(Path(workspace).expanduser() / ".coworker" / "mcp.json")
    return paths


def _parse(name: str, raw: dict[str, Any], secrets: SecretStore) -> MCPServerDef:
    raw = secrets.resolve(raw)  # resolve ${VAR} everywhere before building the def
    declared = str(raw.get("type", "")).lower()
    is_http = declared in _HTTP_TYPES or bool(raw.get("url"))
    return MCPServerDef(
        name=name,
        transport="http" if is_http else "stdio",
        command=raw.get("command"),
        args=list(raw.get("args", []) or []),
        env={str(k): str(v) for k, v in (raw.get("env") or {}).items()},
        cwd=raw.get("cwd"),
        url=raw.get("url"),
        headers={str(k): str(v) for k, v in (raw.get("headers") or {}).items()},
        enabled=bool(raw.get("enabled", True)),
        include_tools=raw.get("include_tools"),
        exclude_tools=raw.get("exclude_tools"),
        requires_approval=bool(raw.get("requires_approval", True)),
        auth=(str(raw["auth"]).lower() if raw.get("auth") else None),
    )


def load_mcp_servers(
    workspace: Optional[str | Path] = None, *, secrets: Optional[SecretStore] = None
) -> list[MCPServerDef]:
    """Merge global + workspace `mcpServers` (workspace wins) into parsed server defs."""
    secrets = secrets or SecretStore()
    merged: dict[str, dict[str, Any]] = {}
    for path in _config_paths(workspace):
        for name, raw in (_read(path).get("mcpServers") or {}).items():
            if isinstance(raw, dict):
                merged[name] = raw
    return [_parse(name, raw, secrets) for name, raw in merged.items()]


# -- raw global-file mutation (REST) -------------------------------------------
def read_global() -> dict[str, dict[str, Any]]:
    """Raw `mcpServers` map from the global file (no `${VAR}` resolution)."""
    return dict(_read(global_mcp_path()).get("mcpServers") or {})


def _write_global(servers: dict[str, dict[str, Any]]) -> None:
    path = global_mcp_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps({"mcpServers": servers}, indent=2), encoding="utf-8")
    tmp.replace(path)


def put_global_server(name: str, config: dict[str, Any]) -> None:
    servers = read_global()
    servers[name] = config
    _write_global(servers)


def patch_global_server(name: str, changes: dict[str, Any]) -> bool:
    servers = read_global()
    if name not in servers:
        return False
    servers[name] = {**servers[name], **changes}
    _write_global(servers)
    return True


def delete_global_server(name: str) -> bool:
    servers = read_global()
    if name not in servers:
        return False
    del servers[name]
    _write_global(servers)
    return True
