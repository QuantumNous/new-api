package openai

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/require"
)

func TestOpenAITextResponseChoiceContentPrefersTextCompletionField(t *testing.T) {
	choice := dto.OpenAITextResponseChoice{
		Text: "return a + b",
		Message: dto.Message{
			Role:    "assistant",
			Content: "chat content",
		},
	}

	require.Equal(t, "return a + b", openAITextResponseChoiceContent(choice))
}

func TestOpenAITextResponseChoiceContentFallsBackToMessageContent(t *testing.T) {
	choice := dto.OpenAITextResponseChoice{
		Message: dto.Message{
			Role:    "assistant",
			Content: "chat content",
		},
	}

	require.Equal(t, "chat content", openAITextResponseChoiceContent(choice))
}
