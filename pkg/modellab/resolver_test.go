package modellab

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResolveModelLabs(t *testing.T) {
	tests := []struct {
		name            string
		models          string
		mapping         string
		group           string
		unresolvedCount int
		source          string
	}{
		{name: "canonical", models: "openai/gpt-5", group: "openai", source: "canonical"},
		{name: "routing suffixes", models: "openai/gpt-5:free@default", group: "openai", source: "canonical"},
		{name: "provider canonical path", models: "openrouter/openai/gpt-5", group: "openai", source: "provider"},
		{name: "provider alias routing suffix", models: "openrouter/openai/gpt-5:free", group: "openai", source: "provider"},
		{name: "model mapping target wins", models: "public-model", mapping: `{"public-model":"anthropic/claude-opus-5"}`, group: "anthropic", source: "canonical"},
		{name: "bedrock regional alias", models: "us.anthropic.claude-opus-4-1-20250805-v1:0", group: "anthropic", source: "alias"},
		{name: "explicit qwen alias", models: "qwen3-max", group: "alibaba", source: "alias"},
		{name: "codex model containing router token", models: "codex-auto-review", group: "openai", source: "alias"},
		{name: "canonical wins over family token", models: "nvidia/llama-3.1-nemotron-70b-instruct", group: "nvidia", source: "canonical"},
		{name: "mixed", models: "openai/gpt-5,anthropic/claude-opus-5", group: GroupMixed, source: "canonical"},
		{name: "router remains unknown", models: "openrouter/auto", group: GroupUnknown, unresolvedCount: 1, source: "unknown"},
		{name: "provider specific remains unknown", models: "aion-labs/aion-3.0", group: GroupUnknown, unresolvedCount: 1, source: "unknown"},
		{name: "low confidence family remains unknown", models: "llama-3.3-70b", group: GroupUnknown, unresolvedCount: 1, source: "unknown"},
		{name: "empty", group: GroupUnknown},
		{name: "malformed mapping falls back to published model", models: "grok-4", mapping: "{", group: "xai", source: "alias"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := Resolve(tt.models, tt.mapping)
			assert.Equal(t, tt.group, result.GroupSlug)
			assert.Equal(t, tt.unresolvedCount, result.UnresolvedCount)
			require.NotEmpty(t, result.CatalogVersion)
			if tt.models != "" {
				require.NotEmpty(t, result.Models)
				assert.Equal(t, tt.source, result.Models[0].Source)
			}
		})
	}
}

func TestResolveUsesMappingValuesWhenModelsAreEmpty(t *testing.T) {
	result := Resolve("", `{"alias":"google/gemini-2.5-pro"}`)

	require.Len(t, result.Models, 1)
	assert.Equal(t, "google", result.GroupSlug)
	assert.Equal(t, "alias", result.Models[0].InputModel)
	assert.Equal(t, "google/gemini-2.5-pro", result.Models[0].RealModel)
}

func TestResolveIncludesMappingTargetsWhenPublishedModelsArePresent(t *testing.T) {
	result := Resolve("openai/gpt-5", `{"hidden":"anthropic/claude-opus-5"}`)

	assert.Equal(t, GroupMixed, result.GroupSlug)
	assert.Len(t, result.Models, 2)
}

func TestResolveProviderBaseModelUsesProviderSource(t *testing.T) {
	catalog := &Catalog{
		Version: "test",
		Labs:    []Lab{{Slug: "openai", Name: "OpenAI"}},
		Models:  map[string]string{"openai/gpt-5": "openai"},
		Aliases: map[string]string{"openrouter/openai/gpt-5": "openai/gpt-5"},
	}
	result := ResolveWithCatalog(catalog, "openrouter/openai/gpt-5", "")

	require.Len(t, result.Models, 1)
	assert.Equal(t, "provider", result.Models[0].Source)
	assert.Equal(t, "openai", result.GroupSlug)
}

func TestResolveNormalizesUnicodeCompatibilityForms(t *testing.T) {
	result := Resolve("ＯＰＥＮＡＩ／ＧＰＴ－５", "")

	assert.Equal(t, "openai", result.GroupSlug)
}

func TestResolveNormalizesModelMappingKey(t *testing.T) {
	result := Resolve("public-model:free", `{"public-model":"openai/gpt-5"}`)

	require.Len(t, result.Models, 1)
	assert.Equal(t, "openai", result.GroupSlug)
	assert.Equal(t, "openai/gpt-5", result.Models[0].RealModel)
}

func TestResolveCountsCatalogLabMissesAsUnresolved(t *testing.T) {
	catalog := &Catalog{
		Version: "test",
		Labs:    []Lab{{Slug: "openai", Name: "OpenAI"}},
		Models:  map[string]string{"missing/gpt-5": "missing"},
	}
	result := ResolveWithCatalog(catalog, "missing/gpt-5", "")

	assert.Equal(t, GroupUnknown, result.GroupSlug)
	assert.Equal(t, 1, result.UnresolvedCount)
}
