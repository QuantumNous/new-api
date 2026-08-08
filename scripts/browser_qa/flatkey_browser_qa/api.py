import http.cookiejar
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass


STAGING_CONSOLE_ORIGIN = "https://staging-console.flatkey.ai"


class ApiError(Exception):
    def __init__(self, message, *, status=None, retryable=False):
        super().__init__(message)
        self.status = status
        self.retryable = retryable


class MalformedApiResponse(ApiError):
    pass


@dataclass(frozen=True)
class LoginResult:
    user_id: str | None = None
    auth_rejected: bool = False


class _NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class StagingApiClient:
    def __init__(self, origin=STAGING_CONSOLE_ORIGIN, *, allow_test_origin=False, retry_base_delay=0.2):
        self.origin = _validate_origin(origin, allow_test_origin)
        self.retry_base_delay = retry_base_delay
        self.cookies = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.cookies),
            _NoRedirectHandler(),
        )
        self.user_id = None

    def clear_cookies(self):
        self.cookies.clear()
        self.user_id = None

    def login(self, username, password):
        payload = self._request_json(
            "POST",
            "/api/user/login",
            {"username": username, "password": password},
            protected=False,
        )
        if payload.get("success") is True:
            data = payload.get("data")
            if not isinstance(data, dict) or not _is_positive_int(data.get("id")):
                raise MalformedApiResponse("malformed login response")
            self.user_id = str(data["id"])
            return LoginResult(user_id=self.user_id)
        if payload.get("success") is False and _is_authentication_rejection(payload):
            return LoginResult(auth_rejected=True)
        raise ApiError("login was not accepted and was not an authentication rejection")

    def list_tokens(self, *, page, size):
        if page < 1 or size < 1:
            raise ValueError("page and size must be positive")
        payload = self._request_json("GET", f"/api/token/?p={page}&size={size}", protected=True)
        if payload.get("success") is not True:
            raise ApiError("token listing failed")
        data = payload.get("data")
        if not isinstance(data, dict):
            raise MalformedApiResponse("malformed token pagination")
        items = data.get("items")
        total = data.get("total")
        if not isinstance(items, list) or not _is_non_negative_int(total):
            raise MalformedApiResponse("malformed token pagination")
        ids = []
        for item in items:
            if not isinstance(item, dict) or not _is_positive_int(item.get("id")):
                raise MalformedApiResponse("malformed token pagination")
            ids.append(str(item["id"]))
        return ids, total

    def delete_token(self, token_id):
        try:
            payload = self._request_json("DELETE", f"/api/token/{urllib.parse.quote(token_id, safe='')}", protected=True)
        except ApiError as exc:
            if exc.status == 404:
                return False
            raise ApiError("token deletion failed", status=exc.status, retryable=exc.retryable) from exc
        if payload.get("success") is False and _is_record_not_found(payload):
            return False
        if payload.get("success") is not True:
            raise ApiError("token deletion failed")
        return True

    def delete_self(self):
        payload = self._request_json("DELETE", "/api/user/self", protected=True)
        if payload.get("success") is not True:
            raise ApiError("account deletion failed")
        return True

    def _request_json(self, method, path, body=None, *, protected, max_attempts=3):
        data = None if body is None else json.dumps(body).encode("utf-8")
        headers = {"Accept": "application/json", "Accept-Language": "en"}
        if body is not None:
            headers["Content-Type"] = "application/json"
        if protected:
            if not self.user_id:
                raise ApiError("protected request attempted without a user session")
            headers["New-Api-User"] = self.user_id
        url = self.origin + path

        for attempt in range(1, max_attempts + 1):
            request = urllib.request.Request(url, data=data, headers=headers, method=method)
            try:
                with self.opener.open(request, timeout=10) as response:
                    status = response.status
                    raw = response.read(1024 * 1024)
            except urllib.error.HTTPError as exc:
                status = exc.code
                if 500 <= status <= 599 and attempt < max_attempts:
                    self._sleep(attempt)
                    continue
                raise ApiError("http request failed", status=status, retryable=500 <= status <= 599) from exc
            except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as exc:
                if attempt < max_attempts:
                    self._sleep(attempt)
                    continue
                raise ApiError("connection failed", retryable=True) from exc

            if 500 <= status <= 599:
                if attempt < max_attempts:
                    self._sleep(attempt)
                    continue
                raise ApiError("http request failed", status=status, retryable=True)
            if not 200 <= status <= 299:
                raise ApiError("http request failed", status=status, retryable=False)
            try:
                payload = json.loads(raw.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise MalformedApiResponse("malformed json response") from exc
            if not isinstance(payload, dict):
                raise MalformedApiResponse("malformed json response")
            return payload
        raise ApiError("retry attempts exhausted", retryable=True)

    def _sleep(self, attempt):
        if self.retry_base_delay <= 0:
            return
        time.sleep(min(self.retry_base_delay * (2 ** (attempt - 1)), 2.0))


def _validate_origin(origin, allow_test_origin):
    parsed = urllib.parse.urlparse(origin)
    if parsed.path not in ("", "/") or parsed.query or parsed.fragment or parsed.username or parsed.password:
        raise ValueError("console origin must not include path, query, fragment or credentials")
    if origin == STAGING_CONSOLE_ORIGIN:
        return origin
    if allow_test_origin and parsed.scheme == "http" and parsed.hostname in {"127.0.0.1", "localhost"} and parsed.port:
        return origin.rstrip("/")
    raise ValueError(f"console origin must be exactly {STAGING_CONSOLE_ORIGIN}")


def _is_authentication_rejection(payload):
    message = " ".join(str(payload.get("message", "")).lower().replace("_", " ").replace("-", " ").split())
    if not message:
        return False
    blocked_markers = ("turnstile", "captcha", "disabled", "malformed")
    if any(marker in message for marker in blocked_markers):
        return False
    allowed_messages = {
        "invalid username or password",
        "invalid username/password",
        "incorrect username or password",
        "username or password is incorrect, or user has been banned",
        "invalid credentials",
        "authentication failed",
    }
    return message in allowed_messages


def _is_positive_int(value):
    return isinstance(value, int) and not isinstance(value, bool) and value > 0


def _is_non_negative_int(value):
    return isinstance(value, int) and not isinstance(value, bool) and value >= 0


def _is_record_not_found(payload):
    message = " ".join(str(payload.get("message", "")).lower().replace("_", " ").replace("-", " ").split())
    return message in {"record not found", "not found"}
