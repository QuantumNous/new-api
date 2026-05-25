package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func resetQuotaDataCacheForTest() {
	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	CacheQuotaData = make(map[string]*QuotaData)
}

func TestQuotaDataTokenAwareAggregation(t *testing.T) {
	truncateTables(t)
	resetQuotaDataCacheForTest()

	const (
		userID    = 1001
		tokenAID  = 2001
		tokenBID  = 2002
		timestamp = int64(1710000123)
	)
	bucket := timestamp - (timestamp % 3600)

	require.NoError(t, DB.Create(&QuotaData{
		UserID:    userID,
		Username:  "alice",
		TokenID:   0,
		ModelName: "gpt-test",
		CreatedAt: bucket,
		Count:     1,
		Quota:     50,
		TokenUsed: 5,
	}).Error)

	LogQuotaData(userID, "alice", tokenAID, "alpha", "gpt-test", 100, timestamp, 10)
	LogQuotaData(userID, "alice", tokenBID, "beta", "gpt-test", 200, timestamp+10, 20)
	SaveQuotaDataCache()

	var rows []QuotaData
	require.NoError(t, DB.Where("user_id = ? AND token_id > 0", userID).Order("token_id asc").Find(&rows).Error)
	require.Len(t, rows, 2)
	require.Equal(t, tokenAID, rows[0].TokenID)
	require.Equal(t, 100, rows[0].Quota)
	require.Equal(t, tokenBID, rows[1].TokenID)
	require.Equal(t, 200, rows[1].Quota)

	allRows, err := GetQuotaDataByUserId(userID, bucket, bucket, 0)
	require.NoError(t, err)
	require.Len(t, allRows, 1)
	require.NotZero(t, allRows[0].Id)
	require.Equal(t, userID, allRows[0].UserID)
	require.Equal(t, "alice", allRows[0].Username)
	require.Equal(t, "gpt-test", allRows[0].ModelName)
	require.Equal(t, 3, allRows[0].Count)
	require.Equal(t, 350, allRows[0].Quota)
	require.Equal(t, 35, allRows[0].TokenUsed)

	tokenRows, err := GetQuotaDataByUserId(userID, bucket, bucket, tokenAID)
	require.NoError(t, err)
	require.Len(t, tokenRows, 1)
	require.NotZero(t, tokenRows[0].Id)
	require.Equal(t, userID, tokenRows[0].UserID)
	require.Equal(t, "alice", tokenRows[0].Username)
	require.Equal(t, tokenAID, tokenRows[0].TokenID)
	require.Equal(t, 1, tokenRows[0].Count)
	require.Equal(t, 100, tokenRows[0].Quota)
	require.Equal(t, 10, tokenRows[0].TokenUsed)
}

func TestQuotaDataTokenNameUpdateDoesNotChangeIdentity(t *testing.T) {
	truncateTables(t)
	resetQuotaDataCacheForTest()

	const (
		userID    = 1002
		tokenID   = 2010
		timestamp = int64(1710004123)
	)
	bucket := timestamp - (timestamp % 3600)

	LogQuotaData(userID, "alice", tokenID, "old-name", "gpt-test", 100, timestamp, 10)
	SaveQuotaDataCache()
	LogQuotaData(userID, "alice", tokenID, "new-name", "gpt-test", 25, timestamp+120, 3)
	SaveQuotaDataCache()

	var rows []QuotaData
	require.NoError(t, DB.Where("user_id = ? AND token_id = ? AND model_name = ? AND created_at = ?", userID, tokenID, "gpt-test", bucket).Find(&rows).Error)
	require.Len(t, rows, 1)
	require.Equal(t, "new-name", rows[0].TokenName)
	require.Equal(t, 2, rows[0].Count)
	require.Equal(t, 125, rows[0].Quota)
	require.Equal(t, 13, rows[0].TokenUsed)
}
