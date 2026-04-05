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
		log.Printf("Creem webhook secret not set")
		if setting.CreemTestMode {
			log.Printf("Skip Creem webhook sign verify in test mode")
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
		c.JSON(200, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentMethodNotExists)})
		return
	}

	if req.ProductId == "" {
		c.JSON(200, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentProductRequired)})
		return
	}

	// 解析产品列表
	var products []CreemProduct
	err := json.Unmarshal([]byte(setting.CreemProducts), &products)
	if err != nil {
		log.Println("failed to parse Creem product list", err)
		c.JSON(200, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentNotConfigured)})
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
		c.JSON(200, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentProductNotFound)})
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
		log.Printf("failed to create Creem order: %v", err)
		c.JSON(200, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentCreateFailed)})
		return
	}

	// 创建支付链接，传入用户邮箱
	checkoutUrl, err := genCreemLink(referenceId, selectedProduct, user.Email, user.Username)
	if err != nil {
		log.Printf("failed to get Creem checkout url: %v", err)
		c.JSON(200, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentStartFailed)})
		return
	}

	log.Printf("Creem order created successfully - user ID: %d, order no: %s, product: %s, top-up quota: %d, paid amount: %.2f",
		id, referenceId, selectedProduct.Name, selectedProduct.Quota, selectedProduct.Price)

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
		c.JSON(200, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgInvalidParams)})
		return
	}

	// 打印body内容
	log.Printf("creem pay request body: %s", string(bodyBytes))

	// 重新设置body供后续的ShouldBindJSON使用
	c.Request.Body = io.NopCloser(bytes.NewReader(bodyBytes))

	err = c.ShouldBindJSON(&req)
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgInvalidParams)})
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
		log.Printf("failed to read Creem webhook request body: %v", err)
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	// 获取签名头
	signature := c.GetHeader(CreemSignatureHeader)

	// 打印关键信息（避免输出完整敏感payload）
	log.Printf("Creem Webhook - URI: %s", c.Request.RequestURI)
	if setting.CreemTestMode {
		log.Printf("Creem Webhook - Signature: %s , Body: %s", signature, bodyBytes)
	} else if signature == "" {
		log.Printf("Creem webhook missing signature header")
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	// 验证签名
	if !verifyCreemSignature(string(bodyBytes), signature, setting.CreemWebhookSecret) {
		log.Printf("Creem webhook signature verification failed")
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	log.Printf("Creem webhook signature verification succeeded")

	// 重新设置body供后续的ShouldBindJSON使用
	c.Request.Body = io.NopCloser(bytes.NewReader(bodyBytes))

	// 解析新格式的webhook数据
	var webhookEvent CreemWebhookEvent
	if err := c.ShouldBindJSON(&webhookEvent); err != nil {
		log.Printf("failed to parse Creem webhook payload: %v", err)
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	log.Printf("Creem webhook parsed successfully - event type: %s, event id: %s", webhookEvent.EventType, webhookEvent.Id)

	// 根据事件类型处理不同的webhook
	switch webhookEvent.EventType {
	case "checkout.completed":
		handleCheckoutCompleted(c, &webhookEvent)
	default:
		log.Printf("ignoring Creem webhook event type: %s", webhookEvent.EventType)
		c.Status(http.StatusOK)
	}
}

// 处理支付完成事件
func handleCheckoutCompleted(c *gin.Context, event *CreemWebhookEvent) {
	// 验证订单状态
	if event.Object.Order.Status != "paid" {
		log.Printf("order status is not paid: %s, skipping", event.Object.Order.Status)
		c.Status(http.StatusOK)
		return
	}

	// 获取引用ID（这是我们创建订单时传递的request_id）
	referenceId := event.Object.RequestId
	if referenceId == "" {
		log.Println("Creem webhook missing request_id field")
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
		log.Printf("failed to process Creem subscription order: %s, order no: %s", err.Error(), referenceId)
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	// 验证订单类型，目前只处理一次性付款（充值）
	if event.Object.Order.Type != "onetime" {
		log.Printf("unsupported order type for now: %s, skipping", event.Object.Order.Type)
		c.Status(http.StatusOK)
		return
	}

	// 记录详细的支付信息
	log.Printf("processing Creem payment completion - order no: %s, Creem order ID: %s, paid amount: %d %s, customer email: <redacted>, product: %s",
		referenceId,
		event.Object.Order.Id,
		event.Object.Order.AmountPaid,
		event.Object.Order.Currency,
		event.Object.Product.Name)

	// 查询本地订单确认存在
	topUp := model.GetTopUpByTradeNo(referenceId)
	if topUp == nil {
		log.Printf("Creem top-up order not found: %s", referenceId)
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	if topUp.Status != common.TopUpStatusPending {
		log.Printf("Creem top-up order status invalid: %s, current status: %s", referenceId, topUp.Status)
		c.Status(http.StatusOK) // 已处理过的订单，返回成功避免重复处理
		return
	}

	// 处理充值，传入客户邮箱和姓名信息
	customerEmail := event.Object.Customer.Email
	customerName := event.Object.Customer.Name

	// 防护性检查，确保邮箱和姓名不为空字符串
	if customerEmail == "" {
		log.Printf("warning: customer email is empty in Creem callback - order no: %s", referenceId)
	}
	if customerName == "" {
		log.Printf("warning: customer name is empty in Creem callback - order no: %s", referenceId)
	}

	err := model.RechargeCreem(referenceId, customerEmail, customerName)
	if err != nil {
		log.Printf("Creem top-up processing failed: %s, order no: %s", err.Error(), referenceId)
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	log.Printf("Creem top-up succeeded - order no: %s, top-up quota: %d, paid amount: %.2f",
		referenceId, topUp.Amount, topUp.Money)
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
		return "", fmt.Errorf("creem api key is not configured")
	}

	// 根据测试模式选择 API 端点
	apiUrl := "https://api.creem.io/v1/checkouts"
	if setting.CreemTestMode {
		apiUrl = "https://test-api.creem.io/v1/checkouts"
		log.Printf("using Creem test environment: %s", apiUrl)
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
		return "", fmt.Errorf("failed to marshal request data: %w", err)
	}

	// 创建 HTTP 请求
	req, err := http.NewRequest("POST", apiUrl, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create http request: %w", err)
	}

	// 设置请求头
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", setting.CreemApiKey)

	log.Printf("sending Creem payment request - URL: %s, product ID: %s, user email: %s, order no: %s",
		apiUrl, product.ProductId, email, referenceId)

	// 发送请求
	client := &http.Client{
		Timeout: 30 * time.Second,
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send http request: %w", err)
	}
	defer resp.Body.Close()

	// 读取响应
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %w", err)
	}

	log.Printf("Creem API resp - status code: %d, resp: %s", resp.StatusCode, string(body))

	// 检查响应状态
	if resp.StatusCode/100 != 2 {
		return "", fmt.Errorf("Creem API http status %d ", resp.StatusCode)
	}
	// 解析响应
	var checkoutResp CreemCheckoutResponse
	err = json.Unmarshal(body, &checkoutResp)
	if err != nil {
		return "", fmt.Errorf("failed to parse response: %w", err)
	}

	if checkoutResp.CheckoutUrl == "" {
		return "", fmt.Errorf("Creem API resp no checkout url ")
	}

	log.Printf("Creem checkout url created successfully - order no: %s, checkout url: %s", referenceId, checkoutResp.CheckoutUrl)
	return checkoutResp.CheckoutUrl, nil
}
