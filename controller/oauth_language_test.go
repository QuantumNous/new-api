package controller

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	backendI18n "github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/QuantumNous/new-api/service"
	"github.com/alicebob/miniredis/v2"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
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

func TestFindOrCreateOAuthUserRejectsEmailOutsideDomainWhitelist(t *testing.T) {
	db := setupModelListControllerTestDB(t)

	originalRegisterEnabled := common.RegisterEnabled
	originalEmailDomainRestrictionEnabled := common.EmailDomainRestrictionEnabled
	originalEmailDomainWhitelist := append([]string(nil), common.EmailDomainWhitelist...)
	t.Cleanup(func() {
		common.RegisterEnabled = originalRegisterEnabled
		common.EmailDomainRestrictionEnabled = originalEmailDomainRestrictionEnabled
		common.EmailDomainWhitelist = originalEmailDomainWhitelist
	})
	common.RegisterEnabled = true
	common.EmailDomainRestrictionEnabled = true
	common.EmailDomainWhitelist = []string{"allowed.example"}

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(sessions.Sessions("session", cookie.NewStore([]byte("oauth-domain-test"))))
	router.GET("/oauth-domain-test", func(c *gin.Context) {
		session := sessions.Default(c)
		_, isNewUser, err := findOrCreateOAuthUser(c, oauthLanguageTestProvider{}, &oauth.OAuthUser{
			ProviderUserID: "oauth-domain-blocked",
			Username:       "oauth-domain-blocked",
			DisplayName:    "OAuth Domain User",
			Email:          "blocked@outside.example",
			Extra:          map[string]any{},
		}, session)
		require.Error(t, err)
		require.False(t, isNewUser)
		c.Status(http.StatusNoContent)
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/oauth-domain-test", nil)
	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusNoContent, recorder.Code)
	var users int64
	require.NoError(t, db.Model(&model.User{}).Where("email = ?", "blocked@outside.example").Count(&users).Error)
	require.Zero(t, users)
}

func TestFindOrCreateOAuthUserReleasesRedisBonusClaimWhenBindingFails(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.CustomOAuthProvider{}, &model.UserOAuthBinding{}))

	originalRegisterEnabled := common.RegisterEnabled
	originalQuotaForNewUser := common.QuotaForNewUser
	originalRedisEnabled := common.RedisEnabled
	originalRDB := common.RDB
	t.Cleanup(func() {
		common.RegisterEnabled = originalRegisterEnabled
		common.QuotaForNewUser = originalQuotaForNewUser
		common.RedisEnabled = originalRedisEnabled
		common.RDB = originalRDB
	})
	common.RegisterEnabled = true
	common.QuotaForNewUser = 777

	mr := miniredis.RunT(t)
	common.RDB = redis.NewClient(&redis.Options{Addr: mr.Addr()})
	common.RedisEnabled = true
	t.Cleanup(func() {
		require.NoError(t, common.RDB.Close())
	})

	provider := oauth.NewGenericOAuthProvider(&model.CustomOAuthProvider{
		Id:      1,
		Name:    "Rollback OAuth",
		Slug:    "rollback-oauth",
		Enabled: true,
	})

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(sessions.Sessions("session", cookie.NewStore([]byte("oauth-redis-rollback"))))
	router.GET("/oauth-redis-rollback", func(c *gin.Context) {
		session := sessions.Default(c)
		_, isNewUser, err := findOrCreateOAuthUser(c, provider, &oauth.OAuthUser{
			ProviderUserID: "",
			Username:       "oauth-redis-rollback",
			DisplayName:    "OAuth Redis Rollback",
			Email:          "oauth-redis-rollback@example.com",
			Extra:          map[string]any{},
		}, session)
		require.Error(t, err)
		require.False(t, isNewUser)
		c.Status(http.StatusNoContent)
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/oauth-redis-rollback", nil)
	request.RemoteAddr = "203.0.113.50:12345"
	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusNoContent, recorder.Code)
	var users int64
	require.NoError(t, db.Model(&model.User{}).Where("email = ?", "oauth-redis-rollback@example.com").Count(&users).Error)
	require.Zero(t, users)

	keys, err := common.RDB.DBSize(context.Background()).Result()
	require.NoError(t, err)
	require.Zero(t, keys)
}

func TestOAuthRegistrationRejectsSubdomainEmailDomain(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	originalRegisterEnabled := common.RegisterEnabled
	t.Cleanup(func() { common.RegisterEnabled = originalRegisterEnabled })
	common.RegisterEnabled = true
	withRegistrationSecurityConfig(t, map[string]string{
		"registration_security.domain_risk_enabled":            "false",
		"registration_security.domain_risk_window_hours":       "24",
		"registration_security.domain_risk_threshold":          "10",
		"registration_security.trusted_email_domains":          "[]",
		"registration_security.reject_subdomain_email_domains": "true",
	})

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(sessions.Sessions("session", cookie.NewStore([]byte("oauth-subdomain-test"))))
	router.GET("/oauth-subdomain-test", func(c *gin.Context) {
		user, isNewUser, err := findOrCreateOAuthUser(c, oauthLanguageTestProvider{}, &oauth.OAuthUser{
			ProviderUserID: "oauth-subdomain",
			Username:       "oauth-subdomain",
			Email:          "user@mail.example.com",
			Extra:          map[string]any{},
		}, sessions.Default(c))
		require.Nil(t, user)
		require.False(t, isNewUser)
		require.ErrorIs(t, err, service.ErrSubdomainEmailRegistrationRejected)
		c.Status(http.StatusNoContent)
	})

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/oauth-subdomain-test", nil))
	require.Equal(t, http.StatusNoContent, recorder.Code)
	var count int64
	require.NoError(t, db.Model(&model.User{}).Where("github_id = ?", "oauth-subdomain").Count(&count).Error)
	require.Zero(t, count)
}

func TestOAuthRegistrationDomainThresholdRejectsNewUser(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	originalRegisterEnabled := common.RegisterEnabled
	t.Cleanup(func() { common.RegisterEnabled = originalRegisterEnabled })
	common.RegisterEnabled = true
	withRegistrationSecurityConfig(t, map[string]string{
		"registration_security.domain_risk_enabled":            "true",
		"registration_security.domain_risk_window_hours":       "24",
		"registration_security.domain_risk_threshold":          "2",
		"registration_security.trusted_email_domains":          "[]",
		"registration_security.reject_subdomain_email_domains": "false",
	})
	seed := model.User{Username: "oauth-seed", Email: "seed@oauth.example", EmailDomain: "oauth.example", Status: common.UserStatusEnabled, Role: common.RoleCommonUser}
	require.NoError(t, db.Create(&seed).Error)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(sessions.Sessions("session", cookie.NewStore([]byte("oauth-threshold-test"))))
	router.GET("/oauth-threshold-test", func(c *gin.Context) {
		user, isNewUser, err := findOrCreateOAuthUser(c, oauthLanguageTestProvider{}, &oauth.OAuthUser{
			ProviderUserID: "oauth-threshold",
			Username:       "oauth-threshold",
			Email:          "new@oauth.example",
			Extra:          map[string]any{},
		}, sessions.Default(c))
		require.Nil(t, user)
		require.False(t, isNewUser)
		require.ErrorIs(t, err, model.ErrRegistrationDomainBlocked)
		c.Status(http.StatusNoContent)
	})

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/oauth-threshold-test", nil))
	require.Equal(t, http.StatusNoContent, recorder.Code)
	var count int64
	require.NoError(t, db.Model(&model.User{}).Where("github_id = ?", "oauth-threshold").Count(&count).Error)
	require.Zero(t, count)
	require.NoError(t, db.First(&seed, seed.Id).Error)
	require.Equal(t, common.UserStatusDisabled, seed.Status)
}

func TestOAuthExistingUserLoginBypassesRegistrationDomainBlock(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	existing := model.User{Username: "oauth-existing", GitHubId: "oauth-existing-id", Email: "user@blocked.example", EmailDomain: "blocked.example", Status: common.UserStatusEnabled, Role: common.RoleCommonUser}
	require.NoError(t, db.Create(&existing).Error)
	block := model.RegistrationDomainBlock{Domain: "blocked.example", WindowHours: 24, Threshold: 10, ObservedCount: 10, BlockedAt: time.Now().Unix()}
	require.NoError(t, db.Create(&block).Error)
	require.NoError(t, db.Create(&model.RegistrationDomainState{Domain: "blocked.example", ActiveBlockID: block.Id}).Error)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(sessions.Sessions("session", cookie.NewStore([]byte("oauth-existing-test"))))
	router.GET("/oauth-existing-test", func(c *gin.Context) {
		user, isNewUser, err := findOrCreateOAuthUser(c, oauthLanguageTestProvider{}, &oauth.OAuthUser{
			ProviderUserID: "oauth-existing-id",
			Email:          "user@blocked.example",
			Extra:          map[string]any{},
		}, sessions.Default(c))
		require.NoError(t, err)
		require.False(t, isNewUser)
		require.Equal(t, existing.Id, user.Id)
		c.Status(http.StatusNoContent)
	})

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/oauth-existing-test", nil))
	require.Equal(t, http.StatusNoContent, recorder.Code)
}
