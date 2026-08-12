import base64
import email.errors
import email.header
import email.utils
import html.parser
import json
import os
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass


GMAIL_API_ORIGIN = "https://gmail.googleapis.com"
GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"
GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token"
_MAX_RESPONSE_BYTES = 1024 * 1024
_MAX_PART_BYTES = 64 * 1024
_MAX_MIME_PARTS = 50
_MAX_MIME_DEPTH = 12
_MAX_TEXT_BYTES = 128 * 1024
_MAX_CANDIDATES = 10
_CODE_RE = re.compile(r"^[0-9a-f]{6}$")
_BASE_EMAIL_RE = re.compile(r"^[^@\s+]+@[^@\s@]+$")


class GmailError(Exception):
    pass


class GmailConfigError(GmailError):
    pass


class GmailInvalidGrant(GmailError):
    pass


class GmailTransientError(GmailError):
    pass


class GmailPermanentError(GmailError):
    pass


class _NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _default_opener():
    return urllib.request.build_opener(_NoRedirectHandler(), urllib.request.ProxyHandler({}))


@dataclass(frozen=True, repr=False)
class OAuthCredentials:
    refresh_token: str
    token_uri: str
    client_id: str
    client_secret: str
    scopes: tuple[str, ...]

    def __repr__(self):
        return "OAuthCredentials(scopes=('gmail.readonly',))"

    @classmethod
    def from_env(cls, env=None):
        env = os.environ if env is None else env
        value = env.get("GMAIL_OAUTH_JSON")
        if not value:
            raise GmailConfigError("missing GMAIL_OAUTH_JSON")
        return cls.from_json(value)

    @classmethod
    def from_json(cls, value):
        try:
            payload = json.loads(value)
        except json.JSONDecodeError as exc:
            raise GmailConfigError("invalid oauth json") from exc
        if not isinstance(payload, dict):
            raise GmailConfigError("invalid oauth json")
        required = ["refresh_token", "token_uri", "client_id", "client_secret", "scopes"]
        if any(not payload.get(key) for key in required):
            raise GmailConfigError("oauth json missing required fields")
        for key in ["refresh_token", "token_uri", "client_id", "client_secret"]:
            if not isinstance(payload[key], str) or not payload[key].strip():
                raise GmailConfigError("oauth credential fields must be non-empty strings")
        scopes = payload["scopes"]
        if isinstance(scopes, str):
            scopes = tuple(scopes.split())
        elif isinstance(scopes, list) and all(isinstance(item, str) for item in scopes):
            scopes = tuple(scopes)
        else:
            raise GmailConfigError("oauth scopes must be strings")
        if set(scopes) != {GMAIL_READONLY_SCOPE}:
            raise GmailConfigError("oauth scope must be exactly gmail.readonly")
        if payload["token_uri"] != GOOGLE_TOKEN_URI:
            raise GmailConfigError("oauth token uri is not trusted")
        return cls(
            refresh_token=str(payload["refresh_token"]),
            token_uri=str(payload["token_uri"]),
            client_id=str(payload["client_id"]),
            client_secret=str(payload["client_secret"]),
            scopes=scopes,
        )


@dataclass(frozen=True)
class VerificationSearch:
    email_tag: str
    run_start_epoch: int
    sender: str
    subject_marker: str
    now_epoch: int | None = None


class GmailClient:
    def __init__(self, credentials: OAuthCredentials, *, opener=None, retry_base_delay=0.2, now=None):
        self.credentials = credentials
        self.opener = opener or _default_opener()
        self.retry_base_delay = retry_base_delay
        self._now = now or time.time
        self._token_lock = threading.RLock()
        self._access_token = None
        self._access_token_expires_at = 0
        self._base_address = None

    def __repr__(self):
        return "GmailClient()"

    @property
    def base_address(self):
        if self._base_address is None:
            self._base_address = self.get_profile_email()
        return self._base_address

    def refresh_access_token(self):
        with self._token_lock:
            return self._refresh_access_token_unlocked()

    def _refresh_access_token_unlocked(self):
        body = urllib.parse.urlencode(
            {
                "client_id": self.credentials.client_id,
                "client_secret": self.credentials.client_secret,
                "refresh_token": self.credentials.refresh_token,
                "grant_type": "refresh_token",
            }
        ).encode("utf-8")
        headers = {"Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded"}
        payload = self._request_json("POST", self.credentials.token_uri, data=body, headers=headers, auth=False)
        token = payload.get("access_token")
        if not isinstance(token, str) or not token:
            raise GmailPermanentError("oauth token response missing access token")
        expires_in = payload.get("expires_in")
        if not isinstance(expires_in, int) or isinstance(expires_in, bool) or expires_in <= 0:
            raise GmailPermanentError("oauth token response missing expiry")
        self._access_token = token
        self._access_token_expires_at = self._now() + max(expires_in - 60, 0)
        return token

    def get_profile_email(self):
        payload = self._gmail_json("GET", "/gmail/v1/users/me/profile")
        email_address = payload.get("emailAddress")
        if not isinstance(email_address, str) or not _BASE_EMAIL_RE.fullmatch(email_address):
            raise GmailConfigError("gmail profile missing email address")
        return email_address.lower()

    def find_verification_code(self, search: VerificationSearch):
        if not _valid_email_tag(search.email_tag):
            raise GmailConfigError("invalid email tag")
        base = self.base_address
        local, domain = base.split("@", 1)
        alias = f"{local}+{search.email_tag}@{domain}"
        query = f"to:{base} from:{search.sender.lower()} after:{int(search.run_start_epoch)}"
        list_payload = self._gmail_json(
            "GET",
            "/gmail/v1/users/me/messages",
            params={
                "q": query,
                "maxResults": str(_MAX_CANDIDATES),
                "includeSpamTrash": "true",
            },
        )
        messages = list_payload.get("messages", [])
        if messages is None:
            messages = []
        if not isinstance(messages, list):
            raise GmailPermanentError("gmail list response malformed")
        codes = []
        for item in messages[:_MAX_CANDIDATES]:
            if not isinstance(item, dict) or not isinstance(item.get("id"), str):
                continue
            message = self._gmail_json(
                "GET",
                f"/gmail/v1/users/me/messages/{urllib.parse.quote(item['id'], safe='')}",
                params={"format": "full"},
            )
            code = parse_verification_code(
                message,
                alias=alias,
                sender=search.sender,
                subject_marker=search.subject_marker,
                run_start_epoch=search.run_start_epoch,
                now_epoch=search.now_epoch,
            )
            if code and code not in codes:
                codes.append(code)
        if len(codes) == 1:
            return codes[0]
        return None

    def _gmail_json(self, method, path, *, params=None):
        if not path.startswith("/gmail/v1/"):
            raise GmailConfigError("gmail path outside allowed api")
        query = urllib.parse.urlencode(params or {})
        url = GMAIL_API_ORIGIN + path + (("?" + query) if query else "")
        return self._request_json(method, url, headers={"Accept": "application/json"}, auth=True)

    def _request_json(self, method, url, *, data=None, headers=None, auth=True, max_attempts=3):
        parsed = urllib.parse.urlparse(url)
        if url == self.credentials.token_uri:
            pass
        elif parsed.scheme != "https" or parsed.netloc != "gmail.googleapis.com":
            raise GmailConfigError("request target is not an allowed Google API origin")
        request_headers = dict(headers or {})
        refreshed_after_401 = False
        for attempt in range(1, max_attempts + 1):
            if auth:
                request_headers["Authorization"] = f"Bearer {self._ensure_access_token()}"
            request = urllib.request.Request(url, data=data, headers=request_headers, method=method)
            try:
                with self.opener.open(request, timeout=10) as response:
                    raw = response.read(_MAX_RESPONSE_BYTES + 1)
                    status = response.status
            except urllib.error.HTTPError as exc:
                status = exc.code
                body = _read_error_body(exc)
                if url == self.credentials.token_uri and _is_invalid_grant(body):
                    raise GmailInvalidGrant("oauth invalid_grant") from exc
                if auth and status == 401 and not refreshed_after_401:
                    self._clear_access_token()
                    self.refresh_access_token()
                    refreshed_after_401 = True
                    continue
                if status in (429,) or 500 <= status <= 599:
                    if attempt < max_attempts:
                        self._sleep(attempt)
                        continue
                    raise GmailTransientError("google api transient failure") from exc
                if 300 <= status <= 399:
                    raise GmailConfigError("google api redirect blocked") from exc
                raise GmailPermanentError("google api request failed") from exc
            except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as exc:
                if attempt < max_attempts:
                    self._sleep(attempt)
                    continue
                raise GmailTransientError("google api connection failed") from exc
            if 300 <= status <= 399:
                raise GmailConfigError("google api redirect blocked")
            if status in (429,) or 500 <= status <= 599:
                if attempt < max_attempts:
                    self._sleep(attempt)
                    continue
                raise GmailTransientError("google api transient failure")
            if not 200 <= status <= 299:
                raise GmailPermanentError("google api request failed")
            if len(raw) > _MAX_RESPONSE_BYTES:
                raise GmailPermanentError("google api response too large")
            try:
                payload = json.loads(raw.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise GmailPermanentError("google api json malformed") from exc
            if not isinstance(payload, dict):
                raise GmailPermanentError("google api json malformed")
            return payload
        raise GmailTransientError("google api retry attempts exhausted")

    def _ensure_access_token(self):
        with self._token_lock:
            if self._access_token and self._now() < self._access_token_expires_at:
                return self._access_token
            return self._refresh_access_token_unlocked()

    def _clear_access_token(self):
        with self._token_lock:
            self._access_token = None
            self._access_token_expires_at = 0

    def _sleep(self, attempt):
        if self.retry_base_delay <= 0:
            return
        time.sleep(min(self.retry_base_delay * (2 ** (attempt - 1)), 2.0))


def parse_verification_code(message, *, alias, sender, subject_marker, run_start_epoch, now_epoch=None):
    if not isinstance(message, dict):
        return None
    try:
        internal_ms = int(message.get("internalDate"))
    except (TypeError, ValueError):
        return None
    internal_epoch = internal_ms // 1000
    if internal_epoch < int(run_start_epoch):
        return None
    if now_epoch is not None and internal_epoch > int(now_epoch) + 60:
        return None
    payload = message.get("payload")
    if not isinstance(payload, dict):
        return None
    headers = _headers(payload)
    if not _alias_matches(headers, alias):
        return None
    if _single_address(headers.get("from")) != sender.lower():
        return None
    subject = _decode_header_value(headers.get("subject", ""))
    if subject is None or subject_marker.casefold() not in subject.casefold():
        return None
    code_regions = _collect_verification_code_regions(payload)
    if code_regions is None:
        return None
    codes = set()
    for region in code_regions:
        code = region.strip()
        if _CODE_RE.fullmatch(code) is None:
            return None
        codes.add(code)
    if len(codes) != 1:
        return None
    return next(iter(codes))


def _headers(payload):
    out = {}
    for item in payload.get("headers", []) or []:
        if isinstance(item, dict) and isinstance(item.get("name"), str) and isinstance(item.get("value"), str):
            out[item["name"].lower()] = item["value"]
    return out


def _decode_header_value(value):
    try:
        return str(email.header.make_header(email.header.decode_header(value)))
    except (email.errors.HeaderParseError, LookupError, UnicodeError, ValueError):
        return None


def _alias_matches(headers, alias):
    expected = alias.lower()
    values = []
    for name in ("to", "delivered-to", "x-original-to"):
        if headers.get(name):
            values.append(headers[name])
    for _display, address in email.utils.getaddresses(values):
        if address.lower() == expected:
            return True
    return False


def _single_address(value):
    if not value:
        return ""
    parsed = email.utils.getaddresses([value])
    if len(parsed) != 1 or not parsed[0][1]:
        return ""
    return parsed[0][1].lower()


def _collect_verification_code_regions(root):
    stack = [(root, 0)]
    seen_parts = 0
    total_bytes = 0
    regions = []
    while stack:
        part, depth = stack.pop()
        if not isinstance(part, dict):
            return None
        seen_parts += 1
        if seen_parts > _MAX_MIME_PARTS or depth > _MAX_MIME_DEPTH:
            return None
        children = part.get("parts", []) or []
        if not isinstance(children, list):
            return None
        for child in reversed(children):
            stack.append((child, depth + 1))
        if _is_attachment_part(part):
            continue
        mime_type = str(part.get("mimeType", "")).lower()
        body = part.get("body") if isinstance(part.get("body"), dict) else {}
        data = body.get("data")
        if mime_type in {"text/plain", "text/html"} and isinstance(data, str):
            decoded = _decode_base64url(data)
            if decoded is None:
                return None
            total_bytes += len(decoded.encode("utf-8"))
            if total_bytes > _MAX_TEXT_BYTES:
                return None
            if mime_type == "text/html":
                regions.extend(_html_verification_code_regions(decoded))
    return regions


def _is_attachment_part(part):
    if part.get("filename"):
        return True
    body = part.get("body") if isinstance(part.get("body"), dict) else {}
    if body.get("attachmentId"):
        return True
    headers = _headers(part)
    disposition = headers.get("content-disposition", "").lower()
    return "attachment" in disposition or "filename=" in disposition


def _decode_base64url(data):
    if len(data) > _MAX_PART_BYTES * 2:
        return None
    try:
        raw = base64.urlsafe_b64decode(data + ("=" * (-len(data) % 4)))
    except (ValueError, base64.binascii.Error):
        return None
    if len(raw) > _MAX_PART_BYTES:
        return None
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return None


class _VerificationCodeRegionParser(html.parser.HTMLParser):
    _SKIP_TAGS = {"script", "style", "noscript", "template"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self._skip_depth = 0
        self._capture_depth = 0
        self._capture_chunks = []
        self.regions = []

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in self._SKIP_TAGS:
            self._skip_depth += 1
        if self._capture_depth:
            self._capture_depth += 1
            return
        if not self._skip_depth and _has_html_class(attrs, "verification-code"):
            self._capture_depth = 1
            self._capture_chunks = []

    def handle_endtag(self, tag):
        if self._capture_depth:
            self._capture_depth -= 1
            if not self._capture_depth:
                self.regions.append("".join(self._capture_chunks))
                self._capture_chunks = []
        if tag.lower() in self._SKIP_TAGS and self._skip_depth:
            self._skip_depth -= 1

    def handle_data(self, data):
        if self._capture_depth and not self._skip_depth:
            self._capture_chunks.append(data)


def _html_verification_code_regions(html):
    parser = _VerificationCodeRegionParser()
    parser.feed(html)
    parser.close()
    return parser.regions


def _has_html_class(attrs, expected):
    for name, value in attrs:
        if name.lower() == "class" and isinstance(value, str) and expected in value.split():
            return True
    return False


def _read_error_body(exc):
    try:
        raw = exc.fp.read(4096) if exc.fp else b""
        return json.loads(raw.decode("utf-8")) if raw else {}
    except Exception:
        return {}


def _is_invalid_grant(payload):
    return isinstance(payload, dict) and payload.get("error") == "invalid_grant"


def _valid_email_tag(value):
    return isinstance(value, str) and re.fullmatch(r"qa-[0-9]+-[a-z0-9]{8}", value) is not None
