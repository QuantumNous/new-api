package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestManagedSearchToolSurchargeUsesActualMixedCalls(t *testing.T) {
	c, _ := gin.CreateTestContext(nil)
	c.Set("playground_managed_search", true)
	info := &relaycommon.RelayInfo{ResponsesUsageInfo: &relaycommon.ResponsesUsageInfo{BuiltInTools: map[string]*relaycommon.BuildInToolInfo{
		dto.BuildInToolXAIWebSearch: {CallCount: 2},
		dto.BuildInToolXAIXSearch:   {CallCount: 1},
	}}}
	summary := textQuotaSummary{ModelName: "grok-4.5", GroupRatio: 1}
	surcharge := calculateTextToolCallSurcharge(c, info, &summary)

	assert.True(t, surcharge.Equal(decimal.NewFromInt(7500)))
	assert.Equal(t, 2, summary.XAIWebSearchCallCount)
	assert.Equal(t, 1, summary.XAIXSearchCallCount)
	assert.Equal(t, 5.0, summary.XAIWebSearchPrice)
	assert.Equal(t, 5.0, summary.XAIXSearchPrice)
}

func TestManagedSearchToolSurchargeChargesWhenTokenUsageIsZero(t *testing.T) {
	c, _ := gin.CreateTestContext(nil)
	c.Set("playground_managed_search", true)
	info := &relaycommon.RelayInfo{
		OriginModelName: "grok-4.5",
		PriceData: types.PriceData{
			ModelRatio: 1, CompletionRatio: 1, CacheRatio: 1,
			GroupRatioInfo: types.GroupRatioInfo{GroupRatio: 1},
		},
		ResponsesUsageInfo: &relaycommon.ResponsesUsageInfo{BuiltInTools: map[string]*relaycommon.BuildInToolInfo{
			dto.BuildInToolXAIWebSearch: {CallCount: 1},
			dto.BuildInToolXAIXSearch:   {CallCount: 1},
		}},
	}
	summary := calculateTextQuotaSummary(c, info, &dto.Usage{})
	require.NotZero(t, summary.Quota)
	assert.Equal(t, common.QuotaRound(0.01*common.QuotaPerUnit), summary.Quota)
}

func TestToolSurchargeIsNotScaledByOtherRatios(t *testing.T) {
	tests := []struct {
		name      string
		priceData types.PriceData
		usage     dto.Usage
		want      int
	}{
		{
			name: "ratio pricing",
			priceData: types.PriceData{ModelRatio: 1, CompletionRatio: 1, CacheRatio: 1,
				GroupRatioInfo: types.GroupRatioInfo{GroupRatio: 1}},
			usage: dto.Usage{PromptTokens: 100, TotalTokens: 100},
			want:  2700,
		},
		{
			name: "fixed pricing",
			priceData: types.PriceData{UsePrice: true, ModelPrice: 0.01,
				GroupRatioInfo: types.GroupRatioInfo{GroupRatio: 1}},
			usage: dto.Usage{PromptTokens: 1, TotalTokens: 1},
			want:  12500,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx, _ := gin.CreateTestContext(nil)
			ctx.Set("playground_managed_search", true)
			tt.priceData.AddOtherRatio("stage2", 2)
			info := &relaycommon.RelayInfo{
				OriginModelName: "grok-stage2",
				PriceData:       tt.priceData,
				ResponsesUsageInfo: &relaycommon.ResponsesUsageInfo{BuiltInTools: map[string]*relaycommon.BuildInToolInfo{
					dto.BuildInToolXAIWebSearch: {CallCount: 1},
				}},
			}
			summary := calculateTextQuotaSummary(ctx, info, &tt.usage)
			assert.Equal(t, tt.want, summary.Quota)
		})
	}
}

func TestInvalidToolSurchargeCannotCreateCredit(t *testing.T) {
	ctx, _ := gin.CreateTestContext(nil)
	ctx.Set("playground_managed_search", true)
	info := &relaycommon.RelayInfo{ResponsesUsageInfo: &relaycommon.ResponsesUsageInfo{BuiltInTools: map[string]*relaycommon.BuildInToolInfo{
		dto.BuildInToolXAIWebSearch: {CallCount: 1},
	}}}
	summary := textQuotaSummary{ModelName: "grok", GroupRatio: -1}
	assert.True(t, calculateTextToolCallSurcharge(ctx, info, &summary).IsZero())
	assert.Zero(t, composeTieredTextQuota(info, textQuotaSummary{ToolCallSurchargeQuota: decimal.NewFromInt(-100)}, -50, nil))

	negativePriceInfo := &relaycommon.RelayInfo{
		OriginModelName: "invalid-negative-price",
		PriceData: types.PriceData{
			ModelRatio:      -1,
			CompletionRatio: 1,
			CacheRatio:      1,
			GroupRatioInfo:  types.GroupRatioInfo{GroupRatio: 1},
		},
	}
	negativePriceSummary := calculateTextQuotaSummary(ctx, negativePriceInfo, &dto.Usage{
		PromptTokens: 10,
		TotalTokens:  10,
	})
	assert.Zero(t, negativePriceSummary.Quota)

	tieredInfo := &relaycommon.RelayInfo{TieredBillingSnapshot: &billingexpr.BillingSnapshot{GroupRatio: -2}}
	assert.Zero(t, composeTieredTextQuota(tieredInfo, textQuotaSummary{
		ToolCallSurchargeQuota: decimal.NewFromInt(10),
	}, 0, &billingexpr.TieredResult{ActualQuotaBeforeGroup: 100}))
}

func TestGenericCompletedToolSurchargesAvoidLegacyDoubleBilling(t *testing.T) {
	ctx, _ := gin.CreateTestContext(nil)
	ctx.Set("claude_web_search_requests", 3)
	ctx.Set("gemini_google_search_call", true)
	info := &relaycommon.RelayInfo{
		OriginModelName: "tool-model",
		PriceData: types.PriceData{
			ModelRatio:      1,
			CompletionRatio: 1,
			CacheRatio:      1,
			GroupRatioInfo:  types.GroupRatioInfo{GroupRatio: 1},
		},
		ResponsesUsageInfo: &relaycommon.ResponsesUsageInfo{BuiltInTools: map[string]*relaycommon.BuildInToolInfo{
			dto.BuildInToolWebSearch:    {CallCount: 1},
			dto.BuildInToolGoogleSearch: {CallCount: 1},
		}},
	}

	summary := calculateTextQuotaSummary(ctx, info, &dto.Usage{})
	assert.Equal(t, common.QuotaRound(0.024*common.QuotaPerUnit), summary.Quota)
	assert.Zero(t, summary.ClaudeWebSearchCallCount, "generic count must replace the legacy Claude fallback, not add to it")
	require.Len(t, summary.ToolSurchargeItems, 2)
	assert.Equal(t, "google_search", summary.ToolSurchargeItems[0].Name)
	assert.Equal(t, "web_search", summary.ToolSurchargeItems[1].Name)

	other := map[string]interface{}{"web_search": true}
	appendToolSurchargeLogInfo(other, summary.ToolSurchargeItems)
	assert.True(t, other["web_search"].(bool), "legacy log fields must remain available")
	assert.Equal(t, summary.ToolSurchargeItems, other["tool_surcharges"])
}

func TestAlphaSearchTrackedCallAvoidsSearchPreviewSuffixFallback(t *testing.T) {
	ctx, _ := gin.CreateTestContext(nil)
	info := &relaycommon.RelayInfo{
		OriginModelName: "gpt-search-preview",
		RelayMode:       relayconstant.RelayModeAlphaSearch,
		PriceData: types.PriceData{
			ModelRatio:      1,
			CompletionRatio: 1,
			CacheRatio:      1,
			GroupRatioInfo:  types.GroupRatioInfo{GroupRatio: 1},
		},
		ResponsesUsageInfo: &relaycommon.ResponsesUsageInfo{BuiltInTools: map[string]*relaycommon.BuildInToolInfo{
			dto.BuildInToolWebSearchPreview: {CallCount: 1},
		}},
	}

	summary := calculateTextQuotaSummary(ctx, info, &dto.Usage{})

	require.Len(t, summary.ToolSurchargeItems, 1)
	assert.Equal(t, dto.BuildInToolWebSearchPreview, summary.ToolSurchargeItems[0].Name)
	assert.Equal(t, 1, summary.ToolSurchargeItems[0].Count)
}

func TestConfiguredCustomToolSurchargeSupportsZeroAndSaturationAudit(t *testing.T) {
	operation_setting.LoadToolPricesFromJSONString(`{"free_lookup":0,"paid_lookup":3,"huge_lookup":100000000000000000000}`)
	t.Cleanup(func() { operation_setting.LoadToolPricesFromJSONString(`{}`) })

	info := &relaycommon.RelayInfo{
		OriginModelName: "tool-model",
		PriceData: types.PriceData{
			ModelRatio:      1,
			CompletionRatio: 1,
			CacheRatio:      1,
			GroupRatioInfo:  types.GroupRatioInfo{GroupRatio: 1},
		},
	}
	info.CountBillableToolCall(dto.BuildInCallFunctionCall, "free_lookup")
	info.CountBillableToolCall(dto.BuildInCallFunctionCall, "paid_lookup")
	assert.NotContains(t, info.ResponsesUsageInfo.BuiltInTools, "free_lookup")
	assert.Equal(t, 1, info.ResponsesUsageInfo.BuiltInTools["paid_lookup"].CallCount)

	info.ResponsesUsageInfo.BuiltInTools["huge_lookup"] = &relaycommon.BuildInToolInfo{CallCount: int(^uint(0) >> 1)}
	ctx, _ := gin.CreateTestContext(nil)
	summary := calculateTextQuotaSummary(ctx, info, &dto.Usage{})
	assert.Equal(t, int(^uint32(0)>>1), summary.Quota)
	require.NotNil(t, info.QuotaClamp)
	assert.Equal(t, "QuotaFromDecimal", info.QuotaClamp.Op)
	assert.Equal(t, common.QuotaClampOverflow, info.QuotaClamp.Kind)
}

func TestImageToolSurchargeCapsCallCountAndKeepsBoxAIPrice(t *testing.T) {
	ctx, _ := gin.CreateTestContext(nil)
	ctx.Set("image_generation_call_quality", "low")
	ctx.Set("image_generation_call_size", "1024x1024")
	info := &relaycommon.RelayInfo{ResponsesUsageInfo: &relaycommon.ResponsesUsageInfo{BuiltInTools: map[string]*relaycommon.BuildInToolInfo{
		dto.BuildInToolImageGeneration: {CallCount: dto.MaxImageN + 5},
	}}}
	summary := textQuotaSummary{ModelName: "gpt-image-1", GroupRatio: 1}
	surcharge := calculateTextToolCallSurcharge(ctx, info, &summary)

	assert.Equal(t, dto.MaxImageN, summary.ImageGenerationCallCount)
	assert.Equal(t, operation_setting.GPTImage1Low1024x1024, summary.ImageGenerationCallPrice)
	assert.True(t, surcharge.Equal(decimal.NewFromFloat(operation_setting.GPTImage1Low1024x1024).
		Mul(decimal.NewFromInt(dto.MaxImageN)).Mul(decimal.NewFromFloat(common.QuotaPerUnit))))
}
