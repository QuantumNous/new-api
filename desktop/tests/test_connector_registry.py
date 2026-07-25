"""UI-Refresh Phase 1 — connector registry metadata (brand color + logo) and the
not-yet-shipped placeholder descriptors that personas recommend.

The frontend renders any connector by `logo` id + `brand_color` with a neutral fallback, so
every descriptor must expose both and `/v1/connectors` (i.e. `connector_list`) must surface them.
"""

from __future__ import annotations

import re

from coworker.connectors import connector_list
from coworker.connectors.descriptors import (
    ConnectorDescriptor,
    get_descriptor,
    list_descriptors,
)
from coworker.secrets import SecretStore

_HEX = re.compile(r"^#[0-9a-fA-F]{6}$")

# Brand colors from the visual mock (ui-mocks/redesign.html). Fallback gray is #6b7280.
_EXPECTED_BRAND = {
    "slack": "#611f69",
    "telegram": "#229ed9",
    "github": "#1f2328",
    "datadog": "#632ca6",
    "salesforce": "#00a1e0",
    "hubspot": "#ff7a59",
    "pagerduty": "#06ac38",
}

# github/hubspot already ship as real connectors here, so only these three are placeholders.
_PLACEHOLDERS = ("datadog", "salesforce", "pagerduty")
# Everything a persona may recommend must at least have a descriptor + brand badge.
_RECOMMENDED = ("github", "datadog", "salesforce", "hubspot", "pagerduty")


def test_descriptor_brand_logo(tmp_path):
    # Every descriptor exposes a hex brand_color and a (string) logo id.
    for d in list_descriptors():
        assert _HEX.match(
            d.brand_color
        ), f"{d.name} brand_color not hex: {d.brand_color!r}"
        assert isinstance(d.logo, str)

    # connector_list surfaces both fields per connector, with a valid hex color.
    secrets = SecretStore(tmp_path / "secrets.json")
    listed = {c["name"]: c for c in connector_list(secrets)}
    for c in listed.values():
        assert _HEX.match(c["brand_color"]), c
        assert "logo" in c and isinstance(c["logo"], str)

    # The known brand colors + logo ids are populated.
    for name, color in _EXPECTED_BRAND.items():
        d = get_descriptor(name)
        assert d is not None, name
        assert d.brand_color == color, (name, d.brand_color)
        assert d.logo == name, (name, d.logo)
    assert get_descriptor("slack").logo == "slack"
    assert listed["slack"]["brand_color"] == "#611f69"
    assert listed["telegram"]["brand_color"] == "#229ed9"
    # email uses the "email" logo id and the neutral fallback color.
    assert get_descriptor("email").logo == "email"

    # An unknown/placeholder descriptor with no brand_color set still returns the fallback gray.
    fallback = ConnectorDescriptor(
        name="zzz_unknown",
        title="Unknown",
        icon="?",
        blurb="",
        auth="none",
        two_way=False,
        fields=[],
        instructions=[],
    )
    assert fallback.brand_color == "#6b7280"
    assert fallback.logo == ""


def test_placeholder_connectors_listed(tmp_path):
    secrets = SecretStore(tmp_path / "secrets.json")
    listed = {c["name"]: c for c in connector_list(secrets)}

    # Every persona-recommended connector has a descriptor + brand badge so the UI can render it.
    for name in _RECOMMENDED:
        d = get_descriptor(name)
        assert d is not None, name
        assert _HEX.match(d.brand_color) and d.logo == name
        assert name in listed

    # The genuinely-not-yet-shipped ones are available:false / connected:false placeholders with
    # no connect path (no required fields, no validate).
    for name in _PLACEHOLDERS:
        d = get_descriptor(name)
        assert d.available is False, name
        assert d.validate is None, name
        assert not any(f.required for f in d.fields), name
        c = listed[name]
        assert c["available"] is False
        assert c["connected"] is False
        assert c["enabled"] is False
        assert c["fields"] == []

    # github/hubspot ship as real connectors (available:true) — not placeholders.
    assert listed["github"]["available"] is True
    assert listed["hubspot"]["available"] is True
