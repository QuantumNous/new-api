package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func TestUpdateCustomOAuthProviderAllowsClearingJWTOptionalFields(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)

	provider := &model.CustomOAuthProvider{
		Name:                  "Acme SSO",
		Slug:                  "acme-sso",
		Kind:                  model.CustomOAuthProviderKindJWTDirect,
		Enabled:               true,
		ClientId:              "new-api-client",
		AuthorizationEndpoint: "https://issuer.example.com/oauth2/authorize",
		Scopes:                "openid profile email",
		Issuer:                "https://issuer.example.com",
		Audience:              "new-api",
		JwksURL:               "https://issuer.example.com/.well-known/jwks.json",
		UserIdField:           "sub",
		GroupField:            "groups",
		RoleField:             "roles",
		GroupMapping:          `{"engineering":"vip"}`,
		RoleMapping:           `{"platform-admin":"admin"}`,
	}
	if err := model.CreateCustomOAuthProvider(provider); err != nil {
		t.Fatalf("failed to create provider: %v", err)
	}

	payload, err := common.Marshal(map[string]any{
		"name":                   provider.Name,
		"slug":                   provider.Slug,
		"kind":                   model.CustomOAuthProviderKindJWTDirect,
		"enabled":                true,
		"client_id":              provider.ClientId,
		"authorization_endpoint": "",
		"issuer":                 provider.Issuer,
		"audience":               "",
		"jwks_url":               provider.JwksURL,
		"user_id_field":          provider.UserIdField,
		"group_field":            "",
		"role_field":             "",
		"group_mapping":          "",
		"role_mapping":           "",
	})
	if err != nil {
		t.Fatalf("failed to marshal update payload: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(provider.Id)}}
	ctx.Request = httptest.NewRequest(http.MethodPut, "/api/custom-oauth-provider/"+strconv.Itoa(provider.Id), bytes.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")

	UpdateCustomOAuthProvider(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200 response, got %d with body %s", recorder.Code, recorder.Body.String())
	}

	updatedProvider, err := model.GetCustomOAuthProviderById(provider.Id)
	if err != nil {
		t.Fatalf("failed to reload provider: %v", err)
	}
	if updatedProvider.AuthorizationEndpoint != "" {
		t.Fatalf("expected authorization_endpoint to be cleared, got %q", updatedProvider.AuthorizationEndpoint)
	}
	if updatedProvider.Audience != "" {
		t.Fatalf("expected audience to be cleared, got %q", updatedProvider.Audience)
	}
	if updatedProvider.GroupField != "" {
		t.Fatalf("expected group_field to be cleared, got %q", updatedProvider.GroupField)
	}
	if updatedProvider.RoleField != "" {
		t.Fatalf("expected role_field to be cleared, got %q", updatedProvider.RoleField)
	}
	if updatedProvider.GroupMapping != "" || updatedProvider.RoleMapping != "" {
		t.Fatalf("expected mappings to be cleared, got group=%q role=%q", updatedProvider.GroupMapping, updatedProvider.RoleMapping)
	}
}

func TestUpdateCustomOAuthProviderRejectsUnsupportedJWTSyncRoleTargets(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)

	provider := &model.CustomOAuthProvider{
		Name:                  "Acme SSO",
		Slug:                  "acme-sso",
		Kind:                  model.CustomOAuthProviderKindJWTDirect,
		Enabled:               true,
		ClientId:              "new-api-client",
		AuthorizationEndpoint: "https://issuer.example.com/oauth2/authorize",
		Scopes:                "openid profile email",
		Issuer:                "https://issuer.example.com",
		Audience:              "new-api",
		JwksURL:               "https://issuer.example.com/.well-known/jwks.json",
		UserIdField:           "sub",
		RoleField:             "roles",
		RoleMapping:           `{"platform-admin":"admin"}`,
	}
	if err := model.CreateCustomOAuthProvider(provider); err != nil {
		t.Fatalf("failed to create provider: %v", err)
	}

	payload, err := common.Marshal(map[string]any{
		"role_mapping": `{"member":"guest"}`,
	})
	if err != nil {
		t.Fatalf("failed to marshal update payload: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(provider.Id)}}
	ctx.Request = httptest.NewRequest(http.MethodPut, "/api/custom-oauth-provider/"+strconv.Itoa(provider.Id), bytes.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")

	UpdateCustomOAuthProvider(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200 response envelope, got %d with body %s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "\"success\":false") {
		t.Fatalf("expected update to fail for unsupported role target, got body %s", recorder.Body.String())
	}
}

func TestUpdateCustomOAuthProviderRejectsInvalidTicketExchangeURL(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)

	provider := &model.CustomOAuthProvider{
		Name:                  "Acme SSO",
		Slug:                  "acme-sso",
		Kind:                  model.CustomOAuthProviderKindJWTDirect,
		Enabled:               true,
		AuthorizationEndpoint: "https://issuer.example.com/oauth2/authorize",
		Issuer:                "https://issuer.example.com",
		JwksURL:               "https://issuer.example.com/.well-known/jwks.json",
		UserIdField:           "sub",
	}
	if err := model.CreateCustomOAuthProvider(provider); err != nil {
		t.Fatalf("failed to create provider: %v", err)
	}

	payload, err := common.Marshal(map[string]any{
		"jwt_acquire_mode":    model.CustomJWTAcquireModeTicketExchange,
		"ticket_exchange_url": "not-a-url",
	})
	if err != nil {
		t.Fatalf("failed to marshal update payload: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(provider.Id)}}
	ctx.Request = httptest.NewRequest(http.MethodPut, "/api/custom-oauth-provider/"+strconv.Itoa(provider.Id), bytes.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")

	UpdateCustomOAuthProvider(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200 response envelope, got %d with body %s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "\"success\":false") {
		t.Fatalf("expected invalid ticket_exchange_url to fail, got body %s", recorder.Body.String())
	}
}

func TestUpdateCustomOAuthProviderAllowsJWTUserInfoModeWithoutVerificationKey(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)

	provider := &model.CustomOAuthProvider{
		Name:                  "Qdama SSO",
		Slug:                  "qdama-sso",
		Kind:                  model.CustomOAuthProviderKindJWTDirect,
		Enabled:               true,
		AuthorizationEndpoint: "https://cas.qdama.cn/login",
		Issuer:                "https://issuer.example.com",
		JwksURL:               "https://issuer.example.com/.well-known/jwks.json",
		UserIdField:           "sub",
	}
	if err := model.CreateCustomOAuthProvider(provider); err != nil {
		t.Fatalf("failed to create provider: %v", err)
	}

	payload, err := common.Marshal(map[string]any{
		"jwt_identity_mode":  model.CustomJWTIdentityModeUserInfo,
		"issuer":             "",
		"jwks_url":           "",
		"public_key":         "",
		"user_info_endpoint": "https://my-api.qdama.cn/v1/api/my/pc/getInfo",
		"jwt_header":         "x-access-token",
		"user_id_field":      "info.userCode",
	})
	if err != nil {
		t.Fatalf("failed to marshal update payload: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(provider.Id)}}
	ctx.Request = httptest.NewRequest(http.MethodPut, "/api/custom-oauth-provider/"+strconv.Itoa(provider.Id), bytes.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")

	UpdateCustomOAuthProvider(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200 response, got %d with body %s", recorder.Code, recorder.Body.String())
	}
	if strings.Contains(recorder.Body.String(), "\"success\":false") {
		t.Fatalf("expected userinfo mode update to succeed, got body %s", recorder.Body.String())
	}
}

func TestUpdateCustomOAuthProviderRejectsTicketValidateWithUserInfoMode(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)

	provider := &model.CustomOAuthProvider{
		Name:                  "CAS SSO",
		Slug:                  "cas-sso",
		Kind:                  model.CustomOAuthProviderKindJWTDirect,
		Enabled:               true,
		AuthorizationEndpoint: "https://cas.example.com/login",
		Issuer:                "https://issuer.example.com",
		JwksURL:               "https://issuer.example.com/.well-known/jwks.json",
		UserIdField:           "sub",
	}
	if err := model.CreateCustomOAuthProvider(provider); err != nil {
		t.Fatalf("failed to create provider: %v", err)
	}

	payload, err := common.Marshal(map[string]any{
		"jwt_acquire_mode":    model.CustomJWTAcquireModeTicketValidate,
		"jwt_identity_mode":   model.CustomJWTIdentityModeUserInfo,
		"ticket_exchange_url": "https://cas.example.com/serviceValidate",
		"user_info_endpoint":  "https://api.example.com/userinfo",
	})
	if err != nil {
		t.Fatalf("failed to marshal update payload: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(provider.Id)}}
	ctx.Request = httptest.NewRequest(http.MethodPut, "/api/custom-oauth-provider/"+strconv.Itoa(provider.Id), bytes.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")

	UpdateCustomOAuthProvider(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200 response envelope, got %d with body %s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "\"success\":false") {
		t.Fatalf("expected ticket_validate + userinfo update to fail, got body %s", recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "ticket_validate mode only support claims") {
		t.Fatalf("expected ticket_validate userinfo validation message, got body %s", recorder.Body.String())
	}
}

func TestUpdateCustomOAuthProviderAllowsClearingClientSecret(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)

	provider := &model.CustomOAuthProvider{
		Name:                  "Acme OAuth",
		Slug:                  "acme-oauth",
		Kind:                  model.CustomOAuthProviderKindOAuthCode,
		Enabled:               true,
		ClientId:              "client-id",
		ClientSecret:          "secret-to-clear",
		AuthorizationEndpoint: "https://issuer.example.com/oauth2/authorize",
		TokenEndpoint:         "https://issuer.example.com/oauth2/token",
		UserInfoEndpoint:      "https://issuer.example.com/oauth2/userinfo",
		UserIdField:           "id",
	}
	if err := model.CreateCustomOAuthProvider(provider); err != nil {
		t.Fatalf("failed to create provider: %v", err)
	}

	payload, err := common.Marshal(map[string]any{
		"client_secret": "",
	})
	if err != nil {
		t.Fatalf("failed to marshal update payload: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(provider.Id)}}
	ctx.Request = httptest.NewRequest(http.MethodPut, "/api/custom-oauth-provider/"+strconv.Itoa(provider.Id), bytes.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")

	UpdateCustomOAuthProvider(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200 response, got %d with body %s", recorder.Code, recorder.Body.String())
	}

	updatedProvider, err := model.GetCustomOAuthProviderById(provider.Id)
	if err != nil {
		t.Fatalf("failed to reload provider: %v", err)
	}
	if updatedProvider.ClientSecret != "" {
		t.Fatalf("expected client_secret to be cleared, got %q", updatedProvider.ClientSecret)
	}
}

func TestUpdateCustomOAuthProviderRejectsTrustedHeaderWithoutTrustedProxyCIDRs(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)

	provider := &model.CustomOAuthProvider{
		Name:              "Trusted Header",
		Slug:              "trusted-header",
		Kind:              model.CustomOAuthProviderKindTrustedHeader,
		Enabled:           true,
		TrustedProxyCIDRs: `["127.0.0.1/32"]`,
		ExternalIDHeader:  "X-Auth-User-Id",
	}
	if err := model.CreateCustomOAuthProvider(provider); err != nil {
		t.Fatalf("failed to create provider: %v", err)
	}

	payload, err := common.Marshal(map[string]any{
		"trusted_proxy_cidrs": "",
	})
	if err != nil {
		t.Fatalf("failed to marshal update payload: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(provider.Id)}}
	ctx.Request = httptest.NewRequest(http.MethodPut, "/api/custom-oauth-provider/"+strconv.Itoa(provider.Id), bytes.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")

	UpdateCustomOAuthProvider(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200 response envelope, got %d with body %s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "\"success\":false") {
		t.Fatalf("expected trusted_header without cidrs to fail, got body %s", recorder.Body.String())
	}
}

func TestUpdateCustomOAuthProviderRejectsTrustedHeaderWithoutExternalIDHeader(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)

	provider := &model.CustomOAuthProvider{
		Name:              "Trusted Header",
		Slug:              "trusted-header",
		Kind:              model.CustomOAuthProviderKindTrustedHeader,
		Enabled:           true,
		TrustedProxyCIDRs: `["127.0.0.1/32"]`,
		ExternalIDHeader:  "X-Auth-User-Id",
	}
	if err := model.CreateCustomOAuthProvider(provider); err != nil {
		t.Fatalf("failed to create provider: %v", err)
	}

	payload, err := common.Marshal(map[string]any{
		"external_id_header": "",
	})
	if err != nil {
		t.Fatalf("failed to marshal update payload: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(provider.Id)}}
	ctx.Request = httptest.NewRequest(http.MethodPut, "/api/custom-oauth-provider/"+strconv.Itoa(provider.Id), bytes.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")

	UpdateCustomOAuthProvider(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200 response envelope, got %d with body %s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "\"success\":false") {
		t.Fatalf("expected trusted_header without external id header to fail, got body %s", recorder.Body.String())
	}
}

func TestUpdateCustomOAuthProviderSwitchesJWTDirectToTrustedHeaderAndClearsIrrelevantFields(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)

	provider := &model.CustomOAuthProvider{
		Name:                       "Acme SSO",
		Slug:                       "acme-sso",
		Kind:                       model.CustomOAuthProviderKindJWTDirect,
		Enabled:                    true,
		ClientId:                   "new-api-client",
		ClientSecret:               "secret",
		AuthorizationEndpoint:      "https://issuer.example.com/oauth2/authorize",
		UserInfoEndpoint:           "https://issuer.example.com/oauth2/userinfo",
		Scopes:                     "openid profile email",
		Issuer:                     "https://issuer.example.com",
		Audience:                   "new-api",
		JwksURL:                    "https://issuer.example.com/.well-known/jwks.json",
		PublicKey:                  "pem",
		JWTSource:                  model.CustomJWTSourceFragment,
		JWTHeader:                  "x-access-token",
		JWTIdentityMode:            model.CustomJWTIdentityModeClaims,
		JWTAcquireMode:             model.CustomJWTAcquireModeTicketExchange,
		AuthorizationServiceField:  "service",
		TicketExchangeURL:          "https://issuer.example.com/api/exchange",
		TicketExchangeMethod:       model.CustomTicketExchangeMethodPOST,
		TicketExchangePayloadMode:  model.CustomTicketExchangePayloadModeJSON,
		TicketExchangeTicketField:  "ticket",
		TicketExchangeTokenField:   "data.token",
		TicketExchangeServiceField: "service",
		TicketExchangeExtraParams:  `{"source":"test"}`,
		TicketExchangeHeaders:      `{"Authorization":"Bearer test"}`,
		UserIdField:                "sub",
		UsernameField:              "preferred_username",
		DisplayNameField:           "name",
		EmailField:                 "email",
		GroupField:                 "groups",
		RoleField:                  "roles",
		GroupMapping:               `{"engineering":"vip"}`,
		RoleMapping:                `{"platform-admin":"admin"}`,
		AutoRegister:               true,
		AutoMergeByEmail:           true,
		SyncGroupOnLogin:           true,
		SyncRoleOnLogin:            true,
		GroupMappingMode:           model.CustomOAuthMappingModeExplicitOnly,
		RoleMappingMode:            model.CustomOAuthMappingModeExplicitOnly,
		AccessPolicy:               `{"logic":"and","conditions":[{"field":"email_verified","op":"eq","value":true}]}`,
		AccessDeniedMessage:        "denied",
	}
	if err := model.CreateCustomOAuthProvider(provider); err != nil {
		t.Fatalf("failed to create provider: %v", err)
	}

	payload, err := common.Marshal(map[string]any{
		"kind":                model.CustomOAuthProviderKindTrustedHeader,
		"trusted_proxy_cidrs": `["127.0.0.1/32"]`,
		"external_id_header":  "X-Auth-User-Id",
		"username_header":     "X-Auth-Username",
		"group_header":        "X-Auth-Group",
		"role_header":         "X-Auth-Role",
		"group_mapping":       `{"engineering":"vip"}`,
		"role_mapping":        `{"platform-admin":"admin"}`,
	})
	if err != nil {
		t.Fatalf("failed to marshal update payload: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(provider.Id)}}
	ctx.Request = httptest.NewRequest(http.MethodPut, "/api/custom-oauth-provider/"+strconv.Itoa(provider.Id), bytes.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")

	UpdateCustomOAuthProvider(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200 response, got %d with body %s", recorder.Code, recorder.Body.String())
	}
	if strings.Contains(recorder.Body.String(), "\"success\":false") {
		t.Fatalf("expected trusted_header update to succeed, got body %s", recorder.Body.String())
	}

	updatedProvider, err := model.GetCustomOAuthProviderById(provider.Id)
	if err != nil {
		t.Fatalf("failed to reload provider: %v", err)
	}
	if updatedProvider.Kind != model.CustomOAuthProviderKindTrustedHeader {
		t.Fatalf("expected provider kind trusted_header, got %s", updatedProvider.Kind)
	}
	if updatedProvider.ClientId != "" || updatedProvider.ClientSecret != "" || updatedProvider.AuthorizationEndpoint != "" {
		t.Fatalf("expected browser oauth fields to be cleared, got client_id=%q client_secret=%q authorization_endpoint=%q", updatedProvider.ClientId, updatedProvider.ClientSecret, updatedProvider.AuthorizationEndpoint)
	}
	if updatedProvider.Issuer != "" || updatedProvider.JwksURL != "" || updatedProvider.JWTSource != "" || updatedProvider.TicketExchangeURL != "" {
		t.Fatalf("expected jwt_direct fields to be cleared, got issuer=%q jwks_url=%q jwt_source=%q ticket_exchange_url=%q", updatedProvider.Issuer, updatedProvider.JwksURL, updatedProvider.JWTSource, updatedProvider.TicketExchangeURL)
	}
	if updatedProvider.UserIdField != "" || updatedProvider.GroupField != "" || updatedProvider.RoleField != "" {
		t.Fatalf("expected json path mapping fields to be cleared, got user_id_field=%q group_field=%q role_field=%q", updatedProvider.UserIdField, updatedProvider.GroupField, updatedProvider.RoleField)
	}
	if updatedProvider.AccessPolicy != "" || updatedProvider.AccessDeniedMessage != "" {
		t.Fatalf("expected access policy fields to be cleared, got access_policy=%q access_denied_message=%q", updatedProvider.AccessPolicy, updatedProvider.AccessDeniedMessage)
	}
	if updatedProvider.ExternalIDHeader != "X-Auth-User-Id" || updatedProvider.UsernameHeader != "X-Auth-Username" {
		t.Fatalf("expected trusted header fields to be kept, got external_id_header=%q username_header=%q", updatedProvider.ExternalIDHeader, updatedProvider.UsernameHeader)
	}
}

func TestUpdateCustomOAuthProviderSwitchesTrustedHeaderToOAuthCodeAndClearsHeaderFields(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)

	provider := &model.CustomOAuthProvider{
		Name:              "Trusted Header",
		Slug:              "trusted-header",
		Kind:              model.CustomOAuthProviderKindTrustedHeader,
		Enabled:           true,
		TrustedProxyCIDRs: `["127.0.0.1/32"]`,
		ExternalIDHeader:  "X-Auth-User-Id",
		UsernameHeader:    "X-Auth-Username",
		DisplayNameHeader: "X-Auth-Display-Name",
		EmailHeader:       "X-Auth-Email",
		GroupHeader:       "X-Auth-Group",
		RoleHeader:        "X-Auth-Role",
		GroupMapping:      `{"engineering":"vip"}`,
		RoleMapping:       `{"platform-admin":"admin"}`,
		AutoRegister:      true,
		AutoMergeByEmail:  true,
	}
	if err := model.CreateCustomOAuthProvider(provider); err != nil {
		t.Fatalf("failed to create provider: %v", err)
	}

	payload, err := common.Marshal(map[string]any{
		"kind":                   model.CustomOAuthProviderKindOAuthCode,
		"client_id":              "oauth-client",
		"client_secret":          "oauth-secret",
		"authorization_endpoint": "https://issuer.example.com/oauth2/authorize",
		"token_endpoint":         "https://issuer.example.com/oauth2/token",
		"user_info_endpoint":     "https://issuer.example.com/oauth2/userinfo",
		"user_id_field":          "sub",
		"username_field":         "preferred_username",
		"display_name_field":     "name",
		"email_field":            "email",
	})
	if err != nil {
		t.Fatalf("failed to marshal update payload: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(provider.Id)}}
	ctx.Request = httptest.NewRequest(http.MethodPut, "/api/custom-oauth-provider/"+strconv.Itoa(provider.Id), bytes.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")

	UpdateCustomOAuthProvider(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200 response, got %d with body %s", recorder.Code, recorder.Body.String())
	}
	if strings.Contains(recorder.Body.String(), "\"success\":false") {
		t.Fatalf("expected oauth_code update to succeed, got body %s", recorder.Body.String())
	}

	updatedProvider, err := model.GetCustomOAuthProviderById(provider.Id)
	if err != nil {
		t.Fatalf("failed to reload provider: %v", err)
	}
	if updatedProvider.Kind != model.CustomOAuthProviderKindOAuthCode {
		t.Fatalf("expected provider kind oauth_code, got %s", updatedProvider.Kind)
	}
	if updatedProvider.TrustedProxyCIDRs != "" || updatedProvider.ExternalIDHeader != "" || updatedProvider.GroupHeader != "" || updatedProvider.RoleHeader != "" {
		t.Fatalf("expected trusted header fields to be cleared, got trusted_proxy_cidrs=%q external_id_header=%q group_header=%q role_header=%q", updatedProvider.TrustedProxyCIDRs, updatedProvider.ExternalIDHeader, updatedProvider.GroupHeader, updatedProvider.RoleHeader)
	}
	if updatedProvider.TokenEndpoint == "" || updatedProvider.UserInfoEndpoint == "" || updatedProvider.ClientSecret != "oauth-secret" {
		t.Fatalf("expected oauth_code fields to be kept, got token_endpoint=%q user_info_endpoint=%q client_secret=%q", updatedProvider.TokenEndpoint, updatedProvider.UserInfoEndpoint, updatedProvider.ClientSecret)
	}
}

func TestCustomOAuthProviderResponseOmitsTicketExchangeSecrets(t *testing.T) {
	response := toCustomOAuthProviderResponse(&model.CustomOAuthProvider{
		Name:                      "CAS SSO",
		Slug:                      "cas-sso",
		Kind:                      model.CustomOAuthProviderKindJWTDirect,
		TicketExchangeExtraParams: `{"token":"sensitive"}`,
		TicketExchangeHeaders:     `{"Authorization":"Bearer sensitive"}`,
	})

	payload, err := common.Marshal(response)
	if err != nil {
		t.Fatalf("failed to marshal response: %v", err)
	}

	if strings.Contains(string(payload), "ticket_exchange_extra_params") {
		t.Fatalf("expected response payload to omit ticket_exchange_extra_params, got %s", string(payload))
	}
	if strings.Contains(string(payload), "ticket_exchange_headers") {
		t.Fatalf("expected response payload to omit ticket_exchange_headers, got %s", string(payload))
	}
}

func TestCustomOAuthProviderResponseDoesNotInjectJWTDefaultsForTrustedHeader(t *testing.T) {
	response := toCustomOAuthProviderResponse(&model.CustomOAuthProvider{
		Name:              "Trusted Header",
		Slug:              "trusted-header",
		Kind:              model.CustomOAuthProviderKindTrustedHeader,
		TrustedProxyCIDRs: `["127.0.0.1/32"]`,
		ExternalIDHeader:  "X-Auth-User-Id",
	})

	if response.JWTSource != "" || response.JWTIdentityMode != "" || response.JWTAcquireMode != "" {
		t.Fatalf("expected trusted_header response to keep jwt fields empty, got jwt_source=%q jwt_identity_mode=%q jwt_acquire_mode=%q", response.JWTSource, response.JWTIdentityMode, response.JWTAcquireMode)
	}
	if response.AuthorizationServiceField != "" || response.TicketExchangeMethod != "" || response.TicketExchangePayloadMode != "" {
		t.Fatalf("expected trusted_header response to keep ticket fields empty, got authorization_service_field=%q ticket_exchange_method=%q ticket_exchange_payload_mode=%q", response.AuthorizationServiceField, response.TicketExchangeMethod, response.TicketExchangePayloadMode)
	}
}

func TestGetCustomOAuthStatusPayloadDoesNotInjectJWTDefaultsForTrustedHeader(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)
	invalidateCustomOAuthStatusCache()
	t.Cleanup(invalidateCustomOAuthStatusCache)

	provider := &model.CustomOAuthProvider{
		Name:              "Trusted Header",
		Slug:              "trusted-header",
		Kind:              model.CustomOAuthProviderKindTrustedHeader,
		Enabled:           true,
		TrustedProxyCIDRs: `["127.0.0.1/32"]`,
		ExternalIDHeader:  "X-Auth-User-Id",
	}
	if err := model.CreateCustomOAuthProvider(provider); err != nil {
		t.Fatalf("failed to create provider: %v", err)
	}

	payload := getCustomOAuthStatusPayload()
	if len(payload) != 1 {
		t.Fatalf("expected 1 provider in status payload, got %d", len(payload))
	}
	if payload[0].Kind != model.CustomOAuthProviderKindTrustedHeader {
		t.Fatalf("expected trusted_header kind, got %s", payload[0].Kind)
	}
	if payload[0].JWTSource != "" || payload[0].JWTIdentityMode != "" || payload[0].JWTAcquireMode != "" {
		t.Fatalf("expected trusted_header status payload to keep jwt fields empty, got jwt_source=%q jwt_identity_mode=%q jwt_acquire_mode=%q", payload[0].JWTSource, payload[0].JWTIdentityMode, payload[0].JWTAcquireMode)
	}
	if !payload[0].BrowserLoginSupported {
		t.Fatal("expected trusted_header status payload to mark browser login as supported")
	}
}
