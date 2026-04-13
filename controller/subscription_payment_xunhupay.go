package controller

import (
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
)

func SubscriptionRequestXunhuPay(c *gin.Context) {
	var req SubscriptionEpayPayRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.PlanId <= 0 {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	plan, err := model.GetSubscriptionPlanById(req.PlanId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !plan.Enabled {
		common.ApiErrorMsg(c, "套餐未启用")
		return
	}
	if plan.PriceAmount < 0.01 {
		common.ApiErrorMsg(c, "套餐金额过低")
		return
	}
	if !operation_setting.ContainsPayMethod(req.PaymentMethod) {
		common.ApiErrorMsg(c, "支付方式不存在")
		return
	}

	userId := c.GetInt("id")
	if plan.MaxPurchasePerUser > 0 {
		count, err := model.CountUserSubscriptionsByPlan(userId, plan.Id)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if count >= int64(plan.MaxPurchasePerUser) {
			common.ApiErrorMsg(c, "已达到该套餐购买上限")
			return
		}
	}

	if operation_setting.XunhuPayAppId == "" || operation_setting.XunhuPayAppSecret == "" || operation_setting.XunhuPayGateway == "" {
		common.ApiErrorMsg(c, "当前管理员未配置虎皮椒支付信息")
		return
	}

	callBackAddress := service.GetCallbackAddress()
	returnUrl := callBackAddress + "/api/subscription/xunhupay/return"
	notifyUrl := callBackAddress + "/api/subscription/xunhupay/notify"

	tradeNo := fmt.Sprintf("%s%d", common.GetRandomString(6), time.Now().Unix())
	tradeNo = fmt.Sprintf("SUBUSR%dNO%s", userId, tradeNo)

	paymentType := req.PaymentMethod
	if paymentType == "wxpay" {
		paymentType = "wechat"
	}

	nowTime := fmt.Sprintf("%d", time.Now().Unix())
	totalFee := strconv.FormatFloat(plan.PriceAmount, 'f', 2, 64)

	params := map[string]string{
		"version":        "1.1",
		"appid":          operation_setting.XunhuPayAppId,
		"trade_order_id": tradeNo,
		"total_fee":      totalFee,
		"title":          fmt.Sprintf("SUB:%s", plan.Title),
		"time":           nowTime,
		"notify_url":     notifyUrl,
		"return_url":     returnUrl,
		"nonce_str":      common.GetRandomString(16),
		"type":           paymentType,
	}
	params["hash"] = generateXunhuHash(params, operation_setting.XunhuPayAppSecret)

	order := &model.SubscriptionOrder{
		UserId:        userId,
		PlanId:        plan.Id,
		Money:         plan.PriceAmount,
		TradeNo:       tradeNo,
		PaymentMethod: req.PaymentMethod,
		CreateTime:    time.Now().Unix(),
		Status:        common.TopUpStatusPending,
	}
	if err := order.Insert(); err != nil {
		common.ApiErrorMsg(c, "创建订单失败")
		return
	}

	// Build gateway URL
	gateway := operation_setting.XunhuPayGateway
	if !strings.HasSuffix(gateway, "/") && !strings.HasSuffix(gateway, "do.html") {
		gateway += "/"
	}
	if !strings.HasSuffix(gateway, "do.html") {
		gateway += "payment/do.html"
	}

	client := service.GetHttpClient()
	formData := url.Values{}
	for k, v := range params {
		formData.Set(k, v)
	}

	resp, err := client.PostForm(gateway, formData)
	if err != nil {
		_ = model.ExpireSubscriptionOrder(tradeNo)
		common.ApiErrorMsg(c, "网络请求失败，无法拉起支付")
		return
	}
	defer resp.Body.Close()

	var result struct {
		Errcode int    `json:"errcode"`
		Errmsg  string `json:"errmsg"`
		Url     string `json:"url"`
		Hash    string `json:"hash"`
	}
	if err = common.DecodeJson(resp.Body, &result); err != nil {
		_ = model.ExpireSubscriptionOrder(tradeNo)
		common.ApiErrorMsg(c, "支付网关返回格式错误")
		return
	}
	if result.Errcode != 0 {
		_ = model.ExpireSubscriptionOrder(tradeNo)
		common.ApiErrorMsg(c, "拉起支付失败: "+result.Errmsg)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "success", "url": result.Url})
}

func SubscriptionXunhuPayNotify(c *gin.Context) {
	var params map[string]string

	if c.Request.Method == "POST" {
		if err := c.Request.ParseForm(); err != nil {
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

	reqHash := params["hash"]
	if reqHash == "" {
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	sign := generateXunhuHash(params, operation_setting.XunhuPayAppSecret)
	if sign != reqHash {
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	if params["status"] == "OD" {
		tradeNo := params["trade_order_id"]
		LockOrder(tradeNo)
		defer UnlockOrder(tradeNo)

		if err := model.CompleteSubscriptionOrder(tradeNo, common.GetJsonString(params)); err != nil {
			_, _ = c.Writer.Write([]byte("fail"))
			return
		}
	}
	_, _ = c.Writer.Write([]byte("success"))
}

func SubscriptionXunhuPayReturn(c *gin.Context) {
	var params map[string]string

	if c.Request.Method == "POST" {
		if err := c.Request.ParseForm(); err != nil {
			c.Redirect(http.StatusFound, system_setting.ServerAddress+"/console/topup?pay=fail")
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
		c.Redirect(http.StatusFound, system_setting.ServerAddress+"/console/topup?pay=fail")
		return
	}

	reqHash := params["hash"]
	if reqHash == "" {
		c.Redirect(http.StatusFound, system_setting.ServerAddress+"/console/topup?pay=fail")
		return
	}

	sign := generateXunhuHash(params, operation_setting.XunhuPayAppSecret)
	if sign != reqHash {
		c.Redirect(http.StatusFound, system_setting.ServerAddress+"/console/topup?pay=fail")
		return
	}

	if params["status"] == "OD" {
		tradeNo := params["trade_order_id"]
		LockOrder(tradeNo)
		defer UnlockOrder(tradeNo)

		if err := model.CompleteSubscriptionOrder(tradeNo, common.GetJsonString(params)); err != nil {
			c.Redirect(http.StatusFound, system_setting.ServerAddress+"/console/topup?pay=fail")
			return
		}
		c.Redirect(http.StatusFound, system_setting.ServerAddress+"/console/topup?pay=success")
		return
	}
	c.Redirect(http.StatusFound, system_setting.ServerAddress+"/console/topup?pay=pending")
}
