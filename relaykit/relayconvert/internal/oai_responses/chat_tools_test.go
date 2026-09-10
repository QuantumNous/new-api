package oairesponses

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChatToolsFromResponsesTools(t *testing.T) {
	t.Run("function and custom tools keep their chat completions shape", func(t *testing.T) {
		got, err := ChatToolsFromResponsesTools(mustRawMessage(t, []map[string]any{
			{
				"type":        "function",
				"name":        "memory_search",
				"description": "search memory",
				"parameters":  map[string]any{"type": "object"},
			},
			{
				"type":   "custom",
				"name":   "apply_patch",
				"format": map[string]any{"type": "text"},
			},
		}))
		require.NoError(t, err)

		encoded, err := kitutil.Marshal(got)
		require.NoError(t, err)
		// The custom tool must not carry an empty "function": encoding/json
		// ignores omitempty on struct fields, and strict upstreams reject it.
		assert.JSONEq(t, `[
			{"type":"function","function":{"name":"memory_search","description":"search memory","parameters":{"type":"object"}}},
			{"type":"custom","custom":{"name":"apply_patch","format":{"type":"text"}}}
		]`, string(encoded))
	})

	t.Run("group members are lifted to the top level under qualified names", func(t *testing.T) {
		for _, groupType := range []string{"namespace", "mcp_server"} {
			t.Run(groupType, func(t *testing.T) {
				got, err := ChatToolsFromResponsesTools(mustRawMessage(t, []map[string]any{
					{"type": "function", "name": "memory_search", "parameters": map[string]any{"type": "object"}},
					{
						"type": groupType,
						"name": "mcp__codex_app",
						"tools": []map[string]any{
							{"type": "function", "name": "read_thread", "description": "read", "parameters": map[string]any{"type": "object"}},
						},
					},
				}))
				require.NoError(t, err)

				require.Len(t, got, 2)
				assert.Equal(t, "memory_search", got[0].Function.Name)
				assert.Equal(t, "mcp__codex_app__read_thread", got[1].Function.Name)
				assert.Equal(t, "read", got[1].Function.Description)
			})
		}
	})

	t.Run("the same member name in two groups stays distinguishable", func(t *testing.T) {
		// Member names are unique only inside their group, so flattening without
		// the namespace would silently collapse these two onto one tool.
		got, err := ChatToolsFromResponsesTools(mustRawMessage(t, []map[string]any{
			{"type": "namespace", "name": "container", "tools": []map[string]any{{"type": "function", "name": "js"}}},
			{"type": "namespace", "name": "browser", "tools": []map[string]any{{"type": "function", "name": "js"}}},
		}))
		require.NoError(t, err)

		require.Len(t, got, 2)
		assert.Equal(t, "container__js", got[0].Function.Name)
		assert.Equal(t, "browser__js", got[1].Function.Name)
	})

	t.Run("hosted tools are dropped instead of failing the request", func(t *testing.T) {
		// An agent client attaches web_search to every request, so failing would
		// make the channel unusable rather than degraded.
		for _, hostedType := range []string{"web_search", "tool_search", "file_search", "code_interpreter"} {
			t.Run(hostedType, func(t *testing.T) {
				got, err := ChatToolsFromResponsesTools(mustRawMessage(t, []map[string]any{
					{"type": "function", "name": "memory_search", "parameters": map[string]any{"type": "object"}},
					{"type": hostedType},
				}))
				require.NoError(t, err)

				require.Len(t, got, 1)
				assert.Equal(t, "memory_search", got[0].Function.Name)
			})
		}
	})

	t.Run("structural problems are reported with their request path", func(t *testing.T) {
		tests := []struct {
			name         string
			tools        []map[string]any
			wantContains []string
		}{
			{
				name:         "group without a tools array",
				tools:        []map[string]any{{"type": "namespace", "name": "mcp__codex_app"}},
				wantContains: []string{"tools[0]", "namespace"},
			},
			{
				name: "member that is not an object",
				tools: []map[string]any{
					{"type": "namespace", "name": "mcp__codex_app", "tools": []any{"js"}},
				},
				wantContains: []string{"tools[0].tools[0]"},
			},
			{
				name: "member colliding with a top-level tool",
				tools: []map[string]any{
					{"type": "function", "name": "container__js"},
					{"type": "namespace", "name": "container", "tools": []map[string]any{{"type": "function", "name": "js"}}},
				},
				wantContains: []string{`"container__js"`, "tools[0]", "tools[1].tools[0]"},
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				_, err := ChatToolsFromResponsesTools(mustRawMessage(t, tt.tools))
				require.Error(t, err)
				for _, want := range tt.wantContains {
					assert.Contains(t, err.Error(), want)
				}
			})
		}
	})
}

func TestQualifyResponsesFunctionCallName(t *testing.T) {
	// The client replays the call it received, with the namespace split into its
	// own field; the upstream only knows the flattened name it was offered.
	tests := []struct {
		name string
		item map[string]any
		want string
	}{
		{name: "namespaced call", item: map[string]any{"namespace": "container", "name": "js"}, want: "container__js"},
		{name: "plain call", item: map[string]any{"name": "js"}, want: "js"},
		{name: "blank namespace", item: map[string]any{"namespace": "  ", "name": "js"}, want: "js"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, QualifyResponsesFunctionCallName(tt.item, "js"))
		})
	}
}

func TestResponsesRequestToChatCompletionsRequestReQualifiesReplayedCall(t *testing.T) {
	got, err := ResponsesRequestToChatCompletionsRequest(&dto.OpenAIResponsesRequest{
		Model: "deepseek-v4-flash",
		Input: mustRawMessage(t, []map[string]any{
			{"role": "user", "content": "hi"},
			{
				"type":      "function_call",
				"call_id":   "call_1",
				"name":      "js",
				"namespace": "container",
				"arguments": `{"code":"6*7"}`,
			},
		}),
	})
	require.NoError(t, err)

	require.Len(t, got.Messages, 2)
	toolCalls := got.Messages[1].ParseToolCalls()
	require.Len(t, toolCalls, 1)
	assert.Equal(t, "container__js", toolCalls[0].Function.Name)
}
