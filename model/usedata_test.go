package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLogQuotaDataPersistsTokenBreakdown(t *testing.T) {
	truncateTables(t)
	CacheQuotaDataLock.Lock()
	CacheQuotaData = make(map[string]*QuotaData)
	CacheQuotaDataLock.Unlock()

	createdAt := int64(1710000123)
	LogQuotaData(1, "alice", "gpt-test", 200, createdAt, 170, 100, 40, 20, 10)
	LogQuotaData(1, "alice", "gpt-test", 300, createdAt+10, 255, 150, 60, 30, 15)

	SaveQuotaDataCache()

	var quotaData QuotaData
	require.NoError(t, DB.Table("quota_data").Where("user_id = ? AND model_name = ?", 1, "gpt-test").First(&quotaData).Error)
	require.Equal(t, 2, quotaData.Count)
	require.Equal(t, 500, quotaData.Quota)
	require.Equal(t, 425, quotaData.TokenUsed)
	require.Equal(t, 250, quotaData.PromptTokens)
	require.Equal(t, 100, quotaData.CompletionTokens)
	require.Equal(t, 50, quotaData.CacheReadTokens)
	require.Equal(t, 25, quotaData.CacheWriteTokens)
}

func TestSaveQuotaDataCacheIncrementsExistingTokenBreakdown(t *testing.T) {
	truncateTables(t)
	CacheQuotaDataLock.Lock()
	CacheQuotaData = make(map[string]*QuotaData)
	CacheQuotaDataLock.Unlock()

	createdAt := int64(1710000000)
	require.NoError(t, DB.Create(&QuotaData{
		UserID:           2,
		Username:         "bob",
		ModelName:        "gpt-test",
		CreatedAt:        createdAt,
		Count:            1,
		Quota:            100,
		TokenUsed:        80,
		PromptTokens:     50,
		CompletionTokens: 20,
		CacheReadTokens:  5,
		CacheWriteTokens: 5,
	}).Error)

	LogQuotaData(2, "bob", "gpt-test", 150, createdAt+1, 120, 70, 30, 10, 10)
	SaveQuotaDataCache()

	var quotaData QuotaData
	require.NoError(t, DB.Table("quota_data").Where("user_id = ? AND model_name = ?", 2, "gpt-test").First(&quotaData).Error)
	require.Equal(t, 2, quotaData.Count)
	require.Equal(t, 250, quotaData.Quota)
	require.Equal(t, 200, quotaData.TokenUsed)
	require.Equal(t, 120, quotaData.PromptTokens)
	require.Equal(t, 50, quotaData.CompletionTokens)
	require.Equal(t, 15, quotaData.CacheReadTokens)
	require.Equal(t, 15, quotaData.CacheWriteTokens)
}

func TestGetAllQuotaDatesReturnsZeroBreakdownForLegacyRows(t *testing.T) {
	truncateTables(t)

	require.NoError(t, DB.Create(&QuotaData{
		UserID:    3,
		Username:  "carol",
		ModelName: "legacy-model",
		CreatedAt: 1710000000,
		Count:     1,
		Quota:     100,
		TokenUsed: 80,
	}).Error)

	rows, err := GetAllQuotaDates(1709990000, 1710010000, "")
	require.NoError(t, err)
	require.Len(t, rows, 1)
	require.Equal(t, "legacy-model", rows[0].ModelName)
	require.Equal(t, 80, rows[0].TokenUsed)
	require.Zero(t, rows[0].PromptTokens)
	require.Zero(t, rows[0].CompletionTokens)
	require.Zero(t, rows[0].CacheReadTokens)
	require.Zero(t, rows[0].CacheWriteTokens)
}
