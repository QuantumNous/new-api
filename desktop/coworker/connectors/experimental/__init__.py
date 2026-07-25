"""Experimental connectors — use-at-your-own-risk integrations, excluded from release builds.

Connectors in this package are hidden behind the experimental-connectors setting, require an
explicit per-connector risk acknowledgment to connect, and are stripped from official desktop
builds by packaging/openworker-server.spec (set COWORKER_EXPERIMENTAL=1 at build time to include
them in a self-built binary).

To add one: define a `ConnectorDescriptor` with a `risk_notice` that states the concrete
downside in plain language, append it to `EXPERIMENTAL_DESCRIPTORS`, and register its tools or
adapter the same way first-party connectors do. The `experimental` flag is forced on by the
loader in descriptors.py regardless of what the descriptor sets.
"""

from __future__ import annotations

from ..descriptors import ConnectorDescriptor

EXPERIMENTAL_DESCRIPTORS: list[ConnectorDescriptor] = []
