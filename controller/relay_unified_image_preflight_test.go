package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRelayRejectsNonCanonicalImageGenerationBeforeBilling(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tests := []struct {
		name          string
		path          string
		body          string
		model         string
		modelMapping  string
		paramOverride map[string]any
		channelType   int
		format        types.RelayFormat
	}{
		{
			name:   "responses image generation tool",
			path:   "/v1/responses",
			body:   `{"model":"gpt-5","input":"draw a cat","tools":[{"type":"image_generation"}]}`,
			model:  "gpt-5",
			format: types.RelayFormatOpenAIResponses,
		},
		{
			name:   "chat google image config",
			path:   "/v1/chat/completions",
			body:   `{"model":"gpt-5","messages":[{"role":"user","content":"draw a cat"}],"extra_body":{"google":{"image_config":{"aspect_ratio":"1:1"}}}}`,
			model:  "gpt-5",
			format: types.RelayFormatOpenAI,
		},
		{
			name:         "mapped chat image model",
			path:         "/v1/chat/completions",
			body:         `{"model":"public-image-alias","messages":[{"role":"user","content":"draw a cat"}]}`,
			model:        "public-image-alias",
			modelMapping: `{"public-image-alias":"nano-banana-2"}`,
			format:       types.RelayFormatOpenAI,
		},
		{
			name:   "gemini conflicting modality aliases",
			path:   "/v1beta/models/gemini-2.5-flash:generateContent",
			body:   `{"contents":[{"role":"user","parts":[{"text":"draw a cat"}]}],"generationConfig":{"responseModalities":["IMAGE"],"response_modalities":["TEXT"]}}`,
			model:  "gemini-2.5-flash",
			format: types.RelayFormatGemini,
		},
		{
			name:   "gemini image modality",
			path:   "/v1beta/models/gemini-2.5-flash:generateContent",
			body:   `{"contents":[{"role":"user","parts":[{"text":"draw a cat"}]}],"generationConfig":{"responseModalities":["IMAGE"]}}`,
			model:  "gemini-2.5-flash",
			format: types.RelayFormatGemini,
		},
		{
			name:         "channel override copies converted provider field into image config",
			path:         "/v1/chat/completions",
			body:         `{"model":"gpt-5","messages":[{"role":"user","content":"hello"}]}`,
			model:        "gpt-5",
			modelMapping: `{"gpt-5":"gemini-2.5-flash"}`,
			paramOverride: map[string]any{
				"operations": []any{map[string]any{
					"mode": "copy",
					"from": "contents",
					"to":   "generationConfig.imageConfig",
				}},
			},
			channelType: constant.ChannelTypeGemini,
			format:      types.RelayFormatOpenAI,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPost, test.path, strings.NewReader(test.body))
			c.Request.Header.Set("Content-Type", "application/json")
			common.SetContextKey(c, constant.ContextKeyOriginalModel, test.model)
			if test.modelMapping != "" {
				common.SetContextKey(c, constant.ContextKeyChannelModelMapping, test.modelMapping)
			}
			if len(test.paramOverride) > 0 {
				common.SetContextKey(c, constant.ContextKeyChannelParamOverride, test.paramOverride)
			}
			if test.channelType > 0 {
				common.SetContextKey(c, constant.ContextKeyChannelType, test.channelType)
			}

			Relay(c, test.format)

			require.Equal(t, http.StatusBadRequest, recorder.Code, recorder.Body.String())
			assert.Contains(t, recorder.Body.String(), "POST /v1/images/generations")
		})
	}
}
