package controller

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/thanhpk/randstr"
)

const (
	PaymentMethodCreem   = "creem"
	CreemSignatureHeader = "creem-signature"
)

var creemAdaptor = &CreemAdaptor{}

// 生成HMAC-SHA256签名
func generateCreemSignature(payload string, secret string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(payload))
	return hex.EncodeToString(h.Sum(nil))
}

// 验证Creem webhook签名
func verifyCreemSignature(payload string, signature string, secret string) bool {
	if secret == "" {
		log.Println(i18n.Translate("topup.creem_webhook_secret_not_set"))
		if setting.CreemTestMode {
			log.Println(i18n.Translate("topup.creem_skip_sign_verify_test_mode"))
			return true
		}
		return false
	}

	expectedSignature := generateCreemSignature(payload, secret)
	return hmac.Equal([]byte(signature), []byte(expectedSignature))
}

type CreemPayRequest struct {
	ProductId     string `json:"product_id"`
	PaymentMethod string `json:"payment_method"`
}

type CreemProduct struct {
	ProductId string  `json:"productId"`
	Name      string  `json:"name"`
	Price     float64 `json:"price"`
	Currency  string  `json:"currency"`
	Quota     int64   `json:"quota"`
}

type CreemAdaptor struct {
}

func (*CreemAdaptor) RequestPay(c *gin.Context, req *CreemPayRequest) {
	if req.PaymentMethod != PaymentMethodCreem {
		c.JSON(200, gin.H{"message": "error", "data": common.TranslateMessage(c, "payment.channel_not_supported")})
		return
	}

	if req.ProductId == "" {
		c.JSON(200, gin.H{"message": "error", "data": common.TranslateMessage(c, "payment.select_product")})
		return
	}

	// 解析产品列表
	var products []CreemProduct
	err := json.Unmarshal([]byte(setting.CreemProducts), &products)
	if err != nil {
		log.Println(i18n.Translate("topup.creem_parse_product_failed"), err)
		c.JSON(200, gin.H{"message": "error", "data": common.TranslateMessage(c, "payment.product_config_error")})
		return
	}

	// 查找对应的产品
	var selectedProduct *CreemProduct
	for _, product := range products {
		if product.ProductId == req.ProductId {
			selectedProduct = &product
			break
		}
	}

	if selectedProduct == nil {
		c.JSON(200, gin.H{"message": "error", "data": common.TranslateMessage(c, "payment.product_not_exists")})
		return
	}

	id := c.GetInt("id")
	user, _ := model.GetUserById(id, false)

	// 生成唯一的订单引用ID
	reference := fmt.Sprintf("creem-api-ref-%d-%d-%s", user.Id, time.Now().UnixMilli(), randstr.String(4))
	referenceId := "ref_" + common.Sha1([]byte(reference))

	// 先创建订单记录，使用产品配置的金额和充值额度
	topUp := &model.TopUp{
		UserId:     id,
		Amount:     selectedProduct.Quota, // 充值额度
		Money:      selectedProduct.Price, // 支付金额
		TradeNo:    referenceId,
		CreateTime: time.Now().Unix(),
		Status:     common.TopUpStatusPending,
	}
	err = topUp.Insert()
	if err != nil {
		log.Printf(i18n.Translate("topup.creem_create_order_failed", map[string]any{"Error": err.Error()}))
		c.JSON(200, gin.H{"message": "error", "data": common.TranslateMessage(c, "payment.create_failed")})
		return
	}

	// 创建支付链接，传入用户邮箱
	checkoutUrl, err := genCreemLink(referenceId, selectedProduct, user.Email, user.Username)
	if err != nil {
		log.Printf(i18n.Translate("topup.creem_get_pay_link_failed", map[string]any{"Error": err.Error()}))
		c.JSON(200, gin.H{"message": "error", "data": common.TranslateMessage(c, "payment.start_failed")})
		return
	}

	log.Printf(i18n.Translate("topup.creem_order_created", map[string]any{"UserId": id, "OrderNo": referenceId, "Product": selectedProduct.Name, "Quota": selectedProduct.Quota, "PayAmount": selectedProduct.Price}))

	c.JSON(200, gin.H{
		"message": "success",
		"data": gin.H{
			"checkout_url": checkoutUrl,
			"order_id":     referenceId,
		},
	})
}

func RequestCreemPay(c *gin.Context) {
	var req CreemPayRequest

	// 读取body内容用于打印，同时保留原始数据供后续使用
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		log.Printf("read creem pay req body err: %v", err)
		c.JSON(200, gin.H{"message": "error", "data": "read query error"})
		return
	}

	// 打印body内容
	log.Printf("creem pay request body: %s", string(bodyBytes))

	// 重新设置body供后续的ShouldBindJSON使用
	c.Request.Body = io.NopCloser(bytes.NewReader(bodyBytes))

	err = c.ShouldBindJSON(&req)
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": common.TranslateMessage(c, "common.invalid_params")})
		return
	}
	creemAdaptor.RequestPay(c, &req)
}

// 新的Creem Webhook结构体，匹配实际的webhook数据格式
type CreemWebhookEvent struct {
	Id        string `json:"id"`
	EventType string `json:"eventType"`
	CreatedAt int64  `json:"created_at"`
	Object    struct {
		Id        string `json:"id"`
		Object    string `json:"object"`
		RequestId string `json:"request_id"`
		Order     struct {
			Object      string `json:"object"`
			Id          string `json:"id"`
			Customer    string `json:"customer"`
			Product     string `json:"product"`
			Amount      int    `json:"amount"`
			Currency    string `json:"currency"`
			SubTotal    int    `json:"sub_total"`
			TaxAmount   int    `json:"tax_amount"`
			AmountDue   int    `json:"amount_due"`
			AmountPaid  int    `json:"amount_paid"`
			Status      string `json:"status"`
			Type        string `json:"type"`
			Transaction string `json:"transaction"`
			CreatedAt   string `json:"created_at"`
			UpdatedAt   string `json:"updated_at"`
			Mode        string `json:"mode"`
		} `json:"order"`
		Product struct {
			Id                string  `json:"id"`
			Object            string  `json:"object"`
			Name              string  `json:"name"`
			Description       string  `json:"description"`
			Price             int     `json:"price"`
			Currency          string  `json:"currency"`
			BillingType       string  `json:"billing_type"`
			BillingPeriod     string  `json:"billing_period"`
			Status            string  `json:"status"`
			TaxMode           string  `json:"tax_mode"`
			TaxCategory       string  `json:"tax_category"`
			DefaultSuccessUrl *string `json:"default_success_url"`
			CreatedAt         string  `json:"created_at"`
			UpdatedAt         string  `json:"updated_at"`
			Mode              string  `json:"mode"`
		} `json:"product"`
		Units    int `json:"units"`
		Customer struct {
			Id        string `json:"id"`
			Object    string `json:"object"`
			Email     string `json:"email"`
			Name      string `json:"name"`
			Country   string `json:"country"`
			CreatedAt string `json:"created_at"`
			UpdatedAt string `json:"updated_at"`
			Mode      string `json:"mode"`
		} `json:"customer"`
		Status   string            `json:"status"`
		Metadata map[string]string `json:"metadata"`
		Mode     string            `json:"mode"`
	} `json:"object"`
}

func CreemWebhook(c *gin.Context) {
	// 读取body内容用于打印，同时保留原始数据供后续使用
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		log.Printf(i18n.Translate("topup.creem_read_body_failed", map[string]any{"Error": err.Error()}))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	// 获取签名头
	signature := c.GetHeader(CreemSignatureHeader)

	// 打印关键信息（避免输出完整敏感payload）
	log.Printf(i18n.Translate("ctrl.creem_webhook_uri"), c.Request.RequestURI)
	if setting.CreemTestMode {
		log.Printf(i18n.Translate("ctrl.creem_webhook_signature_body"), signature, bodyBytes)
	} else if signature == "" {
		log.Printf(i18n.Translate("topup.creem_missing_signature"))
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	// 验证签名
	if !verifyCreemSignature(string(bodyBytes), signature, setting.CreemWebhookSecret) {
		log.Printf(i18n.Translate("topup.creem_sign_failed"))
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	log.Printf(i18n.Translate("topup.creem_sign_verified"))

	// 重新设置body供后续的ShouldBindJSON使用
	c.Request.Body = io.NopCloser(bytes.NewReader(bodyBytes))

	// 解析新格式的webhook数据
	var webhookEvent CreemWebhookEvent
	if err := c.ShouldBindJSON(&webhookEvent); err != nil {
		log.Printf(i18n.Translate("topup.creem_parse_payload_failed", map[string]any{"Error": err.Error()}))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	log.Printf(i18n.Translate("topup.creem_parsed", map[string]any{"EventType": webhookEvent.EventType, "EventId": webhookEvent.Id}))

	// 根据事件类型处理不同的webhook
	switch webhookEvent.EventType {
	case "checkout.completed":
		handleCheckoutCompleted(c, &webhookEvent)
	default:
		log.Printf(i18n.Translate("topup.creem_ignored_event", map[string]any{"EventType": webhookEvent.EventType}))
		c.Status(http.StatusOK)
	}
}

// 处理支付完成事件
func handleCheckoutCompleted(c *gin.Context, event *CreemWebhookEvent) {
	// 验证订单状态
	if event.Object.Order.Status != "paid" {
		log.Printf(i18n.Translate("topup.creem_order_not_paid", map[string]any{"Status": event.Object.Order.Status}))
		c.Status(http.StatusOK)
		return
	}

	// 获取引用ID（这是我们创建订单时传递的request_id）
	referenceId := event.Object.RequestId
	if referenceId == "" {
		log.Println(i18n.Translate("topup.creem_missing_request_id"))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	// Try complete subscription order first
	LockOrder(referenceId)
	defer UnlockOrder(referenceId)
	if err := model.CompleteSubscriptionOrder(referenceId, common.GetJsonString(event)); err == nil {
		c.Status(http.StatusOK)
		return
	} else if err != nil && !errors.Is(err, model.ErrSubscriptionOrderNotFound) {
		log.Printf(i18n.Translate("topup.creem_subscription_failed", map[string]any{"Error": err.Error(), "OrderNo": referenceId}))
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	// 验证订单类型，目前只处理一次性付款（充值）
	if event.Object.Order.Type != "onetime" {
		log.Printf(i18n.Translate("topup.creem_unsupported_order_type", map[string]any{"Type": event.Object.Order.Type}))
		c.Status(http.StatusOK)
		return
	}

	// 记录详细的支付信息
	log.Printf(i18n.Translate("topup.creem_processing_payment", map[string]any{"OrderNo": referenceId, "CreemOrderId": event.Object.Order.Id, "Amount": event.Object.Order.AmountPaid, "Currency": event.Object.Order.Currency, "Product": event.Object.Product.Name}))

	// 查询本地订单确认存在
	topUp := model.GetTopUpByTradeNo(referenceId)
	if topUp == nil {
		log.Printf(i18n.Translate("topup.creem_order_not_found", map[string]any{"OrderNo": referenceId}))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	if topUp.Status != common.TopUpStatusPending {
		log.Printf(i18n.Translate("topup.creem_order_status_error", map[string]any{"OrderNo": referenceId, "Status": topUp.Status}))
		c.Status(http.StatusOK) // 已处理过的订单，返回成功避免重复处理
		return
	}

	// 处理充值，传入客户邮箱和姓名信息
	customerEmail := event.Object.Customer.Email
	customerName := event.Object.Customer.Name

	// 防护性检查，确保邮箱和姓名不为空字符串
	if customerEmail == "" {
		log.Printf(i18n.Translate("topup.creem_customer_email_empty", map[string]any{"OrderNo": referenceId}))
	}
	if customerName == "" {
		log.Printf(i18n.Translate("topup.creem_customer_name_empty", map[string]any{"OrderNo": referenceId}))
	}

	err := model.RechargeCreem(referenceId, customerEmail, customerName)
	if err != nil {
		log.Printf(i18n.Translate("topup.creem_processing_failed", map[string]any{"Error": err.Error(), "OrderNo": referenceId}))
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	log.Printf(i18n.Translate("topup.creem_success", map[string]any{"OrderNo": referenceId, "Quota": topUp.Amount, "PayAmount": topUp.Money}))
	c.Status(http.StatusOK)
}

type CreemCheckoutRequest struct {
	ProductId string `json:"product_id"`
	RequestId string `json:"request_id"`
	Customer  struct {
		Email string `json:"email"`
	} `json:"customer"`
	Metadata map[string]string `json:"metadata,omitempty"`
}

type CreemCheckoutResponse struct {
	CheckoutUrl string `json:"checkout_url"`
	Id          string `json:"id"`
}

func genCreemLink(referenceId string, product *CreemProduct, email string, username string) (string, error) {
	if setting.CreemApiKey == "" {
		return "", fmt.Errorf(i18n.Translate("topup.creem_key_not_configured_fmt"))
	}

	// 根据测试模式选择 API 端点
	apiUrl := "https://api.creem.io/v1/checkouts"
	if setting.CreemTestMode {
		apiUrl = "https://test-api.creem.io/v1/checkouts"
		log.Printf(i18n.Translate("topup.creem_test_env", map[string]any{"Url": apiUrl}))
	}

	// 构建请求数据，确保包含用户邮箱
	requestData := CreemCheckoutRequest{
		ProductId: product.ProductId,
		RequestId: referenceId, // 这个作为订单ID传递给Creem
		Customer: struct {
			Email string `json:"email"`
		}{
			Email: email, // 用户邮箱会在支付页面预填充
		},
		Metadata: map[string]string{
			"username":     username,
			"reference_id": referenceId,
			"product_name": product.Name,
			"quota":        fmt.Sprintf("%d", product.Quota),
		},
	}

	// 序列化请求数据
	jsonData, err := json.Marshal(requestData)
	if err != nil {
		return "", fmt.Errorf(i18n.Translate("topup.creem_marshal_failed", map[string]any{"Error": err.Error()}))
	}

	// 创建 HTTP 请求
	req, err := http.NewRequest("POST", apiUrl, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf(i18n.Translate("topup.creem_create_req_failed", map[string]any{"Error": err.Error()}))
	}

	// 设置请求头
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", setting.CreemApiKey)

	log.Printf(i18n.Translate("topup.creem_send_req", map[string]any{"Url": apiUrl, "ProductId": product.ProductId, "Email": email, "OrderNo": referenceId}))

	// 发送请求
	client := &http.Client{
		Timeout: 30 * time.Second,
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf(i18n.Translate("topup.creem_send_req_failed", map[string]any{"Error": err.Error()}))
	}
	defer resp.Body.Close()

	// 读取响应
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf(i18n.Translate("topup.creem_read_resp_failed", map[string]any{"Error": err.Error()}))
	}

	log.Printf(i18n.Translate("ctrl.creem_api_resp_status_code_resp"), resp.StatusCode, string(body))

	// 检查响应状态
	if resp.StatusCode/100 != 2 {
		return "", fmt.Errorf(i18n.Translate("ctrl.creem_api_http_status"), resp.StatusCode)
	}
	// 解析响应
	var checkoutResp CreemCheckoutResponse
	err = json.Unmarshal(body, &checkoutResp)
	if err != nil {
		return "", fmt.Errorf(i18n.Translate("topup.creem_parse_resp_failed", map[string]any{"Error": err.Error()}))
	}

	if checkoutResp.CheckoutUrl == "" {
		return "", errors.New(i18n.Translate("ctrl.creem_api_resp_no_checkout_url"))
	}

	log.Printf(i18n.Translate("topup.creem_link_created", map[string]any{"OrderNo": referenceId, "PayLink": checkoutResp.CheckoutUrl}))
	return checkoutResp.CheckoutUrl, nil
}
