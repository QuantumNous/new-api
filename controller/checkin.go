package controller

import (
	"errors"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

func respondCheckinError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, model.ErrCheckinDisabled):
		common.ApiErrorI18n(c, i18n.MsgCheckinDisabled)
	case errors.Is(err, model.ErrCheckinAlreadyToday):
		common.ApiErrorI18n(c, i18n.MsgCheckinAlreadyToday)
	case errors.Is(err, model.ErrCheckinQuotaFailed):
		common.ApiErrorI18n(c, i18n.MsgCheckinQuotaFailed)
	case errors.Is(err, model.ErrCheckinInvalidMonth):
		common.ApiErrorI18n(c, i18n.MsgCheckinInvalidMonth)
	default:
		common.ApiErrorI18n(c, i18n.MsgCheckinFailed)
	}
}

// GetCheckinStatus returns the current user's check-in status and monthly history.
func GetCheckinStatus(c *gin.Context) {
	setting := operation_setting.GetCheckinSetting()
	if !setting.Enabled {
		common.ApiErrorT(c, "Check-in feature is not enabled")
		return
	}

	userId := c.GetInt("id")
	month := c.DefaultQuery("month", time.Now().Format("2006-01"))
	stats, err := model.GetUserCheckinStats(userId, month)
	if err != nil {
		respondCheckinError(c, err)
		return
	}

	minQuota, maxQuota := setting.QuotaRange()
	common.ApiSuccess(c, gin.H{
		"enabled":   setting.Enabled,
		"min_quota": minQuota,
		"max_quota": maxQuota,
		"stats":     stats,
	})
}

// DoCheckin records today's check-in and awards quota.
func DoCheckin(c *gin.Context) {
	setting := operation_setting.GetCheckinSetting()
	if !setting.Enabled {
		common.ApiErrorT(c, "Check-in feature is not enabled")
		return
	}

	userId := c.GetInt("id")
	checkin, err := model.UserCheckin(userId)
	if err != nil {
		respondCheckinError(c, err)
		return
	}
	model.RecordLog(userId, model.LogTypeSystem, common.NewMessage("Daily check-in, received {{quota}}", map[string]any{"quota": logger.FormatQuota(checkin.QuotaAwarded)}))
	common.ApiSuccessT(c, "Check-in successful", gin.H{
		"quota_awarded": checkin.QuotaAwarded,
		"checkin_date":  checkin.CheckinDate,
	})
}
