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

func TestChangePlanRejectsWhenAlreadyOnTargetPrice(t *testing.T) {
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

	requireRejected(t, w, "已是该套餐")
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
		return []airwallex.BillingSubscription{{Id: "sub_9", Status: "ACTIVE"}}, nil
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
			Switched bool `json:"switched"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(w.Body.Bytes(), &resp))
	require.Equal(t, "success", resp.Message)
	require.True(t, resp.Data.Switched)
}
