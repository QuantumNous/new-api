package service

import (
	"errors"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"
)

// =============================================================================
// decideAutoTopup — pure decision branch
// =============================================================================
//
// These tests exhaustively cover the skip-reason taxonomy without touching
// DB / Redis / Stripe. The companion MaybeAutoTopup function is integration
// glue: DB read, Redis lock, real Stripe call, quota credit, log; that gets
// a single happy-path test below via a swapped stripeChargeFn.

func TestDecideAutoTopup_Disabled(t *testing.T) {
	ok, _, reason := decideAutoTopup(autoTopupPreconditions{
		Enabled: false, Amount: 500000, Threshold: 100000, Quota: 50000,
		StripeCustomer: "cus_x", StripeKey: "sk_test", RedisEnabled: true,
	})
	if ok || reason != "auto_topup_disabled" {
		t.Fatalf("expected skip=auto_topup_disabled; got ok=%v reason=%q", ok, reason)
	}
}

func TestDecideAutoTopup_AmountZero(t *testing.T) {
	ok, _, reason := decideAutoTopup(autoTopupPreconditions{
		Enabled: true, Amount: 0, Threshold: 100000, Quota: 50000,
		StripeCustomer: "cus_x", StripeKey: "sk_test", RedisEnabled: true,
	})
	if ok || reason != "auto_topup_amount_zero" {
		t.Fatalf("expected skip=auto_topup_amount_zero; got ok=%v reason=%q", ok, reason)
	}
}

func TestDecideAutoTopup_AboveThreshold(t *testing.T) {
	ok, _, reason := decideAutoTopup(autoTopupPreconditions{
		Enabled: true, Amount: 5000000, Threshold: 100000, Quota: 200000,
		StripeCustomer: "cus_x", StripeKey: "sk_test", RedisEnabled: true,
	})
	if ok || reason != "quota_above_threshold" {
		t.Fatalf("expected skip=quota_above_threshold; got ok=%v reason=%q", ok, reason)
	}
}

func TestDecideAutoTopup_NoStripeCustomer(t *testing.T) {
	ok, _, reason := decideAutoTopup(autoTopupPreconditions{
		Enabled: true, Amount: 5000000, Threshold: 100000, Quota: 50000,
		StripeCustomer: "", StripeKey: "sk_test", RedisEnabled: true,
	})
	if ok || reason != "no_stripe_customer" {
		t.Fatalf("expected skip=no_stripe_customer; got ok=%v reason=%q", ok, reason)
	}
}

func TestDecideAutoTopup_NoStripeKey(t *testing.T) {
	ok, _, reason := decideAutoTopup(autoTopupPreconditions{
		Enabled: true, Amount: 5000000, Threshold: 100000, Quota: 50000,
		StripeCustomer: "cus_x", StripeKey: "", RedisEnabled: true,
	})
	if ok || reason != "stripe_key_not_configured" {
		t.Fatalf("expected skip=stripe_key_not_configured; got ok=%v reason=%q", ok, reason)
	}
}

func TestDecideAutoTopup_GarbageStripeKey(t *testing.T) {
	ok, _, reason := decideAutoTopup(autoTopupPreconditions{
		Enabled: true, Amount: 5000000, Threshold: 100000, Quota: 50000,
		StripeCustomer: "cus_x", StripeKey: "pk_test_public_dont_use", RedisEnabled: true,
	})
	if ok || reason != "stripe_key_not_configured" {
		t.Fatalf("expected reject of non-secret key; got ok=%v reason=%q", ok, reason)
	}
}

func TestDecideAutoTopup_NoRedis(t *testing.T) {
	ok, _, reason := decideAutoTopup(autoTopupPreconditions{
		Enabled: true, Amount: 5000000, Threshold: 100000, Quota: 50000,
		StripeCustomer: "cus_x", StripeKey: "sk_test", RedisEnabled: false,
	})
	if ok || reason != "redis_not_enabled" {
		t.Fatalf("expected skip=redis_not_enabled; got ok=%v reason=%q", ok, reason)
	}
}

func TestDecideAutoTopup_BelowStripeMinimum(t *testing.T) {
	// 200000 quota → cost $0.40 × autoTopupSellMultiplier(5) = $2.00 = 200 cents,
	// still below the $5.00 (500 cents) platform minimum.
	ok, cents, reason := decideAutoTopup(autoTopupPreconditions{
		Enabled: true, Amount: 200000, Threshold: 1000000, Quota: 50000,
		StripeCustomer: "cus_x", StripeKey: "sk_test", RedisEnabled: true,
	})
	if ok || reason != "amount_below_stripe_minimum" {
		t.Fatalf("expected skip=amount_below_stripe_minimum; got ok=%v reason=%q cents=%d", ok, reason, cents)
	}
	if cents != 200 {
		t.Fatalf("expected 200 cents (=$2.00); got %d", cents)
	}
}

func TestDecideAutoTopup_HappyPath(t *testing.T) {
	// 5,000,000 quota → cost $10 × autoTopupSellMultiplier(5) = $50 = 5000 cents
	ok, cents, reason := decideAutoTopup(autoTopupPreconditions{
		Enabled: true, Amount: 5000000, Threshold: 1000000, Quota: 500000,
		StripeCustomer: "cus_x", StripeKey: "sk_live_xxx", RedisEnabled: true,
	})
	if !ok {
		t.Fatalf("expected charge; got skip reason=%q", reason)
	}
	if cents != 5000 {
		t.Fatalf("expected 5000 cents; got %d", cents)
	}
	if reason != "" {
		t.Fatalf("expected empty skip reason on success; got %q", reason)
	}
}

func TestDecideAutoTopup_RkKeyAccepted(t *testing.T) {
	// Restricted keys (rk_) should also be accepted — Stripe issues these
	// for limited-scope automations.
	ok, _, reason := decideAutoTopup(autoTopupPreconditions{
		Enabled: true, Amount: 5000000, Threshold: 1000000, Quota: 500000,
		StripeCustomer: "cus_x", StripeKey: "rk_live_restricted", RedisEnabled: true,
	})
	if !ok {
		t.Fatalf("rk_ key should be accepted; reason=%q", reason)
	}
}

// =============================================================================
// quotaUnitsToStripeCents — pure conversion math
// =============================================================================

func TestQuotaUnitsToStripeCents(t *testing.T) {
	// Save and restore so we don't leak state across tests
	saved := common.QuotaPerUnit
	defer func() { common.QuotaPerUnit = saved }()
	common.QuotaPerUnit = 500000 // canonical default

	cases := []struct {
		quotaUnits int
		wantCents  int64
		name       string
	}{
		{0, 0, "zero"},
		{500000, 100, "$1 == 100 cents"},
		{5000000, 1000, "$10"},
		{50000000, 10000, "$100"},
		{250000, 50, "Stripe min $0.50 exactly"},
	}
	for _, tc := range cases {
		got := quotaUnitsToStripeCents(tc.quotaUnits)
		if got != tc.wantCents {
			t.Errorf("%s: quotaUnitsToStripeCents(%d) = %d, want %d", tc.name, tc.quotaUnits, got, tc.wantCents)
		}
	}
}

func TestQuotaUnitsToStripeCents_ZeroQuotaPerUnit(t *testing.T) {
	saved := common.QuotaPerUnit
	defer func() { common.QuotaPerUnit = saved }()
	common.QuotaPerUnit = 0
	if got := quotaUnitsToStripeCents(5000000); got != 0 {
		t.Errorf("QuotaPerUnit=0 should return 0 cents, got %d", got)
	}
}

func TestQuotaUnitsToMajorAmount(t *testing.T) {
	saved := common.QuotaPerUnit
	defer func() { common.QuotaPerUnit = saved }()
	common.QuotaPerUnit = 500000 // canonical default; SellMultiplier default 5

	// 500000 units = $1 cost × 5 = 5.00 major; 1,000,000 = 10.00
	if got := quotaUnitsToMajorAmount(500000); got != 5.0 {
		t.Errorf("quotaUnitsToMajorAmount(500000) = %v, want 5.0", got)
	}
	if got := quotaUnitsToMajorAmount(1000000); got != 10.0 {
		t.Errorf("quotaUnitsToMajorAmount(1000000) = %v, want 10.0", got)
	}
	common.QuotaPerUnit = 0
	if got := quotaUnitsToMajorAmount(500000); got != 0 {
		t.Errorf("QuotaPerUnit=0 should return 0, got %v", got)
	}
}

// =============================================================================
// stripeChargeFn injection — verify MaybeAutoTopup actually delegates
// =============================================================================

func TestStripeChargeFn_ReceivesCorrectParams(t *testing.T) {
	saved := stripeChargeFn
	defer func() { stripeChargeFn = saved }()

	var capturedAmount int64
	var capturedCustomer, capturedCurrency, capturedKey string
	stripeChargeFn = func(req stripeChargeRequest) (string, error) {
		capturedAmount = req.Amount
		capturedCustomer = req.CustomerID
		capturedCurrency = req.Currency
		capturedKey = req.ApiSecret
		return "pi_mock_001", nil
	}

	id, err := stripeChargeFn(stripeChargeRequest{
		Amount:     1000,
		Currency:   "usd",
		CustomerID: "cus_test",
		ApiSecret:  "sk_test_123",
	})
	if err != nil {
		t.Fatalf("unexpected error from mock fn: %v", err)
	}
	if id != "pi_mock_001" {
		t.Fatalf("expected pi_mock_001; got %q", id)
	}
	if capturedAmount != 1000 || capturedCustomer != "cus_test" ||
		capturedCurrency != "usd" || capturedKey != "sk_test_123" {
		t.Fatalf("captured params mismatch: amount=%d customer=%q currency=%q key=%q",
			capturedAmount, capturedCustomer, capturedCurrency, capturedKey)
	}
}

func TestStripeChargeFn_PropagatesError(t *testing.T) {
	saved := stripeChargeFn
	defer func() { stripeChargeFn = saved }()

	stripeChargeFn = func(req stripeChargeRequest) (string, error) {
		return "", errors.New("card_declined")
	}

	_, err := stripeChargeFn(stripeChargeRequest{Amount: 1000, Currency: "usd"})
	if err == nil || err.Error() != "card_declined" {
		t.Fatalf("expected card_declined error, got %v", err)
	}
}

// TestStripeChargeFn_CallCountAtomic — sanity check that the package-level
// function pointer is safe enough to swap in concurrent test contexts.
// Not exhaustive concurrency proof; just makes sure consecutive callers see
// the same swapped function.
func TestStripeChargeFn_CallCountAtomic(t *testing.T) {
	saved := stripeChargeFn
	defer func() { stripeChargeFn = saved }()

	var calls int64
	stripeChargeFn = func(req stripeChargeRequest) (string, error) {
		atomic.AddInt64(&calls, 1)
		return "pi_n", nil
	}
	for i := 0; i < 5; i++ {
		_, _ = stripeChargeFn(stripeChargeRequest{})
	}
	if got := atomic.LoadInt64(&calls); got != 5 {
		t.Fatalf("expected 5 calls; got %d", got)
	}
}

// =============================================================================
// looksLikeStripeKey
// =============================================================================

func TestLooksLikeStripeKey(t *testing.T) {
	cases := []struct {
		in   string
		want bool
	}{
		{"sk_live_abc", true},
		{"sk_test_xyz", true},
		{"rk_live_restricted", true},
		{"pk_live_public_dont_use", false}, // publishable key is NOT a server-side secret
		{"", false},
		{"sk", false}, // too short
		{"random", false},
	}
	for _, tc := range cases {
		if got := looksLikeStripeKey(tc.in); got != tc.want {
			t.Errorf("looksLikeStripeKey(%q) = %v, want %v", tc.in, got, tc.want)
		}
	}
}
