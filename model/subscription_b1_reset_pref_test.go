package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestB1_CalcNextResetTime_DailyWeeklyMonthlyCustomNever(t *testing.T) {
	loc := time.FixedZone("CST", 8*3600)
	base := time.Date(2026, 7, 10, 15, 30, 0, 0, loc) // Friday
	end := base.AddDate(0, 2, 0).Unix()

	// never
	assert.Equal(t, int64(0), calcNextResetTime(base, &SubscriptionPlan{QuotaResetPeriod: SubscriptionResetNever}, end))

	// daily → next local midnight
	daily := calcNextResetTime(base, &SubscriptionPlan{QuotaResetPeriod: SubscriptionResetDaily}, end)
	wantDaily := time.Date(2026, 7, 11, 0, 0, 0, 0, loc).Unix()
	assert.Equal(t, wantDaily, daily)

	// weekly → next Monday 00:00
	weekly := calcNextResetTime(base, &SubscriptionPlan{QuotaResetPeriod: SubscriptionResetWeekly}, end)
	wantWeekly := time.Date(2026, 7, 13, 0, 0, 0, 0, loc).Unix() // next Monday
	assert.Equal(t, wantWeekly, weekly)

	// monthly → first day next month
	monthly := calcNextResetTime(base, &SubscriptionPlan{QuotaResetPeriod: SubscriptionResetMonthly}, end)
	wantMonthly := time.Date(2026, 8, 1, 0, 0, 0, 0, loc).Unix()
	assert.Equal(t, wantMonthly, monthly)

	// custom +3600
	custom := calcNextResetTime(base, &SubscriptionPlan{
		QuotaResetPeriod:        SubscriptionResetCustom,
		QuotaResetCustomSeconds: 3600,
	}, end)
	assert.Equal(t, base.Unix()+3600, custom)

	// next beyond end → 0
	beyond := calcNextResetTime(base, &SubscriptionPlan{
		QuotaResetPeriod:        SubscriptionResetCustom,
		QuotaResetCustomSeconds: 86400 * 100,
	}, base.Unix()+10)
	assert.Equal(t, int64(0), beyond)
}

func TestB1_ResetDueSubscriptions_ResetsAmountUsed(t *testing.T) {
	setupTimeQuotaTestDB(t)

	base := time.Now().Unix()
	withTestDBTime(t, base)

	plan := &SubscriptionPlan{
		Title:                   "B1-cron-reset",
		DurationUnit:            SubscriptionDurationDay,
		DurationValue:           30,
		TotalAmount:             10000,
		ActivationMode:          SubscriptionActivationImmediate,
		Enabled:                 true,
		QuotaResetPeriod:        SubscriptionResetCustom,
		QuotaResetCustomSeconds: 100,
		CreatedAt:               base,
		UpdatedAt:               base,
	}
	require.NoError(t, DB.Create(plan).Error)
	userId := createTestUser(t, "default", "default")
	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)

	_, err = PreConsumeUserSubscription("b1-cron-use", userId, "gpt-4", 0, 200, "")
	require.NoError(t, err)

	// Jump past next reset and run cron
	withTestDBTime(t, sub.NextResetTime+1)
	count, err := ResetDueSubscriptions(100)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, count, 1)

	var row UserSubscription
	require.NoError(t, DB.First(&row, sub.Id).Error)
	assert.Equal(t, int64(0), row.AmountUsed)
	assert.Greater(t, row.NextResetTime, sub.NextResetTime)
}

func TestB1_SubscriptionOnly_Equivalent_NoWalletFallbackAtModel(t *testing.T) {
	// Model layer has no wallet; subscription_only means only PreConsumeUserSubscription is used.
	// This locks: when sub window/total insufficient, preconsume fails (caller must not silently succeed).
	setupTimeQuotaTestDB(t)

	plan := createWindowPlan(t, "B1-sub-only", SubscriptionActivationImmediate, 100, 0, 0, 0, 100)
	userId := createTestUser(t, "default", "default")
	_, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)

	_, err = PreConsumeUserSubscription("b1-subonly-fill", userId, "gpt-4", 0, 100, "")
	require.NoError(t, err)
	_, err = PreConsumeUserSubscription("b1-subonly-fail", userId, "gpt-4", 0, 1, "")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "insufficient")
}

func TestB1_PartialPreConsume_UsesRemainingWindow(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := createWindowPlan(t, "B1-partial", SubscriptionActivationImmediate, 1000, 0, 0, 0, 100000)
	userId := createTestUser(t, "default", "default")
	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)
	ts := GetDBTimestamp()
	require.NoError(t, DB.Model(sub).Updates(map[string]interface{}{
		"window_start_5h": ts,
		"window_used_5h":  int64(700),
	}).Error)

	res, err := PreConsumeUserSubscriptionPartial("b1-partial", userId, "gpt-4", 0, 500, "")
	require.NoError(t, err)
	assert.Equal(t, int64(300), res.PreConsumed)

	var row UserSubscription
	require.NoError(t, DB.First(&row, sub.Id).Error)
	assert.Equal(t, int64(1000), row.WindowUsed5h)
	assert.Equal(t, int64(300), row.AmountUsed)
}
