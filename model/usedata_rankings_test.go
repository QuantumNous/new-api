package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestRankingUsageComesFromQuotaData(t *testing.T) {
	mainDB, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, mainDB.AutoMigrate(&QuotaData{}))

	logDB, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, logDB.AutoMigrate(&Log{}))
	// Ranking must not read the raw logs table; a row that exists only there
	// has to stay out of the leaderboard.
	require.NoError(t, logDB.Create(&Log{
		CreatedAt: 3601, Type: LogTypeConsume, ModelName: "logs-only",
		PromptTokens: 1000, CompletionTokens: 1000, Quota: 1000,
	}).Error)

	originalDB := DB
	originalLogDB := LOG_DB
	originalMainDatabaseType := common.MainDatabaseType()
	DB = mainDB
	LOG_DB = logDB
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		DB = originalDB
		LOG_DB = originalLogDB
		common.SetMainDatabaseType(originalMainDatabaseType)
	})

	rows := []QuotaData{
		{ModelName: "model-a", CreatedAt: 3600, TokenUsed: 15, Quota: 100, Count: 1},
		{ModelName: "model-a", CreatedAt: 3600, TokenUsed: 5, Quota: 50, Count: 1, Username: "second-row"},
		{ModelName: "model-b", CreatedAt: 7200, TokenUsed: 25, Quota: 300, Count: 1},
		// Per-request billing bills quota without reporting tokens.
		{ModelName: "quota-only", CreatedAt: 3600, TokenUsed: 0, Quota: 500, Count: 1},
		{ModelName: "", CreatedAt: 3600, TokenUsed: 100, Quota: 100, Count: 1},
		{ModelName: "empty-usage", CreatedAt: 3600, TokenUsed: 0, Quota: 0, Count: 1},
		{ModelName: "before-range", CreatedAt: 0, TokenUsed: 100, Quota: 100, Count: 1},
		{ModelName: "after-range", CreatedAt: 14400, TokenUsed: 100, Quota: 100, Count: 1},
	}
	require.NoError(t, mainDB.Create(&rows).Error)

	totals, err := GetRankingQuotaTotals(3600, 10800)
	require.NoError(t, err)
	require.Equal(t, []RankingQuotaTotal{
		{ModelName: "model-b", TotalTokens: 25, TotalQuota: 300},
		{ModelName: "model-a", TotalTokens: 20, TotalQuota: 150},
		{ModelName: "quota-only", TotalTokens: 0, TotalQuota: 500},
	}, totals)

	buckets, err := GetRankingQuotaBuckets(3600, 10800, 3600)
	require.NoError(t, err)
	assert.Equal(t, []RankingQuotaBucket{
		{ModelName: "model-a", Bucket: 3600, Tokens: 20},
		{ModelName: "model-b", Bucket: 7200, Tokens: 25},
	}, buckets)
}

func TestRankingBucketExpressionUsesMainDatabaseDialect(t *testing.T) {
	originalMainDatabaseType := common.MainDatabaseType()
	t.Cleanup(func() {
		common.SetMainDatabaseType(originalMainDatabaseType)
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
			common.SetMainDatabaseType(test.databaseType)
			assert.Equal(t, test.want, rankingBucketExpr(3600))
		})
	}
}

// A leaderboard entry that only ever charged quota still needs a share and a
// visible rank, so token-share math must not divide it away.
func TestRankingQuotaOnlyModelKeepsRank(t *testing.T) {
	mainDB, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, mainDB.AutoMigrate(&QuotaData{}))

	originalDB := DB
	originalMainDatabaseType := common.MainDatabaseType()
	DB = mainDB
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		DB = originalDB
		common.SetMainDatabaseType(originalMainDatabaseType)
	})

	require.NoError(t, mainDB.Create(&[]QuotaData{
		{ModelName: "midjourney", CreatedAt: 3600, TokenUsed: 0, Quota: 900, Count: 3},
	}).Error)

	totals, err := GetRankingQuotaTotals(3600, 10800)
	require.NoError(t, err)
	require.Len(t, totals, 1)
	assert.Equal(t, "midjourney", totals[0].ModelName)
	assert.Zero(t, totals[0].TotalTokens)
	assert.Equal(t, int64(900), totals[0].TotalQuota)
}
