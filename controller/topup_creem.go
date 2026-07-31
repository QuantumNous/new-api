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
	"io"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/thanhpk/randstr"
)

const CreemSignatureHeader = "creem-signature"

var creemAdaptor = &CreemAdaptor{}

type creemConfigSnapshot struct {
	ApiKey        string
	Products      string
	TestMode      bool
	WebhookSecret string
}

func currentCreemConfig() creemConfigSnapshot {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	return creemConfigSnapshot{
		ApiKey:        setting.CreemApiKey,
		Products:      setting.CreemProducts,
		TestMode:      setting.CreemTestMode,
		WebhookSecret: setting.CreemWebhookSecret,
	}
}

func generateCreemSignature(payload string, secret string) string {
	h := hmac.New(sha256.New, []byte(secret))
	_, _ = h.Write([]byte(payload))
	return hex.EncodeToString(h.Sum(nil))
}

func verifyCreemSignature(payload string, signature string, secret string) bool {
	if strings.TrimSpace(secret) == "" {
		logger.LogError(context.Background(), fmt.Sprintf("Creem webhook rejected: webhook secret missing test_mode=%t", currentCreemConfig().TestMode))
		return false
	}
	expected, err := hex.DecodeString(generateCreemSignature(payload, secret))
	if err != nil {
		return false
	}
	provided, err := hex.DecodeString(strings.TrimSpace(signature))
	return err == nil && hmac.Equal(provided, expected)
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
	Popular   bool    `json:"popular,omitempty"`
}

type CreemAdaptor struct{}

func parseCreemProducts(raw string) ([]CreemProduct, error) {
	var products []CreemProduct
	if err := common.UnmarshalJsonStr(raw, &products); err != nil {
		return nil, err
	}
	for _, product := range products {
		if strings.TrimSpace(product.ProductId) == "" || strings.TrimSpace(product.Name) == "" || product.Price <= 0 || product.Price > float64(math.MaxInt64)/100 || product.Quota <= 0 || strings.TrimSpace(product.Currency) == "" {
			return nil, errors.New("invalid Creem product catalog entry")
		}
	}
	return products, nil
}

func (*CreemAdaptor) RequestPay(c *gin.Context, req *CreemPayRequest) {
	if req.PaymentMethod != model.PaymentMethodCreem || req.ProductId == "" {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "invalid Creem payment request"})
		return
	}
	config := currentCreemConfig()
	products, err := parseCreemProducts(config.Products)
	if err != nil {
		common.ApiErrorMsg(c, "Creem product configuration is invalid")
		return
	}
	var selected *CreemProduct
	for i := range products {
		if products[i].ProductId == req.ProductId {
			selected = &products[i]
			break
		}
	}
	if selected == nil {
		common.ApiErrorMsg(c, "Creem product does not exist")
		return
	}
	userId := c.GetInt("id")
	user, err := model.GetUserById(userId, false)
	if err != nil || user == nil {
		common.ApiErrorMsg(c, "user does not exist")
		return
	}
	reference := fmt.Sprintf("creem-api-ref-%d-%d-%s", user.Id, time.Now().UnixMilli(), randstr.String(4))
	referenceId := "ref_" + common.Sha1([]byte(reference))
	expectedAmountMinor := int64(math.Round(selected.Price * 100))
	topUp := &model.TopUp{UserId: userId, Amount: selected.Quota, Money: selected.Price, TradeNo: referenceId, PaymentMethod: model.PaymentMethodCreem, PaymentProvider: model.PaymentProviderCreem, CreateTime: time.Now().Unix(), Status: common.TopUpStatusPending, ContractSnapshot: true, ExpectedProviderProductId: selected.ProductId, ExpectedAmountMinor: expectedAmountMinor, ExpectedCurrency: selected.Currency}
	if err := topUp.Insert(); err != nil {
		common.ApiErrorMsg(c, "failed to create order")
		return
	}
	checkoutURL, err := genCreemLink(c.Request.Context(), referenceId, selected, user.Email, user.Username, config)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Creem checkout creation failed trade_no=%s product_id=%s error=%q", referenceId, selected.ProductId, err.Error()))
		common.ApiErrorMsg(c, "failed to create checkout")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"checkout_url": checkoutURL, "order_id": referenceId}})
}

func RequestCreemPay(c *gin.Context) {
	var req CreemPayRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "invalid parameters"})
		return
	}
	creemAdaptor.RequestPay(c, &req)
}

type flexibleCreemID string

func (id *flexibleCreemID) UnmarshalJSON(data []byte) error {
	var text string
	if err := common.Unmarshal(data, &text); err == nil {
		*id = flexibleCreemID(text)
		return nil
	}
	var object struct {
		Id string `json:"id"`
	}
	if err := common.Unmarshal(data, &object); err != nil {
		return err
	}
	*id = flexibleCreemID(object.Id)
	return nil
}

type flexibleCreemEntity struct {
	Id       string
	Name     string
	Email    string
	Price    int64
	Currency string
}

type flexibleCreemTransaction struct {
	Id         string
	Amount     int64
	AmountPaid int64
	Currency   string
}

func (transaction *flexibleCreemTransaction) UnmarshalJSON(data []byte) error {
	var text string
	if err := common.Unmarshal(data, &text); err == nil {
		transaction.Id = text
		return nil
	}
	var object struct {
		Id         string `json:"id"`
		Amount     int64  `json:"amount"`
		AmountPaid int64  `json:"amount_paid"`
		Currency   string `json:"currency"`
	}
	if err := common.Unmarshal(data, &object); err != nil {
		return err
	}
	transaction.Id, transaction.Amount, transaction.AmountPaid, transaction.Currency = object.Id, object.Amount, object.AmountPaid, object.Currency
	if transaction.AmountPaid > 0 {
		transaction.Amount = transaction.AmountPaid
	}
	return nil
}

func (entity *flexibleCreemEntity) UnmarshalJSON(data []byte) error {
	var text string
	if err := common.Unmarshal(data, &text); err == nil {
		entity.Id = text
		return nil
	}
	var object struct {
		Id       string `json:"id"`
		Name     string `json:"name"`
		Email    string `json:"email"`
		Price    int64  `json:"price"`
		Currency string `json:"currency"`
	}
	if err := common.Unmarshal(data, &object); err != nil {
		return err
	}
	entity.Id, entity.Name, entity.Email, entity.Price, entity.Currency = object.Id, object.Name, object.Email, object.Price, object.Currency
	return nil
}

type creemTimestamp int64

func (timestamp *creemTimestamp) UnmarshalJSON(data []byte) error {
	var number json.Number
	if err := common.Unmarshal(data, &number); err == nil {
		value, err := strconv.ParseInt(number.String(), 10, 64)
		if err == nil {
			if value >= 1_000_000_000_000 {
				value /= 1000
			}
			*timestamp = creemTimestamp(value)
			return nil
		}
	}
	var text string
	if err := common.Unmarshal(data, &text); err != nil {
		return err
	}
	if text == "" {
		return nil
	}
	if value, err := strconv.ParseInt(text, 10, 64); err == nil {
		if value >= 1_000_000_000_000 {
			value /= 1000
		}
		*timestamp = creemTimestamp(value)
		return nil
	}
	value, err := time.Parse(time.RFC3339, text)
	if err != nil {
		return err
	}
	*timestamp = creemTimestamp(value.Unix())
	return nil
}

type creemEventTimestamp int64

func (timestamp *creemEventTimestamp) UnmarshalJSON(data []byte) error {
	var number json.Number
	if err := common.Unmarshal(data, &number); err == nil {
		value, err := strconv.ParseInt(number.String(), 10, 64)
		if err == nil {
			if value < 1_000_000_000_000 {
				value *= 1000
			}
			*timestamp = creemEventTimestamp(value)
			return nil
		}
	}
	var text string
	if err := common.Unmarshal(data, &text); err != nil {
		return err
	}
	if text == "" {
		return nil
	}
	if value, err := strconv.ParseInt(text, 10, 64); err == nil {
		if value < 1_000_000_000_000 {
			value *= 1000
		}
		*timestamp = creemEventTimestamp(value)
		return nil
	}
	value, err := time.Parse(time.RFC3339, text)
	if err != nil {
		return err
	}
	*timestamp = creemEventTimestamp(value.UnixMilli())
	return nil
}

type creemOrder struct {
	Id          string              `json:"id"`
	Status      string              `json:"status"`
	Type        string              `json:"type"`
	Transaction flexibleCreemID     `json:"transaction"`
	Product     flexibleCreemEntity `json:"product"`
	Amount      int64               `json:"amount"`
	AmountPaid  int64               `json:"amount_paid"`
	Currency    string              `json:"currency"`
}

type creemSubscription struct {
	Id                 string                   `json:"id"`
	Product            flexibleCreemID          `json:"product"`
	Customer           flexibleCreemID          `json:"customer"`
	Status             string                   `json:"status"`
	LastTransactionId  string                   `json:"last_transaction_id"`
	LastTransaction    flexibleCreemTransaction `json:"last_transaction"`
	CurrentPeriodStart creemTimestamp           `json:"current_period_start_date"`
	CurrentPeriodEnd   creemTimestamp           `json:"current_period_end_date"`
	Metadata           map[string]any           `json:"metadata"`
}

type creemWebhookObject struct {
	Id                 string                   `json:"id"`
	RequestId          string                   `json:"request_id"`
	Status             string                   `json:"status"`
	Order              creemOrder               `json:"order"`
	Product            flexibleCreemEntity      `json:"product"`
	Customer           flexibleCreemEntity      `json:"customer"`
	Subscription       json.RawMessage          `json:"subscription"`
	Transaction        flexibleCreemID          `json:"transaction"`
	LastTransactionId  string                   `json:"last_transaction_id"`
	LastTransaction    flexibleCreemTransaction `json:"last_transaction"`
	CurrentPeriodStart creemTimestamp           `json:"current_period_start_date"`
	CurrentPeriodEnd   creemTimestamp           `json:"current_period_end_date"`
	Metadata           map[string]any           `json:"metadata"`
	Amount             int64                    `json:"amount"`
	Currency           string                   `json:"currency"`
}

type CreemWebhookPayload struct {
	Id        string              `json:"id"`
	EventType string              `json:"eventType"`
	CreatedAt creemEventTimestamp `json:"created_at"`
	Object    creemWebhookObject  `json:"object"`
}

func metadataString(metadata map[string]any, key string) string {
	value, ok := metadata[key].(string)
	if !ok {
		return ""
	}
	return strings.TrimSpace(value)
}

func creemPayloadHash(body []byte) string {
	return hex.EncodeToString(common.Sha256Raw(body))
}

func creemOnetimePaymentInput(event *CreemWebhookPayload, body []byte) model.CreemPaymentInput {
	amount := event.Object.Order.AmountPaid
	if amount == 0 {
		amount = event.Object.Order.Amount
	}
	if amount == 0 {
		amount = event.Object.Amount
	}
	if amount == 0 {
		amount = event.Object.Order.Product.Price
	}
	if amount == 0 {
		amount = event.Object.Product.Price
	}
	currency := event.Object.Order.Currency
	if currency == "" {
		currency = event.Object.Currency
	}
	if currency == "" {
		currency = event.Object.Order.Product.Currency
	}
	if currency == "" {
		currency = event.Object.Product.Currency
	}
	productId := event.Object.Order.Product.Id
	if productId == "" {
		productId = event.Object.Product.Id
	}
	return model.CreemPaymentInput{EventId: event.Id, EventType: event.EventType, PayloadHash: creemPayloadHash(body), TradeNo: event.Object.RequestId, OrderId: event.Object.Order.Id, TransactionId: string(event.Object.Order.Transaction), ProductId: productId, Amount: amount, Currency: currency, EventCreatedAt: int64(event.CreatedAt)}
}

func creemFinancialSubscriptionId(raw json.RawMessage) string {
	if len(raw) == 0 || string(raw) == "null" {
		return ""
	}
	var id flexibleCreemID
	if err := common.Unmarshal(raw, &id); err != nil {
		return ""
	}
	return string(id)
}

func (event *CreemWebhookPayload) subscription() (creemSubscription, error) {
	if strings.HasPrefix(event.EventType, "subscription.") {
		return creemSubscription{Id: event.Object.Id, Product: flexibleCreemID(event.Object.Product.Id), Customer: flexibleCreemID(event.Object.Customer.Id), Status: event.Object.Status, LastTransactionId: event.Object.LastTransactionId, LastTransaction: event.Object.LastTransaction, CurrentPeriodStart: event.Object.CurrentPeriodStart, CurrentPeriodEnd: event.Object.CurrentPeriodEnd, Metadata: event.Object.Metadata}, nil
	}
	var subscription creemSubscription
	if len(event.Object.Subscription) == 0 || string(event.Object.Subscription) == "null" {
		return subscription, errors.New("missing subscription")
	}
	if err := common.Unmarshal(event.Object.Subscription, &subscription); err == nil && subscription.Id != "" {
		return subscription, nil
	}
	var id flexibleCreemID
	if err := common.Unmarshal(event.Object.Subscription, &id); err != nil {
		return subscription, err
	}
	subscription.Id = string(id)
	return subscription, nil
}

func creemPaymentInput(event *CreemWebhookPayload, body []byte, subscription creemSubscription) model.CreemPaymentInput {
	transactionId := subscription.LastTransactionId
	if transactionId == "" {
		transactionId = subscription.LastTransaction.Id
	}
	if transactionId == "" {
		transactionId = string(event.Object.Order.Transaction)
	}
	tradeNo := event.Object.RequestId
	if tradeNo == "" {
		tradeNo = metadataString(subscription.Metadata, "trade_no")
	}
	if tradeNo == "" {
		tradeNo = metadataString(subscription.Metadata, "reference_id")
	}
	status := subscription.Status
	if strings.HasPrefix(event.EventType, "subscription.") && event.EventType != "subscription.update" && event.EventType != "subscription.paid" {
		status = strings.TrimPrefix(event.EventType, "subscription.")
	}
	if status == "" && event.EventType == "subscription.paid" {
		status = "active"
	}
	amount, currency := event.Object.Order.AmountPaid, event.Object.Order.Currency
	if amount == 0 {
		amount = event.Object.Order.Amount
	}
	if amount == 0 {
		amount = event.Object.Amount
	}
	if amount == 0 {
		amount = subscription.LastTransaction.Amount
	}
	if amount == 0 {
		amount = event.Object.Product.Price
	}
	if currency == "" {
		currency = event.Object.Currency
	}
	if currency == "" {
		currency = subscription.LastTransaction.Currency
	}
	if currency == "" {
		currency = event.Object.Product.Currency
	}
	return model.CreemPaymentInput{EventId: event.Id, EventType: event.EventType, PayloadHash: creemPayloadHash(body), TradeNo: tradeNo, OrderId: event.Object.Order.Id, SubscriptionId: subscription.Id, TransactionId: transactionId, CustomerId: string(subscription.Customer), ProductId: string(subscription.Product), ProviderStatus: status, Currency: currency, Amount: amount, PeriodStart: int64(subscription.CurrentPeriodStart), PeriodEnd: int64(subscription.CurrentPeriodEnd), EventCreatedAt: int64(event.CreatedAt)}
}

func creemWebhookSummary(event *CreemWebhookPayload, input model.CreemPaymentInput) (string, error) {
	summary := struct {
		EventId        string `json:"event_id"`
		EventType      string `json:"event_type"`
		OrderId        string `json:"order_id"`
		SubscriptionId string `json:"subscription_id"`
		TransactionId  string `json:"transaction_id"`
		ProductId      string `json:"product_id"`
		Amount         int64  `json:"amount"`
		Currency       string `json:"currency"`
		PeriodStart    int64  `json:"period_start"`
		PeriodEnd      int64  `json:"period_end"`
		TradeNo        string `json:"trade_no"`
	}{
		EventId:        event.Id,
		EventType:      event.EventType,
		OrderId:        input.OrderId,
		SubscriptionId: input.SubscriptionId,
		TransactionId:  input.TransactionId,
		ProductId:      input.ProductId,
		Amount:         input.Amount,
		Currency:       input.Currency,
		PeriodStart:    input.PeriodStart,
		PeriodEnd:      input.PeriodEnd,
		TradeNo:        input.TradeNo,
	}
	encoded, err := common.Marshal(summary)
	return string(encoded), err
}

func CreemWebhook(c *gin.Context) {
	config := currentCreemConfig()
	if !isPaymentComplianceConfirmed() || strings.TrimSpace(config.ApiKey) == "" || strings.TrimSpace(config.WebhookSecret) == "" {
		logger.LogError(c.Request.Context(), "Creem webhook rejected: webhook configuration incomplete")
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	if !verifyCreemSignature(string(body), c.GetHeader(CreemSignatureHeader), config.WebhookSecret) {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}
	var event CreemWebhookPayload
	if err := common.Unmarshal(body, &event); err != nil || event.Id == "" || event.EventType == "" {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	input := model.CreemPaymentInput{EventId: event.Id, EventType: event.EventType, PayloadHash: creemPayloadHash(body)}
	switch event.EventType {
	case "checkout.completed":
		if event.Object.Order.Status != "paid" {
			_ = model.RecordCreemInformationalEvent(input)
			c.Status(http.StatusOK)
			return
		}
		referenceId := strings.TrimSpace(event.Object.RequestId)
		if referenceId == "" {
			c.AbortWithStatus(http.StatusBadRequest)
			return
		}
		LockOrder(referenceId)
		defer UnlockOrder(referenceId)
		if model.GetSubscriptionOrderByTradeNo(referenceId) != nil {
			subscription, err := event.subscription()
			if err != nil {
				c.AbortWithStatus(http.StatusInternalServerError)
				return
			}
			input = creemPaymentInput(&event, body, subscription)
			providerSummary, err := creemWebhookSummary(&event, input)
			if err != nil {
				c.AbortWithStatus(http.StatusInternalServerError)
				return
			}
			if input.TransactionId == "" || input.ProductId == "" || input.Amount <= 0 || input.Currency == "" || input.PeriodStart <= 0 || input.PeriodEnd <= input.PeriodStart {
				logger.LogWarn(c.Request.Context(), fmt.Sprintf("Creem recurring checkout deferred to subscription.paid event_id=%s subscription_id=%s", event.Id, input.SubscriptionId))
				if err := model.RecordCreemInformationalEvent(input); err != nil {
					c.AbortWithStatus(http.StatusInternalServerError)
					return
				}
				c.Status(http.StatusOK)
				return
			}
			if err := model.ProcessCreemInitialPayment(input, providerSummary); err != nil {
				logger.LogError(c.Request.Context(), fmt.Sprintf("Creem recurring checkout failed event_id=%s subscription_id=%s transaction_id=%s error=%q", event.Id, input.SubscriptionId, input.TransactionId, err.Error()))
				c.AbortWithStatus(http.StatusInternalServerError)
				return
			}
			c.Status(http.StatusOK)
			return
		}
		if event.Object.Order.Type != "onetime" {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		input = creemOnetimePaymentInput(&event, body)
		if input.ProductId == "" || input.Amount <= 0 || input.Currency == "" {
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("Creem one-time checkout requires manual reconciliation event_id=%s order_id=%s", event.Id, event.Object.Order.Id))
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		processed, err := model.IsCreemEventProcessed(input.EventId, input.EventType, input.PayloadHash)
		if err != nil {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		if processed {
			c.Status(http.StatusOK)
			return
		}
		topUp := model.GetTopUpByTradeNo(referenceId)
		if topUp == nil {
			c.AbortWithStatus(http.StatusBadRequest)
			return
		}
		if topUp.Status == common.TopUpStatusSuccess {
			if err := model.RecordCreemInformationalEvent(input); err != nil {
				c.AbortWithStatus(http.StatusInternalServerError)
				return
			}
			c.Status(http.StatusOK)
			return
		}
		if err := model.RechargeCreem(input, referenceId, event.Object.Customer.Email, event.Object.Customer.Name, c.ClientIP()); err != nil {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		c.Status(http.StatusOK)
	case "subscription.paid":
		subscription, err := event.subscription()
		if err != nil {
			c.AbortWithStatus(http.StatusBadRequest)
			return
		}
		input = creemPaymentInput(&event, body, subscription)
		providerSummary, err := creemWebhookSummary(&event, input)
		if err != nil {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		LockOrder(input.SubscriptionId)
		defer UnlockOrder(input.SubscriptionId)
		err = model.ProcessCreemRenewal(input, providerSummary)
		if errors.Is(err, model.ErrCreemSubscriptionLinkNotFound) && input.TradeNo != "" {
			err = model.ProcessCreemInitialPayment(input, providerSummary)
		}
		if err != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf("Creem renewal failed event_id=%s subscription_id=%s transaction_id=%s error=%q", event.Id, input.SubscriptionId, input.TransactionId, err.Error()))
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		c.Status(http.StatusOK)
	case "subscription.scheduled_cancel", "subscription.past_due", "subscription.active", "subscription.update", "subscription.trialing", "subscription.canceled", "subscription.expired", "subscription.unpaid", "subscription.paused":
		subscription, err := event.subscription()
		if err != nil {
			c.AbortWithStatus(http.StatusBadRequest)
			return
		}
		input = creemPaymentInput(&event, body, subscription)
		cancelAtPeriodEnd := event.EventType == "subscription.scheduled_cancel"
		terminate := event.EventType == "subscription.canceled" || event.EventType == "subscription.expired" || event.EventType == "subscription.paused"
		if err := model.ProcessCreemLifecycle(input, cancelAtPeriodEnd, terminate); err != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf("Creem lifecycle sync failed event_id=%s subscription_id=%s error=%q", event.Id, input.SubscriptionId, err.Error()))
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		c.Status(http.StatusOK)
	case "refund.created", "dispute.created":
		transactionId := string(event.Object.Transaction)
		if transactionId == "" {
			transactionId = string(event.Object.Order.Transaction)
		}
		notice := model.CreemFinancialNoticeInput{EventId: event.Id, EventType: event.EventType, PayloadHash: creemPayloadHash(body), ObjectId: event.Object.Id, TransactionId: transactionId, SubscriptionId: creemFinancialSubscriptionId(event.Object.Subscription), Amount: event.Object.Amount, Currency: event.Object.Currency, ProviderStatus: event.Object.Status}
		if err := model.RecordCreemFinancialNotice(notice); err != nil {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Creem financial notice event_type=%s event_id=%s object_id=%s amount=%d currency=%s status=%s action=record_only", event.EventType, event.Id, event.Object.Id, event.Object.Amount, event.Object.Currency, event.Object.Status))
		c.Status(http.StatusOK)
	default:
		if err := model.RecordCreemInformationalEvent(input); err != nil {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		c.Status(http.StatusOK)
	}
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

var creemHTTPClient = &http.Client{Timeout: 30 * time.Second}

func genCreemLink(ctx context.Context, referenceId string, product *CreemProduct, email string, username string, config creemConfigSnapshot) (string, error) {
	if strings.TrimSpace(config.ApiKey) == "" {
		return "", errors.New("Creem API key is not configured")
	}
	apiURL := "https://api.creem.io/v1/checkouts"
	if config.TestMode {
		apiURL = "https://test-api.creem.io/v1/checkouts"
	}
	requestData := CreemCheckoutRequest{ProductId: product.ProductId, RequestId: referenceId, Metadata: map[string]string{"trade_no": referenceId, "reference_id": referenceId, "username": username, "product_name": product.Name, "quota": fmt.Sprintf("%d", product.Quota)}}
	requestData.Customer.Email = email
	data, err := common.Marshal(requestData)
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(data))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", config.ApiKey)
	resp, err := creemHTTPClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode/100 != 2 {
		return "", fmt.Errorf("Creem API returned status %d", resp.StatusCode)
	}
	var checkout CreemCheckoutResponse
	if err := common.Unmarshal(body, &checkout); err != nil {
		return "", err
	}
	if checkout.CheckoutUrl == "" {
		return "", errors.New("Creem API response has no checkout URL")
	}
	return checkout.CheckoutUrl, nil
}
