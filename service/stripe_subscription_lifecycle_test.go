package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync/atomic"
	"testing"
	"time"

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

func TestStripeSubscriptionLifecycleRoutesTerminalMutationSnapshotToTermination(t *testing.T) {
	testCases := []struct {
		name              string
		userID            int
		cancelAtPeriodEnd bool
		expectedAction    string
		invoke            func(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error)
	}{
		{name: "cancel", userID: 830, cancelAtPeriodEnd: false, expectedAction: model.SubscriptionProviderLifecycleActionCancel, invoke: CancelStripeRecurringSubscription},
		{name: "resume", userID: 831, cancelAtPeriodEnd: true, expectedAction: model.SubscriptionProviderLifecycleActionResume, invoke: ResumeStripeRecurringSubscription},
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			setupStripeSubscriptionLifecycleTestDB(t)
			binding := insertStripeLifecycleBindingWithSubscriptionID(
				t,
				testCase.userID,
				"sub_terminal_lifecycle_"+testCase.name,
				"active",
				testCase.cancelAtPeriodEnd,
			)
			originalUpdate := stripeUpdateSubscriptionCancelAtPeriodEnd
			t.Cleanup(func() { stripeUpdateSubscriptionCancelAtPeriodEnd = originalUpdate })
			stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
				return model.ProviderSubscriptionSnapshot{
					ProviderSubscriptionId: providerSubscriptionID,
					ProviderCustomerId:     "cus_lifecycle",
					ProviderPriceId:        "price_lifecycle",
					ProviderStatus:         "canceled",
					CurrentPeriodStart:     1000,
					CurrentPeriodEnd:       2000,
					EndedAt:                common.GetTimestamp(),
				}, nil
			}

			updated, err := testCase.invoke(testCase.userID, binding.Id)

			require.NoError(t, err)
			require.Equal(t, "canceled", updated.ProviderStatus)
			require.Greater(t, updated.EndedAt, int64(0))
			require.NotEmpty(t, updated.LifecycleReservationToken)
			require.Equal(t, testCase.expectedAction, updated.LifecycleReservationAction)
			require.Zero(t, updated.LifecycleReservationUntil)
			var entitlement model.UserSubscription
			require.NoError(t, model.DB.Where("provider_binding_id = ?", binding.Id).First(&entitlement).Error)
			require.Equal(t, "cancelled", entitlement.Status)
		})
	}
}

func TestStripeSubscriptionLifecycleCancelPreservesContractlessBindingCompatibility(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBindingWithSubscriptionID(t, 823, "sub_contractless_lifecycle", "active", false)
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("contract_id", 0).Error)
	originalCancel := stripeUpdateSubscriptionCancelAtPeriodEnd
	t.Cleanup(func() { stripeUpdateSubscriptionCancelAtPeriodEnd = originalCancel })
	stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		require.Equal(t, binding.ProviderSubscriptionId, providerSubscriptionID)
		require.True(t, cancelAtPeriodEnd)
		require.NotEmpty(t, idempotencyKey)
		var reserved model.SubscriptionProviderBinding
		require.NoError(t, model.DB.First(&reserved, binding.Id).Error)
		require.Zero(t, reserved.ContractId)
		require.NotEmpty(t, reserved.LifecycleReservationToken)
		require.Equal(t, model.SubscriptionProviderLifecycleActionCancel, reserved.LifecycleReservationAction)
		require.Greater(t, reserved.LifecycleReservationUntil, model.GetDBTimestamp())
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderCustomerId:     binding.ProviderCustomerId,
			ProviderPriceId:        binding.ProviderPriceId,
			ProviderStatus:         "active",
			CancelAtPeriodEnd:      true,
			CurrentPeriodStart:     binding.CurrentPeriodStart,
			CurrentPeriodEnd:       binding.CurrentPeriodEnd,
		}, nil
	}

	updated, err := CancelStripeRecurringSubscription(binding.UserId, binding.Id)

	require.NoError(t, err)
	require.True(t, updated.CancelAtPeriodEnd)
	require.Zero(t, updated.ContractId)
	require.NotEmpty(t, updated.LifecycleReservationToken)
	require.Equal(t, model.SubscriptionProviderLifecycleActionCancel, updated.LifecycleReservationAction)
	require.Zero(t, updated.LifecycleReservationUntil)
}

func TestStripeSubscriptionLifecycleResumePreservesContractlessBindingCompatibility(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBindingWithSubscriptionID(t, 857, "sub_contractless_resume_lifecycle", "active", true)
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("contract_id", 0).Error)
	originalUpdate := stripeUpdateSubscriptionCancelAtPeriodEnd
	t.Cleanup(func() { stripeUpdateSubscriptionCancelAtPeriodEnd = originalUpdate })
	stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		require.Equal(t, binding.ProviderSubscriptionId, providerSubscriptionID)
		require.False(t, cancelAtPeriodEnd)
		require.NotEmpty(t, idempotencyKey)
		var reserved model.SubscriptionProviderBinding
		require.NoError(t, model.DB.First(&reserved, binding.Id).Error)
		require.Zero(t, reserved.ContractId)
		require.NotEmpty(t, reserved.LifecycleReservationToken)
		require.Equal(t, model.SubscriptionProviderLifecycleActionResume, reserved.LifecycleReservationAction)
		require.Greater(t, reserved.LifecycleReservationUntil, model.GetDBTimestamp())
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderCustomerId:     binding.ProviderCustomerId,
			ProviderPriceId:        binding.ProviderPriceId,
			ProviderStatus:         "active",
			CancelAtPeriodEnd:      false,
			CurrentPeriodStart:     binding.CurrentPeriodStart,
			CurrentPeriodEnd:       binding.CurrentPeriodEnd,
		}, nil
	}

	updated, err := ResumeStripeRecurringSubscription(binding.UserId, binding.Id)

	require.NoError(t, err)
	require.False(t, updated.CancelAtPeriodEnd)
	require.Zero(t, updated.ContractId)
	require.NotEmpty(t, updated.LifecycleReservationToken)
	require.Equal(t, model.SubscriptionProviderLifecycleActionResume, updated.LifecycleReservationAction)
	require.Zero(t, updated.LifecycleReservationUntil)
}

func TestStripeSubscriptionLifecycleContractlessCancelKeepsReservationAndStableKeyAfterUncertainProviderError(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBindingWithSubscriptionID(t, 858, "sub_contractless_cancel_uncertain", "active", false)
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("contract_id", 0).Error)
	originalUpdate := stripeUpdateSubscriptionCancelAtPeriodEnd
	originalSnapshotGetter := stripeSubscriptionSnapshotGetter
	t.Cleanup(func() {
		stripeUpdateSubscriptionCancelAtPeriodEnd = originalUpdate
		stripeSubscriptionSnapshotGetter = originalSnapshotGetter
	})
	updateErr := errors.New("Stripe update outcome unknown")
	confirmErr := errors.New("Stripe confirmation unavailable")
	keys := make([]string, 0, 2)
	stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		require.Equal(t, binding.ProviderSubscriptionId, providerSubscriptionID)
		require.True(t, cancelAtPeriodEnd)
		keys = append(keys, idempotencyKey)
		if len(keys) == 1 {
			return model.ProviderSubscriptionSnapshot{}, updateErr
		}
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "active",
			CancelAtPeriodEnd:      true,
			CurrentPeriodStart:     binding.CurrentPeriodStart,
			CurrentPeriodEnd:       binding.CurrentPeriodEnd,
		}, nil
	}
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		require.Equal(t, binding.ProviderSubscriptionId, providerSubscriptionID)
		return model.ProviderSubscriptionSnapshot{}, confirmErr
	}

	updated, err := CancelStripeRecurringSubscription(binding.UserId, binding.Id)

	require.Nil(t, updated)
	require.ErrorIs(t, err, updateErr)
	require.Len(t, keys, 1)
	var reserved model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&reserved, binding.Id).Error)
	require.Zero(t, reserved.ContractId)
	require.NotEmpty(t, reserved.LifecycleReservationToken)
	require.Equal(t, model.SubscriptionProviderLifecycleActionCancel, reserved.LifecycleReservationAction)
	require.Greater(t, reserved.LifecycleReservationUntil, model.GetDBTimestamp())
	require.Equal(t, int64(1), reserved.LifecycleActionSeq)

	updated, err = CancelStripeRecurringSubscription(binding.UserId, binding.Id)
	require.Nil(t, updated)
	require.ErrorIs(t, err, model.ErrSubscriptionProviderLifecycleConflict)
	require.Len(t, keys, 1)

	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).
		Where("id = ?", binding.Id).
		Update("lifecycle_reservation_until", model.GetDBTimestamp()-1).Error)

	updated, err = CancelStripeRecurringSubscription(binding.UserId, binding.Id)

	require.NoError(t, err)
	require.True(t, updated.CancelAtPeriodEnd)
	require.Len(t, keys, 2)
	require.Equal(t, keys[0], keys[1])
	require.NotEmpty(t, updated.LifecycleReservationToken)
	require.Equal(t, model.SubscriptionProviderLifecycleActionCancel, updated.LifecycleReservationAction)
	require.Zero(t, updated.LifecycleReservationUntil)
}

func TestStripeSubscriptionLifecycleContractlessCancelNoopDoesNotReserve(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBindingWithSubscriptionID(t, 854, "sub_contractless_cancel_noop", "active", true)
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("contract_id", 0).Error)
	originalCancel := stripeUpdateSubscriptionCancelAtPeriodEnd
	t.Cleanup(func() { stripeUpdateSubscriptionCancelAtPeriodEnd = originalCancel })
	stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		t.Fatal("contractless cancel no-op must not call Stripe")
		return model.ProviderSubscriptionSnapshot{}, nil
	}

	updated, err := CancelStripeRecurringSubscription(binding.UserId, binding.Id)

	require.NoError(t, err)
	require.True(t, updated.CancelAtPeriodEnd)
	require.Zero(t, updated.ContractId)
	require.Empty(t, updated.LifecycleReservationToken)
	require.Zero(t, updated.LifecycleReservationUntil)
}

func TestStripeSubscriptionLifecycleContractlessResumeNoopDoesNotReserve(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBindingWithSubscriptionID(t, 855, "sub_contractless_resume_noop", "active", false)
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("contract_id", 0).Error)
	originalUpdate := stripeUpdateSubscriptionCancelAtPeriodEnd
	t.Cleanup(func() { stripeUpdateSubscriptionCancelAtPeriodEnd = originalUpdate })
	stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		t.Fatal("contractless resume no-op must not call Stripe")
		return model.ProviderSubscriptionSnapshot{}, nil
	}

	updated, err := ResumeStripeRecurringSubscription(binding.UserId, binding.Id)

	require.NoError(t, err)
	require.False(t, updated.CancelAtPeriodEnd)
	require.Zero(t, updated.ContractId)
	require.Empty(t, updated.LifecycleReservationToken)
	require.Zero(t, updated.LifecycleReservationUntil)
}

func TestStripeSubscriptionLifecycleContractlessNoopKeepsForeignReservationConflict(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBindingWithSubscriptionID(t, 856, "sub_contractless_noop_foreign", "active", true)
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).
		Where("id = ?", binding.Id).
		Updates(map[string]interface{}{
			"contract_id":                  0,
			"lifecycle_reservation_token":  "foreign-contractless-noop",
			"lifecycle_reservation_action": model.SubscriptionProviderLifecycleActionCancel,
			"lifecycle_reservation_until":  model.GetDBTimestamp() + 300,
		}).Error)

	updated, err := CancelStripeRecurringSubscription(binding.UserId, binding.Id)

	require.ErrorIs(t, err, model.ErrSubscriptionProviderLifecycleConflict)
	require.Nil(t, updated)
	var stored model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&stored, binding.Id).Error)
	require.Equal(t, "foreign-contractless-noop", stored.LifecycleReservationToken)
	require.Equal(t, model.SubscriptionProviderLifecycleActionCancel, stored.LifecycleReservationAction)
	require.Greater(t, stored.LifecycleReservationUntil, model.GetDBTimestamp())
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

func TestStripeSubscriptionLifecycleCancelConfirmsAuthoritativeStateAfterProviderError(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBindingWithSubscriptionID(t, 852, "sub_cancel_direct_timeout_confirmed", "active", false)
	originalUpdate := stripeUpdateSubscriptionCancelAtPeriodEnd
	originalGet := stripeSubscriptionSnapshotGetter
	t.Cleanup(func() {
		stripeUpdateSubscriptionCancelAtPeriodEnd = originalUpdate
		stripeSubscriptionSnapshotGetter = originalGet
	})
	stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		require.Equal(t, binding.ProviderSubscriptionId, providerSubscriptionID)
		require.True(t, cancelAtPeriodEnd)
		return model.ProviderSubscriptionSnapshot{}, errors.New("stripe update timeout")
	}
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		require.Equal(t, binding.ProviderSubscriptionId, providerSubscriptionID)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderCustomerId:     binding.ProviderCustomerId,
			ProviderPriceId:        binding.ProviderPriceId,
			ProviderStatus:         "active",
			CancelAtPeriodEnd:      true,
			CurrentPeriodStart:     binding.CurrentPeriodStart,
			CurrentPeriodEnd:       binding.CurrentPeriodEnd,
		}, nil
	}

	updated, err := CancelStripeRecurringSubscription(binding.UserId, binding.Id)

	require.NoError(t, err)
	require.NotNil(t, updated)
	require.True(t, updated.CancelAtPeriodEnd)
	require.NotEmpty(t, updated.LifecycleReservationToken)
	require.Equal(t, model.SubscriptionProviderLifecycleActionCancel, updated.LifecycleReservationAction)
	require.Zero(t, updated.LifecycleReservationUntil)
}

func TestStripeSubscriptionLifecycleResumeConfirmsAuthoritativeStateAfterProviderError(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBindingWithSubscriptionID(t, 853, "sub_resume_direct_timeout_confirmed", "active", true)
	originalUpdate := stripeUpdateSubscriptionCancelAtPeriodEnd
	originalGet := stripeSubscriptionSnapshotGetter
	t.Cleanup(func() {
		stripeUpdateSubscriptionCancelAtPeriodEnd = originalUpdate
		stripeSubscriptionSnapshotGetter = originalGet
	})
	stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		require.Equal(t, binding.ProviderSubscriptionId, providerSubscriptionID)
		require.False(t, cancelAtPeriodEnd)
		return model.ProviderSubscriptionSnapshot{}, errors.New("stripe update timeout")
	}
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		require.Equal(t, binding.ProviderSubscriptionId, providerSubscriptionID)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderCustomerId:     binding.ProviderCustomerId,
			ProviderPriceId:        binding.ProviderPriceId,
			ProviderStatus:         "active",
			CancelAtPeriodEnd:      false,
			CurrentPeriodStart:     binding.CurrentPeriodStart,
			CurrentPeriodEnd:       binding.CurrentPeriodEnd,
		}, nil
	}

	updated, err := ResumeStripeRecurringSubscription(binding.UserId, binding.Id)

	require.NoError(t, err)
	require.NotNil(t, updated)
	require.False(t, updated.CancelAtPeriodEnd)
	require.NotEmpty(t, updated.LifecycleReservationToken)
	require.Equal(t, model.SubscriptionProviderLifecycleActionResume, updated.LifecycleReservationAction)
	require.Zero(t, updated.LifecycleReservationUntil)
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

func TestStripeSubscriptionLifecycleRetainsReservationAfterFailedMutation(t *testing.T) {
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
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).
		Where("id = ?", binding.Id).
		Update("lifecycle_reservation_until", model.GetDBTimestamp()-1).Error)
	_, err = CancelStripeRecurringSubscription(813, binding.Id)
	require.ErrorIs(t, err, assertAnErrorForAdminLifecycleTest)

	require.Len(t, keys, 2)
	require.Equal(t, keys[0], keys[1])
}

func TestStripeSubscriptionLifecycleSerializesCancelBeforeResume(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBindingWithSubscriptionID(t, 822, "sub_lifecycle_stale_cancel", "active", false)
	originalUpdate := stripeUpdateSubscriptionCancelAtPeriodEnd
	t.Cleanup(func() { stripeUpdateSubscriptionCancelAtPeriodEnd = originalUpdate })

	staleCancelStarted := make(chan struct{})
	releaseStaleCancel := make(chan struct{}, 1)
	t.Cleanup(func() {
		select {
		case releaseStaleCancel <- struct{}{}:
		default:
		}
	})
	var callCount atomic.Int32
	stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		call := callCount.Add(1)
		if call == 1 {
			close(staleCancelStarted)
			<-releaseStaleCancel
		}
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "active",
			CancelAtPeriodEnd:      cancelAtPeriodEnd,
			CurrentPeriodStart:     1000,
			CurrentPeriodEnd:       2000,
		}, nil
	}

	type lifecycleResult struct {
		binding *model.SubscriptionProviderBinding
		err     error
	}
	staleCancelResult := make(chan lifecycleResult, 1)
	go func() {
		updated, err := CancelStripeRecurringSubscription(822, binding.Id)
		staleCancelResult <- lifecycleResult{binding: updated, err: err}
	}()
	select {
	case <-staleCancelStarted:
	case <-time.After(time.Second):
		t.Fatal("stale cancel did not reach the Stripe update")
	}

	_, overlappingCancelErr := CancelStripeRecurringSubscription(822, binding.Id)
	_, overlappingResumeErr := ResumeStripeRecurringSubscription(822, binding.Id)
	releaseStaleCancel <- struct{}{}

	select {
	case completed := <-staleCancelResult:
		require.NoError(t, completed.err)
		require.NotNil(t, completed.binding)
	case <-time.After(time.Second):
		t.Fatal("stale cancel did not complete")
	}
	require.ErrorIs(t, overlappingCancelErr, model.ErrSubscriptionProviderLifecycleConflict)
	require.ErrorIs(t, overlappingResumeErr, model.ErrSubscriptionProviderLifecycleConflict)
	_, err := ResumeStripeRecurringSubscription(822, binding.Id)
	require.NoError(t, err)

	var stored model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&stored, binding.Id).Error)
	require.False(t, stored.CancelAtPeriodEnd)
	require.Equal(t, int64(2), stored.LifecycleActionSeq)
}

func TestStripeSubscriptionLifecycleRejectsOppositeActionWhileReservationIsActive(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBindingWithSubscriptionID(t, 823, "sub_lifecycle_opposite_reserved", "active", false)
	originalUpdate := stripeUpdateSubscriptionCancelAtPeriodEnd
	t.Cleanup(func() { stripeUpdateSubscriptionCancelAtPeriodEnd = originalUpdate })

	cancelStarted := make(chan struct{})
	releaseCancel := make(chan struct{}, 1)
	t.Cleanup(func() {
		select {
		case releaseCancel <- struct{}{}:
		default:
		}
	})
	stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		close(cancelStarted)
		<-releaseCancel
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "active",
			CancelAtPeriodEnd:      cancelAtPeriodEnd,
			CurrentPeriodStart:     1000,
			CurrentPeriodEnd:       2000,
		}, nil
	}

	type lifecycleResult struct {
		binding *model.SubscriptionProviderBinding
		err     error
	}
	cancelResult := make(chan lifecycleResult, 1)
	go func() {
		updated, err := CancelStripeRecurringSubscription(binding.UserId, binding.Id)
		cancelResult <- lifecycleResult{binding: updated, err: err}
	}()
	select {
	case <-cancelStarted:
	case <-time.After(time.Second):
		t.Fatal("cancel did not reach the Stripe update")
	}

	updated, err := ResumeStripeRecurringSubscription(binding.UserId, binding.Id)

	require.ErrorIs(t, err, model.ErrSubscriptionProviderLifecycleConflict)
	require.Nil(t, updated)
	releaseCancel <- struct{}{}
	select {
	case completed := <-cancelResult:
		require.NoError(t, completed.err)
		require.NotNil(t, completed.binding)
	case <-time.After(time.Second):
		t.Fatal("cancel did not complete")
	}
}

func TestStripeSubscriptionLifecycleRejectsOverlappingSameActionWhileReservationIsActive(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBindingWithSubscriptionID(t, 827, "sub_lifecycle_same_action_reserved", "active", false)
	originalUpdate := stripeUpdateSubscriptionCancelAtPeriodEnd
	t.Cleanup(func() { stripeUpdateSubscriptionCancelAtPeriodEnd = originalUpdate })

	cancelStarted := make(chan struct{})
	releaseCancel := make(chan struct{}, 1)
	t.Cleanup(func() {
		select {
		case releaseCancel <- struct{}{}:
		default:
		}
	})
	var callCount atomic.Int32
	stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		if callCount.Add(1) == 1 {
			close(cancelStarted)
			<-releaseCancel
		}
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "active",
			CancelAtPeriodEnd:      cancelAtPeriodEnd,
			CurrentPeriodStart:     1000,
			CurrentPeriodEnd:       2000,
		}, nil
	}

	type lifecycleResult struct {
		binding *model.SubscriptionProviderBinding
		err     error
	}
	firstResult := make(chan lifecycleResult, 1)
	go func() {
		updated, err := CancelStripeRecurringSubscription(binding.UserId, binding.Id)
		firstResult <- lifecycleResult{binding: updated, err: err}
	}()
	select {
	case <-cancelStarted:
	case <-time.After(time.Second):
		t.Fatal("first cancel did not reach the Stripe update")
	}

	updated, err := CancelStripeRecurringSubscription(binding.UserId, binding.Id)
	releaseCancel <- struct{}{}
	var completed lifecycleResult
	select {
	case completed = <-firstResult:
	case <-time.After(time.Second):
		t.Fatal("first cancel did not complete")
	}

	require.ErrorIs(t, err, model.ErrSubscriptionProviderLifecycleConflict)
	require.Nil(t, updated)
	require.Equal(t, int32(1), callCount.Load())
	require.NoError(t, completed.err)
	require.NotNil(t, completed.binding)
}

func TestStripeSubscriptionLifecycleDirectMutationsUseStrictCAS(t *testing.T) {
	testCases := []struct {
		name              string
		cancelAtPeriodEnd bool
		invoke            func(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error)
		triggerTarget     int
	}{
		{name: "cancel", cancelAtPeriodEnd: false, invoke: CancelStripeRecurringSubscription, triggerTarget: 1},
		{name: "resume", cancelAtPeriodEnd: true, invoke: ResumeStripeRecurringSubscription, triggerTarget: 0},
	}
	for index, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			setupStripeSubscriptionLifecycleTestDB(t)
			userID := 824 + index
			binding := insertStripeLifecycleBindingWithSubscriptionID(
				t,
				userID,
				"sub_strict_direct_"+testCase.name,
				"active",
				testCase.cancelAtPeriodEnd,
			)
			originalUpdate := stripeUpdateSubscriptionCancelAtPeriodEnd
			t.Cleanup(func() { stripeUpdateSubscriptionCancelAtPeriodEnd = originalUpdate })
			stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
				return model.ProviderSubscriptionSnapshot{
					ProviderSubscriptionId: providerSubscriptionID,
					ProviderStatus:         "active",
					CancelAtPeriodEnd:      cancelAtPeriodEnd,
					CurrentPeriodStart:     1000,
					CurrentPeriodEnd:       2000,
				}, nil
			}
			triggerName := "advance_direct_seq_" + testCase.name
			require.NoError(t, model.DB.Exec(fmt.Sprintf(`
				CREATE TRIGGER %s
				BEFORE UPDATE OF cancel_at_period_end ON subscription_provider_bindings
				WHEN OLD.id = %d AND OLD.lifecycle_action_seq = %d AND NEW.cancel_at_period_end = %d
				BEGIN
					UPDATE subscription_provider_bindings
					SET cancel_at_period_end = %d,
						lifecycle_action_seq = OLD.lifecycle_action_seq + 1
					WHERE id = OLD.id;
					SELECT RAISE(IGNORE);
				END
			`, triggerName, binding.Id, binding.LifecycleActionSeq+1, testCase.triggerTarget, testCase.triggerTarget)).Error)
			t.Cleanup(func() {
				require.NoError(t, model.DB.Exec("DROP TRIGGER IF EXISTS "+triggerName).Error)
			})

			updated, err := testCase.invoke(userID, binding.Id)

			require.ErrorIs(t, err, model.ErrSubscriptionProviderLifecycleConflict)
			require.Nil(t, updated)
		})
	}
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

func TestCancelPendingDowngradeLocalPreProviderFailureReleasesReservation(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding, contract, intent := seedPendingDowngradeCancelFixture(t, 836, "sched_cancel_local_prepare_failure", "cancel-local-prepare-failure")
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).
		Where("id = ?", intent.ToPlanId).
		Update("stripe_price_id", "").Error)
	originalRelease := stripeReleaseSubscriptionSchedule
	originalUpdate := stripeUpdateSubscriptionCancelAtPeriodEnd
	t.Cleanup(func() {
		stripeReleaseSubscriptionSchedule = originalRelease
		stripeUpdateSubscriptionCancelAtPeriodEnd = originalUpdate
	})
	stripeReleaseSubscriptionSchedule = func(scheduleID string, idempotencyKey string) error {
		t.Fatal("local pre-provider failure must not release Stripe schedule")
		return nil
	}
	stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		t.Fatal("local pre-provider failure must not update Stripe subscription")
		return model.ProviderSubscriptionSnapshot{}, nil
	}

	updated, err := CancelStripeRecurringSubscription(contract.UserId, binding.Id)

	require.ErrorContains(t, err, "Stripe downgrade schedule snapshot is incomplete")
	require.Nil(t, updated)
	var reloadedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&reloadedBinding, binding.Id).Error)
	require.Empty(t, reloadedBinding.LifecycleReservationToken)
	require.Empty(t, reloadedBinding.LifecycleReservationAction)
	require.Zero(t, reloadedBinding.LifecycleReservationUntil)
	require.Equal(t, binding.ProviderScheduleId, reloadedBinding.ProviderScheduleId)
	var reloadedIntent model.SubscriptionChangeIntent
	require.NoError(t, model.DB.First(&reloadedIntent, intent.Id).Error)
	require.Equal(t, model.SubscriptionChangeIntentStatusScheduled, reloadedIntent.Status)
	var reloadedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&reloadedContract, contract.Id).Error)
	require.Equal(t, model.SubscriptionContractStatusActive, reloadedContract.Status)
}

func TestReleasePendingDowngradeRejectsSupersededLifecycleReservation(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding, contract, _ := seedPendingDowngradeCancelFixture(t, 837, "sched_cancel_superseded_owner", "cancel-superseded-owner")
	reservation, reservedBinding, err := model.ReserveSubscriptionProviderLifecycle(
		binding.Id,
		contract.UserId,
		binding.ProviderSubscriptionId,
		binding.LifecycleActionSeq,
		model.SubscriptionProviderLifecycleActionCancel,
		"cancel-original-owner",
		300,
	)
	require.NoError(t, err)
	require.NotNil(t, reservation)
	require.NotNil(t, reservedBinding)
	originalRelease := stripeReleaseSubscriptionSchedule
	t.Cleanup(func() { stripeReleaseSubscriptionSchedule = originalRelease })
	stripeReleaseSubscriptionSchedule = func(scheduleID string, idempotencyKey string) error {
		require.Equal(t, binding.ProviderScheduleId, scheduleID)
		return model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Updates(map[string]interface{}{
			"lifecycle_action_seq":         reservation.LifecycleActionSeq + 1,
			"lifecycle_reservation_token":  "cancel-replacement-owner",
			"lifecycle_reservation_action": model.SubscriptionProviderLifecycleActionCancel,
			"lifecycle_reservation_until":  model.GetDBTimestamp() + 300,
		}).Error
	}

	_, hasPendingDowngrade, err := releasePendingDowngradeBeforeCancel(reservedBinding)

	require.True(t, hasPendingDowngrade)
	require.ErrorContains(t, err, "cancel downgrade schedule binding state mismatch")
	var stored model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&stored, binding.Id).Error)
	require.Equal(t, binding.ProviderScheduleId, stored.ProviderScheduleId)
	require.Equal(t, "cancel-replacement-owner", stored.LifecycleReservationToken)
	require.Equal(t, reservation.LifecycleActionSeq+1, stored.LifecycleActionSeq)
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

func TestRestorePendingDowngradeRejectsPointerDriftBeforeRemoteRestore(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding, contract, intent := seedPendingDowngradeCancelFixture(t, 833, "sched_cancel_pre_restore_drift", "cancel-pre-restore-drift")
	require.NoError(t, model.DB.First(binding, binding.Id).Error)
	require.NoError(t, model.DB.Model(binding).Update("provider_schedule_id", "").Error)
	require.NoError(t, model.DB.Model(contract).Update("status", model.SubscriptionContractStatusNeedsAttention).Error)
	require.NoError(t, model.DB.Model(intent).Updates(map[string]interface{}{
		"status":                     model.SubscriptionChangeIntentStatusCompensationRequired,
		"previous_schedule_snapshot": `{"subscription_id":"sub_lifecycle","schedule_id":"sched_cancel_pre_restore_drift","phases":[{"items":[{"price_id":"price_lifecycle","quantity":1}]}]}`,
	}).Error)
	replacement := insertStripeLifecycleBindingWithSubscriptionID(t, 1834, "sub_replacement_before_restore", "active", false)
	require.NoError(t, model.DB.Model(contract).Updates(map[string]interface{}{
		"user_id":                     binding.UserId,
		"current_provider_binding_id": replacement.Id,
		"status":                      model.SubscriptionContractStatusNeedsAttention,
	}).Error)
	originalRestore := stripeRestoreSubscriptionSchedule
	t.Cleanup(func() { stripeRestoreSubscriptionSchedule = originalRestore })
	restoreCalls := 0
	stripeRestoreSubscriptionSchedule = func(rawSnapshot string, idempotencyKey string) (string, error) {
		restoreCalls++
		return "sched_should_not_restore", nil
	}

	err := restorePendingDowngradeAfterCancelFailure(binding, *intent, model.ProviderSubscriptionSnapshot{
		ProviderSubscriptionId:     binding.ProviderSubscriptionId,
		ProviderStatus:             "active",
		CancelAtPeriodEnd:          false,
		ProviderScheduleIdObserved: true,
	}, errors.New("cancel failed"))

	require.Error(t, err)
	require.Contains(t, err.Error(), "ownership")
	require.Zero(t, restoreCalls)
	require.NoError(t, model.DB.First(contract, contract.Id).Error)
	require.Equal(t, model.SubscriptionContractStatusNeedsAttention, contract.Status)
	require.Equal(t, replacement.Id, contract.CurrentProviderBindingId)
	require.NoError(t, model.DB.First(intent, intent.Id).Error)
	require.Equal(t, model.SubscriptionChangeIntentStatusCompensationRequired, intent.Status)
}

func TestRestorePendingDowngradeRejectsTargetDriftBeforeRemoteRestore(t *testing.T) {
	testCases := []struct {
		name   string
		mutate func(t *testing.T, contract *model.UserSubscriptionContract, intent *model.SubscriptionChangeIntent)
	}{
		{
			name: "contract_pending_effective_at",
			mutate: func(t *testing.T, contract *model.UserSubscriptionContract, intent *model.SubscriptionChangeIntent) {
				t.Helper()
				require.NoError(t, model.DB.Model(contract).Update("pending_effective_at", int64(3000)).Error)
			},
		},
		{
			name: "intent_target_plan",
			mutate: func(t *testing.T, contract *model.UserSubscriptionContract, intent *model.SubscriptionChangeIntent) {
				t.Helper()
				require.NoError(t, model.DB.Model(intent).Update("to_plan_id", intent.ToPlanId+1).Error)
			},
		},
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			setupStripeSubscriptionLifecycleTestDB(t)
			binding, contract, intent := seedPendingDowngradeCancelFixture(t, 841, "sched_cancel_pre_restore_"+testCase.name, "cancel-pre-restore-"+testCase.name)
			require.NoError(t, model.DB.First(binding, binding.Id).Error)
			require.NoError(t, model.DB.Model(binding).Update("provider_schedule_id", "").Error)
			require.NoError(t, model.DB.Model(contract).Update("status", model.SubscriptionContractStatusNeedsAttention).Error)
			require.NoError(t, model.DB.Model(intent).Updates(map[string]interface{}{
				"status":                     model.SubscriptionChangeIntentStatusCompensationRequired,
				"previous_schedule_snapshot": `{"subscription_id":"sub_lifecycle","schedule_id":"sched_cancel_pre_restore_target","phases":[{"items":[{"price_id":"price_lifecycle","quantity":1}]}]}`,
			}).Error)
			require.NoError(t, model.DB.First(intent, intent.Id).Error)
			downgrade := *intent
			testCase.mutate(t, contract, intent)
			originalRestore := stripeRestoreSubscriptionSchedule
			t.Cleanup(func() { stripeRestoreSubscriptionSchedule = originalRestore })
			restoreCalls := 0
			stripeRestoreSubscriptionSchedule = func(rawSnapshot string, idempotencyKey string) (string, error) {
				restoreCalls++
				return "sched_should_not_restore", nil
			}

			err := restorePendingDowngradeAfterCancelFailure(binding, downgrade, model.ProviderSubscriptionSnapshot{
				ProviderSubscriptionId:     binding.ProviderSubscriptionId,
				ProviderStatus:             "active",
				CancelAtPeriodEnd:          false,
				ProviderScheduleIdObserved: true,
			}, errors.New("cancel failed"))

			require.Error(t, err)
			require.Contains(t, err.Error(), "ownership")
			require.Zero(t, restoreCalls)
		})
	}
}

func TestRestorePendingDowngradeRejectsPointerDriftAfterRemoteRestore(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding, contract, intent := seedPendingDowngradeCancelFixture(t, 835, "sched_cancel_post_restore_drift", "cancel-post-restore-drift")
	require.NoError(t, model.DB.First(binding, binding.Id).Error)
	require.NoError(t, model.DB.Model(binding).Update("provider_schedule_id", "").Error)
	require.NoError(t, model.DB.Model(contract).Update("status", model.SubscriptionContractStatusNeedsAttention).Error)
	require.NoError(t, model.DB.Model(intent).Updates(map[string]interface{}{
		"status":                     model.SubscriptionChangeIntentStatusCompensationRequired,
		"previous_schedule_snapshot": `{"subscription_id":"sub_lifecycle","schedule_id":"sched_cancel_post_restore_drift","phases":[{"items":[{"price_id":"price_lifecycle","quantity":1}]}]}`,
	}).Error)
	replacement := insertStripeLifecycleBindingWithSubscriptionID(t, 1836, "sub_replacement_after_restore", "active", false)
	originalRestore := stripeRestoreSubscriptionSchedule
	originalRelease := stripeReleaseSubscriptionSchedule
	t.Cleanup(func() { stripeRestoreSubscriptionSchedule = originalRestore })
	t.Cleanup(func() { stripeReleaseSubscriptionSchedule = originalRelease })
	restoreCalls := 0
	stripeRestoreSubscriptionSchedule = func(rawSnapshot string, idempotencyKey string) (string, error) {
		restoreCalls++
		require.NoError(t, model.DB.Model(contract).Updates(map[string]interface{}{
			"current_provider_binding_id": replacement.Id,
			"status":                      model.SubscriptionContractStatusNeedsAttention,
		}).Error)
		return "sched_restored_after_pointer_drift", nil
	}
	releasedSchedule := ""
	stripeReleaseSubscriptionSchedule = func(scheduleID string, idempotencyKey string) error {
		releasedSchedule = scheduleID
		return nil
	}

	err := restorePendingDowngradeAfterCancelFailure(binding, *intent, model.ProviderSubscriptionSnapshot{
		ProviderSubscriptionId:     binding.ProviderSubscriptionId,
		ProviderStatus:             "active",
		CancelAtPeriodEnd:          false,
		ProviderScheduleIdObserved: true,
	}, errors.New("cancel failed"))

	require.Error(t, err)
	require.Contains(t, err.Error(), "ownership")
	require.Equal(t, 1, restoreCalls)
	require.Equal(t, "sched_restored_after_pointer_drift", releasedSchedule)
	require.NoError(t, model.DB.First(contract, contract.Id).Error)
	require.Equal(t, model.SubscriptionContractStatusNeedsAttention, contract.Status)
	require.Equal(t, replacement.Id, contract.CurrentProviderBindingId)
	require.NoError(t, model.DB.First(intent, intent.Id).Error)
	require.Equal(t, model.SubscriptionChangeIntentStatusCompensationRequired, intent.Status)
	var reloadedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&reloadedBinding, binding.Id).Error)
	require.Empty(t, reloadedBinding.ProviderScheduleId)
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

func TestCancelTerminalConfirmationTerminatesAndSupersedesPendingDowngrade(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding, contract, intent := seedPendingDowngradeCancelFixture(t, 832, "sched_cancel_terminal", "cancel-terminal")
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
		return model.ProviderSubscriptionSnapshot{}, errors.New("Stripe update response lost")
	}
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "canceled",
			CurrentPeriodStart:     1000,
			CurrentPeriodEnd:       2000,
			EndedAt:                common.GetTimestamp(),
		}, nil
	}
	stripeRestoreSubscriptionSchedule = func(rawSnapshot string, idempotencyKey string) (string, error) {
		t.Fatal("terminal subscription must not restore the downgrade schedule")
		return "", nil
	}

	updated, err := CancelStripeRecurringSubscription(binding.UserId, binding.Id)

	require.NoError(t, err)
	require.Equal(t, "canceled", updated.ProviderStatus)
	require.Greater(t, updated.EndedAt, int64(0))
	require.NoError(t, model.DB.First(contract, contract.Id).Error)
	require.Equal(t, model.SubscriptionContractStatusEnded, contract.Status)
	require.Zero(t, contract.CurrentProviderBindingId)
	require.Zero(t, contract.PendingPlanId)
	require.Zero(t, contract.PendingEffectiveAt)
	require.NoError(t, model.DB.First(intent, intent.Id).Error)
	require.Equal(t, model.SubscriptionChangeIntentStatusSuperseded, intent.Status)
	var entitlement model.UserSubscription
	require.NoError(t, model.DB.Where("provider_binding_id = ?", binding.Id).First(&entitlement).Error)
	require.Equal(t, "cancelled", entitlement.Status)
}

func TestCancelDowngradeCompensationRetriesTerminalCleanupAfterBindingEnded(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding, contract, intent := seedPendingDowngradeCancelFixture(t, 850, "sched_cancel_terminal_retry", "cancel-terminal-retry")
	require.NoError(t, model.DB.First(binding, binding.Id).Error)
	reservation, _, err := model.ReserveSubscriptionProviderLifecycle(
		binding.Id,
		binding.UserId,
		binding.ProviderSubscriptionId,
		binding.LifecycleActionSeq,
		model.SubscriptionProviderLifecycleActionCancel,
		"terminal-retry-owner",
		300,
	)
	require.NoError(t, err)
	_, err = model.ApplyProviderSubscriptionTerminationWithReservation(reservation, model.ProviderSubscriptionSnapshot{
		ProviderSubscriptionId: binding.ProviderSubscriptionId,
		ProviderStatus:         "canceled",
		CurrentPeriodStart:     binding.CurrentPeriodStart,
		CurrentPeriodEnd:       binding.CurrentPeriodEnd,
		EndedAt:                common.GetTimestamp(),
	})
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(contract).Updates(map[string]interface{}{
		"status": model.SubscriptionContractStatusNeedsAttention,
	}).Error)
	require.NoError(t, model.DB.Model(intent).Updates(map[string]interface{}{
		"status":     model.SubscriptionChangeIntentStatusCompensationRequired,
		"last_error": cancelDowngradeCompensationErrorPrefix + "terminal cleanup failed",
	}).Error)
	originalGet := stripeSubscriptionSnapshotGetter
	t.Cleanup(func() { stripeSubscriptionSnapshotGetter = originalGet })
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		t.Fatal("terminal local compensation retry must not re-fetch Stripe")
		return model.ProviderSubscriptionSnapshot{}, nil
	}

	err = reconcileCancelDowngradeCompensation(*intent)

	require.NoError(t, err)
	require.NoError(t, model.DB.First(contract, contract.Id).Error)
	require.Equal(t, model.SubscriptionContractStatusEnded, contract.Status)
	require.Zero(t, contract.CurrentProviderBindingId)
	require.Zero(t, contract.PendingPlanId)
	require.Zero(t, contract.PendingEffectiveAt)
	require.NoError(t, model.DB.First(intent, intent.Id).Error)
	require.Equal(t, model.SubscriptionChangeIntentStatusSuperseded, intent.Status)
	var stored model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&stored, binding.Id).Error)
	require.Greater(t, stored.EndedAt, int64(0))
}

func TestClearPendingDowngradeAfterTerminalCancelRejectsOwnershipDrift(t *testing.T) {
	testCases := []struct {
		name          string
		userID        int
		mutate        func(t *testing.T, contract *model.UserSubscriptionContract, intent *model.SubscriptionChangeIntent)
		assertState   func(t *testing.T, contract model.UserSubscriptionContract, intent model.SubscriptionChangeIntent, binding *model.SubscriptionProviderBinding)
		expectedError string
	}{
		{
			name:   "contract_status_drift",
			userID: 837,
			mutate: func(t *testing.T, contract *model.UserSubscriptionContract, intent *model.SubscriptionChangeIntent) {
				t.Helper()
				require.NoError(t, model.DB.Model(contract).Update("status", model.SubscriptionContractStatusEnded).Error)
			},
			assertState: func(t *testing.T, contract model.UserSubscriptionContract, intent model.SubscriptionChangeIntent, binding *model.SubscriptionProviderBinding) {
				t.Helper()
				require.Equal(t, model.SubscriptionContractStatusEnded, contract.Status)
				require.Equal(t, binding.Id, contract.CurrentProviderBindingId)
				require.Equal(t, binding.PlanId+1, contract.PendingPlanId)
				require.Equal(t, int64(2000), contract.PendingEffectiveAt)
				require.Equal(t, model.SubscriptionChangeIntentStatusCompensationRequired, intent.Status)
			},
			expectedError: "contract state mismatch",
		},
		{
			name:   "payment_mode_drift",
			userID: 838,
			mutate: func(t *testing.T, contract *model.UserSubscriptionContract, intent *model.SubscriptionChangeIntent) {
				t.Helper()
				require.NoError(t, model.DB.Model(contract).Update("payment_mode", model.SubscriptionPaymentModePrepaid).Error)
			},
			assertState: func(t *testing.T, contract model.UserSubscriptionContract, intent model.SubscriptionChangeIntent, binding *model.SubscriptionProviderBinding) {
				t.Helper()
				require.Equal(t, model.SubscriptionPaymentModePrepaid, contract.PaymentMode)
				require.Equal(t, model.SubscriptionContractStatusNeedsAttention, contract.Status)
				require.Equal(t, binding.Id, contract.CurrentProviderBindingId)
				require.Equal(t, binding.PlanId+1, contract.PendingPlanId)
				require.Equal(t, int64(2000), contract.PendingEffectiveAt)
				require.Equal(t, model.SubscriptionChangeIntentStatusCompensationRequired, intent.Status)
			},
			expectedError: "contract state mismatch",
		},
		{
			name:   "pending_effective_at_drift",
			userID: 839,
			mutate: func(t *testing.T, contract *model.UserSubscriptionContract, intent *model.SubscriptionChangeIntent) {
				t.Helper()
				require.NoError(t, model.DB.Model(contract).Update("pending_effective_at", int64(3000)).Error)
			},
			assertState: func(t *testing.T, contract model.UserSubscriptionContract, intent model.SubscriptionChangeIntent, binding *model.SubscriptionProviderBinding) {
				t.Helper()
				require.Equal(t, model.SubscriptionContractStatusNeedsAttention, contract.Status)
				require.Equal(t, binding.Id, contract.CurrentProviderBindingId)
				require.Equal(t, binding.PlanId+1, contract.PendingPlanId)
				require.Equal(t, int64(3000), contract.PendingEffectiveAt)
				require.Equal(t, model.SubscriptionChangeIntentStatusCompensationRequired, intent.Status)
			},
			expectedError: "contract state mismatch",
		},
		{
			name:   "intent_kind_mismatch",
			userID: 840,
			mutate: func(t *testing.T, contract *model.UserSubscriptionContract, intent *model.SubscriptionChangeIntent) {
				t.Helper()
				require.NoError(t, model.DB.Model(intent).Update("kind", model.SubscriptionChangeIntentKindUpgrade).Error)
			},
			assertState: func(t *testing.T, contract model.UserSubscriptionContract, intent model.SubscriptionChangeIntent, binding *model.SubscriptionProviderBinding) {
				t.Helper()
				require.Equal(t, model.SubscriptionContractStatusNeedsAttention, contract.Status)
				require.Equal(t, binding.Id, contract.CurrentProviderBindingId)
				require.Equal(t, binding.PlanId+1, contract.PendingPlanId)
				require.Equal(t, int64(2000), contract.PendingEffectiveAt)
				require.Equal(t, model.SubscriptionChangeIntentKindUpgrade, intent.Kind)
				require.Equal(t, model.SubscriptionChangeIntentStatusCompensationRequired, intent.Status)
			},
			expectedError: "intent state mismatch",
		},
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			setupStripeSubscriptionLifecycleTestDB(t)
			binding, contract, intent := seedPendingDowngradeCancelFixture(t, testCase.userID, "sched_terminal_fence_"+testCase.name, "terminal-fence-"+testCase.name)
			require.NoError(t, model.DB.First(binding, binding.Id).Error)
			require.NoError(t, model.DB.Model(contract).Update("status", model.SubscriptionContractStatusNeedsAttention).Error)
			require.NoError(t, model.DB.Model(intent).Update("status", model.SubscriptionChangeIntentStatusCompensationRequired).Error)
			testCase.mutate(t, contract, intent)

			err := clearPendingDowngradeAfterTerminalCancel(binding, *intent)

			require.Error(t, err)
			require.Contains(t, err.Error(), testCase.expectedError)
			var reloadedContract model.UserSubscriptionContract
			require.NoError(t, model.DB.First(&reloadedContract, contract.Id).Error)
			var reloadedIntent model.SubscriptionChangeIntent
			require.NoError(t, model.DB.First(&reloadedIntent, intent.Id).Error)
			testCase.assertState(t, reloadedContract, reloadedIntent, binding)
		})
	}
}

func TestPendingDowngradeConfirmationRejectsSameTargetLifecycleCASRace(t *testing.T) {
	for _, confirmedCancelAtPeriodEnd := range []bool{true, false} {
		name := "confirmed_resume"
		triggerTarget := 0
		if confirmedCancelAtPeriodEnd {
			name = "confirmed_cancel"
			triggerTarget = 1
		}
		t.Run(name, func(t *testing.T) {
			setupStripeSubscriptionLifecycleTestDB(t)
			binding, contract, intent := seedPendingDowngradeCancelFixture(
				t,
				823,
				"sched_cancel_strict_race_"+name,
				"cancel-strict-race-"+name,
			)
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
					CancelAtPeriodEnd:      confirmedCancelAtPeriodEnd,
					CurrentPeriodStart:     1000,
					CurrentPeriodEnd:       2000,
				}, nil
			}
			var restoreCalls int
			stripeRestoreSubscriptionSchedule = func(rawSnapshot string, idempotencyKey string) (string, error) {
				restoreCalls++
				return "sched_restored_after_race", nil
			}
			triggerName := "advance_downgrade_seq_" + name
			require.NoError(t, model.DB.Exec(fmt.Sprintf(`
				CREATE TRIGGER %s
				BEFORE UPDATE OF cancel_at_period_end ON subscription_provider_bindings
				WHEN OLD.id = %d AND OLD.lifecycle_action_seq = %d AND NEW.cancel_at_period_end = %d
				BEGIN
					UPDATE subscription_provider_bindings
					SET cancel_at_period_end = %d,
						lifecycle_action_seq = OLD.lifecycle_action_seq + 1
					WHERE id = OLD.id;
					SELECT RAISE(IGNORE);
				END
			`, triggerName, binding.Id, binding.LifecycleActionSeq+1, triggerTarget, triggerTarget)).Error)
			t.Cleanup(func() {
				require.NoError(t, model.DB.Exec("DROP TRIGGER IF EXISTS "+triggerName).Error)
			})

			updated, err := CancelStripeRecurringSubscription(contract.UserId, binding.Id)

			require.ErrorIs(t, err, model.ErrSubscriptionProviderLifecycleConflict)
			require.Nil(t, updated)
			require.Zero(t, restoreCalls)
			require.NoError(t, model.DB.First(contract, contract.Id).Error)
			require.Equal(t, binding.PlanId+1, contract.PendingPlanId)
			require.NoError(t, model.DB.First(intent, intent.Id).Error)
			require.NotEqual(t, model.SubscriptionChangeIntentStatusSuperseded, intent.Status)
		})
	}
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

func TestCancelDowngradeCompensationConsumesExpiredExactReservation(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding, contract, intent := seedPendingDowngradeCancelFixture(t, 842, "sched_cancel_expired_compensation", "cancel-expired-compensation")
	require.NoError(t, model.DB.First(binding, binding.Id).Error)
	reservation, _, err := model.ReserveSubscriptionProviderLifecycle(
		binding.Id,
		binding.UserId,
		binding.ProviderSubscriptionId,
		binding.LifecycleActionSeq,
		model.SubscriptionProviderLifecycleActionCancel,
		"expired-compensation-owner",
		300,
	)
	require.NoError(t, err)
	expiredAt := model.GetDBTimestamp() - 1
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).
		Where("id = ?", binding.Id).
		Update("lifecycle_reservation_until", expiredAt).Error)
	require.NoError(t, model.DB.Model(contract).Update("status", model.SubscriptionContractStatusNeedsAttention).Error)
	require.NoError(t, model.DB.Model(intent).Update("status", model.SubscriptionChangeIntentStatusCompensationRequired).Error)
	originalGet := stripeSubscriptionSnapshotGetter
	t.Cleanup(func() { stripeSubscriptionSnapshotGetter = originalGet })
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "active",
			CancelAtPeriodEnd:      true,
			CurrentPeriodStart:     binding.CurrentPeriodStart,
			CurrentPeriodEnd:       binding.CurrentPeriodEnd,
		}, nil
	}

	err = reconcileCancelDowngradeCompensation(*intent)

	require.NoError(t, err)
	var stored model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&stored, binding.Id).Error)
	require.True(t, stored.CancelAtPeriodEnd)
	require.Equal(t, reservation.Token, stored.LifecycleReservationToken)
	require.Equal(t, reservation.Action, stored.LifecycleReservationAction)
	require.Zero(t, stored.LifecycleReservationUntil)
}

func TestCancelDowngradeCompensationIgnoresExpiredOppositeReservation(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding, contract, intent := seedPendingDowngradeCancelFixture(t, 849, "sched_cancel_expired_resume", "cancel-expired-resume")
	require.NoError(t, model.DB.First(binding, binding.Id).Error)
	reservation, _, err := model.ReserveSubscriptionProviderLifecycle(
		binding.Id,
		binding.UserId,
		binding.ProviderSubscriptionId,
		binding.LifecycleActionSeq,
		model.SubscriptionProviderLifecycleActionResume,
		"expired-resume-owner",
		300,
	)
	require.NoError(t, err)
	expiredAt := model.GetDBTimestamp() - 1
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).
		Where("id = ?", binding.Id).
		Update("lifecycle_reservation_until", expiredAt).Error)
	require.NoError(t, model.DB.Model(contract).Update("status", model.SubscriptionContractStatusNeedsAttention).Error)
	require.NoError(t, model.DB.Model(intent).Update("status", model.SubscriptionChangeIntentStatusCompensationRequired).Error)
	originalGet := stripeSubscriptionSnapshotGetter
	t.Cleanup(func() { stripeSubscriptionSnapshotGetter = originalGet })
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "active",
			CancelAtPeriodEnd:      true,
			CurrentPeriodStart:     binding.CurrentPeriodStart,
			CurrentPeriodEnd:       binding.CurrentPeriodEnd,
		}, nil
	}

	err = reconcileCancelDowngradeCompensation(*intent)

	require.NoError(t, err)
	require.NoError(t, model.DB.First(contract, contract.Id).Error)
	require.Equal(t, model.SubscriptionContractStatusActive, contract.Status)
	require.Zero(t, contract.PendingPlanId)
	require.NoError(t, model.DB.First(intent, intent.Id).Error)
	require.Equal(t, model.SubscriptionChangeIntentStatusSuperseded, intent.Status)
	var stored model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&stored, binding.Id).Error)
	require.True(t, stored.CancelAtPeriodEnd)
	require.Equal(t, reservation.Token, stored.LifecycleReservationToken)
	require.Equal(t, reservation.Action, stored.LifecycleReservationAction)
	require.Equal(t, expiredAt, stored.LifecycleReservationUntil)
}

func TestCancelDowngradeCompensationReconciliationUsesStrictCAS(t *testing.T) {
	for _, cancelAtPeriodEnd := range []bool{true, false} {
		name := "cancel_not_applied"
		triggerTarget := 0
		if cancelAtPeriodEnd {
			name = "cancel_confirmed"
			triggerTarget = 1
		}
		t.Run(name, func(t *testing.T) {
			setupStripeSubscriptionLifecycleTestDB(t)
			binding, contract, intent := seedPendingDowngradeCancelFixture(
				t,
				826,
				"sched_reconcile_strict_"+name,
				"reconcile-strict-"+name,
			)
			require.NoError(t, model.DB.Model(contract).Update("status", model.SubscriptionContractStatusNeedsAttention).Error)
			require.NoError(t, model.DB.Model(intent).Update("status", model.SubscriptionChangeIntentStatusCompensationRequired).Error)
			contract.Status = model.SubscriptionContractStatusNeedsAttention
			intent.Status = model.SubscriptionChangeIntentStatusCompensationRequired
			originalGet := stripeSubscriptionSnapshotGetter
			originalRestore := stripeRestoreSubscriptionSchedule
			t.Cleanup(func() {
				stripeSubscriptionSnapshotGetter = originalGet
				stripeRestoreSubscriptionSchedule = originalRestore
			})
			stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
				return model.ProviderSubscriptionSnapshot{
					ProviderSubscriptionId: providerSubscriptionID,
					ProviderStatus:         "active",
					CancelAtPeriodEnd:      cancelAtPeriodEnd,
					CurrentPeriodStart:     1000,
					CurrentPeriodEnd:       2000,
				}, nil
			}
			var restoreCalls int
			stripeRestoreSubscriptionSchedule = func(rawSnapshot string, idempotencyKey string) (string, error) {
				restoreCalls++
				return "sched_restored_after_reconcile_race", nil
			}
			triggerName := "advance_reconcile_seq_" + name
			require.NoError(t, model.DB.Exec(fmt.Sprintf(`
				CREATE TRIGGER %s
				BEFORE UPDATE OF cancel_at_period_end ON subscription_provider_bindings
				WHEN OLD.id = %d AND OLD.lifecycle_action_seq = %d AND NEW.cancel_at_period_end = %d
				BEGIN
					UPDATE subscription_provider_bindings
					SET cancel_at_period_end = %d,
						lifecycle_action_seq = OLD.lifecycle_action_seq + 1
					WHERE id = OLD.id;
					SELECT RAISE(IGNORE);
				END
			`, triggerName, binding.Id, binding.LifecycleActionSeq, triggerTarget, triggerTarget)).Error)
			t.Cleanup(func() {
				require.NoError(t, model.DB.Exec("DROP TRIGGER IF EXISTS "+triggerName).Error)
			})

			err := reconcileCancelDowngradeCompensation(*intent)

			require.ErrorIs(t, err, model.ErrSubscriptionProviderLifecycleConflict)
			require.Zero(t, restoreCalls)
			require.NoError(t, model.DB.First(contract, contract.Id).Error)
			require.Equal(t, model.SubscriptionContractStatusNeedsAttention, contract.Status)
			require.NoError(t, model.DB.First(intent, intent.Id).Error)
			require.Equal(t, model.SubscriptionChangeIntentStatusCompensationRequired, intent.Status)
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

func TestCancelDowngradeTerminalApplyRetryClearsEndedBindingCompensation(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding, contract, intent := seedPendingDowngradeCancelFixture(t, 850, "sched_cancel_terminal_retry", "cancel-terminal-retry")
	originalRelease := stripeReleaseSubscriptionSchedule
	originalUpdate := stripeUpdateSubscriptionCancelAtPeriodEnd
	originalGet := stripeSubscriptionSnapshotGetter
	t.Cleanup(func() {
		stripeReleaseSubscriptionSchedule = originalRelease
		stripeUpdateSubscriptionCancelAtPeriodEnd = originalUpdate
		stripeSubscriptionSnapshotGetter = originalGet
	})
	stripeReleaseSubscriptionSchedule = func(scheduleID string, idempotencyKey string) error { return nil }
	stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		return model.ProviderSubscriptionSnapshot{}, errors.New("Stripe update transport failure")
	}
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		require.NoError(t, model.DB.Model(contract).Update("pending_effective_at", int64(9999)).Error)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "canceled",
			EndedAt:                common.GetTimestamp(),
			CurrentPeriodStart:     1000,
			CurrentPeriodEnd:       2000,
		}, nil
	}
	_, err := CancelStripeRecurringSubscription(850, binding.Id)
	require.Error(t, err)

	require.NoError(t, model.DB.Model(contract).Update("pending_effective_at", intent.EffectiveAt).Error)
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "canceled",
			EndedAt:                common.GetTimestamp(),
			CurrentPeriodStart:     1000,
			CurrentPeriodEnd:       2000,
		}, nil
	}
	processed, err := ReconcileCancelDowngradeCompensationRequired(context.Background(), 100)
	require.NoError(t, err)
	require.Equal(t, 1, processed)

	require.NoError(t, model.DB.First(contract, contract.Id).Error)
	require.Equal(t, model.SubscriptionContractStatusEnded, contract.Status)
	require.Zero(t, contract.CurrentProviderBindingId)
	require.Zero(t, contract.PendingPlanId)
	require.NoError(t, model.DB.First(intent, intent.Id).Error)
	require.Equal(t, model.SubscriptionChangeIntentStatusSuperseded, intent.Status)
	var endedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&endedBinding, binding.Id).Error)
	require.NotZero(t, endedBinding.EndedAt)
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

func TestResumeTerminalSnapshotRejectsSupersededLifecycleReservation(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBinding(t, 839, "active", true)
	original, _, err := model.ReserveSubscriptionProviderLifecycle(
		binding.Id,
		binding.UserId,
		binding.ProviderSubscriptionId,
		binding.LifecycleActionSeq,
		model.SubscriptionProviderLifecycleActionResume,
		"resume-terminal-original-owner",
		300,
	)
	require.NoError(t, err)
	expiredAt := model.GetDBTimestamp() - 10
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).
		Update("lifecycle_reservation_until", expiredAt).Error)
	original.ExpiresAt = expiredAt
	replacement, _, err := model.ReserveSubscriptionProviderLifecycle(
		binding.Id,
		binding.UserId,
		binding.ProviderSubscriptionId,
		original.LifecycleActionSeq,
		model.SubscriptionProviderLifecycleActionResume,
		"resume-terminal-replacement-owner",
		300,
	)
	require.NoError(t, err)

	updated, err := applyStripeLifecycleMutationSnapshot(original, model.ProviderSubscriptionSnapshot{
		ProviderSubscriptionId: binding.ProviderSubscriptionId,
		ProviderStatus:         "canceled",
		CurrentPeriodStart:     binding.CurrentPeriodStart,
		CurrentPeriodEnd:       binding.CurrentPeriodEnd,
		EndedAt:                common.GetTimestamp(),
	})

	require.ErrorIs(t, err, model.ErrSubscriptionProviderLifecycleConflict)
	require.Nil(t, updated)
	var stored model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&stored, binding.Id).Error)
	require.Zero(t, stored.EndedAt)
	require.Equal(t, replacement.Token, stored.LifecycleReservationToken)
	require.Equal(t, replacement.Action, stored.LifecycleReservationAction)
	require.Equal(t, replacement.ExpiresAt, stored.LifecycleReservationUntil)
}

func TestStripeSubscriptionLifecycleResumeUsesStateReadAfterReservation(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBindingWithSubscriptionID(t, 830, "sub_resume_lock_fresh_status", "active", false)
	originalUpdate := stripeUpdateSubscriptionCancelAtPeriodEnd
	t.Cleanup(func() { stripeUpdateSubscriptionCancelAtPeriodEnd = originalUpdate })
	var remoteCalls atomic.Int32
	stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		remoteCalls.Add(1)
		require.Equal(t, binding.ProviderSubscriptionId, providerSubscriptionID)
		require.False(t, cancelAtPeriodEnd)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "active",
			CancelAtPeriodEnd:      false,
			CurrentPeriodStart:     binding.CurrentPeriodStart,
			CurrentPeriodEnd:       binding.CurrentPeriodEnd,
		}, nil
	}
	callbackName := "test:cancel_after_resume_initial_read"
	var injected atomic.Bool
	var injectErr error
	require.NoError(t, model.DB.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		loaded, ok := tx.Statement.Dest.(*model.SubscriptionProviderBinding)
		if !ok || loaded.Id != binding.Id || loaded.CancelAtPeriodEnd || !injected.CompareAndSwap(false, true) {
			return
		}
		injectErr = model.DB.Model(&model.SubscriptionProviderBinding{}).
			Where("id = ?", binding.Id).
			Update("cancel_at_period_end", true).Error
	}))
	t.Cleanup(func() {
		model.DB.Callback().Query().Remove(callbackName)
	})

	updated, err := ResumeStripeRecurringSubscription(binding.UserId, binding.Id)

	require.NoError(t, injectErr)
	require.NoError(t, err)
	require.True(t, injected.Load())
	require.Equal(t, int32(1), remoteCalls.Load())
	require.False(t, updated.CancelAtPeriodEnd)
	var stored model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&stored, binding.Id).Error)
	require.False(t, stored.CancelAtPeriodEnd)
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

func TestStripeSubscriptionLifecycleCancelUsesStatusReadAfterReservation(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBindingWithSubscriptionID(t, 828, "sub_cancel_lock_fresh_status", "past_due", false)
	originalUpdate := stripeUpdateSubscriptionCancelAtPeriodEnd
	originalCancelNow := stripeCancelSubscriptionNow
	t.Cleanup(func() {
		stripeUpdateSubscriptionCancelAtPeriodEnd = originalUpdate
		stripeCancelSubscriptionNow = originalCancelNow
	})
	var periodEndCalls atomic.Int32
	var immediateCalls atomic.Int32
	stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		periodEndCalls.Add(1)
		require.Equal(t, binding.ProviderSubscriptionId, providerSubscriptionID)
		require.True(t, cancelAtPeriodEnd)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "active",
			CancelAtPeriodEnd:      true,
			CurrentPeriodStart:     binding.CurrentPeriodStart,
			CurrentPeriodEnd:       binding.CurrentPeriodEnd,
		}, nil
	}
	stripeCancelSubscriptionNow = func(providerSubscriptionID string, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		immediateCalls.Add(1)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "canceled",
			EndedAt:                common.GetTimestamp(),
		}, nil
	}
	triggerName := "refresh_cancel_status_after_reservation"
	require.NoError(t, model.DB.Exec(fmt.Sprintf(`
		CREATE TRIGGER %s
		AFTER UPDATE OF lifecycle_reservation_token ON subscription_provider_bindings
		WHEN OLD.id = %d AND NEW.lifecycle_reservation_token <> ''
		BEGIN
			UPDATE subscription_provider_bindings
			SET provider_status = 'active'
			WHERE id = OLD.id;
		END
	`, triggerName, binding.Id)).Error)
	t.Cleanup(func() {
		require.NoError(t, model.DB.Exec("DROP TRIGGER IF EXISTS "+triggerName).Error)
	})

	updated, err := CancelStripeRecurringSubscription(binding.UserId, binding.Id)

	require.NoError(t, err)
	require.Equal(t, int32(1), periodEndCalls.Load())
	require.Zero(t, immediateCalls.Load())
	require.Equal(t, "active", updated.ProviderStatus)
	require.True(t, updated.CancelAtPeriodEnd)
}

func TestStripeSubscriptionLifecycleCancelReleasesReservationWhenLockedStateIsAlreadyCanceledAtPeriodEnd(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBindingWithSubscriptionID(t, 829, "sub_cancel_lock_fresh_noop", "active", false)
	originalUpdate := stripeUpdateSubscriptionCancelAtPeriodEnd
	originalCancelNow := stripeCancelSubscriptionNow
	t.Cleanup(func() {
		stripeUpdateSubscriptionCancelAtPeriodEnd = originalUpdate
		stripeCancelSubscriptionNow = originalCancelNow
	})
	var remoteCalls atomic.Int32
	stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		remoteCalls.Add(1)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "active",
			CancelAtPeriodEnd:      true,
		}, nil
	}
	stripeCancelSubscriptionNow = func(providerSubscriptionID string, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		remoteCalls.Add(1)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "canceled",
			EndedAt:                common.GetTimestamp(),
		}, nil
	}
	triggerName := "refresh_cancel_target_after_reservation"
	require.NoError(t, model.DB.Exec(fmt.Sprintf(`
		CREATE TRIGGER %s
		AFTER UPDATE OF lifecycle_reservation_token ON subscription_provider_bindings
		WHEN OLD.id = %d AND NEW.lifecycle_reservation_token <> ''
		BEGIN
			UPDATE subscription_provider_bindings
			SET cancel_at_period_end = 1
			WHERE id = OLD.id;
		END
	`, triggerName, binding.Id)).Error)
	t.Cleanup(func() {
		require.NoError(t, model.DB.Exec("DROP TRIGGER IF EXISTS "+triggerName).Error)
	})

	updated, err := CancelStripeRecurringSubscription(binding.UserId, binding.Id)

	require.NoError(t, err)
	require.Zero(t, remoteCalls.Load())
	require.True(t, updated.CancelAtPeriodEnd)
	require.Equal(t, int64(2), updated.LifecycleActionSeq)
	require.Empty(t, updated.LifecycleReservationToken)
	require.Empty(t, updated.LifecycleReservationAction)
	require.Zero(t, updated.LifecycleReservationUntil)
}

func TestStripeSubscriptionLifecycleCancelReturnsFreshNoopAfterStaleReserveConflict(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBindingWithSubscriptionID(t, 843, "sub_cancel_stale_noop", "active", true)
	originalUpdate := stripeUpdateSubscriptionCancelAtPeriodEnd
	originalCancelNow := stripeCancelSubscriptionNow
	t.Cleanup(func() {
		stripeUpdateSubscriptionCancelAtPeriodEnd = originalUpdate
		stripeCancelSubscriptionNow = originalCancelNow
	})
	var remoteCalls atomic.Int32
	stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		remoteCalls.Add(1)
		return model.ProviderSubscriptionSnapshot{ProviderSubscriptionId: providerSubscriptionID, ProviderStatus: "active", CancelAtPeriodEnd: cancelAtPeriodEnd}, nil
	}
	stripeCancelSubscriptionNow = func(providerSubscriptionID string, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		remoteCalls.Add(1)
		return model.ProviderSubscriptionSnapshot{ProviderSubscriptionId: providerSubscriptionID, ProviderStatus: "canceled", EndedAt: common.GetTimestamp()}, nil
	}
	staleRead := make(chan struct{})
	releaseStale := make(chan struct{})
	var blocked atomic.Bool
	var released atomic.Bool
	callbackName := "block_cancel_stale_noop_initial_read"
	require.NoError(t, model.DB.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		loaded, ok := tx.Statement.Dest.(*model.SubscriptionProviderBinding)
		if !ok || loaded.Id != binding.Id || !blocked.CompareAndSwap(false, true) {
			return
		}
		close(staleRead)
		<-releaseStale
	}))
	t.Cleanup(func() {
		if released.CompareAndSwap(false, true) {
			close(releaseStale)
		}
		model.DB.Callback().Query().Remove(callbackName)
	})

	type lifecycleResult struct {
		binding *model.SubscriptionProviderBinding
		err     error
	}
	staleResult := make(chan lifecycleResult, 1)
	go func() {
		updated, err := CancelStripeRecurringSubscription(binding.UserId, binding.Id)
		staleResult <- lifecycleResult{binding: updated, err: err}
	}()
	select {
	case <-staleRead:
	case <-time.After(time.Second):
		t.Fatal("stale cancel did not read the initial binding")
	}
	fresh, err := CancelStripeRecurringSubscription(binding.UserId, binding.Id)
	require.NoError(t, err)
	require.True(t, fresh.CancelAtPeriodEnd)
	require.Equal(t, int64(2), fresh.LifecycleActionSeq)
	if released.CompareAndSwap(false, true) {
		close(releaseStale)
	}

	select {
	case completed := <-staleResult:
		require.NoError(t, completed.err)
		require.NotNil(t, completed.binding)
		require.True(t, completed.binding.CancelAtPeriodEnd)
	case <-time.After(time.Second):
		t.Fatal("stale cancel did not complete")
	}
	require.Zero(t, remoteCalls.Load())
}

func TestStripeSubscriptionLifecycleResumeReturnsFreshNoopAfterStaleReserveConflict(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBindingWithSubscriptionID(t, 844, "sub_resume_stale_noop", "active", false)
	originalUpdate := stripeUpdateSubscriptionCancelAtPeriodEnd
	t.Cleanup(func() { stripeUpdateSubscriptionCancelAtPeriodEnd = originalUpdate })
	var remoteCalls atomic.Int32
	stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		remoteCalls.Add(1)
		return model.ProviderSubscriptionSnapshot{ProviderSubscriptionId: providerSubscriptionID, ProviderStatus: "active", CancelAtPeriodEnd: cancelAtPeriodEnd}, nil
	}
	staleRead := make(chan struct{})
	releaseStale := make(chan struct{})
	var blocked atomic.Bool
	var released atomic.Bool
	callbackName := "block_resume_stale_noop_initial_read"
	require.NoError(t, model.DB.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		loaded, ok := tx.Statement.Dest.(*model.SubscriptionProviderBinding)
		if !ok || loaded.Id != binding.Id || !blocked.CompareAndSwap(false, true) {
			return
		}
		close(staleRead)
		<-releaseStale
	}))
	t.Cleanup(func() {
		if released.CompareAndSwap(false, true) {
			close(releaseStale)
		}
		model.DB.Callback().Query().Remove(callbackName)
	})

	type lifecycleResult struct {
		binding *model.SubscriptionProviderBinding
		err     error
	}
	staleResult := make(chan lifecycleResult, 1)
	go func() {
		updated, err := ResumeStripeRecurringSubscription(binding.UserId, binding.Id)
		staleResult <- lifecycleResult{binding: updated, err: err}
	}()
	select {
	case <-staleRead:
	case <-time.After(time.Second):
		t.Fatal("stale resume did not read the initial binding")
	}
	fresh, err := ResumeStripeRecurringSubscription(binding.UserId, binding.Id)
	require.NoError(t, err)
	require.False(t, fresh.CancelAtPeriodEnd)
	require.Equal(t, int64(2), fresh.LifecycleActionSeq)
	if released.CompareAndSwap(false, true) {
		close(releaseStale)
	}

	select {
	case completed := <-staleResult:
		require.NoError(t, completed.err)
		require.NotNil(t, completed.binding)
		require.False(t, completed.binding.CancelAtPeriodEnd)
	case <-time.After(time.Second):
		t.Fatal("stale resume did not complete")
	}
	require.Zero(t, remoteCalls.Load())
}

func TestStripeSubscriptionLifecycleCancelKeepsStaleNoopConflictForActiveOppositeReservation(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBindingWithSubscriptionID(t, 845, "sub_cancel_stale_opposite", "active", true)
	staleRead := make(chan struct{})
	releaseStale := make(chan struct{})
	var blocked atomic.Bool
	var released atomic.Bool
	callbackName := "block_cancel_stale_opposite_initial_read"
	require.NoError(t, model.DB.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		loaded, ok := tx.Statement.Dest.(*model.SubscriptionProviderBinding)
		if !ok || loaded.Id != binding.Id || !blocked.CompareAndSwap(false, true) {
			return
		}
		close(staleRead)
		<-releaseStale
	}))
	t.Cleanup(func() {
		if released.CompareAndSwap(false, true) {
			close(releaseStale)
		}
		model.DB.Callback().Query().Remove(callbackName)
	})
	errs := make(chan error, 1)
	go func() {
		_, err := CancelStripeRecurringSubscription(binding.UserId, binding.Id)
		errs <- err
	}()
	select {
	case <-staleRead:
	case <-time.After(time.Second):
		t.Fatal("stale cancel did not read the initial binding")
	}
	_, _, err := model.ReserveSubscriptionProviderLifecycle(
		binding.Id,
		binding.UserId,
		binding.ProviderSubscriptionId,
		binding.LifecycleActionSeq,
		model.SubscriptionProviderLifecycleActionResume,
		"active-opposite-resume-owner",
		300,
	)
	require.NoError(t, err)
	if released.CompareAndSwap(false, true) {
		close(releaseStale)
	}

	select {
	case err := <-errs:
		require.ErrorIs(t, err, model.ErrSubscriptionProviderLifecycleConflict)
	case <-time.After(time.Second):
		t.Fatal("stale cancel did not complete")
	}
}

func TestStripeSubscriptionLifecycleCancelReturnsTerminalAfterStalePastDueReserveConflict(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBindingWithSubscriptionID(t, 848, "sub_cancel_stale_past_due_terminal", "past_due", false)
	originalUpdate := stripeUpdateSubscriptionCancelAtPeriodEnd
	originalCancelNow := stripeCancelSubscriptionNow
	t.Cleanup(func() {
		stripeUpdateSubscriptionCancelAtPeriodEnd = originalUpdate
		stripeCancelSubscriptionNow = originalCancelNow
	})
	var periodEndCalls atomic.Int32
	var immediateCalls atomic.Int32
	stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		periodEndCalls.Add(1)
		return model.ProviderSubscriptionSnapshot{ProviderSubscriptionId: providerSubscriptionID, ProviderStatus: "active", CancelAtPeriodEnd: cancelAtPeriodEnd}, nil
	}
	stripeCancelSubscriptionNow = func(providerSubscriptionID string, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		immediateCalls.Add(1)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "canceled",
			EndedAt:                common.GetTimestamp(),
		}, nil
	}
	staleRead := make(chan struct{})
	releaseStale := make(chan struct{})
	var blocked atomic.Bool
	var released atomic.Bool
	callbackName := "block_cancel_stale_past_due_initial_read"
	require.NoError(t, model.DB.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		loaded, ok := tx.Statement.Dest.(*model.SubscriptionProviderBinding)
		if !ok || loaded.Id != binding.Id || !blocked.CompareAndSwap(false, true) {
			return
		}
		close(staleRead)
		<-releaseStale
	}))
	t.Cleanup(func() {
		if released.CompareAndSwap(false, true) {
			close(releaseStale)
		}
		model.DB.Callback().Query().Remove(callbackName)
	})

	type lifecycleResult struct {
		binding *model.SubscriptionProviderBinding
		err     error
	}
	staleResult := make(chan lifecycleResult, 1)
	go func() {
		updated, err := CancelStripeRecurringSubscription(binding.UserId, binding.Id)
		staleResult <- lifecycleResult{binding: updated, err: err}
	}()
	select {
	case <-staleRead:
	case <-time.After(time.Second):
		t.Fatal("stale cancel did not read the initial past_due binding")
	}
	fresh, err := CancelStripeRecurringSubscription(binding.UserId, binding.Id)
	require.NoError(t, err)
	require.Equal(t, "canceled", fresh.ProviderStatus)
	require.NotZero(t, fresh.EndedAt)
	if released.CompareAndSwap(false, true) {
		close(releaseStale)
	}

	select {
	case completed := <-staleResult:
		require.NoError(t, completed.err)
		require.NotNil(t, completed.binding)
		require.Equal(t, "canceled", completed.binding.ProviderStatus)
		require.NotZero(t, completed.binding.EndedAt)
	case <-time.After(time.Second):
		t.Fatal("stale cancel did not complete")
	}
	require.Equal(t, int32(1), immediateCalls.Load())
	require.Zero(t, periodEndCalls.Load())
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

func TestAdminInvalidateStripeRecurringSubscriptionCancelsNeedsAttentionContract(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBinding(t, 823, "active", false)
	sub := stripeLifecycleUserSubscriptionForBinding(t, binding.Id)
	var contract model.UserSubscriptionContract
	require.NoError(t, model.DB.Where("user_id = ?", binding.UserId).First(&contract).Error)
	require.NoError(t, model.DB.Model(&contract).
		Update("status", model.SubscriptionContractStatusNeedsAttention).Error)
	originalCancelNow := stripeCancelSubscriptionNow
	t.Cleanup(func() { stripeCancelSubscriptionNow = originalCancelNow })
	var called bool
	stripeCancelSubscriptionNow = func(providerSubscriptionID string, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		called = true
		require.Equal(t, binding.ProviderSubscriptionId, providerSubscriptionID)
		require.Contains(t, idempotencyKey, "admin_invalidate")
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

func TestAdminInvalidateStripeRecurringSubscriptionFallsBackAfterCurrentBindingDrift(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBindingWithSubscriptionID(t, 846, "sub_admin_terminal_drift", "active", false)
	sub := stripeLifecycleUserSubscriptionForBinding(t, binding.Id)
	var contract model.UserSubscriptionContract
	require.NoError(t, model.DB.Where("user_id = ?", binding.UserId).First(&contract).Error)
	originalCancelNow := stripeCancelSubscriptionNow
	t.Cleanup(func() { stripeCancelSubscriptionNow = originalCancelNow })
	var called bool
	stripeCancelSubscriptionNow = func(providerSubscriptionID string, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		called = true
		require.Equal(t, binding.ProviderSubscriptionId, providerSubscriptionID)
		require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).
			Where("id = ?", contract.Id).
			Update("current_provider_binding_id", int64(0)).Error)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "canceled",
			EndedAt:                common.GetTimestamp(),
		}, nil
	}

	_, err := AdminInvalidateUserSubscriptionWithRecurringPolicy(sub.Id)

	require.NoError(t, err)
	require.True(t, called)
	var updatedSub model.UserSubscription
	require.NoError(t, model.DB.First(&updatedSub, sub.Id).Error)
	require.Equal(t, "cancelled", updatedSub.Status)
	var updatedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&updatedBinding, binding.Id).Error)
	require.Equal(t, "canceled", updatedBinding.ProviderStatus)
	require.NotZero(t, updatedBinding.EndedAt)
}

func TestAdminInvalidateStripeRecurringSubscriptionFallbackFailureKeepsStrictError(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBindingWithSubscriptionID(t, 847, "sub_admin_terminal_fallback_failure", "active", false)
	sub := stripeLifecycleUserSubscriptionForBinding(t, binding.Id)
	var contract model.UserSubscriptionContract
	require.NoError(t, model.DB.Where("user_id = ?", binding.UserId).First(&contract).Error)
	originalCancelNow := stripeCancelSubscriptionNow
	t.Cleanup(func() { stripeCancelSubscriptionNow = originalCancelNow })
	triggerName := "reject_admin_terminal_passive_fallback"
	require.NoError(t, model.DB.Exec(fmt.Sprintf(`
		CREATE TRIGGER %s
		BEFORE UPDATE OF provider_status ON subscription_provider_bindings
		WHEN OLD.id = %d AND NEW.provider_status = 'canceled'
		BEGIN
			SELECT RAISE(FAIL, 'passive fallback blocked');
		END
	`, triggerName, binding.Id)).Error)
	t.Cleanup(func() {
		require.NoError(t, model.DB.Exec("DROP TRIGGER IF EXISTS "+triggerName).Error)
	})
	stripeCancelSubscriptionNow = func(providerSubscriptionID string, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		require.Equal(t, binding.ProviderSubscriptionId, providerSubscriptionID)
		require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).
			Where("id = ?", contract.Id).
			Update("current_provider_binding_id", int64(0)).Error)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "canceled",
			EndedAt:                common.GetTimestamp(),
		}, nil
	}

	_, err := AdminInvalidateUserSubscriptionWithRecurringPolicy(sub.Id)

	require.ErrorIs(t, err, model.ErrSubscriptionProviderLifecycleConflict)
	require.ErrorContains(t, err, "passive terminal fallback failed")
	var updatedSub model.UserSubscription
	require.NoError(t, model.DB.First(&updatedSub, sub.Id).Error)
	require.Equal(t, "active", updatedSub.Status)
	var updatedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&updatedBinding, binding.Id).Error)
	require.Equal(t, "active", updatedBinding.ProviderStatus)
}

func TestAdminInvalidateStripeRecurringSubscriptionKeepsForeignReservationConflict(t *testing.T) {
	setupStripeSubscriptionLifecycleTestDB(t)
	binding := insertStripeLifecycleBindingWithSubscriptionID(t, 851, "sub_admin_foreign_reservation", "active", false)
	sub := stripeLifecycleUserSubscriptionForBinding(t, binding.Id)
	originalCancelNow := stripeCancelSubscriptionNow
	t.Cleanup(func() { stripeCancelSubscriptionNow = originalCancelNow })
	stripeCancelSubscriptionNow = func(providerSubscriptionID string, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		require.Equal(t, binding.ProviderSubscriptionId, providerSubscriptionID)
		require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).
			Where("id = ?", binding.Id).
			Updates(map[string]interface{}{
				"lifecycle_reservation_token":  "foreign-terminal-owner",
				"lifecycle_reservation_action": model.SubscriptionProviderLifecycleActionCancel,
				"lifecycle_reservation_until":  model.GetDBTimestamp() + 300,
			}).Error)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "canceled",
			EndedAt:                common.GetTimestamp(),
		}, nil
	}

	_, err := AdminInvalidateUserSubscriptionWithRecurringPolicy(sub.Id)

	require.ErrorIs(t, err, model.ErrSubscriptionProviderLifecycleConflict)
	var updatedSub model.UserSubscription
	require.NoError(t, model.DB.First(&updatedSub, sub.Id).Error)
	require.Equal(t, "active", updatedSub.Status)
	var updatedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&updatedBinding, binding.Id).Error)
	require.Equal(t, "active", updatedBinding.ProviderStatus)
	require.Zero(t, updatedBinding.EndedAt)
	require.Equal(t, "foreign-terminal-owner", updatedBinding.LifecycleReservationToken)
	require.Equal(t, model.SubscriptionProviderLifecycleActionCancel, updatedBinding.LifecycleReservationAction)
	require.Greater(t, updatedBinding.LifecycleReservationUntil, model.GetDBTimestamp())
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
