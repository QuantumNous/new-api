import unittest
from types import SimpleNamespace

from scripts.browser_qa.flatkey_browser_qa import resource_guard


IDENTITY = SimpleNamespace(username="qa-user", password="qa-password")


class FakeClient:
    def __init__(self, pages, *, auth_rejected=False):
        self.pages = list(pages)
        self.auth_rejected = auth_rejected
        self.login_calls = []
        self.list_calls = []
        self.clear_calls = 0

    def login(self, username, password):
        self.login_calls.append((username, password))
        return SimpleNamespace(auth_rejected=self.auth_rejected)

    def list_tokens(self, *, page, size):
        self.list_calls.append((page, size))
        return self.pages[page - 1]

    def clear_cookies(self):
        self.clear_calls += 1


class ResourceGuardTests(unittest.TestCase):
    def test_capture_and_verify_accepts_exactly_the_same_checkpoint_token_set(self):
        clients = [
            FakeClient([(["11", "12"], 2)]),
            FakeClient([(["12", "11"], 2)]),
        ]
        guard = resource_guard.CheckpointResourceGuard(lambda: clients.pop(0))

        guard.capture(IDENTITY)
        guard.verify(IDENTITY)

        self.assertTrue(guard.checkpoint_captured)
        self.assertEqual(clients, [])

    def test_verify_rejects_added_removed_or_missing_checkpoint_resources(self):
        cases = [
            (["11"], ["11", "13"]),
            (["11", "12"], ["11"]),
        ]
        for baseline, current in cases:
            with self.subTest(baseline=baseline, current=current):
                clients = [
                    FakeClient([(baseline, len(baseline))]),
                    FakeClient([(current, len(current))]),
                ]
                guard = resource_guard.CheckpointResourceGuard(lambda: clients.pop(0))
                guard.capture(IDENTITY)
                with self.assertRaisesRegex(resource_guard.ResourceDriftError, "resource drift"):
                    guard.verify(IDENTITY)

        guard = resource_guard.CheckpointResourceGuard(lambda: FakeClient([([], 0)]))
        with self.assertRaisesRegex(resource_guard.ResourceDriftError, "baseline missing"):
            guard.verify(IDENTITY)

    def test_guard_paginates_boundedly_fails_closed_and_always_clears_cookies(self):
        client = FakeClient([(["11"], 2), (["12"], 2)])
        guard = resource_guard.CheckpointResourceGuard(lambda: client, page_size=1, max_pages=2)

        guard.capture(IDENTITY)

        self.assertEqual(client.list_calls, [(1, 1), (2, 1)])
        self.assertEqual(client.clear_calls, 1)

        rejected = FakeClient([([], 0)], auth_rejected=True)
        guard = resource_guard.CheckpointResourceGuard(lambda: rejected)
        with self.assertRaisesRegex(resource_guard.ResourceDriftError, "account unavailable"):
            guard.capture(IDENTITY)
        self.assertEqual(rejected.clear_calls, 1)

        non_converging = FakeClient([(["11"], 3), (["12"], 3)])
        guard = resource_guard.CheckpointResourceGuard(lambda: non_converging, page_size=1, max_pages=2)
        with self.assertRaisesRegex(resource_guard.ResourceDriftError, "pagination exceeded"):
            guard.capture(IDENTITY)
        self.assertEqual(non_converging.clear_calls, 1)

    def test_constructor_rejects_unbounded_or_invalid_pagination(self):
        for kwargs in [
            {"page_size": 0},
            {"page_size": 101},
            {"page_size": True},
            {"max_pages": 0},
            {"max_pages": True},
        ]:
            with self.subTest(kwargs=kwargs):
                with self.assertRaises(ValueError):
                    resource_guard.CheckpointResourceGuard(lambda: None, **kwargs)


if __name__ == "__main__":
    unittest.main()
