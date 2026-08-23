package model

import (
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/require"
)

func withCheckinSetting(t *testing.T, enabled bool, minQuota, maxQuota int) {
	t.Helper()
	setting := operation_setting.GetCheckinSetting()
	previous := *setting
	setting.Enabled = enabled
	setting.MinQuota = minQuota
	setting.MaxQuota = maxQuota
	t.Cleanup(func() {
		*setting = previous
	})
}

func withCheckinNow(t *testing.T, now time.Time) {
	t.Helper()
	previous := checkinNow
	checkinNow = func() time.Time { return now }
	t.Cleanup(func() {
		checkinNow = previous
	})
}

func createCheckinTestUser(t *testing.T, quota int) User {
	t.Helper()
	suffix := fmt.Sprintf("%d", time.Now().UnixNano()%1_000_000_000)
	user := User{
		Username: "ck" + suffix,
		Password: "unused-password-hash",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
		Group:    "default",
		Quota:    quota,
		AffCode:  "aff" + suffix,
	}
	require.NoError(t, DB.Create(&user).Error)
	return user
}

func TestUserCheckinDisabledReturnsSentinel(t *testing.T) {
	withCheckinSetting(t, false, 1000, 1000)
	_, err := UserCheckin(1)
	require.ErrorIs(t, err, ErrCheckinDisabled)
}

func TestParseCheckinMonthRejectsInvalidValue(t *testing.T) {
	_, _, err := parseCheckinMonth("2026/08")
	require.ErrorIs(t, err, ErrCheckinInvalidMonth)
}

func TestParseCheckinMonthUsesLastDayOfMonth(t *testing.T) {
	start, end, err := parseCheckinMonth("2026-02")
	require.NoError(t, err)
	require.Equal(t, "2026-02-01", start)
	require.Equal(t, "2026-02-28", end)
}

func TestGetUserCheckinStatsRejectsInvalidMonth(t *testing.T) {
	_, err := GetUserCheckinStats(1, "not-a-month")
	require.ErrorIs(t, err, ErrCheckinInvalidMonth)
}

func TestUserCheckinAwardsQuotaOncePerDay(t *testing.T) {
	require.NoError(t, DB.Exec("DELETE FROM checkins").Error)
	require.NoError(t, DB.Exec("DELETE FROM users").Error)
	t.Cleanup(func() {
		_ = DB.Exec("DELETE FROM checkins").Error
		_ = DB.Exec("DELETE FROM users").Error
	})

	now := time.Date(2026, 8, 22, 10, 0, 0, 0, time.Local)
	withCheckinNow(t, now)
	withCheckinSetting(t, true, 1500, 1500)

	user := createCheckinTestUser(t, 100)
	checkin, err := UserCheckin(user.Id)
	require.NoError(t, err)
	require.Equal(t, 1500, checkin.QuotaAwarded)
	require.Equal(t, "2026-08-22", checkin.CheckinDate)

	_, err = UserCheckin(user.Id)
	require.ErrorIs(t, err, ErrCheckinAlreadyToday)

	var stored User
	require.NoError(t, DB.First(&stored, user.Id).Error)
	require.Equal(t, 1600, stored.Quota)

	stats, err := GetUserCheckinStats(user.Id, "2026-08")
	require.NoError(t, err)
	require.True(t, stats.CheckedInToday)
	require.EqualValues(t, 1, stats.TotalCheckins)
	require.EqualValues(t, 1500, stats.TotalQuota)
	require.Equal(t, 1, stats.CheckinCount)
	require.Len(t, stats.Records, 1)
}

func TestUserCheckinDuplicateConstraintMapsToAlreadyToday(t *testing.T) {
	require.NoError(t, DB.Exec("DELETE FROM checkins").Error)
	require.NoError(t, DB.Exec("DELETE FROM users").Error)
	t.Cleanup(func() {
		_ = DB.Exec("DELETE FROM checkins").Error
		_ = DB.Exec("DELETE FROM users").Error
	})

	now := time.Date(2026, 8, 22, 12, 0, 0, 0, time.Local)
	withCheckinNow(t, now)
	withCheckinSetting(t, true, 100, 100)
	user := createCheckinTestUser(t, 0)

	require.NoError(t, DB.Create(&Checkin{
		UserId:       user.Id,
		CheckinDate:  "2026-08-22",
		QuotaAwarded: 100,
		CreatedAt:    now.Unix(),
	}).Error)

	_, err := UserCheckin(user.Id)
	require.True(t, errors.Is(err, ErrCheckinAlreadyToday), "got %v", err)
}
