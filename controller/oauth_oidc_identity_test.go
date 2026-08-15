package controller

import (
	"fmt"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupOIDCIdentityControllerTest(t *testing.T) {
	t.Helper()
	previousDB := model.DB
	previousLogDB := model.LOG_DB
	previousMainType := common.MainDatabaseType()
	previousLogType := common.LogDatabaseType()
	previousRegisterEnabled := common.RegisterEnabled
	previousRedisEnabled := common.RedisEnabled

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.ExternalIdentityClaim{}, &model.Log{}))
	model.DB = db
	model.LOG_DB = db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RegisterEnabled = true
	common.RedisEnabled = false

	t.Cleanup(func() {
		sqlDB, closeErr := db.DB()
		if closeErr == nil {
			_ = sqlDB.Close()
		}
		model.DB = previousDB
		model.LOG_DB = previousLogDB
		common.SetDatabaseTypes(previousMainType, previousLogType)
		common.RegisterEnabled = previousRegisterEnabled
		common.RedisEnabled = previousRedisEnabled
	})
}

func TestFindOrCreateOIDCUserKeysOnExactSubjectNotEmail(t *testing.T) {
	setupOIDCIdentityControllerTest(t)

	existing := &model.User{
		Username: "password-user",
		Password: "password",
		Email:    "shared@example.com",
		AffCode:  "pw01",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, model.DB.Create(existing).Error)

	provider := &oauth.OIDCProvider{}
	_, err := findOrCreateOAuthUser(nil, provider, &oauth.OAuthUser{
		ProviderUserID: "account-center-sub-1",
		Email:          "shared@example.com",
		DisplayName:    "Account Center User",
	}, "")
	var emailTaken *OAuthEmailAlreadyTakenError
	require.ErrorAs(t, err, &emailTaken)

	created, err := findOrCreateOAuthUser(nil, provider, &oauth.OAuthUser{
		ProviderUserID: "account-center-sub-1",
		Email:          "fresh@example.com",
		DisplayName:    "Account Center User",
	}, "")
	require.NoError(t, err)
	require.NotEqual(t, existing.Id, created.Id)
	assert.Equal(t, "account-center-sub-1", created.OidcId)
	assert.Equal(t, "fresh@example.com", created.Email)

	again, err := findOrCreateOAuthUser(nil, provider, &oauth.OAuthUser{
		ProviderUserID: "account-center-sub-1",
		Email:          "later@example.com",
		DisplayName:    "Renamed",
	}, "")
	require.NoError(t, err)
	assert.Equal(t, created.Id, again.Id)
	assert.Equal(t, "fresh@example.com", again.Email)

	other, err := findOrCreateOAuthUser(nil, provider, &oauth.OAuthUser{
		ProviderUserID: "account-center-sub-2",
		Email:          "other@example.com",
		DisplayName:    "Second Subject",
	}, "")
	require.NoError(t, err)
	assert.NotEqual(t, created.Id, other.Id)
}

func TestFindOrCreateOIDCUserIsIdempotentForTheSameSubject(t *testing.T) {
	setupOIDCIdentityControllerTest(t)

	provider := &oauth.OIDCProvider{}
	first, err := findOrCreateOAuthUser(nil, provider, &oauth.OAuthUser{
		ProviderUserID: "stable-sub",
		Email:          "one@example.com",
	}, "")
	require.NoError(t, err)
	second, err := findOrCreateOAuthUser(nil, provider, &oauth.OAuthUser{
		ProviderUserID: "stable-sub",
		Email:          "one@example.com",
	}, "")
	require.NoError(t, err)
	assert.Equal(t, first.Id, second.Id)

	var claims int64
	require.NoError(t, model.DB.Model(&model.ExternalIdentityClaim{}).
		Where("provider = ?", model.ExternalIdentityProviderOIDC).Count(&claims).Error)
	assert.Equal(t, int64(1), claims)
}

func TestFindOrCreateOIDCUserPreservesCaseDistinctSubjects(t *testing.T) {
	setupOIDCIdentityControllerTest(t)

	provider := &oauth.OIDCProvider{}
	first, err := findOrCreateOAuthUser(nil, provider, &oauth.OAuthUser{
		ProviderUserID: "CaseSensitiveSubject",
		Email:          "upper@example.com",
	}, "")
	require.NoError(t, err)
	second, err := findOrCreateOAuthUser(nil, provider, &oauth.OAuthUser{
		ProviderUserID: "casesensitivesubject",
		Email:          "lower@example.com",
	}, "")
	require.NoError(t, err)
	assert.NotEqual(t, first.Id, second.Id)
}
