package model

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

const invitationConcurrencyAttempts = 5

type invitationConsumeResult struct {
	userID int
	err    error
}

func useInvitationConcurrencyDB(t *testing.T, db *gorm.DB, databaseType common.DatabaseType) {
	t.Helper()

	oldDB, oldLogDB := DB, LOG_DB
	oldMainDatabaseType, oldLogDatabaseType := common.MainDatabaseType(), common.LogDatabaseType()
	DB, LOG_DB = db, db
	common.SetDatabaseTypes(databaseType, databaseType)

	t.Cleanup(func() {
		DB, LOG_DB = oldDB, oldLogDB
		common.SetDatabaseTypes(oldMainDatabaseType, oldLogDatabaseType)
	})
}

func configureInvitationConcurrencyPool(t *testing.T, db *gorm.DB) {
	t.Helper()

	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(invitationConcurrencyAttempts)
	sqlDB.SetMaxIdleConns(invitationConcurrencyAttempts)
}

func runInvitationCodeConcurrencyTest(t *testing.T, db *gorm.DB, databaseType common.DatabaseType) {
	t.Helper()

	useInvitationConcurrencyDB(t, db, databaseType)
	configureInvitationConcurrencyPool(t, db)
	require.NoError(t, db.AutoMigrate(&InvitationCode{}))

	codes, err := CreateInvitationCodes("concurrent", 1, 1, 0)
	require.NoError(t, err)
	require.Len(t, codes, 1)

	beginResults := make(chan invitationConsumeResult, invitationConcurrencyAttempts)
	start := make(chan struct{})
	results := make(chan invitationConsumeResult, invitationConcurrencyAttempts)
	for attempt := 0; attempt < invitationConcurrencyAttempts; attempt++ {
		userID := attempt + 1
		go func() {
			tx := db.Begin()
			beginResults <- invitationConsumeResult{userID: userID, err: tx.Error}
			if tx.Error != nil {
				results <- invitationConsumeResult{userID: userID, err: tx.Error}
				return
			}

			<-start
			_, consumeErr := ConsumeInvitationCodeWithTx(tx, codes[0], userID)
			if consumeErr != nil {
				rollbackErr := tx.Rollback().Error
				if rollbackErr != nil {
					consumeErr = fmt.Errorf("consume failed: %w; rollback failed: %v", consumeErr, rollbackErr)
				}
				results <- invitationConsumeResult{userID: userID, err: consumeErr}
				return
			}
			results <- invitationConsumeResult{userID: userID, err: tx.Commit().Error}
		}()
	}

	beginErrors := make([]error, 0)
	for attempt := 0; attempt < invitationConcurrencyAttempts; attempt++ {
		if result := <-beginResults; result.err != nil {
			beginErrors = append(beginErrors, fmt.Errorf("user %d failed to begin transaction: %w", result.userID, result.err))
		}
	}
	close(start)

	successCount := 0
	winnerUserID := 0
	for attempt := 0; attempt < invitationConcurrencyAttempts; attempt++ {
		result := <-results
		if result.err == nil {
			successCount++
			winnerUserID = result.userID
			continue
		}
		assert.True(t, errors.Is(result.err, ErrInvitationCodeUsed), "unexpected loser error: %v", result.err)
	}
	require.Empty(t, beginErrors, "all attempts must begin independent transactions before the concurrency barrier opens")
	require.Equal(t, 1, successCount)

	var stored InvitationCode
	require.NoError(t, db.Where("code_hash = ?", HashInvitationCode(codes[0])).First(&stored).Error)
	assert.Equal(t, common.InvitationCodeStatusUsed, stored.Status)
	assert.Equal(t, winnerUserID, stored.UsedUserId)
	assert.NotZero(t, stored.UsedTime)
}

func runSQLiteInvitationCodeConcurrencyTest(t *testing.T, db *gorm.DB) {
	t.Helper()

	useInvitationConcurrencyDB(t, db, common.DatabaseTypeSQLite)
	configureInvitationConcurrencyPool(t, db)
	require.NoError(t, db.AutoMigrate(&InvitationCode{}))

	codes, err := CreateInvitationCodes("concurrent", 1, 1, 0)
	require.NoError(t, err)
	require.Len(t, codes, 1)

	start := make(chan struct{})
	results := make(chan invitationConsumeResult, invitationConcurrencyAttempts)
	for attempt := 0; attempt < invitationConcurrencyAttempts; attempt++ {
		userID := attempt + 1
		go func() {
			<-start
			err := db.Transaction(func(tx *gorm.DB) error {
				_, consumeErr := ConsumeInvitationCodeWithTx(tx, codes[0], userID)
				return consumeErr
			})
			results <- invitationConsumeResult{userID: userID, err: err}
		}()
	}
	close(start)

	successCount := 0
	winnerUserID := 0
	for attempt := 0; attempt < invitationConcurrencyAttempts; attempt++ {
		result := <-results
		if result.err == nil {
			successCount++
			winnerUserID = result.userID
			continue
		}
		require.ErrorIs(t, result.err, ErrInvitationCodeUsed)
		assert.False(t, IsSQLiteBusyError(result.err), "SQLite contention leaked instead of resolving to a business error: %v", result.err)
	}
	require.Equal(t, 1, successCount)

	var stored InvitationCode
	require.NoError(t, db.Where("code_hash = ?", HashInvitationCode(codes[0])).First(&stored).Error)
	assert.Equal(t, common.InvitationCodeStatusUsed, stored.Status)
	assert.Equal(t, winnerUserID, stored.UsedUserId)
	assert.NotZero(t, stored.UsedTime)
}

func TestConsumeInvitationCodeWithTxConcurrentSQLiteSingleSuccess(t *testing.T) {
	dsn := filepath.Join(t.TempDir(), "invitation-concurrency.db") + "?_pragma=busy_timeout(30000)&_txlock=immediate"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, sqlDB.Close())
	})

	runSQLiteInvitationCodeConcurrencyTest(t, db)
}

func openInvitationConcurrencyExternalDB(t *testing.T, databaseType common.DatabaseType, dsn string) *gorm.DB {
	t.Helper()

	var (
		db  *gorm.DB
		err error
	)
	switch databaseType {
	case common.DatabaseTypeMySQL:
		db, err = gorm.Open(mysql.Open(dsn), &gorm.Config{})
	case common.DatabaseTypePostgreSQL:
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	default:
		t.Fatalf("unsupported invitation concurrency database type %q", databaseType)
	}
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)

	if db.Migrator().HasTable(&InvitationCode{}) {
		_ = sqlDB.Close()
		t.Skipf("refusing to run invitation concurrency test because %s already has an invitation_codes table", databaseType)
	}
	t.Cleanup(func() {
		require.NoError(t, sqlDB.Close())
	})
	t.Cleanup(func() {
		if db.Migrator().HasTable(&InvitationCode{}) {
			require.NoError(t, db.Migrator().DropTable(&InvitationCode{}))
		}
	})
	return db
}

func TestConsumeInvitationCodeWithTxConcurrentMySQL(t *testing.T) {
	dsn := os.Getenv("TEST_MYSQL_DSN")
	if dsn == "" {
		t.Skip("set TEST_MYSQL_DSN to run the MySQL invitation concurrency test")
	}

	db := openInvitationConcurrencyExternalDB(t, common.DatabaseTypeMySQL, dsn)
	runInvitationCodeConcurrencyTest(t, db, common.DatabaseTypeMySQL)
}

func TestConsumeInvitationCodeWithTxConcurrentPostgreSQL(t *testing.T) {
	dsn := os.Getenv("TEST_POSTGRES_DSN")
	if dsn == "" {
		t.Skip("set TEST_POSTGRES_DSN to run the PostgreSQL invitation concurrency test")
	}

	db := openInvitationConcurrencyExternalDB(t, common.DatabaseTypePostgreSQL, dsn)
	runInvitationCodeConcurrencyTest(t, db, common.DatabaseTypePostgreSQL)
}
