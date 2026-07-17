package dto

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestImageRequestAsyncFieldsAreGatewayOnly(t *testing.T) {
	var request ImageRequest
	require.NoError(t, common.Unmarshal([]byte(`{
		"model":"gpt-image-2",
		"prompt":"draw a lighthouse",
		"async":true,
		"webhook_url":"https://example.com/image-hook",
		"webhook_secret":"secret"
	}`), &request))

	require.NotNil(t, request.Async)
	assert.True(t, *request.Async)
	assert.Equal(t, "https://example.com/image-hook", request.WebhookURL)
	assert.Equal(t, "secret", request.WebhookSecret)
	assert.NotContains(t, request.Extra, "async")
	assert.NotContains(t, request.Extra, "webhook_url")
	assert.NotContains(t, request.Extra, "webhook_secret")

	encoded, err := common.Marshal(request)
	require.NoError(t, err)
	assert.NotContains(t, string(encoded), `"async"`)
	assert.NotContains(t, string(encoded), `"webhook_url"`)
	assert.NotContains(t, string(encoded), `"webhook_secret"`)
	assert.Contains(t, string(encoded), `"model":"gpt-image-2"`)
}
