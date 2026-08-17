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

func TestValidateResponseChecksToolNameAndArguments(t *testing.T) {
	request := &dto.GeneralOpenAIRequest{Tools: []dto.ToolCallRequest{{Type: "function", Function: dto.FunctionRequest{Name: "weather"}}}}
	assert.Error(t, ValidateResponse(request, types.RelayFormatOpenAI, []byte(`{"choices":[{"message":{"tool_calls":[{"function":{"name":"unknown","arguments":"{}"}}]}}]}`)))
	assert.Error(t, ValidateResponse(request, types.RelayFormatOpenAI, []byte(`{"choices":[{"message":{"tool_calls":[{"function":{"name":"weather","arguments":"bad"}}]}}]}`)))
	require.NoError(t, ValidateResponse(request, types.RelayFormatOpenAI, []byte(`{"choices":[{"message":{"tool_calls":[{"function":{"name":"weather","arguments":"{}"}}]}}]}`)))
}

func TestValidateResponsesAPIRejectsIncompleteResponse(t *testing.T) {
	request := &dto.OpenAIResponsesRequest{}
	assert.Error(t, ValidateResponse(request, types.RelayFormatOpenAIResponses, []byte(`{"status":"incomplete","output":[]}`)))
	require.NoError(t, ValidateResponse(request, types.RelayFormatOpenAIResponses, []byte(`{"status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":"done"}]}]}`)))
}
