package model

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func seedSettleSubscription(t *testing.T, total int64) *UserSubscription {
	t.Helper()
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&SubscriptionPreConsumeRecord{}))
	t.Cleanup(func() { DB.Exec("DELETE FROM subscription_pre_consume_records") })

	user := &User{Username: "settle-user", DisplayName: "settle-user", Group: "default"}
	require.NoError(t, DB.Create(user).Error)
	plan := &SubscriptionPlan{
		Title:            "Day",
		DurationUnit:     SubscriptionDurationDay,
		DurationValue:    1,
		TotalAmount:      total,
		QuotaResetPeriod: SubscriptionResetNever,
		Enabled:          true,
	}
	require.NoError(t, DB.Create(plan).Error)
	now := GetDBTimestamp()
	sub := &UserSubscription{
		UserId:      user.Id,
		PlanId:      plan.Id,
		AmountTotal: total,
		StartTime:   now,
		EndTime:     now + int64(time.Hour.Seconds()),
		Status:      "active",
	}
	require.NoError(t, DB.Create(sub).Error)
	return sub
}

func subscriptionAmountUsed(t *testing.T, id int) int64 {
	t.Helper()
	var sub UserSubscription
	require.NoError(t, DB.Where("id = ?", id).First(&sub).Error)
	return sub.AmountUsed
}

func TestSettleUserSubscriptionDelta(t *testing.T) {
	sub := seedSettleSubscription(t, 100)

	for _, step := range []struct {
		delta   int64
		applied int64
		used    int64
	}{
		{delta: 40, applied: 40, used: 40},
		{delta: 75, applied: 60, used: 100},
		{delta: -500, applied: -100, used: 0},
	} {
		applied, err := SettleUserSubscriptionDelta(sub.Id, step.delta)
		require.NoError(t, err)
		assert.Equal(t, step.applied, applied)
		assert.Equal(t, step.used, subscriptionAmountUsed(t, sub.Id))
	}

	// Reserving keeps refusing an overrun.
	require.NoError(t, PostConsumeUserSubscriptionDelta(sub.Id, 90))
	assert.Error(t, PostConsumeUserSubscriptionDelta(sub.Id, 20))
	assert.Equal(t, int64(90), subscriptionAmountUsed(t, sub.Id))
}

// Each request reserves a small estimate and settles a larger actual cost. Once
// a settlement overruns the plan, the plan is full and the next reserve fails.
func TestSettleOverrunExhaustsPlanForNextRequest(t *testing.T) {
	sub := seedSettleSubscription(t, 100)
	const estimate, actual = 1, 45

	served := 0
	for n := range 10 {
		res, err := PreConsumeUserSubscription(fmt.Sprintf("settle-req-%d", n), sub.UserId, "test-model", 0, estimate)
		if err != nil {
			break
		}
		_, err = SettleUserSubscriptionDelta(res.UserSubscriptionId, actual-estimate)
		require.NoError(t, err)
		served++
	}

	assert.Equal(t, 3, served)
	assert.Equal(t, int64(100), subscriptionAmountUsed(t, sub.Id))
}
