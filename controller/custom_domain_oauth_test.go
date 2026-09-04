package controller

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	appI18n "github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type domainBindTestProvider struct{}

func (*domainBindTestProvider) GetName() string { return "Domain Bind Test" }
func (*domainBindTestProvider) IsEnabled() bool { return true }
func (*domainBindTestProvider) ExchangeToken(context.Context, string, *gin.Context) (*oauth.OAuthToken, error) {
	return &oauth.OAuthToken{AccessToken: "provider-token"}, nil
}
func (*domainBindTestProvider) GetUserInfo(context.Context, *oauth.OAuthToken) (*oauth.OAuthUser, error) {
	return &oauth.OAuthUser{ProviderUserID: "provider-user-id"}, nil
}
func (*domainBindTestProvider) IsUserIDTaken(string) bool                      { return false }
func (*domainBindTestProvider) FillUserByProviderID(*model.User, string) error { return nil }
func (*domainBindTestProvider) SetProviderUserID(user *model.User, providerUserID string) {
	user.GitHubId = providerUserID
}
func (*domainBindTestProvider) GetProviderPrefix() string    { return "domain_bind_" }
func (*domainBindTestProvider) ProviderUserIDColumn() string { return "github_id" }

func TestGenerateOAuthCodeStoresTheTrustedCustomDomainID(t *testing.T) {
	setupAuthFlowControllerTest(t)
	require.NoError(t, model.DB.AutoMigrate(&model.User{}, &model.CustomDomain{}))
	owner := model.User{Username: "oauth-domain-owner", AffCode: "oauth-domain-aff", Status: common.UserStatusEnabled}
	require.NoError(t, model.DB.Create(&owner).Error)
	domain, err := model.CreateCustomDomain("alpha", owner.Id)
	require.NoError(t, err)
	domain, err = model.EnableCustomDomain(domain.Label)
	require.NoError(t, err)

	settings, err := common.ParseCustomDomainSettings("true", "yeschoy.io", "https://yeschoy.com", "5", "")
	require.NoError(t, err)
	resolver, err := service.NewCustomDomainResolver(settings)
	require.NoError(t, err)
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(middleware.CustomDomainContextWithResolver(resolver, true))
	router.POST("/api/oauth/state", GenerateOAuthCode)

	request := httptest.NewRequest(http.MethodPost, "https://alpha.yeschoy.io/api/oauth/state", strings.NewReader(`{"provider":"auth-flow-test","intent":"login"}`))
	request.Host = "alpha.yeschoy.io"
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	require.Equal(t, http.StatusOK, response.Code)

	var body struct {
		Data struct {
			FlowToken string `json:"flow_token"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
	flow, err := model.GetAuthFlow(body.Data.FlowToken, model.AuthFlowMatch{Purpose: model.AuthFlowPurposeOAuth, Provider: "auth-flow-test"})
	require.NoError(t, err)
	var payload oauthFlowPayload
	require.NoError(t, common.UnmarshalJsonStr(flow.Payload, &payload))
	assert.Equal(t, domain.Id, payload.DomainID)
	assert.Equal(t, "alpha.yeschoy.io", payload.OriginHost)
	assert.NotEmpty(t, payload.BrowserBindingHash)

	var bindingCookie *http.Cookie
	for _, cookie := range response.Result().Cookies() {
		if cookie.Name == domainOAuthBindingCookieName {
			bindingCookie = cookie
			break
		}
	}
	require.NotNil(t, bindingCookie)
	assert.Empty(t, bindingCookie.Domain)
	assert.Equal(t, "/", bindingCookie.Path)
	assert.True(t, bindingCookie.HttpOnly)
	assert.True(t, bindingCookie.Secure)
	assert.Equal(t, http.SameSiteStrictMode, bindingCookie.SameSite)
	assert.Equal(t, domainOAuthBindingCookieMaxAge, bindingCookie.MaxAge)
}

func TestGenerateOAuthCodeStoresAPeerMainOriginWithoutPromotionID(t *testing.T) {
	for _, host := range []string{"yeschoy.pro", "api.yeschoy.com"} {
		t.Run(host, func(t *testing.T) { testGenerateOAuthCodeStoresAPeerMainOriginWithoutPromotionID(t, host) })
	}
}

func testGenerateOAuthCodeStoresAPeerMainOriginWithoutPromotionID(t *testing.T, host string) {
	t.Helper()
	setupAuthFlowControllerTest(t)
	settings, err := common.ParseCustomDomainSettingsWithMainOrigins(
		"true",
		"yeschoy.io",
		"https://yeschoy.com",
		"https://yeschoy.com,https://yeschoy.pro,https://future.example,https://*.yeschoy.com",
		"5",
		"",
	)
	require.NoError(t, err)
	resolver, err := service.NewCustomDomainResolver(settings)
	require.NoError(t, err)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(middleware.CustomDomainContextWithResolver(resolver, true))
	router.POST("/api/oauth/state", GenerateOAuthCode)

	request := httptest.NewRequest(http.MethodPost, "https://"+host+"/api/oauth/state", strings.NewReader("{\"provider\":\"auth-flow-test\",\"intent\":\"login\"}"))
	request.Host = host
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	require.Equal(t, http.StatusOK, response.Code)

	var body struct {
		Data struct {
			FlowToken string `json:"flow_token"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
	flow, err := model.GetAuthFlow(body.Data.FlowToken, model.AuthFlowMatch{Purpose: model.AuthFlowPurposeOAuth, Provider: "auth-flow-test"})
	require.NoError(t, err)
	var payload oauthFlowPayload
	require.NoError(t, common.UnmarshalJsonStr(flow.Payload, &payload))
	assert.Zero(t, payload.DomainID)
	assert.Equal(t, host, payload.OriginHost)
	assert.NotEmpty(t, payload.BrowserBindingHash)
	assert.Contains(t, response.Header().Get("Set-Cookie"), domainOAuthBindingCookieName+"=")
}

func TestEnsureDomainOAuthBrowserBindingRenewsAnExistingCookie(t *testing.T) {
	gin.SetMode(gin.TestMode)
	const binding = "existing-browser-binding-with-at-least-thirty-two-characters"
	router := gin.New()
	router.GET("/binding", func(c *gin.Context) {
		hash, err := ensureDomainOAuthBrowserBinding(c)
		require.NoError(t, err)
		assert.Equal(t, domainOAuthBindingHash(binding), hash)
		c.Status(http.StatusNoContent)
	})

	request := httptest.NewRequest(http.MethodGet, "https://alpha.yeschoy.io/binding", nil)
	request.AddCookie(&http.Cookie{Name: domainOAuthBindingCookieName, Value: binding})
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	require.Equal(t, http.StatusNoContent, response.Code)

	var renewed *http.Cookie
	for _, cookie := range response.Result().Cookies() {
		if cookie.Name == domainOAuthBindingCookieName {
			renewed = cookie
			break
		}
	}
	require.NotNil(t, renewed)
	assert.Equal(t, binding, renewed.Value)
	assert.Equal(t, domainOAuthBindingCookieMaxAge, renewed.MaxAge)
	assert.True(t, renewed.Secure)
	assert.True(t, renewed.HttpOnly)
	assert.Equal(t, http.SameSiteStrictMode, renewed.SameSite)
}

func TestFindOrCreateOAuthUserPersistsCustomDomainDefaultInviter(t *testing.T) {
	setupAuthFlowControllerTest(t)
	require.NoError(t, model.DB.AutoMigrate(&model.User{}, &model.CustomDomain{}))
	previousRegisterEnabled := common.RegisterEnabled
	previousRedisEnabled := common.RedisEnabled
	common.RegisterEnabled = true
	common.RedisEnabled = false
	t.Cleanup(func() {
		common.RegisterEnabled = previousRegisterEnabled
		common.RedisEnabled = previousRedisEnabled
	})

	owner := model.User{Username: "oauth-create-owner", AffCode: "oauth-create-owner-aff", Status: common.UserStatusEnabled}
	explicit := model.User{Username: "oauth-create-explicit", AffCode: "oauth-create-explicit-aff", Status: common.UserStatusDisabled}
	require.NoError(t, model.DB.Create(&owner).Error)
	require.NoError(t, model.DB.Create(&explicit).Error)
	domain, err := model.CreateCustomDomain("alpha", owner.Id)
	require.NoError(t, err)
	domain, err = model.EnableCustomDomain(domain.Label)
	require.NoError(t, err)

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	provider := &authFlowTestOAuthProvider{}
	for _, test := range []struct {
		username        string
		affCode         string
		expectedInviter int
	}{
		{username: "oauth-domain-default", expectedInviter: owner.Id},
		{username: "oauth-domain-invalid", affCode: "missing-aff", expectedInviter: 0},
		{username: "oauth-domain-explicit", affCode: explicit.AffCode, expectedInviter: explicit.Id},
	} {
		t.Run(test.username, func(t *testing.T) {
			created, err := findOrCreateOAuthUser(ctx, provider, &oauth.OAuthUser{
				ProviderUserID: "external-" + test.username,
				Username:       test.username,
			}, test.affCode, domain.Id)
			require.NoError(t, err)
			assert.Equal(t, test.expectedInviter, created.InviterId)

			var stored model.User
			require.NoError(t, model.DB.First(&stored, created.Id).Error)
			assert.Equal(t, test.expectedInviter, stored.InviterId)
		})
	}
}

func TestHandleOAuthReturnsDomainHandoffInsteadOfCreatingAMainSession(t *testing.T) {
	setupAuthFlowControllerTest(t)
	previousLogDB := model.LOG_DB
	require.NoError(t, model.DB.AutoMigrate(&model.User{}, &model.UserSession{}, &model.CustomDomain{}, &model.Log{}))
	model.LOG_DB = model.DB
	previousRegisterEnabled := common.RegisterEnabled
	previousRedisEnabled := common.RedisEnabled
	common.RegisterEnabled = true
	common.RedisEnabled = false
	t.Cleanup(func() {
		model.LOG_DB = previousLogDB
		common.RegisterEnabled = previousRegisterEnabled
		common.RedisEnabled = previousRedisEnabled
	})

	owner := model.User{Username: "oauth-handoff-owner", AffCode: "oauth-handoff-aff", Status: common.UserStatusEnabled}
	require.NoError(t, model.DB.Create(&owner).Error)
	domain, err := model.CreateCustomDomain("alpha", owner.Id)
	require.NoError(t, err)
	domain, err = model.EnableCustomDomain(domain.Label)
	require.NoError(t, err)
	payloadBytes, err := common.Marshal(oauthFlowPayload{
		DomainID:           domain.Id,
		OriginHost:         "alpha.yeschoy.io",
		BrowserBindingHash: domainOAuthBindingHash("browser-binding"),
	})
	require.NoError(t, err)
	state, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose:   model.AuthFlowPurposeOAuth,
		Provider:  "auth-flow-test",
		Intent:    model.AuthFlowIntentLogin,
		Payload:   string(payloadBytes),
		ExpiresAt: time.Now().Add(time.Minute),
	})
	require.NoError(t, err)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/api/oauth/:provider", HandleOAuth)
	request := httptest.NewRequest(http.MethodGet, "/api/oauth/auth-flow-test?code=provider-code&state="+state, nil)
	request.Host = "yeschoy.com"
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	require.Equal(t, http.StatusOK, response.Code)

	var body struct {
		Success bool `json:"success"`
		Data    struct {
			Action       string `json:"action"`
			Ticket       string `json:"ticket"`
			TargetOrigin string `json:"target_origin"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
	assert.True(t, body.Success)
	assert.Equal(t, "domain_login_handoff", body.Data.Action)
	assert.NotEmpty(t, body.Data.Ticket)
	assert.Equal(t, "https://alpha.yeschoy.io", body.Data.TargetOrigin)
	assert.Empty(t, response.Header().Get("Set-Cookie"))

	var sessionCount int64
	require.NoError(t, model.DB.Model(&model.UserSession{}).Count(&sessionCount).Error)
	assert.Zero(t, sessionCount)
}

func TestHandleOAuthAcceptsOnlyTheConfiguredCallbackMainHost(t *testing.T) {
	setupAuthFlowControllerTest(t)
	require.NoError(t, appI18n.Init())
	previousEnabled := common.CustomDomainEnabled
	common.CustomDomainEnabled = true
	t.Cleanup(func() {
		common.CustomDomainEnabled = previousEnabled
	})
	settings, err := common.ParseCustomDomainSettingsWithMainOrigins(
		"true",
		"yeschoy.io",
		"https://yeschoy.com",
		"https://yeschoy.com,https://yeschoy.pro,https://*.yeschoy.com",
		"5",
		"",
	)
	require.NoError(t, err)
	resolver, err := service.NewCustomDomainResolver(settings)
	require.NoError(t, err)
	router := gin.New()
	router.Use(middleware.CustomDomainContextWithResolver(resolver, true))
	router.GET("/api/oauth/:provider", HandleOAuth)

	request := httptest.NewRequest(http.MethodGet, "https://yeschoy.pro/api/oauth/auth-flow-test?state=missing", nil)
	request.Host = "yeschoy.pro"
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	assert.Equal(t, http.StatusNotFound, response.Code)

	request = httptest.NewRequest(http.MethodGet, "https://api.yeschoy.com/api/oauth/auth-flow-test?state=missing", nil)
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	assert.Equal(t, http.StatusNotFound, response.Code)

	request = httptest.NewRequest(http.MethodGet, "https://yeschoy.com/api/oauth/auth-flow-test?state=missing", nil)
	request.Host = "yeschoy.com"
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	assert.Equal(t, http.StatusForbidden, response.Code)
}

func TestHandleOAuthReturnsToAnyConfiguredPeerMainOrigin(t *testing.T) {
	setupAuthFlowControllerTest(t)
	previousLogDB := model.LOG_DB
	previousRegisterEnabled := common.RegisterEnabled
	previousRedisEnabled := common.RedisEnabled
	previousEnabled := common.CustomDomainEnabled
	previousMainOrigin := common.CustomDomainMainOrigin
	previousMainOrigins := common.CustomDomainMainOrigins
	require.NoError(t, model.DB.AutoMigrate(&model.User{}, &model.UserSession{}, &model.Log{}))
	model.LOG_DB = model.DB
	common.RegisterEnabled = true
	common.RedisEnabled = false
	common.CustomDomainEnabled = true
	common.CustomDomainMainOrigin = "https://yeschoy.com"
	common.CustomDomainMainOrigins = []string{"https://yeschoy.com", "https://yeschoy.pro", "https://future.example", "https://*.yeschoy.com"}
	t.Cleanup(func() {
		model.LOG_DB = previousLogDB
		common.RegisterEnabled = previousRegisterEnabled
		common.RedisEnabled = previousRedisEnabled
		common.CustomDomainEnabled = previousEnabled
		common.CustomDomainMainOrigin = previousMainOrigin
		common.CustomDomainMainOrigins = previousMainOrigins
	})

	settings, err := common.ParseCustomDomainSettingsWithMainOrigins(
		"true",
		"yeschoy.io",
		"https://yeschoy.com",
		"https://yeschoy.com,https://yeschoy.pro,https://future.example,https://*.yeschoy.com",
		"5",
		"",
	)
	require.NoError(t, err)
	resolver, err := service.NewCustomDomainResolver(settings)
	require.NoError(t, err)
	router := gin.New()
	router.Use(middleware.CustomDomainContextWithResolver(resolver, true))
	router.GET("/api/oauth/:provider", HandleOAuth)

	for _, host := range []string{"yeschoy.pro", "future.example", "api.yeschoy.com"} {
		t.Run(host, func(t *testing.T) {
			payloadBytes, err := common.Marshal(oauthFlowPayload{
				OriginHost:         host,
				BrowserBindingHash: domainOAuthBindingHash("browser-binding-" + host),
			})
			require.NoError(t, err)
			state, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
				Purpose:   model.AuthFlowPurposeOAuth,
				Provider:  "auth-flow-test",
				Intent:    model.AuthFlowIntentLogin,
				Payload:   string(payloadBytes),
				ExpiresAt: time.Now().Add(time.Minute),
			})
			require.NoError(t, err)

			request := httptest.NewRequest(http.MethodGet, "/api/oauth/auth-flow-test?code=provider-code&state="+state, nil)
			request.Host = "yeschoy.com"
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			require.Equal(t, http.StatusOK, response.Code)

			var body struct {
				Data struct {
					Action       string `json:"action"`
					TargetOrigin string `json:"target_origin"`
				} `json:"data"`
			}
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
			assert.Equal(t, "domain_login_handoff", body.Data.Action)
			assert.Equal(t, "https://"+host, body.Data.TargetOrigin)
			assert.Empty(t, response.Header().Get("Set-Cookie"))
		})
	}
}

func TestHandleOAuthProviderFailuresReturnToPeerMainOrigin(t *testing.T) {
	for _, host := range []string{"yeschoy.pro", "api.yeschoy.com"} {
		t.Run(host, func(t *testing.T) { testHandleOAuthProviderFailuresReturnToPeerMainOrigin(t, host) })
	}
}

func testHandleOAuthProviderFailuresReturnToPeerMainOrigin(t *testing.T, host string) {
	t.Helper()
	provider := setupAuthFlowControllerTest(t)
	require.NoError(t, appI18n.Init())
	previousEnabled := common.CustomDomainEnabled
	previousMainOrigin := common.CustomDomainMainOrigin
	previousMainOrigins := common.CustomDomainMainOrigins
	common.CustomDomainEnabled = true
	common.CustomDomainMainOrigin = "https://yeschoy.com"
	common.CustomDomainMainOrigins = []string{"https://yeschoy.com", "https://yeschoy.pro", "https://*.yeschoy.com"}
	t.Cleanup(func() {
		common.CustomDomainEnabled = previousEnabled
		common.CustomDomainMainOrigin = previousMainOrigin
		common.CustomDomainMainOrigins = previousMainOrigins
	})

	settings, err := common.ParseCustomDomainSettingsWithMainOrigins(
		"true",
		"yeschoy.io",
		"https://yeschoy.com",
		"https://yeschoy.com,https://yeschoy.pro,https://*.yeschoy.com",
		"5",
		"",
	)
	require.NoError(t, err)
	resolver, err := service.NewCustomDomainResolver(settings)
	require.NoError(t, err)
	router := gin.New()
	router.Use(middleware.CustomDomainContextWithResolver(resolver, true))
	router.GET("/api/oauth/:provider", HandleOAuth)

	for _, test := range []struct {
		name        string
		exchangeErr error
		userInfoErr error
	}{
		{name: "token exchange failure", exchangeErr: errors.New("exchange failed")},
		{name: "user info failure", userInfoErr: errors.New("user info failed")},
	} {
		t.Run(test.name, func(t *testing.T) {
			provider.exchangeErr = test.exchangeErr
			provider.userInfoErr = test.userInfoErr
			payloadBytes, err := common.Marshal(oauthFlowPayload{
				OriginHost:         host,
				BrowserBindingHash: domainOAuthBindingHash("peer-main-provider-failure-binding"),
			})
			require.NoError(t, err)
			state, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
				Purpose: model.AuthFlowPurposeOAuth, Provider: "auth-flow-test", Intent: model.AuthFlowIntentLogin,
				Payload: string(payloadBytes), ExpiresAt: time.Now().Add(time.Minute),
			})
			require.NoError(t, err)

			request := httptest.NewRequest(http.MethodGet, "/api/oauth/auth-flow-test?code=provider-code&state="+state, nil)
			request.Host = "yeschoy.com"
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			require.Equal(t, http.StatusOK, response.Code)

			var body struct {
				Success bool `json:"success"`
				Data    struct {
					Action       string `json:"action"`
					TargetOrigin string `json:"target_origin"`
				} `json:"data"`
			}
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
			assert.False(t, body.Success)
			assert.Equal(t, "domain_oauth_return", body.Data.Action)
			assert.Equal(t, "https://"+host, body.Data.TargetOrigin)
			_, err = model.GetAuthFlow(state, model.AuthFlowMatch{
				Purpose: model.AuthFlowPurposeOAuth, Provider: "auth-flow-test", Intent: model.AuthFlowIntentLogin,
			})
			assert.NoError(t, err)
		})
	}
}

func TestHandleOAuthApplicationFailuresReturnToPeerMainOrigin(t *testing.T) {
	for _, host := range []string{"yeschoy.pro", "api.yeschoy.com"} {
		t.Run(host, func(t *testing.T) { testHandleOAuthApplicationFailuresReturnToPeerMainOrigin(t, host) })
	}
}

func testHandleOAuthApplicationFailuresReturnToPeerMainOrigin(t *testing.T, host string) {
	t.Helper()
	provider := setupAuthFlowControllerTest(t)
	require.NoError(t, appI18n.Init())
	previousEnabled := common.CustomDomainEnabled
	previousMainOrigin := common.CustomDomainMainOrigin
	previousMainOrigins := common.CustomDomainMainOrigins
	previousRegisterEnabled := common.RegisterEnabled
	common.CustomDomainEnabled = true
	common.CustomDomainMainOrigin = "https://yeschoy.com"
	common.CustomDomainMainOrigins = []string{"https://yeschoy.com", "https://yeschoy.pro", "https://*.yeschoy.com"}
	t.Cleanup(func() {
		common.CustomDomainEnabled = previousEnabled
		common.CustomDomainMainOrigin = previousMainOrigin
		common.CustomDomainMainOrigins = previousMainOrigins
		common.RegisterEnabled = previousRegisterEnabled
	})

	settings, err := common.ParseCustomDomainSettingsWithMainOrigins(
		"true",
		"yeschoy.io",
		"https://yeschoy.com",
		"https://yeschoy.com,https://yeschoy.pro,https://*.yeschoy.com",
		"5",
		"",
	)
	require.NoError(t, err)
	resolver, err := service.NewCustomDomainResolver(settings)
	require.NoError(t, err)
	router := gin.New()
	router.Use(middleware.CustomDomainContextWithResolver(resolver, true))
	router.GET("/api/oauth/:provider", HandleOAuth)

	for _, test := range []struct {
		name             string
		providerDisabled bool
		registerEnabled  bool
	}{
		{name: "provider disabled", providerDisabled: true, registerEnabled: true},
		{name: "registration disabled", registerEnabled: false},
	} {
		t.Run(test.name, func(t *testing.T) {
			provider.disabled = test.providerDisabled
			provider.exchangeErr = nil
			provider.userInfoErr = nil
			provider.userIDTaken = false
			common.RegisterEnabled = test.registerEnabled
			payloadBytes, err := common.Marshal(oauthFlowPayload{
				OriginHost:         host,
				BrowserBindingHash: domainOAuthBindingHash("peer-main-application-failure-binding"),
			})
			require.NoError(t, err)
			state, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
				Purpose: model.AuthFlowPurposeOAuth, Provider: "auth-flow-test", Intent: model.AuthFlowIntentLogin,
				Payload: string(payloadBytes), ExpiresAt: time.Now().Add(time.Minute),
			})
			require.NoError(t, err)

			request := httptest.NewRequest(http.MethodGet, "/api/oauth/auth-flow-test?code=provider-code&state="+state, nil)
			request.Host = "yeschoy.com"
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			require.Equal(t, http.StatusOK, response.Code)

			var body struct {
				Success bool `json:"success"`
				Data    struct {
					Action       string `json:"action"`
					TargetOrigin string `json:"target_origin"`
				} `json:"data"`
			}
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
			assert.False(t, body.Success)
			assert.Equal(t, "domain_oauth_return", body.Data.Action)
			assert.Equal(t, "https://"+host, body.Data.TargetOrigin)
		})
	}
}

func TestHandleOAuthBindProviderFailuresReturnToPeerMainOpener(t *testing.T) {
	for _, host := range []string{"yeschoy.pro", "api.yeschoy.com"} {
		t.Run(host, func(t *testing.T) { testHandleOAuthBindProviderFailuresReturnToPeerMainOpener(t, host) })
	}
}

func testHandleOAuthBindProviderFailuresReturnToPeerMainOpener(t *testing.T, host string) {
	t.Helper()
	provider := setupAuthFlowControllerTest(t)
	require.NoError(t, appI18n.Init())
	require.NoError(t, model.DB.AutoMigrate(&model.User{}, &model.UserSession{}))
	previousRedisEnabled := common.RedisEnabled
	previousEnabled := common.CustomDomainEnabled
	previousMainOrigin := common.CustomDomainMainOrigin
	previousMainOrigins := common.CustomDomainMainOrigins
	common.RedisEnabled = false
	common.CustomDomainEnabled = true
	common.CustomDomainMainOrigin = "https://yeschoy.com"
	common.CustomDomainMainOrigins = []string{"https://yeschoy.com", "https://yeschoy.pro", "https://*.yeschoy.com"}
	t.Cleanup(func() {
		common.RedisEnabled = previousRedisEnabled
		common.CustomDomainEnabled = previousEnabled
		common.CustomDomainMainOrigin = previousMainOrigin
		common.CustomDomainMainOrigins = previousMainOrigins
	})

	user := model.User{Username: "peer-main-provider-failure-bind-user", Status: common.UserStatusEnabled, AuthVersion: 1}
	require.NoError(t, model.DB.Create(&user).Error)
	require.NoError(t, model.DB.Create(&model.UserSession{
		SID: "peer-main-provider-failure-session", UserID: user.Id, Version: 1, UserAuthVersion: user.AuthVersion,
		Status: model.UserSessionStatusActive, RefreshHash: "peer-main-provider-failure-refresh", LoginMethod: "password",
		CreatedAt: time.Now().Unix(), LastActiveAt: time.Now().Unix(), ExpiresAt: time.Now().Add(time.Hour).Unix(),
	}).Error)
	settings, err := common.ParseCustomDomainSettingsWithMainOrigins(
		"true",
		"yeschoy.io",
		"https://yeschoy.com",
		"https://yeschoy.com,https://yeschoy.pro,https://*.yeschoy.com",
		"5",
		"",
	)
	require.NoError(t, err)
	resolver, err := service.NewCustomDomainResolver(settings)
	require.NoError(t, err)
	router := gin.New()
	router.Use(middleware.CustomDomainContextWithResolver(resolver, true))
	router.GET("/api/oauth/:provider", HandleOAuth)

	for _, test := range []struct {
		name        string
		exchangeErr error
		userIDTaken bool
	}{
		{name: "token exchange failure", exchangeErr: errors.New("exchange failed")},
		{name: "provider identity already bound", userIDTaken: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			provider.exchangeErr = test.exchangeErr
			provider.userInfoErr = nil
			provider.userIDTaken = test.userIDTaken
			payloadBytes, err := common.Marshal(oauthFlowPayload{
				OriginHost:             host,
				BrowserBindingHash:     domainOAuthBindingHash("peer-main-provider-failure-bind-binding"),
				ExpectedAuthVersion:    user.AuthVersion,
				ExpectedSessionVersion: 1,
			})
			require.NoError(t, err)
			state, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
				Purpose:   model.AuthFlowPurposeOAuth,
				Provider:  "auth-flow-test",
				Intent:    model.AuthFlowIntentBind,
				UserId:    user.Id,
				SessionId: "peer-main-provider-failure-session",
				Payload:   string(payloadBytes),
				ExpiresAt: time.Now().Add(time.Minute),
			})
			require.NoError(t, err)

			request := httptest.NewRequest(http.MethodGet, "/api/oauth/auth-flow-test?code=provider-code&state="+state, nil)
			request.Host = "yeschoy.com"
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			require.Equal(t, http.StatusOK, response.Code)

			var body struct {
				Success bool `json:"success"`
				Data    struct {
					Action       string `json:"action"`
					TargetOrigin string `json:"target_origin"`
					Provider     string `json:"provider"`
					Result       string `json:"result"`
				} `json:"data"`
			}
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
			assert.False(t, body.Success)
			assert.Equal(t, "domain_bind_return", body.Data.Action)
			assert.Equal(t, "https://"+host, body.Data.TargetOrigin)
			assert.Equal(t, "auth-flow-test", body.Data.Provider)
			assert.Equal(t, "failed", body.Data.Result)
			_, err = model.GetAuthFlow(state, model.AuthFlowMatch{
				Purpose: model.AuthFlowPurposeOAuth, Provider: "auth-flow-test", Intent: model.AuthFlowIntentBind,
				UserId: user.Id, SessionId: "peer-main-provider-failure-session",
			})
			assert.NoError(t, err)
		})
	}
}

func TestDomainLoginHandoffConsumesTheBoundTicketOnceAndWritesOnlyACustomHostCookie(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previousDB := model.DB
	previousLogDB := model.LOG_DB
	previousDatabaseType := common.MainDatabaseType()
	previousRedisEnabled := common.RedisEnabled
	previousSecure := common.SessionCookieSecure
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.UserSession{}, &model.AuthFlow{}, &model.CustomDomain{}, &model.Log{}))
	model.DB = db
	model.LOG_DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	common.SessionCookieSecure = true
	t.Cleanup(func() {
		model.DB = previousDB
		model.LOG_DB = previousLogDB
		common.SetMainDatabaseType(previousDatabaseType)
		common.RedisEnabled = previousRedisEnabled
		common.SessionCookieSecure = previousSecure
	})

	owner := model.User{Username: "handoff-consume-owner", AffCode: "handoff-consume-owner-aff", Status: common.UserStatusEnabled}
	user := model.User{Username: "handoff-consume-user", AffCode: "handoff-consume-user-aff", Status: common.UserStatusEnabled, AuthVersion: 1}
	require.NoError(t, db.Create(&owner).Error)
	require.NoError(t, db.Create(&user).Error)
	domain, err := model.CreateCustomDomain("alpha", owner.Id)
	require.NoError(t, err)
	domain, err = model.EnableCustomDomain(domain.Label)
	require.NoError(t, err)
	binding := "browser-binding-value-with-at-least-thirty-two-characters"
	payloadBytes, err := common.Marshal(domainLoginHandoffPayload{
		DomainID:            domain.Id,
		TargetHost:          "alpha.yeschoy.io",
		BrowserBindingHash:  domainOAuthBindingHash(binding),
		ExpectedAuthVersion: user.AuthVersion,
		LoginMethod:         "oauth:github",
	})
	require.NoError(t, err)
	ticket, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose:   model.AuthFlowPurposeDomainLoginHandoff,
		Provider:  "github",
		UserId:    user.Id,
		Payload:   string(payloadBytes),
		ExpiresAt: time.Now().Add(time.Minute),
	})
	require.NoError(t, err)

	settings, err := common.ParseCustomDomainSettings("true", "yeschoy.io", "https://yeschoy.com", "5", "")
	require.NoError(t, err)
	resolver, err := service.NewCustomDomainResolver(settings)
	require.NoError(t, err)
	router := gin.New()
	router.Use(middleware.CustomDomainContextWithResolver(resolver, true))
	router.POST("/api/oauth/domain-handoff", ConsumeDomainLoginHandoff)

	requestHandoff := func(ticket, bindingValue string) *httptest.ResponseRecorder {
		request := httptest.NewRequest(http.MethodPost, "https://alpha.yeschoy.io/api/oauth/domain-handoff", strings.NewReader(`{"ticket":"`+ticket+`"}`))
		request.Host = "alpha.yeschoy.io"
		request.Header.Set("Content-Type", "application/json")
		request.AddCookie(&http.Cookie{Name: domainOAuthBindingCookieName, Value: bindingValue})
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
		return response
	}

	response := requestHandoff(ticket, "different-browser-binding-value-with-at-least-thirty-two-characters")
	require.Equal(t, http.StatusForbidden, response.Code)
	_, err = model.GetAuthFlow(ticket, model.AuthFlowMatch{Purpose: model.AuthFlowPurposeDomainLoginHandoff})
	require.NoError(t, err)

	response = requestHandoff(ticket, binding)
	require.Equal(t, http.StatusOK, response.Code)
	assert.Contains(t, response.Header().Get("Set-Cookie"), service.RefreshCookieName+"=")
	assert.NotContains(t, response.Header().Get("Set-Cookie"), "Domain=")
	assert.Contains(t, response.Header().Get("Set-Cookie"), "Path=/api/user/auth")

	var sessionCount int64
	require.NoError(t, db.Model(&model.UserSession{}).Count(&sessionCount).Error)
	assert.EqualValues(t, 1, sessionCount)
	var loginLog model.Log
	require.NoError(t, db.Where("user_id = ? AND type = ?", user.Id, model.LogTypeLogin).First(&loginLog).Error)
	assert.Equal(t, user.Username, loginLog.Username)
	assert.Contains(t, loginLog.Other, `"login_method":"oauth:github"`)
	response = requestHandoff(ticket, binding)
	assert.Equal(t, http.StatusForbidden, response.Code)
	require.NoError(t, db.Model(&model.UserSession{}).Count(&sessionCount).Error)
	assert.EqualValues(t, 1, sessionCount)
	var loginLogCount int64
	require.NoError(t, db.Model(&model.Log{}).Where("user_id = ? AND type = ?", user.Id, model.LogTypeLogin).Count(&loginLogCount).Error)
	assert.EqualValues(t, 1, loginLogCount)
}

func TestDomainLoginHandoffCreatesAnIndependentSessionOnAPeerMainHost(t *testing.T) {
	for _, host := range []string{"yeschoy.pro", "api.yeschoy.com"} {
		t.Run(host, func(t *testing.T) { testDomainLoginHandoffCreatesAnIndependentSessionOnAPeerMainHost(t, host) })
	}
}

func testDomainLoginHandoffCreatesAnIndependentSessionOnAPeerMainHost(t *testing.T, host string) {
	t.Helper()
	setupAuthFlowControllerTest(t)
	previousLogDB := model.LOG_DB
	previousRedisEnabled := common.RedisEnabled
	previousSecure := common.SessionCookieSecure
	previousCustomDomainEnabled := common.CustomDomainEnabled
	previousMainOrigin := common.CustomDomainMainOrigin
	previousMainOrigins := common.CustomDomainMainOrigins
	require.NoError(t, model.DB.AutoMigrate(&model.User{}, &model.UserSession{}, &model.CustomDomain{}, &model.Log{}))
	model.LOG_DB = model.DB
	common.RedisEnabled = false
	common.SessionCookieSecure = true
	common.CustomDomainEnabled = true
	common.CustomDomainMainOrigin = "https://yeschoy.com"
	common.CustomDomainMainOrigins = []string{"https://yeschoy.com", "https://yeschoy.pro", "https://future.example", "https://*.yeschoy.com"}
	t.Cleanup(func() {
		model.LOG_DB = previousLogDB
		common.RedisEnabled = previousRedisEnabled
		common.SessionCookieSecure = previousSecure
		common.CustomDomainEnabled = previousCustomDomainEnabled
		common.CustomDomainMainOrigin = previousMainOrigin
		common.CustomDomainMainOrigins = previousMainOrigins
	})

	user := model.User{Username: "peer-main-handoff-user", Status: common.UserStatusEnabled, AuthVersion: 1}
	require.NoError(t, model.DB.Create(&user).Error)
	binding := "peer-main-binding-value-with-at-least-thirty-two-characters"
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	issued, err := issueDomainLoginHandoff(context, user.Id, "github", oauthFlowPayload{
		OriginHost:         host,
		BrowserBindingHash: domainOAuthBindingHash(binding),
	})
	require.NoError(t, err)
	require.True(t, issued)

	var body struct {
		Data struct {
			Ticket       string `json:"ticket"`
			TargetOrigin string `json:"target_origin"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &body))
	assert.Equal(t, "https://"+host, body.Data.TargetOrigin)
	require.NotEmpty(t, body.Data.Ticket)

	settings, err := common.ParseCustomDomainSettingsWithMainOrigins(
		"true",
		"yeschoy.io",
		"https://yeschoy.com",
		"https://yeschoy.com,https://yeschoy.pro,https://future.example,https://*.yeschoy.com",
		"5",
		"",
	)
	require.NoError(t, err)
	resolver, err := service.NewCustomDomainResolver(settings)
	require.NoError(t, err)
	router := gin.New()
	router.Use(middleware.CustomDomainContextWithResolver(resolver, true))
	router.POST("/api/oauth/domain-handoff", ConsumeDomainLoginHandoff)

	requestBody := fmt.Sprintf("{\"ticket\":%q}", body.Data.Ticket)
	for _, attempt := range []struct {
		name    string
		host    string
		binding string
		removed bool
		status  int
	}{
		{name: "wrong host", host: "www.yeschoy.com", binding: binding, status: 403},
		{name: "wrong browser", host: host, binding: "wrong-browser", status: 403},
		{name: "removed rule with stale middleware", host: host, binding: binding, removed: true, status: 403},
		{name: "valid", host: host, binding: binding, status: 200},
		{name: "replay", host: host, binding: binding, status: 403},
	} {
		origins := common.CustomDomainMainOrigins
		if attempt.removed {
			common.CustomDomainMainOrigins = []string{common.CustomDomainMainOrigin}
		}
		request := httptest.NewRequest(http.MethodPost, "https://"+attempt.host+"/api/oauth/domain-handoff", strings.NewReader(requestBody))
		request.Header.Set("Content-Type", "application/json")
		request.AddCookie(&http.Cookie{Name: domainOAuthBindingCookieName, Value: attempt.binding})
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
		common.CustomDomainMainOrigins = origins
		require.Equal(t, attempt.status, response.Code, attempt.name)
		if attempt.status != 200 {
			assert.Empty(t, response.Header().Get("Set-Cookie"), attempt.name)
			continue
		}
		require.NotEmpty(t, response.Result().Cookies())
		for _, cookie := range response.Result().Cookies() {
			assert.Empty(t, cookie.Domain)
			assert.Equal(t, service.RefreshCookieName, cookie.Name)
			assert.True(t, cookie.Secure)
			assert.True(t, cookie.HttpOnly)
		}
	}

	var sessionCount int64
	require.NoError(t, model.DB.Model(&model.UserSession{}).Count(&sessionCount).Error)
	assert.EqualValues(t, 1, sessionCount)
}

func TestHandleOAuthProviderErrorConsumesStateAndReturnsTheTrustedCustomOrigin(t *testing.T) {
	setupAuthFlowControllerTest(t)
	require.NoError(t, model.DB.AutoMigrate(&model.User{}, &model.CustomDomain{}))
	owner := model.User{Username: "oauth-error-owner", AffCode: "oauth-error-owner-aff", Status: common.UserStatusEnabled}
	require.NoError(t, model.DB.Create(&owner).Error)
	domain, err := model.CreateCustomDomain("alpha", owner.Id)
	require.NoError(t, err)
	domain, err = model.EnableCustomDomain(domain.Label)
	require.NoError(t, err)
	payloadBytes, err := common.Marshal(oauthFlowPayload{
		DomainID:           domain.Id,
		OriginHost:         "alpha.yeschoy.io",
		BrowserBindingHash: domainOAuthBindingHash("browser-binding"),
	})
	require.NoError(t, err)
	state, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose:   model.AuthFlowPurposeOAuth,
		Provider:  "auth-flow-test",
		Intent:    model.AuthFlowIntentLogin,
		Payload:   string(payloadBytes),
		ExpiresAt: time.Now().Add(time.Minute),
	})
	require.NoError(t, err)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/api/oauth/:provider", HandleOAuth)
	request := httptest.NewRequest(http.MethodGet, "/api/oauth/auth-flow-test?error=access_denied&state="+state, nil)
	request.Host = "yeschoy.com"
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	require.Equal(t, http.StatusOK, response.Code)

	var body struct {
		Success bool `json:"success"`
		Data    struct {
			Action       string `json:"action"`
			TargetOrigin string `json:"target_origin"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
	assert.False(t, body.Success)
	assert.Equal(t, "domain_oauth_return", body.Data.Action)
	assert.Equal(t, "https://alpha.yeschoy.io", body.Data.TargetOrigin)
	_, err = model.GetAuthFlow(state, model.AuthFlowMatch{Purpose: model.AuthFlowPurposeOAuth})
	assert.ErrorIs(t, err, model.ErrAuthFlowConsumed)
}

func TestHandleOAuthBindProviderErrorConsumesStateAndReturnsToTheCustomOpener(t *testing.T) {
	provider := setupAuthFlowControllerTest(t)
	require.NoError(t, appI18n.Init())
	require.NoError(t, model.DB.AutoMigrate(&model.User{}, &model.UserSession{}, &model.CustomDomain{}))
	previousRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = previousRedisEnabled })

	owner := model.User{Username: "oauth-bind-error-owner", AffCode: "oauth-bind-error-owner-aff", Status: common.UserStatusEnabled}
	user := model.User{Username: "oauth-bind-error-user", AffCode: "oauth-bind-error-user-aff", Status: common.UserStatusEnabled, AuthVersion: 1}
	require.NoError(t, model.DB.Create(&owner).Error)
	require.NoError(t, model.DB.Create(&user).Error)
	require.NoError(t, model.DB.Create(&model.UserSession{
		SID: "bind-error-session", UserID: user.Id, Version: 1, UserAuthVersion: user.AuthVersion,
		Status: model.UserSessionStatusActive, RefreshHash: "bind-error-refresh", LoginMethod: "password",
		CreatedAt: time.Now().Unix(), LastActiveAt: time.Now().Unix(), ExpiresAt: time.Now().Add(time.Hour).Unix(),
	}).Error)
	domain, err := model.CreateCustomDomain("alpha", owner.Id)
	require.NoError(t, err)
	domain, err = model.EnableCustomDomain(domain.Label)
	require.NoError(t, err)
	payloadBytes, err := common.Marshal(oauthFlowPayload{
		DomainID: domain.Id, OriginHost: "alpha.yeschoy.io", BrowserBindingHash: domainOAuthBindingHash("browser-binding"),
		ExpectedAuthVersion: user.AuthVersion, ExpectedSessionVersion: 1,
	})
	require.NoError(t, err)
	state, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose: model.AuthFlowPurposeOAuth, Provider: "auth-flow-test", Intent: model.AuthFlowIntentBind,
		UserId: user.Id, SessionId: "bind-error-session", Payload: string(payloadBytes), ExpiresAt: time.Now().Add(time.Minute),
	})
	require.NoError(t, err)

	request := httptest.NewRequest(http.MethodGet, "/api/oauth/auth-flow-test?error=access_denied&state="+state, nil)
	request.Host = "yeschoy.com"
	router := gin.New()
	router.GET("/api/oauth/:provider", HandleOAuth)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	require.Equal(t, http.StatusOK, response.Code)

	var body struct {
		Success bool `json:"success"`
		Data    struct {
			Action       string `json:"action"`
			TargetOrigin string `json:"target_origin"`
			Provider     string `json:"provider"`
			Result       string `json:"result"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
	assert.False(t, body.Success)
	assert.Equal(t, "domain_bind_return", body.Data.Action)
	assert.Equal(t, "https://alpha.yeschoy.io", body.Data.TargetOrigin)
	assert.Equal(t, "auth-flow-test", body.Data.Provider)
	assert.Equal(t, "cancelled", body.Data.Result)
	assert.Zero(t, provider.exchangeCalls)
	_, err = model.GetAuthFlow(state, model.AuthFlowMatch{Purpose: model.AuthFlowPurposeOAuth})
	assert.ErrorIs(t, err, model.ErrAuthFlowConsumed)
}

func TestHandleOAuthBindForDisabledDomainConsumesStateAndReturnsUnavailable(t *testing.T) {
	provider := setupAuthFlowControllerTest(t)
	require.NoError(t, appI18n.Init())
	require.NoError(t, model.DB.AutoMigrate(&model.User{}, &model.UserSession{}, &model.CustomDomain{}))
	previousRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = previousRedisEnabled })

	owner := model.User{Username: "oauth-disabled-bind-owner", AffCode: "oauth-disabled-bind-owner-aff", Status: common.UserStatusEnabled}
	user := model.User{Username: "oauth-disabled-bind-user", AffCode: "oauth-disabled-bind-user-aff", Status: common.UserStatusEnabled, AuthVersion: 1}
	require.NoError(t, model.DB.Create(&owner).Error)
	require.NoError(t, model.DB.Create(&user).Error)
	require.NoError(t, model.DB.Create(&model.UserSession{
		SID: "disabled-bind-session", UserID: user.Id, Version: 1, UserAuthVersion: user.AuthVersion,
		Status: model.UserSessionStatusActive, RefreshHash: "disabled-bind-refresh", LoginMethod: "password",
		CreatedAt: time.Now().Unix(), LastActiveAt: time.Now().Unix(), ExpiresAt: time.Now().Add(time.Hour).Unix(),
	}).Error)
	domain, err := model.CreateCustomDomain("alpha", owner.Id)
	require.NoError(t, err)
	domain, err = model.EnableCustomDomain(domain.Label)
	require.NoError(t, err)
	payloadBytes, err := common.Marshal(oauthFlowPayload{
		DomainID: domain.Id, OriginHost: "alpha.yeschoy.io", BrowserBindingHash: domainOAuthBindingHash("browser-binding"),
		ExpectedAuthVersion: user.AuthVersion, ExpectedSessionVersion: 1,
	})
	require.NoError(t, err)
	state, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose: model.AuthFlowPurposeOAuth, Provider: "auth-flow-test", Intent: model.AuthFlowIntentBind,
		UserId: user.Id, SessionId: "disabled-bind-session", Payload: string(payloadBytes), ExpiresAt: time.Now().Add(time.Minute),
	})
	require.NoError(t, err)
	_, err = model.DisableCustomDomain(domain.Label)
	require.NoError(t, err)

	router := gin.New()
	router.GET("/api/oauth/:provider", HandleOAuth)
	request := httptest.NewRequest(http.MethodGet, "/api/oauth/auth-flow-test?code=unused&state="+state, nil)
	request.Host = "yeschoy.com"
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	require.Equal(t, http.StatusOK, response.Code)

	var body struct {
		Data struct {
			Action       string `json:"action"`
			TargetOrigin string `json:"target_origin"`
			Result       string `json:"result"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
	assert.Equal(t, "domain_bind_return", body.Data.Action)
	assert.Equal(t, "https://alpha.yeschoy.io", body.Data.TargetOrigin)
	assert.Equal(t, "target_unavailable", body.Data.Result)
	assert.Zero(t, provider.exchangeCalls)
	_, err = model.GetAuthFlow(state, model.AuthFlowMatch{Purpose: model.AuthFlowPurposeOAuth})
	assert.ErrorIs(t, err, model.ErrAuthFlowConsumed)
}

func TestHandleOAuthBindWithRevokedSessionConsumesStateAndReturnsFailed(t *testing.T) {
	provider := setupAuthFlowControllerTest(t)
	require.NoError(t, appI18n.Init())
	require.NoError(t, model.DB.AutoMigrate(&model.User{}, &model.UserSession{}, &model.CustomDomain{}))
	previousRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = previousRedisEnabled })

	owner := model.User{Username: "oauth-revoked-bind-owner", AffCode: "oauth-revoked-bind-owner-aff", Status: common.UserStatusEnabled}
	user := model.User{Username: "oauth-revoked-bind-user", AffCode: "oauth-revoked-bind-user-aff", Status: common.UserStatusEnabled, AuthVersion: 1}
	require.NoError(t, model.DB.Create(&owner).Error)
	require.NoError(t, model.DB.Create(&user).Error)
	require.NoError(t, model.DB.Create(&model.UserSession{
		SID: "revoked-bind-session", UserID: user.Id, Version: 1, UserAuthVersion: user.AuthVersion,
		Status: model.UserSessionStatusActive, RefreshHash: "revoked-bind-refresh", LoginMethod: "password",
		CreatedAt: time.Now().Unix(), LastActiveAt: time.Now().Unix(), ExpiresAt: time.Now().Add(time.Hour).Unix(),
	}).Error)
	domain, err := model.CreateCustomDomain("alpha", owner.Id)
	require.NoError(t, err)
	domain, err = model.EnableCustomDomain(domain.Label)
	require.NoError(t, err)
	payloadBytes, err := common.Marshal(oauthFlowPayload{
		DomainID: domain.Id, OriginHost: "alpha.yeschoy.io", BrowserBindingHash: domainOAuthBindingHash("browser-binding"),
		ExpectedAuthVersion: user.AuthVersion, ExpectedSessionVersion: 1,
	})
	require.NoError(t, err)
	state, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose: model.AuthFlowPurposeOAuth, Provider: "auth-flow-test", Intent: model.AuthFlowIntentBind,
		UserId: user.Id, SessionId: "revoked-bind-session", Payload: string(payloadBytes), ExpiresAt: time.Now().Add(time.Minute),
	})
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.UserSession{}).
		Where("sid = ?", "revoked-bind-session").
		Updates(map[string]any{"status": model.UserSessionStatusRevoked, "revoked_at": time.Now().Unix()}).Error)

	router := gin.New()
	router.GET("/api/oauth/:provider", HandleOAuth)
	request := httptest.NewRequest(http.MethodGet, "/api/oauth/auth-flow-test?code=unused&state="+state, nil)
	request.Host = "yeschoy.com"
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	require.Equal(t, http.StatusOK, response.Code)

	var body struct {
		Data struct {
			Action       string `json:"action"`
			TargetOrigin string `json:"target_origin"`
			Result       string `json:"result"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
	assert.Equal(t, "domain_bind_return", body.Data.Action)
	assert.Equal(t, "https://alpha.yeschoy.io", body.Data.TargetOrigin)
	assert.Equal(t, "failed", body.Data.Result)
	assert.Zero(t, provider.exchangeCalls)
	_, err = model.GetAuthFlow(state, model.AuthFlowMatch{Purpose: model.AuthFlowPurposeOAuth})
	assert.ErrorIs(t, err, model.ErrAuthFlowConsumed)
}

func TestHandleOAuthBindOnMainIssuesATicketWithoutChangingTheUserBinding(t *testing.T) {
	setupAuthFlowControllerTest(t)
	require.NoError(t, appI18n.Init())
	previousRedisEnabled := common.RedisEnabled
	t.Cleanup(func() { common.RedisEnabled = previousRedisEnabled })
	require.NoError(t, model.DB.AutoMigrate(&model.User{}, &model.UserSession{}, &model.CustomDomain{}))
	provider := &domainBindTestProvider{}
	oauth.Register("domain-bind-test", provider)
	t.Cleanup(func() { oauth.Unregister("domain-bind-test") })

	owner := model.User{Username: "oauth-bind-owner", AffCode: "oauth-bind-owner-aff", Status: common.UserStatusEnabled}
	user := model.User{Username: "oauth-bind-user", AffCode: "oauth-bind-user-aff", Status: common.UserStatusEnabled, AuthVersion: 1}
	require.NoError(t, model.DB.Create(&owner).Error)
	require.NoError(t, model.DB.Create(&user).Error)
	common.RedisEnabled = false
	require.NoError(t, model.DB.Create(&model.UserSession{
		SID: "session-a", UserID: user.Id, Version: 1, UserAuthVersion: user.AuthVersion,
		Status: model.UserSessionStatusActive, RefreshHash: "refresh-hash", LoginMethod: "password",
		CreatedAt: time.Now().Unix(), LastActiveAt: time.Now().Unix(), ExpiresAt: time.Now().Add(time.Hour).Unix(),
	}).Error)
	accessToken, _, err := service.IssueAccessToken(service.AuthIdentity{
		UserID: user.Id, SessionID: "session-a", UserAuthVersion: user.AuthVersion, SessionVersion: 1,
	})
	require.NoError(t, err)
	domain, err := model.CreateCustomDomain("alpha", owner.Id)
	require.NoError(t, err)
	domain, err = model.EnableCustomDomain(domain.Label)
	require.NoError(t, err)
	payloadBytes, err := common.Marshal(oauthFlowPayload{
		DomainID:               domain.Id,
		OriginHost:             "alpha.yeschoy.io",
		BrowserBindingHash:     domainOAuthBindingHash("browser-binding"),
		ExpectedAuthVersion:    user.AuthVersion,
		ExpectedSessionVersion: 1,
	})
	require.NoError(t, err)
	state, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose:   model.AuthFlowPurposeOAuth,
		Provider:  "domain-bind-test",
		Intent:    model.AuthFlowIntentBind,
		UserId:    user.Id,
		SessionId: "session-a",
		Payload:   string(payloadBytes),
		ExpiresAt: time.Now().Add(time.Minute),
	})
	require.NoError(t, err)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/api/oauth/:provider", middleware.TryUserAuth(), HandleOAuth)
	request := httptest.NewRequest(http.MethodGet, "/api/oauth/domain-bind-test?code=provider-code&state="+state, nil)
	request.Host = "yeschoy.com"
	request.Header.Set("Authorization", "Bearer "+accessToken)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	require.Equal(t, http.StatusOK, response.Code)

	var body struct {
		Success bool `json:"success"`
		Data    struct {
			Action       string `json:"action"`
			Ticket       string `json:"ticket"`
			TargetOrigin string `json:"target_origin"`
			Provider     string `json:"provider"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
	assert.True(t, body.Success)
	assert.Equal(t, "domain_bind_handoff", body.Data.Action)
	assert.NotEmpty(t, body.Data.Ticket)
	assert.Equal(t, "https://alpha.yeschoy.io", body.Data.TargetOrigin)
	assert.Equal(t, "domain-bind-test", body.Data.Provider)

	var unchanged model.User
	require.NoError(t, model.DB.First(&unchanged, user.Id).Error)
	assert.Empty(t, unchanged.GitHubId)
}

func TestHandleOAuthBindDefersAPeerMainMutationBackToTheOriginSession(t *testing.T) {
	for _, host := range []string{"yeschoy.pro", "api.yeschoy.com"} {
		t.Run(host, func(t *testing.T) { testHandleOAuthBindDefersAPeerMainMutationBackToTheOriginSession(t, host) })
	}
}

func testHandleOAuthBindDefersAPeerMainMutationBackToTheOriginSession(t *testing.T, host string) {
	t.Helper()
	setupAuthFlowControllerTest(t)
	require.NoError(t, appI18n.Init())
	require.NoError(t, model.DB.AutoMigrate(&model.User{}, &model.UserSession{}))
	previousRedisEnabled := common.RedisEnabled
	previousCustomDomainEnabled := common.CustomDomainEnabled
	previousMainOrigin := common.CustomDomainMainOrigin
	previousMainOrigins := common.CustomDomainMainOrigins
	common.RedisEnabled = false
	common.CustomDomainEnabled = true
	common.CustomDomainMainOrigin = "https://yeschoy.com"
	common.CustomDomainMainOrigins = []string{"https://yeschoy.com", "https://yeschoy.pro", "https://*.yeschoy.com"}
	t.Cleanup(func() {
		common.RedisEnabled = previousRedisEnabled
		common.CustomDomainEnabled = previousCustomDomainEnabled
		common.CustomDomainMainOrigin = previousMainOrigin
		common.CustomDomainMainOrigins = previousMainOrigins
	})

	provider := &domainBindTestProvider{}
	oauth.Register("peer-main-bind-test", provider)
	t.Cleanup(func() { oauth.Unregister("peer-main-bind-test") })
	user := model.User{Username: "peer-main-bind-user", Status: common.UserStatusEnabled, AuthVersion: 1}
	require.NoError(t, model.DB.Create(&user).Error)
	bundle, err := service.CreateLoginSession(user.Id, "password", "127.0.0.1", "test-agent")
	require.NoError(t, err)
	binding := "peer-main-bind-value-with-at-least-thirty-two-characters"
	payloadBytes, err := common.Marshal(oauthFlowPayload{
		OriginHost:             host,
		BrowserBindingHash:     domainOAuthBindingHash(binding),
		ExpectedAuthVersion:    user.AuthVersion,
		ExpectedSessionVersion: 1,
	})
	require.NoError(t, err)
	state, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose:   model.AuthFlowPurposeOAuth,
		Provider:  "peer-main-bind-test",
		Intent:    model.AuthFlowIntentBind,
		UserId:    user.Id,
		SessionId: bundle.Session.SID,
		Payload:   string(payloadBytes),
		ExpiresAt: time.Now().Add(time.Minute),
	})
	require.NoError(t, err)

	settings, err := common.ParseCustomDomainSettingsWithMainOrigins(
		"true",
		"yeschoy.io",
		"https://yeschoy.com",
		"https://yeschoy.com,https://yeschoy.pro,https://*.yeschoy.com",
		"5",
		"",
	)
	require.NoError(t, err)
	resolver, err := service.NewCustomDomainResolver(settings)
	require.NoError(t, err)
	router := gin.New()
	router.Use(middleware.CustomDomainContextWithResolver(resolver, true))
	router.GET("/api/oauth/:provider", middleware.TryUserAuth(), HandleOAuth)

	request := httptest.NewRequest(http.MethodGet, "/api/oauth/peer-main-bind-test?code=provider-code&state="+state, nil)
	request.Host = "yeschoy.com"
	request.Header.Set("Authorization", "Bearer "+bundle.AccessToken)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	require.Equal(t, http.StatusOK, response.Code)

	var body struct {
		Data struct {
			Action       string `json:"action"`
			Ticket       string `json:"ticket"`
			TargetOrigin string `json:"target_origin"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
	assert.Equal(t, "domain_bind_handoff", body.Data.Action)
	assert.Equal(t, "https://"+host, body.Data.TargetOrigin)
	assert.NotEmpty(t, body.Data.Ticket)

	var unchanged model.User
	require.NoError(t, model.DB.First(&unchanged, user.Id).Error)
	assert.Empty(t, unchanged.GitHubId)

	consumeRouter := gin.New()
	consumeRouter.Use(middleware.CustomDomainContextWithResolver(resolver, true))
	consumeRouter.POST("/api/oauth/domain-bind-handoff", middleware.UserAuth(), ConsumeDomainBindHandoff)
	requestBody := fmt.Sprintf("{\"ticket\":%q}", body.Data.Ticket)
	for _, attempt := range []struct {
		name    string
		host    string
		binding string
		removed bool
		status  int
	}{
		{name: "wrong host", host: "www.yeschoy.com", binding: binding, status: 403},
		{name: "wrong browser", host: host, binding: "wrong-browser", status: 403},
		{name: "removed rule with stale middleware", host: host, binding: binding, removed: true, status: 403},
		{name: "valid", host: host, binding: binding, status: 200},
		{name: "replay", host: host, binding: binding, status: 403},
	} {
		origins := common.CustomDomainMainOrigins
		if attempt.removed {
			common.CustomDomainMainOrigins = []string{common.CustomDomainMainOrigin}
		}
		request = httptest.NewRequest(http.MethodPost, "https://"+attempt.host+"/api/oauth/domain-bind-handoff", strings.NewReader(requestBody))
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("Authorization", "Bearer "+bundle.AccessToken)
		request.AddCookie(&http.Cookie{Name: domainOAuthBindingCookieName, Value: attempt.binding})
		response = httptest.NewRecorder()
		consumeRouter.ServeHTTP(response, request)
		common.CustomDomainMainOrigins = origins
		require.Equal(t, attempt.status, response.Code, attempt.name)
	}

	var updated model.User
	require.NoError(t, model.DB.First(&updated, user.Id).Error)
	assert.Equal(t, "provider-user-id", updated.GitHubId)
}

func TestDomainBindHandoffRequiresTheOriginalSessionAndUpdatesTheBindingOnce(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previousDB := model.DB
	previousDatabaseType := common.MainDatabaseType()
	previousRedisEnabled := common.RedisEnabled
	previousSecret := common.SessionSecret
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.UserSession{}, &model.AuthFlow{}, &model.CustomDomain{}))
	model.DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	common.SessionSecret = "domain-bind-handoff-test-secret"
	t.Cleanup(func() {
		model.DB = previousDB
		common.SetMainDatabaseType(previousDatabaseType)
		common.RedisEnabled = previousRedisEnabled
		common.SessionSecret = previousSecret
	})
	provider := &domainBindTestProvider{}
	oauth.Register("domain-bind-test", provider)
	t.Cleanup(func() { oauth.Unregister("domain-bind-test") })

	owner := model.User{Username: "bind-consume-owner", AffCode: "bind-consume-owner-aff", Status: common.UserStatusEnabled, Role: common.RoleCommonUser, Group: "default", AuthVersion: 1}
	user := model.User{Username: "bind-consume-user", AffCode: "bind-consume-user-aff", Status: common.UserStatusEnabled, Role: common.RoleCommonUser, Group: "default", AuthVersion: 1}
	require.NoError(t, db.Create(&owner).Error)
	require.NoError(t, db.Create(&user).Error)
	domain, err := model.CreateCustomDomain("alpha", owner.Id)
	require.NoError(t, err)
	domain, err = model.EnableCustomDomain(domain.Label)
	require.NoError(t, err)
	bundle, err := service.CreateLoginSession(user.Id, "password", "127.0.0.1", "test-agent")
	require.NoError(t, err)
	binding := "bind-browser-value-with-at-least-thirty-two-characters"
	payloadBytes, err := common.Marshal(domainBindHandoffPayload{
		DomainID:               domain.Id,
		TargetHost:             "alpha.yeschoy.io",
		BrowserBindingHash:     domainOAuthBindingHash(binding),
		ExpectedAuthVersion:    user.AuthVersion,
		ExpectedSessionVersion: 1,
		ProviderUserID:         "provider-user-id",
		ProviderColumn:         "github_id",
	})
	require.NoError(t, err)
	ticket, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose:   model.AuthFlowPurposeDomainBindHandoff,
		Provider:  "domain-bind-test",
		Intent:    model.AuthFlowIntentBind,
		UserId:    user.Id,
		SessionId: bundle.Session.SID,
		Payload:   string(payloadBytes),
		ExpiresAt: time.Now().Add(time.Minute),
	})
	require.NoError(t, err)

	settings, err := common.ParseCustomDomainSettings("true", "yeschoy.io", "https://yeschoy.com", "5", "")
	require.NoError(t, err)
	resolver, err := service.NewCustomDomainResolver(settings)
	require.NoError(t, err)
	router := gin.New()
	router.Use(middleware.CustomDomainContextWithResolver(resolver, true))
	router.POST("/api/oauth/domain-bind-handoff", middleware.UserAuth(), ConsumeDomainBindHandoff)

	requestHandoff := func() *httptest.ResponseRecorder {
		request := httptest.NewRequest(http.MethodPost, "https://alpha.yeschoy.io/api/oauth/domain-bind-handoff", strings.NewReader(`{"ticket":"`+ticket+`"}`))
		request.Host = "alpha.yeschoy.io"
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("Authorization", "Bearer "+bundle.AccessToken)
		request.AddCookie(&http.Cookie{Name: domainOAuthBindingCookieName, Value: binding})
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
		return response
	}

	response := requestHandoff()
	require.Equal(t, http.StatusOK, response.Code)
	var updated model.User
	require.NoError(t, db.First(&updated, user.Id).Error)
	assert.Equal(t, "provider-user-id", updated.GitHubId)

	response = requestHandoff()
	assert.Equal(t, http.StatusForbidden, response.Code)
}

func TestDisabledDomainLoginHandoffExchangesTheBoundTicketForAMainFallback(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previousDB := model.DB
	previousLogDB := model.LOG_DB
	previousDatabaseType := common.MainDatabaseType()
	previousRedisEnabled := common.RedisEnabled
	previousSecure := common.SessionCookieSecure
	previousCustomDomainEnabled := common.CustomDomainEnabled
	previousMainOrigin := common.CustomDomainMainOrigin
	previousMainOrigins := common.CustomDomainMainOrigins
	previousSuffix := common.CustomDomainSuffix
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.UserSession{}, &model.AuthFlow{}, &model.CustomDomain{}, &model.Log{}))
	model.DB = db
	model.LOG_DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	common.SessionCookieSecure = true
	common.CustomDomainEnabled = true
	common.CustomDomainMainOrigin = "https://yeschoy.com"
	common.CustomDomainMainOrigins = []string{"https://yeschoy.com", "https://yeschoy.pro"}
	common.CustomDomainSuffix = "yeschoy.io"
	t.Cleanup(func() {
		model.DB = previousDB
		model.LOG_DB = previousLogDB
		common.SetMainDatabaseType(previousDatabaseType)
		common.RedisEnabled = previousRedisEnabled
		common.SessionCookieSecure = previousSecure
		common.CustomDomainEnabled = previousCustomDomainEnabled
		common.CustomDomainMainOrigin = previousMainOrigin
		common.CustomDomainMainOrigins = previousMainOrigins
		common.CustomDomainSuffix = previousSuffix
	})

	owner := model.User{Username: "fallback-owner", AffCode: "fallback-owner-aff", Status: common.UserStatusEnabled}
	user := model.User{Username: "fallback-user", AffCode: "fallback-user-aff", Status: common.UserStatusEnabled, AuthVersion: 1}
	require.NoError(t, db.Create(&owner).Error)
	require.NoError(t, db.Create(&user).Error)
	domain, err := model.CreateCustomDomain("alpha", owner.Id)
	require.NoError(t, err)
	domain, err = model.EnableCustomDomain(domain.Label)
	require.NoError(t, err)
	binding := "fallback-browser-binding-with-at-least-thirty-two-characters"
	payloadBytes, err := common.Marshal(domainLoginHandoffPayload{
		DomainID:            domain.Id,
		TargetHost:          "alpha.yeschoy.io",
		BrowserBindingHash:  domainOAuthBindingHash(binding),
		ExpectedAuthVersion: user.AuthVersion,
		LoginMethod:         "oauth:github",
	})
	require.NoError(t, err)
	ticket, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose: model.AuthFlowPurposeDomainLoginHandoff, Provider: "github", UserId: user.Id,
		Payload: string(payloadBytes), ExpiresAt: time.Now().Add(time.Minute),
	})
	require.NoError(t, err)
	settings, err := common.ParseCustomDomainSettingsWithMainOrigins(
		"true",
		"yeschoy.io",
		"https://yeschoy.com",
		"https://yeschoy.com,https://yeschoy.pro",
		"5",
		"",
	)
	require.NoError(t, err)
	resolver, err := service.NewCustomDomainResolver(settings)
	require.NoError(t, err)
	cachedDomain, err := resolver.ResolveHost("alpha.yeschoy.io")
	require.NoError(t, err)
	require.Equal(t, service.CustomDomainKindCustom, cachedDomain.Kind)

	_, err = model.DisableCustomDomain(domain.Label)
	require.NoError(t, err)
	router := gin.New()
	router.Use(middleware.CustomDomainContextWithResolver(resolver, true))
	router.POST("/api/oauth/domain-handoff", ConsumeDomainLoginHandoff)
	router.POST("/api/oauth/domain-handoff-fallback", ConsumeDomainLoginFallback)
	request := httptest.NewRequest(http.MethodPost, "https://alpha.yeschoy.io/api/oauth/domain-handoff", strings.NewReader(`{"ticket":"`+ticket+`"}`))
	request.Host = "alpha.yeschoy.io"
	request.Header.Set("Content-Type", "application/json")
	request.AddCookie(&http.Cookie{Name: domainOAuthBindingCookieName, Value: binding})
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	require.Equal(t, http.StatusOK, response.Code)

	var body struct {
		Data struct {
			Action       string `json:"action"`
			Ticket       string `json:"ticket"`
			TargetOrigin string `json:"target_origin"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
	assert.Equal(t, "domain_login_fallback", body.Data.Action)
	assert.NotEmpty(t, body.Data.Ticket)
	assert.Equal(t, "https://yeschoy.com", body.Data.TargetOrigin)

	var sessionCount int64
	require.NoError(t, db.Model(&model.UserSession{}).Count(&sessionCount).Error)
	assert.Zero(t, sessionCount)

	request = httptest.NewRequest(http.MethodPost, "https://yeschoy.pro/api/oauth/domain-handoff-fallback", strings.NewReader(fmt.Sprintf("{\"ticket\":%q}", body.Data.Ticket)))
	request.Host = "yeschoy.pro"
	request.Header.Set("Content-Type", "application/json")
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	assert.Equal(t, http.StatusNotFound, response.Code)

	requestFallback := func() *httptest.ResponseRecorder {
		request := httptest.NewRequest(http.MethodPost, "https://yeschoy.com/api/oauth/domain-handoff-fallback", strings.NewReader(`{"ticket":"`+body.Data.Ticket+`"}`))
		request.Host = "yeschoy.com"
		request.Header.Set("Content-Type", "application/json")
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
		return response
	}
	response = requestFallback()
	require.Equal(t, http.StatusOK, response.Code)
	assert.Contains(t, response.Header().Get("Set-Cookie"), service.RefreshCookieName+"=")
	require.NoError(t, db.Model(&model.UserSession{}).Count(&sessionCount).Error)
	assert.EqualValues(t, 1, sessionCount)
	var loginLog model.Log
	require.NoError(t, db.Where("user_id = ? AND type = ?", user.Id, model.LogTypeLogin).First(&loginLog).Error)
	assert.Equal(t, user.Username, loginLog.Username)
	assert.Contains(t, loginLog.Other, `"login_method":"oauth:github"`)
	response = requestFallback()
	assert.Equal(t, http.StatusForbidden, response.Code)
	var loginLogCount int64
	require.NoError(t, db.Model(&model.Log{}).Where("user_id = ? AND type = ?", user.Id, model.LogTypeLogin).Count(&loginLogCount).Error)
	assert.EqualValues(t, 1, loginLogCount)
}
