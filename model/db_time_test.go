package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestGetDBTimestampTxUsesActiveTransaction(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)

	tx := db.Begin()
	require.NoError(t, tx.Error)
	t.Cleanup(func() { _ = tx.Rollback().Error })

	before := time.Now().Unix()
	timestamp := GetDBTimestampTx(tx)
	after := time.Now().Unix()

	assert.GreaterOrEqual(t, timestamp, before)
	assert.LessOrEqual(t, timestamp, after)
}

func TestGetDBTimestampTxNilFallsBackToMainDatabase(t *testing.T) {
	before := time.Now().Unix()
	timestamp := GetDBTimestampTx(nil)
	after := time.Now().Unix()

	assert.GreaterOrEqual(t, timestamp, before)
	assert.LessOrEqual(t, timestamp, after)
}

func TestGetDBTimestampFromFallsBackWhenQueryFails(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	require.NoError(t, sqlDB.Close())

	before := common.GetTimestamp()
	timestamp := getDBTimestampFrom(db)
	after := common.GetTimestamp()

	assert.GreaterOrEqual(t, timestamp, before)
	assert.LessOrEqual(t, timestamp, after)
}
