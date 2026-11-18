package router

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestChannelDefaultBaseURLsRequireReadPermission(t *testing.T) {
	assertChannelRoutePermission(t, http.MethodGet, "/default_base_urls", authz.ChannelRead, controller.GetChannelDefaultBaseURLs)

	gin.SetMode(gin.TestMode)
	engine := gin.New()
	registerChannelRoutes(engine.Group("/api"))
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/channel/default_base_urls", nil))
	assert.Equal(t, http.StatusUnauthorized, recorder.Code)
}

func TestChannelStatusRoutesUseExpectedPermissions(t *testing.T) {
	assertChannelRoutePermission(t, http.MethodGet, "/priority/order", authz.ChannelRead, controller.GetChannelPriorityOrder)
	assertChannelRoutePermission(t, http.MethodPost, "/priority/reorder", authz.ChannelWrite, controller.ReorderChannelPriority)
	assertChannelRoutePermission(t, http.MethodGet, "/:id/vllm/status", authz.ChannelRead, controller.GetVLLMChannelStatus)
	assertChannelRoutePermission(t, http.MethodGet, "/:id/sglang/status", authz.ChannelRead, controller.GetSGLangChannelStatus)
	assertChannelRoutePermission(t, http.MethodPost, "/:id/status", authz.ChannelOperate, controller.UpdateChannelStatus)
	assertChannelRoutePermission(t, http.MethodPost, "/status/batch", authz.ChannelOperate, controller.BatchUpdateChannelStatus)
	assertChannelRoutePermission(t, http.MethodPut, "/", authz.ChannelWrite, controller.UpdateChannel)
}

func TestChannelDeleteRoutesUseSensitiveWritePermission(t *testing.T) {
	assertChannelRoutePermission(t, http.MethodDelete, "/:id", authz.ChannelSensitiveWrite, controller.DeleteChannel)
	assertChannelRoutePermission(t, http.MethodPost, "/batch", authz.ChannelSensitiveWrite, controller.DeleteChannelBatch)
	assertChannelRoutePermission(t, http.MethodDelete, "/disabled", authz.ChannelSensitiveWrite, controller.DeleteDisabledChannel)
	assertChannelRoutePermission(t, http.MethodPut, "/", authz.ChannelWrite, controller.UpdateChannel)
	assertChannelRoutePermission(t, http.MethodPut, "/tag", authz.ChannelWrite, controller.EditTagChannels)
	assertChannelRoutePermission(t, http.MethodPost, "/batch/tag", authz.ChannelWrite, controller.BatchSetChannelTag)
}

func TestPluginLoginRoutesUseExpectedPermissions(t *testing.T) {
	assertChannelRoutePermission(t, http.MethodPost, "/:id/plugin_login", authz.ChannelSensitiveWrite, controller.StartPluginLogin)
	assertChannelRoutePermission(t, http.MethodPost, "/:id/plugin_login/continue", authz.ChannelSensitiveWrite, controller.ContinuePluginLogin)
	assertChannelRoutePermission(t, http.MethodPost, "/plugin_login/callback", authz.ChannelSensitiveWrite, controller.CompletePluginLoginCallback)
	assertChannelRoutePermission(t, http.MethodGet, "/:id/plugin_credentials", authz.ChannelRead, controller.GetPluginCredentials)
}

func TestChannelStatusRoutesRegisterWithoutConflict(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	api := engine.Group("/api")

	require.NotPanics(t, func() {
		registerChannelRoutes(api)
	})
}

func TestChannelGlobalOperationsAreAdminOnly(t *testing.T) {
	want := map[string]bool{
		"GET /priority/order":               true,
		"POST /priority/reorder":            true,
		"GET /test":                         true,
		"GET /update_balance":               true,
		"GET /update_balance/task/:task_id": true,
		"DELETE /disabled":                  true,
		"POST /fix":                         true,
		"POST /upstream_updates/detect_all": true,
		"POST /upstream_updates/apply_all":  true,
	}
	got := map[string]bool{}
	for _, route := range channelPermissionRoutes {
		if route.adminOnly {
			got[route.method+" "+route.path] = true
		}
	}
	assert.Equal(t, want, got)
}

// TestChannelSupplierRouteGates drives the registered API routes with dashboard
// sessions: a channel supplier reaches the channel routes and the group reads
// the channel page needs, but no operation on every channel, no prefill group
// change and no channel key; a common user reaches none of them, and an
// administrator still gets past every gate.
func TestChannelSupplierRouteGates(t *testing.T) {
	previousDB, previousLogDB, previousType := model.DB, model.LOG_DB, common.MainDatabaseType()
	previousRedis, previousSecret, wasMaster := common.RedisEnabled, common.SessionSecret, common.IsMasterNode
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	model.DB, model.LOG_DB = db, db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.RedisEnabled, common.SessionSecret, common.IsMasterNode = false, "channel-route-gate-secret", true
	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.SetMainDatabaseType(previousType)
		common.RedisEnabled, common.SessionSecret, common.IsMasterNode = previousRedis, previousSecret, wasMaster
		assert.NoError(t, sqlDB.Close())
	})
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.UserSession{}, &model.AuditLog{}, &model.PrefillGroup{}, &model.CasbinRule{}, &model.AuthzRole{}))
	require.NoError(t, authz.Init(db))
	sessions := map[int]string{}
	for _, role := range []int{common.RoleCommonUser, common.RoleChannelSupplierUser, common.RoleAdminUser} {
		name := fmt.Sprintf("route-gate-%d", role)
		user := &model.User{Username: name, Password: "password-placeholder", Role: role, Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, AffCode: name}
		require.NoError(t, db.Create(user).Error)
		bundle, err := service.CreateLoginSession(user.Id, "password", "127.0.0.1", "channel-route-gate-test")
		require.NoError(t, err)
		sessions[role] = bundle.AccessToken
	}
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetApiRouter(engine)
	request := func(method, path, token string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, nil)
		req.Header.Set("Authorization", "Bearer "+token)
		recorder := httptest.NewRecorder()
		engine.ServeHTTP(recorder, req)
		return recorder
	}

	type gateCase struct {
		method, path   string
		supplierStatus int
	}
	tests := []gateCase{
		{method: http.MethodGet, path: "/api/channel/models", supplierStatus: http.StatusOK},
		{method: http.MethodGet, path: "/api/group/", supplierStatus: http.StatusOK},
		{method: http.MethodGet, path: "/api/prefill_group/", supplierStatus: http.StatusOK},
		{method: http.MethodPost, path: "/api/prefill_group/", supplierStatus: http.StatusForbidden},
		{method: http.MethodPut, path: "/api/prefill_group/", supplierStatus: http.StatusForbidden},
		{method: http.MethodDelete, path: "/api/prefill_group/1", supplierStatus: http.StatusForbidden},
		{method: http.MethodPost, path: "/api/channel/1/key", supplierStatus: http.StatusForbidden},
	}
	for _, route := range channelPermissionRoutes {
		if route.adminOnly {
			tests = append(tests, gateCase{method: route.method, path: "/api/channel" + strings.ReplaceAll(route.path, ":task_id", "1"), supplierStatus: http.StatusForbidden})
		}
	}
	// Administrators still get past every gate. Only routes whose handler is
	// harmless here are sent: empty bodies and missing tables make those
	// handlers answer on their own, never with an authorization error.
	adminRoutes := map[string]bool{
		"GET /api/group/":                        true,
		"GET /api/prefill_group/":                true,
		"POST /api/prefill_group/":               true,
		"PUT /api/prefill_group/":                true,
		"DELETE /api/prefill_group/1":            true,
		"GET /api/channel/priority/order":        true,
		"GET /api/channel/update_balance/task/1": true,
	}
	for _, test := range tests {
		key := test.method + " " + test.path
		t.Run(key, func(t *testing.T) {
			response := request(test.method, test.path, sessions[common.RoleCommonUser])
			assert.Equal(t, http.StatusForbidden, response.Code, response.Body.String())
			assert.Contains(t, response.Body.String(), `"code":"AUTH_INSUFFICIENT_PRIVILEGE"`)
			response = request(test.method, test.path, sessions[common.RoleChannelSupplierUser])
			assert.Equal(t, test.supplierStatus, response.Code, response.Body.String())
			if test.supplierStatus == http.StatusForbidden {
				assert.Contains(t, response.Body.String(), `"code":"AUTH_INSUFFICIENT_PRIVILEGE"`)
			}
			if !adminRoutes[key] {
				return
			}
			response = request(test.method, test.path, sessions[common.RoleAdminUser])
			assert.NotContains(t, []int{http.StatusUnauthorized, http.StatusForbidden}, response.Code, response.Body.String())
			assert.NotContains(t, response.Body.String(), "AUTH_INSUFFICIENT_PRIVILEGE")
		})
		delete(adminRoutes, key)
	}
	assert.Empty(t, adminRoutes, "every administrator route must be in the table")
}

func assertChannelRoutePermission(t *testing.T, method string, path string, permission authz.Permission, handler any) {
	t.Helper()
	for _, route := range channelPermissionRoutes {
		if route.method == method && route.path == path {
			assert.Equal(t, permission, route.permission)
			assert.Equal(t, reflect.ValueOf(handler).Pointer(), reflect.ValueOf(route.handler).Pointer())
			return
		}
	}
	t.Fatalf("route %s %s not found", method, path)
}
