package service

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	hosttypes "github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConsumeLogPromptTokensPreservesOpenRouterInputTotal(t *testing.T) {
	for _, tc := range []struct {
		name       string
		cacheWrite int
		cache5m    int
		cache1h    int
		wantQuota  int
	}{
		{name: "no cache writes", wantQuota: 960},
		{name: "aggregate only", cacheWrite: 40, wantQuota: 970},
		{name: "5m only without aggregate", cache5m: 10, wantQuota: 972},
		{name: "1h only without aggregate", cache1h: 20, wantQuota: 1000},
		{name: "split writes without aggregate", cache5m: 10, cache1h: 20, wantQuota: 1012},
		{name: "aggregate smaller than split writes", cacheWrite: 10, cache5m: 10, cache1h: 20, wantQuota: 1002},
		{name: "aggregate equals split writes", cacheWrite: 30, cache5m: 10, cache1h: 20, wantQuota: 982},
		{name: "aggregate includes unsplit writes", cacheWrite: 40, cache5m: 10, cache1h: 20, wantQuota: 985},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			info := &relaycommon.RelayInfo{
				FinalRequestRelayFormat: types.RelayFormatClaude,
				OriginModelName:         "anthropic/claude-3.7-sonnet",
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelType: constant.ChannelTypeOpenRouter,
				},
				PriceData: hosttypes.PriceData{
					ModelRatio:           1,
					CompletionRatio:      1,
					CacheRatio:           0.1,
					CacheCreationRatio:   1.25,
					CacheCreation5mRatio: 1.25,
					CacheCreation1hRatio: 2,
					GroupRatioInfo:       hosttypes.GroupRatioInfo{GroupRatio: 1},
				},
				StartTime: time.Now(),
			}
			usage := &dto.Usage{
				PromptTokens:     1000,
				CompletionTokens: 50,
				PromptTokensDetails: dto.InputTokenDetails{
					CachedTokens:         100,
					CachedCreationTokens: tc.cacheWrite,
				},
				ClaudeCacheCreation5mTokens: tc.cache5m,
				ClaudeCacheCreation1hTokens: tc.cache1h,
			}
			originalUsage := *usage
			summary := calculateTextQuotaSummary(ctx, info, usage)

			// Preserve the existing OpenRouter billing adjustment even when the
			// upstream aggregate and split counts disagree. Logging must undo
			// that exact adjustment rather than silently changing the charge.
			require.True(t, summary.IsClaudeUsageSemantic)
			assert.Equal(t, 900-tc.cacheWrite, summary.PromptTokens)
			assert.Equal(t, tc.wantQuota, summary.Quota)
			assert.Equal(t, 1000, summary.consumeLogPromptTokens())
			assert.Equal(t, 1050, summary.consumeLogPromptTokens()+summary.CompletionTokens)
			assert.Equal(t, originalUsage, *usage, "logging must not mutate upstream usage")
			assert.Equal(t, 1000, summary.consumeLogPromptTokens(), "repeated reads must not add cache twice")
		})
	}
}

func TestConsumeLogPromptTokensKeepsProviderUsageSemantics(t *testing.T) {
	for _, tc := range []struct {
		name      string
		semantic  string
		channel   *relaycommon.ChannelMeta
		wantInput int
	}{
		{name: "native anthropic split writes", semantic: "anthropic", wantInput: 1130},
		{name: "explicit openai semantic overrides claude relay format", semantic: "openai", wantInput: 1000},
		{name: "openrouter explicit openai semantic", semantic: "openai", channel: &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeOpenRouter}, wantInput: 1000},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			info := &relaycommon.RelayInfo{
				FinalRequestRelayFormat: types.RelayFormatClaude,
				OriginModelName:         "claude-3.7-sonnet",
				ChannelMeta:             tc.channel,
				StartTime:               time.Now(),
			}
			usage := &dto.Usage{
				UsageSemantic:    tc.semantic,
				PromptTokens:     1000,
				CompletionTokens: 50,
				PromptTokensDetails: dto.InputTokenDetails{
					CachedTokens: 100,
				},
				ClaudeCacheCreation5mTokens: 10,
				ClaudeCacheCreation1hTokens: 20,
			}
			summary := calculateTextQuotaSummary(ctx, info, usage)
			assert.Equal(t, tc.wantInput, summary.consumeLogPromptTokens())
			assert.Equal(t, 1000, summary.PromptTokens, "the log total must not replace billing input")
		})
	}
}
