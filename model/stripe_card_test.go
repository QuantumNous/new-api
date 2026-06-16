package model

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
)

// TestClaimStripeCardFingerprintIdempotentAndGuards verifies the claim is a harmless no-op on
// repeat calls and for empty/invalid input.
func TestClaimStripeCardFingerprintIdempotentAndGuards(t *testing.T) {
	truncateTables(t)
	DB.Exec("DELETE FROM users")
	DB.Exec("DELETE FROM stripe_bonus_claims")

	const userId = 2003
	// Empty fingerprint / invalid user → no-op, no error, no row.
	if err := ClaimStripeCardFingerprint(userId, ""); err != nil {
		t.Fatalf("empty fingerprint should be a no-op, got %v", err)
	}
	if err := ClaimStripeCardFingerprint(0, "fp_x"); err != nil {
		t.Fatalf("invalid user should be a no-op, got %v", err)
	}

	// Repeated claims of the same fingerprint must not error (ON CONFLICT DO NOTHING).
	for i := 0; i < 3; i++ {
		if err := ClaimStripeCardFingerprint(userId, "fp_repeat"); err != nil {
			t.Fatalf("repeat claim %d failed: %v", i, err)
		}
	}
	var count int64
	if err := DB.Model(&StripeBonusClaim{}).Where("card_fingerprint = ?", "fp_repeat").Count(&count).Error; err != nil {
		t.Fatalf("count failed: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected exactly 1 claim row for repeated fingerprint, got %d", count)
	}
}

// TestRecordStripeAutoChargeFailureWritesUserLog verifies that an auto-charge failure
// produces a user-visible system log entry the user can see in their log page.
func TestRecordStripeAutoChargeFailureWritesUserLog(t *testing.T) {
	truncateTables(t)

	const userId = 4242
	RecordStripeAutoChargeFailure(userId, 20, "扣款被拒绝或需要验证")

	var logs []*Log
	if err := LOG_DB.Where("user_id = ? AND type = ?", userId, LogTypeSystem).Find(&logs).Error; err != nil {
		t.Fatalf("query logs failed: %v", err)
	}
	if len(logs) != 1 {
		t.Fatalf("expected exactly 1 system log, got %d", len(logs))
	}
	content := logs[0].Content
	if !strings.Contains(content, "自动扣费失败") {
		t.Errorf("log content missing failure marker: %q", content)
	}
	if !strings.Contains(content, "$20") {
		t.Errorf("log content missing amount: %q", content)
	}
	if !strings.Contains(content, "扣款被拒绝或需要验证") {
		t.Errorf("log content missing reason: %q", content)
	}
}

// TestRecordStripeAutoChargeFailureIgnoresInvalidUser ensures no log is written for a
// non-positive user id (defensive guard).
func TestRecordStripeAutoChargeFailureIgnoresInvalidUser(t *testing.T) {
	truncateTables(t)

	RecordStripeAutoChargeFailure(0, 20, "x")

	var count int64
	if err := LOG_DB.Model(&Log{}).Where("type = ?", LogTypeSystem).Count(&count).Error; err != nil {
		t.Fatalf("count failed: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected no logs for invalid user, got %d", count)
	}
}

// TestHasRecentStripeAutoCharge verifies the persistent (DB-backed) auto-charge cooldown
// guard that prevents double-charging across instances/restarts.
func TestHasRecentStripeAutoCharge(t *testing.T) {
	truncateTables(t)
	DB.Exec("DELETE FROM top_ups")

	const userId = 7777
	const window int64 = 120
	now := common.GetTimestamp()

	// No prior auto-charge → not recent.
	recent, err := HasRecentStripeAutoCharge(userId, window)
	if err != nil {
		t.Fatalf("query failed: %v", err)
	}
	if recent {
		t.Fatalf("expected no recent charge for a fresh user")
	}

	// A recent successful auto-charge → recent (blocks a second charge).
	if err := DB.Create(&TopUp{
		UserId:          userId,
		Amount:          20,
		TradeNo:         "auto_pi_recent",
		PaymentProvider: PaymentProviderStripeAuto,
		Status:          common.TopUpStatusSuccess,
		CreateTime:      now - 10, // 10s ago, inside the 120s window
	}).Error; err != nil {
		t.Fatalf("insert recent topup failed: %v", err)
	}
	recent, err = HasRecentStripeAutoCharge(userId, window)
	if err != nil {
		t.Fatalf("query failed: %v", err)
	}
	if !recent {
		t.Fatalf("expected recent charge to be detected within the window")
	}

	// An old auto-charge (outside the window) → not recent.
	DB.Exec("DELETE FROM top_ups")
	if err := DB.Create(&TopUp{
		UserId:          userId,
		Amount:          20,
		TradeNo:         "auto_pi_old",
		PaymentProvider: PaymentProviderStripeAuto,
		Status:          common.TopUpStatusSuccess,
		CreateTime:      now - 200, // 200s ago, outside the 120s window
	}).Error; err != nil {
		t.Fatalf("insert old topup failed: %v", err)
	}
	recent, err = HasRecentStripeAutoCharge(userId, window)
	if err != nil {
		t.Fatalf("query failed: %v", err)
	}
	if recent {
		t.Fatalf("expected an out-of-window charge to NOT count as recent")
	}

	// A manual (non-auto) top-up must NOT count toward the auto-charge cooldown.
	DB.Exec("DELETE FROM top_ups")
	if err := DB.Create(&TopUp{
		UserId:          userId,
		Amount:          20,
		TradeNo:         "manual_pi",
		PaymentProvider: PaymentProviderStripe, // manual, not stripe_auto
		Status:          common.TopUpStatusSuccess,
		CreateTime:      now - 5,
	}).Error; err != nil {
		t.Fatalf("insert manual topup failed: %v", err)
	}
	recent, err = HasRecentStripeAutoCharge(userId, window)
	if err != nil {
		t.Fatalf("query failed: %v", err)
	}
	if recent {
		t.Fatalf("a manual top-up must not trigger the auto-charge cooldown")
	}
}

// TestRecordStripeAutoChargeAttemptTriggersCooldown verifies a FAILED attempt also makes
// the persistent cooldown fire, so a declined card can't be retried on every request.
func TestRecordStripeAutoChargeAttemptTriggersCooldown(t *testing.T) {
	truncateTables(t)
	DB.Exec("DELETE FROM top_ups")

	const userId = 9001
	const window int64 = 120

	recent, _ := HasRecentStripeAutoCharge(userId, window)
	if recent {
		t.Fatalf("expected no cooldown before any attempt")
	}

	RecordStripeAutoChargeAttempt(userId, 20, "9001_t1")

	recent, err := HasRecentStripeAutoCharge(userId, window)
	if err != nil {
		t.Fatalf("query failed: %v", err)
	}
	if !recent {
		t.Fatalf("expected a failed attempt to trigger the cooldown")
	}
}

// TestDepositBonusQuota verifies the deposit-bonus tier table (充X送Y) and that
// non-tier amounts get no bonus.
func TestDepositBonusQuota(t *testing.T) {
	u := int(common.QuotaPerUnit)
	cases := []struct {
		paid int64
		want int
	}{
		{10, 2 * u},
		{20, 5 * u},
		{50, 15 * u},
		{100, 35 * u},
		{200, 100 * u},
		{1000, 500 * u},
		{33, 0},  // custom amount, no bonus
		{0, 0},   // zero
		{500, 0}, // not a configured tier
		{15, 0},
	}
	for _, c := range cases {
		if got := DepositBonusQuota(c.paid); got != c.want {
			t.Errorf("DepositBonusQuota(%d) = %d, want %d", c.paid, got, c.want)
		}
	}
}
