package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestDashboardSystemRouteRequiresAuthentication(t *testing.T) {
	previousRateLimit := common.GlobalApiRateLimitEnable
	common.GlobalApiRateLimitEnable = false
	t.Cleanup(func() { common.GlobalApiRateLimitEnable = previousRateLimit })

	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetApiRouter(engine)
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/next/dashboard/system", nil))

	require.Equal(t, http.StatusUnauthorized, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "AUTH_UNAUTHORIZED")
}

func TestDashboardSystemRouteAllowsAuthenticatedUserAndOnlyReturnsPublicFields(t *testing.T) {
	previousDB := model.DB
	previousDatabaseType := common.MainDatabaseType()
	previousRedisEnabled := common.RedisEnabled
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}))
	model.DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	t.Cleanup(func() {
		model.DB = previousDB
		common.SetMainDatabaseType(previousDatabaseType)
		common.RedisEnabled = previousRedisEnabled
	})

	accessToken := "dashboard-system-route-test"
	user := model.User{
		Username: "dashboard-system-user", Password: "unused", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AccessToken: &accessToken,
		AuthVersion: 1, AffCode: "dashboard-system-aff",
	}
	require.NoError(t, db.Create(&user).Error)
	common.StartSystemMonitor()

	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetApiRouter(engine)
	request := httptest.NewRequest(http.MethodGet, "/api/next/dashboard/system", nil)
	request.Header.Set("Authorization", "Bearer "+accessToken)
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusOK, recorder.Code)
	var body struct {
		Success bool                   `json:"success"`
		Data    map[string]interface{} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &body))
	require.True(t, body.Success)
	actualFields := make([]string, 0, len(body.Data))
	for field := range body.Data {
		actualFields = append(actualFields, field)
	}
	assert.ElementsMatch(t, []string{
		"status", "scope", "sampled_at", "cpu_percent", "memory_used_bytes",
		"memory_total_bytes", "disk_used_bytes", "disk_total_bytes",
		"network_tx_bytes_per_second", "network_rx_bytes_per_second",
		"network_series", "api_success_rate_24h", "version",
	}, actualFields)
}
