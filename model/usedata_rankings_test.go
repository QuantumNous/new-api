package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestRankingUsageComesFromConsumeLogs(t *testing.T) {
	logDB, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, logDB.AutoMigrate(&Log{}))

	mainDB, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, mainDB.AutoMigrate(&QuotaData{}))
	require.NoError(t, mainDB.Create(&QuotaData{
		ModelName: "quota-data-only",
		CreatedAt: 3600,
		TokenUsed: 1000,
		Quota:     1000,
	}).Error)

	originalDB := DB
	originalLogDB := LOG_DB
	originalLogDatabaseType := common.LogDatabaseType()
	DB = mainDB
	LOG_DB = logDB
	common.SetLogDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		DB = originalDB
		LOG_DB = originalLogDB
		common.SetLogDatabaseType(originalLogDatabaseType)
	})

	logs := []Log{
		{CreatedAt: 3601, Type: LogTypeConsume, ModelName: "model-a", PromptTokens: 10, CompletionTokens: 5, Quota: 100},
		{CreatedAt: 3700, Type: LogTypeConsume, ModelName: "model-a", PromptTokens: 3, CompletionTokens: 2, Quota: 50},
		{CreatedAt: 7201, Type: LogTypeConsume, ModelName: "model-b", PromptTokens: 20, CompletionTokens: 5, Quota: 300},
		{CreatedAt: 3800, Type: LogTypeRefund, ModelName: "model-a", PromptTokens: 100, CompletionTokens: 100, Quota: 500},
		{CreatedAt: 3900, Type: LogTypeError, ModelName: "model-a", PromptTokens: 100, CompletionTokens: 100, Quota: 500},
		{CreatedAt: 4000, Type: LogTypeConsume, ModelName: "", PromptTokens: 100, CompletionTokens: 100, Quota: 500},
		{CreatedAt: 4100, Type: LogTypeConsume, ModelName: "quota-only", Quota: 500},
		{CreatedAt: 3599, Type: LogTypeConsume, ModelName: "before-range", PromptTokens: 100, Quota: 500},
		{CreatedAt: 10801, Type: LogTypeConsume, ModelName: "after-range", PromptTokens: 100, Quota: 500},
	}
	require.NoError(t, logDB.Create(&logs).Error)

	totals, err := GetRankingQuotaTotals(3600, 10800)
	require.NoError(t, err)
	require.Equal(t, []RankingQuotaTotal{
		{ModelName: "model-b", TotalTokens: 25, TotalQuota: 300},
		{ModelName: "model-a", TotalTokens: 20, TotalQuota: 150},
	}, totals)

	buckets, err := GetRankingQuotaBuckets(3600, 10800, 3600)
	require.NoError(t, err)
	assert.Equal(t, []RankingQuotaBucket{
		{ModelName: "model-a", Bucket: 3600, Tokens: 20},
		{ModelName: "model-b", Bucket: 7200, Tokens: 25},
	}, buckets)
}

func TestRankingBucketExpressionUsesLogDatabaseDialect(t *testing.T) {
	originalLogDatabaseType := common.LogDatabaseType()
	t.Cleanup(func() {
		common.SetLogDatabaseType(originalLogDatabaseType)
	})

	tests := []struct {
		name         string
		databaseType common.DatabaseType
		want         string
	}{
		{name: "SQLite", databaseType: common.DatabaseTypeSQLite, want: "(created_at / 3600) * 3600"},
		{name: "MySQL", databaseType: common.DatabaseTypeMySQL, want: "FLOOR(created_at / 3600) * 3600"},
		{name: "PostgreSQL", databaseType: common.DatabaseTypePostgreSQL, want: "(created_at / 3600) * 3600"},
		{name: "ClickHouse", databaseType: common.DatabaseTypeClickHouse, want: "intDiv(created_at, 3600) * 3600"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			common.SetLogDatabaseType(test.databaseType)
			assert.Equal(t, test.want, rankingBucketExpr(3600))
		})
	}
}
