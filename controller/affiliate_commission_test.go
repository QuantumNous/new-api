package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupAffiliateCommissionControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalRedisEnabled := common.RedisEnabled
	t.Cleanup(func() {
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		common.RedisEnabled = originalRedisEnabled
	})

	gin.SetMode(gin.TestMode)
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db
	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.Log{},
		&model.AffiliatePayoutProfile{},
		&model.AffiliateCdkOrder{},
		&model.AffiliateCommission{},
		&model.AffiliateCommissionSettlement{},
		&model.Redemption{},
	))

	return db
}

func affiliateControllerTestContext(method string, path string, body []byte) (*gin.Context, *httptest.ResponseRecorder) {
	req := httptest.NewRequest(method, path, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	return c, w
}

func TestSelfAffiliateAPIsRequireDistributionPermission(t *testing.T) {
	setupAffiliateCommissionControllerTestDB(t)
	require.NoError(t, model.DB.Create(&model.User{
		Id:                  1001,
		Username:            "disabled_agent",
		DisplayName:         "disabled_agent",
		Status:              common.UserStatusEnabled,
		Role:                common.RoleCommonUser,
		AffCode:             "disabled_agent_code",
		DistributionEnabled: false,
	}).Error)

	body, err := common.Marshal(map[string]any{
		"method":       "paypal",
		"account":      "disabled@example.com",
		"account_name": "Disabled Agent",
		"ids":          []int{2001},
	})
	require.NoError(t, err)

	tests := []struct {
		name   string
		method string
		path   string
		body   []byte
		call   func(*gin.Context)
	}{
		{
			name:   "summary",
			method: http.MethodGet,
			path:   "/api/affiliate/self/summary",
			call:   GetSelfAffiliateSummary,
		},
		{
			name:   "commissions",
			method: http.MethodGet,
			path:   "/api/affiliate/self/commissions",
			call:   GetSelfAffiliateCommissions,
		},
		{
			name:   "redemptions",
			method: http.MethodGet,
			path:   "/api/affiliate/self/redemptions",
			call:   GetSelfAffiliateRewardPointSettlements,
		},
		{
			name:   "redeem rewards",
			method: http.MethodPost,
			path:   "/api/affiliate/self/rewards/redeem",
			body:   body,
			call:   RedeemSelfAffiliateRewardPoints,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, w := affiliateControllerTestContext(tt.method, tt.path, tt.body)
			c.Set("id", 1001)
			tt.call(c)
			require.Equal(t, http.StatusOK, w.Code)
			require.Contains(t, w.Body.String(), `"success":false`)
			require.Contains(t, w.Body.String(), "未开通代理分销权限")
		})
	}
}

func TestSelfAffiliateCdkAPIsRequireCdkPermission(t *testing.T) {
	setupAffiliateCommissionControllerTestDB(t)
	require.NoError(t, model.DB.Create(&model.User{
		Id:                  1001,
		Username:            "cdk_disabled_agent",
		DisplayName:         "cdk_disabled_agent",
		Status:              common.UserStatusEnabled,
		Role:                common.RoleCommonUser,
		AffCode:             "cdk_disabled_agent_code",
		DistributionEnabled: true,
		AffiliateCdkEnabled: false,
	}).Error)

	body, err := common.Marshal(map[string]any{"amount": 100, "quantity": 1})
	require.NoError(t, err)

	tests := []struct {
		name   string
		method string
		path   string
		body   []byte
		call   func(*gin.Context)
	}{
		{
			name:   "cdk info",
			method: http.MethodGet,
			path:   "/api/affiliate/self/cdk/info",
			call:   GetSelfAffiliateCdkInfo,
		},
		{
			name:   "cdk quote",
			method: http.MethodPost,
			path:   "/api/affiliate/self/cdk/quote",
			body:   body,
			call:   QuoteSelfAffiliateCdk,
		},
		{
			name:   "cdk orders",
			method: http.MethodGet,
			path:   "/api/affiliate/self/cdk/orders",
			call:   GetSelfAffiliateCdkOrders,
		},
		{
			name:   "cdk codes",
			method: http.MethodGet,
			path:   "/api/affiliate/self/cdk/codes",
			call:   GetSelfAffiliateCdkCodes,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, w := affiliateControllerTestContext(tt.method, tt.path, tt.body)
			c.Set("id", 1001)
			tt.call(c)
			require.Equal(t, http.StatusOK, w.Code)
			require.Contains(t, w.Body.String(), `"success":false`)
			require.Contains(t, w.Body.String(), "未开通 CDK 采购权限")
		})
	}
}

func TestAdminExportAffiliateCommissionsUsesRewardPointFields(t *testing.T) {
	setupAffiliateCommissionControllerTestDB(t)
	require.NoError(t, model.DB.Create(&model.User{
		Id:                  1001,
		Username:            "agent",
		DisplayName:         "agent",
		Status:              common.UserStatusEnabled,
		Role:                common.RoleCommonUser,
		AffCode:             "agent_code",
		DistributionEnabled: true,
		AffiliateCdkEnabled: true,
	}).Error)
	require.NoError(t, model.DB.Create(&model.User{
		Id:                  1002,
		Username:            "buyer",
		DisplayName:         "buyer",
		Status:              common.UserStatusEnabled,
		Role:                common.RoleCommonUser,
		AffCode:             "buyer_code",
		InviterId:           1001,
		DistributionEnabled: true,
	}).Error)
	require.NoError(t, model.DB.Create(&model.AffiliateCommission{
		TradeNo:                "export-paypal",
		BuyerId:                1002,
		PromoterId:             1001,
		Level:                  model.AffiliateCommissionLevel1,
		BaseAmountMicros:       1000000,
		CommissionRateBps:      1000,
		CommissionAmountMicros: 100000,
		BaseQuota:              500000,
		RewardPoints:           50000,
		Currency:               "CNY",
		Status:                 model.AffiliateCommissionStatusPending,
	}).Error)

	c, w := affiliateControllerTestContext(http.MethodGet, "/api/affiliate/admin/commissions/export", nil)
	AdminExportAffiliateCommissions(c)
	require.Equal(t, http.StatusOK, w.Code)
	body := w.Body.String()
	require.True(t, strings.Contains(body, "奖励积分"))
	require.True(t, strings.Contains(body, "50000"))
	require.False(t, strings.Contains(body, "agent@example.com"))
}

func TestSelfAffiliateCdkAPIsRequireComplianceAndDiscount(t *testing.T) {
	setupAffiliateCommissionControllerTestDB(t)
	oldDistribution := *operation_setting.GetDistributionSetting()
	oldPayment := *operation_setting.GetPaymentSetting()
	oldPrice := operation_setting.Price
	t.Cleanup(func() {
		*operation_setting.GetDistributionSetting() = oldDistribution
		*operation_setting.GetPaymentSetting() = oldPayment
		operation_setting.Price = oldPrice
	})
	require.NoError(t, model.DB.Create(&model.User{
		Id:                  1001,
		Username:            "agent",
		DisplayName:         "agent",
		Status:              common.UserStatusEnabled,
		Role:                common.RoleCommonUser,
		AffCode:             "agent_code",
		DistributionEnabled: true,
		AffiliateCdkEnabled: true,
	}).Error)

	payment := operation_setting.GetPaymentSetting()
	payment.ComplianceConfirmed = false
	payment.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	c, w := affiliateControllerTestContext(http.MethodGet, "/api/affiliate/self/cdk/info", nil)
	c.Set("id", 1001)
	GetSelfAffiliateCdkInfo(c)
	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"success":false`)

	payment.ComplianceConfirmed = true
	payment.AmountOptions = []int{100}
	payment.AmountDiscount = map[int]float64{}
	operation_setting.Price = 1
	distribution := operation_setting.GetDistributionSetting()
	distribution.CdkPurchaseDiscountBps = 0
	body, err := common.Marshal(map[string]any{"amount": 100, "quantity": 1})
	require.NoError(t, err)
	c, w = affiliateControllerTestContext(http.MethodPost, "/api/affiliate/self/cdk/quote", body)
	c.Set("id", 1001)
	QuoteSelfAffiliateCdk(c)
	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"success":false`)
	require.Contains(t, w.Body.String(), "管理员未配置代理 CDK 采购折扣")
}

func TestSelfAffiliateCdkCodesAPIListsOwnGeneratedCodes(t *testing.T) {
	setupAffiliateCommissionControllerTestDB(t)
	oldDistribution := *operation_setting.GetDistributionSetting()
	oldPayment := *operation_setting.GetPaymentSetting()
	oldPrice := operation_setting.Price
	t.Cleanup(func() {
		*operation_setting.GetDistributionSetting() = oldDistribution
		*operation_setting.GetPaymentSetting() = oldPayment
		operation_setting.Price = oldPrice
	})
	require.NoError(t, model.DB.Create(&model.User{
		Id:                  1001,
		Username:            "agent",
		DisplayName:         "agent",
		Status:              common.UserStatusEnabled,
		Role:                common.RoleCommonUser,
		AffCode:             "agent_code",
		DistributionEnabled: true,
		AffiliateCdkEnabled: true,
	}).Error)
	require.NoError(t, model.DB.Create(&model.User{
		Id:                  1002,
		Username:            "other_agent",
		DisplayName:         "other_agent",
		Status:              common.UserStatusEnabled,
		Role:                common.RoleCommonUser,
		AffCode:             "other_agent_code",
		DistributionEnabled: true,
		AffiliateCdkEnabled: true,
	}).Error)

	payment := operation_setting.GetPaymentSetting()
	payment.ComplianceConfirmed = false
	payment.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	c, w := affiliateControllerTestContext(http.MethodGet, "/api/affiliate/self/cdk/codes", nil)
	c.Set("id", 1001)
	GetSelfAffiliateCdkCodes(c)
	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"success":false`)

	payment.ComplianceConfirmed = true
	payment.AmountOptions = []int{50, 100}
	payment.AmountDiscount = map[int]float64{}
	operation_setting.Price = 1
	distribution := operation_setting.GetDistributionSetting()
	distribution.CdkPurchaseDiscountBps = 8000

	codeQuota := int(100 * common.QuotaPerUnit)
	pendingOrder := &model.AffiliateCdkOrder{
		UserId:                 1001,
		TradeNo:                "controller-cdk-pending",
		CodeAmount:             50,
		Quantity:               1,
		TotalAmount:            50,
		CodeQuota:              int(50 * common.QuotaPerUnit),
		TotalQuota:             int(50 * common.QuotaPerUnit),
		WalletPayAmount:        50,
		PayAmount:              40,
		CdkPurchaseDiscountBps: 8000,
		PaymentMethod:          "alipay",
		PaymentProvider:        model.PaymentProviderEpay,
		Status:                 common.TopUpStatusPending,
		CreateTime:             common.GetTimestamp(),
	}
	require.NoError(t, pendingOrder.Insert())
	successOrder := &model.AffiliateCdkOrder{
		UserId:                 1001,
		TradeNo:                "controller-cdk-success",
		CodeAmount:             100,
		Quantity:               2,
		TotalAmount:            200,
		CodeQuota:              codeQuota,
		TotalQuota:             codeQuota * 2,
		WalletPayAmount:        200,
		PayAmount:              160,
		CdkPurchaseDiscountBps: 8000,
		PaymentMethod:          "alipay",
		PaymentProvider:        model.PaymentProviderEpay,
		Status:                 common.TopUpStatusPending,
		CreateTime:             common.GetTimestamp(),
	}
	require.NoError(t, successOrder.Insert())
	require.NoError(t, model.CompleteAffiliateCdkOrder("controller-cdk-success", `{"ok":true}`, model.PaymentProviderEpay, "wechat"))
	var generatedCodes []model.Redemption
	require.NoError(t, model.DB.Where("source_type = ? AND source_order_id = ?", model.AffiliateCdkSourceType, successOrder.Id).Order("id asc").Find(&generatedCodes).Error)
	require.Len(t, generatedCodes, 2)
	_, redeemErr := model.Redeem(generatedCodes[0].Key, 1002)
	require.NoError(t, redeemErr)
	otherOrder := &model.AffiliateCdkOrder{
		UserId:                 1002,
		TradeNo:                "controller-cdk-other",
		CodeAmount:             100,
		Quantity:               1,
		TotalAmount:            100,
		CodeQuota:              codeQuota,
		TotalQuota:             codeQuota,
		WalletPayAmount:        100,
		PayAmount:              80,
		CdkPurchaseDiscountBps: 8000,
		PaymentMethod:          "alipay",
		PaymentProvider:        model.PaymentProviderEpay,
		Status:                 common.TopUpStatusPending,
		CreateTime:             common.GetTimestamp(),
	}
	require.NoError(t, otherOrder.Insert())
	require.NoError(t, model.CompleteAffiliateCdkOrder("controller-cdk-other", `{"ok":true}`, model.PaymentProviderEpay, "alipay"))

	c, w = affiliateControllerTestContext(http.MethodGet, "/api/affiliate/self/cdk/codes?p=1&page_size=1", nil)
	c.Set("id", 1001)
	GetSelfAffiliateCdkCodes(c)
	require.Equal(t, http.StatusOK, w.Code)
	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			Page     int                            `json:"page"`
			PageSize int                            `json:"page_size"`
			Total    int                            `json:"total"`
			Items    []model.AffiliateCdkCodeRecord `json:"items"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(w.Body.Bytes(), &resp))
	require.True(t, resp.Success)
	require.Equal(t, 1, resp.Data.Page)
	require.Equal(t, 1, resp.Data.PageSize)
	require.Equal(t, 2, resp.Data.Total)
	require.Len(t, resp.Data.Items, 1)
	require.Equal(t, 1001, resp.Data.Items[0].UserId)
	require.Equal(t, successOrder.Id, resp.Data.Items[0].SourceOrderId)
	require.EqualValues(t, 100, resp.Data.Items[0].CodeAmount)
	require.Equal(t, 160.0, resp.Data.Items[0].PayAmount)
	require.Equal(t, "wechat", resp.Data.Items[0].PaymentMethod)
	require.Greater(t, resp.Data.Items[0].OrderCompleteTime, int64(0))

	c, w = affiliateControllerTestContext(http.MethodGet, "/api/affiliate/self/cdk/codes?p=1&page_size=20&status=1", nil)
	c.Set("id", 1001)
	GetSelfAffiliateCdkCodes(c)
	require.Equal(t, http.StatusOK, w.Code)
	require.NoError(t, common.Unmarshal(w.Body.Bytes(), &resp))
	require.True(t, resp.Success)
	require.Equal(t, 1, resp.Data.Total)
	require.Len(t, resp.Data.Items, 1)
	require.Equal(t, common.RedemptionCodeStatusEnabled, resp.Data.Items[0].Status)

	c, w = affiliateControllerTestContext(http.MethodGet, "/api/affiliate/self/cdk/codes?p=1&page_size=20&status=3", nil)
	c.Set("id", 1001)
	GetSelfAffiliateCdkCodes(c)
	require.Equal(t, http.StatusOK, w.Code)
	require.NoError(t, common.Unmarshal(w.Body.Bytes(), &resp))
	require.True(t, resp.Success)
	require.Equal(t, 1, resp.Data.Total)
	require.Len(t, resp.Data.Items, 1)
	require.Equal(t, common.RedemptionCodeStatusUsed, resp.Data.Items[0].Status)
	require.Equal(t, 1002, resp.Data.Items[0].UsedUserId)
	require.Equal(t, "other_agent", resp.Data.Items[0].UsedUsername)
	require.Greater(t, resp.Data.Items[0].RedeemedTime, int64(0))

	c, w = affiliateControllerTestContext(http.MethodGet, "/api/affiliate/self/cdk/codes?status=expired", nil)
	c.Set("id", 1001)
	GetSelfAffiliateCdkCodes(c)
	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"success":false`)
	require.Contains(t, w.Body.String(), "无效的兑换码状态")
}

func TestSelfRedeemAffiliateRewardPointsAPI(t *testing.T) {
	setupAffiliateCommissionControllerTestDB(t)
	oldPrice := operation_setting.Price
	oldDistribution := *operation_setting.GetDistributionSetting()
	t.Cleanup(func() {
		operation_setting.Price = oldPrice
		*operation_setting.GetDistributionSetting() = oldDistribution
	})
	operation_setting.Price = 0.2
	distribution := operation_setting.GetDistributionSetting()
	distribution.PointsPerAmountUnit = operation_setting.DefaultDistributionPointsPerAmountUnit
	distribution.OfflineAmountPerPointMicros = operation_setting.DefaultDistributionOfflineAmountPerPointMicros
	require.NoError(t, model.DB.Create(&model.User{
		Id:                  1001,
		Username:            "agent",
		DisplayName:         "agent",
		Status:              common.UserStatusEnabled,
		Role:                common.RoleCommonUser,
		AffCode:             "agent_code",
		DistributionEnabled: true,
	}).Error)
	require.NoError(t, model.DB.Create(&model.AffiliateCommission{
		Id:                     2001,
		TradeNo:                "redeem-points",
		BuyerId:                1002,
		PromoterId:             1001,
		Level:                  model.AffiliateCommissionLevel1,
		BaseAmountMicros:       1000000,
		CommissionRateBps:      1000,
		CommissionAmountMicros: 100000,
		BaseQuota:              500000,
		RewardPoints:           40,
		Status:                 model.AffiliateCommissionStatusPending,
	}).Error)

	body, err := common.Marshal(map[string]any{"ids": []int{2001}})
	require.NoError(t, err)

	c, w := affiliateControllerTestContext(http.MethodPost, "/api/affiliate/self/rewards/redeem", body)
	c.Set("id", 1001)
	RedeemSelfAffiliateRewardPoints(c)
	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), "redeemed_points")
	require.Contains(t, w.Body.String(), "redeemed_quota")

	var user model.User
	require.NoError(t, model.DB.First(&user, 1001).Error)
	require.Equal(t, 20000000, user.Quota)
}

func TestSelfQuoteAndPartialRedeemAffiliateRewardPointsAPI(t *testing.T) {
	setupAffiliateCommissionControllerTestDB(t)
	oldPrice := operation_setting.Price
	oldDistribution := *operation_setting.GetDistributionSetting()
	t.Cleanup(func() {
		operation_setting.Price = oldPrice
		*operation_setting.GetDistributionSetting() = oldDistribution
	})
	operation_setting.Price = 0.2
	distribution := operation_setting.GetDistributionSetting()
	distribution.PointsPerAmountUnit = operation_setting.DefaultDistributionPointsPerAmountUnit
	distribution.OfflineAmountPerPointMicros = operation_setting.DefaultDistributionOfflineAmountPerPointMicros
	require.NoError(t, model.DB.Create(&model.User{
		Id:                  1001,
		Username:            "agent",
		DisplayName:         "agent",
		Status:              common.UserStatusEnabled,
		Role:                common.RoleCommonUser,
		AffCode:             "agent_code",
		DistributionEnabled: true,
	}).Error)
	require.NoError(t, model.DB.Create(&model.AffiliateCommission{
		Id:                     2001,
		TradeNo:                "partial-redeem-points",
		BuyerId:                1002,
		PromoterId:             1001,
		Level:                  model.AffiliateCommissionLevel1,
		BaseAmountMicros:       1000000,
		CommissionRateBps:      1000,
		CommissionAmountMicros: 100000,
		BaseQuota:              500000,
		RewardPoints:           40,
		Status:                 model.AffiliateCommissionStatusPending,
	}).Error)

	quoteBody, err := common.Marshal(map[string]any{"points": 10})
	require.NoError(t, err)
	c, w := affiliateControllerTestContext(http.MethodPost, "/api/affiliate/self/rewards/quote", quoteBody)
	c.Set("id", 1001)
	QuoteSelfAffiliateRewardPoints(c)
	require.Equal(t, http.StatusOK, w.Code)
	var quoteRes struct {
		Success bool                                  `json:"success"`
		Data    model.AffiliateRewardPointQuoteResult `json:"data"`
	}
	require.NoError(t, common.Unmarshal(w.Body.Bytes(), &quoteRes))
	require.True(t, quoteRes.Success)
	require.Equal(t, 10, quoteRes.Data.RedeemablePoints)
	require.Equal(t, 5000000, quoteRes.Data.RedeemedQuota)

	redeemBody, err := common.Marshal(map[string]any{"points": 10})
	require.NoError(t, err)
	c, w = affiliateControllerTestContext(http.MethodPost, "/api/affiliate/self/rewards/redeem", redeemBody)
	c.Set("id", 1001)
	RedeemSelfAffiliateRewardPoints(c)
	require.Equal(t, http.StatusOK, w.Code)
	var redeemRes struct {
		Success bool                                       `json:"success"`
		Data    model.AffiliateRewardPointRedemptionResult `json:"data"`
	}
	require.NoError(t, common.Unmarshal(w.Body.Bytes(), &redeemRes))
	require.True(t, redeemRes.Success)
	require.Equal(t, 10, redeemRes.Data.RedeemedPoints)
	require.Equal(t, 5000000, redeemRes.Data.RedeemedQuota)

	var commission model.AffiliateCommission
	require.NoError(t, model.DB.First(&commission, 2001).Error)
	require.Equal(t, model.AffiliateCommissionStatusPending, commission.Status)
	require.Equal(t, 10, commission.SettledPoints)
	require.Equal(t, 10, commission.WalletRedeemedPoints)

	var user model.User
	require.NoError(t, model.DB.First(&user, 1001).Error)
	require.Equal(t, 5000000, user.Quota)
}

func TestSelfAffiliateRewardPointSettlementsAPI(t *testing.T) {
	setupAffiliateCommissionControllerTestDB(t)
	require.NoError(t, model.DB.Create(&model.User{
		Id:                  1001,
		Username:            "agent",
		DisplayName:         "agent",
		Status:              common.UserStatusEnabled,
		Role:                common.RoleCommonUser,
		AffCode:             "agent_code",
		DistributionEnabled: true,
	}).Error)
	require.NoError(t, model.DB.Create(&model.User{
		Id:                  1002,
		Username:            "other_agent",
		DisplayName:         "other_agent",
		Status:              common.UserStatusEnabled,
		Role:                common.RoleCommonUser,
		AffCode:             "other_agent_code",
		DistributionEnabled: true,
	}).Error)
	require.NoError(t, model.DB.Create(&model.AffiliateCommission{
		Id:             2001,
		TradeNo:        "self-settlement",
		BuyerId:        1003,
		PromoterId:     1001,
		Level:          model.AffiliateCommissionLevel1,
		RewardPoints:   10,
		SettledPoints:  10,
		Status:         model.AffiliateCommissionStatusSettled,
		SettlementType: model.AffiliateCommissionSettlementTypeWallet,
	}).Error)
	require.NoError(t, model.DB.Create(&model.AffiliateCommissionSettlement{
		CommissionId:   2001,
		PromoterId:     1001,
		SettlementType: model.AffiliateCommissionSettlementTypeWallet,
		SettledPoints:  10,
		WalletQuota:    5000000,
		SettledBy:      1001,
		SettledAt:      123,
		Remark:         "redeemed to wallet",
	}).Error)
	require.NoError(t, model.DB.Create(&model.AffiliateCommissionSettlement{
		CommissionId:   2002,
		PromoterId:     1002,
		SettlementType: model.AffiliateCommissionSettlementTypeWallet,
		SettledPoints:  99,
		WalletQuota:    49500000,
		SettledBy:      1002,
		SettledAt:      124,
	}).Error)

	c, w := affiliateControllerTestContext(http.MethodGet, "/api/affiliate/self/redemptions", nil)
	c.Set("id", 1001)
	GetSelfAffiliateRewardPointSettlements(c)
	require.Equal(t, http.StatusOK, w.Code)
	body := w.Body.String()
	require.Contains(t, body, `"total":1`)
	require.Contains(t, body, `"points":10`)
	require.NotContains(t, body, `"points":99`)
}

func TestAdminOfflineCashbackAffiliateRewardPointsAPI(t *testing.T) {
	setupAffiliateCommissionControllerTestDB(t)
	require.NoError(t, model.DB.Create(&model.User{
		Id:                  1001,
		Username:            "agent",
		DisplayName:         "agent",
		Status:              common.UserStatusEnabled,
		Role:                common.RoleCommonUser,
		AffCode:             "agent_code",
		DistributionEnabled: true,
	}).Error)
	require.NoError(t, model.DB.Create(&model.User{
		Id:          9001,
		Username:    "admin",
		DisplayName: "admin",
		Status:      common.UserStatusEnabled,
		Role:        common.RoleAdminUser,
		AffCode:     "admin_code",
	}).Error)
	require.NoError(t, model.DB.Create(&model.AffiliateCommission{
		Id:             2001,
		TradeNo:        "cashback-points",
		BuyerId:        1002,
		PromoterId:     1001,
		Level:          model.AffiliateCommissionLevel1,
		RewardPoints:   20,
		Status:         model.AffiliateCommissionStatusPending,
		SettlementType: "",
	}).Error)

	body, err := common.Marshal(map[string]any{
		"promoter_id": 1001,
		"points":      10,
		"remark":      "cashback",
	})
	require.NoError(t, err)
	c, w := affiliateControllerTestContext(http.MethodPost, "/api/affiliate/admin/rewards/offline-cashback", body)
	c.Set("id", 9001)
	AdminOfflineCashbackAffiliateRewardPoints(c)
	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"success":true`)

	var commission model.AffiliateCommission
	require.NoError(t, model.DB.First(&commission, 2001).Error)
	require.Equal(t, model.AffiliateCommissionStatusPending, commission.Status)
	require.Equal(t, 10, commission.SettledPoints)
	require.Equal(t, 10, commission.OfflineSettledPoints)

	var settlement model.AffiliateCommissionSettlement
	require.NoError(t, model.DB.First(&settlement).Error)
	require.Equal(t, model.AffiliateCommissionSettlementTypeOfflineCashback, settlement.SettlementType)
	require.Equal(t, 10, settlement.SettledPoints)
	require.Equal(t, 0, settlement.WalletQuota)
	require.Equal(t, 9001, settlement.SettledBy)
}
