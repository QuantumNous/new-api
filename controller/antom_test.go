package controller

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"fmt"
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
			tables := []any{&model.PaymentReview{}, &model.User{}, &model.TopUp{}, &model.SubscriptionOrder{}, &model.SubscriptionPlan{}, &model.UserSubscription{}, &model.WebMoneyConfig{}, &model.AlipayConfig{}, &model.AlipayOrder{}, &model.WechatPayOrder{}, &model.MixPayOrder{}, &model.WebMoneyOrder{}, &model.AntomConfig{}, &model.AntomOrder{}, &model.Log{}}
			t.Cleanup(func() {
				require.NoError(t, db.Migrator().DropTable(tables...))
				require.NoError(t, db.Migrator().DropTable("audit_logs"))
				model.DB, model.LOG_DB = oldDB, oldLog
				common.SetMainDatabaseType(oldType)
				common.RedisEnabled = oldRedis
				http.DefaultTransport = oldTransport
				require.NoError(t, connection.Close())
			})

			// Upgrade an append-only review table created before resolutions existed.
			legacyReview := struct {
				ID        int64  `gorm:"primaryKey"`
				TradeNo   string `gorm:"type:varchar(64)"`
				Provider  string `gorm:"type:varchar(24)"`
				ActorID   int
				Note      string `gorm:"type:text"`
				CreatedAt int64
			}{TradeNo: "legacy-note", Provider: "antom", ActorID: 1, Note: "Preserve old review"}
			require.NoError(t, db.Table(db.NamingStrategy.TableName("PaymentReview")).AutoMigrate(&legacyReview))
			require.NoError(t, db.Table(db.NamingStrategy.TableName("PaymentReview")).Create(&legacyReview).Error)
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
			// Upgrade the previous Antom schema with an unresolved cancellation in place.
			require.NoError(t, db.Migrator().DropColumn(&model.AntomOrder{}, "review_required"))
			require.NoError(t, db.Migrator().DropColumn(&model.AntomOrder{}, "cancellation_state"))
			require.NoError(t, db.Migrator().DropColumn(&model.AntomOrder{}, "cancellation_code"))
			require.NoError(t, db.Migrator().DropColumn(&model.AntomOrder{}, "cancellation_token"))
			require.NoError(t, db.Migrator().DropColumn(&model.AntomOrder{}, "cancellation_until"))
			require.NoError(t, db.Table(db.NamingStrategy.TableName("AntomOrder")).Create(map[string]any{"trade_no": "legacy-cancel", "request_key": "legacy-cancel", "user_id": 999, "status": "pending", "gateway_status": "CANCEL_REQUESTED", "last_error": "cancellation_rejected", "next_check_at": 0}).Error)
			require.NoError(t, db.AutoMigrate(tables...))
			require.NoError(t, db.AutoMigrate(tables...))
			var legacyCancel model.AntomOrder
			require.NoError(t, db.Where("trade_no = ?", "legacy-cancel").First(&legacyCancel).Error)
			assert.Equal(t, "CANCEL_REQUESTED", legacyCancel.GatewayStatus)
			assert.Empty(t, legacyCancel.CancellationState)
			assert.False(t, legacyCancel.ReviewRequired)
			require.NoError(t, db.Delete(&legacyCancel).Error)
			var version string
			if dialect == "sqlite" {
				require.NoError(t, db.Raw("SELECT sqlite_version()").Scan(&version).Error)
			} else {
				require.NoError(t, db.Raw("SELECT version()").Scan(&version).Error)
			}
			t.Log(dialect, version)
			var migratedReview model.PaymentReview
			require.NoError(t, db.First(&migratedReview, legacyReview.ID).Error)
			assert.Equal(t, "Preserve old review", migratedReview.Note)
			assert.Empty(t, migratedReview.Action)
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
			assert.False(t, (antomReconcileHandler{}).Enabled())
			order := model.AntomOrder{TradeNo: "ANTtest", UserID: user.Id, ConfigID: config.ID, RequestKey: "one", Amount: "1.00", CreditedQuota: 50, RequestedAmount: 1, Status: "pending", CreatedAt: common.GetTimestamp(), ExpiresAt: common.GetTimestamp() + 1800}
			top := model.TopUp{UserId: user.Id, TradeNo: order.TradeNo, PaymentProvider: "antom", PaymentMethod: "antom", Status: "pending", Money: 1}
			require.NoError(t, model.CreateAntomOrder(&order, &top))
			t.Run("unopened orders activate reconciliation without a schedule", func(t *testing.T) {
				assert.True(t, (antomReconcileHandler{}).Enabled())
				for _, state := range []struct {
					status  string
					gateway string
					review  bool
					want    bool
				}{
					{"expired", "", false, true},
					{"expired", "CANCELLED", false, false},
					{"expired", "FAIL", false, false},
					{"paid", "SUCCESS", true, false},
					{"success", "SUCCESS", false, false},
				} {
					require.NoError(t, db.Model(&order).Updates(map[string]any{"status": state.status, "gateway_status": state.gateway, "review_required": state.review, "next_check_at": common.GetTimestamp() + 3600}).Error)
					assert.Equal(t, state.want, (antomReconcileHandler{}).Enabled(), "%+v", state)
				}
				require.NoError(t, db.Model(&order).Updates(map[string]any{"status": "pending", "gateway_status": "", "review_required": false, "next_check_at": 0}).Error)
				require.NoError(t, db.First(&order, order.ID).Error)
			})
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

			t.Run("verified refund is retained after credit and before credit", func(t *testing.T) {
				refundUser := model.User{Username: "antom-refund-buyer", AffCode: "ant-refund", Status: common.UserStatusEnabled, Quota: 100}
				require.NoError(t, db.Create(&refundUser).Error)
				originalResponse := response
				defer func() { response = originalResponse }()
				for _, credited := range []bool{false, true} {
					trade := fmt.Sprintf("ANTrefund-%t", credited)
					payment := model.AntomOrder{TradeNo: trade, RequestKey: trade, ConfigID: config.ID, UserID: refundUser.Id, Amount: "1.00", CreditedQuota: 50, Status: "pending", CreatedAt: common.GetTimestamp(), ExpiresAt: common.GetTimestamp() + 1800}
					topup := model.TopUp{UserId: refundUser.Id, TradeNo: trade, PaymentProvider: "antom", Status: "pending"}
					require.NoError(t, model.CreateAntomOrder(&payment, &topup))
					require.NoError(t, model.RecordAntomPayment(&payment, trade+"payment"))
					if credited {
						require.NoError(t, model.CompleteAntomOrder(trade))
					}
					var before, after model.User
					require.NoError(t, db.First(&before, refundUser.Id).Error)
					response = map[string]any{"result": map[string]string{"resultStatus": "S", "resultCode": "SUCCESS"}, "paymentStatus": "SUCCESS", "paymentRequestId": trade, "paymentId": trade + "payment", "paymentAmount": service.AntomAmount{Currency: "USD", Value: "100"}, "transactions": []any{
						map[string]any{"transactionType": "REFUND", "transactionStatus": "SUCCESS", "transactionAmount": service.AntomAmount{Currency: "USD", Value: "50"}},
						map[string]any{"transactionType": "CAPTURE", "transactionStatus": "PROCESSING", "transactionAmount": service.AntomAmount{Currency: "USD", Value: "100"}},
					}}
					invalidSignature = true
					require.Error(t, service.RecheckAntomOrder(context.Background(), trade))
					unchanged, _, e := model.GetAntomOrder(trade)
					require.NoError(t, e)
					assert.False(t, unchanged.ReviewRequired)
					invalidSignature = false
					// A signed refund notification must query even a fulfilled order.
					body := `{"notifyType":"REFUND_RESULT","refundStatus":"SUCCESS"}`
					path := "/api/user/antom/notify/" + trade
					timestamp := time.Now().UTC().Format(time.RFC3339)
					digest := sha256.Sum256([]byte("POST " + path + "\n" + config.ClientID + "." + timestamp + "." + body))
					signature, signErr := rsa.SignPKCS1v15(rand.Reader, provider, crypto.SHA256, digest[:])
					require.NoError(t, signErr)
					refundTransactions := response["transactions"]
					for _, phase := range []string{"unavailable", "stale", "confirmed", "replay"} {
						invalidSignature = phase == "unavailable"
						response["transactions"] = refundTransactions
						if phase == "stale" {
							response["transactions"] = []any{}
						}
						recorder := httptest.NewRecorder()
						c, _ := gin.CreateTestContext(recorder)
						c.Params = gin.Params{{Key: "trade_no", Value: trade}}
						c.Request = httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
						c.Request.Header.Set("Client-Id", config.ClientID)
						c.Request.Header.Set("Request-Time", timestamp)
						c.Request.Header.Set("Signature", "algorithm=RSA256,keyVersion=1,signature="+url.QueryEscape(base64.StdEncoding.EncodeToString(signature)))
						AntomNotify(c)
						if phase == "unavailable" || phase == "stale" {
							assert.Equal(t, http.StatusServiceUnavailable, recorder.Code)
						} else {
							assert.Equal(t, http.StatusOK, recorder.Code)
						}
					}
					held, _, e := model.GetAntomOrder(trade)
					require.NoError(t, e)
					assert.True(t, held.ReviewRequired)
					assert.Equal(t, "REFUNDED", held.GatewayStatus)
					assert.Zero(t, held.NextCheckAt)
					if credited {
						assert.Equal(t, "success", held.Status)
					} else {
						assert.Equal(t, "paid", held.Status)
						require.ErrorIs(t, model.CompleteAntomOrder(trade), model.ErrPaymentReviewRequired)
					}
					require.NoError(t, db.First(&after, refundUser.Id).Error)
					assert.Equal(t, before.Quota, after.Quota)
					view, e := model.GetSiteOrder(topup.Id)
					require.NoError(t, e)
					assert.True(t, view.ReviewRequired)
					assert.Equal(t, "REFUNDED", view.GatewayStatus)

				}
			})

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
					model.InvalidateSubscriptionPlanCache(plan.Id)
					t.Cleanup(func() { model.InvalidateSubscriptionPlanCache(plan.Id) })
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
					// Review-held subscriptions must not consume worker slots repeatedly.
					if channel == "antom" {
						_ = service.RunAntomReconciliation(context.Background())
					} else {
						_ = service.RunWebMoneyReconciliation(context.Background())
					}
					var held struct{ NextCheckAt int64 }
					require.NoError(t, db.Model(payment).Select("next_check_at").Where("trade_no = ?", conflictTrade).Take(&held).Error)
					assert.Zero(t, held.NextCheckAt, "a review-held payment must not be claimed")

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

						closedPlan = plan
						closedPlan.Id = 0
						require.NoError(t, db.Create(&closedPlan).Error)
						old := model.SubscriptionOrder{UserId: user.Id, PlanId: closedPlan.Id, TradeNo: "SUBANTexpired", PaymentProvider: channel, Status: "pending"}
						oldPayment := model.AntomOrder{TradeNo: old.TradeNo, UserID: user.Id, ConfigID: config.ID, RequestKey: "expired-sub", Amount: amount, Status: "pending", ExpiresAt: common.GetTimestamp() - 1}
						require.NoError(t, model.CreateDirectSubscriptionOrder(&old, &closedPlan, &oldPayment))
						require.NoError(t, model.ExpireAntomOrder(oldPayment.ID))
						require.NoError(t, model.ExpireAntomOrder(oldPayment.ID))
						require.NoError(t, db.First(&old, old.Id).Error)
						assert.Equal(t, "expired", old.Status)
						replacement := model.SubscriptionOrder{UserId: user.Id, PlanId: closedPlan.Id, TradeNo: "SUBANTreplacement", PaymentProvider: channel, Status: "pending"}
						newPayment := model.AntomOrder{TradeNo: replacement.TradeNo, UserID: user.Id, ConfigID: config.ID, RequestKey: "replacement-sub", Amount: amount, Status: "pending", ExpiresAt: common.GetTimestamp() + 600}
						require.NoError(t, model.CreateDirectSubscriptionOrder(&replacement, &closedPlan, &newPayment))
						require.NoError(t, model.RecordAntomPayment(&newPayment, "antom-replacement"))
						require.NoError(t, model.CompleteAntomOrder(replacement.TradeNo))
						// A payment authorized before expiry may still arrive afterwards.
						require.NoError(t, model.RecordAntomPayment(&oldPayment, "antom-expired-late"))
						require.NoError(t, model.CompleteAntomOrder(old.TradeNo))
						require.NoError(t, model.CompleteAntomOrder(old.TradeNo))
						require.True(t, model.DirectSubscriptionReviewRequired(old.TradeNo))
						require.NoError(t, db.Model(&model.UserSubscription{}).Where("user_id = ? AND plan_id = ?", user.Id, closedPlan.Id).Count(&count).Error)
						assert.EqualValues(t, 1, count)
					} else {
						closedPlan := plan
						closedPlan.Id = 0
						require.NoError(t, db.Create(&closedPlan).Error)
						old := model.SubscriptionOrder{UserId: user.Id, PlanId: closedPlan.Id, TradeNo: "SUBWMexpired", PaymentProvider: channel, Status: "pending"}
						oldPayment := model.WebMoneyOrder{TradeNo: old.TradeNo, UserID: user.Id, ConfigID: wmConfig.ID, RequestKey: "expired-sub", Amount: amount, Status: "pending", ExpiresAt: common.GetTimestamp() - 1}
						require.NoError(t, model.CreateDirectSubscriptionOrder(&old, &closedPlan, &oldPayment))
						require.NoError(t, model.ExpireWebMoneyOrder(oldPayment.ID))
						require.NoError(t, model.ExpireWebMoneyOrder(oldPayment.ID))
						require.NoError(t, db.First(&old, old.Id).Error)
						assert.Equal(t, "expired", old.Status)
						replacement := model.SubscriptionOrder{UserId: user.Id, PlanId: closedPlan.Id, TradeNo: "SUBWMreplacement", PaymentProvider: channel, Status: "pending"}
						newPayment := model.WebMoneyOrder{TradeNo: replacement.TradeNo, UserID: user.Id, ConfigID: wmConfig.ID, RequestKey: "replacement-sub", Amount: amount, Status: "pending", ExpiresAt: common.GetTimestamp() + 600}
						require.NoError(t, model.CreateDirectSubscriptionOrder(&replacement, &closedPlan, &newPayment))
						require.NoError(t, model.RecordWebMoneyPayment(&newPayment, "wm-replacement"))
						require.NoError(t, model.CompleteWebMoneyOrder(replacement.TradeNo))
						// A payment authorized before expiry may still arrive afterwards.
						require.NoError(t, model.RecordWebMoneyPayment(&oldPayment, "wm-expired-late"))
						require.NoError(t, model.CompleteWebMoneyOrder(old.TradeNo))
						require.NoError(t, model.CompleteWebMoneyOrder(old.TradeNo))
						require.True(t, model.DirectSubscriptionReviewRequired(old.TradeNo))
						require.NoError(t, db.Model(&model.UserSubscription{}).Where("user_id = ? AND plan_id = ?", user.Id, closedPlan.Id).Count(&count).Error)
						assert.EqualValues(t, 1, count)
					}

				})
			}

			t.Run("checkout result cannot bypass concurrent order changes", func(t *testing.T) {
				originalTransport := http.DefaultTransport
				defer func() { http.DefaultTransport = originalTransport }()
				for _, change := range []string{"cancel", "paid", "expired", "review"} {
					t.Run(change, func(t *testing.T) {
						trade := "ANTsession-" + change
						o := model.AntomOrder{TradeNo: trade, UserID: user.Id, ConfigID: config.ID, RequestKey: trade, Amount: "1.00", Status: "pending", ExpiresAt: common.GetTimestamp() + 600}
						top := model.TopUp{UserId: user.Id, TradeNo: trade, PaymentProvider: "antom", Status: "pending"}
						require.NoError(t, model.CreateAntomOrder(&o, &top))
						calls := 0
						http.DefaultTransport = webMoneyQueryTransport(func(r *http.Request) (*http.Response, error) {
							calls++
							assert.True(t, strings.HasSuffix(r.URL.Path, "/createPaymentSession"))
							switch change {
							case "cancel":
								_, err := model.RequestAntomCancellation(o.ID)
								require.NoError(t, err)
							case "paid":
								require.NoError(t, model.RecordAntomPayment(&o, trade))
							case "expired":
								require.NoError(t, db.Model(&o).Update("expires_at", common.GetTimestamp()-1).Error)
							case "review":
								require.NoError(t, db.Model(&o).Update("review_required", true).Error)
							}
							raw, err := common.Marshal(map[string]any{"result": map[string]string{"resultStatus": "S", "resultCode": "SUCCESS"}, "paymentSessionId": "session-race", "normalUrl": "https://checkout.antom.com/checkout-page/pages/payment/index.html?sessionData=race", "paymentSessionExpiryTime": time.Unix(common.GetTimestamp()+600, 0).UTC().Format(time.RFC3339)})
							require.NoError(t, err)
							stamp := time.Now().UTC().Format(time.RFC3339)
							digest := sha256.Sum256([]byte("POST " + r.URL.Path + "\n" + config.ClientID + "." + stamp + "." + string(raw)))
							sig, err := rsa.SignPKCS1v15(rand.Reader, provider, crypto.SHA256, digest[:])
							require.NoError(t, err)
							header := http.Header{}
							header.Set("Client-Id", config.ClientID)
							header.Set("Response-Time", stamp)
							header.Set("Signature", "algorithm=RSA256,keyVersion=1,signature="+url.QueryEscape(base64.StdEncoding.EncodeToString(sig)))
							return &http.Response{StatusCode: 200, Header: header, Body: io.NopCloser(strings.NewReader(string(raw)))}, nil
						})
						link, err := service.CreateAntomSession(context.Background(), &o, &config, "203.0.113.42")
						require.Error(t, err)
						assert.Empty(t, link)
						current, _, err := model.GetAntomOrder(trade)
						require.NoError(t, err)
						assert.Empty(t, current.SessionCiphertext)
						if change == "review" {
							assert.Empty(t, service.AntomCheckout(current, &config)["pay_link"])
							_, cancelErr := model.RequestAntomCancellation(o.ID)
							require.ErrorIs(t, cancelErr, model.ErrPaymentReviewRequired)
							require.ErrorIs(t, model.CloseAntomOrder(o.ID, "CANCELLED"), model.ErrPaymentReviewRequired)
						}
						// Even an earlier in-memory checkout snapshot cannot return a cached URL now.
						o.ExpiresAt = common.GetTimestamp() + 600
						o.SessionCiphertext, err = ring.Seal("hosted:https://checkout.antom.com/cached", fmt.Sprintf("antom/order/%d/session", o.ID))
						require.NoError(t, err)
						link, err = service.CreateAntomSession(context.Background(), &o, &config, "203.0.113.42")
						require.Error(t, err)
						assert.Empty(t, link)
						assert.Equal(t, 1, calls)
						require.NoError(t, db.Delete(&o).Error)
						require.NoError(t, db.Delete(&top).Error)
					})
				}
			})

			for _, channel := range []string{"antom", "webmoney"} {
				t.Run(channel+" fulfillment retry respects schedule", func(t *testing.T) {
					buyer := model.User{Username: "retry-" + channel, AffCode: "retry-" + channel, Status: common.UserStatusDisabled}
					require.NoError(t, db.Create(&buyer).Error)
					trade := "retry-" + channel
					top := model.TopUp{UserId: buyer.Id, TradeNo: trade, PaymentProvider: channel, Status: "pending"}
					var payment any
					run := service.RunAntomReconciliation
					if channel == "antom" {
						o := &model.AntomOrder{TradeNo: trade, UserID: buyer.Id, ConfigID: config.ID, RequestKey: trade, Amount: "1.00", CreditedQuota: 100, Status: "pending", NextCheckAt: common.GetTimestamp() + 3600}
						require.NoError(t, model.CreateAntomOrder(o, &top))
						require.NoError(t, model.RecordAntomPayment(o, trade))
						payment = o
					} else {
						config, err := model.CurrentWebMoneyConfig()
						require.NoError(t, err)
						o := &model.WebMoneyOrder{TradeNo: trade, UserID: buyer.Id, ConfigID: config.ID, RequestKey: trade, Amount: "1.00", CreditedQuota: 100, Status: "pending", NextCheckAt: common.GetTimestamp() + 3600}
						require.NoError(t, model.CreateWebMoneyOrder(o, &top))
						require.NoError(t, model.RecordWebMoneyPayment(o, trade))
						payment, run = o, service.RunWebMoneyReconciliation
					}
					_ = run(context.Background())
					var saved struct {
						Status      string
						NextCheckAt int64
						LogPending  bool
					}
					require.NoError(t, db.Model(payment).Where("trade_no = ?", trade).Take(&saved).Error)
					assert.Equal(t, "paid", saved.Status)
					assert.InDelta(t, common.GetTimestamp()+120, saved.NextCheckAt, 5, "verified receipt wakes fulfillment; failure gets backoff")
					require.NoError(t, db.Model(&buyer).Update("status", common.UserStatusEnabled).Error)
					_ = run(context.Background())
					require.NoError(t, db.First(&buyer, buyer.Id).Error)
					assert.Zero(t, buyer.Quota, "paid rows must respect retry backoff")
					require.NoError(t, db.Model(payment).Update("next_check_at", 0).Error)
					logDB := model.LOG_DB
					model.LOG_DB = nil
					_ = run(context.Background())
					model.LOG_DB = logDB
					require.NoError(t, db.Model(payment).Where("trade_no = ?", trade).Take(&saved).Error)
					assert.Equal(t, "success", saved.Status)
					assert.True(t, saved.LogPending)
					assert.Greater(t, saved.NextCheckAt, common.GetTimestamp())
					_ = run(context.Background())
					require.NoError(t, db.Model(payment).Where("trade_no = ?", trade).Take(&saved).Error)
					assert.True(t, saved.LogPending, "audit retries must also respect backoff")
					require.NoError(t, db.Model(payment).Update("next_check_at", 0).Error)
					_ = run(context.Background())
					require.NoError(t, db.Model(payment).Where("trade_no = ?", trade).Take(&saved).Error)
					assert.False(t, saved.LogPending)
					require.NoError(t, db.First(&buyer, buyer.Id).Error)
					assert.Equal(t, 100, buyer.Quota, "retrying audit work must not credit twice")
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

			t.Run("cancellation lease fences overlap and stale responses", func(t *testing.T) {
				pending := model.AntomOrder{TradeNo: "ANTcancel-lease", UserID: user.Id, ConfigID: config.ID, RequestKey: "cancel-lease", Amount: "1.00", Status: "pending"}
				top := model.TopUp{UserId: user.Id, TradeNo: pending.TradeNo, PaymentProvider: "antom", Status: "pending"}
				require.NoError(t, model.CreateAntomOrder(&pending, &top))
				first, err := model.RequestAntomCancellation(pending.ID)
				require.NoError(t, err)
				require.NotEmpty(t, first)
				originalTransport := http.DefaultTransport
				calls := 0
				http.DefaultTransport = webMoneyQueryTransport(func(r *http.Request) (*http.Response, error) {
					calls++
					return originalTransport.RoundTrip(r)
				})
				defer func() { http.DefaultTransport = originalTransport }()
				state, err := service.CancelAntomOrder(context.Background(), pending.TradeNo)
				require.NoError(t, err)
				assert.Equal(t, "closing", state)
				assert.Zero(t, calls, "another worker must not send a concurrent cancellation")
				require.Error(t, model.RecordAntomPayment(&pending, "lease-payment"))
				// A crashed worker can be replaced after lease expiry without trusting its late response.
				require.NoError(t, db.Model(&pending).Update("cancellation_until", common.GetTimestamp()-1).Error)
				second, err := model.RequestAntomCancellation(pending.ID)
				require.NoError(t, err)
				require.NotEmpty(t, second)
				assert.NotEqual(t, first, second)
				require.Error(t, model.FinishAntomCancellation(pending.ID, first, "F", "ORDER_STATUS_INVALID"))
				after, _, err := model.GetAntomOrder(pending.TradeNo)
				require.NoError(t, err)
				assert.Equal(t, "requested", after.CancellationState)
				require.Error(t, model.RecordAntomPayment(&pending, "lease-payment"))
				require.NoError(t, model.FinishAntomCancellation(pending.ID, second, "F", "ORDER_STATUS_INVALID"))
				require.Error(t, model.FinishAntomCancellation(pending.ID, first, "S", "SUCCESS"))
				after, _, err = model.GetAntomOrder(pending.TradeNo)
				require.NoError(t, err)
				assert.Equal(t, "pending", after.Status)
				assert.Equal(t, "rejected", after.CancellationState)
				require.NoError(t, model.RecordAntomPayment(&pending, "lease-payment"))
				require.NoError(t, db.Delete(&pending).Error)
				require.NoError(t, db.Delete(&top).Error)
			})

			t.Run("rejected cancellation resumes authoritative verification", func(t *testing.T) {
				pending := model.AntomOrder{TradeNo: "ANTcancel-rejected", UserID: user.Id, ConfigID: config.ID, RequestKey: "cancel-rejected", Amount: "1.00", CreditedQuota: 25, Status: "pending", CreatedAt: common.GetTimestamp(), ExpiresAt: common.GetTimestamp() + 600}
				top := model.TopUp{UserId: user.Id, TradeNo: pending.TradeNo, PaymentProvider: "antom", Status: "pending"}
				require.NoError(t, model.CreateAntomOrder(&pending, &top))
				response = map[string]any{"result": map[string]string{"resultStatus": "F", "resultCode": "ORDER_STATUS_INVALID"}}
				_, err := service.CancelAntomOrder(context.Background(), pending.TradeNo)
				require.Error(t, err)
				after, _, err := model.GetAntomOrder(pending.TradeNo)
				require.NoError(t, err)
				assert.Positive(t, after.NextCheckAt)
				assert.Empty(t, service.AntomCheckout(after, &config)["pay_link"])
				projected, err := model.GetSiteOrder(top.Id)
				require.NoError(t, err)
				assert.True(t, projected.CancelRequested)
				assert.Equal(t, "rejected", projected.CancellationState)
				assert.Equal(t, "rejected", personalOrderView(*projected)["cancellation_state"])
				assert.Equal(t, "ORDER_STATUS_INVALID", projected.CancellationCode)
				// PROCESSING updates the gateway result without dropping cancellation intent.
				response = map[string]any{"result": map[string]string{"resultStatus": "S", "resultCode": "SUCCESS"}, "paymentRequestId": pending.TradeNo, "paymentStatus": "PROCESSING", "paymentAmount": service.AntomAmount{Currency: "USD", Value: "100"}}
				require.NoError(t, service.ReconcileAntomOrder(context.Background(), pending.TradeNo))
				after, _, err = model.GetAntomOrder(pending.TradeNo)
				require.NoError(t, err)
				assert.Equal(t, "PROCESSING", after.GatewayStatus)
				assert.Empty(t, service.AntomCheckout(after, &config)["pay_link"])

				response = map[string]any{"result": map[string]string{"resultStatus": "S", "resultCode": "SUCCESS"}, "paymentRequestId": pending.TradeNo, "paymentId": "payment-cancel-rejected", "paymentStatus": "SUCCESS", "paymentAmount": service.AntomAmount{Currency: "USD", Value: "100"}}
				require.NoError(t, service.ReconcileAntomOrder(context.Background(), pending.TradeNo))
				after, _, err = model.GetAntomOrder(pending.TradeNo)
				require.NoError(t, err)
				assert.Equal(t, "success", after.Status)
				require.NoError(t, service.ReconcileAntomOrder(context.Background(), pending.TradeNo))
			})

			t.Run("local expiry preserves late payment and distinguishes gateway closure", func(t *testing.T) {
				for _, outcome := range []string{"SUCCESS", "FAIL", "CANCELLED", "cancel"} {
					trade := "ANTexpiry-" + outcome
					o := model.AntomOrder{TradeNo: trade, UserID: user.Id, ConfigID: config.ID, RequestKey: trade, Amount: "1.00", CreditedQuota: 25, Status: "pending", ExpiresAt: common.GetTimestamp() - 1}
					top := model.TopUp{UserId: user.Id, TradeNo: trade, PaymentProvider: "antom", Status: "pending"}
					require.NoError(t, model.CreateAntomOrder(&o, &top))
					response = map[string]any{"result": map[string]string{"resultStatus": "F", "resultCode": "ORDER_NOT_EXIST"}}
					require.NoError(t, service.ReconcileAntomOrder(context.Background(), trade))
					current, _, err := model.GetAntomOrder(trade)
					require.NoError(t, err)
					assert.Equal(t, "expired", current.Status)
					assert.True(t, current.PaymentUnresolved())
					assert.False(t, current.ClosureConfirmed())
					assert.Empty(t, service.AntomCheckout(current, &config)["pay_link"])
					projection, err := model.GetSiteOrder(top.Id)
					require.NoError(t, err)
					assert.Equal(t, "local_expiry", projection.CloseReason)
					assert.Zero(t, projection.ClosedAt)
					assert.Equal(t, "local_expiry", personalOrderView(*projection)["close_reason"])
					visible, _, err := model.ListSiteOrders(model.SiteOrderFilter{ID: top.Id, OwnerID: user.Id, ExcludeClosed: true, Page: 1, PageSize: 1})
					require.NoError(t, err)
					assert.Len(t, visible, 1, "local expiry must remain visible when excluding closed orders")
					response = map[string]any{"result": map[string]string{"resultStatus": "S", "resultCode": "SUCCESS"}, "paymentRequestId": trade, "paymentId": trade, "paymentStatus": outcome, "paymentAmount": service.AntomAmount{Currency: "USD", Value: "100"}}
					require.NoError(t, db.Model(&o).Update("next_check_at", 0).Error)
					if outcome == "cancel" {
						state, err := service.CancelAntomOrder(context.Background(), trade)
						require.NoError(t, err)
						assert.Equal(t, "closed", state)
					} else {
						_ = service.RunAntomReconciliation(context.Background())
					}
					current, _, err = model.GetAntomOrder(trade)
					require.NoError(t, err)
					projection, err = model.GetSiteOrder(top.Id)
					require.NoError(t, err)
					if outcome == "SUCCESS" {
						assert.Equal(t, "success", current.Status)
						require.NoError(t, service.ReconcileAntomOrder(context.Background(), trade))
					} else {
						assert.True(t, current.ClosureConfirmed())
						assert.Positive(t, projection.ClosedAt)
						assert.Equal(t, "gateway_closed", projection.CloseReason)
						visible, _, err = model.ListSiteOrders(model.SiteOrderFilter{ID: top.Id, OwnerID: user.Id, ExcludeClosed: true, Page: 1, PageSize: 1})
						require.NoError(t, err)
						assert.Empty(t, visible)
						require.Error(t, model.RecordAntomPayment(current, "contradictory-payment"))
					}
				}
			})

			t.Run("five channel review resolutions are atomic and preserve holds", func(t *testing.T) {
				channels := []struct {
					provider string
					target   any
					gateway  string
				}{
					{model.PaymentProviderAntom, &model.AntomOrder{}, "SUCCESS"},
					{model.PaymentProviderWebMoney, &model.WebMoneyOrder{}, "success"},
					{model.PaymentProviderMixPay, &model.MixPayOrder{}, "success"},
					{model.PaymentProviderAlipay, &model.AlipayOrder{}, "TRADE_SUCCESS"},
					{model.PaymentProviderWechatPay, &model.WechatPayOrder{}, "SUCCESS"},
				}
				for _, channel := range channels {
					for _, action := range []string{"fulfill", "refunded", "acknowledged"} {
						t.Run(channel.provider+"/"+action, func(t *testing.T) {
							trade := "review-" + channel.provider + "-" + action
							buyer := model.User{Username: trade, AffCode: uuid.NewString()[:8], Status: common.UserStatusEnabled}
							require.NoError(t, db.Create(&buyer).Error)
							top := model.TopUp{TradeNo: trade, UserId: buyer.Id, Status: "pending", PaymentProvider: channel.provider, PaymentMethod: channel.provider, Money: 1}
							require.NoError(t, db.Create(&top).Error)
							fields := map[string]any{"trade_no": trade, "user_id": buyer.Id, "request_key": trade, "status": "paid", "review_required": true, "gateway_status": channel.gateway, "credited_quota": 50}
							if channel.provider == model.PaymentProviderMixPay {
								fields["trace_id"], fields["verified_at"], fields["quote_amount"] = trade, common.GetTimestamp(), "1.00"
							} else {
								fields["provider_trade_no"] = trade
								if channel.provider == model.PaymentProviderAlipay || channel.provider == model.PaymentProviderWechatPay {
									delete(fields, "request_key")
									fields["amount_fen"] = 100
								} else {
									fields["amount"] = "1.00"
								}
							}
							require.NoError(t, db.Model(channel.target).Create(fields).Error)
							projection, err := model.GetSiteOrder(top.Id)
							require.NoError(t, err)
							require.Error(t, model.ResolvePaymentReview(projection, user.Id, action, "Verified in merchant dashboard", "refund-123", "stale"))
							if action == "refunded" {
								require.Error(t, model.ResolvePaymentReview(projection, user.Id, action, "Verified in merchant dashboard", "", projection.ReviewVersion))
							}
							require.NoError(t, model.ResolvePaymentReview(projection, user.Id, action, "Verified in merchant dashboard", "refund-123", projection.ReviewVersion))
							require.Error(t, model.ResolvePaymentReview(projection, user.Id, action, "Repeated request", "refund-123", projection.ReviewVersion))
							updated, err := model.GetSiteOrder(top.Id)
							require.NoError(t, err)
							assert.Equal(t, action, updated.ReviewResolution)
							require.NoError(t, db.First(&buyer, buyer.Id).Error)
							if action == "fulfill" {
								assert.Equal(t, 50, buyer.Quota)
								assert.Equal(t, "success", updated.OrderStatus)
								assert.False(t, updated.ReviewRequired)
							} else {
								assert.Zero(t, buyer.Quota)
								assert.True(t, updated.ReviewRequired)
								assert.Equal(t, model.PaymentOrderReviewClosed, updated.OrderStatus)
								require.NoError(t, db.Model(channel.target).Where("trade_no = ?", trade).Update("last_error", "new_payment_evidence").Error)
								changed, err := model.GetSiteOrder(top.Id)
								require.NoError(t, err)
								assert.Empty(t, changed.ReviewResolution, "new evidence reopens the review")
							}
							var count int64
							require.NoError(t, db.Model(&model.PaymentReview{}).Where("trade_no = ?", trade).Count(&count).Error)
							assert.EqualValues(t, 1, count)
							require.NoError(t, db.Model(channel.target).Where("trade_no = ?", trade).Update("cache_pending", false).Error)
							if channel.provider == model.PaymentProviderMixPay || channel.provider == model.PaymentProviderAntom || channel.provider == model.PaymentProviderWebMoney {
								require.NoError(t, db.Model(channel.target).Where("trade_no = ?", trade).Update("log_pending", false).Error)
							}
						})
					}
				}
				for _, channel := range channels {
					for _, action := range []string{"fulfill", "refunded", "acknowledged"} {
						t.Run(channel.provider+"/subscription/"+action, func(t *testing.T) {
							trade := "subreview-" + channel.provider + "-" + action
							buyer := model.User{Username: trade, AffCode: uuid.NewString()[:8], Status: common.UserStatusEnabled}
							require.NoError(t, db.Create(&buyer).Error)
							plan := model.SubscriptionPlan{Title: trade, Enabled: true, PriceAmount: 1, Currency: "USD", DurationUnit: "month", DurationValue: 1, TotalAmount: 12345, QuotaResetPeriod: "never"}
							require.NoError(t, db.Create(&plan).Error)
							payload, err := common.Marshal(plan)
							require.NoError(t, err)
							sub := model.SubscriptionOrder{TradeNo: trade, UserId: buyer.Id, PlanId: plan.Id, Status: model.SubscriptionOrderPaidReview, PaymentProvider: channel.provider, ProviderPayload: string(payload), Money: 1}
							require.NoError(t, db.Create(&sub).Error)
							fields := map[string]any{"trade_no": trade, "user_id": buyer.Id, "request_key": trade, "status": "paid", "review_required": true, "gateway_status": channel.gateway, "last_error": "subscription_conflict", "credited_quota": 50}
							if channel.provider == model.PaymentProviderMixPay {
								fields["trace_id"], fields["verified_at"], fields["quote_amount"], fields["plan_id"] = trade, common.GetTimestamp(), "1.00", plan.Id
							} else {
								fields["provider_trade_no"] = trade
								if channel.provider == model.PaymentProviderAlipay || channel.provider == model.PaymentProviderWechatPay {
									delete(fields, "request_key")
									fields["amount_fen"] = 100
								} else {
									fields["amount"] = "1.00"
								}
							}
							require.NoError(t, db.Model(channel.target).Create(fields).Error)
							projection, err := model.GetSiteOrder(-sub.Id)
							require.NoError(t, err)
							if action == "fulfill" {
								active := model.UserSubscription{UserId: buyer.Id, PlanId: plan.Id, Status: "active", EndTime: common.GetTimestamp() + 3600}
								require.NoError(t, db.Create(&active).Error)
								require.ErrorIs(t, model.ResolvePaymentReview(projection, user.Id, action, "Verified subscription payment", "", projection.ReviewVersion), model.ErrActiveSubscriptionExists)
								require.NoError(t, db.Model(&active).Update("status", "expired").Error)
							}
							require.NoError(t, model.ResolvePaymentReview(projection, user.Id, action, "Verified subscription payment", "refund-sub-123", projection.ReviewVersion))
							require.Error(t, model.ResolvePaymentReview(projection, user.Id, action, "Repeated subscription request", "refund-sub-123", projection.ReviewVersion))
							var activeCount int64
							require.NoError(t, db.Model(&model.UserSubscription{}).Where("user_id = ? AND status = ?", buyer.Id, "active").Count(&activeCount).Error)
							if action == "fulfill" {
								assert.EqualValues(t, 1, activeCount)
							} else {
								assert.Zero(t, activeCount)
								replacement := model.SubscriptionOrder{TradeNo: "replace-" + trade, UserId: buyer.Id, PlanId: plan.Id, Status: "pending", PaymentProvider: model.PaymentProviderAntom}
								payment := model.AntomOrder{TradeNo: replacement.TradeNo, UserID: buyer.Id, RequestKey: replacement.TradeNo, Status: "pending"}
								require.NoError(t, model.CreateDirectSubscriptionOrder(&replacement, &plan, &payment), "resolved review releases the reservation")
								require.NoError(t, db.Delete(&payment).Error)
								require.NoError(t, db.Delete(&replacement).Error)
							}
							require.NoError(t, db.First(&buyer, buyer.Id).Error)
							assert.Zero(t, buyer.Quota, "subscription resolution never credits the wallet")
							require.NoError(t, db.Model(channel.target).Where("trade_no = ?", trade).Update("cache_pending", false).Error)
							if channel.provider == model.PaymentProviderMixPay {
								require.NoError(t, db.Model(channel.target).Where("trade_no = ?", trade).Update("log_pending", false).Error)
							}
						})
					}
				}

			})

			t.Run("legacy rejected cancellation and old pending orders remain recoverable", func(t *testing.T) {
				for _, legacyRejected := range []bool{false, true} {
					trade := fmt.Sprintf("ANTold-%t", legacyRejected)
					pending := model.AntomOrder{TradeNo: trade, UserID: user.Id, ConfigID: config.ID, RequestKey: trade, Amount: "1.00", CreditedQuota: 25, Status: "pending", CreatedAt: common.GetTimestamp() - 73*3600, ExpiresAt: common.GetTimestamp() - 72*3600, NextCheckAt: common.GetTimestamp() - 1}
					if legacyRejected {
						pending.GatewayStatus, pending.LastError, pending.NextCheckAt = "CANCEL_REQUESTED", "cancellation_rejected", 0
					}
					top := model.TopUp{UserId: user.Id, TradeNo: trade, PaymentProvider: "antom", Status: "pending"}
					require.NoError(t, model.CreateAntomOrder(&pending, &top))
					response = map[string]any{"result": map[string]string{"resultStatus": "S", "resultCode": "SUCCESS"}, "paymentRequestId": trade, "paymentStatus": "PROCESSING", "paymentAmount": service.AntomAmount{Currency: "USD", Value: "100"}}
					// Worker selection must also include old rejected rows with next_check_at=0.
					_ = service.RunAntomReconciliation(context.Background())
					after, _, err := model.GetAntomOrder(trade)
					require.NoError(t, err)
					assert.Equal(t, "PROCESSING", after.GatewayStatus)
					assert.Greater(t, after.NextCheckAt, common.GetTimestamp())
					if legacyRejected {
						assert.Equal(t, "rejected", after.CancellationState)
					}
					response["paymentStatus"], response["paymentId"] = "SUCCESS", "payment-"+trade
					require.NoError(t, service.ReconcileAntomOrder(context.Background(), trade))
					after, _, err = model.GetAntomOrder(trade)
					require.NoError(t, err)
					assert.Equal(t, "success", after.Status)
				}
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
