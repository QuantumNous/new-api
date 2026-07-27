package model

import (
	"errors"
	"fmt"
	"math"
	"path/filepath"
	"strings"
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

func countSubscriptionDiscountAccountsForTest(t *testing.T, userID int) int64 {
	t.Helper()
	var rows int64
	require.NoError(t, DB.Model(&SubscriptionDiscountAccount{}).Where("user_id = ?", userID).Count(&rows).Error)
	return rows
}

func countSubscriptionDiscountEntriesForUserTest(t *testing.T, userID int) int64 {
	t.Helper()
	var rows int64
	require.NoError(t, DB.Model(&SubscriptionDiscountEntry{}).Where("user_id = ?", userID).Count(&rows).Error)
	return rows
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

func TestSubscriptionDiscountDuplicateGlobalGrantKeyDoesNotCreateSecondAccount(t *testing.T) {
	setupSubscriptionDiscountCreditMemoryDB(t)

	require.True(t, grantSubscriptionDiscountForTest(t, 121, 500, "global-grant-key"))

	var changed bool
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		var err error
		changed, err = GrantSubscriptionDiscountTx(tx, SubscriptionDiscountGrantInput{
			UserID:         122,
			USDMinor:       100,
			EntryType:      SubscriptionDiscountEntryTypeGrantInvitee,
			SourceType:     "test",
			SourceKey:      "global-grant-key",
			IdempotencyKey: "global-grant-key",
		})
		return err
	}))
	require.False(t, changed)
	require.EqualValues(t, 0, countSubscriptionDiscountAccountsForTest(t, 122))
	require.Len(t, readSubscriptionDiscountEntries(t), 1)
}

func TestSubscriptionDiscountGrantRejectsAvailableOverflowWithoutMutation(t *testing.T) {
	setupSubscriptionDiscountCreditMemoryDB(t)

	require.True(t, grantSubscriptionDiscountForTest(t, 127, math.MaxInt64, "grant-max"))

	err := DB.Transaction(func(tx *gorm.DB) error {
		_, err := GrantSubscriptionDiscountTx(tx, SubscriptionDiscountGrantInput{
			UserID:         127,
			USDMinor:       1,
			EntryType:      SubscriptionDiscountEntryTypeGrantInvitee,
			SourceType:     "test",
			SourceKey:      "grant-overflow",
			IdempotencyKey: "grant-overflow",
		})
		return err
	})
	require.ErrorIs(t, err, ErrSubscriptionDiscountInvalidAmount)

	account, err := GetSubscriptionDiscountAccount(127)
	require.NoError(t, err)
	require.EqualValues(t, math.MaxInt64, account.AvailableUSDMinor)
	require.Zero(t, account.ReservedUSDMinor)
	require.EqualValues(t, 1, countSubscriptionDiscountEntriesForUserTest(t, 127))
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

func TestSubscriptionDiscountGrantRejectsInvalidEntryTypesWithoutMutation(t *testing.T) {
	for _, tc := range []struct {
		name      string
		entryType string
		valid     bool
	}{
		{name: "grant_invitee", entryType: SubscriptionDiscountEntryTypeGrantInvitee, valid: true},
		{name: "grant_inviter", entryType: SubscriptionDiscountEntryTypeGrantInviter, valid: true},
		{name: "migration", entryType: SubscriptionDiscountEntryTypeMigration, valid: true},
		{name: "empty", entryType: "", valid: false},
		{name: "reserve", entryType: SubscriptionDiscountEntryTypeReserve, valid: false},
		{name: "commit", entryType: SubscriptionDiscountEntryTypeCommit, valid: false},
		{name: "release", entryType: SubscriptionDiscountEntryTypeRelease, valid: false},
		{name: "arbitrary", entryType: "manual_adjustment", valid: false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			setupSubscriptionDiscountCreditMemoryDB(t)

			var changed bool
			err := DB.Transaction(func(tx *gorm.DB) error {
				var err error
				changed, err = GrantSubscriptionDiscountTx(tx, SubscriptionDiscountGrantInput{
					UserID:         123,
					USDMinor:       100,
					EntryType:      tc.entryType,
					SourceType:     "test",
					SourceKey:      "grant-type-" + tc.name,
					IdempotencyKey: "grant-type-" + tc.name,
				})
				return err
			})
			if tc.valid {
				require.NoError(t, err)
				require.True(t, changed)
				require.EqualValues(t, 1, countSubscriptionDiscountAccountsForTest(t, 123))
				require.Len(t, readSubscriptionDiscountEntries(t), 1)
				return
			}
			require.ErrorIs(t, err, ErrSubscriptionDiscountInvalidEntryType)
			require.False(t, changed)
			require.EqualValues(t, 0, countSubscriptionDiscountAccountsForTest(t, 123))
			require.Len(t, readSubscriptionDiscountEntries(t), 0)
		})
	}
}

func TestSubscriptionDiscountGrantNormalizesWhitespaceKeys(t *testing.T) {
	setupSubscriptionDiscountCreditMemoryDB(t)

	var changed bool
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		var err error
		changed, err = GrantSubscriptionDiscountTx(tx, SubscriptionDiscountGrantInput{
			UserID:         128,
			USDMinor:       100,
			EntryType:      SubscriptionDiscountEntryTypeGrantInvitee,
			SourceType:     "  test  ",
			SourceKey:      "  source-key  ",
			IdempotencyKey: "  canonical-key  ",
		})
		return err
	}))
	require.True(t, changed)

	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		var err error
		changed, err = GrantSubscriptionDiscountTx(tx, SubscriptionDiscountGrantInput{
			UserID:         128,
			USDMinor:       100,
			EntryType:      SubscriptionDiscountEntryTypeGrantInvitee,
			SourceType:     "test",
			SourceKey:      "source-key",
			IdempotencyKey: "canonical-key",
		})
		return err
	}))
	require.False(t, changed)

	entries := readSubscriptionDiscountEntries(t)
	require.Len(t, entries, 1)
	require.Equal(t, "test", entries[0].SourceType)
	require.Equal(t, "source-key", entries[0].SourceKey)
	require.Equal(t, "canonical-key", entries[0].IdempotencyKey)
}

func TestSubscriptionDiscountRejectsOverlongKeysBeforeMutation(t *testing.T) {
	for _, tc := range []struct {
		name string
		run  func(*gorm.DB) (bool, error)
	}{
		{
			name: "grant_idempotency",
			run: func(tx *gorm.DB) (bool, error) {
				return GrantSubscriptionDiscountTx(tx, SubscriptionDiscountGrantInput{
					UserID:         129,
					USDMinor:       100,
					EntryType:      SubscriptionDiscountEntryTypeGrantInvitee,
					SourceType:     "test",
					SourceKey:      "source-key",
					IdempotencyKey: strings.Repeat("i", 192),
				})
			},
		},
		{
			name: "grant_source_key",
			run: func(tx *gorm.DB) (bool, error) {
				return GrantSubscriptionDiscountTx(tx, SubscriptionDiscountGrantInput{
					UserID:         129,
					USDMinor:       100,
					EntryType:      SubscriptionDiscountEntryTypeGrantInvitee,
					SourceType:     "test",
					SourceKey:      strings.Repeat("s", 192),
					IdempotencyKey: "overlong-source-key",
				})
			},
		},
		{
			name: "reserve_key",
			run: func(tx *gorm.DB) (bool, error) {
				return ReserveSubscriptionDiscountTx(tx, SubscriptionDiscountReservationInput{
					UserID:             129,
					USDMinor:           100,
					OrderID:            1,
					TradeNo:            "trade-overlong-reserve",
					PaymentCurrency:    "USD",
					AppliedAmountMinor: 100,
					IdempotencyKey:     strings.Repeat("r", 192),
				})
			},
		},
		{
			name: "terminal_key",
			run: func(tx *gorm.DB) (bool, error) {
				return CommitSubscriptionDiscountTx(tx, strings.Repeat("t", 192))
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			setupSubscriptionDiscountCreditMemoryDB(t)

			var changed bool
			err := DB.Transaction(func(tx *gorm.DB) error {
				var err error
				changed, err = tc.run(tx)
				return err
			})
			require.ErrorIs(t, err, ErrSubscriptionDiscountInvalidReservation)
			require.False(t, changed)
			require.EqualValues(t, 0, countSubscriptionDiscountAccountsForTest(t, 129))
			require.Len(t, readSubscriptionDiscountEntries(t), 0)
		})
	}
}

func TestSubscriptionDiscountRejectsInvalidMetadataBeforeMutation(t *testing.T) {
	for _, tc := range []struct {
		name string
		run  func(*gorm.DB) (bool, error)
	}{
		{
			name: "blank_grant_source_type",
			run: func(tx *gorm.DB) (bool, error) {
				return GrantSubscriptionDiscountTx(tx, SubscriptionDiscountGrantInput{
					UserID:         130,
					USDMinor:       100,
					EntryType:      SubscriptionDiscountEntryTypeGrantInvitee,
					SourceType:     " ",
					SourceKey:      "source",
					IdempotencyKey: "blank-source-type",
				})
			},
		},
		{
			name: "overlong_grant_source_type",
			run: func(tx *gorm.DB) (bool, error) {
				return GrantSubscriptionDiscountTx(tx, SubscriptionDiscountGrantInput{
					UserID:         130,
					USDMinor:       100,
					EntryType:      SubscriptionDiscountEntryTypeGrantInvitee,
					SourceType:     strings.Repeat("s", 65),
					SourceKey:      "source",
					IdempotencyKey: "overlong-source-type",
				})
			},
		},
		{
			name: "blank_grant_source_key",
			run: func(tx *gorm.DB) (bool, error) {
				return GrantSubscriptionDiscountTx(tx, SubscriptionDiscountGrantInput{
					UserID:         130,
					USDMinor:       100,
					EntryType:      SubscriptionDiscountEntryTypeGrantInvitee,
					SourceType:     "test",
					SourceKey:      " ",
					IdempotencyKey: "blank-source-key",
				})
			},
		},
		{
			name: "invalid_grant_pricing_snapshot",
			run: func(tx *gorm.DB) (bool, error) {
				return GrantSubscriptionDiscountTx(tx, SubscriptionDiscountGrantInput{
					UserID:          130,
					USDMinor:        100,
					EntryType:       SubscriptionDiscountEntryTypeGrantInvitee,
					SourceType:      "test",
					SourceKey:       "invalid-grant-snapshot",
					IdempotencyKey:  "invalid-grant-snapshot",
					PricingSnapshot: "{invalid-json",
				})
			},
		},
		{
			name: "negative_order",
			run: func(tx *gorm.DB) (bool, error) {
				return ReserveSubscriptionDiscountTx(tx, SubscriptionDiscountReservationInput{
					UserID:             130,
					USDMinor:           100,
					OrderID:            -1,
					TradeNo:            "trade-negative-order",
					PaymentCurrency:    "USD",
					AppliedAmountMinor: 100,
					IdempotencyKey:     "negative-order",
				})
			},
		},
		{
			name: "negative_applied",
			run: func(tx *gorm.DB) (bool, error) {
				return ReserveSubscriptionDiscountTx(tx, SubscriptionDiscountReservationInput{
					UserID:             130,
					USDMinor:           100,
					OrderID:            1,
					TradeNo:            "trade-negative-applied",
					PaymentCurrency:    "USD",
					AppliedAmountMinor: -1,
					IdempotencyKey:     "negative-applied",
				})
			},
		},
		{
			name: "negative_expires",
			run: func(tx *gorm.DB) (bool, error) {
				return ReserveSubscriptionDiscountTx(tx, SubscriptionDiscountReservationInput{
					UserID:             130,
					USDMinor:           100,
					OrderID:            1,
					TradeNo:            "trade-negative-expires",
					PaymentCurrency:    "USD",
					AppliedAmountMinor: 100,
					ExpiresAt:          -1,
					IdempotencyKey:     "negative-expires",
				})
			},
		},
		{
			name: "blank_trade_no",
			run: func(tx *gorm.DB) (bool, error) {
				return ReserveSubscriptionDiscountTx(tx, SubscriptionDiscountReservationInput{
					UserID:             130,
					USDMinor:           100,
					OrderID:            1,
					TradeNo:            " ",
					PaymentCurrency:    "USD",
					AppliedAmountMinor: 100,
					IdempotencyKey:     "blank-trade",
				})
			},
		},
		{
			name: "overlong_trade_no",
			run: func(tx *gorm.DB) (bool, error) {
				return ReserveSubscriptionDiscountTx(tx, SubscriptionDiscountReservationInput{
					UserID:             130,
					USDMinor:           100,
					OrderID:            1,
					TradeNo:            strings.Repeat("t", 256),
					PaymentCurrency:    "USD",
					AppliedAmountMinor: 100,
					IdempotencyKey:     "overlong-trade",
				})
			},
		},
		{
			name: "bad_currency",
			run: func(tx *gorm.DB) (bool, error) {
				return ReserveSubscriptionDiscountTx(tx, SubscriptionDiscountReservationInput{
					UserID:             130,
					USDMinor:           100,
					OrderID:            1,
					TradeNo:            "trade-bad-currency",
					PaymentCurrency:    "US1",
					AppliedAmountMinor: 100,
					IdempotencyKey:     "bad-currency",
				})
			},
		},
		{
			name: "invalid_reserve_pricing_snapshot",
			run: func(tx *gorm.DB) (bool, error) {
				return ReserveSubscriptionDiscountTx(tx, SubscriptionDiscountReservationInput{
					UserID:             130,
					USDMinor:           100,
					OrderID:            1,
					TradeNo:            "trade-invalid-reserve-snapshot",
					PaymentCurrency:    "USD",
					AppliedAmountMinor: 100,
					IdempotencyKey:     "invalid-reserve-snapshot",
					PricingSnapshot:    "{invalid-json",
				})
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			setupSubscriptionDiscountCreditMemoryDB(t)

			var changed bool
			err := DB.Transaction(func(tx *gorm.DB) error {
				var err error
				changed, err = tc.run(tx)
				return err
			})
			require.ErrorIs(t, err, ErrSubscriptionDiscountInvalidReservation)
			require.False(t, changed)
			require.EqualValues(t, 0, countSubscriptionDiscountAccountsForTest(t, 130))
			require.Len(t, readSubscriptionDiscountEntries(t), 0)
		})
	}
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
			UserID:             105,
			USDMinor:           400,
			OrderID:            1,
			TradeNo:            "trade-reserve-too-much",
			PaymentCurrency:    "USD",
			AppliedAmountMinor: 400,
			IdempotencyKey:     "reserve-too-much",
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

func TestSubscriptionDiscountDuplicateGlobalReserveKeyDoesNotCreateSecondAccount(t *testing.T) {
	setupSubscriptionDiscountCreditMemoryDB(t)

	require.True(t, grantSubscriptionDiscountForTest(t, 124, 500, "grant-global-reserve"))
	require.True(t, reserveSubscriptionDiscountForTest(t, 124, 200, "global-reserve-key"))

	var changed bool
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		var err error
		changed, err = ReserveSubscriptionDiscountTx(tx, SubscriptionDiscountReservationInput{
			UserID:             125,
			USDMinor:           100,
			OrderID:            1,
			TradeNo:            "trade-global-reserve-key",
			PaymentCurrency:    "USD",
			AppliedAmountMinor: 100,
			IdempotencyKey:     "global-reserve-key",
		})
		return err
	}))
	require.False(t, changed)
	require.EqualValues(t, 0, countSubscriptionDiscountAccountsForTest(t, 125))
	require.Len(t, readSubscriptionDiscountEntries(t), 2)
}

func TestSubscriptionDiscountReserveRejectsReservedOverflowWithoutMutation(t *testing.T) {
	setupSubscriptionDiscountCreditMemoryDB(t)
	require.NoError(t, DB.Create(&SubscriptionDiscountAccount{
		UserID:            131,
		AvailableUSDMinor: 1000,
		ReservedUSDMinor:  math.MaxInt64,
		CreatedAt:         common.GetTimestamp(),
		UpdatedAt:         common.GetTimestamp(),
	}).Error)

	err := DB.Transaction(func(tx *gorm.DB) error {
		_, err := ReserveSubscriptionDiscountTx(tx, SubscriptionDiscountReservationInput{
			UserID:             131,
			USDMinor:           1,
			OrderID:            1,
			TradeNo:            "trade-reserved-overflow",
			PaymentCurrency:    "USD",
			AppliedAmountMinor: 1,
			IdempotencyKey:     "reserved-overflow",
		})
		return err
	})
	require.ErrorIs(t, err, ErrSubscriptionDiscountInvalidAccountState)

	account, err := GetSubscriptionDiscountAccount(131)
	require.NoError(t, err)
	require.EqualValues(t, 1000, account.AvailableUSDMinor)
	require.EqualValues(t, math.MaxInt64, account.ReservedUSDMinor)
	require.EqualValues(t, 0, countSubscriptionDiscountEntriesForUserTest(t, 131))
}

func TestSubscriptionDiscountReserveNormalizesMetadata(t *testing.T) {
	setupSubscriptionDiscountCreditMemoryDB(t)
	require.True(t, grantSubscriptionDiscountForTest(t, 132, 500, "grant-normalize-reserve"))

	var changed bool
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		var err error
		changed, err = ReserveSubscriptionDiscountTx(tx, SubscriptionDiscountReservationInput{
			UserID:             132,
			USDMinor:           100,
			OrderID:            1,
			TradeNo:            "  trade-normalized  ",
			PaymentCurrency:    " usd ",
			AppliedAmountMinor: 100,
			IdempotencyKey:     " reserve-normalized ",
		})
		return err
	}))
	require.True(t, changed)
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		var err error
		changed, err = ReserveSubscriptionDiscountTx(tx, SubscriptionDiscountReservationInput{
			UserID:             132,
			USDMinor:           100,
			OrderID:            1,
			TradeNo:            "trade-normalized",
			PaymentCurrency:    "USD",
			AppliedAmountMinor: 100,
			IdempotencyKey:     "reserve-normalized",
		})
		return err
	}))
	require.False(t, changed)

	entries := readSubscriptionDiscountEntries(t)
	require.Len(t, entries, 2)
	require.Equal(t, "reserve-normalized", entries[1].IdempotencyKey)
	require.Equal(t, "trade-normalized", entries[1].TradeNo)
	require.Equal(t, "USD", entries[1].PaymentCurrency)
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

func TestSubscriptionDiscountTerminalRejectsCorruptStatesWithoutEntry(t *testing.T) {
	t.Run("commit_underflow", func(t *testing.T) {
		setupSubscriptionDiscountCreditMemoryDB(t)
		require.True(t, grantSubscriptionDiscountForTest(t, 133, 500, "grant-commit-underflow"))
		require.True(t, reserveSubscriptionDiscountForTest(t, 133, 200, "reserve-commit-underflow"))
		require.NoError(t, DB.Model(&SubscriptionDiscountAccount{}).
			Where("user_id = ?", 133).
			Update("reserved_usd_minor", 0).Error)

		err := DB.Transaction(func(tx *gorm.DB) error {
			_, err := CommitSubscriptionDiscountTx(tx, "reserve-commit-underflow")
			return err
		})
		require.ErrorIs(t, err, ErrSubscriptionDiscountInvalidAccountState)
		require.EqualValues(t, 2, countSubscriptionDiscountEntriesForUserTest(t, 133))
	})

	t.Run("release_available_overflow", func(t *testing.T) {
		setupSubscriptionDiscountCreditMemoryDB(t)
		require.True(t, grantSubscriptionDiscountForTest(t, 134, 500, "grant-release-overflow"))
		require.True(t, reserveSubscriptionDiscountForTest(t, 134, 200, "reserve-release-overflow"))
		require.NoError(t, DB.Model(&SubscriptionDiscountAccount{}).
			Where("user_id = ?", 134).
			Updates(map[string]any{
				"available_usd_minor": math.MaxInt64,
				"reserved_usd_minor":  int64(200),
			}).Error)

		err := DB.Transaction(func(tx *gorm.DB) error {
			_, err := ReleaseSubscriptionDiscountTx(tx, "reserve-release-overflow")
			return err
		})
		require.ErrorIs(t, err, ErrSubscriptionDiscountInvalidAccountState)
		account, err := GetSubscriptionDiscountAccount(134)
		require.NoError(t, err)
		require.EqualValues(t, math.MaxInt64, account.AvailableUSDMinor)
		require.EqualValues(t, 200, account.ReservedUSDMinor)
		require.EqualValues(t, 2, countSubscriptionDiscountEntriesForUserTest(t, 134))
	})
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
	setupSubscriptionDiscountCreditTestDB(t, dbPath+"?_pragma=busy_timeout(10000)&_txlock=immediate", 2)
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
					UserID:             112,
					USDMinor:           400,
					OrderID:            i + 1,
					TradeNo:            fmt.Sprintf("trade-reserve-concurrent-%d", i),
					PaymentCurrency:    "USD",
					AppliedAmountMinor: 400,
					IdempotencyKey:     fmt.Sprintf("reserve-concurrent-%d", i),
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

func TestSubscriptionDiscountConcurrentCommitReleaseSingleWinner(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "subscription-discount-terminal.db")
	setupSubscriptionDiscountCreditTestDB(t, dbPath+"?_pragma=busy_timeout(10000)&_txlock=immediate", 2)
	require.True(t, grantSubscriptionDiscountForTest(t, 126, 500, "grant-terminal-concurrent"))
	require.True(t, reserveSubscriptionDiscountForTest(t, 126, 200, "reserve-terminal-concurrent"))

	start := make(chan struct{})
	results := make(chan struct {
		applied bool
		err     error
	}, 2)
	var wg sync.WaitGroup
	for _, fn := range []func(*gorm.DB, string) (bool, error){CommitSubscriptionDiscountTx, ReleaseSubscriptionDiscountTx} {
		fn := fn
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			var applied bool
			err := DB.Transaction(func(tx *gorm.DB) error {
				var err error
				applied, err = fn(tx, "reserve-terminal-concurrent")
				return err
			})
			results <- struct {
				applied bool
				err     error
			}{applied: applied, err: err}
		}()
	}
	close(start)
	wg.Wait()
	close(results)

	var applied, noops int
	for result := range results {
		require.NoError(t, result.err)
		if result.applied {
			applied++
		} else {
			noops++
		}
	}
	require.Equal(t, 1, applied)
	require.Equal(t, 1, noops)

	var terminals []SubscriptionDiscountEntry
	require.NoError(t, DB.Where("source_key = ? AND entry_type IN ?", "reserve-terminal-concurrent",
		[]string{SubscriptionDiscountEntryTypeCommit, SubscriptionDiscountEntryTypeRelease}).Find(&terminals).Error)
	require.Len(t, terminals, 1)
	require.NotNil(t, terminals[0].TerminalReservationKey)
	require.Equal(t, "reserve-terminal-concurrent", *terminals[0].TerminalReservationKey)

	account, err := GetSubscriptionDiscountAccount(126)
	require.NoError(t, err)
	switch terminals[0].EntryType {
	case SubscriptionDiscountEntryTypeCommit:
		require.EqualValues(t, 300, account.AvailableUSDMinor)
		require.Zero(t, account.ReservedUSDMinor)
	case SubscriptionDiscountEntryTypeRelease:
		require.EqualValues(t, 500, account.AvailableUSDMinor)
		require.Zero(t, account.ReservedUSDMinor)
	default:
		t.Fatalf("unexpected terminal entry type %q", terminals[0].EntryType)
	}
}
