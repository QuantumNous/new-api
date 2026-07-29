package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetLogUsageSummaryFiltersAndGroupsConsumption(t *testing.T) {
	truncateTables(t)
	initCol()

	logs := []Log{
		{UserId: 1, Username: "wanxin1", CreatedAt: 100, Type: LogTypeConsume, ModelName: "gpt-image-2", TokenName: "image-token", Quota: 500000, PromptTokens: 10, CompletionTokens: 20, ChannelId: 44, Group: "image&2", RequestId: "req-1"},
		{UserId: 1, Username: "wanxin1", CreatedAt: 110, Type: LogTypeConsume, ModelName: "gpt-image-2", TokenName: "image-token", Quota: 250000, PromptTokens: 5, CompletionTokens: 8, ChannelId: 44, Group: "image&2", RequestId: "req-2"},
		{UserId: 1, Username: "wanxin1", CreatedAt: 120, Type: LogTypeConsume, ModelName: "gemini-image", TokenName: "image-token", Quota: 100000, ChannelId: 35, Group: "image&2", RequestId: "req-3"},
		{UserId: 1, Username: "wanxin1", CreatedAt: 130, Type: LogTypeError, ModelName: "gpt-image-2", TokenName: "image-token", Quota: 999999, ChannelId: 44, Group: "image&2"},
		{UserId: 2, Username: "other-user", CreatedAt: 110, Type: LogTypeConsume, ModelName: "gpt-image-2", TokenName: "image-token", Quota: 900000, ChannelId: 44, Group: "image&2"},
	}
	require.NoError(t, LOG_DB.Create(&logs).Error)

	summary, err := GetLogUsageSummary(LogUsageSummaryFilter{
		Username:       "wanxin1",
		TokenName:      "image-token",
		StartTimestamp: 90,
		EndTimestamp:   125,
		Group:          "image&2",
	})
	require.NoError(t, err)
	require.Len(t, summary, 2)

	assert.Equal(t, "gpt-image-2", summary[0].ModelName)
	assert.EqualValues(t, 2, summary[0].RequestCount)
	assert.EqualValues(t, 15, summary[0].PromptTokens)
	assert.EqualValues(t, 28, summary[0].CompletionTokens)
	assert.EqualValues(t, 750000, summary[0].Quota)
	assert.Equal(t, "gemini-image", summary[1].ModelName)
	assert.EqualValues(t, 100000, summary[1].Quota)
}

func TestGetLogUsageSummaryRestrictsSelfByUserId(t *testing.T) {
	truncateTables(t)
	initCol()

	logs := []Log{
		{UserId: 1, Username: "same-name", CreatedAt: 100, Type: LogTypeConsume, ModelName: "model-a", Quota: 10},
		{UserId: 2, Username: "same-name", CreatedAt: 100, Type: LogTypeConsume, ModelName: "model-b", Quota: 20},
	}
	require.NoError(t, LOG_DB.Create(&logs).Error)

	summary, err := GetLogUsageSummary(LogUsageSummaryFilter{
		UserId:         1,
		StartTimestamp: 90,
		EndTimestamp:   110,
	})
	require.NoError(t, err)
	require.Len(t, summary, 1)
	assert.Equal(t, "model-a", summary[0].ModelName)
	assert.EqualValues(t, 10, summary[0].Quota)
}
