package ollama

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/samber/lo"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOpenAIChatToOllamaChatPreservesAssistantReasoning(t *testing.T) {
	got, err := openAIChatToOllamaChat(nil, &dto.GeneralOpenAIRequest{
		Model: "qwq",
		Messages: []dto.Message{
			{Role: "user", Content: "hi"},
			{Role: "assistant", Content: "done", ReasoningContent: lo.ToPtr("先分析再回答")},
			{Role: "user", Content: "go", ReasoningContent: lo.ToPtr("不应映射")},
		},
	})
	require.NoError(t, err)
	require.Len(t, got.Messages, 3)

	assert.Empty(t, got.Messages[0].Thinking)
	assert.JSONEq(t, `"先分析再回答"`, string(got.Messages[1].Thinking))
	assert.Empty(t, got.Messages[2].Thinking, "reasoning on non-assistant roles must not be mapped")
}
