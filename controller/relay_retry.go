package controller

import (
	"github.com/QuantumNous/new-api/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

var retry524Times = max(0, common.GetEnvOrDefault("RETRY_524_TIMES", 1))

func prepareNextRelayAttempt(
	c *gin.Context,
	relayMode int,
	apiError *types.NewAPIError,
	retryParam *service.RetryParam,
	retry524Remaining *int,
) bool {
	if apiError == nil {
		return false
	}

	if apiError.StatusCode == 524 {
		if *retry524Remaining <= 0 ||
			(relayMode != relayconstant.RelayModeChatCompletions && relayMode != relayconstant.RelayModeResponses) {
			return false
		}

		*retry524Remaining = *retry524Remaining - 1
		// Consume a pending auto-group reset without spending a normal retry.
		retryIndex := retryParam.GetRetry()
		retryParam.IncreaseRetry()
		retryParam.SetRetry(retryIndex)
		return true
	}

	if !shouldRetry(c, apiError, common.RetryTimes-retryParam.GetRetry()) {
		return false
	}
	retryParam.IncreaseRetry()
	return true
}
