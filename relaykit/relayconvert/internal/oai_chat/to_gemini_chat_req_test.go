package oaichat

import (
	"context"
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOpenAIChatToGeminiMergesConsecutiveAssistantFunctionCalls(t *testing.T) {
	req := dto.GeneralOpenAIRequest{
		Model: "gemini-test",
		Messages: []dto.Message{
			{Role: "user", Content: "run tools"},
			assistantToolCall("call_0", "alpha", `{"q":"a"}`),
			assistantToolCall("call_1", "beta", `{"q":"b"}`),
			toolResult("call_0", `{"ok":true}`),
			toolResult("call_1", `{"ok":false}`),
		},
	}

	got, err := OpenAIChatRequestToGeminiGenerateContent(context.Background(), req, &convmeta.Values{ChannelMetaAttached: true})
	require.NoError(t, err)
	require.NoError(t, geminiFunctionCallHistoryAligned(got.Contents))

	require.Len(t, got.Contents, 3)
	assert.Equal(t, "user", got.Contents[0].Role)
	assert.Equal(t, "model", got.Contents[1].Role)
	assert.Equal(t, "user", got.Contents[2].Role)

	require.Len(t, got.Contents[1].Parts, 2)
	require.NotNil(t, got.Contents[1].Parts[0].FunctionCall)
	require.NotNil(t, got.Contents[1].Parts[1].FunctionCall)
	assert.Equal(t, "call_0", got.Contents[1].Parts[0].FunctionCall.ID)
	assert.Equal(t, "call_1", got.Contents[1].Parts[1].FunctionCall.ID)

	require.Len(t, got.Contents[2].Parts, 2)
	require.NotNil(t, got.Contents[2].Parts[0].FunctionResponse)
	require.NotNil(t, got.Contents[2].Parts[1].FunctionResponse)
	assert.Equal(t, "call_0", kitutil.JsonRawMessageToString(got.Contents[2].Parts[0].FunctionResponse.ID))
	assert.Equal(t, "call_1", kitutil.JsonRawMessageToString(got.Contents[2].Parts[1].FunctionResponse.ID))
}

func TestOpenAIChatToGeminiKeepsSequentialToolTurnsSeparate(t *testing.T) {
	req := dto.GeneralOpenAIRequest{
		Model: "gemini-test",
		Messages: []dto.Message{
			{Role: "user", Content: "run tools"},
			assistantToolCall("call_0", "alpha", `{"q":"a"}`),
			toolResult("call_0", `{"ok":true}`),
			assistantToolCall("call_1", "beta", `{"q":"b"}`),
			toolResult("call_1", `{"ok":false}`),
		},
	}

	got, err := OpenAIChatRequestToGeminiGenerateContent(context.Background(), req, &convmeta.Values{ChannelMetaAttached: true})
	require.NoError(t, err)
	require.NoError(t, geminiFunctionCallHistoryAligned(got.Contents))

	require.Len(t, got.Contents, 5)
	assert.Equal(t, []string{"user", "model", "user", "model", "user"}, geminiRoles(got.Contents))
	assert.Equal(t, "call_0", got.Contents[1].Parts[0].FunctionCall.ID)
	assert.Equal(t, "call_0", kitutil.JsonRawMessageToString(got.Contents[2].Parts[0].FunctionResponse.ID))
	assert.Equal(t, "call_1", got.Contents[3].Parts[0].FunctionCall.ID)
	assert.Equal(t, "call_1", kitutil.JsonRawMessageToString(got.Contents[4].Parts[0].FunctionResponse.ID))
}

func TestOpenAIChatToGeminiAlignsBatchedToolResultsWithFunctionCallOrder(t *testing.T) {
	req := dto.GeneralOpenAIRequest{
		Model: "gemini-test",
		Messages: []dto.Message{
			{Role: "user", Content: "run tools"},
			assistantToolCall("call_0", "alpha", `{"q":"a"}`),
			assistantToolCall("call_1", "beta", `{"q":"b"}`),
			toolResult("call_1", `{"ok":false}`),
			toolResult("call_0", `{"ok":true}`),
		},
	}

	got, err := OpenAIChatRequestToGeminiGenerateContent(context.Background(), req, &convmeta.Values{ChannelMetaAttached: true})
	require.NoError(t, err)
	require.NoError(t, geminiFunctionCallHistoryAligned(got.Contents))

	require.Len(t, got.Contents, 3)
	assert.Equal(t, "call_0", got.Contents[1].Parts[0].FunctionCall.ID)
	assert.Equal(t, "call_1", got.Contents[1].Parts[1].FunctionCall.ID)
	assert.Equal(t, "call_0", kitutil.JsonRawMessageToString(got.Contents[2].Parts[0].FunctionResponse.ID))
	assert.Equal(t, "call_1", kitutil.JsonRawMessageToString(got.Contents[2].Parts[1].FunctionResponse.ID))
}

func TestOpenAIChatToGeminiAlignsSingleAssistantParallelToolCallsWithText(t *testing.T) {
	assistant := dto.Message{Role: "assistant", Content: "I'll call both tools."}
	assistant.SetToolCalls([]dto.ToolCallRequest{
		{
			ID:   "call_0",
			Type: "function",
			Function: dto.FunctionRequest{
				Name:      "alpha",
				Arguments: `{"q":"a"}`,
			},
		},
		{
			ID:   "call_1",
			Type: "function",
			Function: dto.FunctionRequest{
				Name:      "beta",
				Arguments: `{"q":"b"}`,
			},
		},
	})
	req := dto.GeneralOpenAIRequest{
		Model: "gemini-test",
		Messages: []dto.Message{
			{Role: "user", Content: "run tools"},
			assistant,
			toolResult("call_1", `{"ok":false}`),
			toolResult("call_0", `{"ok":true}`),
		},
	}

	got, err := OpenAIChatRequestToGeminiGenerateContent(context.Background(), req, &convmeta.Values{ChannelMetaAttached: true})
	require.NoError(t, err)
	require.NoError(t, geminiFunctionCallHistoryAligned(got.Contents))

	require.Len(t, got.Contents, 3)
	require.Len(t, got.Contents[1].Parts, 3)
	require.NotNil(t, got.Contents[1].Parts[0].FunctionCall)
	require.NotNil(t, got.Contents[1].Parts[1].FunctionCall)
	assert.Equal(t, "call_0", got.Contents[1].Parts[0].FunctionCall.ID)
	assert.Equal(t, "call_1", got.Contents[1].Parts[1].FunctionCall.ID)
	assert.Equal(t, "I'll call both tools.", got.Contents[1].Parts[2].Text)
	assert.Equal(t, "call_0", kitutil.JsonRawMessageToString(got.Contents[2].Parts[0].FunctionResponse.ID))
	assert.Equal(t, "call_1", kitutil.JsonRawMessageToString(got.Contents[2].Parts[1].FunctionResponse.ID))
}

func TestOpenAIChatToGeminiCompactsMergedTextAndFunctionCallsToFront(t *testing.T) {
	first := dto.Message{Role: "assistant", Content: "I'll call alpha."}
	first.SetToolCalls([]dto.ToolCallRequest{
		{
			ID:   "call_0",
			Type: "function",
			Function: dto.FunctionRequest{
				Name:      "alpha",
				Arguments: `{"q":"a"}`,
			},
		},
	})
	req := dto.GeneralOpenAIRequest{
		Model: "gemini-test",
		Messages: []dto.Message{
			{Role: "user", Content: "run tools"},
			first,
			assistantToolCall("call_1", "beta", `{"q":"b"}`),
			toolResult("call_1", `{"ok":false}`),
			toolResult("call_0", `{"ok":true}`),
		},
	}

	got, err := OpenAIChatRequestToGeminiGenerateContent(context.Background(), req, &convmeta.Values{ChannelMetaAttached: true})
	require.NoError(t, err)
	require.NoError(t, geminiFunctionCallHistoryAligned(got.Contents))

	require.Len(t, got.Contents, 3)
	require.Len(t, got.Contents[1].Parts, 3)
	require.NotNil(t, got.Contents[1].Parts[0].FunctionCall)
	require.NotNil(t, got.Contents[1].Parts[1].FunctionCall)
	assert.Equal(t, "call_0", got.Contents[1].Parts[0].FunctionCall.ID)
	assert.Equal(t, "call_1", got.Contents[1].Parts[1].FunctionCall.ID)
	assert.Equal(t, "I'll call alpha.", got.Contents[1].Parts[2].Text)
	assert.Equal(t, "call_0", kitutil.JsonRawMessageToString(got.Contents[2].Parts[0].FunctionResponse.ID))
	assert.Equal(t, "call_1", kitutil.JsonRawMessageToString(got.Contents[2].Parts[1].FunctionResponse.ID))
}

func TestOpenAIChatToGeminiInsertsPlaceholderForMissingFunctionResponse(t *testing.T) {
	assistant := dto.Message{Role: "assistant"}
	assistant.SetToolCalls([]dto.ToolCallRequest{
		{
			ID:   "call_0",
			Type: "function",
			Function: dto.FunctionRequest{
				Name:      "alpha",
				Arguments: `{"q":"a"}`,
			},
		},
		{
			ID:   "call_1",
			Type: "function",
			Function: dto.FunctionRequest{
				Name:      "beta",
				Arguments: `{"q":"b"}`,
			},
		},
		{
			ID:   "call_2",
			Type: "function",
			Function: dto.FunctionRequest{
				Name:      "gamma",
				Arguments: `{"q":"c"}`,
			},
		},
	})
	req := dto.GeneralOpenAIRequest{
		Model: "gemini-test",
		Messages: []dto.Message{
			{Role: "user", Content: "run tools"},
			assistant,
			toolResult("call_0", `{"ok":true}`),
			toolResult("call_2", `{"ok":false}`),
		},
	}

	got, err := OpenAIChatRequestToGeminiGenerateContent(context.Background(), req, &convmeta.Values{ChannelMetaAttached: true})
	require.NoError(t, err)
	require.NoError(t, geminiFunctionCallHistoryAligned(got.Contents))

	require.Len(t, got.Contents, 3)
	require.Len(t, got.Contents[2].Parts, 3)
	assert.Equal(t, "call_0", kitutil.JsonRawMessageToString(got.Contents[2].Parts[0].FunctionResponse.ID))
	assert.Equal(t, "call_1", kitutil.JsonRawMessageToString(got.Contents[2].Parts[1].FunctionResponse.ID))
	assert.Equal(t, "beta", got.Contents[2].Parts[1].FunctionResponse.Name)
	assert.Equal(t, "missing function response", got.Contents[2].Parts[1].FunctionResponse.Response["conversion_error"])
	assert.Equal(t, "call_2", kitutil.JsonRawMessageToString(got.Contents[2].Parts[2].FunctionResponse.ID))
	assert.Equal(t, true, got.Contents[2].Parts[0].FunctionResponse.Response["ok"])
	assert.Equal(t, false, got.Contents[2].Parts[2].FunctionResponse.Response["ok"])
}

func TestOpenAIChatToGeminiKeepsUnmatchedFunctionResponsesAfterAlignedOnes(t *testing.T) {
	req := dto.GeneralOpenAIRequest{
		Model: "gemini-test",
		Messages: []dto.Message{
			{Role: "user", Content: "run tools"},
			assistantToolCall("call_0", "alpha", `{"q":"a"}`),
			assistantToolCall("call_1", "beta", `{"q":"b"}`),
			toolResult("call_1", `{"ok":false}`),
			toolResult("call_orphan", `{"ok":"extra"}`),
			toolResult("call_0", `{"ok":true}`),
		},
	}

	got, err := OpenAIChatRequestToGeminiGenerateContent(context.Background(), req, &convmeta.Values{ChannelMetaAttached: true})
	require.NoError(t, err)

	require.Len(t, got.Contents, 3)
	require.Len(t, got.Contents[2].Parts, 3)
	assert.Equal(t, "call_0", kitutil.JsonRawMessageToString(got.Contents[2].Parts[0].FunctionResponse.ID))
	assert.Equal(t, "call_1", kitutil.JsonRawMessageToString(got.Contents[2].Parts[1].FunctionResponse.ID))
	assert.Equal(t, "call_orphan", kitutil.JsonRawMessageToString(got.Contents[2].Parts[2].FunctionResponse.ID))
}

func TestOpenAIChatToGeminiLeavesTextOnlyTurnUnchanged(t *testing.T) {
	req := dto.GeneralOpenAIRequest{
		Model: "gemini-test",
		Messages: []dto.Message{
			{Role: "user", Content: "hi"},
			{Role: "assistant", Content: "hello"},
			{Role: "user", Content: "thanks"},
		},
	}

	got, err := OpenAIChatRequestToGeminiGenerateContent(context.Background(), req, &convmeta.Values{ChannelMetaAttached: true})
	require.NoError(t, err)
	require.NoError(t, geminiFunctionCallHistoryAligned(got.Contents))

	require.Len(t, got.Contents, 3)
	assert.Equal(t, []string{"user", "model", "user"}, geminiRoles(got.Contents))
	require.Len(t, got.Contents[1].Parts, 1)
	assert.Equal(t, "hello", got.Contents[1].Parts[0].Text)
	require.Len(t, got.Contents[2].Parts, 1)
	assert.Equal(t, "thanks", got.Contents[2].Parts[0].Text)
}

func TestOpenAIChatToGeminiMergesConsecutiveTextOnlyAssistants(t *testing.T) {
	req := dto.GeneralOpenAIRequest{
		Model: "gemini-test",
		Messages: []dto.Message{
			{Role: "user", Content: "hi"},
			{Role: "assistant", Content: "first"},
			{Role: "assistant", Content: "second"},
		},
	}

	got, err := OpenAIChatRequestToGeminiGenerateContent(context.Background(), req, &convmeta.Values{ChannelMetaAttached: true})
	require.NoError(t, err)

	require.Len(t, got.Contents, 2)
	assert.Equal(t, []string{"user", "model"}, geminiRoles(got.Contents))
	require.Len(t, got.Contents[1].Parts, 2)
	assert.Equal(t, "first", got.Contents[1].Parts[0].Text)
	assert.Equal(t, "second", got.Contents[1].Parts[1].Text)
}

func TestOpenAIChatToGeminiCompactsLeadingTextThenFunctionCall(t *testing.T) {
	req := dto.GeneralOpenAIRequest{
		Model: "gemini-test",
		Messages: []dto.Message{
			{Role: "user", Content: "run tools"},
			{Role: "assistant", Content: "I'll look that up."},
			assistantToolCall("call_0", "alpha", `{"q":"a"}`),
			toolResult("call_0", `{"ok":true}`),
		},
	}

	got, err := OpenAIChatRequestToGeminiGenerateContent(context.Background(), req, &convmeta.Values{ChannelMetaAttached: true})
	require.NoError(t, err)
	require.NoError(t, geminiFunctionCallHistoryAligned(got.Contents))

	require.Len(t, got.Contents, 3)
	require.Len(t, got.Contents[1].Parts, 2)
	require.NotNil(t, got.Contents[1].Parts[0].FunctionCall)
	assert.Equal(t, "call_0", got.Contents[1].Parts[0].FunctionCall.ID)
	assert.Equal(t, "I'll look that up.", got.Contents[1].Parts[1].Text)
	assert.Equal(t, "call_0", kitutil.JsonRawMessageToString(got.Contents[2].Parts[0].FunctionResponse.ID))
}

func TestOpenAIChatToGeminiCompactsMergedTextFromBothAssistantsPreservingOrder(t *testing.T) {
	req := dto.GeneralOpenAIRequest{
		Model: "gemini-test",
		Messages: []dto.Message{
			{Role: "user", Content: "run tools"},
			assistantTextAndToolCall("I'll call alpha.", "call_0", "alpha", `{"q":"a"}`),
			assistantTextAndToolCall("I'll call beta.", "call_1", "beta", `{"q":"b"}`),
			toolResult("call_1", `{"ok":false}`),
			toolResult("call_0", `{"ok":true}`),
		},
	}

	got, err := OpenAIChatRequestToGeminiGenerateContent(context.Background(), req, &convmeta.Values{ChannelMetaAttached: true})
	require.NoError(t, err)
	require.NoError(t, geminiFunctionCallHistoryAligned(got.Contents))

	require.Len(t, got.Contents, 3)
	require.Len(t, got.Contents[1].Parts, 4)
	require.NotNil(t, got.Contents[1].Parts[0].FunctionCall)
	require.NotNil(t, got.Contents[1].Parts[1].FunctionCall)
	assert.Equal(t, "call_0", got.Contents[1].Parts[0].FunctionCall.ID)
	assert.Equal(t, "call_1", got.Contents[1].Parts[1].FunctionCall.ID)
	assert.Equal(t, "I'll call alpha.", got.Contents[1].Parts[2].Text)
	assert.Equal(t, "I'll call beta.", got.Contents[1].Parts[3].Text)
	assert.Equal(t, "call_0", kitutil.JsonRawMessageToString(got.Contents[2].Parts[0].FunctionResponse.ID))
	assert.Equal(t, "call_1", kitutil.JsonRawMessageToString(got.Contents[2].Parts[1].FunctionResponse.ID))
}

func TestOpenAIChatToGeminiInsertsPlaceholderForMissingFirstFunctionResponse(t *testing.T) {
	assistant := dto.Message{Role: "assistant"}
	assistant.SetToolCalls([]dto.ToolCallRequest{
		{
			ID:   "call_0",
			Type: "function",
			Function: dto.FunctionRequest{
				Name:      "alpha",
				Arguments: `{"q":"a"}`,
			},
		},
		{
			ID:   "call_1",
			Type: "function",
			Function: dto.FunctionRequest{
				Name:      "beta",
				Arguments: `{"q":"b"}`,
			},
		},
	})
	req := dto.GeneralOpenAIRequest{
		Model: "gemini-test",
		Messages: []dto.Message{
			{Role: "user", Content: "run tools"},
			assistant,
			toolResult("call_1", `{"ok":false}`),
		},
	}

	got, err := OpenAIChatRequestToGeminiGenerateContent(context.Background(), req, &convmeta.Values{ChannelMetaAttached: true})
	require.NoError(t, err)
	require.NoError(t, geminiFunctionCallHistoryAligned(got.Contents))

	require.Len(t, got.Contents, 3)
	require.Len(t, got.Contents[2].Parts, 2)
	assert.Equal(t, "call_0", kitutil.JsonRawMessageToString(got.Contents[2].Parts[0].FunctionResponse.ID))
	assert.Equal(t, "alpha", got.Contents[2].Parts[0].FunctionResponse.Name)
	assert.Equal(t, "missing function response", got.Contents[2].Parts[0].FunctionResponse.Response["conversion_error"])
	assert.Equal(t, "call_1", kitutil.JsonRawMessageToString(got.Contents[2].Parts[1].FunctionResponse.ID))
	assert.Equal(t, false, got.Contents[2].Parts[1].FunctionResponse.Response["ok"])
}

func TestOpenAIChatToGeminiAlignsLaterSequentialTurnWithReversedBatchedResults(t *testing.T) {
	req := dto.GeneralOpenAIRequest{
		Model: "gemini-test",
		Messages: []dto.Message{
			{Role: "user", Content: "run tools"},
			assistantToolCall("call_s0", "start", `{"q":"s"}`),
			toolResult("call_s0", `{"ok":true}`),
			assistantToolCall("call_0", "alpha", `{"q":"a"}`),
			assistantToolCall("call_1", "beta", `{"q":"b"}`),
			toolResult("call_1", `{"ok":false}`),
			toolResult("call_0", `{"ok":true}`),
		},
	}

	got, err := OpenAIChatRequestToGeminiGenerateContent(context.Background(), req, &convmeta.Values{ChannelMetaAttached: true})
	require.NoError(t, err)
	require.NoError(t, geminiFunctionCallHistoryAligned(got.Contents))

	require.Len(t, got.Contents, 5)
	assert.Equal(t, []string{"user", "model", "user", "model", "user"}, geminiRoles(got.Contents))
	assert.Equal(t, "call_s0", got.Contents[1].Parts[0].FunctionCall.ID)
	assert.Equal(t, "call_s0", kitutil.JsonRawMessageToString(got.Contents[2].Parts[0].FunctionResponse.ID))
	assert.Equal(t, "call_0", got.Contents[3].Parts[0].FunctionCall.ID)
	assert.Equal(t, "call_1", got.Contents[3].Parts[1].FunctionCall.ID)
	assert.Equal(t, "call_0", kitutil.JsonRawMessageToString(got.Contents[4].Parts[0].FunctionResponse.ID))
	assert.Equal(t, "call_1", kitutil.JsonRawMessageToString(got.Contents[4].Parts[1].FunctionResponse.ID))
}

func TestOpenAIChatToGeminiDoesNotInventFunctionResponsesForUserText(t *testing.T) {
	assistant := dto.Message{Role: "assistant"}
	assistant.SetToolCalls([]dto.ToolCallRequest{
		{
			ID:   "call_0",
			Type: "function",
			Function: dto.FunctionRequest{
				Name:      "alpha",
				Arguments: `{"q":"a"}`,
			},
		},
		{
			ID:   "call_1",
			Type: "function",
			Function: dto.FunctionRequest{
				Name:      "beta",
				Arguments: `{"q":"b"}`,
			},
		},
	})
	req := dto.GeneralOpenAIRequest{
		Model: "gemini-test",
		Messages: []dto.Message{
			{Role: "user", Content: "run tools"},
			assistant,
			{Role: "user", Content: "never mind, skip the tools."},
		},
	}

	got, err := OpenAIChatRequestToGeminiGenerateContent(context.Background(), req, &convmeta.Values{ChannelMetaAttached: true})
	require.NoError(t, err)
	require.NoError(t, geminiFunctionCallHistoryAligned(got.Contents))

	require.Len(t, got.Contents, 3)
	require.Len(t, got.Contents[2].Parts, 1)
	assert.Nil(t, got.Contents[2].Parts[0].FunctionResponse)
	assert.Equal(t, "never mind, skip the tools.", got.Contents[2].Parts[0].Text)
}

func TestOpenAIChatToGeminiAlignsNameOnlyFunctionResponses(t *testing.T) {
	beta := "beta"
	req := dto.GeneralOpenAIRequest{
		Model: "gemini-test",
		Messages: []dto.Message{
			{Role: "user", Content: "run tools"},
			assistantToolCall("call_0", "alpha", `{"q":"a"}`),
			assistantToolCall("call_1", "beta", `{"q":"b"}`),
			toolResult("call_0", `{"ok":true}`),
			{Role: "tool", Name: &beta, Content: `{"ok":false}`},
		},
	}

	got, err := OpenAIChatRequestToGeminiGenerateContent(context.Background(), req, &convmeta.Values{ChannelMetaAttached: true})
	require.NoError(t, err)
	require.NoError(t, geminiFunctionCallHistoryAligned(got.Contents))

	require.Len(t, got.Contents, 3)
	require.Len(t, got.Contents[2].Parts, 2)
	assert.Equal(t, "call_0", kitutil.JsonRawMessageToString(got.Contents[2].Parts[0].FunctionResponse.ID))
	assert.Equal(t, "beta", got.Contents[2].Parts[1].FunctionResponse.Name)
	assert.Equal(t, "", kitutil.JsonRawMessageToString(got.Contents[2].Parts[1].FunctionResponse.ID))
	assert.Equal(t, false, got.Contents[2].Parts[1].FunctionResponse.Response["ok"])
}

func TestOpenAIChatToGeminiMergesConsecutiveAssistantFunctionCallsAfterSystem(t *testing.T) {
	req := dto.GeneralOpenAIRequest{
		Model: "gemini-test",
		Messages: []dto.Message{
			{Role: "system", Content: "You are a helper."},
			assistantToolCall("call_0", "alpha", `{"q":"a"}`),
			assistantToolCall("call_1", "beta", `{"q":"b"}`),
			toolResult("call_0", `{"ok":true}`),
			toolResult("call_1", `{"ok":false}`),
		},
	}

	got, err := OpenAIChatRequestToGeminiGenerateContent(context.Background(), req, &convmeta.Values{ChannelMetaAttached: true})
	require.NoError(t, err)
	require.NoError(t, geminiFunctionCallHistoryAligned(got.Contents))

	require.Len(t, got.Contents, 2)
	assert.Equal(t, []string{"model", "user"}, geminiRoles(got.Contents))
	require.Len(t, got.Contents[0].Parts, 2)
	assert.Equal(t, "call_0", got.Contents[0].Parts[0].FunctionCall.ID)
	assert.Equal(t, "call_1", got.Contents[0].Parts[1].FunctionCall.ID)
	assert.Equal(t, "call_0", kitutil.JsonRawMessageToString(got.Contents[1].Parts[0].FunctionResponse.ID))
	assert.Equal(t, "call_1", kitutil.JsonRawMessageToString(got.Contents[1].Parts[1].FunctionResponse.ID))
	require.NotNil(t, got.SystemInstructions)
	require.Len(t, got.SystemInstructions.Parts, 1)
	assert.Equal(t, "You are a helper.", got.SystemInstructions.Parts[0].Text)
}

func TestOpenAIChatToGeminiKeepsUnmatchedFunctionResponseAfterMissingPlaceholder(t *testing.T) {
	req := dto.GeneralOpenAIRequest{
		Model: "gemini-test",
		Messages: []dto.Message{
			{Role: "user", Content: "run tools"},
			assistantToolCall("call_0", "alpha", `{"q":"a"}`),
			assistantToolCall("call_1", "beta", `{"q":"b"}`),
			toolResult("call_1", `{"ok":false}`),
			toolResult("call_orphan", `{"ok":"extra"}`),
		},
	}

	got, err := OpenAIChatRequestToGeminiGenerateContent(context.Background(), req, &convmeta.Values{ChannelMetaAttached: true})
	require.NoError(t, err)

	require.Len(t, got.Contents, 3)
	require.Len(t, got.Contents[2].Parts, 3)
	assert.Equal(t, "call_0", kitutil.JsonRawMessageToString(got.Contents[2].Parts[0].FunctionResponse.ID))
	assert.Equal(t, "alpha", got.Contents[2].Parts[0].FunctionResponse.Name)
	assert.Equal(t, "missing function response", got.Contents[2].Parts[0].FunctionResponse.Response["conversion_error"])
	assert.Equal(t, "call_1", kitutil.JsonRawMessageToString(got.Contents[2].Parts[1].FunctionResponse.ID))
	assert.Equal(t, "call_orphan", kitutil.JsonRawMessageToString(got.Contents[2].Parts[2].FunctionResponse.ID))
}

func assistantToolCall(id, name, args string) dto.Message {
	msg := dto.Message{Role: "assistant"}
	msg.SetToolCalls([]dto.ToolCallRequest{
		{
			ID:   id,
			Type: "function",
			Function: dto.FunctionRequest{
				Name:      name,
				Arguments: args,
			},
		},
	})
	return msg
}

func assistantTextAndToolCall(text, id, name, args string) dto.Message {
	msg := dto.Message{Role: "assistant", Content: text}
	msg.SetToolCalls([]dto.ToolCallRequest{
		{
			ID:   id,
			Type: "function",
			Function: dto.FunctionRequest{
				Name:      name,
				Arguments: args,
			},
		},
	})
	return msg
}

func toolResult(id, content string) dto.Message {
	return dto.Message{
		Role:       "tool",
		ToolCallId: id,
		Content:    content,
	}
}

func geminiRoles(contents []dto.GeminiChatContent) []string {
	roles := make([]string, 0, len(contents))
	for _, content := range contents {
		roles = append(roles, content.Role)
	}
	return roles
}

// geminiFunctionCallHistoryAligned encodes cliproxy's positional pairing:
// functionResponse parts[i] must match the immediately previous model
// functionCall parts[i] by id.
func geminiFunctionCallHistoryAligned(contents []dto.GeminiChatContent) error {
	for i := 1; i < len(contents); i++ {
		if contents[i].Role != "user" {
			continue
		}
		prev := contents[i-1]
		if prev.Role != "model" {
			continue
		}
		for j, part := range contents[i].Parts {
			if part.FunctionResponse == nil {
				continue
			}
			responseID := kitutil.JsonRawMessageToString(part.FunctionResponse.ID)
			if responseID == "" {
				continue
			}
			if j >= len(prev.Parts) || prev.Parts[j].FunctionCall == nil {
				return fmt.Errorf("contents[%d].parts[%d] functionResponse.id %q has no matching functionCall at contents[%d].parts[%d]", i, j, responseID, i-1, j)
			}
			callID := prev.Parts[j].FunctionCall.ID
			if callID != "" && callID != responseID {
				return fmt.Errorf("contents[%d].parts[%d] functionResponse.id %q does not match functionCall.id %q at contents[%d].parts[%d]", i, j, responseID, callID, i-1, j)
			}
		}
	}
	return nil
}
