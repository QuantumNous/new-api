package toolconv

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func toolSearchRequest(t *testing.T, tool map[string]any, input []map[string]any) *dto.OpenAIResponsesRequest {
	t.Helper()
	request := codexResponsesToolsRequest(t, nil, tool)
	if input != nil {
		encoded, err := kitutil.Marshal(input)
		require.NoError(t, err)
		request.Input = encoded
	}
	return request
}

func TestResponsesClientToolSearchTravelsAsFunction(t *testing.T) {
	t.Parallel()

	request := toolSearchRequest(t,
		map[string]any{
			"type":      "tool_search",
			"execution": "client",
			"parameters": map[string]any{
				"type":       "object",
				"properties": map[string]any{"goal": map[string]any{"type": "string"}},
			},
		},
		[]map[string]any{
			{"type": "tool_search_call", "execution": "client", "call_id": "call_1", "status": "completed", "arguments": map[string]any{"goal": "find a tool"}},
			{"type": "tool_search_output", "execution": "client", "call_id": "call_1", "status": "completed", "tools": []map[string]any{{"type": "function", "name": "loaded"}}},
		},
	)

	extracted, set, err := ExtractRequest(types.RelayFormatOpenAIResponses, request)
	require.NoError(t, err)
	assert.Equal(t, map[string]struct{}{responsesToolSearchDefaultName: {}}, ResponsesToolSearchNames(set))
	assert.True(t, hasDiagnosticCode(set.Diagnostics, "tool_search_history_as_function"))

	// The continuation items become the function call/result pair every other
	// protocol understands, so a pivoted conversation keeps its tool context.
	var rewritten []map[string]any
	require.NoError(t, kitutil.Unmarshal(extracted.(*dto.OpenAIResponsesRequest).Input, &rewritten))
	require.Len(t, rewritten, 2)
	assert.Equal(t, "function_call", rewritten[0]["type"])
	assert.Equal(t, responsesToolSearchDefaultName, rewritten[0]["name"])
	assert.Equal(t, "call_1", rewritten[0]["call_id"])
	assert.Equal(t, `{"goal":"find a tool"}`, rewritten[0]["arguments"])
	assert.Equal(t, "function_call_output", rewritten[1]["type"])
	assert.Equal(t, "call_1", rewritten[1]["call_id"])

	target := &dto.GeneralOpenAIRequest{Model: "gpt-4o", Messages: []dto.Message{{Role: "user", Content: "find a tool"}}}
	attached, diagnostics, err := AttachRequest(types.RelayFormatOpenAI, target, set, &convmeta.Options{})
	require.NoError(t, err)
	assert.True(t, hasDiagnosticCode(diagnostics, "tool_search_as_function"))

	chatRequest, ok := attached.(*dto.GeneralOpenAIRequest)
	require.True(t, ok)
	var names []string
	for _, tool := range chatRequest.Tools {
		if tool.Function.Name == responsesToolSearchDefaultName {
			names = append(names, tool.Function.Name)
		}
	}
	assert.Equal(t, []string{responsesToolSearchDefaultName}, names)
}

func TestResponsesHostedToolSearchStaysUnsupported(t *testing.T) {
	t.Parallel()

	request := toolSearchRequest(t, map[string]any{"type": "tool_search"}, nil)
	_, set, err := ExtractRequest(types.RelayFormatOpenAIResponses, request)
	require.NoError(t, err)
	assert.Empty(t, ResponsesToolSearchNames(set))
	for _, definition := range set.Definitions {
		if definition.Kind != KindToolSearch {
			continue
		}
		assert.Equal(t, ExecutionServer, definition.Execution)
	}

	target := &dto.GeneralOpenAIRequest{Model: "gpt-4o", Messages: []dto.Message{{Role: "user", Content: "hi"}}}
	attached, diagnostics, err := AttachRequest(types.RelayFormatOpenAI, target, set, &convmeta.Options{ToolLossPolicy: types.ConversionLossPolicyAllow})
	require.NoError(t, err)
	assert.True(t, hasDiagnosticCode(diagnostics, "unsupported_hosted_tool"))
	chatRequest, ok := attached.(*dto.GeneralOpenAIRequest)
	require.True(t, ok)
	for _, tool := range chatRequest.Tools {
		assert.NotEqual(t, "tool_search", tool.Function.Name)
	}
}

func TestResponsesToolSearchNameConflictDropsTheSearch(t *testing.T) {
	t.Parallel()

	tools, err := kitutil.Marshal([]map[string]any{
		{"type": "function", "name": "tool_search", "parameters": map[string]any{"type": "object"}},
		{"type": "tool_search", "execution": "client"},
	})
	require.NoError(t, err)
	request := &dto.OpenAIResponsesRequest{Model: "gpt-test", Tools: tools}

	_, set, err := ExtractRequest(types.RelayFormatOpenAIResponses, request)
	require.NoError(t, err)
	require.Empty(t, ResponsesToolSearchNames(set))

	target := &dto.GeneralOpenAIRequest{Model: "gpt-4o", Messages: []dto.Message{{Role: "user", Content: "hi"}}}
	_, diagnostics, err := AttachRequest(types.RelayFormatOpenAI, target, set, &convmeta.Options{})
	require.NoError(t, err)
	assert.True(t, hasDiagnosticCode(diagnostics, "tool_search_name_conflict"))
}
