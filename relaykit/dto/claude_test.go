package dto

import (
	"testing"

	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestClaudeStopDetailsPreservesExplicitNullFields(t *testing.T) {
	var response ClaudeResponse
	require.NoError(t, kitutil.Unmarshal([]byte(`{
		"stop_reason":"refusal",
		"stop_details":{"type":"refusal","category":null,"explanation":null}
	}`), &response))

	require.NotNil(t, response.StopDetails)
	assert.Equal(t, "refusal", response.StopDetails.Type)
	assert.Nil(t, response.StopDetails.Category)
	assert.Nil(t, response.StopDetails.Explanation)

	encoded, err := kitutil.Marshal(response)
	require.NoError(t, err)

	var payload map[string]any
	require.NoError(t, kitutil.Unmarshal(encoded, &payload))
	details, ok := payload["stop_details"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "refusal", details["type"])
	assert.Contains(t, details, "category")
	assert.Nil(t, details["category"])
	assert.Contains(t, details, "explanation")
	assert.Nil(t, details["explanation"])
}
