package controller

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"log"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
	"github.com/shopspring/decimal"
)

type XunhuPayRequest struct {
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"payment_method"`
}

func GetXunhuPayMoney(amount int64, group string) float64 {
	return getPayMoney(amount, group)
}

func GetXunhuPayMinTopup() int64 {
	return getMinTopup()
}

func generateXunhuHash(data map[string]string, appSecret string) string {
	keys := make([]string, 0, len(data))
	for k := range data {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var sb strings.Builder
	for _, k := range keys {
		if k == "hash" || data[k] == "" {
			continue
		}
		if sb.Len() > 0 {
			sb.WriteString("&")
		}
		sb.WriteString(k)
		sb.WriteString("=")
		sb.WriteString(data[k])
	}
	sb.WriteString(appSecret)

	h := md5.New()
	h.Write([]byte(sb.String()))
	return hex.EncodeToString(h.Sum(nil))
}

func RequestXunhuPay(c *gin.Context) {
	var req XunhuPayRequest
	err := c.ShouldBindJSON(&req)
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if req.Amount < GetXunhuPayMinTopup() {
		c.JSON(200, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", GetXunhuPayMinTopup())})
		return
	}

	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}
	payMoney := GetXunhuPayMoney(req.Amount, group)
	if payMoney < 0.01 {
		c.JSON(200, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	if !operation_setting.ContainsPayMethod(req.PaymentMethod) {
		c.JSON(200, gin.H{"message": "error", "data": "支付方式不存在"})
		return
	}

	callBackAddress := service.GetCallbackAddress()
	returnUrl := system_setting.ServerAddress + "/console/log"
	notifyUrl := callBackAddress + "/api/user/xunhupay/notify"
	
	tradeNo := fmt.Sprintf("%s%d", common.GetRandomString(6), time.Now().Unix())
	tradeNo = fmt.Sprintf("USR%dNO%s", id, tradeNo)
	
	if operation_setting.XunhuPayAppId == "" || operation_setting.XunhuPayAppSecret == "" || operation_setting.XunhuPayGateway == "" {
		c.JSON(200, gin.H{"message": "error", "data": "当前管理员未配置虎皮椒支付信息"})
		return
	}

	paymentType := req.PaymentMethod
	if paymentType == "wxpay" {
		paymentType = "wechat"
	}

	nowTime := fmt.Sprintf("%d", time.Now().Unix())
	totalFee := strconv.FormatFloat(payMoney, 'f', 2, 64)
	
	params := map[string]string{
		"version":        "1.1",
		"appid":          operation_setting.XunhuPayAppId,
		"trade_order_id": tradeNo,
		"total_fee":      totalFee,
		"title":          fmt.Sprintf("TUC%d", req.Amount),
		"time":           nowTime,
		"notify_url":     notifyUrl,
		"return_url":     returnUrl,
		"nonce_str":      common.GetRandomString(16),
		"type":           paymentType,
	}
	params["hash"] = generateXunhuHash(params, operation_setting.XunhuPayAppSecret)

	// Send request to gateway
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
		c.JSON(200, gin.H{"message": "error", "data": "网络请求失败，无法拉起微信/支付宝支付"})
		return
	}
	defer resp.Body.Close()

	var result struct {
		Errcode int    `json:"errcode"`
		Errmsg  string `json:"errmsg"`
		Url     string `json:"url"`
		Hash    string `json:"hash"`
	}
	err = common.DecodeJson(resp.Body, &result)
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "支付网关返回格式错误"})
		return
	}
	if result.Errcode != 0 {
		c.JSON(200, gin.H{"message": "error", "data": "拉起支付失败: " + result.Errmsg})
		return
	}

	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dAmount := decimal.NewFromInt(int64(amount))
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		amount = dAmount.Div(dQuotaPerUnit).IntPart()
	}
	topUp := &model.TopUp{
		UserId:        id,
		Amount:        amount,
		Money:         payMoney,
		TradeNo:       tradeNo,
		PaymentMethod: req.PaymentMethod,
		CreateTime:    time.Now().Unix(),
		Status:        "pending",
	}
	err = topUp.Insert()
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}
	
	// Data here is the form hidden inputs, not needed for url redirect mode. Just return URL.
	c.JSON(200, gin.H{"message": "success", "url": result.Url})
}

func XunhuPayNotify(c *gin.Context) {
	var params map[string]string

	if c.Request.Method == "POST" {
		if err := c.Request.ParseForm(); err != nil {
			log.Println("虎皮椒回调POST解析失败:", err)
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
		log.Println("虎皮椒回调参数为空")
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
		log.Println("虎皮椒回调签名验证失败")
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	status := params["status"]
	if status == "OD" {
		tradeNo := params["trade_order_id"]
		LockOrder(tradeNo)
		defer UnlockOrder(tradeNo)
		topUp := model.GetTopUpByTradeNo(tradeNo)
		if topUp == nil {
			log.Printf("虎皮椒回调未找到订单: %v", tradeNo)
			_, _ = c.Writer.Write([]byte("success"))
			return
		}
		if topUp.Status == "pending" {
			topUp.Status = "success"
			err := topUp.Update()
			if err != nil {
				log.Printf("虎皮椒回调更新订单失败: %v", topUp)
				return
			}
			dAmount := decimal.NewFromInt(int64(topUp.Amount))
			dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
			quotaToAdd := int(dAmount.Mul(dQuotaPerUnit).IntPart())
			err = model.IncreaseUserQuota(topUp.UserId, quotaToAdd, true)
			if err != nil {
				log.Printf("虎皮椒回调更新用户失败: %v", topUp)
				return
			}
			model.RecordLog(topUp.UserId, model.LogTypeTopup, fmt.Sprintf("使用虎皮椒充值成功，充值金额: %v，支付金额：%f", logger.LogQuota(quotaToAdd), topUp.Money))
		}
		_, _ = c.Writer.Write([]byte("success"))
	} else {
		log.Printf("虎皮椒未完成回调状态: %s", status)
		_, _ = c.Writer.Write([]byte("success"))
	}
}
