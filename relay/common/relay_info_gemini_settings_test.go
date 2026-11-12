package common

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRelayInfoConvOptionsUsesNormalizedGeminiSafetySettings(t *testing.T) {
	settings := model_setting.GetGeminiSettings()
	original := settings.SafetySettings
	t.Cleanup(func() {
		settings.SafetySettings = original
	})
	settings.SafetySettings = map[string]string{
		"HARM_CATEGORY_HATE_SPEECH":       "",
		"HARM_CATEGORY_DANGEROUS_CONTENT": "BLOCK_ONLY_HIGH",
	}

	options := (&RelayInfo{}).ConvOptions()

	assert.Equal(t, "OFF", options.Gemini.SafetySetting("HARM_CATEGORY_HATE_SPEECH"))
	assert.Equal(t, "BLOCK_ONLY_HIGH", options.Gemini.SafetySetting("HARM_CATEGORY_DANGEROUS_CONTENT"))
}

// TestRelayInfoConvOptionsGeminiJSONSchemaSupport covers which upstreams get
// parametersJsonSchema and responseJsonSchema: every channel except one whose
// Gemini API version for the model is v1, and Vertex AI regardless of it.
func TestRelayInfoConvOptionsGeminiJSONSchemaSupport(t *testing.T) {
	settings := model_setting.GetGeminiSettings()
	original := settings.VersionSettings
	t.Cleanup(func() {
		settings.VersionSettings = original
	})
	settings.VersionSettings = map[string]string{"default": "v1beta", "gemini-v1-model": "v1"}

	tests := []struct {
		name        string
		channelType int
		model       string
		want        bool
	}{
		{name: "Gemini on the default version", channelType: constant.ChannelTypeGemini, model: "gemini-3.7-flash", want: true},
		{name: "Gemini on v1", channelType: constant.ChannelTypeGemini, model: "gemini-v1-model", want: false},
		{name: "Vertex AI", channelType: constant.ChannelTypeVertexAi, model: "gemini-v1-model", want: true},
		{name: "other channel on v1", channelType: constant.ChannelTypeAdvancedCustom, model: "gemini-v1-model", want: false},
		{name: "other channel on the default version", channelType: constant.ChannelTypeAdvancedCustom, model: "gemini-3.7-flash", want: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			info := &RelayInfo{ChannelMeta: &ChannelMeta{ChannelType: tt.channelType}}

			assert.Equal(t, tt.want, info.ConvOptions().Gemini.SupportsJSONSchemaModel(tt.model))
		})
	}
}

// Vertex AI rejects functionResponse.id. Only the ids are removed; inline data
// and every other member keep their bytes and order.
func TestRemoveGeminiDisabledFieldsDropsFunctionResponseIDs(t *testing.T) {
	settings := model_setting.GetGeminiSettings()
	original := settings.RemoveFunctionResponseIdEnabled
	t.Cleanup(func() {
		settings.RemoveFunctionResponseIdEnabled = original
	})
	settings.RemoveFunctionResponseIdEnabled = true

	input := `{"contents":[{"role":"user","parts":[{"inlineData":{"mimeType":"image/png","data":"iVBO<&>"}}]},{"role":"user","parts":[{"text":"x"},{"functionResponse":{"id":"call_1","name":"f","response":{"n":1.50}}},{"function_response":{"name":"g","id":"call_2"}}]}],"generationConfig":{"temperature":0.0}}`

	out, err := RemoveGeminiDisabledFields([]byte(input))

	require.NoError(t, err)
	assert.Equal(t, `{"contents":[{"role":"user","parts":[{"inlineData":{"mimeType":"image/png","data":"iVBO<&>"}}]},{"role":"user","parts":[{"text":"x"},{"functionResponse":{"name":"f","response":{"n":1.50}}},{"function_response":{"name":"g"}}]}],"generationConfig":{"temperature":0.0}}`, string(out))
}
