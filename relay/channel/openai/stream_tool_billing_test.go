package openai

import (
	"fmt"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOaiStreamHandlerPreservesLastChoiceWithUsage(t *testing.T) {
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	tests := []struct {
		name         string
		firstChoice  string
		lastChoices  string
		includeUsage bool
		wantLast     bool
		wantOutcome  string
	}{
		{
			name:        "stop with usage",
			lastChoices: `[{"index":0,"delta":{},"finish_reason":"stop"}]`,
			wantLast:    true,
			wantOutcome: "completed",
		},
		{
			name:        "length with usage",
			lastChoices: `[{"index":0,"delta":{},"finish_reason":"length"}]`,
			wantLast:    true,
			wantOutcome: "completed",
		},
		{
			name:        "tool calls finish with usage",
			firstChoice: `{"index":0,"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"lookup","arguments":"{}"}}]}}`,
			lastChoices: `[{"index":0,"delta":{},"finish_reason":"tool_calls"}]`,
			wantLast:    true,
			wantOutcome: "completed",
		},
		{
			name:        "tool argument delta without finish preserves data without marking completion",
			firstChoice: `{"index":0,"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"lookup","arguments":""}}]}}`,
			lastChoices: `[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{}"}}]}}]`,
			wantLast:    true,
		},
		{
			name:        "text with usage",
			lastChoices: `[{"index":0,"delta":{"content":" world"},"finish_reason":"stop"}]`,
			wantLast:    true,
			wantOutcome: "completed",
		},
		{
			name:        "reasoning with usage",
			lastChoices: `[{"index":0,"delta":{"reasoning_content":"done"},"finish_reason":"stop"}]`,
			wantLast:    true,
			wantOutcome: "completed",
		},
		{
			name:        "usage-only frame omitted when not requested",
			firstChoice: `{"index":0,"delta":{"content":"hello"},"finish_reason":"stop"}`,
			lastChoices: `[]`,
			wantOutcome: "completed",
		},
		{
			name:         "usage-only frame retained when requested",
			firstChoice:  `{"index":0,"delta":{"content":"hello"},"finish_reason":"stop"}`,
			lastChoices:  `[]`,
			includeUsage: true,
			wantLast:     true,
			wantOutcome:  "completed",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			firstChoice := tt.firstChoice
			if firstChoice == "" {
				firstChoice = `{"index":0,"delta":{"role":"assistant","content":"hello"}}`
			}
			first := fmt.Sprintf(`{"id":"chat_test","model":"gpt-test","choices":[%s]}`, firstChoice)
			last := fmt.Sprintf(`{"id":"chat_test","model":"gpt-test","choices":%s,"usage":{"prompt_tokens":10,"completion_tokens":2,"total_tokens":12}}`, tt.lastChoices)
			body := strings.Join([]string{"data: " + first, "data: " + last, "data: [DONE]", ""}, "\n\n")
			c, recorder, resp, info := newResponsesChatTestContext(t, body, true)
			info.RelayMode = relayconstant.RelayModeChatCompletions
			info.ShouldIncludeUsage = tt.includeUsage

			usage, apiErr := OaiStreamHandler(c, info, resp)
			require.Nil(t, apiErr)
			require.NotNil(t, usage)
			assert.Equal(t, 10, usage.PromptTokens)
			assert.Equal(t, 2, usage.CompletionTokens)
			assert.Equal(t, 12, usage.TotalTokens)
			assert.Equal(t, tt.wantOutcome, info.StreamStatus.ResponseOutcome())

			got := recorder.Body.String()
			assert.Equal(t, 1, strings.Count(got, "data: [DONE]"))
			if tt.wantLast {
				assert.Equal(t, 1, strings.Count(got, "data: "+last+"\n\n"))
				assert.Less(t, strings.Index(got, "data: "+last), strings.Index(got, "data: [DONE]"))
			} else {
				assert.NotContains(t, got, "data: "+last)
			}
		})
	}
}

func TestObserveStreamChoicesDedupesFunctionCallNames(t *testing.T) {
	info := &relaycommon.RelayInfo{StreamStatus: relaycommon.NewStreamStatus()}
	seen := make(map[string]struct{})
	var names []string

	chunks := []string{
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"c1","type":"function","function":{"name":"get_weather","arguments":""}}]}}]}`,
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"q\":"}}]}}]}`,
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\"x\"}"}}]}}]}`,
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":1,"id":"c2","type":"function","function":{"name":"get_time","arguments":""}}]}}]}`,
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":1,"function":{"arguments":"{}"}}]}}]}`,
	}
	for _, chunk := range chunks {
		observeStreamChoices(info, chunk, seen, &names)
	}

	require.Len(t, names, 2)
	assert.Equal(t, []string{"get_weather", "get_time"}, names)
	assert.Empty(t, info.StreamStatus.ResponseOutcome(), "tool call deltas carry no finish reason")

	observeStreamChoices(info, `{"choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}`, seen, &names)
	assert.Equal(t, "completed", info.StreamStatus.ResponseOutcome())
	assert.False(t, info.PerformanceBusinessRejection)

	filtered := &relaycommon.RelayInfo{StreamStatus: relaycommon.NewStreamStatus()}
	observeStreamChoices(filtered, `{"choices":[{"index":0,"delta":{},"finish_reason":"content_filter"}]}`, map[string]struct{}{}, &names)
	assert.True(t, filtered.PerformanceBusinessRejection)
}
