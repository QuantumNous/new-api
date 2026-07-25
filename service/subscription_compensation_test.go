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

func setupSubscriptionCompensationTestDB(t *testing.T) {
	t.Helper()
	originalDB := model.DB
	originalLogDB := model.LOG_DB
	originalRedisEnabled := common.RedisEnabled
	originalUsingSQLite := common.UsingSQLite
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalUsingMySQL := common.UsingMySQL
	originalQuotaPerUnit := common.QuotaPerUnit

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
	common.QuotaPerUnit = 100

	t.Cleanup(func() {
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		common.RedisEnabled = originalRedisEnabled
		common.UsingSQLite = originalUsingSQLite
		common.UsingPostgreSQL = originalUsingPostgreSQL
		common.UsingMySQL = originalUsingMySQL
		common.QuotaPerUnit = originalQuotaPerUnit
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

type stripeToBalanceFixture struct {
	user               *model.User
	current            model.SubscriptionPlan
	target             model.SubscriptionPlan
	contract           *model.UserSubscriptionContract
	binding            *model.SubscriptionProviderBinding
	currentEntitlement *model.UserSubscription
}

func seedStripeToBalanceFixture(t *testing.T, userID int, currentRank int, targetRank int) stripeToBalanceFixture {
	t.Helper()
	current := insertCompensationPlan(t, 10000+userID, currentRank, 10, 1000, "price_current")
	target := insertCompensationPlan(t, 11000+userID, targetRank, 30, 3000, "")
	user := &model.User{
		Id:       userID,
		Username: "comp_user",
		Status:   common.UserStatusEnabled,
		Quota:    10000,
		AffCode:  "comp_aff",
	}
	require.NoError(t, model.DB.Create(user).Error)
	binding := &model.SubscriptionProviderBinding{
		UserId:                     userID,
		PlanId:                     current.Id,
		InitialOrderId:             1,
		Provider:                   model.PaymentProviderStripe,
		ProviderSubscriptionId:     "sub_comp",
		ProviderSubscriptionItemId: "si_comp",
		ProviderScheduleId:         "sched_comp",
		ProviderCustomerId:         "cus_comp",
		ProviderPriceId:            current.StripePriceId,
		ProviderStatus:             "active",
		CurrentPeriodStart:         1000,
		CurrentPeriodEnd:           2000,
	}
	require.NoError(t, model.DB.Create(binding).Error)
	currentSlot := 1
	grantKey := "stripe:current"
	entitlement := &model.UserSubscription{
		UserId:            userID,
		PlanId:            current.Id,
		ProviderBindingId: binding.Id,
		GrantKey:          &grantKey,
		CurrentSlot:       &currentSlot,
		AmountTotal:       current.TotalAmount,
		StartTime:         1000,
		EndTime:           2000,
		AccessEndTime:     2000,
		Status:            model.SubscriptionEntitlementStatusActive,
		Source:            model.PaymentMethodStripe,
		PaymentMode:       model.SubscriptionPaymentModeStripeRecurring,
	}
	require.NoError(t, model.DB.Create(entitlement).Error)
	contract := &model.UserSubscriptionContract{
		UserId:                   userID,
		Status:                   model.SubscriptionContractStatusActive,
		PaymentMode:              model.SubscriptionPaymentModeStripeRecurring,
		CurrentPlanId:            current.Id,
		CurrentEntitlementId:     entitlement.Id,
		CurrentProviderBindingId: binding.Id,
		CurrentPeriodStart:       1000,
		CurrentPeriodEnd:         2000,
		ChangeVersion:            1,
	}
	require.NoError(t, model.DB.Create(contract).Error)
	require.NoError(t, model.DB.Model(binding).Update("contract_id", contract.Id).Error)
	require.NoError(t, model.DB.Model(entitlement).Update("contract_id", contract.Id).Error)
	return stripeToBalanceFixture{
		user:               user,
		current:            current,
		target:             target,
		contract:           contract,
		binding:            binding,
		currentEntitlement: entitlement,
	}
}

func insertCompensationPlan(t *testing.T, id int, rank int, price float64, total int64, stripePriceID string) model.SubscriptionPlan {
	t.Helper()
	allowBalance := true
	plan := model.SubscriptionPlan{
		Id:              id,
		Title:           "Comp Plan",
		PriceAmount:     price,
		Currency:        "USD",
		DurationUnit:    model.SubscriptionDurationMonth,
		DurationValue:   1,
		Enabled:         true,
		TierRank:        &rank,
		AllowBalancePay: &allowBalance,
		TotalAmount:     total,
		StripePriceId:   stripePriceID,
	}
	require.NoError(t, model.DB.Create(&plan).Error)
	return plan
}

func replaceCompensationHooks(t *testing.T) {
	t.Helper()
	originalRelease := stripeReleaseSubscriptionSchedule
	originalRestore := stripeRestoreSubscriptionSchedule
	originalCancel := stripeCancelSubscriptionImmediately
	originalGet := stripeSubscriptionSnapshotGetter
	t.Cleanup(func() {
		stripeReleaseSubscriptionSchedule = originalRelease
		stripeRestoreSubscriptionSchedule = originalRestore
		stripeCancelSubscriptionImmediately = originalCancel
		stripeSubscriptionSnapshotGetter = originalGet
	})
}

func TestStripeToBalanceUnknownCancelDoesNotRefundOrGrant(t *testing.T) {
	setupSubscriptionCompensationTestDB(t)
	fx := seedStripeToBalanceFixture(t, 9001, 1, 2)
	replaceCompensationHooks(t)
	stripeReleaseSubscriptionSchedule = func(scheduleID string, idempotencyKey string) error { return nil }
	stripeCancelSubscriptionImmediately = func(providerSubscriptionID string, idempotencyKey string) error {
		return nil
	}
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		return model.ProviderSubscriptionSnapshot{}, errors.New("unknown cancel result")
	}

	_, err := ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:      fx.user.Id,
		PlanID:      fx.target.Id,
		PaymentMode: model.SubscriptionPaymentModeBalanceOnePeriod,
		RequestID:   "stripe-to-balance-unknown",
	})

	require.Error(t, err)
	assertStripeToBalanceNoRefundOrGrant(t, fx)
	var intent model.SubscriptionChangeIntent
	require.NoError(t, model.DB.Where("request_id = ?", "stripe-to-balance-unknown").First(&intent).Error)
	require.Equal(t, model.SubscriptionChangeIntentStatusCompensationRequired, intent.Status)
	require.NotEmpty(t, intent.WalletDebitTradeNo)
	var contract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&contract, fx.contract.Id).Error)
	require.Equal(t, model.SubscriptionContractStatusNeedsAttention, contract.Status)
}

func TestStripeToBalanceConfirmedActiveRestoresScheduleAndRefundsExactlyOnce(t *testing.T) {
	setupSubscriptionCompensationTestDB(t)
	fx := seedStripeToBalanceFixture(t, 9002, 1, 2)
	replaceCompensationHooks(t)
	var refunds int64
	stripeReleaseSubscriptionSchedule = func(scheduleID string, idempotencyKey string) error { return nil }
	stripeRestoreSubscriptionSchedule = func(rawSnapshot string, idempotencyKey string) (string, error) { return "sched_restored", nil }
	stripeCancelSubscriptionImmediately = func(providerSubscriptionID string, idempotencyKey string) error { return nil }
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId:     providerSubscriptionID,
			ProviderScheduleId:         "sched_restored",
			ProviderScheduleIdObserved: true,
			ProviderStatus:             "active",
			CurrentPeriodStart:         1000,
			CurrentPeriodEnd:           2000,
		}, nil
	}
	originalRefund := refundSubscriptionCompensationWalletDebit
	t.Cleanup(func() { refundSubscriptionCompensationWalletDebit = originalRefund })
	refundSubscriptionCompensationWalletDebit = func(ctx context.Context, intentID int64) error {
		refunds++
		return refundSubscriptionCompensationWalletDebitDefault(ctx, intentID)
	}

	result, err := ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:      fx.user.Id,
		PlanID:      fx.target.Id,
		PaymentMode: model.SubscriptionPaymentModeBalanceOnePeriod,
		RequestID:   "stripe-to-balance-active",
	})
	require.NoError(t, err)
	require.Equal(t, ChangePlanStatusApplied, result.Status)
	_, err = ReconcileSubscriptionCompensationRequired(context.Background(), 100)
	require.NoError(t, err)
	_, err = ReconcileSubscriptionCompensationRequired(context.Background(), 100)
	require.NoError(t, err)

	require.Equal(t, int64(1), refunds)
	var user model.User
	require.NoError(t, model.DB.First(&user, fx.user.Id).Error)
	require.Equal(t, fx.user.Quota, user.Quota)
	var entitlementCount int64
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("contract_id = ? AND plan_id = ?", fx.contract.Id, fx.target.Id).Count(&entitlementCount).Error)
	require.Zero(t, entitlementCount)
	var binding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&binding, fx.binding.Id).Error)
	require.Equal(t, "sched_restored", binding.ProviderScheduleId)
}

func TestStripeToBalanceConfirmedCanceledNeverRefundsAndGrantsExactlyOnce(t *testing.T) {
	setupSubscriptionCompensationTestDB(t)
	fx := seedStripeToBalanceFixture(t, 9003, 1, 2)
	replaceCompensationHooks(t)
	var refunds int64
	stripeReleaseSubscriptionSchedule = func(scheduleID string, idempotencyKey string) error { return nil }
	stripeRestoreSubscriptionSchedule = func(rawSnapshot string, idempotencyKey string) (string, error) { return "sched_restored", nil }
	stripeCancelSubscriptionImmediately = func(providerSubscriptionID string, idempotencyKey string) error { return nil }
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId:     providerSubscriptionID,
			ProviderScheduleIdObserved: true,
			ProviderStatus:             "canceled",
			CanceledAt:                 2100,
			EndedAt:                    2100,
		}, nil
	}
	originalRefund := refundSubscriptionCompensationWalletDebit
	t.Cleanup(func() { refundSubscriptionCompensationWalletDebit = originalRefund })
	refundSubscriptionCompensationWalletDebit = func(ctx context.Context, intentID int64) error {
		refunds++
		return nil
	}

	result, err := ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:      fx.user.Id,
		PlanID:      fx.target.Id,
		PaymentMode: model.SubscriptionPaymentModeBalanceOnePeriod,
		RequestID:   "stripe-to-balance-canceled",
	})
	require.NoError(t, err)
	_, err = ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:      fx.user.Id,
		PlanID:      fx.target.Id,
		PaymentMode: model.SubscriptionPaymentModeBalanceOnePeriod,
		RequestID:   "stripe-to-balance-canceled",
	})
	require.NoError(t, err)
	_, err = ReconcileSubscriptionCompensationRequired(context.Background(), 100)
	require.NoError(t, err)

	require.Equal(t, ChangePlanStatusApplied, result.Status)
	require.Zero(t, refunds)
	var user model.User
	require.NoError(t, model.DB.First(&user, fx.user.Id).Error)
	require.Equal(t, fx.user.Quota-int(fx.target.PriceAmount*common.QuotaPerUnit), user.Quota)
	var entitlementCount int64
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("contract_id = ? AND plan_id = ?", fx.contract.Id, fx.target.Id).Count(&entitlementCount).Error)
	require.Equal(t, int64(1), entitlementCount)
	var intent model.SubscriptionChangeIntent
	require.NoError(t, model.DB.Where("request_id = ?", "stripe-to-balance-canceled").First(&intent).Error)
	require.Equal(t, model.SubscriptionChangeIntentStatusApplied, intent.Status)
	require.NotEmpty(t, intent.WalletDebitTradeNo)
}

func TestStripeToBalanceReplayAndReconciliationCrashWindowsDoNotDoubleDebitRefundOrGrant(t *testing.T) {
	setupSubscriptionCompensationTestDB(t)
	fx := seedStripeToBalanceFixture(t, 9004, 1, 2)
	replaceCompensationHooks(t)
	var gets int
	stripeReleaseSubscriptionSchedule = func(scheduleID string, idempotencyKey string) error { return nil }
	stripeCancelSubscriptionImmediately = func(providerSubscriptionID string, idempotencyKey string) error { return nil }
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		gets++
		if gets == 1 {
			return model.ProviderSubscriptionSnapshot{}, errors.New("crash window")
		}
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId:     providerSubscriptionID,
			ProviderScheduleIdObserved: true,
			ProviderStatus:             "canceled",
			CanceledAt:                 2200,
			EndedAt:                    2200,
		}, nil
	}

	_, err := ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:      fx.user.Id,
		PlanID:      fx.target.Id,
		PaymentMode: model.SubscriptionPaymentModeBalanceOnePeriod,
		RequestID:   "stripe-to-balance-replay",
	})
	require.Error(t, err)
	_, err = ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:      fx.user.Id,
		PlanID:      fx.target.Id,
		PaymentMode: model.SubscriptionPaymentModeBalanceOnePeriod,
		RequestID:   "stripe-to-balance-replay",
	})
	require.NoError(t, err)
	_, err = ReconcileSubscriptionCompensationRequired(context.Background(), 100)
	require.NoError(t, err)

	var user model.User
	require.NoError(t, model.DB.First(&user, fx.user.Id).Error)
	require.Equal(t, fx.user.Quota-int(fx.target.PriceAmount*common.QuotaPerUnit), user.Quota)
	var orders int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("change_intent_id > 0 AND payment_provider = ?", model.PaymentProviderBalance).Count(&orders).Error)
	require.Equal(t, int64(1), orders)
	var entitlementCount int64
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("contract_id = ? AND plan_id = ?", fx.contract.Id, fx.target.Id).Count(&entitlementCount).Error)
	require.Equal(t, int64(1), entitlementCount)
}

func TestStripeToBalanceReconciliationRecoversPreparedSyncingIntentExactlyOnce(t *testing.T) {
	setupSubscriptionCompensationTestDB(t)
	fx := seedStripeToBalanceFixture(t, 9005, 1, 2)
	replaceCompensationHooks(t)

	var intent model.SubscriptionChangeIntent
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		var user model.User
		if err := tx.First(&user, fx.user.Id).Error; err != nil {
			return err
		}
		var contract model.UserSubscriptionContract
		if err := tx.First(&contract, fx.contract.Id).Error; err != nil {
			return err
		}
		intent = model.SubscriptionChangeIntent{
			ContractId:    contract.Id,
			UserId:        user.Id,
			RequestId:     "stripe-to-balance-prepared-crash",
			ChangeVersion: contract.ChangeVersion + 1,
			Kind:          model.SubscriptionChangeIntentKindUpgrade,
			PaymentMode:   model.SubscriptionPaymentModeBalanceOnePeriod,
			Status:        model.SubscriptionChangeIntentStatusCreated,
			FromPlanId:    fx.current.Id,
			ToPlanId:      fx.target.Id,
		}
		if err := tx.Create(&intent).Error; err != nil {
			return err
		}
		if err := tx.Model(&contract).Update("latest_change_intent_id", intent.Id).Error; err != nil {
			return err
		}
		return prepareStripeToBalanceCompensationTx(tx, &user, &contract, &intent, &fx.target)
	}))

	var cancels int
	var refunds int
	stripeReleaseSubscriptionSchedule = func(scheduleID string, idempotencyKey string) error { return nil }
	stripeCancelSubscriptionImmediately = func(providerSubscriptionID string, idempotencyKey string) error {
		cancels++
		return nil
	}
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId:     providerSubscriptionID,
			ProviderScheduleIdObserved: true,
			ProviderStatus:             "canceled",
			CanceledAt:                 2300,
			EndedAt:                    2300,
		}, nil
	}
	originalRefund := refundSubscriptionCompensationWalletDebit
	t.Cleanup(func() { refundSubscriptionCompensationWalletDebit = originalRefund })
	refundSubscriptionCompensationWalletDebit = func(ctx context.Context, intentID int64) error {
		refunds++
		return refundSubscriptionCompensationWalletDebitDefault(ctx, intentID)
	}

	processed, err := ReconcileSubscriptionCompensationRequired(context.Background(), 100)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	processed, err = ReconcileSubscriptionCompensationRequired(context.Background(), 100)
	require.NoError(t, err)
	require.Zero(t, processed)

	require.Equal(t, 1, cancels)
	require.Zero(t, refunds)
	var user model.User
	require.NoError(t, model.DB.First(&user, fx.user.Id).Error)
	require.Equal(t, fx.user.Quota-int(fx.target.PriceAmount*common.QuotaPerUnit), user.Quota)
	var orders int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("change_intent_id = ? AND payment_provider = ?", intent.Id, model.PaymentProviderBalance).Count(&orders).Error)
	require.Equal(t, int64(1), orders)
	var entitlementCount int64
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("contract_id = ? AND plan_id = ?", fx.contract.Id, fx.target.Id).Count(&entitlementCount).Error)
	require.Equal(t, int64(1), entitlementCount)
	require.NoError(t, model.DB.First(&intent, intent.Id).Error)
	require.Equal(t, model.SubscriptionChangeIntentStatusApplied, intent.Status)
}

func TestStripeToBalanceZeroRowDebitRollsBackPreparation(t *testing.T) {
	setupSubscriptionCompensationTestDB(t)
	fx := seedStripeToBalanceFixture(t, 9006, 1, 2)
	staleUser := *fx.user
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", fx.user.Id).Update("quota", 0).Error)

	err := model.DB.Transaction(func(tx *gorm.DB) error {
		var contract model.UserSubscriptionContract
		if err := tx.First(&contract, fx.contract.Id).Error; err != nil {
			return err
		}
		intent := &model.SubscriptionChangeIntent{
			ContractId:    contract.Id,
			UserId:        staleUser.Id,
			RequestId:     "stripe-to-balance-zero-row-debit",
			ChangeVersion: contract.ChangeVersion + 1,
			Kind:          model.SubscriptionChangeIntentKindUpgrade,
			PaymentMode:   model.SubscriptionPaymentModeBalanceOnePeriod,
			Status:        model.SubscriptionChangeIntentStatusCreated,
			FromPlanId:    fx.current.Id,
			ToPlanId:      fx.target.Id,
		}
		if err := tx.Create(intent).Error; err != nil {
			return err
		}
		if err := tx.Model(&contract).Update("latest_change_intent_id", intent.Id).Error; err != nil {
			return err
		}
		return prepareStripeToBalanceCompensationTx(tx, &staleUser, &contract, intent, &fx.target)
	})
	require.Error(t, err)

	var intentCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionChangeIntent{}).Where("request_id = ?", "stripe-to-balance-zero-row-debit").Count(&intentCount).Error)
	require.Zero(t, intentCount)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ? AND payment_provider = ?", fx.user.Id, model.PaymentProviderBalance).Count(&orderCount).Error)
	require.Zero(t, orderCount)
	var entitlementCount int64
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("contract_id = ? AND plan_id = ?", fx.contract.Id, fx.target.Id).Count(&entitlementCount).Error)
	require.Zero(t, entitlementCount)
	var user model.User
	require.NoError(t, model.DB.First(&user, fx.user.Id).Error)
	require.Zero(t, user.Quota)
}

func TestStripeToBalanceRefundZeroRowTransitionDoesNotCreditQuota(t *testing.T) {
	setupSubscriptionCompensationTestDB(t)
	fx := seedStripeToBalanceFixture(t, 9007, 1, 2)
	var intent model.SubscriptionChangeIntent
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		var user model.User
		if err := tx.First(&user, fx.user.Id).Error; err != nil {
			return err
		}
		var contract model.UserSubscriptionContract
		if err := tx.First(&contract, fx.contract.Id).Error; err != nil {
			return err
		}
		intent = model.SubscriptionChangeIntent{
			ContractId:    contract.Id,
			UserId:        user.Id,
			RequestId:     "stripe-to-balance-refund-cas",
			ChangeVersion: contract.ChangeVersion + 1,
			Kind:          model.SubscriptionChangeIntentKindUpgrade,
			PaymentMode:   model.SubscriptionPaymentModeBalanceOnePeriod,
			Status:        model.SubscriptionChangeIntentStatusCreated,
			FromPlanId:    fx.current.Id,
			ToPlanId:      fx.target.Id,
		}
		if err := tx.Create(&intent).Error; err != nil {
			return err
		}
		if err := tx.Model(&contract).Update("latest_change_intent_id", intent.Id).Error; err != nil {
			return err
		}
		return prepareStripeToBalanceCompensationTx(tx, &user, &contract, &intent, &fx.target)
	}))
	var charged model.User
	require.NoError(t, model.DB.First(&charged, fx.user.Id).Error)
	require.Equal(t, fx.user.Quota-int(fx.target.PriceAmount*common.QuotaPerUnit), charged.Quota)
	require.NoError(t, model.DB.Exec(`
		CREATE TRIGGER block_subscription_compensation_refund
		BEFORE UPDATE OF status ON subscription_orders
		WHEN OLD.status = 'success' AND NEW.status = 'failed'
		BEGIN
			SELECT RAISE(IGNORE);
		END;
	`).Error)

	err := refundSubscriptionCompensationWalletDebitDefault(context.Background(), intent.Id)
	require.Error(t, err)
	var after model.User
	require.NoError(t, model.DB.First(&after, fx.user.Id).Error)
	require.Equal(t, charged.Quota, after.Quota)
	var order model.SubscriptionOrder
	require.NoError(t, model.DB.Where("trade_no = ?", intent.WalletDebitTradeNo).First(&order).Error)
	require.Equal(t, common.TopUpStatusSuccess, order.Status)
	require.NoError(t, model.DB.First(&intent, intent.Id).Error)
	require.NotEqual(t, model.SubscriptionChangeIntentStatusApplied, intent.Status)
}

func assertStripeToBalanceNoRefundOrGrant(t *testing.T, fx stripeToBalanceFixture) {
	t.Helper()
	var user model.User
	require.NoError(t, model.DB.First(&user, fx.user.Id).Error)
	require.Equal(t, fx.user.Quota-int(fx.target.PriceAmount*common.QuotaPerUnit), user.Quota)
	var entitlementCount int64
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("contract_id = ? AND plan_id = ?", fx.contract.Id, fx.target.Id).Count(&entitlementCount).Error)
	require.Zero(t, entitlementCount)
	var current model.UserSubscription
	require.NoError(t, model.DB.First(&current, fx.currentEntitlement.Id).Error)
	require.Equal(t, model.SubscriptionEntitlementStatusActive, current.Status)
}
