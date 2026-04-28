#!/usr/bin/env python3
"""Seed demo data into a running new-api instance via the admin HTTP API.

Usage examples:

    # Seed defaults (8 channels + 3 tokens + 2 redemptions) against localhost:3000
    NEWAPI_PASSWORD=xxx python3 scripts/seed_demo.py \
        --base-url http://localhost:3000 --username dingyi

    # Custom counts
    NEWAPI_PASSWORD=xxx python3 scripts/seed_demo.py --channels 4 --tokens 2 --redemptions 0

    # Wipe everything previously seeded (any record whose name starts with [DEMO])
    NEWAPI_PASSWORD=xxx python3 scripts/seed_demo.py --cleanup

All seeded records are tagged with the [DEMO] name prefix so they can be
re-discovered and removed safely without touching real data.

Only the Python stdlib is used (urllib + http.cookiejar) so it runs anywhere
python3 is available -- no pip install required.
"""

from __future__ import annotations

import argparse
import getpass
import json
import os
import sys
import time
import urllib.error
import urllib.request
from http.cookiejar import CookieJar
from typing import Any, Iterable

DEMO_PREFIX = "[DEMO]"

# Subset of constant/channel.go ChannelType IDs that have low setup cost
# and render distinct icons / labels in the channel page so the seeded
# data exercises the UI breadth.
CHANNEL_PRESETS: list[dict[str, Any]] = [
    {
        "type": 1,  # OpenAI
        "name": "OpenAI",
        "key": "sk-demo-openai-{i}",
        "models": "gpt-4o-mini,gpt-4o,gpt-3.5-turbo",
        "group": "default",
        "tag": "demo-openai",
        "priority": 10,
        "weight": 5,
    },
    {
        "type": 14,  # Anthropic Claude
        "name": "Claude",
        "key": "sk-ant-demo-{i}",
        "models": "claude-3-5-sonnet-20241022,claude-3-haiku-20240307",
        "group": "default",
        "tag": "demo-anthropic",
        "priority": 8,
        "weight": 3,
    },
    {
        "type": 25,  # Gemini
        "name": "Gemini",
        "key": "AIzaDemoGemini{i}",
        "models": "gemini-2.0-flash,gemini-1.5-pro",
        "group": "default",
        "tag": "demo-google",
        "priority": 5,
        "weight": 2,
    },
    {
        "type": 17,  # DeepSeek
        "name": "DeepSeek",
        "key": "sk-demo-deepseek-{i}",
        "models": "deepseek-chat,deepseek-reasoner",
        "group": "default",
        "tag": "demo-deepseek",
        "priority": 5,
        "weight": 1,
    },
    {
        "type": 36,  # Moonshot
        "name": "Moonshot",
        "key": "sk-demo-moonshot-{i}",
        "models": "moonshot-v1-8k,moonshot-v1-32k",
        "group": "default",
        "tag": "demo-moonshot",
        "priority": 3,
        "weight": 1,
    },
    {
        "type": 40,  # SiliconFlow
        "name": "SiliconFlow",
        "key": "sk-demo-siliconflow-{i}",
        "models": "Qwen/Qwen2.5-7B-Instruct,Qwen/Qwen2.5-72B-Instruct",
        "group": "default",
        "tag": "demo-siliconflow",
        "priority": 2,
        "weight": 1,
    },
    {
        "type": 8,  # Custom (OpenAI-compatible)
        "name": "Self-hosted",
        "key": "sk-demo-custom-{i}",
        "models": "llama-3.1-8b-instruct",
        "group": "default",
        "base_url": "http://localhost:11434",
        "tag": "demo-selfhost",
        "priority": 1,
        "weight": 1,
    },
    {
        # Disabled-on-creation: status=2 means "manually disabled".
        # Lets the channel page status filter actually have something to
        # filter against, instead of every row being green.
        "type": 1,
        "name": "OpenAI (disabled)",
        "key": "sk-demo-openai-down-{i}",
        "models": "gpt-4o-mini",
        "group": "default",
        "tag": "demo-disabled",
        "status": 2,
        "priority": 0,
        "weight": 0,
    },
]


class ApiError(RuntimeError):
    pass


class Client:
    """Tiny session wrapper around urllib that mimics requests.Session()."""

    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.cookies = CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.cookies),
        )
        # Captured after a successful login -- some routes require it.
        self.user_id: int | None = None
        # When set, every request will carry this as the Authorization header
        # so AdminAuth() can validate via model.ValidateAccessToken instead of
        # relying on a session cookie.
        self.access_token: str | None = None

    # ---- HTTP plumbing ----

    def request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        body: Any = None,
    ) -> dict[str, Any]:
        url = self.base_url + path
        if params:
            qs = urllib.parse.urlencode(
                {k: v for k, v in params.items() if v is not None},
            )
            url = f"{url}?{qs}" if qs else url
        data = None
        headers = {"Accept": "application/json"}
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if self.user_id is not None:
            # AdminAuth() inspects this header on top of the session cookie.
            headers["New-Api-User"] = str(self.user_id)
        if self.access_token is not None:
            headers["Authorization"] = self.access_token
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with self.opener.open(req, timeout=15) as resp:
                raw = resp.read().decode("utf-8") or "{}"
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace") if exc.fp else ""
            raise ApiError(f"{method} {path} -> HTTP {exc.code}: {raw[:300]}") from None
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ApiError(f"{method} {path} returned non-JSON body: {raw[:300]}") from exc
        if isinstance(payload, dict) and payload.get("success") is False:
            msg = payload.get("message") or payload
            raise ApiError(f"{method} {path} failed: {msg}")
        return payload

    # ---- Auth ----

    def login(self, username: str, password: str) -> dict[str, Any]:
        payload = self.request(
            "POST",
            "/api/user/login",
            body={"username": username, "password": password},
        )
        data = payload.get("data") or {}
        # `id` is the canonical field; some older versions used `Id`.
        self.user_id = data.get("id") or data.get("Id")
        if not self.user_id:
            raise ApiError(f"login succeeded but no user id in payload: {payload}")
        return data


# ---- Helpers ----


def _channel_payload(preset: dict[str, Any], i: int) -> dict[str, Any]:
    name = f"{DEMO_PREFIX} {preset['name']} #{i}"
    channel: dict[str, Any] = {
        "type": preset["type"],
        "name": name,
        "key": preset["key"].format(i=i),
        "models": preset["models"],
        "group": preset.get("group", "default"),
        "status": preset.get("status", 1),
        "weight": preset.get("weight", 0),
        "priority": preset.get("priority", 0),
        "auto_ban": 1,
        "base_url": preset.get("base_url", ""),
        "tag": preset.get("tag", ""),
        "model_mapping": "",
        "status_code_mapping": "",
        "other": "",
        "remark": "Seeded by scripts/seed_demo.py",
        "channel_info": {},
        "settings": "",
    }
    return {
        "mode": "single",
        "multi_key_mode": "",
        "channel": channel,
    }


def _token_payload(i: int, *, unlimited: bool) -> dict[str, Any]:
    name = f"{DEMO_PREFIX} token #{i}"
    return {
        "name": name,
        "expired_time": -1,
        "remain_quota": 0 if unlimited else 500_000,
        "unlimited_quota": unlimited,
        "model_limits_enabled": False,
        "model_limits": "",
        "allow_ips": "",
        "group": "",
        "cross_group_retry": False,
    }


def _redemption_payload(i: int, *, quota: int, count: int) -> dict[str, Any]:
    return {
        "name": f"{DEMO_PREFIX} redemption #{i}",
        "count": count,
        "quota": quota,
        "expired_time": 0,
    }


def _iter_pages(client: Client, path: str, page_size: int = 100) -> Iterable[dict[str, Any]]:
    page = 1
    while True:
        payload = client.request("GET", path, params={"p": page, "page_size": page_size})
        data = payload.get("data") or {}
        items = data.get("items") if isinstance(data, dict) else None
        if items is None and isinstance(data, list):
            # Some older endpoints return a bare list.
            items = data
        if not items:
            return
        for it in items:
            yield it
        total = (data or {}).get("total") if isinstance(data, dict) else None
        if total is not None and page * page_size >= total:
            return
        page += 1


# ---- Commands ----


def cmd_seed(client: Client, args: argparse.Namespace) -> None:
    print(f"-> seeding as user_id={client.user_id}")

    # Channels
    if args.channels > 0:
        print(f"-> creating {args.channels} channel(s)")
        for i in range(args.channels):
            preset = CHANNEL_PRESETS[i % len(CHANNEL_PRESETS)]
            body = _channel_payload(preset, i + 1)
            try:
                client.request("POST", "/api/channel/", body=body)
                print(f"   + channel {body['channel']['name']}")
            except ApiError as exc:
                print(f"   ! channel #{i + 1} failed: {exc}", file=sys.stderr)

    # Tokens (alternating unlimited / fixed quota)
    if args.tokens > 0:
        print(f"-> creating {args.tokens} token(s)")
        for i in range(args.tokens):
            body = _token_payload(i + 1, unlimited=(i % 2 == 0))
            try:
                client.request("POST", "/api/token/", body=body)
                print(f"   + token {body['name']}")
            except ApiError as exc:
                print(f"   ! token #{i + 1} failed: {exc}", file=sys.stderr)

    # Redemption codes
    if args.redemptions > 0:
        print(f"-> creating {args.redemptions} redemption batch(es)")
        for i in range(args.redemptions):
            body = _redemption_payload(i + 1, quota=1_000_000, count=1)
            try:
                client.request("POST", "/api/redemption/", body=body)
                print(f"   + redemption {body['name']}")
            except ApiError as exc:
                print(f"   ! redemption #{i + 1} failed: {exc}", file=sys.stderr)

    print("-> done")


def cmd_cleanup(client: Client, _args: argparse.Namespace) -> None:
    print(f"-> cleanup as user_id={client.user_id} (matching name prefix '{DEMO_PREFIX}')")

    deleted = {"channels": 0, "tokens": 0, "redemptions": 0}

    # Channels
    for ch in list(_iter_pages(client, "/api/channel/")):
        if not (ch.get("name") or "").startswith(DEMO_PREFIX):
            continue
        try:
            client.request("DELETE", f"/api/channel/{ch['id']}")
            deleted["channels"] += 1
            print(f"   - channel #{ch['id']} {ch['name']}")
        except ApiError as exc:
            print(f"   ! delete channel #{ch['id']} failed: {exc}", file=sys.stderr)

    # Tokens
    for tk in list(_iter_pages(client, "/api/token/")):
        if not (tk.get("name") or "").startswith(DEMO_PREFIX):
            continue
        try:
            client.request("DELETE", f"/api/token/{tk['id']}")
            deleted["tokens"] += 1
            print(f"   - token #{tk['id']} {tk['name']}")
        except ApiError as exc:
            print(f"   ! delete token #{tk['id']} failed: {exc}", file=sys.stderr)

    # Redemptions
    for rd in list(_iter_pages(client, "/api/redemption/")):
        if not (rd.get("name") or "").startswith(DEMO_PREFIX):
            continue
        try:
            client.request("DELETE", f"/api/redemption/{rd['id']}")
            deleted["redemptions"] += 1
            print(f"   - redemption #{rd['id']} {rd['name']}")
        except ApiError as exc:
            print(f"   ! delete redemption #{rd['id']} failed: {exc}", file=sys.stderr)

    print(
        "-> done: removed "
        f"{deleted['channels']} channel(s), "
        f"{deleted['tokens']} token(s), "
        f"{deleted['redemptions']} redemption(s)"
    )


# ---- Entrypoint ----


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed or wipe demo data via the new-api admin HTTP API.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--base-url",
        default=os.environ.get("NEWAPI_BASE_URL", "http://localhost:3000"),
        help="Backend base URL (default: %(default)s).",
    )
    parser.add_argument(
        "--username",
        default=os.environ.get("NEWAPI_USERNAME"),
        help="Admin/root username (env: NEWAPI_USERNAME).",
    )
    parser.add_argument(
        "--password",
        default=os.environ.get("NEWAPI_PASSWORD"),
        help="Admin/root password (env: NEWAPI_PASSWORD; prompts if missing).",
    )
    parser.add_argument(
        "--access-token",
        default=os.environ.get("NEWAPI_ACCESS_TOKEN"),
        help=(
            "Personal access token for the admin user (env: NEWAPI_ACCESS_TOKEN). "
            "When provided, password login is skipped and --user-id is required."
        ),
    )
    parser.add_argument(
        "--user-id",
        type=int,
        default=int(os.environ.get("NEWAPI_USER_ID") or 0) or None,
        help="Numeric user id matching --access-token (env: NEWAPI_USER_ID).",
    )
    parser.add_argument("--channels", type=int, default=8, help="How many channels to seed.")
    parser.add_argument("--tokens", type=int, default=3, help="How many tokens to seed.")
    parser.add_argument(
        "--redemptions",
        type=int,
        default=2,
        help="How many redemption code batches to seed.",
    )
    parser.add_argument(
        "--cleanup",
        action="store_true",
        help="Instead of seeding, delete every record whose name starts with [DEMO].",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv if argv is not None else sys.argv[1:])

    client = Client(args.base_url)

    if args.access_token:
        if not args.user_id:
            print(
                "--access-token requires --user-id (or NEWAPI_USER_ID).",
                file=sys.stderr,
            )
            return 2
        client.access_token = args.access_token
        client.user_id = args.user_id
        print(
            f"-> using access token for user_id={client.user_id} @ {args.base_url}",
        )
    else:
        if not args.username:
            args.username = input("Username: ").strip()
        if not args.password:
            args.password = getpass.getpass("Password: ")
        print(f"-> logging in as {args.username} @ {args.base_url}")
        t0 = time.time()
        try:
            client.login(args.username, args.password)
        except ApiError as exc:
            print(f"login failed: {exc}", file=sys.stderr)
            return 2
        print(f"   ok ({time.time() - t0:.2f}s)")

    if args.cleanup:
        cmd_cleanup(client, args)
    else:
        cmd_seed(client, args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
