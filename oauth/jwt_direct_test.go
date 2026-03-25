package oauth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/golang-jwt/jwt/v5"
)

func TestJWTDirectResolveIdentityWithPEMMapping(t *testing.T) {
	privateKey := mustGenerateRSAPrivateKey(t)
	provider := NewJWTDirectProvider(&model.CustomOAuthProvider{
		Name:             "Acme SSO",
		Slug:             "acme-sso",
		Enabled:          true,
		Issuer:           "https://issuer.example.com",
		Audience:         "new-api",
		PublicKey:        mustEncodeRSAPublicKeyPEM(t, &privateKey.PublicKey),
		UserIdField:      "sub",
		UsernameField:    "preferred_username",
		DisplayNameField: "name",
		EmailField:       "email",
		GroupField:       "groups",
		GroupMapping:     `{"engineering":"vip"}`,
		RoleField:        "roles",
		RoleMapping:      `{"platform-admin":"admin","root":"root"}`,
	})

	token := mustSignJWT(t, privateKey, "", jwt.MapClaims{
		"iss":                "https://issuer.example.com",
		"aud":                "new-api",
		"sub":                "external-user-1",
		"preferred_username": "alice",
		"name":               "Alice",
		"email":              "alice@example.com",
		"groups":             []string{"engineering"},
		"roles":              []string{"platform-admin", "root"},
		"exp":                time.Now().Add(time.Hour).Unix(),
	})

	identity, err := provider.ResolveIdentity(context.Background(), token)
	if err != nil {
		t.Fatalf("expected identity to resolve, got error: %v", err)
	}
	if identity.User.ProviderUserID != "external-user-1" {
		t.Fatalf("unexpected provider user id: %s", identity.User.ProviderUserID)
	}
	if identity.User.Username != "alice" {
		t.Fatalf("unexpected username: %s", identity.User.Username)
	}
	if identity.Group != "vip" {
		t.Fatalf("expected mapped group vip, got %s", identity.Group)
	}
	if identity.Role != common.RoleAdminUser {
		t.Fatalf("expected admin role, got %d", identity.Role)
	}
}

func TestJWTDirectResolveIdentityRejectsIssuerMismatch(t *testing.T) {
	privateKey := mustGenerateRSAPrivateKey(t)
	provider := NewJWTDirectProvider(&model.CustomOAuthProvider{
		Name:        "Acme SSO",
		Slug:        "acme-sso",
		Enabled:     true,
		Issuer:      "https://issuer.example.com",
		Audience:    "new-api",
		PublicKey:   mustEncodeRSAPublicKeyPEM(t, &privateKey.PublicKey),
		UserIdField: "sub",
	})

	token := mustSignJWT(t, privateKey, "", jwt.MapClaims{
		"iss": "https://other-issuer.example.com",
		"aud": "new-api",
		"sub": "external-user-2",
		"exp": time.Now().Add(time.Hour).Unix(),
	})

	_, err := provider.ResolveIdentity(context.Background(), token)
	if err == nil {
		t.Fatal("expected issuer mismatch to fail")
	}
}

func TestJWTDirectResolveIdentityRejectsAudienceMismatch(t *testing.T) {
	privateKey := mustGenerateRSAPrivateKey(t)
	provider := NewJWTDirectProvider(&model.CustomOAuthProvider{
		Name:        "Acme SSO",
		Slug:        "acme-sso",
		Enabled:     true,
		Issuer:      "https://issuer.example.com",
		Audience:    "new-api",
		PublicKey:   mustEncodeRSAPublicKeyPEM(t, &privateKey.PublicKey),
		UserIdField: "sub",
	})

	token := mustSignJWT(t, privateKey, "", jwt.MapClaims{
		"iss": "https://issuer.example.com",
		"aud": "other-audience",
		"sub": "external-user-2",
		"exp": time.Now().Add(time.Hour).Unix(),
	})

	_, err := provider.ResolveIdentity(context.Background(), token)
	if err == nil {
		t.Fatal("expected audience mismatch to fail")
	}
}

func TestJWTDirectResolveIdentityRejectsExpiredToken(t *testing.T) {
	privateKey := mustGenerateRSAPrivateKey(t)
	provider := NewJWTDirectProvider(&model.CustomOAuthProvider{
		Name:        "Acme SSO",
		Slug:        "acme-sso",
		Enabled:     true,
		Issuer:      "https://issuer.example.com",
		Audience:    "new-api",
		PublicKey:   mustEncodeRSAPublicKeyPEM(t, &privateKey.PublicKey),
		UserIdField: "sub",
	})

	token := mustSignJWT(t, privateKey, "", jwt.MapClaims{
		"iss": "https://issuer.example.com",
		"aud": "new-api",
		"sub": "external-user-expired",
		"exp": time.Now().Add(-time.Minute).Unix(),
	})

	_, err := provider.ResolveIdentity(context.Background(), token)
	if err == nil {
		t.Fatal("expected expired token to fail")
	}
}

func TestJWTDirectResolveIdentityRejectsInvalidSignature(t *testing.T) {
	privateKey := mustGenerateRSAPrivateKey(t)
	otherPrivateKey := mustGenerateRSAPrivateKey(t)
	provider := NewJWTDirectProvider(&model.CustomOAuthProvider{
		Name:        "Acme SSO",
		Slug:        "acme-sso",
		Enabled:     true,
		Issuer:      "https://issuer.example.com",
		Audience:    "new-api",
		PublicKey:   mustEncodeRSAPublicKeyPEM(t, &privateKey.PublicKey),
		UserIdField: "sub",
	})

	token := mustSignJWT(t, otherPrivateKey, "", jwt.MapClaims{
		"iss": "https://issuer.example.com",
		"aud": "new-api",
		"sub": "external-user-invalid-signature",
		"exp": time.Now().Add(time.Hour).Unix(),
	})

	_, err := provider.ResolveIdentity(context.Background(), token)
	if err == nil {
		t.Fatal("expected invalid signature to fail")
	}
}

func TestJWTDirectResolveIdentityRejectsMissingExternalID(t *testing.T) {
	privateKey := mustGenerateRSAPrivateKey(t)
	provider := NewJWTDirectProvider(&model.CustomOAuthProvider{
		Name:        "Acme SSO",
		Slug:        "acme-sso",
		Enabled:     true,
		Issuer:      "https://issuer.example.com",
		Audience:    "new-api",
		PublicKey:   mustEncodeRSAPublicKeyPEM(t, &privateKey.PublicKey),
		UserIdField: "sub",
	})

	token := mustSignJWT(t, privateKey, "", jwt.MapClaims{
		"iss": "https://issuer.example.com",
		"aud": "new-api",
		"exp": time.Now().Add(time.Hour).Unix(),
	})

	_, err := provider.ResolveIdentity(context.Background(), token)
	if err == nil {
		t.Fatal("expected missing external id to fail")
	}
}

func TestJWTDirectResolveIdentityDoesNotPromoteRootRoleOrInvalidGroup(t *testing.T) {
	privateKey := mustGenerateRSAPrivateKey(t)
	provider := NewJWTDirectProvider(&model.CustomOAuthProvider{
		Name:         "Acme SSO",
		Slug:         "acme-sso",
		Enabled:      true,
		Issuer:       "https://issuer.example.com",
		Audience:     "new-api",
		PublicKey:    mustEncodeRSAPublicKeyPEM(t, &privateKey.PublicKey),
		UserIdField:  "sub",
		GroupField:   "groups",
		GroupMapping: `{"engineering":"nonexistent-group"}`,
		RoleField:    "roles",
		RoleMapping:  `{"root-role":"root"}`,
	})

	token := mustSignJWT(t, privateKey, "", jwt.MapClaims{
		"iss":    "https://issuer.example.com",
		"aud":    "new-api",
		"sub":    "external-user-4",
		"groups": []string{"engineering", "totally-unknown"},
		"roles":  []string{"root-role"},
		"exp":    time.Now().Add(time.Hour).Unix(),
	})

	identity, err := provider.ResolveIdentity(context.Background(), token)
	if err != nil {
		t.Fatalf("expected identity resolution to succeed, got error: %v", err)
	}
	if identity.Group != "" {
		t.Fatalf("expected invalid group mapping to be ignored, got %s", identity.Group)
	}
	if identity.Role != 0 {
		t.Fatalf("expected root-like claim not to be promoted, got %d", identity.Role)
	}
}

func TestJWTDirectResolveIdentityRejectsDirectPassThroughByDefault(t *testing.T) {
	privateKey := mustGenerateRSAPrivateKey(t)
	provider := NewJWTDirectProvider(&model.CustomOAuthProvider{
		Name:        "Acme SSO",
		Slug:        "acme-sso",
		Enabled:     true,
		Issuer:      "https://issuer.example.com",
		Audience:    "new-api",
		PublicKey:   mustEncodeRSAPublicKeyPEM(t, &privateKey.PublicKey),
		UserIdField: "sub",
		GroupField:  "groups",
		RoleField:   "roles",
	})

	token := mustSignJWT(t, privateKey, "", jwt.MapClaims{
		"iss":    "https://issuer.example.com",
		"aud":    "new-api",
		"sub":    "external-user-default-mode",
		"groups": []string{"default"},
		"roles":  []string{"admin"},
		"exp":    time.Now().Add(time.Hour).Unix(),
	})

	identity, err := provider.ResolveIdentity(context.Background(), token)
	if err != nil {
		t.Fatalf("expected identity resolution to succeed, got error: %v", err)
	}
	if identity.Group != "" {
		t.Fatalf("expected direct group pass-through to be disabled by default, got %s", identity.Group)
	}
	if identity.Role != 0 {
		t.Fatalf("expected direct role pass-through to be disabled by default, got %d", identity.Role)
	}
}

func TestJWTDirectResolveIdentityAllowsPassThroughInMappingFirstMode(t *testing.T) {
	privateKey := mustGenerateRSAPrivateKey(t)
	provider := NewJWTDirectProvider(&model.CustomOAuthProvider{
		Name:             "Acme SSO",
		Slug:             "acme-sso",
		Enabled:          true,
		Issuer:           "https://issuer.example.com",
		Audience:         "new-api",
		PublicKey:        mustEncodeRSAPublicKeyPEM(t, &privateKey.PublicKey),
		UserIdField:      "sub",
		GroupField:       "groups",
		RoleField:        "roles",
		GroupMappingMode: model.CustomOAuthMappingModeMappingFirst,
		RoleMappingMode:  model.CustomOAuthMappingModeMappingFirst,
	})

	token := mustSignJWT(t, privateKey, "", jwt.MapClaims{
		"iss":    "https://issuer.example.com",
		"aud":    "new-api",
		"sub":    "external-user-mapping-first",
		"groups": []string{"default"},
		"roles":  []string{"admin"},
		"exp":    time.Now().Add(time.Hour).Unix(),
	})

	identity, err := provider.ResolveIdentity(context.Background(), token)
	if err != nil {
		t.Fatalf("expected identity resolution to succeed, got error: %v", err)
	}
	if identity.Group != "default" {
		t.Fatalf("expected mapping_first group pass-through to use default, got %s", identity.Group)
	}
	if identity.Role != common.RoleAdminUser {
		t.Fatalf("expected mapping_first role pass-through to use admin, got %d", identity.Role)
	}
}

func TestJWTDirectResolveIdentityRejectsGuestRoleTargets(t *testing.T) {
	privateKey := mustGenerateRSAPrivateKey(t)
	provider := NewJWTDirectProvider(&model.CustomOAuthProvider{
		Name:            "Acme SSO",
		Slug:            "acme-sso",
		Enabled:         true,
		Issuer:          "https://issuer.example.com",
		Audience:        "new-api",
		PublicKey:       mustEncodeRSAPublicKeyPEM(t, &privateKey.PublicKey),
		UserIdField:     "sub",
		RoleField:       "roles",
		RoleMapping:     `{"member":"guest"}`,
		RoleMappingMode: model.CustomOAuthMappingModeMappingFirst,
	})

	token := mustSignJWT(t, privateKey, "", jwt.MapClaims{
		"iss":   "https://issuer.example.com",
		"aud":   "new-api",
		"sub":   "external-user-guest",
		"roles": []string{"member", "guest"},
		"exp":   time.Now().Add(time.Hour).Unix(),
	})

	identity, err := provider.ResolveIdentity(context.Background(), token)
	if err != nil {
		t.Fatalf("expected identity resolution to succeed, got error: %v", err)
	}
	if identity.Role != 0 {
		t.Fatalf("expected guest role targets to be ignored, got %d", identity.Role)
	}
}

func TestJWTDirectResolveIdentityWithJWKS(t *testing.T) {
	privateKey := mustGenerateRSAPrivateKey(t)
	jwksServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		payload, err := common.Marshal(map[string]any{
			"keys": []map[string]any{
				{
					"kty": "RSA",
					"kid": "kid-1",
					"use": "sig",
					"alg": "RS256",
					"n":   base64.RawURLEncoding.EncodeToString(privateKey.PublicKey.N.Bytes()),
					"e":   base64.RawURLEncoding.EncodeToString(bigEndianExponent(privateKey.PublicKey.E)),
				},
			},
		})
		if err != nil {
			t.Fatalf("failed to marshal jwks payload: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(payload)
	}))
	defer jwksServer.Close()

	provider := NewJWTDirectProvider(&model.CustomOAuthProvider{
		Name:        "Acme SSO",
		Slug:        "acme-sso",
		Enabled:     true,
		Issuer:      "https://issuer.example.com",
		Audience:    "new-api",
		JwksURL:     jwksServer.URL,
		UserIdField: "sub",
	})

	token := mustSignJWT(t, privateKey, "kid-1", jwt.MapClaims{
		"iss": "https://issuer.example.com",
		"aud": "new-api",
		"sub": "external-user-3",
		"exp": time.Now().Add(time.Hour).Unix(),
	})

	identity, err := provider.ResolveIdentity(context.Background(), token)
	if err != nil {
		t.Fatalf("expected jwks validation to succeed, got error: %v", err)
	}
	if identity.User.ProviderUserID != "external-user-3" {
		t.Fatalf("unexpected provider user id: %s", identity.User.ProviderUserID)
	}
}

func TestJWTDirectResolveIdentityFromInputWithTicketExchange(t *testing.T) {
	privateKey := mustGenerateRSAPrivateKey(t)
	expectedCallbackURL := "https://new-api.example.com/oauth/acme-sso"
	token := mustSignJWT(t, privateKey, "", jwt.MapClaims{
		"iss":                "https://issuer.example.com",
		"aud":                "new-api",
		"sub":                "ext-ticket-1",
		"preferred_username": "alice",
		"exp":                time.Now().Add(time.Hour).Unix(),
	})

	exchangeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("expected POST exchange method, got %s", r.Method)
		}
		if got := r.Header.Get("X-State"); got != "state-123" {
			t.Fatalf("expected X-State header to be populated, got %q", got)
		}
		if err := r.ParseForm(); err != nil {
			t.Fatalf("failed to parse form payload: %v", err)
		}
		if got := r.Form.Get("st"); got != "ticket-123" {
			t.Fatalf("expected exchanged ticket field st=ticket-123, got %q", got)
		}
		if got := r.Form.Get("service"); got != expectedCallbackURL {
			t.Fatalf("expected service field %q, got %q", expectedCallbackURL, got)
		}
		if got := r.Form.Get("source"); got != "acme-sso:state-123" {
			t.Fatalf("expected placeholder expansion result, got %q", got)
		}
		payload, err := common.Marshal(map[string]any{
			"data": map[string]any{
				"token": token,
			},
		})
		if err != nil {
			t.Fatalf("failed to marshal exchange response: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(payload)
	}))
	defer exchangeServer.Close()

	provider := NewJWTDirectProvider(&model.CustomOAuthProvider{
		Name:                       "Acme SSO",
		Slug:                       "acme-sso",
		Enabled:                    true,
		Issuer:                     "https://issuer.example.com",
		Audience:                   "new-api",
		PublicKey:                  mustEncodeRSAPublicKeyPEM(t, &privateKey.PublicKey),
		UserIdField:                "sub",
		UsernameField:              "preferred_username",
		JWTAcquireMode:             model.CustomJWTAcquireModeTicketExchange,
		TicketExchangeURL:          exchangeServer.URL,
		TicketExchangeMethod:       model.CustomTicketExchangeMethodPOST,
		TicketExchangePayloadMode:  model.CustomTicketExchangePayloadModeForm,
		TicketExchangeTicketField:  "st",
		TicketExchangeServiceField: "service",
		TicketExchangeExtraParams:  `{"source":"{provider_slug}:{state}"}`,
		TicketExchangeHeaders:      `{"X-State":"{state}"}`,
	})

	identity, err := provider.ResolveIdentityFromInput(
		context.Background(),
		"",
		"ticket-123",
		expectedCallbackURL,
		"state-123",
	)
	if err != nil {
		t.Fatalf("expected ticket exchange identity resolution to succeed, got error: %v", err)
	}
	if identity.User.ProviderUserID != "ext-ticket-1" {
		t.Fatalf("unexpected provider user id: %s", identity.User.ProviderUserID)
	}
	if identity.User.Username != "alice" {
		t.Fatalf("unexpected username: %s", identity.User.Username)
	}
}

func TestJWTDirectResolveIdentityFromInputRejectsMissingTicket(t *testing.T) {
	provider := NewJWTDirectProvider(&model.CustomOAuthProvider{
		Name:              "Acme SSO",
		Slug:              "acme-sso",
		Enabled:           true,
		JWTAcquireMode:    model.CustomJWTAcquireModeTicketExchange,
		TicketExchangeURL: "https://issuer.example.com/api/exchange",
	})

	_, err := provider.ResolveIdentityFromInput(
		context.Background(),
		"",
		"",
		"https://new-api.example.com/oauth/acme-sso",
		"state-123",
	)
	if err == nil || !strings.Contains(err.Error(), "missing ticket") {
		t.Fatalf("expected missing ticket error, got %v", err)
	}
}

func TestJWTDirectResolveIdentityFromInputRejectsExchangeFailure(t *testing.T) {
	exchangeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "invalid ticket", http.StatusUnauthorized)
	}))
	defer exchangeServer.Close()

	provider := NewJWTDirectProvider(&model.CustomOAuthProvider{
		Name:              "Acme SSO",
		Slug:              "acme-sso",
		Enabled:           true,
		JWTAcquireMode:    model.CustomJWTAcquireModeTicketExchange,
		TicketExchangeURL: exchangeServer.URL,
	})

	_, err := provider.ResolveIdentityFromInput(
		context.Background(),
		"",
		"ticket-123",
		"https://new-api.example.com/oauth/acme-sso",
		"state-123",
	)
	if err == nil || !strings.Contains(err.Error(), "ticket exchange failed") {
		t.Fatalf("expected exchange failure error, got %v", err)
	}
}

func TestJWTDirectResolveIdentityFromInputRejectsMissingTokenFromExchangeResponse(t *testing.T) {
	exchangeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		payload, err := common.Marshal(map[string]any{
			"success": true,
			"data": map[string]any{
				"user": "alice",
			},
		})
		if err != nil {
			t.Fatalf("failed to marshal exchange response: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(payload)
	}))
	defer exchangeServer.Close()

	provider := NewJWTDirectProvider(&model.CustomOAuthProvider{
		Name:                     "Acme SSO",
		Slug:                     "acme-sso",
		Enabled:                  true,
		JWTAcquireMode:           model.CustomJWTAcquireModeTicketExchange,
		TicketExchangeURL:        exchangeServer.URL,
		TicketExchangeTokenField: "data.token",
	})

	_, err := provider.ResolveIdentityFromInput(
		context.Background(),
		"",
		"ticket-123",
		"https://new-api.example.com/oauth/acme-sso",
		"state-123",
	)
	if err == nil || !strings.Contains(err.Error(), "missing jwt token") {
		t.Fatalf("expected missing jwt token error, got %v", err)
	}
}

func TestJWTDirectResolveIdentityFromInputUsesFallbackTokenField(t *testing.T) {
	privateKey := mustGenerateRSAPrivateKey(t)
	token := mustSignJWT(t, privateKey, "", jwt.MapClaims{
		"iss": "https://issuer.example.com",
		"aud": "new-api",
		"sub": "ext-ticket-fallback",
		"exp": time.Now().Add(time.Hour).Unix(),
	})
	exchangeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		payload, err := common.Marshal(map[string]any{
			"data": map[string]any{
				"access_token": token,
			},
		})
		if err != nil {
			t.Fatalf("failed to marshal exchange response: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(payload)
	}))
	defer exchangeServer.Close()

	provider := NewJWTDirectProvider(&model.CustomOAuthProvider{
		Name:              "Acme SSO",
		Slug:              "acme-sso",
		Enabled:           true,
		Issuer:            "https://issuer.example.com",
		Audience:          "new-api",
		PublicKey:         mustEncodeRSAPublicKeyPEM(t, &privateKey.PublicKey),
		UserIdField:       "sub",
		JWTAcquireMode:    model.CustomJWTAcquireModeTicketExchange,
		TicketExchangeURL: exchangeServer.URL,
	})

	identity, err := provider.ResolveIdentityFromInput(
		context.Background(),
		"",
		"ticket-123",
		"https://new-api.example.com/oauth/acme-sso",
		"state-123",
	)
	if err != nil {
		t.Fatalf("expected fallback token extraction to succeed, got error: %v", err)
	}
	if identity.User.ProviderUserID != "ext-ticket-fallback" {
		t.Fatalf("unexpected provider user id: %s", identity.User.ProviderUserID)
	}
}

func mustGenerateRSAPrivateKey(t *testing.T) *rsa.PrivateKey {
	t.Helper()
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate rsa key: %v", err)
	}
	return privateKey
}

func mustEncodeRSAPublicKeyPEM(t *testing.T, publicKey *rsa.PublicKey) string {
	t.Helper()
	publicKeyDER, err := x509.MarshalPKIXPublicKey(publicKey)
	if err != nil {
		t.Fatalf("failed to marshal rsa public key: %v", err)
	}
	return string(pem.EncodeToMemory(&pem.Block{
		Type:  "PUBLIC KEY",
		Bytes: publicKeyDER,
	}))
}

func mustSignJWT(t *testing.T, privateKey *rsa.PrivateKey, kid string, claims jwt.MapClaims) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	if kid != "" {
		token.Header["kid"] = kid
	}
	tokenString, err := token.SignedString(privateKey)
	if err != nil {
		t.Fatalf("failed to sign jwt: %v", err)
	}
	return tokenString
}

func bigEndianExponent(exponent int) []byte {
	if exponent == 0 {
		return []byte{0}
	}
	bytes := make([]byte, 0, 4)
	for exponent > 0 {
		bytes = append([]byte{byte(exponent & 0xff)}, bytes...)
		exponent >>= 8
	}
	return bytes
}
