package model

import (
	"fmt"
	"strings"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestTopUpLifecyclePendingCreationEmitsDelayedEngagementEvent(t *testing.T) {
	setupTopUpLifecycleTestDB(t, 1)
	user := createLifecycleQuotaTestUser(t, "topup-pending", 0, 100)
	topUp := createTopUpLifecycleOrder(t, user.Id, "topup-pending-event", PaymentProviderStripe, common.TopUpStatusPending, 1_700_001_000, 0)

	require.NoError(t, topUp.Insert())

	event := requireTopUpLifecycleEvent(t, user.Id, RecallLifecycleTriggerPaymentPending, topUp.TradeNo)
	require.Equal(t, topUp.CreateTime, event.OccurredAt)
	require.Equal(t, topUp.CreateTime+86400, event.AvailableAt)
	require.Contains(t, event.BusinessKey, "v1|payment_pending|topup|trade:"+topUp.TradeNo)
	requireTopUpLifecycleEventCount(t, topUp.TradeNo, RecallLifecycleTriggerPaymentPending, 1)
}

func TestTopUpLifecycleTerminalFailureAndReplayEmitOneServiceEvent(t *testing.T) {
	setupTopUpLifecycleTestDB(t, 1)
	user := createLifecycleQuotaTestUser(t, "topup-failure", 0, 100)
	topUp := insertTopUpLifecycleOrder(t, user.Id, "topup-failed-once", PaymentProviderStripe, common.TopUpStatusPending, 1_700_002_000, 0)

	applied, err := transitionTopUpLifecycleForTest(PurchaseLifecycleTransition{
		Kind:       "topup",
		SourceID:   int64(topUp.Id),
		TradeNo:    topUp.TradeNo,
		UserID:     user.Id,
		FromStatus: []string{common.TopUpStatusPending},
		ToStatus:   common.TopUpStatusFailed,
		OccurredAt: 1_700_002_100,
		SourceRef:  "stripe.async_payment_failed",
	})
	require.NoError(t, err)
	require.True(t, applied)

	applied, err = transitionTopUpLifecycleForTest(PurchaseLifecycleTransition{
		Kind:       "topup",
		SourceID:   int64(topUp.Id),
		TradeNo:    topUp.TradeNo,
		UserID:     user.Id,
		FromStatus: []string{common.TopUpStatusPending},
		ToStatus:   common.TopUpStatusFailed,
		OccurredAt: 1_700_002_200,
		SourceRef:  "stripe.async_payment_failed.replay",
	})
	require.NoError(t, err)
	require.False(t, applied)

	stored := GetTopUpByTradeNo(topUp.TradeNo)
	require.Equal(t, common.TopUpStatusFailed, stored.Status)
	requireTopUpLifecycleEventCount(t, topUp.TradeNo, RecallLifecycleTriggerPaymentFailed, 1)
	requireTopUpLifecycleEventCount(t, topUp.TradeNo, RecallLifecycleTriggerPaymentSucceeded, 0)
	require.Equal(t, 0, walletQuotaForTest(t, user.Id))
}

func TestTopUpLifecycleTerminalFailureStatusesReplayAsOneFailedEvent(t *testing.T) {
	for _, tc := range []struct {
		name   string
		status string
	}{
		{name: "expired", status: common.TopUpStatusExpired},
		{name: "cancelled", status: "cancelled"},
		{name: "canceled", status: "canceled"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			setupTopUpLifecycleTestDB(t, 1)
			user := createLifecycleQuotaTestUser(t, "topup-terminal-"+tc.name, 0, 100)
			topUp := insertTopUpLifecycleOrder(t, user.Id, "topup-terminal-"+tc.name, PaymentProviderStripe, common.TopUpStatusPending, 1_700_002_500, 0)

			transition := PurchaseLifecycleTransition{
				Kind:       "topup",
				SourceID:   int64(topUp.Id),
				TradeNo:    topUp.TradeNo,
				UserID:     user.Id,
				FromStatus: []string{common.TopUpStatusPending},
				ToStatus:   tc.status,
				OccurredAt: 1_700_002_600,
				SourceRef:  "provider." + tc.name,
			}
			applied, err := transitionTopUpLifecycleForTest(transition)
			require.NoError(t, err)
			require.True(t, applied)

			transition.OccurredAt = 1_700_002_700
			transition.SourceRef += ".replay"
			applied, err = transitionTopUpLifecycleForTest(transition)
			require.NoError(t, err)
			require.False(t, applied)

			stored := GetTopUpByTradeNo(topUp.TradeNo)
			require.Equal(t, tc.status, stored.Status)
			requireTopUpLifecycleEventCount(t, topUp.TradeNo, RecallLifecycleTriggerPaymentFailed, 1)
			requireTopUpLifecycleEventCount(t, topUp.TradeNo, RecallLifecycleTriggerPaymentSucceeded, 0)
			require.Equal(t, 0, walletQuotaForTest(t, user.Id))
			requireTopUpLifecycleStateCount(t, user.Id, 0)
		})
	}
}

func TestTopUpLifecycleFailureCorrectionToSuccessCreditsAndRotatesOnce(t *testing.T) {
	setupTopUpLifecycleTestDB(t, 1)
	user := createLifecycleQuotaTestUser(t, "topup-corrected", 25, 100)
	topUp := insertTopUpLifecycleOrder(t, user.Id, "topup-corrected-success", PaymentProviderStripe, common.TopUpStatusPending, 1_700_003_000, 0)

	applied, err := transitionTopUpLifecycleForTest(PurchaseLifecycleTransition{
		Kind:       "topup",
		SourceID:   int64(topUp.Id),
		TradeNo:    topUp.TradeNo,
		UserID:     user.Id,
		FromStatus: []string{common.TopUpStatusPending},
		ToStatus:   common.TopUpStatusFailed,
		OccurredAt: 1_700_003_100,
		SourceRef:  "provider.failed",
	})
	require.NoError(t, err)
	require.True(t, applied)

	applied, err = transitionTopUpLifecycleForTest(PurchaseLifecycleTransition{
		Kind:       "topup",
		SourceID:   int64(topUp.Id),
		TradeNo:    topUp.TradeNo,
		UserID:     user.Id,
		FromStatus: []string{common.TopUpStatusPending, common.TopUpStatusFailed},
		ToStatus:   common.TopUpStatusSuccess,
		OccurredAt: 1_700_003_200,
		Credit:     200,
		SourceRef:  "provider.corrected",
	})
	require.NoError(t, err)
	require.True(t, applied)

	applied, err = transitionTopUpLifecycleForTest(PurchaseLifecycleTransition{
		Kind:       "topup",
		SourceID:   int64(topUp.Id),
		TradeNo:    topUp.TradeNo,
		UserID:     user.Id,
		FromStatus: []string{common.TopUpStatusPending, common.TopUpStatusFailed},
		ToStatus:   common.TopUpStatusSuccess,
		OccurredAt: 1_700_003_300,
		Credit:     200,
		SourceRef:  "provider.corrected.replay",
	})
	require.NoError(t, err)
	require.False(t, applied)

	require.Equal(t, 225, walletQuotaForTest(t, user.Id))
	state := lifecycleStateForTest(t, user.Id, QuotaLifecycleScopeWallet, fmt.Sprint(user.Id))
	require.Equal(t, "topup:"+topUp.TradeNo, state.Cycle)
	require.EqualValues(t, 225, state.Balance)
	requireTopUpLifecycleEventCount(t, topUp.TradeNo, RecallLifecycleTriggerPaymentFailed, 1)
	requireTopUpLifecycleEventCount(t, topUp.TradeNo, RecallLifecycleTriggerPaymentSucceeded, 1)
}

func TestTopUpLifecycleConcurrentSuccessCreditsCycleAndEventOnce(t *testing.T) {
	setupTopUpLifecycleTestDB(t, 4)
	user := createLifecycleQuotaTestUser(t, "topup-concurrent", 0, 100)
	topUp := insertTopUpLifecycleOrder(t, user.Id, "topup-concurrent-success", PaymentProviderPaddle, common.TopUpStatusPending, 1_700_004_000, 0)

	start := make(chan struct{})
	results := make(chan struct {
		applied bool
		err     error
	}, 8)
	var wg sync.WaitGroup
	for i := 0; i < cap(results); i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			applied, err := transitionTopUpLifecycleForTest(PurchaseLifecycleTransition{
				Kind:       "topup",
				SourceID:   int64(topUp.Id),
				TradeNo:    topUp.TradeNo,
				UserID:     user.Id,
				FromStatus: []string{common.TopUpStatusPending},
				ToStatus:   common.TopUpStatusSuccess,
				OccurredAt: 1_700_004_100,
				Credit:     300,
				SourceRef:  "paddle.webhook",
			})
			results <- struct {
				applied bool
				err     error
			}{applied: applied, err: err}
		}()
	}
	close(start)
	wg.Wait()
	close(results)

	appliedCount := 0
	for result := range results {
		require.NoError(t, result.err)
		if result.applied {
			appliedCount++
		}
	}
	require.Equal(t, 1, appliedCount)
	require.Equal(t, 300, walletQuotaForTest(t, user.Id))
	state := lifecycleStateForTest(t, user.Id, QuotaLifecycleScopeWallet, fmt.Sprint(user.Id))
	require.Equal(t, "topup:"+topUp.TradeNo, state.Cycle)
	requireTopUpLifecycleEventCount(t, topUp.TradeNo, RecallLifecycleTriggerPaymentSucceeded, 1)
}

func TestTopUpLifecycleMissingTradeNumberUsesStableSourceFallback(t *testing.T) {
	setupTopUpLifecycleTestDB(t, 1)
	user := createLifecycleQuotaTestUser(t, "topup-fallback", 0, 100)
	topUp := insertTopUpLifecycleOrder(t, user.Id, "", PaymentProviderStripe, common.TopUpStatusPending, 1_700_005_000, 0)

	applied, err := transitionTopUpLifecycleForTest(PurchaseLifecycleTransition{
		Kind:       "topup",
		SourceID:   int64(topUp.Id),
		UserID:     user.Id,
		FromStatus: []string{common.TopUpStatusPending},
		ToStatus:   common.TopUpStatusSuccess,
		OccurredAt: 1_700_005_100,
		Credit:     400,
		SourceRef:  "legacy.provider",
	})
	require.NoError(t, err)
	require.True(t, applied)

	event := requireTopUpLifecycleEventBySource(t, user.Id, RecallLifecycleTriggerPaymentSucceeded, int64(topUp.Id))
	require.Contains(t, event.BusinessKey, fmt.Sprintf("v1|payment_succeeded|topup|source:top_ups:%d", topUp.Id))
	state := lifecycleStateForTest(t, user.Id, QuotaLifecycleScopeWallet, fmt.Sprint(user.Id))
	require.Equal(t, fmt.Sprintf("topups:%d", topUp.Id), state.Cycle)
	require.Equal(t, 400, walletQuotaForTest(t, user.Id))
}

func TestTopUpLifecycleCASLoserDoesNotEmitEventOrCredit(t *testing.T) {
	setupTopUpLifecycleTestDB(t, 1)
	user := createLifecycleQuotaTestUser(t, "topup-cas-loser", 0, 100)
	topUp := insertTopUpLifecycleOrder(t, user.Id, "topup-cas-loser", PaymentProviderStripe, common.TopUpStatusPending, 1_700_006_000, 0)

	callbackName := "test:force_topup_lifecycle_cas_loss"
	fired := false
	var callbackErr error
	require.NoError(t, DB.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if fired || tx.Statement == nil || tx.Statement.Table != "top_ups" {
			return
		}
		fired = true
		callbackErr = tx.Exec("UPDATE top_ups SET status = ?, complete_time = ? WHERE id = ?", common.TopUpStatusSuccess, int64(1_700_006_050), topUp.Id).Error
	}))
	defer func() {
		require.NoError(t, DB.Callback().Update().Remove(callbackName))
	}()

	applied, err := transitionTopUpLifecycleForTest(PurchaseLifecycleTransition{
		Kind:       "topup",
		SourceID:   int64(topUp.Id),
		TradeNo:    topUp.TradeNo,
		UserID:     user.Id,
		FromStatus: []string{common.TopUpStatusPending},
		ToStatus:   common.TopUpStatusSuccess,
		OccurredAt: 1_700_006_100,
		Credit:     500,
		SourceRef:  "provider.cas_loser",
	})
	require.NoError(t, callbackErr)
	require.NoError(t, err)
	require.True(t, fired)
	require.False(t, applied)

	stored := GetTopUpByTradeNo(topUp.TradeNo)
	require.Equal(t, common.TopUpStatusSuccess, stored.Status)
	require.Equal(t, 0, walletQuotaForTest(t, user.Id))
	requireTopUpLifecycleEventCount(t, topUp.TradeNo, RecallLifecycleTriggerPaymentSucceeded, 0)
}

func TestTopUpLifecycleStripeAutoChargeEmitsSuccessEventAndCreditsOnce(t *testing.T) {
	setupTopUpLifecycleTestDB(t, 1)
	user := createLifecycleQuotaTestUser(t, "topup-auto-charge", 0, 100)

	require.NoError(t, CreditStripeAutoCharge(user.Id, 3, 3.0, "pi_lifecycle_auto", "127.0.0.1"))

	tradeNo := "auto_pi_lifecycle_auto"
	wantQuota := 3 * int(common.QuotaPerUnit)
	topUp := GetTopUpByTradeNo(tradeNo)
	require.NotNil(t, topUp)
	require.Equal(t, common.TopUpStatusSuccess, topUp.Status)
	require.Equal(t, wantQuota, walletQuotaForTest(t, user.Id))
	state := lifecycleStateForTest(t, user.Id, QuotaLifecycleScopeWallet, fmt.Sprint(user.Id))
	require.Equal(t, "topup:"+tradeNo, state.Cycle)
	requireTopUpLifecycleEventCount(t, tradeNo, RecallLifecycleTriggerPaymentPending, 0)
	requireTopUpLifecycleEventCount(t, tradeNo, RecallLifecycleTriggerPaymentSucceeded, 1)

	err := CreditStripeAutoCharge(user.Id, 3, 3.0, "pi_lifecycle_auto", "127.0.0.1")
	require.Error(t, err)
	require.Equal(t, wantQuota, walletQuotaForTest(t, user.Id))
	requireTopUpLifecycleEventCount(t, tradeNo, RecallLifecycleTriggerPaymentSucceeded, 1)
}

func TestTopUpLifecycleStripeAutoChargeFailureAttemptEmitsFailedEventOnce(t *testing.T) {
	setupTopUpLifecycleTestDB(t, 1)
	user := createLifecycleQuotaTestUser(t, "topup-auto-failure", 0, 100)

	RecordStripeAutoChargeAttempt(user.Id, 3, "attempt_lifecycle_failure")
	RecordStripeAutoChargeAttempt(user.Id, 3, "attempt_lifecycle_failure")

	tradeNo := "autofail_attempt_lifecycle_failure"
	var count int64
	require.NoError(t, DB.Model(&TopUp{}).Where("trade_no = ?", tradeNo).Count(&count).Error)
	require.EqualValues(t, 1, count)
	topUp := GetTopUpByTradeNo(tradeNo)
	require.NotNil(t, topUp)
	require.Equal(t, common.TopUpStatusFailed, topUp.Status)
	require.Equal(t, 0, walletQuotaForTest(t, user.Id))
	requireTopUpLifecycleStateCount(t, user.Id, 0)
	requireTopUpLifecycleEventCount(t, tradeNo, RecallLifecycleTriggerPaymentPending, 0)
	requireTopUpLifecycleEventCount(t, tradeNo, RecallLifecycleTriggerPaymentFailed, 1)
}

func setupTopUpLifecycleTestDB(t *testing.T, maxOpenConns int) {
	t.Helper()
	setupLifecycleQuotaMutationTestDB(t, maxOpenConns)
	require.NoError(t, DB.AutoMigrate(&TopUp{}, &Log{}, &TopUpBonusClaim{}, &PaymentAnalyticsOutbox{}, &PaymentAnalyticsEventReceipt{}))
}

func createTopUpLifecycleOrder(t *testing.T, userID int, tradeNo string, provider string, status string, createTime int64, completeTime int64) *TopUp {
	t.Helper()
	return &TopUp{
		UserId:          userID,
		Amount:          2,
		Money:           2,
		TradeNo:         tradeNo,
		PaymentMethod:   provider,
		PaymentProvider: provider,
		CreateTime:      createTime,
		CompleteTime:    completeTime,
		Status:          status,
	}
}

func insertTopUpLifecycleOrder(t *testing.T, userID int, tradeNo string, provider string, status string, createTime int64, completeTime int64) *TopUp {
	t.Helper()
	topUp := createTopUpLifecycleOrder(t, userID, tradeNo, provider, status, createTime, completeTime)
	require.NoError(t, DB.Create(topUp).Error)
	return topUp
}

func transitionTopUpLifecycleForTest(transition PurchaseLifecycleTransition) (bool, error) {
	var applied bool
	err := DB.Transaction(func(tx *gorm.DB) error {
		var err error
		applied, err = PersistPurchaseLifecycleTransition(tx, transition)
		return err
	})
	return applied, err
}

func requireTopUpLifecycleEvent(t *testing.T, userID int, eventType string, tradeNo string) RecallLifecycleEvent {
	t.Helper()
	var event RecallLifecycleEvent
	require.NoError(t, DB.Where("user_id = ? AND event_type = ? AND business_key = ?", userID, eventType, fmt.Sprintf("v1|%s|topup|trade:%s", eventType, tradeNo)).First(&event).Error)
	require.Equal(t, "topup", event.ScopeType)
	require.Equal(t, tradeNo, event.ScopeId)
	require.Equal(t, RecallLifecycleEventPending, event.Disposition)
	var payload map[string]any
	require.NoError(t, common.Unmarshal([]byte(event.EventData), &payload))
	require.Equal(t, "topup", payload["purchase_kind"])
	return event
}

func requireTopUpLifecycleEventBySource(t *testing.T, userID int, eventType string, sourceID int64) RecallLifecycleEvent {
	t.Helper()
	var event RecallLifecycleEvent
	require.NoError(t, DB.Where("user_id = ? AND event_type = ? AND business_key = ?", userID, eventType, fmt.Sprintf("v1|%s|topup|source:top_ups:%d", eventType, sourceID)).First(&event).Error)
	require.Equal(t, "topup", event.ScopeType)
	require.Equal(t, fmt.Sprintf("top_ups:%d", sourceID), event.ScopeId)
	return event
}

func requireTopUpLifecycleEventCount(t *testing.T, tradeNo string, eventType string, want int64) {
	t.Helper()
	var count int64
	query := DB.Model(&RecallLifecycleEvent{}).Where("event_type = ?", eventType)
	if strings.TrimSpace(tradeNo) != "" {
		query = query.Where("business_key = ?", fmt.Sprintf("v1|%s|topup|trade:%s", eventType, tradeNo))
	}
	require.NoError(t, query.Count(&count).Error)
	require.Equal(t, want, count)
}

func requireTopUpLifecycleStateCount(t *testing.T, userID int, want int64) {
	t.Helper()
	var count int64
	require.NoError(t, DB.Model(&QuotaLifecycleState{}).Where("user_id = ? AND scope_type = ?", userID, QuotaLifecycleScopeWallet).Count(&count).Error)
	require.Equal(t, want, count)
}
