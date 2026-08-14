package controller

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	relaytypes "github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

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

func TestValidateChannelCapacityRatioBounds(t *testing.T) {
	base := func() *model.Channel {
		return &model.Channel{
			Name:   "bounds-test",
			Type:   constant.ChannelTypeOpenAI,
			Key:    "sk-test",
			Models: "gpt-4o",
		}
	}

	t.Run("add applies defaults for unset fields", func(t *testing.T) {
		channel := base()
		require.NoError(t, validateChannel(channel, true))
		assert.Equal(t, model.DefaultChannelCapacityTotal, channel.CapacityTotal)
		assert.Equal(t, model.DefaultChannelRatio, channel.ChannelRatio)
		assert.Equal(t, model.DefaultChannelRatio, channel.UpstreamRatio)
	})

	t.Run("update keeps zero as unset", func(t *testing.T) {
		channel := base()
		require.NoError(t, validateChannel(channel, false))
		assert.Zero(t, channel.CapacityTotal)
		assert.Zero(t, channel.ChannelRatio)
		assert.Zero(t, channel.UpstreamRatio)
	})

	outOfRange := []struct {
		name   string
		mutate func(*model.Channel)
	}{
		{name: "negative capacity", mutate: func(c *model.Channel) { c.CapacityTotal = -1 }},
		{name: "capacity above max", mutate: func(c *model.Channel) { c.CapacityTotal = model.MaxChannelCapacityTotal + 1 }},
		{name: "negative channel ratio", mutate: func(c *model.Channel) { c.ChannelRatio = -0.5 }},
		{name: "channel ratio above max", mutate: func(c *model.Channel) { c.ChannelRatio = model.MaxChannelRatio + 1 }},
		{name: "negative upstream ratio", mutate: func(c *model.Channel) { c.UpstreamRatio = -1 }},
		{name: "upstream ratio above max", mutate: func(c *model.Channel) { c.UpstreamRatio = model.MaxChannelRatio + 1 }},
	}
	for _, test := range outOfRange {
		t.Run(test.name+" rejected on add", func(t *testing.T) {
			channel := base()
			test.mutate(channel)
			assert.Error(t, validateChannel(channel, true))
		})
		t.Run(test.name+" rejected on update", func(t *testing.T) {
			channel := base()
			test.mutate(channel)
			assert.Error(t, validateChannel(channel, false))
		})
	}
}

func TestValidateChannelNormalizesEmptyGroupOnAdd(t *testing.T) {
	base := func() *model.Channel {
		return &model.Channel{
			Name:   "group-test",
			Type:   constant.ChannelTypeOpenAI,
			Key:    "sk-test",
			Models: "gpt-4o",
		}
	}

	t.Run("empty group defaults on add", func(t *testing.T) {
		channel := base()
		require.NoError(t, validateChannel(channel, true))
		assert.Equal(t, "default", channel.Group)
	})

	t.Run("blank group defaults on add", func(t *testing.T) {
		channel := base()
		channel.Group = "  "
		require.NoError(t, validateChannel(channel, true))
		assert.Equal(t, "default", channel.Group)
	})

	t.Run("custom group preserved on add", func(t *testing.T) {
		channel := base()
		channel.Group = "vip"
		require.NoError(t, validateChannel(channel, true))
		assert.Equal(t, "vip", channel.Group)
	})

	t.Run("update keeps empty group as unset", func(t *testing.T) {
		channel := base()
		require.NoError(t, validateChannel(channel, false))
		assert.Empty(t, channel.Group)
	})
}

// The next frontend rejects success envelopes without a data key, so channel
// creation must echo the created count as data.
func TestAddChannelSuccessEnvelopeIncludesData(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Log{}))

	requestBody, err := common.Marshal(AddChannelRequest{
		Mode: "single",
		Channel: &model.Channel{
			Name:   "envelope-test",
			Type:   constant.ChannelTypeOpenAI,
			Key:    "sk-test",
			Models: "gpt-4o",
		},
	})
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/next/admin/channels", bytes.NewReader(requestBody))
	ctx.Request.Header.Set("Content-Type", "application/json")

	AddChannel(ctx)

	var response struct {
		Success bool `json:"success"`
		Data    *int `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success)
	require.NotNil(t, response.Data, "success envelope must include data")
	assert.Equal(t, 1, *response.Data)
}

func TestNewAPIChannelRegistration(t *testing.T) {
	apiType, ok := common.ChannelType2APIType(constant.ChannelTypeNewAPI)

	require.True(t, ok)
	assert.Equal(t, constant.APITypeNewAPI, apiType)
	assert.Equal(t, "New API", constant.GetChannelTypeName(constant.ChannelTypeNewAPI))
	require.Greater(t, len(constant.ChannelBaseURLs), constant.ChannelTypeNewAPI)
	assert.Empty(t, constant.ChannelBaseURLs[constant.ChannelTypeNewAPI])
}

func TestResponsesCompactAPITypeSupport(t *testing.T) {
	tests := []struct {
		name    string
		apiType int
		want    bool
	}{
		{name: "OpenAI", apiType: constant.APITypeOpenAI, want: true},
		{name: "Codex", apiType: constant.APITypeCodex, want: true},
		{name: "Advanced Custom", apiType: constant.APITypeAdvancedCustom, want: true},
		{name: "Sub2API", apiType: constant.APITypeSub2API, want: true},
		{name: "New API", apiType: constant.APITypeNewAPI, want: true},
		{name: "Anthropic", apiType: constant.APITypeAnthropic, want: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.want, common.IsResponsesCompactAPIType(test.apiType))
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
	require.NoError(t, db.AutoMigrate(&model.Log{}))
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
	assert.Contains(t, recorder.Body.String(), `"data":{"id":999999}`)
	afterDelete, err := service.GetHttpClientWithProxy(proxyURL)
	require.NoError(t, err)
	assert.NotSame(t, beforeDelete, afterDelete)
}

func TestDeleteChannelBatchReportsAndAuditsActualDeletedCount(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Log{}))
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

	var auditLog model.Log
	require.NoError(t, db.Order("id desc").First(&auditLog).Error)
	var auditData struct {
		Operation struct {
			Params map[string]any `json:"params"`
		} `json:"op"`
	}
	require.NoError(t, common.UnmarshalJsonStr(auditLog.Other, &auditData))
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

func TestWriteChannelTestResponseContract(t *testing.T) {
	tests := []struct {
		name        string
		result      testResult
		wantSuccess bool
		wantData    bool
	}{
		{name: "success", wantSuccess: true, wantData: true},
		{
			name: "upstream failure",
			result: testResult{newAPIError: relaytypes.NewOpenAIError(
				errors.New("upstream failed"),
				relaytypes.ErrorCodeBadResponse,
				http.StatusBadGateway,
			)},
			wantData: true,
		},
		{
			name:   "local failure",
			result: testResult{localErr: errors.New("unsupported channel")},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)

			writeChannelTestResponse(ctx, test.result, 0.261, 261, 1_725_000_000)

			require.Equal(t, http.StatusOK, recorder.Code)
			var response map[string]any
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
			require.Equal(t, test.wantSuccess, response["success"])
			data, hasData := response["data"].(map[string]any)
			require.Equal(t, test.wantData, hasData)
			if !test.wantData {
				return
			}
			require.Equal(t, float64(261), data["response_time"])
			require.Equal(t, float64(1_725_000_000), data["test_time"])
			require.Equal(t, 0.261, data["time"])
		})
	}
}

func TestUpdateResponseTimePersistsBeforeReturning(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	channel := &model.Channel{
		Id:     42,
		Name:   "response-time-test",
		Type:   constant.ChannelTypeOpenAI,
		Key:    "test-key",
		Models: "gpt-4o",
	}
	require.NoError(t, db.Create(channel).Error)

	require.NoError(t, channel.UpdateResponseTime(261))
	require.NotZero(t, channel.TestTime)

	var stored model.Channel
	require.NoError(t, db.First(&stored, channel.Id).Error)
	require.Equal(t, 261, stored.ResponseTime)
	require.Equal(t, channel.TestTime, stored.TestTime)
}

func TestPerformChannelTestsReturnsResponseTimePersistenceError(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	callbackName := "test:fail-channel-response-time-update"
	require.NoError(t, db.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table == "channels" {
			tx.AddError(errors.New("forced response-time write failure"))
		}
	}))
	t.Cleanup(func() {
		_ = db.Callback().Update().Remove(callbackName)
	})

	summary, err := performChannelTests(context.Background(), []*model.Channel{{
		Id:   43,
		Name: "unsupported-test-channel",
		Type: constant.ChannelTypeMidjourney,
	}}, 1, false, nil)

	require.ErrorContains(t, err, "persist channel 43 response time")
	require.ErrorContains(t, err, "forced response-time write failure")
	assert.Equal(t, 1, summary.Tested)
	assert.Equal(t, 0, summary.Succeeded)
	assert.Equal(t, 1, summary.Failed)
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
