package controller

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupWaffoPancakeControllerTest(t *testing.T) *gorm.DB {
	t.Helper()

	previousDB := model.DB
	previousLogDB := model.LOG_DB
	previousMainDatabaseType := common.MainDatabaseType()
	previousLogDatabaseType := common.LogDatabaseType()
	previousRedisEnabled := common.RedisEnabled
	previousMerchantID := setting.WaffoPancakeMerchantID
	previousPrivateKey := setting.WaffoPancakePrivateKey
	previousStoreID := setting.WaffoPancakeStoreID
	previousProductID := setting.WaffoPancakeProductID
	previousCurrency := setting.WaffoPancakeCurrency
	previousUnitPrice := setting.WaffoPancakeUnitPrice
	previousMinTopUp := setting.WaffoPancakeMinTopUp
	previousCommonPrice := operation_setting.Price
	previousResolveConfigured := resolveConfiguredWaffoPancakeProduct
	previousResolveProduct := resolveWaffoPancakeProduct
	previousCreateSession := createWaffoPancakeCheckoutSession
	previousVerifyWebhook := verifyWaffoPancakeWebhook
	previousGetUserGroup := getWaffoPancakeUserGroup
	previousRecharge := rechargeWaffoPancake
	previousCompleteSubscription := completeWaffoPancakeSubscriptionOrder

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.TopUp{},
		&model.Log{},
		&model.SubscriptionPlan{},
		&model.SubscriptionOrder{},
		&model.UserSubscription{},
	))
	model.DB = db
	model.LOG_DB = db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	setting.WaffoPancakeMerchantID = "merchant-test"
	setting.WaffoPancakePrivateKey = "private-test"
	setting.WaffoPancakeStoreID = "store-test"
	setting.WaffoPancakeProductID = "product-test"
	setting.WaffoPancakeCurrency = "USD"
	setting.WaffoPancakeUnitPrice = 1 / 0.15
	setting.WaffoPancakeMinTopUp = 10
	confirmPaymentComplianceForTest(t)

	t.Cleanup(func() {
		model.DB = previousDB
		model.LOG_DB = previousLogDB
		common.SetDatabaseTypes(previousMainDatabaseType, previousLogDatabaseType)
		common.RedisEnabled = previousRedisEnabled
		setting.WaffoPancakeMerchantID = previousMerchantID
		setting.WaffoPancakePrivateKey = previousPrivateKey
		setting.WaffoPancakeStoreID = previousStoreID
		setting.WaffoPancakeProductID = previousProductID
		setting.WaffoPancakeCurrency = previousCurrency
		setting.WaffoPancakeUnitPrice = previousUnitPrice
		setting.WaffoPancakeMinTopUp = previousMinTopUp
		operation_setting.Price = previousCommonPrice
		resolveConfiguredWaffoPancakeProduct = previousResolveConfigured
		resolveWaffoPancakeProduct = previousResolveProduct
		createWaffoPancakeCheckoutSession = previousCreateSession
		verifyWaffoPancakeWebhook = previousVerifyWebhook
		getWaffoPancakeUserGroup = previousGetUserGroup
		rechargeWaffoPancake = previousRecharge
		completeWaffoPancakeSubscriptionOrder = previousCompleteSubscription
	})
	return db
}

func insertWaffoPancakeControllerUser(t *testing.T, db *gorm.DB, id int) {
	t.Helper()
	require.NoError(t, db.Create(&model.User{
		Id:       id,
		Username: "waffo-controller-user",
		Password: "unused-password",
		Status:   common.UserStatusEnabled,
		Group:    "default",
		Email:    "waffo-controller@example.invalid",
	}).Error)
}

func invokeWaffoPancakePay(t *testing.T, userID int, body string, handler gin.HandlerFunc) *httptest.ResponseRecorder {
	t.Helper()
	recorder := httptest.NewRecorder()
	ginContext, _ := gin.CreateTestContext(recorder)
	ginContext.Set("id", userID)
	ginContext.Request = httptest.NewRequest(http.MethodPost, "/api/user/waffo-pancake/pay", strings.NewReader(body))
	ginContext.Request.Header.Set("Content-Type", "application/json")
	handler(ginContext)
	return recorder
}

func invokeWaffoPancakeWebhook(t *testing.T, env string, body string) *httptest.ResponseRecorder {
	t.Helper()
	recorder := httptest.NewRecorder()
	ginContext, _ := gin.CreateTestContext(recorder)
	ginContext.Params = gin.Params{{Key: "env", Value: env}}
	ginContext.Request = httptest.NewRequest(http.MethodPost, "/api/webhook/waffo-pancake/"+env, strings.NewReader(body))
	ginContext.Request.Header.Set("X-Waffo-Signature", "test-signature")
	WaffoPancakeWebhook(ginContext)
	return recorder
}

func TestWaffoPancakeWebhook_DispatchesWalletAndReplayIsIdempotent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupWaffoPancakeControllerTest(t)
	const userID = 703
	insertWaffoPancakeControllerUser(t, db, userID)
	tradeNo := "WAFFO_PANCAKE-703-1-wallet"
	require.NoError(t, db.Create(&model.TopUp{
		UserId: userID, Amount: 10, Money: 1.5, TradeNo: tradeNo,
		PaymentMethod:             model.PaymentMethodWaffoPancake,
		PaymentProvider:           model.PaymentProviderWaffoPancake,
		PaymentExpectationVersion: model.WaffoPancakePaymentExpectationVersion,
		ExpectedAmount:            1.5, ExpectedCurrency: "USD", ExpectedStoreID: "store-test",
		Status: common.TopUpStatusPending,
	}).Error)
	verifyWaffoPancakeWebhook = func(string, string) (*service.WaffoPancakeWebhookEvent, error) {
		return &service.WaffoPancakeWebhookEvent{
			Mode: "prod", EventType: "order.completed", StoreID: "store-test",
			Data: service.WaffoPancakeWebhookData{
				OrderID: "ORD_wallet", OrderMerchantExternalID: tradeNo,
				Amount: "1.50", Currency: "usd",
				MerchantProvidedBuyerIdentity: service.WaffoPancakeBuyerIdentityFromUserID(userID),
			},
		}, nil
	}

	first := invokeWaffoPancakeWebhook(t, "prod", `{}`)
	require.Equal(t, http.StatusOK, first.Code)
	stored := model.GetTopUpByTradeNo(tradeNo)
	require.NotNil(t, stored)
	require.Equal(t, common.TopUpStatusSuccess, stored.Status)
	firstQuota, err := model.GetUserQuota(userID, true)
	require.NoError(t, err)
	require.Positive(t, firstQuota)
	second := invokeWaffoPancakeWebhook(t, "prod", `{}`)
	require.Equal(t, http.StatusOK, second.Code)
	secondQuota, err := model.GetUserQuota(userID, true)
	require.NoError(t, err)
	require.Equal(t, firstQuota, secondQuota)
}

func TestWaffoPancakeWebhook_SubscriptionPrefixAndStoreMismatchFailClosed(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupWaffoPancakeControllerTest(t)
	const userID = 704
	insertWaffoPancakeControllerUser(t, db, userID)
	plan := &model.SubscriptionPlan{Title: "webhook plan", PriceAmount: 9.99, Currency: "USD", DurationUnit: model.SubscriptionDurationMonth, DurationValue: 1, Enabled: true, TotalAmount: 100, QuotaResetPeriod: model.SubscriptionResetNever, AllowWalletOverflow: func() *bool { v := false; return &v }()}
	require.NoError(t, db.Create(plan).Error)
	tradeNo := "WAFFO_PANCAKE_SUB-704-1-subscription"
	snapshot, err := model.NewSubscriptionEntitlementSnapshot(plan)
	require.NoError(t, err)
	snapshotJSON, err := snapshot.Marshal()
	require.NoError(t, err)
	require.NoError(t, db.Create(&model.SubscriptionOrder{
		UserId: userID, PlanId: plan.Id, Money: 9.99, TradeNo: tradeNo,
		PaymentMethod: model.PaymentMethodWaffoPancake, PaymentProvider: model.PaymentProviderWaffoPancake,
		PaymentExpectationVersion: model.WaffoPancakePaymentExpectationVersion, ExpectedAmount: 9.99,
		ExpectedCurrency: "USD", ExpectedStoreID: "store-test", EntitlementSnapshotVersion: model.SubscriptionEntitlementSnapshotVersion,
		EntitlementSnapshot: snapshotJSON, Status: common.TopUpStatusPending,
	}).Error)
	storeID := "wrong-store"
	verifyWaffoPancakeWebhook = func(string, string) (*service.WaffoPancakeWebhookEvent, error) {
		return &service.WaffoPancakeWebhookEvent{Mode: "prod", EventType: "order.completed", StoreID: storeID, Data: service.WaffoPancakeWebhookData{OrderID: "ORD_sub", OrderMerchantExternalID: tradeNo, Amount: "9.99", Currency: "USD", MerchantProvidedBuyerIdentity: service.WaffoPancakeBuyerIdentityFromUserID(userID)}}, nil
	}
	response := invokeWaffoPancakeWebhook(t, "prod", `{}`)
	require.Equal(t, http.StatusInternalServerError, response.Code)
	stored := model.GetSubscriptionOrderByTradeNo(tradeNo)
	require.NotNil(t, stored)
	require.Equal(t, common.TopUpStatusPending, stored.Status)
	var subscriptionCount int64
	require.NoError(t, db.Model(&model.UserSubscription{}).Count(&subscriptionCount).Error)
	require.Zero(t, subscriptionCount)
}

func TestWaffoPancakeWebhook_WalletSettlementErrorReturnsRetryableStatus(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupWaffoPancakeControllerTest(t)
	const userID = 705
	insertWaffoPancakeControllerUser(t, db, userID)
	tradeNo := "WAFFO_PANCAKE-705-1-settlement-error"
	require.NoError(t, db.Create(&model.TopUp{
		UserId: userID, Amount: 10, Money: 1.5, TradeNo: tradeNo,
		PaymentMethod:             model.PaymentMethodWaffoPancake,
		PaymentProvider:           model.PaymentProviderWaffoPancake,
		PaymentExpectationVersion: model.WaffoPancakePaymentExpectationVersion,
		ExpectedAmount:            1.5, ExpectedCurrency: "USD", ExpectedStoreID: "store-test",
		Status: common.TopUpStatusPending,
	}).Error)
	verifyWaffoPancakeWebhook = func(string, string) (*service.WaffoPancakeWebhookEvent, error) {
		return &service.WaffoPancakeWebhookEvent{
			Mode: "prod", EventType: "order.completed", StoreID: "store-test",
			Data: service.WaffoPancakeWebhookData{
				OrderID: "ORD_settlement_error", OrderMerchantExternalID: tradeNo,
				Amount: "1.50", Currency: "USD",
				MerchantProvidedBuyerIdentity: service.WaffoPancakeBuyerIdentityFromUserID(userID),
			},
		}, nil
	}
	rechargeWaffoPancake = func(string, model.WaffoPancakeSettlement) error {
		return errors.New("transient settlement failure")
	}

	response := invokeWaffoPancakeWebhook(t, "prod", `{}`)
	require.Equal(t, http.StatusInternalServerError, response.Code)
	require.Equal(t, "retry", response.Body.String())
	stored := model.GetTopUpByTradeNo(tradeNo)
	require.NotNil(t, stored)
	require.Equal(t, common.TopUpStatusPending, stored.Status)
	quota, err := model.GetUserQuota(userID, true)
	require.NoError(t, err)
	require.Zero(t, quota)
}

func TestWaffoPancakeWebhook_SubscriptionMatchingReplayIsIdempotent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupWaffoPancakeControllerTest(t)
	const userID = 706
	insertWaffoPancakeControllerUser(t, db, userID)
	plan := &model.SubscriptionPlan{Title: "matching webhook plan", PriceAmount: 9.99, Currency: "USD", DurationUnit: model.SubscriptionDurationMonth, DurationValue: 1, Enabled: true, TotalAmount: 100, QuotaResetPeriod: model.SubscriptionResetNever, AllowWalletOverflow: func() *bool { v := false; return &v }()}
	require.NoError(t, db.Create(plan).Error)
	tradeNo := "WAFFO_PANCAKE_SUB-706-1-replay"
	snapshot, err := model.NewSubscriptionEntitlementSnapshot(plan)
	require.NoError(t, err)
	snapshotJSON, err := snapshot.Marshal()
	require.NoError(t, err)
	require.NoError(t, db.Create(&model.SubscriptionOrder{
		UserId: userID, PlanId: plan.Id, Money: 9.99, TradeNo: tradeNo,
		PaymentMethod: model.PaymentMethodWaffoPancake, PaymentProvider: model.PaymentProviderWaffoPancake,
		PaymentExpectationVersion: model.WaffoPancakePaymentExpectationVersion, ExpectedAmount: 9.99,
		ExpectedCurrency: "USD", ExpectedStoreID: "store-test", EntitlementSnapshotVersion: model.SubscriptionEntitlementSnapshotVersion,
		EntitlementSnapshot: snapshotJSON, Status: common.TopUpStatusPending,
	}).Error)
	verifyWaffoPancakeWebhook = func(string, string) (*service.WaffoPancakeWebhookEvent, error) {
		return &service.WaffoPancakeWebhookEvent{
			Mode: "prod", EventType: "order.completed", StoreID: "store-test",
			Data: service.WaffoPancakeWebhookData{
				OrderID: "ORD_sub_replay", OrderMerchantExternalID: tradeNo,
				Amount: "9.99", Currency: "USD",
				MerchantProvidedBuyerIdentity: service.WaffoPancakeBuyerIdentityFromUserID(userID),
			},
		}, nil
	}

	first := invokeWaffoPancakeWebhook(t, "prod", `{}`)
	require.Equal(t, http.StatusOK, first.Code)
	second := invokeWaffoPancakeWebhook(t, "prod", `{}`)
	require.Equal(t, http.StatusOK, second.Code)
	var subscriptionCount int64
	require.NoError(t, db.Model(&model.UserSubscription{}).Count(&subscriptionCount).Error)
	require.Equal(t, int64(1), subscriptionCount)
}

func TestRequestWaffoPancakePay_CheckoutErrorPreservesPendingExpectations(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupWaffoPancakeControllerTest(t)
	const userID = 701
	insertWaffoPancakeControllerUser(t, db, userID)
	getWaffoPancakeUserGroup = func(int, bool) (string, error) { return "default", nil }

	resolveConfiguredWaffoPancakeProduct = func(context.Context) (waffoPancakeResolvedProduct, error) {
		return waffoPancakeResolvedProduct{Amount: "1.50", Currency: "usd", TaxCategory: "digital-services"}, nil
	}
	checkoutCalls := 0
	createWaffoPancakeCheckoutSession = func(context.Context, *service.WaffoPancakeCreateSessionParams) (*service.WaffoPancakeCheckoutSession, error) {
		checkoutCalls++
		return nil, errors.New("ambiguous checkout transport failure")
	}

	response := invokeWaffoPancakePay(t, userID, `{"amount":10}`, RequestWaffoPancakePay)

	require.Equal(t, http.StatusOK, response.Code)
	require.JSONEq(t, `{"message":"error","data":"拉起支付失败"}`, response.Body.String())
	require.Equal(t, 1, checkoutCalls)
	var topUps []model.TopUp
	require.NoError(t, db.Find(&topUps).Error)
	require.Len(t, topUps, 1)
	topUp := topUps[0]
	require.Equal(t, common.TopUpStatusPending, topUp.Status)
	require.Equal(t, model.PaymentMethodWaffoPancake, topUp.PaymentMethod)
	require.Equal(t, model.PaymentProviderWaffoPancake, topUp.PaymentProvider)
	require.Equal(t, model.WaffoPancakePaymentExpectationVersion, topUp.PaymentExpectationVersion)
	require.InDelta(t, 1.50, topUp.Money, 0.000001)
	require.InDelta(t, 1.50, topUp.ExpectedAmount, 0.000001)
	require.Equal(t, "USD", topUp.ExpectedCurrency)
	require.Equal(t, "store-test", topUp.ExpectedStoreID)
}

func TestRequestWaffoPancakePay_CNYUsesIndependentRateAndSnapshotsCurrency(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupWaffoPancakeControllerTest(t)
	const userID = 707
	insertWaffoPancakeControllerUser(t, db, userID)
	setting.WaffoPancakeCurrency = "CNY"
	setting.WaffoPancakeUnitPrice = 0.14
	operation_setting.Price = 1
	getWaffoPancakeUserGroup = func(int, bool) (string, error) { return "default", nil }
	resolveConfiguredWaffoPancakeProduct = func(context.Context) (waffoPancakeResolvedProduct, error) {
		return waffoPancakeResolvedProduct{Amount: "1.00", Currency: "cny", TaxCategory: "digital-services"}, nil
	}
	var checkoutParams *service.WaffoPancakeCreateSessionParams
	createWaffoPancakeCheckoutSession = func(_ context.Context, params *service.WaffoPancakeCreateSessionParams) (*service.WaffoPancakeCheckoutSession, error) {
		checkoutParams = params
		return nil, errors.New("stop after capturing checkout params")
	}

	response := invokeWaffoPancakePay(t, userID, `{"amount":10}`, RequestWaffoPancakePay)

	require.Equal(t, http.StatusOK, response.Code)
	require.JSONEq(t, `{"message":"error","data":"拉起支付失败"}`, response.Body.String())
	require.NotNil(t, checkoutParams)
	require.Equal(t, "CNY", checkoutParams.Currency)
	require.NotNil(t, checkoutParams.PriceSnapshot)
	require.Equal(t, "71.43", checkoutParams.PriceSnapshot.Amount)
	var topUps []model.TopUp
	require.NoError(t, db.Find(&topUps).Error)
	require.Len(t, topUps, 1)
	require.InDelta(t, 71.43, topUps[0].ExpectedAmount, 0.000001)
	require.Equal(t, "CNY", topUps[0].ExpectedCurrency)
}

func TestSubscriptionRequestWaffoPancakePay_CheckoutErrorPreservesPendingSnapshots(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupWaffoPancakeControllerTest(t)
	const userID = 702
	insertWaffoPancakeControllerUser(t, db, userID)
	plan := &model.SubscriptionPlan{
		Title:                 "Waffo test plan",
		PriceAmount:           9.99,
		Currency:              "USD",
		DurationUnit:          model.SubscriptionDurationMonth,
		DurationValue:         1,
		Enabled:               true,
		WaffoPancakeProductId: "subscription-product-test",
		TotalAmount:           12345,
		QuotaResetPeriod:      model.SubscriptionResetNever,
		AllowWalletOverflow:   func() *bool { value := false; return &value }(),
		MaxPurchasePerUser:    2,
	}
	require.NoError(t, db.Create(plan).Error)

	resolveWaffoPancakeProduct = func(context.Context, string, string, string, string, string) (waffoPancakeResolvedProduct, error) {
		return waffoPancakeResolvedProduct{Amount: "9.99", Currency: "USD", TaxCategory: "digital-services"}, nil
	}
	checkoutCalls := 0
	createWaffoPancakeCheckoutSession = func(context.Context, *service.WaffoPancakeCreateSessionParams) (*service.WaffoPancakeCheckoutSession, error) {
		checkoutCalls++
		return nil, errors.New("ambiguous checkout transport failure")
	}

	response := invokeWaffoPancakePay(t, userID, `{"plan_id":`+fmt.Sprint(plan.Id)+`}`, SubscriptionRequestWaffoPancakePay)

	require.Equal(t, http.StatusOK, response.Code)
	require.JSONEq(t, `{"message":"error","data":"拉起支付失败"}`, response.Body.String())
	require.Equal(t, 1, checkoutCalls)
	var orders []model.SubscriptionOrder
	require.NoError(t, db.Find(&orders).Error)
	require.Len(t, orders, 1)
	order := orders[0]
	require.Equal(t, common.TopUpStatusPending, order.Status)
	require.Equal(t, model.PaymentMethodWaffoPancake, order.PaymentMethod)
	require.Equal(t, model.PaymentProviderWaffoPancake, order.PaymentProvider)
	require.Equal(t, model.WaffoPancakePaymentExpectationVersion, order.PaymentExpectationVersion)
	require.InDelta(t, 9.99, order.ExpectedAmount, 0.000001)
	require.Equal(t, "USD", order.ExpectedCurrency)
	require.Equal(t, "store-test", order.ExpectedStoreID)
	require.Equal(t, model.SubscriptionEntitlementSnapshotVersion, order.EntitlementSnapshotVersion)
	require.NotEmpty(t, order.EntitlementSnapshot)
	require.Contains(t, order.EntitlementSnapshot, `"total_amount":12345`)
	var subscriptionCount int64
	require.NoError(t, db.Model(&model.UserSubscription{}).Count(&subscriptionCount).Error)
	require.Zero(t, subscriptionCount)
}

func TestListWaffoPancakeCatalog_IgnoresQueryCredentials(t *testing.T) {
	originalMerchantID := setting.WaffoPancakeMerchantID
	originalPrivateKey := setting.WaffoPancakePrivateKey
	setting.WaffoPancakeMerchantID = ""
	setting.WaffoPancakePrivateKey = ""
	t.Cleanup(func() {
		setting.WaffoPancakeMerchantID = originalMerchantID
		setting.WaffoPancakePrivateKey = originalPrivateKey
	})

	response := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(response)
	context.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/option/waffo-pancake/catalog?merchant_id=query-merchant&private_key=query-secret",
		nil,
	)

	ListWaffoPancakeCatalog(context)

	require.Equal(t, http.StatusOK, response.Code)
	require.JSONEq(t, `{"message":"error","data":"Waffo Pancake 凭证未配置"}`, response.Body.String())
}

func TestListWaffoPancakeCatalog_RejectsMalformedJSON(t *testing.T) {
	response := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(response)
	context.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/option/waffo-pancake/catalog",
		strings.NewReader(`{"merchant_id":`),
	)
	context.Request.Header.Set("Content-Type", "application/json")

	ListWaffoPancakeCatalog(context)

	require.Equal(t, http.StatusOK, response.Code)
	require.JSONEq(t, `{"message":"error","data":"参数错误"}`, response.Body.String())
}

func TestFormatWaffoPancakeAmount_UsesDisplayPriceString(t *testing.T) {
	testCases := []struct {
		name     string
		amount   string
		expected string
	}{
		{name: "whole amount", amount: "29", expected: "29.00"},
		{name: "decimal amount", amount: "29.9", expected: "29.90"},
		{name: "round half up to cents", amount: "29.999", expected: "30.00"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			amount, err := decimal.NewFromString(tc.amount)
			require.NoError(t, err)
			amount = normalizeWaffoPancakePayAmount(amount)
			require.Equal(t, tc.expected, formatWaffoPancakeAmount(amount))
		})
	}
}

func TestGetWaffoPancakePayMoney_RejectsInvalidRate(t *testing.T) {
	originalUnitPrice := setting.WaffoPancakeUnitPrice
	t.Cleanup(func() {
		setting.WaffoPancakeUnitPrice = originalUnitPrice
	})

	for _, rate := range []float64{0, -1, setting.WaffoPancakeMinUnitPrice / 2, math.NaN(), math.Inf(1), math.Inf(-1)} {
		setting.WaffoPancakeUnitPrice = rate
		_, ok := getWaffoPancakePayAmount(10, "default")
		require.False(t, ok)
	}

	setting.WaffoPancakeUnitPrice = setting.WaffoPancakeMinUnitPrice
	payMoney, ok := getWaffoPancakePayAmount(10, "default")
	require.True(t, ok)
	require.True(t, payMoney.Equal(decimal.NewFromInt(100000)))
}

func TestGetWaffoPancakePayMoney(t *testing.T) {
	originalUnitPrice := setting.WaffoPancakeUnitPrice
	originalCommonPrice := operation_setting.Price
	originalQuotaDisplayType := operation_setting.GetGeneralSetting().QuotaDisplayType
	originalDiscounts := make(map[int]float64, len(operation_setting.GetPaymentSetting().AmountDiscount))
	for k, v := range operation_setting.GetPaymentSetting().AmountDiscount {
		originalDiscounts[k] = v
	}
	originalTopupGroupRatio := common.TopupGroupRatio2JSONString()

	t.Cleanup(func() {
		setting.WaffoPancakeUnitPrice = originalUnitPrice
		operation_setting.Price = originalCommonPrice
		operation_setting.GetGeneralSetting().QuotaDisplayType = originalQuotaDisplayType
		operation_setting.GetPaymentSetting().AmountDiscount = originalDiscounts
		require.NoError(t, common.UpdateTopupGroupRatioByJSONString(originalTopupGroupRatio))
	})

	setting.WaffoPancakeUnitPrice = 0.4
	operation_setting.Price = 99
	operation_setting.GetPaymentSetting().AmountDiscount = map[int]float64{
		10:                           0.8,
		int(common.QuotaPerUnit * 3): 0.5,
		20:                           0,
	}
	require.NoError(t, common.UpdateTopupGroupRatioByJSONString(`{"default":1,"vip":1.2}`))

	testCases := []struct {
		name             string
		amount           int64
		group            string
		quotaDisplayType string
		expected         float64
	}{
		{
			name:             "currency display uses Pancake rate instead of common Epay price",
			amount:           10,
			group:            "vip",
			quotaDisplayType: operation_setting.QuotaDisplayTypeUSD,
			expected:         24,
		},
		{
			name:             "tokens display converts quota to display units before pricing",
			amount:           int64(common.QuotaPerUnit * 3),
			group:            "vip",
			quotaDisplayType: operation_setting.QuotaDisplayTypeTokens,
			expected:         4.5,
		},
		{
			name:             "non-positive discount falls back to no discount",
			amount:           20,
			group:            "default",
			quotaDisplayType: operation_setting.QuotaDisplayTypeUSD,
			expected:         50,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			operation_setting.GetGeneralSetting().QuotaDisplayType = tc.quotaDisplayType
			actual := getWaffoPancakePayMoney(tc.amount, tc.group)
			require.InDelta(t, tc.expected, actual, 0.000001)
		})
	}
}
