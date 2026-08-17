package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// GetChannelProfit 返回渠道利润分析数据（管理员）。
func GetChannelProfit(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	channelID, _ := strconv.Atoi(c.Query("channel_id"))
	modelName := c.Query("model_name")

	summary, byChannel, byModel, err := model.SumChannelProfit(startTimestamp, endTimestamp, channelID, modelName)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	profitRate := func(revenue, cost float64) float64 {
		if revenue <= 0 {
			return 0
		}
		return (revenue - cost) / revenue
	}

	channelRows := make([]gin.H, 0, len(byChannel))
	costEnabledCount := 0
	for _, row := range byChannel {
		channelName := ""
		costEnabled := false
		if ch, err := model.CacheGetChannel(row.ChannelID); err == nil {
			channelName = ch.Name
			costEnabled = ch.GetCostSettings().Enabled
		}
		if costEnabled {
			costEnabledCount++
		}
		revenue := float64(row.Revenue)
		channelRows = append(channelRows, gin.H{
			"channel_id":   row.ChannelID,
			"channel_name": channelName,
			"revenue":      revenue,
			"cost":         row.Cost,
			"profit":       revenue - row.Cost,
			"profit_rate":  profitRate(revenue, row.Cost),
			"count":        row.Count,
			"cost_enabled": costEnabled,
		})
	}

	modelRows := make([]gin.H, 0, len(byModel))
	for _, row := range byModel {
		revenue := float64(row.Revenue)
		modelRows = append(modelRows, gin.H{
			"model_name":  row.ModelName,
			"revenue":     revenue,
			"cost":        row.Cost,
			"profit":      revenue - row.Cost,
			"profit_rate": profitRate(revenue, row.Cost),
			"count":       row.Count,
		})
	}

	revenueTotal := float64(summary.Revenue)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"summary": gin.H{
				"revenue":          revenueTotal,
				"cost":             summary.Cost,
				"profit":           revenueTotal - summary.Cost,
				"profit_rate":      profitRate(revenueTotal, summary.Cost),
				"count":            summary.Count,
				"topup_concession": summary.TopupConcession,
				"topup_count":      summary.TopupCount,
				"topup_profit":     -summary.TopupConcession,
				"cost_enabled":     costEnabledCount > 0,
			},
			"by_channel": channelRows,
			"by_model":   modelRows,
		},
	})
}
