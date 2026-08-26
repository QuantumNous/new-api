package xai

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetRequestURLUsesOfficialXAIImageEndpoints(t *testing.T) {
	tests := []struct {
		name      string
		relayMode int
		inputPath string
		want      string
	}{
		{
			name:      "generation",
			relayMode: relayconstant.RelayModeImagesGenerations,
			inputPath: "/custom/images/generate",
			want:      "https://api.x.ai/v1/images/generations",
		},
		{
			name:      "edit legacy alias",
			relayMode: relayconstant.RelayModeImagesEdits,
			inputPath: "/v1/edits",
			want:      "https://api.x.ai/v1/images/edits",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			info := &relaycommon.RelayInfo{
				ChannelMeta:    &relaycommon.ChannelMeta{ChannelBaseUrl: "https://api.x.ai/"},
				RelayMode:      test.relayMode,
				RequestURLPath: test.inputPath,
			}

			requestURL, err := (&Adaptor{}).GetRequestURL(info)

			require.NoError(t, err)
			assert.Equal(t, test.want, requestURL)
		})
	}
}

func TestConvertImageRequestPreservesOfficialXAIEditPayload(t *testing.T) {
	gin.SetMode(gin.TestMode)
	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	context.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", nil)
	context.Request.Header.Set("Content-Type", "application/json")
	imageCount := uint(2)
	request := dto.ImageRequest{
		Model:          "grok-imagine-image-2.0",
		Prompt:         "Render this as a pencil sketch",
		N:              &imageCount,
		ResponseFormat: "url",
		Quality:        "medium",
		Image:          json.RawMessage(`{"type":"image_url","url":"https://example.com/source.png"}`),
		Extra: map[string]json.RawMessage{
			"aspect_ratio": json.RawMessage(`"16:9"`),
			"resolution":   json.RawMessage(`"2k"`),
		},
	}

	converted, err := (&Adaptor{}).ConvertImageRequest(context, &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesEdits}, request)

	require.NoError(t, err)
	requestBody, err := common.Marshal(converted)
	require.NoError(t, err)
	assert.JSONEq(t, `{
		"model":"grok-imagine-image-2.0",
		"prompt":"Render this as a pencil sketch",
		"n":2,
		"response_format":"url",
		"quality":"medium",
		"aspect_ratio":"16:9",
		"resolution":"2k",
		"image":{"type":"image_url","url":"https://example.com/source.png"}
	}`, string(requestBody))
}

func TestConvertImageRequestRejectsMultipartXAIEdit(t *testing.T) {
	gin.SetMode(gin.TestMode)
	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	context.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", nil)
	context.Request.Header.Set("Content-Type", "multipart/form-data; boundary=test")

	_, err := (&Adaptor{}).ConvertImageRequest(context, &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesEdits}, dto.ImageRequest{
		Model:  "grok-imagine-image-2.0",
		Prompt: "Edit the image",
		Image:  json.RawMessage(`{"type":"image_url","url":"https://example.com/source.png"}`),
	})

	require.Error(t, err)
	assert.Contains(t, err.Error(), "application/json")
}

func TestConvertOpenAIRequestRemovesUnsupportedXAIChatFields(t *testing.T) {
	topK := 40
	request := &dto.GeneralOpenAIRequest{
		Model:           "grok-4.6",
		TopK:            &topK,
		ReasoningEffort: "high",
		Reasoning:       json.RawMessage(`{"enabled":true}`),
		EnableThinking:  json.RawMessage(`true`),
		Think:           json.RawMessage(`true`),
	}
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "grok-4.6"}}

	converted, err := (&Adaptor{}).ConvertOpenAIRequest(nil, info, request)
	require.NoError(t, err)
	got, ok := converted.(*dto.GeneralOpenAIRequest)
	require.True(t, ok)
	assert.Nil(t, got.TopK)
	assert.Empty(t, got.ReasoningEffort)
	assert.Empty(t, got.Reasoning)
	assert.Empty(t, got.EnableThinking)
	assert.Empty(t, got.Think)
}

func TestConvertGeminiRequestUsesChatConverterForXAI(t *testing.T) {
	topK := 40.0
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "grok-4.6"},
	}
	converted, err := service.ConvertRequest(nil, info, types.RelayFormatOpenAI, &dto.GeminiChatRequest{
		Contents: []dto.GeminiChatContent{{Role: "user", Parts: []dto.GeminiPart{{Text: "hello"}}}},
		GenerationConfig: dto.GeminiChatGenerationConfig{
			TopK:           &topK,
			ThinkingConfig: &dto.GeminiThinkingConfig{IncludeThoughts: true, ThinkingLevel: "high"},
		},
	})
	require.NoError(t, err)
	chatReq, ok := converted.Value.(*dto.GeneralOpenAIRequest)
	require.True(t, ok)
	got, err := (&Adaptor{}).ConvertOpenAIRequest(nil, info, chatReq)
	require.NoError(t, err)
	chat, ok := got.(*dto.GeneralOpenAIRequest)
	require.True(t, ok)
	assert.Equal(t, "grok-4.6", chat.Model)
	assert.Nil(t, chat.TopK)
	assert.Empty(t, chat.ReasoningEffort)
}

func TestModelListIncludesLatestXAIImageModel(t *testing.T) {
	assert.Contains(t, ModelList, "grok-imagine-image-2.0")
}
