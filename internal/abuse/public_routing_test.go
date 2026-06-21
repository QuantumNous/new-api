package abuse

import (
	"context"
	"testing"
)

func resetPublicRoutingTestState() {
	memPublicRouting.mu.Lock()
	defer memPublicRouting.mu.Unlock()
	resetMemory()
}

func TestPublicRoutingCredentialRateLimitBlocksBeyondLimit(t *testing.T) {
	resetPublicRoutingTestState()
	cfg := DefaultConfig()
	cfg.RPMLimit = 2

	for i := 0; i < 2; i++ {
		decision, err := CheckPublicRoutingCredential(context.Background(), nil, 42, "203.0.113.1", "runner-a", cfg)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !decision.Allowed {
			t.Fatalf("request %d should be allowed", i+1)
		}
	}

	decision, err := CheckPublicRoutingCredential(context.Background(), nil, 42, "203.0.113.1", "runner-a", cfg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if decision.Allowed {
		t.Fatal("third request should be blocked")
	}
	if decision.RetryAfter < 1 {
		t.Fatalf("expected positive retry-after, got %d", decision.RetryAfter)
	}
}

func TestPublicRoutingCredentialRateLimitIsPerToken(t *testing.T) {
	resetPublicRoutingTestState()
	cfg := DefaultConfig()
	cfg.RPMLimit = 1

	decision, err := CheckPublicRoutingCredential(context.Background(), nil, 100, "203.0.113.1", "runner-a", cfg)
	if err != nil || !decision.Allowed {
		t.Fatalf("token 100 first request should be allowed: decision=%+v err=%v", decision, err)
	}
	decision, err = CheckPublicRoutingCredential(context.Background(), nil, 101, "203.0.113.1", "runner-a", cfg)
	if err != nil || !decision.Allowed {
		t.Fatalf("token 101 first request should be isolated and allowed: decision=%+v err=%v", decision, err)
	}
}

func TestPublicRoutingSharedCredentialFanoutFlagsAnomaly(t *testing.T) {
	resetPublicRoutingTestState()
	cfg := DefaultConfig()
	cfg.RPMLimit = 0
	cfg.SharedIPLimit = 2
	cfg.SharedClientLimit = 3

	clients := []struct {
		ip string
		ua string
	}{
		{"203.0.113.1", "runner-a"},
		{"203.0.113.2", "runner-b"},
		{"203.0.113.3", "runner-c"},
		{"203.0.113.3", "runner-d"},
	}

	var decision PublicRoutingDecision
	var err error
	for _, client := range clients {
		decision, err = CheckPublicRoutingCredential(context.Background(), nil, 7, client.ip, client.ua, cfg)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	}
	if !decision.Allowed {
		t.Fatal("fanout anomaly should be flagged, not blocked")
	}
	if len(decision.Flags) != 2 {
		t.Fatalf("expected two flags, got %+v", decision.Flags)
	}
	if decision.Flags[0] != FlagSharedIPFanout || decision.Flags[1] != FlagSharedClientFanout {
		t.Fatalf("unexpected flags: %+v", decision.Flags)
	}
}
