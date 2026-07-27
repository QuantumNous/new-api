"""Google Vertex AI provider — one entry in Settings, three wire paths by model family.

Routed ids look like `vertex:<family>/<model id>`; the router strips `vertex:` and this
provider splits the family segment, reusing an existing provider class per family:

- `gemini/…`     → the native `GeminiProvider` over `genai.Client(vertexai=True)`.
- `claude/…`     → the native `AnthropicProvider` over the SDK's `AnthropicVertex` client.
- `openweight/…` → `OpenAIProvider` against Vertex's OpenAI-compatible MaaS endpoint
  (Llama, Qwen, DeepSeek, …; ids keep their publisher segment, e.g. `openweight/meta/…`).

An id with no recognized family segment is best-effort routed by name (gemini* → Gemini,
claude* → Claude, anything else → MaaS) so a raw id pasted without the add-model dropdown
still works.

Auth is ONE method at a time, selected by the profile's `auth_method` (a segmented choice
in Settings, mirroring Bedrock — owner call 2026-07-26):

- `adc`             — Application Default Credentials (`gcloud auth application-default
  login`), Google's own recommended path. Nothing stored.
- `service_account` — an explicit service-account JSON (pasted content or a file path).
- `api_key`         — a Vertex API key (express mode). GEMINI FAMILY ONLY: the genai SDK
  takes it (and it excludes project/location — mutually exclusive there), but Claude
  (AnthropicVertex) and the MaaS endpoint require OAuth credentials, so those families
  raise a clear error directing the user to the other methods.

The MaaS path authenticates with a google-auth bearer token that expires ~hourly — this
wrapper refreshes it and rebuilds the OpenAI sub-client as needed; the two native SDK
clients take the credentials object and refresh internally. Fields from non-selected
methods are dropped at construction; a missing/unknown method falls back to whichever
fields are present (service account, else ADC).
"""

from __future__ import annotations

import json
from typing import Any, Optional

from .anthropic_provider import AnthropicProvider
from .base import AssistantTurn, ModelCapabilities, ProviderClient
from .capabilities import capabilities_for
from .gemini_provider import GeminiProvider
from .openai_provider import OpenAIProvider

_SCOPES = ["https://www.googleapis.com/auth/cloud-platform"]

_FAMILIES = ("gemini", "claude", "openweight")


def _regional_host(location: Optional[str]) -> str:
    """Vertex REST host for a location — `global` (newer Gemini models) has no region
    prefix (checked live 2026-07-26)."""
    if not location or location == "global":
        return "aiplatform.googleapis.com"
    return f"{location}-aiplatform.googleapis.com"


def load_credentials(service_account_json: Optional[str]) -> Any:
    """Explicit service-account JSON (content or path) → Credentials; blank → None (the
    SDKs and the token path then fall back to Application Default Credentials)."""
    raw = (service_account_json or "").strip()
    if not raw:
        return None
    from google.oauth2 import service_account

    if raw.startswith("{"):
        info = json.loads(raw)
        return service_account.Credentials.from_service_account_info(
            info, scopes=_SCOPES
        )
    return service_account.Credentials.from_service_account_file(raw, scopes=_SCOPES)


class VertexProvider(ProviderClient):
    """Family dispatcher: splits `<family>/<model id>` and delegates to the sub-client."""

    def __init__(
        self,
        *,
        project: Optional[str] = None,
        location: Optional[str] = None,
        auth_method: Optional[str] = None,
        service_account_json: Optional[str] = None,
        api_key: Optional[str] = None,
        credentials: Any = None,
        gemini_client: Optional[ProviderClient] = None,
        claude_client: Optional[ProviderClient] = None,
        openweight_client: Optional[ProviderClient] = None,
    ):
        # Narrow to the selected auth method here, once — stale values stored under a
        # previously-selected method must never reach a different credential path.
        if auth_method == "adc":
            service_account_json = api_key = None
        elif auth_method == "service_account":
            api_key = None
        elif auth_method == "api_key":
            service_account_json = None
        self._project = project
        self._location = location
        self._api_key = api_key
        self._service_account_json = service_account_json
        self._credentials = credentials  # test seam; normally resolved lazily
        # Test seams: pre-built sub-providers skip the SDK construction below.
        self._clients: dict[str, ProviderClient] = {}
        if gemini_client is not None:
            self._clients["gemini"] = gemini_client
        if claude_client is not None:
            self._clients["claude"] = claude_client
        if openweight_client is not None:
            self._clients["openweight"] = openweight_client
        self._openweight_injected = openweight_client is not None

    @staticmethod
    def _split(model: str) -> tuple[str, str]:
        if "/" in model:
            family, rest = model.split("/", 1)
            if family in _FAMILIES:
                return family, rest
        # Raw id without a family segment: route by name, best effort.
        if model.startswith("gemini"):
            return "gemini", model
        if model.startswith("claude"):
            return "claude", model
        return "openweight", model

    # -- credentials -------------------------------------------------------------
    def _explicit_credentials(self) -> Any:
        """The service-account credentials, or None to let each SDK use ADC."""
        if self._credentials is None:
            self._credentials = load_credentials(self._service_account_json)
        return self._credentials

    def _bearer_credentials(self) -> Any:
        """Credentials for the MaaS bearer token: explicit service account, else ADC."""
        creds = self._explicit_credentials()
        if creds is None:
            import google.auth

            try:
                creds, _ = google.auth.default(scopes=_SCOPES)
            except Exception as exc:
                raise RuntimeError(
                    "No Google Cloud credentials found — paste a service-account JSON "
                    "in Settings ▸ Models, or run `gcloud auth application-default login`."
                ) from exc
            self._credentials = creds
        return creds

    # -- family sub-clients --------------------------------------------------------
    def _family_client(self, family: str) -> ProviderClient:
        if self._api_key and family != "gemini":
            raise RuntimeError(
                "Vertex API keys cover Gemini models only — switch the Vertex provider "
                "to Google Cloud login or a service account for Claude and open-weight "
                "models (Settings ▸ Models)."
            )
        if family == "openweight":
            return self._openweight_client()
        client = self._clients.get(family)
        if client is None:
            if family == "gemini":
                from google import genai

                if self._api_key:
                    # Express mode: the key excludes project/location (SDK enforces
                    # mutual exclusivity — the key already identifies the project).
                    sdk = genai.Client(vertexai=True, api_key=self._api_key)
                else:
                    sdk = genai.Client(
                        vertexai=True,
                        project=self._project,
                        location=self._location,
                        credentials=self._explicit_credentials(),
                    )
                client = GeminiProvider(client=sdk)
            else:
                from anthropic import AnthropicVertex

                client = AnthropicProvider(
                    client=AnthropicVertex(
                        project_id=self._project,
                        region=self._location,
                        credentials=self._explicit_credentials(),
                    )
                )
            self._clients[family] = client
        return client

    def _openweight_client(self) -> ProviderClient:
        """OpenAIProvider over the Vertex MaaS endpoint, rebuilt whenever the bearer
        token has to be refreshed (google-auth tokens expire ~hourly)."""
        if self._openweight_injected:
            return self._clients["openweight"]
        creds = self._bearer_credentials()
        if not getattr(creds, "valid", False):
            from google.auth.transport.requests import Request

            creds.refresh(Request())
            self._clients.pop("openweight", None)  # stale token — rebuild below
        client = self._clients.get("openweight")
        if client is None:
            base = (
                f"https://{_regional_host(self._location)}/v1/projects/"
                f"{self._project}/locations/{self._location}/endpoints/openapi"
            )
            client = OpenAIProvider(api_key=creds.token, base_url=base)
            self._clients["openweight"] = client
        return client

    # -- ProviderClient -------------------------------------------------------------
    def complete(
        self,
        *,
        model: str,
        messages: list[dict[str, Any]],
        tools: Optional[list[dict[str, Any]]] = None,
        **settings: Any,
    ) -> AssistantTurn:
        family, rest = self._split(model)
        return self._family_client(family).complete(
            model=rest, messages=messages, tools=tools, **settings
        )

    def stream(
        self,
        *,
        model: str,
        messages: list[dict[str, Any]],
        tools: Optional[list[dict[str, Any]]] = None,
        **settings: Any,
    ):
        family, rest = self._split(model)
        return self._family_client(family).stream(
            model=rest, messages=messages, tools=tools, **settings
        )

    def capabilities(self, model: str) -> ModelCapabilities:
        qualified = model if model.startswith("vertex:") else f"vertex:{model}"
        return capabilities_for(qualified)
