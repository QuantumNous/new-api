import unittest

from scripts.browser_qa.flatkey_browser_qa.identity import derive_identity


def plus_alias(base, email_tag):
    local, domain = base.split("@", 1)
    return f"{local}+{email_tag}@{domain}"


class IdentityTests(unittest.TestCase):
    def test_identity_is_stable_without_exposing_seed(self):
        first = derive_identity(b"seed-with-32-bytes-minimum-value", "123456789")
        second = derive_identity(b"seed-with-32-bytes-minimum-value", "123456789")

        self.assertEqual(first, second)
        self.assertRegex(first.username, r"^qa[0-9]{8}[a-z0-9]{8}$")
        self.assertRegex(first.email_tag, r"^qa-123456789-[a-z0-9]{8}$")
        self.assertEqual(len(first.password), 20)
        self.assertEqual(first.key_name, "cloud-qa-123456789")
        self.assertNotIn("seed", repr(first))

    def test_staging_run_alias_stays_within_registration_email_contract(self):
        identity = derive_identity(b"seed-with-32-bytes-minimum-value", "30906966375")
        alias = plus_alias("qaowner123456@gmail.com", identity.email_tag)

        self.assertRegex(identity.email_tag, r"^qa-30906966375-[a-z0-9]{8}$")
        self.assertLessEqual(len(alias), 50)

    def test_identity_rejects_short_seed_and_non_decimal_run_id(self):
        with self.assertRaises(ValueError):
            derive_identity(b"short", "123456789")
        with self.assertRaises(ValueError):
            derive_identity(b"seed-with-32-bytes-minimum-value", "run-123")

    def test_password_contains_required_character_classes(self):
        identity = derive_identity(b"seed-with-32-bytes-minimum-value", "987654321")

        self.assertRegex(identity.password, r"[A-Z]")
        self.assertRegex(identity.password, r"[a-z]")
        self.assertRegex(identity.password, r"[0-9]")
        self.assertRegex(identity.password, r"[^A-Za-z0-9]")


if __name__ == "__main__":
    unittest.main()
