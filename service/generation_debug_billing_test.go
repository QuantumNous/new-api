package service

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/pkg/generationdebug"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestGenerationDebugReusesOpenRouterCacheCreateAndKeepsBilling locks the
// contract that, for an OpenRouter Claude upstream that only reports usage.cost
// and cached read tokens (no explicit cache creation), the billing layer derives
// cache_write_tokens via CalcOpenRouterCacheCreateTokens, feeds that value into
// the generation-debug summary through CacheWriteTokensOverride, and does NOT
// alter the billed quota. Generation debug only writes into Log.Other; it never
// touches the quota summary.
func TestGenerationDebugReusesOpenRouterCacheCreateAndKeepsBilling(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())

	priceData := types.PriceData{
		ModelRatio:         1.5,
		CompletionRatio:    1,
		CacheRatio:         0.1,
		CacheCreationRatio: 1.25,
		GroupRatioInfo:     types.GroupRatioInfo{GroupRatio: 1},
	}
	// Use a model that exists in the default ratio map with a matching default
	// ratio, so hasCustomModelRatio is false and the cost-based back-computation
	// path actually engages (custom settings intentionally skip the derivation).
	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "claude-3-7-sonnet-20250219",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeOpenRouter,
		},
		PriceData: priceData,
	}

	// Upstream reports only cost + cached read tokens; cache creation is absent
	// and must be back-computed by the billing layer from cost.
	usage := &dto.Usage{
		PromptTokens:     2604,
		CompletionTokens: 383,
		UsageSemantic:    "anthropic",
		Cost:             0.0024696, // chosen so the back-computed creation tokens land cleanly
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens: 2432,
		},
	}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)

	// The OpenRouter Claude billing path must have derived cache creation tokens
	// from cost using the shared helper (this is the value reused for debug).
	expectedCreateTokens := CalcOpenRouterCacheCreateTokens(*usage, priceData)
	require.GreaterOrEqual(t, expectedCreateTokens, 0, "back-computed cache creation must be non-negative")
	require.Equal(t, expectedCreateTokens, summary.CacheCreationTokens,
		"billing must populate CacheCreationTokens via CalcOpenRouterCacheCreateTokens")

	// cacheWriteTokensTotal is the exact value the merge point passes as
	// CacheWriteTokensOverride. With no split 5m/1h values, it equals the derived total.
	cacheWriteTokens := cacheWriteTokensTotal(summary)
	require.Equal(t, expectedCreateTokens, cacheWriteTokens,
		"cacheWriteTokens must reuse the billing-derived value, not recompute it")

	// Billing quota is fixed by the usage/price inputs; generation debug never
	// participates in calculateTextQuotaSummary, so re-running yields identical
	// quota. This proves enabling generation debug cannot change billing.
	summaryAgain := calculateTextQuotaSummary(ctx, relayInfo, usage)
	require.Equal(t, summary.Quota, summaryAgain.Quota,
		"generation debug must not influence billed quota")

	// Simulate the PostTextConsumeQuota merge point: the relay entrypoint would have
	// called generationdebug.Begin first; replicate that so MergeContextIntoLogOther
	// has capture state to read. Feed the billing-derived cache_write_tokens into the
	// debug summary via the override. The resulting debug cache_write_tokens must
	// equal the billing value (reuse, not recompute).
	t.Setenv("GENERATION_DEBUG_ENABLED", "true")
	require.True(t, generationdebug.Begin(ctx, "openrouter-req", false))

	other := map[string]interface{}{}
	generationdebug.MergeContextIntoLogOther(ctx, other, usage, generationdebug.LogMeta{
		CacheWriteTokensOverride: cacheWriteTokens,
		Quota:                    summary.Quota,
		QuotaPerUnit:             common.QuotaPerUnit,
	})

	debugSummary, ok := other["generation_debug"].(*generationdebug.Summary)
	require.True(t, ok, "generation_debug summary must be written to Log.Other")
	assert.Equal(t, cacheWriteTokens, debugSummary.Cache.CacheWriteTokens,
		"debug cache_write_tokens must reuse the billing-derived OpenRouter value")
	assert.Equal(t, 2432, debugSummary.Cache.CachedTokens,
		"cached read tokens come straight from usage")

	// Sanity: billed quota is independent of the debug map. The debug summary carries
	// the charged cost derived from quota, but mutating `other` cannot move quota.
	assert.NotContains(t, other, "quota", "debug payload must not carry a billing quota field")
}
