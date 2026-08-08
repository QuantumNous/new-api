import base64
import binascii
import os
import re
from dataclasses import dataclass

from .origin_policy import OriginPolicy


_REQUIRED_ENV = {
    "FLATKEY_QA_RUN_ID",
    "FLATKEY_QA_IDENTITY_SEED_B64",
    "FLATKEY_QA_GMAIL_BASE",
    "FLATKEY_QA_WEBSITE_ORIGIN",
    "FLATKEY_QA_CONSOLE_ORIGIN",
    "FLATKEY_QA_DOCS_ORIGIN",
}
_ALLOWED_ORIGINS = {
    "FLATKEY_QA_WEBSITE_ORIGIN": "https://staging-website.flatkey.ai",
    "FLATKEY_QA_CONSOLE_ORIGIN": "https://staging-console.flatkey.ai",
    "FLATKEY_QA_DOCS_ORIGIN": "https://docs.flatkey.ai",
}
_CLEANUP_REQUIRED_ENV = {
    "FLATKEY_QA_RUN_ID",
    "FLATKEY_QA_IDENTITY_SEED_B64",
    "FLATKEY_QA_CONSOLE_ORIGIN",
    "FLATKEY_BROWSER_QA_GCS_BUCKET",
    "FLATKEY_BROWSER_QA_MAIN_EXECUTION_ID",
    "FLATKEY_BROWSER_QA_CLEANUP_EXECUTION_ID",
}
_SAFE_GCS_COMPONENT = re.compile(r"^[A-Za-z0-9._-]{1,128}$")
_GCS_BUCKET = re.compile(r"^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$")


@dataclass(frozen=True, repr=False)
class RuntimeConfig:
    run_id: str
    mode: str
    identity_seed: bytes
    gmail_base: str
    website_origin: str
    console_origin: str
    docs_origin: str
    origin_policy: OriginPolicy

    def __repr__(self):
        return f"RuntimeConfig(run_id={self.run_id!r})"


@dataclass(frozen=True, repr=False)
class CleanupConfig:
    run_id: str
    identity_seed: bytes
    console_origin: str
    gcs_bucket: str
    main_execution_id: str
    cleanup_execution_id: str

    def __repr__(self):
        return f"CleanupConfig(run_id={self.run_id!r})"


def load_config(env=None):
    env = os.environ if env is None else env
    missing = sorted(name for name in _REQUIRED_ENV if not env.get(name))
    if missing:
        raise ValueError(f"missing required environment variables: {', '.join(missing)}")

    extras = sorted(name for name in env if name.startswith("FLATKEY_QA_") and name not in _REQUIRED_ENV)
    if extras:
        raise ValueError(f"unknown FLATKEY_QA_ environment variables: {', '.join(extras)}")

    run_id = _validate_run_id(env["FLATKEY_QA_RUN_ID"])
    mode = _validate_mode(env.get("FLATKEY_BROWSER_QA_MODE", "normal"))

    origins = {name: env[name] for name in _ALLOWED_ORIGINS}
    for name, expected in _ALLOWED_ORIGINS.items():
        if origins[name] != expected:
            raise ValueError(f"{name} must be exactly {expected}")

    seed = _decode_identity_seed(env["FLATKEY_QA_IDENTITY_SEED_B64"])

    policy = OriginPolicy.from_hosts(
        [
            "staging-website.flatkey.ai",
            "staging-console.flatkey.ai",
            "docs.flatkey.ai",
        ]
    )

    return RuntimeConfig(
        run_id=run_id,
        mode=mode,
        identity_seed=seed,
        gmail_base=env["FLATKEY_QA_GMAIL_BASE"],
        website_origin=origins["FLATKEY_QA_WEBSITE_ORIGIN"],
        console_origin=origins["FLATKEY_QA_CONSOLE_ORIGIN"],
        docs_origin=origins["FLATKEY_QA_DOCS_ORIGIN"],
        origin_policy=policy,
    )


def load_cleanup_config(env=None):
    env = os.environ if env is None else env
    missing = sorted(name for name in _CLEANUP_REQUIRED_ENV if not env.get(name))
    if missing:
        raise ValueError(f"missing required environment variables: {', '.join(missing)}")

    extras = sorted(
        name
        for name in env
        if (name.startswith("FLATKEY_QA_") or name.startswith("FLATKEY_BROWSER_QA_")) and name not in _CLEANUP_REQUIRED_ENV
    )
    if extras:
        raise ValueError(f"unknown FLATKEY_QA_ or FLATKEY_BROWSER_QA_ environment variables: {', '.join(extras)}")

    console_origin = env["FLATKEY_QA_CONSOLE_ORIGIN"]
    expected = _ALLOWED_ORIGINS["FLATKEY_QA_CONSOLE_ORIGIN"]
    if console_origin != expected:
        raise ValueError(f"FLATKEY_QA_CONSOLE_ORIGIN must be exactly {expected}")

    return CleanupConfig(
        run_id=_validate_run_id(env["FLATKEY_QA_RUN_ID"]),
        identity_seed=_decode_identity_seed(env["FLATKEY_QA_IDENTITY_SEED_B64"]),
        console_origin=console_origin,
        gcs_bucket=_validate_gcs_bucket(env["FLATKEY_BROWSER_QA_GCS_BUCKET"]),
        main_execution_id=_validate_gcs_component(
            env["FLATKEY_BROWSER_QA_MAIN_EXECUTION_ID"], "FLATKEY_BROWSER_QA_MAIN_EXECUTION_ID"
        ),
        cleanup_execution_id=_validate_gcs_component(
            env["FLATKEY_BROWSER_QA_CLEANUP_EXECUTION_ID"], "FLATKEY_BROWSER_QA_CLEANUP_EXECUTION_ID"
        ),
    )


def _validate_run_id(run_id):
    if not run_id.isascii() or not run_id.isdecimal():
        raise ValueError("FLATKEY_QA_RUN_ID must contain only ASCII decimal digits")
    return run_id


def _validate_mode(mode):
    if mode not in {"normal", "core"}:
        raise ValueError("FLATKEY_BROWSER_QA_MODE must be normal or core")
    return mode


def _decode_identity_seed(value):
    try:
        seed = base64.b64decode(value, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("FLATKEY_QA_IDENTITY_SEED_B64 must be valid base64") from exc
    if len(seed) < 32:
        raise ValueError("identity seed must be at least 32 bytes")
    return seed


def _validate_gcs_bucket(value):
    if not isinstance(value, str) or not 3 <= len(value) <= 63 or not _GCS_BUCKET.fullmatch(value) or ".." in value:
        raise ValueError("FLATKEY_BROWSER_QA_GCS_BUCKET must be a safe GCS bucket name")
    return value


def _validate_gcs_component(value, name):
    if (
        not isinstance(value, str)
        or not _SAFE_GCS_COMPONENT.fullmatch(value)
        or value in {".", ".."}
        or ".." in value
        or "/" in value
        or "\\" in value
    ):
        raise ValueError(f"{name} must be a safe GCS object path component")
    return value
