"""§36 gates: connector READS never gate (the tool registry's kind is law), and Slack
channel NAMES resolve to addresses in send_message/send_file ("post Hi to #general" must
just work when Slack is connected — owner repro 2026-07-14)."""

from coworker.connectors.base import SendResult
from coworker.connectors.tool_defs import TOOL_DEFS, approval_for_tool
from coworker.connectors.tools import make_send_file_tool, make_send_message_tool
from coworker.secrets import SecretStore


# -- connector reads never gate ---------------------------------------------------------
def test_registry_kinds_are_exhaustive_and_drive_approval():
    for d in TOOL_DEFS:
        assert d.kind in ("read", "write"), f"{d.name} has kind {d.kind!r}"
        assert approval_for_tool(d.name) is (d.kind != "read")
    # Tools without a registry entry keep the call-site default (MCP/experimental).
    assert approval_for_tool("mcp_mystery_tool", default=True) is True
    assert approval_for_tool("mcp_mystery_tool", default=False) is False


def test_integration_tools_reads_are_free_writes_gate(tmp_path):
    from coworker.connectors.integration_tools import make_integration_tools

    tools = {
        t.__name__: t
        for t in make_integration_tools(SecretStore(tmp_path / "secrets.json"))
    }
    assert tools["github_search"].__aisuite_tool_metadata__.requires_approval is False
    assert (
        tools["github_list_commits"].__aisuite_tool_metadata__.requires_approval
        is False
    )
    assert (
        tools["browser_read_url"].__aisuite_tool_metadata__.requires_approval is False
    )
    assert (
        tools["github_create_issue"].__aisuite_tool_metadata__.requires_approval is True
    )


def test_browser_automation_reads_are_free_interactions_gate():
    from coworker.connectors.browser_automation import make_browser_automation_tools

    tools = {t.__name__: t for t in make_browser_automation_tools()}
    assert (
        tools["browser_snapshot"].__aisuite_tool_metadata__.requires_approval is False
    )
    assert (
        tools["browser_open_url"].__aisuite_tool_metadata__.requires_approval is False
    )
    assert tools["browser_click"].__aisuite_tool_metadata__.requires_approval is True
    assert tools["browser_type"].__aisuite_tool_metadata__.requires_approval is True


# -- slack channel-name resolution ------------------------------------------------------
def _secrets_with_team(tmp_path) -> SecretStore:
    s = SecretStore(tmp_path / "secrets.json")
    s.put("slack:default", {"mode": "relay", "enabled": True})
    s.put("slack:team:T1", {"bot_token": "xoxb-t1", "account": "acme"})
    return s


def _record_sender(record: list):
    def sender(token, chat_id, text, thread_id):
        record.append({"token": token, "chat_id": chat_id, "text": text})
        return SendResult(True, message_id="123.456")

    return {"slack": sender}


def _fake_roster(monkeypatch, channels_by_team: dict):
    from coworker.connectors import slack_directory

    calls: list = []

    def fake_list_channels(secrets, team_id, query="", limit=25, *, refresh=False):
        calls.append(team_id)
        rows = channels_by_team.get(team_id)
        if rows is None:
            return {"ok": False, "error": "workspace not connected"}
        return {"ok": True, "channels": rows}

    monkeypatch.setattr(slack_directory, "list_channels", fake_list_channels)
    return calls


def test_channel_name_resolves_to_team_qualified_address(tmp_path, monkeypatch):
    secrets = _secrets_with_team(tmp_path)
    _fake_roster(
        monkeypatch,
        {
            "T1": [
                {
                    "id": "C9",
                    "name": "all-openworker",
                    "is_private": False,
                    "is_member": True,
                }
            ]
        },
    )
    record: list = []
    tool = make_send_message_tool(secrets, senders=_record_sender(record))

    out = tool("slack:#all-openworker", "Hi")
    assert out["ok"] is True
    assert record[0]["chat_id"] == "T1/C9"
    assert (
        record[0]["token"] == "xoxb-t1"
    )  # the resolved team's token, not slack:default


def test_bare_channel_names_coerce_to_slack(tmp_path, monkeypatch):
    """The owner's exact transcript: the model sent target='all-openworker' and
    '#all-openworker' — no 'slack:' prefix — and got 'invalid target'. Bare names
    are Slack-shaped and must resolve."""
    secrets = _secrets_with_team(tmp_path)
    _fake_roster(
        monkeypatch,
        {
            "T1": [
                {
                    "id": "C9",
                    "name": "all-openworker",
                    "is_private": False,
                    "is_member": True,
                }
            ]
        },
    )
    record: list = []
    tool = make_send_message_tool(secrets, senders=_record_sender(record))

    assert tool("all-openworker", "Hi")["ok"] is True
    assert tool("#all-openworker", "Hi")["ok"] is True
    assert all(r["chat_id"] == "T1/C9" and r["token"] == "xoxb-t1" for r in record)

    # Garbage that is neither an address nor a Slack-shaped name still errors clearly.
    assert "invalid target" in tool("Not A Channel!", "Hi")["error"]


def test_id_like_targets_never_touch_the_roster(tmp_path, monkeypatch):
    secrets = _secrets_with_team(tmp_path)
    calls = _fake_roster(monkeypatch, {})
    record: list = []
    tool = make_send_message_tool(secrets, senders=_record_sender(record))

    assert tool("slack:T1/C0BFPTFE7RV", "Hi")["ok"] is True
    assert calls == [] and record[0]["chat_id"] == "T1/C0BFPTFE7RV"


def test_unknown_ambiguous_and_not_member_names_error_actionably(tmp_path, monkeypatch):
    secrets = _secrets_with_team(tmp_path)
    secrets.put("slack:team:T2", {"bot_token": "xoxb-t2", "account": "beta"})
    chan = {"id": "C1", "name": "general", "is_private": False, "is_member": True}
    _fake_roster(monkeypatch, {"T1": [chan], "T2": [dict(chan, id="C2")]})
    tool = make_send_message_tool(secrets, senders=_record_sender([]))

    assert "no Slack channel named #nope" in tool("slack:#nope", "Hi")["error"]
    assert "more than one connected workspace" in tool("slack:#general", "Hi")["error"]

    _fake_roster(
        monkeypatch,
        {
            "T1": [
                {
                    "id": "C3",
                    "name": "private-ops",
                    "is_private": True,
                    "is_member": False,
                }
            ]
        },
    )
    secrets.delete("slack:team:T2")
    assert "invite @OpenWorker" in tool("slack:#private-ops", "Hi")["error"]


def test_send_file_resolves_names_too(tmp_path, monkeypatch):
    secrets = _secrets_with_team(tmp_path)
    ws = tmp_path / "ws"
    ws.mkdir()
    (ws / "r.pdf").write_bytes(b"%PDF")
    _fake_roster(
        monkeypatch,
        {
            "T1": [
                {"id": "C9", "name": "general", "is_private": False, "is_member": True}
            ]
        },
    )
    record: list = []

    def file_sender(token, chat_id, thread_id, filename, data, title, comment):
        record.append({"chat_id": chat_id, "filename": filename})
        return SendResult(True, message_id="F1")

    tool = make_send_file_tool(
        secrets, workspace=ws, file_senders={"slack": file_sender}
    )
    out = tool("slack:#general", "r.pdf")
    assert out["ok"] is True and record[0]["chat_id"] == "T1/C9"
