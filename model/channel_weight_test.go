package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSelectWeightedIndexUsesRawWeightIntervals(t *testing.T) {
	type selection struct {
		randomWeight  uint64
		expectedIndex int
	}
	testCases := []struct {
		name       string
		weights    []uint
		total      uint64
		selections []selection
	}{
		{
			name:    "two to one remains two to one",
			weights: []uint{2, 1},
			total:   3,
			selections: []selection{
				{randomWeight: 0, expectedIndex: 0},
				{randomWeight: 1, expectedIndex: 0},
				{randomWeight: 2, expectedIndex: 1},
			},
		},
		{
			name:    "all zero weights are equal",
			weights: []uint{0, 0, 0},
			total:   3,
			selections: []selection{
				{randomWeight: 0, expectedIndex: 0},
				{randomWeight: 1, expectedIndex: 1},
				{randomWeight: 2, expectedIndex: 2},
			},
		},
		{
			name:    "zero weights get no interval when another weight is positive",
			weights: []uint{0, 1, 0},
			total:   1,
			selections: []selection{
				{randomWeight: 0, expectedIndex: 1},
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			for _, selection := range testCase.selections {
				index, err := selectWeightedIndexWithDraw(testCase.weights, func(total uint64) uint64 {
					assert.Equal(t, testCase.total, total)
					return selection.randomWeight
				})
				require.NoError(t, err)
				assert.Equal(t, selection.expectedIndex, index, "random weight %d", selection.randomWeight)
			}
		})
	}
}

func TestSelectWeightedIndexRejectsEmptyWeights(t *testing.T) {
	_, err := selectWeightedIndexWithDraw(nil, func(uint64) uint64 {
		t.Fatal("draw must not be called for an empty weight list")
		return 0
	})

	require.ErrorContains(t, err, "empty weight list")
}

func TestGetRandomSatisfiedChannelExcludesZeroWeightAcrossCacheModes(t *testing.T) {
	const (
		groupName = "weight-selection-test"
		modelName = "weight-selection-model"
	)
	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	positiveWeight := uint(1)
	zeroWeight := uint(0)
	priority := int64(0)
	channels := []*Channel{
		{
			Name:     "positive-weight",
			Key:      "test-key-positive",
			Status:   common.ChannelStatusEnabled,
			Weight:   &positiveWeight,
			Priority: &priority,
			Group:    groupName,
			Models:   modelName,
		},
		{
			Name:     "zero-weight",
			Key:      "test-key-zero",
			Status:   common.ChannelStatusEnabled,
			Weight:   &zeroWeight,
			Priority: &priority,
			Group:    groupName,
			Models:   modelName,
		},
	}
	t.Cleanup(func() {
		defer func() {
			common.MemoryCacheEnabled = originalMemoryCacheEnabled
		}()
		channelIDs := []int{channels[0].Id, channels[1].Id}
		require.NoError(t, DB.Where("channel_id IN ?", channelIDs).Delete(&Ability{}).Error)
		require.NoError(t, DB.Where("id IN ?", channelIDs).Delete(&Channel{}).Error)
		common.MemoryCacheEnabled = true
		InitChannelCache()
	})

	for _, channel := range channels {
		require.NoError(t, DB.Create(channel).Error)
		require.NoError(t, channel.AddAbilities(nil))
	}

	testCases := []struct {
		name               string
		memoryCacheEnabled bool
	}{
		{name: "database", memoryCacheEnabled: false},
		{name: "memory cache", memoryCacheEnabled: true},
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			common.MemoryCacheEnabled = testCase.memoryCacheEnabled
			if testCase.memoryCacheEnabled {
				InitChannelCache()
			}

			selected, err := GetRandomSatisfiedChannel(groupName, modelName, 0, "")
			require.NoError(t, err)
			require.NotNil(t, selected)
			assert.Equal(t, channels[0].Id, selected.Id)
		})
	}
}
