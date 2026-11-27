package router

import (
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
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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

func TestChannelTestRoutesRequireOperatePermission(t *testing.T) {
	assertChannelRoutePermission(t, http.MethodGet, "/test/:id", authz.ChannelOperate, controller.TestChannel)
	assertChannelRoutePermission(t, http.MethodPost, "/test/:id", authz.ChannelOperate, controller.TestChannel)

	setupRelayRouterTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.UserAccessToken{}, &model.AuditLog{}))
	user := model.User{
		Username: "test-operator", AffCode: "test-operator", Role: common.RoleRootUser,
		Group: "default", Status: common.UserStatusEnabled,
	}
	require.NoError(t, model.DB.Create(&user).Error)
	engine := gin.New()
	SetApiRouter(engine)

	for _, tc := range []struct {
		name       string
		permission authz.Permission
		status     int
	}{
		{name: "read only", permission: authz.ChannelRead, status: http.StatusForbidden},
		{name: "operate", permission: authz.ChannelOperate, status: http.StatusOK},
	} {
		t.Run(tc.name, func(t *testing.T) {
			suffix, err := common.GenerateRandomCharsKey(43)
			require.NoError(t, err)
			raw := model.AccessTokenPrefix + suffix
			token := model.UserAccessToken{Name: tc.name, TokenHash: model.AccessTokenFingerprint(raw), TokenHint: model.AccessTokenHint(raw)}
			require.NoError(t, token.SetScopes([]string{service.AccessTokenScopeOf(tc.permission)}))
			require.NoError(t, model.CreateUserAccessToken(user.Id, &token, service.AccessTokenMaxPerUser))

			req := httptest.NewRequest(http.MethodPost, "/api/channel/test/invalidID", strings.NewReader(`{"message":"private message"}`))
			req.Header.Set("Authorization", "Bearer "+raw)
			req.Header.Set("Content-Type", "application/json")
			recorder := httptest.NewRecorder()
			engine.ServeHTTP(recorder, req)

			require.Equal(t, tc.status, recorder.Code, recorder.Body.String())
			if tc.status == http.StatusForbidden {
				assert.Contains(t, recorder.Body.String(), "ACCESS_TOKEN_SCOPE_DENIED")
			} else {
				assert.Contains(t, recorder.Body.String(), "invalid syntax")
			}
		})
	}
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
