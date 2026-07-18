package ali

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOAIImage2AliImageRequestRejectsInvalidParametersN(t *testing.T) {
	t.Parallel()

	wantError := fmt.Sprintf("parameters.n must be an integer between 1 and %d", dto.MaxImageN)
	tests := []struct {
		name string
		n    string
	}{
		{name: "zero", n: "0"},
		{name: "negative", n: "-1"},
		{name: "above maximum", n: fmt.Sprintf("%d", dto.MaxImageN+1)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			request := dto.ImageRequest{
				Model:  "wan2.6-t2i",
				Prompt: "a lighthouse",
				Extra: map[string]json.RawMessage{
					"parameters": json.RawMessage(fmt.Sprintf(`{"n":%s}`, tt.n)),
				},
			}

			_, err := oaiImage2AliImageRequest(&relaycommon.RelayInfo{}, request, false)

			require.Error(t, err)
			require.Contains(t, err.Error(), wantError)
		})
	}
}

func TestOAIImage2AliImageRequestAllowsParametersWithoutN(t *testing.T) {
	t.Parallel()

	request := dto.ImageRequest{
		Model:  "wan2.6-t2i",
		Prompt: "a lighthouse",
		Extra: map[string]json.RawMessage{
			"parameters": json.RawMessage(`{"size":"1024*1024"}`),
		},
	}

	converted, err := oaiImage2AliImageRequest(&relaycommon.RelayInfo{}, request, false)
	require.NoError(t, err)
	require.Equal(t, "1024*1024", converted.Parameters.Size)
}

func TestOAIImage2AliImageRequestMapsUnifiedImagesForSyncModels(t *testing.T) {
	request := dto.ImageRequest{
		Model:  "qwen-image-edit-plus",
		Prompt: "keep the subject",
		Images: json.RawMessage(`["https://cdn.example.com/inputs/source.png"]`),
		Extra:  map[string]json.RawMessage{},
	}

	converted, err := oaiImage2AliImageRequest(&relaycommon.RelayInfo{}, request, true)
	require.NoError(t, err)
	input, ok := converted.Input.(AliImageInput)
	require.True(t, ok)
	require.Len(t, input.Messages, 1)
	content, ok := input.Messages[0].Content.([]AliMediaContent)
	require.True(t, ok)
	require.Len(t, content, 2)
	assert.Equal(t, "https://cdn.example.com/inputs/source.png", content[0].Image)
	assert.Equal(t, "keep the subject", content[1].Text)
}

func TestOAIImage2AliImageRequestRejectsUnifiedImagesForTextOnlyModels(t *testing.T) {
	request := dto.ImageRequest{
		Model:  "wanx-v1",
		Prompt: "draw",
		Images: json.RawMessage(`["https://cdn.example.com/inputs/source.png"]`),
		Extra:  map[string]json.RawMessage{},
	}

	_, err := oaiImage2AliImageRequest(&relaycommon.RelayInfo{}, request, false)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "does not support unified image inputs")
}

func TestAdaptorInitRestoresPreparedSyncImageMode(t *testing.T) {
	adaptor := &Adaptor{}
	adaptor.Init(&relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeImagesGenerations,
		OriginModelName: "z-image-turbo",
	})
	assert.True(t, adaptor.IsSyncImageModel)
}

func TestAdaptorUsesMappedUpstreamModelForImageRouting(t *testing.T) {
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeImagesGenerations,
		OriginModelName: "public-image-alias",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "qwen-image-edit-plus",
			ChannelBaseUrl:    "https://dashscope.example.com",
		},
	}
	adaptor := &Adaptor{}
	adaptor.Init(info)
	require.True(t, adaptor.IsSyncImageModel)

	requestURL, err := adaptor.GetRequestURL(info)
	require.NoError(t, err)
	assert.Equal(t, "https://dashscope.example.com/api/v1/services/aigc/multimodal-generation/generation", requestURL)

	converted, err := adaptor.ConvertImageRequest(testAliImageContext(), info, dto.ImageRequest{
		Model:  "qwen-image-edit-plus",
		Prompt: "keep the subject",
		Images: json.RawMessage(`["https://private.example.com/source.png"]`),
		Extra:  map[string]json.RawMessage{},
	})
	require.NoError(t, err)
	aliRequest, ok := converted.(*AliImageRequest)
	require.True(t, ok)
	input, ok := aliRequest.Input.(AliImageInput)
	require.True(t, ok)
	require.Len(t, input.Messages, 1)
}

func testAliImageContext() *gin.Context {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	return c
}

func TestAsyncTaskWaitStopsWhenWorkerContextIsCanceled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil).WithContext(ctx)

	_, _, err := asyncTaskWait(c, &relaycommon.RelayInfo{}, "task-id")
	require.ErrorIs(t, err, context.Canceled)
}
