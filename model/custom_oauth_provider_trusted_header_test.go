package model

import "testing"

func TestValidateTrustedHeaderProviderRequiresTrustedProxyCIDRs(t *testing.T) {
	provider := &CustomOAuthProvider{
		Name:             "Trusted Header",
		Slug:             "trusted-header",
		Kind:             CustomOAuthProviderKindTrustedHeader,
		ExternalIDHeader: "X-Auth-User-Id",
	}
	if err := validateCustomOAuthProvider(provider); err == nil {
		t.Fatal("expected trusted_header provider without trusted_proxy_cidrs to fail")
	}
}

func TestValidateTrustedHeaderProviderRequiresExternalIDHeader(t *testing.T) {
	provider := &CustomOAuthProvider{
		Name:              "Trusted Header",
		Slug:              "trusted-header",
		Kind:              CustomOAuthProviderKindTrustedHeader,
		TrustedProxyCIDRs: `["127.0.0.1/32"]`,
	}
	if err := validateCustomOAuthProvider(provider); err == nil {
		t.Fatal("expected trusted_header provider without external_id_header to fail")
	}
}

func TestTrustedHeaderProviderSupportsBrowserLoginWhenConfigured(t *testing.T) {
	provider := &CustomOAuthProvider{
		Kind:              CustomOAuthProviderKindTrustedHeader,
		Enabled:           true,
		TrustedProxyCIDRs: `["127.0.0.1/32"]`,
		ExternalIDHeader:  "X-Auth-User-Id",
	}
	if !provider.SupportsBrowserLogin() {
		t.Fatal("expected trusted_header provider to support browser login when enabled and configured")
	}
}

func TestTrustedHeaderProviderDoesNotSupportBrowserLoginWithoutTrustedProxyCIDRs(t *testing.T) {
	provider := &CustomOAuthProvider{
		Kind:             CustomOAuthProviderKindTrustedHeader,
		Enabled:          true,
		ExternalIDHeader: "X-Auth-User-Id",
	}
	if provider.SupportsBrowserLogin() {
		t.Fatal("expected trusted_header provider without trusted_proxy_cidrs not to support browser login")
	}
}

func TestValidateTrustedHeaderProviderRejectsCatchAllCIDR(t *testing.T) {
	provider := &CustomOAuthProvider{
		Name:              "Trusted Header",
		Slug:              "trusted-header",
		Kind:              CustomOAuthProviderKindTrustedHeader,
		TrustedProxyCIDRs: `["0.0.0.0/0"]`,
		ExternalIDHeader:  "X-Auth-User-Id",
	}
	if err := validateCustomOAuthProvider(provider); err == nil {
		t.Fatal("expected trusted_header provider with catch-all cidr to fail")
	}
}

func TestJWTUserInfoDirectProviderDoesNotSupportBrowserLogin(t *testing.T) {
	provider := &CustomOAuthProvider{
		Kind:                  CustomOAuthProviderKindJWTDirect,
		Enabled:               true,
		ClientId:              "client-id",
		AuthorizationEndpoint: "https://issuer.example.com/oauth2/authorize",
		JWTIdentityMode:       CustomJWTIdentityModeUserInfo,
		JWTAcquireMode:        CustomJWTAcquireModeDirectToken,
	}
	if provider.SupportsBrowserLogin() {
		t.Fatal("expected jwt_direct userinfo direct_token provider not to support browser login")
	}
}
