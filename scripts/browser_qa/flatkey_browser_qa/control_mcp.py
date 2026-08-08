import json
import os
import sys
import tempfile
import time
import urllib.parse
import urllib.request

from .mcp import McpServer
from .mcp import Tool
from .mcp import ToolExecutionError
from .mcp import run_jsonrpc_server


STATE_FILE_NAME = "control_state.json"
CHECKPOINT_RESERVATION_FILE_NAME = ".control_replay_checkpoint.lock"
_ENV_RUNTIME_DIR = "FLATKEY_BROWSER_QA_RUNTIME_DIR"
_ENV_MODE = "FLATKEY_BROWSER_QA_MODE"
_ENV_EVIDENCE_URL = "FLATKEY_BROWSER_QA_RUNTIME_EVIDENCE_URL"


def run(
    stdin=None,
    stdout=None,
    *,
    env=None,
    clock=None,
    max_line_bytes=1024 * 1024,
    evidence_notifier=None,
):
    stdin = stdin or sys.stdin
    stdout = stdout or sys.stdout
    env = env or os.environ
    clock = clock or time
    runtime_dir = env.get(_ENV_RUNTIME_DIR)
    mode = env.get(_ENV_MODE, "normal")
    notifier = evidence_notifier or _evidence_notifier_from_env(env)
    server = McpServer(
        "flatkey-browser-qa-control",
        [
            Tool(
                "qa_replay_checkpoint",
                "Mark the replay checkpoint as complete.",
                lambda: _replay_checkpoint(runtime_dir, clock, notifier),
            ),
            Tool("qa_start_exploration", "Start the limited exploration phase.", lambda: _start_exploration(runtime_dir, clock, mode)),
        ],
    )
    run_jsonrpc_server(stdin, stdout, server, max_line_bytes=max_line_bytes)


def _start_exploration(runtime_dir, clock, mode):
    if mode == "core":
        raise ToolExecutionError("core mode forbids exploration")
    if mode != "normal":
        raise ToolExecutionError("control mode unavailable")
    state = read_control_state(runtime_dir)
    if state is None or state.get("phase") != "replay_checkpoint":
        raise ToolExecutionError("exploration requires replay checkpoint")
    return _mark(runtime_dir, "exploration", clock)


def _replay_checkpoint(runtime_dir, clock, notifier):
    if read_control_state(runtime_dir) is not None:
        raise ToolExecutionError("replay checkpoint already recorded")
    directory = _runtime_dir(runtime_dir)
    reservation_path = os.path.join(directory, CHECKPOINT_RESERVATION_FILE_NAME)
    _reserve_replay_checkpoint(reservation_path)
    try:
        notifier({"type": "replay_checkpoint"})
    except Exception as exc:
        _release_replay_checkpoint(reservation_path)
        raise ToolExecutionError("replay checkpoint baseline unavailable") from exc
    try:
        return _mark(runtime_dir, "replay_checkpoint", clock)
    finally:
        _release_replay_checkpoint(reservation_path)


def _reserve_replay_checkpoint(path):
    if os.path.lexists(path):
        if os.path.islink(path):
            raise ToolExecutionError("control state unavailable")
        raise ToolExecutionError("replay checkpoint already recorded")
    fd = None
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        os.write(fd, b"reserved")
    except FileExistsError as exc:
        raise ToolExecutionError("replay checkpoint already recorded") from exc
    except OSError as exc:
        raise ToolExecutionError("control state unavailable") from exc
    finally:
        if fd is not None:
            os.close(fd)
    _fsync_dir(os.path.dirname(path))


def _release_replay_checkpoint(path):
    try:
        if os.path.lexists(path) and not os.path.islink(path):
            os.unlink(path)
            _fsync_dir(os.path.dirname(path))
    except OSError:
        pass


def _mark(runtime_dir, phase, clock):
    state = {"phase": phase, "updated_at": int(clock.time())}
    if phase == "exploration":
        state["monotonic_started_at"] = float(clock.monotonic())
    write_control_state(runtime_dir, state)
    return {"status": "ok", "phase": phase}


def write_control_state(runtime_dir, state):
    directory = _runtime_dir(runtime_dir)
    state_path = os.path.join(directory, STATE_FILE_NAME)
    if os.path.lexists(state_path) and (os.path.islink(state_path) or not os.path.isfile(state_path)):
        raise ToolExecutionError("control state unavailable")
    raw = json.dumps(state, separators=(",", ":"), sort_keys=True).encode("utf-8")
    fd = None
    tmp_path = None
    try:
        fd, tmp_path = tempfile.mkstemp(prefix=".control_state.", suffix=".tmp", dir=directory)
        with os.fdopen(fd, "wb") as handle:
            fd = None
            handle.write(raw)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp_path, state_path)
        tmp_path = None
        _fsync_dir(directory)
    except OSError as exc:
        raise ToolExecutionError("control state unavailable") from exc
    finally:
        if fd is not None:
            os.close(fd)
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


def read_control_state(runtime_dir):
    directory = _runtime_dir(runtime_dir)
    state_path = os.path.join(directory, STATE_FILE_NAME)
    if not os.path.lexists(state_path):
        return None
    if os.path.islink(state_path) or not os.path.isfile(state_path):
        raise ToolExecutionError("control state unavailable")
    try:
        with open(state_path, encoding="utf-8") as handle:
            state = json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        raise ToolExecutionError("control state unavailable") from exc
    if not isinstance(state, dict) or state.get("phase") not in {"replay_checkpoint", "exploration"}:
        raise ToolExecutionError("control state unavailable")
    return state


def _evidence_notifier_from_env(env):
    url = env.get(_ENV_EVIDENCE_URL)
    if not url:
        return lambda _event: None
    parsed = urllib.parse.urlsplit(url)
    if (
        parsed.scheme != "http"
        or parsed.hostname not in {"127.0.0.1", "::1"}
        or parsed.port is None
        or parsed.username is not None
        or parsed.password is not None
        or parsed.path != "/runtime-evidence"
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError("runtime evidence endpoint is invalid")

    def notify(event):
        raw = json.dumps(event, separators=(",", ":"), sort_keys=True).encode("utf-8")
        request = urllib.request.Request(
            url,
            data=raw,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(request, timeout=10) as response:
            if getattr(response, "status", 204) != 204:
                raise RuntimeError("runtime evidence endpoint rejected checkpoint")

    return notify


def _runtime_dir(runtime_dir):
    if not isinstance(runtime_dir, str) or not runtime_dir:
        raise ToolExecutionError("control runtime missing")
    real = os.path.realpath(runtime_dir)
    if not os.path.isdir(real):
        raise ToolExecutionError("control runtime invalid")
    return real


def _fsync_dir(directory):
    if os.name == "nt":
        return
    fd = os.open(directory, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


if __name__ == "__main__":
    run()
