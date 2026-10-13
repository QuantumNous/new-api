package routing

import (
	"sort"
	"time"

	"smart-router/api"
)

type Health string

const (
	HealthHealthy   Health = "healthy"
	HealthDegraded  Health = "degraded"
	HealthUnhealthy Health = "unhealthy"
)

type Candidate struct {
	BindingID      string
	Group          string
	Model          string
	Protocol       api.Protocol
	ProtocolPlugin string
	Enabled        bool
	Health         Health
	CostMicrounits int64
	CooldownUntil  time.Time
}

type ActionKind string

const (
	ActionStop       ActionKind = "stop"
	ActionRetry      ActionKind = "retry"
	ActionRetryAfter ActionKind = "retry_after"
)

type Action struct {
	Kind  ActionKind
	Retry bool
	Delay time.Duration
}

func Select(
	request api.RouteRequest,
	candidates []Candidate,
	incumbentID string,
	now time.Time,
	hysteresisMicrounits int64,
) []api.Binding {
	allowed := requestedBindings(request.Bindings)
	eligible := make([]Candidate, 0, len(candidates))
	for _, candidate := range candidates {
		if !candidate.Enabled ||
			candidate.Group != request.Group ||
			candidate.Model != request.Model ||
			candidate.Protocol != request.Protocol ||
			(candidate.Health != HealthHealthy && candidate.Health != HealthDegraded) ||
			candidate.CooldownUntil.After(now) {
			continue
		}
		if len(allowed) > 0 && !allowed[candidate.BindingID] {
			continue
		}
		eligible = append(eligible, candidate)
	}
	sort.Slice(eligible, func(left, right int) bool {
		if eligible[left].CostMicrounits != eligible[right].CostMicrounits {
			return eligible[left].CostMicrounits < eligible[right].CostMicrounits
		}
		leftPenalty := healthPenalty(eligible[left].Health)
		rightPenalty := healthPenalty(eligible[right].Health)
		if leftPenalty != rightPenalty {
			return leftPenalty < rightPenalty
		}
		return eligible[left].BindingID < eligible[right].BindingID
	})
	if len(eligible) > 1 && incumbentID != "" {
		eligible = applyHysteresis(eligible, incumbentID, hysteresisMicrounits)
	}

	limit := request.AttemptLimit
	if limit > 5 {
		limit = 5
	}
	if limit > len(eligible) {
		limit = len(eligible)
	}
	selected := make([]api.Binding, 0, limit)
	for index := 0; index < limit; index++ {
		candidate := eligible[index]
		selected = append(selected, api.Binding{
			BindingID:      candidate.BindingID,
			ProtocolPlugin: candidate.ProtocolPlugin,
			Rank:           index + 1,
			CostMicrounits: candidate.CostMicrounits,
		})
	}
	return selected
}

func NextAction(outcome api.Outcome, remainingAttempts int, retryAfterMS int64) Action {
	if remainingAttempts <= 0 {
		return Action{Kind: ActionStop}
	}
	switch outcome {
	case api.OutcomeRateLimited429:
		if retryAfterMS < 0 || retryAfterMS > api.MaximumRetryAfterMS {
			return Action{Kind: ActionStop}
		}
		if retryAfterMS > 0 {
			return Action{
				Kind: ActionRetryAfter, Retry: true,
				Delay: time.Duration(retryAfterMS) * time.Millisecond,
			}
		}
		return Action{Kind: ActionRetry, Retry: true}
	case api.OutcomeUpstream5xx, api.OutcomeTransportPreWrite:
		return Action{Kind: ActionRetry, Retry: true}
	default:
		return Action{Kind: ActionStop}
	}
}

func CooldownUntil(outcome api.Outcome, now time.Time, retryAfterMS int64, consecutiveFailures int) time.Time {
	switch outcome {
	case api.OutcomeAuth401:
		return now.Add(15 * time.Minute)
	case api.OutcomeRateLimited429:
		if retryAfterMS < 0 || retryAfterMS > api.MaximumRetryAfterMS {
			return now.Add(24 * time.Hour)
		}
		if retryAfterMS > 0 {
			return now.Add(time.Duration(retryAfterMS) * time.Millisecond)
		}
		return now.Add(time.Minute)
	case api.OutcomeUpstream5xx:
		if consecutiveFailures < 1 {
			consecutiveFailures = 1
		}
		delay := 30 * time.Second
		for count := 1; count < consecutiveFailures && delay < 15*time.Minute; count++ {
			delay *= 2
		}
		if delay > 15*time.Minute {
			delay = 15 * time.Minute
		}
		return now.Add(delay)
	default:
		return time.Time{}
	}
}

func requestedBindings(bindings []api.Binding) map[string]bool {
	allowed := make(map[string]bool, len(bindings))
	for _, binding := range bindings {
		allowed[binding.BindingID] = true
	}
	return allowed
}

func healthPenalty(health Health) int {
	if health == HealthHealthy {
		return 0
	}
	return 1
}

func applyHysteresis(candidates []Candidate, incumbentID string, hysteresisMicrounits int64) []Candidate {
	cheapest := candidates[0].CostMicrounits
	for index, candidate := range candidates {
		if candidate.BindingID != incumbentID {
			continue
		}
		if candidate.CostMicrounits > cheapest+hysteresisMicrounits {
			return candidates
		}
		copy(candidates[1:index+1], candidates[0:index])
		candidates[0] = candidate
		return candidates
	}
	return candidates
}
