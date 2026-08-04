package model

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"sync"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

type sqliteIndexSnapshot struct {
	Name    string
	Unique  int
	Origin  string
	Partial int
	Columns []string
}

func p2MigrationSQLPath(t *testing.T, filename string) string {
	t.Helper()
	_, sourceFile, _, ok := runtime.Caller(0)
	require.True(t, ok, "failed to locate migration test source")
	return filepath.Join(filepath.Dir(sourceFile), "..", "bin", filename)
}

func readP2MigrationSQL(t *testing.T, filename string) string {
	t.Helper()
	contents, err := os.ReadFile(p2MigrationSQLPath(t, filename))
	require.NoError(t, err)
	return string(contents)
}

func openP2SQLiteMigrationTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := fmt.Sprintf("file:p2_migration_%d?mode=memory&cache=shared", os.Getpid())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { _ = sqlDB.Close() })
	return db
}

func snapshotSQLiteIndexes(t *testing.T, db *gorm.DB, table string) map[string]sqliteIndexSnapshot {
	t.Helper()
	rows, err := db.Raw(fmt.Sprintf("PRAGMA index_list(%q)", table)).Rows()
	require.NoError(t, err)
	defer rows.Close()

	indexes := make(map[string]sqliteIndexSnapshot)
	for rows.Next() {
		var seq, unique, partial int
		var name, origin string
		require.NoError(t, rows.Scan(&seq, &name, &unique, &origin, &partial))

		columnsRows, err := db.Raw(fmt.Sprintf("PRAGMA index_info(%q)", name)).Rows()
		require.NoError(t, err)
		columns := make([]string, 0, 2)
		for columnsRows.Next() {
			var seqno, cid int
			var column string
			require.NoError(t, columnsRows.Scan(&seqno, &cid, &column))
			columns = append(columns, column)
		}
		require.NoError(t, columnsRows.Err())
		require.NoError(t, columnsRows.Close())
		indexes[name] = sqliteIndexSnapshot{Name: name, Unique: unique, Origin: origin, Partial: partial, Columns: columns}
	}
	require.NoError(t, rows.Err())
	return indexes
}

func assertP2SQLiteIndexes(t *testing.T, table string, indexes map[string]sqliteIndexSnapshot) {
	t.Helper()
	expectedByTable := map[string]map[string]sqliteIndexSnapshot{
		"token_group_visibilities": {
			"idx_token_group_visibilities_group": {
				Name: "idx_token_group_visibilities_group", Unique: 1, Origin: "c", Partial: 0,
				Columns: []string{"group"},
			},
			"idx_token_group_visibilities_visibility": {
				Name: "idx_token_group_visibilities_visibility", Unique: 0, Origin: "c", Partial: 0,
				Columns: []string{"visibility"},
			},
		},
		"token_group_visibility_targets": {
			"idx_token_group_visibility_targets_visibility_id": {
				Name: "idx_token_group_visibility_targets_visibility_id", Unique: 0, Origin: "c", Partial: 0,
				Columns: []string{"visibility_id"},
			},
			"idx_token_group_visibility_targets_user_id": {
				Name: "idx_token_group_visibility_targets_user_id", Unique: 0, Origin: "c", Partial: 0,
				Columns: []string{"user_id"},
			},
			"idx_visibility_user": {
				Name: "idx_visibility_user", Unique: 1, Origin: "c", Partial: 0,
				Columns: []string{"visibility_id", "user_id"},
			},
		},
	}
	require.Contains(t, expectedByTable, table)
	require.Equal(t, expectedByTable[table], indexes)
}

func p2GORMIndexNames(t *testing.T) []string {
	t.Helper()
	names := make([]string, 0, 5)
	cache := &sync.Map{}
	for _, value := range []interface{}{&TokenGroupVisibility{}, &TokenGroupVisibilityTarget{}} {
		parsed, err := schema.Parse(value, cache, schema.NamingStrategy{})
		require.NoError(t, err)
		for _, index := range parsed.ParseIndexes() {
			names = append(names, index.Name)
		}
	}
	sort.Strings(names)
	return names
}

func TestTokenGroupVisibilityMigrationSQLMatchesGORMIndexNames(t *testing.T) {
	gormIndexNames := p2GORMIndexNames(t)
	require.Equal(t, []string{
		"idx_token_group_visibilities_group",
		"idx_token_group_visibilities_visibility",
		"idx_token_group_visibility_targets_user_id",
		"idx_token_group_visibility_targets_visibility_id",
		"idx_visibility_user",
	}, gormIndexNames)

	migrations := map[string]string{
		"migration_token_group_visibility_mysql.sql":    "KEY `idx_token_group_visibility_targets_user_id` (`user_id`)",
		"migration_token_group_visibility_postgres.sql": "CREATE INDEX IF NOT EXISTS \"idx_token_group_visibility_targets_user_id\"\n  ON \"token_group_visibility_targets\" (\"user_id\")",
		"migration_token_group_visibility_sqlite.sql":   "CREATE INDEX IF NOT EXISTS \"idx_token_group_visibility_targets_user_id\" ON \"token_group_visibility_targets\" (\"user_id\")",
	}
	for migration, userIndexDDL := range migrations {
		t.Run(migration, func(t *testing.T) {
			sql := readP2MigrationSQL(t, migration)
			require.NotContains(t, sql, "uni_token_group_visibilities_group")
			require.Contains(t, sql, "idx_token_group_visibilities_group")
			require.Contains(t, sql, "idx_token_group_visibilities_visibility")
			require.Contains(t, sql, "idx_token_group_visibility_targets_visibility_id")
			require.Contains(t, sql, userIndexDDL)
			require.Contains(t, sql, "idx_visibility_user")
			for _, indexName := range gormIndexNames {
				require.Contains(t, sql, indexName)
			}
		})
	}
}

func TestTokenGroupVisibilityHandwrittenSQLiteDDLIsAutoMigrateStable(t *testing.T) {
	db := openP2SQLiteMigrationTestDB(t)
	sql := readP2MigrationSQL(t, "migration_token_group_visibility_sqlite.sql")
	require.NoError(t, db.Exec(sql).Error)

	before := make(map[string]sqliteIndexSnapshot)
	for table, indexes := range map[string]map[string]sqliteIndexSnapshot{
		"token_group_visibilities":       snapshotSQLiteIndexes(t, db, "token_group_visibilities"),
		"token_group_visibility_targets": snapshotSQLiteIndexes(t, db, "token_group_visibility_targets"),
	} {
		for name, index := range indexes {
			before[table+"."+name] = index
		}
	}

	require.NoError(t, db.AutoMigrate(&TokenGroupVisibility{}, &TokenGroupVisibilityTarget{}))

	after := make(map[string]sqliteIndexSnapshot)
	for table, indexes := range map[string]map[string]sqliteIndexSnapshot{
		"token_group_visibilities":       snapshotSQLiteIndexes(t, db, "token_group_visibilities"),
		"token_group_visibility_targets": snapshotSQLiteIndexes(t, db, "token_group_visibility_targets"),
	} {
		for name, index := range indexes {
			after[table+"."+name] = index
		}
	}

	assertP2SQLiteIndexes(t, "token_group_visibilities", snapshotSQLiteIndexes(t, db, "token_group_visibilities"))
	assertP2SQLiteIndexes(t, "token_group_visibility_targets", snapshotSQLiteIndexes(t, db, "token_group_visibility_targets"))
	require.Equal(t, sortedSQLiteIndexKeys(before), sortedSQLiteIndexKeys(after), "AutoMigrate must not add or remove P2 indexes")
	for key, beforeIndex := range before {
		require.Equal(t, beforeIndex, after[key], "AutoMigrate changed index metadata for %s", key)
	}
}

func sortedSQLiteIndexKeys(indexes map[string]sqliteIndexSnapshot) []string {
	keys := make([]string, 0, len(indexes))
	for key := range indexes {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func TestTokenGroupVisibilityStartEndTagsUseExplicitBigintType(t *testing.T) {
	parsed, err := schema.Parse(&TokenGroupVisibility{}, &sync.Map{}, schema.NamingStrategy{})
	require.NoError(t, err)
	for _, column := range []string{"start_time", "end_time"} {
		field, ok := parsed.FieldsByDBName[column]
		require.True(t, ok, "missing %s field", column)
		require.Equal(t, "bigint", field.TagSettings["TYPE"], "unexpected %s type tag", column)
		require.Equal(t, "0", field.TagSettings["DEFAULT"], "unexpected %s default tag", column)
	}

	parsedTarget, err := schema.Parse(&TokenGroupVisibilityTarget{}, &sync.Map{}, schema.NamingStrategy{})
	require.NoError(t, err)
	for _, column := range []string{"visibility_id", "user_id"} {
		field, ok := parsedTarget.FieldsByDBName[column]
		require.True(t, ok, "missing %s field", column)
		require.Equal(t, "bigint", field.TagSettings["TYPE"], "unexpected %s type tag", column)
	}
}
