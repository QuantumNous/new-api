package model

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/stretchr/testify/require"
)

func TestValidateOptionValueRejectsInvalidResponsesRoutingPolicy(t *testing.T) {
	t.Parallel()

	err := validateOptionValue(
		model_setting.ChatCompletionsToResponsesPolicyOptionKey,
		`{"enabled":true,"all_channels":true,"model_patterns":["("]}`,
	)
	require.Error(t, err)
}
