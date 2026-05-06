package controller

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"github.com/wechatpay-apiv3/wechatpay-go/core"
	"github.com/wechatpay-apiv3/wechatpay-go/core/auth/verifiers"
	"github.com/wechatpay-apiv3/wechatpay-go/core/notify"
	"github.com/wechatpay-apiv3/wechatpay-go/core/option"
	"github.com/wechatpay-apiv3/wechatpay-go/services/payments"
	"github.com/wechatpay-apiv3/wechatpay-go/services/payments/native"
	"github.com/wechatpay-apiv3/wechatpay-go/utils"
)

func init() {
	model.WxpayClientResetHook = ResetWxpayClient
}

// ---- singleton ----

var (
	wxpayMu            sync.Mutex
	wxpayOnce          sync.Once
	wxpayCoreClient    *core.Client
	wxpayNotifyHandler *notify.Handler
	wxpayErr           error
)

type wxpayClients struct {
	client  *core.Client
	handler *notify.Handler
}

func getWxpayClient() (*wxpayClients, error) {
	wxpayOnce.Do(func() {
		cfg := setting.WxpayPrivateKey
		privKey, err := utils.LoadPrivateKey(formatWxpayPEM(cfg, "PRIVATE KEY"))
		if err != nil {
			wxpayErr = fmt.Errorf("wxpay load private key: %w", err)
			return
		}
		pubKey, err := utils.LoadPublicKey(formatWxpayPEM(setting.WxpayPublicKey, "PUBLIC KEY"))
		if err != nil {
			wxpayErr = fmt.Errorf("wxpay load public key: %w", err)
			return
		}
		verifier := verifiers.NewSHA256WithRSAPubkeyVerifier(setting.WxpayPublicKeyId, *pubKey)
		client, err := core.NewClient(context.Background(),
			option.WithMerchantCredential(setting.WxpayMchId, setting.WxpayCertSerial, privKey),
			option.WithVerifier(verifier),
		)
		if err != nil {
			wxpayErr = fmt.Errorf("wxpay init client: %w", err)
			return
		}
		handler, err := notify.NewRSANotifyHandler(setting.WxpayApiV3Key, verifier)
		if err != nil {
			wxpayErr = fmt.Errorf("wxpay init notify handler: %w", err)
			return
		}
		wxpayCoreClient = client
		wxpayNotifyHandler = handler
	})
	if wxpayErr != nil {
		return nil, wxpayErr
	}
	return &wxpayClients{client: wxpayCoreClient, handler: wxpayNotifyHandler}, nil
}

// ResetWxpayClient is called when admin saves new WeChat Pay config.
func ResetWxpayClient() {
	wxpayMu.Lock()
	defer wxpayMu.Unlock()
	wxpayOnce = sync.Once{}
	wxpayCoreClient = nil
	wxpayNotifyHandler = nil
	wxpayErr = nil
}

func formatWxpayPEM(key, keyType string) string {
	key = strings.TrimSpace(key)
	if strings.HasPrefix(key, "-----BEGIN") {
		return key
	}
	return fmt.Sprintf("-----BEGIN %s-----\n%s\n-----END %s-----", keyType, key, keyType)
}

// ---- request/response types ----

type WxpayPayRequest struct {
	Amount int64 `json:"amount"` // display units (same as epay)
}

type WxpayPayResponse struct {
	QRCode  string `json:"qr_code"`
	TradeNo string `json:"trade_no"`
}

// ---- handlers ----

// RequestWxpay POST /api/user/self/wxpay/pay
func RequestWxpay(c *gin.Context) {
	if !isWxpayEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "微信支付未配置"})
		return
	}
	var req WxpayPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if req.Amount < int64(setting.WxpayMinTopUp) {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", setting.WxpayMinTopUp)})
		return
	}

	userId := c.GetInt("id")
	group, err := model.GetUserGroup(userId, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}

	// Pattern C: at most one pending wxpay order per user. Acquire per-user
	// lock + close any prior pending orders before creating a new one.
	LockUserPayCreation(userId, "wxpay")
	defer UnlockUserPayCreation(userId, "wxpay")
	closePendingWxpayForUser(userId)

	// Calculate CNY to charge (direct pay: skip Price for CNY display mode)
	payMoney := getDirectPayMoney(req.Amount, group)
	if payMoney < 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "支付金额无效"})
		return
	}

	// Calculate internal quota to credit based on display type
	dAmount := decimal.NewFromInt(req.Amount)
	dQPU := decimal.NewFromFloat(common.QuotaPerUnit)
	var internalQuota int64
	switch operation_setting.GetQuotaDisplayType() {
	case operation_setting.QuotaDisplayTypeCNY:
		// ¥amount → internal units: amount × QuotaPerUnit ÷ Price
		dPrice := decimal.NewFromFloat(operation_setting.Price)
		internalQuota = dAmount.Mul(dQPU).Div(dPrice).IntPart()
	case operation_setting.QuotaDisplayTypeTokens:
		// tokens = internal quota directly
		internalQuota = req.Amount
	default: // USD, CUSTOM
		internalQuota = dAmount.Mul(dQPU).IntPart()
	}

	clients, err := getWxpayClient()
	if err != nil {
		logger.LogError(c.Request.Context(), "wxpay client init: "+err.Error())
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "微信支付服务初始化失败"})
		return
	}

	tradeNo := fmt.Sprintf("WX%dNO%s%d", userId, common.GetRandomString(6), time.Now().Unix())
	notifyURL := service.GetCallbackAddress() + "/api/wxpay/notify"

	// Convert yuan to fen (WeChat Pay uses integer fen)
	totalFen := int64(payMoney * 100)
	if totalFen <= 0 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "支付金额无效"})
		return
	}

	cur := "CNY"
	svc := native.NativeApiService{Client: clients.client}
	resp, _, err := svc.Prepay(c.Request.Context(), native.PrepayRequest{
		Appid:       core.String(setting.WxpayAppId),
		Mchid:       core.String(setting.WxpayMchId),
		Description: core.String("充值"),
		OutTradeNo:  core.String(tradeNo),
		NotifyUrl:   core.String(notifyURL),
		Amount:      &native.Amount{Total: core.Int64(totalFen), Currency: &cur},
	})
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("wxpay native prepay failed user=%d trade=%s err=%v", userId, tradeNo, err))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起微信支付失败"})
		return
	}

	codeURL := ""
	if resp.CodeUrl != nil {
		codeURL = *resp.CodeUrl
	}
	if codeURL == "" {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "微信支付返回二维码为空"})
		return
	}

	topUp := &model.TopUp{
		UserId:          userId,
		Amount:          internalQuota,
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodWxpay,
		PaymentProvider: model.PaymentProviderWxpayDirect,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("wxpay insert topup failed user=%d trade=%s err=%v", userId, tradeNo, err))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": WxpayPayResponse{
			QRCode:  codeURL,
			TradeNo: tradeNo,
		},
	})
}

// WxpayNotify POST /api/wxpay/notify
func WxpayNotify(c *gin.Context) {
	clients, err := getWxpayClient()
	if err != nil {
		logger.LogError(c.Request.Context(), "wxpay notify: client not ready: "+err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"code": "FAIL", "message": "server error"})
		return
	}

	rawBody, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "FAIL", "message": "read body error"})
		return
	}

	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, "/", io.NopCloser(bytes.NewReader(rawBody)))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "FAIL", "message": "build request error"})
		return
	}
	for k, vals := range c.Request.Header {
		for _, v := range vals {
			req.Header.Add(k, v)
		}
	}

	var tx payments.Transaction
	nr, err := clients.handler.ParseNotifyRequest(c.Request.Context(), req, &tx)
	if err != nil {
		logger.LogError(c.Request.Context(), "wxpay notify parse: "+err.Error())
		c.JSON(http.StatusBadRequest, gin.H{"code": "FAIL", "message": "verify error"})
		return
	}
	if nr.EventType != "TRANSACTION.SUCCESS" {
		c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": "ok"})
		return
	}

	tradeState := ""
	if tx.TradeState != nil {
		tradeState = *tx.TradeState
	}
	if tradeState != "SUCCESS" {
		c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": "ok"})
		return
	}

	tradeNo := ""
	if tx.OutTradeNo != nil {
		tradeNo = *tx.OutTradeNo
	}
	if tradeNo == "" {
		c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": "ok"})
		return
	}

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)

	callerIp := c.ClientIP()
	if err := model.RechargeWxpay(tradeNo, callerIp); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("wxpay recharge failed trade=%s err=%v", tradeNo, err))
		c.JSON(http.StatusInternalServerError, gin.H{"code": "FAIL", "message": "recharge error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": "ok"})
}

// QueryWxpayOrder GET /api/user/self/wxpay/query?trade_no=xxx
func QueryWxpayOrder(c *gin.Context) {
	tradeNo := strings.TrimSpace(c.Query("trade_no"))
	if tradeNo == "" {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "缺少 trade_no"})
		return
	}

	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "订单不存在"})
		return
	}
	if topUp.UserId != c.GetInt("id") {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "无权访问"})
		return
	}

	// Already in terminal state — return immediately
	if topUp.Status == common.TopUpStatusSuccess || topUp.Status == common.TopUpStatusFailed || topUp.Status == common.TopUpStatusExpired {
		c.JSON(http.StatusOK, gin.H{"message": "success", "data": topUp.Status})
		return
	}

	clients, err := getWxpayClient()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "success", "data": topUp.Status})
		return
	}

	svc := native.NativeApiService{Client: clients.client}
	tx, _, err := svc.QueryOrderByOutTradeNo(c.Request.Context(), native.QueryOrderByOutTradeNoRequest{
		OutTradeNo: core.String(tradeNo),
		Mchid:      core.String(setting.WxpayMchId),
	})
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "success", "data": topUp.Status})
		return
	}

	if tx.TradeState != nil && *tx.TradeState == "SUCCESS" {
		LockOrder(tradeNo)
		_ = model.RechargeWxpay(tradeNo, c.ClientIP())
		UnlockOrder(tradeNo)
		topUp = model.GetTopUpByTradeNo(tradeNo)
	}

	status := common.TopUpStatusPending
	if topUp != nil {
		status = topUp.Status
	}
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": status})
}

// closePendingWxpayForUser mirrors closePendingAlipayForUser's two-phase
// async design: capture old trade_nos sync (cheap DB query in hot path),
// fire-and-forget goroutine to mark expired + call upstream close.
func closePendingWxpayForUser(userId int) {
	var oldTradeNos []string
	model.DB.Model(&model.TopUp{}).
		Where("user_id = ? AND payment_provider = ? AND status = ?",
			userId, model.PaymentProviderWxpayDirect, common.TopUpStatusPending).
		Pluck("trade_no", &oldTradeNos)
	if len(oldTradeNos) == 0 {
		return
	}

	go func() {
		for _, tn := range oldTradeNos {
			_ = model.UpdatePendingTopUpStatus(tn, model.PaymentProviderWxpayDirect, common.TopUpStatusExpired)
		}
		clients, err := getWxpayClient()
		if err != nil {
			common.SysLog(fmt.Sprintf("wxpay async close: client not ready: %v", err))
			return
		}
		svc := native.NativeApiService{Client: clients.client}
		for _, tn := range oldTradeNos {
			if _, err := svc.CloseOrder(context.Background(), native.CloseOrderRequest{
				OutTradeNo: core.String(tn),
				Mchid:      core.String(setting.WxpayMchId),
			}); err != nil {
				common.SysLog(fmt.Sprintf("wxpay async close %s: %v", tn, err))
			}
		}
	}()
}

// CloseExpiredWxpayOrders should be called by a cron task to close stale pending orders.
func CloseExpiredWxpayOrders() {
	if !isWxpayEnabled() {
		return
	}
	clients, err := getWxpayClient()
	if err != nil {
		common.SysError("wxpay close expired: client not ready: " + err.Error())
		return
	}

	cutoff := time.Now().Add(-15 * time.Minute).Unix()
	var orders []model.TopUp
	model.DB.Where("payment_provider = ? AND status = ? AND create_time < ?",
		model.PaymentProviderWxpayDirect, common.TopUpStatusPending, cutoff).Find(&orders)

	svc := native.NativeApiService{Client: clients.client}
	for _, order := range orders {
		_, err := svc.CloseOrder(context.Background(), native.CloseOrderRequest{
			OutTradeNo: core.String(order.TradeNo),
			Mchid:      core.String(setting.WxpayMchId),
		})
		if err != nil {
			common.SysError(fmt.Sprintf("wxpay close order %s: %v", order.TradeNo, err))
			continue
		}
		_ = model.UpdatePendingTopUpStatus(order.TradeNo, model.PaymentProviderWxpayDirect, common.TopUpStatusExpired)
	}
}
