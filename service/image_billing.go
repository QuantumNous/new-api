package service

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
)

// RefreshImageBillingRequestContext validates and estimates the final request
// for a retry without creating a second billing session.
func RefreshImageBillingRequestContext(c *gin.Context, info *relaycommon.RelayInfo, promptTexts []string) *types.NewAPIError {
	meta := &types.TokenCountMeta{
		CombineText: strings.Join(promptTexts, "\n"),
		MaxTokens:   1584,
	}
	if setting.ShouldCheckPromptSensitive() {
		if contains, _ := CheckSensitiveText(meta.CombineText); contains {
			RequestPolicy(c).AddEvent(PolicyEvent{ErrorCode: string(types.ErrorCodeSensitiveWordsDetected), ErrorSource: "local", Decision: PolicyDecision{Action: "stop", Reason: "local_rejection", Source: "global"}, Health: "unchanged"})
			message := "image prompt contains sensitive words"
			logger.LogWarn(c, message)
			return types.NewErrorWithStatusCode(errors.New(message), types.ErrorCodeSensitiveWordsDetected, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
	}
	tokens, err := EstimateRequestToken(c, meta, info)
	if err != nil {
		return types.NewError(err, types.ErrorCodeCountTokenFailed)
	}
	info.SetEstimatePromptTokens(tokens)
	if snap := info.TieredBillingSnapshot; snap != nil && snap.BillingMode == "tiered_expr" {
		snap.EstimatedPromptTokens = tokens
	}
	return nil
}

// PrepareImageBillingForRequest reserves the effective outbound image billing
// inputs before each attempt, including channel retries and parameter overrides.
func PrepareImageBillingForRequest(c *gin.Context, info *relaycommon.RelayInfo, count int) *types.NewAPIError {
	if count < 1 || count > dto.MaxImageN {
		return types.NewErrorWithStatusCode(fmt.Errorf("image_count must be an integer between 1 and %d", dto.MaxImageN), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	info.ImageRequestCount = count
	var quota int
	var err error
	if snap := info.TieredBillingSnapshot; snap != nil && snap.BillingMode == "tiered_expr" {
		request := billingexpr.RequestInput{}
		if info.BillingRequestInput != nil {
			request = *info.BillingRequestInput
		}
		request.ImageCount = &count
		cost, trace, runErr := billingexpr.RunExprByHashWithRequest(snap.ExprString, snap.ExprHash, billingexpr.TokenParams{
			P: float64(snap.EstimatedPromptTokens), C: float64(snap.EstimatedCompletionTokens), Len: float64(snap.EstimatedPromptTokens),
		}, request)
		if runErr != nil {
			return types.NewErrorWithStatusCode(runErr, types.ErrorCodeModelPriceError, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		beforeGroup := cost / 1_000_000 * snap.QuotaPerUnit
		if trace.BillingUnit != billingexpr.BillingUnitRequest && snap.PreConsumeMultiplier != 0 {
			beforeGroup *= snap.PreConsumeMultiplier
		}
		quota, err = billingexpr.QuotaRoundStrict(beforeGroup * info.PriceData.GroupRatioInfo.GroupRatio)
		if err == nil {
			snap.EstimatedImageCount = trace.ImageCount
			snap.EstimatedQuotaBeforeGroup = beforeGroup
			snap.EstimatedQuotaAfterGroup = quota
			snap.EstimatedTier = trace.MatchedTier
			snap.EstimatedBillingUnit = trace.BillingUnit
			snap.EstimatedFixedPrice = trace.FixedPrice
			snap.GroupRatio = info.PriceData.GroupRatioInfo.GroupRatio
		}
	} else {
		quantity := 1
		if info.PriceData.UsePrice {
			quantity = count
		}
		// Overwrite the per-attempt ratio so a failed attempt cannot leak its
		// quantity into another channel.
		info.PriceData.AddOtherRatio("n", float64(quantity))
		base := info.ImageQuotaBeforeGroup
		if info.PriceData.UsePrice {
			base = info.PriceData.ModelPrice * common.QuotaPerUnit
		}
		quota, err = common.QuotaFromFloatStrict(info.PriceData.ApplyOtherRatiosToFloat(base * info.PriceData.GroupRatioInfo.GroupRatio))
	}
	if err != nil {
		return types.NewErrorWithStatusCode(err, types.ErrorCodeModelPriceError, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	info.PriceData.QuotaToPreConsume = quota
	if quota == 0 && info.Billing == nil {
		return nil
	}
	info.PriceData.FreeModel = false
	if info.Billing == nil {
		return PreConsumeBilling(c, quota, info)
	}
	if err := info.Billing.Reserve(quota); err != nil {
		var apiErr *types.NewAPIError
		if errors.As(err, &apiErr) {
			return apiErr
		}
		return types.NewErrorWithStatusCode(err, types.ErrorCodeInsufficientUserQuota, http.StatusForbidden, types.ErrOptionWithSkipRetry())
	}
	info.FinalPreConsumedQuota = info.Billing.GetPreConsumedQuota()
	return nil
}
