package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestIQRoutesAuthenticationAndPermissions(t *testing.T) {
	gin.SetMode(gin.TestMode)
	oldDB, oldLog, oldRedis, oldMaster := model.DB, model.LOG_DB, common.RedisEnabled, common.IsMasterNode
	oldSecret := common.SessionSecret
	oldMainType, oldLogType := common.MainDatabaseType(), common.LogDatabaseType()
	t.Setenv("LOG_SQL_DSN", "")
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	model.DB = db
	model.LOG_DB = db
	common.RedisEnabled = false
	common.IsMasterNode = true
	common.SessionSecret = "iq-route-test-secret"
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	// Initialize dialect-specific column quoting without a second database or migration.
	common.IsMasterNode = false
	require.NoError(t, model.InitLogDB())
	common.IsMasterNode = true
	t.Cleanup(func() {
		model.DB = oldDB
		model.LOG_DB = oldLog
		common.RedisEnabled = oldRedis
		common.IsMasterNode = oldMaster
		common.SessionSecret = oldSecret
		common.SetDatabaseTypes(oldMainType, oldLogType)
		_ = sqlDB.Close()
	})
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.UserSession{}, &model.IQConfig{}, &model.IQResult{}, &model.SystemTask{}, &model.CasbinRule{}, &model.AuthzRole{}, &model.Log{}))
	require.NoError(t, authz.Init(db))
	engine := gin.New()
	registerIQRoutes(engine.Group("/api"))
	for _, route := range engine.Routes() {
		w := httptest.NewRecorder()
		engine.ServeHTTP(w, httptest.NewRequest(route.Method, route.Path, nil))
		require.Equal(t, 401, w.Code, route.Path)
		require.Contains(t, w.Header().Get("Cache-Control"), "no-store")
	}
	for _, r := range iqAdminPermissionRoutes {
		rule, ok := middleware.AccessTokenRouteRule(r.method + " /api/iq-tests" + r.path)
		require.True(t, ok)
		require.Equal(t, service.AccessTokenScopeOf(r.permission), rule.Scope())
	}
	for _, role := range []int{common.RoleCommonUser, common.RoleRootUser} {
		user := &model.User{Username: map[int]string{common.RoleCommonUser: "iq-member", common.RoleRootUser: "iq-root"}[role], Role: role, Group: "default", Status: common.UserStatusEnabled, AuthVersion: 1}
		user.AffCode = user.Username
		require.NoError(t, db.Create(user).Error)
		bundle, err := service.CreateLoginSession(user.Id, "password", "127.0.0.1", "iq-test")
		require.NoError(t, err)
		for _, path := range []string{"/api/iq-tests/config", "/api/iq-tests/results"} {
			req := httptest.NewRequest(http.MethodGet, path, nil)
			req.Header.Set("Authorization", "Bearer "+bundle.AccessToken)
			w := httptest.NewRecorder()
			engine.ServeHTTP(w, req)
			want := 200
			if path == "/api/iq-tests/config" && role == common.RoleCommonUser {
				want = 403
			}
			require.Equal(t, want, w.Code, w.Body.String())
		}
	}
}
