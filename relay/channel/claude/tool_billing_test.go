package claude

import (
	"cmp"
	"fmt"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
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
		fetchKey   string
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
			name:       "vendor web search and web fetch keys",
			billingKey: "deepseek_search",
			fetchKey:   "deepseek_fetch",
			usage:      dto.ClaudeServerToolUse{WebSearchRequests: 1, WebFetchRequests: 2},
			want:       map[string]int{"deepseek_search": 1, "deepseek_fetch": 2},
		},
		{
			name:  "every server tool",
			usage: dto.ClaudeServerToolUse{WebSearchRequests: 1, WebFetchRequests: 2, CodeExecutionRequests: 3, ToolSearchRequests: 4},
			want:  map[string]int{"web_search": 1, "web_fetch": 2, "code_execution": 3, "tool_search": 4},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			info := &relaycommon.RelayInfo{OriginModelName: "claude-3-7-sonnet", WebSearchBillingKey: tt.billingKey, WebFetchBillingKey: tt.fetchKey}
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

// On a channel whose upstream prices search itself (DeepSeek), each delivered
// web_search_tool_result bills one search under the vendor key, so a stream cut
// before message_delta still pays for the searches that ran;
// usage.server_tool_use replaces that count when reported. Error results and
// channels without a vendor key count nothing from blocks.
func TestClaudeSearchResultBlocksBillVendorSearch(t *testing.T) {
	gin.SetMode(gin.TestMode)
	const results = `{"type":"web_search_tool_result","tool_use_id":"call_0","content":[{"type":"web_search_result","url":"https://example.com/"}]}`
	const empty = `{"type":"web_search_tool_result","tool_use_id":"call_1","content":[]}`
	const failed = `{"type":"web_search_tool_result","tool_use_id":"call_2","content":{"type":"web_search_tool_result_error","error_code":"unavailable"}}`
	tests := []struct {
		name, billingKey, blocks, usage string
		want                            map[string]int
	}{
		{name: "stream cut before message_delta", billingKey: "deepseek_search", blocks: results + "," + empty + "," + failed,
			want: map[string]int{"deepseek_search": 2}},
		{name: "reported count replaces blocks", billingKey: "deepseek_search", blocks: results + "," + results,
			usage: `{"input_tokens":1,"output_tokens":1,"server_tool_use":{"web_search_requests":3}}`, want: map[string]int{"deepseek_search": 3}},
		{name: "no vendor key", blocks: results, want: map[string]int{}},
	}
	for _, tt := range tests {
		for _, stream := range []bool{true, false} {
			t.Run(fmt.Sprintf("%s stream=%t", tt.name, stream), func(t *testing.T) {
				info := &relaycommon.RelayInfo{OriginModelName: "claude-sonnet-4-5", RelayFormat: types.RelayFormatClaude, WebSearchBillingKey: tt.billingKey}
				var blocks []dto.ClaudeMediaMessage
				require.NoError(t, common.UnmarshalJsonStr("["+tt.blocks+"]", &blocks))
				if stream {
					for i := range blocks {
						countClaudeStreamBillableTools(info, &dto.ClaudeResponse{Type: "content_block_start", ContentBlock: &blocks[i]})
					}
					if tt.usage != "" {
						var usage dto.ClaudeUsage
						require.NoError(t, common.UnmarshalJsonStr(tt.usage, &usage))
						countClaudeStreamBillableTools(info, &dto.ClaudeResponse{Type: "message_delta", Usage: &usage})
					}
				} else {
					usage := cmp.Or(tt.usage, `{"input_tokens":1,"output_tokens":1}`)
					data := []byte(`{"type":"message","content":[` + tt.blocks + `],"usage":` + usage + `}`)
					c, _ := gin.CreateTestContext(httptest.NewRecorder())
					require.Nil(t, HandleClaudeResponseData(c, info, &ClaudeResponseInfo{Usage: &dto.Usage{}}, nil, data))
				}
				counts := map[string]int{}
				if info.ResponsesUsageInfo != nil {
					for name, tool := range info.ResponsesUsageInfo.BuiltInTools {
						counts[name] = tool.CallCount
					}
				}
				assert.Equal(t, tt.want, counts)
			})
		}
	}
}
