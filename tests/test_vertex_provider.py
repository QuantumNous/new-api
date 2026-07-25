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
    assert [f.key for f in d.fields] == ["project", "location", "service_account_json"]
    assert [f.key for f in d.fields if f.required] == ["project", "location"]
    sa = next(f for f in d.fields if f.key == "service_account_json")
    assert sa.secret and "Application Default Credentials" in sa.help

    from coworker.providers.matrix import models_for_provider

    assert d.recommended_model in models_for_provider("vertex")

    p = build_provider_client(
        "vertex", {"project": "proj", "location": "europe-west1"}, None
    )
    assert isinstance(p, VertexProvider)
    assert p._project == "proj" and p._location == "europe-west1"


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

    def fake_get(url, headers=None, timeout=None, **kw):
        captured["url"] = url
        captured["headers"] = headers

        class _Resp:
            pass

        resp = _Resp()
        resp.status_code = status_code
        return resp

    monkeypatch.setattr(httpx, "get", fake_get)
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
