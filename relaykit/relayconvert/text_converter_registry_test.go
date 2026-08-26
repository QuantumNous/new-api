package relayconvert

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLookupBuiltinTextRoutes(t *testing.T) {
	tests := []struct {
		id      string
		from    types.RelayFormat
		to      types.RelayFormat
		quality TextConverterQuality
	}{
		{id: ConverterClaudeMessagesToOpenAIChat, from: types.RelayFormatClaude, to: types.RelayFormatOpenAI, quality: TextConverterQualityFair},
		{id: ConverterOpenAIChatToClaudeMessages, from: types.RelayFormatOpenAI, to: types.RelayFormatClaude, quality: TextConverterQualityFair},
		{id: ConverterGeminiContentToOpenAIChat, from: types.RelayFormatGemini, to: types.RelayFormatOpenAI, quality: TextConverterQualityFair},
		{id: ConverterOpenAIChatToGeminiContent, from: types.RelayFormatOpenAI, to: types.RelayFormatGemini, quality: TextConverterQualityFair},
		{id: ConverterOpenAIChatToOpenAIResponses, from: types.RelayFormatOpenAI, to: types.RelayFormatOpenAIResponses, quality: TextConverterQualityGood},
		{id: ConverterOpenAIResponsesToOpenAIChat, from: types.RelayFormatOpenAIResponses, to: types.RelayFormatOpenAI, quality: TextConverterQualityGood},
		{id: requestConverterClaudeToGemini, from: types.RelayFormatClaude, to: types.RelayFormatGemini, quality: TextConverterQualityFair},
		{id: requestConverterClaudeToResponses, from: types.RelayFormatClaude, to: types.RelayFormatOpenAIResponses, quality: TextConverterQualityFair},
		{id: requestConverterGeminiToClaude, from: types.RelayFormatGemini, to: types.RelayFormatClaude, quality: TextConverterQualityFair},
		{id: requestConverterGeminiToResponses, from: types.RelayFormatGemini, to: types.RelayFormatOpenAIResponses, quality: TextConverterQualityFair},
		{id: requestConverterResponsesToClaude, from: types.RelayFormatOpenAIResponses, to: types.RelayFormatClaude, quality: TextConverterQualityFair},
		{id: ConverterOpenAIResponsesToGemini, from: types.RelayFormatOpenAIResponses, to: types.RelayFormatGemini, quality: TextConverterQualityFair},
	}

	require.Len(t, textRoutes, len(tests))

	for _, tt := range tests {
		t.Run(tt.id, func(t *testing.T) {
			route, ok := LookupTextConverter(tt.id)
			require.True(t, ok)
			assert.Equal(t, tt.id, route.ID)
			assert.Equal(t, tt.from, route.From)
			assert.Equal(t, tt.to, route.To)
			assert.Equal(t, tt.quality, route.Quality)

			byPair, ok := lookupTextRoute(tt.from, tt.to)
			require.True(t, ok)
			assert.Equal(t, tt.id, byPair.ID)
		})
	}
}
