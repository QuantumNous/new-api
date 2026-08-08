import os
import re
import urllib.parse

from .report import SEVERITIES


class FixedCaseValidationError(ValueError):
    pass


MAX_CASE_BYTES = 64 * 1024
SCHEMA_VERSION = 1
TOP_FIELDS = {
    "schema_version",
    "id",
    "kind",
    "name",
    "enabled",
    "severity",
    "owner",
    "fixture",
    "start",
    "steps",
    "assertions",
    "evidence",
    "cleanup",
    "source",
    "promotion",
}
KINDS = {"bug_regression", "coverage_baseline"}
FIXTURES = {"anonymous", "registered_user", "user_with_api_key"}
START_ORIGINS = {"staging_website", "staging_console", "docs"}
CLEANUP = {"required", "not_required"}
PROMOTION_STATES = {
    "candidate_draft",
    "reproduced_3_of_3",
    "awaiting_product_fix",
    "fixed_behavior_passed_3_of_3",
    "passed_3_of_3",
    "ready_for_review",
}
EVIDENCE_FIELDS = {"screenshot_on_failure", "capture_console", "capture_network"}
SOURCE_FIELDS = {"run_id", "finding_fingerprint", "evidence_uri"}
PROMOTION_FIELDS = {"state", "attempts_required", "attempts_passed"}
START_FIELDS = {"origin", "path"}
STEP_ACTIONS = {"navigate", "navigate_back", "click", "fill", "select", "wait_for"}
ASSERTIONS = {"page_status_not", "url_not_contains"}
ID_RE = re.compile(r"^FQA-[0-9]{4,}$")
TEXT_RE = re.compile(r"^[^\x00-\x1f\x7f]{1,256}$")
CASE_FILENAME_RE = re.compile(r"^FQA-[0-9]{4,}.*\.yaml$")


def load_case(path):
    try:
        size = os.path.getsize(path)
    except OSError as exc:
        raise FixedCaseValidationError("case file cannot be read") from exc
    if size > MAX_CASE_BYTES:
        raise FixedCaseValidationError("case file is too large")
    try:
        with open(path, encoding="utf-8") as handle:
            text = handle.read(MAX_CASE_BYTES + 1)
    except OSError as exc:
        raise FixedCaseValidationError("case file cannot be read") from exc
    except UnicodeDecodeError as exc:
        raise FixedCaseValidationError("case file must be utf-8") from exc
    if len(text.encode("utf-8")) > MAX_CASE_BYTES:
        raise FixedCaseValidationError("case file is too large")
    case = _parse_yaml_subset(text)
    return validate_case(case)


def list_cases(directory):
    cases = []
    for entry in sorted(os.scandir(directory), key=lambda item: item.name):
        if entry.is_file(follow_symlinks=False) and CASE_FILENAME_RE.fullmatch(entry.name):
            cases.append(load_case(entry.path))
    return cases


def enabled_cases(directory):
    return [case for case in list_cases(directory) if case["enabled"]]


def validate_case(case):
    _require_object(case, TOP_FIELDS, "case")
    _exact_int(case["schema_version"], SCHEMA_VERSION, "schema_version")
    _string_match(case["id"], ID_RE, "id")
    _enum(case["kind"], KINDS, "kind")
    _boolean(case["enabled"], "enabled")
    _enum(case["severity"], SEVERITIES, "severity")
    _string(case["name"], "name")
    _literal(case["owner"], "browser-qa", "owner")
    _enum(case["fixture"], FIXTURES, "fixture")
    _enum(case["cleanup"], CLEANUP, "cleanup")
    _validate_start(case["start"])
    _validate_steps(case["steps"])
    _validate_assertions(case["assertions"])
    _validate_evidence(case["evidence"])
    _validate_source(case["source"])
    _validate_promotion(case["promotion"], case["enabled"])
    return case


def _validate_start(start):
    _require_object(start, START_FIELDS, "start")
    _enum(start["origin"], START_ORIGINS, "start.origin")
    _relative_path(start["path"], "start.path")


def _validate_steps(steps):
    if not isinstance(steps, list) or not steps:
        raise FixedCaseValidationError("steps must be a non-empty array")
    for index, step in enumerate(steps):
        _require_single_key_object(step, STEP_ACTIONS, f"steps[{index}]")
        action, payload = next(iter(step.items()))
        if action == "navigate_back":
            if payload != {}:
                raise FixedCaseValidationError(f"steps[{index}].navigate_back must be empty")
            continue
        if not isinstance(payload, dict):
            raise FixedCaseValidationError(f"steps[{index}].{action} must be an object")
        if action == "navigate":
            _require_object(payload, {"path"}, f"steps[{index}].navigate")
            _relative_path(payload["path"], f"steps[{index}].navigate.path")
        elif action == "click":
            _require_object(payload, {"locator"}, f"steps[{index}].click")
            _validate_locator(payload["locator"], f"steps[{index}].click.locator")
        elif action == "fill":
            _require_object(payload, {"locator", "value"}, f"steps[{index}].fill")
            _validate_locator(payload["locator"], f"steps[{index}].fill.locator")
            _string(payload["value"], f"steps[{index}].fill.value")
        elif action == "select":
            _require_object(payload, {"locator", "value"}, f"steps[{index}].select")
            _validate_locator(payload["locator"], f"steps[{index}].select.locator")
            _string(payload["value"], f"steps[{index}].select.value")
        elif action == "wait_for":
            _require_object(payload, {"locator"}, f"steps[{index}].wait_for")
            _validate_locator(payload["locator"], f"steps[{index}].wait_for.locator")


def _validate_locator(locator, path):
    if not isinstance(locator, dict):
        raise FixedCaseValidationError(f"{path} must be an object")
    by = locator.get("by")
    if by == "role":
        _require_object(locator, {"by", "role", "name"}, path)
        _string(locator["role"], f"{path}.role")
        _string(locator["name"], f"{path}.name")
    elif by == "label":
        _require_object(locator, {"by", "label"}, path)
        _string(locator["label"], f"{path}.label")
    elif by == "text":
        _require_object(locator, {"by", "text"}, path)
        _string(locator["text"], f"{path}.text")
    elif by == "test_id":
        _require_object(locator, {"by", "test_id"}, path)
        _string(locator["test_id"], f"{path}.test_id")
    else:
        raise FixedCaseValidationError(f"{path}.by has invalid value")


def _validate_assertions(assertions):
    if not isinstance(assertions, list) or not assertions:
        raise FixedCaseValidationError("assertions must be a non-empty array")
    for index, assertion in enumerate(assertions):
        _require_single_key_object(assertion, ASSERTIONS, f"assertions[{index}]")
        key, value = next(iter(assertion.items()))
        if key == "page_status_not":
            _integer(value, f"assertions[{index}].page_status_not", minimum=100, maximum=599)
        elif key == "url_not_contains":
            _string(value, f"assertions[{index}].url_not_contains")


def _validate_evidence(evidence):
    _require_object(evidence, EVIDENCE_FIELDS, "evidence")
    for key in EVIDENCE_FIELDS:
        _boolean(evidence[key], f"evidence.{key}")


def _validate_source(source):
    _require_object(source, SOURCE_FIELDS, "source")
    for key in ("run_id", "finding_fingerprint"):
        _string(source[key], f"source.{key}")
    uri = source["evidence_uri"]
    _string(uri, "source.evidence_uri")
    parsed = urllib.parse.urlsplit(uri)
    if parsed.scheme != "gs" or not parsed.netloc or parsed.query or parsed.fragment or "@" in uri:
        raise FixedCaseValidationError("source.evidence_uri must be private gs evidence")


def _validate_promotion(promotion, enabled):
    _require_object(promotion, PROMOTION_FIELDS, "promotion")
    _enum(promotion["state"], PROMOTION_STATES, "promotion.state")
    _exact_int(promotion["attempts_required"], 3, "promotion.attempts_required")
    _integer(promotion["attempts_passed"], "promotion.attempts_passed", minimum=0, maximum=3)
    qualified = promotion["state"] == "ready_for_review" and promotion["attempts_passed"] == 3
    if enabled and not qualified:
        raise FixedCaseValidationError("enabled cases must be ready_for_review with 3 passing attempts")


def _parse_yaml_subset(text):
    if "\t" in text:
        raise FixedCaseValidationError("tab indentation is not allowed")
    lines = []
    for number, raw in enumerate(text.splitlines(), start=1):
        stripped = raw.strip()
        if not stripped:
            continue
        if stripped in {"---", "..."} or stripped.startswith("--- ") or stripped.startswith("... "):
            raise FixedCaseValidationError("multi-document yaml is not allowed")
        if stripped.startswith("#"):
            continue
        if stripped.startswith(("!", "&", "*")) or re.search(r"(^|\s)[&*!][A-Za-z0-9_-]+", stripped):
            raise FixedCaseValidationError("yaml anchors aliases and tags are not allowed")
        indent = len(raw) - len(raw.lstrip(" "))
        if indent % 2:
            raise FixedCaseValidationError(f"invalid indentation at line {number}")
        lines.append((indent, stripped, number))
    if not lines:
        raise FixedCaseValidationError("case file is empty")
    if lines[0][0] != 0:
        raise FixedCaseValidationError("root indentation is not allowed")
    value, index = _parse_block(lines, 0, lines[0][0])
    if index != len(lines):
        raise FixedCaseValidationError("unrecognized yaml structure")
    return value


def _parse_block(lines, index, indent):
    if lines[index][0] != indent:
        raise FixedCaseValidationError("invalid yaml indentation")
    if lines[index][1].startswith("- "):
        return _parse_list(lines, index, indent)
    return _parse_map(lines, index, indent)


def _parse_map(lines, index, indent):
    result = {}
    while index < len(lines):
        current_indent, stripped, number = lines[index]
        if current_indent < indent:
            break
        if current_indent > indent or stripped.startswith("- "):
            raise FixedCaseValidationError(f"invalid mapping structure at line {number}")
        key, value_text = _split_key_value(stripped, number)
        if key in result:
            raise FixedCaseValidationError(f"duplicate key at line {number}")
        if key == "<<":
            raise FixedCaseValidationError("merge keys are not allowed")
        if value_text == "":
            if index + 1 >= len(lines) or lines[index + 1][0] <= indent:
                result[key] = {}
                index += 1
            else:
                if lines[index + 1][0] != indent + 2:
                    raise FixedCaseValidationError(f"invalid indentation at line {lines[index + 1][2]}")
                result[key], index = _parse_block(lines, index + 1, lines[index + 1][0])
        else:
            result[key] = _parse_scalar(value_text, number)
            index += 1
    return result, index


def _parse_list(lines, index, indent):
    result = []
    while index < len(lines):
        current_indent, stripped, number = lines[index]
        if current_indent < indent:
            break
        if current_indent > indent or not stripped.startswith("- "):
            raise FixedCaseValidationError(f"invalid list structure at line {number}")
        body = stripped[2:].strip()
        if not body:
            raise FixedCaseValidationError(f"empty list item at line {number}")
        key, value_text = _split_key_value(body, number)
        if value_text == "":
            if index + 1 >= len(lines) or lines[index + 1][0] <= indent:
                value = {}
                index += 1
            else:
                if lines[index + 1][0] != indent + 4:
                    raise FixedCaseValidationError(f"invalid indentation at line {lines[index + 1][2]}")
                value, index = _parse_block(lines, index + 1, lines[index + 1][0])
        else:
            value = _parse_scalar(value_text, number)
            index += 1
        result.append({key: value})
    return result, index


def _split_key_value(text, number):
    if ":" not in text:
        raise FixedCaseValidationError(f"missing key separator at line {number}")
    key, value = text.split(":", 1)
    key = key.strip()
    value = value.strip()
    if not key or " " in key:
        raise FixedCaseValidationError(f"invalid key at line {number}")
    if value.startswith(("!", "|", ">", "{", "[")):
        raise FixedCaseValidationError(f"unsupported yaml value at line {number}")
    return key, value


def _parse_scalar(value, number):
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        inner = value[1:-1]
        if not TEXT_RE.fullmatch(inner):
            raise FixedCaseValidationError(f"invalid quoted scalar at line {number}")
        return inner
    if value in {"true", "false"}:
        return value == "true"
    if re.fullmatch(r"[0-9]+", value):
        return int(value)
    if not TEXT_RE.fullmatch(value):
        raise FixedCaseValidationError(f"invalid scalar at line {number}")
    if value.startswith(("'", '"')) or value.endswith(("'", '"')):
        raise FixedCaseValidationError(f"unterminated quoted scalar at line {number}")
    return value


def _require_object(value, required, path):
    if not isinstance(value, dict):
        raise FixedCaseValidationError(f"{path} must be an object")
    keys = set(value)
    missing = required - keys
    extra = keys - required
    if missing:
        raise FixedCaseValidationError(f"{path} missing required fields: {', '.join(sorted(missing))}")
    if extra:
        raise FixedCaseValidationError(f"{path} contains unsupported fields")


def _require_single_key_object(value, allowed, path):
    if not isinstance(value, dict) or len(value) != 1:
        raise FixedCaseValidationError(f"{path} must contain one action")
    key = next(iter(value))
    if key not in allowed:
        raise FixedCaseValidationError(f"{path} has invalid key")


def _enum(value, allowed, path):
    if not isinstance(value, str) or value not in allowed:
        raise FixedCaseValidationError(f"{path} has invalid value")


def _literal(value, expected, path):
    if value != expected:
        raise FixedCaseValidationError(f"{path} has invalid value")


def _string(value, path):
    if not isinstance(value, str) or not TEXT_RE.fullmatch(value):
        raise FixedCaseValidationError(f"{path} must be a non-empty bounded string")


def _string_match(value, pattern, path):
    _string(value, path)
    if not pattern.fullmatch(value):
        raise FixedCaseValidationError(f"{path} has invalid format")


def _boolean(value, path):
    if not isinstance(value, bool):
        raise FixedCaseValidationError(f"{path} must be boolean")


def _exact_int(value, expected, path):
    if not isinstance(value, int) or isinstance(value, bool) or value != expected:
        raise FixedCaseValidationError(f"{path} must be {expected}")


def _integer(value, path, *, minimum, maximum):
    if not isinstance(value, int) or isinstance(value, bool) or value < minimum or value > maximum:
        raise FixedCaseValidationError(f"{path} must be an integer from {minimum} to {maximum}")


def _relative_path(value, path):
    _string(value, path)
    parsed = urllib.parse.urlsplit(value)
    if (
        not value.startswith("/")
        or value.startswith("//")
        or parsed.scheme
        or parsed.netloc
        or parsed.username
        or parsed.password
        or "\\" in value
        or "?" in value
        or "#" in value
    ):
        raise FixedCaseValidationError(f"{path} must be a relative staging path")
