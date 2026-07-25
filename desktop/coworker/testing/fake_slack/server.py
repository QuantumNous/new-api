"""FakeSlack — a controllable, in-process test double for the slices of Slack we use.

Implements just enough of the Web API + Socket Mode envelope protocol for the real
``SlackAdapter`` / ``slack_bolt.AsyncApp`` to run end-to-end with **no network, tokens, or the
Slack app console**. Built on Starlette + uvicorn (both already core deps) and served on an
ephemeral port via an in-process ``uvicorn.Server`` background task.

See ``platform/docs/FAKE-SLACK-SPEC.md``. The adapter is pointed at the fake via the
``SLACK_API_URL`` base-URL override (env), which redirects every Web API call — including
Socket Mode's ``apps.connections.open``, so the fake decides the WebSocket URL.

Two ways to drive it:

* **Programmatic** (embedded in pytest): the :class:`FakeSlack` object exposes
  ``add_user/add_channel/inbound/interaction/outbound/reset`` — no HTTP needed.
* **HTTP control API** (standalone runner / curl): ``/control/*`` endpoints mirror those.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from typing import Any, Optional

import uvicorn
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route, WebSocketRoute
from starlette.websockets import WebSocket, WebSocketDisconnect

logger = logging.getLogger("coworker.testing.fake_slack")

# Fake identities — stable so tests can assert on them.
BOT_USER_ID = "U_BOT"
TEAM_ID = "T_FAKE"
APP_ID = "A_FAKE"
VERIFICATION_TOKEN = "fake-verification-token"


def _maybe_json(value: Any) -> Any:
    """Form-encoded Slack params arrive as strings; ``blocks`` is then a JSON string. The
    SDK web client posts form data, the stateless senders post JSON — coerce either."""
    if isinstance(value, str) and value[:1] in "[{":
        try:
            return json.loads(value)
        except Exception:
            return value
    return value


class FakeSlack:
    """A running fake Slack. Start it (ephemeral port), point ``SLACK_API_URL`` at
    ``self.api_url``, drive scenarios, inspect ``self.outbound()``."""

    def __init__(self, host: str = "127.0.0.1", port: int = 0) -> None:
        self.host = host
        self.port = port  # 0 => ephemeral; filled in by start()
        self.bot_user_id = BOT_USER_ID

        self.users: dict[str, dict] = {}
        self.channels: dict[str, dict] = {}
        self._outbound: list[dict] = []
        self._acks: list[dict] = []
        self.unknown_methods: list[str] = []
        self.api_calls: list[str] = (
            []
        )  # every Web API method, in order (caching assertions)

        self._sockets: set[WebSocket] = set()
        self._socket_connected = asyncio.Event()
        self._socket_connections = 0  # total Socket Mode connects (tracks reconnects)
        self._ts_base = 1_700_000_000
        self._ts_seq = 0

        self.app = self._build_app()
        self._server: Optional[uvicorn.Server] = None
        self._serve_task: Optional[asyncio.Task] = None

    # -- identity / urls -------------------------------------------------------
    @property
    def api_url(self) -> str:
        """The value to export as ``SLACK_API_URL`` (note the trailing slash)."""
        return f"http://{self.host}:{self.port}/api/"

    @property
    def ws_url(self) -> str:
        return f"ws://{self.host}:{self.port}/socket"

    @property
    def control_url(self) -> str:
        return f"http://{self.host}:{self.port}/control"

    def _next_ts(self) -> str:
        self._ts_seq += 1
        return f"{self._ts_base + self._ts_seq}.{self._ts_seq:06d}"

    # -- lifecycle -------------------------------------------------------------
    async def start(self) -> "FakeSlack":
        """Serve in-process on an ephemeral port; resolve the bound port."""
        config = uvicorn.Config(
            self.app,
            host=self.host,
            port=self.port,
            log_level="warning",
            lifespan="off",
            access_log=False,
        )
        self._server = uvicorn.Server(config)
        self._serve_task = asyncio.create_task(self._server.serve())
        # Wait for the socket to bind, then read the actual (possibly ephemeral) port.
        while not self._server.started:
            await asyncio.sleep(0.01)
        sock = self._server.servers[0].sockets[0]
        self.port = sock.getsockname()[1]
        return self

    async def stop(self) -> None:
        for ws in list(self._sockets):
            try:
                await ws.close()
            except Exception:
                pass
        self._sockets.clear()
        if self._server is not None:
            self._server.should_exit = True
        if self._serve_task is not None:
            try:
                await asyncio.wait_for(self._serve_task, timeout=5)
            except Exception:
                self._serve_task.cancel()
        self._server = None
        self._serve_task = None

    async def __aenter__(self) -> "FakeSlack":
        return await self.start()

    async def __aexit__(self, *exc) -> None:
        await self.stop()

    # -- programmatic control API ----------------------------------------------
    def add_user(
        self,
        id: str,
        name: str,
        real_name: Optional[str] = None,
        display_name: Optional[str] = None,
    ) -> None:
        real = real_name or name
        self.users[id] = {
            "id": id,
            "name": name,
            "real_name": real,
            "profile": {
                "display_name": display_name or name,
                "real_name": real,
            },
        }

    def add_channel(self, id: str, name: str, is_im: bool = False) -> None:
        self.channels[id] = {"id": id, "name": name, "is_im": bool(is_im)}

    async def wait_socket(self, timeout: float = 5.0) -> None:
        """Block until at least one Socket Mode client has connected (and been sent hello)."""
        await asyncio.wait_for(self._socket_connected.wait(), timeout=timeout)

    @property
    def socket_connections(self) -> int:
        """Total Socket Mode connects so far — a reconnect bumps this."""
        return self._socket_connections

    async def wait_socket_connections(
        self, at_least: int, timeout: float = 5.0
    ) -> None:
        """Block until the client has connected `at_least` times (used to await a reconnect)."""
        deadline = asyncio.get_event_loop().time() + timeout
        while self._socket_connections < at_least:
            if asyncio.get_event_loop().time() > deadline:
                raise asyncio.TimeoutError(
                    f"only {self._socket_connections} socket connects (< {at_least})"
                )
            await asyncio.sleep(0.02)

    async def close_sockets(self) -> None:
        """Drop every live Socket Mode connection from the server side — simulates Slack cycling
        the connection so a reconnect (slack_sdk's or our watchdog's) has to re-establish it.
        """
        for ws in list(self._sockets):
            try:
                await ws.close()
            except Exception:
                pass
        self._sockets.clear()
        self._socket_connected.clear()

    async def inbound(
        self,
        channel: str,
        user: str,
        text: str,
        thread_ts: Optional[str] = None,
        channel_type: Optional[str] = None,
    ) -> str:
        """Push a user message over Socket Mode as an ``events_api`` envelope. Returns its ts."""
        if channel_type is None:
            ch = self.channels.get(channel)
            channel_type = "im" if (ch and ch.get("is_im")) else "channel"
        ts = self._next_ts()
        event: dict = {
            "type": "message",
            "channel": channel,
            "channel_type": channel_type,
            "user": user,
            "text": text,
            "ts": ts,
            "event_ts": ts,
        }
        if thread_ts:
            event["thread_ts"] = thread_ts
        envelope = {
            "envelope_id": str(uuid.uuid4()),
            "type": "events_api",
            "accepts_response_payload": False,
            "retry_attempt": 0,
            "retry_reason": "",
            "payload": {
                "token": VERIFICATION_TOKEN,
                "team_id": TEAM_ID,
                "api_app_id": APP_ID,
                "event": event,
                "type": "event_callback",
                "event_id": "Ev" + uuid.uuid4().hex[:10].upper(),
                "event_time": int(time.time()),
                "authorizations": [
                    {
                        "enterprise_id": None,
                        "team_id": TEAM_ID,
                        "user_id": self.bot_user_id,
                        "is_bot": True,
                        "is_enterprise_install": False,
                    }
                ],
            },
        }
        await self._push(envelope)
        return ts

    async def interaction(
        self,
        channel: str,
        user: str,
        username: str,
        message_ts: str,
        action_id: str,
        value: str,
    ) -> None:
        """Push a Block Kit button click over Socket Mode as an ``interactive`` envelope."""
        ch = self.channels.get(channel) or {}
        envelope = {
            "envelope_id": str(uuid.uuid4()),
            "type": "interactive",
            "accepts_response_payload": True,
            "payload": {
                "type": "block_actions",
                "token": VERIFICATION_TOKEN,
                "api_app_id": APP_ID,
                "user": {"id": user, "username": username, "name": username},
                "team": {"id": TEAM_ID, "domain": "fake"},
                "enterprise": None,
                "is_enterprise_install": False,
                "container": {
                    "type": "message",
                    "message_ts": message_ts,
                    "channel_id": channel,
                    "is_ephemeral": False,
                },
                "trigger_id": "trigger-" + uuid.uuid4().hex,
                "channel": {"id": channel, "name": ch.get("name", "channel")},
                "message": {
                    "type": "message",
                    "user": self.bot_user_id,
                    "ts": message_ts,
                    "text": "",
                    "team": TEAM_ID,
                    "blocks": [],
                },
                "state": {"values": {}},
                "response_url": f"{self.api_url}responses/{uuid.uuid4().hex}",
                "actions": [
                    {
                        "type": "button",
                        "action_id": action_id,
                        "block_id": "blk",
                        "text": {"type": "plain_text", "text": "Button"},
                        "value": value,
                        "action_ts": self._next_ts(),
                    }
                ],
            },
        }
        await self._push(envelope)

    def outbound(self) -> list[dict]:
        """The recorded ``chat.postMessage`` / ``chat.update`` calls (most-recent last)."""
        return list(self._outbound)

    def acks(self) -> list[dict]:
        return list(self._acks)

    async def reset(self) -> None:
        """Clear users/channels/recorded calls and drop sockets — a clean slate between tests."""
        self.users.clear()
        self.channels.clear()
        self._outbound.clear()
        self._acks.clear()
        self.unknown_methods.clear()
        self.api_calls.clear()
        for ws in list(self._sockets):
            try:
                await ws.close()
            except Exception:
                pass
        self._sockets.clear()

    # -- socket fan-out --------------------------------------------------------
    async def _push(self, envelope: dict) -> None:
        raw = json.dumps(envelope)
        dead = []
        for ws in list(self._sockets):
            try:
                await ws.send_text(raw)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._sockets.discard(ws)

    # -- Web API ---------------------------------------------------------------
    async def _api_params(self, request: Request) -> dict:
        # slack_sdk uses GET (query params) for read methods like users.info/conversations.info
        # and POST for the rest; the stateless senders POST JSON. Merge all three sources.
        params: dict = {k: _maybe_json(v) for k, v in request.query_params.items()}
        ctype = request.headers.get("content-type", "")
        if "application/json" in ctype:
            try:
                body = await request.json()
                if isinstance(body, dict):
                    params.update(body)
            except Exception:
                pass
        else:
            try:
                form = await request.form()
                params.update({k: _maybe_json(v) for k, v in form.items()})
            except Exception:
                pass
        return params

    def _dispatch_api(self, method: str, params: dict) -> dict:
        self.api_calls.append(method)
        if method == "auth.test":
            return {
                "ok": True,
                "url": "https://fake.slack.local/",
                "team": "FakeTeam",
                "user": "fakebot",
                "team_id": TEAM_ID,
                "user_id": self.bot_user_id,
                "bot_id": "B_FAKE",
                "is_enterprise_install": False,
            }
        if method == "apps.connections.open":
            return {"ok": True, "url": self.ws_url}
        if method == "users.info":
            user = self.users.get(str(params.get("user", "")))
            if user is None:
                return {"ok": False, "error": "user_not_found"}
            return {"ok": True, "user": user}
        if method == "conversations.info":
            ch = self.channels.get(str(params.get("channel", "")))
            if ch is None:
                return {"ok": False, "error": "channel_not_found"}
            return {"ok": True, "channel": ch}
        if method == "chat.postMessage":
            ts = self._next_ts()
            self._outbound.append(
                {
                    "method": "chat.postMessage",
                    "channel": params.get("channel"),
                    "text": params.get("text"),
                    "blocks": _maybe_json(params.get("blocks")),
                    "thread_ts": params.get("thread_ts"),
                    "ts": ts,
                }
            )
            return {"ok": True, "ts": ts, "channel": params.get("channel")}
        if method == "chat.update":
            ts = params.get("ts") or self._next_ts()
            self._outbound.append(
                {
                    "method": "chat.update",
                    "channel": params.get("channel"),
                    "text": params.get("text"),
                    "blocks": _maybe_json(params.get("blocks")),
                    "ts": ts,
                }
            )
            return {"ok": True, "ts": ts, "channel": params.get("channel")}
        # Unknown method: no-op but surface the gap.
        self.unknown_methods.append(method)
        logger.info(
            "FakeSlack: unhandled Web API method %s (params=%s)", method, params
        )
        return {"ok": True}

    async def _api_endpoint(self, request: Request) -> JSONResponse:
        method = request.path_params["method"]
        params = await self._api_params(request)
        return JSONResponse(self._dispatch_api(method, params))

    # -- Socket Mode WebSocket -------------------------------------------------
    async def _socket_endpoint(self, websocket: WebSocket) -> None:
        await websocket.accept()
        # Slack greets a new Socket Mode connection with a hello.
        await websocket.send_text(
            json.dumps(
                {
                    "type": "hello",
                    "num_connections": 1,
                    "connection_info": {"app_id": APP_ID},
                }
            )
        )
        self._sockets.add(websocket)
        self._socket_connections += 1
        self._socket_connected.set()
        try:
            while True:
                raw = await websocket.receive_text()
                try:
                    self._acks.append(json.loads(raw))
                except Exception:
                    pass
        except WebSocketDisconnect:
            pass
        except Exception:
            logger.debug("FakeSlack socket closed", exc_info=True)
        finally:
            self._sockets.discard(websocket)

    # -- control HTTP API ------------------------------------------------------
    async def _ctl_users(self, request: Request) -> JSONResponse:
        b = await request.json()
        self.add_user(b["id"], b["name"], b.get("real_name"), b.get("display_name"))
        return JSONResponse({"ok": True})

    async def _ctl_channels(self, request: Request) -> JSONResponse:
        b = await request.json()
        self.add_channel(b["id"], b["name"], bool(b.get("is_im")))
        return JSONResponse({"ok": True})

    async def _ctl_inbound(self, request: Request) -> JSONResponse:
        b = await request.json()
        ts = await self.inbound(
            channel=b["channel"],
            user=b["user"],
            text=b["text"],
            thread_ts=b.get("thread_ts"),
            channel_type=b.get("channel_type"),
        )
        return JSONResponse({"ok": True, "ts": ts})

    async def _ctl_interaction(self, request: Request) -> JSONResponse:
        b = await request.json()
        await self.interaction(
            channel=b["channel"],
            user=b["user"],
            username=b.get("username") or b["user"],
            message_ts=b["message_ts"],
            action_id=b["action_id"],
            value=b.get("value", ""),
        )
        return JSONResponse({"ok": True})

    async def _ctl_outbound(self, request: Request) -> JSONResponse:
        return JSONResponse({"outbound": self.outbound()})

    async def _ctl_reset(self, request: Request) -> JSONResponse:
        await self.reset()
        return JSONResponse({"ok": True})

    async def _ctl_health(self, request: Request) -> JSONResponse:
        return JSONResponse({"ok": True, "sockets": len(self._sockets)})

    # -- app wiring ------------------------------------------------------------
    def _build_app(self) -> Starlette:
        routes = [
            Route("/api/{method}", self._api_endpoint, methods=["GET", "POST"]),
            WebSocketRoute("/socket", self._socket_endpoint),
            Route("/control/users", self._ctl_users, methods=["POST"]),
            Route("/control/channels", self._ctl_channels, methods=["POST"]),
            Route("/control/inbound", self._ctl_inbound, methods=["POST"]),
            Route("/control/interaction", self._ctl_interaction, methods=["POST"]),
            Route("/control/outbound", self._ctl_outbound, methods=["GET"]),
            Route("/control/reset", self._ctl_reset, methods=["POST"]),
            Route("/control/health", self._ctl_health, methods=["GET"]),
        ]
        return Starlette(routes=routes)
