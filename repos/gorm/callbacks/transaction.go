package callbacks

import (
	"gorm.io/gorm"
)

func BeginTransaction(db *gorm.DB) {
	if !db.Config.SkipDefaultTransaction && db.Error == nil {
		if tx := db.Begin(); tx.Error == nil {
			db.Statement.ConnPool = tx.Statement.ConnPool
			db.InstanceSet("gorm:started_transaction", true)
		} else if tx.Error == gorm.ErrInvalidTransaction {
			tx.Error = nil
		} else {
			db.Error = tx.Error
		}
	}
}

func CommitOrRollbackTransaction(db *gorm.DB) {
	if !db.Config.SkipDefaultTransaction {
		if _, ok := db.InstanceGet("gorm:started_transaction"); ok {
			if db.Error != nil {
				db.Rollback()
			} else {
				db.Commit()
			}

			db.Statement.ConnPool = db.ConnPool
		}
	}
}
