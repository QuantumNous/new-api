package controller

import (
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

// GetLotteryStatus 获取抽奖状态
func GetLotteryStatus(c *gin.Context) {
	if !operation_setting.IsLotteryEnabled() {
		common.ApiErrorMsg(c, "抽奖功能未启用")
		return
	}
	userId := c.GetInt("id")
	data, err := model.GetUserLotteryState(userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    data,
	})
}

type lotteryDrawRequest struct {
	BetUSD float64 `json:"bet_usd"`
}

// DoLottery 执行抽奖
func DoLottery(c *gin.Context) {
	if !operation_setting.IsLotteryEnabled() {
		common.ApiErrorMsg(c, "抽奖功能未启用")
		return
	}

	var req lotteryDrawRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		req.BetUSD = 0
	}

	userId := c.GetInt("id")
	result, err := model.UserLotteryDraw(userId, req.BetUSD, c.ClientIP())
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	usdDelta := operation_setting.QuotaToUsd(result.Draw.QuotaDelta)
	msg := fmt.Sprintf("老虎机抽奖：%s，额度变化 %s（约 $%.4f）", result.Draw.PrizeName, logger.LogQuota(result.Draw.QuotaDelta), usdDelta)
	model.RecordLog(userId, model.LogTypeSystem, msg)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "抽奖成功",
		"data": gin.H{
			"prize_index":        result.Draw.PrizeIndex,
			"prize_name":         result.Draw.PrizeName,
			"quota_delta":        result.Draw.QuotaDelta,
			"usd_delta":          usdDelta,
			"bet_quota":          result.Draw.BetQuota,
			"bet_usd":            operation_setting.QuotaToUsd(result.Draw.BetQuota),
			"is_thanks":          result.Draw.IsThanks,
			"is_pity":            result.Draw.IsPity,
			"is_thursday":        result.Draw.IsThursday,
			"remaining_pool":     result.RemainingPool,
			"remaining_pool_usd": operation_setting.QuotaToUsd(result.RemainingPool),
			"draw_date":          result.Draw.DrawDate,
		},
	})
}
