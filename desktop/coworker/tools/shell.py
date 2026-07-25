"""Persistent shell behind an `Executor` boundary.

`LocalExecutor` keeps one long-lived shell process, so `cd`, `export`, activated venvs,
etc. persist across `run_shell` calls (unlike a per-call `subprocess.run`). The `Executor`
interface is the hedge for a future `ContainerExecutor`/`VMExecutor` (sandboxing) without
touching the engine.

The shell is OS-native: `/bin/bash` on POSIX, `powershell.exe` (`-Command -` REPL) on
Windows. Each backend has its own marker/exit-code protocol and interrupt mechanism, but
the `Executor` contract (and the parsed `{marker} {exit_code} {cwd}` trailer) is identical.

Safety here is permission-gating (high-risk tool → approval) + per-command timeout +
best-effort non-interactive enforcement. A timed-out command is interrupted (SIGINT to the
foreground child on POSIX, Ctrl-Break to the child group on Windows); the shell survives so
session state is preserved.

Background tasks (`run_shell` with `run_in_background`) get their own detached process —
NOT the persistent shell — so a dev server can run while the session keeps working. They
are deliberately not killed by `close()` (which the timeout-recovery path calls); they end
when they exit or via `shell_task_kill`.
"""

from __future__ import annotations

import os
import queue
import signal
import subprocess
import sys
import threading
import time
import uuid
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Optional

import aisuite as ai

_IS_WINDOWS = sys.platform == "win32"

# Foreground timeout bounds: long enough for installs/builds/test runs by default, capped so
# a model-requested timeout can't wedge the turn for more than ten minutes.
_DEFAULT_TIMEOUT = 120.0
_MAX_TIMEOUT = 600.0

# Env defaults that discourage commands from blocking on a prompt.
_NONINTERACTIVE_ENV = {
    "GIT_TERMINAL_PROMPT": "0",
    "DEBIAN_FRONTEND": "noninteractive",
    "PYTHONUNBUFFERED": "1",
    "PIP_NO_INPUT": "1",
}


class Executor(ABC):
    @abstractmethod
    def run(self, command: str, timeout: Optional[float] = None) -> dict[str, Any]: ...

    def run_background(self, command: str) -> dict[str, Any]:
        return {"error": "background execution is not supported by this executor"}

    def background_output(self, task_id: str) -> dict[str, Any]:
        return {"error": "background execution is not supported by this executor"}

    def background_kill(self, task_id: str) -> dict[str, Any]:
        return {"error": "background execution is not supported by this executor"}

    def interrupt(self) -> None:  # pragma: no cover - default no-op
        pass

    def close(self) -> None:  # pragma: no cover - default no-op
        pass


class _BackgroundTask:
    """One detached background command: its own process (not the persistent shell), a
    reader thread draining output into a buffer, and an incremental-read cursor."""

    def __init__(self, task_id: str, command: str, cwd: str, env: dict[str, str]):
        self.id = task_id
        self.command = command
        if _IS_WINDOWS:
            argv = ["powershell.exe", "-NoProfile", "-Command", command]
            spawn_kwargs: dict[str, Any] = {
                "creationflags": subprocess.CREATE_NEW_PROCESS_GROUP
            }
        else:
            argv = ["/bin/bash", "-c", command]
            spawn_kwargs = {"start_new_session": True}
        self.proc = subprocess.Popen(
            argv,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            cwd=cwd,
            text=True,
            bufsize=1,
            env=env,
            **spawn_kwargs,
        )
        self._lock = threading.Lock()
        self._lines: list[str] = []
        self._cursor = 0
        self._reader = threading.Thread(target=self._read_loop, daemon=True)
        self._reader.start()

    def _read_loop(self) -> None:
        assert self.proc.stdout is not None
        for line in self.proc.stdout:
            with self._lock:
                self._lines.append(line)

    def read_new(self) -> str:
        with self._lock:
            new = "".join(self._lines[self._cursor :])
            self._cursor = len(self._lines)
        return new

    def kill(self) -> None:
        if self.proc.poll() is not None:
            return
        if _IS_WINDOWS:
            try:
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(self.proc.pid)],
                    capture_output=True,
                )
            except (OSError, subprocess.SubprocessError):
                pass
            return
        try:
            os.killpg(os.getpgid(self.proc.pid), signal.SIGTERM)
        except (ProcessLookupError, PermissionError, OSError):
            pass


class LocalExecutor(Executor):
    def __init__(
        self,
        *,
        cwd: str | Path,
        env: Optional[dict[str, str]] = None,
        shell_path: Optional[str] = None,
        default_timeout: float = _DEFAULT_TIMEOUT,
        max_output_chars: int = 20_000,
    ) -> None:
        self.cwd = str(Path(cwd).expanduser().resolve())
        self.default_timeout = default_timeout
        self.max_output_chars = max_output_chars
        self._marker = f"__COWORKER_DONE_{uuid.uuid4().hex}__"
        self._is_windows = _IS_WINDOWS
        self._bg_tasks: dict[str, _BackgroundTask] = {}
        self._bg_counter = 0
        # Set by interrupt_now() (user Stop) — run()'s read loop treats it like an
        # early deadline, so the in-flight foreground command dies within one tick.
        self._abort = threading.Event()

        # Pick a native shell per-OS. POSIX drives bash line-by-line; Windows drives
        # PowerShell in `-Command -` mode, which is a true stdin REPL (executes
        # incrementally, and cwd/env persist across commands).
        if shell_path is None:
            shell_path = "powershell.exe" if self._is_windows else "/bin/bash"
        self._shell_path = shell_path
        self._env = {**os.environ, **_NONINTERACTIVE_ENV, **(env or {})}
        self._spawn()

    def _spawn(self) -> None:
        """Start (or restart) the shell process and its reader. Reused for self-healing:
        if a command times out and the shell is hard-closed, the next `run` respawns here
        in the last known `cwd` (in-shell env/vars are lost, but the session continues).
        """
        if self._is_windows:
            argv = [
                self._shell_path,
                "-NoProfile",
                "-NoLogo",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                "-",
            ]
            # New process group so a timeout can deliver Ctrl-Break to the child (and only
            # the child), without signaling our own process.
            spawn_kwargs: dict[str, Any] = {
                "creationflags": subprocess.CREATE_NEW_PROCESS_GROUP
            }
        else:
            argv = [self._shell_path]
            spawn_kwargs = {"start_new_session": True}

        self._proc = subprocess.Popen(
            argv,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            cwd=self.cwd,
            text=True,
            bufsize=1,
            env=self._env,
            **spawn_kwargs,
        )
        self._queue: "queue.Queue[Optional[str]]" = queue.Queue()
        self._reader = threading.Thread(target=self._read_loop, daemon=True)
        self._reader.start()

        if self._is_windows and self._proc.stdin is not None:
            # Silence the REPL prompt so it never pollutes captured command output.
            self._proc.stdin.write("function prompt { '' }\n")
            self._proc.stdin.flush()

    def _read_loop(self) -> None:
        try:
            assert self._proc.stdout is not None
            for line in self._proc.stdout:
                self._queue.put(line)
        finally:
            self._queue.put(None)  # EOF sentinel

    def run(self, command: str, timeout: Optional[float] = None) -> dict[str, Any]:
        if self._proc.poll() is not None:
            # Shell exited (e.g. hard-closed after a prior command's timeout). Respawn so
            # the session self-heals rather than wedging every future command.
            self._spawn()
        if self._proc.stdin is None:
            return self._result(
                command, None, "", timed_out=False, error="shell not running"
            )

        timeout = timeout or self.default_timeout
        self._abort.clear()
        # Run the command, then emit a marker line with exit code + cwd.
        self._proc.stdin.write(command + "\n")
        self._proc.stdin.write(self._trailer())
        self._proc.stdin.flush()

        deadline = time.monotonic() + timeout
        interrupted = False
        timed_out = False
        aborted = False
        exit_code: Optional[int] = None
        lines: list[str] = []

        while True:
            if self._abort.is_set():
                # User Stop: reuse the deadline path this tick (interrupt-and-resync on
                # POSIX, decisive shell kill on Windows) instead of waiting out the timeout.
                aborted = True
                deadline = time.monotonic()
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                if self._is_windows:
                    # PowerShell has no reliable "interrupt one command, keep the REPL"
                    # primitive, so don't try to resync — kill the shell tree decisively.
                    # The next run() respawns in the last cwd (session continues).
                    timed_out = True
                    self.close()
                    break
                if not interrupted:
                    # First deadline: interrupt the running command and keep reading
                    # until ITS marker arrives, so the stream stays in sync for the
                    # next command. SIGINT makes the command exit and the trailer
                    # printf emit the marker.
                    interrupted = True
                    timed_out = True
                    self._interrupt()
                    deadline = time.monotonic() + 3.0  # grace to resync on the marker
                    continue
                # Grace expired and still no marker: the shell is wedged. Hard-kill
                # so future commands don't desync (session state is lost).
                self.close()
                break
            try:
                item = self._queue.get(timeout=min(remaining, 0.5))
            except queue.Empty:
                continue
            if item is None:
                break  # shell died
            if self._marker in item:
                exit_code = _parse_exit_code(item, self._marker)
                cwd = _parse_cwd(item, self._marker)
                if cwd:
                    self.cwd = cwd
                break
            lines.append(item)

        output = "".join(lines)
        truncated = len(output) > self.max_output_chars
        if truncated:
            # Keep the TAIL: builds and test runners put the verdict at the end.
            output = output[-self.max_output_chars :]
        return self._result(
            command,
            exit_code,
            output,
            timed_out=timed_out,
            truncated=truncated,
            error="interrupted by user" if aborted else None,
        )

    def interrupt_now(self) -> None:
        """User Stop: make an in-flight foreground `run()` bail on its next read tick
        (≤0.5s). Thread-safe; a no-op when nothing is running. Background tasks are
        left alone — they're explicitly fire-and-forget."""
        self._abort.set()

    # -- background tasks ---------------------------------------------------------
    def run_background(self, command: str) -> dict[str, Any]:
        self._bg_counter += 1
        task_id = f"bg-{self._bg_counter}"
        try:
            task = _BackgroundTask(task_id, command, self.cwd, self._env)
        except OSError as exc:
            return {"error": f"failed to start background task: {exc}"}
        self._bg_tasks[task_id] = task
        return {
            "task_id": task_id,
            "command": command,
            "status": "running",
            "note": "use shell_task_output to read its output, shell_task_kill to stop it",
        }

    def background_output(self, task_id: str) -> dict[str, Any]:
        task = self._bg_tasks.get(task_id)
        if task is None:
            return {"error": f"unknown task: {task_id}"}
        output = task.read_new()
        truncated = len(output) > self.max_output_chars
        if truncated:
            output = output[-self.max_output_chars :]
        exit_code = task.proc.poll()
        return {
            "task_id": task_id,
            "status": "running" if exit_code is None else "exited",
            "exit_code": exit_code,
            "output": output,
            "truncated": truncated,
        }

    def background_kill(self, task_id: str) -> dict[str, Any]:
        task = self._bg_tasks.get(task_id)
        if task is None:
            return {"error": f"unknown task: {task_id}"}
        task.kill()
        try:
            task.proc.wait(timeout=5)
        except (subprocess.TimeoutExpired, OSError):
            pass
        return {
            "task_id": task_id,
            "status": "running" if task.proc.poll() is None else "killed",
            "exit_code": task.proc.poll(),
        }

    def _trailer(self) -> str:
        """Command appended after each user command. Emits one line `<marker> <exit> <cwd>`
        parsed by `_parse_exit_code` / `_parse_cwd`. Reads the exit status of the *preceding*
        command, so it must run as its own statement right after it."""
        if self._is_windows:
            # PowerShell: `$?` is the success bool; `$LASTEXITCODE` is the exit code of the
            # last native program. Success → 0; else the program's code, falling back to 1.
            return (
                f'"`n{self._marker} '
                f"$(if ($?) {{0}} else {{ if ($LASTEXITCODE) {{$LASTEXITCODE}} else {{1}} }}) "
                f'$($PWD.Path)"\n'
            )
        return f'printf "\\n%s %s %s\\n" "{self._marker}" "$?" "$PWD"\n'

    def _interrupt(self) -> None:
        # Interrupt the running command, not the shell itself, so the session survives; the
        # queued trailer then emits the marker and the stream resyncs.
        if self._is_windows:
            # Ctrl-Break to the child's process group (best-effort). If the marker never
            # resyncs, run()'s grace timeout hard-closes the shell.
            try:
                self._proc.send_signal(signal.CTRL_BREAK_EVENT)
            except (OSError, ValueError):
                pass
            return
        try:
            found = subprocess.run(
                ["pgrep", "-P", str(self._proc.pid)],
                capture_output=True,
                text=True,
            )
            for pid in found.stdout.split():
                try:
                    os.kill(int(pid), signal.SIGINT)
                except (ProcessLookupError, ValueError, OSError):
                    pass
        except (FileNotFoundError, OSError):
            pass

    def interrupt(self) -> None:
        self._interrupt()

    def close(self) -> None:
        if self._is_windows:
            # Kill the whole tree — a timed-out command may have spawned children that
            # `terminate()` (the shell only) would orphan. Then reap so `poll()` reliably
            # reports the exit, which the next run()'s respawn check depends on.
            try:
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(self._proc.pid)],
                    capture_output=True,
                )
            except (OSError, subprocess.SubprocessError):
                pass
            try:
                self._proc.wait(timeout=5)
            except (subprocess.TimeoutExpired, OSError):
                pass
            return
        try:
            self._proc.terminate()
        except (ProcessLookupError, OSError):
            pass

    def _result(
        self, command, exit_code, output, *, timed_out, truncated=False, error=None
    ):
        result = {
            "command": command,
            "cwd": self.cwd,
            "exit_code": exit_code,
            "output": output,
            "timed_out": timed_out,
            "truncated": truncated,
        }
        if error:
            result["error"] = error
        return result


def _parse_exit_code(line: str, marker: str) -> Optional[int]:
    parts = line.strip().split()
    try:
        return int(parts[parts.index(marker) + 1])
    except (ValueError, IndexError):
        return None


def _parse_cwd(line: str, marker: str) -> Optional[str]:
    parts = line.strip().split()
    try:
        return " ".join(parts[parts.index(marker) + 2 :]) or None
    except (ValueError, IndexError):
        return None


_RUN_SHELL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "run_shell",
        "description": (
            "Run a shell command in the persistent session (cwd and env persist across "
            "calls). Output longer than the limit keeps the END (where test/build verdicts "
            "are). Set run_in_background for long-running processes like dev servers, then "
            "poll with shell_task_output."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "The command to run.",
                },
                "description": {
                    "type": "string",
                    "description": (
                        "Short human-readable summary of what the command does (e.g. "
                        "'Install dependencies'), shown in approval prompts and logs."
                    ),
                },
                "timeout_seconds": {
                    "type": "integer",
                    "description": (
                        f"Max seconds to wait (default {int(_DEFAULT_TIMEOUT)}, "
                        f"max {int(_MAX_TIMEOUT)}). Ignored for background tasks."
                    ),
                },
                "run_in_background": {
                    "type": "boolean",
                    "description": (
                        "Run detached and return a task_id immediately instead of waiting. "
                        "Use for servers, watchers, and very long builds."
                    ),
                },
            },
            "required": ["command"],
        },
    },
}

_TASK_OUTPUT_SCHEMA = {
    "type": "function",
    "function": {
        "name": "shell_task_output",
        "description": (
            "Read NEW output (since the last read) from a background task started with "
            "run_shell run_in_background=true, plus its status and exit code."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "task_id": {
                    "type": "string",
                    "description": "The task_id returned by run_shell.",
                }
            },
            "required": ["task_id"],
        },
    },
}

_TASK_KILL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "shell_task_kill",
        "description": "Stop a background task started with run_shell run_in_background=true.",
        "parameters": {
            "type": "object",
            "properties": {
                "task_id": {
                    "type": "string",
                    "description": "The task_id returned by run_shell.",
                }
            },
            "required": ["task_id"],
        },
    },
}


def shell_tools(executor: Executor) -> list:
    """Return the shell tools (`run_shell` + background-task helpers) bound to a
    persistent executor."""

    def run_shell(
        command: str,
        description: Optional[str] = None,
        timeout_seconds: Optional[int] = None,
        run_in_background: bool = False,
    ) -> dict:
        # `description` is not used here on purpose: it rides along in the call arguments
        # so approval prompts and the audit log can show intent, not just the raw command.
        if run_in_background:
            return executor.run_background(command)
        timeout = None
        if isinstance(timeout_seconds, (int, float)) and timeout_seconds > 0:
            timeout = min(float(timeout_seconds), _MAX_TIMEOUT)
        return executor.run(command, timeout=timeout)

    def shell_task_output(task_id: str) -> dict:
        return executor.background_output(task_id)

    def shell_task_kill(task_id: str) -> dict:
        return executor.background_kill(task_id)

    wrapped_run = ai.tool(
        run_shell,
        metadata=ai.ToolMetadata(
            category="shell",
            risk_level="high",
            capabilities=["run_command"],
            requires_approval=True,
        ),
    )
    wrapped_run.__coworker_schema__ = _RUN_SHELL_SCHEMA
    wrapped_output = ai.tool(
        shell_task_output,
        metadata=ai.ToolMetadata(
            category="shell",
            risk_level="low",
            capabilities=["run_command"],
            requires_approval=False,
        ),
    )
    wrapped_output.__coworker_schema__ = _TASK_OUTPUT_SCHEMA
    wrapped_kill = ai.tool(
        shell_task_kill,
        metadata=ai.ToolMetadata(
            category="shell",
            risk_level="low",
            capabilities=["run_command"],
            requires_approval=False,
        ),
    )
    wrapped_kill.__coworker_schema__ = _TASK_KILL_SCHEMA
    return [wrapped_run, wrapped_output, wrapped_kill]
