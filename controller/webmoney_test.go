package controller

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/xml"
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

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/paymentsecret"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"gorm.io/gorm/schema"
)

type webMoneyQueryTransport func(*http.Request) (*http.Response, error)

func (f webMoneyQueryTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestWebMoneyDatabaseMatrix(t *testing.T) {
	key := filepath.Join(t.TempDir(), "key.json")
	require.NoError(t, paymentsecret.GenerateFile(key))
	t.Setenv("PAYMENT_SECRET_KEY_FILE", key)
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			var driver gorm.Dialector
			switch dialect {
			case "sqlite":
				driver = sqlite.Open(filepath.Join(t.TempDir(), "webmoney.db"))
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
			db, err := gorm.Open(driver, &gorm.Config{Logger: logger.Discard, NamingStrategy: schema.NamingStrategy{TablePrefix: "webmoney_verify_"}})
			require.NoError(t, err)
			sql, err := db.DB()
			require.NoError(t, err)
			sql.SetMaxOpenConns(1)
			oldDB, oldLog, oldType, oldRedis := model.DB, model.LOG_DB, common.MainDatabaseType(), common.RedisEnabled
			model.DB, model.LOG_DB = db, db
			common.SetMainDatabaseType(common.DatabaseType(dialect))
			common.RedisEnabled = false
			legacy := []any{&model.User{}, &model.TopUp{}, &model.SubscriptionOrder{}, &model.AlipayConfig{}, &model.AlipayOrder{}, &model.WechatPayOrder{}, &model.MixPayOrder{}, &model.Log{}}
			added := []any{&model.WebMoneyConfig{}, &model.WebMoneyOrder{}, &model.AntomOrder{}, &model.AntomConfig{}}
			tables := append(legacy, added...)
			t.Cleanup(func() {
				require.NoError(t, db.Migrator().DropTable(tables...))
				require.NoError(t, db.Migrator().DropTable("audit_logs"))
				model.DB, model.LOG_DB = oldDB, oldLog
				common.SetMainDatabaseType(oldType)
				common.RedisEnabled = oldRedis
				require.NoError(t, sql.Close())
			})
			require.NoError(t, db.Table("audit_logs").AutoMigrate(&model.AuditLog{}))
			// Fresh installs and two consecutive startups.
			require.NoError(t, db.AutoMigrate(tables...))
			require.NoError(t, db.AutoMigrate(tables...))
			require.NoError(t, db.Migrator().DropTable(added...))
			before := model.TopUp{TradeNo: "existing-order", Status: "success", Money: 2.5, PaymentProvider: "epay"}
			require.NoError(t, db.Create(&before).Error)
			// Upgrade a representative existing payment schema, preserving its records.
			require.NoError(t, db.AutoMigrate(tables...))
			require.NoError(t, db.AutoMigrate(tables...))
			var after model.TopUp
			require.NoError(t, db.First(&after, before.Id).Error)
			assert.Equal(t, before, after)
			config := model.WebMoneyConfig{Enabled: true, Purse: "T123456789012", Description: "Test", Rate: "1", MinTopUp: 1, Secret: "webmoney-test-secret-12345", NotifyBaseURL: "https://example.com", ReturnURL: "https://example.com/wallet"}
			require.NoError(t, service.ValidateWebMoneyConfig(&config))
			require.NoError(t, db.Create(&config).Error)
			assert.NotContains(t, config.Ciphertext, config.Secret)
			current, err := model.CurrentWebMoneyConfig()
			require.NoError(t, err)
			assert.Equal(t, config.Secret, current.Secret)
			serialized, err := common.Marshal(current)
			require.NoError(t, err)
			assert.NotContains(t, string(serialized), config.Secret)
			assert.NotContains(t, string(serialized), "ciphertext")
			require.Error(t, db.Model(&config).Update("purse", "T999999999999").Error)
			user := model.User{Username: "wm-buyer", Status: common.UserStatusEnabled, Quota: 100}
			require.NoError(t, db.Create(&user).Error)
			o := model.WebMoneyOrder{TradeNo: "WMtest", UserID: user.Id, RequestKey: "request-1", RequestedAmount: 10, ConfigID: config.ID, Amount: "10.00", CreditedQuota: 50, Status: "pending", CreatedAt: common.GetTimestamp(), ExpiresAt: common.GetTimestamp() + 1800}
			top := model.TopUp{UserId: user.Id, TradeNo: o.TradeNo, PaymentProvider: "webmoney", PaymentMethod: "webmoney", Status: "pending", Money: 10}
			require.NoError(t, model.CreateWebMoneyOrder(&o, &top))
			duplicate := o
			duplicate.ID = 0
			duplicate.TradeNo = "WMduplicate"
			assert.Error(t, db.Create(&duplicate).Error)
			checkout := service.WebMoneyCheckout(&o, &config)
			assert.Equal(t, "WMT", checkout["currency"])
			assert.Equal(t, strconv.FormatInt(o.ID, 10), checkout["pay_params"].(map[string]string)["LMI_PAYMENT_NO"])
			router := gin.New()
			router.POST("/notify", WebMoneyNotify)
			v := url.Values{"LMI_PAYEE_PURSE": {config.Purse}, "LMI_PAYMENT_NO": {strconv.FormatInt(o.ID, 10)}, "LMI_PAYMENT_AMOUNT": {"10.00"}, "LMI_MODE": {"0"}, "LMI_SYS_INVS_NO": {"100"}, "LMI_SYS_TRANS_NO": {"200"}, "LMI_SYS_TRANS_DATE": {"20261014 23:00:00"}, "LMI_PAYER_PURSE": {"T987654321012"}, "LMI_PAYER_WM": {"123456789012"}}
			signature := sha256.Sum256([]byte(strings.Join([]string{config.Purse, "10.00", strconv.FormatInt(o.ID, 10), "0", "100", "200", "20261014 23:00:00", config.Secret, "T987654321012", "123456789012"}, ";")))
			v.Set("LMI_HASH2", hex.EncodeToString(signature[:]))
			send := func(values url.Values) int {
				req := httptest.NewRequest("POST", "/notify", strings.NewReader(values.Encode()))
				req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
				w := httptest.NewRecorder()
				router.ServeHTTP(w, req)
				return w.Code
			}
			pre := url.Values{"LMI_PAYEE_PURSE": {config.Purse}, "LMI_PAYMENT_NO": {strconv.FormatInt(o.ID, 10)}, "LMI_PAYMENT_AMOUNT": {"10.00"}, "LMI_MODE": {"0"}, "LMI_PREREQUEST": {"1"}}
			assert.Equal(t, 200, send(pre))
			for _, tc := range []struct{ field, value string }{{"LMI_MODE", "1"}, {"LMI_PAYMENT_AMOUNT", "9.99"}, {"LMI_PAYEE_PURSE", "T999999999999"}, {"LMI_HASH2", "bad"}, {"LMI_HOLD", "1"}} {
				original := v.Get(tc.field)
				v.Set(tc.field, tc.value)
				assert.Equal(t, 400, send(v))
				if original == "" {
					v.Del(tc.field)
				} else {
					v.Set(tc.field, original)
				}
			}
			v.Add("LMI_PAYMENT_AMOUNT", "10.00")
			assert.Equal(t, 400, send(v))
			v.Set("LMI_PAYMENT_AMOUNT", "10.00")
			var unchanged model.User
			require.NoError(t, db.First(&unchanged, user.Id).Error)
			assert.Equal(t, 100, unchanged.Quota)
			// Paid evidence survives a failed wallet credit and a delayed callback after expiry.
			require.NoError(t, db.Model(&o).Update("expires_at", common.GetTimestamp()-1).Error)
			assert.Equal(t, 400, send(pre))
			require.NoError(t, db.Model(&user).Update("quota", common.MaxWalletQuota).Error)
			assert.Equal(t, 200, send(v))
			paid, _, err := model.GetWebMoneyOrder(o.TradeNo)
			require.NoError(t, err)
			assert.Equal(t, "paid", paid.Status)
			require.NoError(t, db.Model(&user).Update("quota", 100).Error)
			require.NoError(t, model.CompleteWebMoneyOrder(o.TradeNo))
			assert.Equal(t, 200, send(v))
			require.NoError(t, model.CompleteWebMoneyOrder(o.TradeNo))
			var buyer model.User
			require.NoError(t, db.First(&buyer, user.Id).Error)
			assert.Equal(t, 150, buyer.Quota)
			var receipt model.TopUp
			require.NoError(t, db.First(&receipt, top.Id).Error)
			assert.Equal(t, "WMT", receipt.PaymentReceipt.ReceiptCurrency)
			assert.Equal(t, "200", receipt.PaymentReceipt.ReceiptTradeNo)
			orders, total, err := model.ListSiteOrders(model.SiteOrderFilter{OwnerID: user.Id, Page: 1, PageSize: 10})
			require.NoError(t, err)
			assert.EqualValues(t, 1, total)
			require.Len(t, orders, 1)
			assert.Equal(t, "WMT", orders[0].Currency)
			assert.Equal(t, "success", orders[0].OrderStatus)
			// Notification replay cannot be moved to another order or another transaction.
			assert.Error(t, model.RecordWebMoneyPayment(&o, "201"))
			other := o
			other.ID = 0
			other.TradeNo = "WMother"
			other.RequestKey = "request-2"
			other.Status = "pending"
			other.ProviderTradeNo = nil
			otherTop := model.TopUp{UserId: user.Id, TradeNo: other.TradeNo, PaymentProvider: "webmoney", PaymentMethod: "webmoney", Status: "pending"}
			require.NoError(t, model.CreateWebMoneyOrder(&other, &otherTop))
			assert.Error(t, model.RecordWebMoneyPayment(&other, "200"))
			// Upgrade existing orders, preserving them across repeated migrations.
			require.NoError(t, db.Migrator().DropColumn(&model.WebMoneyOrder{}, "GatewayStatus"))
			require.NoError(t, db.AutoMigrate(&model.WebMoneyOrder{}))
			require.NoError(t, db.AutoMigrate(&model.WebMoneyOrder{}))
			// Upgrade from the pre-X18 schema without changing stored secrets.
			require.NoError(t, db.Migrator().DropColumn(&model.WebMoneyConfig{}, "WMID"))
			require.NoError(t, db.AutoMigrate(&model.WebMoneyConfig{}))
			require.NoError(t, db.AutoMigrate(&model.WebMoneyConfig{}))
			historical, err := model.CurrentWebMoneyConfig()
			require.NoError(t, err)
			assert.Equal(t, config.Secret, historical.Secret)
			assert.Empty(t, historical.WMID)
			latest := *historical
			latest.PreviousID, latest.ID, latest.WMID = historical.ID, 0, "123456789012"
			require.NoError(t, db.Create(&latest).Error)
			oldTransport := http.DefaultTransport
			defer func() { http.DefaultTransport = oldTransport }()
			responseBody := ""
			http.DefaultTransport = webMoneyQueryTransport(func(r *http.Request) (*http.Response, error) {
				assert.Equal(t, "https://merchant.webmoney.ru/conf/xml/XMLTransGet.asp", r.URL.String())
				assert.Equal(t, http.MethodPost, r.Method)
				raw, readErr := io.ReadAll(r.Body)
				require.NoError(t, readErr)
				assert.NotContains(t, string(raw), config.Secret)
				var request struct {
					WMID       string `xml:"wmid"`
					Purse      string `xml:"lmi_payee_purse"`
					PaymentNo  string `xml:"lmi_payment_no"`
					NumberType string `xml:"lmi_payment_no_type"`
					Signature  string `xml:"sha256"`
				}
				require.NoError(t, xml.Unmarshal(raw, &request))
				assert.Equal(t, latest.WMID, request.WMID)
				assert.Equal(t, config.Purse, request.Purse)
				assert.Equal(t, strconv.FormatInt(other.ID, 10), request.PaymentNo)
				assert.Equal(t, "1", request.NumberType)
				digest := sha256.Sum256([]byte(latest.WMID + config.Purse + request.PaymentNo + config.Secret))
				assert.Equal(t, hex.EncodeToString(digest[:]), request.Signature)
				return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(responseBody)), Header: make(http.Header)}, nil
			})
			operation := `<operation wmtransid="201" wminvoiceid="101"><amount>10.00</amount><hold_state>0</hold_state></operation>`
			for _, tc := range []struct {
				name, body string
				wantError  bool
			}{
				{"unpaid", "<retval>9</retval>", false},
				{"not found", "<retval>8</retval>", false},
				{"authentication failure", "<retval>-7</retval>", true},
				{"rejected invoice", "<retval>13</retval>", true},
				{"missing result", operation, true},
				{"missing transaction", "<retval>0</retval>", true},
				{"wrong amount", "<retval>0</retval>" + strings.ReplaceAll(operation, "10.00", "9.99"), true},
				{"held", "<retval>0</retval>" + strings.ReplaceAll(operation, "<hold_state>0", "<hold_state>4"), true},
				{"refunded", "<retval>0</retval>" + strings.ReplaceAll(operation, "<hold_state>0", "<hold_state>12"), true},
				{"missing hold state", "<retval>0</retval>" + strings.ReplaceAll(operation, "<hold_state>0</hold_state>", ""), true},
				{"transaction replay", "<retval>0</retval>" + strings.ReplaceAll(operation, `wmtransid="201"`, `wmtransid="200"`), true},
				{"ambiguous result", "<retval>0</retval><retval>9</retval>" + operation, true},
				{"wrong identity", "<retval>0</retval>" + operation + `<errorlog lmi_payee_purse="T999999999999" lmi_payment_no="1"/>`, true},
			} {
				responseBody = "<merchant.response>" + tc.body + "</merchant.response>"
				queryErr := service.ReconcileWebMoneyOrder(context.Background(), other.TradeNo)
				assert.Equal(t, tc.wantError, queryErr != nil, tc.name)
				unchanged, _, err := model.GetWebMoneyOrder(other.TradeNo)
				require.NoError(t, err)
				assert.Equal(t, "pending", unchanged.Status, tc.name)
				expectedStatuses := map[string]string{"unpaid": "x18:9", "not found": "x18:8", "authentication failure": "x18:-7", "rejected invoice": "x18:13", "held": "hold:4", "refunded": "hold:12"}
				if expectedStatus, ok := expectedStatuses[tc.name]; ok {
					assert.Equal(t, expectedStatus, unchanged.GatewayStatus, tc.name)
					projected, _, projectionErr := model.ListSiteOrders(model.SiteOrderFilter{ID: otherTop.Id, Page: 1, PageSize: 1})
					require.NoError(t, projectionErr)
					require.Len(t, projected, 1)
					assert.Equal(t, expectedStatus, projected[0].GatewayStatus)
				}
			}
			responseBody = "<merchant.response><retval>0</retval>" + operation + "</merchant.response>"
			require.NoError(t, service.ReconcileWebMoneyOrder(context.Background(), other.TradeNo))
			require.NoError(t, service.ReconcileWebMoneyOrder(context.Background(), other.TradeNo))
			require.NoError(t, db.First(&buyer, user.Id).Error)
			assert.Equal(t, 200, buyer.Quota)
			// The admin endpoint uses the same verified, idempotent path.
			adminRecorder := httptest.NewRecorder()
			adminContext, _ := gin.CreateTestContext(adminRecorder)
			adminContext.Request = httptest.NewRequest("POST", fmt.Sprintf("/orders/%d/recheck", otherTop.Id), nil)
			adminContext.Params = gin.Params{{Key: "id", Value: strconv.Itoa(otherTop.Id)}}
			adminContext.Set("role", common.RoleRootUser)
			adminContext.Set("id", user.Id)
			RecheckSiteOrder(adminContext)
			assert.Equal(t, 200, adminRecorder.Code)
			assert.Contains(t, adminRecorder.Body.String(), `"success":true`)

			// Configuration endpoints never accept ordinary users or PATs; order reads enforce ownership.
			for _, role := range []int{common.RoleCommonUser, common.RoleAdminUser} {
				w := httptest.NewRecorder()
				c, _ := gin.CreateTestContext(w)
				c.Set("role", role)
				SaveWebMoneyConfig(c)
				assert.Equal(t, 403, w.Code)
			}
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Set("role", common.RoleRootUser)
			c.Set("use_access_token", true)
			SaveWebMoneyConfig(c)
			assert.Equal(t, 403, w.Code)
			w = httptest.NewRecorder()
			c, _ = gin.CreateTestContext(w)
			c.Set("id", user.Id+1)
			c.Params = gin.Params{{Key: "trade_no", Value: o.TradeNo}}
			GetWebMoneyOrderStatus(c)
			assert.Equal(t, 404, w.Code)
		})
	}
}

func TestWebMoneyRateAndQuota(t *testing.T) {
	oldPrice, oldRate, oldQuota := operation_setting.Price, operation_setting.USDExchangeRate, common.QuotaPerUnit
	oldDisplay := operation_setting.GetGeneralSetting().QuotaDisplayType
	oldDiscount := operation_setting.GetPaymentSetting().AmountDiscount
	operation_setting.Price = 7
	operation_setting.USDExchangeRate = 7
	common.QuotaPerUnit = 500000
	operation_setting.GetGeneralSetting().QuotaDisplayType = "USD"
	operation_setting.GetPaymentSetting().AmountDiscount = map[int]float64{}
	t.Cleanup(func() {
		operation_setting.Price = oldPrice
		operation_setting.USDExchangeRate = oldRate
		common.QuotaPerUnit = oldQuota
		operation_setting.GetGeneralSetting().QuotaDisplayType = oldDisplay
		operation_setting.GetPaymentSetting().AmountDiscount = oldDiscount
	})
	for _, tc := range []struct{ rate, expected string }{{"1", "10.00"}, {"1.25", "12.50"}, {"0.8", "8.00"}} {
		value, quota, err := service.QuoteWebMoney(&model.WebMoneyConfig{Rate: tc.rate, MinTopUp: 1}, 10, "webmoney-test")
		require.NoError(t, err)
		assert.Equal(t, tc.expected, value)
		assert.Equal(t, 5000000, quota)
	}
	for _, rate := range []string{"-1", "0", "1e2147483647", "NaN"} {
		_, _, err := service.QuoteWebMoney(&model.WebMoneyConfig{Rate: rate, MinTopUp: 1}, 10, "webmoney-test")
		require.Error(t, err)
	}
	for _, amount := range []int64{-1, 0, common.MaxWalletQuota + 1} {
		_, _, err := service.QuoteWebMoney(&model.WebMoneyConfig{Rate: "1", MinTopUp: 1}, amount, "webmoney-test")
		require.Error(t, err)
	}
}
