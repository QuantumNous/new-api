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

/** TestGeminiChatResponseID preserves provider IDs without adding absent fields. */
func TestGeminiChatResponseID(t *testing.T) {
	var response GeminiChatResponse
	require.NoError(t, kitutil.Unmarshal([]byte(`{"responseId":"synthetic-response-id","usageMetadata":{"promptTokenCount":5}}`), &response))
	assert.Equal(t, "synthetic-response-id", response.ResponseID)
	assert.True(t, response.HasUsageMetadata)
	data, err := kitutil.Marshal(response)
	require.NoError(t, err)
	assert.Contains(t, string(data), `"responseId":"synthetic-response-id"`)
	require.NoError(t, kitutil.Unmarshal([]byte(`{"candidates":[]}`), &response))
	assert.Empty(t, response.ResponseID)
	assert.False(t, response.HasUsageMetadata)
	data, err = kitutil.Marshal(response)
	require.NoError(t, err)
	assert.NotContains(t, string(data), `"responseId"`)
}
