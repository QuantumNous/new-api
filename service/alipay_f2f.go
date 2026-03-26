package service

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

const (
	PaymentMethodAlipayF2F = "alipay_f2f"

	AlipaySceneTopUp        = "topup"
	AlipaySceneSubscription = "subscription"

	alipayCharset    = "utf-8"
	alipayFormat     = "JSON"
	alipaySignType   = "RSA2"
	alipayVersion    = "1.0"
	alipayTimeout    = "5m"
	alipayTimeLayout = "2006-01-02 15:04:05"

	defaultAlipayReturnTo = "/console/topup"
)

type AlipayOrderPayload struct {
	Scene         string            `json:"scene,omitempty"`
	Title         string            `json:"title,omitempty"`
	QRCode        string            `json:"qr_code,omitempty"`
	ReturnTo      string            `json:"return_to,omitempty"`
	ExpiresAt     int64             `json:"expires_at,omitempty"`
	NotifyPayload map[string]string `json:"notify_payload,omitempty"`
	QueryPayload  map[string]any    `json:"query_payload,omitempty"`
}

type AlipayPrecreateArgs struct {
	TradeNo     string
	Subject     string
	TotalAmount float64
	NotifyURL   string
}

type AlipayPrecreateResult struct {
	TradeNo string
	QRCode  string
}

type AlipayTradeQueryResult struct {
	TradeNo         string
	UpstreamTradeNo string
	TradeStatus     string
	TotalAmount     string
}

type alipayTradePrecreateEnvelope struct {
	Response alipayTradePrecreateResponse `json:"alipay_trade_precreate_response"`
	Sign     string                       `json:"sign"`
}

type alipayTradePrecreateResponse struct {
	Code       string `json:"code"`
	Msg        string `json:"msg"`
	SubCode    string `json:"sub_code"`
	SubMsg     string `json:"sub_msg"`
	OutTradeNo string `json:"out_trade_no"`
	QRCode     string `json:"qr_code"`
}

type alipayTradeQueryEnvelope struct {
	Response alipayTradeQueryResponse `json:"alipay_trade_query_response"`
	Sign     string                   `json:"sign"`
}

type alipayTradeQueryResponse struct {
	Code        string `json:"code"`
	Msg         string `json:"msg"`
	SubCode     string `json:"sub_code"`
	SubMsg      string `json:"sub_msg"`
	OutTradeNo  string `json:"out_trade_no"`
	TradeNo     string `json:"trade_no"`
	TradeStatus string `json:"trade_status"`
	TotalAmount string `json:"total_amount"`
}

func AlipayF2FReady() bool {
	return setting.AlipayF2FEnabled &&
		strings.TrimSpace(setting.AlipayF2FAppID) != "" &&
		strings.TrimSpace(setting.AlipayF2FPrivateKey) != "" &&
		strings.TrimSpace(setting.AlipayF2FPublicKey) != "" &&
		strings.TrimSpace(GetAlipayF2FNotifyURL()) != ""
}

func GetAlipayF2FNotifyURL() string {
	if strings.TrimSpace(setting.AlipayF2FNotifyUrl) != "" {
		return strings.TrimSpace(setting.AlipayF2FNotifyUrl)
	}
	base := strings.TrimSpace(system_setting.ServerAddress)
	if base == "" {
		return ""
	}
	return strings.TrimRight(base, "/") + "/api/alipay/notify"
}

func NormalizeAbsoluteOrigin(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return ""
	}
	if parsed.Host == "" {
		return ""
	}
	return parsed.Scheme + "://" + parsed.Host
}

func ResolveRequestBaseURL(req *http.Request) string {
	if req == nil {
		return ""
	}
	if origin := NormalizeAbsoluteOrigin(req.Header.Get("Origin")); origin != "" {
		return origin
	}
	if referer := NormalizeAbsoluteOrigin(req.Referer()); referer != "" {
		return referer
	}
	return ""
}

func NormalizeInternalReturnTo(raw string, defaultPath string) string {
	defaultPath = strings.TrimSpace(defaultPath)
	if defaultPath == "" {
		defaultPath = defaultAlipayReturnTo
	}

	raw = strings.TrimSpace(raw)
	if raw == "" || strings.HasPrefix(raw, "//") {
		return defaultPath
	}

	parsed, err := url.Parse(raw)
	if err != nil {
		return defaultPath
	}
	if parsed.Scheme != "" || parsed.Host != "" {
		return defaultPath
	}
	if !strings.HasPrefix(parsed.Path, "/") {
		return defaultPath
	}
	if strings.ContainsAny(parsed.Path, "\r\n") {
		return defaultPath
	}

	result := parsed.Path
	if parsed.RawQuery != "" {
		result += "?" + parsed.RawQuery
	}
	if parsed.Fragment != "" {
		result += "#" + parsed.Fragment
	}
	return result
}

func BuildAlipayPaymentPageURL(tradeNo string, returnTo string, baseURL string) string {
	tradeNo = url.PathEscape(strings.TrimSpace(tradeNo))
	returnTo = NormalizeInternalReturnTo(returnTo, defaultAlipayReturnTo)
	query := url.Values{}
	query.Set("return_to", returnTo)
	path := fmt.Sprintf("/payment/alipay/%s?%s", tradeNo, query.Encode())
	base := strings.TrimSpace(baseURL)
	if base == "" {
		base = strings.TrimSpace(system_setting.ServerAddress)
	}
	if base == "" {
		return path
	}
	return strings.TrimRight(base, "/") + path
}

func ParseAlipayOrderPayload(raw string) AlipayOrderPayload {
	if strings.TrimSpace(raw) == "" {
		return AlipayOrderPayload{}
	}
	var payload AlipayOrderPayload
	if err := common.UnmarshalJsonStr(raw, &payload); err != nil {
		return AlipayOrderPayload{}
	}
	return payload
}

func MergeAlipayOrderPayload(baseRaw string, update *AlipayOrderPayload) string {
	base := ParseAlipayOrderPayload(baseRaw)
	if update != nil {
		if strings.TrimSpace(update.Scene) != "" {
			base.Scene = update.Scene
		}
		if strings.TrimSpace(update.Title) != "" {
			base.Title = update.Title
		}
		if strings.TrimSpace(update.QRCode) != "" {
			base.QRCode = update.QRCode
		}
		if strings.TrimSpace(update.ReturnTo) != "" {
			base.ReturnTo = update.ReturnTo
		}
		if update.ExpiresAt > 0 {
			base.ExpiresAt = update.ExpiresAt
		}
		if len(update.NotifyPayload) > 0 {
			base.NotifyPayload = update.NotifyPayload
		}
		if len(update.QueryPayload) > 0 {
			base.QueryPayload = update.QueryPayload
		}
	}
	jsonBytes, err := common.Marshal(base)
	if err != nil {
		return baseRaw
	}
	return string(jsonBytes)
}

func AlipayF2FPrecreate(ctx context.Context, args *AlipayPrecreateArgs) (*AlipayPrecreateResult, error) {
	if args == nil {
		return nil, fmt.Errorf("alipay precreate args is nil")
	}
	if !AlipayF2FReady() {
		return nil, fmt.Errorf("支付宝当面付未完成配置")
	}

	bizContentBytes, err := common.Marshal(map[string]any{
		"out_trade_no":    strings.TrimSpace(args.TradeNo),
		"total_amount":    fmt.Sprintf("%.2f", args.TotalAmount),
		"subject":         strings.TrimSpace(args.Subject),
		"timeout_express": alipayTimeout,
	})
	if err != nil {
		return nil, fmt.Errorf("marshal alipay precreate biz_content failed: %w", err)
	}

	var envelope alipayTradePrecreateEnvelope
	if err := doAlipayRequest(ctx, "alipay.trade.precreate", string(bizContentBytes), strings.TrimSpace(args.NotifyURL), &envelope); err != nil {
		return nil, err
	}

	resp := envelope.Response
	if resp.Code != "10000" {
		return nil, fmt.Errorf("支付宝预下单失败: %s %s", common.GetStringIfEmpty(resp.SubCode, resp.Code), common.GetStringIfEmpty(resp.SubMsg, resp.Msg))
	}
	if strings.TrimSpace(resp.QRCode) == "" {
		return nil, fmt.Errorf("支付宝预下单未返回二维码")
	}

	return &AlipayPrecreateResult{
		TradeNo: resp.OutTradeNo,
		QRCode:  resp.QRCode,
	}, nil
}

func AlipayF2FQuery(ctx context.Context, tradeNo string) (*AlipayTradeQueryResult, error) {
	if !AlipayF2FReady() {
		return nil, fmt.Errorf("支付宝当面付未完成配置")
	}
	bizContentBytes, err := common.Marshal(map[string]any{
		"out_trade_no": strings.TrimSpace(tradeNo),
	})
	if err != nil {
		return nil, fmt.Errorf("marshal alipay query biz_content failed: %w", err)
	}

	var envelope alipayTradeQueryEnvelope
	if err := doAlipayRequest(ctx, "alipay.trade.query", string(bizContentBytes), "", &envelope); err != nil {
		return nil, err
	}

	resp := envelope.Response
	if resp.Code != "10000" {
		return nil, fmt.Errorf("支付宝订单查询失败: %s %s", common.GetStringIfEmpty(resp.SubCode, resp.Code), common.GetStringIfEmpty(resp.SubMsg, resp.Msg))
	}
	return &AlipayTradeQueryResult{
		TradeNo:         resp.OutTradeNo,
		UpstreamTradeNo: resp.TradeNo,
		TradeStatus:     resp.TradeStatus,
		TotalAmount:     resp.TotalAmount,
	}, nil
}

func VerifyAlipayNotification(params map[string]string) error {
	if !AlipayF2FReady() {
		return fmt.Errorf("支付宝当面付未完成配置")
	}
	sign := strings.TrimSpace(params["sign"])
	if sign == "" {
		return fmt.Errorf("支付宝回调缺少签名")
	}
	publicKey, err := parseAlipayPublicKey(setting.AlipayF2FPublicKey)
	if err != nil {
		return err
	}
	content := buildAlipaySignContent(params)
	signBytes, err := base64.StdEncoding.DecodeString(sign)
	if err != nil {
		return fmt.Errorf("支付宝回调签名解码失败: %w", err)
	}
	sum := sha256.Sum256([]byte(content))
	if err := rsa.VerifyPKCS1v15(publicKey, crypto.SHA256, sum[:], signBytes); err != nil {
		return fmt.Errorf("支付宝回调验签失败: %w", err)
	}
	return nil
}

func IsAlipayTradeSuccess(tradeStatus string) bool {
	switch strings.TrimSpace(tradeStatus) {
	case "TRADE_SUCCESS", "TRADE_FINISHED":
		return true
	default:
		return false
	}
}

func IsAlipayTradeExpired(tradeStatus string) bool {
	return strings.TrimSpace(tradeStatus) == "TRADE_CLOSED"
}

func doAlipayRequest(ctx context.Context, method string, bizContent string, notifyURL string, out any) error {
	privateKey, err := parseAlipayPrivateKey(setting.AlipayF2FPrivateKey)
	if err != nil {
		return err
	}

	params := map[string]string{
		"app_id":      strings.TrimSpace(setting.AlipayF2FAppID),
		"method":      method,
		"format":      alipayFormat,
		"charset":     alipayCharset,
		"sign_type":   alipaySignType,
		"timestamp":   time.Now().Format(alipayTimeLayout),
		"version":     alipayVersion,
		"biz_content": bizContent,
	}
	if strings.TrimSpace(notifyURL) != "" {
		params["notify_url"] = strings.TrimSpace(notifyURL)
	}

	signContent := buildAlipaySignContent(params)
	signature, err := signAlipay(signContent, privateKey)
	if err != nil {
		return err
	}
	params["sign"] = signature

	form := url.Values{}
	for key, value := range params {
		form.Set(key, value)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, getAlipayGatewayURL(), strings.NewReader(form.Encode()))
	if err != nil {
		return fmt.Errorf("create alipay request failed: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := GetHttpClient()
	if client == nil {
		client = http.DefaultClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("request alipay gateway failed: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read alipay response failed: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("alipay gateway status %d: %s", resp.StatusCode, string(bodyBytes))
	}
	if err := common.Unmarshal(bodyBytes, out); err != nil {
		return fmt.Errorf("decode alipay response failed: %w", err)
	}
	return nil
}

func getAlipayGatewayURL() string {
	if setting.AlipayF2FSandbox {
		return "https://openapi-sandbox.dl.alipaydev.com/gateway.do"
	}
	return "https://openapi.alipay.com/gateway.do"
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
		parts = append(parts, key+"="+params[key])
	}
	return strings.Join(parts, "&")
}

func signAlipay(content string, privateKey *rsa.PrivateKey) (string, error) {
	sum := sha256.Sum256([]byte(content))
	signed, err := rsa.SignPKCS1v15(rand.Reader, privateKey, crypto.SHA256, sum[:])
	if err != nil {
		return "", fmt.Errorf("sign alipay request failed: %w", err)
	}
	return base64.StdEncoding.EncodeToString(signed), nil
}

func parseAlipayPrivateKey(raw string) (*rsa.PrivateKey, error) {
	derBytes, err := decodeKeyBytes(raw)
	if err != nil {
		return nil, fmt.Errorf("parse alipay private key failed: %w", err)
	}
	if key, err := x509.ParsePKCS8PrivateKey(derBytes); err == nil {
		if rsaKey, ok := key.(*rsa.PrivateKey); ok {
			return rsaKey, nil
		}
	}
	if rsaKey, err := x509.ParsePKCS1PrivateKey(derBytes); err == nil {
		return rsaKey, nil
	}
	return nil, fmt.Errorf("parse alipay private key failed: unsupported key format")
}

func parseAlipayPublicKey(raw string) (*rsa.PublicKey, error) {
	derBytes, err := decodeKeyBytes(raw)
	if err != nil {
		return nil, fmt.Errorf("parse alipay public key failed: %w", err)
	}
	if key, err := x509.ParsePKIXPublicKey(derBytes); err == nil {
		if rsaKey, ok := key.(*rsa.PublicKey); ok {
			return rsaKey, nil
		}
	}
	if cert, err := x509.ParseCertificate(derBytes); err == nil {
		if rsaKey, ok := cert.PublicKey.(*rsa.PublicKey); ok {
			return rsaKey, nil
		}
	}
	return nil, fmt.Errorf("parse alipay public key failed: unsupported key format")
}

func decodeKeyBytes(raw string) ([]byte, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, fmt.Errorf("empty key")
	}
	if block, _ := pem.Decode([]byte(raw)); block != nil {
		return block.Bytes, nil
	}
	compacted := strings.Map(func(r rune) rune {
		switch r {
		case '\r', '\n', '\t', ' ':
			return -1
		default:
			return r
		}
	}, raw)
	decoded, err := base64.StdEncoding.DecodeString(compacted)
	if err == nil {
		return decoded, nil
	}
	return []byte(raw), nil
}
