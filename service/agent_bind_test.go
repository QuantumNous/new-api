package service

import (
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"path/filepath"
	"testing"
)

func setupAgentBindServiceDB(t *testing.T) *gorm.DB {
	t.Helper()
	original := model.DB
	db, err := gorm.Open(sqlite.Open("file:"+filepath.Join(t.TempDir(), "agent-bind.db")), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.AgentAccount{}))
	model.DB = db
	t.Cleanup(func() { model.DB = original; sql, _ := db.DB(); _ = sql.Close() })
	return db
}
func TestTryBindUserToAgentRejectsMissingAndDisabledAgents(t *testing.T) {
	db := setupAgentBindServiceDB(t)
	require.NoError(t, db.Create(&model.User{Id: 7201, Username: "customer"}).Error)
	require.NoError(t, db.Create(&model.AgentAccount{UserId: 7202, Status: model.AgentAccountStatusDisabled}).Error)
	for _, id := range []int{7299, 7202} {
		bound, err := TryBindUserToAgent(7201, id)
		require.NoError(t, err)
		assert.False(t, bound)
	}
	var u model.User
	require.NoError(t, db.First(&u, 7201).Error)
	assert.Zero(t, u.BoundAgentId)
}
