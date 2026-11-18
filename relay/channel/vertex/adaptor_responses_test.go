package vertex

import (
	"encoding/json"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	_ "github.com/QuantumNous/new-api/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestVertexAdaptorConvertOpenAIResponsesRequestGemini(t *testing.T) {
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeResponses,
		RelayFormat:     types.RelayFormatOpenAIResponses,
		OriginModelName: "gemini-4-argon",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gemini-4-argon",
		},
	}
	adaptor := &Adaptor{}
	adaptor.Init(info)
	require.Equal(t, RequestModeGemini, adaptor.RequestMode)

	req := dto.OpenAIResponsesRequest{
		Model: "gemini-4-argon",
		Input: json.RawMessage(`[{"type":"message","role":"user","content":"hello"},{"type":"function_call","call_id":"call_1","name":"ping","arguments":"{}"},{"type":"function_call_output","call_id":"call_1","output":"pong"}]`),
	}
	converted, err := adaptor.ConvertOpenAIResponsesRequest(nil, info, req)
	require.NoError(t, err)
	geminiReq, ok := converted.(*dto.GeminiChatRequest)
	require.True(t, ok)
	require.GreaterOrEqual(t, len(geminiReq.Contents), 3)
	assert.Empty(t, geminiReq.Contents[1].Parts[0].FunctionCall.ID)
	assert.Nil(t, geminiReq.Contents[2].Parts[0].FunctionResponse.ID)
}

func TestVertexAdaptorConvertClaudeRequestGemini(t *testing.T) {
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeChatCompletions,
		RelayFormat:     types.RelayFormatClaude,
		OriginModelName: "gemini-4-argon",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gemini-4-argon",
		},
	}
	adaptor := &Adaptor{}
	adaptor.Init(info)
	require.Equal(t, RequestModeGemini, adaptor.RequestMode)

	req := &dto.ClaudeRequest{
		Model:     "gemini-4-argon",
		MaxTokens: func() *uint { v := uint(1024); return &v }(),
		Messages: []dto.ClaudeMessage{
			{Role: "user", Content: "hi"},
		},
	}
	converted, err := adaptor.ConvertClaudeRequest(nil, info, req)
	require.NoError(t, err)
	_, ok := converted.(*dto.GeminiChatRequest)
	assert.True(t, ok)
}
