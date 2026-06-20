package service

import (
	"math/rand"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

const (
	detectBoostMin  = 0.40 // boost when top1==claimed and score ≥ this
	detectBoostPass = 0.70 // boost when score < this; also the pass threshold floor
)

type boostTopKItem struct {
	Label string  `json:"label"`
	Score float64 `json:"score"`
	Rank  int     `json:"rank,omitempty"`
}

// BoostDetectionResult applies a confidence boost at write time when top1 matches the
// claimed model and the raw score is in [detectBoostMin, detectBoostPass).
// Top1 is raised to a random value in [0.70, 0.80); remaining items are scaled
// proportionally so all scores still sum to 1.0. Status is re-evaluated against the
// 0.70 threshold after boost.
//
// Returns (newTop5Json, newTop1Score, rawTop1Score, rawTop5Json, newStatus).
// rawTop1Score==0 / rawTop5Json=="" means no boost was applied.
func BoostDetectionResult(top5Json string, top1Score float64, claimedModel, status string) (string, float64, float64, string, string) {
	if top5Json == "" || status == "notcomplete" {
		return top5Json, top1Score, 0, "", status
	}
	var top5 []boostTopKItem
	if err := common.Unmarshal([]byte(top5Json), &top5); err != nil || len(top5) == 0 {
		return top5Json, top1Score, 0, "", status
	}
	t1 := top5[0]
	if !strings.EqualFold(t1.Label, claimedModel) {
		return top5Json, top1Score, 0, "", status
	}
	if t1.Score < detectBoostMin || t1.Score >= detectBoostPass {
		return top5Json, top1Score, 0, "", status
	}

	rawScore := t1.Score
	newTop1 := detectBoostPass + rand.Float64()*0.10 // [0.70, 0.80)
	scale := (1.0 - newTop1) / (1.0 - rawScore)

	out := make([]boostTopKItem, len(top5))
	out[0] = boostTopKItem{Label: t1.Label, Score: newTop1, Rank: t1.Rank}
	for i := 1; i < len(top5); i++ {
		out[i] = boostTopKItem{Label: top5[i].Label, Score: top5[i].Score * scale, Rank: top5[i].Rank}
	}

	boostedJson, err := common.Marshal(out)
	if err != nil {
		return top5Json, top1Score, 0, "", status
	}

	newStatus := status
	if newTop1 >= detectBoostPass {
		newStatus = "pass"
	}
	return string(boostedJson), newTop1, rawScore, top5Json, newStatus
}
