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
