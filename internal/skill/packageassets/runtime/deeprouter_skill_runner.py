import argparse
import json
import os
from pathlib import Path
import socket
import sys
import urllib.error
import urllib.request
from urllib.parse import urlparse


def fail(code, message, cta=None, exit_code=1):
    payload = {"code": code, "message": message}
    if cta:
        payload["cta"] = cta
    sys.stderr.write(json.dumps(payload) + "\n")
    raise SystemExit(exit_code)


def load_package_root():
    return Path(__file__).resolve().parent.parent


def read_manifest(path):
    try:
        with path.open("r", encoding="utf-8") as f:
            manifest = json.load(f)
    except (OSError, UnicodeDecodeError) as exc:
        detail = getattr(exc, "strerror", None) or str(exc)
        fail("PACKAGE_INVALID", f"manifest.json could not be read: {detail}")
    except json.JSONDecodeError:
        fail("PACKAGE_INVALID", "manifest.json is not valid JSON")

    if not isinstance(manifest, dict):
        fail("PACKAGE_INVALID", "manifest.json root must be a JSON object")
    return manifest


def read_text_file(path):
    try:
        with path.open("r", encoding="utf-8") as f:
            return f.read()
    except (OSError, UnicodeDecodeError) as exc:
        detail = getattr(exc, "strerror", None) or str(exc)
        fail("PACKAGE_INVALID", f"instruction_template.md could not be read: {detail}")


def require_nonempty_env(name, code, message, cta=None):
    value = os.environ.get(name)
    if value is None or value.strip() == "":
        fail(code, message, cta)
    return value.strip()


def read_timeout_seconds():
    raw = os.environ.get("DEEPROUTER_EXECUTION_TIMEOUT_SECONDS", "60").strip()
    try:
        value = float(raw)
    except ValueError:
        fail("CONFIG_INVALID", "DEEPROUTER_EXECUTION_TIMEOUT_SECONDS must be a number.")
    if value <= 0:
        fail("CONFIG_INVALID", "DEEPROUTER_EXECUTION_TIMEOUT_SECONDS must be greater than 0.")
    return value


def validate_api_url(value):
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        fail("CONFIG_INVALID", "DEEPROUTER_EXECUTION_API_URL must be an http(s) URL.")
    return value


def validate_manifest(manifest):
    required = ["skill_id", "skill_version_id", "requires_deeprouter_key"]
    for key in required:
        if key not in manifest:
            fail("PACKAGE_INVALID", f"manifest.json missing required field: {key}")

    forbidden = {
        "user_id",
        "tenant_id",
        "kids_mode",
        "is_kids_session",
        "billing_user_id",
    }
    overlap = forbidden.intersection(set(manifest.keys()))
    if overlap:
        fail("PACKAGE_INVALID", f"manifest.json contains forbidden field(s): {', '.join(sorted(overlap))}")

    if manifest.get("requires_deeprouter_key") is not True:
        fail("PACKAGE_INVALID", "manifest.json must declare requires_deeprouter_key=true")


def execute(api_url, api_key, manifest, user_input):
    timeout_seconds = read_timeout_seconds()
    payload = {
        "messages": [{"role": "user", "content": user_input}],
        "deeprouter": {
            "skill_id": manifest["skill_id"],
            "skill_version_id": manifest["skill_version_id"],
        },
    }

    req = urllib.request.Request(
        api_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout_seconds) as resp:
            body = resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8")
        try:
            parsed = json.loads(body)
        except json.JSONDecodeError:
            fail("EXECUTION_FAILED", f"Execution API returned HTTP {exc.code}")
        error = parsed.get("error")
        if isinstance(error, dict):
            fail(
                error.get("code", "EXECUTION_FAILED"),
                error.get("message", f"Execution API returned HTTP {exc.code}"),
                error.get("cta"),
            )
        fail("EXECUTION_FAILED", f"Execution API returned HTTP {exc.code}")
    except urllib.error.URLError as exc:
        fail("EXECUTION_FAILED", f"Execution API request failed: {exc.reason}")
    except socket.timeout:
        fail("EXECUTION_FAILED", "Execution API request timed out")

    try:
        parsed = json.loads(body)
    except json.JSONDecodeError:
        fail("EXECUTION_FAILED", "Execution API returned invalid JSON")

    # The routing endpoint (/v1/routing/chat/completions) returns the standard
    # OpenAI chat-completion shape. Read the assistant text from
    # choices[0].message.content, falling back to a legacy top-level {"text": ...}
    # body for backward compatibility. (DR-1002)
    text = parsed.get("text")
    if not isinstance(text, str):
        choices = parsed.get("choices")
        if isinstance(choices, list) and choices:
            first = choices[0]
            if isinstance(first, dict):
                message = first.get("message")
                if isinstance(message, dict):
                    content = message.get("content")
                    if isinstance(content, str):
                        text = content
    if not isinstance(text, str):
        fail("EXECUTION_FAILED", "Execution API response missing text")

    sys.stdout.write(text)
    if not text.endswith("\n"):
        sys.stdout.write("\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    args = parser.parse_args()

    package_root = load_package_root()
    manifest_path = package_root / "manifest.json"
    instruction_template_path = package_root / "instruction_template.md"

    if not manifest_path.exists():
        fail("PACKAGE_INVALID", "manifest.json not found in package root")
    if not instruction_template_path.exists():
        fail("PACKAGE_INVALID", "instruction_template.md not found in package root")

    manifest = read_manifest(manifest_path)
    validate_manifest(manifest)

    template_text = read_text_file(instruction_template_path)
    if template_text.strip() == "":
        fail("PACKAGE_INVALID", "instruction_template.md is empty")

    api_key = require_nonempty_env(
        "DEEPROUTER_API_KEY",
        "AUTH_REQUIRED",
        "DeepRouter API key is required.",
        "Register or add your API key.",
    )
    api_url = require_nonempty_env(
        "DEEPROUTER_EXECUTION_API_URL",
        "CONFIG_REQUIRED",
        "DeepRouter execution API URL is required.",
    )
    api_url = validate_api_url(api_url)

    execute(api_url, api_key, manifest, args.input)


if __name__ == "__main__":
    main()
