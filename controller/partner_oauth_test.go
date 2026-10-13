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
		&model.AuditLog{},
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
		&model.AuditLog{},
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

func itoa(id int64) string {
	return strconv.FormatInt(id, 10)
}
