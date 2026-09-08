package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupUsageRankingTestDB(t *testing.T) {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&Log{}))
	require.NoError(t, db.Exec("CREATE TABLE channels (id INTEGER PRIMARY KEY, name TEXT NOT NULL)").Error)

	originalDB := DB
	originalLogDB := LOG_DB
	originalMainType := common.MainDatabaseType()
	originalLogType := common.LogDatabaseType()
	DB = db
	LOG_DB = db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	initCol()

	t.Cleanup(func() {
		DB = originalDB
		LOG_DB = originalLogDB
		common.SetDatabaseTypes(originalMainType, originalLogType)
		initCol()
		require.NoError(t, sqlDB.Close())
	})
}

func insertUsageRankingLogs(t *testing.T, logs ...Log) {
	t.Helper()
	require.NoError(t, LOG_DB.Create(&logs).Error)
}

func seedUsageRankingLogs(t *testing.T) {
	t.Helper()
	insertUsageRankingLogs(t,
		Log{UserId: 10, Username: "alice", CreatedAt: 120, Type: LogTypeConsume, Quota: 120, PromptTokens: 100, CompletionTokens: 20, UseTime: 10, IsStream: true, ModelName: "gpt-4o", TokenId: 1, Group: "vip", ChannelId: 1},
		Log{UserId: 10, Username: "alice", CreatedAt: 150, Type: LogTypeConsume, Quota: 80, PromptTokens: 50, CompletionTokens: 30, UseTime: 20, ModelName: "claude", TokenId: 2, Group: "default", ChannelId: 2},
		Log{UserId: 10, Username: "alice", CreatedAt: 160, Type: LogTypeError, ModelName: "gpt-4o", Group: "vip", ChannelId: 1},
		Log{UserId: 20, Username: "bob", CreatedAt: 140, Type: LogTypeConsume, Quota: 100, PromptTokens: 20, CompletionTokens: 10, UseTime: 30, ModelName: "gpt-4o", TokenId: 3, Group: "default", ChannelId: 1},
		Log{UserId: 20, Username: "bob", CreatedAt: 170, Type: LogTypeConsume, Quota: 30, PromptTokens: 10, CompletionTokens: 5, UseTime: 10, IsStream: true, ModelName: "gpt-4o", TokenId: 3, Group: "default", ChannelId: 1},
		Log{UserId: 30, Username: "carol", CreatedAt: 130, Type: LogTypeConsume, Quota: 10, PromptTokens: 1, CompletionTokens: 1, UseTime: 1, ModelName: "small", TokenId: 4, Group: "free", ChannelId: 3},
		Log{UserId: 30, Username: "carol", CreatedAt: 131, Type: LogTypeConsume, Quota: 10, PromptTokens: 1, CompletionTokens: 1, UseTime: 2, ModelName: "small", TokenId: 4, Group: "free", ChannelId: 3},
		Log{UserId: 30, Username: "carol", CreatedAt: 132, Type: LogTypeConsume, Quota: 10, PromptTokens: 1, CompletionTokens: 1, UseTime: 3, ModelName: "small", TokenId: 4, Group: "free", ChannelId: 3},
		Log{UserId: 99, Username: "outside", CreatedAt: 500, Type: LogTypeConsume, Quota: 9999, PromptTokens: 99, CompletionTokens: 99, ModelName: "gpt-4o", Group: "vip", ChannelId: 1},
	)
}

func TestGetUsageRankingAggregatesAndPaginates(t *testing.T) {
	setupUsageRankingTestDB(t)
	seedUsageRankingLogs(t)

	result, err := GetUsageRanking(UsageRankingQuery{
		StartTimestamp: 100,
		EndTimestamp:   200,
		SortBy:         UsageRankingSortQuota,
		Page:           1,
		PageSize:       2,
	})

	require.NoError(t, err)
	assert.Equal(t, int64(3), result.Total)
	assert.Equal(t, UsageRankingSummary{
		Quota:            360,
		RequestCount:     7,
		PromptTokens:     183,
		CompletionTokens: 68,
		TotalTokens:      251,
		ActiveUserCount:  3,
	}, result.Summary)
	require.Len(t, result.Items, 2)

	alice := result.Items[0]
	assert.Equal(t, 1, alice.Rank)
	assert.Equal(t, 10, alice.UserID)
	assert.Equal(t, "alice", alice.Username)
	assert.Equal(t, int64(200), alice.Quota)
	assert.Equal(t, int64(2), alice.RequestCount)
	assert.Equal(t, int64(150), alice.PromptTokens)
	assert.Equal(t, int64(50), alice.CompletionTokens)
	assert.Equal(t, int64(200), alice.TotalTokens)
	assert.InDelta(t, 15.0, alice.AverageUseTime, 0.0001)
	assert.Equal(t, int64(1), alice.StreamCount)
	assert.InDelta(t, 0.5, alice.StreamRatio, 0.0001)
	assert.Equal(t, int64(1), alice.ErrorCount)
	assert.InDelta(t, 1.0/3.0, alice.ErrorRate, 0.0001)
	assert.Equal(t, int64(2), alice.ModelCount)
	assert.Equal(t, int64(2), alice.TokenCount)
	assert.Equal(t, int64(2), alice.GroupCount)
	assert.Equal(t, int64(2), alice.ChannelCount)
	assert.Equal(t, int64(150), alice.LastUsedAt)

	require.Len(t, alice.GroupStats, 2)
	assert.Equal(t, "vip", alice.GroupStats[0].Group)
	assert.Equal(t, int64(120), alice.GroupStats[0].Quota)
	assert.Equal(t, int64(1), alice.GroupStats[0].ErrorCount)
	assert.InDelta(t, 0.5, alice.GroupStats[0].ErrorRate, 0.0001)
	assert.Equal(t, "default", alice.GroupStats[1].Group)
	assert.Equal(t, int64(80), alice.GroupStats[1].Quota)
	assert.Equal(t, int64(0), alice.GroupStats[1].ErrorCount)
}

func TestGetUsageRankingIncludesModelAndChannelBreakdowns(t *testing.T) {
	setupUsageRankingTestDB(t)
	require.NoError(t, DB.Exec("INSERT INTO channels (id, name) VALUES (?, ?), (?, ?)", 1, "east", 2, "west").Error)
	insertUsageRankingLogs(t,
		Log{UserId: 10, Username: "alice", CreatedAt: 120, Type: LogTypeConsume, Quota: 60, PromptTokens: 8, CompletionTokens: 2, ModelName: "model-a", Group: "vip", ChannelId: 1},
		Log{UserId: 10, Username: "alice", CreatedAt: 130, Type: LogTypeConsume, Quota: 20, PromptTokens: 4, CompletionTokens: 1, ModelName: "model-a", Group: "vip", ChannelId: 2},
		Log{UserId: 10, Username: "alice", CreatedAt: 140, Type: LogTypeConsume, Quota: 20, PromptTokens: 10, CompletionTokens: 5, ModelName: "model-b", Group: "vip", ChannelId: 2},
	)

	result, err := GetUsageRanking(UsageRankingQuery{StartTimestamp: 100, EndTimestamp: 200})

	require.NoError(t, err)
	require.Len(t, result.Items, 1)
	require.Len(t, result.Items[0].GroupStats, 1)
	group := result.Items[0].GroupStats[0]
	require.Len(t, group.ModelStats, 2)
	assert.Equal(t, "model-a", group.ModelStats[0].ModelName)
	assert.Equal(t, int64(80), group.ModelStats[0].Quota)
	assert.Equal(t, int64(2), group.ModelStats[0].RequestCount)
	assert.Equal(t, int64(15), group.ModelStats[0].TotalTokens)
	assert.InDelta(t, 0.8, group.ModelStats[0].QuotaRatio, 0.0001)
	assert.Equal(t, "model-b", group.ModelStats[1].ModelName)
	assert.InDelta(t, 0.2, group.ModelStats[1].QuotaRatio, 0.0001)

	require.Len(t, group.ChannelStats, 2)
	assert.Equal(t, 1, group.ChannelStats[0].ChannelID)
	assert.Equal(t, "east", group.ChannelStats[0].ChannelName)
	assert.Equal(t, int64(60), group.ChannelStats[0].Quota)
	assert.InDelta(t, 0.6, group.ChannelStats[0].QuotaRatio, 0.0001)
	assert.Equal(t, 2, group.ChannelStats[1].ChannelID)
	assert.Equal(t, "west", group.ChannelStats[1].ChannelName)
	assert.Equal(t, int64(40), group.ChannelStats[1].Quota)
	assert.Equal(t, int64(2), group.ChannelStats[1].RequestCount)
	assert.Equal(t, int64(20), group.ChannelStats[1].TotalTokens)
	assert.InDelta(t, 0.4, group.ChannelStats[1].QuotaRatio, 0.0001)
}

func TestGetUsageRankingSortsByRequestsAndAssignsGlobalRank(t *testing.T) {
	setupUsageRankingTestDB(t)
	seedUsageRankingLogs(t)

	firstPage, err := GetUsageRanking(UsageRankingQuery{
		StartTimestamp: 100,
		EndTimestamp:   200,
		SortBy:         UsageRankingSortRequestCount,
		Page:           1,
		PageSize:       2,
	})
	require.NoError(t, err)
	require.Len(t, firstPage.Items, 2)
	assert.Equal(t, "carol", firstPage.Items[0].Username)
	assert.Equal(t, "alice", firstPage.Items[1].Username)

	secondPage, err := GetUsageRanking(UsageRankingQuery{
		StartTimestamp: 100,
		EndTimestamp:   200,
		SortBy:         UsageRankingSortRequestCount,
		Page:           2,
		PageSize:       2,
	})
	require.NoError(t, err)
	require.Len(t, secondPage.Items, 1)
	assert.Equal(t, 3, secondPage.Items[0].Rank)
	assert.Equal(t, "bob", secondPage.Items[0].Username)
	assert.NotNil(t, secondPage.Items[0].GroupStats)
}

func TestGetUsageRankingAppliesSharedFiltersToConsumeAndErrors(t *testing.T) {
	setupUsageRankingTestDB(t)
	seedUsageRankingLogs(t)

	result, err := GetUsageRanking(UsageRankingQuery{
		StartTimestamp: 100,
		EndTimestamp:   200,
		ModelName:      "gpt-4o",
		ChannelID:      1,
		Group:          "vip",
		Page:           1,
		PageSize:       20,
	})

	require.NoError(t, err)
	assert.Equal(t, int64(1), result.Total)
	require.Len(t, result.Items, 1)
	assert.Equal(t, "alice", result.Items[0].Username)
	assert.Equal(t, int64(1), result.Items[0].RequestCount)
	assert.Equal(t, int64(1), result.Items[0].ErrorCount)
	assert.InDelta(t, 0.5, result.Items[0].ErrorRate, 0.0001)
}

func TestGetUsageRankingKeepsUsernameSnapshotsSeparate(t *testing.T) {
	setupUsageRankingTestDB(t)
	insertUsageRankingLogs(t,
		Log{UserId: 1, Username: "before", CreatedAt: 100, Type: LogTypeConsume, Quota: 10, Group: "default"},
		Log{UserId: 1, Username: "after", CreatedAt: 101, Type: LogTypeConsume, Quota: 20, Group: "default"},
		Log{UserId: 1, Username: "after", CreatedAt: 102, Type: LogTypeError, Group: "default"},
	)

	result, err := GetUsageRanking(UsageRankingQuery{StartTimestamp: 1, EndTimestamp: 200})

	require.NoError(t, err)
	assert.Equal(t, int64(2), result.Total)
	require.Len(t, result.Items, 2)
	assert.Equal(t, "after", result.Items[0].Username)
	assert.Equal(t, int64(1), result.Items[0].ErrorCount)
	assert.Equal(t, "before", result.Items[1].Username)
	assert.Zero(t, result.Items[1].ErrorCount)
}

func TestGetUsageRankingReturnsNonNilEmptyItems(t *testing.T) {
	setupUsageRankingTestDB(t)

	result, err := GetUsageRanking(UsageRankingQuery{StartTimestamp: 1, EndTimestamp: 200})

	require.NoError(t, err)
	assert.Equal(t, int64(0), result.Total)
	assert.NotNil(t, result.Items)
	assert.Empty(t, result.Items)
	assert.Equal(t, UsageRankingSummary{}, result.Summary)
}

func TestGetUsageRankingNormalizesHugePageSafely(t *testing.T) {
	setupUsageRankingTestDB(t)
	seedUsageRankingLogs(t)

	result, err := GetUsageRanking(UsageRankingQuery{StartTimestamp: 100, EndTimestamp: 200, Page: int(^uint(0) >> 1), PageSize: 100})
	require.NoError(t, err)
	assert.Empty(t, result.Items)
}
