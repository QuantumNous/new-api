package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetChannelQuotaReportDataAggregatesByChannelModelAndHour(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Create(&Channel{Id: 1, Name: "east", Status: 1, ResponseTime: 320}).Error)
	require.NoError(t, DB.Create(&Channel{Id: 2, Name: "west", Status: 2, ResponseTime: 0}).Error)

	seedFlowQuotaData(t, QuotaData{
		ChannelID:           1,
		ModelName:           "gpt-a",
		CreatedAt:           1000,
		Count:               2,
		Quota:               100,
		TokenUsed:           40,
		PromptTokens:        25,
		CompletionTokens:    15,
		CacheTokens:         5,
		CacheCreationTokens: 3,
	})
	seedFlowQuotaData(t, QuotaData{
		ChannelID:           1,
		ModelName:           "gpt-a",
		CreatedAt:           1000,
		Count:               1,
		Quota:               50,
		TokenUsed:           20,
		PromptTokens:        12,
		CompletionTokens:    8,
		CacheTokens:         2,
		CacheCreationTokens: 1,
	})
	seedFlowQuotaData(t, QuotaData{
		ChannelID: 1,
		ModelName: "gpt-b",
		CreatedAt: 1000,
		Count:     3,
		Quota:     75,
		TokenUsed: 30,
	})
	seedFlowQuotaData(t, QuotaData{
		ChannelID: 2,
		ModelName: "gpt-a",
		CreatedAt: 1100,
		Count:     4,
		Quota:     80,
		TokenUsed: 35,
	})
	seedFlowQuotaData(t, QuotaData{
		ChannelID: 99,
		ModelName: "orphan",
		CreatedAt: 1200,
		Count:     5,
		Quota:     60,
		TokenUsed: 25,
	})
	seedFlowQuotaData(t, QuotaData{
		ChannelID: 0,
		ModelName: "legacy",
		CreatedAt: 1200,
		Count:     99,
		Quota:     999,
		TokenUsed: 999,
	})

	rows, err := GetChannelQuotaReportData(900, 1300)
	require.NoError(t, err)
	require.Len(t, rows, 4)

	require.Equal(t, ChannelQuotaReportData{
		ChannelID:           1,
		ChannelName:         "east",
		Status:              1,
		ResponseTime:        320,
		ModelName:           "gpt-a",
		CreatedAt:           1000,
		TokenUsed:           60,
		PromptTokens:        37,
		CompletionTokens:    23,
		CacheTokens:         7,
		CacheCreationTokens: 4,
		Count:               3,
		Quota:               150,
	}, *rows[0])
	assert.Equal(t, "gpt-b", rows[1].ModelName)
	assert.Equal(t, 75, rows[1].Quota)
	assert.Equal(t, "west", rows[2].ChannelName)
	assert.Equal(t, 2, rows[2].Status)
	assert.Equal(t, 99, rows[3].ChannelID)
	assert.Equal(t, "channel-99", rows[3].ChannelName)
}
