package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestEstimateToken(t *testing.T) {
	tests := []struct {
		name     string
		provider Provider
		text     string
		want     int
	}{
		{name: "empty", provider: OpenAI, text: "", want: 0},
		{name: "english words", provider: OpenAI, text: "hello world", want: 3},
		{name: "CJK text", provider: OpenAI, text: "你好世界", want: 4},
		{name: "math symbols", provider: OpenAI, text: "∑∫∂√∞", want: 14},
		{name: "URL delimiters", provider: OpenAI, text: "/:?&=;#%", want: 8},
		{name: "unknown provider fallback", provider: Unknown, text: "hello world", want: 3},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, EstimateToken(tt.provider, tt.text))
		})
	}
}

func TestTokenEstimatorCharacterSets(t *testing.T) {
	for _, r := range "∑∫∂√∞≤≥≠≈±×÷∈∉∋∌⊂⊃⊆⊇∪∩∧∨¬∀∃∄∅∆∇∝∟∠∡∢°′″‴⁺⁻⁼⁽⁾ⁿ₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎²³¹⁴⁵⁶⁷⁸⁹⁰" {
		assert.True(t, isMathSymbol(r), "expected %q to be classified as a math symbol", r)
	}

	for _, r := range "/:?&=;#%" {
		assert.True(t, isURLDelim(r), "expected %q to be classified as a URL delimiter", r)
	}

	assert.False(t, isMathSymbol('a'))
	assert.False(t, isURLDelim('a'))
}

func BenchmarkEstimateToken(b *testing.B) {
	text := "Hello 你好 ∑∫∂ https://example.com/path?q=1&p=2 😀🎉 world 世界 ≤≥≠ @user\n"
	for b.Loop() {
		EstimateToken(OpenAI, text)
	}
}
