package gemini

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/require"
)

func TestConvertGeminiRequestSplitsFunctionResponseFromFollowupText(t *testing.T) {
	t.Parallel()

	req := &dto.GeminiChatRequest{
		Contents: []dto.GeminiChatContent{
			{Role: "user", Parts: []dto.GeminiPart{{Text: "查询北京天气"}}},
			{Role: "model", Parts: []dto.GeminiPart{{
				FunctionCall: &dto.FunctionCall{
					FunctionName: "get_weather",
					Arguments:    map[string]any{"city": "北京"},
				},
			}}},
			{Role: "user", Parts: []dto.GeminiPart{
				{FunctionResponse: &dto.GeminiFunctionResponse{
					Name:     "get_weather",
					Response: map[string]any{"temperature": "22°C"},
				}},
				{Text: "请逆序排列文字"},
			}},
		},
	}

	converted, err := (&Adaptor{}).ConvertGeminiRequest(nil, &relaycommon.RelayInfo{}, req)
	require.NoError(t, err)
	out, ok := converted.(*dto.GeminiChatRequest)
	require.True(t, ok)
	require.Len(t, out.Contents, 4)

	toolResult := out.Contents[2]
	require.Equal(t, "user", toolResult.Role)
	require.Len(t, toolResult.Parts, 1)
	require.NotNil(t, toolResult.Parts[0].FunctionResponse)

	followup := out.Contents[3]
	require.Equal(t, "user", followup.Role)
	require.Len(t, followup.Parts, 1)
	require.Nil(t, followup.Parts[0].FunctionResponse)
	require.Equal(t, "请逆序排列文字", followup.Parts[0].Text)
}
