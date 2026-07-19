package model

import (
	"errors"
	"math"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

const (
	ChannelRatioFetchStatusSucceeded    = "succeeded"
	ChannelRatioFetchStatusFailed       = "failed"
	ChannelSmartScheduleStatusSucceeded = "succeeded"
	ChannelSmartScheduleStatusSkipped   = "skipped"
	ChannelSmartScheduleStatusFailed    = "failed"
)

type ChannelRatioMonitor struct {
	Id                          int      `json:"id"`
	ChannelId                   int      `json:"channel_id" gorm:"uniqueIndex;not null"`
	Ratio                       float64  `json:"ratio" gorm:"not null"`
	PreviousRatio               *float64 `json:"previous_ratio"`
	Remark                      string   `json:"remark" gorm:"type:varchar(255);default:''"`
	UpdatedTime                 int64    `json:"updated_time" gorm:"bigint;index"`
	UpdatedBy                   int      `json:"updated_by" gorm:"index"`
	UpdatedByUsername           string   `json:"updated_by_username" gorm:"type:varchar(64);default:''"`
	LastFetchStatus             string   `json:"last_fetch_status" gorm:"type:varchar(16);index"`
	LastFetchError              string   `json:"last_fetch_error" gorm:"type:varchar(255)"`
	LastFetchTime               int64    `json:"last_fetch_time" gorm:"bigint;index"`
	ConsecutiveFailures         int      `json:"consecutive_failures"`
	UpstreamBalance             *float64 `json:"upstream_balance"`
	LastBalanceTime             int64    `json:"last_balance_time" gorm:"bigint"`
	LastBalanceError            string   `json:"last_balance_error" gorm:"type:varchar(255)"`
	BalanceWarningThreshold     *float64 `json:"balance_warning_threshold"`
	BalanceAlertNotified        bool     `json:"balance_alert_notified"`
	UpstreamType                string   `json:"upstream_type" gorm:"type:varchar(32)"`
	UpstreamBaseURL             string   `json:"upstream_base_url" gorm:"type:text"`
	UpstreamGroup               string   `json:"upstream_group" gorm:"type:varchar(64)"`
	UpstreamAuthType            string   `json:"upstream_auth_type" gorm:"type:varchar(16)"`
	UpstreamUserId              int      `json:"upstream_user_id"`
	UpstreamAccessToken         string   `json:"-" gorm:"type:text"`
	CostConversion              string   `json:"-" gorm:"type:text"`
	CustomUpstreamConfig        string   `json:"-" gorm:"type:text"`
	UpstreamRatioSyncDisabled   bool     `json:"-"`
	UpstreamBalanceSyncDisabled bool     `json:"-"`
	SingleChannelAction         string   `json:"single_channel_action" gorm:"type:varchar(32)"`
	MultipleChannelsAction      string   `json:"multiple_channels_action" gorm:"type:varchar(32)"`
	SmartScheduleExcluded       bool     `json:"smart_schedule_excluded"`
	LastScheduleStatus          string   `json:"last_schedule_status" gorm:"type:varchar(16);index"`
	LastScheduleError           string   `json:"last_schedule_error" gorm:"type:varchar(255)"`
	LastScheduleScore           *float64 `json:"last_schedule_score"`
	LastSchedulePriority        int64    `json:"last_schedule_priority" gorm:"bigint"`
	LastScheduleWeight          uint     `json:"last_schedule_weight"`
	LastScheduleTime            int64    `json:"last_schedule_time" gorm:"bigint;index"`
}

type ChannelRatioUpstreamOptions struct {
	SingleChannelAction     string
	MultipleChannelsAction  string
	BalanceWarningThreshold *float64
	RatioSyncEnabled        bool
	BalanceSyncEnabled      bool
	CostConversion          string
	CustomUpstreamConfig    string
}

type ChannelSmartScheduleResultUpdate struct {
	ChannelId int
	Status    string
	Error     string
	Score     *float64
	Priority  int64
	Weight    uint
	Time      int64
}

type ChannelRatioHistory struct {
	Id               int     `json:"id"`
	ChannelId        int     `json:"channel_id" gorm:"index;not null"`
	OldRatio         float64 `json:"old_ratio" gorm:"not null"`
	NewRatio         float64 `json:"new_ratio" gorm:"not null"`
	Remark           string  `json:"remark" gorm:"type:varchar(255);default:''"`
	CreatedTime      int64   `json:"created_time" gorm:"bigint;index"`
	OperatorId       int     `json:"operator_id" gorm:"index"`
	OperatorUsername string  `json:"operator_username" gorm:"type:varchar(64);default:''"`
}

func GetAllChannelsForMonitor() ([]*Channel, error) {
	var channels []*Channel
	err := resolveChannelSortOptions(false, nil).Apply(DB).
		Omit("key").
		Find(&channels).Error
	return channels, err
}

func GetChannelRatioMonitors() ([]ChannelRatioMonitor, error) {
	var monitors []ChannelRatioMonitor
	err := DB.Find(&monitors).Error
	return monitors, err
}

func GetChannelRatioMonitor(channelId int) (ChannelRatioMonitor, error) {
	var monitor ChannelRatioMonitor
	err := DB.Where("channel_id = ?", channelId).First(&monitor).Error
	return monitor, err
}

func SaveChannelRatioUpstreamConfig(channelId int, upstreamType string, baseURL string, group string, authType string, userId int, accessToken string, options ChannelRatioUpstreamOptions) (monitor ChannelRatioMonitor, err error) {
	err = DB.Transaction(func(tx *gorm.DB) error {
		findErr := lockForUpdate(tx).Where("channel_id = ?", channelId).First(&monitor).Error
		if errors.Is(findErr, gorm.ErrRecordNotFound) {
			monitor = ChannelRatioMonitor{ChannelId: channelId}
		} else if findErr != nil {
			return findErr
		}
		upstreamAccountChanged := monitor.UpstreamType != upstreamType ||
			monitor.UpstreamBaseURL != baseURL ||
			monitor.UpstreamAuthType != authType ||
			monitor.UpstreamUserId != userId ||
			monitor.UpstreamAccessToken != accessToken ||
			monitor.CustomUpstreamConfig != options.CustomUpstreamConfig
		balanceWarningThresholdChanged :=
			(monitor.BalanceWarningThreshold == nil) != (options.BalanceWarningThreshold == nil) ||
				(monitor.BalanceWarningThreshold != nil && options.BalanceWarningThreshold != nil &&
					*monitor.BalanceWarningThreshold != *options.BalanceWarningThreshold)
		balanceSyncChanged := monitor.UpstreamBalanceSyncDisabled != !options.BalanceSyncEnabled

		monitor.UpstreamType = upstreamType
		monitor.UpstreamBaseURL = baseURL
		monitor.UpstreamGroup = group
		monitor.UpstreamAuthType = authType
		monitor.UpstreamUserId = userId
		monitor.UpstreamAccessToken = accessToken
		monitor.CostConversion = options.CostConversion
		monitor.CustomUpstreamConfig = options.CustomUpstreamConfig
		monitor.UpstreamRatioSyncDisabled = !options.RatioSyncEnabled
		monitor.UpstreamBalanceSyncDisabled = !options.BalanceSyncEnabled
		monitor.SingleChannelAction = options.SingleChannelAction
		monitor.MultipleChannelsAction = options.MultipleChannelsAction
		if options.BalanceWarningThreshold == nil {
			monitor.BalanceWarningThreshold = nil
		} else {
			value := *options.BalanceWarningThreshold
			monitor.BalanceWarningThreshold = &value
		}
		if upstreamAccountChanged {
			monitor.UpstreamBalance = nil
			monitor.LastBalanceTime = 0
			monitor.LastBalanceError = ""
		}
		if upstreamAccountChanged || balanceWarningThresholdChanged || balanceSyncChanged {
			monitor.BalanceAlertNotified = false
		}
		return tx.Save(&monitor).Error
	})
	return monitor, err
}

func SaveChannelSmartScheduleConfig(channelId int, excluded bool) (monitor ChannelRatioMonitor, err error) {
	err = DB.Transaction(func(tx *gorm.DB) error {
		findErr := lockForUpdate(tx).Where("channel_id = ?", channelId).First(&monitor).Error
		if errors.Is(findErr, gorm.ErrRecordNotFound) {
			monitor = ChannelRatioMonitor{ChannelId: channelId}
		} else if findErr != nil {
			return findErr
		}

		monitor.SmartScheduleExcluded = excluded
		return tx.Save(&monitor).Error
	})
	return monitor, err
}

func ExcludeAllChannelsFromSmartSchedule() (int, error) {
	channelIds := make([]int, 0)
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&Channel{}).Pluck("id", &channelIds).Error; err != nil {
			return err
		}

		for _, channelId := range channelIds {
			var monitor ChannelRatioMonitor
			findErr := lockForUpdate(tx).Where("channel_id = ?", channelId).First(&monitor).Error
			if errors.Is(findErr, gorm.ErrRecordNotFound) {
				monitor = ChannelRatioMonitor{
					ChannelId:             channelId,
					SmartScheduleExcluded: true,
				}
				if err := tx.Create(&monitor).Error; err != nil {
					return err
				}
				continue
			}
			if findErr != nil {
				return findErr
			}
			if monitor.SmartScheduleExcluded {
				continue
			}
			if err := tx.Model(&monitor).Update("smart_schedule_excluded", true).Error; err != nil {
				return err
			}
		}
		return nil
	})
	return len(channelIds), err
}

func SaveChannelSmartScheduleResults(results []ChannelSmartScheduleResultUpdate) error {
	if len(results) == 0 {
		return nil
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		for _, result := range results {
			var monitor ChannelRatioMonitor
			findErr := lockForUpdate(tx).Where("channel_id = ?", result.ChannelId).First(&monitor).Error
			if errors.Is(findErr, gorm.ErrRecordNotFound) {
				monitor = ChannelRatioMonitor{ChannelId: result.ChannelId}
			} else if findErr != nil {
				return findErr
			}

			message := strings.TrimSpace(result.Error)
			messageRunes := []rune(message)
			if len(messageRunes) > 255 {
				message = string(messageRunes[:255])
			}
			updatedTime := result.Time
			if updatedTime <= 0 {
				updatedTime = common.GetTimestamp()
			}
			monitor.LastScheduleStatus = result.Status
			monitor.LastScheduleError = message
			monitor.LastScheduleScore = result.Score
			monitor.LastSchedulePriority = result.Priority
			monitor.LastScheduleWeight = result.Weight
			monitor.LastScheduleTime = updatedTime
			if err := tx.Save(&monitor).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func UpdateChannelSmartSchedulePriorityWeight(channelId int, priority *int64, weight *uint) error {
	channelUpdates := make(map[string]any, 2)
	abilityUpdates := make(map[string]any, 2)
	if priority != nil {
		channelUpdates["priority"] = *priority
		abilityUpdates["priority"] = *priority
	}
	if weight != nil {
		channelUpdates["weight"] = *weight
		abilityUpdates["weight"] = *weight
	}
	if len(channelUpdates) == 0 {
		return nil
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&Channel{}).Where("id = ?", channelId).Updates(channelUpdates)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			var count int64
			if err := tx.Model(&Channel{}).Where("id = ?", channelId).Count(&count).Error; err != nil {
				return err
			}
			if count == 0 {
				return gorm.ErrRecordNotFound
			}
		}
		return tx.Model(&Ability{}).Where("channel_id = ?", channelId).Updates(abilityUpdates).Error
	})
}

func UpdateChannelRatioMonitor(channelId int, ratio float64, remark string, operatorId int, operatorUsername string) (monitor ChannelRatioMonitor, created bool, changed bool, err error) {
	return updateChannelRatioMonitor(channelId, ratio, remark, operatorId, operatorUsername, false)
}

func UpdateChannelRatioMonitorFromUpstream(channelId int, ratio float64, remark string, operatorId int, operatorUsername string) (monitor ChannelRatioMonitor, created bool, changed bool, err error) {
	return updateChannelRatioMonitor(channelId, ratio, remark, operatorId, operatorUsername, true)
}

func RecordChannelRatioMonitorFetchFailure(channelId int, fetchError string) error {
	message := strings.TrimSpace(fetchError)
	if message == "" {
		message = "上游倍率获取失败"
	}
	messageRunes := []rune(message)
	if len(messageRunes) > 255 {
		message = string(messageRunes[:255])
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		var monitor ChannelRatioMonitor
		findErr := lockForUpdate(tx).Where("channel_id = ?", channelId).First(&monitor).Error
		if errors.Is(findErr, gorm.ErrRecordNotFound) {
			monitor = ChannelRatioMonitor{ChannelId: channelId}
		} else if findErr != nil {
			return findErr
		}

		monitor.LastFetchStatus = ChannelRatioFetchStatusFailed
		monitor.LastFetchError = message
		monitor.LastFetchTime = common.GetTimestamp()
		if monitor.ConsecutiveFailures < 0 {
			monitor.ConsecutiveFailures = 0
		}
		monitor.ConsecutiveFailures++
		return tx.Save(&monitor).Error
	})
}

func RecordChannelRatioMonitorBalance(channelId int, balance *float64, fetchError string) error {
	message := strings.TrimSpace(fetchError)
	if balance != nil && (math.IsNaN(*balance) || math.IsInf(*balance, 0)) {
		balance = nil
		message = "上游余额不是有效数字"
	}
	messageRunes := []rune(message)
	if len(messageRunes) > 255 {
		message = string(messageRunes[:255])
	}
	if balance == nil && message == "" {
		return nil
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		var monitor ChannelRatioMonitor
		findErr := lockForUpdate(tx).Where("channel_id = ?", channelId).First(&monitor).Error
		if errors.Is(findErr, gorm.ErrRecordNotFound) {
			monitor = ChannelRatioMonitor{ChannelId: channelId}
		} else if findErr != nil {
			return findErr
		}

		if balance != nil {
			value := *balance
			monitor.UpstreamBalance = &value
			monitor.LastBalanceTime = common.GetTimestamp()
			monitor.LastBalanceError = ""
			if monitor.BalanceWarningThreshold == nil || value >= *monitor.BalanceWarningThreshold {
				monitor.BalanceAlertNotified = false
			}
		} else {
			monitor.LastBalanceError = message
		}
		return tx.Save(&monitor).Error
	})
}

func MarkChannelRatioMonitorBalanceAlertsNotified(channelIds []int) error {
	if len(channelIds) == 0 {
		return nil
	}
	return DB.Model(&ChannelRatioMonitor{}).
		Where("channel_id IN ?", channelIds).
		Update("balance_alert_notified", true).Error
}

func updateChannelRatioMonitor(channelId int, ratio float64, remark string, operatorId int, operatorUsername string, fetchedFromUpstream bool) (monitor ChannelRatioMonitor, created bool, changed bool, err error) {
	err = DB.Transaction(func(tx *gorm.DB) error {
		query := lockForUpdate(tx).Where("channel_id = ?", channelId)
		findErr := query.First(&monitor).Error
		now := common.GetTimestamp()
		if errors.Is(findErr, gorm.ErrRecordNotFound) {
			monitor = ChannelRatioMonitor{
				ChannelId:         channelId,
				Ratio:             ratio,
				Remark:            remark,
				UpdatedTime:       now,
				UpdatedBy:         operatorId,
				UpdatedByUsername: operatorUsername,
			}
			if fetchedFromUpstream {
				monitor.LastFetchStatus = ChannelRatioFetchStatusSucceeded
				monitor.LastFetchTime = now
			}
			created = true
			return tx.Create(&monitor).Error
		}
		if findErr != nil {
			return findErr
		}

		if monitor.UpdatedTime == 0 {
			monitor.Ratio = ratio
			monitor.Remark = remark
			monitor.UpdatedTime = now
			monitor.UpdatedBy = operatorId
			monitor.UpdatedByUsername = operatorUsername
			if fetchedFromUpstream {
				monitor.LastFetchStatus = ChannelRatioFetchStatusSucceeded
				monitor.LastFetchError = ""
				monitor.LastFetchTime = now
				monitor.ConsecutiveFailures = 0
			}
			return tx.Save(&monitor).Error
		}

		changed = math.Abs(monitor.Ratio-ratio) > 1e-9
		if changed {
			history := ChannelRatioHistory{
				ChannelId:        channelId,
				OldRatio:         monitor.Ratio,
				NewRatio:         ratio,
				Remark:           remark,
				CreatedTime:      common.GetTimestamp(),
				OperatorId:       operatorId,
				OperatorUsername: operatorUsername,
			}
			if err := tx.Create(&history).Error; err != nil {
				return err
			}
			previousRatio := monitor.Ratio
			monitor.PreviousRatio = &previousRatio
		}

		monitor.Ratio = ratio
		monitor.Remark = remark
		monitor.UpdatedTime = now
		monitor.UpdatedBy = operatorId
		monitor.UpdatedByUsername = operatorUsername
		if fetchedFromUpstream {
			monitor.LastFetchStatus = ChannelRatioFetchStatusSucceeded
			monitor.LastFetchError = ""
			monitor.LastFetchTime = now
			monitor.ConsecutiveFailures = 0
		}
		return tx.Save(&monitor).Error
	})
	return monitor, created, changed, err
}

func GetChannelRatioHistory(channelId int, startIdx int, num int) (history []ChannelRatioHistory, total int64, err error) {
	query := DB.Model(&ChannelRatioHistory{}).Where("channel_id = ?", channelId)
	if err = query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err = query.Order("created_time desc, id desc").Limit(num).Offset(startIdx).Find(&history).Error
	return history, total, err
}

func GetChannelRatioMonitorTasks(startIdx int, num int) (tasks []*SystemTask, total int64, err error) {
	return GetChannelMonitorTasksByType(SystemTaskTypeChannelRatioMonitor, startIdx, num)
}

func GetChannelMonitorTasksByType(taskType string, startIdx int, num int) (tasks []*SystemTask, total int64, err error) {
	query := DB.Model(&SystemTask{}).Where("type = ?", taskType)
	if err = query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err = query.Order("id desc").Limit(num).Offset(startIdx).Find(&tasks).Error
	return tasks, total, err
}
