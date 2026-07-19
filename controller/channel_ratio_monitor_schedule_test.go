package controller

import (
	"context"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRunChannelSmartScheduleUsesConvertedCostRatioAcrossGroups(t *testing.T) {
	db := setupChannelMonitorControllerTestDB(t)
	useChannelMonitorOptionMap(t, map[string]string{
		channelMonitorSmartScheduleEnabledOption:   "true",
		channelMonitorSmartScheduleStrategyOption:  channelMonitorSmartScheduleStrategyRatio,
		channelMonitorSmartScheduleApplyModeOption: channelMonitorSmartScheduleApplyWeight,
	})
	priority := int64(0)
	weight := uint(50)
	channels := []model.Channel{
		{Id: 1, Name: "cheap raw", Group: "vip", Status: common.ChannelStatusEnabled, Priority: &priority, Weight: &weight},
		{Id: 2, Name: "cheap cost", Group: "standard", Status: common.ChannelStatusEnabled, Priority: &priority, Weight: &weight},
	}
	require.NoError(t, db.Create(&channels).Error)
	require.NoError(t, db.Create(&[]model.ChannelRatioMonitor{
		{
			ChannelId: 1, Ratio: 0.5, UpdatedTime: 1,
			CostConversion: `{"mode":"recharge","paid_cny":400,"credited_usd":100}`,
		},
		{ChannelId: 2, Ratio: 1, UpdatedTime: 1},
	}).Error)

	result, err := runChannelSmartScheduleOnce(context.Background(), nil, false)
	require.NoError(t, err)
	assert.Equal(t, 2, result.Updated)

	first, err := model.GetChannelById(1, false)
	require.NoError(t, err)
	second, err := model.GetChannelById(2, false)
	require.NoError(t, err)
	assert.Equal(t, 30, first.GetWeight())
	assert.Equal(t, 70, second.GetWeight())

	firstMonitor, err := model.GetChannelRatioMonitor(1)
	require.NoError(t, err)
	secondMonitor, err := model.GetChannelRatioMonitor(2)
	require.NoError(t, err)
	require.NotNil(t, firstMonitor.LastScheduleScore)
	require.NotNil(t, secondMonitor.LastScheduleScore)
	assert.InDelta(t, 0, *firstMonitor.LastScheduleScore, 1e-9)
	assert.InDelta(t, 1, *secondMonitor.LastScheduleScore, 1e-9)
}

func TestPlanChannelSmartScheduleWeightOnlyKeepsPriorityCohorts(t *testing.T) {
	ratioOne := 1.0
	ratioTwo := 2.0
	ratioThree := 3.0
	plan := planChannelSmartSchedule([]channelSmartScheduleCandidate{
		{ChannelId: 1, CurrentPriority: 0, Ratio: &ratioOne},
		{ChannelId: 2, CurrentPriority: 0, Ratio: &ratioTwo},
		{ChannelId: 3, CurrentPriority: 10, Ratio: &ratioThree},
		{ChannelId: 4, CurrentPriority: 10, Ratio: &ratioOne},
	}, channelMonitorSmartScheduleStrategyRatio, false, channelMonitorSmartScheduleApplyWeight, 5, false)

	require.Len(t, plan.Items, 4)
	assert.Empty(t, plan.Skipped)

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
		{ChannelId: 1, CurrentPriority: 0, CurrentWeight: 50, Ratio: &ratioOne},
		{ChannelId: 2, CurrentPriority: 0, CurrentWeight: 50, Ratio: &ratioTwo},
		{ChannelId: 3, CurrentPriority: 0, CurrentWeight: 50, Ratio: &ratioThree},
	}, channelMonitorSmartScheduleStrategyRatio, false, channelMonitorSmartScheduleApplyPriorityWeight, 5, false)

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
			Ratio:                 &ratio,
			FirstTokenMs:          &firstToken,
			TPS:                   &tps,
			FirstTokenSampleCount: 5,
			TPSSampleCount:        5,
		},
		{
			ChannelId:             2,
			Ratio:                 &ratio,
			FirstTokenMs:          &firstToken,
			TPS:                   &tps,
			FirstTokenSampleCount: 4,
			TPSSampleCount:        5,
		},
	}, channelMonitorSmartScheduleStrategyFirstToken, false, channelMonitorSmartScheduleApplyWeight, 5, false)

	assert.Empty(t, plan.Items)
	assert.Equal(t, "同优先级可调渠道不足 2 个", plan.Skipped[1])
	assert.Equal(t, "首字样本不足（4/5）", plan.Skipped[2])
}

func TestPlanChannelSmartScheduleSmartAddsStabilityWhenEnabled(t *testing.T) {
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
			ChannelId: 1, Ratio: &ratioLow,
			FirstTokenMs: &firstTokenFast, FirstTokenSampleCount: 5,
			TPS: &tpsSlow, TPSSampleCount: 5,
			Stability: &stabilityLower, StabilitySampleCount: 5, StabilityAvailable: true,
		},
		{
			ChannelId: 2, Ratio: &ratioHigh,
			FirstTokenMs: &firstTokenSlow, FirstTokenSampleCount: 5,
			TPS: &tpsFast, TPSSampleCount: 5,
			Stability: &stabilityHigher, StabilitySampleCount: 5, StabilityAvailable: true,
		},
	}, channelMonitorSmartScheduleStrategySmart, false, channelMonitorSmartScheduleApplyWeight, 5, false)

	require.Len(t, plan.Items, 2)
	items := make(map[int]channelSmartSchedulePlanItem, len(plan.Items))
	for _, item := range plan.Items {
		items[item.ChannelId] = item
	}
	assert.Equal(t, uint(70), items[1].TargetWeight)
	assert.Equal(t, uint(40), items[2].TargetWeight)

	plan = planChannelSmartSchedule([]channelSmartScheduleCandidate{
		{
			ChannelId: 1, Ratio: &ratioLow,
			FirstTokenMs: &firstTokenFast, FirstTokenSampleCount: 5,
			TPS: &tpsSlow, TPSSampleCount: 5,
			Stability: &stabilityLower, StabilitySampleCount: 5, StabilityAvailable: true,
		},
		{
			ChannelId: 2, Ratio: &ratioHigh,
			FirstTokenMs: &firstTokenSlow, FirstTokenSampleCount: 5,
			TPS: &tpsFast, TPSSampleCount: 5,
			Stability: &stabilityHigher, StabilitySampleCount: 5, StabilityAvailable: true,
		},
	}, channelMonitorSmartScheduleStrategySmart, true, channelMonitorSmartScheduleApplyWeight, 5, false)
	require.Len(t, plan.Items, 2)
	items = make(map[int]channelSmartSchedulePlanItem, len(plan.Items))
	for _, item := range plan.Items {
		items[item.ChannelId] = item
	}
	assert.Equal(t, uint(75), items[1].TargetWeight)
	assert.Equal(t, uint(55), items[2].TargetWeight)
}

func TestPlanChannelSmartScheduleCombinesStabilityWithSelectedStrategy(t *testing.T) {
	ratio := 1.0
	stableRate := 0.99
	unstableRate := 0.80
	plan := planChannelSmartSchedule([]channelSmartScheduleCandidate{
		{ChannelId: 1, Ratio: &ratio, Stability: &stableRate, StabilitySampleCount: 100, StabilityAvailable: true},
		{ChannelId: 2, Ratio: &ratio, Stability: &unstableRate, StabilitySampleCount: 100, StabilityAvailable: true},
	}, channelMonitorSmartScheduleStrategyRatio, true, channelMonitorSmartScheduleApplyWeight, 5, false)

	require.Len(t, plan.Items, 2)
	items := make(map[int]channelSmartSchedulePlanItem, len(plan.Items))
	for _, item := range plan.Items {
		items[item.ChannelId] = item
	}
	assert.Equal(t, uint(100), items[1].TargetWeight)
	assert.Equal(t, uint(90), items[2].TargetWeight)

	plan = planChannelSmartSchedule([]channelSmartScheduleCandidate{
		{ChannelId: 3, Ratio: &ratio},
		{ChannelId: 4, Ratio: &ratio},
	}, channelMonitorSmartScheduleStrategyRatio, true, channelMonitorSmartScheduleApplyWeight, 5, false)
	assert.Empty(t, plan.Items)
	assert.Equal(t, "稳定性统计不可用，请开启消费日志和 ERROR_LOG_ENABLED", plan.Skipped[3])
	assert.Equal(t, "稳定性统计不可用，请开启消费日志和 ERROR_LOG_ENABLED", plan.Skipped[4])

	plan = planChannelSmartSchedule([]channelSmartScheduleCandidate{
		{ChannelId: 3, Ratio: &ratio},
		{ChannelId: 4, Ratio: &ratio},
	}, channelMonitorSmartScheduleStrategyRatio, false, channelMonitorSmartScheduleApplyWeight, 5, false)
	require.Len(t, plan.Items, 2)
	assert.Empty(t, plan.Skipped)
}

func TestPlanChannelSmartScheduleForceResetRecalculatesPriorityAndWeight(t *testing.T) {
	ratioLow := 1.0
	ratioHigh := 3.0
	plan := planChannelSmartSchedule([]channelSmartScheduleCandidate{
		{ChannelId: 1, CurrentPriority: 100, CurrentWeight: 90, Ratio: &ratioLow},
		{ChannelId: 2, CurrentPriority: 80, CurrentWeight: 90, Ratio: &ratioHigh},
	}, channelMonitorSmartScheduleStrategyRatio, false, channelMonitorSmartScheduleApplyWeight, 5, true)

	require.Len(t, plan.Items, 2)
	assert.Empty(t, plan.Skipped)
	items := make(map[int]channelSmartSchedulePlanItem, len(plan.Items))
	for _, item := range plan.Items {
		items[item.ChannelId] = item
	}
	assert.Equal(t, int64(0), items[1].TargetPriority)
	assert.Equal(t, uint(100), items[1].TargetWeight)
	assert.Equal(t, int64(0), items[2].TargetPriority)
	assert.Equal(t, uint(10), items[2].TargetWeight)

	ratioMiddle := 2.0
	plan = planChannelSmartSchedule([]channelSmartScheduleCandidate{
		{ChannelId: 1, CurrentPriority: 0, CurrentWeight: 10, Ratio: &ratioLow},
		{ChannelId: 2, CurrentPriority: 0, CurrentWeight: 10, Ratio: &ratioMiddle},
		{ChannelId: 3, CurrentPriority: 0, CurrentWeight: 100, Ratio: &ratioHigh},
	}, channelMonitorSmartScheduleStrategyRatio, false, channelMonitorSmartScheduleApplyPriorityWeight, 5, true)

	require.Len(t, plan.Items, 3)
	items = make(map[int]channelSmartSchedulePlanItem, len(plan.Items))
	for _, item := range plan.Items {
		items[item.ChannelId] = item
	}
	assert.Equal(t, int64(100), items[1].TargetPriority)
	assert.Equal(t, uint(100), items[1].TargetWeight)
	assert.Equal(t, int64(90), items[2].TargetPriority)
	assert.Equal(t, uint(55), items[2].TargetWeight)
	assert.Equal(t, int64(80), items[3].TargetPriority)
	assert.Equal(t, uint(10), items[3].TargetWeight)
}
