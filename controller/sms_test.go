package controller

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

func TestAdminTestSMSRedactsSensitiveResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalEnabled := common.SMSEnabled
	originalSignature := common.SMSSignature
	originalSignatureStatus := common.SMSSignatureReviewStatus
	originalProductName := common.SMSProductName
	originalTemplate := common.SMSRegisterTemplate
	originalCredential := common.SMSBaoCredential
	originalFactory := common.SMSProviderFactory
	t.Cleanup(func() {
		common.SMSEnabled = originalEnabled
		common.SMSSignature = originalSignature
		common.SMSSignatureReviewStatus = originalSignatureStatus
		common.SMSProductName = originalProductName
		common.SMSRegisterTemplate = originalTemplate
		common.SMSBaoCredential = originalCredential
		common.SMSProviderFactory = originalFactory
	})

	common.SMSEnabled = true
	common.SMSSignature = "NewAPI"
	common.SMSSignatureReviewStatus = common.SMSSignatureStatusApproved
	common.SMSProductName = "分销系统"
	common.SMSRegisterTemplate = "{product} 注册验证码 {code}，{minutes} 分钟内有效。"
	common.SMSBaoCredential = "leak-me-token"
	common.SMSProviderFactory = func(providerName string) (common.SMSProvider, error) {
		return fakeSMSProvider{t: t, wantPhone: "13800138000", wantCode: "123456"}, nil
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/sms/admin/test", bytes.NewBufferString(`{
		"phone":"13800138000",
		"scene":"register",
		"code":"123456"
	}`))

	AdminTestSMS(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}
	var response struct {
		Success bool           `json:"success"`
		Message string         `json:"message"`
		Data    map[string]any `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !response.Success {
		t.Fatalf("expected success response, got %q", response.Message)
	}
	body := recorder.Body.String()
	for _, forbidden := range []string{"13800138000", "123456", "leak-me-token", "注册验证码 123456"} {
		if strings.Contains(body, forbidden) {
			t.Fatalf("response leaked %q: %s", forbidden, body)
		}
	}
	if response.Data["phone_masked"] != "138****8000" {
		t.Fatalf("expected masked phone, got %+v", response.Data)
	}
	if response.Data["provider"] != common.SMSProviderSMSBao || response.Data["provider_code"] != "0" {
		t.Fatalf("unexpected provider metadata: %+v", response.Data)
	}
}

func TestAdminTestSMSRejectsWhenDisabled(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalEnabled := common.SMSEnabled
	t.Cleanup(func() {
		common.SMSEnabled = originalEnabled
	})
	common.SMSEnabled = false

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/sms/admin/test", bytes.NewBufferString(`{
		"phone":"13800138000",
		"scene":"register",
		"code":"123456"
	}`))

	AdminTestSMS(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "SMS is disabled") {
		t.Fatalf("expected SMS disabled message, got %s", recorder.Body.String())
	}
}

func TestAdminGetSMSStatusRedactsSensitiveResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalEnabled := common.SMSEnabled
	originalCredential := common.SMSBaoCredential
	originalFactory := common.SMSProviderFactory
	t.Cleanup(func() {
		common.SMSEnabled = originalEnabled
		common.SMSBaoCredential = originalCredential
		common.SMSProviderFactory = originalFactory
	})

	common.SMSEnabled = true
	common.SMSBaoCredential = "leak-me-token"
	common.SMSProviderFactory = func(providerName string) (common.SMSProvider, error) {
		return fakeSMSStatusProvider{result: common.SMSProviderStatusResult{
			Provider:       common.SMSProviderSMSBao,
			ProviderCode:   "0",
			Success:        true,
			SentCount:      12,
			RemainingCount: 88,
		}}, nil
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/sms/admin/status", nil)

	AdminGetSMSStatus(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}
	var response struct {
		Success bool           `json:"success"`
		Message string         `json:"message"`
		Data    map[string]any `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !response.Success {
		t.Fatalf("expected success response, got %q", response.Message)
	}
	body := recorder.Body.String()
	for _, forbidden := range []string{"leak-me-token", "demo-user"} {
		if strings.Contains(body, forbidden) {
			t.Fatalf("status response leaked %q: %s", forbidden, body)
		}
	}
	if response.Data["provider"] != common.SMSProviderSMSBao || response.Data["provider_code"] != "0" {
		t.Fatalf("unexpected provider metadata: %+v", response.Data)
	}
	if response.Data["sent_count"] != float64(12) || response.Data["remaining_count"] != float64(88) {
		t.Fatalf("unexpected balance data: %+v", response.Data)
	}
}

func TestAdminGetSMSStatusRejectsProviderWithoutStatusCheck(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalEnabled := common.SMSEnabled
	originalFactory := common.SMSProviderFactory
	t.Cleanup(func() {
		common.SMSEnabled = originalEnabled
		common.SMSProviderFactory = originalFactory
	})

	common.SMSEnabled = true
	common.SMSProviderFactory = func(providerName string) (common.SMSProvider, error) {
		return fakeSMSProvider{t: t}, nil
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/sms/admin/status", nil)

	AdminGetSMSStatus(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "SMS provider does not support status check") {
		t.Fatalf("expected unsupported provider message, got %s", recorder.Body.String())
	}
}

type fakeSMSProvider struct {
	t         *testing.T
	wantPhone string
	wantCode  string
}

func (provider fakeSMSProvider) Send(ctx context.Context, input common.SMSProviderSendInput) (common.SMSProviderSendResult, error) {
	provider.t.Helper()
	if input.Phone != provider.wantPhone {
		provider.t.Fatalf("unexpected phone sent to provider: %q", input.Phone)
	}
	if !strings.Contains(input.Content, provider.wantCode) {
		provider.t.Fatalf("expected content to include verification code, got %q", input.Content)
	}
	return common.SMSProviderSendResult{
		Provider:     common.SMSProviderSMSBao,
		ProviderCode: "0",
		Success:      true,
	}, nil
}

type fakeSMSStatusProvider struct {
	result common.SMSProviderStatusResult
}

func (provider fakeSMSStatusProvider) Send(ctx context.Context, input common.SMSProviderSendInput) (common.SMSProviderSendResult, error) {
	return common.SMSProviderSendResult{}, nil
}

func (provider fakeSMSStatusProvider) CheckStatus(ctx context.Context) (common.SMSProviderStatusResult, error) {
	return provider.result, nil
}
