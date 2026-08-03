package service

import (
	"strings"
	"testing"
)

// ---------------------------------------------------------------------------
// 功能正确性测试
// ---------------------------------------------------------------------------

func TestIsMathSymbol(t *testing.T) {
	tests := []struct {
		name string
		r    rune
		want bool
	}{
		// 预计算 map 中的符号
		{"sum", '∑', true},
		{"integral", '∫', true},
		{"partial", '∂', true},
		{"sqrt", '√', true},
		{"infinity", '∞', true},
		{"leq", '≤', true},
		{"geq", '≥', true},
		{"neq", '≠', true},
		{"approx", '≈', true},
		{"plus_minus", '±', true},
		{"times", '×', true},
		{"divide", '÷', true},
		{"superscript_2", '²', true},
		{"superscript_0", '⁰', true},
		{"subscript_0", '₀', true},
		{"subscript_9", '₉', true},
		// Unicode 范围命中 (U+2200–U+22FF)
		{"forall_range", '∀', true},
		{"exists_range", '∃', true},
		// Supplemental Mathematical Operators (U+2A00–U+2AFF)
		{"supplemental_math_2A00", '\u2A00', true},
		// Mathematical Alphanumeric Symbols (U+1D400–U+1D7FF)
		{"math_alpha_1D400", '\U0001D400', true},
		// 非数学符号
		{"ascii_letter", 'a', false},
		{"ascii_digit", '0', false},
		{"space", ' ', false},
		{"comma", ',', false},
		{"period", '.', false},
		{"at_sign", '@', false},
		{"cjk_char", '中', false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isMathSymbol(tt.r); got != tt.want {
				t.Errorf("isMathSymbol(%q) = %v, want %v", tt.r, got, tt.want)
			}
		})
	}
}

func TestIsURLDelim(t *testing.T) {
	tests := []struct {
		r    rune
		want bool
	}{
		{'/', true}, {':', true}, {'?', true}, {'&', true},
		{'=', true}, {';', true}, {'#', true}, {'%', true},
		{'.', false}, {',', false}, {'a', false}, {' ', false},
	}
	for _, tt := range tests {
		t.Run(string(tt.r), func(t *testing.T) {
			if got := isURLDelim(tt.r); got != tt.want {
				t.Errorf("isURLDelim(%q) = %v, want %v", tt.r, got, tt.want)
			}
		})
	}
}

func TestGetMultipliers(t *testing.T) {
	// 已知 provider
	m := getMultipliers(OpenAI)
	if m.Word != 1.02 {
		t.Errorf("OpenAI Word = %v, want 1.02", m.Word)
	}
	m = getMultipliers(Claude)
	if m.CJK != 1.21 {
		t.Errorf("Claude CJK = %v, want 1.21", m.CJK)
	}
	// 未知 provider 应回退到 OpenAI
	m = getMultipliers(Unknown)
	if m.Word != 1.02 {
		t.Errorf("Unknown should fallback to OpenAI, Word = %v, want 1.02", m.Word)
	}
}

func TestEstimateToken_Empty(t *testing.T) {
	if got := EstimateToken(OpenAI, ""); got != 0 {
		t.Errorf("EstimateToken(\"\") = %v, want 0", got)
	}
}

func TestEstimateToken_BasicTypes(t *testing.T) {
	// 纯英文单词
	result := EstimateToken(OpenAI, "hello world")
	if result <= 0 {
		t.Errorf("English text should produce >0 tokens, got %d", result)
	}

	// 纯中文
	result = EstimateToken(OpenAI, "你好世界")
	if result <= 0 {
		t.Errorf("CJK text should produce >0 tokens, got %d", result)
	}

	// 数学符号
	result = EstimateToken(OpenAI, "∑∫∂√∞")
	if result <= 0 {
		t.Errorf("Math symbols should produce >0 tokens, got %d", result)
	}

	// URL
	result = EstimateToken(OpenAI, "https://example.com/path?key=value&foo=bar")
	if result <= 0 {
		t.Errorf("URL should produce >0 tokens, got %d", result)
	}

	// Emoji
	result = EstimateToken(OpenAI, "😀🎉🚀")
	if result <= 0 {
		t.Errorf("Emoji should produce >0 tokens, got %d", result)
	}
}

func TestEstimateToken_Deterministic(t *testing.T) {
	text := "Hello world! 你好世界 ∑∫∂ https://example.com 😀"
	providers := []Provider{OpenAI, Claude, Gemini}
	for _, p := range providers {
		first := EstimateToken(p, text)
		for i := 0; i < 10; i++ {
			if got := EstimateToken(p, text); got != first {
				t.Errorf("EstimateToken(%s) not deterministic: run 0=%d, run %d=%d", p, first, i+1, got)
			}
		}
	}
}

func TestEstimateTokenByModel(t *testing.T) {
	text := "hello world"
	// 空文本
	if got := EstimateTokenByModel("gpt-4o", ""); got != 0 {
		t.Errorf("empty text should return 0, got %d", got)
	}

	// 不同 model 名应路由到不同 provider
	openaiResult := EstimateTokenByModel("gpt-4o", text)
	claudeResult := EstimateTokenByModel("claude-3-sonnet", text)
	geminiResult := EstimateTokenByModel("gemini-1.5-pro", text)

	if openaiResult <= 0 || claudeResult <= 0 || geminiResult <= 0 {
		t.Errorf("All providers should produce >0 tokens: openai=%d, claude=%d, gemini=%d",
			openaiResult, claudeResult, geminiResult)
	}

	// 大小写不敏感
	if EstimateTokenByModel("Claude-3-Sonnet", text) != claudeResult {
		t.Error("EstimateTokenByModel should be case-insensitive")
	}
}

// ---------------------------------------------------------------------------
// 基准测试 — 衡量优化效果
// ---------------------------------------------------------------------------

// 构造测试文本
var (
	// 纯英文 ~1KB
	benchTextEnglish = strings.Repeat("The quick brown fox jumps over the lazy dog. ", 25)

	// 大量数学符号（最受优化影响的场景）
	benchTextMathHeavy = strings.Repeat("∑∫∂√∞≤≥≠≈±×÷∈∉∋∌⊂⊃⊆⊇∪∩∧∨¬∀∃∄∅∆∇∝", 30)

	// 混合内容：英文 + CJK + 数学 + URL + Emoji
	benchTextMixed = strings.Repeat(
		"Hello 你好 ∑∫∂ https://example.com/path?q=1&p=2 😀🎉 world 世界 ≤≥≠ @user\n", 20,
	)

	// 大量 URL 分隔符
	benchTextURL = strings.Repeat("https://api.example.com/v1/users?id=123&token=abc#section;key=val%20encoded/path ", 15)

	// ~10KB 混合文本（模拟真实响应）
	benchTextLarge = strings.Repeat(
		"This is a longer paragraph with mixed content. 这是一段包含中文的混合内容。"+
			"Mathematical formula: ∑(i=1 to n) = n(n+1)/2, where ∫f(x)dx ≈ F(b)-F(a). "+
			"Visit https://docs.example.com/api/v2?lang=en&fmt=json#results for details. "+
			"Contact @admin for help. 😀🎉🚀\n", 20,
	)
)

func BenchmarkEstimateToken_English(b *testing.B) {
	for b.Loop() {
		EstimateToken(OpenAI, benchTextEnglish)
	}
}

func BenchmarkEstimateToken_MathHeavy(b *testing.B) {
	for b.Loop() {
		EstimateToken(OpenAI, benchTextMathHeavy)
	}
}

func BenchmarkEstimateToken_Mixed(b *testing.B) {
	for b.Loop() {
		EstimateToken(OpenAI, benchTextMixed)
	}
}

func BenchmarkEstimateToken_URL(b *testing.B) {
	for b.Loop() {
		EstimateToken(OpenAI, benchTextURL)
	}
}

func BenchmarkEstimateToken_Large(b *testing.B) {
	for b.Loop() {
		EstimateToken(OpenAI, benchTextLarge)
	}
}

// 单独测试辅助函数的性能

func BenchmarkIsMathSymbol_Hit(b *testing.B) {
	for b.Loop() {
		isMathSymbol('∑')
	}
}

func BenchmarkIsMathSymbol_Miss(b *testing.B) {
	for b.Loop() {
		isMathSymbol('a')
	}
}

func BenchmarkIsURLDelim_Hit(b *testing.B) {
	for b.Loop() {
		isURLDelim('/')
	}
}

func BenchmarkIsURLDelim_Miss(b *testing.B) {
	for b.Loop() {
		isURLDelim('a')
	}
}

func BenchmarkGetMultipliers(b *testing.B) {
	for b.Loop() {
		getMultipliers(OpenAI)
	}
}

// 模拟优化前的旧实现，用于对比

func isMathSymbolOld(r rune) bool {
	mathSymbols := "∑∫∂√∞≤≥≠≈±×÷∈∉∋∌⊂⊃⊆⊇∪∩∧∨¬∀∃∄∅∆∇∝∟∠∡∢°′″‴⁺⁻⁼⁽⁾ⁿ₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎²³¹⁴⁵⁶⁷⁸⁹⁰"
	for _, m := range mathSymbols {
		if r == m {
			return true
		}
	}
	if r >= 0x2200 && r <= 0x22FF {
		return true
	}
	if r >= 0x2A00 && r <= 0x2AFF {
		return true
	}
	if r >= 0x1D400 && r <= 0x1D7FF {
		return true
	}
	return false
}

func isURLDelimOld(r rune) bool {
	urlDelims := "/:?&=;#%"
	for _, d := range urlDelims {
		if r == d {
			return true
		}
	}
	return false
}

// 旧版 vs 新版直接对比

func BenchmarkIsMathSymbol_Old_Hit(b *testing.B) {
	for b.Loop() {
		isMathSymbolOld('∑')
	}
}

func BenchmarkIsMathSymbol_Old_Miss(b *testing.B) {
	for b.Loop() {
		isMathSymbolOld('a')
	}
}

func BenchmarkIsURLDelim_Old_Hit(b *testing.B) {
	for b.Loop() {
		isURLDelimOld('/')
	}
}

func BenchmarkIsURLDelim_Old_Miss(b *testing.B) {
	for b.Loop() {
		isURLDelimOld('a')
	}
}
