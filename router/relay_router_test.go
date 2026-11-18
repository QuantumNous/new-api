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
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
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

	channel.ParamOverride = nil
	channel.Type = constant.ChannelTypeNewAPI
	h.install(t, channel)
	compatible := h.post(t, path, request+`,"svg":{"model":"gpt-5.4-mini"}}`)
	require.Equal(t, http.StatusOK, compatible.status, compatible.body)
	assert.Equal(t, 13531, compatible.quota)

	channel.Type = constant.ChannelTypeAdvancedCustom
	channel.SetOtherSettings(dto.ChannelOtherSettings{AdvancedCustom: &dto.AdvancedCustomConfig{Routes: []dto.AdvancedCustomRoute{
		{IncomingPath: path, UpstreamPath: path},
	}}})
	h.install(t, channel)
	h.upstream.reset()
	retries := common.RetryTimes
	common.RetryTimes = 1
	t.Cleanup(func() { common.RetryTimes = retries })
	h.upstream.respond = func(w http.ResponseWriter, attempt int, _ capturedRequest) {
		if attempt == 1 {
			w.Header().Set("Content-Type", "text/event-stream")
			w.WriteHeader(http.StatusBadGateway)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, response)
	}
	retried := h.post(t, path, request+`,"svg":{"model":"gpt-5.4-mini"}}`)
	require.Equal(t, http.StatusOK, retried.status, retried.body)
	assert.Len(t, h.upstream.captured(), 2)
	assert.Equal(t, 13531, retried.quota)

	h.upstream.respond = func(w http.ResponseWriter, _ int, _ capturedRequest) {
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, "data: unexpected payload\n\n")
	}
	stream := h.post(t, path, request+`,"svg":{"model":"gpt-5.4-mini"}}`)
	assert.Equal(t, http.StatusBadGateway, stream.status, stream.body)
	assert.NotContains(t, stream.body, "unexpected payload")
	assert.Zero(t, stream.quota)

	oldPrices := ratio_setting.ModelPrice2JSONString()
	t.Cleanup(func() { require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(oldPrices)) })
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(`{"legacy-author":0.01,"free-image":0}`))
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode": `{"fixed-author":"tiered_expr","mixed-author":"tiered_expr","expensive-author":"tiered_expr","gpt-image-2.6-flare":"tiered_expr"}`,
		"billing_setting.billing_expr": `{"fixed-author":"tier(\"fixed\", fixed(0.01))","mixed-author":"len == 0 ? tier(\"fixed\",fixed(0.01)) : tier(\"token\",p)","expensive-author":"tier(\"fixed\",fixed(100))","gpt-image-2.6-flare":"tier(\"image\",p*5+c*30)"}`,
	}))
	for _, tc := range []struct {
		model, usage string
		quota        int
	}{
		{"fixed-author", "", 5000}, {"legacy-author", "", 5000}, {"mixed-author", "", 0}, {"legacy-author", `,"svg_usage":{"input_tokens":0,"output_tokens":0}`, 5000},
	} {
		h.upstream.respond = func(w http.ResponseWriter, _ int, _ capturedRequest) {
			w.Header().Set("Content-Type", "application/json")
			fmt.Fprint(w, `{"data":[{"b64_json":"ok"}],"usage":{"input_tokens":89,"output_tokens":824}`+tc.usage+"}")
		}
		result := h.post(t, path, request+`,"svg":{"model":"`+tc.model+`"}}`)
		require.Equal(t, http.StatusOK, result.status, result.body)
		assert.Equal(t, 12583+tc.quota, result.quota, tc.model)
		assert.EqualValues(t, tc.quota, gjson.Get(result.log.Other, "svg_author.quota").Int())
		if tc.usage == "" {
			assert.Equal(t, "null", gjson.Get(result.log.Other, "svg_author.usage").Raw)
		}
	}

	// A free image creates no initial session. The wallet covers the combined
	// estimate, but the limited token only exceeds the trust threshold.
	channel.Models = "free-image"
	operation_setting.GetQuotaSetting().EnableFreeModelPreConsume = false // restored by saved config
	h.install(t, channel)
	require.NoError(t, model.DB.Model(&model.Token{}).Where("id = ?", h.tokenID).Update("remain_quota", 10000000).Error)
	h.upstream.reset()
	limited := h.post(t, path, `{"model":"free-image","prompt":"circle","output_format":"svg","svg":{"model":"expensive-author"}}`)
	assert.Equal(t, http.StatusForbidden, limited.status, limited.body)
	assert.Zero(t, limited.quota)
	assert.Empty(t, h.upstream.captured())

	// The image leaves only 100 quota before the single-request ceiling.
	channel.Models = "gpt-image-2.6-flare"
	h.install(t, channel)
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_expr": `{"gpt-image-2.6-flare":"tier(\"image\", c > 0 ? 4294967094.0 : 0.0)"}`,
	}))
	for _, target := range []struct {
		table  any
		id     int
		column string
	}{
		{&model.Token{}, h.tokenID, "remain_quota"}, {&model.User{}, h.userID, "quota"},
	} {
		require.NoError(t, model.DB.Model(target.table).Where("id = ?", target.id).Update(target.column, int64(common.MaxQuota)+100000000).Error)
	}
	capped := h.post(t, path, request+`,"svg":{"model":"legacy-author"}}`)
	require.Equal(t, http.StatusOK, capped.status, capped.body)
	assert.Equal(t, common.MaxQuota, capped.quota)
	assert.EqualValues(t, 100, gjson.Get(capped.log.Other, "svg_author.quota").Int())
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
