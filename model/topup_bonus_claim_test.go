package model

import (
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupBonusClaimTestDB(t *testing.T) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&TopUpBonusClaim{}, &TopUp{}))
	originalDB := DB
	DB = db
	t.Cleanup(func() { DB = originalDB })
}

func TestClaimTopUpBonusUnlimitedAlwaysGrants(t *testing.T) {
	setupBonusClaimTestDB(t)
	for i := 0; i < 5; i++ {
		granted, err := claimTopUpBonusInTx(DB, 1, 20, 5, 0, "trade-unlimited")
		require.NoError(t, err)
		require.True(t, granted)
	}
}

func TestClaimTopUpBonusRejectsAfterLimit(t *testing.T) {
	setupBonusClaimTestDB(t)
	g1, err := claimTopUpBonusInTx(DB, 7, 20, 5, 2, "t1")
	require.NoError(t, err)
	require.True(t, g1)
	g2, err := claimTopUpBonusInTx(DB, 7, 20, 5, 2, "t2")
	require.NoError(t, err)
	require.True(t, g2)
	g3, err := claimTopUpBonusInTx(DB, 7, 20, 5, 2, "t3")
	require.NoError(t, err)
	require.False(t, g3)
}

func TestClaimTopUpBonusConcurrentSameSeqOnlyOneWins(t *testing.T) {
	setupBonusClaimTestDB(t)
	const n = 8
	var wg sync.WaitGroup
	results := make([]bool, n)
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			granted, err := claimTopUpBonusInTx(DB, 9, 20, 5, 1, "concurrent")
			if err == nil {
				results[idx] = granted
			}
		}(i)
	}
	wg.Wait()
	wins := 0
	for _, r := range results {
		if r {
			wins++
		}
	}
	require.Equal(t, 1, wins)
}

func TestApplyTopUpBonusGrantsWithinLimit(t *testing.T) {
	setupBonusClaimTestDB(t)
	tu := &TopUp{UserId: 30, BonusAmount: 5, BonusTier: 20, TradeNo: "x1"}
	require.NoError(t, DB.Create(tu).Error)
	err := DB.Transaction(func(tx *gorm.DB) error {
		extra, err := applyTopUpBonusInTx(tx, tu, 2)
		require.NoError(t, err)
		require.Equal(t, int64(5)*int64(common.QuotaPerUnit), extra)
		return nil
	})
	require.NoError(t, err)
}

func TestApplyTopUpBonusZeroWhenNoBonus(t *testing.T) {
	setupBonusClaimTestDB(t)
	tu := &TopUp{UserId: 31, BonusAmount: 0, BonusTier: 20, TradeNo: "x2"}
	require.NoError(t, DB.Create(tu).Error)
	err := DB.Transaction(func(tx *gorm.DB) error {
		extra, err := applyTopUpBonusInTx(tx, tu, 2)
		require.NoError(t, err)
		require.Equal(t, int64(0), extra)
		return nil
	})
	require.NoError(t, err)
}

func TestApplyTopUpBonusZerosOutWhenOverLimit(t *testing.T) {
	setupBonusClaimTestDB(t)
	tu1 := &TopUp{UserId: 32, BonusAmount: 5, BonusTier: 20, TradeNo: "y1"}
	require.NoError(t, DB.Create(tu1).Error)
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		_, err := applyTopUpBonusInTx(tx, tu1, 1)
		return err
	}))
	tu2 := &TopUp{UserId: 32, BonusAmount: 5, BonusTier: 20, TradeNo: "y2"}
	require.NoError(t, DB.Create(tu2).Error)
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		extra, err := applyTopUpBonusInTx(tx, tu2, 1)
		require.NoError(t, err)
		require.Equal(t, int64(0), extra)
		return nil
	}))
	require.Equal(t, int64(0), tu2.BonusAmount)
}
