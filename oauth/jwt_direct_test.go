package oauth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/golang-jwt/jwt/v5"
)

type asyncHandlerErrors struct {
	errors chan string
}

func newAsyncHandlerErrors() *asyncHandlerErrors {
	return &asyncHandlerErrors{errors: make(chan string, 32)}
}

func (e *asyncHandlerErrors) failRequest(w http.ResponseWriter, statusCode int, format string, args ...any) {
	message := fmt.Sprintf(format, args...)
	e.errors <- message
	http.Error(w, message, statusCode)
}

func (e *asyncHandlerErrors) check(t *testing.T) {
	t.Helper()

	var messages []string
	for {
		select {
		case message := <-e.errors:
			messages = append(messages, message)
		default:
			if len(messages) > 0 {
				t.Fatalf("%s", strings.Join(messages, "; "))
			}
			return
		}
	}
}

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
	handlerErrors := newAsyncHandlerErrors()
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
			handlerErrors.failRequest(w, http.StatusInternalServerError, "failed to marshal jwks payload: %v", err)
			return
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
	handlerErrors.check(t)
	if err != nil {
		t.Fatalf("expected jwks validation to succeed, got error: %v", err)
	}
	if identity.User.ProviderUserID != "external-user-3" {
		t.Fatalf("unexpected provider user id: %s", identity.User.ProviderUserID)
	}
}

func TestJWTDirectResolveIdentityWithUserInfoMode(t *testing.T) {
	handlerErrors := newAsyncHandlerErrors()
	userInfoServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("x-access-token"); got != "opaque-token" {
			handlerErrors.failRequest(w, http.StatusBadRequest, "expected raw token in x-access-token header, got %q", got)
			return
		}
		payload, err := common.Marshal(map[string]any{
			"info": map[string]any{
				"userCode": "1410833903245320192",
				"loginid":  "liangmingsen",
				"userName": "梁明森",
				"mailbox":  "liangmingsen@qdama.cn",
			},
		})
		if err != nil {
			handlerErrors.failRequest(w, http.StatusInternalServerError, "failed to marshal userinfo payload: %v", err)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(payload)
	}))
	defer userInfoServer.Close()

	provider := NewJWTDirectProvider(&model.CustomOAuthProvider{
		Name:             "Qdama SSO",
		Slug:             "qdama-sso",
		Enabled:          true,
		JWTIdentityMode:  model.CustomJWTIdentityModeUserInfo,
		UserInfoEndpoint: userInfoServer.URL,
		JWTHeader:        "x-access-token",
		UserIdField:      "info.userCode",
		UsernameField:    "info.loginid",
		DisplayNameField: "info.userName",
		EmailField:       "info.mailbox",
	})

	identity, err := provider.ResolveIdentity(context.Background(), "opaque-token")
	handlerErrors.check(t)
	if err != nil {
		t.Fatalf("expected userinfo mode identity resolution to succeed, got error: %v", err)
	}
	if identity.User.ProviderUserID != "1410833903245320192" {
		t.Fatalf("unexpected provider user id: %s", identity.User.ProviderUserID)
	}
	if identity.User.Username != "liangmingsen" {
		t.Fatalf("unexpected username: %s", identity.User.Username)
	}
	if identity.User.DisplayName != "梁明森" {
		t.Fatalf("unexpected display name: %s", identity.User.DisplayName)
	}
	if identity.User.Email != "liangmingsen@qdama.cn" {
		t.Fatalf("unexpected email: %s", identity.User.Email)
	}
}

func TestJWTDirectPerformTicketAcquireRequestSupportsConfiguredMethodsAndPayloadModes(t *testing.T) {
	testCases := []struct {
		name        string
		method      string
		payloadMode string
	}{
		{name: "get query", method: model.CustomTicketExchangeMethodGET, payloadMode: model.CustomTicketExchangePayloadModeQuery},
		{name: "post query", method: model.CustomTicketExchangeMethodPOST, payloadMode: model.CustomTicketExchangePayloadModeQuery},
		{name: "post form", method: model.CustomTicketExchangeMethodPOST, payloadMode: model.CustomTicketExchangePayloadModeForm},
		{name: "post json", method: model.CustomTicketExchangeMethodPOST, payloadMode: model.CustomTicketExchangePayloadModeJSON},
		{name: "post multipart", method: model.CustomTicketExchangeMethodPOST, payloadMode: model.CustomTicketExchangePayloadModeMultipart},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			callbackURL := "https://new-api.example.com/oauth/acme-sso?state=state-123"
			handlerErrors := newAsyncHandlerErrors()
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Method != testCase.method {
					handlerErrors.failRequest(w, http.StatusBadRequest, "expected method %s, got %s", testCase.method, r.Method)
					return
				}
				if got := r.Header.Get("X-State"); got != "acme-sso:state-123" {
					handlerErrors.failRequest(w, http.StatusBadRequest, "expected X-State header, got %q", got)
					return
				}
				if got := r.Header.Get("X-Ticket"); got != "ticket-123" {
					handlerErrors.failRequest(w, http.StatusBadRequest, "expected X-Ticket header, got %q", got)
					return
				}

				params := map[string]string{}
				switch {
				case testCase.method == model.CustomTicketExchangeMethodGET || testCase.payloadMode == model.CustomTicketExchangePayloadModeQuery:
					for key, values := range r.URL.Query() {
						if len(values) > 0 {
							params[key] = values[0]
						}
					}
				case testCase.payloadMode == model.CustomTicketExchangePayloadModeForm:
					if err := r.ParseForm(); err != nil {
						handlerErrors.failRequest(w, http.StatusBadRequest, "failed to parse form payload: %v", err)
						return
					}
					for key, values := range r.PostForm {
						if len(values) > 0 {
							params[key] = values[0]
						}
					}
				case testCase.payloadMode == model.CustomTicketExchangePayloadModeJSON:
					if err := common.DecodeJson(r.Body, &params); err != nil {
						handlerErrors.failRequest(w, http.StatusBadRequest, "failed to decode json payload: %v", err)
						return
					}
				case testCase.payloadMode == model.CustomTicketExchangePayloadModeMultipart:
					if err := r.ParseMultipartForm(1 << 20); err != nil {
						handlerErrors.failRequest(w, http.StatusBadRequest, "failed to parse multipart payload: %v", err)
						return
					}
					for key, values := range r.MultipartForm.Value {
						if len(values) > 0 {
							params[key] = values[0]
						}
					}
				default:
					handlerErrors.failRequest(w, http.StatusInternalServerError, "unexpected payload mode %s", testCase.payloadMode)
					return
				}

				if got := params["st"]; got != "ticket-123" {
					handlerErrors.failRequest(w, http.StatusBadRequest, "expected st=ticket-123, got %q", got)
					return
				}
				if got := params["svc"]; got != callbackURL {
					handlerErrors.failRequest(w, http.StatusBadRequest, "expected svc=%q, got %q", callbackURL, got)
					return
				}
				if got := params["source"]; got != "acme-sso:state-123" {
					handlerErrors.failRequest(w, http.StatusBadRequest, "expected source placeholder expansion, got %q", got)
					return
				}
				if got := params["raw_callback"]; got != callbackURL {
					handlerErrors.failRequest(w, http.StatusBadRequest, "expected raw_callback placeholder expansion, got %q", got)
					return
				}

				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(`{"ok":true}`))
			}))
			defer server.Close()

			provider := NewJWTDirectProvider(&model.CustomOAuthProvider{
				Name:                       "Acme SSO",
				Slug:                       "acme-sso",
				Enabled:                    true,
				JWTAcquireMode:             model.CustomJWTAcquireModeTicketExchange,
				TicketExchangeURL:          server.URL,
				TicketExchangeMethod:       testCase.method,
				TicketExchangePayloadMode:  testCase.payloadMode,
				TicketExchangeTicketField:  "st",
				TicketExchangeServiceField: "svc",
				TicketExchangeExtraParams:  `{"source":"{provider_slug}:{state}","raw_callback":"{callback_url}"}`,
				TicketExchangeHeaders:      `{"X-State":"{provider_slug}:{state}","X-Ticket":"{ticket}"}`,
			})

			body, err := provider.performTicketAcquireRequest(
				context.Background(),
				"ticket-123",
				callbackURL,
				"state-123",
			)
			handlerErrors.check(t)
			if err != nil {
				t.Fatalf("expected request to succeed, got error: %v", err)
			}
			if strings.TrimSpace(string(body)) != `{"ok":true}` {
				t.Fatalf("unexpected response body: %s", string(body))
			}
		})
	}
}

func TestJWTDirectResolveIdentityFromInputWithTicketExchange(t *testing.T) {
	privateKey := mustGenerateRSAPrivateKey(t)
	expectedCallbackURL := "https://new-api.example.com/oauth/acme-sso"
	handlerErrors := newAsyncHandlerErrors()
	token := mustSignJWT(t, privateKey, "", jwt.MapClaims{
		"iss":                "https://issuer.example.com",
		"aud":                "new-api",
		"sub":                "ext-ticket-1",
		"preferred_username": "alice",
		"exp":                time.Now().Add(time.Hour).Unix(),
	})

	exchangeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			handlerErrors.failRequest(w, http.StatusBadRequest, "expected POST exchange method, got %s", r.Method)
			return
		}
		if got := r.Header.Get("X-State"); got != "state-123" {
			handlerErrors.failRequest(w, http.StatusBadRequest, "expected X-State header to be populated, got %q", got)
			return
		}
		if err := r.ParseForm(); err != nil {
			handlerErrors.failRequest(w, http.StatusBadRequest, "failed to parse form payload: %v", err)
			return
		}
		if got := r.Form.Get("st"); got != "ticket-123" {
			handlerErrors.failRequest(w, http.StatusBadRequest, "expected exchanged ticket field st=ticket-123, got %q", got)
			return
		}
		if got := r.Form.Get("service"); got != expectedCallbackURL {
			handlerErrors.failRequest(w, http.StatusBadRequest, "expected service field %q, got %q", expectedCallbackURL, got)
			return
		}
		if got := r.Form.Get("source"); got != "acme-sso:state-123" {
			handlerErrors.failRequest(w, http.StatusBadRequest, "expected placeholder expansion result, got %q", got)
			return
		}
		payload, err := common.Marshal(map[string]any{
			"data": map[string]any{
				"token": token,
			},
		})
		if err != nil {
			handlerErrors.failRequest(w, http.StatusInternalServerError, "failed to marshal exchange response: %v", err)
			return
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
	handlerErrors.check(t)
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

func TestJWTDirectResolveIdentityFromInputWithTicketValidateXML(t *testing.T) {
	expectedCallbackURL := "https://new-api.example.com/oauth/acme-sso"
	handlerErrors := newAsyncHandlerErrors()
	validationServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.URL.Query().Get("ticket"); got != "ST-XML-123" {
			handlerErrors.failRequest(w, http.StatusBadRequest, "expected ticket query param ST-XML-123, got %q", got)
			return
		}
		if got := r.URL.Query().Get("service"); got != expectedCallbackURL {
			handlerErrors.failRequest(w, http.StatusBadRequest, "expected service query param %q, got %q", expectedCallbackURL, got)
			return
		}
		w.Header().Set("Content-Type", "application/xml")
		_, _ = w.Write([]byte(`<?xml version="1.0" encoding="UTF-8"?>
<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas">
  <cas:authenticationSuccess>
    <cas:user>ext-cas-1</cas:user>
    <cas:attributes>
      <cas:loginid>alice</cas:loginid>
      <cas:userName>Alice</cas:userName>
      <cas:mailbox>alice@example.com</cas:mailbox>
      <cas:group>engineering</cas:group>
      <cas:group>backup</cas:group>
      <cas:role>platform-admin</cas:role>
    </cas:attributes>
  </cas:authenticationSuccess>
</cas:serviceResponse>`))
	}))
	defer validationServer.Close()

	provider := NewJWTDirectProvider(&model.CustomOAuthProvider{
		Name:                       "CAS SSO",
		Slug:                       "cas-sso",
		Enabled:                    true,
		JWTAcquireMode:             model.CustomJWTAcquireModeTicketValidate,
		TicketExchangeURL:          validationServer.URL,
		TicketExchangeMethod:       model.CustomTicketExchangeMethodGET,
		TicketExchangePayloadMode:  model.CustomTicketExchangePayloadModeQuery,
		TicketExchangeTicketField:  "ticket",
		TicketExchangeServiceField: "service",
		UserIdField:                "authenticationSuccess.user",
		UsernameField:              "authenticationSuccess.attributes.loginid",
		DisplayNameField:           "authenticationSuccess.attributes.userName",
		EmailField:                 "authenticationSuccess.attributes.mailbox",
		GroupField:                 "authenticationSuccess.attributes.group",
		GroupMapping:               `{"engineering":"vip"}`,
		RoleField:                  "authenticationSuccess.attributes.role",
		RoleMapping:                `{"platform-admin":"admin"}`,
	})

	identity, err := provider.ResolveIdentityFromInput(
		context.Background(),
		"",
		"ST-XML-123",
		expectedCallbackURL,
		"state-xml",
	)
	handlerErrors.check(t)
	if err != nil {
		t.Fatalf("expected ticket validation xml identity resolution to succeed, got error: %v", err)
	}
	if identity.User.ProviderUserID != "ext-cas-1" {
		t.Fatalf("unexpected provider user id: %s", identity.User.ProviderUserID)
	}
	if identity.User.Username != "alice" || identity.User.DisplayName != "Alice" || identity.User.Email != "alice@example.com" {
		t.Fatalf("unexpected mapped user: %+v", identity.User)
	}
	if identity.Group != "vip" {
		t.Fatalf("expected mapped group vip, got %s", identity.Group)
	}
	if identity.Role != common.RoleAdminUser {
		t.Fatalf("expected mapped admin role, got %d", identity.Role)
	}
}

func TestJWTDirectResolveIdentityFromInputWithTicketValidateJSON(t *testing.T) {
	handlerErrors := newAsyncHandlerErrors()
	validationServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		payload, err := common.Marshal(map[string]any{
			"serviceResponse": map[string]any{
				"authenticationSuccess": map[string]any{
					"user": "ext-cas-json-1",
					"attributes": map[string]any{
						"loginid":  "bob",
						"userName": "Bob",
						"mailbox":  "bob@example.com",
					},
				},
			},
		})
		if err != nil {
			handlerErrors.failRequest(w, http.StatusInternalServerError, "failed to marshal validation response: %v", err)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(payload)
	}))
	defer validationServer.Close()

	provider := NewJWTDirectProvider(&model.CustomOAuthProvider{
		Name:                      "CAS JSON",
		Slug:                      "cas-json",
		Enabled:                   true,
		JWTAcquireMode:            model.CustomJWTAcquireModeTicketValidate,
		TicketExchangeURL:         validationServer.URL,
		TicketExchangeMethod:      model.CustomTicketExchangeMethodGET,
		TicketExchangePayloadMode: model.CustomTicketExchangePayloadModeQuery,
		UserIdField:               "serviceResponse.authenticationSuccess.user",
		UsernameField:             "serviceResponse.authenticationSuccess.attributes.loginid",
		DisplayNameField:          "serviceResponse.authenticationSuccess.attributes.userName",
		EmailField:                "serviceResponse.authenticationSuccess.attributes.mailbox",
	})

	identity, err := provider.ResolveIdentityFromInput(
		context.Background(),
		"",
		"ST-JSON-123",
		"https://new-api.example.com/oauth/cas-json",
		"state-json",
	)
	handlerErrors.check(t)
	if err != nil {
		t.Fatalf("expected ticket validation json identity resolution to succeed, got error: %v", err)
	}
	if identity.User.ProviderUserID != "ext-cas-json-1" || identity.User.Username != "bob" {
		t.Fatalf("unexpected mapped user: %+v", identity.User)
	}
}

func TestJWTDirectResolveIdentityFromInputWithTicketValidatePOSTJSON(t *testing.T) {
	expectedCallbackURL := "https://new-api.example.com/oauth/cas-json-post"
	handlerErrors := newAsyncHandlerErrors()
	validationServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			handlerErrors.failRequest(w, http.StatusBadRequest, "expected POST method, got %s", r.Method)
			return
		}
		if got := r.Header.Get("X-Trace"); got != "cas-json-post:state-json-post" {
			handlerErrors.failRequest(w, http.StatusBadRequest, "expected X-Trace header, got %q", got)
			return
		}

		var payload map[string]string
		if err := common.DecodeJson(r.Body, &payload); err != nil {
			handlerErrors.failRequest(w, http.StatusBadRequest, "failed to decode validation payload: %v", err)
			return
		}
		if got := payload["st"]; got != "ST-JSON-POST-123" {
			handlerErrors.failRequest(w, http.StatusBadRequest, "expected custom ticket field st, got %q", got)
			return
		}
		if got := payload["svc"]; got != expectedCallbackURL {
			handlerErrors.failRequest(w, http.StatusBadRequest, "expected custom service field svc, got %q", got)
			return
		}
		if got := payload["source"]; got != "cas-json-post:state-json-post" {
			handlerErrors.failRequest(w, http.StatusBadRequest, "expected source placeholder expansion, got %q", got)
			return
		}

		responseBody, err := common.Marshal(map[string]any{
			"authenticationSuccess": map[string]any{
				"user": "ext-cas-json-post-1",
				"attributes": map[string]any{
					"loginid":  "dora",
					"userName": "Dora",
					"mailbox":  "dora@example.com",
				},
			},
		})
		if err != nil {
			handlerErrors.failRequest(w, http.StatusInternalServerError, "failed to marshal validation response: %v", err)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(responseBody)
	}))
	defer validationServer.Close()

	provider := NewJWTDirectProvider(&model.CustomOAuthProvider{
		Name:                       "CAS JSON POST",
		Slug:                       "cas-json-post",
		Enabled:                    true,
		JWTAcquireMode:             model.CustomJWTAcquireModeTicketValidate,
		TicketExchangeURL:          validationServer.URL,
		TicketExchangeMethod:       model.CustomTicketExchangeMethodPOST,
		TicketExchangePayloadMode:  model.CustomTicketExchangePayloadModeJSON,
		TicketExchangeTicketField:  "st",
		TicketExchangeServiceField: "svc",
		TicketExchangeExtraParams:  `{"source":"{provider_slug}:{state}"}`,
		TicketExchangeHeaders:      `{"X-Trace":"{provider_slug}:{state}"}`,
		UserIdField:                "authenticationSuccess.user",
		UsernameField:              "authenticationSuccess.attributes.loginid",
		DisplayNameField:           "authenticationSuccess.attributes.userName",
		EmailField:                 "authenticationSuccess.attributes.mailbox",
	})

	identity, err := provider.ResolveIdentityFromInput(
		context.Background(),
		"",
		"ST-JSON-POST-123",
		expectedCallbackURL,
		"state-json-post",
	)
	handlerErrors.check(t)
	if err != nil {
		t.Fatalf("expected ticket validation post json identity resolution to succeed, got error: %v", err)
	}
	if identity.User.ProviderUserID != "ext-cas-json-post-1" || identity.User.Username != "dora" {
		t.Fatalf("unexpected mapped user: %+v", identity.User)
	}
}

func TestJWTDirectResolveIdentityFromInputWithTicketValidateDirectJSON(t *testing.T) {
	handlerErrors := newAsyncHandlerErrors()
	validationServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		payload, err := common.Marshal(map[string]any{
			"id":           "custom-validate-1",
			"username":     "carol",
			"display_name": "Carol",
			"email":        "carol@example.com",
		})
		if err != nil {
			handlerErrors.failRequest(w, http.StatusInternalServerError, "failed to marshal direct json validation response: %v", err)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(payload)
	}))
	defer validationServer.Close()

	provider := NewJWTDirectProvider(&model.CustomOAuthProvider{
		Name:                      "Custom Validator",
		Slug:                      "custom-validator",
		Enabled:                   true,
		JWTAcquireMode:            model.CustomJWTAcquireModeTicketValidate,
		TicketExchangeURL:         validationServer.URL,
		TicketExchangeMethod:      model.CustomTicketExchangeMethodGET,
		TicketExchangePayloadMode: model.CustomTicketExchangePayloadModeQuery,
		UserIdField:               "id",
		UsernameField:             "username",
		DisplayNameField:          "display_name",
		EmailField:                "email",
	})

	identity, err := provider.ResolveIdentityFromInput(
		context.Background(),
		"",
		"ST-DIRECT-123",
		"https://new-api.example.com/oauth/custom-validator",
		"state-direct",
	)
	handlerErrors.check(t)
	if err != nil {
		t.Fatalf("expected direct json ticket validation to succeed, got error: %v", err)
	}
	if identity.User.ProviderUserID != "custom-validate-1" || identity.User.Username != "carol" {
		t.Fatalf("unexpected mapped user: %+v", identity.User)
	}
}

func TestJWTDirectResolveIdentityFromInputRejectsTicketValidationFailure(t *testing.T) {
	handlerErrors := newAsyncHandlerErrors()
	validationServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		payload, err := common.Marshal(map[string]any{
			"serviceResponse": map[string]any{
				"authenticationFailure": map[string]any{
					"code":    "INVALID_TICKET",
					"message": "ticket expired",
				},
			},
		})
		if err != nil {
			handlerErrors.failRequest(w, http.StatusInternalServerError, "failed to marshal failure response: %v", err)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(payload)
	}))
	defer validationServer.Close()

	provider := NewJWTDirectProvider(&model.CustomOAuthProvider{
		Name:                      "CAS Failure",
		Slug:                      "cas-failure",
		Enabled:                   true,
		JWTAcquireMode:            model.CustomJWTAcquireModeTicketValidate,
		TicketExchangeURL:         validationServer.URL,
		TicketExchangeMethod:      model.CustomTicketExchangeMethodGET,
		TicketExchangePayloadMode: model.CustomTicketExchangePayloadModeQuery,
		UserIdField:               "authenticationSuccess.user",
	})

	_, err := provider.ResolveIdentityFromInput(
		context.Background(),
		"",
		"ST-FAIL-123",
		"https://new-api.example.com/oauth/cas-failure",
		"state-fail",
	)
	handlerErrors.check(t)
	if err == nil {
		t.Fatal("expected ticket validation failure to be rejected")
	}
	if !strings.Contains(err.Error(), "ticket validation failed") {
		t.Fatalf("expected ticket validation failure error, got %v", err)
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
	if err == nil || !strings.Contains(err.Error(), "ticket acquire failed") {
		t.Fatalf("expected exchange failure error, got %v", err)
	}
}

func TestJWTDirectResolveIdentityFromInputRejectsMissingTokenFromExchangeResponse(t *testing.T) {
	handlerErrors := newAsyncHandlerErrors()
	exchangeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		payload, err := common.Marshal(map[string]any{
			"success": true,
			"data": map[string]any{
				"user": "alice",
			},
		})
		if err != nil {
			handlerErrors.failRequest(w, http.StatusInternalServerError, "failed to marshal exchange response: %v", err)
			return
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
	handlerErrors.check(t)
	if err == nil || !strings.Contains(err.Error(), "missing jwt token") {
		t.Fatalf("expected missing jwt token error, got %v", err)
	}
}

func TestJWTDirectResolveIdentityFromInputUsesFallbackTokenField(t *testing.T) {
	privateKey := mustGenerateRSAPrivateKey(t)
	handlerErrors := newAsyncHandlerErrors()
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
			handlerErrors.failRequest(w, http.StatusInternalServerError, "failed to marshal exchange response: %v", err)
			return
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
	handlerErrors.check(t)
	if err != nil {
		t.Fatalf("expected fallback token extraction to succeed, got error: %v", err)
	}
	if identity.User.ProviderUserID != "ext-ticket-fallback" {
		t.Fatalf("unexpected provider user id: %s", identity.User.ProviderUserID)
	}
}

func TestJWTDirectResolveIdentityFromInputWithTicketExchangeAndUserInfoMode(t *testing.T) {
	handlerErrors := newAsyncHandlerErrors()
	exchangeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		payload, err := common.Marshal(map[string]any{
			"data": map[string]any{
				"access_token": "opaque-access-token",
			},
		})
		if err != nil {
			handlerErrors.failRequest(w, http.StatusInternalServerError, "failed to marshal exchange response: %v", err)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(payload)
	}))
	defer exchangeServer.Close()

	userInfoServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("x-access-token"); got != "opaque-access-token" {
			handlerErrors.failRequest(w, http.StatusBadRequest, "expected exchanged token in x-access-token header, got %q", got)
			return
		}
		payload, err := common.Marshal(map[string]any{
			"info": map[string]any{
				"userCode": "1410833903245320192",
				"loginid":  "liangmingsen",
				"userName": "梁明森",
				"mailbox":  "liangmingsen@qdama.cn",
			},
		})
		if err != nil {
			handlerErrors.failRequest(w, http.StatusInternalServerError, "failed to marshal userinfo payload: %v", err)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(payload)
	}))
	defer userInfoServer.Close()

	provider := NewJWTDirectProvider(&model.CustomOAuthProvider{
		Name:                       "Qdama SSO",
		Slug:                       "qdama-sso",
		Enabled:                    true,
		JWTIdentityMode:            model.CustomJWTIdentityModeUserInfo,
		UserInfoEndpoint:           userInfoServer.URL,
		JWTHeader:                  "x-access-token",
		UserIdField:                "info.userCode",
		UsernameField:              "info.loginid",
		DisplayNameField:           "info.userName",
		EmailField:                 "info.mailbox",
		JWTAcquireMode:             model.CustomJWTAcquireModeTicketExchange,
		TicketExchangeURL:          exchangeServer.URL,
		TicketExchangeMethod:       model.CustomTicketExchangeMethodGET,
		TicketExchangePayloadMode:  model.CustomTicketExchangePayloadModeQuery,
		TicketExchangeTicketField:  "ticket",
		TicketExchangeTokenField:   "data.access_token",
		TicketExchangeServiceField: "service",
	})

	identity, err := provider.ResolveIdentityFromInput(
		context.Background(),
		"",
		"ST-123",
		"https://new-api.example.com/oauth/qdama-sso?state=abc",
		"abc",
	)
	handlerErrors.check(t)
	if err != nil {
		t.Fatalf("expected ticket exchange + userinfo mode to succeed, got error: %v", err)
	}
	if identity.User.ProviderUserID != "1410833903245320192" {
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
