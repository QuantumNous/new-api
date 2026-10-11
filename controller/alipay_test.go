package controller

import (
	"bytes"
	"context"
	"crypto"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/wechatpay-apiv3/wechatpay-go/core"
	"github.com/wechatpay-apiv3/wechatpay-go/services/payments"
	"io"
	"math"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stripe/stripe-go/v81"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"gorm.io/gorm/schema"
)

func TestAlipayPaymentDatabaseMatrix(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	pub, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	require.NoError(t, err)
	config := model.AlipayConfig{AppID: "2026000000000001", SellerID: "2088000000000001", PrivateKey: string(pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)})), PublicKey: string(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: pub})), Sandbox: true, UnitPrice: "7", MinTopUp: 1, PagePay: true, NotifyBaseURL: "http://localhost", ReturnURL: "http://localhost/wallet"}
	require.NoError(t, service.ValidateAlipayConfig(&config))
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			var driver gorm.Dialector
			switch dialect {
			case "sqlite":
				driver = sqlite.Open(":memory:")
			case "mysql":
				if os.Getenv("TEST_MYSQL_DSN") == "" {
					t.Skip("TEST_MYSQL_DSN not configured")
				}
				driver = mysql.Open(os.Getenv("TEST_MYSQL_DSN"))
			case "postgres":
				if os.Getenv("TEST_POSTGRES_DSN") == "" {
					t.Skip("TEST_POSTGRES_DSN not configured")
				}
				driver = postgres.Open(os.Getenv("TEST_POSTGRES_DSN"))
			}
			db, err := gorm.Open(driver, &gorm.Config{Logger: logger.Discard, NamingStrategy: schema.NamingStrategy{TablePrefix: "alipay_verify_"}})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			sqlDB.SetMaxOpenConns(1)
			oldDB, oldLog, oldType, oldRedis := model.DB, model.LOG_DB, common.MainDatabaseType(), common.RedisEnabled
			model.DB = db
			model.LOG_DB = db
			common.RedisEnabled = false
			common.SetMainDatabaseType(common.DatabaseType(dialect))
			tables := []any{&model.WechatPayConfig{}, &model.WechatPayOrder{}, &model.AlipayOrder{}, &model.AlipayConfig{}, &model.TopUp{}, &model.SubscriptionOrder{}, &model.SubscriptionPlan{}, &model.UserSubscription{}, &model.User{}, &model.Log{}}
			t.Cleanup(func() {
				require.NoError(t, db.Migrator().DropTable(tables...))
				model.DB = oldDB
				model.LOG_DB = oldLog
				common.SetMainDatabaseType(oldType)
				common.RedisEnabled = oldRedis
				require.NoError(t, sqlDB.Close())
			})
			// Exercise upgrading representative pre-receipt schemas and records.
			legacyTopUp := struct {
				Id              int
				UserId          int `gorm:"index"`
				Amount          int64
				Money           float64
				TradeNo         string `gorm:"unique;type:varchar(255);index"`
				PaymentMethod   string `gorm:"type:varchar(50)"`
				PaymentProvider string `gorm:"type:varchar(50);default:''"`
				CreateTime      int64
				CompleteTime    int64
				Status          string
			}{TradeNo: "legacy-receipt-topup", Money: 12.5}
			legacySub := struct {
				Id              int
				UserId          int `gorm:"index"`
				PlanId          int `gorm:"index"`
				Money           float64
				TradeNo         string `gorm:"unique;type:varchar(255);index"`
				PaymentMethod   string `gorm:"type:varchar(50)"`
				PaymentProvider string `gorm:"type:varchar(50);default:''"`
				Status          string
				CreateTime      int64
				CompleteTime    int64
				ProviderPayload string `gorm:"type:text"`
			}{TradeNo: "legacy-receipt-subscription", Money: 7.5, ProviderPayload: "preserved"}
			require.NoError(t, db.Table(db.NamingStrategy.TableName("TopUp")).AutoMigrate(&legacyTopUp))
			require.NoError(t, db.Table(db.NamingStrategy.TableName("SubscriptionOrder")).AutoMigrate(&legacySub))
			require.NoError(t, db.Table(db.NamingStrategy.TableName("TopUp")).Create(&legacyTopUp).Error)
			require.NoError(t, db.Table(db.NamingStrategy.TableName("SubscriptionOrder")).Create(&legacySub).Error)
			// Create the released provider schemas without the lifecycle additions.
			for _, name := range []string{"AlipayOrder", "WechatPayOrder"} {
				legacy := struct {
					ID              int
					TradeNo         string `gorm:"type:varchar(64);uniqueIndex"`
					ConfigID        int    `gorm:"index"`
					UserID          int    `gorm:"index"`
					AmountFen       int64
					CreditedQuota   int
					ProviderTradeNo *string `gorm:"type:varchar(64);uniqueIndex"`
					Status          string  `gorm:"type:varchar(24);index"`
					ExpiresAt       int64
					NextCheckAt     int64 `gorm:"index"`
					CachePending    bool
					CreditSequence  int64
					LastError       string `gorm:"type:varchar(64)"`
				}{TradeNo: "legacy-lifecycle", Status: "pending", AmountFen: 123, ExpiresAt: 1234567890}
				require.NoError(t, db.Table(db.NamingStrategy.TableName(name)).AutoMigrate(&legacy))
				require.NoError(t, db.Table(db.NamingStrategy.TableName(name)).Create(&legacy).Error)
			}

			require.NoError(t, db.AutoMigrate(tables...))
			require.NoError(t, db.Table("audit_logs").AutoMigrate(&model.AuditLog{}))
			t.Cleanup(func() { require.NoError(t, db.Migrator().DropTable("audit_logs")) })
			require.NoError(t, db.AutoMigrate(tables...))
			for _, target := range []any{&model.AlipayOrder{}, &model.WechatPayOrder{}} {
				var preserved struct {
					TradeNo         string
					AmountFen       int64
					ExpiresAt       int64
					CancelRequested bool
				}
				require.NoError(t, db.Model(target).Where("trade_no = ?", "legacy-lifecycle").First(&preserved).Error)
				assert.EqualValues(t, 123, preserved.AmountFen)
				assert.EqualValues(t, 1234567890, preserved.ExpiresAt)
				assert.False(t, preserved.CancelRequested)
				require.NoError(t, db.Where("trade_no = ?", "legacy-lifecycle").Delete(target).Error)
			}

			var migratedTopUp model.TopUp
			var migratedSub model.SubscriptionOrder
			require.NoError(t, db.First(&migratedTopUp, legacyTopUp.Id).Error)
			require.NoError(t, db.First(&migratedSub, legacySub.Id).Error)
			assert.Equal(t, 12.5, migratedTopUp.Money)
			assert.Equal(t, "preserved", migratedSub.ProviderPayload)
			assert.Empty(t, migratedTopUp.PaymentReceipt.ReceiptCurrency)
			assert.Empty(t, migratedSub.PaymentReceipt.ReceiptCurrency)
			duplicateLegacy := model.TopUp{TradeNo: legacyTopUp.TradeNo}
			assert.Error(t, db.Create(&duplicateLegacy).Error)
			require.NoError(t, db.Delete(&migratedTopUp).Error)
			require.NoError(t, db.Delete(&migratedSub).Error)
			var version string
			query := "SELECT version()"
			if dialect == "sqlite" {
				query = "SELECT sqlite_version()"
			}
			require.NoError(t, db.Raw(query).Scan(&version).Error)
			t.Log(version)
			cfg := config
			cfg.ID = 0
			require.NoError(t, db.Create(&cfg).Error)
			user := model.User{Username: "alipay-test", Quota: 100, AuthVersion: 1}
			require.NoError(t, db.Create(&user).Error)
			topup := model.TopUp{UserId: user.Id, TradeNo: "ALIverified", PaymentProvider: model.PaymentProviderAlipay, PaymentMethod: model.PaymentMethodAlipayDirect, Status: common.TopUpStatusPending}
			order := model.AlipayOrder{TradeNo: topup.TradeNo, UserID: user.Id, ConfigID: cfg.ID, AmountFen: 700, CreditedQuota: 500000, Status: common.TopUpStatusPending}
			require.NoError(t, model.CreateAlipayOrder(&topup, &order))
			assert.Error(t, model.ManualCompleteTopUp(order.TradeNo, ""))
			values := url.Values{"app_id": {cfg.AppID}, "seller_id": {cfg.SellerID}, "out_trade_no": {order.TradeNo}, "trade_no": {"20261009000001"}, "trade_status": {"TRADE_SUCCESS"}, "total_amount": {"7.00"}, "sign_type": {"RSA2"}}
			sign := func(v url.Values) {
				keys := make([]string, 0, len(v))
				for k := range v {
					if k != "sign" && k != "sign_type" {
						keys = append(keys, k)
					}
				}
				sort.Strings(keys)
				parts := []string{}
				for _, k := range keys {
					parts = append(parts, k+"="+v.Get(k))
				}
				hash := sha256.Sum256([]byte(strings.Join(parts, "&")))
				sig, e := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, hash[:])
				require.NoError(t, e)
				v.Set("sign", base64.StdEncoding.EncodeToString(sig))
			}
			sign(values)
			notify := func(v url.Values) *httptest.ResponseRecorder {
				w := httptest.NewRecorder()
				c, _ := gin.CreateTestContext(w)
				c.Request = httptest.NewRequest("POST", "/api/user/alipay/notify", strings.NewReader(v.Encode()))
				c.Request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
				AlipayNotify(c)
				return w
			}
			for _, field := range []string{"app_id", "seller_id", "total_amount"} {
				v := url.Values{}
				for k, vs := range values {
					v[k] = append([]string{}, vs...)
				}
				v.Set(field, "9999999999999999")
				sign(v)
				assert.Equal(t, 400, notify(v).Code, field)
			}
			values.Add("total_amount", "7.00")
			assert.Equal(t, 400, notify(values).Code)
			values["total_amount"] = []string{"7.00"}
			values.Set("sign", "invalid")
			assert.Equal(t, 400, notify(values).Code)
			sign(values)
			for range 3 {
				w := notify(values)
				require.Equal(t, 200, w.Code, w.Body.String())
				assert.Equal(t, "success", w.Body.String())
			}
			require.NoError(t, db.First(&user, user.Id).Error)
			assert.Equal(t, 500100, user.Quota)
			assert.EqualValues(t, 500000, user.AlipayCredit)
			require.NoError(t, db.First(&order, order.ID).Error)
			assert.Equal(t, common.TopUpStatusSuccess, order.Status)
			assert.False(t, order.CachePending)
			assert.Error(t, model.RecordAlipayPayment(order.TradeNo, "different", 700))
			assert.Error(t, model.RecordAlipayPayment(order.TradeNo, *order.ProviderTradeNo, 701))

			// Paid evidence survives an overflow and the wallet transaction rolls back.
			overflowTopup := model.TopUp{UserId: user.Id, TradeNo: "ALIoverflow", PaymentProvider: model.PaymentProviderAlipay, Status: common.TopUpStatusPending}
			overflowOrder := model.AlipayOrder{TradeNo: overflowTopup.TradeNo, UserID: user.Id, ConfigID: cfg.ID, AmountFen: 700, CreditedQuota: int(common.MaxWalletQuota), Status: common.TopUpStatusPending}
			require.NoError(t, model.CreateAlipayOrder(&overflowTopup, &overflowOrder))
			require.NoError(t, model.RecordAlipayPayment(overflowOrder.TradeNo, "overflow-provider", 700))
			require.Error(t, model.CompleteAlipayTopUp(overflowOrder.TradeNo))
			require.NoError(t, db.First(&overflowOrder, overflowOrder.ID).Error)
			assert.Equal(t, "paid", overflowOrder.Status)
			require.NoError(t, db.First(&user, user.Id).Error)
			assert.Equal(t, 500100, user.Quota)
			// A provider transaction cannot fund a second merchant order.
			duplicateTopup := model.TopUp{UserId: user.Id, TradeNo: "ALIduplicate", PaymentProvider: model.PaymentProviderAlipay, Status: common.TopUpStatusPending}
			duplicateOrder := model.AlipayOrder{TradeNo: duplicateTopup.TradeNo, UserID: user.Id, ConfigID: cfg.ID, AmountFen: 700, CreditedQuota: 500, Status: common.TopUpStatusPending}
			require.NoError(t, model.CreateAlipayOrder(&duplicateTopup, &duplicateOrder))
			require.Error(t, model.RecordAlipayPayment(duplicateOrder.TradeNo, *order.ProviderTradeNo, 700))
			// An owner-only lookup never exposes another user's order.
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Set("id", user.Id+1)
			c.Params = gin.Params{{Key: "trade_no", Value: order.TradeNo}}
			GetAlipayOrderStatus(c)
			assert.Equal(t, 404, w.Code)
			// The unique predecessor prevents concurrent configuration revisions.
			next := cfg
			next.ID = 0
			next.PreviousID = cfg.ID
			require.NoError(t, db.Create(&next).Error)
			next.ID = 0
			assert.Error(t, db.Create(&next).Error)
			require.NoError(t, db.AutoMigrate(tables...))
			require.NoError(t, db.First(&user, user.Id).Error)
			assert.Equal(t, 500100, user.Quota)
			// Fractional USD credit remains exact in settlement and history.
			localUser := model.User{Username: "alipay-cny", AffCode: "alipay-cny", Quota: 0, AuthVersion: 1}
			require.NoError(t, db.Create(&localUser).Error)
			localTopup := model.TopUp{UserId: localUser.Id, Amount: 14, Money: 90, TradeNo: "ALI-cny", PaymentProvider: model.PaymentProviderAlipay, PaymentMethod: model.PaymentMethodAlipayDirect, Status: common.TopUpStatusPending}
			localOrder := model.AlipayOrder{TradeNo: localTopup.TradeNo, UserID: localUser.Id, ConfigID: cfg.ID, AmountFen: 9000, CreditedQuota: 7142857, Status: common.TopUpStatusPending}
			require.NoError(t, model.CreateAlipayOrder(&localTopup, &localOrder))
			require.NoError(t, model.RecordAlipayPayment(localOrder.TradeNo, "cny-provider", 9000))
			require.NoError(t, model.CompleteAlipayTopUp(localOrder.TradeNo))
			require.NoError(t, db.First(&localUser, localUser.Id).Error)
			assert.Equal(t, 7142857, localUser.Quota)
			require.NoError(t, model.PopulateAlipayTopUpQuotas([]*model.TopUp{&localTopup}))
			assert.Equal(t, 7142857, localTopup.CreditedQuota)
			wxPrivate, err := x509.MarshalPKCS8PrivateKey(key)
			require.NoError(t, err)
			wxConfig := model.WechatPayConfig{AppID: "wx1234567890abcdef", MchID: "1900000109", SerialNo: strings.Repeat("A", 40), PrivateKey: string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: wxPrivate})), APIv3Key: "abcdef0123456789abcdef0123456789", PublicKeyID: "PUB_KEY_ID_0123456789abcdef0123456789abcdef", PublicKey: config.PublicKey, NotifyBaseURL: "https://example.test", MinTopUp: 1}
			require.NoError(t, service.ValidateWechatPayConfig(&wxConfig))
			require.NoError(t, db.Create(&wxConfig).Error)
			wxTopup := model.TopUp{UserId: localUser.Id, Amount: 14, Money: 90, TradeNo: "WXverified", PaymentProvider: model.PaymentProviderWechatPay, PaymentMethod: model.PaymentMethodWechatPay, Status: common.TopUpStatusPending}
			wxOrder := model.WechatPayOrder{TradeNo: wxTopup.TradeNo, ConfigID: wxConfig.ID, UserID: localUser.Id, AmountFen: 9000, CreditedQuota: 7142857, Status: common.TopUpStatusPending}
			require.NoError(t, model.CreateWechatPayOrder(&wxTopup, &wxOrder))
			t.Run("Native SDK signed request and response", func(t *testing.T) {
				transport := http.DefaultTransport
				t.Cleanup(func() { http.DefaultTransport = transport })
				for _, valid := range []bool{true, false} {
					http.DefaultTransport = wechatFixtureTransport(func(req *http.Request) (*http.Response, error) {
						assert.Equal(t, "https://api.mch.weixin.qq.com/v3/pay/transactions/native", req.URL.String())
						body, err := io.ReadAll(req.Body)
						require.NoError(t, err)
						var request struct {
							AppID     string `json:"appid"`
							MchID     string `json:"mchid"`
							TradeNo   string `json:"out_trade_no"`
							NotifyURL string `json:"notify_url"`
							Amount    struct {
								Total    int64  `json:"total"`
								Currency string `json:"currency"`
							} `json:"amount"`
						}
						require.NoError(t, common.Unmarshal(body, &request))
						assert.Equal(t, wxConfig.AppID, request.AppID)
						assert.Equal(t, wxConfig.MchID, request.MchID)
						assert.Equal(t, wxOrder.TradeNo, request.TradeNo)
						assert.EqualValues(t, 9000, request.Amount.Total)
						assert.Equal(t, "CNY", request.Amount.Currency)
						assert.Equal(t, fmt.Sprintf("https://example.test/api/user/wechatpay/notify/%d", wxConfig.ID), request.NotifyURL)
						auth := map[string]string{}
						for _, match := range regexp.MustCompile(`([a-z_]+)="([^"]+)"`).FindAllStringSubmatch(req.Header.Get("Authorization"), -1) {
							auth[match[1]] = match[2]
						}
						digest := sha256.Sum256([]byte(fmt.Sprintf("POST\n/v3/pay/transactions/native\n%s\n%s\n%s\n", auth["timestamp"], auth["nonce_str"], body)))
						sig, err := base64.StdEncoding.DecodeString(auth["signature"])
						require.NoError(t, err)
						require.NoError(t, rsa.VerifyPKCS1v15(&key.PublicKey, crypto.SHA256, digest[:], sig))
						responseBody := `{"code_url":"weixin://wxpay/bizpayurl?pr=fixture"}`
						timestamp := strconv.FormatInt(time.Now().Unix(), 10)
						digest = sha256.Sum256([]byte(timestamp + "\nresponse-nonce\n" + responseBody + "\n"))
						sig, err = rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, digest[:])
						require.NoError(t, err)
						header := http.Header{}
						header.Set("Wechatpay-Serial", wxConfig.PublicKeyID)
						header.Set("Wechatpay-Timestamp", timestamp)
						header.Set("Wechatpay-Nonce", "response-nonce")
						header.Set("Wechatpay-Signature", base64.StdEncoding.EncodeToString(sig))
						if !valid {
							header.Set("Wechatpay-Signature", "invalid")
						}
						return &http.Response{StatusCode: 200, Header: header, Body: io.NopCloser(strings.NewReader(responseBody)), Request: req}, nil
					})
					link, err := service.CreateWechatPayCheckout(context.Background(), &wxConfig, &wxOrder)
					if valid {
						require.NoError(t, err)
						assert.Equal(t, "weixin://wxpay/bizpayurl?pr=fixture", link)
					} else {
						require.Error(t, err)
						assert.Empty(t, link)
					}
				}
			})

			require.Error(t, model.ManualCompleteTopUp(wxOrder.TradeNo, ""))
			require.Error(t, model.CompleteWechatPayTopUp(wxOrder.TradeNo))
			transaction := payments.Transaction{Appid: core.String(wxConfig.AppID), Mchid: core.String(wxConfig.MchID), OutTradeNo: core.String(wxOrder.TradeNo), TransactionId: core.String("420000000001"), TradeState: core.String("SUCCESS"), TradeType: core.String("NATIVE"), Amount: &payments.TransactionAmount{Total: core.Int64(9000), Currency: core.String("CNY")}}
			for _, testCase := range []struct {
				name   string
				mutate func(*payments.Transaction)
			}{
				{"wrong merchant", func(tx *payments.Transaction) { tx.Mchid = core.String("1900000110") }},
				{"wrong app", func(tx *payments.Transaction) { tx.Appid = core.String("wx0000000000000000") }},
				{"wrong amount", func(tx *payments.Transaction) {
					tx.Amount = &payments.TransactionAmount{Total: core.Int64(8999), Currency: core.String("CNY")}
				}},
				{"wrong currency", func(tx *payments.Transaction) {
					tx.Amount = &payments.TransactionAmount{Total: core.Int64(9000), Currency: core.String("USD")}
				}},
			} {
				t.Run(testCase.name, func(t *testing.T) {
					tx := transaction
					testCase.mutate(&tx)
					req := wechatNotifyFixture(t, key, wxConfig, &tx, time.Now().Unix())
					w := httptest.NewRecorder()
					c, _ := gin.CreateTestContext(w)
					c.Request = req
					c.Params = gin.Params{{Key: "config_id", Value: strconv.Itoa(wxConfig.ID)}}
					WechatPayNotify(c)
					c.Writer.WriteHeaderNow()
					assert.Equal(t, 400, w.Code)
				})
			}
			for _, bad := range []string{"signature", "expired", "serial", "nonce"} {
				req := wechatNotifyFixture(t, key, wxConfig, &transaction, time.Now().Unix())
				switch bad {
				case "signature":
					req.Header.Set("Wechatpay-Signature", "bad")
				case "expired":
					req = wechatNotifyFixture(t, key, wxConfig, &transaction, time.Now().Add(-10*time.Minute).Unix())
				case "serial":
					req.Header.Set("Wechatpay-Serial", "PUB_KEY_ID_wrong")
				case "nonce":
					req.Body = io.NopCloser(strings.NewReader(`{"resource":{"nonce":"bad"}}`))
				}
				_, err := service.VerifyWechatPayNotification(&wxConfig, req)
				require.Error(t, err, bad)
			}
			for range 2 {
				w := httptest.NewRecorder()
				c, _ := gin.CreateTestContext(w)
				c.Request = wechatNotifyFixture(t, key, wxConfig, &transaction, time.Now().Unix())
				c.Params = gin.Params{{Key: "config_id", Value: strconv.Itoa(wxConfig.ID)}}
				WechatPayNotify(c)
				c.Writer.WriteHeaderNow()
				assert.Equal(t, 204, w.Code)
			}
			require.NoError(t, db.First(&localUser, localUser.Id).Error)
			assert.Equal(t, 14285714, localUser.Quota)
			assert.EqualValues(t, 14285714, localUser.AlipayCredit)
			require.NoError(t, model.PopulateWechatPayTopUpQuotas([]*model.TopUp{&wxTopup}))
			assert.Equal(t, 7142857, wxTopup.CreditedQuota)
			require.Error(t, model.RecordWechatPayPayment(wxOrder.TradeNo, "different", 9000))
			require.Error(t, model.RecordWechatPayPayment(wxOrder.TradeNo, "420000000001", 1))
			overflowWX := model.TopUp{UserId: localUser.Id, TradeNo: "WXoverflow", PaymentProvider: model.PaymentProviderWechatPay, Status: common.TopUpStatusPending}
			overflowWXOrder := model.WechatPayOrder{TradeNo: overflowWX.TradeNo, ConfigID: wxConfig.ID, UserID: localUser.Id, AmountFen: 9000, CreditedQuota: int(common.MaxWalletQuota), Status: common.TopUpStatusPending}
			require.NoError(t, model.CreateWechatPayOrder(&overflowWX, &overflowWXOrder))
			require.Error(t, model.RecordWechatPayPayment(overflowWX.TradeNo, "420000000001", 9000))
			require.NoError(t, model.RecordWechatPayPayment(overflowWX.TradeNo, "420000000002", 9000))
			require.Error(t, model.CompleteWechatPayTopUp(overflowWX.TradeNo))
			require.NoError(t, db.First(&overflowWXOrder, overflowWXOrder.ID).Error)
			assert.Equal(t, "paid", overflowWXOrder.Status)
			require.NoError(t, db.First(&localUser, localUser.Id).Error)
			assert.Equal(t, 14285714, localUser.Quota)
			wrongKey := wxConfig
			wrongKey.APIv3Key = "0123456789abcdef0123456789abcdef"
			_, decryptErr := service.VerifyWechatPayNotification(&wrongKey, wechatNotifyFixture(t, key, wxConfig, &transaction, time.Now().Unix()))
			require.Error(t, decryptErr)

			w = httptest.NewRecorder()
			c, _ = gin.CreateTestContext(w)
			c.Set("id", localUser.Id+1)
			c.Params = gin.Params{{Key: "trade_no", Value: wxOrder.TradeNo}}
			GetWechatPayOrderStatus(c)
			assert.Equal(t, 404, w.Code)

			t.Run("CNY subscription admin pricing and balance", func(t *testing.T) {
				settings := operation_setting.GetPaymentSetting()
				oldSettings := *settings
				oldRate, oldQuota := operation_setting.USDExchangeRate, common.QuotaPerUnit
				t.Cleanup(func() {
					*settings = oldSettings
					operation_setting.USDExchangeRate = oldRate
					common.QuotaPerUnit = oldQuota
				})
				settings.ComplianceConfirmed = true
				settings.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
				operation_setting.USDExchangeRate = 7
				common.QuotaPerUnit = 500000
				plan := model.SubscriptionPlan{Title: "CNY month", Currency: "CNY", PriceAmount: 7, Enabled: true, DurationUnit: "month", DurationValue: 1}
				payload, err := common.Marshal(AdminUpsertSubscriptionPlanRequest{Plan: plan})
				require.NoError(t, err)
				w := httptest.NewRecorder()
				c, _ := gin.CreateTestContext(w)
				c.Request = httptest.NewRequest(http.MethodPost, "/", strings.NewReader(string(payload)))
				c.Request.Header.Set("Content-Type", "application/json")
				AdminCreateSubscriptionPlan(c)
				var response struct {
					Success bool
					Data    model.SubscriptionPlan
				}
				require.NoError(t, common.Unmarshal(w.Body.Bytes(), &response))
				require.True(t, response.Success, w.Body.String())
				require.Equal(t, "CNY", response.Data.Currency)
				// The update endpoint must persist the selected currency as well.
				plan = response.Data
				plan.Currency = "USD"
				require.NoError(t, db.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).Update("currency", "USD").Error)
				plan.Currency = "CNY"
				payload, err = common.Marshal(AdminUpsertSubscriptionPlanRequest{Plan: plan})
				require.NoError(t, err)
				w = httptest.NewRecorder()
				c, _ = gin.CreateTestContext(w)
				c.Params = gin.Params{{Key: "id", Value: strconv.Itoa(plan.Id)}}
				c.Request = httptest.NewRequest(http.MethodPut, "/", strings.NewReader(string(payload)))
				c.Request.Header.Set("Content-Type", "application/json")
				AdminUpdateSubscriptionPlan(c)
				require.NoError(t, common.Unmarshal(w.Body.Bytes(), &response))
				require.True(t, response.Success, w.Body.String())
				require.NoError(t, db.First(&plan, plan.Id).Error)
				require.Equal(t, "CNY", plan.Currency)
				_, fen, err := quoteDirectSubscription(plan.Id)
				require.NoError(t, err)
				assert.Equal(t, int64(700), fen)
				operation_setting.USDExchangeRate = 8
				_, fen, err = quoteDirectSubscription(plan.Id)
				require.NoError(t, err)
				assert.Equal(t, int64(700), fen)
				operation_setting.USDExchangeRate = 7
				user := model.User{Username: "cny-balance", AffCode: "cny-bal", Quota: 1000000}
				require.NoError(t, db.Create(&user).Error)
				require.NoError(t, model.PurchaseSubscriptionWithBalance(user.Id, plan.Id))
				require.NoError(t, db.First(&user, user.Id).Error)
				assert.Equal(t, 500000, user.Quota)
				var order model.SubscriptionOrder
				require.NoError(t, db.Where("user_id = ?", user.Id).First(&order).Error)
				assert.Equal(t, "CNY", order.PaymentReceipt.ReceiptCurrency)
				assert.Equal(t, "7", order.PaymentReceipt.ReceiptAmount)
			})

			for _, provider := range []string{model.PaymentProviderAlipay, model.PaymentProviderWechatPay} {
				for _, late := range []bool{false, true} {
					suffix := fmt.Sprintf("-%t", late)
					t.Run("one-time subscription "+provider+suffix, func(t *testing.T) {
						user := model.User{Username: "sub-direct-" + provider + suffix, AffCode: "sd-" + provider + suffix, Quota: 12345}
						require.NoError(t, db.Create(&user).Error)
						plan := model.SubscriptionPlan{Title: "Frozen month", PriceAmount: 10, Currency: "CNY", DurationUnit: "month", DurationValue: 1, Enabled: true, TotalAmount: 500000, QuotaResetPeriod: "never", MaxPurchasePerUser: 1}
						require.NoError(t, db.Create(&plan).Error)
						_, fen, err := quoteDirectSubscription(plan.Id)
						require.NoError(t, err)
						assert.Equal(t, int64(1000), fen)
						tradeNo, method := "SUBALI-test"+suffix, model.PaymentMethodAlipayDirect
						var payment any
						record := model.RecordAlipayPayment
						complete := model.CompleteAlipayTopUp
						closeOrder := model.CloseAlipayOrder
						if provider == model.PaymentProviderWechatPay {
							tradeNo, method = "SUBWX-test"+suffix, model.PaymentMethodWechatPay
							record, complete, closeOrder = model.RecordWechatPayPayment, model.CompleteWechatPayTopUp, model.CloseWechatPayOrder
							payment = &model.WechatPayOrder{ConfigID: wxConfig.ID, TradeNo: tradeNo, UserID: user.Id, AmountFen: fen, Status: "pending"}
						} else {
							payment = &model.AlipayOrder{ConfigID: cfg.ID, TradeNo: tradeNo, UserID: user.Id, AmountFen: fen, Status: "pending"}
						}
						order := model.SubscriptionOrder{UserId: user.Id, PlanId: plan.Id, Money: 10, TradeNo: tradeNo, PaymentProvider: provider, PaymentMethod: method, Status: "pending"}
						require.NoError(t, model.CreateDirectSubscriptionOrder(&order, &plan, payment))
						duplicate := order
						duplicate.Id = 0
						duplicate.TradeNo += "-other"
						require.Error(t, model.CreateDirectSubscriptionOrder(&duplicate, &plan, payment))
						if late {
							require.NoError(t, closeOrder(tradeNo))
							require.NoError(t, db.First(&order, order.Id).Error)
							require.Equal(t, "expired", order.Status)
						}
						require.Error(t, complete(tradeNo))
						require.Error(t, record(tradeNo, "sub-tx-"+provider+suffix, fen-1))
						require.NoError(t, db.Model(&plan).Updates(map[string]any{"duration_value": 12, "total_amount": 99, "price_amount": 999}).Error)
						if provider == model.PaymentProviderAlipay {
							notification := url.Values{"app_id": {cfg.AppID}, "seller_id": {cfg.SellerID}, "out_trade_no": {tradeNo}, "trade_no": {"sub-tx-" + provider + suffix}, "trade_status": {"TRADE_SUCCESS"}, "total_amount": {"10.00"}, "sign_type": {"RSA2"}}
							sign(notification)
							require.Equal(t, http.StatusOK, notify(notification).Code)
						} else {
							paid := transaction
							paid.OutTradeNo = core.String(tradeNo)
							paid.TransactionId = core.String("sub-tx-" + provider + suffix)
							paid.Amount = &payments.TransactionAmount{Total: core.Int64(fen), Currency: core.String("CNY")}
							req := wechatNotifyFixture(t, key, wxConfig, &paid, time.Now().Unix())
							w := httptest.NewRecorder()
							c, _ := gin.CreateTestContext(w)
							c.Request = req
							c.Params = gin.Params{{Key: "config_id", Value: strconv.Itoa(wxConfig.ID)}}
							WechatPayNotify(c)
							c.Writer.WriteHeaderNow()
							require.Equal(t, http.StatusNoContent, w.Code)
						}
						require.NoError(t, complete(tradeNo))
						require.NoError(t, complete(tradeNo))
						require.NoError(t, record(tradeNo, "sub-tx-"+provider+suffix, fen))
						require.Error(t, record(tradeNo, "different-tx", fen))
						require.NoError(t, closeOrder(tradeNo))
						var subs []model.UserSubscription
						require.NoError(t, db.Where("user_id = ?", user.Id).Find(&subs).Error)
						require.Len(t, subs, 1)
						assert.Equal(t, int64(500000), subs[0].AmountTotal)
						assert.Equal(t, time.Unix(subs[0].StartTime, 0).AddDate(0, 1, 0).Unix(), subs[0].EndTime)
						require.NoError(t, db.First(&user, user.Id).Error)
						assert.Equal(t, 12345, user.Quota)
						require.NoError(t, db.First(&order, order.Id).Error)
						assert.Equal(t, "success", order.Status)
						assert.Equal(t, "CNY", order.PaymentReceipt.ReceiptCurrency)
						assert.Equal(t, "10.00", order.PaymentReceipt.ReceiptAmount)
						orders, total, err := model.ListSiteOrders(model.SiteOrderFilter{OwnerID: user.Id, Page: 1, PageSize: 20})
						require.NoError(t, err)
						require.Equal(t, int64(1), total)
						assert.Equal(t, "subscription", orders[0].OrderType)
						assert.Equal(t, "sub-tx-"+provider+suffix, orders[0].ProviderTradeNo)
					})
				}
			}
			t.Run("unified orders include all subscription states without duplicate history", func(t *testing.T) {
				owner := model.User{Username: "unified-orders", AffCode: "unified-orders", AuthVersion: 1}
				require.NoError(t, db.Create(&owner).Error)
				for _, status := range []string{"pending", "success", "expired", "failed"} {
					sub := model.SubscriptionOrder{UserId: owner.Id, TradeNo: "SUB-" + status, PaymentProvider: model.PaymentProviderStripe, Status: status, Money: 12}
					require.NoError(t, db.Create(&sub).Error)
					if status == "success" {
						require.NoError(t, db.Create(&model.TopUp{UserId: owner.Id, TradeNo: sub.TradeNo, PaymentProvider: sub.PaymentProvider, Status: status}).Error)
					}
				}
				for _, tc := range []struct{ currency, minor, expected string }{
					{"USD", "1050", "10.5"}, {"JPY", "1050", "1050"}, {"KWD", "1050", "1.05"},
				} {
					payment := model.TopUp{UserId: owner.Id, TradeNo: "stripe-" + tc.currency, PaymentProvider: model.PaymentProviderStripe, Status: "success"}
					require.NoError(t, db.Create(&payment).Error)
					event := stripe.Event{Data: &stripe.EventData{Object: map[string]any{"currency": tc.currency, "amount_total": tc.minor, "payment_intent": "pi_" + tc.currency}}}
					require.NoError(t, recordStripeReceipt(event, payment.TradeNo, false))
					require.NoError(t, db.First(&payment, payment.Id).Error)
					assert.Equal(t, tc.expected, payment.PaymentReceipt.ReceiptAmount)
					require.NoError(t, db.Delete(&payment).Error)
				}
				paid := model.TopUp{UserId: owner.Id, TradeNo: "receipt-stripe", PaymentProvider: model.PaymentProviderStripe, Status: "success"}
				require.NoError(t, db.Create(&paid).Error)
				require.NoError(t, model.RecordPaymentReceipt(paid.TradeNo, paid.PaymentProvider, "pi_verified", "usd", "10.50", false))
				require.NoError(t, model.RecordPaymentReceipt(paid.TradeNo, paid.PaymentProvider, "pi_verified", "USD", "10.5", false))
				require.Error(t, model.RecordPaymentReceipt(paid.TradeNo, model.PaymentProviderCreem, "other", "USD", "10.5", false))
				require.Error(t, model.RecordPaymentReceipt(paid.TradeNo, paid.PaymentProvider, "pi_changed", "USD", "10.5", false))
				receiptOrders, count, err := model.ListSiteOrders(model.SiteOrderFilter{OwnerID: owner.Id, Keyword: "pi_verified", Page: 1, PageSize: 20})
				require.NoError(t, err)
				require.EqualValues(t, 1, count)
				require.Len(t, receiptOrders, 1)
				assert.Equal(t, "USD", receiptOrders[0].Currency)
				assert.Equal(t, "10.5", receiptOrders[0].PaymentAmount)
				require.Error(t, model.RecordPaymentReceipt(paid.TradeNo, paid.PaymentProvider, "pi_verified", "USD", "1e999999", false))
				unpaid := model.TopUp{UserId: owner.Id, TradeNo: "receipt-pending", PaymentProvider: model.PaymentProviderStripe, Status: "pending"}
				require.NoError(t, db.Create(&unpaid).Error)
				require.Error(t, model.RecordPaymentReceipt(unpaid.TradeNo, unpaid.PaymentProvider, "pi_unpaid", "USD", "1", false))
				require.NoError(t, db.Delete(&unpaid).Error)
				require.NoError(t, db.Delete(&paid).Error)
				balance := model.SubscriptionOrder{UserId: owner.Id, TradeNo: "SUB-balance", PaymentProvider: model.PaymentProviderBalance, Status: "success", Money: 5}
				require.NoError(t, db.Create(&balance).Error)
				items, total, err := model.ListSiteOrders(model.SiteOrderFilter{OwnerID: owner.Id, Page: 1, PageSize: 20})
				require.NoError(t, err)
				assert.EqualValues(t, 5, total)
				require.Len(t, items, 5)
				for _, item := range items {
					assert.Equal(t, "subscription", item.OrderType)
					assert.Negative(t, item.Id)
				}
				_, total, err = model.ListSiteOrders(model.SiteOrderFilter{OwnerID: owner.Id, Status: "failed", Page: 1, PageSize: 20})
				require.NoError(t, err)
				assert.EqualValues(t, 1, total)
				for _, viewer := range []int{owner.Id, localUser.Id} {
					rec := httptest.NewRecorder()
					ctx, _ := gin.CreateTestContext(rec)
					ctx.Set("id", viewer)
					ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(-balance.Id)}}
					ctx.Request = httptest.NewRequest(http.MethodGet, "/api/user/self/orders/"+strconv.Itoa(-balance.Id), nil)
					GetPersonalOrder(ctx)
					if viewer == owner.Id {
						assert.Equal(t, http.StatusOK, rec.Code)
						assert.Contains(t, rec.Body.String(), "SUB-balance")
					} else {
						assert.Equal(t, http.StatusNotFound, rec.Code)
					}
				}
			})

			// Personal list/detail scope cannot be widened by user-controlled IDs.
			stranger := model.User{Username: "other-order-owner", AffCode: "other-owner", AuthVersion: 1}
			require.NoError(t, db.Create(&stranger).Error)
			strangerOrder := model.TopUp{UserId: stranger.Id, TradeNo: "PRIVATE_ORDER", Status: common.TopUpStatusSuccess}
			require.NoError(t, db.Create(&strangerOrder).Error)
			for _, tc := range []struct {
				name, query        string
				viewer, id, status int
				total              int64
			}{
				{name: "own list ignores forged ownership", query: "?user=" + stranger.Username + "&owner_id=" + strconv.Itoa(stranger.Id), viewer: localUser.Id, status: 200, total: -1},
				{name: "another owner list", viewer: stranger.Id, status: 200, total: 1},
				{name: "foreign order search", query: "?keyword=PRIVATE_ORDER", viewer: localUser.Id, status: 200, total: 0},
				{name: "own detail", viewer: stranger.Id, id: strangerOrder.Id, status: 200, total: -1},
				{name: "foreign detail", viewer: localUser.Id, id: strangerOrder.Id, status: 404},
				{name: "missing detail", viewer: localUser.Id, id: strangerOrder.Id + 10000, status: 404},
				{name: "anonymous list", status: 401},
				{name: "anonymous detail", id: strangerOrder.Id, status: 401},
			} {
				t.Run(tc.name, func(t *testing.T) {
					rec := httptest.NewRecorder()
					ctx, _ := gin.CreateTestContext(rec)
					ctx.Set("id", tc.viewer)
					ctx.Set("role", common.RoleCommonUser)
					ctx.Request = httptest.NewRequest(http.MethodGet, "/api/user/self/orders"+tc.query, nil)
					if tc.id > 0 {
						ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(tc.id)}}
						GetPersonalOrder(ctx)
					} else {
						GetPersonalOrders(ctx)
					}
					require.Equal(t, tc.status, rec.Code)
					if tc.status != 200 {
						return
					}
					var response struct {
						Success bool `json:"success"`
						Data    struct {
							Total int64 `json:"total"`
						} `json:"data"`
					}
					require.NoError(t, common.Unmarshal(rec.Body.Bytes(), &response))
					require.True(t, response.Success)
					if tc.id == 0 && tc.total >= 0 {
						assert.Equal(t, tc.total, response.Data.Total)
					}
					if tc.viewer == localUser.Id {
						assert.NotContains(t, rec.Body.String(), "PRIVATE_ORDER")
					}
					for _, field := range []string{"last_error", "last_check_at", "cache_pending", "user_id", "private_key"} {
						assert.NotContains(t, rec.Body.String(), `"`+field+`"`)
					}
				})
			}

			// Administrative projection preserves verified payment state and frozen amounts.
			rows, total, err := model.ListSiteOrders(model.SiteOrderFilter{Keyword: "420000000002", Status: "paid", Provider: "wechatpay", User: localUser.Username, Page: 1, PageSize: 20})
			require.NoError(t, err)
			require.EqualValues(t, 1, total)
			require.Len(t, rows, 1)
			assert.Equal(t, "paid", rows[0].OrderStatus)
			require.NotNil(t, rows[0].AmountFen)
			assert.EqualValues(t, 9000, *rows[0].AmountFen)
			detail, err := model.GetSiteOrder(overflowWX.Id)
			require.NoError(t, err)
			assert.Equal(t, "credit_pending", detail.LastError)
			payload, err := common.Marshal(detail)
			require.NoError(t, err)
			assert.NotContains(t, string(payload), "private_key")
			assert.NotContains(t, string(payload), wxConfig.APIv3Key)
			rows, total, err = model.ListSiteOrders(model.SiteOrderFilter{Keyword: "' OR 1=1 --", Page: 1, PageSize: 20})
			require.NoError(t, err)
			assert.Zero(t, total)
			assert.Empty(t, rows)
			rows, total, err = model.ListSiteOrders(model.SiteOrderFilter{Page: 2, PageSize: 1})
			require.NoError(t, err)
			require.Len(t, rows, 1)
			assert.Greater(t, total, int64(1))
			for _, role := range []int{common.RoleCommonUser, common.RoleAdminUser} {
				recorder := httptest.NewRecorder()
				ctx, _ := gin.CreateTestContext(recorder)
				ctx.Set("role", role)
				ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(wxTopup.Id)}}
				RecheckSiteOrder(ctx)
				assert.Equal(t, http.StatusForbidden, recorder.Code)
			}
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodPost, "/api/user/orders/1/recheck", nil)
			ctx.Set("role", common.RoleRootUser)
			ctx.Set("id", user.Id)
			ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(wxTopup.Id)}}
			RecheckSiteOrder(ctx)
			assert.Contains(t, recorder.Body.String(), `"success":true`)
			detail, err = model.GetSiteOrder(wxTopup.Id)
			require.NoError(t, err)
			require.NotNil(t, detail.LastCheckSuccess)
			assert.True(t, *detail.LastCheckSuccess)
			assert.Positive(t, detail.LastCheckAt)

			denied := httptest.NewRecorder()
			tokenCtx, _ := gin.CreateTestContext(denied)
			tokenCtx.Set("role", common.RoleRootUser)
			tokenCtx.Set("use_access_token", true)
			RecheckSiteOrder(tokenCtx)
			assert.Equal(t, http.StatusForbidden, denied.Code)
			denied = httptest.NewRecorder()
			userCtx, _ := gin.CreateTestContext(denied)
			userCtx.Set("role", common.RoleCommonUser)
			GetSiteOrders(userCtx)
			assert.Equal(t, http.StatusForbidden, denied.Code)
			denied = httptest.NewRecorder()
			userCtx, _ = gin.CreateTestContext(denied)
			GetSiteOrder(userCtx)
			assert.Equal(t, http.StatusForbidden, denied.Code)
			failureRecorder := httptest.NewRecorder()
			failureCtx, _ := gin.CreateTestContext(failureRecorder)
			failureCtx.Request = httptest.NewRequest(http.MethodPost, "/api/user/orders/1/recheck", nil)
			failureCtx.Set("id", user.Id)
			failureCtx.Set("role", common.RoleRootUser)
			failureCtx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(overflowWX.Id)}}
			RecheckSiteOrder(failureCtx)
			assert.Contains(t, failureRecorder.Body.String(), `"success":false`)
			detail, err = model.GetSiteOrder(overflowWX.Id)
			require.NoError(t, err)
			require.NotNil(t, detail.LastCheckSuccess)
			assert.False(t, *detail.LastCheckSuccess)
			assert.Equal(t, "paid", detail.OrderStatus)

			for _, query := range []string{"p=-1", "page_size=101", "start=20&end=10", "status=invalid"} {
				recorder := httptest.NewRecorder()
				ctx, _ := gin.CreateTestContext(recorder)
				ctx.Request = httptest.NewRequest(http.MethodGet, "/api/user/orders?"+query, nil)
				ctx.Set("role", common.RoleAdminUser)
				GetSiteOrders(ctx)
				assert.Equal(t, http.StatusBadRequest, recorder.Code)
			}

			recoveryTopup := model.TopUp{UserId: localUser.Id, TradeNo: "WXrecovery", PaymentProvider: model.PaymentProviderWechatPay, Status: common.TopUpStatusPending}
			recoveryOrder := model.WechatPayOrder{TradeNo: recoveryTopup.TradeNo, ConfigID: wxConfig.ID, UserID: localUser.Id, AmountFen: 100, CreditedQuota: 100, Status: common.TopUpStatusPending}
			require.NoError(t, model.CreateWechatPayOrder(&recoveryTopup, &recoveryOrder))
			require.NoError(t, model.RecordWechatPayPayment(recoveryOrder.TradeNo, "recovery-provider", 100))

			for _, tc := range []struct {
				name, reason, result string
				id, role             int
			}{
				{"credit verified payment", "Retry missing callback", "credited", recoveryTopup.Id, common.RoleRootUser},
				{"retry same recovery", "Retry missing callback", "already_credited", recoveryTopup.Id, common.RoleRootUser},
				{"already credited", "Retry missing callback", "already_credited", wxTopup.Id, common.RoleRootUser},
				{"wallet capacity", "Retry failed credit", "credit_pending", overflowWX.Id, common.RoleRootUser},
				{"blank reason", "   ", "", wxTopup.Id, common.RoleRootUser},
				{"admin denied", "Retry missing callback", "", wxTopup.Id, common.RoleAdminUser},
			} {
				t.Run(tc.name, func(t *testing.T) {
					body, marshalErr := common.Marshal(map[string]string{"reason": tc.reason})
					require.NoError(t, marshalErr)
					rec := httptest.NewRecorder()
					ctx, _ := gin.CreateTestContext(rec)
					ctx.Request = httptest.NewRequest(http.MethodPost, "/api/user/orders/1/recover", strings.NewReader(string(body)))
					ctx.Request.Header.Set("Content-Type", "application/json")
					ctx.Set("role", tc.role)
					ctx.Set("id", user.Id)
					ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(tc.id)}}
					RecoverSiteOrder(ctx)
					if tc.role != common.RoleRootUser {
						assert.Equal(t, 403, rec.Code)
						return
					}
					if tc.result == "" {
						assert.Contains(t, rec.Body.String(), `"success":false`)
						return
					}
					assert.Contains(t, rec.Body.String(), `"result":"`+tc.result+`"`)
					var audit model.AuditLog
					require.NoError(t, db.Table("audit_logs").Where("action = ?", "payment.order.recover").Order("id DESC").First(&audit).Error)
					encoded, e := common.Marshal(audit.Other.Op.Params)
					require.NoError(t, e)
					var saved struct {
						Reason string `json:"reason"`
						Result string `json:"result"`
					}
					require.NoError(t, common.Unmarshal(encoded, &saved))
					assert.Equal(t, tc.reason, saved.Reason)
					assert.Equal(t, tc.result, saved.Result)
				})
			}

			require.NoError(t, db.First(&localUser, localUser.Id).Error)
			assert.Equal(t, 14285814, localUser.Quota)

			t.Run("pending order lifecycle", func(t *testing.T) {
				transport := http.DefaultTransport
				t.Cleanup(func() { http.DefaultTransport = transport })
				for _, provider := range []string{model.PaymentProviderAlipay, model.PaymentProviderWechatPay} {
					t.Run(provider, func(t *testing.T) {
						trade := "lifecycle-" + provider
						expires := common.GetTimestamp() + 300
						topup := model.TopUp{UserId: user.Id, TradeNo: trade, Status: "pending", PaymentProvider: provider}
						var target any
						if provider == model.PaymentProviderAlipay {
							target = &model.AlipayOrder{TradeNo: trade, UserID: user.Id, ConfigID: cfg.ID, AmountFen: 123, Status: "pending", ExpiresAt: expires}
						} else {
							target = &model.WechatPayOrder{TradeNo: trade, UserID: user.Id, ConfigID: wxConfig.ID, AmountFen: 123, Status: "pending", ExpiresAt: expires, CheckoutURL: "weixin://wxpay/bizpayurl?pr=original"}
						}
						require.NoError(t, db.Create(&topup).Error)
						require.NoError(t, db.Create(target).Error)
						for range 2 {
							checkout, err := service.ResumeDirectOrder(context.Background(), user.Id, trade, provider, false)
							require.NoError(t, err)
							assert.Equal(t, "1.23", checkout.Amount)
							assert.Equal(t, expires, checkout.ExpiresAt)
							if provider == model.PaymentProviderAlipay {
								link, err := url.Parse(checkout.PayLink)
								require.NoError(t, err)
								var content map[string]any
								require.NoError(t, common.UnmarshalJsonStr(link.Query().Get("biz_content"), &content))
								assert.Equal(t, "1.23", content["total_amount"])
								assert.Equal(t, trade, content["out_trade_no"])
								assert.Equal(t, time.Unix(expires, 0).In(time.FixedZone("CST", 8*3600)).Format("2006-01-02 15:04:05"), content["time_expire"])
							} else {
								assert.Equal(t, "weixin://wxpay/bizpayurl?pr=original", checkout.CodeURL)
							}
						}
						_, err := service.ResumeDirectOrder(context.Background(), user.Id+1000, trade, provider, false)
						require.ErrorIs(t, err, gorm.ErrRecordNotFound)
						for _, action := range []string{"pay", "cancel"} {
							rec := httptest.NewRecorder()
							ctx, _ := gin.CreateTestContext(rec)
							ctx.Request = httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{}`))
							ctx.Request.Header.Set("Content-Type", "application/json")
							ctx.Set("id", user.Id+1000)
							ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(topup.Id)}, {Key: "action", Value: action}}
							PersonalOrderPayment(ctx)
							assert.Equal(t, 404, rec.Code)
						}
						// A provider outage accepts a durable cancellation, but must not delete.
						http.DefaultTransport = wechatFixtureTransport(func(req *http.Request) (*http.Response, error) { return nil, errors.New("offline") })
						status, err := service.RequestDirectOrderCancellation(context.Background(), user.Id, trade, provider)
						require.NoError(t, err)
						assert.Equal(t, "closing", status)
						_, err = service.ResumeDirectOrder(context.Background(), user.Id, trade, provider, false)
						require.Error(t, err)
						var lifecycle struct {
							Status          string
							CancelRequested bool
							model.DirectPaymentLifecycle
							NextCheckAt int64
						}
						require.NoError(t, db.Model(target).Where("trade_no = ?", trade).First(&lifecycle).Error)
						assert.True(t, lifecycle.CancelRequested)
						assert.Positive(t, lifecycle.CloseRequestedAt)
						assert.Equal(t, 1, lifecycle.RetryCount)
						firstRetry := lifecycle.NextCheckAt
						require.NoError(t, model.RecordDirectOrderCheck(trade, provider, errors.New("offline")))
						require.NoError(t, db.Model(target).Where("trade_no = ?", trade).First(&lifecycle).Error)
						assert.Equal(t, 2, lifecycle.RetryCount)
						assert.Greater(t, lifecycle.NextCheckAt, firstRetry)
						require.NoError(t, model.ConfirmDirectOrderClosed(trade, provider))
						require.NoError(t, model.ConfirmDirectOrderClosed(trade, provider))
						require.NoError(t, db.First(&topup, topup.Id).Error)
						assert.Equal(t, "expired", topup.Status)
						hidden, total, err := model.ListSiteOrders(model.SiteOrderFilter{OwnerID: user.Id, ID: topup.Id, ExcludeClosed: true, Page: 1, PageSize: 20})
						require.NoError(t, err)
						assert.Empty(t, hidden)
						assert.Zero(t, total)
						history, total, err := model.ListSiteOrders(model.SiteOrderFilter{OwnerID: user.Id, ID: topup.Id, Status: "expired", Page: 1, PageSize: 20})
						require.NoError(t, err)
						require.Len(t, history, 1)
						assert.EqualValues(t, 1, total)
						assert.Positive(t, history[0].ClosedAt)
						// The newest cancelled order must not mask an older payable one.
						olderTrade := "older-" + provider
						older := model.TopUp{UserId: user.Id, TradeNo: olderTrade, PaymentProvider: provider, Status: "pending", CreateTime: 1}
						require.NoError(t, db.Create(&older).Error)
						if provider == model.PaymentProviderAlipay {
							require.NoError(t, db.Create(&model.AlipayOrder{TradeNo: olderTrade, UserID: user.Id, Status: "pending", ExpiresAt: expires}).Error)
						} else {
							require.NoError(t, db.Create(&model.WechatPayOrder{TradeNo: olderTrade, UserID: user.Id, Status: "pending", ExpiresAt: expires}).Error)
						}
						actionable, _, err := model.ListSiteOrders(model.SiteOrderFilter{OwnerID: user.Id, Provider: provider, Actionable: true, Page: 1, PageSize: 1})
						require.NoError(t, err)
						require.Len(t, actionable, 1)
						assert.Equal(t, olderTrade, actionable[0].TradeNo)

						// Retained evidence permits late success, but never duplicate credit.
						require.NoError(t, db.Model(target).Where("trade_no = ?", trade).Update("credited_quota", 123).Error)
						var before model.User
						require.NoError(t, db.First(&before, user.Id).Error)
						for range 2 {
							if provider == model.PaymentProviderAlipay {
								require.NoError(t, model.RecordAlipayPayment(trade, "late-"+trade, 123))
								require.NoError(t, model.CompleteAlipayTopUp(trade))
							} else {
								require.NoError(t, model.RecordWechatPayPayment(trade, "late-"+trade, 123))
								require.NoError(t, model.CompleteWechatPayTopUp(trade))
							}
						}
						var after model.User
						require.NoError(t, db.First(&after, user.Id).Error)
						assert.Equal(t, before.Quota+123, after.Quota)
						require.NoError(t, db.Model(target).Where("trade_no = ?", trade).First(&lifecycle).Error)
						assert.Positive(t, lifecycle.ClosedAt)
						assert.Equal(t, "success", lifecycle.Status)

					})
				}
			})

			t.Run("verified gateway closure and payment race", func(t *testing.T) {
				transport := http.DefaultTransport
				t.Cleanup(func() { http.DefaultTransport = transport })
				for _, provider := range []string{model.PaymentProviderAlipay, model.PaymentProviderWechatPay} {
					for _, scenario := range []string{"timeout", "cancel", "paid", "not-found-before-expiry", "not-found-after-expiry", "subscription", "refunded"} {
						t.Run(provider+"/"+scenario, func(t *testing.T) {
							trade := "gate-" + provider + "-" + scenario
							if scenario == "subscription" {
								if provider == model.PaymentProviderAlipay {
									trade = "SUBALI" + trade
								} else {
									trade = "SUBWX" + trade
								}
							}
							expires := common.GetTimestamp() + 300
							if scenario == "timeout" || scenario == "not-found-after-expiry" {
								expires = common.GetTimestamp() - 60
							}
							var target any
							if provider == model.PaymentProviderAlipay {
								target = &model.AlipayOrder{TradeNo: trade, UserID: user.Id, ConfigID: cfg.ID, AmountFen: 100, CreditedQuota: 100, Status: "pending", ExpiresAt: expires}
							} else {
								target = &model.WechatPayOrder{TradeNo: trade, UserID: user.Id, ConfigID: wxConfig.ID, AmountFen: 100, CreditedQuota: 100, Status: "pending", ExpiresAt: expires}
							}
							var business any = &model.TopUp{UserId: user.Id, TradeNo: trade, Status: "pending", PaymentProvider: provider}
							if scenario == "subscription" {
								business = &model.SubscriptionOrder{UserId: user.Id, TradeNo: trade, Status: "pending", PaymentProvider: provider}
							}
							require.NoError(t, db.Create(business).Error)
							require.NoError(t, db.Create(target).Error)
							closed := false
							http.DefaultTransport = wechatFixtureTransport(func(req *http.Request) (*http.Response, error) {
								statusCode := 200
								header := http.Header{}
								var body []byte
								if provider == model.PaymentProviderAlipay {
									require.NoError(t, req.ParseForm())
									method := req.Form.Get("method")
									payload := map[string]any{"code": "10000", "msg": "Success", "out_trade_no": trade, "trade_no": "tx-" + trade, "total_amount": "1.00", "trade_status": "WAIT_BUYER_PAY"}
									if method == "alipay.trade.close" {
										closed = true
									}
									if scenario == "paid" {
										payload["trade_status"] = "TRADE_SUCCESS"
									}
									if scenario == "refunded" {
										payload["trade_status"] = "TRADE_CLOSED"
										payload["send_pay_date"] = "2026-10-11 12:00:00"
									}
									if strings.HasPrefix(scenario, "not-found") {
										payload["code"] = "40004"
										payload["sub_code"] = "ACQ.TRADE_NOT_EXIST"
									}
									data, err := common.Marshal(payload)
									require.NoError(t, err)
									digest := sha256.Sum256(data)
									sig, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, digest[:])
									require.NoError(t, err)
									body = []byte(fmt.Sprintf(`{"%s_response":%s,"sign":"%s"}`, strings.ReplaceAll(method, ".", "_"), data, base64.StdEncoding.EncodeToString(sig)))
								} else {
									if strings.HasSuffix(req.URL.Path, "/close") {
										closed = true
										statusCode = 204
										body = []byte{}
									} else {
										state := "NOTPAY"
										if scenario == "paid" {
											state = "SUCCESS"
										}
										if scenario == "refunded" {
											state = "REFUND"
										}
										payload := map[string]any{"appid": wxConfig.AppID, "mchid": wxConfig.MchID, "out_trade_no": trade, "transaction_id": "tx-" + trade, "trade_state": state, "trade_type": "NATIVE", "amount": map[string]any{"total": 100, "currency": "CNY"}}
										if strings.HasPrefix(scenario, "not-found") {
											statusCode = 404
											payload = map[string]any{"code": "ORDER_NOT_EXIST", "message": "missing"}
										}
										var err error
										body, err = common.Marshal(payload)
										require.NoError(t, err)
									}
									timestamp := strconv.FormatInt(time.Now().Unix(), 10)
									digest := sha256.Sum256([]byte(timestamp + "\nnonce\n" + string(body) + "\n"))
									sig, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, digest[:])
									require.NoError(t, err)
									header.Set("Wechatpay-Serial", wxConfig.PublicKeyID)
									header.Set("Wechatpay-Timestamp", timestamp)
									header.Set("Wechatpay-Nonce", "nonce")
									header.Set("Wechatpay-Signature", base64.StdEncoding.EncodeToString(sig))
								}
								return &http.Response{StatusCode: statusCode, Header: header, Body: io.NopCloser(bytes.NewReader(body)), Request: req}, nil
							})
							if scenario == "timeout" || scenario == "not-found-after-expiry" {
								var err error
								if provider == model.PaymentProviderAlipay {
									err = service.ReconcileAlipayOrder(context.Background(), trade)
								} else {
									err = service.ReconcileWechatPayOrder(context.Background(), trade)
								}
								require.NoError(t, err)
							} else {
								status, err := service.RequestDirectOrderCancellation(context.Background(), user.Id, trade, provider)
								require.NoError(t, err)
								expected := "closed"
								if scenario == "paid" {
									expected = "paid"
								}
								if scenario == "not-found-before-expiry" || scenario == "refunded" {
									expected = "closing"
								}
								assert.Equal(t, expected, status)
							}
							var count int64
							require.NoError(t, db.Model(target).Where("trade_no = ?", trade).Count(&count).Error)
							if scenario == "paid" || scenario == "not-found-before-expiry" || scenario == "refunded" {
								assert.EqualValues(t, 1, count)
								assert.False(t, closed)
								if scenario == "not-found-before-expiry" {
									var waiting struct {
										LastError string
										model.DirectPaymentLifecycle
									}
									require.NoError(t, db.Model(target).Where("trade_no = ?", trade).First(&waiting).Error)
									assert.Empty(t, waiting.LastError)
									assert.Zero(t, waiting.RetryCount)
									assert.Equal(t, "NOT_FOUND", waiting.GatewayStatus)
								}
								if scenario == "refunded" {
									var retained struct{ model.DirectPaymentLifecycle }
									require.NoError(t, db.Model(target).Where("trade_no = ?", trade).First(&retained).Error)
									assert.True(t, retained.ReviewRequired)
									if provider == model.PaymentProviderAlipay {
										require.NoError(t, model.RecordAlipayPayment(trade, "tx-"+trade, 100))
										require.ErrorIs(t, model.CompleteAlipayTopUp(trade), model.ErrPaymentReviewRequired)
									} else {
										require.NoError(t, model.RecordWechatPayPayment(trade, "tx-"+trade, 100))
										require.ErrorIs(t, model.CompleteWechatPayTopUp(trade), model.ErrPaymentReviewRequired)
									}
								}
							} else {
								assert.EqualValues(t, 1, count)
								require.NoError(t, db.Model(business).Where("trade_no = ?", trade).Count(&count).Error)
								assert.EqualValues(t, 1, count)
								var retained struct {
									Status string
									model.DirectPaymentLifecycle
								}
								require.NoError(t, db.Model(target).Where("trade_no = ?", trade).First(&retained).Error)
								assert.Equal(t, "expired", retained.Status)
								assert.Positive(t, retained.ClosedAt)
								assert.Equal(t, scenario != "not-found-after-expiry", closed)
							}
						})
					}
				}
			})

			configJSON, err := common.Marshal(wxConfig)
			require.NoError(t, err)
			assert.NotContains(t, string(configJSON), wxConfig.APIv3Key)
			assert.NotContains(t, string(configJSON), "PRIVATE KEY")
			// Also exercise clean installs and repeated startup migration.
			require.NoError(t, db.Migrator().DropTable(tables...))
			require.NoError(t, db.AutoMigrate(tables...))
			require.NoError(t, db.AutoMigrate(tables...))

		})
	}
}

func TestAlipayAmountValidation(t *testing.T) {
	for _, s := range []string{"0", "-1", "NaN", "1e8", "0.001", "100000000.01", "99999999999999"} {
		_, err := service.AlipayAmountFen(s)
		assert.Error(t, err, s)
	}
	fen, err := service.AlipayAmountFen("7.01")
	require.NoError(t, err)
	assert.EqualValues(t, 701, fen)
}

func TestAlipaySiteCurrencyQuote(t *testing.T) {
	general := operation_setting.GetGeneralSetting()
	payment := operation_setting.GetPaymentSetting()
	oldGeneral, oldPayment := *general, *payment
	oldRate, oldPrice, oldQuota := operation_setting.USDExchangeRate, operation_setting.Price, common.QuotaPerUnit
	t.Cleanup(func() {
		*general = oldGeneral
		*payment = oldPayment
		operation_setting.USDExchangeRate = oldRate
		operation_setting.Price = oldPrice
		common.QuotaPerUnit = oldQuota
	})
	operation_setting.USDExchangeRate = 7
	operation_setting.Price = 7
	common.QuotaPerUnit = 500000
	payment.AmountDiscount = map[int]float64{100: 0.9}
	config := &model.AlipayConfig{UnitPrice: "1", MinTopUp: 1}
	for _, tc := range []struct {
		name, mode  string
		amount, fen int64
		quota       int
	}{
		{"CNY discounted", "CNY", 100, 9000, 7142857},
		{"CNY small recharge", "CNY", 1, 100, 71429},
		{"USD discounted", "USD", 100, 63000, 50000000},
		{"custom currency", "CUSTOM", 100, 4500, 3571429},
	} {
		t.Run(tc.name, func(t *testing.T) {
			general.QuotaDisplayType = tc.mode
			general.CustomCurrencyExchangeRate = 14
			fen, quota, err := service.QuoteAlipay(config, tc.amount, "alipay-test")
			require.NoError(t, err)
			assert.Equal(t, tc.fen, fen)
			assert.Equal(t, tc.quota, quota)
		})
	}
	general.QuotaDisplayType = "CNY"
	for _, rate := range []float64{0, -1, math.NaN(), math.Inf(1)} {
		operation_setting.USDExchangeRate = rate
		_, _, err := service.QuoteAlipay(config, 100, "alipay-test")
		require.Error(t, err)
	}
}

// wechatNotifyFixture constructs authentic RSA/AES-GCM notification bytes for the SDK boundary.
func wechatNotifyFixture(t *testing.T, key *rsa.PrivateKey, config model.WechatPayConfig, tx *payments.Transaction, timestamp int64) *http.Request {
	t.Helper()
	plain, err := common.Marshal(tx)
	require.NoError(t, err)
	block, err := aes.NewCipher([]byte(config.APIv3Key))
	require.NoError(t, err)
	gcm, err := cipher.NewGCM(block)
	require.NoError(t, err)
	nonce := "nonce1234567"
	encrypted := gcm.Seal(nil, []byte(nonce), plain, []byte("transaction"))
	body, err := common.Marshal(map[string]any{"id": "notification-1", "event_type": "TRANSACTION.SUCCESS", "resource_type": "encrypt-resource", "resource": map[string]string{"algorithm": "AEAD_AES_256_GCM", "nonce": nonce, "associated_data": "transaction", "ciphertext": base64.StdEncoding.EncodeToString(encrypted)}})
	require.NoError(t, err)
	message := fmt.Sprintf("%d\nrequest-nonce\n%s\n", timestamp, body)
	hash := sha256.Sum256([]byte(message))
	signature, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, hash[:])
	require.NoError(t, err)
	req := httptest.NewRequest("POST", "/api/user/wechatpay/notify/1", strings.NewReader(string(body)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Wechatpay-Serial", config.PublicKeyID)
	req.Header.Set("Wechatpay-Timestamp", strconv.FormatInt(timestamp, 10))
	req.Header.Set("Wechatpay-Nonce", "request-nonce")
	req.Header.Set("Wechatpay-Signature", base64.StdEncoding.EncodeToString(signature))
	return req
}

// wechatFixtureTransport replaces only the external HTTP boundary.
type wechatFixtureTransport func(*http.Request) (*http.Response, error)

func (f wechatFixtureTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
