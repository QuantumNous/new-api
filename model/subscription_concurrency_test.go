package model

import (
	"fmt"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// T5.5.1 — concurrent pre-consume against a single pending_activation subscription.
// Only one goroutine should be the activator; total used amount must equal sum of accepted requests.
func TestPreConsume_Concurrent_ActivatesOnceAndConsumesCorrectly(t *testing.T) {
	setupTimeQuotaTestDB(t)
	if common.UsingSQLite {
		t.Skip("SQLite serializes concurrent writers; run with TEST_SQL_DSN on MySQL/PostgreSQL")
	}

	now := common.GetTimestamp()
	plan := &SubscriptionPlan{
		Title:                   "并发-月套餐",
		DurationUnit:            SubscriptionDurationDay,
		DurationValue:           30,
		TotalAmount:             10000,
		ActivationMode:          SubscriptionActivationOnFirstUse,
		ActivationWindowSeconds: 86400,
		Enabled:                 true,
		CreatedAt:               now,
		UpdatedAt:               now,
	}
	require.NoError(t, DB.Create(plan).Error)

	userId := createTestUser(t, "default", "default")
	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "concurrent-order")
	require.NoError(t, err)
	require.Equal(t, UserSubscriptionStatusPendingActivation, sub.Status)

	const N = 20
	const each int64 = 50
	var wg sync.WaitGroup
	successCount := 0
	failCount := 0
	var mu sync.Mutex

	for i := 0; i < N; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			reqId := fmt.Sprintf("concurrent-req-%d", i)
			res, err := PreConsumeUserSubscription(reqId, userId, "gpt-4", 0, each, "")
			mu.Lock()
			defer mu.Unlock()
			if err == nil && res != nil {
				successCount++
			} else {
				failCount++
			}
		}(i)
	}
	wg.Wait()

	// Read final state
	var updated UserSubscription
	require.NoError(t, DB.First(&updated, sub.Id).Error)

	// Activation must have happened exactly once: status active, end_time set
	assert.Equal(t, UserSubscriptionStatusActive, updated.Status, "subscription should be active")
	assert.Greater(t, updated.ActivatedAt, int64(0))
	assert.Greater(t, updated.EndTime, int64(0))

	// AmountUsed should equal sum of successful pre-consumes (no over-debit, no under-debit)
	expected := int64(successCount) * each
	assert.Equal(t, expected, updated.AmountUsed, "amount_used must match accepted pre-consumes exactly")

	// Total accepted cannot exceed total budget
	assert.LessOrEqual(t, updated.AmountUsed, plan.TotalAmount, "must not over-consume")

	t.Logf("N=%d, success=%d, fail=%d, amount_used=%d/%d", N, successCount, failCount, updated.AmountUsed, plan.TotalAmount)
}

// T5.5.2 — idempotency: same requestId across goroutines returns the same result, charges once.
func TestPreConsume_Concurrent_SameRequestIdIdempotent(t *testing.T) {
	setupTimeQuotaTestDB(t)
	if common.UsingSQLite {
		t.Skip("SQLite serializes concurrent writers; run with TEST_SQL_DSN on MySQL/PostgreSQL")
	}

	now := common.GetTimestamp()
	plan := &SubscriptionPlan{
		Title:                   "幂等-额度套餐",
		DurationUnit:            SubscriptionDurationDay,
		DurationValue:           30,
		TotalAmount:             10000,
		ActivationMode:          SubscriptionActivationImmediate,
		ActivationWindowSeconds: 0,
		Enabled:                 true,
		CreatedAt:               now,
		UpdatedAt:               now,
	}
	require.NoError(t, DB.Create(plan).Error)

	userId := createTestUser(t, "default", "default")
	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "idem-order")
	require.NoError(t, err)
	require.Equal(t, UserSubscriptionStatusActive, sub.Status)

	const N = 10
	const reqId = "shared-req-id"
	const amount int64 = 100

	var wg sync.WaitGroup
	results := make([]*SubscriptionPreConsumeResult, N)
	errs := make([]error, N)
	for i := 0; i < N; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			results[i], errs[i] = PreConsumeUserSubscription(reqId, userId, "gpt-4", 0, amount, "")
		}(i)
	}
	wg.Wait()

	successCount := 0
	var preConsumeIds []int64
	for i := 0; i < N; i++ {
		if errs[i] == nil && results[i] != nil {
			successCount++
			preConsumeIds = append(preConsumeIds, int64(results[i].UserSubscriptionId))
		}
	}
	assert.Equal(t, N, successCount, "all goroutines with same requestId should succeed idempotently")

	// Only one record was created (idempotent), so amount_used should be exactly one * amount
	var updated UserSubscription
	require.NoError(t, DB.First(&updated, sub.Id).Error)
	assert.Equal(t, amount, updated.AmountUsed, "must charge only once for same requestId")

	// Verify only one pre-consume record persisted
	var count int64
	DB.Model(&SubscriptionPreConsumeRecord{}).Where("request_id = ?", reqId).Count(&count)
	assert.Equal(t, int64(1), count, "only one record per requestId")
}

// T5.5.3 — concurrent priority-ordered consumption: high-priority sub consumed first.
func TestPreConsume_Concurrent_PriorityRespected(t *testing.T) {
	setupTimeQuotaTestDB(t)
	if common.UsingSQLite {
		t.Skip("SQLite serializes concurrent writers; run with TEST_SQL_DSN on MySQL/PostgreSQL")
	}

	now := common.GetTimestamp()
	plan := &SubscriptionPlan{
		Title:                   "优先级-月套餐",
		DurationUnit:            SubscriptionDurationDay,
		DurationValue:           30,
		TotalAmount:             5000,
		ActivationMode:          SubscriptionActivationImmediate,
		ActivationWindowSeconds: 0,
		Enabled:                 true,
		CreatedAt:               now,
		UpdatedAt:               now,
	}
	require.NoError(t, DB.Create(plan).Error)

	userId := createTestUser(t, "default", "default")
	high, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "high-order")
	require.NoError(t, err)
	low, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "low-order")
	require.NoError(t, err)

	// Set priorities: high=5, low=1
	require.NoError(t, DB.Model(&UserSubscription{}).Where("id = ?", high.Id).Update("priority", 5).Error)
	require.NoError(t, DB.Model(&UserSubscription{}).Where("id = ?", low.Id).Update("priority", 1).Error)

	// Concurrently consume amounts that together exceed one sub's budget but fit both
	const N = 20
	const each int64 = 200 // 20 * 200 = 4000 (< single sub 5000)

	var wg sync.WaitGroup
	for i := 0; i < N; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			reqId := fmt.Sprintf("prio-req-%d", i)
			_, _ = PreConsumeUserSubscription(reqId, userId, "gpt-4", 0, each, "")
		}(i)
	}
	wg.Wait()

	var highUpdated, lowUpdated UserSubscription
	require.NoError(t, DB.First(&highUpdated, high.Id).Error)
	require.NoError(t, DB.First(&lowUpdated, low.Id).Error)

	t.Logf("high.priority=5 used=%d/%d, low.priority=1 used=%d/%d",
		highUpdated.AmountUsed, plan.TotalAmount, lowUpdated.AmountUsed, plan.TotalAmount)

	// High priority sub should bear the entire load since total demand (4000) < high budget (5000)
	assert.Equal(t, int64(4000), highUpdated.AmountUsed, "high-priority sub should bear all load")
	assert.Equal(t, int64(0), lowUpdated.AmountUsed, "low-priority sub should remain untouched")
}

func TestPreConsume_SplitsAcrossSubscriptionsByPriority(t *testing.T) {
	setupTimeQuotaTestDB(t)

	now := common.GetTimestamp()
	planHigh := &SubscriptionPlan{
		Title:          "高优先级-5小时剩余少",
		DurationUnit:   SubscriptionDurationDay,
		DurationValue:  30,
		TotalAmount:    1000,
		WindowLimit5h:  1000,
		WindowLimit7d:  1000,
		WindowLimit30d: 1000,
		ActivationMode: SubscriptionActivationImmediate,
		Enabled:        true,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	planLow := &SubscriptionPlan{
		Title:          "低优先级-5小时剩余多",
		DurationUnit:   SubscriptionDurationDay,
		DurationValue:  30,
		TotalAmount:    1000,
		WindowLimit5h:  1000,
		WindowLimit7d:  1000,
		WindowLimit30d: 1000,
		ActivationMode: SubscriptionActivationImmediate,
		Enabled:        true,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	require.NoError(t, DB.Create(planHigh).Error)
	require.NoError(t, DB.Create(planLow).Error)

	userId := createTestUser(t, "default", "default")
	high, err := CreateUserSubscriptionFromPlanTx(DB, userId, planHigh, "high-order")
	require.NoError(t, err)
	low, err := CreateUserSubscriptionFromPlanTx(DB, userId, planLow, "low-order")
	require.NoError(t, err)

	require.NoError(t, DB.Model(&UserSubscription{}).Where("id = ?", high.Id).Updates(map[string]interface{}{
		"priority":    10,
		"amount_used": int64(900),
	}).Error)
	require.NoError(t, DB.Model(&UserSubscription{}).Where("id = ?", low.Id).Update("priority", 1).Error)

	res, err := PreConsumeUserSubscription("split-req", userId, "gpt-4", 0, 700, "")
	require.NoError(t, err)
	require.NotNil(t, res)
	assert.Equal(t, high.Id, res.UserSubscriptionId)
	assert.Equal(t, int64(700), res.PreConsumed)

	var highUpdated, lowUpdated UserSubscription
	require.NoError(t, DB.First(&highUpdated, high.Id).Error)
	require.NoError(t, DB.First(&lowUpdated, low.Id).Error)
	assert.Equal(t, int64(1000), highUpdated.AmountUsed)
	assert.Equal(t, int64(600), lowUpdated.AmountUsed)

	var details []SubscriptionPreConsumeDetail
	require.NoError(t, DB.Where("request_id = ?", "split-req").Order("id asc").Find(&details).Error)
	require.Len(t, details, 2)
	assert.Equal(t, high.Id, details[0].UserSubscriptionId)
	assert.Equal(t, int64(100), details[0].PreConsumed)
	assert.Equal(t, low.Id, details[1].UserSubscriptionId)
	assert.Equal(t, int64(600), details[1].PreConsumed)
}

func TestRefundSubscriptionPreConsume_RefundsSplitDetails(t *testing.T) {
	setupTimeQuotaTestDB(t)

	now := common.GetTimestamp()
	plan := &SubscriptionPlan{
		Title:          "拆分退款套餐",
		DurationUnit:   SubscriptionDurationDay,
		DurationValue:  30,
		TotalAmount:    1000,
		ActivationMode: SubscriptionActivationImmediate,
		Enabled:        true,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	require.NoError(t, DB.Create(plan).Error)
	userId := createTestUser(t, "default", "default")
	high, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "high-order")
	require.NoError(t, err)
	low, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "low-order")
	require.NoError(t, err)
	require.NoError(t, DB.Model(&UserSubscription{}).Where("id = ?", high.Id).Updates(map[string]interface{}{"priority": 10, "amount_used": int64(900)}).Error)
	require.NoError(t, DB.Model(&UserSubscription{}).Where("id = ?", low.Id).Update("priority", 1).Error)

	_, err = PreConsumeUserSubscription("split-refund-req", userId, "gpt-4", 0, 700, "")
	require.NoError(t, err)
	require.NoError(t, RefundSubscriptionPreConsume("split-refund-req"))

	var highUpdated, lowUpdated UserSubscription
	require.NoError(t, DB.First(&highUpdated, high.Id).Error)
	require.NoError(t, DB.First(&lowUpdated, low.Id).Error)
	assert.Equal(t, int64(900), highUpdated.AmountUsed)
	assert.Equal(t, int64(0), lowUpdated.AmountUsed)

	var detailCount int64
	require.NoError(t, DB.Model(&SubscriptionPreConsumeDetail{}).Where("request_id = ? AND status = ?", "split-refund-req", "refunded").Count(&detailCount).Error)
	assert.Equal(t, int64(2), detailCount)
}

func TestAdjustSubscriptionPreConsume_AdjustsSplitDetails(t *testing.T) {
	setupTimeQuotaTestDB(t)

	now := common.GetTimestamp()
	plan := &SubscriptionPlan{
		Title:          "拆分结算套餐",
		DurationUnit:   SubscriptionDurationDay,
		DurationValue:  30,
		TotalAmount:    1000,
		ActivationMode: SubscriptionActivationImmediate,
		Enabled:        true,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	require.NoError(t, DB.Create(plan).Error)
	userId := createTestUser(t, "default", "default")
	high, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "high-order")
	require.NoError(t, err)
	low, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "low-order")
	require.NoError(t, err)
	require.NoError(t, DB.Model(&UserSubscription{}).Where("id = ?", high.Id).Updates(map[string]interface{}{"priority": 10, "amount_used": int64(900)}).Error)
	require.NoError(t, DB.Model(&UserSubscription{}).Where("id = ?", low.Id).Update("priority", 1).Error)

	_, err = PreConsumeUserSubscription("split-adjust-req", userId, "gpt-4", 0, 700, "")
	require.NoError(t, err)
	require.NoError(t, AdjustSubscriptionPreConsume("split-adjust-req", userId, 200, ""))

	var highUpdated, lowUpdated UserSubscription
	require.NoError(t, DB.First(&highUpdated, high.Id).Error)
	require.NoError(t, DB.First(&lowUpdated, low.Id).Error)
	assert.Equal(t, int64(1000), highUpdated.AmountUsed)
	assert.Equal(t, int64(800), lowUpdated.AmountUsed)

	require.NoError(t, AdjustSubscriptionPreConsume("split-adjust-req", userId, -300, ""))
	require.NoError(t, DB.First(&highUpdated, high.Id).Error)
	require.NoError(t, DB.First(&lowUpdated, low.Id).Error)
	assert.Equal(t, int64(1000), highUpdated.AmountUsed)
	assert.Equal(t, int64(500), lowUpdated.AmountUsed)

	var record SubscriptionPreConsumeRecord
	require.NoError(t, DB.Where("request_id = ?", "split-adjust-req").First(&record).Error)
	assert.Equal(t, int64(600), record.PreConsumed)
}
