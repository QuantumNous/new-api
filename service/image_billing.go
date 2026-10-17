package service

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
)

// PrepareImageBillingForSelectedGroup refreshes the image price snapshot and
// reserves the selected group's charge before an upstream attempt. Cheaper
// retries keep the previous reservation until actual usage is settled.
func PrepareImageBillingForSelectedGroup(c *gin.Context, info *relaycommon.RelayInfo) *types.NewAPIError {
	if info == nil || info.PriceData.ImageBilling == nil {
		return nil
	}
	image := info.PriceData.ImageBilling
	groupRatio := info.PriceData.GroupRatioInfo.GroupRatio
	target, err := common.QuotaFromFloatStrict(image.BasePrice * image.Multiplier * float64(image.Count) * groupRatio * image.QuotaPerUnit)
	if err != nil {
		return types.NewErrorWithStatusCode(err, types.ErrorCodeModelPriceError, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	image.GroupRatio = groupRatio
	info.PriceData.QuotaToPreConsume = target
	if groupRatio == 0 || image.BasePrice == 0 {
		return nil
	}
	info.PriceData.FreeModel = false
	if info.Billing == nil {
		return PreConsumeBilling(c, target, info)
	}
	if err := info.Billing.Reserve(target); err != nil {
		return types.NewError(err, types.ErrorCodeUpdateDataError, types.ErrOptionWithSkipRetry())
	}
	info.FinalPreConsumedQuota = info.Billing.GetPreConsumedQuota()
	return nil
}
