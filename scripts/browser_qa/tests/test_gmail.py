import copy
import json
import os
import unittest
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from unittest import mock

from scripts.browser_qa.flatkey_browser_qa.gmail import (
    GmailClient,
    GmailConfigError,
    GmailInvalidGrant,
    GmailTransientError,
    OAuthCredentials,
    VerificationSearch,
    _default_opener,
    parse_verification_code,
)


FIXTURE = Path(__file__).parent / "fixtures" / "gmail_flatkey_message.json"
ALIAS = "owner+qa-123456789-abc123de@gmail.com"


def load_message():
    message = json.loads(FIXTURE.read_text(encoding="utf-8"))
    message["payload"]["parts"][1]["body"]["data"] = b64url(
        '<html><body><div class="verification-code">654321</div></body></html>'
    )
    return message


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


class GmailParserTests(unittest.TestCase):
    def test_extracts_single_code_from_matching_plain_and_current_template_html_message(self):
        code = parse_verification_code(
            load_message(),
            alias=ALIAS,
            sender="noreply@flatkey.ai",
            subject_marker="Flatkey Email Verification",
            run_start_epoch=1800000000,
            now_epoch=1800000030,
        )

        self.assertEqual(code, "654321")

    def test_accepts_rfc2047_encoded_localized_subject_with_system_marker(self):
        message = load_message()
        subject = "Flatkey \u90ae\u7bb1\u9a8c\u8bc1"
        encoded = __import__("base64").b64encode(subject.encode("utf-8")).decode("ascii")
        message["payload"]["headers"][2]["value"] = f"=?UTF-8?B?{encoded}?="

        code = parse_verification_code(
            message,
            alias=ALIAS,
            sender="noreply@flatkey.ai",
            subject_marker="flatkey",
            run_start_epoch=1800000000,
            now_epoch=1800000030,
        )

        self.assertEqual(code, "654321")

    def test_rejects_malformed_rfc2047_subject(self):
        message = load_message()
        message["payload"]["headers"][2]["value"] = "=?UTF-8?B?not-base64?="

        code = parse_verification_code(
            message,
            alias=ALIAS,
            sender="noreply@flatkey.ai",
            subject_marker="flatkey",
            run_start_epoch=1800000000,
            now_epoch=1800000030,
        )

        self.assertIsNone(code)

    def test_accepts_real_html_only_email_shape(self):
        message = load_message()
        message["payload"]["mimeType"] = "text/html"
        message["payload"]["parts"] = []
        message["payload"]["body"] = {
            "data": b64url('<div class="verification-code">654321</div>')
        }

        code = parse_verification_code(
            message,
            alias=ALIAS,
            sender="noreply@flatkey.ai",
            subject_marker="Flatkey Email Verification",
            run_start_epoch=1800000000,
            now_epoch=1800000030,
        )

        self.assertEqual(code, "654321")

    def test_accepts_hex_registration_code_from_current_email_template(self):
        message = load_message()
        message["payload"]["mimeType"] = "text/html"
        message["payload"]["parts"] = []
        message["payload"]["body"] = {
            "data": b64url(
                '<div>Verification code</div><div class="verification-code">f1df22</div>'
                "<p>This link and code expire in 10 minutes.</p>"
            )
        }

        code = parse_verification_code(
            message,
            alias=ALIAS,
            sender="noreply@flatkey.ai",
            subject_marker="Flatkey Email Verification",
            run_start_epoch=1800000000,
            now_epoch=1800000030,
        )

        self.assertEqual(code, "f1df22")

    def test_accepts_all_letter_hex_registration_code_from_current_email_template(self):
        message = load_message()
        message["payload"]["mimeType"] = "text/html"
        message["payload"]["parts"] = []
        message["payload"]["body"] = {
            "data": b64url('<div class="verification-code">abcdef</div>')
        }

        code = parse_verification_code(
            message,
            alias=ALIAS,
            sender="noreply@flatkey.ai",
            subject_marker="Flatkey Email Verification",
            run_start_epoch=1800000000,
            now_epoch=1800000030,
        )

        self.assertEqual(code, "abcdef")

    def test_rejects_standalone_quarter_token_without_verification_code_markup(self):
        message = load_message()
        message["payload"]["mimeType"] = "text/html"
        message["payload"]["parts"] = []
        message["payload"]["body"] = {"data": b64url("<div>Release window: 2026Q3</div>")}

        code = parse_verification_code(
            message,
            alias=ALIAS,
            sender="noreply@flatkey.ai",
            subject_marker="Flatkey Email Verification",
            run_start_epoch=1800000000,
            now_epoch=1800000030,
        )

        self.assertIsNone(code)

    def test_rejects_plain_text_url_path_token_without_verification_code_markup(self):
        message = load_message()
        message["payload"]["mimeType"] = "text/plain"
        message["payload"]["parts"] = []
        message["payload"]["body"] = {
            "data": b64url("Open https://example.test/reset/abc123 to continue")
        }

        code = parse_verification_code(
            message,
            alias=ALIAS,
            sender="noreply@flatkey.ai",
            subject_marker="Flatkey Email Verification",
            run_start_epoch=1800000000,
            now_epoch=1800000030,
        )

        self.assertIsNone(code)

    def test_rejects_two_distinct_alphanumeric_verification_candidates(self):
        message = load_message()
        message["payload"]["mimeType"] = "text/html"
        message["payload"]["parts"] = []
        message["payload"]["body"] = {
            "data": b64url(
                '<div class="verification-code">f1df22</div>'
                '<div class="verification-code">a1b2c3</div>'
            )
        }

        code = parse_verification_code(
            message,
            alias=ALIAS,
            sender="noreply@flatkey.ai",
            subject_marker="Flatkey Email Verification",
            run_start_epoch=1800000000,
            now_epoch=1800000030,
        )

        self.assertIsNone(code)

    def test_html_codes_in_links_scripts_styles_noscript_and_template_are_ignored(self):
        for html in [
            '<a href="https://example.test/verify?code=654321">verify</a>',
            "<script>var code = 654321;</script>",
            "<style>.code:before{content:'654321'}</style>",
            "<noscript>654321</noscript>",
            "<template>654321</template>",
        ]:
            message = load_message()
            message["payload"]["mimeType"] = "text/html"
            message["payload"]["parts"] = []
            message["payload"]["body"] = {"data": b64url(html)}
            with self.subTest(html=html):
                self.assertIsNone(
                    parse_verification_code(
                        message,
                        alias=ALIAS,
                        sender="noreply@flatkey.ai",
                        subject_marker="Flatkey Email Verification",
                        run_start_epoch=1800000000,
                        now_epoch=1800000030,
                    )
                )

    def test_rejects_wrong_alias_old_time_sender_subject_and_unrelated_mail(self):
        cases = []
        wrong_alias = load_message()
        wrong_alias["payload"]["headers"][1]["value"] = "owner+other@gmail.com"
        cases.append(wrong_alias)

        old = load_message()
        old["internalDate"] = "1799999999000"
        cases.append(old)

        future = load_message()
        future["internalDate"] = "1800004000000"
        cases.append(future)

        wrong_sender = load_message()
        wrong_sender["payload"]["headers"][0]["value"] = "Flatkey <support@example.com>"
        cases.append(wrong_sender)

        wrong_subject = load_message()
        wrong_subject["payload"]["headers"][2]["value"] = "Welcome"
        cases.append(wrong_subject)

        unrelated = {"id": "x", "internalDate": "1800000005000", "payload": {"headers": [], "body": {}}}
        cases.append(unrelated)

        for message in cases:
            with self.subTest(message=message.get("id")):
                self.assertIsNone(
                    parse_verification_code(
                        message,
                        alias=ALIAS,
                        sender="noreply@flatkey.ai",
                        subject_marker="Flatkey Email Verification",
                        run_start_epoch=1800000000,
                        now_epoch=1800000030,
                    )
                )

    def test_rejects_distinct_two_codes_attachment_only_and_malformed_payloads(self):
        two_codes = load_message()
        two_codes["payload"]["parts"][0]["body"]["data"] = "Q29kZXM6IDExMTExMSBhbmQgMjIyMjIy"
        two_codes["payload"]["parts"][1]["body"]["data"] = "Q29kZXM6IDExMTExMSBhbmQgMjIyMjIy"
        attachment_only = load_message()
        attachment_only["payload"]["parts"] = [{"mimeType": "application/pdf", "body": {"data": "NjU0MzIx"}}]
        malformed = load_message()
        malformed["payload"]["parts"][0]["body"]["data"] = "not base64!!!"
        malformed["payload"]["parts"][1]["body"]["data"] = "not base64!!!"

        for message in [two_codes, attachment_only, malformed]:
            self.assertIsNone(
                parse_verification_code(
                    message,
                    alias=ALIAS,
                    sender="noreply@flatkey.ai",
                    subject_marker="Flatkey Email Verification",
                    run_start_epoch=1800000000,
                    now_epoch=1800000030,
                )
            )

    def test_rejects_deep_mime_tree_part_bomb_and_inline_attachment_codes(self):
        deep = load_message()
        node = deep["payload"]
        node["parts"] = []
        for _ in range(20):
            child = {"mimeType": "multipart/mixed", "headers": [], "parts": []}
            node["parts"] = [child]
            node = child
        node["parts"] = [{"mimeType": "text/plain", "body": {"data": b64url("654321")}}]

        bomb = load_message()
        bomb["payload"]["parts"] = [
            {"mimeType": "text/plain", "body": {"data": b64url("no code")}}
            for _ in range(100)
        ]
        bomb["payload"]["parts"].append({"mimeType": "text/plain", "body": {"data": b64url("654321")}})

        inline_attachment = load_message()
        inline_attachment["payload"]["parts"] = [
            {
                "mimeType": "text/plain",
                "filename": "code.txt",
                "headers": [{"name": "Content-Disposition", "value": "inline; filename=code.txt"}],
                "body": {"data": b64url("654321"), "attachmentId": "att-1"},
            }
        ]

        for message in [deep, bomb, inline_attachment]:
            self.assertIsNone(
                parse_verification_code(
                    message,
                    alias=ALIAS,
                    sender="noreply@flatkey.ai",
                    subject_marker="Flatkey Email Verification",
                    run_start_epoch=1800000000,
                    now_epoch=1800000030,
                )
            )

    def test_sender_header_must_contain_exactly_one_configured_address(self):
        message = load_message()
        message["payload"]["headers"][0]["value"] = "Flatkey <noreply@flatkey.ai>, Other <other@example.com>"

        self.assertIsNone(
            parse_verification_code(
                message,
                alias=ALIAS,
                sender="noreply@flatkey.ai",
                subject_marker="Flatkey Email Verification",
                run_start_epoch=1800000000,
                now_epoch=1800000030,
            )
        )


class GmailOAuthAndClientTests(unittest.TestCase):
    def valid_oauth_json(self):
        return json.dumps(
            {
                "refresh_token": "refresh-secret",
                "token_uri": "https://oauth2.googleapis.com/token",
                "client_id": "client-id",
                "client_secret": "client-secret",
                "scopes": ["https://www.googleapis.com/auth/gmail.readonly"],
            }
        )

    def test_oauth_credentials_load_only_from_env_and_do_not_leak_repr(self):
        with mock.patch.dict(os.environ, {"GMAIL_OAUTH_JSON": self.valid_oauth_json()}, clear=True):
            creds = OAuthCredentials.from_env()

        self.assertNotIn("refresh-secret", repr(creds))
        self.assertNotIn("client-secret", repr(creds))

    def test_oauth_credentials_reject_missing_broad_scope_and_untrusted_token_uri(self):
        bad_values = [
            {},
            {
                "refresh_token": "r",
                "token_uri": "https://oauth2.googleapis.com/token",
                "client_id": "c",
                "client_secret": "s",
                "scopes": ["https://mail.google.com/"],
            },
            {
                "refresh_token": "r",
                "token_uri": "https://accounts.google.com/o/oauth2/token",
                "client_id": "c",
                "client_secret": "s",
                "scopes": ["https://www.googleapis.com/auth/gmail.readonly"],
            },
        ]
        for value in bad_values:
            with self.subTest(value=value):
                with mock.patch.dict(os.environ, {"GMAIL_OAUTH_JSON": json.dumps(value)}, clear=True):
                    with self.assertRaises(GmailConfigError):
                        OAuthCredentials.from_env()

    def test_oauth_credential_values_must_be_non_empty_strings(self):
        for key in ["refresh_token", "token_uri", "client_id", "client_secret"]:
            payload = json.loads(self.valid_oauth_json())
            payload[key] = 123
            with self.subTest(key=key):
                with self.assertRaises(GmailConfigError):
                    OAuthCredentials.from_json(json.dumps(payload))

        payload = json.loads(self.valid_oauth_json())
        payload["client_id"] = " "
        with self.assertRaises(GmailConfigError):
            OAuthCredentials.from_json(json.dumps(payload))

    def test_default_opener_disables_environment_proxies(self):
        captured = []

        def fake_build_opener(*handlers):
            captured.extend(handlers)
            return object()

        with mock.patch.dict(os.environ, {"HTTPS_PROXY": "http://proxy.invalid:8080", "HTTP_PROXY": "http://proxy.invalid:8080"}):
            with mock.patch.object(urllib.request, "build_opener", fake_build_opener):
                _default_opener()

        proxy_handlers = [handler for handler in captured if isinstance(handler, urllib.request.ProxyHandler)]
        self.assertEqual(len(proxy_handlers), 1)
        self.assertEqual(proxy_handlers[0].proxies, {})

    def test_refresh_posts_form_data_and_classifies_invalid_grant_without_retry(self):
        opener = RecordingOpener(
            [
                urllib.error.HTTPError(
                    "https://oauth2.googleapis.com/token",
                    400,
                    "bad",
                    {},
                    io_bytes({"error": "invalid_grant"}),
                )
            ]
        )
        creds = OAuthCredentials.from_json(self.valid_oauth_json())
        client = GmailClient(creds, opener=opener, retry_base_delay=0)

        with self.assertRaises(GmailInvalidGrant):
            client.refresh_access_token()

        self.assertEqual(len(opener.requests), 1)
        request, timeout = opener.requests[0]
        self.assertEqual(request.full_url, "https://oauth2.googleapis.com/token")
        self.assertEqual(request.get_method(), "POST")
        self.assertEqual(request.headers["Content-type"], "application/x-www-form-urlencoded")
        self.assertIn(b"grant_type=refresh_token", request.data)
        self.assertEqual(timeout, 10)

    def test_refresh_retries_transient_responses_only_three_times(self):
        opener = RecordingOpener(
            [
                urllib.error.HTTPError("https://oauth2.googleapis.com/token", 503, "busy", {}, io_bytes({})),
                urllib.error.HTTPError("https://oauth2.googleapis.com/token", 429, "busy", {}, io_bytes({})),
                urllib.error.URLError("timeout"),
            ]
        )
        client = GmailClient(OAuthCredentials.from_json(self.valid_oauth_json()), opener=opener, retry_base_delay=0)

        with self.assertRaises(GmailTransientError):
            client.refresh_access_token()

        self.assertEqual(len(opener.requests), 3)

    def test_search_uses_profile_base_sender_bounded_query_including_spam(self):
        opener = RecordingOpener(
            [
                FakeResponse(200, {"access_token": "access-secret", "expires_in": 3600, "token_type": "Bearer"}),
                FakeResponse(200, {"emailAddress": "owner@gmail.com"}),
                FakeResponse(200, {"messages": [{"id": "msg-1"}]}),
                FakeResponse(200, load_message()),
            ]
        )
        client = GmailClient(OAuthCredentials.from_json(self.valid_oauth_json()), opener=opener, retry_base_delay=0)

        result = client.find_verification_code(
            VerificationSearch(
                email_tag="qa-123456789-abc123de",
                run_start_epoch=1800000000,
                sender="noreply@flatkey.ai",
                subject_marker="Flatkey Email Verification",
                now_epoch=1800000030,
            )
        )

        self.assertEqual(result, "654321")
        urls = [request.full_url for request, _ in opener.requests]
        self.assertIn("https://gmail.googleapis.com/gmail/v1/users/me/profile", urls[1])
        query_params = urllib.parse.parse_qs(urllib.parse.urlparse(urls[2]).query)
        self.assertEqual(
            query_params["q"],
            ["to:owner@gmail.com from:noreply@flatkey.ai after:1800000000"],
        )
        self.assertEqual(query_params["maxResults"], ["10"])
        self.assertEqual(query_params["includeSpamTrash"], ["true"])
        self.assertIn("format=full", urls[3])
        for request, _ in opener.requests[1:]:
            self.assertEqual(request.headers["Authorization"], "Bearer access-secret")

    def test_expired_access_token_refreshes_for_long_lived_client(self):
        opener = RecordingOpener(
            [
                FakeResponse(200, {"access_token": "first-token", "expires_in": 100, "token_type": "Bearer"}),
                FakeResponse(200, {"emailAddress": "owner@gmail.com"}),
                FakeResponse(200, {"messages": []}),
                FakeResponse(200, {"access_token": "second-token", "expires_in": 100, "token_type": "Bearer"}),
                FakeResponse(200, {"messages": []}),
            ]
        )
        now = [1000]
        client = GmailClient(
            OAuthCredentials.from_json(self.valid_oauth_json()),
            opener=opener,
            retry_base_delay=0,
            now=lambda: now[0],
        )

        search = VerificationSearch(
            email_tag="qa-123456789-abc123de",
            run_start_epoch=1800000000,
            sender="noreply@flatkey.ai",
            subject_marker="Flatkey Email Verification",
            now_epoch=1800000030,
        )
        client.find_verification_code(search)
        now[0] = 1200
        client.find_verification_code(search)

        auth_headers = [request.headers.get("Authorization") for request, _ in opener.requests if "gmail.googleapis.com" in request.full_url]
        self.assertIn("Bearer first-token", auth_headers)
        self.assertIn("Bearer second-token", auth_headers)

    def test_first_gmail_401_clears_token_and_refreshes_once(self):
        opener = RecordingOpener(
            [
                FakeResponse(200, {"access_token": "first-token", "expires_in": 3600, "token_type": "Bearer"}),
                urllib.error.HTTPError("https://gmail.googleapis.com/gmail/v1/users/me/profile", 401, "unauthorized", {}, io_bytes({})),
                FakeResponse(200, {"access_token": "second-token", "expires_in": 3600, "token_type": "Bearer"}),
                FakeResponse(200, {"emailAddress": "owner@gmail.com"}),
                FakeResponse(200, {"messages": []}),
            ]
        )
        client = GmailClient(OAuthCredentials.from_json(self.valid_oauth_json()), opener=opener, retry_base_delay=0)

        client.find_verification_code(
            VerificationSearch(
                email_tag="qa-123456789-abc123de",
                run_start_epoch=1800000000,
                sender="noreply@flatkey.ai",
                subject_marker="Flatkey Email Verification",
                now_epoch=1800000030,
            )
        )

        self.assertEqual(len([request for request, _ in opener.requests if request.full_url == "https://oauth2.googleapis.com/token"]), 2)

    def test_profile_base_email_rejects_plus_whitespace_and_missing_local_or_domain(self):
        for email_address in ["owner+qa@gmail.com", "owner @gmail.com", "@gmail.com", "owner@"]:
            opener = RecordingOpener(
                [
                    FakeResponse(200, {"access_token": "access-secret", "expires_in": 3600, "token_type": "Bearer"}),
                    FakeResponse(200, {"emailAddress": email_address}),
                ]
            )
            client = GmailClient(OAuthCredentials.from_json(self.valid_oauth_json()), opener=opener, retry_base_delay=0)
            with self.subTest(email=email_address):
                with self.assertRaises(GmailConfigError):
                    client.get_profile_email()


def io_bytes(payload):
    class Body:
        def read(self, _limit=-1):
            return json.dumps(payload).encode("utf-8")

        def close(self):
            return None

    return Body()


def b64url(text):
    return __import__("base64").urlsafe_b64encode(text.encode("utf-8")).decode("ascii").rstrip("=")


if __name__ == "__main__":
    unittest.main()
