package model

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/glebarez/sqlite"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupCashbackTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	oldDB, oldLogDB := DB, LOG_DB
	oldType := common.MainDatabaseType()
	oldRedis := common.RedisEnabled
	oldPayment := *operation_setting.GetPaymentSetting()
	oldCashback := *operation_setting.GetCashbackSetting()
	common.OptionMapRWMutex.Lock()
	oldOptionMap := common.OptionMap
	common.OptionMap = make(map[string]string)
	common.OptionMapRWMutex.Unlock()

	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&User{}, &UserSession{}, &TopUp{}, &EpayPaymentEvidence{}, &AdminQuotaCreditEvidence{}, &WalletRefundCreditEvent{}, &Redemption{}, &Checkin{}, &Option{}, &CashbackCampaign{}, &CashbackOrderContext{}, &CashbackReward{}, &CashbackDeviceLink{}, &CashbackQuotaMutation{}, &Log{},
	))
	DB, LOG_DB = db, db
	resetCashbackReconciliationProgress()
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	payment := operation_setting.GetPaymentSetting()
	payment.ComplianceConfirmed = true
	payment.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion

	t.Cleanup(func() {
		resetCashbackReconciliationProgress()
		DB, LOG_DB = oldDB, oldLogDB
		common.SetMainDatabaseType(oldType)
		common.RedisEnabled = oldRedis
		*operation_setting.GetPaymentSetting() = oldPayment
		*operation_setting.GetCashbackSetting() = oldCashback
		common.OptionMapRWMutex.Lock()
		common.OptionMap = oldOptionMap
		common.OptionMapRWMutex.Unlock()
		sqlDB, sqlErr := db.DB()
		if sqlErr == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

// Older fixtures use quota as face value; provider-specific conversion is
// tested separately with an explicit order-time basis.
func insertCashbackTestTopUp(topUp *TopUp, baseQuota int, metadata CashbackRequestMetadata) error {
	if metadata.FaceAmount == 0 {
		metadata.FaceAmount = int64(baseQuota)
		metadata.QuotaPerFaceUnit = "1"
	}
	return InsertOnlineTopUp(topUp, baseQuota, metadata)
}

func epayTestDetails(tradeNo string) EpayVerifiedDetails {
	return EpayVerifiedDetails{GatewayTradeNo: "gateway-" + tradeNo, MerchantID: "merchant"}
}

func saveCashbackTestSetting(t *testing.T, firstEnabledAt int64) operation_setting.CashbackSetting {
	t.Helper()
	setting := operation_setting.DefaultCashbackSetting()
	setting.InviterEnabled = true
	setting.InviteeEnabled = true
	setting.InviterRateBPS = 1_000
	setting.InviteeRateBPS = 500
	setting.MaxRewardQuota = 1_000_000
	setting.DailyRewardQuota = 2_000_000
	setting.FirstEnabledAt = firstEnabledAt
	setting.Version = 3
	require.NoError(t, operation_setting.ValidateCashbackSetting(setting, true))
	require.NoError(t, SaveCashbackSetting(setting))
	// Existing reward fixtures explicitly opt into one bounded campaign.
	// Tests for absent/stopped campaigns create their own orders separately.
	require.NoError(t, DB.Create(&CashbackCampaign{StartAt: firstEnabledAt, EndAt: time.Now().Unix() + 365*24*60*60, MaxRewardsPerUser: 100_000, CreatedBy: 1}).Error)
	return setting
}

func createCashbackUsers(t *testing.T, createdAt int64) (User, User) {
	t.Helper()
	inviter := User{Username: "cashback-inviter", Password: "password", AffCode: "inviter-code", Status: common.UserStatusEnabled, Role: common.RoleCommonUser, CreatedAt: createdAt}
	require.NoError(t, DB.Create(&inviter).Error)
	invitee := User{Username: "cashback-invitee", Password: "password", AffCode: "invitee-code", InviterId: inviter.Id, Status: common.UserStatusEnabled, Role: common.RoleCommonUser, CreatedAt: createdAt}
	require.NoError(t, DB.Create(&invitee).Error)
	return inviter, invitee
}

func createCompletedCashbackTopUp(t *testing.T, invitee User, createTime, completeTime int64, baseQuota, creditedQuota int, basis ...CashbackRequestMetadata) TopUp {
	t.Helper()
	validSignal := "v1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	topUp := TopUp{
		UserId: invitee.Id, Amount: int64(baseQuota), Money: 1, TradeNo: "cashback-order-" + time.Unix(createTime, 0).Format("150405"),
		PaymentMethod: PaymentMethodWaffo, PaymentProvider: PaymentProviderWaffo, CreateTime: createTime, Status: common.TopUpStatusPending,
	}
	metadata := CashbackRequestMetadata{RequestIP: "203.0.113.10", UserAgent: "cashback-test-agent", DeviceSignal: validSignal}
	if len(basis) > 0 {
		metadata.FaceAmount = basis[0].FaceAmount
		metadata.QuotaPerFaceUnit = basis[0].QuotaPerFaceUnit
	}
	require.NoError(t, insertCashbackTestTopUp(&topUp, baseQuota, metadata))
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		var locked TopUp
		if err := lockForUpdate(tx).First(&locked, topUp.Id).Error; err != nil {
			return err
		}
		locked.Status = common.TopUpStatusSuccess
		locked.CompleteTime = completeTime
		if err := tx.Save(&locked).Error; err != nil {
			return err
		}
		if err := creditTopUpQuota(tx, invitee.Id, creditedQuota, nil); err != nil {
			return err
		}
		return CompleteTopUpCashbackTx(tx, &locked, creditedQuota, CashbackCompletionProviderCallback)
	}))
	return topUp
}

func TestCashbackTieredPaymentUsesHighestOrderFaceTierAndPreservesAudit(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	_, payer := createCashbackUsers(t, now-86400)
	setting := saveCashbackTestSetting(t, now-300)
	setting.InviterStrategy = operation_setting.CashbackStrategyTiered
	setting.InviterTiers = []operation_setting.CashbackTier{{ThresholdCents: 10050, RewardCents: 250}, {ThresholdCents: 20000, RewardCents: 1500}, {ThresholdCents: 50000, RewardCents: 4000}}
	setting.InviteeStrategy = operation_setting.CashbackStrategyTiered
	setting.InviteeTiers = []operation_setting.CashbackTier{{ThresholdCents: 10000, RewardCents: 100}, {ThresholdCents: 20000, RewardCents: 500}}
	setting.MaxRewardQuota = common.MaxWalletQuota
	setting.DailyRewardQuota = common.MaxWalletQuota
	require.NoError(t, operation_setting.ValidateCashbackSetting(setting, true))
	require.NoError(t, SaveCashbackSetting(setting))

	for index, tc := range []struct {
		face           int64
		inviter, payer int
	}{
		{50, 0, 0}, {100, 0, 500000}, {101, 1250000, 500000},
		{199, 1250000, 500000}, {200, 7500000, 2500000},
		{500, 20000000, 2500000}, {1000, 20000000, 2500000},
	} {
		base := int(tc.face * 500000)
		order := createCompletedCashbackTopUp(t, payer, now-200+int64(index), now-20+int64(index), base, base,
			CashbackRequestMetadata{FaceAmount: tc.face, QuotaPerFaceUnit: "500000"})
		var rewards []CashbackReward
		require.NoError(t, DB.Where("top_up_id = ?", order.Id).Order("direction").Find(&rewards).Error)
		require.Len(t, rewards, 2)
		assert.Equal(t, tc.payer, rewards[0].CalculatedQuota)
		assert.Equal(t, tc.inviter, rewards[1].CalculatedQuota)
		for _, reward := range rewards {
			assert.Equal(t, operation_setting.CashbackStrategyTiered, reward.Strategy)
			assert.Zero(t, reward.RateBPS)
			assert.Zero(t, reward.FixedPerHundred)
			assert.Contains(t, reward.ConfigSnapshot, `"inviter_tiers"`)
			if reward.CalculatedQuota == 0 {
				assert.Equal(t, CashbackSettlementCanceled, reward.SettlementStatus)
				assert.Contains(t, reward.CapReason, "below_minimum")
			}
		}
		if index == 0 {
			items, count, err := ListCashbackRewards(CashbackRewardFilter{}, &common.PageInfo{Page: 1, PageSize: 10})
			require.NoError(t, err)
			assert.Empty(t, items)
			assert.Zero(t, count)
		}
	}
	setting.InviterTiers = []operation_setting.CashbackTier{{ThresholdCents: 10000, RewardCents: 1}}
	require.NoError(t, SaveCashbackSetting(setting))
	var historical CashbackReward
	require.NoError(t, DB.Where("direction = ?", CashbackDirectionInviter).Order("id asc").First(&historical).Error)
	assert.Contains(t, historical.ConfigSnapshot, `"reward_cents":250`)
}

func TestCashbackTieredUnsupportedFaceDoesNotGrantOrGuess(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	_, payer := createCashbackUsers(t, now-86400)
	setting := saveCashbackTestSetting(t, now-300)
	setting.InviteeEnabled = false
	setting.InviterStrategy = operation_setting.CashbackStrategyTiered
	setting.InviterTiers = []operation_setting.CashbackTier{{ThresholdCents: 100, RewardCents: 10}}
	require.NoError(t, SaveCashbackSetting(setting))
	for index, tc := range []struct {
		provider, method, factor, reason string
		face, base                       int64
		missing                          bool
	}{
		{PaymentProviderWaffo, PaymentMethodWaffo, "1", "strategy_not_applicable", 100, 100, false},             // token face
		{PaymentProviderCreem, PaymentMethodCreem, "500000", "strategy_not_applicable", 100, 50_000_000, false}, // provider excluded even with a CNY-like factor
		{PaymentProviderWaffo, PaymentMethodWaffo, "500000", "face_basis_unavailable", 100, 50_000_000, true},   // legacy missing snapshot
	} {
		order := TopUp{UserId: payer.Id, Amount: tc.face, TradeNo: fmt.Sprintf("tier-unsupported-%d", index), PaymentMethod: tc.method, PaymentProvider: tc.provider, CreateTime: now - 100 + int64(index), Status: common.TopUpStatusPending}
		require.NoError(t, InsertOnlineTopUp(&order, int(tc.base), CashbackRequestMetadata{FaceAmount: tc.face, QuotaPerFaceUnit: tc.factor}))
		if tc.missing {
			require.NoError(t, DB.Session(&gorm.Session{SkipHooks: true}).Model(&CashbackOrderContext{}).Where("top_up_id = ?", order.Id).
				Updates(map[string]any{"face_amount": 0, "quota_per_face_unit": ""}).Error)
		}
		require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
			order.Status = common.TopUpStatusSuccess
			order.CompleteTime = now - 10 + int64(index)
			if err := tx.Save(&order).Error; err != nil {
				return err
			}
			return CompleteTopUpCashbackTx(tx, &order, 100, CashbackCompletionProviderCallback)
		}))
		var reward CashbackReward
		require.NoError(t, DB.Where("top_up_id = ?", order.Id).First(&reward).Error)
		assert.Zero(t, reward.RewardQuota)
		assert.Equal(t, CashbackSettlementCanceled, reward.SettlementStatus)
		assert.Equal(t, tc.reason, reward.CapReason)
	}
}

func TestCashbackFixedPerHundredUsesOrderFaceAndPaymentTimeConfig(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	_, payer := createCashbackUsers(t, now-86400)
	setting := saveCashbackTestSetting(t, now-300)
	setting.InviterStrategy = operation_setting.CashbackStrategyPerHundred
	setting.InviterFixedPerHundred = 20
	setting.InviteeStrategy = operation_setting.CashbackStrategyRate
	setting.InviteeRateBPS = 1000
	setting.MaxRewardQuota = common.MaxWalletQuota
	setting.DailyRewardQuota = common.MaxWalletQuota
	require.NoError(t, SaveCashbackSetting(setting))

	for index, tc := range []struct {
		face                     int64
		inviterQuota, payerQuota int
	}{
		{99, 0, 4_950_000}, {100, 10_000_000, 5_000_000},
		{250, 20_000_000, 12_500_000}, {60, 0, 3_000_000}, {40, 0, 2_000_000},
	} {
		base := int(tc.face * 500_000)
		order := createCompletedCashbackTopUp(t, payer, now-200+int64(index), now-20+int64(index), base, base,
			CashbackRequestMetadata{FaceAmount: tc.face, QuotaPerFaceUnit: "500000"})
		var rewards []CashbackReward
		require.NoError(t, DB.Where("top_up_id = ?", order.Id).Order("direction").Find(&rewards).Error)
		require.Len(t, rewards, 2)
		assert.Equal(t, tc.payerQuota, rewards[0].CalculatedQuota) // invitee sorts before inviter
		assert.Equal(t, tc.inviterQuota, rewards[1].CalculatedQuota)
		assert.Equal(t, operation_setting.CashbackStrategyPerHundred, rewards[1].Strategy)
		assert.Equal(t, 20, rewards[1].FixedPerHundred)
		assert.Zero(t, rewards[1].RateBPS)
		if tc.inviterQuota == 0 {
			assert.Equal(t, CashbackSettlementCanceled, rewards[1].SettlementStatus)
		}
		var context CashbackOrderContext
		require.NoError(t, DB.Where("top_up_id = ?", order.Id).First(&context).Error)
		assert.Equal(t, tc.face, context.FaceAmount)
		assert.Equal(t, "500000", context.QuotaPerFaceUnit)
	}
}

func TestCashbackFixedRewardUsesCheckoutFractionalConversionIndependentlyOfCurrentRate(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	_, payer := createCashbackUsers(t, now-86400)
	setting := saveCashbackTestSetting(t, now-300)
	setting.InviteeEnabled = false
	setting.InviterStrategy = operation_setting.CashbackStrategyPerHundred
	setting.InviterFixedPerHundred = 20
	setting.MaxRewardQuota = common.MaxWalletQuota
	setting.DailyRewardQuota = common.MaxWalletQuota
	require.NoError(t, SaveCashbackSetting(setting))

	originalFactor := common.QuotaPerUnit
	t.Cleanup(func() { common.QuotaPerUnit = originalFactor })
	common.QuotaPerUnit = 1
	order := createCompletedCashbackTopUp(t, payer, now-200, now-20, 50_000_051, 50_000_051,
		CashbackRequestMetadata{FaceAmount: 100, QuotaPerFaceUnit: "500000.51"})
	var reward CashbackReward
	require.NoError(t, DB.Where("top_up_id = ?", order.Id).First(&reward).Error)
	assert.Equal(t, 10_000_010, reward.CalculatedQuota)
	assert.Equal(t, 20, reward.FixedPerHundred)
}

func TestCashbackFixedRewardKeepsCapsAndVerifiedCallbackIdempotency(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	_, payer := createCashbackUsers(t, now-86400)
	setting := saveCashbackTestSetting(t, now-300)
	setting.InviteeEnabled = false
	setting.InviterStrategy = operation_setting.CashbackStrategyPerHundred
	setting.InviterFixedPerHundred = 20
	setting.MaxRewardQuota = 15_000_000
	setting.DailyRewardQuota = 25_000_000
	require.NoError(t, SaveCashbackSetting(setting))
	for index, expected := range []int{15_000_000, 10_000_000} {
		order := TopUp{UserId: payer.Id, Amount: 250, Money: 1,
			TradeNo: fmt.Sprintf("fixed-cap-%d", index), PaymentMethod: "alipay",
			PaymentProvider: PaymentProviderEpay, CreateTime: now - 200 + int64(index), Status: common.TopUpStatusPending}
		require.NoError(t, InsertOnlineTopUp(&order, 125_000_000,
			CashbackRequestMetadata{FaceAmount: 250, QuotaPerFaceUnit: "500000"}))
		proof := epayTestDetails(order.TradeNo)
		already, err := RechargeEpay(order.TradeNo, "alipay", "1.00", "127.0.0.1", proof)
		require.NoError(t, err)
		assert.False(t, already)
		already, err = RechargeEpay(order.TradeNo, "alipay", "1.00", "127.0.0.1", proof)
		require.NoError(t, err)
		assert.True(t, already)
		var rewards []CashbackReward
		require.NoError(t, DB.Where("top_up_id = ?", order.Id).Find(&rewards).Error)
		require.Len(t, rewards, 1)
		assert.Equal(t, 20_000_000, rewards[0].CalculatedQuota)
		assert.Equal(t, expected, rewards[0].RewardQuota)
	}
}

func TestCashbackFixedPaymentSwitchAndMissingLegacyFaceBasis(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	_, payer := createCashbackUsers(t, now-86400)
	setting := saveCashbackTestSetting(t, now-300)
	setting.InviteeEnabled = false
	require.NoError(t, SaveCashbackSetting(setting))
	for index, legacy := range []bool{false, true} {
		order := TopUp{UserId: payer.Id, Amount: 100, TradeNo: fmt.Sprintf("fixed-switch-%d", index),
			PaymentMethod: PaymentMethodWaffo, PaymentProvider: PaymentProviderWaffo, CreateTime: now - 200 + int64(index), Status: common.TopUpStatusPending}
		require.NoError(t, InsertOnlineTopUp(&order, 50_000_000,
			CashbackRequestMetadata{FaceAmount: 100, QuotaPerFaceUnit: "500000"}))
		if legacy {
			require.NoError(t, DB.Session(&gorm.Session{SkipHooks: true}).Model(&CashbackOrderContext{}).Where("top_up_id = ?", order.Id).
				Updates(map[string]any{"face_amount": 0, "quota_per_face_unit": ""}).Error)
		}
		var pendingContext CashbackOrderContext
		require.NoError(t, DB.Where("top_up_id = ?", order.Id).First(&pendingContext).Error)
		assert.Equal(t, legacy, pendingContext.FaceAmount == 0)
		setting.InviterStrategy = operation_setting.CashbackStrategyPerHundred
		setting.InviterFixedPerHundred = 10
		require.NoError(t, SaveCashbackSetting(setting))
		require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
			order.Status = common.TopUpStatusSuccess
			order.CompleteTime = now - 10 + int64(index)
			if err := tx.Save(&order).Error; err != nil {
				return err
			}
			if err := CompleteTopUpCashbackTx(tx, &order, 50_000_000, CashbackCompletionProviderCallback); err != nil {
				return fmt.Errorf("complete fixed cashback: %w", err)
			}
			return nil
		}))
		var reward CashbackReward
		require.NoError(t, DB.Where("top_up_id = ?", order.Id).First(&reward).Error)
		assert.Equal(t, operation_setting.CashbackStrategyPerHundred, reward.Strategy)
		assert.Equal(t, 10, reward.FixedPerHundred)
		if legacy {
			assert.Zero(t, reward.CalculatedQuota)
			assert.Equal(t, "face_basis_unavailable", reward.CapReason)
			assert.Contains(t, reward.RiskSnapshot, `"cap_reason":"face_basis_unavailable"`)
			assert.Equal(t, CashbackSettlementCanceled, reward.SettlementStatus)
		} else {
			assert.Equal(t, 5_000_000, reward.CalculatedQuota)
		}
		setting.InviterFixedPerHundred = 5
		require.NoError(t, SaveCashbackSetting(setting))
		var unchanged CashbackReward
		require.NoError(t, DB.First(&unchanged, reward.ID).Error)
		assert.Equal(t, reward.CalculatedQuota, unchanged.CalculatedQuota)
		assert.Equal(t, 10, unchanged.FixedPerHundred)
	}
}

func TestCashbackRecordedSpendReportsOnlyObservedIntervals(t *testing.T) {
	db := setupCashbackTestDB(t)
	user := User{Username: "report-payer", Password: "password", Status: common.UserStatusEnabled, Quota: 40}
	require.NoError(t, db.Create(&user).Error)
	for _, topUp := range []TopUp{
		{UserId: user.Id, Amount: 100, TradeNo: "report-old", CompleteTime: 110, Status: common.TopUpStatusSuccess, PaymentProvider: PaymentProviderEpay},
		{UserId: user.Id, Amount: 50, TradeNo: "report-new", CompleteTime: 150, Status: common.TopUpStatusSuccess, PaymentProvider: PaymentProviderStripe},
	} {
		require.NoError(t, db.Create(&topUp).Error)
	}
	// Subscription purchases insert zero-amount TopUp compatibility rows,
	// which are not wallet credits and cannot delimit recharge intervals.
	require.NoError(t, db.Create(&TopUp{UserId: user.Id, Amount: 0, TradeNo: "subscription-only", CompleteTime: 125, Status: common.TopUpStatusSuccess}).Error)
	for _, log := range []Log{
		{UserId: user.Id, Type: LogTypeConsume, CreatedAt: 109, Quota: 3},
		{UserId: user.Id, Type: LogTypeConsume, CreatedAt: 110, Quota: 25, Other: `{"billing_source":"subscription","wallet_quota_deducted":0}`},
		{UserId: user.Id, Type: LogTypeConsume, CreatedAt: 149, Quota: 5},
		{UserId: user.Id, Type: LogTypeConsume, CreatedAt: 150, Quota: 20},
		{UserId: user.Id, Type: LogTypeTopup, CreatedAt: 150, Quota: 100},
		{UserId: user.Id + 1, Type: LogTypeConsume, CreatedAt: 150, Quota: 80},
	} {
		require.NoError(t, db.Create(&log).Error)
	}

	report, err := GetCashbackRecordedSpendReport(user.Id, 100, 200)
	require.NoError(t, err)
	assert.Equal(t, "manual_reconciliation", report.RefundStatus)
	assert.Equal(t, "optional_log_db_consume", report.Source)
	// This is all observed consume-log quota, including subscription-funded usage;
	// the 25-unit row did not debit the user's wallet.
	assert.Equal(t, []CashbackRecordedSpendInterval{
		{StartAt: 100, EndAt: 110, RecordedAllConsumeLogQuota: 3, RecordedConsumeCount: 1},
		{StartAt: 110, EndAt: 150, RecordedAllConsumeLogQuota: 30, RecordedConsumeCount: 2},
		{StartAt: 150, EndAt: 200, RecordedAllConsumeLogQuota: 20, RecordedConsumeCount: 1},
	}, report.Intervals)
	assert.Len(t, report.TopUps, 2)

	// Missing consumption logs do not prove there was no spending and must
	// never cause the API to emit a fabricated FIFO remainder or cash quote.
	require.NoError(t, db.Where("type = ?", LogTypeConsume).Delete(&Log{}).Error)
	missing, err := GetCashbackRecordedSpendReport(user.Id, 100, 200)
	require.NoError(t, err)
	assert.Equal(t, "manual_reconciliation", missing.RefundStatus)
	for _, interval := range missing.Intervals {
		assert.Zero(t, interval.RecordedAllConsumeLogQuota)
		assert.Zero(t, interval.RecordedConsumeCount)
	}
	encoded, err := common.Marshal(missing)
	require.NoError(t, err)
	assert.Contains(t, string(encoded), "recorded_all_consume_log_quota")
	assert.NotContains(t, string(encoded), "recorded_spend_quota")
	assert.NotContains(t, string(encoded), "refund_amount")
	assert.NotContains(t, string(encoded), "remaining_purchase")
	var unchanged User
	require.NoError(t, db.First(&unchanged, user.Id).Error)
	assert.Equal(t, 40, unchanged.Quota)
}

func TestCashbackRecordedSpendBoundsAmbiguousAndExcessiveTopUps(t *testing.T) {
	setupCashbackTestDB(t)
	user := User{Username: "report-bound", Password: "password"}
	require.NoError(t, DB.Create(&user).Error)
	for i := range 2 {
		require.NoError(t, DB.Create(&TopUp{UserId: user.Id, TradeNo: fmt.Sprintf("same-second-%d", i), Amount: 1, Status: common.TopUpStatusSuccess, CompleteTime: 150}).Error)
	}
	// A log stamped 150 cannot be proven to follow either top-up.
	require.NoError(t, LOG_DB.Create(&Log{UserId: user.Id, Type: LogTypeConsume, CreatedAt: 150, Quota: 9}).Error)
	report, err := GetCashbackRecordedSpendReport(user.Id, 100, 200)
	require.NoError(t, err)
	assert.Equal(t, int64(150), report.Intervals[1].StartAt)
	assert.Equal(t, int64(150), report.Intervals[1].EndAt) // Same-second events have no provable order.
	assert.Zero(t, report.Intervals[1].RecordedAllConsumeLogQuota)
	assert.Equal(t, int64(9), report.Intervals[2].RecordedAllConsumeLogQuota) // Timestamp bucket, not proof of "after".
	for i := 2; i < 51; i++ {
		require.NoError(t, DB.Create(&TopUp{UserId: user.Id, TradeNo: fmt.Sprintf("over-limit-%d", i), Amount: 1, Status: common.TopUpStatusSuccess, CompleteTime: 160}).Error)
	}
	_, err = GetCashbackRecordedSpendReport(user.Id, 100, 200)
	assert.ErrorIs(t, err, ErrCashbackReportRange)
}

func TestCashbackRecordedSpendFailsClosedWhenLogDBUnavailable(t *testing.T) {
	t.Setenv("CASHBACK_REFUND_REFERENCE_ENABLED", "true")
	db := setupCashbackTestDB(t)
	mainSQL, err := db.DB()
	require.NoError(t, err)
	mainSQL.SetMaxOpenConns(1)
	user := User{Username: "report-separate-logs", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&user).Error)
	// These main-DB rows stand for an atomic registration opening, two verified
	// online credits and their signed Epay evidence; only ordinary net spending
	// is represented by the final settled wallet balance (150 granted, 75 left).
	require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
		return recordWalletRefundCreditTx(tx, user, walletRefundOpening, "registration", 0, 0, "")
	}))
	for _, item := range []struct {
		tradeNo     string
		completedAt int64
		quota       int64
		paidCents   int64
	}{
		{"report-old", 110, 100, 9000},
		{"report-new", 150, 50, 5000},
	} {
		order := TopUp{UserId: user.Id, Amount: item.quota, TradeNo: item.tradeNo, CompleteTime: item.completedAt, Status: common.TopUpStatusSuccess, PaymentProvider: PaymentProviderEpay}
		require.NoError(t, db.Create(&order).Error)
		require.NoError(t, db.Create(&CashbackOrderContext{TopUpID: order.Id, TradeNo: order.TradeNo, UserID: user.Id, PaymentProvider: PaymentProviderEpay, BaseQuota: int(item.quota), CreditedQuota: int(item.quota), DeviceSignalStatus: CashbackDeviceSignalMissing, CompletionSource: CashbackCompletionProviderCallback, CompletionProvider: PaymentProviderEpay}).Error)
		require.NoError(t, db.Create(&EpayPaymentEvidence{TopUpID: order.Id, TradeNo: order.TradeNo, GatewayTradeNo: "gateway-" + order.TradeNo, MerchantID: "merchant", PaidCents: item.paidCents, Source: CashbackCompletionProviderCallback, VerifiedAt: item.completedAt}).Error)
		require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
			return recordWalletRefundCreditTx(tx, user, walletRefundPurchase, "topup", int64(order.Id), item.quota, "")
		}))
	}
	require.NoError(t, db.Model(&User{}).Where("id = ?", user.Id).Update("quota", 75).Error)

	// A distinct in-memory SQLite database contains only Log. A conflicting
	// main-DB log makes accidental reads from DB observable.
	other, err := gorm.Open(sqlite.Open("file:"+t.Name()+"-logs?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, other.AutoMigrate(&Log{}))
	assert.False(t, other.Migrator().HasTable(&User{}))
	logSQL, err := other.DB()
	require.NoError(t, err)
	logSQL.SetMaxOpenConns(1)
	logDB := LOG_DB
	LOG_DB = other
	t.Cleanup(func() {
		LOG_DB = logDB
		_ = logSQL.Close()
	})
	require.NoError(t, db.Create(&Log{UserId: user.Id, Type: LogTypeConsume, CreatedAt: 120, Quota: 777}).Error)
	for _, log := range []Log{
		{UserId: user.Id, Type: LogTypeConsume, CreatedAt: 109, Quota: 3},
		{UserId: user.Id, Type: LogTypeConsume, CreatedAt: 110, Quota: 25},
		{UserId: user.Id, Type: LogTypeConsume, CreatedAt: 149, Quota: 5},
		{UserId: user.Id, Type: LogTypeConsume, CreatedAt: 150, Quota: 20},
		{UserId: user.Id, Type: LogTypeTopup, CreatedAt: 150, Quota: 999},
	} {
		require.NoError(t, other.Create(&log).Error)
	}
	var orders []TopUp
	require.NoError(t, db.Where("user_id = ? AND amount > 0", user.Id).Order("id").Find(&orders).Error)
	require.Len(t, orders, 2)
	report, err := GetCashbackRecordedSpendReport(user.Id, 100, 200, orders[0].Id, orders[1].Id)
	require.NoError(t, err) // Also proves no single-connection SQLite transaction deadlock.
	assert.Equal(t, "available", report.LogStatus)
	assert.Equal(t, []CashbackRecordedSpendInterval{
		{StartAt: 100, EndAt: 110, RecordedAllConsumeLogQuota: 3, RecordedConsumeCount: 1},
		{StartAt: 110, EndAt: 150, RecordedAllConsumeLogQuota: 30, RecordedConsumeCount: 2},
		{StartAt: 150, EndAt: 200, RecordedAllConsumeLogQuota: 20, RecordedConsumeCount: 1},
	}, report.Intervals)
	assert.Equal(t, "reference", report.RefundStatus)
	require.NotNil(t, report.WalletQuota)
	assert.EqualValues(t, 75, *report.WalletQuota) // Not the 53 logged units.
	require.NotNil(t, report.TotalReferenceCNYCents)
	assert.EqualValues(t, 7250, *report.TotalReferenceCNYCents)
	require.Len(t, report.TopUps, 2)
	require.NotNil(t, report.TopUps[0].RemainingPurchaseQuota)
	require.NotNil(t, report.TopUps[1].RemainingPurchaseQuota)
	assert.EqualValues(t, 25, *report.TopUps[0].RemainingPurchaseQuota)
	assert.EqualValues(t, 50, *report.TopUps[1].RemainingPurchaseQuota)

	// A failed independent LOG_DB query cannot become a zero-consumption
	// interval or erase the independently sourced FIFO/CNY reference.
	require.NoError(t, other.Migrator().DropTable(&Log{}))
	unavailable, err := GetCashbackRecordedSpendReport(user.Id, 100, 200, orders[0].Id, orders[1].Id)
	require.NoError(t, err)
	assert.Equal(t, "unavailable", unavailable.LogStatus)
	assert.Empty(t, unavailable.Intervals)
	assert.Equal(t, report.RefundStatus, unavailable.RefundStatus)
	assert.Equal(t, report.Credits, unavailable.Credits)
	assert.Equal(t, report.TotalReferenceCNYCents, unavailable.TotalReferenceCNYCents)
	_, err = GetCashbackRecordedSpendReport(user.Id, 100, 100)
	assert.ErrorIs(t, err, ErrCashbackReportRange)
}

func TestCashbackRefundReferenceFIFO(t *testing.T) {
	t.Setenv("CASHBACK_REFUND_REFERENCE_ENABLED", "true")
	type grant struct {
		kind   string
		quota  int64
		paid   int64
		parent int
	}
	for _, tc := range []struct {
		name         string
		grants       []grant
		balance      int64
		wantNetSpent int64
		wantPurchase []int64
		wantGift     []int64
		wantCents    int64
	}{
		{"old gift before new purchase", []grant{{"purchase", 100, 10000, 0}, {"gift", 10, 0, 0}, {"purchase", 50, 5000, 0}, {"gift", 5, 0, 1}}, 40, 125, []int64{0, 35}, []int64{0, 5}, 3500},
		{"both purchases remain", []grant{{"purchase", 100, 10000, 0}, {"gift", 10, 0, 0}, {"purchase", 50, 5000, 0}, {"gift", 5, 0, 1}}, 140, 25, []int64{75, 50}, []int64{10, 5}, 12500},
		{"gift credited late", []grant{{"purchase", 100, 10000, 0}, {"purchase", 50, 5000, 0}, {"gift", 10, 0, 0}}, 55, 105, []int64{0, 45}, []int64{10}, 4500},
		{"settled reservation netted", []grant{{"purchase", 100, 10000, 0}, {"purchase", 50, 5000, 0}}, 110, 40, []int64{60, 50}, nil, 11000},
		{"signed paid proration", []grant{{"purchase", 100, 9000, 0}}, 50, 50, []int64{50}, nil, 4500},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db := setupCashbackTestDB(t)
			now := time.Now().Unix()
			user := User{Username: "fifo-payer", Status: common.UserStatusEnabled}
			require.NoError(t, db.Create(&user).Error)
			var purchases []int
			for i, item := range tc.grants {
				var sourceType string
				var sourceID int64
				if item.kind == "purchase" {
					order := TopUp{UserId: user.Id, Amount: item.quota, TradeNo: fmt.Sprintf("fifo-%d", i), Status: common.TopUpStatusSuccess, PaymentProvider: PaymentProviderEpay, CompleteTime: now}
					require.NoError(t, db.Create(&order).Error)
					require.NoError(t, db.Create(&CashbackOrderContext{TopUpID: order.Id, TradeNo: order.TradeNo, UserID: user.Id, PaymentProvider: PaymentProviderEpay, BaseQuota: int(item.quota), CreditedQuota: int(item.quota), DeviceSignalStatus: CashbackDeviceSignalMissing, CompletionSource: CashbackCompletionProviderCallback, CompletionProvider: PaymentProviderEpay}).Error)
					require.NoError(t, db.Create(&EpayPaymentEvidence{TopUpID: order.Id, TradeNo: order.TradeNo, GatewayTradeNo: "gateway", MerchantID: "merchant", PaidCents: item.paid, Source: CashbackCompletionProviderCallback, VerifiedAt: now}).Error)
					purchases = append(purchases, order.Id)
					sourceType, sourceID = "topup", int64(order.Id)
				} else {
					var parent TopUp
					require.NoError(t, db.First(&parent, purchases[item.parent]).Error)
					reward := CashbackReward{TopUpID: parent.Id, TradeNo: parent.TradeNo, Direction: CashbackDirectionInvitee, InviteeID: user.Id, BeneficiaryID: user.Id, BaseQuota: 100, RateBPS: 1000, CalculatedQuota: int(item.quota), RewardQuota: int(item.quota), SettlementDays: 1, PaidAt: now, AvailableAt: now, ReviewStatus: CashbackReviewApproved, IssuedAt: now, SettlementStatus: CashbackSettlementIssued, RiskLevel: CashbackRiskLow, RiskSnapshot: `{}`, ConfigSnapshot: `{}`}
					require.NoError(t, db.Create(&reward).Error)
					sourceType, sourceID = "cashback_reward", reward.ID
				}
				require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
					return recordWalletRefundCreditTx(tx, user, map[string]string{"purchase": walletRefundPurchase, "gift": walletRefundGift}[item.kind], sourceType, sourceID, item.quota, "")
				}))
			}
			require.NoError(t, db.Model(&User{}).Where("id = ?", user.Id).Update("quota", tc.balance).Error)
			confirmed := purchases
			report, err := GetCashbackRecordedSpendReport(user.Id, now-50, now+1, confirmed...)
			require.NoError(t, err)
			assert.Equal(t, "reference", report.RefundStatus)
			require.NotNil(t, report.NetSpentQuota)
			assert.Equal(t, tc.wantNetSpent, *report.NetSpentQuota)
			require.NotNil(t, report.TotalReferenceCNYCents)
			assert.Equal(t, tc.wantCents, *report.TotalReferenceCNYCents)
			var gotPurchase, gotGift []int64
			for _, credit := range report.Credits {
				switch credit.Kind {
				case walletRefundPurchase:
					gotPurchase = append(gotPurchase, credit.RemainingQuota)
				case walletRefundGift:
					gotGift = append(gotGift, credit.RemainingQuota)
					assert.Nil(t, credit.ReferenceCNYCents)
				}
			}
			assert.Equal(t, tc.wantPurchase, gotPurchase)
			assert.Equal(t, tc.wantGift, gotGift)
			// Optional consumption logs never alter the final FIFO projection.
			require.NoError(t, db.Create(&Log{UserId: user.Id, Type: LogTypeConsume, CreatedAt: now - 10, Quota: 999}).Error)
			again, err := GetCashbackRecordedSpendReport(user.Id, now-50, now+1, confirmed...)
			require.NoError(t, err)
			assert.Equal(t, report.Credits, again.Credits)
			assert.Equal(t, report.TotalReferenceCNYCents, again.TotalReferenceCNYCents)
			require.NotEqual(t, report.Intervals, again.Intervals)
			var unchanged User
			require.NoError(t, db.First(&unchanged, user.Id).Error)
			assert.EqualValues(t, tc.balance, unchanged.Quota)
		})
	}
}

func TestCashbackRefundReferenceFailsClosedBeforeJavaScriptPrecisionLoss(t *testing.T) {
	t.Setenv("CASHBACK_REFUND_REFERENCE_ENABLED", "true")
	for _, tc := range []struct {
		name, reason          string
		quota, cents, balance int64
	}{
		{"net consumption", "javascript_precision_limit", 6_000_000_000_000_000, 100, 0},
		{"CNY total", "cash_amount_overflow", 100, 700_000_000_000_000, 200},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db := setupCashbackTestDB(t)
			user := User{Username: "precision-report", Status: common.UserStatusEnabled}
			require.NoError(t, db.Create(&user).Error)
			for i := range 2 {
				proof := AdminQuotaCreditEvidence{EventKey: fmt.Sprintf("%064d", i+1), UserID: int64(user.Id), OperatorID: 999, CreditedQuota: tc.quota, CNYCents: &tc.cents, CreditedAt: time.Now().Unix()}
				require.NoError(t, db.Create(&proof).Error)
				require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
					return recordWalletRefundCreditTx(tx, user, walletRefundPurchase, "admin_add", proof.ID, tc.quota, "")
				}))
			}
			require.NoError(t, db.Model(&User{}).Where("id = ?", user.Id).Update("quota", tc.balance).Error)
			now := time.Now().Unix()
			report, err := GetCashbackRecordedSpendReport(user.Id, now-60, now+1)
			require.NoError(t, err)
			assert.Equal(t, "manual_reconciliation", report.RefundStatus)
			assert.Equal(t, tc.reason, report.ManualReason)
			assert.Nil(t, report.TotalReferenceCNYCents)
			if tc.name == "net consumption" {
				assert.Nil(t, report.NetSpentQuota)
			} else {
				require.Len(t, report.Credits, 3)
				assert.Nil(t, report.Credits[1].ReferenceCNYCents)
			}
		})
	}
}

func TestCashbackRefundReferenceAdminAndWalletCode(t *testing.T) {
	t.Setenv("CASHBACK_REFUND_REFERENCE_ENABLED", "true")
	db := setupCashbackTestDB(t)
	user := User{Username: "fifo-admin-code", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&user).Error)
	firstCents, lastCents := int64(3000), int64(5000)
	_, err := AdjustUserQuota(user.Id, 999, common.RoleRootUser, "add", 30, &firstCents)
	require.NoError(t, err)
	code := Redemption{Key: "fifo-wallet-code", Quota: 7, Status: common.RedemptionCodeStatusEnabled}
	require.NoError(t, db.Create(&code).Error)
	_, err = Redeem(code.Key, user.Id)
	require.NoError(t, err)
	_, err = AdjustUserQuota(user.Id, 999, common.RoleRootUser, "add", 50, &lastCents)
	require.NoError(t, err)
	// 45 net units spent: old purchase 30, code 7, new purchase 8.
	require.NoError(t, db.Model(&User{}).Where("id = ?", user.Id).Update("quota", 42).Error)
	now := time.Now().Unix()
	report, err := GetCashbackRecordedSpendReport(user.Id, now-60, now+1)
	require.NoError(t, err)
	assert.Equal(t, "reference", report.RefundStatus)
	assert.Equal(t, int64(4200), *report.TotalReferenceCNYCents)
	require.Len(t, report.Credits, 4)
	assert.Equal(t, []int64{0, 0, 0, 42}, []int64{report.Credits[0].RemainingQuota, report.Credits[1].RemainingQuota, report.Credits[2].RemainingQuota, report.Credits[3].RemainingQuota})
	assert.Nil(t, report.Credits[2].ReferenceCNYCents) // Wallet code is never cash.

	// Historical quota-only adds remain FIFO purchases, but lack the original
	// CNY input; no current exchange rate can manufacture their face value.
	_, err = AdjustUserQuota(user.Id, 999, common.RoleRootUser, "add", 10, nil)
	require.NoError(t, err)
	manual, err := GetCashbackRecordedSpendReport(user.Id, now-60, now+1)
	require.NoError(t, err)
	assert.Equal(t, "manual_reconciliation", manual.RefundStatus)
	assert.Nil(t, manual.TotalReferenceCNYCents)
	assert.Equal(t, "cash_amount_or_currency_unconfirmed", manual.ManualReason)
	// A missing face value blocks the *complete* total, not the supported
	// per-credit figure from a separate, fully evidenced purchase.
	require.Len(t, manual.Credits, 5)
	require.NotNil(t, manual.Credits[3].ReferenceCNYCents)
	assert.EqualValues(t, 4200, *manual.Credits[3].ReferenceCNYCents)
	assert.Nil(t, manual.Credits[4].ReferenceCNYCents)
	logDB := LOG_DB
	LOG_DB = nil
	t.Cleanup(func() { LOG_DB = logDB })
	withoutLogs, err := GetCashbackRecordedSpendReport(user.Id, now-60, now+1)
	require.NoError(t, err)
	assert.Equal(t, "unavailable", withoutLogs.LogStatus)
	assert.Empty(t, withoutLogs.Intervals)
	assert.Equal(t, manual.Credits, withoutLogs.Credits)
}

func TestCashbackRefundReferenceKeepsProvenPerCreditAmountsWhenTotalIsUnknown(t *testing.T) {
	t.Setenv("CASHBACK_REFUND_REFERENCE_ENABLED", "true")
	db := setupCashbackTestDB(t)
	now := time.Now().Unix()
	user := User{Username: "partial-reference", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&user).Error)
	order := TopUp{UserId: user.Id, Amount: 100, TradeNo: "partial-epay", Status: common.TopUpStatusSuccess, PaymentProvider: PaymentProviderEpay, CompleteTime: now}
	require.NoError(t, db.Create(&order).Error)
	require.NoError(t, db.Create(&CashbackOrderContext{TopUpID: order.Id, TradeNo: order.TradeNo, UserID: user.Id, PaymentProvider: PaymentProviderEpay, BaseQuota: 100, CreditedQuota: 100, DeviceSignalStatus: CashbackDeviceSignalMissing, CompletionSource: CashbackCompletionProviderCallback, CompletionProvider: PaymentProviderEpay}).Error)
	require.NoError(t, db.Create(&EpayPaymentEvidence{TopUpID: order.Id, TradeNo: order.TradeNo, GatewayTradeNo: "gateway", MerchantID: "merchant", PaidCents: 9000, Source: CashbackCompletionProviderCallback, VerifiedAt: now}).Error)
	require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
		return recordWalletRefundCreditTx(tx, user, walletRefundPurchase, "topup", int64(order.Id), 100, "")
	}))
	adminCents := int64(3000)
	_, err := AdjustUserQuota(user.Id, 999, common.RoleRootUser, "add", 30, &adminCents)
	require.NoError(t, err)
	stripe := TopUp{UserId: user.Id, Amount: 50, TradeNo: "partial-stripe", Status: common.TopUpStatusSuccess, PaymentProvider: PaymentProviderStripe, CompleteTime: now}
	require.NoError(t, db.Create(&stripe).Error)
	require.NoError(t, db.Create(&CashbackOrderContext{TopUpID: stripe.Id, TradeNo: stripe.TradeNo, UserID: user.Id, PaymentProvider: PaymentProviderStripe, BaseQuota: 50, CreditedQuota: 50, DeviceSignalStatus: CashbackDeviceSignalMissing, CompletionSource: CashbackCompletionProviderCallback, CompletionProvider: PaymentProviderStripe}).Error)
	require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
		return recordWalletRefundCreditTx(tx, user, walletRefundPurchase, "topup", int64(stripe.Id), 50, "")
	}))
	// Epay has 50 purchased units left; admin add has 30, Stripe has 50.
	require.NoError(t, db.Model(&User{}).Where("id = ?", user.Id).Update("quota", 130).Error)
	report, err := GetCashbackRecordedSpendReport(user.Id, now-60, now+1, order.Id)
	require.NoError(t, err)
	assert.Equal(t, "manual_reconciliation", report.RefundStatus)
	assert.Equal(t, "cash_amount_or_currency_unconfirmed", report.ManualReason)
	assert.Nil(t, report.TotalReferenceCNYCents)
	require.Len(t, report.Credits, 4)
	require.NotNil(t, report.Credits[1].ReferenceCNYCents)
	assert.EqualValues(t, 4500, *report.Credits[1].ReferenceCNYCents)
	require.NotNil(t, report.Credits[2].ReferenceCNYCents)
	assert.EqualValues(t, 3000, *report.Credits[2].ReferenceCNYCents)
	assert.Nil(t, report.Credits[3].ReferenceCNYCents)
	require.Len(t, report.TopUps, 2)
	require.NotNil(t, report.TopUps[0].ReferenceCNYCents)
	assert.EqualValues(t, 4500, *report.TopUps[0].ReferenceCNYCents)
	assert.Nil(t, report.TopUps[1].ReferenceCNYCents)

	// Source corruption invalidates even the formerly supported per-order amount.
	require.NoError(t, db.Delete(&CashbackOrderContext{}, "top_up_id = ?", order.Id).Error)
	invalid, err := GetCashbackRecordedSpendReport(user.Id, now-60, now+1)
	require.NoError(t, err)
	assert.Equal(t, "missing_purchase_source", invalid.ManualReason)
	assert.Nil(t, invalid.WalletQuota)
	assert.Empty(t, invalid.Credits)
}

func TestCashbackRefundReferenceFailsClosed(t *testing.T) {
	t.Setenv("CASHBACK_REFUND_REFERENCE_ENABLED", "true")
	for _, tc := range []struct {
		name  string
		alter func(*testing.T, *gorm.DB, User, TopUp)
		want  string
	}{
		{"no currency confirmation", func(*testing.T, *gorm.DB, User, TopUp) {}, "cash_amount_or_currency_unconfirmed"},
		{"missing source", func(t *testing.T, db *gorm.DB, _ User, order TopUp) {
			require.NoError(t, db.Delete(&CashbackOrderContext{}, "top_up_id = ?", order.Id).Error)
		}, "missing_purchase_source"},
		{"missing signed amount", func(t *testing.T, db *gorm.DB, _ User, order TopUp) {
			require.NoError(t, db.Delete(&EpayPaymentEvidence{}, "top_up_id = ?", order.Id).Error)
		}, "missing_signed_payment"},
		{"negative balance", func(t *testing.T, db *gorm.DB, user User, _ TopUp) {
			require.NoError(t, db.Model(&User{}).Where("id = ?", user.Id).Update("quota", -1).Error)
		}, "invalid_wallet_balance"},
		{"balance above grants", func(t *testing.T, db *gorm.DB, user User, _ TopUp) {
			require.NoError(t, db.Model(&User{}).Where("id = ?", user.Id).Update("quota", 101).Error)
		}, "balance_exceeds_credits"},
		{"exception", func(t *testing.T, db *gorm.DB, user User, _ TopUp) {
			require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
				return recordWalletRefundCreditTx(tx, user, walletRefundException, "admin_adjustment", 0, 0, "different")
			}))
		}, "exceptional_wallet_change"},
		{"old balance", func(t *testing.T, db *gorm.DB, user User, _ TopUp) {
			require.NoError(t, db.Model(&WalletRefundCreditEvent{}).Where("user_id = ? AND kind = ?", user.Id, walletRefundOpening).UpdateColumn("quota", 5).Error)
		}, "missing_or_legacy_opening"},
		{"missing event", func(t *testing.T, db *gorm.DB, _ User, order TopUp) {
			require.NoError(t, db.Where("source_type = ? AND source_id = ?", "topup", order.Id).Delete(&WalletRefundCreditEvent{}).Error)
			require.NoError(t, db.Model(&User{}).Where("id = ?", order.UserId).Update("quota", 0).Error)
		}, "missing_purchase_event"},
		{"clock-skewed missing event", func(t *testing.T, db *gorm.DB, _ User, order TopUp) {
			require.NoError(t, db.Where("source_type = ? AND source_id = ?", "topup", order.Id).Delete(&WalletRefundCreditEvent{}).Error)
			require.NoError(t, db.Model(&TopUp{}).Where("id = ?", order.Id).Update("complete_time", order.CompleteTime-3600).Error)
			require.NoError(t, db.Model(&User{}).Where("id = ?", order.UserId).Update("quota", 0).Error)
		}, "missing_purchase_event"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db := setupCashbackTestDB(t)
			now := time.Now().Unix()
			user := User{Username: "fifo-fail", Status: common.UserStatusEnabled}
			require.NoError(t, db.Create(&user).Error)
			order := TopUp{UserId: user.Id, Amount: 100, TradeNo: "fifo-fail-order", Status: common.TopUpStatusSuccess, PaymentProvider: PaymentProviderEpay, CompleteTime: now}
			require.NoError(t, db.Create(&order).Error)
			require.NoError(t, db.Create(&CashbackOrderContext{TopUpID: order.Id, TradeNo: order.TradeNo, UserID: user.Id, PaymentProvider: PaymentProviderEpay, BaseQuota: 100, CreditedQuota: 100, DeviceSignalStatus: CashbackDeviceSignalMissing, CompletionSource: CashbackCompletionProviderCallback, CompletionProvider: PaymentProviderEpay}).Error)
			require.NoError(t, db.Create(&EpayPaymentEvidence{TopUpID: order.Id, TradeNo: order.TradeNo, GatewayTradeNo: "gateway", MerchantID: "merchant", PaidCents: 9000, Source: CashbackCompletionProviderCallback, VerifiedAt: now}).Error)
			require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
				return recordWalletRefundCreditTx(tx, user, walletRefundPurchase, "topup", int64(order.Id), 100, "")
			}))
			require.NoError(t, db.Model(&User{}).Where("id = ?", user.Id).Update("quota", 50).Error)
			tc.alter(t, db, user, order)
			confirmed := []int{order.Id}
			if tc.name == "no currency confirmation" || tc.name == "missing source" || tc.name == "missing signed amount" || tc.name == "clock-skewed missing event" {
				confirmed = nil
			}
			report, err := GetCashbackRecordedSpendReport(user.Id, now-50, now+1, confirmed...)
			require.NoError(t, err)
			assert.Equal(t, "manual_reconciliation", report.RefundStatus)
			assert.Equal(t, tc.want, report.ManualReason)
			assert.Nil(t, report.TotalReferenceCNYCents)
		})
	}
}

func TestCashbackRefundReferenceGateAndSources(t *testing.T) {
	db := setupCashbackTestDB(t)
	now := time.Now().Unix()
	user := User{Username: "reference-gate", Status: common.UserStatusEnabled, Quota: 25}
	require.NoError(t, db.Create(&user).Error)
	require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
		return recordWalletRefundCreditTx(tx, user, walletRefundOpening, "registration", 0, 0, "")
	}))
	order := TopUp{UserId: user.Id, Amount: 100, TradeNo: "reference-outside-display", Status: common.TopUpStatusSuccess, PaymentProvider: PaymentProviderEpay, CompleteTime: now - 200}
	require.NoError(t, db.Create(&order).Error)
	require.NoError(t, db.Create(&CashbackOrderContext{TopUpID: order.Id, TradeNo: order.TradeNo, UserID: user.Id, PaymentProvider: PaymentProviderEpay, BaseQuota: 100, CreditedQuota: 100, DeviceSignalStatus: CashbackDeviceSignalMissing, CompletionSource: CashbackCompletionProviderCallback, CompletionProvider: PaymentProviderEpay}).Error)
	require.NoError(t, db.Create(&EpayPaymentEvidence{TopUpID: order.Id, TradeNo: order.TradeNo, GatewayTradeNo: "gateway", MerchantID: "merchant", PaidCents: 9000, Source: CashbackCompletionProviderCallback, VerifiedAt: order.CompleteTime}).Error)
	require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
		return recordWalletRefundCreditTx(tx, user, walletRefundPurchase, "topup", int64(order.Id), 100, "")
	}))
	// Registration's 25-unit nonrefundable opening and 50 purchased units were
	// consumed. A historical positive wallet opening would not be eligible.
	require.NoError(t, db.Model(&User{}).Where("id = ?", user.Id).Update("quota", 50).Error)
	t.Setenv("CASHBACK_REFUND_REFERENCE_ENABLED", "")
	closed, err := GetCashbackRecordedSpendReport(user.Id, now-60, now+1, order.Id)
	require.NoError(t, err)
	assert.Equal(t, "wallet_evidence_incomplete", closed.ManualReason)
	assert.Nil(t, closed.WalletQuota)
	assert.Nil(t, closed.TotalReferenceCNYCents)
	assert.Empty(t, closed.TopUps)
	assert.Len(t, closed.Intervals, 1)
	t.Setenv("CASHBACK_REFUND_REFERENCE_ENABLED", "true")
	report, err := GetCashbackRecordedSpendReport(user.Id, now-60, now+1, order.Id)
	require.NoError(t, err)
	assert.Equal(t, "reference", report.RefundStatus)
	assert.Empty(t, report.TopUps) // Display is bounded, confirmation is not.
	require.NotNil(t, report.TotalReferenceCNYCents)
	assert.EqualValues(t, 4500, *report.TotalReferenceCNYCents)
	assert.Equal(t, "registration", report.Credits[0].SourceType)
	assert.Zero(t, report.Credits[0].RemainingQuota)
	assert.EqualValues(t, 50, report.Credits[1].RemainingQuota)
	assert.Equal(t, "reference-outside-display", report.Credits[1].TradeNo)
	assert.Equal(t, PaymentProviderEpay, report.Credits[1].PaymentProvider)
	assert.True(t, report.Credits[1].SignedAmountAvailable) // Signature has no currency.

	other := User{Username: "reference-other", AffCode: "reference-other-code", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&other).Error)
	otherOrder := TopUp{UserId: other.Id, Amount: 1, TradeNo: "reference-other-order", Status: common.TopUpStatusSuccess, PaymentProvider: PaymentProviderEpay, CompleteTime: now}
	require.NoError(t, db.Create(&otherOrder).Error)
	stripe := TopUp{UserId: user.Id, Amount: 1, TradeNo: "reference-stripe", Status: common.TopUpStatusSuccess, PaymentProvider: PaymentProviderStripe, CompleteTime: now}
	require.NoError(t, db.Create(&stripe).Error)
	for _, id := range []int{otherOrder.Id, stripe.Id, 999999} {
		_, err := GetCashbackRecordedSpendReport(user.Id, now-60, now+1, id)
		assert.ErrorIs(t, err, ErrCashbackReportRange)
	}
}

func TestCashbackRefundReferenceManualTopUpWithoutLegacyContext(t *testing.T) {
	t.Setenv("CASHBACK_REFUND_REFERENCE_ENABLED", "true")
	db := setupCashbackTestDB(t)
	now := time.Now().Unix()
	user := User{Username: "manual-legacy-topup", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&user).Error)
	order := TopUp{UserId: user.Id, Amount: 1, TradeNo: "manual-legacy-order", Status: common.TopUpStatusSuccess, PaymentProvider: PaymentProviderEpay, CompleteTime: now}
	require.NoError(t, db.Create(&order).Error)
	manualQuota, err := common.WalletQuotaFromDecimalStrict(decimal.NewFromFloat(common.QuotaPerUnit))
	require.NoError(t, err)
	require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
		return recordWalletRefundCreditTx(tx, user, walletRefundPurchase, "manual_topup", int64(order.Id), int64(manualQuota), "")
	}))
	require.NoError(t, db.Model(&User{}).Where("id = ?", user.Id).Update("quota", manualQuota-40).Error)
	report, err := GetCashbackRecordedSpendReport(user.Id, now-60, now+1)
	require.NoError(t, err)
	assert.Equal(t, "manual_reconciliation", report.RefundStatus)
	assert.Equal(t, "cash_amount_or_currency_unconfirmed", report.ManualReason)
	require.Len(t, report.Credits, 2)
	assert.EqualValues(t, manualQuota-40, report.Credits[1].RemainingQuota)
	assert.Equal(t, "manual_topup", report.Credits[1].SourceType)
	assert.False(t, report.Credits[1].SignedAmountAvailable)
	assert.Nil(t, report.TotalReferenceCNYCents)
	_, err = GetCashbackRecordedSpendReport(user.Id, now-60, now+1, order.Id)
	assert.ErrorIs(t, err, ErrCashbackReportRange) // Manual Epay has no signed cash proof.
	// An online credit with the same missing context must still fail closed.
	require.NoError(t, db.Model(&WalletRefundCreditEvent{}).Where("source_id = ? AND kind = ?", order.Id, walletRefundPurchase).UpdateColumn("source_type", "topup").Error)
	invalid, err := GetCashbackRecordedSpendReport(user.Id, now-60, now+1)
	require.NoError(t, err)
	assert.Equal(t, "missing_purchase_source", invalid.ManualReason)
	assert.Nil(t, invalid.WalletQuota)
}

func TestCashbackRefundReferenceUsesOneMainDatabaseSnapshot(t *testing.T) {
	t.Setenv("CASHBACK_REFUND_REFERENCE_ENABLED", "true")
	setupCashbackTestDB(t)
	path := filepath.Join(t.TempDir(), "snapshot.sqlite")
	reader, err := gorm.Open(sqlite.Open(path), &gorm.Config{})
	require.NoError(t, err)
	writer, err := gorm.Open(sqlite.Open(path), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, reader.Exec("PRAGMA journal_mode=WAL").Error)
	require.NoError(t, reader.AutoMigrate(&User{}, &TopUp{}, &CashbackOrderContext{}, &EpayPaymentEvidence{}, &WalletRefundCreditEvent{}, &CashbackReward{}, &AdminQuotaCreditEvidence{}, &Redemption{}, &Checkin{}, &Log{}))
	DB, LOG_DB = reader, reader
	// An identical LOG_DB connection with just one slot must never be queried
	// while the main read transaction is still holding that slot.
	sqlDB, err := reader.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	user := User{Username: "snapshot-payer", Status: common.UserStatusEnabled, Quota: 100}
	require.NoError(t, reader.Create(&user).Error)
	now := time.Now().Unix()
	order := TopUp{UserId: user.Id, Amount: 100, TradeNo: "snapshot-order", Status: common.TopUpStatusSuccess, PaymentProvider: PaymentProviderEpay, CompleteTime: now}
	require.NoError(t, reader.Create(&order).Error)
	require.NoError(t, reader.Create(&CashbackOrderContext{TopUpID: order.Id, TradeNo: order.TradeNo, UserID: user.Id, PaymentProvider: PaymentProviderEpay, BaseQuota: 100, CreditedQuota: 100, DeviceSignalStatus: CashbackDeviceSignalMissing, CompletionSource: CashbackCompletionProviderCallback, CompletionProvider: PaymentProviderEpay}).Error)
	require.NoError(t, reader.Create(&EpayPaymentEvidence{TopUpID: order.Id, TradeNo: order.TradeNo, GatewayTradeNo: "gateway", MerchantID: "merchant", PaidCents: 10000, Source: CashbackCompletionProviderCallback, VerifiedAt: now}).Error)
	require.NoError(t, reader.Transaction(func(tx *gorm.DB) error {
		return recordWalletRefundCreditTx(tx, User{Id: user.Id}, walletRefundPurchase, "topup", int64(order.Id), 100, "")
	}))
	changed := false
	require.NoError(t, reader.Callback().Query().After("gorm:query").Register("cashback_snapshot_interleave", func(query *gorm.DB) {
		if changed || query.Statement.Table != "users" || query.Error != nil {
			return
		}
		changed = true
		// Another committed connection changes both balance and payment source
		// after the snapshot's first read, before event/source lookups.
		if err := writer.Transaction(func(tx *gorm.DB) error {
			if err := tx.Model(&User{}).Where("id = ?", user.Id).Update("quota", 50).Error; err != nil {
				return err
			}
			return tx.Model(&EpayPaymentEvidence{}).Where("top_up_id = ?", order.Id).Update("paid_cents", 9000).Error
		}); err != nil {
			query.AddError(err)
		}
	}))
	report, err := GetCashbackRecordedSpendReport(user.Id, now-60, now+1, order.Id)
	require.NoError(t, err)
	assert.True(t, changed)
	assert.Equal(t, "reference", report.RefundStatus)
	require.NotNil(t, report.TotalReferenceCNYCents)
	assert.EqualValues(t, 10000, *report.TotalReferenceCNYCents)
	require.NotNil(t, report.WalletQuota)
	assert.EqualValues(t, 100, *report.WalletQuota)
	var latest User
	require.NoError(t, writer.First(&latest, user.Id).Error)
	assert.Equal(t, 50, latest.Quota)
}

func TestCashbackMigrationCreatesOnlySideTablesAndUniqueDirection(t *testing.T) {
	db := setupCashbackTestDB(t)
	assert.True(t, db.Migrator().HasTable(&CashbackOrderContext{}))
	assert.True(t, db.Migrator().HasTable(&CashbackReward{}))
	assert.True(t, db.Migrator().HasTable(&CashbackDeviceLink{}))
	assert.True(t, db.Migrator().HasTable(&CashbackQuotaMutation{}))
	assert.True(t, db.Migrator().HasTable(&EpayPaymentEvidence{}))
	assert.True(t, db.Migrator().HasIndex(&CashbackQuotaMutation{}, "idx_cashback_mutation_reward_kind"))
	assert.True(t, db.Migrator().HasIndex(&CashbackQuotaMutation{}, "idx_cashback_mutation_topup_kind"))

	columns, err := db.Migrator().ColumnTypes(&TopUp{})
	require.NoError(t, err)
	for _, column := range columns {
		assert.NotContains(t, column.Name(), "cashback")
	}

	reward := CashbackReward{
		TopUpID: 1, TradeNo: "unique-order", Direction: CashbackDirectionInvitee, InviteeID: 2, InviterID: 1, BeneficiaryID: 2,
		BaseQuota: 100, RateBPS: 100, CalculatedQuota: 1, RewardQuota: 1, SettlementDays: 7,
		PaidAt: 1, AvailableAt: 2, ReviewStatus: CashbackReviewPending, SettlementStatus: CashbackSettlementFrozen,
		RiskLevel: CashbackRiskLow, RiskSnapshot: `{}`, ConfigSnapshot: `{}`,
	}
	require.NoError(t, db.Create(&reward).Error)
	originalID := reward.ID
	reward.ID = 0
	assert.Error(t, db.Create(&reward).Error)
	require.NoError(t, db.Migrator().DropColumn(&CashbackOrderContext{}, "campaign_id"))
	require.NoError(t, db.Migrator().DropColumn(&CashbackReward{}, "review_source"))
	require.NoError(t, db.Migrator().DropTable(&EpayPaymentEvidence{}))
	require.NoError(t, db.Migrator().DropTable(&CashbackCampaign{}))
	for range 2 {
		require.NoError(t, db.AutoMigrate(&CashbackCampaign{}, &CashbackOrderContext{}, &CashbackReward{}, &EpayPaymentEvidence{}))
	}
	assert.True(t, db.Migrator().HasTable(&EpayPaymentEvidence{}))
	var evidenceRows int64
	require.NoError(t, db.Model(&EpayPaymentEvidence{}).Count(&evidenceRows).Error)
	assert.Zero(t, evidenceRows) // Never infer verified amounts for historical top-ups.
	evidence := EpayPaymentEvidence{TopUpID: 1, TradeNo: "order-1", GatewayTradeNo: "gateway-1", MerchantID: "merchant", PaidCents: 100}
	require.NoError(t, db.Create(&evidence).Error)
	assert.Error(t, db.Create(&evidence).Error) // One immutable evidence row per order.
	var preserved CashbackReward
	require.NoError(t, db.First(&preserved, originalID).Error)
	assert.Equal(t, reward.TradeNo, preserved.TradeNo)
	assert.Empty(t, preserved.ReviewSource)
	assert.True(t, db.Migrator().HasIndex(&CashbackReward{}, "ux_cashback_topup_direction"))
}

func TestInsertOnlineTopUpHonorsImmutableFirstEnableBoundaryAndHashesDevice(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now)
	_, invitee := createCashbackUsers(t, now-10_000)

	oldOrder := TopUp{UserId: invitee.Id, TradeNo: "before-first-enable", PaymentProvider: PaymentProviderEpay, CreateTime: now - 1, Status: common.TopUpStatusPending}
	require.NoError(t, insertCashbackTestTopUp(&oldOrder, 100, CashbackRequestMetadata{}))
	var oldContext CashbackOrderContext
	require.NoError(t, DB.Where("top_up_id = ?", oldOrder.Id).First(&oldContext).Error)
	assert.False(t, oldContext.EligibleAfterFirstEnable)

	newOrder := TopUp{UserId: invitee.Id, TradeNo: "after-first-enable", PaymentProvider: PaymentProviderEpay, CreateTime: now, Status: common.TopUpStatusPending}
	require.NoError(t, insertCashbackTestTopUp(&newOrder, 100, CashbackRequestMetadata{
		RequestIP: "203.0.113.11", UserAgent: "agent", DeviceSignal: "v1:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
	}))
	var orderContext CashbackOrderContext
	require.NoError(t, DB.Where("top_up_id = ?", newOrder.Id).First(&orderContext).Error)
	assert.True(t, orderContext.EligibleAfterFirstEnable)
	assert.Equal(t, CashbackDeviceSignalValid, orderContext.DeviceSignalStatus)
	assert.Len(t, orderContext.DeviceFingerprintHash, 64)
	assert.NotContains(t, orderContext.DeviceFingerprintHash, "bbbb")
	var link CashbackDeviceLink
	require.NoError(t, DB.Where("user_id = ? AND device_fingerprint_hash = ?", invitee.Id, orderContext.DeviceFingerprintHash).First(&link).Error)
	assert.Equal(t, orderContext.DeviceFingerprintHash, link.DeviceFingerprintHash)
}

func TestSameSecondFirstEnableUsesOrderLocalEligibilitySnapshot(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	_, invitee := createCashbackUsers(t, now-10_000)

	baseQuota, err := common.WalletQuotaFromDecimalStrict(decimal.NewFromFloat(common.QuotaPerUnit))
	require.NoError(t, err)
	preEnable := TopUp{
		UserId: invitee.Id, Amount: 1, Money: 1, TradeNo: "same-second-before-enable",
		PaymentMethod: "alipay", PaymentProvider: PaymentProviderEpay,
		CreateTime: now, Status: common.TopUpStatusPending,
	}
	require.NoError(t, insertCashbackTestTopUp(&preEnable, baseQuota, CashbackRequestMetadata{}))
	var preEnableContext CashbackOrderContext
	require.NoError(t, DB.Where("top_up_id = ?", preEnable.Id).First(&preEnableContext).Error)
	assert.False(t, preEnableContext.EligibleAfterFirstEnable)

	saveCashbackTestSetting(t, now)
	alreadyDone, err := RechargeEpay(preEnable.TradeNo, "alipay", "1.00", "127.0.0.1", epayTestDetails(preEnable.TradeNo))
	require.NoError(t, err)
	assert.False(t, alreadyDone)
	var rewardCount int64
	require.NoError(t, DB.Model(&CashbackReward{}).Where("top_up_id = ?", preEnable.Id).Count(&rewardCount).Error)
	assert.Zero(t, rewardCount)

	var creditedUser User
	require.NoError(t, DB.First(&creditedUser, invitee.Id).Error)
	assert.Equal(t, baseQuota, creditedUser.Quota)

	postEnable := TopUp{
		UserId: invitee.Id, Amount: 1, Money: 1, TradeNo: "same-second-after-enable",
		PaymentMethod: "alipay", PaymentProvider: PaymentProviderEpay,
		CreateTime: now, Status: common.TopUpStatusPending,
	}
	require.NoError(t, insertCashbackTestTopUp(&postEnable, baseQuota, CashbackRequestMetadata{}))
	var postEnableContext CashbackOrderContext
	require.NoError(t, DB.Where("top_up_id = ?", postEnable.Id).First(&postEnableContext).Error)
	assert.True(t, postEnableContext.EligibleAfterFirstEnable)
}

func TestCompleteTopUpCreatesIndependentSnapshotRewardsAndSettlesOnce(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	setting := saveCashbackTestSetting(t, now-4*24*60*60)
	inviter, invitee := createCashbackUsers(t, now-30*24*60*60)
	topUp := createCompletedCashbackTopUp(t, invitee, now-3*24*60*60, now-2*24*60*60, 100_000, 120_000)

	var rewards []CashbackReward
	require.NoError(t, DB.Where("top_up_id = ?", topUp.Id).Order("direction asc").Find(&rewards).Error)
	require.Len(t, rewards, 2)
	byDirection := map[CashbackDirection]CashbackReward{}
	for _, reward := range rewards {
		byDirection[reward.Direction] = reward
		assert.Equal(t, setting.Version, reward.ConfigVersion)
		assert.Equal(t, 100_000, reward.BaseQuota)
		assert.Equal(t, now-2*24*60*60+7*24*60*60, reward.AvailableAt)
		assert.Contains(t, reward.ConfigSnapshot, `"inviter_rate_bps":1000`)
		assert.NotEmpty(t, reward.RiskSnapshot)
	}
	assert.Equal(t, 10_000, byDirection[CashbackDirectionInviter].CalculatedQuota)
	assert.Equal(t, inviter.Id, byDirection[CashbackDirectionInviter].BeneficiaryID)
	assert.Equal(t, 5_000, byDirection[CashbackDirectionInvitee].CalculatedQuota)
	assert.Equal(t, invitee.Id, byDirection[CashbackDirectionInvitee].BeneficiaryID)

	for _, reward := range rewards {
		review, err := ReviewCashbackReward(reward.ID, CashbackReviewActionApprove, "reviewed risk evidence", 999, reward.AvailableAt)
		require.NoError(t, err)
		assert.True(t, review.Issued)
		outcome, err := IssueCashbackReward(reward.ID, reward.AvailableAt+1)
		require.NoError(t, err)
		assert.True(t, outcome.Skipped)
	}

	var updatedInviter, updatedInvitee User
	require.NoError(t, DB.First(&updatedInviter, inviter.Id).Error)
	require.NoError(t, DB.First(&updatedInvitee, invitee.Id).Error)
	assert.Equal(t, 10_000, updatedInviter.Quota)
	assert.Equal(t, 125_000, updatedInvitee.Quota)
	var inviterCreditLogCount, payerCreditLogCount int64
	require.NoError(t, LOG_DB.Model(&Log{}).
		Where("other LIKE ?", `%"action":"cashback.reward_credited"%`).
		Count(&inviterCreditLogCount).Error)
	require.NoError(t, LOG_DB.Model(&Log{}).
		Where("other LIKE ?", `%"action":"cashback.payer_reward_credited"%`).
		Count(&payerCreditLogCount).Error)
	assert.EqualValues(t, 1, inviterCreditLogCount)
	assert.EqualValues(t, 1, payerCreditLogCount)
	var issueMutationCount int64
	require.NoError(t, DB.Model(&CashbackQuotaMutation{}).Where("kind = ?", CashbackQuotaMutationIssue).Count(&issueMutationCount).Error)
	assert.EqualValues(t, 2, issueMutationCount)
	summary, err := GetCashbackAdminSummary()
	require.NoError(t, err)
	assert.EqualValues(t, 15_000, summary.IssuedQuota)
	assert.Zero(t, summary.ReconciliationIssues)
	assert.NotNil(t, summary.InviterClusters)
	assert.NotNil(t, summary.DeviceClusters)
}

func TestCashbackIssuanceInvalidatesCacheUntilCommittedBalanceCanRehydrate(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	inviter, invitee := createCashbackUsers(t, now-30*24*60*60)
	order := createCompletedCashbackTopUp(t, invitee, now, now, 100_000, 100_000)
	var reward CashbackReward
	require.NoError(t, DB.Where("top_up_id = ? AND direction = ?", order.Id, CashbackDirectionInviter).First(&reward).Error)
	_, err := ReviewCashbackReward(reward.ID, CashbackReviewActionApprove, "reviewed", 999, now)
	require.NoError(t, err)

	redisServer := useUserCacheMiniRedis(t)
	var inviterRow User
	require.NoError(t, DB.First(&inviterRow, inviter.Id).Error)
	require.NoError(t, writeUserCache(inviterRow.ToBaseUser(), true))
	outcome, err := IssueCashbackReward(reward.ID, reward.AvailableAt)
	require.NoError(t, err)
	assert.True(t, outcome.Issued)
	require.NoError(t, DB.First(&inviterRow, inviter.Id).Error)
	assert.Equal(t, reward.RewardQuota, inviterRow.Quota)
	_, err = cacheGetUserBase(inviter.Id)
	assert.ErrorIs(t, err, ErrUserQuotaMutationPending)
	assert.False(t, redisServer.Exists(getUserCacheKey(inviter.Id)))

	duplicate, err := IssueCashbackReward(reward.ID, reward.AvailableAt+1)
	require.NoError(t, err)
	assert.True(t, duplicate.Skipped)
	redisServer.FastForward(time.Duration(userQuotaMutationCooldownSeconds()+1) * time.Second)
	cached, err := GetUserCache(inviter.Id)
	require.NoError(t, err)
	assert.Equal(t, inviterRow.Quota, cached.Quota)
}

func TestCashbackIssuanceFailsClosedWhenRedisIsUnavailable(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	inviter, invitee := createCashbackUsers(t, now-30*24*60*60)
	order := createCompletedCashbackTopUp(t, invitee, now, now, 100_000, 100_000)
	var reward CashbackReward
	require.NoError(t, DB.Where("top_up_id = ? AND direction = ?", order.Id, CashbackDirectionInviter).First(&reward).Error)
	_, err := ReviewCashbackReward(reward.ID, CashbackReviewActionApprove, "reviewed", 999, now)
	require.NoError(t, err)

	redisServer := useUserCacheMiniRedis(t)
	redisServer.Close()
	_, err = IssueCashbackReward(reward.ID, reward.AvailableAt)
	assert.Error(t, err)
	var storedReward CashbackReward
	require.NoError(t, DB.First(&storedReward, reward.ID).Error)
	assert.Equal(t, CashbackSettlementFrozen, storedReward.SettlementStatus)
	assert.NotEmpty(t, storedReward.LastSettlementError)
	assert.Equal(t, reward.AvailableAt+cashbackSettlementRetryDelaySeconds, storedReward.NextSettlementAttemptAt)
	var storedInviter User
	require.NoError(t, DB.First(&storedInviter, inviter.Id).Error)
	assert.Zero(t, storedInviter.Quota)
}

func TestCashbackIssuanceRecordsLostFenceAndRollsBackMoney(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	inviter, invitee := createCashbackUsers(t, now-30*24*60*60)
	order := createCompletedCashbackTopUp(t, invitee, now, now, 100_000, 100_000)
	var reward CashbackReward
	require.NoError(t, DB.Where("top_up_id = ? AND direction = ?", order.Id, CashbackDirectionInviter).First(&reward).Error)
	_, err := ReviewCashbackReward(reward.ID, CashbackReviewActionApprove, "reviewed", 999, now)
	require.NoError(t, err)

	useUserCacheMiniRedis(t)
	callbackName := "test:cashback-fence-lost"
	require.NoError(t, DB.Callback().Update().After("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table == "cashback_rewards" {
			_ = common.RDB.Del(t.Context(), getUserQuotaMutationFenceKey(inviter.Id)).Err()
		}
	}))
	callbackRegistered := true
	t.Cleanup(func() {
		if callbackRegistered {
			_ = DB.Callback().Update().Remove(callbackName)
		}
	})

	_, err = IssueCashbackReward(reward.ID, reward.AvailableAt)
	assert.ErrorIs(t, err, ErrUserQuotaMutationFenceLost)
	require.NoError(t, DB.Callback().Update().Remove(callbackName))
	callbackRegistered = false

	var storedReward CashbackReward
	require.NoError(t, DB.First(&storedReward, reward.ID).Error)
	assert.Equal(t, CashbackSettlementFrozen, storedReward.SettlementStatus)
	assert.Contains(t, storedReward.LastSettlementError, ErrUserQuotaMutationFenceLost.Error())
	assert.Equal(t, reward.AvailableAt+cashbackSettlementRetryDelaySeconds, storedReward.NextSettlementAttemptAt)
	var storedInviter User
	require.NoError(t, DB.First(&storedInviter, inviter.Id).Error)
	assert.Zero(t, storedInviter.Quota)
	var mutationCount int64
	require.NoError(t, DB.Model(&CashbackQuotaMutation{}).Where("reward_id = ?", reward.ID).Count(&mutationCount).Error)
	assert.Zero(t, mutationCount)
}

func TestCashbackIssuanceSkipsIneligibleWithoutSettlementError(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	_, invitee := createCashbackUsers(t, now-30*24*60*60)
	order := createCompletedCashbackTopUp(t, invitee, now, now, 100_000, 100_000)
	var reward CashbackReward
	require.NoError(t, DB.Where("top_up_id = ? AND direction = ?", order.Id, CashbackDirectionInviter).First(&reward).Error)

	redisServer := useUserCacheMiniRedis(t)
	redisServer.Close()
	outcome, err := IssueCashbackReward(reward.ID, reward.AvailableAt)
	require.NoError(t, err)
	assert.True(t, outcome.Skipped)
	var stored CashbackReward
	require.NoError(t, DB.First(&stored, reward.ID).Error)
	assert.Empty(t, stored.LastSettlementError)
	assert.Zero(t, stored.NextSettlementAttemptAt)

	_, err = ReviewCashbackReward(reward.ID, CashbackReviewActionApprove, "reviewed", 999, now)
	require.NoError(t, err)
	outcome, err = IssueCashbackReward(reward.ID, now)
	require.NoError(t, err)
	assert.True(t, outcome.Skipped)
	require.NoError(t, DB.First(&stored, reward.ID).Error)
	assert.Empty(t, stored.LastSettlementError)
	assert.Zero(t, stored.NextSettlementAttemptAt)
}

func TestCashbackReviewRecordsFenceFailureForApprovedMatureReward(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	_, invitee := createCashbackUsers(t, now-30*24*60*60)
	order := createCompletedCashbackTopUp(t, invitee, now, now, 100_000, 100_000)
	var reward CashbackReward
	require.NoError(t, DB.Where("top_up_id = ? AND direction = ?", order.Id, CashbackDirectionInviter).First(&reward).Error)
	_, err := ReviewCashbackReward(reward.ID, CashbackReviewActionApprove, "reviewed", 999, now)
	require.NoError(t, err)

	redisServer := useUserCacheMiniRedis(t)
	redisServer.Close()
	_, err = ReviewCashbackReward(reward.ID, CashbackReviewActionApprove, "retry mature approval", 999, reward.AvailableAt)
	assert.Error(t, err)

	var stored CashbackReward
	require.NoError(t, DB.First(&stored, reward.ID).Error)
	assert.Equal(t, CashbackReviewApproved, stored.ReviewStatus)
	assert.Equal(t, CashbackSettlementFrozen, stored.SettlementStatus)
	assert.NotEmpty(t, stored.LastSettlementError)
	assert.Equal(t, reward.AvailableAt+cashbackSettlementRetryDelaySeconds, stored.NextSettlementAttemptAt)
}

func TestCashbackInvalidReviewDoesNotFabricateSettlementFailure(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	_, invitee := createCashbackUsers(t, now-30*24*60*60)
	order := createCompletedCashbackTopUp(t, invitee, now, now, 100_000, 100_000)
	var reward CashbackReward
	require.NoError(t, DB.Where("top_up_id = ? AND direction = ?", order.Id, CashbackDirectionInviter).First(&reward).Error)
	_, err := ReviewCashbackReward(reward.ID, CashbackReviewActionApprove, "reviewed", 999, now)
	require.NoError(t, err)

	_, err = ReviewCashbackReward(reward.ID, CashbackReviewActionReject, "   ", 999, reward.AvailableAt)
	assert.ErrorIs(t, err, ErrCashbackReviewReason)

	var stored CashbackReward
	require.NoError(t, DB.First(&stored, reward.ID).Error)
	assert.Equal(t, CashbackReviewApproved, stored.ReviewStatus)
	assert.Equal(t, CashbackSettlementFrozen, stored.SettlementStatus)
	assert.Empty(t, stored.LastSettlementError)
	assert.Zero(t, stored.NextSettlementAttemptAt)
}

func TestCashbackApprovedFrozenRewardCanBeWithdrawn(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	_, invitee := createCashbackUsers(t, now-30*24*60*60)
	order := createCompletedCashbackTopUp(t, invitee, now, now, 100_000, 100_000)
	var reward CashbackReward
	require.NoError(t, DB.Where("top_up_id = ? AND direction = ?", order.Id, CashbackDirectionInviter).First(&reward).Error)
	_, err := ReviewCashbackReward(reward.ID, CashbackReviewActionApprove, "reviewed", 999, now)
	require.NoError(t, err)

	// Simulate a permanently blocked approved reward that the runner keeps retrying.
	require.NoError(t, DB.Session(&gorm.Session{SkipHooks: true}).Model(&CashbackReward{}).Where("id = ?", reward.ID).
		Updates(map[string]any{"blocking_reason": "referral_account_disabled", "next_settlement_attempt_at": reward.AvailableAt + cashbackSettlementRetryDelaySeconds}).Error)

	result, err := ReviewCashbackReward(reward.ID, CashbackReviewActionReject, "account closed for abuse", 998, reward.AvailableAt)
	require.NoError(t, err)
	assert.Equal(t, CashbackReviewRejected, result.Reward.ReviewStatus)
	assert.Equal(t, CashbackSettlementCanceled, result.Reward.SettlementStatus)
	assert.Equal(t, 998, result.Reward.ReviewedBy)
	assert.Equal(t, CashbackReviewManual, result.Reward.ReviewSource)
	assert.Zero(t, result.Reward.NextSettlementAttemptAt)

	outcome, err := IssueCashbackReward(reward.ID, reward.AvailableAt)
	require.NoError(t, err)
	assert.True(t, outcome.Skipped)
	due, err := HasMaturedCashbackRewards(reward.AvailableAt + 2*cashbackSettlementRetryDelaySeconds)
	require.NoError(t, err)
	assert.False(t, due, "a withdrawn reward must leave the settlement queue")

	// Rejecting again is idempotent; an issued reward can only be reversed through an incident.
	again, err := ReviewCashbackReward(reward.ID, CashbackReviewActionReject, "account closed for abuse", 998, reward.AvailableAt)
	require.NoError(t, err)
	assert.Equal(t, CashbackSettlementCanceled, again.Reward.SettlementStatus)
}

func TestCashbackIssuanceRollsBackWhenMutationEvidenceFails(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	inviter, invitee := createCashbackUsers(t, now-30*24*60*60)
	order := createCompletedCashbackTopUp(t, invitee, now, now, 100_000, 100_000)
	var reward CashbackReward
	require.NoError(t, DB.Where("top_up_id = ? AND direction = ?", order.Id, CashbackDirectionInviter).First(&reward).Error)
	_, err := ReviewCashbackReward(reward.ID, CashbackReviewActionApprove, "reviewed", 999, now)
	require.NoError(t, err)

	forcedErr := errors.New("forced cashback ledger failure")
	callbackName := "test:cashback-ledger-rollback"
	require.NoError(t, DB.Callback().Create().Before("gorm:create").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table == "cashback_quota_mutations" {
			tx.AddError(forcedErr)
		}
	}))
	callbackRegistered := true
	t.Cleanup(func() {
		if callbackRegistered {
			_ = DB.Callback().Create().Remove(callbackName)
		}
	})

	_, err = IssueCashbackReward(reward.ID, reward.AvailableAt)
	assert.ErrorIs(t, err, forcedErr)
	require.NoError(t, DB.Callback().Create().Remove(callbackName))
	callbackRegistered = false

	var storedReward CashbackReward
	require.NoError(t, DB.First(&storedReward, reward.ID).Error)
	assert.Equal(t, CashbackSettlementFrozen, storedReward.SettlementStatus)
	assert.Contains(t, storedReward.LastSettlementError, forcedErr.Error())
	var storedInviter User
	require.NoError(t, DB.First(&storedInviter, inviter.Id).Error)
	assert.Zero(t, storedInviter.Quota)
	var mutationCount int64
	require.NoError(t, DB.Model(&CashbackQuotaMutation{}).Where("reward_id = ?", reward.ID).Count(&mutationCount).Error)
	assert.Zero(t, mutationCount)
}

func TestCashbackReconciliationStopsSettlementOnLedgerMismatch(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	_, invitee := createCashbackUsers(t, now-30*24*60*60)
	order := createCompletedCashbackTopUp(t, invitee, now, now, 100_000, 100_000)
	var reward CashbackReward
	require.NoError(t, DB.Where("top_up_id = ?", order.Id).First(&reward).Error)
	_, err := ReviewCashbackReward(reward.ID, CashbackReviewActionApprove, "reviewed", 999, reward.AvailableAt)
	require.NoError(t, err)

	var mutation CashbackQuotaMutation
	require.NoError(t, DB.Where("reward_id = ? AND kind = ?", reward.ID, CashbackQuotaMutationIssue).First(&mutation).Error)
	require.NoError(t, DB.Session(&gorm.Session{SkipHooks: true}).Model(&CashbackQuotaMutation{}).Where("id = ?", mutation.ID).Update("quota", mutation.Quota+1).Error)
	inconsistencies, err := CashbackReconciliationInconsistencyCount()
	require.NoError(t, err)
	assert.Positive(t, inconsistencies)
	_, err = SettleMaturedCashbackRewards(reward.AvailableAt+1, 100)
	assert.ErrorContains(t, err, "cashback reconciliation found")
}

func TestMatureCashbackApprovalStopsOnReconciliationMismatch(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	inviter, invitee := createCashbackUsers(t, now-30*24*60*60)
	order := createCompletedCashbackTopUp(t, invitee, now, now, 100_000, 100_000)
	var reward CashbackReward
	require.NoError(t, DB.Where("top_up_id = ? AND direction = ?", order.Id, CashbackDirectionInviter).First(&reward).Error)

	inconsistent := CashbackReward{
		TopUpID: order.Id + 10_000, TradeNo: "reconciliation-blocks-manual-approval", Direction: CashbackDirectionInvitee,
		InviteeID: invitee.Id, InviterID: inviter.Id, BeneficiaryID: invitee.Id, BaseQuota: 100, RateBPS: 100,
		CalculatedQuota: 1, RewardQuota: 1, SettlementDays: 7, PaidAt: now,
		AvailableAt: now, ReviewStatus: CashbackReviewPending, SettlementStatus: CashbackSettlementFrozen,
		RiskLevel: CashbackRiskLow, RiskSnapshot: `{}`, ConfigSnapshot: `{}`, RecoveredQuota: 2,
	}
	require.NoError(t, DB.Session(&gorm.Session{SkipHooks: true}).Create(&inconsistent).Error)

	_, err := ReviewCashbackReward(reward.ID, CashbackReviewActionApprove, "reviewed", 999, reward.AvailableAt)
	require.ErrorContains(t, err, "cashback reconciliation found")
	assert.Zero(t, cashbackReconciliationProgress.RewardID, "the inconsistent page must remain pinned")

	var storedReward CashbackReward
	require.NoError(t, DB.First(&storedReward, reward.ID).Error)
	assert.Equal(t, CashbackReviewPending, storedReward.ReviewStatus)
	assert.Equal(t, CashbackSettlementFrozen, storedReward.SettlementStatus)
	var storedInviter User
	require.NoError(t, DB.First(&storedInviter, inviter.Id).Error)
	assert.Zero(t, storedInviter.Quota)
	var mutationCount int64
	require.NoError(t, DB.Model(&CashbackQuotaMutation{}).Where("reward_id = ?", reward.ID).Count(&mutationCount).Error)
	assert.Zero(t, mutationCount)
}

func TestCashbackReconciliationAdvancesInBoundedBatchesAndPinsMismatch(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	rewards := make([]CashbackReward, 0, cashbackReconciliationBatchSize+1)
	for i := 0; i < cashbackReconciliationBatchSize+1; i++ {
		reward := CashbackReward{
			TopUpID: i + 1, TradeNo: fmt.Sprintf("reconcile-%d", i+1), Direction: CashbackDirectionInvitee,
			InviteeID: 2, InviterID: 1, BeneficiaryID: 2, BaseQuota: 100, RateBPS: 100,
			CalculatedQuota: 1, RewardQuota: 1, SettlementDays: 7, PaidAt: now,
			AvailableAt: now + 7*24*60*60, ReviewStatus: CashbackReviewPending,
			SettlementStatus: CashbackSettlementFrozen, RiskLevel: CashbackRiskLow,
			RiskSnapshot: `{}`, ConfigSnapshot: `{}`,
		}
		if i == cashbackReconciliationBatchSize {
			reward.RecoveredQuota = 2
		}
		rewards = append(rewards, reward)
	}
	require.NoError(t, DB.Session(&gorm.Session{SkipHooks: true}).Create(&rewards).Error)

	issues, err := CashbackReconciliationInconsistencyCount()
	require.NoError(t, err)
	assert.Zero(t, issues)
	assert.Equal(t, rewards[cashbackReconciliationBatchSize-1].ID, cashbackReconciliationProgress.RewardID)

	issues, err = CashbackReconciliationInconsistencyCount()
	require.NoError(t, err)
	assert.EqualValues(t, 1, issues)
	assert.Equal(t, rewards[cashbackReconciliationBatchSize-1].ID, cashbackReconciliationProgress.RewardID, "a mismatched page must remain pinned until repaired")

	issues, err = CashbackReconciliationInconsistencyCount()
	require.NoError(t, err)
	assert.EqualValues(t, 1, issues)

	// The payment owns the sole DB connection while an outside scan reaches
	// its first query. The outside scan must not hold the cursor mutex while
	// waiting for the connection, or the transaction's scan deadlocks.
	resetCashbackReconciliationProgress()
	sqlDB, err := DB.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	tx := DB.WithContext(ctx).Begin()
	require.NoError(t, tx.Error)
	defer tx.Rollback()

	type outsideScanKey struct{}
	entered := make(chan struct{})
	var enteredOnce sync.Once
	const callback = "test:reconciliation-single-connection"
	require.NoError(t, DB.Callback().Query().Before("gorm:query").Register(callback, func(query *gorm.DB) {
		if query.Statement.Context.Value(outsideScanKey{}) != nil {
			enteredOnce.Do(func() { close(entered) })
		}
	}))
	defer func() { _ = DB.Callback().Query().Remove(callback) }()

	type scanResult struct {
		issues int64
		err    error
	}
	outside := make(chan scanResult, 1)
	go func() {
		// Exercise cursor locking while waiting for the only connection.
		// The production snapshot waits at Begin before reaching its query.
		page, scanErr := readCashbackReconciliationPageTx(DB.WithContext(context.WithValue(ctx, outsideScanKey{}, true)))
		if scanErr != nil {
			outside <- scanResult{err: scanErr}
			return
		}
		count, scanErr := applyCashbackReconciliationPage(page, true)
		outside <- scanResult{count, scanErr}
	}()
	select {
	case <-entered:
	case <-ctx.Done():
		<-outside
		require.FailNow(t, "outside reconciliation did not start its DB query")
	}

	inside := make(chan scanResult, 1)
	go func() {
		count, scanErr := cashbackReconciliationInconsistencyCountTx(tx, false)
		inside <- scanResult{count, scanErr}
	}()
	select {
	case result := <-inside:
		require.NoError(t, result.err)
		assert.Zero(t, result.issues)
	case <-ctx.Done():
		_ = tx.Rollback().Error
		<-inside
		<-outside
		require.FailNow(t, "payment reconciliation waited on a scan blocked by its DB connection")
	}
	require.NoError(t, tx.Commit().Error)
	result := <-outside
	require.NoError(t, result.err)
	assert.Zero(t, result.issues)
	assert.Equal(t, rewards[cashbackReconciliationBatchSize-1].ID, cashbackReconciliationProgress.RewardID)
	issues, err = CashbackReconciliationInconsistencyCount()
	require.NoError(t, err)
	assert.EqualValues(t, 1, issues)
	assert.True(t, cashbackReconciliationProgress.Pinned)
}

func TestCashbackReconciliationConcurrentCleanCannotUnpinMismatch(t *testing.T) {
	setupCashbackTestDB(t)
	reward := CashbackReward{TopUpID: 1, TradeNo: "cursor-clean", Direction: CashbackDirectionInvitee,
		InviteeID: 2, BeneficiaryID: 2, BaseQuota: 100, RateBPS: 100, CalculatedQuota: 1,
		RewardQuota: 1, SettlementDays: 7, PaidAt: 1, AvailableAt: 2,
		ReviewStatus: CashbackReviewPending, SettlementStatus: CashbackSettlementFrozen,
		RiskLevel: CashbackRiskLow, RiskSnapshot: `{}`, ConfigSnapshot: `{}`}
	require.NoError(t, DB.Create(&reward).Error)

	type pausedScanKey struct{}
	entered, release := make(chan struct{}), make(chan struct{})
	const callback = "test:cursor-stale-clean"
	require.NoError(t, DB.Callback().Query().After("gorm:query").Register(callback, func(query *gorm.DB) {
		if query.Statement.Table == "cashback_rewards" && query.Statement.Context.Value(pausedScanKey{}) != nil {
			close(entered)
			<-release
		}
	}))
	defer func() { _ = DB.Callback().Query().Remove(callback) }()
	type scanResult struct {
		issues int64
		err    error
	}
	stale := make(chan scanResult, 1)
	go func() {
		// Force the intentionally interleaved cursor scan without a snapshot;
		// SQLite cannot commit a writer while a snapshot reader holds its lock.
		page, err := readCashbackReconciliationPageTx(DB.WithContext(context.WithValue(t.Context(), pausedScanKey{}, true)))
		if err != nil {
			stale <- scanResult{err: err}
			return
		}
		issues, err := applyCashbackReconciliationPage(page, true)
		stale <- scanResult{issues, err}
	}()
	<-entered
	require.NoError(t, DB.Session(&gorm.Session{SkipHooks: true}).Model(&reward).Update("recovered_quota", 2).Error)
	issues, err := CashbackReconciliationInconsistencyCount()
	require.NoError(t, err)
	require.EqualValues(t, 1, issues)
	close(release)
	result := <-stale
	assert.ErrorIs(t, result.err, errCashbackReconciliationCursorConflict)
	assert.Zero(t, result.issues)
	assert.True(t, cashbackReconciliationProgress.Pinned)
	assert.Zero(t, cashbackReconciliationProgress.RewardID)
	require.NoError(t, DB.Session(&gorm.Session{SkipHooks: true}).Model(&reward).Update("recovered_quota", 0).Error)
	issues, err = CashbackReconciliationInconsistencyCount()
	require.NoError(t, err)
	assert.Zero(t, issues)
	assert.False(t, cashbackReconciliationProgress.Pinned)
	assert.Equal(t, reward.ID, cashbackReconciliationProgress.RewardID)
}

func TestCashbackReconciliationConcurrentMismatchesKeepEarlierPage(t *testing.T) {
	setupCashbackTestDB(t)
	rewards := make([]CashbackReward, cashbackReconciliationBatchSize+1)
	for i := range rewards {
		rewards[i] = CashbackReward{TopUpID: i + 1, TradeNo: fmt.Sprintf("cursor-mismatch-%d", i),
			Direction: CashbackDirectionInvitee, InviteeID: 2, BeneficiaryID: 2,
			BaseQuota: 100, RateBPS: 100, CalculatedQuota: 1, RewardQuota: 1,
			SettlementDays: 7, PaidAt: 1, AvailableAt: 2,
			ReviewStatus: CashbackReviewPending, SettlementStatus: CashbackSettlementFrozen,
			RiskLevel: CashbackRiskLow, RiskSnapshot: `{}`, ConfigSnapshot: `{}`}
	}
	rewards[cashbackReconciliationBatchSize].RecoveredQuota = 2
	require.NoError(t, DB.Session(&gorm.Session{SkipHooks: true}).Create(&rewards).Error)

	type earlyScanKey struct{}
	type lateScanKey struct{}
	earlyEntered, releaseEarly := make(chan struct{}), make(chan struct{})
	lateEntered, releaseLate := make(chan struct{}), make(chan struct{})
	const callback = "test:cursor-two-mismatches"
	require.NoError(t, DB.Callback().Query().Before("gorm:query").Register(callback, func(query *gorm.DB) {
		if query.Statement.Table == "cashback_rewards" && query.Statement.Context.Value(earlyScanKey{}) != nil {
			close(earlyEntered)
			<-releaseEarly
		}
	}))
	defer func() { _ = DB.Callback().Query().Remove(callback) }()
	require.NoError(t, DB.Callback().Query().After("gorm:query").Register(callback+":after", func(query *gorm.DB) {
		if query.Statement.Table == "cashback_rewards" && query.Statement.Context.Value(lateScanKey{}) != nil {
			close(lateEntered)
			<-releaseLate
		}
	}))
	defer func() { _ = DB.Callback().Query().Remove(callback + ":after") }()
	type scanResult struct {
		issues int64
		err    error
	}
	early := make(chan scanResult, 1)
	go func() {
		page, err := readCashbackReconciliationPageTx(DB.WithContext(context.WithValue(t.Context(), earlyScanKey{}, true)))
		if err != nil {
			early <- scanResult{err: err}
			return
		}
		issues, err := applyCashbackReconciliationPage(page, true)
		early <- scanResult{issues, err}
	}()
	<-earlyEntered
	issues, err := CashbackReconciliationInconsistencyCount()
	require.NoError(t, err)
	require.Zero(t, issues)
	require.Equal(t, rewards[cashbackReconciliationBatchSize-1].ID, cashbackReconciliationProgress.RewardID)
	late := make(chan scanResult, 1)
	go func() {
		page, err := readCashbackReconciliationPageTx(DB.WithContext(context.WithValue(t.Context(), lateScanKey{}, true)))
		if err != nil {
			late <- scanResult{err: err}
			return
		}
		issues, err := applyCashbackReconciliationPage(page, true)
		late <- scanResult{issues, err}
	}()
	<-lateEntered
	require.NoError(t, DB.Session(&gorm.Session{SkipHooks: true}).Model(&rewards[0]).Update("recovered_quota", 2).Error)
	close(releaseEarly)
	first := <-early
	require.NoError(t, first.err)
	require.EqualValues(t, 1, first.issues)
	require.Zero(t, cashbackReconciliationProgress.RewardID)
	close(releaseLate)
	second := <-late
	require.NoError(t, second.err)
	require.EqualValues(t, 1, second.issues)
	assert.True(t, cashbackReconciliationProgress.Pinned)
	assert.Zero(t, cashbackReconciliationProgress.RewardID, "later mismatch must not overwrite earlier pin")

	require.NoError(t, DB.Session(&gorm.Session{SkipHooks: true}).Model(&rewards[0]).Update("recovered_quota", 0).Error)
	issues, err = CashbackReconciliationInconsistencyCount()
	require.NoError(t, err)
	require.Zero(t, issues)
	issues, err = CashbackReconciliationInconsistencyCount()
	require.NoError(t, err)
	assert.EqualValues(t, 1, issues, "later mismatch remains discoverable after earlier repair")
	assert.Equal(t, rewards[cashbackReconciliationBatchSize-1].ID, cashbackReconciliationProgress.RewardID)
}

func TestCashbackReconciliationFailedSnapshotDoesNotAdvance(t *testing.T) {
	setupCashbackTestDB(t)
	cashbackReconciliationProgress.Lock()
	cashbackReconciliationProgress.RewardID = 99
	cashbackReconciliationProgress.Unlock()

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	const callback = "test:reconciliation-snapshot-commit-failure"
	reachedLastQuery := false
	require.NoError(t, DB.Callback().Query().After("gorm:query").Register(callback, func(query *gorm.DB) {
		if query.Statement.Context != ctx || query.Statement.Table != "cashback_quota_mutations" || query.Error != nil {
			return
		}
		reachedLastQuery = true
		cancel() // With empty evidence tables this is the final SELECT, before Commit.
	}))
	defer func() { _ = DB.Callback().Query().Remove(callback) }()
	_, err := cashbackReconciliationInconsistencyCountTx(DB.WithContext(ctx), true)
	require.True(t, reachedLastQuery)
	require.ErrorIs(t, err, context.Canceled)
	assert.EqualValues(t, 99, cashbackReconciliationProgress.RewardID, "a failed snapshot cannot wrap the cursor")

	issues, err := CashbackReconciliationInconsistencyCount()
	require.NoError(t, err)
	assert.Zero(t, issues)
	assert.Zero(t, cashbackReconciliationProgress.RewardID)
}

func TestCashbackReconciliationTransactionRollbackDoesNotAdvanceOrPermanentlyPin(t *testing.T) {
	setupCashbackTestDB(t)
	reward := CashbackReward{TopUpID: 1, TradeNo: "cursor-rollback", Direction: CashbackDirectionInvitee,
		InviteeID: 2, BeneficiaryID: 2, BaseQuota: 100, RateBPS: 100, CalculatedQuota: 1,
		RewardQuota: 1, SettlementDays: 7, PaidAt: 1, AvailableAt: 2,
		ReviewStatus: CashbackReviewPending, SettlementStatus: CashbackSettlementFrozen,
		RiskLevel: CashbackRiskLow, RiskSnapshot: `{}`, ConfigSnapshot: `{}`}
	require.NoError(t, DB.Create(&reward).Error)

	tx := DB.Begin()
	require.NoError(t, tx.Error)
	issues, err := cashbackReconciliationInconsistencyCountTx(tx, false)
	require.NoError(t, err)
	require.Zero(t, issues)
	require.NoError(t, tx.Rollback().Error)
	assert.Zero(t, cashbackReconciliationProgress.RewardID, "a rolled-back clean scan must not advance")

	tx = DB.Begin()
	require.NoError(t, tx.Error)
	require.NoError(t, tx.Session(&gorm.Session{SkipHooks: true}).Model(&reward).Update("recovered_quota", 2).Error)
	issues, err = cashbackReconciliationInconsistencyCountTx(tx, false)
	require.NoError(t, err)
	require.EqualValues(t, 1, issues)
	require.NoError(t, tx.Rollback().Error)
	assert.True(t, cashbackReconciliationProgress.Pinned)
	issues, err = CashbackReconciliationInconsistencyCount()
	require.NoError(t, err)
	require.Zero(t, issues)
	assert.False(t, cashbackReconciliationProgress.Pinned, "rolled-back mismatch must be rechecked and cleared")

	require.NoError(t, DB.Session(&gorm.Session{SkipHooks: true}).Model(&reward).Update("recovered_quota", 2).Error)
	issues, err = CashbackReconciliationInconsistencyCount()
	require.NoError(t, err)
	require.EqualValues(t, 1, issues)
	tx = DB.Begin()
	require.NoError(t, tx.Error)
	require.NoError(t, tx.Session(&gorm.Session{SkipHooks: true}).Model(&reward).Update("recovered_quota", 0).Error)
	_, err = cashbackReconciliationInconsistencyCountTx(tx, false)
	require.ErrorIs(t, err, errCashbackReconciliationCursorConflict, "uncommitted repair cannot clear a pin")
	require.NoError(t, tx.Rollback().Error)
	issues, err = CashbackReconciliationInconsistencyCount()
	require.NoError(t, err)
	assert.EqualValues(t, 1, issues)
	assert.True(t, cashbackReconciliationProgress.Pinned)
}

func TestConcurrentCashbackSettlementCreditsAtMostOnce(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	inviter, invitee := createCashbackUsers(t, now-30*24*60*60)
	order := createCompletedCashbackTopUp(t, invitee, now, now, 100_000, 100_000)
	var reward CashbackReward
	require.NoError(t, DB.Where("top_up_id = ? AND direction = ?", order.Id, CashbackDirectionInviter).First(&reward).Error)
	_, err := ReviewCashbackReward(reward.ID, CashbackReviewActionApprove, "reviewed", 999, now)
	require.NoError(t, err)
	due, err := HasMaturedCashbackRewards(reward.AvailableAt)
	require.NoError(t, err)
	assert.True(t, due)

	outcomes := make(chan CashbackSettlementOutcome, 2)
	errorsChannel := make(chan error, 2)
	var waitGroup sync.WaitGroup
	for range 2 {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			outcome, issueErr := IssueCashbackReward(reward.ID, reward.AvailableAt)
			outcomes <- outcome
			errorsChannel <- issueErr
		}()
	}
	waitGroup.Wait()
	close(outcomes)
	close(errorsChannel)

	issuedCount := 0
	for outcome := range outcomes {
		if outcome.Issued {
			issuedCount++
		}
	}
	assert.LessOrEqual(t, issuedCount, 1)
	successfulCalls := 0
	for issueErr := range errorsChannel {
		if issueErr == nil {
			successfulCalls++
		}
	}
	// SQLite can abort both competing writers with SQLITE_LOCKED. The durable
	// frozen state must remain retryable and still issue exactly once.
	if successfulCalls == 0 {
		outcome, retryErr := IssueCashbackReward(reward.ID, reward.AvailableAt)
		require.NoError(t, retryErr)
		if outcome.Issued {
			issuedCount++
		}
	}
	assert.Equal(t, 1, issuedCount)
	var updatedInviter User
	require.NoError(t, DB.First(&updatedInviter, inviter.Id).Error)
	assert.Equal(t, reward.RewardQuota, updatedInviter.Quota)
	var stored CashbackReward
	require.NoError(t, DB.First(&stored, reward.ID).Error)
	assert.Equal(t, CashbackSettlementIssued, stored.SettlementStatus)
	due, err = HasMaturedCashbackRewards(reward.AvailableAt)
	require.NoError(t, err)
	assert.False(t, due)
}

func TestBlockedSettlementDefersAndRetriesAfterRelationshipIsRestored(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	inviter, invitee := createCashbackUsers(t, now-30*24*60*60)
	order := createCompletedCashbackTopUp(t, invitee, now, now, 100_000, 100_000)
	var reward CashbackReward
	require.NoError(t, DB.Where("top_up_id = ? AND direction = ?", order.Id, CashbackDirectionInviter).First(&reward).Error)
	_, err := ReviewCashbackReward(reward.ID, CashbackReviewActionApprove, "approved", 999, now)
	require.NoError(t, err)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", invitee.Id).Update("inviter_id", 0).Error)

	outcome, err := IssueCashbackReward(reward.ID, reward.AvailableAt)
	require.NoError(t, err)
	assert.True(t, outcome.Blocked)
	require.NoError(t, DB.First(&reward, reward.ID).Error)
	assert.Equal(t, "referral_relationship_changed", reward.BlockingReason)
	assert.Greater(t, reward.NextSettlementAttemptAt, reward.AvailableAt)
	due, err := HasMaturedCashbackRewards(reward.AvailableAt)
	require.NoError(t, err)
	assert.False(t, due)

	require.NoError(t, DB.Model(&User{}).Where("id = ?", invitee.Id).Update("inviter_id", inviter.Id).Error)
	outcome, err = IssueCashbackReward(reward.ID, reward.NextSettlementAttemptAt)
	require.NoError(t, err)
	assert.True(t, outcome.Issued)
	var updatedInviter User
	require.NoError(t, DB.First(&updatedInviter, inviter.Id).Error)
	assert.Equal(t, reward.RewardQuota, updatedInviter.Quota)
}

func TestCashbackReviewCannotOverrideChangedReferralRelationship(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	_, invitee := createCashbackUsers(t, now-30*24*60*60)
	order := createCompletedCashbackTopUp(t, invitee, now, now, 100_000, 100_000)
	var reward CashbackReward
	require.NoError(t, DB.Where("top_up_id = ?", order.Id).First(&reward).Error)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", invitee.Id).Update("inviter_id", 0).Error)

	_, err := ReviewCashbackReward(reward.ID, CashbackReviewActionApprove, "attempted override", 999, reward.AvailableAt)
	assert.ErrorIs(t, err, ErrCashbackHardBlocked)
	require.NoError(t, DB.First(&reward, reward.ID).Error)
	assert.Equal(t, CashbackReviewPending, reward.ReviewStatus)
	assert.Equal(t, "referral_relationship_changed", reward.BlockingReason)
	assert.Greater(t, reward.NextSettlementAttemptAt, reward.AvailableAt)
}

func TestCashbackIncidentIsMonotonicIdempotentAndCreatesDebt(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-4*24*60*60)
	inviter, invitee := createCashbackUsers(t, now-30*24*60*60)
	topUp := createCompletedCashbackTopUp(t, invitee, now-3*24*60*60, now-2*24*60*60, 100_000, 100_000)

	var rewards []CashbackReward
	require.NoError(t, DB.Where("top_up_id = ?", topUp.Id).Find(&rewards).Error)
	for _, reward := range rewards {
		_, err := ReviewCashbackReward(reward.ID, CashbackReviewActionApprove, "approved", 999, reward.AvailableAt)
		require.NoError(t, err)
	}
	first, err := HandleCashbackIncident(topUp.Id, CashbackIncidentInput{
		Kind: CashbackIncidentRefund, CumulativeRefundRateBPS: 5_000, Reason: "provider refund evidence", OperatorID: 999, Now: now,
	})
	require.NoError(t, err)
	assert.Equal(t, 15_000, first.RewardRecoveredQuota)
	assert.Equal(t, 50_000, first.PrincipalRecoveredNow)
	assert.Zero(t, first.RewardDebtQuota)
	var recoveredLedgerQuota int64
	require.NoError(t, DB.Model(&CashbackQuotaMutation{}).
		Where("kind IN ?", []CashbackQuotaMutationKind{CashbackQuotaMutationRewardRecovery, CashbackQuotaMutationPrincipalRecovery}).
		Select("COALESCE(SUM(quota), 0)").Scan(&recoveredLedgerQuota).Error)
	assert.EqualValues(t, 65_000, recoveredLedgerQuota)
	assert.Zero(t, first.PrincipalDebtQuota)
	var incidentEvents int64
	require.NoError(t, DB.Model(&WalletRefundCreditEvent{}).Where("source_type = ? AND source_id = ?", "cashback_incident", topUp.Id).Count(&incidentEvents).Error)
	assert.EqualValues(t, 2, incidentEvents) // Payer and inviter both need manual reconciliation.

	var afterFirst User
	require.NoError(t, DB.First(&afterFirst, invitee.Id).Error)
	firstQuota := afterFirst.Quota
	duplicate, err := HandleCashbackIncident(topUp.Id, CashbackIncidentInput{
		Kind: CashbackIncidentRefund, CumulativeRefundRateBPS: 5_000, Reason: "duplicate callback", OperatorID: 999, Now: now + 1,
	})
	require.NoError(t, err)
	assert.True(t, duplicate.Idempotent)
	require.NoError(t, DB.First(&afterFirst, invitee.Id).Error)
	assert.Equal(t, firstQuota, afterFirst.Quota)
	require.NoError(t, DB.Model(&WalletRefundCreditEvent{}).Where("source_type = ? AND source_id = ?", "cashback_incident", topUp.Id).Count(&incidentEvents).Error)
	assert.EqualValues(t, 2, incidentEvents)

	require.NoError(t, DB.Model(&User{}).Where("id = ?", invitee.Id).Update("quota", 25_000).Error)
	full, err := HandleCashbackIncident(topUp.Id, CashbackIncidentInput{
		Kind: CashbackIncidentRefund, CumulativeRefundRateBPS: 10_000, Reason: "refund increased to full", OperatorID: 999, Now: now + 2,
	})
	require.NoError(t, err)
	assert.Equal(t, 25_000, full.PrincipalRecoveredNow)
	assert.Equal(t, 25_000, full.PrincipalDebtQuota)
	require.NoError(t, DB.Model(&WalletRefundCreditEvent{}).Where("source_type = ? AND source_id = ?", "cashback_incident", topUp.Id).Count(&incidentEvents).Error)
	assert.EqualValues(t, 4, incidentEvents) // An increasing cumulative incident is a new exception, not a grant.

	_, err = HandleCashbackIncident(topUp.Id, CashbackIncidentInput{
		Kind: CashbackIncidentRefund, CumulativeRefundRateBPS: 9_000, Reason: "invalid rollback", OperatorID: 999, Now: now + 3,
	})
	assert.ErrorIs(t, err, ErrCashbackRefundRate)

	resolved, err := ResolveCashbackPrincipalDebt(topUp.Id, 999, "approved accounting write-off", now+4)
	require.NoError(t, err)
	assert.Zero(t, resolved.PrincipalOutstandingDebtQuota)

	var inviterAfter User
	require.NoError(t, DB.First(&inviterAfter, inviter.Id).Error)
	assert.Zero(t, inviterAfter.Quota)
}

func TestIncreasingRefundReopensResolvedPrincipalDebt(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	_, invitee := createCashbackUsers(t, now-30*24*60*60)
	topUp := createCompletedCashbackTopUp(t, invitee, now, now, 100_000, 100_000)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", invitee.Id).Update("quota", 0).Error)

	first, err := HandleCashbackIncident(topUp.Id, CashbackIncidentInput{
		Kind: CashbackIncidentRefund, CumulativeRefundRateBPS: 5_000,
		Reason: "first partial refund", OperatorID: 999, Now: now + 1,
	})
	require.NoError(t, err)
	assert.Equal(t, 50_000, first.PrincipalDebtQuota)
	resolved, err := ResolveCashbackPrincipalDebt(topUp.Id, 999, "first debt disposition", now+2)
	require.NoError(t, err)
	assert.NotZero(t, resolved.PrincipalDebtResolvedAt)

	increased, err := HandleCashbackIncident(topUp.Id, CashbackIncidentInput{
		Kind: CashbackIncidentRefund, CumulativeRefundRateBPS: 10_000,
		Reason: "refund increased to full", OperatorID: 999, Now: now + 3,
	})
	require.NoError(t, err)
	assert.Equal(t, 50_000, increased.PrincipalDebtQuota)
	assert.Zero(t, increased.OrderContext.PrincipalDebtResolvedAt)
	assert.Zero(t, increased.OrderContext.PrincipalDebtResolvedBy)
	assert.Empty(t, increased.OrderContext.PrincipalDebtResolutionReason)
}

func TestCashbackIncidentUsesAuthoritativeCachedQuotaAndTracksDebt(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	inviter, invitee := createCashbackUsers(t, now-30*24*60*60)
	topUp := createCompletedCashbackTopUp(t, invitee, now, now, 100_000, 100_000)
	var rewards []CashbackReward
	require.NoError(t, DB.Where("top_up_id = ?", topUp.Id).Find(&rewards).Error)
	for _, reward := range rewards {
		_, err := ReviewCashbackReward(reward.ID, CashbackReviewActionApprove, "approved", 999, reward.AvailableAt)
		require.NoError(t, err)
	}

	redisServer := useUserCacheMiniRedis(t)
	var inviterRow, inviteeRow User
	require.NoError(t, DB.First(&inviterRow, inviter.Id).Error)
	require.NoError(t, DB.First(&inviteeRow, invitee.Id).Error)
	inviterRow.Quota = 5_000
	inviteeRow.Quota = 20_000
	require.NoError(t, writeUserCache(inviterRow.ToBaseUser(), true))
	require.NoError(t, writeUserCache(inviteeRow.ToBaseUser(), true))

	result, err := HandleCashbackIncident(topUp.Id, CashbackIncidentInput{
		Kind: CashbackIncidentRefund, CumulativeRefundRateBPS: 10_000,
		Reason: "full refund with pending cached consumption", OperatorID: 999, Now: now + 1,
	})
	require.NoError(t, err)
	assert.Equal(t, 10_000, result.RewardRecoveredQuota)
	assert.Equal(t, 5_000, result.RewardDebtQuota)
	assert.Equal(t, 15_000, result.PrincipalRecoveredNow)
	assert.Equal(t, 85_000, result.PrincipalDebtQuota)

	require.NoError(t, DB.First(&inviterRow, inviter.Id).Error)
	require.NoError(t, DB.First(&inviteeRow, invitee.Id).Error)
	assert.Equal(t, 5_000, inviterRow.Quota)
	assert.Equal(t, 85_000, inviteeRow.Quota)
	_, err = cacheGetUserBase(inviter.Id)
	assert.ErrorIs(t, err, ErrUserQuotaMutationPending)
	_, err = cacheGetUserBase(invitee.Id)
	assert.ErrorIs(t, err, ErrUserQuotaMutationPending)
	assert.False(t, redisServer.Exists(getUserCacheKey(inviter.Id)))
	assert.False(t, redisServer.Exists(getUserCacheKey(invitee.Id)))
	redisServer.FastForward(time.Duration(userQuotaMutationCooldownSeconds()+1) * time.Second)
	inviterCache, err := GetUserCache(inviter.Id)
	require.NoError(t, err)
	inviteeCache, err := GetUserCache(invitee.Id)
	require.NoError(t, err)
	assert.Equal(t, 5_000, inviterCache.Quota)
	assert.Equal(t, 85_000, inviteeCache.Quota)
}

func TestCashbackIncidentWaitsForPendingPositiveBatchQuota(t *testing.T) {
	for _, testCase := range []struct {
		name                string
		populateInviteeHash bool
	}{
		{name: "cached", populateInviteeHash: true},
		{name: "cold_cache", populateInviteeHash: false},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			setupCashbackTestDB(t)
			resetBatchUpdateTestState(t)
			now := time.Now().Unix()
			saveCashbackTestSetting(t, now-100)
			inviter, invitee := createCashbackUsers(t, now-30*24*60*60)
			topUp := createCompletedCashbackTopUp(t, invitee, now, now, 100_000, 100_000)
			var rewards []CashbackReward
			require.NoError(t, DB.Where("top_up_id = ?", topUp.Id).Order("id asc").Find(&rewards).Error)
			for _, reward := range rewards {
				_, err := ReviewCashbackReward(reward.ID, CashbackReviewActionApprove, "approved", 999, reward.AvailableAt)
				require.NoError(t, err)
			}

			redisServer := useUserCacheMiniRedis(t)
			var inviterRow, inviteeRow User
			require.NoError(t, DB.First(&inviterRow, inviter.Id).Error)
			require.NoError(t, DB.Model(&User{}).Where("id = ?", invitee.Id).Update("quota", 0).Error)
			require.NoError(t, DB.First(&inviteeRow, invitee.Id).Error)
			require.NoError(t, writeUserCache(inviterRow.ToBaseUser(), true))
			if testCase.populateInviteeHash {
				pendingInvitee := inviteeRow
				pendingInvitee.Quota = 5_000
				require.NoError(t, writeUserCache(pendingInvitee.ToBaseUser(), true))
			}
			common.BatchUpdateEnabled = true
			addNewRecord(BatchUpdateTypeUserQuota, invitee.Id, 5_000)

			_, err := HandleCashbackIncident(topUp.Id, CashbackIncidentInput{
				Kind: CashbackIncidentRefund, CumulativeRefundRateBPS: 10_000,
				Reason: "wait for positive batch quota", OperatorID: 999, Now: now + 1,
			})
			assert.ErrorIs(t, err, ErrUserQuotaMutationPending)

			var orderContext CashbackOrderContext
			require.NoError(t, DB.Where("top_up_id = ?", topUp.Id).First(&orderContext).Error)
			assert.Empty(t, orderContext.IncidentKind)
			assert.Zero(t, orderContext.PrincipalRecoveredQuota)
			assert.Zero(t, orderContext.PrincipalOutstandingDebtQuota)
			var recoveryMutationCount int64
			require.NoError(t, DB.Model(&CashbackQuotaMutation{}).
				Where("kind IN ?", []CashbackQuotaMutationKind{CashbackQuotaMutationRewardRecovery, CashbackQuotaMutationPrincipalRecovery}).
				Count(&recoveryMutationCount).Error)
			assert.Zero(t, recoveryMutationCount)
			for _, reward := range rewards {
				var stored CashbackReward
				require.NoError(t, DB.First(&stored, reward.ID).Error)
				assert.Equal(t, CashbackSettlementIssued, stored.SettlementStatus)
				assert.Zero(t, stored.RecoveredQuota)
				assert.Zero(t, stored.OutstandingDebtQuota)
			}

			batchUpdate()
			assert.Equal(t, 5_000, getUserQuotaFromDB(t, invitee.Id))
			redisServer.FastForward(time.Duration(userQuotaMutationCooldownSeconds()+1) * time.Second)

			result, err := HandleCashbackIncident(topUp.Id, CashbackIncidentInput{
				Kind: CashbackIncidentRefund, CumulativeRefundRateBPS: 10_000,
				Reason: "retry after positive batch quota flush", OperatorID: 999, Now: now + 2,
			})
			require.NoError(t, err)
			assert.Equal(t, 15_000, result.RewardRecoveredQuota)
			assert.Zero(t, result.RewardDebtQuota)
			assert.Zero(t, result.PrincipalRecoveredNow)
			assert.Equal(t, 100_000, result.PrincipalDebtQuota)
			assert.Zero(t, getUserQuotaFromDB(t, inviter.Id))
			assert.Zero(t, getUserQuotaFromDB(t, invitee.Id))
		})
	}
}

func TestCashbackIncidentLostFenceInvalidatesRolledBackCacheDebit(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	inviter, invitee := createCashbackUsers(t, now-30*24*60*60)
	topUp := createCompletedCashbackTopUp(t, invitee, now, now, 100_000, 100_000)
	var rewards []CashbackReward
	require.NoError(t, DB.Where("top_up_id = ?", topUp.Id).Order("id asc").Find(&rewards).Error)
	for _, reward := range rewards {
		_, err := ReviewCashbackReward(reward.ID, CashbackReviewActionApprove, "approved", 999, reward.AvailableAt)
		require.NoError(t, err)
	}

	redisServer := useUserCacheMiniRedis(t)
	var inviterRow, inviteeRow User
	require.NoError(t, DB.First(&inviterRow, inviter.Id).Error)
	require.NoError(t, DB.First(&inviteeRow, invitee.Id).Error)
	require.NoError(t, writeUserCache(inviterRow.ToBaseUser(), true))
	require.NoError(t, writeUserCache(inviteeRow.ToBaseUser(), true))
	inviterQuotaBefore, inviteeQuotaBefore := inviterRow.Quota, inviteeRow.Quota

	const replacementOwner = "replacement-owner"
	callbackName := "test:cashback-incident-fence-lost"
	replaced := false
	require.NoError(t, DB.Callback().Update().After("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if !replaced && tx.Statement.Table == "cashback_rewards" {
			replaced = true
			_ = common.RDB.Set(t.Context(), getUserQuotaMutationFenceKey(inviter.Id), replacementOwner, time.Minute).Err()
		}
	}))
	callbackRegistered := true
	t.Cleanup(func() {
		if callbackRegistered {
			_ = DB.Callback().Update().Remove(callbackName)
		}
	})

	_, err := HandleCashbackIncident(topUp.Id, CashbackIncidentInput{
		Kind: CashbackIncidentRefund, CumulativeRefundRateBPS: 10_000,
		Reason: "lose incident fence ownership", OperatorID: 999, Now: now + 1,
	})
	assert.ErrorIs(t, err, ErrUserQuotaMutationFenceLost)
	require.NoError(t, DB.Callback().Update().Remove(callbackName))
	callbackRegistered = false

	require.NoError(t, DB.First(&inviterRow, inviter.Id).Error)
	require.NoError(t, DB.First(&inviteeRow, invitee.Id).Error)
	assert.Equal(t, inviterQuotaBefore, inviterRow.Quota)
	assert.Equal(t, inviteeQuotaBefore, inviteeRow.Quota)
	assert.False(t, redisServer.Exists(getUserCacheKey(inviter.Id)), "rolled-back cache debit must never remain readable")
	owner, ownerErr := common.RDB.Get(t.Context(), getUserQuotaMutationFenceKey(inviter.Id)).Result()
	require.NoError(t, ownerErr)
	assert.Equal(t, replacementOwner, owner, "finalization must not delete a replacement owner's fence")
	_, err = cacheGetUserBase(inviter.Id)
	assert.ErrorIs(t, err, ErrUserQuotaMutationPending)

	var orderContext CashbackOrderContext
	require.NoError(t, DB.Where("top_up_id = ?", topUp.Id).First(&orderContext).Error)
	assert.Empty(t, orderContext.IncidentKind)
	for _, reward := range rewards {
		var stored CashbackReward
		require.NoError(t, DB.First(&stored, reward.ID).Error)
		assert.Equal(t, CashbackSettlementIssued, stored.SettlementStatus)
		assert.Zero(t, stored.RecoveredQuota)
		assert.Zero(t, stored.OutstandingDebtQuota)
	}
	var recoveryMutationCount int64
	require.NoError(t, DB.Model(&CashbackQuotaMutation{}).
		Where("kind IN ?", []CashbackQuotaMutationKind{CashbackQuotaMutationRewardRecovery, CashbackQuotaMutationPrincipalRecovery}).
		Count(&recoveryMutationCount).Error)
	assert.Zero(t, recoveryMutationCount)
}

func TestCashbackIncidentRestoresCacheReservationWhenTransactionRollsBack(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	inviter, invitee := createCashbackUsers(t, now-30*24*60*60)
	topUp := createCompletedCashbackTopUp(t, invitee, now, now, 100_000, 100_000)
	var rewards []CashbackReward
	require.NoError(t, DB.Where("top_up_id = ?", topUp.Id).Find(&rewards).Error)
	for _, reward := range rewards {
		_, err := ReviewCashbackReward(reward.ID, CashbackReviewActionApprove, "approved", 999, reward.AvailableAt)
		require.NoError(t, err)
	}

	redisServer := useUserCacheMiniRedis(t)
	var inviterRow, inviteeRow User
	require.NoError(t, DB.First(&inviterRow, inviter.Id).Error)
	require.NoError(t, DB.First(&inviteeRow, invitee.Id).Error)
	require.NoError(t, writeUserCache(inviterRow.ToBaseUser(), true))
	require.NoError(t, writeUserCache(inviteeRow.ToBaseUser(), true))
	inviterQuotaBefore, inviteeQuotaBefore := inviterRow.Quota, inviteeRow.Quota

	forcedErr := errors.New("forced cashback reward update failure")
	callbackName := "test:cashback-incident-rollback"
	require.NoError(t, DB.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table == "cashback_rewards" {
			tx.AddError(forcedErr)
		}
	}))
	callbackRegistered := true
	t.Cleanup(func() {
		if callbackRegistered {
			_ = DB.Callback().Update().Remove(callbackName)
		}
	})

	_, err := HandleCashbackIncident(topUp.Id, CashbackIncidentInput{
		Kind: CashbackIncidentRefund, CumulativeRefundRateBPS: 10_000,
		Reason: "force rollback", OperatorID: 999, Now: now + 1,
	})
	assert.ErrorIs(t, err, forcedErr)
	require.NoError(t, DB.Callback().Update().Remove(callbackName))
	callbackRegistered = false

	require.NoError(t, DB.First(&inviterRow, inviter.Id).Error)
	require.NoError(t, DB.First(&inviteeRow, invitee.Id).Error)
	assert.Equal(t, inviterQuotaBefore, inviterRow.Quota)
	assert.Equal(t, inviteeQuotaBefore, inviteeRow.Quota)
	_, err = cacheGetUserBase(inviter.Id)
	assert.ErrorIs(t, err, ErrUserQuotaMutationPending)
	_, err = cacheGetUserBase(invitee.Id)
	assert.ErrorIs(t, err, ErrUserQuotaMutationPending)
	redisServer.FastForward(time.Duration(userQuotaMutationCooldownSeconds()+1) * time.Second)
	inviterCache, err := GetUserCache(inviter.Id)
	require.NoError(t, err)
	inviteeCache, err := GetUserCache(invitee.Id)
	require.NoError(t, err)
	assert.Equal(t, inviterQuotaBefore, inviterCache.Quota)
	assert.Equal(t, inviteeQuotaBefore, inviteeCache.Quota)
	var orderContext CashbackOrderContext
	require.NoError(t, DB.Where("top_up_id = ?", topUp.Id).First(&orderContext).Error)
	assert.Empty(t, orderContext.IncidentKind)
}

func TestResolvingOneCashbackDebtKeepsBlockersUntilAllDebtIsClosed(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	inviter, invitee := createCashbackUsers(t, now-30*24*60*60)
	newReward := func(topUpID int, status CashbackSettlementStatus, debt int) CashbackReward {
		return CashbackReward{
			TopUpID: topUpID, TradeNo: fmt.Sprintf("debt-order-%d", topUpID),
			Direction: CashbackDirectionInvitee, InviteeID: invitee.Id, InviterID: inviter.Id, BeneficiaryID: invitee.Id,
			BaseQuota: 1_000, RateBPS: 1_000, CalculatedQuota: 100, RewardQuota: 100,
			SettlementDays: 7, PaidAt: now, AvailableAt: now + 7*24*60*60,
			ReviewStatus: CashbackReviewApproved, SettlementStatus: status, RiskLevel: CashbackRiskLow,
			RiskSnapshot: `{}`, ConfigSnapshot: `{}`, OutstandingDebtQuota: debt,
		}
	}
	firstDebt := newReward(101, CashbackSettlementDebt, 100)
	secondDebt := newReward(102, CashbackSettlementDebt, 100)
	blocked := newReward(103, CashbackSettlementFrozen, 0)
	blocked.BlockingReason = "beneficiary_has_open_cashback_debt"
	blocked.NextSettlementAttemptAt = now + 300
	require.NoError(t, DB.Create(&firstDebt).Error)
	require.NoError(t, DB.Create(&secondDebt).Error)
	require.NoError(t, DB.Create(&blocked).Error)

	_, err := ResolveCashbackRewardDebt(firstDebt.ID, 999, "first disposition", now+1)
	require.NoError(t, err)
	require.NoError(t, DB.First(&blocked, blocked.ID).Error)
	assert.Equal(t, "beneficiary_has_open_cashback_debt", blocked.BlockingReason)
	assert.NotZero(t, blocked.NextSettlementAttemptAt)

	_, err = ResolveCashbackRewardDebt(secondDebt.ID, 999, "second disposition", now+2)
	require.NoError(t, err)
	require.NoError(t, DB.First(&blocked, blocked.ID).Error)
	assert.Empty(t, blocked.BlockingReason)
	assert.Zero(t, blocked.NextSettlementAttemptAt)
}

func TestCashbackIncidentRestoresCacheReservationWhenTransactionPanics(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	inviter, invitee := createCashbackUsers(t, now-30*24*60*60)
	topUp := createCompletedCashbackTopUp(t, invitee, now, now, 100_000, 100_000)
	var rewards []CashbackReward
	require.NoError(t, DB.Where("top_up_id = ?", topUp.Id).Find(&rewards).Error)
	for _, reward := range rewards {
		_, err := ReviewCashbackReward(reward.ID, CashbackReviewActionApprove, "approved", 999, reward.AvailableAt)
		require.NoError(t, err)
	}

	redisServer := useUserCacheMiniRedis(t)
	var inviterRow, inviteeRow User
	require.NoError(t, DB.First(&inviterRow, inviter.Id).Error)
	require.NoError(t, DB.First(&inviteeRow, invitee.Id).Error)
	require.NoError(t, writeUserCache(inviterRow.ToBaseUser(), true))
	require.NoError(t, writeUserCache(inviteeRow.ToBaseUser(), true))
	inviterQuotaBefore, inviteeQuotaBefore := inviterRow.Quota, inviteeRow.Quota

	callbackName := "test:cashback-incident-panic"
	require.NoError(t, DB.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table == "cashback_rewards" {
			panic("forced cashback reward update panic")
		}
	}))
	callbackRegistered := true
	t.Cleanup(func() {
		if callbackRegistered {
			_ = DB.Callback().Update().Remove(callbackName)
		}
	})

	assert.Panics(t, func() {
		_, _ = HandleCashbackIncident(topUp.Id, CashbackIncidentInput{
			Kind: CashbackIncidentRefund, CumulativeRefundRateBPS: 10_000,
			Reason: "force panic rollback", OperatorID: 999, Now: now + 1,
		})
	})
	require.NoError(t, DB.Callback().Update().Remove(callbackName))
	callbackRegistered = false

	require.NoError(t, DB.First(&inviterRow, inviter.Id).Error)
	require.NoError(t, DB.First(&inviteeRow, invitee.Id).Error)
	assert.Equal(t, inviterQuotaBefore, inviterRow.Quota)
	assert.Equal(t, inviteeQuotaBefore, inviteeRow.Quota)
	_, err := cacheGetUserBase(inviter.Id)
	assert.ErrorIs(t, err, ErrUserQuotaMutationPending)
	_, err = cacheGetUserBase(invitee.Id)
	assert.ErrorIs(t, err, ErrUserQuotaMutationPending)
	redisServer.FastForward(time.Duration(userQuotaMutationCooldownSeconds()+1) * time.Second)
	inviterCache, err := GetUserCache(inviter.Id)
	require.NoError(t, err)
	inviteeCache, err := GetUserCache(invitee.Id)
	require.NoError(t, err)
	assert.Equal(t, inviterQuotaBefore, inviterCache.Quota)
	assert.Equal(t, inviteeQuotaBefore, inviteeCache.Quota)
}

func TestCashbackUsesPaymentTimeDirectionAndConfigurationSnapshot(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	initial := saveCashbackTestSetting(t, now-100)
	_, invitee := createCashbackUsers(t, now-30*24*60*60)

	order := TopUp{
		UserId: invitee.Id, Amount: 100, Money: 100, TradeNo: "payment-time-config",
		PaymentMethod: PaymentMethodWaffo, PaymentProvider: PaymentProviderWaffo,
		CreateTime: now, Status: common.TopUpStatusPending,
	}
	require.NoError(t, insertCashbackTestTopUp(&order, 100_000, CashbackRequestMetadata{}))

	updated := initial
	updated.InviterEnabled = false
	updated.InviteeEnabled = true
	updated.InviteeRateBPS = 2_000
	updated.Version = 4
	require.NoError(t, SaveCashbackSetting(updated))
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		var locked TopUp
		if err := lockForUpdate(tx).First(&locked, order.Id).Error; err != nil {
			return err
		}
		locked.Status = common.TopUpStatusSuccess
		locked.CompleteTime = now + 1
		if err := tx.Save(&locked).Error; err != nil {
			return err
		}
		return CompleteTopUpCashbackTx(tx, &locked, 100_000, CashbackCompletionProviderCallback)
	}))

	var rewards []CashbackReward
	require.NoError(t, DB.Where("top_up_id = ?", order.Id).Find(&rewards).Error)
	require.Len(t, rewards, 1)
	assert.Equal(t, CashbackDirectionInvitee, rewards[0].Direction)
	assert.Equal(t, 2_000, rewards[0].RateBPS)
	assert.Equal(t, 20_000, rewards[0].CalculatedQuota)
	assert.EqualValues(t, 4, rewards[0].ConfigVersion)

	updated.InviteeRateBPS = 500
	updated.Version = 5
	require.NoError(t, SaveCashbackSetting(updated))
	var unchanged CashbackReward
	require.NoError(t, DB.First(&unchanged, rewards[0].ID).Error)
	assert.Equal(t, 20_000, unchanged.CalculatedQuota)
	assert.EqualValues(t, 4, unchanged.ConfigVersion)
}

func TestCashbackCapsEachBeneficiaryAcrossRollingDay(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	setting := saveCashbackTestSetting(t, now-100)
	setting.MaxRewardQuota = 7_000
	setting.DailyRewardQuota = 10_000
	require.NoError(t, SaveCashbackSetting(setting))
	_, invitee := createCashbackUsers(t, now-30*24*60*60)

	first := createCompletedCashbackTopUp(t, invitee, now, now, 100_000, 100_000)
	second := createCompletedCashbackTopUp(t, invitee, now+1, now+1, 100_000, 100_000)
	var inviterRewards []CashbackReward
	require.NoError(t, DB.Where("top_up_id IN ? AND direction = ?", []int{first.Id, second.Id}, CashbackDirectionInviter).Order("top_up_id asc").Find(&inviterRewards).Error)
	require.Len(t, inviterRewards, 2)
	assert.Equal(t, 7_000, inviterRewards[0].RewardQuota)
	assert.Contains(t, inviterRewards[0].CapReason, "single_cap")
	assert.Equal(t, 3_000, inviterRewards[1].RewardQuota)
	assert.Contains(t, inviterRewards[1].CapReason, "daily_cap")
}

func TestCashbackRejectedRewardDoesNotConsumeDailyCap(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	setting := saveCashbackTestSetting(t, now-100)
	setting.MaxRewardQuota = 7_000
	setting.DailyRewardQuota = 10_000
	require.NoError(t, SaveCashbackSetting(setting))
	_, invitee := createCashbackUsers(t, now-30*24*60*60)

	first := createCompletedCashbackTopUp(t, invitee, now, now, 100_000, 100_000)
	var rejected CashbackReward
	require.NoError(t, DB.Where("top_up_id = ? AND direction = ?", first.Id, CashbackDirectionInviter).First(&rejected).Error)
	require.Equal(t, 7_000, rejected.RewardQuota)
	_, err := ReviewCashbackReward(rejected.ID, CashbackReviewActionReject, "not eligible", 999, now)
	require.NoError(t, err)

	second := createCompletedCashbackTopUp(t, invitee, now+1, now+1, 100_000, 100_000)
	var next CashbackReward
	require.NoError(t, DB.Where("top_up_id = ? AND direction = ?", second.Id, CashbackDirectionInviter).First(&next).Error)
	assert.Equal(t, 7_000, next.RewardQuota)
	assert.NotContains(t, next.CapReason, "daily_cap")
}

func TestCashbackRiskFlagsSharedSignalsWithoutAutomaticallyRejecting(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	setting := saveCashbackTestSetting(t, now-100)
	setting.IPAccountThreshold = 2
	require.NoError(t, SaveCashbackSetting(setting))
	_, invitee := createCashbackUsers(t, now-30*24*60*60)
	other := User{Username: "cashback-associated", Password: "password", AffCode: "associated-code", Status: common.UserStatusEnabled, Role: common.RoleCommonUser, CreatedAt: now - 30*24*60*60}
	require.NoError(t, DB.Create(&other).Error)
	signal := "v1:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
	associatedOrder := TopUp{UserId: other.Id, TradeNo: "associated-order", PaymentProvider: PaymentProviderEpay, CreateTime: now, Status: common.TopUpStatusPending}
	require.NoError(t, insertCashbackTestTopUp(&associatedOrder, 100, CashbackRequestMetadata{RequestIP: "203.0.113.44", DeviceSignal: signal}))

	order := TopUp{
		UserId: invitee.Id, Amount: 100, Money: 100, TradeNo: "shared-signal-order",
		PaymentMethod: PaymentMethodWaffo, PaymentProvider: PaymentProviderWaffo,
		CreateTime: now + 1, Status: common.TopUpStatusPending,
	}
	require.NoError(t, insertCashbackTestTopUp(&order, 100_000, CashbackRequestMetadata{RequestIP: "203.0.113.44", DeviceSignal: signal}))
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		var locked TopUp
		if err := lockForUpdate(tx).First(&locked, order.Id).Error; err != nil {
			return err
		}
		locked.Status = common.TopUpStatusSuccess
		locked.CompleteTime = now + 2
		if err := tx.Save(&locked).Error; err != nil {
			return err
		}
		return CompleteTopUpCashbackTx(tx, &locked, 100_000, CashbackCompletionProviderCallback)
	}))

	var reward CashbackReward
	require.NoError(t, DB.Where("top_up_id = ?", order.Id).First(&reward).Error)
	assert.Equal(t, CashbackSettlementFrozen, reward.SettlementStatus)
	var risk CashbackRiskSnapshot
	require.NoError(t, common.UnmarshalJsonStr(reward.RiskSnapshot, &risk))
	assert.Contains(t, risk.Flags, "shared_ip_accounts")
	assert.Contains(t, risk.Flags, "shared_device_accounts")
}

func TestCashbackRiskFlagsMissingRequestSignalsWithoutBlockingTopUp(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	_, invitee := createCashbackUsers(t, now-30*24*60*60)
	order := TopUp{
		UserId: invitee.Id, Amount: 1, Money: 1, TradeNo: "missing-risk-signals",
		PaymentMethod: PaymentMethodWaffo, PaymentProvider: PaymentProviderWaffo,
		CreateTime: now, Status: common.TopUpStatusPending,
	}
	require.NoError(t, insertCashbackTestTopUp(&order, 100_000, CashbackRequestMetadata{}))
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		var locked TopUp
		if err := lockForUpdate(tx).First(&locked, order.Id).Error; err != nil {
			return err
		}
		locked.Status = common.TopUpStatusSuccess
		locked.CompleteTime = now + 1
		if err := tx.Save(&locked).Error; err != nil {
			return err
		}
		return CompleteTopUpCashbackTx(tx, &locked, 100_000, CashbackCompletionProviderCallback)
	}))

	var reward CashbackReward
	require.NoError(t, DB.Where("top_up_id = ?", order.Id).First(&reward).Error)
	assert.Equal(t, CashbackSettlementFrozen, reward.SettlementStatus)
	var risk CashbackRiskSnapshot
	require.NoError(t, common.UnmarshalJsonStr(reward.RiskSnapshot, &risk))
	assert.Contains(t, risk.Flags, "request_ip_missing")
	assert.Contains(t, risk.Flags, "user_agent_missing")
	assert.Contains(t, risk.Flags, "device_missing")
}

func TestCashbackCapturesRegistrationIPWithoutDeviceFingerprint(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	_, invitee := createCashbackUsers(t, now-30*24*60*60)
	require.NoError(t, RecordCashbackDeviceLink(
		invitee.Id,
		"",
		"198.51.100.10",
		"registration-agent",
		CashbackDeviceSourceRegistration,
	))
	var registrationLink CashbackDeviceLink
	require.NoError(t, DB.Where("user_id = ?", invitee.Id).First(&registrationLink).Error)
	assert.Equal(t, CashbackDeviceSignalMissing, registrationLink.DeviceSignalStatus)
	assert.Equal(t, "198.51.100.10", registrationLink.FirstIP)
	assert.Len(t, registrationLink.DeviceFingerprintHash, 64)
	other := User{
		Username: "registration-ip-associated", Password: "password", AffCode: "registration-ip-associated",
		Status: common.UserStatusEnabled, Role: common.RoleCommonUser, CreatedAt: now - 30*24*60*60,
	}
	require.NoError(t, DB.Create(&other).Error)
	require.NoError(t, RecordCashbackDeviceLink(
		other.Id,
		"",
		"203.0.113.10",
		"other-registration-agent",
		CashbackDeviceSourceRegistration,
	))

	orderTime := time.Now().Unix()
	order := TopUp{
		UserId: invitee.Id, Amount: 1, Money: 1, TradeNo: "registration-ip-risk",
		PaymentMethod: PaymentMethodWaffo, PaymentProvider: PaymentProviderWaffo,
		CreateTime: orderTime, Status: common.TopUpStatusPending,
	}
	require.NoError(t, insertCashbackTestTopUp(&order, 100_000, CashbackRequestMetadata{
		RequestIP: "203.0.113.10", UserAgent: "topup-agent",
	}))
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		var locked TopUp
		if err := lockForUpdate(tx).First(&locked, order.Id).Error; err != nil {
			return err
		}
		locked.Status = common.TopUpStatusSuccess
		locked.CompleteTime = orderTime + 1
		if err := tx.Save(&locked).Error; err != nil {
			return err
		}
		return CompleteTopUpCashbackTx(tx, &locked, 100_000, CashbackCompletionProviderCallback)
	}))

	var reward CashbackReward
	require.NoError(t, DB.Where("top_up_id = ?", order.Id).First(&reward).Error)
	var risk CashbackRiskSnapshot
	require.NoError(t, common.UnmarshalJsonStr(reward.RiskSnapshot, &risk))
	assert.Equal(t, "198.51.100.10", risk.FirstObservedIP)
	assert.Contains(t, risk.Flags, "first_observed_ip_mismatch")
	assert.Equal(t, 2, risk.IPAssociatedAccountCount)
	assert.Equal(t, 0, risk.RecentDeviceCount)
}

func TestSelfReferralNeverCreatesInviterCashback(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	user := User{Username: "self-referral", Password: "password", AffCode: "self-code", Status: common.UserStatusEnabled, Role: common.RoleCommonUser, CreatedAt: now - 1000}
	require.NoError(t, DB.Create(&user).Error)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", user.Id).Update("inviter_id", user.Id).Error)
	user.InviterId = user.Id
	order := createCompletedCashbackTopUp(t, user, now, now, 100_000, 100_000)
	var count int64
	require.NoError(t, DB.Model(&CashbackReward{}).Where("top_up_id = ?", order.Id).Count(&count).Error)
	assert.EqualValues(t, 1, count)
	var reward CashbackReward
	require.NoError(t, DB.Where("top_up_id = ?", order.Id).First(&reward).Error)
	assert.Equal(t, CashbackDirectionInvitee, reward.Direction)
	assert.Zero(t, reward.InviterID)
}

func TestWalletRefundCreditEventsAreOrderedAtomicAndNonrefundable(t *testing.T) {
	db := setupCashbackTestDB(t)
	user := User{Username: "wallet-credit-legacy", Status: common.UserStatusEnabled, Quota: 30}
	require.NoError(t, db.Create(&user).Error) // Old mixed balance has no historical purchase provenance.
	cents := int64(125)
	_, err := AdjustUserQuota(user.Id, 999, common.RoleRootUser, "add", 20, &cents)
	require.NoError(t, err)
	var events []WalletRefundCreditEvent
	require.NoError(t, db.Where("user_id = ?", user.Id).Order("id").Find(&events).Error)
	require.Len(t, events, 2)
	assert.Equal(t, []string{walletRefundOpening, walletRefundPurchase}, []string{events[0].Kind, events[1].Kind})
	assert.Equal(t, []int64{30, 20}, []int64{events[0].Quota, events[1].Quota})
	var evidence AdminQuotaCreditEvidence
	require.NoError(t, db.First(&evidence, events[1].SourceID).Error)
	assert.Equal(t, "admin_add", events[1].SourceType)
	assert.Equal(t, &cents, evidence.CNYCents)
	assert.Equal(t, int64(user.Id), evidence.UserID)

	require.NoError(t, db.AutoMigrate(&Redemption{}, &Checkin{}))
	code := Redemption{Key: "wallet-credit-code", Quota: 7, Status: common.RedemptionCodeStatusEnabled}
	require.NoError(t, db.Create(&code).Error)
	_, err = Redeem(code.Key, user.Id)
	require.NoError(t, err)
	_, err = Redeem(code.Key, user.Id)
	require.Error(t, err)
	setting := operation_setting.GetCheckinSetting()
	previous := *setting
	t.Cleanup(func() { *setting = previous })
	*setting = operation_setting.CheckinSetting{Enabled: true, MinQuota: 5, MaxQuota: 5}
	checkin, err := UserCheckin(user.Id)
	require.NoError(t, err)
	_, err = UserCheckin(user.Id)
	require.Error(t, err)

	transfer := User{Id: user.Id}
	// The affiliate minimum is a full quota unit; use an isolated larger balance.
	minimum := common.QuotaFromFloat(common.QuotaPerUnit)
	require.NoError(t, db.Model(&User{}).Where("id = ?", user.Id).Update("aff_quota", minimum).Error)
	require.NoError(t, transfer.TransferAffQuotaToQuota(minimum))
	_, err = AdjustUserQuota(user.Id, 999, common.RoleRootUser, "subtract", 2, nil)
	require.NoError(t, err)
	_, err = AdjustUserQuota(user.Id, 999, common.RoleRootUser, "override", 1, nil)
	require.NoError(t, err)
	require.NoError(t, db.Where("user_id = ?", user.Id).Order("id").Find(&events).Error)
	require.Len(t, events, 7)
	assert.Equal(t, []string{walletRefundOpening, walletRefundPurchase, walletRefundNonrefundable, walletRefundNonrefundable, walletRefundNonrefundable, walletRefundException, walletRefundException},
		[]string{events[0].Kind, events[1].Kind, events[2].Kind, events[3].Kind, events[4].Kind, events[5].Kind, events[6].Kind})
	assert.Equal(t, []int64{30, 20, 7, 5, int64(minimum), 0, 0},
		[]int64{events[0].Quota, events[1].Quota, events[2].Quota, events[3].Quota, events[4].Quota, events[5].Quota, events[6].Quota})
	assert.Equal(t, int64(code.Id), events[2].SourceID)
	assert.Equal(t, int64(checkin.Id), events[3].SourceID)
	assert.Equal(t, "affiliate_transfer", events[4].SourceType)
	assert.Less(t, events[0].ID, events[1].ID)
	assert.Less(t, events[1].ID, events[2].ID)
	require.Error(t, db.Create(&WalletRefundCreditEvent{UserID: events[1].UserID, EventKey: events[1].EventKey, Kind: walletRefundPurchase, SourceType: "admin_add", SourceID: evidence.ID, Quota: 20, CreatedAt: events[1].CreatedAt}).Error)

	debtUser := User{Username: "wallet-credit-negative-opening", AffCode: "wallet-credit-negative", Status: common.UserStatusEnabled, Quota: -10}
	require.NoError(t, db.Create(&debtUser).Error)
	_, err = AdjustUserQuota(debtUser.Id, 999, common.RoleRootUser, "add", 20, nil)
	require.NoError(t, err) // Existing negative balances must not prevent a legitimate credit.
	var debtEvents []WalletRefundCreditEvent
	require.NoError(t, db.Where("user_id = ?", debtUser.Id).Order("id").Find(&debtEvents).Error)
	require.Len(t, debtEvents, 3)
	assert.Equal(t, []string{walletRefundOpening, walletRefundException, walletRefundPurchase}, []string{debtEvents[0].Kind, debtEvents[1].Kind, debtEvents[2].Kind})
	assert.Zero(t, debtEvents[0].Quota)

	var before User
	require.NoError(t, db.First(&before, user.Id).Error)
	require.NoError(t, db.Migrator().DropTable(&WalletRefundCreditEvent{}))
	_, err = AdjustUserQuota(user.Id, 999, common.RoleRootUser, "add", 9, nil)
	require.Error(t, err)
	var after User
	require.NoError(t, db.First(&after, user.Id).Error)
	assert.Equal(t, before.Quota, after.Quota)
	var evidenceCount int64
	require.NoError(t, db.Model(&AdminQuotaCreditEvidence{}).Where("user_id = ?", user.Id).Count(&evidenceCount).Error)
	assert.EqualValues(t, 1, evidenceCount)
}

func TestAffiliateTransferRejectsWalletOverflowWithoutSpendingAffiliateBalance(t *testing.T) {
	minimum := common.QuotaFromFloat(common.QuotaPerUnit)
	for _, tc := range []struct {
		name                     string
		quota, wallet, affiliate int
	}{
		{"transfer_above_limit", common.MaxWalletQuota + 1, 100, common.MaxWalletQuota + 1},
		{"wallet_would_exceed_limit", minimum, common.MaxWalletQuota - minimum + 1, minimum},
		{"integer_overflow", int(^uint(0) >> 1), 100, int(^uint(0) >> 1)},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db := setupCashbackTestDB(t)
			user := User{Username: "affiliate-bound", Status: common.UserStatusEnabled, Quota: tc.wallet, AffQuota: tc.affiliate}
			require.NoError(t, db.Create(&user).Error)
			err := (&User{Id: user.Id}).TransferAffQuotaToQuota(tc.quota)
			require.ErrorContains(t, err, "钱包额度")
			var stored User
			require.NoError(t, db.First(&stored, user.Id).Error)
			assert.Equal(t, tc.wallet, stored.Quota)
			assert.Equal(t, tc.affiliate, stored.AffQuota)
			var events int64
			require.NoError(t, db.Model(&WalletRefundCreditEvent{}).Where("user_id = ?", user.Id).Count(&events).Error)
			assert.Zero(t, events)
		})
	}
}

func TestAffiliateTransferKeepsHotQuotaCacheAndEvidenceAtomic(t *testing.T) {
	db := setupCashbackTestDB(t)
	resetBatchUpdateTestState(t)
	useUserCacheMiniRedis(t)
	minimum := common.QuotaFromFloat(common.QuotaPerUnit)
	user := User{Username: "affiliate-cache", Status: common.UserStatusEnabled, Quota: 100, AffQuota: minimum * 2}
	require.NoError(t, db.Create(&user).Error)
	require.NoError(t, populateUserCache(user))

	transfer := User{Id: user.Id}
	require.NoError(t, transfer.TransferAffQuotaToQuota(minimum))
	var stored User
	require.NoError(t, db.First(&stored, user.Id).Error)
	assert.Equal(t, 100+minimum, stored.Quota)
	assert.Equal(t, minimum, stored.AffQuota)
	cached, err := common.RDB.HGet(t.Context(), getUserCacheKey(user.Id), "Quota").Int()
	require.NoError(t, err)
	assert.Equal(t, stored.Quota, cached, "committed transfer must update hot spend authority")

	owner, err := acquireUserQuotaMutationFences(user.Id)
	require.NoError(t, err)
	err = transfer.TransferAffQuotaToQuota(minimum)
	require.ErrorIs(t, err, ErrUserQuotaMutationPending)
	owner.releaseUnused()

	// Losing fence ownership after the user row update must abort both balances
	// and preserve the replacement owner's fence.
	const callback = "test:affiliate-transfer-fence-loss"
	replaced := false
	require.NoError(t, db.Callback().Update().After("gorm:update").Register(callback, func(tx *gorm.DB) {
		if !replaced && tx.Statement.Table == "users" {
			replaced = true
			_ = common.RDB.Set(t.Context(), getUserQuotaMutationFenceKey(user.Id), "replacement-owner", time.Minute).Err()
		}
	}))
	callbackRegistered := true
	t.Cleanup(func() {
		if callbackRegistered {
			_ = db.Callback().Update().Remove(callback)
		}
	})
	err = transfer.TransferAffQuotaToQuota(minimum)
	require.ErrorIs(t, err, ErrUserQuotaMutationFenceLost)
	assert.True(t, replaced)
	assert.Equal(t, "replacement-owner", common.RDB.Get(t.Context(), getUserQuotaMutationFenceKey(user.Id)).Val())
	require.NoError(t, db.Callback().Update().Remove(callback))
	callbackRegistered = false
	require.NoError(t, common.RDB.Del(t.Context(), getUserQuotaMutationFenceKey(user.Id)).Err())
	var rolledBack User
	require.NoError(t, db.First(&rolledBack, user.Id).Error)
	assert.Equal(t, stored.Quota, rolledBack.Quota)
	assert.Equal(t, stored.AffQuota, rolledBack.AffQuota)

	// A failed evidence insert must roll back both wallet and affiliate balances.
	require.NoError(t, db.Migrator().DropTable(&WalletRefundCreditEvent{}))
	err = transfer.TransferAffQuotaToQuota(minimum)
	require.Error(t, err)
	var after User
	require.NoError(t, db.First(&after, user.Id).Error)
	assert.Equal(t, stored.Quota, after.Quota)
	assert.Equal(t, stored.AffQuota, after.AffQuota)
	cached, err = common.RDB.HGet(t.Context(), getUserCacheKey(user.Id), "Quota").Int()
	require.NoError(t, err)
	assert.Equal(t, stored.Quota, cached)
}

func TestCheckinRejectsExcessiveGrantWithoutRecordingCheckinOrCredit(t *testing.T) {
	for _, tc := range []struct {
		name          string
		wallet, award int
	}{
		{"award_above_limit", 37, common.MaxWalletQuota + 1},
		{"wallet_would_exceed_limit", common.MaxWalletQuota - 4, 5},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db := setupCashbackTestDB(t)
			setting := operation_setting.GetCheckinSetting()
			previous := *setting
			t.Cleanup(func() { *setting = previous })
			*setting = operation_setting.CheckinSetting{Enabled: true, MinQuota: tc.award, MaxQuota: tc.award}
			user := User{Username: "checkin-bound", Status: common.UserStatusEnabled, Quota: tc.wallet}
			require.NoError(t, db.Create(&user).Error)
			_, err := UserCheckin(user.Id)
			require.ErrorContains(t, err, "钱包额度")
			assert.Equal(t, tc.wallet, getUserQuotaFromDB(t, user.Id))
			var count int64
			require.NoError(t, db.Model(&Checkin{}).Where("user_id = ?", user.Id).Count(&count).Error)
			assert.Zero(t, count)
			require.NoError(t, db.Model(&WalletRefundCreditEvent{}).Where("user_id = ?", user.Id).Count(&count).Error)
			assert.Zero(t, count)
		})
	}
}

func TestCheckinRejectsNegativeConfigurationAndSkipsZeroQuotaUpdate(t *testing.T) {
	db := setupCashbackTestDB(t)
	require.Equal(t, "checkins", db.NamingStrategy.TableName("Checkin"))
	require.NoError(t, db.AutoMigrate(&Checkin{}))
	require.True(t, db.Migrator().HasTable(&Checkin{}))
	user := User{Username: "zero-checkin", Status: common.UserStatusEnabled, Quota: 37}
	require.NoError(t, db.Create(&user).Error)
	setting := operation_setting.GetCheckinSetting()
	previous := *setting
	t.Cleanup(func() { *setting = previous })
	*setting = operation_setting.CheckinSetting{Enabled: true, MinQuota: -1, MaxQuota: -1}
	_, err := UserCheckin(user.Id)
	require.ErrorContains(t, err, "签到奖励配置无效")
	var count int64
	require.NoError(t, db.Model(&Checkin{}).Where("user_id = ?", user.Id).Count(&count).Error)
	assert.Zero(t, count)

	*setting = operation_setting.CheckinSetting{Enabled: true, MinQuota: 0, MaxQuota: 0}
	const callback = "test:zero-checkin-no-wallet-update"
	require.NoError(t, db.Callback().Update().Before("gorm:update").Register(callback, func(tx *gorm.DB) {
		if tx.Statement.Table == "users" {
			tx.AddError(errors.New("zero checkin must not update wallet"))
		}
	}))
	t.Cleanup(func() { _ = db.Callback().Update().Remove(callback) })
	checkin, err := UserCheckin(user.Id)
	require.NoError(t, err)
	assert.Zero(t, checkin.QuotaAwarded)
	assert.Equal(t, 37, getUserQuotaFromDB(t, user.Id))
	require.NoError(t, db.Model(&WalletRefundCreditEvent{}).Where("user_id = ?", user.Id).Count(&count).Error)
	assert.Zero(t, count)
	_, err = UserCheckin(user.Id)
	require.ErrorContains(t, err, "Already checked in today")
}

func TestRechargeEpayCreatesCashbackOnceAndManualCompletionStaysIneligible(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	_, invitee := createCashbackUsers(t, now-30*24*60*60)
	baseQuota, err := common.WalletQuotaFromDecimalStrict(
		decimal.NewFromFloat(common.QuotaPerUnit),
	)
	require.NoError(t, err)

	order := TopUp{
		UserId: invitee.Id, Amount: 1, Money: 1, TradeNo: "epay-cashback-once",
		PaymentMethod: "alipay", PaymentProvider: PaymentProviderEpay,
		CreateTime: now, Status: common.TopUpStatusPending,
	}
	require.NoError(t, insertCashbackTestTopUp(&order, baseQuota, CashbackRequestMetadata{}))
	proof := EpayVerifiedDetails{GatewayTradeNo: "epay-gateway-1", MerchantID: "merchant-1"}
	alreadyDone, err := RechargeEpay(order.TradeNo, "alipay", "0.99", "127.0.0.1", proof)
	require.ErrorIs(t, err, ErrEpayPaymentAmountMismatch)
	assert.False(t, alreadyDone)
	var evidenceCount int64
	require.NoError(t, DB.Model(&EpayPaymentEvidence{}).Where("top_up_id = ?", order.Id).Count(&evidenceCount).Error)
	assert.Zero(t, evidenceCount)
	assert.Equal(t, common.TopUpStatusPending, GetTopUpByTradeNo(order.TradeNo).Status)
	var pendingEvents int64
	require.NoError(t, DB.Model(&WalletRefundCreditEvent{}).Where("source_type = ? AND source_id = ?", "topup", order.Id).Count(&pendingEvents).Error)
	assert.Zero(t, pendingEvents)
	alreadyDone, err = RechargeEpay(order.TradeNo, "alipay", "1.00", "127.0.0.1", proof)
	require.NoError(t, err)
	assert.False(t, alreadyDone)
	var evidence EpayPaymentEvidence
	require.NoError(t, DB.First(&evidence, "top_up_id = ?", order.Id).Error)
	assert.Equal(t, int64(100), evidence.PaidCents)
	assert.Equal(t, proof.GatewayTradeNo, evidence.GatewayTradeNo)
	assert.Equal(t, proof.MerchantID, evidence.MerchantID)
	assert.Equal(t, order.TradeNo, evidence.TradeNo)
	assert.Equal(t, CashbackCompletionProviderCallback, evidence.Source)
	assert.Positive(t, evidence.VerifiedAt)
	alreadyDone, err = RechargeEpayVerifiedReturn(order.TradeNo, "wxpay", "2.00", "127.0.0.1", EpayVerifiedDetails{GatewayTradeNo: "other", MerchantID: "other"})
	require.NoError(t, err)
	assert.True(t, alreadyDone)
	var evidences []EpayPaymentEvidence
	require.NoError(t, DB.Where("top_up_id = ?", order.Id).Find(&evidences).Error)
	require.Equal(t, []EpayPaymentEvidence{evidence}, evidences) // Retry must not overwrite first verified source/amount.
	var rewardCount int64
	require.NoError(t, DB.Model(&CashbackReward{}).Where("top_up_id = ?", order.Id).Count(&rewardCount).Error)
	assert.EqualValues(t, 2, rewardCount)

	manual := TopUp{
		UserId: invitee.Id, Amount: 1, Money: 1, TradeNo: "manual-cashback-ineligible",
		PaymentMethod: "alipay", PaymentProvider: PaymentProviderEpay,
		CreateTime: now + 1, Status: common.TopUpStatusPending,
	}
	require.NoError(t, insertCashbackTestTopUp(&manual, baseQuota, CashbackRequestMetadata{}))
	require.NoError(t, ManualCompleteTopUp(manual.TradeNo, "127.0.0.1"))
	require.NoError(t, DB.Model(&CashbackReward{}).Where("top_up_id = ?", manual.Id).Count(&rewardCount).Error)
	assert.Zero(t, rewardCount)
	var manualContext CashbackOrderContext
	require.NoError(t, DB.Where("top_up_id = ?", manual.Id).First(&manualContext).Error)
	assert.Equal(t, CashbackCompletionAdminManual, manualContext.CompletionSource)
	var manualEvidence int64
	require.NoError(t, DB.Model(&EpayPaymentEvidence{}).Where("top_up_id = ?", manual.Id).Count(&manualEvidence).Error)
	assert.Zero(t, manualEvidence)
	var logCountBefore int64
	require.NoError(t, LOG_DB.Model(&Log{}).Where("user_id = ? AND type = ?", invitee.Id, LogTypeTopup).Count(&logCountBefore).Error)
	require.NoError(t, ManualCompleteTopUp(manual.TradeNo, "127.0.0.1"))
	var logCountAfter int64
	require.NoError(t, LOG_DB.Model(&Log{}).Where("user_id = ? AND type = ?", invitee.Id, LogTypeTopup).Count(&logCountAfter).Error)
	assert.Equal(t, logCountBefore, logCountAfter)
	var credits []WalletRefundCreditEvent
	require.NoError(t, DB.Where("user_id = ?", invitee.Id).Order("id").Find(&credits).Error)
	require.GreaterOrEqual(t, len(credits), 3)
	assert.Equal(t, walletRefundOpening, credits[0].Kind)
	assert.Equal(t, walletRefundPurchase, credits[1].Kind)
	assert.Equal(t, int64(order.Id), credits[1].SourceID)
	var purchases int
	for _, event := range credits {
		if event.Kind == walletRefundPurchase {
			purchases++
		}
	}
	assert.Equal(t, 2, purchases) // Callback and manual retries did not credit again.
	assert.Equal(t, int64(manual.Id), credits[len(credits)-1].SourceID)
	assert.Equal(t, "manual_topup", credits[len(credits)-1].SourceType)

	wrongChannel := TopUp{
		UserId: invitee.Id, Amount: 1, Money: 1, TradeNo: "wrong-channel-cashback",
		PaymentMethod: PaymentMethodStripe, PaymentProvider: PaymentProviderStripe,
		CreateTime: now + 2, Status: common.TopUpStatusPending,
	}
	require.NoError(t, insertCashbackTestTopUp(&wrongChannel, baseQuota, CashbackRequestMetadata{}))
	_, err = RechargeEpay(wrongChannel.TradeNo, "alipay", "1.00", "127.0.0.1", epayTestDetails(wrongChannel.TradeNo))
	assert.ErrorIs(t, err, ErrPaymentMethodMismatch)
	var unchanged TopUp
	require.NoError(t, DB.First(&unchanged, wrongChannel.Id).Error)
	assert.Equal(t, common.TopUpStatusPending, unchanged.Status)
}

func TestEpayEvidenceFailureRollsBackPaymentAndAllowsRetry(t *testing.T) {
	db := setupCashbackTestDB(t)
	payer := User{Username: "epay-evidence-rollback", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&payer).Error)
	order := TopUp{UserId: payer.Id, Amount: 1, Money: 1, TradeNo: "epay-evidence-rollback",
		PaymentMethod: "alipay", PaymentProvider: PaymentProviderEpay, Status: common.TopUpStatusPending}
	require.NoError(t, insertCashbackTestTopUp(&order, 1, CashbackRequestMetadata{}))
	proof := EpayVerifiedDetails{GatewayTradeNo: "gateway-rollback", MerchantID: "merchant-rollback"}
	for _, tc := range []struct {
		name   string
		settle func(EpayVerifiedDetails) (bool, error)
		proof  EpayVerifiedDetails
	}{
		{"notify missing details", func(details EpayVerifiedDetails) (bool, error) {
			return RechargeEpay(order.TradeNo, "alipay", "1.00", "127.0.0.1", details)
		}, EpayVerifiedDetails{}},
		{"return incomplete details", func(details EpayVerifiedDetails) (bool, error) {
			return RechargeEpayVerifiedReturn(order.TradeNo, "alipay", "1.00", "127.0.0.1", details)
		}, EpayVerifiedDetails{GatewayTradeNo: "gateway-rollback"}},
		{"notify oversized details", func(details EpayVerifiedDetails) (bool, error) {
			return RechargeEpay(order.TradeNo, "alipay", "1.00", "127.0.0.1", details)
		}, EpayVerifiedDetails{GatewayTradeNo: strings.Repeat("x", 256), MerchantID: "merchant"}},
		{"return blank details", func(details EpayVerifiedDetails) (bool, error) {
			return RechargeEpayVerifiedReturn(order.TradeNo, "alipay", "1.00", "127.0.0.1", details)
		}, EpayVerifiedDetails{GatewayTradeNo: " ", MerchantID: "merchant"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			alreadyDone, err := tc.settle(tc.proof)
			require.ErrorIs(t, err, ErrEpayPaymentProofInvalid)
			assert.False(t, alreadyDone)
			assert.Equal(t, common.TopUpStatusPending, GetTopUpByTradeNo(order.TradeNo).Status)
			var wallet User
			require.NoError(t, db.First(&wallet, payer.Id).Error)
			assert.Zero(t, wallet.Quota)
			var evidenceCount, rewardCount int64
			require.NoError(t, db.Model(&EpayPaymentEvidence{}).Where("top_up_id = ?", order.Id).Count(&evidenceCount).Error)
			require.NoError(t, db.Model(&CashbackReward{}).Where("top_up_id = ?", order.Id).Count(&rewardCount).Error)
			assert.Zero(t, evidenceCount)
			assert.Zero(t, rewardCount)
		})
	}
	require.NoError(t, db.Migrator().DropTable(&EpayPaymentEvidence{}))
	alreadyDone, err := RechargeEpay(order.TradeNo, "alipay", "1.00", "127.0.0.1", proof)
	require.Error(t, err)
	assert.False(t, alreadyDone)
	assert.Equal(t, common.TopUpStatusPending, GetTopUpByTradeNo(order.TradeNo).Status)
	var wallet User
	require.NoError(t, db.First(&wallet, payer.Id).Error)
	assert.Zero(t, wallet.Quota)
	require.NoError(t, db.AutoMigrate(&EpayPaymentEvidence{}))
	alreadyDone, err = RechargeEpay(order.TradeNo, "alipay", "1.00", "127.0.0.1", proof)
	require.NoError(t, err)
	assert.False(t, alreadyDone)
	var evidence EpayPaymentEvidence
	require.NoError(t, db.First(&evidence, "top_up_id = ?", order.Id).Error)
	assert.Equal(t, int64(100), evidence.PaidCents)

	// Orders completed before payment evidence was introduced remain valid
	// historical successes; a retry must not backfill proof or credit again.
	historical := TopUp{UserId: payer.Id, TradeNo: "epay-historical-success", PaymentProvider: PaymentProviderEpay,
		PaymentMethod: "alipay", Status: common.TopUpStatusSuccess}
	require.NoError(t, db.Create(&historical).Error)
	require.NoError(t, db.First(&wallet, payer.Id).Error)
	creditedQuota := wallet.Quota
	for _, settle := range []func() (bool, error){
		func() (bool, error) {
			return RechargeEpay(historical.TradeNo, "alipay", "", "127.0.0.1", EpayVerifiedDetails{})
		},
		func() (bool, error) {
			return RechargeEpayVerifiedReturn(historical.TradeNo, "alipay", "", "127.0.0.1", EpayVerifiedDetails{})
		},
	} {
		alreadyDone, err := settle()
		require.NoError(t, err)
		assert.True(t, alreadyDone)
	}
	require.NoError(t, db.First(&wallet, payer.Id).Error)
	assert.Equal(t, creditedQuota, wallet.Quota)
	var evidenceCount int64
	require.NoError(t, db.Model(&EpayPaymentEvidence{}).Where("top_up_id = ?", historical.Id).Count(&evidenceCount).Error)
	assert.Zero(t, evidenceCount)
}

func TestOnlineTopUpCreditRollsBackWhenCashbackCompletionFails(t *testing.T) {
	providers := []struct {
		name   string
		method string
		amount int64
		settle func(string) error
	}{
		{"epay", "alipay", 1, func(tradeNo string) error {
			_, err := RechargeEpay(tradeNo, "alipay", "1.00", "127.0.0.1", epayTestDetails(tradeNo))
			return err
		}},
		{"stripe", PaymentMethodStripe, 1, func(tradeNo string) error {
			return Recharge(tradeNo, "customer", "127.0.0.1")
		}},
		{"creem", PaymentMethodCreem, 1_000, func(tradeNo string) error {
			return RechargeCreem(tradeNo, "payer@example.com", "", "127.0.0.1")
		}},
		{"waffo", PaymentMethodWaffo, 1, func(tradeNo string) error {
			return RechargeWaffo(tradeNo, "127.0.0.1")
		}},
		{"waffo_pancake", PaymentMethodWaffoPancake, 1, func(tradeNo string) error {
			return RechargeWaffoPancake(tradeNo)
		}},
	}
	for _, provider := range providers {
		t.Run(provider.name, func(t *testing.T) {
			setupCashbackTestDB(t)
			oldQuotaPerUnit := common.QuotaPerUnit
			common.QuotaPerUnit = 1_000
			t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })
			now := time.Now().Unix()
			saveCashbackTestSetting(t, now-100)
			_, payer := createCashbackUsers(t, now-30*24*60*60)
			topUp := TopUp{
				UserId: payer.Id, Amount: provider.amount, Money: 1,
				TradeNo: "rollback-" + provider.name, PaymentProvider: provider.name,
				PaymentMethod: provider.method, CreateTime: now, Status: common.TopUpStatusPending,
			}
			// A required post-enable context is missing. The purchase credit
			// now precedes cashback completion but must not escape its transaction.
			require.NoError(t, DB.Create(&topUp).Error)
			require.Error(t, provider.settle(topUp.TradeNo))
			var stored TopUp
			require.NoError(t, DB.First(&stored, topUp.Id).Error)
			assert.Equal(t, common.TopUpStatusPending, stored.Status)
			assert.Zero(t, stored.CompleteTime)
			var user User
			require.NoError(t, DB.First(&user, payer.Id).Error)
			assert.Zero(t, user.Quota)
			assert.Empty(t, user.StripeCustomer)
			assert.Empty(t, user.Email)
			var count int64
			require.NoError(t, DB.Model(&CashbackReward{}).Where("top_up_id = ?", topUp.Id).Count(&count).Error)
			assert.Zero(t, count)
		})
	}
}

func TestOnlineTopUpWithoutInviterCreditsWalletAndPayerReward(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	payer := User{Username: "online-topup-without-inviter", Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&payer).Error)
	order := TopUp{UserId: payer.Id, Amount: 1, Money: 1, TradeNo: "topup-without-inviter",
		PaymentProvider: PaymentProviderEpay, PaymentMethod: "alipay", CreateTime: now, Status: common.TopUpStatusPending}
	require.NoError(t, insertCashbackTestTopUp(&order, 1_000, CashbackRequestMetadata{}))
	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 1_000
	t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })
	_, err := RechargeEpay(order.TradeNo, "alipay", "1.00", "127.0.0.1", epayTestDetails(order.TradeNo))
	require.NoError(t, err)
	var stored User
	require.NoError(t, DB.First(&stored, payer.Id).Error)
	assert.Equal(t, 1_000, stored.Quota)
	var rewardCount int64
	require.NoError(t, DB.Model(&CashbackReward{}).Where("top_up_id = ?", order.Id).Count(&rewardCount).Error)
	assert.EqualValues(t, 1, rewardCount)
	var reward CashbackReward
	require.NoError(t, DB.Where("top_up_id = ?", order.Id).First(&reward).Error)
	assert.Equal(t, CashbackDirectionInvitee, reward.Direction)
	assert.Equal(t, payer.Id, reward.BeneficiaryID)
	assert.Zero(t, reward.InviterID)
}

func TestCashbackCampaignBindsOrderAndLimitsOnlyPositivePayerRewards(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	var campaign CashbackCampaign
	require.NoError(t, DB.First(&campaign).Error)
	require.NoError(t, DB.Model(&campaign).Update("max_rewards_per_user", 1).Error)
	inviter, payer := createCashbackUsers(t, now-30*24*60*60)
	first := createCompletedCashbackTopUp(t, payer, now, now, 1_000, 1_000)
	second := createCompletedCashbackTopUp(t, payer, now+1, now+1, 1_000, 1_000)
	var firstRewards, secondRewards []CashbackReward
	require.NoError(t, DB.Where("top_up_id = ?", first.Id).Find(&firstRewards).Error)
	require.NoError(t, DB.Where("top_up_id = ?", second.Id).Find(&secondRewards).Error)
	assert.Len(t, firstRewards, 2)
	require.Len(t, secondRewards, 1)
	assert.Equal(t, CashbackDirectionInviter, secondRewards[0].Direction)
	assert.Equal(t, inviter.Id, secondRewards[0].BeneficiaryID)
	var secondContext CashbackOrderContext
	require.NoError(t, DB.Where("top_up_id = ?", second.Id).First(&secondContext).Error)
	assert.Equal(t, campaign.ID, secondContext.CampaignID)
	zeroPayer := User{Username: "zero-reward-payer", Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&zeroPayer).Error)
	zero := createCompletedCashbackTopUp(t, zeroPayer, now+3, now+3, 1, 1)
	var canceled CashbackReward
	require.NoError(t, DB.Where("top_up_id = ?", zero.Id).First(&canceled).Error)
	assert.Zero(t, canceled.RewardQuota)
	assert.Equal(t, CashbackSettlementCanceled, canceled.SettlementStatus)
	positive := createCompletedCashbackTopUp(t, zeroPayer, now+4, now+4, 1_000, 1_000)
	var payable CashbackReward
	require.NoError(t, DB.Where("top_up_id = ?", positive.Id).First(&payable).Error)
	assert.Positive(t, payable.RewardQuota)
	// The campaign is not a precondition for inviter rewards.
	require.NoError(t, DB.Delete(&campaign).Error)
	third := createCompletedCashbackTopUp(t, payer, now+2, now+2, 1_000, 1_000)
	var thirdRewards []CashbackReward
	require.NoError(t, DB.Where("top_up_id = ?", third.Id).Find(&thirdRewards).Error)
	require.Len(t, thirdRewards, 1)
	assert.Equal(t, CashbackDirectionInviter, thirdRewards[0].Direction)
}

func TestCashbackFirstTopUpCampaignRewardsOnlyThePayersFirstWalletTopUp(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	var campaign CashbackCampaign
	require.NoError(t, DB.First(&campaign).Error)
	require.NoError(t, DB.Model(&campaign).Updates(map[string]any{"max_rewards_per_user": 1, "payer_scope": CashbackPayerScopeFirstTopUp}).Error)
	payerReward := func(topUp TopUp) CashbackReward {
		var reward CashbackReward
		require.NoError(t, DB.Where("top_up_id = ? AND direction = ?", topUp.Id, CashbackDirectionInvitee).First(&reward).Error)
		return reward
	}
	assertNotFirst := func(reward CashbackReward) {
		assert.Zero(t, reward.RewardQuota)
		assert.Equal(t, CashbackSettlementCanceled, reward.SettlementStatus)
		assert.Equal(t, "not_first_top_up", reward.CapReason)
		assert.Equal(t, "no_payable_cashback_quota", reward.BlockingReason)
	}

	inviter, payer := createCashbackUsers(t, now-30*24*60*60)
	preview, err := PreviewPayerCashback(payer.Id, 1_000, 1, "1000")
	require.NoError(t, err)
	assert.Equal(t, "estimated", preview.Status)
	first := createCompletedCashbackTopUp(t, payer, now, now, 1_000, 1_000)
	assert.Positive(t, payerReward(first).RewardQuota)
	preview, err = PreviewPayerCashback(payer.Id, 1_000, 1, "1000")
	require.NoError(t, err)
	assert.Equal(t, "not_first_top_up", preview.Status)
	assert.Zero(t, preview.RewardQuota)
	second := createCompletedCashbackTopUp(t, payer, now+1, now+1, 1_000, 1_000)
	assertNotFirst(payerReward(second))
	var inviterReward CashbackReward
	require.NoError(t, DB.Where("top_up_id = ? AND direction = ?", second.Id, CashbackDirectionInviter).First(&inviterReward).Error)
	assert.Equal(t, inviter.Id, inviterReward.BeneficiaryID)
	assert.Positive(t, inviterReward.RewardQuota)

	// A successful wallet top-up before the campaign, even a manual one,
	// already used the payer's first top-up.
	veteran := User{Username: "first-topup-veteran", AffCode: "first-topup-veteran", Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&veteran).Error)
	require.NoError(t, DB.Create(&TopUp{UserId: veteran.Id, Amount: 10, Money: 10, TradeNo: "veteran-manual-topup",
		PaymentMethod: "alipay", CreateTime: now - 86400, CompleteTime: now - 86400, Status: common.TopUpStatusSuccess}).Error)
	assertNotFirst(payerReward(createCompletedCashbackTopUp(t, veteran, now+2, now+2, 1_000, 1_000)))

	// Subscription purchases mirror into top_ups with a zero amount and are
	// not wallet top-ups.
	subscriber := User{Username: "first-topup-subscriber", AffCode: "first-topup-subscriber", Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&subscriber).Error)
	require.NoError(t, DB.Create(&TopUp{UserId: subscriber.Id, Amount: 0, Money: 30, TradeNo: "subscriber-plan-order",
		PaymentMethod: "alipay", CreateTime: now - 86400, CompleteTime: now - 86400, Status: common.TopUpStatusSuccess}).Error)
	assert.Positive(t, payerReward(createCompletedCashbackTopUp(t, subscriber, now+3, now+3, 1_000, 1_000)).RewardQuota)

	// A first top-up below the minimum earns nothing and still counts as first.
	small := User{Username: "first-topup-small", AffCode: "first-topup-small", Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&small).Error)
	tooSmall := payerReward(createCompletedCashbackTopUp(t, small, now+4, now+4, 1, 1))
	assert.Zero(t, tooSmall.RewardQuota)
	assert.Equal(t, "below_minimum", tooSmall.CapReason)
	assertNotFirst(payerReward(createCompletedCashbackTopUp(t, small, now+5, now+5, 1_000, 1_000)))
}

func TestCreateCashbackCampaignValidatesPayerScope(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	for _, tc := range []struct {
		name       string
		scope      string
		maxRewards int
	}{
		{"unknown scope", "second_top_up", 1},
		{"first top-up allows only one reward", CashbackPayerScopeFirstTopUp, 2},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := CreateCashbackCampaign(now+3600, now+7200, tc.maxRewards, 1, tc.scope)
			assert.ErrorIs(t, err, ErrCashbackInvalidInput)
		})
	}
	campaign, err := CreateCashbackCampaign(now+3600, now+7200, 1, 1, CashbackPayerScopeFirstTopUp)
	require.NoError(t, err)
	campaigns, err := ListCashbackCampaigns()
	require.NoError(t, err)
	require.Len(t, campaigns, 1)
	assert.Equal(t, campaign.ID, campaigns[0].ID)
	assert.Equal(t, CashbackPayerScopeFirstTopUp, campaigns[0].PayerScope)
}

func TestCashbackOrderDoesNotBindCampaignOnFutureApplicationTimestamp(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	var campaign CashbackCampaign
	require.NoError(t, DB.First(&campaign).Error)
	startAt := now + 3600
	require.NoError(t, DB.Model(&campaign).Update("start_at", startAt).Error)
	payer := User{Username: "future-app-clock-payer", Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&payer).Error)
	order := TopUp{UserId: payer.Id, TradeNo: "future-app-clock-order", PaymentProvider: PaymentProviderEpay,
		CreateTime: startAt, Status: common.TopUpStatusPending}
	require.NoError(t, insertCashbackTestTopUp(&order, 1_000, CashbackRequestMetadata{}))
	var context CashbackOrderContext
	require.NoError(t, DB.Where("top_up_id = ?", order.Id).First(&context).Error)
	assert.True(t, context.EligibleAfterFirstEnable)
	assert.Zero(t, context.CampaignID)
}

func TestCashbackStoppedCampaignDoesNotAttachLaterOrRewardPendingOrder(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	var campaign CashbackCampaign
	require.NoError(t, DB.First(&campaign).Error)
	inviter, payer := createCashbackUsers(t, now-30*24*60*60)
	order := TopUp{UserId: payer.Id, Amount: 1, Money: 1, TradeNo: "stopped-campaign-pending",
		PaymentProvider: PaymentProviderEpay, PaymentMethod: "alipay", CreateTime: now, Status: common.TopUpStatusPending}
	require.NoError(t, insertCashbackTestTopUp(&order, 1_000, CashbackRequestMetadata{}))
	var context CashbackOrderContext
	require.NoError(t, DB.Where("top_up_id = ?", order.Id).First(&context).Error)
	require.Equal(t, campaign.ID, context.CampaignID)
	stopped, err := StopCashbackCampaign(campaign.ID, 99)
	require.NoError(t, err)
	require.Positive(t, stopped.StoppedAt)
	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 1_000
	t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })
	_, err = RechargeEpay(order.TradeNo, "alipay", "1.00", "127.0.0.1", epayTestDetails(order.TradeNo))
	require.NoError(t, err)
	var rewards []CashbackReward
	require.NoError(t, DB.Where("top_up_id = ?", order.Id).Find(&rewards).Error)
	require.Len(t, rewards, 1)
	assert.Equal(t, CashbackDirectionInviter, rewards[0].Direction)
	assert.Equal(t, inviter.Id, rewards[0].BeneficiaryID)
	later := TopUp{UserId: payer.Id, TradeNo: "after-stopped-campaign", PaymentProvider: PaymentProviderEpay,
		CreateTime: now, Status: common.TopUpStatusPending}
	require.NoError(t, insertCashbackTestTopUp(&later, 1_000, CashbackRequestMetadata{}))
	var laterContext CashbackOrderContext
	require.NoError(t, DB.Where("top_up_id = ?", later.Id).First(&laterContext).Error)
	assert.Zero(t, laterContext.CampaignID)
}

func TestCashbackPaymentAtExclusiveCampaignEndPreservesInviterReward(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	var campaign CashbackCampaign
	require.NoError(t, DB.First(&campaign).Error)
	inviter, payer := createCashbackUsers(t, now-30*24*60*60)
	order := TopUp{UserId: payer.Id, Amount: 1, Money: 1, TradeNo: "campaign-exclusive-end",
		PaymentProvider: PaymentProviderEpay, PaymentMethod: "alipay", CreateTime: now, Status: common.TopUpStatusPending}
	require.NoError(t, insertCashbackTestTopUp(&order, 1_000, CashbackRequestMetadata{}))
	var context CashbackOrderContext
	require.NoError(t, DB.Where("top_up_id = ?", order.Id).First(&context).Error)
	require.Equal(t, campaign.ID, context.CampaignID)
	// The order was bound while active; payment at the exclusive end is too
	// late even though the inviter direction remains independent of the event.
	endAt, err := getDBTimestampOnStrict(DB)
	require.NoError(t, err)
	require.NoError(t, DB.Model(&campaign).Update("end_at", endAt).Error)
	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 1_000
	t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })
	_, err = RechargeEpay(order.TradeNo, "alipay", "1.00", "127.0.0.1", epayTestDetails(order.TradeNo))
	require.NoError(t, err)
	var paid TopUp
	require.NoError(t, DB.First(&paid, order.Id).Error)
	require.GreaterOrEqual(t, paid.CompleteTime, endAt)
	var rewards []CashbackReward
	require.NoError(t, DB.Where("top_up_id = ?", order.Id).Find(&rewards).Error)
	require.Len(t, rewards, 1)
	assert.Equal(t, CashbackDirectionInviter, rewards[0].Direction)
	assert.Equal(t, inviter.Id, rewards[0].BeneficiaryID)
	assert.Equal(t, paid.CompleteTime, rewards[0].PaidAt)
}

func TestCashbackCampaignRejectsStaleCompletionTimeAtExclusiveEnd(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	var campaign CashbackCampaign
	require.NoError(t, DB.First(&campaign).Error)
	inviter, payer := createCashbackUsers(t, now-30*24*60*60)
	order := TopUp{UserId: payer.Id, Amount: 1, Money: 1, TradeNo: "campaign-stale-paid-at",
		PaymentProvider: PaymentProviderEpay, PaymentMethod: "alipay", CreateTime: now, Status: common.TopUpStatusPending}
	require.NoError(t, insertCashbackTestTopUp(&order, 1_000, CashbackRequestMetadata{}))
	var context CashbackOrderContext
	require.NoError(t, DB.Where("top_up_id = ?", order.Id).First(&context).Error)
	require.Equal(t, campaign.ID, context.CampaignID)
	endAt, err := getDBTimestampOnStrict(DB)
	require.NoError(t, err)
	require.NoError(t, DB.Model(&campaign).Update("end_at", endAt).Error)

	// A stale, pre-end timestamp from a transaction caller cannot resurrect
	// payer cashback after the database clock reaches the exclusive end.
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		var paid TopUp
		if err := lockForUpdate(tx).First(&paid, order.Id).Error; err != nil {
			return err
		}
		paid.Status = common.TopUpStatusSuccess
		paid.CompleteTime = endAt - 1
		if err := tx.Save(&paid).Error; err != nil {
			return err
		}
		if err := creditTopUpQuota(tx, payer.Id, 1_000, nil); err != nil {
			return err
		}
		return CompleteTopUpCashbackTx(tx, &paid, 1_000, CashbackCompletionProviderCallback)
	}))
	var rewards []CashbackReward
	require.NoError(t, DB.Where("top_up_id = ?", order.Id).Find(&rewards).Error)
	require.Len(t, rewards, 1)
	assert.Equal(t, CashbackDirectionInviter, rewards[0].Direction)
	assert.Equal(t, inviter.Id, rewards[0].BeneficiaryID)
}

func TestCashbackManualPayerApprovalIssuesBeforeOriginalMaturity(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	inviter, payer := createCashbackUsers(t, now-30*24*60*60)
	order := createCompletedCashbackTopUp(t, payer, now, now, 10_000, 10_000)
	var reward CashbackReward
	require.NoError(t, DB.Where("top_up_id = ? AND direction = ?", order.Id, CashbackDirectionInvitee).First(&reward).Error)
	require.Positive(t, reward.RewardQuota)
	require.Greater(t, reward.AvailableAt, now)
	require.NoError(t, DB.Session(&gorm.Session{SkipHooks: true}).Model(&reward).Update("risk_level", CashbackRiskSevere).Error)

	_, err := ReviewCashbackReward(reward.ID, CashbackReviewActionApprove, "", 999, now)
	require.ErrorIs(t, err, ErrCashbackReviewReason)
	result, err := ReviewCashbackReward(reward.ID, CashbackReviewActionApprove, "Verified payment and risk evidence", 999, now)
	require.NoError(t, err)
	assert.True(t, result.Issued)
	assert.Equal(t, CashbackReviewManual, result.Reward.ReviewSource)
	assert.Equal(t, reward.AvailableAt, result.Reward.AvailableAt)
	again, err := ReviewCashbackReward(reward.ID, CashbackReviewActionApprove, "Verified payment and risk evidence", 999, now)
	require.NoError(t, err)
	assert.True(t, again.Issued)
	outcome, err := IssueCashbackReward(reward.ID, now)
	require.NoError(t, err)
	assert.True(t, outcome.Skipped)

	var wallet User
	require.NoError(t, DB.First(&wallet, payer.Id).Error)
	assert.Equal(t, 10_000+reward.RewardQuota, wallet.Quota)
	var inviterWallet User
	require.NoError(t, DB.First(&inviterWallet, inviter.Id).Error)
	assert.Zero(t, inviterWallet.Quota)
	var mutations int64
	require.NoError(t, DB.Model(&CashbackQuotaMutation{}).Where("reward_id = ? AND kind = ?", reward.ID, CashbackQuotaMutationIssue).Count(&mutations).Error)
	assert.EqualValues(t, 1, mutations)
}

func TestCashbackManualPayerLegacyScanRespectsReviewEvidenceAndMaturity(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	setting := saveCashbackTestSetting(t, now-100)
	setting.AutoReviewEnabled = true
	setting.AutoReviewImmediateIssue = false
	setting.AutoReviewRiskFlags = []string{}
	require.NoError(t, SaveCashbackSetting(setting))
	_, payer := createCashbackUsers(t, now-30*24*60*60)
	order := createCompletedCashbackTopUp(t, payer, now, now, 10_000, 10_000)
	var automatic, inviter CashbackReward
	require.NoError(t, DB.Where("top_up_id = ? AND direction = ?", order.Id, CashbackDirectionInvitee).First(&automatic).Error)
	require.NoError(t, DB.Where("top_up_id = ? AND direction = ?", order.Id, CashbackDirectionInviter).First(&inviter).Error)
	// An old approved row has no source but does retain the human reviewer ID.
	require.NoError(t, DB.Session(&gorm.Session{SkipHooks: true}).Model(&automatic).
		Updates(map[string]any{"review_source": "", "reviewed_by": 999}).Error)
	due, err := HasMaturedCashbackRewards(now)
	require.NoError(t, err)
	assert.True(t, due)
	run, err := SettleMaturedCashbackRewards(now, 1)
	require.NoError(t, err)
	assert.Equal(t, 1, run.Scanned)
	assert.Equal(t, 1, run.Issued)
	require.NoError(t, DB.First(&automatic, automatic.ID).Error)
	assert.Equal(t, CashbackSettlementIssued, automatic.SettlementStatus)
	assert.Equal(t, CashbackReviewSource(""), automatic.ReviewSource)
	assert.Equal(t, now+int64(setting.SettlementDays)*24*60*60, automatic.AvailableAt)
	other, err := IssueCashbackReward(inviter.ID, now)
	require.NoError(t, err)
	assert.True(t, other.Skipped)

	// A fresh auto-approved payer with immediate issue disabled is not a manual approval.
	second := createCompletedCashbackTopUp(t, payer, now+1, now+1, 10_000, 10_000)
	var deferred CashbackReward
	require.NoError(t, DB.Where("top_up_id = ? AND direction = ?", second.Id, CashbackDirectionInvitee).First(&deferred).Error)
	outcome, err := IssueCashbackReward(deferred.ID, now+1)
	require.NoError(t, err)
	assert.True(t, outcome.Skipped)
	require.NoError(t, DB.Session(&gorm.Session{SkipHooks: true}).Model(&deferred).Update("review_source", "").Error)
	outcome, err = IssueCashbackReward(deferred.ID, now+1)
	require.NoError(t, err)
	assert.True(t, outcome.Skipped, "missing historical review evidence must not bypass T+N")
	due, err = HasMaturedCashbackRewards(now + 1)
	require.NoError(t, err)
	assert.False(t, due)
}

func TestCashbackManualPayerScanAndRetryCreditAtMostOnce(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	_, payer := createCashbackUsers(t, now-30*24*60*60)
	order := createCompletedCashbackTopUp(t, payer, now, now, 10_000, 10_000)
	var reward CashbackReward
	require.NoError(t, DB.Where("top_up_id = ? AND direction = ?", order.Id, CashbackDirectionInvitee).First(&reward).Error)
	require.NoError(t, DB.Session(&gorm.Session{SkipHooks: true}).Model(&reward).
		Updates(map[string]any{"review_status": CashbackReviewApproved, "review_source": CashbackReviewManual, "reviewed_by": 999, "reviewed_at": now}).Error)

	var wg sync.WaitGroup
	start := make(chan struct{})
	for range 2 {
		wg.Go(func() {
			<-start
			_, _ = SettleMaturedCashbackRewards(now, 1)
		})
	}
	wg.Go(func() {
		<-start
		_, _ = IssueCashbackReward(reward.ID, now)
	})
	wg.Go(func() {
		<-start
		_, _ = ReviewCashbackReward(reward.ID, CashbackReviewActionApprove, "reviewed", 999, now)
	})
	close(start)
	wg.Wait()
	_, err := IssueCashbackReward(reward.ID, now)
	require.NoError(t, err, "a SQLite lock conflict must leave the reward retryable")
	var wallet User
	require.NoError(t, DB.First(&wallet, payer.Id).Error)
	assert.Equal(t, 10_000+reward.RewardQuota, wallet.Quota)
	var count int64
	require.NoError(t, DB.Model(&CashbackQuotaMutation{}).Where("reward_id = ? AND kind = ?", reward.ID, CashbackQuotaMutationIssue).Count(&count).Error)
	assert.EqualValues(t, 1, count)
}

func TestCashbackManualPayerLegacyFenceFailureRemainsRetryable(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	_, payer := createCashbackUsers(t, now-30*24*60*60)
	order := createCompletedCashbackTopUp(t, payer, now, now, 10_000, 10_000)
	var reward CashbackReward
	require.NoError(t, DB.Where("top_up_id = ? AND direction = ?", order.Id, CashbackDirectionInvitee).First(&reward).Error)
	require.NoError(t, DB.Session(&gorm.Session{SkipHooks: true}).Model(&reward).
		Updates(map[string]any{"review_status": CashbackReviewApproved, "review_source": CashbackReviewManual, "reviewed_by": 999, "reviewed_at": now}).Error)
	redis := useUserCacheMiniRedis(t)
	redis.Close()
	_, err := IssueCashbackReward(reward.ID, now)
	require.Error(t, err)
	require.NoError(t, DB.First(&reward, reward.ID).Error)
	assert.Equal(t, CashbackSettlementFrozen, reward.SettlementStatus)
	assert.NotEmpty(t, reward.LastSettlementError)
	assert.Equal(t, now+cashbackSettlementRetryDelaySeconds, reward.NextSettlementAttemptAt)
	var wallet User
	require.NoError(t, DB.First(&wallet, payer.Id).Error)
	assert.Equal(t, 10_000, wallet.Quota)
	common.RedisEnabled = false
	due, err := HasMaturedCashbackRewards(now)
	require.NoError(t, err)
	assert.False(t, due)
	due, err = HasMaturedCashbackRewards(reward.NextSettlementAttemptAt)
	require.NoError(t, err)
	assert.True(t, due)
	run, err := SettleMaturedCashbackRewards(reward.NextSettlementAttemptAt, 1)
	require.NoError(t, err)
	assert.Equal(t, 1, run.Issued)
	require.NoError(t, DB.First(&wallet, payer.Id).Error)
	assert.Equal(t, 10_000+reward.RewardQuota, wallet.Quota)
}

func TestCashbackManualPayerBlockedApprovalAndRetry(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	_, payer := createCashbackUsers(t, now-30*24*60*60)
	order := createCompletedCashbackTopUp(t, payer, now, now, 10_000, 10_000)
	var reward CashbackReward
	require.NoError(t, DB.Where("top_up_id = ? AND direction = ?", order.Id, CashbackDirectionInvitee).First(&reward).Error)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", payer.Id).Update("status", common.UserStatusDisabled).Error)
	_, err := ReviewCashbackReward(reward.ID, CashbackReviewActionApprove, "reviewed", 999, now)
	require.ErrorIs(t, err, ErrCashbackHardBlocked)
	require.NoError(t, DB.First(&reward, reward.ID).Error)
	assert.Equal(t, CashbackReviewPending, reward.ReviewStatus)
	assert.Equal(t, CashbackSettlementFrozen, reward.SettlementStatus)
	assert.Equal(t, "referral_account_disabled", reward.BlockingReason)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", payer.Id).Update("status", common.UserStatusEnabled).Error)
	result, err := ReviewCashbackReward(reward.ID, CashbackReviewActionApprove, "reviewed", 999, now+1)
	require.NoError(t, err)
	assert.True(t, result.Issued)
}

func TestCashbackAutoReviewImmediateIssueUsesPaymentTransaction(t *testing.T) {
	for _, immediate := range []bool{true, false} {
		t.Run(fmt.Sprintf("immediate=%t", immediate), func(t *testing.T) {
			setupCashbackTestDB(t)
			now := time.Now().Unix()
			setting := saveCashbackTestSetting(t, now-100)
			setting.AutoReviewEnabled = true
			setting.AutoReviewImmediateIssue = immediate
			setting.AutoReviewRiskFlags = []string{}
			require.NoError(t, SaveCashbackSetting(setting))
			_, payer := createCashbackUsers(t, now-30*24*60*60)
			order := createCompletedCashbackTopUp(t, payer, now, now, 10_000, 10_000)
			var reward CashbackReward
			require.NoError(t, DB.Where("top_up_id = ? AND direction = ?", order.Id, CashbackDirectionInvitee).First(&reward).Error)
			assert.Equal(t, CashbackReviewApproved, reward.ReviewStatus)
			assert.Equal(t, CashbackReviewAutomatic, reward.ReviewSource)
			assert.Zero(t, reward.ReviewedBy)
			var wallet User
			require.NoError(t, DB.First(&wallet, payer.Id).Error)
			if immediate {
				assert.Equal(t, CashbackSettlementIssued, reward.SettlementStatus)
				assert.Equal(t, now, reward.AvailableAt)
				assert.Equal(t, 10_000+reward.RewardQuota, wallet.Quota)
				var mutations int64
				require.NoError(t, DB.Model(&CashbackQuotaMutation{}).Where("reward_id = ? AND kind = ?", reward.ID, CashbackQuotaMutationIssue).Count(&mutations).Error)
				assert.EqualValues(t, 1, mutations)
				outcome, err := IssueCashbackReward(reward.ID, now+1)
				require.NoError(t, err)
				assert.True(t, outcome.Skipped)
			} else {
				assert.Equal(t, CashbackSettlementFrozen, reward.SettlementStatus)
				assert.Equal(t, now+int64(setting.SettlementDays)*24*60*60, reward.AvailableAt)
				assert.Equal(t, 10_000, wallet.Quota)
			}
		})
	}
}

func TestCashbackReviewPolicyUsesSelectedFlagsOnlyForPositivePayerRewards(t *testing.T) {
	cases := []struct {
		name             string
		level            CashbackRiskLevel
		masterEnabled    bool
		selectedFlags    []string
		decision         string
		matched          []string
		matchingSession  bool
		missingDevice    bool
		newAccount       bool
		frequencyLimit   int
		wantReviewStatus CashbackReviewStatus
	}{
		{"low empty automatic", CashbackRiskLow, true, []string{}, "automatic", nil, true, false, false, 5, CashbackReviewApproved},
		{"unconfigured", CashbackRiskMedium, true, nil, "policy_unconfigured", nil, false, false, false, 5, CashbackReviewPending},
		{"medium unmatched", CashbackRiskMedium, true, []string{"prior_payment_incident"}, "automatic", nil, false, false, false, 5, CashbackReviewApproved},
		{"medium matched", CashbackRiskMedium, true, []string{"login_ip_mismatch"}, "selected_flags", []string{"login_ip_mismatch"}, false, false, false, 5, CashbackReviewPending},
		{"high unmatched", CashbackRiskHigh, true, []string{}, "automatic", nil, false, true, false, 5, CashbackReviewApproved},
		{"high matched", CashbackRiskHigh, true, []string{"device_missing", "login_ip_mismatch"}, "selected_flags", []string{"device_missing", "login_ip_mismatch"}, false, true, false, 5, CashbackReviewPending},
		{"severe empty", CashbackRiskSevere, true, []string{}, "automatic", nil, false, true, true, 1, CashbackReviewApproved},
		{"severe matched", CashbackRiskSevere, true, []string{"new_account"}, "selected_flags", []string{"new_account"}, false, true, true, 1, CashbackReviewPending},
		{"master off", CashbackRiskLow, false, []string{}, "master_disabled", nil, true, false, false, 5, CashbackReviewPending},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			setupCashbackTestDB(t)
			now := time.Now().Unix()
			setting := saveCashbackTestSetting(t, now-100)
			setting.AutoReviewEnabled = tc.masterEnabled
			setting.AutoReviewImmediateIssue = false
			setting.DailyTopUpCountThreshold = tc.frequencyLimit
			setting.AutoReviewRiskFlags = tc.selectedFlags
			// Legacy switches must not affect the new routing decision.
			setting.HighReviewRequired = false
			setting.SevereReviewRequired = false
			require.NoError(t, SaveCashbackSetting(setting))
			createdAt := now - 30*24*60*60
			if tc.newAccount {
				createdAt = now
			}
			inviter, payer := createCashbackUsers(t, createdAt)
			if tc.matchingSession {
				require.NoError(t, DB.Create(&UserSession{UserID: payer.Id, IP: "203.0.113.10", UserAgent: "cashback-test-agent", CreatedAt: now}).Error)
			}
			signal := "v1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
			if tc.missingDevice {
				signal = ""
			}
			order := TopUp{UserId: payer.Id, Amount: 1000, Money: 1, TradeNo: "review-policy-" + tc.name,
				PaymentMethod: PaymentMethodWaffo, PaymentProvider: PaymentProviderWaffo, CreateTime: now, Status: common.TopUpStatusPending}
			require.NoError(t, insertCashbackTestTopUp(&order, 1000, CashbackRequestMetadata{
				RequestIP: "203.0.113.10", UserAgent: "cashback-test-agent", DeviceSignal: signal,
			}))
			require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
				var locked TopUp
				if err := lockForUpdate(tx).First(&locked, order.Id).Error; err != nil {
					return err
				}
				locked.Status = common.TopUpStatusSuccess
				locked.CompleteTime = now
				if err := tx.Save(&locked).Error; err != nil {
					return err
				}
				if err := creditTopUpQuota(tx, payer.Id, 1000, nil); err != nil {
					return err
				}
				return CompleteTopUpCashbackTx(tx, &locked, 1000, CashbackCompletionProviderCallback)
			}))
			var rewards []CashbackReward
			require.NoError(t, DB.Where("top_up_id = ?", order.Id).Find(&rewards).Error)
			require.Len(t, rewards, 2)
			for _, reward := range rewards {
				assert.Equal(t, tc.level, reward.RiskLevel)
				assert.Equal(t, CashbackSettlementFrozen, reward.SettlementStatus)
				if reward.Direction == CashbackDirectionInviter {
					assert.Equal(t, inviter.Id, reward.BeneficiaryID)
					assert.Equal(t, CashbackReviewPending, reward.ReviewStatus)
					assert.Empty(t, reward.ReviewSource)
					continue
				}
				assert.Equal(t, payer.Id, reward.BeneficiaryID)
				var snapshot CashbackRiskSnapshot
				require.NoError(t, common.Unmarshal([]byte(reward.RiskSnapshot), &snapshot))
				assert.Equal(t, tc.decision, snapshot.AutoReviewDecision)
				assert.Equal(t, tc.matched, snapshot.AutoReviewMatchedFlags)
				assert.Equal(t, tc.wantReviewStatus, reward.ReviewStatus)
				if tc.wantReviewStatus == CashbackReviewApproved {
					assert.Equal(t, CashbackReviewAutomatic, reward.ReviewSource)
				} else {
					assert.Empty(t, reward.ReviewSource)
				}
			}
		})
	}
}

func TestCashbackSevereRiskAutoApprovalRemainsInAdminRiskFilter(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	setting := saveCashbackTestSetting(t, now-100)
	setting.AutoReviewEnabled = true
	setting.AutoReviewRiskFlags = []string{}
	setting.MaxRewardQuota = 50
	setting.DailyTopUpCountThreshold = 1
	setting.AutoReviewImmediateIssue = false
	require.NoError(t, SaveCashbackSetting(setting))
	payer := User{Username: "auto-severe-risk", Status: common.UserStatusEnabled, CreatedAt: now}
	require.NoError(t, DB.Create(&payer).Error)
	order := createCompletedCashbackTopUp(t, payer, now, now, 1_000, 1_000)
	var reward CashbackReward
	require.NoError(t, DB.Where("top_up_id = ?", order.Id).First(&reward).Error)
	require.Equal(t, CashbackRiskSevere, reward.RiskLevel)
	require.Positive(t, reward.RewardQuota)
	assert.Equal(t, CashbackReviewApproved, reward.ReviewStatus)
	assert.Equal(t, CashbackReviewAutomatic, reward.ReviewSource)
	assert.Equal(t, CashbackSettlementFrozen, reward.SettlementStatus)
	filtered, _, err := ListCashbackRewards(CashbackRewardFilter{RiskLevel: CashbackRiskSevere}, nil)
	require.NoError(t, err)
	require.Len(t, filtered, 1)
	assert.Equal(t, reward.ID, filtered[0].ID)
}

func TestCashbackCanceledZeroRewardsRemainAuditableButNotPendingReview(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	setting := saveCashbackTestSetting(t, now-100)
	setting.InviterEnabled = false
	setting.AutoReviewEnabled = true
	setting.AutoReviewImmediateIssue = false
	setting.AutoReviewRiskFlags = []string{"open_debt"}
	setting.DailyRewardQuota = 50
	require.NoError(t, SaveCashbackSetting(setting))
	payer := User{Username: "canceled-zero-payer", Status: common.UserStatusEnabled, CreatedAt: now}
	require.NoError(t, DB.Create(&payer).Error)

	first := createCompletedCashbackTopUp(t, payer, now, now, 1_000, 1_000)
	var payable CashbackReward
	require.NoError(t, DB.Where("top_up_id = ?", first.Id).First(&payable).Error)
	require.Equal(t, 50, payable.RewardQuota)
	require.Equal(t, CashbackReviewApproved, payable.ReviewStatus)

	// Exhausted daily cap: the historical review column remains pending, but
	// canceled rewards are never an actionable review or an issuance.
	second := createCompletedCashbackTopUp(t, payer, now+1, now+1, 1_000, 1_000)
	var capped CashbackReward
	require.NoError(t, DB.Where("top_up_id = ?", second.Id).First(&capped).Error)
	require.Equal(t, 50, capped.CalculatedQuota)
	require.Zero(t, capped.RewardQuota)
	require.Equal(t, CashbackReviewPending, capped.ReviewStatus)
	require.Equal(t, CashbackSettlementCanceled, capped.SettlementStatus)
	assert.Empty(t, capped.ReviewSource)
	assert.Zero(t, capped.ReviewedAt)
	assert.Contains(t, capped.CapReason, "daily_cap_exhausted")
	assert.Equal(t, "no_payable_cashback_quota", capped.BlockingReason)
	_, err := ReviewCashbackReward(capped.ID, CashbackReviewActionApprove, "checked", 999, now+1)
	require.ErrorIs(t, err, ErrCashbackInvalidState)
	_, err = ReviewCashbackReward(capped.ID, CashbackReviewActionReject, "checked", 999, now+1)
	require.ErrorIs(t, err, ErrCashbackInvalidState)

	// Leave room under the cap: the debt alone must cancel a payable reward.
	// Preserve the original calculation and cancellation reason in detail.
	setting.DailyRewardQuota = 150
	require.NoError(t, SaveCashbackSetting(setting))
	require.NoError(t, DB.Model(&payable).Update("outstanding_debt_quota", 1).Error)
	third := createCompletedCashbackTopUp(t, payer, now+2, now+2, 1_000, 1_000)
	var debt CashbackReward
	require.NoError(t, DB.Where("top_up_id = ?", third.Id).First(&debt).Error)
	assert.Equal(t, 50, debt.CalculatedQuota)
	assert.Zero(t, debt.RewardQuota)
	assert.Equal(t, CashbackSettlementCanceled, debt.SettlementStatus)
	assert.Equal(t, "open_debt", debt.CapReason)
	assert.Empty(t, debt.ReviewSource)
	assert.Zero(t, debt.ReviewedAt)
	assert.Equal(t, "beneficiary_has_open_cashback_debt", debt.BlockingReason)
	var debtRisk CashbackRiskSnapshot
	require.NoError(t, common.Unmarshal([]byte(debt.RiskSnapshot), &debtRisk))
	assert.Contains(t, debtRisk.Flags, "open_debt")
	assert.Empty(t, debtRisk.AutoReviewDecision)

	setting.AutoReviewEnabled = false
	require.NoError(t, SaveCashbackSetting(setting))
	other := User{Username: "real-pending-payer", AffCode: "real-pending-code", Status: common.UserStatusEnabled, CreatedAt: now}
	require.NoError(t, DB.Create(&other).Error)
	fourth := createCompletedCashbackTopUp(t, other, now+3, now+3, 1_000, 1_000)
	var actionable CashbackReward
	require.NoError(t, DB.Where("top_up_id = ?", fourth.Id).First(&actionable).Error)
	require.Equal(t, CashbackReviewPending, actionable.ReviewStatus)
	require.Equal(t, CashbackSettlementFrozen, actionable.SettlementStatus)

	all, total, err := ListCashbackRewards(CashbackRewardFilter{}, nil)
	require.NoError(t, err)
	assert.EqualValues(t, 2, total)
	require.Len(t, all, 2)
	assert.Equal(t, actionable.ID, all[0].ID)
	assert.Equal(t, payable.ID, all[1].ID)
	pending, count, err := ListCashbackRewards(CashbackRewardFilter{ReviewStatus: CashbackReviewPending}, nil)
	require.NoError(t, err)
	assert.EqualValues(t, 1, count)
	require.Len(t, pending, 1)
	assert.Equal(t, actionable.ID, pending[0].ID)
	conflicting, count, err := ListCashbackRewards(CashbackRewardFilter{ReviewStatus: CashbackReviewPending, SettlementStatus: CashbackSettlementCanceled}, nil)
	require.NoError(t, err)
	assert.Zero(t, count)
	assert.Empty(t, conflicting)
	canceled, count, err := ListCashbackRewards(CashbackRewardFilter{SettlementStatus: CashbackSettlementCanceled}, nil)
	require.NoError(t, err)
	assert.Zero(t, count)
	assert.Empty(t, canceled)
	for _, original := range []CashbackReward{capped, debt} {
		detail, err := GetCashbackRewardWithContext(original.ID)
		require.NoError(t, err)
		assert.Equal(t, original.CalculatedQuota, detail.Reward.CalculatedQuota)
		assert.Equal(t, original.CapReason, detail.Reward.CapReason)
		assert.Equal(t, original.BlockingReason, detail.Reward.BlockingReason)
		assert.Equal(t, CashbackReviewPending, detail.Reward.ReviewStatus)
		assert.Zero(t, detail.Reward.ReviewedAt)
	}
	summary, err := GetCashbackAdminSummary()
	require.NoError(t, err)
	assert.EqualValues(t, 50, summary.PendingReviewQuota)
	assert.Zero(t, summary.RejectedOrCanceledCount)
	var wallet User
	require.NoError(t, DB.First(&wallet, payer.Id).Error)
	assert.Equal(t, 3_000, wallet.Quota)
	var issued int64
	require.NoError(t, DB.Model(&CashbackQuotaMutation{}).Where("kind = ?", CashbackQuotaMutationIssue).Count(&issued).Error)
	assert.Zero(t, issued)
}

func TestCashbackBelowHundredRewardHiddenFromDefaultReviewList(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	setting := saveCashbackTestSetting(t, now-100)
	setting.InviterEnabled = false
	setting.InviteeStrategy = operation_setting.CashbackStrategyPerHundred
	setting.InviteeFixedPerHundred = 3
	setting.MaxRewardQuota = 2_000_000
	setting.DailyRewardQuota = 2_000_000
	require.NoError(t, SaveCashbackSetting(setting))
	payer := User{Username: "fixed-fifty-payer", Status: common.UserStatusEnabled, CreatedAt: now - 86400}
	require.NoError(t, DB.Create(&payer).Error)

	short := createCompletedCashbackTopUp(t, payer, now, now, 25_000_000, 25_000_000,
		CashbackRequestMetadata{FaceAmount: 50, QuotaPerFaceUnit: "500000"})
	full := createCompletedCashbackTopUp(t, payer, now+1, now+1, 50_000_000, 50_000_000,
		CashbackRequestMetadata{FaceAmount: 100, QuotaPerFaceUnit: "500000"})
	var zero, payable CashbackReward
	require.NoError(t, DB.Where("top_up_id = ?", short.Id).First(&zero).Error)
	require.NoError(t, DB.Where("top_up_id = ?", full.Id).First(&payable).Error)
	require.Zero(t, zero.RewardQuota)
	require.Equal(t, CashbackSettlementCanceled, zero.SettlementStatus)
	require.Equal(t, 1_500_000, payable.RewardQuota)

	visible, count, err := ListCashbackRewards(CashbackRewardFilter{}, &common.PageInfo{Page: 1, PageSize: 1})
	require.NoError(t, err)
	assert.EqualValues(t, 1, count)
	require.Len(t, visible, 1)
	assert.Equal(t, payable.ID, visible[0].ID)
	secondPage, count, err := ListCashbackRewards(CashbackRewardFilter{}, &common.PageInfo{Page: 2, PageSize: 1})
	require.NoError(t, err)
	assert.EqualValues(t, 1, count)
	assert.Empty(t, secondPage)

	canceled, count, err := ListCashbackRewards(CashbackRewardFilter{SettlementStatus: CashbackSettlementCanceled}, nil)
	require.NoError(t, err)
	assert.Zero(t, count)
	assert.Empty(t, canceled)
	detail, err := GetCashbackRewardWithContext(zero.ID)
	require.NoError(t, err)
	assert.Equal(t, "below_minimum", detail.Reward.CapReason)
}

func TestCashbackImmediateIssueKeepsPurchaseAndRewardBehindOneQuotaFence(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	setting := saveCashbackTestSetting(t, now-100)
	setting.AutoReviewEnabled = true
	setting.AutoReviewRiskFlags = []string{}
	require.NoError(t, SaveCashbackSetting(setting))
	payer := User{Username: "immediate-fenced-payer", Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&payer).Error)
	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 1_000
	t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })
	order := TopUp{UserId: payer.Id, Amount: 1, Money: 1, TradeNo: "immediate-fenced-order",
		PaymentProvider: PaymentProviderEpay, PaymentMethod: "alipay", CreateTime: now, Status: common.TopUpStatusPending}
	require.NoError(t, insertCashbackTestTopUp(&order, 1_000, CashbackRequestMetadata{}))
	redis := useUserCacheMiniRedis(t)
	require.NoError(t, writeUserCache(payer.ToBaseUser(), true))
	_, err := RechargeEpay(order.TradeNo, "alipay", "1.00", "127.0.0.1", epayTestDetails(order.TradeNo))
	require.NoError(t, err)
	var reward CashbackReward
	require.NoError(t, DB.Where("top_up_id = ? AND direction = ?", order.Id, CashbackDirectionInvitee).First(&reward).Error)
	require.Equal(t, CashbackSettlementIssued, reward.SettlementStatus)
	_, err = cacheGetUserBase(payer.Id)
	assert.ErrorIs(t, err, ErrUserQuotaMutationPending)
	redis.FastForward(time.Duration(userQuotaMutationCooldownSeconds()+1) * time.Second)
	user, err := GetUserCache(payer.Id)
	require.NoError(t, err)
	assert.Equal(t, 1_000+reward.RewardQuota, user.Quota)
}

func TestCashbackImmediateIssueLosesFenceAfterRewardMutationAndRollsBack(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	setting := saveCashbackTestSetting(t, now-100)
	setting.AutoReviewEnabled = true
	setting.AutoReviewRiskFlags = []string{}
	require.NoError(t, SaveCashbackSetting(setting))
	payer := User{Username: "immediate-lost-fence", Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&payer).Error)
	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 1_000
	t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })
	order := TopUp{UserId: payer.Id, Amount: 1, Money: 1, TradeNo: "immediate-lost-fence-order",
		PaymentProvider: PaymentProviderEpay, PaymentMethod: "alipay", CreateTime: now, Status: common.TopUpStatusPending}
	require.NoError(t, insertCashbackTestTopUp(&order, 1_000, CashbackRequestMetadata{}))
	useUserCacheMiniRedis(t)
	const callback = "test:immediate-lost-fence"
	require.NoError(t, DB.Callback().Update().After("gorm:update").Register(callback, func(tx *gorm.DB) {
		if tx.Statement.Table == "cashback_rewards" {
			_ = common.RDB.Del(t.Context(), getUserQuotaMutationFenceKey(payer.Id)).Err()
		}
	}))
	_, err := RechargeEpay(order.TradeNo, "alipay", "1.00", "127.0.0.1", epayTestDetails(order.TradeNo))
	require.ErrorIs(t, err, ErrUserQuotaMutationFenceLost)
	require.NoError(t, DB.Callback().Update().Remove(callback))
	var stored TopUp
	require.NoError(t, DB.First(&stored, order.Id).Error)
	assert.Equal(t, common.TopUpStatusPending, stored.Status)
	var wallet User
	require.NoError(t, DB.First(&wallet, payer.Id).Error)
	assert.Zero(t, wallet.Quota)
	var count int64
	require.NoError(t, DB.Model(&CashbackQuotaMutation{}).Where("top_up_id = ?", order.Id).Count(&count).Error)
	assert.Zero(t, count)
}

func TestCashbackImmediateIssueFailureDefersRewardAndKeepsPayment(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	setting := saveCashbackTestSetting(t, now-100)
	setting.AutoReviewEnabled = true
	setting.AutoReviewRiskFlags = []string{}
	require.NoError(t, SaveCashbackSetting(setting))
	payer := User{Username: "immediate-rollback", Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&payer).Error)
	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 1_000
	t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })
	order := TopUp{UserId: payer.Id, Amount: 1, Money: 1, TradeNo: "immediate-rollback-order",
		PaymentProvider: PaymentProviderEpay, PaymentMethod: "alipay", CreateTime: now, Status: common.TopUpStatusPending}
	require.NoError(t, insertCashbackTestTopUp(&order, 1_000, CashbackRequestMetadata{}))
	fail := errors.New("forced immediate mutation failure")
	const callback = "test:immediate-mutation-failure"
	require.NoError(t, DB.Callback().Create().Before("gorm:create").Register(callback, func(tx *gorm.DB) {
		if tx.Statement.Table == "cashback_quota_mutations" {
			tx.AddError(fail)
		}
	}))
	_, err := RechargeEpay(order.TradeNo, "alipay", "1.00", "127.0.0.1", epayTestDetails(order.TradeNo))
	require.NoError(t, err, "a failed immediate cashback issue must not roll back the purchase")
	require.NoError(t, DB.Callback().Create().Remove(callback))
	var stored TopUp
	require.NoError(t, DB.First(&stored, order.Id).Error)
	assert.Equal(t, common.TopUpStatusSuccess, stored.Status)
	var wallet User
	require.NoError(t, DB.First(&wallet, payer.Id).Error)
	assert.Equal(t, 1_000, wallet.Quota, "only the purchase is credited; the reward mutation was rolled back to its savepoint")
	var reward CashbackReward
	require.NoError(t, DB.Where("top_up_id = ? AND direction = ?", order.Id, CashbackDirectionInvitee).First(&reward).Error)
	assert.Equal(t, CashbackReviewApproved, reward.ReviewStatus)
	assert.Equal(t, CashbackSettlementFrozen, reward.SettlementStatus)
	assert.Contains(t, reward.LastSettlementError, "immediate issue deferred")
	var mutations int64
	require.NoError(t, DB.Model(&CashbackQuotaMutation{}).Where("reward_id = ?", reward.ID).Count(&mutations).Error)
	assert.Zero(t, mutations)

	result, err := SettleMaturedCashbackRewards(time.Now().Unix(), 100)
	require.NoError(t, err)
	assert.Equal(t, 1, result.Issued)
	require.NoError(t, DB.First(&reward, reward.ID).Error)
	assert.Equal(t, CashbackSettlementIssued, reward.SettlementStatus)
	require.NoError(t, DB.First(&wallet, payer.Id).Error)
	assert.Equal(t, 1_000+reward.RewardQuota, wallet.Quota)
}

func TestOnlineTopUpRefusesChangedReferralBeforeCredit(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	_, payer := createCashbackUsers(t, now-30*24*60*60)
	order := TopUp{UserId: payer.Id, Amount: 1, Money: 1, TradeNo: "changed-referral-before-lock",
		PaymentProvider: PaymentProviderEpay, PaymentMethod: "alipay", CreateTime: now, Status: common.TopUpStatusPending}
	require.NoError(t, insertCashbackTestTopUp(&order, 1_000, CashbackRequestMetadata{}))
	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 1_000
	t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })

	const callbackName = "test:change-referral-before-payer-lock"
	changed := false
	require.NoError(t, DB.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if changed || tx.Statement.Table != "users" {
			return
		}
		if _, ok := tx.Statement.Dest.(*User); !ok {
			return
		}
		changed = true
		// Simulate a relationship update between the candidate read and the
		// sorted row lock. The payment must retry, not credit an old referral.
		if err := tx.Exec("UPDATE users SET inviter_id = 0 WHERE id = ?", payer.Id).Error; err != nil {
			tx.AddError(err)
		}
	}))
	_, err := RechargeEpay(order.TradeNo, "alipay", "1.00", "127.0.0.1", epayTestDetails(order.TradeNo))
	require.ErrorIs(t, err, ErrCashbackInvalidState)
	require.True(t, changed)
	require.NoError(t, DB.Callback().Query().Remove(callbackName))
	var stored TopUp
	require.NoError(t, DB.First(&stored, order.Id).Error)
	assert.Equal(t, common.TopUpStatusPending, stored.Status)
	var user User
	require.NoError(t, DB.First(&user, payer.Id).Error)
	assert.Zero(t, user.Quota)
	assert.Equal(t, payer.InviterId, user.InviterId) // Transaction rolled back the concurrent-change simulation.
}

func TestOnlineTopUpLostFenceAfterCompletionRollsBack(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	_, payer := createCashbackUsers(t, now-30*24*60*60)
	order := TopUp{UserId: payer.Id, Amount: 1, Money: 1, TradeNo: "lost-fence-after-completion",
		PaymentProvider: PaymentProviderEpay, PaymentMethod: "alipay", CreateTime: now, Status: common.TopUpStatusPending}
	require.NoError(t, insertCashbackTestTopUp(&order, 1_000, CashbackRequestMetadata{}))
	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 1_000
	t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })
	useUserCacheMiniRedis(t)

	const callbackName = "test:topup-fence-lost-after-credit"
	require.NoError(t, DB.Callback().Update().After("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table == "cashback_order_contexts" {
			if err := common.RDB.Del(t.Context(), getUserQuotaMutationFenceKey(payer.Id)).Err(); err != nil {
				tx.AddError(err)
			}
		}
	}))
	_, err := RechargeEpay(order.TradeNo, "alipay", "1.00", "127.0.0.1", epayTestDetails(order.TradeNo))
	require.ErrorIs(t, err, ErrUserQuotaMutationFenceLost)
	require.NoError(t, DB.Callback().Update().Remove(callbackName))
	var stored TopUp
	require.NoError(t, DB.First(&stored, order.Id).Error)
	assert.Equal(t, common.TopUpStatusPending, stored.Status)
	var user User
	require.NoError(t, DB.First(&user, payer.Id).Error)
	assert.Zero(t, user.Quota)
	var rewardCount int64
	require.NoError(t, DB.Model(&CashbackReward{}).Where("top_up_id = ?", order.Id).Count(&rewardCount).Error)
	assert.Zero(t, rewardCount)
}

func TestAllOnlineTopUpProvidersCreateCashbackInSettlement(t *testing.T) {
	providers := []struct {
		name     string
		provider string
		method   string
		amount   int64
		settle   func(string) error
	}{
		{
			name: "epay", provider: PaymentProviderEpay, method: "alipay", amount: 1,
			settle: func(tradeNo string) error {
				_, err := RechargeEpay(tradeNo, "alipay", "1.00", "127.0.0.1", epayTestDetails(tradeNo))
				return err
			},
		},
		{name: "stripe", provider: PaymentProviderStripe, method: PaymentMethodStripe, amount: 1, settle: func(tradeNo string) error {
			return Recharge(tradeNo, "customer", "127.0.0.1")
		}},
		{name: "creem", provider: PaymentProviderCreem, method: PaymentMethodCreem, amount: 1_000, settle: func(tradeNo string) error {
			return RechargeCreem(tradeNo, "", "", "127.0.0.1")
		}},
		{name: "waffo", provider: PaymentProviderWaffo, method: PaymentMethodWaffo, amount: 1, settle: func(tradeNo string) error {
			return RechargeWaffo(tradeNo, "127.0.0.1")
		}},
		{name: "waffo pancake", provider: PaymentProviderWaffoPancake, method: PaymentMethodWaffoPancake, amount: 1, settle: func(tradeNo string) error {
			return RechargeWaffoPancake(tradeNo)
		}},
	}

	for _, provider := range providers {
		t.Run(provider.name, func(t *testing.T) {
			setupCashbackTestDB(t)
			oldQuotaPerUnit := common.QuotaPerUnit
			common.QuotaPerUnit = 1_000
			t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })
			now := time.Now().Unix()
			saveCashbackTestSetting(t, now-100)
			_, invitee := createCashbackUsers(t, now-30*24*60*60)
			topUp := TopUp{
				UserId: invitee.Id, Amount: provider.amount, Money: 1,
				TradeNo:       "provider-cashback-" + strings.ReplaceAll(provider.name, " ", "-"),
				PaymentMethod: provider.method, PaymentProvider: provider.provider,
				CreateTime: now, Status: common.TopUpStatusPending,
			}
			require.NoError(t, insertCashbackTestTopUp(&topUp, 1_000, CashbackRequestMetadata{}))

			// Purchase credit must not acquire the payer row ahead of the
			// smaller inviter row (issuance locks both in ascending order).
			lockedBeneficiaries := false
			callbackName := "test:online-topup-user-lock-order"
			require.NoError(t, DB.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
				if tx.Statement.Table != "users" {
					return
				}
				users, ok := tx.Statement.Dest.(*[]User)
				if ok && len(*users) == 2 && (*users)[0].Id < (*users)[1].Id {
					lockedBeneficiaries = true
				}
			}))
			require.NoError(t, DB.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
				if tx.Statement.Table == "users" && !lockedBeneficiaries {
					tx.AddError(errors.New("purchase credit preceded ordered beneficiary locks"))
				}
			}))
			require.NoError(t, provider.settle(topUp.TradeNo))
			require.True(t, lockedBeneficiaries)
			require.NoError(t, DB.Callback().Query().Remove(callbackName))
			require.NoError(t, DB.Callback().Update().Remove(callbackName))
			require.NoError(t, provider.settle(topUp.TradeNo))

			var rewardCount int64
			require.NoError(t, DB.Model(&CashbackReward{}).Where("top_up_id = ?", topUp.Id).Count(&rewardCount).Error)
			assert.EqualValues(t, 2, rewardCount)
			var orderContext CashbackOrderContext
			require.NoError(t, DB.Where("top_up_id = ?", topUp.Id).First(&orderContext).Error)
			assert.Equal(t, CashbackCompletionProviderCallback, orderContext.CompletionSource)
			assert.Equal(t, 1_000, orderContext.CreditedQuota)
			var storedUser User
			require.NoError(t, DB.First(&storedUser, invitee.Id).Error)
			assert.Equal(t, 1_000, storedUser.Quota)
		})
	}
}

func TestCashbackVerifiedPaymentsFailClosedWhenDatabaseClockFails(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 1_000
	t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })
	for _, provider := range []struct {
		name, method string
		amount       int64
		settle       func(string) error
	}{
		{PaymentProviderEpay, "alipay", 1, func(ref string) error {
			_, err := RechargeEpay(ref, "alipay", "1.00", "127.0.0.1", epayTestDetails(ref))
			return err
		}},
		{PaymentProviderStripe, PaymentMethodStripe, 1, func(ref string) error { return Recharge(ref, "customer", "127.0.0.1") }},
		{PaymentProviderCreem, PaymentMethodCreem, 1_000, func(ref string) error { return RechargeCreem(ref, "", "", "127.0.0.1") }},
		{PaymentProviderWaffo, PaymentMethodWaffo, 1, func(ref string) error { return RechargeWaffo(ref, "127.0.0.1") }},
		{PaymentProviderWaffoPancake, PaymentMethodWaffoPancake, 1, RechargeWaffoPancake},
	} {
		t.Run(provider.name, func(t *testing.T) {
			payer := User{Username: "clock_" + provider.name, AffCode: "clock_" + provider.name, Status: common.UserStatusEnabled}
			require.NoError(t, DB.Create(&payer).Error)
			order := TopUp{UserId: payer.Id, Amount: provider.amount, Money: 1, TradeNo: "clock_" + provider.name,
				PaymentMethod: provider.method, PaymentProvider: provider.name, CreateTime: now, Status: common.TopUpStatusPending}
			require.NoError(t, insertCashbackTestTopUp(&order, 1_000, CashbackRequestMetadata{}))
			const callback = "test:cashback-db-clock-failure"
			clockQueries := 0
			require.NoError(t, DB.Callback().Row().Before("gorm:row").Register(callback, func(tx *gorm.DB) {
				if strings.Contains(tx.Statement.SQL.String(), "strftime('%s','now')") {
					clockQueries++
					tx.AddError(errors.New("database clock unavailable"))
				}
			}))
			require.Error(t, provider.settle(order.TradeNo))
			require.NoError(t, DB.Callback().Row().Remove(callback))
			require.Positive(t, clockQueries)
			var stored TopUp
			require.NoError(t, DB.First(&stored, order.Id).Error)
			assert.Equal(t, common.TopUpStatusPending, stored.Status)
			assert.Zero(t, stored.CompleteTime)
			var wallet User
			require.NoError(t, DB.First(&wallet, payer.Id).Error)
			assert.Zero(t, wallet.Quota)
			var rewards int64
			require.NoError(t, DB.Model(&CashbackReward{}).Where("top_up_id = ?", order.Id).Count(&rewards).Error)
			assert.Zero(t, rewards)
		})
	}
}

func TestCashbackReasonLimitCountsUnicodeCodePoints(t *testing.T) {
	setupCashbackTestDB(t)
	valid := strings.Repeat("理", maxCashbackReasonCharacters)
	tooLong := valid + "理"
	assert.True(t, cashbackTextWithinLimit(valid))
	assert.False(t, cashbackTextWithinLimit(tooLong))

	_, err := ReviewCashbackReward(999, CashbackReviewActionApprove, valid, 1, 1)
	assert.ErrorIs(t, err, ErrCashbackNotFound)
	_, err = ReviewCashbackReward(999, CashbackReviewActionApprove, tooLong, 1, 1)
	assert.ErrorIs(t, err, ErrCashbackInvalidInput)
	_, err = HandleCashbackIncident(999, CashbackIncidentInput{
		Kind: CashbackIncidentDispute, Reason: tooLong, OperatorID: 1, Now: 1,
	})
	assert.ErrorIs(t, err, ErrCashbackInvalidInput)
	_, err = ResolveCashbackRewardDebt(999, 1, tooLong, 1)
	assert.ErrorIs(t, err, ErrCashbackInvalidInput)
	_, err = ResolveCashbackPrincipalDebt(999, 1, tooLong, 1)
	assert.ErrorIs(t, err, ErrCashbackInvalidInput)
}

func TestParseCashbackDeviceSignalRejectsUntrustedValuesWithoutBlockingMissing(t *testing.T) {
	hash, status := ParseCashbackDeviceSignal("")
	assert.Empty(t, hash)
	assert.Equal(t, CashbackDeviceSignalMissing, status)

	hash, status = ParseCashbackDeviceSignal("v1:not-a-hash")
	assert.Empty(t, hash)
	assert.Equal(t, CashbackDeviceSignalInvalid, status)

	hash, status = ParseCashbackDeviceSignal("v1:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc")
	assert.Len(t, hash, 64)
	assert.Equal(t, CashbackDeviceSignalValid, status)
}

func TestPostEnableTopUpCannotCompleteWithoutRequiredCashbackContext(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	_, invitee := createCashbackUsers(t, now-30*24*60*60)
	topUp := TopUp{
		UserId: invitee.Id, Amount: 1, Money: 1, TradeNo: "missing-cashback-context",
		PaymentMethod: PaymentMethodStripe, PaymentProvider: PaymentProviderStripe,
		CreateTime: now, Status: common.TopUpStatusPending,
	}
	require.NoError(t, DB.Create(&topUp).Error)

	err := DB.Transaction(func(tx *gorm.DB) error {
		var locked TopUp
		if err := lockForUpdate(tx).First(&locked, topUp.Id).Error; err != nil {
			return err
		}
		locked.Status = common.TopUpStatusSuccess
		locked.CompleteTime = now
		if err := tx.Save(&locked).Error; err != nil {
			return err
		}
		return CompleteTopUpCashbackTx(tx, &locked, 1_000, CashbackCompletionProviderCallback)
	})
	require.ErrorIs(t, err, ErrCashbackOrderContextMissing)

	var stored TopUp
	require.NoError(t, DB.First(&stored, topUp.Id).Error)
	assert.Equal(t, common.TopUpStatusPending, stored.Status)
	assert.Zero(t, stored.CompleteTime)

	invalidContext := CashbackOrderContext{
		TopUpID: topUp.Id, TradeNo: topUp.TradeNo, UserID: topUp.UserId,
		PaymentProvider: topUp.PaymentProvider, BaseQuota: 1_000,
		DeviceSignalStatus: CashbackDeviceSignalMissing, EligibleAfterFirstEnable: false,
	}
	require.NoError(t, DB.Create(&invalidContext).Error)
	err = DB.Transaction(func(tx *gorm.DB) error {
		var locked TopUp
		if err := lockForUpdate(tx).First(&locked, topUp.Id).Error; err != nil {
			return err
		}
		locked.Status = common.TopUpStatusSuccess
		locked.CompleteTime = now
		if err := tx.Save(&locked).Error; err != nil {
			return err
		}
		return CompleteTopUpCashbackTx(tx, &locked, 1_000, CashbackCompletionProviderCallback)
	})
	require.NoError(t, err)
	require.NoError(t, DB.First(&stored, topUp.Id).Error)
	assert.Equal(t, common.TopUpStatusSuccess, stored.Status)
	require.NoError(t, DB.First(&invalidContext, invalidContext.ID).Error)
	assert.Equal(t, CashbackCompletionProviderCallback, invalidContext.CompletionSource)
	assert.Equal(t, 1_000, invalidContext.CreditedQuota)
	var rewardCount int64
	require.NoError(t, DB.Model(&CashbackReward{}).Where("top_up_id = ?", topUp.Id).Count(&rewardCount).Error)
	assert.Zero(t, rewardCount)
}

func TestContextlessPreEnableTopUpKeepsLegacyCompatibility(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	firstEnabledAt := now - 100
	saveCashbackTestSetting(t, firstEnabledAt)
	_, invitee := createCashbackUsers(t, now-30*24*60*60)
	topUp := TopUp{
		UserId: invitee.Id, Amount: 1, Money: 1, TradeNo: "legacy-pre-enable-contextless",
		PaymentMethod: PaymentMethodStripe, PaymentProvider: PaymentProviderStripe,
		CreateTime: firstEnabledAt - 1, Status: common.TopUpStatusPending,
	}
	require.NoError(t, DB.Create(&topUp).Error)

	err := DB.Transaction(func(tx *gorm.DB) error {
		var locked TopUp
		if err := lockForUpdate(tx).First(&locked, topUp.Id).Error; err != nil {
			return err
		}
		locked.Status = common.TopUpStatusSuccess
		locked.CompleteTime = now
		if err := tx.Save(&locked).Error; err != nil {
			return err
		}
		return CompleteTopUpCashbackTx(tx, &locked, 1_000, CashbackCompletionProviderCallback)
	})
	require.NoError(t, err)

	var stored TopUp
	require.NoError(t, DB.First(&stored, topUp.Id).Error)
	assert.Equal(t, common.TopUpStatusSuccess, stored.Status)
	var contextCount, rewardCount int64
	require.NoError(t, DB.Model(&CashbackOrderContext{}).Where("top_up_id = ?", topUp.Id).Count(&contextCount).Error)
	require.NoError(t, DB.Model(&CashbackReward{}).Where("top_up_id = ?", topUp.Id).Count(&rewardCount).Error)
	assert.Zero(t, contextCount)
	assert.Zero(t, rewardCount)
}

func TestStripeRechargeDuplicateCallbackIsIdempotentWithCashback(t *testing.T) {
	setupCashbackTestDB(t)
	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 1_000
	t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })

	now := time.Now().Unix()
	saveCashbackTestSetting(t, now-100)
	_, invitee := createCashbackUsers(t, now-30*24*60*60)
	topUp := TopUp{
		UserId: invitee.Id, Amount: 1, Money: 1, TradeNo: "stripe-cashback-idempotent",
		PaymentMethod: PaymentMethodStripe, PaymentProvider: PaymentProviderStripe,
		CreateTime: now, Status: common.TopUpStatusPending,
	}
	require.NoError(t, insertCashbackTestTopUp(&topUp, 1_000, CashbackRequestMetadata{}))

	require.NoError(t, Recharge(topUp.TradeNo, "customer-1", "127.0.0.1"))
	require.NoError(t, Recharge(topUp.TradeNo, "customer-1", "127.0.0.1"))

	var storedUser User
	require.NoError(t, DB.First(&storedUser, invitee.Id).Error)
	assert.Equal(t, 1_000, storedUser.Quota)
	var rewardCount int64
	require.NoError(t, DB.Model(&CashbackReward{}).Where("top_up_id = ?", topUp.Id).Count(&rewardCount).Error)
	assert.EqualValues(t, 2, rewardCount)
}

func TestPayerCashbackTieredPreviewSharesSelectedFaceAndRejectsOtherBasis(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	_, payer := createCashbackUsers(t, now-86400)
	setting := saveCashbackTestSetting(t, now-300)
	setting.InviterEnabled = false
	setting.InviteeStrategy = operation_setting.CashbackStrategyTiered
	setting.InviteeTiers = []operation_setting.CashbackTier{{ThresholdCents: 10050, RewardCents: 250}, {ThresholdCents: 20000, RewardCents: 1500}}
	setting.MaxRewardQuota = common.MaxWalletQuota
	setting.DailyRewardQuota = common.MaxWalletQuota
	require.NoError(t, SaveCashbackSetting(setting))

	preview, err := PreviewPayerCashback(payer.Id, 50_500_000, 101, "500000")
	require.NoError(t, err)
	assert.Equal(t, "estimated", preview.Status)
	assert.Equal(t, 1_250_000, preview.RewardQuota)
	assert.Equal(t, setting.InviteeTiers, preview.Tiers)
	assert.Equal(t, &setting.InviteeTiers[0], preview.MatchedTier)
	preview, err = PreviewPayerCashback(payer.Id, 50_000_000, 100, "500000")
	require.NoError(t, err)
	assert.Equal(t, "below_minimum", preview.Status)
	assert.Nil(t, preview.MatchedTier)
	preview, err = PreviewPayerCashback(payer.Id, 101, 101, "1")
	require.NoError(t, err)
	assert.Equal(t, "not_applicable", preview.Status)
	assert.Zero(t, preview.RewardQuota)
	assert.Empty(t, preview.Tiers)

	context := CashbackOrderContext{FaceAmount: 101, BaseQuota: 50_500_051, QuotaPerFaceUnit: "500000.51"}
	quota, tier, err := calculateCashbackTieredQuota(&context, setting.InviteeTiers)
	require.NoError(t, err)
	assert.Equal(t, 1_250_001, quota)
	assert.Equal(t, &setting.InviteeTiers[0], tier)

	setting.InviteeTiers = []operation_setting.CashbackTier{{ThresholdCents: 10050, RewardCents: 1}}
	require.NoError(t, SaveCashbackSetting(setting))
	preview, err = PreviewPayerCashback(payer.Id, 102, 101, "1.01")
	require.NoError(t, err)
	assert.Equal(t, "rounds_to_zero", preview.Status)
	assert.Zero(t, preview.RewardQuota)
	assert.Equal(t, &setting.InviteeTiers[0], preview.MatchedTier)
	preview, err = PreviewPayerCashback(payer.Id, 101, 100, "1.01")
	require.NoError(t, err)
	assert.Equal(t, "below_minimum", preview.Status)
	assert.Nil(t, preview.MatchedTier)
}

func TestPayerCashbackPreviewMatchesFaceAndCapsWithoutWriting(t *testing.T) {
	setupCashbackTestDB(t)
	now := time.Now().Unix()
	_, payer := createCashbackUsers(t, now-86400)
	setting := saveCashbackTestSetting(t, now-300)
	setting.InviterEnabled = false
	setting.InviteeRateBPS = 2000
	setting.MaxRewardQuota = 15_000_000
	setting.DailyRewardQuota = 25_000_000
	require.NoError(t, SaveCashbackSetting(setting))

	preview, err := PreviewPayerCashback(payer.Id, 125_000_000, 250, "500000")
	require.NoError(t, err)
	assert.Equal(t, "estimated", preview.Status)
	assert.Equal(t, 15_000_000, preview.RewardQuota)
	assert.Equal(t, 2000, preview.RateBPS)

	order := createCompletedCashbackTopUp(t, payer, now-100, now-10, 125_000_000, 125_000_000,
		CashbackRequestMetadata{FaceAmount: 250, QuotaPerFaceUnit: "500000"})
	var reward CashbackReward
	require.NoError(t, DB.Where("top_up_id = ?", order.Id).First(&reward).Error)
	assert.Equal(t, preview.RewardQuota, reward.RewardQuota)

	preview, err = PreviewPayerCashback(payer.Id, 125_000_000, 250, "500000")
	require.NoError(t, err)
	assert.Equal(t, 10_000_000, preview.RewardQuota)
	var count int64
	require.NoError(t, DB.Model(&CashbackReward{}).Count(&count).Error)
	assert.EqualValues(t, 1, count)

	setting.InviteeStrategy = operation_setting.CashbackStrategyPerHundred
	setting.InviteeFixedPerHundred = 20
	require.NoError(t, SaveCashbackSetting(setting))
	preview, err = PreviewPayerCashback(payer.Id, 50_000_000, 100, "500000")
	require.NoError(t, err)
	assert.Equal(t, "estimated", preview.Status)
	assert.Equal(t, 10_000_000, preview.RewardQuota) // Fixed face, not paid price.
	assert.Equal(t, 10_000_000, preview.CalculatedQuota)
	assert.Empty(t, preview.CapReason)
	assert.Equal(t, 20, preview.FixedPerHundred)
	preview, err = PreviewPayerCashback(payer.Id, 49_500_000, 99, "500000")
	require.NoError(t, err)
	assert.Equal(t, "below_minimum", preview.Status)
	assert.Zero(t, preview.RewardQuota)
	// Creem's product quota is its face, not the product's checkout price.
	preview, err = PreviewPayerCashback(payer.Id, 250, 250, "1")
	require.NoError(t, err)
	assert.Equal(t, 40, preview.RewardQuota)
	assert.EqualValues(t, 1, count)

	preview, err = PreviewPayerCashback(payer.Id, 0, 0, "")
	require.NoError(t, err)
	assert.Equal(t, "select_amount", preview.Status)
	assert.Zero(t, preview.RewardQuota)

	setting.DailyRewardQuota = 15_000_000
	require.NoError(t, SaveCashbackSetting(setting))
	preview, err = PreviewPayerCashback(payer.Id, 250, 250, "1")
	require.NoError(t, err)
	assert.Equal(t, "cap_exhausted", preview.Status)
	assert.Zero(t, preview.RewardQuota)

	setting.DailyRewardQuota = common.MaxWalletQuota
	require.NoError(t, SaveCashbackSetting(setting))
	require.NoError(t, DB.Model(&reward).Update("outstanding_debt_quota", 1).Error)
	preview, err = PreviewPayerCashback(payer.Id, 250, 250, "1")
	require.NoError(t, err)
	assert.Equal(t, "ineligible", preview.Status)
	require.NoError(t, DB.Model(&reward).Update("outstanding_debt_quota", 0).Error)
	require.NoError(t, DB.Model(&CashbackCampaign{}).Where("id > 0").Update("max_rewards_per_user", 1).Error)
	preview, err = PreviewPayerCashback(payer.Id, 250, 250, "1")
	require.NoError(t, err)
	assert.Equal(t, "limit_reached", preview.Status)

	// Once a positive slot is used, rejecting/canceling it must not create a
	// second opportunity in either preview or verified settlement.
	require.NoError(t, DB.Model(&reward).Updates(map[string]any{
		"review_status": CashbackReviewRejected, "settlement_status": CashbackSettlementCanceled,
	}).Error)
	preview, err = PreviewPayerCashback(payer.Id, 250, 250, "1")
	require.NoError(t, err)
	assert.Equal(t, "limit_reached", preview.Status)
	later := createCompletedCashbackTopUp(t, payer, now, now, 250, 250,
		CashbackRequestMetadata{FaceAmount: 250, QuotaPerFaceUnit: "1"})
	var laterRewards int64
	require.NoError(t, DB.Model(&CashbackReward{}).Where("top_up_id = ?", later.Id).Count(&laterRewards).Error)
	assert.Zero(t, laterRewards)

	require.NoError(t, DB.Model(&CashbackCampaign{}).Where("id > 0").Update("max_rewards_per_user", 100).Error)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", payer.Id).Update("status", common.UserStatusDisabled).Error)
	preview, err = PreviewPayerCashback(payer.Id, 250, 250, "1")
	require.NoError(t, err)
	assert.Equal(t, "ineligible", preview.Status)
	require.NoError(t, DB.Model(&CashbackCampaign{}).Where("id > 0").Update("stopped_at", now-1).Error)
	preview, err = PreviewPayerCashback(payer.Id, 250, 250, "1")
	require.NoError(t, err)
	assert.Equal(t, "no_campaign", preview.Status)
	assert.Empty(t, preview.Strategy)
	setting.InviteeEnabled = false
	require.NoError(t, SaveCashbackSetting(setting))
	preview, err = PreviewPayerCashback(payer.Id, 250, 250, "1")
	require.NoError(t, err)
	assert.Equal(t, "inactive", preview.Status)
	assert.Empty(t, preview.Strategy)
	require.NoError(t, DB.Model(&CashbackReward{}).Count(&count).Error)
	assert.EqualValues(t, 1, count)
}
