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

func geminiCodeExecutionRequest(t *testing.T) *dto.GeminiChatRequest {
	t.Helper()
	tools, err := kitutil.Marshal([]map[string]any{{"codeExecution": map[string]any{}}})
	require.NoError(t, err)
	return &dto.GeminiChatRequest{
		Contents: []dto.GeminiChatContent{
			{Role: "user", Parts: []dto.GeminiPart{{Text: "run this"}}},
		},
		Tools: tools,
	}
}

func hasDiagnosticCode(diagnostics []types.ConversionDiagnostic, code string) bool {
	for _, diagnostic := range diagnostics {
		if diagnostic.Code == code {
			return true
		}
	}
	return false
}

func TestDefaultPolicyAllowsGeminiCodeExecutionToOpenAI(t *testing.T) {
	t.Parallel()

	_, set, err := ExtractRequest(types.RelayFormatGemini, geminiCodeExecutionRequest(t))
	require.NoError(t, err)
	target := &dto.GeneralOpenAIRequest{
		Model:    "gpt-4o",
		Messages: []dto.Message{{Role: "user", Content: "run this"}},
	}

	out, diagnostics, err := AttachRequest(types.RelayFormatOpenAI, target, set, &convmeta.Options{})
	require.NoError(t, err)
	require.NotNil(t, out)
	assert.True(t, hasDiagnosticCode(diagnostics, "unsupported_hosted_tool"))
	assert.Equal(t, types.ConversionLossPolicyAllow, (&convmeta.Options{}).EffectiveToolLossPolicy())
}

func TestResponsePhaseNeverRejectsEvenUnderStrictPolicy(t *testing.T) {
	t.Parallel()

	text := "hello"
	resp := &dto.ClaudeResponse{
		Type:       "message",
		Role:       "assistant",
		StopReason: "pause_turn",
		Content: []dto.ClaudeMediaMessage{
			{Type: "redacted_thinking", Data: "secret"},
			{Type: "text", Text: &text},
		},
	}
	diagnostics := InspectResponse(types.RelayFormatClaude, types.RelayFormatOpenAI, resp)
	require.True(t, hasDiagnosticCode(diagnostics, "continuation_state_lost"))
	require.Error(t, types.RejectConversionLoss(types.ConversionLossPolicyStrict, diagnostics))

	_, hosted, err := ExtractHostedResponse(types.RelayFormatClaude, resp)
	require.NoError(t, err)
	out, _, err := AttachHostedResponse(
		types.RelayFormatOpenAI,
		&dto.OpenAITextResponse{},
		hosted,
		&convmeta.Options{ToolLossPolicy: types.ConversionLossPolicyStrict},
	)
	require.NoError(t, err)
	require.NotNil(t, out)
}

func TestSafePolicyRejectsRequestPhaseHostedToolLoss(t *testing.T) {
	t.Parallel()

	_, set, err := ExtractRequest(types.RelayFormatGemini, geminiCodeExecutionRequest(t))
	require.NoError(t, err)
	target := &dto.GeneralOpenAIRequest{
		Model:    "gpt-4o",
		Messages: []dto.Message{{Role: "user", Content: "run this"}},
	}

	_, diagnostics, err := AttachRequest(
		types.RelayFormatOpenAI,
		target,
		set,
		&convmeta.Options{ToolLossPolicy: types.ConversionLossPolicySafe},
	)
	require.Error(t, err)
	var loss *types.ConversionLossError
	require.ErrorAs(t, err, &loss)
	require.NotEmpty(t, loss.Diagnostics)
	assert.True(t, hasDiagnosticCode(loss.Diagnostics, "unsupported_hosted_tool"))
	assert.True(t, hasDiagnosticCode(diagnostics, "unsupported_hosted_tool"))
}

func codexResponsesToolsRequest(t *testing.T, toolChoice any, extraTools ...map[string]any) *dto.OpenAIResponsesRequest {
	t.Helper()
	tools := []map[string]any{
		{
			"type":        "custom",
			"name":        "exec",
			"description": "Run code.",
			"format":      map[string]any{"type": "grammar", "syntax": "lark", "definition": "start: /.+/"},
		},
		{"type": "function", "name": "wait", "parameters": map[string]any{"type": "object"}},
	}
	tools = append(tools, extraTools...)
	rawTools, err := kitutil.Marshal(tools)
	require.NoError(t, err)
	request := &dto.OpenAIResponsesRequest{Model: "gpt-test", Tools: rawTools}
	if toolChoice != nil {
		request.ToolChoice, err = kitutil.Marshal(toolChoice)
		require.NoError(t, err)
	}
	return request
}

func TestResponsesCustomToolReachesChatAsStringInputFunction(t *testing.T) {
	t.Parallel()

	_, set, err := ExtractRequest(types.RelayFormatOpenAIResponses, codexResponsesToolsRequest(t, map[string]any{"type": "custom", "name": "exec"}))
	require.NoError(t, err)

	out, diagnostics, err := AttachRequest(types.RelayFormatOpenAI, &dto.GeneralOpenAIRequest{Model: "gpt-test"}, set, &convmeta.Options{ToolLossPolicy: types.ConversionLossPolicySafe})
	require.NoError(t, err)
	target := out.(*dto.GeneralOpenAIRequest)
	require.Len(t, target.Tools, 2)
	exec := target.Tools[0]
	assert.Equal(t, "function", exec.Type)
	assert.Equal(t, "exec", exec.Function.Name)
	assert.Contains(t, exec.Function.Description, "Run code.")
	assert.Contains(t, exec.Function.Description, "Lark grammar:\nstart: /.+/")
	assert.Nil(t, exec.Function.Strict)
	assert.Equal(t, map[string]any{
		"type": "object",
		"properties": map[string]any{
			"input": map[string]any{"type": "string", "description": "Raw input for the tool."},
		},
		"required":             []string{"input"},
		"additionalProperties": false,
	}, exec.Function.Parameters)
	assert.Equal(t, "wait", target.Tools[1].Function.Name)
	assert.Equal(t, map[string]any{"type": "function", "function": map[string]any{"name": "exec"}}, target.ToolChoice)
	assert.True(t, hasDiagnosticCode(diagnostics, "custom_tool_as_function"))
	assert.False(t, hasDiagnosticCode(diagnostics, "unsupported_hosted_tool"))
	assert.False(t, hasDiagnosticCode(diagnostics, "unsupported_tool_choice"))
	assert.Equal(t, map[string]struct{}{"exec": {}}, OpenAIChatCustomToolNames(set))

	_, _, err = AttachRequest(types.RelayFormatOpenAI, &dto.GeneralOpenAIRequest{Model: "gpt-test"}, set, &convmeta.Options{ToolLossPolicy: types.ConversionLossPolicyStrict})
	var loss *types.ConversionLossError
	require.ErrorAs(t, err, &loss)
	assert.True(t, hasDiagnosticCode(loss.Diagnostics, "custom_tool_as_function"))
}

func TestResponsesCustomToolNameConflictIsDropped(t *testing.T) {
	t.Parallel()

	request := codexResponsesToolsRequest(t, nil,
		map[string]any{"type": "function", "name": "exec", "parameters": map[string]any{"type": "object"}},
		map[string]any{"type": "custom", "name": "apply_patch"},
		map[string]any{"type": "custom", "name": "apply_patch", "description": "duplicate"},
	)
	_, set, err := ExtractRequest(types.RelayFormatOpenAIResponses, request)
	require.NoError(t, err)

	out, diagnostics, err := AttachRequest(types.RelayFormatOpenAI, &dto.GeneralOpenAIRequest{Model: "gpt-test"}, set, &convmeta.Options{})
	require.NoError(t, err)
	target := out.(*dto.GeneralOpenAIRequest)
	names := make([]string, 0, len(target.Tools))
	for _, tool := range target.Tools {
		names = append(names, tool.Function.Name)
	}
	assert.Equal(t, []string{"wait", "exec", "apply_patch"}, names)
	assert.Equal(t, map[string]any{"type": "object"}, target.Tools[1].Function.Parameters)
	assert.NotContains(t, target.Tools[2].Function.Description, "duplicate")
	assert.True(t, hasDiagnosticCode(diagnostics, "custom_tool_name_conflict"))
	assert.Equal(t, map[string]struct{}{"apply_patch": {}}, OpenAIChatCustomToolNames(set))

	_, _, err = AttachRequest(types.RelayFormatOpenAI, &dto.GeneralOpenAIRequest{Model: "gpt-test"}, set, &convmeta.Options{ToolLossPolicy: types.ConversionLossPolicySafe})
	require.Error(t, err)
}
