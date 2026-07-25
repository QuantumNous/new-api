"""The `send_message` outbound tool — available to every agent.

Stateless: parses the `target` token, pulls the bot token from the SecretStore at call time
(never in the model's context), and dispatches via a swappable sender registry. Permission-
gated (`requires_approval=True` → asks outside Auto mode).
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Callable, Optional

import aisuite as ai

from ..secrets import SecretStore
from .base import parse_target
from .senders import DEFAULT_FILE_SENDERS, DEFAULT_SENDERS, FileSender, Sender

_SCHEMA = {
    "type": "function",
    "function": {
        "name": "send_message",
        "description": (
            "Send a message to a connected chat (Slack or Telegram). `target` is the "
            "reply handle from an inbound message (e.g. 'telegram:12345' or 'slack:C0123', "
            "optionally with a ':<thread>' suffix) — or, for Slack, just the channel NAME "
            "('#general' or 'general'; resolved against the connected workspaces). Use this to "
            "actually reach a person — plain assistant text is not delivered anywhere."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "target": {
                    "type": "string",
                    "description": "Destination handle 'platform:chat_id[:thread]', e.g. 'telegram:12345'.",
                },
                "text": {"type": "string", "description": "The message text to send."},
            },
            "required": ["target", "text"],
        },
    },
}


# Slack channel NAMES are strictly lowercase (letters/digits/[-._]); ids are uppercase
# C…/D…/G…/U… tokens. That asymmetry is the discriminator: anything lowercase (or
# #-prefixed) is a name the user said, everything else keeps the raw-address path.
_SLACK_NAME = re.compile(r"^[a-z0-9][a-z0-9._-]*$")


def _slack_channel_name_like(chat_id: str) -> bool:
    return chat_id.startswith("#") or bool(_SLACK_NAME.match(chat_id))


def _parse_or_coerce(target: str) -> tuple[str, str, Optional[str]]:
    """parse_target, but a BARE channel name ('all-openworker', '#general') coerces to
    Slack — models pass what the user said, and a lowercase/#-name is Slack-shaped (owner
    repro 2026-07-14: the model never invented the 'slack:' prefix on its own). Telegram
    targets are numeric, so the shapes never collide."""
    try:
        return parse_target(target)
    except ValueError:
        raw = (target or "").strip()
        if raw and _slack_channel_name_like(raw.lstrip("#")):
            return "slack", raw, None
        raise


def _resolve_slack_channel(
    secrets: SecretStore, name: str
) -> tuple[Optional[str], Optional[str]]:
    """'#all-openworker' (a NAME the user said) → the team-qualified chat_id, via the
    same cached conversations.list roster the GUI's channel picker uses. (chat_id, error):
    exactly one match wins; none/many return an actionable error instead of a guess
    (§36 — 'post Hi to <channel>' must just work when Slack is connected)."""
    from .config import _slack_team_profiles
    from .slack_directory import list_channels

    query = name.lstrip("#").strip()
    teams = [team_id for team_id, _p in _slack_team_profiles(secrets)]
    if not teams and (secrets.get("slack:default") or {}).get("bot_token"):
        teams = ["default"]
    if not teams:
        return None, "no bot token for slack — connect it first"
    hits: list[tuple[str, dict]] = []
    for team in teams:
        r = list_channels(secrets, team, query, limit=50)
        if not r.get("ok"):
            continue
        for c in r.get("channels") or []:
            if str(c.get("name", "")).lower() == query.lower():
                hits.append((team, c))
    if not hits:
        return None, (
            f"no Slack channel named #{query} in the connected workspace"
            f"{'s' if len(teams) > 1 else ''} — check the name, or pass the full "
            "address (slack:C… / slack:T…/C…)"
        )
    if len(hits) > 1:
        return None, (
            f"#{query} exists in more than one connected workspace — use the full "
            "address (slack:TEAM_ID/CHANNEL_ID) to pick one"
        )
    team, c = hits[0]
    chat_id = str(c["id"]) if team == "default" else f"{team}/{c['id']}"
    if not c.get("is_member"):
        return None, (
            f"found #{query}, but the bot isn't a member — invite @OpenWorker to #{query} "
            "in Slack, then retry"
        )
    return chat_id, None


def _resolve_token(secrets: SecretStore, platform: str, chat_id: str) -> Optional[str]:
    """Pick the outbound token for a reply.

    Managed Slack relay is multi-workspace: a team-qualified chat_id ("T…/C…")
    selects that team's bot token from its `slack:team:<team_id>` profile. Manual
    Socket-Mode (single workspace, bare "C…") uses `slack:default`. Non-Slack
    platforms always use `<platform>:default`.
    """
    if platform == "slack":
        from .slack_addr import split

        team, _channel = split(chat_id)
        if team:
            per_team = secrets.get(f"slack:team:{team}") or {}
            return per_team.get("bot_token")
    creds = secrets.get(f"{platform}:default") or {}
    return creds.get("bot_token")


def make_send_message_tool(
    secrets: SecretStore,
    *,
    senders: Optional[dict[str, Sender]] = None,
) -> Callable[..., Any]:
    """Build the `send_message` tool bound to a SecretStore (and optional sender registry)."""
    senders = senders if senders is not None else DEFAULT_SENDERS

    def send_message(target: str, text: str) -> dict[str, Any]:
        try:
            platform, chat_id, thread_id = _parse_or_coerce(target)
        except ValueError as exc:
            return {"error": str(exc)}
        sender = senders.get(platform)
        if sender is None:
            return {"error": f"unknown platform: {platform}"}
        # §36: a channel NAME resolves to its address (the user says "#general", not C0123).
        if platform == "slack" and _slack_channel_name_like(chat_id):
            chat_id, err = _resolve_slack_channel(secrets, chat_id)
            if err:
                return {"error": err}
        token = _resolve_token(secrets, platform, chat_id)
        if not token:
            return {"error": f"no bot token for {platform} — connect it first"}
        if platform == "slack":
            from .attribution import sender_prefix

            text = sender_prefix(secrets, chat_id) + text
        result = sender(token, chat_id, text, thread_id)
        if result.ok:
            return {"ok": True, "message_id": result.message_id, "target": target}
        return {"error": result.error or "send failed"}

    send_message.__name__ = "send_message"
    send_message.__doc__ = _SCHEMA["function"]["description"]
    send_message.__aisuite_tool_metadata__ = ai.ToolMetadata(
        name="send_message",
        category="messaging",
        risk_level="medium",
        capabilities=["messaging"],
        requires_approval=True,
    )
    send_message.__coworker_schema__ = _SCHEMA
    return send_message


# -- send_file (§34 / UX-016) ----------------------------------------------------------

_FILE_SCHEMA = {
    "type": "function",
    "function": {
        "name": "send_file",
        "description": (
            "Upload a file from the session's workspace into a connected chat (Slack). "
            "`target` is the same handle send_message uses. Slack shows its own previews "
            "for pdf/csv/images — send the actual file, not a screenshot of it. For .html "
            "artifacts (which Slack can't preview) set as_screenshot=true to send a "
            "rendered PNG instead. This is a DISTINCT permission from send_message: it "
            "asks for approval even in threads where text replies are pre-approved."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "target": {
                    "type": "string",
                    "description": "Destination handle 'platform:chat_id[:thread]', e.g. 'slack:C0123:171234.5678'.",
                },
                "path": {
                    "type": "string",
                    "description": "The file to send — workspace-relative, or absolute within an allowed folder.",
                },
                "title": {
                    "type": "string",
                    "description": "Display title (defaults to the filename).",
                },
                "comment": {
                    "type": "string",
                    "description": "Short message posted with the file.",
                },
                "as_screenshot": {
                    "type": "boolean",
                    "description": "HTML only: render the page headless and send a PNG preview instead of the raw file.",
                },
            },
            "required": ["target", "path"],
        },
    },
}

_MAX_FILE_BYTES = 50 * 1024 * 1024  # sanity cap well under Slack's limit


def _resolve_within(path: str, bases: list[Path]) -> Optional[Path]:
    """Resolve `path` (relative → tried against each base) and require the result to live
    inside one of the allowed bases. None → outside every base or nonexistent."""
    candidates = []
    p = Path(path).expanduser()
    if p.is_absolute():
        candidates.append(p)
    else:
        candidates.extend(base / p for base in bases)
    for cand in candidates:
        try:
            resolved = cand.resolve(strict=True)
        except OSError:
            continue
        for base in bases:
            try:
                resolved.relative_to(base.resolve())
                return resolved
            except ValueError:
                continue
    return None


def _render_html_png(path: Path) -> bytes:
    """Headless render of a local HTML artifact → viewport PNG (1280×800). Uses the
    Playwright chromium we already ship for the browser connector."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        try:
            page = browser.new_page(viewport={"width": 1280, "height": 800})
            page.goto(path.as_uri())
            page.wait_for_timeout(500)  # let embedded JS (charts, tables) paint
            return page.screenshot(full_page=False)
        finally:
            browser.close()


def make_send_file_tool(
    secrets: SecretStore,
    *,
    workspace: Optional[Path] = None,
    roots: Optional[list] = None,
    file_senders: Optional[dict[str, FileSender]] = None,
    render_html: Optional[Callable[[Path], bytes]] = None,
) -> Callable[..., Any]:
    """Build the `send_file` tool. Same target grammar and token resolution as
    send_message, but a DIFFERENT tool name — standing send_message grants (e.g. a
    mention-thread's pre-approval) never cover file uploads."""
    file_senders = file_senders if file_senders is not None else DEFAULT_FILE_SENDERS
    render_html = render_html or _render_html_png
    bases = [Path(r.path) for r in (roots or []) if getattr(r, "path", None)]
    if workspace is not None:
        bases.append(Path(workspace))

    def send_file(
        target: str,
        path: str,
        title: Optional[str] = None,
        comment: Optional[str] = None,
        as_screenshot: bool = False,
    ) -> dict[str, Any]:
        try:
            platform, chat_id, thread_id = _parse_or_coerce(target)
        except ValueError as exc:
            return {"error": str(exc)}
        sender = file_senders.get(platform)
        if sender is None:
            return {"error": f"file sending is not supported on {platform} yet"}
        # §36: channel names resolve here too — same rule as send_message.
        if platform == "slack" and _slack_channel_name_like(chat_id):
            chat_id, err = _resolve_slack_channel(secrets, chat_id)
            if err:
                return {"error": err}
        if not bases:
            return {"error": "no workspace folders available to read from"}
        resolved = _resolve_within(path, bases)
        if resolved is None or not resolved.is_file():
            return {
                "error": "path is outside the folders this session can access (or missing)"
            }
        token = _resolve_token(secrets, platform, chat_id)
        if not token:
            return {"error": f"no bot token for {platform} — connect it first"}
        if as_screenshot:
            if resolved.suffix.lower() not in (".html", ".htm"):
                return {"error": "as_screenshot only applies to .html files"}
            try:
                data = render_html(resolved)
            except Exception as exc:
                return {"error": f"could not render the page: {exc}"}
            filename = resolved.stem + ".png"
        else:
            if resolved.stat().st_size > _MAX_FILE_BYTES:
                return {"error": "file is larger than 50 MB"}
            data = resolved.read_bytes()
            filename = resolved.name
        if platform == "slack" and comment:
            from .attribution import sender_prefix

            comment = sender_prefix(secrets, chat_id) + comment
        result = sender(token, chat_id, thread_id, filename, data, title, comment)
        if result.ok:
            return {
                "ok": True,
                "file_id": result.message_id,
                "target": target,
                "filename": filename,
            }
        return {"error": result.error or "file send failed"}

    send_file.__name__ = "send_file"
    send_file.__doc__ = _FILE_SCHEMA["function"]["description"]
    send_file.__aisuite_tool_metadata__ = ai.ToolMetadata(
        name="send_file",
        category="messaging",
        risk_level="medium",
        capabilities=["messaging", "files"],
        requires_approval=True,
    )
    send_file.__coworker_schema__ = _FILE_SCHEMA
    return send_file
