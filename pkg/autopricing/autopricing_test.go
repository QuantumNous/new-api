package autopricing

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// buildTestCatalog is a helper so each test states only the pricing document it
// cares about.
func buildTestCatalog(t *testing.T, document string) *Catalog {
	t.Helper()
	catalog, err := BuildCatalog([]byte(document), "test-version")
	require.NoError(t, err)
	return catalog
}

func TestBuildCatalogConvertsCostsToRatioUnits(t *testing.T) {
	// One ratio unit is $2 per 1M tokens, so a $2.5/1M input price is 1.25.
	catalog := buildTestCatalog(t, `{
		"gpt-4o": {
			"input_cost_per_token": 0.0000025,
			"output_cost_per_token": 0.00001,
			"cache_read_input_token_cost": 0.00000125,
			"litellm_provider": "openai"
		}
	}`)

	entry, ok := catalog.Lookup("gpt-4o")
	require.True(t, ok)
	assert.Equal(t, 1.25, entry.ModelRatio)
	assert.Equal(t, 4.0, entry.CompletionRatio)
	assert.True(t, entry.HasCacheRatio)
	assert.Equal(t, 0.5, entry.CacheRatio)
	assert.False(t, entry.HasCreateCacheRatio)
	assert.Equal(t, "gpt-4o", entry.CatalogKey)
}

func TestBuildCatalogCacheCreationRatio(t *testing.T) {
	catalog := buildTestCatalog(t, `{
		"claude-opus-4-5-20251101": {
			"input_cost_per_token": 0.000005,
			"output_cost_per_token": 0.000025,
			"cache_read_input_token_cost": 0.0000005,
			"cache_creation_input_token_cost": 0.00000625
		}
	}`)

	entry, ok := catalog.Lookup("claude-opus-4-5-20251101")
	require.True(t, ok)
	assert.Equal(t, 2.5, entry.ModelRatio)
	assert.Equal(t, 5.0, entry.CompletionRatio)
	assert.True(t, entry.HasCacheRatio)
	assert.Equal(t, 0.1, entry.CacheRatio)
	assert.True(t, entry.HasCreateCacheRatio)
	assert.Equal(t, 1.25, entry.CreateCacheRatio)
}

func TestBuildCatalogRejectsUnusableEntries(t *testing.T) {
	cases := []struct {
		name  string
		entry string
	}{
		{name: "no token pricing at all", entry: `{"output_cost_per_image": 0.04, "mode": "image_generation"}`},
		{name: "negative input cost", entry: `{"input_cost_per_token": -0.000001, "output_cost_per_token": 0.000002}`},
		{name: "negative output cost", entry: `{"input_cost_per_token": 0.000001, "output_cost_per_token": -0.000002}`},
		{name: "free input with paid output", entry: `{"input_cost_per_token": 0, "output_cost_per_token": 0.000002}`},
		{name: "absurd input cost", entry: `{"input_cost_per_token": 100, "output_cost_per_token": 100}`},
		{name: "absurd completion multiplier", entry: `{"input_cost_per_token": 0.0000000001, "output_cost_per_token": 0.01}`},
		{name: "absurd cache multiplier", entry: `{"input_cost_per_token": 0.000001, "output_cost_per_token": 0.000002, "cache_read_input_token_cost": 1}`},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			document := `{"keeper": {"input_cost_per_token": 0.000002, "output_cost_per_token": 0.000008}, "candidate": ` + tc.entry + `}`
			catalog := buildTestCatalog(t, document)

			_, ok := catalog.Lookup("candidate")
			assert.False(t, ok, "unusable entry must not be priced")
			_, keeperOK := catalog.Lookup("keeper")
			assert.True(t, keeperOK, "valid entries in the same document must survive")
			assert.Equal(t, 1, catalog.SkippedCount)
		})
	}
}

func TestBuildCatalogKeepsFreeModels(t *testing.T) {
	catalog := buildTestCatalog(t, `{
		"free-model": {"input_cost_per_token": 0, "output_cost_per_token": 0}
	}`)

	entry, ok := catalog.Lookup("free-model")
	require.True(t, ok)
	assert.Equal(t, 0.0, entry.ModelRatio)
	assert.Equal(t, 1.0, entry.CompletionRatio)
}

func TestBuildCatalogSkipsSampleSpec(t *testing.T) {
	catalog := buildTestCatalog(t, `{
		"sample_spec": {"input_cost_per_token": 0.000001, "output_cost_per_token": 0.000002},
		"real-model": {"input_cost_per_token": 0.000002, "output_cost_per_token": 0.000008}
	}`)

	_, ok := catalog.Lookup("sample_spec")
	assert.False(t, ok)
	assert.Equal(t, 1, catalog.ModelCount)
}

func TestBuildCatalogRejectsUnusableDocuments(t *testing.T) {
	cases := []struct {
		name     string
		document string
	}{
		{name: "not json", document: `not json at all`},
		{name: "empty object", document: `{}`},
		{name: "no token priced entries", document: `{"img": {"output_cost_per_image": 0.04}}`},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			catalog, err := BuildCatalog([]byte(tc.document), "v1")
			require.Error(t, err)
			assert.Nil(t, catalog)
		})
	}
}

func TestBuildCatalogNormalizesKeyCase(t *testing.T) {
	catalog := buildTestCatalog(t, `{
		"GPT-4O-Mini": {"input_cost_per_token": 0.00000015, "output_cost_per_token": 0.0000006}
	}`)

	entry, ok := catalog.Lookup("gpt-4o-mini")
	require.True(t, ok)
	assert.Equal(t, "GPT-4O-Mini", entry.CatalogKey, "the original spelling stays visible for auditing")
}

func TestResolveExactMatchVariants(t *testing.T) {
	catalog := buildTestCatalog(t, `{
		"gemini-2.5-pro": {"input_cost_per_token": 0.00000125, "output_cost_per_token": 0.00001},
		"claude-opus-4.5": {"input_cost_per_token": 0.000005, "output_cost_per_token": 0.000025}
	}`)
	SetCatalog(catalog)
	t.Cleanup(func() { SetCatalog(nil) })

	cases := []struct {
		name       string
		model      string
		catalogKey string
	}{
		{name: "verbatim", model: "gemini-2.5-pro", catalogKey: "gemini-2.5-pro"},
		{name: "different case", model: "Gemini-2.5-Pro", catalogKey: "gemini-2.5-pro"},
		{name: "models prefix", model: "models/gemini-2.5-pro", catalogKey: "gemini-2.5-pro"},
		{name: "vertex resource path", model: "publishers/google/models/gemini-2.5-pro", catalogKey: "gemini-2.5-pro"},
		{name: "dashed minor version", model: "claude-opus-4-5", catalogKey: "claude-opus-4.5"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			// Exact candidate matching must not depend on the fuzzy switch.
			entry, ok := Resolve(tc.model, false)
			require.True(t, ok)
			assert.Equal(t, tc.catalogKey, entry.CatalogKey)
		})
	}
}

func TestResolveFuzzyDisabledStopsAfterExactCandidates(t *testing.T) {
	SetCatalog(buildTestCatalog(t, `{
		"claude-opus-4-5-20251101": {"input_cost_per_token": 0.000005, "output_cost_per_token": 0.000025}
	}`))
	t.Cleanup(func() { SetCatalog(nil) })

	_, ok := Resolve("claude-opus-4-5-20260101", false)
	assert.False(t, ok, "a new date must not resolve while fuzzy matching is disabled")

	entry, fuzzyOK := Resolve("claude-opus-4-5-20260101", true)
	require.True(t, fuzzyOK)
	assert.Equal(t, "claude-opus-4-5-20251101", entry.CatalogKey)
}

func TestResolveFuzzyRules(t *testing.T) {
	SetCatalog(buildTestCatalog(t, `{
		"claude-opus-4-8": {"input_cost_per_token": 0.000005, "output_cost_per_token": 0.000025},
		"claude-sonnet-4-5-20250929": {"input_cost_per_token": 0.000003, "output_cost_per_token": 0.000015},
		"gpt-5.2": {"input_cost_per_token": 0.00000125, "output_cost_per_token": 0.00001},
		"gemini-3-pro": {"input_cost_per_token": 0.000002, "output_cost_per_token": 0.000012}
	}`))
	t.Cleanup(func() { SetCatalog(nil) })

	cases := []struct {
		name       string
		model      string
		catalogKey string
	}{
		{name: "undated request to dated entry", model: "claude-sonnet-4-5", catalogKey: "claude-sonnet-4-5-20250929"},
		{name: "unknown date to known base", model: "claude-sonnet-4-5-20261231", catalogKey: "claude-sonnet-4-5-20250929"},
		{name: "openai dated variant", model: "gpt-5.2-20251222", catalogKey: "gpt-5.2"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			entry, ok := Resolve(tc.model, true)
			require.True(t, ok)
			assert.Equal(t, tc.catalogKey, entry.CatalogKey)
		})
	}
}

func TestResolveFuzzyMisses(t *testing.T) {
	SetCatalog(buildTestCatalog(t, `{
		"claude-opus-4-8": {"input_cost_per_token": 0.000005, "output_cost_per_token": 0.000025},
		"gpt-5.2": {"input_cost_per_token": 0.00000125, "output_cost_per_token": 0.00001}
	}`))
	t.Cleanup(func() { SetCatalog(nil) })

	cases := []struct {
		name  string
		model string
	}{
		{name: "unrelated vendor model", model: "some-vendor/llama-4-405b"},
		{name: "opus lookalike from another vendor", model: "acme-opus-turbo"},
		{name: "unknown openai family", model: "gpt-9.9-experimental"},
		{name: "unpublished claude generation", model: "claude-opus-5-20260401"},
		{name: "claude service variant", model: "claude-opus-4-8-thinking"},
		{name: "openai suffix variant", model: "gpt-5.2-codex"},
		{name: "empty name", model: "   "},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			// There is no catch-all rule: an unknown model must stay unpriced
			// rather than inherit an unrelated model's rate.
			_, ok := Resolve(tc.model, true)
			assert.False(t, ok)
		})
	}
}

func TestClaudeFamilyVariantDoesNotUseGuessedPrice(t *testing.T) {
	SetCatalog(buildTestCatalog(t, `{
		"claude-opus-4-20250514": {"input_cost_per_token": 0.000015, "output_cost_per_token": 0.000075},
		"claude-opus-4-7": {"input_cost_per_token": 0.000005, "output_cost_per_token": 0.000025}
	}`))
	t.Cleanup(func() { SetCatalog(nil) })

	_, ok := Resolve("claude-opus-4-7-xhigh", true)
	assert.False(t, ok)
}

func TestResolveWithoutCatalog(t *testing.T) {
	SetCatalog(nil)
	_, ok := Resolve("gpt-4o", true)
	assert.False(t, ok)
	assert.False(t, Loaded())
}

func TestSetCatalogClearsFuzzyCache(t *testing.T) {
	SetCatalog(buildTestCatalog(t, `{
		"claude-opus-4-8-20260814": {"input_cost_per_token": 0.000005, "output_cost_per_token": 0.000025}
	}`))
	t.Cleanup(func() { SetCatalog(nil) })

	entry, ok := Resolve("claude-opus-4-8-20260815", true)
	require.True(t, ok)
	require.Equal(t, 2.5, entry.ModelRatio)

	// A new catalog generation must invalidate memoized fuzzy results.
	SetCatalog(buildTestCatalog(t, `{
		"claude-opus-4-8-20260814": {"input_cost_per_token": 0.00001, "output_cost_per_token": 0.00005}
	}`))

	entry, ok = Resolve("claude-opus-4-8-20260815", true)
	require.True(t, ok)
	assert.Equal(t, 5.0, entry.ModelRatio)
}

func TestFuzzyMemoStaysBounded(t *testing.T) {
	SetCatalog(buildTestCatalog(t, `{
		"gpt-5.2": {"input_cost_per_token": 0.00000125, "output_cost_per_token": 0.00001}
	}`))
	t.Cleanup(func() { SetCatalog(nil) })

	// Model names come from client request bodies, so misses must not grow the
	// cache without bound.
	for i := 0; i < fuzzyMemoLimit+500; i++ {
		Resolve("unknown-model-"+string(rune('a'+i%26))+"-"+itoa(i), true)
	}

	fuzzyMu.RLock()
	size := len(fuzzyMemo)
	fuzzyMu.RUnlock()
	assert.LessOrEqual(t, size, fuzzyMemoLimit)
}

func itoa(i int) string {
	if i == 0 {
		return "0"
	}
	digits := make([]byte, 0, 8)
	for i > 0 {
		digits = append([]byte{byte('0' + i%10)}, digits...)
		i /= 10
	}
	return string(digits)
}

func TestStripDateSegments(t *testing.T) {
	cases := []struct {
		input string
		want  string
	}{
		{input: "claude-opus-4-5-20251101", want: "claude-opus-4-5"},
		{input: "gpt-4o-2024-08-06", want: "gpt-4o-2024-08-06"},
		{input: "anthropic.claude-v2:1", want: "anthropic.claude-v2"},
		{input: "gpt-4o", want: "gpt-4o"},
	}

	for _, tc := range cases {
		t.Run(tc.input, func(t *testing.T) {
			assert.Equal(t, tc.want, stripDateSegments(tc.input))
		})
	}
}

func TestPreferBaseKeyPicksCanonicalSpelling(t *testing.T) {
	catalog := buildTestCatalog(t, `{
		"claude-opus-4-5": {"input_cost_per_token": 0.000005, "output_cost_per_token": 0.000025},
		"claude-opus-4-5-20251101": {"input_cost_per_token": 0.000005, "output_cost_per_token": 0.000025},
		"claude-opus-4-5-20260101": {"input_cost_per_token": 0.000005, "output_cost_per_token": 0.000025}
	}`)

	assert.Equal(t, "claude-opus-4-5", catalog.baseIndex["claude-opus-4-5"])
}
