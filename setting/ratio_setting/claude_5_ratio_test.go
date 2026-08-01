package ratio_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestClaude5DefaultRatios(t *testing.T) {
	InitRatioSettings()

	tests := []struct {
		model      string
		modelRatio float64
	}{
		{model: "claude-fable-5", modelRatio: 0.5},
		{model: "claude-sonnet-5", modelRatio: 1.5},
		{model: "claude-opus-5", modelRatio: 2.5},
	}

	for _, test := range tests {
		t.Run(test.model, func(t *testing.T) {
			modelRatio, found, matchedModel := GetModelRatio(test.model)
			require.True(t, found)
			assert.Equal(t, test.model, matchedModel)
			assert.Equal(t, test.modelRatio, modelRatio)
			assert.Equal(t, 5.0, GetCompletionRatio(test.model))

			cacheRatio, found := GetCacheRatio(test.model)
			require.True(t, found)
			assert.Equal(t, 0.1, cacheRatio)

			createCacheRatio, found := GetCreateCacheRatio(test.model)
			require.True(t, found)
			assert.Equal(t, 1.25, createCacheRatio)
		})
	}
}
