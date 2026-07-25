"""Managed-relay inbound adapter — the cloud-relay alternative to Socket Mode.

The desktop offers the user two ways to receive Slack:
- **Socket Mode** (`SlackAdapter`): manual bot + app tokens, one workspace, a
  direct WebSocket to Slack. No cloud involved.
- **Managed relay** (`SlackRelayAdapter`, here): "Add to Slack" OAuth, no tokens
  typed, *many* workspaces, events pushed from OpenWorker Cloud over one
  authenticated WebSocket. Replies still go desktop → Slack Web API directly
  with the per-team bot token (the relay is inbound-only).

Both register on the gateway as platform ``slack`` and produce the same
``MessageEvent``/``InteractionEvent`` — downstream code doesn't care which mode
delivered a message. Managed-relay reply handles are **team-qualified**
(``slack:T…/C…``) so multi-workspace replies pick the right token (see
``slack_addr``).

The socket transport is injectable so the frame-handling logic is tested with a
fake relay (no live WebSocket); the default transport is a thin ``websockets``
client, lazy-imported like the Socket-Mode SDK.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
from typing import Any, Awaitable, Callable, Optional, Protocol

from .adapters import _SLACK_MENTION_RE, slack_event_to_event
from .base import BasePlatformAdapter, InteractionEvent, SendResult, SessionSource
from .senders import _send_slack, _send_slack_interactive
from .slack_addr import qualify

logger = logging.getLogger("coworker.connectors")


class RelayTransport(Protocol):
    """One live connection to the cloud relay. Implementations lazy-import their
    WebSocket library; the frame contract is decoded JSON dicts."""

    async def open(self) -> None: ...
    async def recv(self) -> Optional[dict]:
        """Next frame, or None when the connection has closed."""
        ...

    async def close(self) -> None: ...


TransportFactory = Callable[[], RelayTransport]

# Slack errors that mean the BOT TOKEN is dead (uninstalled/revoked/suspended) —
# distinct from transient network or method errors, which say nothing about it.
_TOKEN_ERRORS = frozenset({"invalid_auth", "account_inactive", "token_revoked"})
TokenProvider = Callable[[], str]  # returns the current cloud sign-in JWT
# team_id, channel, count -> list of raw Slack message dicts (newest last)
HistoryFetcher = Callable[[str, str, int], Awaitable[list[dict]]]


class RelayHub:
    """The ONE desktop↔cloud relay socket, shared by every provider adapter.

    The cloud pushes all of a user's events down a single authenticated WS;
    frames fan out here by their `provider` tag (slack / github / …). Owns the
    transport, the read loop, and the reconnect watchdog — adapters own only
    their provider's frame handling. Extracted from SlackRelayAdapter when
    GitHub became the second relay provider (github-relay-spec §8)."""

    _RECONNECT_DELAY = 2.0

    def __init__(
        self,
        relay_url: str,
        token_provider: TokenProvider,
        *,
        transport_factory: Optional[TransportFactory] = None,
        reconnect_delay: Optional[float] = None,
    ) -> None:
        self.relay_url = relay_url
        self._token_provider = token_provider
        self._transport_factory = transport_factory or self._default_transport_factory
        self._reconnect_delay = (
            reconnect_delay if reconnect_delay is not None else self._RECONNECT_DELAY
        )
        self._handlers: dict[str, Callable[[dict], Awaitable[None]]] = {}
        self._transport: Optional[RelayTransport] = None
        self._task: Optional[asyncio.Task] = None
        self._closing = False
        self._connections = 0  # total successful opens; reconnects == connections-1
        self._connected = False  # the desktop↔relay socket is open RIGHT NOW
        self._dispatched = 0  # frames dispatched (observable for tests)
        self.last_error: str = ""  # last connect/reconnect failure ("" once healthy)
        self._progress = asyncio.Event()

    def register(
        self, provider: str, handler: Callable[[dict], Awaitable[None]]
    ) -> None:
        self._handlers[provider] = handler

    async def release(self, provider: str) -> None:
        """An adapter is done; the socket closes when the last one leaves."""
        self._handlers.pop(provider, None)
        if not self._handlers:
            await self.stop()

    # -- lifecycle -----------------------------------------------------------
    async def start(self) -> bool:
        """Open the socket (idempotent — the second adapter joins the running
        loop). True when the socket is up or already running."""
        if self._task is not None and not self._task.done():
            return True
        self._closing = False
        self._transport = self._transport_factory()
        try:
            await self._transport.open()
        except Exception as exc:
            logger.exception("relay connect failed")
            self.last_error = str(exc) or type(exc).__name__
            return False
        self._connections = 1
        self._connected = True
        self.last_error = ""
        self._task = asyncio.create_task(self._run())
        return True

    async def _run(self) -> None:
        """Read frames; on a dropped connection, reconnect (fresh transport) —
        the relay's own watchdog analogue on the desktop side."""
        while not self._closing:
            try:
                frame = await self._transport.recv() if self._transport else None
            except Exception:
                logger.exception("relay recv error")
                frame = None
            if frame is not None:
                handler = self._handlers.get(frame.get("provider") or "slack")
                if handler is not None:
                    try:
                        await handler(frame)
                    except Exception:
                        logger.exception("relay frame dispatch failed")
                self._dispatched += 1
                self._progress.set()
                continue
            # Connection closed → reconnect unless we're shutting down.
            self._connected = False
            if self._closing:
                break
            await self._reconnect()

    async def _reconnect(self) -> None:
        try:
            await asyncio.sleep(self._reconnect_delay)
        except asyncio.CancelledError:
            return
        if self._closing:
            return
        self._transport = self._transport_factory()
        try:
            await self._transport.open()
            self._connections += 1
            self._connected = True
            self.last_error = ""
            logger.info("relay reconnected (#%d)", self._connections - 1)
        except Exception as exc:
            self.last_error = str(exc) or type(exc).__name__
            logger.exception("relay reconnect failed — will retry")

    async def stop(self) -> None:
        self._closing = True
        self._connected = False
        if self._transport is not None:
            try:
                await self._transport.close()
            except Exception:
                pass
        if self._task is not None:
            self._task.cancel()
            self._task = None

    @property
    def reconnects(self) -> int:
        return max(0, self._connections - 1)

    def state(self) -> str:
        if self._connected:
            return "live"
        if self._task is not None and not self._closing:
            return "reconnecting"
        return "offline"

    async def wait_dispatched(self, at_least: int, timeout: float = 2.0) -> None:
        """Test helper: wait until at least N frames have been dispatched."""
        loop = asyncio.get_event_loop()
        deadline = loop.time() + timeout
        while self._dispatched < at_least:
            self._progress.clear()
            remaining = deadline - loop.time()
            if remaining <= 0:
                raise TimeoutError(
                    f"only {self._dispatched} frames dispatched (< {at_least})"
                )
            try:
                await asyncio.wait_for(self._progress.wait(), timeout=remaining)
            except asyncio.TimeoutError:
                raise TimeoutError(
                    f"only {self._dispatched} frames dispatched (< {at_least})"
                )

    # -- default transport ---------------------------------------------------
    def _default_transport_factory(self) -> RelayTransport:
        return _WebSocketsTransport(self.relay_url, self._token_provider)


class SlackRelayAdapter(BasePlatformAdapter):
    platform = "slack"

    def __init__(
        self,
        relay_url: str,
        token_provider: TokenProvider,
        *,
        teams: Optional[dict[str, dict[str, Any]]] = None,
        transport_factory: Optional[TransportFactory] = None,
        history_fetcher: Optional[HistoryFetcher] = None,
        reconnect_delay: Optional[float] = None,
        hub: Optional[RelayHub] = None,
    ) -> None:
        super().__init__()
        self.relay_url = relay_url
        # A shared hub arrives when several relay providers coexist; standalone
        # construction (tests, single-provider setups) builds its own.
        self._hub = hub or RelayHub(
            relay_url,
            token_provider,
            transport_factory=transport_factory,
            reconnect_delay=reconnect_delay,
        )
        # team_id -> {"bot_token", "bot_user_id"}. Mutable: a `revoked` frame or a
        # new install updates it.
        self._teams: dict[str, dict[str, Any]] = dict(teams or {})
        self._history_fetcher = history_fetcher
        self.last_event_at: Optional[float] = None  # last Slack event delivered
        # Name resolution caches, keyed PER WORKSPACE — a U…/C… id only means
        # something inside its team, and resolution uses that team's bot token.
        self._names: dict[str, dict[str, str]] = {}  # team_id -> {uid: name}
        self._channels: dict[str, dict[str, str]] = {}  # team_id -> {cid: name}

    # -- lifecycle -----------------------------------------------------------
    async def connect(self) -> bool:
        self._hub.register(self.platform, self._dispatch)
        ok = await self._hub.start()
        if ok:
            logger.info(
                "slack adapter connected (managed relay), %d team(s)", len(self._teams)
            )
        return ok

    async def disconnect(self) -> None:
        await self._hub.release(self.platform)

    @property
    def reconnects(self) -> int:
        return self._hub.reconnects

    @property
    def last_error(self) -> str:
        return self._hub.last_error

    def status(self) -> dict[str, Any]:
        """Health snapshot for the GUI: the desktop↔relay socket state plus each
        workspace's bot-token health. Says nothing about Slack↔cloud — the desktop
        can't observe that leg, and event silence is not an outage."""
        return {
            "state": self._hub.state(),
            "reconnects": self._hub.reconnects,
            "last_event_at": self.last_event_at,
            "last_error": self._hub.last_error,
            "teams": {
                tid: {"token_ok": bool(info.get("token_ok", True))}
                for tid, info in self._teams.items()
            },
        }

    async def wait_dispatched(self, at_least: int, timeout: float = 2.0) -> None:
        await self._hub.wait_dispatched(at_least, timeout)

    # -- team registry -------------------------------------------------------
    def set_team(
        self, team_id: str, bot_token: str, bot_user_id: Optional[str] = None
    ) -> None:
        self._teams[team_id] = {"bot_token": bot_token, "bot_user_id": bot_user_id}

    def _bot_user_id(self, team_id: str) -> Optional[str]:
        return (self._teams.get(team_id) or {}).get("bot_user_id")

    def _bot_token(self, team_id: str) -> Optional[str]:
        return (self._teams.get(team_id) or {}).get("bot_token")

    # -- frame dispatch ------------------------------------------------------
    async def _dispatch(self, frame: dict) -> None:
        kind = frame.get("kind")
        if kind == "missed":
            await self._on_missed(frame)
            return
        if kind == "revoked":
            self._teams.pop(frame.get("team_id", ""), None)
            logger.info("slack relay team %s revoked — dropped", frame.get("team_id"))
            return
        if kind == "interactivity":
            await self._on_interactivity(frame)
            return
        # A routed Slack event.
        await self._on_event(frame)

    async def _on_event(self, frame: dict) -> None:
        await self._dispatch_slack_event(
            frame.get("team_id", ""), frame.get("event") or {}
        )

    async def _dispatch_slack_event(self, team_id: str, event: dict) -> None:
        """Map a raw Slack event → MessageEvent, resolve display names via the
        per-team bot token, team-qualify the reply handle, and dispatch."""
        self.last_event_at = time.time()
        mapped = slack_event_to_event(event, self._bot_user_id(team_id))
        if mapped is None:
            return
        channel = mapped.source.chat_id  # bare channel id before qualification
        # Resolve friendly names with THIS workspace's bot token (cached per team),
        # mirroring the Socket-Mode adapter — so cards read "@OpenWorker"/"Rohit"/"#ocw-test"
        # not raw U…/C… ids. Best-effort: ids fall through on failure.
        if not mapped.source.user_name:
            mapped.source.user_name = await self._display_name(
                team_id, mapped.source.user_id
            )
        if not mapped.source.chat_name:
            mapped.source.chat_name = await self._channel_name(team_id, channel)
        mapped.text = await self._resolve_mentions(team_id, mapped.text)
        # Team-qualify the reply handle so multi-workspace replies pick the right
        # per-team token.
        mapped.source.chat_id = qualify(team_id, channel)
        mapped.source.team_id = team_id
        await self.handle_message(mapped)

    async def _on_interactivity(self, frame: dict) -> None:
        interaction = frame.get("interaction") or {}
        actions = interaction.get("actions") or [{}]
        value = actions[0].get("value", "")
        user = interaction.get("user") or {}
        team_id = frame.get("team_id", "")
        channel = (interaction.get("channel") or {}).get("id", "")
        ts = (interaction.get("message") or {}).get("ts")
        await self.handle_interaction(
            InteractionEvent(
                platform="slack",
                chat_id=qualify(team_id, channel),
                message_id=ts,
                value=str(value),
                user_name=user.get("username") or user.get("name"),
            )
        )

    async def _on_missed(self, frame: dict) -> None:
        """A nudge: content was dropped (offline > TTL / overflow). Pull the
        recent channel history ourselves via the per-team bot token and replay
        the missed messages (spec §7 channel-context / nudge)."""
        team_id = frame.get("team_id", "")
        channel = frame.get("channel", "")
        count = int(frame.get("count", 0)) or 1
        if self._history_fetcher is None or not channel:
            return
        try:
            messages = await self._history_fetcher(team_id, channel, count)
        except Exception:
            logger.exception("relay nudge history fetch failed")
            return
        for raw in messages:
            await self._dispatch_slack_event(team_id, {**raw, "channel": channel})

    def _note_token_health(self, team_id: str, error: Optional[str]) -> None:
        """Record what a Web API call said about the team's bot token: success
        proves it live; a token-class error marks it dead; anything else —
        network trouble, channel_not_found — says nothing, so changes nothing."""
        info = self._teams.get(team_id)
        if info is None:
            return
        if error is None:
            info["token_ok"] = True
        elif error in _TOKEN_ERRORS:
            info["token_ok"] = False

    # -- name resolution (per workspace, via that team's bot token) ----------
    async def _slack_get(
        self, team_id: str, method: str, params: dict
    ) -> Optional[dict]:
        """Call a Slack Web API read method with the team's bot token. Best-effort
        (None on any failure). `SLACK_API_URL` redirects to the fake in tests."""
        import httpx

        token = self._bot_token(team_id)
        if not token:
            return None
        base = os.environ.get("SLACK_API_URL", "https://slack.com/api/")
        try:
            async with httpx.AsyncClient(timeout=15) as http:
                resp = await http.get(
                    base + method,
                    params=params,
                    headers={"Authorization": f"Bearer {token}"},
                )
            data = resp.json()
        except Exception:
            return None
        self._note_token_health(team_id, None if data.get("ok") else data.get("error"))
        return data if data.get("ok") else None

    async def _display_name(self, team_id: str, uid: Optional[str]) -> Optional[str]:
        if not uid:
            return None
        cache = self._names.setdefault(team_id, {})
        if uid in cache:
            return cache[uid]
        data = await self._slack_get(team_id, "users.info", {"user": uid})
        u = (data or {}).get("user") or {}
        prof = u.get("profile") or {}
        name = (
            prof.get("display_name")
            or prof.get("real_name")
            or u.get("real_name")
            or u.get("name")
        )
        if name:
            cache[uid] = name
        return name

    async def _channel_name(self, team_id: str, cid: Optional[str]) -> Optional[str]:
        if not cid:
            return None
        cache = self._channels.setdefault(team_id, {})
        if cid in cache:
            return cache[cid]
        data = await self._slack_get(team_id, "conversations.info", {"channel": cid})
        chan = (data or {}).get("channel") or {}
        name = chan.get("name") or chan.get("name_normalized")
        if name:
            cache[cid] = name
        return name

    async def _resolve_mentions(self, team_id: str, text: str) -> str:
        """Rewrite `<@U…>` tokens to `@display-name` (cached). Best-effort."""
        out = text
        for uid in set(_SLACK_MENTION_RE.findall(text or "")):
            name = await self._display_name(team_id, uid)
            if name:
                out = re.sub(rf"<@{re.escape(uid)}(?:\|[^>]*)?>", f"@{name}", out)
        return out

    # -- outbound ------------------------------------------------------------
    async def send(
        self, chat_id: str, text: str, *, thread_id: Optional[str] = None
    ) -> SendResult:
        """Reply directly via the Slack Web API with the per-team bot token."""
        from .slack_addr import split

        team_id, _channel = split(chat_id)
        token = self._bot_token(team_id or "")
        if not token:
            return SendResult(False, error=f"no bot token for team {team_id}")
        result = await asyncio.to_thread(_send_slack, token, chat_id, text, thread_id)
        self._note_token_health(team_id or "", None if result.ok else result.error)
        return result

    async def send_interactive(
        self, chat_id: str, text: str, buttons, *, thread_id: Optional[str] = None
    ) -> SendResult:
        from .slack_addr import split

        team_id, _channel = split(chat_id)
        token = self._bot_token(team_id or "")
        if not token:
            return SendResult(False, error=f"no bot token for team {team_id}")
        result = await asyncio.to_thread(
            _send_slack_interactive, token, chat_id, text, buttons, thread_id
        )
        self._note_token_health(team_id or "", None if result.ok else result.error)
        return result


class _WebSocketsTransport:
    """Real transport: an authenticated `websockets` client. Sends the cloud
    sign-in JWT in the Authorization header (the relay's $connect authorizer)."""

    def __init__(self, url: str, token_provider: TokenProvider) -> None:
        self._url = url
        self._token_provider = token_provider
        self._ws = None

    async def open(self) -> None:
        import websockets  # lazy: optional extra

        token = self._token_provider()
        self._ws = await websockets.connect(
            self._url, additional_headers={"Authorization": f"Bearer {token}"}
        )

    async def recv(self) -> Optional[dict]:
        import websockets

        if self._ws is None:
            return None
        try:
            raw = await self._ws.recv()
        except websockets.ConnectionClosed:
            return None
        try:
            return json.loads(raw)
        except (ValueError, TypeError):
            return None

    async def close(self) -> None:
        if self._ws is not None:
            try:
                await self._ws.close()
            except Exception:
                pass
            self._ws = None
