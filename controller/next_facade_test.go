package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type nextTestResponse[T any] struct {
	Success bool `json:"success"`
	Data    T    `json:"data"`
}

func performNextGet(t *testing.T, target string, handler gin.HandlerFunc) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, target, nil)
	handler(context)
	return recorder
}

func decodeNextResponse[T any](t *testing.T, recorder *httptest.ResponseRecorder) T {
	t.Helper()
	require.Equal(t, http.StatusOK, recorder.Code)
	var response nextTestResponse[T]
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success, recorder.Body.String())
	return response.Data
}

func TestNextEpayTopUpConfigExposesOnlyEpayMethodsAndRequiresCompliance(t *testing.T) {
	paymentSetting := operation_setting.GetPaymentSetting()
	originalPaymentSetting := *paymentSetting
	originalPayMethods := operation_setting.PayMethods
	originalPayAddress := operation_setting.PayAddress
	originalEpayID := operation_setting.EpayId
	originalEpayKey := operation_setting.EpayKey
	t.Cleanup(func() {
		*paymentSetting = originalPaymentSetting
		operation_setting.PayMethods = originalPayMethods
		operation_setting.PayAddress = originalPayAddress
		operation_setting.EpayId = originalEpayID
		operation_setting.EpayKey = originalEpayKey
	})

	paymentSetting.ComplianceConfirmed = true
	paymentSetting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	paymentSetting.AmountOptions = []int{10, -1, 50}
	operation_setting.PayAddress = "https://epay.example.test"
	operation_setting.EpayId = "epay-id"
	operation_setting.EpayKey = "epay-key"
	operation_setting.PayMethods = []map[string]string{
		{"name": "Alipay", "type": "alipay", "color": "#1677ff"},
		{"name": "WeChat Pay", "type": "wxpay", "min_topup": "5"},
		{"name": "", "type": "invalid"},
	}

	config := decodeNextResponse[nextEpayTopUpConfig](t, performNextGet(
		t, "/api/next/wallet/config", NextGetEpayTopUpConfig,
	))
	assert.True(t, config.Enabled)
	assert.True(t, config.RedemptionEnabled)
	require.Len(t, config.PayMethods, 2)
	assert.Equal(t, "alipay", config.PayMethods[0].Type)
	assert.Equal(t, int64(5), config.PayMethods[1].MinTopUp)
	assert.Equal(t, []int{10, 50}, config.AmountOptions)

	paymentSetting.ComplianceConfirmed = false
	disabled := decodeNextResponse[nextEpayTopUpConfig](t, performNextGet(
		t, "/api/next/wallet/config", NextGetEpayTopUpConfig,
	))
	assert.False(t, disabled.Enabled)
	assert.False(t, disabled.RedemptionEnabled)
	assert.Empty(t, disabled.PayMethods)

	recorder := performNextAdminJSON(
		t, http.MethodPost, "/api/next/wallet/topup", `{"amount":10,"payment_method":"alipay"}`, NextCreateEpayTopUp,
	)
	var response struct {
		Success bool   `json:"success"`
		Code    string `json:"code"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.False(t, response.Success)
	assert.Equal(t, "PAYMENT_UNAVAILABLE", response.Code)
}

func TestNextAdminOrdersExposeProvidersAndEpayCNYStats(t *testing.T) {
	db := setupManageUserTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.TopUp{}))
	now := time.Now().Unix()
	users := []model.User{
		{Username: "epay-user", Password: "password", AffCode: "epay-aff", Role: common.RoleCommonUser, Status: common.UserStatusEnabled},
		{Username: "legacy-user", Password: "password", AffCode: "legacy-aff", Role: common.RoleCommonUser, Status: common.UserStatusEnabled},
		{Username: "stripe-user", Password: "password", AffCode: "stripe-aff", Role: common.RoleCommonUser, Status: common.UserStatusEnabled},
	}
	require.NoError(t, db.Create(&users).Error)
	topUps := []model.TopUp{
		{UserId: users[0].Id, Amount: 10, Money: 70, TradeNo: "epay-current", PaymentProvider: model.PaymentProviderEpay, PaymentMethod: "alipay", CreateTime: now - 60, CompleteTime: now - 30, Status: common.TopUpStatusSuccess},
		{UserId: users[1].Id, Amount: 5, Money: 35, TradeNo: "epay-legacy", PaymentMethod: "wxpay", CreateTime: now - 120, Status: common.TopUpStatusSuccess},
		{UserId: users[2].Id, Amount: 3, Money: 3, TradeNo: "stripe-legacy", PaymentMethod: model.PaymentMethodStripe, CreateTime: now - 180, CompleteTime: now - 150, Status: common.TopUpStatusSuccess},
		{UserId: users[0].Id, Amount: 2, Money: 14, TradeNo: "epay-pending", PaymentProvider: model.PaymentProviderEpay, PaymentMethod: "alipay", CreateTime: now, Status: common.TopUpStatusPending},
		{UserId: users[0].Id, Amount: 99, Money: 12, TradeNo: "unknown-provider", PaymentProvider: "paypal", PaymentMethod: "paypal", CreateTime: now - 240, CompleteTime: now - 200, Status: common.TopUpStatusSuccess},
	}
	require.NoError(t, db.Create(&topUps).Error)

	type orderPage struct {
		Items               []NextOrderDTO `json:"items"`
		Total               int            `json:"total"`
		StatusCounts        map[string]int `json:"status_counts"`
		MethodCounts        map[string]int `json:"method_counts"`
		FilteredEpayRevenue float64        `json:"filtered_epay_revenue"`
	}
	page := decodeNextResponse[orderPage](t, performNextGet(
		t, "/api/next/admin/orders?method=epay&p=1&page_size=20", NextListAdminOrders,
	))
	require.Len(t, page.Items, 3)
	assert.Equal(t, 3, page.Total)
	assert.Equal(t, 2, page.StatusCounts["completed"])
	assert.Equal(t, 1, page.StatusCounts["pending"])
	assert.Equal(t, 3, page.MethodCounts[model.PaymentProviderEpay])
	assert.InDelta(t, 105, page.FilteredEpayRevenue, 0.001)
	for _, item := range page.Items {
		assert.Equal(t, "topup", item.Type)
		assert.Equal(t, model.PaymentProviderEpay, item.Method)
		assert.Equal(t, "CNY", item.Currency)
		assert.NotEqual(t, "stripe-legacy", item.OrderNo)
	}
	otherPage := decodeNextResponse[orderPage](t, performNextGet(
		t, "/api/next/admin/orders?method=other&p=1&page_size=20", NextListAdminOrders,
	))
	require.Len(t, otherPage.Items, 1)
	assert.Equal(t, "unknown-provider", otherPage.Items[0].OrderNo)
	assert.Equal(t, "other", otherPage.Items[0].Method)
	assert.Equal(t, "USD", otherPage.Items[0].Currency)
	assert.Zero(t, otherPage.Items[0].Quota)

	type orderStats struct {
		Currency     string  `json:"currency"`
		TotalRevenue float64 `json:"total_revenue"`
		TotalOrders  int     `json:"total_orders"`
		TodayRevenue float64 `json:"today_revenue"`
		PaymentShare []struct {
			Method string  `json:"method"`
			Amount float64 `json:"amount"`
			Count  int     `json:"count"`
		} `json:"payment_share"`
	}
	stats := decodeNextResponse[orderStats](t, performNextGet(
		t, "/api/next/admin/orders/stats?range=7", NextGetAdminOrderStats,
	))
	assert.Equal(t, "CNY", stats.Currency)
	assert.Equal(t, 2, stats.TotalOrders)
	assert.InDelta(t, 105, stats.TotalRevenue, 0.001)
	assert.InDelta(t, 105, stats.TodayRevenue, 0.001)
	require.Len(t, stats.PaymentShare, 2)
}

func TestNextAdminUsersApplyFiltersAndReturnFacetCounts(t *testing.T) {
	db := setupManageUserTestDB(t)
	users := []model.User{
		{Username: "enabled-user", Password: "password", AffCode: "enabled-aff", Role: common.RoleCommonUser, Status: common.UserStatusEnabled},
		{Username: "disabled-admin", Password: "password", AffCode: "disabled-aff", Role: common.RoleAdminUser, Status: common.UserStatusDisabled},
		{Username: "enabled-root", Password: "password", AffCode: "root-aff", Role: common.RoleRootUser, Status: common.UserStatusEnabled},
	}
	require.NoError(t, db.Create(&users).Error)

	type userPage struct {
		Items        []nextAdminUserDTO `json:"items"`
		Total        int                `json:"total"`
		RoleCounts   map[string]int     `json:"role_counts"`
		StatusCounts map[string]int     `json:"status_counts"`
	}
	page := decodeNextResponse[userPage](t, performNextGet(
		t, "/api/next/admin/users?role=1&status=enabled&p=1&page_size=20", NextListAdminUsers,
	))
	require.Len(t, page.Items, 1)
	assert.Equal(t, "enabled-user", page.Items[0].Username)
	assert.Equal(t, 1, page.Total)
	assert.Equal(t, 1, page.RoleCounts["1"])
	assert.Equal(t, 1, page.RoleCounts["10"])
	assert.Equal(t, 1, page.RoleCounts["100"])
	assert.Equal(t, 2, page.StatusCounts["enabled"])
	assert.Equal(t, 1, page.StatusCounts["disabled"])
}

func TestNextAdminChannelsApplyRealFiltersAndCounts(t *testing.T) {
	db := setupManageUserTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Channel{}))
	channels := []model.Channel{
		{Name: "alpha-openai", Type: 1, Key: "key-alpha", Models: "gpt-4o", Status: common.ChannelStatusEnabled},
		{Name: "alpha-disabled", Type: 3, Key: "key-disabled", Models: "claude", Status: common.ChannelStatusManuallyDisabled},
		{Name: "beta-openai", Type: 1, Key: "key-beta", Models: "gpt-4o-mini", Status: common.ChannelStatusEnabled},
	}
	require.NoError(t, db.Create(&channels).Error)

	type channelPage struct {
		Items      []nextAdminChannelDTO `json:"items"`
		Total      int                   `json:"total"`
		TypeCounts map[string]int        `json:"type_counts"`
	}
	page := decodeNextResponse[channelPage](t, performNextGet(
		t, "/api/next/admin/channels?keyword=alpha&status=enabled&type=1&p=1&page_size=20", NextListAdminChannels,
	))
	require.Len(t, page.Items, 1)
	assert.Equal(t, "alpha-openai", page.Items[0].Name)
	assert.Equal(t, 1, page.Total)
	assert.Equal(t, 1, page.TypeCounts["1"])
	assert.NotContains(t, page.TypeCounts, "3")
}

func TestNextAdminRedemptionsReturnRealStatusesAndRedeemer(t *testing.T) {
	db := setupManageUserTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Redemption{}))
	redeemer := model.User{
		Username: "redeemer", Password: "password", Email: "redeemer@example.com",
		AffCode: "redeemer-aff", Role: common.RoleCommonUser, Status: common.UserStatusEnabled,
	}
	require.NoError(t, db.Create(&redeemer).Error)
	now := common.GetTimestamp()
	redemptions := []model.Redemption{
		{Name: "$1.00", Key: "unused-code", Quota: 500000, Status: common.RedemptionCodeStatusEnabled, CreatedTime: now},
		{Name: "$2.00", Key: "used-code", Quota: 1000000, Status: common.RedemptionCodeStatusUsed, UsedUserId: redeemer.Id, RedeemedTime: now, CreatedTime: now},
		{Name: "$3.00", Key: "disabled-code", Quota: 1500000, Status: common.RedemptionCodeStatusDisabled, CreatedTime: now},
		{Name: "$4.00", Key: "expired-code", Quota: 2000000, Status: common.RedemptionCodeStatusEnabled, ExpiredTime: now - 1, CreatedTime: now - 10},
	}
	require.NoError(t, db.Create(&redemptions).Error)

	type redemptionPage struct {
		Items        []nextAdminRedemptionDTO `json:"items"`
		Total        int                      `json:"total"`
		TypeCounts   map[string]int           `json:"type_counts"`
		StatusCounts map[string]int           `json:"status_counts"`
	}
	page := decodeNextResponse[redemptionPage](t, performNextGet(
		t, "/api/next/admin/redemptions?status=used&p=1&page_size=20", NextListAdminRedemptions,
	))
	require.Len(t, page.Items, 1)
	assert.Equal(t, "quota", page.Items[0].Type)
	assert.Equal(t, "used", page.Items[0].Status)
	assert.Equal(t, "redeemer@example.com", page.Items[0].RedeemerEmail)
	assert.Equal(t, 4, page.TypeCounts["quota"])
	assert.Equal(t, 1, page.StatusCounts["unused"])
	assert.Equal(t, 1, page.StatusCounts["used"])
	assert.Equal(t, 1, page.StatusCounts["disabled"])
	assert.Equal(t, 1, page.StatusCounts["expired"])
}
