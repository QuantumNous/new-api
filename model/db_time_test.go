package model

import (
	"context"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestDBTimestampQueryUsesStatementTimeForPostgreSQL(t *testing.T) {
	originalPostgreSQL := common.UsingPostgreSQL
	originalSQLite := common.UsingSQLite
	originalMySQL := common.UsingMySQL
	t.Cleanup(func() {
		common.UsingPostgreSQL = originalPostgreSQL
		common.UsingSQLite = originalSQLite
		common.UsingMySQL = originalMySQL
	})
	common.UsingPostgreSQL = true
	common.UsingSQLite = false
	common.UsingMySQL = false

	query := dbTimestampQuery()

	require.Equal(t, "SELECT FLOOR(EXTRACT(EPOCH FROM clock_timestamp()))::bigint", query)
	require.NotContains(t, query, "NOW()")
}

func TestDBTimestampMillisQueryForDialectUsesMillisecondPrecision(t *testing.T) {
	tests := []struct {
		name      string
		dialect   string
		wantQuery string
	}{
		{
			name:      "postgres",
			dialect:   "postgres",
			wantQuery: "SELECT FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint",
		},
		{
			name:      "sqlite",
			dialect:   "sqlite",
			wantQuery: "SELECT CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)",
		},
		{
			name:      "mysql",
			dialect:   "mysql",
			wantQuery: "SELECT FLOOR(UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			query, err := dbTimestampMillisQueryForDialect(tt.dialect)

			require.NoError(t, err)
			require.Equal(t, tt.wantQuery, query)
		})
	}
}

func TestDBTimestampMillisQueryForDBUsesActualDialect(t *testing.T) {
	db := setupRecallEmailQuotaTestDB(t)

	query, err := dbTimestampMillisQueryForDB(db)

	require.NoError(t, err)
	require.Equal(t, "SELECT CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)", query)
}

func TestGetDBTimestampTxStrictReturnsQueryError(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	withDBTimestampQueryFailure(t)

	ts, err := getDBTimestampTxStrict(DB)

	require.Error(t, err)
	require.Zero(t, ts)
	require.ErrorContains(t, err, "UNIX_TIMESTAMP")
}

func TestGetDBTimestampWithContextReturnsDatabaseErrorWithoutFallback(t *testing.T) {
	setupRecallEmailQuotaTestDB(t)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	timestamp, err := GetDBTimestampWithContext(ctx)

	require.ErrorIs(t, err, context.Canceled)
	require.Zero(t, timestamp)
}

func TestGetDBTimestampWithContextUsesActiveDatabaseDialect(t *testing.T) {
	setupRecallEmailQuotaTestDB(t)
	originalSQLite := common.UsingSQLite
	originalMySQL := common.UsingMySQL
	originalPostgreSQL := common.UsingPostgreSQL
	common.UsingSQLite = false
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	t.Cleanup(func() {
		common.UsingSQLite = originalSQLite
		common.UsingMySQL = originalMySQL
		common.UsingPostgreSQL = originalPostgreSQL
	})

	timestamp, err := GetDBTimestampWithContext(context.Background())

	require.NoError(t, err)
	require.Positive(t, timestamp)
}

func TestGetDBTimestampWithContextRejectsUninitializedDatabase(t *testing.T) {
	originalDB := DB
	DB = nil
	t.Cleanup(func() { DB = originalDB })

	timestamp, err := GetDBTimestampWithContext(context.Background())

	require.ErrorContains(t, err, "database is not initialized")
	require.Zero(t, timestamp)

	timestamp, err = getDBTimestamp(nil)
	require.ErrorContains(t, err, "database is not initialized")
	require.Zero(t, timestamp)
}

func TestGetDBTimestampWithContextRejectsNilContext(t *testing.T) {
	setupRecallEmailQuotaTestDB(t)

	timestamp, err := GetDBTimestampWithContext(nil)

	require.ErrorContains(t, err, "context is nil")
	require.Zero(t, timestamp)
}

func withDBTimestampQueryFailure(t *testing.T) {
	t.Helper()
	originalPostgreSQL := common.UsingPostgreSQL
	originalSQLite := common.UsingSQLite
	originalMySQL := common.UsingMySQL
	t.Cleanup(func() {
		common.UsingPostgreSQL = originalPostgreSQL
		common.UsingSQLite = originalSQLite
		common.UsingMySQL = originalMySQL
	})
	common.UsingPostgreSQL = false
	common.UsingSQLite = false
	common.UsingMySQL = true
}
