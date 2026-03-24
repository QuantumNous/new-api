package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

const (
	dashboardSelfRangeMaxSpanSeconds         int64 = 30 * 24 * 60 * 60
	dashboardAdminChannelRangeMaxSpanSeconds int64 = 90 * 24 * 60 * 60
)

func writeDashboardRangeError(c *gin.Context, message string) {
	c.JSON(http.StatusOK, gin.H{
		"success": false,
		"message": message,
	})
}

func parseDashboardRange(c *gin.Context, maxSpanSeconds int64, spanErrorMessage string) (int64, int64, bool) {
	startTimestamp, err := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "start_timestamp 格式错误",
		})
		return 0, 0, false
	}

	endTimestamp, err := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "end_timestamp 格式错误",
		})
		return 0, 0, false
	}

	if endTimestamp < startTimestamp {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "时间范围不合法",
		})
		return 0, 0, false
	}
	if maxSpanSeconds > 0 && endTimestamp-startTimestamp > maxSpanSeconds {
		writeDashboardRangeError(c, spanErrorMessage)
		return 0, 0, false
	}
	return startTimestamp, endTimestamp, true
}

// GetAllQuotaDates returns aggregated dashboard model data for admins.
func GetAllQuotaDates(c *gin.Context) {
	startTimestamp, endTimestamp, ok := parseDashboardRange(c, 0, "")
	if !ok {
		return
	}
	username := c.Query("username")
	dates, err := model.GetAllQuotaDates(startTimestamp, endTimestamp, username)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    dates,
	})
	return
}

// GetUserQuotaDates returns aggregated dashboard model data for the current user.
func GetUserQuotaDates(c *gin.Context) {
	userId := c.GetInt("id")
	startTimestamp, endTimestamp, ok := parseDashboardRange(
		c,
		dashboardSelfRangeMaxSpanSeconds,
		"时间跨度不能超过 1 个月",
	)
	if !ok {
		return
	}
	dates, err := model.GetQuotaDataByUserId(userId, startTimestamp, endTimestamp)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    dates,
	})
	return
}

// GetAllChannelQuotaDates returns aggregated dashboard channel data for admins.
func GetAllChannelQuotaDates(c *gin.Context) {
	startTimestamp, endTimestamp, ok := parseDashboardRange(
		c,
		dashboardAdminChannelRangeMaxSpanSeconds,
		"时间跨度不能超过 3 个月",
	)
	if !ok {
		return
	}
	username := c.Query("username")
	dates, err := model.GetAllChannelQuotaData(startTimestamp, endTimestamp, username)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    dates,
	})
}

// GetUserChannelQuotaDates returns aggregated dashboard channel data for the current user.
func GetUserChannelQuotaDates(c *gin.Context) {
	userId := c.GetInt("id")
	startTimestamp, endTimestamp, ok := parseDashboardRange(
		c,
		dashboardSelfRangeMaxSpanSeconds,
		"时间跨度不能超过 1 个月",
	)
	if !ok {
		return
	}
	dates, err := model.GetChannelQuotaDataByUserId(userId, startTimestamp, endTimestamp)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    dates,
	})
}
