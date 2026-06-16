package model

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
)

// TestMarkStripeCardBoundIdempotentBonus verifies the one-time new-user bonus is granted
// exactly once even across repeated/concurrent webhook deliveries (the conditional UPDATE
// enforces single-grant at the DB level, independent of FOR UPDATE / SQLite).
func TestMarkStripeCardBoundIdempotentBonus(t *testing.T) {
	truncateTables(t)
	DB.Exec("DELETE FROM users")
	DB.Exec("DELETE FROM stripe_bonus_claims")

	origEnabled := setting.StripeCardBindEnabled
	origAmount := setting.StripeNewUserBonusAmount
	t.Cleanup(func() {
		setting.StripeCardBindEnabled = origEnabled
		setting.StripeNewUserBonusAmount = origAmount
	})
	setting.StripeCardBindEnabled = true
	setting.StripeNewUserBonusAmount = 10

	const userId = 8888
	if err := DB.Create(&User{Id: userId, Username: "binduser", Quota: 0}).Error; err != nil {
		t.Fatalf("create user failed: %v", err)
	}

	expectBonus := 10 * int(common.QuotaPerUnit)

	// First call grants the bonus.
	granted, quota, err := MarkStripeCardBound(userId, "cus_a", "fp_user8888")
	if err != nil {
		t.Fatalf("first MarkStripeCardBound failed: %v", err)
	}
	if !granted || quota != expectBonus {
		t.Fatalf("first call: expected granted=true quota=%d, got granted=%v quota=%d", expectBonus, granted, quota)
	}

	// Second & third calls (duplicate webhooks / second bind session) must NOT re-grant.
	for i := 0; i < 2; i++ {
		granted, quota, err = MarkStripeCardBound(userId, "cus_b", "fp_user8888")
		if err != nil {
			t.Fatalf("repeat MarkStripeCardBound failed: %v", err)
		}
		if granted || quota != 0 {
			t.Fatalf("repeat call %d: expected no re-grant, got granted=%v quota=%d", i, granted, quota)
		}
	}

	// Final quota must reflect exactly one bonus.
	var u User
	if err := DB.Where("id = ?", userId).First(&u).Error; err != nil {
		t.Fatalf("reload user failed: %v", err)
	}
	if u.Quota != expectBonus {
		t.Fatalf("expected quota=%d after one grant, got %d", expectBonus, u.Quota)
	}
	if !u.StripeCardBound || !u.NewUserBonusGiven {
		t.Fatalf("expected card bound + bonus given flags set, got bound=%v bonus=%v", u.StripeCardBound, u.NewUserBonusGiven)
	}
}

// TestMarkStripeCardBoundFingerprintDedup verifies the same physical card (same Stripe
// fingerprint) earns the new-user bonus only once, even across different accounts.
func TestMarkStripeCardBoundFingerprintDedup(t *testing.T) {
	truncateTables(t)
	DB.Exec("DELETE FROM users")
	DB.Exec("DELETE FROM stripe_bonus_claims")

	origEnabled := setting.StripeCardBindEnabled
	origAmount := setting.StripeNewUserBonusAmount
	t.Cleanup(func() {
		setting.StripeCardBindEnabled = origEnabled
		setting.StripeNewUserBonusAmount = origAmount
	})
	setting.StripeCardBindEnabled = true
	setting.StripeNewUserBonusAmount = 10

	const userA = 1001
	const userB = 1002
	const sharedFp = "fp_shared_card"
	if err := DB.Create(&User{Id: userA, Username: "acctA", AffCode: "affA"}).Error; err != nil {
		t.Fatalf("create userA failed: %v", err)
	}
	if err := DB.Create(&User{Id: userB, Username: "acctB", AffCode: "affB"}).Error; err != nil {
		t.Fatalf("create userB failed: %v", err)
	}

	// Account A binds the card → gets the bonus.
	grantedA, _, err := MarkStripeCardBound(userA, "cus_a", sharedFp)
	if err != nil {
		t.Fatalf("userA bind failed: %v", err)
	}
	if !grantedA {
		t.Fatalf("userA: expected bonus granted")
	}

	// Account B binds the SAME physical card (same fingerprint) → must NOT get the bonus.
	grantedB, quotaB, err := MarkStripeCardBound(userB, "cus_b", sharedFp)
	if err != nil {
		t.Fatalf("userB bind failed: %v", err)
	}
	if grantedB || quotaB != 0 {
		t.Fatalf("userB: expected NO bonus for reused card, got granted=%v quota=%d", grantedB, quotaB)
	}

	// But account B is still marked as card-bound (the binding itself succeeds).
	var b User
	if err := DB.Where("id = ?", userB).First(&b).Error; err != nil {
		t.Fatalf("reload userB failed: %v", err)
	}
	if !b.StripeCardBound {
		t.Fatalf("userB: expected card bound even without bonus")
	}
	if b.NewUserBonusGiven {
		t.Fatalf("userB: bonus flag must stay false for reused card")
	}
}

// TestClaimStripeCardFingerprintBlocksLaterNewUserBonus verifies the round-3 #3 fix: a card
// first bound through the paid recharge-with-save-card flow (which calls
// ClaimStripeCardFingerprint to consume the card's one bonus slot) can no longer farm the free
// new-user bonus on another account via the setup-mode bind path.
func TestClaimStripeCardFingerprintBlocksLaterNewUserBonus(t *testing.T) {
	truncateTables(t)
	DB.Exec("DELETE FROM users")
	DB.Exec("DELETE FROM stripe_bonus_claims")

	origEnabled := setting.StripeCardBindEnabled
	origAmount := setting.StripeNewUserBonusAmount
	t.Cleanup(func() {
		setting.StripeCardBindEnabled = origEnabled
		setting.StripeNewUserBonusAmount = origAmount
	})
	setting.StripeCardBindEnabled = true
	setting.StripeNewUserBonusAmount = 10

	const promoUser = 2001
	const farmUser = 2002
	const sharedFp = "fp_promo_then_farm"
	if err := DB.Create(&User{Id: promoUser, Username: "promoUser", AffCode: "affP"}).Error; err != nil {
		t.Fatalf("create promoUser failed: %v", err)
	}
	if err := DB.Create(&User{Id: farmUser, Username: "farmUser", AffCode: "affF"}).Error; err != nil {
		t.Fatalf("create farmUser failed: %v", err)
	}

	// promoUser binds the card via the paid recharge flow: it consumes the card's bonus slot
	// (no free bonus granted — the user already got a purchased deposit bonus).
	if err := ClaimStripeCardFingerprint(promoUser, sharedFp); err != nil {
		t.Fatalf("ClaimStripeCardFingerprint failed: %v", err)
	}

	// farmUser tries to earn the FREE new-user bonus with the SAME physical card via setup mode.
	granted, quota, err := MarkStripeCardBound(farmUser, "cus_farm", sharedFp)
	if err != nil {
		t.Fatalf("farmUser bind failed: %v", err)
	}
	if granted || quota != 0 {
		t.Fatalf("farmUser: reused card must NOT earn the free bonus, got granted=%v quota=%d", granted, quota)
	}

	// farmUser is still bound (binding succeeds), just without the bonus.
	var f User
	if err := DB.Where("id = ?", farmUser).First(&f).Error; err != nil {
		t.Fatalf("reload farmUser failed: %v", err)
	}
	if !f.StripeCardBound || f.NewUserBonusGiven {
		t.Fatalf("farmUser: expected bound=true bonus=false, got bound=%v bonus=%v", f.StripeCardBound, f.NewUserBonusGiven)
	}
}

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
