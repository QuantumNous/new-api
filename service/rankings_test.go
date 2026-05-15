package service

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestRankingDisplayValueMultiplier(t *testing.T) {
	settings := rankingDisplaySettings{multiplier: 12, jitter: 0}

	value := rankingDisplayValue(100, settings, "model-a")

	if value != 1200 {
		t.Fatalf("expected multiplier to produce 1200, got %d", value)
	}
}

func TestApplyRankingDisplayToTotalsSortsByDisplayedValue(t *testing.T) {
	settings := rankingDisplaySettings{multiplier: 1, jitter: 1}
	totals := []model.RankingQuotaTotal{
		{ModelName: "model-a", TotalTokens: 100},
		{ModelName: "model-b", TotalTokens: 100},
	}

	rows := applyRankingDisplayToTotals(totals, settings, "test")

	if len(rows) != len(totals) {
		t.Fatalf("expected %d rows, got %d", len(totals), len(rows))
	}
	for _, row := range rows {
		if row.TotalTokens < 100 || row.TotalTokens > 200 {
			t.Fatalf("expected jittered value between 100 and 200, got %d", row.TotalTokens)
		}
	}
	if rows[0].TotalTokens < rows[1].TotalTokens {
		t.Fatalf("expected rows sorted by displayed value descending: %+v", rows)
	}
}
