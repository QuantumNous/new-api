package controller

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	appI18n "github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestAdminTestSMSRedactsSensitiveResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalDB := model.DB
	originalEnabled := common.SMSEnabled
	originalSignature := common.SMSSignature
	originalSignatureStatus := common.SMSSignatureReviewStatus
	originalProductName := common.SMSProductName
	originalTemplate := common.SMSTemplate
	originalCredential := common.SMSBaoCredential
	originalFactory := common.SMSProviderFactory
	t.Cleanup(func() {
		model.DB = originalDB
		common.SMSEnabled = originalEnabled
		common.SMSSignature = originalSignature
		common.SMSSignatureReviewStatus = originalSignatureStatus
		common.SMSProductName = originalProductName
		common.SMSTemplate = originalTemplate
		common.SMSBaoCredential = originalCredential
		common.SMSProviderFactory = originalFactory
	})

	model.DB = nil
	common.SMSEnabled = true
	common.SMSSignature = "NewAPI"
	common.SMSSignatureReviewStatus = common.SMSSignatureStatusApproved
	common.SMSProductName = "分销系统"
	common.SMSTemplate = "{product} 注册验证码 {code}，{minutes} 分钟内有效。"
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

func TestSendSMSRegisterCodeStoresVerificationAndRedactsResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalDB := model.DB
	originalRegisterEnabled := common.RegisterEnabled
	originalEnabled := common.SMSEnabled
	originalSignature := common.SMSSignature
	originalSignatureStatus := common.SMSSignatureReviewStatus
	originalProductName := common.SMSProductName
	originalTemplate := common.SMSTemplate
	originalRateLimitEnabled := common.SMSRateLimitEnabled
	originalFactory := common.SMSProviderFactory
	t.Cleanup(func() {
		model.DB = originalDB
		common.RegisterEnabled = originalRegisterEnabled
		common.SMSEnabled = originalEnabled
		common.SMSSignature = originalSignature
		common.SMSSignatureReviewStatus = originalSignatureStatus
		common.SMSProductName = originalProductName
		common.SMSTemplate = originalTemplate
		common.SMSRateLimitEnabled = originalRateLimitEnabled
		common.SMSProviderFactory = originalFactory
		common.DeleteKey("13800138000", common.SMSVerificationPurpose(common.SMSSceneRegister))
		service.ResetSMSRateLimiterForTest()
	})

	model.DB = newSMSControllerTestDB(t)
	common.RegisterEnabled = true
	common.SMSEnabled = true
	common.SMSSignature = "NewAPI"
	common.SMSSignatureReviewStatus = common.SMSSignatureStatusApproved
	common.SMSProductName = "分销系统"
	common.SMSTemplate = "{product} 注册验证码 {code}，{minutes} 分钟内有效。"
	common.SMSRateLimitEnabled = false
	service.ResetSMSRateLimiterForTest()

	var sentPhone string
	var sentContent string
	common.SMSProviderFactory = func(providerName string) (common.SMSProvider, error) {
		return captureSMSProvider{
			phone:   &sentPhone,
			content: &sentContent,
		}, nil
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/user/sms/register/code", bytes.NewBufferString(`{
		"phone":"13800138000"
	}`))

	SendSMSRegisterCode(ctx)

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
	if sentPhone != "13800138000" {
		t.Fatalf("unexpected provider phone: %q", sentPhone)
	}
	match := regexp.MustCompile(`注册验证码 ([0-9]{6})`).FindStringSubmatch(sentContent)
	if len(match) != 2 {
		t.Fatalf("expected provider content to include six digit code, got %q", sentContent)
	}
	code := match[1]
	if !common.VerifyCodeWithKey("13800138000", code, common.SMSVerificationPurpose(common.SMSSceneRegister)) {
		t.Fatal("expected generated sms code to be registered for later sms registration")
	}

	body := recorder.Body.String()
	for _, forbidden := range []string{"13800138000", code, sentContent} {
		if strings.Contains(body, forbidden) {
			t.Fatalf("response leaked %q: %s", forbidden, body)
		}
	}
	if response.Data["phone_masked"] != "138****8000" || response.Data["template_scene"] != common.SMSSceneRegister {
		t.Fatalf("unexpected response metadata: %+v", response.Data)
	}

	var logs []model.SMSSendLog
	if err := model.DB.Find(&logs).Error; err != nil {
		t.Fatalf("read sms send logs: %v", err)
	}
	if len(logs) != 1 {
		t.Fatalf("expected one sms send log, got %d", len(logs))
	}
	logPayload, err := json.Marshal(logs[0])
	if err != nil {
		t.Fatalf("marshal sms send log: %v", err)
	}
	if strings.Contains(string(logPayload), "13800138000") || strings.Contains(string(logPayload), code) {
		t.Fatalf("sms send log leaked phone or code: %s", string(logPayload))
	}
	if logs[0].PhoneMasked != "138****8000" || logs[0].Scene != common.SMSSceneRegister {
		t.Fatalf("unexpected sms send log: %+v", logs[0])
	}
}

func TestSendSMSLoginCodeStoresVerificationForActiveBindingAndRedactsResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalDB := model.DB
	originalEnabled := common.SMSEnabled
	originalSignature := common.SMSSignature
	originalSignatureStatus := common.SMSSignatureReviewStatus
	originalProductName := common.SMSProductName
	originalTemplate := common.SMSTemplate
	originalRateLimitEnabled := common.SMSRateLimitEnabled
	originalFactory := common.SMSProviderFactory
	t.Cleanup(func() {
		model.DB = originalDB
		common.SMSEnabled = originalEnabled
		common.SMSSignature = originalSignature
		common.SMSSignatureReviewStatus = originalSignatureStatus
		common.SMSProductName = originalProductName
		common.SMSTemplate = originalTemplate
		common.SMSRateLimitEnabled = originalRateLimitEnabled
		common.SMSProviderFactory = originalFactory
		common.DeleteKey("1007", common.SMSVerificationPurpose(common.SMSSceneLogin))
		service.ResetSMSRateLimiterForTest()
	})

	db := newSMSPhoneLoginTestDB(t)
	model.DB = db
	common.SMSEnabled = true
	common.SMSSignature = "NewAPI"
	common.SMSSignatureReviewStatus = common.SMSSignatureStatusApproved
	common.SMSProductName = "Affiliate"
	common.SMSTemplate = "{product} login verification code {code}, valid for {minutes} minutes."
	common.SMSRateLimitEnabled = false
	service.ResetSMSRateLimiterForTest()

	user := model.User{
		Username:    "sms-code-login",
		DisplayName: "SMS Code Login",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("seed sms login code user: %v", err)
	}
	if _, err := service.BindUserPhone(db, service.UserPhoneBindingInput{
		UserID:   user.Id,
		Phone:    "1007",
		Provider: common.SMSProviderName,
	}); err != nil {
		t.Fatalf("bind phone: %v", err)
	}

	var sentPhone string
	var sentContent string
	common.SMSProviderFactory = func(providerName string) (common.SMSProvider, error) {
		return captureSMSProvider{
			phone:   &sentPhone,
			content: &sentContent,
		}, nil
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/user/sms/login/code", bytes.NewBufferString(`{
		"phone":"1007"
	}`))

	SendSMSLoginCode(ctx)

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
	if sentPhone != "1007" {
		t.Fatalf("unexpected provider phone: %q", sentPhone)
	}
	match := regexp.MustCompile(`login verification code ([0-9]{6})`).FindStringSubmatch(sentContent)
	if len(match) != 2 {
		t.Fatalf("expected provider content to include six digit login code, got %q", sentContent)
	}
	code := match[1]
	if !common.VerifyCodeWithKey("1007", code, common.SMSVerificationPurpose(common.SMSSceneLogin)) {
		t.Fatal("expected generated sms code to be registered for later phone login")
	}

	body := recorder.Body.String()
	for _, forbidden := range []string{"1007", code, sentContent} {
		if strings.Contains(body, forbidden) {
			t.Fatalf("login code response leaked %q: %s", forbidden, body)
		}
	}
	if response.Data["phone_masked"] != "1****7" || response.Data["template_scene"] != common.SMSSceneLogin {
		t.Fatalf("unexpected response metadata: %+v", response.Data)
	}
	var logs []model.SMSSendLog
	if err := db.Find(&logs).Error; err != nil {
		t.Fatalf("read sms send logs: %v", err)
	}
	if len(logs) != 1 {
		t.Fatalf("expected one sms send log, got %d", len(logs))
	}
	logPayload, err := json.Marshal(logs[0])
	if err != nil {
		t.Fatalf("marshal sms send log: %v", err)
	}
	if strings.Contains(string(logPayload), "1007") || strings.Contains(string(logPayload), code) {
		t.Fatalf("sms login send log leaked phone or code: %s", string(logPayload))
	}
	if logs[0].PhoneMasked != "1****7" || logs[0].Scene != common.SMSSceneLogin {
		t.Fatalf("unexpected sms login send log: %+v", logs[0])
	}
}

func TestSendSMSLoginCodeRejectsUnboundPhoneBeforeProvider(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalDB := model.DB
	originalEnabled := common.SMSEnabled
	originalSignature := common.SMSSignature
	originalSignatureStatus := common.SMSSignatureReviewStatus
	originalProductName := common.SMSProductName
	originalTemplate := common.SMSTemplate
	originalRateLimitEnabled := common.SMSRateLimitEnabled
	originalFactory := common.SMSProviderFactory
	t.Cleanup(func() {
		model.DB = originalDB
		common.SMSEnabled = originalEnabled
		common.SMSSignature = originalSignature
		common.SMSSignatureReviewStatus = originalSignatureStatus
		common.SMSProductName = originalProductName
		common.SMSTemplate = originalTemplate
		common.SMSRateLimitEnabled = originalRateLimitEnabled
		common.SMSProviderFactory = originalFactory
		common.DeleteKey("1008", common.SMSVerificationPurpose(common.SMSSceneLogin))
		service.ResetSMSRateLimiterForTest()
	})

	model.DB = newSMSPhoneLoginTestDB(t)
	common.SMSEnabled = true
	common.SMSSignature = "NewAPI"
	common.SMSSignatureReviewStatus = common.SMSSignatureStatusApproved
	common.SMSProductName = "Affiliate"
	common.SMSTemplate = "{product} login verification code {code}, valid for {minutes} minutes."
	common.SMSRateLimitEnabled = false
	service.ResetSMSRateLimiterForTest()

	providerCalls := 0
	common.SMSProviderFactory = func(providerName string) (common.SMSProvider, error) {
		return countingSMSProvider{calls: &providerCalls}, nil
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/user/sms/login/code", bytes.NewBufferString(`{
		"phone":"1008"
	}`))

	SendSMSLoginCode(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}
	var response struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response.Success {
		t.Fatalf("expected unbound phone login code request to fail, body=%s", recorder.Body.String())
	}
	if !strings.Contains(response.Message, "phone is not bound") {
		t.Fatalf("expected unbound phone message, got %q", response.Message)
	}
	if providerCalls != 0 {
		t.Fatalf("provider should not be called for unbound phone, got %d", providerCalls)
	}
	if common.VerifyCodeWithKey("1008", "123456", common.SMSVerificationPurpose(common.SMSSceneLogin)) {
		t.Fatal("unbound phone request must not register a login code")
	}
	for _, forbidden := range []string{"1008", "123456"} {
		if strings.Contains(recorder.Body.String(), forbidden) {
			t.Fatalf("login code error response leaked %q: %s", forbidden, recorder.Body.String())
		}
	}
}

func TestSMSPhoneLoginUsesActiveBindingWithoutAutoRegistering(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalDB := model.DB
	originalEnabled := common.SMSEnabled
	t.Cleanup(func() {
		model.DB = originalDB
		common.SMSEnabled = originalEnabled
		common.DeleteKey("1001", common.SMSVerificationPurpose(common.SMSSceneLogin))
	})

	db := newSMSPhoneLoginTestDB(t)
	model.DB = db
	common.SMSEnabled = true

	hashedPassword, err := common.Password2Hash("password123")
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}
	user := model.User{
		Username:    "smsloginuser",
		Password:    hashedPassword,
		DisplayName: "SMS Login User",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("seed sms login user: %v", err)
	}
	if _, err := service.BindUserPhone(db, service.UserPhoneBindingInput{
		UserID:   user.Id,
		Phone:    "1001",
		Provider: common.SMSProviderName,
	}); err != nil {
		t.Fatalf("bind phone: %v", err)
	}
	common.RegisterVerificationCodeWithKey("1001", "123456", common.SMSVerificationPurpose(common.SMSSceneLogin))

	router := newSMSPhoneLoginTestRouter()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/user/login/phone", bytes.NewBufferString(`{
		"phone":"1001",
		"verification_code":"123456"
	}`))

	router.ServeHTTP(recorder, request)

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
		t.Fatalf("expected successful phone login, got %q", response.Message)
	}
	if response.Data["id"] != float64(user.Id) || response.Data["username"] != "smsloginuser" {
		t.Fatalf("unexpected login response data: %+v", response.Data)
	}
	body := recorder.Body.String()
	for _, forbidden := range []string{"1001", "123456"} {
		if strings.Contains(body, forbidden) {
			t.Fatalf("phone login response leaked %q: %s", forbidden, body)
		}
	}
	var userCount int64
	if err := db.Model(&model.User{}).Count(&userCount).Error; err != nil {
		t.Fatalf("count users: %v", err)
	}
	if userCount != 1 {
		t.Fatalf("phone login must not auto-register users, got user count %d", userCount)
	}
}

func TestSMSPhoneLoginRejectsUnboundPhoneWithoutCreatingUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalDB := model.DB
	originalEnabled := common.SMSEnabled
	t.Cleanup(func() {
		model.DB = originalDB
		common.SMSEnabled = originalEnabled
		common.DeleteKey("1002", common.SMSVerificationPurpose(common.SMSSceneLogin))
	})

	db := newSMSPhoneLoginTestDB(t)
	model.DB = db
	common.SMSEnabled = true
	common.RegisterVerificationCodeWithKey("1002", "123456", common.SMSVerificationPurpose(common.SMSSceneLogin))

	router := newSMSPhoneLoginTestRouter()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/user/login/phone", bytes.NewBufferString(`{
		"phone":"1002",
		"verification_code":"123456"
	}`))

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}
	var response struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response.Success {
		t.Fatalf("expected unbound phone login to fail, body=%s", recorder.Body.String())
	}
	if !strings.Contains(response.Message, "phone is not bound") {
		t.Fatalf("expected unbound phone message, got %q", response.Message)
	}
	body := recorder.Body.String()
	for _, forbidden := range []string{"1002", "123456"} {
		if strings.Contains(body, forbidden) {
			t.Fatalf("phone login error response leaked %q: %s", forbidden, body)
		}
	}
	var userCount int64
	if err := db.Model(&model.User{}).Count(&userCount).Error; err != nil {
		t.Fatalf("count users: %v", err)
	}
	if userCount != 0 {
		t.Fatalf("unbound phone login must not auto-register users, got user count %d", userCount)
	}
	var bindingCount int64
	if err := db.Model(&model.UserPhoneBinding{}).Count(&bindingCount).Error; err != nil {
		t.Fatalf("count phone bindings: %v", err)
	}
	if bindingCount != 0 {
		t.Fatalf("unbound phone login must not create bindings, got %d", bindingCount)
	}
}

func TestSMSPhoneLoginRespectsEnabledTwoFA(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalDB := model.DB
	originalEnabled := common.SMSEnabled
	t.Cleanup(func() {
		model.DB = originalDB
		common.SMSEnabled = originalEnabled
		common.DeleteKey("1006", common.SMSVerificationPurpose(common.SMSSceneLogin))
	})

	db := newSMSPhoneLoginTestDB(t)
	model.DB = db
	common.SMSEnabled = true

	user := model.User{
		Username:    "smslogin2fa",
		Password:    "hashed-password-not-used",
		DisplayName: "SMS Login 2FA",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("seed 2fa user: %v", err)
	}
	if err := db.Create(&model.TwoFA{
		UserId:    user.Id,
		Secret:    "test-secret",
		IsEnabled: true,
	}).Error; err != nil {
		t.Fatalf("seed 2fa: %v", err)
	}
	if _, err := service.BindUserPhone(db, service.UserPhoneBindingInput{
		UserID: user.Id,
		Phone:  "1006",
	}); err != nil {
		t.Fatalf("bind 2fa phone: %v", err)
	}
	common.RegisterVerificationCodeWithKey("1006", "123456", common.SMSVerificationPurpose(common.SMSSceneLogin))

	router := newSMSPhoneLoginTestRouter()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/user/login/phone", bytes.NewBufferString(`{
		"phone":"1006",
		"verification_code":"123456"
	}`))

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}
	var response struct {
		Success bool           `json:"success"`
		Data    map[string]any `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !response.Success || response.Data["require_2fa"] != true {
		t.Fatalf("expected phone login to require 2fa, got body=%s", recorder.Body.String())
	}
	if _, ok := response.Data["id"]; ok {
		t.Fatalf("2fa pending login must not return logged-in user data: %+v", response.Data)
	}
}

func TestAdminTestSMSRecordsRedactedSendLog(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalDB := model.DB
	originalEnabled := common.SMSEnabled
	originalSignature := common.SMSSignature
	originalSignatureStatus := common.SMSSignatureReviewStatus
	originalProductName := common.SMSProductName
	originalTemplate := common.SMSTemplate
	originalCredential := common.SMSBaoCredential
	originalFactory := common.SMSProviderFactory
	t.Cleanup(func() {
		model.DB = originalDB
		common.SMSEnabled = originalEnabled
		common.SMSSignature = originalSignature
		common.SMSSignatureReviewStatus = originalSignatureStatus
		common.SMSProductName = originalProductName
		common.SMSTemplate = originalTemplate
		common.SMSBaoCredential = originalCredential
		common.SMSProviderFactory = originalFactory
	})

	db := newSMSControllerTestDB(t)
	model.DB = db
	common.SMSEnabled = true
	common.SMSSignature = "NewAPI"
	common.SMSSignatureReviewStatus = common.SMSSignatureStatusApproved
	common.SMSProductName = "分销系统"
	common.SMSTemplate = "{product} 注册验证码 {code}，{minutes} 分钟内有效。"
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
	var logs []model.SMSSendLog
	if err := db.Find(&logs).Error; err != nil {
		t.Fatalf("read sms send logs: %v", err)
	}
	if len(logs) != 1 {
		t.Fatalf("expected one sms send log, got %d", len(logs))
	}
	log := logs[0]
	if log.PhoneMasked != "138****8000" || log.Scene != common.SMSSceneRegister || log.Provider != common.SMSProviderSMSBao || log.ProviderCode != "0" {
		t.Fatalf("unexpected sms send log: %+v", log)
	}
	if log.TemplateVersion == "" || strings.Contains(log.TemplateVersion, "123456") || strings.Contains(log.TemplateVersion, "注册验证码 123456") {
		t.Fatalf("template version leaked code or content: %+v", log)
	}
	payload, err := json.Marshal(log)
	if err != nil {
		t.Fatalf("marshal sms send log: %v", err)
	}
	for _, forbidden := range []string{"13800138000", "123456", "leak-me-token", "注册验证码 123456"} {
		if strings.Contains(string(payload), forbidden) {
			t.Fatalf("sms send log leaked %q: %s", forbidden, string(payload))
		}
	}
}

func TestAdminTestSMSAppliesRateLimitBeforeProvider(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalDB := model.DB
	originalEnabled := common.SMSEnabled
	originalSignature := common.SMSSignature
	originalSignatureStatus := common.SMSSignatureReviewStatus
	originalProductName := common.SMSProductName
	originalTemplate := common.SMSTemplate
	originalRateLimitEnabled := common.SMSRateLimitEnabled
	originalRateLimitWindow := common.SMSRateLimitWindowSeconds
	originalRateLimitPhone := common.SMSRateLimitPhoneCount
	originalRateLimitIP := common.SMSRateLimitIPCount
	originalRateLimitAccount := common.SMSRateLimitAccountCount
	originalRateLimitScene := common.SMSRateLimitSceneCount
	originalFactory := common.SMSProviderFactory
	t.Cleanup(func() {
		model.DB = originalDB
		common.SMSEnabled = originalEnabled
		common.SMSSignature = originalSignature
		common.SMSSignatureReviewStatus = originalSignatureStatus
		common.SMSProductName = originalProductName
		common.SMSTemplate = originalTemplate
		common.SMSRateLimitEnabled = originalRateLimitEnabled
		common.SMSRateLimitWindowSeconds = originalRateLimitWindow
		common.SMSRateLimitPhoneCount = originalRateLimitPhone
		common.SMSRateLimitIPCount = originalRateLimitIP
		common.SMSRateLimitAccountCount = originalRateLimitAccount
		common.SMSRateLimitSceneCount = originalRateLimitScene
		common.SMSProviderFactory = originalFactory
		service.ResetSMSRateLimiterForTest()
	})

	model.DB = nil
	common.SMSEnabled = true
	common.SMSSignature = "NewAPI"
	common.SMSSignatureReviewStatus = common.SMSSignatureStatusApproved
	common.SMSProductName = "分销系统"
	common.SMSTemplate = "{product} 注册验证码 {code}，{minutes} 分钟内有效。"
	common.SMSRateLimitEnabled = true
	common.SMSRateLimitWindowSeconds = 60
	common.SMSRateLimitPhoneCount = 1
	common.SMSRateLimitIPCount = 0
	common.SMSRateLimitAccountCount = 0
	common.SMSRateLimitSceneCount = 0
	service.ResetSMSRateLimiterForTest()

	providerCalls := 0
	common.SMSProviderFactory = func(providerName string) (common.SMSProvider, error) {
		return countingSMSProvider{calls: &providerCalls}, nil
	}

	first := httptest.NewRecorder()
	firstCtx, _ := gin.CreateTestContext(first)
	firstCtx.Request = httptest.NewRequest(http.MethodPost, "/api/sms/admin/test", bytes.NewBufferString(`{
		"phone":"13800138000",
		"scene":"register",
		"code":"123456"
	}`))
	AdminTestSMS(firstCtx)
	if first.Code != http.StatusOK || !strings.Contains(first.Body.String(), `"success":true`) {
		t.Fatalf("first request should pass, status=%d body=%s", first.Code, first.Body.String())
	}

	second := httptest.NewRecorder()
	secondCtx, _ := gin.CreateTestContext(second)
	secondCtx.Request = httptest.NewRequest(http.MethodPost, "/api/sms/admin/test", bytes.NewBufferString(`{
		"phone":"13800138000",
		"scene":"register",
		"code":"123456"
	}`))
	AdminTestSMS(secondCtx)

	if second.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", second.Code, second.Body.String())
	}
	if !strings.Contains(second.Body.String(), "sms rate limit exceeded: phone") {
		t.Fatalf("expected phone rate limit message, got %s", second.Body.String())
	}
	if providerCalls != 1 {
		t.Fatalf("provider should be called once before rate limit blocks, got %d", providerCalls)
	}
}

func TestAdminTestSMSUsesPersistedRateLimitAcrossLimiterReset(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalDB := model.DB
	originalEnabled := common.SMSEnabled
	originalSignature := common.SMSSignature
	originalSignatureStatus := common.SMSSignatureReviewStatus
	originalProductName := common.SMSProductName
	originalTemplate := common.SMSTemplate
	originalRateLimitEnabled := common.SMSRateLimitEnabled
	originalRateLimitWindow := common.SMSRateLimitWindowSeconds
	originalRateLimitPhone := common.SMSRateLimitPhoneCount
	originalRateLimitIP := common.SMSRateLimitIPCount
	originalRateLimitAccount := common.SMSRateLimitAccountCount
	originalRateLimitScene := common.SMSRateLimitSceneCount
	originalFactory := common.SMSProviderFactory
	t.Cleanup(func() {
		model.DB = originalDB
		common.SMSEnabled = originalEnabled
		common.SMSSignature = originalSignature
		common.SMSSignatureReviewStatus = originalSignatureStatus
		common.SMSProductName = originalProductName
		common.SMSTemplate = originalTemplate
		common.SMSRateLimitEnabled = originalRateLimitEnabled
		common.SMSRateLimitWindowSeconds = originalRateLimitWindow
		common.SMSRateLimitPhoneCount = originalRateLimitPhone
		common.SMSRateLimitIPCount = originalRateLimitIP
		common.SMSRateLimitAccountCount = originalRateLimitAccount
		common.SMSRateLimitSceneCount = originalRateLimitScene
		common.SMSProviderFactory = originalFactory
		service.ResetSMSRateLimiterForTest()
	})

	model.DB = newSMSControllerTestDB(t)
	common.SMSEnabled = true
	common.SMSSignature = "NewAPI"
	common.SMSSignatureReviewStatus = common.SMSSignatureStatusApproved
	common.SMSProductName = "分销系统"
	common.SMSTemplate = "{product} 注册验证码 {code}，{minutes} 分钟内有效。"
	common.SMSRateLimitEnabled = true
	common.SMSRateLimitWindowSeconds = 60
	common.SMSRateLimitPhoneCount = 1
	common.SMSRateLimitIPCount = 0
	common.SMSRateLimitAccountCount = 0
	common.SMSRateLimitSceneCount = 0
	service.ResetSMSRateLimiterForTest()

	providerCalls := 0
	common.SMSProviderFactory = func(providerName string) (common.SMSProvider, error) {
		return countingSMSProvider{calls: &providerCalls}, nil
	}

	first := httptest.NewRecorder()
	firstCtx, _ := gin.CreateTestContext(first)
	firstCtx.Request = httptest.NewRequest(http.MethodPost, "/api/sms/admin/test", bytes.NewBufferString(`{
		"phone":"13800138000",
		"scene":"register",
		"code":"123456"
	}`))
	AdminTestSMS(firstCtx)
	if first.Code != http.StatusOK || !strings.Contains(first.Body.String(), `"success":true`) {
		t.Fatalf("first request should pass, status=%d body=%s", first.Code, first.Body.String())
	}

	service.ResetSMSRateLimiterForTest()
	second := httptest.NewRecorder()
	secondCtx, _ := gin.CreateTestContext(second)
	secondCtx.Request = httptest.NewRequest(http.MethodPost, "/api/sms/admin/test", bytes.NewBufferString(`{
		"phone":"13800138000",
		"scene":"register",
		"code":"123456"
	}`))
	AdminTestSMS(secondCtx)

	if second.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", second.Code, second.Body.String())
	}
	if !strings.Contains(second.Body.String(), "sms rate limit exceeded: phone") {
		t.Fatalf("expected persisted phone rate limit message, got %s", second.Body.String())
	}
	if providerCalls != 1 {
		t.Fatalf("provider should be called once before persisted rate limit blocks, got %d", providerCalls)
	}
}

func TestAdminTestSMSRejectsUnapprovedSignatureBeforeProvider(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalDB := model.DB
	originalEnabled := common.SMSEnabled
	originalSignature := common.SMSSignature
	originalSignatureStatus := common.SMSSignatureReviewStatus
	originalProductName := common.SMSProductName
	originalTemplate := common.SMSTemplate
	originalRateLimitEnabled := common.SMSRateLimitEnabled
	originalFactory := common.SMSProviderFactory
	t.Cleanup(func() {
		model.DB = originalDB
		common.SMSEnabled = originalEnabled
		common.SMSSignature = originalSignature
		common.SMSSignatureReviewStatus = originalSignatureStatus
		common.SMSProductName = originalProductName
		common.SMSTemplate = originalTemplate
		common.SMSRateLimitEnabled = originalRateLimitEnabled
		common.SMSProviderFactory = originalFactory
		service.ResetSMSRateLimiterForTest()
	})

	db := newSMSControllerTestDB(t)
	model.DB = db
	common.SMSEnabled = true
	common.SMSSignature = "NewAPI"
	common.SMSSignatureReviewStatus = common.SMSSignatureStatusPending
	common.SMSProductName = "分销系统"
	common.SMSTemplate = "{product} 注册验证码 {code}，{minutes} 分钟内有效。"
	common.SMSRateLimitEnabled = false
	service.ResetSMSRateLimiterForTest()

	providerCalls := 0
	common.SMSProviderFactory = func(providerName string) (common.SMSProvider, error) {
		return countingSMSProvider{calls: &providerCalls}, nil
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
	if !strings.Contains(recorder.Body.String(), "sms signature is not approved") {
		t.Fatalf("expected unapproved signature message, got %s", recorder.Body.String())
	}
	if providerCalls != 0 {
		t.Fatalf("provider should not be called when signature is not approved, got %d", providerCalls)
	}
	var logCount int64
	if err := db.Model(&model.SMSSendLog{}).Count(&logCount).Error; err != nil {
		t.Fatalf("count sms send logs: %v", err)
	}
	if logCount != 0 {
		t.Fatalf("unapproved signature should not write sms send logs, got %d", logCount)
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

func newSMSControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(model.SMSSidecarModels()...); err != nil {
		t.Fatalf("migrate sms sidecar models: %v", err)
	}
	return db
}

func newSMSPhoneLoginTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	models := append([]interface{}{&model.User{}, &model.TwoFA{}}, model.SMSSidecarModels()...)
	if err := db.AutoMigrate(models...); err != nil {
		t.Fatalf("migrate sms phone login models: %v", err)
	}
	return db
}

func newSMSPhoneLoginTestRouter() *gin.Engine {
	if err := appI18n.Init(); err != nil {
		panic(err)
	}
	router := gin.New()
	router.Use(sessions.Sessions("session", cookie.NewStore([]byte("sms-phone-login-test"))))
	router.POST("/api/user/login/phone", SMSPhoneLogin)
	return router
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

type captureSMSProvider struct {
	phone   *string
	content *string
}

func (provider captureSMSProvider) Send(ctx context.Context, input common.SMSProviderSendInput) (common.SMSProviderSendResult, error) {
	if provider.phone != nil {
		*provider.phone = input.Phone
	}
	if provider.content != nil {
		*provider.content = input.Content
	}
	return common.SMSProviderSendResult{
		Provider:     common.SMSProviderSMSBao,
		ProviderCode: "0",
		Success:      true,
	}, nil
}

func (provider fakeSMSStatusProvider) Send(ctx context.Context, input common.SMSProviderSendInput) (common.SMSProviderSendResult, error) {
	return common.SMSProviderSendResult{}, nil
}

func (provider fakeSMSStatusProvider) CheckStatus(ctx context.Context) (common.SMSProviderStatusResult, error) {
	return provider.result, nil
}

type countingSMSProvider struct {
	calls *int
}

func (provider countingSMSProvider) Send(ctx context.Context, input common.SMSProviderSendInput) (common.SMSProviderSendResult, error) {
	*provider.calls = *provider.calls + 1
	return common.SMSProviderSendResult{
		Provider:     common.SMSProviderSMSBao,
		ProviderCode: "0",
		Success:      true,
	}, nil
}
