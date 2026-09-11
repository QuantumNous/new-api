package oauth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"math/big"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGenericOAuthIDTokenMapsVerifiedClaimsWithoutUserInfo(t *testing.T) {
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)

	var userInfoCalls atomic.Int32
	server := newIDTokenTestServer(t, "test-key", &privateKey.PublicKey, &userInfoCalls)
	defer server.Close()
	idTokenJWKSCache.Lock()
	idTokenJWKSCache.entries = make(map[string]cachedJWKS)
	idTokenJWKSCache.Unlock()

	provider := NewGenericOAuthProvider(&model.CustomOAuthProvider{
		Name:           "Test OIDC",
		Slug:           "test-oidc",
		ClientId:       "client-id",
		IdentitySource: model.CustomOAuthIdentitySourceIDToken,
		Issuer:         "https://issuer.example",
		JWKSURI:        server.URL + "/jwks",
		UserInfoEndpoint: server.URL + "/userinfo",
		UserIdField:      "sub",
		UsernameField:    "preferred_username",
		DisplayNameField: "name",
		EmailField:       "email",
	})

	token := signedIDToken(t, privateKey, "test-key", jwt.MapClaims{
		"iss":                "https://issuer.example",
		"aud":                "client-id",
		"sub":                "user-123",
		"preferred_username": "alice",
		"name":               "Alice",
		"email":              "alice@example.com",
		"exp":                time.Now().Add(time.Minute).Unix(),
		"iat":                time.Now().Unix(),
	})

	user, err := provider.GetUserInfo(context.Background(), &OAuthToken{IDToken: token})
	require.NoError(t, err)
	assert.Equal(t, "user-123", user.ProviderUserID)
	assert.Equal(t, "alice", user.Username)
	assert.Equal(t, "Alice", user.DisplayName)
	assert.Equal(t, "alice@example.com", user.Email)
	assert.Zero(t, userInfoCalls.Load())
}

func TestVerifyCustomOAuthIDTokenRejectsInvalidClaims(t *testing.T) {
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	server := newIDTokenTestServer(t, "test-key", &privateKey.PublicKey, nil)
	defer server.Close()
	idTokenJWKSCache.Lock()
	idTokenJWKSCache.entries = make(map[string]cachedJWKS)
	idTokenJWKSCache.Unlock()

	config := &model.CustomOAuthProvider{
		ClientId: "client-id", Issuer: "https://issuer.example", JWKSURI: server.URL + "/jwks",
	}
	baseClaims := jwt.MapClaims{
		"iss": "https://issuer.example", "aud": "client-id", "sub": "user-123",
		"exp": time.Now().Add(time.Minute).Unix(), "iat": time.Now().Unix(),
	}

	tests := []struct {
		name   string
		claims jwt.MapClaims
		kid    string
	}{
		{name: "wrong issuer", claims: jwt.MapClaims{"iss": "https://other.example", "aud": "client-id", "sub": "user-123", "exp": time.Now().Add(time.Minute).Unix(), "iat": time.Now().Unix()}, kid: "test-key"},
		{name: "wrong audience", claims: jwt.MapClaims{"iss": "https://issuer.example", "aud": "other-client", "sub": "user-123", "exp": time.Now().Add(time.Minute).Unix(), "iat": time.Now().Unix()}, kid: "test-key"},
		{name: "expired", claims: jwt.MapClaims{"iss": "https://issuer.example", "aud": "client-id", "sub": "user-123", "exp": time.Now().Add(-time.Minute).Unix(), "iat": time.Now().Add(-2 * time.Minute).Unix()}, kid: "test-key"},
		{name: "missing subject", claims: jwt.MapClaims{"iss": "https://issuer.example", "aud": "client-id", "exp": time.Now().Add(time.Minute).Unix(), "iat": time.Now().Unix()}, kid: "test-key"},
		{name: "unknown key", claims: baseClaims, kid: "unknown-key"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err := verifyCustomOAuthIDToken(context.Background(), config, signedIDToken(t, privateKey, test.kid, test.claims))
			require.Error(t, err)
		})
	}
}

func newIDTokenTestServer(t *testing.T, kid string, publicKey *rsa.PublicKey, userInfoCalls *atomic.Int32) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/jwks":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"keys":[{"kid":"` + kid + `","kty":"RSA","alg":"RS256","n":"` + base64.RawURLEncoding.EncodeToString(publicKey.N.Bytes()) + `","e":"` + base64.RawURLEncoding.EncodeToString(big.NewInt(int64(publicKey.E)).Bytes()) + `"}]}`))
		case "/userinfo":
			if userInfoCalls != nil {
				userInfoCalls.Add(1)
			}
			w.WriteHeader(http.StatusInternalServerError)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
}

func signedIDToken(t *testing.T, privateKey *rsa.PrivateKey, kid string, claims jwt.Claims) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = kid
	raw, err := token.SignedString(privateKey)
	require.NoError(t, err)
	return raw
}
