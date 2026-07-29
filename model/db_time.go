package model

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// GetDBTimestamp returns a UNIX timestamp from database time.
// Falls back to application time on error.
func GetDBTimestamp() int64 {
	return getDBTimestampTx(DB)
}

func getDBTimestampTx(tx *gorm.DB) int64 {
	ts, err := getDBTimestampTxStrict(tx)
	if err != nil {
		return common.GetTimestamp()
	}
	return ts
}

func getDBTimestampTxStrict(tx *gorm.DB) (int64, error) {
	if tx == nil {
		return 0, errors.New("database handle is nil")
	}
	var ts int64
	err := tx.Raw(dbTimestampQuery()).Scan(&ts).Error
	if err != nil {
		return 0, err
	}
	if ts <= 0 {
		return 0, fmt.Errorf("database timestamp query returned non-positive timestamp: %d", ts)
	}
	return ts, nil
}

func dbTimestampQuery() string {
	switch {
	case common.UsingPostgreSQL:
		return "SELECT FLOOR(EXTRACT(EPOCH FROM clock_timestamp()))::bigint"
	case common.UsingSQLite:
		return "SELECT strftime('%s','now')"
	default:
		return "SELECT UNIX_TIMESTAMP()"
	}
}
