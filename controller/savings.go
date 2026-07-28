package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

func GetUserSavingsSummary(c *gin.Context) {
	startTimestamp, endTimestamp, err := parseSavingsTimeRange(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "必须传入开始和结束时间",
		})
		return
	}
	effectiveEndTimestamp, err := service.NormalizeSavingsSummaryWindow(startTimestamp, endTimestamp)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	summary, err := service.GetUserSavingsSummary(c.GetInt("id"), startTimestamp, effectiveEndTimestamp)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, summary)
}

func GetUserSavingsTrend(c *gin.Context) {
	startTimestamp, endTimestamp, err := parseSavingsTimeRange(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "必须传入开始和结束时间",
		})
		return
	}
	granularity := c.Query("granularity")
	utcOffsetMinutes, err := strconv.Atoi(c.Query("utc_offset_minutes"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "必须传入时区偏移",
		})
		return
	}
	effectiveEndTimestamp, err := service.NormalizeSavingsTrendWindow(startTimestamp, endTimestamp, granularity, utcOffsetMinutes)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	trend, err := service.GetUserSavingsTrend(c.GetInt("id"), startTimestamp, effectiveEndTimestamp, granularity, utcOffsetMinutes)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, trend)
}

func parseSavingsTimeRange(c *gin.Context) (int64, int64, error) {
	startTimestamp, err := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	if err != nil {
		return 0, 0, err
	}
	endTimestamp, err := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	if err != nil {
		return 0, 0, err
	}
	return startTimestamp, endTimestamp, nil
}
