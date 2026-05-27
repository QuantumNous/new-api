package airwallex

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

type Config struct {
	BaseURL  string
	ClientID string
	APIKey   string
	LoginAs  string

	TokenCacheTTL     time.Duration
	TokenEarlyRefresh time.Duration
	HTTPClient        *http.Client
	Now               func() time.Time
}

type Client struct {
	baseURL  string
	clientID string
	apiKey   string
	loginAs  string

	tokenCacheTTL     time.Duration
	tokenEarlyRefresh time.Duration
	httpClient        *http.Client
	now               func() time.Time

	mu        sync.Mutex
	token     string
	expiresAt time.Time
}

type APIError struct {
	StatusCode int
	Body       string
}

func (e *APIError) Error() string {
	body := strings.TrimSpace(e.Body)
	if body == "" {
		return fmt.Sprintf("airwallex api error: status=%d", e.StatusCode)
	}
	return fmt.Sprintf("airwallex api error: status=%d body=%s", e.StatusCode, body)
}

type PaymentIntent struct {
	ID              string  `json:"id"`
	Status          string  `json:"status"`
	ClientSecret    string  `json:"client_secret,omitempty"`
	Amount          float64 `json:"amount,omitempty"`
	Currency        string  `json:"currency,omitempty"`
	MerchantOrderID string  `json:"merchant_order_id,omitempty"`
}

type CreatePaymentIntentRequest struct {
	RequestID       string  `json:"request_id"`
	Amount          float64 `json:"amount"`
	Currency        string  `json:"currency"`
	MerchantOrderID string  `json:"merchant_order_id"`
	ReturnURL       string  `json:"return_url,omitempty"`
}

type ConfirmPaymentIntentRequest struct {
	RequestID     string `json:"request_id,omitempty"`
	PaymentMethod any    `json:"payment_method,omitempty"`
}

type NextAction struct {
	Type   string `json:"type"`
	QRCode string `json:"qrcode,omitempty"`
	URL    string `json:"url,omitempty"`
}

type ConfirmPaymentIntentResponse struct {
	PaymentIntent
	NextAction NextAction `json:"next_action"`
}

type ListPaymentMethodTypesQuery struct {
	TransactionCurrency string
	TransactionMode     string
	CountryCode         string
}

type PaymentMethodType struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

type ListPaymentMethodTypesResponse struct {
	Items []PaymentMethodType `json:"items"`
}

func NewClient(cfg Config) *Client {
	httpClient := cfg.HTTPClient
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	now := cfg.Now
	if now == nil {
		now = time.Now
	}
	ttl := cfg.TokenCacheTTL
	if ttl <= 0 {
		ttl = time.Hour
	}
	return &Client{
		baseURL:           strings.TrimRight(cfg.BaseURL, "/"),
		clientID:          cfg.ClientID,
		apiKey:            cfg.APIKey,
		loginAs:           cfg.LoginAs,
		tokenCacheTTL:     ttl,
		tokenEarlyRefresh: cfg.TokenEarlyRefresh,
		httpClient:        httpClient,
		now:               now,
	}
}

func (c *Client) CreatePaymentIntent(ctx context.Context, req CreatePaymentIntentRequest) (*PaymentIntent, error) {
	var out PaymentIntent
	if err := c.doJSON(ctx, http.MethodPost, "/api/v1/pa/payment_intents/create", req, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) ConfirmPaymentIntent(ctx context.Context, id string, req ConfirmPaymentIntentRequest) (*ConfirmPaymentIntentResponse, error) {
	var out ConfirmPaymentIntentResponse
	if err := c.doJSON(ctx, http.MethodPost, "/api/v1/pa/payment_intents/"+id+"/confirm", req, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) ListPaymentMethodTypes(ctx context.Context, q ListPaymentMethodTypesQuery) (*ListPaymentMethodTypesResponse, error) {
	path := "/api/v1/pa/config/payment_method_types"
	params := url.Values{}
	if q.TransactionCurrency != "" {
		params.Set("transaction_currency", q.TransactionCurrency)
	}
	if q.TransactionMode != "" {
		params.Set("transaction_mode", q.TransactionMode)
	}
	if q.CountryCode != "" {
		params.Set("country_code", q.CountryCode)
	}
	if encoded := params.Encode(); encoded != "" {
		path += "?" + encoded
	}

	var out ListPaymentMethodTypesResponse
	if err := c.doJSON(ctx, http.MethodGet, path, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) ensureToken(ctx context.Context) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	now := c.now().UTC()
	if c.token != "" && c.expiresAt.After(now.Add(c.tokenEarlyRefresh)) {
		return c.token, nil
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/api/v1/authentication/login", nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("x-client-id", c.clientID)
	req.Header.Set("x-api-key", c.apiKey)
	if c.loginAs != "" {
		req.Header.Set("x-login-as", c.loginAs)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", &APIError{StatusCode: resp.StatusCode, Body: string(bodyBytes)}
	}

	var loginResponse struct {
		Token     string `json:"token"`
		ExpiresAt string `json:"expires_at"`
	}
	if err := json.Unmarshal(bodyBytes, &loginResponse); err != nil {
		return "", err
	}
	if loginResponse.Token == "" {
		return "", fmt.Errorf("airwallex login: missing token")
	}

	expiresAt := now.Add(c.tokenCacheTTL)
	if loginResponse.ExpiresAt != "" {
		if t, err := time.Parse(time.RFC3339, loginResponse.ExpiresAt); err == nil {
			expiresAt = t.UTC()
		}
	}
	c.token = loginResponse.Token
	c.expiresAt = expiresAt
	return c.token, nil
}

func (c *Client) doJSON(ctx context.Context, method, path string, in any, out any) error {
	token, err := c.ensureToken(ctx)
	if err != nil {
		return err
	}

	var body io.Reader
	if in != nil {
		b, err := json.Marshal(in)
		if err != nil {
			return err
		}
		body = bytes.NewReader(b)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, body)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	if in != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return &APIError{StatusCode: resp.StatusCode, Body: string(respBody)}
	}
	if out == nil {
		return nil
	}
	return json.Unmarshal(respBody, out)
}
