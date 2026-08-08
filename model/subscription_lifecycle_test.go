package model

import (
	"fmt"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestSubscriptionLifecyclePendingCreationEmitsDelayedEngagementEvent(t *testing.T) {
	setupSubscriptionLifecycleTestDB(t, 1)
	plan := createSubscriptionLifecyclePlan(t, "sub-life-pending")
	user := createLifecycleQuotaTestUser(t, "sub-life-pending", 0, 100)
	order := createSubscriptionLifecycleOrder(user.Id, plan.Id, "sub-life-pending-order", common.TopUpStatusPending, 1_700_101_000, 0)

	require.NoError(t, order.Insert())

	event := requireSubscriptionLifecycleEvent(t, user.Id, RecallLifecycleTriggerPaymentPending, order.TradeNo)
	require.Equal(t, order.CreateTime, event.OccurredAt)
	require.Equal(t, order.CreateTime+86400, event.AvailableAt)
	require.Contains(t, event.BusinessKey, "v1|payment_pending|subscription|trade:"+order.TradeNo)
	requireSubscriptionLifecycleEventCount(t, order.TradeNo, RecallLifecycleTriggerPaymentPending, 1)
}

func TestSubscriptionLifecycleTerminalFailureAndReplayEmitOneServiceEvent(t *testing.T) {
	for _, tc := range []struct {
		name   string
		status string
	}{
		{name: "failed", status: common.TopUpStatusFailed},
		{name: "expired", status: common.TopUpStatusExpired},
		{name: "cancelled", status: "cancelled"},
		{name: "canceled", status: "canceled"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			setupSubscriptionLifecycleTestDB(t, 1)
			plan := createSubscriptionLifecyclePlan(t, "sub-life-terminal-"+tc.name)
			user := createLifecycleQuotaTestUser(t, "sub-life-terminal-"+tc.name, 0, 100)
			order := insertSubscriptionLifecycleOrder(t, user.Id, plan.Id, "sub-life-terminal-"+tc.name, common.TopUpStatusPending, 1_700_102_000, 0)

			applied, err := transitionSubscriptionLifecycleForTest(PurchaseLifecycleTransition{
				Kind:       "subscription",
				SourceID:   int64(order.Id),
				TradeNo:    order.TradeNo,
				UserID:     user.Id,
				FromStatus: []string{common.TopUpStatusPending},
				ToStatus:   tc.status,
				OccurredAt: 1_700_102_100,
				SourceRef:  "provider." + tc.name,
			})
			require.NoError(t, err)
			require.True(t, applied)

			applied, err = transitionSubscriptionLifecycleForTest(PurchaseLifecycleTransition{
				Kind:       "subscription",
				SourceID:   int64(order.Id),
				TradeNo:    order.TradeNo,
				UserID:     user.Id,
				FromStatus: []string{common.TopUpStatusPending},
				ToStatus:   tc.status,
				OccurredAt: 1_700_102_200,
				SourceRef:  "provider." + tc.name + ".replay",
			})
			require.NoError(t, err)
			require.False(t, applied)

			stored := GetSubscriptionOrderByTradeNo(order.TradeNo)
			require.NotNil(t, stored)
			require.Equal(t, tc.status, stored.Status)
			requireSubscriptionLifecycleEventCount(t, order.TradeNo, RecallLifecycleTriggerPaymentFailed, 1)
			requireSubscriptionLifecycleEventCount(t, order.TradeNo, RecallLifecycleTriggerPaymentSucceeded, 0)
			requireSubscriptionLifecycleStateCount(t, user.Id, 0)
		})
	}
}

func TestSubscriptionLifecycleSuccessReplayCreatesEntitlementCycleAndEventOnce(t *testing.T) {
	setupSubscriptionLifecycleTestDB(t, 1)
	plan := createSubscriptionLifecyclePlan(t, "sub-life-success")
	user := createLifecycleQuotaTestUser(t, "sub-life-success", 0, 100)
	order := insertSubscriptionLifecycleOrder(t, user.Id, plan.Id, "sub-life-success-order", common.TopUpStatusPending, 1_700_103_000, 0)

	require.NoError(t, CompleteSubscriptionOrder(order.TradeNo, `{"provider":"stripe"}`, PaymentProviderStripe, PaymentMethodStripe))
	require.NoError(t, CompleteSubscriptionOrder(order.TradeNo, `{"provider":"stripe","replay":true}`, PaymentProviderStripe, PaymentMethodStripe))

	stored := GetSubscriptionOrderByTradeNo(order.TradeNo)
	require.NotNil(t, stored)
	require.Equal(t, common.TopUpStatusSuccess, stored.Status)
	requireSubscriptionLifecycleEventCount(t, order.TradeNo, RecallLifecycleTriggerPaymentSucceeded, 1)

	var subs []UserSubscription
	require.NoError(t, DB.Where("user_id = ? AND plan_id = ?", user.Id, plan.Id).Find(&subs).Error)
	require.Len(t, subs, 1)
	state := lifecycleStateForTest(t, user.Id, QuotaLifecycleScopeSubscription, fmt.Sprint(subs[0].Id))
	require.Equal(t, "subscription_order:"+order.TradeNo, state.Cycle)
	require.EqualValues(t, subs[0].AmountTotal, state.Balance)

	var topups int64
	require.NoError(t, DB.Model(&TopUp{}).Where("trade_no = ?", order.TradeNo).Count(&topups).Error)
	require.EqualValues(t, 1, topups)
}

func TestSubscriptionLifecycleCASLoserDoesNotCreateEntitlementOrEvent(t *testing.T) {
	setupSubscriptionLifecycleTestDB(t, 1)
	plan := createSubscriptionLifecyclePlan(t, "sub-life-cas-loser")
	user := createLifecycleQuotaTestUser(t, "sub-life-cas-loser", 0, 100)
	order := insertSubscriptionLifecycleOrder(t, user.Id, plan.Id, "sub-life-cas-loser-order", common.TopUpStatusPending, 1_700_103_500, 0)

	callbackName := "test:force_subscription_lifecycle_cas_loss"
	fired := false
	var callbackErr error
	require.NoError(t, DB.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if fired || tx.Statement == nil || tx.Statement.Table != "subscription_orders" {
			return
		}
		fired = true
		callbackErr = tx.Exec("UPDATE subscription_orders SET status = ?, complete_time = ? WHERE id = ?", common.TopUpStatusSuccess, int64(1_700_103_550), order.Id).Error
	}))
	defer func() {
		require.NoError(t, DB.Callback().Update().Remove(callbackName))
	}()

	require.NoError(t, CompleteSubscriptionOrder(order.TradeNo, `{"provider":"stripe"}`, PaymentProviderStripe, PaymentMethodStripe))
	require.NoError(t, callbackErr)
	require.True(t, fired)

	stored := GetSubscriptionOrderByTradeNo(order.TradeNo)
	require.NotNil(t, stored)
	require.Equal(t, common.TopUpStatusSuccess, stored.Status)
	requireSubscriptionLifecycleEventCount(t, order.TradeNo, RecallLifecycleTriggerPaymentSucceeded, 0)
	var subs int64
	require.NoError(t, DB.Model(&UserSubscription{}).Where("user_id = ? AND plan_id = ?", user.Id, plan.Id).Count(&subs).Error)
	require.Zero(t, subs)
}

func TestSubscriptionLifecycleSuccessAfterFailureIsAllowed(t *testing.T) {
	setupSubscriptionLifecycleTestDB(t, 1)
	plan := createSubscriptionLifecyclePlan(t, "sub-life-corrected")
	user := createLifecycleQuotaTestUser(t, "sub-life-corrected", 0, 100)
	order := insertSubscriptionLifecycleOrder(t, user.Id, plan.Id, "sub-life-corrected-order", common.TopUpStatusPending, 1_700_104_000, 0)

	require.NoError(t, ExpireSubscriptionOrder(order.TradeNo, PaymentProviderStripe))
	require.NoError(t, CompleteSubscriptionOrder(order.TradeNo, `{"provider":"stripe","corrected":true}`, PaymentProviderStripe, PaymentMethodStripe))

	stored := GetSubscriptionOrderByTradeNo(order.TradeNo)
	require.NotNil(t, stored)
	require.Equal(t, common.TopUpStatusSuccess, stored.Status)
	requireSubscriptionLifecycleEventCount(t, order.TradeNo, RecallLifecycleTriggerPaymentFailed, 1)
	requireSubscriptionLifecycleEventCount(t, order.TradeNo, RecallLifecycleTriggerPaymentSucceeded, 1)
}

func TestPurchaseSubscriptionWithBalanceLifecycleUsesOrderCycleWithoutWalletRotation(t *testing.T) {
	setupSubscriptionLifecycleTestDB(t, 1)
	plan := createSubscriptionLifecyclePlan(t, "sub-life-balance")
	user := createLifecycleQuotaTestUser(t, "sub-life-balance", int(100*common.QuotaPerUnit), 100)

	require.NoError(t, PurchaseSubscriptionWithBalance(user.Id, plan.Id))

	var order SubscriptionOrder
	require.NoError(t, DB.Where("user_id = ? AND payment_provider = ?", user.Id, PaymentProviderBalance).First(&order).Error)
	require.Equal(t, common.TopUpStatusSuccess, order.Status)
	requireSubscriptionLifecycleEventCount(t, order.TradeNo, RecallLifecycleTriggerPaymentPending, 0)
	requireSubscriptionLifecycleEventCount(t, order.TradeNo, RecallLifecycleTriggerPaymentSucceeded, 1)

	var sub UserSubscription
	require.NoError(t, DB.Where("user_id = ? AND plan_id = ?", user.Id, plan.Id).First(&sub).Error)
	subState := lifecycleStateForTest(t, user.Id, QuotaLifecycleScopeSubscription, fmt.Sprint(sub.Id))
	require.Equal(t, "subscription_order:"+order.TradeNo, subState.Cycle)

	walletState := lifecycleStateForTest(t, user.Id, QuotaLifecycleScopeWallet, fmt.Sprint(user.Id))
	require.Equal(t, fmt.Sprintf("baseline:wallet:%d", user.Id), walletState.Cycle)
}

func TestSubscriptionLifecycleFallbackCycleUsesOrderIDWhenTradeNumberMissing(t *testing.T) {
	setupSubscriptionLifecycleTestDB(t, 1)
	plan := createSubscriptionLifecyclePlan(t, "sub-life-fallback")
	user := createLifecycleQuotaTestUser(t, "sub-life-fallback", 0, 100)
	order := insertSubscriptionLifecycleOrder(t, user.Id, plan.Id, "", common.TopUpStatusPending, 1_700_105_000, 0)

	sub, err := createUserSubscriptionFromPlanWithCycleTx(DB, user.Id, plan, "order", 0, "")
	require.NoError(t, err)
	applied, err := transitionSubscriptionLifecycleForTest(PurchaseLifecycleTransition{
		Kind:                PurchaseLifecycleKindSubscription,
		SourceID:            int64(order.Id),
		UserID:              user.Id,
		FromStatus:          []string{common.TopUpStatusPending},
		ToStatus:            common.TopUpStatusSuccess,
		OccurredAt:          1_700_105_100,
		SubscriptionScopeID: int64(sub.Id),
		SourceRef:           "provider.source_id",
	})
	require.NoError(t, err)
	require.True(t, applied)

	state := lifecycleStateForTest(t, user.Id, QuotaLifecycleScopeSubscription, fmt.Sprint(sub.Id))
	require.Equal(t, fmt.Sprintf("subscription_orders:%d", order.Id), state.Cycle)
	event := requireSubscriptionLifecycleEventBySource(t, user.Id, RecallLifecycleTriggerPaymentSucceeded, int64(order.Id))
	require.Equal(t, fmt.Sprintf("subscription_orders:%d", order.Id), event.ScopeId)
}

func TestSubscriptionLifecycleProviderMatrixSuccessAndExpiryReplayOnce(t *testing.T) {
	successProviders := []string{
		PaymentProviderStripe,
		PaymentProviderCreem,
		PaymentProviderEpay,
		PaymentProviderWaffoPancake,
	}
	for _, provider := range successProviders {
		t.Run("success_"+provider, func(t *testing.T) {
			setupSubscriptionLifecycleTestDB(t, 1)
			plan := createSubscriptionLifecyclePlan(t, "sub-life-provider-"+provider)
			user := createLifecycleQuotaTestUser(t, "sub-life-provider-"+provider, 0, 100)
			order := insertSubscriptionLifecycleOrder(t, user.Id, plan.Id, "sub-life-provider-"+provider, common.TopUpStatusPending, 1_700_106_000, 0)
			require.NoError(t, DB.Model(order).Update("payment_provider", provider).Error)
			require.NoError(t, DB.Model(order).Update("payment_method", provider).Error)

			require.NoError(t, CompleteSubscriptionOrder(order.TradeNo, `{"provider":"`+provider+`"}`, provider, provider))
			require.NoError(t, CompleteSubscriptionOrder(order.TradeNo, `{"provider":"`+provider+`","replay":true}`, provider, provider))

			requireSubscriptionLifecycleEventCount(t, order.TradeNo, RecallLifecycleTriggerPaymentSucceeded, 1)
			var subs []UserSubscription
			require.NoError(t, DB.Where("user_id = ? AND plan_id = ?", user.Id, plan.Id).Find(&subs).Error)
			require.Len(t, subs, 1)
			state := lifecycleStateForTest(t, user.Id, QuotaLifecycleScopeSubscription, fmt.Sprint(subs[0].Id))
			require.Equal(t, "subscription_order:"+order.TradeNo, state.Cycle)
		})
	}

	expiryProviders := []string{
		PaymentProviderStripe,
		PaymentProviderCreem,
	}
	for _, provider := range expiryProviders {
		t.Run("expiry_"+provider, func(t *testing.T) {
			setupSubscriptionLifecycleTestDB(t, 1)
			plan := createSubscriptionLifecyclePlan(t, "sub-life-expiry-"+provider)
			user := createLifecycleQuotaTestUser(t, "sub-life-expiry-"+provider, 0, 100)
			order := insertSubscriptionLifecycleOrder(t, user.Id, plan.Id, "sub-life-expiry-"+provider, common.TopUpStatusPending, 1_700_107_000, 0)
			require.NoError(t, DB.Model(order).Update("payment_provider", provider).Error)

			require.NoError(t, ExpireSubscriptionOrder(order.TradeNo, provider))
			require.NoError(t, ExpireSubscriptionOrder(order.TradeNo, provider))

			requireSubscriptionLifecycleEventCount(t, order.TradeNo, RecallLifecycleTriggerPaymentFailed, 1)
			requireSubscriptionLifecycleStateCount(t, user.Id, 0)
		})
	}
}

func setupSubscriptionLifecycleTestDB(t *testing.T, maxOpenConns int) {
	t.Helper()
	setupLifecycleQuotaMutationTestDB(t, maxOpenConns)
	require.NoError(t, DB.AutoMigrate(&SubscriptionOrder{}, &TopUp{}, &Log{}, &InviteSubscriptionReward{}, &SubscriptionDiscountAccount{}, &SubscriptionDiscountEntry{}, &PaymentAnalyticsOutbox{}, &PaymentAnalyticsEventReceipt{}))
}

func createSubscriptionLifecyclePlan(t *testing.T, title string) *SubscriptionPlan {
	t.Helper()
	plan := &SubscriptionPlan{
		Title:         title,
		PriceAmount:   10,
		Currency:      "USD",
		DurationUnit:  "month",
		DurationValue: 1,
		Enabled:       true,
		TotalAmount:   int64(45 * common.QuotaPerUnit),
	}
	require.NoError(t, DB.Create(plan).Error)
	return plan
}

func createSubscriptionLifecycleOrder(userID int, planID int, tradeNo string, status string, createTime int64, completeTime int64) *SubscriptionOrder {
	return &SubscriptionOrder{
		UserId:          userID,
		PlanId:          planID,
		Money:           10,
		TradeNo:         tradeNo,
		PaymentMethod:   PaymentMethodStripe,
		PaymentProvider: PaymentProviderStripe,
		Status:          status,
		CreateTime:      createTime,
		CompleteTime:    completeTime,
	}
}

func insertSubscriptionLifecycleOrder(t *testing.T, userID int, planID int, tradeNo string, status string, createTime int64, completeTime int64) *SubscriptionOrder {
	t.Helper()
	order := createSubscriptionLifecycleOrder(userID, planID, tradeNo, status, createTime, completeTime)
	require.NoError(t, DB.Create(order).Error)
	return order
}

func transitionSubscriptionLifecycleForTest(transition PurchaseLifecycleTransition) (bool, error) {
	var applied bool
	err := DB.Transaction(func(tx *gorm.DB) error {
		var err error
		applied, err = PersistPurchaseLifecycleTransition(tx, transition)
		return err
	})
	return applied, err
}

func requireSubscriptionLifecycleEvent(t *testing.T, userID int, eventType string, tradeNo string) RecallLifecycleEvent {
	t.Helper()
	var event RecallLifecycleEvent
	require.NoError(t, DB.Where("user_id = ? AND event_type = ? AND business_key = ?", userID, eventType, fmt.Sprintf("v1|%s|subscription|trade:%s", eventType, tradeNo)).First(&event).Error)
	require.Equal(t, "subscription", event.ScopeType)
	require.Equal(t, tradeNo, event.ScopeId)
	require.Equal(t, RecallLifecycleEventPending, event.Disposition)
	var payload map[string]any
	require.NoError(t, common.Unmarshal([]byte(event.EventData), &payload))
	require.Equal(t, "subscription", payload["purchase_kind"])
	return event
}

func requireSubscriptionLifecycleEventBySource(t *testing.T, userID int, eventType string, sourceID int64) RecallLifecycleEvent {
	t.Helper()
	var event RecallLifecycleEvent
	require.NoError(t, DB.Where("user_id = ? AND event_type = ? AND business_key = ?", userID, eventType, fmt.Sprintf("v1|%s|subscription|source:subscription_orders:%d", eventType, sourceID)).First(&event).Error)
	require.Equal(t, "subscription", event.ScopeType)
	return event
}

func requireSubscriptionLifecycleEventCount(t *testing.T, tradeNo string, eventType string, want int64) {
	t.Helper()
	var count int64
	query := DB.Model(&RecallLifecycleEvent{}).Where("event_type = ?", eventType)
	if strings.TrimSpace(tradeNo) != "" {
		query = query.Where("business_key = ?", fmt.Sprintf("v1|%s|subscription|trade:%s", eventType, tradeNo))
	}
	require.NoError(t, query.Count(&count).Error)
	require.Equal(t, want, count)
}

func requireSubscriptionLifecycleStateCount(t *testing.T, userID int, want int64) {
	t.Helper()
	var count int64
	require.NoError(t, DB.Model(&QuotaLifecycleState{}).Where("user_id = ? AND scope_type = ?", userID, QuotaLifecycleScopeSubscription).Count(&count).Error)
	require.Equal(t, want, count)
}
