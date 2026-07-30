package router

import (
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestSetBytePlusAssetRouterRegistersPublicAssetRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()

	SetBytePlusAssetRouter(engine)

	routes := map[string]bool{}
	for _, route := range engine.Routes() {
		routes[route.Method+" "+route.Path] = true
	}

	for _, want := range []string{
		http.MethodPost + " /v1/assets",
		http.MethodGet + " /v1/assets/:asset_id",
	} {
		require.True(t, routes[want], "route %s was not registered; routes=%v", want, engine.Routes())
	}
	require.False(t, routes[http.MethodGet+" /v1/assets"], "list endpoint must not be registered")
	require.False(t, routes[http.MethodDelete+" /v1/assets/:asset_id"], "delete endpoint must not be registered")
}

func TestBytePlusAssetRoutesReachTokenAuthWithoutDistribution(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetBytePlusAssetRouter(engine)

	for _, tc := range []struct {
		method string
		path   string
	}{
		{method: http.MethodPost, path: "/v1/assets"},
		{method: http.MethodGet, path: "/v1/assets/ast_1234567890abcdefABCDEF1234567890"},
	} {
		recorder := httptest.NewRecorder()
		engine.ServeHTTP(recorder, httptest.NewRequest(tc.method, tc.path, nil))
		require.NotEqual(t, http.StatusNotFound, recorder.Code, "%s %s route missing", tc.method, tc.path)
		require.Equal(t, http.StatusUnauthorized, recorder.Code, "%s %s should stop at TokenAuth without credentials, body=%s", tc.method, tc.path, recorder.Body.String())
		require.NotContains(t, recorder.Body.String(), "no_available_key")
	}
}

func TestBytePlusAssetCreateAppliesGlobalAPIRateLimitBeforeTokenAuth(t *testing.T) {
	gin.SetMode(gin.TestMode)

	previousEnabled := common.GlobalApiRateLimitEnable
	previousLimit := common.GlobalApiRateLimitNum
	previousDuration := common.GlobalApiRateLimitDuration
	previousRedisEnabled := common.RedisEnabled
	common.GlobalApiRateLimitEnable = true
	common.GlobalApiRateLimitNum = 1
	common.GlobalApiRateLimitDuration = 60
	common.RedisEnabled = false
	t.Cleanup(func() {
		common.GlobalApiRateLimitEnable = previousEnabled
		common.GlobalApiRateLimitNum = previousLimit
		common.GlobalApiRateLimitDuration = previousDuration
		common.RedisEnabled = previousRedisEnabled
	})

	engine := gin.New()
	SetBytePlusAssetRouter(engine)

	for i, wantStatus := range []int{http.StatusUnauthorized, http.StatusTooManyRequests} {
		request := httptest.NewRequest(http.MethodPost, "/v1/assets", nil)
		request.RemoteAddr = "198.51.100.17:12345"
		recorder := httptest.NewRecorder()

		engine.ServeHTTP(recorder, request)

		require.Equal(t, wantStatus, recorder.Code, "request %d body=%s", i+1, recorder.Body.String())
	}
}

func TestBytePlusAssetRoutesApplyModelRequestRateLimitAfterTokenAuth(t *testing.T) {
	setupBytePlusAssetRouterAuthDB(t)
	gin.SetMode(gin.TestMode)

	previousEnabled := setting.ModelRequestRateLimitEnabled
	previousDuration := setting.ModelRequestRateLimitDurationMinutes
	previousTotalCount := setting.ModelRequestRateLimitCount
	previousSuccessCount := setting.ModelRequestRateLimitSuccessCount
	previousGroup := setting.ModelRequestRateLimitGroup
	previousRedisEnabled := common.RedisEnabled
	setting.ModelRequestRateLimitEnabled = true
	setting.ModelRequestRateLimitDurationMinutes = 1
	setting.ModelRequestRateLimitCount = 1
	setting.ModelRequestRateLimitSuccessCount = 1000
	setting.ModelRequestRateLimitGroup = map[string][2]int{}
	common.RedisEnabled = false
	t.Cleanup(func() {
		setting.ModelRequestRateLimitEnabled = previousEnabled
		setting.ModelRequestRateLimitDurationMinutes = previousDuration
		setting.ModelRequestRateLimitCount = previousTotalCount
		setting.ModelRequestRateLimitSuccessCount = previousSuccessCount
		setting.ModelRequestRateLimitGroup = previousGroup
		common.RedisEnabled = previousRedisEnabled
	})

	for _, tc := range []struct {
		name   string
		method string
		path   string
		body   string
		key    string
	}{
		{name: "create", method: http.MethodPost, path: "/v1/assets", body: `{}`, key: "byteplusassetrouterratelimitcreate"},
		{name: "get", method: http.MethodGet, path: "/v1/assets/ast_router_rate_limit", body: "", key: "byteplusassetrouterratelimitget"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			engine := gin.New()
			SetBytePlusAssetRouter(engine)

			first := httptest.NewRecorder()
			firstRequest := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
			firstRequest.Header.Set("Authorization", "Bearer sk-"+tc.key)
			engine.ServeHTTP(first, firstRequest)

			require.NotEqual(t, http.StatusUnauthorized, first.Code, first.Body.String())
			require.NotEqual(t, http.StatusTooManyRequests, first.Code, first.Body.String())

			second := httptest.NewRecorder()
			secondRequest := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
			secondRequest.Header.Set("Authorization", "Bearer sk-"+tc.key)
			engine.ServeHTTP(second, secondRequest)

			require.Equal(t, http.StatusTooManyRequests, second.Code, second.Body.String())
		})
	}
}

func TestBytePlusAssetRouterUsesRateLimitAndTokenAuthWithoutDistribute(t *testing.T) {
	source, err := os.ReadFile("asset-router.go")
	require.NoError(t, err)

	text := string(source)
	require.Contains(t, text, `middleware.RouteTag("asset")`)
	require.Contains(t, text, "middleware.GlobalAPIRateLimit()")
	require.Contains(t, text, "middleware.TokenAuth()")
	require.Contains(t, text, "middleware.ModelRequestRateLimit()")
	require.NotContains(t, text, "middleware.Distribute()")
	require.NotContains(t, text, ".GET(\"/assets\"")
	require.NotContains(t, text, ".DELETE(")
}

func TestSetRouterIncludesBytePlusAssetRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()

	SetRouter(engine, ThemeAssets{})

	routes := map[string]bool{}
	for _, route := range engine.Routes() {
		routes[route.Method+" "+route.Path] = true
	}

	require.True(t, routes[http.MethodPost+" /v1/assets"])
	require.True(t, routes[http.MethodGet+" /v1/assets/:asset_id"])
}

func TestSetRouterAppliesRelayGlobalMiddlewareToBytePlusAssetRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()

	SetRouter(engine, ThemeAssets{})

	request := httptest.NewRequest(http.MethodPost, "/v1/assets", bytes.NewBufferString("not gzip"))
	request.Header.Set("Content-Encoding", "gzip")
	recorder := httptest.NewRecorder()

	engine.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusBadRequest, recorder.Code, recorder.Body.String())
}

func setupBytePlusAssetRouterAuthDB(t *testing.T) {
	t.Helper()

	originalDB := model.DB
	originalLogDB := model.LOG_DB
	originalIsMasterNode := common.IsMasterNode
	originalSQLitePath := common.SQLitePath
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalRedisEnabled := common.RedisEnabled
	originalSQLDSN, hadSQLDSN := os.LookupEnv("SQL_DSN")

	common.IsMasterNode = false
	common.SQLitePath = fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	common.UsingSQLite = false
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false
	require.NoError(t, os.Setenv("SQL_DSN", "local"))
	require.NoError(t, model.InitDB())
	require.NoError(t, model.DB.AutoMigrate(&model.User{}, &model.Token{}))
	for _, fixture := range []struct {
		id       int
		username string
		key      string
	}{
		{id: 25001, username: "byteplus-asset-router-rate-limit-create-user", key: "byteplusassetrouterratelimitcreate"},
		{id: 25002, username: "byteplus-asset-router-rate-limit-get-user", key: "byteplusassetrouterratelimitget"},
	} {
		require.NoError(t, model.DB.Create(&model.User{
			Id:       fixture.id,
			Username: fixture.username,
			Password: "password",
			AffCode:  fmt.Sprintf("asset-rate-%d", fixture.id),
			Group:    "default",
			Status:   common.UserStatusEnabled,
			Role:     common.RoleCommonUser,
			Quota:    100000,
		}).Error)
		require.NoError(t, model.DB.Create(&model.Token{
			Id:             fixture.id,
			UserId:         fixture.id,
			Key:            fixture.key,
			Status:         common.TokenStatusEnabled,
			UnlimitedQuota: true,
			ExpiredTime:    -1,
			Group:          "",
		}).Error)
	}

	t.Cleanup(func() {
		if model.DB != nil {
			sqlDB, err := model.DB.DB()
			if err == nil {
				_ = sqlDB.Close()
			}
		}
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		common.IsMasterNode = originalIsMasterNode
		common.SQLitePath = originalSQLitePath
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		common.RedisEnabled = originalRedisEnabled
		if hadSQLDSN {
			require.NoError(t, os.Setenv("SQL_DSN", originalSQLDSN))
		} else {
			require.NoError(t, os.Unsetenv("SQL_DSN"))
		}
	})
}
