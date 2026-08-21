package service

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildRankedModelsIncludesConsumedQuota(t *testing.T) {
	rows := buildRankedModels(
		[]model.RankingQuotaTotal{{
			ModelName:   "model-a",
			TotalTokens: 120,
			TotalQuota:  345,
		}},
		120,
		map[string]int{},
		map[string]int64{},
		map[string]rankingModelMeta{
			"model-a": {vendor: "vendor-a"},
		},
		false,
	)

	require.Len(t, rows, 1)
	assert.Equal(t, int64(120), rows[0].TotalTokens)
	assert.Equal(t, int64(345), rows[0].TotalQuota)
	assert.Equal(t, 1.0, rows[0].Share)
}

// A model that only ever charged quota (per-request billing, e.g. Midjourney)
// must still appear on the leaderboard with a visible rank and its quota,
// even though its token share is zero.
func TestBuildRankedModelsQuotaOnlyModel(t *testing.T) {
	rows := buildRankedModels(
		[]model.RankingQuotaTotal{
			{ModelName: "gpt-4o", TotalTokens: 500, TotalQuota: 1000},
			{ModelName: "midjourney", TotalTokens: 0, TotalQuota: 800},
		},
		500,
		map[string]int{},
		map[string]int64{},
		map[string]rankingModelMeta{
			"gpt-4o":     {vendor: "OpenAI"},
			"midjourney": {vendor: "Midjourney"},
		},
		false,
	)

	require.Len(t, rows, 2)
	assert.Equal(t, "gpt-4o", rows[0].ModelName)
	assert.Equal(t, 1, rows[0].Rank)
	assert.Equal(t, 1.0, rows[0].Share)

	assert.Equal(t, "midjourney", rows[1].ModelName)
	assert.Equal(t, 2, rows[1].Rank)
	assert.Equal(t, int64(0), rows[1].TotalTokens)
	assert.Equal(t, int64(800), rows[1].TotalQuota)
	assert.Equal(t, 0.0, rows[1].Share)
}
