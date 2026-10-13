package fault_test

import (
	"strings"
	"testing"
	"time"

	"smart-router/api"
	"smart-router/routing"
	"smart-router/signing"
)

func TestTerminalOutcomesNeverRetry(t *testing.T) {
	for _, outcome := range []api.Outcome{
		api.OutcomeSuccess,
		api.OutcomeAuth401,
		api.OutcomeClient4xx,
		api.OutcomeWriteUnknown,
		api.OutcomeResponseCommitted,
	} {
		action := routing.NextAction(outcome, 4, 5000)
		if action.Retry || action.Kind != routing.ActionStop || action.Delay != 0 {
			t.Fatalf("NextAction(%q) = %#v, want immediate stop", outcome, action)
		}
	}
}

func TestRetryableFailuresStopWhenAttemptBudgetIsExhausted(t *testing.T) {
	for _, outcome := range []api.Outcome{
		api.OutcomeRateLimited429,
		api.OutcomeUpstream5xx,
		api.OutcomeTransportPreWrite,
	} {
		action := routing.NextAction(outcome, 0, 5000)
		if action.Retry || action.Kind != routing.ActionStop {
			t.Fatalf("NextAction(%q, exhausted) = %#v, want stop", outcome, action)
		}
	}
}

func TestSignatureTamperingFailsClosed(t *testing.T) {
	key := []byte(strings.Repeat("k", 32))
	response := api.RouteResponse{
		Kind: "route_response", SchemaVersion: 1, RequestID: "req-1",
		SnapshotRevision: "rev-1", ExpiresAt: time.Now().Add(time.Minute).UnixMilli(),
		Bindings: []api.Binding{{
			BindingID:      "bnd_AAAAAAAAAAAAAAAAAAAAAAAA",
			ProtocolPlugin: "chat-v1", Rank: 1,
		}},
	}
	signature, err := signing.Sign(response, key)
	if err != nil {
		t.Fatalf("Sign() error = %v", err)
	}
	response.Signature = signature
	response.Bindings[0].BindingID = "bnd_BBBBBBBBBBBBBBBBBBBBBBBB"
	if err := signing.Verify(response, key, signature); err == nil {
		t.Fatal("Verify() error = nil, want fail-closed tamper rejection")
	}
}
