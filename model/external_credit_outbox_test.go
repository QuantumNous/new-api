package model

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func loadExternalWalletCredit(t *testing.T, requestID string) BillingAdjustmentOutbox {
	t.Helper()
	requestID = NormalizeBillingAdjustmentRequestID(requestID)
	var row BillingAdjustmentOutbox
	require.NoError(t, DB.Where(
		"request_id = ? AND phase = ? AND leg = ?",
		requestID,
		BillingAdjustmentPhaseExternalCredit,
		BillingAdjustmentLegWallet,
	).First(&row).Error)
	return row
}

func TestTopUpCreditWaitsDurablyForHeadroomWithActiveImageReservation(t *testing.T) {
	truncateTables(t)
	redisServer := useImageTaskTestRedis(t)

	credit, clamp := common.QuotaFromDecimalChecked(decimal.NewFromInt(1).Mul(decimal.NewFromFloat(common.QuotaPerUnit)))
	require.Nil(t, clamp)
	require.Positive(t, credit)

	user := User{Username: "external-credit-topup", Quota: common.MaxQuota - 5, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	require.NoError(t, populateUserCache(user))

	reservation := ImageBillingReservation{
		TaskID:         "external-credit-active-image",
		RequestID:      "external-credit-active-image-request",
		UserID:         user.Id,
		ExpectedQuota:  5,
		FundingSource:  "wallet",
		WalletReserved: 5,
		Status:         ImageBillingReservationActive,
		CreatedAt:      common.GetTimestamp(),
		UpdatedAt:      common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(&reservation).Error)
	require.NoError(t, common.RDB.SAdd(
		context.Background(),
		imageTaskUserQuotaPinsKey(user.Id),
		imageReservationCachePinMember(reservation.TaskID),
	).Err())

	topUp := TopUp{
		UserId:          user.Id,
		Amount:          1,
		Money:           1,
		TradeNo:         strings.Repeat("external-credit-headroom-topup-", 4),
		PaymentMethod:   PaymentMethodWaffoPancake,
		PaymentProvider: PaymentProviderWaffoPancake,
		Status:          common.TopUpStatusPending,
		CreateTime:      common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(&topUp).Error)

	require.NoError(t, RechargeWaffoPancake(topUp.TradeNo))

	storedTopUp := GetTopUpByTradeNo(topUp.TradeNo)
	require.NotNil(t, storedTopUp)
	assert.Equal(t, common.TopUpStatusSuccess, storedTopUp.Status)

	var storedUser User
	require.NoError(t, DB.First(&storedUser, user.Id).Error)
	assert.Equal(t, common.MaxQuota-5, storedUser.Quota)

	adjustment := loadExternalWalletCredit(t, "topup:"+topUp.TradeNo)
	assert.EqualValues(t, credit, adjustment.Delta)
	assert.False(t, adjustment.DBApplied)
	assert.Equal(t, billingAdjustmentRetry, adjustment.Status)
	assert.Contains(t, adjustment.LastError, ErrBillingAdjustmentBalanceBlocked.Error())

	require.NoError(t, DecreaseUserQuotaDirect(user.Id, credit))
	require.NoError(t, DB.Model(&BillingAdjustmentOutbox{}).Where("id = ?", adjustment.Id).Updates(map[string]interface{}{
		"next_attempt_at": 0,
		"lease_until":     0,
	}).Error)
	require.NoError(t, ProcessBillingAdjustmentOutbox(adjustment.Id))
	require.NoError(t, ProcessBillingAdjustmentOutbox(adjustment.Id))

	require.NoError(t, DB.First(&storedUser, user.Id).Error)
	assert.Equal(t, common.MaxQuota-5, storedUser.Quota)
	raw, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, common.MaxQuota-5, raw.Quota)
	assert.True(t, redisServer.Exists(imageTaskUserQuotaInvalidationKey(user.Id)))

	adjustment = loadExternalWalletCredit(t, "topup:"+topUp.TradeNo)
	assert.True(t, adjustment.DBApplied)
	assert.True(t, adjustment.CacheApplied)
	assert.Equal(t, billingAdjustmentDelivered, adjustment.Status)
}

func TestTopUpCompletionPathsUseSingleExternalCreditClaim(t *testing.T) {
	creditPerUnit := common.QuotaFromFloat(common.QuotaPerUnit)
	tests := []struct {
		name              string
		provider          string
		amount            int64
		money             float64
		expected          int
		complete          func(string) error
		wantPaymentMethod string
		stripeCustomer    string
	}{
		{
			name:           "stripe",
			provider:       PaymentProviderStripe,
			amount:         100,
			money:          1,
			expected:       creditPerUnit,
			complete:       func(tradeNo string) error { return Recharge(tradeNo, "cus_external_credit", "127.0.0.1") },
			stripeCustomer: "cus_external_credit",
		},
		{
			name:     "creem",
			provider: PaymentProviderCreem,
			amount:   37,
			money:    1,
			expected: 37,
			complete: func(tradeNo string) error {
				return RechargeCreem(tradeNo, "credit@example.com", "credit", "127.0.0.1")
			},
		},
		{
			name:     "waffo",
			provider: PaymentProviderWaffo,
			amount:   1,
			money:    1,
			expected: creditPerUnit,
			complete: func(tradeNo string) error { return RechargeWaffo(tradeNo, "127.0.0.1") },
		},
		{
			name:              "epay",
			provider:          PaymentProviderEpay,
			amount:            1,
			money:             1,
			expected:          creditPerUnit,
			complete:          func(tradeNo string) error { return RechargeEpay(tradeNo, "alipay", "127.0.0.1") },
			wantPaymentMethod: "alipay",
		},
		{
			name:     "manual",
			provider: PaymentProviderEpay,
			amount:   1,
			money:    1,
			expected: creditPerUnit,
			complete: func(tradeNo string) error { return ManualCompleteTopUp(tradeNo, "127.0.0.1") },
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			truncateTables(t)
			oldRedisEnabled := common.RedisEnabled
			common.RedisEnabled = false
			t.Cleanup(func() { common.RedisEnabled = oldRedisEnabled })

			user := User{
				Username:       "external-credit-topup-" + tt.name,
				Status:         common.UserStatusEnabled,
				StripeCustomer: tt.stripeCustomer,
			}
			require.NoError(t, DB.Create(&user).Error)
			topUp := TopUp{
				UserId:          user.Id,
				Amount:          tt.amount,
				Money:           tt.money,
				TradeNo:         "external-credit-topup-path-" + tt.name,
				PaymentMethod:   tt.provider,
				PaymentProvider: tt.provider,
				Status:          common.TopUpStatusPending,
				CreateTime:      common.GetTimestamp(),
			}
			require.NoError(t, DB.Create(&topUp).Error)
			require.NoError(t, tt.complete(topUp.TradeNo))

			var storedUser User
			require.NoError(t, DB.First(&storedUser, user.Id).Error)
			assert.Equal(t, tt.expected, storedUser.Quota)
			storedTopUp := GetTopUpByTradeNo(topUp.TradeNo)
			require.NotNil(t, storedTopUp)
			assert.Equal(t, common.TopUpStatusSuccess, storedTopUp.Status)
			if tt.wantPaymentMethod != "" {
				assert.Equal(t, tt.wantPaymentMethod, storedTopUp.PaymentMethod)
			}

			adjustment := loadExternalWalletCredit(t, "topup:"+topUp.TradeNo)
			assert.EqualValues(t, tt.expected, adjustment.Delta)
			assert.True(t, adjustment.DBApplied)
			assert.Equal(t, billingAdjustmentDelivered, adjustment.Status)
			var count int64
			require.NoError(t, DB.Model(&BillingAdjustmentOutbox{}).Where(
				"request_id = ? AND phase = ? AND leg = ?",
				NormalizeBillingAdjustmentRequestID("topup:"+topUp.TradeNo),
				BillingAdjustmentPhaseExternalCredit,
				BillingAdjustmentLegWallet,
			).Count(&count).Error)
			assert.EqualValues(t, 1, count)
		})
	}
}

func TestTopUpRollsBackOrderWhenCreditOutboxConflicts(t *testing.T) {
	truncateTables(t)
	user := User{Username: "external-credit-topup-conflict", Quota: 20, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	topUp := TopUp{
		UserId:          user.Id,
		Amount:          1,
		Money:           1,
		TradeNo:         "external-credit-topup-conflict",
		PaymentMethod:   PaymentMethodWaffoPancake,
		PaymentProvider: PaymentProviderWaffoPancake,
		Status:          common.TopUpStatusPending,
		CreateTime:      common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(&topUp).Error)
	credit := common.QuotaFromFloat(common.QuotaPerUnit)
	_, err := EnqueueBillingAdjustments([]BillingAdjustmentSpec{{
		RequestID: "topup:" + topUp.TradeNo,
		Phase:     BillingAdjustmentPhaseExternalCredit,
		Leg:       BillingAdjustmentLegWallet,
		UserID:    user.Id,
		Delta:     int64(credit - 1),
	}})
	require.NoError(t, err)

	require.Error(t, RechargeWaffoPancake(topUp.TradeNo))
	storedTopUp := GetTopUpByTradeNo(topUp.TradeNo)
	require.NotNil(t, storedTopUp)
	assert.Equal(t, common.TopUpStatusPending, storedTopUp.Status)
	var storedUser User
	require.NoError(t, DB.First(&storedUser, user.Id).Error)
	assert.Equal(t, 20, storedUser.Quota)
}

func TestRechargeEpayReplayCreditsExactlyOnce(t *testing.T) {
	truncateTables(t)
	oldRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = oldRedisEnabled })

	user := User{Username: "external-credit-epay-replay", Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	topUp := TopUp{
		UserId:          user.Id,
		Amount:          1,
		Money:           1,
		TradeNo:         "external-credit-epay-replay",
		PaymentMethod:   "wxpay",
		PaymentProvider: PaymentProviderEpay,
		Status:          common.TopUpStatusPending,
		CreateTime:      common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(&topUp).Error)

	require.NoError(t, RechargeEpay(topUp.TradeNo, "alipay", "127.0.0.1"))
	require.NoError(t, RechargeEpay(topUp.TradeNo, "alipay", "127.0.0.1"))

	credit := common.QuotaFromFloat(common.QuotaPerUnit)
	var storedUser User
	require.NoError(t, DB.First(&storedUser, user.Id).Error)
	assert.Equal(t, credit, storedUser.Quota)
	storedTopUp := GetTopUpByTradeNo(topUp.TradeNo)
	require.NotNil(t, storedTopUp)
	assert.Equal(t, common.TopUpStatusSuccess, storedTopUp.Status)
	assert.Equal(t, "alipay", storedTopUp.PaymentMethod)
	var count int64
	require.NoError(t, DB.Model(&BillingAdjustmentOutbox{}).Where(
		"request_id = ? AND phase = ? AND leg = ?",
		"topup:"+topUp.TradeNo,
		BillingAdjustmentPhaseExternalCredit,
		BillingAdjustmentLegWallet,
	).Count(&count).Error)
	assert.EqualValues(t, 1, count)
}

func TestRechargeStripeReplayCreditsExactlyOnce(t *testing.T) {
	truncateTables(t)
	oldRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = oldRedisEnabled })

	user := User{
		Username:       "external-credit-stripe-replay",
		Status:         common.UserStatusEnabled,
		StripeCustomer: "cus_external_credit_replay",
	}
	require.NoError(t, DB.Create(&user).Error)
	topUp := TopUp{
		UserId:          user.Id,
		Amount:          100,
		Money:           1,
		TradeNo:         "external-credit-stripe-replay",
		PaymentMethod:   PaymentMethodStripe,
		PaymentProvider: PaymentProviderStripe,
		Status:          common.TopUpStatusPending,
		CreateTime:      common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(&topUp).Error)

	require.NoError(t, Recharge(topUp.TradeNo, user.StripeCustomer, "127.0.0.1"))
	require.NoError(t, Recharge(topUp.TradeNo, user.StripeCustomer, "127.0.0.1"))

	credit := common.QuotaFromFloat(common.QuotaPerUnit)
	var storedUser User
	require.NoError(t, DB.First(&storedUser, user.Id).Error)
	assert.Equal(t, credit, storedUser.Quota)
	var count int64
	require.NoError(t, DB.Model(&BillingAdjustmentOutbox{}).Where(
		"request_id = ? AND phase = ? AND leg = ?",
		"topup:"+topUp.TradeNo,
		BillingAdjustmentPhaseExternalCredit,
		BillingAdjustmentLegWallet,
	).Count(&count).Error)
	assert.EqualValues(t, 1, count)
}

func TestRechargeEpayRejectsMismatchedProvider(t *testing.T) {
	truncateTables(t)
	user := User{Username: "external-credit-epay-provider-guard", Quota: 20, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	topUp := TopUp{
		UserId:          user.Id,
		Amount:          1,
		Money:           1,
		TradeNo:         "external-credit-epay-provider-guard",
		PaymentMethod:   PaymentMethodStripe,
		PaymentProvider: PaymentProviderStripe,
		Status:          common.TopUpStatusPending,
		CreateTime:      common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(&topUp).Error)

	require.ErrorIs(t, RechargeEpay(topUp.TradeNo, "alipay", "127.0.0.1"), ErrPaymentMethodMismatch)
	storedTopUp := GetTopUpByTradeNo(topUp.TradeNo)
	require.NotNil(t, storedTopUp)
	assert.Equal(t, common.TopUpStatusPending, storedTopUp.Status)
	var storedUser User
	require.NoError(t, DB.First(&storedUser, user.Id).Error)
	assert.Equal(t, 20, storedUser.Quota)
	var count int64
	require.NoError(t, DB.Model(&BillingAdjustmentOutbox{}).Where("request_id = ?", "topup:"+topUp.TradeNo).Count(&count).Error)
	assert.Zero(t, count)
}

func TestRedeemCommitsCodeAndCreditOutboxWhenRedisIsUnavailable(t *testing.T) {
	truncateTables(t)
	redisServer := useImageTaskTestRedis(t)
	require.NoError(t, DB.AutoMigrate(&Redemption{}))
	require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&Redemption{}).Error)

	user := User{Username: "external-credit-redemption", Quota: 20, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	redemption := Redemption{
		Name:        "external-credit-redemption",
		Key:         "30000000000000000000000000000001",
		Status:      common.RedemptionCodeStatusEnabled,
		Quota:       80,
		CreatedTime: common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(&redemption).Error)

	redisServer.Close()
	t.Cleanup(func() { _ = redisServer.Restart() })
	credited, err := Redeem(redemption.Key, user.Id)
	require.NoError(t, redisServer.Restart())
	require.NoError(t, err)
	assert.Equal(t, 80, credited)

	var storedRedemption Redemption
	require.NoError(t, DB.First(&storedRedemption, redemption.Id).Error)
	assert.Equal(t, common.RedemptionCodeStatusUsed, storedRedemption.Status)
	assert.Equal(t, user.Id, storedRedemption.UsedUserId)

	var storedUser User
	require.NoError(t, DB.First(&storedUser, user.Id).Error)
	assert.Equal(t, 20, storedUser.Quota)

	requestID := fmt.Sprintf("redemption:%d", redemption.Id)
	adjustment := loadExternalWalletCredit(t, requestID)
	assert.False(t, adjustment.DBApplied)
	assert.Equal(t, billingAdjustmentRetry, adjustment.Status)

	require.NoError(t, DB.Model(&BillingAdjustmentOutbox{}).Where("id = ?", adjustment.Id).Updates(map[string]interface{}{
		"next_attempt_at": 0,
		"lease_until":     0,
	}).Error)
	require.NoError(t, ProcessBillingAdjustmentOutbox(adjustment.Id))
	require.NoError(t, DB.First(&storedUser, user.Id).Error)
	assert.Equal(t, 100, storedUser.Quota)
}

func TestRedeemRollsBackCodeUseWhenCreditOutboxConflicts(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&Redemption{}))
	require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&Redemption{}).Error)

	user := User{Username: "external-credit-redemption-conflict", Quota: 20, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	redemption := Redemption{
		Name:        "external-credit-redemption-conflict",
		Key:         "30000000000000000000000000000002",
		Status:      common.RedemptionCodeStatusEnabled,
		Quota:       80,
		CreatedTime: common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(&redemption).Error)

	requestID := fmt.Sprintf("redemption:%d", redemption.Id)
	_, err := EnqueueBillingAdjustments([]BillingAdjustmentSpec{{
		RequestID: requestID,
		Phase:     BillingAdjustmentPhaseExternalCredit,
		Leg:       BillingAdjustmentLegWallet,
		UserID:    user.Id,
		Delta:     79,
	}})
	require.NoError(t, err)

	_, err = Redeem(redemption.Key, user.Id)
	require.Error(t, err)

	var storedRedemption Redemption
	require.NoError(t, DB.First(&storedRedemption, redemption.Id).Error)
	assert.Equal(t, common.RedemptionCodeStatusEnabled, storedRedemption.Status)
	assert.Zero(t, storedRedemption.UsedUserId)
	var storedUser User
	require.NoError(t, DB.First(&storedUser, user.Id).Error)
	assert.Equal(t, 20, storedUser.Quota)
}

func TestCheckinCreatesAndDeliversExternalCreditOutbox(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&Checkin{}))
	require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Checkin{}).Error)
	t.Cleanup(func() {
		require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Checkin{}).Error)
	})

	setting := operation_setting.GetCheckinSetting()
	previous := *setting
	setting.Enabled = true
	setting.MinQuota = 45
	setting.MaxQuota = 45
	t.Cleanup(func() { *setting = previous })

	user := User{Username: "external-credit-checkin", Quota: 20, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)

	checkin, err := UserCheckin(user.Id)
	require.NoError(t, err)
	require.NotNil(t, checkin)
	assert.Equal(t, 45, checkin.QuotaAwarded)

	var storedUser User
	require.NoError(t, DB.First(&storedUser, user.Id).Error)
	assert.Equal(t, 65, storedUser.Quota)

	requestID := fmt.Sprintf("checkin:%d:%s", user.Id, time.Now().Format("2006-01-02"))
	adjustment := loadExternalWalletCredit(t, requestID)
	assert.EqualValues(t, 45, adjustment.Delta)
	assert.True(t, adjustment.DBApplied)
	assert.True(t, adjustment.CacheApplied)
	assert.Equal(t, billingAdjustmentDelivered, adjustment.Status)
}

func TestCheckinRollsBackRecordWhenCreditOutboxConflicts(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&Checkin{}))
	require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Checkin{}).Error)
	t.Cleanup(func() {
		require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Checkin{}).Error)
	})

	setting := operation_setting.GetCheckinSetting()
	previous := *setting
	setting.Enabled = true
	setting.MinQuota = 45
	setting.MaxQuota = 45
	t.Cleanup(func() { *setting = previous })

	user := User{Username: "external-credit-checkin-conflict", Quota: 20, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	today := time.Now().Format("2006-01-02")
	requestID := fmt.Sprintf("checkin:%d:%s", user.Id, today)
	_, err := EnqueueBillingAdjustments([]BillingAdjustmentSpec{{
		RequestID: requestID,
		Phase:     BillingAdjustmentPhaseExternalCredit,
		Leg:       BillingAdjustmentLegWallet,
		UserID:    user.Id,
		Delta:     44,
	}})
	require.NoError(t, err)

	_, err = UserCheckin(user.Id)
	require.Error(t, err)
	var count int64
	require.NoError(t, DB.Model(&Checkin{}).Where("user_id = ? AND checkin_date = ?", user.Id, today).Count(&count).Error)
	assert.Zero(t, count)
	var storedUser User
	require.NoError(t, DB.First(&storedUser, user.Id).Error)
	assert.Equal(t, 20, storedUser.Quota)
}
