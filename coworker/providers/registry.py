"""Model-provider registry — descriptors + a factory, mirroring the connector
(`connectors/descriptors.py`) and web-search (`web/providers.py`) patterns.

A `ProviderDescriptor` declares a provider's UI config `fields` (rendered dynamically by the
GUI, same `to_dict()` shape connectors use) and a `build(profile, secrets)` factory that returns
a `ProviderClient`. The `ProviderRouter` selects a descriptor by the `provider:` prefix of a
model string and builds (and caches) its client from the matching SecretStore profile.

Today: `openai` (the default, with an optional custom endpoint that covers Azure OpenAI's
`/openai/v1` and any OpenAI-compliant gateway), `anthropic` (native Messages API via
`AnthropicProvider`), `gemini` (native Google GenAI API via `GeminiProvider`), `bedrock`
(models in the user's own AWS account — Claude natively, everything else via Converse),
`vertex` (the user's own GCP project — Gemini and Claude natively, open-weight via the
MaaS endpoint), and `ollama` (local, OpenAI-compatible `/v1`).
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from .anthropic_provider import AnthropicProvider
from .base import ProviderClient
from .bedrock_provider import BedrockProvider
from .gemini_provider import GeminiProvider
from .openai_provider import OpenAIProvider
from .vertex_provider import VertexProvider

DEFAULT_OLLAMA_URL = "http://localhost:11434"


@dataclass(frozen=True)
class ProviderField:
    """One config input for a provider, rendered by the GUI (mirrors connectors' `Field`)."""

    key: str
    label: str
    secret: bool = False
    required: bool = True
    help: str = ""
    placeholder: str = ""
    # Pre-filled (still editable) form value — e.g. an OpenAI-compatible vendor's official
    # endpoint, so the user only has to paste a key. Distinct from `placeholder` (grey hint).
    default: str = ""
    # Non-empty → the field renders as a segmented choice control instead of a text input;
    # each option is {"value", "label"} plus optional UI extras: "tag" (a tiny badge like
    # "Easiest"), "desc" (one-liner atop the method's panel), and "command" (a copyable
    # terminal command shown in the panel, e.g. the gcloud ADC login). The chosen value is
    # stored like any other field value.
    choices: tuple = ()
    # {"other_field_key": "value"} → the field only renders while that other field holds
    # that value. Drives auth-method switching (Bedrock) without a per-provider form.
    show_when: Optional[dict] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "label": self.label,
            "secret": self.secret,
            "required": self.required,
            "help": self.help,
            "placeholder": self.placeholder,
            "default": self.default,
            "choices": [dict(c) for c in self.choices],
            "show_when": self.show_when,
        }


@dataclass(frozen=True)
class ProviderDescriptor:
    """A model provider: its UI fields + a factory that builds its `ProviderClient`."""

    name: str
    title: str
    needs_key: bool
    fields: list[ProviderField]
    build: Callable[[dict[str, Any], Any], ProviderClient] = field(repr=False)
    recommended_model: Optional[str] = (
        None  # pre-filled in the UI; auto-added on configure
    )
    env_key: Optional[str] = (
        None  # env var that can supply the API key (e.g. ANTHROPIC_API_KEY)
    )
    # One-line note under the provider title (e.g. "Connects through X's OpenAI-compatible API").
    blurb: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "title": self.title,
            "needs_key": self.needs_key,
            "fields": [f.to_dict() for f in self.fields],
            "recommended_model": self.recommended_model,
            "blurb": self.blurb,
        }


def _normalize_ollama_url(url: Optional[str]) -> str:
    """Accept `http://host:11434` or `.../v1` and return an OpenAI-compatible base URL.

    Ollama serves its OpenAI-compatible API under `/v1`; the native API lives at the root, so we
    always target `<root>/v1`.
    """
    base = (url or DEFAULT_OLLAMA_URL).strip().rstrip("/")
    if not base:
        base = DEFAULT_OLLAMA_URL
    if not base.endswith("/v1"):
        base = base + "/v1"
    return base


def _build_openai(profile: dict[str, Any], secrets: Any) -> ProviderClient:
    # Key resolution stays in OpenAIProvider/resolve_api_key (explicit → env → SecretStore),
    # so we just hand it the SecretStore. An optional custom endpoint (Azure OpenAI /openai/v1,
    # OpenRouter, vLLM, …) comes from the stored profile.
    base_url = ((profile or {}).get("base_url") or "").strip() or None
    return OpenAIProvider(secrets=secrets, base_url=base_url)


def _build_anthropic(profile: dict[str, Any], secrets: Any) -> ProviderClient:
    # Key resolution stays in AnthropicProvider/resolve_api_key (explicit → env → SecretStore),
    # deferred to first call so the provider can be built before a key exists.
    # thinking_budget: hidden profile override — absent/invalid → the default (ON),
    # explicit 0 → off (see DEFAULT_THINKING_BUDGET).
    from .anthropic_provider import DEFAULT_THINKING_BUDGET

    api_key = ((profile or {}).get("api_key") or "").strip() or None
    try:
        thinking_budget = int(str((profile or {}).get("thinking_budget") or "").strip())
    except ValueError:
        thinking_budget = DEFAULT_THINKING_BUDGET
    return AnthropicProvider(
        api_key=api_key, secrets=secrets, thinking_budget=thinking_budget
    )


def _build_gemini(profile: dict[str, Any], secrets: Any) -> ProviderClient:
    # Same deferred-key contract as anthropic (GeminiProvider/resolve_api_key).
    api_key = ((profile or {}).get("api_key") or "").strip() or None
    return GeminiProvider(api_key=api_key, secrets=secrets)


def _build_bedrock(profile: dict[str, Any], secrets: Any) -> ProviderClient:
    # Credentials resolve inside boto3/AnthropicBedrock at call time: explicit keys →
    # named profile → ambient chain (env / ~/.aws default / instance role).
    p = profile or {}

    def get(key: str) -> Optional[str]:
        return (p.get(key) or "").strip() or None

    return BedrockProvider(
        region=get("region"),
        auth_method=get("auth_method"),
        bedrock_api_key=get("bedrock_api_key"),
        profile_name=get("aws_profile"),
        access_key_id=get("aws_access_key_id"),
        secret_access_key=get("aws_secret_access_key"),
        session_token=get("aws_session_token"),
    )


def _build_vertex(profile: dict[str, Any], secrets: Any) -> ProviderClient:
    p = profile or {}

    def get(key: str) -> Optional[str]:
        return (p.get(key) or "").strip() or None

    return VertexProvider(
        project=get("project"),
        location=get("location"),
        auth_method=get("auth_method"),
        service_account_json=get("service_account_json"),
        api_key=get("vertex_api_key"),
    )


def _build_ollama(profile: dict[str, Any], secrets: Any) -> ProviderClient:
    # Ollama's OpenAI-compatible endpoint ignores the key but the SDK requires a non-empty
    # string, so we pass a placeholder. `base_url` comes from the stored profile (or the default).
    base_url = _normalize_ollama_url((profile or {}).get("base_url"))
    return OpenAIProvider(api_key="ollama", base_url=base_url)


def _openai_compat(vendor: str, default_base_url: str, env_key: Optional[str] = None):
    """Builder factory for vendors reached through their OpenAI-compatible API (Z AI, DeepSeek,
    Kimi, MiniMax, Qwen, xAI, Mistral). The key is resolved from the vendor's OWN profile (or its
    env var) — deliberately NOT from the OpenAI env/SecretStore fallback, so a configured OpenAI
    key is never silently sent to a different vendor's endpoint. Missing key ⇒ fail fast with a
    vendor-named error (these are only built on demand, when one of their models is selected).
    """

    def build(profile: dict[str, Any], secrets: Any) -> ProviderClient:
        base_url = ((profile or {}).get("base_url") or "").strip() or default_base_url
        api_key = ((profile or {}).get("api_key") or "").strip() or (
            os.environ.get(env_key, "").strip() if env_key else ""
        )
        if not api_key:
            raise RuntimeError(
                f"No {vendor} API key configured — add it in Settings ▸ Models."
            )
        return OpenAIProvider(api_key=api_key, base_url=base_url)

    return build


def _compat(
    name: str,
    title: str,
    *,
    base_url: str,
    recommended_model: str,
    env_key: str,
    endpoint_help: str = "",
) -> ProviderDescriptor:
    """Descriptor for an OpenAI-compatible vendor: key + a prefilled, editable endpoint."""
    vendor = title.split(" (")[0]
    return ProviderDescriptor(
        name=name,
        title=title,
        needs_key=True,
        fields=[
            ProviderField(
                "api_key",
                f"{vendor} API key",
                secret=True,
            ),
            ProviderField(
                "base_url",
                "Endpoint",
                required=False,
                default=base_url,
                placeholder=base_url,
                help=endpoint_help
                or f"Prefilled with {vendor}'s official endpoint; edit only for a regional or proxy variant.",
            ),
        ],
        build=_openai_compat(vendor, base_url, env_key),
        recommended_model=recommended_model,
        env_key=env_key,
        blurb=f"Uses {vendor}'s OpenAI-compatible API — the endpoint is prefilled, just add your key.",
    )


DESCRIPTORS: list[ProviderDescriptor] = [
    ProviderDescriptor(
        name="openai",
        title="OpenAI",
        needs_key=True,
        fields=[
            ProviderField(
                "api_key",
                "OpenAI API key",
                secret=True,
                placeholder="sk-…",
            ),
            ProviderField(
                "base_url",
                "Custom endpoint (optional)",
                secret=False,
                required=False,
                placeholder="https://…/openai/v1",
                help="For Azure OpenAI, vLLM, or any OpenAI-compliant server. Leave blank for api.openai.com.",
            ),
        ],
        build=_build_openai,
        recommended_model="gpt-5.6-sol",
        env_key="OPENAI_API_KEY",
    ),
    ProviderDescriptor(
        name="anthropic",
        title="Claude (Anthropic)",
        needs_key=True,
        fields=[
            ProviderField(
                "api_key",
                "Anthropic API key",
                secret=True,
                placeholder="sk-ant-…",
            ),
            # No thinking_budget field (owner call 2026-07-23): extended thinking is
            # on by default; the profile key stays a hidden override (0 = off).
        ],
        build=_build_anthropic,
        recommended_model="claude-fable-5",
        env_key="ANTHROPIC_API_KEY",
    ),
    ProviderDescriptor(
        name="gemini",
        title="Gemini (Google)",
        needs_key=True,
        fields=[
            ProviderField(
                "api_key",
                "Gemini API key",
                secret=True,
                placeholder="AIza…",
            ),
        ],
        build=_build_gemini,
        recommended_model="gemini-3.6-flash",
        env_key="GEMINI_API_KEY",
    ),
    ProviderDescriptor(
        name="bedrock",
        title="AWS Bedrock",
        needs_key=True,
        fields=[
            ProviderField(
                "region",
                "AWS region",
                secret=False,
                placeholder="us-east-1",
                help="The region your Bedrock model access is enabled in.",
            ),
            # One auth method at a time (owner call 2026-07-26): AWS users are advanced —
            # a direct choice beats a pile of "(optional)" fields with hidden precedence.
            ProviderField(
                "auth_method",
                "Connect with",
                secret=False,
                required=False,  # the default stands in; builder tolerates absence
                default="api_key",
                choices=(
                    {
                        "value": "api_key",
                        "label": "Bedrock API key",
                        "tag": "Easiest",
                        "desc": "A single key generated on the Bedrock console — no AWS CLI or IAM setup needed.",
                    },
                    {
                        "value": "profile",
                        "label": "AWS profile",
                        "desc": "Uses a named profile from ~/.aws — works with `aws configure` and `aws sso login`.",
                    },
                    {
                        "value": "iam",
                        "label": "IAM keys",
                        "desc": "An IAM access key pair. For temporary STS credentials, include the session token.",
                    },
                ),
            ),
            ProviderField(
                "bedrock_api_key",
                "Bedrock API key",
                secret=True,
                required=False,
                placeholder="ABSK…",
                show_when={"auth_method": "api_key"},
            ),
            ProviderField(
                "aws_profile",
                "AWS profile",
                secret=False,
                required=False,
                placeholder="default",
                show_when={"auth_method": "profile"},
                help="Leave blank to use your default AWS credentials (env vars or ~/.aws).",
            ),
            ProviderField(
                "aws_access_key_id",
                "Access key ID",
                secret=False,
                required=False,
                placeholder="AKIA…",
                show_when={"auth_method": "iam"},
            ),
            ProviderField(
                "aws_secret_access_key",
                "Secret access key",
                secret=True,
                required=False,
                show_when={"auth_method": "iam"},
            ),
            ProviderField(
                "aws_session_token",
                "Session token (STS only, optional)",
                secret=True,
                required=False,
                show_when={"auth_method": "iam"},
            ),
        ],
        build=_build_bedrock,
        recommended_model="claude/anthropic.claude-sonnet-4-6-v1:0",
        blurb="Runs models inside your own AWS account. Claude uses Anthropic's native "
        "Bedrock path; every other model goes through the Converse API.",
    ),
    ProviderDescriptor(
        name="vertex",
        title="Vertex AI (Google Cloud)",
        needs_key=True,
        fields=[
            ProviderField(
                "project",
                "GCP project ID",
                secret=False,
                placeholder="my-project-123",
            ),
            ProviderField(
                "location",
                "Location",
                secret=False,
                placeholder="global",
                help="Use `global` for the newest Gemini and Claude models. Some models "
                "are regional — Model Garden lists each (Claude also: us-east5 / "
                "europe-west1; Qwen3 Coder: us-south1).",
            ),
            ProviderField(
                "auth_method",
                "Connect with",
                secret=False,
                required=False,  # the default stands in; builder tolerates absence
                default="adc",
                choices=(
                    {
                        "value": "adc",
                        "label": "Google Cloud login",
                        "tag": "Recommended",
                        "desc": "Uses your machine's Google Cloud identity (Application "
                        "Default Credentials). Nothing to paste — sign in once in a terminal:",
                        "command": "gcloud auth application-default login",
                    },
                    {
                        "value": "service_account",
                        "label": "Service account",
                        "desc": "A service-account key — the usual path on shared or headless machines.",
                    },
                    {
                        "value": "api_key",
                        "label": "API key",
                        "desc": "A long-lived key from the Google Cloud console's API Keys page. "
                        "Reaches Gemini models only — Claude and open-weight need Google "
                        "Cloud login or a service account.",
                    },
                ),
            ),
            ProviderField(
                "service_account_json",
                "Service-account JSON",
                secret=True,
                required=False,
                show_when={"auth_method": "service_account"},
                help="Paste the JSON key, or a path to the file.",
            ),
            ProviderField(
                "vertex_api_key",
                "Vertex API key",
                secret=True,
                required=False,
                placeholder="AQ.…",
                show_when={"auth_method": "api_key"},
            ),
        ],
        build=_build_vertex,
        recommended_model="gemini/gemini-3.6-flash",
        blurb="Runs models inside your own Google Cloud project. Gemini and Claude use "
        "their native APIs; open-weight models go through the Vertex MaaS endpoint.",
    ),
    # OpenAI-compatible vendors, listed as first-class providers so users don't need to know the
    # "point the OpenAI slot at a different endpoint" trick (owner call, 2026-07-04). Each keeps
    # its own key profile; the endpoint is prefilled and editable (regional variants in `help`).
    _compat(
        "zai",
        "Z AI (GLM)",
        base_url="https://api.z.ai/api/paas/v4",
        recommended_model="glm-5.2",
        env_key="ZAI_API_KEY",
        endpoint_help="Prefilled with Z AI's international endpoint. China mainland: https://open.bigmodel.cn/api/paas/v4",
    ),
    _compat(
        "deepseek",
        "DeepSeek",
        base_url="https://api.deepseek.com",
        recommended_model="deepseek-v4-flash",
        env_key="DEEPSEEK_API_KEY",
    ),
    _compat(
        "kimi",
        "Kimi (Moonshot AI)",
        base_url="https://api.moonshot.ai/v1",
        recommended_model="kimi-k2.6",
        env_key="MOONSHOT_API_KEY",
        endpoint_help="Prefilled with Moonshot's international endpoint. China mainland: https://api.moonshot.cn/v1",
    ),
    _compat(
        "minimax",
        "MiniMax",
        base_url="https://api.minimax.io/v1",
        recommended_model="MiniMax-M2.5",
        env_key="MINIMAX_API_KEY",
    ),
    _compat(
        "qwen",
        "Qwen (Alibaba)",
        base_url="https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
        recommended_model="qwen3-max",
        env_key="DASHSCOPE_API_KEY",
        endpoint_help="Prefilled with Alibaba Model Studio's international endpoint. China (Beijing): https://dashscope.aliyuncs.com/compatible-mode/v1",
    ),
    _compat(
        "xai",
        "xAI (Grok)",
        base_url="https://api.x.ai/v1",
        recommended_model="grok-4.3",
        env_key="XAI_API_KEY",
    ),
    _compat(
        "mistral",
        "Mistral",
        base_url="https://api.mistral.ai/v1",
        recommended_model="mistral-large-latest",
        env_key="MISTRAL_API_KEY",
    ),
    _compat(
        "meta",
        "Meta (Muse Spark)",
        base_url="https://api.meta.ai/v1",
        recommended_model="muse-spark-1.1",
        env_key="META_API_KEY",
        endpoint_help="Prefilled with the Meta Model API endpoint (public preview, US-only as of 2026-07).",
    ),
    # Resellers: many labs' models behind one key, using THEIR model namespaces (the curated
    # ids + display labels live in providers/matrix.py). TODO: add Groq here (+ its matrix
    # rows) once the current provider surface is tested — deliberately deferred to bound
    # how much needs verifying at once (owner call, 2026-07-04).
    _compat(
        "together",
        "Together AI",
        base_url="https://api.together.xyz/v1",
        recommended_model="zai-org/GLM-5.2",
        env_key="TOGETHER_API_KEY",
    ),
    _compat(
        "fireworks",
        "Fireworks AI",
        base_url="https://api.fireworks.ai/inference/v1",
        recommended_model="accounts/fireworks/models/glm-5p2",
        env_key="FIREWORKS_API_KEY",
    ),
    _compat(
        "openrouter",
        "OpenRouter",
        base_url="https://openrouter.ai/api/v1",
        recommended_model="z-ai/glm-5.2",
        env_key="OPENROUTER_API_KEY",
    ),
    ProviderDescriptor(
        name="ollama",
        title="Ollama (local models)",
        needs_key=False,
        fields=[
            ProviderField(
                "base_url",
                "Ollama server URL",
                secret=False,
                required=False,
                placeholder=DEFAULT_OLLAMA_URL,
                help="Where `ollama serve` is listening. The OpenAI-compatible /v1 path is added automatically.",
            ),
        ],
        build=_build_ollama,
        # Reliable native tool-calling + strong coding quality (verified). Pull with
        # `ollama pull qwen3-coder:30b`.
        recommended_model="qwen3-coder:30b",
    ),
]

_BY_NAME = {d.name: d for d in DESCRIPTORS}


def provider_descriptors() -> list[ProviderDescriptor]:
    return list(DESCRIPTORS)


def provider_names() -> list[str]:
    return [d.name for d in DESCRIPTORS]


def get_descriptor(name: str) -> Optional[ProviderDescriptor]:
    return _BY_NAME.get(name)


def build_provider_client(
    name: str, profile: dict[str, Any], secrets: Any
) -> ProviderClient:
    """Build a `ProviderClient` for `name` from its stored profile. Unknown → OpenAI default."""
    descriptor = _BY_NAME.get(name) or _BY_NAME["openai"]
    return descriptor.build(profile or {}, secrets)


def descriptor_configured(d: ProviderDescriptor, profile: dict[str, Any]) -> bool:
    """Whether a provider is usable with the given stored profile. Single-key providers:
    a stored or env key. Multi-field cloud providers (no `api_key` field, e.g. Bedrock):
    every required field present — their actual credentials may be ambient (~/.aws, ADC).
    """
    if not d.needs_key:
        return True  # keyless (Ollama) — usable out of the box
    profile = profile or {}
    if any(f.key == "api_key" for f in d.fields):
        return bool(profile.get("api_key")) or bool(
            d.env_key and os.environ.get(d.env_key)
        )
    return all(profile.get(f.key) for f in d.fields if f.required)


def detect_provider(api_key: str) -> Optional[str]:
    """Best-effort provider guess from an API key's shape, for the onboarding auto-detect.
    Returns a known provider name or None. Mirrors the GUI's client-side detection so both agree.
    """
    key = (api_key or "").strip()
    if not key:
        return None
    if key.startswith("sk-ant-"):
        return "anthropic"
    if key.startswith("sk-or-"):
        return "openrouter"
    if key.startswith("AIza"):
        return "gemini"
    if key.startswith(("sk-", "sk_")):
        return "openai"
    return None


def _verify_bedrock(fields: dict[str, Any], timeout: float) -> dict[str, Any]:
    """One cheap read-only Bedrock call (list models) with the same explicit → profile →
    ambient credential resolution the provider itself uses."""
    from .bedrock_provider import _session_kwargs

    def get(key: str) -> Optional[str]:
        return (fields.get(key) or "").strip() or None

    try:
        import boto3
        from botocore.config import Config
    except ImportError:
        return {
            "ok": False,
            "error": "boto3 is not installed — `pip install 'openworker[bedrock]'`.",
        }
    # Exactly one auth method is exercised — the one the form has selected. Per-method
    # required fields are checked here so the Test button says what's missing.
    method = get("auth_method") or "api_key"
    if method == "api_key" and not (
        get("bedrock_api_key") or os.environ.get("AWS_BEARER_TOKEN_BEDROCK")
    ):
        return {"ok": False, "error": "Enter a Bedrock API key to test."}
    if method == "iam" and not (
        get("aws_access_key_id") and get("aws_secret_access_key")
    ):
        return {"ok": False, "error": "Enter an access key ID and secret access key."}
    try:
        if method == "api_key":
            # The key rides the env var (boto3's only bearer channel); bearer then wins
            # over any ambient SigV4 credentials for Bedrock calls.
            if get("bedrock_api_key"):
                os.environ["AWS_BEARER_TOKEN_BEDROCK"] = get("bedrock_api_key")
            session_kwargs: dict[str, Any] = {}
        elif method == "profile":
            # Blank profile → the default credential chain (env vars / ~/.aws / role).
            session_kwargs = _session_kwargs(get("aws_profile"), None, None, None)
        else:  # iam
            session_kwargs = _session_kwargs(
                None,
                get("aws_access_key_id"),
                get("aws_secret_access_key"),
                get("aws_session_token"),
            )
        session = boto3.session.Session(**session_kwargs)
        client = session.client(
            "bedrock",
            region_name=get("region"),
            config=Config(connect_timeout=timeout, read_timeout=timeout),
        )
        client.list_foundation_models()
    except Exception as exc:
        kind = exc.__class__.__name__
        if kind == "NoCredentialsError":
            return {
                "ok": False,
                "error": "No AWS credentials found — enter keys or a profile, or run "
                "`aws configure` / `aws sso login` first.",
            }
        if kind == "ProfileNotFound":
            return {"ok": False, "error": f"{exc}"}
        if kind == "ClientError":
            code = (getattr(exc, "response", {}) or {}).get("Error", {}).get("Code", "")
            if code in ("UnrecognizedClientException", "InvalidSignatureException"):
                return {"ok": False, "error": "AWS rejected the credentials."}
            if code in ("AccessDeniedException", "AccessDenied"):
                return {
                    "ok": False,
                    "error": "Credentials work but lack Bedrock access (bedrock:ListFoundationModels).",
                }
            return {"ok": False, "error": f"AWS Bedrock returned {code or kind}."}
        return {"ok": False, "error": f"Couldn't reach AWS Bedrock ({kind})."}
    return {"ok": True}


# Verify probe: countTokens on a stable Gemini model — free (no generation), works with
# plain ADC (the model list/GET endpoints 403/404 under user credentials — checked live
# 2026-07-26), and exercises project + location + API enablement in one call.
_VERTEX_PROBE_MODEL = "gemini-2.5-flash"
_VERTEX_PROBE_BODY = {"contents": [{"role": "user", "parts": [{"text": "hi"}]}]}


def _verify_vertex(fields: dict[str, Any], timeout: float) -> dict[str, Any]:
    """One cheap call (countTokens) through the SELECTED auth method: ADC /
    service-account bearer, or the express API key header."""
    import httpx

    from .vertex_provider import load_credentials

    project = (fields.get("project") or "").strip()
    location = (fields.get("location") or "").strip()
    method = (fields.get("auth_method") or "").strip() or (
        "service_account" if (fields.get("service_account_json") or "").strip() else "adc"
    )
    if method == "api_key":
        key = (fields.get("vertex_api_key") or "").strip()
        if not key:
            return {"ok": False, "error": "Enter a Vertex API key to test."}
        try:
            # Express mode is global — no region host, no project in the path.
            resp = httpx.post(
                "https://aiplatform.googleapis.com/v1/publishers/google/models/"
                f"{_VERTEX_PROBE_MODEL}:countTokens",
                headers={"x-goog-api-key": key},
                json=_VERTEX_PROBE_BODY,
                timeout=timeout,
            )
        except Exception as exc:
            return {
                "ok": False,
                "error": f"Couldn't reach Vertex AI ({exc.__class__.__name__}).",
            }
        if resp.status_code < 300:
            return {"ok": True}
        if resp.status_code in (401, 403):
            return {"ok": False, "error": "Google rejected the API key."}
        return {"ok": False, "error": f"Vertex AI returned HTTP {resp.status_code}."}
    if method == "service_account" and not (fields.get("service_account_json") or "").strip():
        return {"ok": False, "error": "Paste a service-account JSON to test."}
    try:
        creds = None
        if method == "service_account":
            creds = load_credentials(fields.get("service_account_json"))
        if creds is None:
            import google.auth

            creds, _ = google.auth.default(
                scopes=["https://www.googleapis.com/auth/cloud-platform"]
            )
        from google.auth.transport.requests import Request

        creds.refresh(Request())
    except Exception as exc:
        kind = exc.__class__.__name__
        if kind == "DefaultCredentialsError":
            return {
                "ok": False,
                "error": "No Google Cloud credentials found — paste a service-account "
                "JSON, or run `gcloud auth application-default login` first.",
            }
        if kind in ("RefreshError", "MalformedError", "JSONDecodeError", "ValueError"):
            return {"ok": False, "error": "Google rejected the credentials."}
        return {"ok": False, "error": f"Couldn't load Google credentials ({kind})."}
    from .vertex_provider import _regional_host

    try:
        resp = httpx.post(
            f"https://{_regional_host(location)}/v1/projects/{project}"
            f"/locations/{location}/publishers/google/models/"
            f"{_VERTEX_PROBE_MODEL}:countTokens",
            headers={"Authorization": f"Bearer {creds.token}"},
            json=_VERTEX_PROBE_BODY,
            timeout=timeout,
        )
    except Exception as exc:
        return {"ok": False, "error": f"Couldn't reach Vertex AI ({exc.__class__.__name__})."}
    if resp.status_code < 300:
        return {"ok": True}
    if resp.status_code in (401, 403):
        return {
            "ok": False,
            "error": "Credentials work but lack Vertex AI access in this project.",
        }
    if resp.status_code == 404:
        return {"ok": False, "error": "Project or location not found on Vertex AI."}
    return {"ok": False, "error": f"Vertex AI returned HTTP {resp.status_code}."}


def verify_provider_key(
    name: str,
    *,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    fields: Optional[dict[str, Any]] = None,
    timeout: float = 10.0,
) -> dict[str, Any]:
    """Validate a provider's credentials with one cheap, read-only call (list models) — the same
    pattern connectors use to validate tokens. Transient: callers pass the key directly so a user
    can Test before saving. Never raises; returns {ok, error?}. Multi-field cloud providers
    (Bedrock, Vertex) take their whole form via `fields`; everyone else uses api_key/base_url.
    """
    import httpx

    d = _BY_NAME.get(name) or _BY_NAME["openai"]
    key = (api_key or "").strip()
    if name == "bedrock":
        return _verify_bedrock(fields or {}, timeout)
    if name == "vertex":
        return _verify_vertex(fields or {}, timeout)
    try:
        if name == "anthropic":
            resp = httpx.get(
                "https://api.anthropic.com/v1/models",
                headers={"x-api-key": key, "anthropic-version": "2023-06-01"},
                timeout=timeout,
            )
        elif name == "gemini":
            resp = httpx.get(
                "https://generativelanguage.googleapis.com/v1beta/models",
                params={"key": key},
                timeout=timeout,
            )
        elif name == "ollama":
            base = _normalize_ollama_url(base_url)
            resp = httpx.get(base.rstrip("/") + "/models", timeout=timeout)
        else:  # openai + any OpenAI-compatible endpoint (Azure, OpenRouter, vendors, vLLM…)
            default_base = next(
                (f.default for f in d.fields if f.key == "base_url" and f.default), ""
            )
            base = (
                (base_url or "").strip().rstrip("/")
                or default_base.rstrip("/")
                or "https://api.openai.com/v1"
            )
            resp = httpx.get(
                base + "/models",
                headers={"Authorization": f"Bearer {key}"},
                timeout=timeout,
            )
    except Exception as exc:  # DNS/connection/timeout — never let it bubble to a 500
        return {
            "ok": False,
            "error": f"Couldn't reach {d.title} ({exc.__class__.__name__}).",
        }

    if resp.status_code < 300:
        return {"ok": True}
    if resp.status_code in (401, 403):
        if name == "ollama":
            return {"ok": False, "error": "Server rejected the request."}
        return {"ok": False, "error": "Invalid API key."}
    if resp.status_code == 404 and name == "ollama":
        return {
            "ok": False,
            "error": "Reached the server, but no OpenAI-compatible /v1 API there.",
        }
    return {"ok": False, "error": f"{d.title} returned HTTP {resp.status_code}."}
