package controller

import (
	"bytes"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
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
	// openid 实际是订单 id，虎皮椒可能返回数字或字符串，对接不需要该字段
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
	returnUrl := paymentReturnPath("/console/topup?show_history=true&xunhu_trade_no=" + url.QueryEscape(tradeNo))

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

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("虎皮椒充值订单创建成功 user_id=%d trade_no=%s amount=%d money=%.2f method=%s notify_url=%s", id, tradeNo, req.Amount, payMoney, req.PaymentMethod, notifyUrl))
	common.SysLog(fmt.Sprintf("[xunhu-pay] created trade_no=%s notify_url=%s money=%.2f method=%s", tradeNo, notifyUrl, payMoney, req.PaymentMethod))

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"url":        payResp.Url,
			"url_qrcode": payResp.UrlQrcode,
			"trade_no":   tradeNo,
		},
	})
}

func writeXunhuNotifyResult(c *gin.Context, ok bool) {
	c.Header("Content-Type", "text/plain; charset=utf-8")
	if ok {
		_, _ = c.Writer.Write([]byte("success"))
		return
	}
	_, _ = c.Writer.Write([]byte("fail"))
}

func parseXunhuNotifyParams(c *gin.Context) (map[string]string, string) {
	rawBody, _ := io.ReadAll(c.Request.Body)
	c.Request.Body = io.NopCloser(bytes.NewReader(rawBody))
	_ = c.Request.ParseForm()

	params := make(map[string]string)
	put := func(k, v string) {
		v = strings.TrimSpace(v)
		if k != "" && v != "" {
			params[k] = v
		}
	}

	for k, values := range c.Request.URL.Query() {
		if len(values) > 0 {
			put(k, values[0])
		}
	}
	for k, values := range c.Request.Form {
		if len(values) > 0 {
			put(k, values[0])
		}
	}
	for k, values := range c.Request.PostForm {
		if len(values) > 0 {
			put(k, values[0])
		}
	}

	// 兼容 JSON 或纯 querystring body
	if len(rawBody) > 0 {
		var jsonParams map[string]any
		if err := common.Unmarshal(rawBody, &jsonParams); err == nil {
			for k, v := range jsonParams {
				if v == nil {
					continue
				}
				s := strings.TrimSpace(fmt.Sprint(v))
				if s != "" && s != "<nil>" {
					put(k, s)
				}
			}
		} else if values, err := url.ParseQuery(string(rawBody)); err == nil {
			for k, vs := range values {
				if len(vs) > 0 {
					put(k, vs[0])
				}
			}
		}
	}

	return params, string(rawBody)
}

func XunhuNotify(c *gin.Context) {
	// 使用 SysLog 确保在 pm2/控制台一定可见，便于排查回调是否到达
	common.SysLog(fmt.Sprintf("[xunhu-notify] hit method=%s path=%s ip=%s content_type=%q content_length=%s ua=%q",
		c.Request.Method, c.Request.RequestURI, c.ClientIP(),
		c.GetHeader("Content-Type"), c.GetHeader("Content-Length"), c.GetHeader("User-Agent")))

	enabled := isXunhuWebhookEnabled()
	common.SysLog(fmt.Sprintf("[xunhu-notify] enabled=%v xunhu_enabled=%v wx_configured=%v ali_configured=%v",
		enabled, setting.XunhuEnabled, setting.IsXunhuWxConfigured(), setting.IsXunhuAliConfigured()))

	if !enabled {
		common.SysError("[xunhu-notify] rejected: webhook_disabled")
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("虎皮椒 webhook 被拒绝 reason=webhook_disabled path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		writeXunhuNotifyResult(c, false)
		return
	}

	params, rawBody := parseXunhuNotifyParams(c)
	tradeNo := params["trade_order_id"]
	appId := params["appid"]
	status := params["status"]
	hash := params["hash"]
	totalFee := params["total_fee"]

	common.SysLog(fmt.Sprintf("[xunhu-notify] parsed trade_no=%s status=%s appid=%s total_fee=%s hash=%s body=%q params=%s",
		tradeNo, status, appId, totalFee, hash, rawBody, common.GetJsonString(params)))
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("虎皮椒 webhook 收到请求 trade_no=%s status=%s appid=%s client_ip=%s params=%q body=%q", tradeNo, status, appId, c.ClientIP(), common.GetJsonString(params), rawBody))

	// 浏览器直接打开回调地址时的探活提示（无业务参数）
	if c.Request.Method == http.MethodGet && tradeNo == "" && rawBody == "" {
		common.SysLog("[xunhu-notify] probe ok (empty GET)")
		c.Header("Content-Type", "text/plain; charset=utf-8")
		_, _ = c.Writer.Write([]byte("xunhu notify endpoint ok"))
		return
	}

	if tradeNo == "" || appId == "" {
		common.SysError(fmt.Sprintf("[xunhu-notify] missing fields method=%s trade_no=%q appid=%q content_type=%q body=%q hint=空 body 通常不是虎皮椒服务器回调（可能是浏览器探活或反代剥掉了 POST body）",
			c.Request.Method, tradeNo, appId, c.GetHeader("Content-Type"), rawBody))
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("虎皮椒 webhook 缺少必要参数 method=%s client_ip=%s content_type=%q body=%q",
			c.Request.Method, c.ClientIP(), c.GetHeader("Content-Type"), rawBody))
		writeXunhuNotifyResult(c, false)
		return
	}

	secret, ok := setting.GetXunhuSecretByAppId(appId)
	if !ok {
		common.SysError(fmt.Sprintf("[xunhu-notify] unknown appid=%s trade_no=%s wx_appid=%q ali_appid=%q",
			appId, tradeNo, setting.XunhuWxAppId, setting.XunhuAliAppId))
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("虎皮椒 webhook appid 无效 trade_no=%s appid=%s client_ip=%s", tradeNo, appId, c.ClientIP()))
		writeXunhuNotifyResult(c, false)
		return
	}

	expectedHash := generateXunhuHash(params, secret)
	if hash == "" || expectedHash != hash {
		common.SysError(fmt.Sprintf("[xunhu-notify] bad sign trade_no=%s got=%s expect=%s", tradeNo, hash, expectedHash))
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("虎皮椒 webhook 验签失败 trade_no=%s appid=%s client_ip=%s got=%s expect=%s", tradeNo, appId, c.ClientIP(), hash, expectedHash))
		writeXunhuNotifyResult(c, false)
		return
	}

	if status != "OD" {
		common.SysLog(fmt.Sprintf("[xunhu-notify] ignore status=%s trade_no=%s", status, tradeNo))
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("虎皮椒 webhook 忽略非支付成功状态 trade_no=%s status=%s client_ip=%s", tradeNo, status, c.ClientIP()))
		writeXunhuNotifyResult(c, true)
		return
	}

	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil {
		common.SysError(fmt.Sprintf("[xunhu-notify] order not found trade_no=%s", tradeNo))
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("虎皮椒 webhook 订单不存在 trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
		writeXunhuNotifyResult(c, false)
		return
	}

	common.SysLog(fmt.Sprintf("[xunhu-notify] local order trade_no=%s status=%s money=%.2f method=%s user_id=%d",
		tradeNo, topUp.Status, topUp.Money, topUp.PaymentMethod, topUp.UserId))

	if fee, err := strconv.ParseFloat(totalFee, 64); err == nil {
		diff := fee - topUp.Money
		if diff < 0 {
			diff = -diff
		}
		if diff > 0.01 {
			common.SysError(fmt.Sprintf("[xunhu-notify] amount mismatch trade_no=%s expect=%.2f got=%s", tradeNo, topUp.Money, totalFee))
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("虎皮椒 webhook 金额不匹配 trade_no=%s expect=%.2f got=%s client_ip=%s", tradeNo, topUp.Money, totalFee, c.ClientIP()))
			writeXunhuNotifyResult(c, false)
			return
		}
	}

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)

	if err := model.RechargeXunhu(tradeNo, c.ClientIP()); err != nil {
		common.SysError(fmt.Sprintf("[xunhu-notify] recharge failed trade_no=%s err=%q", tradeNo, err.Error()))
		logger.LogError(c.Request.Context(), fmt.Sprintf("虎皮椒入账失败 trade_no=%s client_ip=%s error=%q", tradeNo, c.ClientIP(), err.Error()))
		writeXunhuNotifyResult(c, false)
		return
	}

	common.SysLog(fmt.Sprintf("[xunhu-notify] recharge ok trade_no=%s", tradeNo))
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("虎皮椒入账成功 trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
	writeXunhuNotifyResult(c, true)
}

func getXunhuQueryURL() string {
	gateway := setting.GetXunhuGatewayUrl()
	if strings.Contains(gateway, "/payment/do.html") {
		return strings.Replace(gateway, "/payment/do.html", "/payment/query.html", 1)
	}
	return "https://api.xunhupay.com/payment/query.html"
}

type xunhuQueryResponse struct {
	Errcode int    `json:"errcode"`
	Errmsg  string `json:"errmsg"`
	Data    struct {
		Status string `json:"status"`
	} `json:"data"`
}

// SyncXunhuTopUpByQuery 主动向虎皮椒查单，已支付则入账（用于回调丢失时补单）
func SyncXunhuTopUpByQuery(tradeNo string, callerIp string) error {
	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil {
		return fmt.Errorf("充值订单不存在")
	}
	if topUp.PaymentProvider != model.PaymentProviderXunhu {
		return fmt.Errorf("非虎皮椒订单")
	}
	if topUp.Status == common.TopUpStatusSuccess {
		return nil
	}
	if topUp.Status != common.TopUpStatusPending {
		return fmt.Errorf("订单状态不是待支付")
	}

	appId, appSecret, ok := setting.GetXunhuCredentials(topUp.PaymentMethod)
	if !ok {
		return fmt.Errorf("虎皮椒渠道凭证未配置")
	}

	params := map[string]string{
		"appid":           appId,
		"out_trade_order": tradeNo,
		"time":            strconv.FormatInt(time.Now().Unix(), 10),
		"nonce_str":       randstr.String(16),
	}
	params["hash"] = generateXunhuHash(params, appSecret)

	body, err := common.Marshal(params)
	if err != nil {
		return err
	}

	req, err := http.NewRequest(http.MethodPost, getXunhuQueryURL(), bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := service.GetHttpClient().Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	var queryResp xunhuQueryResponse
	if err := common.Unmarshal(respBody, &queryResp); err != nil {
		return fmt.Errorf("解析查单响应失败: %w body=%s", err, string(respBody))
	}
	if queryResp.Errcode != 0 {
		return fmt.Errorf("查单失败: %s", queryResp.Errmsg)
	}
	if queryResp.Data.Status != "OD" {
		return fmt.Errorf("虎皮椒订单未支付，状态=%s", queryResp.Data.Status)
	}

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)
	return model.RechargeXunhu(tradeNo, callerIp)
}

type XunhuSyncRequest struct {
	TradeNo string `json:"trade_no"`
}

// RequestXunhuSync 用户侧主动查单入账（回调丢失时的兜底，前端支付后轮询）
func RequestXunhuSync(c *gin.Context) {
	if !isXunhuTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "虎皮椒支付未启用"})
		return
	}

	var req XunhuSyncRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.TradeNo) == "" {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}

	tradeNo := strings.TrimSpace(req.TradeNo)
	userId := c.GetInt("id")
	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil || topUp.UserId != userId {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "订单不存在"})
		return
	}
	if topUp.PaymentProvider != model.PaymentProviderXunhu {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "非虎皮椒订单"})
		return
	}

	if topUp.Status == common.TopUpStatusSuccess {
		c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"status": "success", "paid": true}})
		return
	}

	if err := SyncXunhuTopUpByQuery(tradeNo, c.ClientIP()); err != nil {
		// 未支付属于正常轮询结果，不要当成接口错误刷屏
		if strings.Contains(err.Error(), "未支付") {
			c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"status": "pending", "paid": false}})
			return
		}
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("虎皮椒用户查单失败 user_id=%d trade_no=%s error=%q", userId, tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": err.Error()})
		return
	}

	common.SysLog(fmt.Sprintf("[xunhu-sync] recharge ok user_id=%d trade_no=%s", userId, tradeNo))
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("虎皮椒查单入账成功 user_id=%d trade_no=%s", userId, tradeNo))
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"status": "success", "paid": true}})
}
