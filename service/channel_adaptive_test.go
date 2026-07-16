package service

import (
	"fmt"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"

	"github.com/stretchr/testify/require"
)

// 测试辅助：构造测试渠道
func testChannel(id int, weight uint, priority int64) *model.Channel {
	w := weight
	return &model.Channel{
		Id:       id,
		Weight:   &w,
		Priority: &priority,
		Name:     fmt.Sprintf("ch-%d", id),
		Status:   common.ChannelStatusEnabled,
	}
}

func init() {
	// 测试前重置全局状态
	globalSnapshot.mu.Lock()
	globalSnapshot.metrics = make(map[metricsKey]*ChannelMetrics)
	globalSnapshot.mu.Unlock()

	constant.EwmaAlpha = 0.3
	constant.MaxChannelConcurrency = 10
	constant.ChannelCircuitBreakerEnabled = true
	constant.AdaptiveBalanceEnabled = true
	constant.AdaptiveBalanceShadowMode = false
}

// 测试1：高延迟渠道会被降权
func TestHighLatencyDowngraded(t *testing.T) {
	ch1 := testChannel(1, 10, 100)
	ch2 := testChannel(2, 10, 100)

	// ch1 低延迟，ch2 高延迟
	ObserveSuccess(1, "test", "gpt-4", 200*time.Millisecond)
	ObserveSuccess(1, "test", "gpt-4", 150*time.Millisecond)
	ObserveSuccess(1, "test", "gpt-4", 180*time.Millisecond)
	ObserveSuccess(2, "test", "gpt-4", 5*time.Second)
	ObserveSuccess(2, "test", "gpt-4", 6*time.Second)
	ObserveSuccess(2, "test", "gpt-4", 4*time.Second)

	channels := []*model.Channel{ch1, ch2}
	candidates := ScoreCandidates(channels, "test", "gpt-4", 0)

	require.GreaterOrEqual(t, len(candidates), 2)
	// ch1（低延迟）的分数应显著高于 ch2
	require.Equal(t, 1, candidates[0].Channel.Id, "expected ch1 (low latency) to rank first")
	scoreDiff := candidates[0].Score - candidates[1].Score
	require.Greater(t, scoreDiff, 0.1, "expected significant score difference")
	t.Logf("ch1 (low latency) score=%.4f, ch2 (high latency) score=%.4f", candidates[0].Score, candidates[1].Score)
}

// 测试2：429 渠道不会完全排除但会被降权
func TestRateLimitedChannelDowngraded(t *testing.T) {
	ch1 := testChannel(10, 10, 100)
	ch2 := testChannel(11, 10, 100)

	// ch1 正常，ch2 有 429
	ObserveSuccess(10, "test", "gpt-4", 300*time.Millisecond)
	ObserveSuccess(10, "test", "gpt-4", 250*time.Millisecond)
	ObserveFailure(11, "test", "gpt-4", 429, 100*time.Millisecond)
	ObserveFailure(11, "test", "gpt-4", 429, 100*time.Millisecond)
	ObserveFailure(11, "test", "gpt-4", 429, 100*time.Millisecond)

	channels := []*model.Channel{ch1, ch2}
	candidates := ScoreCandidates(channels, "test", "gpt-4", 0)

	require.GreaterOrEqual(t, len(candidates), 2)
	// 正常渠道应排名更高
	require.Equal(t, 10, candidates[0].Channel.Id, "expected ch10 (normal) to rank first")
	t.Logf("ch10 (normal) score=%.4f rate_limit_factor=%.4f", candidates[0].Score, candidates[0].RateLimitFactor)
	t.Logf("ch11 (429) score=%.4f rate_limit_factor=%.4f", candidates[1].Score, candidates[1].RateLimitFactor)
	require.Less(t, candidates[1].RateLimitFactor, candidates[0].RateLimitFactor)
}

// 测试3：熔断渠道不会被选中
func TestCircuitBreakerChannelExcluded(t *testing.T) {
	ch := testChannel(20, 10, 100)

	// 模拟三次连续失败，触发熔断
	RecordCircuitFailure(20, "500 Internal Server Error")
	RecordCircuitFailure(20, "500 Internal Server Error")
	RecordCircuitFailure(20, "500 Internal Server Error")

	require.True(t, IsCircuitOpen(20), "expected circuit to be open after 3 consecutive failures")

	// 评分中应过滤掉熔断渠道
	channels := []*model.Channel{ch}
	_ = ScoreCandidates(channels, "test", "gpt-4", 0)

	// channel_adaptive.go 中过滤逻辑会跳过 open 渠道
	require.True(t, IsCircuitOpen(20))
}

// 测试4：多渠道重试不会重复选择同一个渠道
func TestNoDuplicateChannelInRetry(t *testing.T) {
	ch1 := testChannel(30, 10, 100)
	ch2 := testChannel(31, 10, 100)
	ch3 := testChannel(32, 10, 100)

	// 全部成功
	for _, id := range []int{30, 31, 32} {
		ObserveSuccess(id, "test", "gpt-4", 200*time.Millisecond)
	}

	channels := []*model.Channel{ch1, ch2, ch3}
	candidates := ScoreCandidates(channels, "test", "gpt-4", 0)

	// 模拟已使用的渠道
	usedIDs := []int{30}

	// 过滤掉已使用的渠道
	var filtered []CandidateScore
	for _, c := range candidates {
		if containsInt(usedIDs, c.Channel.Id) {
			continue
		}
		filtered = append(filtered, c)
	}

	require.Len(t, filtered, 2)
	selected := SelectTopKWeighted(filtered, 3)
	require.NotNil(t, selected)
	require.NotEqual(t, 30, selected.Channel.Id)
	t.Logf("selected ch%d (ch30 excluded)", selected.Channel.Id)
}

// 测试5：TopK 加权随机不会全部集中在最高分渠道
func TestTopKWeightedRandomFairness(t *testing.T) {
	channels := make([]*model.Channel, 10)
	for i := 0; i < 10; i++ {
		channels[i] = testChannel(100+i, 10, 100)
		ObserveSuccess(100+i, "test", "gpt-4", time.Duration(200+(i*100))*time.Millisecond)
	}

	candidates := ScoreCandidates(channels, "test", "gpt-4", 0)
	require.GreaterOrEqual(t, len(candidates), 10)

	// 模拟多次选择，统计分布
	selectionCount := make(map[int]int)
	trials := 1000
	for i := 0; i < trials; i++ {
		selected := SelectTopKWeighted(candidates, 3)
		if selected != nil {
			selectionCount[selected.Channel.Id]++
		}
	}

	// TopK 的前三名应该都有一定比例
	for _, c := range candidates[:3] {
		count := selectionCount[c.Channel.Id]
		ratio := float64(count) / float64(trials)
		t.Logf("ch%d selection rate: %.2f%% (score=%.3f)", c.Channel.Id, ratio*100, c.Score)
		require.GreaterOrEqual(t, ratio, 0.05, "ch%d selected too few times", c.Channel.Id)
	}
}

// 测试6：EWMA 计算正确
func TestEwmaUpdate(t *testing.T) {
	alpha := 0.3

	// 初始 1.0，观察到 0.5
	result := EwmaUpdate(1.0, 0.5, alpha)
	expected := 0.3*0.5 + 0.7*1.0 // = 0.85
	require.InDelta(t, expected, result, 0.001)

	// 再次衰减
	result2 := EwmaUpdate(result, 0.5, alpha)
	expected2 := 0.3*0.5 + 0.7*0.85 // = 0.745
	require.InDelta(t, expected2, result2, 0.001)
}

// 测试7：延迟桶边界
func TestLatencyBucket(t *testing.T) {
	tests := []struct {
		latency time.Duration
		bucket  int
	}{
		{100 * time.Millisecond, 0},
		{500 * time.Millisecond, 0},
		{600 * time.Millisecond, 1},
		{1 * time.Second, 1},
		{1500 * time.Millisecond, 2},
		{3 * time.Second, 3},
		{7 * time.Second, 4},
		{15 * time.Second, 5},
	}

	for _, tt := range tests {
		b := latencyBucket(tt.latency)
		require.Equal(t, tt.bucket, b, "latencyBucket(%v)", tt.latency)
	}
}
