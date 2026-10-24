package dto

import (
	"testing"

	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGeminiChatResponseUsageMetadataPresence(t *testing.T) {
	var missing GeminiChatResponse
	require.NoError(t, kitutil.Unmarshal([]byte(`{"candidates":[]}`), &missing))
	assert.False(t, missing.HasUsageMetadata)
	assert.Nil(t, missing.GetUsageMetadata())

	var empty GeminiChatResponse
	require.NoError(t, kitutil.Unmarshal([]byte(`{"candidates":[],"usageMetadata":{}}`), &empty))
	assert.True(t, empty.HasUsageMetadata)
	require.NotNil(t, empty.GetUsageMetadata())
	assert.False(t, HasGeminiUsageMetadataTokens(empty.GetUsageMetadata()))

	var populated GeminiChatResponse
	require.NoError(t, kitutil.Unmarshal([]byte(`{"candidates":[],"usageMetadata":{"promptTokenCount":3}}`), &populated))
	assert.True(t, populated.HasUsageMetadata)
	require.NotNil(t, populated.GetUsageMetadata())
	assert.True(t, HasGeminiUsageMetadataTokens(populated.GetUsageMetadata()))
}

func TestGeminiChatResponseMarshalKeepsUsageMetadataField(t *testing.T) {
	data, err := kitutil.Marshal(GeminiChatResponse{})
	require.NoError(t, err)
	assert.Contains(t, string(data), `"usageMetadata"`)
}

func TestGeminiInteractionRequestPreservesUnknownFieldsWhenRoutingModelChanges(t *testing.T) {
	var request GeminiInteractionRequest
	require.NoError(t, kitutil.Unmarshal([]byte(`{"model":"gemini-3.8-flash","input":"hello","future_option":{"enabled":true}}`), &request))
	request.SetModelName("gemini-3.8-flash-tts")

	data, err := kitutil.Marshal(&request)
	require.NoError(t, err)
	assert.Contains(t, string(data), `"model":"gemini-3.8-flash-tts"`)
	assert.Contains(t, string(data), `"future_option":{"enabled":true}`)
	assert.True(t, request.HasInput())
}

func TestGeminiInteractionRequestPreservesAgentWhenRoutingAgentChanges(t *testing.T) {
	var request GeminiInteractionRequest
	require.NoError(t, kitutil.Unmarshal([]byte(`{"agent":"deep-research-preview","input":"hello","future_option":{"enabled":true}}`), &request))
	request.SetModelName("deep-research-pro")

	data, err := kitutil.Marshal(&request)
	require.NoError(t, err)
	assert.Contains(t, string(data), `"agent":"deep-research-pro"`)
	assert.NotContains(t, string(data), `"model"`)
	assert.Contains(t, string(data), `"future_option":{"enabled":true}`)
}
