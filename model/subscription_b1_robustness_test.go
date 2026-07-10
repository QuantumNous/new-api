package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func withTestDBTime(t *testing.T, ts int64) {
	t.Helper()
	SetTestDBTimestampOverride(ts)
	t.Cleanup(func() { SetTestDBTimestampOverride(0) })
}

func createWindowPlan(t *testing.T, title string, mode string, limit5h, limit24h, limit7d, limit30d, total int64) *SubscriptionPlan {
	t.Helper()
	now := common.GetTimestamp()
	plan := &SubscriptionPlan{
		Title:          title,
		DurationUnit:   SubscriptionDurationDay,
		DurationValue:  30,
		TotalAmount:    total,
		ActivationMode: mode,
		Enabled:        true,
		WindowLimit5h:  limit5h,
		WindowLimit24h: limit24h,
		WindowLimit7d:  limit7d,
		WindowLimit30d: limit30d,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if mode == SubscriptionActivationOnFirstUse {
		plan.ActivationWindowSeconds = 7 * 86400
	}
	require.NoError(t, DB.Create(plan).Error)
	return plan
}

// ============================================================
// B1: on_first_use — bind does not open windows; first preconsume opens all windows
// ============================================================
func TestB1_OnFirstUse_NoWindowUntilFirstConsume(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := createWindowPlan(t, "B1-on-first-use", SubscriptionActivationOnFirstUse, 2000, 6000, 15000, 45000, 0)
	userId := createTestUser(t, "default", "default")
	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)
	require.Equal(t, UserSubscriptionStatusPendingActivation, sub.Status)

	usage, err := GetSubscriptionWindowUsage(sub.Id)
	require.NoError(t, err)
	assert.Equal(t, int64(0), usage["5h"].Used)
	assert.Equal(t, int64(0), usage["5h"].ResetAt)
	assert.Equal(t, int64(0), usage["24h"].Used)
	assert.Equal(t, int64(0), usage["24h"].ResetAt)

	var row UserSubscription
	require.NoError(t, DB.First(&row, sub.Id).Error)
	assert.Equal(t, int64(0), row.WindowStart5h)
	assert.Equal(t, int64(0), row.WindowStart24h)
}

func TestB1_OnFirstUse_FirstConsumeActivatesAndOpensWindows(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := createWindowPlan(t, "B1-on-first-use-activate", SubscriptionActivationOnFirstUse, 2000, 6000, 15000, 45000, 100000)
	userId := createTestUser(t, "default", "default")
	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)

	before := GetDBTimestamp()
	_, err = PreConsumeUserSubscription("b1-on1st-activate", userId, "gpt-4", 0, 150, "")
	require.NoError(t, err)
	after := GetDBTimestamp()

	var updated UserSubscription
	require.NoError(t, DB.First(&updated, sub.Id).Error)
	assert.Equal(t, UserSubscriptionStatusActive, updated.Status)
	assert.Greater(t, updated.ActivatedAt, int64(0))
	assert.Greater(t, updated.EndTime, updated.ActivatedAt)
	assert.Equal(t, int64(150), updated.AmountUsed)

	// All configured windows open at the same first-consume time.
	assert.GreaterOrEqual(t, updated.WindowStart5h, before)
	assert.LessOrEqual(t, updated.WindowStart5h, after)
	assert.Equal(t, updated.WindowStart5h, updated.WindowStart24h)
	assert.Equal(t, updated.WindowStart5h, updated.WindowStart7d)
	assert.Equal(t, updated.WindowStart5h, updated.WindowStart30d)
	assert.Equal(t, int64(150), updated.WindowUsed5h)
	assert.Equal(t, int64(150), updated.WindowUsed24h)
	assert.Equal(t, int64(150), updated.WindowUsed7d)
	assert.Equal(t, int64(150), updated.WindowUsed30d)

	usage, err := GetSubscriptionWindowUsage(sub.Id)
	require.NoError(t, err)
	assert.Equal(t, updated.WindowStart5h+5*3600, usage["5h"].ResetAt)
	assert.Equal(t, updated.WindowStart24h+24*3600, usage["24h"].ResetAt)
	assert.InDelta(t, float64(5*3600), float64(usage["5h"].ResetAfterSeconds), 3)
	assert.InDelta(t, float64(24*3600), float64(usage["24h"].ResetAfterSeconds), 3)
}

// ============================================================
// B1: immediate bind does not open windows
// ============================================================
func TestB1_Immediate_BindDoesNotOpenWindows(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := createWindowPlan(t, "B1-immediate", SubscriptionActivationImmediate, 2000, 6000, 0, 0, 100000)
	userId := createTestUser(t, "default", "default")
	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)
	require.Equal(t, UserSubscriptionStatusActive, sub.Status)

	var row UserSubscription
	require.NoError(t, DB.First(&row, sub.Id).Error)
	assert.Equal(t, int64(0), row.WindowStart5h)
	assert.Equal(t, int64(0), row.WindowUsed5h)
	assert.Equal(t, int64(0), row.WindowStart24h)
	assert.Equal(t, int64(0), row.WindowUsed24h)
}

// ============================================================
// B1: same-period accumulate keeps start fixed
// ============================================================
func TestB1_Window_AccumulateKeepsStart(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := createWindowPlan(t, "B1-accumulate", SubscriptionActivationImmediate, 5000, 20000, 0, 0, 100000)
	userId := createTestUser(t, "default", "default")
	_, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)

	_, err = PreConsumeUserSubscription("b1-acc-1", userId, "gpt-4", 0, 100, "")
	require.NoError(t, err)
	var after1 UserSubscription
	require.NoError(t, DB.Where("user_id = ?", userId).First(&after1).Error)
	start := after1.WindowStart24h
	require.Greater(t, start, int64(0))

	_, err = PreConsumeUserSubscription("b1-acc-2", userId, "gpt-4", 0, 200, "")
	require.NoError(t, err)
	_, err = PreConsumeUserSubscription("b1-acc-3", userId, "gpt-4", 0, 50, "")
	require.NoError(t, err)

	var after3 UserSubscription
	require.NoError(t, DB.First(&after3, after1.Id).Error)
	assert.Equal(t, start, after3.WindowStart5h)
	assert.Equal(t, start, after3.WindowStart24h)
	assert.Equal(t, int64(350), after3.WindowUsed5h)
	assert.Equal(t, int64(350), after3.WindowUsed24h)
	assert.Equal(t, int64(350), after3.AmountUsed)
}

// ============================================================
// B1: mock clock — 5h expires, 24h remains; next consume reopens 5h only
// ============================================================
func TestB1_Window_MockClock_5hExpires24hRemains(t *testing.T) {
	setupTimeQuotaTestDB(t)

	base := time.Now().Unix()
	withTestDBTime(t, base)

	plan := createWindowPlan(t, "B1-clock-5h", SubscriptionActivationImmediate, 1000, 5000, 0, 0, 100000)
	userId := createTestUser(t, "default", "default")
	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)

	_, err = PreConsumeUserSubscription("b1-clock-open", userId, "gpt-4", 0, 300, "")
	require.NoError(t, err)

	var opened UserSubscription
	require.NoError(t, DB.First(&opened, sub.Id).Error)
	t0 := opened.WindowStart5h
	require.Equal(t, t0, opened.WindowStart24h)
	require.Equal(t, int64(300), opened.WindowUsed5h)

	// Jump past 5h, still inside 24h.
	withTestDBTime(t, t0+5*3600+10)

	usage, err := GetSubscriptionWindowUsage(sub.Id)
	require.NoError(t, err)
	assert.Equal(t, int64(0), usage["5h"].Used)
	assert.Equal(t, int64(0), usage["5h"].ResetAt)
	assert.Equal(t, int64(300), usage["24h"].Used)
	assert.Equal(t, t0, usage["24h"].Since)
	assert.Equal(t, t0+24*3600, usage["24h"].ResetAt)

	// Next consume reopens 5h at new time; 24h continues same period.
	_, err = PreConsumeUserSubscription("b1-clock-reopen", userId, "gpt-4", 0, 100, "")
	require.NoError(t, err)

	var reopened UserSubscription
	require.NoError(t, DB.First(&reopened, sub.Id).Error)
	assert.Equal(t, t0+5*3600+10, reopened.WindowStart5h)
	assert.Equal(t, int64(100), reopened.WindowUsed5h)
	assert.Equal(t, t0, reopened.WindowStart24h)
	assert.Equal(t, int64(400), reopened.WindowUsed24h)
}

func TestB1_Window_MockClock_24hExpiresAndReopens(t *testing.T) {
	setupTimeQuotaTestDB(t)

	base := time.Now().Unix()
	withTestDBTime(t, base)

	plan := createWindowPlan(t, "B1-clock-24h", SubscriptionActivationImmediate, 0, 2000, 0, 0, 100000)
	userId := createTestUser(t, "default", "default")
	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)

	_, err = PreConsumeUserSubscription("b1-24h-open", userId, "gpt-4", 0, 500, "")
	require.NoError(t, err)
	var opened UserSubscription
	require.NoError(t, DB.First(&opened, sub.Id).Error)
	t0 := opened.WindowStart24h

	withTestDBTime(t, t0+24*3600+5)
	usage, err := GetSubscriptionWindowUsage(sub.Id)
	require.NoError(t, err)
	assert.Equal(t, int64(0), usage["24h"].Used)
	assert.Equal(t, int64(0), usage["24h"].ResetAt)

	// Full limit available again.
	require.NoError(t, DB.First(sub, sub.Id).Error)
	available := getSubscriptionAvailableAmountWithPlanTx(DB, sub, plan)
	assert.Equal(t, int64(2000), available)

	_, err = PreConsumeUserSubscription("b1-24h-reopen", userId, "gpt-4", 0, 100, "")
	require.NoError(t, err)
	var reopened UserSubscription
	require.NoError(t, DB.First(&reopened, sub.Id).Error)
	assert.Equal(t, t0+24*3600+5, reopened.WindowStart24h)
	assert.Equal(t, int64(100), reopened.WindowUsed24h)
}

// ============================================================
// B1: fill 24h to limit, backdate window_start past 24h (keep 7d),
// assert 24h clears while 7d remains; then reopen 24h.
// Mirrors production verification: no need to wait real 24h wall clock.
// ============================================================
func TestB1_Window_FillThenBackdateStart_24hClears7dRemains_ThenReopen(t *testing.T) {
	setupTimeQuotaTestDB(t)

	now := GetDBTimestamp()
	// 24h limit small so we can fill; 7d larger so it stays active after 25h backdate.
	plan := createWindowPlan(t, "B1-fill-backdate", SubscriptionActivationImmediate, 0, 100, 10000, 0, 100000)
	userId := createTestUser(t, "default", "default")
	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)

	// 1) Real consume opens windows
	_, err = PreConsumeUserSubscription("b1-fill-open", userId, "gpt-4", 0, 15, "")
	require.NoError(t, err)

	var opened UserSubscription
	require.NoError(t, DB.First(&opened, sub.Id).Error)
	require.Greater(t, opened.WindowStart24h, int64(0))
	require.Equal(t, opened.WindowStart24h, opened.WindowStart7d)

	// 2) Fill 24h used to limit (and keep 7d used)
	require.NoError(t, DB.Model(&opened).Updates(map[string]interface{}{
		"window_used_24h": int64(100),
		"window_used_7d":  int64(100),
	}).Error)

	// Full: further 24h consume blocked
	require.NoError(t, DB.First(sub, sub.Id).Error)
	available := getSubscriptionAvailableAmountWithPlanTx(DB, sub, plan)
	assert.Equal(t, int64(0), available)

	// 3) Backdate start to 25h ago (same start for 24h and 7d) — no wall-clock wait
	past := now - 25*3600
	require.NoError(t, DB.Model(sub).Updates(map[string]interface{}{
		"window_start_24h": past,
		"window_start_7d":  past,
		"window_used_24h":  int64(100),
		"window_used_7d":   int64(100),
	}).Error)
	InvalidateWindowUsageCache(sub.Id)

	usage, err := GetSubscriptionWindowUsage(sub.Id)
	require.NoError(t, err)
	// 24h expired => cleared
	assert.Equal(t, int64(0), usage["24h"].Used)
	assert.Equal(t, int64(0), usage["24h"].ResetAt)
	assert.Equal(t, int64(0), usage["24h"].ResetAfterSeconds)
	// 7d still active (25h < 7d): used remains, countdown ~ 7d-25h ≈ 143h
	assert.Equal(t, int64(100), usage["7d"].Used)
	assert.Equal(t, past, usage["7d"].Since)
	assert.Equal(t, past+7*86400, usage["7d"].ResetAt)
	assert.InDelta(t, float64(7*86400-25*3600), float64(usage["7d"].ResetAfterSeconds), 5)

	// Available again for 24h full limit (7d remaining 9900, 24h full 100 → min=100)
	require.NoError(t, DB.First(sub, sub.Id).Error)
	// normalize may have cleared 24h fields in memory path; re-read available after usage path
	// getSubscriptionAvailableAmountWithPlanTx also resets expired windows on the row copy
	subFresh := *sub
	// reload from DB after GetSubscriptionWindowUsage may have persisted normalize
	_ = DB.First(&subFresh, sub.Id).Error
	available = getSubscriptionAvailableAmountWithPlanTx(DB, &subFresh, plan)
	assert.Equal(t, int64(100), available)

	// 4) Reopen 24h with new consume
	_, err = PreConsumeUserSubscription("b1-fill-reopen", userId, "gpt-4", 0, 20, "")
	require.NoError(t, err)

	var reopened UserSubscription
	require.NoError(t, DB.First(&reopened, sub.Id).Error)
	assert.Equal(t, int64(20), reopened.WindowUsed24h)
	assert.Greater(t, reopened.WindowStart24h, past)
	// 7d continues same period (not reopened)
	assert.Equal(t, past, reopened.WindowStart7d)
	assert.Equal(t, int64(120), reopened.WindowUsed7d) // 100 + 20

	usage2, err := GetSubscriptionWindowUsage(sub.Id)
	require.NoError(t, err)
	assert.Equal(t, int64(20), usage2["24h"].Used)
	assert.Greater(t, usage2["24h"].ResetAfterSeconds, int64(23*3600))
	assert.Equal(t, int64(120), usage2["7d"].Used)
}

// ============================================================
// B1: window full blocks / splits
// ============================================================
func TestB1_Window_5hFullBlocksFurtherConsume(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := createWindowPlan(t, "B1-5h-full", SubscriptionActivationImmediate, 1000, 10000, 0, 0, 100000)
	userId := createTestUser(t, "default", "default")
	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)

	_, err = PreConsumeUserSubscription("b1-5h-fill", userId, "gpt-4", 0, 1000, "")
	require.NoError(t, err)

	_, err = PreConsumeUserSubscription("b1-5h-over", userId, "gpt-4", 0, 1, "")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "insufficient")

	var row UserSubscription
	require.NoError(t, DB.First(&row, sub.Id).Error)
	assert.Equal(t, int64(1000), row.WindowUsed5h)
	assert.Equal(t, int64(1000), row.AmountUsed)
}

func TestB1_Window_TightestConstraintWins(t *testing.T) {
	setupTimeQuotaTestDB(t)

	// 5h remaining 100, 24h remaining 5000 → available min = 100
	plan := createWindowPlan(t, "B1-tightest", SubscriptionActivationImmediate, 1000, 10000, 0, 0, 100000)
	userId := createTestUser(t, "default", "default")
	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)

	now := GetDBTimestamp()
	require.NoError(t, DB.Model(sub).Updates(map[string]interface{}{
		"window_start_5h":  now - 100,
		"window_used_5h":   int64(900),
		"window_start_24h": now - 100,
		"window_used_24h":  int64(100),
	}).Error)
	require.NoError(t, DB.First(sub, sub.Id).Error)

	available := getSubscriptionAvailableAmountWithPlanTx(DB, sub, plan)
	assert.Equal(t, int64(100), available)

	res, err := PreConsumeUserSubscription("b1-tightest", userId, "gpt-4", 0, 100, "")
	require.NoError(t, err)
	assert.Equal(t, int64(100), res.PreConsumed)

	_, err = PreConsumeUserSubscription("b1-tightest-over", userId, "gpt-4", 0, 1, "")
	assert.Error(t, err)
}

func TestB1_Window_Only24hConfigured(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := createWindowPlan(t, "B1-only24h", SubscriptionActivationImmediate, 0, 500, 0, 0, 100000)
	userId := createTestUser(t, "default", "default")
	_, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)

	_, err = PreConsumeUserSubscription("b1-only24-1", userId, "gpt-4", 0, 500, "")
	require.NoError(t, err)
	_, err = PreConsumeUserSubscription("b1-only24-2", userId, "gpt-4", 0, 1, "")
	assert.Error(t, err)

	var row UserSubscription
	require.NoError(t, DB.Where("user_id = ?", userId).First(&row).Error)
	assert.Equal(t, int64(0), row.WindowStart5h)
	assert.Equal(t, int64(0), row.WindowUsed5h)
	assert.Equal(t, int64(500), row.WindowUsed24h)
}

// ============================================================
// B1: priority split when high-priority window exhausted
// ============================================================
func TestB1_MultiSub_HighPriorityWindowExhausted_Splits(t *testing.T) {
	setupTimeQuotaTestDB(t)

	now := common.GetTimestamp()
	planA := createWindowPlan(t, "B1-pri-A", SubscriptionActivationImmediate, 1000, 0, 0, 0, 100000)
	planB := createWindowPlan(t, "B1-pri-B", SubscriptionActivationImmediate, 5000, 0, 0, 0, 100000)
	// ensure same timestamps ok
	_ = now
	userId := createTestUser(t, "default", "default")
	subA, err := CreateUserSubscriptionFromPlanTx(DB, userId, planA, "order")
	require.NoError(t, err)
	subB, err := CreateUserSubscriptionFromPlanTx(DB, userId, planB, "order")
	require.NoError(t, err)
	require.NoError(t, DB.Model(subA).Update("priority", 10).Error)
	require.NoError(t, DB.Model(subB).Update("priority", 1).Error)

	// Fill A 5h to 900/1000
	ts := GetDBTimestamp()
	require.NoError(t, DB.Model(subA).Updates(map[string]interface{}{
		"window_start_5h": ts - 60,
		"window_used_5h":  int64(900),
	}).Error)

	res, err := PreConsumeUserSubscription("b1-split-window", userId, "gpt-4", 0, 300, "")
	require.NoError(t, err)
	assert.Equal(t, subA.Id, res.UserSubscriptionId)

	var a, b UserSubscription
	require.NoError(t, DB.First(&a, subA.Id).Error)
	require.NoError(t, DB.First(&b, subB.Id).Error)
	assert.Equal(t, int64(100), a.AmountUsed)
	assert.Equal(t, int64(1000), a.WindowUsed5h)
	assert.Equal(t, int64(200), b.AmountUsed)
	assert.Equal(t, int64(200), b.WindowUsed5h)
}

// ============================================================
// B1: quota reset matrix (custom period via mock clock)
// ============================================================
func TestB1_QuotaReset_CustomPeriod_ZerosAmountUsed(t *testing.T) {
	setupTimeQuotaTestDB(t)

	base := time.Now().Unix()
	withTestDBTime(t, base)

	plan := &SubscriptionPlan{
		Title:                   "B1-reset-custom",
		DurationUnit:            SubscriptionDurationDay,
		DurationValue:           30,
		TotalAmount:             10000,
		ActivationMode:          SubscriptionActivationImmediate,
		Enabled:                 true,
		QuotaResetPeriod:        SubscriptionResetCustom,
		QuotaResetCustomSeconds: 3600,
		WindowLimit24h:          5000,
		CreatedAt:               base,
		UpdatedAt:               base,
	}
	require.NoError(t, DB.Create(plan).Error)
	userId := createTestUser(t, "default", "default")
	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)
	require.Greater(t, sub.NextResetTime, int64(0))

	_, err = PreConsumeUserSubscription("b1-reset-use", userId, "gpt-4", 0, 400, "")
	require.NoError(t, err)

	// Jump past next_reset_time
	withTestDBTime(t, sub.NextResetTime+10)
	refreshed, err := EnsureUserSubscriptionPeriodFresh(sub.Id)
	require.NoError(t, err)
	assert.Equal(t, int64(0), refreshed.AmountUsed)
	assert.Greater(t, refreshed.NextResetTime, sub.NextResetTime)

	// Window counters are independent of quota-period reset.
	assert.Equal(t, int64(400), refreshed.WindowUsed24h)
	assert.Greater(t, refreshed.WindowStart24h, int64(0))
}

func TestB1_QuotaReset_Never_NoReset(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := createWindowPlan(t, "B1-reset-never", SubscriptionActivationImmediate, 0, 0, 0, 0, 5000)
	plan.QuotaResetPeriod = SubscriptionResetNever
	require.NoError(t, DB.Save(plan).Error)

	userId := createTestUser(t, "default", "default")
	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)
	assert.Equal(t, int64(0), sub.NextResetTime)

	_, err = PreConsumeUserSubscription("b1-never-use", userId, "gpt-4", 0, 100, "")
	require.NoError(t, err)

	count, err := ResetDueSubscriptions(100)
	require.NoError(t, err)
	assert.Equal(t, 0, count)

	var row UserSubscription
	require.NoError(t, DB.First(&row, sub.Id).Error)
	assert.Equal(t, int64(100), row.AmountUsed)
}

// ============================================================
// B1: cross-period refund does not restore amount_used after reset
// ============================================================
func TestB1_Refund_AcrossQuotaPeriod_SkipsAmountUsed(t *testing.T) {
	setupTimeQuotaTestDB(t)

	base := time.Now().Unix()
	withTestDBTime(t, base)

	plan := &SubscriptionPlan{
		Title:                   "B1-cross-period-refund",
		DurationUnit:            SubscriptionDurationDay,
		DurationValue:           30,
		TotalAmount:             10000,
		ActivationMode:          SubscriptionActivationImmediate,
		Enabled:                 true,
		QuotaResetPeriod:        SubscriptionResetCustom,
		QuotaResetCustomSeconds: 60,
		WindowLimit24h:          5000,
		CreatedAt:               base,
		UpdatedAt:               base,
	}
	require.NoError(t, DB.Create(plan).Error)
	userId := createTestUser(t, "default", "default")
	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)

	_, err = PreConsumeUserSubscription("b1-cross-refund", userId, "gpt-4", 0, 300, "")
	require.NoError(t, err)

	var beforeReset UserSubscription
	require.NoError(t, DB.First(&beforeReset, sub.Id).Error)
	require.Equal(t, int64(300), beforeReset.WindowUsed24h)
	windowStart := beforeReset.WindowStart24h

	// Force period reset
	withTestDBTime(t, sub.NextResetTime+5)
	refreshed, err := EnsureUserSubscriptionPeriodFresh(sub.Id)
	require.NoError(t, err)
	assert.Equal(t, int64(0), refreshed.AmountUsed)
	// Window counters independent of quota reset.
	assert.Equal(t, int64(300), refreshed.WindowUsed24h)

	// New period consume
	_, err = PreConsumeUserSubscription("b1-new-period", userId, "gpt-4", 0, 50, "")
	require.NoError(t, err)

	// Refund old request — amount_used in new period must stay 50,
	// but active window used should still refund the old 300.
	require.NoError(t, RefundSubscriptionPreConsume("b1-cross-refund"))

	var row UserSubscription
	require.NoError(t, DB.First(&row, sub.Id).Error)
	assert.Equal(t, int64(50), row.AmountUsed, "cross-period refund must not touch new period amount_used")
	assert.Equal(t, windowStart, row.WindowStart24h, "window period keeps start")
	assert.Equal(t, int64(50), row.WindowUsed24h, "window should refund even across quota period")
}

// ============================================================
// B1: refund keeps window start (period already started)
// ============================================================
func TestB1_Refund_KeepsWindowStartWhenUsedZero(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := createWindowPlan(t, "B1-refund-keep-start", SubscriptionActivationImmediate, 2000, 8000, 0, 0, 100000)
	userId := createTestUser(t, "default", "default")
	_, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)

	_, err = PreConsumeUserSubscription("b1-refund-keep", userId, "gpt-4", 0, 250, "")
	require.NoError(t, err)

	var before UserSubscription
	require.NoError(t, DB.Where("user_id = ?", userId).First(&before).Error)
	start5h, start24h := before.WindowStart5h, before.WindowStart24h

	require.NoError(t, RefundSubscriptionPreConsume("b1-refund-keep"))

	usage, err := GetSubscriptionWindowUsage(before.Id)
	require.NoError(t, err)
	assert.Equal(t, int64(0), usage["5h"].Used)
	assert.Equal(t, int64(0), usage["24h"].Used)
	assert.Equal(t, start5h, usage["5h"].Since)
	assert.Equal(t, start24h, usage["24h"].Since)
	assert.Equal(t, start5h+5*3600, usage["5h"].ResetAt)
	assert.Greater(t, usage["5h"].ResetAfterSeconds, int64(0))
}

// ============================================================
// B1: disabled subscription skipped for windows and consume
// ============================================================
func TestB1_Disabled_SkippedForConsumeAndWindows(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := createWindowPlan(t, "B1-disabled", SubscriptionActivationImmediate, 1000, 0, 0, 0, 100000)
	userId := createTestUser(t, "default", "default")
	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)
	require.NoError(t, DB.Model(sub).Update("disabled", true).Error)

	_, err = PreConsumeUserSubscription("b1-disabled", userId, "gpt-4", 0, 10, "")
	assert.Error(t, err)

	var row UserSubscription
	require.NoError(t, DB.First(&row, sub.Id).Error)
	assert.Equal(t, int64(0), row.WindowStart5h)
	assert.Equal(t, int64(0), row.AmountUsed)
}

// ============================================================
// B1: total quota and window both constrain
// ============================================================
func TestB1_TotalAndWindow_BothConstrain(t *testing.T) {
	setupTimeQuotaTestDB(t)

	// total=500, 24h=10000 → total wins
	plan := createWindowPlan(t, "B1-total-win", SubscriptionActivationImmediate, 0, 10000, 0, 0, 500)
	userId := createTestUser(t, "default", "default")
	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)

	available := getSubscriptionAvailableAmountWithPlanTx(DB, sub, plan)
	assert.Equal(t, int64(500), available)

	// total=10000, 24h=300 → window wins after partial use
	plan2 := createWindowPlan(t, "B1-window-win", SubscriptionActivationImmediate, 0, 300, 0, 0, 10000)
	sub2, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan2, "order")
	require.NoError(t, err)
	ts := GetDBTimestamp()
	require.NoError(t, DB.Model(sub2).Updates(map[string]interface{}{
		"window_start_24h": ts,
		"window_used_24h":  int64(200),
	}).Error)
	require.NoError(t, DB.First(sub2, sub2.Id).Error)
	available2 := getSubscriptionAvailableAmountWithPlanTx(DB, sub2, plan2)
	assert.Equal(t, int64(100), available2)
}

// ============================================================
// B1: expire due pending activation window
// ============================================================
func TestB1_Expire_PendingPastActivationWindow(t *testing.T) {
	setupTimeQuotaTestDB(t)

	now := common.GetTimestamp()
	plan := &SubscriptionPlan{
		Title:                   "B1-expire-pending",
		DurationUnit:            SubscriptionDurationHour,
		DurationValue:           5,
		TotalAmount:             10000,
		ActivationMode:          SubscriptionActivationOnFirstUse,
		ActivationWindowSeconds: 3600,
		Enabled:                 true,
		CreatedAt:               now,
		UpdatedAt:               now,
	}
	require.NoError(t, DB.Create(plan).Error)
	userId := createTestUser(t, "default", "default")
	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)

	// Make created_at old enough to expire
	require.NoError(t, DB.Model(sub).UpdateColumns(map[string]interface{}{
		"created_at": now - 7200,
		"updated_at": now - 7200,
	}).Error)

	count, err := ExpireDueSubscriptions(100)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, count, 1)

	var row UserSubscription
	require.NoError(t, DB.First(&row, sub.Id).Error)
	assert.Equal(t, UserSubscriptionStatusExpired, row.Status)
}
