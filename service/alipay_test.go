package service

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/stretchr/testify/require"
	"golang.org/x/text/encoding/simplifiedchinese"
)

const testAlipayAppID = "2026000000000000"

func mustGenerateAlipayTestKeys(t *testing.T) (privateKeyPEM string, publicKeyPEM string) {
	t.Helper()

	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)

	privateKeyDER, err := x509.MarshalPKCS8PrivateKey(privateKey)
	require.NoError(t, err)
	privateKeyPEM = string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: privateKeyDER}))

	publicKeyDER, err := x509.MarshalPKIXPublicKey(&privateKey.PublicKey)
	require.NoError(t, err)
	publicKeyPEM = string(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: publicKeyDER}))

	return privateKeyPEM, publicKeyPEM
}

func mustParseURLValues(t *testing.T, rawURL string) url.Values {
	t.Helper()
	parsed, err := url.Parse(rawURL)
	require.NoError(t, err)
	return parsed.Query()
}

func TestNormalizeAlipayParamsRemovesSignFields(t *testing.T) {
	values := url.Values{}
	values.Set("out_trade_no", "ref_123")
	values.Set("trade_status", "TRADE_SUCCESS")
	values.Set("sign", "abc")
	values.Set("sign_type", "RSA2")

	normalized := NormalizeAlipayParams(values)
	require.Equal(t, "ref_123", normalized["out_trade_no"])
	require.Equal(t, "TRADE_SUCCESS", normalized["trade_status"])

	_, hasSign := normalized["sign"]
	_, hasSignType := normalized["sign_type"]
	require.False(t, hasSign)
	require.False(t, hasSignType)
}

func TestAlipaySuccessStatusRecognition(t *testing.T) {
	require.True(t, IsAlipayTradeSuccess("TRADE_SUCCESS"))
	require.True(t, IsAlipayTradeSuccess("TRADE_FINISHED"))
	require.False(t, IsAlipayTradeSuccess("WAIT_BUYER_PAY"))
}

func TestMapAlipayTradeStatusToLocalStatus(t *testing.T) {
	require.Equal(t, "success", MapAlipayTradeStatusToLocalStatus("TRADE_SUCCESS"))
	require.Equal(t, "success", MapAlipayTradeStatusToLocalStatus("TRADE_FINISHED"))
	require.Equal(t, "expired", MapAlipayTradeStatusToLocalStatus("TRADE_CLOSED"))
	require.Equal(t, "pending", MapAlipayTradeStatusToLocalStatus("WAIT_BUYER_PAY"))
	require.Equal(t, "failed", MapAlipayTradeStatusToLocalStatus("UNKNOWN"))
}

func TestVerifyAlipayResponseSignature(t *testing.T) {
	privateKeyPEM, publicKeyPEM := mustGenerateAlipayTestKeys(t)

	responseNode := `{"code":"10000","msg":"Success","out_trade_no":"ali_ref_123","trade_status":"TRADE_SUCCESS"}`
	signature, err := SignAlipayContent(responseNode, privateKeyPEM)
	require.NoError(t, err)

	body := []byte(`{"alipay_trade_query_response":` + responseNode + `,"sign":"` + signature + `"}`)
	require.NoError(t, VerifyAlipayResponseSignature(body, "alipay_trade_query_response", signature, publicKeyPEM))
}

func TestVerifyAlipayResponseSignatureRejectsMismatchedPassedSignature(t *testing.T) {
	privateKeyPEM, publicKeyPEM := mustGenerateAlipayTestKeys(t)

	responseNode := `{"code":"10000","msg":"Success","out_trade_no":"ali_ref_123","trade_status":"TRADE_SUCCESS"}`
	bodySignature, err := SignAlipayContent(responseNode, privateKeyPEM)
	require.NoError(t, err)
	mismatchedSignature, err := SignAlipayContent(`{"code":"10000","msg":"Success","out_trade_no":"other"}`, privateKeyPEM)
	require.NoError(t, err)
	require.NotEqual(t, bodySignature, mismatchedSignature)

	body := []byte(`{"alipay_trade_query_response":` + responseNode + `,"sign":"` + bodySignature + `"}`)
	err = VerifyAlipayResponseSignature(body, "alipay_trade_query_response", mismatchedSignature, publicKeyPEM)
	require.Error(t, err)
}

func TestSignAlipayContentAcceptsRawBase64PKCS8PrivateKey(t *testing.T) {
	privateKeyPEM, _ := mustGenerateAlipayTestKeys(t)
	privateKeyBlock, _ := pem.Decode([]byte(privateKeyPEM))
	require.NotNil(t, privateKeyBlock)
	privateKeyDER := privateKeyBlock.Bytes

	privateKeyRaw := base64.StdEncoding.EncodeToString(privateKeyDER)
	signature, err := SignAlipayContent("foo=bar", privateKeyRaw)
	require.NoError(t, err)
	require.NotEmpty(t, signature)
}

func TestVerifyAlipaySignatureAcceptsRawBase64PublicKey(t *testing.T) {
	privateKeyPEM, publicKeyPEM := mustGenerateAlipayTestKeys(t)
	publicKeyBlock, _ := pem.Decode([]byte(publicKeyPEM))
	require.NotNil(t, publicKeyBlock)
	publicKeyDER := publicKeyBlock.Bytes
	publicKeyRaw := base64.StdEncoding.EncodeToString(publicKeyDER)

	signature, err := SignAlipayContent("foo=bar", privateKeyPEM)
	require.NoError(t, err)
	require.NoError(t, VerifyAlipaySignature("foo=bar", signature, publicKeyRaw))
}

func TestVerifyAlipaySignatureAcceptsUnpaddedStandardBase64Signature(t *testing.T) {
	privateKeyPEM, publicKeyPEM := mustGenerateAlipayTestKeys(t)

	signature, err := SignAlipayContent("foo=bar", privateKeyPEM)
	require.NoError(t, err)

	unpaddedSignature := strings.TrimRight(signature, "=")
	require.NotEqual(t, signature, unpaddedSignature)
	require.NoError(t, VerifyAlipaySignature("foo=bar", unpaddedSignature, publicKeyPEM))
}

func TestSignAlipayContentAcceptsRawBase64PKCS1PrivateKey(t *testing.T) {
	privateKeyPEM, _ := mustGenerateAlipayTestKeys(t)
	privateKeyBlock, _ := pem.Decode([]byte(privateKeyPEM))
	require.NotNil(t, privateKeyBlock)
	parsedPrivateKey, err := x509.ParsePKCS8PrivateKey(privateKeyBlock.Bytes)
	require.NoError(t, err)
	rsaPrivateKey, ok := parsedPrivateKey.(*rsa.PrivateKey)
	require.True(t, ok)
	privateKey := rsaPrivateKey
	privateKeyDER := x509.MarshalPKCS1PrivateKey(privateKey)
	privateKeyRaw := base64.StdEncoding.EncodeToString(privateKeyDER)

	signature, err := SignAlipayContent("foo=bar", privateKeyRaw)
	require.NoError(t, err)
	require.NotEmpty(t, signature)
}

func TestBuildAlipayPayURLIncludesEncryptTypeAndEncryptedBizContent(t *testing.T) {
	privateKeyPEM, _ := mustGenerateAlipayTestKeys(t)

	urlStr, err := BuildAlipayPayURL(
		"https://openapi-sandbox.dl.alipaydev.com/gateway.do",
		"2026000000000000",
		privateKeyPEM,
		"alipay.trade.page.pay",
		AlipayPagePayRequest{
			OutTradeNo:     "trade_123",
			TotalAmount:    "10.00",
			Subject:        "Topup 10",
			ReturnURL:      "https://example.com/return",
			NotifyURL:      "https://example.com/notify",
			TimeoutExpress: "30m",
			ProductCode:    "FAST_INSTANT_TRADE_PAY",
		},
		"uFQhRDg6uwtoEHB1jPG1ww==",
	)
	require.NoError(t, err)

	parsed, err := url.Parse(urlStr)
	require.NoError(t, err)
	values := parsed.Query()
	require.Equal(t, "AES", values.Get("encrypt_type"))
	require.NotEmpty(t, values.Get("biz_content"))
	require.NotContains(t, values.Get("biz_content"), `"out_trade_no":"trade_123"`)

	plainText, err := DecryptAlipayEncryptedText(values.Get("biz_content"), "uFQhRDg6uwtoEHB1jPG1ww==")
	require.NoError(t, err)

	var bizContent map[string]string
	require.NoError(t, common.UnmarshalJsonStr(plainText, &bizContent))
	require.Equal(t, "trade_123", bizContent["out_trade_no"])
	require.Equal(t, "10.00", bizContent["total_amount"])
}

func TestParseAlipayTradeQueryResponseDecryptsEncryptedResponseNode(t *testing.T) {
	privateKeyPEM, publicKeyPEM := mustGenerateAlipayTestKeys(t)

	responseNode := `{"code":"10000","msg":"Success","out_trade_no":"ali_ref_123","trade_status":"TRADE_SUCCESS"}`
	encryptedNode, err := EncryptAlipayPlainText(responseNode, "uFQhRDg6uwtoEHB1jPG1ww==")
	require.NoError(t, err)

	quotedNodeBytes, err := common.Marshal(encryptedNode)
	require.NoError(t, err)
	signature, err := SignAlipayContent(string(quotedNodeBytes), privateKeyPEM)
	require.NoError(t, err)

	body := []byte(`{"alipay_trade_query_response":` + string(quotedNodeBytes) + `,"sign":"` + signature + `"}`)
	response, err := ParseAlipayTradeQueryResponse(body, signature, publicKeyPEM, "uFQhRDg6uwtoEHB1jPG1ww==")
	require.NoError(t, err)
	require.Equal(t, "10000", response.Code)
	require.Equal(t, "ali_ref_123", response.OutTradeNo)
	require.Equal(t, "TRADE_SUCCESS", response.TradeStatus)
}

func TestParseAlipayTradeQueryResponseDecodesGBKSubMsgFromEncryptedPayload(t *testing.T) {
	privateKeyPEM, publicKeyPEM := mustGenerateAlipayTestKeys(t)

	gbkSubMsg, err := simplifiedchinese.GBK.NewEncoder().String("交易还不存在")
	require.NoError(t, err)
	responseNode := `{"code":"40004","msg":"Business Failed","sub_code":"ACQ.TRADE_NOT_EXIST","sub_msg":"` + gbkSubMsg + `"}`
	encryptedNode, err := EncryptAlipayPlainText(responseNode, "uFQhRDg6uwtoEHB1jPG1ww==")
	require.NoError(t, err)

	quotedNodeBytes, err := common.Marshal(encryptedNode)
	require.NoError(t, err)
	signature, err := SignAlipayContent(string(quotedNodeBytes), privateKeyPEM)
	require.NoError(t, err)

	body := []byte(`{"alipay_trade_query_response":` + string(quotedNodeBytes) + `,"sign":"` + signature + `"}`)
	response, err := ParseAlipayTradeQueryResponse(body, signature, publicKeyPEM, "uFQhRDg6uwtoEHB1jPG1ww==")
	require.NoError(t, err)
	require.Equal(t, "40004", response.Code)
	require.Equal(t, "ACQ.TRADE_NOT_EXIST", response.SubCode)
	require.Equal(t, "交易还不存在", response.SubMsg)
}

func TestQueryAlipayTradeWithEncryptKeyIncludesSubCodeAndDecodedSubMsg(t *testing.T) {
	privateKeyPEM, publicKeyPEM := mustGenerateAlipayTestKeys(t)

	gbkSubMsg, err := simplifiedchinese.GBK.NewEncoder().String("交易还不存在")
	require.NoError(t, err)
	responseNode := `{"code":"40004","msg":"Business Failed","sub_code":"ACQ.TRADE_NOT_EXIST","sub_msg":"` + gbkSubMsg + `","out_trade_no":"ali_ref_123"}`
	encryptedNode, err := EncryptAlipayPlainText(responseNode, "uFQhRDg6uwtoEHB1jPG1ww==")
	require.NoError(t, err)

	quotedNodeBytes, err := common.Marshal(encryptedNode)
	require.NoError(t, err)
	signature, err := SignAlipayContent(string(quotedNodeBytes), privateKeyPEM)
	require.NoError(t, err)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.NoError(t, r.ParseForm())
		require.Equal(t, "AES", r.PostForm.Get("encrypt_type"))
		require.Equal(t, "alipay.trade.query", r.PostForm.Get("method"))
		w.Header().Set("Content-Type", "text/html;charset=GBK")
		_, writeErr := w.Write([]byte(`{"alipay_trade_query_response":` + string(quotedNodeBytes) + `,"sign":"` + signature + `"}`))
		require.NoError(t, writeErr)
	}))
	defer server.Close()

	originalPublicKey := setting.AlipayPublicKey
	setting.AlipayPublicKey = publicKeyPEM
	defer func() {
		setting.AlipayPublicKey = originalPublicKey
	}()

	_, err = QueryAlipayTradeWithEncryptKey(t.Context(), server.URL, "2026000000000000", privateKeyPEM, "ali_ref_123", "uFQhRDg6uwtoEHB1jPG1ww==")
	require.Error(t, err)
	require.Contains(t, err.Error(), "40004")
	require.Contains(t, err.Error(), "ACQ.TRADE_NOT_EXIST")
	require.Contains(t, err.Error(), "交易还不存在")
	require.False(t, strings.Contains(err.Error(), "���"))
}

func TestParseAlipayTradeQueryResponseUsesBodySignWhenSignatureEmpty(t *testing.T) {
	privateKeyPEM, publicKeyPEM := mustGenerateAlipayTestKeys(t)

	responseNode := `{"code":"10000","msg":"Success","out_trade_no":"ali_ref_body_sign","trade_status":"WAIT_BUYER_PAY"}`
	signature, err := SignAlipayContent(responseNode, privateKeyPEM)
	require.NoError(t, err)

	body := []byte(`{"alipay_trade_query_response":` + responseNode + `,"sign":"` + signature + `"}`)
	response, err := ParseAlipayTradeQueryResponse(body, "", publicKeyPEM, "")
	require.NoError(t, err)
	require.Equal(t, "10000", response.Code)
	require.Equal(t, "ali_ref_body_sign", response.OutTradeNo)
	require.Equal(t, "WAIT_BUYER_PAY", response.TradeStatus)
}

func TestBuildAlipayPayURLDesktopIncludesExpectedFields(t *testing.T) {
	privateKeyPEM, _ := mustGenerateAlipayTestKeys(t)

	payURL, err := BuildAlipayPayURL(
		"https://openapi-sandbox.dl.alipaydev.com/gateway.do",
		testAlipayAppID,
		privateKeyPEM,
		"alipay.trade.page.pay",
		AlipayPagePayRequest{
			OutTradeNo:     "ali_ref_test_1",
			TotalAmount:    "0.01",
			Subject:        "Topup 1",
			ReturnURL:      "https://example.com/return",
			NotifyURL:      "https://example.com/notify",
			TimeoutExpress: "30m",
			ProductCode:    "FAST_INSTANT_TRADE_PAY",
		},
		"",
	)
	require.NoError(t, err)

	values := mustParseURLValues(t, payURL)
	require.Equal(t, "alipay.trade.page.pay", values.Get("method"))
	require.Equal(t, testAlipayAppID, values.Get("app_id"))
	require.Equal(t, "https://example.com/notify", values.Get("notify_url"))
	require.Equal(t, "https://example.com/return", values.Get("return_url"))
	require.NotEmpty(t, values.Get("sign"))
	require.Empty(t, values.Get("encrypt_type"))
}

func TestBuildAlipayPayURLWithEncryptKeySetsAESEncryption(t *testing.T) {
	privateKeyPEM, _ := mustGenerateAlipayTestKeys(t)
	const testAlipayEncryptKey = "uFQhRDg6uwtoEHB1jPG1ww=="

	payURL, err := BuildAlipayPayURL(
		"https://openapi-sandbox.dl.alipaydev.com/gateway.do",
		testAlipayAppID,
		privateKeyPEM,
		"alipay.trade.page.pay",
		AlipayPagePayRequest{
			OutTradeNo:     "ali_ref_test_aes",
			TotalAmount:    "0.01",
			Subject:        "Topup AES",
			ReturnURL:      "https://example.com/return",
			NotifyURL:      "https://example.com/notify",
			TimeoutExpress: "15m",
			ProductCode:    "FAST_INSTANT_TRADE_PAY",
		},
		testAlipayEncryptKey,
	)
	require.NoError(t, err)

	values := mustParseURLValues(t, payURL)
	require.Equal(t, "AES", values.Get("encrypt_type"))
	require.NotEmpty(t, values.Get("biz_content"))
	require.NotContains(t, values.Get("biz_content"), `"out_trade_no"`)
}

func TestQueryAlipayTradeWithEncryptKeyMapsSDKResponse(t *testing.T) {
	privateKeyPEM, publicKeyPEM := mustGenerateAlipayTestKeys(t)

	queryNode := `{"code":"10000","msg":"Success","out_trade_no":"ali_ref_test_query","trade_no":"2026052900000000","trade_status":"WAIT_BUYER_PAY"}`
	signature, err := SignAlipayContent(queryNode, privateKeyPEM)
	require.NoError(t, err)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.NoError(t, r.ParseForm())
		require.Equal(t, "alipay.trade.query", r.PostForm.Get("method"))
		_, writeErr := w.Write([]byte(`{"alipay_trade_query_response":` + queryNode + `,"sign":"` + signature + `"}`))
		require.NoError(t, writeErr)
	}))
	defer server.Close()

	originalPublicKey := setting.AlipayPublicKey
	setting.AlipayPublicKey = publicKeyPEM
	defer func() {
		setting.AlipayPublicKey = originalPublicKey
	}()

	result, err := QueryAlipayTradeWithEncryptKey(t.Context(), server.URL, testAlipayAppID, privateKeyPEM, "ali_ref_test_query", "")
	require.NoError(t, err)
	require.Equal(t, "10000", result.Code)
	require.Equal(t, "Success", result.Msg)
	require.Equal(t, "ali_ref_test_query", result.OutTradeNo)
	require.Equal(t, "2026052900000000", result.TradeNo)
	require.Equal(t, "WAIT_BUYER_PAY", result.TradeStatus)
}

func TestQueryAlipayTradeWithEncryptKeyFormatsSDKError(t *testing.T) {
	privateKeyPEM, publicKeyPEM := mustGenerateAlipayTestKeys(t)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.NoError(t, r.ParseForm())
		require.Equal(t, "alipay.trade.query", r.PostForm.Get("method"))
		_, writeErr := w.Write([]byte(`{"error_response":{"code":"40004","msg":"Business Failed","sub_code":"ACQ.TRADE_NOT_EXIST","sub_msg":"交易不存在"}}`))
		require.NoError(t, writeErr)
	}))
	defer server.Close()

	originalPublicKey := setting.AlipayPublicKey
	setting.AlipayPublicKey = publicKeyPEM
	defer func() {
		setting.AlipayPublicKey = originalPublicKey
	}()

	_, err := QueryAlipayTradeWithEncryptKey(t.Context(), server.URL, testAlipayAppID, privateKeyPEM, "ali_ref_test_query", "")
	require.Error(t, err)
	require.Equal(t, "40004 | ACQ.TRADE_NOT_EXIST | 交易不存在", err.Error())
}

func TestBuildAlipayTradeQueryErrorMessageFallsBackToMsg(t *testing.T) {
	response := &AlipayTradeQueryResponse{
		Code:    "40004",
		Msg:     "Business Failed",
		SubCode: "ACQ.TRADE_NOT_EXIST",
	}

	errMsg := BuildAlipayTradeQueryErrorMessage(response)
	require.Equal(t, "40004 | ACQ.TRADE_NOT_EXIST | Business Failed", errMsg)
}

func TestIsAlipayPermanentTradeQueryError(t *testing.T) {
	require.True(t, IsAlipayPermanentTradeQueryError(&AlipayTradeQueryError{
		Response: &AlipayTradeQueryResponse{
			Code:    "40004",
			SubCode: "ACQ.TRADE_NOT_EXIST",
		},
	}))

	require.False(t, IsAlipayPermanentTradeQueryError(&AlipayTradeQueryError{
		Response: &AlipayTradeQueryResponse{
			Code:    "40004",
			SubCode: "ACQ.SYSTEM_ERROR",
		},
	}))

	require.False(t, IsAlipayPermanentTradeQueryError(errors.New("network error")))
}

func TestIsAlipayPendingTaskEnabledRequiresPublicKey(t *testing.T) {
	originalEnabled := setting.AlipayEnabled
	originalAppID := setting.AlipayAppID
	originalPrivateKey := setting.AlipayPrivateKey
	originalPublicKey := setting.AlipayPublicKey
	originalGateway := setting.AlipayGateway
	defer func() {
		setting.AlipayEnabled = originalEnabled
		setting.AlipayAppID = originalAppID
		setting.AlipayPrivateKey = originalPrivateKey
		setting.AlipayPublicKey = originalPublicKey
		setting.AlipayGateway = originalGateway
	}()

	setting.AlipayEnabled = true
	setting.AlipayAppID = testAlipayAppID
	setting.AlipayPrivateKey = "private"
	setting.AlipayGateway = "https://openapi-sandbox.dl.alipaydev.com/gateway.do"

	setting.AlipayPublicKey = ""
	require.False(t, isAlipayPendingTaskEnabled())

	setting.AlipayPublicKey = "public"
	require.True(t, isAlipayPendingTaskEnabled())

	setting.AlipayEnabled = false
	require.True(t, isAlipayPendingTaskEnabled())
}

func TestParseSDKTradeQueryResponseIgnoresWrapperPayload(t *testing.T) {
	response, err := parseSDKTradeQueryResponse([]byte(`{"alipay_trade_query_response":{"code":"10000","msg":"Success","out_trade_no":"ali_ref_wrapper"}}`))
	require.NoError(t, err)
	require.Nil(t, response)
}

func TestVerifyAlipaySignatureAcceptsValidNotifyContent(t *testing.T) {
	privateKeyPEM, publicKeyPEM := mustGenerateAlipayTestKeys(t)

	content := "app_id=2021000000000000&out_trade_no=ali_ref_notify&trade_status=TRADE_SUCCESS"
	signature, err := SignAlipayContent(content, privateKeyPEM)
	require.NoError(t, err)

	err = VerifyAlipaySignature(content, signature, publicKeyPEM)
	require.NoError(t, err)
}

func TestVerifyAlipaySignatureAcceptsFixedVector(t *testing.T) {
	const content = "app_id=2021000000000000&out_trade_no=ali_ref_vector&trade_status=TRADE_SUCCESS"
	const publicKeyPEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAgk+ChvN5Rw5qR431dy0I
RZzYd1HSMQ4BAPkYdpnPBU2UErZEDecXLnQXGFbYEDO4WTjeZYZqpHQGcj4sbY39
aC174xmmIcJNmNe12JzughY6o3GGzEfh3r8eym7MYrdT6nqVNOFin4FrAaN5aiqJ
mllHs8C2HnwoAXf8LUomVnyx0F14AF/A0mCUwXuwQPy+egyoqOdZ/lWjNV30lDRB
HWNKZQ2ixTVvoPP51iEXvSAlmId+OSzjxBx+uLmo4WcNBYoURlGgdCvQbiQhT9yp
0y4vW1P642dq6BGBRW40KCfbvKH71HUT24O+7P8D/5RTP458ooj6c6iu9QxJouZT
iwIDAQAB
-----END PUBLIC KEY-----`
	const signature = "QiJABudEHiUQKzYlHRsxIiOtl//rzs8ZnrKs0XxksEmerzhqw/GqLdg8C3TOR+WSOnDhDo3h8srSrnzk4zXTCuZqivAGr0quycvZ+DmFlOMm7/ELcgdDXKRzcP45efgCgjCI4FzoDtp9vgOqpoAp9zOrUSE2JaXXQDUSL4GmFTkDgM2FjlMTkOr7ofaWWD+X/iuHNsk+Q4U+eoWK/HFGUEchZlL/e7FlLRb3EhZvKh+4QRLmZ55w2sdeiZY8tZDk+DdPTq01MrsPegWnG+w/sXhrqe45befgiZlhYdJzJqdWLnD9O09cztXm8Z3VorH22mfuK2KGPp2VT7qd1QoZiw=="

	require.NoError(t, VerifyAlipaySignature(content, signature, publicKeyPEM))
}
