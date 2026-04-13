package operation_setting

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestClaudeCliTraceDoesNotSkipRetryOnFailure(t *testing.T) {
	setting := GetChannelAffinitySetting()
	require.NotNil(t, setting)

	for _, rule := range setting.Rules {
		if strings.EqualFold(strings.TrimSpace(rule.Name), "claude cli trace") {
			require.False(t, rule.SkipRetryOnFailure)
			return
		}
	}

	t.Fatalf("claude cli trace rule not found")
}
