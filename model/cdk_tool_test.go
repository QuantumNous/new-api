package model

import (
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func withCdkToolSetting(t *testing.T, setting operation_setting.CdkToolSetting) {
	t.Helper()
	previous := *operation_setting.GetCdkToolSetting()
	*operation_setting.GetCdkToolSetting() = setting
	t.Cleanup(func() {
		*operation_setting.GetCdkToolSetting() = previous
	})
}

func insertCdkToolUser(t *testing.T, id int, username string, quota int) {
	t.Helper()
	require.NoError(t, DB.Create(&User{
		Id:       id,
		Username: username,
		Password: "password",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
		Group:    "default",
		AffCode:  username + "_aff",
		Quota:    quota,
	}).Error)
}

func disableCdkToolUser(t *testing.T, id int) {
	t.Helper()
	require.NoError(t, DB.Model(&User{}).Where("id = ?", id).Update("status", common.UserStatusDisabled).Error)
}

func insertCdkToolRedemption(t *testing.T, key string, quota int) *Redemption {
	t.Helper()
	redemption := &Redemption{
		UserId:      1,
		Name:        "cdk-tool-test",
		Key:         key,
		Status:      common.RedemptionCodeStatusEnabled,
		Quota:       quota,
		CreatedTime: common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(redemption).Error)
	return redemption
}

func TestRedeemCdkToolCodeCreatesLimitedTokenAndIsIdempotent(t *testing.T) {
	truncateTables(t)
	serviceUserId := 7101
	quota := int(common.QuotaPerUnit * 100)
	withCdkToolSetting(t, operation_setting.CdkToolSetting{
		Enabled:         true,
		ServiceUserId:   serviceUserId,
		TokenNamePrefix: "cdk-tool",
	})
	insertCdkToolUser(t, serviceUserId, "cdk_service", 0)
	redemption := insertCdkToolRedemption(t, "cdk-success", quota)

	result, err := RedeemCdkToolCode("cdk-success")
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.False(t, result.Recovered)
	assert.Equal(t, redemption.Id, result.RedemptionId)
	assert.Equal(t, quota, result.RedeemedQuota)
	assert.Equal(t, 100.0, result.RedeemedAmount)
	assert.Equal(t, quota, result.TokenRemainingQuota)
	assert.Equal(t, 100.0, result.TokenRemainingAmount)
	assert.Equal(t, "default", result.TokenGroup)
	assert.True(t, strings.HasPrefix(result.ApiKey, "sk-"))
	assert.NotEmpty(t, result.ApiKeyMasked)
	assert.NotEmpty(t, result.RecoveryToken)

	var token Token
	require.NoError(t, DB.First(&token, result.TokenId).Error)
	assert.Equal(t, serviceUserId, token.UserId)
	assert.Equal(t, quota, token.RemainQuota)
	assert.False(t, token.UnlimitedQuota)
	assert.EqualValues(t, -1, token.ExpiredTime)
	assert.Equal(t, "cdk-tool-"+strconv.Itoa(redemption.Id), token.Name)
	assert.Equal(t, result.ApiKey, "sk-"+token.Key)

	var serviceUser User
	require.NoError(t, DB.First(&serviceUser, serviceUserId).Error)
	assert.Equal(t, quota, serviceUser.Quota)

	var redeemed Redemption
	require.NoError(t, DB.First(&redeemed, redemption.Id).Error)
	assert.Equal(t, common.RedemptionCodeStatusUsed, redeemed.Status)
	assert.Equal(t, serviceUserId, redeemed.UsedUserId)
	assert.Equal(t, token.Id, redeemed.RedeemedTokenId)
	assert.NotEmpty(t, redeemed.CdkToolRecoveryTokenHash)
	assert.NotEqual(t, result.RecoveryToken, redeemed.CdkToolRecoveryTokenHash)

	_, err = RedeemCdkToolCode("cdk-success")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "首次兑换的设备")

	_, err = RedeemCdkToolCode("cdk-success", "wrong-recovery-token")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "首次兑换的设备")

	recovered, err := RedeemCdkToolCode("cdk-success", result.RecoveryToken)
	require.NoError(t, err)
	require.NotNil(t, recovered)
	assert.True(t, recovered.Recovered)
	assert.Equal(t, result.TokenId, recovered.TokenId)
	assert.Equal(t, result.ApiKey, recovered.ApiKey)
	assert.Equal(t, result.RecoveryToken, recovered.RecoveryToken)

	var tokenCount int64
	require.NoError(t, DB.Model(&Token{}).Count(&tokenCount).Error)
	assert.EqualValues(t, 1, tokenCount)
	require.NoError(t, DB.First(&serviceUser, serviceUserId).Error)
	assert.Equal(t, quota, serviceUser.Quota)
}

func TestRedeemCdkToolCodeAllowsAutoTokenGroup(t *testing.T) {
	truncateTables(t)
	serviceUserId := 7101
	withCdkToolSetting(t, operation_setting.CdkToolSetting{
		Enabled:         true,
		ServiceUserId:   serviceUserId,
		TokenGroup:      "auto",
		TokenNamePrefix: "cdk-tool",
	})
	insertCdkToolUser(t, serviceUserId, "cdk_service_auto", 0)
	insertCdkToolRedemption(t, "cdk-auto-group", 100)

	result, err := RedeemCdkToolCode("cdk-auto-group")
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, "auto", result.TokenGroup)

	var token Token
	require.NoError(t, DB.First(&token, result.TokenId).Error)
	assert.Equal(t, "auto", token.Group)
}

func TestRedeemCdkToolCodeRequiresEnabledSetting(t *testing.T) {
	truncateTables(t)
	withCdkToolSetting(t, operation_setting.CdkToolSetting{
		Enabled:         false,
		ServiceUserId:   7101,
		TokenNamePrefix: "cdk-tool",
	})
	insertCdkToolUser(t, 7101, "cdk_service_disabled", 0)
	insertCdkToolRedemption(t, "cdk-disabled-setting", 100)

	_, err := RedeemCdkToolCode("cdk-disabled-setting")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "未启用")

	var tokenCount int64
	require.NoError(t, DB.Model(&Token{}).Count(&tokenCount).Error)
	assert.EqualValues(t, 0, tokenCount)
}

func TestRedeemCdkToolCodeRequiresUsableServiceUser(t *testing.T) {
	tests := []struct {
		name    string
		prepare func(t *testing.T, serviceUserId int)
		want    string
	}{
		{
			name: "missing service user",
			prepare: func(t *testing.T, serviceUserId int) {
				t.Helper()
			},
			want: "不存在",
		},
		{
			name: "disabled service user",
			prepare: func(t *testing.T, serviceUserId int) {
				t.Helper()
				insertCdkToolUser(t, serviceUserId, "cdk_service_disabled_user", 0)
				disableCdkToolUser(t, serviceUserId)
			},
			want: "已被禁用",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			truncateTables(t)
			serviceUserId := 7101
			withCdkToolSetting(t, operation_setting.CdkToolSetting{
				Enabled:         true,
				ServiceUserId:   serviceUserId,
				TokenNamePrefix: "cdk-tool",
			})
			test.prepare(t, serviceUserId)
			insertCdkToolRedemption(t, "cdk-"+test.name, 100)

			_, err := RedeemCdkToolCode("cdk-" + test.name)
			require.Error(t, err)
			assert.Contains(t, err.Error(), test.want)

			var tokenCount int64
			require.NoError(t, DB.Model(&Token{}).Count(&tokenCount).Error)
			assert.EqualValues(t, 0, tokenCount)
		})
	}
}

func TestRedeemCdkToolCodeRejectsInvalidRedemptionStates(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(redemption *Redemption)
		want   string
	}{
		{
			name: "expired",
			mutate: func(redemption *Redemption) {
				redemption.ExpiredTime = common.GetTimestamp() - 1
			},
			want: "过期",
		},
		{
			name: "used by normal user",
			mutate: func(redemption *Redemption) {
				redemption.Status = common.RedemptionCodeStatusUsed
				redemption.UsedUserId = 7202
			},
			want: "已被使用",
		},
		{
			name: "zero quota",
			mutate: func(redemption *Redemption) {
				redemption.Quota = 0
			},
			want: "额度无效",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			truncateTables(t)
			serviceUserId := 7101
			withCdkToolSetting(t, operation_setting.CdkToolSetting{
				Enabled:         true,
				ServiceUserId:   serviceUserId,
				TokenNamePrefix: "cdk-tool",
			})
			insertCdkToolUser(t, serviceUserId, "cdk_service_"+test.name, 0)
			redemption := insertCdkToolRedemption(t, "cdk-"+test.name, 100)
			test.mutate(redemption)
			require.NoError(t, DB.Save(redemption).Error)

			_, err := RedeemCdkToolCode("cdk-" + test.name)
			require.Error(t, err)
			assert.Contains(t, err.Error(), test.want)

			var tokenCount int64
			require.NoError(t, DB.Model(&Token{}).Count(&tokenCount).Error)
			assert.EqualValues(t, 0, tokenCount)
		})
	}
}
