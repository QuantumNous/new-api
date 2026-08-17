package common

import (
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRelayInfoGetFinalRequestRelayFormatPrefersExplicitFinal(t *testing.T) {
	info := &RelayInfo{
		RelayFormat:             types.RelayFormatOpenAI,
		RequestConversionChain:  []types.RelayFormat{types.RelayFormatOpenAI, types.RelayFormatClaude},
		FinalRequestRelayFormat: types.RelayFormatOpenAIResponses,
	}

	require.Equal(t, types.RelayFormat(types.RelayFormatOpenAIResponses), info.GetFinalRequestRelayFormat())
}

func TestRelayInfoGetFinalRequestRelayFormatFallsBackToConversionChain(t *testing.T) {
	info := &RelayInfo{
		RelayFormat:            types.RelayFormatOpenAI,
		RequestConversionChain: []types.RelayFormat{types.RelayFormatOpenAI, types.RelayFormatClaude},
	}

	require.Equal(t, types.RelayFormat(types.RelayFormatClaude), info.GetFinalRequestRelayFormat())
}

func TestRelayInfoGetFinalRequestRelayFormatFallsBackToRelayFormat(t *testing.T) {
	info := &RelayInfo{
		RelayFormat: types.RelayFormatGemini,
	}

	require.Equal(t, types.RelayFormat(types.RelayFormatGemini), info.GetFinalRequestRelayFormat())
}

func TestRelayInfoGetFinalRequestRelayFormatNilReceiver(t *testing.T) {
	var info *RelayInfo
	require.Equal(t, types.RelayFormat(""), info.GetFinalRequestRelayFormat())
}

func TestRelayInfoMetaTypedNilReceiver(t *testing.T) {
	var info *RelayInfo
	var meta convmeta.Meta = info

	assert.Empty(t, meta.GetOriginModelName())
	assert.Empty(t, meta.GetUpstreamModelName())
	assert.False(t, meta.HasChannelMeta())
	assert.Zero(t, meta.GetChannelID())
	assert.Zero(t, meta.GetChannelType())
	assert.False(t, meta.GetIsStream())
	assert.Empty(t, meta.GetReasoningEffort())
	assert.Zero(t, meta.GetEstimatePromptTokens())
	assert.Zero(t, meta.GetSendResponseCount())

	assert.NotPanics(t, func() {
		meta.SetReasoningEffort("high")
		meta.IncrSendResponseCount()
		meta.AppendRequestConversion(types.RelayFormatClaude)
	})

	firstState := meta.EnsureClaudeConvertInfo()
	secondState := meta.EnsureClaudeConvertInfo()
	require.NotNil(t, firstState)
	require.NotNil(t, secondState)
	assert.Equal(t, convmeta.LastMessageTypeNone, firstState.LastMessagesType)
	assert.NotSame(t, firstState, secondState)

	firstOptions := meta.ConvOptions()
	secondOptions := meta.ConvOptions()
	require.NotNil(t, firstOptions)
	require.NotNil(t, secondOptions)
	assert.NotSame(t, firstOptions, secondOptions)
	assert.NotNil(t, firstOptions.Claude.DefaultMaxTokens)
	assert.NotNil(t, firstOptions.Gemini.SupportsImagine)
	assert.NotNil(t, firstOptions.Gemini.SafetySetting)
	assert.NotNil(t, firstOptions.PreserveThinkingSuffix)
}

func TestGenRelayInfoCapturesRequestReasoningEffort(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tests := []struct {
		name        string
		path        string
		relayFormat types.RelayFormat
		request     dto.Request
		expected    string
	}{
		{
			name:        "OpenAI chat top-level effort",
			path:        "/v1/chat/completions",
			relayFormat: types.RelayFormatOpenAI,
			request:     &dto.GeneralOpenAIRequest{Model: "gpt-5.6-sol", ReasoningEffort: " high "},
			expected:    "high",
		},
		{
			name:        "OpenRouter nested chat effort",
			path:        "/v1/chat/completions",
			relayFormat: types.RelayFormatOpenAI,
			request:     &dto.GeneralOpenAIRequest{Model: "anthropic/claude", Reasoning: json.RawMessage(`{"effort":"xhigh"}`)},
			expected:    "xhigh",
		},
		{
			name:        "OpenAI Responses effort",
			path:        "/v1/responses",
			relayFormat: types.RelayFormatOpenAIResponses,
			request:     &dto.OpenAIResponsesRequest{Model: "gpt-5.6-sol", Reasoning: &dto.Reasoning{Effort: "max"}},
			expected:    "max",
		},
		{
			name:        "explicit none is preserved",
			path:        "/v1/responses",
			relayFormat: types.RelayFormatOpenAIResponses,
			request:     &dto.OpenAIResponsesRequest{Model: "gpt-5.6-sol", Reasoning: &dto.Reasoning{Effort: "none"}},
			expected:    "none",
		},
		{
			name:        "non-string nested effort is ignored",
			path:        "/v1/chat/completions",
			relayFormat: types.RelayFormatOpenAI,
			request:     &dto.GeneralOpenAIRequest{Model: "anthropic/claude", Reasoning: json.RawMessage(`{"effort":42}`)},
			expected:    "",
		},
		{
			name:        "Claude output config effort",
			path:        "/v1/messages",
			relayFormat: types.RelayFormatClaude,
			request:     &dto.ClaudeRequest{Model: "claude-opus-4-7", OutputConfig: json.RawMessage(`{"effort":"medium"}`)},
			expected:    "medium",
		},
		{
			name:        "Gemini thinking level",
			path:        "/v1beta/models/gemini-3-pro:generateContent",
			relayFormat: types.RelayFormatGemini,
			request: &dto.GeminiChatRequest{GenerationConfig: dto.GeminiChatGenerationConfig{
				ThinkingConfig: &dto.GeminiThinkingConfig{ThinkingLevel: "low"},
			}},
			expected: "low",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			ctx.Request = httptest.NewRequest("POST", tt.path, nil)

			info, err := GenRelayInfo(ctx, tt.relayFormat, tt.request, nil)
			require.NoError(t, err)
			assert.Equal(t, tt.expected, info.ReasoningEffort)
		})
	}
}

func TestInitChannelMetaRestoresRequestReasoningEffortForRetry(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest("POST", "/v1/responses", nil)
	request := &dto.OpenAIResponsesRequest{
		Model:     "gpt-5.6-sol",
		Reasoning: &dto.Reasoning{Effort: "max"},
	}
	info, err := GenRelayInfo(ctx, types.RelayFormatOpenAIResponses, request, nil)
	require.NoError(t, err)

	info.SetReasoningEffort("high")
	info.InitChannelMeta(ctx)
	assert.Equal(t, "max", info.ReasoningEffort)

	info.SetReasoningEffort("low")
	info.InitChannelMeta(ctx)
	assert.Equal(t, "max", info.ReasoningEffort)
}
