package routing

import (
	"testing"
	"time"

	"smart-router/api"
)

func TestSelectIsEligiblePriceFirstDeterministicAndBounded(t *testing.T) {
	now := time.Unix(1000, 0)
	candidates := []Candidate{
		candidate("bnd-6", 60),
		candidate("bnd-2", 20),
		candidate("bnd-1", 10),
		candidate("bnd-5", 50),
		candidate("bnd-4", 40),
		candidate("bnd-3", 30),
		{
			BindingID: "bnd-cooling", Group: "g", Model: "m",
			Protocol: api.ProtocolChat, ProtocolPlugin: "chat-v1",
			Enabled: true, Health: HealthHealthy, CostMicrounits: 1,
			CooldownUntil: now.Add(time.Second),
		},
		{
			BindingID: "bnd-unhealthy", Group: "g", Model: "m",
			Protocol: api.ProtocolChat, ProtocolPlugin: "chat-v1",
			Enabled: true, Health: HealthUnhealthy, CostMicrounits: 2,
		},
		{
			BindingID: "bnd-unknown-health", Group: "g", Model: "m",
			Protocol: api.ProtocolChat, ProtocolPlugin: "chat-v1",
			Enabled: true, Health: "unknown", CostMicrounits: 3,
		},
	}
	request := api.RouteRequest{
		Kind: "route_request", SchemaVersion: 1, RequestID: "r",
		Group: "g", Model: "m", Protocol: api.ProtocolChat, AttemptLimit: 5,
	}

	got := Select(request, candidates, "", now, 0)
	if len(got) != 5 {
		t.Fatalf("Select() count = %d, want 5", len(got))
	}
	for index, binding := range got {
		want := "bnd-" + string(rune('1'+index))
		if binding.BindingID != want || binding.Rank != index+1 {
			t.Fatalf("binding %d = %#v, want ID %s and rank %d", index, binding, want, index+1)
		}
	}
}

func TestSelectUsesIncumbentOnlyInsideHysteresisWindow(t *testing.T) {
	now := time.Unix(1000, 0)
	request := api.RouteRequest{
		Kind: "route_request", SchemaVersion: 1, RequestID: "r",
		Group: "g", Model: "m", Protocol: api.ProtocolChat, AttemptLimit: 2,
	}
	candidates := []Candidate{candidate("cheap", 100), candidate("incumbent", 105)}

	inside := Select(request, candidates, "incumbent", now, 5)
	if inside[0].BindingID != "incumbent" {
		t.Fatalf("inside hysteresis first = %q, want incumbent", inside[0].BindingID)
	}
	outside := Select(request, candidates, "incumbent", now, 4)
	if outside[0].BindingID != "cheap" {
		t.Fatalf("outside hysteresis first = %q, want cheap", outside[0].BindingID)
	}
}

func TestSelectUsesHealthAsPriceTieBreaker(t *testing.T) {
	now := time.Unix(1000, 0)
	request := api.RouteRequest{
		Kind: "route_request", SchemaVersion: 1, RequestID: "r",
		Group: "g", Model: "m", Protocol: api.ProtocolChat, AttemptLimit: 2,
	}
	degraded := candidate("a-degraded", 10)
	degraded.Health = HealthDegraded
	healthy := candidate("z-healthy", 10)

	got := Select(request, []Candidate{degraded, healthy}, "", now, 0)
	if got[0].BindingID != "z-healthy" {
		t.Fatalf("price tie first = %q, want healthy binding", got[0].BindingID)
	}
}

func TestNextActionImplementsAttemptPolicy(t *testing.T) {
	tests := []struct {
		name      string
		outcome   api.Outcome
		remaining int
		retryMS   int64
		want      Action
	}{
		{"success", api.OutcomeSuccess, 4, 0, Action{Kind: ActionStop}},
		{"401 stops", api.OutcomeAuth401, 4, 0, Action{Kind: ActionStop}},
		{"429 honors delay", api.OutcomeRateLimited429, 3, 5000, Action{Kind: ActionRetryAfter, Retry: true, Delay: 5 * time.Second}},
		{"5xx retries", api.OutcomeUpstream5xx, 2, 0, Action{Kind: ActionRetry, Retry: true}},
		{"transport retries", api.OutcomeTransportPreWrite, 1, 0, Action{Kind: ActionRetry, Retry: true}},
		{"write unknown stops", api.OutcomeWriteUnknown, 4, 0, Action{Kind: ActionStop}},
		{"committed stops", api.OutcomeResponseCommitted, 4, 0, Action{Kind: ActionStop}},
		{"no attempts stops", api.OutcomeUpstream5xx, 0, 0, Action{Kind: ActionStop}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NextAction(tt.outcome, tt.remaining, tt.retryMS)
			if got != tt.want {
				t.Fatalf("NextAction() = %#v, want %#v", got, tt.want)
			}
		})
	}
}

func TestRetryAfterBoundsFailClosed(t *testing.T) {
	const maximum = 24 * time.Hour

	atLimit := NextAction(
		api.OutcomeRateLimited429,
		1,
		maximum.Milliseconds(),
	)
	if atLimit != (Action{
		Kind:  ActionRetryAfter,
		Retry: true,
		Delay: maximum,
	}) {
		t.Fatalf("NextAction() at 24-hour limit = %#v", atLimit)
	}

	for name, retryAfterMS := range map[string]int64{
		"negative":   -1,
		"over limit": maximum.Milliseconds() + 1,
	} {
		t.Run(name, func(t *testing.T) {
			action := NextAction(api.OutcomeRateLimited429, 1, retryAfterMS)
			if action != (Action{Kind: ActionStop}) {
				t.Fatalf(
					"NextAction(retry_after_ms=%d) = %#v, want fail-closed stop",
					retryAfterMS,
					action,
				)
			}
		})
	}
}

func TestCooldownUntil(t *testing.T) {
	now := time.Unix(1000, 0)
	tests := []struct {
		outcome  api.Outcome
		retryMS  int64
		failures int
		want     time.Time
	}{
		{api.OutcomeAuth401, 0, 1, now.Add(15 * time.Minute)},
		{api.OutcomeRateLimited429, 7000, 1, now.Add(7 * time.Second)},
		{api.OutcomeRateLimited429, -1, 1, now.Add(24 * time.Hour)},
		{api.OutcomeRateLimited429, (24 * time.Hour).Milliseconds() + 1, 1, now.Add(24 * time.Hour)},
		{api.OutcomeUpstream5xx, 0, 1, now.Add(30 * time.Second)},
		{api.OutcomeUpstream5xx, 0, 4, now.Add(4 * time.Minute)},
		{api.OutcomeSuccess, 0, 1, time.Time{}},
	}
	for _, tt := range tests {
		got := CooldownUntil(tt.outcome, now, tt.retryMS, tt.failures)
		if !got.Equal(tt.want) {
			t.Fatalf("CooldownUntil(%s) = %v, want %v", tt.outcome, got, tt.want)
		}
	}
}

func candidate(id string, cost int64) Candidate {
	return Candidate{
		BindingID: id, Group: "g", Model: "m", Protocol: api.ProtocolChat,
		ProtocolPlugin: "chat-v1", Enabled: true, Health: HealthHealthy,
		CostMicrounits: cost,
	}
}
