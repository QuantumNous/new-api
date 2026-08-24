package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
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

func TestFindUsersByNormalizedEmail(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Create(&User{Username: "email-user", Email: " AFOAVI@GMAIL.COM "}).Error)

	users, err := FindUsersByNormalizedEmail("afoavi@gmail.com")

	require.NoError(t, err)
	require.Len(t, users, 1)
	require.Equal(t, "email-user", users[0].Username)
}

func TestUserMaintainsNormalizedEmailOnCreateAndUpdate(t *testing.T) {
	truncateTables(t)
	user := &User{Username: "normalized-email-user", Email: " First@Example.COM "}
	require.NoError(t, DB.Create(user).Error)
	require.Equal(t, "first@example.com", user.NormalizedEmail)

	require.NoError(t, DB.Model(&User{}).Where("id = ?", user.Id).Update("email", " SECOND@Example.COM ").Error)

	var stored User
	require.NoError(t, DB.First(&stored, user.Id).Error)
	require.Equal(t, "second@example.com", stored.NormalizedEmail)

	require.NoError(t, DB.Model(&stored).Updates(User{Email: " THIRD@Example.COM "}).Error)
	require.NoError(t, DB.First(&stored, user.Id).Error)
	require.Equal(t, "third@example.com", stored.NormalizedEmail)

	stored.Email = " FOURTH@Example.COM "
	require.NoError(t, DB.Save(&stored).Error)
	require.NoError(t, DB.First(&stored, user.Id).Error)
	require.Equal(t, "fourth@example.com", stored.NormalizedEmail)
}

func TestFindUsersByNormalizedEmailUsesIndexedColumn(t *testing.T) {
	statement := normalizedEmailUsersQuery(
		DB.Session(&gorm.Session{DryRun: true}),
		" User@Example.COM ",
	).Find(&[]User{}).Statement
	sql := strings.ToLower(statement.SQL.String())

	require.Contains(t, sql, "normalized_email")
	require.NotContains(t, sql, "lower(")
	require.True(t, DB.Migrator().HasIndex(&User{}, "idx_users_normalized_email"))
}

func TestBackfillUserNormalizedEmailsRepairsLegacyRows(t *testing.T) {
	truncateTables(t)
	user := &User{Username: "legacy-normalized-email", Email: "old@example.com"}
	require.NoError(t, DB.Create(user).Error)
	require.NoError(t, DB.Exec(
		"UPDATE users SET email = ?, normalized_email = '' WHERE id = ?",
		" Legacy@Example.COM ",
		user.Id,
	).Error)

	require.NoError(t, backfillUserNormalizedEmails(DB))

	var stored User
	require.NoError(t, DB.First(&stored, user.Id).Error)
	require.Equal(t, "legacy@example.com", stored.NormalizedEmail)
}

func TestBindGoogleIDIfEmptyDoesNotOverwriteExistingBinding(t *testing.T) {
	truncateTables(t)
	user := &User{Username: "google-bind-user"}
	require.NoError(t, DB.Create(user).Error)

	bound, err := user.BindGoogleIDIfEmpty("google-sub-1")
	require.NoError(t, err)
	require.True(t, bound)
	require.Equal(t, "google-sub-1", user.GoogleId)

	bound, err = user.BindGoogleIDIfEmpty("google-sub-2")
	require.NoError(t, err)
	require.False(t, bound)
	require.Equal(t, "google-sub-1", user.GoogleId)
}
