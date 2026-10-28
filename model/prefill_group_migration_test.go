package model

import (
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func testPrefillGroupMigrationNonPostgreSQL(t *testing.T, db *gorm.DB) {
	t.Helper()
	tableName := fmt.Sprintf("prefill_group_migration_%d", time.Now().UnixNano())
	t.Cleanup(func() { _ = db.Migrator().DropTable(tableName) })

	tableDB := db.Table(tableName)
	require.NoError(t, tableDB.AutoMigrate(&PrefillGroup{}))
	require.NoError(t, tableDB.Create(&PrefillGroup{
		Name:        "preserved-name",
		Type:        "model",
		Items:       JSONValue(`["gpt-test"]`),
		Description: "preserve me",
	}).Error)

	for range 2 {
		require.NoError(t, migratePrefillGroupUniqueness(db))
		require.NoError(t, tableDB.AutoMigrate(&PrefillGroup{}))
	}

	var preserved PrefillGroup
	require.NoError(t, tableDB.Where("name = ?", "preserved-name").First(&preserved).Error)
	assert.Equal(t, "preserve me", preserved.Description)
	assert.True(t, tableDB.Migrator().HasIndex(&PrefillGroup{}, prefillGroupNameIndex))
}

func TestMigratePrefillGroupUniquenessSQLite(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	testPrefillGroupMigrationNonPostgreSQL(t, db)
}

func TestMigratePrefillGroupUniquenessMySQL(t *testing.T) {
	dsn := strings.TrimSpace(os.Getenv("TEST_MYSQL_DSN"))
	if dsn == "" {
		t.Skip("TEST_MYSQL_DSN is not configured")
	}

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
	testPrefillGroupMigrationNonPostgreSQL(t, db)
}

func TestMigratePrefillGroupUniquenessPostgreSQL(t *testing.T) {
	dsn := strings.TrimSpace(os.Getenv("TEST_POSTGRES_DSN"))
	if dsn == "" {
		t.Skip("TEST_POSTGRES_DSN is not configured")
	}

	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN:                  dsn,
		PreferSimpleProtocol: true,
	}), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })

	tests := []struct {
		name               string
		prepareOld         func(*testing.T, *gorm.DB)
		blockedConstraints []string
		blockedIndexes     []string
		preservedIndexes   []string
	}{
		{name: "fresh"},
		{
			name: "legacy_constraint",
			prepareOld: func(t *testing.T, tx *gorm.DB) {
				t.Helper()
				require.NoError(t, tx.Exec(
					"ALTER TABLE ? ADD CONSTRAINT ? UNIQUE (?)",
					clause.Table{Name: "prefill_groups"},
					clause.Column{Name: legacyPrefillGroupNameUnique},
					clause.Column{Name: "name"},
				).Error)
			},
		},
		{
			name: "legacy_standalone_index",
			prepareOld: func(t *testing.T, tx *gorm.DB) {
				t.Helper()
				require.NoError(t, tx.Migrator().DropIndex(&PrefillGroup{}, prefillGroupNameIndex))
				require.NoError(t, tx.Exec(
					"CREATE UNIQUE INDEX ? ON ? (?)",
					clause.Column{Name: legacyPrefillGroupNameUnique},
					clause.Table{Name: "prefill_groups"},
					clause.Column{Name: "name"},
				).Error)
			},
		},
		{
			name: "arbitrary_constraint_name",
			prepareOld: func(t *testing.T, tx *gorm.DB) {
				t.Helper()
				for _, constraintName := range []string{
					legacyPrefillGroupNameUnique,
					"prefill_groups_name_key",
				} {
					require.NoError(t, tx.Exec(
						"ALTER TABLE ? ADD CONSTRAINT ? UNIQUE (?)",
						clause.Table{Name: "prefill_groups"},
						clause.Column{Name: constraintName},
						clause.Column{Name: "name"},
					).Error)
				}
			},
			blockedConstraints: []string{legacyPrefillGroupNameUnique, "prefill_groups_name_key"},
		},
		{
			name: "arbitrary_index_name",
			prepareOld: func(t *testing.T, tx *gorm.DB) {
				t.Helper()
				for _, indexName := range []string{
					legacyPrefillGroupNameUnique,
					"prefill_groups_name_key",
				} {
					require.NoError(t, tx.Exec(
						"CREATE UNIQUE INDEX ? ON ? (?)",
						clause.Column{Name: indexName},
						clause.Table{Name: "prefill_groups"},
						clause.Column{Name: "name"},
					).Error)
				}
			},
			blockedIndexes: []string{legacyPrefillGroupNameUnique, "prefill_groups_name_key"},
		},
		{
			name: "non_conflicting_indexes_are_preserved",
			prepareOld: func(t *testing.T, tx *gorm.DB) {
				t.Helper()
				require.NoError(t, tx.Exec(
					"ALTER TABLE ? ADD CONSTRAINT ? UNIQUE (?)",
					clause.Table{Name: "prefill_groups"},
					clause.Column{Name: legacyPrefillGroupNameUnique},
					clause.Column{Name: "name"},
				).Error)
				require.NoError(t, tx.Exec(
					"CREATE UNIQUE INDEX ? ON ? (?, ?)",
					clause.Column{Name: "keep_prefill_name_deleted_at"},
					clause.Table{Name: "prefill_groups"},
					clause.Column{Name: "name"},
					clause.Column{Name: "deleted_at"},
				).Error)
				require.NoError(t, tx.Exec(
					"CREATE UNIQUE INDEX ? ON ? (lower(?)) WHERE deleted_at IS NULL",
					clause.Column{Name: "keep_prefill_lower_name"},
					clause.Table{Name: "prefill_groups"},
					clause.Column{Name: "name"},
				).Error)
				require.NoError(t, tx.Exec(
					"CREATE UNIQUE INDEX ? ON ? (?) WHERE deleted_at IS NOT NULL",
					clause.Column{Name: "keep_prefill_deleted_name"},
					clause.Table{Name: "prefill_groups"},
					clause.Column{Name: "name"},
				).Error)
			},
			preservedIndexes: []string{
				"keep_prefill_name_deleted_at",
				"keep_prefill_lower_name",
				"keep_prefill_deleted_name",
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			tx := db.Begin()
			require.NoError(t, tx.Error)
			t.Cleanup(func() { _ = tx.Rollback().Error })

			schemaName := fmt.Sprintf("prefill_group_migration_%d", time.Now().UnixNano())
			require.NoError(t, tx.Exec(
				"CREATE SCHEMA ?",
				clause.Table{Name: schemaName},
			).Error)
			require.NoError(t, tx.Exec(
				"SET LOCAL search_path TO ?",
				clause.Table{Name: schemaName},
			).Error)

			require.NoError(t, migratePrefillGroupUniqueness(tx))
			require.NoError(t, tx.AutoMigrate(&PrefillGroup{}))
			original := PrefillGroup{
				Name:        "shared-name",
				Type:        "model",
				Items:       JSONValue(`["gpt-test"]`),
				Description: "preserve me",
			}
			require.NoError(t, tx.Create(&original).Error)
			if test.prepareOld != nil {
				test.prepareOld(t, tx)
			}
			if len(test.blockedConstraints) > 0 || len(test.blockedIndexes) > 0 {
				err := migratePrefillGroupUniqueness(tx)
				require.Error(t, err)
				assert.Contains(t, err.Error(), "prefill_groups_name_key")
				for _, constraintName := range test.blockedConstraints {
					assert.True(t, tx.Migrator().HasConstraint(&PrefillGroup{}, constraintName))
				}
				for _, indexName := range test.blockedIndexes {
					assert.True(t, tx.Migrator().HasIndex(&PrefillGroup{}, indexName))
				}
				return
			}

			for range 2 {
				require.NoError(t, migratePrefillGroupUniqueness(tx))
				require.NoError(t, tx.AutoMigrate(&PrefillGroup{}))
			}
			for _, indexName := range test.preservedIndexes {
				assert.True(t, tx.Migrator().HasIndex(&PrefillGroup{}, indexName))
			}

			var preserved PrefillGroup
			require.NoError(t, tx.First(&preserved, original.Id).Error)
			assert.Equal(t, original.Name, preserved.Name)
			assert.Equal(t, original.Description, preserved.Description)

			var globalConstraintCount int64
			require.NoError(t, tx.Raw(`
SELECT count(*)
FROM pg_catalog.pg_constraint AS constraint_meta
WHERE constraint_meta.conrelid = to_regclass('prefill_groups')
  AND constraint_meta.contype = 'u'
  AND cardinality(constraint_meta.conkey) = 1
  AND EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute AS attribute_meta
      WHERE attribute_meta.attrelid = constraint_meta.conrelid
        AND attribute_meta.attnum = constraint_meta.conkey[1]
        AND attribute_meta.attname = 'name'
  )`).Scan(&globalConstraintCount).Error)
			assert.Zero(t, globalConstraintCount)

			var globalIndexCount int64
			require.NoError(t, tx.Raw(`
SELECT count(*)
FROM pg_catalog.pg_index AS index_meta
JOIN pg_catalog.pg_attribute AS attribute_meta
  ON attribute_meta.attrelid = index_meta.indrelid
 AND attribute_meta.attnum = index_meta.indkey[0]
WHERE index_meta.indrelid = to_regclass('prefill_groups')
  AND index_meta.indisunique
  AND NOT index_meta.indisprimary
  AND index_meta.indpred IS NULL
  AND index_meta.indexprs IS NULL
  AND index_meta.indnatts = 1
  AND attribute_meta.attname = 'name'`).Scan(&globalIndexCount).Error)
			assert.Zero(t, globalIndexCount)

			var targetIndexDefinition string
			require.NoError(t, tx.Raw(`
SELECT indexdef
FROM pg_catalog.pg_indexes
WHERE schemaname = current_schema()
  AND tablename = 'prefill_groups'
  AND indexname = ?`, prefillGroupNameIndex).Scan(&targetIndexDefinition).Error)
			assert.Contains(t, strings.ToLower(targetIndexDefinition), "unique index")
			assert.Contains(t, strings.ToLower(targetIndexDefinition), "where (deleted_at is null)")

			duplicateError := tx.Transaction(func(duplicateTx *gorm.DB) error {
				return duplicateTx.Create(&PrefillGroup{
					Name:  original.Name,
					Type:  "model",
					Items: JSONValue(`[]`),
				}).Error
			})
			require.Error(t, duplicateError)

			require.NoError(t, tx.Delete(&original).Error)
			require.NoError(t, tx.Create(&PrefillGroup{
				Name:  original.Name,
				Type:  "model",
				Items: JSONValue(`[]`),
			}).Error)

			var totalRows int64
			require.NoError(t, tx.Unscoped().Model(&PrefillGroup{}).Count(&totalRows).Error)
			assert.EqualValues(t, 2, totalRows)
		})
	}
}
