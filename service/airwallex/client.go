package airwallex

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
)

// CheckoutBase is the Airwallex Hosted Payment Page origin (var so tests can override).
var CheckoutBase = "https://checkout.airwallex.com"

var HTTPClient = &http.Client{Timeout: 30 * time.Second}

// Airwallex bearer tokens live ~30 minutes; refresh with margin.
const tokenLifetime = 25 * time.Minute

var tokenMu sync.Mutex
var cachedToken string
var tokenExpiry time.Time

type apiError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func ResetTokenCache() {
	tokenMu.Lock()
	cachedToken = ""
	tokenExpiry = time.Time{}
	tokenMu.Unlock()
}

func getToken() (string, error) {
	tokenMu.Lock()
	defer tokenMu.Unlock()
	if cachedToken != "" && time.Now().Before(tokenExpiry) {
		return cachedToken, nil
	}
	req, err := http.NewRequest(http.MethodPost, setting.AirwallexApiBase+"/api/v1/authentication/login", nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("x-client-id", setting.AirwallexClientId)
	req.Header.Set("x-api-key", setting.AirwallexApiKey)
	resp, err := HTTPClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("airwallex login failed: status %d body %s", resp.StatusCode, string(body))
	}
	var loginResp struct {
		Token string `json:"token"`
	}
	if err := common.Unmarshal(body, &loginResp); err != nil {
		return "", err
	}
	if loginResp.Token == "" {
		return "", errors.New("airwallex login returned empty token")
	}
	cachedToken = loginResp.Token
	tokenExpiry = time.Now().Add(tokenLifetime)
	return cachedToken, nil
}

// do performs an authenticated JSON call; out may be nil.
func do(method, path string, in any, out any) error {
	token, err := getToken()
	if err != nil {
		return err
	}
	var bodyReader io.Reader
	if in != nil {
		data, err := common.Marshal(in)
		if err != nil {
			return err
		}
		bodyReader = bytes.NewReader(data)
	}
	req, err := http.NewRequest(method, setting.AirwallexApiBase+path, bodyReader)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	if in != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.StatusCode >= 300 {
		var ae apiError
		_ = common.Unmarshal(data, &ae)
		if ae.Code != "" || ae.Message != "" {
			return fmt.Errorf("airwallex %s %s: %s (%s)", method, path, ae.Message, ae.Code)
		}
		return fmt.Errorf("airwallex %s %s: status %d body %s", method, path, resp.StatusCode, string(data))
	}
	if out != nil {
		return common.Unmarshal(data, out)
	}
	return nil
}

type Customer struct {
	Id                 string `json:"id"`
	MerchantCustomerId string `json:"merchant_customer_id"`
	Email              string `json:"email"`
}

func CreateCustomer(requestId, merchantCustomerId, email string) (*Customer, error) {
	body := map[string]any{
		"request_id":           requestId,
		"merchant_customer_id": merchantCustomerId,
	}
	if email != "" {
		body["email"] = email
	}
	var c Customer
	if err := do(http.MethodPost, "/api/v1/pa/customers/create", body, &c); err != nil {
		return nil, err
	}
	return &c, nil
}

// FindCustomerByMerchantId returns the existing customer for a merchant_customer_id, or nil.
func FindCustomerByMerchantId(merchantCustomerId string) (*Customer, error) {
	var page struct {
		Items []Customer `json:"items"`
	}
	path := "/api/v1/pa/customers?merchant_customer_id=" + url.QueryEscape(merchantCustomerId) + "&page_size=1"
	if err := do(http.MethodGet, path, nil, &page); err != nil {
		return nil, err
	}
	if len(page.Items) == 0 {
		return nil, nil
	}
	return &page.Items[0], nil
}

func GetCustomer(customerId string) (*Customer, error) {
	var c Customer
	if err := do(http.MethodGet, "/api/v1/pa/customers/"+url.PathEscape(customerId), nil, &c); err != nil {
		return nil, err
	}
	return &c, nil
}

func GenerateCustomerClientSecret(customerId string) (string, error) {
	var resp struct {
		ClientSecret string `json:"client_secret"`
	}
	if err := do(http.MethodGet, "/api/v1/pa/customers/"+url.PathEscape(customerId)+"/generate_client_secret", nil, &resp); err != nil {
		return "", err
	}
	if resp.ClientSecret == "" {
		return "", errors.New("airwallex generate_client_secret returned empty client_secret")
	}
	return resp.ClientSecret, nil
}

type SubscriptionItem struct {
	PriceId  string `json:"price_id"`
	Quantity int    `json:"quantity,omitempty"`
}

type SubscriptionRecurring struct {
	Period     int    `json:"period,omitempty"`
	PeriodUnit string `json:"period_unit"`
}

type Subscription struct {
	Id                   string            `json:"id"`
	CustomerId           string            `json:"customer_id"`
	PaymentConsentId     string            `json:"payment_consent_id"`
	Status               string            `json:"status"`
	CurrentPeriodStartAt string            `json:"current_period_start_at"`
	CurrentPeriodEndAt   string            `json:"current_period_end_at"`
	Metadata             map[string]string `json:"metadata"`
}

type CreateSubscriptionRequest struct {
	RequestId         string `json:"request_id"`
	CustomerId        string `json:"customer_id"`
	BillingCustomerId string `json:"billing_customer_id"`
	// CollectionMethod ∈ AUTO_CHARGE / CHARGE_ON_CHECKOUT / OUT_OF_BAND (live API
	// 2025-02-14 requires it; the published schema.json is older and omits it).
	CollectionMethod string `json:"collection_method"`
	// PaymentSourceId is required by the live API when CollectionMethod is
	// AUTO_CHARGE; for consent-backed charging it carries the PaymentConsent id.
	PaymentSourceId  string                 `json:"payment_source_id,omitempty"`
	PaymentConsentId string                 `json:"payment_consent_id"`
	Items            []SubscriptionItem     `json:"items"`
	Recurring        *SubscriptionRecurring `json:"recurring,omitempty"`
	Metadata         map[string]string      `json:"metadata,omitempty"`
}

func CreateSubscription(req *CreateSubscriptionRequest) (*Subscription, error) {
	var sub Subscription
	if err := do(http.MethodPost, "/api/v1/subscriptions/create", req, &sub); err != nil {
		return nil, err
	}
	return &sub, nil
}

// CancelSubscription stops future cycles. prorationBehavior ∈ ALL / PRORATED / NONE;
// JINN policy is NONE (no cash refunds — access runs to period end via the engine term).
func CancelSubscription(subscriptionId, requestId, prorationBehavior string) error {
	body := map[string]any{"request_id": requestId}
	if prorationBehavior != "" {
		body["proration_behavior"] = prorationBehavior
	}
	return do(http.MethodPost, "/api/v1/subscriptions/"+url.PathEscape(subscriptionId)+"/cancel", body, nil)
}

// ListSubscriptions returns the customer's subscriptions, optionally filtered by status (e.g. "ACTIVE").
func ListSubscriptions(customerId, status string) ([]Subscription, error) {
	var page struct {
		Items []Subscription `json:"items"`
	}
	path := "/api/v1/subscriptions?customer_id=" + url.QueryEscape(customerId) + "&page_size=20"
	if status != "" {
		path += "&status=" + url.QueryEscape(status)
	}
	if err := do(http.MethodGet, path, nil, &page); err != nil {
		return nil, err
	}
	return page.Items, nil
}

func UpdateSubscription(subscriptionId string, body map[string]any) (*Subscription, error) {
	var sub Subscription
	if err := do(http.MethodPost, "/api/v1/subscriptions/"+url.PathEscape(subscriptionId)+"/update", body, &sub); err != nil {
		return nil, err
	}
	return &sub, nil
}

type PaymentConsent struct {
	Id         string `json:"id"`
	CustomerId string `json:"customer_id"`
	Status     string `json:"status"`
}

// ListVerifiedConsents returns the customer's VERIFIED merchant-triggered consents, newest first.
func ListVerifiedConsents(customerId string) ([]PaymentConsent, error) {
	var page struct {
		Items []PaymentConsent `json:"items"`
	}
	path := "/api/v1/pa/payment_consents?customer_id=" + url.QueryEscape(customerId) +
		"&next_triggered_by=merchant&status=VERIFIED&page_size=10"
	if err := do(http.MethodGet, path, nil, &page); err != nil {
		return nil, err
	}
	return page.Items, nil
}

type PaymentIntent struct {
	Id           string  `json:"id"`
	Status       string  `json:"status"`
	Amount       float64 `json:"amount"`
	Currency     string  `json:"currency"`
	ClientSecret string  `json:"client_secret"`
}

func CreatePaymentIntent(requestId string, amount float64, currency, merchantOrderId, customerId string, metadata map[string]string) (*PaymentIntent, error) {
	body := map[string]any{
		"request_id":        requestId,
		"amount":            amount,
		"currency":          currency,
		"merchant_order_id": merchantOrderId,
	}
	if customerId != "" {
		body["customer_id"] = customerId
	}
	if len(metadata) > 0 {
		body["metadata"] = metadata
	}
	var pi PaymentIntent
	if err := do(http.MethodPost, "/api/v1/pa/payment_intents/create", body, &pi); err != nil {
		return nil, err
	}
	return &pi, nil
}

type methodTypesCache struct {
	mu      sync.Mutex
	names   map[string]bool
	fetched time.Time
}

var activeMethods methodTypesCache

// ActivePaymentMethodNames returns the entity's active payment method names
// (e.g. "card", "applepay", "googlepay", later "alipaycn"/"wechatpay"), cached 10 min.
func ActivePaymentMethodNames() (map[string]bool, error) {
	activeMethods.mu.Lock()
	defer activeMethods.mu.Unlock()
	if activeMethods.names != nil && time.Since(activeMethods.fetched) < 10*time.Minute {
		return activeMethods.names, nil
	}
	var page struct {
		Items []struct {
			Name string `json:"name"`
		} `json:"items"`
	}
	if err := do(http.MethodGet, "/api/v1/pa/config/payment_method_types?active=true&page_size=100", nil, &page); err != nil {
		if activeMethods.names != nil {
			return activeMethods.names, nil // serve stale on transient failure
		}
		return nil, err
	}
	names := make(map[string]bool, len(page.Items))
	for _, it := range page.Items {
		names[it.Name] = true
	}
	activeMethods.names = names
	activeMethods.fetched = time.Now()
	return names, nil
}

// StandardCheckoutURL builds the Hosted Payment Page URL for a one-time
// PaymentIntent (the WeChat manual-renew branch and Stage-2 top-ups).
func StandardCheckoutURL(intentId, clientSecret, currency, successUrl, failUrl string) string {
	q := url.Values{}
	q.Set("intent_id", intentId)
	q.Set("client_secret", clientSecret)
	q.Set("currency", currency)
	if successUrl != "" {
		q.Set("successUrl", successUrl)
	}
	if failUrl != "" {
		q.Set("failUrl", failUrl)
	}
	return CheckoutBase + "/#/standalone/checkout?" + q.Encode()
}

// RecurringCheckoutURL builds the Hosted Payment Page URL in recurring mode:
// the page collects a payment method and creates+verifies a merchant-triggered
// PaymentConsent for the customer. clientSecret comes from GenerateCustomerClientSecret.
// The recurring HPP lives at /#/standalone/recurring, and the consent settings must
// travel as a single JSON `recurringOptions` param — flat next_triggered_by /
// merchant_trigger_reason params are dropped by the page's param whitelist.
func RecurringCheckoutURL(clientSecret, customerId, currency, successUrl, failUrl string) string {
	recurringOptions, _ := common.Marshal(map[string]string{
		"next_triggered_by":       "merchant",
		"merchant_trigger_reason": "scheduled",
		"currency":                currency,
	})
	q := url.Values{}
	q.Set("mode", "recurring")
	q.Set("client_secret", clientSecret)
	q.Set("customer_id", customerId)
	q.Set("currency", currency)
	q.Set("recurringOptions", string(recurringOptions))
	if successUrl != "" {
		q.Set("successUrl", successUrl)
	}
	if failUrl != "" {
		q.Set("failUrl", failUrl)
	}
	return CheckoutBase + "/#/standalone/recurring?" + q.Encode()
}
