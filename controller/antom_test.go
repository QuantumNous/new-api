package controller

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/paymentsecret"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
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

func TestAntomPaymentDatabaseMatrix(t *testing.T) {
	merchant, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	provider, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	private, err := x509.MarshalPKCS8PrivateKey(merchant)
	require.NoError(t, err)
	public, err := x509.MarshalPKIXPublicKey(&provider.PublicKey)
	require.NoError(t, err)
	keyFile := filepath.Join(t.TempDir(), "key.json")
	require.NoError(t, paymentsecret.GenerateFile(keyFile))
	t.Setenv("PAYMENT_SECRET_KEY_FILE", keyFile)
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			var driver gorm.Dialector
			switch dialect {
			case "sqlite":
				driver = sqlite.Open(filepath.Join(t.TempDir(), "antom.db"))
			case "mysql":
				if os.Getenv("TEST_MYSQL_DSN") == "" {
					t.Skip("TEST_MYSQL_DSN missing")
				}
				driver = mysql.Open(os.Getenv("TEST_MYSQL_DSN"))
			case "postgres":
				if os.Getenv("TEST_POSTGRES_DSN") == "" {
					t.Skip("TEST_POSTGRES_DSN missing")
				}
				driver = postgres.New(postgres.Config{DSN: os.Getenv("TEST_POSTGRES_DSN"), PreferSimpleProtocol: true})
			}
			db, err := gorm.Open(driver, &gorm.Config{Logger: logger.Discard, NamingStrategy: schema.NamingStrategy{TablePrefix: "antom_test_"}})
			require.NoError(t, err)
			connection, err := db.DB()
			require.NoError(t, err)
			connection.SetMaxOpenConns(1)
			oldDB, oldLog, oldType, oldRedis, oldTransport := model.DB, model.LOG_DB, common.MainDatabaseType(), common.RedisEnabled, http.DefaultTransport
			model.DB, model.LOG_DB = db, db
			common.SetMainDatabaseType(common.DatabaseType(dialect))
			common.RedisEnabled = false
			tables := []any{&model.User{}, &model.TopUp{}, &model.SubscriptionOrder{}, &model.SubscriptionPlan{}, &model.UserSubscription{}, &model.WebMoneyConfig{}, &model.AlipayConfig{}, &model.AlipayOrder{}, &model.WechatPayOrder{}, &model.MixPayOrder{}, &model.WebMoneyOrder{}, &model.AntomConfig{}, &model.AntomOrder{}, &model.Log{}}
			t.Cleanup(func() {
				require.NoError(t, db.Migrator().DropTable(tables...))
				require.NoError(t, db.Migrator().DropTable("audit_logs"))
				model.DB, model.LOG_DB = oldDB, oldLog
				common.SetMainDatabaseType(oldType)
				common.RedisEnabled = oldRedis
				http.DefaultTransport = oldTransport
				require.NoError(t, connection.Close())
			})
			require.NoError(t, db.AutoMigrate(tables...))
			require.NoError(t, db.AutoMigrate(tables...))
			require.NoError(t, db.Table("audit_logs").AutoMigrate(&model.AuditLog{}))
			// Upgrade existing data, then repeat startup migration.
			require.NoError(t, db.Migrator().DropTable(&model.AntomOrder{}, &model.AntomConfig{}))
			legacy := model.TopUp{TradeNo: "legacy", Status: "success", Money: 1}
			require.NoError(t, db.Create(&legacy).Error)
			require.NoError(t, db.AutoMigrate(tables...))
			require.NoError(t, db.AutoMigrate(tables...))
			var preserved model.TopUp
			require.NoError(t, db.First(&preserved, legacy.Id).Error)
			assert.Equal(t, legacy, preserved)
			var version string
			if dialect == "sqlite" {
				require.NoError(t, db.Raw("SELECT sqlite_version()").Scan(&version).Error)
			} else {
				require.NoError(t, db.Raw("SELECT version()").Scan(&version).Error)
			}
			t.Log(dialect, version)
			config := model.AntomConfig{Enabled: true, Sandbox: true, ClientID: "SANDBOX_test", Region: "SG", PublicKey: base64.StdEncoding.EncodeToString(public), Secret: base64.StdEncoding.EncodeToString(private), SettlementCurrency: "USD", Description: "Test", MinTopUp: 1, NotifyBaseURL: "https://example.com", ReturnURL: "https://example.com/wallet"}
			require.NoError(t, service.ValidateAntomConfig(&config))
			require.NoError(t, db.Create(&config).Error)
			assert.NotContains(t, config.Ciphertext, config.Secret)
			require.NoError(t, db.AutoMigrate(&model.AntomConfig{}))
			require.NoError(t, db.AutoMigrate(&model.AntomConfig{}))
			loaded, err := model.CurrentAntomConfig()
			require.NoError(t, err)
			assert.Equal(t, config.Secret, loaded.Secret)

			serialized, err := common.Marshal(loaded)
			require.NoError(t, err)
			assert.NotContains(t, string(serialized), config.Secret)
			invalid := config
			invalid.Sandbox = false
			require.Error(t, service.ValidateAntomConfig(&invalid))
			require.Error(t, db.Model(&config).Update("client_id", "changed").Error)
			user := model.User{Username: "antom-buyer", Status: common.UserStatusEnabled, Quota: 100}
			require.NoError(t, db.Create(&user).Error)
			order := model.AntomOrder{TradeNo: "ANTtest", UserID: user.Id, ConfigID: config.ID, RequestKey: "one", Amount: "1.00", CreditedQuota: 50, RequestedAmount: 1, Status: "pending", CreatedAt: common.GetTimestamp(), ExpiresAt: common.GetTimestamp() + 1800}
			top := model.TopUp{UserId: user.Id, TradeNo: order.TradeNo, PaymentProvider: "antom", PaymentMethod: "antom", Status: "pending", Money: 1}
			require.NoError(t, model.CreateAntomOrder(&order, &top))
			duplicate := order
			duplicate.ID = 0
			duplicate.TradeNo = "duplicate"
			require.Error(t, db.Create(&duplicate).Error)
			response := map[string]any{}
			invalidSignature := false
			sessions := 0
			http.DefaultTransport = webMoneyQueryTransport(func(r *http.Request) (*http.Response, error) {
				assert.True(t, strings.HasPrefix(r.URL.Path, "/ams/sandbox/api/v1/payments/"), "sandbox credentials must use sandbox API routes")
				body, err := io.ReadAll(r.Body)
				require.NoError(t, err)
				requestConfig := config
				requestPublic, err := x509.MarshalPKIXPublicKey(&merchant.PublicKey)
				require.NoError(t, err)
				requestConfig.PublicKey = base64.StdEncoding.EncodeToString(requestPublic)
				require.NoError(t, service.VerifyAntomSignature(&requestConfig, r.URL.Path, r.Header.Get("Client-Id"), r.Header.Get("Request-Time"), r.Header.Get("Signature"), body))
				assert.NotContains(t, string(body), config.Secret)
				if strings.HasSuffix(r.URL.Path, "createPaymentSession") {
					sessions++
					assert.Contains(t, string(body), `"isAuthorization":false`)
					var payload struct {
						Env     map[string]string `json:"env"`
						Methods struct {
							Metadata struct {
								Google struct {
									Configuration map[string]string `json:"configuration"`
								} `json:"googlePayConfiguration"`
							} `json:"paymentMethodMetaData"`
						} `json:"availablePaymentMethod"`
					}
					require.NoError(t, common.Unmarshal(body, &payload))
					assert.Equal(t, "203.0.113.42", payload.Env["clientIp"])
					assert.Empty(t, payload.Methods.Metadata.Google.Configuration)
					assert.Contains(t, string(body), `"productScene":"CHECKOUT_PAYMENT"`)
					assert.Contains(t, string(body), "/payment/antom/"+order.TradeNo+"?hosted_return=1")

					assert.Contains(t, string(body), `"value":"100"`)
					response = map[string]any{"result": map[string]string{"resultStatus": "S", "resultCode": "SUCCESS"}, "paymentSessionId": "session1", "normalUrl": "https://checkout.antom.com/checkout-page/pages/payment/index.html?sessionData=test", "paymentSessionExpiryTime": time.Unix(order.ExpiresAt, 0).UTC().Format(time.RFC3339)}
				}
				raw, err := common.Marshal(response)
				require.NoError(t, err)
				stamp := time.Now().UTC().Format(time.RFC3339)
				digest := sha256.Sum256([]byte("POST " + r.URL.Path + "\n" + config.ClientID + "." + stamp + "." + string(raw)))
				signature, err := rsa.SignPKCS1v15(rand.Reader, provider, crypto.SHA256, digest[:])
				require.NoError(t, err)
				if invalidSignature {
					signature[0] ^= 1
				}
				header := http.Header{}
				header.Set("Client-Id", config.ClientID)
				header.Set("Response-Time", stamp)
				header.Set("Signature", "algorithm=RSA256,keyVersion=1,signature="+url.QueryEscape(base64.StdEncoding.EncodeToString(signature)))
				return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(string(raw))), Header: header}, nil
			})
			session, err := service.CreateAntomSession(context.Background(), &order, &config, "203.0.113.42")
			require.NoError(t, err)
			assert.Equal(t, "https://checkout.antom.com/checkout-page/pages/payment/index.html?sessionData=test", session)
			saved, _, err := model.GetAntomOrder(order.TradeNo)
			require.NoError(t, err)
			assert.NotContains(t, saved.SessionCiphertext, session)
			status := model.InspectPaymentSecrets(db)
			assert.Equal(t, "verified", status.Antom)
			assert.Equal(t, "verified", status.AntomSessions)
			wm := model.WebMoneyConfig{Secret: "test-secret", Purse: "T123456789012"}
			require.NoError(t, db.Create(&wm).Error)
			assert.Equal(t, "verified", model.InspectPaymentSecrets(db).WebMoney)
			require.NoError(t, db.Session(&gorm.Session{SkipHooks: true}).Model(&wm).Update("ciphertext", "damaged").Error)
			assert.Equal(t, "error", model.InspectPaymentSecrets(db).WebMoney)
			require.NoError(t, db.Delete(&wm).Error)
			require.NoError(t, db.Session(&gorm.Session{SkipHooks: true}).Model(&model.AntomOrder{}).Where("id = ?", saved.ID).Update("session_ciphertext", "damaged").Error)
			assert.Equal(t, "error", model.InspectPaymentSecrets(db).AntomSessions)
			require.NoError(t, db.Session(&gorm.Session{SkipHooks: true}).Model(saved).Update("session_ciphertext", saved.SessionCiphertext).Error)

			_, err = service.CreateAntomSession(context.Background(), saved, &config, "203.0.113.42")
			require.NoError(t, err)
			assert.Equal(t, 1, sessions)
			ring, err := paymentsecret.Load()
			require.NoError(t, err)
			obsolete := *saved
			obsolete.SessionCiphertext, err = ring.Seal("obsolete-session-token", "antom/order/"+strconv.Itoa(int(saved.ID))+"/session")
			require.NoError(t, err)
			_, err = service.CreateAntomSession(context.Background(), &obsolete, &config, "203.0.113.42")
			require.ErrorContains(t, err, "no longer supported")
			assert.Equal(t, 1, sessions, "obsolete sessions must not create a second payment")
			for _, tc := range []struct {
				name, status, currency, amount, request string
				signature                               bool
				capture                                 string
				wantError                               bool
			}{
				{"processing", "PROCESSING", "USD", "100", order.TradeNo, false, "", false},
				{"pending is not paid", "PENDING", "USD", "100", order.TradeNo, false, "", false},
				{"signature tamper", "SUCCESS", "USD", "100", order.TradeNo, true, "", true},
				{"wrong currency", "SUCCESS", "EUR", "100", order.TradeNo, false, "", true},
				{"wrong amount", "SUCCESS", "USD", "1", order.TradeNo, false, "", true},
				{"wrong order", "SUCCESS", "USD", "100", "another", false, "", true},
				{"capture incomplete", "SUCCESS", "USD", "100", order.TradeNo, false, "PROCESSING", true},
			} {
				response = map[string]any{"result": map[string]string{"resultStatus": "S", "resultCode": "SUCCESS"}, "paymentStatus": tc.status, "paymentRequestId": tc.request, "paymentId": "payment1", "paymentAmount": service.AntomAmount{Currency: tc.currency, Value: tc.amount}}
				if tc.capture != "" {
					response["transactions"] = []any{map[string]any{"transactionType": "CAPTURE", "transactionStatus": tc.capture, "transactionAmount": service.AntomAmount{Currency: "USD", Value: "100"}}}
				}
				invalidSignature = tc.signature
				err := service.ReconcileAntomOrder(context.Background(), order.TradeNo)
				assert.Equal(t, tc.wantError, err != nil, tc.name)
				var buyer model.User
				require.NoError(t, db.First(&buyer, user.Id).Error)
				assert.Equal(t, 100, buyer.Quota, tc.name)
			}
			invalidSignature = false
			response = map[string]any{"result": map[string]string{"resultStatus": "F", "resultCode": "ORDER_NOT_EXIST"}}
			require.NoError(t, service.ReconcileAntomOrder(context.Background(), order.TradeNo))
			unsubmitted, _, err := model.GetAntomOrder(order.TradeNo)
			require.NoError(t, err)
			assert.Equal(t, "pending", unsubmitted.Status)
			assert.Equal(t, "ORDER_NOT_EXIST", unsubmitted.GatewayStatus)
			assert.Empty(t, unsubmitted.LastError)
			response = map[string]any{"result": map[string]string{"resultStatus": "S", "resultCode": "SUCCESS"}, "paymentStatus": "SUCCESS", "paymentRequestId": order.TradeNo, "paymentId": "payment1", "paymentAmount": service.AntomAmount{Currency: "USD", Value: "100"}}
			require.NoError(t, db.Model(&order).Update("checked_at", 0).Error)
			for _, owner := range []int{user.Id + 1, user.Id, user.Id} {
				w := httptest.NewRecorder()
				c, _ := gin.CreateTestContext(w)
				c.Request = httptest.NewRequest(http.MethodPost, "/recheck", nil)
				c.Params = gin.Params{{Key: "trade_no", Value: order.TradeNo}}
				c.Set("id", owner)
				RecheckAntomOrder(c)
				if owner != user.Id {
					assert.Equal(t, http.StatusNotFound, w.Code)
				} else {
					assert.Equal(t, http.StatusOK, w.Code)
					assert.Contains(t, w.Body.String(), `"status":"success"`)
				}
			}
			var buyer model.User
			require.NoError(t, db.First(&buyer, user.Id).Error)
			assert.Equal(t, 150, buyer.Quota)
			projected, _, err := model.ListSiteOrders(model.SiteOrderFilter{ID: top.Id, Page: 1, PageSize: 1})
			require.NoError(t, err)
			require.Len(t, projected, 1)
			assert.Equal(t, "SUCCESS", projected[0].GatewayStatus)
			assert.Equal(t, "USD", projected[0].Currency)
			assert.True(t, projected[0].Sandbox)

			closed := order
			closed.ID = 0
			closed.TradeNo, closed.RequestKey, closed.Status = "ANTclosed", "two", "pending"
			closedTop := model.TopUp{UserId: user.Id, TradeNo: closed.TradeNo, PaymentProvider: "antom", PaymentMethod: "antom", Status: "pending", Money: 1}
			require.NoError(t, model.CreateAntomOrder(&closed, &closedTop))
			response["paymentRequestId"], response["paymentStatus"] = closed.TradeNo, "FAIL"
			// Valid notification wakes reconciliation but does not itself credit a wallet.
			notifyBody := []byte(`{"notifyType":"PAYMENT_RESULT","paymentRequestId":"ANTclosed"}`)
			notifyPath := "/api/user/antom/notify/" + closed.TradeNo
			timestamp := time.Now().UTC().Format(time.RFC3339)
			notifyHash := sha256.Sum256([]byte("POST " + notifyPath + "\n" + config.ClientID + "." + timestamp + "." + string(notifyBody)))
			notifySignature, err := rsa.SignPKCS1v15(rand.Reader, provider, crypto.SHA256, notifyHash[:])
			require.NoError(t, err)
			notifyRecorder := httptest.NewRecorder()
			notifyContext, _ := gin.CreateTestContext(notifyRecorder)
			notifyContext.Params = gin.Params{{Key: "trade_no", Value: closed.TradeNo}}
			notifyContext.Request = httptest.NewRequest("POST", notifyPath, strings.NewReader(string(notifyBody)))
			notifyContext.Request.Header.Set("Client-Id", config.ClientID)
			notifyContext.Request.Header.Set("Request-Time", timestamp)
			notifyContext.Request.Header.Set("Signature", "algorithm=RSA256,keyVersion=1,signature="+url.QueryEscape(base64.StdEncoding.EncodeToString(notifySignature)))
			AntomNotify(notifyContext)
			assert.Equal(t, 200, notifyRecorder.Code)
			require.NoError(t, service.ReconcileAntomOrder(context.Background(), closed.TradeNo))
			require.NoError(t, db.First(&closedTop, closedTop.Id).Error)
			assert.Equal(t, "expired", closedTop.Status)
			require.NoError(t, db.First(&buyer, user.Id).Error)
			assert.Equal(t, 150, buyer.Quota)
			for _, channel := range []string{"antom", "webmoney"} {
				t.Run(channel+" subscription", func(t *testing.T) {
					setting := operation_setting.GetPaymentSetting()
					previous := *setting
					setting.ComplianceConfirmed, setting.ComplianceTermsVersion = true, operation_setting.CurrentComplianceTermsVersion
					defer func() { *setting = previous }()
					wmConfig := model.WebMoneyConfig{Enabled: true, Purse: "T123456789012", Description: "Test", Rate: "2", MinTopUp: 1, Secret: "test-secret", NotifyBaseURL: "https://example.com", ReturnURL: "https://example.com/wallet"}
					if channel == "webmoney" {
						require.NoError(t, db.Create(&wmConfig).Error)
					}
					plan := model.SubscriptionPlan{Title: channel, Enabled: true, PriceAmount: 10, Currency: "USD", DurationUnit: "month", DurationValue: 1, TotalAmount: 12345, QuotaResetPeriod: "never"}
					require.NoError(t, db.Create(&plan).Error)
					amount := "10.00"
					if channel == "webmoney" {
						amount = "20.00"
					}
					key := uuid.NewString()
					request := func(planID int) *httptest.ResponseRecorder {
						raw, err := common.Marshal(map[string]any{"plan_id": planID, "amount": 0, "expected_amount": amount, "request_key": key})
						require.NoError(t, err)
						w := httptest.NewRecorder()
						c, _ := gin.CreateTestContext(w)
						c.Set("id", user.Id)
						c.Set("role", common.RoleRootUser)
						c.Request = httptest.NewRequest("POST", "/api/subscription/"+channel+"/pay", strings.NewReader(string(raw)))
						c.Request.Header.Set("Content-Type", "application/json")
						if channel == "antom" {
							RequestAntomPayment(c)
						} else {
							RequestWebMoneyPayment(c)
						}
						return w
					}
					result := request(plan.Id)
					require.Equal(t, 200, result.Code)
					var payload struct {
						Success bool
						Data    struct {
							TradeNo string `json:"trade_no"`
						}
					}
					require.NoError(t, common.Unmarshal(result.Body.Bytes(), &payload))
					require.True(t, payload.Success, result.Body.String())
					trade := payload.Data.TradeNo
					require.NotEmpty(t, trade)
					require.Equal(t, 200, request(plan.Id).Code)
					require.Equal(t, 409, request(plan.Id+100).Code)
					var count int64
					require.NoError(t, db.Model(&model.TopUp{}).Where("trade_no = ?", trade).Count(&count).Error)
					assert.Zero(t, count)
					// Subsequent plan edits must not change purchased benefits.
					require.NoError(t, db.Model(&plan).Update("total_amount", 99999).Error)
					complete := func() error { return model.CompleteAntomOrder(trade) }
					if channel == "antom" {
						o, _, err := model.GetAntomOrder(trade)
						require.NoError(t, err)
						require.Error(t, model.CompleteAntomOrder(trade))
						require.NoError(t, model.RecordAntomPayment(o, "sub-antom-payment"))
					} else {
						o, _, err := model.GetWebMoneyOrder(trade)
						require.NoError(t, err)
						require.Equal(t, "20.00", o.Amount)
						require.Error(t, model.CompleteWebMoneyOrder(trade))
						require.NoError(t, model.RecordWebMoneyPayment(o, "sub-wm-payment"))
						complete = func() error { return model.CompleteWebMoneyOrder(trade) }
					}
					require.NoError(t, complete())
					require.NoError(t, complete())
					var subscription model.UserSubscription
					require.NoError(t, db.Where("user_id = ? AND plan_id = ?", user.Id, plan.Id).First(&subscription).Error)
					assert.EqualValues(t, 12345, subscription.AmountTotal)
					require.NoError(t, db.Model(&model.UserSubscription{}).Where("user_id = ? AND plan_id = ?", user.Id, plan.Id).Count(&count).Error)
					assert.EqualValues(t, 1, count)
					require.NoError(t, db.First(&buyer, user.Id).Error)
					assert.Equal(t, 150, buyer.Quota)
					subOrder := model.GetSubscriptionOrderByTradeNo(trade)
					require.NotNil(t, subOrder)
					assert.Equal(t, "success", subOrder.Status)
					assert.Equal(t, amount, subOrder.PaymentReceipt.ReceiptAmount)
					require.Error(t, model.ExpireSubscriptionOrder(trade, channel))
					// A competing activation after checkout preserves the verified receipt for review.
					conflictPlan := plan
					conflictPlan.Id = 0
					require.NoError(t, db.Create(&conflictPlan).Error)
					conflictTrade := "SUBANTconflict"
					if channel == "webmoney" {
						conflictTrade = "SUBWMconflict"
					}
					conflict := model.SubscriptionOrder{UserId: user.Id, PlanId: conflictPlan.Id, TradeNo: conflictTrade, PaymentProvider: channel, PaymentMethod: channel, Status: "pending"}
					var payment any
					if channel == "antom" {
						payment = &model.AntomOrder{TradeNo: conflictTrade, UserID: user.Id, ConfigID: config.ID, RequestKey: "conflict", Amount: amount, Status: "pending"}
					} else {
						payment = &model.WebMoneyOrder{TradeNo: conflictTrade, UserID: user.Id, ConfigID: wmConfig.ID, RequestKey: "conflict", Amount: amount, Status: "pending"}
					}
					require.NoError(t, model.CreateDirectSubscriptionOrder(&conflict, &conflictPlan, payment))
					require.NoError(t, db.Create(&model.UserSubscription{UserId: user.Id, PlanId: conflictPlan.Id, Status: "active", EndTime: common.GetTimestamp() + 3600}).Error)
					if o, ok := payment.(*model.AntomOrder); ok {
						require.NoError(t, model.RecordAntomPayment(o, "antom-conflict"))
						require.NoError(t, model.CompleteAntomOrder(conflictTrade))
						require.NoError(t, model.CompleteAntomOrder(conflictTrade))
					} else {
						o := payment.(*model.WebMoneyOrder)
						require.NoError(t, model.RecordWebMoneyPayment(o, "wm-conflict"))
						require.NoError(t, model.CompleteWebMoneyOrder(conflictTrade))
						require.NoError(t, model.CompleteWebMoneyOrder(conflictTrade))
					}
					require.True(t, model.DirectSubscriptionReviewRequired(conflictTrade))
					require.NoError(t, db.Model(&model.UserSubscription{}).Where("user_id = ? AND plan_id = ?", user.Id, conflictPlan.Id).Count(&count).Error)
					assert.EqualValues(t, 1, count)
					if channel == "antom" {
						closedPlan := plan
						closedPlan.Id = 0
						require.NoError(t, db.Create(&closedPlan).Error)
						closedOrder := model.SubscriptionOrder{UserId: user.Id, PlanId: closedPlan.Id, TradeNo: "SUBANTclosed", PaymentProvider: channel, Status: "pending"}
						payment := model.AntomOrder{TradeNo: closedOrder.TradeNo, UserID: user.Id, ConfigID: config.ID, RequestKey: "closed-sub", Amount: amount, Status: "pending"}
						require.NoError(t, model.CreateDirectSubscriptionOrder(&closedOrder, &closedPlan, &payment))
						require.NoError(t, model.CloseAntomOrder(payment.ID, "FAIL"))
						require.NoError(t, db.First(&closedOrder, closedOrder.Id).Error)
						assert.Equal(t, "expired", closedOrder.Status)
					}

				})
			}

			t.Run("cancellation retains unresolved orders and prevents late credit", func(t *testing.T) {
				cancelled := model.AntomOrder{TradeNo: "ANTcancel-api", UserID: user.Id, ConfigID: config.ID, RequestKey: "cancel-api", Amount: "1.00", Status: "pending"}
				top := model.TopUp{UserId: user.Id, TradeNo: cancelled.TradeNo, PaymentProvider: "antom", Status: "pending"}
				require.NoError(t, model.CreateAntomOrder(&cancelled, &top))
				denied := httptest.NewRecorder()
				deniedContext, _ := gin.CreateTestContext(denied)
				deniedContext.Set("id", user.Id+1)
				deniedContext.Params = gin.Params{{Key: "id", Value: strconv.Itoa(top.Id)}, {Key: "action", Value: "cancel"}}
				deniedContext.Request = httptest.NewRequest("POST", "/", strings.NewReader("{}"))
				deniedContext.Request.Header.Set("Content-Type", "application/json")
				PersonalOrderPayment(deniedContext)
				assert.Equal(t, 404, denied.Code)
				denied = httptest.NewRecorder()
				deniedContext, _ = gin.CreateTestContext(denied)
				deniedContext.Set("role", common.RoleAdminUser)
				CancelAntomSiteOrder(deniedContext)
				assert.Equal(t, 403, denied.Code)

				response = map[string]any{"result": map[string]string{"resultStatus": "U", "resultCode": "UNKNOWN_EXCEPTION"}}
				state, err := service.CancelAntomOrder(context.Background(), cancelled.TradeNo)
				require.NoError(t, err)
				assert.Equal(t, "closing", state)
				require.Error(t, model.RecordAntomPayment(&cancelled, "late-payment"))
				response = map[string]any{"result": map[string]string{"resultStatus": "F", "resultCode": "ORDER_NOT_EXIST"}}
				_, err = service.CancelAntomOrder(context.Background(), cancelled.TradeNo)
				require.Error(t, err)
				require.NoError(t, db.First(&top, top.Id).Error)
				assert.Equal(t, "pending", top.Status)
				response = map[string]any{"result": map[string]string{"resultStatus": "S", "resultCode": "SUCCESS"}, "paymentRequestId": cancelled.TradeNo}
				invalidSignature = true
				_, err = service.CancelAntomOrder(context.Background(), cancelled.TradeNo)
				require.Error(t, err)
				invalidSignature = false
				response["paymentRequestId"] = "another"
				_, err = service.CancelAntomOrder(context.Background(), cancelled.TradeNo)
				require.Error(t, err)
				response["paymentRequestId"] = cancelled.TradeNo
				state, err = service.CancelAntomOrder(context.Background(), cancelled.TradeNo)
				require.NoError(t, err)
				assert.Equal(t, "closed", state)
				require.NoError(t, db.First(&top, top.Id).Error)
				assert.Equal(t, "expired", top.Status)
				require.Error(t, model.RecordAntomPayment(&cancelled, "late-payment"))
				state, err = service.CancelAntomOrder(context.Background(), order.TradeNo)
				require.NoError(t, err)
				assert.Equal(t, "paid", state)
			})

			// A foreign owner cannot access the session; a browser event cannot forge a callback.
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Params = gin.Params{{Key: "trade_no", Value: order.TradeNo}}
			c.Set("id", user.Id+1)
			CreateAntomCheckoutSession(c)
			assert.Equal(t, 404, w.Code)
			w = httptest.NewRecorder()
			c, _ = gin.CreateTestContext(w)
			c.Params = gin.Params{{Key: "trade_no", Value: order.TradeNo}}
			c.Request = httptest.NewRequest("POST", "/api/user/antom/notify/"+order.TradeNo, strings.NewReader(`{"notifyType":"PAYMENT_RESULT","paymentRequestId":"ANTtest"}`))
			AntomNotify(c)
			assert.Equal(t, 400, w.Code)
		})
	}
}
