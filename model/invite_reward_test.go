package model

import (
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func setupInviteRewardModelTest(t *testing.T) {
	t.Helper()

	originalPaymentSetting := *operation_setting.GetPaymentSetting()
	originalDB := DB
	originalLogDB := LOG_DB
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalRedisEnabled := common.RedisEnabled
	originalQuotaForNewUser := common.QuotaForNewUser
	originalQuotaForInviter := common.QuotaForInviter
	originalQuotaForInvitee := common.QuotaForInvitee
	originalQuotaForInviterMaxCount := common.QuotaForInviterMaxCount

	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/invite_reward.db?_pragma=busy_timeout(5000)"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(4)

	DB = db
	LOG_DB = db
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false
	require.NoError(t, db.AutoMigrate(&User{}, &Token{}, &TopUp{}, &Log{}, &InviteRewardEvent{}))

	t.Cleanup(func() {
		_ = sqlDB.Close()
		DB = originalDB
		LOG_DB = originalLogDB
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		common.RedisEnabled = originalRedisEnabled
		common.QuotaForNewUser = originalQuotaForNewUser
		common.QuotaForInviter = originalQuotaForInviter
		common.QuotaForInvitee = originalQuotaForInvitee
		common.QuotaForInviterMaxCount = originalQuotaForInviterMaxCount
		*operation_setting.GetPaymentSetting() = originalPaymentSetting
	})

	paymentSetting := operation_setting.GetPaymentSetting()
	paymentSetting.ComplianceConfirmed = true
	paymentSetting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	common.QuotaForNewUser = 0
	common.QuotaForInviter = 100
	common.QuotaForInvitee = 50
	common.QuotaForInviterMaxCount = 5
}

func createInviteRewardUser(t *testing.T, username string, inviterId int) *User {
	t.Helper()
	user := &User{Username: username, Password: "password123", Role: common.RoleCommonUser, InviterId: inviterId}
	require.NoError(t, user.Insert(inviterId))
	require.NoError(t, DB.First(user, "username = ?", username).Error)
	return user
}

func createInviteRewardTriggerToken(t *testing.T, userId int, key string) *Token {
	t.Helper()
	token := &Token{Name: "trigger-" + key, Key: key, ExpiredTime: -1, UnlimitedQuota: true}
	require.NoError(t, CreateUserToken(userId, token, 100))
	require.NotZero(t, token.Id)
	return token
}

func createInviteRewardTopUp(t *testing.T, userId int, tradeNo string) *TopUp {
	t.Helper()
	topUp := &TopUp{
		UserId:          userId,
		Amount:          2,
		Money:           2,
		TradeNo:         tradeNo,
		PaymentMethod:   PaymentMethodStripe,
		PaymentProvider: PaymentProviderStripe,
		Status:          common.TopUpStatusPending,
		CreateTime:      time.Now().Unix(),
	}
	require.NoError(t, topUp.Insert())
	require.NotZero(t, topUp.Id)
	return topUp
}

func TestInvitedUserInsertSetsPendingWithoutGrantingReward(t *testing.T) {
	setupInviteRewardModelTest(t)

	inviter := createInviteRewardUser(t, "inviter", 0)
	invitee := createInviteRewardUser(t, "invitee", inviter.Id)

	var refreshedInviter User
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.Equal(t, InviteRewardStatusPending, invitee.InviteRewardStatus)
	require.Zero(t, invitee.Quota)
	require.Zero(t, refreshedInviter.AffQuota)
	require.Zero(t, refreshedInviter.AffHistoryQuota)
	require.Zero(t, refreshedInviter.AffCount)
}

func TestNonInvitedUserInsertSetsInviteRewardNone(t *testing.T) {
	setupInviteRewardModelTest(t)

	user := createInviteRewardUser(t, "plain", 0)

	require.Equal(t, InviteRewardStatusNone, user.InviteRewardStatus)
}

func TestUserInsertTrustsInviterIdParameterOverStructField(t *testing.T) {
	setupInviteRewardModelTest(t)

	user := &User{Username: "stale_inviter", Password: "password123", Role: common.RoleCommonUser, InviterId: 12345}
	require.NoError(t, user.Insert(0))

	var refreshed User
	require.NoError(t, DB.First(&refreshed, "username = ?", user.Username).Error)
	require.Zero(t, refreshed.InviterId)
	require.Equal(t, InviteRewardStatusNone, refreshed.InviteRewardStatus)
}

func TestOAuthUserInsertWithTxPersistsInviterAndPendingWithoutGrantingReward(t *testing.T) {
	setupInviteRewardModelTest(t)

	inviter := createInviteRewardUser(t, "oauth_inviter", 0)
	invitee := &User{Username: "oauth_invitee", Role: common.RoleCommonUser}
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return invitee.InsertWithTx(tx, inviter.Id)
	}))
	invitee.FinalizeOAuthUserCreation(inviter.Id)

	var refreshedInvitee User
	require.NoError(t, DB.First(&refreshedInvitee, invitee.Id).Error)
	var refreshedInviter User
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.Equal(t, inviter.Id, refreshedInvitee.InviterId)
	require.Equal(t, InviteRewardStatusPending, refreshedInvitee.InviteRewardStatus)
	require.Zero(t, refreshedInvitee.Quota)
	require.Zero(t, refreshedInviter.AffQuota)
	require.Zero(t, refreshedInviter.AffHistoryQuota)
	require.Zero(t, refreshedInviter.AffCount)
}

func TestUserInsertWithTxTrustsInviterIdParameterOverStructField(t *testing.T) {
	setupInviteRewardModelTest(t)

	invitee := &User{Username: "oauth_stale_inviter", Role: common.RoleCommonUser, InviterId: 12345}
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return invitee.InsertWithTx(tx, 0)
	}))

	var refreshed User
	require.NoError(t, DB.First(&refreshed, "username = ?", invitee.Username).Error)
	require.Zero(t, refreshed.InviterId)
	require.Equal(t, InviteRewardStatusNone, refreshed.InviteRewardStatus)
}

func TestCreateUserTokenWithInviteRewardDoesNotGrantInviteReward(t *testing.T) {
	setupInviteRewardModelTest(t)

	inviter := createInviteRewardUser(t, "grant_inviter", 0)
	invitee := createInviteRewardUser(t, "grant_invitee", inviter.Id)

	token := &Token{Name: "manual", Key: "manual-key", ExpiredTime: -1, UnlimitedQuota: true}
	require.NoError(t, CreateUserTokenWithInviteReward(invitee.Id, token, 10, InviteRewardTriggerManualTokenCreate))
	require.NotZero(t, token.Id)

	var refreshedInvitee User
	require.NoError(t, DB.First(&refreshedInvitee, invitee.Id).Error)
	var refreshedInviter User
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.Equal(t, InviteRewardStatusPending, refreshedInvitee.InviteRewardStatus)
	require.Zero(t, refreshedInvitee.InviteRewardGrantedAt)
	require.Zero(t, refreshedInvitee.Quota)
	require.Zero(t, refreshedInviter.AffQuota)
	require.Zero(t, refreshedInviter.AffHistoryQuota)
	require.Zero(t, refreshedInviter.AffCount)

	second := &Token{Name: "manual2", Key: "manual-key-2", ExpiredTime: -1, UnlimitedQuota: true}
	require.NoError(t, CreateUserTokenWithInviteReward(invitee.Id, second, 10, InviteRewardTriggerManualTokenCreate))
	require.NoError(t, DB.First(&refreshedInvitee, invitee.Id).Error)
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.Zero(t, refreshedInvitee.Quota)
	require.Zero(t, refreshedInviter.AffQuota)
	require.Zero(t, refreshedInviter.AffHistoryQuota)
	require.Zero(t, refreshedInviter.AffCount)

	var events int64
	require.NoError(t, DB.Model(&InviteRewardEvent{}).Where("invitee_id = ?", invitee.Id).Count(&events).Error)
	require.Zero(t, events)
}

func TestEnsureInitialUserTokenWithInviteRewardCreatesOnlyOnceWithoutGrantingReward(t *testing.T) {
	setupInviteRewardModelTest(t)

	inviter := createInviteRewardUser(t, "initial_inviter", 0)
	invitee := createInviteRewardUser(t, "initial_invitee", inviter.Id)

	createdToken, created, err := EnsureInitialUserTokenWithInviteReward(invitee.Id, Token{
		Name: "initial", Key: "initial-key", ExpiredTime: -1, UnlimitedQuota: true,
	}, 10, InviteRewardTriggerInitialTokenCreate)
	require.NoError(t, err)
	require.True(t, created)
	require.NotNil(t, createdToken)

	createdToken, created, err = EnsureInitialUserTokenWithInviteReward(invitee.Id, Token{
		Name: "initial2", Key: "initial-key-2", ExpiredTime: -1, UnlimitedQuota: true,
	}, 10, InviteRewardTriggerInitialTokenCreate)
	require.NoError(t, err)
	require.False(t, created)
	require.Nil(t, createdToken)

	var refreshedInvitee User
	require.NoError(t, DB.First(&refreshedInvitee, invitee.Id).Error)
	var refreshedInviter User
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.Equal(t, InviteRewardStatusPending, refreshedInvitee.InviteRewardStatus)
	require.Zero(t, refreshedInvitee.Quota)
	require.Zero(t, refreshedInviter.AffQuota)
	require.Zero(t, refreshedInviter.AffCount)

	var events int64
	require.NoError(t, DB.Model(&InviteRewardEvent{}).Where("invitee_id = ?", invitee.Id).Count(&events).Error)
	require.Zero(t, events)
}

func TestInviteRewardGrantedOnceAfterTopUpSuccess(t *testing.T) {
	setupInviteRewardModelTest(t)
	common.QuotaForInviter = int(5 * common.QuotaPerUnit)
	common.QuotaForInvitee = int(5 * common.QuotaPerUnit)

	inviter := createInviteRewardUser(t, "topup_inviter", 0)
	invitee := createInviteRewardUser(t, "topup_invitee", inviter.Id)
	createInviteRewardTopUp(t, invitee.Id, "invite-topup-success")

	recharged, err := RechargeWithPaymentSnapshot("invite-topup-success", "cus_invite", "127.0.0.1", PaymentSnapshot{})
	require.NoError(t, err)
	require.True(t, recharged)
	recharged, err = RechargeWithPaymentSnapshot("invite-topup-success", "cus_invite", "127.0.0.1", PaymentSnapshot{})
	require.NoError(t, err)
	require.False(t, recharged)

	var refreshedInvitee User
	require.NoError(t, DB.First(&refreshedInvitee, invitee.Id).Error)
	var refreshedInviter User
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.Equal(t, InviteRewardStatusGranted, refreshedInvitee.InviteRewardStatus)
	require.NotZero(t, refreshedInvitee.InviteRewardGrantedAt)
	require.Equal(t, int(7*common.QuotaPerUnit), refreshedInvitee.Quota)
	require.Equal(t, int(5*common.QuotaPerUnit), refreshedInviter.AffQuota)
	require.Equal(t, int(5*common.QuotaPerUnit), refreshedInviter.AffHistoryQuota)
	require.Equal(t, 1, refreshedInviter.AffCount)

	var events int64
	require.NoError(t, DB.Model(&InviteRewardEvent{}).Where("invitee_id = ?", invitee.Id).Count(&events).Error)
	require.EqualValues(t, 1, events)
}

func TestInviteRewardTopUpSuccessGrantsFixedFiveUSDWhenConfiguredAmountsAreZero(t *testing.T) {
	setupInviteRewardModelTest(t)
	common.QuotaForInviter = 0
	common.QuotaForInvitee = 0

	inviter := createInviteRewardUser(t, "fixed_amount_inviter", 0)
	invitee := createInviteRewardUser(t, "fixed_amount_invitee", inviter.Id)
	createInviteRewardTopUp(t, invitee.Id, "invite-fixed-amount")

	recharged, err := RechargeWithPaymentSnapshot("invite-fixed-amount", "cus_fixed_amount", "127.0.0.1", PaymentSnapshot{})
	require.NoError(t, err)
	require.True(t, recharged)

	var refreshedInvitee User
	require.NoError(t, DB.First(&refreshedInvitee, invitee.Id).Error)
	var refreshedInviter User
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.Equal(t, int(7*common.QuotaPerUnit), refreshedInvitee.Quota)
	require.Equal(t, int(5*common.QuotaPerUnit), refreshedInviter.AffQuota)
	require.Equal(t, int(5*common.QuotaPerUnit), refreshedInviter.AffHistoryQuota)

	var event InviteRewardEvent
	require.NoError(t, DB.First(&event, "invitee_id = ?", invitee.Id).Error)
	require.Equal(t, int(5*common.QuotaPerUnit), event.InviterRewardQuota)
	require.Equal(t, int(5*common.QuotaPerUnit), event.InviteeRewardQuota)
}

func TestInviteRewardTopUpSuccessGrantsFixedFiveUSDWhenConfiguredAmountsDiffer(t *testing.T) {
	setupInviteRewardModelTest(t)
	common.QuotaForInviter = 123
	common.QuotaForInvitee = 456

	inviter := createInviteRewardUser(t, "fixed_config_inviter", 0)
	invitee := createInviteRewardUser(t, "fixed_config_invitee", inviter.Id)
	createInviteRewardTopUp(t, invitee.Id, "invite-fixed-config")

	recharged, err := RechargeWithPaymentSnapshot("invite-fixed-config", "cus_fixed_config", "127.0.0.1", PaymentSnapshot{})
	require.NoError(t, err)
	require.True(t, recharged)

	var refreshedInvitee User
	require.NoError(t, DB.First(&refreshedInvitee, invitee.Id).Error)
	var refreshedInviter User
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.Equal(t, int(7*common.QuotaPerUnit), refreshedInvitee.Quota)
	require.Equal(t, int(5*common.QuotaPerUnit), refreshedInviter.AffQuota)
	require.Equal(t, int(5*common.QuotaPerUnit), refreshedInviter.AffHistoryQuota)

	var event InviteRewardEvent
	require.NoError(t, DB.First(&event, "invitee_id = ?", invitee.Id).Error)
	require.Equal(t, int(5*common.QuotaPerUnit), event.InviterRewardQuota)
	require.Equal(t, int(5*common.QuotaPerUnit), event.InviteeRewardQuota)
}

func TestRegistrationDefaultTokenPathDoesNotTriggerInviteReward(t *testing.T) {
	setupInviteRewardModelTest(t)

	inviter := createInviteRewardUser(t, "default_path_inviter", 0)
	invitee := createInviteRewardUser(t, "default_path_invitee", inviter.Id)

	defaultToken := &Token{Name: "default", Key: "default-key", ExpiredTime: -1, UnlimitedQuota: true}
	require.NoError(t, CreateUserToken(invitee.Id, defaultToken, 10))

	var pendingInvitee User
	require.NoError(t, DB.First(&pendingInvitee, invitee.Id).Error)
	require.Equal(t, InviteRewardStatusPending, pendingInvitee.InviteRewardStatus)
	require.Zero(t, pendingInvitee.Quota)

	var events int64
	require.NoError(t, DB.Model(&InviteRewardEvent{}).Where("invitee_id = ?", invitee.Id).Count(&events).Error)
	require.Zero(t, events)
}

func TestInviteRewardConcurrentAttemptsGrantOnce(t *testing.T) {
	setupInviteRewardModelTest(t)
	rewardQuota := fixedInviteRewardQuota()

	inviter := createInviteRewardUser(t, "concurrent_inviter", 0)
	invitee := createInviteRewardUser(t, "concurrent_invitee", inviter.Id)

	const attempts = 8
	triggerTokens := make([]*Token, attempts)
	for i := 0; i < attempts; i++ {
		triggerTokens[i] = createInviteRewardTriggerToken(t, invitee.Id, fmt.Sprintf("concurrent-key-%d", i))
	}
	var wg sync.WaitGroup
	errs := make(chan error, attempts)
	for i := 0; i < attempts; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			var err error
			for retry := 0; retry < 20; retry++ {
				err = TryGrantInviteRewardAfterTokenCreated(invitee.Id, triggerTokens[i].Id, InviteRewardTriggerManualTokenCreate)
				if err == nil || !strings.Contains(err.Error(), "database is locked") {
					errs <- err
					return
				}
				time.Sleep(time.Duration(retry+1) * 10 * time.Millisecond)
			}
			errs <- err
		}(i)
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		require.NoError(t, err)
	}

	var refreshedInvitee User
	require.NoError(t, DB.First(&refreshedInvitee, invitee.Id).Error)
	var refreshedInviter User
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.Equal(t, rewardQuota, refreshedInvitee.Quota)
	require.Equal(t, rewardQuota, refreshedInviter.AffQuota)
	require.Equal(t, 1, refreshedInviter.AffCount)
	var events int64
	require.NoError(t, DB.Model(&InviteRewardEvent{}).Where("invitee_id = ?", invitee.Id).Count(&events).Error)
	require.EqualValues(t, 1, events)
}

func TestInviteRewardSkipsInviterRewardWhenLimitReached(t *testing.T) {
	setupInviteRewardModelTest(t)
	rewardQuota := fixedInviteRewardQuota()
	common.QuotaForInviterMaxCount = 2

	inviter := createInviteRewardUser(t, "limited_inviter", 0)
	for i := 0; i < 2; i++ {
		invitee := createInviteRewardUser(t, fmt.Sprintf("limited_invitee_%d", i), inviter.Id)
		token := createInviteRewardTriggerToken(t, invitee.Id, fmt.Sprintf("limited-key-%d", i))
		require.NoError(t, TryGrantInviteRewardAfterTokenCreated(invitee.Id, token.Id, InviteRewardTriggerManualTokenCreate))
	}

	limitReachedInvitee := createInviteRewardUser(t, "limited_invitee_skipped_inviter", inviter.Id)
	limitReachedToken := createInviteRewardTriggerToken(t, limitReachedInvitee.Id, "limited-key-skipped")
	require.NoError(t, TryGrantInviteRewardAfterTokenCreated(limitReachedInvitee.Id, limitReachedToken.Id, InviteRewardTriggerManualTokenCreate))

	var refreshedInviter User
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.Equal(t, 3, refreshedInviter.AffCount)
	require.Equal(t, 2*rewardQuota, refreshedInviter.AffQuota)
	require.Equal(t, 2*rewardQuota, refreshedInviter.AffHistoryQuota)

	var refreshedInvitee User
	require.NoError(t, DB.First(&refreshedInvitee, limitReachedInvitee.Id).Error)
	require.Equal(t, InviteRewardStatusGranted, refreshedInvitee.InviteRewardStatus)
	require.Empty(t, refreshedInvitee.InviteRewardBlockReason)
	require.Equal(t, rewardQuota, refreshedInvitee.Quota)

	var event InviteRewardEvent
	require.NoError(t, DB.First(&event, "invitee_id = ?", limitReachedInvitee.Id).Error)
	require.Equal(t, InviteRewardEventStatusGranted, event.Status)
	require.Equal(t, InviteRewardBlockReasonInviterLimitReached, event.Reason)
	require.Zero(t, event.InviterRewardQuota)
	require.Equal(t, rewardQuota, event.InviteeRewardQuota)

	var inviteeRewardLogs int64
	require.NoError(t, LOG_DB.Model(&Log{}).
		Where("user_id = ? AND type = ? AND content LIKE ?", limitReachedInvitee.Id, LogTypeSystem, "使用邀请码赠送%").
		Count(&inviteeRewardLogs).Error)
	require.EqualValues(t, 1, inviteeRewardLogs)

	var inviterRewardLogs int64
	require.NoError(t, LOG_DB.Model(&Log{}).
		Where("user_id = ? AND type = ? AND content LIKE ?", inviter.Id, LogTypeSystem, "邀请用户赠送%").
		Count(&inviterRewardLogs).Error)
	require.EqualValues(t, 2, inviterRewardLogs)

	var inviterLimitLogs int64
	require.NoError(t, LOG_DB.Model(&Log{}).
		Where("user_id = ? AND type = ? AND content = ?", inviter.Id, LogTypeSystem, "已达到邀请奖励上限，不再获得邀请者奖励").
		Count(&inviterLimitLogs).Error)
	require.EqualValues(t, 1, inviterLimitLogs)
}

func TestDefaultInviteRewardAmountsGrantFiveUSD(t *testing.T) {
	setupInviteRewardModelTest(t)
	common.QuotaForInviter = 0
	common.QuotaForInvitee = 0

	inviter := createInviteRewardUser(t, "zero_inviter", 0)
	invitee := createInviteRewardUser(t, "zero_invitee", inviter.Id)

	token := createInviteRewardTriggerToken(t, invitee.Id, "zero-key")
	require.NoError(t, TryGrantInviteRewardAfterTokenCreated(invitee.Id, token.Id, InviteRewardTriggerManualTokenCreate))

	var refreshedInvitee User
	require.NoError(t, DB.First(&refreshedInvitee, invitee.Id).Error)
	require.Equal(t, InviteRewardStatusGranted, refreshedInvitee.InviteRewardStatus)
	require.Equal(t, int(5*common.QuotaPerUnit), refreshedInvitee.Quota)

	var event InviteRewardEvent
	require.NoError(t, DB.First(&event, "invitee_id = ?", invitee.Id).Error)
	require.Equal(t, InviteRewardEventStatusGranted, event.Status)
	require.Equal(t, int(5*common.QuotaPerUnit), event.InviterRewardQuota)
	require.Equal(t, int(5*common.QuotaPerUnit), event.InviteeRewardQuota)

	var refreshedInviter User
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.Equal(t, 1, refreshedInviter.AffCount)
	require.Equal(t, int(5*common.QuotaPerUnit), refreshedInviter.AffQuota)
	require.Equal(t, int(5*common.QuotaPerUnit), refreshedInviter.AffHistoryQuota)
}

func TestInviteRewardDoesNotDependOnPaymentComplianceConfirmation(t *testing.T) {
	setupInviteRewardModelTest(t)
	rewardQuota := fixedInviteRewardQuota()
	operation_setting.GetPaymentSetting().ComplianceConfirmed = false

	inviter := createInviteRewardUser(t, "compliance_inviter", 0)
	invitee := createInviteRewardUser(t, "compliance_invitee", inviter.Id)

	token := createInviteRewardTriggerToken(t, invitee.Id, "compliance-key")
	require.NoError(t, TryGrantInviteRewardAfterTokenCreated(invitee.Id, token.Id, InviteRewardTriggerManualTokenCreate))

	var refreshedInvitee User
	require.NoError(t, DB.First(&refreshedInvitee, invitee.Id).Error)
	require.Equal(t, InviteRewardStatusGranted, refreshedInvitee.InviteRewardStatus)
	require.Equal(t, rewardQuota, refreshedInvitee.Quota)
	var events int64
	require.NoError(t, DB.Model(&InviteRewardEvent{}).Where("invitee_id = ?", invitee.Id).Count(&events).Error)
	require.EqualValues(t, 1, events)
}

func TestCreateUserTokenWithInviteRewardRollsBackOnInvalidTrigger(t *testing.T) {
	setupInviteRewardModelTest(t)

	inviter := createInviteRewardUser(t, "rollback_inviter", 0)
	invitee := createInviteRewardUser(t, "rollback_invitee", inviter.Id)

	token := &Token{Name: "manual", Key: "rollback-key", ExpiredTime: -1, UnlimitedQuota: true}
	err := CreateUserTokenWithInviteReward(invitee.Id, token, 10, "bad_trigger")
	require.Error(t, err)

	var tokenCount int64
	require.NoError(t, DB.Model(&Token{}).Where("user_id = ?", invitee.Id).Count(&tokenCount).Error)
	require.Zero(t, tokenCount)
}

func TestInviteRewardRequiresTriggerTokenOwnedByInvitee(t *testing.T) {
	setupInviteRewardModelTest(t)

	inviter := createInviteRewardUser(t, "token_owner_inviter", 0)
	invitee := createInviteRewardUser(t, "token_owner_invitee", inviter.Id)
	otherUser := createInviteRewardUser(t, "token_owner_other", 0)
	otherToken := createInviteRewardTriggerToken(t, otherUser.Id, "other-owned-key")

	err := TryGrantInviteRewardAfterTokenCreated(invitee.Id, otherToken.Id, InviteRewardTriggerManualTokenCreate)
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)
	err = TryGrantInviteRewardAfterTokenCreated(invitee.Id, 987654, InviteRewardTriggerManualTokenCreate)
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)

	var refreshedInvitee User
	require.NoError(t, DB.First(&refreshedInvitee, invitee.Id).Error)
	require.Equal(t, InviteRewardStatusPending, refreshedInvitee.InviteRewardStatus)
	require.Zero(t, refreshedInvitee.Quota)

	var refreshedInviter User
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.Zero(t, refreshedInviter.AffQuota)
	require.Zero(t, refreshedInviter.AffHistoryQuota)
	require.Zero(t, refreshedInviter.AffCount)

	var events int64
	require.NoError(t, DB.Model(&InviteRewardEvent{}).Where("invitee_id = ?", invitee.Id).Count(&events).Error)
	require.Zero(t, events)
}

func TestInviteRewardBlocksMissingInviterWithoutDuplicateEvents(t *testing.T) {
	setupInviteRewardModelTest(t)

	invitee := createInviteRewardUser(t, "missing_inviter_invitee", 0)
	triggerToken := createInviteRewardTriggerToken(t, invitee.Id, "missing-inviter-key")
	require.NoError(t, DB.Model(&User{}).Where("id = ?", invitee.Id).Updates(map[string]any{
		"inviter_id":                 987654,
		"invite_reward_status":       InviteRewardStatusPending,
		"invite_reward_block_reason": "",
		"invite_reward_granted_at":   0,
	}).Error)

	for i := 0; i < 2; i++ {
		err := TryGrantInviteRewardAfterTokenCreated(invitee.Id, triggerToken.Id, InviteRewardTriggerManualTokenCreate)
		require.NoError(t, err)
	}

	var refreshedInvitee User
	require.NoError(t, DB.First(&refreshedInvitee, invitee.Id).Error)
	require.Equal(t, InviteRewardStatusBlocked, refreshedInvitee.InviteRewardStatus)
	require.Equal(t, InviteRewardBlockReasonInviterMissing, refreshedInvitee.InviteRewardBlockReason)
	var events []InviteRewardEvent
	require.NoError(t, DB.Find(&events, "invitee_id = ?", invitee.Id).Error)
	require.Len(t, events, 1)
	require.Equal(t, InviteRewardEventStatusBlocked, events[0].Status)
}

func TestInviteRewardEventInviteeUniqueIndex(t *testing.T) {
	setupInviteRewardModelTest(t)

	event := InviteRewardEvent{InviteeId: 1, InviterId: 2, TriggerType: InviteRewardTriggerManualTokenCreate, TriggerTokenId: 10, Status: InviteRewardEventStatusGranted}
	require.NoError(t, DB.Create(&event).Error)
	duplicate := InviteRewardEvent{InviteeId: 1, InviterId: 3, TriggerType: InviteRewardTriggerManualTokenCreate, TriggerTokenId: 11, Status: InviteRewardEventStatusGranted}
	require.Error(t, DB.Create(&duplicate).Error)
}

func TestCreateUserTokenWithInviteRewardRejectsNilToken(t *testing.T) {
	setupInviteRewardModelTest(t)

	err := CreateUserTokenWithInviteReward(1, nil, 10, InviteRewardTriggerManualTokenCreate)
	require.Error(t, err)
}

func TestCreateUserTokenWithInviteRewardHonorsTokenLimit(t *testing.T) {
	setupInviteRewardModelTest(t)

	user := createInviteRewardUser(t, "limit_user", 0)
	require.NoError(t, CreateUserToken(user.Id, &Token{Name: "existing", Key: "existing-limit-key", ExpiredTime: -1}, 10))

	err := CreateUserTokenWithInviteReward(user.Id, &Token{Name: "overflow", Key: "overflow-limit-key", ExpiredTime: -1}, 1, InviteRewardTriggerManualTokenCreate)
	require.True(t, errors.Is(err, ErrUserTokenLimitReached), fmt.Sprintf("got %v", err))
}

func TestInviteRewardMySQLSmoke(t *testing.T) {
	dsn := os.Getenv("TEST_MYSQL_DSN")
	if dsn == "" {
		t.Skip("set TEST_MYSQL_DSN to run MySQL invite reward smoke test")
	}
	runInviteRewardExternalDBSmoke(t, "mysql", dsn)
}

func TestInviteRewardPostgresSmoke(t *testing.T) {
	dsn := os.Getenv("TEST_POSTGRES_DSN")
	if dsn == "" {
		t.Skip("set TEST_POSTGRES_DSN to run PostgreSQL invite reward smoke test")
	}
	runInviteRewardExternalDBSmoke(t, "postgres", dsn)
}

func runInviteRewardExternalDBSmoke(t *testing.T, dialect string, dsn string) {
	t.Helper()

	originalPaymentSetting := *operation_setting.GetPaymentSetting()
	originalDB := DB
	originalLogDB := LOG_DB
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalRedisEnabled := common.RedisEnabled
	originalQuotaForNewUser := common.QuotaForNewUser
	originalQuotaForInviter := common.QuotaForInviter
	originalQuotaForInvitee := common.QuotaForInvitee
	originalQuotaForInviterMaxCount := common.QuotaForInviterMaxCount

	var (
		db  *gorm.DB
		err error
	)
	switch dialect {
	case "mysql":
		db, err = gorm.Open(mysql.Open(dsn), &gorm.Config{})
	case "postgres":
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	default:
		t.Fatalf("unsupported dialect %q", dialect)
	}
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)

	for _, table := range []string{"users", "tokens", "logs", "invite_reward_events"} {
		if db.Migrator().HasTable(table) {
			t.Skipf("refusing to run %s invite reward smoke against non-empty external database; table %s already exists", dialect, table)
		}
	}

	DB = db
	LOG_DB = db
	common.UsingSQLite = false
	common.UsingMySQL = dialect == "mysql"
	common.UsingPostgreSQL = dialect == "postgres"
	common.RedisEnabled = false
	require.NoError(t, db.AutoMigrate(&User{}, &Token{}, &Log{}, &InviteRewardEvent{}))

	t.Cleanup(func() {
		_ = db.Migrator().DropTable(&InviteRewardEvent{}, &Token{}, &Log{}, &User{})
		_ = sqlDB.Close()
		DB = originalDB
		LOG_DB = originalLogDB
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		common.RedisEnabled = originalRedisEnabled
		common.QuotaForNewUser = originalQuotaForNewUser
		common.QuotaForInviter = originalQuotaForInviter
		common.QuotaForInvitee = originalQuotaForInvitee
		common.QuotaForInviterMaxCount = originalQuotaForInviterMaxCount
		*operation_setting.GetPaymentSetting() = originalPaymentSetting
	})

	paymentSetting := operation_setting.GetPaymentSetting()
	paymentSetting.ComplianceConfirmed = false
	paymentSetting.ComplianceTermsVersion = ""
	common.QuotaForNewUser = 0
	common.QuotaForInviter = 100
	common.QuotaForInvitee = 50
	common.QuotaForInviterMaxCount = 5
	rewardQuota := fixedInviteRewardQuota()

	inviter := createInviteRewardUser(t, "external_inviter", 0)
	invitee := createInviteRewardUser(t, "external_invitee", inviter.Id)
	token := createInviteRewardTriggerToken(t, invitee.Id, "external-key")
	require.NoError(t, TryGrantInviteRewardAfterTokenCreated(invitee.Id, token.Id, InviteRewardTriggerManualTokenCreate))

	var refreshedInvitee User
	require.NoError(t, DB.First(&refreshedInvitee, invitee.Id).Error)
	var refreshedInviter User
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.Equal(t, InviteRewardStatusGranted, refreshedInvitee.InviteRewardStatus)
	require.Equal(t, rewardQuota, refreshedInvitee.Quota)
	require.Equal(t, rewardQuota, refreshedInviter.AffQuota)
	require.Equal(t, 1, refreshedInviter.AffCount)

	require.NoError(t, TryGrantInviteRewardAfterTokenCreated(invitee.Id, token.Id, InviteRewardTriggerManualTokenCreate))
	require.NoError(t, DB.First(&refreshedInvitee, invitee.Id).Error)
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.Equal(t, rewardQuota, refreshedInvitee.Quota)
	require.Equal(t, rewardQuota, refreshedInviter.AffQuota)
	require.Equal(t, 1, refreshedInviter.AffCount)

	var events int64
	require.NoError(t, DB.Model(&InviteRewardEvent{}).Where("invitee_id = ?", invitee.Id).Count(&events).Error)
	require.EqualValues(t, 1, events)

	rollbackInvitee := createInviteRewardUser(t, "external_rollback_invitee", inviter.Id)
	err = CreateUserTokenWithInviteReward(rollbackInvitee.Id, &Token{Name: "bad", Key: "external-bad-key", ExpiredTime: -1}, 10, "bad_trigger")
	require.Error(t, err)
	var tokenCount int64
	require.NoError(t, DB.Model(&Token{}).Where("user_id = ?", rollbackInvitee.Id).Count(&tokenCount).Error)
	require.Zero(t, tokenCount)
}
