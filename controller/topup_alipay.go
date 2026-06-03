package controller

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
	"github.com/shopspring/decimal"
)

type AlipayPayRequest struct {
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"payment_method"`
}

func RequestAlipayPay(c *gin.Context) {
	if !isAlipayTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "Alipay configuration is incomplete"})
		return
	}

	var req AlipayPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if req.PaymentMethod != model.PaymentMethodAlipayOfficial {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "不支持的支付方式"})
		return
	}
	if req.Amount < getMinTopup() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", getMinTopup())})
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

	callbackAddress := service.GetCallbackAddress()
	returnURL := paymentReturnPath("/console/log")
	notifyURL := strings.TrimRight(callbackAddress, "/") + "/api/user/alipay/notify"
	tradeNo := fmt.Sprintf("ALIPAYUSR%dNO%s%s", id, common.GetRandomString(6), strconv.FormatInt(time.Now().Unix(), 10))

	gateway, params, err := service.BuildAlipayPagePay(
		tradeNo,
		payMoney,
		fmt.Sprintf("TUC%d", req.Amount),
		fmt.Sprintf("new-api topup amount=%d", req.Amount),
		returnURL,
		notifyURL,
	)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Alipay create payment params failed user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}

	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dAmount := decimal.NewFromInt(amount)
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		amount = dAmount.Div(dQuotaPerUnit).IntPart()
	}

	topUp := &model.TopUp{
		UserId:          id,
		Amount:          amount,
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodAlipayOfficial,
		PaymentProvider: model.PaymentProviderAlipay,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Alipay create topup order failed user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf(
		"Alipay topup order created user_id=%d trade_no=%s amount=%d money=%.2f gateway=%q params=%q",
		id, tradeNo, req.Amount, payMoney, gateway, common.GetJsonString(params),
	))
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": params, "url": gateway})
}

func AlipayNotify(c *gin.Context) {
	if !isAlipayWebhookEnabled() {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Alipay webhook disabled path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	var params map[string]string
	if c.Request.Method == http.MethodPost {
		if err := c.Request.ParseForm(); err != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf("Alipay webhook parse form failed path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
			_, _ = c.Writer.Write([]byte("fail"))
			return
		}
		params = lo.Reduce(lo.Keys(c.Request.PostForm), func(r map[string]string, t string, i int) map[string]string {
			r[t] = c.Request.PostForm.Get(t)
			return r
		}, map[string]string{})
	} else {
		params = lo.Reduce(lo.Keys(c.Request.URL.Query()), func(r map[string]string, t string, i int) map[string]string {
			r[t] = c.Request.URL.Query().Get(t)
			return r
		}, map[string]string{})
	}

	if len(params) == 0 {
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	if err := service.VerifyAlipayParams(params); err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Alipay webhook signature verification failed path=%q client_ip=%s error=%q params=%q", c.Request.RequestURI, c.ClientIP(), err.Error(), common.GetJsonString(params)))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	tradeStatus := strings.ToUpper(strings.TrimSpace(params["trade_status"]))
	tradeNo := strings.TrimSpace(params["out_trade_no"])
	if tradeNo == "" {
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	if tradeStatus != "TRADE_SUCCESS" && tradeStatus != "TRADE_FINISHED" {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("Alipay webhook ignored non-success status trade_no=%s trade_status=%s client_ip=%s params=%q", tradeNo, tradeStatus, c.ClientIP(), common.GetJsonString(params)))
		_, _ = c.Writer.Write([]byte("success"))
		return
	}

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)

	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Alipay callback order not found trade_no=%s trade_status=%s client_ip=%s params=%q", tradeNo, tradeStatus, c.ClientIP(), common.GetJsonString(params)))
		_, _ = c.Writer.Write([]byte("success"))
		return
	}
	if topUp.PaymentProvider != model.PaymentProviderAlipay {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Alipay order provider mismatch trade_no=%s order_provider=%s trade_status=%s client_ip=%s", tradeNo, topUp.PaymentProvider, tradeStatus, c.ClientIP()))
		_, _ = c.Writer.Write([]byte("success"))
		return
	}

	if topUp.Status == common.TopUpStatusPending {
		topUp.Status = common.TopUpStatusSuccess
		topUp.CompleteTime = common.GetTimestamp()
		if err := topUp.Update(); err != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf("Alipay update topup order failed trade_no=%s user_id=%d client_ip=%s error=%q topup=%q", topUp.TradeNo, topUp.UserId, c.ClientIP(), err.Error(), common.GetJsonString(topUp)))
			_, _ = c.Writer.Write([]byte("fail"))
			return
		}

		dAmount := decimal.NewFromInt(int64(topUp.Amount))
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		quotaToAdd := int(dAmount.Mul(dQuotaPerUnit).IntPart())
		if err := model.IncreaseUserQuota(topUp.UserId, quotaToAdd, true); err != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf("Alipay increase user quota failed trade_no=%s user_id=%d client_ip=%s quota_to_add=%d error=%q topup=%q", topUp.TradeNo, topUp.UserId, c.ClientIP(), quotaToAdd, err.Error(), common.GetJsonString(topUp)))
			_, _ = c.Writer.Write([]byte("fail"))
			return
		}

		logger.LogInfo(c.Request.Context(), fmt.Sprintf("Alipay topup success trade_no=%s user_id=%d client_ip=%s quota_to_add=%d money=%.2f topup=%q", topUp.TradeNo, topUp.UserId, c.ClientIP(), quotaToAdd, topUp.Money, common.GetJsonString(topUp)))
		model.RecordTopupLog(topUp.UserId, fmt.Sprintf("使用支付宝官方充值成功，充值金额: %v，支付金额：%f", logger.LogQuota(quotaToAdd), topUp.Money), c.ClientIP(), topUp.PaymentMethod, model.PaymentMethodAlipayOfficial)
	}

	_, _ = c.Writer.Write([]byte("success"))
}
