package service

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStreamingEstimateByModelMatchesEstimateTokenByModel(t *testing.T) {
	cases := []struct {
		name   string
		model  string
		chunks []string
	}{
		{
			name:  "openai ascii split word",
			model: "gpt-5.5",
			chunks: []string{
				"Deterministic account",
				"ing validation with 123",
				"456 and https://example.com/a?b=c",
			},
		},
		{
			name:  "claude cjk and symbols",
			model: "claude-opus-4-8",
			chunks: []string{
				"中文混合 English ",
				"∑∫√ and emoji ✅",
				"\nnew line",
			},
		},
		{
			name:  "gemini long mixed",
			model: "gemini-2.5-pro",
			chunks: []string{
				strings.Repeat("alpha123 中文 ", 100),
				strings.Repeat(" /path?x=y&z=1\n", 100),
			},
		},
		{
			name:   "empty text remains zero",
			model:  "gpt-5.5",
			chunks: nil,
		},
		{
			name:  "whitespace only",
			model: "gpt-5.5",
			chunks: []string{
				" ",
				"\n\t",
				"  ",
			},
		},
		{
			name:  "symbols and mixed word boundaries",
			model: "claude-opus-4-8",
			chunks: []string{
				"abc",
				"123",
				"xyz@example.com",
				" ∑∫√∞ /:?&=;#%",
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			joined := strings.Join(tc.chunks, "")
			estimator := NewStreamingEstimateByModel(tc.model)
			for _, chunk := range tc.chunks {
				estimator.WriteString(chunk)
			}
			got := estimator.Tokens()
			want := EstimateTokenByModel(tc.model, joined)
			require.Equal(t, want, got)
		})
	}
}

func TestStreamingEstimateByModelMatchesSplitUTF8(t *testing.T) {
	text := "emoji ✅ 中文 ∑ math and URL https://example.com/a?b=c"
	data := []byte(text)
	estimator := NewStreamingEstimateByModel("claude-opus-4-8")
	for i := 0; i < len(data); i++ {
		estimator.WriteString(string(data[i : i+1]))
	}
	got := estimator.Tokens()
	want := EstimateTokenByModel("claude-opus-4-8", text)
	require.Equal(t, want, got)
}

func TestStreamingEstimateByModelMatchesTrailingInvalidUTF8(t *testing.T) {
	chunks := []string{"valid 中文 ", string([]byte{0xe2, 0x82})}
	text := strings.Join(chunks, "")
	estimator := NewStreamingEstimateByModel("gpt-5.5")
	for _, chunk := range chunks {
		estimator.WriteString(chunk)
	}
	got := estimator.Tokens()
	want := EstimateTokenByModel("gpt-5.5", text)
	require.Equal(t, want, got)
}

func TestStreamingEstimateByModelMatchesPendingPlusMoreText(t *testing.T) {
	data := []byte("✅abc123中文")
	chunks := []string{
		string(data[:1]),
		string(data[1:5]),
		string(data[5:]),
	}
	text := strings.Join(chunks, "")
	estimator := NewStreamingEstimateByModel("gemini-2.5-pro")
	for _, chunk := range chunks {
		estimator.WriteString(chunk)
	}
	got := estimator.Tokens()
	want := EstimateTokenByModel("gemini-2.5-pro", text)
	require.Equal(t, want, got)
}

func TestStreamingEstimateToUsageMatchesResponseText2Usage(t *testing.T) {
	text := "Reasoning summary 123\n\nVisible output 中文 with https://example.com/a?b=c"
	model := "gpt-5.5"
	promptTokens := 37

	streaming := NewStreamingEstimateByModel(model)
	for _, chunk := range []string{"Reasoning summary 123", "\n\nVisible output 中文", " with https://example.com/a?b=c"} {
		streaming.WriteString(chunk)
	}

	gotContext, _ := gin.CreateTestContext(httptest.NewRecorder())
	got := StreamingEstimate2Usage(gotContext, streaming, promptTokens)

	wantContext, _ := gin.CreateTestContext(httptest.NewRecorder())
	want := ResponseText2Usage(wantContext, text, model, promptTokens)

	assert.Equal(t, want.PromptTokens, got.PromptTokens)
	assert.Equal(t, want.CompletionTokens, got.CompletionTokens)
	assert.Equal(t, want.TotalTokens, got.TotalTokens)
	assert.True(t, common.GetContextKeyBool(gotContext, constant.ContextKeyLocalCountTokens))
}
