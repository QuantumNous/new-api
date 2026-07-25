"""Small CLI to exercise connectors independently.

python -m coworker.connectors.cli status
    Show which platforms are configured (token present) + allowlist size.

python -m coworker.connectors.cli fake [--user U1] [--allow U1]
    Offline REPL: type messages as if they arrived from a platform; a built-in echo
    handler replies through the gateway. Exercises auth + inbound dispatch + outbound
    with no network. Try --user with someone NOT in --allow to see it dropped.

python -m coworker.connectors.cli send --target telegram:12345 --text "hi"
    Live outbound via the send_message tool (needs a bot token in the SecretStore).
"""

from __future__ import annotations

import argparse
import asyncio
import sys

from ..secrets import SecretStore
from .base import MessageEvent
from .config import ConnectorSettings, load_settings
from .fake import FakeAdapter
from .gateway import Gateway
from .tools import make_send_message_tool


def _cmd_status() -> int:
    settings = load_settings(SecretStore())
    print("Connector status:")
    for platform, s in settings.items():
        print(
            f"  {platform:10s} enabled={s.enabled}  allow_all={s.allow_all}  "
            f"allowed_users={len(s.allowed_users)}"
        )
    return 0


async def _run_fake(user: str, allow: list[str]) -> int:
    fake = FakeAdapter()
    settings = {
        "fake": ConnectorSettings(
            platform="fake", enabled=True, allowed_users=set(allow), allow_all=not allow
        )
    }
    gateway = Gateway(settings=settings)

    async def echo_handler(event: MessageEvent) -> None:
        reply = f"echo: {event.text}"
        await gateway.deliver(event.source.target, reply)
        print(f"  ↩ sent to {event.source.target}: {reply!r}")

    gateway.set_handler(echo_handler)
    gateway.register(fake)
    await gateway.start()
    print(f"fake gateway up (user={user}, allow={allow or '∗ all'}). Ctrl-D to quit.\n")

    while True:
        try:
            text = await asyncio.to_thread(input, "you> ")
        except (EOFError, KeyboardInterrupt):
            print()
            break
        text = text.strip()
        if not text:
            continue
        before = len(fake.outbox)
        await fake.inject(text, user_id=user, user_name=user)
        if len(fake.outbox) == before:
            print("  ⨯ dropped (not authorized)")
    await gateway.stop()
    return 0


def _cmd_send(target: str, text: str) -> int:
    tool = make_send_message_tool(SecretStore())
    result = tool(target=target, text=text)
    print(result)
    return 0 if result.get("ok") else 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="openworker-connectors")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("status")

    p_fake = sub.add_parser("fake")
    p_fake.add_argument("--user", default="u1")
    p_fake.add_argument(
        "--allow", action="append", default=[], help="authorized user id (repeatable)"
    )

    p_send = sub.add_parser("send")
    p_send.add_argument("--target", required=True)
    p_send.add_argument("--text", required=True)

    args = parser.parse_args(argv)
    if args.cmd == "status":
        return _cmd_status()
    if args.cmd == "fake":
        return asyncio.run(_run_fake(args.user, args.allow))
    if args.cmd == "send":
        return _cmd_send(args.target, args.text)
    return 1


if __name__ == "__main__":
    sys.exit(main())
