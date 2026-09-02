package service

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestPasswordResetReturnContextBindsTheEmailTokenAndCurrentDomainState(t *testing.T) {
	previousDB := model.DB
	previousDatabaseType := common.MainDatabaseType()
	previousSecret := common.SessionSecret
	previousSuffix := common.CustomDomainSuffix
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.CustomDomain{}))
	model.DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.SessionSecret = "password-reset-return-test-secret"
	common.CustomDomainSuffix = "yeschoy.io"
	t.Cleanup(func() {
		model.DB = previousDB
		common.SetMainDatabaseType(previousDatabaseType)
		common.SessionSecret = previousSecret
		common.CustomDomainSuffix = previousSuffix
	})

	owner := model.User{Username: "reset-context-owner", AffCode: "reset-context-aff", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&owner).Error)
	domain, err := model.CreateCustomDomain("alpha", owner.Id)
	require.NoError(t, err)
	domain, err = model.EnableCustomDomain(domain.Label)
	require.NoError(t, err)

	now := time.Now()
	context, err := CreatePasswordResetReturnContext(domain.Id, "alpha.yeschoy.io", "user@example.com", "reset-token", now.Add(10*time.Minute))
	require.NoError(t, err)

	targetHost, active, err := ResolvePasswordResetReturnContext(context, "user@example.com", "reset-token", now)
	require.NoError(t, err)
	assert.True(t, active)
	assert.Equal(t, "alpha.yeschoy.io", targetHost)

	_, _, err = ResolvePasswordResetReturnContext(context, "user@example.com", "other-token", now)
	assert.Error(t, err)

	_, err = model.DisableCustomDomain(domain.Label)
	require.NoError(t, err)
	targetHost, active, err = ResolvePasswordResetReturnContext(context, "user@example.com", "reset-token", now)
	require.NoError(t, err)
	assert.False(t, active)
	assert.Empty(t, targetHost)
}
