package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func useAffCodeSequence(t *testing.T, codes ...string) {
	t.Helper()
	original := affCodeGenerator
	next := 0
	affCodeGenerator = func() string {
		if next >= len(codes) {
			return codes[len(codes)-1]
		}
		code := codes[next]
		next++
		return code
	}
	t.Cleanup(func() {
		affCodeGenerator = original
	})
}

func TestInsertRetriesAffCodeReservedBySoftDeletedUser(t *testing.T) {
	setupUserUpdateTestState(t)

	deletedUser := User{
		Username: "deleted-aff-owner",
		Password: "password",
		AffCode:  "Taken001",
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, DB.Create(&deletedUser).Error)
	require.NoError(t, DB.Delete(&deletedUser).Error)
	useAffCodeSequence(t, "Taken001", "Unique01")

	user := User{
		Username: "new-aff-owner",
		Password: "password",
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, user.Insert(0))

	var stored User
	require.NoError(t, DB.Where("username = ?", user.Username).First(&stored).Error)
	assert.Equal(t, "Unique01", stored.AffCode)
}

func TestInsertGeneratesEightCharacterAffCode(t *testing.T) {
	setupUserUpdateTestState(t)

	user := User{
		Username: "new-aff-code-length",
		Password: "password",
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, user.Insert(0))
	assert.Len(t, user.AffCode, affCodeLength)
}

func TestInsertWithTxSelectsAvailableAffCode(t *testing.T) {
	setupUserUpdateTestState(t)

	require.NoError(t, DB.Create(&User{
		Username: "existing-aff-owner",
		Password: "password",
		AffCode:  "Taken002",
		Status:   common.UserStatusEnabled,
	}).Error)
	useAffCodeSequence(t, "Taken002", "Unique02")

	user := User{
		Username: "oauth-aff-owner",
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, user.PrepareAffCode())
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return user.InsertWithTx(tx, 0)
	}))
	assert.Equal(t, "Unique02", user.AffCode)
}

func TestEnsureUserAffCodeRetriesTakenCodeAndKeepsExistingCode(t *testing.T) {
	setupUserUpdateTestState(t)

	require.NoError(t, DB.Create(&User{
		Username: "existing-aff-owner",
		Password: "password",
		AffCode:  "Taken003",
		Status:   common.UserStatusEnabled,
	}).Error)
	user := User{
		Username: "legacy-user-without-aff-code",
		Password: "password",
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, DB.Create(&user).Error)
	useAffCodeSequence(t, "Taken003", "Unique03")

	require.NoError(t, user.EnsureAffCode())
	assert.Equal(t, "Unique03", user.AffCode)

	require.NoError(t, user.EnsureAffCode())
	assert.Equal(t, "Unique03", user.AffCode)
}
