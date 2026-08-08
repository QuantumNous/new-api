import io
import json
import os
import subprocess
import signal
import sys
import tempfile
import threading
import time
import ctypes
from ctypes import wintypes
import unittest

from scripts.browser_qa.flatkey_browser_qa.budget import ExplorationBudget
from scripts.browser_qa.flatkey_browser_qa import mcp_budget_wrapper
from scripts.browser_qa.flatkey_browser_qa import supervisor


class FakeClock:
    def __init__(self):
        self.now = 100.0

    def monotonic(self):
        return self.now

    def advance(self, seconds):
        self.now += seconds


class FakeChild:
    def __init__(self, *, wait_timeout_once=False):
        self.stdin = io.StringIO()
        self.stdout = io.StringIO()
        self.stderr = io.StringIO()
        self.terminated = False
        self.killed = False
        self.waited = False
        self.wait_timeout_once = wait_timeout_once
        self.wait_calls = 0

    def terminate(self):
        self.terminated = True

    def wait(self, timeout=None):
        self.wait_calls += 1
        self.waited = True
        if self.wait_timeout_once and self.wait_calls == 1:
            raise subprocess.TimeoutExpired("fake-child", timeout)
        return 0

    def kill(self):
        self.killed = True


class RecordingTreeTerminator:
    def __init__(self):
        self.terminated = []
        self.killed = []

    def terminate_tree(self, child):
        self.terminated.append(child)
        child.terminate()

    def kill_tree(self, child):
        self.killed.append(child)
        child.kill()

    def close(self):
        return None


class SlowWriter:
    def __init__(self):
        self.value = ""

    def write(self, text):
        for char in text:
            current = self.value
            time.sleep(0.001)
            self.value = current + char

    def flush(self):
        return None


class SignalingStringIO(io.StringIO):
    def __init__(self):
        super().__init__()
        self.written = threading.Event()

    def write(self, text):
        result = super().write(text)
        self.written.set()
        return result


class NoNewlineStream:
    def __init__(self, text):
        self.text = text
        self.offset = 0

    def read(self, size=-1):
        if self.offset >= len(self.text):
            return ""
        if size is None or size < 0:
            size = len(self.text) - self.offset
        end = min(len(self.text), self.offset + size)
        chunk = self.text[self.offset:end]
        self.offset = end
        return chunk

    def readline(self, size=-1):
        return self.read(size)


def frame(payload):
    return json.dumps(payload) + "\n"


def call_frame(identifier):
    return frame({"jsonrpc": "2.0", "id": identifier, "method": "tools/call", "params": {"name": "browser_click", "arguments": {}}})


class WrapperContractTests(unittest.TestCase):
    def make_wrapper(self, runtime_dir, child, *, clock=None, terminator=None, mode="normal"):
        return mcp_budget_wrapper.BudgetedMcpWrapper(
            runtime_dir,
            child=child,
            clock=clock or FakeClock(),
            tree_terminator=terminator or RecordingTreeTerminator(),
            mode=mode,
        )

    def test_child_command_attaches_to_supervisor_cdp_endpoint_and_keeps_temp_output_in_runtime(self):
        with tempfile.TemporaryDirectory() as runtime_dir:
            command = mcp_budget_wrapper.playwright_child_command(runtime_dir, cdp_endpoint="http://127.0.0.1:9222")

            self.assertEqual(command[0], "/usr/local/bin/playwright-mcp")
            self.assertNotIn("npx", command)
            self.assertNotIn("-y", command)
            self.assertTrue(all("@playwright/mcp" not in item for item in command))
            self.assertNotIn("--browser", command)
            self.assertNotIn("chromium", command)
            self.assertNotIn("--headless", command)
            self.assertIn("--cdp-timeout", command)
            self.assertEqual(command[command.index("--cdp-timeout") + 1], "30000")
            self.assertIn("--cdp-endpoint", command)
            self.assertEqual(command[command.index("--cdp-endpoint") + 1], "http://127.0.0.1:9222")
            self.assertNotIn("--proxy-server", command)
            self.assertNotIn("--proxy-bypass", command)
            self.assertNotIn("--block-service-workers", command)
            self.assertNotIn("--config", command)
            self.assertNotIn("--endpoint", command)
            self.assertNotIn("--extension", command)
            self.assertNotIn("--device", command)
            self.assertNotIn("--mobile", command)
            output_dir = command[command.index("--output-dir") + 1]
            self.assertTrue(os.path.realpath(output_dir).startswith(os.path.realpath(runtime_dir) + os.sep))
            self.assertNotIn("@latest", command)
            self.assertIs(mcp_budget_wrapper.SUBPROCESS_SHELL, False)

    def test_wrapper_forwards_complete_pipe_frame_before_eof(self):
        with tempfile.TemporaryDirectory() as runtime_dir:
            read_fd, write_fd = os.pipe()
            client_input = os.fdopen(read_fd, "r", encoding="utf-8")
            client = os.fdopen(write_fd, "w", encoding="utf-8")
            child = FakeChild()
            child.stdin = SignalingStringIO()
            wrapper = self.make_wrapper(runtime_dir, child)
            thread = threading.Thread(
                target=wrapper.proxy_client_requests,
                args=(client_input, io.StringIO()),
                daemon=True,
            )
            thread.start()

            request = frame({"jsonrpc": "2.0", "id": "live", "method": "initialize", "params": {}})
            try:
                client.write(request)
                client.flush()
                self.assertTrue(child.stdin.written.wait(timeout=1), "initialize request waited for MCP stdin EOF")
            finally:
                client.close()
                thread.join(timeout=2)
                client_input.close()

            self.assertFalse(thread.is_alive())
            self.assertEqual(child.stdin.getvalue(), request)

    def test_child_command_requires_strict_loopback_http_cdp_endpoint_and_accepts_explicit_test_executable_only(self):
        with tempfile.TemporaryDirectory() as runtime_dir:
            with self.assertRaises(RuntimeError):
                mcp_budget_wrapper.playwright_child_command(runtime_dir)
            for cdp_endpoint in [
                "https://127.0.0.1:9222",
                "http://localhost:9222",
                "http://127.0.0.1",
                "http://127.0.0.1:0",
                "http://127.0.0.1:65536",
                "http://user:pass@127.0.0.1:9222",
                "http://127.0.0.1:9222/json",
                "http://127.0.0.1:9222?x=1",
                "http://127.0.0.1:9222#devtools",
            ]:
                with self.subTest(cdp_endpoint=cdp_endpoint):
                    with self.assertRaises(RuntimeError):
                        mcp_budget_wrapper.playwright_child_command(runtime_dir, cdp_endpoint=cdp_endpoint)

            command = mcp_budget_wrapper.playwright_child_command(
                runtime_dir,
                cdp_endpoint="http://127.0.0.1:9222",
                executable="/tmp/fake-playwright-mcp",
            )
            self.assertEqual(command[0], "/tmp/fake-playwright-mcp")

    def test_filename_arguments_for_readonly_browser_tools_are_rejected_without_forwarding(self):
        blocked_names = [
            "browser_snapshot",
            "browser_console_messages",
            "browser_network_requests",
            "browser_network_request",
        ]
        with tempfile.TemporaryDirectory() as runtime_dir:
            for name in blocked_names:
                with self.subTest(name=name):
                    child = FakeChild()
                    output = io.StringIO()
                    request = frame({
                        "jsonrpc": "2.0",
                        "id": name,
                        "method": "tools/call",
                        "params": {"name": name, "arguments": {"filename": "leak.txt"}},
                    })
                    wrapper = self.make_wrapper(runtime_dir, child)
                    wrapper.proxy_client_requests(io.StringIO(request), output)

                    self.assertEqual(child.stdin.getvalue(), "")
                    response = json.loads(output.getvalue().splitlines()[0])
                    self.assertEqual(response["id"], name)
                    self.assertEqual(response["error"]["code"], -32602)

            child = FakeChild()
            output = io.StringIO()
            allowed = frame({
                "jsonrpc": "2.0",
                "id": "safe",
                "method": "tools/call",
                "params": {"name": "browser_snapshot", "arguments": {}},
            })
            wrapper = self.make_wrapper(runtime_dir, child)
            wrapper.proxy_client_requests(io.StringIO(allowed), output)
            self.assertEqual(json.loads(child.stdin.getvalue())["id"], "safe")
            self.assertEqual(output.getvalue(), "")

    def test_wrapper_forwards_calls_before_marker_and_exactly_thirty_after_marker(self):
        clock = FakeClock()
        child = FakeChild()
        with tempfile.TemporaryDirectory() as runtime_dir:
            before = call_frame("before")
            after = "".join(call_frame(i) for i in range(1, 32))
            client_input = io.StringIO(before + after)
            client_output = io.StringIO()

            mcp_budget_wrapper.write_control_state(runtime_dir, {"phase": "replay_checkpoint"})
            wrapper = self.make_wrapper(runtime_dir, child, clock=clock)
            wrapper.proxy_client_requests(
                client_input,
                client_output,
                after_first_request=lambda: mcp_budget_wrapper.write_control_state(
                    runtime_dir, {"phase": "exploration", "monotonic_started_at": clock.monotonic()}
                ),
            )

            forwarded = child.stdin.getvalue().splitlines()
            self.assertEqual(len(forwarded), 31)
            self.assertEqual(json.loads(forwarded[0])["id"], "before")
            self.assertEqual(json.loads(forwarded[-1])["id"], 30)
            with open(os.path.join(runtime_dir, "control_state.json"), encoding="utf-8") as handle:
                state = json.load(handle)
            self.assertEqual(state["actions_used"], 30)
            budget_response = json.loads(client_output.getvalue().splitlines()[0])
            self.assertEqual(budget_response["id"], 31)
            self.assertEqual(budget_response["error"]["code"], -32001)
            self.assertIsInstance(wrapper.exploration_budget, ExplorationBudget)
            self.assertEqual(wrapper.exploration_budget.actions_consumed, 30)

    def test_core_mode_allows_browser_before_checkpoint_and_rejects_after_without_exploration_state(self):
        with tempfile.TemporaryDirectory() as runtime_dir:
            child = FakeChild()
            wrapper = self.make_wrapper(runtime_dir, child, mode="core")
            wrapper.proxy_client_requests(io.StringIO(call_frame("before-checkpoint")), io.StringIO())
            self.assertEqual(json.loads(child.stdin.getvalue())["id"], "before-checkpoint")

            mcp_budget_wrapper.write_control_state(runtime_dir, {"phase": "replay_checkpoint"})
            child = FakeChild()
            output = io.StringIO()
            wrapper = self.make_wrapper(runtime_dir, child, mode="core")
            wrapper.proxy_client_requests(io.StringIO(call_frame("after-checkpoint")), output)

            self.assertEqual(child.stdin.getvalue(), "")
            response = json.loads(output.getvalue().splitlines()[0])
            self.assertEqual(response["id"], "after-checkpoint")
            self.assertEqual(response["error"]["code"], -32001)
            self.assertIn("core", response["error"]["message"])
            with open(os.path.join(runtime_dir, "control_state.json"), encoding="utf-8") as state_file:
                state = json.load(state_file)
            self.assertEqual(state["phase"], "replay_checkpoint")
            self.assertNotIn("actions_used", state)

    def test_marker_time_not_first_action_starts_exploration_budget(self):
        clock = FakeClock()
        with tempfile.TemporaryDirectory() as runtime_dir:
            mcp_budget_wrapper.write_control_state(runtime_dir, {"phase": "exploration", "monotonic_started_at": clock.monotonic()})
            clock.advance(301)
            child = FakeChild()
            output = io.StringIO()

            wrapper = self.make_wrapper(runtime_dir, child, clock=clock)
            wrapper.proxy_client_requests(io.StringIO(call_frame("late-first-action")), output)

            self.assertEqual(json.loads(output.getvalue().splitlines()[0])["error"]["code"], -32001)
            self.assertEqual(child.stdin.getvalue(), "")

    def test_tools_call_notifications_are_silent_without_budget_or_forwarding_side_effects(self):
        with tempfile.TemporaryDirectory() as runtime_dir:
            mcp_budget_wrapper.write_control_state(runtime_dir, {"phase": "exploration", "monotonic_started_at": 100.0})
            child = FakeChild()
            notifications = "".join(
                frame({"jsonrpc": "2.0", "method": "tools/call", "params": {"name": "browser_click", "arguments": {}}})
                for _ in range(35)
            )

            wrapper = self.make_wrapper(runtime_dir, child)
            output = io.StringIO()
            wrapper.proxy_client_requests(io.StringIO(notifications), output)

            self.assertEqual(child.stdin.getvalue(), "")
            self.assertEqual(output.getvalue(), "")
            with open(os.path.join(runtime_dir, "control_state.json"), encoding="utf-8") as handle:
                self.assertEqual(json.load(handle).get("actions_used", 0), 0)

    def test_initialize_list_responses_and_notifications_do_not_consume_action_budget(self):
        clock = FakeClock()
        child = FakeChild()
        with tempfile.TemporaryDirectory() as runtime_dir:
            mcp_budget_wrapper.write_control_state(runtime_dir, {"phase": "exploration", "monotonic_started_at": clock.monotonic()})
            payloads = [
                {"jsonrpc": "2.0", "id": "init", "method": "initialize"},
                {"jsonrpc": "2.0", "method": "notifications/initialized"},
                {"jsonrpc": "2.0", "id": "list", "method": "tools/list"},
            ]
            client_input = io.StringIO("".join(frame(payload) for payload in payloads) + "".join(call_frame(i) for i in range(1, 31)))

            wrapper = self.make_wrapper(runtime_dir, child, clock=clock)
            wrapper.proxy_client_requests(client_input, io.StringIO())

            forwarded = child.stdin.getvalue().splitlines()
            self.assertEqual(len(forwarded), 33)
            self.assertEqual(json.loads(forwarded[-1])["id"], 30)

    def test_tools_list_appends_docs_reader_and_docs_call_consumes_budget_without_forwarding(self):
        class DocsWrapper(mcp_budget_wrapper.BudgetedMcpWrapper):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                self.docs_calls = []

            def _request_docs_read(self, arguments):
                self.docs_calls.append(arguments)
                return {"url": arguments["url"], "status": 200, "text": "hello docs"}

        child = FakeChild()
        child.stdout = io.StringIO(frame({"jsonrpc": "2.0", "id": "list", "result": {"tools": [{"name": "browser_click"}]}}))
        with tempfile.TemporaryDirectory() as runtime_dir:
            mcp_budget_wrapper.write_control_state(runtime_dir, {"phase": "exploration", "monotonic_started_at": 100.0})
            wrapper = DocsWrapper(
                runtime_dir,
                child=child,
                clock=FakeClock(),
                tree_terminator=RecordingTreeTerminator(),
                runtime_evidence_url="http://127.0.0.1:1/runtime-evidence",
            )
            output = io.StringIO()
            wrapper.proxy_child_stdout(output)
            tools = json.loads(output.getvalue())["result"]["tools"]
            self.assertIn("qa_read_docs", [tool["name"] for tool in tools])

            output = io.StringIO()
            request = frame({
                "jsonrpc": "2.0",
                "id": "docs",
                "method": "tools/call",
                "params": {"name": "qa_read_docs", "arguments": {"url": "https://docs.flatkey.ai/quickstart"}},
            })
            wrapper._closed = False
            wrapper.proxy_client_requests(io.StringIO(request), output)

            self.assertEqual(child.stdin.getvalue(), "")
            response = json.loads(output.getvalue())
            self.assertEqual(response["id"], "docs")
            self.assertIn("hello docs", response["result"]["content"][0]["text"])
            self.assertEqual(wrapper.docs_calls, [{"url": "https://docs.flatkey.ai/quickstart"}])
            with open(os.path.join(runtime_dir, "control_state.json"), encoding="utf-8") as handle:
                self.assertEqual(json.load(handle)["actions_used"], 1)

    def test_no_id_docs_tool_call_notification_is_silent_and_has_no_side_effects(self):
        class DocsWrapper(mcp_budget_wrapper.BudgetedMcpWrapper):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                self.docs_calls = []

            def _request_docs_read(self, arguments):
                self.docs_calls.append(arguments)
                return {"url": arguments["url"], "status": 200, "text": "hello docs"}

        child = FakeChild()
        with tempfile.TemporaryDirectory() as runtime_dir:
            mcp_budget_wrapper.write_control_state(runtime_dir, {"phase": "exploration", "monotonic_started_at": 100.0})
            wrapper = DocsWrapper(
                runtime_dir,
                child=child,
                clock=FakeClock(),
                tree_terminator=RecordingTreeTerminator(),
                runtime_evidence_url="http://127.0.0.1:1/runtime-evidence",
            )
            output = io.StringIO()
            request = frame({
                "jsonrpc": "2.0",
                "method": "tools/call",
                "params": {"name": "qa_read_docs", "arguments": {"url": "https://docs.flatkey.ai/quickstart"}},
            })
            wrapper.proxy_client_requests(io.StringIO(request), output)

            self.assertEqual(output.getvalue(), "")
            self.assertEqual(child.stdin.getvalue(), "")
            self.assertEqual(wrapper.docs_calls, [])
            with open(os.path.join(runtime_dir, "control_state.json"), encoding="utf-8") as handle:
                self.assertEqual(json.load(handle).get("actions_used", 0), 0)

    def test_time_cutoff_state_parse_failure_client_parse_failure_and_child_protocol_parse_failure_fail_closed(self):
        clock = FakeClock()
        child = FakeChild()
        with tempfile.TemporaryDirectory() as runtime_dir:
            mcp_budget_wrapper.write_control_state(runtime_dir, {"phase": "exploration", "monotonic_started_at": clock.monotonic()})
            wrapper = self.make_wrapper(runtime_dir, child, clock=clock)
            wrapper.proxy_client_requests(io.StringIO(call_frame("start")), io.StringIO())
            clock.advance(301)
            child = FakeChild()
            wrapper.child = child
            wrapper._closed = False
            output = io.StringIO()
            wrapper.proxy_client_requests(io.StringIO(call_frame("late")), output)
            self.assertEqual(json.loads(output.getvalue().splitlines()[0])["error"]["code"], -32001)
            self.assertEqual(child.stdin.getvalue(), "")

        with tempfile.TemporaryDirectory() as runtime_dir:
            with open(os.path.join(runtime_dir, "control_state.json"), "w", encoding="utf-8") as state_file:
                state_file.write("{partial")
            child = FakeChild()
            wrapper = self.make_wrapper(runtime_dir, child)
            output = io.StringIO()
            wrapper.proxy_client_requests(io.StringIO(call_frame("bad-state")), output)
            self.assertEqual(json.loads(output.getvalue().splitlines()[0])["error"]["code"], -32001)
            self.assertEqual(child.stdin.getvalue(), "")

        with tempfile.TemporaryDirectory() as runtime_dir:
            child = FakeChild()
            wrapper = self.make_wrapper(runtime_dir, child)
            output = io.StringIO()
            wrapper.proxy_client_requests(io.StringIO("{bad-json}\n"), output)
            self.assertEqual(json.loads(output.getvalue().splitlines()[0])["error"]["code"], -32700)
            self.assertTrue(child.terminated)

        for payload in ["\"string\"", "[]", "{\"jsonrpc\":\"1.0\",\"id\":1,\"method\":\"tools/list\"}", "{\"id\":1,\"method\":\"tools/list\"}"]:
            with self.subTest(payload=payload):
                with tempfile.TemporaryDirectory() as runtime_dir:
                    child = FakeChild()
                    wrapper = self.make_wrapper(runtime_dir, child)
                    output = io.StringIO()
                    wrapper.proxy_client_requests(io.StringIO(payload + "\n"), output)
                    self.assertEqual(json.loads(output.getvalue().splitlines()[0])["error"]["code"], -32600)
                    self.assertEqual(child.stdin.getvalue(), "")
                    self.assertTrue(child.terminated)

        with tempfile.TemporaryDirectory() as runtime_dir:
            child = FakeChild()
            wrapper = self.make_wrapper(runtime_dir, child)
            output = io.StringIO()
            wrapper.proxy_client_requests(NoNewlineStream("x" * (mcp_budget_wrapper.MAX_CLIENT_LINE_BYTES + 1)), output)
            self.assertEqual(child.stdin.getvalue(), "")
            self.assertTrue(child.terminated)

        with tempfile.TemporaryDirectory() as runtime_dir:
            bad_child_frames = ["non-json", "\"string\"", "[]", "{}", "{\"jsonrpc\":\"1.0\",\"id\":1}"]
            for line in bad_child_frames:
                with self.subTest(child_stdout=line):
                    child = FakeChild()
                    child.stdout = io.StringIO(line + "\n")
                    wrapper = self.make_wrapper(runtime_dir, child)
                    output = io.StringIO()
                    wrapper.proxy_child_stdout(output)
                    self.assertEqual(output.getvalue(), "")
                    self.assertTrue(child.terminated)

            child = FakeChild()
            child.stdout = NoNewlineStream("x" * (mcp_budget_wrapper.MAX_CHILD_STDOUT_LINE_BYTES + 1))
            wrapper = self.make_wrapper(runtime_dir, child)
            output = io.StringIO()
            wrapper.proxy_child_stdout(output)
            self.assertEqual(output.getvalue(), "")
            self.assertTrue(child.terminated)

            child = FakeChild()
            child.stderr = NoNewlineStream("x" * (mcp_budget_wrapper.MAX_CHILD_STDERR_LINE_BYTES + 1))
            wrapper = self.make_wrapper(runtime_dir, child)
            output = io.StringIO()
            wrapper.proxy_child_stderr(output)
            self.assertEqual(output.getvalue(), "")
            self.assertTrue(child.terminated)

    def test_wrapper_posts_alias_restriction_only_from_failed_child_tool_response(self):
        marker = "管理员已启用邮箱地址别名限制，您的邮箱地址由于包含特殊符号而被拒绝。"
        redactor = supervisor.Redactor(email="owner+flatkey-qa-1-x@gmail.com")
        sink = supervisor.RuntimeEvidenceSink(redactor)
        sink.start()
        try:
            cases = [
                ({"jsonrpc": "2.0", "id": 1, "result": {"isError": True, "content": [{"type": "text", "text": marker}]}}, "alias_restriction"),
                ({"jsonrpc": "2.0", "id": 2, "result": {"isError": False, "content": [{"type": "text", "text": marker}]}}, None),
                ({"jsonrpc": "2.0", "id": 3, "result": {"isError": True, "content": [{"type": "text", "text": "arbitrary alias_restriction"}]}}, None),
            ]
            for payload, expected in cases:
                with self.subTest(expected=expected):
                    sink.runtime_classification = None
                    child = FakeChild()
                    child.stdout = io.StringIO(frame(payload))
                    with tempfile.TemporaryDirectory() as runtime_dir:
                        wrapper = self.make_wrapper(runtime_dir, child)
                        wrapper.runtime_evidence_url = sink.url
                        output = io.StringIO()
                        wrapper.proxy_child_stdout(output)
                    self.assertEqual(sink.runtime_classification, expected)
        finally:
            sink.stop()

    def test_eof_terminates_child_without_orphan(self):
        with tempfile.TemporaryDirectory() as runtime_dir:
            child = FakeChild()
            wrapper = self.make_wrapper(runtime_dir, child)
            wrapper.proxy_client_requests(io.StringIO(""), io.StringIO())
            self.assertTrue(child.terminated)
            self.assertTrue(child.waited)

    def test_parent_signal_terminates_child_without_orphan(self):
        with tempfile.TemporaryDirectory() as runtime_dir:
            child = FakeChild()
            wrapper = self.make_wrapper(runtime_dir, child)

            with self.assertRaises(SystemExit):
                wrapper.handle_parent_signal("TERM", None)

            self.assertTrue(child.terminated)
            self.assertTrue(child.waited)

    def test_terminate_kills_child_when_terminate_is_ignored(self):
        with tempfile.TemporaryDirectory() as runtime_dir:
            child = FakeChild(wait_timeout_once=True)
            terminator = RecordingTreeTerminator()
            wrapper = self.make_wrapper(runtime_dir, child, terminator=terminator)

            wrapper.terminate_child()

            self.assertTrue(child.terminated)
            self.assertTrue(child.killed)
            self.assertEqual(child.wait_calls, 2)
            self.assertEqual(terminator.terminated, [child])
            self.assertEqual(terminator.killed, [child])

    def test_client_stdout_writes_are_serialized_between_child_forward_and_budget_error(self):
        with tempfile.TemporaryDirectory() as runtime_dir:
            mcp_budget_wrapper.write_control_state(runtime_dir, {"phase": "exploration", "monotonic_started_at": 100.0})
            child = FakeChild()
            child.stdout = io.StringIO(frame({"jsonrpc": "2.0", "id": "child", "result": {"ok": True}}))
            writer = SlowWriter()
            wrapper = self.make_wrapper(runtime_dir, child)

            stdout_thread = threading.Thread(target=wrapper.proxy_child_stdout, args=(writer,))
            stdout_thread.start()
            wrapper.proxy_client_requests(io.StringIO("".join(call_frame(i) for i in range(31))), writer)
            stdout_thread.join(timeout=2)

            lines = writer.value.splitlines()
            self.assertEqual(len(lines), 2)
            self.assertTrue(all(json.loads(line)["jsonrpc"] == "2.0" for line in lines))

    def test_posix_containment_uses_saved_pgid_after_parent_exits(self):
        if os.name != "posix":
            self.skipTest("POSIX process-group regression")
        with tempfile.TemporaryDirectory() as runtime_dir:
            pid_file = os.path.join(runtime_dir, "grandchild.pid")
            code = (
                "import subprocess, sys, time; "
                f"p=subprocess.Popen([sys.executable,'-c','import time; time.sleep(60)']); "
                f"open({pid_file!r}, 'w').write(str(p.pid)); "
                "sys.exit(0)"
            )
            parent = subprocess.Popen([sys.executable, "-c", code], start_new_session=True)
            terminator = mcp_budget_wrapper.ProcessTreeTerminator.attach(parent)
            parent.wait(timeout=10)
            for _ in range(50):
                if os.path.exists(pid_file):
                    break
                time.sleep(0.1)
            with open(pid_file, encoding="utf-8") as handle:
                grandchild_pid = int(handle.read())

            terminator.terminate_tree(parent)
            deadline = time.time() + 10
            while time.time() < deadline and _pid_exists(grandchild_pid):
                time.sleep(0.1)
            if _pid_exists(grandchild_pid):
                terminator.kill_tree(parent)

            self.assertFalse(_pid_exists(grandchild_pid))

    def test_posix_containment_saves_pgid_before_shutdown(self):
        if os.name != "posix":
            self.skipTest("POSIX process-group contract")
        child = type("Child", (), {"pid": 4242})()
        original_getpgid = mcp_budget_wrapper.os.getpgid
        original_killpg = mcp_budget_wrapper.os.killpg
        calls = []
        try:
            mcp_budget_wrapper.os.getpgid = lambda pid: 4242
            terminator = mcp_budget_wrapper.ProcessTreeTerminator.attach(child)
            mcp_budget_wrapper.os.getpgid = lambda pid: (_ for _ in ()).throw(ProcessLookupError())
            mcp_budget_wrapper.os.killpg = lambda pgid, sig: calls.append((pgid, sig))

            terminator.terminate_tree(child)
            terminator.kill_tree(child)
        finally:
            mcp_budget_wrapper.os.getpgid = original_getpgid
            mcp_budget_wrapper.os.killpg = original_killpg

        self.assertEqual(calls, [(4242, mcp_budget_wrapper.signal.SIGTERM), (4242, mcp_budget_wrapper.signal.SIGKILL)])

    def test_windows_job_object_contract_assigns_and_closes_job(self):
        child = type("Child", (), {"_handle": 555})()
        kernel32 = FakeKernel32()

        containment = mcp_budget_wrapper.WindowsJobProcessContainment.attach(child, kernel32=kernel32)
        containment.terminate_tree(child)
        containment.kill_tree(child)

        self.assertEqual(kernel32.created, 1)
        self.assertEqual(kernel32.assigned, [(1001, 555)])
        self.assertEqual(kernel32.closed, [1001])

    def test_windows_job_object_assignment_failure_fails_closed(self):
        child = type("Child", (), {"_handle": 555})()
        kernel32 = FakeKernel32(assign_result=0)

        with self.assertRaises(RuntimeError):
            mcp_budget_wrapper.WindowsJobProcessContainment.attach(child, kernel32=kernel32)

    def test_real_windows_kernel32_job_prototypes_are_declared(self):
        if os.name != "nt":
            self.skipTest("Windows kernel32 ABI contract")

        kernel32 = mcp_budget_wrapper._kernel32()

        self.assertEqual(kernel32.CreateJobObjectW.argtypes, [wintypes.LPVOID, wintypes.LPCWSTR])
        self.assertEqual(kernel32.CreateJobObjectW.restype, wintypes.HANDLE)
        self.assertEqual(kernel32.SetInformationJobObject.argtypes, [wintypes.HANDLE, ctypes.c_int, wintypes.LPVOID, wintypes.DWORD])
        self.assertEqual(kernel32.SetInformationJobObject.restype, wintypes.BOOL)
        self.assertEqual(kernel32.AssignProcessToJobObject.argtypes, [wintypes.HANDLE, wintypes.HANDLE])
        self.assertEqual(kernel32.AssignProcessToJobObject.restype, wintypes.BOOL)
        self.assertEqual(kernel32.CloseHandle.argtypes, [wintypes.HANDLE])
        self.assertEqual(kernel32.CloseHandle.restype, wintypes.BOOL)
        self.assertEqual(kernel32.GetLastError.argtypes, [])
        self.assertEqual(kernel32.GetLastError.restype, wintypes.DWORD)

    def test_launch_wrapper_attach_failure_uses_tree_fallback_before_raise(self):
        with tempfile.TemporaryDirectory() as runtime_dir:
            child = FakeChild()
            child.pid = 4321
            taskkill_calls = []
            killpg_calls = []

            def popen_factory(*_args, **_kwargs):
                return child

            def fail_attach(_child):
                raise RuntimeError("attach failed")

            def fake_run(command, **kwargs):
                taskkill_calls.append((command, kwargs))
                return subprocess.CompletedProcess(command, 0)

            def fake_killpg(pgid, sig):
                killpg_calls.append((pgid, sig))

            with self.assertRaises(RuntimeError):
                mcp_budget_wrapper.launch_wrapper(
                    runtime_dir,
                    popen_factory=popen_factory,
                tree_attach=fail_attach,
                subprocess_run=fake_run,
                killpg=fake_killpg,
                proxy_url="http://127.0.0.1:4567",
                cdp_endpoint="http://127.0.0.1:9222",
            )

            if os.name == "nt":
                self.assertEqual(taskkill_calls[0][0], ["taskkill", "/PID", "4321", "/T", "/F"])
                self.assertFalse(child.killed)
            else:
                self.assertEqual(killpg_calls, [(4321, signal.SIGKILL)])

    def test_playwright_child_popen_uses_minimal_env_without_codex_or_runtime_evidence(self):
        with tempfile.TemporaryDirectory() as runtime_dir:
            child = FakeChild()
            child.pid = 1234
            calls = []

            def popen_factory(*args, **kwargs):
                calls.append((args, kwargs))
                return child

            wrapper = mcp_budget_wrapper.launch_wrapper(
                runtime_dir,
                popen_factory=popen_factory,
                tree_attach=lambda _child: RecordingTreeTerminator(),
                cdp_endpoint="http://127.0.0.1:9222",
                parent_env={
                    "PATH": "/bin",
                    "CODEX_API_KEY": "sk-secretSECRET",
                    "FLATKEY_BROWSER_QA_RUNTIME_EVIDENCE_URL": "http://127.0.0.1:1/runtime-evidence",
                    "HTTP_PROXY": "http://proxy.invalid",
                },
            )

            child_env = calls[0][1]["env"]
            self.assertEqual(child_env, {"PATH": "/bin"})
            self.assertEqual(wrapper.runtime_evidence_url, "http://127.0.0.1:1/runtime-evidence")


class FakeKernel32:
    def __init__(self, *, assign_result=1):
        self.assign_result = assign_result
        self.created = 0
        self.assigned = []
        self.closed = []
        self.last_error = 5

    def CreateJobObjectW(self, _security, _name):
        self.created += 1
        return 1001

    def SetInformationJobObject(self, _job, _info_class, _info, _length):
        return 1

    def AssignProcessToJobObject(self, job, process_handle):
        self.assigned.append((job, process_handle))
        return self.assign_result

    def CloseHandle(self, handle):
        self.closed.append(handle)
        return 1

    def GetLastError(self):
        return self.last_error


def _pid_exists(pid):
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


if __name__ == "__main__":
    unittest.main()
