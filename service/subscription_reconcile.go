package service

import (
	"context"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/airwallex"
)

// listActiveBillingSubscriptions is a seam so tests can run the reconcile
// without live Airwallex calls.
var listActiveBillingSubscriptions = func(customerId string) ([]airwallex.BillingSubscription, error) {
	return airwallex.ListBillingSubscriptions(customerId, "ACTIVE")
}

// ReconcileAirwallexCancellations repairs local rows whose cancellation webhook
// never arrived.
//
// Webhooks get dropped. Without this pass, one lost delivery leaves a row
// permanently claiming it will renew, with nothing in the system able to notice
// — which is the failure the portal was showing: the cancel button coming back
// forever. The endpoint and the webhook are the fast paths; this is the one that
// makes "the database is the truth" actually true.
//
// The rule is exact because Airwallex Billing has no cancel_at_period_end: a
// subscription that has been cancelled leaves the ACTIVE set immediately. So a
// customer with a live local row and no ACTIVE subscription at Airwallex has
// cancelled, full stop.
//
// Returns the number of users marked.
func ReconcileAirwallexCancellations(limit int) (int, error) {
	subs, err := model.ListRenewingUserSubscriptions(limit)
	if err != nil {
		return 0, err
	}
	if len(subs) == 0 {
		return 0, nil
	}

	ctx := context.Background()
	marked := 0
	// One row per user is enough: MarkUserSubscriptionsCancelled covers every
	// row the user holds, and a user with two rows would otherwise cost two
	// identical Airwallex round trips.
	seen := make(map[int]bool, len(subs))
	for _, sub := range subs {
		if seen[sub.UserId] {
			continue
		}
		seen[sub.UserId] = true

		customerId := model.GetAirwallexBillingCustomerId(sub.UserId)
		if customerId == "" {
			// Paid through some other rail, or predates the customer mapping.
			// Absence of an Airwallex customer is not evidence of cancellation.
			continue
		}
		active, err := listActiveBillingSubscriptions(customerId)
		if err != nil {
			// The whole point of this pass is repairing state from evidence. An
			// API error is the absence of evidence, not evidence of absence —
			// marking here would cancel live subscriptions during an Airwallex
			// outage. Leave it; the next pass will try again.
			logger.LogWarn(ctx, fmt.Sprintf("订阅对账：Airwallex 查询失败 user=%d customer=%s: %s", sub.UserId, customerId, err.Error()))
			continue
		}
		if len(active) > 0 {
			continue
		}
		n, err := model.MarkUserSubscriptionsCancelled(sub.UserId, common.GetTimestamp())
		if err != nil {
			logger.LogWarn(ctx, fmt.Sprintf("订阅对账：本地标记失败 user=%d: %s", sub.UserId, err.Error()))
			continue
		}
		if n > 0 {
			marked++
			logger.LogInfo(ctx, fmt.Sprintf("订阅对账：user=%d 在 Airwallex 已无进行中订阅，补记停止续费 rows=%d", sub.UserId, n))
		}
	}
	return marked, nil
}
