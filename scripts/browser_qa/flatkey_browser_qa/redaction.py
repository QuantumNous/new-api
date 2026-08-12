import re
import threading
from dataclasses import dataclass, field
from urllib.parse import parse_qsl, unquote, urlencode, urlsplit, urlunsplit


_SECRET_KEYS = {
    "authorization",
    "cookie",
    "set-cookie",
    "password",
    "token",
    "access_token",
    "refresh_token",
    "api_key",
    "apikey",
    "secret",
}
_QUERY_SECRET_KEYS = _SECRET_KEYS | {"code"}
_API_KEY_RE = re.compile(r"\bsk-[A-Za-z0-9_-]{8,}\b")
_URL_RE = re.compile(r"https?://[^\s\"'<>]+")
_VERIFICATION_CODE_RE = re.compile(r"^[0-9a-f]{6}$")


@dataclass(repr=False)
class Redactor:
    email: str | None = None
    password: str | None = None
    code: str | None = None
    extra_secrets: tuple[str, ...] = field(default_factory=tuple)

    def __post_init__(self):
        self._lock = threading.RLock()
        self._text_replacements = []
        if self.email:
            local, _, domain = self.email.partition("@")
            base_local = local.split("+", 1)[0]
            if base_local and domain:
                self._text_replacements.append((f"{base_local}@{domain}", "[REDACTED_EMAIL]"))
                self._email_alias_re = re.compile(rf"\b{re.escape(base_local)}\+[A-Za-z0-9._%+-]+@{re.escape(domain)}\b")
            else:
                self._email_alias_re = None
            self._text_replacements.append((self.email, "[REDACTED_EMAIL]"))
        else:
            self._email_alias_re = None
        if self.password:
            self._text_replacements.append((self.password, "[REDACTED_PASSWORD]"))
        if self.code:
            self._text_replacements.append((self.code, "[REDACTED_CODE]"))
        for secret in self.extra_secrets:
            if secret:
                self._text_replacements.append((secret, "[REDACTED_SECRET]"))

    def __repr__(self):
        return "Redactor()"

    def clean(self, value):
        if isinstance(value, dict):
            return {
                key: self._redact_by_key(key, item)
                for key, item in value.items()
            }
        if isinstance(value, list):
            return [self.clean(item) for item in value]
        if isinstance(value, tuple):
            return tuple(self.clean(item) for item in value)
        if isinstance(value, str):
            return self._clean_text(value)
        return value

    def _redact_by_key(self, key, value):
        if key == "deleted_token_count" and isinstance(value, int) and not isinstance(value, bool):
            return value
        normalized = _normalize_key(key)
        if any(marker in normalized for marker in _SECRET_KEYS):
            return self._placeholder_for_key(normalized)
        return self.clean(value)

    def _placeholder_for_key(self, key):
        if "cookie" in key:
            return "[REDACTED_COOKIE]"
        if "authorization" in key:
            return "[REDACTED_AUTHORIZATION]"
        if "password" in key:
            return "[REDACTED_PASSWORD]"
        return "[REDACTED_SECRET]"

    def _clean_text(self, text):
        cleaned = self._clean_url_query(text)
        cleaned = _API_KEY_RE.sub("[REDACTED_API_KEY]", cleaned)
        if self._email_alias_re is not None:
            cleaned = self._email_alias_re.sub("[REDACTED_EMAIL]", cleaned)
        with self._lock:
            replacements = list(self._text_replacements)
        for secret, replacement in replacements:
            cleaned = cleaned.replace(secret, replacement)
        return cleaned

    def register_code(self, code):
        if not isinstance(code, str) or not _VERIFICATION_CODE_RE.fullmatch(code):
            raise ValueError("verification code must be exactly six lowercase hex characters")
        with self._lock:
            marker = (code, "[REDACTED_CODE]")
            if marker not in self._text_replacements:
                self._text_replacements.append(marker)

    def _clean_url_query(self, text):
        if not text.startswith(("http://", "https://")):
            return _URL_RE.sub(lambda match: self._clean_url_query(match.group(0)), text)

        try:
            parsed = urlsplit(text)
        except ValueError:
            return text
        if not parsed.scheme or not parsed.netloc:
            return text
        if not parsed.query and not parsed.fragment:
            return text

        redacted, query_changed = self._clean_url_params(parsed.query) if parsed.query else ([], False)
        fragment, fragment_changed = self._clean_fragment(parsed.fragment)
        changed = query_changed or fragment_changed
        if not changed:
            return text
        return urlunsplit(
            (
                parsed.scheme,
                parsed.netloc,
                parsed.path,
                urlencode(redacted, doseq=True, safe="/[]:?&="),
                fragment,
            )
        )

    def _is_secret_key(self, key):
        normalized = _normalize_key(key)
        return any(marker in normalized for marker in _QUERY_SECRET_KEYS)

    def _clean_url_params(self, params):
        redacted = []
        changed = False
        for key, value in parse_qsl(params, keep_blank_values=True):
            if self._is_secret_key(key):
                redacted.append((key, "[REDACTED_SECRET]"))
                changed = True
            else:
                cleaned = self._clean_text(unquote(value)) if value else value
                redacted.append((key, cleaned))
                changed = changed or cleaned != value
        return redacted, changed

    def _clean_fragment(self, fragment):
        if not fragment or "=" not in fragment:
            return self._clean_text(fragment) if fragment else fragment, False
        redacted, changed = self._clean_url_params(fragment)
        return urlencode(redacted, doseq=True, safe="/[]:?&="), changed


def _normalize_key(key):
    return str(key).lower().replace("-", "_")
