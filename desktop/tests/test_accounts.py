"""Generic multi-account layer (accounts.py): the one implementation behind
every batch-2 connector's multiple accounts — per-account profiles at
`<connector>:account:<id>`, pointer-only `:default`, lazy legacy migration.
Mirrors the shipped gmail/gcal semantics, parameterized by connector."""

from __future__ import annotations

import pytest

from coworker.connectors import accounts, descriptors
from coworker.connectors.descriptors import ConnectorDescriptor, Field, ValidationResult
from coworker.connectors.setup import (
    connect_connector,
    connector_list,
    disconnect_connector,
)
from coworker.secrets import SecretStore


def _fake_descriptor(name="acmeapp", account_field="project_id", managed=False):
    return ConnectorDescriptor(
        name=name,
        title="AcmeApp",
        icon="◇",
        blurb="test connector",
        auth="api_token",
        two_way=False,
        fields=[
            Field("api_key", "API key", secret=True),
            Field("project_id", "Project ID", secret=False),
        ],
        instructions=[],
        validate=lambda creds: ValidationResult(True, identity="acme@example.com"),
        managed=managed,
        account_field=account_field,
    )


@pytest.fixture
def acme():
    """A registered account-patterned test connector, removed afterwards."""
    d = _fake_descriptor()
    descriptors.register_descriptor(d)
    yield d
    descriptors.DESCRIPTORS.remove(d)
    descriptors._BY_NAME.pop(d.name, None)


@pytest.fixture
def secrets(tmp_path):
    return SecretStore(tmp_path / "secrets.json")


def test_add_list_resolve_default(acme, secrets):
    assert accounts.add_account(secrets, "acmeapp", "p1", {"api_key": "k1"})["ok"]
    accounts.add_account(secrets, "acmeapp", "p2", {"api_key": "k2"})
    assert [a for a, _ in accounts.list_accounts(secrets, "acmeapp")] == ["p1", "p2"]
    assert accounts.default_account(secrets, "acmeapp") == "p1"  # first stays default

    # resolve: explicit, default fallback, unknown
    aid, key, profile = accounts.resolve(secrets, "acmeapp", "p2")
    assert (aid, key, profile["api_key"]) == ("p2", "acmeapp:account:p2", "k2")
    aid, _, profile = accounts.resolve(secrets, "acmeapp")
    assert aid == "p1" and profile["api_key"] == "k1"
    assert accounts.resolve(secrets, "acmeapp", "nope")[2] is None

    # the default pointer profile never carries credentials
    assert "api_key" not in (secrets.get("acmeapp:default") or {})

    assert accounts.set_default(secrets, "acmeapp", "p2")["ok"]
    assert accounts.default_account(secrets, "acmeapp") == "p2"
    assert not accounts.set_default(secrets, "acmeapp", "ghost")["ok"]


def test_disconnect_moves_pointer_then_deletes_it(acme, secrets):
    accounts.add_account(secrets, "acmeapp", "p1", {"api_key": "k1"})
    accounts.add_account(secrets, "acmeapp", "p2", {"api_key": "k2"})
    assert accounts.disconnect_account(secrets, "acmeapp", "p1")["ok"]
    assert accounts.default_account(secrets, "acmeapp") == "p2"  # pointer moved
    out = accounts.disconnect_account(secrets, "acmeapp", "p2")
    assert out["ok"] and out["remaining_accounts"] == 0
    assert secrets.get("acmeapp:default") is None  # pointer gone with last account


def test_legacy_default_migrates_lazily(acme, secrets):
    """A credential-bearing :default from an older build becomes one account on
    first touch — same no-user-action migration gmail/gcal shipped."""
    secrets.put(
        "acmeapp:default",
        {"type": "token", "enabled": True, "api_key": "old", "project_id": "42"},
    )
    assert [a for a, _ in accounts.list_accounts(secrets, "acmeapp")] == ["42"]
    _, _, profile = accounts.resolve(secrets, "acmeapp")
    assert profile["api_key"] == "old"
    default = secrets.get("acmeapp:default")
    assert default["default_account"] == "42" and "api_key" not in default


def test_connect_connector_adds_accounts_not_overwrites(acme, secrets):
    """The manual connect path: two submits with different account ids = two
    accounts; same id = credential update in place."""
    out = connect_connector(
        secrets, "acmeapp", {"api_key": "k1", "project_id": "11"}, validate=False
    )
    assert out["ok"] and out["account_id"] == "11"
    connect_connector(
        secrets, "acmeapp", {"api_key": "k2", "project_id": "22"}, validate=False
    )
    connect_connector(
        secrets, "acmeapp", {"api_key": "k2b", "project_id": "22"}, validate=False
    )
    ids = [a for a, _ in accounts.list_accounts(secrets, "acmeapp")]
    assert ids == ["11", "22"]
    assert accounts.resolve(secrets, "acmeapp", "22")[2]["api_key"] == "k2b"
    assert accounts.default_account(secrets, "acmeapp") == "11"


def test_identity_sentinel_uses_validator_identity(secrets):
    d = _fake_descriptor(name="acmemail", account_field=accounts.IDENTITY)
    d.fields = [Field("api_key", "API key", secret=True)]
    descriptors.register_descriptor(d)
    try:
        out = connect_connector(secrets, "acmemail", {"api_key": "k"})  # validate=True
        assert out["ok"] and out["account_id"] == "acme@example.com"
    finally:
        descriptors.DESCRIPTORS.remove(d)
        descriptors._BY_NAME.pop(d.name, None)


def test_connector_list_accounts_branch_and_full_disconnect(acme, secrets):
    accounts.add_account(
        secrets, "acmeapp", "p1", {"api_key": "k1", "account": "Proj One"}
    )
    accounts.add_account(secrets, "acmeapp", "p2", {"api_key": "k2", "managed": True})
    entry = next(c for c in connector_list(secrets) if c["name"] == "acmeapp")
    assert entry["connected"] and entry["enabled"]
    assert entry["accounts"] == [
        {"account_id": "p1", "name": "Proj One", "default": True, "managed": False},
        {"account_id": "p2", "name": "p2", "default": False, "managed": True},
    ]
    assert entry["account"] == "Proj One"  # default account's display name

    assert disconnect_connector(secrets, "acmeapp")["ok"]
    assert accounts.list_accounts(secrets, "acmeapp") == []
    entry = next(c for c in connector_list(secrets) if c["name"] == "acmeapp")
    assert not entry["connected"]


def test_generic_account_routes(acme, secrets, tmp_path, monkeypatch):
    """The generic /accounts/{id}/disconnect|default routes work for
    account-patterned connectors and refuse everything else."""
    from fastapi.testclient import TestClient

    from coworker.providers import ModelCapabilities, ProviderClient
    from coworker.server.app import create_app
    from coworker.server.manager import SessionManager

    class _Provider(ProviderClient):
        def complete(self, *, model, messages, tools=None, **settings):
            raise AssertionError("no turns expected")

        def capabilities(self, model):
            return ModelCapabilities()

    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    manager = SessionManager(workspace=tmp_path, provider=_Provider())
    accounts.add_account(manager.secrets, "acmeapp", "p1", {"api_key": "k1"})
    accounts.add_account(manager.secrets, "acmeapp", "p2", {"api_key": "k2"})
    client = TestClient(create_app(manager))

    assert client.post("/v1/connectors/acmeapp/accounts/p2/default").json()["ok"]
    assert accounts.default_account(manager.secrets, "acmeapp") == "p2"
    assert client.post("/v1/connectors/acmeapp/accounts/p1/disconnect").json()["ok"]
    assert [a for a, _ in accounts.list_accounts(manager.secrets, "acmeapp")] == ["p2"]

    out = client.post("/v1/connectors/linear/accounts/x/default").json()
    assert not out["ok"] and "not a multi-account" in out["error"]
