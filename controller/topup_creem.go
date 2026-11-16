package controller

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"github.com/thanhpk/randstr"
)

const CreemSignatureHeader = "creem-signature"

var creemAdaptor = &CreemAdaptor{}

// Generate HMAC-SHA256 signature
func generateCreemSignature(payload string, secret string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(payload))
	return hex.EncodeToString(h.Sum(nil))
}

// Verify Creem webhook signature
func verifyCreemSignature(payload string, signature string, secret string) bool {
	if secret == "" {
		logger.LogWarn(context.Background(), common.LogText("Creem webhook secret is not configured test_mode=%t signature=%q body=%q", setting.CreemTestMode, signature, payload))
		if setting.CreemTestMode {
			logger.LogInfo(context.Background(), common.LogText("Creem webhook signature check skipped reason=test_mode signature=%q body=%q", signature, payload))
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
	if req.PaymentMethod != model.PaymentMethodCreem {
		paymentError(c, common.NewMessage("Unsupported payment channel"))
		return
	}

	if req.ProductId == "" {
		paymentError(c, common.NewMessage("Please select a product"))
		return
	}

	// Parse product list
	var products []CreemProduct
	err := json.Unmarshal([]byte(setting.CreemProducts), &products)
	if err != nil {
		logger.LogError(c.Request.Context(), common.LogText("Creem failed to parse product config user_id=%d error=%q", c.GetInt("id"), err.Error()))
		paymentError(c, common.NewMessage("Product configuration error"))
		return
	}

	// Find the corresponding product
	var selectedProduct *CreemProduct
	for _, product := range products {
		if product.ProductId == req.ProductId {
			selectedProduct = &product
			break
		}
	}

	if selectedProduct == nil {
		paymentError(c, common.NewMessage("Product does not exist"))
		return
	}

	id := c.GetInt("id")
	if rejectInvalidCreditedQuota(c, id, decimal.NewFromInt(selectedProduct.Quota)) {
		return
	}

	user, err := model.GetUserById(id, false)
	if err != nil || user == nil {
		paymentError(c, common.NewMessage("User does not exist"))
		return
	}

	// Generate unique order reference ID
	reference := fmt.Sprintf("creem-api-ref-%d-%d-%s", user.Id, time.Now().UnixMilli(), randstr.String(4))
	referenceId := "ref_" + common.Sha1([]byte(reference))

	// First create an order record and use the amount and recharge amount configured for the product
	topUp := &model.TopUp{
		UserId:          id,
		Amount:          selectedProduct.Quota, // Recharge amount
		Money:           selectedProduct.Price, // Payment amount
		TradeNo:         referenceId,
		PaymentMethod:   model.PaymentMethodCreem,
		PaymentProvider: model.PaymentProviderCreem,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	err = topUp.Insert()
	if err != nil {
		logger.LogError(c.Request.Context(), common.LogText("Creem failed to create top-up order user_id=%d trade_no=%s product_id=%s error=%q", id, referenceId, selectedProduct.ProductId, err.Error()))
		paymentError(c, common.NewMessage("Failed to create order"))
		return
	}

	// Create a payment link and send it to the user’s email address
	checkoutUrl, err := genCreemLink(c.Request.Context(), referenceId, selectedProduct, user.Email, user.Username)
	if err != nil {
		logger.LogError(c.Request.Context(), common.LogText("Creem failed to create payment link user_id=%d trade_no=%s product_id=%s error=%q", id, referenceId, selectedProduct.ProductId, err.Error()))
		paymentError(c, common.NewMessage("Failed to start payment"))
		return
	}

	logger.LogInfo(c.Request.Context(), common.LogText("Creem top-up order created user_id=%d trade_no=%s product_id=%s product_name=%q quota=%d money=%.2f", id, referenceId, selectedProduct.ProductId, selectedProduct.Name, selectedProduct.Quota, selectedProduct.Price))

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"checkout_url": checkoutUrl,
			"order_id":     referenceId,
		},
	})
}

func RequestCreemPay(c *gin.Context) {
	var req CreemPayRequest

	// Read the body content for printing while retaining the original data for subsequent use
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		logger.LogError(c.Request.Context(), common.LogText("Creem failed to read payment request error=%q", err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "read query error"})
		return
	}

	logger.LogInfo(c.Request.Context(), common.LogText("Creem payment request received user_id=%d body=%q", c.GetInt("id"), string(bodyBytes)))

	// Reset the body for subsequent ShouldBindJSON use
	c.Request.Body = io.NopCloser(bytes.NewReader(bodyBytes))

	err = c.ShouldBindJSON(&req)
	if err != nil {
		paymentError(c, common.NewMessage("Invalid parameters"))
		return
	}
	creemAdaptor.RequestPay(c, &req)
}

// New Creem Webhook structure, matching actual webhook data format
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
	if !isCreemWebhookEnabled() {
		logger.LogWarn(c.Request.Context(), common.LogText("Creem webhook rejected reason=webhook_disabled path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		c.AbortWithStatus(http.StatusForbidden)
		return
	}

	// Read the body content for printing while retaining the original data for subsequent use
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		logger.LogError(c.Request.Context(), common.LogText("Creem webhook failed to read request body path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	// Get signature header
	signature := c.GetHeader(CreemSignatureHeader)
	logger.LogInfo(c.Request.Context(), common.LogText("Creem webhook received request path=%q client_ip=%s signature=%q body=%q", c.Request.RequestURI, c.ClientIP(), signature, string(bodyBytes)))
	if signature == "" {
		logger.LogWarn(c.Request.Context(), common.LogText("Creem webhook missing signature path=%q client_ip=%s body=%q", c.Request.RequestURI, c.ClientIP(), string(bodyBytes)))
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	// Verify signature
	if !verifyCreemSignature(string(bodyBytes), signature, setting.CreemWebhookSecret) {
		logger.LogWarn(c.Request.Context(), common.LogText("Creem webhook signature verification failed path=%q client_ip=%s signature=%q body=%q", c.Request.RequestURI, c.ClientIP(), signature, string(bodyBytes)))
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	logger.LogInfo(c.Request.Context(), common.LogText("Creem webhook signature verified path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))

	// Reset the body for subsequent ShouldBindJSON use
	c.Request.Body = io.NopCloser(bytes.NewReader(bodyBytes))

	// Parsing the new format of webhook data
	var webhookEvent CreemWebhookEvent
	if err := c.ShouldBindJSON(&webhookEvent); err != nil {
		logger.LogError(c.Request.Context(), common.LogText("Creem webhook failed to parse path=%q client_ip=%s error=%q body=%q", c.Request.RequestURI, c.ClientIP(), err.Error(), string(bodyBytes)))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	logger.LogInfo(c.Request.Context(), common.LogText("Creem webhook parsed event_type=%s event_id=%s request_id=%s order_id=%s order_status=%s", webhookEvent.EventType, webhookEvent.Id, webhookEvent.Object.RequestId, webhookEvent.Object.Order.Id, webhookEvent.Object.Order.Status))

	// Handle different webhooks based on event type
	switch webhookEvent.EventType {
	case "checkout.completed":
		handleCheckoutCompleted(c, &webhookEvent)
	default:
		logger.LogInfo(c.Request.Context(), common.LogText("Creem webhook ignored event event_type=%s event_id=%s", webhookEvent.EventType, webhookEvent.Id))
		c.Status(http.StatusOK)
	}
}

// Handle payment completion events
func handleCheckoutCompleted(c *gin.Context, event *CreemWebhookEvent) {
	// Verify order status
	if event.Object.Order.Status != "paid" {
		logger.LogInfo(c.Request.Context(), common.LogText("Creem order not paid, ignored request_id=%s order_id=%s order_status=%s", event.Object.RequestId, event.Object.Order.Id, event.Object.Order.Status))
		c.Status(http.StatusOK)
		return
	}

	// Get the reference ID (this is the request_id we passed when creating the order)
	referenceId := event.Object.RequestId
	if referenceId == "" {
		logger.LogWarn(c.Request.Context(), common.LogText("Creem webhook missing request_id event_id=%s order_id=%s", event.Id, event.Object.Order.Id))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	// Try complete subscription order first
	LockOrder(referenceId)
	defer UnlockOrder(referenceId)
	if err := model.CompleteSubscriptionOrder(referenceId, common.GetJsonString(event), model.PaymentProviderCreem, ""); err == nil {
		logger.LogInfo(c.Request.Context(), common.LogText("Creem subscription order processed trade_no=%s creem_order_id=%s", referenceId, event.Object.Order.Id))
		c.Status(http.StatusOK)
		return
	} else if err != nil && !errors.Is(err, model.ErrSubscriptionOrderNotFound) {
		logger.LogError(c.Request.Context(), common.LogText("Creem subscription order processing failed trade_no=%s creem_order_id=%s error=%q", referenceId, event.Object.Order.Id, err.Error()))
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	// Verify order type, currently only one-time payment (top-up) is processed
	if event.Object.Order.Type != "onetime" {
		logger.LogInfo(c.Request.Context(), common.LogText("Creem order type not supported, ignored request_id=%s creem_order_id=%s order_type=%s", referenceId, event.Object.Order.Id, event.Object.Order.Type))
		c.Status(http.StatusOK)
		return
	}

	logger.LogInfo(c.Request.Context(), common.LogText("Creem payment completed callback trade_no=%s creem_order_id=%s amount_paid=%d currency=%s product_name=%q customer_email=%q customer_name=%q", referenceId, event.Object.Order.Id, event.Object.Order.AmountPaid, event.Object.Order.Currency, event.Object.Product.Name, event.Object.Customer.Email, event.Object.Customer.Name))

	// Query the existence of local order confirmation
	topUp := model.GetTopUpByTradeNo(referenceId)
	if topUp == nil {
		logger.LogWarn(c.Request.Context(), common.LogText("Creem top-up order not found trade_no=%s creem_order_id=%s", referenceId, event.Object.Order.Id))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	if topUp.Status != common.TopUpStatusPending {
		logger.LogInfo(c.Request.Context(), common.LogText("Creem top-up order not pending, ignored trade_no=%s status=%s creem_order_id=%s", referenceId, topUp.Status, event.Object.Order.Id))
		c.Status(http.StatusOK) // Orders that have been processed, return successfully to avoid repeated processing
		return
	}

	// Process recharge and input customer email and name information
	customerEmail := event.Object.Customer.Email
	customerName := event.Object.Customer.Name

	// Protective check to ensure email and name are not empty strings
	if customerEmail == "" {
		logger.LogWarn(c.Request.Context(), common.LogText("Creem callback customer email is empty trade_no=%s creem_order_id=%s", referenceId, event.Object.Order.Id))
	}
	if customerName == "" {
		logger.LogWarn(c.Request.Context(), common.LogText("Creem callback customer name is empty trade_no=%s creem_order_id=%s", referenceId, event.Object.Order.Id))
	}

	err := model.RechargeCreem(referenceId, customerEmail, customerName, c.ClientIP())
	if err != nil {
		logger.LogError(c.Request.Context(), common.LogText("Creem top-up processing failed trade_no=%s creem_order_id=%s client_ip=%s error=%q", referenceId, event.Object.Order.Id, c.ClientIP(), err.Error()))
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	logger.LogInfo(c.Request.Context(), common.LogText("Creem top-up succeeded trade_no=%s creem_order_id=%s quota=%d money=%.2f client_ip=%s", referenceId, event.Object.Order.Id, topUp.Amount, topUp.Money, c.ClientIP()))
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

func genCreemLink(ctx context.Context, referenceId string, product *CreemProduct, email string, username string) (string, error) {
	if setting.CreemApiKey == "" {
		return "", errors.New("Creem API key is not configured")
	}

	// Select API endpoints based on test patterns
	apiUrl := "https://api.creem.io/v1/checkouts"
	if setting.CreemTestMode {
		apiUrl = "https://test-api.creem.io/v1/checkouts"
		logger.LogInfo(ctx, common.LogText("Creem using test environment api_url=%s", apiUrl))
	}

	// Build the request data, making sure to include the user's email address
	requestData := CreemCheckoutRequest{
		ProductId: product.ProductId,
		RequestId: referenceId, // This is passed to Creem as the order ID
		Customer: struct {
			Email string `json:"email"`
		}{
			Email: email, // User email will be pre-populated on the payment page
		},
		Metadata: map[string]string{
			"username":     username,
			"reference_id": referenceId,
			"product_name": product.Name,
			"quota":        fmt.Sprintf("%d", product.Quota),
		},
	}

	// Serialize request data
	jsonData, err := json.Marshal(requestData)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request data: %v", err)
	}

	// Create HTTP request
	req, err := http.NewRequest("POST", apiUrl, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create HTTP request: %v", err)
	}

	// Set request header
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", setting.CreemApiKey)

	logger.LogInfo(ctx, common.LogText("Creem payment request sent api_url=%s product_id=%s email=%q trade_no=%s", apiUrl, product.ProductId, email, referenceId))

	// Send request
	client := &http.Client{
		Timeout: 30 * time.Second,
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send HTTP request: %v", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %v", err)
	}

	logger.LogInfo(ctx, common.LogText("Creem API response received trade_no=%s status_code=%d body=%q", referenceId, resp.StatusCode, string(body)))

	// Check response status
	if resp.StatusCode/100 != 2 {
		return "", fmt.Errorf("Creem API http status %d ", resp.StatusCode)
	}
	// Parse response
	var checkoutResp CreemCheckoutResponse
	err = json.Unmarshal(body, &checkoutResp)
	if err != nil {
		return "", fmt.Errorf("failed to parse response: %v", err)
	}

	if checkoutResp.CheckoutUrl == "" {
		return "", fmt.Errorf("Creem API resp no checkout url ")
	}

	logger.LogInfo(ctx, common.LogText("Creem payment link created trade_no=%s response_id=%s checkout_url=%q", referenceId, checkoutResp.Id, checkoutResp.CheckoutUrl))
	return checkoutResp.CheckoutUrl, nil
}
