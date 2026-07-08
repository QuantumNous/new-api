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

// TestInvoicePaidRenewsAfterFirstCycle verifies that handleAirwallexInvoicePaid
// resolves trade_no via the getBillingSubscription seam (because the invoice.paid
// fixture carries no metadata), skips first-cycle activation (already done by
// billing_checkout.completed), and creates+completes a renewal order.
func TestInvoicePaidRenewsAfterFirstCycle(t *testing.T) {
	setupAirwallexWebhookDB(t)

	// Seed a succeeded original order (first cycle already activated).
	orig := &model.SubscriptionOrder{
		UserId:          7,
		PlanId:          1,
		Money:           20.0,
		TradeNo:         "sub_capture_0708",
		PaymentMethod:   model.PaymentMethodCard,
		PaymentProvider: model.PaymentProviderAirwallex,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusSuccess,
	}
	require.NoError(t, orig.Insert())

	// Override the seam so the handler resolves the subscription without a live
	// Airwallex API call.
	savedSeam := getBillingSubscription
	getBillingSubscription = func(id string) (*airwallex.BillingSubscription, error) {
		return &airwallex.BillingSubscription{
			Id:       id,
			Metadata: map[string]string{"trade_no": "sub_capture_0708"},
		}, nil
	}
	t.Cleanup(func() { getBillingSubscription = savedSeam })

	ev := loadEvent(t, "testdata/awx_invoice_paid.json")
	require.NoError(t, handleAirwallexInvoicePaid(testCtx(), ev))

	renewTradeNo := "sub_capture_0708-r" + time.Now().UTC().Format("200601")
	renew := model.GetSubscriptionOrderByTradeNo(renewTradeNo)
	require.NotNil(t, renew, "renewal order %s must exist", renewTradeNo)
	require.Equal(t, common.TopUpStatusSuccess, renew.Status, "renewal order must be succeeded")
}
