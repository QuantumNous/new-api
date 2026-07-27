"""Google Vertex AI provider — 3-way family dispatch, bearer refresh, registry glue."""

from __future__ import annotations

from typing import Any, Optional

import pytest

from coworker.providers import capabilities_for
from coworker.providers.base import AssistantTurn, ProviderClient, StreamChunk
from coworker.providers.vertex_provider import VertexProvider, load_credentials

# -- family dispatch ----------------------------------------------------------------


class _Recorder(ProviderClient):
    def __init__(self):
        self.seen: list[str] = []

    def complete(self, *, model, messages, tools=None, **settings):
        self.seen.append(model)
        return AssistantTurn(text="ok")

    def stream(self, *, model, messages, tools=None, **settings):
        self.seen.append(model)
        yield StreamChunk(turn=AssistantTurn(text="ok"))

    def capabilities(self, model):
        return capabilities_for(model)


def _provider(**kw) -> tuple[VertexProvider, _Recorder, _Recorder, _Recorder]:
    gemini, claude, openweight = _Recorder(), _Recorder(), _Recorder()
    p = VertexProvider(
        project="proj",
        location="us-east5",
        gemini_client=gemini,
        claude_client=claude,
        openweight_client=openweight,
        **kw,
    )
    return p, gemini, claude, openweight


def test_family_dispatch():
    p, gemini, claude, openweight = _provider()
    msgs = [{"role": "user", "content": "x"}]
    p.complete(model="gemini/gemini-3.6-flash", messages=msgs)
    p.complete(model="claude/claude-sonnet-4-6", messages=msgs)
    # Openweight ids keep their publisher segment — only the FIRST slash splits.
    p.complete(
        model="openweight/meta/llama-4-maverick-17b-128e-instruct-maas", messages=msgs
    )
    assert gemini.seen == ["gemini-3.6-flash"]
    assert claude.seen == ["claude-sonnet-4-6"]
    assert openweight.seen == ["meta/llama-4-maverick-17b-128e-instruct-maas"]


def test_raw_ids_route_by_name():
    p, gemini, claude, openweight = _provider()
    msgs = [{"role": "user", "content": "x"}]
    p.complete(model="gemini-2.5-pro", messages=msgs)
    p.complete(model="claude-haiku-4-5", messages=msgs)
    p.complete(model="deepseek-ai/deepseek-v4-maas", messages=msgs)
    assert gemini.seen == ["gemini-2.5-pro"]
    assert claude.seen == ["claude-haiku-4-5"]
    assert openweight.seen == ["deepseek-ai/deepseek-v4-maas"]


# -- openweight bearer refresh ---------------------------------------------------------


class _FakeCreds:
    """google-auth-shaped credentials: `valid` flips true after refresh()."""

    def __init__(self, token: str = "tok-1"):
        self.token = token
        self.valid = False
        self.refreshes = 0

    def refresh(self, request):
        self.refreshes += 1
        self.token = f"tok-{self.refreshes + 1}"
        self.valid = True


def test_openweight_builds_maas_endpoint_and_refreshes_bearer():
    creds = _FakeCreds()
    p = VertexProvider(project="proj", location="us-east5", credentials=creds)
    client = p._openweight_client()
    assert creds.refreshes == 1
    assert client._api_key == "tok-2"
    assert client._base_url == (
        "https://us-east5-aiplatform.googleapis.com/v1/projects/proj"
        "/locations/us-east5/endpoints/openapi"
    )
    # Token still valid → the same sub-client is reused, no extra refresh.
    assert p._openweight_client() is client
    assert creds.refreshes == 1
    # Token expired → refresh and rebuild with the new bearer.
    creds.valid = False
    rebuilt = p._openweight_client()
    assert rebuilt is not client
    assert creds.refreshes == 2
    assert rebuilt._api_key == "tok-3"


def test_openweight_global_location_has_no_region_host():
    creds = _FakeCreds()
    p = VertexProvider(project="proj", location="global", credentials=creds)
    client = p._openweight_client()
    assert client._base_url == (
        "https://aiplatform.googleapis.com/v1/projects/proj"
        "/locations/global/endpoints/openapi"
    )


# -- credentials ------------------------------------------------------------------------


def test_load_credentials_blank_means_adc():
    assert load_credentials(None) is None
    assert load_credentials("   ") is None


def test_load_credentials_bad_json_raises():
    with pytest.raises(Exception):
        load_credentials('{"type": "service_account"')  # malformed JSON


# -- capabilities / matrix ----------------------------------------------------------------


def test_vertex_capabilities_from_matrix_and_fallback():
    assert capabilities_for("vertex:gemini/gemini-3.6-flash").vision
    assert capabilities_for("vertex:claude/claude-sonnet-4-6").pdf
    curated_ow = capabilities_for(
        "vertex:openweight/meta/llama-4-maverick-17b-128e-instruct-maas"
    )
    assert curated_ow.tools
    # Custom ids fall back on the family segment.
    assert capabilities_for("vertex:gemini/gemini-4.0-preview").vision
    custom_ow = capabilities_for("vertex:openweight/some-org/new-model-maas")
    assert custom_ow.tools and not custom_ow.parallel_tool_calls


# -- registry / manager glue ----------------------------------------------------------------


def test_vertex_descriptor_and_builder():
    from coworker.providers.registry import build_provider_client, get_descriptor

    d = get_descriptor("vertex")
    assert d is not None and d.needs_key
    assert [f.key for f in d.fields] == [
        "project",
        "location",
        "auth_method",
        "service_account_json",
        "vertex_api_key",
    ]
    assert [f.key for f in d.fields if f.required] == ["project", "location"]
    # ADC is the default method (Google's own recommendation) and carries the copyable
    # sign-in command; the two credential fields hide behind their methods.
    method = next(f for f in d.fields if f.key == "auth_method")
    assert method.default == "adc"
    assert [c["value"] for c in method.choices] == ["adc", "service_account", "api_key"]
    adc = next(c for c in method.choices if c["value"] == "adc")
    assert adc["command"].startswith("gcloud auth application-default")
    by_key = {f.key: f for f in d.fields}
    assert by_key["service_account_json"].show_when == {"auth_method": "service_account"}
    assert by_key["vertex_api_key"].show_when == {"auth_method": "api_key"}
    assert by_key["service_account_json"].secret and by_key["vertex_api_key"].secret

    from coworker.providers.matrix import models_for_provider

    assert d.recommended_model in models_for_provider("vertex")

    p = build_provider_client(
        "vertex", {"project": "proj", "location": "europe-west1"}, None
    )
    assert isinstance(p, VertexProvider)
    assert p._project == "proj" and p._location == "europe-west1"


def test_auth_method_narrows_out_other_methods_fields():
    """Stale values stored under a previously-selected method must never leak into a
    different auth path."""
    p = VertexProvider(
        project="proj",
        location="us-east5",
        auth_method="adc",
        service_account_json="{stale}",
        api_key="AQ.stale",
    )
    assert p._service_account_json is None and p._api_key is None
    p2 = VertexProvider(
        project="proj",
        location="us-east5",
        auth_method="api_key",
        api_key="AQ.live",
        service_account_json="{stale}",
    )
    assert p2._api_key == "AQ.live" and p2._service_account_json is None


def test_api_key_method_is_gemini_only():
    p = VertexProvider(
        project="proj", location="us-east5", auth_method="api_key", api_key="AQ.k"
    )
    msgs = [{"role": "user", "content": "x"}]
    with pytest.raises(RuntimeError, match="Gemini models only"):
        p.complete(model="claude/claude-sonnet-4-6", messages=msgs)
    with pytest.raises(RuntimeError, match="Gemini models only"):
        p.complete(model="openweight/meta/llama-4-maverick-maas", messages=msgs)


def test_api_key_method_builds_express_gemini_client(monkeypatch):
    """Express mode: the key goes to genai.Client WITHOUT project/location (the SDK
    treats them as mutually exclusive with an API key)."""
    from google import genai

    captured: dict = {}

    class _FakeClient:
        def __init__(self, **kwargs):
            captured.update(kwargs)

    monkeypatch.setattr(genai, "Client", _FakeClient)
    p = VertexProvider(
        project="proj", location="us-east5", auth_method="api_key", api_key="AQ.k"
    )
    sub = p._family_client("gemini")
    from coworker.providers import GeminiProvider

    assert isinstance(sub, GeminiProvider)
    assert captured == {"vertexai": True, "api_key": "AQ.k"}


def test_verify_vertex_api_key_method(monkeypatch):
    import httpx

    from coworker.providers.registry import verify_provider_key

    out = verify_provider_key(
        "vertex",
        fields={"project": "p", "location": "l", "auth_method": "api_key"},
    )
    assert not out["ok"] and "API key" in out["error"]

    captured: dict = {}

    def fake_post(url, headers=None, json=None, timeout=None, **kw):
        captured["url"] = url
        captured["headers"] = headers

        class _Resp:
            status_code = 200

        return _Resp()

    monkeypatch.setattr(httpx, "post", fake_post)
    out = verify_provider_key(
        "vertex",
        fields={
            "project": "p",
            "location": "l",
            "auth_method": "api_key",
            "vertex_api_key": "AQ.k",
        },
    )
    assert out == {"ok": True}
    assert captured["headers"]["x-goog-api-key"] == "AQ.k"
    # Express mode is global — no region host, no project in the path.
    assert captured["url"] == (
        "https://aiplatform.googleapis.com/v1/publishers/google/models/"
        "gemini-2.5-flash:countTokens"
    )


def test_verify_vertex_service_account_requires_json():
    from coworker.providers.registry import verify_provider_key

    out = verify_provider_key(
        "vertex",
        fields={"project": "p", "location": "l", "auth_method": "service_account"},
    )
    assert not out["ok"] and "service-account JSON" in out["error"]


def test_vertex_configured_needs_project_and_location():
    from coworker.providers.registry import descriptor_configured, get_descriptor

    d = get_descriptor("vertex")
    assert not descriptor_configured(d, {})
    assert not descriptor_configured(d, {"project": "proj"})
    assert descriptor_configured(d, {"project": "proj", "location": "us-east5"})


def test_router_routes_vertex_ids():
    from coworker.providers.router import ProviderRouter

    router = ProviderRouter.__new__(ProviderRouter)
    model = "vertex:openweight/meta/llama-4-maverick-17b-128e-instruct-maas"
    assert router._provider_name(model) == "vertex"
    assert ProviderRouter._bare(model) == (
        "openweight/meta/llama-4-maverick-17b-128e-instruct-maas"
    )


# -- verify ---------------------------------------------------------------------------------


def _patch_verify(monkeypatch, creds: Any, status_code: Optional[int]):
    import httpx

    import coworker.providers.vertex_provider as vp

    monkeypatch.setattr(vp, "load_credentials", lambda raw: creds)
    captured: dict = {}

    def fake_post(url, headers=None, json=None, timeout=None, **kw):
        captured["url"] = url
        captured["headers"] = headers

        class _Resp:
            pass

        resp = _Resp()
        resp.status_code = status_code
        return resp

    monkeypatch.setattr(httpx, "post", fake_post)
    return captured


def test_verify_vertex_ok(monkeypatch):
    from coworker.providers.registry import verify_provider_key

    creds = _FakeCreds()
    captured = _patch_verify(monkeypatch, creds, 200)
    out = verify_provider_key(
        "vertex",
        fields={"project": "proj", "location": "us-east5", "service_account_json": "x"},
    )
    assert out == {"ok": True}
    assert creds.refreshes == 1
    assert "proj/locations/us-east5/publishers/google/models" in captured["url"]
    assert captured["headers"]["Authorization"] == "Bearer tok-2"


def test_verify_vertex_maps_permission_errors(monkeypatch):
    from coworker.providers.registry import verify_provider_key

    _patch_verify(monkeypatch, _FakeCreds(), 403)
    out = verify_provider_key(
        "vertex",
        fields={"project": "proj", "location": "us-east5", "service_account_json": "x"},
    )
    assert not out["ok"] and "Vertex AI access" in out["error"]

    _patch_verify(monkeypatch, _FakeCreds(), 404)
    out = verify_provider_key(
        "vertex",
        fields={"project": "nope", "location": "us-east5", "service_account_json": "x"},
    )
    assert not out["ok"] and "not found" in out["error"]
