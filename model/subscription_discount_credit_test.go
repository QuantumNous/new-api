package model

import (
	"errors"
	"fmt"
	"path/filepath"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupSubscriptionDiscountCreditTestDB(t *testing.T, dsn string, maxOpenConns int) {
	t.Helper()

	originalDB := DB
	originalLogDB := LOG_DB
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL

	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(maxOpenConns)
	sqlDB.SetMaxIdleConns(maxOpenConns)

	DB = db
	LOG_DB = db
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	initCol()
	require.NoError(t, DB.AutoMigrate(&SubscriptionDiscountAccount{}, &SubscriptionDiscountEntry{}))

	t.Cleanup(func() {
		require.NoError(t, sqlDB.Close())
		DB = originalDB
		LOG_DB = originalLogDB
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		initCol()
	})
}

func setupSubscriptionDiscountCreditMemoryDB(t *testing.T) {
	t.Helper()
	setupSubscriptionDiscountCreditTestDB(t, "file:"+t.Name()+"?mode=memory&cache=shared", 1)
}

func grantSubscriptionDiscountForTest(t *testing.T, userID int, amount int64, key string) bool {
	t.Helper()
	var changed bool
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		var err error
		changed, err = GrantSubscriptionDiscountTx(tx, SubscriptionDiscountGrantInput{
			UserID:          userID,
			USDMinor:        amount,
			EntryType:       SubscriptionDiscountEntryTypeGrantInvitee,
			SourceType:      "test",
			SourceKey:       key,
			IdempotencyKey:  key,
			PricingSnapshot: `{"source":"test"}`,
		})
		return err
	}))
	return changed
}

func reserveSubscriptionDiscountForTest(t *testing.T, userID int, amount int64, key string) bool {
	t.Helper()
	var changed bool
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		var err error
		changed, err = ReserveSubscriptionDiscountTx(tx, SubscriptionDiscountReservationInput{
			UserID:             userID,
			USDMinor:           amount,
			OrderID:            1001,
			TradeNo:            "trade-" + key,
			PaymentCurrency:    "USD",
			AppliedAmountMinor: amount,
			PricingSnapshot:    `{"plan":"basic"}`,
			IdempotencyKey:     key,
			ExpiresAt:          common.GetTimestamp() + 3600,
		})
		return err
	}))
	return changed
}

func readSubscriptionDiscountEntries(t *testing.T) []SubscriptionDiscountEntry {
	t.Helper()
	var entries []SubscriptionDiscountEntry
	require.NoError(t, DB.Order("id ASC").Find(&entries).Error)
	return entries
}

func TestSubscriptionDiscountGrantCreatesAccountAndImmutableEntry(t *testing.T) {
	setupSubscriptionDiscountCreditMemoryDB(t)

	changed := grantSubscriptionDiscountForTest(t, 101, 500, "grant-101")
	require.True(t, changed)

	account, err := GetSubscriptionDiscountAccount(101)
	require.NoError(t, err)
	require.Equal(t, 101, account.UserID)
	require.EqualValues(t, 500, account.AvailableUSDMinor)
	require.Zero(t, account.ReservedUSDMinor)
	require.NotZero(t, account.CreatedAt)
	require.NotZero(t, account.UpdatedAt)

	entries := readSubscriptionDiscountEntries(t)
	require.Len(t, entries, 1)
	require.Equal(t, SubscriptionDiscountEntryTypeGrantInvitee, entries[0].EntryType)
	require.EqualValues(t, 500, entries[0].AvailableDeltaUSDMinor)
	require.Zero(t, entries[0].ReservedDeltaUSDMinor)
	require.EqualValues(t, 500, entries[0].AvailableAfterUSDMinor)
	require.Zero(t, entries[0].ReservedAfterUSDMinor)
	require.Equal(t, "grant-101", entries[0].IdempotencyKey)
	require.Equal(t, `{"source":"test"}`, entries[0].PricingSnapshot)

	require.ErrorIs(t, DB.Model(&entries[0]).Update("source_type", "mutated").Error, ErrSubscriptionDiscountImmutableEntry)
	require.ErrorIs(t, DB.Delete(&entries[0]).Error, ErrSubscriptionDiscountImmutableEntry)
}

func TestSubscriptionDiscountDuplicateGrantIsIdempotent(t *testing.T) {
	setupSubscriptionDiscountCreditMemoryDB(t)

	require.True(t, grantSubscriptionDiscountForTest(t, 102, 500, "grant-dup"))
	require.False(t, grantSubscriptionDiscountForTest(t, 102, 500, "grant-dup"))

	account, err := GetSubscriptionDiscountAccount(102)
	require.NoError(t, err)
	require.EqualValues(t, 500, account.AvailableUSDMinor)
	require.Len(t, readSubscriptionDiscountEntries(t), 1)
}

func TestSubscriptionDiscountZeroGrantNoOpAndNegativeGrantRejected(t *testing.T) {
	setupSubscriptionDiscountCreditMemoryDB(t)

	var changed bool
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		var err error
		changed, err = GrantSubscriptionDiscountTx(tx, SubscriptionDiscountGrantInput{
			UserID:         103,
			USDMinor:       0,
			EntryType:      SubscriptionDiscountEntryTypeGrantInvitee,
			SourceType:     "test",
			SourceKey:      "zero",
			IdempotencyKey: "zero",
		})
		return err
	}))
	require.False(t, changed)

	err := DB.Transaction(func(tx *gorm.DB) error {
		_, err := GrantSubscriptionDiscountTx(tx, SubscriptionDiscountGrantInput{
			UserID:         103,
			USDMinor:       -1,
			EntryType:      SubscriptionDiscountEntryTypeGrantInvitee,
			SourceType:     "test",
			SourceKey:      "negative",
			IdempotencyKey: "negative",
		})
		return err
	})
	require.ErrorIs(t, err, ErrSubscriptionDiscountInvalidAmount)
	require.Len(t, readSubscriptionDiscountEntries(t), 0)
}

func TestSubscriptionDiscountReserveMovesAvailableToReserved(t *testing.T) {
	setupSubscriptionDiscountCreditMemoryDB(t)
	require.True(t, grantSubscriptionDiscountForTest(t, 104, 500, "grant-104"))

	require.True(t, reserveSubscriptionDiscountForTest(t, 104, 200, "reserve-104"))

	account, err := GetSubscriptionDiscountAccount(104)
	require.NoError(t, err)
	require.EqualValues(t, 300, account.AvailableUSDMinor)
	require.EqualValues(t, 200, account.ReservedUSDMinor)
	entries := readSubscriptionDiscountEntries(t)
	require.Len(t, entries, 2)
	require.Equal(t, SubscriptionDiscountEntryTypeReserve, entries[1].EntryType)
	require.EqualValues(t, -200, entries[1].AvailableDeltaUSDMinor)
	require.EqualValues(t, 200, entries[1].ReservedDeltaUSDMinor)
	require.EqualValues(t, 300, entries[1].AvailableAfterUSDMinor)
	require.EqualValues(t, 200, entries[1].ReservedAfterUSDMinor)
	require.Equal(t, 1001, entries[1].OrderID)
	require.Equal(t, "trade-reserve-104", entries[1].TradeNo)
	require.Equal(t, "USD", entries[1].PaymentCurrency)
	require.EqualValues(t, 200, entries[1].AppliedAmountMinor)
}

func TestSubscriptionDiscountInsufficientReserveRejectedWithoutMutation(t *testing.T) {
	setupSubscriptionDiscountCreditMemoryDB(t)
	require.True(t, grantSubscriptionDiscountForTest(t, 105, 300, "grant-105"))

	err := DB.Transaction(func(tx *gorm.DB) error {
		_, err := ReserveSubscriptionDiscountTx(tx, SubscriptionDiscountReservationInput{
			UserID:         105,
			USDMinor:       400,
			IdempotencyKey: "reserve-too-much",
		})
		return err
	})
	require.ErrorIs(t, err, ErrSubscriptionDiscountInsufficient)

	account, err := GetSubscriptionDiscountAccount(105)
	require.NoError(t, err)
	require.EqualValues(t, 300, account.AvailableUSDMinor)
	require.Zero(t, account.ReservedUSDMinor)
	require.Len(t, readSubscriptionDiscountEntries(t), 1)
}

func TestSubscriptionDiscountDuplicateReserveIsIdempotent(t *testing.T) {
	setupSubscriptionDiscountCreditMemoryDB(t)
	require.True(t, grantSubscriptionDiscountForTest(t, 106, 500, "grant-106"))

	require.True(t, reserveSubscriptionDiscountForTest(t, 106, 200, "reserve-dup"))
	require.False(t, reserveSubscriptionDiscountForTest(t, 106, 200, "reserve-dup"))

	account, err := GetSubscriptionDiscountAccount(106)
	require.NoError(t, err)
	require.EqualValues(t, 300, account.AvailableUSDMinor)
	require.EqualValues(t, 200, account.ReservedUSDMinor)
	require.Len(t, readSubscriptionDiscountEntries(t), 2)
}

func TestSubscriptionDiscountCommitConsumesReservedCredit(t *testing.T) {
	setupSubscriptionDiscountCreditMemoryDB(t)
	require.True(t, grantSubscriptionDiscountForTest(t, 107, 500, "grant-107"))
	require.True(t, reserveSubscriptionDiscountForTest(t, 107, 200, "reserve-commit"))

	var changed bool
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		var err error
		changed, err = CommitSubscriptionDiscountTx(tx, "reserve-commit")
		return err
	}))
	require.True(t, changed)

	account, err := GetSubscriptionDiscountAccount(107)
	require.NoError(t, err)
	require.EqualValues(t, 300, account.AvailableUSDMinor)
	require.Zero(t, account.ReservedUSDMinor)
	entries := readSubscriptionDiscountEntries(t)
	require.Len(t, entries, 3)
	require.Equal(t, SubscriptionDiscountEntryTypeCommit, entries[2].EntryType)
	require.Zero(t, entries[2].AvailableDeltaUSDMinor)
	require.EqualValues(t, -200, entries[2].ReservedDeltaUSDMinor)
	require.Equal(t, "reserve-commit", entries[2].SourceKey)
	require.Equal(t, "reserve-commit:commit", entries[2].IdempotencyKey)
}

func TestSubscriptionDiscountReleaseRestoresAvailableCredit(t *testing.T) {
	setupSubscriptionDiscountCreditMemoryDB(t)
	require.True(t, grantSubscriptionDiscountForTest(t, 108, 500, "grant-108"))
	require.True(t, reserveSubscriptionDiscountForTest(t, 108, 200, "reserve-release"))

	var changed bool
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		var err error
		changed, err = ReleaseSubscriptionDiscountTx(tx, "reserve-release")
		return err
	}))
	require.True(t, changed)

	account, err := GetSubscriptionDiscountAccount(108)
	require.NoError(t, err)
	require.EqualValues(t, 500, account.AvailableUSDMinor)
	require.Zero(t, account.ReservedUSDMinor)
	entries := readSubscriptionDiscountEntries(t)
	require.Len(t, entries, 3)
	require.Equal(t, SubscriptionDiscountEntryTypeRelease, entries[2].EntryType)
	require.EqualValues(t, 200, entries[2].AvailableDeltaUSDMinor)
	require.EqualValues(t, -200, entries[2].ReservedDeltaUSDMinor)
	require.Equal(t, "reserve-release", entries[2].SourceKey)
	require.Equal(t, "reserve-release:release", entries[2].IdempotencyKey)
}

func TestSubscriptionDiscountCommitReleaseMutualExclusionBothOrders(t *testing.T) {
	for _, tc := range []struct {
		name  string
		first func(*gorm.DB, string) (bool, error)
		next  func(*gorm.DB, string) (bool, error)
	}{
		{name: "commit_then_release", first: CommitSubscriptionDiscountTx, next: ReleaseSubscriptionDiscountTx},
		{name: "release_then_commit", first: ReleaseSubscriptionDiscountTx, next: CommitSubscriptionDiscountTx},
	} {
		t.Run(tc.name, func(t *testing.T) {
			setupSubscriptionDiscountCreditMemoryDB(t)
			require.True(t, grantSubscriptionDiscountForTest(t, 109, 500, "grant-"+tc.name))
			require.True(t, reserveSubscriptionDiscountForTest(t, 109, 200, "reserve-"+tc.name))

			require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
				changed, err := tc.first(tx, "reserve-"+tc.name)
				require.True(t, changed)
				return err
			}))
			require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
				changed, err := tc.first(tx, "reserve-"+tc.name)
				require.False(t, changed)
				return err
			}))
			require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
				changed, err := tc.next(tx, "reserve-"+tc.name)
				require.False(t, changed)
				return err
			}))

			require.Len(t, readSubscriptionDiscountEntries(t), 3)
		})
	}
}

func TestSubscriptionDiscountMissingAndInvalidReservationErrors(t *testing.T) {
	setupSubscriptionDiscountCreditMemoryDB(t)

	err := DB.Transaction(func(tx *gorm.DB) error {
		_, err := CommitSubscriptionDiscountTx(tx, "")
		return err
	})
	require.ErrorIs(t, err, ErrSubscriptionDiscountInvalidReservation)

	err = DB.Transaction(func(tx *gorm.DB) error {
		_, err := CommitSubscriptionDiscountTx(tx, "missing")
		return err
	})
	require.ErrorIs(t, err, ErrSubscriptionDiscountReservationNotFound)

	require.True(t, grantSubscriptionDiscountForTest(t, 110, 200, "grant-not-reserve"))
	err = DB.Transaction(func(tx *gorm.DB) error {
		_, err := CommitSubscriptionDiscountTx(tx, "grant-not-reserve")
		return err
	})
	require.ErrorIs(t, err, ErrSubscriptionDiscountInvalidReservation)
}

func TestSubscriptionDiscountMissingAccountReadsAsZeroWithoutCreatingRow(t *testing.T) {
	setupSubscriptionDiscountCreditMemoryDB(t)

	account, err := GetSubscriptionDiscountAccount(111)
	require.NoError(t, err)
	require.Equal(t, 111, account.UserID)
	require.Zero(t, account.AvailableUSDMinor)
	require.Zero(t, account.ReservedUSDMinor)

	var rows int64
	require.NoError(t, DB.Model(&SubscriptionDiscountAccount{}).Where("user_id = ?", 111).Count(&rows).Error)
	require.Zero(t, rows)

	_, err = GetSubscriptionDiscountAccount(0)
	require.ErrorIs(t, err, ErrSubscriptionDiscountInvalidAccountState)
}

func TestSubscriptionDiscountConcurrentSQLiteReservationsDoNotOverspend(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "subscription-discount.db")
	setupSubscriptionDiscountCreditTestDB(t, dbPath+"?_pragma=busy_timeout(10000)", 2)
	require.True(t, grantSubscriptionDiscountForTest(t, 112, 500, "grant-concurrent"))

	start := make(chan struct{})
	results := make(chan error, 2)
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		i := i
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			results <- DB.Transaction(func(tx *gorm.DB) error {
				changed, err := ReserveSubscriptionDiscountTx(tx, SubscriptionDiscountReservationInput{
					UserID:         112,
					USDMinor:       400,
					IdempotencyKey: fmt.Sprintf("reserve-concurrent-%d", i),
				})
				if err != nil {
					return err
				}
				if !changed {
					return errors.New("reservation unexpectedly idempotent")
				}
				return nil
			})
		}()
	}
	close(start)
	wg.Wait()
	close(results)

	var successes, insufficient int
	for err := range results {
		switch {
		case err == nil:
			successes++
		case errors.Is(err, ErrSubscriptionDiscountInsufficient):
			insufficient++
		default:
			t.Fatalf("unexpected reservation error: %v", err)
		}
	}
	require.Equal(t, 1, successes)
	require.Equal(t, 1, insufficient)

	account, err := GetSubscriptionDiscountAccount(112)
	require.NoError(t, err)
	require.EqualValues(t, 100, account.AvailableUSDMinor)
	require.EqualValues(t, 400, account.ReservedUSDMinor)
}
