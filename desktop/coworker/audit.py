"""Durable local audit log for connector/tool actions."""

from __future__ import annotations

import json
import sqlite3
import threading
from pathlib import Path
from typing import Any, Optional

from .connectors import connector_for_tool

_SECRET_KEYS = (
    "token",
    "secret",
    "password",
    "api_key",
    "access_token",
    "bot_token",
    "app_token",
    "raw",
)
_BODY_KEYS = ("body", "content", "html")


class AuditStore:
    def __init__(self, db_path: str | Path) -> None:
        self.db_path = Path(db_path).expanduser()
        self._lock = threading.RLock()
        self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("""
            CREATE TABLE IF NOT EXISTS audit_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
                session_id TEXT,
                agent TEXT,
                workspace TEXT,
                connector TEXT,
                tool TEXT,
                stage TEXT,
                status TEXT,
                approval TEXT,
                args TEXT,
                result_preview TEXT,
                reason TEXT,
                resource TEXT
            )
            """)
        self._conn.commit()

    def append(self, event: dict[str, Any]) -> None:
        tool = str(event.get("tool") or event.get("tool_name") or "")
        connector = str(event.get("connector") or connector_for_tool(tool) or "")
        args = _sanitize_args(tool, event.get("arguments") or {})
        resource = _resource(
            tool, event.get("arguments") or {}, event.get("result") or {}
        )
        with self._lock:
            self._conn.execute(
                """
                INSERT INTO audit_events
                    (session_id, agent, workspace, connector, tool, stage, status, approval, args, result_preview, reason, resource)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    event.get("session_id") or "",
                    event.get("agent") or "",
                    event.get("workspace") or "",
                    connector,
                    tool,
                    event.get("stage") or "",
                    event.get("status") or "",
                    event.get("approval") or "",
                    json.dumps(args, default=str),
                    _truncate(str(event.get("result_preview") or "")),
                    _truncate(str(event.get("reason") or "")),
                    _truncate(str(resource or "")),
                ),
            )
            self._conn.commit()

    def list(
        self,
        *,
        limit: int = 100,
        session_id: Optional[str] = None,
        connector: Optional[str] = None,
        tool: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        where = []
        params: list[Any] = []
        if session_id:
            where.append("session_id = ?")
            params.append(session_id)
        if connector:
            where.append("connector = ?")
            params.append(connector)
        if tool:
            where.append("tool = ?")
            params.append(tool)
        sql = "SELECT * FROM audit_events"
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY id DESC LIMIT ?"
        params.append(max(1, min(int(limit or 100), 500)))
        with self._lock:
            rows = self._conn.execute(sql, params).fetchall()
        out = []
        for row in rows:
            item = dict(row)
            try:
                item["args"] = json.loads(item.get("args") or "{}")
            except json.JSONDecodeError:
                item["args"] = {}
            out.append(item)
        return out

    def close(self) -> None:
        self._conn.close()


def _sanitize_args(tool: str, args: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(args, dict):
        return {}
    out: dict[str, Any] = {}
    for key, value in args.items():
        lk = str(key).lower()
        if any(s in lk for s in _SECRET_KEYS):
            out[key] = "[redacted]"
        elif tool == "browser_type" and lk == "text":
            out[key] = "[redacted input]"
        elif any(b == lk or lk.endswith("_" + b) for b in _BODY_KEYS):
            out[key] = "[redacted body]"
        else:
            out[key] = _summarize(value)
    return out


def _summarize(value: Any) -> Any:
    if isinstance(value, str):
        return _truncate(value)
    if isinstance(value, (int, float, bool)) or value is None:
        return value
    if isinstance(value, list):
        return [_summarize(v) for v in value[:10]]
    if isinstance(value, dict):
        return {str(k): _summarize(v) for k, v in list(value.items())[:20]}
    return _truncate(str(value))


def _resource(tool: str, args: dict[str, Any], result: Any) -> str:
    for key in (
        "url",
        "owner",
        "repo",
        "issue_key",
        "page_id",
        "ticket_id",
        "calendar_id",
        "message_id",
    ):
        if isinstance(args, dict) and args.get(key):
            return str(args[key])
    if isinstance(args, dict) and args.get("subdomain"):
        return f"{args['subdomain']}.zendesk.com"
    if isinstance(result, dict) and result.get("url"):
        return str(result["url"])
    return ""


def _truncate(text: str, limit: int = 500) -> str:
    text = text.replace("\n", "\\n")
    return text if len(text) <= limit else text[: limit - 3] + "..."
