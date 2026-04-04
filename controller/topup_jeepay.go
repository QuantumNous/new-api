package controller

import (
	"bytes"
	"context"
	"crypto/md5"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/thanhpk/randstr"
)

const (
	PaymentMethodJeepay = "jeepay"

	jeepaySignTypeMD5     = "MD5"
	jeepayVersion         = "1.0"
	jeepayStateSuccess    = "2"
	jeepayStateFailed     = "3"
	jeepayUnifiedOrderURI = "/api/pay/unifiedOrder"
)

type JeepayPayRequest struct {
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"payment_method"`
}

type jeepayUnifiedOrderRequest struct {
	MchNo      string `json:"mchNo"`
	AppID      string `json:"appId"`
	MchOrderNo string `json:"mchOrderNo"`
	WayCode    string `json:"wayCode"`
	Amount     int64  `json:"amount"`
	Currency   string `json:"currency"`
	ClientIP   string `json:"clientIp"`
	Subject    string `json:"subject"`
	Body       string `json:"body"`
	NotifyURL  string `json:"notifyUrl"`
	ReturnURL  string `json:"returnUrl,omitempty"`
	ReqTime    int64  `json:"reqTime"`
	Version    string `json:"version"`
	Sign       string `json:"sign"`
	SignType   string `json:"signType"`
}

type jeepayResponse struct {
	Code int                    `json:"code"`
	Msg  string                 `json:"msg"`
	Sign string                 `json:"sign"`
	Data map[string]interface{} `json:"data"`
}

func getJeepayMinTopup() int64 {
	if setting.JeepayMinTopUp <= 0 {
		return 1
	}
	return int64(setting.JeepayMinTopUp)
}

func isJeepayConfigured() bool {
	return setting.JeepayBaseURL != "" &&
		setting.JeepayMchNo != "" &&
		setting.JeepayAppID != "" &&
		setting.JeepayAPIKey != ""
}

func buildJeepaySign(params map[string]interface{}, apiKey string) string {
	if apiKey == "" {
		return ""
	}

	keys := make([]string, 0, len(params))
	for key, value := range params {
		if value == nil || key == "sign" {
			continue
		}
		strValue := jeepayValueToString(value)
		if strValue == "" {
			continue
		}
		keys = append(keys, key)
	}
	sort.Strings(keys)

	var builder strings.Builder
	for index, key := range keys {
		if index > 0 {
			builder.WriteByte('&')
		}
		builder.WriteString(key)
		builder.WriteByte('=')
		builder.WriteString(jeepayValueToString(params[key]))
	}
	if builder.Len() > 0 {
		builder.WriteByte('&')
	}
	builder.WriteString("key=")
	builder.WriteString(apiKey)

	sum := md5.Sum([]byte(builder.String()))
	return strings.ToUpper(fmt.Sprintf("%x", sum))
}

func jeepayValueToString(value interface{}) string {
	switch typed := value.(type) {
	case string:
		return typed
	case fmt.Stringer:
		return typed.String()
	case int:
		return strconv.Itoa(typed)
	case int64:
		return strconv.FormatInt(typed, 10)
	case float64:
		return strconv.FormatInt(int64(typed), 10)
	case float32:
		return strconv.FormatInt(int64(typed), 10)
	case bool:
		if typed {
			return "true"
		}
		return "false"
	default:
		return fmt.Sprintf("%v", typed)
	}
}

func RequestJeepayPay(c *gin.Context) {
	var req JeepayPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if req.PaymentMethod != PaymentMethodJeepay {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "不支持的支付渠道"})
		return
	}
	if !isJeepayConfigured() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "当前管理员未配置 Jeepay 支付信息"})
		return
	}
	if req.Amount < getJeepayMinTopup() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", getJeepayMinTopup())})
		return
	}

	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}

	payMoney := getPayMoney(req.Amount, group)
	if payMoney < 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	tradeNo := fmt.Sprintf("JEEPAY-%d-%d-%s", id, time.Now().UnixMilli(), randstr.String(6))
	callbackAddr := service.GetCallbackAddress()
	notifyURL := callbackAddr + "/api/jeepay/notify"
	if setting.JeepayNotifyURL != "" {
		notifyURL = setting.JeepayNotifyURL
	}
	returnURL := system_setting.ServerAddress + "/console/topup?show_history=true"
	if setting.JeepayReturnURL != "" {
		returnURL = setting.JeepayReturnURL
	}

	reqTime := time.Now().UnixMilli()
	amountFen := int64(payMoney*100 + 0.5)
	if amountFen <= 0 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	amount := req.Amount
	if operationQuotaDisplayIsTokens() {
		amount = normalizeTokenDisplayAmount(req.Amount)
	}

	topUp := &model.TopUp{
		UserId:        id,
		Amount:        amount,
		Money:         payMoney,
		TradeNo:       tradeNo,
		PaymentMethod: PaymentMethodJeepay,
		CreateTime:    time.Now().Unix(),
		Status:        common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	orderReq := jeepayUnifiedOrderRequest{
		MchNo:      setting.JeepayMchNo,
		AppID:      setting.JeepayAppID,
		MchOrderNo: tradeNo,
		WayCode:    getJeepayWayCode(),
		Amount:     amountFen,
		Currency:   "cny",
		ClientIP:   c.ClientIP(),
		Subject:    fmt.Sprintf("new-api top-up %d", req.Amount),
		Body:       fmt.Sprintf("Top-up %d", req.Amount),
		NotifyURL:  notifyURL,
		ReturnURL:  returnURL,
		ReqTime:    reqTime,
		Version:    jeepayVersion,
		SignType:   jeepaySignTypeMD5,
	}
	signSource := map[string]interface{}{
		"mchNo":      orderReq.MchNo,
		"appId":      orderReq.AppID,
		"mchOrderNo": orderReq.MchOrderNo,
		"wayCode":    orderReq.WayCode,
		"amount":     orderReq.Amount,
		"currency":   orderReq.Currency,
		"clientIp":   orderReq.ClientIP,
		"subject":    orderReq.Subject,
		"body":       orderReq.Body,
		"notifyUrl":  orderReq.NotifyURL,
		"returnUrl":  orderReq.ReturnURL,
		"reqTime":    orderReq.ReqTime,
		"version":    orderReq.Version,
		"signType":   orderReq.SignType,
	}
	orderReq.Sign = buildJeepaySign(signSource, setting.JeepayAPIKey)

	paymentURL, err := createJeepayOrder(c.Request.Context(), &orderReq)
	if err != nil {
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"payment_url": paymentURL,
			"order_id":    tradeNo,
		},
	})
}

func JeepayNotify(c *gin.Context) {
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.String(http.StatusBadRequest, "fail")
		return
	}

	var payload map[string]interface{}
	if err := common.Unmarshal(bodyBytes, &payload); err != nil {
		c.String(http.StatusBadRequest, "fail")
		return
	}

	sign := jeepayValueToString(payload["sign"])
	if sign == "" {
		c.String(http.StatusBadRequest, "fail")
		return
	}
	if buildJeepaySign(payload, setting.JeepayAPIKey) != sign {
		c.String(http.StatusUnauthorized, "fail")
		return
	}

	tradeNo := jeepayValueToString(payload["mchOrderNo"])
	if tradeNo == "" {
		c.String(http.StatusBadRequest, "fail")
		return
	}

	state := jeepayValueToString(payload["state"])

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)

	switch state {
	case jeepayStateSuccess:
		if err := model.RechargeJeepay(tradeNo); err != nil {
			c.String(http.StatusInternalServerError, "fail")
			return
		}
	case jeepayStateFailed:
		if topUp := model.GetTopUpByTradeNo(tradeNo); topUp != nil && topUp.Status == common.TopUpStatusPending {
			topUp.Status = common.TopUpStatusFailed
			_ = topUp.Update()
		}
	default:
	}

	c.String(http.StatusOK, "success")
}

func createJeepayOrder(ctx context.Context, orderReq *jeepayUnifiedOrderRequest) (string, error) {
	bodyBytes, err := common.Marshal(orderReq)
	if err != nil {
		return "", err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(setting.JeepayBaseURL, "/")+jeepayUnifiedOrderURI, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", err
	}
	request.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return "", fmt.Errorf("unexpected status: %d", response.StatusCode)
	}

	responseBody, err := io.ReadAll(response.Body)
	if err != nil {
		return "", err
	}

	var jeepayResp jeepayResponse
	if err := common.Unmarshal(responseBody, &jeepayResp); err != nil {
		return "", err
	}
	if jeepayResp.Code != 0 {
		return "", fmt.Errorf("jeepay error: %s", jeepayResp.Msg)
	}
	return extractJeepayPaymentURL(jeepayResp.Data)
}

func extractJeepayPaymentURL(data map[string]interface{}) (string, error) {
	if data == nil {
		return "", fmt.Errorf("empty data")
	}

	for _, key := range []string{"payUrl", "payData", "codeUrl", "cashierUrl"} {
		value := strings.TrimSpace(jeepayValueToString(data[key]))
		if value != "" && strings.HasPrefix(value, "http") {
			return value, nil
		}
	}

	if payData, ok := data["payData"].(string); ok {
		trimmed := strings.TrimSpace(payData)
		if strings.HasPrefix(trimmed, "http") {
			return trimmed, nil
		}
		if strings.HasPrefix(trimmed, "{") {
			var nested map[string]interface{}
			if err := common.Unmarshal([]byte(trimmed), &nested); err == nil {
				for _, key := range []string{"payUrl", "cashierUrl", "codeUrl"} {
					value := strings.TrimSpace(jeepayValueToString(nested[key]))
					if value != "" && strings.HasPrefix(value, "http") {
						return value, nil
					}
				}
			}
		}
	}

	if payData, ok := data["payData"].(map[string]interface{}); ok {
		for _, key := range []string{"payUrl", "cashierUrl", "codeUrl"} {
			value := strings.TrimSpace(jeepayValueToString(payData[key]))
			if value != "" && strings.HasPrefix(value, "http") {
				return value, nil
			}
		}
	}

	return "", fmt.Errorf("payment url not found")
}

func getJeepayWayCode() string {
	if setting.JeepayWayCode != "" {
		return setting.JeepayWayCode
	}
	return "WEB_CASHIER"
}

func operationQuotaDisplayIsTokens() bool {
	return operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens
}

func normalizeTokenDisplayAmount(amount int64) int64 {
	if !operationQuotaDisplayIsTokens() {
		return amount
	}
	normalized := int64(float64(amount) / common.QuotaPerUnit)
	if normalized < 1 {
		return 1
	}
	return normalized
}
