package controller

import (
	"fmt"
	"time"

	"github.com/go-fuego/fuego"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// GetCheckinStatus 获取用户签到状态和历史记录
func GetCheckinStatus(c fuego.ContextWithParams[dto.GetCheckinStatusParams]) (*dto.Response[dto.CheckinStatusData], error) {
	setting := operation_setting.GetCheckinSetting()
	if !setting.Enabled {
		return dto.Fail[dto.CheckinStatusData]("签到功能未启用")
	}
	userId := dto.UserID(c)
	p, _ := dto.ParseParams[dto.GetCheckinStatusParams](c)
	// 获取月份参数，默认为当前月份
	month := p.Month
	if month == "" {
		month = time.Now().Format("2006-01")
	}

	statsMap, err := model.GetUserCheckinStats(userId, month)
	if err != nil {
		return dto.Fail[dto.CheckinStatusData](err.Error())
	}

	var stats dto.CheckinStats
	if v, ok := statsMap["total_quota"].(int64); ok {
		stats.TotalQuota = v
	}
	if v, ok := statsMap["total_checkins"].(int64); ok {
		stats.TotalCheckins = v
	}
	if v, ok := statsMap["checkin_count"].(int); ok {
		stats.CheckinCount = v
	}
	if v, ok := statsMap["checked_in_today"].(bool); ok {
		stats.CheckedInToday = v
	}
	if v, ok := statsMap["records"].([]model.CheckinRecord); ok {
		records := make([]dto.CheckinRecord, len(v))
		for i, r := range v {
			records[i] = dto.CheckinRecord{
				CheckinDate:  r.CheckinDate,
				QuotaAwarded: r.QuotaAwarded,
			}
		}
		stats.Records = records
	}

	return dto.Ok(dto.CheckinStatusData{
		Enabled:  setting.Enabled,
		MinQuota: setting.MinQuota,
		MaxQuota: setting.MaxQuota,
		Stats:    stats,
	})
}

// DoCheckin 执行用户签到
func DoCheckin(c fuego.ContextNoBody) (*dto.Response[dto.CheckinResultData], error) {
	setting := operation_setting.GetCheckinSetting()
	if !setting.Enabled {
		return dto.Fail[dto.CheckinResultData]("签到功能未启用")
	}

	userId := dto.UserID(c)

	checkin, err := model.UserCheckin(userId)
	if err != nil {
		return dto.Fail[dto.CheckinResultData](err.Error())
	}
	model.RecordLog(userId, model.LogTypeSystem, fmt.Sprintf("用户签到，获得额度 %s", logger.LogQuota(checkin.QuotaAwarded)))
	return dto.OkMsg("签到成功", dto.CheckinResultData{
		QuotaAwarded: checkin.QuotaAwarded,
		CheckinDate:  checkin.CheckinDate,
	})
}
