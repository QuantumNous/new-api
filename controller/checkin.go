package controller

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

// GetCheckinStatus 获取用户签到状态和历史记录
func GetCheckinStatus(c *gin.Context) {
	setting := operation_setting.GetCheckinSetting()
	if !setting.Enabled {
		common.ApiErrorMsg(c, "签到功能未启用")
		return
	}
	userId := c.GetInt("id")
	// 获取月份参数，默认为当前月份
	month := c.DefaultQuery("month", time.Now().Format("2006-01"))

	stats, err := model.GetUserCheckinStats(userId, month)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"enabled":   setting.Enabled,
			"min_quota": setting.MinQuota,
			"max_quota": setting.MaxQuota,
			"stats":     stats,
		},
	})
}

// DoCheckin 执行用户签到
func DoCheckin(c *gin.Context) {
	setting := operation_setting.GetCheckinSetting()
	if !setting.Enabled {
		common.ApiErrorMsg(c, "签到功能未启用")
		return
	}
	captchaId := c.Query("captcha_id")
	captchaAnswer := c.Query("captcha_answer")
	captchaDisplayCount, _ := strconv.Atoi(c.Query("captcha_display_count"))
	captchaFirstSeenAt, _ := strconv.ParseInt(c.Query("captcha_first_seen_at"), 10, 64)
	captchaSubmittedAt := time.Now().UnixMilli()
	durationMs := int64(0)
	if captchaFirstSeenAt > 0 {
		durationMs = captchaSubmittedAt - captchaFirstSeenAt
		if durationMs < 0 {
			durationMs = 0
		}
	}
	if captchaId == "" || captchaAnswer == "" {
		common.ApiErrorMsg(c, "请输入图形验证码")
		return
	}
	if !common.VerifyCaptcha(captchaId, captchaAnswer) {
		common.ApiErrorMsg(c, "图形验证码错误或已过期，请刷新重试")
		return
	}

	userId := c.GetInt("id")

	checkin, err := model.UserCheckin(userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	model.RecordCheckinLog(userId, fmt.Sprintf("用户签到，获得额度 %s", logger.LogQuota(checkin.QuotaAwarded)), c.ClientIP(), durationMs, captchaDisplayCount, captchaAnswer, captchaFirstSeenAt, captchaSubmittedAt)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "签到成功",
		"data": gin.H{
			"quota_awarded": checkin.QuotaAwarded,
			"checkin_date":  checkin.CheckinDate},
	})
}
