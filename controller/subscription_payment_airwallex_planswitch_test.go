package controller

import (
	"errors"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/airwallex"
	"gorm.io/gorm"
)

// seedAnnualPlan inserts a yearly plan row mapped to pri_annual.
func seedAnnualPlan(t *testing.T) *model.SubscriptionPlan {
	t.Helper()
	p := &model.SubscriptionPlan{
		Title: "JINN Plus 年付", PriceAmount: 204, Currency: "CNY",
		DurationUnit: model.SubscriptionDurationYear, DurationValue: 1,
		UpgradeGroup: "plus", AirwallexPriceId: "pri_annual", Enabled: true,
	}
	if err := model.DB.Create(p).Error; err != nil {
		t.Fatal(err)
	}
	return p
}

func stubSubscriptionItems(t *testing.T, priceId string) {
	t.Helper()
	saved := getBillingSubscriptionItems
	getBillingSubscriptionItems = func(subId string) ([]airwallex.BillingSubscriptionItem, error) {
		it := airwallex.BillingSubscriptionItem{Id: "sit_1"}
		it.Price.Id = priceId
		return []airwallex.BillingSubscriptionItem{it}, nil
	}
	t.Cleanup(func() { getBillingSubscriptionItems = saved })
}

// A proration invoice inside the 7-day first-cycle window must NOT be skipped
// when the subscription has moved to a different price.
func TestInvoicePaidPlanSwitchOverridesFirstCycleSkip(t *testing.T) {
	setupAirwallexWebhookDB(t)
	orig := seedAirwallexOrigOrder(t, common.TopUpStatusSuccess, time.Now().Unix())
	annual := seedAnnualPlan(t)
	stubBillingSubscriptionSeam(t)
	stubSubscriptionItems(t, "pri_annual")

	before := countRenewalOrders(t)
	ev := makeInvoiceEvent("inv_switch", "INV-0002", time.Now())
	if err := handleAirwallexInvoicePaid(testCtx(), ev); err != nil {
		t.Fatal(err)
	}
	if countRenewalOrders(t) != before+1 {
		t.Fatal("plan-switch invoice must create an order even inside the first-cycle window")
	}

	var order model.SubscriptionOrder
	if err := model.DB.Where("trade_no LIKE ?", "%inv_switch").First(&order).Error; err != nil {
		t.Fatal(err)
	}
	if order.PlanId != annual.Id {
		t.Fatalf("order must use the annual plan %d, got %d", annual.Id, order.PlanId)
	}

	var reloaded model.SubscriptionOrder
	if err := model.DB.First(&reloaded, orig.Id).Error; err != nil {
		t.Fatal(err)
	}
	if reloaded.PlanId != annual.Id {
		t.Fatalf("anchor order must be repointed to %d so later renewals stay annual, got %d", annual.Id, reloaded.PlanId)
	}
}

// An ordinary renewal (price unchanged) keeps the original plan and still
// honours the first-cycle skip.
func TestInvoicePaidUnchangedPriceKeepsOriginalPlan(t *testing.T) {
	setupAirwallexWebhookDB(t)
	orig := seedAirwallexOrigOrder(t, common.TopUpStatusSuccess, time.Now().Add(-60*24*time.Hour).Unix())
	stubBillingSubscriptionSeam(t)
	stubSubscriptionItems(t, "pri_unmapped_monthly")

	ev := makeInvoiceEvent("inv_renew", "INV-0003", time.Now())
	if err := handleAirwallexInvoicePaid(testCtx(), ev); err != nil {
		t.Fatal(err)
	}
	var order model.SubscriptionOrder
	if err := model.DB.Where("trade_no LIKE ?", "%inv_renew").First(&order).Error; err != nil {
		t.Fatal(err)
	}
	if order.PlanId != orig.PlanId {
		t.Fatalf("unmapped price must fall back to the original plan %d, got %d", orig.PlanId, order.PlanId)
	}
}

// An items lookup failure must NOT fall back to the original plan. Airwallex
// has already switched the subscription and charged for it by the time this
// webhook fires; guessing wrong here would grant the wrong plan on an invoice
// that is keyed by id and can never be reprocessed. The handler must return an
// error so the webhook 500s and Airwallex retries delivery, and must create no
// order in the meantime.
func TestInvoicePaidItemsErrorReturnsErrorAndCreatesNoOrder(t *testing.T) {
	setupAirwallexWebhookDB(t)
	seedAirwallexOrigOrder(t, common.TopUpStatusSuccess, time.Now().Add(-60*24*time.Hour).Unix())
	stubBillingSubscriptionSeam(t)
	saved := getBillingSubscriptionItems
	getBillingSubscriptionItems = func(subId string) ([]airwallex.BillingSubscriptionItem, error) {
		return nil, errNoItems
	}
	t.Cleanup(func() { getBillingSubscriptionItems = saved })

	before := countRenewalOrders(t)
	ev := makeInvoiceEvent("inv_err", "INV-0004", time.Now())
	if err := handleAirwallexInvoicePaid(testCtx(), ev); err == nil {
		t.Fatal("items lookup failure must return an error so the webhook 500s and Airwallex retries delivery")
	}
	if countRenewalOrders(t) != before {
		t.Fatal("items lookup failure must not create a renewal order")
	}
	var order model.SubscriptionOrder
	if err := model.DB.Where("trade_no LIKE ?", "%inv_err").First(&order).Error; err == nil {
		t.Fatal("no order should exist for a failed items lookup")
	}
}

// A per-item plan-resolution error (model.GetSubscriptionPlanByAirwallexPriceId
// failing, e.g. a transient DB error) must be treated the same way as an items
// lookup error: return an error, create no order. Simulated here by dropping
// the subscription_plans table out from under the lookup.
func TestInvoicePaidPlanLookupErrorReturnsErrorAndCreatesNoOrder(t *testing.T) {
	setupAirwallexWebhookDB(t)
	seedAirwallexOrigOrder(t, common.TopUpStatusSuccess, time.Now().Add(-60*24*time.Hour).Unix())
	stubBillingSubscriptionSeam(t)
	stubSubscriptionItems(t, "pri_annual")

	if err := model.DB.Migrator().DropTable(&model.SubscriptionPlan{}); err != nil {
		t.Fatal(err)
	}

	before := countRenewalOrders(t)
	ev := makeInvoiceEvent("inv_planerr", "INV-0006", time.Now())
	if err := handleAirwallexInvoicePaid(testCtx(), ev); err == nil {
		t.Fatal("plan lookup failure must return an error so the webhook 500s and Airwallex retries delivery")
	}
	if countRenewalOrders(t) != before {
		t.Fatal("plan lookup failure must not create a renewal order")
	}
}

// Retry-safety for the expire+repoint pair: if the anchor-order repoint fails
// after the supersede/expire step already succeeded, the anchor order's
// PlanId is left unchanged in the DB, so a webhook retry recomputes
// planChanged=true and re-runs both steps. The expire is idempotent (it only
// matches status="active" rows) so re-running it on retry is safe, and the
// retry's repoint then succeeds — leaving no duplicate active subscription.
func TestInvoicePaidPlanSwitchRetriesAfterRepointFailure(t *testing.T) {
	setupAirwallexWebhookDB(t)
	orig := seedAirwallexOrigOrder(t, common.TopUpStatusSuccess, time.Now().Add(-60*24*time.Hour).Unix())
	annual := seedAnnualPlan(t)
	stubBillingSubscriptionSeam(t)
	stubSubscriptionItems(t, "pri_annual")

	active := &model.UserSubscription{
		UserId: orig.UserId, PlanId: 1, Status: "active",
		StartTime: time.Now().Unix(), EndTime: time.Now().Add(15 * 24 * time.Hour).Unix(),
	}
	if err := model.DB.Create(active).Error; err != nil {
		t.Fatal(err)
	}

	// Fail exactly one Update on the anchor order (matched by trade_no), so the
	// repoint step fails the first time it runs but a retry succeeds.
	failNext := true
	if err := model.DB.Callback().Update().Before("gorm:update").Register("test:fail_anchor_repoint", func(tx *gorm.DB) {
		if !failNext {
			return
		}
		if so, ok := tx.Statement.Dest.(*model.SubscriptionOrder); ok && so.TradeNo == orig.TradeNo {
			failNext = false
			_ = tx.AddError(errors.New("simulated repoint failure"))
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = model.DB.Callback().Update().Remove("test:fail_anchor_repoint") })

	ev := makeInvoiceEvent("inv_retry", "INV-0007", time.Now())

	// First delivery: expire succeeds, repoint fails -> handler returns an error.
	if err := handleAirwallexInvoicePaid(testCtx(), ev); err == nil {
		t.Fatal("expected the simulated repoint failure to surface as an error")
	}
	var reloadedAfterFailure model.SubscriptionOrder
	if err := model.DB.First(&reloadedAfterFailure, orig.Id).Error; err != nil {
		t.Fatal(err)
	}
	if reloadedAfterFailure.PlanId != 1 {
		t.Fatalf("anchor order must NOT be repointed when the repoint step failed, got %d", reloadedAfterFailure.PlanId)
	}
	var activeCountAfterFailure int64
	if err := model.DB.Model(&model.UserSubscription{}).
		Where("user_id = ? AND plan_id = ? AND status = ?", orig.UserId, 1, "active").
		Count(&activeCountAfterFailure).Error; err != nil {
		t.Fatal(err)
	}
	if activeCountAfterFailure != 0 {
		t.Fatal("expire must have already run before the repoint failed")
	}

	// Retry (webhook redelivery): planChanged recomputes true since orig.PlanId
	// is still 1, so both steps re-run; this time the repoint succeeds.
	if err := handleAirwallexInvoicePaid(testCtx(), ev); err != nil {
		t.Fatalf("retry must succeed once the repoint step is no longer forced to fail: %v", err)
	}
	var reloadedAfterRetry model.SubscriptionOrder
	if err := model.DB.First(&reloadedAfterRetry, orig.Id).Error; err != nil {
		t.Fatal(err)
	}
	if reloadedAfterRetry.PlanId != annual.Id {
		t.Fatalf("anchor order must be repointed to %d after the retry, got %d", annual.Id, reloadedAfterRetry.PlanId)
	}

	// No duplicate active subscriptions: old plan fully expired, and the retry
	// must not have created a second renewal order for the same invoice id.
	if countRenewalOrders(t) != 1 {
		t.Fatalf("retry must not create a duplicate renewal order, got %d", countRenewalOrders(t))
	}
}

// Mapped price that resolves to the SAME plan the order is already on: the
// common real-world path for an ordinary renewal. Must keep plan 1 and must
// NOT trigger any supersede/repoint (planChanged branch must stay dormant).
func TestInvoicePaidMappedPriceUnchangedPlanNoSupersede(t *testing.T) {
	setupAirwallexWebhookDB(t)
	orig := seedAirwallexOrigOrder(t, common.TopUpStatusSuccess, time.Now().Add(-60*24*time.Hour).Unix())
	stubBillingSubscriptionSeam(t)
	stubSubscriptionItems(t, "pri_x") // maps to the already-seeded plan id=1

	// Seed an active UserSubscription on plan 1: if the handler mistakenly
	// treated "mapped to the same plan" as a plan change, it would call
	// ExpireSupersededUserSubscriptions(userId, oldPlanId=1, ...) and expire
	// this row even though nothing changed.
	active := &model.UserSubscription{
		UserId: orig.UserId, PlanId: 1, Status: "active",
		StartTime: time.Now().Unix(), EndTime: time.Now().Add(30 * 24 * time.Hour).Unix(),
	}
	if err := model.DB.Create(active).Error; err != nil {
		t.Fatal(err)
	}

	ev := makeInvoiceEvent("inv_same", "INV-0005", time.Now())
	if err := handleAirwallexInvoicePaid(testCtx(), ev); err != nil {
		t.Fatal(err)
	}
	var order model.SubscriptionOrder
	if err := model.DB.Where("trade_no LIKE ?", "%inv_same").First(&order).Error; err != nil {
		t.Fatal(err)
	}
	if order.PlanId != 1 {
		t.Fatalf("mapped-but-unchanged price must keep plan 1, got %d", order.PlanId)
	}

	var reloaded model.SubscriptionOrder
	if err := model.DB.First(&reloaded, orig.Id).Error; err != nil {
		t.Fatal(err)
	}
	if reloaded.PlanId != 1 {
		t.Fatalf("anchor order must NOT be repointed when the plan is unchanged, got %d", reloaded.PlanId)
	}

	// No superseded UserSubscription rows should exist for this user/plan since
	// no supersede call should have fired.
	var n int64
	if err := model.DB.Model(&model.UserSubscription{}).
		Where("user_id = ? AND status = ?", orig.UserId, "expired").Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("no supersede should have happened for an unchanged plan, found %d expired rows", n)
	}
}

var errNoItems = errors.New("items unavailable")
