package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupCustomOAuthSignupTest(t *testing.T) *oauth.GenericOAuthProvider {
	t.Helper()

	previousDB := model.DB
	previousRegisterEnabled := common.RegisterEnabled
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.CustomOAuthProvider{},
		&model.UserOAuthBinding{},
	))
	model.DB = db
	common.RegisterEnabled = true
	t.Cleanup(func() {
		model.DB = previousDB
		common.RegisterEnabled = previousRegisterEnabled
	})

	providerConfig := &model.CustomOAuthProvider{
		Name: "LinearTeamPassport",
		Slug: "linearpassport",
	}
	require.NoError(t, db.Create(providerConfig).Error)
	return oauth.NewGenericOAuthProvider(providerConfig)
}

func TestFindOrCreateCustomOAuthUserUsesProviderUsername(t *testing.T) {
	provider := setupCustomOAuthSignupTest(t)

	user, err := findOrCreateOAuthUser(nil, provider, &oauth.OAuthUser{
		ProviderUserID: "linear-user-1",
		Username:       "linear-user",
		DisplayName:    "Linear User",
	}, "")

	require.NoError(t, err)
	assert.Equal(t, "linear-user", user.Username)
	assert.Equal(t, "Linear User", user.DisplayName)

	binding, err := model.GetUserOAuthBinding(user.Id, provider.GetProviderId())
	require.NoError(t, err)
	assert.Equal(t, "linear-user-1", binding.ProviderUserId)
}

func TestFindOrCreateCustomOAuthUserFallsBackWhenUsernameUnavailable(t *testing.T) {
	tests := []struct {
		name     string
		username string
		prepare  func(t *testing.T)
	}{
		{name: "missing username"},
		{
			name:     "username already exists",
			username: "taken-user",
			prepare: func(t *testing.T) {
				require.NoError(t, model.DB.Create(&model.User{Username: "taken-user"}).Error)
			},
		},
		{
			name:     "username too long",
			username: "this-provider-username-is-too-long",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			provider := setupCustomOAuthSignupTest(t)
			if test.prepare != nil {
				test.prepare(t)
			}

			user, err := findOrCreateOAuthUser(nil, provider, &oauth.OAuthUser{
				ProviderUserID: "linear-user",
				Username:       test.username,
			}, "")

			require.NoError(t, err)
			assert.NotEqual(t, test.username, user.Username)
			assert.Contains(t, user.Username, "linearpassport_")
		})
	}
}

func TestUnbindCustomOAuthKeepsUserAccount(t *testing.T) {
	provider := setupCustomOAuthSignupTest(t)
	user := &model.User{Username: "unbind-user", Role: common.RoleCommonUser, Status: common.UserStatusEnabled}
	require.NoError(t, model.DB.Create(user).Error)
	require.NoError(t, model.CreateUserOAuthBinding(&model.UserOAuthBinding{
		UserId:         user.Id,
		ProviderId:     provider.GetProviderId(),
		ProviderUserId: "linear-unbind-user",
	}))

	require.NoError(t, model.DeleteUserOAuthBinding(user.Id, provider.GetProviderId()))

	var persistedUser model.User
	require.NoError(t, model.DB.First(&persistedUser, user.Id).Error)
	assert.Equal(t, "unbind-user", persistedUser.Username)
	_, err := model.GetUserOAuthBinding(user.Id, provider.GetProviderId())
	assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
}
