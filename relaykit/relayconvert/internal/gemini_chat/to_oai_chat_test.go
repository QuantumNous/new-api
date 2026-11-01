package geminichat

import (
	"context"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGeminiToChatPreservesGenerationParameters(t *testing.T) {
	for _, tt := range []struct {
		name   string
		config string
		want   map[string]any
	}{
		{name: "unset", config: `{}`},
		{name: "plain text", config: `{"responseMimeType":"text/plain"}`},
		{
			name: "json mode", config: `{"responseMimeType":"application/json"}`,
			want: map[string]any{"response_format": map[string]any{"type": "json_object"}},
		},
		{
			name: "sampling and logprobs", config: `{"responseLogprobs":true,"logprobs":3,"seed":42,"presencePenalty":0.5,"frequencyPenalty":0.5}`,
			want: map[string]any{"logprobs": true, "top_logprobs": float64(3), "seed": float64(42), "presence_penalty": 0.5, "frequency_penalty": 0.5},
		},
		{
			name: "explicit zeros", config: `{"responseLogprobs":true,"logprobs":0,"seed":0,"presencePenalty":0,"frequencyPenalty":0}`,
			want: map[string]any{"logprobs": true, "top_logprobs": float64(0), "seed": float64(0), "presence_penalty": float64(0), "frequency_penalty": float64(0)},
		},
		{
			name: "logprobs switch only", config: `{"responseLogprobs":true}`,
			want: map[string]any{"logprobs": true},
		},
		{
			name: "logprobs disabled", config: `{"responseLogprobs":false}`,
			want: map[string]any{"logprobs": false},
		},
		{
			name: "logprobs count requires enabled switch", config: `{"responseLogprobs":false,"logprobs":3}`,
			want: map[string]any{"logprobs": false},
		},
		{
			name: "negative penalties", config: `{"presencePenalty":-0.5,"frequencyPenalty":-1.5}`,
			want: map[string]any{"presence_penalty": -0.5, "frequency_penalty": -1.5},
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			var request dto.GeminiChatRequest
			require.NoError(t, kitutil.Unmarshal([]byte(`{"contents":[{"role":"user","parts":[{"text":"Return JSON."}]}],"generationConfig":`+tt.config+`}`), &request))
			converted, err := GeminiGenerateContentRequestToOpenAIChat(context.Background(), &request, nil)
			require.NoError(t, err)
			raw, err := kitutil.Marshal(converted)
			require.NoError(t, err)
			var wire map[string]any
			require.NoError(t, kitutil.Unmarshal(raw, &wire))
			for _, field := range []string{"response_format", "logprobs", "top_logprobs", "seed", "presence_penalty", "frequency_penalty"} {
				want, present := tt.want[field]
				if !present {
					assert.NotContains(t, wire, field)
					continue
				}
				assert.Equal(t, want, wire[field], field)
			}
		})
	}
}

func TestGeminiToChatStreamSeparatesThoughtParts(t *testing.T) {
	tool := dto.GeminiPart{FunctionCall: &dto.FunctionCall{ID: "call_echo", FunctionName: "echo", Arguments: map[string]any{"value": "x"}}}
	for _, tt := range []struct {
		name      string
		parts     []dto.GeminiPart
		content   string
		reasoning string
		toolCalls int
	}{
		{name: "thought then answer", parts: []dto.GeminiPart{{Thought: true, Text: "Think."}, {Text: "Answer."}}, content: "Answer.", reasoning: "Think."},
		{name: "answer then thought", parts: []dto.GeminiPart{{Text: "Answer."}, {Thought: true, Text: "Think."}}, content: "Answer.", reasoning: "Think."},
		{name: "interleaved", parts: []dto.GeminiPart{{Thought: true, Text: "First thought."}, {Text: "First answer."}, {Thought: true, Text: "Second thought."}, {Text: "Second answer."}}, content: "First answer.\nSecond answer.", reasoning: "First thought.\nSecond thought."},
		{name: "text only", parts: []dto.GeminiPart{{Text: "Answer."}}, content: "Answer."},
		{name: "thought only", parts: []dto.GeminiPart{{Thought: true, Text: "Think."}}, reasoning: "Think."},
		{name: "mixed with tool", parts: []dto.GeminiPart{{Thought: true, Text: "Think."}, {Text: "Querying."}, tool}, content: "Querying.", reasoning: "Think.", toolCalls: 1},
	} {
		t.Run(tt.name, func(t *testing.T) {
			response, _ := StreamResponseGeminiChat2OpenAI(&dto.GeminiChatResponse{Candidates: []dto.GeminiChatCandidate{{Content: dto.GeminiChatContent{Role: "model", Parts: tt.parts}}}})
			require.Len(t, response.Choices, 1)
			delta := response.Choices[0].Delta
			assert.Equal(t, tt.content, delta.GetContentString())
			assert.Equal(t, tt.reasoning, delta.GetReasoningContent())
			if tt.content == "" {
				assert.Nil(t, delta.Content)
			}
			require.Len(t, delta.ToolCalls, tt.toolCalls)
			if tt.toolCalls > 0 {
				assert.Equal(t, "call_echo", delta.ToolCalls[0].ID)
				assert.Equal(t, "echo", delta.ToolCalls[0].Function.Name)
				assert.JSONEq(t, `{"value":"x"}`, delta.ToolCalls[0].Function.Arguments)
			}
		})
	}
}

func TestGeminiToChatKeepsCandidateFinishReasonsIndependent(t *testing.T) {
	tool := dto.GeminiChatCandidate{
		Index: 0, FinishReason: kitutil.GetPointer("STOP"),
		Content: dto.GeminiChatContent{Role: "model", Parts: []dto.GeminiPart{{FunctionCall: &dto.FunctionCall{ID: "call_echo", FunctionName: "echo", Arguments: map[string]any{"value": "x"}}}}},
	}
	text := dto.GeminiChatCandidate{Index: 1, FinishReason: kitutil.GetPointer("STOP"), Content: dto.GeminiChatContent{Role: "model", Parts: []dto.GeminiPart{{Text: "x"}}}}
	limited := dto.GeminiChatCandidate{Index: 2, FinishReason: kitutil.GetPointer("MAX_TOKENS"), Content: dto.GeminiChatContent{Role: "model", Parts: []dto.GeminiPart{{Text: "partial"}}}}
	for _, tt := range []struct {
		name       string
		candidates []dto.GeminiChatCandidate
	}{
		{name: "tool first", candidates: []dto.GeminiChatCandidate{tool, text, limited}},
		{name: "tool last", candidates: []dto.GeminiChatCandidate{text, limited, tool}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			response := ResponseGeminiChat2OpenAI("test", 1, &dto.GeminiChatResponse{Candidates: tt.candidates})
			require.Len(t, response.Choices, 3)
			for _, choice := range response.Choices {
				assert.Equal(t, map[int]string{0: "tool_calls", 1: "stop", 2: "length"}[choice.Index], choice.FinishReason)
				if choice.Index == 0 {
					require.Len(t, choice.Message.ParseToolCalls(), 1)
				} else {
					assert.Empty(t, choice.Message.ParseToolCalls())
				}
			}
		})
	}
}

func TestGeminiToChatPreservesNewlineParts(t *testing.T) {
	for _, tt := range []struct {
		name  string
		texts []string
		want  string
	}{
		{name: "newline only", texts: []string{"\n"}, want: "\n"},
		{name: "leading", texts: []string{"\n", "x"}, want: "\nx"},
		{name: "trailing", texts: []string{"x", "\n"}, want: "x\n"},
		{name: "consecutive", texts: []string{"x", "\n", "\n", "y"}, want: "x\n\ny"},
		{name: "between text", texts: []string{"x", "\n", "y"}, want: "x\ny"},
		{name: "existing text separation", texts: []string{"x", "y"}, want: "x\ny"},
		{name: "existing embedded newline separation", texts: []string{"x\n", "y"}, want: "x\n\ny"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			parts := make([]dto.GeminiPart, len(tt.texts))
			for i, text := range tt.texts {
				parts[i] = dto.GeminiPart{Text: text}
			}
			source := &dto.GeminiChatResponse{Candidates: []dto.GeminiChatCandidate{{Content: dto.GeminiChatContent{Role: "model", Parts: parts}, FinishReason: kitutil.GetPointer("STOP")}}}
			response := ResponseGeminiChat2OpenAI("test", 1, source)
			require.Len(t, response.Choices, 1)
			assert.Equal(t, tt.want, response.Choices[0].Message.StringContent())
			stream, _ := StreamResponseGeminiChat2OpenAI(source)
			require.Len(t, stream.Choices, 1)
			assert.Equal(t, tt.want, stream.Choices[0].Delta.GetContentString())
		})
	}
}
