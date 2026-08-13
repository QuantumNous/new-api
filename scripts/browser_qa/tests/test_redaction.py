import json
import unittest

from scripts.browser_qa.flatkey_browser_qa.redaction import Redactor


class RedactionTests(unittest.TestCase):
    def test_redactor_repr_does_not_expose_configured_secrets(self):
        redactor = Redactor(
            email="owner+flatkey-qa-1-x@gmail.com",
            password="Aa1!secret",
            code="123456",
            extra_secrets=("extra-secret",),
        )

        text = repr(redactor)

        for secret in ["owner", "flatkey-qa", "Aa1!secret", "123456", "extra-secret"]:
            self.assertNotIn(secret, text)

    def test_redactor_removes_every_sensitive_representation(self):
        redactor = Redactor(
            email="owner+flatkey-qa-1-x@gmail.com",
            password="Aa1!secret",
            code="123456",
        )
        raw = {
            "Authorization": "Bearer sk-live-secret",
            "message": "owner@gmail.com 123456 Aa1!secret",
            "cookie": "sid=abc",
        }

        text = json.dumps(redactor.clean(raw), sort_keys=True)

        for secret in ["owner", "123456", "Aa1!secret", "sk-live-secret", "sid=abc"]:
            self.assertNotIn(secret, text)

    def test_redactor_recurses_lists_and_nested_dicts(self):
        redactor = Redactor(
            email="owner+flatkey-qa-1-x@gmail.com",
            password="Aa1!secret",
            code="123456",
        )
        raw = {
            "events": [
                {"text": "send to owner+flatkey-qa-1-x@gmail.com"},
                {"headers": {"Cookie": "sid=abc; csrftoken=secret"}},
            ]
        }

        text = json.dumps(redactor.clean(raw), sort_keys=True)

        self.assertNotIn("owner", text)
        self.assertNotIn("sid=abc", text)
        self.assertIn("[REDACTED_EMAIL]", text)

    def test_redactor_masks_api_keys_by_pattern(self):
        redactor = Redactor(email="owner+flatkey-qa-1-x@gmail.com")

        cleaned = redactor.clean("created sk-test-abcdefghijklmnopqrstuvwxyz0123456789")

        self.assertEqual(cleaned, "created [REDACTED_API_KEY]")

    def test_redactor_only_masks_exact_registered_verification_codes(self):
        redactor = Redactor(email="owner+flatkey-qa-1-x@gmail.com")

        self.assertEqual(redactor.clean("ticket 123456 remains"), "ticket 123456 remains")

        redactor.register_code("654321")
        self.assertEqual(redactor.clean("ticket 123456 code 654321"), "ticket 123456 code [REDACTED_CODE]")

    def test_redactor_accepts_current_alphanumeric_verification_codes(self):
        redactor = Redactor(email="owner+flatkey-qa-1-x@gmail.com")

        redactor.register_code("f1df22")
        redactor.register_code("abcdef")

        self.assertEqual(
            redactor.clean("ticket 123456 code f1df22 or abcdef"),
            "ticket 123456 code [REDACTED_CODE] or [REDACTED_CODE]",
        )

    def test_redactor_masks_credential_query_values_inside_nested_text(self):
        redactor = Redactor(email="owner+flatkey-qa-1-x@gmail.com", code="123456")
        raw = {
            "nested": [
                "https://example.test/callback?token=tok-secret&next=/ok&code=123456",
                "https://example.test/path?api_key=sk-test-abcdefghijklmnopqrstuvwxyz0123456789&empty=",
            ]
        }

        text = json.dumps(redactor.clean(raw), sort_keys=True)

        self.assertIn("token=[REDACTED_SECRET]", text)
        self.assertIn("next=/ok", text)
        self.assertIn("code=[REDACTED_SECRET]", text)
        self.assertIn("api_key=[REDACTED_SECRET]", text)
        self.assertNotIn("tok-secret", text)
        self.assertNotIn("123456", text)
        self.assertNotIn("sk-test-abcdefghijklmnopqrstuvwxyz0123456789", text)

    def test_redactor_masks_credential_query_values_inside_sentences(self):
        redactor = Redactor(email="owner+flatkey-qa-1-x@gmail.com")

        cleaned = redactor.clean(
            "open https://example.test/callback?refresh_token=refresh-secret&next=/ok after signup"
        )

        self.assertIn("refresh_token=[REDACTED_SECRET]", cleaned)
        self.assertIn("next=/ok", cleaned)
        self.assertNotIn("refresh-secret", cleaned)

    def test_redactor_normalizes_dash_keys_in_headers_and_query(self):
        redactor = Redactor(email="owner+flatkey-qa-1-x@gmail.com")
        raw = {
            "headers": {
                "x-api-key": "sk-test-abcdefghijklmnopqrstuvwxyz0123456789",
                "api-key": "secret-api-key",
            },
            "url": "https://example.test/path?x-api-key=query-secret&safe=ok",
        }

        text = json.dumps(redactor.clean(raw), sort_keys=True)

        self.assertIn("[REDACTED_SECRET]", text)
        self.assertIn("x-api-key=[REDACTED_SECRET]", text)
        self.assertIn("safe=ok", text)
        self.assertNotIn("secret-api-key", text)
        self.assertNotIn("query-secret", text)
        self.assertNotIn("sk-test-abcdefghijklmnopqrstuvwxyz0123456789", text)

    def test_redactor_masks_encoded_nested_url_and_fragment_secrets(self):
        redactor = Redactor(email="owner+flatkey-qa-1-x@gmail.com")
        raw = (
            "https://example.test/redirect?"
            "next=https%3A%2F%2Fnested.test%2Fcallback%3Ftoken%3Dnested-token%26safe%3Dok"
            "#access_token=fragment-token&state=ok"
        )

        cleaned = redactor.clean(raw)

        self.assertIn("nested.test", cleaned)
        self.assertIn("safe=ok", cleaned)
        self.assertIn("access_token=[REDACTED_SECRET]", cleaned)
        self.assertNotIn("nested-token", cleaned)
        self.assertNotIn("fragment-token", cleaned)

    def test_redactor_masks_fragment_secrets_without_query(self):
        redactor = Redactor(email="owner+flatkey-qa-1-x@gmail.com")

        cleaned = redactor.clean("https://example.test/callback#access_token=fragment-token&state=ok")

        self.assertIn("access_token=[REDACTED_SECRET]", cleaned)
        self.assertIn("state=ok", cleaned)
        self.assertNotIn("fragment-token", cleaned)


if __name__ == "__main__":
    unittest.main()
