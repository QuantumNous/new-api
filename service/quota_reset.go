package service

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

type QuotaResetTrigger string

const (
	QuotaResetTriggerScheduled QuotaResetTrigger = "scheduled"
	QuotaResetTriggerManual    QuotaResetTrigger = "manual"
)

const quotaResetBatchSize = 500

func ResolveQuotaResetRule(status int, setting dto.UserSetting) (period string, value int, ok bool) {
	if setting.QuotaResetOptOut {
		return "", 0, false
	}
	if status != common.UserStatusEnabled {
		return "", 0, false
	}
	if setting.QuotaResetRule != nil {
		return setting.QuotaResetRule.Period, setting.QuotaResetRule.Value, true
	}
	global := operation_setting.GetQuotaResetSetting()
	if global.Enabled {
		return global.Period, global.ResetValue, true
	}
	return "", 0, false
}

func NextQuotaResetTime(period string, now time.Time) time.Time {
	switch period {
	case operation_setting.QuotaResetPeriodWeekly:
		daysUntilMonday := (int(time.Monday) - int(now.Weekday()) + 7) % 7
		next := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).AddDate(0, 0, daysUntilMonday)
		if !next.After(now) {
			next = next.AddDate(0, 0, 7)
		}
		return next
	case operation_setting.QuotaResetPeriodMonthly:
		next := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		if !next.After(now) {
			next = next.AddDate(0, 1, 0)
		}
		return next
	default:
		next := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		if !next.After(now) {
			next = next.AddDate(0, 0, 1)
		}
		return next
	}
}

func RunQuotaResetPass(periods []string, trigger QuotaResetTrigger) (int, error) {
	periodFilter := make(map[string]bool, len(periods))
	for _, p := range periods {
		periodFilter[p] = true
	}

	triggerLabel := "定时"
	if trigger == QuotaResetTriggerManual {
		triggerLabel = "手动"
	}

	resetCount := 0
	cursor := 0
	for {
		var users []model.User
		if err := model.DB.Where("id > ?", cursor).Order("id asc").Limit(quotaResetBatchSize).Find(&users).Error; err != nil {
			return resetCount, err
		}
		if len(users) == 0 {
			break
		}
		cursor = users[len(users)-1].Id

		for _, user := range users {
			period, value, ok := ResolveQuotaResetRule(user.Status, user.GetSetting())
			if !ok {
				continue
			}
			if len(periodFilter) > 0 && !periodFilter[period] {
				continue
			}
			oldQuota, err := model.ResetUserQuota(user.Id, value)
			if err != nil {
				common.SysLog(fmt.Sprintf("failed to reset quota for user %d: %s", user.Id, err.Error()))
				continue
			}
			model.RecordLog(user.Id, model.LogTypeSystem, fmt.Sprintf("额度重置（%s）：%d -> %d", triggerLabel, oldQuota, value))
			resetCount++
		}
	}
	return resetCount, nil
}
