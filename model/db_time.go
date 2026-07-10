package model

import (
	"sync/atomic"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// testDBTimestampOverride, when > 0, forces GetDBTimestamp/getDBTimestampTx to return it.
// Used only by tests to simulate period/window expiry without sleeping.
var testDBTimestampOverride atomic.Int64

// SetTestDBTimestampOverride sets a fixed UNIX timestamp for DB time reads.
// Pass 0 to clear the override.
func SetTestDBTimestampOverride(ts int64) {
	testDBTimestampOverride.Store(ts)
}

// GetDBTimestamp returns a UNIX timestamp from database time.
// Falls back to application time on error.
func GetDBTimestamp() int64 {
	return getDBTimestampTx(nil)
}

func getDBTimestampTx(tx *gorm.DB) int64 {
	if override := testDBTimestampOverride.Load(); override > 0 {
		return override
	}
	var ts int64
	var err error
	query := DB
	if tx != nil {
		query = tx
	}
	switch {
	case common.UsingPostgreSQL:
		err = query.Raw("SELECT EXTRACT(EPOCH FROM NOW())::bigint").Scan(&ts).Error
	case common.UsingSQLite:
		err = query.Raw("SELECT strftime('%s','now')").Scan(&ts).Error
	default:
		err = query.Raw("SELECT UNIX_TIMESTAMP()").Scan(&ts).Error
	}
	if err != nil || ts <= 0 {
		return common.GetTimestamp()
	}
	return ts
}
