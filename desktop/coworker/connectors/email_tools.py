"""Email (IMAP/SMTP) connector tools — app-password auth, stdlib only.

One connector covers Gmail, iCloud, Fastmail, and custom IMAP servers: the user enters
an address + app password and servers are inferred from the address domain (advanced
fields override). Credentials are read from the SecretStore at execution time and never
enter prompts. All mailbox reads are non-destructive (read-only SELECT / PEEK fetches,
so the user's unread flags never flip) and v1 ships no delete/move/flag tools. Sending
and attachment download require approval. Sending is deliberately single-shot — SMTP
only, no APPEND-to-Sent afterwards — so a failure can never leave "delivered but looks
failed" state that tempts a retry into double-sending (Gmail saves to Sent server-side).
"""

from __future__ import annotations

import email as email_lib
import imaplib
import re
import smtplib
import ssl
from dataclasses import dataclass
from email.header import decode_header
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from pathlib import Path
from typing import Any, Callable, Optional

import aisuite as ai

from ..roots import RootDir
from ..secrets import SecretStore

_TIMEOUT = 30.0
_BODY_CHAR_LIMIT = 20_000
_MAX_SEARCH_RESULTS = 25
_MAX_FOLDERS = 50


# -- presets -------------------------------------------------------------------
@dataclass(frozen=True)
class EmailServers:
    imap_host: str
    imap_port: int = 993
    smtp_host: str = ""
    smtp_port: int = 587  # 587 → STARTTLS, 465 → implicit TLS


_PRESETS: dict[str, EmailServers] = {
    "gmail.com": EmailServers("imap.gmail.com", 993, "smtp.gmail.com", 587),
    "googlemail.com": EmailServers("imap.gmail.com", 993, "smtp.gmail.com", 587),
    "icloud.com": EmailServers("imap.mail.me.com", 993, "smtp.mail.me.com", 587),
    "me.com": EmailServers("imap.mail.me.com", 993, "smtp.mail.me.com", 587),
    "mac.com": EmailServers("imap.mail.me.com", 993, "smtp.mail.me.com", 587),
    "fastmail.com": EmailServers("imap.fastmail.com", 993, "smtp.fastmail.com", 465),
}


def resolve_servers(profile: dict[str, Any]) -> tuple[Optional[EmailServers], str]:
    """Servers for a profile: explicit advanced fields win, then the domain preset."""
    address = str(profile.get("address") or "").strip()
    domain = address.rsplit("@", 1)[-1].lower() if "@" in address else ""
    preset = _PRESETS.get(domain)

    def _port(key: str, fallback: int) -> int:
        raw = str(profile.get(key) or "").strip()
        try:
            return int(raw) if raw else fallback
        except ValueError:
            return fallback

    imap_host = str(profile.get("imap_host") or "").strip() or (
        preset.imap_host if preset else ""
    )
    smtp_host = str(profile.get("smtp_host") or "").strip() or (
        preset.smtp_host if preset else ""
    )
    if not imap_host or not smtp_host:
        return None, (
            f"no server preset for '{domain or address}' — fill in the IMAP and SMTP "
            "host fields in the connector settings"
        )
    return (
        EmailServers(
            imap_host=imap_host,
            imap_port=_port("imap_port", preset.imap_port if preset else 993),
            smtp_host=smtp_host,
            smtp_port=_port("smtp_port", preset.smtp_port if preset else 587),
        ),
        "",
    )


def _is_gmail(servers: EmailServers) -> bool:
    return servers.imap_host.endswith(".gmail.com")


def _auth_hint(servers: EmailServers) -> str:
    if _is_gmail(servers):
        return (
            " For Gmail, check that 2-Step Verification is on and that this is an app "
            "password from myaccount.google.com/apppasswords — not your account password."
        )
    return " Check the address and app password in the connector settings."


# -- connections ----------------------------------------------------------------
def _default_imap_factory(host: str, port: int) -> imaplib.IMAP4_SSL:
    return imaplib.IMAP4_SSL(host, port, timeout=_TIMEOUT)


def _default_smtp_factory(host: str, port: int) -> smtplib.SMTP:
    if port == 465:
        return smtplib.SMTP_SSL(
            host, port, timeout=_TIMEOUT, context=ssl.create_default_context()
        )
    smtp = smtplib.SMTP(host, port, timeout=_TIMEOUT)
    smtp.starttls(context=ssl.create_default_context())
    return smtp


def _imap_login(profile, servers, factory) -> imaplib.IMAP4:
    imap = factory(servers.imap_host, servers.imap_port)
    imap.login(profile["address"], profile["app_password"])
    return imap


def _smtp_login(profile, servers, factory) -> smtplib.SMTP:
    smtp = factory(servers.smtp_host, servers.smtp_port)
    smtp.login(profile["address"], profile["app_password"])
    return smtp


# -- MIME helpers ----------------------------------------------------------------
def decode_mime_header(raw: Any) -> str:
    if not raw:
        return ""
    parts = []
    for part, charset in decode_header(str(raw)):
        if isinstance(part, bytes):
            try:
                parts.append(part.decode(charset or "utf-8", errors="replace"))
            except LookupError:  # bogus charset label in the wild
                parts.append(part.decode("utf-8", errors="replace"))
        else:
            parts.append(part)
    return "".join(parts)


def _strip_html(html: str) -> str:
    text = re.sub(r"<(br|/p|/div|/tr)\s*/?>", "\n", html, flags=re.IGNORECASE)
    text = re.sub(
        r"<(script|style)[^>]*>.*?</\1>", "", text, flags=re.IGNORECASE | re.DOTALL
    )
    text = re.sub(r"<[^>]+>", "", text)
    for entity, char in (
        ("&nbsp;", " "),
        ("&amp;", "&"),
        ("&lt;", "<"),
        ("&gt;", ">"),
        ("&quot;", '"'),
        ("&#39;", "'"),
    ):
        text = text.replace(entity, char)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _decode_payload(part: email_lib.message.Message) -> str:
    payload = part.get_payload(decode=True)
    if not payload:
        return ""
    charset = part.get_content_charset() or "utf-8"
    try:
        return payload.decode(charset, errors="replace")
    except LookupError:
        return payload.decode("utf-8", errors="replace")


def extract_text_body(msg: email_lib.message.Message) -> str:
    """Best text rendering of a message: prefer text/plain, fall back to stripped HTML."""
    candidates = msg.walk() if msg.is_multipart() else [msg]
    plain, html = "", ""
    for part in candidates:
        if "attachment" in str(part.get("Content-Disposition", "")):
            continue
        ctype = part.get_content_type()
        if ctype == "text/plain" and not plain:
            plain = _decode_payload(part)
        elif ctype == "text/html" and not html:
            html = _decode_payload(part)
    text = plain or _strip_html(html)
    if len(text) > _BODY_CHAR_LIMIT:
        text = text[:_BODY_CHAR_LIMIT] + "\n…[truncated]"
    return text


def list_attachment_parts(
    msg: email_lib.message.Message,
) -> list[tuple[str, email_lib.message.Message]]:
    out = []
    if not msg.is_multipart():
        return out
    for part in msg.walk():
        disposition = str(part.get("Content-Disposition", ""))
        filename = part.get_filename()
        if "attachment" not in disposition and not (
            filename and "inline" in disposition
        ):
            continue
        if filename:
            out.append((decode_mime_header(filename), part))
    return out


# -- IMAP query building -----------------------------------------------------------
def _quote(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


_DATE_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")
_MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()


def _imap_date(value: str) -> Optional[str]:
    m = _DATE_RE.match(value.strip())
    if not m:
        return None
    year, month, day = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if not 1 <= month <= 12:
        return None
    return f"{day:02d}-{_MONTHS[month - 1]}-{year}"


def build_search_criteria(
    *,
    from_address: str = "",
    to_address: str = "",
    subject: str = "",
    text: str = "",
    since: str = "",
    before: str = "",
    unread_only: bool = False,
) -> tuple[Optional[bytes], str]:
    """An IMAP SEARCH criteria string (as bytes, UTF-8) or an error message."""
    parts: list[str] = []
    for key, value in (
        ("FROM", from_address),
        ("TO", to_address),
        ("SUBJECT", subject),
        ("TEXT", text),
    ):
        if value and value.strip():
            parts.append(f"{key} {_quote(value.strip())}")
    for key, value in (("SINCE", since), ("BEFORE", before)):
        if value and value.strip():
            date = _imap_date(value)
            if date is None:
                return None, f"invalid {key.lower()} date {value!r}; use YYYY-MM-DD"
            parts.append(f"{key} {date}")
    if unread_only:
        parts.append("UNSEEN")
    criteria = " ".join(parts) if parts else "ALL"
    if criteria.isascii():
        return criteria.encode("ascii"), ""
    # Non-ASCII terms ride as UTF-8 with an explicit CHARSET (Gmail/iCloud accept this).
    return b"CHARSET UTF-8 " + criteria.encode("utf-8"), ""


_LIST_RE = re.compile(rb'\((?P<flags>[^)]*)\)\s+"(?P<delim>[^"]*)"\s+(?P<name>.+)$')


def _parse_list_line(line: bytes) -> Optional[str]:
    m = _LIST_RE.match(line)
    if not m:
        return None
    name = m.group("name").strip()
    if name.startswith(b'"') and name.endswith(b'"'):
        name = name[1:-1].replace(b'\\"', b'"')
    if rb"\Noselect" in m.group("flags"):
        return None
    try:
        return name.decode("utf-8")
    except UnicodeDecodeError:
        return name.decode("latin-1")


def _select_readonly(imap: imaplib.IMAP4, folder: str) -> Optional[str]:
    status, _ = imap.select(_quote(folder), readonly=True)
    if status != "OK":
        return f"cannot open folder {folder!r}"
    return None


def _fetch_message(
    imap: imaplib.IMAP4, uid: str
) -> Optional[email_lib.message.Message]:
    status, data = imap.uid("FETCH", uid, "(BODY.PEEK[])")
    if status != "OK" or not data or not isinstance(data[0], tuple):
        return None
    return email_lib.message_from_bytes(data[0][1])


def _safe_filename(name: str) -> str:
    name = Path(name.replace("\\", "/")).name  # strip any path components
    name = re.sub(r'[\x00-\x1f<>:"|?*]', "_", name).strip(". ")
    return name or "attachment"


# -- tool metadata plumbing (same shape as the sibling connector modules) -----------
def _meta(name: str, *, approval: bool, capabilities: list[str]):
    return ai.ToolMetadata(
        name=name,
        category="connector",
        risk_level="medium" if approval else "low",
        capabilities=capabilities,
        requires_approval=approval,
    )


def _schema(
    name: str, description: str, properties: dict[str, Any], required: list[str]
) -> dict[str, Any]:
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {
                "type": "object",
                "properties": properties,
                "required": required,
            },
        },
    }


def _attach(
    fn: Callable[..., Any],
    schema: dict[str, Any],
    *,
    approval: bool,
    caps: list[str],
):
    from .tool_defs import approval_for_tool

    name = schema["function"]["name"]
    # §36: the tool registry's read/write kind wins for registered tools — reads never gate.
    approval = approval_for_tool(name, default=approval)
    fn.__name__ = name
    fn.__coworker_schema__ = schema
    fn.__aisuite_tool_metadata__ = _meta(name, approval=approval, capabilities=caps)
    fn.__doc__ = schema["function"]["description"]
    return fn


# -- the tools ----------------------------------------------------------------------
def make_email_tools(
    secrets: SecretStore,
    *,
    roots: Optional[list[RootDir]] = None,
    imap_factory: Callable[[str, int], imaplib.IMAP4] = _default_imap_factory,
    smtp_factory: Callable[[str, int], smtplib.SMTP] = _default_smtp_factory,
) -> list[Callable[..., Any]]:
    def _connect_imap():
        """(imap, profile, servers, error) — error is a tool-result dict."""
        profile = secrets.get("email:default") or {}
        if not profile.get("address") or not profile.get("app_password"):
            return (
                None,
                None,
                None,
                {"error": "email is not connected; add it in Manage → Integrations"},
            )
        servers, err = resolve_servers(profile)
        if servers is None:
            return None, None, None, {"error": err}
        try:
            imap = _imap_login(profile, servers, imap_factory)
        except Exception as exc:
            return (
                None,
                None,
                None,
                {"error": f"IMAP login failed: {exc}.{_auth_hint(servers)}"},
            )
        return imap, profile, servers, None

    def _logout(imap) -> None:
        try:
            imap.logout()
        except Exception:
            pass

    def email_list_folders() -> dict[str, Any]:
        imap, _, _, err = _connect_imap()
        if err:
            return err
        try:
            status, lines = imap.list()
            if status != "OK":
                return {"error": "could not list folders"}
            folders = []
            for line in lines[:_MAX_FOLDERS]:
                name = _parse_list_line(line) if isinstance(line, bytes) else None
                if name is None:
                    continue
                entry: dict[str, Any] = {"name": name}
                try:
                    st, data = imap.status(_quote(name), "(MESSAGES)")
                    if st == "OK" and data and data[0]:
                        m = re.search(rb"MESSAGES\s+(\d+)", data[0])
                        if m:
                            entry["messages"] = int(m.group(1))
                except Exception:
                    pass
                folders.append(entry)
            return {"ok": True, "folders": folders}
        except Exception as exc:
            return {"error": str(exc)}
        finally:
            _logout(imap)

    def email_search(
        folder: str = "INBOX",
        from_address: str = "",
        to_address: str = "",
        subject: str = "",
        text: str = "",
        since: str = "",
        before: str = "",
        unread_only: bool = False,
        max_results: int = 10,
    ) -> dict[str, Any]:
        criteria, crit_err = build_search_criteria(
            from_address=from_address,
            to_address=to_address,
            subject=subject,
            text=text,
            since=since,
            before=before,
            unread_only=bool(unread_only),
        )
        if criteria is None:
            return {"error": crit_err}
        imap, _, _, err = _connect_imap()
        if err:
            return err
        try:
            sel_err = _select_readonly(imap, folder)
            if sel_err:
                return {"error": sel_err}
            status, data = imap.uid("SEARCH", criteria)
            if status != "OK":
                return {"error": "search failed"}
            uids = (data[0] or b"").split()
            limit = max(1, min(int(max_results or 10), _MAX_SEARCH_RESULTS))
            newest = list(reversed(uids[-limit:]))  # UIDs ascend → newest last
            messages = []
            for uid in newest:
                status, fetched = imap.uid(
                    "FETCH",
                    uid.decode(),
                    "(BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE)] FLAGS BODYSTRUCTURE)",
                )
                if status != "OK" or not fetched:
                    continue
                header_bytes = b""
                meta_bytes = b""
                for item in fetched:
                    if isinstance(item, tuple):
                        meta_bytes += item[0]
                        header_bytes += item[1]
                    elif isinstance(item, bytes):
                        meta_bytes += item
                headers = email_lib.message_from_bytes(header_bytes)
                messages.append(
                    {
                        "uid": uid.decode(),
                        "date": decode_mime_header(headers.get("Date", "")),
                        "from": decode_mime_header(headers.get("From", "")),
                        "to": decode_mime_header(headers.get("To", "")),
                        "subject": decode_mime_header(headers.get("Subject", "")),
                        "unread": b"\\Seen" not in meta_bytes,
                        "has_attachments": b'"ATTACHMENT"' in meta_bytes.upper(),
                    }
                )
            return {
                "ok": True,
                "folder": folder,
                "total_matches": len(uids),
                "messages": messages,
            }
        except Exception as exc:
            return {"error": str(exc)}
        finally:
            _logout(imap)

    def email_read(uid: str, folder: str = "INBOX") -> dict[str, Any]:
        imap, _, _, err = _connect_imap()
        if err:
            return err
        try:
            sel_err = _select_readonly(imap, folder)
            if sel_err:
                return {"error": sel_err}
            msg = _fetch_message(imap, str(uid))
            if msg is None:
                return {"error": f"message {uid} not found in {folder}"}
            attachments = [
                {
                    "filename": name,
                    "content_type": part.get_content_type(),
                    "size": len(part.get_payload(decode=True) or b""),
                }
                for name, part in list_attachment_parts(msg)
            ]
            return {
                "ok": True,
                "uid": str(uid),
                "folder": folder,
                "from": decode_mime_header(msg.get("From", "")),
                "to": decode_mime_header(msg.get("To", "")),
                "cc": decode_mime_header(msg.get("Cc", "")),
                "date": decode_mime_header(msg.get("Date", "")),
                "subject": decode_mime_header(msg.get("Subject", "")),
                "body": extract_text_body(msg),
                "attachments": attachments,
            }
        except Exception as exc:
            return {"error": str(exc)}
        finally:
            _logout(imap)

    def email_download_attachment(
        uid: str, filename: str, folder: str = "INBOX"
    ) -> dict[str, Any]:
        scratch = roots[0] if roots else None
        if scratch is None or not scratch.writable:
            return {
                "error": "no writable session directory to save the attachment into"
            }
        imap, _, _, err = _connect_imap()
        if err:
            return err
        try:
            sel_err = _select_readonly(imap, folder)
            if sel_err:
                return {"error": sel_err}
            msg = _fetch_message(imap, str(uid))
            if msg is None:
                return {"error": f"message {uid} not found in {folder}"}
            for name, part in list_attachment_parts(msg):
                if name == filename:
                    payload = part.get_payload(decode=True) or b""
                    target = scratch.path / _safe_filename(name)
                    counter = 1
                    while target.exists():
                        target = (
                            scratch.path
                            / f"{target.stem.rstrip('-0123456789') or 'attachment'}-{counter}{target.suffix}"
                        )
                        counter += 1
                    target.write_bytes(payload)
                    return {"ok": True, "path": str(target), "size": len(payload)}
            available = [n for n, _ in list_attachment_parts(msg)]
            return {
                "error": f"no attachment named {filename!r}; message has {available}"
            }
        except Exception as exc:
            return {"error": str(exc)}
        finally:
            _logout(imap)

    def email_send(
        to: str,
        subject: str,
        body: str,
        cc: str = "",
        bcc: str = "",
        reply_to_uid: str = "",
        reply_to_folder: str = "INBOX",
        attachments: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        profile = secrets.get("email:default") or {}
        if not profile.get("address") or not profile.get("app_password"):
            return {"error": "email is not connected; add it in Manage → Integrations"}
        servers, res_err = resolve_servers(profile)
        if servers is None:
            return {"error": res_err}

        msg = EmailMessage()
        display = str(profile.get("display_name") or "").strip()
        msg["From"] = (
            formataddr((display, profile["address"])) if display else profile["address"]
        )
        msg["To"] = to
        if cc:
            msg["Cc"] = cc
        if bcc:
            msg["Bcc"] = bcc
        msg["Message-ID"] = make_msgid(domain=profile["address"].rsplit("@", 1)[-1])

        # Reply threading: pull Message-ID/References/Subject from the original first.
        final_subject = subject
        if reply_to_uid:
            imap, _, _, err = _connect_imap()
            if err:
                return err
            try:
                sel_err = _select_readonly(imap, reply_to_folder)
                if sel_err:
                    return {"error": sel_err}
                status, data = imap.uid(
                    "FETCH",
                    str(reply_to_uid),
                    "(BODY.PEEK[HEADER.FIELDS (MESSAGE-ID REFERENCES SUBJECT)])",
                )
                if status != "OK" or not data or not isinstance(data[0], tuple):
                    return {
                        "error": f"reply target {reply_to_uid} not found in {reply_to_folder}"
                    }
                orig = email_lib.message_from_bytes(data[0][1])
                orig_id = str(orig.get("Message-ID", "")).strip()
                if orig_id:
                    msg["In-Reply-To"] = orig_id
                    refs = str(orig.get("References", "")).strip()
                    msg["References"] = f"{refs} {orig_id}".strip()
                if not subject:
                    orig_subject = decode_mime_header(orig.get("Subject", ""))
                    final_subject = (
                        orig_subject
                        if orig_subject.lower().startswith("re:")
                        else f"Re: {orig_subject}"
                    )
            except Exception as exc:
                return {"error": str(exc)}
            finally:
                _logout(imap)
        msg["Subject"] = final_subject
        msg.set_content(body)

        allowed_roots = [r.path for r in (roots or [])]
        for raw_path in attachments or []:
            path = Path(str(raw_path)).expanduser().resolve()
            if not any(path.is_relative_to(root) for root in allowed_roots):
                return {
                    "error": f"attachment {raw_path} is outside the session's directories"
                }
            if not path.is_file():
                return {"error": f"attachment not found: {raw_path}"}
            import mimetypes

            ctype = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
            maintype, subtype = ctype.split("/", 1)
            msg.add_attachment(
                path.read_bytes(),
                maintype=maintype,
                subtype=subtype,
                filename=path.name,
            )

        try:
            smtp = _smtp_login(profile, servers, smtp_factory)
        except Exception as exc:
            return {"error": f"SMTP login failed: {exc}.{_auth_hint(servers)}"}
        try:
            smtp.send_message(msg)
        except Exception as exc:
            return {"error": f"send failed: {exc}"}
        finally:
            try:
                smtp.quit()
            except Exception:
                pass
        return {"ok": True, "message_id": msg["Message-ID"], "subject": final_subject}

    return [
        _attach(
            email_list_folders,
            _schema(
                "email_list_folders",
                "List the connected mailbox's folders and message counts.",
                {},
                [],
            ),
            approval=False,
            caps=["email", "read"],
        ),
        _attach(
            email_search,
            _schema(
                "email_search",
                "Search the connected mailbox. Returns newest-first envelopes (uid, date, "
                "from, to, subject, unread, has_attachments). Never marks messages read.",
                {
                    "folder": {
                        "type": "string",
                        "description": "Mailbox folder, default INBOX.",
                    },
                    "from_address": {"type": "string", "description": "Match sender."},
                    "to_address": {"type": "string", "description": "Match recipient."},
                    "subject": {
                        "type": "string",
                        "description": "Match subject substring.",
                    },
                    "text": {
                        "type": "string",
                        "description": "Match anywhere in the message.",
                    },
                    "since": {
                        "type": "string",
                        "description": "On/after this date, YYYY-MM-DD.",
                    },
                    "before": {
                        "type": "string",
                        "description": "Before this date, YYYY-MM-DD.",
                    },
                    "unread_only": {"type": "boolean"},
                    "max_results": {
                        "type": "integer",
                        "description": "Default 10, max 25.",
                    },
                },
                [],
            ),
            approval=False,
            caps=["email", "read"],
        ),
        _attach(
            email_read,
            _schema(
                "email_read",
                "Read one email by uid: headers, text body, and attachment names/sizes "
                "(use email_download_attachment to save one). Never marks messages read.",
                {
                    "uid": {"type": "string", "description": "UID from email_search."},
                    "folder": {
                        "type": "string",
                        "description": "Folder the uid lives in, default INBOX.",
                    },
                },
                ["uid"],
            ),
            approval=False,
            caps=["email", "read"],
        ),
        _attach(
            email_download_attachment,
            _schema(
                "email_download_attachment",
                "Save one attachment from an email into the session's primary directory "
                "and return the saved path. Requires user approval.",
                {
                    "uid": {"type": "string", "description": "UID from email_search."},
                    "filename": {
                        "type": "string",
                        "description": "Attachment filename as listed by email_read.",
                    },
                    "folder": {
                        "type": "string",
                        "description": "Folder the uid lives in, default INBOX.",
                    },
                },
                ["uid", "filename"],
            ),
            approval=True,
            caps=["email", "read"],
        ),
        _attach(
            email_send,
            _schema(
                "email_send",
                "Send an email from the connected account. Requires user approval. To reply "
                "to a message pass reply_to_uid (threading headers and Re: subject are set "
                "automatically; leave subject empty to reuse the original).",
                {
                    "to": {
                        "type": "string",
                        "description": "Recipient address(es), comma-separated.",
                    },
                    "subject": {"type": "string"},
                    "body": {"type": "string", "description": "Plain-text body."},
                    "cc": {"type": "string"},
                    "bcc": {"type": "string"},
                    "reply_to_uid": {
                        "type": "string",
                        "description": "UID of the message being replied to.",
                    },
                    "reply_to_folder": {
                        "type": "string",
                        "description": "Folder of reply_to_uid, default INBOX.",
                    },
                    "attachments": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Paths within the session's directories to attach.",
                    },
                },
                ["to", "subject", "body"],
            ),
            approval=True,
            caps=["email", "write"],
        ),
    ]


def validate_email_account(creds: dict[str, Any]) -> tuple[bool, str, str]:
    """Connect-time check: IMAP login + INBOX open and SMTP login must both pass.

    Returns (ok, identity, error). Used by the connector descriptor so a mailbox with
    IMAP disabled (common on org-managed accounts) fails in the wizard with an
    actionable message instead of at first tool call.
    """
    servers, err = resolve_servers(creds)
    if servers is None:
        return False, "", err
    address = str(creds.get("address") or "")
    inbox_count = ""
    try:
        imap = _default_imap_factory(servers.imap_host, servers.imap_port)
        try:
            imap.login(address, creds.get("app_password", ""))
            status, data = imap.select('"INBOX"', readonly=True)
            if status == "OK" and data and data[0]:
                inbox_count = data[0].decode(errors="replace")
        finally:
            try:
                imap.logout()
            except Exception:
                pass
    except Exception as exc:
        return False, "", f"IMAP check failed: {exc}.{_auth_hint(servers)}"
    try:
        smtp = _default_smtp_factory(servers.smtp_host, servers.smtp_port)
        try:
            smtp.login(address, creds.get("app_password", ""))
        finally:
            try:
                smtp.quit()
            except Exception:
                pass
    except Exception as exc:
        return False, "", f"SMTP check failed: {exc}.{_auth_hint(servers)}"
    identity = address + (f" · INBOX: {inbox_count} messages" if inbox_count else "")
    return True, identity, ""
