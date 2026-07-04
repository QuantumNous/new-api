package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type creditsResponse struct {
	Data struct {
		TotalUsage float64 `json:"total_usage"`
	} `json:"data"`
}

func setupBillingCreditsTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	gin.SetMode(gin.TestMode)
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)

	oldRedisEnabled := common.RedisEnabled
	oldDisplayTokenStatEnabled := common.DisplayTokenStatEnabled
	oldQuotaDisplayType := operation_setting.GetGeneralSetting().QuotaDisplayType
	common.RedisEnabled = false
	common.DisplayTokenStatEnabled = true
	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD
	t.Cleanup(func() {
		common.RedisEnabled = oldRedisEnabled
		common.DisplayTokenStatEnabled = oldDisplayTokenStatEnabled
		operation_setting.GetGeneralSetting().QuotaDisplayType = oldQuotaDisplayType
	})

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db

	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Token{}))
	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

func requestCredits(t *testing.T, configureContext func(*gin.Context)) creditsResponse {
	t.Helper()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/credits", nil)
	configureContext(ctx)

	GetCredits(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)

	var response creditsResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	return response
}

func TestGetCreditsUsesTokenRemainingQuotaWhenTokenStatsEnabled(t *testing.T) {
	db := setupBillingCreditsTestDB(t)

	token := model.Token{
		Id:          12,
		UserId:      34,
		Key:         "credits-token",
		Status:      common.TokenStatusEnabled,
		RemainQuota: int(common.QuotaPerUnit * 2),
	}
	require.NoError(t, db.Create(&token).Error)

	response := requestCredits(t, func(ctx *gin.Context) {
		ctx.Set("token_id", token.Id)
	})

	assert.Equal(t, 2.0, response.Data.TotalUsage)
}

func TestGetCreditsUsesUserQuotaWhenTokenStatsDisabled(t *testing.T) {
	db := setupBillingCreditsTestDB(t)
	common.DisplayTokenStatEnabled = false

	user := model.User{
		Id:       56,
		Username: "credits-user",
		Password: "password123",
		Status:   common.UserStatusEnabled,
		Quota:    int(common.QuotaPerUnit * 4),
	}
	require.NoError(t, db.Create(&user).Error)

	response := requestCredits(t, func(ctx *gin.Context) {
		ctx.Set("id", user.Id)
	})

	assert.Equal(t, 4.0, response.Data.TotalUsage)
}
