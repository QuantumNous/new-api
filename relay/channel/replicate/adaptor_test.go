package replicate

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConvertImageRequestNativeInputIsAuthoritative(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)

	n := uint(2)
	request := dto.ImageRequest{
		Model:        "public-model-name",
		Prompt:       "outer prompt",
		N:            &n,
		Size:         "1792x1024",
		Quality:      "high",
		OutputFormat: []byte(`"jpeg"`),
		Extra: map[string]json.RawMessage{
			"input": []byte(`{
				"prompt":"native prompt",
				"input_images":["data:image/png;base64,abc","data:image/png;base64,def"],
				"number_of_images":2,
				"aspect_ratio":"16:9",
				"quality":"low",
				"output_format":"png"
			}`),
		},
	}
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesGenerations,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "openai/gpt-image-2",
		},
	}

	copiedRequest, err := common.DeepCopy(&request)
	require.NoError(t, err)
	converted, err := (&Adaptor{}).ConvertImageRequest(c, info, *copiedRequest)
	require.NoError(t, err)
	payload, ok := converted.(map[string]any)
	require.True(t, ok)
	input, ok := payload["input"].(map[string]any)
	require.True(t, ok)

	assert.Equal(t, "native prompt", input["prompt"])
	assert.Equal(t, float64(2), input["number_of_images"])
	assert.Equal(t, "16:9", input["aspect_ratio"])
	assert.Equal(t, "low", input["quality"])
	assert.Equal(t, "png", input["output_format"])
	assert.NotContains(t, input, "num_outputs")
	assert.NotContains(t, input, "prompt_upsampling")
	assert.NotContains(t, input, "image_prompt")
	assert.Equal(t, "/v1/models/openai/gpt-image-2/predictions", info.RequestURLPath)
}

func TestConvertImageRequestNativeInputCanProvidePrompt(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name        string
		outerPrompt string
		nativeInput string
		wantPrompt  string
	}{
		{
			name:        "native prompt supports absent outer prompt",
			nativeInput: `{"prompt":"native prompt","quality":"high"}`,
			wantPrompt:  "native prompt",
		},
		{
			name:        "outer prompt fills missing native prompt",
			outerPrompt: "outer prompt",
			nativeInput: `{"quality":"high"}`,
			wantPrompt:  "outer prompt",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)

			converted, err := (&Adaptor{}).ConvertImageRequest(c, &relaycommon.RelayInfo{
				ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "custom/model"},
			}, dto.ImageRequest{
				Prompt: tt.outerPrompt,
				Extra: map[string]json.RawMessage{
					"input": []byte(tt.nativeInput),
				},
			})
			require.NoError(t, err)

			payload, ok := converted.(map[string]any)
			require.True(t, ok)
			input, ok := payload["input"].(map[string]any)
			require.True(t, ok)
			assert.Equal(t, tt.wantPrompt, input["prompt"])
		})
	}
}

func TestConvertImageRequestRejectsUnreconciledNativeCount(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)

	n := uint(3)
	_, err := (&Adaptor{}).ConvertImageRequest(c, &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{},
	}, dto.ImageRequest{
		Model:  "openai/gpt-image-2",
		Prompt: "a cat",
		N:      &n,
		Extra: map[string]json.RawMessage{
			"input": []byte(`{"quality":"high"}`),
		},
	})

	require.EqualError(t, err, "replicate adaptor: n greater than 1 requires input.number_of_images or input.num_outputs")
}

func TestConvertImageRequestLegacyFluxMappingRemainsCompatible(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)

	n := uint(2)
	converted, err := (&Adaptor{}).ConvertImageRequest(c, &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesGenerations,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: ModelFlux11Pro,
		},
	}, dto.ImageRequest{
		Prompt:  "a cat",
		N:       &n,
		Size:    "1792x1024",
		Quality: "high",
	})
	require.NoError(t, err)
	payload, ok := converted.(map[string]any)
	require.True(t, ok)
	input, ok := payload["input"].(map[string]any)
	require.True(t, ok)

	assert.Equal(t, "a cat", input["prompt"])
	assert.Equal(t, 2, input["num_outputs"])
	assert.Equal(t, "16:9", input["aspect_ratio"])
	assert.Equal(t, true, input["prompt_upsampling"])
}
