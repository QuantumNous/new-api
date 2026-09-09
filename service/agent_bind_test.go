package service

import (
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupAgentBindServiceDB(t *testing.T) *gorm.DB {
	t.Helper()
	originalDB := model.DB
	dsn := "file:" + filepath.Join(t.TempDir(), "agent-bind-service.db") + "?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.AgentAccount{}))
	model.DB = db
	t.Cleanup(func() {
		model.DB = originalDB
		sqlDB, dbErr := db.DB()
		require.NoError(t, dbErr)
		require.NoError(t, sqlDB.Close())
	})
	return db
}

func TestTryBindUserToAgentRequiresAnAgentAccount(t *testing.T) {
	db := setupAgentBindServiceDB(t)
	require.NoError(t, db.Create(&model.User{Id: 7201, Username: "customer-7201"}).Error)

	bound, err := TryBindUserToAgent(7201, 7299)
	require.NoError(t, err)
	assert.False(t, bound)

	var customer model.User
	require.NoError(t, db.First(&customer, 7201).Error)
	assert.Zero(t, customer.BoundAgentId)
}

// Ownership follows the agent who sold the code; a later suspension must
// not retroactively strip that attribution from an unbound customer.
func TestTryBindUserToAgentBindsDisabledAgentOwner(t *testing.T) {
	db := setupAgentBindServiceDB(t)
	require.NoError(t, db.Create(&model.User{Id: 7203, Username: "customer-7203"}).Error)
	require.NoError(t, db.Create(&model.AgentAccount{UserId: 7297, Status: model.AgentAccountStatusDisabled}).Error)

	bound, err := TryBindUserToAgent(7203, 7297)
	require.NoError(t, err)
	assert.True(t, bound)

	var customer model.User
	require.NoError(t, db.First(&customer, 7203).Error)
	assert.Equal(t, 7297, customer.BoundAgentId)
}
