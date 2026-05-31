package openaicompat

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/require"
)

func TestChatToResponses_TextOnly(t *testing.T) {
	msg := dto.Message{Role: "assistant"}
	msg.SetStringContent("answer")
	resp := &dto.OpenAITextResponse{
		Id:      "abc",
		Object:  "chat.completion",
		Created: int64(123),
		Model:   "claude",
		Choices: []dto.OpenAITextResponseChoice{
			{Index: 0, Message: msg, FinishReason: "stop"},
		},
		Usage: dto.Usage{PromptTokens: 10, CompletionTokens: 5, TotalTokens: 15},
	}
	out, err := ChatCompletionsResponseToResponsesResponse(resp, "claude")
	require.NoError(t, err)
	if out.ID != "resp_abc" {
		t.Errorf("id=%q", out.ID)
	}
	require.Len(t, out.Output, 1)
	if out.Output[0].Type != "message" {
		t.Errorf("output type=%q", out.Output[0].Type)
	}
	require.Len(t, out.Output[0].Content, 1)
	if out.Output[0].Content[0].Text != "answer" {
		t.Errorf("text=%q", out.Output[0].Content[0].Text)
	}
}

func TestChatToResponses_ToolCall(t *testing.T) {
	msg := dto.Message{Role: "assistant"}
	msg.SetToolCalls([]dto.ToolCallRequest{
		{ID: "c1", Type: "function", Function: dto.FunctionRequest{Name: "search", Arguments: `{"q":"x"}`}},
	})
	resp := &dto.OpenAITextResponse{
		Id:      "abc",
		Object:  "chat.completion",
		Created: int64(1),
		Model:   "m",
		Choices: []dto.OpenAITextResponseChoice{
			{Index: 0, Message: msg, FinishReason: "tool_calls"},
		},
	}
	out, err := ChatCompletionsResponseToResponsesResponse(resp, "m")
	require.NoError(t, err)
	hasFc := false
	for _, o := range out.Output {
		if o.Type == "function_call" {
			hasFc = true
			if o.Name != "search" {
				t.Errorf("name=%q", o.Name)
			}
			if o.CallId != "c1" {
				t.Errorf("call_id=%q", o.CallId)
			}
		}
	}
	if !hasFc {
		t.Errorf("missing function_call: %+v", out.Output)
	}
}

func TestChatToResponses_ReasoningOnly(t *testing.T) {
	reasoning := "thinking"
	msg := dto.Message{Role: "assistant", ReasoningContent: &reasoning}
	msg.SetStringContent("")
	resp := &dto.OpenAITextResponse{
		Id:      "abc",
		Object:  "chat.completion",
		Created: int64(1),
		Model:   "m",
		Choices: []dto.OpenAITextResponseChoice{
			{Index: 0, Message: msg, FinishReason: "stop"},
		},
	}
	out, err := ChatCompletionsResponseToResponsesResponse(resp, "m")
	require.NoError(t, err)
	hasReasoning := false
	for _, o := range out.Output {
		if o.Type == "reasoning" {
			hasReasoning = true
			require.NotEmpty(t, o.Content)
			if o.Content[0].Text != "thinking" {
				t.Errorf("reasoning text=%q", o.Content[0].Text)
			}
		}
	}
	if !hasReasoning {
		t.Errorf("missing reasoning: %+v", out.Output)
	}
}

func TestChatToResponses_LengthMarksIncomplete(t *testing.T) {
	msg := dto.Message{Role: "assistant"}
	msg.SetStringContent("abc")
	resp := &dto.OpenAITextResponse{
		Id:      "abc",
		Object:  "chat.completion",
		Created: int64(1),
		Model:   "m",
		Choices: []dto.OpenAITextResponseChoice{
			{Index: 0, Message: msg, FinishReason: "length"},
		},
	}
	out, err := ChatCompletionsResponseToResponsesResponse(resp, "m")
	require.NoError(t, err)
	require.NotNil(t, out.IncompleteDetails)
	if out.IncompleteDetails.Reasoning != "max_output_tokens" {
		t.Errorf("incomplete reason=%q", out.IncompleteDetails.Reasoning)
	}
}

func TestChatToResponses_UsageDecomposition(t *testing.T) {
	msg := dto.Message{Role: "assistant"}
	msg.SetStringContent("ok")
	resp := &dto.OpenAITextResponse{
		Id:      "abc",
		Object:  "chat.completion",
		Created: int64(1),
		Model:   "m",
		Choices: []dto.OpenAITextResponseChoice{
			{Index: 0, Message: msg, FinishReason: "stop"},
		},
		Usage: dto.Usage{
			PromptTokens:     100,
			CompletionTokens: 50,
			TotalTokens:      150,
			PromptTokensDetails: dto.InputTokenDetails{
				CachedTokens:         30,
				CachedCreationTokens: 20,
			},
		},
	}
	out, err := ChatCompletionsResponseToResponsesResponse(resp, "m")
	require.NoError(t, err)
	require.NotNil(t, out.Usage)
	// input_tokens = 100 - 30 - 20 = 50
	if out.Usage.InputTokens != 50 {
		t.Errorf("input_tokens=%d want 50", out.Usage.InputTokens)
	}
	if out.Usage.OutputTokens != 50 {
		t.Errorf("output_tokens=%d want 50", out.Usage.OutputTokens)
	}
	require.NotNil(t, out.Usage.InputTokensDetails)
	if out.Usage.InputTokensDetails.CachedTokens != 30 {
		t.Errorf("cached=%d want 30", out.Usage.InputTokensDetails.CachedTokens)
	}
}

func TestChatToResponses_MixedReasoningTextToolCall(t *testing.T) {
	reasoning := "let me think"
	msg := dto.Message{Role: "assistant", ReasoningContent: &reasoning}
	msg.SetStringContent("partial")
	msg.SetToolCalls([]dto.ToolCallRequest{
		{ID: "c1", Type: "function", Function: dto.FunctionRequest{Name: "f", Arguments: "{}"}},
	})
	resp := &dto.OpenAITextResponse{
		Id: "abc", Object: "chat.completion", Created: int64(1), Model: "m",
		Choices: []dto.OpenAITextResponseChoice{
			{Index: 0, Message: msg, FinishReason: "tool_calls"},
		},
	}
	out, err := ChatCompletionsResponseToResponsesResponse(resp, "m")
	require.NoError(t, err)
	types := make([]string, 0)
	for _, o := range out.Output {
		types = append(types, o.Type)
	}
	hasR, hasM, hasF := false, false, false
	for _, t2 := range types {
		switch t2 {
		case "reasoning":
			hasR = true
		case "message":
			hasM = true
		case "function_call":
			hasF = true
		}
	}
	if !hasR || !hasM || !hasF {
		t.Errorf("expected all three output items, got %v", types)
	}
}
