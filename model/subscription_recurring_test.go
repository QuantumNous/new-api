package model

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestProviderSubscriptionTerminationUsesStrictDBTimestamp(t *testing.T) {
	raw, err := os.ReadFile("subscription_recurring.go")
	require.NoError(t, err)
	source := string(raw)
	start := strings.Index(source, "func applyProviderSubscriptionTermination(")
	require.NotEqual(t, -1, start)
	end := strings.Index(source[start:], "func lockSubscriptionProviderLifecycleReservationContractTx(")
	require.NotEqual(t, -1, end)
	body := source[start : start+end]

	require.NotContains(t, body, "common.GetTimestamp()")
	require.Contains(t, body, "snapshot.EndedAt = dbNow")
	require.Contains(t, body, "terminationAt := snapshot.EndedAt")
	require.Contains(t, body, `"end_time":   terminationAt`)
	require.Contains(t, body, `"updated_at": dbNow`)
}

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
		&InviteSubscriptionReward{},
		&SubscriptionDiscountAccount{},
		&SubscriptionDiscountEntry{},
		&RecallLifecycleEvent{},
		&QuotaLifecycleState{},
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

func TestTerminalProviderSubscriptionStatusesRemainCanonical(t *testing.T) {
	for _, status := range []string{"canceled", "incomplete_expired", "unpaid"} {
		require.True(t, isTerminalProviderSubscriptionStatus(status), status)
		require.True(t, isTerminalProviderSubscriptionStatus(strings.ToUpper(status)), status)
	}
	require.False(t, isTerminalProviderSubscriptionStatus("active"))
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

func TestCompleteSubscriptionOrderWithProviderBindingCASLoserDoesNotCreateProviderBinding(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)
	migrateSubscriptionRecurringTestDB(t)
	insertUserForSubscriptionRecurringTest(t, 502)
	insertPlanForSubscriptionRecurringTest(t, 602, "price_recurring")
	insertOrderForSubscriptionRecurringTest(t, "recurring-order-cas-loser-binding", 502, 602)

	var order SubscriptionOrder
	require.NoError(t, DB.First(&order, "trade_no = ?", "recurring-order-cas-loser-binding").Error)

	callbackName := "test:force_provider_binding_subscription_cas_loss"
	fired := false
	var callbackErr error
	require.NoError(t, DB.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if fired || tx.Statement == nil || tx.Statement.Table != "subscription_orders" {
			return
		}
		fired = true
		callbackErr = tx.Exec("UPDATE subscription_orders SET status = ?, complete_time = ? WHERE id = ?", common.TopUpStatusSuccess, int64(1_700_203_550), order.Id).Error
	}))
	t.Cleanup(func() {
		require.NoError(t, DB.Callback().Update().Remove(callbackName))
	})

	binding, err := CompleteSubscriptionOrderWithProviderBinding("recurring-order-cas-loser-binding", "{}", PaymentProviderStripe, PaymentMethodStripe, stripeSnapshotForSubscriptionRecurringTest("sub_cas_loser_binding"))

	require.NoError(t, err)
	require.NoError(t, callbackErr)
	require.True(t, fired)
	require.Nil(t, binding)

	var bindingCount int64
	require.NoError(t, DB.Model(&SubscriptionProviderBinding{}).Count(&bindingCount).Error)
	require.Zero(t, bindingCount)
	requireSubscriptionLifecycleEventCount(t, order.TradeNo, RecallLifecycleTriggerPaymentSucceeded, 0)
}

func TestCompleteSubscriptionOrderWithProviderBindingGrantsInviteSubscriptionReward(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)
	migrateSubscriptionRecurringTestDB(t)

	originalMode := common.InviteRewardSubscriptionMode
	originalQuotaForInviter := common.QuotaForInviter
	originalQuotaForInviterMaxCount := common.QuotaForInviterMaxCount
	originalQuotaPerUnit := common.QuotaPerUnit
	t.Cleanup(func() {
		common.InviteRewardSubscriptionMode = originalMode
		common.QuotaForInviter = originalQuotaForInviter
		common.QuotaForInviterMaxCount = originalQuotaForInviterMaxCount
		common.QuotaPerUnit = originalQuotaPerUnit
	})
	common.InviteRewardSubscriptionMode = true
	common.QuotaForInviter = 750
	common.QuotaForInviterMaxCount = 5
	common.QuotaPerUnit = 100

	insertUserForSubscriptionRecurringTest(t, 510)
	insertUserForSubscriptionRecurringTest(t, 511)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", 511).Updates(map[string]any{
		"inviter_id":                 510,
		"invite_reward_status":       InviteRewardStatusPending,
		"invite_reward_block_reason": "",
	}).Error)
	insertPlanForSubscriptionRecurringTest(t, 610, "price_recurring")
	insertOrderForSubscriptionRecurringTest(t, "recurring-order-invite-reward", 511, 610)

	snapshot := stripeSnapshotForSubscriptionRecurringTest("sub_invite_reward")
	binding, err := CompleteSubscriptionOrderWithProviderBinding("recurring-order-invite-reward", "{}", PaymentProviderStripe, PaymentMethodStripe, snapshot)
	require.NoError(t, err)
	require.NotZero(t, binding.Id)

	replayed, err := CompleteSubscriptionOrderWithProviderBinding("recurring-order-invite-reward", "{}", PaymentProviderStripe, PaymentMethodStripe, snapshot)
	require.NoError(t, err)
	require.Equal(t, binding.Id, replayed.Id)

	var reward InviteSubscriptionReward
	require.NoError(t, DB.First(&reward, "invitee_id = ?", 511).Error)
	require.Equal(t, InviteSubRewardStatusGranted, reward.Status)
	require.EqualValues(t, 750, reward.RewardQuota)
	require.Zero(t, reward.UnlockAt)
	require.NotZero(t, reward.GrantedAt)

	var rewardCount int64
	require.NoError(t, DB.Model(&InviteSubscriptionReward{}).Where("invitee_id = ?", 511).Count(&rewardCount).Error)
	require.EqualValues(t, 1, rewardCount)

	requireInviteSubRewardLedger(t, 510, 511, 750)

	var entryCount int64
	require.NoError(t, DB.Model(&SubscriptionDiscountEntry{}).Where("user_id = ? AND entry_type = ?", 510, SubscriptionDiscountEntryTypeGrantInviter).Count(&entryCount).Error)
	require.EqualValues(t, 1, entryCount)

	var inviter User
	require.NoError(t, DB.First(&inviter, 510).Error)
	require.Equal(t, 1, inviter.AffCount)
	require.Zero(t, inviter.Quota)
	require.Zero(t, inviter.AffQuota)
	require.Zero(t, inviter.AffHistoryQuota)

	var invitee User
	require.NoError(t, DB.First(&invitee, 511).Error)
	require.Equal(t, InviteRewardStatusGranted, invitee.InviteRewardStatus)
}

func TestCompleteSubscriptionOrderWithProviderBindingRewardFailureDoesNotRollbackOrder(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)
	migrateSubscriptionRecurringTestDB(t)

	originalMode := common.InviteRewardSubscriptionMode
	originalQuotaForInviter := common.QuotaForInviter
	originalQuotaForInviterMaxCount := common.QuotaForInviterMaxCount
	originalQuotaPerUnit := common.QuotaPerUnit
	t.Cleanup(func() {
		common.InviteRewardSubscriptionMode = originalMode
		common.QuotaForInviter = originalQuotaForInviter
		common.QuotaForInviterMaxCount = originalQuotaForInviterMaxCount
		common.QuotaPerUnit = originalQuotaPerUnit
	})
	common.InviteRewardSubscriptionMode = true
	common.QuotaForInviter = -1
	common.QuotaForInviterMaxCount = 5
	common.QuotaPerUnit = 100

	insertUserForSubscriptionRecurringTest(t, 512)
	insertUserForSubscriptionRecurringTest(t, 513)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", 513).Updates(map[string]any{
		"inviter_id":                 512,
		"invite_reward_status":       InviteRewardStatusPending,
		"invite_reward_block_reason": "",
	}).Error)
	insertPlanForSubscriptionRecurringTest(t, 611, "price_recurring")
	insertOrderForSubscriptionRecurringTest(t, "recurring-order-reward-failure", 513, 611)

	snapshot := stripeSnapshotForSubscriptionRecurringTest("sub_reward_failure")
	binding, err := CompleteSubscriptionOrderWithProviderBinding("recurring-order-reward-failure", "{}", PaymentProviderStripe, PaymentMethodStripe, snapshot)
	require.NoError(t, err)
	require.NotZero(t, binding.Id)

	var order SubscriptionOrder
	require.NoError(t, DB.First(&order, "trade_no = ?", "recurring-order-reward-failure").Error)
	require.Equal(t, common.TopUpStatusSuccess, order.Status)
	var subs int64
	require.NoError(t, DB.Model(&UserSubscription{}).Where("user_id = ? AND provider_binding_id = ?", 513, binding.Id).Count(&subs).Error)
	require.EqualValues(t, 1, subs)
	var rewards int64
	require.NoError(t, DB.Model(&InviteSubscriptionReward{}).Where("invitee_id = ?", 513).Count(&rewards).Error)
	require.Zero(t, rewards)

	common.QuotaForInviter = 750
	require.NoError(t, TryGrantInviteSubscriptionRewardAfterOrderCompleted(order.TradeNo))
	requireInviteSubRewardLedger(t, 512, 513, 750)
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

func TestApplyProviderSubscriptionLifecycleSnapshotUsesAtomicSequencePredicate(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)
	migrateSubscriptionRecurringTestDB(t)
	insertUserForSubscriptionRecurringTest(t, 508)
	insertPlanForSubscriptionRecurringTest(t, 608, "price_recurring")
	insertOrderForSubscriptionRecurringTest(t, "recurring-order-lifecycle-cas", 508, 608)

	binding, err := CompleteSubscriptionOrderWithProviderBinding(
		"recurring-order-lifecycle-cas",
		"{}",
		PaymentProviderStripe,
		PaymentMethodStripe,
		stripeSnapshotForSubscriptionRecurringTest("sub_lifecycle_cas"),
	)
	require.NoError(t, err)

	callbackName := "test:observe_lifecycle_sequence_predicate"
	var updateWhere string
	require.NoError(t, DB.Callback().Update().After("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table != "subscription_provider_bindings" {
			return
		}
		where, ok := tx.Statement.Clauses["WHERE"]
		if ok {
			updateWhere = fmt.Sprintf("%#v", where.Expression)
		}
	}))
	t.Cleanup(func() {
		require.NoError(t, DB.Callback().Update().Remove(callbackName))
	})

	_, err = ApplyProviderSubscriptionLifecycleSnapshot(binding.Id, binding.LifecycleActionSeq, ProviderSubscriptionSnapshot{
		ProviderSubscriptionId: binding.ProviderSubscriptionId,
		ProviderStatus:         "active",
		CancelAtPeriodEnd:      true,
		CurrentPeriodStart:     binding.CurrentPeriodStart,
		CurrentPeriodEnd:       binding.CurrentPeriodEnd,
	})
	require.NoError(t, err)
	require.Contains(t, updateWhere, "lifecycle_action_seq")
}

func TestApplyProviderSubscriptionSnapshotPreservesNewerLifecycleDecision(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)
	migrateSubscriptionRecurringTestDB(t)
	insertUserForSubscriptionRecurringTest(t, 509)
	insertPlanForSubscriptionRecurringTest(t, 609, "price_recurring")
	insertOrderForSubscriptionRecurringTest(t, "recurring-order-generic-snapshot", 509, 609)

	binding, err := CompleteSubscriptionOrderWithProviderBinding(
		"recurring-order-generic-snapshot",
		"{}",
		PaymentProviderStripe,
		PaymentMethodStripe,
		stripeSnapshotForSubscriptionRecurringTest("sub_generic_snapshot"),
	)
	require.NoError(t, err)

	cancelled, err := ApplyProviderSubscriptionLifecycleSnapshot(binding.Id, binding.LifecycleActionSeq, ProviderSubscriptionSnapshot{
		ProviderSubscriptionId: binding.ProviderSubscriptionId,
		ProviderStatus:         "active",
		CancelAtPeriodEnd:      true,
		CurrentPeriodStart:     1000,
		CurrentPeriodEnd:       2000,
		CanceledAt:             1500,
	})
	require.NoError(t, err)
	require.True(t, cancelled.CancelAtPeriodEnd)

	updated, err := ApplyProviderSubscriptionSnapshot(binding.Id, ProviderSubscriptionSnapshot{
		ProviderSubscriptionId:  binding.ProviderSubscriptionId,
		ProviderLatestInvoiceId: "in_newer_snapshot",
		ProviderStatus:          "active",
		CancelAtPeriodEnd:       false,
		CurrentPeriodStart:      2000,
		CurrentPeriodEnd:        3000,
	})
	require.NoError(t, err)
	require.True(t, updated.CancelAtPeriodEnd)
	require.Equal(t, cancelled.CanceledAt, updated.CanceledAt)
	require.Equal(t, cancelled.LifecycleActionSeq, updated.LifecycleActionSeq)
	require.Equal(t, "in_newer_snapshot", updated.ProviderLatestInvoiceId)
	require.Equal(t, int64(3000), updated.CurrentPeriodEnd)
}

func TestApplyProviderSubscriptionLifecycleSnapshotSameTargetRetryRefreshesSafeMetadata(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)
	migrateSubscriptionRecurringTestDB(t)
	insertUserForSubscriptionRecurringTest(t, 510)
	insertPlanForSubscriptionRecurringTest(t, 610, "price_recurring")
	insertOrderForSubscriptionRecurringTest(t, "recurring-order-same-target-retry", 510, 610)

	binding, err := CompleteSubscriptionOrderWithProviderBinding(
		"recurring-order-same-target-retry",
		"{}",
		PaymentProviderStripe,
		PaymentMethodStripe,
		stripeSnapshotForSubscriptionRecurringTest("sub_same_target_retry"),
	)
	require.NoError(t, err)

	cancelled, err := ApplyProviderSubscriptionLifecycleSnapshot(binding.Id, binding.LifecycleActionSeq, ProviderSubscriptionSnapshot{
		ProviderSubscriptionId:  binding.ProviderSubscriptionId,
		ProviderLatestInvoiceId: "in_initial_cancel",
		ProviderStatus:          "active",
		CancelAtPeriodEnd:       true,
		CurrentPeriodStart:      1000,
		CurrentPeriodEnd:        2000,
		CanceledAt:              1500,
	})
	require.NoError(t, err)
	require.True(t, cancelled.CancelAtPeriodEnd)

	updated, err := ApplyProviderSubscriptionLifecycleSnapshot(binding.Id, binding.LifecycleActionSeq, ProviderSubscriptionSnapshot{
		ProviderSubscriptionId:  binding.ProviderSubscriptionId,
		ProviderLatestInvoiceId: "in_same_target_retry",
		ProviderStatus:          "trialing",
		CancelAtPeriodEnd:       true,
		CurrentPeriodStart:      2000,
		CurrentPeriodEnd:        3000,
		CanceledAt:              2500,
	})
	require.NoError(t, err)
	require.True(t, updated.CancelAtPeriodEnd)
	require.Equal(t, cancelled.CanceledAt, updated.CanceledAt)
	require.Equal(t, cancelled.LifecycleActionSeq, updated.LifecycleActionSeq)
	require.Equal(t, "in_same_target_retry", updated.ProviderLatestInvoiceId)
	require.Equal(t, "trialing", updated.ProviderStatus)
	require.Equal(t, int64(3000), updated.CurrentPeriodEnd)
}

func TestApplyProviderSubscriptionLifecycleSnapshotRejectsTerminalSameTarget(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)
	migrateSubscriptionRecurringTestDB(t)
	insertUserForSubscriptionRecurringTest(t, 511)
	insertPlanForSubscriptionRecurringTest(t, 611, "price_recurring")
	insertOrderForSubscriptionRecurringTest(t, "recurring-order-terminal-lifecycle", 511, 611)

	binding, err := CompleteSubscriptionOrderWithProviderBinding(
		"recurring-order-terminal-lifecycle",
		"{}",
		PaymentProviderStripe,
		PaymentMethodStripe,
		stripeSnapshotForSubscriptionRecurringTest("sub_terminal_lifecycle"),
	)
	require.NoError(t, err)

	terminated, err := ApplyProviderSubscriptionTermination(binding.Id, ProviderSubscriptionSnapshot{
		ProviderSubscriptionId: binding.ProviderSubscriptionId,
		ProviderStatus:         "canceled",
		CurrentPeriodStart:     1000,
		CurrentPeriodEnd:       2000,
		CanceledAt:             1500,
		EndedAt:                1500,
	})
	require.NoError(t, err)
	require.False(t, terminated.CancelAtPeriodEnd)

	updated, err := ApplyProviderSubscriptionLifecycleSnapshot(binding.Id, binding.LifecycleActionSeq, ProviderSubscriptionSnapshot{
		ProviderSubscriptionId: binding.ProviderSubscriptionId,
		ProviderStatus:         "active",
		CancelAtPeriodEnd:      false,
		CurrentPeriodStart:     2000,
		CurrentPeriodEnd:       3000,
	})
	require.ErrorIs(t, err, ErrSubscriptionProviderLifecycleConflict)
	require.Nil(t, updated)
}

func TestApplyProviderSubscriptionLifecycleSnapshotRejectsTerminalInputWithoutEndingEntitlement(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)
	migrateSubscriptionRecurringTestDB(t)
	insertUserForSubscriptionRecurringTest(t, 512)
	insertPlanForSubscriptionRecurringTest(t, 612, "price_recurring")
	insertOrderForSubscriptionRecurringTest(t, "recurring-order-terminal-input", 512, 612)

	binding, err := CompleteSubscriptionOrderWithProviderBinding(
		"recurring-order-terminal-input",
		"{}",
		PaymentProviderStripe,
		PaymentMethodStripe,
		stripeSnapshotForSubscriptionRecurringTest("sub_terminal_input"),
	)
	require.NoError(t, err)

	updated, err := ApplyProviderSubscriptionLifecycleSnapshot(binding.Id, binding.LifecycleActionSeq, ProviderSubscriptionSnapshot{
		ProviderSubscriptionId: binding.ProviderSubscriptionId,
		ProviderStatus:         "canceled",
		CancelAtPeriodEnd:      true,
		CurrentPeriodStart:     binding.CurrentPeriodStart,
		CurrentPeriodEnd:       binding.CurrentPeriodEnd,
		CanceledAt:             1500,
		EndedAt:                1500,
	})

	require.ErrorIs(t, err, ErrSubscriptionProviderLifecycleConflict)
	require.Nil(t, updated)
	var storedBinding SubscriptionProviderBinding
	require.NoError(t, DB.First(&storedBinding, binding.Id).Error)
	require.Equal(t, "active", storedBinding.ProviderStatus)
	require.Zero(t, storedBinding.EndedAt)
	require.False(t, storedBinding.CancelAtPeriodEnd)
	require.Equal(t, binding.LifecycleActionSeq, storedBinding.LifecycleActionSeq)
	var storedEntitlement UserSubscription
	require.NoError(t, DB.Where("provider_binding_id = ?", binding.Id).First(&storedEntitlement).Error)
	require.Equal(t, SubscriptionEntitlementStatusActive, storedEntitlement.Status)
}

func TestApplyProviderSubscriptionSnapshotRejectsTerminalInputWithoutEndingEntitlement(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)
	migrateSubscriptionRecurringTestDB(t)
	insertUserForSubscriptionRecurringTest(t, 514)
	insertPlanForSubscriptionRecurringTest(t, 614, "price_recurring")
	insertOrderForSubscriptionRecurringTest(t, "recurring-order-passive-terminal-input", 514, 614)

	binding, err := CompleteSubscriptionOrderWithProviderBinding(
		"recurring-order-passive-terminal-input",
		"{}",
		PaymentProviderStripe,
		PaymentMethodStripe,
		stripeSnapshotForSubscriptionRecurringTest("sub_passive_terminal_input"),
	)
	require.NoError(t, err)

	updated, err := ApplyProviderSubscriptionSnapshot(binding.Id, ProviderSubscriptionSnapshot{
		ProviderSubscriptionId: binding.ProviderSubscriptionId,
		ProviderStatus:         "canceled",
		CurrentPeriodStart:     binding.CurrentPeriodStart,
		CurrentPeriodEnd:       binding.CurrentPeriodEnd,
		EndedAt:                1500,
	})

	require.ErrorIs(t, err, ErrSubscriptionProviderLifecycleConflict)
	require.Nil(t, updated)
	var storedBinding SubscriptionProviderBinding
	require.NoError(t, DB.First(&storedBinding, binding.Id).Error)
	require.Equal(t, "active", storedBinding.ProviderStatus)
	require.Zero(t, storedBinding.EndedAt)
	var storedEntitlement UserSubscription
	require.NoError(t, DB.Where("provider_binding_id = ?", binding.Id).First(&storedEntitlement).Error)
	require.Equal(t, SubscriptionEntitlementStatusActive, storedEntitlement.Status)
}

func TestApplyProviderSubscriptionSnapshotRejectsReservationInsertedBeforeUpdate(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)
	migrateSubscriptionRecurringTestDB(t)
	insertUserForSubscriptionRecurringTest(t, 515)
	insertPlanForSubscriptionRecurringTest(t, 615, "price_recurring")
	insertOrderForSubscriptionRecurringTest(t, "recurring-order-passive-reservation-race", 515, 615)

	binding, err := CompleteSubscriptionOrderWithProviderBinding(
		"recurring-order-passive-reservation-race",
		"{}",
		PaymentProviderStripe,
		PaymentMethodStripe,
		stripeSnapshotForSubscriptionRecurringTest("sub_passive_reservation_race"),
	)
	require.NoError(t, err)
	require.NoError(t, DB.Exec(fmt.Sprintf(`
		CREATE TRIGGER reserve_before_passive_snapshot_update
		BEFORE UPDATE OF provider_latest_invoice_id ON subscription_provider_bindings
		WHEN OLD.id = %d AND NEW.provider_latest_invoice_id = 'in_passive_reservation_race'
		BEGIN
			UPDATE subscription_provider_bindings
			SET lifecycle_reservation_token = 'passive-race-token',
				lifecycle_reservation_action = 'cancel',
				lifecycle_reservation_until = %d
			WHERE id = OLD.id;
			SELECT RAISE(IGNORE);
		END
	`, binding.Id, GetDBTimestamp()+300)).Error)
	t.Cleanup(func() {
		require.NoError(t, DB.Exec("DROP TRIGGER IF EXISTS reserve_before_passive_snapshot_update").Error)
	})

	updated, err := ApplyProviderSubscriptionSnapshot(binding.Id, ProviderSubscriptionSnapshot{
		ProviderSubscriptionId:  binding.ProviderSubscriptionId,
		ProviderLatestInvoiceId: "in_passive_reservation_race",
		ProviderStatus:          "active",
		CurrentPeriodStart:      binding.CurrentPeriodStart,
		CurrentPeriodEnd:        binding.CurrentPeriodEnd,
	})

	require.ErrorIs(t, err, ErrSubscriptionProviderLifecycleConflict)
	require.Nil(t, updated)
	var stored SubscriptionProviderBinding
	require.NoError(t, DB.First(&stored, binding.Id).Error)
	require.NotEqual(t, "in_passive_reservation_race", stored.ProviderLatestInvoiceId)
}

func TestApplyProviderSubscriptionTerminationRejectsReservationInsertedBeforeUpdate(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)
	migrateSubscriptionRecurringTestDB(t)
	insertUserForSubscriptionRecurringTest(t, 516)
	insertPlanForSubscriptionRecurringTest(t, 616, "price_recurring")
	insertOrderForSubscriptionRecurringTest(t, "recurring-order-termination-reservation-race", 516, 616)

	binding, err := CompleteSubscriptionOrderWithProviderBinding(
		"recurring-order-termination-reservation-race",
		"{}",
		PaymentProviderStripe,
		PaymentMethodStripe,
		stripeSnapshotForSubscriptionRecurringTest("sub_termination_reservation_race"),
	)
	require.NoError(t, err)
	require.NoError(t, DB.Exec(fmt.Sprintf(`
		CREATE TRIGGER reserve_before_termination_update
		BEFORE UPDATE OF provider_status ON subscription_provider_bindings
		WHEN OLD.id = %d AND NEW.provider_status = 'canceled'
		BEGIN
			UPDATE subscription_provider_bindings
			SET lifecycle_reservation_token = 'termination-race-token',
				lifecycle_reservation_action = 'resume',
				lifecycle_reservation_until = %d
			WHERE id = OLD.id;
			SELECT RAISE(IGNORE);
		END
	`, binding.Id, GetDBTimestamp()+300)).Error)
	t.Cleanup(func() {
		require.NoError(t, DB.Exec("DROP TRIGGER IF EXISTS reserve_before_termination_update").Error)
	})

	updated, err := ApplyProviderSubscriptionTermination(binding.Id, ProviderSubscriptionSnapshot{
		ProviderSubscriptionId: binding.ProviderSubscriptionId,
		ProviderStatus:         "canceled",
		CurrentPeriodStart:     binding.CurrentPeriodStart,
		CurrentPeriodEnd:       binding.CurrentPeriodEnd,
		EndedAt:                GetDBTimestamp(),
	})

	require.ErrorIs(t, err, ErrSubscriptionProviderLifecycleConflict)
	require.Nil(t, updated)
	var entitlement UserSubscription
	require.NoError(t, DB.Where("provider_binding_id = ?", binding.Id).First(&entitlement).Error)
	require.Equal(t, SubscriptionEntitlementStatusActive, entitlement.Status)
}

func TestApplyPassiveProviderSubscriptionTerminationClearsActiveReservation(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)
	migrateSubscriptionRecurringTestDB(t)
	insertUserForSubscriptionRecurringTest(t, 517)
	insertPlanForSubscriptionRecurringTest(t, 617, "price_recurring")
	insertOrderForSubscriptionRecurringTest(t, "recurring-order-passive-terminal-reservation", 517, 617)

	binding, err := CompleteSubscriptionOrderWithProviderBinding(
		"recurring-order-passive-terminal-reservation",
		"{}",
		PaymentProviderStripe,
		PaymentMethodStripe,
		stripeSnapshotForSubscriptionRecurringTest("sub_passive_terminal_reservation"),
	)
	require.NoError(t, err)
	reservation, _, err := ReserveSubscriptionProviderLifecycle(
		binding.Id,
		binding.UserId,
		binding.ProviderSubscriptionId,
		binding.LifecycleActionSeq,
		SubscriptionProviderLifecycleActionResume,
		"passive-terminal-reservation",
		300,
	)
	require.NoError(t, err)
	require.NotNil(t, reservation)

	terminated, err := ApplyPassiveProviderSubscriptionTermination(binding.Id, ProviderSubscriptionSnapshot{
		ProviderSubscriptionId: binding.ProviderSubscriptionId,
		ProviderStatus:         "canceled",
		CurrentPeriodStart:     binding.CurrentPeriodStart,
		CurrentPeriodEnd:       binding.CurrentPeriodEnd,
		EndedAt:                GetDBTimestamp(),
	})

	require.NoError(t, err)
	require.Equal(t, "canceled", terminated.ProviderStatus)
	require.Greater(t, terminated.EndedAt, int64(0))
	require.Empty(t, terminated.LifecycleReservationToken)
	require.Empty(t, terminated.LifecycleReservationAction)
	require.Zero(t, terminated.LifecycleReservationUntil)
	var entitlement UserSubscription
	require.NoError(t, DB.Where("provider_binding_id = ?", binding.Id).First(&entitlement).Error)
	require.Equal(t, "cancelled", entitlement.Status)
}

func TestApplyPassiveProviderSubscriptionTerminationRejectsNonTerminalSnapshot(t *testing.T) {
	updated, err := ApplyPassiveProviderSubscriptionTermination(1, ProviderSubscriptionSnapshot{
		ProviderSubscriptionId: "sub_non_terminal_passive",
		ProviderStatus:         "active",
	})

	require.ErrorIs(t, err, ErrSubscriptionProviderLifecycleConflict)
	require.Nil(t, updated)
}

func TestApplyPassiveProviderSubscriptionTerminationWithReservationGuardRejectsForeignReservation(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)
	migrateSubscriptionRecurringTestDB(t)
	insertUserForSubscriptionRecurringTest(t, 518)
	insertPlanForSubscriptionRecurringTest(t, 618, "price_recurring")
	insertOrderForSubscriptionRecurringTest(t, "recurring-order-passive-terminal-guard", 518, 618)

	binding, err := CompleteSubscriptionOrderWithProviderBinding(
		"recurring-order-passive-terminal-guard",
		"{}",
		PaymentProviderStripe,
		PaymentMethodStripe,
		stripeSnapshotForSubscriptionRecurringTest("sub_passive_terminal_guard"),
	)
	require.NoError(t, err)
	reservation, _, err := ReserveSubscriptionProviderLifecycle(
		binding.Id,
		binding.UserId,
		binding.ProviderSubscriptionId,
		binding.LifecycleActionSeq,
		SubscriptionProviderLifecycleActionCancel,
		"passive-terminal-guard-owner",
		300,
	)
	require.NoError(t, err)
	require.NoError(t, DB.Model(&SubscriptionProviderBinding{}).
		Where("id = ?", binding.Id).
		Updates(map[string]interface{}{
			"lifecycle_reservation_token":  "passive-terminal-foreign-owner",
			"lifecycle_reservation_action": SubscriptionProviderLifecycleActionCancel,
			"lifecycle_reservation_until":  GetDBTimestamp() + 300,
		}).Error)

	terminated, err := ApplyPassiveProviderSubscriptionTerminationWithReservationGuard(reservation, ProviderSubscriptionSnapshot{
		ProviderSubscriptionId: binding.ProviderSubscriptionId,
		ProviderStatus:         "canceled",
		EndedAt:                GetDBTimestamp(),
	})

	require.ErrorIs(t, err, ErrSubscriptionProviderLifecycleConflict)
	require.Nil(t, terminated)
	var entitlement UserSubscription
	require.NoError(t, DB.Where("provider_binding_id = ?", binding.Id).First(&entitlement).Error)
	require.Equal(t, SubscriptionEntitlementStatusActive, entitlement.Status)
}

func TestApplyProviderSubscriptionTerminationWithCancelReservationAcceptsTerminalSnapshot(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)
	migrateSubscriptionRecurringTestDB(t)
	insertUserForSubscriptionRecurringTest(t, 522)
	insertPlanForSubscriptionRecurringTest(t, 622, "price_recurring")
	insertOrderForSubscriptionRecurringTest(t, "recurring-order-cancel-reservation-terminal", 522, 622)

	binding, err := CompleteSubscriptionOrderWithProviderBinding(
		"recurring-order-cancel-reservation-terminal",
		"{}",
		PaymentProviderStripe,
		PaymentMethodStripe,
		stripeSnapshotForSubscriptionRecurringTest("sub_cancel_reservation_terminal"),
	)
	require.NoError(t, err)
	reservation, _, err := ReserveSubscriptionProviderLifecycle(
		binding.Id,
		binding.UserId,
		binding.ProviderSubscriptionId,
		binding.LifecycleActionSeq,
		SubscriptionProviderLifecycleActionCancel,
		"cancel-reservation-terminal",
		300,
	)
	require.NoError(t, err)

	terminated, err := ApplyProviderSubscriptionTerminationWithReservation(reservation, ProviderSubscriptionSnapshot{
		ProviderSubscriptionId: binding.ProviderSubscriptionId,
		ProviderStatus:         "canceled",
		CurrentPeriodStart:     binding.CurrentPeriodStart,
		CurrentPeriodEnd:       binding.CurrentPeriodEnd,
		EndedAt:                GetDBTimestamp(),
	})

	require.NoError(t, err)
	require.Equal(t, "canceled", terminated.ProviderStatus)
	require.Greater(t, terminated.EndedAt, int64(0))
	require.Equal(t, reservation.Token, terminated.LifecycleReservationToken)
	require.Equal(t, reservation.Action, terminated.LifecycleReservationAction)
	require.Zero(t, terminated.LifecycleReservationUntil)
	var entitlement UserSubscription
	require.NoError(t, DB.Where("provider_binding_id = ?", binding.Id).First(&entitlement).Error)
	require.Equal(t, "cancelled", entitlement.Status)
}

func TestApplyProviderSubscriptionTerminationWithResumeReservationAcceptsTerminalSnapshot(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)
	migrateSubscriptionRecurringTestDB(t)
	insertUserForSubscriptionRecurringTest(t, 523)
	insertPlanForSubscriptionRecurringTest(t, 623, "price_recurring")
	insertOrderForSubscriptionRecurringTest(t, "recurring-order-resume-reservation-terminal", 523, 623)

	binding, err := CompleteSubscriptionOrderWithProviderBinding(
		"recurring-order-resume-reservation-terminal",
		"{}",
		PaymentProviderStripe,
		PaymentMethodStripe,
		stripeSnapshotForSubscriptionRecurringTest("sub_resume_reservation_terminal"),
	)
	require.NoError(t, err)
	reservation, _, err := ReserveSubscriptionProviderLifecycle(
		binding.Id,
		binding.UserId,
		binding.ProviderSubscriptionId,
		binding.LifecycleActionSeq,
		SubscriptionProviderLifecycleActionResume,
		"resume-reservation-terminal",
		300,
	)
	require.NoError(t, err)
	terminalSnapshot := ProviderSubscriptionSnapshot{
		ProviderSubscriptionId: binding.ProviderSubscriptionId,
		ProviderStatus:         "canceled",
		CurrentPeriodStart:     binding.CurrentPeriodStart,
		CurrentPeriodEnd:       binding.CurrentPeriodEnd,
		EndedAt:                GetDBTimestamp(),
	}

	ownedTermination, err := ApplyProviderSubscriptionTerminationWithReservation(reservation, terminalSnapshot)

	require.NoError(t, err)
	require.NotNil(t, ownedTermination)
	require.Equal(t, "canceled", ownedTermination.ProviderStatus)
	require.Greater(t, ownedTermination.EndedAt, int64(0))
	require.Equal(t, reservation.Token, ownedTermination.LifecycleReservationToken)
	require.Equal(t, reservation.Action, ownedTermination.LifecycleReservationAction)
	require.Zero(t, ownedTermination.LifecycleReservationUntil)
	var reservedBinding SubscriptionProviderBinding
	require.NoError(t, DB.First(&reservedBinding, binding.Id).Error)
	require.Equal(t, reservation.Token, reservedBinding.LifecycleReservationToken)
	require.Equal(t, SubscriptionProviderLifecycleActionResume, reservedBinding.LifecycleReservationAction)
	require.Zero(t, reservedBinding.LifecycleReservationUntil)
	require.Greater(t, reservedBinding.EndedAt, int64(0))
	var entitlement UserSubscription
	require.NoError(t, DB.Where("provider_binding_id = ?", binding.Id).First(&entitlement).Error)
	require.Equal(t, "cancelled", entitlement.Status)
}

func TestReservationOwnedProviderLifecycleApplyRejectsResumeWhenContractNeedsAttention(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	createEntitlementTestUser(t, 524, "default")
	createEntitlementTestPlan(t, 624, 1000, "")
	const (
		contractID = int64(724)
		bindingID  = int64(824)
	)
	require.NoError(t, DB.Create(&UserSubscriptionContract{
		Id:                       contractID,
		UserId:                   524,
		Status:                   SubscriptionContractStatusActive,
		PaymentMode:              SubscriptionPaymentModeStripeRecurring,
		CurrentPlanId:            624,
		CurrentProviderBindingId: bindingID,
		RenewalStatus:            SubscriptionRenewalStatusCancelledByUser,
	}).Error)
	require.NoError(t, DB.Create(&SubscriptionProviderBinding{
		Id:                     bindingID,
		UserId:                 524,
		PlanId:                 624,
		ContractId:             contractID,
		Provider:               PaymentProviderStripe,
		ProviderSubscriptionId: "sub_resume_needs_attention_apply",
		ProviderStatus:         "active",
		CancelAtPeriodEnd:      true,
		CurrentPeriodStart:     1000,
		CurrentPeriodEnd:       2000,
	}).Error)
	reservation, _, err := ReserveSubscriptionProviderLifecycle(
		bindingID,
		524,
		"sub_resume_needs_attention_apply",
		0,
		SubscriptionProviderLifecycleActionResume,
		"resume-needs-attention-apply",
		300,
	)
	require.NoError(t, err)
	require.NoError(t, DB.Model(&UserSubscriptionContract{}).Where("id = ?", contractID).
		Update("status", SubscriptionContractStatusNeedsAttention).Error)

	updated, err := ApplyProviderSubscriptionLifecycleSnapshotStrictWithReservation(reservation, ProviderSubscriptionSnapshot{
		ProviderSubscriptionId: "sub_resume_needs_attention_apply",
		ProviderStatus:         "active",
		CancelAtPeriodEnd:      false,
		CurrentPeriodStart:     1000,
		CurrentPeriodEnd:       2000,
	})

	require.ErrorIs(t, err, ErrSubscriptionProviderLifecycleConflict)
	require.Nil(t, updated)
	var stored SubscriptionProviderBinding
	require.NoError(t, DB.First(&stored, bindingID).Error)
	require.True(t, stored.CancelAtPeriodEnd)
	require.Equal(t, reservation.Token, stored.LifecycleReservationToken)
	require.Equal(t, SubscriptionProviderLifecycleActionResume, stored.LifecycleReservationAction)
	require.Equal(t, reservation.ExpiresAt, stored.LifecycleReservationUntil)
}

func TestReservationOwnedProviderLifecycleTerminationRejectsResumeWhenContractNeedsAttention(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	createEntitlementTestUser(t, 525, "default")
	createEntitlementTestPlan(t, 625, 1000, "")
	const (
		contractID = int64(725)
		bindingID  = int64(825)
	)
	require.NoError(t, DB.Create(&UserSubscriptionContract{
		Id:                       contractID,
		UserId:                   525,
		Status:                   SubscriptionContractStatusActive,
		PaymentMode:              SubscriptionPaymentModeStripeRecurring,
		CurrentPlanId:            625,
		CurrentProviderBindingId: bindingID,
		RenewalStatus:            SubscriptionRenewalStatusCancelledByUser,
	}).Error)
	require.NoError(t, DB.Create(&SubscriptionProviderBinding{
		Id:                     bindingID,
		UserId:                 525,
		PlanId:                 625,
		ContractId:             contractID,
		Provider:               PaymentProviderStripe,
		ProviderSubscriptionId: "sub_resume_needs_attention_termination",
		ProviderStatus:         "active",
		CancelAtPeriodEnd:      true,
		CurrentPeriodStart:     1000,
		CurrentPeriodEnd:       2000,
	}).Error)
	reservation, _, err := ReserveSubscriptionProviderLifecycle(
		bindingID,
		525,
		"sub_resume_needs_attention_termination",
		0,
		SubscriptionProviderLifecycleActionResume,
		"resume-needs-attention-termination",
		300,
	)
	require.NoError(t, err)
	require.NoError(t, DB.Model(&UserSubscriptionContract{}).Where("id = ?", contractID).
		Update("status", SubscriptionContractStatusNeedsAttention).Error)

	updated, err := ApplyProviderSubscriptionTerminationWithReservation(reservation, ProviderSubscriptionSnapshot{
		ProviderSubscriptionId: "sub_resume_needs_attention_termination",
		ProviderStatus:         "canceled",
		CurrentPeriodStart:     1000,
		CurrentPeriodEnd:       2000,
		EndedAt:                GetDBTimestamp(),
	})

	require.ErrorIs(t, err, ErrSubscriptionProviderLifecycleConflict)
	require.Nil(t, updated)
	var stored SubscriptionProviderBinding
	require.NoError(t, DB.First(&stored, bindingID).Error)
	require.Zero(t, stored.EndedAt)
	require.Equal(t, "active", stored.ProviderStatus)
	require.Equal(t, reservation.Token, stored.LifecycleReservationToken)
	require.Equal(t, SubscriptionProviderLifecycleActionResume, stored.LifecycleReservationAction)
	require.Equal(t, reservation.ExpiresAt, stored.LifecycleReservationUntil)
}

func TestReservationOwnedProviderLifecycleApplyRejectsProviderDrift(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	createEntitlementTestUser(t, 526, "default")
	createEntitlementTestPlan(t, 626, 1000, "")
	const (
		contractID = int64(726)
		bindingID  = int64(826)
	)
	require.NoError(t, DB.Create(&UserSubscriptionContract{
		Id:                       contractID,
		UserId:                   526,
		Status:                   SubscriptionContractStatusActive,
		PaymentMode:              SubscriptionPaymentModeStripeRecurring,
		CurrentPlanId:            626,
		CurrentProviderBindingId: bindingID,
	}).Error)
	require.NoError(t, DB.Create(&SubscriptionProviderBinding{
		Id:                     bindingID,
		UserId:                 526,
		PlanId:                 626,
		ContractId:             contractID,
		Provider:               PaymentProviderStripe,
		ProviderSubscriptionId: "sub_provider_drift_apply",
		ProviderStatus:         "active",
		CurrentPeriodStart:     1000,
		CurrentPeriodEnd:       2000,
	}).Error)
	require.NoError(t, DB.Create(&UserSubscription{
		UserId:            526,
		PlanId:            626,
		ContractId:        contractID,
		ProviderBindingId: bindingID,
		AmountTotal:       1000,
		StartTime:         1000,
		EndTime:           2000,
		AccessEndTime:     2000,
		Status:            "active",
		Source:            "stripe",
		PaymentMode:       SubscriptionPaymentModeStripeRecurring,
	}).Error)
	reservation, _, err := ReserveSubscriptionProviderLifecycle(
		bindingID,
		526,
		"sub_provider_drift_apply",
		0,
		SubscriptionProviderLifecycleActionCancel,
		"provider-drift-apply",
		300,
	)
	require.NoError(t, err)
	require.NoError(t, DB.Model(&SubscriptionProviderBinding{}).Where("id = ?", bindingID).
		Update("provider", PaymentProviderCreem).Error)

	updated, err := ApplyProviderSubscriptionLifecycleSnapshotStrictWithReservation(reservation, ProviderSubscriptionSnapshot{
		ProviderSubscriptionId: "sub_provider_drift_apply",
		ProviderStatus:         "active",
		CancelAtPeriodEnd:      true,
		CurrentPeriodStart:     1000,
		CurrentPeriodEnd:       2000,
		CanceledAt:             1500,
	})

	require.ErrorIs(t, err, ErrSubscriptionProviderLifecycleConflict)
	require.Nil(t, updated)
	var stored SubscriptionProviderBinding
	require.NoError(t, DB.First(&stored, bindingID).Error)
	require.Equal(t, PaymentProviderCreem, stored.Provider)
	require.False(t, stored.CancelAtPeriodEnd)
	require.Zero(t, stored.CanceledAt)
	require.Equal(t, reservation.Token, stored.LifecycleReservationToken)
	require.Equal(t, SubscriptionProviderLifecycleActionCancel, stored.LifecycleReservationAction)
	require.Equal(t, reservation.ExpiresAt, stored.LifecycleReservationUntil)
	var entitlement UserSubscription
	require.NoError(t, DB.Where("provider_binding_id = ?", bindingID).First(&entitlement).Error)
	require.Equal(t, "active", entitlement.Status)
	require.Equal(t, int64(2000), entitlement.EndTime)
}

func TestReservationOwnedProviderLifecycleTerminationRejectsProviderDrift(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	createEntitlementTestUser(t, 527, "default")
	createEntitlementTestPlan(t, 627, 1000, "")
	const (
		contractID = int64(727)
		bindingID  = int64(827)
	)
	require.NoError(t, DB.Create(&UserSubscriptionContract{
		Id:                       contractID,
		UserId:                   527,
		Status:                   SubscriptionContractStatusActive,
		PaymentMode:              SubscriptionPaymentModeStripeRecurring,
		CurrentPlanId:            627,
		CurrentProviderBindingId: bindingID,
	}).Error)
	require.NoError(t, DB.Create(&SubscriptionProviderBinding{
		Id:                     bindingID,
		UserId:                 527,
		PlanId:                 627,
		ContractId:             contractID,
		Provider:               PaymentProviderStripe,
		ProviderSubscriptionId: "sub_provider_drift_termination",
		ProviderStatus:         "active",
		CurrentPeriodStart:     1000,
		CurrentPeriodEnd:       2000,
	}).Error)
	require.NoError(t, DB.Create(&UserSubscription{
		UserId:            527,
		PlanId:            627,
		ContractId:        contractID,
		ProviderBindingId: bindingID,
		AmountTotal:       1000,
		StartTime:         1000,
		EndTime:           2000,
		AccessEndTime:     2000,
		Status:            "active",
		Source:            "stripe",
		PaymentMode:       SubscriptionPaymentModeStripeRecurring,
	}).Error)
	reservation, _, err := ReserveSubscriptionProviderLifecycle(
		bindingID,
		527,
		"sub_provider_drift_termination",
		0,
		SubscriptionProviderLifecycleActionCancel,
		"provider-drift-termination",
		300,
	)
	require.NoError(t, err)
	require.NoError(t, DB.Model(&SubscriptionProviderBinding{}).Where("id = ?", bindingID).
		Update("provider", PaymentProviderCreem).Error)

	updated, err := ApplyProviderSubscriptionTerminationWithReservation(reservation, ProviderSubscriptionSnapshot{
		ProviderSubscriptionId: "sub_provider_drift_termination",
		ProviderStatus:         "canceled",
		CurrentPeriodStart:     1000,
		CurrentPeriodEnd:       2000,
		EndedAt:                GetDBTimestamp(),
	})

	require.ErrorIs(t, err, ErrSubscriptionProviderLifecycleConflict)
	require.Nil(t, updated)
	var stored SubscriptionProviderBinding
	require.NoError(t, DB.First(&stored, bindingID).Error)
	require.Equal(t, PaymentProviderCreem, stored.Provider)
	require.Zero(t, stored.EndedAt)
	require.Equal(t, "active", stored.ProviderStatus)
	require.Equal(t, reservation.Token, stored.LifecycleReservationToken)
	require.Equal(t, SubscriptionProviderLifecycleActionCancel, stored.LifecycleReservationAction)
	require.Equal(t, reservation.ExpiresAt, stored.LifecycleReservationUntil)
	var entitlement UserSubscription
	require.NoError(t, DB.Where("provider_binding_id = ?", bindingID).First(&entitlement).Error)
	require.Equal(t, "active", entitlement.Status)
	require.Equal(t, int64(2000), entitlement.EndTime)
}

func TestReservationOwnedProviderLifecycleApplyAcceptsExpiredExactLease(t *testing.T) {
	testCases := []struct {
		name  string
		apply func(reservation *SubscriptionProviderLifecycleReservation, binding *SubscriptionProviderBinding) (*SubscriptionProviderBinding, error)
	}{
		{
			name: "snapshot",
			apply: func(reservation *SubscriptionProviderLifecycleReservation, binding *SubscriptionProviderBinding) (*SubscriptionProviderBinding, error) {
				return ApplyProviderSubscriptionLifecycleSnapshotStrictWithReservation(reservation, ProviderSubscriptionSnapshot{
					ProviderSubscriptionId: binding.ProviderSubscriptionId,
					ProviderStatus:         "active",
					CancelAtPeriodEnd:      true,
					CurrentPeriodStart:     binding.CurrentPeriodStart,
					CurrentPeriodEnd:       binding.CurrentPeriodEnd,
				})
			},
		},
		{
			name: "termination",
			apply: func(reservation *SubscriptionProviderLifecycleReservation, binding *SubscriptionProviderBinding) (*SubscriptionProviderBinding, error) {
				return ApplyProviderSubscriptionTerminationWithReservation(reservation, ProviderSubscriptionSnapshot{
					ProviderSubscriptionId: binding.ProviderSubscriptionId,
					ProviderStatus:         "canceled",
					CurrentPeriodStart:     binding.CurrentPeriodStart,
					CurrentPeriodEnd:       binding.CurrentPeriodEnd,
					EndedAt:                GetDBTimestamp(),
				})
			},
		},
	}
	for index, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			setupSubscriptionRecurringTestDB(t)
			migrateSubscriptionRecurringTestDB(t)
			userID := 518 + index
			planID := 618 + index
			tradeNo := "recurring-order-expired-exact-" + testCase.name
			insertUserForSubscriptionRecurringTest(t, userID)
			insertPlanForSubscriptionRecurringTest(t, planID, "price_recurring")
			insertOrderForSubscriptionRecurringTest(t, tradeNo, userID, planID)

			binding, err := CompleteSubscriptionOrderWithProviderBinding(
				tradeNo,
				"{}",
				PaymentProviderStripe,
				PaymentMethodStripe,
				stripeSnapshotForSubscriptionRecurringTest("sub_expired_exact_"+testCase.name),
			)
			require.NoError(t, err)
			reservation, _, err := ReserveSubscriptionProviderLifecycle(
				binding.Id,
				binding.UserId,
				binding.ProviderSubscriptionId,
				binding.LifecycleActionSeq,
				SubscriptionProviderLifecycleActionCancel,
				"expired-exact-"+testCase.name,
				300,
			)
			require.NoError(t, err)
			reservation.ExpiresAt = GetDBTimestamp() - 1
			require.NoError(t, DB.Model(&SubscriptionProviderBinding{}).Where("id = ?", binding.Id).
				Update("lifecycle_reservation_until", reservation.ExpiresAt).Error)

			updated, err := testCase.apply(reservation, binding)

			require.NoError(t, err)
			require.NotNil(t, updated)
			require.Equal(t, reservation.Token, updated.LifecycleReservationToken)
			require.Equal(t, reservation.Action, updated.LifecycleReservationAction)
			require.Zero(t, updated.LifecycleReservationUntil)
		})
	}
}

func TestReservationOwnedProviderLifecycleApplyRejectsExpiredLeaseReclaimedByNewRequest(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)
	migrateSubscriptionRecurringTestDB(t)
	insertUserForSubscriptionRecurringTest(t, 520)
	insertPlanForSubscriptionRecurringTest(t, 620, "price_recurring")
	insertOrderForSubscriptionRecurringTest(t, "recurring-order-expired-reclaimed", 520, 620)

	binding, err := CompleteSubscriptionOrderWithProviderBinding(
		"recurring-order-expired-reclaimed",
		"{}",
		PaymentProviderStripe,
		PaymentMethodStripe,
		stripeSnapshotForSubscriptionRecurringTest("sub_expired_reclaimed"),
	)
	require.NoError(t, err)
	original, _, err := ReserveSubscriptionProviderLifecycle(
		binding.Id,
		binding.UserId,
		binding.ProviderSubscriptionId,
		binding.LifecycleActionSeq,
		SubscriptionProviderLifecycleActionCancel,
		"expired-original-token",
		300,
	)
	require.NoError(t, err)
	original.ExpiresAt = GetDBTimestamp() - 1
	require.NoError(t, DB.Model(&SubscriptionProviderBinding{}).Where("id = ?", binding.Id).
		Update("lifecycle_reservation_until", original.ExpiresAt).Error)
	reclaimed, _, err := ReserveSubscriptionProviderLifecycle(
		binding.Id,
		binding.UserId,
		binding.ProviderSubscriptionId,
		original.LifecycleActionSeq,
		SubscriptionProviderLifecycleActionCancel,
		"expired-reclaimed-token",
		300,
	)
	require.NoError(t, err)

	updated, err := ApplyProviderSubscriptionLifecycleSnapshotStrictWithReservation(original, ProviderSubscriptionSnapshot{
		ProviderSubscriptionId: binding.ProviderSubscriptionId,
		ProviderStatus:         "active",
		CancelAtPeriodEnd:      true,
		CurrentPeriodStart:     binding.CurrentPeriodStart,
		CurrentPeriodEnd:       binding.CurrentPeriodEnd,
	})

	require.ErrorIs(t, err, ErrSubscriptionProviderLifecycleConflict)
	require.Nil(t, updated)
	var stored SubscriptionProviderBinding
	require.NoError(t, DB.First(&stored, binding.Id).Error)
	require.Equal(t, reclaimed.Token, stored.LifecycleReservationToken)
	require.Equal(t, reclaimed.ExpiresAt, stored.LifecycleReservationUntil)
}

func TestReservationOwnedProviderLifecycleApplyRejectsBindingNoLongerCurrent(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	createEntitlementTestUser(t, 521, "default")
	createEntitlementTestPlan(t, 621, 1000, "")
	const (
		contractID           = int64(721)
		originalBindingID    = int64(821)
		replacementBindingID = int64(822)
	)
	require.NoError(t, DB.Create(&UserSubscriptionContract{
		Id:                       contractID,
		UserId:                   521,
		Status:                   SubscriptionContractStatusActive,
		PaymentMode:              SubscriptionPaymentModeStripeRecurring,
		CurrentPlanId:            621,
		CurrentProviderBindingId: originalBindingID,
	}).Error)
	require.NoError(t, DB.Create(&SubscriptionProviderBinding{
		Id:                     originalBindingID,
		UserId:                 521,
		PlanId:                 621,
		ContractId:             contractID,
		Provider:               PaymentProviderStripe,
		ProviderSubscriptionId: "sub_reservation_no_longer_current",
		ProviderStatus:         "active",
		CurrentPeriodStart:     1000,
		CurrentPeriodEnd:       2000,
	}).Error)
	reservation, _, err := ReserveSubscriptionProviderLifecycle(
		originalBindingID,
		521,
		"sub_reservation_no_longer_current",
		0,
		SubscriptionProviderLifecycleActionCancel,
		"reservation-no-longer-current-token",
		300,
	)
	require.NoError(t, err)
	require.NoError(t, DB.Create(&SubscriptionProviderBinding{
		Id:                     replacementBindingID,
		UserId:                 521,
		PlanId:                 621,
		ContractId:             contractID,
		Provider:               PaymentProviderStripe,
		ProviderSubscriptionId: "sub_reservation_replacement_current",
		ProviderStatus:         "active",
		CurrentPeriodStart:     1000,
		CurrentPeriodEnd:       2000,
	}).Error)
	require.NoError(t, DB.Model(&UserSubscriptionContract{}).Where("id = ?", contractID).
		Update("current_provider_binding_id", replacementBindingID).Error)

	updated, err := ApplyProviderSubscriptionLifecycleSnapshotStrictWithReservation(reservation, ProviderSubscriptionSnapshot{
		ProviderSubscriptionId: "sub_reservation_no_longer_current",
		ProviderStatus:         "active",
		CancelAtPeriodEnd:      true,
		CurrentPeriodStart:     1000,
		CurrentPeriodEnd:       2000,
	})

	require.ErrorIs(t, err, ErrSubscriptionProviderLifecycleConflict)
	require.Nil(t, updated)
	var stored SubscriptionProviderBinding
	require.NoError(t, DB.First(&stored, originalBindingID).Error)
	require.False(t, stored.CancelAtPeriodEnd)
	require.Equal(t, reservation.Token, stored.LifecycleReservationToken)
}

func TestApplyProviderSubscriptionLifecycleSnapshotStrictAcceptsMatchedNoOpCAS(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)
	migrateSubscriptionRecurringTestDB(t)
	insertUserForSubscriptionRecurringTest(t, 513)
	insertPlanForSubscriptionRecurringTest(t, 613, "price_recurring")
	insertOrderForSubscriptionRecurringTest(t, "recurring-order-strict-noop", 513, 613)

	binding, err := CompleteSubscriptionOrderWithProviderBinding(
		"recurring-order-strict-noop",
		"{}",
		PaymentProviderStripe,
		PaymentMethodStripe,
		stripeSnapshotForSubscriptionRecurringTest("sub_strict_noop"),
	)
	require.NoError(t, err)
	require.NoError(t, DB.Exec(fmt.Sprintf(`
		CREATE TRIGGER ignore_strict_lifecycle_noop
		BEFORE UPDATE OF cancel_at_period_end ON subscription_provider_bindings
		WHEN OLD.id = %d AND OLD.lifecycle_action_seq = %d AND NEW.cancel_at_period_end = 0
		BEGIN
			SELECT RAISE(IGNORE);
		END
	`, binding.Id, binding.LifecycleActionSeq)).Error)
	t.Cleanup(func() {
		require.NoError(t, DB.Exec("DROP TRIGGER IF EXISTS ignore_strict_lifecycle_noop").Error)
	})

	updated, err := ApplyProviderSubscriptionLifecycleSnapshotStrict(binding.Id, binding.LifecycleActionSeq, ProviderSubscriptionSnapshot{
		ProviderSubscriptionId: binding.ProviderSubscriptionId,
		ProviderStatus:         binding.ProviderStatus,
		CancelAtPeriodEnd:      binding.CancelAtPeriodEnd,
		CurrentPeriodStart:     binding.CurrentPeriodStart,
		CurrentPeriodEnd:       binding.CurrentPeriodEnd,
	})

	require.NoError(t, err)
	require.NotNil(t, updated)
	require.False(t, updated.CancelAtPeriodEnd)
	require.Equal(t, binding.LifecycleActionSeq, updated.LifecycleActionSeq)
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
	require.Equal(t, int64(1500), terminated.EndedAt)
	var terminatedEntitlement UserSubscription
	require.NoError(t, DB.Where("provider_binding_id = ?", binding.Id).First(&terminatedEntitlement).Error)
	require.Equal(t, int64(1500), terminatedEntitlement.EndTime)
	require.Greater(t, terminatedEntitlement.UpdatedAt, terminatedEntitlement.EndTime)

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
