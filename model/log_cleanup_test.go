package model

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The log cleanup task deletes old logs in batches; each batch must remove at
// most limit rows on every database, or one batch deletes them all in one
// long statement.
func TestDeleteOldLogBatchDeletesAtMostLimit(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			var dsn string
			switch dialect {
			case "sqlite":
				dsn = "local"
				previousPath := common.SQLitePath
				common.SQLitePath = filepath.Join(t.TempDir(), "log-cleanup.db")
				t.Cleanup(func() { common.SQLitePath = previousPath })
			case "mysql":
				dsn = os.Getenv("TEST_MYSQL_DSN")
			case "postgres":
				dsn = os.Getenv("TEST_POSTGRES_DSN")
			}
			if dsn == "" {
				t.Skip("test database DSN is not configured")
			}
			t.Setenv("LOG_CLEANUP_TEST_DSN", dsn)
			db, _, err := chooseDB("LOG_CLEANUP_TEST_DSN", true)
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			previousLogDB := LOG_DB
			LOG_DB = db
			t.Cleanup(func() {
				LOG_DB = previousLogDB
				_ = db.Migrator().DropTable(&Log{})
				_ = sqlDB.Close()
			})
			require.NoError(t, db.Migrator().DropTable(&Log{}))
			require.NoError(t, db.AutoMigrate(&Log{}))
			logs := []Log{{CreatedAt: 100}, {CreatedAt: 101}, {CreatedAt: 102}, {CreatedAt: 103}, {CreatedAt: 104}, {CreatedAt: 1000}}
			require.NoError(t, db.Create(&logs).Error)

			ctx := context.Background()
			deleted, err := DeleteOldLogBatch(ctx, 500, 2)
			require.NoError(t, err)
			assert.EqualValues(t, 2, deleted)
			remaining, err := CountOldLog(ctx, 500)
			require.NoError(t, err)
			assert.EqualValues(t, 3, remaining)

			deleted, err = DeleteOldLogBatch(ctx, 500, 5)
			require.NoError(t, err)
			assert.EqualValues(t, 3, deleted)
			var kept []int64
			require.NoError(t, db.Model(&Log{}).Order("id").Pluck("created_at", &kept).Error)
			assert.Equal(t, []int64{1000}, kept, "newer logs stay")
		})
	}
}
