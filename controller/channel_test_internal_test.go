package controller

import (
	"bytes"
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
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

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

func TestNormalizeChannelTestEndpointVolcEngineModels(t *testing.T) {
	channel := &model.Channel{Type: constant.ChannelTypeVolcEngine}

	require.Equal(t, "", normalizeChannelTestEndpoint(channel, "doubao-seed-2-0-pro-260215", ""))
	require.Equal(t, string(constant.EndpointTypeEmbeddings), normalizeChannelTestEndpoint(channel, "doubao-embedding-text-240715", ""))
	require.Equal(t, string(constant.EndpointTypeEmbeddings), normalizeChannelTestEndpoint(channel, "doubao-embedding-vision-251215", ""))
	require.Equal(t, string(constant.EndpointTypeImageGeneration), normalizeChannelTestEndpoint(channel, "doubao-seedream-5-0-260128", ""))
	require.Equal(t, string(constant.EndpointTypeImageGeneration), normalizeChannelTestEndpoint(channel, "doubao-seededit-3-0-i2i-250628", ""))
	require.Equal(t, string(constant.EndpointTypeOpenAIVideo), normalizeChannelTestEndpoint(channel, "doubao-seedance-2-0-fast-260128", ""))
	require.Equal(t, string(constant.EndpointTypeOpenAIVideo), normalizeChannelTestEndpoint(channel, "wan2-1-14b-i2v-250225", ""))
	require.Equal(t, string(constant.EndpointTypeOpenAIVideo), normalizeChannelTestEndpoint(channel, "doubao-seed3d-2-0-260328", ""))
	require.Equal(t, string(constant.EndpointTypeOpenAIVideo), normalizeChannelTestEndpoint(channel, "hyper3d-gen2-260112", ""))
	require.Equal(t, string(constant.EndpointTypeOpenAI), normalizeChannelTestEndpoint(channel, "doubao-seedream-5-0-260128", string(constant.EndpointTypeOpenAI)))
}

func TestBuildTestVideoRequestVolcEngineModels(t *testing.T) {
	channel := &model.Channel{Type: constant.ChannelTypeVolcEngine}

	req := buildTestVideoRequest("doubao-seedance-2-0-fast-260128", channel).(*relaycommon.TaskSubmitReq)
	require.Equal(t, "doubao-seedance-2-0-fast-260128", req.Model)
	require.Equal(t, "5", req.Seconds)
	require.Equal(t, "1280x720", req.Size)

	req = buildTestVideoRequest("wan2-1-14b-i2v-250225", channel).(*relaycommon.TaskSubmitReq)
	require.NotEmpty(t, req.Image)

	req = buildTestVideoRequest("wan2-1-14b-flf2v-250417", channel).(*relaycommon.TaskSubmitReq)
	require.Len(t, req.Images, 2)

	req = buildTestVideoRequest("doubao-seed3d-2-0-260328", channel).(*relaycommon.TaskSubmitReq)
	require.NotEmpty(t, req.Image)
	require.Contains(t, req.Prompt, "3D")
}

func TestBuildTestRequestGeneralEndpointTemplates(t *testing.T) {
	for _, endpointType := range []string{
		string(constant.EndpointTypeImageEdit),
		string(constant.EndpointTypeVideoEdit),
		string(constant.EndpointTypeVideoExtension),
		string(constant.EndpointTypeAudioSpeech),
		string(constant.EndpointTypeAudioTranscription),
		string(constant.EndpointTypeAudioTranslation),
		string(constant.EndpointTypeModerations),
	} {
		req := buildTestRequest("test-model", endpointType, nil, false)
		require.NotNil(t, req, endpointType)
	}

	_, ok := buildTestRequest("test-model", string(constant.EndpointTypeGeminiEmbeddings), nil, false).(*dto.EmbeddingRequest)
	require.True(t, ok)
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
