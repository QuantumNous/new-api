package controller

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateMultiprotocolChannelsRequireBaseURL(t *testing.T) {
	tests := []struct {
		name        string
		channelType int
		baseURL     *string
		wantErr     bool
	}{
		{name: "New API missing", channelType: constant.ChannelTypeNewAPI, wantErr: true},
		{name: "New API blank", channelType: constant.ChannelTypeNewAPI, baseURL: common.GetPointer("  "), wantErr: true},
		{name: "New API configured", channelType: constant.ChannelTypeNewAPI, baseURL: common.GetPointer("https://new-api.example")},
		{name: "Sub2API missing", channelType: constant.ChannelTypeSub2API, wantErr: true},
		{name: "Sub2API blank", channelType: constant.ChannelTypeSub2API, baseURL: common.GetPointer("  "), wantErr: true},
		{name: "Sub2API configured", channelType: constant.ChannelTypeSub2API, baseURL: common.GetPointer("https://sub2api.example")},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateChannel(&model.Channel{Type: tt.channelType, BaseURL: tt.baseURL}, false)
			if tt.wantErr {
				require.ErrorContains(t, err, "channel base URL cannot be empty")
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestUpdateChannelValidatesEffectiveMultiprotocolType(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	baseURL := "https://sub2api.example"
	channel := &model.Channel{
		Type:    constant.ChannelTypeSub2API,
		Name:    "Sub2API",
		Key:     "test-key",
		BaseURL: &baseURL,
	}
	require.NoError(t, db.Create(channel).Error)

	requestBody, err := common.Marshal(map[string]any{
		"id":       channel.Id,
		"base_url": "",
	})
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPut, "/api/channel", bytes.NewReader(requestBody))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set("id", 1)
	ctx.Set("role", common.RoleRootUser)

	UpdateChannel(ctx)

	assert.Contains(t, recorder.Body.String(), "Sub2API channel base URL cannot be empty")
	var persisted model.Channel
	require.NoError(t, db.First(&persisted, channel.Id).Error)
	require.NotNil(t, persisted.BaseURL)
	assert.Equal(t, baseURL, *persisted.BaseURL)
}

func TestCopyChannelRejectsMultiprotocolChannelWithoutBaseURL(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	channel := &model.Channel{
		Type: constant.ChannelTypeNewAPI,
		Name: "invalid New API",
		Key:  "test-key",
	}
	require.NoError(t, db.Create(channel).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = gin.Params{{Key: "id", Value: fmt.Sprintf("%d", channel.Id)}}
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/copy", nil)

	CopyChannel(ctx)

	assert.Contains(t, recorder.Body.String(), "Failed to copy channel: invalid channel settings")
	var channelCount int64
	require.NoError(t, db.Model(&model.Channel{}).Count(&channelCount).Error)
	assert.Equal(t, int64(1), channelCount)
}

func TestMultiprotocolChannelRegistration(t *testing.T) {
	want := []constant.EndpointType{
		constant.EndpointTypeOpenAI,
		constant.EndpointTypeOpenAIResponse,
		constant.EndpointTypeOpenAIResponseCompact,
		constant.EndpointTypeAnthropic,
		constant.EndpointTypeGemini,
		constant.EndpointTypeOpenAIAlphaSearch,
	}
	for _, channelType := range []int{constant.ChannelTypeSub2API, constant.ChannelTypeNewAPI} {
		apiType, ok := common.ChannelType2APIType(channelType)
		require.True(t, ok)
		assert.Equal(t, want, common.GetEndpointTypesByChannelType(channelType, "gpt-test"))
		assert.True(t, common.IsResponsesCompactAPIType(apiType))
	}
	assert.Equal(t, constant.APITypeSub2API, mustAPIType(t, constant.ChannelTypeSub2API))
	assert.Equal(t, constant.APITypeNewAPI, mustAPIType(t, constant.ChannelTypeNewAPI))
	assert.Equal(t, "Sub2API", constant.GetChannelTypeName(constant.ChannelTypeSub2API))
	assert.Equal(t, "New API", constant.GetChannelTypeName(constant.ChannelTypeNewAPI))
}

func mustAPIType(t *testing.T, channelType int) int {
	t.Helper()
	apiType, ok := common.ChannelType2APIType(channelType)
	require.True(t, ok)
	return apiType
}

func TestCopyChannelRejectsInvalidLegacyProxySettings(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	settingBytes, err := common.Marshal(dto.ChannelSettings{Proxy: "socks5://proxy.example/legacy-path"})
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
	setupModelListControllerTestDB(t)
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

func TestDeleteChannelBatchReturnsActualDeletedCount(t *testing.T) {
	db := setupModelListControllerTestDB(t)
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
}

func TestNormalizeChannelTestEndpointDetectsOpenAIImageModels(t *testing.T) {
	for _, modelName := range []string{
		"gpt-image-1",
		"gpt-image-2",
		"chatgpt-image-latest",
		"grok-imagine",
		"grok-imagine-image",
		"grok-imagine-image-quality",
		"grok-imagine-edit",
	} {
		t.Run(modelName, func(t *testing.T) {
			require.Equal(
				t,
				string(constant.EndpointTypeImageGeneration),
				normalizeChannelTestEndpoint(&model.Channel{}, modelName, ""),
			)
		})
	}
}

func TestNormalizeChannelTestEndpointPreservesExplicitEndpoint(t *testing.T) {
	require.Equal(
		t,
		string(constant.EndpointTypeOpenAI),
		normalizeChannelTestEndpoint(&model.Channel{}, "gpt-image-2", string(constant.EndpointTypeOpenAI)),
	)
}

func TestNormalizeChannelTestEndpointDetectsGrokVideoModels(t *testing.T) {
	for _, modelName := range []string{
		"grok-imagine-video",
		"grok-imagine-video-1.5",
		"  GROK-IMAGINE-VIDEO-1.5  ",
	} {
		t.Run(modelName, func(t *testing.T) {
			require.Equal(
				t,
				string(constant.EndpointTypeOpenAIVideo),
				normalizeChannelTestEndpoint(&model.Channel{}, modelName, ""),
			)
		})
	}
}

func TestChannelTestRejectsAsyncVideoWithoutSendingChatRequest(t *testing.T) {
	result := testChannel(
		context.Background(),
		&model.Channel{Type: constant.ChannelTypeOpenAI},
		1,
		"grok-imagine-video",
		"",
		false,
	)

	require.ErrorContains(t, result.localErr, "asynchronous video channel test is not supported")
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

	other := buildTestLogOther(ctx, info, priceData, usage, &billingexpr.TieredResult{
		MatchedTier: "base",
	})

	require.Equal(t, "tiered_expr", other["billing_mode"])
	require.Equal(t, "base", other["matched_tier"])
	require.NotEmpty(t, other["expr_b64"])
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
