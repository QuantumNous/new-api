"""Numeric Evidence validation and the independent signed daemon client."""

import base64
import copy
from datetime import datetime
import hashlib
import hmac
import http.client
import json
import math
import re
import secrets
import time
from urllib.parse import urlsplit

from modeltrace_runtime.operations import _identity
from modeltrace_runtime.numeric_rows import normalize_row


BODY_LIMIT = 256 * 1024
PROTOCOLS = ("chat", "responses", "messages", "task_bridge")
RECORD_FIELDS = {
    "probe_id", "binding_id", "claimed_model", "protocol", "evidence_sha256",
    "state", "observed_at", "result", "error_code",
}


def safe_label(value):
    if type(value) is not str or len(value.encode("utf-8")) > 1024:
        raise ValueError("invalid_request")
    normalize_row({"row_id": "label", "source": value, "condition_id": "label",
                   "challenge_id": "label", "expected_count": 0, "numbers": []})
    if re.search(r"(?i)(?<![^\W_])(?:api[\W_]*key|authorization|bearer|secret|token|"
                 r"password|credential)(?![^\W_])", value):
        raise ValueError("invalid_request")
    return value


def binding_metadata(value):
    if (type(value) is not dict or set(value) != {
            "binding_id", "claimed_model", "protocol"}
            or type(value["binding_id"]) is not str
            or not re.fullmatch(r"bnd_[A-Za-z0-9_-]{24}", value["binding_id"])
            or value["protocol"] not in PROTOCOLS):
        raise ValueError("invalid_request")
    safe_label(value["claimed_model"])
    return copy.deepcopy(value)


def validate_evidence(value):
    if type(value) is not dict or set(value) != {
            "schema_version", "probe_id", "binding_id", "claimed_model",
            "protocol", "bank_revision", "samples"}:
        raise ValueError("invalid_request")
    if type(value["schema_version"]) is not int or value["schema_version"] != 1:
        raise ValueError("invalid_request")
    _identity(value["probe_id"])
    binding_metadata({key: value[key] for key in ("binding_id", "claimed_model", "protocol")})
    if type(value["bank_revision"]) is not str or not re.fullmatch(
            r"[0-9a-f]{64}", value["bank_revision"]):
        raise ValueError("invalid_request")
    samples = value["samples"]
    if type(samples) is not list or not 1 <= len(samples) <= 3:
        raise ValueError("invalid_request")
    seen, eligible = set(), 0
    for sample in samples:
        if type(sample) is not dict or set(sample) != {
                "challenge_id", "expected_count", "numbers"}:
            raise ValueError("invalid_request")
        identity = _identity(sample["challenge_id"])
        if identity in seen:
            raise ValueError("invalid_request")
        seen.add(identity)
        row = normalize_row({
            "row_id": identity, "source": "numeric", "condition_id": "numeric",
            **sample,
        })
        eligible += row["strict_valid"]
    if not eligible:
        raise ValueError("invalid_request")
    payload = json.dumps(value, ensure_ascii=True, allow_nan=False,
                         separators=(",", ":")).encode("utf-8")
    if len(payload) > BODY_LIMIT:
        raise ValueError("invalid_request")
    return payload


def validate_record(value, probe_id):
    if type(value) is not dict or set(value) != RECORD_FIELDS or value["probe_id"] != probe_id:
        raise ValueError("invalid_response")
    _identity(value["probe_id"])
    binding_metadata({key: value[key] for key in ("binding_id", "claimed_model", "protocol")})
    if not re.fullmatch(r"[0-9a-f]{64}", value["evidence_sha256"]):
        raise ValueError("invalid_response")
    if (type(value["observed_at"]) is not str or len(value["observed_at"]) > 40
            or datetime.fromisoformat(value["observed_at"]).tzinfo is None):
        raise ValueError("invalid_response")
    state, result, error = value["state"], value["result"], value["error_code"]
    if state == "running":
        if result is not None or error != "":
            raise ValueError("invalid_response")
    elif state in ("cancelled", "failed"):
        errors = ("cancelled",) if state == "cancelled" else (
            "deadline_exceeded", "execution_failed", "configuration_invalid",
            "integrity_failed", "process_limit", "invalid_result", "interrupted",
        )
        if result is not None or error not in errors:
            raise ValueError("invalid_response")
    elif state == "succeeded":
        validate_result(result, value["claimed_model"])
        if error != "":
            raise ValueError("invalid_response")
    else:
        raise ValueError("invalid_response")
    return value


def validate_result(value, claimed):
    if type(value) is not dict or set(value) != {
            "prediction", "probability", "used_outputs", "complete", "closed_set",
            "assessment", "bank_revision", "engine_revision", "models", "families"}:
        raise ValueError("invalid_response")
    safe_label(value["prediction"])
    for field in ("bank_revision", "engine_revision"):
        if type(value[field]) is not str or not re.fullmatch("[0-9a-f]{64}", value[field]):
            raise ValueError("invalid_response")
    used = value["used_outputs"]
    if (type(used) is not int or not 1 <= used <= 3
            or type(value["complete"]) is not bool or value["complete"] != (used == 3)
            or value["closed_set"] is not True
            or type(value["models"]) is not list or not 1 <= len(value["models"]) <= 256
            or type(value["families"]) is not list or not 1 <= len(value["families"]) <= 32):
        raise ValueError("invalid_response")
    families, labels, previous = {}, set(), 1.0
    for model in value["models"]:
        if type(model) is not dict or set(model) != {
                "model", "family", "probability", "score", "profile_similarity"}:
            raise ValueError("invalid_response")
        safe_label(model["model"])
        if (type(model["family"]) is not str
                or not re.fullmatch("[A-Za-z0-9][A-Za-z0-9._-]{0,127}", model["family"])
                or model["model"] in labels):
            raise ValueError("invalid_response")
        for field in ("probability", "score", "profile_similarity"):
            number = model[field]
            if type(number) not in (int, float) or not math.isfinite(number):
                raise ValueError("invalid_response")
        probability = model["probability"]
        if not 0 <= probability <= previous:
            raise ValueError("invalid_response")
        previous = probability
        labels.add(model["model"])
        families[model["family"]] = families.get(model["family"], 0) + probability
    seen = set()
    for family in value["families"]:
        if (type(family) is not dict or set(family) != {"family", "probability"}
                or family["family"] not in families or family["family"] in seen
                or type(family["probability"]) not in (int, float)
                or not math.isfinite(family["probability"])
                or abs(family["probability"] - families[family["family"]]) > 1e-9):
            raise ValueError("invalid_response")
        seen.add(family["family"])
    top = value["models"][0]
    if (seen != set(families) or abs(sum(families.values()) - 1) > 1e-9
            or value["prediction"] != top["model"]
            or type(value["probability"]) not in (int, float)
            or not math.isfinite(value["probability"])
            or abs(value["probability"] - top["probability"]) > 1e-9):
        raise ValueError("invalid_response")
    assessment = "inconclusive"
    if value["complete"] and top["probability"] >= .9 and claimed in labels:
        assessment = "matched" if claimed == top["model"] else "mismatched"
    if value["assessment"] != assessment:
        raise ValueError("invalid_response")


def _http_exchange(value):
    parsed = urlsplit(value["daemon_url"])
    connection_type = http.client.HTTPSConnection if parsed.scheme == "https" else http.client.HTTPConnection
    connection = connection_type(parsed.hostname, parsed.port, timeout=value["connect_timeout"])
    try:
        connection.connect()
        connection.sock.settimeout(value["whole_timeout"])
        connection.request(value["method"], value["path"], body=base64.b64decode(value["body"]),
                           headers=value["headers"])
        response = connection.getresponse()
        payload = response.read(BODY_LIMIT + 1)
        if len(payload) > BODY_LIMIT:
            raise ValueError("invalid_response")
        return {"status": response.status, "body": base64.b64encode(payload).decode("ascii")}
    finally:
        connection.close()


class ExportClient:
    def __init__(self, daemon_url, ingest_key, *, connect_timeout=5, whole_timeout=20):
        if (type(daemon_url) is not str or len(daemon_url) > 2048
                or any(ord(c) <= 32 or ord(c) >= 127 for c in daemon_url)
                or type(ingest_key) is not bytes or not 32 <= len(ingest_key) <= 4096):
            raise ValueError("invalid_configuration")
        parsed = urlsplit(daemon_url)
        if (parsed.scheme not in ("http", "https") or not parsed.hostname
                or parsed.username is not None or parsed.password is not None
                or parsed.query or parsed.fragment or parsed.path not in ("", "/")
                or "%" in parsed.netloc or "\\" in daemon_url):
            raise ValueError("invalid_configuration")
        for timeout in (connect_timeout, whole_timeout):
            if type(timeout) not in (int, float) or not math.isfinite(timeout) or not 0 < timeout <= 20:
                raise ValueError("invalid_configuration")
        if connect_timeout > whole_timeout:
            raise ValueError("invalid_configuration")
        self._url = daemon_url.rstrip("/")
        self._key = bytes(ingest_key)
        self._connect_timeout = connect_timeout
        self._whole_timeout = whole_timeout

    def submit(self, evidence):
        try:
            payload = validate_evidence(evidence)
        except (ValueError, TypeError, KeyError, UnicodeError, OverflowError):
            return {"error": "invalid_request"}
        return self._exchange("POST", "/v1/modeltrace/probes", payload, evidence["probe_id"])

    def get(self, probe_id):
        try:
            _identity(probe_id)
        except (ValueError, TypeError):
            return {"error": "invalid_request"}
        return self._exchange("GET", "/v1/modeltrace/probes/" + probe_id, b"", probe_id)

    def _exchange(self, method, path, payload, probe_id):
        from modeltrace_runtime.workbench import execute_owned, strict_json

        stamp, nonce = str(int(time.time())), secrets.token_hex(16)
        canonical = "\n".join((method, path, stamp, nonce,
                               hashlib.sha256(payload).hexdigest())).encode()
        headers = {
            "Content-Type": "application/json", "X-ModelTrace-Timestamp": stamp,
            "X-ModelTrace-Nonce": nonce,
            "X-ModelTrace-Signature": hmac.new(self._key, canonical, hashlib.sha256).hexdigest(),
        }
        unknown = "write_unknown" if method == "POST" else "unavailable"
        try:
            wire = execute_owned({
                "kind": "export_http", "daemon_url": self._url, "method": method,
                "path": path, "body": base64.b64encode(payload).decode("ascii"),
                "headers": headers, "connect_timeout": self._connect_timeout,
                "whole_timeout": self._whole_timeout,
            }, self._whole_timeout)
            value = strict_json(base64.b64decode(wire["body"], validate=True))
            if wire["status"] != 200:
                if (wire["status"] in (400, 401, 404, 409, 413, 500, 503)
                        and type(value) is dict and set(value) == {"error"}
                        and value["error"] in ("invalid_request", "unauthorized", "not_found",
                                              "conflict", "too_large", "execution_failed",
                                              "internal_error", "unavailable")):
                    return value
                return {"error": unknown}
            return validate_record(value, probe_id)
        except Exception:
            return {"error": unknown}
