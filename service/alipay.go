package service

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
)

const (
	AlipayMethodPagePay  = "alipay.trade.page.pay"
	AlipayGatewayDefault = "https://openapi.alipay.com/gateway.do"
	AlipaySignTypeRSA2   = "RSA2"
)

type AlipayPagePayBizContent struct {
	OutTradeNo     string `json:"out_trade_no"`
	TotalAmount    string `json:"total_amount"`
	Subject        string `json:"subject"`
	Body           string `json:"body,omitempty"`
	ProductCode    string `json:"product_code"`
	TimeoutExpress string `json:"timeout_express,omitempty"`
}

func ResolveAlipayGateway() string {
	gateway := strings.TrimSpace(setting.AlipayGateway)
	if gateway == "" {
		return AlipayGatewayDefault
	}
	return gateway
}

func BuildAlipayPagePay(tradeNo string, amount float64, subject string, body string, returnURL string, notifyURL string) (string, map[string]string, error) {
	cfg, err := resolveAlipayConfig()
	if err != nil {
		return "", nil, err
	}
	if tradeNo == "" {
		return "", nil, errors.New("tradeNo is empty")
	}
	if amount <= 0 {
		return "", nil, errors.New("amount must be greater than zero")
	}

	bizContent := AlipayPagePayBizContent{
		OutTradeNo:     tradeNo,
		TotalAmount:    fmt.Sprintf("%.2f", amount),
		Subject:        subject,
		Body:           body,
		ProductCode:    "FAST_INSTANT_TRADE_PAY",
		TimeoutExpress: "15m",
	}

	params := map[string]string{
		"app_id":      cfg.AppID,
		"biz_content": common.GetJsonString(bizContent),
		"charset":     "utf-8",
		"format":      "JSON",
		"method":      AlipayMethodPagePay,
		"notify_url":  notifyURL,
		"return_url":  returnURL,
		"sign_type":   AlipaySignTypeRSA2,
		"timestamp":   time.Now().Format("2006-01-02 15:04:05"),
		"version":     "1.0",
	}

	sign, err := signAlipayParams(params, cfg.PrivateKey)
	if err != nil {
		return "", nil, err
	}
	params["sign"] = sign
	return cfg.Gateway, params, nil
}

func VerifyAlipayParams(params map[string]string) error {
	cfg, err := resolveAlipayConfig()
	if err != nil {
		return err
	}
	if len(params) == 0 {
		return errors.New("empty alipay params")
	}

	if appID := strings.TrimSpace(params["app_id"]); appID != "" && appID != cfg.AppID {
		return fmt.Errorf("app_id mismatch: %s", appID)
	}

	if strings.TrimSpace(params["sign"]) == "" {
		return errors.New("missing sign")
	}
	signType := strings.ToUpper(strings.TrimSpace(params["sign_type"]))
	if signType != "" && signType != AlipaySignTypeRSA2 {
		return fmt.Errorf("unsupported sign_type: %s", signType)
	}
	if strings.TrimSpace(params["trade_status"]) == "" {
		return errors.New("missing trade_status")
	}

	return verifyAlipayParams(params, cfg.PublicKey)
}

type alipayConfig struct {
	AppID      string
	Gateway    string
	PrivateKey *rsa.PrivateKey
	PublicKey  *rsa.PublicKey
}

func resolveAlipayConfig() (*alipayConfig, error) {
	appID := strings.TrimSpace(setting.AlipayAppId)
	privateKeyStr := strings.TrimSpace(setting.AlipayPrivateKey)
	publicKeyStr := strings.TrimSpace(setting.AlipayPublicKey)
	gateway := ResolveAlipayGateway()
	if appID == "" || privateKeyStr == "" || publicKeyStr == "" || gateway == "" {
		return nil, errors.New("alipay config is incomplete")
	}

	privateKey, err := parseAlipayPrivateKey(privateKeyStr)
	if err != nil {
		return nil, err
	}
	publicKey, err := parseAlipayPublicKey(publicKeyStr)
	if err != nil {
		return nil, err
	}

	return &alipayConfig{
		AppID:      appID,
		Gateway:    gateway,
		PrivateKey: privateKey,
		PublicKey:  publicKey,
	}, nil
}

func signAlipayParams(params map[string]string, privateKey *rsa.PrivateKey) (string, error) {
	content := buildAlipaySignContent(params)
	hash := sha256.Sum256([]byte(content))
	signBytes, err := rsa.SignPKCS1v15(rand.Reader, privateKey, crypto.SHA256, hash[:])
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(signBytes), nil
}

func verifyAlipayParams(params map[string]string, publicKey *rsa.PublicKey) error {
	sign := strings.TrimSpace(params["sign"])
	content := buildAlipaySignContent(params)
	signBytes, err := base64.StdEncoding.DecodeString(sign)
	if err != nil {
		return err
	}
	hash := sha256.Sum256([]byte(content))
	return rsa.VerifyPKCS1v15(publicKey, crypto.SHA256, hash[:], signBytes)
}

func buildAlipaySignContent(params map[string]string) string {
	keys := make([]string, 0, len(params))
	for key, value := range params {
		if key == "sign" || key == "sign_type" {
			continue
		}
		if strings.TrimSpace(value) == "" {
			continue
		}
		keys = append(keys, key)
	}
	sort.Strings(keys)

	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		parts = append(parts, fmt.Sprintf("%s=%s", key, params[key]))
	}
	return strings.Join(parts, "&")
}

func parseAlipayPrivateKey(raw string) (*rsa.PrivateKey, error) {
	der, err := decodeAlipayKeyBytes(raw)
	if err != nil {
		return nil, err
	}
	if pk, err := x509.ParsePKCS8PrivateKey(der); err == nil {
		if rsaKey, ok := pk.(*rsa.PrivateKey); ok {
			return rsaKey, nil
		}
		return nil, errors.New("alipay private key is not rsa")
	}
	if rsaKey, err := x509.ParsePKCS1PrivateKey(der); err == nil {
		return rsaKey, nil
	}
	return nil, errors.New("failed to parse alipay private key")
}

func parseAlipayPublicKey(raw string) (*rsa.PublicKey, error) {
	der, err := decodeAlipayKeyBytes(raw)
	if err != nil {
		return nil, err
	}
	if pk, err := x509.ParsePKIXPublicKey(der); err == nil {
		if rsaKey, ok := pk.(*rsa.PublicKey); ok {
			return rsaKey, nil
		}
		return nil, errors.New("alipay public key is not rsa")
	}
	if rsaKey, err := x509.ParsePKCS1PublicKey(der); err == nil {
		return rsaKey, nil
	}
	return nil, errors.New("failed to parse alipay public key")
}

func decodeAlipayKeyBytes(raw string) ([]byte, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, errors.New("empty alipay key")
	}
	if block, _ := pem.Decode([]byte(trimmed)); block != nil {
		return block.Bytes, nil
	}
	compact := strings.Map(func(r rune) rune {
		switch r {
		case '\n', '\r', '\t', ' ':
			return -1
		default:
			return r
		}
	}, trimmed)
	der, err := base64.StdEncoding.DecodeString(compact)
	if err != nil {
		return nil, err
	}
	return der, nil
}
