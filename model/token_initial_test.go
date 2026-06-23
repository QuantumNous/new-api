package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupInitialTokenModelTestDB(t *testing.T) {
	t.Helper()

	originalDB := DB
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&User{}, &Token{}))

	DB = db
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false

	t.Cleanup(func() {
		DB = originalDB
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
	})
}

func TestEnsureInitialUserTokenNormalizesTokenUserId(t *testing.T) {
	setupInitialTokenModelTestDB(t)
	require.NoError(t, DB.Create(&User{Id: 21, Username: "owner", AffCode: "own1"}).Error)
	require.NoError(t, DB.Create(&User{Id: 99, Username: "wrong-owner", AffCode: "own2"}).Error)

	token, created, err := EnsureInitialUserToken(21, Token{
		UserId:         99,
		Name:           "initial",
		Key:            "initial-key",
		ExpiredTime:    -1,
		UnlimitedQuota: true,
	}, 10)
	require.NoError(t, err)
	require.True(t, created)
	require.NotNil(t, token)
	require.Equal(t, 21, token.UserId)

	var stored Token
	require.NoError(t, DB.First(&stored, "id = ?", token.Id).Error)
	require.Equal(t, 21, stored.UserId)

	var wrongOwnerCount int64
	require.NoError(t, DB.Model(&Token{}).Where("user_id = ?", 99).Count(&wrongOwnerCount).Error)
	require.Zero(t, wrongOwnerCount)
}
