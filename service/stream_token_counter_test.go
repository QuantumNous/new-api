package service

import (
	"math/rand"
	"strings"
	"testing"
)

func randomChunks(text string, r *rand.Rand) []string {
	runes := []rune(text)
	var chunks []string
	i := 0
	for i < len(runes) {
		n := r.Intn(8) + 1
		if i+n > len(runes) {
			n = len(runes) - i
		}
		chunks = append(chunks, string(runes[i:i+n]))
		i += n
	}
	return chunks
}

// streamingEstimator must be bit-for-bit identical to one-shot EstimateToken
// across ordinary chunk splits.
func TestStreamingEstimatorMatchesOneShot(t *testing.T) {
	corpus := []string{
		"Hello, world! This is a test.",
		"function calculate(a, b) { return a + b; }",
		"中文混合 English text 123456789 测试 tokenization",
		"   leading and    multiple   spaces   ",
		"newlines\nand\ttabs\r\nmixed",
		"emoji 😀🎉 and symbols ©®™ €£¥",
		"VeryLongWordWithoutAnySpaces",
		"a b c d e f g h i j k l m n o p",
		"https://example.com/path?query=value&foo=bar#frag",
		"```go\nfunc main() {\n\tfmt.Println(\"hi\")\n}\n```",
		strings.Repeat("repeat ", 200),
		strings.Repeat("无空格连续中文", 100),
		"Mixed123Numbers456And789Letters",
		"\n\n\n\n\n", "     ", "", "single", "a", "  ",
		"user@example.com sends ∑∫∂√ math",
	}
	providers := []Provider{OpenAI, Gemini, Claude}
	r := rand.New(rand.NewSource(1))
	for _, p := range providers {
		for _, text := range corpus {
			whole := EstimateToken(p, text)
			for trial := 0; trial < 30; trial++ {
				e := newStreamingEstimator(p)
				for _, ch := range randomChunks(text, r) {
					e.feed(ch)
				}
				if got := e.result(); got != whole {
					t.Errorf("provider=%s text=%q stream=%d whole=%d", p, text, got, whole)
				}
			}
		}
	}
}

func TestStreamingEstimatorMatchesOneShotWhenMultibyteRunesAreSplit(t *testing.T) {
	text := "prefix 中文 😀 suffix"
	splits := [][]int{
		{1},
		{7, 8, 9},        // Split the first CJK rune byte-by-byte.
		{7, 10, 11, 12},  // Complete one CJK rune, then split the next.
		{14, 15, 16, 17}, // Split the emoji byte-by-byte.
		{7, 8, 10, 14, 16, len([]byte(text))},
	}
	for _, p := range []Provider{OpenAI, Gemini, Claude} {
		want := EstimateToken(p, text)
		for _, split := range splits {
			e := newStreamingEstimator(p)
			start := 0
			data := []byte(text)
			for _, end := range split {
				e.feed(string(data[start:end]))
				start = end
			}
			if start < len(data) {
				e.feed(string(data[start:]))
			}
			if got := e.result(); got != want {
				t.Errorf("provider=%s split=%v: stream=%d whole=%d", p, split, got, want)
			}
		}
	}
}

// Random fuzz including bytes that force multibyte rune splits.
func TestStreamingEstimatorFuzz(t *testing.T) {
	alphabet := []rune(" \n\tabcXYZ012中文测试😀{}()<>/@∑")
	r := rand.New(rand.NewSource(42))
	for _, p := range []Provider{OpenAI, Gemini, Claude} {
		for trial := 0; trial < 500; trial++ {
			n := r.Intn(1500)
			var b strings.Builder
			for i := 0; i < n; i++ {
				b.WriteRune(alphabet[r.Intn(len(alphabet))])
			}
			text := b.String()
			whole := EstimateToken(p, text)
			// split by raw BYTES (not runes) to force multibyte boundary splits
			e := newStreamingEstimator(p)
			data := []byte(text)
			i := 0
			for i < len(data) {
				step := r.Intn(5) + 1
				if i+step > len(data) {
					step = len(data) - i
				}
				e.feed(string(data[i : i+step]))
				i += step
			}
			if got := e.result(); got != whole {
				t.Errorf("provider=%s byte-split mismatch stream=%d whole=%d text=%q", p, got, whole, text[:min(80, len(text))])
			}
		}
	}
}

// UsageAccumulator local count must equal legacy EstimateTokenByModel (gold standard).
func TestUsageAccumulatorGoldStandard(t *testing.T) {
	cases := []struct{ model, text string }{
		{"gpt-5.5", strings.Repeat("This is generated output. ", 500)},
		{"claude-opus-4", strings.Repeat("Claude response text 中文 ", 300)},
		{"gemini-3-pro", strings.Repeat("Gemini output 12345 ", 400)},
		{"gpt-4o", "short"},
	}
	r := rand.New(rand.NewSource(7))
	for _, c := range cases {
		legacy := EstimateTokenByModel(c.model, c.text)
		acc := NewUsageAccumulator(c.model)
		for _, ch := range randomChunks(c.text, r) {
			acc.Feed(ch)
		}
		if got := acc.LocalCompletionTokens(); got != legacy {
			t.Errorf("model=%s acc=%d legacy=%d", c.model, got, legacy)
		}
	}
}

// FeedReasoning: text + thinking counted separately then summed.
func TestUsageAccumulatorReasoning(t *testing.T) {
	model := "claude-opus-4"
	text := strings.Repeat("visible answer text ", 100)
	thinking := strings.Repeat("internal reasoning step ", 200)
	// legacy claude path concatenated both into one builder
	legacyConcat := EstimateTokenByModel(model, text+thinking)
	legacySeparate := EstimateTokenByModel(model, text) + EstimateTokenByModel(model, thinking)

	acc := NewUsageAccumulator(model)
	acc.Feed(text)
	acc.FeedReasoning(thinking)
	got := acc.LocalCompletionTokens()

	// We chose separate counting (more accurate); assert it equals separate sum.
	if got != legacySeparate {
		t.Errorf("reasoning separate: acc=%d expected=%d", got, legacySeparate)
	}
	t.Logf("separate=%d concat=%d (diff is expected, separate is by design)", got, legacyConcat)
}

// Resolve semantics: trust on/off.
func TestUsageAccumulatorResolve(t *testing.T) {
	acc := NewUsageAccumulator("gpt-4o")
	acc.Feed(strings.Repeat("word ", 50))
	local := acc.LocalCompletionTokens()
	if local <= 0 {
		t.Fatal("local should be > 0")
	}
	// trust=true, upstream provided -> use upstream
	if got := acc.Resolve(999, true); got != 999 {
		t.Errorf("trust+upstream: got %d want 999", got)
	}
	// trust=true, upstream missing -> use local
	if got := acc.Resolve(0, true); got != local {
		t.Errorf("trust+no-upstream: got %d want %d", got, local)
	}
	// trust=false -> always local (ignore upstream)
	if got := acc.Resolve(999, false); got != local {
		t.Errorf("no-trust: got %d want %d", got, local)
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
