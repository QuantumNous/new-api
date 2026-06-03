package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type paymentConfigAPIResponse struct {
	Success bool                `json:"success"`
	Message string              `json:"message"`
	Data    model.PaymentConfig `json:"data"`
}

func setupPaymentConfigControllerTest(t *testing.T) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	oldDB := model.DB
	t.Cleanup(func() { model.DB = oldDB })
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	model.DB = db
	if err := model.DB.AutoMigrate(&model.PaymentConfig{}); err != nil {
		t.Fatalf("migrate payment config: %v", err)
	}
}

func paymentConfigContext(t *testing.T, method string, path string, body any) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	payload, err := common.Marshal(body)
	if err != nil {
		t.Fatalf("marshal body: %v", err)
	}
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(method, path, bytes.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")
	return ctx, recorder
}

func decodePaymentConfigResponse(t *testing.T, recorder *httptest.ResponseRecorder) paymentConfigAPIResponse {
	t.Helper()
	var response paymentConfigAPIResponse
	if err := common.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v body=%s", err, recorder.Body.String())
	}
	return response
}

func TestCreatePaymentConfigEncryptsAndMasksSecrets(t *testing.T) {
	setupPaymentConfigControllerTest(t)

	body := model.PaymentConfig{
		Provider:      model.PaymentProviderAlipay,
		Name:          "Alipay",
		Enabled:       true,
		AppID:         "app-1",
		AppPrivateKey: "private-key",
	}
	ctx, recorder := paymentConfigContext(t, http.MethodPost, "/api/payment-config/", body)

	CreatePaymentConfig(ctx)

	response := decodePaymentConfigResponse(t, recorder)
	if !response.Success {
		t.Fatalf("CreatePaymentConfig response not successful: %+v", response)
	}
	if !common.IsMaskedSecret(response.Data.AppPrivateKey) || response.Data.AppPrivateKey == "private-key" {
		t.Fatalf("response private key = %q, want masked", response.Data.AppPrivateKey)
	}
	stored, err := model.GetPaymentConfigByProvider(model.PaymentProviderAlipay)
	if err != nil {
		t.Fatalf("GetPaymentConfigByProvider: %v", err)
	}
	if stored.AppPrivateKey == "private-key" || stored.AppPrivateKey == "priv****" {
		t.Fatalf("stored private key was not encrypted: %q", stored.AppPrivateKey)
	}
	decrypted, err := common.DecryptPaymentSecret(stored.AppPrivateKey)
	if err != nil {
		t.Fatalf("DecryptPaymentSecret: %v", err)
	}
	if decrypted != "private-key" {
		t.Fatalf("decrypted private key = %q", decrypted)
	}
}

func TestUpdatePaymentConfigKeepsMaskedSecrets(t *testing.T) {
	setupPaymentConfigControllerTest(t)

	encrypted, err := common.EncryptPaymentSecret("old-private-key")
	if err != nil {
		t.Fatalf("EncryptPaymentSecret: %v", err)
	}
	config := &model.PaymentConfig{
		Provider:      model.PaymentProviderAlipay,
		Name:          "Alipay",
		AppPrivateKey: encrypted,
	}
	if err := model.CreatePaymentConfig(config); err != nil {
		t.Fatalf("CreatePaymentConfig: %v", err)
	}

	body := model.PaymentConfig{
		Provider:      model.PaymentProviderAlipay,
		Name:          "Alipay Updated",
		AppPrivateKey: "old-****",
	}
	ctx, recorder := paymentConfigContext(t, http.MethodPut, "/api/payment-config/1", body)
	ctx.Params = gin.Params{{Key: "id", Value: "1"}}

	UpdatePaymentConfig(ctx)

	response := decodePaymentConfigResponse(t, recorder)
	if !response.Success {
		t.Fatalf("UpdatePaymentConfig response not successful: %+v", response)
	}
	stored, err := model.GetPaymentConfigByProvider(model.PaymentProviderAlipay)
	if err != nil {
		t.Fatalf("GetPaymentConfigByProvider: %v", err)
	}
	decrypted, err := common.DecryptPaymentSecret(stored.AppPrivateKey)
	if err != nil {
		t.Fatalf("DecryptPaymentSecret: %v", err)
	}
	if decrypted != "old-private-key" {
		t.Fatalf("masked update replaced private key, got %q", decrypted)
	}
	if stored.Name != "Alipay Updated" {
		t.Fatalf("stored name = %q", stored.Name)
	}
}
