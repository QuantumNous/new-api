package model

import (
	"errors"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupSubscriptionRecurringTestDB(t *testing.T) {
	t.Helper()

	originalDB := DB
	originalLogDB := LOG_DB
	originalUsingSQLite := common.UsingSQLite
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalUsingMySQL := common.UsingMySQL

	dbName := strings.NewReplacer("/", "_", " ", "_").Replace(t.Name())
	db, err := gorm.Open(sqlite.Open("file:"+dbName+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)

	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(5)

	DB = db
	LOG_DB = db
	common.UsingSQLite = true
	common.UsingPostgreSQL = false
	common.UsingMySQL = false
	initCol()

	t.Cleanup(func() {
		DB = originalDB
		LOG_DB = originalLogDB
		common.UsingSQLite = originalUsingSQLite
		common.UsingPostgreSQL = originalUsingPostgreSQL
		common.UsingMySQL = originalUsingMySQL
		initCol()
		require.NoError(t, sqlDB.Close())
	})
}

func migrateSubscriptionRecurringTestDB(t *testing.T) {
	t.Helper()
	require.NoError(t, DB.AutoMigrate(
		&User{},
		&Log{},
		&TopUp{},
		&SubscriptionPlan{},
		&SubscriptionOrder{},
		&UserSubscription{},
		&SubscriptionProviderBinding{},
		&PaymentWebhookEvent{},
	))
}

func insertUserForSubscriptionRecurringTest(t *testing.T, id int) {
	t.Helper()
	require.NoError(t, DB.Create(&User{
		Id:       id,
		Username: "recurring_user_" + strconv.Itoa(id),
		Status:   common.UserStatusEnabled,
		AffCode:  "recurring_aff_" + strconv.Itoa(id),
	}).Error)
}

func insertPlanForSubscriptionRecurringTest(t *testing.T, id int, stripePriceID string) {
	t.Helper()
	require.NoError(t, DB.Create(&SubscriptionPlan{
		Id:            id,
		Title:         "Recurring Plan",
		PriceAmount:   9.99,
		Currency:      "USD",
		DurationUnit:  SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		TotalAmount:   1000,
		StripePriceId: stripePriceID,
	}).Error)
}

func insertOrderForSubscriptionRecurringTest(t *testing.T, tradeNo string, userID int, planID int) {
	t.Helper()
	require.NoError(t, DB.Create(&SubscriptionOrder{
		UserId:          userID,
		PlanId:          planID,
		Money:           9.99,
		TradeNo:         tradeNo,
		PaymentMethod:   PaymentMethodStripe,
		PaymentProvider: PaymentProviderStripe,
		Status:          common.TopUpStatusPending,
		CreateTime:      time.Now().Unix(),
	}).Error)
}

func stripeSnapshotForSubscriptionRecurringTest(subscriptionID string) ProviderSubscriptionSnapshot {
	return ProviderSubscriptionSnapshot{
		ProviderSubscriptionId:  subscriptionID,
		ProviderCustomerId:      "cus_recurring",
		ProviderPriceId:         "price_recurring",
		ProviderLatestInvoiceId: "in_recurring",
		ProviderStatus:          "active",
		CurrentPeriodStart:      1000,
		CurrentPeriodEnd:        2000,
		Livemode:                false,
	}
}

func TestSubscriptionProviderBindingMigrationCreatesRecurringTablesAndColumn(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)

	require.NoError(t, migrateDBFast())

	require.True(t, DB.Migrator().HasTable(&SubscriptionProviderBinding{}))
	require.True(t, DB.Migrator().HasTable(&PaymentWebhookEvent{}))
	require.True(t, DB.Migrator().HasColumn(&UserSubscription{}, "provider_binding_id"))
	require.True(t, DB.Migrator().HasColumn(&PaymentWebhookEvent{}, "processing_token"))
	require.True(t, DB.Migrator().HasColumn(&PaymentWebhookEvent{}, "processing_until"))
}

func TestCompleteSubscriptionOrderWithProviderBindingIsIdempotentForSameOrder(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)
	migrateSubscriptionRecurringTestDB(t)
	insertUserForSubscriptionRecurringTest(t, 501)
	insertPlanForSubscriptionRecurringTest(t, 601, "price_recurring")
	insertOrderForSubscriptionRecurringTest(t, "recurring-order-1", 501, 601)

	snapshot := stripeSnapshotForSubscriptionRecurringTest("sub_same_order")
	binding, err := CompleteSubscriptionOrderWithProviderBinding("recurring-order-1", "{}", PaymentProviderStripe, PaymentMethodStripe, snapshot)
	require.NoError(t, err)
	require.NotZero(t, binding.Id)

	replayed, err := CompleteSubscriptionOrderWithProviderBinding("recurring-order-1", "{}", PaymentProviderStripe, PaymentMethodStripe, snapshot)
	require.NoError(t, err)
	require.Equal(t, binding.Id, replayed.Id)

	var bindingCount int64
	require.NoError(t, DB.Model(&SubscriptionProviderBinding{}).Count(&bindingCount).Error)
	require.EqualValues(t, 1, bindingCount)

	var subCount int64
	require.NoError(t, DB.Model(&UserSubscription{}).Where("provider_binding_id = ?", binding.Id).Count(&subCount).Error)
	require.EqualValues(t, 1, subCount)
}

func TestSubscriptionProviderBindingRejectsSameProviderSubscriptionForDifferentOrder(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)
	migrateSubscriptionRecurringTestDB(t)
	insertUserForSubscriptionRecurringTest(t, 502)
	insertUserForSubscriptionRecurringTest(t, 503)
	insertPlanForSubscriptionRecurringTest(t, 602, "price_recurring")
	insertOrderForSubscriptionRecurringTest(t, "recurring-order-owner", 502, 602)
	insertOrderForSubscriptionRecurringTest(t, "recurring-order-foreign", 503, 602)

	snapshot := stripeSnapshotForSubscriptionRecurringTest("sub_already_bound")
	_, err := CompleteSubscriptionOrderWithProviderBinding("recurring-order-owner", "{}", PaymentProviderStripe, PaymentMethodStripe, snapshot)
	require.NoError(t, err)

	_, err = CompleteSubscriptionOrderWithProviderBinding("recurring-order-foreign", "{}", PaymentProviderStripe, PaymentMethodStripe, snapshot)
	require.ErrorIs(t, err, ErrSubscriptionProviderBindingConflict)

	var foreignOrder SubscriptionOrder
	require.NoError(t, DB.Where("trade_no = ?", "recurring-order-foreign").First(&foreignOrder).Error)
	require.Equal(t, common.TopUpStatusPending, foreignOrder.Status)
}

func TestPaymentWebhookEventProcessingRecordsDuplicateOnlyOnce(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)
	migrateSubscriptionRecurringTestDB(t)

	first, err := RecordPaymentWebhookEventProcessing(PaymentProviderStripe, "evt_1", "customer.subscription.updated", "sub_1", 123, "hash-a")
	require.NoError(t, err)
	require.True(t, first)

	second, err := RecordPaymentWebhookEventProcessing(PaymentProviderStripe, "evt_1", "customer.subscription.updated", "sub_1", 123, "hash-a")
	require.NoError(t, err)
	require.False(t, second)

	var count int64
	require.NoError(t, DB.Model(&PaymentWebhookEvent{}).Where("provider = ? AND event_id = ?", PaymentProviderStripe, "evt_1").Count(&count).Error)
	require.EqualValues(t, 1, count)
}

func TestPaymentWebhookEventFailedRetryClaimRequiresConditionalUpdate(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)
	migrateSubscriptionRecurringTestDB(t)
	require.NoError(t, DB.Create(&PaymentWebhookEvent{
		Provider:         PaymentProviderStripe,
		EventId:          "evt_failed_retry",
		EventType:        "customer.subscription.updated",
		ProviderObjectId: "sub_retry",
		EventCreated:     123,
		Status:           PaymentWebhookEventStatusFailed,
		AttemptCount:     1,
		PayloadHash:      "hash-a",
		LastError:        "first failure",
	}).Error)
	var staleFailed PaymentWebhookEvent
	require.NoError(t, DB.Where("provider = ? AND event_id = ?", PaymentProviderStripe, "evt_failed_retry").First(&staleFailed).Error)

	firstResult := DB.Model(&PaymentWebhookEvent{}).
		Where("provider = ? AND event_id = ? AND status = ?", staleFailed.Provider, staleFailed.EventId, PaymentWebhookEventStatusFailed).
		Updates(map[string]interface{}{
			"status":        PaymentWebhookEventStatusProcessing,
			"attempt_count": staleFailed.AttemptCount + 1,
			"last_error":    "",
		})
	require.NoError(t, firstResult.Error)
	require.EqualValues(t, 1, firstResult.RowsAffected)
	secondClaimed, err := claimFailedPaymentWebhookEventForRetry(staleFailed, "customer.subscription.updated", "sub_retry", 123, "hash-b")

	require.NoError(t, err)
	require.False(t, secondClaimed)
}

func TestPaymentWebhookEventLeaseClaimIsSingleOwnerAndTakeoverSafe(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)
	migrateSubscriptionRecurringTestDB(t)
	now := common.GetTimestamp()

	claimed, err := ClaimPaymentWebhookEventLease(PaymentProviderStripe, "evt_lease_single", "invoice.paid", "in_lease", now, "hash-a", "worker-a", now+60)
	require.NoError(t, err)
	require.True(t, claimed)
	second, err := ClaimPaymentWebhookEventLease(PaymentProviderStripe, "evt_lease_single", "invoice.paid", "in_lease", now, "hash-a", "worker-b", now+60)
	require.NoError(t, err)
	require.False(t, second)

	var event PaymentWebhookEvent
	require.NoError(t, DB.First(&event, "provider = ? AND event_id = ?", PaymentProviderStripe, "evt_lease_single").Error)
	require.Equal(t, "worker-a", event.ProcessingToken)
	require.Equal(t, now+60, event.ProcessingUntil)
	require.Equal(t, 1, event.AttemptCount)

	require.NoError(t, DB.Create(&PaymentWebhookEvent{
		Provider:         PaymentProviderStripe,
		EventId:          "evt_lease_expired",
		EventType:        "invoice.paid",
		ProviderObjectId: "in_expired",
		Status:           PaymentWebhookEventStatusProcessing,
		ProcessingToken:  "stale-worker",
		ProcessingUntil:  now - 1,
		AttemptCount:     1,
	}).Error)
	taken, err := ClaimPaymentWebhookEventLease(PaymentProviderStripe, "evt_lease_expired", "invoice.paid", "in_expired", now, "hash-b", "worker-fresh", now+120)
	require.NoError(t, err)
	require.True(t, taken)
	event = PaymentWebhookEvent{}
	require.NoError(t, DB.First(&event, "provider = ? AND event_id = ?", PaymentProviderStripe, "evt_lease_expired").Error)
	require.Equal(t, "worker-fresh", event.ProcessingToken)
	require.Equal(t, now+120, event.ProcessingUntil)
	require.Equal(t, 2, event.AttemptCount)

	require.NoError(t, DB.Create(&PaymentWebhookEvent{
		Provider:         PaymentProviderStripe,
		EventId:          "evt_lease_processed",
		EventType:        "invoice.paid",
		ProviderObjectId: "in_processed",
		Status:           PaymentWebhookEventStatusProcessed,
		ProcessedAt:      now,
	}).Error)
	processed, err := ClaimPaymentWebhookEventLease(PaymentProviderStripe, "evt_lease_processed", "invoice.paid", "in_processed", now, "hash-c", "worker-c", now+60)
	require.NoError(t, err)
	require.False(t, processed)
}

func TestPaymentWebhookEventFailedByTokenReleasesOnlyOwnedLease(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)
	migrateSubscriptionRecurringTestDB(t)
	now := common.GetTimestamp()

	claimed, err := ClaimPaymentWebhookEventLease(PaymentProviderStripe, "evt_failed_release", "invoice.paid", "in_failed_release", now, "hash-a", "worker-a", now+60)
	require.NoError(t, err)
	require.True(t, claimed)
	require.NoError(t, MarkPaymentWebhookEventFailedByToken(PaymentProviderStripe, "evt_failed_release", "worker-a", errors.New("retryable failure")))

	reclaimed, err := ClaimPaymentWebhookEventLease(PaymentProviderStripe, "evt_failed_release", "invoice.paid", "in_failed_release", now, "hash-b", "worker-b", now+120)
	require.NoError(t, err)
	require.True(t, reclaimed)
	require.NoError(t, MarkPaymentWebhookEventFailedByToken(PaymentProviderStripe, "evt_failed_release", "worker-a", errors.New("stale failure")))

	var event PaymentWebhookEvent
	require.NoError(t, DB.First(&event, "provider = ? AND event_id = ?", PaymentProviderStripe, "evt_failed_release").Error)
	require.Equal(t, PaymentWebhookEventStatusProcessing, event.Status)
	require.Equal(t, "worker-b", event.ProcessingToken)
	require.Equal(t, now+120, event.ProcessingUntil)
}

func TestSubscriptionProviderBindingAllowsMultipleStripeSubscriptionsForSameUser(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)
	migrateSubscriptionRecurringTestDB(t)
	insertUserForSubscriptionRecurringTest(t, 504)
	insertPlanForSubscriptionRecurringTest(t, 604, "price_recurring")
	insertOrderForSubscriptionRecurringTest(t, "recurring-order-a", 504, 604)
	insertOrderForSubscriptionRecurringTest(t, "recurring-order-b", 504, 604)

	first, err := CompleteSubscriptionOrderWithProviderBinding("recurring-order-a", "{}", PaymentProviderStripe, PaymentMethodStripe, stripeSnapshotForSubscriptionRecurringTest("sub_a"))
	require.NoError(t, err)
	second, err := CompleteSubscriptionOrderWithProviderBinding("recurring-order-b", "{}", PaymentProviderStripe, PaymentMethodStripe, stripeSnapshotForSubscriptionRecurringTest("sub_b"))
	require.NoError(t, err)

	require.NotEqual(t, first.Id, second.Id)

	var count int64
	require.NoError(t, DB.Model(&SubscriptionProviderBinding{}).Where("user_id = ? AND provider = ?", 504, PaymentProviderStripe).Count(&count).Error)
	require.EqualValues(t, 2, count)
}

func TestProviderSubscriptionSnapshotClearsScheduleWhenAuthoritativeStripeObjectHasNone(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)
	migrateSubscriptionRecurringTestDB(t)
	insertUserForSubscriptionRecurringTest(t, 505)
	insertPlanForSubscriptionRecurringTest(t, 605, "price_recurring")
	insertOrderForSubscriptionRecurringTest(t, "recurring-order-schedule-clear", 505, 605)

	binding, err := CompleteSubscriptionOrderWithProviderBinding(
		"recurring-order-schedule-clear",
		"{}",
		PaymentProviderStripe,
		PaymentMethodStripe,
		ProviderSubscriptionSnapshot{
			ProviderSubscriptionId:     "sub_schedule_clear",
			ProviderSubscriptionItemId: "si_schedule_clear",
			ProviderScheduleId:         "sub_sched_stale",
			ProviderScheduleIdObserved: true,
			ProviderCustomerId:         "cus_schedule_clear",
			ProviderPriceId:            "price_recurring",
			ProviderStatus:             "active",
		},
	)
	require.NoError(t, err)
	require.Equal(t, "sub_sched_stale", binding.ProviderScheduleId)

	updated, err := ApplyProviderSubscriptionSnapshot(binding.Id, ProviderSubscriptionSnapshot{
		ProviderSubscriptionId:     "sub_schedule_clear",
		ProviderSubscriptionItemId: "si_schedule_clear",
		ProviderScheduleId:         "",
		ProviderScheduleIdObserved: true,
		ProviderCustomerId:         "cus_schedule_clear",
		ProviderPriceId:            "price_recurring",
		ProviderStatus:             "active",
	})
	require.NoError(t, err)
	require.Empty(t, updated.ProviderScheduleId)
}

func TestProviderSubscriptionSnapshotOmittedSchedulePreservesExistingBindingValue(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)
	migrateSubscriptionRecurringTestDB(t)
	insertUserForSubscriptionRecurringTest(t, 506)
	insertPlanForSubscriptionRecurringTest(t, 606, "price_recurring")
	insertOrderForSubscriptionRecurringTest(t, "recurring-order-schedule-preserve", 506, 606)

	binding, err := CompleteSubscriptionOrderWithProviderBinding(
		"recurring-order-schedule-preserve",
		"{}",
		PaymentProviderStripe,
		PaymentMethodStripe,
		ProviderSubscriptionSnapshot{
			ProviderSubscriptionId:     "sub_schedule_preserve",
			ProviderSubscriptionItemId: "si_schedule_preserve",
			ProviderScheduleId:         "sub_sched_existing",
			ProviderScheduleIdObserved: true,
			ProviderCustomerId:         "cus_schedule_preserve",
			ProviderPriceId:            "price_recurring",
			ProviderStatus:             "active",
		},
	)
	require.NoError(t, err)
	require.Equal(t, "sub_sched_existing", binding.ProviderScheduleId)

	updated, err := ApplyProviderSubscriptionSnapshot(binding.Id, ProviderSubscriptionSnapshot{
		ProviderSubscriptionId:     "sub_schedule_preserve",
		ProviderSubscriptionItemId: "si_schedule_preserve_updated",
		ProviderCustomerId:         "cus_schedule_preserve",
		ProviderPriceId:            "price_recurring",
		ProviderStatus:             "active",
	})
	require.NoError(t, err)
	require.Equal(t, "sub_sched_existing", updated.ProviderScheduleId)
	require.Equal(t, "si_schedule_preserve_updated", updated.ProviderSubscriptionItemId)
}

func TestApplyProviderSubscriptionSnapshotDoesNotReviveTerminalBinding(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)
	migrateSubscriptionRecurringTestDB(t)
	insertUserForSubscriptionRecurringTest(t, 507)
	insertPlanForSubscriptionRecurringTest(t, 607, "price_recurring")
	insertOrderForSubscriptionRecurringTest(t, "recurring-order-terminal", 507, 607)

	binding, err := CompleteSubscriptionOrderWithProviderBinding(
		"recurring-order-terminal",
		"{}",
		PaymentProviderStripe,
		PaymentMethodStripe,
		stripeSnapshotForSubscriptionRecurringTest("sub_terminal"),
	)
	require.NoError(t, err)

	terminated, err := ApplyProviderSubscriptionTermination(binding.Id, ProviderSubscriptionSnapshot{
		ProviderSubscriptionId:  "sub_terminal",
		ProviderCustomerId:      "cus_recurring",
		ProviderPriceId:         "price_recurring",
		ProviderLatestInvoiceId: "in_terminal",
		ProviderStatus:          "canceled",
		CurrentPeriodStart:      1000,
		CurrentPeriodEnd:        2000,
		CanceledAt:              1500,
		EndedAt:                 1500,
	})
	require.NoError(t, err)

	updated, err := ApplyProviderSubscriptionSnapshot(binding.Id, ProviderSubscriptionSnapshot{
		ProviderSubscriptionId:  "sub_terminal",
		ProviderCustomerId:      "cus_stale_update",
		ProviderPriceId:         "price_stale_update",
		ProviderLatestInvoiceId: "in_stale_update",
		ProviderStatus:          "active",
		CurrentPeriodStart:      2000,
		CurrentPeriodEnd:        3000,
	})
	require.NoError(t, err)
	require.Equal(t, terminated.ProviderStatus, updated.ProviderStatus)
	require.Equal(t, terminated.EndedAt, updated.EndedAt)
	require.Equal(t, terminated.CanceledAt, updated.CanceledAt)
	require.Equal(t, terminated.ProviderCustomerId, updated.ProviderCustomerId)
	require.Equal(t, terminated.ProviderPriceId, updated.ProviderPriceId)
	require.Equal(t, terminated.ProviderLatestInvoiceId, updated.ProviderLatestInvoiceId)
	require.Equal(t, terminated.CurrentPeriodStart, updated.CurrentPeriodStart)
	require.Equal(t, terminated.CurrentPeriodEnd, updated.CurrentPeriodEnd)
}

func TestCompleteSubscriptionOrderWithProviderBindingReturnsNotFoundForUnknownOrder(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)
	migrateSubscriptionRecurringTestDB(t)

	_, err := CompleteSubscriptionOrderWithProviderBinding("missing-order", "{}", PaymentProviderStripe, PaymentMethodStripe, stripeSnapshotForSubscriptionRecurringTest("sub_missing"))
	require.True(t, errors.Is(err, ErrSubscriptionOrderNotFound))
}
