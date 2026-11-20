package model

import (
	"slices"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// migrateLogTimeIndex repairs the known legacy (id, created_at) index. GORM
// creates missing indexes but does not reorder an existing named index.
func migrateLogTimeIndex(db *gorm.DB) error {
	const indexName = "idx_created_at_id"
	var columns []string
	var unique bool
	if db.Dialector.Name() == "postgres" {
		// GetIndexes neither preserves key order nor scopes same-named
		// relations to a schema. Resolve both properties from the actual logs
		// relation so an unrelated schema cannot affect a unique index.
		var keys []struct {
			ColumnName string
			IsUnique   bool
		}
		if err := db.Raw(`SELECT attribute.attname AS column_name, index_meta.indisunique AS is_unique
FROM pg_catalog.pg_index AS index_meta
JOIN pg_catalog.pg_class AS index_relation ON index_relation.oid = index_meta.indexrelid
CROSS JOIN LATERAL unnest(index_meta.indkey) WITH ORDINALITY AS index_column(attnum, ordinal_position)
JOIN pg_catalog.pg_attribute AS attribute
  ON attribute.attrelid = index_meta.indrelid AND attribute.attnum = index_column.attnum
WHERE index_meta.indrelid = to_regclass(?) AND index_relation.relname = ?
ORDER BY index_column.ordinal_position`, "logs", indexName).Scan(&keys).Error; err != nil {
			return err
		}
		for _, key := range keys {
			columns = append(columns, key.ColumnName)
			unique = key.IsUnique
		}
	} else {
		indexes, err := db.Migrator().GetIndexes(&Log{})
		if err != nil {
			return err
		}
		for _, index := range indexes {
			if index.Name() == indexName {
				columns = index.Columns()
				unique, _ = index.Unique()
				break
			}
		}
	}
	if unique || !slices.Equal(columns, []string{"id", "created_at"}) {
		return nil
	}
	if db.Dialector.Name() == "mysql" {
		// MySQL implicitly commits DDL. Replace the index in one ALTER so
		// a failed creation cannot leave the legacy index missing.
		return db.Exec("ALTER TABLE ? DROP INDEX ?, ADD INDEX ? (?, ?)",
			clause.Table{Name: "logs"}, clause.Column{Name: indexName},
			clause.Column{Name: indexName}, clause.Column{Name: "created_at"}, clause.Column{Name: "id"}).Error
	}
	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Migrator().DropIndex(&Log{}, indexName); err != nil {
			return err
		}
		return tx.Migrator().CreateIndex(&Log{}, indexName)
	})
}
