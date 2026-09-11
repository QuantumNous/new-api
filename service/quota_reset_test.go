package service

import (
	"fmt"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setGlobalQuotaReset(t *testing.T, enabled bool, period string, value int) {
	t.Helper()
	s := operation_setting.GetQuotaResetSetting()
	original := *s
	s.Enabled = enabled
	s.Period = period
	s.ResetValue = value
	t.Cleanup(func() { *s = original })
}

func seedQuotaResetUser(t *testing.T, id int, quota, usedQuota, requestCount, status int, setting dto.UserSetting) *model.User {
	t.Helper()
	user := &model.User{
		Id:           id,
		Username:     fmt.Sprintf("quota_reset_user_%d", id),
		AffCode:      fmt.Sprintf("quota-reset-aff-%d", id),
		Status:       status,
		Quota:        quota,
		UsedQuota:    usedQuota,
		RequestCount: requestCount,
	}
	user.SetSetting(setting)
	require.NoError(t, model.DB.Create(user).Error)
	return user
}

func getQuotaResetUser(t *testing.T, id int) *model.User {
	t.Helper()
	var user model.User
	require.NoError(t, model.DB.Where("id = ?", id).First(&user).Error)
	return &user
}

func getQuotaResetLogs(t *testing.T, userId int) []model.Log {
	t.Helper()
	var logs []model.Log
	require.NoError(t, model.LOG_DB.Where("user_id = ?", userId).Order("id").Find(&logs).Error)
	return logs
}

func TestResolveQuotaResetRule(t *testing.T) {
	cases := []struct {
		name       string
		status     int
		setting    dto.UserSetting
		global     operation_setting.QuotaResetSetting
		wantPeriod string
		wantValue  int
		wantOk     bool
	}{
		{
			name:   "opt_out_overrides_exclusive_rule",
			status: common.UserStatusEnabled,
			setting: dto.UserSetting{
				QuotaResetOptOut: true,
				QuotaResetRule:   &dto.QuotaResetRule{Period: operation_setting.QuotaResetPeriodWeekly, Value: 100000},
			},
			global: operation_setting.QuotaResetSetting{Enabled: true, Period: operation_setting.QuotaResetPeriodDaily, ResetValue: 500000},
			wantOk: false,
		},
		{
			name:    "opt_out_overrides_global_rule",
			status:  common.UserStatusEnabled,
			setting: dto.UserSetting{QuotaResetOptOut: true},
			global:  operation_setting.QuotaResetSetting{Enabled: true, Period: operation_setting.QuotaResetPeriodMonthly, ResetValue: 500000},
			wantOk:  false,
		},
		{
			name:    "disabled_status_yields_no_rule",
			status:  common.UserStatusDisabled,
			setting: dto.UserSetting{},
			global:  operation_setting.QuotaResetSetting{Enabled: true, Period: operation_setting.QuotaResetPeriodMonthly, ResetValue: 500000},
			wantOk:  false,
		},
		{
			name:   "exclusive_rule_overrides_global_fields",
			status: common.UserStatusEnabled,
			setting: dto.UserSetting{
				QuotaResetRule: &dto.QuotaResetRule{Period: operation_setting.QuotaResetPeriodWeekly, Value: 100000},
			},
			global:     operation_setting.QuotaResetSetting{Enabled: true, Period: operation_setting.QuotaResetPeriodDaily, ResetValue: 999999},
			wantPeriod: operation_setting.QuotaResetPeriodWeekly,
			wantValue:  100000,
			wantOk:     true,
		},
		{
			name:       "global_rule_applies_without_exclusive_rule",
			status:     common.UserStatusEnabled,
			setting:    dto.UserSetting{},
			global:     operation_setting.QuotaResetSetting{Enabled: true, Period: operation_setting.QuotaResetPeriodMonthly, ResetValue: 500000},
			wantPeriod: operation_setting.QuotaResetPeriodMonthly,
			wantValue:  500000,
			wantOk:     true,
		},
		{
			name:    "no_rule_when_global_disabled_and_no_exclusive_rule",
			status:  common.UserStatusEnabled,
			setting: dto.UserSetting{},
			global:  operation_setting.QuotaResetSetting{Enabled: false, Period: operation_setting.QuotaResetPeriodMonthly, ResetValue: 500000},
			wantOk:  false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			setGlobalQuotaReset(t, tc.global.Enabled, tc.global.Period, tc.global.ResetValue)

			period, value, ok := ResolveQuotaResetRule(tc.status, tc.setting)

			assert.Equal(t, tc.wantOk, ok)
			if tc.wantOk {
				assert.Equal(t, tc.wantPeriod, period)
				assert.Equal(t, tc.wantValue, value)
			}
		})
	}
}

func TestNextQuotaResetTime(t *testing.T) {
	cases := []struct {
		name   string
		period string
		now    time.Time
		want   time.Time
	}{
		{
			name:   "daily_before_midnight_rolls_to_next_day",
			period: operation_setting.QuotaResetPeriodDaily,
			now:    time.Date(2026, 7, 6, 14, 30, 0, 0, time.Local),
			want:   time.Date(2026, 7, 7, 0, 0, 0, 0, time.Local),
		},
		{
			name:   "daily_exact_midnight_rolls_to_next_day",
			period: operation_setting.QuotaResetPeriodDaily,
			now:    time.Date(2026, 7, 6, 0, 0, 0, 0, time.Local),
			want:   time.Date(2026, 7, 7, 0, 0, 0, 0, time.Local),
		},
		{
			name:   "weekly_midweek_rolls_to_next_monday",
			period: operation_setting.QuotaResetPeriodWeekly,
			now:    time.Date(2026, 7, 1, 10, 0, 0, 0, time.Local), // Wednesday
			want:   time.Date(2026, 7, 6, 0, 0, 0, 0, time.Local),  // Monday
		},
		{
			name:   "weekly_exact_monday_midnight_rolls_to_next_monday",
			period: operation_setting.QuotaResetPeriodWeekly,
			now:    time.Date(2026, 7, 6, 0, 0, 0, 0, time.Local), // Monday
			want:   time.Date(2026, 7, 13, 0, 0, 0, 0, time.Local),
		},
		{
			name:   "monthly_midmonth_rolls_to_first_of_next_month",
			period: operation_setting.QuotaResetPeriodMonthly,
			now:    time.Date(2026, 7, 15, 10, 0, 0, 0, time.Local),
			want:   time.Date(2026, 8, 1, 0, 0, 0, 0, time.Local),
		},
		{
			name:   "monthly_exact_first_midnight_rolls_to_next_month",
			period: operation_setting.QuotaResetPeriodMonthly,
			now:    time.Date(2026, 8, 1, 0, 0, 0, 0, time.Local),
			want:   time.Date(2026, 9, 1, 0, 0, 0, 0, time.Local),
		},
		{
			name:   "monthly_crosses_month_end",
			period: operation_setting.QuotaResetPeriodMonthly,
			now:    time.Date(2026, 1, 31, 23, 59, 0, 0, time.Local),
			want:   time.Date(2026, 2, 1, 0, 0, 0, 0, time.Local),
		},
		{
			name:   "monthly_crosses_year_boundary",
			period: operation_setting.QuotaResetPeriodMonthly,
			now:    time.Date(2026, 12, 15, 10, 0, 0, 0, time.Local),
			want:   time.Date(2027, 1, 1, 0, 0, 0, 0, time.Local),
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := NextQuotaResetTime(tc.period, tc.now)
			assert.True(t, tc.want.Equal(got), "want %v, got %v", tc.want, got)
		})
	}
}

func TestCrossedQuotaResetPeriods(t *testing.T) {
	cases := []struct {
		name string
		from time.Time
		to   time.Time
		want []string
	}{
		{
			name: "same_day_no_midnight_crossed",
			from: time.Date(2026, 7, 8, 9, 0, 0, 0, time.Local),
			to:   time.Date(2026, 7, 8, 17, 0, 0, 0, time.Local),
			want: []string{},
		},
		{
			name: "crosses_ordinary_weekday_midnight_daily_only",
			from: time.Date(2026, 7, 7, 23, 0, 0, 0, time.Local), // Tuesday
			to:   time.Date(2026, 7, 8, 1, 0, 0, 0, time.Local),  // Wednesday
			want: []string{operation_setting.QuotaResetPeriodDaily},
		},
		{
			name: "crosses_monday_midnight_daily_and_weekly",
			from: time.Date(2026, 7, 5, 23, 0, 0, 0, time.Local), // Sunday
			to:   time.Date(2026, 7, 6, 1, 0, 0, 0, time.Local),  // Monday
			want: []string{operation_setting.QuotaResetPeriodDaily, operation_setting.QuotaResetPeriodWeekly},
		},
		{
			name: "crosses_first_of_month_midnight_daily_and_monthly",
			from: time.Date(2026, 6, 30, 23, 0, 0, 0, time.Local),
			to:   time.Date(2026, 7, 1, 1, 0, 0, 0, time.Local), // Wednesday, 1st
			want: []string{operation_setting.QuotaResetPeriodDaily, operation_setting.QuotaResetPeriodMonthly},
		},
		{
			name: "crosses_monday_and_first_of_month_midnight_all_three",
			from: time.Date(2026, 5, 31, 23, 0, 0, 0, time.Local),
			to:   time.Date(2026, 6, 1, 1, 0, 0, 0, time.Local), // Monday, 1st
			want: []string{
				operation_setting.QuotaResetPeriodDaily,
				operation_setting.QuotaResetPeriodWeekly,
				operation_setting.QuotaResetPeriodMonthly,
			},
		},
		{
			name: "from_exactly_at_midnight_excluded_from_half_open_interval",
			from: time.Date(2026, 7, 8, 0, 0, 0, 0, time.Local),
			to:   time.Date(2026, 7, 8, 12, 0, 0, 0, time.Local),
			want: []string{},
		},
		{
			name: "to_exactly_at_midnight_included_in_half_open_interval",
			from: time.Date(2026, 7, 7, 23, 0, 0, 0, time.Local),
			to:   time.Date(2026, 7, 8, 0, 0, 0, 0, time.Local),
			want: []string{operation_setting.QuotaResetPeriodDaily},
		},
		{
			name: "downtime_gap_missed_boundary_is_not_retroactively_triggered",
			from: time.Date(2026, 7, 8, 8, 0, 0, 0, time.Local),
			to:   time.Date(2026, 7, 8, 9, 0, 0, 0, time.Local),
			want: []string{},
		},
		{
			name: "spans_three_days_each_period_at_most_once",
			from: time.Date(2026, 7, 7, 12, 0, 0, 0, time.Local),
			to:   time.Date(2026, 7, 10, 12, 0, 0, 0, time.Local),
			want: []string{operation_setting.QuotaResetPeriodDaily},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := crossedQuotaResetPeriods(tc.from, tc.to)
			assert.ElementsMatch(t, tc.want, got)
		})
	}
}

func TestRunQuotaResetPass(t *testing.T) {
	t.Run("batch_resets_only_users_with_effective_rule", func(t *testing.T) {
		truncate(t)
		setGlobalQuotaReset(t, true, operation_setting.QuotaResetPeriodMonthly, 500000)

		globalLow := seedQuotaResetUser(t, 1001, 123456, 876544, 42, common.UserStatusEnabled, dto.UserSetting{})
		globalHigh := seedQuotaResetUser(t, 1002, 800000, 111, 3, common.UserStatusEnabled, dto.UserSetting{})
		exclusive := seedQuotaResetUser(t, 1003, 50, 222, 7, common.UserStatusEnabled, dto.UserSetting{
			QuotaResetRule: &dto.QuotaResetRule{Period: operation_setting.QuotaResetPeriodWeekly, Value: 100000},
		})
		optedOut := seedQuotaResetUser(t, 1004, 999, 333, 9, common.UserStatusEnabled, dto.UserSetting{QuotaResetOptOut: true})
		disabled := seedQuotaResetUser(t, 1005, 999, 444, 11, common.UserStatusDisabled, dto.UserSetting{})

		count, err := RunQuotaResetPass(nil, QuotaResetTriggerScheduled)
		require.NoError(t, err)
		assert.Equal(t, 3, count)

		assert.Equal(t, 500000, getQuotaResetUser(t, globalLow.Id).Quota)
		assert.Equal(t, 876544, getQuotaResetUser(t, globalLow.Id).UsedQuota)
		assert.Equal(t, 42, getQuotaResetUser(t, globalLow.Id).RequestCount)

		assert.Equal(t, 500000, getQuotaResetUser(t, globalHigh.Id).Quota)
		assert.Equal(t, 100000, getQuotaResetUser(t, exclusive.Id).Quota)

		assert.Equal(t, 999, getQuotaResetUser(t, optedOut.Id).Quota)
		assert.Equal(t, 999, getQuotaResetUser(t, disabled.Id).Quota)

		assert.Empty(t, getQuotaResetLogs(t, optedOut.Id))
		assert.Empty(t, getQuotaResetLogs(t, disabled.Id))

		globalLowLogs := getQuotaResetLogs(t, globalLow.Id)
		require.Len(t, globalLowLogs, 1)
		assert.Equal(t, model.LogTypeSystem, globalLowLogs[0].Type)
		assert.Equal(t, "额度重置（定时）：123456 -> 500000", globalLowLogs[0].Content)

		globalHighLogs := getQuotaResetLogs(t, globalHigh.Id)
		require.Len(t, globalHighLogs, 1)
		assert.Equal(t, "额度重置（定时）：800000 -> 500000", globalHighLogs[0].Content)

		exclusiveLogs := getQuotaResetLogs(t, exclusive.Id)
		require.Len(t, exclusiveLogs, 1)
		assert.Equal(t, "额度重置（定时）：50 -> 100000", exclusiveLogs[0].Content)
	})

	t.Run("periods_filter_excludes_non_matching_effective_period", func(t *testing.T) {
		truncate(t)
		setGlobalQuotaReset(t, true, operation_setting.QuotaResetPeriodMonthly, 777000)

		monthlyUser := seedQuotaResetUser(t, 2001, 1000, 0, 0, common.UserStatusEnabled, dto.UserSetting{})
		weeklyUser := seedQuotaResetUser(t, 2002, 50, 0, 0, common.UserStatusEnabled, dto.UserSetting{
			QuotaResetRule: &dto.QuotaResetRule{Period: operation_setting.QuotaResetPeriodWeekly, Value: 100000},
		})

		count, err := RunQuotaResetPass([]string{operation_setting.QuotaResetPeriodMonthly}, QuotaResetTriggerScheduled)
		require.NoError(t, err)
		assert.Equal(t, 1, count)

		assert.Equal(t, 777000, getQuotaResetUser(t, monthlyUser.Id).Quota)
		assert.Equal(t, 50, getQuotaResetUser(t, weeklyUser.Id).Quota)
		assert.Empty(t, getQuotaResetLogs(t, weeklyUser.Id))
	})

	t.Run("nil_periods_resets_all_users_with_effective_rule", func(t *testing.T) {
		truncate(t)
		setGlobalQuotaReset(t, true, operation_setting.QuotaResetPeriodMonthly, 777000)

		monthlyUser := seedQuotaResetUser(t, 3001, 1000, 0, 0, common.UserStatusEnabled, dto.UserSetting{})
		weeklyUser := seedQuotaResetUser(t, 3002, 50, 0, 0, common.UserStatusEnabled, dto.UserSetting{
			QuotaResetRule: &dto.QuotaResetRule{Period: operation_setting.QuotaResetPeriodWeekly, Value: 100000},
		})

		count, err := RunQuotaResetPass(nil, QuotaResetTriggerScheduled)
		require.NoError(t, err)
		assert.Equal(t, 2, count)
		assert.Equal(t, 777000, getQuotaResetUser(t, monthlyUser.Id).Quota)
		assert.Equal(t, 100000, getQuotaResetUser(t, weeklyUser.Id).Quota)
	})

	t.Run("empty_slice_periods_resets_all_users_with_effective_rule", func(t *testing.T) {
		truncate(t)
		setGlobalQuotaReset(t, true, operation_setting.QuotaResetPeriodMonthly, 777000)

		monthlyUser := seedQuotaResetUser(t, 4001, 1000, 0, 0, common.UserStatusEnabled, dto.UserSetting{})

		count, err := RunQuotaResetPass([]string{}, QuotaResetTriggerScheduled)
		require.NoError(t, err)
		assert.Equal(t, 1, count)
		assert.Equal(t, 777000, getQuotaResetUser(t, monthlyUser.Id).Quota)
	})

	t.Run("zero_reset_value_is_legal_and_recorded_as_manual", func(t *testing.T) {
		truncate(t)
		setGlobalQuotaReset(t, false, operation_setting.QuotaResetPeriodMonthly, 0)

		user := seedQuotaResetUser(t, 5001, 42, 0, 0, common.UserStatusEnabled, dto.UserSetting{
			QuotaResetRule: &dto.QuotaResetRule{Period: operation_setting.QuotaResetPeriodDaily, Value: 0},
		})

		count, err := RunQuotaResetPass(nil, QuotaResetTriggerManual)
		require.NoError(t, err)
		assert.Equal(t, 1, count)
		assert.Equal(t, 0, getQuotaResetUser(t, user.Id).Quota)

		logs := getQuotaResetLogs(t, user.Id)
		require.Len(t, logs, 1)
		assert.Equal(t, "额度重置（手动）：42 -> 0", logs[0].Content)
	})

	t.Run("two_consecutive_passes_with_same_reset_value_are_idempotent", func(t *testing.T) {
		truncate(t)
		setGlobalQuotaReset(t, true, operation_setting.QuotaResetPeriodDaily, 500000)

		user := seedQuotaResetUser(t, 6001, 300000, 0, 0, common.UserStatusEnabled, dto.UserSetting{})

		count1, err := RunQuotaResetPass(nil, QuotaResetTriggerScheduled)
		require.NoError(t, err)
		assert.Equal(t, 1, count1)
		assert.Equal(t, 500000, getQuotaResetUser(t, user.Id).Quota)

		count2, err := RunQuotaResetPass(nil, QuotaResetTriggerScheduled)
		require.NoError(t, err)
		assert.Equal(t, 1, count2)
		assert.Equal(t, 500000, getQuotaResetUser(t, user.Id).Quota)

		logs := getQuotaResetLogs(t, user.Id)
		require.Len(t, logs, 2)
		assert.Equal(t, "额度重置（定时）：300000 -> 500000", logs[0].Content)
		assert.Equal(t, "额度重置（定时）：500000 -> 500000", logs[1].Content)
	})
}

func TestQuotaResetTick(t *testing.T) {
	t.Run("crossed boundary runs pass and advances lastTick", func(t *testing.T) {
		truncate(t)
		setGlobalQuotaReset(t, true, operation_setting.QuotaResetPeriodDaily, 700)
		seedQuotaResetUser(t, 9001, 123, 10, 2, common.UserStatusEnabled, dto.UserSetting{})

		lastTick = time.Now().Add(-25 * time.Hour)
		before := time.Now()
		quotaResetTick()

		assert.Equal(t, 700, getQuotaResetUser(t, 9001).Quota)
		assert.False(t, lastTick.Before(before), "lastTick must advance to tick time")
	})

	t.Run("no boundary crossed leaves users untouched but advances lastTick", func(t *testing.T) {
		truncate(t)
		setGlobalQuotaReset(t, true, operation_setting.QuotaResetPeriodDaily, 700)
		seedQuotaResetUser(t, 9002, 123, 10, 2, common.UserStatusEnabled, dto.UserSetting{})

		lastTick = time.Now().Add(-time.Second)
		before := time.Now()
		quotaResetTick()

		assert.Equal(t, 123, getQuotaResetUser(t, 9002).Quota)
		assert.False(t, lastTick.Before(before))
	})

	t.Run("reentrant tick skips without advancing lastTick", func(t *testing.T) {
		truncate(t)
		setGlobalQuotaReset(t, true, operation_setting.QuotaResetPeriodDaily, 700)
		seedQuotaResetUser(t, 9003, 123, 10, 2, common.UserStatusEnabled, dto.UserSetting{})

		prev := time.Now().Add(-25 * time.Hour)
		lastTick = prev
		quotaResetTaskRunning.Store(true)
		t.Cleanup(func() { quotaResetTaskRunning.Store(false) })

		quotaResetTick()

		assert.Equal(t, 123, getQuotaResetUser(t, 9003).Quota)
		assert.True(t, lastTick.Equal(prev), "skipped tick must not advance lastTick")
	})
}
