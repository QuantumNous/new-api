package service

import (
	"errors"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func useTestSessionSecret(t *testing.T) {
	t.Helper()
	previous := common.SessionSecret
	common.SessionSecret = "test-session-secret-with-sufficient-entropy"
	t.Cleanup(func() { common.SessionSecret = previous })
}

func TestAccessTokenRoundTripAndPurposeIsolation(t *testing.T) {
	setupAuthSessionTestDB(t)
	useTestSessionSecret(t)
	identity := AuthIdentity{UserID: 42, SessionID: "session-1", UserAuthVersion: 3, SessionVersion: 2}

	token, expiresAt, err := IssueAccessToken(identity)
	require.NoError(t, err)
	assert.Positive(t, expiresAt)

	parsed, err := ParseAccessToken(token)
	require.NoError(t, err)
	assert.Equal(t, identity, parsed)

	binding, err := BindVerificationOperation(VerificationOperation{Scope: "channel.key.read", Context: []byte(`{"channel_id":123}`)})
	require.NoError(t, err)
	proof, _, err := IssueSecurityProof(identity, "2fa", binding)
	require.NoError(t, err)
	_, err = ParseAccessToken(proof)
	assert.ErrorIs(t, err, ErrAuthTokenInvalid)
}

func TestAccessTokenRejectsTampering(t *testing.T) {
	useTestSessionSecret(t)
	identity := AuthIdentity{UserID: 42, SessionID: "session-1", UserAuthVersion: 1, SessionVersion: 1}
	token, _, err := IssueAccessToken(identity)
	require.NoError(t, err)

	tamperAt := len(token) - 2
	replacement := "x"
	if token[tamperAt] == 'x' {
		replacement = "y"
	}
	tampered := token[:tamperAt] + replacement + token[tamperAt+1:]
	_, err = ParseAccessToken(tampered)
	assert.ErrorIs(t, err, ErrAuthTokenInvalid)

	_, internal, err := ParseDashboardAccessToken(tampered)
	assert.True(t, internal)
	assert.ErrorIs(t, err, ErrAuthTokenInvalid)
}

func TestDashboardAccessTokenClassification(t *testing.T) {
	setupAuthSessionTestDB(t)
	useTestSessionSecret(t)

	identity, internal, err := ParseDashboardAccessToken("opaque.key.with-dots")
	require.NoError(t, err)
	assert.False(t, internal)
	assert.Empty(t, identity)

	external := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"iss": "external-issuer",
		"aud": authTokenAudience,
		"exp": time.Now().Add(time.Minute).Unix(),
	})
	externalRaw, err := external.SignedString([]byte("external-secret"))
	require.NoError(t, err)
	_, internal, err = ParseDashboardAccessToken(externalRaw)
	require.NoError(t, err)
	assert.False(t, internal)

	unknownUse := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"iss":       authTokenIssuer,
		"aud":       authTokenAudience,
		"token_use": "third_party",
		"exp":       time.Now().Add(time.Minute).Unix(),
	})
	unknownUseRaw, err := unknownUse.SignedString([]byte("external-secret"))
	require.NoError(t, err)
	_, internal, err = ParseDashboardAccessToken(unknownUseRaw)
	require.NoError(t, err)
	assert.False(t, internal)

	binding, err := BindVerificationOperation(VerificationOperation{Scope: "channel.key.read", Context: []byte(`{"channel_id":123}`)})
	require.NoError(t, err)
	proof, _, err := IssueSecurityProof(AuthIdentity{
		UserID: 42, SessionID: "session-1", UserAuthVersion: 1, SessionVersion: 1,
	}, "2fa", binding)
	require.NoError(t, err)
	_, internal, err = ParseDashboardAccessToken(proof)
	assert.True(t, internal)
	assert.ErrorIs(t, err, ErrAuthTokenInvalid)

	expiredClaims := authClaims{
		TokenUse:        accessTokenUse,
		SessionID:       "expired-session",
		UserAuthVersion: 1,
		SessionVersion:  1,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    authTokenIssuer,
			Subject:   "42",
			Audience:  jwt.ClaimStrings{authTokenAudience},
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-time.Minute)),
			NotBefore: jwt.NewNumericDate(time.Now().Add(-2 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Minute)),
			ID:        "expired-token",
		},
	}
	expired, err := jwt.NewWithClaims(jwt.SigningMethodHS256, expiredClaims).SignedString(authSigningKey(accessTokenUse))
	require.NoError(t, err)
	_, internal, err = ParseDashboardAccessToken(expired)
	assert.True(t, internal)
	assert.ErrorIs(t, err, ErrAuthTokenExpired)
}

func TestSecurityProofBindsIdentityAndOperation(t *testing.T) {
	setupAuthSessionTestDB(t)
	useTestSessionSecret(t)
	identity := AuthIdentity{UserID: 42, SessionID: "session-1", UserAuthVersion: 3, SessionVersion: 2}
	operation := VerificationOperation{Scope: "channel.key.read", Context: []byte(`{"channel_id":123}`)}
	binding, err := BindVerificationOperation(operation)
	require.NoError(t, err)
	proof, _, err := IssueSecurityProof(identity, "2fa", binding)
	require.NoError(t, err)

	claims, err := verifySecurityProof(proof, identity, binding)
	require.NoError(t, err)
	assert.Equal(t, "2fa", claims.Method)

	wrongScope, err := BindVerificationOperation(VerificationOperation{Scope: "passkey.delete"})
	require.NoError(t, err)
	_, err = verifySecurityProof(proof, identity, wrongScope)
	assert.ErrorIs(t, err, ErrProofScope)

	otherChannel, err := BindVerificationOperation(VerificationOperation{Scope: "channel.key.read", Context: []byte(`{"channel_id":456}`)})
	require.NoError(t, err)
	_, err = verifySecurityProof(proof, identity, otherChannel)
	assert.ErrorIs(t, err, ErrProofContext)

	otherSession := identity
	otherSession.SessionID = "session-2"
	_, err = verifySecurityProof(proof, otherSession, binding)
	assert.True(t, errors.Is(err, ErrAuthTokenInvalid))

	claims, err = parseAuthClaims(proof, securityProofTokenUse, authSigningKey(securityProofTokenUse))
	require.NoError(t, err)
	claims.ExpiresAt = jwt.NewNumericDate(time.Now().Add(-time.Minute))
	expired, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(authSigningKey(securityProofTokenUse))
	require.NoError(t, err)
	_, err = ConsumeOperationProof(expired, identity, operation)
	assert.ErrorIs(t, err, ErrAuthTokenExpired)
}

func TestSecurityProofBindsAccessTokenSession(t *testing.T) {
	setupAuthSessionTestDB(t)
	useTestSessionSecret(t)
	identity := AuthIdentity{UserID: 42, SessionID: model.AccessTokenSessionID(7), UserAuthVersion: 3, SessionVersion: model.AccessTokenSessionVersion}
	binding, err := BindVerificationOperation(VerificationOperation{Scope: VerificationScopeTwoFADisable})
	require.NoError(t, err)
	proof, _, err := IssueSecurityProof(identity, "password", binding)
	require.NoError(t, err)

	claims, err := verifySecurityProof(proof, identity, binding)
	require.NoError(t, err)
	assert.Equal(t, identity.SessionID, claims.SessionID)

	for _, sessionID := range []string{model.AccessTokenSessionID(8), "session-1"} {
		other := identity
		other.SessionID = sessionID
		_, err = verifySecurityProof(proof, other, binding)
		assert.ErrorIs(t, err, ErrAuthTokenInvalid, sessionID)
	}
}

func TestDirectPaymentConfigProofBindsExactRevision(t *testing.T) {
	for _, scope := range []string{VerificationScopeAntomConfig, VerificationScopeWebMoneyConfig, VerificationScopeMixPayConfig, VerificationScopeAlipayConfig, VerificationScopeWechatPayConfig} {
		t.Run(scope, func(t *testing.T) {
			user := setupAuthSessionTestDB(t)
			require.NoError(t, model.DB.AutoMigrate(&model.TwoFA{}, &model.PasskeyCredential{}))
			require.NoError(t, model.DB.Model(user).Update("role", common.RoleRootUser).Error)
			require.NoError(t, model.DB.Create(&model.UserSession{SID: "alipay-session", UserID: user.Id, Version: 1, UserAuthVersion: 1, Status: model.UserSessionStatusActive, RefreshHash: "alipay-test-hash", ExpiresAt: time.Now().Add(time.Hour).Unix()}).Error)
			useTestSessionSecret(t)
			identity := AuthIdentity{UserID: user.Id, SessionID: "alipay-session", UserAuthVersion: 1, SessionVersion: 1}
			require.NoError(t, model.DB.Model(user).Update("role", common.RoleCommonUser).Error)
			_, denied := GetVerificationRequirements(identity, scope)
			assert.ErrorIs(t, denied, ErrVerificationForbidden)
			require.NoError(t, model.DB.Model(user).Update("role", common.RoleRootUser).Error)
			tokenIdentity := identity
			tokenIdentity.SessionID = model.AccessTokenSessionID(7)
			_, denied = GetVerificationRequirements(tokenIdentity, scope)
			require.Error(t, denied)
			operation := VerificationOperation{Scope: scope, Context: []byte(`{"config_hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}`)}
			binding, err := BindVerificationOperation(operation)
			require.NoError(t, err)
			proof, _, err := IssueSecurityProof(identity, "password", binding)
			require.NoError(t, err)
			changed := operation
			changed.Context = []byte(`{"config_hash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}`)
			_, err = ConsumeOperationProof(proof, identity, changed)
			assert.ErrorIs(t, err, ErrProofContext)
			_, err = ConsumeOperationProof(proof, identity, operation)
			require.NoError(t, err)
			_, err = ConsumeOperationProof(proof, identity, operation)
			require.Error(t, err)
			for _, context := range []string{`{}`, `{"config_hash":"short"}`, `{"config_hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","extra":1}`} {
				_, err := BindVerificationOperation(VerificationOperation{Scope: scope, Context: []byte(context)})
				require.Error(t, err)
			}

		})
	}
}
