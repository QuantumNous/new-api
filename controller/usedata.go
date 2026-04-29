package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

func GetAllQuotaDates(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	username := c.Query("username")
	modelName := c.Query("model_name")
	channelID, _ := strconv.Atoi(c.Query("channel"))
	providerKeyID, _ := strconv.Atoi(c.Query("provider_key_id"))
	tokenID, _ := strconv.Atoi(c.Query("token_id"))
	dimension := c.Query("dimension")
	metric := c.Query("metric")
	dates, err := model.GetDashboardQuotaData(model.DashboardUsageQuery{
		Username:       username,
		StartTimestamp: startTimestamp,
		EndTimestamp:   endTimestamp,
		ModelName:      modelName,
		ChannelID:      channelID,
		ProviderKeyID:  providerKeyID,
		TokenID:        tokenID,
		Dimension:      model.DashboardDimension(dimension),
		Metric:         model.DashboardMetric(metric),
	})
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

func GetQuotaDatesByUser(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	username := c.Query("username")
	modelName := c.Query("model_name")
	channelID, _ := strconv.Atoi(c.Query("channel"))
	providerKeyID, _ := strconv.Atoi(c.Query("provider_key_id"))
	tokenID, _ := strconv.Atoi(c.Query("token_id"))
	metric := c.Query("metric")
	dates, err := model.GetDashboardUserQuotaData(model.DashboardUsageQuery{
		Username:       username,
		StartTimestamp: startTimestamp,
		EndTimestamp:   endTimestamp,
		ModelName:      modelName,
		ChannelID:      channelID,
		ProviderKeyID:  providerKeyID,
		TokenID:        tokenID,
		Metric:         model.DashboardMetric(metric),
	})
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

func GetUserQuotaDates(c *gin.Context) {
	userId := c.GetInt("id")
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	modelName := c.Query("model_name")
	channelID, _ := strconv.Atoi(c.Query("channel"))
	providerKeyID, _ := strconv.Atoi(c.Query("provider_key_id"))
	tokenID, _ := strconv.Atoi(c.Query("token_id"))
	dimension := c.Query("dimension")
	metric := c.Query("metric")
	// 判断时间跨度是否超过 1 个月
	if endTimestamp-startTimestamp > 2592000 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "时间跨度不能超过 1 个月",
		})
		return
	}
	dates, err := model.GetDashboardQuotaData(model.DashboardUsageQuery{
		UserID:         userId,
		StartTimestamp: startTimestamp,
		EndTimestamp:   endTimestamp,
		ModelName:      modelName,
		ChannelID:      channelID,
		ProviderKeyID:  providerKeyID,
		TokenID:        tokenID,
		Dimension:      model.DashboardDimension(dimension),
		Metric:         model.DashboardMetric(metric),
	})
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
