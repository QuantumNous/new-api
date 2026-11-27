package dto

import (
	"testing"

	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Gemini's Part.data is a proto oneof: a re-marshaled part must never lose
// its only data field, or upstream rejects it as an uninitialized oneof.
func TestGeminiPartRoundTripKeepsOneofData(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{name: "bare empty text", in: `{"text":""}`, want: `{"text":""}`},
		{name: "empty text with signature", in: `{"text":"","thoughtSignature":"c2ln"}`, want: `{"text":"","thoughtSignature":"c2ln"}`},
		{name: "empty thought text", in: `{"text":"","thought":true}`, want: `{"text":"","thought":true}`},
		{name: "text", in: `{"text":"hi"}`, want: `{"text":"hi"}`},
		{name: "thought text with signature", in: `{"text":"plan","thought":true,"thoughtSignature":"c2ln"}`, want: `{"text":"plan","thought":true,"thoughtSignature":"c2ln"}`},
		{name: "function call with signature", in: `{"functionCall":{"name":"f","args":{"a":1}},"thoughtSignature":"c2ln"}`, want: `{"functionCall":{"name":"f","args":{"a":1}},"thoughtSignature":"c2ln"}`},
		{name: "function response", in: `{"functionResponse":{"name":"f","response":{"ok":true}}}`, want: `{"functionResponse":{"name":"f","response":{"ok":true}}}`},
		{name: "snake case inline data", in: `{"inline_data":{"mime_type":"image/png","data":"AA=="}}`, want: `{"inlineData":{"mimeType":"image/png","data":"AA=="}}`},
		{name: "null text", in: `{"text":null}`, want: `{}`},
		{name: "unrecognized member is not turned into text", in: `{"file_data":{"file_uri":"gs://b/v.mp4"}}`, want: `{}`},
		{name: "file data", in: `{"fileData":{"mimeType":"video/mp4","fileUri":"gs://b/v.mp4"}}`, want: `{"fileData":{"mimeType":"video/mp4","fileUri":"gs://b/v.mp4"}}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var part GeminiPart
			require.NoError(t, kitutil.Unmarshal([]byte(tt.in), &part))

			byValue, err := kitutil.Marshal(part)
			require.NoError(t, err)
			assert.JSONEq(t, tt.want, string(byValue))

			byPointer, err := kitutil.Marshal(&part)
			require.NoError(t, err)
			assert.JSONEq(t, tt.want, string(byPointer))
		})
	}
}

func TestGeminiPartBuiltWithEmptyTextKeepsText(t *testing.T) {
	data, err := kitutil.Marshal(GeminiPart{Text: ""})
	require.NoError(t, err)
	assert.JSONEq(t, `{"text":""}`, string(data))
}

func TestGeminiChatRequestKeepsTrailingEmptyTextPart(t *testing.T) {
	in := `{"contents":[{"role":"model","parts":[` +
		`{"text":"thinking","thought":true},` +
		`{"functionCall":{"name":"search","args":{"q":"x"}},"thoughtSignature":"c2ln"},` +
		`{"text":""}` +
		`]}]}`
	var req GeminiChatRequest
	require.NoError(t, kitutil.Unmarshal([]byte(in), &req))

	data, err := kitutil.Marshal(&req)
	require.NoError(t, err)

	var out struct {
		Contents []struct {
			Parts []map[string]any `json:"parts"`
		} `json:"contents"`
	}
	require.NoError(t, kitutil.Unmarshal(data, &out))
	require.Len(t, out.Contents, 1)
	assert.Equal(t, []map[string]any{
		{"text": "thinking", "thought": true},
		{"functionCall": map[string]any{"name": "search", "args": map[string]any{"q": "x"}}, "thoughtSignature": "c2ln"},
		{"text": ""},
	}, out.Contents[0].Parts)
}
