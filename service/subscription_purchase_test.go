package service

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"github.com/stripe/stripe-go/v86"
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
		&model.SubscriptionDiscountAccount{},
		&model.SubscriptionDiscountEntry{},
		&model.RecallEvent{},
		&model.RecallLifecycleEvent{},
		&model.QuotaLifecycleState{},
	))
}

func insertPurchaseServiceUser(t *testing.T, id int, quota int) {
	t.Helper()
	require.NoError(t, model.DB.Create(&model.User{
		Id:       id,
		Username: "purchase_user_" + t.Name(),
		Email:    strings.NewReplacer("/", "_", " ", "_").Replace(t.Name()) + "@example.com",
		Status:   common.UserStatusEnabled,
		Quota:    quota,
		Group:    "plg",
		AffCode:  "purchase_aff_" + t.Name(),
	}).Error)
}

func insertPurchaseServicePlan(t *testing.T, id int, rank int, price float64, total int64) model.SubscriptionPlan {
	t.Helper()
	model.InvalidateSubscriptionPlanCache(id)
	t.Cleanup(func() { model.InvalidateSubscriptionPlanCache(id) })
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
	plan := model.SubscriptionPlan{}
	if model.DB != nil {
		_ = model.DB.Where("id = ?", planID).First(&plan).Error
	}
	return PurchaseSubscriptionCommand{
		UserID:        userID,
		PlanID:        planID,
		PaymentChoice: SubscriptionPaymentChoiceBalance,
		Months:        months,
		RequestID:     requestID,
		VerifiedQuote: subscriptionPurchaseTestQuote("USD", plan.PriceAmount, months),
	}
}

func subscriptionPurchaseTestQuote(currency string, unitPrice float64, months int) *SubscriptionPurchaseQuote {
	unitMinor := subscriptionPurchaseMinorAmount(unitPrice)
	totalMinor := unitMinor * int64(months)
	return &SubscriptionPurchaseQuote{
		Currency:                 currency,
		UnitPrice:                float64(unitMinor) / 100,
		UnitAmountMinor:          unitMinor,
		OriginalTotal:            float64(totalMinor) / 100,
		OriginalTotalAmountMinor: totalMinor,
		Total:                    float64(totalMinor) / 100,
		PaymentAmountMinor:       totalMinor,
	}
}

func grantPurchaseServiceInvitationDiscount(t *testing.T, userID int, amountUSDMinor int64, key string) {
	t.Helper()
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		_, err := model.GrantSubscriptionDiscountTx(tx, model.SubscriptionDiscountGrantInput{
			UserID:          userID,
			USDMinor:        amountUSDMinor,
			EntryType:       model.SubscriptionDiscountEntryTypeGrantInvitee,
			SourceType:      "test_invitation",
			SourceKey:       key,
			IdempotencyKey:  key,
			PricingSnapshot: `{"source":"test"}`,
		})
		return err
	}))
}

func countPurchaseServiceDiscountEntries(t *testing.T, userID int) int64 {
	t.Helper()
	var count int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).Where("user_id = ?", userID).Count(&count).Error)
	return count
}

func purchaseQuoteFromResult(result *SubscriptionPurchaseQuoteResult) *SubscriptionPurchaseQuote {
	if result == nil {
		return nil
	}
	return &SubscriptionPurchaseQuote{
		Currency:                      result.Currency,
		UnitPrice:                     result.UnitPrice,
		UnitAmountMinor:               result.UnitAmountMinor,
		OriginalTotal:                 result.OriginalTotal,
		OriginalTotalAmountMinor:      result.OriginalTotalAmountMinor,
		DiscountKind:                  result.DiscountKind,
		DiscountAmount:                result.DiscountAmount,
		DiscountAmountMinor:           result.DiscountAmountMinor,
		Total:                         result.Total,
		PaymentAmountMinor:            result.PaymentAmountMinor,
		InvitationAvailableUSDMinor:   result.InvitationAvailableUSDMinor,
		InvitationDiscountUSDMinor:    result.InvitationDiscountUSDMinor,
		InvitationDiscountAmountMinor: result.InvitationDiscountAmountMinor,
		InvitationRemainingUSDMinor:   result.InvitationRemainingUSDMinor,
		OtherDiscountKind:             result.OtherDiscountKind,
		OtherDiscountAmountMinor:      result.OtherDiscountAmountMinor,
		RecallCampaignID:              result.RecallCampaignID,
		RecallRecipientID:             result.RecallRecipientID,
		RecallPromotionCodeID:         result.RecallPromotionCodeID,
	}
}

func firstTableIndex(tables []string, table string) int {
	for i, candidate := range tables {
		if candidate == table {
			return i
		}
	}
	return -1
}

func TestApplyRecallFirstMonthDiscountFailOpenWhenLookupDegraded(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	setRecallCampaignEnabled(t, true)
	require.True(t, operation_setting.IsRecallCampaignEnabled())
	require.NoError(t, model.DB.AutoMigrate(
		&model.RecallCampaign{},
		&model.RecallRecipient{},
		&model.RecallMessage{},
		&model.RecallEvent{},
	))
	require.NoError(t, model.DB.Migrator().DropTable(&model.RecallRecipient{}))
	insertPurchaseServiceUser(t, 7118, 3000)
	plan := insertPurchaseServicePlan(t, 7218, 1, 12.34, 1234)
	plan.StripePriceId = "price_recall_degraded"
	quote := *subscriptionPurchaseTestQuote("USD", plan.PriceAmount, 1)

	result, err := applyRecallFirstMonthDiscount(context.Background(), 7118, "buyer@example.com", plan, quote)

	require.NoError(t, err)
	require.Equal(t, quote, result)
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
	quoteResult, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        7318,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceStripeRecurring,
		Months:        1,
	})
	require.NoError(t, err)

	result, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7318,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceStripeRecurring,
		Months:        1,
		RequestID:     "stripe-purchase-checkout",
		VerifiedQuote: purchaseQuoteFromResult(quoteResult),
	})

	require.NoError(t, err)
	require.Equal(t, ChangePlanStatusCheckoutRequired, result.Status)
	require.Equal(t, "https://checkout.stripe.test/purchase-subscription", result.CheckoutURL)
}

func TestPurchaseSubscriptionStripeRecurringResolvesRecallPromotionCode(t *testing.T) {
	setupRecallCampaignTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(
		&model.SubscriptionProviderBinding{},
		&model.UserSubscriptionContract{},
		&model.SubscriptionChangeIntent{},
		&model.SubscriptionTermSegment{},
		&model.WalletLedgerEntry{},
		&model.SubscriptionDiscountAccount{},
		&model.SubscriptionDiscountEntry{},
		&model.RecallLifecycleEvent{},
		&model.QuotaLifecycleState{},
	))
	setRecallCampaignEnabled(t, true)
	now := time.Now().UTC()
	fixture := createRecallClaimFixture(t, now)
	require.NoError(t, model.DB.Create(&model.User{
		Id:       fixture.recipient.UserId,
		Username: "purchase_recall_user",
		Email:    fixture.recipient.EmailSnapshot,
		Status:   common.UserStatusEnabled,
		Group:    "plg",
		AffCode:  "purchase_recall_aff",
	}).Error)
	plan := insertPurchaseServicePlan(t, 7425, 1, 19.99, 100)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("stripe_price_id", "price_subscription").Error)

	originalCreator := stripeSubscriptionCheckoutCreator
	t.Cleanup(func() { stripeSubscriptionCheckoutCreator = originalCreator })
	stripeSubscriptionCheckoutCreator = func(_ context.Context, input StripeSubscriptionCheckoutInput) (*StripeSubscriptionCheckoutSession, error) {
		require.NotNil(t, input.RecallDiscount)
		require.Equal(t, "promo_recall", input.RecallDiscount.PromotionCodeID)
		require.Equal(t, fixture.campaign.Id, input.RecallDiscount.CampaignID)
		require.Equal(t, fixture.recipient.Id, input.RecallDiscount.RecipientID)
		return &StripeSubscriptionCheckoutSession{
			ID:  "cs_purchase_recall",
			URL: "https://checkout.stripe.test/purchase-recall",
		}, nil
	}
	quoteResult, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        fixture.recipient.UserId,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceStripeRecurring,
		Months:        1,
		RecallClaim:   fixture.claim,
	})
	require.NoError(t, err)

	result, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        fixture.recipient.UserId,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceStripeRecurring,
		Months:        1,
		RequestID:     "stripe-purchase-recall",
		RecallClaim:   fixture.claim,
		VerifiedQuote: purchaseQuoteFromResult(quoteResult),
	})

	require.NoError(t, err)
	require.Equal(t, ChangePlanStatusCheckoutRequired, result.Status)
}

func TestPurchaseSubscriptionStripeRecurringUsesJPYMinorUnitsForRecallSelection(t *testing.T) {
	setupSubscriptionRecallPurchaseTestDB(t)
	now := time.Now().UTC()
	user := model.User{
		Id:       742601,
		Username: "purchase_jpy_recall_user",
		Email:    "purchase-jpy-recall@example.com",
		Status:   common.UserStatusEnabled,
		Group:    "plg",
		AffCode:  "purchase_jpy_recall_aff",
	}
	require.NoError(t, model.DB.Create(&user).Error)
	highMinimum := createRecallOfferFixture(t, user, now.Add(-time.Minute), "jpy high minimum", model.RecallCampaignRunning,
		RecallDiscountConfig{Type: "fixed", AmountOff: 500, Currency: "JPY", MinimumAmount: 50000, MinimumAmountCurrency: "JPY"},
		RecallProductScope{SubscriptionPriceIDs: []string{"price_subscription_jpy"}}, nil)
	selected := createRecallOfferFixture(t, user, now, "jpy selected percent", model.RecallCampaignRunning,
		RecallDiscountConfig{Type: "percent", PercentOff: 20},
		RecallProductScope{SubscriptionPriceIDs: []string{"price_subscription_jpy"}}, nil)
	require.NotEqual(t, highMinimum.recipient.Id, selected.recipient.Id)
	plan := insertPurchaseServicePlan(t, 7426, 1, 1000, 100)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Updates(map[string]interface{}{"stripe_price_id": "price_subscription_jpy", "currency": "JPY"}).Error)

	originalCreator := stripeSubscriptionCheckoutCreator
	t.Cleanup(func() { stripeSubscriptionCheckoutCreator = originalCreator })
	stripeSubscriptionCheckoutCreator = func(_ context.Context, input StripeSubscriptionCheckoutInput) (*StripeSubscriptionCheckoutSession, error) {
		require.Equal(t, int64(1000), input.SubtotalMinor)
		require.NotNil(t, input.RecallDiscount)
		require.Equal(t, "promo_jpy_selected_percent", input.RecallDiscount.PromotionCodeID)
		require.Equal(t, selected.campaign.Id, input.RecallDiscount.CampaignID)
		require.Equal(t, selected.recipient.Id, input.RecallDiscount.RecipientID)
		return &StripeSubscriptionCheckoutSession{
			ID:  "cs_purchase_jpy_recall",
			URL: "https://checkout.stripe.test/purchase-jpy-recall",
		}, nil
	}
	quoteResult, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        user.Id,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceStripeRecurring,
		Months:        1,
	})
	require.NoError(t, err)

	result, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        user.Id,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceStripeRecurring,
		Months:        1,
		RequestID:     "stripe-purchase-jpy-recall",
		VerifiedQuote: purchaseQuoteFromResult(quoteResult),
	})

	require.NoError(t, err)
	require.Equal(t, ChangePlanStatusCheckoutRequired, result.Status)
}

func TestPurchaseSubscriptionStripeRecurringInvitationReservesAndPersistsQuoteBeforeStripe(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7326, 5000)
	plan := insertPurchaseServicePlan(t, 7426, 1, 10, 1000)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("stripe_price_id", "price_recurring_invitation").Error)
	grantPurchaseServiceInvitationDiscount(t, 7326, 525, "purchase-recurring-invitation")
	quoteResult, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        7326,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceStripeRecurring,
		Months:        1,
	})
	require.NoError(t, err)
	require.Equal(t, SubscriptionDiscountKindInvitation, quoteResult.DiscountKind)
	require.Equal(t, int64(525), quoteResult.DiscountAmountMinor)

	originalCreator := stripeSubscriptionCheckoutCreator
	t.Cleanup(func() { stripeSubscriptionCheckoutCreator = originalCreator })
	stripeSubscriptionCheckoutCreator = func(_ context.Context, input StripeSubscriptionCheckoutInput) (*StripeSubscriptionCheckoutSession, error) {
		require.Equal(t, SubscriptionDiscountKindInvitation, input.DiscountKind)
		require.Equal(t, int64(525), input.DiscountAmountMinor)
		require.Equal(t, "USD", input.DiscountCurrency)
		require.NotEmpty(t, input.DiscountReservationKey)

		var order model.SubscriptionOrder
		require.NoError(t, model.DB.First(&order, "trade_no = ?", input.TradeNo).Error)
		require.Equal(t, SubscriptionDiscountKindInvitation, order.DiscountKind)
		require.Equal(t, int64(525), order.SubscriptionDiscountUSDMinor)
		require.Equal(t, int64(525), order.SubscriptionDiscountAmountMinor)
		require.Equal(t, input.DiscountReservationKey, order.SubscriptionDiscountReservationKey)
		require.NotEmpty(t, order.PlanSnapshot)
		require.NotEmpty(t, order.DiscountPricingSnapshot)
		account, err := model.GetSubscriptionDiscountAccount(7326)
		require.NoError(t, err)
		require.Zero(t, account.AvailableUSDMinor)
		require.Equal(t, int64(525), account.ReservedUSDMinor)
		return &StripeSubscriptionCheckoutSession{ID: "cs_recurring_invitation", URL: "https://checkout.stripe.test/recurring-invitation"}, nil
	}

	result, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7326,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceStripeRecurring,
		Months:        1,
		RequestID:     "stripe-recurring-invitation",
		VerifiedQuote: purchaseQuoteFromResult(quoteResult),
	})

	require.NoError(t, err)
	require.Equal(t, ChangePlanStatusCheckoutRequired, result.Status)
	require.Equal(t, "https://checkout.stripe.test/recurring-invitation", result.CheckoutURL)
}

func TestPurchaseSubscriptionStripeRecurringInvitationStaleQuoteHasNoSideEffects(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7327, 5000)
	plan := insertPurchaseServicePlan(t, 7427, 1, 10, 1000)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("stripe_price_id", "price_recurring_invitation_stale").Error)
	grantPurchaseServiceInvitationDiscount(t, 7327, 525, "purchase-recurring-invitation-stale")
	quoteResult, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        7327,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceStripeRecurring,
		Months:        1,
	})
	require.NoError(t, err)
	staleQuote := purchaseQuoteFromResult(quoteResult)
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		_, reserveErr := model.ReserveSubscriptionDiscountTx(tx, model.SubscriptionDiscountReservationInput{
			UserID:             7327,
			USDMinor:           525,
			OrderID:            0,
			TradeNo:            "external",
			PaymentCurrency:    "USD",
			AppliedAmountMinor: 525,
			PricingSnapshot:    `{"source":"external"}`,
			IdempotencyKey:     "external-recurring-reservation",
			ExpiresAt:          common.GetTimestamp() + 300,
		})
		return reserveErr
	}))

	originalCreator := stripeSubscriptionCheckoutCreator
	var stripeCalls int
	t.Cleanup(func() { stripeSubscriptionCheckoutCreator = originalCreator })
	stripeSubscriptionCheckoutCreator = func(_ context.Context, _ StripeSubscriptionCheckoutInput) (*StripeSubscriptionCheckoutSession, error) {
		stripeCalls++
		return &StripeSubscriptionCheckoutSession{ID: "cs_unexpected", URL: "https://checkout.stripe.test/unexpected"}, nil
	}

	_, err = PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7327,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceStripeRecurring,
		Months:        1,
		RequestID:     "stripe-recurring-invitation-stale",
		VerifiedQuote: staleQuote,
	})

	require.Error(t, err)
	require.Contains(t, err.Error(), "quote")
	require.Zero(t, stripeCalls)
	var intents int64
	require.NoError(t, model.DB.Model(&model.SubscriptionChangeIntent{}).Where("user_id = ?", 7327).Count(&intents).Error)
	require.Zero(t, intents)
	var orders int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 7327).Count(&orders).Error)
	require.Zero(t, orders)
}

func TestPurchaseSubscriptionStripeRecurringNoDiscountStalePlanHasNoSideEffects(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7328, 5000)
	plan := insertPurchaseServicePlan(t, 7428, 1, 10, 1000)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("stripe_price_id", "price_recurring_no_discount_stale").Error)
	quoteResult, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        7328,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceStripeRecurring,
		Months:        1,
	})
	require.NoError(t, err)
	require.Equal(t, SubscriptionDiscountKindNone, quoteResult.DiscountKind)

	originalHook := subscriptionPurchaseAfterQuoteValidationHook
	originalCreator := stripeSubscriptionCheckoutCreator
	var hookCalls int
	var stripeCalls int
	t.Cleanup(func() {
		subscriptionPurchaseAfterQuoteValidationHook = originalHook
		stripeSubscriptionCheckoutCreator = originalCreator
	})
	subscriptionPurchaseAfterQuoteValidationHook = func() {
		hookCalls++
		require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
			Update("price_amount", 12.00).Error)
		model.InvalidateSubscriptionPlanCache(plan.Id)
	}
	stripeSubscriptionCheckoutCreator = func(_ context.Context, _ StripeSubscriptionCheckoutInput) (*StripeSubscriptionCheckoutSession, error) {
		stripeCalls++
		return &StripeSubscriptionCheckoutSession{ID: "cs_unexpected_no_discount_stale", URL: "https://checkout.stripe.test/unexpected-no-discount-stale"}, nil
	}

	_, err = PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7328,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceStripeRecurring,
		Months:        1,
		RequestID:     "stripe-recurring-no-discount-stale",
		VerifiedQuote: purchaseQuoteFromResult(quoteResult),
	})

	require.Error(t, err)
	require.ErrorIs(t, err, ErrSubscriptionPurchaseQuoteInvalid)
	require.Equal(t, 1, hookCalls)
	require.Zero(t, stripeCalls)
	assertNoRecurringCheckoutSideEffects(t, 7328)
}

func TestPurchaseSubscriptionStripeRecurringRecallStalePlanHasNoSideEffects(t *testing.T) {
	setupSubscriptionRecallPurchaseTestDB(t)
	now := time.Now().UTC()
	fixture := createRecallClaimFixture(t, now)
	require.NoError(t, model.DB.Create(&model.User{
		Id:       fixture.recipient.UserId,
		Username: "purchase_recall_stale_user",
		Email:    fixture.recipient.EmailSnapshot,
		Status:   common.UserStatusEnabled,
		Group:    "plg",
		AffCode:  "purchase_recall_stale_aff",
	}).Error)
	plan := insertPurchaseServicePlan(t, 7429, 1, 10, 1000)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("stripe_price_id", "price_subscription").Error)
	quoteResult, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        fixture.recipient.UserId,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceStripeRecurring,
		Months:        1,
		RecallClaim:   fixture.claim,
	})
	require.NoError(t, err)
	require.Equal(t, SubscriptionDiscountKindRecall, quoteResult.DiscountKind)

	originalHook := subscriptionPurchaseAfterQuoteValidationHook
	originalCreator := stripeSubscriptionCheckoutCreator
	var hookCalls int
	var stripeCalls int
	t.Cleanup(func() {
		subscriptionPurchaseAfterQuoteValidationHook = originalHook
		stripeSubscriptionCheckoutCreator = originalCreator
	})
	subscriptionPurchaseAfterQuoteValidationHook = func() {
		hookCalls++
		require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
			Update("price_amount", 12.00).Error)
		model.InvalidateSubscriptionPlanCache(plan.Id)
	}
	stripeSubscriptionCheckoutCreator = func(_ context.Context, _ StripeSubscriptionCheckoutInput) (*StripeSubscriptionCheckoutSession, error) {
		stripeCalls++
		return &StripeSubscriptionCheckoutSession{ID: "cs_unexpected_recall_stale", URL: "https://checkout.stripe.test/unexpected-recall-stale"}, nil
	}

	_, err = PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        fixture.recipient.UserId,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceStripeRecurring,
		Months:        1,
		RequestID:     "stripe-recurring-recall-stale",
		RecallClaim:   fixture.claim,
		VerifiedQuote: purchaseQuoteFromResult(quoteResult),
	})

	require.Error(t, err)
	require.ErrorIs(t, err, ErrSubscriptionPurchaseQuoteInvalid)
	require.Equal(t, 1, hookCalls)
	require.Zero(t, stripeCalls)
	assertNoRecurringCheckoutSideEffects(t, fixture.recipient.UserId)
	var recipient model.RecallRecipient
	require.NoError(t, model.DB.First(&recipient, "id = ?", fixture.recipient.Id).Error)
	require.NotEqual(t, model.RecallRecipientConverted, recipient.State)
	require.Zero(t, recipient.ConvertedAt)
}

func assertNoRecurringCheckoutSideEffects(t *testing.T, userID int) {
	t.Helper()
	var contracts int64
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("user_id = ?", userID).Count(&contracts).Error)
	require.Zero(t, contracts)
	var intents int64
	require.NoError(t, model.DB.Model(&model.SubscriptionChangeIntent{}).Where("user_id = ?", userID).Count(&intents).Error)
	require.Zero(t, intents)
	var orders int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", userID).Count(&orders).Error)
	require.Zero(t, orders)
	var entries int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).Where("user_id = ?", userID).Count(&entries).Error)
	require.Zero(t, entries)
}

func setupSubscriptionRecallPurchaseTestDB(t *testing.T) {
	t.Helper()
	setupRecallCampaignTestDB(t)
	originalQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 100
	t.Cleanup(func() { common.QuotaPerUnit = originalQuotaPerUnit })
	require.NoError(t, model.DB.AutoMigrate(
		&model.SubscriptionProviderBinding{},
		&model.UserSubscriptionContract{},
		&model.SubscriptionChangeIntent{},
		&model.SubscriptionTermSegment{},
		&model.WalletLedgerEntry{},
		&model.SubscriptionDiscountAccount{},
		&model.SubscriptionDiscountEntry{},
		&model.RecallLifecycleEvent{},
		&model.QuotaLifecycleState{},
	))
	setRecallCampaignEnabled(t, true)
}

func updateRecallFixtureDiscount(t *testing.T, campaignID int64, discount RecallDiscountConfig) {
	t.Helper()
	discountJSON, err := common.Marshal(discount)
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", campaignID).
		Update("discount_config", string(discountJSON)).Error)
}

func TestQuoteSubscriptionPurchaseRecallFirstMonthPercentDiscountsOnlyOneMonth(t *testing.T) {
	setupSubscriptionRecallPurchaseTestDB(t)
	now := time.Now().UTC()
	fixture := createRecallClaimFixture(t, now)
	insertPurchaseServiceUser(t, fixture.recipient.UserId, 50000)
	plan := insertPurchaseServicePlan(t, 7525, 1, 1, 100)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("stripe_price_id", "price_subscription").Error)

	quote, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        fixture.recipient.UserId,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceBalance,
		Months:        3,
	})

	require.NoError(t, err)
	require.True(t, quote.Available)
	require.Equal(t, "USD", quote.Currency)
	require.Equal(t, int64(100), quote.UnitAmountMinor)
	require.Equal(t, int64(300), quote.OriginalTotalAmountMinor)
	require.Equal(t, int64(20), quote.DiscountAmountMinor)
	require.Equal(t, int64(280), quote.PaymentAmountMinor)
	require.Equal(t, float64(1), quote.UnitPrice)
	require.Equal(t, float64(3), quote.OriginalTotal)
	require.Equal(t, float64(0.20), quote.DiscountAmount)
	require.Equal(t, float64(2.80), quote.Total)
	require.Equal(t, fixture.campaign.Id, quote.RecallCampaignID)
	require.Equal(t, fixture.recipient.Id, quote.RecallRecipientID)
}

func TestQuoteSubscriptionPurchaseRecallFirstMonthFixedDiscountHonorsCurrency(t *testing.T) {
	tests := []struct {
		name         string
		discount     RecallDiscountConfig
		wantDiscount int64
		wantTotal    int64
	}{
		{
			name:         "fixed_currency_matches",
			discount:     RecallDiscountConfig{Type: "fixed", AmountOff: 25, Currency: "USD"},
			wantDiscount: 25,
			wantTotal:    275,
		},
		{
			name:         "fixed_currency_mismatch_keeps_original_price",
			discount:     RecallDiscountConfig{Type: "fixed", AmountOff: 25, Currency: "BRL"},
			wantDiscount: 0,
			wantTotal:    300,
		},
	}

	for index, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			setupSubscriptionRecallPurchaseTestDB(t)
			now := time.Now().UTC()
			fixture := createRecallClaimFixture(t, now)
			updateRecallFixtureDiscount(t, fixture.campaign.Id, test.discount)
			insertPurchaseServiceUser(t, fixture.recipient.UserId, 50000)
			plan := insertPurchaseServicePlan(t, 7530+index, 1, 1, 100)
			require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
				Update("stripe_price_id", "price_subscription").Error)

			quote, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
				UserID:        fixture.recipient.UserId,
				PlanID:        plan.Id,
				PaymentChoice: SubscriptionPaymentChoiceBalance,
				Months:        3,
				RecallClaim:   fixture.claim,
			})

			require.NoError(t, err)
			require.True(t, quote.Available)
			require.Equal(t, test.wantDiscount, quote.DiscountAmountMinor)
			require.Equal(t, test.wantTotal, quote.PaymentAmountMinor)
		})
	}
}

func TestQuoteSubscriptionPurchaseInvitationQuoteIsReadOnlyAcrossPaymentChoices(t *testing.T) {
	tests := []struct {
		name            string
		choice          string
		pixPrice        *float64
		upiPrice        *float64
		planPrice       float64
		wantCurrency    string
		grantUSDMinor   int64
		wantOriginal    int64
		wantDiscount    int64
		wantDiscountUSD int64
		wantFinal       int64
	}{
		{name: "balance_usd", choice: SubscriptionPaymentChoiceBalance, planPrice: 20, wantCurrency: "USD", grantUSDMinor: 700, wantOriginal: 2000, wantDiscount: 700, wantDiscountUSD: 700, wantFinal: 1300},
		{name: "stripe_recurring_usd", choice: SubscriptionPaymentChoiceStripeRecurring, planPrice: 20, wantCurrency: "USD", grantUSDMinor: 700, wantOriginal: 2000, wantDiscount: 700, wantDiscountUSD: 700, wantFinal: 1300},
		{name: "pix_brl", choice: SubscriptionPaymentChoicePix, pixPrice: common.GetPointer(80.00), planPrice: 20, wantCurrency: "BRL", grantUSDMinor: 500, wantOriginal: 8000, wantDiscount: 2000, wantDiscountUSD: 500, wantFinal: 6000},
		{name: "upi_inr", choice: SubscriptionPaymentChoiceUPI, upiPrice: common.GetPointer(830.00), planPrice: 10, wantCurrency: "INR", grantUSDMinor: 250, wantOriginal: 83000, wantDiscount: 20750, wantDiscountUSD: 250, wantFinal: 62250},
	}

	for index, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			setupSubscriptionPurchaseServiceTestDB(t)
			userID := 7600 + index
			planID := 7700 + index
			insertPurchaseServiceUser(t, userID, 100000)
			plan := insertPurchaseServicePlan(t, planID, index+1, test.planPrice, 2000)
			require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).Updates(map[string]interface{}{
				"stripe_price_id": "price_invitation_" + test.name,
				"pix_price_brl":   test.pixPrice,
				"upi_price_inr":   test.upiPrice,
			}).Error)
			grantPurchaseServiceInvitationDiscount(t, userID, test.grantUSDMinor, "invitation-"+test.name)

			beforeEntries := countPurchaseServiceDiscountEntries(t, userID)
			first, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
				UserID:        userID,
				PlanID:        plan.Id,
				PaymentChoice: test.choice,
				Months:        1,
			})
			require.NoError(t, err)
			second, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
				UserID:        userID,
				PlanID:        plan.Id,
				PaymentChoice: test.choice,
				Months:        1,
			})

			require.NoError(t, err)
			require.True(t, first.Available)
			require.Equal(t, first, second)
			require.Equal(t, test.wantCurrency, first.Currency)
			require.Equal(t, test.wantOriginal, first.OriginalTotalAmountMinor)
			require.Equal(t, SubscriptionDiscountKindInvitation, first.DiscountKind)
			require.Equal(t, test.wantDiscount, first.DiscountAmountMinor)
			require.Equal(t, test.wantDiscount, first.InvitationDiscountAmountMinor)
			require.Equal(t, test.wantDiscountUSD, first.InvitationDiscountUSDMinor)
			require.Equal(t, test.grantUSDMinor, first.InvitationAvailableUSDMinor)
			require.Equal(t, test.wantFinal, first.PaymentAmountMinor)
			require.Zero(t, first.RecallCampaignID)
			require.Zero(t, first.RecallRecipientID)
			require.Equal(t, beforeEntries, countPurchaseServiceDiscountEntries(t, userID))
			account, err := model.GetSubscriptionDiscountAccount(userID)
			require.NoError(t, err)
			require.Equal(t, test.grantUSDMinor, account.AvailableUSDMinor)
			require.Zero(t, account.ReservedUSDMinor)
		})
	}
}

func TestQuoteSubscriptionPurchaseInvitationAndRecallSelection(t *testing.T) {
	tests := []struct {
		name                    string
		recallDiscount          RecallDiscountConfig
		wantKind                string
		wantSelected            int64
		wantInvitationRemaining int64
		wantRecallCampaign      bool
	}{
		{
			name:                    "invitation_wins_larger_local_reduction",
			recallDiscount:          RecallDiscountConfig{Type: "fixed", AmountOff: 500, Currency: "USD"},
			wantKind:                SubscriptionDiscountKindInvitation,
			wantSelected:            700,
			wantInvitationRemaining: 0,
		},
		{
			name:                    "recall_wins_larger_local_reduction",
			recallDiscount:          RecallDiscountConfig{Type: "fixed", AmountOff: 800, Currency: "USD"},
			wantKind:                SubscriptionDiscountKindRecall,
			wantSelected:            800,
			wantInvitationRemaining: 700,
			wantRecallCampaign:      true,
		},
		{
			name:                    "recall_wins_tie_to_preserve_invitation_credit",
			recallDiscount:          RecallDiscountConfig{Type: "fixed", AmountOff: 700, Currency: "USD"},
			wantKind:                SubscriptionDiscountKindRecall,
			wantSelected:            700,
			wantInvitationRemaining: 700,
			wantRecallCampaign:      true,
		},
	}

	for index, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			setupSubscriptionRecallPurchaseTestDB(t)
			now := time.Now().UTC()
			fixture := createRecallClaimFixture(t, now)
			updateRecallFixtureDiscount(t, fixture.campaign.Id, test.recallDiscount)
			insertPurchaseServiceUser(t, fixture.recipient.UserId, 100000)
			plan := insertPurchaseServicePlan(t, 7780+index, index+1, 20, 2000)
			require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
				Update("stripe_price_id", "price_subscription").Error)
			grantPurchaseServiceInvitationDiscount(t, fixture.recipient.UserId, 700, "invitation-selection-"+test.name)

			quote, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
				UserID:        fixture.recipient.UserId,
				PlanID:        plan.Id,
				PaymentChoice: SubscriptionPaymentChoiceBalance,
				Months:        1,
				RecallClaim:   fixture.claim,
			})

			require.NoError(t, err)
			require.True(t, quote.Available)
			require.Equal(t, test.wantKind, quote.DiscountKind)
			require.Equal(t, test.wantSelected, quote.DiscountAmountMinor)
			require.Equal(t, int64(700), quote.InvitationAvailableUSDMinor)
			require.Equal(t, test.wantInvitationRemaining, quote.InvitationRemainingUSDMinor)
			require.Equal(t, SubscriptionDiscountKindRecall, quote.OtherDiscountKind)
			require.Equal(t, test.recallDiscount.AmountOff, quote.OtherDiscountAmountMinor)
			if test.wantRecallCampaign {
				require.Equal(t, fixture.campaign.Id, quote.RecallCampaignID)
				require.Equal(t, fixture.recipient.Id, quote.RecallRecipientID)
			} else {
				require.Zero(t, quote.RecallCampaignID)
				require.Zero(t, quote.RecallRecipientID)
			}
		})
	}
}

func TestQuoteSubscriptionPurchaseRepairsMissingInviteeRegistrationGrantOnceWithSnapshot(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	originalMode := common.InviteRewardSubscriptionMode
	originalDiscount := common.InviteFirstSubDiscountUSD
	common.InviteRewardSubscriptionMode = true
	common.InviteFirstSubDiscountUSD = 7
	t.Cleanup(func() {
		common.InviteRewardSubscriptionMode = originalMode
		common.InviteFirstSubDiscountUSD = originalDiscount
	})

	inviterID := 7640
	userID := 7641
	require.NoError(t, model.DB.Create(&model.User{Id: inviterID, Username: "repair_inviter", Status: common.UserStatusEnabled, AffCode: "repair_inviter_aff"}).Error)
	require.NoError(t, model.DB.Create(&model.User{Id: userID, Username: "repair_invitee", Status: common.UserStatusEnabled, InviterId: inviterID, AffCode: "repair_invitee_aff"}).Error)
	plan := insertPurchaseServicePlan(t, 7740, 1, 20, 2000)

	first, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        userID,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceBalance,
		Months:        1,
	})
	require.NoError(t, err)
	common.InviteFirstSubDiscountUSD = 12
	second, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        userID,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceBalance,
		Months:        1,
	})

	require.NoError(t, err)
	require.Equal(t, SubscriptionDiscountKindInvitation, first.DiscountKind)
	require.Equal(t, int64(700), first.InvitationAvailableUSDMinor)
	require.Equal(t, int64(700), first.InvitationDiscountUSDMinor)
	require.Equal(t, int64(700), second.InvitationAvailableUSDMinor)
	require.Equal(t, int64(700), second.InvitationDiscountUSDMinor)
	require.Equal(t, int64(1), countPurchaseServiceDiscountEntries(t, userID))
	account, err := model.GetSubscriptionDiscountAccount(userID)
	require.NoError(t, err)
	require.Equal(t, int64(700), account.AvailableUSDMinor)
	require.Zero(t, account.ReservedUSDMinor)
}

func TestQuoteSubscriptionPurchaseRepairsMissingInviteeRegistrationGrantForAnyRewardState(t *testing.T) {
	tests := []struct {
		name              string
		inviteRewardState string
		inviterID         int
		wantGrant         bool
	}{
		{name: "granted_inviter_reward_still_repairs_invitee_discount", inviteRewardState: model.InviteRewardStatusGranted, inviterID: 7650, wantGrant: true},
		{name: "blocked_inviter_reward_still_repairs_invitee_discount", inviteRewardState: model.InviteRewardStatusBlocked, inviterID: 7655, wantGrant: true},
		{name: "no_inviter_does_not_grant", inviteRewardState: model.InviteRewardStatusGranted, inviterID: 0},
		{name: "invalid_inviter_does_not_grant", inviteRewardState: model.InviteRewardStatusBlocked, inviterID: 999999},
	}

	for index, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			setupSubscriptionPurchaseServiceTestDB(t)
			originalMode := common.InviteRewardSubscriptionMode
			originalDiscount := common.InviteFirstSubDiscountUSD
			common.InviteRewardSubscriptionMode = true
			common.InviteFirstSubDiscountUSD = 7
			t.Cleanup(func() {
				common.InviteRewardSubscriptionMode = originalMode
				common.InviteFirstSubDiscountUSD = originalDiscount
			})

			if test.inviterID > 0 && test.inviterID != 999999 {
				require.NoError(t, model.DB.Create(&model.User{Id: test.inviterID, Username: "repair_state_inviter", Status: common.UserStatusEnabled, AffCode: "repair_state_inviter_aff"}).Error)
			}
			userID := 7651 + index
			require.NoError(t, model.DB.Create(&model.User{
				Id:                 userID,
				Username:           "repair_state_invitee",
				Status:             common.UserStatusEnabled,
				InviterId:          test.inviterID,
				InviteRewardStatus: test.inviteRewardState,
				AffCode:            "repair_state_invitee_aff",
			}).Error)
			plan := insertPurchaseServicePlan(t, 7750+index, 1, 20, 2000)

			first, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
				UserID:        userID,
				PlanID:        plan.Id,
				PaymentChoice: SubscriptionPaymentChoiceBalance,
				Months:        1,
			})
			require.NoError(t, err)
			second, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
				UserID:        userID,
				PlanID:        plan.Id,
				PaymentChoice: SubscriptionPaymentChoiceBalance,
				Months:        1,
			})
			require.NoError(t, err)

			if test.wantGrant {
				require.Equal(t, SubscriptionDiscountKindInvitation, first.DiscountKind)
				require.Equal(t, int64(700), first.InvitationAvailableUSDMinor)
				require.Equal(t, int64(700), second.InvitationAvailableUSDMinor)
				require.Equal(t, int64(1), countPurchaseServiceDiscountEntries(t, userID))
			} else {
				require.Equal(t, SubscriptionDiscountKindNone, first.DiscountKind)
				require.Zero(t, first.InvitationAvailableUSDMinor)
				require.Zero(t, countPurchaseServiceDiscountEntries(t, userID))
			}
		})
	}
}

func TestPurchaseSubscriptionInvitationOneTimeReservesCreditAndPersistsQuoteSnapshot(t *testing.T) {
	tests := []struct {
		name         string
		choice       string
		wantCurrency string
		wantDiscount int64
		wantFinal    int64
	}{
		{name: "alipay", choice: SubscriptionPaymentChoiceAlipay, wantCurrency: "USD", wantDiscount: 700, wantFinal: 1300},
		{name: "pix", choice: SubscriptionPaymentChoicePix, wantCurrency: "BRL", wantDiscount: 2800, wantFinal: 5200},
		{name: "upi", choice: SubscriptionPaymentChoiceUPI, wantCurrency: "INR", wantDiscount: 29050, wantFinal: 53950},
		{name: "balance", choice: SubscriptionPaymentChoiceBalance, wantCurrency: "USD", wantDiscount: 700, wantFinal: 1300},
	}

	for index, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			setupSubscriptionPurchaseServiceTestDB(t)
			userID := 7660 + index
			planID := 7760 + index
			insertPurchaseServiceUser(t, userID, 100000)
			plan := insertPurchaseServicePlan(t, planID, 1, 20, 2000)
			require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).Updates(map[string]interface{}{
				"pix_price_brl": common.GetPointer(80.00),
				"upi_price_inr": common.GetPointer(830.00),
			}).Error)
			grantPurchaseServiceInvitationDiscount(t, userID, 700, "purchase-invitation-"+test.name)
			quote, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
				UserID:        userID,
				PlanID:        plan.Id,
				PaymentChoice: test.choice,
				Months:        1,
			})
			require.NoError(t, err)
			require.Equal(t, SubscriptionDiscountKindInvitation, quote.DiscountKind)
			accountBefore, err := model.GetSubscriptionDiscountAccount(userID)
			require.NoError(t, err)
			var hookCalls int
			originalHook := subscriptionPurchaseAfterQuoteValidationHook
			subscriptionPurchaseAfterQuoteValidationHook = func() { hookCalls++ }
			t.Cleanup(func() { subscriptionPurchaseAfterQuoteValidationHook = originalHook })

			result, err := PurchaseSubscription(PurchaseSubscriptionCommand{
				UserID:        userID,
				PlanID:        plan.Id,
				PaymentChoice: test.choice,
				Months:        1,
				RequestID:     "purchase-invitation-" + test.name,
				VerifiedQuote: purchaseQuoteFromResult(quote),
			})

			require.NoError(t, err)
			require.NotNil(t, result)
			require.NotNil(t, result.Order)
			require.Equal(t, 1, hookCalls)
			require.Equal(t, test.wantCurrency, result.Order.PaymentCurrency)
			require.Equal(t, test.wantFinal, result.Order.PaymentAmountMinor)
			require.Equal(t, SubscriptionDiscountKindInvitation, result.Order.DiscountKind)
			require.Equal(t, int64(700), result.Order.SubscriptionDiscountUSDMinor)
			require.Equal(t, test.wantDiscount, result.Order.SubscriptionDiscountAmountMinor)
			require.Equal(t, "subscription-order:"+result.Order.TradeNo+":reserve", result.Order.SubscriptionDiscountReservationKey)
			require.Contains(t, result.Order.DiscountPricingSnapshot, `"discount_kind":"invitation"`)
			accountAfter, err := model.GetSubscriptionDiscountAccount(userID)
			require.NoError(t, err)
			require.Equal(t, accountBefore.AvailableUSDMinor-700, accountAfter.AvailableUSDMinor)
			if test.choice == SubscriptionPaymentChoiceBalance {
				require.Zero(t, accountAfter.ReservedUSDMinor)
			} else {
				require.Equal(t, accountBefore.ReservedUSDMinor+700, accountAfter.ReservedUSDMinor)
			}
			var reserve model.SubscriptionDiscountEntry
			require.NoError(t, model.DB.Where("idempotency_key = ?", result.Order.SubscriptionDiscountReservationKey).First(&reserve).Error)
			require.Equal(t, model.SubscriptionDiscountEntryTypeReserve, reserve.EntryType)
			require.Equal(t, result.Order.Id, reserve.OrderID)
			require.Equal(t, result.Order.TradeNo, reserve.TradeNo)
			require.Equal(t, test.wantCurrency, reserve.PaymentCurrency)
			require.Equal(t, test.wantDiscount, reserve.AppliedAmountMinor)
		})
	}
}

func TestPurchaseSubscriptionInvitationRejectsTamperedOtherOfferFields(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7705, 100000)
	plan := insertPurchaseServicePlan(t, 7805, 1, 20, 2000)
	grantPurchaseServiceInvitationDiscount(t, 7705, 700, "purchase-invitation-tampered-other")
	quote, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        7705,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        1,
	})
	require.NoError(t, err)
	require.Equal(t, SubscriptionDiscountKindInvitation, quote.DiscountKind)
	tamperedQuote := purchaseQuoteFromResult(quote)
	tamperedQuote.OtherDiscountKind = SubscriptionDiscountKindRecall
	tamperedQuote.OtherDiscountAmountMinor = 600

	result, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7705,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        1,
		RequestID:     "purchase-invitation-tampered-other",
		VerifiedQuote: tamperedQuote,
	})

	require.Error(t, err)
	require.ErrorIs(t, err, ErrSubscriptionPurchaseQuoteInvalid)
	require.Nil(t, result)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 7705).Count(&orderCount).Error)
	require.Zero(t, orderCount)
	var reserveCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).
		Where("user_id = ? AND entry_type = ?", 7705, model.SubscriptionDiscountEntryTypeReserve).
		Count(&reserveCount).Error)
	require.Zero(t, reserveCount)
	account, err := model.GetSubscriptionDiscountAccount(7705)
	require.NoError(t, err)
	require.Equal(t, int64(700), account.AvailableUSDMinor)
	require.Zero(t, account.ReservedUSDMinor)
}

func TestPurchaseSubscriptionInvitationBalanceZeroFinalCommitsOnceWithoutWalletDebit(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7706, 100000)
	plan := insertPurchaseServicePlan(t, 7806, 1, 20, 2000)
	grantPurchaseServiceInvitationDiscount(t, 7706, 2500, "purchase-invitation-balance-zero")
	quote, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        7706,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceBalance,
		Months:        1,
	})
	require.NoError(t, err)
	require.Equal(t, SubscriptionDiscountKindInvitation, quote.DiscountKind)
	require.Equal(t, int64(2000), quote.InvitationDiscountUSDMinor)
	require.Zero(t, quote.PaymentAmountMinor)
	require.Equal(t, int64(500), quote.InvitationRemainingUSDMinor)

	first, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7706,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceBalance,
		Months:        1,
		RequestID:     "purchase-invitation-balance-zero",
		VerifiedQuote: purchaseQuoteFromResult(quote),
	})
	require.NoError(t, err)
	replay, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7706,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceBalance,
		Months:        1,
		RequestID:     "purchase-invitation-balance-zero",
		VerifiedQuote: purchaseQuoteFromResult(quote),
	})
	require.NoError(t, err)

	require.NotNil(t, first)
	require.NotNil(t, first.Order)
	require.NotNil(t, first.Entitlement)
	require.Equal(t, ChangePlanStatusApplied, first.Status)
	require.Equal(t, common.TopUpStatusSuccess, first.Order.Status)
	require.Zero(t, first.Order.PaymentAmountMinor)
	require.Empty(t, first.CheckoutURL)
	require.Empty(t, first.HostedInvoiceURL)
	require.Equal(t, first.Order.Id, replay.Order.Id)
	account, err := model.GetSubscriptionDiscountAccount(7706)
	require.NoError(t, err)
	require.Equal(t, int64(500), account.AvailableUSDMinor)
	require.Zero(t, account.ReservedUSDMinor)
	var commitCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).
		Where("terminal_reservation_key = ? AND entry_type = ?", first.Order.SubscriptionDiscountReservationKey, model.SubscriptionDiscountEntryTypeCommit).
		Count(&commitCount).Error)
	require.Equal(t, int64(1), commitCount)
	var debitCount int64
	require.NoError(t, model.DB.Model(&model.WalletLedgerEntry{}).
		Where("user_id = ? AND entry_type = ?", 7706, model.WalletLedgerEntryTypePrepaidDebit).
		Count(&debitCount).Error)
	require.Zero(t, debitCount)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 7706).Count(&orderCount).Error)
	require.Equal(t, int64(1), orderCount)
	var entitlementCount int64
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("user_id = ?", 7706).Count(&entitlementCount).Error)
	require.Equal(t, int64(1), entitlementCount)
}

func TestPurchaseSubscriptionInvitationInvalidReplacementDoesNotSupersedeExistingCheckout(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.TopUp{}))
	insertPurchaseServiceUser(t, 7708, 100000)
	plan := insertPurchaseServicePlan(t, 7808, 1, 20, 2000)
	grantPurchaseServiceInvitationDiscount(t, 7708, 4000, "purchase-invitation-invalid-replacement")
	firstQuote, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        7708,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        1,
	})
	require.NoError(t, err)
	first, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7708,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        1,
		RequestID:     "purchase-invitation-invalid-replacement-first",
		VerifiedQuote: purchaseQuoteFromResult(firstQuote),
	})
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).
		Where("id = ?", first.Order.Id).
		Update("provider_session_id", "cs_invitation_invalid_replacement_old").Error)
	replacementQuote, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        7708,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        1,
	})
	require.NoError(t, err)
	tamperedQuote := purchaseQuoteFromResult(replacementQuote)
	tamperedQuote.PaymentAmountMinor++
	tamperedQuote.Total = float64(tamperedQuote.PaymentAmountMinor) / 100
	var expireCalls int
	restoreStripeAccessors := ReplaceStripeCheckoutSessionAccessorsForTest(
		func(_ context.Context, sessionID string) (*stripe.CheckoutSession, error) {
			require.Equal(t, "cs_invitation_invalid_replacement_old", sessionID)
			return &stripe.CheckoutSession{ID: sessionID, Status: stripe.CheckoutSessionStatusOpen}, nil
		},
		func(_ context.Context, sessionID string) (*stripe.CheckoutSession, error) {
			expireCalls++
			return &stripe.CheckoutSession{ID: sessionID, Status: stripe.CheckoutSessionStatusExpired}, nil
		},
	)
	t.Cleanup(restoreStripeAccessors)
	var accountBefore model.SubscriptionDiscountAccount
	require.NoError(t, model.DB.First(&accountBefore, "user_id = ?", 7708).Error)
	var oldOrderBefore model.SubscriptionOrder
	require.NoError(t, model.DB.First(&oldOrderBefore, "id = ?", first.Order.Id).Error)
	var oldIntentBefore model.SubscriptionChangeIntent
	require.NoError(t, model.DB.First(&oldIntentBefore, "id = ?", first.Intent.Id).Error)
	var contractBefore model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&contractBefore, "id = ?", first.Contract.Id).Error)

	result, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7708,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        1,
		RequestID:     "purchase-invitation-invalid-replacement-second",
		VerifiedQuote: tamperedQuote,
	})

	require.Error(t, err)
	require.Nil(t, result)
	require.Zero(t, expireCalls)
	var oldOrderAfter model.SubscriptionOrder
	require.NoError(t, model.DB.First(&oldOrderAfter, "id = ?", first.Order.Id).Error)
	require.Equal(t, oldOrderBefore.Status, oldOrderAfter.Status)
	require.Equal(t, oldOrderBefore.CompleteTime, oldOrderAfter.CompleteTime)
	require.Equal(t, oldOrderBefore.SubscriptionDiscountReservationKey, oldOrderAfter.SubscriptionDiscountReservationKey)
	var oldIntentAfter model.SubscriptionChangeIntent
	require.NoError(t, model.DB.First(&oldIntentAfter, "id = ?", first.Intent.Id).Error)
	require.Equal(t, oldIntentBefore.Status, oldIntentAfter.Status)
	require.Equal(t, oldIntentBefore.SupersededById, oldIntentAfter.SupersededById)
	var contractAfter model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&contractAfter, "id = ?", first.Contract.Id).Error)
	require.Equal(t, contractBefore.LatestChangeIntentId, contractAfter.LatestChangeIntentId)
	var accountAfter model.SubscriptionDiscountAccount
	require.NoError(t, model.DB.First(&accountAfter, "user_id = ?", 7708).Error)
	require.Equal(t, accountBefore.AvailableUSDMinor, accountAfter.AvailableUSDMinor)
	require.Equal(t, accountBefore.ReservedUSDMinor, accountAfter.ReservedUSDMinor)
	var releaseCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).
		Where("terminal_reservation_key = ? AND entry_type = ?", first.Order.SubscriptionDiscountReservationKey, model.SubscriptionDiscountEntryTypeRelease).
		Count(&releaseCount).Error)
	require.Zero(t, releaseCount)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 7708).Count(&orderCount).Error)
	require.Equal(t, int64(1), orderCount)
}

func TestPurchaseSubscriptionInvitationReplacementTransactionFailureKeepsExistingCheckout(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.TopUp{}))
	insertPurchaseServiceUser(t, 7709, 100000)
	plan := insertPurchaseServicePlan(t, 7809, 1, 20, 2000)
	grantPurchaseServiceInvitationDiscount(t, 7709, 4000, "purchase-invitation-replacement-rollback")
	firstQuote, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        7709,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        1,
	})
	require.NoError(t, err)
	first, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7709,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        1,
		RequestID:     "purchase-invitation-replacement-rollback-first",
		VerifiedQuote: purchaseQuoteFromResult(firstQuote),
	})
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).
		Where("id = ?", first.Order.Id).
		Update("provider_session_id", "cs_invitation_replacement_rollback_old").Error)
	replacementQuote, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        7709,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        1,
	})
	require.NoError(t, err)
	var expireCalls int
	restoreStripeAccessors := ReplaceStripeCheckoutSessionAccessorsForTest(
		func(_ context.Context, sessionID string) (*stripe.CheckoutSession, error) {
			require.Equal(t, "cs_invitation_replacement_rollback_old", sessionID)
			return &stripe.CheckoutSession{ID: sessionID, Status: stripe.CheckoutSessionStatusOpen}, nil
		},
		func(_ context.Context, sessionID string) (*stripe.CheckoutSession, error) {
			expireCalls++
			return &stripe.CheckoutSession{ID: sessionID, Status: stripe.CheckoutSessionStatusExpired}, nil
		},
	)
	t.Cleanup(restoreStripeAccessors)
	originalHook := subscriptionPurchaseAfterQuoteValidationHook
	t.Cleanup(func() { subscriptionPurchaseAfterQuoteValidationHook = originalHook })
	subscriptionPurchaseAfterQuoteValidationHook = func() {
		require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
			Update("price_amount", 30.00).Error)
		model.InvalidateSubscriptionPlanCache(plan.Id)
	}
	var accountBefore model.SubscriptionDiscountAccount
	require.NoError(t, model.DB.First(&accountBefore, "user_id = ?", 7709).Error)
	var oldOrderBefore model.SubscriptionOrder
	require.NoError(t, model.DB.First(&oldOrderBefore, "id = ?", first.Order.Id).Error)
	var oldIntentBefore model.SubscriptionChangeIntent
	require.NoError(t, model.DB.First(&oldIntentBefore, "id = ?", first.Intent.Id).Error)
	var contractBefore model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&contractBefore, "id = ?", first.Contract.Id).Error)

	result, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7709,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        1,
		RequestID:     "purchase-invitation-replacement-rollback-second",
		VerifiedQuote: purchaseQuoteFromResult(replacementQuote),
	})

	require.Error(t, err)
	require.Nil(t, result)
	require.Zero(t, expireCalls)
	var oldOrderAfter model.SubscriptionOrder
	require.NoError(t, model.DB.First(&oldOrderAfter, "id = ?", first.Order.Id).Error)
	require.Equal(t, oldOrderBefore.Status, oldOrderAfter.Status)
	require.Equal(t, oldOrderBefore.CompleteTime, oldOrderAfter.CompleteTime)
	require.Equal(t, oldOrderBefore.SubscriptionDiscountReservationKey, oldOrderAfter.SubscriptionDiscountReservationKey)
	var oldIntentAfter model.SubscriptionChangeIntent
	require.NoError(t, model.DB.First(&oldIntentAfter, "id = ?", first.Intent.Id).Error)
	require.Equal(t, oldIntentBefore.Status, oldIntentAfter.Status)
	require.Equal(t, oldIntentBefore.SupersededById, oldIntentAfter.SupersededById)
	var contractAfter model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&contractAfter, "id = ?", first.Contract.Id).Error)
	require.Equal(t, contractBefore.LatestChangeIntentId, contractAfter.LatestChangeIntentId)
	var accountAfter model.SubscriptionDiscountAccount
	require.NoError(t, model.DB.First(&accountAfter, "user_id = ?", 7709).Error)
	require.Equal(t, accountBefore.AvailableUSDMinor, accountAfter.AvailableUSDMinor)
	require.Equal(t, accountBefore.ReservedUSDMinor, accountAfter.ReservedUSDMinor)
	var releaseCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).
		Where("terminal_reservation_key = ? AND entry_type = ?", first.Order.SubscriptionDiscountReservationKey, model.SubscriptionDiscountEntryTypeRelease).
		Count(&releaseCount).Error)
	require.Zero(t, releaseCount)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 7709).Count(&orderCount).Error)
	require.Equal(t, int64(1), orderCount)
}

func TestPurchaseSubscriptionInvitationReplacementStripeExpirationFailureKeepsExistingCheckout(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.TopUp{}))
	insertPurchaseServiceUser(t, 7711, 100000)
	plan := insertPurchaseServicePlan(t, 7811, 1, 20, 2000)
	grantPurchaseServiceInvitationDiscount(t, 7711, 4000, "purchase-invitation-expire-retry")
	firstQuote, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        7711,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        1,
	})
	require.NoError(t, err)
	first, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7711,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        1,
		RequestID:     "purchase-invitation-expire-retry-first",
		VerifiedQuote: purchaseQuoteFromResult(firstQuote),
	})
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).
		Where("id = ?", first.Order.Id).
		Update("provider_session_id", "cs_invitation_expire_retry_old").Error)
	replacementQuote, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        7711,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        1,
	})
	require.NoError(t, err)
	var expireCalls int
	restoreStripeAccessors := ReplaceStripeCheckoutSessionAccessorsForTest(
		func(_ context.Context, sessionID string) (*stripe.CheckoutSession, error) {
			require.Equal(t, "cs_invitation_expire_retry_old", sessionID)
			return &stripe.CheckoutSession{ID: sessionID, Status: stripe.CheckoutSessionStatusOpen}, nil
		},
		func(_ context.Context, sessionID string) (*stripe.CheckoutSession, error) {
			expireCalls++
			if expireCalls == 1 {
				return nil, errors.New("temporary stripe expiration failure")
			}
			return &stripe.CheckoutSession{ID: sessionID, Status: stripe.CheckoutSessionStatusExpired}, nil
		},
	)
	t.Cleanup(restoreStripeAccessors)
	replacementCmd := PurchaseSubscriptionCommand{
		UserID:        7711,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        1,
		RequestID:     "purchase-invitation-expire-retry-second",
		VerifiedQuote: purchaseQuoteFromResult(replacementQuote),
	}

	result, err := PurchaseSubscription(replacementCmd)

	require.Error(t, err)
	require.Nil(t, result)
	require.Equal(t, 1, expireCalls)
	var oldOrder model.SubscriptionOrder
	require.NoError(t, model.DB.First(&oldOrder, "id = ?", first.Order.Id).Error)
	require.Equal(t, common.TopUpStatusPending, oldOrder.Status)
	require.False(t, oldOrder.ProviderExpirationPending)
	require.Empty(t, oldOrder.SupersededByTradeNo)
	accountAfterFailure, err := model.GetSubscriptionDiscountAccount(7711)
	require.NoError(t, err)
	require.Equal(t, int64(2000), accountAfterFailure.AvailableUSDMinor)
	require.Equal(t, int64(2000), accountAfterFailure.ReservedUSDMinor)
	var releaseCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).
		Where("terminal_reservation_key = ? AND entry_type = ?", first.Order.SubscriptionDiscountReservationKey, model.SubscriptionDiscountEntryTypeRelease).
		Count(&releaseCount).Error)
	require.Zero(t, releaseCount)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 7711).Count(&orderCount).Error)
	require.Equal(t, int64(1), orderCount)
}

func TestPurchaseSubscriptionInvitationReplacementLatePaidCheckoutKeepsExistingCheckout(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.TopUp{}))
	insertPurchaseServiceUser(t, 7713, 100000)
	plan := insertPurchaseServicePlan(t, 7813, 1, 20, 2000)
	grantPurchaseServiceInvitationDiscount(t, 7713, 4000, "purchase-invitation-late-paid")
	firstQuote, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        7713,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        1,
	})
	require.NoError(t, err)
	first, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7713,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        1,
		RequestID:     "purchase-invitation-late-paid-first",
		VerifiedQuote: purchaseQuoteFromResult(firstQuote),
	})
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).
		Where("id = ?", first.Order.Id).
		Update("provider_session_id", "cs_invitation_late_paid_old").Error)
	replacementQuote, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        7713,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        1,
	})
	require.NoError(t, err)
	var expireCalls int
	restoreStripeAccessors := ReplaceStripeCheckoutSessionAccessorsForTest(
		func(_ context.Context, sessionID string) (*stripe.CheckoutSession, error) {
			require.Equal(t, "cs_invitation_late_paid_old", sessionID)
			return &stripe.CheckoutSession{
				ID:            sessionID,
				Status:        stripe.CheckoutSessionStatusComplete,
				PaymentStatus: stripe.CheckoutSessionPaymentStatusPaid,
			}, nil
		},
		func(_ context.Context, sessionID string) (*stripe.CheckoutSession, error) {
			expireCalls++
			return &stripe.CheckoutSession{ID: sessionID, Status: stripe.CheckoutSessionStatusExpired}, nil
		},
	)
	t.Cleanup(restoreStripeAccessors)

	result, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7713,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        1,
		RequestID:     "purchase-invitation-late-paid-second",
		VerifiedQuote: purchaseQuoteFromResult(replacementQuote),
	})

	require.ErrorIs(t, err, ErrSubscriptionChangeInProgress)
	require.Nil(t, result)
	require.Zero(t, expireCalls)
	var oldOrder model.SubscriptionOrder
	require.NoError(t, model.DB.First(&oldOrder, "id = ?", first.Order.Id).Error)
	require.Equal(t, common.TopUpStatusPending, oldOrder.Status)
	require.False(t, oldOrder.ProviderExpirationPending)
	require.Empty(t, oldOrder.SupersededByTradeNo)
	accountAfterFailure, err := model.GetSubscriptionDiscountAccount(7713)
	require.NoError(t, err)
	require.Equal(t, int64(2000), accountAfterFailure.AvailableUSDMinor)
	require.Equal(t, int64(2000), accountAfterFailure.ReservedUSDMinor)
	var releaseCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).
		Where("terminal_reservation_key = ? AND entry_type = ?", first.Order.SubscriptionDiscountReservationKey, model.SubscriptionDiscountEntryTypeRelease).
		Count(&releaseCount).Error)
	require.Zero(t, releaseCount)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 7713).Count(&orderCount).Error)
	require.Equal(t, int64(1), orderCount)
}

func TestPurchaseSubscriptionReplacementRejectsUnconfirmedConcurrentStripeCheckout(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.TopUp{}))
	insertPurchaseServiceUser(t, 7714, 100000)
	plan := insertPurchaseServicePlan(t, 7814, 1, 20, 2000)
	grantPurchaseServiceInvitationDiscount(t, 7714, 4000, "purchase-invitation-unconfirmed-race")
	firstQuote, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        7714,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        1,
	})
	require.NoError(t, err)
	first, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7714,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        1,
		RequestID:     "purchase-invitation-unconfirmed-race-first",
		VerifiedQuote: purchaseQuoteFromResult(firstQuote),
	})
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).
		Where("id = ?", first.Order.Id).
		Update("provider_session_id", "cs_invitation_unconfirmed_confirmed").Error)
	replacementQuote, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        7714,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        1,
	})
	require.NoError(t, err)
	restoreStripeAccessors := ReplaceStripeCheckoutSessionAccessorsForTest(
		func(_ context.Context, sessionID string) (*stripe.CheckoutSession, error) {
			require.Equal(t, "cs_invitation_unconfirmed_confirmed", sessionID)
			return &stripe.CheckoutSession{ID: sessionID, Status: stripe.CheckoutSessionStatusOpen}, nil
		},
		func(_ context.Context, sessionID string) (*stripe.CheckoutSession, error) {
			return &stripe.CheckoutSession{ID: sessionID, Status: stripe.CheckoutSessionStatusExpired}, nil
		},
	)
	t.Cleanup(restoreStripeAccessors)
	originalHook := subscriptionPurchaseAfterProviderExpirationHook
	t.Cleanup(func() { subscriptionPurchaseAfterProviderExpirationHook = originalHook })
	subscriptionPurchaseAfterProviderExpirationHook = func() {
		intent := model.SubscriptionChangeIntent{
			ContractId:    first.Contract.Id,
			UserId:        7714,
			RequestId:     "purchase-invitation-unconfirmed-race-concurrent",
			ChangeVersion: first.Intent.ChangeVersion + 1,
			Kind:          model.SubscriptionChangeIntentKindPurchase,
			PaymentMode:   model.SubscriptionPaymentModePrepaid,
			Status:        model.SubscriptionChangeIntentStatusAwaitingPayment,
			ToPlanId:      plan.Id,
			EffectiveAt:   common.GetTimestamp(),
			UpdatedAt:     common.GetTimestamp(),
		}
		require.NoError(t, model.DB.Create(&intent).Error)
		require.NoError(t, model.DB.Create(&model.SubscriptionOrder{
			UserId:             7714,
			PlanId:             plan.Id,
			Money:              20,
			TradeNo:            "sub_unconfirmed_race",
			PaymentMethod:      SubscriptionPaymentChoiceAlipay,
			PaymentProvider:    model.PaymentProviderStripe,
			Status:             common.TopUpStatusPending,
			CreateTime:         common.GetTimestamp(),
			PurchaseMonths:     1,
			UnitPrice:          20,
			PaymentCurrency:    "USD",
			PaymentAmountMinor: 2000,
			PurchaseIntent:     model.SubscriptionChangeIntentKindPurchase,
			ProviderSessionId:  "cs_invitation_unconfirmed_race",
			ChangeIntentId:     intent.Id,
		}).Error)
	}

	result, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7714,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        1,
		RequestID:     "purchase-invitation-unconfirmed-race-second",
		VerifiedQuote: purchaseQuoteFromResult(replacementQuote),
	})

	require.ErrorIs(t, err, ErrSubscriptionChangeInProgress)
	require.Nil(t, result)
	var firstOrder model.SubscriptionOrder
	require.NoError(t, model.DB.First(&firstOrder, "id = ?", first.Order.Id).Error)
	require.Equal(t, common.TopUpStatusPending, firstOrder.Status)
	require.Empty(t, firstOrder.SupersededByTradeNo)
	var concurrentOrder model.SubscriptionOrder
	require.NoError(t, model.DB.First(&concurrentOrder, "trade_no = ?", "sub_unconfirmed_race").Error)
	require.Equal(t, common.TopUpStatusPending, concurrentOrder.Status)
	var releaseCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).
		Where("terminal_reservation_key = ? AND entry_type = ?", first.Order.SubscriptionDiscountReservationKey, model.SubscriptionDiscountEntryTypeRelease).
		Count(&releaseCount).Error)
	require.Zero(t, releaseCount)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 7714).Count(&orderCount).Error)
	require.Equal(t, int64(2), orderCount)
}

func TestPurchaseSubscriptionReplacementQueriesOldCheckoutBeforeContract(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.TopUp{}))
	insertPurchaseServiceUser(t, 7712, 100000)
	plan := insertPurchaseServicePlan(t, 7812, 1, 20, 2000)
	grantPurchaseServiceInvitationDiscount(t, 7712, 4000, "purchase-invitation-lock-order")
	firstQuote, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        7712,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        1,
	})
	require.NoError(t, err)
	first, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7712,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        1,
		RequestID:     "purchase-invitation-lock-order-first",
		VerifiedQuote: purchaseQuoteFromResult(firstQuote),
	})
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).
		Where("id = ?", first.Order.Id).
		Update("provider_session_id", "cs_invitation_lock_order_old").Error)
	secondQuote, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        7712,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        1,
	})
	require.NoError(t, err)
	restoreStripeAccessors := ReplaceStripeCheckoutSessionAccessorsForTest(
		func(_ context.Context, sessionID string) (*stripe.CheckoutSession, error) {
			require.Equal(t, "cs_invitation_lock_order_old", sessionID)
			return &stripe.CheckoutSession{ID: sessionID, Status: stripe.CheckoutSessionStatusOpen}, nil
		},
		func(_ context.Context, sessionID string) (*stripe.CheckoutSession, error) {
			return &stripe.CheckoutSession{ID: sessionID, Status: stripe.CheckoutSessionStatusExpired}, nil
		},
	)
	t.Cleanup(restoreStripeAccessors)
	var queriedTables []string
	callbackName := "test_purchase_replacement_lock_order"
	require.NoError(t, model.DB.Callback().Query().Before("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		queriedTables = append(queriedTables, tx.Statement.Table)
	}))
	t.Cleanup(func() {
		require.NoError(t, model.DB.Callback().Query().Remove(callbackName))
	})

	_, err = PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7712,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        1,
		RequestID:     "purchase-invitation-lock-order-second",
		VerifiedQuote: purchaseQuoteFromResult(secondQuote),
	})

	require.NoError(t, err)
	oldOrderIndex := firstTableIndex(queriedTables, "subscription_orders")
	contractIndex := firstTableIndex(queriedTables, "user_subscription_contracts")
	require.NotEqual(t, -1, oldOrderIndex, queriedTables)
	require.NotEqual(t, -1, contractIndex, queriedTables)
	require.Less(t, oldOrderIndex, contractIndex, queriedTables)
}

func TestPurchaseSubscriptionInvitationSupersededStripeCheckoutReleasesReservationOnce(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.TopUp{}))
	insertPurchaseServiceUser(t, 7707, 100000)
	plan := insertPurchaseServicePlan(t, 7807, 1, 20, 2000)
	grantPurchaseServiceInvitationDiscount(t, 7707, 4000, "purchase-invitation-supersede")
	firstQuote, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        7707,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        1,
	})
	require.NoError(t, err)
	first, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7707,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        1,
		RequestID:     "purchase-invitation-supersede-first",
		VerifiedQuote: purchaseQuoteFromResult(firstQuote),
	})
	require.NoError(t, err)
	require.NotEmpty(t, first.Order.SubscriptionDiscountReservationKey)
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).
		Where("id = ?", first.Order.Id).
		Update("provider_session_id", "cs_invitation_supersede_old").Error)

	var expiredSessionIDs []string
	restoreStripeAccessors := ReplaceStripeCheckoutSessionAccessorsForTest(
		func(_ context.Context, sessionID string) (*stripe.CheckoutSession, error) {
			require.Equal(t, "cs_invitation_supersede_old", sessionID)
			return &stripe.CheckoutSession{ID: sessionID, Status: stripe.CheckoutSessionStatusOpen}, nil
		},
		func(_ context.Context, sessionID string) (*stripe.CheckoutSession, error) {
			expiredSessionIDs = append(expiredSessionIDs, sessionID)
			return &stripe.CheckoutSession{ID: sessionID, Status: stripe.CheckoutSessionStatusExpired}, nil
		},
	)
	t.Cleanup(restoreStripeAccessors)
	secondQuote, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        7707,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        1,
	})
	require.NoError(t, err)
	require.Equal(t, int64(2000), secondQuote.InvitationAvailableUSDMinor)

	second, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7707,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        1,
		RequestID:     "purchase-invitation-supersede-second",
		VerifiedQuote: purchaseQuoteFromResult(secondQuote),
	})
	require.NoError(t, err)
	require.NotEmpty(t, second.Order.SubscriptionDiscountReservationKey)
	require.NotEqual(t, first.Order.SubscriptionDiscountReservationKey, second.Order.SubscriptionDiscountReservationKey)
	require.Equal(t, []string{"cs_invitation_supersede_old"}, expiredSessionIDs)

	var oldOrder model.SubscriptionOrder
	require.NoError(t, model.DB.First(&oldOrder, "id = ?", first.Order.Id).Error)
	require.Equal(t, common.TopUpStatusExpired, oldOrder.Status)
	var oldIntent model.SubscriptionChangeIntent
	require.NoError(t, model.DB.First(&oldIntent, "id = ?", first.Intent.Id).Error)
	require.Equal(t, model.SubscriptionChangeIntentStatusSuperseded, oldIntent.Status)
	require.Equal(t, second.Intent.Id, oldIntent.SupersededById)
	account, err := model.GetSubscriptionDiscountAccount(7707)
	require.NoError(t, err)
	require.Equal(t, int64(2000), account.AvailableUSDMinor)
	require.Equal(t, int64(2000), account.ReservedUSDMinor)
	var oldReleaseCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).
		Where("terminal_reservation_key = ? AND entry_type = ?", first.Order.SubscriptionDiscountReservationKey, model.SubscriptionDiscountEntryTypeRelease).
		Count(&oldReleaseCount).Error)
	require.Equal(t, int64(1), oldReleaseCount)
	var newReleaseCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).
		Where("terminal_reservation_key = ? AND entry_type = ?", second.Order.SubscriptionDiscountReservationKey, model.SubscriptionDiscountEntryTypeRelease).
		Count(&newReleaseCount).Error)
	require.Zero(t, newReleaseCount)

	require.NoError(t, supersedePendingStripeCheckoutLocally(&oldIntent, &oldOrder))
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).
		Where("terminal_reservation_key = ? AND entry_type = ?", first.Order.SubscriptionDiscountReservationKey, model.SubscriptionDiscountEntryTypeRelease).
		Count(&oldReleaseCount).Error)
	require.Equal(t, int64(1), oldReleaseCount)
}

func TestPurchaseSubscriptionInvitationStaleQuoteRollsBackWithoutOrderOrReservation(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7710, 100000)
	plan := insertPurchaseServicePlan(t, 7810, 1, 20, 2000)
	grantPurchaseServiceInvitationDiscount(t, 7710, 700, "purchase-invitation-stale")
	quote, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        7710,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceBalance,
		Months:        1,
	})
	require.NoError(t, err)
	require.Equal(t, SubscriptionDiscountKindInvitation, quote.DiscountKind)
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		_, reserveErr := model.ReserveSubscriptionDiscountTx(tx, model.SubscriptionDiscountReservationInput{
			UserID:             7710,
			USDMinor:           700,
			TradeNo:            "external-stale-order",
			PaymentCurrency:    "USD",
			AppliedAmountMinor: 700,
			PricingSnapshot:    `{"source":"external"}`,
			IdempotencyKey:     "subscription-order:external-stale-order:reserve",
			ExpiresAt:          common.GetTimestamp() + 600,
		})
		return reserveErr
	}))

	_, err = PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7710,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceBalance,
		Months:        1,
		RequestID:     "purchase-invitation-stale",
		VerifiedQuote: purchaseQuoteFromResult(quote),
	})

	require.Error(t, err)
	require.ErrorIs(t, err, ErrSubscriptionPurchaseQuoteInvalid)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 7710).Count(&orderCount).Error)
	require.Zero(t, orderCount)
	var intentCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionChangeIntent{}).Where("user_id = ?", 7710).Count(&intentCount).Error)
	require.Zero(t, intentCount)
	account, err := model.GetSubscriptionDiscountAccount(7710)
	require.NoError(t, err)
	require.Zero(t, account.AvailableUSDMinor)
	require.Equal(t, int64(700), account.ReservedUSDMinor)
}

func TestPurchaseSubscriptionInvitationConcurrentOrdersDoNotOverspendCredit(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	sqlDB, err := model.DB.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(4)
	insertPurchaseServiceUser(t, 7720, 100000)
	plan := insertPurchaseServicePlan(t, 7820, 1, 20, 2000)
	grantPurchaseServiceInvitationDiscount(t, 7720, 700, "purchase-invitation-concurrent")
	quote, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        7720,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        1,
	})
	require.NoError(t, err)
	require.Equal(t, SubscriptionDiscountKindInvitation, quote.DiscountKind)

	type purchaseAttempt struct {
		result *PurchaseSubscriptionResult
		err    error
	}
	start := make(chan struct{})
	results := make(chan purchaseAttempt, 2)
	var wg sync.WaitGroup
	for _, requestID := range []string{"purchase-invitation-concurrent-a", "purchase-invitation-concurrent-b"} {
		wg.Add(1)
		go func(requestID string) {
			defer wg.Done()
			<-start
			result, err := PurchaseSubscription(PurchaseSubscriptionCommand{
				UserID:        7720,
				PlanID:        plan.Id,
				PaymentChoice: SubscriptionPaymentChoiceAlipay,
				Months:        1,
				RequestID:     requestID,
				VerifiedQuote: purchaseQuoteFromResult(quote),
			})
			results <- purchaseAttempt{result: result, err: err}
		}(requestID)
	}
	close(start)
	wg.Wait()
	close(results)

	var successes int
	var failures int
	for attempt := range results {
		if attempt.err != nil {
			failures++
			continue
		}
		require.NotNil(t, attempt.result)
		require.NotNil(t, attempt.result.Order)
		successes++
	}
	require.Equal(t, 1, successes)
	require.Equal(t, 1, failures)
	account, err := model.GetSubscriptionDiscountAccount(7720)
	require.NoError(t, err)
	require.Zero(t, account.AvailableUSDMinor)
	require.Equal(t, int64(700), account.ReservedUSDMinor)
	var reserveCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).
		Where("user_id = ? AND entry_type = ?", 7720, model.SubscriptionDiscountEntryTypeReserve).
		Count(&reserveCount).Error)
	require.Equal(t, int64(1), reserveCount)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 7720).Count(&orderCount).Error)
	require.Equal(t, int64(1), orderCount)
}

func TestValidateSubscriptionPurchaseQuoteAllowsMultiMonthInvitationDiscountGreaterThanMonthlyUnit(t *testing.T) {
	quote, err := validateSubscriptionPurchaseQuoteForChoice(SubscriptionPurchaseQuote{
		Currency:                      "USD",
		UnitPrice:                     20,
		UnitAmountMinor:               2000,
		OriginalTotal:                 60,
		OriginalTotalAmountMinor:      6000,
		DiscountKind:                  SubscriptionDiscountKindInvitation,
		DiscountAmount:                50,
		DiscountAmountMinor:           5000,
		Total:                         10,
		PaymentAmountMinor:            1000,
		InvitationAvailableUSDMinor:   5000,
		InvitationDiscountUSDMinor:    5000,
		InvitationDiscountAmountMinor: 5000,
		InvitationRemainingUSDMinor:   0,
	}, SubscriptionPaymentChoiceBalance, 3)

	require.NoError(t, err)
	require.Equal(t, SubscriptionDiscountKindInvitation, quote.DiscountKind)
	require.Equal(t, int64(2000), quote.UnitAmountMinor)
	require.Equal(t, int64(6000), quote.OriginalTotalAmountMinor)
	require.Equal(t, int64(5000), quote.DiscountAmountMinor)
	require.Greater(t, quote.DiscountAmountMinor, quote.UnitAmountMinor)
	require.LessOrEqual(t, quote.DiscountAmountMinor, quote.OriginalTotalAmountMinor)
}

func TestValidateSubscriptionPurchaseQuoteRejectsRecallDiscountGreaterThanMonthlyUnit(t *testing.T) {
	tests := []struct {
		name string
		kind string
	}{
		{name: "explicit_recall", kind: SubscriptionDiscountKindRecall},
		{name: "legacy_discount_defaults_to_recall", kind: ""},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err := validateSubscriptionPurchaseQuoteForChoice(SubscriptionPurchaseQuote{
				Currency:                 "USD",
				UnitPrice:                1,
				UnitAmountMinor:          100,
				OriginalTotal:            3,
				OriginalTotalAmountMinor: 300,
				DiscountKind:             test.kind,
				DiscountAmount:           1.01,
				DiscountAmountMinor:      101,
				Total:                    1.99,
				PaymentAmountMinor:       199,
				RecallCampaignID:         42,
				RecallRecipientID:        99,
			}, SubscriptionPaymentChoiceBalance, 3)

			require.Error(t, err)
			require.Contains(t, err.Error(), "first month")
		})
	}
}

func TestPurchaseSubscriptionRecallBalanceUsesAccountOfferAndChargesDiscountedQuote(t *testing.T) {
	setupSubscriptionRecallPurchaseTestDB(t)
	now := time.Now().UTC()
	fixture := createRecallClaimFixture(t, now)
	insertPurchaseServiceUser(t, fixture.recipient.UserId, 50000)
	plan := insertPurchaseServicePlan(t, 7535, 1, 1, 100)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("stripe_price_id", "price_subscription").Error)

	result, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        fixture.recipient.UserId,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceBalance,
		Months:        3,
		RequestID:     "recall-balance-no-claim",
		VerifiedQuote: &SubscriptionPurchaseQuote{
			Currency:                 "USD",
			UnitPrice:                1,
			UnitAmountMinor:          100,
			OriginalTotal:            3,
			OriginalTotalAmountMinor: 300,
			DiscountAmount:           0.20,
			DiscountAmountMinor:      20,
			Total:                    2.80,
			PaymentAmountMinor:       280,
			RecallCampaignID:         fixture.campaign.Id,
			RecallRecipientID:        fixture.recipient.Id,
		},
	})
	require.NoError(t, err)
	require.Equal(t, int64(280), result.Order.PaymentAmountMinor)
	require.Equal(t, float64(2.80), result.Order.Money)

	var user model.User
	require.NoError(t, model.DB.First(&user, "id = ?", fixture.recipient.UserId).Error)
	require.Equal(t, 49720, user.Quota)
	require.NotEqual(t, 49700, user.Quota)
	require.NotEqual(t, 49760, user.Quota)
	var conversionCount int64
	require.NoError(t, model.DB.Model(&model.RecallEvent{}).Where("recipient_id = ? AND event_type = ?", fixture.recipient.Id, "conversion").Count(&conversionCount).Error)
	require.Equal(t, int64(1), conversionCount)
}

func TestPurchaseSubscriptionRecallSuppliedWeakerClaimDoesNotOverrideBestAccountOffer(t *testing.T) {
	setupSubscriptionRecallPurchaseTestDB(t)
	now := time.Now().UTC()
	user := model.User{
		Id:       753601,
		Username: "purchase_best_offer_user",
		Email:    "purchase-best-offer@example.com",
		Status:   common.UserStatusEnabled,
		Quota:    50000,
		Group:    "plg",
	}
	require.NoError(t, model.DB.Create(&user).Error)
	weaker := createRecallOfferFixture(t, user, now.Add(-time.Minute), "subscription weak", model.RecallCampaignRunning,
		RecallDiscountConfig{Type: "percent", PercentOff: 10},
		RecallProductScope{SubscriptionPriceIDs: []string{"price_subscription"}}, nil)
	stronger := createRecallOfferFixture(t, user, now, "subscription strong", model.RecallCampaignRunning,
		RecallDiscountConfig{Type: "percent", PercentOff: 30},
		RecallProductScope{SubscriptionPriceIDs: []string{"price_subscription"}}, nil)
	weakClaim := strings.Repeat("w", 48)
	weakHash := recallClaimHash(weakClaim)
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", weaker.recipient.Id).
		Update("claim_token_hash", weakHash).Error)
	plan := insertPurchaseServicePlan(t, 7536, 1, 1, 100)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("stripe_price_id", "price_subscription").Error)

	quote, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        user.Id,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceBalance,
		Months:        3,
		RecallClaim:   weakClaim,
	})

	require.NoError(t, err)
	require.Equal(t, int64(30), quote.DiscountAmountMinor)
	require.Equal(t, stronger.campaign.Id, quote.RecallCampaignID)
	require.Equal(t, stronger.recipient.Id, quote.RecallRecipientID)

	result, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        user.Id,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceBalance,
		Months:        3,
		RequestID:     "recall-balance-best-offer",
		RecallClaim:   weakClaim,
		VerifiedQuote: &SubscriptionPurchaseQuote{
			Currency:                 quote.Currency,
			UnitPrice:                quote.UnitPrice,
			UnitAmountMinor:          quote.UnitAmountMinor,
			OriginalTotal:            quote.OriginalTotal,
			OriginalTotalAmountMinor: quote.OriginalTotalAmountMinor,
			DiscountAmount:           quote.DiscountAmount,
			DiscountAmountMinor:      quote.DiscountAmountMinor,
			Total:                    quote.Total,
			PaymentAmountMinor:       quote.PaymentAmountMinor,
			RecallCampaignID:         quote.RecallCampaignID,
			RecallRecipientID:        quote.RecallRecipientID,
			RecallPromotionCodeID:    "promo_subscription_strong",
		},
	})

	require.NoError(t, err)
	require.Equal(t, int64(270), result.Order.PaymentAmountMinor)
	require.Equal(t, stronger.campaign.Id, result.Order.RecallCampaignId)
	require.Equal(t, stronger.recipient.Id, result.Order.RecallRecipientId)
	require.Equal(t, "promo_subscription_strong", result.Order.RecallPromotionCodeId)
}

func TestPurchaseSubscriptionRecallConvertedUnrelatedClaimDoesNotVetoAccountOffer(t *testing.T) {
	setupSubscriptionRecallPurchaseTestDB(t)
	now := time.Now().UTC()
	user := model.User{
		Id:       753602,
		Username: "purchase_converted_hint_user",
		Email:    "purchase-converted-hint@example.com",
		Status:   common.UserStatusEnabled,
		Quota:    50000,
		Group:    "plg",
	}
	require.NoError(t, model.DB.Create(&user).Error)
	converted := createRecallOfferFixture(t, user, now.Add(-time.Minute), "subscription converted", model.RecallCampaignRunning,
		RecallDiscountConfig{Type: "percent", PercentOff: 10},
		RecallProductScope{SubscriptionPriceIDs: []string{"price_subscription"}}, nil)
	stronger := createRecallOfferFixture(t, user, now, "subscription active", model.RecallCampaignRunning,
		RecallDiscountConfig{Type: "percent", PercentOff: 30},
		RecallProductScope{SubscriptionPriceIDs: []string{"price_subscription"}}, nil)
	convertedClaim := strings.Repeat("x", 48)
	convertedHash := recallClaimHash(convertedClaim)
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", converted.recipient.Id).
		Updates(map[string]interface{}{
			"claim_token_hash": convertedHash,
			"state":            model.RecallRecipientConverted,
			"converted_at":     now.Add(-30 * time.Second).Unix(),
		}).Error)
	plan := insertPurchaseServicePlan(t, 7537, 1, 1, 100)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("stripe_price_id", "price_subscription").Error)

	quote, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        user.Id,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceBalance,
		Months:        3,
	})
	require.NoError(t, err)
	require.Equal(t, stronger.campaign.Id, quote.RecallCampaignID)
	require.Equal(t, stronger.recipient.Id, quote.RecallRecipientID)
	verifiedQuote := &SubscriptionPurchaseQuote{
		Currency:                 quote.Currency,
		UnitPrice:                quote.UnitPrice,
		UnitAmountMinor:          quote.UnitAmountMinor,
		OriginalTotal:            quote.OriginalTotal,
		OriginalTotalAmountMinor: quote.OriginalTotalAmountMinor,
		DiscountAmount:           quote.DiscountAmount,
		DiscountAmountMinor:      quote.DiscountAmountMinor,
		Total:                    quote.Total,
		PaymentAmountMinor:       quote.PaymentAmountMinor,
		RecallCampaignID:         quote.RecallCampaignID,
		RecallRecipientID:        quote.RecallRecipientID,
	}

	result, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        user.Id,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceBalance,
		Months:        3,
		RequestID:     "recall-balance-converted-unrelated",
		RecallClaim:   convertedClaim,
		VerifiedQuote: verifiedQuote,
	})

	require.NoError(t, err)
	require.Equal(t, stronger.campaign.Id, result.Order.RecallCampaignId)
	require.Equal(t, stronger.recipient.Id, result.Order.RecallRecipientId)
	require.Equal(t, int64(270), result.Order.PaymentAmountMinor)
}

func TestPurchaseSubscriptionRecallOneTimeOrderPersistsAttributionFields(t *testing.T) {
	setupSubscriptionRecallPurchaseTestDB(t)
	now := time.Now().UTC()
	fixture := createRecallClaimFixture(t, now)
	insertPurchaseServiceUser(t, fixture.recipient.UserId, 50000)
	plan := insertPurchaseServicePlan(t, 7537, 1, 1, 100)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("stripe_price_id", "price_subscription").Error)

	result, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        fixture.recipient.UserId,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        3,
		RequestID:     "recall-one-time-persist",
		VerifiedQuote: discountedRecallPurchaseQuote(fixture, 1, 3, 20),
	})

	require.NoError(t, err)
	require.Equal(t, common.TopUpStatusPending, result.Order.Status)
	require.Equal(t, int64(280), result.Order.PaymentAmountMinor)
	require.Equal(t, fixture.campaign.Id, result.Order.RecallCampaignId)
	require.Equal(t, fixture.recipient.Id, result.Order.RecallRecipientId)
	require.Equal(t, "promo_recall", result.Order.RecallPromotionCodeId)
	require.Equal(t, int64(20), result.Order.RecallDiscountAmountMinor)
	require.NotContains(t, result.Order.ProviderPayload, fixture.claim)
	require.NotContains(t, result.Order.PlanSnapshot, fixture.claim)
	require.Contains(t, result.Order.PlanSnapshot, `"stripe_price_id":"price_subscription"`)
	var stored model.SubscriptionOrder
	require.NoError(t, model.DB.First(&stored, result.Order.Id).Error)
	require.Equal(t, result.Order.RecallCampaignId, stored.RecallCampaignId)
	require.Equal(t, result.Order.RecallRecipientId, stored.RecallRecipientId)
	require.Equal(t, result.Order.RecallPromotionCodeId, stored.RecallPromotionCodeId)
	require.Equal(t, result.Order.RecallDiscountAmountMinor, stored.RecallDiscountAmountMinor)
}

func TestRejectUnresolvedPlanChangeBlocksRepurchaseEvenWhenDowngradeReplacementAllowed(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	require.NoError(t, model.DB.Create(&model.SubscriptionChangeIntent{
		UserId:      7350,
		RequestId:   "pending-repurchase",
		Kind:        model.SubscriptionChangeIntentKindRepurchase,
		PaymentMode: model.SubscriptionPaymentModePrepaid,
		Status:      model.SubscriptionChangeIntentStatusAwaitingPayment,
	}).Error)

	err := model.DB.Transaction(func(tx *gorm.DB) error {
		return rejectUnresolvedPlanChangeTx(tx, 7350)
	})
	require.ErrorIs(t, err, ErrSubscriptionChangeInProgress)

	err = model.DB.Transaction(func(tx *gorm.DB) error {
		return rejectUnresolvedPlanChangeTx(tx, 7350, true)
	})
	require.ErrorIs(t, err, ErrSubscriptionChangeInProgress)
}

func TestPurchaseSubscriptionRecallRepurchaseReplacesNoSessionPendingOrder(t *testing.T) {
	setupSubscriptionRecallPurchaseTestDB(t)
	now := time.Now().UTC()
	fixture := createRecallClaimFixture(t, now)
	insertPurchaseServiceUser(t, fixture.recipient.UserId, 50000)
	plan := insertPurchaseServicePlan(t, 7540, 1, 1, 100)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("stripe_price_id", "price_subscription").Error)
	require.NoError(t, model.DB.Create(&model.UserSubscriptionContract{
		UserId:             fixture.recipient.UserId,
		Status:             model.SubscriptionContractStatusActive,
		PaymentMode:        model.SubscriptionPaymentModePrepaid,
		CurrentPlanId:      plan.Id,
		CurrentPeriodStart: now.Unix(),
		CurrentPeriodEnd:   now.AddDate(0, 1, 0).Unix(),
	}).Error)

	first, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        fixture.recipient.UserId,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        3,
		RequestID:     "recall-repurchase-no-session-first",
		RecallClaim:   fixture.claim,
		VerifiedQuote: discountedRecallPurchaseQuote(fixture, 1, 3, 20),
	})
	require.NoError(t, err)
	require.Equal(t, model.SubscriptionChangeIntentKindRepurchase, first.Intent.Kind)
	require.Equal(t, int64(20), first.Order.RecallDiscountAmountMinor)
	require.Empty(t, first.Order.ProviderSessionId)

	second, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        fixture.recipient.UserId,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        3,
		RequestID:     "recall-repurchase-no-session-second",
		RecallClaim:   fixture.claim,
		VerifiedQuote: discountedRecallPurchaseQuote(fixture, 1, 3, 20),
	})
	require.NoError(t, err)
	require.Equal(t, model.SubscriptionChangeIntentKindRepurchase, second.Intent.Kind)

	assertSingleAwaitingDiscountedRepurchaseOrder(t, fixture.recipient.UserId)
	var oldOrder model.SubscriptionOrder
	require.NoError(t, model.DB.First(&oldOrder, first.Order.Id).Error)
	require.Equal(t, common.TopUpStatusExpired, oldOrder.Status)
	var oldIntent model.SubscriptionChangeIntent
	require.NoError(t, model.DB.First(&oldIntent, first.Intent.Id).Error)
	require.Equal(t, model.SubscriptionChangeIntentStatusSuperseded, oldIntent.Status)
	require.Equal(t, second.Intent.Id, oldIntent.SupersededById)
}

func TestPurchaseSubscriptionRecallRepurchaseStillExpiresExistingCheckoutSessionBeforeReplacement(t *testing.T) {
	setupSubscriptionRecallPurchaseTestDB(t)
	now := time.Now().UTC()
	fixture := createRecallClaimFixture(t, now)
	insertPurchaseServiceUser(t, fixture.recipient.UserId, 50000)
	plan := insertPurchaseServicePlan(t, 7541, 1, 1, 100)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("stripe_price_id", "price_subscription").Error)
	require.NoError(t, model.DB.Create(&model.UserSubscriptionContract{
		UserId:             fixture.recipient.UserId,
		Status:             model.SubscriptionContractStatusActive,
		PaymentMode:        model.SubscriptionPaymentModePrepaid,
		CurrentPlanId:      plan.Id,
		CurrentPeriodStart: now.Unix(),
		CurrentPeriodEnd:   now.AddDate(0, 1, 0).Unix(),
	}).Error)
	first, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        fixture.recipient.UserId,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        3,
		RequestID:     "recall-repurchase-session-first",
		RecallClaim:   fixture.claim,
		VerifiedQuote: discountedRecallPurchaseQuote(fixture, 1, 3, 20),
	})
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("id = ?", first.Order.Id).Update("provider_session_id", "cs_repurchase_existing").Error)
	expiredSessionIDs := make([]string, 0)
	restoreStripeAccessors := ReplaceStripeCheckoutSessionAccessorsForTest(
		func(_ context.Context, sessionID string) (*stripe.CheckoutSession, error) {
			return &stripe.CheckoutSession{ID: sessionID, Status: stripe.CheckoutSessionStatusOpen}, nil
		},
		func(_ context.Context, sessionID string) (*stripe.CheckoutSession, error) {
			expiredSessionIDs = append(expiredSessionIDs, sessionID)
			return &stripe.CheckoutSession{ID: sessionID, Status: stripe.CheckoutSessionStatusExpired}, nil
		},
	)
	t.Cleanup(restoreStripeAccessors)

	second, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        fixture.recipient.UserId,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        3,
		RequestID:     "recall-repurchase-session-second",
		RecallClaim:   fixture.claim,
		VerifiedQuote: discountedRecallPurchaseQuote(fixture, 1, 3, 20),
	})

	require.NoError(t, err)
	require.Equal(t, []string{"cs_repurchase_existing"}, expiredSessionIDs)
	require.Equal(t, model.SubscriptionChangeIntentKindRepurchase, second.Intent.Kind)
	assertSingleAwaitingDiscountedRepurchaseOrder(t, fixture.recipient.UserId)
	var oldOrder model.SubscriptionOrder
	require.NoError(t, model.DB.First(&oldOrder, first.Order.Id).Error)
	require.Equal(t, common.TopUpStatusExpired, oldOrder.Status)
}

func TestPurchaseSubscriptionRecallBalanceOrderConvertsAndReplayDoesNotDoubleConsume(t *testing.T) {
	setupSubscriptionRecallPurchaseTestDB(t)
	now := time.Now().UTC()
	fixture := createRecallClaimFixture(t, now)
	insertPurchaseServiceUser(t, fixture.recipient.UserId, 50000)
	plan := insertPurchaseServicePlan(t, 7538, 1, 1, 100)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("stripe_price_id", "price_subscription").Error)
	cmd := PurchaseSubscriptionCommand{
		UserID:        fixture.recipient.UserId,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceBalance,
		Months:        3,
		RequestID:     "recall-balance-convert",
		RecallClaim:   fixture.claim,
		VerifiedQuote: discountedRecallPurchaseQuote(fixture, 1, 3, 20),
	}

	first, err := PurchaseSubscription(cmd)
	require.NoError(t, err)
	require.Equal(t, fixture.campaign.Id, first.Order.RecallCampaignId)
	require.Equal(t, fixture.recipient.Id, first.Order.RecallRecipientId)
	require.Equal(t, "promo_recall", first.Order.RecallPromotionCodeId)
	require.Equal(t, int64(20), first.Order.RecallDiscountAmountMinor)

	var converted model.RecallRecipient
	require.NoError(t, model.DB.First(&converted, fixture.recipient.Id).Error)
	require.Equal(t, model.RecallRecipientConverted, converted.State)
	require.Equal(t, model.RecallConversionDirect, converted.ConversionKind)
	require.Equal(t, first.Order.TradeNo, converted.ConversionTradeNo)
	require.Equal(t, "USD", converted.ConversionCurrency)
	require.Equal(t, int64(280), converted.ConversionAmount)
	require.Equal(t, int64(20), converted.DiscountAmount)
	var conversion model.RecallEvent
	require.NoError(t, model.DB.Where("recipient_id = ? AND event_type = ?", fixture.recipient.Id, "conversion").First(&conversion).Error)
	require.Equal(t, "balance", conversion.Source)
	require.Equal(t, "balance:"+first.Order.TradeNo, conversion.SourceEventId)
	require.NotContains(t, conversion.EventData, fixture.claim)
	require.NotContains(t, first.Order.ProviderPayload, fixture.claim)
	require.NotContains(t, first.Order.PlanSnapshot, fixture.claim)

	replay, err := PurchaseSubscription(cmd)
	require.NoError(t, err)
	require.Equal(t, first.Order.Id, replay.Order.Id)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", fixture.recipient.UserId).Count(&orderCount).Error)
	require.Equal(t, int64(1), orderCount)
	var ledgerCount int64
	require.NoError(t, model.DB.Model(&model.WalletLedgerEntry{}).Where("user_id = ?", fixture.recipient.UserId).Count(&ledgerCount).Error)
	require.Equal(t, int64(1), ledgerCount)
	var conversionCount int64
	require.NoError(t, model.DB.Model(&model.RecallEvent{}).Where("recipient_id = ? AND event_type = ?", fixture.recipient.Id, "conversion").Count(&conversionCount).Error)
	require.Equal(t, int64(1), conversionCount)

	_, err = PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        fixture.recipient.UserId,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceBalance,
		Months:        3,
		RequestID:     "recall-balance-reuse-other-request",
		RecallClaim:   fixture.claim,
		VerifiedQuote: discountedRecallPurchaseQuote(fixture, 1, 3, 20),
	})
	require.ErrorIs(t, err, ErrRecallClaimConverted)
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", fixture.recipient.UserId).Count(&orderCount).Error)
	require.Equal(t, int64(1), orderCount)
	require.NoError(t, model.DB.Model(&model.WalletLedgerEntry{}).Where("user_id = ?", fixture.recipient.UserId).Count(&ledgerCount).Error)
	require.Equal(t, int64(1), ledgerCount)
	var user model.User
	require.NoError(t, model.DB.First(&user, fixture.recipient.UserId).Error)
	require.Equal(t, 49720, user.Quota)
}

func TestPurchaseSubscriptionRecallBalanceConversionRollsBackWithLaterTransactionFailure(t *testing.T) {
	setupSubscriptionRecallPurchaseTestDB(t)
	now := time.Now().UTC()
	fixture := createRecallClaimFixture(t, now)
	insertPurchaseServiceUser(t, fixture.recipient.UserId, 50000)
	plan := insertPurchaseServicePlan(t, 7539, 1, 1, 100)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("stripe_price_id", "price_subscription").Error)
	sentinel := errors.New("injected ledger failure after recall conversion")
	callbackName := "recall_balance_atomic_rollback_" + strings.ReplaceAll(t.Name(), "/", "_")
	require.NoError(t, model.DB.Callback().Create().Before("gorm:create").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table == "wallet_ledger_entries" {
			tx.AddError(sentinel)
		}
	}))
	t.Cleanup(func() { _ = model.DB.Callback().Create().Remove(callbackName) })

	_, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        fixture.recipient.UserId,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceBalance,
		Months:        3,
		RequestID:     "recall-balance-rollback",
		RecallClaim:   fixture.claim,
		VerifiedQuote: discountedRecallPurchaseQuote(fixture, 1, 3, 20),
	})

	require.ErrorIs(t, err, sentinel)
	var user model.User
	require.NoError(t, model.DB.First(&user, fixture.recipient.UserId).Error)
	require.Equal(t, 50000, user.Quota)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", fixture.recipient.UserId).Count(&orderCount).Error)
	require.Zero(t, orderCount)
	var ledgerCount int64
	require.NoError(t, model.DB.Model(&model.WalletLedgerEntry{}).Where("user_id = ?", fixture.recipient.UserId).Count(&ledgerCount).Error)
	require.Zero(t, ledgerCount)
	var eventCount int64
	require.NoError(t, model.DB.Model(&model.RecallEvent{}).Where("recipient_id = ? AND event_type = ?", fixture.recipient.Id, "conversion").Count(&eventCount).Error)
	require.Zero(t, eventCount)
	var recipient model.RecallRecipient
	require.NoError(t, model.DB.First(&recipient, fixture.recipient.Id).Error)
	require.Equal(t, model.RecallRecipientContacting, recipient.State)
	require.Zero(t, recipient.ConvertedAt)
}

func discountedRecallPurchaseQuote(fixture recallClaimFixture, unitPrice float64, months int, discountMinor int64) *SubscriptionPurchaseQuote {
	quote := subscriptionPurchaseTestQuote("USD", unitPrice, months)
	quote.DiscountAmountMinor = discountMinor
	quote.DiscountAmount = float64(discountMinor) / 100
	quote.PaymentAmountMinor = quote.OriginalTotalAmountMinor - discountMinor
	quote.Total = float64(quote.PaymentAmountMinor) / 100
	quote.RecallCampaignID = fixture.campaign.Id
	quote.RecallRecipientID = fixture.recipient.Id
	quote.RecallPromotionCodeID = "promo_recall"
	return quote
}

func assertSingleAwaitingDiscountedRepurchaseOrder(t *testing.T, userID int) {
	t.Helper()
	var pendingOrders int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).
		Where("user_id = ? AND status = ? AND recall_discount_amount_minor > 0", userID, common.TopUpStatusPending).
		Count(&pendingOrders).Error)
	require.Equal(t, int64(1), pendingOrders)
	var awaitingIntents int64
	require.NoError(t, model.DB.Model(&model.SubscriptionChangeIntent{}).
		Where("user_id = ? AND kind = ? AND status = ?", userID, model.SubscriptionChangeIntentKindRepurchase, model.SubscriptionChangeIntentStatusAwaitingPayment).
		Count(&awaitingIntents).Error)
	require.Equal(t, int64(1), awaitingIntents)
}

func TestPurchaseSubscriptionRecallRejectsTamperedDiscountedQuote(t *testing.T) {
	setupSubscriptionRecallPurchaseTestDB(t)
	now := time.Now().UTC()
	fixture := createRecallClaimFixture(t, now)
	insertPurchaseServiceUser(t, fixture.recipient.UserId, 50000)
	plan := insertPurchaseServicePlan(t, 7536, 1, 1, 100)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("stripe_price_id", "price_subscription").Error)

	_, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        fixture.recipient.UserId,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceBalance,
		Months:        3,
		RequestID:     "recall-balance-tampered",
		RecallClaim:   fixture.claim,
		VerifiedQuote: &SubscriptionPurchaseQuote{
			Currency:                 "USD",
			UnitPrice:                1,
			UnitAmountMinor:          100,
			OriginalTotal:            3,
			OriginalTotalAmountMinor: 300,
			DiscountAmount:           0.40,
			DiscountAmountMinor:      40,
			Total:                    2.60,
			PaymentAmountMinor:       260,
			RecallCampaignID:         fixture.campaign.Id,
			RecallRecipientID:        fixture.recipient.Id,
		},
	})

	require.Error(t, err)
	require.Contains(t, err.Error(), "quote")
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
	quoteResult, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        7324,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceStripeRecurring,
		Months:        1,
	})
	require.NoError(t, err)

	result, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7324,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceStripeRecurring,
		Months:        1,
		RequestID:     "stripe-purchase-embedded",
		UIMode:        "embedded",
		VerifiedQuote: purchaseQuoteFromResult(quoteResult),
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
	quoteResult, err := QuoteSubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        7319,
		PlanID:        targetPlan.Id,
		PaymentChoice: SubscriptionPaymentChoiceStripeRecurring,
		Months:        1,
	})
	require.NoError(t, err)

	result, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7319,
		PlanID:        targetPlan.Id,
		PaymentChoice: SubscriptionPaymentChoiceStripeRecurring,
		Months:        1,
		RequestID:     "stripe-purchase-upgrade",
		VerifiedQuote: purchaseQuoteFromResult(quoteResult),
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
	require.NotContains(t, result.Order.PlanSnapshot, "media_credits_monthly")

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
	require.Zero(t, result.Entitlement.MediaCreditsTotal)
	require.Zero(t, result.Entitlement.MediaCreditsUsed)
}

func TestPurchaseSubscriptionBalanceDowngradeFromActiveStripeRecurringHasNoSideEffects(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7363, 1000)
	currentPlan := insertStripeUpgradePlan(t, 7463, 3, 30, 3000, "price_current_balance_downgrade")
	targetPlan := insertPurchaseServicePlan(t, 7464, 1, 2, 200)
	contract, binding, entitlement := seedStripeUpgradeContract(t, 7363, currentPlan)

	_, err := PurchaseSubscription(purchaseBalanceCommand(7363, targetPlan.Id, 1, "balance-downgrade-stripe"))

	require.Error(t, err)
	require.Contains(t, err.Error(), "Stripe recurring")
	var reloadedUser model.User
	require.NoError(t, model.DB.First(&reloadedUser, "id = ?", 7363).Error)
	require.Equal(t, 1000, reloadedUser.Quota)
	var reloadedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&reloadedContract, "id = ?", contract.Id).Error)
	require.Equal(t, currentPlan.Id, reloadedContract.CurrentPlanId)
	require.Equal(t, entitlement.Id, reloadedContract.CurrentEntitlementId)
	require.Equal(t, binding.Id, reloadedContract.CurrentProviderBindingId)
	require.Equal(t, model.SubscriptionPaymentModeStripeRecurring, reloadedContract.PaymentMode)
	var reloadedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&reloadedBinding, "id = ?", binding.Id).Error)
	require.Equal(t, model.PaymentProviderStripe, reloadedBinding.Provider)
	require.Equal(t, "active", reloadedBinding.ProviderStatus)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 7363).Count(&orderCount).Error)
	require.Zero(t, orderCount)
	var intentCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionChangeIntent{}).Where("user_id = ?", 7363).Count(&intentCount).Error)
	require.Zero(t, intentCount)
	var ledgerCount int64
	require.NoError(t, model.DB.Model(&model.WalletLedgerEntry{}).Where("user_id = ?", 7363).Count(&ledgerCount).Error)
	require.Zero(t, ledgerCount)
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

func TestPurchaseSubscriptionReplayIgnoresPlanPriceChangedAfterOriginalOrder(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7351, 2000)
	plan := insertPurchaseServicePlan(t, 7451, 1, 2, 200)
	original := purchaseBalanceCommand(7351, plan.Id, 2, "replay-price-change")

	first, err := PurchaseSubscription(original)
	require.NoError(t, err)
	require.Equal(t, int64(400), first.Order.PaymentAmountMinor)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("price_amount", 3.00).Error)
	model.InvalidateSubscriptionPlanCache(plan.Id)

	replay, err := PurchaseSubscription(original)

	require.NoError(t, err)
	require.Equal(t, first.Intent.Id, replay.Intent.Id)
	require.Equal(t, first.Order.Id, replay.Order.Id)
	require.Equal(t, int64(400), replay.Order.PaymentAmountMinor)
	var user model.User
	require.NoError(t, model.DB.First(&user, "id = ?", 7351).Error)
	require.Equal(t, 1600, user.Quota)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 7351).Count(&orderCount).Error)
	require.Equal(t, int64(1), orderCount)
}

func TestReplaySubscriptionPurchaseReturnsExistingOrderBeforeQuote(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7361, 2000)
	plan := insertPurchaseServicePlan(t, 7461, 1, 2, 200)
	original := purchaseBalanceCommand(7361, plan.Id, 2, "replay-before-controller-quote")
	first, err := PurchaseSubscription(original)
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("price_amount", 99.00).Error)
	model.InvalidateSubscriptionPlanCache(plan.Id)
	originalResolver := subscriptionPurchaseQuoteResolver
	t.Cleanup(func() { subscriptionPurchaseQuoteResolver = originalResolver })
	subscriptionPurchaseQuoteResolver = func(model.SubscriptionPlan, string, int) (SubscriptionPurchaseQuote, error) {
		t.Fatal("replay must not re-resolve a quote")
		return SubscriptionPurchaseQuote{}, errors.New("unexpected quote")
	}

	replay, found, err := ReplaySubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        7361,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceBalance,
		Months:        2,
		RequestID:     "replay-before-controller-quote",
	})

	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, first.Intent.Id, replay.Intent.Id)
	require.Equal(t, first.Order.Id, replay.Order.Id)
	require.Equal(t, int64(400), replay.Order.PaymentAmountMinor)
}

func TestReplaySubscriptionPurchaseStripeRecurringRejectsNonRecurringIntent(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7363, 2000)
	plan := insertPurchaseServicePlan(t, 7463, 1, 2, 200)
	require.NoError(t, model.DB.Create(&model.SubscriptionChangeIntent{
		UserId:      7363,
		FromPlanId:  0,
		ToPlanId:    plan.Id,
		Kind:        model.SubscriptionChangeIntentKindPurchase,
		PaymentMode: model.SubscriptionPaymentModePrepaid,
		Status:      model.SubscriptionChangeIntentStatusAwaitingPayment,
		RequestId:   "replay-recurring-mode-conflict",
		CreatedAt:   common.GetTimestamp(),
		UpdatedAt:   common.GetTimestamp(),
	}).Error)

	replay, found, err := ReplaySubscriptionPurchase(PurchaseSubscriptionCommand{
		UserID:        7363,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceStripeRecurring,
		Months:        1,
		RequestID:     "replay-recurring-mode-conflict",
	})

	require.ErrorContains(t, err, "subscription purchase idempotency conflict")
	require.False(t, found)
	require.Nil(t, replay)
}

func TestPurchaseSubscriptionBalanceRewardFailureDoesNotRollbackOrder(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7362, 2000)
	plan := insertPurchaseServicePlan(t, 7462, 1, 2, 200)
	originalGrant := tryGrantInviteSubscriptionRewardAfterOrderCompleted
	t.Cleanup(func() { tryGrantInviteSubscriptionRewardAfterOrderCompleted = originalGrant })
	tryGrantInviteSubscriptionRewardAfterOrderCompleted = func(string) error {
		return errors.New("reward temporarily unavailable")
	}

	result, err := PurchaseSubscription(purchaseBalanceCommand(7362, plan.Id, 1, "reward-failure-balance"))

	require.NoError(t, err)
	require.NotNil(t, result.Order)
	require.Equal(t, common.TopUpStatusSuccess, result.Order.Status)
	var order model.SubscriptionOrder
	require.NoError(t, model.DB.First(&order, "trade_no = ?", result.Order.TradeNo).Error)
	require.Equal(t, common.TopUpStatusSuccess, order.Status)
	var entitlement model.UserSubscription
	require.NoError(t, model.DB.First(&entitlement, "user_id = ? AND plan_id = ? AND status = ?", 7362, plan.Id, model.SubscriptionEntitlementStatusActive).Error)
	require.NotZero(t, entitlement.Id)
}

func TestPurchaseSubscriptionNewRequestValidatesAgainstCurrentPlanPrice(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7352, 2000)
	plan := insertPurchaseServicePlan(t, 7452, 1, 2, 200)
	staleQuote := subscriptionPurchaseTestQuote("USD", 2, 2)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("price_amount", 3.00).Error)
	model.InvalidateSubscriptionPlanCache(plan.Id)

	_, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7352,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceBalance,
		Months:        2,
		RequestID:     "new-request-current-price",
		VerifiedQuote: staleQuote,
	})

	require.Error(t, err)
	require.Contains(t, err.Error(), "quote")
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 7352).Count(&orderCount).Error)
	require.Zero(t, orderCount)
}

func TestPurchaseSubscriptionNewRequestRejectsPlanChangedAfterPrevalidation(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7353, 2000)
	plan := insertPurchaseServicePlan(t, 7453, 1, 2, 200)
	originalHook := subscriptionPurchaseAfterQuoteValidationHook
	t.Cleanup(func() { subscriptionPurchaseAfterQuoteValidationHook = originalHook })
	subscriptionPurchaseAfterQuoteValidationHook = func() {
		require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
			Update("price_amount", 3.00).Error)
		model.InvalidateSubscriptionPlanCache(plan.Id)
	}

	_, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7353,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceBalance,
		Months:        2,
		RequestID:     "new-request-plan-change-after-validation",
		VerifiedQuote: subscriptionPurchaseTestQuote("USD", 2, 2),
	})

	require.Error(t, err)
	require.Contains(t, err.Error(), "quote")
	var user model.User
	require.NoError(t, model.DB.First(&user, "id = ?", 7353).Error)
	require.Equal(t, 2000, user.Quota)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 7353).Count(&orderCount).Error)
	require.Zero(t, orderCount)
}

func TestPurchaseSubscriptionRecallReplayIgnoresDiscountChangedAfterOriginalOrder(t *testing.T) {
	setupSubscriptionRecallPurchaseTestDB(t)
	now := time.Now().UTC()
	fixture := createRecallClaimFixture(t, now)
	insertPurchaseServiceUser(t, fixture.recipient.UserId, 50000)
	plan := insertPurchaseServicePlan(t, 7551, 1, 1, 100)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("stripe_price_id", "price_subscription").Error)
	original := PurchaseSubscriptionCommand{
		UserID:        fixture.recipient.UserId,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceBalance,
		Months:        3,
		RequestID:     "recall-replay-discount-change",
		RecallClaim:   fixture.claim,
		VerifiedQuote: &SubscriptionPurchaseQuote{
			Currency:                 "USD",
			UnitPrice:                1,
			UnitAmountMinor:          100,
			OriginalTotal:            3,
			OriginalTotalAmountMinor: 300,
			DiscountAmount:           0.20,
			DiscountAmountMinor:      20,
			Total:                    2.80,
			PaymentAmountMinor:       280,
			RecallCampaignID:         fixture.campaign.Id,
			RecallRecipientID:        fixture.recipient.Id,
		},
	}

	first, err := PurchaseSubscription(original)
	require.NoError(t, err)
	require.Equal(t, int64(280), first.Order.PaymentAmountMinor)
	updateRecallFixtureDiscount(t, fixture.campaign.Id, RecallDiscountConfig{Type: "percent", PercentOff: 50})
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", fixture.recipient.Id).Updates(map[string]interface{}{
		"state":        model.RecallRecipientConverted,
		"converted_at": time.Now().Unix(),
	}).Error)

	replay, err := PurchaseSubscription(original)

	require.NoError(t, err)
	require.Equal(t, first.Intent.Id, replay.Intent.Id)
	require.Equal(t, first.Order.Id, replay.Order.Id)
	require.Equal(t, int64(280), replay.Order.PaymentAmountMinor)
	var user model.User
	require.NoError(t, model.DB.First(&user, "id = ?", fixture.recipient.UserId).Error)
	require.Equal(t, 49720, user.Quota)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", fixture.recipient.UserId).Count(&orderCount).Error)
	require.Equal(t, int64(1), orderCount)
}

func TestSubscriptionPurchaseAmountFromMinorUsesCurrencyScale(t *testing.T) {
	require.Equal(t, float64(1000), SubscriptionPurchaseAmountFromMinor(1000, "JPY"))
	require.Equal(t, float64(10), SubscriptionPurchaseAmountFromMinor(1000, "USD"))
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

func TestPurchaseSubscriptionReplayRequiresMatchingPaymentProvider(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7364, 2000)
	plan := insertPurchaseServicePlan(t, 7465, 1, 2, 200)

	first, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7364,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceEpay,
		PaymentMethod: model.SubscriptionPaymentMethodAlipay,
		Months:        1,
		RequestID:     "provider-conflict-alipay",
		VerifiedQuote: subscriptionPurchaseTestQuote("USD", 2, 1),
	})
	require.NoError(t, err)
	require.Equal(t, model.PaymentProviderEpay, first.Order.PaymentProvider)

	_, err = PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7364,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceAlipay,
		Months:        1,
		RequestID:     "provider-conflict-alipay",
	})

	require.Error(t, err)
	require.Contains(t, err.Error(), "idempotency")
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 7364).Count(&orderCount).Error)
	require.Equal(t, int64(1), orderCount)
}

func TestPurchaseSubscriptionReplayAllowsSamePaymentProvider(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7365, 2000)
	plan := insertPurchaseServicePlan(t, 7466, 1, 2, 200)
	cmd := PurchaseSubscriptionCommand{
		UserID:        7365,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceEpay,
		PaymentMethod: model.SubscriptionPaymentMethodAlipay,
		Months:        1,
		RequestID:     "provider-same-alipay",
		VerifiedQuote: subscriptionPurchaseTestQuote("USD", 2, 1),
	}

	first, err := PurchaseSubscription(cmd)
	require.NoError(t, err)
	replayed, err := PurchaseSubscription(PurchaseSubscriptionCommand{
		UserID:        7365,
		PlanID:        plan.Id,
		PaymentChoice: SubscriptionPaymentChoiceEpay,
		PaymentMethod: model.SubscriptionPaymentMethodAlipay,
		Months:        1,
		RequestID:     "provider-same-alipay",
	})

	require.NoError(t, err)
	require.Equal(t, first.Intent.Id, replayed.Intent.Id)
	require.Equal(t, first.Order.Id, replayed.Order.Id)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 7365).Count(&orderCount).Error)
	require.Equal(t, int64(1), orderCount)
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
		VerifiedQuote: subscriptionPurchaseTestQuote("BRL", 11, 2),
	})

	require.NoError(t, err)
	require.Equal(t, common.TopUpStatusPending, result.Order.Status)
	require.Equal(t, SubscriptionPaymentChoicePix, result.Order.PaymentMethod)
	require.Equal(t, "BRL", result.Order.PaymentCurrency)
	require.Equal(t, int64(2200), result.Order.PaymentAmountMinor)
	require.Equal(t, float64(11), result.Order.UnitPrice)
	require.Equal(t, float64(22), result.Order.Money)
}

func TestPurchaseSubscriptionOneTimeRejectsVerifiedQuoteThatDoesNotMatchRequote(t *testing.T) {
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

	_, err := PurchaseSubscription(PurchaseSubscriptionCommand{
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

	require.Error(t, err)
	require.Contains(t, err.Error(), "quote")
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 7315).Count(&orderCount).Error)
	require.Zero(t, orderCount)
}

func TestPurchaseSubscriptionRejectsQuoteNotDerivedFromRoundedMonthlyMinorAmount(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7316, 1000)
	plan := insertPurchaseServicePlan(t, 7419, 1, 2, 200)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("pix_price_brl", 49.90).Error)

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
	require.Contains(t, err.Error(), "total")
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 7316).Count(&orderCount).Error)
	require.Zero(t, orderCount)
}

func TestPurchaseSubscriptionNormalizesVerifiedQuoteDisplayAmountsToMinorUnits(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7317, 1000)
	plan := insertPurchaseServicePlan(t, 7420, 1, 2, 200)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("pix_price_brl", 49.904999).Error)

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
		VerifiedQuote: subscriptionPurchaseTestQuote("INR", 180, 3),
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
				VerifiedQuote: subscriptionPurchaseTestQuote(test.currency, test.price, 1),
			})

			require.NoError(t, err)
			require.Equal(t, common.TopUpStatusPending, result.Order.Status)
			require.Equal(t, model.PaymentProviderStripe, result.Order.PaymentProvider)
			require.Empty(t, result.Order.RenewalSource)
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
