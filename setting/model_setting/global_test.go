package model_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateChatCompletionsToResponsesPolicy(t *testing.T) {
	t.Parallel()

	for _, value := range []string{
		`{}`,
		`{"enabled":false}`,
		`{"enabled":true,"all_channels":true,"model_patterns":[]}`,
		`{"enabled":true,"channel_ids":[1],"model_patterns":["^gpt-5\\."]}`,
		`{"enabled":true,"channel_types":[1],"model_patterns":["(?i)^gpt-"]}`,
	} {
		require.NoError(t, ValidateChatCompletionsToResponsesPolicy(value), value)
	}
}

func TestValidateChatCompletionsToResponsesPolicyRejectsInvalidConfiguration(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		value   string
		message string
	}{
		{name: "invalid json", value: `{`, message: "invalid Responses routing policy JSON"},
		{name: "unknown field", value: `{"enabled":false,"model_pattern":[]}`, message: "unknown field"},
		{name: "trailing data", value: `{} {}`, message: "trailing data"},
		{name: "null", value: `null`, message: "must be a JSON object"},
		{name: "no selected channels", value: `{"enabled":true,"model_patterns":[]}`, message: "must select"},
		{name: "invalid channel id", value: `{"enabled":true,"channel_ids":[0]}`, message: "channel_ids[0]"},
		{name: "blank pattern", value: `{"enabled":true,"all_channels":true,"model_patterns":[" "]}`, message: "must not be empty"},
		{name: "invalid regex", value: `{"enabled":true,"all_channels":true,"model_patterns":["("]}`, message: "invalid model_patterns[0]"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateChatCompletionsToResponsesPolicy(tt.value)
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.message)
		})
	}
}
