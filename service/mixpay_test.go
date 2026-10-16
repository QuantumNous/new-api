package service

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"gorm.io/gorm/schema"
)

func mixPayFixture(t *testing.T, user *model.User, quota int) *model.MixPayOrder {
	t.Helper()
	o := &model.MixPayOrder{TradeNo: "MX" + strings.ReplaceAll(uuid.NewString(), "-", ""), TraceID: uuid.NewString(), UserID: user.Id, RequestKey: uuid.NewString(), PayeeID: uuid.NewString(), QuoteAmount: "10.00", QuoteAssetID: "usd", SettlementAssetID: uuid.NewString(), CreditedQuota: quota, CreationState: "ready", Status: "pending", CreatedAt: common.GetTimestamp(), ExpiresAt: common.GetTimestamp() + 900, NextCheckAt: common.GetTimestamp()}
	top := &model.TopUp{UserId: user.Id, TradeNo: o.TradeNo, Amount: 10, Money: 10, PaymentMethod: model.PaymentMethodMixPay, PaymentProvider: model.PaymentProviderMixPay, Status: "pending"}
	require.NoError(t, model.CreateMixPayOrder(o, top, nil, nil))
	return o
}

func TestMixPayDatabaseMatrix(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			var driver gorm.Dialector
			switch dialect {
			case "sqlite":
				driver = sqlite.Open(filepath.Join(t.TempDir(), "mixpay.db"))
			case "mysql":
				if os.Getenv("TEST_MYSQL_DSN") == "" {
					t.Skip("TEST_MYSQL_DSN missing")
				}
				driver = mysql.Open(os.Getenv("TEST_MYSQL_DSN"))
			case "postgres":
				if os.Getenv("TEST_POSTGRES_DSN") == "" {
					t.Skip("TEST_POSTGRES_DSN missing")
				}
				driver = postgres.Open(os.Getenv("TEST_POSTGRES_DSN"))
			}
			db, err := gorm.Open(driver, &gorm.Config{Logger: logger.Discard, NamingStrategy: schema.NamingStrategy{TablePrefix: "mixpay_test_"}})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			sqlDB.SetMaxOpenConns(1)
			oldDB, oldLog, oldType, oldRedis := model.DB, model.LOG_DB, common.MainDatabaseType(), common.RedisEnabled
			model.DB, model.LOG_DB = db, db
			common.SetMainDatabaseType(common.DatabaseType(dialect))
			common.RedisEnabled = false
			legacy := []any{&model.User{}, &model.TopUp{}, &model.SubscriptionOrder{}, &model.SubscriptionPlan{}, &model.UserSubscription{}, &model.Log{}, &model.AlipayConfig{}, &model.AlipayOrder{}, &model.WechatPayConfig{}, &model.WechatPayOrder{}}
			added := []any{&model.MixPayConfig{}, &model.WebMoneyOrder{}, &model.AntomOrder{}, &model.AntomConfig{}, &model.MixPayOrder{}, &model.MixPayRequestBudget{}}
			tables := append(legacy, added...)
			t.Cleanup(func() {
				require.NoError(t, db.Migrator().DropTable(tables...))
				model.DB, model.LOG_DB = oldDB, oldLog
				common.SetMainDatabaseType(oldType)
				common.RedisEnabled = oldRedis
				require.NoError(t, sqlDB.Close())
			})
			require.NoError(t, db.AutoMigrate(legacy...))
			// Existing payment data survives additive migration and repeated startup.
			before := model.TopUp{TradeNo: "pre-mixpay", PaymentProvider: "epay", Status: "success", Money: 12.5}
			require.NoError(t, db.Create(&before).Error)
			require.NoError(t, db.AutoMigrate(tables...))
			require.NoError(t, db.AutoMigrate(tables...))
			var after model.TopUp
			require.NoError(t, db.First(&after, before.Id).Error)
			assert.Equal(t, before, after)
			user := model.User{Username: "mixpay-buyer", Status: common.UserStatusEnabled, Quota: 100}
			require.NoError(t, db.Create(&user).Error)

			t.Run("payment evidence survives capacity failure and fulfillment retries", func(t *testing.T) {
				o := mixPayFixture(t, &user, 50)
				lease, err := model.ClaimMixPayOrder(o.TradeNo)
				require.NoError(t, err)
				require.NotNil(t, lease)
				require.NoError(t, model.SaveMixPayResult(lease, "success", "0", "pending", "", ""))
				require.NoError(t, db.Model(&user).Update("quota", common.MaxWalletQuota).Error)
				require.Error(t, model.CompleteMixPayOrder(o.TradeNo))
				paid, err := model.GetMixPayOrder(o.TradeNo)
				require.NoError(t, err)
				assert.Equal(t, "paid", paid.Status)
				require.NoError(t, db.Model(&user).Update("quota", 100).Error)
				require.NoError(t, model.CompleteMixPayOrder(o.TradeNo))
				require.NoError(t, model.CompleteMixPayOrder(o.TradeNo))
				var actual model.User
				require.NoError(t, db.First(&actual, user.Id).Error)
				assert.Equal(t, 150, actual.Quota)
				var top model.TopUp
				require.NoError(t, db.Where("trade_no = ?", o.TradeNo).First(&top).Error)
				assert.Equal(t, "success", top.Status)
				assert.Equal(t, o.TraceID, top.PaymentReceipt.ReceiptTradeNo)
				require.NoError(t, model.SaveMixPayResult(lease, "pending", "0", "", "", ""))
				paid, err = model.GetMixPayOrder(o.TradeNo)
				require.NoError(t, err)
				assert.Equal(t, "success", paid.GatewayStatus)
				require.NoError(t, model.SaveMixPayResult(lease, "failed", "40032", "", "", ""))
				paid, err = model.GetMixPayOrder(o.TradeNo)
				require.NoError(t, err)
				assert.True(t, paid.ReviewRequired)
				assert.Equal(t, "success", paid.Status)
			})

			t.Run("lease fencing and callback wakeup", func(t *testing.T) {
				o := mixPayFixture(t, &user, 10)
				lease, err := model.ClaimMixPayOrder(o.TradeNo)
				require.NoError(t, err)
				other, err := model.ClaimMixPayOrder(o.TradeNo)
				require.NoError(t, err)
				assert.Nil(t, other)
				require.NoError(t, model.WakeMixPayOrder(o.TradeNo))
				require.NoError(t, model.FinishMixPayCheck(lease, nil))
				saved, err := model.GetMixPayOrder(o.TradeNo)
				require.NoError(t, err)
				assert.LessOrEqual(t, saved.NextCheckAt, common.GetTimestamp())
				require.Error(t, model.SaveMixPayResult(lease, "success", "0", "", "", ""))
				copy := *o
				copy.ID = 0
				copy.TradeNo = "MX" + strings.ReplaceAll(uuid.NewString(), "-", "")
				copy.RequestKey = uuid.NewString()
				require.Error(t, db.Create(&copy).Error, "same trace cannot fund a second order")
			})

			t.Run("manual completion cannot bypass payment verification", func(t *testing.T) {
				o := mixPayFixture(t, &user, 10)
				require.Error(t, model.ManualCompleteTopUp(o.TradeNo, ""))
				require.Error(t, model.CompleteMixPayOrder(o.TradeNo))
			})

			t.Run("shared budget rejects a second immediate request", func(t *testing.T) {
				allowed, err := model.ClaimMixPayRequest()
				require.NoError(t, err)
				assert.True(t, allowed)
				allowed, err = model.ClaimMixPayRequest()
				require.NoError(t, err)
				assert.False(t, allowed)
				require.NoError(t, model.DeferMixPayRequests())
				allowed, err = model.ClaimMixPayRequest()
				require.NoError(t, err)
				assert.False(t, allowed)
			})

			t.Run("subscription snapshot grants once", func(t *testing.T) {
				plan := model.SubscriptionPlan{Title: "MixPay plan", Enabled: true, PriceAmount: 10, Currency: "USD", DurationUnit: "month", DurationValue: 1, TotalAmount: 1000}
				require.NoError(t, db.Create(&plan).Error)
				o := &model.MixPayOrder{TradeNo: "MX" + strings.ReplaceAll(uuid.NewString(), "-", ""), TraceID: uuid.NewString(), RequestKey: uuid.NewString(), UserID: user.Id, PlanID: plan.Id, QuoteAmount: "10.00", QuoteAssetID: "usd", Status: "pending", CreationState: "ready", NextCheckAt: common.GetTimestamp()}
				sub := &model.SubscriptionOrder{UserId: user.Id, PlanId: plan.Id, TradeNo: o.TradeNo, PaymentProvider: model.PaymentProviderMixPay, Status: "pending"}
				require.NoError(t, model.CreateMixPayOrder(o, nil, sub, &plan))
				require.Error(t, model.CompleteSubscriptionOrder(o.TradeNo, "", "", ""))
				require.Error(t, model.ExpireSubscriptionOrder(o.TradeNo, ""))
				require.NoError(t, db.Model(&plan).Update("total_amount", 99999).Error)
				lease, err := model.ClaimMixPayOrder(o.TradeNo)
				require.NoError(t, err)
				require.NoError(t, model.SaveMixPayResult(lease, "success", "0", "pending", "", ""))
				require.NoError(t, model.CompleteMixPayOrder(o.TradeNo))
				require.NoError(t, model.CompleteMixPayOrder(o.TradeNo))
				var subscriptions []model.UserSubscription
				require.NoError(t, db.Where("user_id = ?", user.Id).Find(&subscriptions).Error)
				require.Len(t, subscriptions, 1)
				assert.EqualValues(t, 1000, subscriptions[0].AmountTotal)
			})

			t.Run("site order projection includes MixPay", func(t *testing.T) {
				rows, _, err := model.ListSiteOrders(model.SiteOrderFilter{OwnerID: user.Id, Provider: model.PaymentProviderMixPay, Page: 1, PageSize: 100})
				require.NoError(t, err)
				require.NotEmpty(t, rows)
				for _, row := range rows {
					assert.Equal(t, "USD", row.Currency)
				}
			})

			t.Run("concurrent fulfillment and log recovery preserve one credit", func(t *testing.T) {
				o := mixPayFixture(t, &user, 25)
				lease, err := model.ClaimMixPayOrder(o.TradeNo)
				require.NoError(t, err)
				require.NoError(t, model.SaveMixPayResult(lease, "success", "0", "", "", ""))
				var before model.User
				require.NoError(t, db.First(&before, user.Id).Error)
				// An unavailable independent log store must not roll back committed credit.
				model.LOG_DB = nil
				start := make(chan struct{})
				results := make(chan error, 2)
				for range 2 {
					go func() { <-start; results <- model.CompleteMixPayOrder(o.TradeNo) }()
				}
				close(start)
				require.Error(t, <-results)
				require.Error(t, <-results)
				var after model.User
				require.NoError(t, db.First(&after, user.Id).Error)
				assert.Equal(t, before.Quota+25, after.Quota)
				logDB, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "independent-log.db")), &gorm.Config{Logger: logger.Discard})
				require.NoError(t, err)
				require.NoError(t, logDB.AutoMigrate(&model.Log{}))
				model.LOG_DB = logDB
				t.Cleanup(func() { conn, err := logDB.DB(); require.NoError(t, err); require.NoError(t, conn.Close()) })
				require.NoError(t, model.CompleteMixPayOrder(o.TradeNo))
				require.NoError(t, model.SyncMixPayFulfillment(o.TradeNo))
				var logs []model.Log
				require.NoError(t, logDB.Find(&logs).Error)
				require.Len(t, logs, 1)
				assert.Equal(t, "mixpay:"+o.TradeNo, logs[0].RequestId)
				model.LOG_DB = db
			})

			t.Run("lost creation response recovers the original idempotent checkout", func(t *testing.T) {
				o := mixPayFixture(t, &user, 10)
				require.NoError(t, db.Model(o).Update("creation_state", "queued").Error)
				oldClient := mixPayHTTPClient
				t.Cleanup(func() { mixPayHTTPClient = oldClient })
				var paths []string
				var originalRequest map[string]any
				recoverable := false
				server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					paths = append(paths, r.Method+" "+r.URL.Path)
					if r.Method == http.MethodPost {
						var request map[string]any
						require.NoError(t, common.DecodeJson(r.Body, &request))
						assert.Equal(t, o.TraceID, request["traceId"])
						assert.Equal(t, o.TradeNo, request["orderId"])
						assert.Equal(t, o.QuoteAmount, request["quoteAmount"])
						assert.NotContains(t, request, "isTemp")
						if originalRequest == nil {
							originalRequest = request
						} else {
							assert.Equal(t, originalRequest, request, "recovery must not change any frozen payment parameter")
						}
						if recoverable {
							_, _ = w.Write([]byte(`{"success":true,"code":0,"data":{"code":"original-checkout"}}`))
							return
						}
					} else if recoverable {
						_, _ = w.Write([]byte(`{"success":true,"code":0,"data":{"status":"unpaid","quoteAmount":"0"}}`))
						return
					}
					w.WriteHeader(http.StatusServiceUnavailable)
				}))
				defer server.Close()
				mixPayHTTPClient = &http.Client{Transport: &mixPayTestTransport{client: server.Client(), url: server.URL}}
				for range 2 {
					require.NoError(t, db.Model(&model.MixPayRequestBudget{}).Where("id = 1").Update("next_at", 0).Error)
					require.Error(t, ReconcileMixPayOrder(context.Background(), o.TradeNo))
				}
				assert.Equal(t, []string{"POST /v1/one_time_payment", "GET /v1/payments_result"}, paths)
				saved, err := model.GetMixPayOrder(o.TradeNo)
				require.NoError(t, err)
				assert.Equal(t, "uncertain", saved.CreationState)
				assert.Equal(t, "pending", saved.Status)
				assert.Equal(t, "checkout_recovery_pending", saved.LastError)
				recoverable = true
				for range 2 {
					require.NoError(t, db.Model(&model.MixPayRequestBudget{}).Where("id = 1").Update("next_at", 0).Error)
					require.NoError(t, ReconcileMixPayOrder(context.Background(), o.TradeNo))
				}
				saved, err = model.GetMixPayOrder(o.TradeNo)
				require.NoError(t, err)
				assert.Equal(t, "ready", saved.CreationState)
				assert.Equal(t, "original-checkout", saved.Code)
				assert.Empty(t, saved.LastError)
				assert.Equal(t, []string{"POST /v1/one_time_payment", "GET /v1/payments_result", "GET /v1/payments_result", "POST /v1/one_time_payment"}, paths)
				// Payment progress discovered by another check takes precedence over code recovery.
				require.NoError(t, db.Model(o).Updates(map[string]any{"creation_state": "recovering", "code": "", "gateway_status": "confirming"}).Error)
				require.NoError(t, db.Model(&model.MixPayRequestBudget{}).Where("id = 1").Update("next_at", 0).Error)
				require.NoError(t, ReconcileMixPayOrder(context.Background(), o.TradeNo))
				assert.Equal(t, "GET /v1/payments_result", paths[len(paths)-1])
				// Even a queued recovery must not refresh an expired payment window.
				require.NoError(t, db.Model(o).Updates(map[string]any{"creation_state": "recovering", "code": "", "expires_at": common.GetTimestamp() - 1}).Error)
				require.NoError(t, db.Model(&model.MixPayRequestBudget{}).Where("id = 1").Update("next_at", 0).Error)
				require.NoError(t, ReconcileMixPayOrder(context.Background(), o.TradeNo))
				assert.Equal(t, "GET /v1/payments_result", paths[len(paths)-1])

			})

			t.Run("manual verification queries fresh results and credits success only once", func(t *testing.T) {
				oldClient := mixPayHTTPClient
				t.Cleanup(func() { mixPayHTTPClient = oldClient })
				for _, status := range []string{"unpaid", "confirming", "paid_less", "pending", "auditing", "failed", "success"} {
					t.Run(status, func(t *testing.T) {
						buyer := model.User{Username: "manual-" + status, AffCode: status, Status: common.UserStatusEnabled}
						require.NoError(t, db.Create(&buyer).Error)
						o := mixPayFixture(t, &buyer, 10)
						calls := 0
						server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
							calls++
							assert.Equal(t, http.MethodGet, r.Method)
							assert.Equal(t, "/v1/payments_result", r.URL.Path)
							assert.Equal(t, o.TraceID, r.URL.Query().Get("traceId"))
							settleStatus := ""
							if status == "success" {
								settleStatus = "success"
							}
							payload, err := common.Marshal(map[string]any{"success": true, "code": 0, "data": map[string]any{"traceId": o.TraceID, "payeeId": o.PayeeID, "quoteAssetId": "usd", "quoteAmount": "10", "status": status, "settleStatus": settleStatus, "settleAmount": "10", "settleAsset": o.SettlementAssetID}})
							require.NoError(t, err)
							_, _ = w.Write(payload)
						}))
						defer server.Close()
						mixPayHTTPClient = &http.Client{Transport: &mixPayTestTransport{client: server.Client(), url: server.URL}}
						for range 2 {
							require.NoError(t, db.Model(&model.MixPayRequestBudget{}).Where("id = 1").Update("next_at", 0).Error)
							require.NoError(t, RecheckMixPayOrder(context.Background(), o.TradeNo))
						}
						assert.Equal(t, 2, calls)
						if status == "failed" {
							orders, total, err := model.ListSiteOrders(model.SiteOrderFilter{OwnerID: buyer.Id, Status: common.TopUpStatusExpired, Page: 1, PageSize: 10})
							require.NoError(t, err)
							require.EqualValues(t, 1, total)
							require.Len(t, orders, 1)
							assert.Equal(t, common.TopUpStatusExpired, orders[0].OrderStatus)
							assert.Equal(t, "failed", orders[0].GatewayStatus)
							_, total, err = model.ListSiteOrders(model.SiteOrderFilter{OwnerID: buyer.Id, ExcludeClosed: true, Page: 1, PageSize: 10})
							require.NoError(t, err)
							assert.Zero(t, total)
						}

						require.NoError(t, db.First(&buyer, buyer.Id).Error)
						if status == "success" {
							assert.Equal(t, 10, buyer.Quota)
						} else {
							assert.Zero(t, buyer.Quota)
						}
					})
				}
			})
			t.Run("HTTP result identity and intermediate status", func(t *testing.T) {
				o := mixPayFixture(t, &user, 10)
				require.NoError(t, db.Model(o).Updates(map[string]any{"review_required": true, "last_error": "payment_identity_mismatch"}).Error)
				oldClient := mixPayHTTPClient
				t.Cleanup(func() { mixPayHTTPClient = oldClient })
				status := "pending"
				quote := "10.00"
				server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					assert.Equal(t, "/v1/payments_result", r.URL.Path)
					assert.Equal(t, o.TraceID, r.URL.Query().Get("traceId"))
					data := map[string]any{"traceId": o.TraceID, "payeeId": o.PayeeID, "quoteAssetId": "usd", "quoteAmount": quote, "status": status}
					if quote == "" || quote == "0" {
						data = map[string]any{"status": status, "quoteAmount": quote, "settleStatus": "pending"}
					}
					payload, err := common.Marshal(map[string]any{"success": true, "code": 0, "data": data})
					require.NoError(t, err)
					_, _ = w.Write(payload)
				}))
				defer server.Close()
				// Test-only transport redirects the fixed production host to the TLS fixture.
				mixPayHTTPClient = &http.Client{Transport: &mixPayTestTransport{client: server.Client(), url: server.URL}}
				for _, step := range []struct {
					status, amount string
					wantError      bool
				}{{"unpaid", "0", false}, {"unpaid", "", false}, {"pending", "10.00", false}, {"success", "0", true}, {"success", "", true}, {"success", "0.01", true}, {"unpaid", "10.00", false}} {
					status, quote = step.status, step.amount
					require.NoError(t, db.Model(&model.MixPayRequestBudget{}).Where("id = 1").Update("next_at", 0).Error)
					err := RecheckMixPayOrder(context.Background(), o.TradeNo)
					if step.wantError {
						require.Error(t, err)
					} else {
						require.NoError(t, err)
					}
					saved, err := model.GetMixPayOrder(o.TradeNo)
					require.NoError(t, err)
					assert.Equal(t, "pending", saved.Status)
					assert.Equal(t, step.wantError, saved.ReviewRequired)
				}
			})
		})
	}
}

type mixPayTestTransport struct {
	client *http.Client
	url    string
}

func (t *mixPayTestTransport) RoundTrip(r *http.Request) (*http.Response, error) {
	if r.URL.Host != "api.mixpay.me" {
		return nil, errors.New("unexpected host")
	}
	req := r.Clone(r.Context())
	target, err := http.NewRequest(r.Method, t.url+r.URL.RequestURI(), r.Body)
	if err != nil {
		return nil, err
	}
	req.URL = target.URL
	return t.client.Transport.RoundTrip(req)
}

func TestMixPayAmountRejectsUnboundedInput(t *testing.T) {
	for _, s := range []string{"-1", "0", "NaN", "1e999999", "0.0000000000000000001", strings.Repeat("9", 100)} {
		_, err := MixPayAmount(s)
		assert.Error(t, err, s)
	}
}
