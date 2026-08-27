package openai

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChatStreamStatsDedupesToolFragmentsByChoiceIndexAndCallID(t *testing.T) {
	stats := newChatStreamStats()
	chunks := []string{
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"c1","type":"function","function":{"name":"get_weather","arguments":""}}]}}]}`,
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"q\":"}}]}}]}`,
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"get_weather","arguments":"\"x\"}"}}]}}]}`,
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":1,"id":"c2","type":"function","function":{"name":"get_time","arguments":""}}]}}]}`,
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":1,"function":{"arguments":"{}"}}]}}]}`,
	}
	for _, chunk := range chunks {
		var response dto.ChatCompletionsStreamResponse
		require.NoError(t, common.UnmarshalJsonStr(chunk, &response))
		stats.Observe(response)
	}

	assert.Equal(t, 2, stats.ToolCount())
	assert.Equal(t, []string{"get_weather", "get_time"}, stats.FunctionCallNames())
	assert.Equal(t, 1, strings.Count(stats.Text(), "get_weather"))
	assert.Equal(t, 1, strings.Count(stats.Text(), "get_time"))
}

func TestChatStreamStatsDoesNotMergeDifferentCallIDsReusingOneSlot(t *testing.T) {
	stats := newChatStreamStats()
	for _, chunk := range []string{
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"first","arguments":"{}"}}]}}]}`,
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"c2","function":{"name":"second","arguments":"{}"}}]}}]}`,
	} {
		var response dto.ChatCompletionsStreamResponse
		require.NoError(t, common.UnmarshalJsonStr(chunk, &response))
		stats.Observe(response)
	}

	assert.Equal(t, 2, stats.ToolCount())
	assert.Equal(t, []string{"first", "second"}, stats.FunctionCallNames())
}
