package ali

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	rootconstant "github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/constant"
	relayhelper "github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestConvertOpenAIRequestFiltersThinkingBudgetByUpstreamModel(t *testing.T) {
	tests := []struct {
		name          string
		requestModel  string
		upstreamModel string
		budget        string
		wantBudget    bool
		wantValue     int64
	}{
		{
			name:          "qwen",
			requestModel:  "qwen-plus",
			upstreamModel: "qwen-plus",
			budget:        "128",
			wantBudget:    true,
			wantValue:     128,
		},
		{
			name:          "qwq explicit zero",
			requestModel:  "qwq-32b",
			upstreamModel: "qwq-32b",
			budget:        "0",
			wantBudget:    true,
			wantValue:     0,
		},
		{
			name:          "unsupported upstream overrides qwen request",
			requestModel:  "qwen-plus",
			upstreamModel: "deepseek-r1",
			budget:        "128",
			wantBudget:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			request := &dto.GeneralOpenAIRequest{
				Model:          tt.requestModel,
				EnableThinking: json.RawMessage(`true`),
				ThinkingBudget: json.RawMessage(tt.budget),
			}
			info := &relaycommon.RelayInfo{
				ChannelMeta: &relaycommon.ChannelMeta{
					UpstreamModelName: tt.upstreamModel,
				},
			}

			convertedValue, err := (&Adaptor{}).ConvertOpenAIRequest(nil, info, request)
			require.NoError(t, err)
			converted, ok := convertedValue.(*dto.GeneralOpenAIRequest)
			require.True(t, ok)

			if tt.wantBudget {
				assert.Equal(t, tt.budget, string(converted.ThinkingBudget))
			} else {
				assert.Nil(t, converted.ThinkingBudget)
			}

			encoded, err := common.Marshal(converted)
			require.NoError(t, err)

			assert.True(t, gjson.GetBytes(encoded, "enable_thinking").Bool())
			value := gjson.GetBytes(encoded, "thinking_budget")
			assert.Equal(t, tt.wantBudget, value.Exists())
			if tt.wantBudget {
				assert.Equal(t, tt.wantValue, value.Int())
			}
		})
	}
}

func TestConvertOpenAIRequestPreservesExplicitZeroForMappedQwenModel(t *testing.T) {
	const (
		clientModel   = "customer-model"
		upstreamModel = "Qwen/Qwen3-235B-A22B-Thinking-2507"
	)

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set("model_mapping", `{"customer-model":"Qwen/Qwen3-235B-A22B-Thinking-2507"}`)

	request := &dto.GeneralOpenAIRequest{
		Model:          clientModel,
		EnableThinking: json.RawMessage(`true`),
		ThinkingBudget: json.RawMessage(`0`),
	}
	info := &relaycommon.RelayInfo{
		OriginModelName: clientModel,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: clientModel,
		},
	}

	err := relayhelper.ModelMappedHelper(c, info, request)
	require.NoError(t, err)
	assert.True(t, info.IsModelMapped)
	assert.Equal(t, upstreamModel, info.UpstreamModelName)
	assert.Equal(t, upstreamModel, request.Model)

	convertedValue, err := (&Adaptor{}).ConvertOpenAIRequest(c, info, request)
	require.NoError(t, err)
	converted, ok := convertedValue.(*dto.GeneralOpenAIRequest)
	require.True(t, ok)
	assert.Equal(t, json.RawMessage(`0`), converted.ThinkingBudget)

	encoded, err := common.Marshal(converted)
	require.NoError(t, err)

	value := gjson.GetBytes(encoded, "thinking_budget")
	assert.True(t, value.Exists())
	assert.Equal(t, int64(0), value.Int())
}

func TestMappedAliImageModelUsesUpstreamProtocol(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)

	info := &relaycommon.RelayInfo{
		RelayMode:       constant.RelayModeImagesGenerations,
		OriginModelName: "customer-image-model",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    "https://dashscope.aliyuncs.com",
			UpstreamModelName: "qwen-image-3.0-pro",
		},
	}

	adaptor := &Adaptor{}
	url, err := adaptor.GetRequestURL(info)
	require.NoError(t, err)
	assert.Equal(t, "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation", url)

	header := http.Header{}
	require.NoError(t, adaptor.SetupRequestHeader(c, &header, info))
	assert.Empty(t, header.Get("X-DashScope-Async"))

	converted, err := adaptor.ConvertImageRequest(c, info, dto.ImageRequest{
		Model:  info.UpstreamModelName,
		Prompt: "poster",
	})
	require.NoError(t, err)
	assert.True(t, adaptor.IsSyncImageModel)
	assert.IsType(t, &AliImageRequest{}, converted)
}

func TestAliImageHandlerHonorsRequestResponseFormat(t *testing.T) {
	imageBytes := []byte("ali-image")
	var downloads atomic.Int32
	imageServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		downloads.Add(1)
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write(imageBytes)
	}))
	t.Cleanup(imageServer.Close)

	fetchSetting := system_setting.GetFetchSetting()
	require.NotNil(t, fetchSetting)
	originalFetchSetting := *fetchSetting
	fetchSetting.EnableSSRFProtection = false
	t.Cleanup(func() {
		*fetchSetting = originalFetchSetting
	})
	originalMaxFileDownloadMB := rootconstant.MaxFileDownloadMB
	rootconstant.MaxFileDownloadMB = 1
	t.Cleanup(func() {
		rootconstant.MaxFileDownloadMB = originalMaxFileDownloadMB
	})
	service.InitHttpClient()

	tests := []struct {
		name           string
		responseFormat string
		wantBase64     string
		wantDownloads  int32
	}{
		{
			name:           "base64",
			responseFormat: "b64_json",
			wantBase64:     base64.StdEncoding.EncodeToString(imageBytes),
			wantDownloads:  1,
		},
		{
			name:           "url",
			responseFormat: "url",
		},
		{
			name: "default",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			downloads.Store(0)
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			info := &relaycommon.RelayInfo{
				RelayMode: constant.RelayModeImagesGenerations,
				StartTime: time.Unix(1, 0),
				Request: &dto.ImageRequest{
					ResponseFormat: tt.responseFormat,
				},
			}
			responseBody := fmt.Sprintf(`{"output":{"results":[{"url":%q}]}}`, imageServer.URL)
			resp := &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{},
				Body:       io.NopCloser(strings.NewReader(responseBody)),
			}

			newAPIError, usage := aliImageHandler(&Adaptor{IsSyncImageModel: true}, c, resp, info)
			require.Nil(t, newAPIError)
			require.NotNil(t, usage)

			var imageResponse dto.ImageResponse
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &imageResponse))
			require.Len(t, imageResponse.Data, 1)
			assert.Equal(t, imageServer.URL, imageResponse.Data[0].Url)
			assert.Equal(t, tt.wantBase64, imageResponse.Data[0].B64Json)
			assert.Equal(t, tt.wantDownloads, downloads.Load())
		})
	}
}
