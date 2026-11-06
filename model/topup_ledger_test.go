package model

import (
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	gormmysql "gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// Minimal fixtures mirror the columns QueryTopUpLedger reads. They are created
// in a disposable database or schema so the test never touches real data.
type ledgerTestUser struct {
	Id        int    `gorm:"primaryKey"`
	Username  string `gorm:"size:64"`
	Email     string `gorm:"size:128"`
	DeletedAt gorm.DeletedAt
}

func (ledgerTestUser) TableName() string { return "users" }

type ledgerTestTopUp struct {
	Id              int `gorm:"primaryKey"`
	UserId          int `gorm:"index"`
	Amount          int64
	Money           float64
	TradeNo         string `gorm:"size:64;uniqueIndex"`
	PaymentMethod   string `gorm:"size:32"`
	PaymentProvider string `gorm:"size:32"`
	CreateTime      int64
	CompleteTime    int64
	Status          string `gorm:"size:16"`
}

func (ledgerTestTopUp) TableName() string { return "top_ups" }

// openLedgerTestDatabase returns a database isolated from every other test:
// in-memory SQLite, a fresh MySQL database, or a fresh PostgreSQL schema.
// MySQL and PostgreSQL require TEST_MYSQL_DSN / TEST_POSTGRES_DSN.
func openLedgerTestDatabase(t *testing.T, dialect string) *gorm.DB {
	t.Helper()
	switch dialect {
	case "sqlite":
		db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
		require.NoError(t, err)
		sqlDB, err := db.DB()
		require.NoError(t, err)
		sqlDB.SetMaxOpenConns(1)
		sqlDB.SetMaxIdleConns(1)
		t.Cleanup(func() { assert.NoError(t, sqlDB.Close()) })
		return db

	case "mysql":
		dsn := os.Getenv("TEST_MYSQL_DSN")
		if dsn == "" {
			t.Skip("TEST_MYSQL_DSN is not configured")
		}
		admin, err := gorm.Open(gormmysql.Open(dsn), &gorm.Config{})
		require.NoError(t, err)
		adminSQL, err := admin.DB()
		require.NoError(t, err)
		databaseName := fmt.Sprintf("topup_ledger_test_%d", time.Now().UnixNano())
		require.NoError(t, admin.Exec("CREATE DATABASE `"+databaseName+"`").Error)

		db, err := gorm.Open(gormmysql.Open(dsn), &gorm.Config{})
		require.NoError(t, err)
		sqlDB, err := db.DB()
		require.NoError(t, err)
		// A single pooled connection keeps USE scoped to this test's database.
		sqlDB.SetMaxOpenConns(1)
		sqlDB.SetMaxIdleConns(1)
		require.NoError(t, db.Exec("USE `"+databaseName+"`").Error)
		t.Cleanup(func() {
			assert.NoError(t, sqlDB.Close())
			assert.NoError(t, admin.Exec("DROP DATABASE IF EXISTS `"+databaseName+"`").Error)
			assert.NoError(t, adminSQL.Close())
		})
		return db

	case "postgres":
		dsn := os.Getenv("TEST_POSTGRES_DSN")
		if dsn == "" {
			t.Skip("TEST_POSTGRES_DSN is not configured")
		}
		db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
		require.NoError(t, err)
		sqlDB, err := db.DB()
		require.NoError(t, err)
		// A single pooled connection keeps search_path scoped to this test.
		sqlDB.SetMaxOpenConns(1)
		sqlDB.SetMaxIdleConns(1)
		schemaName := fmt.Sprintf("topup_ledger_test_%d", time.Now().UnixNano())
		require.NoError(t, db.Exec(`CREATE SCHEMA "`+schemaName+`"`).Error)
		require.NoError(t, db.Exec(`SET search_path TO "`+schemaName+`"`).Error)
		t.Cleanup(func() {
			assert.NoError(t, db.Exec(`DROP SCHEMA IF EXISTS "`+schemaName+`" CASCADE`).Error)
			assert.NoError(t, sqlDB.Close())
		})
		return db
	}

	require.FailNow(t, "unsupported database dialect", dialect)
	return nil
}

func TestQueryTopUpLedgerDatabaseMatrix(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			db := openLedgerTestDatabase(t, dialect)
			previousDB := DB
			DB = db
			t.Cleanup(func() { DB = previousDB })

			require.NoError(t, db.AutoMigrate(&ledgerTestUser{}, &ledgerTestTopUp{}))
			users := []ledgerTestUser{
				{Id: 1, Username: "alice", Email: "alice@example.com"},
				{Id: 2, Username: "bob", Email: "bob@example.com"},
				{Id: 3, Username: "carol", Email: "carol@example.com"},
			}
			topUps := []ledgerTestTopUp{
				{Id: 1, UserId: 1, Amount: 150, Money: 10.25, TradeNo: "TXN-ALPHA-001", PaymentMethod: "card", PaymentProvider: PaymentProviderStripe, CreateTime: 1000, CompleteTime: 1100, Status: common.TopUpStatusSuccess},
				{Id: 2, UserId: 2, Amount: 250, Money: 20.5, TradeNo: "TXN-BETA-002", PaymentMethod: "alipay", PaymentProvider: PaymentProviderEpay, CreateTime: 2000, CompleteTime: 0, Status: common.TopUpStatusPending},
				{Id: 3, UserId: 1, Amount: 350, Money: 30.75, TradeNo: "TXN-GAMMA-003", PaymentMethod: "card", PaymentProvider: PaymentProviderCreem, CreateTime: 3000, CompleteTime: 0, Status: common.TopUpStatusFailed},
				{Id: 4, UserId: 3, Amount: 450, Money: 40, TradeNo: "TXN-ALPHA-004", PaymentMethod: "wechat", PaymentProvider: PaymentProviderStripe, CreateTime: 4000, CompleteTime: 4100, Status: common.TopUpStatusSuccess},
			}
			require.NoError(t, db.Create(&users).Error)
			require.NoError(t, db.Create(&topUps).Error)

			queryLedger := func(t *testing.T, filter TopUpLedgerFilter, page, pageSize int) ([]TopUpLedgerEntry, int64) {
				t.Helper()
				entries, total, err := QueryTopUpLedger(filter, &common.PageInfo{Page: page, PageSize: pageSize})
				require.NoError(t, err)
				return entries, total
			}
			entryIDs := func(entries []TopUpLedgerEntry) []int {
				ids := make([]int, 0, len(entries))
				for _, entry := range entries {
					ids = append(ids, entry.Id)
				}
				return ids
			}

			t.Run("returns exact stored amounts and user identity", func(t *testing.T) {
				entries, total := queryLedger(t, TopUpLedgerFilter{}, 1, 10)
				require.EqualValues(t, 4, total)
				require.Len(t, entries, 4)
				assert.Equal(t, []int{4, 3, 2, 1}, entryIDs(entries))

				wantMoney := map[int]float64{1: 10.25, 2: 20.5, 3: 30.75, 4: 40}
				for _, entry := range entries {
					assert.Equal(t, int64(entry.Id*100+50), entry.Amount, "credited amount must be returned as stored")
					assert.Equal(t, wantMoney[entry.Id], entry.Money, "paid amount must be returned as stored")
				}
				assert.Equal(t, "carol", entries[0].Username)
				assert.Equal(t, "carol@example.com", entries[0].UserEmail)
				assert.Equal(t, "TXN-ALPHA-004", entries[0].TradeNo)
			})

			filterCases := []struct {
				name      string
				filter    TopUpLedgerFilter
				wantIDs   []int
				wantTotal int64
			}{
				{name: "date range is inclusive", filter: TopUpLedgerFilter{StartTime: 2000, EndTime: 3000}, wantIDs: []int{3, 2}, wantTotal: 2},
				{name: "status", filter: TopUpLedgerFilter{Status: common.TopUpStatusSuccess}, wantIDs: []int{4, 1}, wantTotal: 2},
				{name: "payment provider", filter: TopUpLedgerFilter{Provider: PaymentProviderStripe}, wantIDs: []int{4, 1}, wantTotal: 2},
				{name: "trade number keyword", filter: TopUpLedgerFilter{Keyword: "TXN-ALPHA"}, wantIDs: []int{4, 1}, wantTotal: 2},
				{name: "email keyword", filter: TopUpLedgerFilter{Keyword: "alice@example.com"}, wantIDs: []int{3, 1}, wantTotal: 2},
				{name: "numeric user id keyword", filter: TopUpLedgerFilter{Keyword: "2"}, wantIDs: []int{2}, wantTotal: 1},
				{name: "underscore is escaped, not a wildcard", filter: TopUpLedgerFilter{Keyword: "TXN_ALPHA"}, wantIDs: []int{}, wantTotal: 0},
			}
			for _, testCase := range filterCases {
				t.Run(testCase.name, func(t *testing.T) {
					entries, total := queryLedger(t, testCase.filter, 1, 10)
					assert.Equal(t, testCase.wantTotal, total)
					assert.Equal(t, testCase.wantIDs, entryIDs(entries))
				})
			}

			t.Run("paginates in the database", func(t *testing.T) {
				entries, total := queryLedger(t, TopUpLedgerFilter{}, 2, 2)
				require.EqualValues(t, 4, total)
				assert.Equal(t, []int{2, 1}, entryIDs(entries))

				entries, total = queryLedger(t, TopUpLedgerFilter{}, 3, 2)
				require.EqualValues(t, 4, total)
				assert.Empty(t, entries)
			})

			t.Run("rejects an inverted date range", func(t *testing.T) {
				_, _, err := QueryTopUpLedger(TopUpLedgerFilter{StartTime: 3000, EndTime: 2000}, &common.PageInfo{Page: 1, PageSize: 10})
				require.Error(t, err)
			})
		})
	}
}
