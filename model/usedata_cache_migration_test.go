package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// TestQuotaDataMigrationAddsCacheColumnsToLegacyTable guards the real upgrade
// path: a running deployment already has a quota_data table without the cache
// counters, so AutoMigrate must add them without disturbing existing rows.
// The rest of the suite runs against an already-migrated schema, so this test
// first reverts the table to its pre-upgrade shape by dropping the two columns.
func TestQuotaDataMigrationAddsCacheColumnsToLegacyTable(t *testing.T) {
	truncateTables(t)

	// Restore the migrated schema for the remaining tests in the package.
	t.Cleanup(func() {
		require.NoError(t, DB.AutoMigrate(&QuotaData{}))
	})

	require.NoError(t, DB.Migrator().DropColumn(&QuotaData{}, "cache_read_tokens"))
	require.NoError(t, DB.Migrator().DropColumn(&QuotaData{}, "input_tokens_total"))
	require.False(t, DB.Migrator().HasColumn(&QuotaData{}, "cache_read_tokens"))
	require.False(t, DB.Migrator().HasColumn(&QuotaData{}, "input_tokens_total"))

	// A row written before the upgrade. Raw SQL is required here because the
	// struct now carries columns the legacy table does not have yet.
	require.NoError(t, DB.Exec(
		"INSERT INTO quota_data (user_id, username, model_name, created_at, use_group, token_id, channel_id, node_name, token_used, count, quota) VALUES (?, ?, ?, ?, '', 0, 0, '', ?, ?, ?)",
		5, "legacy-user", "claude-sonnet", 1_700_000_000, 500, 4, 120,
	).Error)

	// The migration under test.
	require.NoError(t, DB.AutoMigrate(&QuotaData{}))

	require.True(t, DB.Migrator().HasColumn(&QuotaData{}, "cache_read_tokens"))
	require.True(t, DB.Migrator().HasColumn(&QuotaData{}, "input_tokens_total"))

	rows, err := GetQuotaDataByUserId(5, 1_699_999_999, 1_700_000_100, "", "")
	require.NoError(t, err)
	require.Len(t, rows, 1)

	// Pre-existing values must survive, and the new columns must read as zero so
	// the dashboard treats the window as "no cache sample" rather than "0% hit".
	require.Equal(t, 500, rows[0].TokenUsed)
	require.Equal(t, 4, rows[0].Count)
	require.Equal(t, 0, rows[0].CacheReadTokens)
	require.Equal(t, 0, rows[0].InputTokensTotal)
}
