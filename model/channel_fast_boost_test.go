package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// seedThreeChannelHealth registers one fast channel (#17) and two slow ones
// (#41, #51) for the same model+path, using the latencies measured in prod
// during the incident this fixes.
func withFastSlowFleet(t *testing.T) (fast int, slow []int) {
	t.Helper()
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	oldHealthEnabled := common.AdaptiveChannelHealthEnabled
	common.MemoryCacheEnabled = true
	common.AdaptiveChannelHealthEnabled = true
	ClearChannelCacheForTest()
	clearChannelCooldownsForTest()
	clearChannelHealthForTest()
	t.Cleanup(func() {
		clearChannelHealthForTest()
		clearChannelCooldownsForTest()
		ClearChannelCacheForTest()
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
		common.AdaptiveChannelHealthEnabled = oldHealthEnabled
	})

	priority := int64(10)
	weight := uint(0) // equal configured weight, so only health decides
	ch := func(id int) *Channel {
		return &Channel{Id: id, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &priority}
	}
	SetChannelCacheForTest(map[int]*Channel{17: ch(17), 41: ch(41), 51: ch(51)}, map[string]map[string][]int{
		"default": {"gpt-5.6-sol": {17, 41, 51}},
	})

	// Slow but under channelHealthSlowLatency (9s): a channel past that trips its
	// slow-circuit and is dropped from selection entirely (a different, existing
	// mechanism). To exercise the fast-boost weighting we need the slow channels
	// to stay in the candidate set — genuinely slow (>affinityFastLatency) yet
	// not tripped.
	const path = "/v1/responses"
	for i := 0; i < 6; i++ {
		RecordChannelOutcome(ChannelHealthKey{ChannelID: 17, Model: "gpt-5.6-sol", Path: path}, ChannelOutcome{StatusCode: 200, Latency: 1500 * time.Millisecond})
		RecordChannelOutcome(ChannelHealthKey{ChannelID: 41, Model: "gpt-5.6-sol", Path: path}, ChannelOutcome{StatusCode: 200, Latency: 6000 * time.Millisecond})
		RecordChannelOutcome(ChannelHealthKey{ChannelID: 51, Model: "gpt-5.6-sol", Path: path}, ChannelOutcome{StatusCode: 200, Latency: 6000 * time.Millisecond})
	}
	return 17, []int{41, 51}
}

// TestFastChannelWinsMostSelections is the fix: when a genuinely fast channel
// exists, selection must concentrate on it instead of weighted-randomly
// scattering a bounced session back onto the slow channels. Health score alone
// under-separates 1.8s from 12s (~4.6x), so without the boost the fast channel
// took well under half the traffic and slow sessions churned.
func TestFastChannelWinsMostSelections(t *testing.T) {
	fast, _ := withFastSlowFleet(t)

	const n = 2000
	hits := map[int]int{}
	for i := 0; i < n; i++ {
		sel, err := GetRandomSatisfiedChannelWithOptions("default", "gpt-5.6-sol", 0, ChannelSelectionOptions{Path: "/v1/responses"})
		if err != nil || sel == nil {
			t.Fatalf("selection %d failed: err=%v sel=%v", i, err, sel)
		}
		hits[sel.Id]++
	}

	// Without the boost, health score alone gives the 1.5s channel only ~59%
	// against two 6s peers (0.4 vs 0.143 weight). The boost must push it well
	// past that — 0.8 is chosen so the assertion fails if the boost is removed,
	// not merely if it is weak.
	fastShare := float64(hits[fast]) / float64(n)
	if fastShare < 0.8 {
		t.Fatalf("fast channel #%d share = %.2f (hits=%v); expected the fast channel to dominate selection", fast, fastShare, hits)
	}
	// Slow channels must still get a probe share, or they can never be observed
	// recovering.
	if hits[41] == 0 || hits[51] == 0 {
		t.Fatalf("slow channels got no probe traffic (hits=%v); recovery could never be detected", hits)
	}
}

// TestNoBoostWhenWholeFleetSlow: with no channel under the fast threshold, the
// boost must not fire — otherwise it would just re-randomize among equally slow
// channels and could stampede one. Selection falls back to plain health
// weighting, matching the affinity logic that also refuses to migrate when
// nowhere is fast.
func TestNoBoostWhenWholeFleetSlow(t *testing.T) {
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	oldHealthEnabled := common.AdaptiveChannelHealthEnabled
	common.MemoryCacheEnabled = true
	common.AdaptiveChannelHealthEnabled = true
	ClearChannelCacheForTest()
	clearChannelCooldownsForTest()
	clearChannelHealthForTest()
	t.Cleanup(func() {
		clearChannelHealthForTest()
		clearChannelCooldownsForTest()
		ClearChannelCacheForTest()
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
		common.AdaptiveChannelHealthEnabled = oldHealthEnabled
	})

	priority := int64(10)
	weight := uint(0)
	ch := func(id int) *Channel {
		return &Channel{Id: id, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &priority}
	}
	SetChannelCacheForTest(map[int]*Channel{41: ch(41), 51: ch(51)}, map[string]map[string][]int{
		"default": {"gpt-5.6-sol": {41, 51}},
	})
	// Both slow (>affinityFastLatency) but under the 9s slow-circuit trip, so
	// they stay selectable and neither gets a fast boost.
	for i := 0; i < 6; i++ {
		RecordChannelOutcome(ChannelHealthKey{ChannelID: 41, Model: "gpt-5.6-sol", Path: "/v1/responses"}, ChannelOutcome{StatusCode: 200, Latency: 6000 * time.Millisecond})
		RecordChannelOutcome(ChannelHealthKey{ChannelID: 51, Model: "gpt-5.6-sol", Path: "/v1/responses"}, ChannelOutcome{StatusCode: 200, Latency: 7000 * time.Millisecond})
	}

	const n = 2000
	hits := map[int]int{}
	for i := 0; i < n; i++ {
		sel, err := GetRandomSatisfiedChannelWithOptions("default", "gpt-5.6-sol", 0, ChannelSelectionOptions{Path: "/v1/responses"})
		if err != nil || sel == nil {
			t.Fatalf("selection %d failed: err=%v sel=%v", i, err, sel)
		}
		hits[sel.Id]++
	}
	// Neither should dominate the way a boosted channel would; both stay in a
	// broad band around the health-weighted split.
	for _, id := range []int{41, 51} {
		share := float64(hits[id]) / float64(n)
		if share < 0.2 || share > 0.8 {
			t.Fatalf("slow channel #%d share = %.2f (hits=%v); expected no fast-boost concentration", id, share, hits)
		}
	}
}

// TestFastAndSlowSelectionFactors pins the underlying classifier.
func TestFastAndSlowSelectionFactors(t *testing.T) {
	oldHealthEnabled := common.AdaptiveChannelHealthEnabled
	common.AdaptiveChannelHealthEnabled = true
	clearChannelHealthForTest()
	t.Cleanup(func() {
		clearChannelHealthForTest()
		common.AdaptiveChannelHealthEnabled = oldHealthEnabled
	})

	fast := ChannelHealthKey{ChannelID: 17, Model: "gpt-5.6-sol", Path: "/v1/responses"}
	slow := ChannelHealthKey{ChannelID: 41, Model: "gpt-5.6-sol", Path: "/v1/responses"}
	cold := ChannelHealthKey{ChannelID: 99, Model: "gpt-5.6-sol", Path: "/v1/responses"}
	for i := 0; i < 6; i++ {
		RecordChannelOutcome(fast, ChannelOutcome{StatusCode: 200, Latency: 1800 * time.Millisecond})
		RecordChannelOutcome(slow, ChannelOutcome{StatusCode: 200, Latency: 12000 * time.Millisecond})
	}

	if _, f := ChannelSelectionFactors(fast); !f {
		t.Fatal("a 1.8s channel must be classified fast")
	}
	if _, f := ChannelSelectionFactors(slow); f {
		t.Fatal("a 12s channel must not be classified fast")
	}
	// A cold channel is unknown, not fast: it keeps full base score but no boost.
	if score, f := ChannelSelectionFactors(cold); f || score != 1 {
		t.Fatalf("cold channel: got score=%.2f fast=%v, want score=1 fast=false", score, f)
	}
}

func TestFastChannelClassificationUsesExitHysteresis(t *testing.T) {
	oldHealthEnabled := common.AdaptiveChannelHealthEnabled
	common.AdaptiveChannelHealthEnabled = true
	clearChannelHealthForTest()
	t.Cleanup(func() {
		clearChannelHealthForTest()
		common.AdaptiveChannelHealthEnabled = oldHealthEnabled
	})

	stableFast := ChannelHealthKey{ChannelID: 117, Model: "gpt-5.6-sol-hysteresis", Path: "/v1/responses"}
	for i := 0; i < 6; i++ {
		RecordChannelOutcome(stableFast, ChannelOutcome{StatusCode: 200, Latency: 1800 * time.Millisecond})
	}
	_, fast := ChannelSelectionFactors(stableFast)
	require.True(t, fast, "a channel measured below the fast-entry threshold should enter the fast set")

	// One ordinary latency spike moves the EWMA just above 2s. It should not
	// instantly remove the channel from the fast set and collapse its selection
	// weight by 8x; only sustained degradation past the exit threshold should.
	RecordChannelOutcome(stableFast, ChannelOutcome{StatusCode: 200, Latency: 3400 * time.Millisecond})
	_, fast = ChannelSelectionFactors(stableFast)
	assert.True(t, fast, "a measured-fast channel should ride out a small EWMA excursion above 2s")

	RecordChannelOutcome(stableFast, ChannelOutcome{StatusCode: 200, Latency: 8 * time.Second})
	_, fast = ChannelSelectionFactors(stableFast)
	assert.False(t, fast, "a measured-fast channel must leave the fast set after sustained degradation")

	neverFast := ChannelHealthKey{ChannelID: 118, Model: "gpt-5.6-sol-hysteresis", Path: "/v1/responses"}
	RecordChannelOutcome(neverFast, ChannelOutcome{StatusCode: 200, Latency: 2500 * time.Millisecond})
	_, fast = ChannelSelectionFactors(neverFast)
	assert.False(t, fast, "a channel must cross the 2s entry threshold before it can receive fast-channel weighting")
}
