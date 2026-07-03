package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestQuotaDataAggregatesSupportInt64Totals(t *testing.T) {
	truncateTables(t)

	require.NoError(t, DB.Create(&QuotaData{
		UserID:    1,
		Username:  "alice",
		ModelName: "gpt-a",
		CreatedAt: 1000,
		Count:     1400000000,
		Quota:     1500000000,
		TokenUsed: 1200000000,
	}).Error)
	require.NoError(t, DB.Create(&QuotaData{
		UserID:    2,
		Username:  "bob",
		ModelName: "gpt-a",
		CreatedAt: 1000,
		Count:     900000000,
		Quota:     1400000000,
		TokenUsed: 1100000000,
	}).Error)

	rows, err := GetAllQuotaDates(900, 2000, "")
	require.NoError(t, err)
	require.Len(t, rows, 1)
	require.Equal(t, int64(2300000000), rows[0].Count)
	require.Equal(t, int64(2900000000), rows[0].Quota)
	require.Equal(t, int64(2300000000), rows[0].TokenUsed)
}

func TestFlowQuotaDataAggregatesSupportInt64Totals(t *testing.T) {
	truncateTables(t)

	require.NoError(t, DB.Create(&QuotaData{
		UserID:    1,
		Username:  "alice",
		ModelName: "gpt-a",
		CreatedAt: 1000,
		UseGroup:  "vip",
		Count:     1500000000,
		Quota:     1500000000,
		TokenUsed: 1000000000,
	}).Error)
	require.NoError(t, DB.Create(&QuotaData{
		UserID:    1,
		Username:  "alice",
		ModelName: "gpt-a",
		CreatedAt: 1100,
		UseGroup:  "vip",
		Count:     900000000,
		Quota:     1400000000,
		TokenUsed: 1300000000,
	}).Error)

	rows, err := GetFlowQuotaData(900, 2000, "", 1, common.RoleCommonUser)
	require.NoError(t, err)
	require.Len(t, rows, 1)
	require.Equal(t, int64(2400000000), rows[0].Count)
	require.Equal(t, int64(2900000000), rows[0].Quota)
	require.Equal(t, int64(2300000000), rows[0].TokenUsed)
}

func TestLogStatAggregatesSupportInt64Totals(t *testing.T) {
	truncateTables(t)

	now := time.Now().Unix()
	logs := []*Log{
		{
			UserId:           1,
			Username:         "alice",
			CreatedAt:        now - 10,
			Type:             LogTypeConsume,
			ModelName:        "gpt-a",
			TokenName:        "token-a",
			Quota:            1500000000,
			PromptTokens:     700000000,
			CompletionTokens: 600000000,
			ChannelId:        7,
			Group:            "vip",
		},
		{
			UserId:           1,
			Username:         "alice",
			CreatedAt:        now - 5,
			Type:             LogTypeConsume,
			ModelName:        "gpt-a",
			TokenName:        "token-a",
			Quota:            1400000000,
			PromptTokens:     800000000,
			CompletionTokens: 500000000,
			ChannelId:        7,
			Group:            "vip",
		},
	}
	require.NoError(t, LOG_DB.Create(logs).Error)

	stat, err := SumUsedQuota(LogTypeConsume, now-60, now+1, "gpt-a", "alice", "token-a", 7, "vip")
	require.NoError(t, err)
	require.Equal(t, int64(2900000000), stat.Quota)
	require.Equal(t, int64(2), stat.Rpm)
	require.Equal(t, int64(2600000000), stat.Tpm)

	tokenTotal := SumUsedToken(LogTypeConsume, now-60, now+1, "gpt-a", "alice", "token-a")
	require.Equal(t, int64(2600000000), tokenTotal)
}
