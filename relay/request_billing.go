package relay

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
)

// PrepareRequestBilling estimates and reserves one request's charge. Transports
// provide the current request body through BodyStorage or BillingRequestInput;
// channel retries retain the resulting billing session and pricing snapshot.
func PrepareRequestBilling(c *gin.Context, info *relaycommon.RelayInfo) *types.NewAPIError {
	policy, policyErr := model.GetSensitiveWordPolicyWithError()
	if policyErr != nil {
		logger.LogWarn(c, "sensitive-word policy unavailable: "+policyErr.Error())
		return types.NewErrorWithStatusCode(
			errors.New("敏感词审计暂时不可用，请稍后重试"),
			types.ErrorCodeQueryDataError, http.StatusServiceUnavailable,
			types.ErrOptionWithSkipRetry(), types.ErrOptionWithNoRecordErrorLog(),
		)
	}
	needSensitiveCheck := policy.Enabled && policy.CheckPrompt
	meta := &types.TokenCountMeta{TokenType: types.TokenTypeTokenizer}
	if info.Request != nil && (needSensitiveCheck || constant.CountToken) {
		meta = info.Request.GetTokenCountMeta()
	} else {
		// Avoid building CombineText when only the pricing quantities are needed.
		switch request := info.Request.(type) {
		case *dto.GeneralOpenAIRequest:
			meta.MaxTokens = int(max(lo.FromPtr(request.MaxTokens), lo.FromPtr(request.MaxCompletionTokens)))
		case *dto.OpenAIResponsesRequest:
			meta.MaxTokens = int(lo.FromPtr(request.MaxOutputTokens))
		case *dto.ClaudeRequest:
			meta.MaxTokens = int(lo.FromPtr(request.MaxTokens))
		case *dto.ImageRequest:
			meta = request.GetTokenCountMeta()
		}
	}

	if needSensitiveCheck && meta != nil {
		result, checkedBeforeSelection := common.GetContextKeyType[*model.SensitiveCheckResult](c, constant.ContextKeySensitiveWordCheckResult)
		if !checkedBeforeSelection {
			candidateGroups := []string{info.UsingGroup}
			if info.TokenGroup == "auto" {
				candidateGroups = service.GetRequestAutoGroups(c, info.UserGroup)
			}
			var checkErr error
			result, checkErr = model.CheckSensitiveRequestForGroups(model.SensitiveCheckInput{
				RequestID: c.GetString(common.RequestIdKey), UserID: info.UserId,
				Username: c.GetString("username"), TokenID: info.TokenId,
				TokenName: c.GetString("token_name"), GroupName: info.UsingGroup,
				ModelName: info.OriginModelName, Endpoint: c.Request.URL.Path,
				Protocol: string(info.RelayFormat), Prompt: meta.CombineText,
			}, candidateGroups)
			if checkErr != nil {
				logger.LogWarn(c, "sensitive-word audit failed: "+checkErr.Error())
				return types.NewErrorWithStatusCode(
					errors.New("敏感词审计暂时不可用，请稍后重试"),
					types.ErrorCodeQueryDataError, http.StatusServiceUnavailable,
					types.ErrOptionWithSkipRetry(), types.ErrOptionWithNoRecordErrorLog(),
				)
			}
		}
		if result != nil && result.Matched && result.Blocked {
			service.RequestPolicy(c).AddEvent(service.PolicyEvent{ErrorCode: string(types.ErrorCodeSensitiveWordsDetected), ErrorSource: "local", Decision: service.PolicyDecision{Action: "stop", Reason: "local_rejection", Source: "global"}, Health: "unchanged"})
			logger.LogWarn(c, "sensitive-word policy matched")
			return types.NewOpenAIError(
				errors.New(result.Message), types.ErrorCodeSensitiveWordsDetected,
				http.StatusUnprocessableEntity,
				types.ErrOptionWithSkipRetry(), types.ErrOptionWithNoRecordErrorLog(),
			)
		}
	}

	tokens, err := service.EstimateRequestToken(c, meta, info)
	if err != nil {
		return types.NewError(err, types.ErrorCodeCountTokenFailed)
	}
	info.SetEstimatePromptTokens(tokens)

	priceData, err := helper.ModelPriceHelper(c, info, tokens, meta)
	if err != nil {
		return types.NewError(err, types.ErrorCodeModelPriceError, types.ErrOptionWithStatusCode(http.StatusBadRequest))
	}
	if priceData.FreeModel {
		logger.LogInfo(c, fmt.Sprintf("模型 %s 免费，跳过预扣费", info.OriginModelName))
		return nil
	}
	return service.PreConsumeBilling(c, priceData.QuotaToPreConsume, info)
}

// RefundFailedRequestBilling applies the common final-failure policy after all
// eligible attempts have ended. A settled BillingSession never refunds again.
func RefundFailedRequestBilling(c *gin.Context, info *relaycommon.RelayInfo, apiErr *types.NewAPIError) *types.NewAPIError {
	if apiErr == nil {
		return nil
	}
	apiErr = service.NormalizeViolationFeeError(apiErr)
	if info.Billing != nil {
		info.Billing.Refund(c)
	}
	service.ChargeViolationFeeIfNeeded(c, info, apiErr)
	return apiErr
}
