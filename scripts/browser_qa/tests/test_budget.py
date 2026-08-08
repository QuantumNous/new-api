import unittest

from scripts.browser_qa.flatkey_browser_qa.budget import (
    BudgetExceeded,
    ExplorationBudget,
    ReplayBudget,
)


class FakeClock:
    def __init__(self):
        self.now = 100.0

    def monotonic(self):
        return self.now

    def advance(self, seconds):
        self.now += seconds


class BudgetTests(unittest.TestCase):
    def test_exploration_stops_on_first_limit(self):
        clock = FakeClock()
        replay = ReplayBudget(900, clock)
        replay.mark_checkpoint()
        budget = ExplorationBudget(300, 30, clock)
        budget.start(replay)

        for _ in range(30):
            budget.consume_action()

        with self.assertRaises(BudgetExceeded):
            budget.consume_action()

    def test_exploration_requires_explicit_start(self):
        budget = ExplorationBudget(300, 30, FakeClock())

        with self.assertRaises(BudgetExceeded):
            budget.consume_action()

    def test_exploration_start_requires_replay_checkpoint(self):
        clock = FakeClock()
        replay = ReplayBudget(900, clock)
        budget = ExplorationBudget(300, 30, clock)

        with self.assertRaises(BudgetExceeded):
            budget.start(replay)

        replay.mark_checkpoint()
        budget.start(replay)
        self.assertEqual(budget.consume_action(), 1)

    def test_exploration_start_rejects_expired_replay_budget(self):
        clock = FakeClock()
        replay = ReplayBudget(10, clock)
        replay.mark_checkpoint()
        clock.advance(11)
        budget = ExplorationBudget(300, 30, clock)

        with self.assertRaises(BudgetExceeded):
            budget.start(replay)

    def test_exploration_stops_when_deadline_passes(self):
        clock = FakeClock()
        replay = ReplayBudget(900, clock)
        replay.mark_checkpoint()
        budget = ExplorationBudget(300, 30, clock)
        budget.start(replay)
        clock.advance(301)

        with self.assertRaises(BudgetExceeded):
            budget.consume_action()

    def test_exploration_can_start_from_explicit_monotonic_marker_time(self):
        clock = FakeClock()
        replay = ReplayBudget(900, clock)
        replay.mark_checkpoint()
        budget = ExplorationBudget(300, 30, clock)
        budget.start(replay, started_at=clock.monotonic())
        clock.advance(301)

        with self.assertRaises(BudgetExceeded):
            budget.consume_action()

    def test_replay_checkpoint_must_happen_before_exploration(self):
        replay = ReplayBudget(900, FakeClock())

        self.assertFalse(replay.can_start_exploration)
        replay.mark_checkpoint()
        self.assertTrue(replay.can_start_exploration)


if __name__ == "__main__":
    unittest.main()
