"""FakeAdapter — an in-memory platform for tests and the `cli fake` REPL.

Lets you inject inbound messages programmatically and inspect what was sent, so the gateway
and handler loop can be exercised end-to-end with no network or real tokens.
"""

from __future__ import annotations

from typing import Optional

from .base import BasePlatformAdapter, MessageEvent, SendResult, SessionSource


class FakeAdapter(BasePlatformAdapter):
    platform = "fake"

    def __init__(self) -> None:
        super().__init__()
        self.connected = False
        self.outbox: list[dict] = []  # {chat_id, text, thread_id}

    async def connect(self) -> bool:
        self.connected = True
        return True

    async def disconnect(self) -> None:
        self.connected = False

    async def send(
        self, chat_id: str, text: str, *, thread_id: Optional[str] = None
    ) -> SendResult:
        self.outbox.append({"chat_id": chat_id, "text": text, "thread_id": thread_id})
        return SendResult(True, message_id=str(len(self.outbox)))

    # -- test/dev helpers -------------------------------------------------------
    async def inject(
        self,
        text: str,
        *,
        chat_id: str = "c1",
        user_id: str = "u1",
        user_name: str = "tester",
        chat_type: str = "dm",
        thread_id: Optional[str] = None,
    ) -> None:
        """Simulate an inbound message arriving from the platform."""
        source = SessionSource(
            platform=self.platform,
            chat_id=chat_id,
            user_id=user_id,
            user_name=user_name,
            chat_type=chat_type,
            thread_id=thread_id,
        )
        await self.handle_message(
            MessageEvent(text=text, source=source, message_id=f"m{user_id}")
        )
