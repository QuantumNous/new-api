package apicompat

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// tool_choice normalization tests
//
// The Responses API requires the forced-function tool_choice in flattened
// shape {"type":"function","name":"X"}. Passing the Chat Completions nested
// shape {"type":"function","function":{"name":"X"}} through unchanged causes
// OpenAI to return: Missing required parameter: 'tool_choice.name'.
// ---------------------------------------------------------------------------

func TestChatCompletionsToResponses_ToolChoiceForcedFunctionFlattened(t *testing.T) {
	req := &ChatCompletionsRequest{
		Model:      "gpt-5.4-mini",
		Messages:   []ChatMessage{{Role: "user", Content: json.RawMessage(`"summarize"`)}},
		ToolChoice: json.RawMessage(`{"type":"function","function":{"name":"OpenAISummaryQuesChatRslt"}}`),
	}

	resp, err := ChatCompletionsToResponses(req)
	require.NoError(t, err)

	var tc map[string]any
	require.NoError(t, common.Unmarshal(resp.ToolChoice, &tc))
	assert.Equal(t, "function", tc["type"])
	assert.Equal(t, "OpenAISummaryQuesChatRslt", tc["name"], "name must be flattened to top level")
	assert.NotContains(t, tc, "function", "nested function object must be removed")
}

func TestNormalizeChatToolChoiceToResponses(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string // expected JSON after normalization
	}{
		{
			name: "forced function nested -> flattened",
			in:   `{"type":"function","function":{"name":"X"}}`,
			want: `{"name":"X","type":"function"}`,
		},
		{
			name: "already responses shape -> unchanged",
			in:   `{"type":"function","name":"X"}`,
			want: `{"type":"function","name":"X"}`,
		},
		{
			name: "string auto -> unchanged",
			in:   `"auto"`,
			want: `"auto"`,
		},
		{
			name: "string required -> unchanged",
			in:   `"required"`,
			want: `"required"`,
		},
		{
			name: "string none -> unchanged",
			in:   `"none"`,
			want: `"none"`,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := normalizeChatToolChoiceToResponses(json.RawMessage(tc.in))
			assert.JSONEq(t, tc.want, string(got))
		})
	}
}
