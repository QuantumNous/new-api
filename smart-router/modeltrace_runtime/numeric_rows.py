from __future__ import annotations

import json
import os
import stat


VALUE_MIN = 1
VALUE_MAX = 355
DIMENSION = VALUE_MAX - VALUE_MIN + 1
MAX_NUMBERS = 4096
MAX_IDENTIFIER_LENGTH = 256
MAX_FILE_BYTES = 16 * 1024 * 1024
MAX_LINE_BYTES = 256 * 1024
MAX_ROWS = 8192

_IDENTIFIER_FIELDS = (
    "row_id",
    "source",
    "family_id",
    "family_name",
    "condition_id",
    "nuisance_condition_id",
    "challenge_id",
    "time",
)


def _invalid(detail: str) -> None:
    raise ValueError(f"invalid numeric row: {detail}")


def _validate_identifier(row: dict, field: str, *, required: bool) -> None:
    if field not in row:
        if required:
            _invalid(f"{field} is required")
        return
    value = row[field]
    lowered = value.casefold() if type(value) is str else ""
    if (
        type(value) is not str
        or not value.strip()
        or len(value) > MAX_IDENTIFIER_LENGTH
        or any(ord(character) < 32 or ord(character) == 127 for character in value)
        or "://" in lowered
        or lowered.startswith("authorization:")
        or lowered.startswith("bearer ")
    ):
        _invalid(
            f"{field} must be a non-empty safe string of at most "
            f"{MAX_IDENTIFIER_LENGTH} characters"
        )


def normalize_row(row: dict) -> dict:
    if type(row) is not dict:
        _invalid("row must be a dict")
    for field in ("row_id", "source", "condition_id", "challenge_id"):
        _validate_identifier(row, field, required=True)
    for field in (
        "family_id",
        "family_name",
        "nuisance_condition_id",
        "time",
    ):
        _validate_identifier(row, field, required=False)
    if ("family_id" in row) != ("family_name" in row):
        _invalid("family_id and family_name must be provided together")

    if "expected_count" not in row:
        _invalid("expected_count is required")
    expected_count = row["expected_count"]
    if type(expected_count) is not int or not 0 <= expected_count <= MAX_NUMBERS:
        _invalid(f"expected_count must be an integer from 0 to {MAX_NUMBERS}")
    numbers = row.get("numbers")
    if type(numbers) is not list:
        _invalid("numbers must be a list")
    if len(numbers) > MAX_NUMBERS:
        _invalid(f"numbers must contain at most {MAX_NUMBERS} items")
    for index, number in enumerate(numbers):
        if type(number) is not int or not VALUE_MIN <= number <= VALUE_MAX:
            _invalid(
                f"numbers[{index}] must be an integer from "
                f"{VALUE_MIN} to {VALUE_MAX}"
            )
    numbers = list(numbers)
    counts = [0] * DIMENSION
    for number in numbers:
        counts[number - VALUE_MIN] += 1
    minimum = max(80, (expected_count * 55 + 99) // 100)
    normalized = {
        key: row[key]
        for key in _IDENTIFIER_FIELDS
        if key in row
    }
    normalized.update(
        {
            "expected_count": expected_count,
            "numbers": numbers,
            "counts": counts,
            "strict_valid": len(numbers) >= minimum,
        }
    )
    return normalized


def _reject_json_constant(value: str):
    raise ValueError(f"non-finite JSON constant {value!r} is not allowed")


def _parse_numeric_rows(payload: bytes) -> list[dict]:
    if type(payload) is not bytes:
        _invalid("rows payload must be bytes")
    if len(payload) > MAX_FILE_BYTES:
        _invalid(f"rows file must not exceed {MAX_FILE_BYTES} bytes")
    lines = payload.splitlines()
    if len(lines) > MAX_ROWS:
        _invalid(f"rows file must contain at most {MAX_ROWS} rows")
    output = []
    for index, encoded in enumerate(lines, start=1):
        if not encoded:
            _invalid(f"line {index} must not be blank")
        if len(encoded) > MAX_LINE_BYTES:
            _invalid(f"line {index} must not exceed {MAX_LINE_BYTES} bytes")
        try:
            line = encoded.decode("utf-8", errors="strict")
            row = json.loads(line, parse_constant=_reject_json_constant)
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
            raise ValueError(f"invalid numeric rows JSON on line {index}") from error
        if type(row) is not dict:
            _invalid(f"line {index} must contain a JSON object")
        output.append(normalize_row(row))
    return output


def read_numeric_rows(path) -> list[dict]:
    flags = os.O_RDONLY | os.O_NONBLOCK | getattr(os, "O_CLOEXEC", 0)
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    try:
        descriptor = os.open(os.fspath(path), flags)
    except (OSError, TypeError, ValueError) as error:
        raise ValueError("invalid numeric rows file") from error
    try:
        before = os.fstat(descriptor)
        if not stat.S_ISREG(before.st_mode):
            _invalid("rows path must be a regular file")
        if before.st_size > MAX_FILE_BYTES:
            _invalid(f"rows file must not exceed {MAX_FILE_BYTES} bytes")
        chunks = []
        remaining = before.st_size + 1
        while remaining:
            chunk = os.read(descriptor, min(remaining, 64 * 1024))
            if not chunk:
                break
            chunks.append(chunk)
            remaining -= len(chunk)
        payload = b"".join(chunks)
        after = os.fstat(descriptor)
    except OSError as error:
        raise ValueError("could not read numeric rows snapshot") from error
    finally:
        os.close(descriptor)

    snapshot = (
        before.st_dev,
        before.st_ino,
        before.st_size,
        before.st_mtime_ns,
        before.st_ctime_ns,
    )
    current = (
        after.st_dev,
        after.st_ino,
        after.st_size,
        after.st_mtime_ns,
        after.st_ctime_ns,
    )
    if snapshot != current or len(payload) != before.st_size:
        _invalid("rows file changed while being read")
    return _parse_numeric_rows(payload)
