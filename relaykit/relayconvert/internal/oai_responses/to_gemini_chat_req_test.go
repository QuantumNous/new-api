package oairesponses

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestOpenAIResponsesRequestToGeminiNormalizesLiteralToolUnion(t *testing.T) {
	got, err := OpenAIResponsesRequestToGeminiChat(context.Background(), &dto.OpenAIResponsesRequest{
		Model: "gemini-test",
		Tools: json.RawMessage(`[{"type":"function","name":"update_task","parameters":{"type":"object","properties":{"status":{"anyOf":[{"type":"string","const":"open"},{"type":"string","const":"completed"}]}}}}]`),
	}, &convmeta.Values{})
	require.NoError(t, err)

	path := "0.functionDeclarations.0.parameters.properties.status"
	assert.Equal(t, "STRING", gjson.GetBytes(got.Tools, path+".type").String())
	assert.Equal(t, "open", gjson.GetBytes(got.Tools, path+".enum.0").String())
	assert.Equal(t, "completed", gjson.GetBytes(got.Tools, path+".enum.1").String())
	assert.False(t, gjson.GetBytes(got.Tools, path+".anyOf").Exists())
}
