package controller

import (
	"bytes"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/thanhpk/randstr"
)

type XunhuPayRequest struct {
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"payment_method"`
}

type xunhuPayResponse struct {
	Openid    string `json:"openid"`
	Url       string `json:"url"`
	UrlQrcode string `json:"url_qrcode"`
	Errcode   int    `json:"errcode"`
	Errmsg    string `json:"errmsg"`
	Hash      string `json:"hash"`
}

func getXunhuPayMoney(amount float64, group string) float64 {
	originalAmount := amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		amount = amount / common.QuotaPerUnit
	}
	topupGroupRatio := common.GetTopupGroupRatio(group)
	if topupGroupRatio == 0 {
		topupGroupRatio = 1
	}
	discount := 1.0
	if ds, ok := operation_setting.GetPaymentSetting().AmountDiscount[int(originalAmount)]; ok {
		if ds > 0 {
			discount = ds
		}
	}
	return amount * setting.XunhuUnitPrice * topupGroupRatio * discount
}

func getXunhuMinTopup() int64 {
	minTopup := setting.XunhuMinTopUp
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		minTopup = minTopup * int(common.QuotaPerUnit)
	}
	return int64(minTopup)
}

func generateXunhuHash(params map[string]string, secret string) string {
	keys := make([]string, 0, len(params))
	for k, v := range params {
		if k == "hash" || v == "" {
			continue
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var b strings.Builder
	for i, k := range keys {
		if i > 0 {
			b.WriteByte('&')
		}
		b.WriteString(k)
		b.WriteByte('=')
		b.WriteString(params[k])
	}
	b.WriteString(secret)
	sum := md5.Sum([]byte(b.String()))
	return hex.EncodeToString(sum[:])
}

func formatXunhuFee(amount float64) string {
	return strconv.FormatFloat(amount, 'f', 2, 64)
}

func RequestXunhuAmount(c *gin.Context) {
	var req XunhuPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}

	if req.Amount < getXunhuMinTopup() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", setting.XunhuMinTopUp)})
		return
	}

	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}

	payMoney := getXunhuPayMoney(float64(req.Amount), group)
	if payMoney <= 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "success", "data": strconv.FormatFloat(payMoney, 'f', 2, 64)})
}

func RequestXunhuPay(c *gin.Context) {
	if !isXunhuTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "虎皮椒支付未启用"})
		return
	}

	var req XunhuPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}

	if req.Amount < getXunhuMinTopup() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", setting.XunhuMinTopUp)})
		return
	}

	appId, appSecret, ok := setting.GetXunhuCredentials(req.PaymentMethod)
	if !ok {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "不支持的支付方式"})
		return
	}

	id := c.GetInt("id")
	user, err := model.GetUserById(id, false)
	if err != nil || user == nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "用户不存在"})
		return
	}

	group, _ := model.GetUserGroup(id, true)
	payMoney := getXunhuPayMoney(float64(req.Amount), group)
	if payMoney < 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		amount = int64(float64(req.Amount) / common.QuotaPerUnit)
		if amount < 1 {
			amount = 1
		}
	}

	tradeNo := fmt.Sprintf("XH%d%d%s", id, time.Now().UnixMilli(), randstr.String(6))
	topUp := &model.TopUp{
		UserId:          id,
		Amount:          amount,
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   req.PaymentMethod,
		PaymentProvider: model.PaymentProviderXunhu,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("虎皮椒创建充值订单失败 user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	callbackAddr := strings.TrimRight(service.GetCallbackAddress(), "/")
	notifyUrl := callbackAddr + "/api/xunhu/notify"
	returnUrl := paymentReturnPath("/console/topup?show_history=true")

	params := map[string]string{
		"version":        "1.1",
		"appid":          appId,
		"trade_order_id": tradeNo,
		"total_fee":      formatXunhuFee(payMoney),
		"title":          "余额充值",
		"time":           strconv.FormatInt(time.Now().Unix(), 10),
		"notify_url":     notifyUrl,
		"return_url":     returnUrl,
		"callback_url":   returnUrl,
		"plugins":        "new-api",
		"nonce_str":      randstr.String(16),
	}
	params["hash"] = generateXunhuHash(params, appSecret)

	body, err := common.Marshal(params)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("虎皮椒序列化请求失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建支付请求失败"})
		return
	}

	httpReq, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, setting.GetXunhuGatewayUrl(), bytes.NewReader(body))
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("虎皮椒创建HTTP请求失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建支付请求失败"})
		return
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := service.GetHttpClient().Do(httpReq)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("虎皮椒请求失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("虎皮椒读取响应失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}

	var payResp xunhuPayResponse
	if err := common.Unmarshal(respBody, &payResp); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("虎皮椒解析响应失败 user_id=%d trade_no=%s body=%q error=%q", id, tradeNo, string(respBody), err.Error()))
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}

	if payResp.Errcode != 0 {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("虎皮椒业务失败 user_id=%d trade_no=%s errcode=%d errmsg=%q body=%q", id, tradeNo, payResp.Errcode, payResp.Errmsg, string(respBody)))
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		msg := payResp.Errmsg
		if msg == "" {
			msg = "拉起支付失败"
		}
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": msg})
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("虎皮椒充值订单创建成功 user_id=%d trade_no=%s amount=%d money=%.2f method=%s", id, tradeNo, req.Amount, payMoney, req.PaymentMethod))

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"url":        payResp.Url,
			"url_qrcode": payResp.UrlQrcode,
			"trade_no":   tradeNo,
		},
	})
}

func XunhuNotify(c *gin.Context) {
	if !isXunhuWebhookEnabled() {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("虎皮椒 webhook 被拒绝 reason=webhook_disabled path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		c.String(http.StatusOK, "fail")
		return
	}

	if err := c.Request.ParseForm(); err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("虎皮椒 webhook 解析表单失败 client_ip=%s error=%q", c.ClientIP(), err.Error()))
		c.String(http.StatusOK, "fail")
		return
	}

	params := make(map[string]string, len(c.Request.PostForm))
	for k, values := range c.Request.PostForm {
		if len(values) > 0 {
			params[k] = values[0]
		}
	}

	tradeNo := params["trade_order_id"]
	appId := params["appid"]
	status := params["status"]
	hash := params["hash"]
	totalFee := params["total_fee"]

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("虎皮椒 webhook 收到请求 trade_no=%s status=%s appid=%s client_ip=%s", tradeNo, status, appId, c.ClientIP()))

	secret, ok := setting.GetXunhuSecretByAppId(appId)
	if !ok {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("虎皮椒 webhook appid 无效 trade_no=%s appid=%s client_ip=%s", tradeNo, appId, c.ClientIP()))
		c.String(http.StatusOK, "fail")
		return
	}

	if hash == "" || generateXunhuHash(params, secret) != hash {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("虎皮椒 webhook 验签失败 trade_no=%s appid=%s client_ip=%s", tradeNo, appId, c.ClientIP()))
		c.String(http.StatusOK, "fail")
		return
	}

	if status != "OD" {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("虎皮椒 webhook 忽略非支付成功状态 trade_no=%s status=%s client_ip=%s", tradeNo, status, c.ClientIP()))
		c.String(http.StatusOK, "success")
		return
	}

	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("虎皮椒 webhook 订单不存在 trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
		c.String(http.StatusOK, "fail")
		return
	}

	if fee, err := strconv.ParseFloat(totalFee, 64); err == nil {
		diff := fee - topUp.Money
		if diff < 0 {
			diff = -diff
		}
		if diff > 0.01 {
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("虎皮椒 webhook 金额不匹配 trade_no=%s expect=%.2f got=%s client_ip=%s", tradeNo, topUp.Money, totalFee, c.ClientIP()))
			c.String(http.StatusOK, "fail")
			return
		}
	}

	if err := model.RechargeXunhu(tradeNo, c.ClientIP()); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("虎皮椒入账失败 trade_no=%s client_ip=%s error=%q", tradeNo, c.ClientIP(), err.Error()))
		c.String(http.StatusOK, "fail")
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("虎皮椒入账成功 trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
	c.String(http.StatusOK, "success")
}
