package service

import (
	"fmt"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// hwChannelAffinityTestSeq keeps every cache name in this file unique for the
// whole process, so a second run (-count) starts from an empty entry again.
var hwChannelAffinityTestSeq atomic.Int64

func hwChannelAffinityTestName(prefix string, t *testing.T) string {
	return fmt.Sprintf("%s_%s_%d", prefix, t.Name(), hwChannelAffinityTestSeq.Add(1))
}

func hwChannelAffinityStatsContext(t *testing.T) (*gin.Context, string, string, string) {
	t.Helper()
	ruleName := hwChannelAffinityTestName("hwrule", t)
	keyFP := hwChannelAffinityTestName("hwfp", t)
	usingGroup := "default"
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	setChannelAffinityContext(ctx, channelAffinityMeta{
		CacheKey:       fmt.Sprintf("test:%s:%s:%s", ruleName, usingGroup, keyFP),
		TTLSeconds:     600,
		RuleName:       ruleName,
		UsingGroup:     usingGroup,
		KeyFingerprint: keyFP,
	})
	return ctx, ruleName, usingGroup, keyFP
}

// A fresh cache name must start at zero, so two runs of the same test never add
// their counters together. This is the bug the unique names guard against.
func TestHwChannelAffinityFreshNameStartsEmpty(t *testing.T) {
	ctx, ruleName, usingGroup, keyFP := hwChannelAffinityStatsContext(t)
	stats := GetChannelAffinityUsageCacheStats(ruleName, usingGroup, keyFP)
	require.EqualValues(t, 0, stats.Total)
	require.EqualValues(t, 0, stats.Hit)

	usage := &dto.Usage{
		PromptTokens:        10,
		CompletionTokens:    4,
		TotalTokens:         14,
		PromptTokensDetails: dto.InputTokenDetails{CachedTokens: 3},
	}
	ObserveChannelAffinityUsageCacheByRelayFormat(ctx, usage, types.RelayFormatClaude)
	stats = GetChannelAffinityUsageCacheStats(ruleName, usingGroup, keyFP)
	assert.EqualValues(t, 1, stats.Total)
	assert.EqualValues(t, 1, stats.Hit)
}

// Two observations with different cache names stay independent, even though the
// process-wide stats cache outlives a single test.
func TestHwChannelAffinityNamesStayIndependent(t *testing.T) {
	firstCtx, firstRule, group, firstFP := hwChannelAffinityStatsContext(t)
	secondCtx, secondRule, _, secondFP := hwChannelAffinityStatsContext(t)
	require.NotEqual(t, firstRule, secondRule)
	require.NotEqual(t, firstFP, secondFP)

	ObserveChannelAffinityUsageCacheByRelayFormat(firstCtx, &dto.Usage{PromptTokens: 5}, types.RelayFormatOpenAI)
	ObserveChannelAffinityUsageCacheByRelayFormat(secondCtx, &dto.Usage{PromptTokens: 7}, types.RelayFormatOpenAI)
	ObserveChannelAffinityUsageCacheByRelayFormat(secondCtx, &dto.Usage{PromptTokens: 7}, types.RelayFormatOpenAI)

	firstStats := GetChannelAffinityUsageCacheStats(firstRule, group, firstFP)
	secondStats := GetChannelAffinityUsageCacheStats(secondRule, group, secondFP)
	assert.EqualValues(t, 1, firstStats.Total)
	assert.EqualValues(t, 2, secondStats.Total)
}

// The shared name helper must never hand out the same name twice.
func TestHwChannelAffinityTestNameIsUnique(t *testing.T) {
	seen := make(map[string]struct{}, 100)
	for range 100 {
		name := hwChannelAffinityTestName("hwseq", t)
		_, dubbel := seen[name]
		require.False(t, dubbel, "dubbele cachenaam %q", name)
		seen[name] = struct{}{}
	}
}
