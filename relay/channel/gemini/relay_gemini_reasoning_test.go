package gemini

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestStreamResponseGeminiChat2OpenAISeparatesThoughtAndAnswer(t *testing.T) {
	t.Parallel()

	resp, isStop := streamResponseGeminiChat2OpenAI(&dto.GeminiChatResponse{
		Candidates: []dto.GeminiChatCandidate{
			{
				Content: dto.GeminiChatContent{
					Parts: []dto.GeminiPart{
						{Thought: true, Text: "reasoning"},
						{Text: "answer"},
					},
				},
			},
		},
	})

	require.False(t, isStop)
	require.Len(t, resp.Choices, 1)
	require.Equal(t, "reasoning", resp.Choices[0].Delta.GetReasoningContent())
	require.Equal(t, "answer", resp.Choices[0].Delta.GetContentString())
}

func TestResponseGeminiChat2OpenAIAccumulatesMultipleThoughtParts(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())

	resp := responseGeminiChat2OpenAI(c, &dto.GeminiChatResponse{
		Candidates: []dto.GeminiChatCandidate{
			{
				Content: dto.GeminiChatContent{
					Parts: []dto.GeminiPart{
						{Thought: true, Text: "first"},
						{Thought: true, Text: "second"},
						{Text: "final answer"},
					},
				},
			},
		},
	})

	require.Len(t, resp.Choices, 1)
	require.NotNil(t, resp.Choices[0].Message.ReasoningContent)
	require.Equal(t, "first\nsecond", *resp.Choices[0].Message.ReasoningContent)
	require.Equal(t, "final answer", resp.Choices[0].Message.StringContent())
}
