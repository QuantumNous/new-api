package oaichat

import (
	"context"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestOpenAIChatRequestToGeminiNormalizesNullableToolParameter(t *testing.T) {
	got, err := OpenAIChatRequestToGeminiGenerateContent(context.Background(), dto.GeneralOpenAIRequest{
		Model: "gemini-test",
		Tools: []dto.ToolCallRequest{{
			Type: "function",
			Function: dto.FunctionRequest{
				Name: "update_task",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"due_date": map[string]interface{}{
							"anyOf": []interface{}{
								map[string]interface{}{"type": "string"},
								map[string]interface{}{"type": "null"},
							},
						},
					},
				},
			},
		}},
	}, &convmeta.Values{})
	require.NoError(t, err)

	path := "0.functionDeclarations.0.parameters.properties.due_date"
	assert.Equal(t, "STRING", gjson.GetBytes(got.Tools, path+".type").String())
	assert.True(t, gjson.GetBytes(got.Tools, path+".nullable").Bool())
	assert.False(t, gjson.GetBytes(got.Tools, path+".anyOf").Exists())
}
