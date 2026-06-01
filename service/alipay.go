package service

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/smartwalle/alipay/v3"
	"github.com/smartwalle/ncrypto"
	"github.com/smartwalle/nsign"
	"golang.org/x/text/encoding/simplifiedchinese"
)

func NormalizeAlipayParams(values url.Values) map[string]string {
	result := make(map[string]string, len(values))
	for key, vals := range values {
		if key == "sign" || key == "sign_type" {
			continue
		}
		if len(vals) == 0 {
			result[key] = ""
			continue
		}
		result[key] = vals[0]
	}
	return result
}

func IsAlipayTradeSuccess(status string) bool {
	return status == "TRADE_SUCCESS" || status == "TRADE_FINISHED"
}

func BuildAlipaySignContent(params map[string]string) string {
	keys := make([]string, 0, len(params))
	for key, value := range params {
		if value == "" {
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

func ParsePKCS8PrivateKeyFromPEM(pemText string) (*rsa.PrivateKey, error) {
	normalized := normalizeAlipayKeyMaterial(pemText)
	block, _ := pem.Decode([]byte(normalized))
	if block != nil {
		key, err := parseAlipayPrivateKeyBytes(block.Bytes)
		if err != nil {
			return nil, err
		}
		return key, nil
	}

	rawKeyBytes, err := decodeRawAlipayKeyMaterial(normalized)
	if err != nil {
		return nil, errors.New("invalid private key pem")
	}
	return parseAlipayPrivateKeyBytes(rawKeyBytes)
}

func ParsePublicKeyFromPEM(pemText string) (*rsa.PublicKey, error) {
	normalized := normalizeAlipayKeyMaterial(pemText)
	block, _ := pem.Decode([]byte(normalized))
	if block != nil {
		pubAny, err := x509.ParsePKIXPublicKey(block.Bytes)
		if err != nil {
			return nil, err
		}
		pub, ok := pubAny.(*rsa.PublicKey)
		if !ok {
			return nil, errors.New("public key is not rsa")
		}
		return pub, nil
	}

	rawKeyBytes, err := decodeRawAlipayKeyMaterial(normalized)
	if err != nil {
		return nil, errors.New("invalid public key pem")
	}
	pubAny, err := x509.ParsePKIXPublicKey(rawKeyBytes)
	if err != nil {
		return nil, err
	}
	pub, ok := pubAny.(*rsa.PublicKey)
	if !ok {
		return nil, errors.New("public key is not rsa")
	}
	return pub, nil
}

func normalizeAlipayKeyMaterial(keyText string) string {
	return strings.TrimSpace(strings.ReplaceAll(keyText, "\r", ""))
}

func decodeRawAlipayKeyMaterial(keyText string) ([]byte, error) {
	return base64.StdEncoding.DecodeString(removeAlipayInlineWhitespace(keyText))
}

func removeAlipayInlineWhitespace(keyText string) string {
	var builder strings.Builder
	builder.Grow(len(keyText))
	for _, r := range keyText {
		switch r {
		case '\n', '\t', ' ':
			continue
		default:
			builder.WriteRune(r)
		}
	}
	return builder.String()
}

func parseAlipayPrivateKeyBytes(keyBytes []byte) (*rsa.PrivateKey, error) {
	keyAny, err := x509.ParsePKCS8PrivateKey(keyBytes)
	if err == nil {
		key, ok := keyAny.(*rsa.PrivateKey)
		if !ok {
			return nil, errors.New("private key is not rsa")
		}
		return key, nil
	}

	key, pkcs1Err := x509.ParsePKCS1PrivateKey(keyBytes)
	if pkcs1Err == nil {
		return key, nil
	}
	return nil, err
}

func SignAlipayContent(content string, privateKeyPEM string) (string, error) {
	key, err := ParsePKCS8PrivateKeyFromPEM(privateKeyPEM)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256([]byte(content))
	signature, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, sum[:])
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(signature), nil
}

func VerifyAlipaySignature(content string, signature string, publicKeyPEM string) error {
	rawSignature, err := decodeAlipaySignature(signature)
	if err != nil {
		return err
	}

	verifier, err := newAlipaySignatureVerifier(publicKeyPEM)
	if err != nil {
		return err
	}
	return verifier.VerifyBytes([]byte(content), rawSignature)
}

func decodeAlipaySignature(signature string) ([]byte, error) {
	normalized := removeAlipayInlineWhitespace(signature)
	if normalized == "" {
		return nil, errors.New("missing alipay signature")
	}

	rawSignature, err := base64.StdEncoding.DecodeString(normalized)
	if err == nil {
		return rawSignature, nil
	}
	return base64.RawStdEncoding.DecodeString(normalized)
}

func newAlipaySignatureVerifier(publicKeyPEM string) (nsign.Signer, error) {
	publicKey, err := parseSDKAlipayPublicKey(publicKeyPEM)
	if err != nil {
		publicKey, err = ParsePublicKeyFromPEM(publicKeyPEM)
		if err != nil {
			return nil, err
		}
	}

	return nsign.New(
		nsign.WithMethod(nsign.NewRSAMethod(crypto.SHA256, nil, publicKey)),
		nsign.WithEncoder(alipay.Encoder{}),
	), nil
}

func parseSDKAlipayPublicKey(publicKeyPEM string) (*rsa.PublicKey, error) {
	return ncrypto.DecodePublicKey([]byte(normalizeAlipayKeyMaterial(publicKeyPEM))).PKIX().RSAPublicKey()
}

type AlipayPagePayRequest struct {
	OutTradeNo     string
	TotalAmount    string
	Subject        string
	ReturnURL      string
	NotifyURL      string
	QuitURL        string
	TimeoutExpress string
	ProductCode    string
}

type AlipayTradeQueryResponse struct {
	Code        string `json:"code"`
	Msg         string `json:"msg"`
	SubCode     string `json:"sub_code"`
	SubMsg      string `json:"sub_msg"`
	OutTradeNo  string `json:"out_trade_no"`
	TradeNo     string `json:"trade_no"`
	TradeStatus string `json:"trade_status"`
}

type AlipayTradeQueryError struct {
	Response *AlipayTradeQueryResponse
}

func (e *AlipayTradeQueryError) Error() string {
	return BuildAlipayTradeQueryErrorMessage(e.Response)
}

func DefaultAlipayTimeoutExpress() string {
	return "30m"
}

func FormatAlipayTimestamp(ts time.Time) string {
	return ts.Format("2006-01-02 15:04:05")
}

func IsMobileBrowser(userAgent string) bool {
	ua := strings.ToLower(userAgent)
	return strings.Contains(ua, "iphone") ||
		strings.Contains(ua, "android") ||
		strings.Contains(ua, "mobile") ||
		strings.Contains(ua, "ipad")
}

func GetAlipayPayMethod(req *http.Request) string {
	if req != nil && IsMobileBrowser(req.UserAgent()) {
		return "alipay.trade.wap.pay"
	}
	return "alipay.trade.page.pay"
}

func GetAlipayProductCode(method string) string {
	if method == "alipay.trade.wap.pay" {
		return "QUICK_WAP_WAY"
	}
	return "FAST_INSTANT_TRADE_PAY"
}

func FormatAlipayAmount(amount float64) string {
	return strconv.FormatFloat(amount, 'f', 2, 64)
}

func newAlipayClient(gateway string, appID string, privateKeyPEM string, publicKeyPEM string) (*alipay.Client, error) {
	if strings.TrimSpace(appID) == "" {
		return nil, errors.New("missing alipay app id")
	}
	if strings.TrimSpace(privateKeyPEM) == "" {
		return nil, errors.New("missing alipay private key")
	}

	isProduction := !setting.AlipaySandbox
	opts := make([]alipay.OptionFunc, 0, 1)
	if trimmedGateway := strings.TrimSpace(gateway); trimmedGateway != "" {
		if isProduction {
			opts = append(opts, alipay.WithProductionGateway(trimmedGateway))
		} else {
			opts = append(opts, alipay.WithSandboxGateway(trimmedGateway))
		}
	}
	if httpClient := GetHttpClient(); httpClient != nil {
		opts = append(opts, alipay.WithHTTPClient(httpClient))
	}

	client, err := alipay.New(appID, privateKeyPEM, isProduction, opts...)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(publicKeyPEM) != "" {
		if err := client.LoadAliPayPublicKey(publicKeyPEM); err != nil {
			return nil, err
		}
	}
	return client, nil
}

func normalizeAlipayPayMethod(method string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(method)) {
	case "alipay.trade.page.pay":
		return "alipay.trade.page.pay", nil
	case "alipay.trade.wap.pay":
		return "alipay.trade.wap.pay", nil
	default:
		return "", fmt.Errorf("unsupported alipay pay method: %q", strings.TrimSpace(method))
	}
}

func BuildAlipayPayURL(gateway string, appID string, privateKeyPEM string, method string, req AlipayPagePayRequest) (string, error) {
	method, err := normalizeAlipayPayMethod(method)
	if err != nil {
		return "", err
	}
	if req.ProductCode == "" {
		req.ProductCode = GetAlipayProductCode(method)
	}

	client, err := newAlipayClient(gateway, appID, privateKeyPEM, setting.AlipayPublicKey)
	if err != nil {
		return "", err
	}

	if method == "alipay.trade.wap.pay" {
		payURL, err := client.TradeWapPay(alipay.TradeWapPay{
			Trade: alipay.Trade{
				NotifyURL:      req.NotifyURL,
				ReturnURL:      req.ReturnURL,
				OutTradeNo:     req.OutTradeNo,
				TotalAmount:    req.TotalAmount,
				Subject:        req.Subject,
				ProductCode:    req.ProductCode,
				TimeoutExpress: req.TimeoutExpress,
			},
			QuitURL: req.QuitURL,
		})
		if err != nil {
			return "", err
		}
		return payURL.String(), nil
	}

	payURL, err := client.TradePagePay(alipay.TradePagePay{
		Trade: alipay.Trade{
			NotifyURL:      req.NotifyURL,
			ReturnURL:      req.ReturnURL,
			OutTradeNo:     req.OutTradeNo,
			TotalAmount:    req.TotalAmount,
			Subject:        req.Subject,
			ProductCode:    req.ProductCode,
			TimeoutExpress: req.TimeoutExpress,
		},
	})
	if err != nil {
		return "", err
	}
	return payURL.String(), nil
}

func MapAlipayTradeStatusToLocalStatus(status string) string {
	switch status {
	case "TRADE_SUCCESS", "TRADE_FINISHED":
		return "success"
	case "TRADE_CLOSED":
		return "expired"
	case "WAIT_BUYER_PAY":
		return "pending"
	default:
		return "failed"
	}
}

func QueryAlipayTrade(ctx context.Context, gateway string, appID string, privateKeyPEM string, outTradeNo string) (*AlipayTradeQueryResponse, error) {
	if strings.TrimSpace(outTradeNo) == "" {
		return nil, errors.New("missing out_trade_no")
	}
	client, err := newAlipayClient(gateway, appID, privateKeyPEM, setting.AlipayPublicKey)
	if err != nil {
		return nil, err
	}

	var receivedDataMu sync.Mutex
	var receivedData []byte
	client.OnReceivedData(func(_ context.Context, _ string, data []byte) {
		receivedDataMu.Lock()
		defer receivedDataMu.Unlock()
		receivedData = append(receivedData[:0], data...)
	})

	result, err := client.TradeQuery(ctx, alipay.TradeQuery{
		OutTradeNo: outTradeNo,
	})
	if err != nil {
		var sdkErr *alipay.Error
		if errors.As(err, &sdkErr) {
			return nil, &AlipayTradeQueryError{Response: mapSDKTradeQueryError(sdkErr)}
		}
		return nil, err
	}

	receivedDataMu.Lock()
	receivedDataCopy := append([]byte(nil), receivedData...)
	receivedDataMu.Unlock()

	response, err := parseSDKTradeQueryResponse(receivedDataCopy)
	if err != nil {
		return nil, err
	}
	if response == nil {
		response = mapSDKTradeQueryResponse(result)
	}
	if response.Code != "10000" {
		return nil, &AlipayTradeQueryError{Response: response}
	}
	return response, nil
}

func mapSDKTradeQueryResponse(result *alipay.TradeQueryRsp) *AlipayTradeQueryResponse {
	if result == nil {
		return nil
	}

	return &AlipayTradeQueryResponse{
		Code:        string(result.Code),
		Msg:         result.Msg,
		SubCode:     result.SubCode,
		SubMsg:      decodeAlipayGBKIfNeeded(result.SubMsg),
		OutTradeNo:  result.OutTradeNo,
		TradeNo:     result.TradeNo,
		TradeStatus: string(result.TradeStatus),
	}
}

func mapSDKTradeQueryError(err *alipay.Error) *AlipayTradeQueryResponse {
	if err == nil {
		return nil
	}

	return &AlipayTradeQueryResponse{
		Code:    string(err.Code),
		Msg:     err.Msg,
		SubCode: err.SubCode,
		SubMsg:  decodeAlipayGBKIfNeeded(err.SubMsg),
	}
}

func parseSDKTradeQueryResponse(data []byte) (*AlipayTradeQueryResponse, error) {
	if len(data) == 0 {
		return nil, nil
	}

	normalized := normalizeAlipayJSONPayload(data)
	var response AlipayTradeQueryResponse
	if err := common.Unmarshal(normalized, &response); err != nil {
		return nil, err
	}
	if !isMeaningfulAlipayTradeQueryResponse(&response) {
		return nil, nil
	}
	return &response, nil
}

func isMeaningfulAlipayTradeQueryResponse(response *AlipayTradeQueryResponse) bool {
	if response == nil {
		return false
	}
	return strings.TrimSpace(response.Code) != "" ||
		strings.TrimSpace(response.Msg) != "" ||
		strings.TrimSpace(response.SubCode) != "" ||
		strings.TrimSpace(response.SubMsg) != "" ||
		strings.TrimSpace(response.OutTradeNo) != "" ||
		strings.TrimSpace(response.TradeNo) != "" ||
		strings.TrimSpace(response.TradeStatus) != ""
}

func BuildAlipayTradeQueryErrorMessage(response *AlipayTradeQueryResponse) string {
	if response == nil {
		return "alipay trade query failed"
	}

	parts := make([]string, 0, 3)
	if code := strings.TrimSpace(response.Code); code != "" {
		parts = append(parts, code)
	}
	if subCode := strings.TrimSpace(response.SubCode); subCode != "" {
		parts = append(parts, subCode)
	}
	if subMsg := strings.TrimSpace(response.SubMsg); subMsg != "" {
		parts = append(parts, subMsg)
	} else if msg := strings.TrimSpace(response.Msg); msg != "" {
		parts = append(parts, msg)
	}
	if len(parts) == 0 {
		return "alipay trade query failed"
	}
	return strings.Join(parts, " | ")
}

func IsAlipayPermanentTradeQueryError(err error) bool {
	var queryErr *AlipayTradeQueryError
	if !errors.As(err, &queryErr) || queryErr.Response == nil {
		return false
	}
	return strings.TrimSpace(queryErr.Response.SubCode) == "ACQ.TRADE_NOT_EXIST"
}

func VerifyAlipayResponseSignature(body []byte, responseKey string, signature string, publicKeyPEM string) error {
	if strings.TrimSpace(signature) == "" {
		return errors.New("missing alipay response signature")
	}
	if strings.TrimSpace(publicKeyPEM) == "" {
		return errors.New("missing alipay public key")
	}

	var raw map[string]json.RawMessage
	if err := common.Unmarshal(body, &raw); err != nil {
		return err
	}

	responseNode, ok := raw[responseKey]
	if !ok || len(responseNode) == 0 {
		return fmt.Errorf("missing %s in alipay response", responseKey)
	}
	return VerifyAlipaySignature(string(responseNode), signature, publicKeyPEM)
}

func ParseAlipayTradeQueryResponse(body []byte, signature string, publicKeyPEM string) (*AlipayTradeQueryResponse, error) {
	var raw map[string]json.RawMessage
	if err := common.Unmarshal(body, &raw); err != nil {
		return nil, err
	}

	responseNode, ok := raw["alipay_trade_query_response"]
	if !ok || len(responseNode) == 0 {
		return nil, fmt.Errorf("missing %s in alipay response", "alipay_trade_query_response")
	}

	if strings.TrimSpace(signature) == "" {
		signature = common.JsonRawMessageToString(raw["sign"])
	}
	if err := VerifyAlipaySignature(string(responseNode), signature, publicKeyPEM); err != nil {
		return nil, err
	}

	var response AlipayTradeQueryResponse
	normalizedResponseNode := normalizeAlipayJSONPayload(responseNode)
	if err := common.Unmarshal(normalizedResponseNode, &response); err != nil {
		return nil, err
	}
	return &response, nil
}

func decodeAlipayGBKIfNeeded(value string) string {
	if value == "" {
		return ""
	}
	return string(normalizeAlipayJSONPayload([]byte(value)))
}

func normalizeAlipayJSONPayload(payload []byte) []byte {
	if utf8.Valid(payload) {
		return payload
	}
	decoded, err := simplifiedchinese.GBK.NewDecoder().Bytes(payload)
	if err != nil {
		return payload
	}
	if !utf8.Valid(decoded) {
		return payload
	}
	return decoded
}
