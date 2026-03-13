package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func prepareQuotaDataRankTest(t *testing.T) {
	t.Helper()
	require.NoError(t, DB.AutoMigrate(&QuotaData{}))
	require.NoError(t, DB.Exec("DELETE FROM quota_data").Error)
}

func TestGetUserConsumeRankings(t *testing.T) {
	prepareQuotaDataRankTest(t)

	seed := []*QuotaData{
		{UserID: 1, Username: "alpha", ModelName: "gpt-4o", CreatedAt: 1000, TokenUsed: 100, Quota: 300, Count: 3},
		{UserID: 1, Username: "alpha", ModelName: "gpt-4", CreatedAt: 1100, TokenUsed: 200, Quota: 200, Count: 2},
		{UserID: 2, Username: "beta", ModelName: "gpt-4o", CreatedAt: 1200, TokenUsed: 600, Quota: 400, Count: 4},
		{UserID: 3, Username: "gamma", ModelName: "claude-3-5", CreatedAt: 1300, TokenUsed: 450, Quota: 700, Count: 8},
		{UserID: 3, Username: "gamma", ModelName: "claude-3-5", CreatedAt: 2600, TokenUsed: 999, Quota: 999, Count: 9}, // out of range
	}
	require.NoError(t, DB.Table("quota_data").Create(seed).Error)

	tokenRank, quotaRank, err := GetUserConsumeRankings(900, 2000, 10, "")
	require.NoError(t, err)

	require.Len(t, tokenRank, 3)
	assert.Equal(t, 2, tokenRank[0].UserID)
	assert.EqualValues(t, 600, tokenRank[0].TokenUsed)
	assert.EqualValues(t, 400, tokenRank[0].Quota)
	assert.EqualValues(t, 4, tokenRank[0].Count)
	assert.Equal(t, 3, tokenRank[1].UserID)
	assert.EqualValues(t, 450, tokenRank[1].TokenUsed)
	assert.Equal(t, 1, tokenRank[2].UserID)
	assert.EqualValues(t, 300, tokenRank[2].TokenUsed)

	require.Len(t, quotaRank, 3)
	assert.Equal(t, 3, quotaRank[0].UserID)
	assert.EqualValues(t, 700, quotaRank[0].Quota)
	assert.Equal(t, 1, quotaRank[1].UserID)
	assert.EqualValues(t, 500, quotaRank[1].Quota)
	assert.Equal(t, 2, quotaRank[2].UserID)
	assert.EqualValues(t, 400, quotaRank[2].Quota)
}

func TestGetUserModelConsumeRankings(t *testing.T) {
	prepareQuotaDataRankTest(t)

	seed := []*QuotaData{
		{UserID: 9, Username: "worker", ModelName: "gpt-4o", CreatedAt: 1000, TokenUsed: 100, Quota: 50, Count: 1},
		{UserID: 9, Username: "worker", ModelName: "gpt-4o", CreatedAt: 1200, TokenUsed: 300, Quota: 100, Count: 2},
		{UserID: 9, Username: "worker", ModelName: "claude-3-5", CreatedAt: 1300, TokenUsed: 200, Quota: 500, Count: 1},
		{UserID: 10, Username: "other", ModelName: "gpt-4o", CreatedAt: 1400, TokenUsed: 999, Quota: 999, Count: 9}, // other user
		{UserID: 9, Username: "worker", ModelName: "gpt-4o", CreatedAt: 2700, TokenUsed: 999, Quota: 999, Count: 9}, // out of range
	}
	require.NoError(t, DB.Table("quota_data").Create(seed).Error)

	tokenRank, quotaRank, err := GetUserModelConsumeRankings(9, 900, 2000, 10)
	require.NoError(t, err)

	require.Len(t, tokenRank, 2)
	assert.Equal(t, "gpt-4o", tokenRank[0].ModelName)
	assert.EqualValues(t, 400, tokenRank[0].TokenUsed)
	assert.EqualValues(t, 150, tokenRank[0].Quota)
	assert.EqualValues(t, 3, tokenRank[0].Count)
	assert.Equal(t, "claude-3-5", tokenRank[1].ModelName)
	assert.EqualValues(t, 200, tokenRank[1].TokenUsed)

	require.Len(t, quotaRank, 2)
	assert.Equal(t, "claude-3-5", quotaRank[0].ModelName)
	assert.EqualValues(t, 500, quotaRank[0].Quota)
	assert.Equal(t, "gpt-4o", quotaRank[1].ModelName)
	assert.EqualValues(t, 150, quotaRank[1].Quota)
}

func TestGetUserConsumeRankingsParamValidation(t *testing.T) {
	prepareQuotaDataRankTest(t)

	_, _, err := GetUserConsumeRankings(0, 2000, 10, "")
	require.Error(t, err)
	assert.Equal(t, "invalid start time", err.Error())

	_, _, err = GetUserConsumeRankings(1000, 1000+2592001, 10, "")
	require.Error(t, err)
	assert.Equal(t, "time span cannot exceed 1 month", err.Error())
}

func TestGetUserModelConsumeRankingsParamValidation(t *testing.T) {
	prepareQuotaDataRankTest(t)

	_, _, err := GetUserModelConsumeRankings(0, 1000, 2000, 10)
	require.Error(t, err)
	assert.Equal(t, "invalid user id", err.Error())

	_, _, err = GetUserModelConsumeRankings(1, 1000, 1000+2592001, 10)
	require.Error(t, err)
	assert.Equal(t, "time span cannot exceed 1 month", err.Error())
}

func TestGetUserQuotaDatesParamValidation(t *testing.T) {
	prepareQuotaDataRankTest(t)

	_, err := GetUserQuotaDates(0, 1000, 2000)
	require.Error(t, err)
	assert.Equal(t, "invalid user id", err.Error())

	_, err = GetUserQuotaDates(1, 1000, 1000+2592001)
	require.Error(t, err)
	assert.Equal(t, "time span cannot exceed 1 month", err.Error())
}

func TestCheckRankParamOptionalUserID(t *testing.T) {
	limit, err := checkRankParam(rankCheckParam{
		startTime:    1000,
		endTime:      2000,
		limit:        0,
		defaultLimit: 20,
		maxLimit:     100,
		checkLimit:   true,
	})
	require.NoError(t, err)
	assert.Equal(t, 20, limit)

	_, err = checkRankParam(rankCheckParam{
		userID:       0,
		checkUserID:  true,
		startTime:    1000,
		endTime:      2000,
		limit:        10,
		defaultLimit: 10,
		maxLimit:     100,
		checkLimit:   true,
	})
	require.Error(t, err)
	assert.Equal(t, "invalid user id", err.Error())
}

func TestCheckRankParamLimitBounds(t *testing.T) {
	limit, err := checkRankParam(rankCheckParam{
		startTime:    1000,
		endTime:      2000,
		limit:        999,
		defaultLimit: 20,
		maxLimit:     100,
		checkLimit:   true,
	})
	require.NoError(t, err)
	assert.Equal(t, 100, limit)

	limit, err = checkRankParam(rankCheckParam{
		userID:      1,
		checkUserID: true,
		startTime:   1000,
		endTime:     2000,
		checkLimit:  false,
	})
	require.NoError(t, err)
	assert.Equal(t, 0, limit)
}
