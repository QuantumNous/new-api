package service

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupPartnerOAuthTestDB(t *testing.T) {
	t.Helper()
	previousDB := model.DB
	previousAddress := system_setting.ServerAddress
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.AuthFlow{},
		&model.Token{},
		&model.PartnerOAuthClient{},
		&model.PartnerOAuthBinding{},
		&model.PartnerOAuthToken{},
	))
	model.DB = db
	system_setting.ServerAddress = "https://relay.example.com"
	t.Cleanup(func() {
		model.DB = previousDB
		system_setting.ServerAddress = previousAddress
		_ = sqlDB.Close()
	})
}

func seedPartnerUser(t *testing.T) *model.User {
	t.Helper()
	user := &model.User{
		Username:    "alice",
		DisplayName: "Alice",
		Password:    "unused",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AuthVersion: 1,
	}
	require.NoError(t, model.DB.Create(user).Error)
	return user
}

func seedPartnerClient(t *testing.T, method string, redirects []string) (*model.PartnerOAuthClient, string) {
	t.Helper()
	encoded, err := common.Marshal(redirects)
	require.NoError(t, err)
	secret := ""
	hash := ""
	if method == model.PartnerOAuthTokenAuthMethodBasic {
		secret, err = GeneratePartnerOAuthClientSecret()
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

func TestPartnerOAuthPKCERFC7636Vector(t *testing.T) {
	verifier := "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
	assert.Equal(t, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM", PartnerOAuthPKCEChallengeS256(verifier))
	require.NoError(t, VerifyPartnerOAuthPKCE("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM", verifier))
	assert.Error(t, VerifyPartnerOAuthPKCE("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM", verifier+"x"))
}

func TestPartnerOAuthRedirectMatrix(t *testing.T) {
	registeredHTTPS := []string{"https://assistant.example.com/oauth/callback?app=1"}
	assert.True(t, MatchPartnerOAuthRedirectURI(registeredHTTPS, "https://assistant.example.com/oauth/callback?app=1", false))
	assert.False(t, MatchPartnerOAuthRedirectURI(registeredHTTPS, "https://assistant.example.com/oauth/callback", false))
	assert.Error(t, ValidatePartnerOAuthRedirectURI("http://assistant.example.com/oauth/callback", false))

	registeredLoopback := []string{"http://127.0.0.1/oauth/callback"}
	assert.True(t, MatchPartnerOAuthRedirectURI(registeredLoopback, "http://127.0.0.1:43721/oauth/callback", true))
	assert.True(t, MatchPartnerOAuthRedirectURI(registeredLoopback, "http://127.0.0.1/oauth/callback", true))
	assert.False(t, MatchPartnerOAuthRedirectURI(registeredLoopback, "http://127.0.0.1:43721/other", true))
	assert.False(t, MatchPartnerOAuthRedirectURI(registeredLoopback, "http://127.0.0.1:43721/oauth/callback", false))
	assert.NoError(t, ValidatePartnerOAuthRedirectURI("http://[::1]/oauth/callback", true))
}

func TestPartnerOAuthScopeMatrix(t *testing.T) {
	canonical, err := CanonicalPartnerOAuthScopes("offline_access credential:read account:read")
	require.NoError(t, err)
	assert.Equal(t, "account:read credential:read offline_access", canonical)
	_, err = CanonicalPartnerOAuthScopes("account:read account:read")
	assert.Error(t, err)
	_, err = CanonicalPartnerOAuthScopes("profile")
	assert.Error(t, err)
	_, err = CanonicalPartnerOAuthScopes("")
	assert.Error(t, err)
	assert.True(t, ScopeSubsetOf("account:read", "account:read credential:read"))
	assert.False(t, ScopeSubsetOf("offline_access", "account:read"))
}

func TestPartnerOAuthCodeExchangeReplayAndPKCE(t *testing.T) {
	setupPartnerOAuthTestDB(t)
	user := seedPartnerUser(t)
	client, _ := seedPartnerClient(t, model.PartnerOAuthTokenAuthMethodBasic, []string{"https://assistant.example.com/oauth/callback"})
	verifier := "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
	payload, err := common.Marshal(PartnerOAuthCodePayload{
		RedirectURI:     "https://assistant.example.com/oauth/callback",
		CodeChallenge:   PartnerOAuthPKCEChallengeS256(verifier),
		Scope:           "account:read credential:read offline_access",
		UserAuthVersion: user.AuthVersion,
	})
	require.NoError(t, err)
	code, flow, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose:   model.AuthFlowPurposePartnerOAuthCode,
		Provider:  client.ClientId,
		UserId:    user.Id,
		Payload:   string(payload),
		ExpiresAt: time.Now().Add(PartnerOAuthCodeTTL),
	})
	require.NoError(t, err)

	_, err = ExchangePartnerOAuthCode(client, code, "https://assistant.example.com/other", verifier)
	require.Error(t, err)
	assert.Equal(t, "invalid_grant", AsPartnerOAuthError(err).Code)

	code2, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose:   model.AuthFlowPurposePartnerOAuthCode,
		Provider:  client.ClientId,
		UserId:    user.Id,
		Payload:   string(payload),
		ExpiresAt: time.Now().Add(PartnerOAuthCodeTTL),
	})
	require.NoError(t, err)
	_, err = ExchangePartnerOAuthCode(client, code2, "https://assistant.example.com/oauth/callback", "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
	require.Error(t, err)
	assert.Equal(t, "invalid_grant", AsPartnerOAuthError(err).Code)

	code3, flow3, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose:   model.AuthFlowPurposePartnerOAuthCode,
		Provider:  client.ClientId,
		UserId:    user.Id,
		Payload:   string(payload),
		ExpiresAt: time.Now().Add(PartnerOAuthCodeTTL),
	})
	require.NoError(t, err)
	issued, err := ExchangePartnerOAuthCode(client, code3, "https://assistant.example.com/oauth/callback", verifier)
	require.NoError(t, err)
	require.NotEmpty(t, issued.RefreshToken)
	assert.Equal(t, flow3.Id, mustBindingFlowID(t, issued.BindingID))

	_, err = ExchangePartnerOAuthCode(client, code3, "https://assistant.example.com/oauth/callback", verifier)
	require.Error(t, err)
	assert.Equal(t, "invalid_grant", AsPartnerOAuthError(err).Code)
	binding, err := model.GetPartnerOAuthBindingByBindingID(issued.BindingID)
	require.NoError(t, err)
	assert.Equal(t, model.PartnerOAuthBindingStatusRevoked, binding.Status)
	_ = flow
}

func TestPartnerOAuthCodeExpiry(t *testing.T) {
	setupPartnerOAuthTestDB(t)
	user := seedPartnerUser(t)
	client, _ := seedPartnerClient(t, model.PartnerOAuthTokenAuthMethodNone, []string{"http://127.0.0.1/oauth/callback"})
	verifier := "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
	payload, err := common.Marshal(PartnerOAuthCodePayload{
		RedirectURI:     "http://127.0.0.1:43721/oauth/callback",
		CodeChallenge:   PartnerOAuthPKCEChallengeS256(verifier),
		Scope:           "account:read",
		UserAuthVersion: user.AuthVersion,
	})
	require.NoError(t, err)
	code, flow, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose:   model.AuthFlowPurposePartnerOAuthCode,
		Provider:  client.ClientId,
		UserId:    user.Id,
		Payload:   string(payload),
		ExpiresAt: time.Now().Add(time.Minute),
	})
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(flow).Update("expires_at", time.Now().Add(-time.Second)).Error)
	_, err = ExchangePartnerOAuthCode(client, code, "http://127.0.0.1:43721/oauth/callback", verifier)
	require.Error(t, err)
	assert.Equal(t, "invalid_grant", AsPartnerOAuthError(err).Code)
}

func TestPartnerOAuthRefreshRotationAndReplay(t *testing.T) {
	setupPartnerOAuthTestDB(t)
	user := seedPartnerUser(t)
	client, _ := seedPartnerClient(t, model.PartnerOAuthTokenAuthMethodBasic, []string{"https://assistant.example.com/oauth/callback"})
	first := issueOfflineBinding(t, client, user)
	second, err := RefreshPartnerOAuthToken(client, first.RefreshToken, "")
	require.NoError(t, err)
	assert.Equal(t, first.BindingID, second.BindingID)
	assert.NotEqual(t, first.AccessToken, second.AccessToken)
	assert.NotEqual(t, first.RefreshToken, second.RefreshToken)
	assert.LessOrEqual(t, second.RefreshTokenExpiresIn, first.RefreshTokenExpiresIn)

	_, err = RefreshPartnerOAuthToken(client, first.RefreshToken, "")
	require.Error(t, err)
	assert.Equal(t, "invalid_grant", AsPartnerOAuthError(err).Code)
	binding, err := model.GetPartnerOAuthBindingByBindingID(first.BindingID)
	require.NoError(t, err)
	assert.Equal(t, model.PartnerOAuthBindingStatusRevoked, binding.Status)
}

func TestPartnerOAuthAuthVersionChangeInvalidatesRefresh(t *testing.T) {
	setupPartnerOAuthTestDB(t)
	user := seedPartnerUser(t)
	client, _ := seedPartnerClient(t, model.PartnerOAuthTokenAuthMethodBasic, []string{"https://assistant.example.com/oauth/callback"})
	issued := issueOfflineBinding(t, client, user)
	require.NoError(t, model.DB.Model(user).Update("auth_version", user.AuthVersion+1).Error)
	_, err := RefreshPartnerOAuthToken(client, issued.RefreshToken, "")
	require.Error(t, err)
	assert.Equal(t, "invalid_grant", AsPartnerOAuthError(err).Code)
}

func TestPartnerOAuthRevokeSemantics(t *testing.T) {
	setupPartnerOAuthTestDB(t)
	user := seedPartnerUser(t)
	client, _ := seedPartnerClient(t, model.PartnerOAuthTokenAuthMethodBasic, []string{"https://assistant.example.com/oauth/callback"})
	other, _ := seedPartnerClient(t, model.PartnerOAuthTokenAuthMethodNone, []string{"http://127.0.0.1/cb"})
	issued := issueOfflineBinding(t, client, user)
	require.NoError(t, RevokePartnerOAuthToken(other, issued.RefreshToken))
	_, err := AuthenticatePartnerOAuthAccessToken(issued.AccessToken, PartnerOAuthScopeAccountRead)
	require.NoError(t, err)
	require.NoError(t, RevokePartnerOAuthToken(client, issued.RefreshToken))
	_, err = AuthenticatePartnerOAuthAccessToken(issued.AccessToken, PartnerOAuthScopeAccountRead)
	require.Error(t, err)
	assert.Equal(t, "invalid_token", AsPartnerOAuthError(err).Code)
	require.NoError(t, RevokePartnerOAuthToken(client, "or_unknown"))
}

func TestPartnerOAuthOfflineAccessOptional(t *testing.T) {
	setupPartnerOAuthTestDB(t)
	user := seedPartnerUser(t)
	client, _ := seedPartnerClient(t, model.PartnerOAuthTokenAuthMethodNone, []string{"http://127.0.0.1/oauth/callback"})
	issued := issueBindingWithScope(t, client, user, "account:read credential:read", "http://127.0.0.1:9/oauth/callback")
	assert.Empty(t, issued.RefreshToken)
}

func issueOfflineBinding(t *testing.T, client *model.PartnerOAuthClient, user *model.User) *PartnerOAuthTokenResponse {
	t.Helper()
	return issueBindingWithScope(t, client, user, "account:read credential:read offline_access", "https://assistant.example.com/oauth/callback")
}

func issueBindingWithScope(t *testing.T, client *model.PartnerOAuthClient, user *model.User, scope, redirect string) *PartnerOAuthTokenResponse {
	t.Helper()
	verifier := "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
	payload, err := common.Marshal(PartnerOAuthCodePayload{
		RedirectURI:     redirect,
		CodeChallenge:   PartnerOAuthPKCEChallengeS256(verifier),
		Scope:           scope,
		UserAuthVersion: user.AuthVersion,
	})
	require.NoError(t, err)
	code, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose:   model.AuthFlowPurposePartnerOAuthCode,
		Provider:  client.ClientId,
		UserId:    user.Id,
		Payload:   string(payload),
		ExpiresAt: time.Now().Add(PartnerOAuthCodeTTL),
	})
	require.NoError(t, err)
	issued, err := ExchangePartnerOAuthCode(client, code, redirect, verifier)
	require.NoError(t, err)
	return issued
}

func mustBindingFlowID(t *testing.T, bindingID string) int64 {
	t.Helper()
	binding, err := model.GetPartnerOAuthBindingByBindingID(bindingID)
	require.NoError(t, err)
	return binding.AuthorizationFlowId
}
