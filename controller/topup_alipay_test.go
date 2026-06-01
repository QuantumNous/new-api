package controller

import (
	"bytes"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func mustGenerateAlipayNotifyTestKeys(t *testing.T) (privateKeyPEM string, publicKeyPEM string, publicKeyRaw string) {
	t.Helper()

	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)

	privateKeyDER, err := x509.MarshalPKCS8PrivateKey(privateKey)
	require.NoError(t, err)
	privateKeyPEM = string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: privateKeyDER}))

	publicKeyDER, err := x509.MarshalPKIXPublicKey(&privateKey.PublicKey)
	require.NoError(t, err)
	publicKeyPEM = string(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: publicKeyDER}))
	publicKeyRaw = base64.StdEncoding.EncodeToString(publicKeyDER)

	return privateKeyPEM, publicKeyPEM, publicKeyRaw
}

func newPOSTFormContext(path string, form url.Values) (*gin.Context, *httptest.ResponseRecorder) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	body := bytes.NewBufferString(form.Encode())
	req := httptest.NewRequest(http.MethodPost, path, body)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	c.Request = req
	return c, recorder
}

func TestRequestAlipayPayRejectsUnsupportedMethod(t *testing.T) {
	require.NoError(t, i18n.Init())
	gin.SetMode(gin.TestMode)
	confirmPaymentComplianceForTest(t)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Set("id", 1)

	originalEnabled := setting.AlipayEnabled
	originalAppID := setting.AlipayAppID
	originalPrivateKey := setting.AlipayPrivateKey
	originalPublicKey := setting.AlipayPublicKey
	originalGateway := setting.AlipayGateway
	setting.AlipayEnabled = true
	setting.AlipayAppID = "2026000000000000"
	setting.AlipayPrivateKey = "private"
	setting.AlipayPublicKey = "public"
	setting.AlipayGateway = "https://openapi.alipay.com/gateway.do"
	t.Cleanup(func() {
		setting.AlipayEnabled = originalEnabled
		setting.AlipayAppID = originalAppID
		setting.AlipayPrivateKey = originalPrivateKey
		setting.AlipayPublicKey = originalPublicKey
		setting.AlipayGateway = originalGateway
	})

	c.Request = httptest.NewRequest(http.MethodPost, "/api/user/alipay/pay", bytes.NewBufferString(`{"amount":100,"payment_method":"stripe"}`))
	c.Request.Header.Set("Content-Type", "application/json")

	RequestAlipayPay(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), i18n.T(c, i18n.MsgPaymentChannelNotSupported))
}

func TestAlipayNotifyRejectsWhenWebhookConfigIncomplete(t *testing.T) {
	gin.SetMode(gin.TestMode)
	confirmPaymentComplianceForTest(t)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/alipay/notify", nil)

	originalEnabled := setting.AlipayEnabled
	originalAppID := setting.AlipayAppID
	originalPrivateKey := setting.AlipayPrivateKey
	originalPublicKey := setting.AlipayPublicKey
	originalGateway := setting.AlipayGateway
	setting.AlipayEnabled = false
	setting.AlipayAppID = "2026000000000000"
	setting.AlipayPrivateKey = "private"
	setting.AlipayPublicKey = ""
	setting.AlipayGateway = "https://openapi.alipay.com/gateway.do"
	t.Cleanup(func() {
		setting.AlipayEnabled = originalEnabled
		setting.AlipayAppID = originalAppID
		setting.AlipayPrivateKey = originalPrivateKey
		setting.AlipayPublicKey = originalPublicKey
		setting.AlipayGateway = originalGateway
	})

	AlipayNotify(c)
	require.Equal(t, http.StatusForbidden, recorder.Code)
}

func TestAlipayNotifyStillAcceptsConfiguredWebhookWhenTopUpDisabled(t *testing.T) {
	gin.SetMode(gin.TestMode)
	confirmPaymentComplianceForTest(t)
	privateKeyPEM, _, publicKeyRaw := mustGenerateAlipayNotifyTestKeys(t)

	originalEnabled := setting.AlipayEnabled
	originalAppID := setting.AlipayAppID
	originalPrivateKey := setting.AlipayPrivateKey
	originalPublicKey := setting.AlipayPublicKey
	originalGateway := setting.AlipayGateway
	originalSellerID := setting.AlipaySellerID
	setting.AlipayEnabled = false
	setting.AlipayAppID = "2021000000000000"
	setting.AlipayPrivateKey = privateKeyPEM
	setting.AlipayPublicKey = publicKeyRaw
	setting.AlipayGateway = "https://openapi.alipay.com/gateway.do"
	setting.AlipaySellerID = ""
	t.Cleanup(func() {
		setting.AlipayEnabled = originalEnabled
		setting.AlipayAppID = originalAppID
		setting.AlipayPrivateKey = originalPrivateKey
		setting.AlipayPublicKey = originalPublicKey
		setting.AlipayGateway = originalGateway
		setting.AlipaySellerID = originalSellerID
	})

	form := url.Values{}
	form.Set("app_id", setting.AlipayAppID)
	form.Set("out_trade_no", "ali_ref_disabled_topup")
	form.Set("trade_status", "WAIT_BUYER_PAY")
	signature, err := service.SignAlipayContent(service.BuildAlipaySignContent(service.NormalizeAlipayParams(form)), privateKeyPEM)
	require.NoError(t, err)
	form.Set("sign", signature)

	c, recorder := newPOSTFormContext("/api/alipay/notify", form)
	AlipayNotify(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Equal(t, "success", recorder.Body.String())
}

func TestAlipayNotifyRejectsInvalidSignature(t *testing.T) {
	gin.SetMode(gin.TestMode)
	confirmPaymentComplianceForTest(t)
	privateKeyPEM, publicKeyPEM, _ := mustGenerateAlipayNotifyTestKeys(t)
	wrongPrivateKeyPEM, _, _ := mustGenerateAlipayNotifyTestKeys(t)

	originalEnabled := setting.AlipayEnabled
	originalAppID := setting.AlipayAppID
	originalPrivateKey := setting.AlipayPrivateKey
	originalPublicKey := setting.AlipayPublicKey
	originalGateway := setting.AlipayGateway
	originalSellerID := setting.AlipaySellerID
	setting.AlipayEnabled = true
	setting.AlipayAppID = "2021000000000000"
	setting.AlipayPrivateKey = "private"
	setting.AlipayPublicKey = publicKeyPEM
	setting.AlipayGateway = "https://openapi.alipay.com/gateway.do"
	setting.AlipaySellerID = ""
	t.Cleanup(func() {
		setting.AlipayEnabled = originalEnabled
		setting.AlipayAppID = originalAppID
		setting.AlipayPrivateKey = originalPrivateKey
		setting.AlipayPublicKey = originalPublicKey
		setting.AlipayGateway = originalGateway
		setting.AlipaySellerID = originalSellerID
	})

	form := url.Values{}
	form.Set("app_id", setting.AlipayAppID)
	form.Set("out_trade_no", "ali_ref_invalid_sig")
	form.Set("trade_status", "TRADE_SUCCESS")
	signature, err := service.SignAlipayContent(service.BuildAlipaySignContent(service.NormalizeAlipayParams(form)), wrongPrivateKeyPEM)
	require.NoError(t, err)
	validSignature, err := service.SignAlipayContent(service.BuildAlipaySignContent(service.NormalizeAlipayParams(form)), privateKeyPEM)
	require.NoError(t, err)
	require.NotEqual(t, validSignature, signature)
	form.Set("sign", signature)

	c, recorder := newPOSTFormContext("/api/alipay/notify", form)
	AlipayNotify(c)

	require.Equal(t, http.StatusUnauthorized, recorder.Code)
	require.Equal(t, "fail", recorder.Body.String())
}

func TestAlipayNotifyAcceptsRawBase64PublicKey(t *testing.T) {
	gin.SetMode(gin.TestMode)
	confirmPaymentComplianceForTest(t)
	privateKeyPEM, _, publicKeyRaw := mustGenerateAlipayNotifyTestKeys(t)

	originalEnabled := setting.AlipayEnabled
	originalAppID := setting.AlipayAppID
	originalPrivateKey := setting.AlipayPrivateKey
	originalPublicKey := setting.AlipayPublicKey
	originalGateway := setting.AlipayGateway
	originalSellerID := setting.AlipaySellerID
	setting.AlipayEnabled = true
	setting.AlipayAppID = "2021000000000000"
	setting.AlipayPrivateKey = privateKeyPEM
	setting.AlipayPublicKey = publicKeyRaw
	setting.AlipayGateway = "https://openapi.alipay.com/gateway.do"
	setting.AlipaySellerID = ""
	t.Cleanup(func() {
		setting.AlipayEnabled = originalEnabled
		setting.AlipayAppID = originalAppID
		setting.AlipayPrivateKey = originalPrivateKey
		setting.AlipayPublicKey = originalPublicKey
		setting.AlipayGateway = originalGateway
		setting.AlipaySellerID = originalSellerID
	})

	form := url.Values{}
	form.Set("app_id", setting.AlipayAppID)
	form.Set("out_trade_no", "ali_ref_valid_sig")
	form.Set("trade_status", "WAIT_BUYER_PAY")
	signature, err := service.SignAlipayContent(service.BuildAlipaySignContent(service.NormalizeAlipayParams(form)), privateKeyPEM)
	require.NoError(t, err)
	form.Set("sign", signature)

	c, recorder := newPOSTFormContext("/api/alipay/notify", form)
	AlipayNotify(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Equal(t, "success", recorder.Body.String())
}

func TestLoadEncryptedAlipayOptionsPopulatesRuntimePlaintext(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Option{}))
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)

	originalDB := model.DB
	model.DB = db
	t.Cleanup(func() {
		model.DB = originalDB
	})

	originalPrivateKey := setting.AlipayPrivateKey
	originalPublicKey := setting.AlipayPublicKey
	originalEncryptKey := setting.AlipayEncryptKey
	originalOptionMap := common.OptionMap
	t.Cleanup(func() {
		setting.AlipayPrivateKey = originalPrivateKey
		setting.AlipayPublicKey = originalPublicKey
		setting.AlipayEncryptKey = originalEncryptKey
		common.OptionMapRWMutex.Lock()
		common.OptionMap = originalOptionMap
		common.OptionMapRWMutex.Unlock()
	})

	t.Setenv("OPTION_CRYPT_KEY", "test-option-crypt-key")

	encryptedPrivateKey, err := common.EncryptAlipayOptionValue("AlipayPrivateKey", "private")
	require.NoError(t, err)
	encryptedPublicKey, err := common.EncryptAlipayOptionValue("AlipayPublicKey", "public")
	require.NoError(t, err)

	require.NoError(t, model.DB.Save(&model.Option{
		Key:   "AlipayPrivateKey",
		Value: encryptedPrivateKey,
	}).Error)
	require.NoError(t, model.DB.Save(&model.Option{
		Key:   "AlipayPublicKey",
		Value: encryptedPublicKey,
	}).Error)
	require.NoError(t, model.DB.Save(&model.Option{
		Key:   "AlipayEncryptKey",
		Value: "uFQhRDg6uwtoEHB1jPG1ww==",
	}).Error)

	model.InitOptionMap()

	require.Equal(t, "private", setting.AlipayPrivateKey)
	require.Equal(t, "public", setting.AlipayPublicKey)
	require.Equal(t, "uFQhRDg6uwtoEHB1jPG1ww==", setting.AlipayEncryptKey)
}
