import base64
import unittest

from scripts.browser_qa.flatkey_browser_qa.config import load_config
from scripts.browser_qa.flatkey_browser_qa.config import load_cleanup_config


def valid_env():
    return {
        "FLATKEY_QA_RUN_ID": "123456789",
        "FLATKEY_QA_IDENTITY_SEED_B64": base64.b64encode(b"seed-with-32-bytes-minimum-value").decode("ascii"),
        "FLATKEY_QA_GMAIL_BASE": "owner@gmail.com",
        "FLATKEY_QA_WEBSITE_ORIGIN": "https://staging-website.flatkey.ai",
        "FLATKEY_QA_CONSOLE_ORIGIN": "https://staging-console.flatkey.ai",
        "FLATKEY_QA_DOCS_ORIGIN": "https://docs.flatkey.ai",
    }


class ConfigTests(unittest.TestCase):
    def test_load_config_accepts_strict_values_without_repr_leaks(self):
        cfg = load_config(valid_env())

        self.assertEqual(cfg.run_id, "123456789")
        self.assertEqual(cfg.mode, "normal")
        self.assertNotIn("seed", repr(cfg))
        self.assertNotIn("owner", repr(cfg))
        self.assertNotIn("gmail", repr(cfg).lower())

    def test_load_config_accepts_core_mode_and_rejects_unknown_modes(self):
        core = valid_env()
        core["FLATKEY_BROWSER_QA_MODE"] = "core"
        self.assertEqual(load_config(core).mode, "core")

        invalid = valid_env()
        invalid["FLATKEY_BROWSER_QA_MODE"] = "explore"
        with self.assertRaises(ValueError):
            load_config(invalid)

    def test_load_config_rejects_missing_and_unknown_flatkey_env(self):
        missing = valid_env()
        del missing["FLATKEY_QA_RUN_ID"]
        with self.assertRaises(ValueError):
            load_config(missing)

        unknown = valid_env()
        unknown["FLATKEY_QA_EXTRA"] = "nope"
        with self.assertRaises(ValueError):
            load_config(unknown)

    def test_load_config_rejects_invalid_or_short_seed(self):
        invalid = valid_env()
        invalid["FLATKEY_QA_IDENTITY_SEED_B64"] = "not base64!!!"
        with self.assertRaises(ValueError):
            load_config(invalid)

        short = valid_env()
        short["FLATKEY_QA_IDENTITY_SEED_B64"] = base64.b64encode(b"short").decode("ascii")
        with self.assertRaises(ValueError):
            load_config(short)

    def test_load_config_rejects_non_ascii_decimal_run_id(self):
        env = valid_env()
        env["FLATKEY_QA_RUN_ID"] = "１２３"

        with self.assertRaises(ValueError):
            load_config(env)

    def test_load_config_rejects_non_exact_origins(self):
        for name in [
            "FLATKEY_QA_WEBSITE_ORIGIN",
            "FLATKEY_QA_CONSOLE_ORIGIN",
            "FLATKEY_QA_DOCS_ORIGIN",
        ]:
            env = valid_env()
            env[name] = env[name] + "/"
            with self.subTest(name=name):
                with self.assertRaises(ValueError):
                    load_config(env)

        env = valid_env()
        env["FLATKEY_QA_CONSOLE_ORIGIN"] = "https://staging-console.flatkey.ai:444"
        with self.assertRaises(ValueError):
            load_config(env)

    def test_load_cleanup_config_requires_only_cleanup_secrets_and_console_origin(self):
        env = {
            "FLATKEY_QA_RUN_ID": "123456789",
            "FLATKEY_QA_IDENTITY_SEED_B64": base64.b64encode(b"seed-with-32-bytes-minimum-value").decode("ascii"),
            "FLATKEY_QA_CONSOLE_ORIGIN": "https://staging-console.flatkey.ai",
            "FLATKEY_BROWSER_QA_GCS_BUCKET": "flatkey-browser-qa-reports",
            "FLATKEY_BROWSER_QA_MAIN_EXECUTION_ID": "main-001",
            "FLATKEY_BROWSER_QA_CLEANUP_EXECUTION_ID": "cleanup-001",
        }

        cfg = load_cleanup_config(env)

        self.assertEqual(cfg.run_id, "123456789")
        self.assertEqual(cfg.console_origin, "https://staging-console.flatkey.ai")
        self.assertEqual(cfg.gcs_bucket, "flatkey-browser-qa-reports")
        self.assertEqual(cfg.main_execution_id, "main-001")
        self.assertEqual(cfg.cleanup_execution_id, "cleanup-001")
        self.assertNotIn("seed", repr(cfg))

    def test_load_cleanup_config_rejects_unknown_cleanup_env_and_non_exact_origin(self):
        env = {
            "FLATKEY_QA_RUN_ID": "123456789",
            "FLATKEY_QA_IDENTITY_SEED_B64": base64.b64encode(b"seed-with-32-bytes-minimum-value").decode("ascii"),
            "FLATKEY_QA_CONSOLE_ORIGIN": "https://staging-console.flatkey.ai/",
            "FLATKEY_BROWSER_QA_GCS_BUCKET": "flatkey-browser-qa-reports",
            "FLATKEY_BROWSER_QA_MAIN_EXECUTION_ID": "main-001",
            "FLATKEY_BROWSER_QA_CLEANUP_EXECUTION_ID": "cleanup-001",
        }
        with self.assertRaises(ValueError):
            load_cleanup_config(env)

        env["FLATKEY_QA_CONSOLE_ORIGIN"] = "https://staging-console.flatkey.ai"
        env["FLATKEY_QA_GMAIL_BASE"] = "owner@gmail.com"
        with self.assertRaises(ValueError):
            load_cleanup_config(env)

    def test_load_cleanup_config_unknown_env_diagnostic_names_both_allowed_scopes(self):
        env = {
            "FLATKEY_QA_RUN_ID": "123456789",
            "FLATKEY_QA_IDENTITY_SEED_B64": base64.b64encode(b"seed-with-32-bytes-minimum-value").decode("ascii"),
            "FLATKEY_QA_CONSOLE_ORIGIN": "https://staging-console.flatkey.ai",
            "FLATKEY_BROWSER_QA_GCS_BUCKET": "flatkey-browser-qa-reports",
            "FLATKEY_BROWSER_QA_MAIN_EXECUTION_ID": "main-001",
            "FLATKEY_BROWSER_QA_CLEANUP_EXECUTION_ID": "cleanup-001",
            "FLATKEY_BROWSER_QA_EXTRA": "nope",
        }

        with self.assertRaisesRegex(ValueError, "unknown FLATKEY_QA_ or FLATKEY_BROWSER_QA_ environment variables"):
            load_cleanup_config(env)

    def test_load_cleanup_config_requires_and_validates_gcs_components(self):
        env = {
            "FLATKEY_QA_RUN_ID": "123456789",
            "FLATKEY_QA_IDENTITY_SEED_B64": base64.b64encode(b"seed-with-32-bytes-minimum-value").decode("ascii"),
            "FLATKEY_QA_CONSOLE_ORIGIN": "https://staging-console.flatkey.ai",
            "FLATKEY_BROWSER_QA_GCS_BUCKET": "flatkey-browser-qa-reports",
            "FLATKEY_BROWSER_QA_MAIN_EXECUTION_ID": "main-001",
            "FLATKEY_BROWSER_QA_CLEANUP_EXECUTION_ID": "cleanup-001",
        }
        for required in [
            "FLATKEY_BROWSER_QA_GCS_BUCKET",
            "FLATKEY_BROWSER_QA_MAIN_EXECUTION_ID",
            "FLATKEY_BROWSER_QA_CLEANUP_EXECUTION_ID",
        ]:
            missing = dict(env)
            del missing[required]
            with self.subTest(required=required):
                with self.assertRaises(ValueError):
                    load_cleanup_config(missing)

        for name, value in [
            ("FLATKEY_BROWSER_QA_MAIN_EXECUTION_ID", "../main"),
            ("FLATKEY_BROWSER_QA_MAIN_EXECUTION_ID", "main/001"),
            ("FLATKEY_BROWSER_QA_MAIN_EXECUTION_ID", ""),
            ("FLATKEY_BROWSER_QA_CLEANUP_EXECUTION_ID", "cleanup 001"),
        ]:
            invalid = dict(env)
            invalid[name] = value
            with self.subTest(name=name, value=value):
                with self.assertRaises(ValueError):
                    load_cleanup_config(invalid)


if __name__ == "__main__":
    unittest.main()
