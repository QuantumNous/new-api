package apicompat

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// response_format → text.format conversion tests
//
// Without this mapping the structured-output constraint is silently dropped on
// the chat→responses path and the model returns free-form text instead of the
// requested json_schema.
// ---------------------------------------------------------------------------

func TestChatCompletionsToResponses_ResponseFormatJSONSchemaFlattened(t *testing.T) {
	req := &ChatCompletionsRequest{
		Model:    "gpt-5.4-mini",
		Messages: []ChatMessage{{Role: "user", Content: json.RawMessage(`"classify"`)}},
		ResponseFormat: json.RawMessage(`{"type":"json_schema","json_schema":{` +
			`"name":"AdvertisingGateResult","strict":true,` +
			`"schema":{"type":"object","additionalProperties":false,` +
			`"properties":{"decision":{"type":"string"}},"required":["decision"]}}}`),
	}

	out, err := ChatCompletionsToResponses(req)
	require.NoError(t, err)
	require.NotNil(t, out.Text, "text must be set")

	var format map[string]any
	require.NoError(t, common.Unmarshal(out.Text.Format, &format))
	assert.Equal(t, "json_schema", format["type"])
	assert.Equal(t, "AdvertisingGateResult", format["name"], "name must be lifted to top level")
	assert.Equal(t, true, format["strict"], "strict must be lifted to top level")
	assert.Contains(t, format, "schema", "schema must be lifted to top level")
	assert.NotContains(t, format, "json_schema", "nested json_schema wrapper must be removed")
}

func TestChatCompletionsToResponses_ResponseFormatJSONObject(t *testing.T) {
	req := &ChatCompletionsRequest{
		Model:          "gpt-5.4-mini",
		Messages:       []ChatMessage{{Role: "user", Content: json.RawMessage(`"x"`)}},
		ResponseFormat: json.RawMessage(`{"type":"json_object"}`),
	}

	out, err := ChatCompletionsToResponses(req)
	require.NoError(t, err)
	require.NotNil(t, out.Text)
	assert.JSONEq(t, `{"type":"json_object"}`, string(out.Text.Format))
}

func TestChatCompletionsToResponses_NoResponseFormat(t *testing.T) {
	req := &ChatCompletionsRequest{
		Model:    "gpt-5.4-mini",
		Messages: []ChatMessage{{Role: "user", Content: json.RawMessage(`"x"`)}},
	}

	out, err := ChatCompletionsToResponses(req)
	require.NoError(t, err)
	assert.Nil(t, out.Text, "text must stay nil when no response_format is provided")
}

func TestConvertChatResponseFormatToResponsesTextFormat(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string // empty => expect nil
	}{
		{
			name: "json_schema flattened",
			in:   `{"type":"json_schema","json_schema":{"name":"X","strict":true,"schema":{"type":"object"}}}`,
			want: `{"type":"json_schema","name":"X","strict":true,"schema":{"type":"object"}}`,
		},
		{"json_object", `{"type":"json_object"}`, `{"type":"json_object"}`},
		{"text", `{"type":"text"}`, `{"type":"text"}`},
		{"empty input", ``, ``},
		{"no type", `{"json_schema":{"name":"X"}}`, ``},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := convertChatResponseFormatToResponsesTextFormat(json.RawMessage(tc.in))
			if tc.want == "" {
				assert.Nil(t, got)
				return
			}
			assert.JSONEq(t, tc.want, string(got))
		})
	}
}
