package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func GetDashboardChannelStats(c *gin.Context) {
	startTime, endTime := getDashboardTimeRange(c)
	scopeUserId := getMonitorScopeUserID(c)
	stats, err := model.GetDashboardChannelStats(startTime, endTime, scopeUserId)
	if err != nil {
		monitorError(c, err)
		return
	}
	monitorSuccess(c, stats)
}

func GetDashboardModelStats(c *gin.Context) {
	startTime, endTime := getDashboardTimeRange(c)
	scopeUserId := getMonitorScopeUserID(c)
	stats, err := model.GetDashboardModelStats(startTime, endTime, scopeUserId)
	if err != nil {
		monitorError(c, err)
		return
	}
	monitorSuccess(c, stats)
}

func GetDashboardOverview(c *gin.Context) {
	startTime, endTime := getDashboardTimeRange(c)
	scopeUserId := getMonitorScopeUserID(c)
	overview, err := model.GetDashboardOverview(startTime, endTime, scopeUserId)
	if err != nil {
		monitorError(c, err)
		return
	}
	monitorSuccess(c, overview)
}

func GetDashboardPromptLogs(c *gin.Context) {
	startTime, endTime := getDashboardTimeRange(c)
	scopeUserId := getMonitorScopeUserID(c)
	channelId, _ := strconv.Atoi(c.Query("channel_id"))
	start, _ := strconv.Atoi(c.DefaultQuery("start", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", strconv.Itoa(common.ItemsPerPage)))
	modelName := c.Query("model_name")
	username := ""
	if scopeUserId == 0 {
		username = c.Query("username")
	}
	result, err := model.GetDashboardPromptLogs(startTime, endTime, scopeUserId, channelId, modelName, username, start, limit)
	if err != nil {
		monitorError(c, err)
		return
	}
	monitorSuccess(c, result)
}

func getDashboardTimeRange(c *gin.Context) (int64, int64) {
	startTime, _ := strconv.ParseInt(c.Query("start_time"), 10, 64)
	endTime, _ := strconv.ParseInt(c.Query("end_time"), 10, 64)
	return model.NormalizeDashboardTimeRange(startTime, endTime)
}

func getMonitorScopeUserID(c *gin.Context) int {
	role := c.GetInt("role")
	if role >= common.RoleAdminUser {
		return 0
	}
	return c.GetInt("id")
}

func monitorSuccess(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"data":    data,
		"message": "",
	})
}

func monitorError(c *gin.Context, err error) {
	c.JSON(http.StatusOK, gin.H{
		"code":    1,
		"data":    nil,
		"message": err.Error(),
	})
}
