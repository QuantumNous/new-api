package controller

import (
	"fmt"
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

func TestAdminCreateSubscriptionPlan_RejectsAutoRenewWithoutStripeRecurringPriceID(t *testing.T) {
	confirmPaymentComplianceForTest(t)
	setupSubscriptionControllerTestDB(t)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/subscription/admin/plans",
		strings.NewReader(`{"plan":{"title":"Auto Renew","price_amount":19.99,"currency":"USD","duration_unit":"month","duration_value":1,"total_amount":1000,"billing_mode":"auto_renew","enabled":true}}`),
	)
	c.Request.Header.Set("Content-Type", "application/json")

	AdminCreateSubscriptionPlan(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":false`)

	var count int64
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Count(&count).Error)
	require.Zero(t, count)
}

func setupSubscriptionControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	gin.SetMode(gin.TestMode)
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db

	require.NoError(t, db.AutoMigrate(&model.SubscriptionPlan{}))

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}
