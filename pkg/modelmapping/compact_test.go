package modelmapping

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestResolveCompactExactPrefersSuffixMapping(t *testing.T) {
	resolution, err := ResolveCompactExact("gpt-5", map[string]string{
		"gpt-5-openai-compact": "real-compact-model",
		"gpt-5":                "fallback-openai-compact",
	})
	require.NoError(t, err)
	require.Equal(t, "real-compact-model", resolution.UpstreamModel)
	require.Equal(t, "gpt-5-openai-compact", resolution.LogicalBillingModel)
	require.True(t, resolution.Mapped)
	require.False(t, resolution.BaseMappingTargetsExact)
}

func TestResolveCompactExactUsesBaseMappingOnlyForSuffixTarget(t *testing.T) {
	exact, err := ResolveCompactExact("gpt-5", map[string]string{
		"gpt-5": "real-openai-compact",
	})
	require.NoError(t, err)
	require.Equal(t, "real-openai-compact", exact.UpstreamModel)
	require.True(t, exact.BaseMappingTargetsExact)

	unmapped, err := ResolveCompactExact("gpt-5", map[string]string{
		"gpt-5": "real-base",
	})
	require.NoError(t, err)
	require.Equal(t, "gpt-5-openai-compact", unmapped.UpstreamModel)
	require.Equal(t, "gpt-5-openai-compact", unmapped.LogicalBillingModel)
}

func TestResolveCompactBaseStripsMappedSuffixOnce(t *testing.T) {
	resolution, err := ResolveCompactBase("gpt-5", map[string]string{
		"gpt-5": "real-openai-compact",
	})
	require.NoError(t, err)
	require.Equal(t, "real", resolution.UpstreamModel)
	require.Equal(t, "gpt-5-openai-compact", resolution.LogicalBillingModel)
}

func TestResolveNonGPTCompactAlwaysUsesBase(t *testing.T) {
	resolution, err := ResolveCompactExact("claude-3-5-sonnet-openai-compact", map[string]string{
		"claude-3-5-sonnet-openai-compact": "suffix-upstream",
		"claude-3-5-sonnet":                "base-upstream",
	})
	require.NoError(t, err)
	require.Equal(t, "base-upstream", resolution.UpstreamModel)
	require.Equal(t, "claude-3-5-sonnet", resolution.LogicalBillingModel)
}

func TestResolveRejectsMappingCycle(t *testing.T) {
	_, _, err := Resolve("a", map[string]string{"a": "b", "b": "a"})
	require.EqualError(t, err, "model_mapping_contains_cycle")
}
