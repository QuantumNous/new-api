package service

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"

	"github.com/bytedance/gopkg/util/gopool"
)

// TriggerStripeAutoCharge is the threshold-triggered automatic off-session charge entry point.
// The real implementation lives in the controller package (where the Stripe helpers are) and is
// registered here at init time to avoid a circular import. It is nil until registered.
var TriggerStripeAutoCharge func(userId int)

// MaybeTriggerStripeAutoCharge fires an asynchronous auto-charge when the user's balance has
// dropped below the configured threshold. It never blocks the caller (relay hot path): the
// current request proceeds under its normal quota rules regardless of the charge outcome.
func MaybeTriggerStripeAutoCharge(userId int, userQuota int) {
	if TriggerStripeAutoCharge == nil {
		return
	}
	if !setting.StripeAutoChargeEnabled {
		return
	}
	threshold := setting.StripeAutoChargeThreshold * int(common.QuotaPerUnit)
	if threshold <= 0 || userQuota >= threshold {
		return
	}
	gopool.Go(func() {
		TriggerStripeAutoCharge(userId)
	})
}
