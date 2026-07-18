package controller

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPlanChannelSmartScheduleWeightOnlyKeepsPriorityCohorts(t *testing.T) {
	ratioOne := 1.0
	ratioTwo := 2.0
	ratioThree := 3.0
	plan := planChannelSmartSchedule([]channelSmartScheduleCandidate{
		{ChannelId: 1, Group: "vip", CurrentPriority: 0, Ratio: &ratioOne},
		{ChannelId: 2, Group: "vip", CurrentPriority: 0, Ratio: &ratioTwo},
		{ChannelId: 3, Group: "vip", CurrentPriority: 10, Ratio: &ratioThree},
		{ChannelId: 4, Group: "vip", CurrentPriority: 10, Ratio: &ratioOne},
	}, channelMonitorSmartScheduleStrategyRatio, channelMonitorSmartScheduleApplyWeight, 5)

	require.Len(t, plan.Items, 4)
	assert.Empty(t, plan.Skipped)
	assert.Equal(t, 1, plan.GroupCount)

	items := make(map[int]channelSmartSchedulePlanItem, len(plan.Items))
	for _, item := range plan.Items {
		items[item.ChannelId] = item
	}
	assert.Equal(t, int64(0), items[1].TargetPriority)
	assert.Equal(t, uint(100), items[1].TargetWeight)
	assert.Equal(t, int64(0), items[2].TargetPriority)
	assert.Equal(t, uint(10), items[2].TargetWeight)
	assert.Equal(t, int64(10), items[3].TargetPriority)
	assert.Equal(t, uint(10), items[3].TargetWeight)
	assert.Equal(t, int64(10), items[4].TargetPriority)
	assert.Equal(t, uint(100), items[4].TargetWeight)
}

func TestPlanChannelSmartSchedulePriorityWeightUsesQualityTiersAndDamping(t *testing.T) {
	ratioOne := 1.0
	ratioTwo := 2.0
	ratioThree := 3.0
	plan := planChannelSmartSchedule([]channelSmartScheduleCandidate{
		{ChannelId: 1, Group: "vip", CurrentPriority: 0, CurrentWeight: 50, Ratio: &ratioOne},
		{ChannelId: 2, Group: "vip", CurrentPriority: 0, CurrentWeight: 50, Ratio: &ratioTwo},
		{ChannelId: 3, Group: "vip", CurrentPriority: 0, CurrentWeight: 50, Ratio: &ratioThree},
	}, channelMonitorSmartScheduleStrategyRatio, channelMonitorSmartScheduleApplyPriorityWeight, 5)

	require.Len(t, plan.Items, 3)
	items := make(map[int]channelSmartSchedulePlanItem, len(plan.Items))
	for _, item := range plan.Items {
		items[item.ChannelId] = item
	}
	assert.Equal(t, int64(100), items[1].TargetPriority)
	assert.Equal(t, uint(70), items[1].TargetWeight)
	assert.Equal(t, int64(90), items[2].TargetPriority)
	assert.Equal(t, uint(50), items[2].TargetWeight)
	assert.Equal(t, int64(80), items[3].TargetPriority)
	assert.Equal(t, uint(30), items[3].TargetWeight)
}

func TestPlanChannelSmartScheduleRequiresConfiguredSamples(t *testing.T) {
	ratio := 1.0
	firstToken := 1000.0
	tps := 30.0
	plan := planChannelSmartSchedule([]channelSmartScheduleCandidate{
		{
			ChannelId:             1,
			Group:                 "vip",
			Ratio:                 &ratio,
			FirstTokenMs:          &firstToken,
			TPS:                   &tps,
			FirstTokenSampleCount: 5,
			TPSSampleCount:        5,
		},
		{
			ChannelId:             2,
			Group:                 "vip",
			Ratio:                 &ratio,
			FirstTokenMs:          &firstToken,
			TPS:                   &tps,
			FirstTokenSampleCount: 4,
			TPSSampleCount:        5,
		},
	}, channelMonitorSmartScheduleStrategyFirstToken, channelMonitorSmartScheduleApplyWeight, 5)

	assert.Empty(t, plan.Items)
	assert.Equal(t, "同分组同优先级的可调渠道不足 2 个", plan.Skipped[1])
	assert.Equal(t, "首字样本不足（4/5）", plan.Skipped[2])
}

func TestPlanChannelSmartScheduleSmartCombinesAllMetrics(t *testing.T) {
	ratioLow := 1.0
	ratioHigh := 2.0
	firstTokenFast := 300.0
	firstTokenSlow := 900.0
	tpsSlow := 10.0
	tpsFast := 30.0
	stabilityLower := 0.80
	stabilityHigher := 1.0
	plan := planChannelSmartSchedule([]channelSmartScheduleCandidate{
		{
			ChannelId: 1, Group: "vip", Ratio: &ratioLow,
			FirstTokenMs: &firstTokenFast, FirstTokenSampleCount: 5,
			TPS: &tpsSlow, TPSSampleCount: 5,
			Stability: &stabilityLower, StabilitySampleCount: 5, StabilityAvailable: true,
		},
		{
			ChannelId: 2, Group: "vip", Ratio: &ratioHigh,
			FirstTokenMs: &firstTokenSlow, FirstTokenSampleCount: 5,
			TPS: &tpsFast, TPSSampleCount: 5,
			Stability: &stabilityHigher, StabilitySampleCount: 5, StabilityAvailable: true,
		},
	}, channelMonitorSmartScheduleStrategySmart, channelMonitorSmartScheduleApplyWeight, 5)

	require.Len(t, plan.Items, 2)
	items := make(map[int]channelSmartSchedulePlanItem, len(plan.Items))
	for _, item := range plan.Items {
		items[item.ChannelId] = item
	}
	assert.Equal(t, uint(75), items[1].TargetWeight)
	assert.Equal(t, uint(55), items[2].TargetWeight)
}

func TestPlanChannelSmartScheduleUsesStabilitySuccessRate(t *testing.T) {
	stableRate := 0.99
	unstableRate := 0.80
	plan := planChannelSmartSchedule([]channelSmartScheduleCandidate{
		{ChannelId: 1, Group: "stable", Stability: &stableRate, StabilitySampleCount: 100, StabilityAvailable: true},
		{ChannelId: 2, Group: "stable", Stability: &unstableRate, StabilitySampleCount: 100, StabilityAvailable: true},
	}, channelMonitorSmartScheduleStrategyStability, channelMonitorSmartScheduleApplyWeight, 5)

	require.Len(t, plan.Items, 2)
	items := make(map[int]channelSmartSchedulePlanItem, len(plan.Items))
	for _, item := range plan.Items {
		items[item.ChannelId] = item
	}
	assert.Equal(t, uint(100), items[1].TargetWeight)
	assert.Equal(t, uint(80), items[2].TargetWeight)

	plan = planChannelSmartSchedule([]channelSmartScheduleCandidate{
		{ChannelId: 3, Group: "stable"},
		{ChannelId: 4, Group: "stable"},
	}, channelMonitorSmartScheduleStrategyStability, channelMonitorSmartScheduleApplyWeight, 5)
	assert.Empty(t, plan.Items)
	assert.Equal(t, "稳定性统计不可用，请开启消费日志和 ERROR_LOG_ENABLED", plan.Skipped[3])
	assert.Equal(t, "稳定性统计不可用，请开启消费日志和 ERROR_LOG_ENABLED", plan.Skipped[4])
}
