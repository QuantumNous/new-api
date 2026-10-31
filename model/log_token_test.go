package model

import (
	"os"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func TestTotalTokensFromUsageIncludesCacheReadAndWrite(t *testing.T) {
	got := totalTokensFromUsage(100, 20, map[string]interface{}{
		"cache_tokens":       30,
		"cache_write_tokens": 40,
	})
	require.Equal(t, 190, got)
}

func TestTotalTokensFromUsageFallsBackToSplitCacheWrites(t *testing.T) {
	got := totalTokensFromUsage(100, 20, map[string]interface{}{
		"cache_tokens":             30,
		"cache_creation_tokens_5m": 40,
		"cache_creation_tokens_1h": 50,
	})
	require.Equal(t, 240, got)
}

// Exercise the actual MySQL JSON functions used by TPM aggregation, rather
// than asserting the SQL string. No application tables are modified.
func TestTotalTokensMySQL(t *testing.T) {
	dsn := os.Getenv("TEST_MYSQL_DSN")
	if dsn == "" {
		t.Skip("TEST_MYSQL_DSN is not configured")
	}
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
	original := common.LogDatabaseType()
	common.SetLogDatabaseType(common.DatabaseTypeMySQL)
	t.Cleanup(func() { common.SetLogDatabaseType(original) })
	var version string
	require.NoError(t, db.Raw("SELECT VERSION()").Scan(&version).Error)
	t.Logf("MySQL version: %s", version)
	cases := []struct {
		name, other string
		want        int
	}{
		{"no_cache", `{}`, 120},
		{"cache_read", `{"cache_tokens":30}`, 150},
		{"cache_write", `{"cache_write_tokens":40}`, 160},
		{"read_and_write", `{"cache_tokens":30,"cache_write_tokens":40}`, 190},
		{"legacy_creation", `{"cache_tokens":30,"cache_creation_tokens":40}`, 190},
		{"split_creation", `{"cache_creation_tokens_5m":40,"cache_creation_tokens_1h":50}`, 210},
		{"only_5m", `{"cache_creation_tokens_5m":40}`, 160},
		{"only_1h", `{"cache_creation_tokens_1h":50}`, 170},
		{"write_precedence", `{"cache_write_tokens":40,"cache_creation_tokens":90,"cache_creation_tokens_5m":40,"cache_creation_tokens_1h":50}`, 160},
		{"creation_precedence", `{"cache_creation_tokens":90,"cache_creation_tokens_5m":40,"cache_creation_tokens_1h":50}`, 210},
		{"explicit_zero_write", `{"cache_write_tokens":0,"cache_creation_tokens":90}`, 120},
		{"numeric_strings", `{"cache_tokens":"30","cache_write_tokens":"40"}`, 190},
		{"empty_metadata", ``, 120},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var got int
			query := "SELECT " + totalTokensSQLExpression() + " FROM (SELECT 100 AS prompt_tokens, 20 AS completion_tokens, ? AS other) AS logs"
			require.NoError(t, db.Raw(query, tc.other).Scan(&got).Error)
			assert.Equal(t, tc.want, got)
			if tc.other != "" {
				var other map[string]interface{}
				require.NoError(t, common.UnmarshalJsonStr(tc.other, &other))
				assert.Equal(t, tc.want, totalTokensFromUsage(100, 20, other), "Go export and MySQL TPM must agree")
			}
		})
	}
	var total int
	query := "SELECT " + totalTokensSQLExpression() + " FROM (SELECT 100 AS prompt_tokens, 20 AS completion_tokens, ? AS other UNION ALL SELECT 200, 30, ?) AS logs"
	require.NoError(t, db.Raw(query, `{"cache_tokens":30}`, `{"cache_creation_tokens":40}`).Scan(&total).Error)
	assert.Equal(t, 420, total)
	require.NoError(t, db.Raw(query+" WHERE 1 = 0", `{}`, `{}`).Scan(&total).Error)
	assert.Zero(t, total, "an empty time window has zero tokens")
}
