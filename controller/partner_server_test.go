package controller

import (
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"

	"github.com/Calcium-Ion/go-epay/epay"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var partnerServerTestModels = []any{
	&model.PartnerServerConfig{}, &model.PartnerServerSecret{}, &model.PartnerServerToken{},
	&model.PartnerAccount{}, &model.PartnerAccountPaymentOrder{},
	&model.WalletRefundCreditEvent{}, &model.UserAccessToken{}, &model.Log{},
}

// setupPartnerServerController extends the partner OAuth test engine with a
// protected probe route. A middleware in front of every route sets a
// wildcard CORS header, standing in for the engine-wide CORS of production.
func setupPartnerServerController(t *testing.T) *gin.Engine {
	t.Helper()
	engine := setupPartnerOAuthController(t)
	require.NoError(t, model.DB.AutoMigrate(partnerServerTestModels...))
	engine.Use(func(c *gin.Context) { c.Header("Access-Control-Allow-Origin", "*") })
	engine.GET("/api/partner/v1/probe", middleware.PartnerServerBearer(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"client_id": middleware.PartnerServerPrincipalFrom(c).Partner.ClientId})
	})
	engine.GET("/api/partner/v1/limited", middleware.PartnerServerBearer(), middleware.PartnerServerRateLimit("PSV-TEST", 1, "partner_account.credential_rate_limited"), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	// Mirrors router.SetPartnerServerRouter (router imports this package).
	accounts := engine.Group("/api/partner/v1/accounts/:external_user_id", middleware.PartnerServerBearer())
	accounts.GET("", PartnerServerGetAccount)
	accounts.POST("/credential", PartnerServerIssueCredential)
	accounts.POST("/credential/rotate", PartnerServerRotateCredential)
	accounts.POST("/disable", PartnerServerDisableAccount)
	accounts.POST("/enable", PartnerServerEnableAccount)
	accounts.GET("/usage", PartnerServerAccountUsage)
	previousRunner := service.PartnerServerJobRunner
	service.PartnerServerJobRunner = func(task func()) { task() }
	t.Cleanup(func() { service.PartnerServerJobRunner = previousRunner })
	return engine
}

type partnerServerFixture struct {
	client      *model.PartnerOAuthClient
	oauthSecret string
	secret      string
	secretID    int64
}

func seedPartnerServerFixture(t *testing.T, allowlist string) partnerServerFixture {
	t.Helper()
	client, oauthSecret := createPartnerTestClient(t, model.PartnerOAuthTokenAuthMethodBasic, []string{"https://partner.example.com/oauth/callback"})
	require.NoError(t, model.SavePartnerServerConfig(&model.PartnerServerConfig{
		ClientId: client.ClientId, Enabled: true, AccountGroup: "default", IPAllowlist: allowlist,
		MaxAccounts: model.PartnerServerDefaultMaxAccounts, AccountsPerMinute: model.PartnerServerDefaultAccountsPerMinute,
	}))
	secret, err := service.GeneratePartnerServerSecret()
	require.NoError(t, err)
	stored, err := model.CreatePartnerServerSecret(client.ClientId, model.HashPartnerOAuthSecret(secret))
	require.NoError(t, err)
	service.InvalidatePartnerServerSnapshot(client.ClientId)
	return partnerServerFixture{client: client, oauthSecret: oauthSecret, secret: secret, secretID: stored.Id}
}

func partnerServerTokenRequest(engine http.Handler, clientID, secret, form, remoteIP string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/oauth/token", strings.NewReader(form))
	req.Host = "localhost:3000"
	req.RemoteAddr = remoteIP + ":40000"
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte(url.QueryEscape(clientID)+":"+url.QueryEscape(secret))))
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)
	return rec
}

func partnerServerGet(engine http.Handler, path, token, remoteIP string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	req.Host = "localhost:3000"
	req.RemoteAddr = remoteIP + ":40000"
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)
	return rec
}

func issuePartnerServerTestToken(t *testing.T, engine http.Handler, fixture partnerServerFixture) string {
	t.Helper()
	rec := partnerServerTokenRequest(engine, fixture.client.ClientId, fixture.secret, "grant_type=client_credentials", "203.0.113.10")
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var body service.PartnerServerTokenResponse
	require.NoError(t, common.Unmarshal(rec.Body.Bytes(), &body))
	return body.AccessToken
}

func partnerServerLogs(t *testing.T, action string) []model.PartnerOauthAuthorizationLog {
	t.Helper()
	var logs []model.PartnerOauthAuthorizationLog
	require.NoError(t, model.LOG_DB.Where("action = ?", action).Find(&logs).Error)
	return logs
}

func TestPartnerServerClientCredentialsIssueAndUse(t *testing.T) {
	engine := setupPartnerServerController(t)
	fixture := seedPartnerServerFixture(t, "")

	rec := partnerServerTokenRequest(engine, fixture.client.ClientId, fixture.secret, "grant_type=client_credentials&scope=partner%3Aaccounts", "203.0.113.10")
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Empty(t, rec.Header().Get("Access-Control-Allow-Origin"), "server token responses carry no CORS headers")
	assert.Equal(t, "no-store", rec.Header().Get("Cache-Control"))
	var body service.PartnerServerTokenResponse
	require.NoError(t, common.Unmarshal(rec.Body.Bytes(), &body))
	assert.True(t, strings.HasPrefix(body.AccessToken, "pst_"))
	assert.Equal(t, "Bearer", body.TokenType)
	assert.Equal(t, 3600, body.ExpiresIn)
	assert.Equal(t, service.PartnerServerScope, body.Scope)
	assert.Len(t, partnerServerLogs(t, "partner_server.token_issue"), 1, "successful issues are audited")

	probe := partnerServerGet(engine, "/api/partner/v1/probe", body.AccessToken, "198.51.100.7")
	require.Equal(t, http.StatusOK, probe.Code, probe.Body.String())
	assert.Contains(t, probe.Body.String(), fixture.client.ClientId)
	assert.Equal(t, http.StatusBadRequest, partnerServerGet(engine, "/api/partner/v1/probe?access_token="+body.AccessToken, body.AccessToken, "198.51.100.7").Code)

	bad := partnerServerTokenRequest(engine, fixture.client.ClientId, fixture.secret, "grant_type=client_credentials&scope=account%3Aread", "203.0.113.10")
	assert.Equal(t, http.StatusBadRequest, bad.Code)
	assert.Contains(t, bad.Body.String(), "invalid_scope")
}

func TestPartnerServerClientCredentialsRefusals(t *testing.T) {
	tests := []struct {
		name     string
		allow    string
		prepare  func(t *testing.T, f partnerServerFixture)
		clientID func(f partnerServerFixture) string
		secret   func(f partnerServerFixture) string
		reason   string
	}{
		{name: "wrong secret", secret: func(partnerServerFixture) string { return "pss_" + strings.Repeat("0", 64) }, reason: service.PartnerServerReasonInvalidSecret},
		{name: "oauth client secret is not a server secret", secret: func(f partnerServerFixture) string { return f.oauthSecret }, reason: service.PartnerServerReasonInvalidSecret},
		{name: "revoked secret", prepare: func(t *testing.T, f partnerServerFixture) {
			require.NoError(t, model.RevokePartnerServerSecret(f.client.ClientId, f.secretID))
		}, reason: service.PartnerServerReasonInvalidSecret},
		{name: "client disabled", prepare: func(t *testing.T, f partnerServerFixture) {
			f.client.Status = model.PartnerOAuthClientStatusDisabled
			require.NoError(t, model.UpdatePartnerOAuthClient(f.client))
		}, reason: service.PartnerServerReasonUnavailable},
		{name: "server access switched off", prepare: func(t *testing.T, f partnerServerFixture) {
			require.NoError(t, model.SavePartnerServerConfig(&model.PartnerServerConfig{ClientId: f.client.ClientId, AccountGroup: "default", MaxAccounts: 1, AccountsPerMinute: 1}))
		}, reason: service.PartnerServerReasonUnavailable},
		{name: "partner suspended", prepare: func(t *testing.T, f partnerServerFixture) {
			_, err := model.SetPartnerOAuthClientStatus(f.client.ClientId, model.PartnerOAuthClientStatusDisabled)
			require.NoError(t, err)
		}, reason: service.PartnerServerReasonUnavailable},
		{name: "address not allowed", allow: `["192.0.2.0/24"]`, reason: service.PartnerServerReasonIPNotAllowed},
		{name: "unknown client is not audited", clientID: func(partnerServerFixture) string { return "pc_" + strings.Repeat("f", 32) }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			engine := setupPartnerServerController(t)
			fixture := seedPartnerServerFixture(t, tt.allow)
			if tt.prepare != nil {
				tt.prepare(t, fixture)
			}
			clientID, secret := fixture.client.ClientId, fixture.secret
			if tt.clientID != nil {
				clientID = tt.clientID(fixture)
			}
			if tt.secret != nil {
				secret = tt.secret(fixture)
			}
			rec := partnerServerTokenRequest(engine, clientID, secret, "grant_type=client_credentials", "203.0.113.10")
			assert.Equal(t, http.StatusUnauthorized, rec.Code)
			assert.Contains(t, rec.Body.String(), `"invalid_client"`, "every failure looks the same")
			assert.Equal(t, `Basic realm="oauth"`, rec.Header().Get("WWW-Authenticate"))
			logs := partnerServerLogs(t, "partner_server.token_issue_failed")
			if tt.reason == "" {
				assert.Empty(t, logs)
				return
			}
			require.Len(t, logs, 1)
			assert.Equal(t, tt.reason, logs[0].Reason)
			assert.False(t, logs[0].Success)
		})
	}
}

func TestPartnerServerSecretsAndTokensStayInTheirLane(t *testing.T) {
	engine := setupPartnerServerController(t)
	fixture := seedPartnerServerFixture(t, "")

	refresh := partnerServerTokenRequest(engine, fixture.client.ClientId, fixture.secret, "grant_type=refresh_token&refresh_token=or_x", "203.0.113.10")
	assert.Equal(t, http.StatusUnauthorized, refresh.Code, "a server secret cannot authenticate OAuth grants")

	serverToken := issuePartnerServerTestToken(t, engine, fixture)
	integration := partnerServerGet(engine, "/api/integrations/v1/account", serverToken, "203.0.113.10")
	assert.Equal(t, http.StatusUnauthorized, integration.Code, "server tokens are not OAuth access tokens")

	user := &model.User{Username: "partner-lane-user", Password: "unused", Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1}
	require.NoError(t, model.DB.Create(user).Error)
	seedPartnerPaymentBinding(t, user, fixture.client, "account:read", "oa_partner_lane_access")
	require.Equal(t, http.StatusOK, partnerServerGet(engine, "/api/integrations/v1/account", "oa_partner_lane_access", "203.0.113.10").Code)
	probe := partnerServerGet(engine, "/api/partner/v1/probe", "oa_partner_lane_access", "203.0.113.10")
	assert.Equal(t, http.StatusUnauthorized, probe.Code, "OAuth access tokens are not server tokens")
}

func TestPartnerServerBearerFollowsRevocationAndAllowlist(t *testing.T) {
	engine := setupPartnerServerController(t)
	fixture := seedPartnerServerFixture(t, `["203.0.113.0/24"]`)
	token := issuePartnerServerTestToken(t, engine, fixture)
	require.Equal(t, http.StatusOK, partnerServerGet(engine, "/api/partner/v1/probe", token, "203.0.113.99").Code)

	denied := partnerServerGet(engine, "/api/partner/v1/probe", token, "198.51.100.7")
	assert.Equal(t, http.StatusUnauthorized, denied.Code, "a stolen token is useless from another address")
	assert.Equal(t, http.StatusUnauthorized, partnerServerGet(engine, "/api/partner/v1/probe", token, "198.51.100.8").Code)
	auditDenied := partnerServerLogs(t, "partner_server.auth_denied")
	require.Len(t, auditDenied, 1, "refusals are audited at most once a minute per reason")
	assert.Equal(t, service.PartnerServerReasonIPNotAllowed, auditDenied[0].Reason)

	require.NoError(t, model.RevokePartnerServerSecret(fixture.client.ClientId, fixture.secretID))
	service.InvalidatePartnerServerSnapshot(fixture.client.ClientId)
	assert.Equal(t, http.StatusUnauthorized, partnerServerGet(engine, "/api/partner/v1/probe", token, "203.0.113.99").Code,
		"revoking the secret kills its tokens on the next request")
}

func TestPartnerServerRateLimitAuditsRefusal(t *testing.T) {
	engine := setupPartnerServerController(t)
	fixture := seedPartnerServerFixture(t, "")
	token := issuePartnerServerTestToken(t, engine, fixture)
	assert.Equal(t, http.StatusNoContent, partnerServerGet(engine, "/api/partner/v1/limited", token, "203.0.113.10").Code)
	limited := partnerServerGet(engine, "/api/partner/v1/limited", token, "203.0.113.10")
	assert.Equal(t, http.StatusTooManyRequests, limited.Code)
	logs := partnerServerLogs(t, "partner_account.credential_rate_limited")
	require.Len(t, logs, 1)
	assert.Equal(t, "rate_limited", logs[0].Reason)
}

func TestPartnerServerAdminConfigAndSecrets(t *testing.T) {
	engine := setupPartnerOAuthAdminController(t)
	require.NoError(t, model.DB.AutoMigrate(partnerServerTestModels...))
	previousRatios := ratio_setting.GroupRatio2JSONString()
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"partner_kede":1}`))
	t.Cleanup(func() { _ = ratio_setting.UpdateGroupRatioByJSONString(previousRatios) })
	clients := engine.Group("/api/partner-oauth/clients")
	clients.Use(middleware.AdminAuth())
	clients.GET("/:id/server", middleware.RequirePermission(authz.PartnerOAuthClientRead), GetPartnerServerConfig)
	clients.PUT("/:id/server", middleware.RequirePermission(authz.PartnerOAuthClientSensitiveWrite), UpdatePartnerServerConfig)
	clients.POST("/:id/server-secrets", middleware.RequirePermission(authz.PartnerOAuthClientSensitiveWrite), CreatePartnerServerSecret)
	clients.DELETE("/:id/server-secrets/:secret_id", middleware.RequirePermission(authz.PartnerOAuthClientSensitiveWrite), RevokePartnerServerSecret)

	root := createPartnerOAuthAdminActor(t, "partner-server-root", common.RoleRootUser)
	client, _ := createPartnerTestClient(t, model.PartnerOAuthTokenAuthMethodBasic, []string{"https://partner.example.com/oauth/callback"})
	base := "/api/partner-oauth/clients/" + strconv.FormatInt(client.Id, 10)
	updateProof := func() string {
		return issuePartnerOAuthAdminProof(t, root, `{"action":"update_server","client_id":"`+client.ClientId+`"}`)
	}
	issueProof := func() string {
		return issuePartnerOAuthAdminProof(t, root, `{"action":"issue_server_secret","client_id":"`+client.ClientId+`"}`)
	}

	early := partnerOAuthAdminRequest(engine, http.MethodPost, base+"/server-secrets", root.token, issueProof(), "")
	assertConsoleFailure(t, early, "Save the server access settings before issuing a secret.")

	for body, message := range map[string]string{
		`{"enabled":true,"account_group":"missing","ip_allowlist":[],"max_accounts":10,"accounts_per_minute":1}`:                 "Select an existing user group",
		`{"enabled":true,"account_group":"partner_kede","ip_allowlist":["not-an-ip"],"max_accounts":10,"accounts_per_minute":1}`: "Enter IP addresses or CIDR ranges, one per line",
		`{"enabled":true,"account_group":"partner_kede","ip_allowlist":[],"max_accounts":0,"accounts_per_minute":1}`:             "The sub-account limit must be between 1 and 1000000",
	} {
		assertConsoleFailure(t, partnerOAuthAdminRequest(engine, http.MethodPut, base+"/server", root.token, updateProof(), body), message)
	}
	assert.Equal(t, http.StatusForbidden, partnerOAuthAdminRequest(engine, http.MethodPut, base+"/server", root.token, "",
		`{"enabled":true,"account_group":"partner_kede","ip_allowlist":[],"max_accounts":10,"accounts_per_minute":1}`).Code, "config writes need a security proof")

	saved := partnerOAuthAdminRequest(engine, http.MethodPut, base+"/server", root.token, updateProof(),
		`{"enabled":true,"account_group":"partner_kede","ip_allowlist":["203.0.113.5","2001:db8::/32"],"max_accounts":100000,"accounts_per_minute":60}`)
	require.Equal(t, http.StatusOK, saved.Code, saved.Body.String())
	assert.Contains(t, saved.Body.String(), `"203.0.113.5/32"`)

	var secretIDs []int64
	for range 2 {
		rec := partnerOAuthAdminRequest(engine, http.MethodPost, base+"/server-secrets", root.token, issueProof(), "")
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		assert.Contains(t, rec.Body.String(), `"value":"pss_`)
		var resp struct {
			Data struct {
				Secret partnerServerSecretView `json:"secret"`
			} `json:"data"`
		}
		require.NoError(t, common.Unmarshal(rec.Body.Bytes(), &resp))
		secretIDs = append(secretIDs, resp.Data.Secret.Id)
	}
	third := partnerOAuthAdminRequest(engine, http.MethodPost, base+"/server-secrets", root.token, issueProof(), "")
	assertConsoleFailure(t, third, "Revoke an existing secret first; at most two can be active")

	view := partnerOAuthAdminRequest(engine, http.MethodGet, base+"/server", root.token, "", "")
	require.Equal(t, http.StatusOK, view.Code)
	assert.NotContains(t, view.Body.String(), "pss_", "secrets are shown once")

	revokeProof := issuePartnerOAuthAdminProof(t, root, `{"action":"revoke_server_secret","client_id":"`+client.ClientId+`","secret_id":`+strconv.FormatInt(secretIDs[0], 10)+`}`)
	revoked := partnerOAuthAdminRequest(engine, http.MethodDelete, base+"/server-secrets/"+strconv.FormatInt(secretIDs[0], 10), root.token, revokeProof, "")
	require.Equal(t, http.StatusOK, revoked.Code, revoked.Body.String())
	assert.Len(t, partnerServerLogs(t, "partner_server.secret_issue"), 2)
	assert.Len(t, partnerServerLogs(t, "partner_server.secret_revoke"), 1)
}

const partnerServerTestUser = "kede-user-0000000000000000000000001"

func partnerServerPost(engine http.Handler, path, token, body string, headers map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	req.Host = "localhost:3000"
	req.RemoteAddr = "203.0.113.10:40000"
	req.Header.Set("Authorization", "Bearer "+token)
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	for name, value := range headers {
		req.Header.Set(name, value)
	}
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)
	return rec
}

func decodePartnerCredential(t *testing.T, rec *httptest.ResponseRecorder) service.PartnerAccountCredentialView {
	t.Helper()
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var view service.PartnerAccountCredentialView
	require.NoError(t, common.Unmarshal(rec.Body.Bytes(), &view))
	return view
}

func assertPartnerError(t *testing.T, rec *httptest.ResponseRecorder, status int, code string) {
	t.Helper()
	assert.Equal(t, status, rec.Code, rec.Body.String())
	assert.Contains(t, rec.Body.String(), `"code":"`+code+`"`)
}

func TestPartnerServerAccountLifecycle(t *testing.T) {
	engine := setupPartnerServerController(t)
	fixture := seedPartnerServerFixture(t, "")
	token := issuePartnerServerTestToken(t, engine, fixture)
	base := "/api/partner/v1/accounts/" + partnerServerTestUser

	assertPartnerError(t, partnerServerGet(engine, base, token, "203.0.113.10"), http.StatusNotFound, "account_not_found")
	assertPartnerError(t, partnerServerGet(engine, "/api/partner/v1/accounts/too-short", token, "203.0.113.10"), http.StatusBadRequest, "invalid_external_user_id")
	count, err := model.CountPartnerAccounts(fixture.client.ClientId)
	require.NoError(t, err)
	assert.Zero(t, count, "lookups never create accounts")

	assertPartnerError(t, partnerServerPost(engine, base+"/credential", token, `{"extra":1}`, nil), http.StatusBadRequest, "invalid_request")
	first := decodePartnerCredential(t, partnerServerPost(engine, base+"/credential", token, "{}", nil))
	assert.True(t, strings.HasPrefix(first.APIKey, "sk-"))
	assert.Equal(t, "http://localhost:3000/v1", first.BaseURL)
	assert.Equal(t, partnerServerTestUser, first.ExternalUserID)
	again := decodePartnerCredential(t, partnerServerPost(engine, base+"/credential", token, "", nil))
	assert.Equal(t, first.APIKey, again.APIKey, "the key can be fetched again")
	assert.Len(t, partnerServerLogs(t, "partner_account.create"), 1)
	assert.Len(t, partnerServerLogs(t, "partner_account.credential_issue"), 1)

	account := partnerServerGet(engine, base, token, "203.0.113.10")
	require.Equal(t, http.StatusOK, account.Code)
	var view service.PartnerAccountView
	require.NoError(t, common.Unmarshal(account.Body.Bytes(), &view))
	assert.Equal(t, first.AccountID, view.AccountID)
	assert.Zero(t, view.Quota)
	assert.Equal(t, model.PartnerAccountStatusActive, view.Status)

	other := seedPartnerServerFixture(t, "")
	otherToken := issuePartnerServerTestToken(t, engine, other)
	assertPartnerError(t, partnerServerGet(engine, base, otherToken, "203.0.113.10"), http.StatusNotFound, "account_not_found")
}

func TestPartnerServerRotationOverHTTP(t *testing.T) {
	engine := setupPartnerServerController(t)
	fixture := seedPartnerServerFixture(t, "")
	token := issuePartnerServerTestToken(t, engine, fixture)
	base := "/api/partner/v1/accounts/" + partnerServerTestUser
	first := decodePartnerCredential(t, partnerServerPost(engine, base+"/credential", token, "{}", nil))

	assertPartnerError(t, partnerServerPost(engine, base+"/credential/rotate", token, "{}", nil), http.StatusBadRequest, "invalid_request")
	key := map[string]string{"Idempotency-Key": "rotate-0000000000000001"}
	graced := decodePartnerCredential(t, partnerServerPost(engine, base+"/credential/rotate", token, "{}", key))
	assert.NotEqual(t, first.APIKey, graced.APIKey)
	require.NotNil(t, graced.OldKeyExpiresAt, "a graced rotation reports when the old key stops")
	replay := decodePartnerCredential(t, partnerServerPost(engine, base+"/credential/rotate", token, "", key))
	assert.Equal(t, graced.APIKey, replay.APIKey, "retrying with the same key does not rotate again")
	assertPartnerError(t, partnerServerPost(engine, base+"/credential/rotate", token, `{"revoke_old":"immediately"}`, key), http.StatusConflict, "idempotency_conflict")
	assertPartnerError(t, partnerServerPost(engine, base+"/credential/rotate", token, `{"revoke_old":"later"}`, map[string]string{"Idempotency-Key": "rotate-0000000000000002"}), http.StatusBadRequest, "invalid_request")

	now := decodePartnerCredential(t, partnerServerPost(engine, base+"/credential/rotate", token, `{"revoke_old":"immediately"}`, map[string]string{"Idempotency-Key": "rotate-0000000000000003"}))
	assert.Nil(t, now.OldKeyExpiresAt)
	logs := partnerServerLogs(t, "partner_account.credential_rotate")
	require.Len(t, logs, 2, "replays are not audited again")
	assert.Equal(t, service.PartnerAccountRevokeAfterGrace, logs[0].Reason)
	assert.Equal(t, service.PartnerAccountRevokeImmediately, logs[1].Reason)

	assertPartnerError(t, partnerServerPost(engine, "/api/partner/v1/accounts/kede-unknown-00000000000000000000000/credential/rotate", token, "{}", map[string]string{"Idempotency-Key": "rotate-0000000000000004"}), http.StatusNotFound, "account_not_found")
}

func TestPartnerServerAccountDisableAndAdminPrecedence(t *testing.T) {
	engine := setupPartnerServerController(t)
	fixture := seedPartnerServerFixture(t, "")
	token := issuePartnerServerTestToken(t, engine, fixture)
	base := "/api/partner/v1/accounts/" + partnerServerTestUser
	decodePartnerCredential(t, partnerServerPost(engine, base+"/credential", token, "{}", nil))
	account, err := model.GetPartnerAccount(fixture.client.ClientId, partnerServerTestUser)
	require.NoError(t, err)

	require.Equal(t, http.StatusOK, partnerServerPost(engine, base+"/disable", token, "", nil).Code)
	user, err := model.GetUserById(account.UserId, true)
	require.NoError(t, err)
	assert.Equal(t, common.UserStatusDisabled, user.Status)
	assertPartnerError(t, partnerServerPost(engine, base+"/credential", token, "{}", nil), http.StatusForbidden, "account_disabled")

	require.Equal(t, http.StatusOK, partnerServerPost(engine, base+"/enable", token, "", nil).Code)
	decodePartnerCredential(t, partnerServerPost(engine, base+"/credential", token, "{}", nil))

	_, _, err = model.SetPartnerAccountAdminDisabled(account.UserId, true)
	require.NoError(t, err)
	assertPartnerError(t, partnerServerPost(engine, base+"/enable", token, "", nil), http.StatusForbidden, "account_disabled_by_admin")
	assert.Len(t, partnerServerLogs(t, "partner_account.disable"), 1)
	assert.Len(t, partnerServerLogs(t, "partner_account.enable"), 1)
}

func TestAdminCannotGivePartnerSubAccountAPassword(t *testing.T) {
	engine := setupPartnerServerController(t)
	fixture := seedPartnerServerFixture(t, "")
	token := issuePartnerServerTestToken(t, engine, fixture)
	decodePartnerCredential(t, partnerServerPost(engine, "/api/partner/v1/accounts/"+partnerServerTestUser+"/credential", token, "{}", nil))
	account, err := model.GetPartnerAccount(fixture.client.ClientId, partnerServerTestUser)
	require.NoError(t, err)
	user, err := model.GetUserById(account.UserId, true)
	require.NoError(t, err)

	probe := model.User{Username: user.Username, Password: "any-password-1"}
	assert.ErrorIs(t, probe.ValidateAndFill(), model.ErrInvalidCredentials, "password sign-in cannot reach a sub-account")

	body := `{"id":` + strconv.Itoa(user.Id) + `,"username":"` + user.Username + `","password":"new-password-123","display_name":"x","group":"default"}`
	ctx, rec := newAdminUpdateContext(t, body)
	UpdateUser(ctx)
	assert.Contains(t, rec.Body.String(), `"success":false`)
	stored, err := model.GetUserById(user.Id, true)
	require.NoError(t, err)
	assert.Empty(t, stored.Password)
}

func newAdminUpdateContext(t *testing.T, body string) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodPut, "/api/user/", strings.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set("id", 1)
	ctx.Set("role", common.RoleRootUser)
	return ctx, rec
}

func TestPartnerSuspensionThroughClientStatus(t *testing.T) {
	engine := setupPartnerOAuthAdminController(t)
	require.NoError(t, model.DB.AutoMigrate(partnerServerTestModels...))
	previousRunner := service.PartnerServerJobRunner
	service.PartnerServerJobRunner = func(task func()) { task() }
	t.Cleanup(func() { service.PartnerServerJobRunner = previousRunner })
	root := createPartnerOAuthAdminActor(t, "partner-suspend-root", common.RoleRootUser)
	fixture := seedPartnerServerFixture(t, "")
	issued, err := model.IssuePartnerAccountCredential(model.PartnerAccountOwner{ClientId: fixture.client.ClientId, ExternalUserId: partnerServerTestUser, DisplayName: "Kede"},
		model.PartnerAccountKey{Key: strings.Repeat("k", 48), Name: "partner:Kede"})
	require.NoError(t, err)
	account := issued.Account

	status := func(value int) {
		rec := partnerOAuthAdminRequest(engine, http.MethodPost, "/api/partner-oauth/clients/"+strconv.FormatInt(fixture.client.Id, 10)+"/status", root.token, "", `{"status":`+strconv.Itoa(value)+`}`)
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	}
	status(model.PartnerOAuthClientStatusDisabled)
	user, err := model.GetUserById(account.UserId, true)
	require.NoError(t, err)
	assert.Equal(t, common.UserStatusDisabled, user.Status, "suspending the partner disables its sub-accounts")
	config, err := model.GetPartnerServerConfig(fixture.client.ClientId)
	require.NoError(t, err)
	assert.NotZero(t, config.SuspendedAt)

	status(model.PartnerOAuthClientStatusEnabled)
	user, err = model.GetUserById(account.UserId, true)
	require.NoError(t, err)
	assert.Equal(t, common.UserStatusEnabled, user.Status, "resuming restores them")
	assert.Len(t, partnerServerLogs(t, "partner_server.suspend"), 1)
	assert.Len(t, partnerServerLogs(t, "partner_server.resume"), 1)
	assert.Equal(t, service.PartnerServerJobProgress{Processed: 1}, service.GetPartnerServerJobProgress(service.PartnerServerJobSuspension, fixture.client.ClientId))
}

// fakeZPay stands in for the gateway's mapi.php over TLS and records what it
// was asked.
type fakeZPay struct {
	server   *httptest.Server
	reply    func(w http.ResponseWriter)
	requests []url.Values
}

func startFakeZPay(t *testing.T) *fakeZPay {
	t.Helper()
	fake := &fakeZPay{reply: func(w http.ResponseWriter) {
		_, _ = io.WriteString(w, `{"code":1,"msg":"ok","trade_no":"zpay-1","qrcode":"weixin://wxpay/bizpayurl?pr=abc"}`)
	}}
	fake.server = httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/mapi.php" || r.Method != http.MethodPost {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		_ = r.ParseForm()
		fake.requests = append(fake.requests, r.PostForm)
		fake.reply(w)
	}))
	t.Cleanup(fake.server.Close)
	previousClient, previousAddress := partnerServerMapiHTTPClient, operation_setting.PayAddress
	partnerServerMapiHTTPClient = fake.server.Client()
	operation_setting.PayAddress = fake.server.URL
	t.Cleanup(func() {
		partnerServerMapiHTTPClient = previousClient
		operation_setting.PayAddress = previousAddress
	})
	return fake
}

func setupPartnerServerPaymentController(t *testing.T) *gin.Engine {
	t.Helper()
	engine := setupPartnerOAuthPaymentController(t)
	require.NoError(t, model.DB.AutoMigrate(partnerServerTestModels...))
	accounts := engine.Group("/api/partner/v1/accounts/:external_user_id", middleware.PartnerServerBearer())
	accounts.GET("", PartnerServerGetAccount)
	accounts.POST("/payment/orders", PartnerServerCreatePaymentOrder)
	engine.GET("/api/partner/v1/payment/options", middleware.PartnerServerBearer(), PartnerServerPaymentOptions)
	engine.GET("/api/partner/v1/payment/orders/:order_id", middleware.PartnerServerBearer(), PartnerServerGetPaymentOrder)
	return engine
}

func decodePartnerServerOrder(t *testing.T, rec *httptest.ResponseRecorder, status int) partnerServerOrderResponse {
	t.Helper()
	require.Equal(t, status, rec.Code, rec.Body.String())
	var order partnerServerOrderResponse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &order))
	return order
}

func TestPartnerServerPaymentOrderQRCodeAndSettlement(t *testing.T) {
	engine := setupPartnerServerPaymentController(t)
	zpay := startFakeZPay(t)
	fixture := seedPartnerServerFixture(t, "")
	token := issuePartnerServerTestToken(t, engine, fixture)
	ordersPath := "/api/partner/v1/accounts/" + partnerServerTestUser + "/payment/orders"
	key := map[string]string{"Idempotency-Key": "order-000000000000001"}

	options := partnerServerGet(engine, "/api/partner/v1/payment/options", token, "203.0.113.10")
	require.Equal(t, http.StatusOK, options.Code)
	assert.Contains(t, options.Body.String(), `"available":true`)

	created := decodePartnerServerOrder(t, partnerServerPost(engine, ordersPath, token, `{"amount":10,"payment_method":"alipay","client_ip":"198.51.100.23"}`, key), http.StatusCreated)
	assert.Equal(t, common.TopUpStatusPending, created.Status)
	assert.Equal(t, "weixin://wxpay/bizpayurl?pr=abc", created.QRCode)
	assert.Empty(t, created.PayURL)
	assert.Equal(t, "70.00", created.PayMoney)
	assert.Equal(t, partnerServerTestUser, created.ExternalUserID)
	require.Len(t, zpay.requests, 1)
	sent := zpay.requests[0]
	assert.Equal(t, "198.51.100.23", sent.Get("clientip"), "the payer's address, not the partner server's")
	assert.Equal(t, "pc", sent.Get("device"))
	assert.Equal(t, created.OrderID, sent.Get("out_trade_no"))
	assert.Equal(t, "70.00", sent.Get("money"))
	signed := map[string]string{}
	for name := range sent {
		signed[name] = sent.Get(name)
	}
	verified, err := (&epay.Client{Config: &epay.Config{PartnerID: "merchant-id", Key: "merchant-secret"}}).Verify(signed)
	require.NoError(t, err)
	assert.True(t, verified.VerifyStatus, "the gateway request is signed with the merchant key")

	replay := decodePartnerServerOrder(t, partnerServerPost(engine, ordersPath, token, `{"amount":10,"payment_method":"alipay"}`, key), http.StatusOK)
	assert.Equal(t, created.OrderID, replay.OrderID)
	assert.Equal(t, created.QRCode, replay.QRCode)
	assert.Len(t, zpay.requests, 1, "a replay never orders again at the gateway")
	assertPartnerError(t, partnerServerPost(engine, ordersPath, token, `{"amount":20,"payment_method":"alipay"}`, key), http.StatusConflict, "idempotency_conflict")

	polled := decodePartnerServerOrder(t, partnerServerGet(engine, "/api/partner/v1/payment/orders/"+created.OrderID, token, "203.0.113.10"), http.StatusOK)
	assert.Equal(t, common.TopUpStatusPending, polled.Status)
	assert.Empty(t, polled.QRCode, "polling never returns the payment link")

	params := epay.GenerateParams(map[string]string{
		"pid": "merchant-id", "type": "alipay", "out_trade_no": created.OrderID,
		"trade_no": "zpay-1", "trade_status": epay.StatusTradeSuccess, "money": "70.00",
	}, "merchant-secret")
	query := url.Values{}
	for name, value := range params {
		query.Set(name, value)
	}
	settle := httptest.NewRequest(http.MethodGet, "/api/user/epay/return?"+query.Encode(), nil)
	settle.Host = "localhost:3000"
	settled := httptest.NewRecorder()
	engine.ServeHTTP(settled, settle)
	require.Equal(t, http.StatusFound, settled.Code, settled.Body.String())

	paid := decodePartnerServerOrder(t, partnerServerGet(engine, "/api/partner/v1/payment/orders/"+created.OrderID, token, "203.0.113.10"), http.StatusOK)
	assert.Equal(t, common.TopUpStatusSuccess, paid.Status)
	assert.NotEmpty(t, paid.PaidAt)
	accountRec := partnerServerGet(engine, "/api/partner/v1/accounts/"+partnerServerTestUser, token, "203.0.113.10")
	var account service.PartnerAccountView
	require.NoError(t, json.Unmarshal(accountRec.Body.Bytes(), &account))
	assert.Equal(t, 5_000_000, account.Quota, "the payment lands in the sub-account wallet")
	var rewards int64
	require.NoError(t, model.DB.Model(&model.CashbackReward{}).Count(&rewards).Error)
	assert.Zero(t, rewards, "partner orders never earn cashback")

	other := seedPartnerServerFixture(t, "")
	otherToken := issuePartnerServerTestToken(t, engine, other)
	assertPartnerError(t, partnerServerGet(engine, "/api/partner/v1/payment/orders/"+created.OrderID, otherToken, "203.0.113.10"), http.StatusNotFound, "order_not_found")
	assert.Len(t, partnerServerLogs(t, "partner_account.payment_order_create"), 1)
	assert.Len(t, partnerServerLogs(t, "partner_account.create"), 1, "an account created by its first order is audited")
}

func TestPartnerServerPaymentGatewayFailuresRecoverOnRetry(t *testing.T) {
	tests := []struct {
		name  string
		reply func(w http.ResponseWriter)
	}{
		{name: "refused", reply: func(w http.ResponseWriter) { _, _ = io.WriteString(w, `{"code":-1,"msg":"channel closed"}`) }},
		{name: "http error", reply: func(w http.ResponseWriter) { w.WriteHeader(http.StatusBadGateway) }},
		{name: "not json", reply: func(w http.ResponseWriter) { _, _ = io.WriteString(w, `<html>`) }},
		{name: "no checkout", reply: func(w http.ResponseWriter) { _, _ = io.WriteString(w, `{"code":"1"}`) }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			engine := setupPartnerServerPaymentController(t)
			zpay := startFakeZPay(t)
			fixture := seedPartnerServerFixture(t, "")
			token := issuePartnerServerTestToken(t, engine, fixture)
			ordersPath := "/api/partner/v1/accounts/" + partnerServerTestUser + "/payment/orders"
			key := map[string]string{"Idempotency-Key": "order-000000000000002"}

			zpay.reply = tt.reply
			assertPartnerError(t, partnerServerPost(engine, ordersPath, token, `{"amount":10,"payment_method":"alipay"}`, key), http.StatusServiceUnavailable, "payment_unavailable")
			zpay.reply = func(w http.ResponseWriter) {
				_, _ = io.WriteString(w, `{"code":1,"payurl":"https://zpayz.cn/pay/abc"}`)
			}
			retried := decodePartnerServerOrder(t, partnerServerPost(engine, ordersPath, token, `{"amount":10,"payment_method":"alipay"}`, key), http.StatusOK)
			assert.Equal(t, "https://zpayz.cn/pay/abc", retried.PayURL, "a payment URL is returned when there is no QR code")
			var orders int64
			require.NoError(t, model.DB.Model(&model.PartnerAccountPaymentOrder{}).Count(&orders).Error)
			assert.Equal(t, int64(1), orders, "the retry completes the same order")
			assert.Len(t, zpay.requests, 2)
		})
	}

	t.Run("plain http gateway", func(t *testing.T) {
		engine := setupPartnerServerPaymentController(t)
		zpay := startFakeZPay(t)
		operation_setting.PayAddress = "http://pay.example.com"
		fixture := seedPartnerServerFixture(t, "")
		token := issuePartnerServerTestToken(t, engine, fixture)
		rec := partnerServerPost(engine, "/api/partner/v1/accounts/"+partnerServerTestUser+"/payment/orders", token, `{"amount":10,"payment_method":"alipay"}`, map[string]string{"Idempotency-Key": "order-000000000000003"})
		assertPartnerError(t, rec, http.StatusServiceUnavailable, "payment_unavailable")
		assert.Empty(t, zpay.requests, "never sent over plain HTTP")
	})
}

func TestPartnerServerPaymentOrderValidation(t *testing.T) {
	engine := setupPartnerServerPaymentController(t)
	startFakeZPay(t)
	fixture := seedPartnerServerFixture(t, "")
	token := issuePartnerServerTestToken(t, engine, fixture)
	ordersPath := "/api/partner/v1/accounts/" + partnerServerTestUser + "/payment/orders"
	tests := []struct {
		body   string
		key    string
		status int
		code   string
	}{
		{body: `{"amount":10,"payment_method":"alipay"}`, key: "", status: http.StatusBadRequest, code: "invalid_request"},
		{body: `{"amount":10,"payment_method":"alipay","client_ip":"nope"}`, key: "order-000000000000010", status: http.StatusBadRequest, code: "invalid_request"},
		{body: `{"amount":10,"payment_method":"alipay","extra":1}`, key: "order-000000000000011", status: http.StatusBadRequest, code: "invalid_request"},
		{body: `{"amount":10,"payment_method":"stripe"}`, key: "order-000000000000012", status: http.StatusBadRequest, code: "invalid_payment_method"},
		{body: `{"amount":0,"payment_method":"alipay"}`, key: "order-000000000000013", status: http.StatusBadRequest, code: "invalid_amount"},
	}
	for _, tt := range tests {
		headers := map[string]string{}
		if tt.key != "" {
			headers["Idempotency-Key"] = tt.key
		}
		assertPartnerError(t, partnerServerPost(engine, ordersPath, token, tt.body, headers), tt.status, tt.code)
	}
	count, err := model.CountPartnerAccounts(fixture.client.ClientId)
	require.NoError(t, err)
	assert.Zero(t, count, "a rejected order creates no account")
}

func TestPartnerServerAccountUsage(t *testing.T) {
	engine := setupPartnerServerController(t)
	fixture := seedPartnerServerFixture(t, "")
	token := issuePartnerServerTestToken(t, engine, fixture)
	base := "/api/partner/v1/accounts/" + partnerServerTestUser + "/usage"
	assertPartnerError(t, partnerServerGet(engine, base, token, "203.0.113.10"), http.StatusNotFound, "account_not_found")

	decodePartnerCredential(t, partnerServerPost(engine, "/api/partner/v1/accounts/"+partnerServerTestUser+"/credential", token, "{}", nil))
	account, err := model.GetPartnerAccount(fixture.client.ClientId, partnerServerTestUser)
	require.NoError(t, err)
	now := common.GetTimestamp()
	require.NoError(t, model.LOG_DB.Create(&model.Log{UserId: account.UserId, Type: model.LogTypeConsume, CreatedAt: now - 60, ModelName: "gpt-x",
		Quota: 42, Ip: "203.0.113.9", Content: "secret prompt", Other: `{"admin_info":{}}`, ChannelId: 3, RequestId: "req-usage"}).Error)

	ok := partnerServerGet(engine, base, token, "203.0.113.10")
	require.Equal(t, http.StatusOK, ok.Code, ok.Body.String())
	var body struct {
		Items   []map[string]any `json:"items"`
		HasMore bool             `json:"has_more"`
	}
	require.NoError(t, json.Unmarshal(ok.Body.Bytes(), &body))
	require.Len(t, body.Items, 1)
	assert.Equal(t, "gpt-x", body.Items[0]["model_name"])
	for _, hidden := range []string{"ip", "content", "other", "channel", "group", "token_name", "user_id"} {
		assert.NotContains(t, body.Items[0], hidden)
	}
	assert.NotContains(t, ok.Body.String(), "secret prompt")

	day := int64(24 * 60 * 60)
	for name, query := range map[string]string{
		"span over 31 days":  "?start_time=" + strconv.FormatInt(now-32*day, 10) + "&end_time=" + strconv.FormatInt(now, 10),
		"older than 90 days": "?start_time=" + strconv.FormatInt(now-91*day, 10) + "&end_time=" + strconv.FormatInt(now-90*day+60, 10),
		"reversed range":     "?start_time=" + strconv.FormatInt(now, 10) + "&end_time=" + strconv.FormatInt(now-60, 10),
		"unknown parameter":  "?model=gpt-x",
		"repeated parameter": "?page=1&page=2",
		"page size too big":  "?page_size=101",
		"page too deep":      "?page=101&page_size=100",
		"not a number":       "?page=one",
	} {
		t.Run(name, func(t *testing.T) {
			assertPartnerError(t, partnerServerGet(engine, base+query, token, "203.0.113.10"), http.StatusBadRequest, "invalid_request")
		})
	}
}

// assertConsoleFailure checks an admin console refusal: HTTP 200 with
// success=false and the English source message the console translates.
func assertConsoleFailure(t *testing.T, rec *httptest.ResponseRecorder, message string) {
	t.Helper()
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var body struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	assert.False(t, body.Success)
	assert.Equal(t, message, body.Message)
}

func TestPartnerSubAccountsCannotBeDeleted(t *testing.T) {
	_, identity, target := setupAdminUserTest(t)
	require.NoError(t, model.DB.Create(&model.PartnerAccount{ClientId: "pc_" + strings.Repeat("a", 32), ExternalUserId: partnerServerTestUser,
		ExternalUserIdHash: model.HashPartnerExternalUserID(partnerServerTestUser), UserId: target.Id, Status: model.PartnerAccountStatusActive, CreatedAt: 1}).Error)

	manage := adminUserRequest(http.MethodPost, "/api/user/manage", `{"id":`+strconv.Itoa(target.Id)+`,"action":"delete"}`, "", identity, common.RoleRootUser, nil, ManageUser)
	assertConsoleFailure(t, manage, "Partner sub-accounts cannot be deleted; disable them instead")
	hard := adminUserRequest(http.MethodDelete, "/api/user/"+strconv.Itoa(target.Id), "", "", identity, common.RoleRootUser,
		gin.Params{{Key: "id", Value: strconv.Itoa(target.Id)}}, DeleteUser)
	assertConsoleFailure(t, hard, "Partner sub-accounts cannot be deleted; disable them instead")
	_, err := model.GetUserById(target.Id, true)
	require.NoError(t, err, "the sub-account still exists")
}

func TestPartnerServerReplayWaitsForAnInFlightCheckout(t *testing.T) {
	engine := setupPartnerServerPaymentController(t)
	zpay := startFakeZPay(t)
	zpay.reply = func(w http.ResponseWriter) { _, _ = io.WriteString(w, `{"code":-1}`) }
	fixture := seedPartnerServerFixture(t, "")
	token := issuePartnerServerTestToken(t, engine, fixture)
	ordersPath := "/api/partner/v1/accounts/" + partnerServerTestUser + "/payment/orders"
	key := map[string]string{"Idempotency-Key": "order-000000000000020"}
	assertPartnerError(t, partnerServerPost(engine, ordersPath, token, `{"amount":10,"payment_method":"alipay"}`, key), http.StatusServiceUnavailable, "payment_unavailable")

	// Another request has just claimed the gateway call for this order.
	require.NoError(t, model.DB.Model(&model.PartnerAccountPaymentOrder{}).Where("1 = 1").Update("checkout_attempted_at", common.GetTimestamp()).Error)
	before := len(zpay.requests)
	replay := partnerServerPost(engine, ordersPath, token, `{"amount":10,"payment_method":"alipay"}`, key)
	assertPartnerError(t, replay, http.StatusServiceUnavailable, "payment_unavailable")
	assert.Equal(t, "3", replay.Header().Get("Retry-After"))
	assert.Len(t, zpay.requests, before, "the replay does not call the gateway while another request may")
}
