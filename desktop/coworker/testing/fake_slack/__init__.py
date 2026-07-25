"""FakeSlack — a local, controllable Slack test double (Web API + Socket Mode).

See :mod:`coworker.testing.fake_slack.server` and ``platform/docs/FAKE-SLACK-SPEC.md``.
"""

from __future__ import annotations

from .server import FakeSlack

__all__ = ["FakeSlack"]
