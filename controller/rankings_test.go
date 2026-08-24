package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type rankingsResponseEnvelope struct {
	Success bool                     `json:"success"`
	Data    service.RankingsResponse `json:"data"`
}

func TestGetRankingsAppliesHiddenModelsOnlyToPublicView(t *testing.T) {
	withHiddenPricingModels(t, "hidden-*")
	originalGetter := getRankingsSnapshot
	t.Cleanup(func() { getRankingsSnapshot = originalGetter })

	snapshot := &service.RankingsResponse{
		Models: []service.RankedModel{
			{Rank: 1, ModelName: "hidden-model", Vendor: "Vendor", TotalTokens: 70, Share: 0.7},
			{Rank: 2, ModelName: "visible-model", Vendor: "Vendor", TotalTokens: 30, Share: 0.3},
		},
		Vendors: []service.RankedVendor{
			{Rank: 1, Vendor: "Vendor", TotalTokens: 100, Share: 1, ModelsCount: 2, TopModel: "hidden-model"},
		},
		TopMovers: []service.RankingMover{
			{ModelName: "hidden-model", CurrentRank: 1},
			{ModelName: "visible-model", CurrentRank: 2},
			{ModelName: "visible-outside-leaderboard", CurrentRank: 3},
		},
		TopDroppers: []service.RankingMover{
			{ModelName: "hidden-dropper", CurrentRank: 3},
		},
		ModelsHistory: service.ModelHistorySeries{
			Points: []service.ModelHistoryPoint{
				{Model: "hidden-model", Tokens: 70},
				{Model: "visible-model", Tokens: 30},
			},
			Models: []service.ModelHistoryModel{
				{Name: "hidden-model", Total: 70},
				{Name: "visible-model", Total: 30},
			},
			Buckets: 1,
		},
	}
	getRankingsSnapshot = func(period string) (*service.RankingsResponse, error) {
		require.Equal(t, "month", period)
		return snapshot, nil
	}

	full := requestRankings(t, "/api/rankings?period=month")
	require.Equal(t, []string{"hidden-model", "visible-model"}, rankedModelNames(full.Data.Models))

	public := requestRankings(t, "/api/rankings?period=month&view=public")
	require.Equal(t, []string{"visible-model"}, rankedModelNames(public.Data.Models))
	require.Equal(t, 1, public.Data.Models[0].Rank)
	require.Equal(t, []string{"visible-model", "visible-outside-leaderboard"}, rankingMoverNames(public.Data.TopMovers))
	require.Equal(t, []int{1, 2}, rankingMoverRanks(public.Data.TopMovers))
	require.Empty(t, public.Data.TopDroppers)
	require.Equal(t, []string{"visible-model"}, modelHistoryNames(public.Data.ModelsHistory.Models))
	require.Len(t, public.Data.ModelsHistory.Points, 1)
	require.Equal(t, "visible-model", public.Data.ModelsHistory.Points[0].Model)
	require.Empty(t, public.Data.Vendors[0].TopModel)

	fullAfterPublic := requestRankings(t, "/api/rankings?period=month")
	require.Equal(t, []string{"hidden-model", "visible-model"}, rankedModelNames(fullAfterPublic.Data.Models))
	require.Equal(t, "hidden-model", snapshot.Vendors[0].TopModel)
}

func requestRankings(t *testing.T, path string) rankingsResponseEnvelope {
	t.Helper()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, path, nil)
	GetRankings(ctx)

	var payload rankingsResponseEnvelope
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success, recorder.Body.String())
	return payload
}

func rankedModelNames(models []service.RankedModel) []string {
	names := make([]string, len(models))
	for i, model := range models {
		names[i] = model.ModelName
	}
	return names
}

func rankingMoverNames(models []service.RankingMover) []string {
	names := make([]string, len(models))
	for i, model := range models {
		names[i] = model.ModelName
	}
	return names
}

func rankingMoverRanks(models []service.RankingMover) []int {
	ranks := make([]int, len(models))
	for i, model := range models {
		ranks[i] = model.CurrentRank
	}
	return ranks
}

func modelHistoryNames(models []service.ModelHistoryModel) []string {
	names := make([]string, len(models))
	for i, model := range models {
		names[i] = model.Name
	}
	return names
}
