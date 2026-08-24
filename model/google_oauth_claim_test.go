package model

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func resetGoogleOAuthClaims(t *testing.T) {
	t.Helper()
	require.NoError(t, DB.AutoMigrate(&GoogleOAuthClaim{}))
	require.NoError(t, DB.Exec("DELETE FROM google_oauth_claims").Error)
	t.Cleanup(func() {
		DB.Exec("DELETE FROM google_oauth_claims")
	})
}

func TestClaimGoogleOAuthIdentityReturnsExistingWinner(t *testing.T) {
	truncateTables(t)
	resetGoogleOAuthClaims(t)

	winner := &User{Username: "google-claim-winner", Email: " Winner@Gmail.COM ", AffCode: "gcw1"}
	loser := &User{Username: "google-claim-loser", Email: "winner@gmail.com", AffCode: "gcl1"}
	require.NoError(t, DB.Create(winner).Error)
	require.NoError(t, DB.Create(loser).Error)

	claim, won, err := ClaimGoogleOAuthIdentityWithTx(DB, winner.Id, winner.Email, "google-sub-winner")
	require.NoError(t, err)
	require.True(t, won)
	require.Equal(t, "winner@gmail.com", claim.NormalizedEmail)
	require.Equal(t, winner.Id, claim.UserID)
	retriedClaim, owned, err := ClaimGoogleOAuthIdentityWithTx(DB, winner.Id, winner.Email, "google-sub-winner")
	require.NoError(t, err)
	require.True(t, owned)
	require.Equal(t, claim.ID, retriedClaim.ID)

	claim, won, err = ClaimGoogleOAuthIdentityWithTx(DB, loser.Id, loser.Email, "google-sub-loser")
	require.NoError(t, err)
	require.False(t, won)
	require.Equal(t, winner.Id, claim.UserID)
	require.Equal(t, "google-sub-winner", claim.GoogleID)
}

func TestClaimGoogleOAuthIdentityRejectsCrossClaimConflict(t *testing.T) {
	truncateTables(t)
	resetGoogleOAuthClaims(t)

	first := &User{Username: "google-claim-first", Email: "first@gmail.com", AffCode: "gcf1"}
	second := &User{Username: "google-claim-second", Email: "second@gmail.com", AffCode: "gcs1"}
	third := &User{Username: "google-claim-third", Email: "third@gmail.com", AffCode: "gct1"}
	for _, user := range []*User{first, second, third} {
		require.NoError(t, DB.Create(user).Error)
	}
	_, won, err := ClaimGoogleOAuthIdentityWithTx(DB, first.Id, first.Email, "google-sub-first")
	require.NoError(t, err)
	require.True(t, won)
	_, won, err = ClaimGoogleOAuthIdentityWithTx(DB, second.Id, second.Email, "google-sub-second")
	require.NoError(t, err)
	require.True(t, won)

	_, won, err = ClaimGoogleOAuthIdentityWithTx(DB, third.Id, first.Email, "google-sub-second")
	require.False(t, won)
	require.ErrorIs(t, err, ErrGoogleOAuthClaimConflict)
}

func TestLosingGoogleOAuthClaimRollsBackNewUser(t *testing.T) {
	truncateTables(t)
	resetGoogleOAuthClaims(t)

	winner := &User{Username: "google-race-winner", Email: "race@gmail.com", AffCode: "grw1"}
	require.NoError(t, DB.Create(winner).Error)
	_, won, err := ClaimGoogleOAuthIdentityWithTx(DB, winner.Id, winner.Email, "google-sub-race-winner")
	require.NoError(t, err)
	require.True(t, won)

	rollback := errors.New("google oauth claim lost")
	loser := &User{Username: "google-race-loser", Email: " RACE@GMAIL.COM ", AffCode: "grl1"}
	err = DB.Transaction(func(tx *gorm.DB) error {
		require.NoError(t, tx.Create(loser).Error)
		claim, claimWon, claimErr := ClaimGoogleOAuthIdentityWithTx(
			tx,
			loser.Id,
			loser.Email,
			"google-sub-race-loser",
		)
		require.NoError(t, claimErr)
		require.False(t, claimWon)
		require.Equal(t, winner.Id, claim.UserID)
		return rollback
	})
	require.ErrorIs(t, err, rollback)

	var loserCount int64
	require.NoError(t, DB.Model(&User{}).Where("username = ?", loser.Username).Count(&loserCount).Error)
	require.Zero(t, loserCount)
	var claimCount int64
	require.NoError(t, DB.Model(&GoogleOAuthClaim{}).Count(&claimCount).Error)
	require.EqualValues(t, 1, claimCount)
}

func TestGoogleOAuthClaimIsInOrderedMigrations(t *testing.T) {
	found := false
	for _, migration := range orderedMigrationModels() {
		if _, ok := migration.model.(*GoogleOAuthClaim); ok {
			found = true
			break
		}
	}
	require.True(t, found)
}
