package dto

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSensitivePromptExtractionAcrossRelayProtocols(t *testing.T) {
	tests := []struct {
		name   string
		marker string
		text   func() string
	}{
		{
			name: "OpenAI Chat", marker: "openai-chat-sensitive-marker",
			text: func() string {
				return (&GeneralOpenAIRequest{Messages: []Message{{
					Role: "user", Content: "openai-chat-sensitive-marker",
				}}}).GetTokenCountMeta().CombineText
			},
		},
		{
			name: "OpenAI Responses input", marker: "responses-sensitive-marker",
			text: func() string {
				return (&OpenAIResponsesRequest{Input: json.RawMessage(`[{"role":"user","content":[{"type":"input_text","text":"responses-sensitive-marker"}]}]`)}).GetTokenCountMeta().CombineText
			},
		},
		{
			name: "OpenAI Responses function output string", marker: "function-output-sensitive-marker",
			text: func() string {
				return (&OpenAIResponsesRequest{Input: json.RawMessage(`[{"type":"function_call_output","call_id":"call_1","output":"function-output-sensitive-marker"}]`)}).GetTokenCountMeta().CombineText
			},
		},
		{
			name: "OpenAI Responses function output parts", marker: "function-parts-sensitive-marker",
			text: func() string {
				return (&OpenAIResponsesRequest{Input: json.RawMessage(`[{"type":"function_call_output","call_id":"call_2","output":[{"type":"output_text","text":"function-parts-sensitive-marker"}]}]`)}).GetTokenCountMeta().CombineText
			},
		},
		{
			name: "OpenAI Responses function output object", marker: "function-object-sensitive-marker",
			text: func() string {
				return (&OpenAIResponsesRequest{Input: json.RawMessage(`[{"type":"function_call_output","call_id":"call_3","output":{"result":"function-object-sensitive-marker"}}]`)}).GetTokenCountMeta().CombineText
			},
		},
		{
			name: "Claude", marker: "claude-sensitive-marker",
			text: func() string {
				return (&ClaudeRequest{Messages: []ClaudeMessage{{
					Role: "user", Content: "claude-sensitive-marker",
				}}}).GetTokenCountMeta().CombineText
			},
		},
		{
			name: "Gemini", marker: "gemini-sensitive-marker",
			text: func() string {
				return (&GeminiChatRequest{Contents: []GeminiChatContent{{
					Role: "user", Parts: []GeminiPart{{Text: "gemini-sensitive-marker"}},
				}}}).GetTokenCountMeta().CombineText
			},
		},
		{
			name: "Image", marker: "image-sensitive-marker",
			text: func() string {
				return (&ImageRequest{Prompt: "image-sensitive-marker"}).GetTokenCountMeta().CombineText
			},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			require.Contains(t, test.text(), test.marker)
		})
	}
}

func TestResponsesFunctionOutputExtractionPreservesWireShape(t *testing.T) {
	raw := []byte(`{"model":"gpt-test","input":[{"type":"function_call_output","call_id":"call_1","output":"tool result"}]}`)
	var request OpenAIResponsesRequest
	require.NoError(t, json.Unmarshal(raw, &request))
	encoded, err := json.Marshal(request)
	require.NoError(t, err)
	require.JSONEq(t, string(raw), string(encoded))
}

func TestResponsesFunctionOutputDoesNotExpandOrdinaryContentParsing(t *testing.T) {
	request := &OpenAIResponsesRequest{Input: json.RawMessage(`[
  {"type":"message","content":{"ordinary":"content-object-marker"}},
  {"type":"message","content":[{"type":"output_text","text":"ordinary-output-text-marker"}]},
  {"type":"function_call_output","output":{"result":"function-output-object-marker"}}
]`)}
	text := request.GetTokenCountMeta().CombineText
	require.NotContains(t, text, "content-object-marker")
	require.NotContains(t, text, "ordinary-output-text-marker")
	require.Contains(t, text, "function-output-object-marker")
}

func TestResponsesFunctionOutputDecodesEscapedObjectStrings(t *testing.T) {
	request := &OpenAIResponsesRequest{Input: json.RawMessage(`[
  {"type":"function_call_output","output":{"result":"\u654f\u611f\u8bcd","nested":["safe"]}}
]`)}
	text := request.GetTokenCountMeta().CombineText
	require.Contains(t, text, "敏感词")
	require.NotContains(t, text, `\u654f\u611f\u8bcd`)
}
