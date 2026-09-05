package service

import (
	"strings"
	"testing"
)

// Golden tests: 精确锁定每个 provider 的 token 估算结果，防止优化引入行为变更
func TestEstimateToken_Golden(t *testing.T) {
	tests := []struct {
		name     string
		provider Provider
		text     string
		want     int
	}{
		// 英文
		{"english/openai", OpenAI, "Hello world, this is a test sentence with some numbers 12345.", 17},
		{"english/claude", Claude, "Hello world, this is a test sentence with some numbers 12345.", 18},
		{"english/gemini", Gemini, "Hello world, this is a test sentence with some numbers 12345.", 18},
		// 中文
		{"chinese/openai", OpenAI, "你好世界，这是一段测试文本。", 11},
		{"chinese/claude", Claude, "你好世界，这是一段测试文本。", 16},
		{"chinese/gemini", Gemini, "你好世界，这是一段测试文本。", 9},
		// 混合文本（含 @, URL）
		{"mixed/openai", OpenAI, "Hello 你好 world 世界 123 test@email.com https://example.com/path?q=1&a=2", 33},
		{"mixed/claude", Claude, "Hello 你好 world 世界 123 test@email.com https://example.com/path?q=1&a=2", 39},
		{"mixed/gemini", Gemini, "Hello 你好 world 世界 123 test@email.com https://example.com/path?q=1&a=2", 38},
		// 数学符号
		{"math/openai", OpenAI, "∑∫∂√∞ x² + y³ = z⁴", 25},
		{"math/claude", Claude, "∑∫∂√∞ x² + y³ = z⁴", 35},
		{"math/gemini", Gemini, "∑∫∂√∞ x² + y³ = z⁴", 20},
		// Emoji
		{"emoji/openai", OpenAI, "Hello 😀🎉🚀 World", 10},
		{"emoji/claude", Claude, "Hello 😀🎉🚀 World", 11},
		{"emoji/gemini", Gemini, "Hello 😀🎉🚀 World", 6},
		// 空格和换行
		{"spaces_newlines/openai", OpenAI, "line1\nline2\tindented  double", 10},
		{"spaces_newlines/claude", Claude, "line1\nline2\tindented  double", 11},
		{"spaces_newlines/gemini", Gemini, "line1\nline2\tindented  double", 13},
		// \r \f \v — 走 Space 权重（和 unicode.IsSpace 旧行为一致）
		{"cr_ff_vt/openai", OpenAI, "a\rb\fc\vd", 6},
		{"cr_ff_vt/claude", Claude, "a\rb\fc\vd", 6},
		{"cr_ff_vt/gemini", Gemini, "a\rb\fc\vd", 6},
		// URL 密集
		{"url_heavy/openai", OpenAI, "https://example.com/path/to/resource?key=value&foo=bar#section", 23},
		{"url_heavy/claude", Claude, "https://example.com/path/to/resource?key=value&foo=bar#section", 27},
		{"url_heavy/gemini", Gemini, "https://example.com/path/to/resource?key=value&foo=bar#section", 27},
		// @ 符号
		{"at_sign/openai", OpenAI, "user@example.com @mention", 9},
		{"at_sign/claude", Claude, "user@example.com @mention", 11},
		{"at_sign/gemini", Gemini, "user@example.com @mention", 11},
		// 空字符串
		{"empty/openai", OpenAI, "", 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := EstimateToken(tt.provider, tt.text)
			if got != tt.want {
				t.Errorf("EstimateToken(%s, %q) = %d, want %d", tt.provider, tt.text, got, tt.want)
			}
		})
	}
}

func TestEstimateTokenByModel(t *testing.T) {
	tests := []struct {
		model string
		text  string
		want  int
	}{
		{"gpt-4o", "Hello world 你好", 5},
		{"gemini-pro", "Hello world 你好", 5},
		{"claude-3-sonnet", "Hello world 你好", 6},
		{"gpt-4o", "", 0},
	}
	for _, tt := range tests {
		t.Run(tt.model, func(t *testing.T) {
			got := EstimateTokenByModel(tt.model, tt.text)
			if got != tt.want {
				t.Errorf("EstimateTokenByModel(%q, %q) = %d, want %d", tt.model, tt.text, got, tt.want)
			}
		})
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
