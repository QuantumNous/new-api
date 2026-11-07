package billing

import (
	"github.com/QuantumNous/new-api/internal/transport/fiberadapter"
	"math"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/internal/billing/price_expression"
	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/constant"
	relaycommon "github.com/QuantumNous/new-api/internal/relay/common"
	relayconstant "github.com/QuantumNous/new-api/internal/relay/constant"
	hosttypes "github.com/QuantumNous/new-api/internal/types"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCalculateTextQuotaSummaryUnifiedForClaudeSemantic(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw

	usage := &dto.Usage{
		PromptTokens:     1000,
		CompletionTokens: 200,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens:         100,
			CachedCreationTokens: 50,
		},
		ClaudeCacheCreation5mTokens: 10,
		ClaudeCacheCreation1hTokens: 20,
	}

	priceData := hosttypes.PriceData{
		ModelRatio:           1,
		CompletionRatio:      2,
		CacheRatio:           0.1,
		CacheCreationRatio:   1.25,
		CacheCreation5mRatio: 1.25,
		CacheCreation1hRatio: 2,
		GroupRatioInfo: hosttypes.GroupRatioInfo{
			GroupRatio: 1,
		},
	}

	chatRelayInfo := &relaycommon.RelayInfo{
		RelayFormat:             types.RelayFormatOpenAI,
		FinalRequestRelayFormat: types.RelayFormatClaude,
		OriginModelName:         "claude-3-7-sonnet",
		PriceData:               priceData,
		StartTime:               time.Now(),
	}
	messageRelayInfo := &relaycommon.RelayInfo{
		RelayFormat:             types.RelayFormatClaude,
		FinalRequestRelayFormat: types.RelayFormatClaude,
		OriginModelName:         "claude-3-7-sonnet",
		PriceData:               priceData,
		StartTime:               time.Now(),
	}

	chatSummary := calculateTextQuotaSummary(ctx, chatRelayInfo, usage)
	messageSummary := calculateTextQuotaSummary(ctx, messageRelayInfo, usage)

	require.Equal(t, messageSummary.Quota, chatSummary.Quota)
	require.Equal(t, messageSummary.CacheCreationTokens5m, chatSummary.CacheCreationTokens5m)
	require.Equal(t, messageSummary.CacheCreationTokens1h, chatSummary.CacheCreationTokens1h)
	require.True(t, chatSummary.IsClaudeUsageSemantic)
	require.Equal(t, 1488, chatSummary.Quota)
}

func TestCalculateTextQuotaSummaryUsesSplitClaudeCacheCreationRatios(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw

	relayInfo := &relaycommon.RelayInfo{
		RelayFormat:             types.RelayFormatOpenAI,
		FinalRequestRelayFormat: types.RelayFormatClaude,
		OriginModelName:         "claude-3-7-sonnet",
		PriceData: hosttypes.PriceData{
			ModelRatio:           1,
			CompletionRatio:      1,
			CacheRatio:           0,
			CacheCreationRatio:   1,
			CacheCreation5mRatio: 2,
			CacheCreation1hRatio: 3,
			GroupRatioInfo: hosttypes.GroupRatioInfo{
				GroupRatio: 1,
			},
		},
		StartTime: time.Now(),
	}

	usage := &dto.Usage{
		PromptTokens:     100,
		CompletionTokens: 0,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedCreationTokens: 10,
		},
		ClaudeCacheCreation5mTokens: 2,
		ClaudeCacheCreation1hTokens: 3,
	}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)

	// 100 + remaining(5)*1 + 2*2 + 3*3 = 118
	require.Equal(t, 118, summary.Quota)
}

func TestCalculateTextQuotaSummaryUsesAnthropicUsageSemanticFromUpstreamUsage(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw

	relayInfo := &relaycommon.RelayInfo{
		RelayFormat:     types.RelayFormatOpenAI,
		OriginModelName: "claude-3-7-sonnet",
		PriceData: hosttypes.PriceData{
			ModelRatio:           1,
			CompletionRatio:      2,
			CacheRatio:           0.1,
			CacheCreationRatio:   1.25,
			CacheCreation5mRatio: 1.25,
			CacheCreation1hRatio: 2,
			GroupRatioInfo: hosttypes.GroupRatioInfo{
				GroupRatio: 1,
			},
		},
		StartTime: time.Now(),
	}

	usage := &dto.Usage{
		PromptTokens:     1000,
		CompletionTokens: 200,
		UsageSemantic:    "anthropic",
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens:         100,
			CachedCreationTokens: 50,
		},
		ClaudeCacheCreation5mTokens: 10,
		ClaudeCacheCreation1hTokens: 20,
	}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)

	require.True(t, summary.IsClaudeUsageSemantic)
	require.Equal(t, "anthropic", summary.UsageSemantic)
	require.Equal(t, 1488, summary.Quota)
}

func TestCalculateTextQuotaSummaryUsesClaudeBillingUsageBeforeTopLevelUsage(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw

	relayInfo := &relaycommon.RelayInfo{
		RelayFormat:     types.RelayFormatOpenAI,
		OriginModelName: "claude-3-7-sonnet",
		PriceData: hosttypes.PriceData{
			ModelRatio:           1,
			CompletionRatio:      2,
			CacheRatio:           0.1,
			CacheCreationRatio:   1.25,
			CacheCreation5mRatio: 1.25,
			CacheCreation1hRatio: 2,
			GroupRatioInfo:       hosttypes.GroupRatioInfo{GroupRatio: 1},
		},
		StartTime: time.Now(),
	}

	usage := &dto.Usage{
		PromptTokens:     999,
		CompletionTokens: 999,
		TotalTokens:      1998,
		BillingUsage: dto.NewClaudeMessagesBillingUsage(&dto.ClaudeUsage{
			InputTokens:              70,
			CacheReadInputTokens:     30,
			CacheCreationInputTokens: 20,
			OutputTokens:             7,
			CacheCreation: &dto.ClaudeCacheCreationUsage{
				Ephemeral5mInputTokens: 12,
				Ephemeral1hInputTokens: 8,
			},
		}),
	}

	summary := calculateTextQuotaSummary(ctx, relayInfo, effectiveBillingUsage(usage))

	require.True(t, summary.IsClaudeUsageSemantic)
	require.Equal(t, dto.BillingUsageSemanticAnthropic, summary.UsageSemantic)
	require.Equal(t, 70, summary.PromptTokens)
	require.Equal(t, 7, summary.CompletionTokens)
	require.Equal(t, 30, summary.CacheTokens)
	require.Equal(t, 20, summary.CacheCreationTokens)
	require.Equal(t, 12, summary.CacheCreationTokens5m)
	require.Equal(t, 8, summary.CacheCreationTokens1h)
	require.Equal(t, 118, summary.Quota)
}

func TestCalculateTextQuotaSummaryUsesGeminiBillingUsageBeforeTopLevelUsage(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw

	relayInfo := &relaycommon.RelayInfo{
		RelayFormat:     types.RelayFormatOpenAI,
		OriginModelName: "gemini-2.5-flash",
		PriceData: hosttypes.PriceData{
			ModelRatio:      1,
			CompletionRatio: 2,
			CacheRatio:      0.1,
			GroupRatioInfo:  hosttypes.GroupRatioInfo{GroupRatio: 1},
		},
		StartTime: time.Now(),
	}

	usage := &dto.Usage{
		PromptTokens:     999,
		CompletionTokens: 999,
		TotalTokens:      1998,
		BillingUsage: dto.NewGeminiChatBillingUsage(&dto.GeminiUsageMetadata{
			PromptTokenCount:        100,
			ToolUsePromptTokenCount: 5,
			CandidatesTokenCount:    20,
			ThoughtsTokenCount:      3,
			TotalTokenCount:         128,
			CachedContentTokenCount: 7,
		}),
	}

	summary := calculateTextQuotaSummary(ctx, relayInfo, effectiveBillingUsage(usage))

	require.False(t, summary.IsClaudeUsageSemantic)
	require.Equal(t, dto.BillingUsageSemanticGemini, summary.UsageSemantic)
	require.Equal(t, 105, summary.PromptTokens)
	require.Equal(t, 23, summary.CompletionTokens)
	require.Equal(t, 7, summary.CacheTokens)
	require.Equal(t, 128, summary.TotalTokens)
	require.Equal(t, 145, summary.Quota)
}

func TestCalculateTextQuotaSummaryUsesOpenAIBillingUsageBeforeTopLevelUsage(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw

	relayInfo := &relaycommon.RelayInfo{
		RelayFormat:     types.RelayFormatClaude,
		OriginModelName: "gpt-4o",
		PriceData: hosttypes.PriceData{
			ModelRatio:      1,
			CompletionRatio: 2,
			GroupRatioInfo:  hosttypes.GroupRatioInfo{GroupRatio: 1},
		},
		StartTime: time.Now(),
	}

	usage := &dto.Usage{
		PromptTokens:     999,
		CompletionTokens: 999,
		TotalTokens:      1998,
		BillingUsage: dto.NewOpenAIChatBillingUsage(&dto.Usage{
			PromptTokens:     80,
			CompletionTokens: 9,
			TotalTokens:      89,
		}),
	}

	summary := calculateTextQuotaSummary(ctx, relayInfo, effectiveBillingUsage(usage))

	require.False(t, summary.IsClaudeUsageSemantic)
	require.Equal(t, dto.BillingUsageSemanticOpenAI, summary.UsageSemantic)
	require.Equal(t, 80, summary.PromptTokens)
	require.Equal(t, 9, summary.CompletionTokens)
	require.Equal(t, 89, summary.TotalTokens)
	require.Equal(t, 98, summary.Quota)
}

func TestUsageBillingPathForLog(t *testing.T) {
	require.Equal(t, usageBillingPathAnthropic, usageBillingPathForLog(true, &dto.Usage{
		BillingUsage: dto.NewClaudeMessagesBillingUsage(&dto.ClaudeUsage{InputTokens: 1}),
	}))
	invalidBillingUsage := &dto.Usage{
		PromptTokens: 1,
		BillingUsage: &dto.BillingUsage{
			Source:   dto.BillingUsageSourceClaudeMessages,
			Semantic: dto.BillingUsageSemanticAnthropic,
		},
	}
	require.Equal(t, usageBillingPathLocal, usageBillingPathForLog(true, invalidBillingUsage))
	require.Equal(t, usageBillingPathUpstream, usageBillingPathForLog(false, invalidBillingUsage))
	require.Equal(t, usageBillingPathUpstream, usageBillingPathForLog(false, &dto.Usage{}))
	require.Equal(t, usageBillingPathOpenAI, usageBillingPathForLog(false, &dto.Usage{
		BillingUsage: dto.NewOpenAIChatBillingUsage(&dto.Usage{PromptTokens: 1}),
	}))
	require.Equal(t, usageBillingPathAnthropic, usageBillingPathForLog(false, &dto.Usage{
		BillingUsage: dto.NewClaudeMessagesBillingUsage(&dto.ClaudeUsage{InputTokens: 1}),
	}))
	require.Equal(t, usageBillingPathGemini, usageBillingPathForLog(false, &dto.Usage{
		BillingUsage: dto.NewGeminiChatBillingUsage(&dto.GeminiUsageMetadata{PromptTokenCount: 1}),
	}))
	require.Equal(t, usageBillingPathGeminiEstimated, usageBillingPathForLog(true, &dto.Usage{
		BillingUsage: dto.NewEstimatedGeminiChatBillingUsage(&dto.Usage{PromptTokens: 1}),
	}))
}

func TestAppendUsageBillingPathForLogWritesAdminInfo(t *testing.T) {
	other := map[string]interface{}{
		"admin_info": map[string]interface{}{},
	}
	appendUsageBillingPathForLog(other, true, &dto.Usage{
		BillingUsage: dto.NewClaudeMessagesBillingUsage(&dto.ClaudeUsage{InputTokens: 1}),
	})

	adminInfo, ok := other["admin_info"].(map[string]interface{})
	require.True(t, ok)
	require.Equal(t, usageBillingPathAnthropic, adminInfo["usage_billing_path"])

	other = map[string]interface{}{}
	appendUsageBillingPathForLog(other, true, nil)
	adminInfo, ok = other["admin_info"].(map[string]interface{})
	require.True(t, ok)
	require.Equal(t, usageBillingPathLocal, adminInfo["usage_billing_path"])
}

func TestCacheWriteTokensTotal(t *testing.T) {
	t.Run("split cache creation", func(t *testing.T) {
		summary := textQuotaSummary{
			CacheCreationTokens:   50,
			CacheCreationTokens5m: 10,
			CacheCreationTokens1h: 20,
		}
		require.Equal(t, 50, cacheWriteTokensTotal(summary))
	})

	t.Run("legacy cache creation", func(t *testing.T) {
		summary := textQuotaSummary{CacheCreationTokens: 50}
		require.Equal(t, 50, cacheWriteTokensTotal(summary))
	})

	t.Run("split cache creation without aggregate remainder", func(t *testing.T) {
		summary := textQuotaSummary{
			CacheCreationTokens5m: 10,
			CacheCreationTokens1h: 20,
		}
		require.Equal(t, 30, cacheWriteTokensTotal(summary))
	})
}

func TestCalculateTextQuotaSummaryHandlesLegacyClaudeDerivedOpenAIUsage(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw

	relayInfo := &relaycommon.RelayInfo{
		RelayFormat:     types.RelayFormatOpenAI,
		OriginModelName: "claude-3-7-sonnet",
		PriceData: hosttypes.PriceData{
			ModelRatio:           1,
			CompletionRatio:      5,
			CacheRatio:           0.1,
			CacheCreationRatio:   1.25,
			CacheCreation5mRatio: 1.25,
			CacheCreation1hRatio: 2,
			GroupRatioInfo:       hosttypes.GroupRatioInfo{GroupRatio: 1},
		},
		StartTime: time.Now(),
	}

	usage := &dto.Usage{
		PromptTokens:     62,
		CompletionTokens: 95,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens: 3544,
		},
		ClaudeCacheCreation5mTokens: 586,
	}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)

	// 62 + 3544*0.1 + 586*1.25 + 95*5 = 1624.9 => 1624
	require.Equal(t, 1624, summary.Quota)
}

func TestCalculateTextQuotaSummaryBillsOpenAICacheWriteTokens(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw

	relayInfo := &relaycommon.RelayInfo{
		RelayFormat:     types.RelayFormatOpenAI,
		OriginModelName: "gpt-5.1",
		PriceData: hosttypes.PriceData{
			ModelRatio:         1,
			CompletionRatio:    2,
			CacheRatio:         0.1,
			CacheCreationRatio: 1.25,
			GroupRatioInfo:     hosttypes.GroupRatioInfo{GroupRatio: 1},
		},
		StartTime: time.Now(),
	}

	t.Run("uncached remainder stays positive", func(t *testing.T) {
		usage := &dto.Usage{
			PromptTokens:     1473,
			CompletionTokens: 19,
			PromptTokensDetails: dto.InputTokenDetails{
				CacheWriteTokens: 1470,
			},
		}

		summary := calculateTextQuotaSummary(ctx, relayInfo, usage)

		require.Equal(t, 1470, summary.CacheCreationTokens)
		// (1473-0-1470) + 1470*1.25 + 19*2 = 3 + 1837.5 + 38 = 1878.5 => 1879
		require.Equal(t, 1879, summary.Quota)
	})

	t.Run("uncached remainder clamps to zero", func(t *testing.T) {
		// Real OpenAI payload shape: cached_tokens + cache_write_tokens exceeds
		// prompt_tokens because both are unadjusted prefix counts. The negative
		// remainder must clamp to zero, never turn into a negative base charge.
		usage := &dto.Usage{
			PromptTokens:     3619,
			CompletionTokens: 36,
			PromptTokensDetails: dto.InputTokenDetails{
				CachedTokens:     2921,
				CacheWriteTokens: 3616,
			},
		}

		summary := calculateTextQuotaSummary(ctx, relayInfo, usage)

		require.Equal(t, 3619, summary.PromptTokens)
		require.Equal(t, 3616, summary.CacheCreationTokens)
		// max(3619-2921-3616, 0) + 2921*0.1 + 3616*1.25 + 36*2 = 4884.1 => 4884
		require.Equal(t, 4884, summary.Quota)
	})
}

func TestCalculateTextQuotaSummarySeparatesOpenRouterCacheReadFromPromptBilling(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw

	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "openai/gpt-4.1",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeOpenRouter,
		},
		PriceData: hosttypes.PriceData{
			ModelRatio:         1,
			CompletionRatio:    1,
			CacheRatio:         0.1,
			CacheCreationRatio: 1.25,
			GroupRatioInfo:     hosttypes.GroupRatioInfo{GroupRatio: 1},
		},
		StartTime: time.Now(),
	}

	usage := &dto.Usage{
		PromptTokens:     2604,
		CompletionTokens: 383,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens: 2432,
		},
	}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)

	// OpenRouter OpenAI-format display keeps prompt_tokens as total input,
	// but billing still separates normal input from cache read tokens.
	// quota = (2604 - 2432) + 2432*0.1 + 383 = 798.2 => 798
	require.Equal(t, 2604, summary.PromptTokens)
	require.Equal(t, 798, summary.Quota)
}

func TestCalculateTextQuotaSummarySeparatesOpenRouterCacheCreationFromPromptBilling(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw

	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "openai/gpt-4.1",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeOpenRouter,
		},
		PriceData: hosttypes.PriceData{
			ModelRatio:         1,
			CompletionRatio:    1,
			CacheCreationRatio: 1.25,
			GroupRatioInfo:     hosttypes.GroupRatioInfo{GroupRatio: 1},
		},
		StartTime: time.Now(),
	}

	usage := &dto.Usage{
		PromptTokens:     2604,
		CompletionTokens: 383,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedCreationTokens: 100,
		},
	}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)

	// prompt_tokens is still logged as total input, but cache creation is billed separately.
	// quota = (2604 - 100) + 100*1.25 + 383 = 3012
	require.Equal(t, 2604, summary.PromptTokens)
	require.Equal(t, 3012, summary.Quota)
}

func TestCalculateTextQuotaSummaryKeepsPrePRClaudeOpenRouterBilling(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw

	relayInfo := &relaycommon.RelayInfo{
		FinalRequestRelayFormat: types.RelayFormatClaude,
		OriginModelName:         "anthropic/claude-3.7-sonnet",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeOpenRouter,
		},
		PriceData: hosttypes.PriceData{
			ModelRatio:         1,
			CompletionRatio:    1,
			CacheRatio:         0.1,
			CacheCreationRatio: 1.25,
			GroupRatioInfo:     hosttypes.GroupRatioInfo{GroupRatio: 1},
		},
		StartTime: time.Now(),
	}

	usage := &dto.Usage{
		PromptTokens:     2604,
		CompletionTokens: 383,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens: 2432,
		},
	}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)

	// Pre-PR PostClaudeConsumeQuota behavior for OpenRouter:
	// prompt = 2604 - 2432 = 172
	// quota = 172 + 2432*0.1 + 383 = 798.2 => 798
	require.True(t, summary.IsClaudeUsageSemantic)
	require.Equal(t, 172, summary.PromptTokens)
	require.Equal(t, 798, summary.Quota)
}

func TestComposeTieredTextQuotaKeepsToolCallSurcharges(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw

	// 11 $/1K => 0.011 per completed image output, matching the prior fixed low-tier charge.
	price_expression.SetToolPriceForTest(dto.BuildInToolImageGeneration, 11.0)
	t.Cleanup(func() {
		price_expression.DeleteToolPriceForTest(dto.BuildInToolImageGeneration)
	})

	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "o1",
		PriceData: hosttypes.PriceData{
			ModelRatio:      1,
			CompletionRatio: 1,
			GroupRatioInfo:  hosttypes.GroupRatioInfo{GroupRatio: 1},
		},
		ResponsesUsageInfo: &relaycommon.ResponsesUsageInfo{
			BuiltInTools: map[string]*relaycommon.BuildInToolInfo{
				dto.BuildInToolWebSearchPreview: {
					CallCount: 1,
				},
				dto.BuildInToolFileSearch: {
					CallCount: 2,
				},
				dto.BuildInToolImageGeneration: {
					CallCount: 1,
				},
			},
		},
		TieredBillingSnapshot: &price_expression.BillingSnapshot{
			BillingMode:               "tiered_expr",
			GroupRatio:                1,
			EstimatedQuotaBeforeGroup: 1000,
		},
		StartTime: time.Now(),
	}

	usage := &dto.Usage{
		PromptTokens:     100,
		CompletionTokens: 50,
		TotalTokens:      150,
	}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)
	quota := composeTieredTextQuota(relayInfo, summary, 1000, &price_expression.TieredResult{
		ActualQuotaBeforeGroup: 1000,
		ActualQuotaAfterGroup:  1000,
	})

	require.Equal(t, int64(13000), summary.ToolCallSurchargeQuota.Round(0).IntPart())
	require.Equal(t, 14000, quota)
}

func TestComposeTieredTextQuotaFallbackKeepsToolCallSurcharges(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw
	ctx.Set("claude_web_search_requests", 2)

	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "claude-3-7-sonnet",
		PriceData: hosttypes.PriceData{
			ModelRatio:      1,
			CompletionRatio: 1,
			GroupRatioInfo:  hosttypes.GroupRatioInfo{GroupRatio: 1.25},
		},
		TieredBillingSnapshot: &price_expression.BillingSnapshot{
			BillingMode:               "tiered_expr",
			GroupRatio:                1.25,
			EstimatedQuotaBeforeGroup: 1000,
		},
		StartTime: time.Now(),
	}

	usage := &dto.Usage{
		PromptTokens:     100,
		CompletionTokens: 50,
		TotalTokens:      150,
	}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)
	quota := composeTieredTextQuota(relayInfo, summary, 1250, nil)

	require.Equal(t, int64(12500), summary.ToolCallSurchargeQuota.Round(0).IntPart())
	require.Equal(t, 13750, quota)
}

func TestComposeTieredTextQuotaErrorFallbackUsesPreConsumedQuota(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw
	ctx.Set("claude_web_search_requests", 2)

	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "claude-3-7-sonnet",
		PriceData: hosttypes.PriceData{
			ModelRatio:      1,
			CompletionRatio: 1,
			GroupRatioInfo:  hosttypes.GroupRatioInfo{GroupRatio: 1.25},
		},
		TieredBillingSnapshot: &price_expression.BillingSnapshot{
			BillingMode:               "tiered_expr",
			GroupRatio:                1.25,
			EstimatedQuotaBeforeGroup: 1000,
		},
		StartTime: time.Now(),
	}

	usage := &dto.Usage{
		PromptTokens:     100,
		CompletionTokens: 50,
		TotalTokens:      150,
	}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)

	// tieredResult=nil simulates a settlement error where TryTieredSettle
	// falls back to FinalPreConsumedQuota (2000), which differs from
	// EstimatedQuotaBeforeGroup * GroupRatio (1250).
	preConsumedFallback := 2000
	quota := composeTieredTextQuota(relayInfo, summary, preConsumedFallback, nil)

	require.Equal(t, int64(12500), summary.ToolCallSurchargeQuota.Round(0).IntPart())
	require.Equal(t, 14500, quota)
}

// TestTryTieredSettleRecordsClampOnOverflow guards that an oversized tiered
// settlement both saturates the quota and records the clamp on RelayInfo, so
// every consume path (text, audio, WSS) can surface it under admin_info.
func TestTryTieredSettleRecordsClampOnOverflow(t *testing.T) {
	// exprOutput = p * 1e9; quotaBeforeGroup = p*1e9 / 1e6 * 5e5 far exceeds
	// MaxInt32 and must saturate.
	exprStr := `tier("base", p * 1000000000)`
	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "overflow-model",
		TieredBillingSnapshot: &price_expression.BillingSnapshot{
			BillingMode:  "tiered_expr",
			ExprString:   exprStr,
			ExprHash:     price_expression.ExprHashString(exprStr),
			GroupRatio:   1,
			QuotaPerUnit: 500_000,
		},
	}

	ok, quota, result := TryTieredSettle(relayInfo, price_expression.TokenParams{P: 1_000_000_000})

	require.True(t, ok)
	require.NotNil(t, result)
	require.Equal(t, math.MaxInt32, quota, "oversized settlement must clamp, never wrap negative")
	require.NotNil(t, relayInfo.QuotaClamp, "clamp must be recorded on RelayInfo for admin auditing")
	require.Equal(t, common.QuotaClampOverflow, relayInfo.QuotaClamp.Kind)
}

// TestTryTieredSettleNoClampInRange confirms an in-range settlement leaves
// RelayInfo.QuotaClamp nil.
func TestTryTieredSettleNoClampInRange(t *testing.T) {
	exprStr := `tier("base", p * 2 + c * 10)`
	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "in-range-model",
		TieredBillingSnapshot: &price_expression.BillingSnapshot{
			BillingMode:  "tiered_expr",
			ExprString:   exprStr,
			ExprHash:     price_expression.ExprHashString(exprStr),
			GroupRatio:   1,
			QuotaPerUnit: 500_000,
		},
	}

	ok, _, result := TryTieredSettle(relayInfo, price_expression.TokenParams{P: 1000, C: 500})

	require.True(t, ok)
	require.NotNil(t, result)
	require.Nil(t, relayInfo.QuotaClamp, "in-range settlement must not record a clamp")
}

func TestCalculateTextQuotaSummaryFixedPriceAppliesImageCountOnceAndAllowsOverride(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw
	priceData := hosttypes.PriceData{
		ModelPrice: 0.12,
		UsePrice:   true,
		GroupRatioInfo: hosttypes.GroupRatioInfo{
			GroupRatio: 1,
		},
	}
	priceData.AddOtherRatio("n", 3)
	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "dall-e-3",
		PriceData:       priceData,
		StartTime:       time.Now(),
	}
	usage := &dto.Usage{PromptTokens: 1, TotalTokens: 1}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)
	require.Equal(t, 180000, summary.Quota)

	// An adaptor-reported actual count replaces the requested count rather
	// than multiplying it a second time.
	relayInfo.PriceData.AddOtherRatio("n", 2)
	summary = calculateTextQuotaSummary(ctx, relayInfo, usage)
	require.Equal(t, 120000, summary.Quota)
}

func TestCalculateTextToolCallSurchargeGeneralizedBuiltInTools(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw

	price_expression.SetToolPriceForTest("my_fn", 5.0)
	t.Cleanup(func() {
		price_expression.DeleteToolPriceForTest("my_fn")
	})

	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "o1",
		ResponsesUsageInfo: &relaycommon.ResponsesUsageInfo{
			BuiltInTools: map[string]*relaycommon.BuildInToolInfo{
				dto.BuildInToolWebSearchPreview: {CallCount: 2},
				"my_fn":                         {CallCount: 3},
				"unpriced":                      {CallCount: 5},
			},
		},
	}
	summary := &textQuotaSummary{
		ModelName:  "o1",
		GroupRatio: 1,
	}

	surcharge := calculateTextToolCallSurcharge(ctx, relayInfo, summary)
	expected := decimal.NewFromFloat((10.0*2 + 5.0*3) / 1000).Mul(decimal.NewFromFloat(common.QuotaPerUnit))
	assert.True(t, expected.Equal(surcharge), "got %s want %s", surcharge, expected)
	require.Len(t, summary.ToolSurchargeItems, 2)
	assert.Equal(t, "my_fn", summary.ToolSurchargeItems[0].Name)
	assert.Equal(t, 3, summary.ToolSurchargeItems[0].Count)
	assert.Equal(t, 5.0, summary.ToolSurchargeItems[0].Price)
	assert.Equal(t, dto.BuildInToolWebSearchPreview, summary.ToolSurchargeItems[1].Name)
	assert.Equal(t, 2, summary.ToolSurchargeItems[1].Count)
	assert.Equal(t, 10.0, summary.ToolSurchargeItems[1].Price)
}

func TestCalculateTextToolCallSurchargeKeepsSearchPreviewFallbackWithCustomFunctions(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw

	price_expression.SetToolPriceForTest("my_fn", 5)
	t.Cleanup(func() {
		price_expression.DeleteToolPriceForTest("my_fn")
	})

	relayInfo := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeChatCompletions,
		OriginModelName: "gpt-4o-search-preview",
		ResponsesUsageInfo: &relaycommon.ResponsesUsageInfo{
			BuiltInTools: map[string]*relaycommon.BuildInToolInfo{
				"my_fn": {CallCount: 1},
			},
		},
	}
	summary := &textQuotaSummary{
		ModelName:  relayInfo.OriginModelName,
		GroupRatio: 1,
	}

	surcharge := calculateTextToolCallSurcharge(ctx, relayInfo, summary)

	require.Len(t, summary.ToolSurchargeItems, 2)
	assert.Equal(t, "my_fn", summary.ToolSurchargeItems[0].Name)
	assert.Equal(t, dto.BuildInToolWebSearchPreview, summary.ToolSurchargeItems[1].Name)
	expected := decimal.NewFromFloat((5.0 + 25.0) / 1000).
		Mul(decimal.NewFromFloat(common.QuotaPerUnit))
	assert.True(t, expected.Equal(surcharge), "got %s want %s", surcharge, expected)
}

func TestCalculateTextToolCallSurchargeDoesNotInferSearchForResponses(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw
	relayInfo := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeResponses,
		OriginModelName: "gpt-4o-search-preview",
		ResponsesUsageInfo: &relaycommon.ResponsesUsageInfo{
			BuiltInTools: map[string]*relaycommon.BuildInToolInfo{},
		},
	}
	summary := &textQuotaSummary{
		ModelName:  relayInfo.OriginModelName,
		GroupRatio: 1,
	}

	surcharge := calculateTextToolCallSurcharge(ctx, relayInfo, summary)

	assert.True(t, surcharge.IsZero())
	assert.Empty(t, summary.ToolSurchargeItems)
}

func TestCalculateTextToolCallSurchargeMergesSameNameAndPrice(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw
	ctx.Set("claude_web_search_requests", 3)

	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "claude-3-7-sonnet",
		ResponsesUsageInfo: &relaycommon.ResponsesUsageInfo{
			BuiltInTools: map[string]*relaycommon.BuildInToolInfo{
				dto.BuildInToolWebSearch: {CallCount: 2},
			},
		},
	}
	summary := &textQuotaSummary{ModelName: relayInfo.OriginModelName, GroupRatio: 1}

	surcharge := calculateTextToolCallSurcharge(ctx, relayInfo, summary)

	require.Len(t, summary.ToolSurchargeItems, 1)
	assert.Equal(t, dto.BuildInToolWebSearch, summary.ToolSurchargeItems[0].Name)
	assert.Equal(t, 5, summary.ToolSurchargeItems[0].Count)
	assert.Equal(t, 10.0, summary.ToolSurchargeItems[0].Price)
	expected := decimal.NewFromFloat(10.0 * 5 / 1000).Mul(decimal.NewFromFloat(common.QuotaPerUnit))
	assert.True(t, expected.Equal(surcharge), "got %s want %s", surcharge, expected)
}

func TestMergeToolSurchargeItemsSaturatesCountOverflow(t *testing.T) {
	items := []ToolSurchargeItem{
		{Name: "custom_fn", Count: math.MaxInt, Price: 5},
		{Name: "custom_fn", Count: 1, Price: 5},
	}

	merged := mergeToolSurchargeItems(items)

	require.Len(t, merged, 1)
	assert.Equal(t, math.MaxInt, merged[0].Count)
}

// A zero-token request (e.g. /v1/alpha/search returns no usage) must still
// bill a tool-call surcharge. Regression for the TotalTokens==0 gate zeroing
// out the surcharge quota.
func TestCalculateTextQuotaSummaryZeroTokensStillBillsToolSurcharge(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw

	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "o1",
		ResponsesUsageInfo: &relaycommon.ResponsesUsageInfo{
			BuiltInTools: map[string]*relaycommon.BuildInToolInfo{
				dto.BuildInToolWebSearchPreview: {CallCount: 1},
			},
		},
	}
	relayInfo.PriceData.GroupRatioInfo.GroupRatio = 1

	usage := &dto.Usage{} // zero tokens, mirrors alpha search
	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)

	require.Equal(t, 0, summary.TotalTokens)
	assert.False(t, summary.ToolCallSurchargeQuota.IsZero(), "surcharge should be computed")
	assert.Greater(t, summary.Quota, 0, "quota must not be zeroed out for a zero-token web search request")
	expected := common.QuotaFromDecimal(summary.ToolCallSurchargeQuota)
	assert.Equal(t, expected, summary.Quota)
}

func TestCalculateTextQuotaSummaryDoesNotApplyRequestMultipliersToToolSurcharge(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw

	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "o1",
		PriceData: hosttypes.PriceData{
			ModelRatio:      1,
			CompletionRatio: 1,
			GroupRatioInfo:  hosttypes.GroupRatioInfo{GroupRatio: 1},
		},
		ResponsesUsageInfo: &relaycommon.ResponsesUsageInfo{
			BuiltInTools: map[string]*relaycommon.BuildInToolInfo{
				dto.BuildInToolWebSearchPreview: {CallCount: 1},
			},
		},
	}
	relayInfo.PriceData.AddOtherRatio("n", 3)

	summary := calculateTextQuotaSummary(ctx, relayInfo, &dto.Usage{})

	expected := decimal.NewFromFloat(10.0 / 1000).Mul(decimal.NewFromFloat(common.QuotaPerUnit))
	assert.True(t, expected.Equal(summary.ToolCallSurchargeQuota))
	assert.Equal(t, common.QuotaFromDecimal(expected), summary.Quota)
}

func TestCalculateTextToolCallSurchargeGeminiGoogleSearch(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw
	ctx.Set("gemini_google_search_call", true)

	relayInfo := &relaycommon.RelayInfo{OriginModelName: "gemini-2.5-flash"}
	summary := &textQuotaSummary{ModelName: "gemini-2.5-flash", GroupRatio: 1}

	surcharge := calculateTextToolCallSurcharge(ctx, relayInfo, summary)
	expected := decimal.NewFromFloat(14.0 / 1000).Mul(decimal.NewFromFloat(common.QuotaPerUnit))
	assert.True(t, expected.Equal(surcharge), "got %s want %s", surcharge, expected)
	require.Len(t, summary.ToolSurchargeItems, 1)
	assert.Equal(t, dto.BuildInToolGoogleSearch, summary.ToolSurchargeItems[0].Name)
	assert.Equal(t, 1, summary.ToolSurchargeItems[0].Count)
	assert.Equal(t, 14.0, summary.ToolSurchargeItems[0].Price)
}

func TestCalculateTextToolCallSurchargeImageGenerationDefaultPrice(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw
	t.Cleanup(func() {
		price_expression.DeleteToolPriceForTest(dto.BuildInToolImageGeneration)
	})

	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "gpt-5.1",
		ResponsesUsageInfo: &relaycommon.ResponsesUsageInfo{
			BuiltInTools: map[string]*relaycommon.BuildInToolInfo{
				dto.BuildInToolImageGeneration: {CallCount: 2},
			},
		},
	}
	summary := &textQuotaSummary{ModelName: "gpt-5.1", GroupRatio: 1.5}

	surcharge := calculateTextToolCallSurcharge(ctx, relayInfo, summary)
	expected := decimal.NewFromFloat(150.0).
		Mul(decimal.NewFromInt(2)).
		Div(decimal.NewFromInt(1000)).
		Mul(decimal.NewFromFloat(1.5)).
		Mul(decimal.NewFromFloat(common.QuotaPerUnit))
	assert.True(t, expected.Equal(surcharge), "got %s want %s", surcharge, expected)
	require.Len(t, summary.ToolSurchargeItems, 1)
	assert.Equal(t, dto.BuildInToolImageGeneration, summary.ToolSurchargeItems[0].Name)
	assert.Equal(t, 2, summary.ToolSurchargeItems[0].Count)
	assert.Equal(t, 150.0, summary.ToolSurchargeItems[0].Price)
}

func TestCalculateTextToolCallSurchargeImageGenerationExplicitZeroDisables(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw
	price_expression.SetToolPriceForTest(dto.BuildInToolImageGeneration, 0)
	t.Cleanup(func() {
		price_expression.DeleteToolPriceForTest(dto.BuildInToolImageGeneration)
	})

	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "gpt-5.1",
		ResponsesUsageInfo: &relaycommon.ResponsesUsageInfo{
			BuiltInTools: map[string]*relaycommon.BuildInToolInfo{
				dto.BuildInToolImageGeneration: {CallCount: 3},
			},
		},
	}
	summary := &textQuotaSummary{ModelName: "gpt-5.1", GroupRatio: 1}

	surcharge := calculateTextToolCallSurcharge(ctx, relayInfo, summary)
	assert.True(t, surcharge.IsZero())
	assert.Empty(t, summary.ToolSurchargeItems)
}

func TestCalculateTextQuotaSummaryImageGenerationUsesStructuredSurcharge(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw
	t.Cleanup(func() {
		price_expression.DeleteToolPriceForTest(dto.BuildInToolImageGeneration)
	})

	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "gpt-5.1",
		ResponsesUsageInfo: &relaycommon.ResponsesUsageInfo{
			BuiltInTools: map[string]*relaycommon.BuildInToolInfo{
				dto.BuildInToolImageGeneration: {CallCount: 1},
			},
		},
	}
	relayInfo.PriceData.GroupRatioInfo.GroupRatio = 1
	relayInfo.PriceData.ModelRatio = 1
	relayInfo.PriceData.CompletionRatio = 1

	usage := &dto.Usage{PromptTokens: 10, CompletionTokens: 5, TotalTokens: 15}
	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)

	require.Len(t, summary.ToolSurchargeItems, 1)
	assert.Equal(t, dto.BuildInToolImageGeneration, summary.ToolSurchargeItems[0].Name)
	assert.Equal(t, 1, summary.ToolSurchargeItems[0].Count)
	assert.Equal(t, 150.0, summary.ToolSurchargeItems[0].Price)

	expectedSurcharge := decimal.NewFromFloat(150.0 / 1000).Mul(decimal.NewFromFloat(common.QuotaPerUnit))
	assert.True(t, expectedSurcharge.Equal(summary.ToolCallSurchargeQuota),
		"got %s want %s", summary.ToolCallSurchargeQuota, expectedSurcharge)
	assert.Greater(t, summary.Quota, 0)
}

func TestAppendToolSurchargeLogInfoWritesOnlyStructuredFields(t *testing.T) {
	items := []ToolSurchargeItem{
		{Name: dto.BuildInToolWebSearch, Count: 2, Price: 10},
		{Name: dto.BuildInToolImageGeneration, Count: 1, Price: 150},
	}
	other := map[string]interface{}{}

	appendToolSurchargeLogInfo(other, items)

	assert.Equal(t, items, other["tool_surcharges"])
	assert.NotContains(t, other, "web_search")
	assert.NotContains(t, other, "web_search_call_count")
	assert.NotContains(t, other, "web_search_price")
	assert.NotContains(t, other, "file_search")
	assert.NotContains(t, other, "image_generation_call")
	assert.NotContains(t, other, "image_generation_call_price")
}

func perCallRelayInfo(modelPrice float64, groupRatio float64) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		OriginModelName: "gpt-5-2",
		RelayFormat:     types.RelayFormatOpenAI,
		PriceData: hosttypes.PriceData{
			ModelPrice:     modelPrice,
			UsePrice:       true,
			GroupRatioInfo: hosttypes.GroupRatioInfo{GroupRatio: groupRatio},
		},
		StartTime: time.Now(),
	}
}

func setEmptyResponseMultiplier(t *testing.T, multiplier float64) {
	t.Helper()
	old := quotaSetting.EmptyResponseMultiplier
	quotaSetting.EmptyResponseMultiplier = multiplier
	t.Cleanup(func() { quotaSetting.EmptyResponseMultiplier = old })
}

func TestCalculateTextQuotaSummaryPerCallEmptyResponseWaived(t *testing.T) {
	setEmptyResponseMultiplier(t, 0)
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw
	relayInfo := perCallRelayInfo(0.38, 1)
	usage := &dto.Usage{PromptTokens: 14, CompletionTokens: 0, TotalTokens: 14}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)
	applyEmptyResponseMultiplier(relayInfo, &summary, "")

	require.Equal(t, 0, summary.Quota, "multiplier 0 must waive the per-call charge entirely")
	assert.True(t, summary.EmptyResponseWaived)
	assert.Equal(t, 0.0, summary.EmptyResponseMultiplier)
}

func TestCalculateTextQuotaSummaryPerCallEmptyResponseMultiplier(t *testing.T) {
	setEmptyResponseMultiplier(t, 0.1)
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw
	relayInfo := perCallRelayInfo(0.38, 1)
	usage := &dto.Usage{PromptTokens: 14, CompletionTokens: 0, TotalTokens: 14}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)
	applyEmptyResponseMultiplier(relayInfo, &summary, "")

	expected := common.QuotaFromDecimal(decimal.NewFromFloat(0.38).
		Mul(decimal.NewFromFloat(float64(common.QuotaPerUnit))).
		Mul(decimal.NewFromFloat(0.1)))
	require.Equal(t, expected, summary.Quota, "multiplier 0.1 must scale the per-call charge")
	assert.True(t, summary.EmptyResponseWaived)
	assert.Equal(t, 0.1, summary.EmptyResponseMultiplier)
}

func TestCalculateTextQuotaSummaryPerCallWithOutputNotWaived(t *testing.T) {
	setEmptyResponseMultiplier(t, 0)
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw
	relayInfo := perCallRelayInfo(0.38, 1)
	usage := &dto.Usage{PromptTokens: 14, CompletionTokens: 92, TotalTokens: 106}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)
	applyEmptyResponseMultiplier(relayInfo, &summary, "")

	require.Equal(t, int(0.38*float64(common.QuotaPerUnit)), summary.Quota)
	assert.False(t, summary.EmptyResponseWaived)
}

func TestCalculateTextQuotaSummaryObservedReasoningOnlyChargedAsUpstreamTruncated(t *testing.T) {
	setEmptyResponseMultiplier(t, 0.3)
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	relayInfo := perCallRelayInfo(0.38, 1)
	relayInfo.StreamContentObserved = true
	relayInfo.StreamStatus = relaycommon.NewStreamStatus()
	relayInfo.StreamStatus.SetEndReason(relaycommon.StreamEndReasonDone, nil)
	usage := &dto.Usage{PromptTokens: 14, CompletionTokens: 15, TotalTokens: 29}

	summary := calculateTextQuotaSummary(ctxRaw, relayInfo, usage)
	applyEmptyResponseMultiplier(relayInfo, &summary, "")
	applyTruncatedResponseMultiplier(relayInfo, &summary, false)

	expected := int(decimal.NewFromFloat(0.38).Mul(decimal.NewFromFloat(float64(common.QuotaPerUnit))).Mul(decimal.NewFromFloat(0.3)).IntPart())
	require.Equal(t, expected, summary.Quota, "reasoning-only output is an incomplete upstream delivery")
	assert.False(t, summary.EmptyResponseDetected)
	assert.True(t, summary.TruncatedResponseApplied)
	assert.Equal(t, "upstream", summary.StreamCut)
}

func TestCalculateTextQuotaSummaryObservedTextNotWaived(t *testing.T) {
	setEmptyResponseMultiplier(t, 0)
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	relayInfo := perCallRelayInfo(0.38, 1)
	relayInfo.StreamContentObserved = true
	relayInfo.StreamSawTextContent = true
	usage := &dto.Usage{PromptTokens: 14, CompletionTokens: 0, TotalTokens: 14}

	summary := calculateTextQuotaSummary(ctxRaw, relayInfo, usage)
	applyEmptyResponseMultiplier(relayInfo, &summary, "")

	require.Equal(t, int(0.38*float64(common.QuotaPerUnit)), summary.Quota, "delivered text keeps the full charge even without upstream usage")
	assert.False(t, summary.EmptyResponseWaived)
}

func TestCalculateTextQuotaSummaryObservedToolCallNotWaived(t *testing.T) {
	setEmptyResponseMultiplier(t, 0)
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	relayInfo := perCallRelayInfo(0.38, 1)
	relayInfo.StreamContentObserved = true
	relayInfo.StreamSawToolCall = true
	usage := &dto.Usage{PromptTokens: 14, CompletionTokens: 0, TotalTokens: 14}

	summary := calculateTextQuotaSummary(ctxRaw, relayInfo, usage)
	applyEmptyResponseMultiplier(relayInfo, &summary, "")

	require.Equal(t, int(0.38*float64(common.QuotaPerUnit)), summary.Quota, "a tool-call-only response is delivered work")
	assert.False(t, summary.EmptyResponseWaived)
}

func TestCalculateTextQuotaSummaryObservedMediaNotWaived(t *testing.T) {
	setEmptyResponseMultiplier(t, 0)
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	relayInfo := perCallRelayInfo(0.38, 1)
	relayInfo.StreamContentObserved = true
	relayInfo.StreamSawMediaContent = true
	usage := &dto.Usage{PromptTokens: 14, CompletionTokens: 0, TotalTokens: 14}

	summary := calculateTextQuotaSummary(ctxRaw, relayInfo, usage)
	applyEmptyResponseMultiplier(relayInfo, &summary, "")

	require.Equal(t, int(0.38*float64(common.QuotaPerUnit)), summary.Quota, "an image-only response is delivered work")
	assert.False(t, summary.EmptyResponseWaived)
}

func TestApplyTruncatedResponseMultiplierHandlerStopNotClassified(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	relayInfo := perCallRelayInfo(0.38, 1)
	relayInfo.StreamContentObserved = true
	relayInfo.StreamSawTextContent = true
	relayInfo.StreamStatus = relaycommon.NewStreamStatus()
	relayInfo.StreamStatus.SetEndReason(relaycommon.StreamEndReasonHandlerStop, nil)
	usage := &dto.Usage{PromptTokens: 14, CompletionTokens: 10, TotalTokens: 24}

	summary := calculateTextQuotaSummary(ctxRaw, relayInfo, usage)
	applyTruncatedResponseMultiplier(relayInfo, &summary, false)

	require.Equal(t, int(0.38*float64(common.QuotaPerUnit)), summary.Quota, "handler_stop is ambiguous and must not discount")
	assert.Empty(t, summary.StreamCut)
}

func TestApplyTruncatedResponseMultiplierFinishReasonSuppressesDiscount(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	relayInfo := perCallRelayInfo(0.38, 1)
	relayInfo.StreamContentObserved = true
	relayInfo.StreamSawTextContent = true
	relayInfo.StreamFinishReason = "stop"
	relayInfo.StreamStatus = relaycommon.NewStreamStatus()
	relayInfo.StreamStatus.SetEndReason(relaycommon.StreamEndReasonScannerErr, nil)
	usage := &dto.Usage{PromptTokens: 14, CompletionTokens: 10, TotalTokens: 24}

	summary := calculateTextQuotaSummary(ctxRaw, relayInfo, usage)
	applyTruncatedResponseMultiplier(relayInfo, &summary, false)

	require.Equal(t, int(0.38*float64(common.QuotaPerUnit)), summary.Quota, "a completed answer must not be discounted")
	assert.Empty(t, summary.StreamCut)
}

func TestCalculateTextQuotaSummaryPerCallEmptyWithToolSurchargeNotWaived(t *testing.T) {
	setEmptyResponseMultiplier(t, 0)
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw
	relayInfo := perCallRelayInfo(0.38, 1)
	relayInfo.ResponsesUsageInfo = &relaycommon.ResponsesUsageInfo{
		BuiltInTools: map[string]*relaycommon.BuildInToolInfo{
			dto.BuildInToolWebSearchPreview: {CallCount: 1},
		},
	}
	usage := &dto.Usage{PromptTokens: 14, CompletionTokens: 0, TotalTokens: 14}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)
	applyEmptyResponseMultiplier(relayInfo, &summary, "")

	// A tool call is delivered work: full call price + web-search surcharge.
	expected := decimal.NewFromFloat(0.38 + 10.0/1000).Mul(decimal.NewFromFloat(common.QuotaPerUnit))
	require.True(t, expected.Equal(decimal.NewFromInt(int64(summary.Quota))), "got %d want %s", summary.Quota, expected)
	assert.False(t, summary.EmptyResponseWaived)
}

func TestCalculateTextQuotaSummaryPerCallEmptyContentFilterNotWaived(t *testing.T) {
	setEmptyResponseMultiplier(t, 0)
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw
	ctx.Set(string(constant.ContextKeyAdminRejectReason), "openai_finish_reason=content_filter")
	relayInfo := perCallRelayInfo(0.38, 1)
	usage := &dto.Usage{PromptTokens: 14, CompletionTokens: 0, TotalTokens: 14}

	adminRejectReason := common.GetCtxKeyString(ctx, constant.ContextKeyAdminRejectReason)
	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)
	applyEmptyResponseMultiplier(relayInfo, &summary, adminRejectReason)

	require.Equal(t, int(0.38*float64(common.QuotaPerUnit)), summary.Quota, "content-filtered responses keep the prompt charge")
	assert.False(t, summary.EmptyResponseWaived)
}

func TestCalculateTextQuotaSummaryPerCallEmptyClientGoneNotWaived(t *testing.T) {
	setEmptyResponseMultiplier(t, 0)
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw
	relayInfo := perCallRelayInfo(0.38, 1)
	relayInfo.StreamStatus = relaycommon.NewStreamStatus()
	relayInfo.StreamStatus.SetEndReason(relaycommon.StreamEndReasonClientGone, nil)
	usage := &dto.Usage{PromptTokens: 14, CompletionTokens: 0, TotalTokens: 14}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)
	applyEmptyResponseMultiplier(relayInfo, &summary, "")

	require.Equal(t, int(0.38*float64(common.QuotaPerUnit)), summary.Quota, "client-abandoned streams are not an upstream failure")
	assert.False(t, summary.EmptyResponseWaived)
}

func TestCalculateTextQuotaSummaryTokenBilledEmptyResponseUsesMultiplier(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw
	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "some-token-model",
		RelayFormat:     types.RelayFormatOpenAI,
		PriceData: hosttypes.PriceData{
			ModelRatio:     2,
			UsePrice:       false,
			GroupRatioInfo: hosttypes.GroupRatioInfo{GroupRatio: 1},
		},
		StartTime: time.Now(),
	}
	usage := &dto.Usage{PromptTokens: 1000, CompletionTokens: 0, TotalTokens: 1000}

	// multiplier 1 keeps the full prompt-token charge.
	setEmptyResponseMultiplier(t, 1)
	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)
	applyEmptyResponseMultiplier(relayInfo, &summary, "")
	require.Equal(t, 2000, summary.Quota)
	assert.True(t, summary.EmptyResponseDetected)
	assert.False(t, summary.EmptyResponseWaived)

	// multiplier 0.1 scales the prompt-token charge.
	setEmptyResponseMultiplier(t, 0.1)
	summary = calculateTextQuotaSummary(ctx, relayInfo, usage)
	applyEmptyResponseMultiplier(relayInfo, &summary, "")
	require.Equal(t, 200, summary.Quota)
	assert.True(t, summary.EmptyResponseWaived)
	assert.Equal(t, 0.1, summary.EmptyResponseMultiplier)

	// multiplier 0 waives the prompt-token charge entirely.
	setEmptyResponseMultiplier(t, 0)
	summary = calculateTextQuotaSummary(ctx, relayInfo, usage)
	applyEmptyResponseMultiplier(relayInfo, &summary, "")
	require.Equal(t, 0, summary.Quota)
	assert.True(t, summary.EmptyResponseWaived)
}

func TestApplyEmptyResponseMultiplierTieredBillingNotExcluded(t *testing.T) {
	setEmptyResponseMultiplier(t, 0.1)
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw
	relayInfo := perCallRelayInfo(0.38, 1)
	relayInfo.TieredBillingSnapshot = &price_expression.BillingSnapshot{}
	usage := &dto.Usage{PromptTokens: 1000, CompletionTokens: 0, TotalTokens: 1000}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)
	// Simulate a tiered settlement having already set the final quota
	// (TryTieredSettle/composeTieredTextQuota run before the multiplier).
	summary.Quota = 5000
	applyEmptyResponseMultiplier(relayInfo, &summary, "")

	require.Equal(t, 500, summary.Quota, "tiered-billed empty responses must use the multiplier too")
	assert.True(t, summary.EmptyResponseDetected)
	assert.True(t, summary.EmptyResponseWaived)
	assert.Equal(t, 0.1, summary.EmptyResponseMultiplier)
}

func TestApplyEmptyResponseMultiplierClampsConfiguredMultiplier(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw
	relayInfo := perCallRelayInfo(0.38, 1)
	usage := &dto.Usage{PromptTokens: 14, CompletionTokens: 0, TotalTokens: 14}

	// negative multiplier -> 0 (full waiver)
	setEmptyResponseMultiplier(t, -0.5)
	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)
	applyEmptyResponseMultiplier(relayInfo, &summary, "")
	require.Equal(t, 0, summary.Quota)
	assert.True(t, summary.EmptyResponseWaived)
	assert.Equal(t, 0.0, summary.EmptyResponseMultiplier)

	// multiplier > 1 -> 1 (full price, still detected)
	setEmptyResponseMultiplier(t, 2)
	summary = calculateTextQuotaSummary(ctx, relayInfo, usage)
	applyEmptyResponseMultiplier(relayInfo, &summary, "")
	require.Equal(t, int(0.38*float64(common.QuotaPerUnit)), summary.Quota)
	assert.True(t, summary.EmptyResponseDetected)
	assert.False(t, summary.EmptyResponseWaived)
	assert.Equal(t, 1.0, summary.EmptyResponseMultiplier)

	// NaN -> 0 (full waiver)
	setEmptyResponseMultiplier(t, math.NaN())
	summary = calculateTextQuotaSummary(ctx, relayInfo, usage)
	applyEmptyResponseMultiplier(relayInfo, &summary, "")
	require.Equal(t, 0, summary.Quota)
	assert.True(t, summary.EmptyResponseWaived)
	assert.Equal(t, 0.0, summary.EmptyResponseMultiplier)
}

func TestCalculateTextQuotaSummaryPerCallImageModelNotWaived(t *testing.T) {
	setEmptyResponseMultiplier(t, 0)
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw
	// Image models legitimately report completion_tokens=0; the deliverable is
	// the image itself, so the per-call charge (with the n multiplier) stands.
	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "dall-e-3",
		RelayFormat:     types.RelayFormatOpenAIImage,
		PriceData: hosttypes.PriceData{
			ModelPrice:     0.12,
			UsePrice:       true,
			GroupRatioInfo: hosttypes.GroupRatioInfo{GroupRatio: 1},
		},
		StartTime: time.Now(),
	}
	relayInfo.PriceData.AddOtherRatio("n", 3)
	usage := &dto.Usage{PromptTokens: 1, TotalTokens: 1}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)
	applyEmptyResponseMultiplier(relayInfo, &summary, "")

	require.Equal(t, 180000, summary.Quota)
	assert.False(t, summary.EmptyResponseWaived)
}

func truncatedCutRelayInfo() *relaycommon.RelayInfo {
	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "some-token-model",
		RelayFormat:     types.RelayFormatOpenAI,
		PriceData: hosttypes.PriceData{
			ModelRatio:      2,
			CompletionRatio: 3,
			UsePrice:        false,
			GroupRatioInfo:  hosttypes.GroupRatioInfo{GroupRatio: 1},
		},
		StartTime: time.Now(),
	}
	relayInfo.StreamStatus = relaycommon.NewStreamStatus()
	return relayInfo
}

// prompt 1000 + completion 100 at model ratio 2, completion ratio 3:
// full quota = (1000 + 100*3) * 2 = 2600; completion side = 600.
// A 0.3 cut multiplier discounts the completion side by 0.7 -> 2600-420.
func TestApplyTruncatedResponseMultiplierTokenBilledDiscountsCompletionOnly(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw
	relayInfo := truncatedCutRelayInfo()
	relayInfo.StreamStatus.SetEndReason(relaycommon.StreamEndReasonScannerErr, nil)
	usage := &dto.Usage{PromptTokens: 1000, CompletionTokens: 100, TotalTokens: 1100}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)
	require.Equal(t, 2600, summary.Quota)
	applyTruncatedResponseMultiplier(relayInfo, &summary, false)

	require.Equal(t, 2180, summary.Quota, "prompt stays full price, completion side scales by 0.3")
	assert.Equal(t, "upstream", summary.StreamCut)
	assert.True(t, summary.TruncatedResponseApplied)
	assert.Equal(t, 0.3, summary.TruncatedResponseMultiplier)
}

// TestApplyTruncatedResponseMultiplierTokenTiers pins the fixed tier ladder for
// upstream stream cuts: delivered output <=500 tokens charges 0.3x, (500,1000]
// charges 0.5x, >1000 charges 0.9x, including the 500/501 and 1000/1001 tier
// boundaries. Fixture: prompt 1000 at ratio 2, completion at ratio 2*3=6, so
// quota = 2000 + 6*tokens after the tier fold.
func TestApplyTruncatedResponseMultiplierTokenTiers(t *testing.T) {
	cases := []struct {
		name             string
		completionTokens int
		wantMultiplier   float64
		wantQuota        int
	}{
		{"500 tokens stays in the 0.3 tier", 500, 0.3, 2900},
		{"501 tokens crosses into the 0.5 tier", 501, 0.5, 3503},
		{"1000 tokens stays in the 0.5 tier", 1000, 0.5, 5000},
		{"1001 tokens crosses into the 0.9 tier", 1001, 0.9, 7405},
		{"1500 tokens stays in the 0.9 tier", 1500, 0.9, 10100},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
			relayInfo := truncatedCutRelayInfo()
			relayInfo.StreamStatus.SetEndReason(relaycommon.StreamEndReasonScannerErr, nil)
			usage := &dto.Usage{
				PromptTokens:     1000,
				CompletionTokens: tc.completionTokens,
				TotalTokens:      1000 + tc.completionTokens,
			}

			summary := calculateTextQuotaSummary(ctxRaw, relayInfo, usage)
			applyTruncatedResponseMultiplier(relayInfo, &summary, false)

			require.True(t, summary.TruncatedResponseApplied)
			assert.Equal(t, "upstream", summary.StreamCut)
			assert.Equal(t, tc.wantMultiplier, summary.TruncatedResponseMultiplier)
			assert.Equal(t, tc.wantQuota, summary.Quota)
		})
	}
}

func TestApplyTruncatedResponseMultiplierClientGoneChargesFullPrice(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw
	relayInfo := truncatedCutRelayInfo()
	relayInfo.StreamStatus.SetEndReason(relaycommon.StreamEndReasonClientGone, nil)
	usage := &dto.Usage{PromptTokens: 1000, CompletionTokens: 100, TotalTokens: 1100}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)
	applyTruncatedResponseMultiplier(relayInfo, &summary, false)

	require.Equal(t, 2600, summary.Quota, "user disconnects are charged at full price")
	assert.Equal(t, "client", summary.StreamCut)
	assert.False(t, summary.TruncatedResponseApplied)
}

func TestApplyTruncatedResponseMultiplierNoCutCases(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw
	cases := []struct {
		name      string
		endReason relaycommon.StreamEndReason
		sawFinish bool
		format    types.RelayFormat
	}{
		{"clean done", relaycommon.StreamEndReasonDone, false, types.RelayFormatOpenAI},
		{"plain eof", relaycommon.StreamEndReasonEOF, false, types.RelayFormatClaude},
		{"scanner error after finish_reason", relaycommon.StreamEndReasonScannerErr, true, types.RelayFormatOpenAI},
		{"non-stream none", relaycommon.StreamEndReasonNone, false, types.RelayFormatOpenAI},
		{"image format scanner error", relaycommon.StreamEndReasonScannerErr, false, types.RelayFormatOpenAIImage},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			relayInfo := truncatedCutRelayInfo()
			relayInfo.RelayFormat = tc.format
			relayInfo.StreamStatus.SetEndReason(tc.endReason, nil)
			relayInfo.StreamSawFinishReason = tc.sawFinish
			usage := &dto.Usage{PromptTokens: 1000, CompletionTokens: 100, TotalTokens: 1100}

			summary := calculateTextQuotaSummary(ctx, relayInfo, usage)
			applyTruncatedResponseMultiplier(relayInfo, &summary, false)

			require.Equal(t, 2600, summary.Quota)
			assert.Empty(t, summary.StreamCut)
			assert.False(t, summary.TruncatedResponseApplied)
		})
	}
}

func TestApplyTruncatedResponseMultiplierPerCallFoldsTotal(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw
	relayInfo := perCallRelayInfo(0.38, 1)
	relayInfo.StreamStatus = relaycommon.NewStreamStatus()
	relayInfo.StreamStatus.SetEndReason(relaycommon.StreamEndReasonScannerErr, nil)
	usage := &dto.Usage{PromptTokens: 14, CompletionTokens: 50, TotalTokens: 64}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)
	require.Equal(t, int(0.38*float64(common.QuotaPerUnit)), summary.Quota)
	applyTruncatedResponseMultiplier(relayInfo, &summary, false)

	require.Equal(t, int(0.38*float64(common.QuotaPerUnit)*0.3), summary.Quota,
		"per-call billing has no output split, the total folds by the multiplier")
	assert.Equal(t, "upstream", summary.StreamCut)
	assert.True(t, summary.TruncatedResponseApplied)
}

// completion=0 with an upstream scanner error is owned by the empty-response
// policy: the cut badge still marks the log, but only one discount applies.
func TestApplyTruncatedResponseMultiplierEmptyPolicyTakesPrecedence(t *testing.T) {
	setEmptyResponseMultiplier(t, 0.1)
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw
	relayInfo := truncatedCutRelayInfo()
	relayInfo.StreamStatus.SetEndReason(relaycommon.StreamEndReasonScannerErr, nil)
	usage := &dto.Usage{PromptTokens: 1000, CompletionTokens: 0, TotalTokens: 1000}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)
	applyEmptyResponseMultiplier(relayInfo, &summary, "")
	applyTruncatedResponseMultiplier(relayInfo, &summary, false)

	require.Equal(t, 200, summary.Quota, "only the empty-response multiplier folds the charge")
	assert.True(t, summary.EmptyResponseDetected)
	assert.Equal(t, "upstream", summary.StreamCut)
	assert.False(t, summary.TruncatedResponseApplied)
}

func TestApplyTruncatedResponseMultiplierForcedUpstreamCut(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw
	relayInfo := perCallRelayInfo(0.38, 1)
	relayInfo.StreamContentObserved = true
	relayInfo.StreamSawTextContent = true
	relayInfo.StreamCutOverride = "upstream"
	relayInfo.StreamStatus = relaycommon.NewStreamStatus()
	relayInfo.StreamStatus.SetEndReason(relaycommon.StreamEndReasonEOF, nil)
	usage := &dto.Usage{PromptTokens: 14, CompletionTokens: 10, TotalTokens: 24}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)
	applyTruncatedResponseMultiplier(relayInfo, &summary, false)

	expected := int(decimal.NewFromFloat(0.38).Mul(decimal.NewFromFloat(float64(common.QuotaPerUnit))).Mul(decimal.NewFromFloat(0.3)).IntPart())
	require.Equal(t, expected, summary.Quota, "an OpenAI EOF cut must settle at the truncated multiplier")
	assert.Equal(t, "upstream", summary.StreamCut)
}

// TestApplyTruncatedResponseMultiplierMarksSettledUpstreamFailure is the
// health-signal half of the settlement split: once billing decides an upstream
// cut is the provider's fault and settles the charge, the relay loop must still
// see a channel failure. A client disconnect or a clean stream must not mark
// the attempt, because neither says anything about the channel.
func TestApplyTruncatedResponseMultiplierMarksSettledUpstreamFailure(t *testing.T) {
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw

	cases := []struct {
		name     string
		prepare  func(*relaycommon.RelayInfo)
		wantCut  string
		wantMark bool
	}{
		{
			name: "upstream scanner error marks the attempt",
			prepare: func(info *relaycommon.RelayInfo) {
				info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonScannerErr, nil)
			},
			wantCut:  "upstream",
			wantMark: true,
		},
		{
			name: "handler-attributed cut at plain EOF marks the attempt",
			prepare: func(info *relaycommon.RelayInfo) {
				info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonEOF, nil)
				info.StreamCutOverride = "upstream"
			},
			wantCut:  "upstream",
			wantMark: true,
		},
		{
			name: "client disconnect does not mark the attempt",
			prepare: func(info *relaycommon.RelayInfo) {
				info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonClientGone, nil)
			},
			wantCut: "client",
		},
		{
			name: "ping failure does not mark the attempt",
			prepare: func(info *relaycommon.RelayInfo) {
				info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonPingFail, nil)
			},
			wantCut: "client",
		},
		{
			name: "clean stream does not mark the attempt",
			prepare: func(info *relaycommon.RelayInfo) {
				info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonDone, nil)
			},
		},
		{
			name: "scanner error after finish_reason does not mark the attempt",
			prepare: func(info *relaycommon.RelayInfo) {
				info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonScannerErr, nil)
				info.StreamSawFinishReason = true
			},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			relayInfo := truncatedCutRelayInfo()
			tc.prepare(relayInfo)
			usage := &dto.Usage{PromptTokens: 1000, CompletionTokens: 100, TotalTokens: 1100}

			summary := calculateTextQuotaSummary(ctx, relayInfo, usage)
			applyTruncatedResponseMultiplier(relayInfo, &summary, false)

			assert.Equal(t, tc.wantCut, summary.StreamCut)
			assert.Equal(t, tc.wantMark, relayInfo.SettledUpstreamFailure)
		})
	}
}

func TestApplyEmptyResponseMultiplierMarksSettledUpstreamFailure(t *testing.T) {
	setEmptyResponseMultiplier(t, 0.1)
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw
	relayInfo := truncatedCutRelayInfo()
	relayInfo.StreamContentObserved = true
	relayInfo.StreamStatus.SetEndReason(relaycommon.StreamEndReasonDone, nil)
	usage := &dto.Usage{PromptTokens: 1000, CompletionTokens: 0, TotalTokens: 1000}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)
	applyEmptyResponseMultiplier(relayInfo, &summary, "")

	require.True(t, summary.EmptyResponseDetected)
	assert.True(t, relayInfo.SettledUpstreamFailure,
		"a settled empty 200 is an upstream failure, not a channel success")
}

func TestApplyEmptyResponseMultiplierPingFailChargesFull(t *testing.T) {
	setEmptyResponseMultiplier(t, 0)
	ctxRaw, _ := fiberadapter.NewSyntheticContext(nil)
	ctx := ctxRaw
	relayInfo := truncatedCutRelayInfo()
	relayInfo.StreamContentObserved = true
	relayInfo.StreamStatus.SetEndReason(relaycommon.StreamEndReasonPingFail, nil)
	usage := &dto.Usage{PromptTokens: 1000, CompletionTokens: 0, TotalTokens: 1000}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)
	applyEmptyResponseMultiplier(relayInfo, &summary, "")

	require.False(t, summary.EmptyResponseDetected)
	assert.False(t, relayInfo.SettledUpstreamFailure)
	require.Equal(t, 2000, summary.Quota, "a client-side ping failure keeps the full charge")
}
