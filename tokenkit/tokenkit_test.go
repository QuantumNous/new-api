package tokenkit

import (
	"math/rand"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tiktoken-go/tokenizer/codec"
)

func TestModelFamily(t *testing.T) {
	for _, tc := range []struct {
		model  string
		family Family
	}{
		{"claude-3-5-sonnet-20240620", FamilyClaude},
		{"claude-sonnet-4-20250514", FamilyClaude},
		{"claude-sonnet-4-5-20250929", FamilyClaude},
		{"claude-haiku-4-5", FamilyClaude},
		{"claude-sonnet-4-6", FamilyClaude},
		// Claude Opus 4.7 introduced the tokenizer every later Claude model uses.
		{"claude-opus-4-7", FamilyClaude47},
		{"claude-opus-4-7@20260416", FamilyClaude47},
		{"us.anthropic.claude-opus-4-7-v1:0", FamilyClaude47},
		{"claude-sonnet-5", FamilyClaude47},
		{"claude-fable-5-1", FamilyClaude47},
		{"Claude-Opus-5-5", FamilyClaude47},
		{"claude-mythos-preview", FamilyClaude47},
		{"gemini-3.7-flash", FamilyGemini},
		{"gpt-5.6-sol", FamilyOpenAI},
		{"gpt-6-astra", FamilyOpenAI},
		{"o3-mini", FamilyOpenAI},
		{"deepseek-v4", FamilyUnknown},
	} {
		assert.Equal(t, tc.family, ModelFamily(tc.model), tc.model)
	}
}

func TestEstimateUsesFamilyWeights(t *testing.T) {
	const text = "func main() {\n\tfmt.Println(\"统计 token\", 42)\n}\nSee https://example.com/a?b=1"
	require.NotEqual(t, EstimateFamily(FamilyClaude, text), EstimateFamily(FamilyClaude47, text))

	assert.Equal(t, EstimateFamily(FamilyClaude, text), Estimate("claude-haiku-4-5", text))
	assert.Equal(t, EstimateFamily(FamilyClaude47, text), Estimate("claude-sonnet-5", text))
	assert.Equal(t, EstimateFamily(FamilyUnknown, text), Estimate("deepseek-v4", text))
	assert.Equal(t, EstimateFamily(FamilyUnknown, text), EstimateFamily("other", text))
	assert.Zero(t, Estimate("claude-sonnet-5", ""))
}

func TestCountUsesTiktokenForOpenAIModels(t *testing.T) {
	const text = "大语言模型按 token 计费；Large language models bill by token. 🙂"
	o200k, _ := codec.NewO200kBase().Count(text)
	cl100k, _ := codec.NewCl100kBase().Count(text)
	require.NotEqual(t, o200k, cl100k)

	assert.Equal(t, o200k, Count("gpt-5.6-sol", text))
	assert.Equal(t, o200k, Count("gpt-6-astra", text))
	assert.Equal(t, o200k, Count("gpt-4o-mini", text))
	assert.Equal(t, cl100k, Count("gpt-4", text))
	assert.Equal(t, cl100k, Count("gpt-3.5-turbo", text))
	assert.Equal(t, Estimate("claude-sonnet-5", text), Count("claude-sonnet-5", text))
}

// Long runs without separators are cut before encoding so BPE stays linear;
// ordinary text is counted exactly and cut runs stay within 0.5%.
func TestCountCutsOnlyLongRuns(t *testing.T) {
	encoder := codec.NewO200kBase()
	ordinary := strings.Repeat("func main() {\n\tfmt.Println(\"统计 token，按模型计费。\", 42)\n}\n| a | b |\n|---|---|\n", 200)
	want, _ := encoder.Count(ordinary)
	assert.Equal(t, want, Count("gpt-5.6-sol", ordinary))

	rng := rand.New(rand.NewSource(1))
	var cjk strings.Builder
	for range 5000 {
		cjk.WriteRune(rune(0x4E00 + rng.Intn(0x9FA5-0x4E00)))
	}
	for _, text := range []string{cjk.String(), strings.Repeat("token", 2000), "a" + strings.Repeat(" ", 10000) + "b", strings.Repeat("=", 10000)} {
		exact, _ := encoder.Count(text)
		assert.InEpsilon(t, exact, Count("gpt-5.6-sol", text), 0.005)
	}
}
