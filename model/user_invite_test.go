package model

import (
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRegistrationTracksInvitesIndependentlyFromRewards(t *testing.T) {
	originalQuotaForNewUser := common.QuotaForNewUser
	originalQuotaForInviter := common.QuotaForInviter
	originalQuotaForInvitee := common.QuotaForInvitee
	originalPaymentSetting := *operation_setting.GetPaymentSetting()
	t.Cleanup(func() {
		common.QuotaForNewUser = originalQuotaForNewUser
		common.QuotaForInviter = originalQuotaForInviter
		common.QuotaForInvitee = originalQuotaForInvitee
		*operation_setting.GetPaymentSetting() = originalPaymentSetting
	})

	tests := []struct {
		name                string
		oauth               bool
		complianceConfirmed bool
		inviterReward       int
		inviteeReward       int
		wantInviterReward   int
		wantInviteeReward   int
	}{
		{
			name:                "password registration counts invite when rewards are zero",
			complianceConfirmed: true,
		},
		{
			name:          "oauth registration counts invite without compliance rewards",
			oauth:         true,
			inviterReward: 100,
			inviteeReward: 50,
		},
		{
			name:                "password registration still grants configured rewards",
			complianceConfirmed: true,
			inviterReward:       100,
			inviteeReward:       50,
			wantInviterReward:   100,
			wantInviteeReward:   50,
		},
	}

	for index, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			truncateTables(t)
			common.QuotaForNewUser = 0
			common.QuotaForInviter = test.inviterReward
			common.QuotaForInvitee = test.inviteeReward
			paymentSetting := operation_setting.GetPaymentSetting()
			paymentSetting.ComplianceConfirmed = test.complianceConfirmed
			paymentSetting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion

			inviter := User{
				Username: fmt.Sprintf("inviter-%d", index),
				AffCode:  fmt.Sprintf("inviter-code-%d", index),
				Status:   common.UserStatusEnabled,
			}
			require.NoError(t, DB.Create(&inviter).Error)

			invitee := User{
				Username:  fmt.Sprintf("invitee-%d", index),
				Password:  "password123",
				Status:    common.UserStatusEnabled,
				InviterId: inviter.Id,
			}
			if test.oauth {
				invitee.Password = ""
				invitee.AffCode = fmt.Sprintf("invitee-code-%d", index)
				require.NoError(t, DB.Create(&invitee).Error)
				invitee.FinalizeOAuthUserCreation(inviter.Id)
			} else {
				require.NoError(t, invitee.Insert(inviter.Id))
			}

			var storedInviter User
			require.NoError(t, DB.First(&storedInviter, inviter.Id).Error)
			assert.Equal(t, 1, storedInviter.AffCount)
			assert.Equal(t, test.wantInviterReward, storedInviter.AffQuota)
			assert.Equal(t, test.wantInviterReward, storedInviter.AffHistoryQuota)

			var storedInvitee User
			require.NoError(t, DB.First(&storedInvitee, invitee.Id).Error)
			assert.Equal(t, inviter.Id, storedInvitee.InviterId)
			assert.Equal(t, test.wantInviteeReward, storedInvitee.Quota)
		})
	}
}
