package service

import "testing"

func TestAutoCheapestPremiumFallbackRetryThreshold(t *testing.T) {
	// Relay indices: 0=first attempt (distributor/cheapest), 1+=premium fallback.
	if autoCheapestPremiumFallbackRetry != 1 {
		t.Fatalf("autoCheapestPremiumFallbackRetry = %d, want 1", autoCheapestPremiumFallbackRetry)
	}
}
