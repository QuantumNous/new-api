package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"github.com/stripe/stripe-go/v86"
	"gorm.io/gorm"
)

func setupSubscriptionContractServiceTestDB(t *testing.T) {
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
	sqlDB.SetMaxOpenConns(1)

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
		&model.SubscriptionProviderBinding{},
		&model.UserSubscriptionContract{},
		&model.SubscriptionChangeIntent{},
	))
}

func insertContractServiceUser(t *testing.T, id int, quota int) {
	t.Helper()
	require.NoError(t, model.DB.Create(&model.User{
		Id:       id,
		Username: "contract_user_" + t.Name(),
		Status:   common.UserStatusEnabled,
		Quota:    quota,
		Group:    "plg",
		AffCode:  "contract_aff_" + t.Name(),
	}).Error)
}

func insertContractServicePlan(t *testing.T, id int, rank int, price float64, total int64) model.SubscriptionPlan {
	t.Helper()
	plan := model.SubscriptionPlan{
		Id:              id,
		Title:           "Contract Plan",
		PriceAmount:     price,
		Currency:        "USD",
		DurationUnit:    model.SubscriptionDurationMonth,
		DurationValue:   1,
		Enabled:         true,
		TierRank:        &rank,
		AllowBalancePay: common.GetPointer(true),
		TotalAmount:     total,
	}
	require.NoError(t, model.DB.Create(&plan).Error)
	return plan
}

func balanceChangeCommand(userID int, planID int, requestID string) ChangePlanCommand {
	return ChangePlanCommand{
		UserID:      userID,
		PlanID:      planID,
		PaymentMode: model.SubscriptionPaymentModeBalanceOnePeriod,
		RequestID:   requestID,
	}
}

func TestResolveOrReuseStripeSubscriptionRecallDiscountFreezesFirstDecision(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	plan := insertContractServicePlan(t, 7290, 1, 2.5, 250)
	order := model.SubscriptionOrder{
		UserId:          7190,
		PlanId:          plan.Id,
		TradeNo:         "subscription-recall-frozen",
		PaymentMethod:   model.PaymentMethodStripe,
		PaymentProvider: model.PaymentProviderStripe,
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, model.DB.Create(&order).Error)
	firstDiscount := &RecallCheckoutDiscount{
		PromotionCodeID:     "promo_first",
		CampaignID:          901,
		RecipientID:         902,
		DiscountAmountMinor: 250,
	}
	resolveCalls := 0

	first, err := resolveOrReuseStripeSubscriptionRecallDiscount(
		context.Background(),
		order.TradeNo,
		func() (*RecallCheckoutDiscount, error) {
			resolveCalls++
			return firstDiscount, nil
		},
	)
	require.NoError(t, err)
	require.Equal(t, firstDiscount, first)

	second, err := resolveOrReuseStripeSubscriptionRecallDiscount(
		context.Background(),
		order.TradeNo,
		func() (*RecallCheckoutDiscount, error) {
			resolveCalls++
			return &RecallCheckoutDiscount{
				PromotionCodeID:     "promo_later_stronger",
				CampaignID:          903,
				RecipientID:         904,
				DiscountAmountMinor: 500,
			}, nil
		},
	)
	require.NoError(t, err)
	require.Equal(t, firstDiscount, second)
	require.Equal(t, 1, resolveCalls)

	var stored model.SubscriptionOrder
	require.NoError(t, model.DB.First(&stored, order.Id).Error)
	require.True(t, stored.RecallOfferResolved)
	require.Equal(t, firstDiscount.PromotionCodeID, stored.RecallPromotionCodeId)
	require.Equal(t, firstDiscount.CampaignID, stored.RecallCampaignId)
	require.Equal(t, firstDiscount.RecipientID, stored.RecallRecipientId)
	require.Equal(t, firstDiscount.DiscountAmountMinor, stored.RecallDiscountAmountMinor)
}

func TestResolveOrReuseStripeSubscriptionRecallDiscountFreezesNoOffer(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	plan := insertContractServicePlan(t, 7291, 1, 2.5, 250)
	order := model.SubscriptionOrder{
		UserId:          7191,
		PlanId:          plan.Id,
		TradeNo:         "subscription-recall-none-frozen",
		PaymentMethod:   model.PaymentMethodStripe,
		PaymentProvider: model.PaymentProviderStripe,
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, model.DB.Create(&order).Error)
	resolveCalls := 0

	first, err := resolveOrReuseStripeSubscriptionRecallDiscount(
		context.Background(),
		order.TradeNo,
		func() (*RecallCheckoutDiscount, error) {
			resolveCalls++
			return nil, nil
		},
	)
	require.NoError(t, err)
	require.Nil(t, first)

	second, err := resolveOrReuseStripeSubscriptionRecallDiscount(
		context.Background(),
		order.TradeNo,
		func() (*RecallCheckoutDiscount, error) {
			resolveCalls++
			return &RecallCheckoutDiscount{PromotionCodeID: "promo_too_late"}, nil
		},
	)
	require.NoError(t, err)
	require.Nil(t, second)
	require.Equal(t, 1, resolveCalls)

	var stored model.SubscriptionOrder
	require.NoError(t, model.DB.First(&stored, order.Id).Error)
	require.True(t, stored.RecallOfferResolved)
}

func TestBalancePurchaseCreatesOnePeriodWithoutBinding(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7101, 1000)
	insertContractServicePlan(t, 7201, 1, 2.25, 2250)

	result, err := ChangeSubscriptionPlan(balanceChangeCommand(7101, 7201, "req-balance-one"))

	require.NoError(t, err)
	require.Equal(t, ChangePlanStatusApplied, result.Status)
	require.NotNil(t, result.Contract)
	require.NotNil(t, result.Intent)
	require.Equal(t, model.SubscriptionContractStatusActive, result.Contract.Status)
	require.Equal(t, model.SubscriptionPaymentModeBalanceOnePeriod, result.Contract.PaymentMode)
	require.Equal(t, 7201, result.Contract.CurrentPlanId)
	require.Zero(t, result.Contract.CurrentProviderBindingId)
	require.Equal(t, result.Intent.Id, result.Contract.LatestChangeIntentId)
	require.Equal(t, model.SubscriptionChangeIntentStatusApplied, result.Intent.Status)
	require.Zero(t, result.Intent.ProviderBindingId)

	var user model.User
	require.NoError(t, model.DB.First(&user, "id = ?", 7101).Error)
	require.Equal(t, 775, user.Quota)

	var orders []model.SubscriptionOrder
	require.NoError(t, model.DB.Where("user_id = ?", 7101).Find(&orders).Error)
	require.Len(t, orders, 1)
	require.Equal(t, common.TopUpStatusSuccess, orders[0].Status)
	require.Equal(t, model.PaymentProviderBalance, orders[0].PaymentProvider)

	var bindingCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("user_id = ?", 7101).Count(&bindingCount).Error)
	require.Zero(t, bindingCount)

	var entitlements []model.UserSubscription
	require.NoError(t, model.DB.Where("user_id = ?", 7101).Find(&entitlements).Error)
	require.Len(t, entitlements, 1)
	require.Equal(t, result.Contract.Id, entitlements[0].ContractId)
	require.Equal(t, "balance", entitlements[0].Source)
	require.Equal(t, model.SubscriptionPaymentModeBalanceOnePeriod, entitlements[0].PaymentMode)
	require.NotNil(t, entitlements[0].CurrentSlot)
}

func TestSameRequestIDReturnsSameIntent(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7102, 1000)
	insertContractServicePlan(t, 7202, 1, 1.5, 1500)

	first, err := ChangeSubscriptionPlan(balanceChangeCommand(7102, 7202, "stable-request-id"))
	require.NoError(t, err)
	second, err := ChangeSubscriptionPlan(balanceChangeCommand(7102, 7202, "stable-request-id"))
	require.NoError(t, err)

	require.Equal(t, first.Intent.Id, second.Intent.Id)
	require.Equal(t, first.Contract.Id, second.Contract.Id)
	require.Equal(t, ChangePlanStatusApplied, second.Status)

	var intentCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionChangeIntent{}).Where("user_id = ?", 7102).Count(&intentCount).Error)
	require.Equal(t, int64(1), intentCount)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 7102).Count(&orderCount).Error)
	require.Equal(t, int64(1), orderCount)
}

func TestSameRequestIDStripeReplayReturnsExistingBalanceIntentBeforePendingMigration(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7111, 3000)
	insertContractServicePlan(t, 7215, 1, 1, 1000)
	insertContractServicePlan(t, 7216, 2, 2, 2000)

	first, err := ChangeSubscriptionPlan(balanceChangeCommand(7111, 7215, "existing-before-stripe-mode"))
	require.NoError(t, err)
	var afterFirstUser model.User
	require.NoError(t, model.DB.First(&afterFirstUser, "id = ?", 7111).Error)

	replay, err := ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:      7111,
		PlanID:      7216,
		PaymentMode: model.SubscriptionPaymentModeStripeRecurring,
		RequestID:   "existing-before-stripe-mode",
	})

	require.NoError(t, err)
	require.Equal(t, first.Intent.Id, replay.Intent.Id)
	require.Equal(t, first.Contract.Id, replay.Contract.Id)
	require.Equal(t, ChangePlanStatusApplied, replay.Status)
	require.Equal(t, 7215, replay.Intent.ToPlanId)
	var afterReplayUser model.User
	require.NoError(t, model.DB.First(&afterReplayUser, "id = ?", 7111).Error)
	require.Equal(t, afterFirstUser.Quota, afterReplayUser.Quota)
	var intentCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionChangeIntent{}).Where("user_id = ?", 7111).Count(&intentCount).Error)
	require.Equal(t, int64(1), intentCount)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 7111).Count(&orderCount).Error)
	require.Equal(t, int64(1), orderCount)
	var entitlementCount int64
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("user_id = ?", 7111).Count(&entitlementCount).Error)
	require.Equal(t, int64(1), entitlementCount)
}

func TestSameRequestIDIgnoresChangedPlanOnRetry(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7106, 1000)
	insertContractServicePlan(t, 7209, 1, 1.5, 1500)

	first, err := ChangeSubscriptionPlan(balanceChangeCommand(7106, 7209, "retry-before-plan-validation"))
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", 7209).Update("enabled", false).Error)

	retry := balanceChangeCommand(7106, 999999, "retry-before-plan-validation")
	retry.PaymentMode = "unsupported_mode"
	second, err := ChangeSubscriptionPlan(retry)

	require.NoError(t, err)
	require.Equal(t, first.Intent.Id, second.Intent.Id)
	require.Equal(t, ChangePlanStatusApplied, second.Status)
	require.Equal(t, 7209, second.Intent.ToPlanId)
}

func TestUserPurchasesAreSerializedThroughOneContract(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7103, 2000)
	insertContractServicePlan(t, 7203, 1, 1, 1000)
	insertContractServicePlan(t, 7204, 2, 2, 2000)

	first, err := ChangeSubscriptionPlan(balanceChangeCommand(7103, 7203, "first-plan"))
	require.NoError(t, err)
	second, err := ChangeSubscriptionPlan(balanceChangeCommand(7103, 7204, "second-plan"))
	require.NoError(t, err)

	require.Equal(t, first.Contract.Id, second.Contract.Id)
	require.Equal(t, 7204, second.Contract.CurrentPlanId)

	var contractCount int64
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("user_id = ?", 7103).Count(&contractCount).Error)
	require.Equal(t, int64(1), contractCount)
	var currentCount int64
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("contract_id = ? AND current_slot = ?", first.Contract.Id, 1).Count(&currentCount).Error)
	require.Equal(t, int64(1), currentCount)
}

func TestSameRankOrSamePlanIsRejected(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7104, 2000)
	insertContractServicePlan(t, 7205, 1, 1, 1000)
	insertContractServicePlan(t, 7206, 1, 1, 1000)

	_, err := ChangeSubscriptionPlan(balanceChangeCommand(7104, 7205, "initial"))
	require.NoError(t, err)

	_, err = ChangeSubscriptionPlan(balanceChangeCommand(7104, 7205, "same-plan"))
	require.ErrorIs(t, err, ErrSubscriptionPlanUnchanged)

	_, err = ChangeSubscriptionPlan(balanceChangeCommand(7104, 7206, "same-rank"))
	require.ErrorIs(t, err, ErrSubscriptionPlanUnchanged)
}

func TestBalanceDowngradeDoesNotApplyImmediately(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7107, 3000)
	insertContractServicePlan(t, 7210, 1, 1, 1000)
	insertContractServicePlan(t, 7211, 3, 2, 2000)

	current, err := ChangeSubscriptionPlan(balanceChangeCommand(7107, 7211, "start-high-rank"))
	require.NoError(t, err)
	var beforeUser model.User
	require.NoError(t, model.DB.First(&beforeUser, "id = ?", 7107).Error)

	_, err = ChangeSubscriptionPlan(balanceChangeCommand(7107, 7210, "downgrade-low-rank"))

	require.ErrorIs(t, err, ErrSubscriptionDowngradeDeferred)
	var afterUser model.User
	require.NoError(t, model.DB.First(&afterUser, "id = ?", 7107).Error)
	require.Equal(t, beforeUser.Quota, afterUser.Quota)
	var contract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&contract, "id = ?", current.Contract.Id).Error)
	require.Equal(t, 7211, contract.CurrentPlanId)
	require.Equal(t, current.Contract.CurrentEntitlementId, contract.CurrentEntitlementId)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 7107).Count(&orderCount).Error)
	require.Equal(t, int64(1), orderCount)
}

func TestOnePeriodDowngradeReturnsUnsupportedWithoutSideEffects(t *testing.T) {
	testCases := []struct {
		name        string
		userID      int
		paymentMode string
	}{
		{
			name:        "balance one period",
			userID:      7120,
			paymentMode: model.SubscriptionPaymentModeBalanceOnePeriod,
		},
		{
			name:        "external one period",
			userID:      7121,
			paymentMode: model.SubscriptionPaymentModeExternalOnePeriod,
		},
	}

	for index, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			setupSubscriptionContractServiceTestDB(t)
			insertContractServiceUser(t, tc.userID, 3000)
			lowPlan := insertContractServicePlan(t, 7230+index*10, 1, 1, 1000)
			highPlan := insertContractServicePlan(t, 7231+index*10, 3, 2, 2000)
			now := common.GetTimestamp()
			contract := model.UserSubscriptionContract{
				UserId:               tc.userID,
				Status:               model.SubscriptionContractStatusActive,
				PaymentMode:          tc.paymentMode,
				CurrentPlanId:        highPlan.Id,
				CurrentEntitlementId: 9000 + index,
				CurrentPeriodStart:   now - 100,
				CurrentPeriodEnd:     now + 3600,
				ChangeVersion:        7,
			}
			require.NoError(t, model.DB.Create(&contract).Error)
			entitlement := model.UserSubscription{
				Id:            9000 + index,
				UserId:        tc.userID,
				PlanId:        highPlan.Id,
				ContractId:    contract.Id,
				AmountTotal:   highPlan.TotalAmount,
				Status:        model.SubscriptionEntitlementStatusActive,
				PaymentMode:   tc.paymentMode,
				StartTime:     now - 100,
				EndTime:       now + 3600,
				AccessEndTime: now + 3600,
			}
			require.NoError(t, model.DB.Create(&entitlement).Error)

			_, err := ChangeSubscriptionPlan(ChangePlanCommand{
				UserID:      tc.userID,
				PlanID:      lowPlan.Id,
				PaymentMode: model.SubscriptionPaymentModeBalanceOnePeriod,
				RequestID:   "unsupported-one-period-downgrade-" + tc.name,
			})

			require.ErrorIs(t, err, ErrSubscriptionDowngradeUnsupported)
			require.True(t, errors.Is(err, ErrSubscriptionDowngradeDeferred))
			require.Equal(t, "subscription downgrade scheduling is only supported for active Stripe recurring subscriptions", err.Error())
			var orderCount int64
			require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", tc.userID).Count(&orderCount).Error)
			require.Zero(t, orderCount)
			var intentCount int64
			require.NoError(t, model.DB.Model(&model.SubscriptionChangeIntent{}).Where("user_id = ?", tc.userID).Count(&intentCount).Error)
			require.Zero(t, intentCount)
			var reloadedContract model.UserSubscriptionContract
			require.NoError(t, model.DB.First(&reloadedContract, "id = ?", contract.Id).Error)
			require.Equal(t, highPlan.Id, reloadedContract.CurrentPlanId)
			require.Equal(t, entitlement.Id, reloadedContract.CurrentEntitlementId)
			require.Zero(t, reloadedContract.LatestChangeIntentId)
			require.Zero(t, reloadedContract.PendingPlanId)
			require.Zero(t, reloadedContract.PendingEffectiveAt)
			require.Equal(t, int64(7), reloadedContract.ChangeVersion)
		})
	}
}

func TestBalancePurchaseEnforcesMaxPurchasePerUser(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7108, 3000)
	plan := insertContractServicePlan(t, 7212, 1, 1, 1000)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).
		Where("id = ?", plan.Id).
		Update("max_purchase_per_user", 1).Error)
	require.NoError(t, model.DB.Create(&model.UserSubscription{
		UserId:      7108,
		PlanId:      plan.Id,
		AmountTotal: plan.TotalAmount,
		Status:      "expired",
		Source:      model.PaymentMethodBalance,
		PaymentMode: model.SubscriptionPaymentModeBalanceOnePeriod,
	}).Error)

	_, err := ChangeSubscriptionPlan(balanceChangeCommand(7108, plan.Id, "purchase-limit"))

	require.Error(t, err)
	require.Contains(t, err.Error(), "purchase limit")
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 7108).Count(&orderCount).Error)
	require.Zero(t, orderCount)
	var intentCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionChangeIntent{}).Where("user_id = ?", 7108).Count(&intentCount).Error)
	require.Zero(t, intentCount)
}

func TestBalancePurchaseRejectsNegativePlanPrice(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7109, 3000)
	insertContractServicePlan(t, 7213, 1, -1, 1000)

	_, err := ChangeSubscriptionPlan(balanceChangeCommand(7109, 7213, "negative-price"))

	require.Error(t, err)
	require.Contains(t, err.Error(), "price")
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 7109).Count(&orderCount).Error)
	require.Zero(t, orderCount)
	var intentCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionChangeIntent{}).Where("user_id = ?", 7109).Count(&intentCount).Error)
	require.Zero(t, intentCount)
}

func TestStripeRecurringChangePlanRequiresStripePriceBeforePersistingState(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7110, 3000)
	insertContractServicePlan(t, 7214, 1, 1, 1000)

	_, err := ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:        7110,
		PlanID:        7214,
		PaymentMode:   model.SubscriptionPaymentModeStripeRecurring,
		RequestID:     "stripe-pending-migration",
		VerifiedQuote: verifiedRecurringQuoteForTest("USD", 1, 100),
	})

	require.Error(t, err)
	require.Contains(t, err.Error(), "Stripe price id")
	var user model.User
	require.NoError(t, model.DB.First(&user, "id = ?", 7110).Error)
	require.Equal(t, 3000, user.Quota)
	var contractCount int64
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("user_id = ?", 7110).Count(&contractCount).Error)
	require.Zero(t, contractCount)
	var intentCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionChangeIntent{}).Where("user_id = ?", 7110).Count(&intentCount).Error)
	require.Zero(t, intentCount)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 7110).Count(&orderCount).Error)
	require.Zero(t, orderCount)
	var entitlementCount int64
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("user_id = ?", 7110).Count(&entitlementCount).Error)
	require.Zero(t, entitlementCount)
}

func TestStripeRecurringCheckoutLeavesProviderRenewalUnsetUntilInvoiceApplies(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7112, 3000)
	plan := insertContractServicePlan(t, 7217, 1, 12.34, 1234)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("stripe_price_id", "price_pending_renewal_state").Error)
	originalCreator := stripeSubscriptionCheckoutCreator
	t.Cleanup(func() { stripeSubscriptionCheckoutCreator = originalCreator })
	stripeSubscriptionCheckoutCreator = func(ctx context.Context, input StripeSubscriptionCheckoutInput) (*StripeSubscriptionCheckoutSession, error) {
		return &StripeSubscriptionCheckoutSession{ID: "cs_pending_renewal_state", URL: "https://checkout.example/pending"}, nil
	}

	result, err := ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:        7112,
		PlanID:        plan.Id,
		PaymentMode:   model.SubscriptionPaymentModeStripeRecurring,
		RequestID:     "stripe-pending-renewal-state",
		VerifiedQuote: verifiedRecurringQuoteForTest("USD", 12.34, 1234),
	})

	require.NoError(t, err)
	require.Equal(t, ChangePlanStatusCheckoutRequired, result.Status)
	var contract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&contract, "id = ?", result.Contract.Id).Error)
	require.Empty(t, contract.RenewalSource)
	require.Empty(t, contract.RenewalStatus)
	require.Equal(t, model.SubscriptionPaymentModeExternalOnePeriod, contract.PaymentMode)
	require.Equal(t, model.SubscriptionContractStatusEnded, contract.Status)
}

func TestStripeRecurringChangePlanRequiresSignedQuoteBeforeCreatingCheckout(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7113, 3000)
	plan := insertContractServicePlan(t, 7218, 1, 12.34, 1234)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("stripe_price_id", "price_legacy_authoritative_quote").Error)
	originalCreator := stripeSubscriptionCheckoutCreator
	t.Cleanup(func() { stripeSubscriptionCheckoutCreator = originalCreator })
	creatorCalled := false
	stripeSubscriptionCheckoutCreator = func(ctx context.Context, input StripeSubscriptionCheckoutInput) (*StripeSubscriptionCheckoutSession, error) {
		creatorCalled = true
		return &StripeSubscriptionCheckoutSession{ID: "cs_legacy_authoritative_quote", URL: "https://checkout.example/legacy"}, nil
	}

	result, err := ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:      7113,
		PlanID:      plan.Id,
		PaymentMode: model.SubscriptionPaymentModeStripeRecurring,
		RequestID:   "stripe-legacy-no-client-quote",
	})

	require.Error(t, err)
	require.Nil(t, result)
	require.Contains(t, err.Error(), "subscription purchase quote is required")
	require.False(t, creatorCalled)
	var contractCount int64
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("user_id = ?", 7113).Count(&contractCount).Error)
	require.Zero(t, contractCount)
	var intentCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionChangeIntent{}).Where("user_id = ?", 7113).Count(&intentCount).Error)
	require.Zero(t, intentCount)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 7113).Count(&orderCount).Error)
	require.Zero(t, orderCount)
}

func TestStripeRecurringCheckoutInvitationQuoteSkipsRecallResolution(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	setRecallCampaignEnabled(t, true)
	require.NoError(t, model.DB.AutoMigrate(&model.SubscriptionDiscountAccount{}, &model.SubscriptionDiscountEntry{}))
	require.NoError(t, model.DB.AutoMigrate(
		&model.RecallCampaign{},
		&model.RecallRecipient{},
		&model.RecallMessage{},
		&model.RecallEvent{},
	))
	require.NoError(t, model.DB.Migrator().DropTable(&model.RecallRecipient{}))
	insertContractServiceUser(t, 7119, 3000)
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", 7119).Update("email", "contract-invite-over-recall@example.com").Error)
	plan := insertContractServicePlan(t, 7229, 1, 12.34, 1234)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("stripe_price_id", "price_invitation_skips_recall_contract").Error)
	_, err := model.GrantSubscriptionDiscountTx(model.DB, model.SubscriptionDiscountGrantInput{
		UserID:         7119,
		USDMinor:       500,
		EntryType:      model.SubscriptionDiscountEntryTypeGrantInvitee,
		SourceType:     "test",
		SourceKey:      "grant-invite-over-recall",
		IdempotencyKey: "grant-invite-over-recall",
	})
	require.NoError(t, err)
	originalCreator := stripeSubscriptionCheckoutCreator
	t.Cleanup(func() { stripeSubscriptionCheckoutCreator = originalCreator })
	var capturedInput StripeSubscriptionCheckoutInput
	stripeSubscriptionCheckoutCreator = func(ctx context.Context, input StripeSubscriptionCheckoutInput) (*StripeSubscriptionCheckoutSession, error) {
		capturedInput = input
		return &StripeSubscriptionCheckoutSession{ID: "cs_invitation_skips_recall_contract", URL: "https://checkout.example/invite"}, nil
	}

	result, err := ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:      7119,
		PlanID:      plan.Id,
		PaymentMode: model.SubscriptionPaymentModeStripeRecurring,
		RequestID:   "stripe-invitation-skips-recall",
		RecallClaim: "buyer@example.com",
		VerifiedQuote: &SubscriptionPurchaseQuote{
			Currency:                      "USD",
			UnitPrice:                     12.34,
			UnitAmountMinor:               1234,
			OriginalTotal:                 12.34,
			OriginalTotalAmountMinor:      1234,
			DiscountKind:                  SubscriptionDiscountKindInvitation,
			DiscountAmount:                5,
			DiscountAmountMinor:           500,
			Total:                         7.34,
			PaymentAmountMinor:            734,
			InvitationAvailableUSDMinor:   500,
			InvitationDiscountUSDMinor:    500,
			InvitationDiscountAmountMinor: 500,
			InvitationRemainingUSDMinor:   0,
		},
	})

	require.NoError(t, err)
	require.NotNil(t, result)
	require.Equal(t, ChangePlanStatusCheckoutRequired, result.Status)
	require.Equal(t, SubscriptionDiscountKindInvitation, capturedInput.DiscountKind)
	require.Nil(t, capturedInput.RecallDiscount)
	require.EqualValues(t, 500, capturedInput.DiscountAmountMinor)
	require.NotEmpty(t, capturedInput.DiscountReservationKey)
	var order model.SubscriptionOrder
	require.NoError(t, model.DB.First(&order, "user_id = ?", 7119).Error)
	require.Equal(t, SubscriptionDiscountKindInvitation, order.DiscountKind)
	require.Empty(t, order.RecallPromotionCodeId)
	require.False(t, order.RecallOfferResolved)
	require.NotEmpty(t, order.SubscriptionDiscountReservationKey)
}

func TestStripeRecurringCheckoutRecallLookupFailureStopsWithoutFreezingNoOffer(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	setRecallCampaignEnabled(t, true)
	require.True(t, operation_setting.IsRecallCampaignEnabled())
	require.NoError(t, model.DB.AutoMigrate(
		&model.RecallCampaign{},
		&model.RecallRecipient{},
		&model.RecallMessage{},
		&model.RecallEvent{},
	))
	require.NoError(t, model.DB.Migrator().DropTable(&model.RecallRecipient{}))
	insertContractServiceUser(t, 7118, 3000)
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", 7118).Update("email", "contract-recall-degraded@example.com").Error)
	plan := insertContractServicePlan(t, 7218, 1, 12.34, 1234)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("stripe_price_id", "price_recall_degraded_contract").Error)
	originalCreator := stripeSubscriptionCheckoutCreator
	t.Cleanup(func() { stripeSubscriptionCheckoutCreator = originalCreator })
	creatorCalled := false
	stripeSubscriptionCheckoutCreator = func(ctx context.Context, input StripeSubscriptionCheckoutInput) (*StripeSubscriptionCheckoutSession, error) {
		creatorCalled = true
		return &StripeSubscriptionCheckoutSession{ID: "cs_recall_degraded_contract", URL: "https://checkout.example/degraded"}, nil
	}

	result, err := ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:      7118,
		PlanID:      plan.Id,
		PaymentMode: model.SubscriptionPaymentModeStripeRecurring,
		RequestID:   "stripe-recall-degraded",
		VerifiedQuote: &SubscriptionPurchaseQuote{
			Currency:                 "USD",
			UnitPrice:                12.34,
			UnitAmountMinor:          1234,
			OriginalTotal:            12.34,
			OriginalTotalAmountMinor: 1234,
			DiscountKind:             SubscriptionDiscountKindRecall,
			DiscountAmount:           5,
			DiscountAmountMinor:      500,
			Total:                    7.34,
			PaymentAmountMinor:       734,
			RecallCampaignID:         901,
			RecallRecipientID:        902,
		},
	})

	require.Error(t, err)
	require.Nil(t, result)
	require.False(t, creatorCalled)
	var order model.SubscriptionOrder
	require.NoError(t, model.DB.First(&order, "user_id = ?", 7118).Error)
	require.False(t, order.RecallOfferResolved)
	require.Empty(t, order.RecallPromotionCodeId)
	require.Equal(t, common.TopUpStatusFailed, order.Status)
}

func TestStripeRecurringReplacementQuoteGateRunsBeforeSupersedingPendingCheckout(t *testing.T) {
	staleQuote := verifiedRecurringQuoteForTest("USD", 11.11, 1111)
	testCases := []struct {
		name          string
		userID        int
		planID        int
		oldRequestID  string
		newRequestID  string
		providerID    string
		verifiedQuote *SubscriptionPurchaseQuote
	}{
		{
			name:         "nil quote",
			userID:       7130,
			planID:       7240,
			oldRequestID: "stripe-replacement-nil-quote-old",
			newRequestID: "stripe-replacement-nil-quote-new",
			providerID:   "cs_replacement_nil_quote_old",
		},
		{
			name:          "stale quote",
			userID:        7131,
			planID:        7241,
			oldRequestID:  "stripe-replacement-stale-quote-old",
			newRequestID:  "stripe-replacement-stale-quote-new",
			providerID:    "cs_replacement_stale_quote_old",
			verifiedQuote: staleQuote,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			setupSubscriptionContractServiceTestDB(t)
			require.NoError(t, model.DB.AutoMigrate(&model.SubscriptionDiscountAccount{}, &model.SubscriptionDiscountEntry{}))
			insertContractServiceUser(t, tc.userID, 3000)
			plan := insertContractServicePlan(t, tc.planID, 1, 12.34, 1234)
			require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
				Update("stripe_price_id", "price_"+strings.ReplaceAll(tc.name, " ", "_")).Error)
			plan.StripePriceId = "price_" + strings.ReplaceAll(tc.name, " ", "_")
			planSnapshot, err := subscriptionPurchasePlanSnapshot(&plan)
			require.NoError(t, err)
			contract := model.UserSubscriptionContract{
				UserId:        tc.userID,
				Status:        model.SubscriptionContractStatusEnded,
				PaymentMode:   model.SubscriptionPaymentModeExternalOnePeriod,
				ChangeVersion: 1,
			}
			require.NoError(t, model.DB.Create(&contract).Error)
			intent := model.SubscriptionChangeIntent{
				ContractId:             contract.Id,
				UserId:                 tc.userID,
				RequestId:              tc.oldRequestID,
				Kind:                   model.SubscriptionChangeIntentKindPurchase,
				PaymentMode:            model.SubscriptionPaymentModeStripeRecurring,
				Status:                 model.SubscriptionChangeIntentStatusAwaitingPayment,
				ToPlanId:               plan.Id,
				ChangeVersion:          2,
				ProviderIdempotencyKey: "idem-" + tc.oldRequestID,
				EffectiveAt:            common.GetTimestamp(),
			}
			require.NoError(t, model.DB.Create(&intent).Error)
			require.NoError(t, model.DB.Model(&contract).Updates(map[string]interface{}{
				"latest_change_intent_id": intent.Id,
				"change_version":          intent.ChangeVersion,
			}).Error)
			order := model.SubscriptionOrder{
				UserId:             tc.userID,
				PlanId:             plan.Id,
				Money:              7.34,
				TradeNo:            "trade-" + tc.oldRequestID,
				PaymentMethod:      model.PaymentMethodStripe,
				PaymentProvider:    model.PaymentProviderStripe,
				Status:             common.TopUpStatusPending,
				CreateTime:         common.GetTimestamp(),
				PurchaseMonths:     1,
				UnitPrice:          12.34,
				PaymentCurrency:    "USD",
				PaymentAmountMinor: 734,
				PlanSnapshot:       planSnapshot,
				PurchaseIntent:     model.SubscriptionChangeIntentKindPurchase,
				RenewalSource:      model.SubscriptionRenewalSourceProvider,
				DiscountKind:       SubscriptionDiscountKindInvitation,
				ProviderSessionId:  tc.providerID,
				ProviderSessionURL: "https://checkout.example/" + tc.providerID,
				ProviderPayload:    fmt.Sprintf("choice=%s;months=1;contract_id=%d;change_intent_id=%d", SubscriptionPaymentChoiceStripeRecurring, contract.Id, intent.Id),
				ChangeIntentId:     intent.Id,
			}
			require.NoError(t, model.DB.Create(&order).Error)
			_, err = model.GrantSubscriptionDiscountTx(model.DB, model.SubscriptionDiscountGrantInput{
				UserID:         tc.userID,
				USDMinor:       500,
				EntryType:      model.SubscriptionDiscountEntryTypeGrantInvitee,
				SourceType:     "test",
				SourceKey:      "grant-" + tc.oldRequestID,
				IdempotencyKey: "grant-" + tc.oldRequestID,
			})
			require.NoError(t, err)
			reservationKey := "subscription-order:" + order.TradeNo + ":reserve"
			_, err = model.ReserveSubscriptionDiscountTx(model.DB, model.SubscriptionDiscountReservationInput{
				UserID:             tc.userID,
				USDMinor:           500,
				OrderID:            order.Id,
				TradeNo:            order.TradeNo,
				PaymentCurrency:    "USD",
				AppliedAmountMinor: 500,
				IdempotencyKey:     reservationKey,
				ExpiresAt:          common.GetTimestamp() + 3600,
			})
			require.NoError(t, err)
			require.NoError(t, model.DB.Model(&order).Updates(map[string]interface{}{
				"subscription_discount_usd_minor":       500,
				"subscription_discount_amount_minor":    500,
				"subscription_discount_reservation_key": reservationKey,
			}).Error)

			restoreStripeAccessors := ReplaceStripeCheckoutSessionAccessorsForTest(
				func(_ context.Context, sessionID string) (*stripe.CheckoutSession, error) {
					require.Equal(t, tc.providerID, sessionID)
					return &stripe.CheckoutSession{ID: sessionID, Status: stripe.CheckoutSessionStatusOpen}, nil
				},
				func(_ context.Context, sessionID string) (*stripe.CheckoutSession, error) {
					require.Equal(t, tc.providerID, sessionID)
					return &stripe.CheckoutSession{ID: sessionID, Status: stripe.CheckoutSessionStatusExpired}, nil
				},
			)
			t.Cleanup(restoreStripeAccessors)
			var expirerCalls int
			originalExpirer := stripeCheckoutSessionExpirer
			stripeCheckoutSessionExpirer = func(ctx context.Context, sessionID string) (*stripe.CheckoutSession, error) {
				expirerCalls++
				return originalExpirer(ctx, sessionID)
			}
			t.Cleanup(func() { stripeCheckoutSessionExpirer = originalExpirer })
			var oldOrderBefore model.SubscriptionOrder
			require.NoError(t, model.DB.First(&oldOrderBefore, "id = ?", order.Id).Error)
			var oldIntentBefore model.SubscriptionChangeIntent
			require.NoError(t, model.DB.First(&oldIntentBefore, "id = ?", intent.Id).Error)
			var contractBefore model.UserSubscriptionContract
			require.NoError(t, model.DB.First(&contractBefore, "id = ?", contract.Id).Error)
			var accountBefore model.SubscriptionDiscountAccount
			require.NoError(t, model.DB.First(&accountBefore, "user_id = ?", tc.userID).Error)

			result, err := ChangeSubscriptionPlan(ChangePlanCommand{
				UserID:        tc.userID,
				PlanID:        plan.Id,
				PaymentMode:   model.SubscriptionPaymentModeStripeRecurring,
				RequestID:     tc.newRequestID,
				VerifiedQuote: tc.verifiedQuote,
			})

			require.Error(t, err)
			require.Nil(t, result)
			require.Contains(t, err.Error(), "quote")
			require.Zero(t, expirerCalls)
			var oldOrderAfter model.SubscriptionOrder
			require.NoError(t, model.DB.First(&oldOrderAfter, "id = ?", order.Id).Error)
			require.Equal(t, oldOrderBefore.Status, oldOrderAfter.Status)
			require.Equal(t, oldOrderBefore.CompleteTime, oldOrderAfter.CompleteTime)
			require.Equal(t, oldOrderBefore.ProviderSessionId, oldOrderAfter.ProviderSessionId)
			require.Equal(t, oldOrderBefore.SubscriptionDiscountReservationKey, oldOrderAfter.SubscriptionDiscountReservationKey)
			require.Equal(t, oldOrderBefore.SupersededByTradeNo, oldOrderAfter.SupersededByTradeNo)
			var oldIntentAfter model.SubscriptionChangeIntent
			require.NoError(t, model.DB.First(&oldIntentAfter, "id = ?", intent.Id).Error)
			require.Equal(t, oldIntentBefore.Status, oldIntentAfter.Status)
			require.Equal(t, oldIntentBefore.SupersededById, oldIntentAfter.SupersededById)
			var contractAfter model.UserSubscriptionContract
			require.NoError(t, model.DB.First(&contractAfter, "id = ?", contract.Id).Error)
			require.Equal(t, contractBefore.LatestChangeIntentId, contractAfter.LatestChangeIntentId)
			var accountAfter model.SubscriptionDiscountAccount
			require.NoError(t, model.DB.First(&accountAfter, "user_id = ?", tc.userID).Error)
			require.Equal(t, accountBefore.AvailableUSDMinor, accountAfter.AvailableUSDMinor)
			require.Equal(t, accountBefore.ReservedUSDMinor, accountAfter.ReservedUSDMinor)
			var releaseCount int64
			require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).
				Where("terminal_reservation_key = ? AND entry_type = ?", reservationKey, model.SubscriptionDiscountEntryTypeRelease).
				Count(&releaseCount).Error)
			require.Zero(t, releaseCount)
			var intentCount int64
			require.NoError(t, model.DB.Model(&model.SubscriptionChangeIntent{}).Where("user_id = ?", tc.userID).Count(&intentCount).Error)
			require.Equal(t, int64(1), intentCount)
			var orderCount int64
			require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", tc.userID).Count(&orderCount).Error)
			require.Equal(t, int64(1), orderCount)
		})
	}
}

func TestStripeRecurringCheckoutExpiresRemoteSessionWhenPersistFails(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7114, 3000)
	plan := insertContractServicePlan(t, 7219, 1, 12.34, 1234)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("stripe_price_id", "price_persist_failure_cleanup").Error)
	originalCreator := stripeSubscriptionCheckoutCreator
	originalExpirer := stripeCheckoutSessionExpirer
	t.Cleanup(func() {
		stripeSubscriptionCheckoutCreator = originalCreator
		stripeCheckoutSessionExpirer = originalExpirer
	})
	var expiredSessionID string
	stripeCheckoutSessionExpirer = func(ctx context.Context, sessionID string) (*stripe.CheckoutSession, error) {
		expiredSessionID = sessionID
		return nil, nil
	}
	stripeSubscriptionCheckoutCreator = func(ctx context.Context, input StripeSubscriptionCheckoutInput) (*StripeSubscriptionCheckoutSession, error) {
		require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).
			Where("change_intent_id = ?", input.ChangeIntentID).
			Update("provider_session_id", "cs_conflicting_local_session").Error)
		return &StripeSubscriptionCheckoutSession{ID: "cs_orphan_after_persist_failure", URL: "https://checkout.example/orphan"}, nil
	}

	result, err := ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:        7114,
		PlanID:        plan.Id,
		PaymentMode:   model.SubscriptionPaymentModeStripeRecurring,
		RequestID:     "stripe-persist-failure-cleanup",
		VerifiedQuote: verifiedRecurringQuoteForTest("USD", 12.34, 1234),
	})

	require.Error(t, err)
	require.Nil(t, result)
	require.Contains(t, err.Error(), "Stripe checkout session mismatch")
	require.Equal(t, "cs_orphan_after_persist_failure", expiredSessionID)
	var order model.SubscriptionOrder
	require.NoError(t, model.DB.First(&order, "user_id = ?", 7114).Error)
	require.Equal(t, common.TopUpStatusFailed, order.Status)
	var intent model.SubscriptionChangeIntent
	require.NoError(t, model.DB.First(&intent, "id = ?", order.ChangeIntentId).Error)
	require.Equal(t, model.SubscriptionChangeIntentStatusFailed, intent.Status)
	var contract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&contract, "id = ?", intent.ContractId).Error)
	require.Zero(t, contract.LatestChangeIntentId)
}

func TestStripeRecurringPendingReplayRequiresSnapshotPrice(t *testing.T) {
	testCases := []struct {
		name         string
		planSnapshot string
	}{
		{name: "missing snapshot"},
		{name: "invalid snapshot", planSnapshot: `{bad-json`},
		{name: "empty snapshot price", planSnapshot: `{"plan_id":7220,"price_amount":12.34,"currency":"USD","duration_unit":"month","duration_value":1,"total_amount":1234}`},
	}

	for index, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			setupSubscriptionContractServiceTestDB(t)
			userID := 7115 + index
			planID := 7220 + index
			insertContractServiceUser(t, userID, 3000)
			plan := insertContractServicePlan(t, planID, 1, 12.34, 1234)
			require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
				Update("stripe_price_id", "price_current_after_change").Error)
			contract := model.UserSubscriptionContract{
				UserId:      userID,
				Status:      model.SubscriptionContractStatusEnded,
				PaymentMode: model.SubscriptionPaymentModeExternalOnePeriod,
			}
			require.NoError(t, model.DB.Create(&contract).Error)
			intent := model.SubscriptionChangeIntent{
				ContractId:             contract.Id,
				UserId:                 userID,
				RequestId:              "stripe-pending-replay-" + tc.name,
				Kind:                   model.SubscriptionChangeIntentKindPurchase,
				PaymentMode:            model.SubscriptionPaymentModeStripeRecurring,
				Status:                 model.SubscriptionChangeIntentStatusAwaitingPayment,
				ToPlanId:               plan.Id,
				ChangeVersion:          1,
				ProviderIdempotencyKey: "idem-pending-replay-" + tc.name,
				EffectiveAt:            common.GetTimestamp(),
			}
			require.NoError(t, model.DB.Create(&intent).Error)
			require.NoError(t, model.DB.Model(&contract).Updates(map[string]interface{}{
				"latest_change_intent_id": intent.Id,
				"change_version":          intent.ChangeVersion,
			}).Error)
			require.NoError(t, model.DB.Create(&model.SubscriptionOrder{
				UserId:          userID,
				PlanId:          plan.Id,
				Money:           12.34,
				TradeNo:         "trade-pending-replay-" + tc.name,
				PaymentMethod:   model.PaymentMethodStripe,
				PaymentProvider: model.PaymentProviderStripe,
				Status:          common.TopUpStatusPending,
				CreateTime:      common.GetTimestamp(),
				PlanSnapshot:    tc.planSnapshot,
				ChangeIntentId:  intent.Id,
			}).Error)
			originalCreator := stripeSubscriptionCheckoutCreator
			t.Cleanup(func() { stripeSubscriptionCheckoutCreator = originalCreator })
			creatorCalled := false
			stripeSubscriptionCheckoutCreator = func(ctx context.Context, input StripeSubscriptionCheckoutInput) (*StripeSubscriptionCheckoutSession, error) {
				creatorCalled = true
				return &StripeSubscriptionCheckoutSession{ID: "cs_should_not_be_created", URL: "https://checkout.example/should-not"}, nil
			}

			result, err := ChangeSubscriptionPlan(ChangePlanCommand{
				UserID:      userID,
				PlanID:      plan.Id,
				PaymentMode: model.SubscriptionPaymentModeStripeRecurring,
				RequestID:   "stripe-pending-replay-" + tc.name,
			})

			require.Error(t, err)
			require.Nil(t, result)
			require.Contains(t, err.Error(), "subscription purchase quote is required")
			require.False(t, creatorCalled)
		})
	}
}

func TestUnresolvedPurchaseBlocksSecondChange(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7105, 2000)
	insertContractServicePlan(t, 7207, 1, 1, 1000)
	insertContractServicePlan(t, 7208, 2, 2, 2000)
	require.NoError(t, model.DB.Create(&model.UserSubscriptionContract{
		UserId:      7105,
		Status:      model.SubscriptionContractStatusEnded,
		PaymentMode: model.SubscriptionPaymentModeExternalOnePeriod,
	}).Error)
	var contract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&contract, "user_id = ?", 7105).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionChangeIntent{
		ContractId:    contract.Id,
		UserId:        7105,
		RequestId:     "pending-intent",
		Kind:          model.SubscriptionChangeIntentKindPurchase,
		PaymentMode:   model.SubscriptionPaymentModeStripeRecurring,
		Status:        model.SubscriptionChangeIntentStatusAwaitingPayment,
		FromPlanId:    0,
		ToPlanId:      7207,
		EffectiveAt:   common.GetTimestamp(),
		ChangeVersion: contract.ChangeVersion + 1,
	}).Error)

	_, err := ChangeSubscriptionPlan(balanceChangeCommand(7105, 7208, "blocked-by-pending"))

	require.ErrorIs(t, err, ErrSubscriptionChangeInProgress)
}

func TestFreshStripeRecurringPlanChangeRejectsActiveProviderLifecycleReservationBeforeIntent(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	contract, binding, _ := seedStripeRenewalLifecycleContract(t, 7113, false, "sub_plan_change_active_reservation")
	targetPlan := insertPurchaseServicePlan(t, 7218, 2, 3, 3000)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).
		Where("id = ?", targetPlan.Id).
		Update("stripe_price_id", "price_plan_change_active_reservation").Error)
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).
		Where("id = ?", binding.Id).
		Update("provider_subscription_item_id", "si_plan_change_active_reservation").Error)
	reservation, _, err := model.ReserveSubscriptionProviderLifecycle(
		binding.Id,
		binding.UserId,
		binding.ProviderSubscriptionId,
		binding.LifecycleActionSeq,
		model.SubscriptionProviderLifecycleActionCancel,
		"fresh-plan-change-active-reservation",
		300,
	)
	require.NoError(t, err)
	require.NotNil(t, reservation)

	createAttempts := countSubscriptionChangeIntentCreates(t)
	originalUpgrade := stripeSubscriptionUpgradeExecutor
	t.Cleanup(func() { stripeSubscriptionUpgradeExecutor = originalUpgrade })
	var upgradeCalls atomic.Int32
	stripeSubscriptionUpgradeExecutor = func(context.Context, StripeSubscriptionUpgradeInput) (*StripeSubscriptionUpgradeResult, error) {
		upgradeCalls.Add(1)
		return nil, errors.New("fresh plan change reached Stripe upgrade executor")
	}

	result, err := ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:      contract.UserId,
		PlanID:      targetPlan.Id,
		PaymentMode: model.SubscriptionPaymentModeStripeRecurring,
		RequestID:   "fresh-plan-change-active-reservation",
	})

	require.ErrorIs(t, err, ErrSubscriptionChangeInProgress)
	require.Nil(t, result)
	require.Zero(t, upgradeCalls.Load())
	require.Zero(t, createAttempts.Load())
	var intentCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionChangeIntent{}).
		Where("user_id = ?", contract.UserId).
		Count(&intentCount).Error)
	require.Zero(t, intentCount)
}

func TestStripeRecurringPlanChangeCreatedReplayAllowsActiveProviderLifecycleReservation(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	contract, binding, _ := seedStripeRenewalLifecycleContract(t, 7114, false, "sub_plan_change_replay_active_reservation")
	targetPlan := insertPurchaseServicePlan(t, 7219, 2, 3, 3000)
	require.NoError(t, model.DB.Create(&model.SubscriptionChangeIntent{
		ContractId:        contract.Id,
		UserId:            contract.UserId,
		RequestId:         "replay-active-reservation",
		ChangeVersion:     contract.ChangeVersion + 1,
		Kind:              model.SubscriptionChangeIntentKindUpgrade,
		PaymentMode:       model.SubscriptionPaymentModeStripeRecurring,
		Status:            model.SubscriptionChangeIntentStatusCreated,
		FromPlanId:        contract.CurrentPlanId,
		ToPlanId:          targetPlan.Id,
		ProviderBindingId: binding.Id,
		EffectiveAt:       common.GetTimestamp(),
	}).Error)
	reservation, _, err := model.ReserveSubscriptionProviderLifecycle(
		binding.Id,
		binding.UserId,
		binding.ProviderSubscriptionId,
		binding.LifecycleActionSeq,
		model.SubscriptionProviderLifecycleActionCancel,
		"replay-plan-change-active-reservation",
		300,
	)
	require.NoError(t, err)
	require.NotNil(t, reservation)

	originalUpgrade := stripeSubscriptionUpgradeExecutor
	t.Cleanup(func() { stripeSubscriptionUpgradeExecutor = originalUpgrade })
	stripeSubscriptionUpgradeExecutor = func(context.Context, StripeSubscriptionUpgradeInput) (*StripeSubscriptionUpgradeResult, error) {
		return nil, errors.New("replay should not execute Stripe upgrade")
	}

	result, err := ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:      contract.UserId,
		PlanID:      targetPlan.Id,
		PaymentMode: model.SubscriptionPaymentModeStripeRecurring,
		RequestID:   "replay-active-reservation",
	})

	require.NoError(t, err)
	require.NotNil(t, result)
	require.Equal(t, model.SubscriptionChangeIntentStatusCreated, result.Status)
	require.NotNil(t, result.Intent)
	require.Equal(t, "replay-active-reservation", result.Intent.RequestId)
}

func TestStripeRecurringPlanChangeSyncingReplayRejectsActiveProviderLifecycleReservationBeforeUpgradeExecutor(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7115, 0)
	currentPlan := insertStripeUpgradePlan(t, 7220, 1, 10, 1000, "price_syncing_replay_current")
	targetPlan := insertStripeUpgradePlan(t, 7221, 2, 25, 2500, "price_syncing_replay_target")
	contract, binding, _ := seedStripeUpgradeContract(t, 7115, currentPlan)
	require.NoError(t, model.DB.Model(binding).
		Update("provider_subscription_id", "sub_syncing_replay_active_reservation").Error)
	binding.ProviderSubscriptionId = "sub_syncing_replay_active_reservation"
	intent := &model.SubscriptionChangeIntent{
		ContractId:             contract.Id,
		UserId:                 contract.UserId,
		RequestId:              "syncing-replay-active-reservation",
		ChangeVersion:          contract.ChangeVersion + 1,
		Kind:                   model.SubscriptionChangeIntentKindUpgrade,
		PaymentMode:            model.SubscriptionPaymentModeStripeRecurring,
		Status:                 model.SubscriptionChangeIntentStatusSyncing,
		FromPlanId:             currentPlan.Id,
		ToPlanId:               targetPlan.Id,
		ProviderBindingId:      binding.Id,
		ProviderIdempotencyKey: "subscription-upgrade:syncing-replay-active-reservation",
		EffectiveAt:            common.GetTimestamp(),
	}
	require.NoError(t, model.DB.Create(intent).Error)
	require.NoError(t, model.DB.Model(contract).Update("latest_change_intent_id", intent.Id).Error)
	reservation, _, err := model.ReserveSubscriptionProviderLifecycle(
		binding.Id,
		binding.UserId,
		binding.ProviderSubscriptionId,
		binding.LifecycleActionSeq,
		model.SubscriptionProviderLifecycleActionCancel,
		"syncing-replay-active-reservation",
		300,
	)
	require.NoError(t, err)
	require.NotNil(t, reservation)

	originalUpgrade := stripeSubscriptionUpgradeExecutor
	t.Cleanup(func() { stripeSubscriptionUpgradeExecutor = originalUpgrade })
	var upgradeCalls atomic.Int32
	stripeSubscriptionUpgradeExecutor = func(context.Context, StripeSubscriptionUpgradeInput) (*StripeSubscriptionUpgradeResult, error) {
		upgradeCalls.Add(1)
		return nil, errors.New("syncing replay reached Stripe upgrade executor")
	}

	result, err := ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:      contract.UserId,
		PlanID:      targetPlan.Id,
		PaymentMode: model.SubscriptionPaymentModeStripeRecurring,
		RequestID:   intent.RequestId,
	})

	require.ErrorIs(t, err, ErrSubscriptionChangeInProgress)
	require.Nil(t, result)
	require.Zero(t, upgradeCalls.Load())
	var reloadedIntent model.SubscriptionChangeIntent
	require.NoError(t, model.DB.First(&reloadedIntent, "id = ?", intent.Id).Error)
	require.Equal(t, model.SubscriptionChangeIntentStatusSyncing, reloadedIntent.Status)
	var intentCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionChangeIntent{}).
		Where("user_id = ?", contract.UserId).
		Count(&intentCount).Error)
	require.Equal(t, int64(1), intentCount)
}

func countSubscriptionChangeIntentCreates(t *testing.T) *atomic.Int32 {
	t.Helper()
	var count atomic.Int32
	callbackName := "test:subscription_change_intent_creates:" + t.Name()
	require.NoError(t, model.DB.Callback().Create().Before("gorm:create").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "subscription_change_intents" {
			count.Add(1)
		}
	}))
	t.Cleanup(func() {
		require.NoError(t, model.DB.Callback().Create().Remove(callbackName))
	})
	return &count
}
