package service

import (
	"context"

	"github.com/QuantumNous/new-api/model"
)

func GetRecallRevenueTotals(ctx context.Context, campaignID int64) ([]model.RecallRevenueTotals, error) {
	return model.GetRecallRevenueTotalsWithContext(ctx, campaignID)
}
