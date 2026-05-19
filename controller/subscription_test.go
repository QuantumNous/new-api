package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupSubscriptionControllerTestDB(t *testing.T) *gorm.DB {
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
	require.NoError(t, db.AutoMigrate(&model.SubscriptionPlan{}))

	return db
}

func subscriptionControllerTestContext(method string, path string, body []byte) (*gin.Context, *httptest.ResponseRecorder) {
	req := httptest.NewRequest(method, path, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	return c, w
}

func subscriptionPlanPayload(t *testing.T, currency string) []byte {
	t.Helper()
	body, err := common.Marshal(map[string]any{
		"plan": map[string]any{
			"title":                 "Test Plan",
			"subtitle":              "Test",
			"price_amount":          10,
			"currency":              currency,
			"duration_unit":         model.SubscriptionDurationDay,
			"duration_value":        1,
			"enabled":               true,
			"sort_order":            0,
			"max_purchase_per_user": 0,
			"total_amount":          1000,
			"quota_reset_period":    model.SubscriptionResetNever,
		},
	})
	require.NoError(t, err)
	return body
}

func TestAdminCreateSubscriptionPlanForcesCNY(t *testing.T) {
	setupSubscriptionControllerTestDB(t)
	confirmPaymentComplianceForTest(t)

	c, w := subscriptionControllerTestContext(http.MethodPost, "/api/subscription/admin/plans", subscriptionPlanPayload(t, "USD"))
	AdminCreateSubscriptionPlan(c)
	require.Equal(t, http.StatusOK, w.Code)

	var plan model.SubscriptionPlan
	require.NoError(t, model.DB.First(&plan).Error)
	require.Equal(t, model.SubscriptionCurrencyCNY, plan.Currency)
}

func TestAdminUpdateSubscriptionPlanForcesCNY(t *testing.T) {
	setupSubscriptionControllerTestDB(t)
	confirmPaymentComplianceForTest(t)

	plan := &model.SubscriptionPlan{
		Title:         "Legacy USD Plan",
		PriceAmount:   10,
		Currency:      "USD",
		DurationUnit:  model.SubscriptionDurationDay,
		DurationValue: 1,
		Enabled:       true,
		TotalAmount:   1000,
	}
	require.NoError(t, model.DB.Create(plan).Error)

	c, w := subscriptionControllerTestContext(http.MethodPut, "/api/subscription/admin/plans/1", subscriptionPlanPayload(t, "USD"))
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	AdminUpdateSubscriptionPlan(c)
	require.Equal(t, http.StatusOK, w.Code)

	var updated model.SubscriptionPlan
	require.NoError(t, model.DB.First(&updated, plan.Id).Error)
	require.Equal(t, model.SubscriptionCurrencyCNY, updated.Currency)
}
