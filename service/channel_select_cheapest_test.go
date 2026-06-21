package service

import "testing"

func TestAutoCheapestPremiumFallbackRetryThreshold(t *testing.T) {
	// Relay indices: 0=first attempt (distributor), 1=first retry (cheapest ladder),
	// 2+=premium fallback (most expensive remaining).
	if autoCheapestPremiumFallbackRetry != 2 {
		t.Fatalf("autoCheapestPremiumFallbackRetry = %d, want 2", autoCheapestPremiumFallbackRetry)
	}
}
