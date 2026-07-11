package openai

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// sseLines joins data payloads into raw SSE text the way an upstream would
// send it: each payload on its own "data: ...\n\n" line.
func sseLines(payloads ...string) string {
	var b strings.Builder
	for _, p := range payloads {
		b.WriteString("data: ")
		b.WriteString(p)
		b.WriteString("\n\n")
	}
	return b.String()
}

func mustJSON(t *testing.T, v any) string {
	t.Helper()
	b, err := common.Marshal(v)
	require.NoError(t, err)
	return string(b)
}

func intPtr(v int) *int      { return &v }
func strPtr(v string) *string { return &v }

// ---------------------------------------------------------------------------
// Content accumulation
// ---------------------------------------------------------------------------

func TestAccumulate_ContentOnly(t *testing.T) {
	chunks := sseLines(
		mustJSON(t, dto.ChatCompletionsStreamResponse{
			Id: "chatcmpl-1", Model: "gpt-4o", Created: 1700000000,
			Choices: []dto.ChatCompletionsStreamResponseChoice{
				{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Role: "assistant"}},
			},
		}),
		mustJSON(t, dto.ChatCompletionsStreamResponse{
			Choices: []dto.ChatCompletionsStreamResponseChoice{
				{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: strPtr("Hello")}},
			},
		}),
		mustJSON(t, dto.ChatCompletionsStreamResponse{
			Choices: []dto.ChatCompletionsStreamResponseChoice{
				{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: strPtr(", world!")}, FinishReason: strPtr("stop")},
			},
		}),
	)

	acc, err := accumulateSSEChunks(chunks)
	require.NoError(t, err)
	require.False(t, acc.isEmpty())

	resp := acc.assemble("gpt-4o", &dto.Usage{PromptTokens: 10, CompletionTokens: 5, TotalTokens: 15})

	assert.Equal(t, "chatcmpl-1", resp.Id)
	assert.Equal(t, "chat.completion", resp.Object)
	assert.Equal(t, "gpt-4o", resp.Model)
	require.Len(t, resp.Choices, 1)
	assert.Equal(t, "assistant", resp.Choices[0].Message.Role)
	assert.Equal(t, "Hello, world!", resp.Choices[0].Message.StringContent())
	assert.Equal(t, "stop", resp.Choices[0].FinishReason)
}

func TestAccumulate_ReasoningContent(t *testing.T) {
	chunks := sseLines(
		mustJSON(t, dto.ChatCompletionsStreamResponse{
			Id: "r1", Model: "o1",
			Choices: []dto.ChatCompletionsStreamResponseChoice{
				{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Role: "assistant"}},
			},
		}),
		mustJSON(t, dto.ChatCompletionsStreamResponse{
			Choices: []dto.ChatCompletionsStreamResponseChoice{
				{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ReasoningContent: strPtr("Thinking...")}},
			},
		}),
		mustJSON(t, dto.ChatCompletionsStreamResponse{
			Choices: []dto.ChatCompletionsStreamResponseChoice{
				{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: strPtr("Answer")}, FinishReason: strPtr("stop")},
			},
		}),
	)

	acc, err := accumulateSSEChunks(chunks)
	require.NoError(t, err)

	resp := acc.assemble("o1", &dto.Usage{})
	require.Len(t, resp.Choices, 1)
	assert.Equal(t, "Answer", resp.Choices[0].Message.StringContent())
	assert.Equal(t, "Thinking...", resp.Choices[0].Message.GetReasoningContent())
}

// ---------------------------------------------------------------------------
// Tool call accumulation
// ---------------------------------------------------------------------------

func TestAccumulate_ToolCallSplitArguments(t *testing.T) {
	chunks := sseLines(
		mustJSON(t, dto.ChatCompletionsStreamResponse{
			Id: "tc1", Model: "gpt-4o",
			Choices: []dto.ChatCompletionsStreamResponseChoice{
				{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					Role: "assistant",
					ToolCalls: []dto.ToolCallResponse{
						{Index: intPtr(0), ID: "call_abc", Type: "function", Function: dto.FunctionResponse{Name: "get_weather"}},
					},
				}},
			},
		}),
		mustJSON(t, dto.ChatCompletionsStreamResponse{
			Choices: []dto.ChatCompletionsStreamResponseChoice{
				{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					ToolCalls: []dto.ToolCallResponse{
						{Index: intPtr(0), Function: dto.FunctionResponse{Arguments: `{"loc`}},
					},
				}},
			},
		}),
		mustJSON(t, dto.ChatCompletionsStreamResponse{
			Choices: []dto.ChatCompletionsStreamResponseChoice{
				{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					ToolCalls: []dto.ToolCallResponse{
						{Index: intPtr(0), Function: dto.FunctionResponse{Arguments: `ation":"NYC"}`}},
					},
				}, FinishReason: strPtr("tool_calls")},
			},
		}),
	)

	acc, err := accumulateSSEChunks(chunks)
	require.NoError(t, err)

	resp := acc.assemble("gpt-4o", &dto.Usage{})
	require.Len(t, resp.Choices, 1)

	toolCalls := resp.Choices[0].Message.ParseToolCalls()
	require.Len(t, toolCalls, 1)
	assert.Equal(t, "call_abc", toolCalls[0].ID)
	assert.Equal(t, "get_weather", toolCalls[0].Function.Name)
	assert.Equal(t, `{"location":"NYC"}`, toolCalls[0].Function.Arguments)
	assert.Equal(t, "tool_calls", resp.Choices[0].FinishReason)
}

func TestAccumulate_MultipleToolCalls(t *testing.T) {
	chunks := sseLines(
		mustJSON(t, dto.ChatCompletionsStreamResponse{
			Id: "mtc1", Model: "gpt-4o",
			Choices: []dto.ChatCompletionsStreamResponseChoice{
				{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					Role: "assistant",
					ToolCalls: []dto.ToolCallResponse{
						{Index: intPtr(0), ID: "call_a", Type: "function", Function: dto.FunctionResponse{Name: "fn_a"}},
						{Index: intPtr(1), ID: "call_b", Type: "function", Function: dto.FunctionResponse{Name: "fn_b"}},
					},
				}},
			},
		}),
		mustJSON(t, dto.ChatCompletionsStreamResponse{
			Choices: []dto.ChatCompletionsStreamResponseChoice{
				{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					ToolCalls: []dto.ToolCallResponse{
						{Index: intPtr(0), Function: dto.FunctionResponse{Arguments: `{"x":1}`}},
						{Index: intPtr(1), Function: dto.FunctionResponse{Arguments: `{"y":2}`}},
					},
				}, FinishReason: strPtr("tool_calls")},
			},
		}),
	)

	acc, err := accumulateSSEChunks(chunks)
	require.NoError(t, err)

	resp := acc.assemble("gpt-4o", &dto.Usage{})
	require.Len(t, resp.Choices, 1)

	toolCalls := resp.Choices[0].Message.ParseToolCalls()
	require.Len(t, toolCalls, 2)
	assert.Equal(t, "call_a", toolCalls[0].ID)
	assert.Equal(t, `{"x":1}`, toolCalls[0].Function.Arguments)
	assert.Equal(t, "call_b", toolCalls[1].ID)
	assert.Equal(t, `{"y":2}`, toolCalls[1].Function.Arguments)

	// maxToolCallsPerChk should be 2 (first chunk had 2 tool calls)
	assert.Equal(t, 2, acc.toolCount())
}

// ---------------------------------------------------------------------------
// Multiple choices (n > 1)
// ---------------------------------------------------------------------------

func TestAccumulate_MultipleChoices(t *testing.T) {
	chunks := sseLines(
		mustJSON(t, dto.ChatCompletionsStreamResponse{
			Id: "mc1", Model: "gpt-4o",
			Choices: []dto.ChatCompletionsStreamResponseChoice{
				{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Role: "assistant", Content: strPtr("A")}},
				{Index: 1, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Role: "assistant", Content: strPtr("B")}},
			},
		}),
		mustJSON(t, dto.ChatCompletionsStreamResponse{
			Choices: []dto.ChatCompletionsStreamResponseChoice{
				{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: strPtr("1")}, FinishReason: strPtr("stop")},
				{Index: 1, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: strPtr("2")}, FinishReason: strPtr("stop")},
			},
		}),
	)

	acc, err := accumulateSSEChunks(chunks)
	require.NoError(t, err)

	resp := acc.assemble("gpt-4o", &dto.Usage{})
	require.Len(t, resp.Choices, 2)
	assert.Equal(t, 0, resp.Choices[0].Index)
	assert.Equal(t, "A1", resp.Choices[0].Message.StringContent())
	assert.Equal(t, 1, resp.Choices[1].Index)
	assert.Equal(t, "B2", resp.Choices[1].Message.StringContent())
}

// ---------------------------------------------------------------------------
// Usage extraction
// ---------------------------------------------------------------------------

func TestAccumulate_UsageFromUpstream(t *testing.T) {
	usage := &dto.Usage{PromptTokens: 100, CompletionTokens: 50, TotalTokens: 150}
	usageChunk := mustJSON(t, dto.ChatCompletionsStreamResponse{
		Id: "u1", Model: "gpt-4o",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Role: "assistant", Content: strPtr("hi")}, FinishReason: strPtr("stop")},
		},
		Usage: usage,
	})
	chunks := sseLines(usageChunk)

	acc, err := accumulateSSEChunks(chunks)
	require.NoError(t, err)
	require.True(t, acc.hasUsage)

	assert.Equal(t, 100, acc.usage.PromptTokens)
	assert.Equal(t, 50, acc.usage.CompletionTokens)
	// lastUsageRawData should be the raw SSE data of the usage-bearing chunk
	assert.Equal(t, usageChunk, acc.lastUsageRawData)
}

func TestAccumulate_UsageFallbackFlag(t *testing.T) {
	chunks := sseLines(
		mustJSON(t, dto.ChatCompletionsStreamResponse{
			Id: "uf1", Model: "gpt-4o",
			Choices: []dto.ChatCompletionsStreamResponseChoice{
				{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Role: "assistant", Content: strPtr("hello")}, FinishReason: strPtr("stop")},
			},
		}),
	)

	acc, err := accumulateSSEChunks(chunks)
	require.NoError(t, err)
	assert.False(t, acc.hasUsage)
	assert.Equal(t, "hello", acc.fullText())
	assert.Empty(t, acc.lastUsageRawData)
}

// ---------------------------------------------------------------------------
// Error detection (now integrated into mergeChunk)
// ---------------------------------------------------------------------------

func TestAccumulate_UpstreamErrorInChunk(t *testing.T) {
	errorChunk := `{"error":{"message":"rate limit exceeded","type":"rate_limit_error","code":"429"}}`
	chunks := sseLines(
		mustJSON(t, dto.ChatCompletionsStreamResponse{
			Id: "err1", Model: "gpt-4o",
			Choices: []dto.ChatCompletionsStreamResponseChoice{
				{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Role: "assistant", Content: strPtr("partial")}},
			},
		}),
		errorChunk,
	)

	acc, err := accumulateSSEChunks(chunks)
	require.NoError(t, err)
	// The error chunk is detected during mergeChunk but accumulateSSEChunks
	// returns the acc without surfacing the error (the handler checks it).
	// Verify the non-error chunk was accumulated.
	assert.False(t, acc.isEmpty())
}

func TestMergeChunk_ReturnsErrorForErrorChunk(t *testing.T) {
	acc := newStreamAccumulator()
	oaiErr, err := acc.mergeChunk(`{"error":{"message":"rate limit","type":"rate_limit_error"}}`)
	require.NoError(t, err)
	require.NotNil(t, oaiErr)
	assert.Equal(t, "rate_limit_error", oaiErr.Type)
	assert.Equal(t, "rate limit", oaiErr.Message)
}

func TestMergeChunk_NoErrorForNormalChunk(t *testing.T) {
	acc := newStreamAccumulator()
	oaiErr, err := acc.mergeChunk(mustJSON(t, dto.ChatCompletionsStreamResponse{
		Id: "ok1",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: strPtr("ok")}},
		},
	}))
	require.NoError(t, err)
	assert.Nil(t, oaiErr)
}

// ---------------------------------------------------------------------------
// Empty stream
// ---------------------------------------------------------------------------

func TestAccumulate_EmptyStream(t *testing.T) {
	acc, err := accumulateSSEChunks("")
	require.NoError(t, err)
	assert.True(t, acc.isEmpty())
}

func TestAccumulate_OnlyDoneMarker(t *testing.T) {
	acc, err := accumulateSSEChunks("data: [DONE]\n\n")
	require.NoError(t, err)
	assert.True(t, acc.isEmpty())
}

// ---------------------------------------------------------------------------
// SSE parsing helpers
// ---------------------------------------------------------------------------

func TestParseSSEData(t *testing.T) {
	tests := []struct {
		line string
		data string
		ok   bool
	}{
		{"data: {\"id\":\"1\"}", `{"id":"1"}`, true},
		{"data:[DONE]", "", false},
		{": comment", "", false},
		{"event: ping", "", false},
		{"data:  ", "", false},
	}
	for _, tt := range tests {
		data, ok := parseSSEData(tt.line)
		assert.Equal(t, tt.ok, ok, "line: %q", tt.line)
		if ok {
			assert.Equal(t, tt.data, data)
		}
	}
}

// ---------------------------------------------------------------------------
// Assembled JSON shape
// ---------------------------------------------------------------------------

func TestAssemble_ProducesValidJSON(t *testing.T) {
	chunks := sseLines(
		mustJSON(t, dto.ChatCompletionsStreamResponse{
			Id: "json1", Model: "gpt-4o", Created: 1700000000,
			Choices: []dto.ChatCompletionsStreamResponseChoice{
				{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Role: "assistant", Content: strPtr("test")}, FinishReason: strPtr("stop")},
			},
			Usage: &dto.Usage{PromptTokens: 5, CompletionTokens: 3, TotalTokens: 8},
		}),
	)

	acc, err := accumulateSSEChunks(chunks)
	require.NoError(t, err)

	resp := acc.assemble("gpt-4o", acc.usage)
	body, err := common.Marshal(resp)
	require.NoError(t, err)

	// Verify the JSON has the expected shape of a non-streaming chat completion
	var raw map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(body, &raw))
	assert.Contains(t, raw, "id")
	assert.Contains(t, raw, "object")
	assert.Contains(t, raw, "model")
	assert.Contains(t, raw, "choices")
	assert.Contains(t, raw, "usage")

	var obj string
	require.NoError(t, json.Unmarshal(raw["object"], &obj))
	assert.Equal(t, "chat.completion", obj)
}
