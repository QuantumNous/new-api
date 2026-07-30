package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/airwallex"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// setupChangePlanDB wraps setupAirwallexWebhookDB with the extra
// AirwallexBillingCustomer table these tests need (SaveAirwallexBillingCustomerId /
// GetAirwallexBillingCustomerId) that the shared webhook-test DB setup doesn't
// migrate, since no prior Airwallex test exercised the billing-customer lookup.
// It also stubs Airwallex as configured — otherwise airwallexConfigured() would
// reject every request before the change-plan validation rules under test ever
// run, making the rejection tests vacuous.
func setupChangePlanDB(t *testing.T) {
	t.Helper()
	setupAirwallexWebhookDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.AirwallexBillingCustomer{}))

	// GetSubscriptionPlanById caches by plan id in a process-global cache. Each
	// test here gets a fresh in-memory DB whose auto-increment restarts at 1, so
	// plan ids collide across test functions even though the underlying rows
	// differ (e.g. a "pro" plan from one test and an "annual plus" plan from the
	// next can both land on id=2). Without invalidating, a handler call in this
	// test can silently read another test's stale plan row via the cache,
	// producing a wrong-tier rejection instead of the one under test. Sweep a
	// generous id range up front since these tests only ever create a handful of
	// plans per run.
	for i := 1; i <= 50; i++ {
		model.InvalidateSubscriptionPlanCache(i)
	}

	prevEnabled := setting.AirwallexEnabled
	prevClientId := setting.AirwallexClientId
	prevApiKey := setting.AirwallexApiKey
	prevWebhookSecret := setting.AirwallexWebhookSecret
	setting.AirwallexEnabled = true
	setting.AirwallexClientId = "client_test"
	setting.AirwallexApiKey = "key_test"
	setting.AirwallexWebhookSecret = "whsec_test"
	t.Cleanup(func() {
		setting.AirwallexEnabled = prevEnabled
		setting.AirwallexClientId = prevClientId
		setting.AirwallexApiKey = prevApiKey
		setting.AirwallexWebhookSecret = prevWebhookSecret
	})
}

// changePlanRequest builds an authenticated *gin.Context for user 7 posting a
// change-plan request body, mirroring the pattern used elsewhere in this
// package (testCtx + manual c.Set("id", ...)).
func changePlanRequest(t *testing.T, userId int, planId int) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	body := fmt.Sprintf(`{"plan_id":%d}`, planId)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/subscription/airwallex/change-plan", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("id", userId)
	return c, w
}

// failIfCalledListSubscriptions swaps in a stub that fails the test if invoked
// — used to prove a rejection path never reaches Airwallex.
func failIfCalledListSubscriptions(t *testing.T) {
	t.Helper()
	saved := listBillingSubscriptions
	listBillingSubscriptions = func(customerId, status string) ([]airwallex.BillingSubscription, error) {
		t.Fatalf("listBillingSubscriptions must not be called for a rejected request")
		return nil, nil
	}
	t.Cleanup(func() { listBillingSubscriptions = saved })
}

// requireRejected asserts the handler responded with common.ApiErrorMsg/ApiError
// (HTTP 200 with success:false — this codebase never uses non-200 status for
// validation errors, so the response body is the only signal) carrying the
// specific wantMsg. Asserting the exact message (not just success:false) is
// what proves a rejection test failed for the validation rule under test and
// not for some unrelated reason (e.g. Airwallex misconfigured, a stale cached
// plan from another test).
func requireRejected(t *testing.T, w *httptest.ResponseRecorder, wantMsg string) {
	t.Helper()
	require.Equal(t, http.StatusOK, w.Code)
	var resp struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.Unmarshal(w.Body.Bytes(), &resp))
	require.False(t, resp.Success, "expected a rejection, got success message=%q", resp.Message)
	require.Equal(t, wantMsg, resp.Message)
}

// failIfCalledSwitchPrice swaps in a stub that fails the test if invoked.
func failIfCalledSwitchPrice(t *testing.T) {
	t.Helper()
	saved := switchBillingSubscriptionPrice
	switchBillingSubscriptionPrice = func(subId, requestId, oldItemId, newPriceId string) error {
		t.Fatalf("switchBillingSubscriptionPrice must not be called for a rejected request")
		return nil
	}
	t.Cleanup(func() { switchBillingSubscriptionPrice = saved })
}

func TestChangePlanRejectsNonAnnualTarget(t *testing.T) {
	setupChangePlanDB(t)
	require.NoError(t, model.SaveAirwallexBillingCustomerId(7, "bcus_1"))
	failIfCalledListSubscriptions(t)
	failIfCalledSwitchPrice(t)

	// Target plan (id=1, seeded by setupAirwallexWebhookDB) is monthly, not annual.
	c, w := changePlanRequest(t, 7, 1)
	SubscriptionChangePlanAirwallex(c)

	requireRejected(t, w, "仅支持切换到年付套餐")
}

// TestChangePlanRejectsPlanNotFound covers a plan_id that doesn't exist. The
// handler uses common.ApiError(c, err), which surfaces the raw GORM error
// string rather than a curated message — this matches the brief and the
// convention in every sibling payment handler (epay/creem/stripe/waffo_pancake/
// airwallex-pay), so the test asserts the literal GORM message rather than
// pushing the handler toward a curated one.
func TestChangePlanRejectsPlanNotFound(t *testing.T) {
	setupChangePlanDB(t)
	require.NoError(t, model.SaveAirwallexBillingCustomerId(7, "bcus_1"))
	failIfCalledListSubscriptions(t)
	failIfCalledSwitchPrice(t)

	c, w := changePlanRequest(t, 7, 999999) // no plan with this id exists
	SubscriptionChangePlanAirwallex(c)

	requireRejected(t, w, "record not found")
}

// TestChangePlanRejectsDisabledTarget covers a target plan that exists and is
// annual/priced but has Enabled=false.
func TestChangePlanRejectsDisabledTarget(t *testing.T) {
	setupChangePlanDB(t)
	require.NoError(t, model.SaveAirwallexBillingCustomerId(7, "bcus_1"))
	failIfCalledListSubscriptions(t)
	failIfCalledSwitchPrice(t)

	disabled := &model.SubscriptionPlan{
		Title: "JINN Plus 年付（已下线）", PriceAmount: 204, Currency: "CNY",
		DurationUnit: model.SubscriptionDurationYear, DurationValue: 1,
		UpgradeGroup: "plus", AirwallexPriceId: "pri_annual_disabled", Enabled: true,
	}
	require.NoError(t, model.DB.Create(disabled).Error)
	// GORM's `gorm:"default:true"` tag treats a zero-value bool field (false) on
	// Create as "unset" and silently substitutes the default, so Enabled: false
	// in the literal above would have been saved as true. Flip it with an
	// explicit UPDATE instead, then drop the cache entry so the handler's
	// GetSubscriptionPlanById re-reads the disabled row from the DB.
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", disabled.Id).Update("enabled", false).Error)
	model.InvalidateSubscriptionPlanCache(disabled.Id)

	c, w := changePlanRequest(t, 7, disabled.Id)
	SubscriptionChangePlanAirwallex(c)

	requireRejected(t, w, "套餐未启用")
}

// TestChangePlanRejectsEmptyAirwallexPriceId covers a target plan that is
// enabled and annual but has no AirwallexPriceId configured.
func TestChangePlanRejectsEmptyAirwallexPriceId(t *testing.T) {
	setupChangePlanDB(t)
	require.NoError(t, model.SaveAirwallexBillingCustomerId(7, "bcus_1"))
	failIfCalledListSubscriptions(t)
	failIfCalledSwitchPrice(t)

	noPrice := &model.SubscriptionPlan{
		Title: "JINN Plus 年付（未配置价格）", PriceAmount: 204, Currency: "CNY",
		DurationUnit: model.SubscriptionDurationYear, DurationValue: 1,
		UpgradeGroup: "plus", AirwallexPriceId: "", Enabled: true,
	}
	require.NoError(t, model.DB.Create(noPrice).Error)

	c, w := changePlanRequest(t, 7, noPrice.Id)
	SubscriptionChangePlanAirwallex(c)

	requireRejected(t, w, "该套餐未配置 AirwallexPriceId")
}

// TestChangePlanRejectsAnnualToAnnual covers the case where the subscription's
// CURRENT price already resolves to an annual plan. Nothing in the schema
// prevents two enabled annual plans sharing an upgrade_group, so without an
// explicit guard an annual->annual "switch" would be reachable even though
// this endpoint is monthly->annual only.
func TestChangePlanRejectsAnnualToAnnual(t *testing.T) {
	setupChangePlanDB(t)
	require.NoError(t, model.SaveAirwallexBillingCustomerId(7, "bcus_1"))

	currentAnnual := &model.SubscriptionPlan{
		Title: "JINN Plus 年付（当前）", PriceAmount: 204, Currency: "CNY",
		DurationUnit: model.SubscriptionDurationYear, DurationValue: 1,
		UpgradeGroup: "plus", AirwallexPriceId: "pri_annual_current", Enabled: true,
	}
	require.NoError(t, model.DB.Create(currentAnnual).Error)
	targetAnnual := &model.SubscriptionPlan{
		Title: "JINN Plus 年付（目标）", PriceAmount: 204, Currency: "CNY",
		DurationUnit: model.SubscriptionDurationYear, DurationValue: 1,
		UpgradeGroup: "plus", AirwallexPriceId: "pri_annual_target", Enabled: true,
	}
	require.NoError(t, model.DB.Create(targetAnnual).Error)

	// The live subscription's current item is on the OTHER annual price.
	stubSubscriptionItems(t, "pri_annual_current")

	savedList := listBillingSubscriptions
	listBillingSubscriptions = func(customerId, status string) ([]airwallex.BillingSubscription, error) {
		return []airwallex.BillingSubscription{{Id: "sub_1", Status: "ACTIVE"}}, nil
	}
	t.Cleanup(func() { listBillingSubscriptions = savedList })

	failIfCalledSwitchPrice(t)

	c, w := changePlanRequest(t, 7, targetAnnual.Id)
	SubscriptionChangePlanAirwallex(c)

	requireRejected(t, w, "当前已是年付套餐，无需切换")
}

func TestChangePlanRejectsCrossTierSwitch(t *testing.T) {
	setupChangePlanDB(t)
	require.NoError(t, model.SaveAirwallexBillingCustomerId(7, "bcus_1"))

	// Pro annual plan: different upgrade_group than the seeded plus/pri_x plan.
	pro := &model.SubscriptionPlan{
		Title: "JINN Pro 年付", PriceAmount: 1000, Currency: "CNY",
		DurationUnit: model.SubscriptionDurationYear, DurationValue: 1,
		UpgradeGroup: "pro", AirwallexPriceId: "pri_pro_annual", Enabled: true,
	}
	require.NoError(t, model.DB.Create(pro).Error)

	stubSubscriptionItems(t, "pri_x") // current subscription is on the seeded plus/monthly price

	savedList := listBillingSubscriptions
	listBillingSubscriptions = func(customerId, status string) ([]airwallex.BillingSubscription, error) {
		return []airwallex.BillingSubscription{{Id: "sub_1", Status: "ACTIVE"}}, nil
	}
	t.Cleanup(func() { listBillingSubscriptions = savedList })

	failIfCalledSwitchPrice(t)

	c, w := changePlanRequest(t, 7, pro.Id)
	SubscriptionChangePlanAirwallex(c)

	requireRejected(t, w, "仅支持同一档位内切换为年付")
}

// Because the switch is deferred, the Airwallex item is annual while the local
// plan is still monthly until the next billing date — so the card keeps offering
// "switch" and a second click is expected. It must report that the switch is
// already scheduled, not that the user is already on the plan.
func TestChangePlanReportsAlreadyScheduledOnSecondClick(t *testing.T) {
	setupChangePlanDB(t)
	require.NoError(t, model.SaveAirwallexBillingCustomerId(7, "bcus_1"))
	annual := seedAnnualPlan(t)

	// Subscription's current item is already on the target's price.
	stubSubscriptionItems(t, "pri_annual")

	savedList := listBillingSubscriptions
	listBillingSubscriptions = func(customerId, status string) ([]airwallex.BillingSubscription, error) {
		return []airwallex.BillingSubscription{{Id: "sub_1", Status: "ACTIVE"}}, nil
	}
	t.Cleanup(func() { listBillingSubscriptions = savedList })

	failIfCalledSwitchPrice(t)

	c, w := changePlanRequest(t, 7, annual.Id)
	SubscriptionChangePlanAirwallex(c)

	requireRejected(t, w, "年付已安排，将于下次扣款日生效")
}

func TestChangePlanRejectsWhenNoActiveSubscription(t *testing.T) {
	setupChangePlanDB(t)
	require.NoError(t, model.SaveAirwallexBillingCustomerId(7, "bcus_1"))
	annual := seedAnnualPlan(t)

	savedList := listBillingSubscriptions
	listBillingSubscriptions = func(customerId, status string) ([]airwallex.BillingSubscription, error) {
		return []airwallex.BillingSubscription{}, nil
	}
	t.Cleanup(func() { listBillingSubscriptions = savedList })

	failIfCalledSwitchPrice(t)

	c, w := changePlanRequest(t, 7, annual.Id)
	SubscriptionChangePlanAirwallex(c)

	requireRejected(t, w, "无进行中的订阅")
}

func TestChangePlanRejectsWhenMultipleActiveSubscriptions(t *testing.T) {
	setupChangePlanDB(t)
	require.NoError(t, model.SaveAirwallexBillingCustomerId(7, "bcus_1"))
	annual := seedAnnualPlan(t)

	savedList := listBillingSubscriptions
	listBillingSubscriptions = func(customerId, status string) ([]airwallex.BillingSubscription, error) {
		return []airwallex.BillingSubscription{
			{Id: "sub_1", Status: "ACTIVE"},
			{Id: "sub_2", Status: "ACTIVE"},
		}, nil
	}
	t.Cleanup(func() { listBillingSubscriptions = savedList })

	failIfCalledSwitchPrice(t)

	c, w := changePlanRequest(t, 7, annual.Id)
	SubscriptionChangePlanAirwallex(c)

	requireRejected(t, w, "订阅状态异常，请联系客服")
}

func TestChangePlanRejectsWhenItemCountNotOne(t *testing.T) {
	setupChangePlanDB(t)
	require.NoError(t, model.SaveAirwallexBillingCustomerId(7, "bcus_1"))
	annual := seedAnnualPlan(t)

	saved := getBillingSubscriptionItems
	getBillingSubscriptionItems = func(subId string) ([]airwallex.BillingSubscriptionItem, error) {
		return []airwallex.BillingSubscriptionItem{}, nil
	}
	t.Cleanup(func() { getBillingSubscriptionItems = saved })

	savedList := listBillingSubscriptions
	listBillingSubscriptions = func(customerId, status string) ([]airwallex.BillingSubscription, error) {
		return []airwallex.BillingSubscription{{Id: "sub_1", Status: "ACTIVE"}}, nil
	}
	t.Cleanup(func() { listBillingSubscriptions = savedList })

	failIfCalledSwitchPrice(t)

	c, w := changePlanRequest(t, 7, annual.Id)
	SubscriptionChangePlanAirwallex(c)

	requireRejected(t, w, "订阅状态异常，请联系客服")
}

// TestChangePlanSwitchesPriceWithItemId is the happy path from the brief: it
// asserts the exact arguments reaching Airwallex.
func TestChangePlanSwitchesPriceWithItemId(t *testing.T) {
	setupChangePlanDB(t)
	annual := seedAnnualPlan(t) // from Task 4's test file
	monthly := &model.SubscriptionPlan{Title: "JINN Plus", PriceAmount: 20, Currency: "CNY",
		DurationUnit: model.SubscriptionDurationMonth, DurationValue: 1,
		UpgradeGroup: "plus", AirwallexPriceId: "pri_monthly", Enabled: true}
	if err := model.DB.Create(monthly).Error; err != nil {
		t.Fatal(err)
	}
	stubSubscriptionItems(t, "pri_monthly")

	require.NoError(t, model.SaveAirwallexBillingCustomerId(7, "bcus_1"))

	savedList := listBillingSubscriptions
	listBillingSubscriptions = func(customerId, status string) ([]airwallex.BillingSubscription, error) {
		return []airwallex.BillingSubscription{
			{Id: "sub_9", Status: "ACTIVE", NextBillingAt: "2026-08-30T06:44:43+0000"},
		}, nil
	}
	t.Cleanup(func() { listBillingSubscriptions = savedList })

	var gotSub, gotItem, gotPrice string
	savedSwitch := switchBillingSubscriptionPrice
	switchBillingSubscriptionPrice = func(subId, requestId, oldItemId, newPriceId string) error {
		gotSub, gotItem, gotPrice = subId, oldItemId, newPriceId
		return nil
	}
	t.Cleanup(func() { switchBillingSubscriptionPrice = savedSwitch })

	c, w := changePlanRequest(t, 7, annual.Id)
	SubscriptionChangePlanAirwallex(c)

	require.Equal(t, http.StatusOK, w.Code)
	if gotSub != "sub_9" || gotItem != "sit_1" || gotPrice != "pri_annual" {
		t.Fatalf("wrong switch args: sub=%s item=%s price=%s", gotSub, gotItem, gotPrice)
	}

	var resp struct {
		Message string `json:"message"`
		Data    struct {
			Switched    bool   `json:"switched"`
			Deferred    bool   `json:"deferred"`
			EffectiveAt string `json:"effective_at"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(w.Body.Bytes(), &resp))
	require.Equal(t, "success", resp.Message)
	require.True(t, resp.Data.Switched)

	// The switch is scheduled, not applied: the response must say so and carry
	// the date it lands on, because the portal shows that date to the customer.
	// Dropping either field would let the UI imply the plan changed today, when
	// no money has moved and the local plan is still monthly.
	require.True(t, resp.Data.Deferred, "response must mark the switch as deferred")
	require.Equal(t, "2026-08-30T06:44:43+0000", resp.Data.EffectiveAt)
}
