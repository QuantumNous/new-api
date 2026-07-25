"""Email (IMAP/SMTP) connector tools — fakes only, no network, no real mailbox."""

from __future__ import annotations

from email.message import EmailMessage

import pytest

from coworker.connectors.email_tools import (
    build_search_criteria,
    decode_mime_header,
    extract_text_body,
    make_email_tools,
    resolve_servers,
)
from coworker.roots import RootDir
from coworker.secrets import SecretStore


# -- fakes ----------------------------------------------------------------------
class FakeIMAP:
    """Records commands; serves canned messages keyed by uid."""

    def __init__(self, messages: dict[str, EmailMessage] | None = None):
        self.messages = messages or {}
        self.commands: list[tuple] = []
        self.logged_in = None
        self.selected = None

    def login(self, user, password):
        self.logged_in = (user, password)
        return "OK", [b"Logged in"]

    def select(self, folder, readonly=False):
        self.commands.append(("select", folder, readonly))
        self.selected = folder
        return "OK", [b"42"]

    def list(self):
        return "OK", [
            b'(\\HasNoChildren) "/" "INBOX"',
            b'(\\HasNoChildren) "/" "[Gmail]/Sent Mail"',
            b'(\\Noselect \\HasChildren) "/" "[Gmail]"',
        ]

    def status(self, folder, what):
        return "OK", [folder.encode() + b" (MESSAGES 7)"]

    def uid(self, command, *args):
        self.commands.append(("uid", command) + args)
        if command == "SEARCH":
            uids = b" ".join(uid.encode() for uid in sorted(self.messages, key=int))
            return "OK", [uids]
        if command == "FETCH":
            uid, spec = args[0], args[1]
            uid = uid.decode() if isinstance(uid, bytes) else uid
            msg = self.messages.get(uid)
            if msg is None:
                return "OK", [None]
            raw = msg.as_bytes()
            if "HEADER.FIELDS" in spec:
                wanted = spec.split("(")[2].rstrip(")]")
                fields = []
                for name in wanted.split():
                    value = msg.get(name)
                    if value:
                        fields.append(f"{name}: {value}".encode())
                raw = b"\r\n".join(fields) + b"\r\n\r\n"
            meta = f"1 (UID {uid} FLAGS (\\Seen)".encode()
            if "BODYSTRUCTURE" in spec:
                meta += b' BODYSTRUCTURE ("ATTACHMENT" ("FILENAME" "x"))'
            return "OK", [(meta, raw), b")"]
        raise AssertionError(f"unexpected uid command {command}")

    def logout(self):
        return "BYE", []


class FakeSMTP:
    def __init__(self):
        self.logged_in = None
        self.sent: list[EmailMessage] = []

    def login(self, user, password):
        self.logged_in = (user, password)

    def send_message(self, msg):
        self.sent.append(msg)

    def quit(self):
        pass


def _connected_secrets(tmp_path, **extra) -> SecretStore:
    secrets = SecretStore(tmp_path / "secrets.json")
    secrets.put(
        "email:default",
        {"address": "user@gmail.com", "app_password": "abcd efgh", **extra},
    )
    return secrets


def _tools(secrets, *, imap=None, smtp=None, roots=None):
    by_name = {}
    for tool in make_email_tools(
        secrets,
        roots=roots,
        imap_factory=lambda h, p: imap if imap is not None else FakeIMAP(),
        smtp_factory=lambda h, p: smtp if smtp is not None else FakeSMTP(),
    ):
        by_name[tool.__name__] = tool
    return by_name


def _multipart_message() -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = "Ana <ana@example.com>"
    msg["To"] = "user@gmail.com"
    msg["Subject"] = "Quarterly report"
    msg["Date"] = "Mon, 09 Jun 2026 10:00:00 +0000"
    msg["Message-ID"] = "<orig-123@example.com>"
    msg.set_content("Plain body here.")
    msg.add_alternative("<p>HTML body</p>", subtype="html")
    msg.add_attachment(
        b"%PDF-fake", maintype="application", subtype="pdf", filename="report.pdf"
    )
    return msg


# -- presets ----------------------------------------------------------------------
def test_resolve_servers_gmail_preset():
    servers, err = resolve_servers({"address": "x@gmail.com", "app_password": "p"})
    assert err == ""
    assert servers.imap_host == "imap.gmail.com" and servers.imap_port == 993
    assert servers.smtp_host == "smtp.gmail.com" and servers.smtp_port == 587


def test_resolve_servers_advanced_fields_override_preset():
    servers, _ = resolve_servers(
        {
            "address": "x@gmail.com",
            "imap_host": "mail.corp.io",
            "imap_port": "1993",
            "smtp_host": "smtp.corp.io",
            "smtp_port": "465",
        }
    )
    assert (servers.imap_host, servers.imap_port) == ("mail.corp.io", 1993)
    assert (servers.smtp_host, servers.smtp_port) == ("smtp.corp.io", 465)


def test_resolve_servers_unknown_domain_needs_hosts():
    servers, err = resolve_servers({"address": "x@unknown.example"})
    assert servers is None
    assert "IMAP and SMTP host" in err


# -- search criteria ----------------------------------------------------------------
def test_criteria_default_is_all():
    criteria, err = build_search_criteria()
    assert criteria == b"ALL" and err == ""


def test_criteria_quoting_dates_and_unseen():
    criteria, _ = build_search_criteria(
        from_address='a "b" c@x.io',
        subject="hi",
        since="2026-01-05",
        before="2026-02-01",
        unread_only=True,
    )
    text = criteria.decode()
    assert 'FROM "a \\"b\\" c@x.io"' in text
    assert 'SUBJECT "hi"' in text
    assert "SINCE 05-Jan-2026" in text and "BEFORE 01-Feb-2026" in text
    assert text.endswith("UNSEEN")


def test_criteria_bad_date_is_rejected():
    criteria, err = build_search_criteria(since="last week")
    assert criteria is None and "YYYY-MM-DD" in err


def test_criteria_non_ascii_gets_utf8_charset():
    criteria, _ = build_search_criteria(subject="日本語")
    assert criteria.startswith(b"CHARSET UTF-8 ")
    assert "日本語".encode("utf-8") in criteria


# -- MIME helpers ----------------------------------------------------------------
def test_decode_mime_header_rfc2047():
    assert decode_mime_header("=?utf-8?b?44GT44KT44Gr44Gh44Gv?=") == "こんにちは"
    assert decode_mime_header("plain") == "plain"
    assert decode_mime_header(None) == ""


def test_extract_text_body_prefers_plain():
    assert extract_text_body(_multipart_message()).strip() == "Plain body here."


def test_extract_text_body_html_fallback_and_truncation():
    msg = EmailMessage()
    msg.set_content("<p>Hello <b>world</b></p>", subtype="html")
    assert extract_text_body(msg) == "Hello world"
    long = EmailMessage()
    long.set_content("x" * 30_000)
    assert extract_text_body(long).endswith("…[truncated]")
    assert len(extract_text_body(long)) < 30_000


# -- tools -------------------------------------------------------------------------
def test_tools_error_when_not_connected(tmp_path):
    tools = _tools(SecretStore(tmp_path / "secrets.json"))
    for name in ("email_list_folders", "email_search", "email_read"):
        result = tools[name](**({"uid": "1"} if name == "email_read" else {}))
        assert "not connected" in result["error"]


def test_list_folders_skips_noselect(tmp_path):
    imap = FakeIMAP()
    tools = _tools(_connected_secrets(tmp_path), imap=imap)
    result = tools["email_list_folders"]()
    names = [f["name"] for f in result["folders"]]
    assert names == ["INBOX", "[Gmail]/Sent Mail"]
    assert all(f["messages"] == 7 for f in result["folders"])
    assert imap.logged_in == ("user@gmail.com", "abcd efgh")


def test_search_returns_newest_first_envelopes(tmp_path):
    imap = FakeIMAP({"1": _multipart_message(), "2": _multipart_message()})
    tools = _tools(_connected_secrets(tmp_path), imap=imap)
    result = tools["email_search"](subject="report", max_results=5)
    assert result["ok"] and result["total_matches"] == 2
    assert [m["uid"] for m in result["messages"]] == ["2", "1"]
    first = result["messages"][0]
    assert first["subject"] == "Quarterly report"
    assert first["has_attachments"] is True
    # reads are PEEK + readonly select — never marks anything
    assert all(sel[2] is True for sel in imap.commands if sel[0] == "select")


def test_read_returns_body_and_attachment_list(tmp_path):
    imap = FakeIMAP({"7": _multipart_message()})
    tools = _tools(_connected_secrets(tmp_path), imap=imap)
    result = tools["email_read"](uid="7")
    assert result["body"].strip() == "Plain body here."
    assert result["attachments"] == [
        {"filename": "report.pdf", "content_type": "application/pdf", "size": 9}
    ]


def test_download_attachment_saves_into_scratch_only(tmp_path):
    imap = FakeIMAP({"7": _multipart_message()})
    secrets = _connected_secrets(tmp_path)
    scratch = tmp_path / "scratch"
    scratch.mkdir()

    no_roots = _tools(secrets, imap=imap)
    assert (
        "no writable"
        in no_roots["email_download_attachment"](uid="7", filename="report.pdf")[
            "error"
        ]
    )

    imap2 = FakeIMAP({"7": _multipart_message()})
    tools = _tools(secrets, imap=imap2, roots=[RootDir(path=scratch, writable=True)])
    result = tools["email_download_attachment"](uid="7", filename="report.pdf")
    assert result["ok"]
    saved = scratch / "report.pdf"
    assert saved.read_bytes() == b"%PDF-fake"
    assert result["path"] == str(saved)

    missing = tools["email_download_attachment"](uid="7", filename="nope.pdf")
    assert "no attachment named" in missing["error"]


def test_send_sets_identity_and_requires_no_imap(tmp_path):
    smtp = FakeSMTP()
    secrets = _connected_secrets(tmp_path, display_name="Rohit")
    tools = _tools(secrets, smtp=smtp)
    result = tools["email_send"](to="ana@example.com", subject="Hi", body="Hello")
    assert result["ok"]
    sent = smtp.sent[0]
    assert sent["From"] == "Rohit <user@gmail.com>"
    assert sent["To"] == "ana@example.com"
    assert sent["Message-ID"].endswith("@gmail.com>")
    assert smtp.logged_in == ("user@gmail.com", "abcd efgh")


def test_send_reply_threads_and_reuses_subject(tmp_path):
    imap = FakeIMAP({"7": _multipart_message()})
    smtp = FakeSMTP()
    tools = _tools(_connected_secrets(tmp_path), imap=imap, smtp=smtp)
    result = tools["email_send"](
        to="ana@example.com", subject="", body="re!", reply_to_uid="7"
    )
    assert result["ok"] and result["subject"] == "Re: Quarterly report"
    sent = smtp.sent[0]
    assert sent["In-Reply-To"] == "<orig-123@example.com>"
    assert "<orig-123@example.com>" in sent["References"]
    assert sent["Subject"] == "Re: Quarterly report"


def test_send_attachment_must_live_inside_roots(tmp_path):
    smtp = FakeSMTP()
    scratch = tmp_path / "scratch"
    scratch.mkdir()
    (scratch / "ok.txt").write_text("fine")
    outside = tmp_path / "outside.txt"
    outside.write_text("nope")
    tools = _tools(
        _connected_secrets(tmp_path),
        smtp=smtp,
        roots=[RootDir(path=scratch, writable=True)],
    )
    denied = tools["email_send"](
        to="a@b.c", subject="s", body="b", attachments=[str(outside)]
    )
    assert "outside the session" in denied["error"] and not smtp.sent

    ok = tools["email_send"](
        to="a@b.c", subject="s", body="b", attachments=[str(scratch / "ok.txt")]
    )
    assert ok["ok"]
    assert [p.get_filename() for p in smtp.sent[0].iter_attachments()] == ["ok.txt"]


# -- metadata / wiring ----------------------------------------------------------------
def test_approval_gating(tmp_path):
    tools = _tools(_connected_secrets(tmp_path))
    gated = {
        name: fn.__aisuite_tool_metadata__.requires_approval
        for name, fn in tools.items()
    }
    assert gated == {
        "email_list_folders": False,
        "email_search": False,
        "email_read": False,
        "email_download_attachment": True,
        "email_send": True,
    }


def test_connector_registration():
    from coworker.connectors.descriptors import get_descriptor
    from coworker.connectors.tool_defs import TOOLS_BY_CONNECTOR, connector_for_tool

    descriptor = get_descriptor("email")
    assert descriptor is not None and descriptor.auth == "app_password"
    assert {t.name for t in TOOLS_BY_CONNECTOR["email"]} == {
        "email_list_folders",
        "email_search",
        "email_read",
        "email_download_attachment",
        "email_send",
    }
    assert connector_for_tool("email_send") == "email"


def test_make_integration_tools_includes_email(tmp_path):
    from coworker.connectors.integration_tools import make_integration_tools

    secrets = _connected_secrets(tmp_path)
    tools = make_integration_tools(
        secrets,
        enabled_connectors={"email"},
        enabled_tools={"email_search", "email_send"},
    )
    assert {t.__name__ for t in tools} == {"email_search", "email_send"}
