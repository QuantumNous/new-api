package intelligent_routing

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateResponseRejectsEmptyTruncatedAndMalformedStructuredOutput(t *testing.T) {
	plain := &dto.GeneralOpenAIRequest{}
	assert.Error(t, ValidateResponse(plain, types.RelayFormatOpenAI, []byte(`{"choices":[]}`)))
	assert.Error(t, ValidateResponse(plain, types.RelayFormatOpenAI, []byte(`{"choices":[{"finish_reason":"length","message":{"content":"partial"}}]}`)))

	structured := &dto.GeneralOpenAIRequest{ResponseFormat: &dto.ResponseFormat{Type: "json_schema"}}
	assert.Error(t, ValidateResponse(structured, types.RelayFormatOpenAI, []byte(`{"choices":[{"finish_reason":"stop","message":{"content":"not-json"}}]}`)))
	require.NoError(t, ValidateResponse(structured, types.RelayFormatOpenAI, []byte(`{"choices":[{"finish_reason":"stop","message":{"content":"{\"ok\":true}"}}]}`)))
}

func TestValidateResponseChecksRequiredJSONSchemaFields(t *testing.T) {
	request := &dto.GeneralOpenAIRequest{ResponseFormat: &dto.ResponseFormat{
		Type:       "json_schema",
		JsonSchema: []byte(`{"name":"answer","schema":{"type":"object","required":["answer"],"properties":{"answer":{"type":"string"}}}}`),
	}}
	assert.Error(t, ValidateResponse(request, types.RelayFormatOpenAI, []byte(`{"choices":[{"message":{"content":"{\"other\":1}"}}]}`)))
	require.NoError(t, ValidateResponse(request, types.RelayFormatOpenAI, []byte(`{"choices":[{"message":{"content":"{\"answer\":\"yes\"}"}}]}`)))
}

func TestValidateResponseRejectsIncompleteCodeFenceForCodeTask(t *testing.T) {
	request := requestWithText("write code")
	assert.Error(t, ValidateResponse(request, types.RelayFormatOpenAI, []byte("{\"choices\":[{\"message\":{\"content\":\"```go\\nfunc main() {}\"}}]}")))
	require.NoError(t, ValidateResponse(request, types.RelayFormatOpenAI, []byte("{\"choices\":[{\"message\":{\"content\":\"```go\\nfunc main() {}\\n```\"}}]}")))
}

func TestValidateResponseChecksToolNameAndArguments(t *testing.T) {
	request := &dto.GeneralOpenAIRequest{Tools: []dto.ToolCallRequest{{Type: "function", Function: dto.FunctionRequest{Name: "weather"}}}}
	assert.Error(t, ValidateResponse(request, types.RelayFormatOpenAI, []byte(`{"choices":[{"message":{"tool_calls":[{"function":{"name":"unknown","arguments":"{}"}}]}}]}`)))
	assert.Error(t, ValidateResponse(request, types.RelayFormatOpenAI, []byte(`{"choices":[{"message":{"tool_calls":[{"function":{"name":"weather","arguments":"bad"}}]}}]}`)))
	require.NoError(t, ValidateResponse(request, types.RelayFormatOpenAI, []byte(`{"choices":[{"message":{"tool_calls":[{"function":{"name":"weather","arguments":"{}"}}]}}]}`)))
}

func TestValidateResponseChecksToolArgumentSchema(t *testing.T) {
	request := &dto.GeneralOpenAIRequest{Tools: []dto.ToolCallRequest{
		{Type: "function", Function: dto.FunctionRequest{
			Name: "weather",
			Parameters: map[string]any{
				"type": "object", "required": []any{"city"},
				"properties": map[string]any{"city": map[string]any{"type": "string"}},
			},
		}},
	}}
	assert.Error(t, ValidateResponse(request, types.RelayFormatOpenAI, []byte(`{"choices":[{"message":{"tool_calls":[{"function":{"name":"weather","arguments":"{}"}}]}}]}`)))
	require.NoError(t, ValidateResponse(request, types.RelayFormatOpenAI, []byte(`{"choices":[{"message":{"tool_calls":[{"function":{"name":"weather","arguments":"{\"city\":\"Paris\"}"}}]}}]}`)))
}

func TestValidateResponsesAPIRejectsIncompleteResponse(t *testing.T) {
	request := &dto.OpenAIResponsesRequest{}
	assert.Error(t, ValidateResponse(request, types.RelayFormatOpenAIResponses, []byte(`{"status":"incomplete","output":[]}`)))
	require.NoError(t, ValidateResponse(request, types.RelayFormatOpenAIResponses, []byte(`{"status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":"done"}]}]}`)))
}

func TestValidateResponsesAPIChecksFunctionCallArguments(t *testing.T) {
	request := &dto.OpenAIResponsesRequest{Tools: []byte(`[{"type":"function","name":"weather","parameters":{"type":"object"}}]`)}
	assert.Error(t, ValidateResponse(request, types.RelayFormatOpenAIResponses, []byte(`{"status":"completed","output":[{"type":"function_call","name":"weather","arguments":"bad"}]}`)))
	require.NoError(t, ValidateResponse(request, types.RelayFormatOpenAIResponses, []byte(`{"status":"completed","output":[{"type":"function_call","name":"weather","arguments":"{}"}]}`)))
}

func TestValidateResponsesAPIChecksJSONSchemaOutput(t *testing.T) {
	request := &dto.OpenAIResponsesRequest{Text: []byte(`{"format":{"type":"json_schema","schema":{"type":"object","required":["answer"]}}}`)}
	assert.Error(t, ValidateResponse(request, types.RelayFormatOpenAIResponses, []byte(`{"status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":"{\"other\":1}"}]}]}`)))
	require.NoError(t, ValidateResponse(request, types.RelayFormatOpenAIResponses, []byte(`{"status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":"{\"answer\":1}"}]}]}`)))
}
