package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func seedFlowLog(t *testing.T, log Log) {
	t.Helper()
	require.NoError(t, LOG_DB.Create(&log).Error)
}

func TestGetFlowQuotaDataAggregatesConsumeLogsByUserTokenAndChannel(t *testing.T) {
	truncateTables(t)

	require.NoError(t, DB.Create(&Channel{Id: 1, Name: "east"}).Error)
	require.NoError(t, DB.Create(&Channel{Id: 2, Name: "west"}).Error)

	seedFlowLog(t, Log{
		UserId:           1,
		Username:         "alice",
		CreatedAt:        1100,
		Type:             LogTypeConsume,
		TokenId:          11,
		TokenName:        "primary",
		ChannelId:        1,
		ModelName:        "gpt-a",
		Group:            "default",
		Quota:            100,
		PromptTokens:     7,
		CompletionTokens: 3,
	})
	seedFlowLog(t, Log{
		UserId:           1,
		Username:         "alice",
		CreatedAt:        1200,
		Type:             LogTypeConsume,
		TokenId:          11,
		TokenName:        "primary",
		ChannelId:        1,
		ModelName:        "gpt-a",
		Group:            "default",
		Quota:            50,
		PromptTokens:     5,
		CompletionTokens: 1,
	})
	seedFlowLog(t, Log{
		UserId:           1,
		Username:         "alice",
		CreatedAt:        1300,
		Type:             LogTypeConsume,
		TokenId:          11,
		TokenName:        "primary",
		ChannelId:        2,
		ModelName:        "gpt-a",
		Group:            "default",
		Quota:            25,
		PromptTokens:     2,
		CompletionTokens: 2,
	})
	seedFlowLog(t, Log{
		UserId:           2,
		Username:         "bob",
		CreatedAt:        1400,
		Type:             LogTypeConsume,
		TokenId:          22,
		TokenName:        "backup",
		ChannelId:        1,
		ModelName:        "gpt-b",
		Group:            "vip",
		Quota:            70,
		PromptTokens:     4,
		CompletionTokens: 6,
	})
	seedFlowLog(t, Log{
		UserId:    1,
		Username:  "alice",
		CreatedAt: 1500,
		Type:      LogTypeError,
		TokenId:   11,
		TokenName: "primary",
		ChannelId: 1,
		Quota:     999,
	})
	seedFlowLog(t, Log{
		UserId:    1,
		Username:  "alice",
		CreatedAt: 900,
		Type:      LogTypeConsume,
		TokenId:   33,
		TokenName: "outside",
		ChannelId: 2,
		Quota:     500,
	})

	rows, err := GetFlowQuotaData(1000, 2000, "", 0)
	require.NoError(t, err)
	require.Len(t, rows, 3)

	require.Equal(t, FlowQuotaData{
		UserID:           1,
		Username:         "alice",
		UserGroup:        "default",
		TokenID:          11,
		TokenName:        "primary",
		ChannelID:        1,
		ChannelName:      "east",
		ModelName:        "gpt-a",
		Count:            2,
		Quota:            150,
		PromptTokens:     12,
		InputTokens:      12,
		CompletionTokens: 4,
		TokenUsed:        16,
	}, *rows[0])
	require.Equal(t, "bob", rows[1].Username)
	require.Equal(t, "backup", rows[1].TokenName)
	require.Equal(t, "east", rows[1].ChannelName)
	require.Equal(t, 10, rows[1].TokenUsed)
	require.Equal(t, "west", rows[2].ChannelName)
	require.Equal(t, 25, rows[2].Quota)
}

func TestGetFlowQuotaDataFiltersByUsernameAndSelfUserID(t *testing.T) {
	truncateTables(t)

	require.NoError(t, DB.Create(&Channel{Id: 1, Name: "east"}).Error)
	seedFlowLog(t, Log{
		UserId:    1,
		Username:  "alice",
		CreatedAt: 1100,
		Type:      LogTypeConsume,
		TokenId:   11,
		TokenName: "primary",
		ChannelId: 1,
		Group:     "default",
		Quota:     100,
	})
	seedFlowLog(t, Log{
		UserId:    2,
		Username:  "bob",
		CreatedAt: 1200,
		Type:      LogTypeConsume,
		TokenId:   22,
		TokenName: "backup",
		ChannelId: 1,
		Group:     "vip",
		Quota:     70,
	})

	adminRows, err := GetFlowQuotaData(1000, 2000, "bob", 0)
	require.NoError(t, err)
	require.Len(t, adminRows, 1)
	require.Equal(t, "bob", adminRows[0].Username)

	selfRows, err := GetFlowQuotaData(1000, 2000, "", 1)
	require.NoError(t, err)
	require.Len(t, selfRows, 1)
	require.Equal(t, "alice", selfRows[0].Username)
}

func TestGetFlowQuotaDataAggregatesCacheTokensAndNonCacheInput(t *testing.T) {
	truncateTables(t)

	require.NoError(t, DB.Create(&Channel{Id: 1, Name: "east"}).Error)

	seedFlowLog(t, Log{
		UserId:           1,
		Username:         "alice",
		CreatedAt:        1100,
		Type:             LogTypeConsume,
		TokenId:          11,
		TokenName:        "primary",
		ChannelId:        1,
		ModelName:        "gpt-a",
		Group:            "default",
		Quota:            100,
		PromptTokens:     100,
		CompletionTokens: 10,
		Other: common.MapToJsonStr(map[string]interface{}{
			"cache_tokens":       20,
			"cache_write_tokens": 5,
		}),
	})
	seedFlowLog(t, Log{
		UserId:           1,
		Username:         "alice",
		CreatedAt:        1200,
		Type:             LogTypeConsume,
		TokenId:          11,
		TokenName:        "primary",
		ChannelId:        1,
		ModelName:        "gpt-a",
		Group:            "default",
		Quota:            50,
		PromptTokens:     70,
		CompletionTokens: 8,
		Other: common.MapToJsonStr(map[string]interface{}{
			"cache_tokens":       30,
			"cache_write_tokens": 4,
			"usage_semantic":     "anthropic",
		}),
	})

	rows, err := GetFlowQuotaData(1000, 2000, "", 0)
	require.NoError(t, err)
	require.Len(t, rows, 1)

	require.Equal(t, 170, rows[0].PromptTokens)
	require.Equal(t, 145, rows[0].InputTokens)
	require.Equal(t, 18, rows[0].CompletionTokens)
	require.Equal(t, 50, rows[0].CacheTokens)
	require.Equal(t, 9, rows[0].CacheWriteTokens)
	require.Equal(t, 163, rows[0].TokenUsed)
}
