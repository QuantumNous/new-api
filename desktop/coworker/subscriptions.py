"""Channel subscriptions — the INBOUND counterpart of Inbox routing (which is outbound).

A subscription is a persisted ``(session_id, channel)`` record: a durable session opts in to
*listen* to a messaging channel. Many sessions may subscribe to one channel (two agents, two
reactions). It is permanent until the user or the agent explicitly unsubscribes (deleting the
session also clears its subscriptions). Delivery wakes the subscribed session via the same
busy→steer / idle→background-turn path as self-wake — no live socket required.

`channel` is the address ``"<platform>:<chat_id>"`` (e.g. ``"slack:C0123"``), matching the
gateway's `format_target` / `parse_target`.

NOTE: this is *not* Inbox routing. Routing mirrors an agent's approvals/questions OUT to a
DM/channel (request↔reply, `[ow:id]`-correlated); a subscription brings a channel's messages IN
(broadcast). Keep them on different channels — pointing your Inbox at a channel you also subscribe
to conflates the two directions.
"""

from __future__ import annotations

import json
import re
import threading
from collections import deque
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class Subscription:
    session_id: str
    channel: str  # "<platform>:<chat_id>"
    # Reserved for the later refinement (e.g. "all" vs "mentions"); v1 always delivers all.
    filter: str = "all"


class SubscriptionStore:
    def __init__(self, path: Optional[str | Path] = None) -> None:
        self.path = Path(path) if path else None
        self._lock = threading.Lock()
        self._subs: list[Subscription] = []
        self._load()

    def _load(self) -> None:
        if self.path and self.path.is_file():
            data = json.loads(self.path.read_text(encoding="utf-8"))
            self._subs = [Subscription(**raw) for raw in data.get("subscriptions", [])]

    def _save(self) -> None:
        if not self.path:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(
            json.dumps({"subscriptions": [asdict(s) for s in self._subs]}, indent=2),
            encoding="utf-8",
        )

    # -- mutations --------------------------------------------------------------
    def subscribe(
        self, session_id: str, channel: str, *, filter: str = "all"
    ) -> Subscription:
        with self._lock:
            for s in self._subs:
                if s.session_id == session_id and s.channel == channel:
                    s.filter = filter
                    self._save()
                    return s
            sub = Subscription(session_id=session_id, channel=channel, filter=filter)
            self._subs.append(sub)
            self._save()
            return sub

    def unsubscribe(self, session_id: str, channel: str) -> bool:
        with self._lock:
            before = len(self._subs)
            self._subs = [
                s
                for s in self._subs
                if not (s.session_id == session_id and s.channel == channel)
            ]
            changed = len(self._subs) != before
            if changed:
                self._save()
            return changed

    def remove_session(self, session_id: str) -> None:
        """Drop all of a session's subscriptions (called when the session is deleted)."""
        with self._lock:
            before = len(self._subs)
            self._subs = [s for s in self._subs if s.session_id != session_id]
            if len(self._subs) != before:
                self._save()

    # -- queries ----------------------------------------------------------------
    def for_channel(self, channel: str) -> list[Subscription]:
        return [s for s in self._subs if s.channel == channel]

    def for_session(self, session_id: str) -> list[Subscription]:
        return [s for s in self._subs if s.session_id == session_id]

    def all(self) -> list[Subscription]:
        return list(self._subs)


# -- channel reference parsing --------------------------------------------------
# Slack encodes a typed `#channel` as `<#C0123|name>`; the id is right there in the user's answer.
_SLACK_CHANNEL_RE = re.compile(r"<#(C[A-Z0-9]+)\|?[^>]*>")
# Slack's "Copy link" for a channel: https://acme.slack.com/archives/C0123ABC — the id is the
# path segment. Accepting the paste beats asking users to dig the id out of the About tab.
_SLACK_ARCHIVES_RE = re.compile(r"slack\.com/archives/([A-Za-z0-9]+)")


def resolve_channel(ref: str, *, default_platform: str = "slack") -> str:
    """Turn a user/agent-supplied channel reference into a `<platform>:<chat_id>` address.
    Accepts a Slack channel-mention token (`<#C0123|name>`), a channel "Copy link" URL, a full
    address (`slack:C0123`), or a bare chat id (assumed to be on the default platform). A bare
    `#name` resolves to "" — names can't be looked up locally, and storing one literally would
    create a subscription that never matches real traffic."""
    ref = (ref or "").strip()
    m = _SLACK_CHANNEL_RE.search(ref)
    if m:
        return f"slack:{m.group(1)}"
    m = _SLACK_ARCHIVES_RE.search(ref)
    if m:
        return f"slack:{m.group(1).upper()}"
    if ref.startswith("#"):
        return ""
    if ":" in ref:
        return ref
    return f"{default_platform}:{ref}" if ref else ref


# -- recent-message ring buffer (for get_channel_messages) ----------------------
class ChannelBuffer:
    """Last-N messages seen per channel. Filled as inbound channel messages arrive, so a
    subscribed agent can catch up on anything it might have missed — and so the channel picker
    can suggest channels the bot has already seen. Persisted (best-effort JSON) when a
    ``state_path`` is given: a suggestion list that empties on every restart is useless
    (owner call, 2026-07-04). Traffic is human-rate, so writing per message is fine."""

    def __init__(self, cap: int = 50, state_path: Optional[Path] = None) -> None:
        self._cap = cap
        self._path = Path(state_path) if state_path else None
        self._by_channel: dict[str, deque] = {}
        self._names: dict[str, str] = {}  # channel address → display name ("#ocw-test")
        if self._path is not None and self._path.exists():
            try:
                data = json.loads(self._path.read_text())
                # Current format: {"messages": {...}, "names": {...}}; the first shipped
                # format was the bare messages dict — accept both.
                msgs_by_chan = (
                    data.get("messages", data) if isinstance(data, dict) else {}
                )
                self._names = (
                    dict(data.get("names") or {}) if isinstance(data, dict) else {}
                )
                for chan, msgs in msgs_by_chan.items():
                    if isinstance(msgs, list):
                        self._by_channel[chan] = deque(msgs[-cap:], maxlen=cap)
            except (OSError, ValueError, AttributeError):
                pass  # a corrupt buffer must never block startup

    def record(
        self, channel: str, who: str, text: str, name: Optional[str] = None
    ) -> None:
        self._by_channel.setdefault(channel, deque(maxlen=self._cap)).append(
            {"from": who, "text": text}
        )
        if name:
            self._names[channel] = name
        self._save()

    def _save(self) -> None:
        if self._path is None:
            return
        try:
            tmp = self._path.with_suffix(".tmp")
            tmp.write_text(
                json.dumps(
                    {
                        "messages": {c: list(m) for c, m in self._by_channel.items()},
                        "names": self._names,
                    }
                )
            )
            tmp.replace(self._path)
        except OSError:
            pass  # persistence is best-effort; the in-memory buffer stays authoritative

    def recent(self, channel: str, n: int = 10) -> list[dict]:
        msgs = list(self._by_channel.get(channel, ()))
        return msgs[-max(1, min(n, self._cap)) :]

    def name_for(self, channel: str) -> Optional[str]:
        """The channel's resolved display name, if any inbound message carried one."""
        return self._names.get(channel)

    def channels(self) -> list[dict]:
        """Channels seen so far (the picker's 'recently-seen' list), newest message last."""
        out: list[dict] = []
        for chan, msgs in self._by_channel.items():
            last = msgs[-1] if msgs else {}
            out.append(
                {
                    "channel": chan,
                    "name": self._names.get(chan),
                    "last_from": last.get("from"),
                    "last_text": last.get("text"),
                }
            )
        return out


def subscription_tools(
    store: SubscriptionStore,
    session_id: str,
    buffer: ChannelBuffer,
    *,
    default_platform: str = "slack",
    routing_targets: Optional[list[str]] = None,
) -> list:
    """The channel-subscription tools for a messaging persona's session: subscribe / unsubscribe /
    list / catch up. The agent obtains a channel by asking the user (ask_user) or from a channel
    message it's reacting to."""

    def subscribe_channel(channel: str) -> dict:
        """Subscribe THIS session to a messaging channel so you receive its messages (a steer while
        you work, or a fresh turn when idle). Ask the user which channel (ask_user) if you don't
        already have one. `channel` may be a Slack `#channel` mention, a `platform:chat_id` address,
        or a channel id."""
        addr = resolve_channel(channel, default_platform=default_platform)
        if not addr or ":" not in addr:
            return {
                "ok": False,
                "error": f"could not resolve a channel from {channel!r}",
            }
        store.subscribe(session_id, addr)
        warn = None
        if routing_targets and addr in routing_targets:
            warn = (
                f"heads up: your Inbox is also routed to {addr}. Inbox routing (outbound) and a "
                "subscription (inbound) on the same channel conflate request/reply with broadcast — "
                "consider a dedicated DM/channel for the Inbox."
            )
        return {"ok": True, "subscribed": addr, **({"warning": warn} if warn else {})}

    def unsubscribe_channel(channel: str) -> dict:
        """Stop THIS session from listening to a channel."""
        addr = resolve_channel(channel, default_platform=default_platform)
        removed = store.unsubscribe(session_id, addr)
        return {"ok": True, "unsubscribed": addr, "was_subscribed": removed}

    def list_subscriptions() -> dict:
        """List the channels THIS session is subscribed to."""
        return {"channels": [s.channel for s in store.for_session(session_id)]}

    def get_channel_messages(channel: str, n: int = 10) -> dict:
        """Get the last `n` messages seen on a channel (to catch up on anything you might have
        missed). Only messages received while the server was running are available."""
        addr = resolve_channel(channel, default_platform=default_platform)
        return {"channel": addr, "messages": buffer.recent(addr, n)}

    return [
        subscribe_channel,
        unsubscribe_channel,
        list_subscriptions,
        get_channel_messages,
    ]
