package service

import (
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
)

// TestMaybeTriggerStripeAutoChargeGating verifies the threshold/enabled gating fires the
// registered hook only under the right conditions, without touching Stripe.
func TestMaybeTriggerStripeAutoChargeGating(t *testing.T) {
	origEnabled := setting.StripeAutoChargeEnabled
	origThreshold := setting.StripeAutoChargeThreshold
	origHook := TriggerStripeAutoCharge
	t.Cleanup(func() {
		setting.StripeAutoChargeEnabled = origEnabled
		setting.StripeAutoChargeThreshold = origThreshold
		TriggerStripeAutoCharge = origHook
	})

	var mu sync.Mutex
	var fired []int
	done := make(chan struct{}, 16)
	TriggerStripeAutoCharge = func(userId int) {
		mu.Lock()
		fired = append(fired, userId)
		mu.Unlock()
		done <- struct{}{}
	}

	threshold := 2
	setting.StripeAutoChargeThreshold = threshold
	belowThreshold := threshold*int(common.QuotaPerUnit) - 1
	aboveThreshold := threshold * int(common.QuotaPerUnit)

	// Disabled => never fires.
	setting.StripeAutoChargeEnabled = false
	MaybeTriggerStripeAutoCharge(1, belowThreshold)

	// Enabled but balance above threshold => never fires.
	setting.StripeAutoChargeEnabled = true
	MaybeTriggerStripeAutoCharge(2, aboveThreshold)

	// Enabled and below threshold => fires (async).
	MaybeTriggerStripeAutoCharge(3, belowThreshold)
	<-done

	mu.Lock()
	defer mu.Unlock()
	if len(fired) != 1 || fired[0] != 3 {
		t.Fatalf("expected only user 3 to trigger auto-charge, got %v", fired)
	}
}
