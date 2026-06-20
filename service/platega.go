package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/setting"
)

const (
	plategaBaseURL            = "https://app.platega.io"
	plategaCreatePath         = "/transaction/process"
	plategaPaymentMethodSBPQR = 2
	plategaHTTPTimeout        = 30 * time.Second
)

var plategaHTTPClient = &http.Client{Timeout: plategaHTTPTimeout}

type PlategaPaymentDetails struct {
	Amount   float64 `json:"amount"`
	Currency string  `json:"currency"`
}

type PlategaCreateTransactionRequest struct {
	PaymentMethod  int                   `json:"paymentMethod"`
	PaymentDetails PlategaPaymentDetails `json:"paymentDetails"`
	Description    string                `json:"description"`
	Return         string                `json:"return"`
	FailedURL      string                `json:"failedUrl"`
	Payload        string                `json:"payload"`
}

type PlategaCreateTransactionResponse struct {
	PaymentMethod string `json:"paymentMethod"`
	TransactionId string `json:"transactionId"`
	Redirect      string `json:"redirect"`
	Return        string `json:"return"`
	PaymentDetails string `json:"paymentDetails"`
	Status        string `json:"status"`
	ExpiresIn     string `json:"expiresIn"`
	MerchantId    string `json:"merchantId"`
	UsdtRate      float64 `json:"usdtRate"`
	CryptoAmount  float64 `json:"cryptoAmount"`
}

type PlategaTransactionStatusResponse struct {
	TransactionId string  `json:"transactionId"`
	Status        string  `json:"status"`
	Payload       string  `json:"payload"`
	Amount        float64 `json:"amount"`
	Currency      string  `json:"currency"`
	PaymentMethod string  `json:"paymentMethod"`
}

type PlategaCallbackPayload struct {
	TransactionId  string          `json:"transactionId"`
	Status         string          `json:"status"`
	Payload        string          `json:"payload"`
	Amount         json.RawMessage `json:"amount"`
	Currency       string          `json:"currency"`
	PaymentMethod  json.RawMessage `json:"paymentMethod"` // Platega sends 2 (int) or "SBPQR" (string)
	PaymentDetails json.RawMessage `json:"paymentDetails"`
}

func PlategaMerchantID() string {
	return strings.TrimSpace(os.Getenv("PLATEGA_MERCHANT_ID"))
}

func PlategaSecret() string {
	return strings.TrimSpace(os.Getenv("PLATEGA_X_SECRET"))
}

func PlategaConfigured() bool {
	return PlategaMerchantID() != "" && PlategaSecret() != ""
}

func CreatePlategaTransaction(ctx context.Context, req *PlategaCreateTransactionRequest) (*PlategaCreateTransactionResponse, []byte, error) {
	if !PlategaConfigured() {
		return nil, nil, fmt.Errorf("platega credentials not configured")
	}
	if req == nil {
		return nil, nil, fmt.Errorf("missing platega request")
	}
	req.PaymentMethod = plategaPaymentMethodSBPQR
	if req.PaymentDetails.Currency == "" {
		req.PaymentDetails.Currency = "RUB"
	}
	if strings.TrimSpace(req.Description) == "" {
		req.Description = "APIMaster.ai balance top-up"
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, nil, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, plategaBaseURL+plategaCreatePath, bytes.NewReader(body))
	if err != nil {
		return nil, nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-MerchantId", PlategaMerchantID())
	httpReq.Header.Set("X-Secret", PlategaSecret())

	resp, err := plategaHTTPClient.Do(httpReq)
	if err != nil {
		return nil, body, fmt.Errorf("platega create request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, body, err
	}
	if resp.StatusCode >= http.StatusBadRequest {
		return nil, body, fmt.Errorf("platega create error (%d): %s", resp.StatusCode, string(respBody))
	}

	var result PlategaCreateTransactionResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, body, fmt.Errorf("decode platega create response: %w", err)
	}
	if strings.TrimSpace(result.TransactionId) == "" || strings.TrimSpace(result.Redirect) == "" {
		return nil, body, fmt.Errorf("platega returned incomplete transaction response")
	}
	return &result, body, nil
}

func GetPlategaTransactionStatus(ctx context.Context, transactionId string) (*PlategaTransactionStatusResponse, error) {
	if !PlategaConfigured() {
		return nil, fmt.Errorf("platega credentials not configured")
	}
	transactionId = strings.TrimSpace(transactionId)
	if transactionId == "" {
		return nil, fmt.Errorf("missing transaction id")
	}

	url := fmt.Sprintf("%s/transaction/%s", plategaBaseURL, transactionId)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-MerchantId", PlategaMerchantID())
	httpReq.Header.Set("X-Secret", PlategaSecret())

	resp, err := plategaHTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("platega status request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= http.StatusBadRequest {
		return nil, fmt.Errorf("platega status error (%d): %s", resp.StatusCode, string(respBody))
	}

	var result PlategaTransactionStatusResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("decode platega status response: %w", err)
	}
	return &result, nil
}

func ParsePlategaCallbackAmount(raw json.RawMessage) (float64, error) {
	if len(raw) == 0 {
		return 0, fmt.Errorf("missing amount")
	}
	var f float64
	if err := json.Unmarshal(raw, &f); err == nil {
		return f, nil
	}
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		s = strings.ReplaceAll(strings.TrimSpace(s), ",", ".")
		var parsed float64
		if _, err := fmt.Sscanf(s, "%f", &parsed); err == nil {
			return parsed, nil
		}
	}
	return 0, fmt.Errorf("invalid platega amount: %s", string(raw))
}

func PlategaAmountsMatch(expected, actual float64) bool {
	if math.Abs(expected-actual) < 0.011 {
		return true
	}
	// Platega SBP QR callbacks bill base amount + merchant fee (e.g. 1.00 → 1.09 RUB).
	fee := setting.PlategaFeePercent
	if fee <= 0 {
		fee = 8.5
	}
	maxWithFee := expected * (1 + fee/100.0)
	return actual+0.011 >= expected && actual <= maxWithFee+0.02
}
