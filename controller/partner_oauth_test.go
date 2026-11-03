package controller

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupPartnerOAuthController(t *testing.T) *gin.Engine {
	t.Helper()
	require.NoError(t, i18n.Init())
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousRedis := common.RedisEnabled
	previousSecret := common.SessionSecret
	previousAddress := system_setting.ServerAddress
	previousCustom := common.CustomDomainEnabled
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.UserSession{},
		&model.AuthFlow{},
		&model.Token{},
		&model.PartnerOAuthClient{},
		&model.PartnerOAuthBinding{},
		&model.PartnerOAuthToken{},
		&model.PartnerAccount{},
		&model.AuditLog{},
		&model.PartnerOauthAuthorizationLog{},
	))
	model.DB = db
	model.LOG_DB = db
	common.RedisEnabled = false
	common.SessionSecret = "partner-oauth-controller-secret"
	system_setting.ServerAddress = "http://localhost:3000"
	common.CustomDomainEnabled = false
	t.Cleanup(func() {
		model.DB = previousDB
		model.LOG_DB = previousLogDB
		common.RedisEnabled = previousRedis
		common.SessionSecret = previousSecret
		system_setting.ServerAddress = previousAddress
		common.CustomDomainEnabled = previousCustom
		_ = sqlDB.Close()
	})
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(middleware.RequestId(), middleware.PartnerOAuthRequestID(), middleware.PartnerOAuthNoStore())
	engine.GET("/oauth/authorize", PartnerOAuthAuthorize)
	engine.POST("/oauth/token", PartnerOAuthToken)
	engine.POST("/oauth/revoke", PartnerOAuthRevoke)
	engine.GET("/api/integrations/v1/account", middleware.PartnerOAuthBearer(service.PartnerOAuthScopeAccountRead), PartnerOAuthAccount)
	engine.POST("/api/integrations/v1/credential", middleware.PartnerOAuthBearer(service.PartnerOAuthScopeCredentialRead), PartnerOAuthCredential)
	return engine
}

func createPartnerTestClient(t *testing.T, method string, redirects []string) (*model.PartnerOAuthClient, string) {
	t.Helper()
	encoded, err := common.Marshal(redirects)
	require.NoError(t, err)
	secret := ""
	hash := ""
	if method == model.PartnerOAuthTokenAuthMethodBasic {
		secret, err = service.GeneratePartnerOAuthClientSecret()
		require.NoError(t, err)
		hash = model.HashPartnerOAuthSecret(secret)
	}
	client := &model.PartnerOAuthClient{
		Name:            "Example Assistant",
		TokenAuthMethod: method,
		SecretHash:      hash,
		RedirectURIs:    string(encoded),
		Scopes:          "account:read credential:read offline_access",
		Status:          model.PartnerOAuthClientStatusEnabled,
	}
	require.NoError(t, model.CreatePartnerOAuthClient(client))
	return client, secret
}

func TestPartnerOAuthInvalidClientReturnsHTMLWithoutRedirect(t *testing.T) {
	engine := setupPartnerOAuthController(t)
	req := httptest.NewRequest(http.MethodGet, "/oauth/authorize?response_type=code&client_id=pc_missing&redirect_uri=https://evil.example/cb&scope=account:read&state=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256", nil)
	req.Host = "localhost:3000"
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Contains(t, rec.Header().Get("Content-Type"), "text/html")
	assert.Empty(t, rec.Header().Get("Location"))
	assert.Equal(t, "no-store", rec.Header().Get("Cache-Control"))
	assert.NotEmpty(t, rec.Header().Get("X-Request-Id"))
}

func TestPartnerOAuthAuthorizeErrorsNeverRedirectToUnregisteredURI(t *testing.T) {
	engine := setupPartnerOAuthController(t)
	client, _ := createPartnerTestClient(t, model.PartnerOAuthTokenAuthMethodNone, []string{"http://127.0.0.1/oauth/callback"})
	state := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	base := "/oauth/authorize?client_id=" + client.ClientId + "&state=" + state
	cases := []struct {
		name         string
		path         string
		wantStatus   int
		wantRedirect string
	}{
		{"unsupported response_type, unregistered uri", base + "&response_type=token&redirect_uri=" + url.QueryEscape("https://evil.example/cb"), http.StatusBadRequest, ""},
		{"repeated state, unregistered uri", base + "&state=" + state + "&redirect_uri=" + url.QueryEscape("https://evil.example/cb"), http.StatusBadRequest, ""},
		{"unsupported response_type, registered uri", base + "&response_type=token&redirect_uri=" + url.QueryEscape("http://127.0.0.1:43721/oauth/callback"), http.StatusFound, "http://127.0.0.1:43721/oauth/callback"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tc.path, nil)
			req.Host = "localhost:3000"
			rec := httptest.NewRecorder()
			engine.ServeHTTP(rec, req)
			assert.Equal(t, tc.wantStatus, rec.Code)
			if tc.wantRedirect == "" {
				assert.Empty(t, rec.Header().Get("Location"))
				assert.Contains(t, rec.Header().Get("Content-Type"), "text/html")
				return
			}
			assert.True(t, strings.HasPrefix(rec.Header().Get("Location"), tc.wantRedirect+"?error=unsupported_response_type"))
		})
	}
}

func TestPartnerOAuthAuthorizeRedirectsToConsent(t *testing.T) {
	engine := setupPartnerOAuthController(t)
	client, _ := createPartnerTestClient(t, model.PartnerOAuthTokenAuthMethodNone, []string{"http://127.0.0.1/oauth/callback"})
	req := httptest.NewRequest(http.MethodGet, "/oauth/authorize?response_type=code&client_id="+client.ClientId+"&redirect_uri="+url.QueryEscape("http://127.0.0.1:43721/oauth/callback")+"&scope="+url.QueryEscape("account:read credential:read offline_access")+"&state=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256", nil)
	req.Host = "localhost:3000"
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusSeeOther, rec.Code)
	assert.True(t, strings.HasPrefix(rec.Header().Get("Location"), "/partner-authorize?request="))
	assert.Equal(t, "no-referrer", rec.Header().Get("Referrer-Policy"))
	found := false
	for _, cookie := range rec.Result().Cookies() {
		if cookie.Name == service.PartnerOAuthCookieName {
			found = true
			assert.True(t, cookie.HttpOnly)
			assert.Equal(t, service.PartnerOAuthCookiePath, cookie.Path)
		}
	}
	assert.True(t, found)
}

func TestPartnerOAuthTokenAndIntegrationFlow(t *testing.T) {
	engine := setupPartnerOAuthController(t)
	user := &model.User{Username: "alice", DisplayName: "Alice", Password: "unused", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1}
	require.NoError(t, model.DB.Create(user).Error)
	client, secret := createPartnerTestClient(t, model.PartnerOAuthTokenAuthMethodBasic, []string{"https://assistant.example.com/oauth/callback"})
	verifier := "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
	payload, err := common.Marshal(service.PartnerOAuthCodePayload{
		RedirectURI:     "https://assistant.example.com/oauth/callback",
		CodeChallenge:   service.PartnerOAuthPKCEChallengeS256(verifier),
		Scope:           "account:read credential:read offline_access",
		UserAuthVersion: user.AuthVersion,
	})
	require.NoError(t, err)
	code, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose:   model.AuthFlowPurposePartnerOAuthCode,
		Provider:  client.ClientId,
		UserId:    user.Id,
		Payload:   string(payload),
		ExpiresAt: time.Now().Add(service.PartnerOAuthCodeTTL),
	})
	require.NoError(t, err)

	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("redirect_uri", "https://assistant.example.com/oauth/callback")
	form.Set("code_verifier", verifier)
	req := httptest.NewRequest(http.MethodPost, "/oauth/token", strings.NewReader(form.Encode()))
	req.Host = "localhost:3000"
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.SetBasicAuth(client.ClientId, secret)
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "no-store", rec.Header().Get("Cache-Control"))
	assert.NotEmpty(t, rec.Header().Get("X-Request-Id"))
	var token service.PartnerOAuthTokenResponse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &token))
	require.NotEmpty(t, token.AccessToken)
	require.NotEmpty(t, token.RefreshToken)
	assert.Equal(t, "Bearer", token.TokenType)
	assert.NotContains(t, rec.Body.String(), `"user_id"`) // Internal audit context is not an OAuth claim.

	accountReq := httptest.NewRequest(http.MethodGet, "/api/integrations/v1/account", nil)
	accountReq.Host = "localhost:3000"
	accountReq.Header.Set("Authorization", "Bearer "+token.AccessToken)
	accountRec := httptest.NewRecorder()
	engine.ServeHTTP(accountRec, accountReq)
	require.Equal(t, http.StatusOK, accountRec.Code)
	queryReq := httptest.NewRequest(http.MethodGet, "/api/integrations/v1/account?foo=1", nil)
	queryReq.Host = "localhost:3000"
	queryReq.Header.Set("Authorization", "Bearer "+token.AccessToken)
	queryRec := httptest.NewRecorder()
	engine.ServeHTTP(queryRec, queryReq)
	require.Equal(t, http.StatusBadRequest, queryRec.Code)
	var account service.PartnerOAuthAccountResponse
	require.NoError(t, json.Unmarshal(accountRec.Body.Bytes(), &account))
	assert.Equal(t, "http://localhost:3000", account.Issuer)
	assert.Equal(t, token.BindingID, account.BindingID)

	credReq := httptest.NewRequest(http.MethodPost, "/api/integrations/v1/credential", bytes.NewBufferString("{}"))
	credReq.Host = "localhost:3000"
	credReq.Header.Set("Authorization", "Bearer "+token.AccessToken)
	credReq.Header.Set("Content-Type", "application/json")
	credRec := httptest.NewRecorder()
	engine.ServeHTTP(credRec, credReq)
	require.Equal(t, http.StatusOK, credRec.Code)
	var cred service.PartnerOAuthCredentialResponse
	require.NoError(t, json.Unmarshal(credRec.Body.Bytes(), &cred))
	assert.True(t, strings.HasPrefix(cred.APIKey, "sk-"))
	assert.Equal(t, "http://localhost:3000/v1", cred.BaseURL)

	repeat := httptest.NewRequest(http.MethodPost, "/api/integrations/v1/credential", bytes.NewBufferString("{}"))
	repeat.Host = "localhost:3000"
	repeat.Header.Set("Authorization", "Bearer "+token.AccessToken)
	repeat.Header.Set("Content-Type", "application/json")
	repeatRec := httptest.NewRecorder()
	engine.ServeHTTP(repeatRec, repeat)
	require.Equal(t, http.StatusOK, repeatRec.Code)
	var cred2 service.PartnerOAuthCredentialResponse
	require.NoError(t, json.Unmarshal(repeatRec.Body.Bytes(), &cred2))
	assert.Equal(t, cred.APIKey, cred2.APIKey)

	var logs []model.PartnerOauthAuthorizationLog
	require.NoError(t, model.LOG_DB.Order("created_at").Find(&logs).Error)
	require.Len(t, logs, 2) // token issue and first credential; no ordinary reads or repeat credential
	assert.ElementsMatch(t, []string{"partner_oauth.token.issue", "partner_oauth.credential.issue"}, []string{logs[0].Action, logs[1].Action})
	for _, entry := range logs {
		assert.Equal(t, user.Id, entry.TargetUserId)
		assert.NotEmpty(t, entry.RequestId)
		encoded, err := common.Marshal(entry)
		require.NoError(t, err)
		for _, secretValue := range []string{code, token.AccessToken, token.RefreshToken, secret, cred.APIKey, verifier} {
			assert.NotContains(t, string(encoded), secretValue)
		}
	}
	var generic int64
	require.NoError(t, model.LOG_DB.Model(&model.AuditLog{}).Where("action LIKE ?", "partner_oauth.%").Count(&generic).Error)
	assert.Zero(t, generic)

	replay := httptest.NewRequest(http.MethodPost, "/oauth/token", strings.NewReader(form.Encode()))
	replay.Host = "localhost:3000"
	replay.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	replay.SetBasicAuth(client.ClientId, secret)
	replayRec := httptest.NewRecorder()
	engine.ServeHTTP(replayRec, replay)
	require.Equal(t, http.StatusBadRequest, replayRec.Code)
	require.NoError(t, model.LOG_DB.Where("action = ?", "partner_oauth.code.replay_detected").Find(&logs).Error)
	assert.Len(t, logs, 1)
}

func TestPartnerOAuthExpiredCodeCannotIssueOrWriteTokenLog(t *testing.T) {
	engine := setupPartnerOAuthController(t)
	client, secret := createPartnerTestClient(t, model.PartnerOAuthTokenAuthMethodBasic, []string{"https://assistant.example.com/oauth/callback"})
	code, flow, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose: model.AuthFlowPurposePartnerOAuthCode, Provider: client.ClientId, UserId: 1,
		ExpiresAt: time.Now().Add(time.Minute),
	})
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(flow).Update("expires_at", time.Now().Add(-time.Minute)).Error)
	form := url.Values{
		"grant_type": {"authorization_code"}, "code": {code},
		"redirect_uri":  {"https://assistant.example.com/oauth/callback"},
		"code_verifier": {"dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"},
	}
	req := httptest.NewRequest(http.MethodPost, "/oauth/token", strings.NewReader(form.Encode()))
	req.Host = "localhost:3000"
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.SetBasicAuth(client.ClientId, secret)
	resp := httptest.NewRecorder()
	engine.ServeHTTP(resp, req)
	require.Equal(t, http.StatusBadRequest, resp.Code)
	assert.Contains(t, resp.Body.String(), `"invalid_grant"`)
	var count int64
	require.NoError(t, model.LOG_DB.Model(&model.PartnerOauthAuthorizationLog{}).Count(&count).Error)
	assert.Zero(t, count)
}

func TestPartnerOAuthTokenRejectsBadBasicAndDuplicateForm(t *testing.T) {
	engine := setupPartnerOAuthController(t)
	client, secret := createPartnerTestClient(t, model.PartnerOAuthTokenAuthMethodBasic, []string{"https://assistant.example.com/oauth/callback"})

	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", "x")
	form.Set("redirect_uri", "https://assistant.example.com/oauth/callback")
	form.Set("code_verifier", "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")
	req := httptest.NewRequest(http.MethodPost, "/oauth/token", strings.NewReader(form.Encode()))
	req.Host = "localhost:3000"
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte(client.ClientId+":wrong-secret")))
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Equal(t, `Basic realm="oauth"`, rec.Header().Get("WWW-Authenticate"))
	var first map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &first))

	unknown := httptest.NewRequest(http.MethodPost, "/oauth/token", strings.NewReader(form.Encode()))
	unknown.Host = "localhost:3000"
	unknown.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	unknown.Header.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte("pc_ffffffffffffffffffffffffffffffff:wrong-secret")))
	unknownRec := httptest.NewRecorder()
	engine.ServeHTTP(unknownRec, unknown)
	assert.Equal(t, rec.Code, unknownRec.Code)
	assert.Equal(t, rec.Header().Get("WWW-Authenticate"), unknownRec.Header().Get("WWW-Authenticate"))
	assert.JSONEq(t, rec.Body.String(), unknownRec.Body.String())
	_ = secret

	dup := httptest.NewRequest(http.MethodPost, "/oauth/token", strings.NewReader("grant_type=authorization_code&grant_type=refresh_token"))
	dup.Host = "localhost:3000"
	dup.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	dupRec := httptest.NewRecorder()
	engine.ServeHTTP(dupRec, dup)
	assert.Equal(t, http.StatusBadRequest, dupRec.Code)
}

func TestPartnerOAuthRevokeUnknownTokenIsEmpty200(t *testing.T) {
	engine := setupPartnerOAuthController(t)
	client, secret := createPartnerTestClient(t, model.PartnerOAuthTokenAuthMethodBasic, []string{"https://assistant.example.com/oauth/callback"})
	form := url.Values{}
	form.Set("token", "or_unknown")
	form.Set("token_type_hint", "refresh_token")
	req := httptest.NewRequest(http.MethodPost, "/oauth/revoke", strings.NewReader(form.Encode()))
	req.Host = "localhost:3000"
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.SetBasicAuth(client.ClientId, secret)
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "no-store", rec.Header().Get("Cache-Control"))
	assert.Equal(t, 0, rec.Body.Len())
}

func TestPartnerOAuthRevokeActualTokenWritesDedicatedLog(t *testing.T) {
	engine := setupPartnerOAuthController(t)
	user := &model.User{Username: "token-revoke-owner", Password: "unused", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1}
	require.NoError(t, model.DB.Create(user).Error)
	client, secret := createPartnerTestClient(t, model.PartnerOAuthTokenAuthMethodBasic, []string{"https://assistant.example.com/oauth/callback"})
	bindingID := seedPartnerBindingWithKey(t, user, client, "token-revoke-secret-key")
	form := url.Values{"token": {"oa_token-revoke-secret-key"}}
	req := httptest.NewRequest(http.MethodPost, "/oauth/revoke", strings.NewReader(form.Encode()))
	req.Host = "localhost:3000"
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.SetBasicAuth(client.ClientId, secret)
	resp := httptest.NewRecorder()
	engine.ServeHTTP(resp, req)
	require.Equal(t, http.StatusOK, resp.Code)
	var logs []model.PartnerOauthAuthorizationLog
	require.NoError(t, model.LOG_DB.Find(&logs).Error)
	require.Len(t, logs, 1)
	assert.Equal(t, "partner_oauth.binding.revoke", logs[0].Action)
	assert.Equal(t, bindingID, logs[0].BindingId)
	assert.Equal(t, user.Id, logs[0].TargetUserId)
	encoded, err := common.Marshal(logs)
	require.NoError(t, err)
	assert.NotContains(t, string(encoded), "token-revoke-secret-key")
	var generic int64
	require.NoError(t, model.LOG_DB.Model(&model.AuditLog{}).Count(&generic).Error)
	assert.Zero(t, generic)
	second := httptest.NewRecorder()
	retry := httptest.NewRequest(http.MethodPost, "/oauth/revoke", strings.NewReader(form.Encode()))
	retry.Host = "localhost:3000"
	retry.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	retry.SetBasicAuth(client.ClientId, secret)
	engine.ServeHTTP(second, retry)
	assert.Equal(t, http.StatusOK, second.Code)
	require.NoError(t, model.LOG_DB.Find(&logs).Error)
	assert.Len(t, logs, 1)
}

func TestPartnerOAuthIntegrationAuthErrors(t *testing.T) {
	engine := setupPartnerOAuthController(t)
	missing := httptest.NewRequest(http.MethodGet, "/api/integrations/v1/account", nil)
	missing.Host = "localhost:3000"
	missingRec := httptest.NewRecorder()
	engine.ServeHTTP(missingRec, missing)
	assert.Equal(t, http.StatusUnauthorized, missingRec.Code)
	assert.Equal(t, `Bearer realm="integration"`, missingRec.Header().Get("WWW-Authenticate"))
	assert.Equal(t, 0, missingRec.Body.Len())

	invalid := httptest.NewRequest(http.MethodGet, "/api/integrations/v1/account", nil)
	invalid.Host = "localhost:3000"
	invalid.Header.Set("Authorization", "Bearer oa_not_a_real_token")
	invalidRec := httptest.NewRecorder()
	engine.ServeHTTP(invalidRec, invalid)
	assert.Equal(t, http.StatusUnauthorized, invalidRec.Code)
	assert.Contains(t, invalidRec.Header().Get("WWW-Authenticate"), "invalid_token")

	accessToken := httptest.NewRequest(http.MethodGet, "/api/integrations/v1/account?access_token=oa_secret", nil)
	accessToken.Host = "localhost:3000"
	accessTokenRec := httptest.NewRecorder()
	engine.ServeHTTP(accessTokenRec, accessToken)
	assert.Equal(t, http.StatusBadRequest, accessTokenRec.Code)

	cred := httptest.NewRequest(http.MethodPost, "/api/integrations/v1/credential", strings.NewReader("not-json"))
	cred.Host = "localhost:3000"
	cred.Header.Set("Authorization", "Bearer oa_not_a_real_token")
	cred.Header.Set("Content-Type", "text/plain")
	credRec := httptest.NewRecorder()
	engine.ServeHTTP(credRec, cred)
	assert.True(t, credRec.Code == http.StatusUnauthorized || credRec.Code == http.StatusUnsupportedMediaType)
}

func TestPartnerOAuthCredentialRequiresEmptyJSON(t *testing.T) {
	engine := setupPartnerOAuthController(t)
	user := &model.User{Username: "bob", Password: "unused", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, AuthVersion: 1}
	require.NoError(t, model.DB.Create(user).Error)
	client, secret := createPartnerTestClient(t, model.PartnerOAuthTokenAuthMethodBasic, []string{"https://assistant.example.com/oauth/callback"})
	issued := issuePartnerToken(t, engine, user, client, secret)

	req := httptest.NewRequest(http.MethodPost, "/api/integrations/v1/credential", bytes.NewBufferString(`{"foo":1}`))
	req.Host = "localhost:3000"
	req.Header.Set("Authorization", "Bearer "+issued.AccessToken)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	media := httptest.NewRequest(http.MethodPost, "/api/integrations/v1/credential", bytes.NewBufferString(`{}`))
	media.Host = "localhost:3000"
	media.Header.Set("Authorization", "Bearer "+issued.AccessToken)
	media.Header.Set("Content-Type", "text/plain")
	mediaRec := httptest.NewRecorder()
	engine.ServeHTTP(mediaRec, media)
	assert.Equal(t, http.StatusUnsupportedMediaType, mediaRec.Code)
}

func issuePartnerToken(t *testing.T, engine *gin.Engine, user *model.User, client *model.PartnerOAuthClient, secret string) service.PartnerOAuthTokenResponse {
	t.Helper()
	verifier := "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
	payload, err := common.Marshal(service.PartnerOAuthCodePayload{
		RedirectURI:     "https://assistant.example.com/oauth/callback",
		CodeChallenge:   service.PartnerOAuthPKCEChallengeS256(verifier),
		Scope:           "account:read credential:read offline_access",
		UserAuthVersion: user.AuthVersion,
	})
	require.NoError(t, err)
	code, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose:   model.AuthFlowPurposePartnerOAuthCode,
		Provider:  client.ClientId,
		UserId:    user.Id,
		Payload:   string(payload),
		ExpiresAt: time.Now().Add(service.PartnerOAuthCodeTTL),
	})
	require.NoError(t, err)
	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("redirect_uri", "https://assistant.example.com/oauth/callback")
	form.Set("code_verifier", verifier)
	req := httptest.NewRequest(http.MethodPost, "/oauth/token", strings.NewReader(form.Encode()))
	req.Host = "localhost:3000"
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.SetBasicAuth(client.ClientId, secret)
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
	var token service.PartnerOAuthTokenResponse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &token))
	return token
}

func TestPartnerOAuthPublicClientToken(t *testing.T) {
	engine := setupPartnerOAuthController(t)
	user := &model.User{Username: "carol", Password: "unused", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, AuthVersion: 1}
	require.NoError(t, model.DB.Create(user).Error)
	client, _ := createPartnerTestClient(t, model.PartnerOAuthTokenAuthMethodNone, []string{"http://127.0.0.1/oauth/callback"})
	verifier := "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
	payload, err := common.Marshal(service.PartnerOAuthCodePayload{
		RedirectURI:     "http://127.0.0.1:9/oauth/callback",
		CodeChallenge:   service.PartnerOAuthPKCEChallengeS256(verifier),
		Scope:           "account:read",
		UserAuthVersion: user.AuthVersion,
	})
	require.NoError(t, err)
	code, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose:   model.AuthFlowPurposePartnerOAuthCode,
		Provider:  client.ClientId,
		UserId:    user.Id,
		Payload:   string(payload),
		ExpiresAt: time.Now().Add(service.PartnerOAuthCodeTTL),
	})
	require.NoError(t, err)
	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("redirect_uri", "http://127.0.0.1:9/oauth/callback")
	form.Set("code_verifier", verifier)
	form.Set("client_id", client.ClientId)
	req := httptest.NewRequest(http.MethodPost, "/oauth/token", strings.NewReader(form.Encode()))
	req.Host = "localhost:3000"
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
	var token service.PartnerOAuthTokenResponse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &token))
	assert.Empty(t, token.RefreshToken)
	_ = io.Discard
}

func TestPartnerOAuthPKCEEndToEndFromAuthorizeToCredential(t *testing.T) {
	engine := setupPartnerOAuthBrowserFlow(t)
	user := createPartnerBrowserUser(t, "pkce-user")
	client, secret := createPartnerTestClient(t, model.PartnerOAuthTokenAuthMethodBasic, []string{"https://assistant.example.com/oauth/callback"})

	verifier := "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
	challenge := service.PartnerOAuthPKCEChallengeS256(verifier)
	state := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	redirectURI := "https://assistant.example.com/oauth/callback"
	scope := "account:read credential:read offline_access"

	authURL := "/oauth/authorize?response_type=code&client_id=" + client.ClientId +
		"&redirect_uri=" + url.QueryEscape(redirectURI) +
		"&scope=" + url.QueryEscape(scope) +
		"&state=" + state +
		"&code_challenge=" + challenge +
		"&code_challenge_method=S256"
	authReq := httptest.NewRequest(http.MethodGet, authURL, nil)
	authReq.Host = "localhost:3000"
	authRec := httptest.NewRecorder()
	engine.ServeHTTP(authRec, authReq)
	require.Equal(t, http.StatusSeeOther, authRec.Code, "status=%d location=%s body=%s", authRec.Code, authRec.Header().Get("Location"), authRec.Body.String())
	location := authRec.Header().Get("Location")
	require.True(t, strings.HasPrefix(location, "/partner-authorize?request="))
	requestToken := strings.TrimPrefix(location, "/partner-authorize?request=")
	require.NotEmpty(t, requestToken)
	var nonce string
	for _, cookie := range authRec.Result().Cookies() {
		if cookie.Name == service.PartnerOAuthCookieName {
			nonce = cookie.Value
			assert.True(t, cookie.HttpOnly)
			assert.Equal(t, service.PartnerOAuthCookiePath, cookie.Path)
		}
	}
	require.NotEmpty(t, nonce)

	inspectReq := httptest.NewRequest(http.MethodGet, "/api/partner-oauth/authorization?request="+url.QueryEscape(requestToken), nil)
	inspectReq.Host = "localhost:3000"
	inspectReq.Header.Set("Authorization", "Bearer "+user.token)
	inspectReq.AddCookie(&http.Cookie{Name: service.PartnerOAuthCookieName, Value: nonce})
	inspectRec := httptest.NewRecorder()
	engine.ServeHTTP(inspectRec, inspectReq)
	require.Equal(t, http.StatusOK, inspectRec.Code, inspectRec.Body.String())
	var inspect struct {
		Success bool `json:"success"`
		Data    struct {
			ClientName   string   `json:"client_name"`
			Scopes       []string `json:"scopes"`
			RedirectHost string   `json:"redirect_host"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(inspectRec.Body.Bytes(), &inspect))
	require.True(t, inspect.Success)
	assert.Equal(t, "Example Assistant", inspect.Data.ClientName)
	assert.Equal(t, "assistant.example.com", inspect.Data.RedirectHost)
	assert.Contains(t, inspect.Data.Scopes, "account:read")

	decisionBody := `{"request":` + mustJSON(requestToken) + `,"decision":"approve"}`
	decideReq := httptest.NewRequest(http.MethodPost, "/api/partner-oauth/authorization/decision", strings.NewReader(decisionBody))
	decideReq.Host = "localhost:3000"
	decideReq.Header.Set("Authorization", "Bearer "+user.token)
	decideReq.Header.Set("Content-Type", "application/json")
	decideReq.AddCookie(&http.Cookie{Name: service.PartnerOAuthCookieName, Value: nonce})
	decideRec := httptest.NewRecorder()
	engine.ServeHTTP(decideRec, decideReq)
	require.Equal(t, http.StatusOK, decideRec.Code, decideRec.Body.String())
	var decided struct {
		Success bool `json:"success"`
		Data    struct {
			RedirectTo string `json:"redirect_to"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(decideRec.Body.Bytes(), &decided))
	require.True(t, decided.Success)
	callback, err := url.Parse(decided.Data.RedirectTo)
	require.NoError(t, err)
	assert.Equal(t, redirectURI, callback.Scheme+"://"+callback.Host+callback.Path)
	assert.Equal(t, state, callback.Query().Get("state"))
	assert.Equal(t, "http://localhost:3000", callback.Query().Get("iss"))
	code := callback.Query().Get("code")
	require.NotEmpty(t, code)

	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("redirect_uri", redirectURI)
	form.Set("code_verifier", verifier)
	tokenReq := httptest.NewRequest(http.MethodPost, "/oauth/token", strings.NewReader(form.Encode()))
	tokenReq.Host = "localhost:3000"
	tokenReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	tokenReq.SetBasicAuth(client.ClientId, secret)
	tokenRec := httptest.NewRecorder()
	engine.ServeHTTP(tokenRec, tokenReq)
	require.Equal(t, http.StatusOK, tokenRec.Code, tokenRec.Body.String())
	var issued service.PartnerOAuthTokenResponse
	require.NoError(t, json.Unmarshal(tokenRec.Body.Bytes(), &issued))
	require.NotEmpty(t, issued.AccessToken)
	require.NotEmpty(t, issued.RefreshToken)
	require.NotEmpty(t, issued.BindingID)
	assert.Equal(t, "Bearer", issued.TokenType)
	assert.Contains(t, issued.Scope, "account:read")
	assert.True(t, strings.HasPrefix(issued.AccessToken, "oa_"))
	assert.True(t, strings.HasPrefix(issued.RefreshToken, "or_"))

	accountReq := httptest.NewRequest(http.MethodGet, "/api/integrations/v1/account", nil)
	accountReq.Host = "localhost:3000"
	accountReq.Header.Set("Authorization", "Bearer "+issued.AccessToken)
	accountRec := httptest.NewRecorder()
	engine.ServeHTTP(accountRec, accountReq)
	require.Equal(t, http.StatusOK, accountRec.Code, accountRec.Body.String())
	var account service.PartnerOAuthAccountResponse
	require.NoError(t, json.Unmarshal(accountRec.Body.Bytes(), &account))
	assert.Equal(t, "http://localhost:3000", account.Issuer)
	assert.Equal(t, issued.BindingID, account.BindingID)
	assert.Equal(t, model.PartnerOAuthAccountID(user.user.Id), account.AccountID)

	credReq := httptest.NewRequest(http.MethodPost, "/api/integrations/v1/credential", strings.NewReader("{}"))
	credReq.Host = "localhost:3000"
	credReq.Header.Set("Authorization", "Bearer "+issued.AccessToken)
	credReq.Header.Set("Content-Type", "application/json")
	credRec := httptest.NewRecorder()
	engine.ServeHTTP(credRec, credReq)
	require.Equal(t, http.StatusOK, credRec.Code, credRec.Body.String())
	var cred service.PartnerOAuthCredentialResponse
	require.NoError(t, json.Unmarshal(credRec.Body.Bytes(), &cred))
	assert.Equal(t, issued.BindingID, cred.BindingID)
	assert.True(t, strings.HasPrefix(cred.APIKey, "sk-"))
	assert.Equal(t, "http://localhost:3000/v1", cred.BaseURL)

	refresh := url.Values{}
	refresh.Set("grant_type", "refresh_token")
	refresh.Set("refresh_token", issued.RefreshToken)
	refreshReq := httptest.NewRequest(http.MethodPost, "/oauth/token", strings.NewReader(refresh.Encode()))
	refreshReq.Host = "localhost:3000"
	refreshReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	refreshReq.SetBasicAuth(client.ClientId, secret)
	refreshRec := httptest.NewRecorder()
	engine.ServeHTTP(refreshRec, refreshReq)
	require.Equal(t, http.StatusOK, refreshRec.Code, refreshRec.Body.String())
	var rotated service.PartnerOAuthTokenResponse
	require.NoError(t, json.Unmarshal(refreshRec.Body.Bytes(), &rotated))
	assert.Equal(t, issued.BindingID, rotated.BindingID)
	var beforeReuse int64
	require.NoError(t, model.LOG_DB.Model(&model.PartnerOauthAuthorizationLog{}).Count(&beforeReuse).Error)
	assert.Equal(t, int64(3), beforeReuse) // consent, token issue, credential; refresh is intentionally silent
	assert.NotEqual(t, issued.AccessToken, rotated.AccessToken)
	assert.NotEqual(t, issued.RefreshToken, rotated.RefreshToken)

	reuse := url.Values{}
	reuse.Set("grant_type", "refresh_token")
	reuse.Set("refresh_token", issued.RefreshToken)
	reuseReq := httptest.NewRequest(http.MethodPost, "/oauth/token", strings.NewReader(reuse.Encode()))
	reuseReq.Host = "localhost:3000"
	reuseReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	reuseReq.SetBasicAuth(client.ClientId, secret)
	reuseRec := httptest.NewRecorder()
	engine.ServeHTTP(reuseRec, reuseReq)
	require.Equal(t, http.StatusBadRequest, reuseRec.Code)
	assert.Contains(t, reuseRec.Body.String(), `"invalid_grant"`)
	var reuseLogs []model.PartnerOauthAuthorizationLog
	require.NoError(t, model.LOG_DB.Where("action = ?", "partner_oauth.refresh.reuse_detected").Find(&reuseLogs).Error)
	require.Len(t, reuseLogs, 1)
	assert.Equal(t, issued.BindingID, reuseLogs[0].BindingId)
	assert.Equal(t, user.user.Id, reuseLogs[0].TargetUserId)
	assert.False(t, reuseLogs[0].Success)

	replayReq := httptest.NewRequest(http.MethodPost, "/oauth/token", strings.NewReader(form.Encode()))
	replayReq.Host = "localhost:3000"
	replayReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	replayReq.SetBasicAuth(client.ClientId, secret)
	replayRec := httptest.NewRecorder()
	engine.ServeHTTP(replayRec, replayReq)
	require.Equal(t, http.StatusBadRequest, replayRec.Code)
	assert.Contains(t, replayRec.Body.String(), `"invalid_grant"`)
	var codeReplayLogs int64
	require.NoError(t, model.LOG_DB.Model(&model.PartnerOauthAuthorizationLog{}).Where("action = ?", "partner_oauth.code.replay_detected").Count(&codeReplayLogs).Error)
	assert.Zero(t, codeReplayLogs) // already revoked by refresh replay

	deadReq := httptest.NewRequest(http.MethodGet, "/api/integrations/v1/account", nil)
	deadReq.Host = "localhost:3000"
	deadReq.Header.Set("Authorization", "Bearer "+rotated.AccessToken)
	deadRec := httptest.NewRecorder()
	engine.ServeHTTP(deadRec, deadReq)
	require.Equal(t, http.StatusUnauthorized, deadRec.Code)
	assert.Contains(t, deadRec.Body.String(), `"invalid_token"`)
}

func TestPartnerOAuthUserBindingRevokeLogsOnlyOnce(t *testing.T) {
	engine := setupPartnerOAuthBrowserFlow(t)
	user := createPartnerBrowserUser(t, "user-revoke-owner")
	client, _ := createPartnerTestClient(t, model.PartnerOAuthTokenAuthMethodNone, []string{"http://127.0.0.1/oauth/callback"})
	bindingID := seedPartnerBindingWithKey(t, user.user, client, "user-revoke-secret-key")
	request := httptest.NewRequest(http.MethodDelete, "/api/user/partner-oauth/bindings/"+bindingID, nil)
	request.Header.Set("Authorization", "Bearer "+user.token)
	response := httptest.NewRecorder()
	engine.ServeHTTP(response, request)
	require.Equal(t, http.StatusOK, response.Code)
	var logs []model.PartnerOauthAuthorizationLog
	require.NoError(t, model.LOG_DB.Find(&logs).Error)
	require.Len(t, logs, 1)
	assert.Equal(t, "user_revoked", logs[0].Reason)
	assert.Equal(t, user.user.Id, logs[0].ActorUserId)
	assert.Equal(t, bindingID, logs[0].BindingId)
	var audits int64
	require.NoError(t, model.LOG_DB.Model(&model.AuditLog{}).Count(&audits).Error)
	assert.Zero(t, audits)
}

func TestPartnerOAuthConsentDenialLoggedWithoutRequestSecrets(t *testing.T) {
	engine := setupPartnerOAuthBrowserFlow(t)
	user := createPartnerBrowserUser(t, "deny-user")
	client, _ := createPartnerTestClient(t, model.PartnerOAuthTokenAuthMethodNone, []string{"http://127.0.0.1/oauth/callback"})
	request := httptest.NewRequest(http.MethodGet, "/oauth/authorize?response_type=code&client_id="+client.ClientId+
		"&redirect_uri="+url.QueryEscape("http://127.0.0.1:43721/oauth/callback")+
		"&scope=account:read&state=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256", nil)
	request.Host = "localhost:3000"
	auth := httptest.NewRecorder()
	engine.ServeHTTP(auth, request)
	require.Equal(t, http.StatusSeeOther, auth.Code)
	requestToken := strings.TrimPrefix(auth.Header().Get("Location"), "/partner-authorize?request=")
	var nonce string
	for _, cookie := range auth.Result().Cookies() {
		if cookie.Name == service.PartnerOAuthCookieName {
			nonce = cookie.Value
		}
	}
	require.NotEmpty(t, nonce)
	decision := httptest.NewRequest(http.MethodPost, "/api/partner-oauth/authorization/decision",
		strings.NewReader(`{"request":`+mustJSON(requestToken)+`,"decision":"deny"}`))
	decision.Host = "localhost:3000"
	decision.Header.Set("Authorization", "Bearer "+user.token)
	decision.Header.Set("Content-Type", "application/json")
	decision.AddCookie(&http.Cookie{Name: service.PartnerOAuthCookieName, Value: nonce})
	response := httptest.NewRecorder()
	engine.ServeHTTP(response, decision)
	require.Equal(t, http.StatusOK, response.Code)
	var logs []model.PartnerOauthAuthorizationLog
	require.NoError(t, model.LOG_DB.Find(&logs).Error)
	require.Len(t, logs, 1)
	assert.Equal(t, "partner_oauth.consent.deny", logs[0].Action)
	assert.Equal(t, user.user.Id, logs[0].ActorUserId)
	encoded, err := common.Marshal(logs)
	require.NoError(t, err)
	assert.NotContains(t, string(encoded), requestToken)
	assert.NotContains(t, string(encoded), nonce)
	assert.NotContains(t, string(encoded), "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
	var generic int64
	require.NoError(t, model.LOG_DB.Model(&model.AuditLog{}).Count(&generic).Error)
	assert.Zero(t, generic)
}

func TestPartnerOAuthPublicClientPKCEBrowserConsentFlow(t *testing.T) {
	engine := setupPartnerOAuthBrowserFlow(t)
	user := createPartnerBrowserUser(t, "pkce-native")
	client, _ := createPartnerTestClient(t, model.PartnerOAuthTokenAuthMethodNone, []string{"http://127.0.0.1/oauth/callback"})
	verifier := "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
	challenge := service.PartnerOAuthPKCEChallengeS256(verifier)
	state := "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
	redirectURI := "http://127.0.0.1:43721/oauth/callback"

	authURL := "/oauth/authorize?response_type=code&client_id=" + client.ClientId +
		"&redirect_uri=" + url.QueryEscape(redirectURI) +
		"&scope=" + url.QueryEscape("account:read credential:read") +
		"&state=" + state +
		"&code_challenge=" + challenge +
		"&code_challenge_method=S256"
	authReq := httptest.NewRequest(http.MethodGet, authURL, nil)
	authReq.Host = "localhost:3000"
	authRec := httptest.NewRecorder()
	engine.ServeHTTP(authRec, authReq)
	require.Equal(t, http.StatusSeeOther, authRec.Code)
	requestToken := strings.TrimPrefix(authRec.Header().Get("Location"), "/partner-authorize?request=")
	var nonce string
	for _, cookie := range authRec.Result().Cookies() {
		if cookie.Name == service.PartnerOAuthCookieName {
			nonce = cookie.Value
		}
	}
	require.NotEmpty(t, nonce)

	decisionBody := `{"request":` + mustJSON(requestToken) + `,"decision":"approve"}`
	decideReq := httptest.NewRequest(http.MethodPost, "/api/partner-oauth/authorization/decision", strings.NewReader(decisionBody))
	decideReq.Host = "localhost:3000"
	decideReq.Header.Set("Authorization", "Bearer "+user.token)
	decideReq.Header.Set("Content-Type", "application/json")
	decideReq.AddCookie(&http.Cookie{Name: service.PartnerOAuthCookieName, Value: nonce})
	decideRec := httptest.NewRecorder()
	engine.ServeHTTP(decideRec, decideReq)
	require.Equal(t, http.StatusOK, decideRec.Code, decideRec.Body.String())
	var decided struct {
		Data struct {
			RedirectTo string `json:"redirect_to"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(decideRec.Body.Bytes(), &decided))
	callback, err := url.Parse(decided.Data.RedirectTo)
	require.NoError(t, err)
	assert.Equal(t, "43721", callback.Port())
	code := callback.Query().Get("code")
	require.NotEmpty(t, code)

	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("redirect_uri", redirectURI)
	form.Set("code_verifier", verifier)
	form.Set("client_id", client.ClientId)
	tokenReq := httptest.NewRequest(http.MethodPost, "/oauth/token", strings.NewReader(form.Encode()))
	tokenReq.Host = "localhost:3000"
	tokenReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	tokenRec := httptest.NewRecorder()
	engine.ServeHTTP(tokenRec, tokenReq)
	require.Equal(t, http.StatusOK, tokenRec.Code, tokenRec.Body.String())
	var issued service.PartnerOAuthTokenResponse
	require.NoError(t, json.Unmarshal(tokenRec.Body.Bytes(), &issued))
	assert.Empty(t, issued.RefreshToken)
	assert.NotEmpty(t, issued.AccessToken)
}

func TestPartnerOAuthRejectedApprovalKeepsRequestRetryable(t *testing.T) {
	engine := setupPartnerOAuthBrowserFlow(t)
	user := createPartnerBrowserUser(t, "limit-retry")
	client, _ := createPartnerTestClient(t, model.PartnerOAuthTokenAuthMethodNone, []string{"http://127.0.0.1/oauth/callback"})
	bindingIDs := make([]string, 0, model.PartnerOAuthMaxActiveBindings)
	for i := range model.PartnerOAuthMaxActiveBindings {
		binding, err := model.CreatePartnerOAuthBindingWithTx(model.DB, model.PartnerOAuthBindingCreate{
			ClientId: client.ClientId, UserId: user.user.Id, UserAuthVersion: 1, Scope: "account:read",
			ExpiresAt: time.Now().Add(time.Hour).Unix(), AccessTokenHash: "limit-access-" + strconv.Itoa(i),
			AccessExpiresAt: time.Now().Add(time.Hour).Unix(),
		})
		require.NoError(t, err)
		bindingIDs = append(bindingIDs, binding.BindingId)
	}

	authURL := "/oauth/authorize?response_type=code&client_id=" + client.ClientId +
		"&redirect_uri=" + url.QueryEscape("http://127.0.0.1:43721/oauth/callback") +
		"&scope=account:read&state=cccccccccccccccccccccccccccccccc" +
		"&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256"
	authReq := httptest.NewRequest(http.MethodGet, authURL, nil)
	authReq.Host = "localhost:3000"
	authRec := httptest.NewRecorder()
	engine.ServeHTTP(authRec, authReq)
	require.Equal(t, http.StatusSeeOther, authRec.Code)
	requestToken := strings.TrimPrefix(authRec.Header().Get("Location"), "/partner-authorize?request=")
	var nonce string
	for _, cookie := range authRec.Result().Cookies() {
		if cookie.Name == service.PartnerOAuthCookieName {
			nonce = cookie.Value
		}
	}
	require.NotEmpty(t, nonce)

	approve := func() *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPost, "/api/partner-oauth/authorization/decision",
			strings.NewReader(`{"request":`+mustJSON(requestToken)+`,"decision":"approve"}`))
		req.Host = "localhost:3000"
		req.Header.Set("Authorization", "Bearer "+user.token)
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(&http.Cookie{Name: service.PartnerOAuthCookieName, Value: nonce})
		rec := httptest.NewRecorder()
		engine.ServeHTTP(rec, req)
		return rec
	}

	rejected := approve()
	assert.Equal(t, http.StatusBadRequest, rejected.Code)
	for _, cookie := range rejected.Result().Cookies() {
		assert.NotEqual(t, service.PartnerOAuthCookieName, cookie.Name, "cookie must survive a rejected approval")
	}

	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		return model.RevokePartnerOAuthBindingWithTx(tx, bindingIDs[0], "user_revoked")
	}))
	retried := approve()
	assert.Equal(t, http.StatusOK, retried.Code, retried.Body.String())
}

func TestPartnerOAuthWrongPKCEBurnsAuthorizationCode(t *testing.T) {
	engine := setupPartnerOAuthBrowserFlow(t)
	user := createPartnerBrowserUser(t, "pkce-burn")
	client, secret := createPartnerTestClient(t, model.PartnerOAuthTokenAuthMethodBasic, []string{"https://assistant.example.com/oauth/callback"})
	verifier := "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
	challenge := service.PartnerOAuthPKCEChallengeS256(verifier)
	redirectURI := "https://assistant.example.com/oauth/callback"
	authURL := "/oauth/authorize?response_type=code&client_id=" + client.ClientId +
		"&redirect_uri=" + url.QueryEscape(redirectURI) +
		"&scope=" + url.QueryEscape("account:read credential:read") +
		"&state=cccccccccccccccccccccccccccccccc" +
		"&code_challenge=" + challenge +
		"&code_challenge_method=S256"
	authReq := httptest.NewRequest(http.MethodGet, authURL, nil)
	authReq.Host = "localhost:3000"
	authRec := httptest.NewRecorder()
	engine.ServeHTTP(authRec, authReq)
	require.Equal(t, http.StatusSeeOther, authRec.Code, "status=%d location=%s body=%s", authRec.Code, authRec.Header().Get("Location"), authRec.Body.String())
	requestToken := strings.TrimPrefix(authRec.Header().Get("Location"), "/partner-authorize?request=")
	var nonce string
	for _, cookie := range authRec.Result().Cookies() {
		if cookie.Name == service.PartnerOAuthCookieName {
			nonce = cookie.Value
		}
	}
	decisionBody := `{"request":` + mustJSON(requestToken) + `,"decision":"approve"}`
	decideReq := httptest.NewRequest(http.MethodPost, "/api/partner-oauth/authorization/decision", strings.NewReader(decisionBody))
	decideReq.Host = "localhost:3000"
	decideReq.Header.Set("Authorization", "Bearer "+user.token)
	decideReq.Header.Set("Content-Type", "application/json")
	decideReq.AddCookie(&http.Cookie{Name: service.PartnerOAuthCookieName, Value: nonce})
	decideRec := httptest.NewRecorder()
	engine.ServeHTTP(decideRec, decideReq)
	require.Equal(t, http.StatusOK, decideRec.Code, decideRec.Body.String())
	var decided struct {
		Data struct {
			RedirectTo string `json:"redirect_to"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(decideRec.Body.Bytes(), &decided))
	callback, err := url.Parse(decided.Data.RedirectTo)
	require.NoError(t, err)
	code := callback.Query().Get("code")
	require.NotEmpty(t, code)

	wrong := url.Values{}
	wrong.Set("grant_type", "authorization_code")
	wrong.Set("code", code)
	wrong.Set("redirect_uri", redirectURI)
	wrong.Set("code_verifier", "this-verifier-does-not-match-the-challenge-xxxx")
	wrongReq := httptest.NewRequest(http.MethodPost, "/oauth/token", strings.NewReader(wrong.Encode()))
	wrongReq.Host = "localhost:3000"
	wrongReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	wrongReq.SetBasicAuth(client.ClientId, secret)
	wrongRec := httptest.NewRecorder()
	engine.ServeHTTP(wrongRec, wrongReq)
	require.Equal(t, http.StatusBadRequest, wrongRec.Code)
	assert.Contains(t, wrongRec.Body.String(), `"invalid_grant"`)

	retry := url.Values{}
	retry.Set("grant_type", "authorization_code")
	retry.Set("code", code)
	retry.Set("redirect_uri", redirectURI)
	retry.Set("code_verifier", verifier)
	retryReq := httptest.NewRequest(http.MethodPost, "/oauth/token", strings.NewReader(retry.Encode()))
	retryReq.Host = "localhost:3000"
	retryReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	retryReq.SetBasicAuth(client.ClientId, secret)
	retryRec := httptest.NewRecorder()
	engine.ServeHTTP(retryRec, retryReq)
	require.Equal(t, http.StatusBadRequest, retryRec.Code)
	assert.Contains(t, retryRec.Body.String(), `"invalid_grant"`)
}

func setupPartnerOAuthBrowserFlow(t *testing.T) *gin.Engine {
	t.Helper()
	engine := setupPartnerOAuthController(t)
	consent := engine.Group("/api/partner-oauth")
	consent.Use(middleware.UserAuth())
	{
		consent.GET("/authorization", PartnerOAuthInspectAuthorization)
		consent.POST("/authorization/decision", PartnerOAuthDecideAuthorization)
	}
	engine.DELETE("/api/user/partner-oauth/bindings/:binding_id", middleware.UserAuth(), DeleteUserPartnerOAuthBinding)
	return engine
}

func createPartnerBrowserUser(t *testing.T, username string) partnerOAuthAdminActor {
	t.Helper()
	user := &model.User{
		Username:    username,
		Password:    "placeholder-password",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AuthVersion: 1,
		DisplayName: "PKCE User",
		AffCode:     username,
	}
	require.NoError(t, model.DB.Create(user).Error)
	now := time.Now().Unix()
	session := &model.UserSession{
		SID:             username + "-session",
		UserID:          user.Id,
		Version:         1,
		UserAuthVersion: 1,
		Status:          model.UserSessionStatusActive,
		RefreshHash:     username + "-refresh",
		LoginMethod:     "password",
		LastActiveAt:    now,
		ExpiresAt:       now + 3600,
	}
	require.NoError(t, model.CreateUserSession(session))
	identity := service.AuthIdentity{
		UserID:          user.Id,
		SessionID:       session.SID,
		UserAuthVersion: 1,
		SessionVersion:  1,
		LoginMethod:     "password",
	}
	token, _, err := service.IssueAccessToken(identity)
	require.NoError(t, err)
	return partnerOAuthAdminActor{user: user, identity: identity, token: token}
}

func mustJSON(value string) string {
	encoded, err := json.Marshal(value)
	if err != nil {
		panic(err)
	}
	return string(encoded)
}

type partnerOAuthAdminActor struct {
	user     *model.User
	identity service.AuthIdentity
	token    string
}

func setupPartnerOAuthAdminController(t *testing.T) *gin.Engine {
	t.Helper()
	require.NoError(t, i18n.Init())
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousRedis := common.RedisEnabled
	previousSecret := common.SessionSecret
	previousMaster := common.IsMasterNode
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.UserSession{},
		&model.AuthFlow{},
		&model.Token{},
		&model.PartnerOAuthClient{},
		&model.PartnerOAuthBinding{},
		&model.PartnerOAuthToken{},
		&model.PartnerAccount{},
		&model.AuditLog{},
		&model.PartnerOauthAuthorizationLog{},
		&model.CasbinRule{},
		&model.AuthzRole{},
		&model.TwoFA{},
		&model.PasskeyCredential{},
	))
	model.DB = db
	model.LOG_DB = db
	common.RedisEnabled = false
	common.SessionSecret = "partner-oauth-admin-controller-secret"
	common.IsMasterNode = true
	require.NoError(t, authz.Init(db))
	t.Cleanup(func() {
		model.DB = previousDB
		model.LOG_DB = previousLogDB
		common.RedisEnabled = previousRedis
		common.SessionSecret = previousSecret
		common.IsMasterNode = previousMaster
		_ = sqlDB.Close()
	})
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.GET("/api/partner-oauth/authorization-logs", middleware.AdminAuth(), middleware.RequirePermission(authz.PartnerOAuthClientRead), GetPartnerOAuthAuthorizationLogs)
	clients := engine.Group("/api/partner-oauth/clients")
	clients.Use(middleware.AdminAuth())
	{
		clients.GET("", middleware.RequirePermission(authz.PartnerOAuthClientRead), GetPartnerOAuthClients)
		clients.POST("", middleware.RequirePermission(authz.PartnerOAuthClientSensitiveWrite), CreatePartnerOAuthClient)
		clients.PUT("/:id", middleware.RequirePermission(authz.PartnerOAuthClientSensitiveWrite), UpdatePartnerOAuthClient)
		clients.POST("/:id/secret", middleware.RequirePermission(authz.PartnerOAuthClientSensitiveWrite), RotatePartnerOAuthClientSecret)
		clients.POST("/:id/status", middleware.RequirePermission(authz.PartnerOAuthClientOperate), UpdatePartnerOAuthClientStatus)
		clients.DELETE("/:id", middleware.RequirePermission(authz.PartnerOAuthClientSensitiveWrite), DeletePartnerOAuthClient)
	}
	users := engine.Group("/api/user")
	users.Use(middleware.AdminAuth())
	{
		users.GET("/:id/partner-oauth/bindings", GetUserPartnerOAuthBindingsByAdmin)
		users.DELETE("/:id/partner-oauth/bindings/:binding_id", middleware.CriticalRateLimit(), DeleteUserPartnerOAuthBindingByAdmin)
	}
	return engine
}

func createPartnerOAuthAdminActor(t *testing.T, username string, role int) partnerOAuthAdminActor {
	t.Helper()
	user := &model.User{
		Username:    username,
		Password:    "placeholder-password",
		Role:        role,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AuthVersion: 1,
		AffCode:     username,
	}
	require.NoError(t, model.DB.Create(user).Error)
	now := time.Now().Unix()
	session := &model.UserSession{
		SID:             username + "-session",
		UserID:          user.Id,
		Version:         1,
		UserAuthVersion: 1,
		Status:          model.UserSessionStatusActive,
		RefreshHash:     username + "-refresh",
		LoginMethod:     "password",
		LastActiveAt:    now,
		ExpiresAt:       now + 3600,
	}
	require.NoError(t, model.CreateUserSession(session))
	identity := service.AuthIdentity{
		UserID:          user.Id,
		SessionID:       session.SID,
		UserAuthVersion: 1,
		SessionVersion:  1,
		LoginMethod:     "password",
	}
	token, _, err := service.IssueAccessToken(identity)
	require.NoError(t, err)
	return partnerOAuthAdminActor{user: user, identity: identity, token: token}
}

func issuePartnerOAuthAdminProof(t *testing.T, actor partnerOAuthAdminActor, rawContext string) string {
	t.Helper()
	binding, err := service.BindVerificationOperation(service.VerificationOperation{
		Scope:   service.VerificationScopePartnerOAuthClientSensitiveWrite,
		Context: []byte(rawContext),
	})
	require.NoError(t, err)
	proof, _, err := service.IssueSecurityProof(actor.identity, service.VerificationMethodPassword, binding)
	require.NoError(t, err)
	return proof
}

func partnerOAuthAdminRequest(engine http.Handler, method, path, token, proof, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	if proof != "" {
		req.Header.Set("X-Security-Proof", proof)
	}
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)
	return rec
}

func TestPartnerOAuthAdminAuthzMatrix(t *testing.T) {
	engine := setupPartnerOAuthAdminController(t)
	createBody := `{"name":"Partner App","token_auth_method":"client_secret_basic","redirect_uris":["https://assistant.example.com/oauth/callback"],"scopes":["account:read"]}`

	user := createPartnerOAuthAdminActor(t, "poa-user", common.RoleCommonUser)
	assert.Equal(t, http.StatusForbidden, partnerOAuthAdminRequest(engine, http.MethodGet, "/api/partner-oauth/clients", user.token, "", "").Code)
	assert.Equal(t, http.StatusForbidden, partnerOAuthAdminRequest(engine, http.MethodPost, "/api/partner-oauth/clients", user.token, "", createBody).Code)

	admin := createPartnerOAuthAdminActor(t, "poa-admin", common.RoleAdminUser)
	list := partnerOAuthAdminRequest(engine, http.MethodGet, "/api/partner-oauth/clients", admin.token, "", "")
	require.Equal(t, http.StatusOK, list.Code)
	assert.Contains(t, list.Body.String(), `"success":true`)

	seed, _ := createPartnerTestClient(t, model.PartnerOAuthTokenAuthMethodBasic, []string{"https://assistant.example.com/oauth/callback"})
	status := partnerOAuthAdminRequest(engine, http.MethodPost, "/api/partner-oauth/clients/"+itoa(seed.Id)+"/status", admin.token, "", `{"status":2}`)
	require.Equal(t, http.StatusOK, status.Code)

	deniedCreate := partnerOAuthAdminRequest(engine, http.MethodPost, "/api/partner-oauth/clients", admin.token, issuePartnerOAuthAdminProof(t, admin, `{"action":"create"}`), createBody)
	assert.Equal(t, http.StatusForbidden, deniedCreate.Code)
	assert.NotContains(t, deniedCreate.Body.String(), "SECURITY_PROOF")

	granted := createPartnerOAuthAdminActor(t, "poa-granted", common.RoleAdminUser)
	require.NoError(t, authz.SetUserPermissions(granted.user.Id, authz.PermissionsMap{
		authz.ResourcePartnerOAuthClient: {authz.ActionSensitiveWrite: true},
	}))
	created := partnerOAuthAdminRequest(engine, http.MethodPost, "/api/partner-oauth/clients", granted.token, issuePartnerOAuthAdminProof(t, granted, `{"action":"create"}`), createBody)
	require.Equal(t, http.StatusOK, created.Code)
	assert.Equal(t, "no-store", created.Header().Get("Cache-Control"))
	assert.Contains(t, created.Body.String(), `"client_secret":"pcs_`)

	deniedRead := createPartnerOAuthAdminActor(t, "poa-denied-read", common.RoleAdminUser)
	require.NoError(t, authz.SetUserPermissions(deniedRead.user.Id, authz.PermissionsMap{
		authz.ResourcePartnerOAuthClient: {authz.ActionRead: false},
	}))
	assert.Equal(t, http.StatusForbidden, partnerOAuthAdminRequest(engine, http.MethodGet, "/api/partner-oauth/clients", deniedRead.token, "", "").Code)

	root := createPartnerOAuthAdminActor(t, "poa-root", common.RoleRootUser)
	rootCreate := partnerOAuthAdminRequest(engine, http.MethodPost, "/api/partner-oauth/clients", root.token, issuePartnerOAuthAdminProof(t, root, `{"action":"create"}`), createBody)
	require.Equal(t, http.StatusOK, rootCreate.Code)
}

func seedPartnerBindingWithKey(t *testing.T, user *model.User, client *model.PartnerOAuthClient, key string) string {
	t.Helper()
	token := &model.Token{
		UserId:         user.Id,
		Name:           client.Name,
		Key:            key,
		Status:         common.TokenStatusEnabled,
		ExpiredTime:    time.Now().Add(24 * time.Hour).Unix(),
		UnlimitedQuota: true,
	}
	require.NoError(t, model.DB.Create(token).Error)
	var bindingID string
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		binding, err := model.CreatePartnerOAuthBindingWithTx(tx, model.PartnerOAuthBindingCreate{
			ClientId:        client.ClientId,
			UserId:          user.Id,
			UserAuthVersion: user.AuthVersion,
			Scope:           "account:read credential:read",
			ExpiresAt:       time.Now().Add(24 * time.Hour).Unix(),
			AccessTokenHash: model.HashPartnerOAuthToken("oa_" + key),
			AccessExpiresAt: time.Now().Add(time.Hour).Unix(),
		})
		if err != nil {
			return err
		}
		bindingID = binding.BindingId
		return tx.Model(binding).Update("token_id", token.Id).Error
	}))
	return bindingID
}

func TestPartnerOAuthAdminManagesUserClientBindings(t *testing.T) {
	engine := setupPartnerOAuthAdminController(t)
	client, _ := createPartnerTestClient(t, model.PartnerOAuthTokenAuthMethodBasic, []string{"https://assistant.example.com/oauth/callback"})
	owner := createPartnerOAuthAdminActor(t, "poa-owner", common.RoleCommonUser)
	other := createPartnerOAuthAdminActor(t, "poa-other", common.RoleCommonUser)
	ownerBinding := seedPartnerBindingWithKey(t, owner.user, client, "partner-key-owner-secret")
	otherBinding := seedPartnerBindingWithKey(t, other.user, client, "partner-key-other-secret")
	admin := createPartnerOAuthAdminActor(t, "poa-binding-admin", common.RoleAdminUser)
	peer := createPartnerOAuthAdminActor(t, "poa-binding-peer", common.RoleAdminUser)

	forbidden := partnerOAuthAdminRequest(engine, http.MethodGet, "/api/user/"+itoa(int64(owner.user.Id))+"/partner-oauth/bindings", owner.token, "", "")
	assert.Equal(t, http.StatusForbidden, forbidden.Code)

	peerList := partnerOAuthAdminRequest(engine, http.MethodGet, "/api/user/"+itoa(int64(peer.user.Id))+"/partner-oauth/bindings", admin.token, "", "")
	assert.Equal(t, http.StatusOK, peerList.Code)
	assert.Contains(t, peerList.Body.String(), `"success":false`)
	assert.Contains(t, peerList.Body.String(), "no permission")

	listed := partnerOAuthAdminRequest(engine, http.MethodGet, "/api/user/"+itoa(int64(owner.user.Id))+"/partner-oauth/bindings", admin.token, "", "")
	require.Equal(t, http.StatusOK, listed.Code)
	assert.Contains(t, listed.Body.String(), ownerBinding)
	assert.Contains(t, listed.Body.String(), client.Name)
	assert.NotContains(t, listed.Body.String(), otherBinding)
	assert.NotContains(t, listed.Body.String(), "partner-key-owner-secret")

	wrongUser := partnerOAuthAdminRequest(engine, http.MethodDelete, "/api/user/"+itoa(int64(other.user.Id))+"/partner-oauth/bindings/"+ownerBinding, admin.token, "", "")
	assert.Equal(t, http.StatusNotFound, wrongUser.Code)
	stored, err := model.GetPartnerOAuthBindingByBindingID(ownerBinding)
	require.NoError(t, err)
	assert.Equal(t, model.PartnerOAuthBindingStatusActive, stored.Status)

	revoked := partnerOAuthAdminRequest(engine, http.MethodDelete, "/api/user/"+itoa(int64(owner.user.Id))+"/partner-oauth/bindings/"+ownerBinding, admin.token, "", "")
	require.Equal(t, http.StatusOK, revoked.Code)
	assert.Contains(t, revoked.Body.String(), `"success":true`)

	stored, err = model.GetPartnerOAuthBindingByBindingID(ownerBinding)
	require.NoError(t, err)
	assert.Equal(t, model.PartnerOAuthBindingStatusRevoked, stored.Status)
	assert.Equal(t, service.PartnerOAuthRevokeReasonAdmin, stored.RevokedReason)
	var token model.Token
	require.NoError(t, model.DB.Where("user_id = ?", owner.user.Id).First(&token).Error)
	assert.Equal(t, common.TokenStatusDisabled, token.Status)

	peerRevoke := partnerOAuthAdminRequest(engine, http.MethodDelete, "/api/user/"+itoa(int64(peer.user.Id))+"/partner-oauth/bindings/"+ownerBinding, admin.token, "", "")
	assert.Contains(t, peerRevoke.Body.String(), "no permission")

	var failed []model.PartnerOauthAuthorizationLog
	require.NoError(t, model.LOG_DB.Where("action = ? AND success = ?", "partner_oauth.binding.admin_revoke", false).
		Find(&failed).Error)
	require.Len(t, failed, 2)
	failedByTarget := map[int]model.PartnerOauthAuthorizationLog{failed[0].TargetUserId: failed[0], failed[1].TargetUserId: failed[1]}
	assert.Equal(t, http.StatusNotFound, failedByTarget[other.user.Id].Status)
	assert.Equal(t, http.StatusOK, failedByTarget[peer.user.Id].Status)
	for _, entry := range failed {
		assert.Equal(t, admin.user.Id, entry.ActorUserId)
		assert.Equal(t, ownerBinding, entry.BindingId)
	}

	var logs []model.PartnerOauthAuthorizationLog
	require.NoError(t, model.LOG_DB.Where("action = ? AND success = ?", "partner_oauth.binding.admin_revoke", true).Find(&logs).Error)
	require.Len(t, logs, 1)
	assert.Equal(t, admin.user.Id, logs[0].ActorUserId)
	assert.Equal(t, owner.user.Id, logs[0].TargetUserId)
	assert.Equal(t, ownerBinding, logs[0].BindingId)
	assert.Equal(t, client.ClientId, logs[0].ClientId)
	encoded, err := common.Marshal(logs[0])
	require.NoError(t, err)
	assert.NotContains(t, string(encoded), "partner-key-owner-secret")
	var routeAudits []model.AuditLog
	require.NoError(t, model.LOG_DB.Where("route = ?", "/api/user/:id/partner-oauth/bindings/:binding_id").Find(&routeAudits).Error)
	assert.Empty(t, routeAudits)

	again := partnerOAuthAdminRequest(engine, http.MethodDelete, "/api/user/"+itoa(int64(owner.user.Id))+"/partner-oauth/bindings/"+ownerBinding, admin.token, "", "")
	assert.Equal(t, http.StatusNotFound, again.Code)
	remaining := partnerOAuthAdminRequest(engine, http.MethodGet, "/api/user/"+itoa(int64(other.user.Id))+"/partner-oauth/bindings", admin.token, "", "")
	require.Equal(t, http.StatusOK, remaining.Code)
	assert.Contains(t, remaining.Body.String(), otherBinding)
}

func TestPartnerOAuthAdminSecurityProofCases(t *testing.T) {
	engine := setupPartnerOAuthAdminController(t)
	root := createPartnerOAuthAdminActor(t, "poa-proof-root", common.RoleRootUser)
	createBody := `{"name":"Proof App","token_auth_method":"client_secret_basic","redirect_uris":["https://assistant.example.com/oauth/callback"],"scopes":["account:read"]}`
	client, _ := createPartnerTestClient(t, model.PartnerOAuthTokenAuthMethodBasic, []string{"https://assistant.example.com/oauth/callback"})
	other, _ := createPartnerTestClient(t, model.PartnerOAuthTokenAuthMethodBasic, []string{"https://other.example.com/oauth/callback"})
	updateBody := `{"name":"Renamed","redirect_uris":["https://assistant.example.com/oauth/callback"],"scopes":["account:read"]}`
	clientPath := "/api/partner-oauth/clients/" + itoa(client.Id)

	missing := partnerOAuthAdminRequest(engine, http.MethodPut, clientPath, root.token, "", updateBody)
	assert.Equal(t, http.StatusForbidden, missing.Code)
	assert.Contains(t, missing.Body.String(), "SECURITY_PROOF_REQUIRED")

	expiredProof := issuePartnerOAuthAdminProof(t, root, `{"action":"update","client_id":"`+client.ClientId+`"}`)
	require.NoError(t, model.DB.Model(&model.AuthFlow{}).Where("purpose = ?", model.AuthFlowPurposeSecurityProof).Update("expires_at", time.Now().Add(-time.Minute)).Error)
	expired := partnerOAuthAdminRequest(engine, http.MethodPut, clientPath, root.token, expiredProof, updateBody)
	assert.Equal(t, http.StatusForbidden, expired.Code)
	assert.Contains(t, expired.Body.String(), "SECURITY_PROOF_EXPIRED")

	reuseProof := issuePartnerOAuthAdminProof(t, root, `{"action":"update","client_id":"`+client.ClientId+`"}`)
	first := partnerOAuthAdminRequest(engine, http.MethodPut, clientPath, root.token, reuseProof, updateBody)
	require.Equal(t, http.StatusOK, first.Code)
	reused := partnerOAuthAdminRequest(engine, http.MethodPut, clientPath, root.token, reuseProof, updateBody)
	assert.Equal(t, http.StatusForbidden, reused.Code)
	assert.Contains(t, reused.Body.String(), "SECURITY_PROOF_CONSUMED")

	wrongClient := issuePartnerOAuthAdminProof(t, root, `{"action":"update","client_id":"`+other.ClientId+`"}`)
	mismatch := partnerOAuthAdminRequest(engine, http.MethodPut, clientPath, root.token, wrongClient, updateBody)
	assert.Equal(t, http.StatusForbidden, mismatch.Code)
	assert.Contains(t, mismatch.Body.String(), "SECURITY_PROOF_CONTEXT_MISMATCH")

	wrongAction := issuePartnerOAuthAdminProof(t, root, `{"action":"delete","client_id":"`+client.ClientId+`"}`)
	actionMismatch := partnerOAuthAdminRequest(engine, http.MethodPut, clientPath, root.token, wrongAction, updateBody)
	assert.Equal(t, http.StatusForbidden, actionMismatch.Code)
	assert.Contains(t, actionMismatch.Body.String(), "SECURITY_PROOF_CONTEXT_MISMATCH")

	keptProof := issuePartnerOAuthAdminProof(t, root, `{"action":"create"}`)
	invalid := partnerOAuthAdminRequest(engine, http.MethodPost, "/api/partner-oauth/clients", root.token, keptProof, `{"name":"","token_auth_method":"client_secret_basic","redirect_uris":["https://assistant.example.com/oauth/callback"],"scopes":["account:read"]}`)
	assert.Equal(t, http.StatusBadRequest, invalid.Code)
	retry := partnerOAuthAdminRequest(engine, http.MethodPost, "/api/partner-oauth/clients", root.token, keptProof, createBody)
	require.Equal(t, http.StatusOK, retry.Code)
	assert.Contains(t, retry.Body.String(), `"client_secret":"pcs_`)
}

func TestPartnerOauthAuthorizationLogReadPermissionAndFilters(t *testing.T) {
	engine := setupPartnerOAuthAdminController(t)
	client, _ := createPartnerTestClient(t, model.PartnerOAuthTokenAuthMethodNone, []string{"http://127.0.0.1/oauth/callback"})
	owner := createPartnerOAuthAdminActor(t, "log-owner", common.RoleCommonUser)
	admin := createPartnerOAuthAdminActor(t, "log-admin", common.RoleAdminUser)
	denied := createPartnerOAuthAdminActor(t, "log-denied", common.RoleAdminUser)
	require.NoError(t, authz.SetUserPermissions(denied.user.Id, authz.PermissionsMap{
		authz.ResourcePartnerOAuthClient: {authz.ActionRead: false},
	}))
	base := "/api/partner-oauth/authorization-logs"
	for _, actor := range []partnerOAuthAdminActor{owner, denied} {
		resp := partnerOAuthAdminRequest(engine, http.MethodGet, base, actor.token, "", "")
		assert.Equal(t, http.StatusForbidden, resp.Code)
		assert.NotContains(t, resp.Body.String(), "log-owner")
	}
	initial := partnerOAuthAdminRequest(engine, http.MethodGet, base, admin.token, "", "")
	require.Equal(t, http.StatusOK, initial.Code)
	assert.Contains(t, initial.Body.String(), `"items":[]`)
	for _, action := range []string{"partner_oauth.consent.approve", "partner_oauth.consent.deny"} {
		model.RecordPartnerOAuthAuthorizationLog(nil, model.PartnerOauthAuthorizationLog{Action: action, Success: action == "partner_oauth.consent.approve",
			ClientId: client.ClientId, ActorUserId: owner.user.Id, TargetUserId: owner.user.Id, Status: 200})
	}
	filtered := partnerOAuthAdminRequest(engine, http.MethodGet, base+"?page=1&page_size=1&success=true&client_id="+client.ClientId+
		"&target_user_id="+strconv.Itoa(owner.user.Id)+"&action=partner_oauth.consent.approve", admin.token, "", "")
	require.Equal(t, http.StatusOK, filtered.Code)
	var result struct {
		Data struct {
			Items []model.PartnerOauthAuthorizationLog `json:"items"`
			Total int64                                `json:"total"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(filtered.Body.Bytes(), &result))
	assert.Equal(t, int64(1), result.Data.Total)
	require.Len(t, result.Data.Items, 1)
	assert.Equal(t, "partner_oauth.consent.approve", result.Data.Items[0].Action)
	page2 := partnerOAuthAdminRequest(engine, http.MethodGet, base+"?page=2&page_size=1", admin.token, "", "")
	require.Equal(t, http.StatusOK, page2.Code)
	assert.Contains(t, page2.Body.String(), `"total":2`)
	for _, invalid := range []string{"?page_size=101", "?page=0", "?success=maybe", "?client_id=sk-secret", "?start=5&end=4", "?target_user_id=0", "?action=partner_oauth.client.delete", "?page=1&page=2"} {
		resp := partnerOAuthAdminRequest(engine, http.MethodGet, base+invalid, admin.token, "", "")
		assert.Equal(t, http.StatusBadRequest, resp.Code, invalid)
	}
}

func TestPartnerOAuthClientDeleteLogsAffectedBindingsOnly(t *testing.T) {
	engine := setupPartnerOAuthAdminController(t)
	client, _ := createPartnerTestClient(t, model.PartnerOAuthTokenAuthMethodBasic, []string{"https://assistant.example.com/oauth/callback"})
	owner := createPartnerOAuthAdminActor(t, "deleted-client-owner", common.RoleCommonUser)
	root := createPartnerOAuthAdminActor(t, "deleted-client-root", common.RoleRootUser)
	bindingID := seedPartnerBindingWithKey(t, owner.user, client, "deleted-client-secret-key")
	proof := issuePartnerOAuthAdminProof(t, root, `{"action":"delete","client_id":"`+client.ClientId+`"}`)
	resp := partnerOAuthAdminRequest(engine, http.MethodDelete, "/api/partner-oauth/clients/"+itoa(client.Id), root.token, proof, "")
	require.Equal(t, http.StatusOK, resp.Code)
	var logs []model.PartnerOauthAuthorizationLog
	require.NoError(t, model.LOG_DB.Find(&logs).Error)
	require.Len(t, logs, 1)
	assert.Equal(t, "partner_oauth.binding.client_delete", logs[0].Action)
	assert.Equal(t, bindingID, logs[0].BindingId)
	assert.Equal(t, owner.user.Id, logs[0].TargetUserId)
	var audits []model.AuditLog
	require.NoError(t, model.LOG_DB.Find(&audits).Error)
	require.Len(t, audits, 1)
	assert.Equal(t, "partner_oauth.client.delete", audits[0].Action)
	encoded, err := common.Marshal(logs)
	require.NoError(t, err)
	assert.NotContains(t, string(encoded), "deleted-client-secret-key")
}

func itoa(id int64) string {
	return strconv.FormatInt(id, 10)
}
