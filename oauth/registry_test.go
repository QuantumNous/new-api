package oauth

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestRegisterOrUpdateCustomProviderSkipsJWTDirect(t *testing.T) {
	slug := "jwt-direct-test-provider"
	UnregisterCustomProvider(slug)
	t.Cleanup(func() {
		UnregisterCustomProvider(slug)
	})

	RegisterOrUpdateCustomProvider(&model.CustomOAuthProvider{
		Name:                  "OAuth Code Test",
		Slug:                  slug,
		Kind:                  model.CustomOAuthProviderKindOAuthCode,
		ClientId:              "client-id",
		AuthorizationEndpoint: "https://issuer.example.com/oauth2/authorize",
		TokenEndpoint:         "https://issuer.example.com/oauth2/token",
		UserInfoEndpoint:      "https://issuer.example.com/oauth2/userinfo",
	})

	if provider := GetProvider(slug); provider == nil {
		t.Fatalf("expected oauth_code provider %s to be registered before switching kinds", slug)
	}
	if !IsCustomProvider(slug) {
		t.Fatalf("expected oauth_code provider %s to be marked as custom provider before switching kinds", slug)
	}

	RegisterOrUpdateCustomProvider(&model.CustomOAuthProvider{
		Name: "JWT Direct Test",
		Slug: slug,
		Kind: model.CustomOAuthProviderKindJWTDirect,
	})

	if provider := GetProvider(slug); provider != nil {
		t.Fatalf("expected jwt_direct provider %s to be excluded from oauth registry", slug)
	}
	if IsCustomProvider(slug) {
		t.Fatalf("expected jwt_direct provider %s not to be marked as registry custom provider", slug)
	}
}

func TestRegisterOrUpdateCustomProviderKeepsOAuthCode(t *testing.T) {
	slug := "oauth-code-test-provider"
	UnregisterCustomProvider(slug)
	t.Cleanup(func() {
		UnregisterCustomProvider(slug)
	})

	RegisterOrUpdateCustomProvider(&model.CustomOAuthProvider{
		Name:                  "OAuth Code Test",
		Slug:                  slug,
		Kind:                  model.CustomOAuthProviderKindOAuthCode,
		ClientId:              "client-id",
		AuthorizationEndpoint: "https://issuer.example.com/oauth2/authorize",
		TokenEndpoint:         "https://issuer.example.com/oauth2/token",
		UserInfoEndpoint:      "https://issuer.example.com/oauth2/userinfo",
	})

	if provider := GetProvider(slug); provider == nil {
		t.Fatalf("expected oauth_code provider %s to remain in oauth registry", slug)
	}
	if !IsCustomProvider(slug) {
		t.Fatalf("expected oauth_code provider %s to be marked as registry custom provider", slug)
	}
}
