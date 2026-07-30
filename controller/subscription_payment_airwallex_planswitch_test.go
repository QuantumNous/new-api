package controller

import (
	"errors"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/airwallex"
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

// An items lookup failure must not silently drop the plan change; falling back
// to the original plan is correct only when the price is genuinely unmapped.
func TestInvoicePaidItemsErrorFallsBackToOriginalPlan(t *testing.T) {
	setupAirwallexWebhookDB(t)
	orig := seedAirwallexOrigOrder(t, common.TopUpStatusSuccess, time.Now().Add(-60*24*time.Hour).Unix())
	stubBillingSubscriptionSeam(t)
	saved := getBillingSubscriptionItems
	getBillingSubscriptionItems = func(subId string) ([]airwallex.BillingSubscriptionItem, error) {
		return nil, errNoItems
	}
	t.Cleanup(func() { getBillingSubscriptionItems = saved })

	ev := makeInvoiceEvent("inv_err", "INV-0004", time.Now())
	if err := handleAirwallexInvoicePaid(testCtx(), ev); err != nil {
		t.Fatal(err)
	}
	var order model.SubscriptionOrder
	if err := model.DB.Where("trade_no LIKE ?", "%inv_err").First(&order).Error; err != nil {
		t.Fatal(err)
	}
	if order.PlanId != orig.PlanId {
		t.Fatalf("want fallback to plan %d, got %d", orig.PlanId, order.PlanId)
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
