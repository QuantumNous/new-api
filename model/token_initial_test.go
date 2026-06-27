package model

import (
	"errors"
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

func TestEnsureInitialUserTokenHonorsZeroTokenLimit(t *testing.T) {
	setupInitialTokenModelTestDB(t)
	require.NoError(t, DB.Create(&User{Id: 22, Username: "blocked-owner", AffCode: "own3"}).Error)

	token, created, err := EnsureInitialUserToken(22, Token{
		Name:           "initial",
		Key:            "blocked-initial-key",
		ExpiredTime:    -1,
		UnlimitedQuota: true,
	}, 0)
	require.True(t, errors.Is(err, ErrUserTokenLimitReached), "got %v", err)
	require.False(t, created)
	require.Nil(t, token)

	var stored int64
	require.NoError(t, DB.Model(&Token{}).Where("user_id = ?", 22).Count(&stored).Error)
	require.Zero(t, stored)
}

func TestEnsureInitialUserTokenExistingTokenIgnoresZeroTokenLimit(t *testing.T) {
	setupInitialTokenModelTestDB(t)
	require.NoError(t, DB.Create(&User{Id: 23, Username: "existing-owner", AffCode: "own4"}).Error)
	require.NoError(t, DB.Create(&Token{UserId: 23, Name: "existing", Key: "existing-key", ExpiredTime: -1}).Error)

	token, created, err := EnsureInitialUserToken(23, Token{
		Name:           "initial",
		Key:            "should-not-create-key",
		ExpiredTime:    -1,
		UnlimitedQuota: true,
	}, 0)
	require.NoError(t, err)
	require.False(t, created)
	require.Nil(t, token)

	var stored int64
	require.NoError(t, DB.Model(&Token{}).Where("user_id = ?", 23).Count(&stored).Error)
	require.EqualValues(t, 1, stored)
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
