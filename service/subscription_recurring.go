package service

import (
	"sync"

	"github.com/QuantumNous/new-api/common"
)

// RecurringCharger is the seam for AGREEMENT-BASED renewal rails, where the
// merchant must initiate each cycle's deduction via API call (WeChat 委托代扣,
// Alipay 周期扣款 — the CN-mainland processors). Vendor-managed processors
// (Airwallex, Stripe) never register here: their vendor auto-charges and the
// renewal arrives as a webhook that opens the next paid SubscriptionOrder.
type RecurringCharger interface {
	ProviderName() string
	// ChargeDue initiates deductions for this provider's subscriptions expiring
	// within the provider's renewal window; success paths insert + complete the
	// next cycle's SubscriptionOrder (extending the term), failures are retried
	// on subsequent scans until ExpireDueSubscriptions downgrades at term end.
	ChargeDue() error
}

var recurringChargersMu sync.RWMutex
var recurringChargers = map[string]RecurringCharger{}

func RegisterRecurringCharger(rc RecurringCharger) {
	recurringChargersMu.Lock()
	defer recurringChargersMu.Unlock()
	recurringChargers[rc.ProviderName()] = rc
}

func GetRecurringCharger(provider string) (RecurringCharger, bool) {
	recurringChargersMu.RLock()
	defer recurringChargersMu.RUnlock()
	rc, ok := recurringChargers[provider]
	return rc, ok
}

// ChargeDueAgreementSubscriptions runs every registered charger once. Called
// from the subscription lifecycle ticker (daily gate); a no-op while no
// agreement-based processor is registered — which is the HK/Airwallex truth.
func ChargeDueAgreementSubscriptions() {
	recurringChargersMu.RLock()
	chargers := make([]RecurringCharger, 0, len(recurringChargers))
	for _, rc := range recurringChargers {
		chargers = append(chargers, rc)
	}
	recurringChargersMu.RUnlock()
	for _, rc := range chargers {
		if err := rc.ChargeDue(); err != nil {
			common.SysLog("recurring charge scan failed for provider " + rc.ProviderName() + ": " + err.Error())
		}
	}
}
