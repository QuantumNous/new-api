package model

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestBatchUpdateRetryDatabaseMatrix(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			dsn := "local"
			switch dialect {
			case "sqlite":
				oldPath := common.SQLitePath
				common.SQLitePath = filepath.Join(t.TempDir(), "accounting.db") + "?_pragma=busy_timeout(50)"
				t.Cleanup(func() { common.SQLitePath = oldPath })
			case "mysql":
				dsn = os.Getenv("TEST_MYSQL_DSN")
			case "postgres":
				dsn = os.Getenv("TEST_POSTGRES_DSN")
			}
			if dsn == "" {
				t.Skip("isolated test database DSN is not configured")
			}
			t.Setenv("ACCOUNTING_TEST_DSN", dsn)
			db, dbType, err := chooseDB("ACCOUNTING_TEST_DSN", false)
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			sqlDB.SetMaxOpenConns(1)
			oldDB, oldType := DB, common.MainDatabaseType()
			DB = db
			common.SetMainDatabaseType(dbType)
			t.Cleanup(func() {
				DB = oldDB
				common.SetMainDatabaseType(oldType)
				require.NoError(t, db.Migrator().DropTable(&User{}, &Token{}, &Channel{}, &BatchUpdateReceipt{}))
				require.NoError(t, sqlDB.Close())
			})
			require.NoError(t, db.Migrator().DropTable(&User{}, &Token{}, &Channel{}, &BatchUpdateReceipt{}))
			require.NoError(t, db.AutoMigrate(&User{}, &Token{}, &Channel{}))
			resetBatchUpdateTestState(t)
			var version string
			query := "SELECT version()"
			if dialect == "sqlite" {
				query = "SELECT sqlite_version()"
			}
			require.NoError(t, db.Raw(query).Scan(&version).Error)
			t.Logf("database version: %s", version)
			migrationRecorder := &migrationSQLRecorder{}
			require.NoError(t, db.Session(&gorm.Session{Logger: migrationRecorder}).AutoMigrate(&BatchUpdateReceipt{}))
			assert.Empty(t, migrationRecorder.schemaMutations())

			// An empty batch must not write any business row.
			require.NoError(t, batchUpdate())
			for _, table := range []string{"tokens", "channels", "users"} {
				t.Run("rollback_"+table, func(t *testing.T) {
					user, token, channel := createAccountingBatchTestFixture(t)
					addNewRecord(BatchUpdateTypeUserQuota, user.Id, -100)
					addNewRecord(BatchUpdateTypeTokenQuota, token.Id, -100)
					addNewRecord(BatchUpdateTypeUsedQuota, user.Id, 100)
					addNewRecord(BatchUpdateTypeRequestCount, user.Id, 1)
					addNewRecord(BatchUpdateTypeChannelUsedQuota, channel.Id, 100)
					var before User
					var beforeToken Token
					var beforeChannel Channel
					require.NoError(t, db.First(&before, user.Id).Error)
					require.NoError(t, db.First(&beforeToken, token.Id).Error)
					require.NoError(t, db.First(&beforeChannel, channel.Id).Error)
					injected := errors.New("injected SQL failure")
					added := false
					const callback = "test:batch_sql_failure"
					require.NoError(t, db.Callback().Update().Before("gorm:update").Register(callback, func(tx *gorm.DB) {
						if tx.Statement.Table != table {
							return
						}
						if !added {
							added = true
							// New work must not be mixed with or erased by the old batch.
							addNewRecord(BatchUpdateTypeUserQuota, user.Id, 25)
							addNewRecord(BatchUpdateTypeTokenQuota, token.Id, 25)
							addNewRecord(BatchUpdateTypeUsedQuota, user.Id, -25)
							addNewRecord(BatchUpdateTypeChannelUsedQuota, channel.Id, -25)
						}
						tx.AddError(injected)
					}))
					require.ErrorIs(t, batchUpdate(), injected)
					require.ErrorIs(t, batchUpdate(), injected)
					canceled, cancel := context.WithCancel(context.Background())
					cancel()
					require.ErrorIs(t, batchUpdateContext(canceled), context.Canceled)
					var got User
					var gotToken Token
					var gotChannel Channel
					require.NoError(t, db.First(&got, user.Id).Error)
					require.NoError(t, db.First(&gotToken, token.Id).Error)
					require.NoError(t, db.First(&gotChannel, channel.Id).Error)
					assert.Equal(t, before.Quota, got.Quota)
					assert.Equal(t, before.UsedQuota, got.UsedQuota)
					assert.Equal(t, before.RequestCount, got.RequestCount)
					assert.Equal(t, beforeToken.RemainQuota, gotToken.RemainQuota)
					assert.Equal(t, beforeToken.UsedQuota, gotToken.UsedQuota)
					assert.Equal(t, beforeChannel.UsedQuota, gotChannel.UsedQuota)
					require.NoError(t, db.Callback().Update().Remove(callback))
					require.NoError(t, batchUpdate()) // old pending only
					assert.Equal(t, before.Quota-100, getUserQuotaFromDB(t, user.Id))
					require.NoError(t, batchUpdate()) // new +25 adjustment
					require.NoError(t, batchUpdate()) // no replay
					require.NoError(t, db.First(&got, user.Id).Error)
					require.NoError(t, db.First(&gotToken, token.Id).Error)
					require.NoError(t, db.First(&gotChannel, channel.Id).Error)
					assert.Equal(t, before.Quota-75, got.Quota)
					assert.Equal(t, before.UsedQuota+75, got.UsedQuota)
					assert.Equal(t, before.RequestCount+1, got.RequestCount)
					assert.Equal(t, beforeToken.RemainQuota-75, gotToken.RemainQuota)
					assert.Equal(t, beforeToken.UsedQuota+75, gotToken.UsedQuota)
					assert.Equal(t, beforeChannel.UsedQuota+75, gotChannel.UsedQuota)
				})
			}

			t.Run("commit_response_lost", func(t *testing.T) {
				user, token, channel := createAccountingBatchTestFixture(t)
				originalPool, originalStatementPool := db.ConnPool, db.Statement.ConnPool
				lose := true
				pool := lostCommitResponsePool{ConnPool: sqlDB, lose: &lose}
				db.ConnPool, db.Statement.ConnPool = pool, pool
				defer func() { db.ConnPool, db.Statement.ConnPool = originalPool, originalStatementPool }()
				addNewRecord(BatchUpdateTypeUserQuota, user.Id, -100)
				addNewRecord(BatchUpdateTypeTokenQuota, token.Id, -100)
				addNewRecord(BatchUpdateTypeUsedQuota, user.Id, 100)
				addNewRecord(BatchUpdateTypeRequestCount, user.Id, 1)
				addNewRecord(BatchUpdateTypeChannelUsedQuota, channel.Id, 100)
				require.Error(t, batchUpdate())
				assert.Equal(t, 900, getUserQuotaFromDB(t, user.Id))
				assert.Equal(t, 900, getTokenFromDB(t, token.Id).RemainQuota)
				require.NoError(t, batchUpdate())
				require.NoError(t, batchUpdate())
				var got User
				var gotChannel Channel
				require.NoError(t, db.First(&got, user.Id).Error)
				require.NoError(t, db.First(&gotChannel, channel.Id).Error)
				assert.Equal(t, 900, got.Quota)
				assert.Equal(t, 100, got.UsedQuota)
				assert.Equal(t, 1, got.RequestCount)
				gotToken := getTokenFromDB(t, token.Id)
				assert.Equal(t, 900, gotToken.RemainQuota)
				assert.Equal(t, 100, gotToken.UsedQuota)
				assert.EqualValues(t, 100, gotChannel.UsedQuota)
			})
			t.Run("commit_still_running", func(t *testing.T) { testAccountingDelayedCommit(t, db, dialect) })
			t.Run("concurrent_flush_cancel", func(t *testing.T) {
				user, _, _ := createAccountingBatchTestFixture(t)
				addNewRecord(BatchUpdateTypeUserQuota, user.Id, -10)
				entered, release := make(chan struct{}), make(chan struct{})
				var once sync.Once
				const callback = "test:serialized_flush"
				require.NoError(t, db.Callback().Update().Before("gorm:update").Register(callback, func(tx *gorm.DB) {
					if tx.Statement.Table == "users" {
						once.Do(func() { close(entered); <-release })
					}
				}))
				defer func() { _ = db.Callback().Update().Remove(callback) }()
				ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
				defer cancel()
				done := make(chan error, 1)
				go func() { done <- batchUpdateContext(ctx) }()
				var releaseOnce sync.Once
				defer releaseOnce.Do(func() { close(release) })
				select {
				case <-entered:
				case <-ctx.Done():
					t.Fatal("flush did not enter SQL")
				}
				addNewRecord(BatchUpdateTypeUserQuota, user.Id, 5)
				canceled, stop := context.WithCancel(ctx)
				stop()
				require.ErrorIs(t, batchUpdateContext(canceled), context.Canceled)
				releaseOnce.Do(func() { close(release) })
				require.NoError(t, <-done)
				require.NoError(t, batchUpdate())
				assert.Equal(t, 995, getUserQuotaFromDB(t, user.Id))
			})
			t.Run("independent_concurrent_writers", func(t *testing.T) {
				user, token, channel := createAccountingBatchTestFixture(t)
				sqlDB.SetMaxOpenConns(4)
				defer sqlDB.SetMaxOpenConns(1)
				other := createReserveTestUser(t, 1000)
				ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
				defer cancel()
				start := make(chan struct{})
				done := make(chan error, 2)
				for _, writer := range []string{"concurrent-writer-a", "concurrent-writer-b"} {
					go func() {
						<-start
						var err error
						// SQLite can reject a concurrent write instead of waiting; retry
						// only the same identity, with a bounded context.
						for range 3 {
							err = applyAccountingBatch(db.WithContext(ctx), writer, "same-batch", func(tx *gorm.DB) error {
								if err := increaseTokenQuota(tx, token.Id, -10); err != nil {
									return err
								}
								if err := updateChannelUsedQuota(tx, channel.Id, 10); err != nil {
									return err
								}
								for _, id := range []int{user.Id, other.Id} {
									if err := updateUserQuotaUsedQuotaAndRequestCount(tx, id, -10, 10, 1); err != nil {
										return err
									}
								}
								return nil
							})
							if err == nil {
								break
							}
						}
						done <- err
					}()
				}
				close(start)
				require.NoError(t, <-done)
				require.NoError(t, <-done)
				assert.Equal(t, 980, getUserQuotaFromDB(t, user.Id))
				assert.Equal(t, 980, getUserQuotaFromDB(t, other.Id))
				assert.Equal(t, 980, getTokenFromDB(t, token.Id).RemainQuota)
				var gotChannel Channel
				require.NoError(t, db.First(&gotChannel, channel.Id).Error)
				assert.EqualValues(t, 20, gotChannel.UsedQuota)
			})
			t.Run("shutdown_drains_pending_and_new_work", func(t *testing.T) {
				user, token, channel := createAccountingBatchTestFixture(t)
				injected := errors.New("pending shutdown batch")
				const callback = "test:shutdown_batch"
				require.NoError(t, db.Callback().Update().Before("gorm:update").Register(callback, func(tx *gorm.DB) {
					if tx.Statement.Table == "users" {
						tx.AddError(injected)
					}
				}))
				t.Cleanup(func() { _ = db.Callback().Update().Remove(callback) })
				addNewRecord(BatchUpdateTypeUserQuota, user.Id, -100)
				addNewRecord(BatchUpdateTypeTokenQuota, token.Id, -100)
				addNewRecord(BatchUpdateTypeUsedQuota, user.Id, 100)
				addNewRecord(BatchUpdateTypeRequestCount, user.Id, 1)
				addNewRecord(BatchUpdateTypeChannelUsedQuota, channel.Id, 100)
				require.ErrorIs(t, batchUpdate(), injected)
				// A refund queued after the failed tick must be drained too.
				addNewRecord(BatchUpdateTypeUserQuota, user.Id, 100)
				addNewRecord(BatchUpdateTypeTokenQuota, token.Id, 100)
				addNewRecord(BatchUpdateTypeUsedQuota, user.Id, -100)
				addNewRecord(BatchUpdateTypeChannelUsedQuota, channel.Id, -100)
				canceled, cancel := context.WithCancel(context.Background())
				cancel()
				require.ErrorIs(t, FlushBatchUpdate(canceled), context.Canceled)
				require.NoError(t, db.Callback().Update().Remove(callback))
				ctx, stop := context.WithTimeout(context.Background(), 10*time.Second)
				defer stop()
				require.NoError(t, FlushBatchUpdate(ctx))
				require.NoError(t, FlushBatchUpdate(ctx)) // No replay on a second drain.
				var got User
				var gotChannel Channel
				require.NoError(t, db.First(&got, user.Id).Error)
				require.NoError(t, db.First(&gotChannel, channel.Id).Error)
				assert.Equal(t, 1000, got.Quota)
				assert.Zero(t, got.UsedQuota)
				assert.Equal(t, 1, got.RequestCount)
				gotToken := getTokenFromDB(t, token.Id)
				assert.Equal(t, 1000, gotToken.RemainQuota)
				assert.Zero(t, gotToken.UsedQuota)
				assert.Zero(t, gotChannel.UsedQuota)
			})
			t.Run("shutdown_cancels_sleeping_writer", func(t *testing.T) {
				resetBatchUpdateTestState(t)
				oldInterval := common.BatchUpdateInterval
				common.BatchUpdateInterval = 3600
				defer func() { common.BatchUpdateInterval = oldInterval }()
				ctx, cancel := context.WithCancel(context.Background())
				done := InitBatchUpdater(ctx)
				cancel()
				select {
				case <-done:
				case <-time.After(5 * time.Second):
					t.Fatal("periodic writer did not stop on cancellation")
				}
				require.NoError(t, FlushBatchUpdate(context.Background()))
			})
			t.Run("shutdown_cancels_inflight_writer_and_retries", func(t *testing.T) {
				user, _, _ := createAccountingBatchTestFixture(t)
				before := getUserQuotaFromDB(t, user.Id)
				oldInterval := common.BatchUpdateInterval
				common.BatchUpdateInterval = 0 // Trigger immediately, without a sleep-based test.
				defer func() { common.BatchUpdateInterval = oldInterval }()
				entered := make(chan struct{})
				var once sync.Once
				const callback = "test:cancel_periodic_sql"
				require.NoError(t, db.Callback().Update().Before("gorm:update").Register(callback, func(tx *gorm.DB) {
					if tx.Statement.Table == "users" {
						once.Do(func() { close(entered) })
						<-tx.Statement.Context.Done()
						tx.AddError(tx.Statement.Context.Err())
					}
				}))
				defer func() { _ = db.Callback().Update().Remove(callback) }()
				addNewRecord(BatchUpdateTypeUserQuota, user.Id, -10)
				ctx, cancel := context.WithCancel(context.Background())
				defer cancel()
				done := InitBatchUpdater(ctx)
				select {
				case <-entered:
				case <-time.After(5 * time.Second):
					t.Fatal("periodic writer did not enter SQL")
				}
				cancel()
				select {
				case <-done:
				case <-time.After(5 * time.Second):
					t.Fatal("in-flight periodic writer did not stop")
				}
				require.NoError(t, db.Callback().Update().Remove(callback))
				addNewRecord(BatchUpdateTypeUserQuota, user.Id, 10)
				flushCtx, stop := context.WithTimeout(context.Background(), 10*time.Second)
				defer stop()
				require.NoError(t, FlushBatchUpdate(flushCtx))
				assert.Equal(t, before, getUserQuotaFromDB(t, user.Id))
			})
			t.Run("nonbatch_and_deleted_objects", func(t *testing.T) {
				user, token, channel := createAccountingBatchTestFixture(t)
				common.BatchUpdateEnabled = false
				require.NoError(t, IncreaseTokenQuota(token.Id, token.Key, 25))
				require.NoError(t, DecreaseTokenQuota(token.Id, token.Key, 10))
				UpdateChannelUsedQuota(channel.Id, -25)
				assert.Equal(t, 1015, getTokenFromDB(t, token.Id).RemainQuota)
				var gotChannel Channel
				require.NoError(t, db.First(&gotChannel, channel.Id).Error)
				assert.EqualValues(t, -25, gotChannel.UsedQuota)
				// Preserve the existing zero-rows semantics: deleted objects are not
				// resurrected and do not block updates to still-existing objects.
				require.NoError(t, db.Delete(&token).Error)
				require.NoError(t, db.Delete(&channel).Error)
				addNewRecord(BatchUpdateTypeTokenQuota, token.Id, -50)
				addNewRecord(BatchUpdateTypeChannelUsedQuota, channel.Id, 50)
				addNewRecord(BatchUpdateTypeUserQuota, user.Id, -10)
				require.NoError(t, batchUpdate())
				assert.Equal(t, 990, getUserQuotaFromDB(t, user.Id))
				var deleted Token
				require.NoError(t, db.Unscoped().First(&deleted, token.Id).Error)
				assert.Equal(t, 1015, deleted.RemainQuota)
				assert.ErrorIs(t, db.First(&gotChannel, channel.Id).Error, gorm.ErrRecordNotFound)
			})
		})
	}
}

func createAccountingBatchTestFixture(t *testing.T) (User, Token, Channel) {
	t.Helper()
	resetBatchUpdateTestState(t)
	user := createReserveTestUser(t, 1000)
	token := Token{UserId: user.Id, Key: "batch-token-" + common.GetRandomString(8), Name: "batch retry", Status: common.TokenStatusEnabled, ExpiredTime: -1, RemainQuota: 1000}
	channel := Channel{Name: "batch retry", Key: "unused"}
	require.NoError(t, DB.Create(&token).Error)
	require.NoError(t, DB.Create(&channel).Error)
	return user, token, channel
}

// Real SQL COMMIT succeeds before this connection pool reports an error.
// This is deterministic driver-boundary injection, not a network outage test.
type lostCommitResponsePool struct {
	gorm.ConnPool
	lose *bool
}

func (pool lostCommitResponsePool) BeginTx(ctx context.Context, opts *sql.TxOptions) (gorm.ConnPool, error) {
	tx, err := pool.ConnPool.(gorm.TxBeginner).BeginTx(ctx, opts)
	if err != nil {
		return nil, err
	}
	return &lostCommitResponseTx{Tx: tx, lose: pool.lose}, nil
}

type lostCommitResponseTx struct {
	*sql.Tx
	lose *bool
}

func (tx *lostCommitResponseTx) Commit() error {
	if err := tx.Tx.Commit(); err != nil {
		return err
	}
	if *tx.lose {
		*tx.lose = false
		return errors.New("COMMIT succeeded but its response was lost")
	}
	return nil
}

type delayedCommitPool struct {
	gorm.ConnPool
	release  <-chan struct{}
	finished chan error
}

func (pool delayedCommitPool) BeginTx(ctx context.Context, opts *sql.TxOptions) (gorm.ConnPool, error) {
	tx, err := pool.ConnPool.(gorm.TxBeginner).BeginTx(ctx, opts)
	if err != nil {
		return nil, err
	}
	return &delayedCommitTx{Tx: tx, release: pool.release, finished: pool.finished}, nil
}

type delayedCommitTx struct {
	*sql.Tx
	release    <-chan struct{}
	finished   chan error
	committing bool
}

func (tx *delayedCommitTx) Commit() error {
	tx.committing = true
	go func() {
		<-tx.release
		tx.finished <- tx.Tx.Commit()
	}()
	return errors.New("COMMIT response lost before server completion")
}

func (tx *delayedCommitTx) Rollback() error {
	if tx.committing {
		return sql.ErrTxDone
	}
	return tx.Tx.Rollback()
}

func testAccountingDelayedCommit(t *testing.T, db *gorm.DB, dialect string) {
	t.Helper()
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(4)
	defer sqlDB.SetMaxOpenConns(1)
	for _, existing := range []bool{false, true} {
		t.Run(map[bool]string{false: "first_batch", true: "existing_writer"}[existing], func(t *testing.T) {
			user := createReserveTestUser(t, 1000)
			writerID, batchID := common.GetRandomString(32), common.GetRandomString(32)
			if existing {
				require.NoError(t, db.Create(&BatchUpdateReceipt{ID: writerID, BatchID: "previous"}).Error)
			}
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			release, finished := make(chan struct{}), make(chan error, 1)
			var releaseOnce sync.Once
			defer releaseOnce.Do(func() { close(release) })
			first := db.Session(&gorm.Session{NewDB: true}).WithContext(ctx)
			first.Statement.ConnPool = delayedCommitPool{ConnPool: sqlDB, release: release, finished: finished}
			require.Error(t, applyAccountingBatch(first, writerID, batchID, func(tx *gorm.DB) error {
				return updateUserQuotaUsedQuotaAndRequestCount(tx, user.Id, -100, 100, 1)
			}))
			retry := db.Session(&gorm.Session{NewDB: true}).WithContext(ctx)
			if dialect != "sqlite" {
				conn, err := sqlDB.Conn(ctx)
				require.NoError(t, err)
				defer conn.Close()
				retry.Statement.ConnPool = conn
				var connectionID int64
				idQuery := "SELECT CONNECTION_ID()"
				if dialect == "postgres" {
					idQuery = "SELECT pg_backend_pid()"
				}
				require.NoError(t, conn.QueryRowContext(ctx, idQuery).Scan(&connectionID))
				done := make(chan error, 1)
				go func() {
					done <- applyAccountingBatch(retry, writerID, batchID, func(tx *gorm.DB) error {
						return updateUserQuotaUsedQuotaAndRequestCount(tx, user.Id, -100, 100, 1)
					})
				}()
				waitQuery := "SELECT COUNT(*) FROM information_schema.innodb_trx WHERE trx_mysql_thread_id = ? AND trx_state = 'LOCK WAIT'"
				if dialect == "postgres" {
					waitQuery = "SELECT COUNT(*) FROM pg_stat_activity WHERE pid = ? AND wait_event_type = 'Lock'"
				}
				// INNODB_TRX caches snapshots. Poll DB state, not elapsed time, and
				// space reads so MySQL can refresh a cached pre-wait snapshot.
				poll := time.NewTicker(200 * time.Millisecond)
				defer poll.Stop()
				for {
					select {
					case err := <-done:
						t.Fatalf("retry completed before old COMMIT: %v", err)
					case <-ctx.Done():
						t.Fatal("retry did not wait on the old transaction")
					case <-poll.C:
					}
					var waiting int64
					require.NoError(t, db.WithContext(ctx).Raw(waitQuery, connectionID).Scan(&waiting).Error)
					if waiting != 0 {
						break
					}
				}
				releaseOnce.Do(func() { close(release) })
				require.NoError(t, <-finished)
				require.NoError(t, <-done)
			} else {
				// SQLite has no FOR UPDATE. Cancel the retry at its write claim,
				// then retry the same identity after the original commit completes.
				entered := make(chan struct{})
				var once sync.Once
				canceled, stop := context.WithCancel(ctx)
				retry = retry.WithContext(canceled)
				const callback = "test:delayed_commit_sqlite"
				require.NoError(t, db.Callback().Create().Before("gorm:create").Register(callback, func(tx *gorm.DB) {
					if tx.Statement.Context == canceled && tx.Statement.Table == "batch_update_receipts" {
						once.Do(func() { close(entered) })
					}
				}))
				defer func() { _ = db.Callback().Create().Remove(callback) }()
				done := make(chan error, 1)
				go func() {
					done <- applyAccountingBatch(retry, writerID, batchID, func(tx *gorm.DB) error {
						return updateUserQuotaUsedQuotaAndRequestCount(tx, user.Id, -100, 100, 1)
					})
				}()
				select {
				case <-entered:
				case <-ctx.Done():
					t.Fatal("retry did not reach the writer claim")
				}
				stop()
				require.Error(t, <-done)
				releaseOnce.Do(func() { close(release) })
				require.NoError(t, <-finished)
			}
			require.NoError(t, applyAccountingBatch(db.WithContext(ctx), writerID, batchID, func(tx *gorm.DB) error {
				return updateUserQuotaUsedQuotaAndRequestCount(tx, user.Id, -100, 100, 1)
			}))
			var got User
			require.NoError(t, db.First(&got, user.Id).Error)
			assert.Equal(t, 900, got.Quota)
			assert.Equal(t, 100, got.UsedQuota)
			assert.Equal(t, 1, got.RequestCount)
			// Independent writers must not deduplicate one another.
			for _, identity := range []struct{ writer, batch string }{{common.GetRandomString(32), batchID}, {writerID, "next"}} {
				require.NoError(t, applyAccountingBatch(db.WithContext(ctx), identity.writer, identity.batch, func(tx *gorm.DB) error {
					return updateUserQuotaUsedQuotaAndRequestCount(tx, user.Id, -25, 25, 1)
				}))
			}
			require.NoError(t, db.First(&got, user.Id).Error)
			assert.Equal(t, 850, got.Quota)
			assert.Equal(t, 150, got.UsedQuota)
			assert.Equal(t, 3, got.RequestCount)
		})
	}
}
