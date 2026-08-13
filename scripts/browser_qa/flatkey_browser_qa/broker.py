import json
import os
import re
import socket
import sys
import time
from dataclasses import dataclass
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from .gmail import GmailClient
from .gmail import GmailConfigError
from .gmail import OAuthCredentials
from .gmail import GmailError
from .gmail import GmailInvalidGrant
from .gmail import GmailPermanentError
from .gmail import GmailTransientError
from .gmail import VerificationSearch


_TAG_RE = re.compile(r"^qa-(?P<run_id>[0-9]+)-[a-z0-9]{8}$")
_MAX_BODY_BYTES = 4096


def _default_log(event):
    print(json.dumps(event, sort_keys=True), flush=True)


@dataclass(frozen=True)
class BrokerConfig:
    sender: str
    subject_marker: str
    max_age_seconds: int = 900
    max_future_seconds: int = 60
    request_timeout_seconds: float = 5.0
    now: object = time.time
    log: object = _default_log


class VerificationBroker:
    def __init__(self, gmail_client, config: BrokerConfig):
        self.gmail_client = gmail_client
        self.config = config

    def current_code(self, payload):
        _validate_payload_shape(payload)
        run_id = payload["run_id"]
        email_tag = payload["email_tag"]
        start_time = payload["start_time"]
        if not _ascii_decimal(run_id):
            raise BrokerRequestError(HTTPStatus.BAD_REQUEST, "invalid_run_id")
        match = _TAG_RE.fullmatch(email_tag)
        if not match or match.group("run_id") != run_id:
            raise BrokerRequestError(HTTPStatus.BAD_REQUEST, "invalid_email_tag")
        if not isinstance(start_time, int) or isinstance(start_time, bool):
            raise BrokerRequestError(HTTPStatus.BAD_REQUEST, "invalid_start_time")
        now = int(self.config.now())
        if start_time < now - self.config.max_age_seconds or start_time > now + self.config.max_future_seconds:
            raise BrokerRequestError(HTTPStatus.BAD_REQUEST, "invalid_time_window")
        code = self.gmail_client.find_verification_code(
            VerificationSearch(
                email_tag=email_tag,
                run_start_epoch=start_time,
                sender=self.config.sender,
                subject_marker=self.config.subject_marker,
                now_epoch=now,
            )
        )
        if code:
            return {"status": "ready", "code": code}
        return {"status": "pending"}


class BrokerRequestError(Exception):
    def __init__(self, status, code):
        super().__init__(code)
        self.status = status
        self.code = code


def make_handler(broker: VerificationBroker):
    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def setup(self):
            super().setup()
            self.connection.settimeout(float(broker.config.request_timeout_seconds))

        def log_message(self, *_):
            return

        def _write_json(self, status, payload):
            raw = json.dumps(payload, sort_keys=True).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def _write_error(self, status, code):
            self._write_json(status, {"error": code})

        def _log(self, run_id, status, started):
            latency_ms = int((time.monotonic() - started) * 1000)
            event = {"event": "broker_request", "status": status, "latency_ms": latency_ms}
            if run_id and _ascii_decimal(run_id):
                event["run_id"] = run_id
            broker.config.log(event)

        def do_GET(self):
            self._write_error(HTTPStatus.METHOD_NOT_ALLOWED, "method_not_allowed")

        def do_POST(self):
            started = time.monotonic()
            run_id = None
            status_text = "error"
            try:
                if self.path != "/v1/current-code":
                    raise BrokerRequestError(HTTPStatus.NOT_FOUND, "not_found")
                content_type = self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
                if content_type != "application/json":
                    raise BrokerRequestError(HTTPStatus.UNSUPPORTED_MEDIA_TYPE, "unsupported_media_type")
                if self.headers.get("Transfer-Encoding"):
                    raise BrokerRequestError(HTTPStatus.LENGTH_REQUIRED, "length_required")
                length_header = self.headers.get("Content-Length")
                if not length_header:
                    raise BrokerRequestError(HTTPStatus.LENGTH_REQUIRED, "length_required")
                try:
                    length = int(length_header)
                except ValueError as exc:
                    raise BrokerRequestError(HTTPStatus.LENGTH_REQUIRED, "length_required") from exc
                if length < 0:
                    raise BrokerRequestError(HTTPStatus.BAD_REQUEST, "invalid_content_length")
                if length > _MAX_BODY_BYTES:
                    raise BrokerRequestError(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, "body_too_large")
                try:
                    raw = self.rfile.read(length)
                except socket.timeout as exc:
                    raise BrokerRequestError(HTTPStatus.REQUEST_TIMEOUT, "request_timeout") from exc
                if len(raw) != length:
                    raise BrokerRequestError(HTTPStatus.REQUEST_TIMEOUT, "request_timeout")
                try:
                    payload = json.loads(raw.decode("utf-8"))
                except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                    raise BrokerRequestError(HTTPStatus.BAD_REQUEST, "invalid_json") from exc
                if isinstance(payload, dict):
                    run_id = payload.get("run_id") if isinstance(payload.get("run_id"), str) else None
                response = broker.current_code(payload)
                status_text = response["status"]
                self._write_json(HTTPStatus.OK, response)
            except BrokerRequestError as exc:
                if exc.code == "request_timeout":
                    self.close_connection = True
                self._write_error(exc.status, exc.code)
            except GmailInvalidGrant:
                self._write_error(HTTPStatus.SERVICE_UNAVAILABLE, "gmail_invalid_grant")
            except GmailTransientError:
                self._write_error(HTTPStatus.SERVICE_UNAVAILABLE, "gmail_transient_failure")
            except GmailConfigError:
                self._write_error(HTTPStatus.INTERNAL_SERVER_ERROR, "gmail_config_error")
            except GmailPermanentError:
                self._write_error(HTTPStatus.BAD_GATEWAY, "gmail_request_failed")
            except GmailError:
                self._write_error(HTTPStatus.BAD_GATEWAY, "gmail_request_failed")
            finally:
                self._log(run_id, status_text, started)

    return Handler


def serve_forever(gmail_client, config: BrokerConfig, port=None):
    selected_port = int(port if port is not None else os.environ["PORT"])
    server = ThreadingHTTPServer(("0.0.0.0", selected_port), make_handler(VerificationBroker(gmail_client, config)))
    server.serve_forever()


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    if argv:
        raise SystemExit("broker does not accept command line arguments")
    credentials = OAuthCredentials.from_env()
    gmail_client = GmailClient(credentials)
    serve_forever(
        gmail_client,
        BrokerConfig(
            sender="mail@noreply.flatkey.ai",
            subject_marker="flatkey",
        ),
    )
    return 0


def _validate_payload_shape(payload):
    if not isinstance(payload, dict):
        raise BrokerRequestError(HTTPStatus.BAD_REQUEST, "invalid_json")
    allowed = {"run_id", "email_tag", "start_time"}
    if set(payload) != allowed:
        raise BrokerRequestError(HTTPStatus.BAD_REQUEST, "invalid_fields")


def _ascii_decimal(value):
    return isinstance(value, str) and value.isascii() and value.isdecimal()


if __name__ == "__main__":
    raise SystemExit(main())
