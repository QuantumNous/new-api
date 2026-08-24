package service

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFilterRankingsResponseUsesFullRankingForMoverRanks(t *testing.T) {
	result := &RankingsResponse{
		Models: []RankedModel{
			{Rank: 1, ModelName: "hidden-leader"},
			{Rank: 2, ModelName: "visible-leader"},
		},
		TopMovers: []RankingMover{
			{ModelName: "visible-outside-leaderboard", CurrentRank: 4},
		},
		allModels: []RankedModel{
			{Rank: 1, ModelName: "hidden-leader"},
			{Rank: 2, ModelName: "visible-leader"},
			{Rank: 3, ModelName: "hidden-outside-leaderboard"},
			{Rank: 4, ModelName: "visible-outside-leaderboard"},
		},
	}

	filtered := FilterRankingsResponse(result, func(modelName string) bool {
		return !strings.HasPrefix(modelName, "hidden-")
	})

	require.Equal(t, []string{"visible-leader", "visible-outside-leaderboard"}, rankedModelNamesForTest(filtered.Models))
	require.Equal(t, []int{1, 2}, rankedModelRanksForTest(filtered.Models))
	require.Equal(t, 2, filtered.TopMovers[0].CurrentRank)
	require.Equal(t, 4, result.TopMovers[0].CurrentRank)
	require.Equal(t, []string{"hidden-leader", "visible-leader"}, rankedModelNamesForTest(result.Models))
}

func rankedModelNamesForTest(models []RankedModel) []string {
	names := make([]string, len(models))
	for i, model := range models {
		names[i] = model.ModelName
	}
	return names
}

func rankedModelRanksForTest(models []RankedModel) []int {
	ranks := make([]int, len(models))
	for i, model := range models {
		ranks[i] = model.Rank
	}
	return ranks
}
