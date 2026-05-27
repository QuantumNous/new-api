package controller

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	airwallexsvc "github.com/QuantumNous/new-api/service/airwallex"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type airwallexWebhookEvent struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Data struct {
		Object json.RawMessage `json:"object"`
	} `json:"data"`
}

type paymentIntentWebhookObject struct {
	ID              string      `json:"id"`
	MerchantOrderID string      `json:"merchant_order_id"`
	Amount          json.Number `json:"amount"`
	Currency        string      `json:"currency"`
	Status          string      `json:"status"`
}

func airwallexSignatureHex(secret string, timestamp string, body []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(timestamp))
	_, _ = mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}

func roundAirwallexMoney(value float64) float64 {
	return math.Round(value*100) / 100
}

func AirwallexWebhook(c *gin.Context) {
	cfg := operation_setting.GetAirwallexSetting()
	if !cfg.Enabled {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	biz := c.Param("biz")
	acct, ok := cfg.Accounts[biz]
	if !ok || !acct.Enabled {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	if strings.TrimSpace(acct.WebhookSecret) == "" {
		c.AbortWithStatus(http.StatusServiceUnavailable)
		return
	}

	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	timestamp := c.GetHeader("x-timestamp")
	signature := c.GetHeader("x-signature")
	if timestamp == "" || signature == "" {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}
	if !strings.EqualFold(strings.TrimSpace(signature), airwallexSignatureHex(acct.WebhookSecret, timestamp, bodyBytes)) {
		if gin.Mode() == gin.TestMode {
			c.Header("x-debug-expected-signature", airwallexSignatureHex(acct.WebhookSecret, timestamp, bodyBytes))
		}
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	if tolerance := cfg.WebhookTimestampToleranceSeconds; tolerance > 0 {
		ts, err := strconv.ParseInt(timestamp, 10, 64)
		if err != nil {
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}
		if ts > 1e12 {
			ts = ts / 1000
		}
		diff := time.Now().Unix() - ts
		if diff < 0 {
			diff = -diff
		}
		if diff > int64(tolerance) {
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}
	}

	var evt airwallexWebhookEvent
	dec := json.NewDecoder(bytes.NewReader(bodyBytes))
	dec.UseNumber()
	if err := dec.Decode(&evt); err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	var obj paymentIntentWebhookObject
	if err := json.Unmarshal(evt.Data.Object, &obj); err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	tradeNo := strings.TrimSpace(obj.MerchantOrderID)
	if tradeNo == "" {
		c.Status(http.StatusOK)
		return
	}
	amount, _ := obj.Amount.Float64()
	currency := strings.ToUpper(strings.TrimSpace(obj.Currency))
	raw := common.MapToJsonStr(map[string]any{
		"event_id":          evt.ID,
		"event_name":        evt.Name,
		"biz":               biz,
		"merchant_order_id": tradeNo,
		"payment_intent_id": obj.ID,
		"amount":            amount,
		"currency":          currency,
	})

	switch evt.Name {
	case "payment_intent.succeeded":
		if err := airwallexCreditOnce(tradeNo, evt.ID, obj.ID, currency, amount, raw); err != nil {
			common.SysError("airwallex webhook credit: " + err.Error())
		}
	case "payment_intent.cancelled", "payment_intent.expired":
		if err := airwallexMarkExpired(tradeNo, evt.ID, obj.ID, currency, raw); err != nil {
			common.SysError("airwallex webhook expire: " + err.Error())
		}
	}
	c.Status(http.StatusOK)
}

func airwallexCreditOnce(tradeNo, eventID, paymentIntentID, currency string, amount float64, providerRaw string) error {
	topUpUpdates := map[string]any{}
	if eventID != "" {
		topUpUpdates["provider_event_id"] = eventID
	}
	if paymentIntentID != "" {
		topUpUpdates["provider_payment_intent_id"] = paymentIntentID
	}
	if currency != "" {
		topUpUpdates["pay_currency"] = currency
	}
	if providerRaw != "" {
		topUpUpdates["provider_raw"] = providerRaw
	}

	result := &model.CompleteTopUpAndAddQuotaResult{}
	quotaToAdd, err := model.CompleteTopUpAndAddQuota(tradeNo, model.CompleteTopUpAndAddQuotaParams{
		QuotaCalcMode: model.QuotaCalcAmountTimesQuotaPerUnit,
		TopUpUpdates:  topUpUpdates,
		Result:        result,
		PreValidate: func(topUp *model.TopUp) error {
			if topUp.PayCurrency != nil && currency != "" && strings.ToUpper(*topUp.PayCurrency) != currency {
				return fmt.Errorf("currency mismatch")
			}
			if amount > 0 && roundAirwallexMoney(topUp.Money) != roundAirwallexMoney(amount) {
				return fmt.Errorf("amount mismatch")
			}
			if topUp.PaymentProvider != model.PaymentProviderAirwallex {
				return model.ErrPaymentMethodMismatch
			}
			return nil
		},
	})
	if err != nil {
		return err
	}
	if result.Credited {
		model.RecordLog(result.UserID, model.LogTypeTopup, fmt.Sprintf("使用Airwallex充值成功，充值金额: %v，支付金额：%f", quotaToAdd, result.PayMoney))
	}
	return nil
}

func airwallexMarkExpired(tradeNo, eventID, paymentIntentID, currency string, providerRaw string) error {
	return model.DB.Transaction(func(tx *gorm.DB) error {
		var topUp model.TopUp
		if err := tx.Where("trade_no = ?", tradeNo).First(&topUp).Error; err != nil {
			return nil
		}
		if topUp.PaymentProvider != model.PaymentProviderAirwallex || topUp.Status != common.TopUpStatusPending {
			return nil
		}
		updates := map[string]any{
			"status":        common.TopUpStatusExpired,
			"complete_time": common.GetTimestamp(),
		}
		if eventID != "" {
			updates["provider_event_id"] = eventID
		}
		if paymentIntentID != "" {
			updates["provider_payment_intent_id"] = paymentIntentID
		}
		if currency != "" {
			updates["pay_currency"] = currency
		}
		if providerRaw != "" {
			updates["provider_raw"] = providerRaw
		}
		return tx.Model(&model.TopUp{}).Where("id = ? AND status = ?", topUp.Id, common.TopUpStatusPending).Updates(updates).Error
	})
}

func GetAirwallexPaymentMethodTypes(c *gin.Context) {
	if !isAirwallexTopUpEnabled() {
		common.ApiErrorMsg(c, "airwallex disabled")
		return
	}

	biz := c.Query("biz")
	if biz == "" {
		biz = getDefaultAirwallexBiz()
	}
	currency := strings.ToUpper(strings.TrimSpace(c.Query("currency")))
	countryCode := strings.ToUpper(strings.TrimSpace(c.Query("country_code")))
	if biz == "" || currency == "" || countryCode == "" {
		common.ApiErrorMsg(c, "biz, currency, and country_code are required")
		return
	}

	methods, err := airwallexsvc.GetAvailableMethods(c.Request.Context(), biz, currency, countryCode)
	if err != nil {
		common.SysError("airwallex payment methods: " + err.Error())
		common.ApiErrorMsg(c, "failed to get payment methods")
		return
	}
	common.ApiSuccess(c, gin.H{"available_methods": methods})
}

func resolveAirwallexAmountByCurrency(currency string, amount int64, amountOptionID int64) (int64, error) {
	if amount > 0 {
		return amount, nil
	}
	if amountOptionID <= 0 {
		return 0, fmt.Errorf("amount is required")
	}
	options, ok := operation_setting.GetPaymentSetting().GetConfiguredAmountOptionsByCurrency(currency)
	if !ok || len(options) == 0 {
		return 0, fmt.Errorf("no amount options configured for selected currency")
	}
	for _, option := range options {
		if int64(option) == amountOptionID {
			return amountOptionID, nil
		}
	}
	return 0, fmt.Errorf("amount_option_id is not allowed for selected currency")
}

func containsAirwallexCurrency(currencies []string, currency string) bool {
	for _, item := range currencies {
		if strings.EqualFold(item, currency) {
			return true
		}
	}
	return false
}

func RequestAirwallexPay(c *gin.Context) {
	if !isAirwallexTopUpEnabled() {
		common.ApiErrorMsg(c, "airwallex disabled")
		return
	}

	var req struct {
		Biz               string `json:"biz"`
		Currency          string `json:"currency"`
		CountryCode       string `json:"country_code"`
		PaymentMethodType string `json:"payment_method_type"`
		Amount            int64  `json:"amount"`
		AmountOptionID    int64  `json:"amount_option_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "invalid request body")
		return
	}
	if req.Biz == "" {
		req.Biz = getDefaultAirwallexBiz()
	}
	req.Currency = strings.ToUpper(strings.TrimSpace(req.Currency))
	req.CountryCode = strings.ToUpper(strings.TrimSpace(req.CountryCode))
	req.PaymentMethodType = airwallexsvc.NormalizePaymentMethodID(req.PaymentMethodType)
	if req.Biz == "" || req.Currency == "" || req.CountryCode == "" || req.PaymentMethodType == "" {
		common.ApiErrorMsg(c, "biz, currency, country_code, and payment_method_type are required")
		return
	}
	if !containsAirwallexCurrency(operation_setting.GetPaymentSetting().GetSupportedCurrencies(), req.Currency) {
		common.ApiErrorMsg(c, "currency is not supported")
		return
	}

	amount, err := resolveAirwallexAmountByCurrency(req.Currency, req.Amount, req.AmountOptionID)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	if amount < getMinTopup() {
		common.ApiErrorMsg(c, fmt.Sprintf("amount must be >= %d", getMinTopup()))
		return
	}

	userID := c.GetInt("id")
	group, err := model.GetUserGroup(userID, true)
	if err != nil || group == "" {
		group = "default"
	}
	payMoney := getPayMoney(amount, group, req.Currency)
	if payMoney < 0.01 {
		common.ApiErrorMsg(c, "pay amount too low")
		return
	}

	available, err := airwallexsvc.GetAvailableMethods(c.Request.Context(), req.Biz, req.Currency, req.CountryCode)
	if err != nil {
		common.SysError("airwallex available methods: " + err.Error())
		common.ApiErrorMsg(c, "failed to get payment methods")
		return
	}
	methodFlow := ""
	for _, method := range available {
		if method.Type == req.PaymentMethodType {
			methodFlow = method.Flow
			req.PaymentMethodType = method.Type
			break
		}
	}
	if methodFlow == "" {
		common.ApiErrorMsg(c, "payment_method_type not available")
		return
	}

	amountForDB := amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		amountForDB = decimal.NewFromInt(amount).Div(decimal.NewFromFloat(common.QuotaPerUnit)).IntPart()
	}

	tradeNo := fmt.Sprintf("USR%dNO%s%d", userID, common.GetRandomString(6), time.Now().Unix())
	bizLine := req.Biz
	payCurrency := req.Currency
	topUp := &model.TopUp{
		UserId:          userID,
		Amount:          amountForDB,
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodAirwallex,
		PaymentProvider: model.PaymentProviderAirwallex,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
		BizLine:         &bizLine,
		PayCurrency:     &payCurrency,
	}
	if err := topUp.Insert(); err != nil {
		common.SysError("airwallex create topup: " + err.Error())
		common.ApiErrorMsg(c, "failed to create order")
		return
	}

	payRes, err := airwallexsvc.CreatePay(c.Request.Context(), airwallexsvc.CreatePayParams{
		Biz:               req.Biz,
		Currency:          req.Currency,
		CountryCode:       req.CountryCode,
		PaymentMethodType: req.PaymentMethodType,
		Flow:              methodFlow,
		Amount:            payMoney,
		MerchantOrderID:   tradeNo,
		ReturnURL:         system_setting.ServerAddress + "/console/topup",
	})
	if err != nil {
		common.SysError("airwallex create payment: " + err.Error())
		_ = model.DB.Model(&model.TopUp{}).
			Where("id = ? AND status = ?", topUp.Id, common.TopUpStatusPending).
			Updates(map[string]any{"status": common.TopUpStatusExpired, "complete_time": common.GetTimestamp()}).Error
		common.ApiErrorMsg(c, "failed to create payment")
		return
	}

	topUp.ProviderPaymentIntentID = &payRes.PaymentIntentID
	if payRes.CreateRequestID != "" {
		topUp.ProviderRequestID = &payRes.CreateRequestID
	}
	if payRes.SanitizedRaw != "" {
		topUp.ProviderRaw = &payRes.SanitizedRaw
	}
	_ = topUp.Update()

	resp := gin.H{
		"trade_no":          tradeNo,
		"payment_intent_id": payRes.PaymentIntentID,
	}
	if payRes.ClientSecret != "" {
		resp["client_secret"] = payRes.ClientSecret
	}
	if payRes.NextAction != nil && payRes.NextAction.Type != "" {
		resp["next_action"] = payRes.NextAction
	}
	common.ApiSuccess(c, resp)
}
