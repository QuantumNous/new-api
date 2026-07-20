package model

import (
	"net/http"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func useDefaultSlowLatencyThreshold(t *testing.T) {
	t.Helper()
	old := common.ChannelHealthSlowLatencySeconds
	common.ChannelHealthSlowLatencySeconds = defaultChannelHealthSlowLatencySeconds
	t.Cleanup(func() { common.ChannelHealthSlowLatencySeconds = old })
}

func recordSelectionSlowChannel(key ChannelHealthKey) {
	for i := 0; i < channelHealthPriorityDemotionThreshold; i++ {
		RecordChannelOutcome(key, ChannelOutcome{
			StatusCode: http.StatusOK,
			Latency:    channelHealthSlowLatency() + time.Second,
		})
	}
}

func TestChannelHealthPriorityDemotionNeedsRepeatedRecentSlowness(t *testing.T) {
	useDefaultSlowLatencyThreshold(t)
	health, clock := newTestChannelHealth(t)
	key := ChannelHealthKey{ChannelID: 17, Model: "gpt-5.6-sol", Path: "/v1/responses"}
	slow := channelHealthSlowLatency() + time.Second

	health.Record(key, ChannelOutcome{StatusCode: http.StatusOK, Latency: slow})
	assert.False(t, health.shouldDemotePriority(key), "one slow response must not override configured priority")

	health.Record(key, ChannelOutcome{StatusCode: http.StatusOK, Latency: slow})
	require.Equal(t, ChannelHealthClosed, health.State(key), "soft demotion must happen before the slow circuit opens")
	assert.True(t, health.shouldDemotePriority(key), "repeated recent slowness should lower selection priority")

	clock.Advance(channelHealthFailureWindow + time.Nanosecond)
	assert.False(t, health.shouldDemotePriority(key), "stale slowness should allow one recovery probe")
	assert.True(t, health.entries[key].priorityDemoted, "a probe lease must not erase the recovery evidence")
	assert.True(t, health.shouldDemotePriority(key), "other requests must remain demoted while the probe lease is active")

	health.Record(key, ChannelOutcome{StatusCode: http.StatusOK, Latency: slow})
	health.Record(key, ChannelOutcome{StatusCode: http.StatusOK, Latency: slow})
	require.True(t, health.shouldDemotePriority(key))
	health.Record(key, ChannelOutcome{StatusCode: http.StatusOK, Latency: 500 * time.Millisecond})
	assert.True(t, health.shouldDemotePriority(key), "one fast response must not flap priority back immediately")
	health.Record(key, ChannelOutcome{StatusCode: http.StatusOK, Latency: 500 * time.Millisecond})
	assert.False(t, health.shouldDemotePriority(key), "repeated fast responses should restore configured priority")
}

func TestChannelHealthPriorityDemotionSurvivesSlowCircuitRecoveryUntilHealthy(t *testing.T) {
	useDefaultSlowLatencyThreshold(t)
	health, clock := newTestChannelHealth(t)
	key := ChannelHealthKey{ChannelID: 17, Model: "gpt-5.6-sol", Path: "/v1/responses"}
	slow := channelHealthSlowLatency() + time.Second
	fast := 500 * time.Millisecond

	for i := 0; i < channelHealthSlowThreshold; i++ {
		health.Record(key, ChannelOutcome{StatusCode: http.StatusOK, Latency: slow})
	}
	require.Equal(t, ChannelHealthOpen, health.State(key))
	require.True(t, health.entries[key].priorityDemoted, "slow circuit recovery must retain the soft demotion")

	clock.Advance(channelHealthOpenDuration)
	require.True(t, health.Acquire(key), "expected a half-open recovery probe")
	health.Record(key, ChannelOutcome{StatusCode: http.StatusOK, Latency: fast})
	assert.Equal(t, ChannelHealthClosed, health.State(key))
	assert.True(t, health.shouldDemotePriority(key), "one fast probe must not restore the original priority tier")

	health.Record(key, ChannelOutcome{StatusCode: http.StatusOK, Latency: fast})
	assert.False(t, health.shouldDemotePriority(key), "healthy consecutive probes should restore the original priority tier")
}

func TestChannelHealthPriorityRecoveryRequiresConsecutiveScoredFastResponses(t *testing.T) {
	useDefaultSlowLatencyThreshold(t)
	fast := 500 * time.Millisecond

	t.Run("upstream failure breaks the streak", func(t *testing.T) {
		health, _ := newTestChannelHealth(t)
		key := ChannelHealthKey{ChannelID: 17, Model: "gpt-5.6-sol", Path: "/v1/responses"}
		for i := 0; i < channelHealthPriorityDemotionThreshold; i++ {
			health.Record(key, ChannelOutcome{StatusCode: http.StatusOK, Latency: channelHealthSlowLatency() + time.Second})
		}
		require.True(t, health.shouldDemotePriority(key))

		health.Record(key, ChannelOutcome{StatusCode: http.StatusOK, Latency: fast})
		health.Record(key, ChannelOutcome{StatusCode: http.StatusServiceUnavailable})
		health.Record(key, ChannelOutcome{StatusCode: http.StatusOK, Latency: fast})
		assert.True(t, health.shouldDemotePriority(key), "a failure must reset, not preserve, the fast recovery streak")

		health.Record(key, ChannelOutcome{StatusCode: http.StatusOK, Latency: fast})
		assert.False(t, health.shouldDemotePriority(key))
	})

	for _, tc := range []struct {
		name    string
		outcome ChannelOutcome
	}{
		{
			name: "cold-cache success breaks the streak",
			outcome: ChannelOutcome{
				StatusCode:     http.StatusOK,
				Latency:        30 * time.Second,
				ColdCacheStart: true,
			},
		},
		{
			name:    "missing latency breaks the streak",
			outcome: ChannelOutcome{StatusCode: http.StatusOK},
		},
		{
			name:    "local error breaks the streak",
			outcome: ChannelOutcome{StatusCode: http.StatusInternalServerError, LocalError: true},
		},
		{
			name:    "semantic error breaks the streak",
			outcome: ChannelOutcome{StatusCode: http.StatusInternalServerError, SemanticError: true},
		},
		{
			name:    "client error breaks the streak",
			outcome: ChannelOutcome{StatusCode: http.StatusBadRequest},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			health, _ := newTestChannelHealth(t)
			key := ChannelHealthKey{ChannelID: 17, Model: "gpt-5.6-sol", Path: "/v1/responses"}
			for i := 0; i < channelHealthPriorityDemotionThreshold; i++ {
				health.Record(key, ChannelOutcome{StatusCode: http.StatusOK, Latency: channelHealthSlowLatency() + time.Second})
			}
			require.True(t, health.shouldDemotePriority(key))

			health.Record(key, ChannelOutcome{StatusCode: http.StatusOK, Latency: fast})
			health.Record(key, tc.outcome)
			health.Record(key, ChannelOutcome{StatusCode: http.StatusOK, Latency: fast})
			assert.True(t, health.shouldDemotePriority(key), "an unscored result must reset, not preserve, the fast recovery streak")

			health.Record(key, ChannelOutcome{StatusCode: http.StatusOK, Latency: fast})
			assert.False(t, health.shouldDemotePriority(key))
		})
	}
}

func TestChannelHealthPriorityDemotionIgnoresColdCacheStarts(t *testing.T) {
	useDefaultSlowLatencyThreshold(t)
	health, _ := newTestChannelHealth(t)
	key := ChannelHealthKey{ChannelID: 17, Model: "gpt-5.6-sol", Path: "/v1/responses"}

	for i := 0; i < channelHealthPriorityDemotionThreshold+1; i++ {
		health.Record(key, ChannelOutcome{
			StatusCode:     http.StatusOK,
			Latency:        30 * time.Second,
			ColdCacheStart: true,
		})
	}

	assert.False(t, health.shouldDemotePriority(key), "gateway-induced cold prefill must not lower channel priority")
}

func TestSlowChannelMovesDownOnlyOneConfiguredPriorityTier(t *testing.T) {
	useDefaultSlowLatencyThreshold(t)
	withGlobalChannelHealth(t)
	path := "/v1/responses"
	slowHigh := ChannelHealthKey{ChannelID: 17, Model: "gpt-5.6-sol", Path: path}
	slowLowest := ChannelHealthKey{ChannelID: 41, Model: "gpt-5.6-sol", Path: path}
	recordSelectionSlowChannel(slowHigh)
	recordSelectionSlowChannel(slowLowest)

	priorities, ranks := buildChannelPriorityRanks([]channelPriorityCandidate{
		{channelID: 17, priority: 30},
		{channelID: 29, priority: 20},
		{channelID: 41, priority: 10},
	}, "gpt-5.6-sol", path)

	assert.Equal(t, []int{30, 20, 10}, priorities)
	assert.Equal(t, 1, ranks[17], "slow highest-priority channel should move down exactly one tier")
	assert.Equal(t, 1, ranks[29], "healthy configured priority must stay unchanged")
	assert.Equal(t, 2, ranks[41], "lowest-priority channel must remain selectable")
}

func TestCachedSelectorRestoresConfiguredPriorityAfterSlowChannelRecovers(t *testing.T) {
	useDefaultSlowLatencyThreshold(t)
	withGlobalChannelHealth(t)
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	ClearChannelCacheForTest()
	clearChannelCooldownsForTest()
	t.Cleanup(func() {
		clearChannelCooldownsForTest()
		ClearChannelCacheForTest()
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
	})

	highPriority := int64(20)
	lowPriority := int64(10)
	slowWeight := uint(100)
	zeroWeight := uint(0)
	SetChannelCacheForTest(map[int]*Channel{
		17: {Id: 17, Status: common.ChannelStatusEnabled, Weight: &slowWeight, Priority: &highPriority},
		29: {Id: 29, Status: common.ChannelStatusEnabled, Weight: &zeroWeight, Priority: &highPriority},
		41: {Id: 41, Status: common.ChannelStatusEnabled, Weight: &slowWeight, Priority: &lowPriority},
	}, map[string]map[string][]int{
		"default": {"gpt-5.6-sol": {17, 29, 41}},
	})

	key := ChannelHealthKey{ChannelID: 17, Model: "gpt-5.6-sol", Path: "/v1/responses"}
	slow := channelHealthSlowLatency() + time.Second
	RecordChannelOutcome(key, ChannelOutcome{StatusCode: http.StatusOK, Latency: slow})

	selected, err := GetRandomSatisfiedChannelWithOptions("default", "gpt-5.6-sol", 0, ChannelSelectionOptions{Path: "/v1/responses"})
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 17, selected.Id, "one slow sample must preserve configured priority")

	RecordChannelOutcome(key, ChannelOutcome{StatusCode: http.StatusOK, Latency: slow})
	selected, err = GetRandomSatisfiedChannelWithOptions("default", "gpt-5.6-sol", 0, ChannelSelectionOptions{Path: "/v1/responses"})
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 29, selected.Id, "repeatedly slow peer should leave the highest effective tier")

	RecordChannelOutcome(key, ChannelOutcome{StatusCode: http.StatusOK, Latency: 500 * time.Millisecond})
	selected, err = GetRandomSatisfiedChannelWithOptions("default", "gpt-5.6-sol", 0, ChannelSelectionOptions{Path: "/v1/responses"})
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 29, selected.Id, "one fast sample must not immediately restore the old tier")

	RecordChannelOutcome(key, ChannelOutcome{StatusCode: http.StatusOK, Latency: 500 * time.Millisecond})
	selected, err = GetRandomSatisfiedChannelWithOptions("default", "gpt-5.6-sol", 0, ChannelSelectionOptions{Path: "/v1/responses"})
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 17, selected.Id, "recovered channel should regain configured priority")
}

func TestDatabaseSelectorDemotesRepeatedlySlowPreferredChannel(t *testing.T) {
	useDefaultSlowLatencyThreshold(t)
	setupChannelSelectionTestDB(t)
	withGlobalChannelHealth(t)

	highPriority := int64(20)
	lowPriority := int64(10)
	weight := uint(100)
	slowURL := "https://slow.example/v1"
	avoidedURL := "https://avoided.example/v1"
	lowerURL := "https://lower.example/v1"
	channels := []Channel{
		{Id: 17, Type: 1, Key: "key-17", Status: common.ChannelStatusEnabled, Name: "slow-preferred", Weight: &weight, Priority: &highPriority, BaseURL: &slowURL, Models: "gpt-5.6-sol", Group: "default"},
		{Id: 29, Type: 1, Key: "key-29", Status: common.ChannelStatusEnabled, Name: "healthy-avoided", Weight: &weight, Priority: &highPriority, BaseURL: &avoidedURL, Models: "gpt-5.6-sol", Group: "default"},
		{Id: 41, Type: 1, Key: "key-41", Status: common.ChannelStatusEnabled, Name: "lower", Weight: &weight, Priority: &lowPriority, BaseURL: &lowerURL, Models: "gpt-5.6-sol", Group: "default"},
	}
	require.NoError(t, DB.Create(&channels).Error)
	abilities := []Ability{
		{Group: "default", Model: "gpt-5.6-sol", ChannelId: 17, Enabled: true, Priority: &highPriority, Weight: weight},
		{Group: "default", Model: "gpt-5.6-sol", ChannelId: 29, Enabled: true, Priority: &highPriority, Weight: weight},
		{Group: "default", Model: "gpt-5.6-sol", ChannelId: 41, Enabled: true, Priority: &lowPriority, Weight: weight},
	}
	require.NoError(t, DB.Create(&abilities).Error)
	recordSelectionSlowChannel(ChannelHealthKey{ChannelID: 17, Model: "gpt-5.6-sol", Path: "/v1/responses"})

	selected, err := GetChannelWithOptions("default", "gpt-5.6-sol", 0, ChannelSelectionOptions{
		AvoidChannelHosts: map[string]struct{}{"avoided.example": {}},
		RequestPath:       "/v1/responses",
		Path:              "/v1/responses",
	})

	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 29, selected.Id, "DB selector must use the same effective-priority demotion as the cache selector")
}
