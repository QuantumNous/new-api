package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/stretchr/testify/require"
)

func TestSelfHealOAuthEmailVerification(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.User{}))

	// Existing user created before email-verification tracking existed.
	existing := model.User{
		Username:        "oauth-old-user",
		Password:        "password123",
		AffCode:         "aff-old-user",
		Email:           "old@example.com",
		EmailVerifiedAt: 0,
		Status:          common.UserStatusEnabled,
	}
	require.NoError(t, db.Create(&existing).Error)

	// Provider proves email ownership -> self-heal on next login.
	found := &model.User{}
	require.NoError(t, db.First(found, "username = ?", "oauth-old-user").Error)
	require.Zero(t, found.EmailVerifiedAt)

	selfHealOAuthEmailVerification(found, &oauth.OAuthUser{EmailVerified: true})

	require.NotZero(t, found.EmailVerifiedAt)
	var reloaded model.User
	require.NoError(t, db.First(&reloaded, existing.Id).Error)
	require.NotZero(t, reloaded.EmailVerifiedAt, "self-heal must persist email_verified_at")

	// Already-verified users are untouched.
	before := reloaded.EmailVerifiedAt
	selfHealOAuthEmailVerification(&reloaded, &oauth.OAuthUser{EmailVerified: true})
	require.Equal(t, before, reloaded.EmailVerifiedAt)

	// Providers without an ownership proof must NOT self-heal.
	unverified := model.User{
		Username: "oauth-no-proof",
		Password: "password123",
		AffCode:  "aff-no-proof",
		Email:    "no-proof@example.com",
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, db.Create(&unverified).Error)
	selfHealOAuthEmailVerification(&unverified, &oauth.OAuthUser{EmailVerified: false})
	require.Zero(t, unverified.EmailVerifiedAt)

	// Users without an email cannot be healed.
	noEmail := model.User{Username: "oauth-no-email", Password: "password123", AffCode: "aff-no-email", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&noEmail).Error)
	selfHealOAuthEmailVerification(&noEmail, &oauth.OAuthUser{EmailVerified: true})
	require.Zero(t, noEmail.EmailVerifiedAt)
}
