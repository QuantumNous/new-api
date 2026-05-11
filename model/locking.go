package model

import (
	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// LockingForUpdate applies a row-level update lock on databases that support it.
// SQLite serializes writes at the database level and does not support SELECT FOR UPDATE.
func LockingForUpdate(tx *gorm.DB) *gorm.DB {
	if tx == nil {
		return tx
	}
	if common.UsingMySQL || common.UsingPostgreSQL {
		return tx.Clauses(clause.Locking{Strength: "UPDATE"})
	}
	return tx
}
