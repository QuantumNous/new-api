package ali

import (
	"encoding/base64"
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
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

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
