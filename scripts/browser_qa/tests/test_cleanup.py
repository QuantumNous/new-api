import json
import base64
import contextlib
import io
import threading
import unittest
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from types import SimpleNamespace
from unittest import mock
from urllib.parse import parse_qs, urlparse

from scripts.browser_qa.flatkey_browser_qa import cleanup_job
from scripts.browser_qa.flatkey_browser_qa import candidate_orchestrator
from scripts.browser_qa.flatkey_browser_qa import promotion
from scripts.browser_qa.flatkey_browser_qa.cleanup import CleanupRunner
from scripts.browser_qa.flatkey_browser_qa.cleanup import CleanupResult
from scripts.browser_qa.flatkey_browser_qa.api import LoginResult
from scripts.browser_qa.flatkey_browser_qa.api import StagingApiClient
from scripts.browser_qa.flatkey_browser_qa.gcp import GcsUploadUncertain
from scripts.browser_qa.flatkey_browser_qa.identity import DerivedIdentity


IDENTITY = DerivedIdentity(
    run_id="123456789",
    username="qa12345678abcdef12",
    email_tag="flatkey-qa-123456789-abcdef1234",
    password="Aa1!secret-password-for-tests",
    key_name="cloud-qa-123456789",
)


class FakeStagingApi:
    def __init__(self, tokens=None):
        self.tokens = list(tokens if tokens is not None else [1])
        self.account_exists = True
        self.sessions = {}
        self.list_calls = 0
        self.delete_calls = {}
        self.login_calls = 0
        self.self_delete_calls = 0
        self.malformed_list = False
        self.duplicate_pages = False
        self.total_override = None
        self.one_delete_404 = set()
        self.transient_delete_503 = set()
        self.lost_delete_response = set()
        self.record_not_found_after_lost = set()
        self.record_not_found_without_delete = set()
        self.persistent_delete_5xx = set()
        self.account_delete_failure = False
        self.account_delete_lost_then_503 = False
        self.sequence = []
        self.login_response = None
        self.login_redirect_to = None
        self.duplicate_first_page_item = False

    def start(self):
        fake = self

        class Handler(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def log_message(self, *_):
                return

            def _read_json(self):
                length = int(self.headers.get("Content-Length", "0"))
                body = self.rfile.read(length) if length else b"{}"
                return json.loads(body.decode("utf-8"))

            def _send_json(self, status, payload, extra_headers=None):
                raw = json.dumps(payload).encode("utf-8")
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(raw)))
                for key, value in (extra_headers or {}).items():
                    self.send_header(key, value)
                self.end_headers()
                self.wfile.write(raw)

            def _authenticated_user(self):
                cookie = self.headers.get("Cookie", "")
                user_id = self.headers.get("New-Api-User")
                if not user_id or user_id not in fake.sessions.values():
                    return None
                if f"session={user_id}" not in cookie:
                    return None
                return user_id

            def do_POST(self):
                if self.path != "/api/user/login":
                    self._send_json(HTTPStatus.NOT_FOUND, {"success": False, "message": "not found"})
                    return
                fake.login_calls += 1
                fake.sequence.append(("login", None))
                body = self._read_json()
                if fake.login_redirect_to is not None:
                    self.send_response(HTTPStatus.FOUND)
                    self.send_header("Location", fake.login_redirect_to)
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                    return
                if fake.login_response is not None:
                    status, payload = fake.login_response
                    self._send_json(status, payload)
                    return
                if not fake.account_exists:
                    self._send_json(
                        HTTPStatus.OK,
                        {"success": False, "message": "Username or password is incorrect, or user has been banned"},
                    )
                    return
                if body.get("username") != IDENTITY.username or body.get("password") != IDENTITY.password:
                    self._send_json(HTTPStatus.OK, {"success": False, "message": "invalid username or password"})
                    return
                user_id = "123"
                fake.sessions[f"session={user_id}"] = user_id
                self._send_json(
                    HTTPStatus.OK,
                    {"success": True, "data": {"id": int(user_id)}},
                    {"Set-Cookie": f"session={user_id}; Path=/; HttpOnly"},
                )

            def do_GET(self):
                parsed = urlparse(self.path)
                if parsed.path != "/api/token/":
                    self._send_json(HTTPStatus.NOT_FOUND, {"success": False, "message": "not found"})
                    return
                if self._authenticated_user() is None:
                    self._send_json(HTTPStatus.UNAUTHORIZED, {"success": False, "message": "unauthorized"})
                    return
                fake.list_calls += 1
                fake.sequence.append(("list", fake.list_calls))
                if fake.malformed_list:
                    self._send_json(HTTPStatus.OK, {"success": True, "data": {"items": "not-a-list", "total": 1}})
                    return
                query = parse_qs(parsed.query)
                page = int(query.get("p", ["1"])[0])
                size = int(query.get("size", ["100"])[0])
                if fake.duplicate_pages and page > 1:
                    items = fake.tokens[: min(size, len(fake.tokens))]
                else:
                    items = fake.tokens[(page - 1) * size : page * size]
                if fake.duplicate_first_page_item and page == 1 and items:
                    items = [items[0], *items]
                payload_items = [{"id": token_id} for token_id in items]
                total = fake.total_override if fake.total_override is not None else len(fake.tokens)
                self._send_json(HTTPStatus.OK, {"success": True, "data": {"items": payload_items, "total": total}})

            def do_DELETE(self):
                if self._authenticated_user() is None:
                    self._send_json(HTTPStatus.UNAUTHORIZED, {"success": False, "message": "unauthorized"})
                    return
                if self.path == "/api/user/self":
                    fake.self_delete_calls += 1
                    if fake.account_delete_lost_then_503 and fake.self_delete_calls == 1:
                        fake.account_exists = False
                        fake.tokens.clear()
                        self.close_connection = True
                        return
                    if fake.account_delete_lost_then_503:
                        self._send_json(HTTPStatus.SERVICE_UNAVAILABLE, {"success": False, "message": "busy"})
                        return
                    if fake.account_delete_failure:
                        self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"success": False, "message": "failed"})
                        return
                    fake.account_exists = False
                    fake.tokens.clear()
                    self._send_json(HTTPStatus.OK, {"success": True, "data": True})
                    return
                if not self.path.startswith("/api/token/"):
                    self._send_json(HTTPStatus.NOT_FOUND, {"success": False, "message": "not found"})
                    return
                try:
                    token_id = int(self.path.rsplit("/", 1)[-1])
                except ValueError:
                    self._send_json(HTTPStatus.NOT_FOUND, {"success": False, "message": "not found"})
                    return
                fake.delete_calls[token_id] = fake.delete_calls.get(token_id, 0) + 1
                fake.sequence.append(("delete", token_id))
                if token_id in fake.persistent_delete_5xx:
                    self._send_json(HTTPStatus.SERVICE_UNAVAILABLE, {"success": False, "message": "busy"})
                    return
                if token_id in fake.transient_delete_503 and fake.delete_calls[token_id] == 1:
                    self._send_json(HTTPStatus.SERVICE_UNAVAILABLE, {"success": False, "message": "busy"})
                    return
                if token_id in fake.record_not_found_without_delete:
                    self._send_json(HTTPStatus.OK, {"success": False, "message": "record not found"})
                    return
                if token_id in fake.one_delete_404:
                    fake.one_delete_404.remove(token_id)
                    self._send_json(HTTPStatus.NOT_FOUND, {"success": False, "message": "not found"})
                    return
                if token_id in fake.tokens:
                    fake.tokens.remove(token_id)
                if token_id in fake.lost_delete_response and fake.delete_calls[token_id] == 1:
                    self.close_connection = True
                    return
                if token_id in fake.record_not_found_after_lost and token_id not in fake.tokens:
                    self._send_json(HTTPStatus.OK, {"success": False, "message": "record not found"})
                    return
                self._send_json(HTTPStatus.OK, {"success": True, "data": True})

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        return self

    @property
    def origin(self):
        host, port = self.server.server_address
        return f"http://{host}:{port}"

    def stop(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)


class TargetServer:
    def __init__(self):
        self.hits = 0

    def start(self):
        target = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_):
                return

            def do_GET(self):
                target.hits += 1
                raw = b"redirect target"
                self.send_response(HTTPStatus.OK)
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)

            def do_POST(self):
                target.hits += 1
                self.do_GET()

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        return self

    @property
    def url(self):
        host, port = self.server.server_address
        return f"http://{host}:{port}/redirect-target"

    def stop(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)


class StubCleanupClient:
    def __init__(self, list_tokens, *, delete_result=True):
        self._list_tokens = list_tokens
        self.delete_result = delete_result
        self.list_calls = 0
        self.deleted = []
        self.user_id = None
        self.cookies = []

    def login(self, _username, _password):
        self.user_id = "123"
        return LoginResult(user_id="123")

    def list_tokens(self, *, page, size):
        self.list_calls += 1
        return self._list_tokens(page, size)

    def delete_token(self, token_id):
        self.deleted.append(token_id)
        return self.delete_result

    def delete_self(self):
        return True

    def clear_cookies(self):
        self.user_id = None


class CleanupTests(unittest.TestCase):
    def make_client(self, fake):
        return StagingApiClient(fake.origin, allow_test_origin=True, retry_base_delay=0)

    def run_cleanup(self, fake, page_size=100, max_attempts=3):
        client = self.make_client(fake)
        return CleanupRunner(client, page_size=page_size, max_attempts=max_attempts).run(IDENTITY)

    def test_deletes_205_tokens_across_pages_and_verifies_account_absence(self):
        fake = FakeStagingApi(list(range(1, 206))).start()
        fake.one_delete_404.add(17)
        fake.transient_delete_503.add(18)
        try:
            result = self.run_cleanup(fake)
        finally:
            fake.stop()

        self.assertFalse(result.cleanup_failed, result.reason)
        self.assertEqual(result.deleted_token_count, 205)
        self.assertTrue(result.account_deleted)
        self.assertTrue(result.login_rejected_after_delete)
        self.assertGreaterEqual(fake.list_calls, 4)
        self.assertNotIn(18, fake.tokens)
        first_delete_index = next(index for index, item in enumerate(fake.sequence) if item[0] == "delete")
        self.assertEqual(
            [item for item in fake.sequence[:first_delete_index] if item[0] == "list"],
            [("list", 1), ("list", 2), ("list", 3)],
        )

    def test_constructor_accepts_only_exact_production_staging_origin_by_default(self):
        StagingApiClient("https://staging-console.flatkey.ai")
        with self.assertRaises(ValueError):
            StagingApiClient("https://staging-console.flatkey.ai/")
        with self.assertRaises(ValueError):
            StagingApiClient("http://127.0.0.1:1234")
        for origin in [
            "https://staging-console.flatkey.ai/path",
            "https://staging-console.flatkey.ai?x=1",
            "https://staging-console.flatkey.ai#frag",
            "https://user:pass@staging-console.flatkey.ai",
        ]:
            with self.subTest(origin=origin):
                with self.assertRaises(ValueError):
                    StagingApiClient(origin, allow_test_origin=True)

    def test_redirects_fail_closed_without_visiting_target_origin(self):
        target = TargetServer().start()
        fake = FakeStagingApi([]).start()
        fake.login_redirect_to = target.url
        try:
            result = self.run_cleanup(fake)
        finally:
            fake.stop()
            target.stop()

        self.assertTrue(result.cleanup_failed)
        self.assertEqual(target.hits, 0)

    def test_already_absent_requires_explicit_authentication_rejection(self):
        fake = FakeStagingApi([]).start()
        fake.account_exists = False
        try:
            result = self.run_cleanup(fake)
        finally:
            fake.stop()

        self.assertFalse(result.cleanup_failed, result.reason)
        self.assertEqual(result.deleted_token_count, 0)
        self.assertFalse(result.account_deleted)
        self.assertTrue(result.login_rejected_after_delete)

    def test_real_i18n_auth_rejection_is_accepted_directly(self):
        fake = FakeStagingApi([]).start()
        fake.account_exists = False
        client = self.make_client(fake)
        try:
            login = client.login(IDENTITY.username, IDENTITY.password)
        finally:
            fake.stop()

        self.assertTrue(login.auth_rejected)
        self.assertIsNone(client.user_id)

    def test_malformed_pagination_fails_closed(self):
        fake = FakeStagingApi(["token-1"]).start()
        fake.malformed_list = True
        try:
            result = self.run_cleanup(fake)
        finally:
            fake.stop()

        self.assertTrue(result.cleanup_failed)
        self.assertIn("pagination", result.reason)

    def test_bool_total_fails_closed(self):
        fake = FakeStagingApi([1]).start()
        fake.total_override = True
        try:
            result = self.run_cleanup(fake)
        finally:
            fake.stop()

        self.assertTrue(result.cleanup_failed)
        self.assertIn("pagination", result.reason)
        self.assertEqual(fake.self_delete_calls, 0)

    def test_page_size_must_match_service_contract_limit(self):
        fake = FakeStagingApi([]).start()
        client = self.make_client(fake)
        try:
            with self.assertRaises(ValueError):
                CleanupRunner(client, page_size=0)
            with self.assertRaises(ValueError):
                CleanupRunner(client, page_size=101)
            with self.assertRaises(ValueError):
                CleanupRunner(client, max_pages=0)
            with self.assertRaises(ValueError):
                CleanupRunner(client, max_pages=True)
        finally:
            fake.stop()

    def test_repeated_page_with_huge_total_fails_without_unbounded_paging(self):
        client = StubCleanupClient(lambda _page, _size: (["1", "2"], 10**12))

        result = CleanupRunner(client, page_size=2, max_pages=3).run(IDENTITY)

        self.assertTrue(result.cleanup_failed)
        self.assertIn("pagination", result.reason)
        self.assertEqual(client.list_calls, 2)
        self.assertEqual(client.deleted, [])

    def test_new_ids_beyond_max_pages_fail_closed(self):
        client = StubCleanupClient(lambda page, _size: ([str(page)], 10**12))

        result = CleanupRunner(client, page_size=1, max_pages=3).run(IDENTITY)

        self.assertTrue(result.cleanup_failed)
        self.assertIn("pagination", result.reason)
        self.assertEqual(client.list_calls, 3)
        self.assertEqual(client.deleted, [])

    def test_repeated_ids_across_real_pages_converge_by_observation(self):
        fake = FakeStagingApi([1, 2, 3]).start()
        fake.duplicate_first_page_item = True
        try:
            result = self.run_cleanup(fake, page_size=2)
        finally:
            fake.stop()

        self.assertFalse(result.cleanup_failed, result.reason)
        self.assertEqual(result.deleted_token_count, 3)
        self.assertEqual(fake.tokens, [])

    def test_empty_items_with_positive_total_fails_closed_without_deleting_account(self):
        fake = FakeStagingApi([1, 2]).start()
        fake.total_override = 3
        try:
            result = self.run_cleanup(fake, page_size=2)
        finally:
            fake.stop()

        self.assertTrue(result.cleanup_failed)
        self.assertIn("pagination", result.reason)
        self.assertFalse(result.account_deleted)
        self.assertEqual(fake.self_delete_calls, 0)

    def test_lost_delete_response_is_reentered_until_empty_listing(self):
        fake = FakeStagingApi([99]).start()
        fake.lost_delete_response.add(99)
        fake.record_not_found_after_lost.add(99)
        try:
            result = self.run_cleanup(fake)
        finally:
            fake.stop()

        self.assertFalse(result.cleanup_failed, result.reason)
        self.assertEqual(result.deleted_token_count, 0)
        self.assertGreaterEqual(fake.delete_calls[99], 1)
        last_delete_index = max(index for index, item in enumerate(fake.sequence) if item[0] == "delete")
        self.assertIn(("list", fake.list_calls), fake.sequence[last_delete_index + 1 :])

    def test_delete_false_without_absence_proof_reports_zero_deleted(self):
        client = StubCleanupClient(lambda _page, _size: (["77"], 1), delete_result=False)

        result = CleanupRunner(client, max_attempts=2).run(IDENTITY)

        self.assertTrue(result.cleanup_failed)
        self.assertIn("token", result.reason)
        self.assertEqual(result.deleted_token_count, 0)
        self.assertEqual(client.deleted, ["77", "77"])

    def test_record_not_found_without_absence_proof_fails_after_relisting(self):
        fake = FakeStagingApi([77]).start()
        fake.record_not_found_without_delete.add(77)
        try:
            result = self.run_cleanup(fake)
        finally:
            fake.stop()

        self.assertTrue(result.cleanup_failed)
        self.assertIn("token", result.reason)
        first_delete_index = next(index for index, item in enumerate(fake.sequence) if item[0] == "delete")
        self.assertTrue(any(item[0] == "list" for item in fake.sequence[first_delete_index + 1 :]))

    def test_persistent_5xx_leaves_cleanup_failed(self):
        fake = FakeStagingApi([500]).start()
        fake.persistent_delete_5xx.add(500)
        client = self.make_client(fake)
        try:
            result = CleanupRunner(client).run(IDENTITY)
        finally:
            fake.stop()

        self.assertTrue(result.cleanup_failed)
        self.assertIn("token", result.reason)
        self.assertEqual(fake.delete_calls[500], 3)
        self.assertIsNone(client.user_id)
        self.assertEqual(len(list(client.cookies)), 0)

    def test_account_delete_failure_is_cleanup_failed(self):
        fake = FakeStagingApi([]).start()
        fake.account_delete_failure = True
        try:
            result = self.run_cleanup(fake)
        finally:
            fake.stop()

        self.assertTrue(result.cleanup_failed)
        self.assertIn("account", result.reason)
        self.assertFalse(result.login_rejected_after_delete)

    def test_lost_account_delete_response_is_verified_by_rejected_login(self):
        fake = FakeStagingApi([]).start()
        fake.account_delete_lost_then_503 = True
        try:
            result = self.run_cleanup(fake)
        finally:
            fake.stop()

        self.assertFalse(result.cleanup_failed, result.reason)
        self.assertTrue(result.account_deleted)
        self.assertTrue(result.login_rejected_after_delete)
        self.assertGreaterEqual(fake.self_delete_calls, 2)

    def test_second_cleanup_run_observes_already_absent(self):
        fake = FakeStagingApi([1, 2]).start()
        try:
            first = self.run_cleanup(fake)
            second = self.run_cleanup(fake)
        finally:
            fake.stop()

        self.assertFalse(first.cleanup_failed, first.reason)
        self.assertFalse(second.cleanup_failed, second.reason)
        self.assertTrue(second.login_rejected_after_delete)
        self.assertEqual(second.deleted_token_count, 0)

    def test_client_rejects_non_integer_user_and_token_ids(self):
        bad_user = FakeStagingApi([]).start()
        bad_user.login_response = (HTTPStatus.OK, {"success": True, "data": {"id": "123"}})
        try:
            bad_user_result = self.run_cleanup(bad_user)
        finally:
            bad_user.stop()

        bad_token = FakeStagingApi(["1"]).start()
        try:
            bad_token_result = self.run_cleanup(bad_token)
        finally:
            bad_token.stop()

        self.assertTrue(bad_user_result.cleanup_failed)
        self.assertTrue(bad_token_result.cleanup_failed)
        self.assertIn("pagination", bad_token_result.reason)

    def test_200_success_false_that_is_not_auth_rejection_fails_closed(self):
        fake = FakeStagingApi([]).start()
        fake.login_response = (HTTPStatus.OK, {"success": False, "message": "password login disabled"})
        try:
            result = self.run_cleanup(fake)
        finally:
            fake.stop()

        self.assertTrue(result.cleanup_failed)
        self.assertFalse(result.login_rejected_after_delete)

    def test_malformed_login_success_and_login_5xx_fail_closed(self):
        malformed = FakeStagingApi([]).start()
        malformed.login_response = (HTTPStatus.OK, {"success": True, "data": {}})
        try:
            malformed_result = self.run_cleanup(malformed)
        finally:
            malformed.stop()

        server_error = FakeStagingApi([]).start()
        server_error.login_response = (HTTPStatus.INTERNAL_SERVER_ERROR, {"success": False, "message": "busy"})
        try:
            server_error_result = self.run_cleanup(server_error)
        finally:
            server_error.stop()

        self.assertTrue(malformed_result.cleanup_failed)
        self.assertTrue(server_error_result.cleanup_failed)
        self.assertFalse(malformed_result.login_rejected_after_delete)
        self.assertFalse(server_error_result.login_rejected_after_delete)

    def test_cleanup_job_output_omits_username_password_and_seed(self):
        seed = b"seed-with-32-bytes-minimum-value"
        env = {
            "FLATKEY_QA_RUN_ID": IDENTITY.run_id,
            "FLATKEY_QA_IDENTITY_SEED_B64": base64.b64encode(seed).decode("ascii"),
            "FLATKEY_QA_CONSOLE_ORIGIN": "https://staging-console.flatkey.ai",
            "FLATKEY_BROWSER_QA_GCS_BUCKET": "flatkey-browser-qa-reports",
            "FLATKEY_BROWSER_QA_MAIN_EXECUTION_ID": "main-001",
            "FLATKEY_BROWSER_QA_CLEANUP_EXECUTION_ID": "cleanup-001",
        }

        class FakeRunner:
            def __init__(self, _client):
                pass

            def run(self, _identity):
                return CleanupResult(3, True, True, False, "cleanup verified")

        stdout = io.StringIO()
        def fake_read(bucket, object_name, token):
            if object_name.endswith("/manifest.json") and "/main/" in object_name:
                return main_manifest(), 1
            raise FileNotFoundError(object_name)

        with mock.patch.dict("os.environ", env, clear=True):
            with mock.patch.object(cleanup_job, "StagingApiClient", lambda _origin: object()):
                with mock.patch.object(cleanup_job, "CleanupRunner", FakeRunner):
                    with mock.patch.object(cleanup_job, "GcpClient", lambda: FakeGcpClient("access-secret")):
                        with mock.patch.object(cleanup_job, "read_gcs_json_object", fake_read):
                            with mock.patch.object(cleanup_job, "upload_gcs_object", lambda *_args, **_kwargs: {}):
                                with contextlib.redirect_stdout(stdout):
                                    exit_code = cleanup_job.main([])

        output = stdout.getvalue()
        self.assertEqual(exit_code, 0)
        for secret in [IDENTITY.username, IDENTITY.password, "owner", "gmail", "seed-with"]:
            self.assertNotIn(secret, output)

    def test_cleanup_job_bootstraps_root_manifest_from_explicit_main_execution_id(self):
        seed = b"seed-with-32-bytes-minimum-value"
        env = cleanup_env(seed, main_execution_id="main-001", cleanup_execution_id="cleanup-001")
        uploads = []
        reads = []

        class FakeRunner:
            def __init__(self, _client):
                pass

            def run(self, _identity):
                return CleanupResult(2, True, True, False, "cleanup verified")

        def fake_read(bucket, object_name, token):
            reads.append((bucket, object_name, token))
            if object_name == f"runs/{IDENTITY.run_id}/main/main-001/manifest.json":
                return main_manifest(), 11
            raise FileNotFoundError(object_name)

        def fake_upload(bucket, object_name, data, content_type, token, *, if_generation_match=0):
            uploads.append(
                {
                    "bucket": bucket,
                    "object_name": object_name,
                    "payload": json.loads(data.decode("utf-8")),
                    "content_type": content_type,
                    "token": token,
                    "if_generation_match": if_generation_match,
                }
            )
            return {"name": object_name}

        stdout = io.StringIO()
        with mock.patch.dict("os.environ", env, clear=True):
            with mock.patch.object(cleanup_job, "StagingApiClient", lambda _origin: object()):
                with mock.patch.object(cleanup_job, "CleanupRunner", FakeRunner):
                    with mock.patch.object(cleanup_job, "GcpClient", lambda: FakeGcpClient("access-secret")):
                        with mock.patch.object(cleanup_job, "read_gcs_json_object", fake_read):
                            with mock.patch.object(cleanup_job, "upload_gcs_object", fake_upload):
                                with contextlib.redirect_stdout(stdout):
                                    exit_code = cleanup_job.main([])

        self.assertEqual(exit_code, 0)
        self.assertEqual(
            reads,
            [
                ("flatkey-browser-qa-reports", f"runs/{IDENTITY.run_id}/manifest.json", "access-secret"),
                ("flatkey-browser-qa-reports", f"runs/{IDENTITY.run_id}/main/main-001/manifest.json", "access-secret"),
            ],
        )
        self.assertEqual([item["object_name"] for item in uploads], [
            f"runs/{IDENTITY.run_id}/cleanup/cleanup-001/cleanup.json",
            f"runs/{IDENTITY.run_id}/manifest.json",
        ])
        cleanup_upload, root_upload = uploads
        self.assertEqual(cleanup_upload["if_generation_match"], 0)
        self.assertEqual(root_upload["if_generation_match"], 0)
        self.assertEqual(cleanup_upload["payload"]["kind"], "cleanup")
        self.assertEqual(cleanup_upload["payload"]["main_execution_id"], "main-001")
        self.assertNotIn("username", json.dumps(cleanup_upload["payload"]).lower())
        root = root_upload["payload"]
        self.assertEqual(root["schema_version"], 1)
        self.assertEqual(root["run_id"], IDENTITY.run_id)
        self.assertEqual(root["status"], "passed")
        self.assertEqual(root["latest"], {"main_execution_id": "main-001", "cleanup_execution_id": "cleanup-001"})
        self.assertEqual([item["kind"] for item in root["executions"]], ["main", "cleanup"])
        self.assertEqual(root["executions"][1]["manifest"], f"runs/{IDENTITY.run_id}/cleanup/cleanup-001/cleanup.json")

    def test_cleanup_job_preserves_history_and_retries_412_manifest_race(self):
        seed = b"seed-with-32-bytes-minimum-value"
        env = cleanup_env(seed, main_execution_id="main-001", cleanup_execution_id="cleanup-002")
        existing = {
            "schema_version": 1,
            "run_id": IDENTITY.run_id,
            "status": "passed",
            "latest": {"main_execution_id": "main-001", "cleanup_execution_id": "cleanup-001"},
            "executions": [
                {
                    "kind": "main",
                    "execution_id": "main-001",
                    "manifest": f"runs/{IDENTITY.run_id}/main/main-001/manifest.json",
                    "status": "passed",
                    "created_at": 1,
                },
                {
                    "kind": "cleanup",
                    "execution_id": "cleanup-001",
                    "manifest": f"runs/{IDENTITY.run_id}/cleanup/cleanup-001/cleanup.json",
                    "status": "passed",
                    "created_at": 2,
                },
            ],
        }
        reads = [
            (existing, 7),
            (main_manifest(), 11),
            (existing, 8),
            (main_manifest(), 11),
        ]
        uploads = []

        class FakeRunner:
            def __init__(self, _client):
                pass

            def run(self, _identity):
                return CleanupResult(0, False, True, False, "account already absent")

        def fake_read(_bucket, _object_name, _token):
            return reads.pop(0)

        def fake_upload(bucket, object_name, data, content_type, token, *, if_generation_match=0):
            uploads.append((object_name, json.loads(data.decode("utf-8")), if_generation_match))
            if object_name.endswith("/manifest.json") and if_generation_match == 7:
                raise cleanup_job.GcsObjectAlreadyExists("race")
            return {"name": object_name}

        with mock.patch.dict("os.environ", env, clear=True):
            with mock.patch.object(cleanup_job, "StagingApiClient", lambda _origin: object()):
                with mock.patch.object(cleanup_job, "CleanupRunner", FakeRunner):
                    with mock.patch.object(cleanup_job, "GcpClient", lambda: FakeGcpClient("access-secret")):
                        with mock.patch.object(cleanup_job, "read_gcs_json_object", fake_read):
                            with mock.patch.object(cleanup_job, "upload_gcs_object", fake_upload):
                                with contextlib.redirect_stdout(io.StringIO()):
                                    exit_code = cleanup_job.main([])

        self.assertEqual(exit_code, 0)
        root_attempts = [item for item in uploads if item[0].endswith("/manifest.json")]
        self.assertEqual([item[2] for item in root_attempts], [7, 8])
        final_root = root_attempts[-1][1]
        self.assertEqual([item["execution_id"] for item in final_root["executions"]], ["main-001", "cleanup-001", "cleanup-002"])
        self.assertEqual(final_root["latest"]["cleanup_execution_id"], "cleanup-002")

    def test_cleanup_job_reenters_existing_cleanup_artifact_and_repairs_root_without_overwrite(self):
        seed = b"seed-with-32-bytes-minimum-value"
        env = cleanup_env(seed, main_execution_id="main-001", cleanup_execution_id="cleanup-001")
        cleanup_object = f"runs/{IDENTITY.run_id}/cleanup/cleanup-001/cleanup.json"
        root_object = f"runs/{IDENTITY.run_id}/manifest.json"
        persisted_cleanup = cleanup_manifest(execution_id="cleanup-001", main_execution_id="main-001", created_at=20)
        uploads = []

        class FakeRunner:
            def __init__(self, _client):
                pass

            def run(self, _identity):
                return CleanupResult(0, False, True, False, "account already absent on rerun")

        def fake_read(_bucket, object_name, _token):
            if object_name == cleanup_object:
                return persisted_cleanup, 5
            if object_name == f"runs/{IDENTITY.run_id}/main/main-001/manifest.json":
                return main_manifest(created_at=10), 11
            if object_name == root_object:
                raise FileNotFoundError(object_name)
            raise AssertionError(object_name)

        def fake_upload(_bucket, object_name, data, _content_type, _token, *, if_generation_match=0):
            uploads.append((object_name, json.loads(data.decode("utf-8")), if_generation_match))
            if object_name == cleanup_object:
                raise cleanup_job.GcsObjectAlreadyExists("already persisted")
            return {"name": object_name}

        with mock.patch.dict("os.environ", env, clear=True):
            with mock.patch.object(cleanup_job, "StagingApiClient", lambda _origin: object()):
                with mock.patch.object(cleanup_job, "CleanupRunner", FakeRunner):
                    with mock.patch.object(cleanup_job, "GcpClient", lambda: FakeGcpClient("access-secret")):
                        with mock.patch.object(cleanup_job, "read_gcs_json_object", fake_read):
                            with mock.patch.object(cleanup_job, "upload_gcs_object", fake_upload):
                                with contextlib.redirect_stdout(io.StringIO()):
                                    exit_code = cleanup_job.main([])

        self.assertEqual(exit_code, 0)
        self.assertEqual([item[0] for item in uploads], [cleanup_object, root_object])
        repaired_root = uploads[-1][1]
        self.assertEqual(repaired_root["executions"][1]["created_at"], 20)
        self.assertEqual(repaired_root["executions"][1]["manifest"], cleanup_object)

    def test_cleanup_job_reentry_exit_status_uses_immutable_persisted_cleanup_status(self):
        seed = b"seed-with-32-bytes-minimum-value"
        env = cleanup_env(seed, main_execution_id="main-001", cleanup_execution_id="cleanup-001")
        cleanup_object = f"runs/{IDENTITY.run_id}/cleanup/cleanup-001/cleanup.json"
        root_object = f"runs/{IDENTITY.run_id}/manifest.json"
        persisted_cleanup = cleanup_manifest(
            status="cleanup_failed",
            cleaned={
                "cleanup_failed": True,
                "deleted_token_count": 0,
                "account_deleted": False,
                "login_rejected_after_delete": False,
                "reason": "previous cleanup failed",
            },
        )
        uploaded_roots = []

        class FakeRunner:
            def __init__(self, _client):
                pass

            def run(self, _identity):
                return CleanupResult(0, False, True, False, "account absent on rerun")

        def fake_read(_bucket, object_name, _token):
            if object_name == cleanup_object:
                return persisted_cleanup, 5
            if object_name == f"runs/{IDENTITY.run_id}/main/main-001/manifest.json":
                return main_manifest(created_at=10), 11
            if object_name == root_object:
                raise FileNotFoundError(object_name)
            raise AssertionError(object_name)

        def fake_upload(_bucket, object_name, data, _content_type, _token, *, if_generation_match=0):
            if object_name == cleanup_object:
                raise cleanup_job.GcsObjectAlreadyExists("already persisted")
            uploaded_roots.append(json.loads(data.decode("utf-8")))
            return {"name": object_name}

        stdout = io.StringIO()
        with mock.patch.dict("os.environ", env, clear=True):
            with mock.patch.object(cleanup_job, "StagingApiClient", lambda _origin: object()):
                with mock.patch.object(cleanup_job, "CleanupRunner", FakeRunner):
                    with mock.patch.object(cleanup_job, "GcpClient", lambda: FakeGcpClient("access-secret")):
                        with mock.patch.object(cleanup_job, "read_gcs_json_object", fake_read):
                            with mock.patch.object(cleanup_job, "upload_gcs_object", fake_upload):
                                with contextlib.redirect_stdout(stdout):
                                    exit_code = cleanup_job.main([])

        self.assertEqual(exit_code, 1)
        self.assertIn("previous cleanup failed", stdout.getvalue())
        self.assertEqual(uploaded_roots[-1]["status"], "cleanup_failed")

    def test_cleanup_job_uncertain_cleanup_upload_fails_closed_when_existing_artifact_invalid(self):
        seed = b"seed-with-32-bytes-minimum-value"
        env = cleanup_env(seed, main_execution_id="main-001", cleanup_execution_id="cleanup-001")
        cleanup_object = f"runs/{IDENTITY.run_id}/cleanup/cleanup-001/cleanup.json"

        class FakeRunner:
            def __init__(self, _client):
                pass

            def run(self, _identity):
                return CleanupResult(0, False, True, False, "account already absent")

        def fake_read(_bucket, object_name, _token):
            if object_name == cleanup_object:
                return {**cleanup_manifest(), "status": "passed", "cleaned": {"cleanup_failed": True}}, 5
            raise FileNotFoundError(object_name)

        def fake_upload(_bucket, object_name, _data, _content_type, _token, *, if_generation_match=0):
            if object_name == cleanup_object:
                raise GcsUploadUncertain("lost response")
            return {"name": object_name}

        with mock.patch.dict("os.environ", env, clear=True):
            with mock.patch.object(cleanup_job, "StagingApiClient", lambda _origin: object()):
                with mock.patch.object(cleanup_job, "CleanupRunner", FakeRunner):
                    with mock.patch.object(cleanup_job, "GcpClient", lambda: FakeGcpClient("access-secret")):
                        with mock.patch.object(cleanup_job, "read_gcs_json_object", fake_read):
                            with mock.patch.object(cleanup_job, "upload_gcs_object", fake_upload):
                                with contextlib.redirect_stdout(io.StringIO()):
                                    exit_code = cleanup_job.main([])

        self.assertEqual(exit_code, 1)

    def test_cleanup_job_recovers_uncertain_root_cas_when_desired_state_was_persisted(self):
        seed = b"seed-with-32-bytes-minimum-value"
        env = cleanup_env(seed, main_execution_id="main-001", cleanup_execution_id="cleanup-001")
        root_object = f"runs/{IDENTITY.run_id}/manifest.json"
        persisted_root = None
        reads = []

        class FakeRunner:
            def __init__(self, _client):
                pass

            def run(self, _identity):
                return CleanupResult(0, False, True, False, "account already absent")

        def fake_read(_bucket, object_name, _token):
            reads.append(object_name)
            if object_name == f"runs/{IDENTITY.run_id}/main/main-001/manifest.json":
                return main_manifest(created_at=10), 11
            if object_name == root_object and persisted_root is not None:
                return persisted_root, 8
            if object_name == root_object:
                raise FileNotFoundError(object_name)
            raise AssertionError(object_name)

        def fake_upload(_bucket, object_name, data, _content_type, _token, *, if_generation_match=0):
            nonlocal persisted_root
            if object_name == root_object:
                persisted_root = json.loads(data.decode("utf-8"))
                raise GcsUploadUncertain("lost response")
            return {"name": object_name}

        with mock.patch.dict("os.environ", env, clear=True):
            with mock.patch.object(cleanup_job, "StagingApiClient", lambda _origin: object()):
                with mock.patch.object(cleanup_job, "CleanupRunner", FakeRunner):
                    with mock.patch.object(cleanup_job, "GcpClient", lambda: FakeGcpClient("access-secret")):
                        with mock.patch.object(cleanup_job, "read_gcs_json_object", fake_read):
                            with mock.patch.object(cleanup_job, "upload_gcs_object", fake_upload):
                                with contextlib.redirect_stdout(io.StringIO()):
                                    exit_code = cleanup_job.main([])

        self.assertEqual(exit_code, 0)
        self.assertEqual(persisted_root["latest"], {"main_execution_id": "main-001", "cleanup_execution_id": "cleanup-001"})
        self.assertEqual(reads.count(root_object), 2)

    def test_cleanup_job_persists_failed_cleanup_and_returns_nonzero_on_persistence_failure(self):
        seed = b"seed-with-32-bytes-minimum-value"
        env = cleanup_env(seed, main_execution_id="main-001", cleanup_execution_id="cleanup-003")
        uploaded = []
        def fake_read(_bucket, object_name, _token):
            if "/main/" in object_name:
                return main_manifest(), 11
            raise FileNotFoundError(object_name)

        class FailedRunner:
            def __init__(self, _client):
                pass

            def run(self, _identity):
                return CleanupResult(0, False, False, True, "token cleanup failed")

        def fake_upload(bucket, object_name, data, content_type, token, *, if_generation_match=0):
            uploaded.append((object_name, json.loads(data.decode("utf-8"))))
            return {"name": object_name}

        with mock.patch.dict("os.environ", env, clear=True):
            with mock.patch.object(cleanup_job, "StagingApiClient", lambda _origin: object()):
                with mock.patch.object(cleanup_job, "CleanupRunner", FailedRunner):
                    with mock.patch.object(cleanup_job, "GcpClient", lambda: FakeGcpClient("access-secret")):
                        with mock.patch.object(cleanup_job, "read_gcs_json_object", fake_read):
                            with mock.patch.object(cleanup_job, "upload_gcs_object", fake_upload):
                                with contextlib.redirect_stdout(io.StringIO()):
                                    failed_cleanup_code = cleanup_job.main([])

        self.assertEqual(failed_cleanup_code, 1)
        self.assertEqual(uploaded[-1][1]["status"], "cleanup_failed")

        class SuccessRunner:
            def __init__(self, _client):
                pass

            def run(self, _identity):
                return CleanupResult(0, False, True, False, "account already absent")

        with mock.patch.dict("os.environ", env, clear=True):
            with mock.patch.object(cleanup_job, "StagingApiClient", lambda _origin: object()):
                with mock.patch.object(cleanup_job, "CleanupRunner", SuccessRunner):
                    with mock.patch.object(cleanup_job, "GcpClient", lambda: FakeGcpClient("access-secret")):
                        with mock.patch.object(cleanup_job, "read_gcs_json_object", fake_read):
                            with mock.patch.object(cleanup_job, "upload_gcs_object", mock.Mock(side_effect=RuntimeError("gcs down"))):
                                with contextlib.redirect_stdout(io.StringIO()):
                                    persistence_failure_code = cleanup_job.main([])

        self.assertEqual(persistence_failure_code, 1)

    def test_cleanup_job_recovers_missing_main_manifest_when_cleanup_is_verified(self):
        seed = b"seed-with-32-bytes-minimum-value"
        env = cleanup_env(seed, main_execution_id="main-001", cleanup_execution_id="cleanup-001")
        uploaded = []

        class SuccessRunner:
            def __init__(self, _client):
                pass

            def run(self, _identity):
                return CleanupResult(0, False, True, False, "account already absent")

        def fake_read(_bucket, object_name, _token):
            raise FileNotFoundError(object_name)

        def fake_upload(_bucket, object_name, data, _content_type, _token, *, if_generation_match=0):
            uploaded.append((object_name, json.loads(data.decode("utf-8"))))
            return {"name": object_name}

        with mock.patch.dict("os.environ", env, clear=True):
            with mock.patch.object(cleanup_job, "StagingApiClient", lambda _origin: object()):
                with mock.patch.object(cleanup_job, "CleanupRunner", SuccessRunner):
                    with mock.patch.object(cleanup_job, "GcpClient", lambda: FakeGcpClient("access-secret")):
                        with mock.patch.object(cleanup_job, "read_gcs_json_object", fake_read):
                            with mock.patch.object(cleanup_job, "upload_gcs_object", fake_upload):
                                with contextlib.redirect_stdout(io.StringIO()):
                                    exit_code = cleanup_job.main([])

        self.assertEqual(exit_code, 0)
        root_uploads = [payload for object_name, payload in uploaded if object_name == f"runs/{IDENTITY.run_id}/manifest.json"]
        self.assertTrue(root_uploads)
        root = root_uploads[-1]
        self.assertEqual(root["status"], "infrastructure_failed")
        self.assertEqual(root["latest"], {"main_execution_id": "main-001", "cleanup_execution_id": "cleanup-001"})
        self.assertEqual(root["executions"][0], missing_main_record("main-001", IDENTITY.run_id))
        self.assertEqual(root["executions"][1]["status"], "passed")
        self.assertEqual(root["executions"][1]["summary"], {"cleanup_failed": False, "cleanup_status": "passed"})
        cleanup_job._validate_root_manifest(root, IDENTITY.run_id)

    def test_cleanup_job_keeps_cleanup_failed_priority_when_main_manifest_is_missing(self):
        seed = b"seed-with-32-bytes-minimum-value"
        env = cleanup_env(seed, main_execution_id="main-001", cleanup_execution_id="cleanup-001")
        uploaded = []

        class FailedRunner:
            def __init__(self, _client):
                pass

            def run(self, _identity):
                return CleanupResult(0, False, False, True, "token cleanup failed")

        def fake_read(_bucket, object_name, _token):
            raise FileNotFoundError(object_name)

        def fake_upload(_bucket, object_name, data, _content_type, _token, *, if_generation_match=0):
            uploaded.append((object_name, json.loads(data.decode("utf-8"))))
            return {"name": object_name}

        with mock.patch.dict("os.environ", env, clear=True):
            with mock.patch.object(cleanup_job, "StagingApiClient", lambda _origin: object()):
                with mock.patch.object(cleanup_job, "CleanupRunner", FailedRunner):
                    with mock.patch.object(cleanup_job, "GcpClient", lambda: FakeGcpClient("access-secret")):
                        with mock.patch.object(cleanup_job, "read_gcs_json_object", fake_read):
                            with mock.patch.object(cleanup_job, "upload_gcs_object", fake_upload):
                                with contextlib.redirect_stdout(io.StringIO()):
                                    exit_code = cleanup_job.main([])

        self.assertEqual(exit_code, 1)
        root_uploads = [payload for object_name, payload in uploaded if object_name == f"runs/{IDENTITY.run_id}/manifest.json"]
        self.assertTrue(root_uploads)
        root = root_uploads[-1]
        self.assertEqual(root["status"], "cleanup_failed")
        self.assertEqual(root["executions"][0], missing_main_record("main-001", IDENTITY.run_id))
        self.assertEqual(root["executions"][1]["status"], "cleanup_failed")

    def test_cleanup_job_fails_closed_on_main_manifest_errors_other_than_missing(self):
        seed = b"seed-with-32-bytes-minimum-value"
        env = cleanup_env(seed, main_execution_id="main-001", cleanup_execution_id="cleanup-001")

        class SuccessRunner:
            def __init__(self, _client):
                pass

            def run(self, _identity):
                return CleanupResult(0, False, True, False, "account already absent")

        cases = [
            PermissionError("denied"),
            ({"schema_version": 1, "kind": "main", "run_id": IDENTITY.run_id}, 1),
        ]
        for main_response in cases:
            uploaded_roots = []

            def fake_read(_bucket, object_name, _token):
                if "/main/" in object_name:
                    if isinstance(main_response, BaseException):
                        raise main_response
                    return main_response
                raise FileNotFoundError(object_name)

            def fake_upload(_bucket, object_name, data, _content_type, _token, *, if_generation_match=0):
                if object_name == f"runs/{IDENTITY.run_id}/manifest.json":
                    uploaded_roots.append(json.loads(data.decode("utf-8")))
                return {"name": object_name}

            with self.subTest(main_response=type(main_response).__name__):
                with mock.patch.dict("os.environ", env, clear=True):
                    with mock.patch.object(cleanup_job, "StagingApiClient", lambda _origin: object()):
                        with mock.patch.object(cleanup_job, "CleanupRunner", SuccessRunner):
                            with mock.patch.object(cleanup_job, "GcpClient", lambda: FakeGcpClient("access-secret")):
                                with mock.patch.object(cleanup_job, "read_gcs_json_object", fake_read):
                                    with mock.patch.object(cleanup_job, "upload_gcs_object", fake_upload):
                                        with contextlib.redirect_stdout(io.StringIO()):
                                            exit_code = cleanup_job.main([])

                self.assertEqual(exit_code, 1)
                self.assertEqual(uploaded_roots, [])

    def test_root_manifest_rejects_malformed_latest_and_duplicate_records(self):
        valid = root_manifest()

        for latest in [
            {"main_execution_id": "main-001"},
            {"main_execution_id": "main-001", "cleanup_execution_id": None, "extra": "bad"},
            {"main_execution_id": "../escape", "cleanup_execution_id": None},
            {"main_execution_id": "main-001", "cleanup_execution_id": "cleanup/001"},
        ]:
            bad = dict(valid)
            bad["latest"] = latest
            with self.subTest(latest=latest):
                with self.assertRaises(ValueError):
                    cleanup_job._validate_root_manifest(bad, IDENTITY.run_id)

        duplicate = root_manifest(
            executions=[
                execution_record("cleanup", "cleanup-001", IDENTITY.run_id),
                execution_record("cleanup", "cleanup-001", IDENTITY.run_id),
            ]
        )
        with self.assertRaises(ValueError):
            cleanup_job._validate_root_manifest(duplicate, IDENTITY.run_id)

    def test_root_manifest_rejects_unsafe_cross_run_and_noncanonical_record_paths(self):
        for record in [
            execution_record("main", "../escape", IDENTITY.run_id),
            {**execution_record("main", "main-001", IDENTITY.run_id), "manifest": "../escape"},
            {**execution_record("main", "main-001", IDENTITY.run_id), "manifest": f"runs/other-run/main/main-001/manifest.json"},
            {**execution_record("cleanup", "cleanup-001", IDENTITY.run_id), "manifest": f"runs/{IDENTITY.run_id}/main/cleanup-001/manifest.json"},
            {**execution_record("cleanup", "cleanup-001", IDENTITY.run_id), "extra": "bad"},
        ]:
            bad = root_manifest(executions=[record])
            with self.subTest(record=record):
                with self.assertRaises(ValueError):
                    cleanup_job._validate_root_manifest(bad, IDENTITY.run_id)

    def test_main_record_requires_versioned_main_manifest_identity(self):
        cfg = SimpleNamespace(
            run_id=IDENTITY.run_id,
            gcs_bucket="flatkey-browser-qa-reports",
            main_execution_id="main-001",
        )
        for manifest in [
            {"status": "passed", "created_at": 1},
            main_manifest(run_id="other-run"),
            main_manifest(kind="cleanup"),
            main_manifest(execution_id="other-main"),
            {**main_manifest(), "extra": "bad"},
            main_manifest(provenance={**valid_provenance(), "skill_content_sha256": "A" * 64}),
            main_manifest(provenance={**valid_provenance(), "model_config": {"model": "gpt-5.4", "sandbox": "workspace-write"}}),
            main_manifest(provenance={k: v for k, v in valid_provenance().items() if k != "chromium_version"}),
        ]:
            with self.subTest(manifest=manifest):
                with mock.patch.object(cleanup_job, "read_gcs_json_object", lambda *_args: (manifest, 1)):
                    with self.assertRaises(ValueError):
                        cleanup_job._main_record(cfg, "access-secret")

        with mock.patch.object(cleanup_job, "read_gcs_json_object", lambda *_args: (main_manifest(), 1)):
            self.assertEqual(
                cleanup_job._main_record(cfg, "access-secret"),
                execution_record("main", "main-001", IDENTITY.run_id, summary=main_summary()),
            )

    def test_main_record_summary_uses_validated_main_result_counts_and_status(self):
        cfg = SimpleNamespace(
            run_id=IDENTITY.run_id,
            gcs_bucket="flatkey-browser-qa-reports",
            main_execution_id="main-001",
        )
        manifest = main_manifest(
            status="findings_detected",
            result=valid_main_result(
                replay={"status": "passed", "checkpoint_reached": True},
                exploration={"status": "passed", "actions_used": 7},
                findings=[
                    {
                        "severity": "high",
                        "title": "Unsafe\n\t redirect",
                        "target_url": "https://staging-console.flatkey.ai/admin?token=secret#fragment",
                        "steps": ["open page"],
                        "expected": "safe",
                        "actual": "unsafe",
                        "evidence_paths": ["screenshots/safe.png"],
                        "confidence": "high",
                        "proposed_case": None,
                    },
                    {
                        "severity": "info",
                        "title": "Info",
                        "target_url": "https://staging-console.flatkey.ai/",
                        "steps": ["observe"],
                        "expected": "noted",
                        "actual": "noted",
                        "evidence_paths": ["screenshots/info.png"],
                        "confidence": "medium",
                        "proposed_case": None,
                    },
                    {
                        "severity": "medium",
                        "title": "Second issue",
                        "target_url": "https://staging-console.flatkey.ai/settings/profile?email=owner@example.com",
                        "steps": ["open page"],
                        "expected": "safe",
                        "actual": "unsafe",
                        "evidence_paths": ["screenshots/second.png"],
                        "confidence": "medium",
                        "proposed_case": None,
                    },
                ],
            ),
        )

        with mock.patch.object(cleanup_job, "read_gcs_json_object", lambda *_args: (manifest, 1)):
            record = cleanup_job._main_record(cfg, "access-secret")

        self.assertEqual(record["summary"], {
            "replay_status": "passed",
            "exploration_status": "passed",
            "exploration_actions": 7,
            "finding_count": 3,
            "finding_summaries": [
                {
                    "severity": "high",
                    "title": "Unsafe redirect",
                    "confidence": "high",
                    "page_path": "/admin",
                },
                {
                    "severity": "medium",
                    "title": "Second issue",
                    "confidence": "medium",
                    "page_path": "/settings/profile",
                },
            ],
            "coverage_candidate_count": 0,
            "fixed_case_status": "not_started",
            "fixed_case_count": 0,
            "fixed_case_failed_count": 0,
            "phase_trace": [],
        })

    def test_main_record_summary_omits_sensitive_model_authored_titles(self):
        cfg = SimpleNamespace(
            run_id=IDENTITY.run_id,
            gcs_bucket="flatkey-browser-qa-reports",
            main_execution_id="main-001",
        )
        manifest = main_manifest(
            status="findings_detected",
            result=valid_main_result(
                findings=[
                    finding(title="owner@example.com", target_url="https://staging-console.flatkey.ai/email?secret=1"),
                    finding(title="sk-live-secret123", target_url="https://staging-console.flatkey.ai/key#secret"),
                    finding(title="验证码 123456", target_url="https://staging-console.flatkey.ai/code"),
                    finding(title="API Key dialog validation", target_url="https://staging-console.flatkey.ai/keys"),
                ],
            ),
        )

        with mock.patch.object(cleanup_job, "read_gcs_json_object", lambda *_args: (manifest, 1)):
            record = cleanup_job._main_record(cfg, "access-secret")

        summaries = record["summary"]["finding_summaries"]
        self.assertEqual(record["summary"]["finding_count"], 4)
        self.assertEqual(len(summaries), 3)
        self.assertEqual(
            [item["title"] for item in summaries],
            [
                "Sensitive finding details omitted",
                "Sensitive finding details omitted",
                "Sensitive finding details omitted",
            ],
        )
        self.assertEqual([item["page_path"] for item in summaries], ["/email", "/key", "/code"])
        for forbidden in ["owner@example.com", "sk-live-secret123", "验证码", "123456"]:
            self.assertNotIn(forbidden, json.dumps(summaries, ensure_ascii=False))

    def test_main_record_summary_removes_unicode_category_c_from_public_fields(self):
        cfg = SimpleNamespace(
            run_id=IDENTITY.run_id,
            gcs_bucket="flatkey-browser-qa-reports",
            main_execution_id="main-001",
        )
        manifest = main_manifest(
            status="findings_detected",
            result=valid_main_result(
                findings=[
                    finding(
                        title="Unsafe\u202e redirect\u2066",
                        target_url="https://staging-console.flatkey.ai/admin\u202e/path?token=secret#fragment",
                    ),
                ],
            ),
        )

        with mock.patch.object(cleanup_job, "read_gcs_json_object", lambda *_args: (manifest, 1)):
            record = cleanup_job._main_record(cfg, "access-secret")

        self.assertEqual(
            record["summary"]["finding_summaries"],
            [{"severity": "high", "title": "Unsafe redirect", "confidence": "high", "page_path": "/admin/path"}],
        )

    def test_main_summary_preserves_nonempty_title_when_sanitization_collapses_to_empty(self):
        summary = cleanup_job._main_summary(
            valid_main_result(
                findings=[
                    finding(
                        title=" \t\r\n\u202e\u2066",
                        target_url="https://staging-console.flatkey.ai/admin",
                    ),
                ],
            )
        )

        self.assertEqual(
            summary["finding_summaries"],
            [
                {
                    "severity": "high",
                    "title": "Sensitive finding details omitted",
                    "confidence": "high",
                    "page_path": "/admin",
                }
            ],
        )
        cleanup_job._validate_finding_summaries(summary["finding_summaries"])

    def test_main_record_rejects_malformed_result_before_summary_extraction(self):
        cfg = SimpleNamespace(
            run_id=IDENTITY.run_id,
            gcs_bucket="flatkey-browser-qa-reports",
            main_execution_id="main-001",
        )
        invalid_results = [
            {"replay": {"status": "passed"}},
            valid_main_result(exploration={"status": "passed", "actions_used": -1}),
            valid_main_result(findings=[{"title": "missing fields"}]),
        ]
        for result in invalid_results:
            with self.subTest(result=result):
                with mock.patch.object(cleanup_job, "read_gcs_json_object", lambda *_args: (main_manifest(result=result), 1)):
                    with self.assertRaises(ValueError):
                        cleanup_job._main_record(cfg, "access-secret")

    def test_root_manifest_accepts_legacy_records_without_summary_but_rejects_malformed_summaries(self):
        cleanup_job._validate_root_manifest(root_manifest(), IDENTITY.run_id)

        for summary in [
            {"replay_status": "passed", "exploration_status": "passed", "exploration_actions": -1, "finding_count": 0},
            {"replay_status": "maybe", "exploration_status": "passed", "exploration_actions": 0, "finding_count": 0},
            {**main_summary(), "email": "owner@example.invalid"},
            {**main_summary(), "finding_summaries": "none"},
            {**main_summary(), "finding_summaries": [finding_summary(), finding_summary(), finding_summary(), finding_summary()]},
            {**main_summary(), "finding_summaries": [{**finding_summary(), "extra": "bad"}]},
            {**main_summary(), "finding_summaries": [{**finding_summary(), "severity": "info"}]},
            {**main_summary(), "finding_summaries": [{**finding_summary(), "title": "bad\ncontrol"}]},
            {**main_summary(), "finding_summaries": [{**finding_summary(), "title": "bad\u202eformat"}]},
            {**main_summary(), "finding_summaries": [{**finding_summary(), "title": "a" * 161}]},
            {**main_summary(), "finding_summaries": [{**finding_summary(), "title": "owner@example.com"}]},
            {**main_summary(), "finding_summaries": [{**finding_summary(), "title": "sk-live-secret123"}]},
            {**main_summary(), "finding_summaries": [{**finding_summary(), "title": "password leaked"}]},
            {**main_summary(), "finding_summaries": [{**finding_summary(), "title": "验证码 123456"}]},
            {**main_summary(), "finding_summaries": [{**finding_summary(), "title": "密码泄露"}]},
            {**main_summary(), "finding_summaries": [{**finding_summary(), "title": "123456"}]},
            {**main_summary(), "finding_summaries": [{**finding_summary(), "page_path": "relative"}]},
            {**main_summary(), "finding_summaries": [{**finding_summary(), "page_path": "/settings?token=secret"}]},
            {**main_summary(), "finding_summaries": [{**finding_summary(), "page_path": "/settings#secret"}]},
            {**main_summary(), "finding_summaries": [{**finding_summary(), "page_path": "/settings\u202e"}]},
            {"cleanup_failed": "false"},
        ]:
            bad = root_manifest(executions=[execution_record("main", "main-001", IDENTITY.run_id, summary=summary)])
            with self.subTest(summary=summary):
                with self.assertRaises(ValueError):
                    cleanup_job._validate_root_manifest(bad, IDENTITY.run_id)

    def test_cleanup_job_accepts_legacy_and_new_exact_summaries_but_rejects_mixtures(self):
        legacy_main = {
            "replay_status": "passed",
            "exploration_status": "not_started",
            "exploration_actions": 0,
            "finding_count": 0,
            "finding_summaries": [],
        }
        new_main = main_summary(
            coverage_candidate_count=2,
            fixed_case_status="failed",
            fixed_case_count=3,
            fixed_case_failed_count=1,
            phase_trace=["replay_done", "fixed_cases_done", "finalization_started"],
        )
        legacy_cleanup = {"cleanup_failed": False}
        new_cleanup = {"cleanup_failed": False, "cleanup_status": "not_required"}

        for summary, kind in [(legacy_main, "main"), (new_main, "main"), (legacy_cleanup, "cleanup"), (new_cleanup, "cleanup")]:
            with self.subTest(kind=kind, summary=summary):
                cleanup_job._validate_record_summary(kind, summary)

        malformed = [
            ("main", {**legacy_main, "coverage_candidate_count": 0}),
            ("main", {**new_main, "phase_trace": ["finalization_started", "replay_done"]}),
            ("main", {**new_main, "fixed_case_failed_count": 4}),
            ("cleanup", {"cleanup_status": "not_required"}),
            ("cleanup", {"cleanup_failed": False, "cleanup_status": "failed"}),
        ]
        for kind, summary in malformed:
            with self.subTest(kind=kind, summary=summary):
                with self.assertRaises(ValueError):
                    cleanup_job._validate_record_summary(kind, summary)

    def test_cleanup_job_builds_tri_state_cleanup_payload_and_summary(self):
        cfg = SimpleNamespace(run_id=IDENTITY.run_id, cleanup_execution_id="cleanup-001", main_execution_id="main-001")

        cases = [
            (CleanupResult(0, False, False, False, "not needed"), "not_required", "passed"),
            (CleanupResult(0, False, True, False, "account already absent"), "passed", "passed"),
            (CleanupResult(0, False, False, True, "cleanup failed"), "failed", "cleanup_failed"),
        ]
        for result, cleanup_status, root_status in cases:
            with self.subTest(cleanup_status=cleanup_status):
                payload = cleanup_job._build_cleanup_payload(cfg, result, 2)
                self.assertEqual(payload["cleaned"]["cleanup_status"], cleanup_status)
                self.assertEqual(payload["status"], root_status)
                self.assertEqual(
                    cleanup_job._cleanup_summary(payload),
                    {"cleanup_failed": result.cleanup_failed, "cleanup_status": cleanup_status},
                )
                cleanup_job._validate_cleanup_manifest(payload, cfg)

    def test_merge_root_manifest_upgrades_exact_legacy_four_field_main_summary(self):
        cfg = SimpleNamespace(
            run_id=IDENTITY.run_id,
            gcs_bucket="flatkey-browser-qa-reports",
            main_execution_id="main-001",
            cleanup_execution_id="cleanup-001",
        )
        legacy_summary = {
            "replay_status": "passed",
            "exploration_status": "not_started",
            "exploration_actions": 0,
            "finding_count": 0,
        }
        legacy_root = root_manifest(
            latest={"main_execution_id": "main-001", "cleanup_execution_id": "cleanup-001"},
            executions=[
                execution_record("main", "main-001", IDENTITY.run_id, summary=legacy_summary),
                execution_record("cleanup", "cleanup-001", IDENTITY.run_id, created_at=2, summary={"cleanup_failed": False}),
            ],
        )
        cleanup_record = legacy_root["executions"][1]

        with mock.patch.object(cleanup_job, "read_gcs_json_object", lambda *_args: (main_manifest(), 1)):
            upgraded = cleanup_job._merge_root_manifest(legacy_root, cfg, cleanup_record, "access-secret")

        self.assertEqual(upgraded["executions"][0]["summary"], main_summary())
        cleanup_job._validate_root_manifest(upgraded, IDENTITY.run_id)

        conflicting = root_manifest(
            latest={"main_execution_id": "main-001", "cleanup_execution_id": "cleanup-001"},
            executions=[
                execution_record("main", "main-001", IDENTITY.run_id, summary={**legacy_summary, "finding_count": 1}),
                cleanup_record,
            ],
        )
        with mock.patch.object(cleanup_job, "read_gcs_json_object", lambda *_args: (main_manifest(), 1)):
            with self.assertRaises(ValueError):
                cleanup_job._merge_root_manifest(conflicting, cfg, cleanup_record, "access-secret")

    def test_merge_root_manifest_reentry_deduplicates_summarized_records_and_upgrades_legacy_records(self):
        cfg = SimpleNamespace(
            run_id=IDENTITY.run_id,
            gcs_bucket="flatkey-browser-qa-reports",
            main_execution_id="main-001",
            cleanup_execution_id="cleanup-001",
        )
        summarized_main = execution_record("main", "main-001", IDENTITY.run_id, summary=main_summary())
        summarized_cleanup = execution_record("cleanup", "cleanup-001", IDENTITY.run_id, created_at=2, summary={"cleanup_failed": False})
        summarized_root = root_manifest(
            latest={"main_execution_id": "main-001", "cleanup_execution_id": "cleanup-001"},
            executions=[summarized_main, summarized_cleanup],
        )

        with mock.patch.object(cleanup_job, "read_gcs_json_object", lambda *_args: (main_manifest(), 1)):
            reentered = cleanup_job._merge_root_manifest(summarized_root, cfg, summarized_cleanup, "access-secret")

        self.assertEqual(len(reentered["executions"]), 2)
        self.assertEqual(reentered["executions"], [summarized_main, summarized_cleanup])
        cleanup_job._validate_root_manifest(reentered, IDENTITY.run_id)

        legacy_root = root_manifest(
            latest={"main_execution_id": "main-001", "cleanup_execution_id": "cleanup-001"},
            executions=[
                execution_record("main", "main-001", IDENTITY.run_id),
                execution_record("cleanup", "cleanup-001", IDENTITY.run_id, created_at=2),
            ],
        )

        with mock.patch.object(cleanup_job, "read_gcs_json_object", lambda *_args: (main_manifest(), 1)):
            upgraded = cleanup_job._merge_root_manifest(legacy_root, cfg, summarized_cleanup, "access-secret")

        self.assertEqual(len(upgraded["executions"]), 2)
        self.assertEqual(upgraded["executions"], [summarized_main, summarized_cleanup])
        cleanup_job._validate_root_manifest(upgraded, IDENTITY.run_id)

    def test_merge_root_manifest_missing_main_placeholder_reentry_and_real_main_upgrade(self):
        cfg = SimpleNamespace(
            run_id=IDENTITY.run_id,
            gcs_bucket="flatkey-browser-qa-reports",
            main_execution_id="main-001",
            cleanup_execution_id="cleanup-001",
        )
        placeholder = missing_main_record("main-001", IDENTITY.run_id)
        cleanup_record = execution_record("cleanup", "cleanup-001", IDENTITY.run_id, created_at=2, summary={"cleanup_failed": False})

        existing_trusted = root_manifest(
            latest={"main_execution_id": "main-001", "cleanup_execution_id": "cleanup-001"},
            executions=[
                execution_record("main", "main-001", IDENTITY.run_id, status="replay_failed", summary=main_summary(replay_status="failed")),
                cleanup_record,
            ],
        )
        with mock.patch.object(cleanup_job, "read_gcs_json_object", mock.Mock(side_effect=FileNotFoundError("missing"))):
            try:
                preserved = cleanup_job._merge_root_manifest(existing_trusted, cfg, cleanup_record, "access-secret")
            except FileNotFoundError as exc:
                self.fail(f"existing trusted main record should be preserved when main object is missing: {exc}")
        self.assertEqual(preserved["executions"], existing_trusted["executions"])
        self.assertEqual(preserved["status"], "replay_failed")

        placeholder_root = root_manifest(
            latest={"main_execution_id": "main-001", "cleanup_execution_id": "cleanup-001"},
            executions=[placeholder, cleanup_record],
        )
        with mock.patch.object(cleanup_job, "read_gcs_json_object", mock.Mock(side_effect=FileNotFoundError("missing"))):
            try:
                reentered = cleanup_job._merge_root_manifest(placeholder_root, cfg, cleanup_record, "access-secret")
            except FileNotFoundError as exc:
                self.fail(f"missing-main placeholder should be reusable on reentry: {exc}")
        self.assertEqual(reentered["executions"], [placeholder, cleanup_record])
        self.assertEqual(reentered["status"], "infrastructure_failed")

        real_main = execution_record("main", "main-001", IDENTITY.run_id, summary=main_summary())
        with mock.patch.object(cleanup_job, "read_gcs_json_object", lambda *_args: (main_manifest(), 1)):
            upgraded = cleanup_job._merge_root_manifest(placeholder_root, cfg, cleanup_record, "access-secret")
        self.assertEqual(upgraded["executions"], [real_main, cleanup_record])
        self.assertEqual(upgraded["status"], "passed")

    def test_merge_root_manifest_keeps_latest_main_and_cleanup_append_monotonic(self):
        cfg = SimpleNamespace(
            run_id=IDENTITY.run_id,
            gcs_bucket="flatkey-browser-qa-reports",
            main_execution_id="main-001",
            cleanup_execution_id="cleanup-010",
        )
        existing = root_manifest(
            latest={"main_execution_id": "main-099", "cleanup_execution_id": "cleanup-009"},
            executions=[
                execution_record("main", "main-001", IDENTITY.run_id, created_at=100),
                execution_record("main", "main-099", IDENTITY.run_id, created_at=200),
                execution_record("cleanup", "cleanup-009", IDENTITY.run_id, created_at=300),
            ],
        )
        cleanup_record = execution_record("cleanup", "cleanup-010", IDENTITY.run_id, created_at=250)
        with mock.patch.object(cleanup_job, "read_gcs_json_object", lambda *_args: (main_manifest(created_at=100), 1)):
            merged = cleanup_job._merge_root_manifest(existing, cfg, cleanup_record, "access-secret")

        self.assertEqual(merged["latest"], {"main_execution_id": "main-099", "cleanup_execution_id": "cleanup-009"})

    def test_merge_root_manifest_latest_attempt_status_supersedes_failed_history(self):
        cfg = SimpleNamespace(
            run_id=IDENTITY.run_id,
            gcs_bucket="flatkey-browser-qa-reports",
            main_execution_id="main-002",
            cleanup_execution_id="cleanup-002",
        )
        existing = root_manifest(
            status="infrastructure_failed",
            latest={"main_execution_id": "main-001", "cleanup_execution_id": "cleanup-001"},
            executions=[
                execution_record(
                    "main",
                    "main-001",
                    IDENTITY.run_id,
                    status="infrastructure_failed",
                    created_at=10,
                ),
                execution_record("cleanup", "cleanup-001", IDENTITY.run_id, created_at=20),
            ],
        )
        cleanup_record = execution_record("cleanup", "cleanup-002", IDENTITY.run_id, created_at=40)
        new_main = main_manifest(execution_id="main-002", created_at=30)

        with mock.patch.object(cleanup_job, "read_gcs_json_object", lambda *_args: (new_main, 1)):
            merged = cleanup_job._merge_root_manifest(existing, cfg, cleanup_record, "access-secret")

        self.assertEqual(
            merged["latest"],
            {"main_execution_id": "main-002", "cleanup_execution_id": "cleanup-002"},
        )
        self.assertEqual(merged["status"], "passed")
        self.assertEqual(len(merged["executions"]), 4)

    def test_cleanup_recovery_for_older_main_preserves_latest_pair_and_candidates(self):
        cfg = SimpleNamespace(
            run_id=IDENTITY.run_id,
            gcs_bucket="flatkey-browser-qa-reports",
            main_execution_id="main-001",
            cleanup_execution_id="cleanup-recovery-001",
        )
        target_url = "https://staging-console.flatkey.ai/register"
        proposed = proposed_case()
        candidate = promotion.build_candidate_bundle(
            {
                "kind": "coverage",
                "fingerprint": promotion.canonical_fingerprint("coverage", target_url, proposed),
                "target_url": target_url,
                "proposed_case": proposed,
            },
            run_id=IDENTITY.run_id,
            evidence_uri=(
                f"gs://flatkey-browser-qa-reports/runs/{IDENTITY.run_id}/main/main-002/manifest.json"
            ),
        )
        existing_latest = {"main_execution_id": "main-002", "cleanup_execution_id": "cleanup-002"}
        existing = root_manifest(
            latest=existing_latest,
            executions=[
                execution_record("main", "main-001", IDENTITY.run_id, created_at=10),
                execution_record("main", "main-002", IDENTITY.run_id, created_at=30),
                execution_record("cleanup", "cleanup-002", IDENTITY.run_id, created_at=40),
            ],
            candidates=[candidate],
        )
        recovery_cleanup = execution_record(
            "cleanup",
            "cleanup-recovery-001",
            IDENTITY.run_id,
            created_at=50,
        )
        old_main = main_manifest(execution_id="main-001", created_at=10)

        with mock.patch.object(cleanup_job, "read_gcs_json_object", lambda *_args: (old_main, 1)):
            merged = cleanup_job._merge_root_manifest(existing, cfg, recovery_cleanup, "access-secret")

        self.assertEqual(merged["latest"], existing_latest)
        self.assertEqual(merged["candidates"], [candidate])
        self.assertEqual(merged["status"], "passed")
        self.assertIn(recovery_cleanup, merged["executions"])

    def test_merge_root_manifest_tie_breaks_latest_by_execution_id(self):
        cfg = SimpleNamespace(
            run_id=IDENTITY.run_id,
            gcs_bucket="flatkey-browser-qa-reports",
            main_execution_id="main-001",
            cleanup_execution_id="cleanup-010",
        )
        existing = root_manifest(
            latest={"main_execution_id": "main-001", "cleanup_execution_id": "cleanup-009"},
            executions=[
                execution_record("main", "main-001", IDENTITY.run_id, created_at=100),
                execution_record("cleanup", "cleanup-009", IDENTITY.run_id, created_at=250),
            ],
        )
        cleanup_record = execution_record("cleanup", "cleanup-010", IDENTITY.run_id, created_at=250)
        with mock.patch.object(cleanup_job, "read_gcs_json_object", lambda *_args: (main_manifest(created_at=100), 1)):
            merged = cleanup_job._merge_root_manifest(existing, cfg, cleanup_record, "access-secret")

        self.assertEqual(merged["latest"], {"main_execution_id": "main-001", "cleanup_execution_id": "cleanup-010"})

    def test_cleanup_root_preserves_infrastructure_failed_main_status_proven_by_present_manifest(self):
        cfg = SimpleNamespace(
            run_id=IDENTITY.run_id,
            gcs_bucket="flatkey-browser-qa-reports",
            main_execution_id="main-001",
            cleanup_execution_id="cleanup-001",
        )
        cleanup_record = execution_record("cleanup", "cleanup-001", IDENTITY.run_id, created_at=20)
        main = main_manifest(status="infrastructure_failed", created_at=10)

        with mock.patch.object(cleanup_job, "read_gcs_json_object", lambda *_args: (main, 1)):
            merged = cleanup_job._merge_root_manifest(
                root_manifest(executions=[], latest={"main_execution_id": "main-001", "cleanup_execution_id": None}),
                cfg,
                cleanup_record,
                "access-secret",
            )

        self.assertEqual(merged["status"], "infrastructure_failed")
        self.assertEqual(merged["executions"][0]["status"], "infrastructure_failed")

    def test_supervisor_candidate_bundles_flow_through_cleanup_root_to_orchestrator(self):
        cfg = SimpleNamespace(
            run_id=IDENTITY.run_id,
            gcs_bucket="flatkey-browser-qa-reports",
            main_execution_id="main-001",
            cleanup_execution_id="cleanup-001",
        )
        proposed = proposed_case()
        target_url = "https://staging-console.flatkey.ai/register"
        fingerprint = promotion.canonical_fingerprint("coverage", target_url, proposed)
        candidate = promotion.build_candidate_bundle(
            {
                "kind": "coverage",
                "fingerprint": fingerprint,
                "target_url": target_url,
                "proposed_case": proposed,
            },
            run_id=IDENTITY.run_id,
            evidence_uri=f"gs://flatkey-browser-qa-reports/runs/{IDENTITY.run_id}/main/main-001/manifest.json",
        )
        main = main_manifest(
            candidates=[candidate],
            candidate_events=[{"kind": "candidate_bundle_failed", "candidate_kind": "finding"}],
        )
        cleanup_record = execution_record("cleanup", "cleanup-001", IDENTITY.run_id, created_at=2, summary={"cleanup_failed": False})

        with mock.patch.object(cleanup_job, "read_gcs_json_object", lambda *_args: (main, 1)):
            merged = cleanup_job._merge_root_manifest(
                root_manifest(executions=[], latest={"main_execution_id": "main-001", "cleanup_execution_id": None}),
                cfg,
                cleanup_record,
                "access-secret",
            )

        self.assertEqual(merged["candidates"], [candidate])
        self.assertEqual(merged["candidate_events"], [{"kind": "candidate_bundle_failed", "candidate_kind": "finding"}])
        cleanup_job._validate_root_manifest(merged, IDENTITY.run_id, expected_bucket="flatkey-browser-qa-reports")
        plan = candidate_orchestrator.build_execution_plan(
            merged,
            expected_bucket="flatkey-browser-qa-reports",
            run_id=IDENTITY.run_id,
        )
        self.assertEqual(len(plan["candidates"]), 1)
        self.assertEqual(plan["candidates"][0]["fingerprint"], fingerprint)

    def test_main_manifest_rejects_malformed_candidate_fields_before_root_publication(self):
        cfg = SimpleNamespace(
            run_id=IDENTITY.run_id,
            gcs_bucket="flatkey-browser-qa-reports",
            main_execution_id="main-001",
        )
        proposed = proposed_case()
        target_url = "https://staging-console.flatkey.ai/register"
        fingerprint = promotion.canonical_fingerprint("coverage", target_url, proposed)
        valid_candidate = promotion.build_candidate_bundle(
            {
                "kind": "coverage",
                "fingerprint": fingerprint,
                "target_url": target_url,
                "proposed_case": proposed,
            },
            run_id=IDENTITY.run_id,
            evidence_uri=f"gs://flatkey-browser-qa-reports/runs/{IDENTITY.run_id}/main/main-001/manifest.json",
        )
        bad_cases = [
            main_manifest(candidates={}),
            main_manifest(candidates=[valid_candidate, valid_candidate]),
            main_manifest(candidates=[{**valid_candidate, "extra": True}]),
            main_manifest(candidates=[{**valid_candidate, "fingerprint": "sha256:" + "0" * 64}]),
            main_manifest(candidates=[{**valid_candidate, "source": {"run_id": IDENTITY.run_id, "evidence_uri": f"gs://other/runs/{IDENTITY.run_id}/main/main-001/manifest.json"}}]),
            main_manifest(candidates=[{**valid_candidate, "source": {"run_id": IDENTITY.run_id, "evidence_uri": f"gs://flatkey-browser-qa-reports/runs/{IDENTITY.run_id}/main/other-main/manifest.json"}}]),
            main_manifest(candidates=[{**valid_candidate, "proposed_case": {**proposed, "steps": [{"navigate": {"path": "/screenshots/raw.png"}}]}}]),
            main_manifest(candidate_events=[{"kind": "candidate_bundle_failed", "candidate_kind": "other"}]),
            main_manifest(candidate_events=[{"kind": "candidate_bundle_failed", "candidate_kind": "coverage", "detail": "raw"}]),
        ]

        for manifest in bad_cases:
            with self.subTest(manifest=manifest):
                with mock.patch.object(cleanup_job, "read_gcs_json_object", lambda *_args: (manifest, 1)):
                    with self.assertRaises(ValueError):
                        cleanup_job._main_record(cfg, "access-secret")

    def test_merge_root_manifest_preserves_existing_trusted_candidates_when_main_is_missing(self):
        cfg = SimpleNamespace(
            run_id=IDENTITY.run_id,
            gcs_bucket="flatkey-browser-qa-reports",
            main_execution_id="main-001",
            cleanup_execution_id="cleanup-001",
        )
        candidate = supervisor_candidate_bundle()
        cleanup_record = execution_record("cleanup", "cleanup-001", IDENTITY.run_id, created_at=2, summary={"cleanup_failed": False})
        trusted_root = root_manifest(
            latest={"main_execution_id": "main-001", "cleanup_execution_id": "cleanup-001"},
            executions=[
                execution_record("main", "main-001", IDENTITY.run_id, status="replay_failed", summary=main_summary(replay_status="failed")),
                cleanup_record,
            ],
            candidates=[candidate],
        )

        with mock.patch.object(cleanup_job, "read_gcs_json_object", mock.Mock(side_effect=FileNotFoundError("missing"))):
            preserved = cleanup_job._merge_root_manifest(trusted_root, cfg, cleanup_record, "access-secret")

        self.assertEqual(preserved["candidates"], [candidate])
        cleanup_job._validate_root_manifest(preserved, IDENTITY.run_id, expected_bucket="flatkey-browser-qa-reports")

        placeholder_root = root_manifest(
            latest={"main_execution_id": "main-001", "cleanup_execution_id": "cleanup-001"},
            executions=[missing_main_record("main-001", IDENTITY.run_id), cleanup_record],
            candidates=[candidate],
        )
        with mock.patch.object(cleanup_job, "read_gcs_json_object", mock.Mock(side_effect=FileNotFoundError("missing"))):
            conservative = cleanup_job._merge_root_manifest(placeholder_root, cfg, cleanup_record, "access-secret")
        self.assertEqual(conservative["candidates"], [])


class FakeGcpClient:
    def __init__(self, token):
        self.token = token

    def access_token(self):
        return self.token


def cleanup_env(seed, *, main_execution_id, cleanup_execution_id):
    return {
        "FLATKEY_QA_RUN_ID": IDENTITY.run_id,
        "FLATKEY_QA_IDENTITY_SEED_B64": base64.b64encode(seed).decode("ascii"),
        "FLATKEY_QA_CONSOLE_ORIGIN": "https://staging-console.flatkey.ai",
        "FLATKEY_BROWSER_QA_GCS_BUCKET": "flatkey-browser-qa-reports",
        "FLATKEY_BROWSER_QA_MAIN_EXECUTION_ID": main_execution_id,
        "FLATKEY_BROWSER_QA_CLEANUP_EXECUTION_ID": cleanup_execution_id,
    }


def main_manifest(**overrides):
    payload = {
        "schema_version": 1,
        "kind": "main",
        "run_id": IDENTITY.run_id,
        "execution_id": "main-001",
        "status": "passed",
        "created_at": 1,
        "result": valid_main_result(),
        "cleanup": {},
        "provenance": valid_provenance(),
    }
    payload.update(overrides)
    return payload


def valid_provenance(**overrides):
    payload = {
        "skill_name": "flatkey-new-user-onboarding",
        "skill_content_sha256": "a" * 64,
        "codex_version": "codex 1.2.3",
        "model_config": {
            "model": "gpt-5.4",
            "sandbox": "workspace-write",
            "network_access": False,
        },
        "playwright_mcp_version": "playwright-mcp 1.0.0",
        "playwright_package_version": "1.50.0",
        "chromium_version": "Chromium 123.0.0.0",
    }
    payload.update(overrides)
    return payload


def valid_main_result(**overrides):
    payload = {
        "replay": {"status": "passed", "checkpoint_reached": True},
        "exploration": {"status": "not_started", "actions_used": 0},
        "budgets": {"replay_seconds": 300, "exploration_seconds": 300, "max_actions": 30},
        "findings": [],
        "coverage_candidates": [],
        "fixed_cases": {"status": "not_started", "cases": []},
        "phase_trace": [],
    }
    payload.update(overrides)
    return payload


def finding(**overrides):
    payload = {
        "severity": "high",
        "title": "Unsafe redirect",
        "target_url": "https://staging-console.flatkey.ai/admin",
        "steps": ["open page"],
        "expected": "safe",
        "actual": "unsafe",
        "evidence_paths": ["screenshots/safe.png"],
        "confidence": "high",
        "proposed_case": None,
    }
    payload.update(overrides)
    return payload


def proposed_case():
    return {
        "fixture": "anonymous",
        "start": {"origin": "staging_console", "path": "/register"},
        "steps": [{"navigate": {"path": "/register"}}],
        "assertions": [{"page_status_not": 500}],
        "cleanup": "not_required",
    }


def supervisor_candidate_bundle():
    target_url = "https://staging-console.flatkey.ai/register"
    proposed = proposed_case()
    fingerprint = promotion.canonical_fingerprint("coverage", target_url, proposed)
    return promotion.build_candidate_bundle(
        {
            "kind": "coverage",
            "fingerprint": fingerprint,
            "target_url": target_url,
            "proposed_case": proposed,
        },
        run_id=IDENTITY.run_id,
        evidence_uri=f"gs://flatkey-browser-qa-reports/runs/{IDENTITY.run_id}/main/main-001/manifest.json",
    )


def main_summary(**overrides):
    payload = {
        "replay_status": "passed",
        "exploration_status": "not_started",
        "exploration_actions": 0,
        "finding_count": 0,
        "finding_summaries": [],
        "coverage_candidate_count": 0,
        "fixed_case_status": "not_started",
        "fixed_case_count": 0,
        "fixed_case_failed_count": 0,
        "phase_trace": [],
    }
    payload.update(overrides)
    return payload


def finding_summary(**overrides):
    payload = {
        "severity": "high",
        "title": "Unsafe redirect",
        "confidence": "high",
        "page_path": "/admin",
    }
    payload.update(overrides)
    return payload


def missing_main_record(execution_id, run_id):
    return execution_record(
        "main",
        execution_id,
        run_id,
        status="infrastructure_failed",
        created_at=0,
        summary={
            "replay_status": "failed",
            "exploration_status": "not_started",
            "exploration_actions": 0,
            "finding_count": 0,
            "finding_summaries": [],
        },
    )


def root_manifest(**overrides):
    payload = {
        "schema_version": 1,
        "run_id": IDENTITY.run_id,
        "status": "passed",
        "latest": {"main_execution_id": "main-001", "cleanup_execution_id": None},
        "executions": [execution_record("main", "main-001", IDENTITY.run_id)],
    }
    payload.update(overrides)
    return payload


def cleanup_manifest(**overrides):
    payload = {
        "schema_version": 1,
        "kind": "cleanup",
        "run_id": IDENTITY.run_id,
        "execution_id": "cleanup-001",
        "main_execution_id": "main-001",
        "created_at": 2,
        "status": "passed",
        "cleaned": {
            "cleanup_failed": False,
            "deleted_token_count": 0,
            "account_deleted": False,
            "login_rejected_after_delete": True,
            "reason": "account already absent",
        },
    }
    payload.update(overrides)
    return payload


def execution_record(kind, execution_id, run_id, **overrides):
    filename = "cleanup.json" if kind == "cleanup" else "manifest.json"
    payload = {
        "kind": kind,
        "execution_id": execution_id,
        "manifest": f"runs/{run_id}/{kind}/{execution_id}/{filename}",
        "status": "passed",
        "created_at": 1,
    }
    payload.update(overrides)
    return payload


if __name__ == "__main__":
    unittest.main()
