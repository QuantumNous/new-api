package service

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/setting"
)

const (
	clinkProdBaseURL = "https://api.clinkbill.com/api"
	clinkUATBaseURL  = "https://uat-api.clinkbill.com/api"
	clinkHTTPTimeout = 30 * time.Second
)

var clinkHTTPClient = &http.Client{Timeout: clinkHTTPTimeout}

type ClinkCheckoutCreateRequest struct {
	CustomerEmail         string            `json:"customerEmail,omitempty"`
	ReferenceCustomerID   string            `json:"referenceCustomerId,omitempty"`
	OriginalAmount        float64           `json:"originalAmount"`
	OriginalCurrency      string            `json:"originalCurrency"`
	MerchantReferenceID   string            `json:"merchantReferenceId,omitempty"`
	UIMode                string            `json:"uiMode,omitempty"`
	SuccessURL            string            `json:"successUrl,omitempty"`
	CancelURL             string            `json:"cancelUrl,omitempty"`
	Metadata              map[string]string `json:"metadata,omitempty"`
}

type ClinkCheckoutSessionData struct {
	SessionID           string  `json:"sessionId"`
	URL                 string  `json:"url"`
	MerchantReferenceID string  `json:"merchantReferenceId"`
	OriginalAmount      float64 `json:"originalAmount"`
	OriginalCurrency    string  `json:"originalCurrency"`
}

type clinkAPIEnvelope struct {
	Code int             `json:"code"`
	Msg  string          `json:"msg"`
	Data json.RawMessage `json:"data"`
}

type ClinkWebhookEvent struct {
	ID      string          `json:"id"`
	Type    string          `json:"type"`
	Object  string          `json:"object"`
	Created string          `json:"created"`
	Data    json.RawMessage `json:"data"`
}

type ClinkOrderWebhookData struct {
	OrderID             string  `json:"orderId"`
	MerchantReferenceID string  `json:"merchantReferenceId"`
	Status              string  `json:"status"`
	AmountTotal         float64 `json:"amountTotal"`
	OriginalCurrency    string  `json:"originalCurrency"`
	PaymentCurrency     string  `json:"paymentCurrency"`
}

type ClinkSessionWebhookData struct {
	SessionID           string  `json:"sessionId"`
	MerchantReferenceID string  `json:"merchantReferenceId"`
	Status              string  `json:"status"`
	PaymentStatus       string  `json:"paymentStatus"`
	AmountTotal         float64 `json:"amountTotal"`
	OriginalCurrency    string  `json:"originalCurrency"`
}

func ClinkSecretKey() string {
	return strings.TrimSpace(os.Getenv("CLINK_SECRET_KEY"))
}

func ClinkPublishableKey() string {
	return strings.TrimSpace(os.Getenv("CLINK_PUBLISHABLE_KEY"))
}

func ClinkWebhookSecret() string {
	return strings.TrimSpace(os.Getenv("CLINK_WEBHOOK_SECRET"))
}

func ClinkConfigured() bool {
	return ClinkSecretKey() != ""
}

func ClinkBaseURL() string {
	if setting.ClinkSandbox {
		return clinkUATBaseURL
	}
	return clinkProdBaseURL
}

func CreateClinkCheckoutSession(ctx context.Context, req *ClinkCheckoutCreateRequest) (*ClinkCheckoutSessionData, error) {
	if !ClinkConfigured() {
		return nil, fmt.Errorf("clink secret key not configured")
	}
	if req == nil {
		return nil, fmt.Errorf("missing clink checkout request")
	}
	if req.OriginalAmount <= 0 {
		return nil, fmt.Errorf("invalid clink amount")
	}
	if strings.TrimSpace(req.OriginalCurrency) == "" {
		req.OriginalCurrency = "USD"
	}
	if strings.TrimSpace(req.UIMode) == "" {
		req.UIMode = "hostedPage"
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal clink checkout request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, ClinkBaseURL()+"/checkout/session", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	if err := applyClinkAuthHeaders(httpReq); err != nil {
		return nil, err
	}

	resp, err := clinkHTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("clink checkout request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read clink checkout response: %w", err)
	}
	if resp.StatusCode/100 != 2 {
		return nil, fmt.Errorf("clink checkout error (%d): %s", resp.StatusCode, string(respBody))
	}

	var envelope clinkAPIEnvelope
	if err := json.Unmarshal(respBody, &envelope); err != nil {
		return nil, fmt.Errorf("decode clink checkout envelope: %w", err)
	}
	if envelope.Code != 0 && envelope.Code != http.StatusOK {
		return nil, fmt.Errorf("clink checkout rejected: %s", envelope.Msg)
	}

	var session ClinkCheckoutSessionData
	if len(envelope.Data) > 0 {
		if err := json.Unmarshal(envelope.Data, &session); err != nil {
			return nil, fmt.Errorf("decode clink checkout data: %w", err)
		}
	} else if err := json.Unmarshal(respBody, &session); err != nil {
		return nil, fmt.Errorf("decode clink checkout response: %w", err)
	}

	if strings.TrimSpace(session.URL) == "" {
		return nil, fmt.Errorf("clink checkout returned empty url")
	}
	return &session, nil
}

func applyClinkAuthHeaders(req *http.Request) error {
	if req == nil {
		return fmt.Errorf("missing http request")
	}
	secret := ClinkSecretKey()
	if secret == "" {
		return fmt.Errorf("clink secret key not configured")
	}
	ts := strconv.FormatInt(time.Now().UnixMilli(), 10)
	req.Header.Set("X-API-Key", secret)
	req.Header.Set("X-Timestamp", ts)
	return nil
}

func VerifyClinkWebhookSignature(timestamp, signature, payload string) bool {
	secret := ClinkWebhookSecret()
	if secret == "" {
		if setting.ClinkSandbox {
			return true
		}
		return false
	}
	if strings.TrimSpace(timestamp) == "" || strings.TrimSpace(signature) == "" {
		return false
	}
	expected := computeClinkWebhookSignature(secret, timestamp, payload)
	return hmac.Equal([]byte(strings.TrimSpace(signature)), []byte(expected))
}

func computeClinkWebhookSignature(secret, timestamp, payload string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(timestamp + "." + payload))
	return hex.EncodeToString(mac.Sum(nil))
}

func ClinkAmountsMatch(expected, actual float64) bool {
	if expected <= 0 || actual <= 0 {
		return false
	}
	return math.Abs(expected-actual) <= 0.05
}
