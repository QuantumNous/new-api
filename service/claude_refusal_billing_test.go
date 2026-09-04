package service

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	hosttypes "github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func refusalTestContext(t *testing.T, refused bool) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	if refused {
		common.SetContextKey(ctx, constant.ContextKeyUpstreamRefusal, true)
	}
	return ctx
}

func refusalTestRelayInfo(priceData hosttypes.PriceData) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		RelayFormat:             types.RelayFormatClaude,
		FinalRequestRelayFormat: types.RelayFormatClaude,
		OriginModelName:         "claude-opus-5",
		PriceData:               priceData,
		StartTime:               time.Now(),
	}
}

func refusalTestPriceData() hosttypes.PriceData {
	return hosttypes.PriceData{
		ModelRatio:           1,
		CompletionRatio:      5,
		CacheRatio:           0.1,
		CacheCreationRatio:   1.25,
		CacheCreation5mRatio: 1.25,
		CacheCreation1hRatio: 2,
		GroupRatioInfo:       hosttypes.GroupRatioInfo{GroupRatio: 1},
	}
}

// claudeRefusalUsage builds the usage Anthropic reports for a refusal: real
// input tokens, no output, and a billing snapshot in Anthropic semantics.
func claudeRefusalUsage(inputTokens int, outputTokens int) *dto.Usage {
	claudeUsage := &dto.ClaudeUsage{
		InputTokens:  inputTokens,
		OutputTokens: outputTokens,
	}
	return &dto.Usage{
		PromptTokens:     inputTokens,
		CompletionTokens: outputTokens,
		TotalTokens:      inputTokens + outputTokens,
		UsageSemantic:    dto.BillingUsageSemanticAnthropic,
		BillingUsage:     dto.NewClaudeMessagesBillingUsage(claudeUsage),
	}
}

func TestCalculateTextQuotaSummaryWaivesRefusalWithoutOutput(t *testing.T) {
	ctx := refusalTestContext(t, true)
	relayInfo := refusalTestRelayInfo(refusalTestPriceData())

	summary := calculateTextQuotaSummary(ctx, relayInfo, claudeRefusalUsage(412, 0))

	assert.True(t, summary.BillingWaived)
	assert.Equal(t, 0, summary.Quota)
	// Tokens stay on the log even though nothing is charged.
	assert.Equal(t, 412, summary.PromptTokens)
	assert.Equal(t, 412, summary.TotalTokens)
}

func TestCalculateTextQuotaSummaryWaivesRefusalUnderPerCallPricing(t *testing.T) {
	ctx := refusalTestContext(t, true)
	priceData := refusalTestPriceData()
	priceData.UsePrice = true
	priceData.ModelPrice = 0.5
	relayInfo := refusalTestRelayInfo(priceData)

	summary := calculateTextQuotaSummary(ctx, relayInfo, claudeRefusalUsage(412, 0))

	assert.True(t, summary.BillingWaived)
	assert.Equal(t, 0, summary.Quota)
}

func TestCalculateTextQuotaSummaryChargesRefusalThatStreamedOutput(t *testing.T) {
	ctx := refusalTestContext(t, true)
	relayInfo := refusalTestRelayInfo(refusalTestPriceData())

	summary := calculateTextQuotaSummary(ctx, relayInfo, claudeRefusalUsage(400, 20))

	assert.False(t, summary.BillingWaived)
	// 400 + 20*5 = 500
	assert.Equal(t, 500, summary.Quota)
}

func TestCalculateTextQuotaSummaryChargesZeroOutputWithoutRefusal(t *testing.T) {
	ctx := refusalTestContext(t, false)
	relayInfo := refusalTestRelayInfo(refusalTestPriceData())

	summary := calculateTextQuotaSummary(ctx, relayInfo, claudeRefusalUsage(412, 0))

	assert.False(t, summary.BillingWaived)
	assert.Equal(t, 412, summary.Quota)
}

// Tiered-expression pricing must not reintroduce a charge the upstream waived.
func TestCalculateTextQuotaSummaryWaivesRefusalUnderTieredBilling(t *testing.T) {
	ctx := refusalTestContext(t, true)
	relayInfo := refusalTestRelayInfo(refusalTestPriceData())
	relayInfo.TieredBillingSnapshot = &billingexpr.BillingSnapshot{
		BillingMode:               "tiered_expr",
		GroupRatio:                1,
		EstimatedQuotaBeforeGroup: 1000,
	}

	summary := calculateTextQuotaSummary(ctx, relayInfo, claudeRefusalUsage(412, 0))

	assert.True(t, summary.BillingWaived)
	assert.Equal(t, 0, summary.Quota)
}

// When every model in a fallback chain refuses before emitting output, nothing
// is charged even though each attempt reported input tokens.
func TestCalculateTextQuotaSummaryWaivesFullyRefusedFallbackChain(t *testing.T) {
	applyFallbackModelRates(t)

	ctx := refusalTestContext(t, true)
	relayInfo := refusalTestRelayInfo(refusalTestPriceData())

	usage := claudeFallbackUsage(
		[]dto.ClaudeUsageIteration{
			{Type: "message", Model: "claude-opus-5", InputTokens: 535, OutputTokens: 0},
			{Type: "fallback_message", Model: "claude-opus-4-8", InputTokens: 412, OutputTokens: 0},
		},
		dto.ClaudeUsageIteration{InputTokens: 412, OutputTokens: 0},
	)

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)

	assert.True(t, summary.BillingWaived)
	assert.Empty(t, summary.FallbackIterations)
	assert.Equal(t, 0, summary.Quota)
}

// A chain whose first hop refused mid-output is charged for that hop, so the
// refusal mark alone must not waive it.
func TestCalculateTextQuotaSummaryChargesRefusedChainThatEmittedOutput(t *testing.T) {
	applyFallbackModelRates(t)

	ctx := refusalTestContext(t, true)
	relayInfo := refusalTestRelayInfo(refusalTestPriceData())

	usage := claudeFallbackUsage(
		[]dto.ClaudeUsageIteration{
			{Type: "message", Model: "claude-opus-5", InputTokens: 100, OutputTokens: 50},
			{Type: "fallback_message", Model: "claude-opus-4-8", InputTokens: 412, OutputTokens: 0},
		},
		dto.ClaudeUsageIteration{InputTokens: 412, OutputTokens: 0},
	)

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)

	assert.False(t, summary.BillingWaived)
	// only hop 1: (100 + 50*5) * 1 = 350
	assert.Equal(t, 350, summary.Quota)
}

func TestUpstreamRefusalWaivesBillingRequiresRefusalMark(t *testing.T) {
	assert.False(t, upstreamRefusalWaivesBilling(refusalTestContext(t, false), claudeRefusalUsage(412, 0)))
	assert.True(t, upstreamRefusalWaivesBilling(refusalTestContext(t, true), claudeRefusalUsage(412, 0)))
	assert.True(t, upstreamRefusalWaivesBilling(refusalTestContext(t, true), nil))
}

func TestApplyRefusalWaiverDropsTokenChargeFromAnyPricingPath(t *testing.T) {
	summary := textQuotaSummary{Quota: 1234, BillingWaived: true}

	assert.True(t, summary.applyRefusalWaiver())
	assert.Equal(t, 0, summary.Quota)
}

func TestApplyRefusalWaiverLeavesBillableRequestUntouched(t *testing.T) {
	summary := textQuotaSummary{Quota: 1234}

	assert.False(t, summary.applyRefusalWaiver())
	assert.Equal(t, 1234, summary.Quota)
}

// Anthropic waives only the token charge. Server tools it already executed are
// billed separately, so their surcharge must survive the waiver.
func TestApplyRefusalWaiverKeepsToolCallSurcharge(t *testing.T) {
	summary := textQuotaSummary{
		Quota:                  1234,
		BillingWaived:          true,
		ToolCallSurchargeQuota: decimal.NewFromInt(70),
	}

	assert.True(t, summary.applyRefusalWaiver())
	assert.Equal(t, 70, summary.Quota)
}

// A waived refusal reported real token counts, so it must still take the branch
// that records the request against the user and channel.
func TestHasBillableUsageTreatsWaivedRefusalAsReportedUsage(t *testing.T) {
	waived := textQuotaSummary{TotalTokens: 412, BillingWaived: true}
	assert.True(t, waived.hasBillableUsage())

	missing := textQuotaSummary{}
	assert.False(t, missing.hasBillableUsage())
}

// claudeFallbackUsage mirrors a server-side fallback response: the top-level
// counts describe only the attempt that served the message, while iterations
// record every attempt.
func claudeFallbackUsage(iterations []dto.ClaudeUsageIteration, topLevel dto.ClaudeUsageIteration) *dto.Usage {
	claudeUsage := &dto.ClaudeUsage{
		InputTokens:              topLevel.InputTokens,
		OutputTokens:             topLevel.OutputTokens,
		CacheReadInputTokens:     topLevel.CacheReadInputTokens,
		CacheCreationInputTokens: topLevel.CacheCreationInputTokens,
		Iterations:               iterations,
	}
	return &dto.Usage{
		PromptTokens:     topLevel.InputTokens,
		CompletionTokens: topLevel.OutputTokens,
		TotalTokens:      topLevel.InputTokens + topLevel.OutputTokens,
		UsageSemantic:    dto.BillingUsageSemanticAnthropic,
		BillingUsage:     dto.NewClaudeMessagesBillingUsage(claudeUsage),
	}
}

// applyFallbackModelRates prices claude-opus-4-8 differently from the requested
// claude-opus-5 so a per-attempt charge is distinguishable from one that reused
// the request-time PriceData. Completion ratio is not set here: it is hardcoded
// per model family and configuration does not override it.
func applyFallbackModelRates(t *testing.T) {
	t.Helper()
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(`{"claude-opus-5":1,"claude-opus-4-8":3}`))
	require.NoError(t, ratio_setting.UpdateCacheRatioByJSONString(`{"claude-opus-4-8":0.5}`))
	require.NoError(t, ratio_setting.UpdateCreateCacheRatioByJSONString(`{"claude-opus-4-8":2}`))
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(`{}`))
		require.NoError(t, ratio_setting.UpdateCacheRatioByJSONString(`{}`))
		require.NoError(t, ratio_setting.UpdateCreateCacheRatioByJSONString(`{}`))
	})
}

func TestCalculateTextQuotaSummaryPricesFallbackIterationsPerModel(t *testing.T) {
	applyFallbackModelRates(t)

	ctx := refusalTestContext(t, false)
	relayInfo := refusalTestRelayInfo(refusalTestPriceData())

	// The refused first hop streamed 50 output tokens before handing over, so it
	// is billed at its own rate; the fallback model serves the rest.
	usage := claudeFallbackUsage(
		[]dto.ClaudeUsageIteration{
			{Type: "message", Model: "claude-opus-5", InputTokens: 100, OutputTokens: 50},
			{Type: "fallback_message", Model: "claude-opus-4-8", InputTokens: 200, OutputTokens: 10},
		},
		dto.ClaudeUsageIteration{InputTokens: 200, OutputTokens: 10},
	)

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)

	// hop 1: (100 + 50*5) * 1 = 350
	// hop 2: (200 + 10*5) * 3 = 750
	require.Len(t, summary.FallbackIterations, 2)
	assert.Equal(t, 1100, summary.Quota)

	// Pricing the top-level counts once would charge only the serving hop.
	assert.NotEqual(t, 750, summary.Quota)
}

func TestCalculateTextQuotaSummarySkipsFallbackAttemptWithoutOutput(t *testing.T) {
	applyFallbackModelRates(t)

	ctx := refusalTestContext(t, false)
	relayInfo := refusalTestRelayInfo(refusalTestPriceData())

	// The refused hop emitted no output, so its 535 input tokens are reported
	// but not charged.
	usage := claudeFallbackUsage(
		[]dto.ClaudeUsageIteration{
			{Type: "message", Model: "claude-opus-5", InputTokens: 535, OutputTokens: 0},
			{Type: "fallback_message", Model: "claude-opus-4-8", InputTokens: 200, OutputTokens: 10},
		},
		dto.ClaudeUsageIteration{InputTokens: 200, OutputTokens: 10},
	)

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)

	require.Len(t, summary.FallbackIterations, 1)
	// only hop 2: (200 + 10*5) * 3 = 750
	assert.Equal(t, 750, summary.Quota)
}

func TestCalculateTextQuotaSummaryFallbackIterationChargesCacheAtIterationRates(t *testing.T) {
	applyFallbackModelRates(t)

	ctx := refusalTestContext(t, false)
	relayInfo := refusalTestRelayInfo(refusalTestPriceData())

	usage := claudeFallbackUsage(
		[]dto.ClaudeUsageIteration{
			{
				Type:                     "fallback_message",
				Model:                    "claude-opus-4-8",
				InputTokens:              100,
				CacheReadInputTokens:     200,
				CacheCreationInputTokens: 40,
				OutputTokens:             10,
			},
		},
		dto.ClaudeUsageIteration{InputTokens: 100, OutputTokens: 10},
	)

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)

	// Cache rates come from the serving model, not the requested one:
	// (100 + 200*0.5 + 40*2 + 10*5) * 3 = 990
	assert.Equal(t, 990, summary.Quota)
}

func TestResolveClaudeIterationPricingUsesTheModelThatRanTheAttempt(t *testing.T) {
	applyFallbackModelRates(t)

	ctx := refusalTestContext(t, false)
	relayInfo := refusalTestRelayInfo(refusalTestPriceData())

	pricing := resolveClaudeIterationPricing(ctx, relayInfo, "claude-opus-4-8")

	assert.Equal(t, float64(3), pricing.ModelRatio)
	assert.Equal(t, 0.5, pricing.CacheRatio)
	assert.Equal(t, float64(2), pricing.CacheCreationRatio5m)
	assert.Equal(t, 2*ratio_setting.ClaudeCacheCreation1hMultiplier, pricing.CacheCreationRatio1h)
}

// An unpriced fallback model must not silently make the attempt free.
func TestResolveClaudeIterationPricingFallsBackToRequestedModelRates(t *testing.T) {
	ctx := refusalTestContext(t, false)
	relayInfo := refusalTestRelayInfo(refusalTestPriceData())

	pricing := resolveClaudeIterationPricing(ctx, relayInfo, "some-unpriced-model")

	assert.Equal(t, relayInfo.PriceData.ModelRatio, pricing.ModelRatio)
	assert.Equal(t, relayInfo.PriceData.CompletionRatio, pricing.CompletionRatio)
	assert.Equal(t, relayInfo.PriceData.CacheRatio, pricing.CacheRatio)
}

func TestClaudeBillableIterationsIgnoresResponsesWithoutBreakdown(t *testing.T) {
	assert.Nil(t, claudeBillableIterations(nil))
	assert.Nil(t, claudeBillableIterations(claudeRefusalUsage(412, 0)))
}
