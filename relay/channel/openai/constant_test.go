package openai

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestModelListDoesNotExposeUnpricedRealtimeModels(t *testing.T) {
	unpricedModels := []string{
		"gpt-realtime-2",
		"gpt-realtime-2.1",
		"gpt-realtime-2.1-mini",
		"gpt-realtime-whisper",
		"gpt-realtime-translate",
	}

	for _, model := range unpricedModels {
		require.NotContains(t, ModelList, model)
	}
}
