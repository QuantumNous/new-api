package router

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/plugins"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestListModelsSupportsOpenAIAndGeminiAuthentication(t *testing.T) {
	setupRelayRouterTestDB(t)

	user := model.User{
		Username: "models-user",
		Status:   common.UserStatusEnabled,
		Group:    "default",
		Quota:    100,
	}
	require.NoError(t, model.DB.Create(&user).Error)
	require.NoError(t, model.DB.Create(&model.Token{
		UserId:         user.Id,
		Key:            "modelstestkey",
		Status:         common.TokenStatusEnabled,
		ExpiredTime:    -1,
		UnlimitedQuota: true,
	}).Error)

	engine := gin.New()
	SetRelayRouter(engine)

	tests := []struct {
		name           string
		path           string
		headerName     string
		expectedObject string
		expectedField  string
	}{
		{
			name:           "OpenAI bearer token",
			path:           "/v1/models",
			headerName:     "Authorization",
			expectedObject: "list",
			expectedField:  "data",
		},
		{
			name:          "Gemini API key header",
			path:          "/v1/models",
			headerName:    "x-goog-api-key",
			expectedField: "models",
		},
		{
			name:          "Gemini API key query",
			path:          "/v1/models?key=modelstestkey",
			expectedField: "models",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, test.path, nil)
			if test.headerName != "" {
				value := "modelstestkey"
				if test.headerName == "Authorization" {
					value = "Bearer " + value
				}
				request.Header.Set(test.headerName, value)
			}

			engine.ServeHTTP(recorder, request)

			require.Equal(t, http.StatusOK, recorder.Code)
			var payload map[string]any
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
			assert.Contains(t, payload, test.expectedField)
			assert.NotContains(t, payload, "error")
			if test.expectedObject != "" {
				assert.Equal(t, test.expectedObject, payload["object"])
			}
		})
	}
}

func TestGeminiRelayHandsLongRunningPredictionToPluginRoute(t *testing.T) {
	setupRelayRouterTestDB(t)
	require.NoError(t, i18n.Init())
	user := model.User{Username: "veo-user", Status: common.UserStatusEnabled, Group: "default", Quota: 100}
	require.NoError(t, model.DB.Create(&user).Error)
	require.NoError(t, model.DB.Create(&model.Token{UserId: user.Id, Key: "veotestkey", Status: common.TokenStatusEnabled, ExpiredTime: -1, UnlimitedQuota: true}).Error)

	engine := gin.New()
	SetRelayRouter(engine)
	source, err := plugins.Source("google")
	require.NoError(t, err)
	registry := jsplugin.NewRegistry()
	_, err = registry.RegisterFactory(source, jsplugin.Options{Key: "google"})
	require.NoError(t, err)
	// The plugin route authenticates as in production, then names itself.
	handlers := func(generation *jsplugin.RoutingGeneration, group jsplugin.RouteGroup) []gin.HandlerFunc {
		production := productionPluginRouteHandlers(generation, group)
		return []gin.HandlerFunc{production[0], production[1], production[2], func(c *gin.Context) {
			c.String(http.StatusOK, "plugin %s for user %d", group.Bindings[0].Plugin.Meta.Key, c.GetInt("id"))
		}}
	}
	require.NoError(t, registry.SetGenerationPreparer(newPluginGenerationBuilder(engine.Routes(), nil, handlers).prepare))
	require.Empty(t, registry.RoutingErrors())
	previousRegistry := defaultPluginDispatcher.registry
	defaultPluginDispatcher.registry = registry
	t.Cleanup(func() { defaultPluginDispatcher.registry = previousRegistry })
	engine.NoRoute(defaultPluginDispatcher.dispatch)

	for _, testCase := range []struct {
		method   string
		path     string
		toPlugin bool
	}{
		{method: http.MethodPost, path: "/v1beta/models/veo-3.1-generate-preview:predictLongRunning", toPlugin: true},
		{method: http.MethodGet, path: "/v1beta/models/veo-3.1-generate-preview/operations/task_sample", toPlugin: true},
		{method: http.MethodPost, path: "/v1beta/models/gemini-2.5-flash:generateContent"},
	} {
		t.Run(testCase.path, func(t *testing.T) {
			request := httptest.NewRequest(testCase.method, testCase.path, strings.NewReader(`{}`))
			request.Header.Set("x-goog-api-key", "veotestkey")
			recorder := httptest.NewRecorder()
			engine.ServeHTTP(recorder, request)

			if testCase.toPlugin {
				assert.Equal(t, fmt.Sprintf("plugin google for user %d", user.Id), recorder.Body.String())
				return
			}
			// The relay looks for a Gemini channel serving the model; there is none.
			assert.Equal(t, http.StatusServiceUnavailable, recorder.Code)
			assert.Contains(t, recorder.Body.String(), `"code":"model_not_found"`)
		})
	}
}

func TestImageSVGAuthorBilling(t *testing.T) {
	h := newRelayHarness(t)
	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error { saved[key] = value; return nil }))
	selfUse := operation_setting.SelfUseModeEnabled
	operation_setting.SelfUseModeEnabled = true
	t.Cleanup(func() {
		operation_setting.SelfUseModeEnabled = selfUse
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
	})
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode": `{"gpt-image-2.6-flare":"tiered_expr","gpt-5.4-mini":"tiered_expr","expensive-author":"tiered_expr"}`,
		"billing_setting.billing_expr": `{"gpt-image-2.6-flare":"tier(\"image\", p*5+c*30)","gpt-5.4-mini":"tier(\"author\", p*0.75+c*4.5)","expensive-author":"tier(\"author\",fixed(201))"}`,
	}))
	channel := h.newChannel(constant.ChannelTypeOpenAI, "test")
	channel.Models = "gpt-image-2.6-flare"
	h.install(t, channel)
	const path = "/v1/images/generations"
	const request = `{"model":"gpt-image-2.6-flare","prompt":"circle","output_format":"svg"`
	for _, suffix := range []string{`}`, `,"svg":{"model":"unpriced-author"}}`} {
		result := h.post(t, path, request+suffix)
		assert.Equal(t, http.StatusBadRequest, result.status, result.body)
		assert.Zero(t, result.quota)
		assert.Empty(t, h.upstream.captured())
	}
	const response = `{"data":[{"b64_json":"PHN2Zy8+"}],"usage":{"input_tokens":89,"output_tokens":824},"svg_usage":{"model":"gpt-5.4-mini-2026-03-17","input_tokens":1599,"output_tokens":155,"reasoning_tokens":80,"total_tokens":1754}}`
	expensive := h.post(t, path, request+`,"svg":{"model":"expensive-author"}}`)
	assert.Equal(t, http.StatusForbidden, expensive.status, expensive.body)
	assert.Zero(t, expensive.quota)
	require.Empty(t, h.upstream.captured())
	h.upstream.respond = func(w http.ResponseWriter, _ int, _ capturedRequest) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, response)
	}
	result := h.post(t, path, request+`,"svg":{"model":"gpt-5.4-mini"}}`)
	require.Equal(t, http.StatusOK, result.status, result.body)
	assert.JSONEq(t, response, result.body)
	assert.Equal(t, 12583+948, result.quota)
	assert.Equal(t, result.quota, result.log.Quota)
	assert.EqualValues(t, 1, consumeLogCount(t))
	assert.Equal(t, "gpt-5.4-mini", gjson.Get(result.log.Other, "svg_author.billing_model").String())
	assert.Equal(t, "gpt-5.4-mini-2026-03-17", gjson.Get(result.log.Other, "svg_author.usage.model").String())
	assert.EqualValues(t, 80, gjson.Get(result.log.Other, "svg_author.usage.reasoning_tokens").Int())
	assert.EqualValues(t, 948, gjson.Get(result.log.Other, "svg_author.quota").Int())
	plain := h.post(t, path, `{"model":"gpt-image-2.6-flare","prompt":"circle","output_format":"png"}`)
	assert.Equal(t, 12583, plain.quota)
	assert.False(t, gjson.Get(plain.log.Other, "svg_author").Exists())
	channel.ParamOverride = common.GetPointer(`{"svg":{"model":"another-author"}}`)
	h.install(t, channel)
	replaced := h.post(t, path, request+`,"svg":{"model":"gpt-5.4-mini"}}`)
	assert.Equal(t, http.StatusBadRequest, replaced.status, replaced.body)
	assert.Zero(t, replaced.quota)
	assert.Len(t, h.upstream.captured(), 2)
}

func setupRelayRouterTestDB(t *testing.T) {
	t.Helper()

	gin.SetMode(gin.TestMode)
	originalIsMasterNode := common.IsMasterNode
	originalRedisEnabled := common.RedisEnabled
	originalSQLitePath := common.SQLitePath
	originalMainDatabaseType := common.MainDatabaseType()
	originalLogDatabaseType := common.LogDatabaseType()
	originalSQLDSN, hadSQLDSN := os.LookupEnv("SQL_DSN")

	common.IsMasterNode = false
	common.RedisEnabled = false
	common.SQLitePath = fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	require.NoError(t, os.Setenv("SQL_DSN", "local"))
	require.NoError(t, model.InitDB())
	model.LOG_DB = model.DB
	require.NoError(t, model.DB.AutoMigrate(&model.User{}, &model.Token{}, &model.Ability{}))

	t.Cleanup(func() {
		if sqlDB, err := model.DB.DB(); err == nil {
			_ = sqlDB.Close()
		}
		common.IsMasterNode = originalIsMasterNode
		common.RedisEnabled = originalRedisEnabled
		common.SQLitePath = originalSQLitePath
		common.SetDatabaseTypes(originalMainDatabaseType, originalLogDatabaseType)
		if hadSQLDSN {
			require.NoError(t, os.Setenv("SQL_DSN", originalSQLDSN))
		} else {
			require.NoError(t, os.Unsetenv("SQL_DSN"))
		}
	})
}
