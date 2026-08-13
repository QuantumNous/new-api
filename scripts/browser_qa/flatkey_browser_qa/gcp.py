import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request


METADATA_ORIGIN = "http://metadata.google.internal"
STORAGE_ORIGIN = "https://storage.googleapis.com"
_MAX_RESPONSE_BYTES = 256 * 1024
_BUCKET_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$")
_DNS_LABEL = r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?"
_LEGACY_RUN_APP_RE = re.compile(rf"{_DNS_LABEL}(?:-{_DNS_LABEL}){{2}}\.a\.run\.app")
_REGIONAL_RUN_APP_RE = re.compile(rf"{_DNS_LABEL}-[0-9]+\.{_DNS_LABEL}\.run\.app")


class GcpError(Exception):
    pass


class GcpConfigError(GcpError):
    pass


class GcpTransientError(GcpError):
    pass


class GcsObjectAlreadyExists(GcpError):
    pass


class GcsUploadUncertain(GcpError):
    pass


class _NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _default_opener():
    return urllib.request.build_opener(_NoRedirectHandler(), urllib.request.ProxyHandler({}))


class GcpClient:
    def __init__(self, *, opener=None, retry_base_delay=0.2):
        self.opener = opener or _default_opener()
        self.retry_base_delay = retry_base_delay

    def __repr__(self):
        return "GcpClient()"

    def identity_token(self, audience, *, timeout=5, max_attempts=3):
        normalized_audience = _validate_cloud_run_service_url(audience)
        path = "/computeMetadata/v1/instance/service-accounts/default/identity"
        query = urllib.parse.urlencode({"audience": normalized_audience, "format": "full"})
        return self._metadata_text(path + "?" + query, timeout=timeout, max_attempts=max_attempts)

    def access_token(self):
        payload = self._metadata_json("/computeMetadata/v1/instance/service-accounts/default/token")
        token = payload.get("access_token")
        if not isinstance(token, str) or not token:
            raise GcpConfigError("metadata token response malformed")
        return token

    def _metadata_json(self, selector):
        raw = self._metadata_text(selector)
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise GcpConfigError("metadata json response malformed") from exc
        if not isinstance(payload, dict):
            raise GcpConfigError("metadata json response malformed")
        return payload

    def _metadata_text(self, selector, *, timeout=5, max_attempts=3):
        if not selector.startswith("/computeMetadata/v1/instance/service-accounts/default/"):
            raise GcpConfigError("metadata path outside service-account contract")
        url = METADATA_ORIGIN + selector
        return _request_bytes(
            self.opener,
            "GET",
            url,
            headers={"Metadata-Flavor": "Google"},
            timeout=timeout,
            retry_base_delay=self.retry_base_delay,
            max_attempts=max_attempts,
            require_metadata_flavor=True,
        ).decode("utf-8")


def upload_gcs_object(
    bucket,
    object_name,
    data,
    content_type,
    access_token,
    *,
    opener=None,
    retry_base_delay=0.2,
    if_generation_match=0,
):
    _validate_bucket(bucket)
    _validate_object_name(object_name)
    if not isinstance(data, bytes):
        raise TypeError("data must be bytes")
    if not isinstance(content_type, str) or not content_type:
        raise GcpConfigError("content type is required")
    if not isinstance(access_token, str) or not access_token:
        raise GcpConfigError("access token is required")
    selected_opener = opener or _default_opener()
    path = f"/upload/storage/v1/b/{urllib.parse.quote(bucket, safe='')}/o"
    query = urllib.parse.urlencode(
        {
            "uploadType": "media",
            "name": object_name,
            "ifGenerationMatch": str(_validate_generation(if_generation_match)),
        }
    )
    url = STORAGE_ORIGIN + path + "?" + query
    payload = _request_bytes(
        selected_opener,
        "POST",
        url,
        data=data,
        headers={"Authorization": f"Bearer {access_token}", "Content-Type": content_type},
        timeout=15,
        retry_base_delay=retry_base_delay,
        classify_gcs_precondition=True,
    )
    try:
        decoded = json.loads(payload.decode("utf-8")) if payload else {}
    except json.JSONDecodeError as exc:
        raise GcpConfigError("gcs upload response malformed") from exc
    if not isinstance(decoded, dict):
        raise GcpConfigError("gcs upload response malformed")
    return decoded


def read_gcs_json_object(bucket, object_name, access_token, *, opener=None, retry_base_delay=0.2):
    _validate_bucket(bucket)
    _validate_object_name(object_name)
    if not isinstance(access_token, str) or not access_token:
        raise GcpConfigError("access token is required")
    selected_opener = opener or _default_opener()
    path = f"/storage/v1/b/{urllib.parse.quote(bucket, safe='')}/o/{urllib.parse.quote(object_name, safe='')}"
    url = STORAGE_ORIGIN + path + "?alt=media"
    payload, headers = _request_bytes_with_headers(
        selected_opener,
        "GET",
        url,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=15,
        retry_base_delay=retry_base_delay,
        classify_gcs_read=True,
    )
    generation = headers.get("x-goog-generation") or headers.get("X-Goog-Generation")
    try:
        generation = int(generation)
    except (TypeError, ValueError) as exc:
        raise GcpConfigError("gcs generation header malformed") from exc
    _validate_generation(generation)
    try:
        decoded = json.loads(payload.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise GcpConfigError("gcs json response malformed") from exc
    if not isinstance(decoded, dict):
        raise GcpConfigError("gcs json response malformed")
    return decoded, generation


def _request_bytes(
    opener,
    method,
    url,
    *,
    data=None,
    headers=None,
    timeout=10,
    retry_base_delay=0.2,
    max_attempts=3,
    require_metadata_flavor=False,
    classify_gcs_precondition=False,
    classify_gcs_read=False,
):
    payload, _headers = _request_bytes_with_headers(
        opener,
        method,
        url,
        data=data,
        headers=headers,
        timeout=timeout,
        retry_base_delay=retry_base_delay,
        max_attempts=max_attempts,
        require_metadata_flavor=require_metadata_flavor,
        classify_gcs_precondition=classify_gcs_precondition,
        classify_gcs_read=classify_gcs_read,
    )
    return payload


def _request_bytes_with_headers(
    opener,
    method,
    url,
    *,
    data=None,
    headers=None,
    timeout=10,
    retry_base_delay=0.2,
    max_attempts=3,
    require_metadata_flavor=False,
    classify_gcs_precondition=False,
    classify_gcs_read=False,
):
    parsed = urllib.parse.urlparse(url)
    if parsed.netloc == "metadata.google.internal":
        if parsed.scheme != "http":
            raise GcpConfigError("metadata origin must be exact")
    elif parsed.netloc == "storage.googleapis.com":
        if parsed.scheme != "https":
            raise GcpConfigError("storage origin must be exact")
    else:
        raise GcpConfigError("google request origin must be exact")
    uncertain_previous_attempt = False
    for attempt in range(1, max_attempts + 1):
        request = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
        try:
            with opener.open(request, timeout=timeout) as response:
                status = response.status
                if require_metadata_flavor and response.headers.get("Metadata-Flavor") != "Google":
                    raise GcpConfigError("metadata response missing Google flavor")
                raw = response.read(_MAX_RESPONSE_BYTES + 1)
        except urllib.error.HTTPError as exc:
            if 300 <= exc.code <= 399:
                raise GcpConfigError("google redirect blocked") from exc
            if classify_gcs_read and exc.code == 404:
                raise FileNotFoundError("gcs object not found") from exc
            if classify_gcs_read and exc.code == 412:
                raise GcsObjectAlreadyExists("gcs generation precondition failed") from exc
            if classify_gcs_precondition and exc.code == 412:
                if uncertain_previous_attempt:
                    raise GcsUploadUncertain("gcs upload may have succeeded before precondition failure") from exc
                raise GcsObjectAlreadyExists("gcs object already exists") from exc
            if exc.code in (429,) or 500 <= exc.code <= 599:
                if attempt < max_attempts:
                    _sleep(retry_base_delay, attempt)
                    continue
                raise GcpTransientError("google transient failure") from exc
            raise GcpConfigError("google request failed") from exc
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as exc:
            if attempt < max_attempts:
                uncertain_previous_attempt = True
                _sleep(retry_base_delay, attempt)
                continue
            raise GcpTransientError("google connection failed") from exc
        if 300 <= status <= 399:
            raise GcpConfigError("google redirect blocked")
        if status in (429,) or 500 <= status <= 599:
            if attempt < max_attempts:
                _sleep(retry_base_delay, attempt)
                continue
            raise GcpTransientError("google transient failure")
        if not 200 <= status <= 299:
            raise GcpConfigError("google request failed")
        if len(raw) > _MAX_RESPONSE_BYTES:
            raise GcpConfigError("google response too large")
        return raw, response.headers
    raise GcpTransientError("google retry attempts exhausted")


def _validate_cloud_run_service_url(value):
    parsed = urllib.parse.urlparse(value)
    hostname = parsed.hostname or ""
    if (
        parsed.scheme != "https"
        or not parsed.netloc
        or parsed.netloc != hostname
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
        or parsed.path not in ("", "/")
        or not (_LEGACY_RUN_APP_RE.fullmatch(hostname) or _REGIONAL_RUN_APP_RE.fullmatch(hostname))
    ):
        raise GcpConfigError("audience must be a canonical Cloud Run service root URL")
    return urllib.parse.urlunsplit(("https", hostname, "", "", ""))


def _validate_bucket(bucket):
    if not isinstance(bucket, str) or not 3 <= len(bucket) <= 63 or not _BUCKET_RE.fullmatch(bucket) or ".." in bucket:
        raise GcpConfigError("invalid gcs bucket")


def _validate_object_name(name):
    if not isinstance(name, str) or not name or name.startswith("/") or "\\" in name:
        raise GcpConfigError("invalid gcs object")
    if any(ord(char) < 32 or ord(char) == 127 for char in name):
        raise GcpConfigError("invalid gcs object")
    if len(name.encode("utf-8")) > 1024:
        raise GcpConfigError("invalid gcs object")
    parts = name.split("/")
    if any(part in {"", ".", ".."} for part in parts):
        raise GcpConfigError("invalid gcs object")


def _validate_generation(value):
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise GcpConfigError("invalid gcs generation precondition")
    return value


def _sleep(base, attempt):
    if base <= 0:
        return
    time.sleep(min(base * (2 ** (attempt - 1)), 2.0))
