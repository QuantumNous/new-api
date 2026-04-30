package controller

import (
	"fmt"
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
	"github.com/smartwalle/alipay/v3"
)

// ---- singleton ----

var (
	alipayMu   sync.Mutex
	alipayOnce sync.Once
	alipayInst *alipay.Client
	alipayErr  error
)

func getAlipayClient() (*alipay.Client, error) {
	alipayOnce.Do(func() {
		client, err := alipay.New(setting.AlipayAppId, setting.AlipayPrivateKey, true)
		if err != nil {
			alipayErr = fmt.Errorf("alipay init: %w", err)
			return
		}
		if err := client.LoadAliPayPublicKey(setting.AlipayPublicKey); err != nil {
			alipayErr = fmt.Errorf("alipay pubkey: %w", err)
			return
		}
		alipayInst = client
	})
	return alipayInst, alipayErr
}

// ResetAlipayClient is called when admin saves new Alipay config.
func ResetAlipayClient() {
	alipayMu.Lock()
	defer alipayMu.Unlock()
	alipayOnce = sync.Once{}
	alipayInst = nil
	alipayErr = nil
}

// ---- request/response types ----

type AlipayPayRequest struct {
	Amount int64 `json:"amount"`
}

type AlipayPayResponse struct {
	QRCode  string `json:"qr_code,omitempty"`
	PayURL  string `json:"pay_url,omitempty"`
	TradeNo string `json:"trade_no"`
}

// ---- handlers ----

// RequestAlipay POST /api/user/self/alipay/pay
func RequestAlipay(c *gin.Context) {
	if !isAlipayEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "支付宝直连未配置"})
		return
	}
	var req AlipayPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if req.Amount < int64(setting.AlipayMinTopUp) {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", setting.AlipayMinTopUp)})
		return
	}

	userId := c.GetInt("id")
	group, err := model.GetUserGroup(userId, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}
	payMoney := getPayMoney(req.Amount, group)
	if payMoney < 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	client, err := getAlipayClient()
	if err != nil {
		logger.LogError(c.Request.Context(), "alipay client init: "+err.Error())
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "支付宝服务初始化失败"})
		return
	}

	tradeNo := fmt.Sprintf("ALI%dNO%s%d", userId, common.GetRandomString(6), time.Now().Unix())
	notifyURL := service.GetCallbackAddress() + "/api/alipay/notify"
	returnURL := service.GetCallbackAddress() + "/console/log"
	moneyStr := fmt.Sprintf("%.2f", payMoney)
	subject := fmt.Sprintf("TopUp-%d", req.Amount)

	var qrCode, payURL string
	preParam := alipay.TradePreCreate{}
	preParam.OutTradeNo = tradeNo
	preParam.TotalAmount = moneyStr
	preParam.Subject = subject
	preParam.ProductCode = "FACE_TO_FACE_PAYMENT"
	preParam.NotifyURL = notifyURL
	preRsp, preErr := client.TradePreCreate(c.Request.Context(), preParam)
	if preErr == nil && !preRsp.IsFailure() && strings.TrimSpace(preRsp.QRCode) != "" {
		qrCode = preRsp.QRCode
	} else {
		pageParam := alipay.TradePagePay{}
		pageParam.OutTradeNo = tradeNo
		pageParam.TotalAmount = moneyStr
		pageParam.Subject = subject
		pageParam.ProductCode = "FAST_INSTANT_TRADE_PAY"
		pageParam.NotifyURL = notifyURL
		pageParam.ReturnURL = returnURL
		pageURL, pageErr := client.TradePagePay(pageParam)
		if pageErr != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf("alipay create order failed user=%d trade=%s err=%v", userId, tradeNo, pageErr))
			c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付宝失败"})
			return
		}
		payURL = pageURL.String()
	}

	// amount stored in TopUp: convert if display type is tokens
	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		amount = decimal.NewFromInt(amount).Div(decimal.NewFromFloat(common.QuotaPerUnit)).IntPart()
	}

	topUp := &model.TopUp{
		UserId:          userId,
		Amount:          amount,
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   "alipay",
		PaymentProvider: model.PaymentProviderAlipayDirect,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("alipay insert topup failed user=%d trade=%s err=%v", userId, tradeNo, err))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": AlipayPayResponse{
			QRCode:  qrCode,
			PayURL:  payURL,
			TradeNo: tradeNo,
		},
	})
}

// AlipayNotify POST /api/alipay/notify
func AlipayNotify(c *gin.Context) {
	client, err := getAlipayClient()
	if err != nil {
		logger.LogError(c.Request.Context(), "alipay notify: client not ready: "+err.Error())
		c.String(http.StatusOK, "fail")
		return
	}

	if err := c.Request.ParseForm(); err != nil {
		c.String(http.StatusOK, "fail")
		return
	}

	notification, err := client.DecodeNotification(c.Request.Context(), c.Request.Form)
	if err != nil {
		logger.LogError(c.Request.Context(), "alipay notify decode: "+err.Error())
		c.String(http.StatusOK, "fail")
		return
	}

	if notification.TradeStatus != alipay.TradeStatusSuccess && notification.TradeStatus != alipay.TradeStatusFinished {
		c.String(http.StatusOK, "success") // non-success event, ack to prevent retry
		return
	}

	tradeNo := notification.OutTradeNo
	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)

	callerIp := c.ClientIP()
	if err := model.RechargeAlipay(tradeNo, callerIp); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("alipay recharge failed trade=%s err=%v", tradeNo, err))
		c.String(http.StatusOK, "fail")
		return
	}
	c.String(http.StatusOK, "success")
}

// QueryAlipayOrder GET /api/user/self/alipay/query?trade_no=xxx
func QueryAlipayOrder(c *gin.Context) {
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

	client, err := getAlipayClient()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "success", "data": topUp.Status})
		return
	}

	queryParam := alipay.TradeQuery{}
	queryParam.OutTradeNo = tradeNo
	result, err := client.TradeQuery(c.Request.Context(), queryParam)
	if err != nil || result.IsFailure() {
		c.JSON(http.StatusOK, gin.H{"message": "success", "data": topUp.Status})
		return
	}

	if result.TradeStatus == alipay.TradeStatusSuccess || result.TradeStatus == alipay.TradeStatusFinished {
		LockOrder(tradeNo)
		_ = model.RechargeAlipay(tradeNo, c.ClientIP())
		UnlockOrder(tradeNo)
		topUp = model.GetTopUpByTradeNo(tradeNo)
	}

	status := common.TopUpStatusPending
	if topUp != nil {
		status = topUp.Status
	}
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": status})
}

// CloseExpiredAlipayOrders should be called by a cron task to close stale pending orders.
func CloseExpiredAlipayOrders() {
	if !isAlipayEnabled() {
		return
	}
	client, err := getAlipayClient()
	if err != nil {
		common.SysError("alipay close expired: client not ready: " + err.Error())
		return
	}

	// Find pending orders older than 15 minutes
	cutoff := time.Now().Add(-15 * time.Minute).Unix()
	var orders []model.TopUp
	model.DB.Where("payment_provider = ? AND status = ? AND create_time < ?",
		model.PaymentProviderAlipayDirect, common.TopUpStatusPending, cutoff).Find(&orders)

	for _, order := range orders {
		closeParam := alipay.TradeClose{}
		closeParam.OutTradeNo = order.TradeNo
		_, err := client.TradeClose(nil, closeParam)
		if err != nil && !strings.Contains(err.Error(), "ACQ.TRADE_NOT_EXIST") {
			common.SysError(fmt.Sprintf("alipay close order %s: %v", order.TradeNo, err))
			continue
		}
		_ = model.UpdatePendingTopUpStatus(order.TradeNo, model.PaymentProviderAlipayDirect, common.TopUpStatusExpired)
	}
}
