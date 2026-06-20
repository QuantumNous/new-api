package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/setting"
)

const (
	payPalSandboxBaseURL = "https://api-m.sandbox.paypal.com"
	payPalLiveBaseURL    = "https://api-m.paypal.com"
)

var (
	payPalTokenMu     sync.Mutex
	payPalAccessToken string
	payPalTokenExpiry time.Time
)

func payPalBaseURL() string {
	if setting.PayPalSandbox {
		return payPalSandboxBaseURL
	}
	return payPalLiveBaseURL
}

func payPalHTTPClient() *http.Client {
	client := GetHttpClient()
	if client != nil {
		return client
	}
	return http.DefaultClient
}

func getPayPalAccessToken() (string, error) {
	payPalTokenMu.Lock()
	defer payPalTokenMu.Unlock()

	if payPalAccessToken != "" && time.Now().Before(payPalTokenExpiry) {
		return payPalAccessToken, nil
	}

	req, err := http.NewRequest(http.MethodPost, payPalBaseURL()+"/v1/oauth2/token", strings.NewReader("grant_type=client_credentials"))
	if err != nil {
		return "", err
	}
	req.SetBasicAuth(setting.PayPalClientID, setting.PayPalClientSecret)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := payPalHTTPClient().Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("paypal oauth failed: %s", string(body))
	}

	var parsed struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return "", err
	}
	if strings.TrimSpace(parsed.AccessToken) == "" {
		return "", fmt.Errorf("paypal oauth returned empty token")
	}

	payPalAccessToken = parsed.AccessToken
	expiresIn := parsed.ExpiresIn
	if expiresIn <= 0 {
		expiresIn = 3600
	}
	payPalTokenExpiry = time.Now().Add(time.Duration(expiresIn-60) * time.Second)
	return payPalAccessToken, nil
}

type payPalCreateOrderRequest struct {
	Intent        string `json:"intent"`
	PurchaseUnits []struct {
		ReferenceID string `json:"reference_id"`
		CustomID    string `json:"custom_id"`
		Amount      struct {
			CurrencyCode string `json:"currency_code"`
			Value        string `json:"value"`
		} `json:"amount"`
		Description string `json:"description"`
	} `json:"purchase_units"`
	ApplicationContext struct {
		ReturnURL string `json:"return_url"`
		CancelURL string `json:"cancel_url"`
		BrandName string `json:"brand_name"`
	} `json:"application_context"`
}

type payPalLink struct {
	Href string `json:"href"`
	Rel  string `json:"rel"`
}

type payPalCreateOrderResponse struct {
	ID    string       `json:"id"`
	Links []payPalLink `json:"links"`
}

func FormatPayPalAmount(amount float64) string {
	return strconv.FormatFloat(amount, 'f', 2, 64)
}

func CreatePayPalOrder(referenceID string, amountUSD float64, returnURL, cancelURL string) (approveURL, orderID string, err error) {
	token, err := getPayPalAccessToken()
	if err != nil {
		return "", "", err
	}

	payload := payPalCreateOrderRequest{
		Intent: "CAPTURE",
	}
	payload.PurchaseUnits = append(payload.PurchaseUnits, struct {
		ReferenceID string `json:"reference_id"`
		CustomID    string `json:"custom_id"`
		Amount      struct {
			CurrencyCode string `json:"currency_code"`
			Value        string `json:"value"`
		} `json:"amount"`
		Description string `json:"description"`
	}{
		ReferenceID: referenceID,
		CustomID:    referenceID,
		Amount: struct {
			CurrencyCode string `json:"currency_code"`
			Value        string `json:"value"`
		}{
			CurrencyCode: "USD",
			Value:        FormatPayPalAmount(amountUSD),
		},
		Description: "APIMaster wallet top-up",
	})
	payload.ApplicationContext.ReturnURL = returnURL
	payload.ApplicationContext.CancelURL = cancelURL
	payload.ApplicationContext.BrandName = "APIMaster"

	body, err := json.Marshal(payload)
	if err != nil {
		return "", "", err
	}

	req, err := http.NewRequest(http.MethodPost, payPalBaseURL()+"/v2/checkout/orders", bytes.NewReader(body))
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := payPalHTTPClient().Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", err
	}
	if resp.StatusCode >= 300 {
		return "", "", fmt.Errorf("paypal create order failed: %s", string(respBody))
	}

	var parsed payPalCreateOrderResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return "", "", err
	}
	for _, link := range parsed.Links {
		if link.Rel == "approve" {
			return link.Href, parsed.ID, nil
		}
	}
	return "", parsed.ID, fmt.Errorf("paypal approve link not found")
}

func CapturePayPalOrder(orderID string) error {
	token, err := getPayPalAccessToken()
	if err != nil {
		return err
	}

	req, err := http.NewRequest(http.MethodPost, payPalBaseURL()+"/v2/checkout/orders/"+orderID+"/capture", bytes.NewReader([]byte("{}")))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := payPalHTTPClient().Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.StatusCode >= 300 {
		return fmt.Errorf("paypal capture failed: %s", string(respBody))
	}
	return nil
}

type payPalVerifyWebhookRequest struct {
	AuthAlgo         string          `json:"auth_algo"`
	CertURL          string          `json:"cert_url"`
	TransmissionID   string          `json:"transmission_id"`
	TransmissionSig  string          `json:"transmission_sig"`
	TransmissionTime string          `json:"transmission_time"`
	WebhookID        string          `json:"webhook_id"`
	WebhookEvent     json.RawMessage `json:"webhook_event"`
}

func VerifyPayPalWebhook(headers http.Header, body []byte) error {
	token, err := getPayPalAccessToken()
	if err != nil {
		return err
	}

	payload := payPalVerifyWebhookRequest{
		AuthAlgo:         headers.Get("Paypal-Auth-Algo"),
		CertURL:          headers.Get("Paypal-Cert-Url"),
		TransmissionID:   headers.Get("Paypal-Transmission-Id"),
		TransmissionSig:  headers.Get("Paypal-Transmission-Sig"),
		TransmissionTime: headers.Get("Paypal-Transmission-Time"),
		WebhookID:        setting.PayPalWebhookID,
		WebhookEvent:     json.RawMessage(body),
	}
	if payload.AuthAlgo == "" {
		payload.AuthAlgo = headers.Get("PAYPAL-AUTH-ALGO")
		payload.CertURL = headers.Get("PAYPAL-CERT-URL")
		payload.TransmissionID = headers.Get("PAYPAL-TRANSMISSION-ID")
		payload.TransmissionSig = headers.Get("PAYPAL-TRANSMISSION-SIG")
		payload.TransmissionTime = headers.Get("PAYPAL-TRANSMISSION-TIME")
	}

	reqBody, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest(http.MethodPost, payPalBaseURL()+"/v1/notifications/verify-webhook-signature", bytes.NewReader(reqBody))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := payPalHTTPClient().Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.StatusCode >= 300 {
		return fmt.Errorf("paypal webhook verify request failed: %s", string(respBody))
	}

	var parsed struct {
		VerificationStatus string `json:"verification_status"`
	}
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return err
	}
	if strings.ToUpper(parsed.VerificationStatus) != "SUCCESS" {
		return fmt.Errorf("paypal webhook verification failed: %s", parsed.VerificationStatus)
	}
	return nil
}
