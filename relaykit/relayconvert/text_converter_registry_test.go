package relayconvert

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLookupBuiltinTextConverters(t *testing.T) {
	tests := []struct {
		id        string
		from      types.RelayFormat
		to        types.RelayFormat
		quality   TextConverterQuality
		respAlias string
	}{
		{id: ConverterClaudeMessagesToOpenAIChat, from: types.RelayFormatClaude, to: types.RelayFormatOpenAI, quality: TextConverterQualityFair, respAlias: ResponseConverterClaudeMessagesToOAIChat},
		{id: ConverterOpenAIChatToClaudeMessages, from: types.RelayFormatOpenAI, to: types.RelayFormatClaude, quality: TextConverterQualityFair, respAlias: ResponseConverterOAIChatToClaudeMessages},
		{id: ConverterGeminiContentToOpenAIChat, from: types.RelayFormatGemini, to: types.RelayFormatOpenAI, quality: TextConverterQualityFair, respAlias: ResponseConverterGeminiChatToOAIChat},
		{id: ConverterOpenAIChatToGeminiContent, from: types.RelayFormatOpenAI, to: types.RelayFormatGemini, quality: TextConverterQualityFair, respAlias: ResponseConverterOAIChatToGeminiChat},
		{id: ConverterOpenAIChatToOpenAIResponses, from: types.RelayFormatOpenAI, to: types.RelayFormatOpenAIResponses, quality: TextConverterQualityGood, respAlias: ResponseConverterOAIChatToOAIResponses},
		{id: ConverterOpenAIResponsesToOpenAIChat, from: types.RelayFormatOpenAIResponses, to: types.RelayFormatOpenAI, quality: TextConverterQualityGood, respAlias: ResponseConverterOAIResponsesToOAIChat},
		{
			id:        requestConverterClaudeToGemini,
			from:      types.RelayFormatClaude,
			to:        types.RelayFormatGemini,
			quality:   TextConverterQualityFair,
			respAlias: responseConverterClaudeToGemini,
		},
		{
			id:        requestConverterClaudeToResponses,
			from:      types.RelayFormatClaude,
			to:        types.RelayFormatOpenAIResponses,
			quality:   TextConverterQualityFair,
			respAlias: responseConverterClaudeToResponses,
		},
		{
			id:        requestConverterGeminiToClaude,
			from:      types.RelayFormatGemini,
			to:        types.RelayFormatClaude,
			quality:   TextConverterQualityFair,
			respAlias: responseConverterGeminiToClaude,
		},
		{
			id:        requestConverterGeminiToResponses,
			from:      types.RelayFormatGemini,
			to:        types.RelayFormatOpenAIResponses,
			quality:   TextConverterQualityFair,
			respAlias: responseConverterGeminiToResponses,
		},
		{
			id:        requestConverterResponsesToClaude,
			from:      types.RelayFormatOpenAIResponses,
			to:        types.RelayFormatClaude,
			quality:   TextConverterQualityFair,
			respAlias: responseConverterResponsesToClaude,
		},
		{
			id:        ConverterOpenAIResponsesToGemini,
			from:      types.RelayFormatOpenAIResponses,
			to:        types.RelayFormatGemini,
			quality:   TextConverterQualityFair,
			respAlias: responseConverterResponsesToGemini,
		},
	}

	require.Len(t, textConverters, len(tests))

	for _, tt := range tests {
		t.Run(tt.id, func(t *testing.T) {
			spec, ok := LookupTextConverter(tt.id)
			require.True(t, ok)
			assert.Equal(t, tt.id, spec.ID)
			assert.Equal(t, tt.from, spec.From)
			assert.Equal(t, tt.to, spec.To)
			assert.Equal(t, tt.quality, spec.Quality)
			assert.Empty(t, spec.Req.StepConverters)
			assert.Empty(t, spec.Resp.StepConverters)
			assert.NotNil(t, spec.Req.Convert)
			assert.NotNil(t, spec.Resp.Convert)
			assert.NotNil(t, spec.Resp.NewStreamState)
			assert.NotNil(t, spec.Resp.ConvertStreamChunk)
			assert.NotNil(t, spec.Resp.FinalizeStream)

			aliasSpec, ok := LookupTextConverter(tt.respAlias)
			require.True(t, ok)
			assert.Equal(t, tt.id, aliasSpec.ID)
		})
	}
}
