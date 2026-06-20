package service

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestCalculateTextQuotaSummaryUnifiedForClaudeSemantic(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)

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

	priceData := types.PriceData{
		ModelRatio:           1,
		CompletionRatio:      2,
		CacheRatio:           0.1,
		CacheCreationRatio:   1.25,
		CacheCreation5mRatio: 1.25,
		CacheCreation1hRatio: 2,
		GroupRatioInfo: types.GroupRatioInfo{
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
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)

	relayInfo := &relaycommon.RelayInfo{
		RelayFormat:             types.RelayFormatOpenAI,
		FinalRequestRelayFormat: types.RelayFormatClaude,
		OriginModelName:         "claude-3-7-sonnet",
		PriceData: types.PriceData{
			ModelRatio:           1,
			CompletionRatio:      1,
			CacheRatio:           0,
			CacheCreationRatio:   1,
			CacheCreation5mRatio: 2,
			CacheCreation1hRatio: 3,
			GroupRatioInfo: types.GroupRatioInfo{
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
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)

	relayInfo := &relaycommon.RelayInfo{
		RelayFormat:     types.RelayFormatOpenAI,
		OriginModelName: "claude-3-7-sonnet",
		PriceData: types.PriceData{
			ModelRatio:           1,
			CompletionRatio:      2,
			CacheRatio:           0.1,
			CacheCreationRatio:   1.25,
			CacheCreation5mRatio: 1.25,
			CacheCreation1hRatio: 2,
			GroupRatioInfo: types.GroupRatioInfo{
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
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)

	relayInfo := &relaycommon.RelayInfo{
		RelayFormat:     types.RelayFormatOpenAI,
		OriginModelName: "claude-3-7-sonnet",
		PriceData: types.PriceData{
			ModelRatio:           1,
			CompletionRatio:      5,
			CacheRatio:           0.1,
			CacheCreationRatio:   1.25,
			CacheCreation5mRatio: 1.25,
			CacheCreation1hRatio: 2,
			GroupRatioInfo:       types.GroupRatioInfo{GroupRatio: 1},
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

func TestCalculateTextQuotaSummarySeparatesOpenRouterCacheReadFromPromptBilling(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)

	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "openai/gpt-4.1",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeOpenRouter,
		},
		PriceData: types.PriceData{
			ModelRatio:         1,
			CompletionRatio:    1,
			CacheRatio:         0.1,
			CacheCreationRatio: 1.25,
			GroupRatioInfo:     types.GroupRatioInfo{GroupRatio: 1},
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
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)

	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "openai/gpt-4.1",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeOpenRouter,
		},
		PriceData: types.PriceData{
			ModelRatio:         1,
			CompletionRatio:    1,
			CacheCreationRatio: 1.25,
			GroupRatioInfo:     types.GroupRatioInfo{GroupRatio: 1},
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
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)

	relayInfo := &relaycommon.RelayInfo{
		FinalRequestRelayFormat: types.RelayFormatClaude,
		OriginModelName:         "anthropic/claude-3.7-sonnet",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeOpenRouter,
		},
		PriceData: types.PriceData{
			ModelRatio:         1,
			CompletionRatio:    1,
			CacheRatio:         0.1,
			CacheCreationRatio: 1.25,
			GroupRatioInfo:     types.GroupRatioInfo{GroupRatio: 1},
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
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	ctx.Set("image_generation_call", true)
	ctx.Set("image_generation_call_quality", "low")
	ctx.Set("image_generation_call_size", "1024x1024")

	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "o1",
		PriceData: types.PriceData{
			ModelRatio:      1,
			CompletionRatio: 1,
			GroupRatioInfo:  types.GroupRatioInfo{GroupRatio: 1},
		},
		ResponsesUsageInfo: &relaycommon.ResponsesUsageInfo{
			BuiltInTools: map[string]*relaycommon.BuildInToolInfo{
				dto.BuildInToolWebSearchPreview: &relaycommon.BuildInToolInfo{
					CallCount: 1,
				},
				dto.BuildInToolFileSearch: &relaycommon.BuildInToolInfo{
					CallCount: 2,
				},
			},
		},
		TieredBillingSnapshot: &billingexpr.BillingSnapshot{
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
	quota := composeTieredTextQuota(relayInfo, summary, 1000, &billingexpr.TieredResult{
		ActualQuotaBeforeGroup: 1000,
		ActualQuotaAfterGroup:  1000,
	})

	require.Equal(t, int64(13000), summary.ToolCallSurchargeQuota.Round(0).IntPart())
	require.Equal(t, 14000, quota)
}

func TestComposeTieredTextQuotaFallbackKeepsToolCallSurcharges(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	ctx.Set("claude_web_search_requests", 2)

	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "claude-3-7-sonnet",
		PriceData: types.PriceData{
			ModelRatio:      1,
			CompletionRatio: 1,
			GroupRatioInfo:  types.GroupRatioInfo{GroupRatio: 1.25},
		},
		TieredBillingSnapshot: &billingexpr.BillingSnapshot{
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
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	ctx.Set("claude_web_search_requests", 2)

	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "claude-3-7-sonnet",
		PriceData: types.PriceData{
			ModelRatio:      1,
			CompletionRatio: 1,
			GroupRatioInfo:  types.GroupRatioInfo{GroupRatio: 1.25},
		},
		TieredBillingSnapshot: &billingexpr.BillingSnapshot{
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

// ── PostTextConsumeQuota — billing webhook dispatch gate (V4.3) ─────────────
//
// PostTextConsumeQuota dispatches the per-tenant billing webhook
// (dispatchAirbotixBilling) only when SettleBilling succeeds AND
// summary.TotalTokens > 0. For usage == nil, calculateTextQuotaSummary falls
// back to relayInfo.GetEstimatePromptTokens() for its summary, but that
// fallback usage is local to calculateTextQuotaSummary and does not propagate
// back to PostTextConsumeQuota's usage variable — so PostTextConsumeQuota must
// build its own billingUsage from summary in that case.
//
// Test infrastructure reused from airbotix_billing_test.go (same package):
// billingTestCtx, newWebhookServer, testUsage, decodeEvent, testSecret.

// TestPostTextConsumeQuota_DispatchesBillingWebhookForEstimatedUsageWhenUsageNil
// verifies that when usage == nil but the estimated prompt tokens are > 0, the
// webhook fires with prompt_tokens/completion_tokens taken from the summary's
// estimate (not from usage, which remains nil).
func TestPostTextConsumeQuota_DispatchesBillingWebhookForEstimatedUsageWhenUsageNil(t *testing.T) {
	ws := newWebhookServer(t, 200)
	ctx := billingTestCtx(ws.URL, testSecret, "")

	relayInfo := &relaycommon.RelayInfo{
		RequestId:       "req-nil-usage-estimate",
		OriginModelName: "gpt-4o-mini",
		StartTime:       time.Now().Add(-2 * time.Second),
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeOpenAI,
		},
		PriceData:             types.PriceData{},
		FinalPreConsumedQuota: 0,
	}
	relayInfo.SetEstimatePromptTokens(120)

	PostTextConsumeQuota(ctx, relayInfo, nil, nil)

	if !ws.waitHits(1, 2*time.Second) {
		t.Fatal("webhook was not called for usage == nil with estimated tokens > 0")
	}

	ev := decodeEvent(t, ws)
	if ev.PromptTokens != 120 {
		t.Errorf("PromptTokens: want 120 (estimate), got %d", ev.PromptTokens)
	}
	if ev.CompletionTokens != 0 {
		t.Errorf("CompletionTokens: want 0, got %d", ev.CompletionTokens)
	}
}

// TestPostTextConsumeQuota_SkipsBillingWebhookWhenTotalTokensZero verifies that
// the webhook does not fire when summary.TotalTokens == 0, even though
// SettleBilling succeeds.
func TestPostTextConsumeQuota_SkipsBillingWebhookWhenTotalTokensZero(t *testing.T) {
	ws := newWebhookServer(t, 200)
	ctx := billingTestCtx(ws.URL, testSecret, "")

	relayInfo := &relaycommon.RelayInfo{
		RequestId:       "req-zero-tokens",
		OriginModelName: "gpt-4o-mini",
		StartTime:       time.Now().Add(-2 * time.Second),
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeOpenAI,
		},
		PriceData:             types.PriceData{},
		FinalPreConsumedQuota: 0,
	}

	PostTextConsumeQuota(ctx, relayInfo, testUsage(0, 0), nil)

	time.Sleep(150 * time.Millisecond)
	if got := ws.hits.Load(); got != 0 {
		t.Errorf("expected no webhook call for zero total tokens, got %d", got)
	}
}

// TestPostTextConsumeQuota_DispatchesBillingWebhookWhenSettleBillingSucceeds
// verifies the ordinary non-nil-usage path: SettleBilling succeeds, TotalTokens
// > 0, and the webhook payload reflects the original usage (not an estimate).
func TestPostTextConsumeQuota_DispatchesBillingWebhookWhenSettleBillingSucceeds(t *testing.T) {
	ws := newWebhookServer(t, 200)
	ctx := billingTestCtx(ws.URL, testSecret, "")

	relayInfo := &relaycommon.RelayInfo{
		RequestId:       "req-settle-success",
		OriginModelName: "gpt-4o-mini",
		StartTime:       time.Now().Add(-2 * time.Second),
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeOpenAI,
		},
		PriceData:             types.PriceData{},
		FinalPreConsumedQuota: 0,
	}

	PostTextConsumeQuota(ctx, relayInfo, testUsage(150, 80), nil)

	if !ws.waitHits(1, 2*time.Second) {
		t.Fatal("webhook was not called when SettleBilling succeeds")
	}

	ev := decodeEvent(t, ws)
	if ev.PromptTokens != 150 {
		t.Errorf("PromptTokens: want 150 (from usage), got %d", ev.PromptTokens)
	}
	if ev.CompletionTokens != 80 {
		t.Errorf("CompletionTokens: want 80 (from usage), got %d", ev.CompletionTokens)
	}
}

// TestPostTextConsumeQuota_SkipsBillingWebhookWhenSettleBillingFails verifies
// that the webhook does not fire when SettleBilling returns an error, even
// though TotalTokens > 0.
func TestPostTextConsumeQuota_SkipsBillingWebhookWhenSettleBillingFails(t *testing.T) {
	ws := newWebhookServer(t, 200)
	ctx := billingTestCtx(ws.URL, testSecret, "")

	relayInfo := &relaycommon.RelayInfo{
		RequestId:       "req-settle-fail",
		OriginModelName: "gpt-4o-mini",
		StartTime:       time.Now().Add(-2 * time.Second),
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeOpenAI,
		},
		PriceData: types.PriceData{},
		// FinalPreConsumedQuota != settled quota (0), so SettleBilling falls
		// through to PostConsumeQuota instead of short-circuiting on
		// quotaDelta == 0.
		FinalPreConsumedQuota: 100,
		BillingSource:         BillingSourceSubscription,
		SubscriptionId:        0, // PostConsumeQuota returns "subscription id is missing"
	}

	PostTextConsumeQuota(ctx, relayInfo, testUsage(150, 80), nil)

	time.Sleep(150 * time.Millisecond)
	if got := ws.hits.Load(); got != 0 {
		t.Errorf("expected no webhook call when SettleBilling fails, got %d", got)
	}
}

// TestPostTextConsumeQuota_FallbackDispatchesBillingWebhookOnSuccess covers the
// usage == nil / SettleBilling-succeeds combination with a non-zero settled
// quota (unlike TestPostTextConsumeQuota_DispatchesBillingWebhookForEstimatedUsageWhenUsageNil,
// which uses a zero PriceData), verifying the billingUsage fallback also
// produces a correct non-zero cost_usd.
func TestPostTextConsumeQuota_FallbackDispatchesBillingWebhookOnSuccess(t *testing.T) {
	ws := newWebhookServer(t, 200)
	ctx := billingTestCtx(ws.URL, testSecret, "")

	relayInfo := &relaycommon.RelayInfo{
		RequestId:       "req-nil-usage-nonzero-quota",
		OriginModelName: "gpt-4o-mini",
		StartTime:       time.Now().Add(-2 * time.Second),
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeOpenAI,
		},
		PriceData: types.PriceData{
			ModelRatio:     1,
			GroupRatioInfo: types.GroupRatioInfo{GroupRatio: 1},
		},
		// Matches the settled quota for 1000 estimated prompt tokens at
		// ModelRatio * GroupRatio == 1, so quotaDelta == 0 (SettleBilling
		// succeeds) while summary.Quota != 0.
		FinalPreConsumedQuota: 1000,
	}
	relayInfo.SetEstimatePromptTokens(1000)

	PostTextConsumeQuota(ctx, relayInfo, nil, nil)

	if !ws.waitHits(1, 2*time.Second) {
		t.Fatal("webhook was not called for usage == nil with non-zero settled quota")
	}

	ev := decodeEvent(t, ws)
	if ev.PromptTokens != 1000 {
		t.Errorf("PromptTokens: want 1000 (estimate), got %d", ev.PromptTokens)
	}
	if ev.CostUSD == 0 {
		t.Error("CostUSD: want non-zero for a non-zero settled quota, got 0")
	}
}

// TestPostTextConsumeQuota_FallbackSkipsBillingWebhookOnError covers the
// usage == nil / SettleBilling-fails combination (the counterpart to
// TestPostTextConsumeQuota_SkipsBillingWebhookWhenSettleBillingFails, which
// uses non-nil usage): the webhook must not fire regardless of the estimated
// TotalTokens.
func TestPostTextConsumeQuota_FallbackSkipsBillingWebhookOnError(t *testing.T) {
	ws := newWebhookServer(t, 200)
	ctx := billingTestCtx(ws.URL, testSecret, "")

	relayInfo := &relaycommon.RelayInfo{
		RequestId:       "req-nil-usage-settle-fail",
		OriginModelName: "gpt-4o-mini",
		StartTime:       time.Now().Add(-2 * time.Second),
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeOpenAI,
		},
		PriceData:             types.PriceData{},
		FinalPreConsumedQuota: 100,
		BillingSource:         BillingSourceSubscription,
		SubscriptionId:        0,
	}
	relayInfo.SetEstimatePromptTokens(120)

	PostTextConsumeQuota(ctx, relayInfo, nil, nil)

	time.Sleep(150 * time.Millisecond)
	if got := ws.hits.Load(); got != 0 {
		t.Errorf("expected no webhook call when SettleBilling fails for usage == nil, got %d", got)
	}
}
