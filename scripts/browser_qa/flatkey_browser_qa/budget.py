import time
import math
from dataclasses import dataclass


class BudgetExceeded(RuntimeError):
    pass


class _MonotonicClock:
    def monotonic(self):
        return time.monotonic()


@dataclass
class ReplayBudget:
    seconds: float
    clock: object = None

    def __post_init__(self):
        if self.seconds <= 0:
            raise ValueError("replay budget seconds must be positive")
        if self.clock is None:
            self.clock = _MonotonicClock()
        self._deadline = self.clock.monotonic() + self.seconds
        self._checkpoint = False

    @property
    def can_start_exploration(self):
        return self._checkpoint and self.clock.monotonic() <= self._deadline

    def ensure_active(self):
        if self.clock.monotonic() > self._deadline:
            raise BudgetExceeded("replay time budget exceeded")

    def mark_checkpoint(self):
        self.ensure_active()
        self._checkpoint = True


@dataclass
class ExplorationBudget:
    seconds: float
    max_actions: int
    clock: object = None

    def __post_init__(self):
        if self.seconds <= 0:
            raise ValueError("exploration budget seconds must be positive")
        if self.max_actions <= 0:
            raise ValueError("exploration action budget must be positive")
        if self.clock is None:
            self.clock = _MonotonicClock()
        self._deadline = None
        self._actions = 0

    @property
    def actions_consumed(self):
        return self._actions

    def start(self, replay_budget, *, started_at=None):
        if not isinstance(replay_budget, ReplayBudget):
            raise TypeError("replay_budget must be a ReplayBudget")
        if not replay_budget.can_start_exploration:
            raise BudgetExceeded("replay checkpoint is required before exploration")
        if self._deadline is None:
            marker = self.clock.monotonic() if started_at is None else started_at
            if not isinstance(marker, (int, float)) or isinstance(marker, bool) or not math.isfinite(marker):
                raise ValueError("exploration start time must be finite")
            self._deadline = float(marker) + self.seconds

    def consume_action(self):
        self._ensure_active()
        if self._actions >= self.max_actions:
            raise BudgetExceeded("exploration action budget exceeded")
        self._actions += 1
        return self._actions

    def _ensure_active(self):
        if self._deadline is None:
            raise BudgetExceeded("exploration has not started")
        if self.clock.monotonic() > self._deadline:
            raise BudgetExceeded("exploration time budget exceeded")
