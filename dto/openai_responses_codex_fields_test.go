package dto

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestOpenAIResponsesRequestPreservesCodexMetadataAndReasoning(t *testing.T) {
	raw := []byte(`{
		"model":"gpt-5.6-sol",
		"client_metadata":{"client_version":"1.2.3"},
		"prompt_cache_options":{"mode":"explicit","ttl":"30m"},
		"reasoning":{"effort":"high","summary":"auto","mode":"standard","context":"all_turns"}
	}`)

	var request OpenAIResponsesRequest
	require.NoError(t, common.Unmarshal(raw, &request))

	encoded, err := common.Marshal(request)
	require.NoError(t, err)
	require.Equal(t, "1.2.3", gjson.GetBytes(encoded, "client_metadata.client_version").String())
	require.Equal(t, "explicit", gjson.GetBytes(encoded, "prompt_cache_options.mode").String())
	require.Equal(t, "30m", gjson.GetBytes(encoded, "prompt_cache_options.ttl").String())
	require.Equal(t, "standard", gjson.GetBytes(encoded, "reasoning.mode").String())
	require.Equal(t, "all_turns", gjson.GetBytes(encoded, "reasoning.context").String())
}

func TestOpenAIResponsesCompactionRequestPreservesCodexFields(t *testing.T) {
	raw := []byte(`{
		"model":"gpt-5.6-sol",
		"conversation":{"id":"conv_1"},
		"context_management":{"type":"compaction"},
		"temperature":0,
		"top_p":0,
		"max_output_tokens":0,
		"max_tool_calls":0,
		"top_logprobs":0,
		"tools":[{"type":"function","name":"lookup"}],
		"tool_choice":{"type":"function","name":"lookup"},
		"parallel_tool_calls":false,
		"reasoning":{"mode":"standard","context":"all_turns"},
		"service_tier":"priority",
		"prompt_cache_key":"cache-key",
		"prompt_cache_options":{"mode":"explicit","ttl":"30m"},
		"prompt_cache_retention":"24h",
		"text":{"format":{"type":"text"}},
		"truncation":"auto",
		"client_metadata":{"client_version":"1.2.3"}
	}`)

	var request OpenAIResponsesCompactionRequest
	require.NoError(t, common.Unmarshal(raw, &request))

	encoded, err := common.Marshal(request)
	require.NoError(t, err)
	require.Equal(t, "lookup", gjson.GetBytes(encoded, "tools.0.name").String())
	require.Equal(t, "lookup", gjson.GetBytes(encoded, "tool_choice.name").String())
	require.True(t, gjson.GetBytes(encoded, "parallel_tool_calls").Exists())
	require.False(t, gjson.GetBytes(encoded, "parallel_tool_calls").Bool())
	for _, path := range []string{"temperature", "top_p", "max_output_tokens", "max_tool_calls", "top_logprobs"} {
		require.True(t, gjson.GetBytes(encoded, path).Exists(), "%s must preserve explicit zero", path)
		require.Zero(t, gjson.GetBytes(encoded, path).Int())
	}
	require.Equal(t, "conv_1", gjson.GetBytes(encoded, "conversation.id").String())
	require.Equal(t, "compaction", gjson.GetBytes(encoded, "context_management.type").String())
	require.Equal(t, "standard", gjson.GetBytes(encoded, "reasoning.mode").String())
	require.Equal(t, "all_turns", gjson.GetBytes(encoded, "reasoning.context").String())
	require.Equal(t, "priority", gjson.GetBytes(encoded, "service_tier").String())
	require.Equal(t, "cache-key", gjson.GetBytes(encoded, "prompt_cache_key").String())
	require.Equal(t, "explicit", gjson.GetBytes(encoded, "prompt_cache_options.mode").String())
	require.Equal(t, "30m", gjson.GetBytes(encoded, "prompt_cache_options.ttl").String())
	require.Equal(t, "24h", gjson.GetBytes(encoded, "prompt_cache_retention").String())
	require.Equal(t, "text", gjson.GetBytes(encoded, "text.format.type").String())
	require.Equal(t, "auto", gjson.GetBytes(encoded, "truncation").String())
	require.Equal(t, "1.2.3", gjson.GetBytes(encoded, "client_metadata.client_version").String())
}
