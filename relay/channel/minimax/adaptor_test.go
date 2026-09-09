package minimax

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGetRequestURLForImageGeneration(t *testing.T) {
	t.Parallel()

	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesGenerations,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://api.minimax.chat",
		},
	}

	got, err := GetRequestURL(info)
	require.NoError(t, err)

	want := "https://api.minimax.chat/v1/image_generation"
	require.Equal(t, want, got)
}

func TestConvertImageRequest(t *testing.T) {
	t.Parallel()

	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeImagesGenerations,
		OriginModelName: "image-01",
	}
	n := uint(2)
	request := dto.ImageRequest{
		Model:          "image-01",
		Prompt:         "a red fox in snowfall",
		Size:           "1536x1024",
		ResponseFormat: "url",
		N:              &n,
	}

	got, err := adaptor.ConvertImageRequest(gin.CreateTestContextOnly(httptest.NewRecorder(), gin.New()), info, request)
	require.NoError(t, err)

	body, err := common.Marshal(got)
	require.NoError(t, err)

	var payload map[string]any
	require.NoError(t, common.Unmarshal(body, &payload))

	require.Equal(t, "image-01", payload["model"])
	require.Equal(t, request.Prompt, payload["prompt"])
	require.Equal(t, float64(2), payload["n"])
	require.Equal(t, "3:2", payload["aspect_ratio"])
	require.Equal(t, "url", payload["response_format"])
}

func TestDoResponseForImageGeneration(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)

	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesGenerations,
		StartTime: time.Unix(1700000000, 0),
	}
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(`{"data":{"image_urls":["https://example.com/minimax.png"]}}`)),
	}

	adaptor := &Adaptor{}
	usage, err := adaptor.DoResponse(c, resp, info)
	require.Nil(t, err)
	require.NotNil(t, usage)

	body := recorder.Body.String()
	require.Contains(t, body, `"url":"https://example.com/minimax.png"`)
	require.NotContains(t, body, `"image_urls"`)
}
