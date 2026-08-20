package controller

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	appI18n "github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func withRegistrationSecurityConfig(t *testing.T, values map[string]string) {
	t.Helper()
	original := config.GlobalConfig.ExportAllConfigs()
	saved := make(map[string]string)
	for key, value := range original {
		if strings.HasPrefix(key, "registration_security.") {
			saved[key] = value
		}
	}
	t.Cleanup(func() { require.NoError(t, config.GlobalConfig.LoadFromDB(saved)) })
	// Registration endpoint tests use synthetic domains; keep them offline and
	// deterministic by disabling the live DNS validation unless a test opts in
	// explicitly. DNS policy itself is covered by service-level unit tests with
	// a stubbed checker.
	merged := make(map[string]string, len(values)+1)
	for k, v := range values {
		merged[k] = v
	}
	if _, set := merged["registration_security.enable_email_domain_dns_validation"]; !set {
		merged["registration_security.enable_email_domain_dns_validation"] = "false"
	}
	require.NoError(t, config.GlobalConfig.LoadFromDB(merged))
}

func configureRegistrationEndpointTest(t *testing.T) {
	t.Helper()
	originalRegisterEnabled := common.RegisterEnabled
	originalPasswordRegisterEnabled := common.PasswordRegisterEnabled
	originalEmailVerificationEnabled := common.EmailVerificationEnabled
	originalGenerateDefaultToken := constant.GenerateDefaultToken
	t.Cleanup(func() {
		common.RegisterEnabled = originalRegisterEnabled
		common.PasswordRegisterEnabled = originalPasswordRegisterEnabled
		common.EmailVerificationEnabled = originalEmailVerificationEnabled
		constant.GenerateDefaultToken = originalGenerateDefaultToken
	})
	common.RegisterEnabled = true
	common.PasswordRegisterEnabled = true
	common.EmailVerificationEnabled = false
	constant.GenerateDefaultToken = false
}

func TestRegisterRejectsSubdomainEmailDomain(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.RegistrationDomainState{}, &model.RegistrationDomainBlock{}, &model.RegistrationDomainBlockUser{}))
	configureRegistrationEndpointTest(t)
	withRegistrationSecurityConfig(t, map[string]string{
		"registration_security.domain_risk_enabled":            "false",
		"registration_security.domain_risk_window_hours":       "24",
		"registration_security.domain_risk_threshold":          "10",
		"registration_security.trusted_email_domains":          "[]",
		"registration_security.reject_subdomain_email_domains": "true",
	})

	body, err := common.Marshal(map[string]any{
		"username": "subdomain-user",
		"password": "password123",
		"email":    "user@mail.example.com",
	})
	require.NoError(t, err)
	recorder := performRegisterRequest(t, body)

	var payload struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.False(t, payload.Success)
	require.NotEmpty(t, payload.Message)
	var count int64
	require.NoError(t, db.Model(&model.User{}).Where("username = ?", "subdomain-user").Count(&count).Error)
	require.Zero(t, count)
}

func TestRegisterRejectsAutomatedEmailPattern(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	configureRegistrationEndpointTest(t)
	withRegistrationSecurityConfig(t, map[string]string{
		"registration_security.domain_risk_enabled":            "false",
		"registration_security.domain_risk_window_hours":       "24",
		"registration_security.domain_risk_threshold":          "10",
		"registration_security.trusted_email_domains":          "[]",
		"registration_security.reject_subdomain_email_domains": "false",
	})

	body, err := common.Marshal(map[string]any{
		"username": "automated-email-user",
		"password": "password123",
		"email":    "fk123456789abc@example.com",
	})
	require.NoError(t, err)
	recorder := performRegisterRequest(t, body)

	var payload struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.False(t, payload.Success)
	require.NotEmpty(t, payload.Message)
	var count int64
	require.NoError(t, db.Model(&model.User{}).Where("username = ?", "automated-email-user").Count(&count).Error)
	require.Zero(t, count)
}

func TestRegisterPersistsEmailDomainWhenRiskControlsAreDisabled(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	configureRegistrationEndpointTest(t)
	originalRestriction := common.EmailDomainRestrictionEnabled
	common.EmailDomainRestrictionEnabled = false
	t.Cleanup(func() { common.EmailDomainRestrictionEnabled = originalRestriction })
	withRegistrationSecurityConfig(t, map[string]string{
		"registration_security.domain_risk_enabled":            "false",
		"registration_security.domain_risk_window_hours":       "24",
		"registration_security.domain_risk_threshold":          "10",
		"registration_security.trusted_email_domains":          "[]",
		"registration_security.reject_subdomain_email_domains": "false",
	})
	body, err := common.Marshal(map[string]any{
		"username": "email-domain-user",
		"password": "password123",
		"email":    "User@Example.COM",
	})
	require.NoError(t, err)

	recorder := performRegisterRequest(t, body)

	var payload struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	var stored model.User
	require.NoError(t, db.Where("username = ?", "email-domain-user").First(&stored).Error)
	require.Equal(t, "User@Example.COM", stored.Email)
	require.Equal(t, "example.com", stored.EmailDomain)
}

func TestRegistrationEmailInternalErrorsUseGenericPublicMessage(t *testing.T) {
	require.NoError(t, appI18n.Init())
	gin.SetMode(gin.TestMode)
	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	context.Request = httptest.NewRequest(http.MethodPost, "/api/user/register", nil)
	internalErr := errors.New("SQLSTATE 08006 connection failure")

	message := registrationEmailErrorMessage(context, internalErr)

	require.NotContains(t, message, "SQLSTATE")
	require.NotEmpty(t, message)
}

func TestRegisterDomainThresholdRejectsTriggeringAccount(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.RegistrationDomainState{}, &model.RegistrationDomainBlock{}, &model.RegistrationDomainBlockUser{}))
	configureRegistrationEndpointTest(t)
	withRegistrationSecurityConfig(t, map[string]string{
		"registration_security.domain_risk_enabled":            "true",
		"registration_security.domain_risk_window_hours":       "24",
		"registration_security.domain_risk_threshold":          "2",
		"registration_security.trusted_email_domains":          "[]",
		"registration_security.reject_subdomain_email_domains": "false",
	})
	seed := model.User{Username: "seed-user", Email: "seed@farm.example", EmailDomain: "farm.example", Status: common.UserStatusEnabled, Role: common.RoleCommonUser, CreatedAt: time.Now().Unix()}
	require.NoError(t, db.Create(&seed).Error)

	body, err := common.Marshal(map[string]any{
		"username": "trigger-user",
		"password": "password123",
		"email":    "trigger@farm.example",
	})
	require.NoError(t, err)
	recorder := performRegisterRequest(t, body)

	var payload struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.False(t, payload.Success)
	require.NotEmpty(t, payload.Message)
	require.NotContains(t, payload.Message, "24")
	require.NotContains(t, payload.Message, "2")
	var triggerCount int64
	require.NoError(t, db.Model(&model.User{}).Where("username = ?", "trigger-user").Count(&triggerCount).Error)
	require.Zero(t, triggerCount)
	require.NoError(t, db.First(&seed, seed.Id).Error)
	require.Equal(t, common.UserStatusDisabled, seed.Status)
}

func TestSendEmailVerificationRejectsBlockedRegistrationDomain(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.RegistrationDomainState{}, &model.RegistrationDomainBlock{}, &model.RegistrationDomainBlockUser{}))
	withRegistrationSecurityConfig(t, map[string]string{
		"registration_security.domain_risk_enabled":            "true",
		"registration_security.domain_risk_window_hours":       "24",
		"registration_security.domain_risk_threshold":          "10",
		"registration_security.trusted_email_domains":          "[]",
		"registration_security.reject_subdomain_email_domains": "false",
	})
	block := model.RegistrationDomainBlock{Domain: "blocked.example", WindowHours: 24, Threshold: 10, ObservedCount: 10, BlockedAt: time.Now().Unix()}
	require.NoError(t, db.Create(&block).Error)
	require.NoError(t, db.Create(&model.RegistrationDomainState{Domain: "blocked.example", ActiveBlockID: block.Id}).Error)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/api/verification", SendEmailVerification)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/verification?email=user@blocked.example", nil)
	router.ServeHTTP(recorder, request)

	var payload struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.False(t, payload.Success)
	require.NotEmpty(t, payload.Message)
}

func TestLegacyOAuthRegistrationsUseDomainRiskTransaction(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	withRegistrationSecurityConfig(t, map[string]string{
		"registration_security.domain_risk_enabled":            "true",
		"registration_security.domain_risk_window_hours":       "24",
		"registration_security.domain_risk_threshold":          "2",
		"registration_security.trusted_email_domains":          "[]",
		"registration_security.reject_subdomain_email_domains": "false",
	})

	for _, provider := range []string{"github", "discord", "linuxdo", "oidc"} {
		t.Run(provider, func(t *testing.T) {
			domain := provider + ".example"
			seed := model.User{Username: provider + "-seed", AffCode: provider + "-aff", Email: "seed@" + domain, EmailDomain: domain, Status: common.UserStatusEnabled, Role: common.RoleCommonUser}
			require.NoError(t, db.Create(&seed).Error)
			candidate := model.User{Username: provider + "-candidate", Email: "new@" + domain, Status: common.UserStatusEnabled, Role: common.RoleCommonUser}
			context, _ := gin.CreateTestContext(httptest.NewRecorder())
			context.Request = httptest.NewRequest(http.MethodGet, "/oauth/"+provider, nil)

			err := registerLegacyOAuthUser(context, &candidate, 0)

			require.ErrorIs(t, err, model.ErrRegistrationDomainBlocked)
			require.Zero(t, candidate.Id)
		})
	}
}

func TestLegacyOAuthEmailLessRegistrationDoesNotCount(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	withRegistrationSecurityConfig(t, map[string]string{
		"registration_security.domain_risk_enabled":            "true",
		"registration_security.domain_risk_window_hours":       "24",
		"registration_security.domain_risk_threshold":          "2",
		"registration_security.trusted_email_domains":          "[]",
		"registration_security.reject_subdomain_email_domains": "true",
	})
	candidate := model.User{Username: "wechat-email-less", Status: common.UserStatusEnabled, Role: common.RoleCommonUser}
	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	context.Request = httptest.NewRequest(http.MethodGet, "/oauth/wechat", nil)

	err := registerLegacyOAuthUser(context, &candidate, 0)

	require.NoError(t, err)
	require.NotZero(t, candidate.Id)
	var states int64
	require.NoError(t, db.Model(&model.RegistrationDomainState{}).Count(&states).Error)
	require.Zero(t, states)
}

func TestRegisterHoneypotCreatesDisabledAccount(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	configureRegistrationEndpointTest(t)
	withRegistrationSecurityConfig(t, map[string]string{})

	body, err := common.Marshal(map[string]any{
		"username": "honeypot-bot",
		"password": "password123",
		"website":  "http://spam.example.com",
	})
	require.NoError(t, err)
	recorder := performRegisterRequest(t, body)

	// The bot sees a fully successful registration (no trap revealed)...
	var payload struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success, "honeypot registration must look successful to the bot")

	// ...but the account is created already disabled, so the bot cannot log in.
	var user model.User
	require.NoError(t, db.Where("username = ?", "honeypot-bot").First(&user).Error, "honeypot user is created")
	require.Equal(t, common.UserStatusDisabled, user.Status, "honeypot user must be created disabled")
	require.True(t, user.IsHoneypot, "honeypot user must carry the is_honeypot flag")
}

func TestRegisterWithoutHoneypotStillCreatesUser(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	configureRegistrationEndpointTest(t)
	withRegistrationSecurityConfig(t, map[string]string{
		"registration_security.domain_risk_enabled": "false",
	})

	body, err := common.Marshal(map[string]any{
		"username": "normal-human",
		"password": "password123",
	})
	require.NoError(t, err)
	recorder := performRegisterRequest(t, body)

	var payload struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)

	var count int64
	require.NoError(t, db.Model(&model.User{}).Where("username = ?", "normal-human").Count(&count).Error)
	require.Equal(t, int64(1), count)
}
