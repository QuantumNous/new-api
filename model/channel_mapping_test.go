package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestEnsureModelsIncludeMappingSources(t *testing.T) {
	mapping := `{"deepseek-v3.1":"DeepSeek-V3.1","llama-3.3-70b":"Meta-Llama-3.3-70B-Instruct"}`
	ch := &Channel{
		Models:       "DeepSeek-V3.1",
		ModelMapping: &mapping,
	}
	require.True(t, ch.EnsureModelsIncludeMappingSources())
	require.Contains(t, ch.Models, "deepseek-v3.1")
	require.Contains(t, ch.Models, "llama-3.3-70b")
	require.Contains(t, ch.Models, "DeepSeek-V3.1")
	// second call is idempotent
	require.False(t, ch.EnsureModelsIncludeMappingSources())
}

func TestModelNamesForAbilitiesIncludesMappingSources(t *testing.T) {
	mapping := `{"glm-4.7":"zai-glm-4.7","gemma-4-31b":"gemma-4-31b"}`
	ch := &Channel{
		Models:       "zai-glm-4.7,gemma-4-31b,gpt-oss-120b",
		ModelMapping: &mapping,
	}
	names := ch.ModelNamesForAbilities()
	require.Contains(t, names, "zai-glm-4.7")
	require.Contains(t, names, "gemma-4-31b")
	require.Contains(t, names, "gpt-oss-120b")
	require.Contains(t, names, "glm-4.7") // mapping source missing from models
}

func TestGetModelMappingMap(t *testing.T) {
	mapping := `{ " alias ": " target ", "": "x", "y": "" }`
	ch := &Channel{ModelMapping: &mapping}
	m := ch.GetModelMappingMap()
	require.Equal(t, map[string]string{"alias": "target"}, m)
}
