/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
package model

import (
	"fmt"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// TestSQLiteConcurrentReadThenWriteNoBusy builds a DSN from the query
// parameters of the production SQLitePath (WAL + busy_timeout +
// _txlock=immediate) and verifies that concurrent "read-then-write inside a
// transaction" workloads never hit SQLITE_BUSY.
//
// Regression: without `_txlock=immediate` in the DSN, a transaction that first
// SELECTs (establishing a read snapshot) and then writes can fail instantly
// with database is locked (SQLITE_BUSY_SNAPSHOT, 5/517) when another
// connection commits in between, because the busy handler does not cover that
// case. This surfaces as failed subscription/billing writes under load (see
// #6805).
func TestSQLiteConcurrentReadThenWriteNoBusy(t *testing.T) {
	_, query, ok := strings.Cut(common.SQLitePath, "?")
	require.True(t, ok, "SQLitePath should carry query parameters")
	dsn := fmt.Sprintf("file:%s?%s", filepath.Join(t.TempDir(), "race.db"), query)

	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	defer sqlDB.Close()
	sqlDB.SetMaxOpenConns(8)
	sqlDB.SetMaxIdleConns(8)
	require.NoError(t, db.AutoMigrate(&UserSubscription{}))

	sub := &UserSubscription{UserId: 1, AmountTotal: 1 << 40, AmountUsed: 0, Status: "active"}
	require.NoError(t, db.Create(sub).Error)

	var errCount int64
	var wg sync.WaitGroup
	const workers = 8
	const perWorker = 50
	for g := 0; g < workers; g++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < perWorker; i++ {
				err := db.Transaction(func(tx *gorm.DB) error {
					var s UserSubscription
					if err := tx.First(&s, sub.Id).Error; err != nil {
						return err
					}
					s.AmountUsed++
					return tx.Save(&s).Error
				})
				if err != nil {
					atomic.AddInt64(&errCount, 1)
				}
			}
		}()
	}
	wg.Wait()
	require.Zero(t, errCount, "concurrent read-then-write transactions must not hit SQLITE_BUSY (DSN needs _txlock=immediate)")
}
