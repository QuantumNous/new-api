package service

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSanitizeFailedRelayLogValueHidesNestedExternalAddresses(t *testing.T) {
	input := map[string]interface{}{
		"error_message": `Post "https://api.openai.com/v1/chat/completions": dial tcp 34.117.1.2:443 failed`,
		"stream_status": map[string]interface{}{
			"errors": []interface{}{
				"upstream api.anthropic.com:443 returned 502",
			},
		},
	}

	output := sanitizeFailedRelayLogMap(input)
	raw := stringifyForFailedRelayLogTest(output)

	require.NotContains(t, raw, "https://")
	require.NotContains(t, raw, "api.openai.com")
	require.NotContains(t, raw, "api.anthropic.com")
	require.NotContains(t, raw, "34.117.1.2")
	require.Contains(t, raw, "[已隐藏外部地址]")
}

func stringifyForFailedRelayLogTest(value interface{}) string {
	switch v := value.(type) {
	case string:
		return v
	case map[string]interface{}:
		parts := make([]string, 0, len(v))
		for _, item := range v {
			parts = append(parts, stringifyForFailedRelayLogTest(item))
		}
		return strings.Join(parts, " ")
	case []interface{}:
		parts := make([]string, 0, len(v))
		for _, item := range v {
			parts = append(parts, stringifyForFailedRelayLogTest(item))
		}
		return strings.Join(parts, " ")
	default:
		return ""
	}
}
