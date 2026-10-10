package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/tokenkit"
	"github.com/stretchr/testify/require"
)

// TestTokenCountWireEncoding checks decoding before token estimation.
func TestTokenCountWireEncoding(t *testing.T) {
	escape := string(rune(92)) + "u"
	for _, tc := range []struct {
		name    string
		raw     string
		escaped string
	}{
		{"Chinese", `{"messages":[{"role":"user","content":"中文"}]}`, `{"messages":[{"role":"user","content":"` + escape + `4e2d` + escape + `6587"}]}`},
		{"letters", `{"messages":[{"role":"user","content":"abc"}]}`, `{"messages":[{"role":"user","content":"` + escape + `0061` + escape + `0062` + escape + `0063"}]}`},
		{"emoji", `{"messages":[{"role":"user","content":"😀"}]}`, `{"messages":[{"role":"user","content":"` + escape + `d83d` + escape + `de00"}]}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			require.NotEqual(t, tc.raw, tc.escaped)
			var raw, escaped dto.GeneralOpenAIRequest
			require.NoError(t, common.Unmarshal([]byte(tc.raw), &raw))
			require.NoError(t, common.Unmarshal([]byte(tc.escaped), &escaped))
			rawText := raw.GetTokenCountMeta().CombineText
			escapedText := escaped.GetTokenCountMeta().CombineText
			require.Equal(t, rawText, escapedText)
			for _, model := range []string{"claude-3-5-sonnet", "gemini-2.5-pro"} {
				require.Equal(t, tokenkit.Count(model, rawText), tokenkit.Count(model, escapedText))
			}
		})
	}
}

// TestTokenCountPreservesLiteralEscape checks that ordinary text is not decoded twice.
func TestTokenCountPreservesLiteralEscape(t *testing.T) {
	var request dto.GeneralOpenAIRequest
	require.NoError(t, common.Unmarshal([]byte(`{"messages":[{"role":"user","content":"\\u4e2d"}]}`), &request))
	text := request.GetTokenCountMeta().CombineText
	require.Contains(t, text, string(rune(92))+"u4e2d")
	require.NotContains(t, text, "中")
	for _, model := range []string{"claude-3-5-sonnet", "gemini-2.5-pro"} {
		require.Greater(t, tokenkit.Count(model, text), tokenkit.Count(model, "user\n中"))
	}
}
