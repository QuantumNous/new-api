import importlib.util
import io
import json
import pathlib
import threading
import time
import unittest
from unittest import mock


MODULE_PATH = (
    pathlib.Path(__file__).resolve().parents[1]
    / "retry-proxy"
    / "gpt56_retry_proxy.py"
)
DEPLOY_DIR = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("gpt56_retry_proxy", MODULE_PATH)
PROXY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PROXY)


class FakeStreamingResponse:
    status = 200
    headers = {"Content-Type": "text/event-stream"}

    def __init__(self, body):
        self.buffer = io.BytesIO(body)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False

    def readline(self):
        return self.buffer.readline()

    def read(self, size=-1):
        return self.buffer.read(size)

    def read1(self, size=-1):
        return self.buffer.read1(size)


class RetryProxyTests(unittest.TestCase):
    def setUp(self):
        self.original_attempts = PROXY.ProxyConfig.attempts
        self.original_backoff = PROXY.ProxyConfig.backoff
        self.original_upstream = PROXY.ProxyConfig.upstream
        self.original_slots = PROXY.ProxyConfig.upstream_slots

    def tearDown(self):
        PROXY.ProxyConfig.attempts = self.original_attempts
        PROXY.ProxyConfig.backoff = self.original_backoff
        PROXY.ProxyConfig.upstream = self.original_upstream
        PROXY.ProxyConfig.upstream_slots = self.original_slots

    def test_detects_response_failed_sse_event(self):
        body = (
            b'data: {"type":"response.created"}\n\n'
            b'data: {"type":"response.failed","response":{"output":[]}}\n\n'
        )
        self.assertTrue(PROXY.is_response_failed(body))

    def test_ignores_success_and_malformed_sse_events(self):
        body = b'data: not-json\n\ndata: {"type":"response.completed"}\n\n'
        self.assertFalse(PROXY.is_response_failed(body))

    def test_detects_structured_error_event(self):
        body = b'data: {"type":"error","error":{"message":"failed"}}\n\n'
        self.assertTrue(PROXY.is_response_failed(body))

    def test_stream_flag_requires_json_boolean_true(self):
        self.assertTrue(PROXY.RetryProxyHandler.is_streaming_request(b'{"stream":true}'))
        self.assertFalse(PROXY.RetryProxyHandler.is_streaming_request(b'{"stream":"true"}'))
        self.assertFalse(PROXY.RetryProxyHandler.is_streaming_request(b'not-json'))

    def test_management_http_methods_are_forwarded(self):
        for method in ("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"):
            self.assertTrue(callable(getattr(PROXY.RetryProxyHandler, f"do_{method}")))

    def test_non_streaming_response_failed_is_retried(self):
        handler = mock.Mock()
        handler.request_upstream.side_effect = [
            (
                200,
                {"Content-Type": "text/event-stream"},
                b'data: {"type":"response.failed"}\n\n',
            ),
            (200, {"Content-Type": "application/json"}, b'{"status":"completed"}'),
        ]
        PROXY.ProxyConfig.attempts = 3
        PROXY.ProxyConfig.backoff = 0

        PROXY.RetryProxyHandler.forward_with_retry(handler, b'{}')

        self.assertEqual(handler.request_upstream.call_count, 2)
        handler.send_upstream_response.assert_called_once_with(
            200,
            {"Content-Type": "application/json"},
            b'{"status":"completed"}',
        )

    def test_retryable_http_status_is_retried(self):
        handler = mock.Mock()
        handler.request_upstream.side_effect = [
            (503, {"Content-Type": "application/json"}, b'{"error":"busy"}'),
            (200, {"Content-Type": "application/json"}, b'{"status":"completed"}'),
        ]
        PROXY.ProxyConfig.attempts = 3
        PROXY.ProxyConfig.backoff = 0

        PROXY.RetryProxyHandler.forward_with_retry(handler, b'{}')

        self.assertEqual(handler.request_upstream.call_count, 2)
        handler.send_upstream_response.assert_called_once_with(
            200,
            {"Content-Type": "application/json"},
            b'{"status":"completed"}',
        )

    def test_streaming_response_failed_before_output_is_retried(self):
        failed = FakeStreamingResponse(
            b'data: {"type":"response.created"}\n\n'
            b'data: {"type":"response.failed","response":{"output":[]}}\n\n'
        )
        succeeded = FakeStreamingResponse(
            b'data: {"type":"response.created"}\n\n'
            b'data: {"type":"response.in_progress"}\n\n'
            b'data: {"type":"response.output_text.delta","delta":"OK"}\n\n'
            b'data: {"type":"response.completed"}\n\n'
        )
        handler = self.make_streaming_handler()
        PROXY.ProxyConfig.attempts = 2
        PROXY.ProxyConfig.backoff = 0
        PROXY.ProxyConfig.upstream_slots = threading.BoundedSemaphore(1)

        with mock.patch.object(
            PROXY.urllib.request,
            "urlopen",
            side_effect=[failed, succeeded],
        ) as urlopen:
            PROXY.RetryProxyHandler.forward_streaming(handler, b'{"stream":true}')

        self.assertEqual(urlopen.call_count, 2)
        handler.send_stream_headers.assert_called_once()
        output = handler.wfile.getvalue()
        self.assertNotIn(b"response.failed", output)
        self.assertEqual(output.count(b"response.created"), 1)
        self.assertIn(b"response.output_text.delta", output)

    def test_streaming_success_commits_once_output_begins(self):
        response = FakeStreamingResponse(
            b': keep-alive\n\n'
            b'data: {"type":"response.created"}\n\n'
            b'data: {"type":"response.output_text.delta","delta":"OK"}\n\n'
            b'data: {"type":"response.completed"}\n\n'
        )
        handler = self.make_streaming_handler()
        PROXY.ProxyConfig.attempts = 2
        PROXY.ProxyConfig.upstream_slots = threading.BoundedSemaphore(1)

        with mock.patch.object(PROXY.urllib.request, "urlopen", return_value=response) as urlopen:
            PROXY.RetryProxyHandler.forward_streaming(handler, b'{"stream":true}')

        urlopen.assert_called_once()
        handler.send_stream_headers.assert_called_once()
        self.assertEqual(handler.wfile.getvalue(), response.buffer.getvalue())

    def test_responses_requests_respect_upstream_concurrency(self):
        handler = object.__new__(PROXY.RetryProxyHandler)
        handler.command = "POST"
        handler.path = "/v1/responses"
        handler.headers = {}
        PROXY.ProxyConfig.upstream = "http://upstream.test"
        PROXY.ProxyConfig.upstream_slots = threading.BoundedSemaphore(1)

        state_lock = threading.Lock()
        active = 0
        peak = 0

        class FakeResponse:
            status = 200
            headers = {}

            def __enter__(self):
                nonlocal active, peak
                with state_lock:
                    active += 1
                    peak = max(peak, active)
                time.sleep(0.03)
                return self

            def __exit__(self, exc_type, exc_value, traceback):
                nonlocal active
                with state_lock:
                    active -= 1

            def read(self):
                return b'{}'

        with mock.patch.object(PROXY.urllib.request, "urlopen", side_effect=lambda *a, **k: FakeResponse()):
            threads = [
                threading.Thread(target=handler.request_upstream_path, args=(handler.path, b'{}'))
                for _ in range(4)
            ]
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join()

        self.assertEqual(peak, 1)

    def make_streaming_handler(self):
        handler = object.__new__(PROXY.RetryProxyHandler)
        handler.command = "POST"
        handler.path = "/v1/responses"
        handler.headers = {}
        handler.wfile = io.BytesIO()
        handler.send_stream_headers = mock.Mock()
        handler.send_upstream_response = mock.Mock()
        handler.log_message = mock.Mock()
        PROXY.ProxyConfig.upstream = "http://upstream.test"
        return handler


class ChannelOverrideProfileTests(unittest.TestCase):
    def load_profile(self, name):
        path = DEPLOY_DIR / "channel-overrides" / name
        return json.loads(path.read_text(encoding="utf-8"))

    def test_azure_profile_matches_confirmed_sampling_compatibility(self):
        profile = self.load_profile("azure-gpt-5.6-sol.json")
        operations = profile["operations"]

        self.assertEqual(
            {(operation["path"], operation["mode"]) for operation in operations},
            {("temperature", "delete"), ("top_p", "delete")},
        )
        for operation in operations:
            self.assertEqual(operation["logic"], "OR")
            self.assertEqual(
                {condition["value"] for condition in operation["conditions"]},
                {"gpt-5.6-sol"},
            )

    def test_fable_profile_contains_all_production_rules(self):
        profile = self.load_profile("claude-fable-5.json")
        operations = profile["operations"]

        delete_paths = {
            operation["path"]
            for operation in operations
            if operation["mode"] == "delete"
        }
        max_token_operations = [
            operation
            for operation in operations
            if operation["path"] == "max_tokens" and operation["mode"] == "set"
        ]
        self.assertEqual(delete_paths, {"temperature", "top_p", "top_k"})
        self.assertEqual(len(max_token_operations), 2)
        self.assertTrue(all(operation["value"] == 512 for operation in max_token_operations))
        self.assertEqual(
            {
                operation["conditions"][0]["path"]
                for operation in max_token_operations
            },
            {"model", "original_model"},
        )

    def test_sql_maps_all_production_channels_to_the_correct_profile(self):
        sql = (DEPLOY_DIR / "sql" / "channel_param_compatibility.sql").read_text(
            encoding="utf-8"
        )

        for channel_name in (
            "AWS-B",
            "0718-OR",
            "az-ch0718",
            "07-19-AZ-COLIN-OF-001",
        ):
            self.assertIn(channel_name, sql)
        self.assertIn(
            "WHEN name IN ('AWS-B', '0718-OR') THEN :'fable_override'",
            sql,
        )
        self.assertIn(
            "WHEN name IN ('az-ch0718', '07-19-AZ-COLIN-OF-001') "
            "THEN :'azure_override'",
            sql,
        )


if __name__ == "__main__":
    unittest.main()
