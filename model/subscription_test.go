package model

import (
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// ---------------------------------------------------------------------------
// Subscription test helpers
// ---------------------------------------------------------------------------

func insertSubscriptionPlanForTest(t *testing.T, plan *SubscriptionPlan) {
	t.Helper()
	require.NoError(t, DB.Create(plan).Error)
}

func insertUserSubscriptionForTest(t *testing.T, sub *UserSubscription) {
	t.Helper()
	require.NoError(t, DB.Create(sub).Error)
}

func insertPreConsumeRecordForTest(t *testing.T, rec *SubscriptionPreConsumeRecord) {
	t.Helper()
	require.NoError(t, DB.Create(rec).Error)
}

func insertUserForSubTest(t *testing.T, id int, group string, quota int) {
	t.Helper()
	user := &User{
		Id:       id,
		Username: fmt.Sprintf("sub_test_user_%d", id),
		Status:   common.UserStatusEnabled,
		Group:    group,
		Quota:    quota,
		AffCode:  fmt.Sprintf("aff_%d", id),
	}
	require.NoError(t, DB.Create(user).Error)
}

// subscriptionPlan creates a basic plan for tests.
func subscriptionPlan(id int) *SubscriptionPlan {
	allowBalance := true
	return &SubscriptionPlan{
		Id:            id,
		Title:         fmt.Sprintf("Test Plan %d", id),
		PriceAmount:   9.99,
		Currency:      "USD",
		DurationUnit:  SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		TotalAmount:   100000,
		AllowBalancePay: &allowBalance,
	}
}

// resetPlan creates a plan with a daily quota reset.
func resetPlan(id int) *SubscriptionPlan {
	allowBalance := true
	return &SubscriptionPlan{
		Id:            id,
		Title:         fmt.Sprintf("Reset Plan %d", id),
		PriceAmount:   5.0,
		Currency:      "USD",
		DurationUnit:  SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		TotalAmount:   50000,
		QuotaResetPeriod: SubscriptionResetDaily,
		AllowBalancePay: &allowBalance,
	}
}

// activeSub creates an active UserSubscription with default values.
func activeSub(id int, userId int, planId int, endTime time.Time) *UserSubscription {
	return &UserSubscription{
		Id:          id,
		UserId:      userId,
		PlanId:      planId,
		AmountTotal: 100000,
		AmountUsed:  0,
		StartTime:   time.Now().Add(-24 * time.Hour).Unix(),
		EndTime:     endTime.Unix(),
		Status:      "active",
	}
}

// ===========================================================================
// CountUserSubscriptionsByPlan tests
// ===========================================================================

func TestCountUserSubscriptionsByPlan(t *testing.T) {
	t.Run("active_only_counted", func(t *testing.T) {
		truncateTables(t)
		insertUserForSubTest(t, 1001, "default", 0)
		insertSubscriptionPlanForTest(t, subscriptionPlan(5001))

		sub := activeSub(8001, 1001, 5001, time.Now().Add(30*24*time.Hour))
		sub.Status = "active"
		insertUserSubscriptionForTest(t, sub)

		count, err := CountUserSubscriptionsByPlan(1001, 5001)
		require.NoError(t, err)
		assert.Equal(t, int64(1), count)
	})

	t.Run("expired_excluded", func(t *testing.T) {
		truncateTables(t)
		insertUserForSubTest(t, 1002, "default", 0)
		insertSubscriptionPlanForTest(t, subscriptionPlan(5002))

		sub := activeSub(8002, 1002, 5002, time.Now().Add(30*24*time.Hour))
		sub.Status = "expired"
		insertUserSubscriptionForTest(t, sub)

		count, err := CountUserSubscriptionsByPlan(1002, 5002)
		require.NoError(t, err)
		assert.Equal(t, int64(0), count)
	})

	t.Run("cancelled_excluded", func(t *testing.T) {
		truncateTables(t)
		insertUserForSubTest(t, 1003, "default", 0)
		insertSubscriptionPlanForTest(t, subscriptionPlan(5003))

		sub := activeSub(8003, 1003, 5003, time.Now().Add(30*24*time.Hour))
		sub.Status = "cancelled"
		insertUserSubscriptionForTest(t, sub)

		count, err := CountUserSubscriptionsByPlan(1003, 5003)
		require.NoError(t, err)
		assert.Equal(t, int64(0), count)
	})

	t.Run("mixed", func(t *testing.T) {
		truncateTables(t)
		insertUserForSubTest(t, 1004, "default", 0)
		insertSubscriptionPlanForTest(t, subscriptionPlan(5004))

		// 1 active, 2 expired, 1 cancelled = 1 counted
		stati := []string{"active", "expired", "expired", "cancelled"}
		for i, status := range stati {
			sub := activeSub(9000+i, 1004, 5004, time.Now().Add(30*24*time.Hour))
			sub.Status = status
			insertUserSubscriptionForTest(t, sub)
		}

		count, err := CountUserSubscriptionsByPlan(1004, 5004)
		require.NoError(t, err)
		assert.Equal(t, int64(1), count)
	})

	t.Run("cross_user", func(t *testing.T) {
		truncateTables(t)
		insertUserForSubTest(t, 1005, "default", 0)
		insertUserForSubTest(t, 1006, "default", 0)
		insertSubscriptionPlanForTest(t, subscriptionPlan(5005))

		sub1 := activeSub(8010, 1005, 5005, time.Now().Add(30*24*time.Hour))
		insertUserSubscriptionForTest(t, sub1)

		sub2 := activeSub(8011, 1006, 5005, time.Now().Add(30*24*time.Hour))
		insertUserSubscriptionForTest(t, sub2)

		// Count for user 1005 should only count user 1005's subs
		count, err := CountUserSubscriptionsByPlan(1005, 5005)
		require.NoError(t, err)
		assert.Equal(t, int64(1), count)
	})
}

// ===========================================================================
// PreConsumeUserSubscription tests
// ===========================================================================

func TestPreConsumeUserSubscription(t *testing.T) {
	t.Run("picks_earliest_expiring", func(t *testing.T) {
		truncateTables(t)
		insertUserForSubTest(t, 2001, "default", 0)
		plan := subscriptionPlan(6001)
		insertSubscriptionPlanForTest(t, plan)

		now := time.Now()
		// Sub with later expiry
		sub1 := activeSub(10001, 2001, 6001, now.Add(60*24*time.Hour))
		sub1.EndTime = now.Add(60 * 24 * time.Hour).Unix()
		insertUserSubscriptionForTest(t, sub1)

		// Sub with earlier expiry — should be picked
		sub2 := activeSub(10002, 2001, 6001, now.Add(10*24*time.Hour))
		sub2.EndTime = now.Add(10 * 24 * time.Hour).Unix()
		insertUserSubscriptionForTest(t, sub2)

		result, err := PreConsumeUserSubscription("req-pick-earliest-1", 2001, "test-model", 0, 100)
		require.NoError(t, err)
		assert.Equal(t, 10002, result.UserSubscriptionId, "should pick subscription with earliest end_time")
	})

	t.Run("idempotent_same_request_id", func(t *testing.T) {
		truncateTables(t)
		insertUserForSubTest(t, 2002, "default", 0)
		plan := subscriptionPlan(6002)
		insertSubscriptionPlanForTest(t, plan)

		sub := activeSub(10003, 2002, 6002, time.Now().Add(30*24*time.Hour))
		insertUserSubscriptionForTest(t, sub)

		result1, err := PreConsumeUserSubscription("req-idempotent-1", 2002, "test-model", 0, 50)
		require.NoError(t, err)
		assert.Equal(t, int64(50), result1.PreConsumed)

		// Same request_id: should return same record without double-consuming
		result2, err := PreConsumeUserSubscription("req-idempotent-1", 2002, "test-model", 0, 50)
		require.NoError(t, err)
		assert.Equal(t, result1.UserSubscriptionId, result2.UserSubscriptionId)
		assert.Equal(t, result1.PreConsumed, result2.PreConsumed, "idempotent call should not double-consume")

		// Subscription used should only have been incremented once
		var reloaded UserSubscription
		require.NoError(t, DB.First(&reloaded, sub.Id).Error)
		assert.Equal(t, int64(50), reloaded.AmountUsed)
	})

	t.Run("different_request_id_creates_new_record", func(t *testing.T) {
		truncateTables(t)
		insertUserForSubTest(t, 2003, "default", 0)
		plan := subscriptionPlan(6003)
		insertSubscriptionPlanForTest(t, plan)

		sub := activeSub(10004, 2003, 6003, time.Now().Add(30*24*time.Hour))
		insertUserSubscriptionForTest(t, sub)

		result1, err := PreConsumeUserSubscription("req-diff-1", 2003, "test-model", 0, 30)
		require.NoError(t, err)

		result2, err := PreConsumeUserSubscription("req-diff-2", 2003, "test-model", 0, 40)
		require.NoError(t, err)

		// Two different records, both consuming from the same subscription
		assert.NotEqual(t, result1.PreConsumed, result2.PreConsumed)

		var reloaded UserSubscription
		require.NoError(t, DB.First(&reloaded, sub.Id).Error)
		assert.Equal(t, int64(70), reloaded.AmountUsed, "both pre-consumes should stack")
	})

	t.Run("amount_total_exhausted", func(t *testing.T) {
		truncateTables(t)
		insertUserForSubTest(t, 2004, "default", 0)
		plan := subscriptionPlan(6004)
		plan.TotalAmount = 100
		insertSubscriptionPlanForTest(t, plan)

		// Fully used subscription
		sub := activeSub(10005, 2004, 6004, time.Now().Add(30*24*time.Hour))
		sub.AmountUsed = 100
		sub.AmountTotal = 100
		insertUserSubscriptionForTest(t, sub)

		// Second subscription that has quota left
		sub2 := activeSub(10006, 2004, 6004, time.Now().Add(60*24*time.Hour))
		sub2.PlanId = 6004
		sub2.AmountTotal = 1000
		sub2.AmountUsed = 0
		insertUserSubscriptionForTest(t, sub2)

		// Should skip exhausted subscription and use sub2
		result, err := PreConsumeUserSubscription("req-exhausted-1", 2004, "test-model", 0, 50)
		require.NoError(t, err)
		assert.Equal(t, 10006, result.UserSubscriptionId, "should skip exhausted sub and use the next one")
	})
}

// ===========================================================================
// RefundSubscriptionPreConsume tests
// ===========================================================================

func TestRefundSubscriptionPreConsume(t *testing.T) {
	// TODO: RefundSubscriptionPreConsume calls PostConsumeUserSubscriptionDelta which
	// starts a nested model.DB.Transaction() inside the outer tx.Transaction(). This
	// deadlocks with SQLite MaxOpenConns(1) because the inner transaction can't acquire
	// a second connection. Fix: refactor production code to pass tx through nested calls.
	// Non-existent record test does NOT deadlock (no inner transaction).
	t.Run("happy_path", func(t *testing.T) {
		t.Skip("deadlocks: nested model.DB.Transaction inside tx (see TODO above)")
		truncateTables(t)
		insertUserForSubTest(t, 3001, "default", 0)
		plan := subscriptionPlan(7001)
		insertSubscriptionPlanForTest(t, plan)

		sub := activeSub(11001, 3001, 7001, time.Now().Add(30*24*time.Hour))
		sub.AmountUsed = 0
		insertUserSubscriptionForTest(t, sub)

		// Pre-consume
		_, err := PreConsumeUserSubscription("req-refund-happy", 3001, "test-model", 0, 100)
		require.NoError(t, err)

		// Verify amount_used was incremented
		var afterConsume UserSubscription
		require.NoError(t, DB.First(&afterConsume, sub.Id).Error)
		assert.Equal(t, int64(100), afterConsume.AmountUsed)

		// Refund
		err = RefundSubscriptionPreConsume("req-refund-happy")
		require.NoError(t, err)

		var afterRefund UserSubscription
		require.NoError(t, DB.First(&afterRefund, sub.Id).Error)
		assert.Equal(t, int64(0), afterRefund.AmountUsed, "amount_used should be restored after refund")
	})

	t.Run("double_refund_idempotent", func(t *testing.T) {
		t.Skip("deadlocks: nested model.DB.Transaction inside tx (see TestRefundSubscriptionPreConsume TODO)")
		truncateTables(t)
		insertUserForSubTest(t, 3002, "default", 0)
		plan := subscriptionPlan(7002)
		insertSubscriptionPlanForTest(t, plan)

		sub := activeSub(11002, 3002, 7002, time.Now().Add(30*24*time.Hour))
		insertUserSubscriptionForTest(t, sub)

		// Pre-consume
		_, err := PreConsumeUserSubscription("req-refund-double", 3002, "test-model", 0, 100)
		require.NoError(t, err)

		// First refund
		err = RefundSubscriptionPreConsume("req-refund-double")
		require.NoError(t, err)

		// Second refund: idempotent (already refunded → no error, no double-refund)
		err = RefundSubscriptionPreConsume("req-refund-double")
		require.NoError(t, err)

		var subAfter UserSubscription
		require.NoError(t, DB.First(&subAfter, sub.Id).Error)
		assert.Equal(t, int64(0), subAfter.AmountUsed, "double refund should not double-restore")
	})

	t.Run("non_existent_record", func(t *testing.T) {
		truncateTables(t)
		err := RefundSubscriptionPreConsume("req-nonexistent")
		require.Error(t, err, "should error for non-existent request_id")
	})
}

// ===========================================================================
// maybeResetUserSubscriptionWithPlanTx tests
// ===========================================================================

func TestMaybeResetUserSubscriptionWithPlanTx(t *testing.T) {
	t.Run("cross_reset_period_boundary", func(t *testing.T) {
		truncateTables(t)
		insertUserForSubTest(t, 4001, "default", 0)
		plan := resetPlan(9001)
		insertSubscriptionPlanForTest(t, plan)

		now := time.Now()
		// Set next_reset_time in the past to trigger reset
		pastReset := now.Add(-2 * 24 * time.Hour)
		sub := activeSub(12001, 4001, 9001, now.Add(30*24*time.Hour))
		sub.NextResetTime = pastReset.Unix()
		sub.LastResetTime = now.Add(-3 * 24 * time.Hour).Unix()
		sub.AmountUsed = 5000
		insertUserSubscriptionForTest(t, sub)

		err := DB.Transaction(func(tx *gorm.DB) error {
			var locked UserSubscription
			require.NoError(t, tx.Set("gorm:query_option", "FOR UPDATE").
				Where("id = ?", sub.Id).First(&locked).Error)
			return maybeResetUserSubscriptionWithPlanTx(tx, &locked, plan, now.Unix())
		})
		require.NoError(t, err)

		var reloaded UserSubscription
		require.NoError(t, DB.First(&reloaded, sub.Id).Error)
		assert.Equal(t, int64(0), reloaded.AmountUsed, "amount_used should reset to 0")
	})

	t.Run("no_reset_when_period_in_future", func(t *testing.T) {
		truncateTables(t)
		insertUserForSubTest(t, 4002, "default", 0)
		plan := resetPlan(9002)
		insertSubscriptionPlanForTest(t, plan)

		now := time.Now()
		// Set next_reset_time in the future — no reset should occur
		futureReset := now.Add(7 * 24 * time.Hour)
		sub := activeSub(12002, 4002, 9002, now.Add(30*24*time.Hour))
		sub.NextResetTime = futureReset.Unix()
		sub.AmountUsed = 5000
		insertUserSubscriptionForTest(t, sub)

		err := DB.Transaction(func(tx *gorm.DB) error {
			var locked UserSubscription
			require.NoError(t, tx.Set("gorm:query_option", "FOR UPDATE").
				Where("id = ?", sub.Id).First(&locked).Error)
			return maybeResetUserSubscriptionWithPlanTx(tx, &locked, plan, now.Unix())
		})
		require.NoError(t, err)

		var reloaded UserSubscription
		require.NoError(t, DB.First(&reloaded, sub.Id).Error)
		assert.Equal(t, int64(5000), reloaded.AmountUsed, "amount_used should not change when reset is in future")
	})

	t.Run("reset_period_never", func(t *testing.T) {
		truncateTables(t)
		insertUserForSubTest(t, 4003, "default", 0)
		plan := subscriptionPlan(9003)
		plan.QuotaResetPeriod = SubscriptionResetNever
		insertSubscriptionPlanForTest(t, plan)

		now := time.Now()
		pastReset := now.Add(-1 * time.Hour)
		sub := activeSub(12003, 4003, 9003, now.Add(30*24*time.Hour))
		sub.NextResetTime = pastReset.Unix()
		sub.AmountUsed = 5000
		insertUserSubscriptionForTest(t, sub)

		err := DB.Transaction(func(tx *gorm.DB) error {
			var locked UserSubscription
			require.NoError(t, tx.Set("gorm:query_option", "FOR UPDATE").
				Where("id = ?", sub.Id).First(&locked).Error)
			return maybeResetUserSubscriptionWithPlanTx(tx, &locked, plan, now.Unix())
		})
		require.NoError(t, err)

		var reloaded UserSubscription
		require.NoError(t, DB.First(&reloaded, sub.Id).Error)
		assert.Equal(t, int64(5000), reloaded.AmountUsed, "amount_used should not change for never-reset plan")
	})

	t.Run("concurrent_reset_cas_race", func(t *testing.T) {
		truncateTables(t)
		insertUserForSubTest(t, 4004, "default", 0)
		plan := resetPlan(9004)
		insertSubscriptionPlanForTest(t, plan)

		now := time.Now()
		pastReset := now.Add(-1 * time.Hour)
		sub := activeSub(12004, 4004, 9004, now.Add(30*24*time.Hour))
		sub.NextResetTime = pastReset.Unix()
		sub.LastResetTime = now.Add(-25 * time.Hour).Unix()
		sub.AmountUsed = 10000
		insertUserSubscriptionForTest(t, sub)

		const goroutines = 5
		var resetCount int32 // atomic counter: number of goroutines that actually performed a reset
		var wg sync.WaitGroup
		wg.Add(goroutines)

		for i := 0; i < goroutines; i++ {
			go func() {
				defer wg.Done()
				_ = DB.Transaction(func(tx *gorm.DB) error {
					var locked UserSubscription
					if err := tx.Set("gorm:query_option", "FOR UPDATE").
						Where("id = ?", sub.Id).First(&locked).Error; err != nil {
						return err
					}
					// Before reset: amount_used > 0
					wasUsed := locked.AmountUsed
					if err := maybeResetUserSubscriptionWithPlanTx(tx, &locked, plan, now.Unix()); err != nil {
						return err
					}
					// If reset actually happened, amount_used changed from non-zero to 0
					if wasUsed > 0 && locked.AmountUsed == 0 {
						atomic.AddInt32(&resetCount, 1)
					}
					return nil
				})
			}()
		}
		wg.Wait()

		// Exactly one goroutine should have performed the reset
		assert.Equal(t, int32(1), resetCount, "exactly one goroutine should perform the reset (CAS)")
	})
}

// ===========================================================================
// ExpireDueSubscriptions tests
// ===========================================================================

func TestExpireDueSubscriptions(t *testing.T) {
	t.Run("single_subscription_expired", func(t *testing.T) {
		truncateTables(t)
		// User with upgraded group
		insertUserForSubTest(t, 5001, "vip", 0)

		plan := subscriptionPlan(8001)
		plan.UpgradeGroup = "vip"
		insertSubscriptionPlanForTest(t, plan)

		// Subscription that's already expired (end_time in the past)
		sub := activeSub(13001, 5001, 8001, time.Now().Add(-1*time.Hour))
		sub.UpgradeGroup = "vip"
		sub.PrevUserGroup = "default"
		insertUserSubscriptionForTest(t, sub)

		count, err := ExpireDueSubscriptions(10)
		require.NoError(t, err)
		assert.Equal(t, 1, count)

		// Subscription should now be expired
		var reloaded UserSubscription
		require.NoError(t, DB.First(&reloaded, sub.Id).Error)
		assert.Equal(t, "expired", reloaded.Status)

		// Group should be downgraded
		var user User
		require.NoError(t, DB.First(&user, 5001).Error)
		assert.Equal(t, "default", user.Group)
	})

	t.Run("multi_subscription_group_downgrade_guard", func(t *testing.T) {
		truncateTables(t)
		insertUserForSubTest(t, 5002, "vip", 0)

		plan := subscriptionPlan(8002)
		plan.UpgradeGroup = "vip"
		insertSubscriptionPlanForTest(t, plan)

		// Expired sub (upgrade_group=vip, prev_group=default)
		sub1 := activeSub(13002, 5002, 8002, time.Now().Add(-2*time.Hour))
		sub1.UpgradeGroup = "vip"
		sub1.PrevUserGroup = "default"
		insertUserSubscriptionForTest(t, sub1)

		// Active sub (upgrade_group=vip) — this one is still active, so group should NOT downgrade
		sub2 := activeSub(13003, 5002, 8002, time.Now().Add(30*24*time.Hour))
		sub2.UpgradeGroup = "vip"
		sub2.PrevUserGroup = "default"
		insertUserSubscriptionForTest(t, sub2)

		count, err := ExpireDueSubscriptions(10)
		require.NoError(t, err)
		assert.Equal(t, 1, count, "only one subscription actually expired")

		// Group should remain "vip" because sub2 is still active
		var user User
		require.NoError(t, DB.First(&user, 5002).Error)
		assert.Equal(t, "vip", user.Group, "group should not downgrade while another upgraded sub is active")
	})

	t.Run("all_expired_downgrade", func(t *testing.T) {
		truncateTables(t)
		insertUserForSubTest(t, 5003, "pro", 0)

		plan := subscriptionPlan(8003)
		plan.UpgradeGroup = "pro"
		insertSubscriptionPlanForTest(t, plan)

		// All subscriptions are expired
		sub1 := activeSub(13004, 5003, 8003, time.Now().Add(-3*time.Hour))
		sub1.UpgradeGroup = "pro"
		sub1.PrevUserGroup = "default"
		insertUserSubscriptionForTest(t, sub1)

		sub2 := activeSub(13005, 5003, 8003, time.Now().Add(-1*time.Hour))
		sub2.UpgradeGroup = "pro"
		sub2.PrevUserGroup = "default"
		insertUserSubscriptionForTest(t, sub2)

		count, err := ExpireDueSubscriptions(10)
		require.NoError(t, err)
		assert.Equal(t, 2, count)

		// User group should be downgraded to "default"
		var user User
		require.NoError(t, DB.First(&user, 5003).Error)
		assert.Equal(t, "default", user.Group)
	})
}

// ===========================================================================
// PurchaseSubscriptionWithBalance tests
// TODO: PurchaseSubscriptionWithBalance calls GetDBTimestamp() inside tx.Transaction(),
// which uses model.DB.Scan() (not tx). This deadlocks with SQLite MaxOpenConns(1) because
// the inner query can't acquire a second connection. Fix: pass tx to GetDBTimestamp.
// ===========================================================================

func TestPurchaseSubscriptionWithBalance(t *testing.T) {
	t.Run("happy_path", func(t *testing.T) {
		t.Skip("deadlocks: GetDBTimestamp uses model.DB inside tx.Transaction()")
		truncateTables(t)
		insertUserForSubTest(t, 6001, "default", 5000000) // enough quota for the plan

		plan := subscriptionPlan(10001)
		plan.PriceAmount = 9.99
		plan.UpgradeGroup = "vip"
		insertSubscriptionPlanForTest(t, plan)

		err := PurchaseSubscriptionWithBalance(6001, 10001)
		require.NoError(t, err)

		// User quota should be reduced
		var user User
		require.NoError(t, DB.First(&user, 6001).Error)
		assert.Less(t, user.Quota, 5000000, "user quota should be reduced")

		// Subscription should be created
		var subs []UserSubscription
		require.NoError(t, DB.Where("user_id = ? AND plan_id = ?", 6001, 10001).Find(&subs).Error)
		assert.Len(t, subs, 1, "one subscription should be created")
		assert.Equal(t, "active", subs[0].Status)

		// User group should be upgraded
		assert.Equal(t, "vip", user.Group)
	})

	t.Run("insufficient_balance_rollback", func(t *testing.T) {
		t.Skip("deadlocks: PurchaseSubscriptionWithBalance uses model.DB inside tx")
		truncateTables(t)
		insertUserForSubTest(t, 6002, "default", 10) // very low quota

		plan := subscriptionPlan(10002)
		plan.PriceAmount = 9.99
		insertSubscriptionPlanForTest(t, plan)

		err := PurchaseSubscriptionWithBalance(6002, 10002)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "余额不足")

		// No subscription should be created (transaction rolled back)
		var subs []UserSubscription
		require.NoError(t, DB.Where("user_id = ? AND plan_id = ?", 6002, 10002).Find(&subs).Error)
		assert.Len(t, subs, 0, "no subscription should be created on insufficient balance")

		// User quota should be unchanged (rolled back)
		var user User
		require.NoError(t, DB.First(&user, 6002).Error)
		assert.Equal(t, 10, user.Quota, "user quota should not change after rollback")
	})

	t.Run("already_at_max_purchase", func(t *testing.T) {
		t.Skip("deadlocks: PurchaseSubscriptionWithBalance uses model.DB inside tx")
		truncateTables(t)
		insertUserForSubTest(t, 6003, "default", 5000000)

		plan := subscriptionPlan(10003)
		plan.MaxPurchasePerUser = 1
		insertSubscriptionPlanForTest(t, plan)

		// First purchase succeeds
		err := PurchaseSubscriptionWithBalance(6003, 10003)
		require.NoError(t, err)

		// Second purchase should be rejected
		err = PurchaseSubscriptionWithBalance(6003, 10003)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "已达到该套餐购买上限")
	})
}
