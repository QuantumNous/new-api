import unittest
from unittest import mock

from scripts.browser_qa.flatkey_browser_qa.origin_policy import OriginPolicy


class OriginPolicyTests(unittest.TestCase):
    def test_policy_denies_production_metadata_and_private_ips(self):
        policy = OriginPolicy.from_hosts(["staging-console.flatkey.ai", "docs.flatkey.ai"])

        for url in [
            "https://console.flatkey.ai",
            "http://169.254.169.254",
            "http://127.0.0.1",
        ]:
            with self.subTest(url=url):
                self.assertFalse(policy.decide(url).allowed)

    def test_policy_allows_configured_https_hosts(self):
        policy = OriginPolicy.from_hosts(["staging-console.flatkey.ai", "docs.flatkey.ai"])

        with mock.patch("socket.getaddrinfo", return_value=[(0, 0, 0, "", ("8.8.8.8", 0))]):
            self.assertTrue(policy.decide("https://staging-console.flatkey.ai/dashboard").allowed)
            self.assertTrue(policy.decide("https://staging-console.flatkey.ai:443/dashboard").allowed)
            self.assertTrue(policy.decide("https://docs.flatkey.ai/quickstart").allowed)

    def test_policy_rejects_credentials_schemes_and_unknown_hosts(self):
        policy = OriginPolicy.from_hosts(["staging-console.flatkey.ai"])

        for url in [
            "https://user:pass@staging-console.flatkey.ai",
            "file:///etc/passwd",
            "wss://staging-console.flatkey.ai/socket",
            "https://staging-website.flatkey.ai",
        ]:
            with self.subTest(url=url):
                self.assertFalse(policy.decide(url).allowed)

    def test_policy_rejects_non_default_or_invalid_https_ports(self):
        policy = OriginPolicy.from_hosts(["staging-console.flatkey.ai"])

        for url in [
            "https://staging-console.flatkey.ai:444/dashboard",
            "https://staging-console.flatkey.ai:bad/dashboard",
            "https://staging-console.flatkey.ai:99999/dashboard",
        ]:
            with self.subTest(url=url):
                self.assertFalse(policy.decide(url).allowed)

    def test_policy_allows_loopback_proxy_listener_only_when_configured(self):
        policy = OriginPolicy.from_hosts(
            ["staging-console.flatkey.ai"],
            loopback_proxy=("127.0.0.1", 18080),
        )

        self.assertTrue(policy.decide("http://127.0.0.1:18080").allowed)
        self.assertFalse(policy.decide("http://127.0.0.1:18081").allowed)

    def test_policy_denies_allowed_host_when_dns_fails_or_resolves_private(self):
        policy = OriginPolicy.from_hosts(["staging-console.flatkey.ai"])

        with mock.patch("socket.getaddrinfo", side_effect=OSError("dns unavailable")):
            self.assertFalse(policy.decide("https://staging-console.flatkey.ai").allowed)

        with mock.patch("socket.getaddrinfo", return_value=[(0, 0, 0, "", ("10.0.0.5", 0))]):
            self.assertFalse(policy.decide("https://staging-console.flatkey.ai").allowed)

    def test_policy_denies_allowed_host_when_dns_resolution_is_empty(self):
        policy = OriginPolicy.from_hosts(["staging-console.flatkey.ai"])

        with mock.patch("socket.getaddrinfo", return_value=[]):
            self.assertFalse(policy.decide("https://staging-console.flatkey.ai").allowed)


if __name__ == "__main__":
    unittest.main()
