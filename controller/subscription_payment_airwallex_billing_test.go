package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/airwallex"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// initAirwallexWebhookColNames triggers model.initCol() as a side-effect so
// commonGroupCol (used inside CompleteSubscriptionOrder's cascade) is populated.
// Mirrors the pattern in model_list_test.go / initModelListColumnNames.
func initAirwallexWebhookColNames(t *testing.T) {
	t.Helper()

	savedIsMaster := common.IsMasterNode
	savedSQLitePath := common.SQLitePath
	savedUsingSQLite := common.UsingSQLite
	savedUsingMySQL := common.UsingMySQL
	savedUsingPostgreSQL := common.UsingPostgreSQL
	savedSQL, hadSQL := os.LookupEnv("SQL_DSN")

	defer func() {
		common.IsMasterNode = savedIsMaster
		common.SQLitePath = savedSQLitePath
		common.UsingSQLite = savedUsingSQLite
		common.UsingMySQL = savedUsingMySQL
		common.UsingPostgreSQL = savedUsingPostgreSQL
		if hadSQL {
			_ = os.Setenv("SQL_DSN", savedSQL)
		} else {
			_ = os.Unsetenv("SQL_DSN")
		}
	}()

	// IsMasterNode=false: InitDB opens the DB (triggering initCol) but skips full
	// migration, so it returns immediately and is cheap.
	common.IsMasterNode = false
	common.SQLitePath = fmt.Sprintf("file:%s_colinit?mode=memory&cache=shared",
		strings.ReplaceAll(t.Name(), "/", "_"))
	common.UsingSQLite = false
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	require.NoError(t, os.Setenv("SQL_DSN", "local"))

	require.NoError(t, model.InitDB())
	if model.DB != nil {
		sqlDB, _ := model.DB.DB()
		if sqlDB != nil {
			_ = sqlDB.Close()
		}
	}
}

// setupAirwallexWebhookDB creates a fresh in-memory SQLite database, migrates
// the tables touched by CompleteSubscriptionOrder's cascade, and seeds a plan
// (id=1, plus) and a user (id=7).
func setupAirwallexWebhookDB(t *testing.T) {
	t.Helper()

	// Ensure model column-name vars (commonGroupCol etc.) are initialised.
	initAirwallexWebhookColNames(t)

	gin.SetMode(gin.TestMode)
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared",
		strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db

	// AutoMigrate the full cascade set: order → plan → user/UserSubscription/TopUp/Log.
	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.Log{},
		&model.TopUp{},
		&model.SubscriptionPlan{},
		&model.SubscriptionOrder{},
		&model.UserSubscription{},
	))

	// Seed subscription plan (id=1, Plus, CNY 20/month, upgrades to "plus" group).
	plan := &model.SubscriptionPlan{
		Id:               1,
		Title:            "Plus",
		PriceAmount:      20.0,
		Currency:         "CNY",
		DurationUnit:     "month",
		DurationValue:    1,
		Enabled:          true,
		UpgradeGroup:     "plus",
		AirwallexPriceId: "pri_x",
	}
	require.NoError(t, db.Create(plan).Error)

	// Seed user (id=7, default group).
	user := &model.User{
		Id:       7,
		Username: "test-user-awx",
		Password: "password1",
		Group:    "default",
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, db.Create(user).Error)

	t.Cleanup(func() {
		sqlDB, _ := db.DB()
		if sqlDB != nil {
			_ = sqlDB.Close()
		}
	})
}

// testCtx returns a minimal *gin.Context backed by a real *http.Request so that
// handler calls to c.Request.Context() do not panic.
func testCtx() *gin.Context {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/", nil)
	return c
}

// loadEvent reads a JSON fixture from path and unmarshals it into an airwallexEvent.
func loadEvent(t *testing.T, path string) airwallexEvent {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var ev airwallexEvent
	if err := common.Unmarshal(raw, &ev); err != nil {
		t.Fatal(err)
	}
	return ev
}

// TestBillingCheckoutCompletedExtractsTradeNo verifies that
// handleAirwallexBillingCheckoutCompleted resolves trade_no from the event
// object's metadata and completes the pending subscription order.
func TestBillingCheckoutCompletedExtractsTradeNo(t *testing.T) {
	setupAirwallexWebhookDB(t)

	// Seed a pending order whose trade_no matches the fixture's metadata.trade_no.
	order := &model.SubscriptionOrder{
		UserId:          7,
		PlanId:          1,
		Money:           20.0,
		TradeNo:         "sub_capture_0708",
		PaymentMethod:   model.PaymentMethodCard,
		PaymentProvider: model.PaymentProviderAirwallex,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, order.Insert())

	ev := loadEvent(t, "testdata/awx_billing_checkout_completed.json")
	require.NoError(t, handleAirwallexBillingCheckoutCompleted(testCtx(), ev))

	o := model.GetSubscriptionOrderByTradeNo("sub_capture_0708")
	require.NotNil(t, o, "order must exist after completion")
	require.Equal(t, common.TopUpStatusSuccess, o.Status, "order must be succeeded")
}

// TestAirwallexWebhookBillingCheckoutCompletedEndToEnd drives a real
// billing_checkout.completed payload through the full signed webhook path
// (signature → envelope parse → event routing → handler). Airwallex Billing
// events place the resource DIRECTLY under "data" (not nested under
// "data.object" like Payment Acceptance events); this is the regression for the
// 2026-07-08 charged-but-not-upgraded incident, where the parser read an empty
// object and the handler logged "无 trade_no metadata，忽略".
func TestAirwallexWebhookBillingCheckoutCompletedEndToEnd(t *testing.T) {
	setupAirwallexWebhookDB(t)

	prev := setting.AirwallexWebhookSecret
	setting.AirwallexWebhookSecret = "whsec_test"
	t.Cleanup(func() { setting.AirwallexWebhookSecret = prev })

	order := &model.SubscriptionOrder{
		UserId:          7,
		PlanId:          1,
		Money:           20.0,
		TradeNo:         "sub_capture_0708",
		PaymentMethod:   model.PaymentMethodCard,
		PaymentProvider: model.PaymentProviderAirwallex,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, order.Insert())

	body, err := os.ReadFile("testdata/awx_billing_checkout_completed.json")
	require.NoError(t, err)

	w := webhookRequest(t, "whsec_test", body, true)
	require.Equal(t, http.StatusOK, w.Code)

	o := model.GetSubscriptionOrderByTradeNo("sub_capture_0708")
	require.NotNil(t, o, "order must exist after completion")
	require.Equal(t, common.TopUpStatusSuccess, o.Status,
		"billing_checkout.completed with data-direct envelope must upgrade the user")
}

// TestBillingCheckoutCompletedResolvesViaSubscription verifies that a real slim
// billing_checkout.completed webhook — which carries NO metadata on the checkout
// object (SUBSCRIPTION-mode checkouts persist metadata on the managed
// subscription, not the checkout) — still resolves trade_no via the subscription
// seam and completes the order. Regression for the 2026-07-08 charged-but-not-
// upgraded incident, where the handler only looked at checkout metadata and
// logged "无 trade_no metadata，忽略".
func TestBillingCheckoutCompletedResolvesViaSubscription(t *testing.T) {
	setupAirwallexWebhookDB(t)

	order := &model.SubscriptionOrder{
		UserId:          7,
		PlanId:          1,
		Money:           20.0,
		TradeNo:         "sub_capture_0708",
		PaymentMethod:   model.PaymentMethodCard,
		PaymentProvider: model.PaymentProviderAirwallex,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, order.Insert())

	// Re-fetched checkout also carries no metadata (SUBSCRIPTION-mode checkouts
	// don't persist it) but does expose the subscription_id.
	savedCheckout := getBillingCheckout
	getBillingCheckout = func(id string) (*airwallex.BillingCheckout, error) {
		return &airwallex.BillingCheckout{
			Id:             id,
			Status:         "COMPLETED",
			SubscriptionId: "sub_sgpdwssjlhk6pph640l",
		}, nil
	}
	t.Cleanup(func() { getBillingCheckout = savedCheckout })

	// Slim checkout carries no metadata; trade_no lives on the subscription.
	savedSeam := getBillingSubscription
	getBillingSubscription = func(id string) (*airwallex.BillingSubscription, error) {
		require.Equal(t, "sub_sgpdwssjlhk6pph640l", id, "must resolve via subscription_id")
		return &airwallex.BillingSubscription{
			Id:       id,
			Metadata: map[string]string{"trade_no": "sub_capture_0708"},
		}, nil
	}
	t.Cleanup(func() { getBillingSubscription = savedSeam })

	ev := loadEvent(t, "testdata/awx_billing_checkout_completed_slim.json")
	require.NoError(t, handleAirwallexBillingCheckoutCompleted(testCtx(), ev))

	o := model.GetSubscriptionOrderByTradeNo("sub_capture_0708")
	require.NotNil(t, o, "order must exist after completion")
	require.Equal(t, common.TopUpStatusSuccess, o.Status, "order must be succeeded via subscription fallback")
}

// TestBillingCheckoutCompletedResolvesViaCheckoutSubscriptionData verifies the
// case where Airwallex surfaces our trade_no ONLY under the re-fetched checkout's
// subscription_data.metadata (not top-level checkout metadata, and with no
// reachable subscription). The handler must still resolve it without ever calling
// getBillingSubscription.
func TestBillingCheckoutCompletedResolvesViaCheckoutSubscriptionData(t *testing.T) {
	setupAirwallexWebhookDB(t)

	order := &model.SubscriptionOrder{
		UserId:          7,
		PlanId:          1,
		Money:           20.0,
		TradeNo:         "sub_capture_0708",
		PaymentMethod:   model.PaymentMethodCard,
		PaymentProvider: model.PaymentProviderAirwallex,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, order.Insert())

	savedCheckout := getBillingCheckout
	getBillingCheckout = func(id string) (*airwallex.BillingCheckout, error) {
		co := &airwallex.BillingCheckout{Id: id, Status: "COMPLETED"}
		co.SubscriptionData.Metadata = map[string]string{"trade_no": "sub_capture_0708"}
		return co, nil
	}
	t.Cleanup(func() { getBillingCheckout = savedCheckout })

	// Subscription seam must never be hit — trade_no is on the checkout itself.
	savedSeam := getBillingSubscription
	getBillingSubscription = func(id string) (*airwallex.BillingSubscription, error) {
		t.Fatalf("getBillingSubscription must not be called; trade_no is on subscription_data.metadata (id=%s)", id)
		return nil, nil
	}
	t.Cleanup(func() { getBillingSubscription = savedSeam })

	ev := loadEvent(t, "testdata/awx_billing_checkout_completed_slim.json")
	require.NoError(t, handleAirwallexBillingCheckoutCompleted(testCtx(), ev))

	o := model.GetSubscriptionOrderByTradeNo("sub_capture_0708")
	require.NotNil(t, o, "order must exist after completion")
	require.Equal(t, common.TopUpStatusSuccess, o.Status, "order must be succeeded via checkout.subscription_data.metadata")
}

// seedAirwallexOrigOrder inserts the original (first-cycle) subscription order
// with the given status and create time.
func seedAirwallexOrigOrder(t *testing.T, status string, createTime int64) *model.SubscriptionOrder {
	t.Helper()
	orig := &model.SubscriptionOrder{
		UserId:          7,
		PlanId:          1,
		Money:           20.0,
		TradeNo:         "sub_capture_0708",
		PaymentMethod:   model.PaymentMethodCard,
		PaymentProvider: model.PaymentProviderAirwallex,
		CreateTime:      createTime,
		Status:          status,
	}
	require.NoError(t, orig.Insert())
	return orig
}

// stubBillingSubscriptionSeam makes the handler resolve trade_no without a live
// Airwallex API call.
func stubBillingSubscriptionSeam(t *testing.T) {
	t.Helper()
	savedSeam := getBillingSubscription
	getBillingSubscription = func(id string) (*airwallex.BillingSubscription, error) {
		return &airwallex.BillingSubscription{
			Id:       id,
			Metadata: map[string]string{"trade_no": "sub_capture_0708"},
		}, nil
	}
	t.Cleanup(func() { getBillingSubscription = savedSeam })
}

// makeInvoiceEvent builds an invoice.payment.paid event with the data-direct
// Billing envelope shape (resource fields directly under data).
func makeInvoiceEvent(invoiceId, number string, createdAt time.Time) airwallexEvent {
	obj := map[string]any{
		"subscription_id": "sub_hkdmwssjlhk6pph640l",
		"payment_status":  "PAID",
		"created_at":      createdAt.UTC().Format("2006-01-02T15:04:05-0700"),
	}
	if invoiceId != "" {
		obj["id"] = invoiceId
	}
	if number != "" {
		obj["number"] = number
	}
	return airwallexEvent{
		Id:   "evt_test_" + invoiceId,
		Name: "invoice.payment.paid",
		Data: airwallexEventData{Object: obj},
	}
}

// countRenewalOrders returns how many orders exist whose trade_no marks them as
// renewals of the seeded original order.
func countRenewalOrders(t *testing.T) int64 {
	t.Helper()
	var n int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).
		Where("trade_no LIKE ?", "sub_capture_0708-r%").Count(&n).Error)
	return int64(n)
}

// TestInvoicePaidSkipsFirstCycleAfterCheckoutCompleted reproduces the
// double-activation bug: billing_checkout.completed was processed FIRST (order
// already success), then the first-cycle invoice.payment.paid arrives (delivery
// order is not guaranteed; a 500'd delivery is retried hours later). The
// handler must recognize the invoice as first-cycle from the invoice itself
// (sequence number / created_at) and NOT mint a renewal order.
func TestInvoicePaidSkipsFirstCycleAfterCheckoutCompleted(t *testing.T) {
	setupAirwallexWebhookDB(t)
	seedAirwallexOrigOrder(t, common.TopUpStatusSuccess, time.Now().Unix())
	stubBillingSubscriptionSeam(t)
	stubSubscriptionItems(t, "pri_x") // price unchanged: ordinary renewal, not a plan switch

	// Real first-cycle payload: number INV-…-0001, created moments after checkout.
	ev := loadEvent(t, "testdata/awx_invoice_paid.json")
	require.NoError(t, handleAirwallexInvoicePaid(testCtx(), ev))

	require.EqualValues(t, 0, countRenewalOrders(t),
		"first-cycle invoice after checkout completion must not create a renewal order")
}

// TestInvoicePaidRenewalKeyedOnInvoiceId verifies a genuine renewal invoice
// (sequence > 1, created ~1 month after the original order) creates a completed
// renewal order whose trade_no embeds the Airwallex invoice id — not the
// processing month, which double-charges across a month-boundary retry.
func TestInvoicePaidRenewalKeyedOnInvoiceId(t *testing.T) {
	setupAirwallexWebhookDB(t)
	seedAirwallexOrigOrder(t, common.TopUpStatusSuccess, time.Now().Add(-32*24*time.Hour).Unix())
	stubBillingSubscriptionSeam(t)
	stubSubscriptionItems(t, "pri_x") // price unchanged: ordinary renewal, not a plan switch

	ev := makeInvoiceEvent("inv_renewal_aug", "INV-PR2OS7ZL-0002", time.Now())
	require.NoError(t, handleAirwallexInvoicePaid(testCtx(), ev))

	renew := model.GetSubscriptionOrderByTradeNo("sub_capture_0708-r-inv_renewal_aug")
	require.NotNil(t, renew, "renewal order must be keyed on the invoice id")
	require.Equal(t, common.TopUpStatusSuccess, renew.Status, "renewal order must be succeeded")
}

// TestInvoicePaidRenewalReplayIdempotent verifies redelivery of the same
// renewal invoice event (Airwallex retries) completes exactly one order.
func TestInvoicePaidRenewalReplayIdempotent(t *testing.T) {
	setupAirwallexWebhookDB(t)
	seedAirwallexOrigOrder(t, common.TopUpStatusSuccess, time.Now().Add(-32*24*time.Hour).Unix())
	stubBillingSubscriptionSeam(t)
	stubSubscriptionItems(t, "pri_x") // price unchanged: ordinary renewal, not a plan switch

	ev := makeInvoiceEvent("inv_renewal_aug", "INV-PR2OS7ZL-0002", time.Now())
	require.NoError(t, handleAirwallexInvoicePaid(testCtx(), ev))
	require.NoError(t, handleAirwallexInvoicePaid(testCtx(), ev))

	require.EqualValues(t, 1, countRenewalOrders(t), "replayed invoice event must not mint a second renewal")
	renew := model.GetSubscriptionOrderByTradeNo("sub_capture_0708-r-inv_renewal_aug")
	require.NotNil(t, renew)
	require.Equal(t, common.TopUpStatusSuccess, renew.Status)
}

// TestInvoicePaidDistinctInvoicesCreateDistinctRenewals verifies two different
// renewal invoices each get their own order even when processed in the same
// calendar month (the month-key scheme silently collapsed them).
func TestInvoicePaidDistinctInvoicesCreateDistinctRenewals(t *testing.T) {
	setupAirwallexWebhookDB(t)
	seedAirwallexOrigOrder(t, common.TopUpStatusSuccess, time.Now().Add(-70*24*time.Hour).Unix())
	stubBillingSubscriptionSeam(t)
	stubSubscriptionItems(t, "pri_x") // price unchanged: ordinary renewal, not a plan switch

	require.NoError(t, handleAirwallexInvoicePaid(testCtx(),
		makeInvoiceEvent("inv_renewal_a", "INV-PR2OS7ZL-0002", time.Now().Add(-35*24*time.Hour))))
	require.NoError(t, handleAirwallexInvoicePaid(testCtx(),
		makeInvoiceEvent("inv_renewal_b", "INV-PR2OS7ZL-0003", time.Now())))

	require.EqualValues(t, 2, countRenewalOrders(t), "distinct invoices must create distinct renewal orders")
}

// TestInvoicePaidMissingInvoiceIdIgnored verifies an invoice event without an
// id is logged and ignored — no idempotency key means no safe order creation.
func TestInvoicePaidMissingInvoiceIdIgnored(t *testing.T) {
	setupAirwallexWebhookDB(t)
	seedAirwallexOrigOrder(t, common.TopUpStatusSuccess, time.Now().Add(-32*24*time.Hour).Unix())
	stubBillingSubscriptionSeam(t)

	ev := makeInvoiceEvent("", "INV-PR2OS7ZL-0002", time.Now())
	require.NoError(t, handleAirwallexInvoicePaid(testCtx(), ev))

	require.EqualValues(t, 0, countRenewalOrders(t), "invoice without id must not create any order")
}
