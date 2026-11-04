package router

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	pluginruntime "github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestHwFreeGroupRateLimitCoversEveryBillableRoute proves that every route that
// starts billable work for a free account carries the same frozen check as a
// relay call: the task and video families, the task-plugin protocol endpoints,
// the Responses WebSocket handshake and the Midjourney submits, plus a dynamic
// plugin route. Each request is refused by the guard in front of the handler, so
// the test does not need a task plugin round trip or a supplier.
func TestHwFreeGroupRateLimitCoversEveryBillableRoute(t *testing.T) {
	gin.SetMode(gin.TestMode)

	previousDB := model.DB
	previousDatabaseType := common.MainDatabaseType()
	previousLogDatabaseType := common.LogDatabaseType()
	previousSQLitePath := common.SQLitePath
	previousMasterNode := common.IsMasterNode
	previousRedisEnabled := common.RedisEnabled
	common.SQLitePath = t.TempDir() + "/router-hw-free-group.db"
	common.IsMasterNode = false
	common.RedisEnabled = false
	t.Setenv("SQL_DSN", "")
	require.NoError(t, model.InitDB())
	database := model.DB
	require.NoError(t, database.AutoMigrate(&model.User{}, &model.Token{}, &model.HwAccountFlag{}, &model.HwCreditPackage{}, &model.HwCreditExtension{}))
	t.Cleanup(func() {
		sqlDB, closeErr := database.DB()
		require.NoError(t, closeErr)
		require.NoError(t, sqlDB.Close())
		model.DB = previousDB
		common.SetDatabaseTypes(previousDatabaseType, previousLogDatabaseType)
		common.SQLitePath = previousSQLitePath
		common.IsMasterNode = previousMasterNode
		common.RedisEnabled = previousRedisEnabled
	})

	require.NoError(t, database.Create(&model.User{
		Id:          91,
		Username:    "hw-free-group-user",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Quota:       100,
		Group:       "free",
		AuthVersion: 1,
	}).Error)
	require.NoError(t, database.Create(&model.Token{
		Id:             1,
		UserId:         91,
		Key:            "hwfreegroup",
		Status:         common.TokenStatusEnabled,
		Name:           "free group",
		ExpiredTime:    -1,
		UnlimitedQuota: true,
	}).Error)

	frozen, err := model.FreezeHwAccounts([]int{91}, model.HwFreezeReasonSharedDevice, common.GetTimestamp())
	require.NoError(t, err)
	require.Equal(t, 1, frozen)

	engine := gin.New()
	engine.Use(gin.Recovery())
	SetRelayRouter(engine)
	SetTaskPluginProtocolRouter(engine)
	SetVideoRouter(engine)
	SetTaskRouter(engine)

	// A dynamic plugin route is registered the way the plugin router builds it.
	// The plugin and its generation are stand-ins; the guard must answer before
	// either is used.
	binding := pluginruntime.RouteBinding{
		Plugin: &pluginruntime.LoadedPlugin{Meta: pluginruntime.Meta{Key: "hw-route-test", Version: "1.0.0"}},
		Route:  pluginruntime.Route{Method: http.MethodPost, Path: "/hw-plugin/route", Type: pluginruntime.RouteTypeSubmit},
	}
	engine.POST(binding.Route.Path,
		productionPluginRouteHandlers(&pluginruntime.RoutingGeneration{Number: 1}, pluginruntime.RouteGroup{
			Method:   binding.Route.Method,
			GinPath:  binding.Route.Path,
			Bindings: []pluginruntime.RouteBinding{binding},
		})...)

	for _, testCase := range []struct {
		method string
		path   string
	}{
		{method: http.MethodPost, path: "/v1/tasks/example"},
		{method: http.MethodPost, path: "/v1/video/generations"},
		{method: http.MethodPost, path: "/v1/videos/vid_1/remix"},
		{method: http.MethodPost, path: "/v1/responses"},
		{method: http.MethodGet, path: "/v1/responses"},
		{method: http.MethodPost, path: "/v1/images/generations"},
		{method: http.MethodPost, path: "/v1/images/edits"},
		{method: http.MethodPost, path: "/v1/videos"},
		{method: http.MethodPost, path: "/mj/submit/imagine"},
		{method: http.MethodPost, path: "/hw-plugin/route"},
	} {
		t.Run(testCase.method+" "+testCase.path, func(t *testing.T) {
			request := httptest.NewRequest(testCase.method, testCase.path, strings.NewReader(`{"model":"any"}`))
			request.Header.Set("Content-Type", "application/json")
			request.Header.Set("Authorization", "Bearer sk-hwfreegroup")
			recorder := httptest.NewRecorder()
			engine.ServeHTTP(recorder, request)

			assert.Equal(t, http.StatusForbidden, recorder.Code, "%s %s must be refused for a frozen free account", testCase.method, testCase.path)
			assert.Contains(t, recorder.Body.String(), "account_frozen", testCase.path)
			assert.NotContains(t, recorder.Body.String(), "lumia")
			assert.NotContains(t, recorder.Body.String(), "openrouter")
		})
	}
}
