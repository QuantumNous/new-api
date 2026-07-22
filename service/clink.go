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

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
)

const (
	clinkProdBaseURL = "https://api.clinkbill.com/api"
	clinkUATBaseURL  = "https://uat-api.clinkbill.com/api"
	clinkHTTPTimeout = 30 * time.Second
)

var clinkHTTPClient = &http.Client{Timeout: clinkHTTPTimeout}

type ClinkPriceData struct {
	Name       string  `json:"name"`
	Quantity   int     `json:"quantity"`
	UnitAmount float64 `json:"unitAmount"`
	Currency   string  `json:"currency"`
}

type ClinkCheckoutCreateRequest struct {
	CustomerEmail       string            `json:"customerEmail,omitempty"`
	ReferenceCustomerID string            `json:"referenceCustomerId,omitempty"`
	OriginalAmount      float64           `json:"originalAmount"`
	OriginalCurrency    string            `json:"originalCurrency"`
	MerchantReferenceID string            `json:"merchantReferenceId,omitempty"`
	PriceDataList       []ClinkPriceData  `json:"priceDataList,omitempty"`
	UIMode              string            `json:"uiMode,omitempty"`
	SuccessURL          string            `json:"successUrl,omitempty"`
	CancelURL           string            `json:"cancelUrl,omitempty"`
	Metadata            map[string]string `json:"metadata,omitempty"`
}

type ClinkCheckoutSessionData struct {
	SessionID           string  `json:"sessionId"`
	URL                 string  `json:"url"`
	MerchantReferenceID string  `json:"merchantReferenceId"`
	OriginalAmount      float64 `json:"originalAmount"`
	OriginalCurrency    string  `json:"originalCurrency"`
}

type ClinkCheckoutSessionDetail struct {
	SessionID           string            `json:"sessionId"`
	Status              string            `json:"status"`
	PaymentStatus       string            `json:"paymentStatus"`
	AmountSubtotal      float64           `json:"amountSubtotal"`
	AmountTotal         float64           `json:"amountTotal"`
	OriginalCurrency    string            `json:"originalCurrency"`
	PaymentCurrency     string            `json:"paymentCurrency"`
	MerchantReferenceID string            `json:"merchantReferenceId"`
	Metadata            map[string]string `json:"metadata"`
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
	Created json.RawMessage `json:"created"`
	Data    json.RawMessage `json:"data"`
}

type ClinkOrderWebhookData struct {
	OrderID             string  `json:"orderId"`
	MerchantReferenceID string  `json:"merchantReferenceId"`
	Status              string  `json:"status"`
	AmountSubtotal      float64 `json:"amountSubtotal"`
	AmountTotal         float64 `json:"amountTotal"`
	OriginalCurrency    string  `json:"originalCurrency"`
	PaymentCurrency     string  `json:"paymentCurrency"`
}

type ClinkSessionWebhookData struct {
	SessionID           string  `json:"sessionId"`
	MerchantReferenceID string  `json:"merchantReferenceId"`
	Status              string  `json:"status"`
	PaymentStatus       string  `json:"paymentStatus"`
	AmountSubtotal      float64 `json:"amountSubtotal"`
	AmountTotal         float64 `json:"amountTotal"`
	OriginalCurrency    string  `json:"originalCurrency"`
	PaymentCurrency     string  `json:"paymentCurrency"`
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
	if len(req.PriceDataList) == 0 {
		req.PriceDataList = []ClinkPriceData{{
			Name:       "APIMaster.ai balance top-up",
			Quantity:   1,
			UnitAmount: req.OriginalAmount,
			Currency:   req.OriginalCurrency,
		}}
	}

	body, err := common.Marshal(req)
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

	var session ClinkCheckoutSessionData
	if err := decodeClinkAPIEnvelope(respBody, &session); err != nil {
		return nil, err
	}

	if strings.TrimSpace(session.URL) == "" {
		return nil, fmt.Errorf("clink checkout returned empty url")
	}
	return &session, nil
}

func GetClinkCheckoutSession(ctx context.Context, sessionID string) (*ClinkCheckoutSessionDetail, error) {
	if !ClinkConfigured() {
		return nil, fmt.Errorf("clink secret key not configured")
	}
	sessionID = strings.TrimSpace(sessionID)
	if sessionID == "" {
		return nil, fmt.Errorf("missing clink session id")
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, ClinkBaseURL()+"/checkout/session/"+sessionID, nil)
	if err != nil {
		return nil, err
	}
	if err := applyClinkAuthHeaders(httpReq); err != nil {
		return nil, err
	}

	resp, err := clinkHTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("clink get session failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read clink session response: %w", err)
	}
	if resp.StatusCode/100 != 2 {
		return nil, fmt.Errorf("clink get session error (%d): %s", resp.StatusCode, string(respBody))
	}

	var session ClinkCheckoutSessionDetail
	if err := decodeClinkAPIEnvelope(respBody, &session); err != nil {
		return nil, err
	}
	if strings.TrimSpace(session.SessionID) == "" {
		session.SessionID = sessionID
	}
	return &session, nil
}

func decodeClinkAPIEnvelope(respBody []byte, target any) error {
	var envelope clinkAPIEnvelope
	if err := common.Unmarshal(respBody, &envelope); err != nil {
		return fmt.Errorf("decode clink envelope: %w", err)
	}
	if envelope.Code != 0 && envelope.Code != http.StatusOK {
		return fmt.Errorf("clink api rejected: %s", envelope.Msg)
	}
	if len(envelope.Data) > 0 {
		if err := common.Unmarshal(envelope.Data, target); err != nil {
			return fmt.Errorf("decode clink data: %w", err)
		}
		return nil
	}
	if err := common.Unmarshal(respBody, target); err != nil {
		return fmt.Errorf("decode clink response: %w", err)
	}
	return nil
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

// DecodeClinkWebhookData accepts both the documented data payload and the
// data.object wrapper currently emitted by Clink in production.
func DecodeClinkWebhookData(data json.RawMessage, target any) error {
	if len(data) == 0 {
		return fmt.Errorf("missing clink webhook data")
	}

	var envelope struct {
		Object json.RawMessage `json:"object"`
	}
	if err := common.Unmarshal(data, &envelope); err != nil {
		return err
	}
	payload := data
	if object := bytes.TrimSpace(envelope.Object); len(object) > 0 && object[0] == '{' {
		payload = object
	}
	return common.Unmarshal(payload, target)
}

// ClinkAmountForValidation returns an amount expressed in the original
// checkout currency. For localized payments Clink reports amountTotal in the
// payment currency and amountSubtotal in the original currency.
func ClinkAmountForValidation(amountSubtotal, amountTotal float64, originalCurrency, paymentCurrency string) float64 {
	originalCurrency = strings.TrimSpace(originalCurrency)
	paymentCurrency = strings.TrimSpace(paymentCurrency)
	if amountSubtotal > 0 && originalCurrency != "" && paymentCurrency != "" && !strings.EqualFold(originalCurrency, paymentCurrency) {
		return amountSubtotal
	}
	if amountTotal > 0 {
		return amountTotal
	}
	return amountSubtotal
}

func ClinkAmountsMatch(expected, actual float64) bool {
	if expected <= 0 || actual <= 0 {
		return false
	}
	return math.Abs(expected-actual) <= 0.05
}
