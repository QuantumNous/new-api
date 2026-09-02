package service

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

// Claude's safety classifiers can decline a request with a normal HTTP 200
// response carrying stop_reason "refusal". Anthropic's billing rules for that
// case are:
//
//   - A refusal that arrives before any output is not charged. The token counts
//     still appear in usage, and the request still counts against rate limits.
//   - A refusal that arrives mid-stream is charged normally for the input and
//     the output already streamed.
//   - With server-side fallback, every attempt that produced output is charged
//     at the rate of the model that ran it, and attempts that produced no output
//     are not charged. usage.iterations is the per-attempt record.
//
// https://platform.claude.com/docs/en/build-with-claude/refusals-and-fallback

// claudeBillableIterations returns the fallback attempts that must be charged,
// or nil when the response carries no per-attempt breakdown.
func claudeBillableIterations(usage *dto.Usage) []dto.ClaudeUsageIteration {
	if usage == nil || usage.BillingUsage == nil {
		return nil
	}
	return usage.BillingUsage.ClaudeUsage.BillableIterations()
}

// upstreamRefusalWaivesBilling reports whether the upstream declined the request
// without producing any billable output, in which case it charged us nothing and
// we must not charge the user either.
func upstreamRefusalWaivesBilling(ctx *gin.Context, usage *dto.Usage) bool {
	if !common.GetContextKeyBool(ctx, constant.ContextKeyUpstreamRefusal) {
		return false
	}
	if usage == nil {
		return true
	}
	if usage.CompletionTokens > 0 {
		return false
	}
	// A refused chain still bills any earlier attempt that emitted output before
	// handing over, so a per-attempt breakdown decides on its own.
	return len(claudeBillableIterations(usage)) == 0
}

// claudeIterationPricing is the rate set for one fallback attempt. The
// request-time PriceData is pinned to the model the user asked for, so an
// attempt served by a fallback model needs its own rates.
type claudeIterationPricing struct {
	ModelRatio           float64
	CompletionRatio      float64
	CacheRatio           float64
	CacheCreationRatio5m float64
	CacheCreationRatio1h float64
}

func resolveClaudeIterationPricing(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, modelName string) claudeIterationPricing {
	requested := claudeIterationPricing{
		ModelRatio:           relayInfo.PriceData.ModelRatio,
		CompletionRatio:      relayInfo.PriceData.CompletionRatio,
		CacheRatio:           relayInfo.PriceData.CacheRatio,
		CacheCreationRatio5m: relayInfo.PriceData.CacheCreation5mRatio,
		CacheCreationRatio1h: relayInfo.PriceData.CacheCreation1hRatio,
	}

	modelName = strings.TrimSpace(modelName)
	if modelName == "" || modelName == relayInfo.GetBillingModelName() {
		return requested
	}

	modelRatio, configured, _ := ratio_setting.GetModelRatio(modelName)
	if !configured {
		// Falling back to the requested model's rates keeps the charge in the
		// right order of magnitude; a zero ratio would hand out a free request.
		logger.LogWarn(ctx, "claude fallback model "+modelName+
			" has no configured ratio, billing its attempt at the requested model's rate")
		return requested
	}

	cacheCreationRatio, _ := ratio_setting.GetCreateCacheRatio(modelName)
	cacheRatio, _ := ratio_setting.GetCacheRatio(modelName)
	return claudeIterationPricing{
		ModelRatio:           modelRatio,
		CompletionRatio:      ratio_setting.GetCompletionRatio(modelName),
		CacheRatio:           cacheRatio,
		CacheCreationRatio5m: cacheCreationRatio,
		CacheCreationRatio1h: cacheCreationRatio * ratio_setting.ClaudeCacheCreation1hMultiplier,
	}
}

// claudeIterationsTextQuota prices a server-side fallback response attempt by
// attempt. Token counts inside an iteration follow Anthropic semantics, where
// input_tokens already excludes cache reads and cache writes.
func claudeIterationsTextQuota(
	ctx *gin.Context,
	relayInfo *relaycommon.RelayInfo,
	iterations []dto.ClaudeUsageIteration,
	groupRatio decimal.Decimal,
) decimal.Decimal {
	total := decimal.Zero
	for _, iteration := range iterations {
		pricing := resolveClaudeIterationPricing(ctx, relayInfo, iteration.Model)

		cacheCreation5m, cacheCreation1h := relayconvert.NormalizeCacheCreationSplit(
			iteration.CacheCreationInputTokens,
			iteration.GetCacheCreation5mTokens(),
			iteration.GetCacheCreation1hTokens(),
		)
		attempt := decimal.NewFromInt(int64(iteration.InputTokens))
		attempt = attempt.Add(decimal.NewFromInt(int64(iteration.CacheReadInputTokens)).
			Mul(decimal.NewFromFloat(pricing.CacheRatio)))
		attempt = attempt.Add(decimal.NewFromInt(int64(cacheCreation5m)).
			Mul(decimal.NewFromFloat(pricing.CacheCreationRatio5m)))
		attempt = attempt.Add(decimal.NewFromInt(int64(cacheCreation1h)).
			Mul(decimal.NewFromFloat(pricing.CacheCreationRatio1h)))
		attempt = attempt.Add(decimal.NewFromInt(int64(iteration.OutputTokens)).
			Mul(decimal.NewFromFloat(pricing.CompletionRatio)))

		total = total.Add(attempt.Mul(decimal.NewFromFloat(pricing.ModelRatio)).Mul(groupRatio))
	}
	return total
}
