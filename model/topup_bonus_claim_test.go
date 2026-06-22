package model

import (
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"

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

// TestClaimTopUpBonusFillsRemainingCapacityAfterPriorClaim 验证在已有部分占用时，
// 后续调用会接着占用剩余名额直到发满 limit，而不会因为「已有人领过」就误判超限少发。
// 这覆盖了 limit>1 的核心语义：容量内每一笔都应发放。
func TestClaimTopUpBonusFillsRemainingCapacityAfterPriorClaim(t *testing.T) {
	setupBonusClaimTestDB(t)
	// 预置 Seq=1（来自前一笔已成功的请求）。
	require.NoError(t, DB.Create(&TopUpBonusClaim{
		UserId: 21, Tier: 20, Seq: 1, BonusAmount: 5, TradeNo: "seed", CreatedTime: 1,
	}).Error)

	g2, err := claimTopUpBonusInTx(DB, 21, 20, 5, 3, "second")
	require.NoError(t, err)
	require.True(t, g2) // 已用1 < 3 → 发，拿到 Seq=2

	g3, err := claimTopUpBonusInTx(DB, 21, 20, 5, 3, "third")
	require.NoError(t, err)
	require.True(t, g3) // 已用2 < 3 → 发，拿到 Seq=3

	g4, err := claimTopUpBonusInTx(DB, 21, 20, 5, 3, "fourth")
	require.NoError(t, err)
	require.False(t, g4) // 已用3 == 3 → 名额满，不发

	var rows int64
	require.NoError(t, DB.Model(&TopUpBonusClaim{}).
		Where("user_id = ? AND tier = ?", 21, 20).Count(&rows).Error)
	require.Equal(t, int64(3), rows)
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

func TestGetTopUpBonusRemaining(t *testing.T) {
	setupBonusClaimTestDB(t)
	paymentSetting := operation_setting.GetPaymentSetting()
	originalLimit := paymentSetting.AmountBonusLimit
	t.Cleanup(func() { paymentSetting.AmountBonusLimit = originalLimit })
	// 档位 20 限 2 次、档位 50 限 1 次、档位 100 不限(0)。
	paymentSetting.AmountBonusLimit = map[int]int{20: 2, 50: 1, 100: 0}

	// 用户 40 已在档位 20 领过 1 次。
	require.NoError(t, DB.Create(&TopUpBonusClaim{
		UserId: 40, Tier: 20, Seq: 1, BonusAmount: 5, TradeNo: "r1", CreatedTime: 1,
	}).Error)

	remaining, err := GetTopUpBonusRemaining(40)
	require.NoError(t, err)
	require.Equal(t, 1, remaining[20]) // 限2已用1 → 剩1
	require.Equal(t, 1, remaining[50]) // 限1未用 → 剩1
	_, has100 := remaining[100]
	require.False(t, has100) // 不限次的档位不下发
}
