"""P1 sender attribution (2026-07-14): outbound Slack posts carry "[<installer>] " so
channels shared by several OpenWorker users can tell whose coworker is speaking.
Identity = the managed install's authed_user (plumbed broker → form-POST → team
profile), name resolved once via users.info and cached. Attribution never blocks a
send; manual installs (no authed_user) and DMs stay bare."""

from coworker.connectors import attribution
from coworker.connectors.base import SendResult
from coworker.connectors.setup import managed_connect_slack_install
from coworker.connectors.tools import make_send_file_tool, make_send_message_tool
from coworker.secrets import SecretStore


def _secrets(tmp_path, **team_extra) -> SecretStore:
    s = SecretStore(tmp_path / "secrets.json")
    s.put("slack:team:T1", {"bot_token": "xoxb-t1", "account": "acme", **team_extra})
    return s


def _sender(record: list):
    def send(token, chat_id, text, thread_id):
        record.append(text)
        return SendResult(True, message_id="1.2")

    return {"slack": send}


def test_install_stores_the_installers_member_id(tmp_path):
    s = SecretStore(tmp_path / "secrets.json")
    managed_connect_slack_install(
        s,
        {"team_id": "T1", "access_token": "xoxb-x", "slack_user_id": "U777"},
    )
    assert s.get("slack:team:T1")["slack_user_id"] == "U777"


def test_cached_name_prefixes_text_sends(tmp_path):
    s = _secrets(tmp_path, sender_name="Rohit")
    record: list = []
    tool = make_send_message_tool(s, senders=_sender(record))

    assert tool("slack:T1/C9", "shipping the report now")["ok"] is True
    assert record == ["[Rohit] shipping the report now"]


def test_name_is_resolved_once_via_users_info_and_cached(tmp_path, monkeypatch):
    s = _secrets(tmp_path, slack_user_id="U777")
    calls: list = []

    def fake_fetch(token, user_id):
        calls.append((token, user_id))
        return "Rohit"

    monkeypatch.setattr(attribution, "_fetch_display_name", fake_fetch)
    record: list = []
    tool = make_send_message_tool(s, senders=_sender(record))

    tool("slack:T1/C9", "one")
    tool("slack:T1/C9", "two")
    assert record == ["[Rohit] one", "[Rohit] two"]
    assert calls == [("xoxb-t1", "U777")]  # second send hit the cache
    assert s.get("slack:team:T1")["sender_name"] == "Rohit"


def test_no_identity_and_dms_and_failures_stay_bare(tmp_path, monkeypatch):
    # manual install: no authed_user recorded → nothing truthful to attribute
    s = _secrets(tmp_path)
    record: list = []
    tool = make_send_message_tool(s, senders=_sender(record))
    tool("slack:T1/C9", "hi")
    assert record == ["hi"]

    # a DM with the bot has no ambiguity — even with a cached name
    s2 = _secrets(tmp_path.joinpath("b"), sender_name="Rohit")
    record2: list = []
    tool2 = make_send_message_tool(s2, senders=_sender(record2))
    tool2("slack:T1/D555", "hi")
    assert record2 == ["hi"]

    # users.info failing must degrade to no prefix, never block the send
    s3 = _secrets(tmp_path.joinpath("c"), slack_user_id="U777")
    monkeypatch.setattr(attribution, "_fetch_display_name", lambda t, u: None)
    record3: list = []
    tool3 = make_send_message_tool(s3, senders=_sender(record3))
    assert tool3("slack:T1/C9", "hi")["ok"] is True
    assert record3 == ["hi"] and "sender_name" not in s3.get("slack:team:T1")


def test_telegram_is_never_prefixed(tmp_path):
    s = SecretStore(tmp_path / "secrets.json")
    s.put("telegram:default", {"bot_token": "tg-token"})
    record: list = []

    def send(token, chat_id, text, thread_id):
        record.append(text)
        return SendResult(True, message_id="9")

    tool = make_send_message_tool(s, senders={"telegram": send})
    tool("telegram:12345", "hi")
    assert record == ["hi"]


def test_send_file_comment_is_prefixed_but_absent_comment_stays_absent(tmp_path):
    s = _secrets(tmp_path, sender_name="Rohit")
    ws = tmp_path / "ws"
    ws.mkdir()
    (ws / "r.pdf").write_bytes(b"%PDF")
    record: list = []

    def file_sender(token, chat_id, thread_id, filename, data, title, comment):
        record.append(comment)
        return SendResult(True, message_id="F1")

    tool = make_send_file_tool(s, workspace=ws, file_senders={"slack": file_sender})
    assert tool("slack:T1/C9", "r.pdf", comment="the report")["ok"] is True
    assert tool("slack:T1/C9", "r.pdf")["ok"] is True
    assert record == ["[Rohit] the report", None]
