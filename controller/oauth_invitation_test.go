package controller

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strconv"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type existingOAuthUserProvider struct{}

func (existingOAuthUserProvider) GetName() string { return "Linux DO" }

func (existingOAuthUserProvider) IsEnabled() bool { return true }

func (existingOAuthUserProvider) ExchangeToken(context.Context, string, *gin.Context) (*oauth.OAuthToken, error) {
	return nil, nil
}

func (existingOAuthUserProvider) GetUserInfo(context.Context, *oauth.OAuthToken) (*oauth.OAuthUser, error) {
	return nil, nil
}

func (existingOAuthUserProvider) IsUserIDTaken(string) bool { return true }

func (existingOAuthUserProvider) FillUserByProviderID(user *model.User, _ string) error {
	user.Id = 42
	user.Username = "existing-user"
	user.Status = common.UserStatusEnabled
	return nil
}

func (existingOAuthUserProvider) SetProviderUserID(*model.User, string) {}

func (existingOAuthUserProvider) GetProviderPrefix() string { return "linuxdo_" }

type oauthStateTestHarness struct {
	router  *gin.Engine
	now     int64
	pending oauthRegistrationState
	err     error
}

func newOAuthStateTestHarness(t *testing.T) *oauthStateTestHarness {
	t.Helper()
	gin.SetMode(gin.TestMode)
	oldDB := model.DB
	oldDatabaseType := common.MainDatabaseType()
	databasePath := filepath.Join(t.TempDir(), fmt.Sprintf("oauth_state_%d.db", time.Now().UnixNano()))
	dsn := fmt.Sprintf("file:%s?_pragma=busy_timeout(30000)&_txlock=immediate", filepath.ToSlash(databasePath))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.AuthIdentity{}, &model.OAuthStateGrant{}))
	model.DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		sqlDB, dbErr := db.DB()
		if dbErr == nil {
			require.NoError(t, sqlDB.Close())
		}
		model.DB = oldDB
		common.SetMainDatabaseType(oldDatabaseType)
	})

	harness := &oauthStateTestHarness{now: common.GetTimestamp()}
	router := gin.New()
	store := cookie.NewStore([]byte("01234567890123456789012345678901"))
	router.Use(sessions.Sessions("session", store))
	router.GET("/seed", func(c *gin.Context) {
		session := sessions.Default(c)
		session.Set("oauth_state", "state-value")
		stateCreatedAt, _ := strconv.ParseInt(c.Query("state_created_at"), 10, 64)
		session.Set("oauth_state_created_at", stateCreatedAt)
		if provider := c.Query("provider"); provider != "" {
			session.Set("oauth_provider", provider)
			if err := model.CreateOAuthStateGrant(
				"state-value",
				provider,
				time.Unix(stateCreatedAt, 0).Add(oauthStateTTL),
			); err != nil {
				c.Status(http.StatusInternalServerError)
				return
			}
		}
		if invitationCode := c.Query("invitation_code"); invitationCode != "" {
			session.Set("oauth_invitation_code", invitationCode)
			createdAt, _ := strconv.ParseInt(c.Query("invitation_created_at"), 10, 64)
			session.Set("oauth_invitation_created_at", createdAt)
		}
		if err := session.Save(); err != nil {
			c.Status(http.StatusInternalServerError)
			return
		}
		c.Status(http.StatusNoContent)
	})
	router.GET("/take/:provider", func(c *gin.Context) {
		harness.pending, harness.err = takeOAuthRegistrationState(
			sessions.Default(c),
			c.Query("state"),
			c.Param("provider"),
			harness.now,
		)
		c.Status(http.StatusNoContent)
	})
	router.GET("/claim/:provider", func(c *gin.Context) {
		_, err := takeOAuthRegistrationState(
			sessions.Default(c),
			c.Query("state"),
			c.Param("provider"),
			harness.now,
		)
		switch {
		case err == nil:
			c.Status(http.StatusNoContent)
		case errors.Is(err, errOAuthStateInvalid):
			c.Status(http.StatusForbidden)
		default:
			c.Status(http.StatusInternalServerError)
		}
	})
	router.GET("/oauth/state", GenerateOAuthCode)
	router.POST("/oauth/state", GenerateOAuthCode)
	harness.router = router
	return harness
}

func seedOAuthState(t *testing.T, harness *oauthStateTestHarness, provider string, invitationCode string, stateCreatedAt int64, invitationCreatedAt int64) *http.Cookie {
	t.Helper()
	query := url.Values{}
	query.Set("provider", provider)
	query.Set("invitation_code", invitationCode)
	query.Set("state_created_at", strconv.FormatInt(stateCreatedAt, 10))
	query.Set("invitation_created_at", strconv.FormatInt(invitationCreatedAt, 10))
	request := httptest.NewRequest(http.MethodGet, "/seed?"+query.Encode(), nil)
	response := httptest.NewRecorder()
	harness.router.ServeHTTP(response, request)
	require.Equal(t, http.StatusNoContent, response.Code)
	cookies := response.Result().Cookies()
	require.NotEmpty(t, cookies)
	return cookies[0]
}

func takeOAuthState(t *testing.T, harness *oauthStateTestHarness, provider string, sessionCookie *http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	request := httptest.NewRequest(http.MethodGet, "/take/"+provider+"?state=state-value", nil)
	request.AddCookie(sessionCookie)
	response := httptest.NewRecorder()
	harness.router.ServeHTTP(response, request)
	require.Equal(t, http.StatusNoContent, response.Code)
	return response
}

func TestOAuthInvitationIsBoundToProviderAndStateIsSingleUse(t *testing.T) {
	harness := newOAuthStateTestHarness(t)
	sessionCookie := seedOAuthState(t, harness, "linuxdo", "INV-CODE", harness.now, harness.now)

	takeOAuthState(t, harness, "github", sessionCookie)
	require.ErrorIs(t, harness.err, errOAuthStateInvalid)
	assert.Empty(t, harness.pending.InvitationCode)

	harness.err = nil
	response := takeOAuthState(t, harness, "linuxdo", sessionCookie)
	require.NoError(t, harness.err)
	assert.Equal(t, "INV-CODE", harness.pending.InvitationCode)

	clearedCookies := response.Result().Cookies()
	require.NotEmpty(t, clearedCookies)
	harness.err = nil
	takeOAuthState(t, harness, "linuxdo", clearedCookies[0])
	require.ErrorIs(t, harness.err, errOAuthStateInvalid)
}

func TestExpiredOAuthInvitationDoesNotBlockExistingAccountCallback(t *testing.T) {
	harness := newOAuthStateTestHarness(t)
	sessionCookie := seedOAuthState(
		t,
		harness,
		"linuxdo",
		"INV-CODE",
		harness.now,
		harness.now-int64(oauthStateTTL.Seconds())-1,
	)

	takeOAuthState(t, harness, "linuxdo", sessionCookie)
	require.NoError(t, harness.err)
	assert.Empty(t, harness.pending.InvitationCode)
}

func TestOAuthInvitationStateExpiresAfterTenMinutes(t *testing.T) {
	harness := newOAuthStateTestHarness(t)
	sessionCookie := seedOAuthState(t, harness, "linuxdo", "INV-CODE", harness.now, harness.now)
	harness.now += int64(oauthStateTTL.Seconds()) + 1

	response := takeOAuthState(t, harness, "linuxdo", sessionCookie)
	require.ErrorIs(t, harness.err, errOAuthStateInvalid)
	assert.Empty(t, harness.pending.InvitationCode)
	assert.NotEmpty(t, response.Result().Cookies(), "expired state should be removed from the session")
}

func TestOAuthInvitationStateWithoutProviderIsRejected(t *testing.T) {
	harness := newOAuthStateTestHarness(t)
	sessionCookie := seedOAuthState(t, harness, "", "", harness.now, harness.now)

	takeOAuthState(t, harness, "github", sessionCookie)
	require.ErrorIs(t, harness.err, errOAuthStateInvalid)
	assert.Empty(t, harness.pending.InvitationCode)
}

func TestOAuthInvitationStateAcceptsCodeOnlyInPostBody(t *testing.T) {
	harness := newOAuthStateTestHarness(t)
	body := []byte(`{"aff":"AFF","provider":"linuxdo","invitation_code":"INV-SECRET"}`)
	request := httptest.NewRequest(http.MethodPost, "/oauth/state", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	harness.router.ServeHTTP(response, request)

	var payload struct {
		Success bool   `json:"success"`
		Data    string `json:"data"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.NotEmpty(t, payload.Data)
	cookies := response.Result().Cookies()
	require.NotEmpty(t, cookies)

	callback := httptest.NewRequest(http.MethodGet, "/take/linuxdo?state="+url.QueryEscape(payload.Data), nil)
	callback.AddCookie(cookies[0])
	callbackResponse := httptest.NewRecorder()
	harness.router.ServeHTTP(callbackResponse, callback)
	require.NoError(t, harness.err)
	assert.Equal(t, "INV-SECRET", harness.pending.InvitationCode)
	assert.Equal(t, "AFF", harness.pending.AffCode)

	legacyRequest := httptest.NewRequest(http.MethodGet, "/oauth/state?provider=linuxdo&invitation_code=INV-SECRET", nil)
	legacyResponse := httptest.NewRecorder()
	harness.router.ServeHTTP(legacyResponse, legacyRequest)
	var legacyPayload struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(legacyResponse.Body.Bytes(), &legacyPayload))
	assert.False(t, legacyPayload.Success)

	compatibleRequest := httptest.NewRequest(http.MethodGet, "/oauth/state?provider=github&aff=AFF", nil)
	compatibleResponse := httptest.NewRecorder()
	harness.router.ServeHTTP(compatibleResponse, compatibleRequest)
	var compatiblePayload struct {
		Success bool   `json:"success"`
		Data    string `json:"data"`
	}
	require.NoError(t, common.Unmarshal(compatibleResponse.Body.Bytes(), &compatiblePayload))
	assert.True(t, compatiblePayload.Success)
	assert.NotEmpty(t, compatiblePayload.Data)
}

func TestOAuthStateConcurrentReplayHasExactlyOneWinner(t *testing.T) {
	harness := newOAuthStateTestHarness(t)
	sessionCookie := seedOAuthState(t, harness, "linuxdo", "INV-CODE", harness.now, harness.now)

	const requestCount = 12
	start := make(chan struct{})
	var waitGroup sync.WaitGroup
	var successes atomic.Int32
	var replays atomic.Int32
	var unexpected atomic.Int32
	for index := 0; index < requestCount; index++ {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			<-start
			request := httptest.NewRequest(http.MethodGet, "/claim/linuxdo?state=state-value", nil)
			request.AddCookie(sessionCookie)
			response := httptest.NewRecorder()
			harness.router.ServeHTTP(response, request)
			switch response.Code {
			case http.StatusNoContent:
				successes.Add(1)
			case http.StatusForbidden:
				replays.Add(1)
			default:
				unexpected.Add(1)
			}
		}()
	}
	close(start)
	waitGroup.Wait()

	assert.Equal(t, int32(1), successes.Load())
	assert.Equal(t, int32(requestCount-1), replays.Load())
	assert.Zero(t, unexpected.Load())
}

func TestExistingOAuthUserDoesNotNeedInvitationCode(t *testing.T) {
	newOAuthStateTestHarness(t)
	oldRequired := common.IsInvitationCodeRequired()
	oldMethods := common.GetInvitationCodeMethods()
	t.Cleanup(func() {
		common.SetInvitationCodeRequired(oldRequired)
		require.NoError(t, common.SetInvitationCodeMethods(oldMethods))
	})
	common.SetInvitationCodeRequired(true)
	require.NoError(t, common.SetInvitationCodeMethods([]string{common.InvitationRegistrationMethodLinuxDO}))

	user, err := findOrCreateOAuthUser(
		common.InvitationRegistrationMethodLinuxDO,
		existingOAuthUserProvider{},
		&oauth.OAuthUser{ProviderUserID: "provider-user"},
		oauthRegistrationState{},
	)
	require.NoError(t, err)
	assert.Equal(t, 42, user.Id)
}

func TestOAuthInvitationMethodForEveryProvider(t *testing.T) {
	builtIn := existingOAuthUserProvider{}
	custom := oauth.NewGenericOAuthProvider(&model.CustomOAuthProvider{Name: "Custom", Slug: "custom"})
	testCases := []struct {
		name         string
		providerName string
		provider     oauth.Provider
		expected     string
	}{
		{name: "github", providerName: "github", provider: builtIn, expected: common.InvitationRegistrationMethodGitHub},
		{name: "discord", providerName: "discord", provider: builtIn, expected: common.InvitationRegistrationMethodDiscord},
		{name: "linuxdo", providerName: "linuxdo", provider: builtIn, expected: common.InvitationRegistrationMethodLinuxDO},
		{name: "oidc", providerName: "oidc", provider: builtIn, expected: common.InvitationRegistrationMethodOIDC},
		{name: "custom", providerName: "custom", provider: custom, expected: common.InvitationRegistrationMethodCustomOAuth},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			assert.Equal(t, testCase.expected, invitationMethodForOAuthProvider(testCase.providerName, testCase.provider))
		})
	}
}
