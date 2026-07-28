package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

type DataToolBillingContext struct {
	UserID         int
	TokenID        int
	TokenKey       string
	TokenUnlimited bool
}

func dataToolHash(parts ...string) string {
	hash := sha256.New()
	for _, part := range parts {
		hash.Write([]byte(part))
		hash.Write([]byte{0})
	}
	return hex.EncodeToString(hash.Sum(nil))
}

func dataToolPriceToQuota(priceUSD float64) (int64, int, error) {
	if priceUSD < 0 || math.IsNaN(priceUSD) || math.IsInf(priceUSD, 0) {
		return 0, 0, errors.New("invalid data tool price")
	}
	priceMicroUSD := int64(math.Ceil(priceUSD * 1_000_000))
	quotaFloat := priceUSD * common.QuotaPerUnit
	if quotaFloat > float64(math.MaxInt) {
		return 0, 0, errors.New("data tool price exceeds quota range")
	}
	return priceMicroUSD, int(math.Ceil(quotaFloat)), nil
}

func replayDataToolCall(call *model.DataToolCall) (*DataToolRunResult, error) {
	switch call.Status {
	case model.DataToolCallStatusPending:
		return nil, ErrDataToolCallInProgress
	case model.DataToolCallStatusFailed:
		if strings.TrimSpace(call.ErrorMessage) == "" {
			return nil, errors.New("previous data tool call failed")
		}
		return nil, errors.New(call.ErrorMessage)
	case model.DataToolCallStatusSucceeded:
		var result DataToolRunResult
		if err := common.Unmarshal(call.ResponseBody, &result); err != nil {
			return nil, fmt.Errorf("failed to restore idempotent data tool response: %w", err)
		}
		result.Replayed = true
		remainingQuota, err := model.GetUserQuota(call.UserID, true)
		if err != nil {
			return nil, err
		}
		result.RemainingQuota = remainingQuota
		return &result, nil
	default:
		return nil, fmt.Errorf("unknown data tool call state: %s", call.Status)
	}
}

func dataToolMinPlanRank() int {
	return common.GetEnvOrDefault("FLATKEY_DATA_TOOL_MIN_PLAN_RANK", 10)
}

// ExecuteDataTool keeps VOC as an unlimited upstream while Flatkey owns the
// customer-facing price, pre-charge, refund, idempotency ledger and balance.
func ExecuteDataTool(
	ctx context.Context,
	billing DataToolBillingContext,
	clientIdempotencyKey string,
	toolID string,
	input map[string]any,
) (*DataToolRunResult, error) {
	clientIdempotencyKey = strings.TrimSpace(clientIdempotencyKey)
	toolID = strings.TrimSpace(toolID)
	if billing.UserID <= 0 || clientIdempotencyKey == "" || toolID == "" {
		return nil, errors.New("user, idempotency key and tool id are required")
	}
	if billing.TokenID <= 0 || strings.TrimSpace(billing.TokenKey) == "" {
		return nil, ErrDataToolAPIKeyRequired
	}
	minPlanRank := dataToolMinPlanRank()
	if minPlanRank > 0 {
		activeRank, err := model.GetHighestActiveSubscriptionTierRank(billing.UserID)
		if err != nil {
			return nil, err
		}
		if activeRank < minPlanRank {
			return nil, ErrDataToolPlanRequired
		}
	}
	if len(clientIdempotencyKey) > 256 {
		return nil, errors.New("idempotency key cannot exceed 256 characters")
	}
	if input == nil {
		input = map[string]any{}
	}

	inspection, err := InspectDataTool(ctx, toolID)
	if err != nil {
		return nil, err
	}
	priceUSD := dataToolPriceUSD(inspection.Pricing, input)
	priceMicroUSD, quota, err := dataToolPriceToQuota(priceUSD)
	if err != nil {
		return nil, err
	}

	inputJSON, err := common.Marshal(input)
	if err != nil {
		return nil, err
	}
	scopedIdempotencyKey := dataToolHash(fmt.Sprintf("%d", billing.UserID), clientIdempotencyKey)
	requestHash := dataToolHash(toolID, string(inputJSON))
	call, replayed, err := model.ReserveDataToolCall(model.ReserveDataToolCallInput{
		UserID:         billing.UserID,
		TokenID:        billing.TokenID,
		TokenKey:       billing.TokenKey,
		TokenUnlimited: billing.TokenUnlimited,
		IdempotencyKey: scopedIdempotencyKey,
		RequestHash:    requestHash,
		ToolID:         toolID,
		PriceMicroUSD:  priceMicroUSD,
		Quota:          quota,
	})
	if err != nil {
		switch {
		case errors.Is(err, model.ErrDataToolUserQuotaInsufficient),
			errors.Is(err, model.ErrDataToolTokenQuotaInsufficient):
			return nil, ErrDataToolInsufficient
		default:
			return nil, err
		}
	}
	if replayed {
		return replayDataToolCall(call)
	}

	upstream, err := runVOCDataTool(ctx, toolID, input, scopedIdempotencyKey)
	if err != nil {
		if refundErr := model.FailAndRefundDataToolCall(call.ID, err.Error()); refundErr != nil {
			common.SysError(fmt.Sprintf(
				"data tools: failed to refund call %d for user %d: %v",
				call.ID,
				billing.UserID,
				refundErr,
			))
		}
		return nil, err
	}
	finalPriceUSD, err := settledDataToolPriceUSD(
		inspection.Pricing,
		input,
		upstream.ResultCount,
		upstream.MeteredUSD,
	)
	if err != nil {
		if refundErr := model.FailAndRefundDataToolCall(call.ID, err.Error()); refundErr != nil {
			common.SysError(fmt.Sprintf("data tools: failed to refund call %d after invalid settlement: %v", call.ID, refundErr))
		}
		return nil, err
	}
	finalPriceMicroUSD, finalQuota, err := dataToolPriceToQuota(finalPriceUSD)
	if err != nil {
		if refundErr := model.FailAndRefundDataToolCall(call.ID, err.Error()); refundErr != nil {
			common.SysError(fmt.Sprintf("data tools: failed to refund call %d after settlement conversion: %v", call.ID, refundErr))
		}
		return nil, err
	}

	result := &DataToolRunResult{
		Tool:         upstream.Tool,
		Output:       upstream.Output,
		ResultCount:  upstream.ResultCount,
		ChargedQuota: finalQuota,
		ChargedUSD:   float64(finalPriceMicroUSD) / 1_000_000,
		Replayed:     false,
		LatencyMS:    upstream.LatencyMS,
	}
	remainingQuota, err := model.CompleteAndSettleDataToolCall(model.CompleteAndSettleDataToolCallInput{
		ID:                 call.ID,
		FinalPriceMicroUSD: finalPriceMicroUSD,
		FinalQuota:         finalQuota,
		ResultCount:        upstream.ResultCount,
		LatencyMS:          upstream.LatencyMS,
		BuildResponse: func(remaining int) ([]byte, error) {
			result.RemainingQuota = remaining
			return common.Marshal(result)
		},
	})
	if err != nil {
		if refundErr := model.FailAndRefundDataToolCall(call.ID, err.Error()); refundErr != nil {
			common.SysError(fmt.Sprintf("data tools: failed to refund call %d after ledger completion failure: %v", call.ID, refundErr))
		}
		if errors.Is(err, model.ErrDataToolUserQuotaInsufficient) ||
			errors.Is(err, model.ErrDataToolTokenQuotaInsufficient) {
			return nil, ErrDataToolInsufficient
		}
		return nil, err
	}
	result.RemainingQuota = remainingQuota
	return result, nil
}
