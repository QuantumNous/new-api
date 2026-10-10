package claude

import (
	"net/http/httptest"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHandleClaudeResponseDataCountsToolUse(t *testing.T) {
	gin.SetMode(gin.TestMode)
	operation_setting.SetToolPriceForTest("lookup_fn", 3.0)
	t.Cleanup(func() {
		operation_setting.DeleteToolPriceForTest("lookup_fn")
	})

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	info := &relaycommon.RelayInfo{
		OriginModelName: "claude-3-7-sonnet",
		RelayFormat:     types.RelayFormatClaude,
	}
	claudeInfo := &ClaudeResponseInfo{Usage: &dto.Usage{}}

	data := []byte(`{
		"type":"message",
		"content":[
			{"type":"text","text":"hi"},
			{"type":"tool_use","id":"tu1","name":"lookup_fn","input":{}},
			{"type":"server_tool_use","id":"stu1","name":"web_search","input":{}}
		],
		"usage":{"input_tokens":1,"output_tokens":1}
	}`)

	err := HandleClaudeResponseData(c, info, claudeInfo, nil, data)
	require.Nil(t, err)
	require.NotNil(t, info.ResponsesUsageInfo)
	require.Contains(t, info.ResponsesUsageInfo.BuiltInTools, "lookup_fn")
	assert.Equal(t, 1, info.ResponsesUsageInfo.BuiltInTools["lookup_fn"].CallCount)
	assert.NotContains(t, info.ResponsesUsageInfo.BuiltInTools, "web_search")
}

func TestCountClaudeStreamBillableToolsSetsWebSearchRequests(t *testing.T) {
	info := &relaycommon.RelayInfo{OriginModelName: "claude-3-7-sonnet"}

	countClaudeStreamBillableTools(info, &dto.ClaudeResponse{
		Type: "message_delta",
		Usage: &dto.ClaudeUsage{
			ServerToolUse: &dto.ClaudeServerToolUse{WebSearchRequests: 3},
		},
	})
	require.Contains(t, info.ResponsesUsageInfo.BuiltInTools, "web_search")
	assert.Equal(t, 3, info.ResponsesUsageInfo.BuiltInTools["web_search"].CallCount)
	assert.Len(t, info.ResponsesUsageInfo.BuiltInTools, 1, "server tools reported as zero are not recorded")

	operation_setting.SetToolPriceForTest("stream_fn", 2.0)
	t.Cleanup(func() {
		operation_setting.DeleteToolPriceForTest("stream_fn")
	})
	countClaudeStreamBillableTools(info, &dto.ClaudeResponse{
		Type: "content_block_start",
		ContentBlock: &dto.ClaudeMediaMessage{
			Type: "tool_use",
			Name: "stream_fn",
		},
	})
	require.Contains(t, info.ResponsesUsageInfo.BuiltInTools, "stream_fn")
	assert.Equal(t, 1, info.ResponsesUsageInfo.BuiltInTools["stream_fn"].CallCount)
}

// usage.server_tool_use counts bill under their own keys; a channel that
// bills web search under a vendor key (Ali's Anthropic endpoint) re-keys
// web_search_requests.
func TestCountClaudeStreamBillableToolsServerToolKeys(t *testing.T) {
	tests := []struct {
		name       string
		billingKey string
		usage      dto.ClaudeServerToolUse
		want       map[string]int
	}{
		{
			name:       "vendor web search key",
			billingKey: "search_strategy_agent",
			usage:      dto.ClaudeServerToolUse{WebSearchRequests: 2},
			want:       map[string]int{"search_strategy_agent": 2},
		},
		{
			name:  "every server tool",
			usage: dto.ClaudeServerToolUse{WebSearchRequests: 1, WebFetchRequests: 2, CodeExecutionRequests: 3, ToolSearchRequests: 4},
			want:  map[string]int{"web_search": 1, "web_fetch": 2, "code_execution": 3, "tool_search": 4},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			info := &relaycommon.RelayInfo{OriginModelName: "claude-3-7-sonnet", WebSearchBillingKey: tt.billingKey}
			countClaudeStreamBillableTools(info, &dto.ClaudeResponse{
				Type:  "message_delta",
				Usage: &dto.ClaudeUsage{ServerToolUse: &tt.usage},
			})
			counts := map[string]int{}
			for name, tool := range info.ResponsesUsageInfo.BuiltInTools {
				counts[name] = tool.CallCount
			}
			assert.Equal(t, tt.want, counts)
		})
	}
}
