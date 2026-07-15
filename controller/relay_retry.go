package controller

import (
	"github.com/QuantumNous/new-api/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

var (
	retry400UpstreamFailedTimes = max(0, common.GetEnvOrDefault("RETRY_400_UPSTREAM_FAILED_TIMES", 1))
	retry503Times               = max(0, common.GetEnvOrDefault("RETRY_503_TIMES", 1))
	retry524Times               = max(0, common.GetEnvOrDefault("RETRY_524_TIMES", 1))
)

type relayRetryBudget struct {
	retry400UpstreamFailedRemaining int
	retry503Remaining               int
	retry524Remaining               int
}

func newRelayRetryBudget() relayRetryBudget {
	return relayRetryBudget{
		retry400UpstreamFailedRemaining: retry400UpstreamFailedTimes,
		retry503Remaining:               retry503Times,
		retry524Remaining:               retry524Times,
	}
}

func prepareNextRelayAttempt(
	c *gin.Context,
	relayMode int,
	apiError *types.NewAPIError,
	retryParam *service.RetryParam,
	retryBudget *relayRetryBudget,
) bool {
	if apiError == nil {
		return false
	}

	if relayMode == relayconstant.RelayModeChatCompletions || relayMode == relayconstant.RelayModeResponses {
		var remaining *int
		switch {
		case apiError.StatusCode == 400 && apiError.Error() == "Upstream request failed":
			remaining = &retryBudget.retry400UpstreamFailedRemaining
		case apiError.StatusCode == 503:
			remaining = &retryBudget.retry503Remaining
		case apiError.StatusCode == 524:
			remaining = &retryBudget.retry524Remaining
		}
		if remaining != nil && *remaining <= 0 {
			return false
		}
		if remaining != nil {
			*remaining = *remaining - 1
			// Consume a pending auto-group reset without spending a normal retry.
			retryIndex := retryParam.GetRetry()
			retryParam.IncreaseRetry()
			retryParam.SetRetry(retryIndex)
			return true
		}
	}

	if !shouldRetry(c, apiError, common.RetryTimes-retryParam.GetRetry()) {
		return false
	}
	retryParam.IncreaseRetry()
	return true
}
