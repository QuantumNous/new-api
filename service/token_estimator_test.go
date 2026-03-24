package service

import (
	"strings"
	"testing"
)

// 测试用例：确保优化后结果不变
func TestEstimateToken_Correctness(t *testing.T) {
	tests := []struct {
		name     string
		provider Provider
		text     string
	}{
		{"english", OpenAI, "Hello world, this is a test sentence with some numbers 12345."},
		{"chinese", OpenAI, "你好世界，这是一段测试文本。"},
		{"mixed", Claude, "Hello 你好 world 世界 123 test@email.com https://example.com/path?q=1&a=2"},
		{"math", Gemini, "∑∫∂√∞ x² + y³ = z⁴"},
		{"emoji", Claude, "Hello 😀🎉🚀 World"},
		{"empty", OpenAI, ""},
		{"spaces_newlines", OpenAI, "line1\nline2\tindented  double"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := EstimateToken(tt.provider, tt.text)
			if tt.text == "" && result != 0 {
				t.Errorf("expected 0 for empty text, got %d", result)
			}
			if tt.text != "" && result <= 0 {
				t.Errorf("expected positive token count, got %d", result)
			}
		})
	}
}

func TestEstimateTokenByModel(t *testing.T) {
	text := "Hello world 你好"
	if EstimateTokenByModel("gpt-4o", text) <= 0 {
		t.Error("expected positive result for gpt-4o")
	}
	if EstimateTokenByModel("gemini-pro", text) <= 0 {
		t.Error("expected positive result for gemini-pro")
	}
	if EstimateTokenByModel("claude-3-sonnet", text) <= 0 {
		t.Error("expected positive result for claude-3-sonnet")
	}
	if EstimateTokenByModel("gpt-4o", "") != 0 {
		t.Error("expected 0 for empty text")
	}
}

// --- Benchmarks ---

var benchText = strings.Repeat("Hello world, this is a benchmark test. ", 100) +
	strings.Repeat("你好世界，这是性能测试。", 50) +
	strings.Repeat("https://example.com/path?q=1&a=2#frag ", 20) +
	strings.Repeat("∑∫∂√∞ x²+y³=z⁴ ", 10) +
	strings.Repeat("😀🎉🚀 ", 10)

func BenchmarkEstimateToken_OpenAI(b *testing.B) {
	for b.Loop() {
		EstimateToken(OpenAI, benchText)
	}
}

func BenchmarkEstimateToken_Claude(b *testing.B) {
	for b.Loop() {
		EstimateToken(Claude, benchText)
	}
}

func BenchmarkEstimateToken_Gemini(b *testing.B) {
	for b.Loop() {
		EstimateToken(Gemini, benchText)
	}
}

func BenchmarkEstimateToken_PureEnglish(b *testing.B) {
	text := strings.Repeat("The quick brown fox jumps over the lazy dog. ", 200)
	for b.Loop() {
		EstimateToken(OpenAI, text)
	}
}

func BenchmarkEstimateToken_PureChinese(b *testing.B) {
	text := strings.Repeat("人工智能技术正在快速发展和广泛应用。", 200)
	for b.Loop() {
		EstimateToken(OpenAI, text)
	}
}

func BenchmarkEstimateTokenByModel(b *testing.B) {
	for b.Loop() {
		EstimateTokenByModel("gpt-4o-mini", benchText)
	}
}
