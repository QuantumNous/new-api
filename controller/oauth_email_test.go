package controller

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type oauthTestSession struct {
	values map[interface{}]interface{}
}

func (s *oauthTestSession) ID() string                                 { return "oauth-test-session" }
func (s *oauthTestSession) Get(key interface{}) interface{}            { return s.values[key] }
func (s *oauthTestSession) Set(key interface{}, value interface{})     { s.values[key] = value }
func (s *oauthTestSession) Delete(key interface{})                     { delete(s.values, key) }
func (s *oauthTestSession) Clear()                                     { s.values = map[interface{}]interface{}{} }
func (s *oauthTestSession) AddFlash(value interface{}, vars ...string) {}
func (s *oauthTestSession) Flashes(vars ...string) []interface{}       { return nil }
func (s *oauthTestSession) Options(options sessions.Options)           {}
func (s *oauthTestSession) Save() error                                { return nil }

func newOAuthTestContext() *gin.Context {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("GET", "/oauth/google", nil)
	return c
}

func TestFindOrCreateGoogleUserBindsVerifiedEmailToExistingAccount(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	existing := &model.User{
		Username: "password-user",
		Email:    "AFOAVI@GMAIL.COM ",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, db.Create(existing).Error)

	got, isNew, err := findOrCreateOAuthUser(
		newOAuthTestContext(),
		&oauth.GoogleProvider{},
		&oauth.OAuthUser{ProviderUserID: "google-sub-existing", Email: "afoavi@gmail.com"},
		&oauthTestSession{values: map[interface{}]interface{}{}},
	)

	require.NoError(t, err)
	require.False(t, isNew)
	require.Equal(t, existing.Id, got.Id)
	var stored model.User
	require.NoError(t, db.First(&stored, existing.Id).Error)
	require.Equal(t, "google-sub-existing", stored.GoogleId)
}

func TestFindOrCreateGoogleUserRejectsAmbiguousEmail(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	for i := 0; i < 2; i++ {
		require.NoError(t, db.Create(&model.User{
			Username: "duplicate-user-" + string(rune('a'+i)),
			Email:    "duplicate@gmail.com",
			AffCode:  "dup" + string(rune('a'+i)),
			Role:     common.RoleCommonUser,
			Status:   common.UserStatusEnabled,
		}).Error)
	}

	got, isNew, err := findOrCreateOAuthUser(
		newOAuthTestContext(),
		&oauth.GoogleProvider{},
		&oauth.OAuthUser{ProviderUserID: "google-sub-ambiguous", Email: "duplicate@gmail.com"},
		&oauthTestSession{values: map[interface{}]interface{}{}},
	)

	require.Nil(t, got)
	require.False(t, isNew)
	var conflictErr *OAuthEmailConflictError
	require.ErrorAs(t, err, &conflictErr)
}

func TestFindOrCreateGoogleUserRejectsExistingGoogleBindingOnEmailAccount(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.Create(&model.User{
		Username: "already-google-bound",
		Email:    "bound@gmail.com",
		GoogleId: "another-google-sub",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
	}).Error)

	got, isNew, err := findOrCreateOAuthUser(
		newOAuthTestContext(),
		&oauth.GoogleProvider{},
		&oauth.OAuthUser{ProviderUserID: "google-sub-new", Email: "bound@gmail.com"},
		&oauthTestSession{values: map[interface{}]interface{}{}},
	)

	require.Nil(t, got)
	require.False(t, isNew)
	var conflictErr *OAuthEmailConflictError
	require.ErrorAs(t, err, &conflictErr)
}

func TestFindOrCreateGoogleUserCreatesNewAccountForUnknownEmail(t *testing.T) {
	setupModelListControllerTestDB(t)
	originalRegisterEnabled := common.RegisterEnabled
	t.Cleanup(func() { common.RegisterEnabled = originalRegisterEnabled })
	common.RegisterEnabled = true
	got, isNew, err := findOrCreateOAuthUser(
		newOAuthTestContext(),
		&oauth.GoogleProvider{},
		&oauth.OAuthUser{ProviderUserID: "google-sub-new-user", Email: "new-user@gmail.com"},
		&oauthTestSession{values: map[interface{}]interface{}{}},
	)

	require.NoError(t, err)
	require.True(t, isNew)
	require.NotZero(t, got.Id)
	require.Equal(t, "new-user@gmail.com", got.Email)
	require.Equal(t, "google-sub-new-user", got.GoogleId)
}
