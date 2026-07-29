package model

import (
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

func TestGetDBTimestampTxStrictReturnsQueryError(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	withDBTimestampQueryFailure(t)

	ts, err := getDBTimestampTxStrict(DB)

	require.Error(t, err)
	require.Zero(t, ts)
	require.ErrorContains(t, err, "UNIX_TIMESTAMP")
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
