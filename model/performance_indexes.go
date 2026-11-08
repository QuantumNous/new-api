package model

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// performanceIndex describes an index that the dashboard and list queries rely
// on but that AutoMigrate does not create from the model tags. The columns are
// written with the physical column names used by the supported databases.
type performanceIndex struct {
	table   string
	name    string
	columns string
}

// mainDatabaseIndexes covers the tables scanned by control-panel overview and
// list endpoints. `logs` lives in the main database only when no separate log
// database is configured, so the same set is applied to both handles.
var mainDatabaseIndexes = []performanceIndex{
	{table: "logs", name: "idx_logs_created_at_type_user_id", columns: "created_at, type, user_id"},
	{table: "users", name: "idx_users_quota", columns: "quota"},
	{table: "users", name: "idx_users_created_at", columns: "created_at"},
	{table: "tokens", name: "idx_tokens_status_created_time", columns: "status, created_time"},
	{table: "redemptions", name: "idx_redemptions_status_created_time", columns: "status, created_time"},
}

// logDatabaseIndexes is applied to the log database. ClickHouse manages its own
// primary index through the table engine and rejects CREATE INDEX, so the
// caller skips this migration for ClickHouse.
var logDatabaseIndexes = []performanceIndex{
	{table: "logs", name: "idx_logs_created_at_type_user_id", columns: "created_at, type, user_id"},
}

func ensurePerformanceIndexes(db *gorm.DB, label string, indexes []performanceIndex) {
	if db == nil {
		return
	}
	for _, index := range indexes {
		if !db.Migrator().HasTable(index.table) {
			continue
		}
		if db.Migrator().HasIndex(index.table, index.name) {
			continue
		}
		statement := "CREATE INDEX " + index.name + " ON " + index.table + " (" + index.columns + ")"
		if err := db.Exec(statement).Error; err != nil {
			// Several instances can migrate at the same time; losing that race
			// is not an error because the index then exists.
			if isExistingIndexError(err) {
				continue
			}
			// A failed index must not stop startup: the instance keeps serving,
			// and the next restart retries.
			common.SysError(common.LogText("%s performance index %s could not be created: %s", label, index.name, err.Error()))
		}
	}
}

func isExistingIndexError(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "already exists") ||
		strings.Contains(message, "duplicate key name") ||
		strings.Contains(message, "duplicate index")
}
