package controller

import (
	"math/rand"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/require"
)

func int64Ptr(value int64) *int64 { return &value }
func uintPtr(value uint) *uint    { return &value }

func TestChooseChannelPreparationAutoPromotionCandidateRespectsHighestPriorityTier(t *testing.T) {
	preparations := []model.ChannelPreparation{
		{Id: 1, Balance: 100, Priority: int64Ptr(1), Weight: uintPtr(100000)},
		{Id: 2, Balance: 10, Priority: int64Ptr(10), Weight: uintPtr(0)},
	}

	candidate, ok := chooseChannelPreparationAutoPromotionCandidate(
		preparations,
		operation_setting.ChannelPreparationAutoPromotionStrategyPriorityWeighted,
		rand.New(rand.NewSource(1)),
	)

	require.True(t, ok)
	require.Equal(t, 2, candidate.Id)
}

func TestChooseChannelPreparationAutoPromotionCandidateSmallBalanceFirst(t *testing.T) {
	preparations := []model.ChannelPreparation{
		{Id: 1, Balance: 1, Priority: int64Ptr(1)},
		{Id: 2, Balance: 5, Priority: int64Ptr(10)},
		{Id: 3, Balance: 2, Priority: int64Ptr(10)},
		{Id: 4, Balance: 2, Priority: int64Ptr(10)},
	}

	candidate, ok := chooseChannelPreparationAutoPromotionCandidate(
		preparations,
		operation_setting.ChannelPreparationAutoPromotionStrategySmallBalanceFirst,
		nil,
	)

	require.True(t, ok)
	require.Equal(t, 3, candidate.Id)
}

func TestChooseChannelPreparationAutoPromotionCandidateLargeBalanceFirst(t *testing.T) {
	preparations := []model.ChannelPreparation{
		{Id: 1, Balance: 100, Priority: int64Ptr(1)},
		{Id: 2, Balance: 5, Priority: int64Ptr(10)},
		{Id: 3, Balance: 10, Priority: int64Ptr(10)},
		{Id: 4, Balance: 10, Priority: int64Ptr(10)},
	}

	candidate, ok := chooseChannelPreparationAutoPromotionCandidate(
		preparations,
		operation_setting.ChannelPreparationAutoPromotionStrategyLargeBalanceFirst,
		nil,
	)

	require.True(t, ok)
	require.Equal(t, 3, candidate.Id)
}

func TestChooseChannelPreparationAutoPromotionActiveShortage(t *testing.T) {
	capacityFirst := operation_setting.ChannelPreparationAutoPromotionRule{
		GuaranteePriority: operation_setting.ChannelPreparationAutoPromotionGuaranteePriorityCapacityFirst,
	}
	countFirst := operation_setting.ChannelPreparationAutoPromotionRule{
		GuaranteePriority: operation_setting.ChannelPreparationAutoPromotionGuaranteePriorityCountFirst,
	}

	require.Equal(t, channelPreparationAutoPromotionShortageCapacity, chooseChannelPreparationAutoPromotionActiveShortage(capacityFirst, true, true))
	require.Equal(t, channelPreparationAutoPromotionShortageCount, chooseChannelPreparationAutoPromotionActiveShortage(countFirst, true, true))
	require.Equal(t, channelPreparationAutoPromotionShortageCount, chooseChannelPreparationAutoPromotionActiveShortage(capacityFirst, true, false))
	require.Equal(t, channelPreparationAutoPromotionShortageCapacity, chooseChannelPreparationAutoPromotionActiveShortage(countFirst, false, true))
	require.Empty(t, chooseChannelPreparationAutoPromotionActiveShortage(countFirst, false, false))
}

func TestChannelPreparationAutoPromotionCountDeficit(t *testing.T) {
	require.Equal(t, int64(0), channelPreparationAutoPromotionCountDeficit(0, 0))
	require.Equal(t, int64(3), channelPreparationAutoPromotionCountDeficit(5, 2))
	require.Equal(t, int64(0), channelPreparationAutoPromotionCountDeficit(2, 5))
}
