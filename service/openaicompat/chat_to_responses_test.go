package openaicompat

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/require"
)

func TestChatCompletionsRequestToResponsesRequestPreservesPromptCacheKey(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{
		Model:          "gpt-5.4",
		PromptCacheKey: "sess-123",
		Metadata:       []byte(`{"trace":"abc"}`),
		Messages: []dto.Message{
			{
				Role:    "user",
				Content: "hello",
			},
		},
	}

	out, err := ChatCompletionsRequestToResponsesRequest(req)
	require.NoError(t, err)
	require.JSONEq(t, `"sess-123"`, string(out.PromptCacheKey))
	require.JSONEq(t, `{"trace":"abc"}`, string(out.Metadata))

	var input []map[string]any
	require.NoError(t, common.Unmarshal(out.Input, &input))
	require.Len(t, input, 1)
}
