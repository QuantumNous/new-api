package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestExternalIdentityClaimEnforcesSingleOwnerAtomically(t *testing.T) {
	truncateTables(t)

	first := User{Username: "telegram-owner-one", Password: "password", AffCode: "telegram-owner-one"}
	second := User{Username: "telegram-owner-two", Password: "password", AffCode: "telegram-owner-two"}
	require.NoError(t, DB.Create(&first).Error)
	require.NoError(t, DB.Create(&second).Error)

	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return ClaimExternalIdentityWithTx(tx, ExternalIdentityProviderTelegram, "telegram-123", first.Id)
	}))
	err := DB.Transaction(func(tx *gorm.DB) error {
		return ClaimExternalIdentityWithTx(tx, ExternalIdentityProviderTelegram, "telegram-123", second.Id)
	})
	assert.ErrorIs(t, err, ErrExternalIdentityAlreadyClaimed)

	err = DB.Transaction(func(tx *gorm.DB) error {
		return ClaimExternalIdentityWithTx(tx, ExternalIdentityProviderTelegram, "telegram-456", first.Id)
	})
	assert.ErrorIs(t, err, ErrExternalIdentityAlreadyClaimed)

	var claims []ExternalIdentityClaim
	require.NoError(t, DB.Find(&claims).Error)
	require.Len(t, claims, 1)
	assert.Equal(t, first.Id, claims[0].UserId)
	assert.Equal(t, "telegram-123", claims[0].Subject)

	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return ReleaseExternalIdentityWithTx(tx, ExternalIdentityProviderTelegram, first.Id)
	}))
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return ClaimExternalIdentityWithTx(tx, ExternalIdentityProviderTelegram, "telegram-123", second.Id)
	}))
}

func TestClearTelegramBindingReleasesIdentityClaim(t *testing.T) {
	truncateTables(t)

	user := User{Username: "telegram-unbind", Password: "password", TelegramId: "telegram-unbind-id"}
	require.NoError(t, DB.Create(&user).Error)
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return ClaimExternalIdentityWithTx(tx, ExternalIdentityProviderTelegram, user.TelegramId, user.Id)
	}))

	require.NoError(t, user.ClearBinding(ExternalIdentityProviderTelegram))
	assert.Empty(t, user.TelegramId)

	var count int64
	require.NoError(t, DB.Model(&ExternalIdentityClaim{}).Where("user_id = ?", user.Id).Count(&count).Error)
	assert.Zero(t, count)
}

func TestInitializeExternalIdentityClaimsIsIdempotent(t *testing.T) {
	truncateTables(t)

	user := User{Username: "telegram-legacy", Password: "password", TelegramId: "telegram-legacy-id", OidcId: "stable-oidc-subject"}
	require.NoError(t, DB.Create(&user).Error)
	require.NoError(t, InitializeExternalIdentityClaims())
	require.NoError(t, InitializeExternalIdentityClaims())

	var claim ExternalIdentityClaim
	require.NoError(t, DB.Where("provider = ? AND subject = ?", ExternalIdentityProviderTelegram, user.TelegramId).
		First(&claim).Error)
	assert.Equal(t, user.Id, claim.UserId)
	claim = ExternalIdentityClaim{}
	require.NoError(t, DB.Where("provider = ? AND subject = ?", ExternalIdentityProviderOIDC, user.OidcId).
		First(&claim).Error)
	assert.Equal(t, user.Id, claim.UserId)
}

func TestInitializeExternalIdentityClaimsRejectsAmbiguousLegacyBindings(t *testing.T) {
	truncateTables(t)

	first := User{Username: "telegram-legacy-one", Password: "password", TelegramId: "duplicate-telegram-id", AffCode: "telegram-legacy-one"}
	second := User{Username: "telegram-legacy-two", Password: "password", TelegramId: "duplicate-telegram-id", AffCode: "telegram-legacy-two"}
	require.NoError(t, DB.Create(&first).Error)
	require.NoError(t, DB.Create(&second).Error)

	err := InitializeExternalIdentityClaims()
	assert.ErrorIs(t, err, ErrExternalIdentityAlreadyClaimed)

	var count int64
	require.NoError(t, DB.Model(&ExternalIdentityClaim{}).Count(&count).Error)
	assert.Zero(t, count)
}

func TestExternalIdentityClaimPreservesCaseDistinctOpaqueOIDCSubjects(t *testing.T) {
	truncateTables(t)

	first := User{Username: "oidc-case-owner-one", Password: "password", AffCode: "oidc-case-owner-one"}
	second := User{Username: "oidc-case-owner-two", Password: "password", AffCode: "oidc-case-owner-two"}
	require.NoError(t, DB.Create(&first).Error)
	require.NoError(t, DB.Create(&second).Error)
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return ClaimExternalIdentityWithTx(tx, ExternalIdentityProviderOIDC, "CaseSensitiveSubject", first.Id)
	}))
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return ClaimExternalIdentityWithTx(tx, ExternalIdentityProviderOIDC, "casesensitivesubject", second.Id)
	}))

	firstResolved, err := GetUserByOidcId("CaseSensitiveSubject")
	require.NoError(t, err)
	assert.Equal(t, first.Id, firstResolved.Id)
	secondResolved, err := GetUserByOidcId("casesensitivesubject")
	require.NoError(t, err)
	assert.Equal(t, second.Id, secondResolved.Id)
}

func TestGetUserByOidcIdDoesNotResolveByEmail(t *testing.T) {
	truncateTables(t)

	user := User{
		Username: "email-only-user",
		Password: "password",
		Email:    "same@example.com",
		AffCode:  "email-only-user",
	}
	require.NoError(t, DB.Create(&user).Error)

	_, err := GetUserByOidcId("unrelated-oidc-subject")
	assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
}

func TestInitializeExternalIdentityClaimsRejectsAmbiguousLegacyOIDCBindings(t *testing.T) {
	truncateTables(t)

	first := User{Username: "oidc-legacy-one", Password: "password", OidcId: "duplicate-oidc-subject", AffCode: "oidc-legacy-one"}
	second := User{Username: "oidc-legacy-two", Password: "password", OidcId: "duplicate-oidc-subject", AffCode: "oidc-legacy-two"}
	require.NoError(t, DB.Create(&first).Error)
	require.NoError(t, DB.Create(&second).Error)

	err := InitializeExternalIdentityClaims()
	assert.ErrorIs(t, err, ErrExternalIdentityAlreadyClaimed)

	var count int64
	require.NoError(t, DB.Model(&ExternalIdentityClaim{}).Where("provider = ?", ExternalIdentityProviderOIDC).Count(&count).Error)
	assert.Zero(t, count)
}

func TestExternalIdentityClaimSchemaMigrationBackfillsDigestAndIsIdempotent(t *testing.T) {
	truncateTables(t)

	user := User{Username: "oidc-digest-backfill", Password: "password", AffCode: "oidc-digest-backfill"}
	require.NoError(t, DB.Create(&user).Error)
	legacySubject := "LegacyOpaqueSubject"
	require.NoError(t, DB.Exec(`
		INSERT INTO external_identity_claims (provider, subject, user_id, created_at)
		VALUES (?, ?, ?, CURRENT_TIMESTAMP)
	`, ExternalIdentityProviderOIDC, legacySubject, user.Id).Error)

	require.NoError(t, MigrateExternalIdentityClaimSchema())
	require.NoError(t, MigrateExternalIdentityClaimSchema())

	var claim ExternalIdentityClaim
	require.NoError(t, DB.Where("provider = ? AND subject = ?", ExternalIdentityProviderOIDC, legacySubject).First(&claim).Error)
	require.NotNil(t, claim.SubjectDigest)
	assert.Equal(t, externalIdentitySubjectDigest(legacySubject), *claim.SubjectDigest)
	resolved, err := GetUserByOidcId(legacySubject)
	require.NoError(t, err)
	assert.Equal(t, user.Id, resolved.Id)

	assert.True(t, DB.Migrator().HasIndex(&ExternalIdentityClaim{}, "idx_external_identity_subject_digest"))
	assert.False(t, DB.Migrator().HasIndex(&ExternalIdentityClaim{}, "idx_external_identity_subject"))
}
