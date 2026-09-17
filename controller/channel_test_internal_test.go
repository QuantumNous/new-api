package controller

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	filterdto "github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/QuantumNous/new-api/relay"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	kittypes "github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChannelRouteRestrictionDistribute(t *testing.T) {
	require.NoError(t, i18n.Init())
	user, _ := setupResponsesWSRequestTest(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Channel{}, &model.Ability{}))
	channels := []model.Channel{
		{Name: "chat-only", Type: constant.ChannelTypeOpenAI, Key: "test", Status: common.ChannelStatusEnabled, Models: "gpt-4o", Group: "default", Priority: common.GetPointer(int64(100))},
		{Name: "responses-only", Type: constant.ChannelTypeOpenAI, Key: "test", Status: common.ChannelStatusEnabled, Models: "gpt-4o", Group: "default", Priority: common.GetPointer(int64(10))},
	}
	for i, path := range []string{"/v1/chat/completions", "/v1/responses"} {
		channels[i].SetSetting(dto.ChannelSettings{RouteRestriction: &dto.ChannelRouteRestriction{AllowedPaths: []string{path}}})
		require.NoError(t, channels[i].Insert())
	}
	keyless := &model.Channel{
		Name: "keyless", Type: constant.ChannelTypeOpenAI, Key: "disabled-key", Status: common.ChannelStatusEnabled, Models: "keyless-model", Group: "default",
		ChannelInfo: model.ChannelInfo{IsMultiKey: true, MultiKeyStatusList: map[int]int{0: common.ChannelStatusManuallyDisabled}},
	}
	require.NoError(t, keyless.Insert())
	affinity := operation_setting.GetChannelAffinitySetting()
	oldAffinity := *affinity
	*affinity = operation_setting.ChannelAffinitySetting{Enabled: true, DefaultTTLSeconds: 60, MaxEntries: 100, Rules: []operation_setting.ChannelAffinityRule{{Name: t.Name(), ModelRegex: []string{"^gpt-4o$"}, PathRegex: []string{"^/v1/responses$"}, KeySources: []operation_setting.ChannelAffinityKeySource{{Type: "request_header", Key: "X-Route-Test"}}, IncludeRuleName: true}}}
	t.Cleanup(func() { *affinity = oldAffinity })
	for _, tc := range []struct {
		name, path, model string
		pin               filterdto.ChannelPinSource
		status, selected  int
		affinity          bool
	}{
		{name: "ordinary", path: "/v1/responses", status: http.StatusOK, selected: channels[1].Id},
		{name: "affinity cannot bypass", path: "/v1/responses", status: http.StatusOK, selected: channels[1].Id, affinity: true},
		{name: "token pin cannot bypass", path: "/v1/responses", pin: filterdto.PinSourceToken, status: http.StatusBadRequest},
		{name: "origin task pin cannot bypass new submission", path: "/v1/responses", pin: filterdto.PinSourceOriginTask, status: http.StatusBadRequest},
		{name: "all excluded", path: "/v1/messages", status: http.StatusServiceUnavailable},
		{name: "unrelated setup errors retain downstream handling", path: "/v1/chat/completions", model: "keyless-model", status: http.StatusOK, selected: keyless.Id},
	} {
		t.Run(tc.name, func(t *testing.T) {
			engine := gin.New()
			engine.POST(tc.path, middleware.BodyStorageCleanup(), func(c *gin.Context) {
				c.Set("id", user.Id)
				common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
				common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
				if tc.pin != "" {
					service.GetChannelConstraints(c).AddPin(filterdto.ChannelPin{ChannelId: channels[0].Id, Source: tc.pin})
				}
				if tc.affinity {
					service.GetPreferredChannelByAffinity(c, "gpt-4o", "default")
					service.RecordChannelAffinity(c, channels[0].Id)
					preferred, found := service.GetPreferredChannelByAffinity(c, "gpt-4o", "default")
					require.True(t, found)
					require.Equal(t, channels[0].Id, preferred)
				}
			}, middleware.Distribute(), func(c *gin.Context) {
				assert.Equal(t, tc.selected, c.GetInt("channel_id"))
				c.Status(http.StatusOK)
			})
			request := httptest.NewRequest(http.MethodPost, tc.path, strings.NewReader(fmt.Sprintf(`{"model":%q}`, common.GetStringIfEmpty(tc.model, "gpt-4o"))))
			request.Header.Set("Content-Type", "application/json")
			request.Header.Set("X-Route-Test", t.Name())
			response := httptest.NewRecorder()
			engine.ServeHTTP(response, request)
			assert.Equal(t, tc.status, response.Code, response.Body.String())
		})
	}
}

func TestChannelRouteRestrictionChannelTest(t *testing.T) {
	user, _ := setupResponsesWSRequestTest(t)
	withTieredBillingConfig(t, map[string]string{"gpt-4o": "tiered_expr"}, map[string]string{"gpt-4o": "p * 2"})
	require.NoError(t, model.DB.AutoMigrate(&model.Channel{}, &model.Ability{}))
	oldCount, oldLogs, oldDisable := constant.CountToken, common.LogConsumeEnabled, common.AutomaticDisableChannelEnabled
	constant.CountToken, common.LogConsumeEnabled, common.AutomaticDisableChannelEnabled = false, false, true
	t.Cleanup(func() {
		constant.CountToken, common.LogConsumeEnabled, common.AutomaticDisableChannelEnabled = oldCount, oldLogs, oldDisable
	})
	service.InitHttpClient()
	var calls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		assert.Equal(t, "/v1/responses", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"resp_test","object":"response","status":"completed","model":"gpt-4o","output":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":"hi"}]}],"usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}`))
	}))
	defer upstream.Close()
	channel := &model.Channel{Name: "test-restriction", Type: constant.ChannelTypeOpenAI, Key: "test", BaseURL: &upstream.URL, Status: common.ChannelStatusEnabled, Models: "gpt-4o", Group: "default", ResponseTime: 123}
	channel.SetSetting(dto.ChannelSettings{RouteRestriction: &dto.ChannelRouteRestriction{AllowedPaths: []string{"/v1/responses"}}})
	require.NoError(t, channel.Insert())
	result := testChannel(context.Background(), channel, user.Id, "gpt-4o", string(constant.EndpointTypeOpenAI), false)
	require.NotNil(t, result.newAPIError)
	assert.Equal(t, kittypes.ErrorCodeChannelRouteRestricted, result.newAPIError.GetErrorCode())
	assert.False(t, service.ShouldDisableChannel(result.newAPIError))
	assert.Zero(t, calls.Load())
	result = testChannel(context.Background(), channel, user.Id, "gpt-4o", "", false)
	require.NoError(t, result.localErr)
	require.Nil(t, result.newAPIError)
	assert.EqualValues(t, 1, calls.Load())
	channel.SetSetting(dto.ChannelSettings{RouteRestriction: &dto.ChannelRouteRestriction{AllowedPaths: []string{"/v1/audio/speech"}}})
	summary := testChannelForHealthCheck(context.Background(), channel, user.Id, true, -1)
	assert.Equal(t, channelTestSummary{Tested: 1, Failed: 1}, summary)
	var loaded model.Channel
	require.NoError(t, model.DB.First(&loaded, channel.Id).Error)
	assert.Equal(t, common.ChannelStatusEnabled, loaded.Status)
	assert.Equal(t, 123, loaded.ResponseTime)
	assert.EqualValues(t, 1, calls.Load())
	channel.Type = constant.ChannelTypeAdvancedCustom
	channel.SetSetting(dto.ChannelSettings{RouteRestriction: &dto.ChannelRouteRestriction{AllowedPaths: []string{"/v1/responses"}}})
	channel.SetOtherSettings(dto.ChannelOtherSettings{AdvancedCustom: &dto.AdvancedCustomConfig{Routes: []dto.AdvancedCustomRoute{{IncomingPath: "/v1/chat/completions", UpstreamPath: "/v1/responses"}}}})
	result = testChannel(context.Background(), channel, user.Id, "gpt-4o", "", false)
	require.NotNil(t, result.newAPIError)
	assert.Equal(t, kittypes.ErrorCodeChannelRouteRestricted, result.newAPIError.GetErrorCode())
	assert.EqualValues(t, 1, calls.Load())
}

func TestChannelRouteRestrictionOriginSubmissions(t *testing.T) {
	user, _ := setupResponsesWSRequestTest(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Channel{}, &model.Ability{}, &model.Task{}, &model.Midjourney{}))
	channel := &model.Channel{Type: constant.ChannelTypeOpenAI, Status: common.ChannelStatusEnabled, Key: "test", Group: "default", Models: "model"}
	channel.SetSetting(dto.ChannelSettings{RouteRestriction: &dto.ChannelRouteRestriction{AllowedPaths: []string{"/v1/responses"}}})
	require.NoError(t, channel.Insert())
	t.Run("video remix checks the origin channel before submitting", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos/origin/remix", strings.NewReader(`{}`))
		info := taskSubmissionRelayInfo(nil)
		info.LockedChannel = channel
		_, taskErr := executeTaskSubmissionWith(c, info, func(*gin.Context, *relaycommon.RelayInfo) (*relay.TaskSubmitResult, *filterdto.TaskError) {
			t.Fatal("a restricted origin channel must not receive a submission")
			return nil, nil
		})
		require.NotNil(t, taskErr)
		assert.Equal(t, "channel_route_restricted", taskErr.Code)
		assert.Equal(t, http.StatusBadRequest, taskErr.StatusCode)
	})
	t.Run("midjourney changes check the actual origin channel", func(t *testing.T) {
		task := &model.Midjourney{UserId: user.Id, ChannelId: channel.Id, MjId: "origin", Status: "SUCCESS", Prompt: "test"}
		require.NoError(t, model.DB.Create(task).Error)
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/mj/submit/change", strings.NewReader(`{"taskId":"origin","action":"UPSCALE","index":1}`))
		c.Request.Header.Set("Content-Type", "application/json")
		t.Cleanup(func() { common.CleanupBodyStorage(c) })
		info := &relaycommon.RelayInfo{UserId: user.Id, RelayMode: relayconstant.RelayModeMidjourneyChange}
		result := relay.RelayMidjourneySubmit(c, info)
		require.NotNil(t, result)
		assert.Equal(t, "channel_route_restricted", result.Description)
	})
}

func TestChannelRouteRestrictionWebSocket(t *testing.T) {
	var requests atomic.Int32
	fixture := newResponsesWSBillingTest(t, `p * 2`, func(ws *websocket.Conn, r *http.Request) {
		for {
			if _, _, err := ws.ReadMessage(); err != nil {
				return
			}
			requests.Add(1)
			if err := ws.WriteMessage(websocket.TextMessage, []byte(`{"type":"response.completed","response":{"id":"resp_route","status":"completed","model":"ws-billing","output":[],"usage":{"input_tokens":1000,"output_tokens":10,"total_tokens":1010}}}`)); err != nil {
				return
			}
		}
	})
	var channel model.Channel
	require.NoError(t, model.DB.First(&channel).Error)
	for _, tc := range []struct {
		path, eventType string
		requests        int32
	}{
		{"/v1/chat/completions", "error", 0},
		{"/v1/responses", "response.completed", 1},
		{"/v1/chat/completions", "error", 1},
	} {
		channel.SetSetting(dto.ChannelSettings{ResponsesWebSocketEnabled: true, RouteRestriction: &dto.ChannelRouteRestriction{AllowedPaths: []string{tc.path}}})
		require.NoError(t, model.DB.Model(&channel).Update("setting", channel.Setting).Error)
		require.NoError(t, fixture.client.WriteMessage(websocket.TextMessage, []byte(`{"type":"response.create","model":"ws-billing","input":"hi"}`)))
		event := readResponsesWSTestEvent(t, fixture.client)
		require.Equal(t, tc.eventType, event["type"], event)
		assert.Equal(t, tc.requests, requests.Load())
	}
	fixture.closeAndWait(t)
	assertResponsesWSAccounting(t, fixture, []int{1000})
}

func TestGetChannelDefaultBaseURLsUsesBuiltInDefaults(t *testing.T) {
	originalBaseURLs := constant.ChannelBaseURLs
	constant.ChannelBaseURLs = append([]string(nil), originalBaseURLs...)
	constant.ChannelBaseURLs[constant.ChannelTypeDeepSeek] = "https://deepseek.server.example"
	t.Cleanup(func() {
		constant.ChannelBaseURLs = originalBaseURLs
	})

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/channel/default_base_urls", nil)
	GetChannelDefaultBaseURLs(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Success bool           `json:"success"`
		Data    map[int]string `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	assert.Equal(t, "https://deepseek.server.example", response.Data[constant.ChannelTypeDeepSeek])
	assert.Equal(t, "https://api.openai.com", response.Data[constant.ChannelTypeOpenAI])
	assert.NotContains(t, response.Data, constant.ChannelTypeAzure)
	assert.NotContains(t, response.Data, constant.ChannelTypeNewAPI)
	assert.NotContains(t, response.Data, constant.ChannelTypeTaskPlugin)
}

func TestValidateChannelProxy(t *testing.T) {
	tests := []struct {
		name    string
		proxy   string
		wantErr bool
	}{
		{name: "empty"},
		{name: "http", proxy: "http://proxy.example:8080"},
		{name: "https", proxy: "https://proxy.example:8443"},
		{name: "socks5", proxy: "socks5://proxy.example"},
		{name: "socks5h", proxy: "socks5h://proxy.example:1080/"},
		{name: "unsupported", proxy: "ftp://proxy.example", wantErr: true},
		{name: "path", proxy: "socks5://proxy.example:1080/path", wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			setting, err := common.Marshal(dto.ChannelSettings{Proxy: test.proxy})
			require.NoError(t, err)
			channel := &model.Channel{
				Type:    constant.ChannelTypeOpenAI,
				Setting: common.GetPointer(string(setting)),
			}

			err = validateChannel(channel, false)

			if test.wantErr {
				require.ErrorContains(t, err, "invalid channel proxy")
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestValidateChannelRequiresNewAPIBaseURL(t *testing.T) {
	tests := []struct {
		name    string
		baseURL *string
		wantErr bool
	}{
		{name: "missing", wantErr: true},
		{name: "blank", baseURL: common.GetPointer("  "), wantErr: true},
		{name: "configured", baseURL: common.GetPointer("https://new-api.example")},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			channel := &model.Channel{
				Type:    constant.ChannelTypeNewAPI,
				BaseURL: test.baseURL,
			}

			err := validateChannel(channel, false)

			if test.wantErr {
				require.ErrorContains(t, err, "New API channel base URL cannot be empty")
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestNewAPIChannelRegistration(t *testing.T) {
	apiType, ok := common.ChannelType2APIType(constant.ChannelTypeNewAPI)

	require.True(t, ok)
	assert.Equal(t, constant.APITypeNewAPI, apiType)
	assert.Equal(t, "New API", constant.GetChannelTypeName(constant.ChannelTypeNewAPI))
	require.Greater(t, len(constant.ChannelBaseURLs), constant.ChannelTypeNewAPI)
	assert.Empty(t, constant.ChannelBaseURLs[constant.ChannelTypeNewAPI])
}

func TestResponsesCompactChannelSupport(t *testing.T) {
	tests := []struct {
		name        string
		channelType int
		apiType     int
		want        bool
	}{
		{name: "OpenAI", channelType: constant.ChannelTypeOpenAI, apiType: constant.APITypeOpenAI, want: true},
		{name: "Azure", channelType: constant.ChannelTypeAzure, apiType: constant.APITypeOpenAI, want: true},
		{name: "Codex", channelType: constant.ChannelTypeCodex, apiType: constant.APITypeCodex, want: true},
		{name: "Advanced Custom", channelType: constant.ChannelTypeAdvancedCustom, apiType: constant.APITypeAdvancedCustom, want: true},
		{name: "Sub2API", channelType: constant.ChannelTypeSub2API, apiType: constant.APITypeSub2API, want: true},
		{name: "New API", channelType: constant.ChannelTypeNewAPI, apiType: constant.APITypeNewAPI, want: true},
		{name: "Anthropic", channelType: constant.ChannelTypeAnthropic, apiType: constant.APITypeAnthropic, want: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.want, common.SupportsResponsesCompact(test.channelType, test.apiType))
		})
	}
}

func TestMultiprotocolGatewayEndpointTypes(t *testing.T) {
	want := []constant.EndpointType{
		constant.EndpointTypeOpenAI,
		constant.EndpointTypeOpenAIResponse,
		constant.EndpointTypeOpenAIResponseCompact,
		constant.EndpointTypeAnthropic,
		constant.EndpointTypeGemini,
		constant.EndpointTypeOpenAIAlphaSearch,
	}

	assert.Equal(t, want, common.GetEndpointTypesByChannelType(constant.ChannelTypeNewAPI, "gpt-5"))
	assert.Equal(t, want, common.GetEndpointTypesByChannelType(constant.ChannelTypeSub2API, "gpt-5"))
}

func TestCopyChannelRejectsInvalidLegacyProxySettings(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	settingBytes, err := common.Marshal(dto.ChannelSettings{
		Proxy: "socks5://proxy.example/legacy-path",
	})
	require.NoError(t, err)
	setting := string(settingBytes)
	origin := &model.Channel{
		Type:    constant.ChannelTypeOpenAI,
		Name:    "legacy proxy channel",
		Key:     "test-key",
		Models:  "gpt-test",
		Group:   "default",
		Setting: &setting,
	}
	require.NoError(t, db.Create(origin).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = gin.Params{{Key: "id", Value: fmt.Sprintf("%d", origin.Id)}}
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/copy", nil)

	CopyChannel(ctx)

	assert.Contains(t, recorder.Body.String(), "invalid channel settings")
	var channelCount int64
	require.NoError(t, db.Model(&model.Channel{}).Count(&channelCount).Error)
	assert.Equal(t, int64(1), channelCount)
}

func TestDeleteChannelResetsProxyCacheWhenPreReadFails(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Log{}, &model.AuditLog{}))
	service.ResetProxyClientCache()
	t.Cleanup(service.ResetProxyClientCache)

	proxyURL := "http://proxy.example:8080"
	beforeDelete, err := service.GetHttpClientWithProxy(proxyURL)
	require.NoError(t, err)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = gin.Params{{Key: "id", Value: "999999"}}
	ctx.Request = httptest.NewRequest(http.MethodDelete, "/api/channel/999999", nil)

	DeleteChannel(ctx)

	assert.Contains(t, recorder.Body.String(), `"success":true`)
	afterDelete, err := service.GetHttpClientWithProxy(proxyURL)
	require.NoError(t, err)
	assert.NotSame(t, beforeDelete, afterDelete)
}

func TestDeleteChannelBatchReportsAndAuditsActualDeletedCount(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Log{}, &model.AuditLog{}))
	channel := &model.Channel{Name: "existing", Key: "test-key"}
	require.NoError(t, db.Create(channel).Error)

	requestBody, err := common.Marshal(ChannelBatch{Ids: []int{channel.Id, 999999}})
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodDelete, "/api/channel/batch", bytes.NewReader(requestBody))
	ctx.Request.Header.Set("Content-Type", "application/json")

	DeleteChannelBatch(ctx)

	var response struct {
		Success bool  `json:"success"`
		Data    int64 `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success)
	assert.Equal(t, int64(1), response.Data)

	var auditLog model.AuditLog
	require.NoError(t, db.Order("id desc").First(&auditLog).Error)
	var auditData struct {
		Operation struct {
			Params map[string]any `json:"params"`
		} `json:"op"`
	}
	encodedAudit, err := common.Marshal(auditLog.Other)
	require.NoError(t, err)
	require.NoError(t, common.Unmarshal(encodedAudit, &auditData))
	assert.Equal(t, float64(1), auditData.Operation.Params["count"])
}

func TestSettleTestQuotaUsesTieredBilling(t *testing.T) {
	info := &relaycommon.RelayInfo{
		TieredBillingSnapshot: &billingexpr.BillingSnapshot{
			BillingMode:   "tiered_expr",
			ExprString:    `param("stream") == true ? tier("stream", p * 3) : tier("base", p * 2)`,
			ExprHash:      billingexpr.ExprHashString(`param("stream") == true ? tier("stream", p * 3) : tier("base", p * 2)`),
			GroupRatio:    1,
			EstimatedTier: "stream",
			QuotaPerUnit:  common.QuotaPerUnit,
			ExprVersion:   1,
		},
		BillingRequestInput: &billingexpr.RequestInput{
			Body: []byte(`{"stream":true}`),
		},
	}

	quota, result := settleTestQuota(info, types.PriceData{
		ModelRatio:      1,
		CompletionRatio: 2,
	}, &dto.Usage{
		PromptTokens: 1000,
	})

	require.Equal(t, 1500, quota)
	require.NotNil(t, result)
	require.Equal(t, "stream", result.MatchedTier)
}

func TestBuildTestLogOtherInjectsTieredInfo(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())

	info := &relaycommon.RelayInfo{
		TieredBillingSnapshot: &billingexpr.BillingSnapshot{
			BillingMode: "tiered_expr",
			ExprString:  `tier("base", p * 2)`,
		},
		ChannelMeta: &relaycommon.ChannelMeta{},
	}
	priceData := types.PriceData{
		GroupRatioInfo: types.GroupRatioInfo{GroupRatio: 1},
	}
	usage := &dto.Usage{
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens: 12,
		},
	}

	requestRules := []billingexpr.RequestRuleTrace{{
		Cond:       `param("service_tier") == "fast"`,
		Multiplier: 2,
		Matched:    true,
	}}
	other := buildTestLogOther(ctx, info, priceData, usage, &billingexpr.TieredResult{
		MatchedTier:  "base",
		RequestRules: requestRules,
	})

	fields := other.Snapshot()
	require.Equal(t, "tiered_expr", fields["billing_mode"])
	require.Equal(t, "base", fields["matched_tier"])
	require.Equal(t, requestRules, fields["request_rules"])
	require.NotEmpty(t, fields["expr_b64"])
}

func TestResolveChannelTestUserIDUsesRequestUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("id", 2)

	userID, err := resolveChannelTestUserID(ctx)

	require.NoError(t, err)
	require.Equal(t, 2, userID)
}

func TestSelectChannelsForAutomaticTestPassiveRecoveryOnlyUsesAutoDisabled(t *testing.T) {
	channels := []*model.Channel{
		{Id: 1, Status: common.ChannelStatusEnabled},
		{Id: 2, Status: common.ChannelStatusAutoDisabled},
		{Id: 3, Status: common.ChannelStatusManuallyDisabled},
	}

	selected := selectChannelsForAutomaticTest(channels, operation_setting.ChannelTestModePassiveRecovery)

	require.Len(t, selected, 1)
	require.Equal(t, 2, selected[0].Id)
}

func TestSelectChannelsForAutomaticTestScheduledSkipsManualDisabled(t *testing.T) {
	channels := []*model.Channel{
		{Id: 1, Status: common.ChannelStatusEnabled},
		{Id: 2, Status: common.ChannelStatusAutoDisabled},
		{Id: 3, Status: common.ChannelStatusManuallyDisabled},
	}

	selected := selectChannelsForAutomaticTest(channels, operation_setting.ChannelTestModeScheduledAll)

	require.Len(t, selected, 2)
	require.Equal(t, 1, selected[0].Id)
	require.Equal(t, 2, selected[1].Id)
}

func TestSelectChannelsForAutomaticTestAutoBanOnlyUsesEligibleChannels(t *testing.T) {
	autoBanEnabled := 1
	autoBanDisabled := 0
	channels := []*model.Channel{
		{Id: 1, Status: common.ChannelStatusEnabled, AutoBan: &autoBanEnabled},
		{Id: 2, Status: common.ChannelStatusEnabled, AutoBan: &autoBanDisabled},
		{Id: 3, Status: common.ChannelStatusAutoDisabled, AutoBan: &autoBanEnabled},
		{Id: 4, Status: common.ChannelStatusManuallyDisabled, AutoBan: &autoBanEnabled},
		{Id: 5, Status: common.ChannelStatusEnabled},
	}

	selected := selectChannelsForAutomaticTest(channels, operation_setting.ChannelTestModeAutoBanOnly)

	require.Len(t, selected, 2)
	require.Equal(t, 1, selected[0].Id)
	require.Equal(t, 3, selected[1].Id)
}

func TestRunChannelTestWorkersHonorsConfiguredConcurrency(t *testing.T) {
	originalInterval := common.RequestInterval
	common.RequestInterval = 0
	t.Cleanup(func() { common.RequestInterval = originalInterval })

	channels := []*model.Channel{
		{Id: 1, Status: common.ChannelStatusEnabled},
		{Id: 2, Status: common.ChannelStatusEnabled},
		{Id: 3, Status: common.ChannelStatusEnabled},
		{Id: 4, Status: common.ChannelStatusEnabled},
	}
	started := make(chan struct{}, len(channels))
	release := make(chan struct{})
	var active atomic.Int32
	var maxActive atomic.Int32
	progress := make([]int, 0, len(channels)+1)
	summaryResult := make(chan channelTestSummary, 1)

	go func() {
		summaryResult <- runChannelTestWorkers(
			context.Background(),
			channels,
			2,
			func(_ context.Context, _ *model.Channel) channelTestSummary {
				current := active.Add(1)
				defer active.Add(-1)
				for {
					observed := maxActive.Load()
					if current <= observed || maxActive.CompareAndSwap(observed, current) {
						break
					}
				}
				started <- struct{}{}
				<-release
				return channelTestSummary{Tested: 1, Succeeded: 1}
			},
			func(processed, _ int) {
				progress = append(progress, processed)
			},
		)
	}()

	<-started
	<-started
	select {
	case <-started:
		t.Fatal("started more channel tests than the configured concurrency")
	default:
	}
	close(release)

	summary := <-summaryResult

	assert.Equal(t, int32(2), maxActive.Load())
	assert.Equal(t, channelTestSummary{Tested: 4, Succeeded: 4}, summary)
	assert.Equal(t, []int{0, 1, 2, 3, 4}, progress)
}

func TestRunChannelTestWorkersStopsAfterCancellation(t *testing.T) {
	originalInterval := common.RequestInterval
	common.RequestInterval = 0
	t.Cleanup(func() { common.RequestInterval = originalInterval })

	ctx, cancel := context.WithCancel(context.Background())
	channels := []*model.Channel{
		{Id: 1, Status: common.ChannelStatusEnabled},
		{Id: 2, Status: common.ChannelStatusEnabled},
		{Id: 3, Status: common.ChannelStatusEnabled},
		{Id: 4, Status: common.ChannelStatusEnabled},
	}
	started := make(chan struct{}, len(channels))
	progress := make([]int, 0, 1)
	summaryResult := make(chan channelTestSummary, 1)

	go func() {
		summaryResult <- runChannelTestWorkers(
			ctx,
			channels,
			2,
			func(ctx context.Context, _ *model.Channel) channelTestSummary {
				started <- struct{}{}
				<-ctx.Done()
				return channelTestSummary{Tested: 1, Succeeded: 1}
			},
			func(processed, _ int) {
				progress = append(progress, processed)
			},
		)
	}()

	<-started
	<-started
	cancel()

	summary := <-summaryResult

	select {
	case <-started:
		t.Fatal("started another channel test after cancellation")
	default:
	}
	assert.Equal(t, channelTestSummary{Tested: 2, Succeeded: 2}, summary)
	assert.Equal(t, []int{0}, progress)
}

func TestTestAllChannelsRejectsExistingActiveTask(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.SystemTask{}, &model.SystemTaskLock{}))

	existing, err := model.CreateSystemTask(model.SystemTaskTypeChannelTest, nil, nil)
	require.NoError(t, err)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/test", nil)

	TestAllChannels(ctx)

	require.Equal(t, http.StatusConflict, recorder.Code)
	require.Contains(t, recorder.Body.String(), existing.TaskID)
	require.Contains(t, recorder.Body.String(), "已有通道测试任务正在运行或等待中")
}
