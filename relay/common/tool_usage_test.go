package common

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCountBillableToolCallWebSearchPrefersDeclaredWebSearch(t *testing.T) {
	info := &RelayInfo{
		OriginModelName: "gpt-5.1",
		ResponsesUsageInfo: &ResponsesUsageInfo{
			BuiltInTools: map[string]*BuildInToolInfo{
				dto.BuildInToolWebSearch: {ToolName: dto.BuildInToolWebSearch, CallCount: 0},
			},
		},
	}

	info.CountBillableToolCall(dto.BuildInCallWebSearchCall, "")
	require.Contains(t, info.ResponsesUsageInfo.BuiltInTools, dto.BuildInToolWebSearch)
	assert.Equal(t, 1, info.ResponsesUsageInfo.BuiltInTools[dto.BuildInToolWebSearch].CallCount)
	assert.NotContains(t, info.ResponsesUsageInfo.BuiltInTools, dto.BuildInToolWebSearchPreview)
}

func TestCountBillableToolCallWebSearchDefaultsToPreview(t *testing.T) {
	info := &RelayInfo{OriginModelName: "gpt-5.1"}

	info.CountBillableToolCall(dto.BuildInCallWebSearchCall, "")
	require.NotNil(t, info.ResponsesUsageInfo)
	require.Contains(t, info.ResponsesUsageInfo.BuiltInTools, dto.BuildInToolWebSearchPreview)
	assert.Equal(t, 1, info.ResponsesUsageInfo.BuiltInTools[dto.BuildInToolWebSearchPreview].CallCount)
}

func TestCountBillableToolCallFunctionCallRequiresPrice(t *testing.T) {
	operation_setting.SetToolPriceForTest("my_priced_fn", 5.0)
	t.Cleanup(func() {
		operation_setting.DeleteToolPriceForTest("my_priced_fn")
	})

	info := &RelayInfo{OriginModelName: "gpt-5.1"}
	info.CountBillableToolCall(dto.BuildInCallFunctionCall, "my_priced_fn")
	require.Contains(t, info.ResponsesUsageInfo.BuiltInTools, "my_priced_fn")
	assert.Equal(t, 1, info.ResponsesUsageInfo.BuiltInTools["my_priced_fn"].CallCount)

	info.CountBillableToolCall(dto.BuildInCallFunctionCall, "unpriced_fn")
	assert.NotContains(t, info.ResponsesUsageInfo.BuiltInTools, "unpriced_fn")
}

// Hosted-tool price keys bill hosted tools only: a client function or
// tool_use with the same name is never counted, even when the operator prices
// that name. The reserved set is the built-in price seed plus the hosted
// tools without a built-in price; an operator price alone reserves nothing.
func TestCountBillableToolCallFunctionCallSkipsReservedNames(t *testing.T) {
	wantBilled := map[string]bool{
		dto.BuildInToolWebSearchPreview: false,
		dto.BuildInToolFileSearch:       false,
		dto.BuildInToolGoogleSearch:     false,
		dto.BuildInToolImageGeneration:  false,
		"bing_web_search":               false, // built-in vendor price
		GoogleSearchGroundedPromptTool:  false, // built-in only for gemini-2.5* and older
		"web_fetch":                     false, // Anthropic server tool, no built-in price
		"lookup_order":                  true,  // operator-priced client function
	}
	for name := range wantBilled {
		operation_setting.SetToolPriceForTest(name, 7)
	}
	t.Cleanup(func() {
		for name := range wantBilled {
			operation_setting.DeleteToolPriceForTest(name)
		}
	})

	for name, billed := range wantBilled {
		info := &RelayInfo{OriginModelName: "gpt-5.1"}
		info.CountBillableToolCall(dto.BuildInCallFunctionCall, name)
		info.CountBillableToolCall(dto.BuildInCallToolUse, name)
		if billed {
			require.Contains(t, info.ResponsesUsageInfo.BuiltInTools, name)
			assert.Equal(t, 2, info.ResponsesUsageInfo.BuiltInTools[name].CallCount, name)
			continue
		}
		assert.NotContains(t, info.ResponsesUsageInfo.BuiltInTools, name)
	}
}

// Upstream-reported counts replace per-item counts for the same key (an
// explicit zero silences them) and ignore negatives; a count the request
// itself proved belongs to one channel attempt, and a retry on another
// channel drops it together with the vendor billing hooks.
func TestBillableToolCountSources(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tests := []struct {
		name           string
		record         func(c *gin.Context, info *RelayInfo)
		want           map[string]int
		wantVendorHook bool
		wantBillingKey string
	}{
		{
			name: "negative upstream count is ignored",
			record: func(_ *gin.Context, info *RelayInfo) {
				info.SetBillableToolCount(dto.BuildInToolWebSearch, 3)
				info.SetBillableToolCount(dto.BuildInToolWebSearch, -5)
			},
			want: map[string]int{dto.BuildInToolWebSearch: 3},
		},
		{
			name: "vendor zero replaces protocol items",
			record: func(_ *gin.Context, info *RelayInfo) {
				info.CountBillableToolCall(dto.BuildInCallWebSearchCall, "")
				info.CountBillableToolCall(dto.BuildInCallWebSearchCall, "")
				info.VendorToolUsage = func([]byte) map[string]int {
					return map[string]int{"bing_web_search": 5, dto.BuildInToolWebSearchPreview: 0}
				}
				info.ApplyVendorToolUsage([]byte(`{}`))
			},
			want:           map[string]int{"bing_web_search": 5, dto.BuildInToolWebSearchPreview: 0},
			wantVendorHook: true,
		},
		{
			name: "channel retry drops the request-inferred call and vendor hooks",
			record: func(c *gin.Context, info *RelayInfo) {
				info.SetBillableToolCount(dto.BuildInToolWebSearch, 2)
				info.RecordRequestInferredToolCall("search_strategy_turbo")
				info.VendorToolUsage = func([]byte) map[string]int { return nil }
				info.WebSearchBillingKey = "search_strategy_agent"
				info.InitChannelMeta(c)
			},
			want: map[string]int{dto.BuildInToolWebSearch: 2},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
			info := &RelayInfo{OriginModelName: "gpt-5.1"}
			tt.record(c, info)
			counts := map[string]int{}
			for name, tool := range info.ResponsesUsageInfo.BuiltInTools {
				counts[name] = tool.CallCount
			}
			assert.Equal(t, tt.want, counts)
			assert.Equal(t, tt.wantVendorHook, info.VendorToolUsage != nil)
			assert.Equal(t, tt.wantBillingKey, info.WebSearchBillingKey)
		})
	}
}

func TestImageGenerationCallCounterCompletedOutputs(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		observe   func(c *ImageGenerationCallCounter)
		wantCount int
	}{
		{
			name: "one final result",
			observe: func(c *ImageGenerationCallCounter) {
				idx := 0
				c.Observe(&dto.ResponsesOutput{
					Type:   dto.ResponsesOutputTypeImageGenerationCall,
					ID:     "img_1",
					Status: "completed",
					Result: "base64-a",
				}, &idx)
			},
			wantCount: 1,
		},
		{
			name: "two distinct finals",
			observe: func(c *ImageGenerationCallCounter) {
				idx0, idx1 := 0, 1
				c.Observe(&dto.ResponsesOutput{
					Type:   dto.ResponsesOutputTypeImageGenerationCall,
					ID:     "img_1",
					Result: "base64-a",
				}, &idx0)
				c.Observe(&dto.ResponsesOutput{
					Type:   dto.ResponsesOutputTypeImageGenerationCall,
					ID:     "img_2",
					Result: "base64-b",
				}, &idx1)
			},
			wantCount: 2,
		},
		{
			name: "empty result",
			observe: func(c *ImageGenerationCallCounter) {
				idx := 0
				c.Observe(&dto.ResponsesOutput{
					Type:   dto.ResponsesOutputTypeImageGenerationCall,
					ID:     "img_1",
					Result: "   ",
				}, &idx)
			},
			wantCount: 0,
		},
		{
			name: "failed status",
			observe: func(c *ImageGenerationCallCounter) {
				idx := 0
				c.Observe(&dto.ResponsesOutput{
					Type:   dto.ResponsesOutputTypeImageGenerationCall,
					ID:     "img_1",
					Status: "failed",
					Result: "base64-a",
				}, &idx)
			},
			wantCount: 0,
		},
		{
			name: "incomplete status",
			observe: func(c *ImageGenerationCallCounter) {
				idx := 0
				c.Observe(&dto.ResponsesOutput{
					Type:   dto.ResponsesOutputTypeImageGenerationCall,
					ID:     "img_1",
					Status: "incomplete",
					Result: "base64-a",
				}, &idx)
			},
			wantCount: 0,
		},
		{
			name: "cancelled status",
			observe: func(c *ImageGenerationCallCounter) {
				idx := 0
				c.Observe(&dto.ResponsesOutput{
					Type:   dto.ResponsesOutputTypeImageGenerationCall,
					ID:     "img_1",
					Status: "cancelled",
					Result: "base64-a",
				}, &idx)
			},
			wantCount: 0,
		},
		{
			name: "canceled status",
			observe: func(c *ImageGenerationCallCounter) {
				idx := 0
				c.Observe(&dto.ResponsesOutput{
					Type:   dto.ResponsesOutputTypeImageGenerationCall,
					ID:     "img_1",
					Status: "canceled",
					Result: "base64-a",
				}, &idx)
			},
			wantCount: 0,
		},
		{
			name: "partial status",
			observe: func(c *ImageGenerationCallCounter) {
				idx := 0
				c.Observe(&dto.ResponsesOutput{
					Type:   dto.ResponsesOutputTypeImageGenerationCall,
					ID:     "img_1",
					Status: "partial",
					Result: "partial-bytes",
				}, &idx)
			},
			wantCount: 0,
		},
		{
			name: "id dedup",
			observe: func(c *ImageGenerationCallCounter) {
				idx0, idx1 := 0, 1
				c.Observe(&dto.ResponsesOutput{
					Type:   dto.ResponsesOutputTypeImageGenerationCall,
					ID:     "img_1",
					CallId: "call_a",
					Result: "base64-a",
				}, &idx0)
				c.Observe(&dto.ResponsesOutput{
					Type:   dto.ResponsesOutputTypeImageGenerationCall,
					ID:     "img_1",
					CallId: "call_b",
					Result: "base64-b",
				}, &idx1)
			},
			wantCount: 1,
		},
		{
			name: "index dedup",
			observe: func(c *ImageGenerationCallCounter) {
				idx := 0
				c.Observe(&dto.ResponsesOutput{
					Type:   dto.ResponsesOutputTypeImageGenerationCall,
					ID:     "img_1",
					Result: "base64-a",
				}, &idx)
				c.Observe(&dto.ResponsesOutput{
					Type:   dto.ResponsesOutputTypeImageGenerationCall,
					ID:     "img_2",
					Result: "base64-b",
				}, &idx)
			},
			wantCount: 1,
		},
		{
			name: "result hash dedup",
			observe: func(c *ImageGenerationCallCounter) {
				idx0, idx1 := 0, 1
				c.Observe(&dto.ResponsesOutput{
					Type:   dto.ResponsesOutputTypeImageGenerationCall,
					Result: "same-bytes",
				}, &idx0)
				c.Observe(&dto.ResponsesOutput{
					Type:   dto.ResponsesOutputTypeImageGenerationCall,
					Result: "same-bytes",
				}, &idx1)
			},
			wantCount: 1,
		},
		{
			name: "output_item.done plus completed dedup",
			observe: func(c *ImageGenerationCallCounter) {
				idx := 0
				item := &dto.ResponsesOutput{
					Type:   dto.ResponsesOutputTypeImageGenerationCall,
					ID:     "img_1",
					CallId: "call_1",
					Status: "completed",
					Result: "base64-a",
				}
				c.Observe(item, &idx)
				c.Observe(item, &idx)
			},
			wantCount: 1,
		},
		{
			name: "partial event equals zero",
			observe: func(c *ImageGenerationCallCounter) {
				idx := 0
				c.Observe(&dto.ResponsesOutput{
					Type:   "image_generation_call.partial_image",
					ID:     "img_1",
					Result: "partial-bytes",
				}, &idx)
			},
			wantCount: 0,
		},
		{
			name: "in_progress with final result counts",
			observe: func(c *ImageGenerationCallCounter) {
				idx := 0
				c.Observe(&dto.ResponsesOutput{
					Type:   dto.ResponsesOutputTypeImageGenerationCall,
					ID:     "img_1",
					Status: "in_progress",
					Result: "base64-a",
				}, &idx)
			},
			wantCount: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			counter := &ImageGenerationCallCounter{}
			tt.observe(counter)
			assert.Equal(t, tt.wantCount, counter.Count())
		})
	}
}

func TestImageGenerationCallCounterCommitCapsAtMaxImageN(t *testing.T) {
	t.Parallel()

	counter := &ImageGenerationCallCounter{}
	for i := range dto.MaxImageN + 3 {
		idx := i
		counter.Observe(&dto.ResponsesOutput{
			Type:   dto.ResponsesOutputTypeImageGenerationCall,
			ID:     "img_" + strings.Repeat("a", i+1),
			Result: "result-" + strings.Repeat("b", i+1),
		}, &idx)
	}
	require.Equal(t, dto.MaxImageN+3, counter.Count())

	info := &RelayInfo{}
	counter.Commit(info)
	require.Contains(t, info.ResponsesUsageInfo.BuiltInTools, dto.BuildInToolImageGeneration)
	assert.Equal(t, dto.MaxImageN, info.ResponsesUsageInfo.BuiltInTools[dto.BuildInToolImageGeneration].CallCount)
}

func TestImageGenerationCallCounterCommitDoesNotBillDeclarationsAlone(t *testing.T) {
	t.Parallel()

	info := &RelayInfo{
		ResponsesUsageInfo: &ResponsesUsageInfo{
			BuiltInTools: map[string]*BuildInToolInfo{
				dto.BuildInToolImageGeneration: {
					ToolName:  dto.BuildInToolImageGeneration,
					CallCount: 0,
				},
			},
		},
	}
	(&ImageGenerationCallCounter{}).Commit(info)
	assert.Equal(t, 0, info.ResponsesUsageInfo.BuiltInTools[dto.BuildInToolImageGeneration].CallCount)
}
