package controller

import (
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type quotaResetOptionAPIResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

func openQuotaResetOptionTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	gin.SetMode(gin.TestMode)
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Option{}))

	model.DB = db
	model.LOG_DB = db

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

func seedQuotaResetOption(t *testing.T, key string, value string) {
	t.Helper()

	common.OptionMapRWMutex.Lock()
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	common.OptionMap[key] = value
	common.OptionMapRWMutex.Unlock()

	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		delete(common.OptionMap, key)
		common.OptionMapRWMutex.Unlock()
	})
}

func readOptionMapValue(t *testing.T, key string) string {
	t.Helper()

	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	return common.OptionMap[key]
}

func putQuotaResetOption(t *testing.T, key string, value string) *httptest.ResponseRecorder {
	t.Helper()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	body := fmt.Sprintf(`{"key":%q,"value":%q}`, key, value)
	ctx.Request = httptest.NewRequest(http.MethodPut, "/api/option/", bytes.NewBufferString(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	UpdateOption(ctx)

	return recorder
}

func decodeQuotaResetOptionResponse(t *testing.T, recorder *httptest.ResponseRecorder) quotaResetOptionAPIResponse {
	t.Helper()

	var response quotaResetOptionAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	return response
}

func TestUpdateOption_QuotaResetSettingPeriod(t *testing.T) {
	tests := []struct {
		name        string
		period      string
		wantSuccess bool
	}{
		{"daily accepted", "daily", true},
		{"weekly accepted", "weekly", true},
		{"monthly accepted", "monthly", true},
		{"yearly rejected", "yearly", false},
		{"empty value rejected", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			openQuotaResetOptionTestDB(t)
			seedQuotaResetOption(t, "quota_reset_setting.period", "monthly")

			recorder := putQuotaResetOption(t, "quota_reset_setting.period", tt.period)

			require.Equal(t, http.StatusOK, recorder.Code)
			response := decodeQuotaResetOptionResponse(t, recorder)
			assert.Equal(t, tt.wantSuccess, response.Success)

			if tt.wantSuccess {
				assert.Equal(t, tt.period, readOptionMapValue(t, "quota_reset_setting.period"))
			} else {
				assert.Equal(t, "monthly", readOptionMapValue(t, "quota_reset_setting.period"))
			}
		})
	}
}

func TestUpdateOption_QuotaResetSettingResetValue(t *testing.T) {
	tests := []struct {
		name        string
		resetValue  string
		wantSuccess bool
	}{
		{"zero accepted", "0", true},
		{"positive accepted", "1000", true},
		{"negative one rejected", "-1", false},
		{"large negative rejected", "-100", false},
		{"non-integer rejected", "1.5", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			openQuotaResetOptionTestDB(t)
			seedQuotaResetOption(t, "quota_reset_setting.reset_value", "500")

			recorder := putQuotaResetOption(t, "quota_reset_setting.reset_value", tt.resetValue)

			require.Equal(t, http.StatusOK, recorder.Code)
			response := decodeQuotaResetOptionResponse(t, recorder)
			assert.Equal(t, tt.wantSuccess, response.Success)

			if tt.wantSuccess {
				assert.Equal(t, tt.resetValue, readOptionMapValue(t, "quota_reset_setting.reset_value"))
			} else {
				assert.Equal(t, "500", readOptionMapValue(t, "quota_reset_setting.reset_value"))
			}
		})
	}
}

// 夹具按启动初始化的口径，把注册模块导出的默认值种入 OptionMap。
func TestGetOptions_QuotaResetSettingDefaultDisabled(t *testing.T) {
	quotaResetKeys := []string{
		"quota_reset_setting.enabled",
		"quota_reset_setting.period",
		"quota_reset_setting.reset_value",
	}
	exported := config.GlobalConfig.ExportAllConfigs()
	for _, key := range quotaResetKeys {
		require.Contains(t, exported, key)
	}

	common.OptionMapRWMutex.Lock()
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	for _, key := range quotaResetKeys {
		common.OptionMap[key] = exported[key]
	}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		for _, key := range quotaResetKeys {
			delete(common.OptionMap, key)
		}
		common.OptionMapRWMutex.Unlock()
	})

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/option/", nil)

	GetOptions(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)

	var response struct {
		Success bool           `json:"success"`
		Data    []model.Option `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)

	var enabledValue string
	var found bool
	for _, option := range response.Data {
		if option.Key == "quota_reset_setting.enabled" {
			enabledValue = option.Value
			found = true
			break
		}
	}

	require.True(t, found, "expected quota_reset_setting.enabled to be present with a default value")
	assert.Equal(t, "false", enabledValue)
}
