package controller

import (
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/model"
	perfmetrics "github.com/QuantumNous/new-api/pkg/perf_metrics"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
)

func GetPerfMetricsSummary(c *gin.Context) {
	hours := 24
	if rawHours := c.Query("hours"); rawHours != "" {
		if parsed, err := strconv.Atoi(rawHours); err == nil {
			hours = parsed
		}
	}

	activeGroups := append(lo.Keys(ratio_setting.GetGroupRatioCopy()), "auto")
	result, err := perfmetrics.QuerySummaryAll(hours, activeGroups)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}

func GetPerfMetrics(c *gin.Context) {
	modelName := c.Query("model")
	if modelName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "model is required",
		})
		return
	}

	hours := 24
	if rawHours := c.Query("hours"); rawHours != "" {
		if parsed, err := strconv.Atoi(rawHours); err == nil {
			hours = parsed
		}
	}

	result, err := perfmetrics.Query(perfmetrics.QueryParams{
		Model: modelName,
		Group: c.Query("group"),
		Hours: hours,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	result.Groups = filterActiveGroups(result.Groups)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}

func filterActiveGroups(groups []perfmetrics.GroupResult) []perfmetrics.GroupResult {
	activeRatios := ratio_setting.GetGroupRatioCopy()
	return lo.Filter(groups, func(g perfmetrics.GroupResult, _ int) bool {
		_, ok := activeRatios[g.Group]
		return ok || g.Group == "auto"
	})
}

// ChannelPerfResponse represents the response for channel performance metrics overview.
type ChannelPerfResponse struct {
	Channels []ChannelPerfDetail `json:"channels"`
}

// ChannelPerfDetail represents per-channel metrics with nested model details.
type ChannelPerfDetail struct {
	ChannelID    int               `json:"channel_id"`
	RequestCount int64             `json:"request_count"`
	SuccessCount int64             `json:"success_count"`
	SuccessRate  *float64          `json:"success_rate"`
	Models       []ModelPerfDetail `json:"models"`
}

// ModelPerfDetail represents per-model metrics within a channel.
type ModelPerfDetail struct {
	ModelName    string   `json:"model_name"`
	RequestCount int64    `json:"request_count"`
	SuccessCount int64    `json:"success_count"`
	SuccessRate  *float64 `json:"success_rate"`
}

// ChannelModelPerfResponse represents the response for a specific channel/model combination.
type ChannelModelPerfResponse struct {
	ChannelID    int      `json:"channel_id"`
	ModelName    string   `json:"model_name"`
	RequestCount int64    `json:"request_count"`
	SuccessCount int64    `json:"success_count"`
	SuccessRate  *float64 `json:"success_rate"`
}

// GetChannelPerfMetrics returns channel performance overview with nested model details.
// GET /api/perf-metrics/channels?hours=24&group=default
func GetChannelPerfMetrics(c *gin.Context) {
	hours := 24
	if rawHours := c.Query("hours"); rawHours != "" {
		if parsed, err := strconv.Atoi(rawHours); err == nil {
			hours = parsed
		}
	}
	group := c.Query("group")

	startTs := time.Now().Add(-time.Duration(hours) * time.Hour).Unix()
	endTs := time.Now().Unix()

	totals, err := model.GetPerfMetricChannelTotals(startTs, endTs, group)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	modelDetails, err := model.GetPerfMetricChannelModelDetails(nil, "", group, startTs, endTs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	modelsByChannel := make(map[int][]model.PerfMetricChannelModelDetail)
	for _, detail := range modelDetails {
		modelsByChannel[detail.ChannelID] = append(modelsByChannel[detail.ChannelID], detail)
	}

	channels := make([]ChannelPerfDetail, 0, len(totals))
	for _, total := range totals {
		channelDetail := ChannelPerfDetail{
			ChannelID:    total.ChannelID,
			RequestCount: total.RequestCount,
			SuccessCount: total.SuccessCount,
			SuccessRate:  calculateSuccessRate(total.RequestCount, total.SuccessCount),
			Models:       make([]ModelPerfDetail, 0),
		}

		if models, ok := modelsByChannel[total.ChannelID]; ok {
			for _, model := range models {
				channelDetail.Models = append(channelDetail.Models, ModelPerfDetail{
					ModelName:    model.ModelName,
					RequestCount: model.RequestCount,
					SuccessCount: model.SuccessCount,
					SuccessRate:  calculateSuccessRate(model.RequestCount, model.SuccessCount),
				})
			}
		}

		channels = append(channels, channelDetail)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    ChannelPerfResponse{Channels: channels},
	})
}

// GetChannelModelPerfMetrics returns performance metrics for a specific channel/model combination.
// GET /api/perf-metrics/channels/:channel_id/models/:model_name?hours=24&group=default
func GetChannelModelPerfMetrics(c *gin.Context) {
	channelID, err := strconv.Atoi(c.Param("channel_id"))
	if err != nil || channelID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid channel_id",
		})
		return
	}

	modelName := c.Param("model_name")
	if modelName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "model_name is required",
		})
		return
	}

	hours := 24
	if rawHours := c.Query("hours"); rawHours != "" {
		if parsed, err := strconv.Atoi(rawHours); err == nil {
			hours = parsed
		}
	}
	group := c.Query("group")

	startTs := time.Now().Add(-time.Duration(hours) * time.Hour).Unix()
	endTs := time.Now().Unix()

	details, err := model.GetPerfMetricChannelModelDetails(&channelID, modelName, group, startTs, endTs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	response := ChannelModelPerfResponse{
		ChannelID:    channelID,
		ModelName:    modelName,
		RequestCount: 0,
		SuccessCount: 0,
		SuccessRate:  nil,
	}

	if len(details) > 0 {
		response.RequestCount = details[0].RequestCount
		response.SuccessCount = details[0].SuccessCount
		response.SuccessRate = calculateSuccessRate(details[0].RequestCount, details[0].SuccessCount)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    response,
	})
}

// calculateSuccessRate computes success rate as a percentage, returns nil if request count is zero.
func calculateSuccessRate(requests, successes int64) *float64 {
	if requests == 0 {
		return nil
	}
	rate := float64(successes) / float64(requests) * 100
	return &rate
}
