package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func setupUsedataTestDB(t *testing.T) {
	t.Helper()
	truncateTables(t)
	require.NoError(t, DB.Create(&Token{Id: 11, UserId: 1, Key: "sk-primary", Name: "primary"}).Error)
	require.NoError(t, DB.Create(&Token{Id: 22, UserId: 2, Key: "sk-backup", Name: "backup"}).Error)
	require.NoError(t, DB.Create(&QuotaData{
		UserID:    1,
		Username:  "alice",
		TokenID:   11,
		ModelName: "gpt-a",
		CreatedAt: 1100,
		Count:     2,
		Quota:     100,
		TokenUsed: 40,
	}).Error)
	require.NoError(t, DB.Create(&QuotaData{
		UserID:    2,
		Username:  "bob",
		TokenID:   22,
		ModelName: "gpt-b",
		CreatedAt: 1200,
		Count:     1,
		Quota:     70,
		TokenUsed: 30,
	}).Error)
}

func TestGetAllQuotaDatesByTokenID(t *testing.T) {
	setupUsedataTestDB(t)

	rows, err := GetAllQuotaDates(1000, 2000, "", 11)
	require.NoError(t, err)
	require.Len(t, rows, 1)
	require.Equal(t, "gpt-a", rows[0].ModelName)
	require.Equal(t, 2, rows[0].Count)

	rows, err = GetAllQuotaDates(1000, 2000, "", 0)
	require.NoError(t, err)
	require.Len(t, rows, 2)
}

func TestGetQuotaDataByUserIdWithTokenID(t *testing.T) {
	setupUsedataTestDB(t)

	rows, err := GetQuotaDataByUserId(1, 1000, 2000, 11)
	require.NoError(t, err)
	require.Len(t, rows, 1)
	require.Equal(t, "alice", rows[0].Username)
	require.Equal(t, "gpt-a", rows[0].ModelName)

	rows, err = GetQuotaDataByUserId(1, 1000, 2000, 22)
	require.NoError(t, err)
	require.Empty(t, rows)
}

func TestGetQuotaDataByUsernameWithTokenID(t *testing.T) {
	setupUsedataTestDB(t)

	rows, err := GetQuotaDataByUsername("alice", 1000, 2000, 11)
	require.NoError(t, err)
	require.Len(t, rows, 1)
	require.Equal(t, "gpt-a", rows[0].ModelName)

	rows, err = GetQuotaDataByUsername("alice", 1000, 2000, 22)
	require.NoError(t, err)
	require.Empty(t, rows)
}
