package model

import (
	"context"
	"database/sql"
	"net/url"
	"path/filepath"
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func sqliteDSNQuery(t *testing.T, dsn string) url.Values {
	t.Helper()
	parts := strings.SplitN(dsn, "?", 2)
	require.Len(t, parts, 2)
	query, err := url.ParseQuery(parts[1])
	require.NoError(t, err)
	return query
}

func TestNormalizeSQLiteDSNTranslatesLegacyBusyTimeout(t *testing.T) {
	normalized := normalizeSQLiteDSN("database.db?cache=shared&_busy_timeout=4321&_pragma=foreign_keys(1)")
	query := sqliteDSNQuery(t, normalized)

	assert.Equal(t, "shared", query.Get("cache"))
	assert.Equal(t, "immediate", query.Get("_txlock"))
	assert.NotContains(t, query, "_busy_timeout")
	assert.Equal(t, "immediate", query.Get("_txlock"))
	assert.ElementsMatch(t, []string{
		"foreign_keys(1)",
		"busy_timeout(4321)",
	}, query["_pragma"])
}

func TestNormalizeSQLiteDSNKeepsExplicitBusyTimeoutPragma(t *testing.T) {
	normalized := normalizeSQLiteDSN("database.db?_pragma=busy_timeout(1500)&_busy_timeout=4321")
	query := sqliteDSNQuery(t, normalized)

	assert.NotContains(t, query, "_busy_timeout")
	assert.Equal(t, []string{"busy_timeout(1500)"}, query["_pragma"])
}

func TestNormalizeSQLiteDSNAddsSafeDefault(t *testing.T) {
	query := sqliteDSNQuery(t, normalizeSQLiteDSN("database.db"))
	assert.Equal(t, []string{"busy_timeout(30000)"}, query["_pragma"])
	assert.Equal(t, "immediate", query.Get("_txlock"))

	query = sqliteDSNQuery(t, normalizeSQLiteDSN("database.db?_busy_timeout=invalid"))
	assert.Equal(t, []string{"busy_timeout(30000)"}, query["_pragma"])
}

func TestNormalizeSQLiteDSNKeepsExplicitTransactionLock(t *testing.T) {
	query := sqliteDSNQuery(t, normalizeSQLiteDSN("database.db?_txlock=deferred"))
	assert.Equal(t, "deferred", query.Get("_txlock"))
}

func TestNormalizeSQLiteDSNConfiguresModerncDriver(t *testing.T) {
	dsn := normalizeSQLiteDSN(filepath.Join(t.TempDir(), "busy-timeout.db") + "?_busy_timeout=1234")
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(2)
	t.Cleanup(func() {
		require.NoError(t, sqlDB.Close())
	})

	ctx := context.Background()
	firstConnection, err := sqlDB.Conn(ctx)
	require.NoError(t, err)
	defer firstConnection.Close()
	secondConnection, err := sqlDB.Conn(ctx)
	require.NoError(t, err)
	defer secondConnection.Close()

	for _, connection := range []*sql.Conn{firstConnection, secondConnection} {
		var busyTimeout int
		require.NoError(t, connection.QueryRowContext(ctx, "PRAGMA busy_timeout").Scan(&busyTimeout))
		assert.Equal(t, 1234, busyTimeout)
	}
}
