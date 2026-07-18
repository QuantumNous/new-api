package controller

import (
	"crypto/md5"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sort"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func epayTestSignString(params map[string]string) string {
	keys := make([]string, 0, len(params))
	for key, value := range params {
		if key == "sign" || key == "sign_type" || value == "" {
			continue
		}
		keys = append(keys, key)
	}
	sort.Strings(keys)

	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		parts = append(parts, key+"="+params[key])
	}
	return strings.Join(parts, "&")
}

type epayPurchaseResponse struct {
	Message string            `json:"message"`
	Data    map[string]string `json:"data"`
	URL     string            `json:"url"`
}

func cloneEpayPayMethods(methods []map[string]string) []map[string]string {
	if methods == nil {
		return nil
	}
	cloned := make([]map[string]string, len(methods))
	for i, method := range methods {
		if method == nil {
			continue
		}
		cloned[i] = make(map[string]string, len(method))
		for key, value := range method {
			cloned[i][key] = value
		}
	}
	return cloned
}

func cloneEpayAmountDiscount(discount map[int]float64) map[int]float64 {
	if discount == nil {
		return nil
	}
	cloned := make(map[int]float64, len(discount))
	for amount, ratio := range discount {
		cloned[amount] = ratio
	}
	return cloned
}

func setupEpayControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	originalDB := model.DB
	originalLogDB := model.LOG_DB
	originalMainDatabaseType := common.MainDatabaseType()
	originalLogDatabaseType := common.LogDatabaseType()
	originalRedisEnabled := common.RedisEnabled
	originalGinMode := gin.Mode()
	originalPayAddress := operation_setting.PayAddress
	originalCallbackAddress := operation_setting.CustomCallbackAddress
	originalEpayID := operation_setting.EpayId
	originalEpayKey := operation_setting.EpayKey
	originalPrice := operation_setting.Price
	originalMinTopUp := operation_setting.MinTopUp
	originalPayMethods := cloneEpayPayMethods(operation_setting.PayMethods)
	originalServerAddress := system_setting.ServerAddress

	paymentSetting := operation_setting.GetPaymentSetting()
	originalPaymentSetting := *paymentSetting
	originalPaymentSetting.AmountOptions = append([]int(nil), paymentSetting.AmountOptions...)
	originalPaymentSetting.AmountDiscount = cloneEpayAmountDiscount(paymentSetting.AmountDiscount)
	generalSetting := operation_setting.GetGeneralSetting()
	originalGeneralSetting := *generalSetting

	var db *gorm.DB
	t.Cleanup(func() {
		if db != nil {
			sqlDB, err := db.DB()
			if err == nil {
				_ = sqlDB.Close()
			}
		}
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		common.SetDatabaseTypes(originalMainDatabaseType, originalLogDatabaseType)
		common.RedisEnabled = originalRedisEnabled
		gin.SetMode(originalGinMode)
		operation_setting.PayAddress = originalPayAddress
		operation_setting.CustomCallbackAddress = originalCallbackAddress
		operation_setting.EpayId = originalEpayID
		operation_setting.EpayKey = originalEpayKey
		operation_setting.Price = originalPrice
		operation_setting.MinTopUp = originalMinTopUp
		operation_setting.PayMethods = cloneEpayPayMethods(originalPayMethods)
		system_setting.ServerAddress = originalServerAddress
		*paymentSetting = originalPaymentSetting
		*generalSetting = originalGeneralSetting
	})

	initModelListColumnNames(t)
	gin.SetMode(gin.TestMode)
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	var err error
	db, err = gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db
	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.TopUp{},
		&model.SubscriptionPlan{},
		&model.SubscriptionOrder{},
		&model.UserSubscription{},
	))

	operation_setting.PayAddress = "https://pay.example.test"
	operation_setting.CustomCallbackAddress = "https://app.example.test"
	operation_setting.EpayId = "test-merchant"
	operation_setting.EpayKey = "test-key"
	operation_setting.Price = 1
	operation_setting.MinTopUp = 1
	operation_setting.PayMethods = []map[string]string{{
		"name": "NowPayments",
		"type": "nowpayment",
	}}
	system_setting.ServerAddress = "https://app.example.test"
	generalSetting.QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD
	paymentSetting.AmountDiscount = map[int]float64{}
	paymentSetting.ComplianceConfirmed = true
	paymentSetting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion

	return db
}

func decodeEpayPurchaseResponse(t *testing.T, recorder *httptest.ResponseRecorder) epayPurchaseResponse {
	t.Helper()
	assert.Equal(t, http.StatusOK, recorder.Code)
	var response epayPurchaseResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	return response
}

func assertSignedEpayTimestamp(t *testing.T, params map[string]string, key string, before int64, after int64) {
	t.Helper()
	timestampText := params["timestamp"]
	require.NotEmpty(t, timestampText)
	timestamp, err := strconv.ParseInt(timestampText, 10, 64)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, timestamp, before)
	assert.LessOrEqual(t, timestamp, after)
	assert.Equal(t, "MD5", params["sign_type"])

	signString := epayTestSignString(params)
	assert.Contains(t, signString, "timestamp="+timestampText)
	expectedSign := fmt.Sprintf("%x", md5.Sum([]byte(signString+key)))
	assert.Equal(t, expectedSign, params["sign"])
}

func TestSignEpayPurchaseParamsAddsTimestampToSignature(t *testing.T) {
	const (
		key       = "test-key"
		timestamp = int64(1700000000)
	)
	params := map[string]string{
		"pid":          "merchant-1",
		"type":         "nowpayment",
		"out_trade_no": "trade-1",
		"notify_url":   "https://example.test/notify",
		"return_url":   "https://example.test/return",
		"name":         "purchase",
		"money":        "12.34",
		"device":       "pc",
		"sign":         "stale-signature",
		"sign_type":    "MD5",
	}

	got := signEpayPurchaseParams(params, key, timestamp)

	assert.Equal(t, "1700000000", got["timestamp"])
	assert.Equal(t, "MD5", got["sign_type"])
	signString := epayTestSignString(got)
	assert.Contains(t, signString, "timestamp=1700000000")
	expectedSign := fmt.Sprintf("%x", md5.Sum([]byte(signString+key)))
	assert.Equal(t, expectedSign, got["sign"])
}

func TestRequestEpaySignedTimestampOptIn(t *testing.T) {
	tests := []struct {
		name    string
		enabled bool
	}{
		{name: "disabled by default", enabled: false},
		{name: "enabled for selected type", enabled: true},
	}

	for index, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			db := setupEpayControllerTestDB(t)
			if test.enabled {
				operation_setting.PayMethods[0]["epay_signed_timestamp"] = "true"
			}
			user := &model.User{
				Id:       1001 + index,
				Username: fmt.Sprintf("epay-topup-user-%d", index),
				Password: "test-password",
				Role:     common.RoleCommonUser,
				Status:   common.UserStatusEnabled,
				Group:    "default",
			}
			require.NoError(t, db.Create(user).Error)

			ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/user/pay", EpayRequest{
				Amount:        10,
				PaymentMethod: "nowpayment",
			}, user.Id)
			before := time.Now().Unix()
			RequestEpay(ctx)
			after := time.Now().Unix()

			response := decodeEpayPurchaseResponse(t, recorder)
			assert.Equal(t, "success", response.Message)
			assert.NotEmpty(t, response.URL)
			if test.enabled {
				assertSignedEpayTimestamp(t, response.Data, operation_setting.EpayKey, before, after)
			} else {
				assert.NotContains(t, response.Data, "timestamp")
			}

			var count int64
			require.NoError(t, db.Model(&model.TopUp{}).Count(&count).Error)
			assert.Equal(t, int64(1), count)
		})
	}
}

func TestSubscriptionRequestEpaySignedTimestampOptIn(t *testing.T) {
	tests := []struct {
		name    string
		enabled bool
	}{
		{name: "disabled by default", enabled: false},
		{name: "enabled for selected type", enabled: true},
	}

	for index, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			db := setupEpayControllerTestDB(t)
			if test.enabled {
				operation_setting.PayMethods[0]["epay_signed_timestamp"] = "true"
			}
			user := &model.User{
				Id:       2001 + index,
				Username: fmt.Sprintf("epay-subscription-user-%d", index),
				Password: "test-password",
				Role:     common.RoleCommonUser,
				Status:   common.UserStatusEnabled,
				Group:    "default",
			}
			require.NoError(t, db.Create(user).Error)

			plan := &model.SubscriptionPlan{
				Id:            3001 + index,
				Title:         fmt.Sprintf("Epay test plan %d", index),
				PriceAmount:   9.99,
				Currency:      "USD",
				DurationUnit:  model.SubscriptionDurationMonth,
				DurationValue: 1,
				Enabled:       true,
			}
			model.InvalidateSubscriptionPlanCache(plan.Id)
			t.Cleanup(func() {
				model.InvalidateSubscriptionPlanCache(plan.Id)
			})
			require.NoError(t, db.Create(plan).Error)

			ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/subscription/epay/pay", SubscriptionEpayPayRequest{
				PlanId:        plan.Id,
				PaymentMethod: "nowpayment",
			}, user.Id)
			before := time.Now().Unix()
			SubscriptionRequestEpay(ctx)
			after := time.Now().Unix()

			response := decodeEpayPurchaseResponse(t, recorder)
			assert.Equal(t, "success", response.Message)
			assert.NotEmpty(t, response.URL)
			if test.enabled {
				assertSignedEpayTimestamp(t, response.Data, operation_setting.EpayKey, before, after)
			} else {
				assert.NotContains(t, response.Data, "timestamp")
			}

			var count int64
			require.NoError(t, db.Model(&model.SubscriptionOrder{}).Count(&count).Error)
			assert.Equal(t, int64(1), count)
		})
	}
}
