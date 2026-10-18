package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupRegistrationQuotaTest(t *testing.T) User {
	t.Helper()
	truncateTables(t)

	oldNewUserQuota := common.QuotaForNewUser
	oldInviteeQuota := common.QuotaForInvitee
	oldInviterQuota := common.QuotaForInviter
	oldPayment := *operation_setting.GetPaymentSetting()
	common.QuotaForNewUser = 100
	common.QuotaForInvitee = 25
	common.QuotaForInviter = 0
	payment := operation_setting.GetPaymentSetting()
	payment.ComplianceConfirmed = true
	payment.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	t.Cleanup(func() {
		common.QuotaForNewUser = oldNewUserQuota
		common.QuotaForInvitee = oldInviteeQuota
		common.QuotaForInviter = oldInviterQuota
		*operation_setting.GetPaymentSetting() = oldPayment
	})

	inviter := User{
		Username:    "registration-inviter-" + common.GetRandomString(6),
		Password:    "unused-password-hash",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AuthVersion: 1,
		AffCode:     "registration-aff-" + common.GetRandomString(8),
	}
	require.NoError(t, DB.Create(&inviter).Error)
	return inviter
}

func assertRegistrationInviteeQuotaAndAudit(t *testing.T, user User) {
	t.Helper()
	var stored User
	require.NoError(t, DB.First(&stored, user.Id).Error)
	assert.Equal(t, 125, stored.Quota)
	var opening []WalletRefundCreditEvent
	require.NoError(t, DB.Where("user_id = ?", user.Id).Find(&opening).Error)
	require.Len(t, opening, 1)
	assert.Equal(t, walletRefundOpening, opening[0].Kind)
	assert.Equal(t, "registration", opening[0].SourceType)
	assert.EqualValues(t, 125, opening[0].Quota) // Registration grants are never refundable purchases.

	var logs []Log
	require.NoError(t, LOG_DB.Where("user_id = ? AND type = ?", user.Id, LogTypeSystem).Find(&logs).Error)
	inviteeLogs := 0
	for _, log := range logs {
		var other struct {
			ContentParts []*common.Message `json:"content_parts"`
		}
		require.NoError(t, common.UnmarshalJsonStr(log.Other, &other))
		for _, message := range other.ContentParts {
			if message.Key == "Invitation code bonus {{quota}}" {
				inviteeLogs++
				assert.Equal(t, logger.FormatQuota(25), message.Params["quota"])
				assert.Equal(t, message.Error(), log.Content)
			}
		}
	}
	assert.Equal(t, 1, inviteeLogs, "audit must describe the invitee quota stored in the creation transaction")
}

func TestRegistrationInviteeQuotaIsAtomicWhenRedisUnavailable(t *testing.T) {
	inviter := setupRegistrationQuotaTest(t)
	server := useUserCacheMiniRedis(t)
	server.Close()

	user := User{
		Username:  "registration-user-" + common.GetRandomString(6),
		Password:  "",
		Role:      common.RoleCommonUser,
		Status:    common.UserStatusEnabled,
		Group:     "default",
		InviterId: inviter.Id,
	}
	require.NoError(t, user.Insert(inviter.Id))
	assertRegistrationInviteeQuotaAndAudit(t, user)
}

func TestOAuthRegistrationInviteeQuotaIsAtomicWhenRedisUnavailable(t *testing.T) {
	inviter := setupRegistrationQuotaTest(t)
	server := useUserCacheMiniRedis(t)
	server.Close()

	user := User{
		Username:  "oauth-registration-user-" + common.GetRandomString(6),
		Password:  "",
		Role:      common.RoleCommonUser,
		Status:    common.UserStatusEnabled,
		Group:     "default",
		InviterId: inviter.Id,
	}
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return user.InsertWithTx(tx, inviter.Id)
	}))
	user.FinalizeOAuthUserCreation(inviter.Id)
	assertRegistrationInviteeQuotaAndAudit(t, user)
}

func TestRegistrationInviteeQuotaOverflowLeavesNoUser(t *testing.T) {
	inviter := setupRegistrationQuotaTest(t)
	common.QuotaForNewUser = common.MaxWalletQuota
	common.QuotaForInvitee = 1

	username := "registration-overflow-" + common.GetRandomString(6)
	user := User{
		Username:  username,
		Password:  "",
		Role:      common.RoleCommonUser,
		Status:    common.UserStatusEnabled,
		Group:     "default",
		InviterId: inviter.Id,
	}
	err := user.Insert(inviter.Id)
	require.ErrorIs(t, err, ErrWalletQuotaLimitExceeded)

	var count int64
	require.NoError(t, DB.Model(&User{}).Where("username = ?", username).Count(&count).Error)
	assert.Zero(t, count)
}
