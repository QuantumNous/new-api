import importlib.util
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
SPEC = importlib.util.spec_from_file_location("gpt56_retry_proxy", MODULE_PATH)
PROXY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PROXY)


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


if __name__ == "__main__":
    unittest.main()
