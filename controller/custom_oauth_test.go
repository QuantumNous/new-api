package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupCustomOAuthControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	oldDB, oldLogDB := model.DB, model.LOG_DB
	oldMainDatabaseType, oldLogDatabaseType := common.MainDatabaseType(), common.LogDatabaseType()
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.CustomOAuthProvider{}))
	model.DB, model.LOG_DB = db, db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	gin.SetMode(gin.TestMode)

	t.Cleanup(func() {
		sqlDB, sqlErr := db.DB()
		if sqlErr == nil {
			require.NoError(t, sqlDB.Close())
		}
		model.DB, model.LOG_DB = oldDB, oldLogDB
		common.SetDatabaseTypes(oldMainDatabaseType, oldLogDatabaseType)
	})
	return db
}

func customOAuthProviderRequest(slug string) CreateCustomOAuthProviderRequest {
	return CreateCustomOAuthProviderRequest{
		Name:                  "Example OAuth",
		Slug:                  slug,
		Enabled:               true,
		ClientId:              "client-id",
		ClientSecret:          "client-secret",
		AuthorizationEndpoint: "https://example.com/oauth/authorize",
		TokenEndpoint:         "https://example.com/oauth/token",
		UserInfoEndpoint:      "https://example.com/oauth/userinfo",
	}
}

func customOAuthControllerContext(t *testing.T, method string, target string, body any) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	payload, err := common.Marshal(body)
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(method, target, strings.NewReader(string(payload)))
	ctx.Request.Header.Set("Content-Type", "application/json")
	return ctx, recorder
}

func decodeCustomOAuthResponse(t *testing.T, recorder *httptest.ResponseRecorder) struct {
	Success bool                         `json:"success"`
	Message string                       `json:"message"`
	Data    *CustomOAuthProviderResponse `json:"data"`
} {
	t.Helper()
	var response struct {
		Success bool                         `json:"success"`
		Message string                       `json:"message"`
		Data    *CustomOAuthProviderResponse `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	return response
}

func restoreGitHubProvider(t *testing.T) {
	t.Helper()
	t.Cleanup(func() {
		oauth.UnregisterCustomProvider("github")
		oauth.Register("github", &oauth.GitHubProvider{})
	})
}

func TestCreateCustomOAuthProviderNormalizesSlugBeforePersistingAndRegistering(t *testing.T) {
	db := setupCustomOAuthControllerTestDB(t)
	t.Cleanup(func() { oauth.UnregisterCustomProvider("example-oauth") })
	ctx, recorder := customOAuthControllerContext(
		t,
		http.MethodPost,
		"/api/custom-oauth-provider/",
		customOAuthProviderRequest("  Example-OAuth  "),
	)

	CreateCustomOAuthProvider(ctx)

	response := decodeCustomOAuthResponse(t, recorder)
	require.True(t, response.Success, response.Message)
	require.NotNil(t, response.Data)
	assert.Equal(t, "example-oauth", response.Data.Slug)
	var stored model.CustomOAuthProvider
	require.NoError(t, db.First(&stored).Error)
	assert.Equal(t, "example-oauth", stored.Slug)
	assert.True(t, oauth.IsCustomProvider("example-oauth"))
}

func TestCreateCustomOAuthProviderRejectsCaseVariantOfBuiltInProvider(t *testing.T) {
	db := setupCustomOAuthControllerTestDB(t)
	restoreGitHubProvider(t)
	ctx, recorder := customOAuthControllerContext(
		t,
		http.MethodPost,
		"/api/custom-oauth-provider/",
		customOAuthProviderRequest("  GitHub  "),
	)

	CreateCustomOAuthProvider(ctx)

	response := decodeCustomOAuthResponse(t, recorder)
	assert.False(t, response.Success)
	assert.Contains(t, response.Message, "冲突")
	var count int64
	require.NoError(t, db.Model(&model.CustomOAuthProvider{}).Count(&count).Error)
	assert.Zero(t, count)
	assert.False(t, oauth.IsCustomProvider("github"))
	_, isBuiltIn := oauth.GetProvider("github").(*oauth.GitHubProvider)
	assert.True(t, isBuiltIn)
}

func TestCreateCustomOAuthProviderRejectsNormalizedExistingSlug(t *testing.T) {
	db := setupCustomOAuthControllerTestDB(t)
	existing := customOAuthProviderRequest("existing-provider")
	provider := &model.CustomOAuthProvider{
		Name:                  existing.Name,
		Slug:                  existing.Slug,
		Enabled:               existing.Enabled,
		ClientId:              existing.ClientId,
		ClientSecret:          existing.ClientSecret,
		AuthorizationEndpoint: existing.AuthorizationEndpoint,
		TokenEndpoint:         existing.TokenEndpoint,
		UserInfoEndpoint:      existing.UserInfoEndpoint,
	}
	require.NoError(t, model.CreateCustomOAuthProvider(provider))
	ctx, recorder := customOAuthControllerContext(
		t,
		http.MethodPost,
		"/api/custom-oauth-provider/",
		customOAuthProviderRequest("  ExIsTiNg-PrOvIdEr  "),
	)

	CreateCustomOAuthProvider(ctx)

	response := decodeCustomOAuthResponse(t, recorder)
	assert.False(t, response.Success)
	assert.Contains(t, response.Message, "已被使用")
	var count int64
	require.NoError(t, db.Model(&model.CustomOAuthProvider{}).Count(&count).Error)
	assert.Equal(t, int64(1), count)
}

func TestUpdateCustomOAuthProviderRejectsCaseVariantOfBuiltInProvider(t *testing.T) {
	db := setupCustomOAuthControllerTestDB(t)
	restoreGitHubProvider(t)
	existing := customOAuthProviderRequest("acme")
	provider := &model.CustomOAuthProvider{
		Name:                  existing.Name,
		Slug:                  existing.Slug,
		Enabled:               existing.Enabled,
		ClientId:              existing.ClientId,
		ClientSecret:          existing.ClientSecret,
		AuthorizationEndpoint: existing.AuthorizationEndpoint,
		TokenEndpoint:         existing.TokenEndpoint,
		UserInfoEndpoint:      existing.UserInfoEndpoint,
	}
	require.NoError(t, model.CreateCustomOAuthProvider(provider))
	oauth.RegisterOrUpdateCustomProvider(provider)
	t.Cleanup(func() { oauth.UnregisterCustomProvider("acme") })
	ctx, recorder := customOAuthControllerContext(
		t,
		http.MethodPut,
		"/api/custom-oauth-provider/"+strconv.Itoa(provider.Id),
		UpdateCustomOAuthProviderRequest{Slug: "  GitHub  "},
	)
	ctx.AddParam("id", strconv.Itoa(provider.Id))

	UpdateCustomOAuthProvider(ctx)

	response := decodeCustomOAuthResponse(t, recorder)
	assert.False(t, response.Success)
	assert.Contains(t, response.Message, "冲突")
	var stored model.CustomOAuthProvider
	require.NoError(t, db.First(&stored, provider.Id).Error)
	assert.Equal(t, "acme", stored.Slug)
	assert.True(t, oauth.IsCustomProvider("acme"))
	assert.False(t, oauth.IsCustomProvider("github"))
}
