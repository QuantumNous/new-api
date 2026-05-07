package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/require"
)

func resetNotifyLimitStore() {
	notifyLimitStore.Range(func(key, _ any) bool {
		notifyLimitStore.Delete(key)
		return true
	})
}

func TestCheckNotificationLimitQuotaExceedDailyLimit(t *testing.T) {
	common.RedisEnabled = false
	constant.NotifyLimitCount = 10
	constant.NotificationLimitDurationMinute = 60
	resetNotifyLimitStore()
	userID := 910001

	ok, err := CheckNotificationLimit(userID, dto.NotifyTypeQuotaExceed)
	require.NoError(t, err)
	require.True(t, ok)

	ok, err = CheckNotificationLimit(userID, dto.NotifyTypeQuotaExceed)
	require.NoError(t, err)
	require.False(t, ok, "quota_exceed should be limited to once per day")
}

func TestCheckNotificationLimitNonQuotaTypeNotDailyOnce(t *testing.T) {
	common.RedisEnabled = false
	constant.NotifyLimitCount = 10
	constant.NotificationLimitDurationMinute = 60
	resetNotifyLimitStore()
	userID := 910002

	ok, err := CheckNotificationLimit(userID, dto.NotifyTypeChannelUpdate)
	require.NoError(t, err)
	require.True(t, ok)

	ok, err = CheckNotificationLimit(userID, dto.NotifyTypeChannelUpdate)
	require.NoError(t, err)
	require.True(t, ok, "non quota_exceed notify type should not be daily-once")
}
