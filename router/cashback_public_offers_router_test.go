package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestCashbackPublicOffersAnonymousAndConfigRootOnly(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousType := common.MainDatabaseType()
	previousRedis := common.RedisEnabled
	previousSecret := common.SessionSecret
	previousRateEnabled := common.GlobalApiRateLimitEnable
	previousRateNum := common.GlobalApiRateLimitNum
	previousRateDuration := common.GlobalApiRateLimitDuration
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&model.Option{}, &model.User{}, &model.UserSession{}, &model.AuditLog{}))
	model.DB, model.LOG_DB = db, db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	common.SessionSecret = "cashback-offers-test-secret"
	common.GlobalApiRateLimitEnable = false
	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.SetMainDatabaseType(previousType)
		common.RedisEnabled = previousRedis
		common.SessionSecret = previousSecret
		common.GlobalApiRateLimitEnable = previousRateEnabled
		common.GlobalApiRateLimitNum = previousRateNum
		common.GlobalApiRateLimitDuration = previousRateDuration
		_ = sqlDB.Close()
	})

	admin := &model.User{Username: "offers-admin", Password: "placeholder", Role: common.RoleAdminUser, Status: common.UserStatusEnabled, AffCode: "offers-admin", AuthVersion: 1}
	root := &model.User{Username: "offers-root", Password: "placeholder", Role: common.RoleRootUser, Status: common.UserStatusEnabled, AffCode: "offers-root", AuthVersion: 1}
	require.NoError(t, db.Create(admin).Error)
	require.NoError(t, db.Create(root).Error)
	adminBundle, err := service.CreateLoginSession(admin.Id, "password", "192.0.2.183", "router-test")
	require.NoError(t, err)
	rootBundle, err := service.CreateLoginSession(root.Id, "password", "192.0.2.184", "router-test")
	require.NoError(t, err)

	engine := gin.New()
	SetApiRouter(engine)
	request := func(path, token, remoteAddr string) *httptest.ResponseRecorder {
		t.Helper()
		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.RemoteAddr = remoteAddr
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		engine.ServeHTTP(recorder, req)
		return recorder
	}

	public := request("/api/cashback/public-offers", "", "192.0.2.181:1234")
	require.Equal(t, http.StatusOK, public.Code, public.Body.String())
	assert.Contains(t, public.Body.String(), `"active":false`)
	assert.NotContains(t, public.Body.String(), "max_reward_quota")
	assert.Equal(t, http.StatusUnauthorized, request("/api/cashback/config", "", "192.0.2.182:1234").Code)
	adminResponse := request("/api/cashback/config", adminBundle.AccessToken, "192.0.2.183:1234")
	assert.Equal(t, http.StatusForbidden, adminResponse.Code, adminResponse.Body.String())
	rootResponse := request("/api/cashback/config", rootBundle.AccessToken, "192.0.2.184:1234")
	assert.Equal(t, http.StatusOK, rootResponse.Code, rootResponse.Body.String())
	assert.Contains(t, rootResponse.Body.String(), "max_reward_quota")

	// Register a fresh router with the global API limiter enabled. A public
	// cashback read must traverse it just like the other anonymous API routes.
	common.GlobalApiRateLimitEnable = true
	common.GlobalApiRateLimitNum = 1
	common.GlobalApiRateLimitDuration = 3600
	limited := gin.New()
	SetApiRouter(limited)
	for index, status := range []int{http.StatusOK, http.StatusTooManyRequests} {
		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/cashback/public-offers", nil)
		req.RemoteAddr = "192.0.2.185:1234"
		limited.ServeHTTP(recorder, req)
		assert.Equal(t, status, recorder.Code, "request %d: %s", index+1, recorder.Body.String())
	}
}
