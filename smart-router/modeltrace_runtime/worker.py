import hashlib
import hmac
import json
import os
import re
import sys

from modeltrace_runtime.bank_validation import validate_bank
from modeltrace_runtime.engine import analyze_samples


_BANK_ENVIRONMENT_KEY = "SMART_ROUTER_MODELTRACE_BANK"
_MAX_BANK_BYTES = 16 * 1024 * 1024
_MAX_STDIN_BYTES = 256 * 1024
_REQUEST_FIELDS = {"schema_version", "bank_revision", "samples"}
_SAMPLE_FIELDS = {"challenge_id", "expected_count", "numbers"}
_REVISION_PATTERN = re.compile(r"[0-9a-f]{64}")
_CHALLENGE_ID_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:-]{0,127}")


def _validate_request_envelope(request: dict) -> None:
    if not isinstance(request, dict):
        raise ValueError("invalid request")
    if set(request) != _REQUEST_FIELDS:
        raise ValueError("invalid request fields")
    if type(request["schema_version"]) is not int or request["schema_version"] != 1:
        raise ValueError("invalid schema_version")
    revision = request["bank_revision"]
    if not isinstance(revision, str) or _REVISION_PATTERN.fullmatch(revision) is None:
        raise ValueError("invalid bank_revision")
    samples = request["samples"]
    if not isinstance(samples, list) or not 1 <= len(samples) <= 3:
        raise ValueError("invalid samples")


def _validate_samples(samples: list[dict]) -> None:
    challenge_ids = set()
    for sample in samples:
        if not isinstance(sample, dict):
            raise ValueError("invalid sample")
        if set(sample) != _SAMPLE_FIELDS:
            raise ValueError("invalid sample fields")

        challenge_id = sample["challenge_id"]
        if (
            not isinstance(challenge_id, str)
            or _CHALLENGE_ID_PATTERN.fullmatch(challenge_id) is None
        ):
            raise ValueError("invalid challenge_id")
        if challenge_id in challenge_ids:
            raise ValueError("duplicate challenge_id")
        challenge_ids.add(challenge_id)

        expected_count = sample["expected_count"]
        if type(expected_count) is not int or not 0 <= expected_count <= 4096:
            raise ValueError("invalid expected_count")

        numbers = sample["numbers"]
        if not isinstance(numbers, list) or len(numbers) > 4096:
            raise ValueError("invalid numbers")
        for number in numbers:
            if type(number) is not int or not 1 <= number <= 355:
                raise ValueError("invalid number")


def _read_bank_snapshot(expected_revision: str) -> tuple[bytes, str]:
    bank_path = os.getenv(_BANK_ENVIRONMENT_KEY)
    if not bank_path:
        raise ValueError("bank configuration is missing")
    if not isinstance(bank_path, str) or not os.path.isabs(bank_path):
        raise ValueError("bank path must be absolute")

    try:
        with open(bank_path, "rb") as stream:
            bank_bytes = stream.read(_MAX_BANK_BYTES + 1)
    except (OSError, TypeError, ValueError):
        raise ValueError("bank file unavailable") from None

    if len(bank_bytes) > _MAX_BANK_BYTES:
        raise ValueError("bank file too large")
    actual_revision = hashlib.sha256(bank_bytes).hexdigest()
    if not hmac.compare_digest(expected_revision, actual_revision):
        raise ValueError("bank revision mismatch")
    return bank_bytes, actual_revision


def _reject_json_constants(_value: str):
    raise ValueError("non-standard JSON constant")


def _reject_duplicate_keys(pairs: list[tuple[str, object]]) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate JSON key")
        result[key] = value
    return result


def _parse_and_validate_bank(bank_bytes: bytes) -> dict:
    try:
        bank_text = bank_bytes.decode("utf-8")
        bank = json.loads(
            bank_text,
            object_pairs_hook=_reject_duplicate_keys,
            parse_constant=_reject_json_constants,
        )
    except (UnicodeDecodeError, ValueError, RecursionError):
        raise ValueError("invalid bank JSON") from None
    if not isinstance(bank, dict):
        raise ValueError("invalid bank JSON object")
    try:
        validate_bank(bank)
    except ValueError:
        raise ValueError("invalid bank") from None
    return bank


def _parse_request_bytes(request_bytes: bytes) -> dict:
    try:
        request_text = request_bytes.decode("utf-8")
        request = json.loads(
            request_text,
            object_pairs_hook=_reject_duplicate_keys,
            parse_constant=_reject_json_constants,
        )
    except (UnicodeDecodeError, ValueError, RecursionError):
        raise ValueError("invalid request JSON") from None
    if not isinstance(request, dict):
        raise ValueError("invalid request JSON object")
    return request


def process(request: dict) -> dict:
    _validate_request_envelope(request)
    _validate_samples(request["samples"])
    bank_bytes, actual_revision = _read_bank_snapshot(
        request["bank_revision"]
    )
    bank = _parse_and_validate_bank(bank_bytes)
    engine_result = analyze_samples(request["samples"], bank)
    return {
        **engine_result,
        "schema_version": 1,
        "bank_revision": actual_revision,
    }


def main() -> int:
    try:
        request_bytes = sys.stdin.buffer.read(_MAX_STDIN_BYTES + 1)
        if len(request_bytes) > _MAX_STDIN_BYTES:
            raise ValueError("request too large")
        request = _parse_request_bytes(request_bytes)
        result = process(request)
        output = json.dumps(
            result,
            allow_nan=False,
            separators=(",", ":"),
        )
    except Exception:
        sys.stderr.write("MODELTRACE_WORKER_ERROR request rejected\n")
        return 1

    sys.stdout.write(f"{output}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
