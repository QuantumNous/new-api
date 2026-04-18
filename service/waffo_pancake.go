package service

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"fmt"
	"io"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
)

const (
	waffoPancakeAuthBaseURL      = "https://waffo-pancake-auth-service.vercel.app"
	waffoPancakeCheckoutPath     = "/v1/actions/checkout/create-session"
	waffoPancakeDefaultTolerance = 5 * time.Minute
)

type WaffoPancakePriceSnapshot struct {
	Amount      string `json:"amount"`
	TaxIncluded bool   `json:"taxIncluded"`
	TaxCategory string `json:"taxCategory"`
}

type WaffoPancakeCreateSessionParams struct {
	StoreID          string                     `json:"storeId"`
	ProductID        string                     `json:"productId"`
	ProductType      string                     `json:"productType"`
	Currency         string                     `json:"currency"`
	PriceSnapshot    *WaffoPancakePriceSnapshot `json:"priceSnapshot,omitempty"`
	BuyerEmail       string                     `json:"buyerEmail,omitempty"`
	SuccessURL       string                     `json:"successUrl,omitempty"`
	ExpiresInSeconds *int                       `json:"expiresInSeconds,omitempty"`
}

type WaffoPancakeCheckoutSession struct {
	SessionID   string `json:"sessionId"`
	CheckoutURL string `json:"checkoutUrl"`
	ExpiresAt   string `json:"expiresAt"`
	OrderID     string `json:"orderId"`
}

type waffoPancakeAPIError struct {
	Message string `json:"message"`
	Layer   string `json:"layer"`
}

type waffoPancakeCreateSessionResponse struct {
	Data   *WaffoPancakeCheckoutSession `json:"data"`
	Errors []waffoPancakeAPIError       `json:"errors"`
}

type waffoPancakeWebhookData struct {
	ID          string          `json:"id"`
	OrderID     string          `json:"orderId"`
	BuyerEmail  string          `json:"buyerEmail"`
	Currency    string          `json:"currency"`
	Amount      dto.StringValue `json:"amount"`
	TaxAmount   dto.StringValue `json:"taxAmount"`
	ProductName string          `json:"productName"`
}

type waffoPancakeWebhookEvent struct {
	ID        string                  `json:"id"`
	Timestamp string                  `json:"timestamp"`
	EventType string                  `json:"eventType"`
	EventID   string                  `json:"eventId"`
	StoreID   string                  `json:"storeId"`
	Mode      string                  `json:"mode"`
	Data      waffoPancakeWebhookData `json:"data"`
}

func (e *waffoPancakeWebhookEvent) NormalizedEventType() string {
	if e == nil {
		return ""
	}
	return e.EventType
}

func CreateWaffoPancakeCheckoutSession(ctx context.Context, params *WaffoPancakeCreateSessionParams) (*WaffoPancakeCheckoutSession, error) {
	if params == nil {
		return nil, fmt.Errorf("missing checkout params")
	}

	body, err := common.Marshal(params)
	if err != nil {
		return nil, fmt.Errorf("marshal Waffo Pancake checkout payload: %w", err)
	}

	privateKey, err := normalizeRSAPrivateKey(setting.WaffoPancakePrivateKey)
	if err != nil {
		return nil, err
	}

	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	signature, err := signWaffoPancakeRequest(http.MethodPost, waffoPancakeCheckoutPath, timestamp, string(body), privateKey)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, waffoPancakeAuthBaseURL+waffoPancakeCheckoutPath, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("build Waffo Pancake checkout request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Merchant-Id", setting.WaffoPancakeMerchantID)
	req.Header.Set("X-Timestamp", timestamp)
	req.Header.Set("X-Signature", signature)
	if setting.WaffoPancakeSandbox {
		req.Header.Set("X-Environment", "test")
	} else {
		req.Header.Set("X-Environment", "prod")
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request Waffo Pancake checkout session: %w", err)
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read Waffo Pancake checkout response: %w", err)
	}

	var result waffoPancakeCreateSessionResponse
	if err := common.Unmarshal(responseBody, &result); err != nil {
		return nil, fmt.Errorf("decode Waffo Pancake checkout response: %w", err)
	}
	if resp.StatusCode >= http.StatusBadRequest {
		if len(result.Errors) > 0 {
			return nil, fmt.Errorf("Waffo Pancake error (%d): %s", resp.StatusCode, result.Errors[0].Message)
		}
		return nil, fmt.Errorf("Waffo Pancake checkout request failed with status %d", resp.StatusCode)
	}
	if len(result.Errors) > 0 {
		return nil, fmt.Errorf("Waffo Pancake error: %s", result.Errors[0].Message)
	}
	if result.Data == nil || result.Data.CheckoutURL == "" || strings.TrimSpace(result.Data.SessionID) == "" {
		return nil, fmt.Errorf("Waffo Pancake returned empty checkout session")
	}
	return result.Data, nil
}

func VerifyConfiguredWaffoPancakeWebhook(payload string, signatureHeader string) (*waffoPancakeWebhookEvent, error) {
	environment := resolveWaffoPancakeWebhookEnvironment(payload)
	return verifyWaffoPancakeWebhook(payload, signatureHeader, environment)
}

func ResolveWaffoPancakeTradeNo(event *waffoPancakeWebhookEvent) (string, error) {
	if event == nil {
		return "", fmt.Errorf("missing webhook event")
	}

	if tradeNo := strings.TrimSpace(event.Data.OrderID); tradeNo != "" {
		topUp := model.GetTopUpByTradeNo(tradeNo)
		if topUp != nil && topUp.PaymentMethod == model.PaymentMethodWaffoPancake {
			return tradeNo, nil
		}
		return "", fmt.Errorf("waffo pancake order not found for webhook orderId=%s", tradeNo)
	}

	return "", fmt.Errorf("missing webhook orderId")
}

func normalizeRSAPrivateKey(raw string) (string, error) {
	return normalizePEMKey(raw, "PRIVATE KEY", "RSA PRIVATE KEY")
}

func normalizeRSAPublicKey(raw string) (string, error) {
	return normalizePEMKey(raw, "PUBLIC KEY", "RSA PUBLIC KEY")
}

func normalizePEMKey(raw string, pkcs8Type string, pkcs1Type string) (string, error) {
	if strings.TrimSpace(raw) == "" {
		return "", fmt.Errorf("%s is empty", strings.ToLower(pkcs8Type))
	}

	normalized := strings.TrimSpace(strings.ReplaceAll(raw, `\n`, "\n"))
	if strings.Contains(normalized, "BEGIN ") {
		block, _ := pem.Decode([]byte(normalized))
		if block == nil {
			return "", fmt.Errorf("invalid PEM encoded %s", strings.ToLower(pkcs8Type))
		}
		return string(pem.EncodeToMemory(block)), nil
	}

	der, err := base64.StdEncoding.DecodeString(strings.ReplaceAll(normalized, "\n", ""))
	if err != nil {
		return "", fmt.Errorf("invalid base64 encoded %s: %w", strings.ToLower(pkcs8Type), err)
	}

	pemType := pkcs8Type
	if pkcs8Type == "PRIVATE KEY" {
		if _, err := x509.ParsePKCS8PrivateKey(der); err != nil {
			if _, err := x509.ParsePKCS1PrivateKey(der); err == nil {
				pemType = pkcs1Type
			} else {
				return "", fmt.Errorf("invalid RSA private key")
			}
		}
	} else {
		if _, err := x509.ParsePKIXPublicKey(der); err != nil {
			if _, err := x509.ParsePKCS1PublicKey(der); err == nil {
				pemType = pkcs1Type
			} else {
				return "", fmt.Errorf("invalid RSA public key")
			}
		}
	}

	return string(pem.EncodeToMemory(&pem.Block{Type: pemType, Bytes: der})), nil
}

func signWaffoPancakeRequest(method string, path string, timestamp string, body string, privateKeyPEM string) (string, error) {
	block, _ := pem.Decode([]byte(privateKeyPEM))
	if block == nil {
		return "", fmt.Errorf("invalid RSA private key PEM")
	}

	var privateKey *rsa.PrivateKey
	switch block.Type {
	case "PRIVATE KEY":
		key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
		if err != nil {
			return "", fmt.Errorf("parse PKCS#8 private key: %w", err)
		}
		parsed, ok := key.(*rsa.PrivateKey)
		if !ok {
			return "", fmt.Errorf("private key is not RSA")
		}
		privateKey = parsed
	case "RSA PRIVATE KEY":
		key, err := x509.ParsePKCS1PrivateKey(block.Bytes)
		if err != nil {
			return "", fmt.Errorf("parse PKCS#1 private key: %w", err)
		}
		privateKey = key
	default:
		return "", fmt.Errorf("unsupported private key type: %s", block.Type)
	}

	canonicalRequest := buildWaffoPancakeCanonicalRequest(method, path, timestamp, body)
	digest := sha256.Sum256([]byte(canonicalRequest))
	signature, err := rsa.SignPKCS1v15(nil, privateKey, crypto.SHA256, digest[:])
	if err != nil {
		return "", fmt.Errorf("sign Waffo Pancake request: %w", err)
	}
	return base64.StdEncoding.EncodeToString(signature), nil
}

func buildWaffoPancakeCanonicalRequest(method string, path string, timestamp string, body string) string {
	bodyHash := sha256.Sum256([]byte(body))
	return fmt.Sprintf(
		"%s\n%s\n%s\n%s",
		strings.ToUpper(method),
		path,
		timestamp,
		base64.StdEncoding.EncodeToString(bodyHash[:]),
	)
}

func verifyWaffoPancakeWebhook(payload string, signatureHeader string, environment string) (*waffoPancakeWebhookEvent, error) {
	if signatureHeader == "" {
		return nil, fmt.Errorf("missing X-Waffo-Signature header")
	}

	timestampPart, signaturePart := parseWaffoPancakeSignatureHeader(signatureHeader)
	if timestampPart == "" || signaturePart == "" {
		return nil, fmt.Errorf("malformed X-Waffo-Signature header")
	}

	timestampMs, err := strconv.ParseInt(timestampPart, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid timestamp in X-Waffo-Signature header")
	}
	if math.Abs(float64(time.Now().UnixMilli()-timestampMs)) > float64(waffoPancakeDefaultTolerance.Milliseconds()) {
		return nil, fmt.Errorf("webhook timestamp outside tolerance window")
	}

	signatureInput := fmt.Sprintf("%s.%s", timestampPart, payload)
	if err := verifyWaffoPancakeWebhookWithKey(signatureInput, signaturePart, resolveWaffoPancakeWebhookPublicKey(environment)); err != nil {
		return nil, fmt.Errorf("invalid webhook signature")
	}

	var event waffoPancakeWebhookEvent
	if err := common.Unmarshal([]byte(payload), &event); err != nil {
		return nil, fmt.Errorf("parse Waffo Pancake webhook payload: %w", err)
	}
	return &event, nil
}

func parseWaffoPancakeSignatureHeader(header string) (string, string) {
	var timestampPart string
	var signaturePart string
	for _, pair := range strings.Split(header, ",") {
		key, value, found := strings.Cut(strings.TrimSpace(pair), "=")
		if !found {
			continue
		}
		switch key {
		case "t":
			timestampPart = value
		case "v1":
			signaturePart = value
		}
	}
	return timestampPart, signaturePart
}

func resolveWaffoPancakeWebhookEnvironment(payload string) string {
	var envelope struct {
		Mode string `json:"mode"`
	}
	if err := common.Unmarshal([]byte(payload), &envelope); err != nil {
		if setting.WaffoPancakeSandbox {
			return "test"
		}
		return "prod"
	}

	switch strings.ToLower(strings.TrimSpace(envelope.Mode)) {
	case "test":
		return "test"
	case "prod":
		return "prod"
	default:
		if setting.WaffoPancakeSandbox {
			return "test"
		}
		return "prod"
	}
}

func resolveWaffoPancakeWebhookPublicKey(environment string) string {
	if environment == "prod" {
		return strings.TrimSpace(setting.WaffoPancakeWebhookPublicKey)
	}
	return strings.TrimSpace(setting.WaffoPancakeWebhookTestKey)
}

func verifyWaffoPancakeWebhookWithKey(signatureInput string, signaturePart string, rawPublicKey string) error {
	publicKeyPEM, err := normalizeRSAPublicKey(rawPublicKey)
	if err != nil {
		return err
	}

	block, _ := pem.Decode([]byte(publicKeyPEM))
	if block == nil {
		return fmt.Errorf("invalid RSA public key PEM")
	}

	var publicKey *rsa.PublicKey
	switch block.Type {
	case "PUBLIC KEY":
		key, err := x509.ParsePKIXPublicKey(block.Bytes)
		if err != nil {
			return fmt.Errorf("parse PKIX public key: %w", err)
		}
		parsed, ok := key.(*rsa.PublicKey)
		if !ok {
			return fmt.Errorf("public key is not RSA")
		}
		publicKey = parsed
	case "RSA PUBLIC KEY":
		key, err := x509.ParsePKCS1PublicKey(block.Bytes)
		if err != nil {
			return fmt.Errorf("parse PKCS#1 public key: %w", err)
		}
		publicKey = key
	default:
		return fmt.Errorf("unsupported public key type: %s", block.Type)
	}

	signature, err := base64.StdEncoding.DecodeString(signaturePart)
	if err != nil {
		return fmt.Errorf("decode webhook signature: %w", err)
	}

	digest := sha256.Sum256([]byte(signatureInput))
	if err := rsa.VerifyPKCS1v15(publicKey, crypto.SHA256, digest[:], signature); err != nil {
		return fmt.Errorf("verify webhook signature: %w", err)
	}
	return nil
}
