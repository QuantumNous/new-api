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
