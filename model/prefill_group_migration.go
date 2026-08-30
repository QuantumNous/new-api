package model

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// migratePrefillGroupUniqueIndex drops leftover single-column UNIQUE
// constraints on prefill_groups.name before AutoMigrate.
//
// GORM 1.25.x MigrateColumnUnique treats a catalog unique column as the
// `unique` tag and issues DROP CONSTRAINT uni_<table>_<column>. Older
// uniqueIndex migrations stored that uniqueness as idx_<table>_<column> or
// PostgreSQL's <table>_<column>_key, so the uni_* constraint does not exist
// and AutoMigrate aborts with SQLSTATE 42704. Removing the catalog unique
// constraint first lets AutoMigrate create uk_prefill_name (partial unique
// index) instead.
func migratePrefillGroupUniqueIndex(db *gorm.DB) error {
	if db == nil || db.Dialector == nil || db.Dialector.Name() != "postgres" {
		return nil
	}
	if !db.Migrator().HasTable(&PrefillGroup{}) {
		return nil
	}
	stmt := &gorm.Statement{DB: db}
	if err := stmt.Parse(&PrefillGroup{}); err != nil {
		return err
	}
	return dropPrefillGroupLegacyNameUniques(db, stmt.Schema.Table)
}

func dropPrefillGroupLegacyNameUniques(db *gorm.DB, table string) error {
	if db == nil || table == "" {
		return nil
	}
	column := "name"
	var constraintNames []string
	if err := db.Raw(`
SELECT tc.constraint_name
FROM information_schema.table_constraints AS tc
INNER JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_catalog = kcu.constraint_catalog
 AND tc.constraint_schema = kcu.constraint_schema
 AND tc.constraint_name = kcu.constraint_name
 AND tc.table_name = kcu.table_name
WHERE tc.constraint_schema = current_schema()
  AND tc.table_name = ?
  AND tc.constraint_type = 'UNIQUE'
GROUP BY tc.constraint_name
HAVING COUNT(*) = 1 AND MIN(kcu.column_name) = ?`, table, column).Scan(&constraintNames).Error; err != nil {
		return fmt.Errorf("list unique constraints on %s.%s: %w", table, column, err)
	}
	for _, name := range constraintNames {
		if name == "" {
			continue
		}
		if err := db.Exec("ALTER TABLE ? DROP CONSTRAINT IF EXISTS ?",
			clause.Table{Name: table}, clause.Column{Name: name}).Error; err != nil {
			return fmt.Errorf("drop unique constraint %s on %s: %w", name, table, err)
		}
		common.SysLog(fmt.Sprintf("dropped leftover unique constraint %s on %s.%s", name, table, column))
	}

	legacyIndexNames := []string{
		db.NamingStrategy.IndexName(table, column),
		db.NamingStrategy.UniqueName(table, column),
	}
	for _, name := range legacyIndexNames {
		if name == "" || name == "uk_prefill_name" {
			continue
		}
		if err := db.Exec("DROP INDEX IF EXISTS ?", clause.Column{Name: name}).Error; err != nil {
			return fmt.Errorf("drop leftover unique index %s on %s: %w", name, table, err)
		}
	}
	return nil
}
