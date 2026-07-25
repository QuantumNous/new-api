"""Config loading — layered defaults < global < workspace."""

from __future__ import annotations

from pathlib import Path

from coworker.config import load_config


def test_defaults_when_no_files(tmp_path):
    cfg = load_config(global_path=tmp_path / "nope.toml")
    assert cfg.model == "gpt-5.6-sol"
    assert cfg.mode == "interactive"
    assert cfg.max_iterations == 150
    assert "pytest" in cfg.allowed_commands


def test_global_and_workspace_override(tmp_path):
    g = tmp_path / "global.toml"
    g.write_text('model = "gpt-4o"\nmax_iterations = 20\nport = 9000\n')
    ws = tmp_path / "ws"
    (ws / ".coworker").mkdir(parents=True)
    (ws / ".coworker" / "config.toml").write_text(
        'max_iterations = 30\nmode = "plan"\n'
    )

    cfg = load_config(ws, global_path=g)
    assert cfg.model == "gpt-4o"  # from global
    assert cfg.port == 9000  # from global
    assert cfg.max_iterations == 30  # workspace overrides global
    assert cfg.mode == "plan"  # from workspace


def test_build_engine_respects_max_iterations(tmp_path):
    (tmp_path / ".coworker").mkdir()
    (tmp_path / ".coworker" / "config.toml").write_text("max_iterations = 3\n")

    from coworker.agent import build_code_engine

    class _Stub:
        def complete(self, **k):  # pragma: no cover
            raise NotImplementedError

        def capabilities(self, m):  # pragma: no cover
            raise NotImplementedError

    engine = build_code_engine(workspace=tmp_path, provider=_Stub())
    try:
        assert engine.max_iterations == 3
    finally:
        engine.executor.close()


def test_cloud_endpoints_default_to_production():
    """A fresh install must work without a hand-edited config.toml. An empty
    relay default shipped once as "connected but relay OFF" on every machine
    but the developer's — the managed install succeeded (HTTPS via broker)
    while inbound relaying silently never started."""
    from coworker.config import Config

    cfg = Config()
    assert cfg.cloud_base_url == "https://api.openworker.com"
    assert cfg.cloud_relay_ws_url.startswith("wss://")
