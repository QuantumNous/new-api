package service

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupStripeSubscriptionLifecycleTestDB(t *testing.T) {
	t.Helper()
	originalDB := model.DB
	originalLogDB := model.LOG_DB
	originalRedisEnabled := common.RedisEnabled
	originalUsingSQLite := common.UsingSQLite
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalUsingMySQL := common.UsingMySQL

	dbName := strings.NewReplacer("/", "_", " ", "_").Replace(t.Name())
	db, err := gorm.Open(sqlite.Open("file:"+dbName+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(5)

	model.DB = db
	model.LOG_DB = db
	common.RedisEnabled = false
	common.UsingSQLite = true
	common.UsingPostgreSQL = false
	common.UsingMySQL = false

	t.Cleanup(func() {
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		common.RedisEnabled = originalRedisEnabled
		common.UsingSQLite = originalUsingSQLite
		common.UsingPostgreSQL = originalUsingPostgreSQL
		common.UsingMySQL = originalUsingMySQL
		require.NoError(t, sqlDB.Close())
	})

	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.Log{},
		&model.SubscriptionPlan{},
		&model.SubscriptionOrder{},
		&model.UserSubscription{},
		&model.UserSubscriptionContract{},
		&model.SubscriptionChangeIntent{},
		&model.SubscriptionProviderBinding{},
	))
}

func insertStripeLifecycleBinding(t *testing.T, userID int, status string, cancelAtPeriodEnd bool) *model.SubscriptionProviderBinding {
	return insertStripeLifecycleBindingWithSubscriptionID(t, userID, "sub_lifecycle", status, cancelAtPeriodEnd)
}

func insertStripeLifecycleBindingWithSubscriptionID(t *testing.T, userID int, providerSubscriptionID string, status string, cancelAtPeriodEnd bool) *model.SubscriptionProviderBinding {
	t.Helper()
	require.NoError(t, model.DB.Create(&model.User{
		Id:       userID,
		Username: "stripe_lifecycle_user_" + providerSubscriptionID,
		Status:   common.UserStatusEnabled,
		AffCode:  "stripe_lifecycle_aff_" + providerSubscriptionID,
	}).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:            900 + userID,
		Title:         "Lifecycle Plan",
		PriceAmount:   9.99,
		DurationUnit:  model.SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		TotalAmount:   1000,
		StripePriceId: "price_lifecycle",
	}).Error)
	binding := &model.SubscriptionProviderBinding{
		UserId:                 userID,
		PlanId:                 900 + userID,
		InitialOrderId:         1000 + userID,
		Provider:               model.PaymentProviderStripe,
		ProviderSubscriptionId: providerSubscriptionID,
		ProviderCustomerId:     "cus_lifecycle",
		ProviderPriceId:        "price_lifecycle",
		ProviderStatus:         status,
		CancelAtPeriodEnd:      cancelAtPeriodEnd,
		CurrentPeriodStart:     1000,
		CurrentPeriodEnd:       2000,
	}
	require.NoError(t, model.DB.Create(binding).Error)
	sub := &model.UserSubscription{
		UserId:            userID,
		PlanId:            binding.PlanId,
		ProviderBindingId: binding.Id,
		AmountTotal:       1000,
		StartTime:         1000,
		EndTime:           2000,
		AccessEndTime:     2000,
		Status:            "active",
		Source:            "order",
		PaymentMode:       model.SubscriptionPaymentModeStripeRecurring,
	}
	require.NoError(t, model.DB.Create(sub).Error)
	require.NoError(t, model.DB.Create(&model.UserSubscriptionContract{
		UserId:                   userID,
		Status:                   model.SubscriptionContractStatusActive,
		PaymentMode:              model.SubscriptionPaymentModeStripeRecurring,
		CurrentPlanId:            binding.PlanId,
		CurrentEntitlementId:     sub.Id,
		CurrentProviderBindingId: binding.Id,
		CurrentPeriodStart:       1000,
		CurrentPeriodEnd:         2000,
	}).Error)
	require.NoError(t, model.DB.Model(binding).Update("contract_id", gorm.Expr("(SELECT id FROM user_subscription_contracts WHERE user_id = ?)", userID)).Error)
	require.NoError(t, model.DB.Model(sub).Update("contract_id", gorm.Expr("(SELECT id FROM user_subscription_contracts WHERE user_id = ?)", userID)).Error)
	return binding
}

func seedPendingDowngradeCancelFixture(t *testing.T, userID int, scheduleID string, requestID string) (*model.SubscriptionProviderBinding, *model.UserSubscriptionContract, *model.SubscriptionChangeIntent) {
	t.Helper()
	binding := insertStripeLifecycleBinding(t, userID, "active", false)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:            binding.PlanId + 1,
		Title:         "Lifecycle Pending Downgrade Plan",
		PriceAmount:   4.99,
		DurationUnit:  model.SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		TotalAmount:   500,
		StripePriceId: "price_lifecycle_pending_downgrade",
	}).Error)
	require.NoError(t, model.DB.Model(binding).Update("provider_schedule_id", scheduleID).Error)
	binding.ProviderScheduleId = scheduleID
	var contract model.UserSubscriptionContract
	require.NoError(t, model.DB.Where("user_id = ?", userID).First(&contract).Error)
	require.NoError(t, model.DB.Model(&contract).Updates(map[string]interface{}{
		"pending_plan_id":      binding.PlanId + 1,
		"pending_effective_at": int64(2000),
	}).Error)
	contract.PendingPlanId = binding.PlanId + 1
	contract.PendingEffectiveAt = 2000
	intent := &model.SubscriptionChangeIntent{
		ContractId:         contract.Id,
		UserId:             userID,
		RequestId:          requestID,
		ChangeVersion:      1,
		Kind:               model.SubscriptionChangeIntentKindDowngrade,
		PaymentMode:        model.SubscriptionPaymentModeStripeRecurring,
		Status:             model.SubscriptionChangeIntentStatusScheduled,
		FromPlanId:         binding.PlanId,
		ToPlanId:           binding.PlanId + 1,
		ProviderBindingId:  binding.Id,
		ProviderScheduleId: scheduleID,
		EffectiveAt:        2000,
	}
	require.NoError(t, model.DB.Create(intent).Error)
	require.NoError(t, model.DB.Model(&contract).Update("latest_change_intent_id", intent.Id).Error)
	contract.LatestChangeIntentId = intent.Id
	return binding, &contract, intent
}

func TestStripeSubscriptionLifecycleCancelMarksPeriodEnd(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBinding(t, 801, "active", false)
	originalCancel := stripeUpdateSubscriptionCancelAtPeriodEnd
	t.Cleanup(func() { stripeUpdateSubscriptionCancelAtPeriodEnd = originalCancel })
	var gotSubscriptionID string
	var gotIdempotencyKey string
	stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		gotSubscriptionID = providerSubscriptionID
		gotIdempotencyKey = idempotencyKey
		require.True(t, cancelAtPeriodEnd)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderCustomerId:     "cus_lifecycle",
			ProviderPriceId:        "price_lifecycle",
			ProviderStatus:         "active",
			CancelAtPeriodEnd:      true,
			CurrentPeriodStart:     1000,
			CurrentPeriodEnd:       2000,
		}, nil
	}

	updated, err := CancelStripeRecurringSubscription(801, binding.Id)

	require.NoError(t, err)
	require.Equal(t, "sub_lifecycle", gotSubscriptionID)
	require.Contains(t, gotIdempotencyKey, "binding_")
	require.True(t, updated.CancelAtPeriodEnd)
}

func TestStripeSubscriptionLifecycleResumeClearsPeriodEnd(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBinding(t, 802, "active", true)
	originalUpdate := stripeUpdateSubscriptionCancelAtPeriodEnd
	t.Cleanup(func() { stripeUpdateSubscriptionCancelAtPeriodEnd = originalUpdate })
	stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		require.False(t, cancelAtPeriodEnd)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderCustomerId:     "cus_lifecycle",
			ProviderPriceId:        "price_lifecycle",
			ProviderStatus:         "active",
			CancelAtPeriodEnd:      false,
			CurrentPeriodStart:     1000,
			CurrentPeriodEnd:       2000,
		}, nil
	}

	updated, err := ResumeStripeRecurringSubscription(802, binding.Id)

	require.NoError(t, err)
	require.False(t, updated.CancelAtPeriodEnd)
}

func TestStripeSubscriptionLifecycleIdempotencyKeyAdvancesAfterOppositeAction(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBindingWithSubscriptionID(t, 812, "sub_lifecycle_sequence", "active", false)
	originalUpdate := stripeUpdateSubscriptionCancelAtPeriodEnd
	t.Cleanup(func() { stripeUpdateSubscriptionCancelAtPeriodEnd = originalUpdate })
	var keys []string
	stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		require.Equal(t, "sub_lifecycle_sequence", providerSubscriptionID)
		keys = append(keys, idempotencyKey)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderCustomerId:     "cus_lifecycle",
			ProviderPriceId:        "price_lifecycle",
			ProviderStatus:         "active",
			CancelAtPeriodEnd:      cancelAtPeriodEnd,
			CurrentPeriodStart:     1000,
			CurrentPeriodEnd:       2000,
		}, nil
	}

	_, err := CancelStripeRecurringSubscription(812, binding.Id)
	require.NoError(t, err)
	_, err = ResumeStripeRecurringSubscription(812, binding.Id)
	require.NoError(t, err)
	_, err = CancelStripeRecurringSubscription(812, binding.Id)
	require.NoError(t, err)

	require.Len(t, keys, 3)
	require.NotEqual(t, keys[0], keys[2])
	require.Contains(t, keys[0], "_cancel_")
	require.Contains(t, keys[2], "_cancel_")
}

func TestStripeSubscriptionLifecycleIdempotencyKeyIsStableForFailedRetry(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBindingWithSubscriptionID(t, 813, "sub_lifecycle_retry", "active", false)
	originalUpdate := stripeUpdateSubscriptionCancelAtPeriodEnd
	t.Cleanup(func() { stripeUpdateSubscriptionCancelAtPeriodEnd = originalUpdate })
	var keys []string
	stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		require.Equal(t, "sub_lifecycle_retry", providerSubscriptionID)
		require.True(t, cancelAtPeriodEnd)
		keys = append(keys, idempotencyKey)
		return model.ProviderSubscriptionSnapshot{}, assertAnErrorForAdminLifecycleTest
	}

	_, err := CancelStripeRecurringSubscription(813, binding.Id)
	require.ErrorIs(t, err, assertAnErrorForAdminLifecycleTest)
	_, err = CancelStripeRecurringSubscription(813, binding.Id)
	require.ErrorIs(t, err, assertAnErrorForAdminLifecycleTest)

	require.Len(t, keys, 2)
	require.Equal(t, keys[0], keys[1])
}

func TestStripeSubscriptionLifecycleRejectsForeignBinding(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBinding(t, 803, "active", false)
	originalUpdate := stripeUpdateSubscriptionCancelAtPeriodEnd
	t.Cleanup(func() { stripeUpdateSubscriptionCancelAtPeriodEnd = originalUpdate })
	stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		t.Fatal("ownership mismatch must perform zero remote writes")
		return model.ProviderSubscriptionSnapshot{}, nil
	}

	_, err := CancelStripeRecurringSubscription(804, binding.Id)

	require.Error(t, err)
}

func TestCancelReleasesPendingDowngradeBeforePeriodEndCancel(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBinding(t, 814, "active", false)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:            binding.PlanId + 1,
		Title:         "Lifecycle Downgrade Plan",
		PriceAmount:   4.99,
		DurationUnit:  model.SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		TotalAmount:   500,
		StripePriceId: "price_lifecycle_downgrade",
	}).Error)
	require.NoError(t, model.DB.Model(binding).Update("provider_schedule_id", "sched_cancel_pending").Error)
	var contract model.UserSubscriptionContract
	require.NoError(t, model.DB.Where("user_id = ?", 814).First(&contract).Error)
	require.NoError(t, model.DB.Model(&contract).Updates(map[string]interface{}{
		"pending_plan_id":      binding.PlanId + 1,
		"pending_effective_at": int64(2000),
	}).Error)
	intent := &model.SubscriptionChangeIntent{
		ContractId:         contract.Id,
		UserId:             814,
		RequestId:          "cancel-pending-downgrade",
		ChangeVersion:      1,
		Kind:               model.SubscriptionChangeIntentKindDowngrade,
		PaymentMode:        model.SubscriptionPaymentModeStripeRecurring,
		Status:             model.SubscriptionChangeIntentStatusScheduled,
		FromPlanId:         binding.PlanId,
		ToPlanId:           binding.PlanId + 1,
		ProviderBindingId:  binding.Id,
		ProviderScheduleId: "sched_cancel_pending",
		EffectiveAt:        2000,
	}
	require.NoError(t, model.DB.Create(intent).Error)
	require.NoError(t, model.DB.Model(&contract).Update("latest_change_intent_id", intent.Id).Error)
	originalRelease := stripeReleaseSubscriptionSchedule
	originalUpdate := stripeUpdateSubscriptionCancelAtPeriodEnd
	originalGet := stripeSubscriptionSnapshotGetter
	t.Cleanup(func() {
		stripeReleaseSubscriptionSchedule = originalRelease
		stripeUpdateSubscriptionCancelAtPeriodEnd = originalUpdate
		stripeSubscriptionSnapshotGetter = originalGet
	})
	var calls []string
	stripeReleaseSubscriptionSchedule = func(scheduleID string, idempotencyKey string) error {
		calls = append(calls, "release:"+scheduleID)
		require.Equal(t, "sched_cancel_pending", scheduleID)
		return nil
	}
	stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		calls = append(calls, "period-end")
		require.True(t, cancelAtPeriodEnd)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId:     providerSubscriptionID,
			ProviderScheduleIdObserved: true,
			ProviderStatus:             "active",
			CancelAtPeriodEnd:          true,
			CurrentPeriodStart:         1000,
			CurrentPeriodEnd:           2000,
		}, nil
	}
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		calls = append(calls, "get")
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId:     providerSubscriptionID,
			ProviderScheduleIdObserved: true,
			ProviderStatus:             "active",
			CancelAtPeriodEnd:          true,
			CurrentPeriodStart:         1000,
			CurrentPeriodEnd:           2000,
		}, nil
	}

	updated, err := CancelStripeRecurringSubscription(814, binding.Id)

	require.NoError(t, err)
	require.Equal(t, []string{"release:sched_cancel_pending", "period-end", "get"}, calls)
	require.True(t, updated.CancelAtPeriodEnd)
	var reloaded model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&reloaded, contract.Id).Error)
	require.Zero(t, reloaded.PendingPlanId)
	require.Zero(t, reloaded.PendingEffectiveAt)
	var downgraded model.SubscriptionChangeIntent
	require.NoError(t, model.DB.First(&downgraded, intent.Id).Error)
	require.Equal(t, model.SubscriptionChangeIntentStatusSuperseded, downgraded.Status)
	require.NotEmpty(t, downgraded.PreviousScheduleSnapshot)
	var entitlement model.UserSubscription
	require.NoError(t, model.DB.First(&entitlement, contract.CurrentEntitlementId).Error)
	require.Equal(t, model.SubscriptionEntitlementStatusActive, entitlement.Status)
	require.Equal(t, int64(2000), entitlement.AccessEndTime)
}

func TestCancelOwnershipMismatchPerformsZeroRemoteWrites(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBinding(t, 815, "active", false)
	require.NoError(t, model.DB.Model(binding).Update("contract_id", binding.Id+999).Error)
	originalRelease := stripeReleaseSubscriptionSchedule
	originalUpdate := stripeUpdateSubscriptionCancelAtPeriodEnd
	t.Cleanup(func() {
		stripeReleaseSubscriptionSchedule = originalRelease
		stripeUpdateSubscriptionCancelAtPeriodEnd = originalUpdate
	})
	stripeReleaseSubscriptionSchedule = func(scheduleID string, idempotencyKey string) error {
		t.Fatal("ownership mismatch must not release schedules")
		return nil
	}
	stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		t.Fatal("ownership mismatch must not update Stripe")
		return model.ProviderSubscriptionSnapshot{}, nil
	}

	_, err := CancelStripeRecurringSubscription(815, binding.Id)

	require.Error(t, err)
}

func TestCancelFailureRestoresPendingDowngradeWithoutClearingPaidAccess(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBinding(t, 816, "active", false)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:            binding.PlanId + 1,
		Title:         "Lifecycle Restore Plan",
		PriceAmount:   4.99,
		DurationUnit:  model.SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		TotalAmount:   500,
		StripePriceId: "price_lifecycle_restore",
	}).Error)
	require.NoError(t, model.DB.Model(binding).Update("provider_schedule_id", "sched_cancel_restore").Error)
	var contract model.UserSubscriptionContract
	require.NoError(t, model.DB.Where("user_id = ?", 816).First(&contract).Error)
	require.NoError(t, model.DB.Model(&contract).Updates(map[string]interface{}{
		"pending_plan_id":      binding.PlanId + 1,
		"pending_effective_at": int64(2000),
	}).Error)
	intent := &model.SubscriptionChangeIntent{
		ContractId:         contract.Id,
		UserId:             816,
		RequestId:          "cancel-failure-downgrade",
		ChangeVersion:      1,
		Kind:               model.SubscriptionChangeIntentKindDowngrade,
		PaymentMode:        model.SubscriptionPaymentModeStripeRecurring,
		Status:             model.SubscriptionChangeIntentStatusScheduled,
		FromPlanId:         binding.PlanId,
		ToPlanId:           binding.PlanId + 1,
		ProviderBindingId:  binding.Id,
		ProviderScheduleId: "sched_cancel_restore",
		EffectiveAt:        2000,
	}
	require.NoError(t, model.DB.Create(intent).Error)
	require.NoError(t, model.DB.Model(&contract).Update("latest_change_intent_id", intent.Id).Error)
	originalRelease := stripeReleaseSubscriptionSchedule
	originalUpdate := stripeUpdateSubscriptionCancelAtPeriodEnd
	originalRestore := stripeRestoreSubscriptionSchedule
	originalGet := stripeSubscriptionSnapshotGetter
	t.Cleanup(func() {
		stripeReleaseSubscriptionSchedule = originalRelease
		stripeUpdateSubscriptionCancelAtPeriodEnd = originalUpdate
		stripeRestoreSubscriptionSchedule = originalRestore
		stripeSubscriptionSnapshotGetter = originalGet
	})
	getCalls := 0
	stripeReleaseSubscriptionSchedule = func(scheduleID string, idempotencyKey string) error { return nil }
	stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		return model.ProviderSubscriptionSnapshot{}, assertAnErrorForAdminLifecycleTest
	}
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		getCalls++
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "active",
			CancelAtPeriodEnd:      false,
			CurrentPeriodStart:     1000,
			CurrentPeriodEnd:       2000,
		}, nil
	}
	stripeRestoreSubscriptionSchedule = func(rawSnapshot string, idempotencyKey string) (string, error) {
		require.Contains(t, rawSnapshot, "sched_cancel_restore")
		return "sched_cancel_restore", nil
	}

	_, err := CancelStripeRecurringSubscription(816, binding.Id)

	require.ErrorIs(t, err, assertAnErrorForAdminLifecycleTest)
	require.Equal(t, 1, getCalls)
	var reloadedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&reloadedContract, contract.Id).Error)
	require.Equal(t, binding.PlanId+1, reloadedContract.PendingPlanId)
	require.Equal(t, int64(2000), reloadedContract.PendingEffectiveAt)
	require.Equal(t, model.SubscriptionContractStatusActive, reloadedContract.Status)
	var reloadedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&reloadedBinding, binding.Id).Error)
	require.Equal(t, "sched_cancel_restore", reloadedBinding.ProviderScheduleId)
	require.False(t, reloadedBinding.CancelAtPeriodEnd)
	var entitlement model.UserSubscription
	require.NoError(t, model.DB.First(&entitlement, contract.CurrentEntitlementId).Error)
	require.Equal(t, model.SubscriptionEntitlementStatusActive, entitlement.Status)
}

func TestCancelUpdateErrorConfirmedRemoteCancelSupersedesPendingDowngrade(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding, contract, intent := seedPendingDowngradeCancelFixture(t, 818, "sched_cancel_remote_truth", "cancel-remote-truth")
	originalRelease := stripeReleaseSubscriptionSchedule
	originalUpdate := stripeUpdateSubscriptionCancelAtPeriodEnd
	originalRestore := stripeRestoreSubscriptionSchedule
	originalGet := stripeSubscriptionSnapshotGetter
	t.Cleanup(func() {
		stripeReleaseSubscriptionSchedule = originalRelease
		stripeUpdateSubscriptionCancelAtPeriodEnd = originalUpdate
		stripeRestoreSubscriptionSchedule = originalRestore
		stripeSubscriptionSnapshotGetter = originalGet
	})
	stripeReleaseSubscriptionSchedule = func(scheduleID string, idempotencyKey string) error { return nil }
	stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		return model.ProviderSubscriptionSnapshot{}, errors.New("Stripe update transport failure")
	}
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "active",
			CancelAtPeriodEnd:      true,
			CurrentPeriodStart:     1000,
			CurrentPeriodEnd:       2000,
		}, nil
	}
	stripeRestoreSubscriptionSchedule = func(rawSnapshot string, idempotencyKey string) (string, error) {
		t.Fatal("confirmed remote cancellation must not restore the downgrade schedule")
		return "", nil
	}

	updated, err := CancelStripeRecurringSubscription(818, binding.Id)
	require.NoError(t, err)
	require.True(t, updated.CancelAtPeriodEnd)
	require.NoError(t, model.DB.First(contract, contract.Id).Error)
	require.Equal(t, model.SubscriptionContractStatusActive, contract.Status)
	require.Zero(t, contract.PendingPlanId)
	require.Zero(t, contract.PendingEffectiveAt)
	require.NoError(t, model.DB.First(intent, intent.Id).Error)
	require.Equal(t, model.SubscriptionChangeIntentStatusSuperseded, intent.Status)
}

func TestCancelConfirmationUnknownMarksDowngradeForCompensationWithoutRestore(t *testing.T) {
	for _, updateSucceeds := range []bool{false, true} {
		name := "update_error"
		if updateSucceeds {
			name = "post_update_confirmation_error"
		}
		t.Run(name, func(t *testing.T) {
			setupStripeSubscriptionLifecycleTestDB(t)
			binding, contract, intent := seedPendingDowngradeCancelFixture(t, 819, "sched_cancel_unknown", "cancel-confirmation-unknown")
			originalRelease := stripeReleaseSubscriptionSchedule
			originalUpdate := stripeUpdateSubscriptionCancelAtPeriodEnd
			originalRestore := stripeRestoreSubscriptionSchedule
			originalGet := stripeSubscriptionSnapshotGetter
			t.Cleanup(func() {
				stripeReleaseSubscriptionSchedule = originalRelease
				stripeUpdateSubscriptionCancelAtPeriodEnd = originalUpdate
				stripeRestoreSubscriptionSchedule = originalRestore
				stripeSubscriptionSnapshotGetter = originalGet
			})
			stripeReleaseSubscriptionSchedule = func(scheduleID string, idempotencyKey string) error { return nil }
			stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
				if updateSucceeds {
					return model.ProviderSubscriptionSnapshot{ProviderSubscriptionId: providerSubscriptionID, ProviderStatus: "active", CancelAtPeriodEnd: true}, nil
				}
				return model.ProviderSubscriptionSnapshot{}, errors.New("Stripe update transport failure")
			}
			stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
				return model.ProviderSubscriptionSnapshot{}, errors.New("authoritative Stripe fetch unavailable")
			}
			stripeRestoreSubscriptionSchedule = func(rawSnapshot string, idempotencyKey string) (string, error) {
				t.Fatal("ambiguous cancellation must not restore a clean scheduled downgrade")
				return "", nil
			}

			_, err := CancelStripeRecurringSubscription(819, binding.Id)
			require.Error(t, err)
			require.NoError(t, model.DB.First(contract, contract.Id).Error)
			require.Equal(t, model.SubscriptionContractStatusNeedsAttention, contract.Status)
			require.Equal(t, binding.PlanId+1, contract.PendingPlanId)
			require.NoError(t, model.DB.First(intent, intent.Id).Error)
			require.Equal(t, model.SubscriptionChangeIntentStatusCompensationRequired, intent.Status)
			var reloadedBinding model.SubscriptionProviderBinding
			require.NoError(t, model.DB.First(&reloadedBinding, binding.Id).Error)
			require.Empty(t, reloadedBinding.ProviderScheduleId)
		})
	}
}

func TestCancelDowngradeCompensationReconciliationClosesAuthoritativeBranches(t *testing.T) {
	for _, cancelAtPeriodEnd := range []bool{true, false} {
		name := "cancel_confirmed"
		if !cancelAtPeriodEnd {
			name = "cancel_not_applied"
		}
		t.Run(name, func(t *testing.T) {
			setupStripeSubscriptionLifecycleTestDB(t)
			binding, contract, intent := seedPendingDowngradeCancelFixture(t, 820, "sched_cancel_reconcile", "cancel-reconcile")
			originalRelease := stripeReleaseSubscriptionSchedule
			originalUpdate := stripeUpdateSubscriptionCancelAtPeriodEnd
			originalRestore := stripeRestoreSubscriptionSchedule
			originalGet := stripeSubscriptionSnapshotGetter
			t.Cleanup(func() {
				stripeReleaseSubscriptionSchedule = originalRelease
				stripeUpdateSubscriptionCancelAtPeriodEnd = originalUpdate
				stripeRestoreSubscriptionSchedule = originalRestore
				stripeSubscriptionSnapshotGetter = originalGet
			})
			stripeReleaseSubscriptionSchedule = func(scheduleID string, idempotencyKey string) error { return nil }
			stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
				return model.ProviderSubscriptionSnapshot{}, errors.New("Stripe update transport failure")
			}
			stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
				return model.ProviderSubscriptionSnapshot{}, errors.New("initial authoritative fetch unavailable")
			}
			stripeRestoreSubscriptionSchedule = func(rawSnapshot string, idempotencyKey string) (string, error) {
				return "sched_cancel_reconciled", nil
			}
			_, err := CancelStripeRecurringSubscription(820, binding.Id)
			require.Error(t, err)

			stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
				return model.ProviderSubscriptionSnapshot{
					ProviderSubscriptionId: providerSubscriptionID,
					ProviderStatus:         "active",
					CancelAtPeriodEnd:      cancelAtPeriodEnd,
					CurrentPeriodStart:     1000,
					CurrentPeriodEnd:       2000,
				}, nil
			}
			processed, err := ReconcileCancelDowngradeCompensationRequired(context.Background(), 100)
			require.NoError(t, err)
			require.Equal(t, 1, processed)
			processed, err = ReconcileCancelDowngradeCompensationRequired(context.Background(), 100)
			require.NoError(t, err)
			require.Zero(t, processed)

			require.NoError(t, model.DB.First(contract, contract.Id).Error)
			require.Equal(t, model.SubscriptionContractStatusActive, contract.Status)
			require.NoError(t, model.DB.First(intent, intent.Id).Error)
			var reloadedBinding model.SubscriptionProviderBinding
			require.NoError(t, model.DB.First(&reloadedBinding, binding.Id).Error)
			if cancelAtPeriodEnd {
				require.Equal(t, model.SubscriptionChangeIntentStatusSuperseded, intent.Status)
				require.Zero(t, contract.PendingPlanId)
				require.True(t, reloadedBinding.CancelAtPeriodEnd)
				require.Empty(t, reloadedBinding.ProviderScheduleId)
			} else {
				require.Equal(t, model.SubscriptionChangeIntentStatusScheduled, intent.Status)
				require.Equal(t, binding.PlanId+1, contract.PendingPlanId)
				require.False(t, reloadedBinding.CancelAtPeriodEnd)
				require.Equal(t, "sched_cancel_reconciled", reloadedBinding.ProviderScheduleId)
			}
		})
	}
}

func TestCancelDowngradeCrashAfterRemoteUpdateKeepsDurableMarkerUntilReconciled(t *testing.T) {
	for _, cancelAtPeriodEnd := range []bool{true, false} {
		name := "cancel_confirmed"
		if !cancelAtPeriodEnd {
			name = "cancel_not_applied"
		}
		t.Run(name, func(t *testing.T) {
			setupStripeSubscriptionLifecycleTestDB(t)
			binding, contract, intent := seedPendingDowngradeCancelFixture(t, 821, "sched_cancel_crash", "cancel-crash-window")
			originalRelease := stripeReleaseSubscriptionSchedule
			originalUpdate := stripeUpdateSubscriptionCancelAtPeriodEnd
			originalRestore := stripeRestoreSubscriptionSchedule
			originalGet := stripeSubscriptionSnapshotGetter
			t.Cleanup(func() {
				stripeReleaseSubscriptionSchedule = originalRelease
				stripeUpdateSubscriptionCancelAtPeriodEnd = originalUpdate
				stripeRestoreSubscriptionSchedule = originalRestore
				stripeSubscriptionSnapshotGetter = originalGet
			})
			assertDurableMarker := func() {
				var markedIntent model.SubscriptionChangeIntent
				require.NoError(t, model.DB.First(&markedIntent, intent.Id).Error)
				require.Equal(t, model.SubscriptionChangeIntentStatusCompensationRequired, markedIntent.Status)
				var markedContract model.UserSubscriptionContract
				require.NoError(t, model.DB.First(&markedContract, contract.Id).Error)
				require.Equal(t, model.SubscriptionContractStatusNeedsAttention, markedContract.Status)
			}
			stripeReleaseSubscriptionSchedule = func(scheduleID string, idempotencyKey string) error {
				assertDurableMarker()
				return nil
			}
			stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
				assertDurableMarker()
				panic("simulated process crash after Stripe update")
			}
			func() {
				defer func() {
					require.Equal(t, "simulated process crash after Stripe update", recover())
				}()
				_, _ = CancelStripeRecurringSubscription(821, binding.Id)
			}()
			assertDurableMarker()

			stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
				return model.ProviderSubscriptionSnapshot{
					ProviderSubscriptionId:     providerSubscriptionID,
					ProviderScheduleIdObserved: true,
					ProviderStatus:             "active",
					CancelAtPeriodEnd:          cancelAtPeriodEnd,
					CurrentPeriodStart:         1000,
					CurrentPeriodEnd:           2000,
				}, nil
			}
			stripeRestoreSubscriptionSchedule = func(rawSnapshot string, idempotencyKey string) (string, error) {
				if cancelAtPeriodEnd {
					t.Fatal("confirmed cancellation must not restore the released downgrade")
				}
				return "sched_cancel_crash_restored", nil
			}
			processed, err := ReconcileCancelDowngradeCompensationRequired(context.Background(), 100)
			require.NoError(t, err)
			require.Equal(t, 1, processed)
			processed, err = ReconcileCancelDowngradeCompensationRequired(context.Background(), 100)
			require.NoError(t, err)
			require.Zero(t, processed)

			require.NoError(t, model.DB.First(contract, contract.Id).Error)
			require.Equal(t, model.SubscriptionContractStatusActive, contract.Status)
			require.NoError(t, model.DB.First(intent, intent.Id).Error)
			if cancelAtPeriodEnd {
				require.Equal(t, model.SubscriptionChangeIntentStatusSuperseded, intent.Status)
				require.Zero(t, contract.PendingPlanId)
			} else {
				require.Equal(t, model.SubscriptionChangeIntentStatusScheduled, intent.Status)
				require.Equal(t, binding.PlanId+1, contract.PendingPlanId)
			}
		})
	}
}

func TestResumeClearsPeriodEndCancelAndDoesNotRestoreOldDowngrade(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBinding(t, 817, "active", true)
	var contract model.UserSubscriptionContract
	require.NoError(t, model.DB.Where("user_id = ?", 817).First(&contract).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionChangeIntent{
		ContractId:               contract.Id,
		UserId:                   817,
		RequestId:                "old-downgrade",
		ChangeVersion:            1,
		Kind:                     model.SubscriptionChangeIntentKindDowngrade,
		PaymentMode:              model.SubscriptionPaymentModeStripeRecurring,
		Status:                   model.SubscriptionChangeIntentStatusSuperseded,
		FromPlanId:               binding.PlanId,
		ToPlanId:                 binding.PlanId + 1,
		ProviderBindingId:        binding.Id,
		PreviousScheduleSnapshot: `{"subscription_id":"sub_lifecycle","phases":[{"items":[{"price_id":"price_old","quantity":1}]}]}`,
	}).Error)
	originalUpdate := stripeUpdateSubscriptionCancelAtPeriodEnd
	originalRestore := stripeRestoreSubscriptionSchedule
	t.Cleanup(func() {
		stripeUpdateSubscriptionCancelAtPeriodEnd = originalUpdate
		stripeRestoreSubscriptionSchedule = originalRestore
	})
	stripeRestoreSubscriptionSchedule = func(rawSnapshot string, idempotencyKey string) (string, error) {
		t.Fatal("resume must not restore deliberately cleared downgrade")
		return "", nil
	}
	stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		require.False(t, cancelAtPeriodEnd)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "active",
			CancelAtPeriodEnd:      false,
			CurrentPeriodStart:     1000,
			CurrentPeriodEnd:       2000,
		}, nil
	}

	updated, err := ResumeStripeRecurringSubscription(817, binding.Id)

	require.NoError(t, err)
	require.False(t, updated.CancelAtPeriodEnd)
}

func TestStripeSubscriptionLifecyclePastDueCancelTerminatesLocalEntitlement(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBinding(t, 805, "past_due", false)
	originalCancelNow := stripeCancelSubscriptionNow
	t.Cleanup(func() { stripeCancelSubscriptionNow = originalCancelNow })
	stripeCancelSubscriptionNow = func(providerSubscriptionID string, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderCustomerId:     "cus_lifecycle",
			ProviderPriceId:        "price_lifecycle",
			ProviderStatus:         "canceled",
			EndedAt:                common.GetTimestamp(),
		}, nil
	}

	updated, err := CancelStripeRecurringSubscription(805, binding.Id)

	require.NoError(t, err)
	require.Equal(t, "canceled", updated.ProviderStatus)
	var sub model.UserSubscription
	require.NoError(t, model.DB.Where("provider_binding_id = ?", binding.Id).First(&sub).Error)
	require.Equal(t, "cancelled", sub.Status)
}

func TestStripeSubscriptionReconciliationSkipsSlaveNode(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	originalIsMaster := common.IsMasterNode
	originalFetch := stripeSubscriptionSnapshotForReconciliation
	t.Cleanup(func() {
		common.IsMasterNode = originalIsMaster
		stripeSubscriptionSnapshotForReconciliation = originalFetch
	})
	common.IsMasterNode = false
	stripeSubscriptionSnapshotForReconciliation = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		t.Fatal("slave node must not fetch Stripe subscriptions")
		return model.ProviderSubscriptionSnapshot{}, nil
	}

	count, err := RunStripeSubscriptionReconciliationOnce()

	require.NoError(t, err)
	require.Equal(t, 0, count)
}

func TestStripeSubscriptionReconciliationAppliesExactBindingSnapshots(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	target := insertStripeLifecycleBindingWithSubscriptionID(t, 810, "sub_reconcile_target", "active", false)
	ended := insertStripeLifecycleBindingWithSubscriptionID(t, 811, "sub_reconcile_ended", "canceled", false)
	require.NoError(t, model.DB.Model(ended).Updates(map[string]interface{}{
		"ended_at":        int64(1500),
		"provider_status": "canceled",
	}).Error)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("user_id = ?", ended.UserId).Updates(map[string]interface{}{
		"status":                      model.SubscriptionContractStatusEnded,
		"current_provider_binding_id": 0,
	}).Error)
	originalIsMaster := common.IsMasterNode
	originalFetch := stripeSubscriptionSnapshotForReconciliation
	originalReconcileInvoices := reconcileStripeInvoiceCollectionForCanceledBinding
	t.Cleanup(func() {
		common.IsMasterNode = originalIsMaster
		stripeSubscriptionSnapshotForReconciliation = originalFetch
		reconcileStripeInvoiceCollectionForCanceledBinding = originalReconcileInvoices
	})
	common.IsMasterNode = true
	var fetched []string
	stripeSubscriptionSnapshotForReconciliation = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		fetched = append(fetched, providerSubscriptionID)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderCustomerId:     "cus_lifecycle",
			ProviderStatus:         "canceled",
			EndedAt:                2500,
		}, nil
	}
	var reconciled []int64
	reconcileStripeInvoiceCollectionForCanceledBinding = func(binding model.SubscriptionProviderBinding) error {
		reconciled = append(reconciled, binding.Id)
		return nil
	}

	count, err := RunStripeSubscriptionReconciliationOnce()

	require.NoError(t, err)
	require.Equal(t, 1, count)
	require.Equal(t, []string{"sub_reconcile_target"}, fetched)
	require.Equal(t, []int64{target.Id}, reconciled)
	var updated model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&updated, target.Id).Error)
	require.Equal(t, "canceled", updated.ProviderStatus)
	var sub model.UserSubscription
	require.NoError(t, model.DB.Where("provider_binding_id = ?", target.Id).First(&sub).Error)
	require.Equal(t, "cancelled", sub.Status)
}

func TestAdminInvalidateStripeRecurringSubscriptionCancelsRemoteBeforeLocal(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBinding(t, 806, "active", false)
	sub := stripeLifecycleUserSubscriptionForBinding(t, binding.Id)
	originalCancelNow := stripeCancelSubscriptionNow
	t.Cleanup(func() { stripeCancelSubscriptionNow = originalCancelNow })
	var called bool
	stripeCancelSubscriptionNow = func(providerSubscriptionID string, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		called = true
		require.Equal(t, "sub_lifecycle", providerSubscriptionID)
		require.Contains(t, idempotencyKey, "admin_invalidate")
		var before model.UserSubscription
		require.NoError(t, model.DB.First(&before, sub.Id).Error)
		require.Equal(t, "active", before.Status)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "canceled",
			EndedAt:                common.GetTimestamp(),
		}, nil
	}

	_, err := AdminInvalidateUserSubscriptionWithRecurringPolicy(sub.Id)

	require.NoError(t, err)
	require.True(t, called)
	var updated model.UserSubscription
	require.NoError(t, model.DB.First(&updated, sub.Id).Error)
	require.Equal(t, "cancelled", updated.Status)
	var updatedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&updatedBinding, binding.Id).Error)
	require.Equal(t, "canceled", updatedBinding.ProviderStatus)
}

func TestAdminInvalidateStripeRecurringSubscriptionRemoteFailureKeepsLocalActive(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBinding(t, 807, "active", false)
	sub := stripeLifecycleUserSubscriptionForBinding(t, binding.Id)
	originalCancelNow := stripeCancelSubscriptionNow
	t.Cleanup(func() { stripeCancelSubscriptionNow = originalCancelNow })
	stripeCancelSubscriptionNow = func(providerSubscriptionID string, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		return model.ProviderSubscriptionSnapshot{}, assertAnErrorForAdminLifecycleTest
	}

	_, err := AdminInvalidateUserSubscriptionWithRecurringPolicy(sub.Id)

	require.ErrorIs(t, err, assertAnErrorForAdminLifecycleTest)
	var updated model.UserSubscription
	require.NoError(t, model.DB.First(&updated, sub.Id).Error)
	require.Equal(t, "active", updated.Status)
	var updatedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&updatedBinding, binding.Id).Error)
	require.Equal(t, "active", updatedBinding.ProviderStatus)
}

func TestAdminInvalidateNonStripeSubscriptionKeepsLocalBehavior(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	require.NoError(t, model.DB.Create(&model.User{
		Id:       808,
		Username: "local_admin_user",
		Status:   common.UserStatusEnabled,
		AffCode:  "local_admin_aff",
	}).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:            1708,
		Title:         "Local Admin Plan",
		DurationUnit:  model.SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		TotalAmount:   1000,
	}).Error)
	sub := &model.UserSubscription{
		UserId:      808,
		PlanId:      1708,
		AmountTotal: 1000,
		StartTime:   1000,
		EndTime:     2000,
		Status:      "active",
		Source:      "admin",
	}
	require.NoError(t, model.DB.Create(sub).Error)
	originalCancelNow := stripeCancelSubscriptionNow
	t.Cleanup(func() { stripeCancelSubscriptionNow = originalCancelNow })
	stripeCancelSubscriptionNow = func(providerSubscriptionID string, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		t.Fatal("non-Stripe admin invalidate must not call Stripe")
		return model.ProviderSubscriptionSnapshot{}, nil
	}

	_, err := AdminInvalidateUserSubscriptionWithRecurringPolicy(sub.Id)

	require.NoError(t, err)
	var updated model.UserSubscription
	require.NoError(t, model.DB.First(&updated, sub.Id).Error)
	require.Equal(t, "cancelled", updated.Status)
}

func TestAdminDeleteStripeRecurringSubscriptionHistoryIsRejected(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBinding(t, 809, "active", false)
	sub := stripeLifecycleUserSubscriptionForBinding(t, binding.Id)

	_, err := AdminDeleteUserSubscriptionWithRecurringPolicy(sub.Id)

	require.Error(t, err)
	var existing model.UserSubscription
	require.NoError(t, model.DB.First(&existing, sub.Id).Error)
}

var assertAnErrorForAdminLifecycleTest = errAdminLifecycleTest{}

type errAdminLifecycleTest struct{}

func (errAdminLifecycleTest) Error() string {
	return "admin lifecycle failure"
}

func stripeLifecycleUserSubscriptionForBinding(t *testing.T, bindingID int64) model.UserSubscription {
	t.Helper()
	var sub model.UserSubscription
	require.NoError(t, model.DB.Where("provider_binding_id = ?", bindingID).First(&sub).Error)
	return sub
}
