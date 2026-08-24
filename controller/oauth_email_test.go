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
	"gorm.io/gorm"
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
		&oauth.OAuthUser{ProviderUserID: "google-sub-existing", Email: "afoavi@gmail.com", EmailVerified: true},
		&oauthTestSession{values: map[interface{}]interface{}{}},
	)

	require.NoError(t, err)
	require.False(t, isNew)
	require.Equal(t, existing.Id, got.Id)
	var stored model.User
	require.NoError(t, db.First(&stored, existing.Id).Error)
	require.Equal(t, "google-sub-existing", stored.GoogleId)
	require.NotZero(t, stored.EmailVerifiedAt)
	var claim model.GoogleOAuthClaim
	require.NoError(t, db.Where("user_id = ?", existing.Id).First(&claim).Error)
	require.Equal(t, "afoavi@gmail.com", claim.NormalizedEmail)
	require.Equal(t, "google-sub-existing", claim.GoogleID)
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
	db := setupModelListControllerTestDB(t)
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
	var claim model.GoogleOAuthClaim
	require.NoError(t, db.Where("user_id = ?", got.Id).First(&claim).Error)
	require.Equal(t, "new-user@gmail.com", claim.NormalizedEmail)
	require.Equal(t, "google-sub-new-user", claim.GoogleID)
}

func TestClaimGoogleOAuthUserWithTxReportsWinnerAndRollsBackLoser(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	winner := &model.User{
		Username: "google-controller-winner",
		Email:    "race@gmail.com",
		GoogleId: "google-sub-race",
		AffCode:  "gcw2",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, db.Create(winner).Error)
	_, won, err := model.ClaimGoogleOAuthIdentityWithTx(db, winner.Id, winner.Email, winner.GoogleId)
	require.NoError(t, err)
	require.True(t, won)

	loser := &model.User{
		Username: "google-controller-loser",
		Email:    " RACE@GMAIL.COM ",
		AffCode:  "gcl2",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
	}
	err = db.Transaction(func(tx *gorm.DB) error {
		require.NoError(t, tx.Create(loser).Error)
		return claimGoogleOAuthUserWithTx(tx, loser, loser.Email, "google-sub-race")
	})
	var lost *googleOAuthClaimLostError
	require.ErrorAs(t, err, &lost)
	require.Equal(t, winner.Id, lost.claim.UserID)
	resolved, err := resolveGoogleOAuthClaimWinner(lost, loser.Email, "google-sub-race")
	require.NoError(t, err)
	require.Equal(t, winner.Id, resolved.Id)

	var loserCount int64
	require.NoError(t, db.Model(&model.User{}).Where("username = ?", loser.Username).Count(&loserCount).Error)
	require.Zero(t, loserCount)
}

func TestBindGoogleOAuthUserRejectsClaimOwnedByAnotherUser(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	owner := &model.User{Username: "google-bind-owner", Email: "owner@gmail.com", AffCode: "gbo1"}
	current := &model.User{Username: "google-bind-current", Email: "current@example.com", AffCode: "gbc1"}
	require.NoError(t, db.Create(owner).Error)
	require.NoError(t, db.Create(current).Error)
	_, owned, err := model.ClaimGoogleOAuthIdentityWithTx(db, owner.Id, owner.Email, "google-sub-owned")
	require.NoError(t, err)
	require.True(t, owned)

	err = bindGoogleOAuthUser(current, &oauth.OAuthUser{
		ProviderUserID: "google-sub-owned",
		Email:          owner.Email,
		EmailVerified:  true,
	})
	var conflict *OAuthEmailConflictError
	require.ErrorAs(t, err, &conflict)

	var stored model.User
	require.NoError(t, db.First(&stored, current.Id).Error)
	require.Empty(t, stored.GoogleId)
}

func TestBindGoogleOAuthUserRejectsAnotherActiveAccountWithSameEmail(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	existing := &model.User{Username: "google-email-owner", Email: "shared@gmail.com", AffCode: "geo1"}
	current := &model.User{Username: "google-email-current", Email: "current@example.com", AffCode: "gec1"}
	require.NoError(t, db.Create(existing).Error)
	require.NoError(t, db.Create(current).Error)

	err := bindGoogleOAuthUser(current, &oauth.OAuthUser{
		ProviderUserID: "google-sub-shared",
		Email:          " SHARED@GMAIL.COM ",
		EmailVerified:  true,
	})
	var conflict *OAuthEmailConflictError
	require.ErrorAs(t, err, &conflict)

	var claimCount int64
	require.NoError(t, db.Model(&model.GoogleOAuthClaim{}).Count(&claimCount).Error)
	require.Zero(t, claimCount)
}

func TestBindGoogleOAuthUserRestoresBindingForExistingOwnClaim(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	current := &model.User{Username: "google-own-claim", Email: "current@example.com", AffCode: "goc1"}
	require.NoError(t, db.Create(current).Error)
	_, owned, err := model.ClaimGoogleOAuthIdentityWithTx(db, current.Id, "google-account@gmail.com", "google-sub-own")
	require.NoError(t, err)
	require.True(t, owned)

	err = bindGoogleOAuthUser(current, &oauth.OAuthUser{
		ProviderUserID: "google-sub-own",
		Email:          "google-account@gmail.com",
		EmailVerified:  true,
	})
	require.NoError(t, err)

	var stored model.User
	require.NoError(t, db.First(&stored, current.Id).Error)
	require.Equal(t, "google-sub-own", stored.GoogleId)
}
