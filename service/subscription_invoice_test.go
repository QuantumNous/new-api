package service

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"github.com/stripe/stripe-go/v86"
	"gorm.io/gorm"
)

func TestGetStripeInvoiceForReconcileExpandsDahliaInvoiceShape(t *testing.T) {
	originalBackend := stripe.GetBackend(stripe.APIBackend)
	originalSecret := setting.StripeApiSecret
	originalKey := stripe.Key
	var expandValues []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodGet, r.Method)
		require.Equal(t, "/v1/invoices/in_test_v86", r.URL.Path)
		for key, values := range r.URL.Query() {
			if key == "expand" || strings.HasPrefix(key, "expand[") {
				expandValues = append(expandValues, values...)
			}
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"in_test_v86","object":"invoice"}`))
	}))
	stripe.SetBackend(stripe.APIBackend, stripe.GetBackendWithConfig(stripe.APIBackend, &stripe.BackendConfig{
		URL:               stripe.String(server.URL),
		HTTPClient:        server.Client(),
		MaxNetworkRetries: stripe.Int64(0),
		LeveledLogger:     &stripe.LeveledLogger{Level: stripe.LevelNull},
	}))
	setting.StripeApiSecret = "sk_test_invoice_v86"
	t.Cleanup(func() {
		server.Close()
		stripe.SetBackend(stripe.APIBackend, originalBackend)
		setting.StripeApiSecret = originalSecret
		stripe.Key = originalKey
	})

	_, err := getStripeInvoiceForReconcile(context.Background(), " in_test_v86 ")

	require.NoError(t, err)
	require.ElementsMatch(t, []string{
		"lines.data.pricing.price_details.price",
		"parent.subscription_details.subscription",
		"customer",
	}, expandValues)
	require.NotContains(t, expandValues, "lines.data.price")
	require.NotContains(t, expandValues, "subscription")
}

func setupSubscriptionInvoiceServiceTestDB(t *testing.T) {
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
	sqlDB.SetMaxOpenConns(1)

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
		&model.SubscriptionProviderBinding{},
		&model.UserSubscriptionContract{},
		&model.SubscriptionChangeIntent{},
		&model.SubscriptionTermSegment{},
		&model.WalletLedgerEntry{},
		&model.TopUp{},
	))
}

func seedStripeInvoicePurchase(t *testing.T, userID int, planID int, tradeNo string) (model.UserSubscriptionContract, model.SubscriptionChangeIntent) {
	t.Helper()
	rank := 1
	require.NoError(t, model.DB.Create(&model.User{
		Id:       userID,
		Username: "invoice_user",
		Email:    "invoice-user@example.com",
		Status:   common.UserStatusEnabled,
		Group:    "plg",
		AffCode:  "invoice_aff",
	}).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:              planID,
		Title:           "Invoice Plan",
		PriceAmount:     12.34,
		Currency:        "USD",
		DurationUnit:    model.SubscriptionDurationMonth,
		DurationValue:   1,
		Enabled:         true,
		TierRank:        &rank,
		AllowBalancePay: common.GetPointer(true),
		TotalAmount:     1234,
		StripePriceId:   "price_invoice_plan",
	}).Error)
	contract := model.UserSubscriptionContract{
		UserId:      userID,
		Status:      model.SubscriptionContractStatusEnded,
		PaymentMode: model.SubscriptionPaymentModeExternalOnePeriod,
	}
	require.NoError(t, model.DB.Create(&contract).Error)
	intent := model.SubscriptionChangeIntent{
		ContractId:    contract.Id,
		UserId:        userID,
		RequestId:     "550e8400-e29b-41d4-a716-446655440100",
		Kind:          model.SubscriptionChangeIntentKindPurchase,
		PaymentMode:   model.SubscriptionPaymentModeStripeRecurring,
		Status:        model.SubscriptionChangeIntentStatusAwaitingPayment,
		ToPlanId:      planID,
		ChangeVersion: contract.ChangeVersion + 1,
	}
	require.NoError(t, model.DB.Create(&intent).Error)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).Update("latest_change_intent_id", intent.Id).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionOrder{
		UserId:          userID,
		PlanId:          planID,
		Money:           12.34,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodStripe,
		PaymentProvider: model.PaymentProviderStripe,
		Status:          common.TopUpStatusPending,
		CreateTime:      common.GetTimestamp(),
		ProviderPayload: fmt.Sprintf("change_intent_id=%d", intent.Id),
	}).Error)
	return contract, intent
}

func stripeInvoiceFixture(invoiceID string, subscriptionID string) *stripe.Invoice {
	return &stripe.Invoice{
		ID:         invoiceID,
		Status:     stripe.InvoiceStatusPaid,
		AmountPaid: 1234,
		Total:      1234,
		Currency:   stripe.CurrencyUSD,
		Customer:   &stripe.Customer{ID: "cus_invoice"},
		Livemode:   false,
		Parent: &stripe.InvoiceParent{
			SubscriptionDetails: &stripe.InvoiceParentSubscriptionDetails{
				Subscription: &stripe.Subscription{ID: subscriptionID},
			},
		},
		Lines: &stripe.InvoiceLineItemList{Data: []*stripe.InvoiceLineItem{
			{
				Amount:   1234,
				Currency: stripe.CurrencyUSD,
				Pricing: &stripe.InvoiceLineItemPricing{
					PriceDetails: &stripe.InvoiceLineItemPricingPriceDetails{
						Price: &stripe.Price{ID: "price_invoice_plan"},
					},
				},
				Period: &stripe.Period{Start: 1700000000, End: 1702592000},
			},
		}},
	}
}

func stripeSubscriptionFixture(subscriptionID string, metadata map[string]string) *stripe.Subscription {
	return &stripe.Subscription{
		ID:       subscriptionID,
		Customer: &stripe.Customer{ID: "cus_invoice"},
		Status:   stripe.SubscriptionStatusActive,
		Livemode: false,
		Metadata: metadata,
		Items: &stripe.SubscriptionItemList{Data: []*stripe.SubscriptionItem{
			{
				ID:                 "si_invoice",
				Price:              &stripe.Price{ID: "price_invoice_plan"},
				CurrentPeriodStart: 1700000000,
				CurrentPeriodEnd:   1702592000,
			},
		}},
		LatestInvoice: &stripe.Invoice{ID: "in_first"},
	}
}

func setStripeInvoiceLinePrice(line *stripe.InvoiceLineItem, priceID string) {
	if line == nil {
		return
	}
	line.Pricing = &stripe.InvoiceLineItemPricing{
		PriceDetails: &stripe.InvoiceLineItemPricingPriceDetails{
			Price: &stripe.Price{ID: priceID},
		},
	}
}

func setStripeSubscriptionCurrentPeriod(sub *stripe.Subscription, start int64, end int64) {
	if sub == nil {
		return
	}
	if sub.Items == nil {
		sub.Items = &stripe.SubscriptionItemList{}
	}
	if len(sub.Items.Data) == 0 || sub.Items.Data[0] == nil {
		sub.Items.Data = []*stripe.SubscriptionItem{{}}
	}
	sub.Items.Data[0].CurrentPeriodStart = start
	sub.Items.Data[0].CurrentPeriodEnd = end
}

func markStripeInvoiceUnpaid(inv *stripe.Invoice) {
	if inv == nil {
		return
	}
	inv.Status = stripe.InvoiceStatusOpen
	inv.AmountPaid = 0
}

func seedStripeRenewalContract(t *testing.T, userID int, planID int, providerSubscriptionID string) (model.UserSubscriptionContract, model.SubscriptionProviderBinding, model.UserSubscription) {
	t.Helper()
	rank := 1
	require.NoError(t, model.DB.Create(&model.User{
		Id:             userID,
		Username:       "renewal_user",
		Email:          "renewal-user@example.com",
		Status:         common.UserStatusEnabled,
		Group:          "plg",
		AffCode:        "renewal_aff",
		StripeCustomer: "cus_invoice",
	}).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:              planID,
		Title:           "Renewal Plan",
		PriceAmount:     12.34,
		Currency:        "USD",
		DurationUnit:    model.SubscriptionDurationMonth,
		DurationValue:   1,
		Enabled:         true,
		TierRank:        &rank,
		AllowBalancePay: common.GetPointer(true),
		TotalAmount:     1234,
		StripePriceId:   "price_invoice_plan",
	}).Error)
	contract := model.UserSubscriptionContract{
		UserId:      userID,
		Status:      model.SubscriptionContractStatusActive,
		PaymentMode: model.SubscriptionPaymentModeStripeRecurring,
	}
	require.NoError(t, model.DB.Create(&contract).Error)
	binding := model.SubscriptionProviderBinding{
		UserId:                 userID,
		PlanId:                 planID,
		ContractId:             contract.Id,
		Provider:               model.PaymentProviderStripe,
		ProviderSubscriptionId: providerSubscriptionID,
		ProviderCustomerId:     "cus_invoice",
		ProviderPriceId:        "price_invoice_plan",
		ProviderStatus:         "active",
		CurrentPeriodStart:     1700000000,
		CurrentPeriodEnd:       1702592000,
	}
	require.NoError(t, model.DB.Create(&binding).Error)
	currentSlot := 1
	grantKey := "stripe:in_old"
	entitlement := model.UserSubscription{
		UserId:            userID,
		PlanId:            planID,
		ContractId:        contract.Id,
		ProviderBindingId: binding.Id,
		GrantKey:          &grantKey,
		CurrentSlot:       &currentSlot,
		AmountTotal:       1234,
		AmountUsed:        777,
		StartTime:         1700000000,
		EndTime:           1702592000,
		AccessEndTime:     1702592000,
		Status:            model.SubscriptionEntitlementStatusActive,
		PaymentMode:       model.SubscriptionPaymentModeStripeRecurring,
		Source:            model.PaymentMethodStripe,
	}
	require.NoError(t, model.DB.Create(&entitlement).Error)
	require.NoError(t, model.DB.Model(&contract).Updates(map[string]interface{}{
		"current_plan_id":             planID,
		"current_entitlement_id":      entitlement.Id,
		"current_provider_binding_id": binding.Id,
		"current_period_start":        entitlement.StartTime,
		"current_period_end":          entitlement.EndTime,
	}).Error)
	return contract, binding, entitlement
}

func TestReconcilePaidInvoiceGrantsInvoiceFirstPurchase(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	contract, intent := seedStripeInvoicePurchase(t, 8101, 8201, "sub_invoice_first")
	restore := replaceStripeInvoiceReconcilers(t, stripeInvoiceFixture("in_first", "sub_invoice_first"), stripeSubscriptionFixture("sub_invoice_first", map[string]string{
		"trade_no":         "sub_invoice_first",
		"user_id":          "8101",
		"plan_id":          "8201",
		"contract_id":      strconv.FormatInt(contract.Id, 10),
		"change_intent_id": strconv.FormatInt(intent.Id, 10),
	}))
	defer restore()

	result, err := ReconcilePaidInvoice(context.Background(), "in_first")

	require.NoError(t, err)
	require.NotNil(t, result)
	require.True(t, result.Applied)
	var entitlement model.UserSubscription
	require.NoError(t, model.DB.First(&entitlement, "user_id = ?", 8101).Error)
	require.Equal(t, "stripe:in_first", *entitlement.GrantKey)
	require.Equal(t, int64(1234), entitlement.AmountTotal)
	require.Equal(t, model.SubscriptionPaymentModeStripeRecurring, entitlement.PaymentMode)
	var bindingCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("provider_subscription_id = ?", "sub_invoice_first").Count(&bindingCount).Error)
	require.Equal(t, int64(1), bindingCount)
	var order model.SubscriptionOrder
	require.NoError(t, model.DB.First(&order, "trade_no = ?", "sub_invoice_first").Error)
	require.Equal(t, common.TopUpStatusSuccess, order.Status)
	var applied model.SubscriptionChangeIntent
	require.NoError(t, model.DB.First(&applied, "id = ?", intent.Id).Error)
	require.Equal(t, model.SubscriptionChangeIntentStatusApplied, applied.Status)
	require.Equal(t, "in_first", applied.ProviderInvoiceId)
}

func TestReconcilePaidInvoiceFirstPurchaseUsesFrozenOrderPlanSnapshotAfterPlanEdit(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	contract, intent := seedStripeInvoicePurchase(t, 8130, 8230, "sub_invoice_snapshot_first")
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", 8230).Updates(map[string]interface{}{
		"media_credits_monthly": int64(55),
		"window_5h_amount":      int64(125),
		"window_week_amount":    int64(900),
		"upgrade_group":         "snapshot_group",
	}).Error)
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("trade_no = ?", "sub_invoice_snapshot_first").Updates(map[string]interface{}{
		"plan_snapshot": `{"plan_id":8230,"title":"Invoice Plan","price_amount":12.34,"currency":"USD","duration_unit":"month","duration_value":1,"total_amount":1234,"window_5h_amount":125,"window_week_amount":900,"media_credits_monthly":55,"upgrade_group":"snapshot_group"}`,
	}).Error)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", 8230).Updates(map[string]interface{}{
		"price_amount":          99.99,
		"total_amount":          int64(999999),
		"media_credits_monthly": int64(999),
		"window_5h_amount":      int64(999),
		"window_week_amount":    int64(888),
		"upgrade_group":         "edited_group",
	}).Error)
	restore := replaceStripeInvoiceReconcilers(t, stripeInvoiceFixture("in_first_snapshot", "sub_invoice_snapshot_first"), stripeSubscriptionFixture("sub_invoice_snapshot_first", map[string]string{
		"trade_no":         "sub_invoice_snapshot_first",
		"user_id":          "8130",
		"plan_id":          "8230",
		"contract_id":      strconv.FormatInt(contract.Id, 10),
		"change_intent_id": strconv.FormatInt(intent.Id, 10),
	}))
	defer restore()

	result, err := ReconcilePaidInvoice(context.Background(), "in_first_snapshot")

	require.NoError(t, err)
	require.True(t, result.Applied)
	require.NotNil(t, result.Entitlement)
	require.Equal(t, int64(1234), result.Entitlement.AmountTotal)
	require.Equal(t, int64(55), result.Entitlement.MediaCreditsTotal)
	require.NotNil(t, result.Entitlement.Window5hAmount)
	require.NotNil(t, result.Entitlement.WindowWeekAmount)
	require.Equal(t, int64(125), *result.Entitlement.Window5hAmount)
	require.Equal(t, int64(900), *result.Entitlement.WindowWeekAmount)
	require.Equal(t, "snapshot_group", result.Entitlement.UpgradeGroup)
}

func TestReconcilePaidInvoiceIsIdempotentForDuplicateAndCheckoutFirst(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	contract, intent := seedStripeInvoicePurchase(t, 8102, 8202, "sub_duplicate_invoice")
	restore := replaceStripeInvoiceReconcilers(t, stripeInvoiceFixture("in_duplicate", "sub_duplicate_invoice"), stripeSubscriptionFixture("sub_duplicate_invoice", map[string]string{
		"trade_no":         "sub_duplicate_invoice",
		"user_id":          "8102",
		"plan_id":          "8202",
		"contract_id":      strconv.FormatInt(contract.Id, 10),
		"change_intent_id": strconv.FormatInt(intent.Id, 10),
	}))
	defer restore()

	first, err := ReconcilePaidInvoice(context.Background(), "in_duplicate")
	require.NoError(t, err)
	second, err := ReconcilePaidInvoice(context.Background(), "in_duplicate")
	require.NoError(t, err)

	require.True(t, first.Applied)
	require.False(t, second.Applied)
	var entitlementCount int64
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("user_id = ?", 8102).Count(&entitlementCount).Error)
	require.Equal(t, int64(1), entitlementCount)
	var bindingCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("user_id = ?", 8102).Count(&bindingCount).Error)
	require.Equal(t, int64(1), bindingCount)
}

func TestReconcilePaidInvoiceRenewsExistingStripeBindingWithoutCheckoutOrder(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	contract, binding, oldEntitlement := seedStripeRenewalContract(t, 8120, 8220, "sub_renewal_paid")
	invoice := stripeInvoiceFixture("in_renewal", "sub_renewal_paid")
	invoice.Lines.Data[0].Period = &stripe.Period{Start: oldEntitlement.EndTime, End: oldEntitlement.EndTime + 2592000}
	subscription := stripeSubscriptionFixture("sub_renewal_paid", map[string]string{})
	setStripeSubscriptionCurrentPeriod(subscription, oldEntitlement.EndTime, oldEntitlement.EndTime+2592000)
	restore := replaceStripeInvoiceReconcilers(t, invoice, subscription)
	defer restore()

	first, err := ReconcilePaidInvoice(context.Background(), "in_renewal")
	require.NoError(t, err)
	second, err := ReconcilePaidInvoice(context.Background(), "in_renewal")
	require.NoError(t, err)

	require.True(t, first.Applied)
	require.False(t, second.Applied)
	var grants []model.UserSubscription
	require.NoError(t, model.DB.Where("contract_id = ?", contract.Id).Order("id asc").Find(&grants).Error)
	require.Len(t, grants, 2)
	require.Equal(t, int64(777), grants[0].AmountUsed)
	require.Equal(t, model.SubscriptionEntitlementStatusHistorical, grants[0].Status)
	require.Equal(t, model.SubscriptionEntitlementEndReasonRenewed, grants[0].EndReason)
	require.Equal(t, int64(0), grants[1].AmountUsed)
	require.Equal(t, int64(1234), grants[1].AmountTotal)
	require.Equal(t, "stripe:in_renewal", *grants[1].GrantKey)
	require.Equal(t, binding.Id, grants[1].ProviderBindingId)
	var reloadedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&reloadedContract, "id = ?", contract.Id).Error)
	require.Equal(t, model.SubscriptionContractStatusActive, reloadedContract.Status)
	require.Equal(t, grants[1].Id, reloadedContract.CurrentEntitlementId)
	require.Equal(t, oldEntitlement.EndTime, reloadedContract.CurrentPeriodStart)
	require.Equal(t, oldEntitlement.EndTime+2592000, reloadedContract.CurrentPeriodEnd)
}

func TestReconcilePaidInvoiceRenewalUsesFrozenBindingOrderPlanSnapshotAfterPlanEdit(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	contract, binding, oldEntitlement := seedStripeRenewalContract(t, 8131, 8231, "sub_renewal_snapshot")
	order := model.SubscriptionOrder{
		UserId:          8131,
		PlanId:          8231,
		Money:           12.34,
		TradeNo:         "sub_renewal_snapshot_order",
		PaymentMethod:   model.PaymentMethodStripe,
		PaymentProvider: model.PaymentProviderStripe,
		Status:          common.TopUpStatusSuccess,
		CreateTime:      common.GetTimestamp(),
		CompleteTime:    common.GetTimestamp(),
		PlanSnapshot:    `{"plan_id":8231,"title":"Renewal Plan","price_amount":12.34,"currency":"USD","duration_unit":"month","duration_value":1,"total_amount":1234,"window_5h_amount":125,"window_week_amount":900,"media_credits_monthly":55,"upgrade_group":"snapshot_group"}`,
	}
	require.NoError(t, model.DB.Create(&order).Error)
	require.NoError(t, model.DB.Model(&binding).Updates(map[string]interface{}{"initial_order_id": order.Id}).Error)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", 8231).Updates(map[string]interface{}{
		"price_amount":          99.99,
		"total_amount":          int64(999999),
		"media_credits_monthly": int64(999),
		"window_5h_amount":      int64(999),
		"window_week_amount":    int64(888),
		"upgrade_group":         "edited_group",
	}).Error)
	invoice := stripeInvoiceFixture("in_renewal_snapshot", "sub_renewal_snapshot")
	invoice.Lines.Data[0].Period = &stripe.Period{Start: oldEntitlement.EndTime, End: oldEntitlement.EndTime + 2592000}
	subscription := stripeSubscriptionFixture("sub_renewal_snapshot", map[string]string{})
	setStripeSubscriptionCurrentPeriod(subscription, oldEntitlement.EndTime, oldEntitlement.EndTime+2592000)
	restore := replaceStripeInvoiceReconcilers(t, invoice, subscription)
	defer restore()

	result, err := ReconcilePaidInvoice(context.Background(), "in_renewal_snapshot")

	require.NoError(t, err)
	require.True(t, result.Applied)
	require.NotNil(t, result.Entitlement)
	require.Equal(t, int64(1234), result.Entitlement.AmountTotal)
	require.Equal(t, int64(55), result.Entitlement.MediaCreditsTotal)
	require.NotNil(t, result.Entitlement.Window5hAmount)
	require.NotNil(t, result.Entitlement.WindowWeekAmount)
	require.Equal(t, int64(125), *result.Entitlement.Window5hAmount)
	require.Equal(t, int64(900), *result.Entitlement.WindowWeekAmount)
	require.Equal(t, "snapshot_group", result.Entitlement.UpgradeGroup)
	require.Equal(t, contract.Id, result.Entitlement.ContractId)
}

func TestReconcilePaidInvoiceRenewsExistingStripeBindingForDisabledBoundPlan(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	contract, binding, oldEntitlement := seedStripeRenewalContract(t, 8123, 8223, "sub_renewal_disabled_plan")
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", binding.PlanId).Update("enabled", false).Error)
	invoice := stripeInvoiceFixture("in_renewal_disabled_plan", "sub_renewal_disabled_plan")
	invoice.Lines.Data[0].Period = &stripe.Period{Start: oldEntitlement.EndTime, End: oldEntitlement.EndTime + 2592000}
	subscription := stripeSubscriptionFixture("sub_renewal_disabled_plan", map[string]string{})
	setStripeSubscriptionCurrentPeriod(subscription, oldEntitlement.EndTime, oldEntitlement.EndTime+2592000)
	restore := replaceStripeInvoiceReconcilers(t, invoice, subscription)
	defer restore()

	first, err := ReconcilePaidInvoice(context.Background(), "in_renewal_disabled_plan")
	require.NoError(t, err)
	second, err := ReconcilePaidInvoice(context.Background(), "in_renewal_disabled_plan")
	require.NoError(t, err)

	require.True(t, first.Applied)
	require.False(t, second.Applied)
	var grants []model.UserSubscription
	require.NoError(t, model.DB.Where("contract_id = ?", contract.Id).Order("id asc").Find(&grants).Error)
	require.Len(t, grants, 2)
	require.Equal(t, model.SubscriptionEntitlementStatusHistorical, grants[0].Status)
	require.Equal(t, model.SubscriptionEntitlementStatusActive, grants[1].Status)
	require.Equal(t, int64(0), grants[1].AmountUsed)
	require.Equal(t, int64(1234), grants[1].AmountTotal)
	require.Equal(t, "stripe:in_renewal_disabled_plan", *grants[1].GrantKey)
	require.Equal(t, binding.Id, grants[1].ProviderBindingId)
	var reloadedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&reloadedContract, "id = ?", contract.Id).Error)
	require.Equal(t, model.SubscriptionContractStatusActive, reloadedContract.Status)
	require.Equal(t, grants[1].Id, reloadedContract.CurrentEntitlementId)
}

func TestReconcilePaidInvoiceIgnoresOlderRenewalAfterNewerPeriodApplied(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	contract, binding, oldEntitlement := seedStripeRenewalContract(t, 8124, 8224, "sub_renewal_out_of_order")
	period1Start := oldEntitlement.EndTime
	period1End := period1Start + 2592000
	period2Start := period1End
	period2End := period2Start + 2592000
	period1Invoice := stripeInvoiceFixture("in_renewal_period1_late", "sub_renewal_out_of_order")
	period1Invoice.Lines.Data[0].Period = &stripe.Period{Start: period1Start, End: period1End}
	period2Invoice := stripeInvoiceFixture("in_renewal_period2_first", "sub_renewal_out_of_order")
	period2Invoice.Lines.Data[0].Period = &stripe.Period{Start: period2Start, End: period2End}
	subscription := stripeSubscriptionFixture("sub_renewal_out_of_order", map[string]string{})
	setStripeSubscriptionCurrentPeriod(subscription, period2Start, period2End)
	originalInvoiceGetter := stripeInvoiceGetter
	originalSubscriptionGetter := stripeSubscriptionGetter
	stripeInvoiceGetter = func(ctx context.Context, invoiceID string) (*stripe.Invoice, error) {
		switch invoiceID {
		case "in_renewal_period2_first":
			return period2Invoice, nil
		case "in_renewal_period1_late":
			return period1Invoice, nil
		default:
			return nil, errors.New("unexpected invoice id")
		}
	}
	stripeSubscriptionGetter = func(ctx context.Context, subscriptionID string) (*stripe.Subscription, error) {
		return subscription, nil
	}
	defer func() {
		stripeInvoiceGetter = originalInvoiceGetter
		stripeSubscriptionGetter = originalSubscriptionGetter
	}()

	first, err := ReconcilePaidInvoice(context.Background(), "in_renewal_period2_first")
	require.NoError(t, err)
	second, err := ReconcilePaidInvoice(context.Background(), "in_renewal_period1_late")
	require.NoError(t, err)

	require.True(t, first.Applied)
	require.False(t, second.Applied)
	var grants []model.UserSubscription
	require.NoError(t, model.DB.Where("contract_id = ?", contract.Id).Order("id asc").Find(&grants).Error)
	require.Len(t, grants, 2)
	require.Equal(t, period2Start, grants[1].StartTime)
	require.Equal(t, period2End, grants[1].EndTime)
	require.Equal(t, "stripe:in_renewal_period2_first", *grants[1].GrantKey)
	var reloadedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&reloadedContract, "id = ?", contract.Id).Error)
	require.Equal(t, model.SubscriptionContractStatusActive, reloadedContract.Status)
	require.Equal(t, period2Start, reloadedContract.CurrentPeriodStart)
	require.Equal(t, period2End, reloadedContract.CurrentPeriodEnd)
	require.Equal(t, grants[1].Id, reloadedContract.CurrentEntitlementId)
	var reloadedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&reloadedBinding, "id = ?", binding.Id).Error)
	require.Equal(t, "in_renewal_period2_first", reloadedBinding.ProviderLatestInvoiceId)
	require.Equal(t, period2Start, reloadedBinding.CurrentPeriodStart)
	require.Equal(t, period2End, reloadedBinding.CurrentPeriodEnd)
}

func TestReconcilePaidInvoiceIgnoresLatePaidInvoiceForTerminatedBinding(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	contract, binding, entitlement := seedStripeRenewalContract(t, 8126, 8226, "sub_renewal_terminated")
	require.NoError(t, model.DB.Model(&contract).Updates(map[string]interface{}{
		"status":     model.SubscriptionContractStatusEnded,
		"updated_at": common.GetTimestamp(),
	}).Error)
	_, err := model.ApplyProviderSubscriptionTermination(binding.Id, model.ProviderSubscriptionSnapshot{
		ProviderSubscriptionId:     binding.ProviderSubscriptionId,
		ProviderSubscriptionItemId: binding.ProviderSubscriptionItemId,
		ProviderCustomerId:         binding.ProviderCustomerId,
		ProviderPriceId:            binding.ProviderPriceId,
		ProviderLatestInvoiceId:    "in_terminal_snapshot",
		ProviderStatus:             "canceled",
		CurrentPeriodStart:         binding.CurrentPeriodStart,
		CurrentPeriodEnd:           binding.CurrentPeriodEnd,
		EndedAt:                    common.GetTimestamp(),
	})
	require.NoError(t, err)
	invoice := stripeInvoiceFixture("in_terminal_late_paid", "sub_renewal_terminated")
	invoice.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
	subscription := stripeSubscriptionFixture("sub_renewal_terminated", map[string]string{})
	restore := replaceStripeInvoiceReconcilers(t, invoice, subscription)
	defer restore()

	result, err := ReconcilePaidInvoice(context.Background(), "in_terminal_late_paid")

	require.NoError(t, err)
	require.False(t, result.Applied)
	var grants []model.UserSubscription
	require.NoError(t, model.DB.Where("contract_id = ?", contract.Id).Order("id asc").Find(&grants).Error)
	require.Len(t, grants, 1)
	require.Equal(t, "cancelled", grants[0].Status)
	var reloadedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&reloadedContract, "id = ?", contract.Id).Error)
	require.Equal(t, model.SubscriptionContractStatusEnded, reloadedContract.Status)
	var reloadedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&reloadedBinding, "id = ?", binding.Id).Error)
	require.Equal(t, "canceled", reloadedBinding.ProviderStatus)
	require.NotZero(t, reloadedBinding.EndedAt)
}

func TestReconcilePaidInvoiceNoBindingWithoutNewAPIMetadataIsNoOp(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	invoice := stripeInvoiceFixture("in_legacy_paid", "sub_legacy_paid")
	subscription := stripeSubscriptionFixture("sub_legacy_paid", map[string]string{})
	restore := replaceStripeInvoiceReconcilers(t, invoice, subscription)
	defer restore()

	result, err := ReconcilePaidInvoice(context.Background(), "in_legacy_paid")

	require.NoError(t, err)
	require.False(t, result.Applied)
	var bindingCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Count(&bindingCount).Error)
	require.Zero(t, bindingCount)
}

func TestReconcilePaidInvoiceNoBindingWithCompleteNewAPIMetadataRetriesMissingLocalRecords(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	invoice := stripeInvoiceFixture("in_missing_local_paid", "sub_missing_local_paid")
	subscription := stripeSubscriptionFixture("sub_missing_local_paid", map[string]string{
		"trade_no":         "sub_missing_local_paid",
		"user_id":          "8991",
		"plan_id":          "8992",
		"contract_id":      "8993",
		"change_intent_id": "8994",
	})
	restore := replaceStripeInvoiceReconcilers(t, invoice, subscription)
	defer restore()

	result, err := ReconcilePaidInvoice(context.Background(), "in_missing_local_paid")

	require.Error(t, err)
	require.Nil(t, result)
}

func TestReconcileFailedInvoiceMovesContractToGraceWithoutResettingUsage(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	contract, _, entitlement := seedStripeRenewalContract(t, 8121, 8221, "sub_payment_failed")
	invoice := stripeInvoiceFixture("in_failed", "sub_payment_failed")
	markStripeInvoiceUnpaid(invoice)
	invoice.Status = stripe.InvoiceStatusOpen
	subscription := stripeSubscriptionFixture("sub_payment_failed", map[string]string{})
	restore := replaceStripeInvoiceReconcilers(t, invoice, subscription)
	defer restore()

	err := ReconcileFailedInvoice(context.Background(), "in_failed")
	require.NoError(t, err)
	require.NoError(t, ReconcileFailedInvoice(context.Background(), "in_failed"))

	var reloaded model.UserSubscription
	require.NoError(t, model.DB.First(&reloaded, "id = ?", entitlement.Id).Error)
	require.Equal(t, entitlement.EndTime, reloaded.EndTime)
	require.Equal(t, entitlement.EndTime+int64((72*time.Hour).Seconds()), reloaded.AccessEndTime)
	require.Equal(t, int64(777), reloaded.AmountUsed)
	require.Equal(t, model.SubscriptionEntitlementStatusActive, reloaded.Status)
	var reloadedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&reloadedContract, "id = ?", contract.Id).Error)
	require.Equal(t, model.SubscriptionContractStatusGrace, reloadedContract.Status)
	require.Equal(t, reloaded.AccessEndTime, reloadedContract.GracePeriodEnd)
}

func TestReconcileFailedInvoiceWithPaidFreshInvoiceKeepsPaidRenewalActive(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	contract, _, oldEntitlement := seedStripeRenewalContract(t, 8122, 8222, "sub_failed_after_paid")
	invoice := stripeInvoiceFixture("in_failed_after_paid", "sub_failed_after_paid")
	invoice.Lines.Data[0].Period = &stripe.Period{Start: oldEntitlement.EndTime, End: oldEntitlement.EndTime + 2592000}
	subscription := stripeSubscriptionFixture("sub_failed_after_paid", map[string]string{})
	setStripeSubscriptionCurrentPeriod(subscription, oldEntitlement.EndTime, oldEntitlement.EndTime+2592000)
	restore := replaceStripeInvoiceReconcilers(t, invoice, subscription)
	defer restore()

	paid, err := ReconcilePaidInvoice(context.Background(), "in_failed_after_paid")
	require.NoError(t, err)
	require.True(t, paid.Applied)
	require.NoError(t, ReconcileFailedInvoice(context.Background(), "in_failed_after_paid"))

	var grants []model.UserSubscription
	require.NoError(t, model.DB.Where("contract_id = ?", contract.Id).Order("id asc").Find(&grants).Error)
	require.Len(t, grants, 2)
	require.Equal(t, model.SubscriptionEntitlementStatusHistorical, grants[0].Status)
	require.Equal(t, model.SubscriptionEntitlementStatusActive, grants[1].Status)
	require.Equal(t, int64(0), grants[1].AmountUsed)
	require.Equal(t, grants[1].EndTime, grants[1].AccessEndTime)
	var reloadedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&reloadedContract, "id = ?", contract.Id).Error)
	require.Equal(t, model.SubscriptionContractStatusActive, reloadedContract.Status)
	require.Equal(t, int64(0), reloadedContract.GracePeriodEnd)
	require.Equal(t, grants[1].Id, reloadedContract.CurrentEntitlementId)
	var binding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&binding, "contract_id = ?", contract.Id).Error)
	require.Equal(t, int64(0), binding.GracePeriodEnd)
}

func TestReconcileFailedInvoiceIgnoresOlderFailedInvoiceAfterNewerPaidPeriod(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	contract, binding, oldEntitlement := seedStripeRenewalContract(t, 8125, 8225, "sub_failed_out_of_order")
	period1Start := oldEntitlement.EndTime
	period1End := period1Start + 2592000
	period2Start := period1End
	period2End := period2Start + 2592000
	period1FailedInvoice := stripeInvoiceFixture("in_failed_period1_late", "sub_failed_out_of_order")
	markStripeInvoiceUnpaid(period1FailedInvoice)
	period1FailedInvoice.Status = stripe.InvoiceStatusOpen
	period1FailedInvoice.Lines.Data[0].Period = &stripe.Period{Start: period1Start, End: period1End}
	period2PaidInvoice := stripeInvoiceFixture("in_paid_period2_first", "sub_failed_out_of_order")
	period2PaidInvoice.Lines.Data[0].Period = &stripe.Period{Start: period2Start, End: period2End}
	subscription := stripeSubscriptionFixture("sub_failed_out_of_order", map[string]string{})
	setStripeSubscriptionCurrentPeriod(subscription, period2Start, period2End)
	originalInvoiceGetter := stripeInvoiceGetter
	originalSubscriptionGetter := stripeSubscriptionGetter
	stripeInvoiceGetter = func(ctx context.Context, invoiceID string) (*stripe.Invoice, error) {
		switch invoiceID {
		case "in_paid_period2_first":
			return period2PaidInvoice, nil
		case "in_failed_period1_late":
			return period1FailedInvoice, nil
		default:
			return nil, errors.New("unexpected invoice id")
		}
	}
	stripeSubscriptionGetter = func(ctx context.Context, subscriptionID string) (*stripe.Subscription, error) {
		return subscription, nil
	}
	defer func() {
		stripeInvoiceGetter = originalInvoiceGetter
		stripeSubscriptionGetter = originalSubscriptionGetter
	}()

	paid, err := ReconcilePaidInvoice(context.Background(), "in_paid_period2_first")
	require.NoError(t, err)
	require.True(t, paid.Applied)
	require.NoError(t, ReconcileFailedInvoice(context.Background(), "in_failed_period1_late"))

	var grants []model.UserSubscription
	require.NoError(t, model.DB.Where("contract_id = ?", contract.Id).Order("id asc").Find(&grants).Error)
	require.Len(t, grants, 2)
	require.Equal(t, period2Start, grants[1].StartTime)
	require.Equal(t, period2End, grants[1].EndTime)
	require.Equal(t, grants[1].EndTime, grants[1].AccessEndTime)
	var reloadedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&reloadedContract, "id = ?", contract.Id).Error)
	require.Equal(t, model.SubscriptionContractStatusActive, reloadedContract.Status)
	require.Equal(t, int64(0), reloadedContract.GracePeriodEnd)
	require.Equal(t, period2Start, reloadedContract.CurrentPeriodStart)
	require.Equal(t, period2End, reloadedContract.CurrentPeriodEnd)
	var reloadedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&reloadedBinding, "id = ?", binding.Id).Error)
	require.Equal(t, "in_paid_period2_first", reloadedBinding.ProviderLatestInvoiceId)
	require.Equal(t, int64(0), reloadedBinding.GracePeriodEnd)
	require.Equal(t, period2Start, reloadedBinding.CurrentPeriodStart)
	require.Equal(t, period2End, reloadedBinding.CurrentPeriodEnd)
}

func TestReconcileFailedInvoiceNoBindingIsNoOp(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	invoice := stripeInvoiceFixture("in_legacy_failed", "sub_legacy_failed")
	markStripeInvoiceUnpaid(invoice)
	invoice.Status = stripe.InvoiceStatusOpen
	subscription := stripeSubscriptionFixture("sub_legacy_failed", map[string]string{})
	restore := replaceStripeInvoiceReconcilers(t, invoice, subscription)
	defer restore()

	err := ReconcileFailedInvoice(context.Background(), "in_legacy_failed")

	require.NoError(t, err)
	var bindingCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Count(&bindingCount).Error)
	require.Zero(t, bindingCount)
}

func TestReconcileRenewalInvoiceRejectsBindingFactMismatchWithoutStateAdvance(t *testing.T) {
	testCases := []struct {
		name   string
		mutate func(*stripe.Invoice, *stripe.Subscription)
	}{
		{
			name: "customer",
			mutate: func(inv *stripe.Invoice, sub *stripe.Subscription) {
				inv.Customer = &stripe.Customer{ID: "cus_other"}
			},
		},
		{
			name: "price",
			mutate: func(inv *stripe.Invoice, sub *stripe.Subscription) {
				sub.Items.Data[0].Price = &stripe.Price{ID: "price_other"}
				setStripeInvoiceLinePrice(inv.Lines.Data[0], "price_other")
			},
		},
		{
			name: "livemode",
			mutate: func(inv *stripe.Invoice, sub *stripe.Subscription) {
				inv.Livemode = true
				sub.Livemode = true
			},
		},
	}
	for index, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			setupSubscriptionInvoiceServiceTestDB(t)
			contract, _, entitlement := seedStripeRenewalContract(t, 8140+index, 8240+index, "sub_renewal_mismatch_"+tc.name)
			invoice := stripeInvoiceFixture("in_renewal_mismatch_"+tc.name, "sub_renewal_mismatch_"+tc.name)
			subscription := stripeSubscriptionFixture("sub_renewal_mismatch_"+tc.name, map[string]string{})
			tc.mutate(invoice, subscription)
			restore := replaceStripeInvoiceReconcilers(t, invoice, subscription)
			defer restore()

			_, err := ReconcilePaidInvoice(context.Background(), "in_renewal_mismatch_"+tc.name)

			require.Error(t, err)
			require.True(t, IsPermanentPaidInvoiceError(err))
			var grantCount int64
			require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("contract_id = ?", contract.Id).Count(&grantCount).Error)
			require.Equal(t, int64(1), grantCount)
			var reloaded model.UserSubscription
			require.NoError(t, model.DB.First(&reloaded, "id = ?", entitlement.Id).Error)
			require.Equal(t, int64(777), reloaded.AmountUsed)
			require.Equal(t, model.SubscriptionEntitlementStatusActive, reloaded.Status)
			var reloadedContract model.UserSubscriptionContract
			require.NoError(t, model.DB.First(&reloadedContract, "id = ?", contract.Id).Error)
			require.Equal(t, model.SubscriptionContractStatusActive, reloadedContract.Status)
		})
	}
}

func TestReconcilePaidInvoiceRejectsLocalStripeCustomerMismatch(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	contract, intent := seedStripeInvoicePurchase(t, 8105, 8205, "sub_customer_mismatch")
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", 8105).Update("stripe_customer", "cus_expected").Error)
	restore := replaceStripeInvoiceReconcilers(t, stripeInvoiceFixture("in_customer_mismatch", "sub_customer_mismatch"), stripeSubscriptionFixture("sub_customer_mismatch", map[string]string{
		"trade_no":         "sub_customer_mismatch",
		"user_id":          "8105",
		"plan_id":          "8205",
		"contract_id":      strconv.FormatInt(contract.Id, 10),
		"change_intent_id": strconv.FormatInt(intent.Id, 10),
	}))
	defer restore()

	_, err := ReconcilePaidInvoice(context.Background(), "in_customer_mismatch")

	require.Error(t, err)
	require.True(t, IsPermanentPaidInvoiceError(err))
	require.Contains(t, err.Error(), "customer mismatch")
}

func TestReconcilePaidInvoiceRejectsInvoiceSubscriptionLivemodeMismatch(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	contract, intent := seedStripeInvoicePurchase(t, 8106, 8206, "sub_livemode_mismatch")
	invoice := stripeInvoiceFixture("in_livemode_mismatch", "sub_livemode_mismatch")
	subscription := stripeSubscriptionFixture("sub_livemode_mismatch", map[string]string{
		"trade_no":         "sub_livemode_mismatch",
		"user_id":          "8106",
		"plan_id":          "8206",
		"contract_id":      strconv.FormatInt(contract.Id, 10),
		"change_intent_id": strconv.FormatInt(intent.Id, 10),
	})
	subscription.Livemode = true
	restore := replaceStripeInvoiceReconcilers(t, invoice, subscription)
	defer restore()

	_, err := ReconcilePaidInvoice(context.Background(), "in_livemode_mismatch")

	require.Error(t, err)
	require.True(t, IsPermanentPaidInvoiceError(err))
	require.Contains(t, err.Error(), "livemode mismatch")
}

func TestReconcilePaidInvoiceRejectsMissingStripeCustomer(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	contract, intent := seedStripeInvoicePurchase(t, 8107, 8207, "sub_missing_customer")
	invoice := stripeInvoiceFixture("in_missing_customer", "sub_missing_customer")
	invoice.Customer = nil
	subscription := stripeSubscriptionFixture("sub_missing_customer", map[string]string{
		"trade_no":         "sub_missing_customer",
		"user_id":          "8107",
		"plan_id":          "8207",
		"contract_id":      strconv.FormatInt(contract.Id, 10),
		"change_intent_id": strconv.FormatInt(intent.Id, 10),
	})
	subscription.Customer = nil
	restore := replaceStripeInvoiceReconcilers(t, invoice, subscription)
	defer restore()

	_, err := ReconcilePaidInvoice(context.Background(), "in_missing_customer")

	require.Error(t, err)
	require.True(t, IsPermanentPaidInvoiceError(err))
	require.Contains(t, err.Error(), "customer")
	var entitlementCount int64
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("user_id = ?", 8107).Count(&entitlementCount).Error)
	require.Zero(t, entitlementCount)
	var bindingCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("user_id = ?", 8107).Count(&bindingCount).Error)
	require.Zero(t, bindingCount)
	var order model.SubscriptionOrder
	require.NoError(t, model.DB.First(&order, "trade_no = ?", "sub_missing_customer").Error)
	require.Equal(t, common.TopUpStatusPending, order.Status)
	var reloadedIntent model.SubscriptionChangeIntent
	require.NoError(t, model.DB.First(&reloadedIntent, "id = ?", intent.Id).Error)
	require.Equal(t, model.SubscriptionChangeIntentStatusAwaitingPayment, reloadedIntent.Status)
}

func TestReconcilePaidInvoiceValidatesLivemodeAgainstStripeKeyMode(t *testing.T) {
	testCases := []struct {
		name        string
		key         string
		livemode    bool
		expectError bool
	}{
		{name: "test key accepts test invoice", key: "sk_test_subscription", livemode: false},
		{name: "test key rejects live invoice", key: "sk_test_subscription", livemode: true, expectError: true},
		{name: "live key accepts live invoice", key: "sk_live_subscription", livemode: true},
		{name: "live key rejects test invoice", key: "sk_live_subscription", livemode: false, expectError: true},
	}
	for index, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			setupSubscriptionInvoiceServiceTestDB(t)
			restoreKey := replaceStripeAPISecretForInvoiceTest(t, tc.key)
			defer restoreKey()
			userID := 8110 + index
			planID := 8210 + index
			tradeNo := fmt.Sprintf("sub_livemode_key_%d", index)
			contract, intent := seedStripeInvoicePurchase(t, userID, planID, tradeNo)
			invoice := stripeInvoiceFixture("in_"+tradeNo, tradeNo)
			invoice.Livemode = tc.livemode
			subscription := stripeSubscriptionFixture(tradeNo, map[string]string{
				"trade_no":         tradeNo,
				"user_id":          strconv.Itoa(userID),
				"plan_id":          strconv.Itoa(planID),
				"contract_id":      strconv.FormatInt(contract.Id, 10),
				"change_intent_id": strconv.FormatInt(intent.Id, 10),
			})
			subscription.Livemode = tc.livemode
			restoreReconcilers := replaceStripeInvoiceReconcilers(t, invoice, subscription)
			defer restoreReconcilers()

			_, err := ReconcilePaidInvoice(context.Background(), "in_"+tradeNo)

			if tc.expectError {
				require.Error(t, err)
				require.True(t, IsPermanentPaidInvoiceError(err))
				require.Contains(t, err.Error(), "livemode")
				var entitlementCount int64
				require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("user_id = ?", userID).Count(&entitlementCount).Error)
				require.Zero(t, entitlementCount)
				var bindingCount int64
				require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("user_id = ?", userID).Count(&bindingCount).Error)
				require.Zero(t, bindingCount)
				var order model.SubscriptionOrder
				require.NoError(t, model.DB.First(&order, "trade_no = ?", tradeNo).Error)
				require.Equal(t, common.TopUpStatusPending, order.Status)
				var reloadedIntent model.SubscriptionChangeIntent
				require.NoError(t, model.DB.First(&reloadedIntent, "id = ?", intent.Id).Error)
				require.Equal(t, model.SubscriptionChangeIntentStatusAwaitingPayment, reloadedIntent.Status)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestTerminatePendingStripePurchaseOnlyClearsMatchingLatestIntent(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	contract, oldIntent := seedStripeInvoicePurchase(t, 8103, 8203, "sub_expired_old")
	newIntent := model.SubscriptionChangeIntent{
		ContractId:    contract.Id,
		UserId:        8103,
		RequestId:     "550e8400-e29b-41d4-a716-446655440101",
		Kind:          model.SubscriptionChangeIntentKindPurchase,
		PaymentMode:   model.SubscriptionPaymentModeStripeRecurring,
		Status:        model.SubscriptionChangeIntentStatusAwaitingPayment,
		ToPlanId:      8203,
		ChangeVersion: contract.ChangeVersion + 2,
	}
	require.NoError(t, model.DB.Create(&newIntent).Error)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).Update("latest_change_intent_id", newIntent.Id).Error)

	require.NoError(t, TerminatePendingStripePurchase(context.Background(), "sub_expired_old", model.SubscriptionChangeIntentStatusExpired))

	var reloadedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&reloadedContract, "id = ?", contract.Id).Error)
	require.Equal(t, newIntent.Id, reloadedContract.LatestChangeIntentId)
	var expired model.SubscriptionChangeIntent
	require.NoError(t, model.DB.First(&expired, "id = ?", oldIntent.Id).Error)
	require.Equal(t, model.SubscriptionChangeIntentStatusExpired, expired.Status)
	var topup model.TopUp
	require.NoError(t, model.DB.First(&topup, "trade_no = ?", "sub_expired_old").Error)
	require.Equal(t, common.TopUpStatusExpired, topup.Status)
	require.Equal(t, model.PaymentMethodStripe, topup.PaymentMethod)
	require.Equal(t, model.PaymentProviderStripe, topup.PaymentProvider)
}

func TestStripeRecurringChangePlanCreatesAndReplaysCheckoutSession(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	insertContractServiceUser(t, 8104, 0)
	plan := insertContractServicePlan(t, 8204, 1, 12.34, 1234)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).Update("stripe_price_id", "price_invoice_plan").Error)
	restore := replaceStripeCheckoutCreator(t, "cs_replay", "https://checkout.example/session")
	defer restore()

	first, err := ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:      8104,
		PlanID:      8204,
		PaymentMode: model.SubscriptionPaymentModeStripeRecurring,
		RequestID:   "550e8400-e29b-41d4-a716-446655440102",
	})
	require.NoError(t, err)
	second, err := ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:      8104,
		PlanID:      8204,
		PaymentMode: model.SubscriptionPaymentModeStripeRecurring,
		RequestID:   "550e8400-e29b-41d4-a716-446655440102",
	})
	require.NoError(t, err)

	require.Equal(t, ChangePlanStatusCheckoutRequired, first.Status)
	require.Equal(t, "https://checkout.example/session", first.CheckoutURL)
	require.Equal(t, first.Intent.Id, second.Intent.Id)
	require.Equal(t, first.CheckoutURL, second.CheckoutURL)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 8104).Count(&orderCount).Error)
	require.Equal(t, int64(1), orderCount)
}

func TestStripeRecurringEmbeddedCheckoutAllowsEmptyURLAndReplaysClientSecretFromStripe(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	originalPublishableKey := setting.StripePublishableKey
	setting.StripePublishableKey = "pk_test_embedded"
	t.Cleanup(func() { setting.StripePublishableKey = originalPublishableKey })
	insertContractServiceUser(t, 8114, 0)
	plan := insertContractServicePlan(t, 8214, 1, 12.34, 1234)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).Update("stripe_price_id", "price_embedded_plan").Error)
	originalCreator := stripeSubscriptionCheckoutCreator
	t.Cleanup(func() { stripeSubscriptionCheckoutCreator = originalCreator })
	createdCount := 0
	stripeSubscriptionCheckoutCreator = func(_ context.Context, input StripeSubscriptionCheckoutInput) (*StripeSubscriptionCheckoutSession, error) {
		createdCount++
		require.Equal(t, "embedded", input.Presentation.RequestedUIMode)
		require.True(t, input.Presentation.Embedded)
		return &StripeSubscriptionCheckoutSession{ID: "cs_embedded_replay", ClientSecret: "cs_secret_created"}, nil
	}
	restoreStripeAccessors := ReplaceStripeCheckoutSessionAccessorsForTest(
		func(_ context.Context, sessionID string) (*stripe.CheckoutSession, error) {
			require.Equal(t, "cs_embedded_replay", sessionID)
			return &stripe.CheckoutSession{ID: sessionID, ClientSecret: "cs_secret_replayed", URL: ""}, nil
		},
		nil,
	)
	t.Cleanup(restoreStripeAccessors)

	first, err := ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:      8114,
		PlanID:      8214,
		PaymentMode: model.SubscriptionPaymentModeStripeRecurring,
		RequestID:   "550e8400-e29b-41d4-a716-446655440114",
		UIMode:      "embedded",
	})
	require.NoError(t, err)
	second, err := ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:      8114,
		PlanID:      8214,
		PaymentMode: model.SubscriptionPaymentModeStripeRecurring,
		RequestID:   "550e8400-e29b-41d4-a716-446655440114",
		UIMode:      "embedded",
	})
	require.NoError(t, err)

	require.Equal(t, ChangePlanStatusCheckoutRequired, first.Status)
	require.Equal(t, "cs_secret_created", first.ClientSecret)
	require.Empty(t, first.CheckoutURL)
	require.Equal(t, first.Intent.Id, second.Intent.Id)
	require.Equal(t, "cs_secret_replayed", second.ClientSecret)
	require.Empty(t, second.CheckoutURL)
	require.Equal(t, 1, createdCount)
	var order model.SubscriptionOrder
	require.NoError(t, model.DB.Where("change_intent_id = ?", first.Intent.Id).First(&order).Error)
	require.Equal(t, "cs_embedded_replay", order.ProviderSessionId)
	require.Empty(t, order.ProviderSessionURL)
}

func TestStripeRecurringReplayRejectsSessionWithoutURLOrClientSecret(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	originalPublishableKey := setting.StripePublishableKey
	setting.StripePublishableKey = "pk_test_embedded"
	t.Cleanup(func() { setting.StripePublishableKey = originalPublishableKey })
	insertContractServiceUser(t, 8116, 0)
	plan := insertContractServicePlan(t, 8216, 1, 12.34, 1234)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).Update("stripe_price_id", "price_embedded_missing_secret").Error)
	originalCreator := stripeSubscriptionCheckoutCreator
	t.Cleanup(func() { stripeSubscriptionCheckoutCreator = originalCreator })
	stripeSubscriptionCheckoutCreator = func(_ context.Context, input StripeSubscriptionCheckoutInput) (*StripeSubscriptionCheckoutSession, error) {
		return &StripeSubscriptionCheckoutSession{ID: "cs_embedded_missing_secret", ClientSecret: "cs_secret_initial"}, nil
	}
	restoreStripeAccessors := ReplaceStripeCheckoutSessionAccessorsForTest(
		func(_ context.Context, sessionID string) (*stripe.CheckoutSession, error) {
			require.Equal(t, "cs_embedded_missing_secret", sessionID)
			return &stripe.CheckoutSession{ID: sessionID}, nil
		},
		nil,
	)
	t.Cleanup(restoreStripeAccessors)

	first, err := ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:      8116,
		PlanID:      8216,
		PaymentMode: model.SubscriptionPaymentModeStripeRecurring,
		RequestID:   "550e8400-e29b-41d4-a716-446655440116",
		UIMode:      "embedded",
	})
	require.NoError(t, err)
	require.Equal(t, "cs_secret_initial", first.ClientSecret)

	second, err := ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:      8116,
		PlanID:      8216,
		PaymentMode: model.SubscriptionPaymentModeStripeRecurring,
		RequestID:   "550e8400-e29b-41d4-a716-446655440116",
		UIMode:      "embedded",
	})

	require.Error(t, err)
	require.Nil(t, second)
	require.Contains(t, err.Error(), "missing url or client secret")
}

func TestPersistStripeCheckoutSessionDoesNotEraseExistingURLWhenNewURLIsEmpty(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	insertContractServiceUser(t, 8115, 0)
	insertContractServicePlan(t, 8215, 1, 12.34, 1234)
	order := model.SubscriptionOrder{
		UserId:             8115,
		PlanId:             8215,
		TradeNo:            "sub_existing_url",
		PaymentMethod:      model.PaymentMethodStripe,
		PaymentProvider:    model.PaymentProviderStripe,
		Status:             common.TopUpStatusPending,
		CreateTime:         common.GetTimestamp(),
		ChangeIntentId:     1515,
		ProviderSessionId:  "cs_existing_url",
		ProviderSessionURL: "https://checkout.example/existing",
	}
	require.NoError(t, model.DB.Create(&order).Error)

	require.NoError(t, persistStripeCheckoutSession(1515, "cs_existing_url", ""))

	var reloaded model.SubscriptionOrder
	require.NoError(t, model.DB.Where("trade_no = ?", order.TradeNo).First(&reloaded).Error)
	require.Equal(t, "cs_existing_url", reloaded.ProviderSessionId)
	require.Equal(t, "https://checkout.example/existing", reloaded.ProviderSessionURL)
}

func TestStripeDowngradeRequestSupersedesPendingDowngradeStripeCheckout(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	insertContractServiceUser(t, 8108, 0)
	currentPlan := insertStripeUpgradePlan(t, 8208, 3, 30, 3000, "price_current_pending_downgrade_checkout")
	oldTarget := insertStripeUpgradePlan(t, 8209, 2, 20, 2000, "price_old_pending_downgrade_checkout")
	newTarget := insertStripeUpgradePlan(t, 8210, 1, 10, 1000, "price_new_pending_downgrade_checkout")
	contract, binding, _ := seedStripeUpgradeContract(t, 8108, currentPlan)
	oldIntent := model.SubscriptionChangeIntent{
		ContractId:        contract.Id,
		UserId:            8108,
		RequestId:         "old-pending-downgrade-checkout",
		Kind:              model.SubscriptionChangeIntentKindDowngrade,
		PaymentMode:       model.SubscriptionPaymentModePrepaid,
		Status:            model.SubscriptionChangeIntentStatusAwaitingPayment,
		FromPlanId:        currentPlan.Id,
		ToPlanId:          oldTarget.Id,
		ProviderBindingId: binding.Id,
		ChangeVersion:     contract.ChangeVersion + 1,
	}
	require.NoError(t, model.DB.Create(&oldIntent).Error)
	require.NoError(t, model.DB.Model(contract).Updates(map[string]interface{}{
		"latest_change_intent_id": oldIntent.Id,
		"pending_plan_id":         oldTarget.Id,
		"pending_effective_at":    int64(2000),
	}).Error)
	oldOrder := model.SubscriptionOrder{
		UserId:            8108,
		PlanId:            oldTarget.Id,
		Money:             20,
		TradeNo:           "sub_old_pending_downgrade_checkout",
		PaymentMethod:     SubscriptionPaymentChoicePix,
		PaymentProvider:   model.PaymentProviderStripe,
		Status:            common.TopUpStatusPending,
		CreateTime:        common.GetTimestamp(),
		ProviderSessionId: "cs_old_pending_downgrade_checkout",
		PurchaseIntent:    model.SubscriptionChangeIntentKindDowngrade,
		ChangeIntentId:    oldIntent.Id,
	}
	require.NoError(t, model.DB.Create(&oldOrder).Error)

	var expiredSessionIDs []string
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
	originalExecutor := stripeSubscriptionDowngradeExecutor
	t.Cleanup(func() { stripeSubscriptionDowngradeExecutor = originalExecutor })
	stripeSubscriptionDowngradeExecutor = func(_ context.Context, input StripeSubscriptionDowngradeInput) (*StripeSubscriptionDowngradeResult, error) {
		return &StripeSubscriptionDowngradeResult{
			Status:             model.SubscriptionChangeIntentStatusScheduled,
			ProviderScheduleID: "sched_replaced_pending_downgrade_checkout",
			Snapshot: model.ProviderSubscriptionSnapshot{
				ProviderSubscriptionId:     input.ProviderSubscriptionID,
				ProviderSubscriptionItemId: input.ProviderSubscriptionItemID,
				ProviderPriceId:            input.CurrentPriceID,
				ProviderScheduleId:         "sched_replaced_pending_downgrade_checkout",
				ProviderScheduleIdObserved: true,
				ProviderStatus:             "active",
				CurrentPeriodStart:         1000,
				CurrentPeriodEnd:           2000,
			},
		}, nil
	}

	result, err := ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:      8108,
		PlanID:      newTarget.Id,
		PaymentMode: model.SubscriptionPaymentModeStripeRecurring,
		RequestID:   "new-downgrade-replaces-checkout",
	})

	require.NoError(t, err)
	require.Equal(t, ChangePlanStatusScheduled, result.Status)
	require.Equal(t, []string{"cs_old_pending_downgrade_checkout"}, expiredSessionIDs)
	var reloadedOldOrder model.SubscriptionOrder
	require.NoError(t, model.DB.First(&reloadedOldOrder, "id = ?", oldOrder.Id).Error)
	require.Equal(t, common.TopUpStatusExpired, reloadedOldOrder.Status)
	var reloadedOldIntent model.SubscriptionChangeIntent
	require.NoError(t, model.DB.First(&reloadedOldIntent, "id = ?", oldIntent.Id).Error)
	require.Equal(t, model.SubscriptionChangeIntentStatusSuperseded, reloadedOldIntent.Status)
	require.Equal(t, result.Intent.Id, reloadedOldIntent.SupersededById)
	var pendingOrders int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ? AND status = ?", 8108, common.TopUpStatusPending).Count(&pendingOrders).Error)
	require.Zero(t, pendingOrders)
}

func TestConsoleSubscriptionReturnPathUsesConfiguredAppConsoleOriginForWallet(t *testing.T) {
	restore := replaceSubscriptionReturnPathSettings(t, "https://router.flatkey.ai", " https://console.example.test/ ")
	defer restore()

	require.Equal(t, "https://console.example.test/wallet", consoleSubscriptionReturnPath())
}

func TestConsoleSubscriptionReturnPathFallsBackToServerAddressForWalletWhenAppConsoleOriginInvalid(t *testing.T) {
	restore := replaceSubscriptionReturnPathSettings(t, "https://router.flatkey.ai/", "https://console.example.test/path")
	defer restore()

	require.Equal(t, "https://router.flatkey.ai/wallet", consoleSubscriptionReturnPath())
}

func TestStripeMinorUnitAmountForSubscriptionUsesDecimalRounding(t *testing.T) {
	actual, err := stripeMinorUnitAmountForSubscription(1.005, "USD")

	require.NoError(t, err)
	require.Equal(t, int64(101), actual)
}

func TestCompleteOneTimeStripeSubscriptionPurchaseAppliesPendingOrderOnce(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	userID := 8301
	planID := 8401
	rank := 1
	require.NoError(t, model.DB.Create(&model.User{
		Id:       userID,
		Username: "one_time_user",
		Email:    "one-time@example.com",
		Status:   common.UserStatusEnabled,
		Group:    "default",
	}).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:                  planID,
		Title:               "One Time Plan",
		PriceAmount:         12.34,
		Currency:            "BRL",
		DurationUnit:        model.SubscriptionDurationMonth,
		DurationValue:       1,
		Enabled:             true,
		TierRank:            &rank,
		AllowBalancePay:     common.GetPointer(true),
		TotalAmount:         1234,
		MediaCreditsMonthly: 55,
		Window5hAmount:      125,
		WindowWeekAmount:    900,
		UpgradeGroup:        "snapshot_group",
	}).Error)
	contract := model.UserSubscriptionContract{
		UserId:      userID,
		Status:      model.SubscriptionContractStatusEnded,
		PaymentMode: model.SubscriptionPaymentModeExternalOnePeriod,
	}
	require.NoError(t, model.DB.Create(&contract).Error)
	intent := model.SubscriptionChangeIntent{
		ContractId:    contract.Id,
		UserId:        userID,
		RequestId:     "550e8400-e29b-41d4-a716-446655440200",
		Kind:          model.SubscriptionChangeIntentKindPurchase,
		PaymentMode:   model.SubscriptionPaymentModePrepaid,
		Status:        model.SubscriptionChangeIntentStatusAwaitingPayment,
		ToPlanId:      planID,
		ChangeVersion: contract.ChangeVersion + 1,
	}
	require.NoError(t, model.DB.Create(&intent).Error)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).Update("latest_change_intent_id", intent.Id).Error)
	order := model.SubscriptionOrder{
		UserId:             userID,
		PlanId:             planID,
		Money:              12.34,
		TradeNo:            "sub_one_time_service",
		PaymentMethod:      SubscriptionPaymentChoicePix,
		PaymentProvider:    model.PaymentProviderStripe,
		Status:             common.TopUpStatusPending,
		CreateTime:         common.GetTimestamp(),
		PurchaseMonths:     1,
		UnitPrice:          12.34,
		PaymentCurrency:    "BRL",
		PaymentAmountMinor: 1234,
		PlanSnapshot:       `{"plan_id":8401,"title":"One Time Plan","price_amount":12.34,"currency":"BRL","duration_unit":"month","duration_value":1,"total_amount":1234,"window_5h_amount":125,"window_week_amount":900,"media_credits_monthly":55,"upgrade_group":"snapshot_group"}`,
		PurchaseIntent:     model.SubscriptionChangeIntentKindPurchase,
		RenewalSource:      model.SubscriptionRenewalSourceWallet,
		ChangeIntentId:     intent.Id,
	}
	require.NoError(t, model.DB.Create(&order).Error)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", planID).Updates(map[string]interface{}{
		"price_amount":          99.99,
		"total_amount":          999999,
		"media_credits_monthly": 999,
		"window_5h_amount":      999,
		"window_week_amount":    888,
		"upgrade_group":         "edited_group",
		"enabled":               false,
	}).Error)

	first, err := CompleteOneTimeStripeSubscriptionPurchase(context.Background(), order.TradeNo, `{"session_id":"cs_once"}`)
	require.NoError(t, err)
	second, err := CompleteOneTimeStripeSubscriptionPurchase(context.Background(), order.TradeNo, `{"session_id":"cs_once"}`)
	require.NoError(t, err)

	require.NotNil(t, first.Entitlement)
	require.Equal(t, int64(1234), first.Entitlement.AmountTotal)
	require.Equal(t, int64(55), first.Entitlement.MediaCreditsTotal)
	require.NotNil(t, first.Entitlement.Window5hAmount)
	require.NotNil(t, first.Entitlement.WindowWeekAmount)
	require.Equal(t, int64(125), *first.Entitlement.Window5hAmount)
	require.Equal(t, int64(900), *first.Entitlement.WindowWeekAmount)
	require.Equal(t, "snapshot_group", first.Entitlement.UpgradeGroup)
	var user model.User
	require.NoError(t, model.DB.First(&user, "id = ?", userID).Error)
	require.Equal(t, "snapshot_group", user.Group)
	require.Nil(t, second.Entitlement)
	var entitlementCount int64
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("user_id = ?", userID).Count(&entitlementCount).Error)
	require.Equal(t, int64(1), entitlementCount)
	var terms []model.SubscriptionTermSegment
	require.NoError(t, model.DB.Where("contract_id = ?", contract.Id).Find(&terms).Error)
	require.Len(t, terms, 1)
	var debitCount int64
	require.NoError(t, model.DB.Model(&model.WalletLedgerEntry{}).Where("user_id = ? AND entry_type = ?", userID, model.WalletLedgerEntryTypePrepaidDebit).Count(&debitCount).Error)
	require.Zero(t, debitCount)
	var reloaded model.SubscriptionOrder
	require.NoError(t, model.DB.First(&reloaded, "trade_no = ?", order.TradeNo).Error)
	require.Equal(t, common.TopUpStatusSuccess, reloaded.Status)
	require.Equal(t, "BRL", reloaded.PaymentCurrency)
	require.Equal(t, int64(1234), reloaded.PaymentAmountMinor)
	var topup model.TopUp
	require.NoError(t, model.DB.First(&topup, "trade_no = ?", order.TradeNo).Error)
	require.Equal(t, common.TopUpStatusSuccess, topup.Status)
	require.Equal(t, "BRL", topup.PaymentCurrency)
	require.Equal(t, int64(1234), topup.PaymentAmountMinor)
	require.Equal(t, SubscriptionPaymentChoicePix, topup.PaymentMethod)
	require.Equal(t, model.PaymentProviderStripe, topup.PaymentProvider)
}

func TestCompleteOneTimeStripeSubscriptionPurchaseUsesSnapshotWalletBasisForBRLTerms(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	userID := 8303
	planID := 8403
	rank := 1
	require.NoError(t, model.DB.Create(&model.User{Id: userID, Username: "one_time_brl_basis", Status: common.UserStatusEnabled, Group: "default"}).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:                  planID,
		Title:               "Canonical Plan",
		PriceAmount:         10,
		Currency:            "USD",
		DurationUnit:        model.SubscriptionDurationMonth,
		DurationValue:       1,
		Enabled:             true,
		TierRank:            &rank,
		AllowBalancePay:     common.GetPointer(true),
		TotalAmount:         1000,
		MediaCreditsMonthly: 25,
	}).Error)
	contract := model.UserSubscriptionContract{UserId: userID, Status: model.SubscriptionContractStatusEnded}
	require.NoError(t, model.DB.Create(&contract).Error)
	intent := model.SubscriptionChangeIntent{
		ContractId:    contract.Id,
		UserId:        userID,
		RequestId:     "550e8400-e29b-41d4-a716-446655440202",
		Kind:          model.SubscriptionChangeIntentKindPurchase,
		PaymentMode:   model.SubscriptionPaymentModePrepaid,
		Status:        model.SubscriptionChangeIntentStatusAwaitingPayment,
		ToPlanId:      planID,
		ChangeVersion: contract.ChangeVersion + 1,
	}
	require.NoError(t, model.DB.Create(&intent).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionOrder{
		UserId:             userID,
		PlanId:             planID,
		Money:              49.90,
		TradeNo:            "sub_one_time_brl_term_basis",
		PaymentMethod:      SubscriptionPaymentChoicePix,
		PaymentProvider:    model.PaymentProviderStripe,
		Status:             common.TopUpStatusPending,
		CreateTime:         common.GetTimestamp(),
		PurchaseMonths:     2,
		UnitPrice:          49.90,
		PaymentCurrency:    "BRL",
		PaymentAmountMinor: 9980,
		PlanSnapshot:       `{"plan_id":8403,"title":"Canonical Plan","price_amount":10,"currency":"USD","duration_unit":"month","duration_value":1,"total_amount":1000,"media_credits_monthly":25}`,
		PurchaseIntent:     model.SubscriptionChangeIntentKindPurchase,
		ChangeIntentId:     intent.Id,
	}).Error)

	_, err := CompleteOneTimeStripeSubscriptionPurchase(context.Background(), "sub_one_time_brl_term_basis", `{"session_id":"cs_brl_basis"}`)

	require.NoError(t, err)
	var terms []model.SubscriptionTermSegment
	require.NoError(t, model.DB.Where("contract_id = ?", contract.Id).Order("segment_index asc").Find(&terms).Error)
	require.Len(t, terms, 2)
	require.Equal(t, float64(10), terms[0].AllocatedMoney)
	require.Equal(t, float64(10), terms[1].AllocatedMoney)
}

func TestCompleteOneTimeStripeSubscriptionPurchaseRejectsCurrencyMethodMismatch(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	userID := 8302
	planID := 8402
	rank := 1
	require.NoError(t, model.DB.Create(&model.User{Id: userID, Username: "one_time_mismatch", Status: common.UserStatusEnabled, Group: "default"}).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:              planID,
		Title:           "Mismatch Plan",
		PriceAmount:     12.34,
		Currency:        "USD",
		DurationUnit:    model.SubscriptionDurationMonth,
		DurationValue:   1,
		Enabled:         true,
		TierRank:        &rank,
		AllowBalancePay: common.GetPointer(true),
		TotalAmount:     1234,
	}).Error)
	contract := model.UserSubscriptionContract{UserId: userID, Status: model.SubscriptionContractStatusEnded}
	require.NoError(t, model.DB.Create(&contract).Error)
	intent := model.SubscriptionChangeIntent{
		ContractId:  contract.Id,
		UserId:      userID,
		RequestId:   "550e8400-e29b-41d4-a716-446655440201",
		Kind:        model.SubscriptionChangeIntentKindPurchase,
		PaymentMode: model.SubscriptionPaymentModePrepaid,
		Status:      model.SubscriptionChangeIntentStatusAwaitingPayment,
		ToPlanId:    planID,
	}
	require.NoError(t, model.DB.Create(&intent).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionOrder{
		UserId:             userID,
		PlanId:             planID,
		Money:              12.34,
		TradeNo:            "sub_one_time_currency_mismatch",
		PaymentMethod:      SubscriptionPaymentChoicePix,
		PaymentProvider:    model.PaymentProviderStripe,
		Status:             common.TopUpStatusPending,
		CreateTime:         common.GetTimestamp(),
		PurchaseMonths:     1,
		UnitPrice:          12.34,
		PaymentCurrency:    "USD",
		PaymentAmountMinor: 1234,
		PlanSnapshot:       `{"plan_id":8402,"title":"Mismatch Plan","price_amount":12.34,"currency":"USD","duration_unit":"month","duration_value":1,"total_amount":1234}`,
		PurchaseIntent:     model.SubscriptionChangeIntentKindPurchase,
		ChangeIntentId:     intent.Id,
	}).Error)

	_, err := CompleteOneTimeStripeSubscriptionPurchase(context.Background(), "sub_one_time_currency_mismatch", "{}")

	require.Error(t, err)
	require.True(t, IsPermanentPaidInvoiceError(err))
	require.Contains(t, err.Error(), "Pix subscription purchase quote must be BRL")
	var entitlementCount int64
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("user_id = ?", userID).Count(&entitlementCount).Error)
	require.Zero(t, entitlementCount)
}

func TestValidateOneTimeStripeLocalOrderFactsRejectsNegativeWindowSnapshots(t *testing.T) {
	tests := []struct {
		name     string
		mutate   func(*purchasePlanSnapshot)
		contains string
	}{
		{
			name: "five hour window",
			mutate: func(snapshot *purchasePlanSnapshot) {
				snapshot.Window5hAmount = -1
			},
			contains: "snapshot values are invalid",
		},
		{
			name: "weekly window",
			mutate: func(snapshot *purchasePlanSnapshot) {
				snapshot.WindowWeekAmount = -1
			},
			contains: "snapshot values are invalid",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			order := model.SubscriptionOrder{
				UserId:             1,
				PlanId:             2,
				PaymentMethod:      SubscriptionPaymentChoicePix,
				PaymentProvider:    model.PaymentProviderStripe,
				PurchaseMonths:     1,
				PaymentCurrency:    "BRL",
				PaymentAmountMinor: 100,
			}
			intent := model.SubscriptionChangeIntent{UserId: 1, ToPlanId: 2}
			snapshot := purchasePlanSnapshot{PlanID: 2}
			test.mutate(&snapshot)

			err := validateOneTimeStripeLocalOrderFacts(&order, &intent, snapshot)

			require.ErrorContains(t, err, test.contains)
		})
	}
}

func replaceStripeInvoiceReconcilers(t *testing.T, invoice *stripe.Invoice, subscription *stripe.Subscription) func() {
	t.Helper()
	originalInvoiceGetter := stripeInvoiceGetter
	originalSubscriptionGetter := stripeSubscriptionGetter
	stripeInvoiceGetter = func(ctx context.Context, invoiceID string) (*stripe.Invoice, error) {
		return invoice, nil
	}
	stripeSubscriptionGetter = func(ctx context.Context, subscriptionID string) (*stripe.Subscription, error) {
		return subscription, nil
	}
	return func() {
		stripeInvoiceGetter = originalInvoiceGetter
		stripeSubscriptionGetter = originalSubscriptionGetter
	}
}

func replaceStripeCheckoutCreator(t *testing.T, sessionID string, checkoutURL string) func() {
	t.Helper()
	originalCreator := stripeSubscriptionCheckoutCreator
	stripeSubscriptionCheckoutCreator = func(ctx context.Context, input StripeSubscriptionCheckoutInput) (*StripeSubscriptionCheckoutSession, error) {
		return &StripeSubscriptionCheckoutSession{
			ID:  sessionID,
			URL: checkoutURL,
		}, nil
	}
	return func() {
		stripeSubscriptionCheckoutCreator = originalCreator
	}
}

func replaceStripeAPISecretForInvoiceTest(t *testing.T, secret string) func() {
	t.Helper()
	originalSecret := setting.StripeApiSecret
	setting.StripeApiSecret = secret
	return func() {
		setting.StripeApiSecret = originalSecret
	}
}

func replaceSubscriptionReturnPathSettings(t *testing.T, serverAddress string, appConsoleOrigin string) func() {
	t.Helper()
	originalServerAddress := system_setting.ServerAddress
	originalAppConsoleOrigin := system_setting.GetAppConsoleSettings().Origin
	system_setting.ServerAddress = serverAddress
	system_setting.GetAppConsoleSettings().Origin = appConsoleOrigin
	return func() {
		system_setting.ServerAddress = originalServerAddress
		system_setting.GetAppConsoleSettings().Origin = originalAppConsoleOrigin
	}
}
