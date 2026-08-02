package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestSearchUserTokensUnifiedQueryMatchesNameOrKey(t *testing.T) {
	previousDB := DB
	previousMainDatabaseType := common.MainDatabaseType()
	previousLogDatabaseType := common.LogDatabaseType()

	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	initCol()

	db, err := gorm.Open(sqlite.Open("file:token_search?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	DB = db
	require.NoError(t, DB.AutoMigrate(&Token{}))

	t.Cleanup(func() {
		if sqlDB, dbErr := db.DB(); dbErr == nil {
			_ = sqlDB.Close()
		}
		DB = previousDB
		common.SetDatabaseTypes(previousMainDatabaseType, previousLogDatabaseType)
		initCol()
	})

	tokens := []Token{
		{UserId: 1, Name: "shared-search", Key: "name-only-key"},
		{UserId: 1, Name: "key-only-name", Key: "shared-search"},
		{UserId: 1, Name: "unrelated", Key: "unrelated-key"},
		{UserId: 2, Name: "shared-search", Key: "other-user-key"},
	}
	require.NoError(t, DB.Create(&tokens).Error)

	results, total, err := SearchUserTokens(1, "", "", "shared-search", 0, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(2), total)
	resultIDs := make([]int, 0, len(results))
	for _, token := range results {
		resultIDs = append(resultIDs, token.Id)
	}
	assert.ElementsMatch(t, []int{tokens[0].Id, tokens[1].Id}, resultIDs)

	results, total, err = SearchUserTokens(1, "", "", "sk-shared-search", 0, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, results, 1)
	assert.Equal(t, tokens[1].Id, results[0].Id)

	results, total, err = SearchUserTokens(1, "shared-search", "name-only-key", "", 0, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, results, 1)
	assert.Equal(t, tokens[0].Id, results[0].Id)
}
