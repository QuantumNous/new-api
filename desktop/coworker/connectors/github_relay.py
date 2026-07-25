"""Managed GitHub relay adapter — the second consumer of the shared relay WS.

Inbound `@ocw` mentions / `ocw`-label events arrive as relay frames tagged
`provider: github` (github-relay-spec §7); the RelayHub fans them here. The
adapter maps them to MessageEvents with `github:owner/repo#N` addressing —
`installation_id` rides in `source.team_id`, so the gateway's per-team
allow-list machinery (park → allow & deliver) works unchanged, keyed by
installation instead of workspace.

Outbound (`send`) posts an issue/PR comment via the GitHub REST API with a
short-lived installation token from the token client — the reply path of the
`send_message` tool. Richer writes (reviews) are dedicated tools.

Sender identity is simpler than Slack: logins are human-readable and ride in
the payload, so there are no name-resolution calls at all.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any, Awaitable, Callable, Optional

from .base import BasePlatformAdapter, MessageEvent, SendResult, SessionSource
from .relay_client import RelayHub

logger = logging.getLogger("coworker.connectors")

# installation_id -> a fresh installation token (memory-only, never at rest).
TokenClient = Callable[[str], Awaitable[str]]


def split_thread(chat_id: str) -> tuple[str, Optional[int]]:
    """`owner/repo#N` → ("owner/repo", N); a bare repo has no thread number."""
    repo, _, num = chat_id.partition("#")
    try:
        return repo, int(num) if num else None
    except ValueError:
        return repo, None


class GitHubRelayAdapter(BasePlatformAdapter):
    platform = "github"

    def __init__(
        self,
        hub: RelayHub,
        *,
        installs: Optional[dict[str, dict[str, Any]]] = None,
        token_client: Optional[TokenClient] = None,
    ) -> None:
        super().__init__()
        self._hub = hub
        # installation_id -> {account_login, github_login, repo_selection}.
        # Mutable: a `revoked` frame drops one, an install hot-reload adds one.
        self._installs: dict[str, dict[str, Any]] = dict(installs or {})
        self._token_client = token_client
        # owner/repo -> installation_id, learned from inbound events so replies
        # to a repo mint the right installation's token.
        self._repo_installs: dict[str, str] = {}
        self.last_event_at: Optional[float] = None
        # owner/repo -> events the cloud dropped (offline > TTL / overflow);
        # surfaced via status() — GitHub has no cheap "what did I miss" pull.
        self.missed: dict[str, int] = {}

    # -- lifecycle -----------------------------------------------------------
    async def connect(self) -> bool:
        self._hub.register(self.platform, self._dispatch)
        ok = await self._hub.start()
        if ok:
            logger.info(
                "github adapter connected (managed relay), %d installation(s)",
                len(self._installs),
            )
        return ok

    async def disconnect(self) -> None:
        await self._hub.release(self.platform)

    def status(self) -> dict[str, Any]:
        """Health snapshot for the GUI: shared-socket state + per-installation
        token health (an installation revoked upstream fails its mints)."""
        return {
            "state": self._hub.state(),
            "reconnects": self._hub.reconnects,
            "last_event_at": self.last_event_at,
            "last_error": self._hub.last_error,
            "installs": {
                iid: {"token_ok": bool(info.get("token_ok", True))}
                for iid, info in self._installs.items()
            },
            "missed": dict(self.missed),
        }

    # -- installation registry ------------------------------------------------
    def set_install(self, installation_id: str, info: dict[str, Any]) -> None:
        self._installs[installation_id] = dict(info)

    def _note_token_health(self, installation_id: str, ok: bool) -> None:
        info = self._installs.get(installation_id)
        if info is not None:
            info["token_ok"] = ok

    # -- frame dispatch --------------------------------------------------------
    async def _dispatch(self, frame: dict) -> None:
        kind = frame.get("kind")
        if kind == "missed":
            repo = frame.get("channel", "")
            self.missed[repo] = self.missed.get(repo, 0) + int(
                frame.get("count", 0) or 1
            )
            logger.info(
                "github relay: %s event(s) missed in %s", frame.get("count"), repo
            )
            return
        if kind == "revoked":
            self._installs.pop(str(frame.get("installation_id", "")), None)
            logger.info(
                "github relay installation %s revoked — dropped",
                frame.get("installation_id"),
            )
            return
        await self._on_event(frame)

    async def _on_event(self, frame: dict) -> None:
        """A routed trigger (mention / label). Senders are logins — readable as
        they are, no resolution round-trips."""
        self.last_event_at = time.time()
        installation_id = str(frame.get("installation_id", ""))
        owner_repo = frame.get("owner_repo", "")
        number = frame.get("number", "")
        if not owner_repo:
            return
        if installation_id:
            self._repo_installs[owner_repo] = installation_id
        chat_id = f"{owner_repo}#{number}" if number else owner_repo
        title = frame.get("title", "")
        body = frame.get("body", "")
        kind = frame.get("kind", "mention")
        header = f"[{kind} in {owner_repo}#{number}" + (f": {title}]" if title else "]")
        event = MessageEvent(
            text=f"{header} {body}".strip(),
            source=SessionSource(
                platform=self.platform,
                chat_id=chat_id,
                user_id=frame.get("sender", ""),
                user_name=frame.get("sender", ""),
                chat_name=chat_id,
                chat_type="channel",  # a repo thread is a channel, not a DM
                team_id=installation_id,  # the allow-list scope (≙ Slack team)
            ),
            raw=frame,
        )
        await self.handle_message(event)

    # -- outbound --------------------------------------------------------------
    async def send(
        self, chat_id: str, text: str, *, thread_id: Optional[str] = None
    ) -> SendResult:
        """Comment on the issue/PR the event came from, as `ocw[bot]`."""
        owner_repo, number = split_thread(chat_id)
        if number is None:
            return SendResult(False, error=f"no issue/PR number in {chat_id!r}")
        installation_id = self._repo_installs.get(owner_repo) or next(
            iter(self._installs), ""
        )
        if not (self._token_client and installation_id):
            return SendResult(False, error="no installation token available")
        try:
            token = await self._token_client(installation_id)
        except Exception as exc:
            self._note_token_health(installation_id, False)
            return SendResult(False, error=f"token mint failed: {exc}")
        if not token:
            self._note_token_health(installation_id, False)
            return SendResult(False, error="token mint failed")

        import httpx

        base = os.environ.get("GITHUB_API_URL", "https://api.github.com").rstrip("/")
        try:
            async with httpx.AsyncClient(timeout=20) as http:
                resp = await http.post(
                    f"{base}/repos/{owner_repo}/issues/{number}/comments",
                    json={"body": text},
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Accept": "application/vnd.github+json",
                    },
                )
        except httpx.HTTPError as exc:
            return SendResult(False, error=f"github unreachable: {type(exc).__name__}")
        if resp.status_code == 401:
            self._note_token_health(installation_id, False)
            return SendResult(False, error="installation token rejected")
        if resp.status_code not in (200, 201):
            return SendResult(
                False, error=f"github comment failed ({resp.status_code})"
            )
        self._note_token_health(installation_id, True)
        return SendResult(True, message_id=str((resp.json() or {}).get("id", "")))
