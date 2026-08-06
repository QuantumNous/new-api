package model

import (
	"errors"
	"path/filepath"
	"strings"
	"testing"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupPaymentAnalyticsOutboxTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	originalDB := DB
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "payment-analytics.db")+"?_pragma=busy_timeout(5000)"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&PaymentAnalyticsOutbox{}, &PaymentAnalyticsEventReceipt{}))
	DB = db
	t.Cleanup(func() {
		DB = originalDB
		sqlDB, _ := db.DB()
		if sqlDB != nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func paymentAnalyticsTestEvent() *PaymentAnalyticsEvent {
	return &PaymentAnalyticsEvent{
		EventID: "flatkey:ga4:purchase:topup:order-1", TransactionID: "order-1", UserID: 7,
		Value: 10, Currency: "usd", PaymentProvider: PaymentProviderStripe, PaymentMethod: PaymentMethodStripe,
		ProductType: "top_up", ItemID: "wallet_top_up", ItemName: "Wallet top-up", ClientID: "123.456", SessionID: "789", OccurredAt: 1_800_000_000,
	}
}

func TestPaymentAnalyticsOutboxEnqueueIsIdempotentAndClaimsExclusively(t *testing.T) {
	db := setupPaymentAnalyticsOutboxTestDB(t)
	EnqueuePaymentAnalyticsBestEffort(paymentAnalyticsTestEvent())
	EnqueuePaymentAnalyticsBestEffort(paymentAnalyticsTestEvent())
	var count int64
	require.NoError(t, db.Model(&PaymentAnalyticsOutbox{}).Count(&count).Error)
	require.EqualValues(t, 1, count)

	const now = int64(1_800_000_100)
	claimed, err := ClaimPaymentAnalyticsOutbox(1, now)
	require.NoError(t, err)
	require.Len(t, claimed, 1)
	second, err := ClaimPaymentAnalyticsOutbox(1, now)
	require.NoError(t, err)
	require.Empty(t, second)

	recovered, err := ClaimPaymentAnalyticsOutbox(1, now+10*60+1)
	require.NoError(t, err)
	require.Len(t, recovered, 1)
	require.Equal(t, 2, recovered[0].Attempts)
}

func TestPaymentAnalyticsOutboxRejectsStaleWorkerCompletion(t *testing.T) {
	setupPaymentAnalyticsOutboxTestDB(t)
	EnqueuePaymentAnalyticsBestEffort(paymentAnalyticsTestEvent())
	const firstClaimAt = int64(1_800_000_100)
	first, err := ClaimPaymentAnalyticsOutbox(1, firstClaimAt)
	require.NoError(t, err)
	require.Len(t, first, 1)
	second, err := ClaimPaymentAnalyticsOutbox(1, firstClaimAt+10*60+1)
	require.NoError(t, err)
	require.Len(t, second, 1)

	require.ErrorIs(t, CompletePaymentAnalyticsOutbox(first[0].Id, first[0].ClaimedAt, firstClaimAt+10*60+2), ErrPaymentAnalyticsOutboxLeaseLost)
	var outbox PaymentAnalyticsOutbox
	require.NoError(t, DB.First(&outbox, first[0].Id).Error)
	require.Equal(t, PaymentAnalyticsOutboxDelivering, outbox.Status)
	require.Equal(t, second[0].ClaimedAt, outbox.ClaimedAt)
}

func TestPaymentAnalyticsOutboxRetryAndDeadErrorHandling(t *testing.T) {
	setupPaymentAnalyticsOutboxTestDB(t)
	EnqueuePaymentAnalyticsBestEffort(paymentAnalyticsTestEvent())
	claimed, err := ClaimPaymentAnalyticsOutbox(1, 1_800_000_100)
	require.NoError(t, err)
	require.Len(t, claimed, 1)
	require.NoError(t, FailPaymentAnalyticsOutbox(claimed[0].Id, claimed[0].ClaimedAt, claimed[0].Attempts, "too many requests", 1_800_000_101))

	claimed, err = ClaimPaymentAnalyticsOutbox(1, 1_800_000_200)
	require.NoError(t, err)
	require.Len(t, claimed, 1)
	require.NoError(t, DeadPaymentAnalyticsOutbox(claimed[0].Id, claimed[0].ClaimedAt, strings.Repeat("界", 300), 1_800_000_201))

	var outbox PaymentAnalyticsOutbox
	require.NoError(t, DB.First(&outbox, claimed[0].Id).Error)
	require.Equal(t, PaymentAnalyticsOutboxDead, outbox.Status)
	require.LessOrEqual(t, len(outbox.LastError), 512)
	require.True(t, utf8.ValidString(outbox.LastError))
}

func TestPaymentAnalyticsOutboxCleanupRetainsDeadRows(t *testing.T) {
	setupPaymentAnalyticsOutboxTestDB(t)
	now := int64(1_800_000_000)
	require.NoError(t, DB.Create(&PaymentAnalyticsOutbox{EventId: "delivered-old", Status: PaymentAnalyticsOutboxDelivered, DeliveredAt: now - paymentAnalyticsOutboxDeliveredRetention - 1}).Error)
	require.NoError(t, DB.Create(&PaymentAnalyticsOutbox{EventId: "dead-old", Status: PaymentAnalyticsOutboxDead, DeliveredAt: now - paymentAnalyticsOutboxDeliveredRetention - 1}).Error)
	require.NoError(t, DeleteDeliveredPaymentAnalyticsOutboxBefore(now))

	var count int64
	require.NoError(t, DB.Model(&PaymentAnalyticsOutbox{}).Where("event_id = ?", "delivered-old").Count(&count).Error)
	require.Zero(t, count)
	require.NoError(t, DB.Model(&PaymentAnalyticsOutbox{}).Where("event_id = ?", "dead-old").Count(&count).Error)
	require.EqualValues(t, 1, count)
}

func TestPaymentAnalyticsOutboxCleanupRetainsReplayDeduplication(t *testing.T) {
	db := setupPaymentAnalyticsOutboxTestDB(t)
	event := paymentAnalyticsTestEvent()
	EnqueuePaymentAnalyticsBestEffort(event)
	claimed, err := ClaimPaymentAnalyticsOutbox(1, 1_800_000_100)
	require.NoError(t, err)
	require.Len(t, claimed, 1)
	require.NoError(t, CompletePaymentAnalyticsOutbox(claimed[0].Id, claimed[0].ClaimedAt, 1_800_000_101))
	require.NoError(t, DeleteDeliveredPaymentAnalyticsOutboxBefore(1_800_000_101+paymentAnalyticsOutboxDeliveredRetention+1))

	EnqueuePaymentAnalyticsBestEffort(event)
	var outboxCount, receiptCount int64
	require.NoError(t, db.Model(&PaymentAnalyticsOutbox{}).Count(&outboxCount).Error)
	require.NoError(t, db.Model(&PaymentAnalyticsEventReceipt{}).Where("event_id = ?", event.EventID).Count(&receiptCount).Error)
	require.Zero(t, outboxCount)
	require.EqualValues(t, 1, receiptCount)
}

func TestPaymentAnalyticsOutboxSuppressesRecallAttributedSubscription(t *testing.T) {
	event := paymentAnalyticsEventFromSubscriptionOrder(&SubscriptionOrder{
		TradeNo: "recall-subscription", UserId: 7, PlanId: 3, Money: 12,
		PaymentProvider: PaymentProviderStripe, PaymentMethod: PaymentMethodStripe, PaymentCurrency: "USD",
		DiscountKind: "recall", RecallCampaignId: 11, RecallRecipientId: 12,
	}, "Pro")
	require.Nil(t, event)
}

func TestPaymentAnalyticsOutboxUsesUSDFallbackForHistoricalEpay(t *testing.T) {
	event := paymentAnalyticsEventFromTopUp(&TopUp{
		TradeNo: "historical-epay", UserId: 7, Money: 12, PaymentProvider: PaymentProviderEpay,
		PaymentMethod: "alipay", GAClientID: "123.456", GASessionID: "789",
	})
	require.NotNil(t, event)
	require.Equal(t, "USD", event.Currency)
}

func TestPaymentAnalyticsOutboxBuildsSubscriptionRenewal(t *testing.T) {
	event := PaymentAnalyticsEventForSubscriptionRenewal(&SubscriptionOrder{
		UserId: 7, PlanId: 3, Money: 12, PaymentProvider: PaymentProviderStripe,
		PaymentMethod: PaymentMethodStripe, GAClientID: "123.456", GASessionID: "789",
	}, "Pro", "in_renewal", 12.34, "USD", 1_800_000_000)
	require.NotNil(t, event)
	require.Equal(t, "flatkey:ga4:purchase:subscription_renewal:in_renewal", event.EventID)
	require.Equal(t, "subscription_renewal", event.ProductType)
	require.Equal(t, "in_renewal", event.TransactionID)
}

func TestRechargeSucceedsWhenPaymentAnalyticsEnqueueIsUnavailable(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&PaymentAnalyticsOutbox{}, &PaymentAnalyticsEventReceipt{}))
	insertUserForPaymentGuardTest(t, 9123, 0)
	topup := &TopUp{
		UserId: 9123, Amount: 2, Money: 9.99, PaymentCurrency: "USD", TradeNo: "analytics-unavailable",
		PaymentMethod: PaymentMethodStripe, PaymentProvider: PaymentProviderStripe, GAClientID: "123.456", GASessionID: "789",
		Status: common.TopUpStatusPending, CreateTime: common.GetTimestamp(),
	}
	require.NoError(t, topup.Insert())

	original := paymentAnalyticsOutboxCreate
	paymentAnalyticsOutboxCreate = func(*PaymentAnalyticsOutbox) error {
		return errors.New("outbox unavailable")
	}

	credited, err := Recharge("analytics-unavailable", "cus_analytics", "127.0.0.1")
	require.NoError(t, err)
	require.True(t, credited)
	require.Equal(t, common.TopUpStatusSuccess, getTopUpStatusForPaymentGuardTest(t, "analytics-unavailable"))
	require.Equal(t, int(2*common.QuotaPerUnit), getUserQuotaForPaymentGuardTest(t, 9123))

	paymentAnalyticsOutboxCreate = original
	t.Cleanup(func() { paymentAnalyticsOutboxCreate = original })
	replayed, err := Recharge("analytics-unavailable", "cus_analytics", "127.0.0.1")
	require.NoError(t, err)
	require.False(t, replayed)
	var count int64
	require.NoError(t, DB.Model(&PaymentAnalyticsOutbox{}).Where("event_id = ?", "flatkey:ga4:purchase:topup:analytics-unavailable").Count(&count).Error)
	require.EqualValues(t, 1, count)
}
