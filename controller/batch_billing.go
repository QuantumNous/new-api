package controller

import (
	"errors"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

const (
	batchBillingMaxRequestIdLength = 64
	batchBillingMaxModelNameLength = 255
	batchBillingMaxNoteLength      = 255
)

// batchBillingRequest is a charge reported by a batch inference platform.
// Either usage (prompt/completion tokens, priced by the model's pricing and
// the batch group ratio) or an explicit charge (quota, or amount in USD) is
// given, never both.
type batchBillingRequest struct {
	Key                 string           `json:"key"`
	RequestId           string           `json:"request_id"`
	ModelName           string           `json:"model_name"`
	PromptTokens        int              `json:"prompt_tokens"`
	CompletionTokens    int              `json:"completion_tokens"`
	CachedTokens        int              `json:"cached_tokens"`
	CacheCreationTokens int              `json:"cache_creation_tokens"`
	Quota               *int             `json:"quota"`
	Amount              *decimal.Decimal `json:"amount"`
	Note                string           `json:"note"`
}

func batchBillingReject(c *gin.Context, status int, code string, key string, params ...map[string]any) {
	common.ApiErrorStatus(c, status, common.NewMessage(key, params...), gin.H{"code": code})
}

// ChargeBatchBilling charges a batch group API key for usage that a batch
// inference platform served outside the relay.
func ChargeBatchBilling(c *gin.Context) {
	var req batchBillingRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		batchBillingReject(c, http.StatusBadRequest, "invalid_request", "Invalid parameters")
		return
	}
	req.RequestId = strings.TrimSpace(req.RequestId)
	req.ModelName = strings.TrimSpace(req.ModelName)
	req.Note = strings.TrimSpace(req.Note)
	switch {
	case strings.TrimSpace(req.Key) == "":
		batchBillingReject(c, http.StatusBadRequest, "invalid_request", "{{field}} is required", map[string]any{"field": "key"})
		return
	case req.RequestId == "" || len(req.RequestId) > batchBillingMaxRequestIdLength:
		batchBillingReject(c, http.StatusBadRequest, "invalid_request", "{{field}} is required and must be at most {{max}} characters", map[string]any{"field": "request_id", "max": batchBillingMaxRequestIdLength})
		return
	case req.ModelName == "" || len(req.ModelName) > batchBillingMaxModelNameLength:
		batchBillingReject(c, http.StatusBadRequest, "invalid_request", "{{field}} is required and must be at most {{max}} characters", map[string]any{"field": "model_name", "max": batchBillingMaxModelNameLength})
		return
	case utf8.RuneCountInString(req.Note) > batchBillingMaxNoteLength:
		batchBillingReject(c, http.StatusBadRequest, "invalid_request", "{{field}} must be at most {{max}} characters", map[string]any{"field": "note", "max": batchBillingMaxNoteLength})
		return
	}

	charge := service.BatchBillingCharge{
		RequestId:  req.RequestId,
		Note:       req.Note,
		OperatorId: c.GetInt("id"),
	}
	explicitCharge := req.Quota != nil || req.Amount != nil
	usageReported := req.PromptTokens != 0 || req.CompletionTokens != 0 || req.CachedTokens != 0 || req.CacheCreationTokens != 0
	switch {
	case req.Quota != nil && req.Amount != nil:
		batchBillingReject(c, http.StatusBadRequest, "invalid_request", "Provide exactly one of token usage, quota, or amount")
		return
	case explicitCharge && usageReported:
		batchBillingReject(c, http.StatusBadRequest, "invalid_request", "Provide exactly one of token usage, quota, or amount")
		return
	case req.Quota != nil:
		if *req.Quota <= 0 || *req.Quota > common.MaxQuota {
			batchBillingReject(c, http.StatusBadRequest, "quota_out_of_range", "The charge must be positive and within the supported quota range")
			return
		}
		charge.Quota = *req.Quota
	case req.Amount != nil:
		quota, err := common.QuotaFromDecimalStrict(req.Amount.Mul(decimal.NewFromFloat(common.QuotaPerUnit)))
		if err != nil || quota <= 0 || !req.Amount.IsPositive() {
			batchBillingReject(c, http.StatusBadRequest, "quota_out_of_range", "The charge must be positive and within the supported quota range")
			return
		}
		charge.Quota = quota
	default:
		// Token counts are billing multipliers: bound each one before pricing.
		for _, count := range []int{req.PromptTokens, req.CompletionTokens, req.CachedTokens, req.CacheCreationTokens} {
			if count < 0 || count > common.MaxQuota {
				batchBillingReject(c, http.StatusBadRequest, "invalid_request", "Token counts must be between 0 and {{max}}", map[string]any{"max": common.MaxQuota})
				return
			}
		}
		if req.PromptTokens+req.CompletionTokens == 0 {
			batchBillingReject(c, http.StatusBadRequest, "invalid_request", "Provide exactly one of token usage, quota, or amount")
			return
		}
		if req.CachedTokens+req.CacheCreationTokens > req.PromptTokens {
			batchBillingReject(c, http.StatusBadRequest, "invalid_request", "cached_tokens and cache_creation_tokens are part of prompt_tokens and cannot exceed it")
			return
		}
		charge.Usage = &dto.Usage{
			PromptTokens:     req.PromptTokens,
			CompletionTokens: req.CompletionTokens,
			TotalTokens:      req.PromptTokens + req.CompletionTokens,
			PromptTokensDetails: dto.InputTokenDetails{
				CachedTokens:     req.CachedTokens,
				CacheWriteTokens: req.CacheCreationTokens,
			},
		}
	}

	bc, info, err := service.PrepareBatchBilling(c, req.Key, req.ModelName)
	if err == nil && charge.Usage != nil {
		if _, priceErr := helper.ModelPriceHelper(bc, info, req.PromptTokens, &types.TokenCountMeta{}); priceErr != nil {
			batchBillingReject(c, http.StatusBadRequest, "model_price_error", "Model price error: {{error}}", map[string]any{"error": priceErr.Error()})
			return
		}
	}
	var result *service.BatchBillingResult
	if err == nil {
		result, err = service.ChargeBatchBilling(bc, info, charge)
	}
	if err != nil {
		var billingErr *service.BatchBillingError
		if errors.As(err, &billingErr) {
			common.ApiErrorStatus(c, billingErr.Status, billingErr.Message, gin.H{"code": billingErr.Code})
			return
		}
		common.SysError(common.LogText("batch billing %s failed: %s", req.RequestId, err.Error()))
		common.ApiErrorStatus(c, http.StatusInternalServerError, common.NewMessage("Batch billing failed"), gin.H{"code": "internal_error"})
		return
	}
	common.ApiSuccess(c, result)
}
