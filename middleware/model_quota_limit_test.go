package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupModelQuotaMiddlewareTestDB(t *testing.T) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	common.BatchUpdateEnabled = false
	require.NoError(t, db.AutoMigrate(
		&model.ModelQuotaGroupRule{},
		&model.ModelQuotaPlanRule{},
		&model.UserModelQuotaUsage{},
	))
}

func TestModelQuotaLimitUsesRelayUsingGroupAndBlocksExhaustedRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupModelQuotaMiddlewareTestDB(t)

	rule := &model.ModelQuotaGroupRule{
		GroupName:    "测试模型限制",
		ModelPattern: "gpt-5.5",
		MatchMode:    model.ModelQuotaMatchModeExact,
		Period:       model.ModelQuotaPeriodTotal,
		QuotaLimit:   1,
		Enabled:      true,
	}
	require.NoError(t, model.DB.Create(rule).Error)

	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("id", 1001)
		common.SetContextKey(c, constant.ContextKeyOriginalModel, "gpt-5.5")
		common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
		common.SetContextKey(c, constant.ContextKeyUsingGroup, "测试模型限制")
		c.Next()
	})
	r.Use(ModelQuotaLimit())
	r.POST("/v1/chat/completions", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	r.ServeHTTP(recorder, req)

	require.Equal(t, http.StatusForbidden, recorder.Code)
}
