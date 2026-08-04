package perfmetrics

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResolveAdminPeriodsUsesCompleteBuckets(t *testing.T) {
	actual, previous := resolveAdminPeriods(3660, 14430, 3600)

	assert.Equal(t, AdminTimeRange{Start: 7200, End: 14400}, actual)
	assert.Equal(t, AdminTimeRange{Start: 0, End: 7200}, previous)
}

func TestResolveAdminPeriodsReportsRangeWithoutCompleteBucket(t *testing.T) {
	actual, previous := resolveAdminPeriods(3660, 7199, 3600)

	assert.Equal(t, AdminTimeRange{Start: 7200, End: 7200}, actual)
	assert.Equal(t, actual, previous)
}

func TestClassifyAdminHealth(t *testing.T) {
	tests := []struct {
		name           string
		current        counters
		previous       counters
		expectedHealth AdminHealth
		expectedReason string
	}{
		{name: "no samples", expectedHealth: AdminHealthNoSamples, expectedReason: "no_samples"},
		{name: "insufficient samples", current: counters{requestCount: 19, successCount: 19}, expectedHealth: AdminHealthInsufficientSamples, expectedReason: "insufficient_samples"},
		{name: "critical success rate", current: counters{requestCount: 20, successCount: 17}, expectedHealth: AdminHealthCritical, expectedReason: "success_rate_critical"},
		{name: "degraded success rate", current: counters{requestCount: 20, successCount: 19}, expectedHealth: AdminHealthDegraded, expectedReason: "success_rate_degraded"},
		{name: "latency regression", current: counters{requestCount: 20, successCount: 20, totalLatencyMs: 30000}, previous: counters{requestCount: 20, successCount: 20, totalLatencyMs: 20000}, expectedHealth: AdminHealthDegraded, expectedReason: "latency_regression"},
		{name: "ttft regression", current: counters{requestCount: 20, successCount: 20, ttftCount: 10, ttftSumMs: 9000}, previous: counters{requestCount: 20, successCount: 20, ttftCount: 10, ttftSumMs: 6000}, expectedHealth: AdminHealthDegraded, expectedReason: "ttft_regression"},
		{name: "tps regression", current: counters{requestCount: 20, successCount: 20, outputTokens: 100, generationMs: 2000}, previous: counters{requestCount: 20, successCount: 20, outputTokens: 100, generationMs: 1000}, expectedHealth: AdminHealthDegraded, expectedReason: "tps_regression"},
		{name: "healthy", current: counters{requestCount: 20, successCount: 20, totalLatencyMs: 20000}, previous: counters{requestCount: 20, successCount: 20, totalLatencyMs: 20000}, expectedHealth: AdminHealthHealthy},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			health, reasons := classifyAdminHealth(tt.current, tt.previous)
			assert.Equal(t, tt.expectedHealth, health)
			if tt.expectedReason != "" {
				assert.Contains(t, reasons, tt.expectedReason)
			} else {
				assert.Empty(t, reasons)
			}
		})
	}
}

func TestBuildAdminChangesRequiresMetricSpecificSamples(t *testing.T) {
	current := counters{
		requestCount:   20,
		successCount:   20,
		totalLatencyMs: 20000,
		ttftCount:      10,
		ttftSumMs:      5000,
		outputTokens:   100,
		generationMs:   2000,
	}
	previous := counters{
		requestCount:   19,
		successCount:   19,
		totalLatencyMs: 19000,
		ttftCount:      9,
		ttftSumMs:      4500,
		outputTokens:   99,
		generationMs:   2000,
	}

	changes := buildAdminChanges(current, previous)

	assert.Nil(t, changes.RequestCountPct)
	assert.Nil(t, changes.SuccessRatePp)
	assert.Nil(t, changes.AvgLatencyPct)
	assert.Nil(t, changes.AvgTtftPct)
	assert.Nil(t, changes.AvgTpsPct)
}

func TestBuildAdminModelsIncludesEnabledAndCurrentlySampledModels(t *testing.T) {
	current := map[modelGroupKey]counters{
		{model: "sampled-disabled", group: "legacy"}: {
			requestCount: 20,
			successCount: 20,
		},
	}
	previous := map[modelGroupKey]counters{
		{model: "previous-only", group: "legacy"}: {
			requestCount: 20,
			successCount: 20,
		},
	}
	abilities := []model.Ability{
		{Model: "enabled-no-samples", Group: "default", Enabled: true, ChannelId: 1},
		{Model: "enabled-no-samples", Group: "default", Enabled: true, ChannelId: 2},
	}

	models := buildAdminModels(current, previous, abilities)

	require.Len(t, models, 2)
	assert.Equal(t, "sampled-disabled", models[0].ModelName)
	assert.False(t, models[0].Enabled)
	require.Len(t, models[0].Groups, 1)
	assert.Equal(t, "legacy", models[0].Groups[0].Group)
	assert.False(t, models[0].Groups[0].Enabled)
	assert.Equal(t, "enabled-no-samples", models[1].ModelName)
	assert.True(t, models[1].Enabled)
	assert.Equal(t, AdminHealthNoSamples, models[1].Health)
	assert.NotContains(t, []string{models[0].ModelName, models[1].ModelName}, "previous-only")
}
