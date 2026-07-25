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
