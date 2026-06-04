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

func TestIsGoogleIdAlreadyTaken(t *testing.T) {
	truncateTables(t)
	require.False(t, IsGoogleIdAlreadyTaken("google-sub-456"))
	require.NoError(t, DB.Create(&User{Username: "g2", GoogleId: "google-sub-456"}).Error)
	require.True(t, IsGoogleIdAlreadyTaken("google-sub-456"))
}
