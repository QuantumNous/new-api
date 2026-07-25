package service

import (
	"context"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupSubscriptionPurchaseServiceTestDB(t *testing.T) {
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
		&model.SubscriptionTermSegment{},
		&model.WalletLedgerEntry{},
	))
}

func insertPurchaseServiceUser(t *testing.T, id int, quota int) {
	t.Helper()
	require.NoError(t, model.DB.Create(&model.User{
		Id:       id,
		Username: "purchase_user_" + t.Name(),
		Status:   common.UserStatusEnabled,
		Quota:    quota,
		Group:    "plg",
		AffCode:  "purchase_aff_" + t.Name(),
	}).Error)
}

func insertPurchaseServicePlan(t *testing.T, id int, rank int, price float64, total int64) model.SubscriptionPlan {
	t.Helper()
	plan := model.SubscriptionPlan{
		Id:                  id,
		Title:               "Purchase Plan",
		PriceAmount:         price,
		Currency:            "USD",
		DurationUnit:        model.SubscriptionDurationMonth,
		DurationValue:       1,
		Enabled:             true,
		TierRank:            &rank,
		AllowBalancePay:     common.GetPointer(true),
		TotalAmount:         total,
		Window5hAmount:      50,
		WindowWeekAmount:    500,
		MediaCreditsMonthly: 25,
	}
	require.NoError(t, model.DB.Create(&plan).Error)
	return plan
}

func purchaseBalanceCommand(userID int, planID int, months int, requestID string) PurchaseSubscriptionCommand {
	return PurchaseSubscriptionCommand{
		UserID:        userID,
		PlanID:        planID,
		PaymentChoice: SubscriptionPaymentChoiceBalance,
		Months:        months,
		RequestID:     requestID,
	}
}

func TestPurchaseSubscriptionRejectsMonthsOutsideOneToTwelve(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7301, 5000)
	plan := insertPurchaseServicePlan(t, 7401, 1, 1, 100)

	for _, months := range []int{0, 13} {
		cmd := purchaseBalanceCommand(7301, plan.Id, months, "bad-months")
		_, err := PurchaseSubscription(cmd)
		require.Error(t, err)
		require.Contains(t, err.Error(), "months")
	}
}

func TestPurchaseSubscriptionStripeRecurringForcesOneMonth(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7302, 5000)
	plan := insertPurchaseServicePlan(t, 7402, 1, 1, 100)

	_, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7302,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceStripeRecurring,
		Months:        2,
		RequestID:     "stripe-two-months",
	})

	require.Error(t, err)
	require.Contains(t, err.Error(), "stripe_recurring")
	require.Contains(t, err.Error(), "1")
}

func TestPurchaseSubscriptionStripeRecurringReturnsCheckoutURL(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7318, 5000)
	plan := insertPurchaseServicePlan(t, 7421, 1, 19.99, 100)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("stripe_price_id", "price_purchase_checkout").Error)

	originalCreator := stripeSubscriptionCheckoutCreator
	t.Cleanup(func() { stripeSubscriptionCheckoutCreator = originalCreator })
	stripeSubscriptionCheckoutCreator = func(_ context.Context, _ StripeSubscriptionCheckoutInput) (*StripeSubscriptionCheckoutSession, error) {
		return &StripeSubscriptionCheckoutSession{
			ID:  "cs_purchase_checkout",
			URL: "https://checkout.stripe.test/purchase-subscription",
		}, nil
	}

	result, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7318,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceStripeRecurring,
		Months:        1,
		RequestID:     "stripe-purchase-checkout",
	})

	require.NoError(t, err)
	require.Equal(t, ChangePlanStatusCheckoutRequired, result.Status)
	require.Equal(t, "https://checkout.stripe.test/purchase-subscription", result.CheckoutURL)
}

func TestPurchaseSubscriptionStripeRecurringPropagatesClientSecret(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	originalPublishableKey := setting.StripePublishableKey
	setting.StripePublishableKey = "pk_test_embedded"
	t.Cleanup(func() { setting.StripePublishableKey = originalPublishableKey })
	insertPurchaseServiceUser(t, 7324, 5000)
	plan := insertPurchaseServicePlan(t, 7424, 1, 19.99, 100)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("stripe_price_id", "price_purchase_embedded").Error)

	originalCreator := stripeSubscriptionCheckoutCreator
	t.Cleanup(func() { stripeSubscriptionCheckoutCreator = originalCreator })
	stripeSubscriptionCheckoutCreator = func(_ context.Context, input StripeSubscriptionCheckoutInput) (*StripeSubscriptionCheckoutSession, error) {
		require.Equal(t, "embedded", input.Presentation.RequestedUIMode)
		return &StripeSubscriptionCheckoutSession{
			ID:           "cs_purchase_embedded",
			ClientSecret: "cs_secret_purchase_embedded",
		}, nil
	}

	result, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7324,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceStripeRecurring,
		Months:        1,
		RequestID:     "stripe-purchase-embedded",
		UIMode:        "embedded",
	})

	require.NoError(t, err)
	require.Equal(t, ChangePlanStatusCheckoutRequired, result.Status)
	require.Empty(t, result.CheckoutURL)
	require.Equal(t, "cs_secret_purchase_embedded", result.ClientSecret)
}

func TestPurchaseSubscriptionStripeRecurringReturnsHostedInvoiceURL(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7319, 5000)
	currentPlan := insertPurchaseServicePlan(t, 7422, 1, 9.99, 100)
	targetPlan := insertPurchaseServicePlan(t, 7423, 2, 19.99, 200)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", currentPlan.Id).
		Update("stripe_price_id", "price_purchase_current").Error)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", targetPlan.Id).
		Update("stripe_price_id", "price_purchase_target").Error)
	currentPlan.StripePriceId = "price_purchase_current"
	targetPlan.StripePriceId = "price_purchase_target"
	_, binding, _ := seedStripeUpgradeContract(t, 7319, currentPlan)

	originalUpgrade := stripeSubscriptionUpgradeExecutor
	t.Cleanup(func() { stripeSubscriptionUpgradeExecutor = originalUpgrade })
	stripeSubscriptionUpgradeExecutor = func(_ context.Context, input StripeSubscriptionUpgradeInput) (*StripeSubscriptionUpgradeResult, error) {
		return &StripeSubscriptionUpgradeResult{
			Status:            model.SubscriptionChangeIntentStatusAwaitingPayment,
			ProviderInvoiceID: "in_purchase_upgrade",
			HostedInvoiceURL:  "https://invoice.stripe.test/purchase-upgrade",
			Snapshot: model.ProviderSubscriptionSnapshot{
				ProviderSubscriptionId:     input.ProviderSubscriptionID,
				ProviderSubscriptionItemId: input.ProviderSubscriptionItemID,
				ProviderCustomerId:         binding.ProviderCustomerId,
				ProviderPriceId:            currentPlan.StripePriceId,
				ProviderLatestInvoiceId:    "in_purchase_upgrade",
				ProviderStatus:             "active",
				CurrentPeriodStart:         binding.CurrentPeriodStart,
				CurrentPeriodEnd:           binding.CurrentPeriodEnd,
			},
		}, nil
	}

	result, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7319,
		PlanID:        targetPlan.Id,
		PaymentChoice: SubscriptionPaymentChoiceStripeRecurring,
		Months:        1,
		RequestID:     "stripe-purchase-upgrade",
	})

	require.NoError(t, err)
	require.Equal(t, ChangePlanStatusPaymentActionRequired, result.Status)
	require.Equal(t, "https://invoice.stripe.test/purchase-upgrade", result.HostedInvoiceURL)
}

func TestPurchaseSubscriptionBalanceThreeMonthsChargesFullPriceOnce(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7303, 1000)
	plan := insertPurchaseServicePlan(t, 7403, 1, 2, 200)

	result, err := PurchaseSubscription(purchaseBalanceCommand(7303, plan.Id, 3, "balance-three"))

	require.NoError(t, err)
	require.NotNil(t, result.Order)
	require.Equal(t, 3, result.Order.PurchaseMonths)
	require.Equal(t, float64(2), result.Order.UnitPrice)
	require.Equal(t, float64(6), result.Order.Money)
	require.Equal(t, "USD", result.Order.PaymentCurrency)
	require.Equal(t, int64(600), result.Order.PaymentAmountMinor)
	require.Equal(t, common.TopUpStatusSuccess, result.Order.Status)
	require.Equal(t, model.SubscriptionRenewalSourceWallet, result.Order.RenewalSource)
	require.Equal(t, model.PaymentProviderBalance, result.Order.PaymentProvider)

	var user model.User
	require.NoError(t, model.DB.First(&user, "id = ?", 7303).Error)
	require.Equal(t, 400, user.Quota)

	var terms []model.SubscriptionTermSegment
	require.NoError(t, model.DB.Where("order_id = ?", result.Order.Id).Order("segment_index asc").Find(&terms).Error)
	require.Len(t, terms, 3)
	require.Equal(t, model.SubscriptionTermStatusActive, terms[0].Status)
	require.Equal(t, model.SubscriptionTermStatusNotStarted, terms[1].Status)
	require.Equal(t, model.SubscriptionTermStatusNotStarted, terms[2].Status)
	require.Equal(t, float64(2), terms[0].AllocatedMoney)

	require.NotNil(t, result.Entitlement)
	require.Equal(t, int64(25), result.Entitlement.MediaCreditsTotal)
	require.Zero(t, result.Entitlement.MediaCreditsUsed)
}

func TestPurchaseSubscriptionSamePlanImmediatelyReplacesWithoutProration(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7304, 1000)
	plan := insertPurchaseServicePlan(t, 7404, 1, 2, 200)
	first, err := PurchaseSubscription(purchaseBalanceCommand(7304, plan.Id, 3, "same-plan-first"))
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("id = ?", first.Entitlement.Id).
		Updates(map[string]interface{}{"amount_used": 77, "media_credits_used": 9}).Error)

	second, err := PurchaseSubscription(purchaseBalanceCommand(7304, plan.Id, 1, "same-plan-second"))

	require.NoError(t, err)
	require.Equal(t, first.Contract.Id, second.Contract.Id)
	require.NotEqual(t, first.Entitlement.Id, second.Entitlement.Id)
	require.Zero(t, second.Entitlement.AmountUsed)
	require.Zero(t, second.Entitlement.MediaCreditsUsed)
	require.Equal(t, float64(2), second.Order.Money)

	var oldActive model.SubscriptionTermSegment
	require.NoError(t, model.DB.Where("order_id = ? AND segment_index = 0", first.Order.Id).First(&oldActive).Error)
	require.Equal(t, model.SubscriptionTermStatusReplaced, oldActive.Status)
	require.Nil(t, oldActive.RefundKey)
}

func TestPurchaseSubscriptionDifferentPlanChargesFullPriceAndReplaces(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7305, 1500)
	firstPlan := insertPurchaseServicePlan(t, 7405, 1, 2, 200)
	secondPlan := insertPurchaseServicePlan(t, 7406, 2, 4, 400)
	first, err := PurchaseSubscription(purchaseBalanceCommand(7305, firstPlan.Id, 1, "different-first"))
	require.NoError(t, err)

	second, err := PurchaseSubscription(purchaseBalanceCommand(7305, secondPlan.Id, 1, "different-second"))

	require.NoError(t, err)
	require.Equal(t, first.Contract.Id, second.Contract.Id)
	require.Equal(t, secondPlan.Id, second.Contract.CurrentPlanId)
	require.Equal(t, float64(4), second.Order.Money)

	var user model.User
	require.NoError(t, model.DB.First(&user, "id = ?", 7305).Error)
	require.Equal(t, 900, user.Quota)

	var oldActive model.SubscriptionTermSegment
	require.NoError(t, model.DB.Where("order_id = ? AND segment_index = 0", first.Order.Id).First(&oldActive).Error)
	require.Equal(t, model.SubscriptionTermStatusReplaced, oldActive.Status)
}

func TestPurchaseSubscriptionReplacementCreditsOnlyNotStartedSegments(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7306, 2000)
	firstPlan := insertPurchaseServicePlan(t, 7407, 1, 5, 500)
	secondPlan := insertPurchaseServicePlan(t, 7408, 2, 4, 400)
	first, err := PurchaseSubscription(purchaseBalanceCommand(7306, firstPlan.Id, 3, "credit-first"))
	require.NoError(t, err)

	second, err := PurchaseSubscription(purchaseBalanceCommand(7306, secondPlan.Id, 1, "credit-second"))

	require.NoError(t, err)
	require.Equal(t, float64(4), second.Order.Money)
	var user model.User
	require.NoError(t, model.DB.First(&user, "id = ?", 7306).Error)
	require.Equal(t, 1100, user.Quota)

	var oldTerms []model.SubscriptionTermSegment
	require.NoError(t, model.DB.Where("order_id = ?", first.Order.Id).Order("segment_index asc").Find(&oldTerms).Error)
	require.Len(t, oldTerms, 3)
	require.Equal(t, model.SubscriptionTermStatusReplaced, oldTerms[0].Status)
	require.Nil(t, oldTerms[0].RefundKey)
	require.Equal(t, model.SubscriptionTermStatusRefunded, oldTerms[1].Status)
	require.Equal(t, model.SubscriptionTermStatusRefunded, oldTerms[2].Status)
	require.NotNil(t, oldTerms[1].RefundKey)
	require.NotNil(t, oldTerms[2].RefundKey)

	var refundLedgers []model.WalletLedgerEntry
	require.NoError(t, model.DB.Where("user_id = ? AND entry_type = ?", 7306, model.WalletLedgerEntryTypePrepaidRefund).Find(&refundLedgers).Error)
	require.Len(t, refundLedgers, 2)
	require.Equal(t, int64(500), refundLedgers[0].QuotaDelta)
}

func TestRefundPrepaidTermsUsesCanonicalWalletMoneyForLocalCurrencyOrders(t *testing.T) {
	tests := []struct {
		name          string
		paymentMethod string
		currency      string
		localPrice    float64
	}{
		{name: "pix_brl", paymentMethod: SubscriptionPaymentChoicePix, currency: "BRL", localPrice: 49.90},
		{name: "upi_inr", paymentMethod: SubscriptionPaymentChoiceUPI, currency: "INR", localPrice: 830},
	}

	for index, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			setupSubscriptionPurchaseServiceTestDB(t)
			userID := 7330 + index
			planID := 7430 + index
			insertPurchaseServiceUser(t, userID, 0)
			plan := insertPurchaseServicePlan(t, planID, index+1, 10, 1000)
			contract := model.UserSubscriptionContract{
				UserId:        userID,
				Status:        model.SubscriptionContractStatusActive,
				PaymentMode:   model.SubscriptionPaymentModePrepaid,
				CurrentPlanId: plan.Id,
			}
			require.NoError(t, model.DB.Create(&contract).Error)
			order := model.SubscriptionOrder{
				UserId:             userID,
				PlanId:             plan.Id,
				Money:              subscriptionPurchaseMoney(test.localPrice, 2),
				TradeNo:            "local-currency-refund-" + test.name,
				PaymentMethod:      test.paymentMethod,
				PaymentProvider:    model.PaymentProviderStripe,
				Status:             common.TopUpStatusSuccess,
				CreateTime:         common.GetTimestamp(),
				PurchaseMonths:     2,
				UnitPrice:          test.localPrice,
				PaymentCurrency:    test.currency,
				PaymentAmountMinor: subscriptionPurchaseMinorAmount(subscriptionPurchaseMoney(test.localPrice, 2)),
			}
			require.NoError(t, model.DB.Create(&order).Error)

			periodStart := common.GetTimestamp()
			require.NoError(t, createPrepaidTermSegmentsTx(
				model.DB,
				contract.Id,
				order.Id,
				plan.Id,
				PrepaidTermAllocation{CanonicalWalletUnitPrice: plan.PriceAmount},
				periodStart,
				2,
			))

			refundedQuota, err := refundPrepaidNotStartedTermsTx(model.DB, userID, contract.Id)

			require.NoError(t, err)
			require.Equal(t, int64(1000), refundedQuota)
			var ledger model.WalletLedgerEntry
			require.NoError(t, model.DB.Where("user_id = ? AND entry_type = ?", userID, model.WalletLedgerEntryTypePrepaidRefund).First(&ledger).Error)
			require.Equal(t, float64(10), ledger.MoneyAmount)
			require.Equal(t, int64(1000), ledger.QuotaDelta)
			require.NotEqual(t, test.localPrice, ledger.MoneyAmount)
		})
	}
}

func TestPurchaseSubscriptionReplayReturnsOriginalResult(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7307, 1000)
	plan := insertPurchaseServicePlan(t, 7409, 1, 2, 200)

	first, err := PurchaseSubscription(purchaseBalanceCommand(7307, plan.Id, 2, "replay-request"))
	require.NoError(t, err)
	second, err := PurchaseSubscription(purchaseBalanceCommand(7307, plan.Id, 2, "replay-request"))

	require.NoError(t, err)
	require.Equal(t, first.Intent.Id, second.Intent.Id)
	require.Equal(t, first.Order.Id, second.Order.Id)
	require.Equal(t, first.Entitlement.Id, second.Entitlement.Id)
	var user model.User
	require.NoError(t, model.DB.First(&user, "id = ?", 7307).Error)
	require.Equal(t, 600, user.Quota)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 7307).Count(&orderCount).Error)
	require.Equal(t, int64(1), orderCount)
}

func TestPurchaseSubscriptionSameRequestIDDifferentPayloadConflicts(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7308, 2000)
	firstPlan := insertPurchaseServicePlan(t, 7410, 1, 2, 200)
	secondPlan := insertPurchaseServicePlan(t, 7411, 2, 3, 300)
	_, err := PurchaseSubscription(purchaseBalanceCommand(7308, firstPlan.Id, 1, "conflict-request"))
	require.NoError(t, err)

	_, err = PurchaseSubscription(purchaseBalanceCommand(7308, secondPlan.Id, 1, "conflict-request"))

	require.Error(t, err)
	require.Contains(t, err.Error(), "idempotency")
}

func TestPurchaseSubscriptionPixRequiresConfiguredLocalQuote(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7310, 1000)
	plan := insertPurchaseServicePlan(t, 7413, 1, 2, 200)

	_, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7310,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoicePix,
		Months:        1,
		RequestID:     "pix-unavailable",
	})

	require.Error(t, err)
	require.Contains(t, err.Error(), "quote")
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 7310).Count(&orderCount).Error)
	require.Zero(t, orderCount)
}

func TestPurchaseSubscriptionPixPersistsConfiguredBRLQuote(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7311, 1000)
	plan := insertPurchaseServicePlan(t, 7414, 1, 2, 200)
	originalResolver := subscriptionPurchaseQuoteResolver
	t.Cleanup(func() { subscriptionPurchaseQuoteResolver = originalResolver })
	subscriptionPurchaseQuoteResolver = func(plan model.SubscriptionPlan, choice string, months int) (SubscriptionPurchaseQuote, error) {
		require.Equal(t, SubscriptionPaymentChoicePix, choice)
		require.Equal(t, 2, months)
		return SubscriptionPurchaseQuote{
			Currency:           "BRL",
			UnitPrice:          11,
			Total:              22,
			PaymentAmountMinor: 2200,
		}, nil
	}

	result, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7311,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoicePix,
		Months:        2,
		RequestID:     "pix-brl",
	})

	require.NoError(t, err)
	require.Equal(t, common.TopUpStatusPending, result.Order.Status)
	require.Equal(t, SubscriptionPaymentChoicePix, result.Order.PaymentMethod)
	require.Equal(t, "BRL", result.Order.PaymentCurrency)
	require.Equal(t, int64(2200), result.Order.PaymentAmountMinor)
	require.Equal(t, float64(11), result.Order.UnitPrice)
	require.Equal(t, float64(22), result.Order.Money)
}

func TestPurchaseSubscriptionOneTimeUsesVerifiedQuoteWithoutReResolving(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7315, 1000)
	plan := insertPurchaseServicePlan(t, 7418, 1, 2, 200)
	originalResolver := subscriptionPurchaseQuoteResolver
	t.Cleanup(func() { subscriptionPurchaseQuoteResolver = originalResolver })
	subscriptionPurchaseQuoteResolver = func(plan model.SubscriptionPlan, choice string, months int) (SubscriptionPurchaseQuote, error) {
		return SubscriptionPurchaseQuote{
			Currency:           "BRL",
			UnitPrice:          88.88,
			Total:              177.76,
			PaymentAmountMinor: 17776,
		}, nil
	}

	result, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7315,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoicePix,
		Months:        2,
		RequestID:     "verified-pix-quote",
		VerifiedQuote: &SubscriptionPurchaseQuote{
			Currency:           "BRL",
			UnitPrice:          49.90,
			Total:              99.80,
			PaymentAmountMinor: 9980,
		},
	})

	require.NoError(t, err)
	require.Equal(t, SubscriptionPaymentChoicePix, result.Order.PaymentMethod)
	require.Equal(t, "BRL", result.Order.PaymentCurrency)
	require.Equal(t, float64(49.90), result.Order.UnitPrice)
	require.Equal(t, float64(99.80), result.Order.Money)
	require.Equal(t, int64(9980), result.Order.PaymentAmountMinor)
}

func TestPurchaseSubscriptionRejectsQuoteNotDerivedFromRoundedMonthlyMinorAmount(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7316, 1000)
	plan := insertPurchaseServicePlan(t, 7419, 1, 2, 200)

	_, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7316,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoicePix,
		Months:        3,
		RequestID:     "noncanonical-verified-pix-quote",
		VerifiedQuote: &SubscriptionPurchaseQuote{
			Currency:           "BRL",
			UnitPrice:          49.905001,
			Total:              149.715003,
			PaymentAmountMinor: 14972,
		},
	})

	require.Error(t, err)
	require.Contains(t, err.Error(), "monthly minor amount")
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 7316).Count(&orderCount).Error)
	require.Zero(t, orderCount)
}

func TestPurchaseSubscriptionNormalizesVerifiedQuoteDisplayAmountsToMinorUnits(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7317, 1000)
	plan := insertPurchaseServicePlan(t, 7420, 1, 2, 200)

	result, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7317,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoicePix,
		Months:        3,
		RequestID:     "normalize-verified-pix-quote",
		VerifiedQuote: &SubscriptionPurchaseQuote{
			Currency:           "BRL",
			UnitPrice:          49.904999,
			Total:              149.699999,
			PaymentAmountMinor: 14970,
		},
	})

	require.NoError(t, err)
	require.Equal(t, float64(49.90), result.Order.UnitPrice)
	require.Equal(t, float64(149.70), result.Order.Money)
	require.Equal(t, int64(14970), result.Order.PaymentAmountMinor)
}

func TestPurchaseSubscriptionUPIPersistsConfiguredINRQuote(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7312, 1000)
	plan := insertPurchaseServicePlan(t, 7415, 1, 2, 200)
	originalResolver := subscriptionPurchaseQuoteResolver
	t.Cleanup(func() { subscriptionPurchaseQuoteResolver = originalResolver })
	subscriptionPurchaseQuoteResolver = func(plan model.SubscriptionPlan, choice string, months int) (SubscriptionPurchaseQuote, error) {
		return SubscriptionPurchaseQuote{
			Currency:           "INR",
			UnitPrice:          180,
			Total:              540,
			PaymentAmountMinor: 54000,
		}, nil
	}

	result, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7312,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceUPI,
		Months:        3,
		RequestID:     "upi-inr",
	})

	require.NoError(t, err)
	require.Equal(t, SubscriptionPaymentChoiceUPI, result.Order.PaymentMethod)
	require.Equal(t, "INR", result.Order.PaymentCurrency)
	require.Equal(t, int64(54000), result.Order.PaymentAmountMinor)
	require.Equal(t, float64(180), result.Order.UnitPrice)
	require.Equal(t, float64(540), result.Order.Money)
}

func TestPurchaseSubscriptionOneTimeChoicesUseStripeProvider(t *testing.T) {
	tests := []struct {
		name     string
		choice   string
		currency string
		price    float64
	}{
		{name: "alipay", choice: SubscriptionPaymentChoiceAlipay, currency: "USD", price: 2},
		{name: "pix", choice: SubscriptionPaymentChoicePix, currency: "BRL", price: 11},
		{name: "upi", choice: SubscriptionPaymentChoiceUPI, currency: "INR", price: 180},
	}

	for index, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			setupSubscriptionPurchaseServiceTestDB(t)
			userID := 7320 + index
			planID := 7420 + index
			insertPurchaseServiceUser(t, userID, 1000)
			plan := insertPurchaseServicePlan(t, planID, index+1, 2, 200)
			originalResolver := subscriptionPurchaseQuoteResolver
			t.Cleanup(func() { subscriptionPurchaseQuoteResolver = originalResolver })
			subscriptionPurchaseQuoteResolver = func(plan model.SubscriptionPlan, choice string, months int) (SubscriptionPurchaseQuote, error) {
				return SubscriptionPurchaseQuote{
					Currency:           test.currency,
					UnitPrice:          test.price,
					Total:              test.price,
					PaymentAmountMinor: subscriptionPurchaseMinorAmount(test.price),
				}, nil
			}

			result, err := PurchaseSubscription(PurchaseSubscriptionCommand{
				UserID:        userID,
				PlanID:        plan.Id,
				PaymentChoice: test.choice,
				Months:        1,
				RequestID:     "stripe-provider-" + test.name,
			})

			require.NoError(t, err)
			require.Equal(t, common.TopUpStatusPending, result.Order.Status)
			require.Equal(t, model.PaymentProviderStripe, result.Order.PaymentProvider)
		})
	}
}

func TestQuoteSubscriptionPurchaseReturnsStructuredUnavailableForMissingLocalQuote(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7313, 1000)
	plan := insertPurchaseServicePlan(t, 7416, 1, 2, 200)

	quote, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        7313,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceUPI,
		Months:        1,
	})

	require.NoError(t, err)
	require.False(t, quote.Available)
	require.Contains(t, quote.UnavailableReason, "quote")
	require.Empty(t, quote.Currency)
	require.Zero(t, quote.PaymentAmountMinor)
}

func TestQuoteSubscriptionPurchaseUsesPlanLocalPricesForPixAndUPI(t *testing.T) {
	tests := []struct {
		name         string
		choice       string
		months       int
		pixPrice     *float64
		upiPrice     *float64
		wantCurrency string
		wantUnit     float64
		wantMinor    int64
	}{
		{name: "pix_go_three_months", choice: SubscriptionPaymentChoicePix, months: 3, pixPrice: common.GetPointer(49.90), wantCurrency: "BRL", wantUnit: 49.90, wantMinor: 14970},
		{name: "pix_pro_three_months", choice: SubscriptionPaymentChoicePix, months: 3, pixPrice: common.GetPointer(149.90), wantCurrency: "BRL", wantUnit: 149.90, wantMinor: 44970},
		{name: "pix_max_three_months", choice: SubscriptionPaymentChoicePix, months: 3, pixPrice: common.GetPointer(499.00), wantCurrency: "BRL", wantUnit: 499.00, wantMinor: 149700},
		{name: "upi_go_twelve_months", choice: SubscriptionPaymentChoiceUPI, months: 12, upiPrice: common.GetPointer(899.00), wantCurrency: "INR", wantUnit: 899.00, wantMinor: 1078800},
		{name: "upi_pro_twelve_months", choice: SubscriptionPaymentChoiceUPI, months: 12, upiPrice: common.GetPointer(2699.00), wantCurrency: "INR", wantUnit: 2699.00, wantMinor: 3238800},
		{name: "upi_max_twelve_months", choice: SubscriptionPaymentChoiceUPI, months: 12, upiPrice: common.GetPointer(8999.00), wantCurrency: "INR", wantUnit: 8999.00, wantMinor: 10798800},
	}

	for index, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			setupSubscriptionPurchaseServiceTestDB(t)
			userID := 7340 + index
			planID := 7440 + index
			insertPurchaseServiceUser(t, userID, 1000)
			plan := insertPurchaseServicePlan(t, planID, index+1, 9.99, 1000)
			require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).Updates(map[string]interface{}{
				"pix_price_brl": test.pixPrice,
				"upi_price_inr": test.upiPrice,
			}).Error)

			quote, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
				UserID:        userID,
				PlanID:        plan.Id,
				PaymentChoice: test.choice,
				Months:        test.months,
			})

			require.NoError(t, err)
			require.True(t, quote.Available)
			require.Equal(t, test.wantCurrency, quote.Currency)
			require.Equal(t, test.wantUnit, quote.UnitPrice)
			require.Equal(t, float64(test.wantMinor)/100, quote.Total)
			require.Equal(t, test.wantMinor, quote.PaymentAmountMinor)
		})
	}
}

func TestQuoteSubscriptionPurchaseReturnsDisplayQuoteAndRequotesMonths(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7314, 1000)
	plan := insertPurchaseServicePlan(t, 7417, 1, 2, 200)
	originalResolver := subscriptionPurchaseQuoteResolver
	t.Cleanup(func() { subscriptionPurchaseQuoteResolver = originalResolver })
	subscriptionPurchaseQuoteResolver = func(plan model.SubscriptionPlan, choice string, months int) (SubscriptionPurchaseQuote, error) {
		return SubscriptionPurchaseQuote{
			Currency:           "BRL",
			UnitPrice:          11,
			Total:              float64(11 * months),
			PaymentAmountMinor: int64(1100 * months),
		}, nil
	}

	oneMonth, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        7314,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoicePix,
		Months:        1,
	})
	require.NoError(t, err)
	threeMonths, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        7314,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoicePix,
		Months:        3,
	})

	require.NoError(t, err)
	require.True(t, oneMonth.Available)
	require.True(t, threeMonths.Available)
	require.Equal(t, "BRL", oneMonth.Currency)
	require.Equal(t, float64(11), oneMonth.UnitPrice)
	require.Equal(t, float64(11), oneMonth.Total)
	require.Equal(t, int64(1100), oneMonth.PaymentAmountMinor)
	require.Equal(t, float64(33), threeMonths.Total)
	require.Equal(t, int64(3300), threeMonths.PaymentAmountMinor)
}

func TestReplacementKeepsFiveHourAndSevenDayWindowKeys(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7309, 1000)
	plan := insertPurchaseServicePlan(t, 7412, 1, 2, 200)
	first, err := PurchaseSubscription(purchaseBalanceCommand(7309, plan.Id, 1, "window-first"))
	require.NoError(t, err)
	before, err := model.GetChargeableSubscriptionWindowInfo(7309, 1)
	require.NoError(t, err)

	second, err := PurchaseSubscription(purchaseBalanceCommand(7309, plan.Id, 1, "window-second"))
	require.NoError(t, err)
	after, err := model.GetChargeableSubscriptionWindowInfo(7309, 1)
	require.NoError(t, err)

	require.NotEqual(t, first.Entitlement.Id, second.Entitlement.Id)
	require.Equal(t, first.Contract.Id, second.Contract.Id)
	require.Equal(t, first.Contract.Id, before.ContractId)
	require.Equal(t, first.Contract.Id, after.ContractId)
	require.Equal(t, before.SubscriptionStart, after.SubscriptionStart)
	require.Equal(t, subscriptionWindowWeekKey(int(first.Contract.Id), 0), subscriptionWindowWeekKey(after.WindowIdentity(), 0))
}
