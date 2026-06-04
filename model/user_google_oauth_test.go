package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFillUserByGoogleId(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Create(&User{
		Username: "google_tester",
		GoogleId: "google-sub-123",
	}).Error)

	u := &User{GoogleId: "google-sub-123"}
	require.NoError(t, u.FillUserByGoogleId())
	require.Equal(t, "google_tester", u.Username)
}

func TestFillUserByGoogleId_EmptyId(t *testing.T) {
	u := &User{}
	require.Error(t, u.FillUserByGoogleId())
}

func TestFillUserByGoogleId_NotFound(t *testing.T) {
	truncateTables(t)
	// Mirrors OIDC behavior: a non-empty id with no matching row returns no error
	// and leaves the user as zero-value. Callers must gate with IsGoogleIdAlreadyTaken.
	u := &User{GoogleId: "does-not-exist"}
	require.NoError(t, u.FillUserByGoogleId())
	require.Zero(t, u.Id)
}

func TestIsGoogleIdAlreadyTaken_SoftDeletedStillTaken(t *testing.T) {
	truncateTables(t)
	user := &User{Username: "g_soft", GoogleId: "google-sub-soft"}
	require.NoError(t, DB.Create(user).Error)
	// Soft-delete the user; the google_id must remain reserved (Unscoped).
	require.NoError(t, DB.Delete(user).Error)
	require.True(t, IsGoogleIdAlreadyTaken("google-sub-soft"))
}

func TestIsGoogleIdAlreadyTaken(t *testing.T) {
	truncateTables(t)
	require.False(t, IsGoogleIdAlreadyTaken("google-sub-456"))
	require.NoError(t, DB.Create(&User{Username: "g2", GoogleId: "google-sub-456"}).Error)
	require.True(t, IsGoogleIdAlreadyTaken("google-sub-456"))
}
