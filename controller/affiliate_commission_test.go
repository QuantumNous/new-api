package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

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
	t.Cleanup(func() {
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
	})

	gin.SetMode(gin.TestMode)
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db
	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.AffiliatePayoutProfile{},
		&model.AffiliateCommission{},
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

func TestSelfAffiliatePayoutProfileAPI(t *testing.T) {
	setupAffiliateCommissionControllerTestDB(t)
	user := model.User{
		Username:            "agent",
		DisplayName:         "agent",
		Status:              common.UserStatusEnabled,
		Role:                common.RoleCommonUser,
		AffCode:             "agent_code",
		DistributionEnabled: true,
	}
	require.NoError(t, model.DB.Create(&user).Error)

	body, err := common.Marshal(map[string]any{
		"method":       "paypal",
		"account":      "Agent@Example.COM",
		"account_name": "Agent Name",
	})
	require.NoError(t, err)

	c, w := affiliateControllerTestContext(http.MethodPut, "/api/affiliate/self/payout-profile", body)
	c.Set("id", user.Id)
	UpdateSelfAffiliatePayoutProfile(c)
	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), "agent@example.com")

	c, w = affiliateControllerTestContext(http.MethodGet, "/api/affiliate/self/payout-profile", nil)
	c.Set("id", user.Id)
	GetSelfAffiliatePayoutProfile(c)
	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), "agent@example.com")
}

func TestAdminExportAffiliateCommissionsIncludesPayoutFields(t *testing.T) {
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
		Username:            "buyer",
		DisplayName:         "buyer",
		Status:              common.UserStatusEnabled,
		Role:                common.RoleCommonUser,
		AffCode:             "buyer_code",
		InviterId:           1001,
		DistributionEnabled: true,
	}).Error)
	_, err := model.SaveAffiliatePayoutProfile(1001, model.AffiliatePayoutMethodPayPal, "agent@example.com", "Agent Name")
	require.NoError(t, err)
	require.NoError(t, model.DB.Create(&model.AffiliateCommission{
		TradeNo:                "export-paypal",
		BuyerId:                1002,
		PromoterId:             1001,
		Level:                  model.AffiliateCommissionLevel1,
		BaseAmountMicros:       1000000,
		CommissionRateBps:      1000,
		CommissionAmountMicros: 100000,
		Currency:               "CNY",
		Status:                 model.AffiliateCommissionStatusPending,
	}).Error)

	c, w := affiliateControllerTestContext(http.MethodGet, "/api/affiliate/admin/commissions/export", nil)
	AdminExportAffiliateCommissions(c)
	require.Equal(t, http.StatusOK, w.Code)
	body := w.Body.String()
	require.True(t, strings.Contains(body, "推广人当前收款账号"))
	require.True(t, strings.Contains(body, "agent@example.com"))
}
