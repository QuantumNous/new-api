package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestResolveRegistrationInviterPrioritizesExplicitAffAndRechecksDomainState(t *testing.T) {
	previousDB := model.DB
	previousDatabaseType := common.MainDatabaseType()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.CustomDomain{}))
	model.DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		model.DB = previousDB
		common.SetMainDatabaseType(previousDatabaseType)
	})

	owner := model.User{Username: "registration-owner", AffCode: "owner-aff", Status: common.UserStatusEnabled}
	explicit := model.User{Username: "registration-explicit", AffCode: "explicit-aff", Status: common.UserStatusDisabled}
	require.NoError(t, db.Create(&owner).Error)
	require.NoError(t, db.Create(&explicit).Error)
	domain, err := model.CreateCustomDomain("alpha", owner.Id)
	require.NoError(t, err)
	domain, err = model.EnableCustomDomain(domain.Label)
	require.NoError(t, err)

	inviterID, err := ResolveRegistrationInviter("", domain.Id)
	require.NoError(t, err)
	assert.Equal(t, owner.Id, inviterID)

	inviterID, err = ResolveRegistrationInviter("missing-aff", domain.Id)
	require.NoError(t, err)
	assert.Zero(t, inviterID)

	inviterID, err = ResolveRegistrationInviter("explicit-aff", domain.Id)
	require.NoError(t, err)
	assert.Equal(t, explicit.Id, inviterID)

	_, err = model.DisableCustomDomain(domain.Label)
	require.NoError(t, err)
	inviterID, err = ResolveRegistrationInviter("", domain.Id)
	require.NoError(t, err)
	assert.Zero(t, inviterID)

	_, err = model.EnableCustomDomain(domain.Label)
	require.NoError(t, err)
	require.NoError(t, db.Model(&model.User{}).Where("id = ?", owner.Id).Update("status", common.UserStatusDisabled).Error)
	inviterID, err = ResolveRegistrationInviter("", domain.Id)
	require.NoError(t, err)
	assert.Zero(t, inviterID)
}
