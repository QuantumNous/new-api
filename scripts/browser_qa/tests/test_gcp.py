import json
import unittest
import urllib.error

from scripts.browser_qa.flatkey_browser_qa import gcp
from scripts.browser_qa.flatkey_browser_qa.gcp import (
    GcpClient,
    GcpConfigError,
    GcpTransientError,
    GcsObjectAlreadyExists,
    read_gcs_json_object,
    upload_gcs_object,
)


class FakeResponse:
    def __init__(self, status, payload, headers=None):
        self.status = status
        self.payload = payload
        self.headers = headers or {}

    def read(self, _limit=-1):
        if isinstance(self.payload, bytes):
            return self.payload
        return json.dumps(self.payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


class RecordingOpener:
    def __init__(self, responses):
        self.responses = list(responses)
        self.requests = []

    def open(self, request, timeout=0):
        self.requests.append((request, timeout))
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


class GcpTests(unittest.TestCase):
    def test_metadata_identity_token_uses_exact_host_path_header_and_https_audience(self):
        opener = RecordingOpener(
            [
                FakeResponse(200, b"legacy-id-token", {"Metadata-Flavor": "Google"}),
                FakeResponse(200, b"regional-id-token", {"Metadata-Flavor": "Google"}),
            ]
        )
        client = GcpClient(opener=opener, retry_base_delay=0)

        token = client.identity_token("https://flatkey-staging-browser-qa-broker-abc-uw.a.run.app/")
        regional_token = client.identity_token("https://blogger-api-528088078482.us-central1.run.app/")

        self.assertEqual(token, "legacy-id-token")
        self.assertEqual(regional_token, "regional-id-token")
        request, timeout = opener.requests[0]
        self.assertEqual(request.host, "metadata.google.internal")
        self.assertEqual(request.selector.split("?", 1)[0], "/computeMetadata/v1/instance/service-accounts/default/identity")
        self.assertIn("audience=https%3A%2F%2Fflatkey-staging-browser-qa-broker-abc-uw.a.run.app", request.selector)
        self.assertEqual(request.headers["Metadata-flavor"], "Google")
        self.assertEqual(timeout, 5)
        regional_request, regional_timeout = opener.requests[1]
        self.assertEqual(regional_request.host, "metadata.google.internal")
        self.assertIn("audience=https%3A%2F%2Fblogger-api-528088078482.us-central1.run.app", regional_request.selector)
        self.assertNotIn("blogger-api-528088078482.us-central1.run.app%2F", regional_request.selector)
        self.assertEqual(regional_timeout, 5)

    def test_metadata_rejects_non_canonical_cloud_run_audience_and_retries_transient_only(self):
        client = GcpClient(opener=RecordingOpener([]), retry_base_delay=0)
        for audience in [
            "http://flatkey-staging-browser-qa-broker-abc-uw.a.run.app",
            "https://user:pass@flatkey-staging-browser-qa-broker-abc-uw.a.run.app",
            "https://flatkey-staging-browser-qa-broker-abc-uw.a.run.app:443",
            "https://flatkey-staging-browser-qa-broker-abc-uw.a.run.app/path",
            "https://flatkey-staging-browser-qa-broker-abc-uw.a.run.app?x=1",
            "https://flatkey-staging-browser-qa-broker-abc-uw.a.run.app#frag",
            "https://example.com",
            "https://bad_label_528088078482.us-central1.run.app",
        ]:
            with self.subTest(audience=audience):
                with self.assertRaises(GcpConfigError):
                    client.identity_token(audience)

        opener = RecordingOpener(
            [
                urllib.error.HTTPError("http://metadata.google.internal/x", 503, "busy", {}, io_bytes({})),
                urllib.error.URLError("timeout"),
                urllib.error.URLError("timeout"),
            ]
        )
        client = GcpClient(opener=opener, retry_base_delay=0)
        with self.assertRaises(GcpTransientError):
            client.access_token()
        self.assertEqual(len(opener.requests), 3)

    def test_access_token_and_gcs_upload_use_bounded_google_origins_without_secret_repr(self):
        opener = RecordingOpener(
            [
                FakeResponse(200, {"access_token": "access-secret", "expires_in": 3600}, {"Metadata-Flavor": "Google"}),
                FakeResponse(200, {"name": "reports/run/result.json"}),
            ]
        )
        client = GcpClient(opener=opener, retry_base_delay=0)

        token = client.access_token()
        upload_gcs_object(
            "flatkey-browser-qa-reports",
            "reports/123/result.json",
            b"{}",
            "application/json",
            token,
            opener=opener,
        )

        self.assertEqual(token, "access-secret")
        self.assertNotIn("access-secret", repr(client))
        upload_request = opener.requests[1][0]
        self.assertEqual(upload_request.host, "storage.googleapis.com")
        self.assertIn("/upload/storage/v1/b/flatkey-browser-qa-reports/o", upload_request.selector)
        self.assertIn("ifGenerationMatch=0", upload_request.selector)
        self.assertEqual(upload_request.headers["Authorization"], "Bearer access-secret")
        self.assertEqual(upload_request.headers["Content-type"], "application/json")

    def test_gcs_upload_accepts_explicit_generation_precondition(self):
        opener = RecordingOpener([FakeResponse(200, {"name": "reports/run/result.json"})])

        upload_gcs_object(
            "flatkey-browser-qa-reports",
            "reports/123/result.json",
            b"{}",
            "application/json",
            "access-secret",
            opener=opener,
            if_generation_match=123,
        )

        request = opener.requests[0][0]
        self.assertIn("ifGenerationMatch=123", request.selector)

    def test_read_gcs_json_object_returns_payload_and_generation(self):
        opener = RecordingOpener([FakeResponse(200, {"status": "passed"}, {"x-goog-generation": "456"})])

        payload, generation = read_gcs_json_object(
            "flatkey-browser-qa-reports",
            "runs/123/manifest.json",
            "access-secret",
            opener=opener,
        )

        self.assertEqual(payload, {"status": "passed"})
        self.assertEqual(generation, 456)
        request = opener.requests[0][0]
        self.assertEqual(request.get_method(), "GET")
        self.assertEqual(request.host, "storage.googleapis.com")
        self.assertIn("/storage/v1/b/flatkey-browser-qa-reports/o/runs%2F123%2Fmanifest.json", request.selector)

    def test_read_gcs_json_object_distinguishes_missing_precondition_and_invalid_body(self):
        missing = RecordingOpener([urllib.error.HTTPError("https://storage.googleapis.com/x", 404, "missing", {}, io_bytes({}))])
        with self.assertRaises(FileNotFoundError):
            read_gcs_json_object("ok-bucket", "runs/123/manifest.json", "access-secret", opener=missing)

        precondition = RecordingOpener([urllib.error.HTTPError("https://storage.googleapis.com/x", 412, "precondition", {}, io_bytes({}))])
        with self.assertRaises(GcsObjectAlreadyExists):
            read_gcs_json_object("ok-bucket", "runs/123/manifest.json", "access-secret", opener=precondition)

        invalid = RecordingOpener([FakeResponse(200, b"not json", {"x-goog-generation": "1"})])
        with self.assertRaises(GcpConfigError):
            read_gcs_json_object("ok-bucket", "runs/123/manifest.json", "access-secret", opener=invalid)

        no_generation = RecordingOpener([FakeResponse(200, {}, {})])
        with self.assertRaises(GcpConfigError):
            read_gcs_json_object("ok-bucket", "runs/123/manifest.json", "access-secret", opener=no_generation)

        negative_generation = RecordingOpener([FakeResponse(200, {}, {"x-goog-generation": "-1"})])
        with self.assertRaises(GcpConfigError):
            read_gcs_json_object("ok-bucket", "runs/123/manifest.json", "access-secret", opener=negative_generation)

        bool_generation = RecordingOpener([FakeResponse(200, {}, {"x-goog-generation": "True"})])
        with self.assertRaises(GcpConfigError):
            read_gcs_json_object("ok-bucket", "runs/123/manifest.json", "access-secret", opener=bool_generation)

    def test_read_gcs_json_object_rejects_oversized_json(self):
        oversized = b'{"data":"' + (b"a" * (256 * 1024)) + b'"}'
        opener = RecordingOpener([FakeResponse(200, oversized, {"x-goog-generation": "1"})])

        with self.assertRaises(GcpConfigError):
            read_gcs_json_object("ok-bucket", "runs/123/manifest.json", "access-secret", opener=opener)

    def test_metadata_response_must_include_google_flavor_header(self):
        for headers in [{}, {"Metadata-Flavor": "NotGoogle"}]:
            opener = RecordingOpener([FakeResponse(200, {"access_token": "access-secret"}, headers)])
            client = GcpClient(opener=opener, retry_base_delay=0)
            with self.subTest(headers=headers):
                with self.assertRaises(GcpConfigError):
                    client.access_token()

    def test_gcs_upload_validates_bucket_object_and_rejects_redirects(self):
        token = "access-secret"
        too_long_name = "a" * 1025
        for bucket, name in [
            ("ab", "x"),
            ("a" * 64, "x"),
            ("Bad_Bucket", "x"),
            ("ok-bucket", "/absolute"),
            ("ok-bucket", "../escape"),
            ("ok-bucket", "bad\u0001name"),
            ("ok-bucket", too_long_name),
        ]:
            with self.subTest(bucket=bucket, name=name):
                with self.assertRaises(GcpConfigError):
                    upload_gcs_object(bucket, name, b"x", "text/plain", token, opener=RecordingOpener([]))

        opener = RecordingOpener([urllib.error.HTTPError("https://storage.googleapis.com/x", 302, "redirect", {}, io_bytes({}))])
        with self.assertRaises(GcpConfigError):
            upload_gcs_object("ok-bucket", "reports/x", b"x", "text/plain", token, opener=opener)

    def test_gcs_412_has_distinct_classification_for_first_attempt_and_lost_response_retry(self):
        first_exists = RecordingOpener(
            [urllib.error.HTTPError("https://storage.googleapis.com/x", 412, "precondition", {}, io_bytes({}))]
        )
        with self.assertRaises(gcp.GcsObjectAlreadyExists):
            upload_gcs_object("ok-bucket", "reports/x", b"x", "text/plain", "access-secret", opener=first_exists)

        lost_then_exists = RecordingOpener(
            [
                urllib.error.URLError("connection lost"),
                urllib.error.HTTPError("https://storage.googleapis.com/x", 412, "precondition", {}, io_bytes({})),
            ]
        )
        with self.assertRaises(gcp.GcsUploadUncertain):
            upload_gcs_object("ok-bucket", "reports/x", b"x", "text/plain", "access-secret", opener=lost_then_exists)


def io_bytes(payload):
    class Body:
        def read(self, _limit=-1):
            return json.dumps(payload).encode("utf-8")

        def close(self):
            return None

    return Body()


if __name__ == "__main__":
    unittest.main()
