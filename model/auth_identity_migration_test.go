package model

import (
	"bytes"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type legacyExternalIdentityClaimSchema struct {
	Id        int64  `gorm:"primaryKey"`
	Provider  string `gorm:"type:varchar(32);not null;uniqueIndex:idx_external_identity_subject,priority:1;uniqueIndex:idx_external_identity_user,priority:1"`
	Subject   string `gorm:"type:varchar(128);not null;uniqueIndex:idx_external_identity_subject,priority:2"`
	UserId    int    `gorm:"not null;index;uniqueIndex:idx_external_identity_user,priority:2"`
	CreatedAt time.Time
}

func (legacyExternalIdentityClaimSchema) TableName() string {
	return "external_identity_claims"
}

type legacyUserOAuthBindingSchema struct {
	Id             int    `gorm:"primaryKey"`
	UserId         int    `gorm:"not null;uniqueIndex:ux_user_provider"`
	ProviderId     int    `gorm:"not null;uniqueIndex:ux_user_provider;uniqueIndex:ux_provider_userid"`
	ProviderUserId string `gorm:"type:varchar(256);not null;uniqueIndex:ux_provider_userid"`
	CreatedAt      time.Time
}

func (legacyUserOAuthBindingSchema) TableName() string {
	return "user_oauth_bindings"
}

func migrateLegacyAuthIdentityTestTables(t *testing.T, db *gorm.DB) {
	t.Helper()
	require.NoError(t, db.AutoMigrate(
		&legacyExternalIdentityClaimSchema{},
		&legacyUserOAuthBindingSchema{},
	))
	assert.False(t, db.Migrator().HasColumn(&ExternalIdentityClaim{}, "AuthIdentityMigratedAt"))
	assert.False(t, db.Migrator().HasColumn(&UserOAuthBinding{}, "AuthIdentityMigratedAt"))
}

func TestInitializeAuthIdentitiesWithoutLegacyTables(t *testing.T) {
	db := setupAuthIdentityTestDB(t)
	require.NoError(t, db.AutoMigrate(
		&UserSession{},
		&AuthFlow{},
		&PasskeyCredential{},
		&Token{},
		&TwoFA{},
		&TwoFABackupCode{},
	))
	assert.False(t, db.Migrator().HasTable(&ExternalIdentityClaim{}))
	assert.False(t, db.Migrator().HasTable(&UserOAuthBinding{}))

	user := createAuthIdentityTestUser(t, db, "identity-without-legacy-tables")
	require.NoError(t, EnsureAuthIdentity(user.Id, AuthIdentityProviderGitHub, "fresh-database-subject"))
	require.NoError(t, InitializeAuthIdentities())

	owner, err := GetUserByAuthIdentity(AuthIdentityProviderGitHub, "fresh-database-subject")
	require.NoError(t, err)
	assert.Equal(t, user.Id, owner.Id)
	require.NoError(t, user.HardDelete())
	assert.False(t, db.Migrator().HasTable(&ExternalIdentityClaim{}))
	assert.False(t, db.Migrator().HasTable(&UserOAuthBinding{}))
}

func TestInitializeAuthIdentitiesMigratesLegacySourcesOnce(t *testing.T) {
	db := setupAuthIdentityTestDB(t)
	migrateLegacyAuthIdentityTestTables(t, db)

	user := createAuthIdentityTestUser(t, db, "legacy-identity-owner")
	require.NoError(t, db.Create(&legacyExternalIdentityClaimSchema{
		Provider: ExternalIdentityProviderTelegram,
		Subject:  "legacy-telegram-subject",
		UserId:   user.Id,
	}).Error)
	require.NoError(t, db.Create(&legacyUserOAuthBindingSchema{
		UserId:         user.Id,
		ProviderId:     41,
		ProviderUserId: "legacy-custom-subject",
	}).Error)

	require.NoError(t, InitializeAuthIdentities())
	assert.True(t, db.Migrator().HasColumn(&ExternalIdentityClaim{}, "AuthIdentityMigratedAt"))
	assert.True(t, db.Migrator().HasColumn(&UserOAuthBinding{}, "AuthIdentityMigratedAt"))

	telegramOwner, err := GetUserByAuthIdentity(AuthIdentityProviderTelegram, "legacy-telegram-subject")
	require.NoError(t, err)
	assert.Equal(t, user.Id, telegramOwner.Id)
	customOwner, err := GetUserByOAuthBinding(41, "legacy-custom-subject")
	require.NoError(t, err)
	assert.Equal(t, user.Id, customOwner.Id)

	bindings, err := GetUserOAuthBindingsByUserId(user.Id)
	require.NoError(t, err)
	require.Len(t, bindings, 1)
	assert.Equal(t, 41, bindings[0].ProviderId)
	assert.Equal(t, "legacy-custom-subject", bindings[0].ProviderUserId)

	var legacyClaim ExternalIdentityClaim
	require.NoError(t, db.First(&legacyClaim).Error)
	require.NotNil(t, legacyClaim.AuthIdentityMigratedAt)
	var legacyBinding UserOAuthBinding
	require.NoError(t, db.First(&legacyBinding).Error)
	require.NotNil(t, legacyBinding.AuthIdentityMigratedAt)

	var identityCount int64
	require.NoError(t, db.Model(&AuthIdentity{}).Count(&identityCount).Error)
	assert.EqualValues(t, 2, identityCount)
	require.NoError(t, InitializeAuthIdentities())
	require.NoError(t, db.Model(&AuthIdentity{}).Count(&identityCount).Error)
	assert.EqualValues(t, 2, identityCount)

	require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
		return ReleaseExternalIdentityWithTx(tx, ExternalIdentityProviderTelegram, user.Id)
	}))
	require.NoError(t, DeleteUserOAuthBinding(user.Id, 41))
	require.NoError(t, InitializeAuthIdentities())
	require.NoError(t, db.Model(&AuthIdentity{}).Count(&identityCount).Error)
	assert.Zero(t, identityCount, "marked legacy rows must not resurrect deleted runtime bindings")
	require.NoError(t, db.Model(&ExternalIdentityClaim{}).Count(&identityCount).Error)
	assert.EqualValues(t, 1, identityCount, "legacy Telegram data is retained")
	require.NoError(t, db.Model(&UserOAuthBinding{}).Count(&identityCount).Error)
	assert.EqualValues(t, 1, identityCount, "legacy custom OAuth data is retained")
}

func TestLegacyExternalIdentityConflictContinuesWithoutLeakingSubject(t *testing.T) {
	db := setupAuthIdentityTestDB(t)
	require.NoError(t, db.AutoMigrate(&legacyExternalIdentityClaimSchema{}))

	winner := createAuthIdentityTestUser(t, db, "existing-identity-winner")
	conflictingLegacyOwner := createAuthIdentityTestUser(t, db, "conflicting-legacy-owner")
	normalLegacyOwner := createAuthIdentityTestUser(t, db, "normal-legacy-owner")
	require.NoError(t, EnsureAuthIdentity(winner.Id, AuthIdentityProviderTelegram, "private-conflict-subject"))
	require.NoError(t, db.Create(&legacyExternalIdentityClaimSchema{
		Provider: ExternalIdentityProviderTelegram,
		Subject:  "private-conflict-subject",
		UserId:   conflictingLegacyOwner.Id,
	}).Error)
	require.NoError(t, db.Create(&legacyExternalIdentityClaimSchema{
		Provider: ExternalIdentityProviderTelegram,
		Subject:  "private-normal-subject",
		UserId:   normalLegacyOwner.Id,
	}).Error)

	var logOutput bytes.Buffer
	common.LogWriterMu.Lock()
	oldDefaultWriter := gin.DefaultWriter
	gin.DefaultWriter = &logOutput
	common.LogWriterMu.Unlock()
	t.Cleanup(func() {
		common.LogWriterMu.Lock()
		gin.DefaultWriter = oldDefaultWriter
		common.LogWriterMu.Unlock()
	})

	require.NoError(t, InitializeAuthIdentities())

	conflictWinner, err := GetUserByAuthIdentity(AuthIdentityProviderTelegram, "private-conflict-subject")
	require.NoError(t, err)
	assert.Equal(t, winner.Id, conflictWinner.Id)
	normalOwner, err := GetUserByAuthIdentity(AuthIdentityProviderTelegram, "private-normal-subject")
	require.NoError(t, err)
	assert.Equal(t, normalLegacyOwner.Id, normalOwner.Id)

	var migratedRows []ExternalIdentityClaim
	require.NoError(t, db.Order("id ASC").Find(&migratedRows).Error)
	require.Len(t, migratedRows, 2)
	require.NotNil(t, migratedRows[0].AuthIdentityMigratedAt)
	require.NotNil(t, migratedRows[1].AuthIdentityMigratedAt)
	assert.Contains(t, logOutput.String(), "skipped 1 known conflicts")
	assert.NotContains(t, logOutput.String(), "private-conflict-subject")
	assert.NotContains(t, logOutput.String(), "private-normal-subject")
}

func TestCustomOAuthCompatibilityAPIUsesAuthIdentityAuthority(t *testing.T) {
	db := setupAuthIdentityTestDB(t)
	require.NoError(t, db.AutoMigrate(&legacyUserOAuthBindingSchema{}))

	first := createAuthIdentityTestUser(t, db, "custom-identity-first")
	second := createAuthIdentityTestUser(t, db, "custom-identity-second")
	binding := &UserOAuthBinding{UserId: first.Id, ProviderId: 77, ProviderUserId: "custom-subject"}
	require.NoError(t, CreateUserOAuthBinding(binding))
	assert.NotZero(t, binding.Id)

	err := CreateUserOAuthBinding(&UserOAuthBinding{UserId: second.Id, ProviderId: 77, ProviderUserId: "custom-subject"})
	assert.ErrorIs(t, err, ErrAuthIdentityAlreadyBound)
	err = CreateUserOAuthBinding(&UserOAuthBinding{UserId: first.Id, ProviderId: 77, ProviderUserId: "different-subject"})
	assert.ErrorIs(t, err, ErrAuthIdentityProviderAlreadyBound)

	stored, err := GetUserOAuthBinding(first.Id, 77)
	require.NoError(t, err)
	assert.Equal(t, "custom-subject", stored.ProviderUserId)
	owner, err := GetUserByOAuthBinding(77, "custom-subject")
	require.NoError(t, err)
	assert.Equal(t, first.Id, owner.Id)
	assert.True(t, IsProviderUserIdTaken(77, "custom-subject"))
	count, err := GetBindingCountByProviderId(77)
	require.NoError(t, err)
	assert.EqualValues(t, 1, count)

	var legacyCount int64
	require.NoError(t, db.Model(&UserOAuthBinding{}).Count(&legacyCount).Error)
	assert.Zero(t, legacyCount, "runtime binding must not write the legacy table")

	require.NoError(t, UpdateUserOAuthBinding(first.Id, 77, "updated-custom-subject"))
	_, err = GetUserByOAuthBinding(77, "custom-subject")
	assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
	owner, err = GetUserByOAuthBinding(77, "updated-custom-subject")
	require.NoError(t, err)
	assert.Equal(t, first.Id, owner.Id)
	require.NoError(t, DeleteUserOAuthBinding(first.Id, 77))
	count, err = GetBindingCountByProviderId(77)
	require.NoError(t, err)
	assert.Zero(t, count)
}
