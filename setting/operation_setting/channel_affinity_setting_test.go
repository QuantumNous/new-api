package operation_setting

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCodexAffinityTemplateIncludesCurrentCodexHeaders(t *testing.T) {
	require.Subset(t, codexCliPassThroughHeaders, []string{
		"Thread_id",
		"Session-Id",
		"Thread-Id",
		"X-Client-Request-Id",
		"X-Codex-Turn-State",
		"X-Codex-Window-Id",
		"X-Codex-Parent-Thread-Id",
		"X-OpenAI-Subagent",
		"X-OpenAI-Memgen-Request",
		"X-ResponsesAPI-Include-Timing-Metrics",
		"X-OpenAI-Internal-Codex-Responses-Lite",
	})

	operations := channelAffinitySetting.Rules[0].ParamOverrideTemplate["operations"].([]map[string]interface{})
	require.Len(t, operations, 1)
	require.Equal(t, codexCliPassThroughHeaders, operations[0]["value"])
}
