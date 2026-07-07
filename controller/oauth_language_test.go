package controller

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	backendI18n "github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type oauthLanguageTestProvider struct{}

func (p oauthLanguageTestProvider) GetName() string {
	return "OAuth Language Test"
}

func (p oauthLanguageTestProvider) IsEnabled() bool {
	return true
}

func (p oauthLanguageTestProvider) ExchangeToken(ctx context.Context, code string, c *gin.Context) (*oauth.OAuthToken, error) {
	return &oauth.OAuthToken{}, nil
}

func (p oauthLanguageTestProvider) GetUserInfo(ctx context.Context, token *oauth.OAuthToken) (*oauth.OAuthUser, error) {
	return &oauth.OAuthUser{}, nil
}

func (p oauthLanguageTestProvider) IsUserIDTaken(providerUserID string) bool {
	return model.IsGitHubIdAlreadyTaken(providerUserID)
}

func (p oauthLanguageTestProvider) FillUserByProviderID(user *model.User, providerUserID string) error {
	user.GitHubId = providerUserID
	return user.FillUserByGitHubId()
}

func (p oauthLanguageTestProvider) SetProviderUserID(user *model.User, providerUserID string) {
	user.GitHubId = providerUserID
}

func (p oauthLanguageTestProvider) GetProviderPrefix() string {
	return "oauthlang_"
}

func createOAuthLanguageTestUser(t *testing.T, db *gorm.DB, providerUserID string, configureRequest func(*http.Request)) model.User {
	t.Helper()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(sessions.Sessions("session", cookie.NewStore([]byte("oauth-language-test"))))
	router.GET("/oauth-language-test", func(c *gin.Context) {
		session := sessions.Default(c)
		_, isNewUser, err := findOrCreateOAuthUser(c, oauthLanguageTestProvider{}, &oauth.OAuthUser{
			ProviderUserID: providerUserID,
			Username:       providerUserID,
			DisplayName:    "OAuth Language User",
			Email:          providerUserID + "@example.com",
			Extra:          map[string]any{},
		}, session)
		require.NoError(t, err)
		require.True(t, isNewUser)
		c.Status(http.StatusNoContent)
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/oauth-language-test", nil)
	if configureRequest != nil {
		configureRequest(request)
	}
	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusNoContent, recorder.Code)

	var user model.User
	require.NoError(t, db.First(&user, "github_id = ?", providerUserID).Error)
	return user
}

func TestFindOrCreateOAuthUserDoesNotPersistAcceptLanguageFallback(t *testing.T) {
	db := setupModelListControllerTestDB(t)

	originalRegisterEnabled := common.RegisterEnabled
	t.Cleanup(func() {
		common.RegisterEnabled = originalRegisterEnabled
	})
	common.RegisterEnabled = true

	user := createOAuthLanguageTestUser(t, db, "oauth-lang-no-cookie", func(request *http.Request) {
		request.Header.Set("Accept-Language", "ja")
	})

	require.Empty(t, user.GetSetting().Language)
}

func TestFindOrCreateOAuthUserPersistsExplicitCookieLanguage(t *testing.T) {
	db := setupModelListControllerTestDB(t)

	originalRegisterEnabled := common.RegisterEnabled
	t.Cleanup(func() {
		common.RegisterEnabled = originalRegisterEnabled
	})
	common.RegisterEnabled = true

	user := createOAuthLanguageTestUser(t, db, "oauth-lang-cookie", func(request *http.Request) {
		request.Header.Set("Accept-Language", "en")
		request.AddCookie(&http.Cookie{
			Name:  backendI18n.LanguagePreferenceCookieName,
			Value: "ja",
		})
	})

	require.Equal(t, "ja", user.GetSetting().Language)
}
